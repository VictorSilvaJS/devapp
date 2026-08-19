import { randomUUID } from 'node:crypto';

import { normalizeEmail } from '../auth/normalization.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import { createOpaqueActionToken, hashActionToken } from '../security/action-token.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_EMAIL_CHANGE_TTL_MS = 30 * 60_000;
const DEFAULT_NOTICE_TTL_MS = 24 * 60 * 60_000;

export interface CurrentPasswordVerification {
  readonly valid: boolean;
  /** Compare-and-set value for the credential verified outside the transaction. */
  readonly credentialVersion?: string;
}

/** Verifies the current password without exposing its PHC to the route layer. */
export interface PrimaryEmailPasswordVerifier {
  verifyCurrentPassword(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly password: string;
  }): Promise<CurrentPasswordVerification>;
}

export interface PrimaryEmailChangeInspection {
  readonly challengeId: string;
  readonly account: AccountSnapshot;
  readonly pendingNormalizedEmail: string;
}

export interface PrimaryEmailChangeRepository {
  findActiveAccount(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null>;
  /** Revalidates the active session, account and credential version; checks
   * email uniqueness; then replaces prior challenges and enqueues/audits the
   * current-address confirmation atomically. */
  requestChangeAtomically(input: {
    readonly expectedAccount: AccountSnapshot;
    readonly authenticatedSessionId: string;
    readonly expectedCredentialVersion: string;
    readonly pendingNormalizedEmail: string;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly audit: AuditEventDraft;
  }): Promise<
    | 'created'
    | 'current_password_invalid'
    | 'email_unavailable'
    | 'concurrent_change'
  >;
  inspectUsableCurrentAddressChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<PrimaryEmailChangeInspection | null>;
  /** Consumes the current-address challenge and creates/enqueues the separate
   * new-address challenge atomically, without changing the login email. */
  confirmCurrentAddressAtomically(input: {
    readonly currentTokenSha256: string;
    readonly expected: PrimaryEmailChangeInspection;
    readonly newAddressChallenge: ActionChallengeDraft;
    readonly newAddressOutbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly confirmedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
  inspectUsableNewAddressChallenge(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<PrimaryEmailChangeInspection | null>;
  /** Atomically consumes the new-address challenge, applies the pending email,
   * revokes all sessions/action grants, increments security version, enqueues
   * the old-address notice and audits. It must not create a new session. */
  confirmNewAddressAtomically(input: {
    readonly tokenSha256: string;
    readonly expected: PrimaryEmailChangeInspection;
    readonly confirmedAt: Date;
    readonly oldAddressNotice: ReturnType<EncryptedEmailOutboxFactory['notification']>;
    readonly audit: AuditEventDraft;
  }): Promise<'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change'>;
}

export class PrimaryEmailChangeService {
  readonly #repository: PrimaryEmailChangeRepository;
  readonly #passwordVerifier: PrimaryEmailPasswordVerifier;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #changeTtlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly repository: PrimaryEmailChangeRepository;
    readonly passwordVerifier: PrimaryEmailPasswordVerifier;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly actionBaseUrl: string;
    readonly changeTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    this.#repository = options.repository;
    this.#passwordVerifier = options.passwordVerifier;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#changeTtlMs = options.changeTtlMs ?? DEFAULT_EMAIL_CHANGE_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#changeTtlMs);
  }

  async request(input: {
    readonly organizationId: string;
    readonly authenticatedUserId: string;
    readonly authenticatedSessionId: string;
    readonly currentPassword: string;
    readonly newEmail: string;
    readonly requestId?: string;
  }): Promise<{ readonly challengeId: string; readonly expiresAt: Date }> {
    const account = await this.#repository.findActiveAccount({
      organizationId: input.organizationId,
      userId: input.authenticatedUserId,
    });
    if (account === null || account.status !== 'ativo') {
      throw new AccountActionError('account_not_active');
    }
    const pendingNormalizedEmail = normalizeEmail(input.newEmail);
    if (pendingNormalizedEmail === account.normalizedEmail) {
      throw new AccountActionError('email_unavailable');
    }
    const password = await this.#passwordVerifier.verifyCurrentPassword({
      organizationId: account.organizationId,
      userId: account.id,
      password: input.currentPassword,
    });
    if (!password.valid || password.credentialVersion === undefined) {
      throw new AccountActionError('recent_authentication_required');
    }

