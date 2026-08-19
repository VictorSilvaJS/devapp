import { randomUUID } from 'node:crypto';

import { normalizeEmail } from '../auth/normalization.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import { createOpaqueActionToken } from '../security/action-token.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_BOOTSTRAP_INVITATION_TTL_MS = 72 * 60 * 60_000;

export type InitialAdminBootstrapState =
  | { readonly state: 'uninitialized' }
  | { readonly state: 'pending'; readonly account: AccountSnapshot }
  | { readonly state: 'sealed'; readonly adminUserId: string };

export interface BootstrapAdminDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly normalizedEmail: string;
  readonly profile: 'admin';
  readonly status: 'pendente';
}

export interface InitialAdminBootstrapRepository {
  inspect(organizationId: string): Promise<InitialAdminBootstrapState>;
  /**
   * Must take an organization-scoped lock, require zero Admin credentials and
   * no prior sealed bootstrap, then persist user, challenge, outbox and audit
   * in one transaction.
   */
  initializeAtomically(input: {
    readonly admin: BootstrapAdminDraft;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly audit: AuditEventDraft;
  }): Promise<'initialized' | 'already_initialized'>;
  /**
   * Available only while the one bootstrap invitation remains unaccepted.
   * Must update the pending account, revoke/cancel its previous invitation and
   * outbox rows, then persist the replacement challenge/outbox/audit atomically.
   */
  correctPendingEmailAtomically(input: {
    readonly expectedPendingAdmin: AccountSnapshot;
    readonly newNormalizedEmail: string;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly audit: AuditEventDraft;
  }): Promise<'corrected' | 'not_correctable' | 'email_unavailable' | 'concurrent_change'>;
}

interface BootstrapServiceDependencies {
  readonly repository: InitialAdminBootstrapRepository;
  readonly emailOutbox: EncryptedEmailOutboxFactory;
  readonly actionBaseUrl: string;
  readonly invitationTtlMs?: number;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

abstract class BootstrapServiceBase {
  protected readonly repository: InitialAdminBootstrapRepository;
  protected readonly emailOutbox: EncryptedEmailOutboxFactory;
  protected readonly actionBaseUrl: string;
  protected readonly invitationTtlMs: number;
  protected readonly clock: Clock;
  protected readonly idGenerator: IdGenerator;

  constructor(options: BootstrapServiceDependencies) {
    this.repository = options.repository;
    this.emailOutbox = options.emailOutbox;
    this.actionBaseUrl = options.actionBaseUrl;
    this.invitationTtlMs =
      options.invitationTtlMs ?? DEFAULT_BOOTSTRAP_INVITATION_TTL_MS;
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.invitationTtlMs);
  }

  protected invitation(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly name: string;
    readonly normalizedEmail: string;
    readonly now: Date;
  }): {
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
  } {
    const expiresAt = addMilliseconds(input.now, this.invitationTtlMs);
    const challengeId = this.idGenerator();
    const token = createOpaqueActionToken();
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: input.organizationId,
      userId: input.userId,
      purpose: 'invitation',
      tokenSha256: token.sha256,
      expiresAt,
      activationMode: 'activate_bootstrap_admin',
    };
    return {
      challenge,
      outbox: this.emailOutbox.action({
        id: this.idGenerator(),
        organizationId: input.organizationId,
        challengeId,
        to: input.normalizedEmail,
        subject: 'Ative a primeira conta Administradora do Tchê Agro',
        introduction: `Olá, ${input.name}. Confirme o convite inicial e defina sua própria senha.`,
        actionLabel: 'Ativar conta Administradora',
        action: 'accept-initial-admin-invitation',
        actionBaseUrl: this.actionBaseUrl,
        token: token.token,
        availableAt: input.now,
        expiresAt,
      }),
    };
  }
}

/** CLI-only one-shot bootstrap. Its input and result deliberately contain no password/token. */
export class InitialAdminBootstrapCliService extends BootstrapServiceBase {
  readonly #enabled: boolean;

