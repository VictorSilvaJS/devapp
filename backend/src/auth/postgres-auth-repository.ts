import { randomUUID } from 'node:crypto';

import type { PoolClient, QueryResultRow } from 'pg';

import type {
  AuthenticatedPrincipal,
  AuthRepository,
  CreateSessionResult,
  LoginSubject,
  PasswordRecoveryBeginInput,
  PasswordChangeResult,
  RotateRefreshResult,
  SessionSummary,
  UserProfile,
  UserStatus,
} from './contracts.js';
import {
  databaseInteger,
  decodeDigest,
  inTransaction,
  query,
  safeDatabaseRead,
  safeDurationSeconds,
  safeRequestId,
  type AuthPostgresPool,
} from './postgres-common.js';
import { hmacIdentifier } from '../security/tokens.js';
import type { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import type { EncryptedOutboxMessageDraft } from '../outbox/contracts.js';
import type { AccountNotificationWriter } from '../notifications/contracts.js';
import { PostgresAccountNotificationWriter } from '../notifications/postgres-account-notification-writer.js';
import { insertRuntimeAudit } from '../audit/postgres-runtime-audit.js';
import { normalizeEmail } from './normalization.js';

const DEFAULT_ORGANIZATION_ID = 'org_tche_fertilidade';

interface SubjectRow extends QueryResultRow {
  id: string;
  organizacao_id: string;
  nome: string;
  email: string;
  perfil: UserProfile;
  status: UserStatus;
  versao_autorizacao: string | number;
  credencial_id: string | null;
  senha_phc: string | null;
  versao_politica_senha: string | null;
}

interface PrincipalRow extends QueryResultRow {
  id: string;
  organizacao_id: string;
  nome: string;
  email: string;
  perfil: UserProfile;
  status: UserStatus;
  versao_autorizacao: string | number;
  sessao_id: string;
}

interface LockedRefreshRow extends PrincipalRow {
  refresh_id: string;
  refresh_status: 'ativo' | 'rotacionado' | 'revogado' | 'expirado';
  refresh_expira_em: Date;
  sessao_status: 'ativa' | 'revogada' | 'expirada';
  sessao_versao_autorizacao: string | number;
  expira_inatividade_em: Date;
  expira_absolutamente_em: Date;
}

interface SessionRow extends QueryResultRow {
  id: string;
  criada_em: Date;
  ultima_renovacao_em: Date;
  expira_absolutamente_em: Date;
  status: 'ativa' | 'revogada' | 'expirada';
  revogada_em: Date | null;
  rotulo_cliente: string | null;
}

function mapSubject(row: SubjectRow): LoginSubject {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    name: row.nome,
    email: row.email,
    profile: row.perfil,
    status: row.status,
    authorizationVersion: databaseInteger(row.versao_autorizacao),
    credential:
      row.credencial_id === null ||
      row.senha_phc === null ||
      row.versao_politica_senha === null
        ? null
        : {
            id: row.credencial_id,
            passwordHash: row.senha_phc,
            policyVersion: row.versao_politica_senha,
          },
  };
}

function mapPrincipal(row: PrincipalRow): AuthenticatedPrincipal {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    name: row.nome,
    email: row.email,
    profile: row.perfil,
    status: row.status,
    authorizationVersion: databaseInteger(row.versao_autorizacao),
    sessionId: row.sessao_id,
  };
}

async function appendAudit(
  client: PoolClient,
  input: {
    readonly id?: string;
    readonly organizationId: string;
    readonly event: string;
    readonly result?: 'sucesso' | 'negado' | 'falha';
    readonly actorType: 'usuario' | 'sistema';
    readonly actorUserId?: string;
    readonly sessionId?: string;
    readonly affectedUserId?: string;
    readonly resourceType?: string;
    readonly resourceId?: string;
    readonly requestId: string;
    readonly emailHmac?: Buffer;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
): Promise<void> {
  if (input.resourceType === undefined || input.resourceId === undefined) {
    throw new Error('Runtime audit requires a server-defined resource.');
  }
  await insertRuntimeAudit(client, {
    ...(input.id === undefined ? {} : { id: input.id }),
    organizationId: input.organizationId,
    event: input.event,
    result: input.result ?? 'sucesso',
    actorType: input.actorType,
    ...(input.actorUserId === undefined
      ? {}
      : { actorUserId: input.actorUserId }),
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    ...(input.affectedUserId === undefined
      ? {}
      : { affectedUserId: input.affectedUserId }),
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestId: safeRequestId(input.requestId),
    ...(input.emailHmac === undefined ? {} : { emailHmac: input.emailHmac }),
    metadata: input.metadata ?? {},
  });
}

async function revokeSession(
  client: PoolClient,
  input: {
    readonly organizationId: string;
    readonly sessionId: string;
    readonly reason: string;
  },
): Promise<boolean> {
  await query(
    client,
    `
      UPDATE public.tokens_acesso
      SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
          motivo_revogacao = $3
      WHERE organizacao_id = $1 AND sessao_id = $2 AND status = 'ativo'
    `,
    [input.organizationId, input.sessionId, input.reason],
  );
  await query(
    client,
    `
      UPDATE public.tokens_refresh
      SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
          motivo_revogacao = $3
      WHERE organizacao_id = $1 AND sessao_id = $2 AND status = 'ativo'
    `,
    [input.organizationId, input.sessionId, input.reason],
  );
  const session = await query(
    client,
    `
      UPDATE public.sessoes_autenticacao
      SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
          motivo_revogacao = $3
      WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
    `,
    [input.organizationId, input.sessionId, input.reason],
  );
  return session.rowCount === 1;
}

async function revokeAllUserSessions(
  client: PoolClient,
  input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly reason: string;
    readonly exceptSessionId?: string;
  },
): Promise<number> {
  const sessionIds = await query<{ id: string }>(
    client,
    `
      SELECT id
      FROM public.sessoes_autenticacao
      WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativa'
        AND ($3::uuid IS NULL OR id <> $3::uuid)
      FOR UPDATE
    `,
    [input.organizationId, input.userId, input.exceptSessionId ?? null],
  );
  let revoked = 0;
  for (const row of sessionIds.rows) {
    if (await revokeSession(client, {
      organizationId: input.organizationId,
      sessionId: row.id,
      reason: input.reason,
    })) revoked += 1;
  }
  return revoked;
}

