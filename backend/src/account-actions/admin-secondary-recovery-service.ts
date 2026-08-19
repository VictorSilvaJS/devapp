import { randomUUID } from 'node:crypto';

import { normalizeEmail } from '../auth/normalization.js';
import type { AuthenticationRuntimeConfig } from '../auth/config.js';
import type { LoginThrottle } from '../auth/contracts.js';
import type { PasswordCredentialService } from '../auth/password-credential.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import { createOpaqueActionToken, hashActionToken } from '../security/action-token.js';
import { hmacIdentifier } from '../security/tokens.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
  type RestrictedAuthorizationDraft,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_CHALLENGE_TTL_MS = 30 * 60_000;
const DEFAULT_RESTRICTED_AUTHORIZATION_TTL_MS = 15 * 60_000;
const DEFAULT_NOTICE_TTL_MS = 24 * 60 * 60_000;

export interface AdminSecondaryRecoveryTarget {
  readonly account: AccountSnapshot;
  readonly verifiedSecondaryEmail: string;
  /** Opaque compare-and-set value for the verified secondary contact. */
  readonly secondaryEmailVersion: string;
}

export interface AdminSecondaryRecoveryDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly pendingNormalizedEmail: string;
  readonly state: 'awaiting_secondary_confirmation';
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

export interface AdminSecondaryChallengeInspection {
  readonly challengeId: string;
  readonly recoveryId: string;
  readonly target: AdminSecondaryRecoveryTarget;
  readonly pendingNormalizedEmail: string;
}

export interface AdminSecondaryRestrictedInspection {
  readonly authorizationId: string;
  readonly recoveryId: string;
  readonly organizationId: string;
  readonly user: AccountSnapshot;
  readonly currentNormalizedEmail: string;
  readonly verifiedSecondaryEmail: string;
  readonly pendingNormalizedEmail: string;
}

