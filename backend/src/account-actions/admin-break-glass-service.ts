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

export interface AdminBreakGlassTarget {
  readonly account: AccountSnapshot;
  readonly verifiedSecondaryEmail?: string;
}

export interface VerifiedBreakGlassAuthorization {
  readonly authorizationId: string;
  readonly policyVersion: string;
  readonly organizationId: string;
  readonly targetUserId: string;
  readonly pendingNormalizedEmail: string;
  readonly externalCaseReference: string;
  readonly approverIds: readonly string[];
  readonly expiresAt: Date;
}

/** Implemented by a platform-owned verifier, separate from application Admin sessions. */
export interface BreakGlassAuthorizationVerifier {
  verify(input: {
    /** Opaque credential/ceremony artifact; never persist or log this value. */
    readonly authorizationArtifact: string;
    readonly organizationId: string;
    readonly targetUserId: string;
    readonly pendingNormalizedEmail: string;
    readonly externalCaseReference: string;
    readonly now: Date;
  }): Promise<VerifiedBreakGlassAuthorization | null>;
}

export interface AdminBreakGlassRecoveryDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly pendingNormalizedEmail: string;
  readonly externalCaseReference: string;
  readonly platformAuthorizationId: string;
  readonly platformPolicyVersion: string;
  readonly platformApproverIds: readonly string[];
  readonly state: 'awaiting_email_confirmation';
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

interface BreakGlassChallengeInspection {
  readonly challengeId: string;
  readonly recoveryId: string;
  readonly organizationId: string;
  readonly userId: string;
}

interface BreakGlassRestrictedInspection {
  readonly authorizationId: string;
  readonly recoveryId: string;
  readonly organizationId: string;
  readonly user: AccountSnapshot;
  readonly currentNormalizedEmail: string;
  readonly pendingNormalizedEmail: string;
  readonly verifiedSecondaryEmail?: string;
}

