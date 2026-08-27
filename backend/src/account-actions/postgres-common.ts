import type { PoolClient, QueryResultRow } from 'pg';

import {
  inTransaction,
  query,
  safeDatabaseRead,
  safeRequestId,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import { insertRuntimeAudit } from '../audit/postgres-runtime-audit.js';
import type { EncryptedOutboxMessageDraft } from '../outbox/contracts.js';
import type {
  AccountNotificationDraft,
  AccountNotificationWriter,
} from '../notifications/contracts.js';
import { PostgresAccountNotificationWriter } from '../notifications/postgres-account-notification-writer.js';
import { serviceUnavailable } from '../security/http-error.js';
import { hmacIdentifier } from '../security/tokens.js';
import type {
  AccountProfile,
  AccountSnapshot,
  AccountStatus,
  ActionChallengeDraft,
  AuditEventDraft,
  RestrictedAuthorizationDraft,
} from './contracts.js';

export interface PostgresAccountActionOptions {
  readonly pool: AuthPostgresPool;
  /** Dedicated key for e-mail correlation and outbox recipient pseudonyms. */
  readonly emailHmacKey: Uint8Array;
  /** Independent key for operational/external case references. */
  readonly externalReferenceHmacKey: Uint8Array;
  readonly notificationWriter?: AccountNotificationWriter;
}

export interface AccountRow extends QueryResultRow {
  readonly id: string;
  readonly organizacao_id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: AccountProfile;
  readonly status: AccountStatus;
  readonly version: string;
}

export type OutboxOriginType =
  | 'convite'
  | 'desafio'
  | 'alteracao_email'
  | 'recuperacao_assistida'
  | 'recuperacao_admin_secundario'
  | 'evento_seguranca';

function requireKey(value: Uint8Array, name: string): Uint8Array {
  if (value.byteLength < 32) {
    throw new TypeError(`${name} must contain at least 32 bytes.`);
  }
  return Uint8Array.from(value);
}

export function accountSnapshot(row: AccountRow): AccountSnapshot {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    name: row.nome,
    normalizedEmail: row.email,
    profile: row.perfil,
    status: row.status,
    version: row.version,
  };
}

export function decodeSha256Hex(value: string): Buffer {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw serviceUnavailable();
  const decoded = Buffer.from(value, 'hex');
  if (decoded.byteLength !== 32 || decoded.toString('hex') !== value) {
    throw serviceUnavailable();
  }
  return decoded;
}

function decodeBase64url(value: string, expectedBytes?: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw serviceUnavailable();
  const decoded = Buffer.from(value, 'base64url');
  if (
    decoded.toString('base64url') !== value ||
    (expectedBytes !== undefined && decoded.byteLength !== expectedBytes)
  ) {
    throw serviceUnavailable();
  }
  return decoded;
}

function challengePurpose(
  purpose: ActionChallengeDraft['purpose'],
): string {
  switch (purpose) {
    case 'invitation':
      return 'convite';
    case 'primary_email_change_current':
      return 'confirmacao_email_atual';
    case 'primary_email_change_new':
      return 'confirmacao_email_novo';
    case 'secondary_email_verification':
      return 'confirmacao_email_recuperacao';
    case 'assisted_recovery_email':
    case 'admin_break_glass_email':
      return 'recuperacao_assistida';
    case 'admin_secondary_recovery_secondary':
      return 'recuperacao_admin_secundario';
    case 'admin_secondary_recovery_new_primary':
      return 'recuperacao_admin_email_novo';
  }
}

function restrictedPurpose(input: RestrictedAuthorizationDraft): {
  readonly purpose: string;
  readonly originType: string;
} {
  switch (input.purpose) {
    case 'assisted_recovery':
    case 'admin_break_glass':
      return {
        purpose: 'concluir_recuperacao_assistida',
        originType: 'recuperacao_assistida',
      };
    case 'admin_secondary_recovery':
      return {
        purpose: 'concluir_recuperacao_admin_secundario',
        originType: 'recuperacao_admin_secundario',
      };
  }
}

function auditResult(
  value: AuditEventDraft['result'],
): 'sucesso' | 'negado' | 'falha' {
  switch (value) {
    case 'success':
      return 'sucesso';
    case 'denied':
      return 'negado';
    case 'failure':
      return 'falha';
  }
}

function safeAuditRequestId(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) return null;
  return safeRequestId(value);
}

function safeCategory(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!/^[a-z][a-z0-9_]{2,63}$/u.test(value)) throw serviceUnavailable();
  return value;
}

