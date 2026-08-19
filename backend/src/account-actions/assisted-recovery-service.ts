import { randomUUID } from 'node:crypto';

import { normalizeEmail } from '../auth/normalization.js';
import type { PasswordCredentialService } from '../auth/password-credential.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import { createOpaqueActionToken, hashActionToken } from '../security/action-token.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
  requireOpaqueCaseReference,
  type RestrictedAuthorizationDraft,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_EMAIL_CHALLENGE_TTL_MS = 30 * 60_000;
const DEFAULT_RESTRICTED_AUTHORIZATION_TTL_MS = 15 * 60_000;
const DEFAULT_NOTICE_TTL_MS = 24 * 60 * 60_000;
const ASSISTED_RECOVERY_REASON_CODES = new Set<string>([
  'lost_email_access',
  'compromised_email',
  'email_provider_unavailable',
  'other_verified_case',
]);

export type AssistedRecoveryReasonCode =
  | 'lost_email_access'
  | 'compromised_email'
  | 'email_provider_unavailable'
  | 'other_verified_case';

export interface AssistedRecoveryDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly requestedByAdminUserId: string;
  readonly pendingNormalizedEmail: string;
  readonly reasonCode: AssistedRecoveryReasonCode;
  readonly externalCaseReference: string;
  readonly approvalMode: 'single_admin_risk_accepted';
  readonly state: 'awaiting_email_confirmation';
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