export interface AdminBreakGlassRepository {
  findActiveAdminTarget(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AdminBreakGlassTarget | null>;
  /**
   * Must require a sealed bootstrap, lock and revalidate the active Admin,
   * enforce email uniqueness, and persist recovery/challenge/all outbox/audit
   * records atomically. It must not alter bootstrap state.
   */
  startAtomically(input: {
    readonly expectedTarget: AdminBreakGlassTarget;
    readonly verifiedAuthorization: VerifiedBreakGlassAuthorization;
    readonly recovery: AdminBreakGlassRecoveryDraft;
    readonly challenge: ActionChallengeDraft;
    readonly actionEmail: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly securityNotices: readonly ReturnType<
      EncryptedEmailOutboxFactory['notification']
    >[];
    readonly audit: AuditEventDraft;
  }): Promise<
    | 'created'
    | 'bootstrap_not_sealed'
    | 'target_unavailable'
    | 'email_unavailable'
    | 'concurrent_change'
  >;
  inspectUsableEmailChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<BreakGlassChallengeInspection | null>;
  confirmEmailAtomically(input: {
    readonly tokenSha256: string;
    readonly expectedChallengeId: string;
    readonly restrictedAuthorization: RestrictedAuthorizationDraft;
    readonly confirmedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'concurrent_change'>;
  inspectRestrictedAuthorization(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<BreakGlassRestrictedInspection | null>;
  /** Same atomic security effects as assisted recovery, but only for a
   * break-glass recovery backed by the verified platform authorization. */
  completeAtomically(input: {
    readonly restrictedTokenSha256: string;
    readonly expected: BreakGlassRestrictedInspection;
    readonly passwordPhc: string;
    readonly passwordPolicyVersion: string;
    readonly completedAt: Date;
    readonly securityNotices: readonly ReturnType<
      EncryptedEmailOutboxFactory['notification']
    >[];
    readonly audit: AuditEventDraft;
  }): Promise<'completed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
}

function safeApproverIds(value: readonly string[]): readonly string[] | null {
  const unique = new Set(value);
  if (
    unique.size < 2 ||
    [...unique].some((item) => !/^[A-Za-z0-9_.:@-]{1,128}$/.test(item))
  ) {
    return null;
  }
  return [...unique].sort();
}

export class AdminBreakGlassContinuationService {
  readonly #repository: AdminBreakGlassRepository;
  readonly #passwordCredentials: PasswordCredentialService;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #restrictedAuthorizationTtlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly repository: AdminBreakGlassRepository;
    readonly passwordCredentials: PasswordCredentialService;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly restrictedAuthorizationTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    this.#repository = options.repository;
    this.#passwordCredentials = options.passwordCredentials;
    this.#emailOutbox = options.emailOutbox;
    this.#restrictedAuthorizationTtlMs =
      options.restrictedAuthorizationTtlMs ??
      DEFAULT_RESTRICTED_AUTHORIZATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#restrictedAuthorizationTtlMs);
  }

  async confirmNewEmail(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{
    readonly token: string;
    readonly expiresAt: Date;
  }> {
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const challenge = await this.#repository.inspectUsableEmailChallenge({
      tokenSha256,
      now,
    });
    if (challenge === null) throw new AccountActionError('recovery_invalid');
    const token = createOpaqueActionToken();
    const expiresAt = addMilliseconds(now, this.#restrictedAuthorizationTtlMs);
    const restrictedAuthorization: RestrictedAuthorizationDraft = {
      id: this.#idGenerator(),
      organizationId: challenge.organizationId,
      userId: challenge.userId,
      recoveryId: challenge.recoveryId,
      purpose: 'admin_break_glass',
      tokenSha256: token.sha256,
      allowedActions: ['set_new_password', 'cancel_recovery'],
      expiresAt,
    };
    const result = await this.#repository.confirmEmailAtomically({
      tokenSha256,
      expectedChallengeId: challenge.challengeId,
      restrictedAuthorization,
      confirmedAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: challenge.organizationId,
        eventType: 'auth.recuperacao_admin.email_confirmado',
        result: 'success',
        occurredAt: now,
        affectedUserId: challenge.userId,
        resourceType: 'admin_break_glass_recovery',
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
    return { token: token.token, expiresAt };
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
      ...(inspected.verifiedSecondaryEmail === undefined
        ? []
        : [inspected.verifiedSecondaryEmail]),
    ]);
    const securityNotices = [...noticeRecipients].map((to) =>
      this.#emailOutbox.notification({
        id: this.#idGenerator(),
        organizationId: inspected.organizationId,
        to,
        subject: 'Recuperação break-glass concluída',
        text:
          'O e-mail e a senha da conta Administradora foram alterados pelo procedimento formal. Contate a empresa imediatamente se não reconhecer a ação.',
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
        eventType: 'auth.recuperacao_admin.break_glass_concluida',
        result: 'success',
        occurredAt: completedAt,
        affectedUserId: inspected.user.id,
        resourceType: 'admin_break_glass_recovery',
        resourceId: inspected.recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        metadata: { execution_channel: 'email_break_glass' },
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
}

/**
 * Starts break-glass only from the platform CLI. The inherited continuation
 * methods require the one-time e-mail tokens and never accept an Admin session.
 */
export class AdminBreakGlassCliService extends AdminBreakGlassContinuationService {
  readonly #enabled: boolean;
  readonly #verifier: BreakGlassAuthorizationVerifier;
  readonly #repository: AdminBreakGlassRepository;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #emailChallengeTtlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly enabled: boolean;
    readonly verifier: BreakGlassAuthorizationVerifier;
    readonly repository: AdminBreakGlassRepository;
    readonly passwordCredentials: PasswordCredentialService;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly actionBaseUrl: string;
    readonly emailChallengeTtlMs?: number;
    readonly restrictedAuthorizationTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    super({
      repository: options.repository,
      passwordCredentials: options.passwordCredentials,
      emailOutbox: options.emailOutbox,
      ...(options.restrictedAuthorizationTtlMs === undefined
        ? {}
        : {
            restrictedAuthorizationTtlMs:
              options.restrictedAuthorizationTtlMs,
          }),
      ...(options.clock === undefined ? {} : { clock: options.clock }),
      ...(options.idGenerator === undefined
        ? {}
        : { idGenerator: options.idGenerator }),
    });
    this.#enabled = options.enabled;
    this.#verifier = options.verifier;
    this.#repository = options.repository;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#emailChallengeTtlMs =
      options.emailChallengeTtlMs ?? DEFAULT_EMAIL_CHALLENGE_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#emailChallengeTtlMs);
  }

  async start(input: {
    readonly authorizationArtifact: string;
    readonly organizationId: string;
    readonly targetAdminUserId: string;
    readonly newEmail: string;
    readonly externalCaseReference: string;
    readonly requestId?: string;
  }): Promise<{ readonly recoveryId: string; readonly expiresAt: Date }> {
    if (!this.#enabled) {
      throw new AccountActionError('break_glass_authorization_invalid');
    }
    const target = await this.#repository.findActiveAdminTarget({
      organizationId: input.organizationId,
      userId: input.targetAdminUserId,
    });
    if (
      target === null ||
      target.account.profile !== 'admin' ||
      target.account.status !== 'ativo'
    ) {
      throw new AccountActionError('account_not_active');
    }
    const pendingNormalizedEmail = normalizeEmail(input.newEmail);
    if (pendingNormalizedEmail === target.account.normalizedEmail) {
      throw new AccountActionError('email_unavailable');
    }
    const externalCaseReference = requireOpaqueCaseReference(
      input.externalCaseReference,
    );
    const now = this.#clock();
    const authorization = await this.#verifier.verify({
      authorizationArtifact: input.authorizationArtifact,
      organizationId: input.organizationId,
      targetUserId: target.account.id,
      pendingNormalizedEmail,
      externalCaseReference,
      now,
    });
    const approverIds =
      authorization === null ? null : safeApproverIds(authorization.approverIds);
    if (
      authorization === null ||
      approverIds === null ||
      authorization.expiresAt.getTime() <= now.getTime() ||
      authorization.organizationId !== target.account.organizationId ||
      authorization.targetUserId !== target.account.id ||
      authorization.pendingNormalizedEmail !== pendingNormalizedEmail ||
      authorization.externalCaseReference !== externalCaseReference
    ) {
      throw new AccountActionError('break_glass_authorization_invalid');
    }

    const recoveryId = this.#idGenerator();
    const challengeId = this.#idGenerator();
    const expiresAt = addMilliseconds(now, this.#emailChallengeTtlMs);
    const token = createOpaqueActionToken();
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: target.account.organizationId,
      userId: target.account.id,
      purpose: 'admin_break_glass_email',
      tokenSha256: token.sha256,
      expiresAt,
      pendingNormalizedEmail,
      recoveryId,
    };
    const actionEmail = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: target.account.organizationId,
      challengeId,
      to: pendingNormalizedEmail,
      subject: 'Confirme a recuperação administrativa do Tchê Agro',
      introduction:
        'O procedimento formal de recuperação da conta Administradora foi autorizado.',
      actionLabel: 'Confirmar novo e-mail',
      action: 'confirm-admin-break-glass-email',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const noticeRecipients = new Set([
      target.account.normalizedEmail,
      ...(target.verifiedSecondaryEmail === undefined
        ? []
        : [target.verifiedSecondaryEmail]),
    ]);
    const securityNotices = [...noticeRecipients].map((to) =>
      this.#emailOutbox.notification({
        id: this.#idGenerator(),
        organizationId: target.account.organizationId,
        to,
        subject: 'Procedimento break-glass iniciado',
        text:
          'Um procedimento formal de recuperação foi iniciado para sua conta Administradora. Contate a empresa imediatamente se não reconhecer a ação.',
        availableAt: now,
        expiresAt: addMilliseconds(now, DEFAULT_NOTICE_TTL_MS),
      }),
    );
    const result = await this.#repository.startAtomically({
      expectedTarget: target,
      verifiedAuthorization: { ...authorization, approverIds },
      recovery: {
        id: recoveryId,
        organizationId: target.account.organizationId,
        userId: target.account.id,
        pendingNormalizedEmail,
        externalCaseReference,
        platformAuthorizationId: authorization.authorizationId,
        platformPolicyVersion: authorization.policyVersion,
        platformApproverIds: approverIds,
        state: 'awaiting_email_confirmation',
        requestedAt: now,
        expiresAt,
      },
      challenge,
      actionEmail,
      securityNotices,
      audit: {
        id: this.#idGenerator(),
        organizationId: target.account.organizationId,
        eventType: 'auth.recuperacao_admin.break_glass_iniciada',
        result: 'success',
        occurredAt: now,
        affectedUserId: target.account.id,
        resourceType: 'admin_break_glass_recovery',
        resourceId: recoveryId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        reasonCode: 'admin_account_recovery',
        externalCaseReference,
        metadata: {
          execution_channel: 'cli_break_glass',
          policy_version: authorization.policyVersion,
          approval_count: approverIds.length,
        },
      },
    });
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    if (result !== 'created') {
      throw new AccountActionError('break_glass_authorization_invalid');
    }

    return { recoveryId, expiresAt };
  }
}
