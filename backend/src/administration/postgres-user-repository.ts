import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';

import type { Clock } from '../account-actions/contracts.js';
import {
  AccountActionPostgresStore,
  type PostgresAccountActionOptions,
} from '../account-actions/postgres-common.js';
import { databaseInteger, query } from '../auth/postgres-common.js';
import type { EncryptedOutboxMessageDraft } from '../outbox/contracts.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import { createOpaqueActionToken } from '../security/action-token.js';
import { forbidden, serviceUnavailable, unauthorized } from '../security/http-error.js';
import type { AdministrativeSafeReceipt } from './contracts.js';
import { validateAdministrativeIdempotencyReceipt } from './validation.js';
import type {
  AdministrativeCommandIdentity,
  AdministrativeCommandResult,
  AdministrativeUserListInput,
  AdministrativeUserRepository,
  AdministrativeUserView,
  ChangeAdministrativeUserStatusInput,
  CreateAdministrativeUserInput,
  IssueAdministrativeInvitationInput,
  UpdateAdministrativeUserInput,
} from './user-contracts.js';

const DEFAULT_INVITATION_TTL_MS = 72 * 60 * 60_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60_000;

type ActorState = 'ok' | 'invalid_session' | 'forbidden';
type AdministrativeFunctionName =
  | 'tche_admin_criar_usuario_mp35b'
  | 'tche_admin_atualizar_usuario_mp35b'
  | 'tche_admin_alterar_status_usuario_mp35b'
  | 'tche_admin_emitir_convite_usuario_mp35b';