export class AccountActionPostgresStore {
  readonly #pool: AuthPostgresPool;
  readonly #emailHmacKey: Uint8Array;
  readonly #externalReferenceHmacKey: Uint8Array;
  readonly #notificationWriter: AccountNotificationWriter;

  public constructor(options: PostgresAccountActionOptions) {
    this.#pool = options.pool;
    this.#emailHmacKey = requireKey(options.emailHmacKey, 'emailHmacKey');
    this.#externalReferenceHmacKey = requireKey(
      options.externalReferenceHmacKey,
      'externalReferenceHmacKey',
    );
    this.#notificationWriter =
      options.notificationWriter ?? new PostgresAccountNotificationWriter();
  }

  public read<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return safeDatabaseRead(this.#pool, operation);
  }

  public transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return inTransaction(this.#pool, operation);
  }

  public async lockOrganization(
    client: PoolClient,
    organizationId: string,
  ): Promise<boolean> {
    const locked = await query<{ id: string }>(
      client,
      `
        SELECT id
        FROM public.organizacoes
        WHERE id = $1 AND status = 'ativa'
        FOR UPDATE
      `,
      [organizationId],
    );
    return locked.rowCount === 1;
  }

  public emailHmac(email: string): Buffer {
    return decodeBase64url(hmacIdentifier(email, this.#emailHmacKey), 32);
  }

  public externalReferenceHmac(reference: string): Buffer {
    return decodeBase64url(
      hmacIdentifier(reference, this.#externalReferenceHmacKey),
      32,
    );
  }

  public async isEmailAvailable(
    client: PoolClient,
    input: {
      readonly organizationId: string;
      readonly normalizedEmail: string;
      readonly excludeUserId?: string;
      readonly excludeEmailChangeId?: string;
      readonly excludeAssistedRecoveryId?: string;
      readonly excludeAdminSecondaryRecoveryId?: string;
      readonly excludeContactId?: string;
    },
  ): Promise<boolean> {
    const result = await query<{ reserved: boolean }>(
      client,
      `
        SELECT EXISTS (
          SELECT 1 FROM public.usuarios AS usuario
          WHERE usuario.organizacao_id = $1
            AND lower(usuario.email) = lower($2)
            AND ($3::uuid IS NULL OR usuario.id <> $3::uuid)
          UNION ALL
          SELECT 1 FROM public.contatos_email_usuario AS contato
          WHERE contato.organizacao_id = $1
            AND lower(contato.email) = lower($2)
            AND contato.status IN ('pendente', 'verificado')
            AND ($7::uuid IS NULL OR contato.id <> $7::uuid)
          UNION ALL
          SELECT 1 FROM public.solicitacoes_alteracao_email AS solicitacao
          WHERE solicitacao.organizacao_id = $1
            AND lower(solicitacao.email_novo) = lower($2)
            AND solicitacao.status IN (
              'aguardando_confirmacao_atual', 'aguardando_confirmacao_novo'
            )
            AND ($4::uuid IS NULL OR solicitacao.id <> $4::uuid)
          UNION ALL
          SELECT 1 FROM public.recuperacoes_assistidas AS recuperacao
          WHERE recuperacao.organizacao_id = $1
            AND lower(recuperacao.novo_email) = lower($2)
            AND recuperacao.status IN (
              'solicitada', 'em_validacao', 'aguardando_confirmacao_email',
              'aguardando_nova_senha'
            )
            AND ($5::uuid IS NULL OR recuperacao.id <> $5::uuid)
          UNION ALL
          SELECT 1
          FROM public.recuperacoes_admin_email_secundario AS recuperacao_admin
          WHERE recuperacao_admin.organizacao_id = $1
            AND lower(recuperacao_admin.novo_email) = lower($2)
            AND recuperacao_admin.status IN (
              'aguardando_confirmacao_secundario',
              'aguardando_confirmacao_email_novo',
              'aguardando_nova_senha'
            )
            AND ($6::uuid IS NULL OR recuperacao_admin.id <> $6::uuid)
        ) AS reserved
      `,
      [
        input.organizationId,
        input.normalizedEmail,
        input.excludeUserId ?? null,
        input.excludeEmailChangeId ?? null,
        input.excludeAssistedRecoveryId ?? null,
        input.excludeAdminSecondaryRecoveryId ?? null,
        input.excludeContactId ?? null,
      ],
    );
    return result.rows[0]?.reserved === false;
  }

  public async insertChallenge(
    client: PoolClient,
    draft: ActionChallengeDraft,
  ): Promise<void> {
    await query(
      client,
      `
        INSERT INTO public.desafios_autenticacao (
          id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        draft.id,
        draft.organizationId,
        draft.userId,
        challengePurpose(draft.purpose),
        decodeSha256Hex(draft.tokenSha256),
        draft.expiresAt,
      ],
    );
  }

  public async insertRestrictedAuthorization(
    client: PoolClient,
    draft: RestrictedAuthorizationDraft,
  ): Promise<void> {
    const mapped = restrictedPurpose(draft);
    await query(
      client,
      `
        INSERT INTO public.autorizacoes_restritas (
          id, organizacao_id, usuario_id, finalidade, origem_tipo, origem_id,
          token_hash, expira_em
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        draft.id,
        draft.organizationId,
        draft.userId,
        mapped.purpose,
        mapped.originType,
        draft.recoveryId,
        decodeSha256Hex(draft.tokenSha256),
        draft.expiresAt,
      ],
    );
  }

  public async insertOutbox(
    client: PoolClient,
    input: {
      readonly draft: EncryptedOutboxMessageDraft;
      readonly recipientEmail: string;
      readonly userId?: string;
      readonly originType: OutboxOriginType;
      readonly originId: string;
    },
  ): Promise<void> {
    const payload = input.draft.payload;
    if (payload.version !== 1 || payload.algorithm !== 'aes-256-gcm') {
      throw serviceUnavailable();
    }
    await query(
      client,
      `
        INSERT INTO public.outbox_email (
          id, organizacao_id, usuario_id, desafio_id, tipo_mensagem,
          origem_tipo, origem_id, destinatario_hmac, payload_cifrado,
          chave_id, nonce, tag_autenticacao, contexto_autenticado,
          maximo_tentativas, disponivel_em, expira_em
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13::jsonb, $14, $15, $16
        )
      `,
      [
        input.draft.id,
        input.draft.organizationId,
        input.userId ?? null,
        input.draft.challengeId ?? null,
        input.draft.messageType,
        input.originType,
        input.originId,
        this.emailHmac(input.recipientEmail),
        decodeBase64url(payload.ciphertext),
        payload.keyId,
        decodeBase64url(payload.iv),
        decodeBase64url(payload.authenticationTag, 16),
        JSON.stringify({
          version: payload.version,
          algorithm: payload.algorithm,
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

  public async insertAudit(
    client: PoolClient,
    draft: AuditEventDraft,
    actorType?: 'usuario' | 'sistema' | 'plataforma',
  ): Promise<void> {
    const resolvedActorType =
      actorType ??
      (draft.actorUserId !== undefined
        ? 'usuario'
        : draft.eventType.includes('break_glass')
          ? 'plataforma'
          : 'sistema');
    if (actorType === 'plataforma') {
      await query(
        client,
        `
          INSERT INTO public.eventos_auditoria (
            id, organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
            sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
            motivo_categoria, referencia_externa_hmac, request_id, metadados,
            ocorrido_em
          ) VALUES (
            $1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, $9, $10, $11,
            $12::jsonb, $13
          )
        `,
        [
          draft.id,
          draft.organizationId,
          draft.eventType,
          auditResult(draft.result),
          resolvedActorType,
          draft.affectedUserId ?? null,
          draft.resourceType ?? null,
          draft.resourceId ?? null,
          safeCategory(draft.reasonCode),
          draft.externalCaseReference === undefined
            ? null
            : this.externalReferenceHmac(draft.externalCaseReference),
          safeAuditRequestId(draft.requestId),
          JSON.stringify(draft.metadata ?? {}),
          draft.occurredAt,
        ],
      );
      return;
    }
    if (draft.resourceType === undefined || draft.resourceId === undefined) {
      throw new Error('Runtime audit requires a server-defined resource.');
    }
    const reasonCategory = safeCategory(draft.reasonCode);
    const requestId = safeAuditRequestId(draft.requestId);
    await insertRuntimeAudit(client, {
      id: draft.id,
      organizationId: draft.organizationId,
      event: draft.eventType,
      result: auditResult(draft.result),
      actorType: resolvedActorType,
      ...(resolvedActorType === 'usuario' && draft.actorUserId !== undefined
        ? { actorUserId: draft.actorUserId }
        : {}),
      ...(resolvedActorType === 'usuario' && draft.actorSessionId !== undefined
        ? { sessionId: draft.actorSessionId }
        : {}),
      ...(draft.affectedUserId === undefined
        ? {}
        : { affectedUserId: draft.affectedUserId }),
      resourceType: draft.resourceType,
      resourceId: draft.resourceId,
      ...(reasonCategory === null ? {} : { reasonCategory }),
      ...(draft.externalCaseReference === undefined
        ? {}
        : {
            externalReferenceHmac: this.externalReferenceHmac(
              draft.externalCaseReference,
            ),
          }),
      ...(requestId === null ? {} : { requestId }),
      metadata: draft.metadata ?? {},
      occurredAt: draft.occurredAt,
    });
  }

  public insertAccountNotification(
    client: PoolClient,
    draft: AccountNotificationDraft,
  ): Promise<void> {
    return this.#notificationWriter.create(client, draft);
  }

  public async cancelOutboxForChallenges(
    client: PoolClient,
    organizationId: string,
    challengeIds: readonly string[],
    reason = 'challenge_revoked',
  ): Promise<void> {
    if (challengeIds.length === 0) return;
    await query(
      client,
      `
        UPDATE public.outbox_email
        SET status = 'cancelado', payload_cifrado = NULL,
            nonce = NULL, tag_autenticacao = NULL, bloqueado_em = NULL,
            bloqueado_por = NULL, lease_token = NULL,
            lease_expira_em = NULL, encerrado_em = pg_catalog.clock_timestamp(),
            erro_categoria = $3
        WHERE organizacao_id = $1 AND desafio_id = ANY($2::uuid[])
          AND status IN ('pendente', 'processando')
      `,
      [organizationId, [...challengeIds], safeCategory(reason)],
    );
  }

  public async revokeActiveChallenges(
    client: PoolClient,
    input: {
      readonly organizationId: string;
      readonly userId: string;
      readonly purposes?: readonly string[];
      readonly reason: string;
    },
  ): Promise<readonly string[]> {
    const revoked = await query<{ id: string }>(
      client,
      `
        UPDATE public.desafios_autenticacao
        SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $4
        WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativo'
          AND ($3::text[] IS NULL OR finalidade = ANY($3::text[]))
        RETURNING id
      `,
      [
        input.organizationId,
        input.userId,
        input.purposes === undefined ? null : [...input.purposes],
        input.reason,
      ],
    );
    const ids = revoked.rows.map((row) => row.id);
    await this.cancelOutboxForChallenges(
      client,
      input.organizationId,
      ids,
    );
    return ids;
  }

  public async revokeAllUserSecurityState(
    client: PoolClient,
    input: {
      readonly organizationId: string;
      readonly userId: string;
      readonly reason: string;
    },
  ): Promise<void> {
    await query(
      client,
      `
        UPDATE public.tokens_acesso AS token
        SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
            motivo_revogacao = $3
        FROM public.sessoes_autenticacao AS sessao
        WHERE token.organizacao_id = $1
          AND token.organizacao_id = sessao.organizacao_id
          AND token.sessao_id = sessao.id
          AND sessao.usuario_id = $2 AND token.status = 'ativo'
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await query(
      client,
      `
        UPDATE public.tokens_refresh AS token
        SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
            motivo_revogacao = $3
        FROM public.sessoes_autenticacao AS sessao
        WHERE token.organizacao_id = $1
          AND token.organizacao_id = sessao.organizacao_id
          AND token.sessao_id = sessao.id
          AND sessao.usuario_id = $2 AND token.status = 'ativo'
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await query(
      client,
      `
        UPDATE public.sessoes_autenticacao
        SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
            motivo_revogacao = $3
        WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativa'
      `,
      [input.organizationId, input.userId, input.reason],
    );

    await query(
      client,
      `
        UPDATE public.solicitacoes_alteracao_email
        SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $3
        WHERE organizacao_id = $1 AND usuario_id = $2
          AND status IN ('aguardando_confirmacao_atual', 'aguardando_confirmacao_novo')
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await query(
      client,
      `
        UPDATE public.recuperacoes_assistidas
        SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $3
        WHERE organizacao_id = $1 AND usuario_id = $2
          AND origem = 'admin_http'
          AND status IN (
            'solicitada', 'em_validacao', 'aguardando_confirmacao_email',
            'aguardando_nova_senha'
          )
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await query(
      client,
      `
        UPDATE public.recuperacoes_admin_email_secundario
        SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $3
        WHERE organizacao_id = $1 AND usuario_admin_id = $2
          AND status IN (
            'aguardando_confirmacao_secundario',
            'aguardando_confirmacao_email_novo', 'aguardando_nova_senha'
          )
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await query(
      client,
      `
        UPDATE public.convites_usuario
        SET status = 'revogado', encerrado_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $3
        WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'pendente'
      `,
      [input.organizationId, input.userId, input.reason],
    );
    await this.revokeActiveChallenges(client, input);
    await query(
      client,
      `
        UPDATE public.autorizacoes_restritas
        SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
            motivo_encerramento = $3
        WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativa'
      `,
      [input.organizationId, input.userId, input.reason],
    );
  }
}