  constructor(options: BootstrapServiceDependencies & { readonly enabled: boolean }) {
    super(options);
    this.#enabled = options.enabled;
  }

  async run(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly email: string;
    readonly requestId?: string;
  }): Promise<{
    readonly adminUserId: string;
    readonly challengeId: string;
    readonly expiresAt: Date;
  }> {
    if (!this.#enabled) throw new AccountActionError('bootstrap_disabled');
    const state = await this.repository.inspect(input.organizationId);
    if (state.state !== 'uninitialized') {
      throw new AccountActionError('bootstrap_already_initialized');
    }

    const normalizedEmail = normalizeEmail(input.email);
    const adminUserId = this.idGenerator();
    const now = this.clock();
    const { challenge, outbox } = this.invitation({
      organizationId: input.organizationId,
      userId: adminUserId,
      name: input.name,
      normalizedEmail,
      now,
    });
    const result = await this.repository.initializeAtomically({
      admin: {
        id: adminUserId,
        organizationId: input.organizationId,
        name: input.name.normalize('NFC').trim(),
        normalizedEmail,
        profile: 'admin',
        status: 'pendente',
      },
      challenge,
      outbox,
      audit: {
        id: this.idGenerator(),
        organizationId: input.organizationId,
        eventType: 'auth.bootstrap_admin.convite_criado',
        result: 'success',
        occurredAt: now,
        affectedUserId: adminUserId,
        resourceType: 'action_challenge',
        resourceId: challenge.id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        metadata: { execution_channel: 'cli' },
      },
    });
    if (result !== 'initialized') {
      throw new AccountActionError('bootstrap_already_initialized');
    }

    return {
      adminUserId,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    };
  }
}

/** Separate corrective command; it cannot create an Admin or reopen a sealed bootstrap. */
export class InitialAdminInvitationCorrectionCliService extends BootstrapServiceBase {
  readonly #enabled: boolean;

  constructor(options: BootstrapServiceDependencies & { readonly enabled: boolean }) {
    super(options);
    this.#enabled = options.enabled;
  }

  async run(input: {
    readonly organizationId: string;
    readonly correctedEmail: string;
    readonly reasonCode: 'bootstrap_email_typo';
    readonly requestId?: string;
  }): Promise<{ readonly challengeId: string; readonly expiresAt: Date }> {
    if (!this.#enabled) throw new AccountActionError('bootstrap_disabled');
    const state = await this.repository.inspect(input.organizationId);
    if (state.state !== 'pending') {
      throw new AccountActionError('bootstrap_not_correctable');
    }
    const correctedEmail = normalizeEmail(input.correctedEmail);
    if (correctedEmail === state.account.normalizedEmail) {
      throw new AccountActionError('email_unavailable');
    }

    const now = this.clock();
    const { challenge, outbox } = this.invitation({
      organizationId: state.account.organizationId,
      userId: state.account.id,
      name: state.account.name,
      normalizedEmail: correctedEmail,
      now,
    });
    const result = await this.repository.correctPendingEmailAtomically({
      expectedPendingAdmin: state.account,
      newNormalizedEmail: correctedEmail,
      challenge,
      outbox,
      audit: {
        id: this.idGenerator(),
        organizationId: state.account.organizationId,
        eventType: 'auth.bootstrap_admin.email_corrigido',
        result: 'success',
        occurredAt: now,
        affectedUserId: state.account.id,
        resourceType: 'action_challenge',
        resourceId: challenge.id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        reasonCode: input.reasonCode,
        metadata: { execution_channel: 'cli' },
      },
    });

    if (result === 'email_unavailable') {
      throw new AccountActionError('email_unavailable');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }
    if (result !== 'corrected') {
      throw new AccountActionError('bootstrap_not_correctable');
    }

    return { challengeId: challenge.id, expiresAt: challenge.expiresAt };
  }
}