interface UserRow extends QueryResultRow {
  readonly id: string;
  readonly organizacao_id: string;
  readonly produtor_id: string | null;
  readonly nome: string;
  readonly sort_key: string;
  readonly email: string;
  readonly perfil: 'admin' | 'colaborador' | 'produtor';
  readonly status: 'pendente' | 'ativo' | 'inativo';
  readonly telefone: string | null;
  readonly documento: string | null;
  readonly observacoes: string | null;
  readonly versao: string | number;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

interface GuardedUserRow extends QueryResultRow {
  readonly actor_state: ActorState;
  readonly id: string | null;
  readonly organizacao_id: string | null;
  readonly produtor_id: string | null;
  readonly nome: string | null;
  readonly sort_key: string | null;
  readonly email: string | null;
  readonly perfil: UserRow['perfil'] | null;
  readonly status: UserRow['status'] | null;
  readonly telefone: string | null;
  readonly documento: string | null;
  readonly observacoes: string | null;
  readonly versao: string | number | null;
  readonly criado_em: Date | null;
  readonly atualizado_em: Date | null;
}

interface TargetRow extends QueryResultRow {
  readonly nome: string;
  readonly email: string;
}

interface CommandRow extends QueryResultRow {
  readonly status: AdministrativeCommandResult['status'];
  readonly codigo_http: number | null;
  readonly recibo: unknown;
}

interface InvitationDraft {
  readonly invitationId: string;
  readonly challengeId: string;
  readonly challengeTokenSha256: string;
  readonly outbox: EncryptedOutboxMessageDraft;
  readonly expiresAt: Date;
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function userView(row: UserRow): AdministrativeUserView {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    producerId: row.produtor_id,
    name: row.nome,
    sortKey: row.sort_key,
    email: row.email,
    profile: row.perfil,
    status: row.status,
    phone: row.telefone,
    document: row.documento,
    notes: row.observacoes,
    version: databaseInteger(row.versao),
    createdAt: row.criado_em,
    updatedAt: row.atualizado_em,
  };
}

function requiredUserRow(row: GuardedUserRow): UserRow | null {
  if (row.id === null) return null;
  if (
    row.organizacao_id === null || row.nome === null || row.sort_key === null
    || row.email === null || row.perfil === null || row.status === null
    || row.versao === null || row.criado_em === null || row.atualizado_em === null
  ) {
    throw serviceUnavailable();
  }
  return {
    id: row.id,
    organizacao_id: row.organizacao_id,
    produtor_id: row.produtor_id,
    nome: row.nome,
    sort_key: row.sort_key,
    email: row.email,
    perfil: row.perfil,
    status: row.status,
    telefone: row.telefone,
    documento: row.documento,
    observacoes: row.observacoes,
    versao: row.versao,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function assertActorState(state: ActorState): void {
  if (state === 'invalid_session') throw unauthorized();
  if (state === 'forbidden') throw forbidden();
}

function base64UrlHex(value: string, expectedBytes?: number): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw serviceUnavailable();
  const bytes = Buffer.from(value, 'base64url');
  if (
    bytes.toString('base64url') !== value
    || (expectedBytes !== undefined && bytes.byteLength !== expectedBytes)
  ) {
    throw serviceUnavailable();
  }
  return bytes.toString('hex');
}

export class PostgresAdministrativeUserRepository
  implements AdministrativeUserRepository
{
  readonly #store: AccountActionPostgresStore;
  readonly #emailOutbox: EncryptedEmailOutboxFactory;
  readonly #actionBaseUrl: string;
  readonly #invitationTtlMs: number;
  readonly #clock: Clock;

  public constructor(
    options: PostgresAccountActionOptions & {
      readonly emailOutbox: EncryptedEmailOutboxFactory;
      readonly actionBaseUrl: string;
      readonly invitationTtlMs?: number;
      readonly clock?: Clock;
    },
  ) {
    this.#store = new AccountActionPostgresStore(options);
    this.#emailOutbox = options.emailOutbox;
    this.#actionBaseUrl = options.actionBaseUrl;
    this.#invitationTtlMs = options.invitationTtlMs ?? DEFAULT_INVITATION_TTL_MS;
    this.#clock = options.clock ?? (() => new Date());
  }

  public async list(
    input: AdministrativeUserListInput,
  ): Promise<readonly AdministrativeUserView[]> {
    const guarded = await this.#store.read(async (client) => {
      const result = await query<GuardedUserRow>(
        client,
        `
          WITH actor_state AS (
            SELECT CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM public.usuarios AS ator
                JOIN public.sessoes_autenticacao AS sessao
                  ON sessao.organizacao_id = ator.organizacao_id
                 AND sessao.usuario_id = ator.id
                 AND sessao.id = $8
                 AND sessao.versao_autorizacao = ator.versao_autorizacao
                WHERE ator.organizacao_id = $1 AND ator.id = $9
                  AND ator.status = 'ativo'
                  AND ator.versao_autorizacao = $10
                  AND sessao.status = 'ativa'
                  AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
                  AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
              ) THEN 'invalid_session'
              WHEN EXISTS (
                SELECT 1 FROM public.usuarios AS ator
                WHERE ator.organizacao_id = $1 AND ator.id = $9
                  AND ator.perfil = 'admin'
              ) THEN 'ok'
              ELSE 'forbidden'
            END AS state
          )
          SELECT actor_state.state AS actor_state, pagina.*
          FROM actor_state
          LEFT JOIN LATERAL (
            SELECT usuario.id, usuario.organizacao_id,
                   produtor.id AS produtor_id,
                   usuario.nome, pg_catalog.lower(usuario.nome) AS sort_key,
                   usuario.email, usuario.perfil, usuario.status,
                   usuario.telefone, usuario.documento, usuario.observacoes,
                   usuario.versao, usuario.criado_em, usuario.atualizado_em
            FROM public.usuarios AS usuario
            LEFT JOIN public.produtores AS produtor
              ON produtor.organizacao_id = usuario.organizacao_id
             AND produtor.usuario_id = usuario.id
            WHERE actor_state.state = 'ok'
              AND usuario.organizacao_id = $1
              AND ($2::text IS NULL OR usuario.perfil = $2)
              AND ($3::text IS NULL OR usuario.status = $3)
              AND (
                $4::text IS NULL
                OR usuario.nome ILIKE '%' || $4 || '%' ESCAPE '\\'
                OR usuario.email ILIKE '%' || $4 || '%' ESCAPE '\\'
                OR COALESCE(usuario.documento, '') ILIKE '%' || $4 || '%' ESCAPE '\\'
              )
              AND (
                $5::text IS NULL
                OR (pg_catalog.lower(usuario.nome), usuario.id) > ($5, $6::uuid)
              )
            ORDER BY pg_catalog.lower(usuario.nome), usuario.id
            LIMIT $7
          ) AS pagina ON true
          ORDER BY pagina.sort_key, pagina.id
        `,
        [
          input.organizationId,
          input.profile ?? null,
          input.status ?? null,
          input.search === undefined ? null : escapeLike(input.search),
          input.cursor?.sortKey ?? null,
          input.cursor?.id ?? null,
          input.limit,
          input.principal.sessionId,
          input.principal.id,
          input.principal.authorizationVersion,
        ],
      );
      return result.rows;
    });
    const state = guarded[0]?.actor_state;
    if (state === undefined) throw serviceUnavailable();
    assertActorState(state);
    return guarded.flatMap((row) => {
      const persisted = requiredUserRow(row);
      return persisted === null ? [] : [userView(persisted)];
    });
  }