export interface AdminSecondaryRecoveryRepository {
  /** Lookup is private to a uniformly answered public initiation endpoint. */
  findActiveAdminByVerifiedSecondary(
    normalizedSecondaryEmail: string,
  ): Promise<AdminSecondaryRecoveryTarget | null>;
  /**
   * Revalidates the active Admin and unchanged verified secondary address,
   * enforces new-email uniqueness, replaces incompatible active recoveries,
   * and persists recovery/challenge/outbox/audit in one transaction.
   */
  startAtomically(input: {
    readonly expectedTarget: AdminSecondaryRecoveryTarget;
    readonly recovery: AdminSecondaryRecoveryDraft;
    readonly secondaryChallenge: ActionChallengeDraft;
    readonly secondaryActionEmail: ReturnType<
      EncryptedEmailOutboxFactory['action']
    >;
    readonly currentAddressNotice: ReturnType<
      EncryptedEmailOutboxFactory['notification']
    >;
    readonly audit: AuditEventDraft;
  }): Promise<
    'created' | 'target_unavailable' | 'email_unavailable' | 'concurrent_change'
  >;
  inspectUsableSecondaryChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<AdminSecondaryChallengeInspection | null>;
  /** Consumes proof of the verified secondary contact, creates the distinct
   * new-primary challenge, and enqueues it atomically. */
  confirmSecondaryAtomically(input: {
    readonly secondaryTokenSha256: string;
    readonly expected: AdminSecondaryChallengeInspection;
    readonly newPrimaryChallenge: ActionChallengeDraft;
    readonly newPrimaryActionEmail: ReturnType<
      EncryptedEmailOutboxFactory['action']
    >;
    readonly confirmedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
  inspectUsableNewPrimaryChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<AdminSecondaryChallengeInspection | null>;
  /** Consumes proof of the new primary address and creates a purpose-bound,
   * short authorization that cannot create a normal session. */
  confirmNewPrimaryAtomically(input: {
    readonly newPrimaryTokenSha256: string;
    readonly expected: AdminSecondaryChallengeInspection;
    readonly restrictedAuthorization: RestrictedAuthorizationDraft;
    readonly confirmedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
  inspectRestrictedAuthorization(input: {
    readonly tokenSha256: string;
    readonly requiredAction: 'set_new_password' | 'cancel_recovery';
    readonly now: Date;
  }): Promise<AdminSecondaryRestrictedInspection | null>;
  /** Locks and revalidates every input, applies primary email and PHC,
   * consumes the grant, revokes all sessions/tokens/challenges, increments
   * the security/authorization version, enqueues notices and audits atomically.
   * It must never activate an account or create a session. */
  completeAtomically(input: {
    readonly restrictedTokenSha256: string;
    readonly expected: AdminSecondaryRestrictedInspection;
    readonly passwordPhc: string;
    readonly passwordPolicyVersion: string;
    readonly completedAt: Date;
    readonly securityNotices: readonly ReturnType<
      EncryptedEmailOutboxFactory['notification']
    >[];
    readonly audit: AuditEventDraft;
  }): Promise<'completed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
  cancelAtomically(input: {
    readonly restrictedTokenSha256: string;
    readonly expectedAuthorizationId: string;
    readonly cancelledAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'cancelled' | 'invalid'>;
}

/**
 * Public self-service recovery for an active Admin who still controls the
 * previously verified secondary contact. This protocol is deliberately
 * separate from Admin-assisted recovery and platform break-glass.
 */
export class AdminSecondaryRecoveryService {
  readonly #repository: AdminSecondaryRecoveryRepository;
  readonly #passwordCredentials: PasswordCredentialService;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #challengeTtlMs: number;
  readonly #restrictedAuthorizationTtlMs: number;
  readonly #throttle: LoginThrottle;
  readonly #abuseProtection: AuthenticationRuntimeConfig['abuseProtection'];
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly repository: AdminSecondaryRecoveryRepository;
    readonly passwordCredentials: PasswordCredentialService;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly actionBaseUrl: string;
    readonly throttle: LoginThrottle;
    readonly abuseProtection: AuthenticationRuntimeConfig['abuseProtection'];
    readonly challengeTtlMs?: number;
    readonly restrictedAuthorizationTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    this.#repository = options.repository;
    this.#passwordCredentials = options.passwordCredentials;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#throttle = options.throttle;
    this.#abuseProtection = options.abuseProtection;
    this.#challengeTtlMs = options.challengeTtlMs ?? DEFAULT_CHALLENGE_TTL_MS;
    this.#restrictedAuthorizationTtlMs =
      options.restrictedAuthorizationTtlMs ??
      DEFAULT_RESTRICTED_AUTHORIZATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#challengeTtlMs);
    addMilliseconds(new Date(0), this.#restrictedAuthorizationTtlMs);
  }

  async request(input: {
    readonly secondaryEmail: string;
    readonly newPrimaryEmail: string;
    readonly ipAddress: string;
    readonly requestId?: string;
  }): Promise<{ readonly status: 'accepted' }> {
    const ipHmac = hmacIdentifier(
      `admin-secondary-recovery:${input.ipAddress.normalize('NFC')}`,
      this.#abuseProtection.ipHmacKey,
    );
    const ipDecision = await this.#throttle.checkIp(ipHmac);
    if (!ipDecision.allowed) {
      createOpaqueActionToken();
      return { status: 'accepted' };
    }
    const normalizedSecondaryEmail = normalizeEmail(input.secondaryEmail);
    const pendingNormalizedEmail = normalizeEmail(input.newPrimaryEmail);
    const identifierHmac = hmacIdentifier(
      `admin-secondary-recovery:${normalizedSecondaryEmail}`,
      this.#abuseProtection.emailHmacKey,
    );
    const identifierDecision = await this.#throttle.checkIdentifier(identifierHmac);
    if (!identifierDecision.allowed) {
      createOpaqueActionToken();
      return { status: 'accepted' };
    }
    await this.#throttle.recordFailure({
      ipHmac,
      identifierHmac,
      windowSeconds: this.#abuseProtection.windowSeconds,
      failureThreshold: this.#abuseProtection.failureThreshold,
      lockScheduleSeconds: this.#abuseProtection.lockScheduleSeconds,
    });
    const target = await this.#repository.findActiveAdminByVerifiedSecondary(
      normalizedSecondaryEmail,
    );

    // Keep the public response uniform for unknown, stale, non-Admin and
    // unavailable-address requests. Generate equivalent token entropy even
    // when no delivery can be scheduled.
    if (
      target === null ||
      target.account.profile !== 'admin' ||
      target.account.status !== 'ativo' ||
      target.verifiedSecondaryEmail !== normalizedSecondaryEmail ||
      pendingNormalizedEmail === target.account.normalizedEmail
    ) {
      createOpaqueActionToken();
      return { status: 'accepted' };
    }

    const now = this.#clock();
    const expiresAt = addMilliseconds(now, this.#challengeTtlMs);
    const recoveryId = this.#idGenerator();
    const challengeId = this.#idGenerator();
    const token = createOpaqueActionToken();
    const secondaryChallenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: target.account.organizationId,
      userId: target.account.id,
      purpose: 'admin_secondary_recovery_secondary',
      tokenSha256: token.sha256,
      pendingNormalizedEmail,
      recoveryId,
      expiresAt,
    };
    const secondaryActionEmail = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: target.account.organizationId,
      challengeId,
      to: target.verifiedSecondaryEmail,
      subject: 'Confirme a recuperação da conta Administradora',
      introduction:
        'Use o contato secundário previamente verificado para autorizar a recuperação.',
      actionLabel: 'Autorizar recuperação',
      action: 'confirm-admin-secondary-recovery',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const currentAddressNotice = this.#emailOutbox.notification({
      id: this.#idGenerator(),
      organizationId: target.account.organizationId,
      to: target.account.normalizedEmail,
      subject: 'Recuperação da conta Administradora solicitada',
      text:
        'Uma recuperação pelo contato secundário foi solicitada. Contate a empresa imediatamente se não reconhecer a ação.',
      availableAt: now,
      expiresAt: addMilliseconds(now, DEFAULT_NOTICE_TTL_MS),
    });
    const result = await this.#repository.startAtomically({
      expectedTarget: target,
      recovery: {
        id: recoveryId,
        organizationId: target.account.organizationId,
        userId: target.account.id,
        pendingNormalizedEmail,
        state: 'awaiting_secondary_confirmation',
        requestedAt: now,
        expiresAt,
      },
      secondaryChallenge,
      secondaryActionEmail,
      currentAddressNotice,
      audit: {
        id: this.#idGenerator(),
        organizationId: target.account.organizationId,
        eventType: 'auth.recuperacao_admin.secundario_solicitada',
        result: 'success',
        occurredAt: now,
        affectedUserId: target.account.id,
        resourceType: 'admin_secondary_recovery',
        resourceId: recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        metadata: { execution_channel: 'verified_secondary_self_service' },
      },
    });

