import { randomUUID } from 'node:crypto';

import type { PasswordCredentialService } from '../auth/password-credential.js';
import { createOpaqueActionToken, hashActionToken } from '../security/action-token.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import {
  addMilliseconds,
  type AccountSnapshot,
  type ActionChallengeDraft,
  type AuditEventDraft,
  type Clock,
  type IdGenerator,
  type InvitationAcceptanceMode,
} from './contracts.js';
import { AccountActionError } from './errors.js';

const DEFAULT_INVITATION_TTL_MS = 72 * 60 * 60_000;

export interface InvitationIssueRepository {
  findPendingRecipient(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null>;
  /** Locks actor/recipient, requires an active Admin actor in the recipient's
   * organization, revalidates the snapshot, revokes prior invitations,
   * cancels their pending outbox rows, and persists challenge/outbox/audit atomically. */
  issueInvitationAtomically(input: {
    readonly actorAdminUserId: string;
    readonly expectedRecipient: AccountSnapshot;
    readonly challenge: ActionChallengeDraft;
    readonly outbox: ReturnType<EncryptedEmailOutboxFactory['action']>;
    readonly audit: AuditEventDraft;
  }): Promise<'issued' | 'not_found' | 'not_pending' | 'concurrent_change'>;
  inspectUsableInvitation(input: {
    readonly tokenSha256: string;
    readonly now: Date;
  }): Promise<{
    readonly challengeId: string;
    readonly recipient: AccountSnapshot;
    readonly activationMode: InvitationAcceptanceMode;
  } | null>;
  /** Consumes the challenge and writes credential, applicable account
   * activation, and audit in one transaction. */
  acceptInvitationAtomically(input: {
    readonly tokenSha256: string;
    readonly expectedChallengeId: string;
    readonly expectedRecipientVersion: string;
    readonly passwordPhc: string;
    readonly passwordPolicyVersion: string;
    readonly acceptedAt: Date;
    readonly audit: AuditEventDraft;
  }): Promise<'accepted' | 'invalid' | 'concurrent_change'>;
}

export interface InvitationServiceOptions {
  readonly repository: InvitationIssueRepository;
  readonly passwordCredentials: PasswordCredentialService;
  readonly emailOutbox: EncryptedEmailOutboxFactory;
  readonly actionBaseUrl: string;
  readonly invitationTtlMs?: number;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class InvitationService {
  readonly #repository: InvitationIssueRepository;
  readonly #passwordCredentials: PasswordCredentialService;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #invitationTtlMs: number;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(options: InvitationServiceOptions) {
    this.#repository = options.repository;
    this.#passwordCredentials = options.passwordCredentials;
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#invitationTtlMs = options.invitationTtlMs ?? DEFAULT_INVITATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
    this.#idGenerator = options.idGenerator ?? randomUUID;
    addMilliseconds(new Date(0), this.#invitationTtlMs);
  }

  async issueForExistingPendingUser(input: {
    readonly organizationId: string;
    readonly actorAdminUserId: string;
    readonly actorSessionId: string;
    readonly userId: string;
    readonly requestId?: string;
  }): Promise<{ readonly challengeId: string; readonly expiresAt: Date }> {
    const recipient = await this.#repository.findPendingRecipient({
      organizationId: input.organizationId,
      userId: input.userId,
    });
    if (recipient === null) {
      throw new AccountActionError('account_not_found');
    }
    if (recipient.status !== 'pendente') {
      throw new AccountActionError('account_not_pending');
    }

    const now = this.#clock();
    const expiresAt = addMilliseconds(now, this.#invitationTtlMs);
    const challengeId = this.#idGenerator();
    const messageId = this.#idGenerator();
    const token = createOpaqueActionToken();
    const activationMode = 'activate_user' as const;
    const challenge: ActionChallengeDraft = {
      id: challengeId,
      organizationId: recipient.organizationId,
      userId: recipient.id,
      purpose: 'invitation',
      tokenSha256: token.sha256,
      expiresAt,
      activationMode,
    };
    const outbox = this.#emailOutbox.action({
      id: messageId,
      organizationId: recipient.organizationId,
      challengeId,
      to: recipient.normalizedEmail,
      subject: 'Convite para acessar o Tchê Agro',
      introduction: `Olá, ${recipient.name}. Seu acesso ao Tchê Agro foi convidado.`,
      actionLabel: 'Definir senha',
      action: 'accept-invitation',
      actionBaseUrl: this.#actionBaseUrl,
      token: token.token,
      availableAt: now,
      expiresAt,
    });
    const audit: AuditEventDraft = {
      id: this.#idGenerator(),
      organizationId: recipient.organizationId,
      eventType: 'auth.convite.criado',
      result: 'success',
      occurredAt: now,
      actorUserId: input.actorAdminUserId,
      actorSessionId: input.actorSessionId,
      affectedUserId: recipient.id,
      resourceType: 'action_challenge',
      resourceId: challengeId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      metadata: { activation_mode: activationMode },
    };
    const result = await this.#repository.issueInvitationAtomically({
      actorAdminUserId: input.actorAdminUserId,
      expectedRecipient: recipient,
      challenge,
      outbox,
      audit,
    });

    if (result === 'not_found') throw new AccountActionError('account_not_found');
    if (result === 'not_pending') {
      throw new AccountActionError('account_not_pending');
    }
    if (result === 'concurrent_change') {
      throw new AccountActionError('concurrent_account_change');
    }

    return { challengeId, expiresAt };
  }

  async accept(input: {
    readonly token: string;
    readonly password: string;
    readonly requestId?: string;
  }): Promise<{ readonly userId: string; readonly loginRequired: true }> {
    const tokenSha256 = hashActionToken(input.token);
    const inspectedAt = this.#clock();
    const invitation = await this.#repository.inspectUsableInvitation({
      tokenSha256,
      now: inspectedAt,
    });
    if (invitation === null || invitation.recipient.status !== 'pendente') {
      throw new AccountActionError('invitation_invalid');
    }

    const password = await this.#passwordCredentials.validateAndHash(
      input.password,
    );
    const acceptedAt = this.#clock();
    const audit: AuditEventDraft = {
      id: this.#idGenerator(),
      organizationId: invitation.recipient.organizationId,
      eventType: 'auth.convite.aceito',
      result: 'success',
      occurredAt: acceptedAt,
      affectedUserId: invitation.recipient.id,
      resourceType: 'action_challenge',
      resourceId: invitation.challengeId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      metadata: { activation_mode: invitation.activationMode },
    };
    const result = await this.#repository.acceptInvitationAtomically({
      tokenSha256,
      expectedChallengeId: invitation.challengeId,
      expectedRecipientVersion: invitation.recipient.version,
      passwordPhc: password.passwordHash,
      passwordPolicyVersion: password.policyVersion,
      acceptedAt,
      audit,
    });
    if (result !== 'accepted') {
      throw new AccountActionError(
        result === 'concurrent_change'
          ? 'concurrent_account_change'
          : 'invitation_invalid',
      );
    }

    return { userId: invitation.recipient.id, loginRequired: true };
  }
}
