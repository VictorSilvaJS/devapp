import { randomUUID } from 'node:crypto';

import { normalizeEmail } from '../auth/normalization.js';
import { createOpaqueActionToken, hashActionToken } from '../security/action-token.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_EMAIL_VERIFICATION_TTL_MS = 30 * 60_000;

export interface SecondaryEmailRepository {
  findActiveAccount(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null>;
  requestVerificationAtomically(input: {
    readonly expectedAccount: AccountSnapshot;
    readonly pendingNormalizedEmail: string;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly audit: AuditEventDraft;
  }): Promise<'created' | 'email_unavailable' | 'concurrent_change'>;
  confirmVerificationAtomically(input: {
    readonly tokenSha256: string;
    readonly confirmedAt: Date;
    readonly auditId: string;
    readonly requestId?: string;
  }): Promise<
    | { readonly status: 'confirmed'; readonly userId: string }
    | { readonly status: 'invalid' }
  >;
}

export class SecondaryEmailService {
  readonly #repository: SecondaryEmailRepository;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #ttlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: {
    readonly repository: SecondaryEmailRepository;
    readonly emailOutbox: EncryptedEmailOutboxFactory;
    readonly actionBaseUrl: string;
    readonly verificationTtlMs?: number;
    readonly clock?: Clock;
    readonly idGenerator?: IdGenerator;
  }) {
    this.#repository = options.repository;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#ttlMs = options.verificationTtlMs ?? DEFAULT_EMAIL_VERIFICATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#ttlMs);
  }

  async requestVerification(input: {
    readonly organizationId: string;
    readonly authenticatedUserId: string;
    readonly actorSessionId: string;
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
    if (account.profile !== 'admin') {
      throw new AccountActionError('account_action_forbidden');
    }
    const pendingNormalizedEmail = normalizeEmail(input.newEmail);
    if (pendingNormalizedEmail === account.normalizedEmail) {
      throw new AccountActionError('email_unavailable');
    }

    const now = this.#clock();
    const expiresAt = addMilliseconds(now, this.#ttlMs);
    const challengeId = this.#idGenerator();
    const token = createOpaqueActionToken();
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: account.organizationId,
      userId: account.id,
      purpose: 'secondary_email_verification',
      tokenSha256: token.sha256,
      pendingNormalizedEmail,
      expiresAt,
    };
    const outbox = this.#emailOutbox.action({
      id: this.#idGenerator(),
      organizationId: account.organizationId,
      challengeId,
      to: pendingNormalizedEmail,
      subject: 'Confirme seu e-mail secundário',
      introduction: 'Foi solicitado o cadastro deste endereço como e-mail secundário.',
      actionLabel: 'Confirmar endereço',
      action: 'verify-secondary-email',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const result = await this.#repository.requestVerificationAtomically({
      expectedAccount: account,
      pendingNormalizedEmail,
      challenge,
      outbox,
      audit: {
        id: this.#idGenerator(),
        organizationId: account.organizationId,
        eventType: 'auth.email_secundario.verificacao_solicitada',
        result: 'success',
        occurredAt: now,
        actorUserId: account.id,
        actorSessionId: input.actorSessionId,
        affectedUserId: account.id,
        resourceType: 'action_challenge',
        resourceId: challengeId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
    });
    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }

    return { challengeId, expiresAt };
  }

  async confirm(input: {
    readonly token: string;
    readonly requestId?: string;
  }): Promise<{ readonly userId: string; readonly loginRequired: true }> {
    const result = await this.#repository.confirmVerificationAtomically({
      tokenSha256: hashActionToken(input.token),
      confirmedAt: this.#clock(),
      auditId: this.#idGenerator(),
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });
    if (result.status !== 'confirmed') {
      throw new AccountActionError('email_verification_invalid');
    }

    return { userId: result.userId, loginRequired: true };
  }
}