export interface RecoveryEmailChallengeInspection {
  readonly challengeId: string;
  readonly recoveryId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface RestrictedRecoveryInspection {
  readonly authorizationId: string;
  readonly recoveryId: string;
  readonly organizationId: string;
  readonly user: AccountSnapshot;
  readonly pendingNormalizedEmail: string;
  readonly currentNormalizedEmail: string;
}

export interface AssistedRecoveryRepository {
  findRecoveryTarget(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null>;
  /**
   * Must revalidate the active Admin actor and target snapshot, serialize by
   * target, enforce email uniqueness, cancel incompatible recoveries,
   * challenges and outbox messages, then persist every supplied draft in one
   * transaction.
   */
  startForNonAdminAtomically(input: {
    readonly actorAdminUserId: string;
    readonly expectedTarget: AccountSnapshot;
    readonly recovery: AssistedRecoveryDraft;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly auditEvents: readonly [AuditEventDraft, AuditEventDraft];
  }): Promise<
    | 'created'
    | 'actor_forbidden'
    | 'target_unavailable'
    | 'email_unavailable'
    | 'concurrent_change'
  >;
  inspectUsableEmailChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<RecoveryEmailChallengeInspection | null>;
  /** Consumes the email challenge and creates the restricted authorization atomically. */
  confirmEmailAtomically(input: {
    readonly tokenSha256: string;
    readonly expectedChallengeId: string;
    readonly restrictedAuthorization: RestrictedAuthorizationDraft;
    readonly confirmedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'concurrent_change'>;
  inspectRestrictedAuthorization(input: {
    readonly tokenSha256: string;
    readonly requiredAction: 'set_new_password' | 'cancel_recovery';
    readonly now: Date;
  }): Promise<RestrictedRecoveryInspection | null>;
  /**
   * Must lock/revalidate authorization, recovery, account and normalized email;
   * then atomically update primary email and credential, consume authorization,
   * revoke every session/token/incompatible challenge, increment the account
   * security version, enqueue the old-address notice and append the audit.
   * It must never activate an account or create a login session.
   */
  completeAtomically(input: {
    readonly restrictedTokenSha256: string;
    readonly expected: RestrictedRecoveryInspection;
    readonly passwordPhc: string;
    readonly passwordPolicyVersion: string;
    readonly completedAt: Date;
    readonly oldAddressNotice: ReturnType<EncryptedEmailOutboxFactory['notification']>;
    readonly audit: AuditEventDraft;
  }): Promise<'completed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
  cancelWithRestrictedAuthorizationAtomically(input: {
    readonly restrictedTokenSha256: string;
    readonly expectedAuthorizationId: string;
    readonly cancelledAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'cancelled' | 'invalid'>;
}

export class AssistedRecoveryService {
  readonly #repository: AssistedRecoveryRepository;
  readonly #passwordCredentials: PasswordCredentialService;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #emailChallengeTtlMs: number;
  readonly #restrictedAuthorizationTtlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly repository: AssistedRecoveryRepository;
    readonly passwordCredentials: PasswordCredentialService;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly actionBaseUrl: string;
    readonly emailChallengeTtlMs?: number;
    readonly restrictedAuthorizationTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    this.#repository = options.repository;
    this.#passwordCredentials = options.passwordCredentials;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#emailChallengeTtlMs =
      options.emailChallengeTtlMs ?? DEFAULT_EMAIL_CHALLENGE_TTL_MS;
    this.#restrictedAuthorizationTtlMs =
      options.restrictedAuthorizationTtlMs ??
      DEFAULT_RESTRICTED_AUTHORIZATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#emailChallengeTtlMs);
    addMilliseconds(new Date(0), this.#restrictedAuthorizationTtlMs);
  }

  async startByAdministrator(input: {
    readonly organizationId: string;
    readonly actorAdminUserId: string;
    readonly actorSessionId: string;
    readonly targetUserId: string;
    readonly newEmail: string;
    readonly reasonCode: AssistedRecoveryReasonCode;
    readonly externalCaseReference: string;
    readonly requestId?: string;
  }): Promise<{ readonly recoveryId: string; readonly expiresAt: Date }> {
    if (!ASSISTED_RECOVERY_REASON_CODES.has(input.reasonCode)) {
      throw new TypeError('Invalid assisted-recovery reason code.');
    }
    const target = await this.#repository.findRecoveryTarget({
      organizationId: input.organizationId,
      userId: input.targetUserId,
    });
    if (target === null) throw new AccountActionError('account_not_found');
    if (target.profile === 'admin') {
      throw new AccountActionError('admin_assisted_recovery_forbidden');
    }
    if (target.status !== 'ativo') {
      throw new AccountActionError('account_not_active');
    }

    const pendingNormalizedEmail = normalizeEmail(input.newEmail);
    if (pendingNormalizedEmail === target.normalizedEmail) {
      throw new AccountActionError('email_unavailable');
    }
    const externalCaseReference = requireOpaqueCaseReference(
      input.externalCaseReference,
    );
    const now = this.#clock();
    const expiresAt = addMilliseconds(now, this.#emailChallengeTtlMs);
    const recoveryId = this.#idGenerator();
    const challengeId = this.#idGenerator();
    const token = createOpaqueActionToken();
    const recovery: AssistedRecoveryDraft = {
      id: recoveryId,
      organizationId: target.organizationId,
      userId: target.id,
      requestedByAdminUserId: input.actorAdminUserId,
      pendingNormalizedEmail,
      reasonCode: input.reasonCode,
      externalCaseReference,
      approvalMode: 'single_admin_risk_accepted',
      state: 'awaiting_email_confirmation',
      requestedAt: now,
      expiresAt,
    };
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: target.organizationId,
      userId: target.id,
      purpose: 'assisted_recovery_email',
      tokenSha256: token.sha256,
      expiresAt,
      pendingNormalizedEmail,
      recoveryId,
    };
    const outbox = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: target.organizationId,
      challengeId,
      to: pendingNormalizedEmail,
      subject: 'Confirme a recuperação da sua conta Tchê Agro',
      introduction:
        'Uma recuperação assistida foi aprovada. Confirme este endereço para continuar.',
      actionLabel: 'Confirmar novo e-mail',
      action: 'confirm-assisted-recovery-email',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const commonAudit = {
      organizationId: target.organizationId,
      result: 'success' as const,
      occurredAt: now,
      actorUserId: input.actorAdminUserId,
      actorSessionId: input.actorSessionId,
      affectedUserId: target.id,
      resourceType: 'assisted_recovery',
      resourceId: recoveryId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      reasonCode: input.reasonCode,
      externalCaseReference,
      metadata: { approval_mode: 'single_admin_risk_accepted' },
    };
    const result = await this.#repository.startForNonAdminAtomically({
      actorAdminUserId: input.actorAdminUserId,
      expectedTarget: target,
      recovery,
      challenge,
      outbox,
      auditEvents: [
        {
          id: this.#idGenerator(),
          eventType: 'auth.recuperacao_assistida.solicitada',
          ...commonAudit,
        },
        {
          id: this.#idGenerator(),
          eventType: 'auth.recuperacao_assistida.aprovada',
          ...commonAudit,
        },
      ],
    });

    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'actor_forbidden') {
      throw new AccountActionError('admin_assisted_recovery_forbidden');
    }
    if (result === 'target_unavailable') {
      throw new AccountActionError('account_not_active');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }

    return { recoveryId, expiresAt };
  }