    const now = this.#clock();
    const expiresAt = addMilliseconds(now, this.#changeTtlMs);
    const challengeId = this.#idGenerator();
    const token = createOpaqueActionToken();
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: account.organizationId,
      userId: account.id,
      purpose: 'primary_email_change_current',
      tokenSha256: token.sha256,
      pendingNormalizedEmail,
      expiresAt,
    };
    const outbox = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: account.organizationId,
      challengeId,
      to: account.normalizedEmail,
      subject: 'Autorize a alteração do seu e-mail no Tchê Agro',
      introduction:
        'Foi solicitada a alteração do e-mail principal. Confirme primeiro no endereço atual.',
      actionLabel: 'Autorizar alteração',
      action: 'confirm-current-primary-email',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const result = await this.#repository.requestChangeAtomically({
      expectedAccount: account,
      authenticatedSessionId: input.authenticatedSessionId,
      expectedCredentialVersion: password.credentialVersion,
      pendingNormalizedEmail,
      challenge,
      outbox,
      audit: {
        id: this.#idGenerator(),
        organizationId: account.organizationId,
        eventType: 'auth.email_principal.alteracao_solicitada',
        result: 'success',
        occurredAt: now,
        actorUserId: account.id,
        actorSessionId: input.authenticatedSessionId,
        affectedUserId: account.id,
        resourceType: 'action_challenge',
        resourceId: challengeId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    if (result === 'current_password_invalid') {
      throw new AccountActionError('recent_authentication_required');
    }
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    return { challengeId, expiresAt };
  }

  async confirmCurrentAddress(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{ readonly status: 'accepted' }> {
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectUsableCurrentAddressChallenge({
      tokenSha256,
      now,
    });
    if (inspected === null || inspected.account.status !== 'ativo') {
      throw new AccountActionError('email_change_invalid');
    }
    const expiresAt = addMilliseconds(now, this.#changeTtlMs);
    const newChallengeId = this.#idGenerator();
    const newToken = createOpaqueActionToken();
    const newAddressChallenge: ActionChallengeDraft = {
      id: newChallengeId,
      organizationId: inspected.account.organizationId,
      userId: inspected.account.id,
      purpose: 'primary_email_change_new',
      tokenSha256: newToken.sha256,
      pendingNormalizedEmail: inspected.pendingNormalizedEmail,
      expiresAt,
    };
    const newAddressOutbox = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: inspected.account.organizationId,
      challengeId: newChallengeId,
      to: inspected.pendingNormalizedEmail,
      subject: 'Confirme seu novo e-mail no Tchê Agro',
      introduction: 'O endereço atual autorizou a alteração do e-mail principal.',
      actionLabel: 'Confirmar novo e-mail',
      action: 'confirm-new-primary-email',
      actionBaseUrl: this.#actionBaseUrl,
      token: newToken.token,
      availableAt: now,
      expiresAt,
    });
    const result = await this.#repository.confirmCurrentAddressAtomically({
      currentTokenSha256: tokenSha256,
      expected: inspected,
      newAddressChallenge,
      newAddressOutbox,
      confirmedAt: now,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.account.organizationId,
        eventType: 'auth.email_principal.endereco_atual_confirmado',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.account.id,
        resourceType: 'action_challenge',
        resourceId: inspected.challengeId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    this.#assertConfirmationResult(result);
    return { status: 'accepted' };
  }

  async confirmNewAddress(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{ readonly userId: string; readonly loginRequired: true }> {
    const tokenSha256 = hashActionToken(input.token);
    const now = this.#clock();
    const inspected = await this.#repository.inspectUsableNewAddressChallenge({
      tokenSha256,
      now,
    });
    if (inspected === null || inspected.account.status !== 'ativo') {
      throw new AccountActionError('email_change_invalid');
    }
    const oldAddressNotice = this.#emailOutbox.notification({
      id: this.#idGenerator(),
      organizationId: inspected.account.organizationId,
      to: inspected.account.normalizedEmail,
      subject: 'Seu e-mail principal do Tchê Agro foi alterado',
      text:
        'O endereço principal da sua conta foi alterado. Se você não reconhece esta ação, contate a empresa imediatamente.',
      availableAt: now,
      expiresAt: addMilliseconds(now, DEFAULT_NOTICE_TTL_MS),
    });
    const result = await this.#repository.confirmNewAddressAtomically({
      tokenSha256,
      expected: inspected,
      confirmedAt: now,
      oldAddressNotice,
      audit: {
        id: this.#idGenerator(),
        organizationId: inspected.account.organizationId,
        eventType: 'auth.email_principal.alterado',
        result: 'success',
        occurredAt: now,
        affectedUserId: inspected.account.id,
        resourceType: 'action_challenge',
        resourceId: inspected.challengeId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    this.#assertConfirmationResult(result);
    return { userId: inspected.account.id, loginRequired: true };
  }

  #assertConfirmationResult(
    result: 'confirmed' | 'invalid' | 'email_unavailable' | 'concurrent_change',
  ): void {
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    if (result !== 'confirmed') {
      throw new AccountActionError('email_change_invalid');
    }
  }
}