function clientLabel(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized.slice(0, 200);
}

function decodeOutboxPart(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) throw new TypeError('Invalid outbox part.');
  return decoded;
}

async function insertOutboxMessage(
  client: PoolClient,
  input: {
    readonly draft: EncryptedOutboxMessageDraft;
    readonly userId: string;
    readonly recipientHmac: Buffer;
    readonly originId: string;
  },
): Promise<void> {
  await query(
    client,
    `
      INSERT INTO public.outbox_email (
        id, organizacao_id, usuario_id, desafio_id, tipo_mensagem,
        origem_tipo, origem_id, destinatario_hmac, payload_cifrado,
        chave_id, nonce, tag_autenticacao, contexto_autenticado,
        maximo_tentativas, disponivel_em, expira_em
      ) VALUES (
        $1, $2, $3, $4, $5, 'desafio', $6, $7, $8, $9, $10, $11,
        $12::jsonb, $13, $14, $15
      )
    `,
    [
      input.draft.id,
      input.draft.organizationId,
      input.userId,
      input.draft.challengeId ?? null,
      input.draft.messageType,
      input.originId,
      input.recipientHmac,
      decodeOutboxPart(input.draft.payload.ciphertext),
      input.draft.payload.keyId,
      decodeOutboxPart(input.draft.payload.iv),
      decodeOutboxPart(input.draft.payload.authenticationTag),
      JSON.stringify({
        version: input.draft.payload.version,
        algorithm: input.draft.payload.algorithm,
        organizationId: input.draft.organizationId,
        messageId: input.draft.id,
        messageType: input.draft.messageType,
      }),
      input.draft.maxAttempts,
      input.draft.availableAt,
      input.draft.expiresAt,
    ],
  );
}

async function cancelOutboxForChallenges(
  client: PoolClient,
  organizationId: string,
  challengeIds: readonly string[],
): Promise<void> {
  if (challengeIds.length === 0) return;
  await query(
    client,
    `
      UPDATE public.outbox_email
      SET status = 'cancelado', payload_cifrado = NULL, nonce = NULL,
          tag_autenticacao = NULL, bloqueado_em = NULL, bloqueado_por = NULL,
          lease_token = NULL, lease_expira_em = NULL,
          encerrado_em = pg_catalog.clock_timestamp(),
          erro_categoria = 'challenge_revoked'
      WHERE organizacao_id = $1 AND desafio_id = ANY($2::uuid[])
        AND status IN ('pendente', 'processando')
    `,
    [organizationId, [...challengeIds]],
  );
}

export interface PostgresAuthRepositoryOptions {
  readonly pool: AuthPostgresPool;
  readonly emailHmacKey: Uint8Array;
  readonly recoveryOutboxFactory: EncryptedEmailOutboxFactory;
  readonly recoveryActionBaseUrl: string;
  readonly organizationId?: string;
  readonly idGenerator?: () => string;
  readonly notificationWriter?: AccountNotificationWriter;
}

export class PostgresAuthRepository implements AuthRepository {
  readonly #pool: AuthPostgresPool;
  readonly #organizationId: string;
  readonly #emailHmacKey: Uint8Array;
  readonly #recoveryOutboxFactory: EncryptedEmailOutboxFactory;
  readonly #recoveryActionBaseUrl: string;
  readonly #idGenerator: () => string;
  readonly #notificationWriter: AccountNotificationWriter;

  public constructor(options: PostgresAuthRepositoryOptions) {
    if (options.emailHmacKey.byteLength < 32) {
      throw new TypeError('emailHmacKey must contain at least 32 bytes.');
    }
    this.#pool = options.pool;
    this.#organizationId = options.organizationId ?? DEFAULT_ORGANIZATION_ID;
    this.#emailHmacKey = Uint8Array.from(options.emailHmacKey);
    this.#recoveryOutboxFactory = options.recoveryOutboxFactory;
    this.#recoveryActionBaseUrl = options.recoveryActionBaseUrl;
    this.#idGenerator = options.idGenerator ?? randomUUID;
    this.#notificationWriter =
      options.notificationWriter ?? new PostgresAccountNotificationWriter();
  }