  async confirmNewEmail(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{
    readonly token: string;
    readonly expiresAt: Date;
  }> {
    const tokenSha256 = hashActionToken(input.token);
    const inspectedAt = this.#clock();
    const challenge = await this.#repository.inspectUsableEmailChallenge({
      tokenSha256,
      now: inspectedAt,
    });
    if (challenge === null) throw new AccountActionError('recovery_invalid');

    const restrictedToken = createOpaqueActionToken();
    const confirmedAt = this.#clock();
    const expiresAt = addMilliseconds(
      confirmedAt,
      this.#restrictedAuthorizationTtlMs,
    );
    const authorization: RestrictedAuthorizationDraft = {
      id: this.#idGenerator(),
      organizationId: challenge.organizationId,
      userId: challenge.userId,
      recoveryId: challenge.recoveryId,
      purpose: 'assisted_recovery',
      tokenSha256: restrictedToken.sha256,
      allowedActions: ['set_new_password', 'cancel_recovery'],
      expiresAt,
    };
    const result = await this.#repository.confirmEmailAtomically({
      tokenSha256,
      expectedChallengeId: challenge.challengeId,
      restrictedAuthorization: authorization,
      confirmedAt,
      audit: {
        id: this.#idGenerator(),
        organizationId: challenge.organizationId,
        eventType: 'auth.recuperacao_assistida.email_confirmado',
        result: 'success',
        occurredAt: confirmedAt,
        affectedUserId: challenge.userId,
        resourceType: 'assisted_recovery',
        resourceId: challenge.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    if (result !== 'confirmed') {
      throw new AccountActionError(
        result === 'concurrent_change'
          ? 'concurrent_account_change'
          : 'recovery_invalid',
      );
    }

    return {
      token: restrictedToken.token,
      expiresAt,
    };
  }

  async complete(input: {
    readonly token: string;
    readonly newPassword: string;
    readonly requestId?: string;
  }): Promise<{ readonly userId: string; readonly loginRequired: true }> {
    const restrictedTokenSha256 = hashActionToken(
      input.token,
    );
    const inspectedAt = this.#clock();
    const inspected = await this.#repository.inspectRestrictedAuthorization({
      tokenSha256: restrictedTokenSha256,
      requiredAction: 'set_new_password',
      now: inspectedAt,
    });
    if (inspected === null || inspected.user.status !== 'ativo') {
      throw new AccountActionError('restricted_authorization_invalid');
    }
    if (inspected.user.profile === 'admin') {
      throw new AccountActionError('admin_assisted_recovery_forbidden');
    }

    const password = await this.#passwordCredentials.validateAndHash(
      input.newPassword,
    );
    const completedAt = this.#clock();
    const oldAddressNotice = this.#emailOutbox.notification({
      id: this.#idGenerator(),
      organizationId: inspected.organizationId,
      to: inspected.currentNormalizedEmail,
      subject: 'Sua conta Tchê Agro foi recuperada',
      text:
        'Uma recuperação assistida alterou o e-mail e a senha da sua conta. Se você não reconhece esta ação, contate a empresa imediatamente.',
      availableAt: completedAt,
      expiresAt: addMilliseconds(completedAt, DEFAULT_NOTICE_TTL_MS),
    });
    const result = await this.#repository.completeAtomically({
      restrictedTokenSha256,
      expected: inspected,
      passwordPhc: password.passwordHash,
      passwordPolicyVersion: password.policyVersion,
      completedAt,
      oldAddressNotice,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        eventType: 'auth.recuperacao_assistida.concluida',
        result: 'success',
        occurredAt: completedAt,
        affectedUserId: inspected.user.id,
        resourceType: 'assisted_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
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
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectRestrictedAuthorization({
      tokenSha256,
      requiredAction: 'cancel_recovery',
      now,
    });
    if (inspected === null) {
      throw new AccountActionError('restricted_authorization_invalid');
    }
    const result = await this.#repository.cancelWithRestrictedAuthorizationAtomically({
      restrictedTokenSha256: tokenSha256,
      expectedAuthorizationId: inspected.authorizationId,
      cancelledAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        eventType: 'auth.recuperacao_assistida.cancelada',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.user.id,
        resourceType: 'assisted_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    if (result !== 'cancelled') {
      throw new AccountActionError('restricted_authorization_invalid');
    }
  }
}