  public async findById(input: {
    readonly principal: CreateAdministrativeUserInput['principal'];
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AdministrativeUserView | null> {
    const row = await this.#store.read(async (client) => {
      const result = await query<GuardedUserRow>(
        client,
        `
          WITH actor_state AS (
            SELECT CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM public.usuarios AS ator
                JOIN public.sessoes_autenticacao AS sessao
                  ON sessao.organizacao_id = ator.organizacao_id
                 AND sessao.usuario_id = ator.id
                 AND sessao.id = $3
                 AND sessao.versao_autorizacao = ator.versao_autorizacao
                WHERE ator.organizacao_id = $1 AND ator.id = $4
                  AND ator.status = 'ativo'
                  AND ator.versao_autorizacao = $5
                  AND sessao.status = 'ativa'
                  AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
                  AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
              ) THEN 'invalid_session'
              WHEN EXISTS (
                SELECT 1 FROM public.usuarios AS ator
                WHERE ator.organizacao_id = $1 AND ator.id = $4
                  AND ator.perfil = 'admin'
              ) THEN 'ok'
              ELSE 'forbidden'
            END AS state
          )
          SELECT actor_state.state AS actor_state, alvo.*
          FROM actor_state
          LEFT JOIN LATERAL (
            SELECT usuario.id, usuario.organizacao_id,
                   produtor.id AS produtor_id,
                   usuario.nome, pg_catalog.lower(usuario.nome) AS sort_key,
                   usuario.email, usuario.perfil, usuario.status,
                   usuario.telefone, usuario.documento, usuario.observacoes,
                   usuario.versao, usuario.criado_em, usuario.atualizado_em
            FROM public.usuarios AS usuario
            LEFT JOIN public.produtores AS produtor
              ON produtor.organizacao_id = usuario.organizacao_id
             AND produtor.usuario_id = usuario.id
            WHERE actor_state.state = 'ok'
              AND usuario.organizacao_id = $1 AND usuario.id = $2
          ) AS alvo ON true
        `,
        [
          input.organizationId,
          input.userId,
          input.principal.sessionId,
          input.principal.id,
          input.principal.authorizationVersion,
        ],
      );
      return result.rows[0] ?? null;
    });
    if (row === null) throw serviceUnavailable();
    assertActorState(row.actor_state);
    const persisted = requiredUserRow(row);
    return persisted === null ? null : userView(persisted);
  }