  public findLoginSubject(normalizedEmail: string): Promise<LoginSubject | null> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<SubjectRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao,
                 credencial.id AS credencial_id, credencial.senha_phc,
                 credencial.versao_politica_senha
          FROM public.usuarios AS usuario
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE usuario.organizacao_id = $1 AND lower(usuario.email) = lower($2)
          LIMIT 1
        `,
        [this.#organizationId, normalizedEmail],
      );
      return result.rows[0] === undefined ? null : mapSubject(result.rows[0]);
    });
  }

  public getCredentialForUser(userId: string): Promise<LoginSubject | null> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<SubjectRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao,
                 credencial.id AS credencial_id, credencial.senha_phc,
                 credencial.versao_politica_senha
          FROM public.usuarios AS usuario
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
          LIMIT 1
        `,
        [this.#organizationId, userId],
      );
      return result.rows[0] === undefined ? null : mapSubject(result.rows[0]);
    });
  }

  public updateCredentialHashIfCurrent(input: {
    readonly credentialId: string;
    readonly expectedPasswordHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
  }): Promise<void> {
    return inTransaction(this.#pool, async (client) => {
      await query(
        client,
        `
          UPDATE public.credenciais_usuario
          SET senha_phc = $4, versao_politica_senha = $5,
              ultimo_rehash_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
            AND senha_phc = $3
        `,
        [
          this.#organizationId,
          input.credentialId,
          input.expectedPasswordHash,
          input.replacementPasswordHash,
          input.policyVersion,
        ],
      );
    });
  }

  public createSession(input: {
    readonly userId: string;
    readonly authorizationVersion: number;
    readonly accessTokenHash: string;
    readonly refreshTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly absoluteTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly clientLabel?: string;
    readonly requestId: string;
  }): Promise<CreateSessionResult | Readonly<{ status: 'denied' }>> {
    const accessHash = decodeDigest(input.accessTokenHash);
    const refreshHash = decodeDigest(input.refreshTokenHash);
    const accessTtl = safeDurationSeconds(input.accessTtlSeconds);
    const absoluteTtl = safeDurationSeconds(input.absoluteTtlSeconds);
    const inactivityTtl = safeDurationSeconds(input.inactivityTtlSeconds);

    return inTransaction(this.#pool, async (client) => {
      const user = await query<SubjectRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao,
                 NULL::uuid AS credencial_id, NULL::text AS senha_phc,
                 NULL::text AS versao_politica_senha
          FROM public.usuarios AS usuario
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
        `,
        [this.#organizationId, input.userId],
      );
      const row = user.rows[0];
      if (
        row === undefined ||
        row.status !== 'ativo' ||
        databaseInteger(row.versao_autorizacao) !== input.authorizationVersion
      ) {
        return { status: 'denied' as const };
      }

      const session = await query<{
        id: string;
        expira_inatividade_em: Date;
        expira_absolutamente_em: Date;
      }>(
        client,
        `
          INSERT INTO public.sessoes_autenticacao (
            organizacao_id, usuario_id, versao_autorizacao, rotulo_cliente,
            expira_inatividade_em, expira_absolutamente_em
          ) VALUES (
            $1, $2, $3, $4,
            LEAST(
              pg_catalog.clock_timestamp() + $5::integer * interval '1 second',
              pg_catalog.clock_timestamp() + $6::integer * interval '1 second'
            ),
            pg_catalog.clock_timestamp() + $6::integer * interval '1 second'
          )
          RETURNING id, expira_inatividade_em, expira_absolutamente_em
        `,
        [
          this.#organizationId,
          input.userId,
          input.authorizationVersion,
          clientLabel(input.clientLabel),
          inactivityTtl,
          absoluteTtl,
        ],
      );
      const sessionRow = session.rows[0];
      const sessionId = sessionRow?.id;
      if (sessionRow === undefined || sessionId === undefined) {
        throw new Error('Session insert failed.');
      }

      const access = await query<{ emitido_em: Date; expira_em: Date }>(
        client,
        `
          INSERT INTO public.tokens_acesso (
            organizacao_id, sessao_id, token_hash, versao_autorizacao, expira_em
          ) VALUES (
            $1, $2, $3, $4,
            pg_catalog.clock_timestamp() + $5::integer * interval '1 second'
          )
          RETURNING emitido_em, expira_em
        `,
        [
          this.#organizationId,
          sessionId,
          accessHash,
          input.authorizationVersion,
          accessTtl,
        ],
      );
      await query(
        client,
        `
          INSERT INTO public.tokens_refresh (
            organizacao_id, sessao_id, token_hash, expira_em
          ) VALUES (
            $1, $2, $3,
            pg_catalog.clock_timestamp() + $4::integer * interval '1 second'
          )
        `,
        [this.#organizationId, sessionId, refreshHash, absoluteTtl],
      );
      await appendAudit(client, {
        organizationId: this.#organizationId,
        event: 'auth.sessao.criada',
        actorType: 'usuario',
        actorUserId: input.userId,
        sessionId,
        affectedUserId: input.userId,
        resourceType: 'sessao',
        resourceId: sessionId,
        requestId: input.requestId,
      });
      const accessRow = access.rows[0];
      if (accessRow === undefined) throw new Error('Access token insert failed.');
      return {
        status: 'created' as const,
        sessionId,
        issuedAt: accessRow.emitido_em,
        accessExpiresAt: accessRow.expira_em,
        inactivityExpiresAt: sessionRow.expira_inatividade_em,
        absoluteExpiresAt: sessionRow.expira_absolutamente_em,
      };
    });
  }

  public rotateRefreshToken(input: {
    readonly currentRefreshTokenHash: string;
    readonly replacementRefreshTokenHash: string;
    readonly replacementAccessTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly requestId: string;
  }): Promise<RotateRefreshResult> {
    const currentHash = decodeDigest(input.currentRefreshTokenHash);
    const nextRefreshHash = decodeDigest(input.replacementRefreshTokenHash);
    const nextAccessHash = decodeDigest(input.replacementAccessTokenHash);
    const accessTtl = safeDurationSeconds(input.accessTtlSeconds);
    const inactivityTtl = safeDurationSeconds(input.inactivityTtlSeconds);

    return inTransaction(this.#pool, async (client) => {
      const locked = await query<LockedRefreshRow>(
        client,
        `
          SELECT refresh.id AS refresh_id, refresh.status AS refresh_status,
                 refresh.expira_em AS refresh_expira_em,
                 sessao.id AS sessao_id, sessao.status AS sessao_status,
                 sessao.versao_autorizacao AS sessao_versao_autorizacao,
                 sessao.expira_inatividade_em, sessao.expira_absolutamente_em,
                 usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao
          FROM public.tokens_refresh AS refresh
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = refresh.organizacao_id
           AND sessao.id = refresh.sessao_id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = sessao.organizacao_id
           AND usuario.id = sessao.usuario_id
          WHERE refresh.token_hash = $1
            AND refresh.organizacao_id = $2
          FOR UPDATE OF refresh, sessao
        `,
        [currentHash, this.#organizationId],
      );
      const row = locked.rows[0];
      if (row === undefined) return { status: 'invalid' as const };

      if (row.refresh_status === 'rotacionado') {
        await revokeSession(client, {
          organizationId: row.organizacao_id,
          sessionId: row.sessao_id,
          reason: 'refresh_reutilizado',
        });
        await appendAudit(client, {
          organizationId: row.organizacao_id,
          event: 'auth.refresh.reutilizado',
          result: 'negado',
          actorType: 'sistema',
          affectedUserId: row.id,
          resourceType: 'sessao',
          resourceId: row.sessao_id,
          requestId: input.requestId,
        });
        return { status: 'replayed' as const };
      }

      const now = await query<{ agora: Date }>(
        client,
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const currentTime = now.rows[0]?.agora;
      if (currentTime === undefined) throw new Error('Database clock unavailable.');
      const authorizationVersion = databaseInteger(row.versao_autorizacao);
      const valid =
        row.refresh_status === 'ativo' &&
        row.sessao_status === 'ativa' &&
        row.status === 'ativo' &&
        row.refresh_expira_em > currentTime &&
        row.expira_inatividade_em > currentTime &&
        row.expira_absolutamente_em > currentTime &&
        databaseInteger(row.sessao_versao_autorizacao) === authorizationVersion;
      if (!valid) {
        await revokeSession(client, {
          organizationId: row.organizacao_id,
          sessionId: row.sessao_id,
          reason: 'sessao_invalida',
        });
        return { status: 'invalid' as const };
      }

      await query(
        client,
        `
          UPDATE public.tokens_acesso
          SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
              motivo_revogacao = 'refresh_rotacionado'
          WHERE organizacao_id = $1 AND sessao_id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.sessao_id],
      );
      await query(
        client,
        `
          UPDATE public.tokens_refresh
          SET status = 'rotacionado', rotacionado_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.refresh_id],
      );
      const sessionWindow = await query<{
        expira_inatividade_em: Date;
        expira_absolutamente_em: Date;
      }>(
        client,
        `
          UPDATE public.sessoes_autenticacao
          SET ultima_renovacao_em = pg_catalog.clock_timestamp(),
              expira_inatividade_em = LEAST(
                pg_catalog.clock_timestamp() + $3::integer * interval '1 second',
                expira_absolutamente_em
              )
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
          RETURNING expira_inatividade_em, expira_absolutamente_em
        `,
        [row.organizacao_id, row.sessao_id, inactivityTtl],
      );
      await query(
        client,
        `
          INSERT INTO public.tokens_refresh (
            organizacao_id, sessao_id, token_refresh_anterior_id,
            token_hash, expira_em
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          row.organizacao_id,
          row.sessao_id,
          row.refresh_id,
          nextRefreshHash,
          row.expira_absolutamente_em,
        ],
      );
      const access = await query<{ emitido_em: Date; expira_em: Date }>(
        client,
        `
          INSERT INTO public.tokens_acesso (
            organizacao_id, sessao_id, token_hash, versao_autorizacao, expira_em
          ) VALUES (
            $1, $2, $3, $4,
            LEAST(
              pg_catalog.clock_timestamp() + $5::integer * interval '1 second',
              $6::timestamptz
            )
          )
          RETURNING emitido_em, expira_em
        `,
        [
          row.organizacao_id,
          row.sessao_id,
          nextAccessHash,
          authorizationVersion,
          accessTtl,
          row.expira_absolutamente_em,
        ],
      );
      await appendAudit(client, {
        organizationId: row.organizacao_id,
        event: 'auth.refresh.rotacionado',
        actorType: 'usuario',
        actorUserId: row.id,
        sessionId: row.sessao_id,
        affectedUserId: row.id,
        resourceType: 'sessao',
        resourceId: row.sessao_id,
        requestId: input.requestId,
      });
      const sessionWindowRow = sessionWindow.rows[0];
      const accessRow = access.rows[0];
      if (sessionWindowRow === undefined || accessRow === undefined) {
        throw new Error('Rotated token window unavailable.');
      }
      return {
        status: 'rotated' as const,
        principal: mapPrincipal(row),
        issuedAt: accessRow.emitido_em,
        accessExpiresAt: accessRow.expira_em,
        inactivityExpiresAt: sessionWindowRow.expira_inatividade_em,
        absoluteExpiresAt: sessionWindowRow.expira_absolutamente_em,
      };
    });
  }

  public resolveAccessToken(
    accessTokenHash: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const hash = decodeDigest(accessTokenHash);
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<PrincipalRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao,
                 sessao.id AS sessao_id
          FROM public.tokens_acesso AS acesso
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = acesso.organizacao_id
           AND sessao.id = acesso.sessao_id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = sessao.organizacao_id
           AND usuario.id = sessao.usuario_id
          WHERE acesso.token_hash = $1
            AND acesso.organizacao_id = $2
            AND acesso.status = 'ativo'
            AND acesso.expira_em > pg_catalog.clock_timestamp()
            AND sessao.status = 'ativa'
            AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
            AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
            AND usuario.status = 'ativo'
            AND acesso.versao_autorizacao = usuario.versao_autorizacao
            AND sessao.versao_autorizacao = usuario.versao_autorizacao
          LIMIT 1
        `,
        [hash, this.#organizationId],
      );
      return result.rows[0] === undefined ? null : mapPrincipal(result.rows[0]);
    });
  }

  public revokeSessionByAccessToken(input: {
    readonly accessTokenHash: string;
    readonly requestId: string;
  }): Promise<void> {
    const hash = decodeDigest(input.accessTokenHash);
    return inTransaction(this.#pool, async (client) => {
      const found = await query<{
        sessao_id: string;
        usuario_id: string;
        organizacao_id: string;
      }>(
        client,
        `
          SELECT sessao.id AS sessao_id, sessao.usuario_id, sessao.organizacao_id
          FROM public.tokens_acesso AS acesso
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = acesso.organizacao_id
           AND sessao.id = acesso.sessao_id
          WHERE acesso.token_hash = $1
            AND acesso.organizacao_id = $2
          FOR UPDATE OF acesso, sessao
        `,
        [hash, this.#organizationId],
      );
      const row = found.rows[0];
      if (row === undefined) return;
      await revokeSession(client, {
        organizationId: row.organizacao_id,
        sessionId: row.sessao_id,
        reason: 'logout',
      });
      await appendAudit(client, {
        organizationId: row.organizacao_id,
        event: 'auth.sessao.logout',
        actorType: 'usuario',
        actorUserId: row.usuario_id,
        sessionId: row.sessao_id,
        affectedUserId: row.usuario_id,
        resourceType: 'sessao',
        resourceId: row.sessao_id,
        requestId: input.requestId,
      });
    });
  }

  public revokeAllSessions(input: {
    readonly userId: string;
    readonly actorSessionId: string;
    readonly exceptSessionId?: string;
    readonly requestId: string;
  }): Promise<void> {
    return inTransaction(this.#pool, async (client) => {
      const user = await query<{ id: string }>(
        client,
        `
          SELECT id FROM public.usuarios
          WHERE organizacao_id = $1 AND id = $2
        `,
        [this.#organizationId, input.userId],
      );
      if (user.rows[0] === undefined) return;
      const revoked = await revokeAllUserSessions(client, {
        organizationId: this.#organizationId,
        userId: input.userId,
        reason: 'logout_todas_sessoes',
        ...(input.exceptSessionId === undefined
          ? {}
          : { exceptSessionId: input.exceptSessionId }),
      });
      if (revoked > 0) {
        await appendAudit(client, {
          organizationId: this.#organizationId,
          event: 'auth.sessao.logout_todas',
          actorType: 'usuario',
          actorUserId: input.userId,
          sessionId: input.actorSessionId,
          affectedUserId: input.userId,
          resourceType: 'usuario',
          resourceId: input.userId,
          requestId: input.requestId,
        });
      }
    });
  }

  public listSessions(input: {
    readonly userId: string;
    readonly currentSessionId: string;
  }): Promise<readonly SessionSummary[]> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<SessionRow>(
        client,
        `
          SELECT id, criada_em, ultima_renovacao_em, expira_absolutamente_em,
                 status, revogada_em, rotulo_cliente
          FROM public.sessoes_autenticacao
          WHERE organizacao_id = $1 AND usuario_id = $2
          ORDER BY criada_em DESC, id DESC
          LIMIT 100
        `,
        [this.#organizationId, input.userId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        createdAt: row.criada_em,
        lastRefreshedAt: row.ultima_renovacao_em,
        absoluteExpiresAt: row.expira_absolutamente_em,
        current: row.id === input.currentSessionId,
        ...(row.rotulo_cliente === null ? {} : { clientLabel: row.rotulo_cliente }),
        ...(row.revogada_em === null ? {} : { revokedAt: row.revogada_em }),
      }));
    });
  }

  public revokeOwnedSession(input: {
    readonly userId: string;
    readonly actorSessionId: string;
    readonly sessionId: string;
    readonly requestId: string;
  }): Promise<boolean> {
    return inTransaction(this.#pool, async (client) => {
      const found = await query<{ id: string; status: string }>(
        client,
        `
          SELECT id, status
          FROM public.sessoes_autenticacao
          WHERE organizacao_id = $1 AND usuario_id = $2 AND id = $3
          FOR UPDATE
        `,
        [this.#organizationId, input.userId, input.sessionId],
      );
      const row = found.rows[0];
      if (row === undefined) return false;
      if (row.status === 'ativa') {
        await revokeSession(client, {
          organizationId: this.#organizationId,
          sessionId: input.sessionId,
          reason: 'revogacao_usuario',
        });
        await appendAudit(client, {
          organizationId: this.#organizationId,
          event: 'auth.sessao.revogada',
          actorType: 'usuario',
          actorUserId: input.userId,
          sessionId: input.actorSessionId,
          affectedUserId: input.userId,
          resourceType: 'sessao',
          resourceId: input.sessionId,
          requestId: input.requestId,
        });
      }
      return true;
    });
  }

  public replacePasswordAndRotateCurrentSession(input: {
    readonly userId: string;
    readonly currentSessionId: string;
    readonly currentAccessTokenHash: string;
    readonly expectedPasswordHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
    readonly replacementAccessTokenHash: string;
    readonly replacementRefreshTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly requestId: string;
  }): Promise<PasswordChangeResult> {
    const currentAccessHash = decodeDigest(input.currentAccessTokenHash);
    const nextAccessHash = decodeDigest(input.replacementAccessTokenHash);
    const nextRefreshHash = decodeDigest(input.replacementRefreshTokenHash);
    const accessTtl = safeDurationSeconds(input.accessTtlSeconds);
    const inactivityTtl = safeDurationSeconds(input.inactivityTtlSeconds);
    return inTransaction(this.#pool, async (client) => {
      const locked = await query<PrincipalRow & {
        credencial_id: string;
        senha_phc: string;
        refresh_id: string;
        expira_absolutamente_em: Date;
      }>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.versao_autorizacao,
                 credencial.id AS credencial_id, credencial.senha_phc,
                 sessao.id AS sessao_id, sessao.expira_absolutamente_em,
                 refresh.id AS refresh_id
          FROM public.usuarios AS usuario
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = usuario.organizacao_id
           AND sessao.usuario_id = usuario.id
           AND sessao.id = $3
          JOIN public.tokens_acesso AS acesso
            ON acesso.organizacao_id = sessao.organizacao_id
           AND acesso.sessao_id = sessao.id
           AND acesso.token_hash = $4
          JOIN public.tokens_refresh AS refresh
            ON refresh.organizacao_id = sessao.organizacao_id
           AND refresh.sessao_id = sessao.id
           AND refresh.status = 'ativo'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
            AND usuario.status = 'ativo'
            AND sessao.status = 'ativa'
            AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
            AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
            AND sessao.versao_autorizacao = usuario.versao_autorizacao
            AND acesso.status = 'ativo'
            AND acesso.expira_em > pg_catalog.clock_timestamp()
            AND acesso.versao_autorizacao = usuario.versao_autorizacao
          FOR UPDATE OF credencial, sessao, acesso, refresh
        `,
        [
          this.#organizationId,
          input.userId,
          input.currentSessionId,
          currentAccessHash,
        ],
      );
      const row = locked.rows[0];
      if (row === undefined || row.senha_phc !== input.expectedPasswordHash) {
        return { status: 'denied' as const };
      }
      await query(
        client,
        `
          UPDATE public.credenciais_usuario
          SET senha_phc = $3, versao_politica_senha = $4,
              senha_definida_em = pg_catalog.clock_timestamp(),
              ultimo_rehash_em = NULL
          WHERE organizacao_id = $1 AND id = $2
        `,
        [
          this.#organizationId,
          row.credencial_id,
          input.replacementPasswordHash,
          input.policyVersion,
        ],
      );
      const version = await query<{ versao_autorizacao: string | number }>(
        client,
        `
          SELECT public.tche_conta_avancar_autorizacao_sessao_mp35b(
            $1, $2, $3
          ) AS versao_autorizacao
        `,
        [this.#organizationId, input.userId, input.currentSessionId],
      );
      const authorizationVersion = databaseInteger(
        version.rows[0]?.versao_autorizacao ?? Number.NaN,
      );
      await revokeAllUserSessions(client, {
        organizationId: this.#organizationId,
        userId: input.userId,
        reason: 'senha_alterada',
        exceptSessionId: input.currentSessionId,
      });
      await query(
        client,
        `
          UPDATE public.tokens_acesso
          SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
              motivo_revogacao = 'senha_alterada_rotacao'
          WHERE organizacao_id = $1 AND sessao_id = $2 AND status = 'ativo'
        `,
        [this.#organizationId, input.currentSessionId],
      );
      await query(
        client,
        `
          UPDATE public.tokens_refresh
          SET status = 'rotacionado', rotacionado_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [this.#organizationId, row.refresh_id],
      );
      const sessionWindow = await query<{
        expira_inatividade_em: Date;
        expira_absolutamente_em: Date;
      }>(
        client,
        `
          UPDATE public.sessoes_autenticacao
          SET versao_autorizacao = $3,
              ultima_renovacao_em = pg_catalog.clock_timestamp(),
              expira_inatividade_em = LEAST(
                pg_catalog.clock_timestamp() + $4::integer * interval '1 second',
                expira_absolutamente_em
              )
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
          RETURNING expira_inatividade_em, expira_absolutamente_em
        `,
        [
          this.#organizationId,
          input.currentSessionId,
          authorizationVersion,
          inactivityTtl,
        ],
      );
      await query(
        client,
        `
          INSERT INTO public.tokens_refresh (
            organizacao_id, sessao_id, token_refresh_anterior_id,
            token_hash, expira_em
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          this.#organizationId,
          input.currentSessionId,
          row.refresh_id,
          nextRefreshHash,
          row.expira_absolutamente_em,
        ],
      );
      const access = await query<{ emitido_em: Date; expira_em: Date }>(
        client,
        `
          INSERT INTO public.tokens_acesso (
            organizacao_id, sessao_id, token_hash, versao_autorizacao, expira_em
          ) VALUES (
            $1, $2, $3, $4,
            LEAST(
              pg_catalog.clock_timestamp() + $5::integer * interval '1 second',
              $6::timestamptz
            )
          )
          RETURNING emitido_em, expira_em
        `,
        [
          this.#organizationId,
          input.currentSessionId,
          nextAccessHash,
          authorizationVersion,
          accessTtl,
          row.expira_absolutamente_em,
        ],
      );
      const auditId = this.#idGenerator();
      await appendAudit(client, {
        id: auditId,
        organizationId: this.#organizationId,
        event: 'auth.senha.alterada',
        actorType: 'usuario',
        actorUserId: input.userId,
        affectedUserId: input.userId,
        resourceType: 'usuario',
        resourceId: input.userId,
        requestId: input.requestId,
        sessionId: input.currentSessionId,
        metadata: { sessao_atual_preservada: true, tokens_girados: true },
      });
      await this.#notificationWriter.create(client, {
        organizationId: this.#organizationId,
        recipientUserId: input.userId,
        eventType: 'conta.senha_alterada.v1',
        sourceKey: auditId,
        authorUserId: input.userId,
      });
      const sessionWindowRow = sessionWindow.rows[0];
      const accessRow = access.rows[0];
      if (sessionWindowRow === undefined || accessRow === undefined) {
        throw new Error('Password-change token window unavailable.');
      }
      return {
        status: 'changed' as const,
        principal: mapPrincipal({
          ...row,
          versao_autorizacao: authorizationVersion,
        }),
        issuedAt: accessRow.emitido_em,
        accessExpiresAt: accessRow.expira_em,
        inactivityExpiresAt: sessionWindowRow.expira_inatividade_em,
        absoluteExpiresAt: sessionWindowRow.expira_absolutamente_em,
      };
    });
  }

  public beginPasswordRecovery(input: PasswordRecoveryBeginInput): Promise<void> {
    const tokenHash = decodeDigest(input.tokenHash);
    const ttlSeconds = safeDurationSeconds(input.ttlSeconds);
    return inTransaction(this.#pool, async (client) => {
      const eligible = await query<{
        id: string;
        organizacao_id: string;
        email: string;
        agora: Date;
      }>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.email,
                 pg_catalog.clock_timestamp() AS agora
          FROM public.usuarios AS usuario
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE usuario.organizacao_id = $1
            AND lower(usuario.email) = lower($2)
            AND usuario.status = 'ativo'
          FOR UPDATE OF credencial
        `,
        [this.#organizationId, input.normalizedEmail],
      );
      const user = eligible.rows[0];
      if (user === undefined) return;

      const revoked = await query<{ id: string }>(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'substituido_por_nova_solicitacao'
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND finalidade = 'recuperacao_senha' AND status = 'ativo'
          RETURNING id
        `,
        [user.organizacao_id, user.id],
      );
      await cancelOutboxForChallenges(
        client,
        user.organizacao_id,
        revoked.rows.map((row) => row.id),
      );

      const challengeId = this.#idGenerator();
      const outboxId = this.#idGenerator();
      const expiresAt = new Date(user.agora.getTime() + ttlSeconds * 1_000);
      await query(
        client,
        `
          INSERT INTO public.desafios_autenticacao (
            id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
          ) VALUES ($1, $2, $3, 'recuperacao_senha', $4, $5)
        `,
        [challengeId, user.organizacao_id, user.id, tokenHash, expiresAt],
      );

      const draft = this.#recoveryOutboxFactory.action({
        id: outboxId,
        organizationId: user.organizacao_id,
        challengeId,
        to: user.email,
        subject: 'Recuperação de senha do Tchê Agro',
        introduction: 'Foi solicitada uma redefinição da senha da sua conta.',
        actionLabel: 'Definir nova senha',
        action: 'complete-password-recovery',
        actionBaseUrl: this.#recoveryActionBaseUrl,
        token: input.deliveryToken,
        availableAt: user.agora,
        expiresAt,
        maxAttempts: 5,
      });
      const emailHmac = decodeDigest(
        hmacIdentifier(normalizeEmail(user.email), this.#emailHmacKey),
      );
      await insertOutboxMessage(client, {
        draft,
        userId: user.id,
        recipientHmac: emailHmac,
        originId: challengeId,
      });
      await appendAudit(client, {
        organizationId: user.organizacao_id,
        event: 'auth.recuperacao_senha.solicitada',
        actorType: 'sistema',
        affectedUserId: user.id,
        resourceType: 'usuario',
        resourceId: user.id,
        requestId: input.requestId,
        emailHmac,
      });
    });
  }

  public isPasswordRecoveryTokenUsable(tokenHash: string): Promise<boolean> {
    const decodedTokenHash = decodeDigest(tokenHash);
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<{ usable: boolean }>(
        client,
        `
          SELECT EXISTS (
            SELECT 1
            FROM public.desafios_autenticacao AS desafio
            JOIN public.usuarios AS usuario
              ON usuario.organizacao_id = desafio.organizacao_id
             AND usuario.id = desafio.usuario_id
             AND usuario.status = 'ativo'
            JOIN public.credenciais_usuario AS credencial
              ON credencial.organizacao_id = usuario.organizacao_id
             AND credencial.usuario_id = usuario.id
             AND credencial.status = 'ativa'
            WHERE desafio.organizacao_id = $1
              AND desafio.token_hash = $2
              AND desafio.finalidade = 'recuperacao_senha'
              AND desafio.status = 'ativo'
              AND desafio.expira_em > pg_catalog.clock_timestamp()
          ) AS usable
        `,
        [this.#organizationId, decodedTokenHash],
      );
      return result.rows[0]?.usable === true;
    });
  }

  public completePasswordRecovery(input: {
    readonly tokenHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
    readonly requestId: string;
  }): Promise<boolean> {
    const tokenHash = decodeDigest(input.tokenHash);
    return inTransaction(this.#pool, async (client) => {
      const locked = await query<{
        desafio_id: string;
        desafio_status: string;
        expira_em: Date;
        usuario_id: string;
        organizacao_id: string;
        usuario_status: UserStatus;
        credencial_id: string;
        agora: Date;
      }>(
        client,
        `
          SELECT desafio.id AS desafio_id, desafio.status AS desafio_status,
                 desafio.expira_em, usuario.id AS usuario_id,
                 usuario.organizacao_id, usuario.status AS usuario_status,
                 credencial.id AS credencial_id,
                 pg_catalog.clock_timestamp() AS agora
          FROM public.desafios_autenticacao AS desafio
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = desafio.organizacao_id
           AND usuario.id = desafio.usuario_id
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE desafio.token_hash = $1
            AND desafio.organizacao_id = $2
            AND desafio.finalidade = 'recuperacao_senha'
          FOR UPDATE OF desafio, credencial
        `,
        [tokenHash, this.#organizationId],
      );
      const row = locked.rows[0];
      if (row === undefined) return false;
      if (
        row.desafio_status !== 'ativo' ||
        row.usuario_status !== 'ativo' ||
        row.expira_em <= row.agora
      ) {
        if (row.desafio_status === 'ativo' && row.expira_em <= row.agora) {
          await query(
            client,
            `
              UPDATE public.desafios_autenticacao
              SET status = 'expirado', revogado_em = pg_catalog.clock_timestamp(),
                  motivo_encerramento = 'prazo_expirado'
              WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
            `,
            [row.organizacao_id, row.desafio_id],
          );
        }
        return false;
      }

      await query(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'consumido', consumido_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.desafio_id],
      );
      await query(
        client,
        `
          UPDATE public.credenciais_usuario
          SET senha_phc = $3, versao_politica_senha = $4,
              senha_definida_em = pg_catalog.clock_timestamp(),
              ultimo_rehash_em = NULL
          WHERE organizacao_id = $1 AND id = $2
        `,
        [
          row.organizacao_id,
          row.credencial_id,
          input.replacementPasswordHash,
          input.policyVersion,
        ],
      );
      await query(
        client,
        'SELECT public.tche_conta_concluir_recuperacao_senha_mp35b($1)',
        [row.desafio_id],
      );
      await revokeAllUserSessions(client, {
        organizationId: row.organizacao_id,
        userId: row.usuario_id,
        reason: 'recuperacao_senha_concluida',
      });

      const revokedChallenges = await query<{ id: string }>(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'recuperacao_senha_concluida'
          WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativo'
          RETURNING id
        `,
        [row.organizacao_id, row.usuario_id],
      );
      await cancelOutboxForChallenges(
        client,
        row.organizacao_id,
        revokedChallenges.rows.map((candidate) => candidate.id),
      );
      await query(
        client,
        `
          UPDATE public.autorizacoes_restritas
          SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'recuperacao_senha_concluida'
          WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativa'
        `,
        [row.organizacao_id, row.usuario_id],
      );
      await query(
        client,
        `
          UPDATE public.convites_usuario
          SET status = 'revogado', encerrado_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'recuperacao_senha_concluida'
          WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'pendente'
        `,
        [row.organizacao_id, row.usuario_id],
      );
      const auditId = this.#idGenerator();
      await appendAudit(client, {
        id: auditId,
        organizationId: row.organizacao_id,
        event: 'auth.recuperacao_senha.concluida',
        actorType: 'sistema',
        affectedUserId: row.usuario_id,
        resourceType: 'usuario',
        resourceId: row.usuario_id,
        requestId: input.requestId,
        metadata: { login_automatico: false },
      });
      await this.#notificationWriter.create(client, {
        organizationId: row.organizacao_id,
        recipientUserId: row.usuario_id,
        eventType: 'conta.recuperacao_concluida.v1',
        sourceKey: auditId,
      });
      return true;
    });
  }
}