    // These states are deliberately indistinguishable at the public edge.
    void result;
    return { status: 'accepted' };
  }

  async confirmSecondaryAddress(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{ readonly status: 'accepted' }> {
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectUsableSecondaryChallenge({
      tokenSha256,
      now,
    });
    if (
      inspected === null ||
      inspected.target.account.profile !== 'admin' ||
      inspected.target.account.status !== 'ativo'
    ) {
      throw new AccountActionError('recovery_invalid');
    }

    const expiresAt = addMilliseconds(now, this.#challengeTtlMs);
    const challengeId = this.#idGenerator();
    const newToken = createOpaqueActionToken();
    const newPrimaryChallenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: inspected.target.account.organizationId,
      userId: inspected.target.account.id,
      purpose: 'admin_secondary_recovery_new_primary',
      tokenSha256: newToken.sha256,
      pendingNormalizedEmail: inspected.pendingNormalizedEmail,
      recoveryId: inspected.recoveryId,
      expiresAt,
    };
    const newPrimaryActionEmail = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: inspected.target.account.organizationId,
      challengeId,
      to: inspected.pendingNormalizedEmail,
      subject: 'Confirme o novo e-mail principal da conta Administradora',
      introduction:
        'O contato secundário verificado autorizou a recuperação. Confirme agora o novo endereço principal.',
      actionLabel: 'Confirmar novo endereço',
      action: 'confirm-admin-recovery-new-primary',
      actionBaseUrl: this.#actionBaseUrl,
      token: newToken.token,
      availableAt: now,
      expiresAt,
    });
    const result = await this.#repository.confirmSecondaryAtomically({
      secondaryTokenSha256: tokenSha256,
      expected: inspected,
      newPrimaryChallenge,
      newPrimaryActionEmail,
      confirmedAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.target.account.organizationId,
        eventType: 'auth.recuperacao_admin.secundario_confirmado',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.target.account.id,
        resourceType: 'admin_secondary_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    this.#assertConfirmation(result);
    return { status: 'accepted' };
  }

  async confirmNewPrimaryAddress(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{ readonly token: string; readonly expiresAt: Date }> {
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectUsableNewPrimaryChallenge({
      tokenSha256,
      now,
    });
    if (
      inspected === null ||
      inspected.target.account.profile !== 'admin' ||
      inspected.target.account.status !== 'ativo'
    ) {
      throw new AccountActionError('recovery_invalid');
    }
    const restrictedToken = createOpaqueActionToken();
    const expiresAt = addMilliseconds(
      now,
      this.#restrictedAuthorizationTtlMs,
    );
    const restrictedAuthorization: RestrictedAuthorizationDraft = {
      id: this.#idGenerator(),
      organizationId: inspected.target.account.organizationId,
      userId: inspected.target.account.id,
      recoveryId: inspected.recoveryId,
      purpose: 'admin_secondary_recovery',
      tokenSha256: restrictedToken.sha256,
      allowedActions: ['set_new_password', 'cancel_recovery'],
      expiresAt,
    };
    const result = await this.#repository.confirmNewPrimaryAtomically({
      newPrimaryTokenSha256: tokenSha256,
      expected: inspected,
      restrictedAuthorization,
      confirmedAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.target.account.organizationId,
        eventType: 'auth.recuperacao_admin.novo_email_confirmado',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.target.account.id,
        resourceType: 'admin_secondary_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    this.#assertConfirmation(result);
    return { token: restrictedToken.token, expiresAt };
  }

  async complete(input: {
    readonly token: string;
    readonly newPassword: string;
    readonly requestId?: string;
  }): Promise<{ readonly userId: string; readonly loginRequired: true }> {
    const restrictedTokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectRestrictedAuthorization({
      tokenSha256: restrictedTokenSha256,
      requiredAction: 'set_new_password',
      now,
    });
    if (
      inspected === null ||
      inspected.user.profile !== 'admin' ||
      inspected.user.status !== 'ativo'
    ) {
      throw new AccountActionError('restricted_authorization_invalid');
    }
    const password = await this.#passwordCredentials.validateAndHash(
      input.newPassword,
    );
    const completedAt = this.#clock();
    const noticeRecipients = new Set([
      inspected.currentNormalizedEmail,
      inspected.verifiedSecondaryEmail,
    ]);
    const securityNotices = [...noticeRecipients].map((to) =>
      this.#emailOutbox.notification({
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        to,
        subject: 'Recuperação da conta Administradora concluída',
        text:
          'O e-mail principal e a senha foram alterados após dupla confirmação. Contate a empresa imediatamente se não reconhecer a ação.',
        availableAt: completedAt,
        expiresAt: addMilliseconds(completedAt, DEFAULT_NOTICE_TTL_MS),
      }),
    );
    const result = await this.#repository.completeAtomically({
      restrictedTokenSha256,
      expected: inspected,
      passwordPhc: password.passwordHash,
      passwordPolicyVersion: password.policyVersion,
      completedAt,
      securityNotices,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        eventType: 'auth.recuperacao_admin.secundario_concluida',
        result: 'success',
        occurredAt: completedAt,
        affectedUserId: inspected.user.id,
        resourceType: 'admin_secondary_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        metadata: { execution_channel: 'verified_secondary_self_service' },
      },
    });
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    if (result !== 'completed') {
      throw new AccountActionError('restricted_authorization_invalid');
    }
    return { userId: inspected.user.id, loginRequired: true };
  }

  async cancel(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<void> {
    const restrictedTokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectRestrictedAuthorization({
      tokenSha256: restrictedTokenSha256,
      requiredAction: 'cancel_recovery',
      now,
    });
    if (inspected === null) {
      throw new AccountActionError('restricted_authorization_invalid');
    }
    const result = await this.#repository.cancelAtomically({
      restrictedTokenSha256,
      expectedAuthorizationId: inspected.authorizationId,
      cancelledAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        eventType: 'auth.recuperacao_admin.secundario_cancelada',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.user.id,
        resourceType: 'admin_secondary_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    if (result !== 'cancelled') {
      throw new AccountActionError('restricted_authorization_invalid');
    }
  }

  #assertConfirmation(
    result: 'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change',
  ): void {
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    if (result !== 'confirmed') {
      throw new AccountActionError('recovery_invalid');
    }
  }
}