  #identityMatchesPrincipal(
    principal: CreateAdministrativeUserInput['principal'],
    identity: AdministrativeCommandIdentity,
  ): boolean {
    return principal.id === identity.actorUserId
      && principal.organizationId === identity.organizationId
      && principal.sessionId === identity.sessionId;
  }

  #basePayload(
    principal: CreateAdministrativeUserInput['principal'],
    identity: AdministrativeCommandIdentity,
  ): Readonly<Record<string, unknown>> {
    return {
      organizacao_id: identity.organizationId,
      ator_usuario_id: identity.actorUserId,
      sessao_id: identity.sessionId,
      ator_versao_autorizacao: principal.authorizationVersion,
      request_id: identity.requestId,
      correlation_id: identity.correlationId,
      chave_idempotencia_hash: identity.idempotencyKeyHash.toString('hex'),
      hash_requisicao: identity.requestHash.toString('hex'),
    };
  }

  #invitationDraft(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly name: string;
    readonly email: string;
  }): InvitationDraft {
    const issuedAt = this.#clock();
    const expiresAt = new Date(issuedAt.getTime() + this.#invitationTtlMs);
    const invitationId = randomUUID();
    const challengeId = randomUUID();
    const token = createOpaqueActionToken();
    return {
      invitationId,
      challengeId,
      challengeTokenSha256: token.sha256,
      expiresAt,
      outbox: this.#emailOutbox.action({
        id: randomUUID(),
        organizationId: input.organizationId,
        challengeId,
        to: input.email,
        subject: 'Convite para acessar o Tchê Agro',
        introduction: `Olá, ${input.name}. Seu acesso ao Tchê Agro foi convidado.`,
        actionLabel: 'Definir senha',
        action: 'accept-invitation',
        actionBaseUrl: this.#actionBaseUrl,
        token: token.token,
        availableAt: issuedAt,
        expiresAt,
      }),
    };
  }

  #safeInvitationDraft(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly name: string;
    readonly email: string;
  }): InvitationDraft {
    try {
      return this.#invitationDraft(input);
    } catch {
      throw serviceUnavailable();
    }
  }

  #invitationPayload(
    draft: InvitationDraft,
    recipientName: string,
    recipientEmail: string,
  ): Readonly<Record<string, unknown>> {
    const payload = draft.outbox.payload;
    return {
      id: draft.invitationId,
      challenge_id: draft.challengeId,
      token_hash: draft.challengeTokenSha256,
      expires_at: draft.expiresAt.toISOString(),
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      outbox: {
        id: draft.outbox.id,
        message_type: draft.outbox.messageType,
        recipient_hmac: this.#store.emailHmac(recipientEmail).toString('hex'),
        ciphertext: base64UrlHex(payload.ciphertext),
        key_id: payload.keyId,
        nonce: base64UrlHex(payload.iv, 12),
        authentication_tag: base64UrlHex(payload.authenticationTag, 16),
        context: {
          version: payload.version,
          algorithm: payload.algorithm,
          organizationId: draft.outbox.organizationId,
          messageId: draft.outbox.id,
          messageType: draft.outbox.messageType,
        },
        max_attempts: draft.outbox.maxAttempts,
        available_at: draft.outbox.availableAt.toISOString(),
        expires_at: draft.outbox.expiresAt.toISOString(),
      },
    };
  }

  async #target(userId: string, organizationId: string): Promise<TargetRow | null> {
    return this.#store.read(async (client) => {
      const result = await query<TargetRow>(
        client,
        `SELECT nome, email FROM public.usuarios
         WHERE organizacao_id = $1 AND id = $2`,
        [organizationId, userId],
      );
      return result.rows[0] ?? null;
    });
  }

  async #call(
    functionName: AdministrativeFunctionName,
    identity: AdministrativeCommandIdentity,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<AdministrativeCommandResult> {
    return this.#store.transaction(async (client) => {
      const result = await query<CommandRow>(
        client,
        `SELECT status, codigo_http, recibo
         FROM public.${functionName}($1::jsonb)`,
        [JSON.stringify(payload)],
      );
      const row = result.rows[0];
      if (row === undefined) throw serviceUnavailable();
      if (row.status !== 'completed' && row.status !== 'replayed') {
        const allowed = new Set<AdministrativeCommandResult['status']>([
          'invalid_session', 'forbidden', 'not_found', 'version_conflict',
          'idempotency_conflict', 'duplicate_email', 'invalid_transition',
          'pending_status_transition',
          'email_change_forbidden', 'active_holder_conflict', 'self_deactivation',
          'last_admin_conflict', 'credential_required', 'not_pending', 'no_change',
        ]);
        if (!allowed.has(row.status)) throw serviceUnavailable();
        return { status: row.status } as AdministrativeCommandResult;
      }
      if (row.codigo_http === null || row.recibo === null) throw serviceUnavailable();
      const createdAt = new Date(0);
      const envelope = {
        command: identity.command,
        state: 'concluido' as const,
        sessionId: identity.sessionId,
        requestId: identity.requestId,
        correlationId: identity.correlationId,
        httpStatus: row.codigo_http,
        receipt: row.recibo,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + NINETY_DAYS_MS),
      };
      try {
        validateAdministrativeIdempotencyReceipt(envelope);
      } catch (error) {
        if (error instanceof TypeError) throw serviceUnavailable();
        throw error;
      }
      return {
        status: row.status,
        httpStatus: envelope.httpStatus,
        receipt: envelope.receipt as AdministrativeSafeReceipt,
      };
    });
  }

  public async create(
    input: CreateAdministrativeUserInput,
  ): Promise<AdministrativeCommandResult> {
    if (!this.#identityMatchesPrincipal(input.principal, input.identity)) {
      return { status: 'forbidden' };
    }
    const invitation = this.#safeInvitationDraft({
      organizationId: input.identity.organizationId,
      userId: input.userId,
      name: input.name,
      email: input.email,
    });
    return this.#call(
      'tche_admin_criar_usuario_mp35b',
      input.identity,
      {
        ...this.#basePayload(input.principal, input.identity),
        usuario_id: input.userId,
        ...(input.producerId === undefined ? {} : { produtor_id: input.producerId }),
        nome: input.name,
        email: input.email,
        perfil: input.profile,
        ...(input.phone === undefined ? {} : { telefone: input.phone }),
        ...(input.document === undefined ? {} : { documento: input.document }),
        ...(input.notes === undefined ? {} : { observacoes: input.notes }),
        invitation: this.#invitationPayload(invitation, input.name, input.email),
      },
    );
  }

  public async update(input: UpdateAdministrativeUserInput): Promise<AdministrativeCommandResult> {
    if (!this.#identityMatchesPrincipal(input.principal, input.identity)) {
      return { status: 'forbidden' };
    }
    const patch = {
      ...(input.name === undefined ? {} : { nome: input.name }),
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.phone === undefined ? {} : { telefone: input.phone }),
      ...(input.document === undefined ? {} : { documento: input.document }),
      ...(input.notes === undefined ? {} : { observacoes: input.notes }),
    };
    let invitation: Readonly<Record<string, unknown>> | undefined;
    if (input.email !== undefined) {
      const target = await this.#target(input.userId, input.identity.organizationId);
      const finalName = input.name ?? target?.nome ?? 'Convite pendente';
      const finalEmail = input.email;
      if (target === null || target.email !== finalEmail) {
        const draft = this.#safeInvitationDraft({
          organizationId: input.identity.organizationId,
          userId: input.userId,
          name: finalName,
          email: finalEmail,
        });
        invitation = this.#invitationPayload(draft, finalName, finalEmail);
      }
    }
    return this.#call(
      'tche_admin_atualizar_usuario_mp35b',
      input.identity,
      {
        ...this.#basePayload(input.principal, input.identity),
        usuario_id: input.userId,
        versao: input.expectedVersion,
        patch,
        ...(invitation === undefined ? {} : { invitation }),
      },
    );
  }

  public changeStatus(
    input: ChangeAdministrativeUserStatusInput,
  ): Promise<AdministrativeCommandResult> {
    if (!this.#identityMatchesPrincipal(input.principal, input.identity)) {
      return Promise.resolve({ status: 'forbidden' });
    }
    return this.#call(
      'tche_admin_alterar_status_usuario_mp35b',
      input.identity,
      {
        ...this.#basePayload(input.principal, input.identity),
        usuario_id: input.userId,
        versao: input.expectedVersion,
        status: input.status,
        motivo: input.reason.code,
        ...(input.reason.detail === undefined
          ? {}
          : { motivo_detalhe: input.reason.detail }),
      },
    );
  }

  public async issueInvitation(
    input: IssueAdministrativeInvitationInput,
  ): Promise<AdministrativeCommandResult> {
    if (!this.#identityMatchesPrincipal(input.principal, input.identity)) {
      return { status: 'forbidden' };
    }
    const target = await this.#target(input.userId, input.identity.organizationId);
    const name = target?.nome ?? 'Convite pendente';
    const email = target?.email ?? 'convite-invalido@example.invalid';
    const draft = this.#safeInvitationDraft({
      organizationId: input.identity.organizationId,
      userId: input.userId,
      name,
      email,
    });
    return this.#call(
      'tche_admin_emitir_convite_usuario_mp35b',
      input.identity,
      {
        ...this.#basePayload(input.principal, input.identity),
        usuario_id: input.userId,
        invitation: this.#invitationPayload(draft, name, email),
      },
    );
  }
}
