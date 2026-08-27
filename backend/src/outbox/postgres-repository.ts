import type { PoolClient, QueryResultRow } from 'pg';

import {
  inTransaction,
  query,
  safeDatabaseRead,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import { serviceUnavailable } from '../security/http-error.js';
import type {
  ClaimedOutboxMessage,
  ClaimReadyOutboxInput,
  EncryptedOutboxPayload,
  OutboxRepository,
} from './contracts.js';

interface ClaimedRow extends QueryResultRow {
  readonly id: string;
  readonly organizacao_id: string;
  readonly usuario_id: string | null;
  readonly desafio_id: string | null;
  readonly tipo_mensagem: string;
  readonly payload_cifrado: Buffer;
  readonly chave_id: string;
  readonly nonce: Buffer;
  readonly tag_autenticacao: Buffer;
  readonly contexto_autenticado: unknown;
  readonly tentativas: number;
  readonly maximo_tentativas: number;
  readonly expira_em: Date;
  readonly lease_token: string;
}

interface TerminalizedRow extends QueryResultRow {
  readonly organizacao_id: string;
  readonly usuario_id: string | null;
}

interface LockedDispatchRow extends TerminalizedRow {
  readonly desafio_id: string | null;
  readonly origem_tipo: string | null;
  readonly origem_id: string | null;
  readonly status: string;
  readonly tentativas: number;
  readonly maximo_tentativas: number;
  readonly lease_expira_em: Date | null;
  readonly expira_em: Date;
  readonly desafio_status: string | null;
  readonly desafio_expira_em: Date | null;
  readonly convite_id: string | null;
  readonly convite_status: string | null;
  readonly convite_expira_em: Date | null;
}

interface DatabaseClockRow extends QueryResultRow {
  readonly agora: Date;
}

function safeWorkerId(value: string): string {
  if (!/^[A-Za-z0-9_.:-]{1,128}$/u.test(value)) throw serviceUnavailable();
  return value;
}

function safeBatchLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 500) {
    throw serviceUnavailable();
  }
  return value;
}

function safeCode(value: string): string {
  if (!/^[a-z][a-z0-9_]{2,63}$/u.test(value)) throw serviceUnavailable();
  return value;
}

function safeProviderMessageId(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 500) throw serviceUnavailable();
  return trimmed;
}

function bufferToBase64url(value: unknown, expectedBytes?: number): string {
  if (!Buffer.isBuffer(value)) throw serviceUnavailable();
  if (expectedBytes !== undefined && value.byteLength !== expectedBytes) {
    throw serviceUnavailable();
  }
  return value.toString('base64url');
}

function payloadFromRow(row: ClaimedRow): EncryptedOutboxPayload {
  const context = row.contexto_autenticado;
  if (
    context === null ||
    typeof context !== 'object' ||
    Array.isArray(context) ||
    (context as Record<string, unknown>).version !== 1 ||
    (context as Record<string, unknown>).algorithm !== 'aes-256-gcm'
  ) {
    throw serviceUnavailable();
  }
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    keyId: row.chave_id,
    iv: bufferToBase64url(row.nonce),
    ciphertext: bufferToBase64url(row.payload_cifrado),
    authenticationTag: bufferToBase64url(row.tag_autenticacao, 16),
  };
}

function claimedMessage(row: ClaimedRow): ClaimedOutboxMessage {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    ...(row.usuario_id === null ? {} : { userId: row.usuario_id }),
    messageType: row.tipo_mensagem,
    ...(row.desafio_id === null ? {} : { challengeId: row.desafio_id }),
    payload: payloadFromRow(row),
    attempt: row.tentativas,
    maxAttempts: row.maximo_tentativas,
    expiresAt: row.expira_em,
    leaseToken: row.lease_token,
  };
}

async function insertWorkerAudit(
  client: PoolClient,
  input: {
    readonly row: TerminalizedRow;
    readonly event: string;
    readonly result: 'sucesso' | 'falha';
    readonly messageId: string;
    readonly occurredAt: Date;
    readonly reasonCode?: string;
  },
): Promise<void> {
  await query(
    client,
    `
      INSERT INTO public.eventos_auditoria (
        organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
        usuario_afetado_id, recurso_tipo, recurso_id, motivo_categoria,
        metadados, ocorrido_em
      ) VALUES (
        $1, $2, $3, 'sistema', NULL, $4, 'outbox_email', $5, $6, '{}'::jsonb, $7
      )
    `,
    [
      input.row.organizacao_id,
      input.event,
      input.result,
      input.row.usuario_id,
      input.messageId,
      input.reasonCode ?? null,
      input.occurredAt,
    ],
  );
}

export interface PostgresOutboxRepositoryOptions {
  readonly pool: AuthPostgresPool;
}

/** PostgreSQL implementation with SKIP LOCKED leases and terminal payload wipe. */
export class PostgresOutboxRepository implements OutboxRepository {
  readonly #pool: AuthPostgresPool;

  public constructor(options: PostgresOutboxRepositoryOptions) {
    this.#pool = options.pool;
  }

  public claimReady(
    input: ClaimReadyOutboxInput,
  ): Promise<readonly ClaimedOutboxMessage[]> {
    const workerId = safeWorkerId(input.workerId);
    const limit = safeBatchLimit(input.limit);
    if (input.leaseExpiresAt.getTime() <= input.now.getTime()) {
      throw serviceUnavailable();
    }

    return inTransaction(this.#pool, async (client) => {
      await query(
        client,
        `
          UPDATE public.outbox_email
          SET status = 'expirado', payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, bloqueado_em = NULL,
              bloqueado_por = NULL, lease_token = NULL, lease_expira_em = NULL,
              encerrado_em = $1, erro_categoria = 'message_expired'
          WHERE expira_em <= $1
            AND (
              status = 'pendente'
              OR (status = 'processando' AND lease_expira_em <= $1)
            )
        `,
        [input.now],
      );
      await query(
        client,
        `
          UPDATE public.outbox_email
          SET status = 'falhou', payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, bloqueado_em = NULL,
              bloqueado_por = NULL, lease_token = NULL, lease_expira_em = NULL,
              encerrado_em = $1, erro_categoria = 'delivery_attempts_exhausted'
          WHERE status = 'processando' AND lease_expira_em <= $1
            AND tentativas >= maximo_tentativas
        `,
        [input.now],
      );
      const claimed = await query<ClaimedRow>(
        client,
        `
          WITH candidatos AS (
            SELECT id
            FROM public.outbox_email
            WHERE expira_em > $1 AND tentativas < maximo_tentativas
              AND (
                (status = 'pendente' AND disponivel_em <= $1)
                OR (status = 'processando' AND lease_expira_em <= $1)
              )
            ORDER BY disponivel_em, criado_em, id
            FOR UPDATE SKIP LOCKED
            LIMIT $2
          )
          UPDATE public.outbox_email AS mensagem
          SET status = 'processando', tentativas = mensagem.tentativas + 1,
              bloqueado_em = $1, bloqueado_por = $3,
              lease_token = pg_catalog.gen_random_uuid(), lease_expira_em = $4,
              erro_categoria = NULL
          FROM candidatos
          WHERE mensagem.id = candidatos.id
          RETURNING mensagem.id, mensagem.organizacao_id,
                    mensagem.usuario_id, mensagem.desafio_id, mensagem.tipo_mensagem,
                    mensagem.payload_cifrado, mensagem.chave_id,
                    mensagem.nonce, mensagem.tag_autenticacao,
                    mensagem.contexto_autenticado, mensagem.tentativas,
                    mensagem.maximo_tentativas, mensagem.expira_em,
                    mensagem.lease_token
        `,
        [input.now, limit, workerId, input.leaseExpiresAt],
      );
      return claimed.rows.map(claimedMessage);
    });
  }

  public dispatchUnderEntityLock(input: {
    readonly message: ClaimedOutboxMessage;
    readonly dispatch: () => Promise<import('./contracts.js').OutboxDispatchDecision>;
  }): Promise<import('./contracts.js').CoordinatedOutboxDispatchResult> {
    return inTransaction(this.#pool, async (client) => {
      if (
        input.message.challengeId !== undefined
        && input.message.userId !== undefined
      ) {
        await query(
          client,
          `SELECT pg_catalog.pg_advisory_xact_lock(
             pg_catalog.hashtextextended($1 || ':' || $2, 35000035)
           )`,
          [input.message.organizationId, input.message.userId],
        );
      }

      const locked = await query<LockedDispatchRow>(
        client,
        `
          SELECT mensagem.organizacao_id, mensagem.usuario_id,
                 mensagem.desafio_id, mensagem.origem_tipo, mensagem.origem_id,
                 mensagem.status, mensagem.tentativas,
                 mensagem.maximo_tentativas,
                 mensagem.lease_expira_em, mensagem.expira_em,
                 estado.desafio_status, estado.desafio_expira_em,
                 estado.convite_id, estado.convite_status,
                 estado.convite_expira_em
          FROM public.outbox_email AS mensagem
          LEFT JOIN public.estados_outbox_conta_mp35b AS estado
            ON estado.organizacao_id = mensagem.organizacao_id
           AND estado.desafio_id = mensagem.desafio_id
          WHERE mensagem.id = $1 AND mensagem.lease_token = $2
          FOR UPDATE OF mensagem
        `,
        [input.message.id, input.message.leaseToken],
      );
      const row = locked.rows[0];
      if (
        row === undefined
        || row.organizacao_id !== input.message.organizationId
        || row.usuario_id !== (input.message.userId ?? null)
        || row.desafio_id !== (input.message.challengeId ?? null)
        || row.status !== 'processando'
        || row.lease_expira_em === null
      ) {
        return 'stale';
      }

      // Este instante é deliberadamente obtido do PostgreSQL somente depois
      // que advisory lock e row lock foram adquiridos. Nunca usa o horário
      // capturado antes da espera como referência de validade persistente.
      const clock = await query<DatabaseClockRow>(
        client,
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const now = clock.rows[0]?.agora;
      if (now === undefined) throw serviceUnavailable();

      const terminalize = async (inputStatus: {
        readonly status: 'cancelado' | 'expirado' | 'falhou';
        readonly reasonCode: string;
      }): Promise<'cancelled' | 'failed'> => {
        await query(
          client,
          `
            UPDATE public.outbox_email
            SET status = $4, payload_cifrado = NULL, nonce = NULL,
                tag_autenticacao = NULL, bloqueado_em = NULL,
                bloqueado_por = NULL, lease_token = NULL,
                lease_expira_em = NULL, encerrado_em = $3,
                erro_categoria = $5
            WHERE id = $1 AND lease_token = $2 AND status = 'processando'
          `,
          [
            input.message.id,
            input.message.leaseToken,
            now,
            inputStatus.status,
            inputStatus.reasonCode,
          ],
        );
        // The frozen MP-33B audit trigger accepts only delivered, cancelled and
        // failed worker events. Expiration has always been represented solely
        // by the terminal outbox row, including claimReady's expiry sweep.
        if (inputStatus.status !== 'expirado') {
          await insertWorkerAudit(client, {
            row,
            event: inputStatus.status === 'falhou'
              ? 'auth.email.falhou'
              : 'auth.email.cancelado',
            result: 'falha',
            messageId: input.message.id,
            occurredAt: now,
            reasonCode: inputStatus.reasonCode,
          });
        }
        return inputStatus.status === 'falhou' ? 'failed' : 'cancelled';
      };

      if (row.expira_em <= now) {
        return terminalize({
          status: 'expirado',
          reasonCode: 'message_expired',
        });
      }

      if (
        row.desafio_id !== null
        && (
          row.desafio_status !== 'ativo'
          || row.desafio_expira_em === null
          || row.desafio_expira_em <= now
        )
      ) {
        return terminalize({
          status: 'cancelado',
          reasonCode: 'challenge_inactive',
        });
      }

      if (
        row.origem_tipo === 'convite'
        && (
          row.convite_id === null
          || row.convite_id !== row.origem_id
          || row.convite_status !== 'pendente'
          || row.convite_expira_em === null
          || row.convite_expira_em <= now
        )
      ) {
        return terminalize({
          status: 'cancelado',
          reasonCode: 'invitation_inactive',
        });
      }

      if (row.lease_expira_em <= now) {
        if (row.tentativas >= row.maximo_tentativas) {
          return terminalize({
            status: 'falhou',
            reasonCode: 'delivery_attempts_exhausted',
          });
        }
        await query(
          client,
          `
            UPDATE public.outbox_email
            SET status = 'pendente', disponivel_em = $3,
                bloqueado_em = NULL, bloqueado_por = NULL,
                lease_token = NULL, lease_expira_em = NULL,
                erro_categoria = 'delivery_lease_expired'
            WHERE id = $1 AND lease_token = $2 AND status = 'processando'
          `,
          [input.message.id, input.message.leaseToken, now],
        );
        return 'stale';
      }

      const decision = await input.dispatch();
      if (decision.status === 'delivered') {
        const providerMessageId = safeProviderMessageId(decision.providerMessageId);
        await query(
          client,
          `
            UPDATE public.outbox_email
            SET status = 'enviado', payload_cifrado = NULL, nonce = NULL,
                tag_autenticacao = NULL, bloqueado_em = NULL,
                bloqueado_por = NULL, lease_token = NULL,
                lease_expira_em = NULL, enviado_em = $3, encerrado_em = $3,
                provedor_mensagem_id = $4, erro_categoria = NULL
            WHERE id = $1 AND lease_token = $2 AND status = 'processando'
          `,
          [input.message.id, input.message.leaseToken, decision.occurredAt, providerMessageId],
        );
        await insertWorkerAudit(client, {
          row,
          event: 'auth.email.enviado',
          result: 'sucesso',
          messageId: input.message.id,
          occurredAt: decision.occurredAt,
        });
        return 'delivered';
      }

      const errorCode = safeCode(decision.errorCode);
      if (decision.status === 'retried') {
        if (
          decision.nextAttemptAt <= decision.occurredAt
          || decision.nextAttemptAt >= row.expira_em
        ) {
          throw serviceUnavailable();
        }
        await query(
          client,
          `
            UPDATE public.outbox_email
            SET status = 'pendente', disponivel_em = $3,
                bloqueado_em = NULL, bloqueado_por = NULL,
                lease_token = NULL, lease_expira_em = NULL,
                erro_categoria = $4
            WHERE id = $1 AND lease_token = $2 AND status = 'processando'
          `,
          [input.message.id, input.message.leaseToken, decision.nextAttemptAt, errorCode],
        );
        return 'retried';
      }

      await query(
        client,
        `
          UPDATE public.outbox_email
          SET status = 'falhou', payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, bloqueado_em = NULL,
              bloqueado_por = NULL, lease_token = NULL,
              lease_expira_em = NULL, encerrado_em = $3, erro_categoria = $4
          WHERE id = $1 AND lease_token = $2 AND status = 'processando'
        `,
        [input.message.id, input.message.leaseToken, decision.occurredAt, errorCode],
      );
      await insertWorkerAudit(client, {
        row,
        event: 'auth.email.falhou',
        result: 'falha',
        messageId: input.message.id,
        occurredAt: decision.occurredAt,
        reasonCode: errorCode,
      });
      return 'failed';
    });
  }

  public isChallengeActive(input: {
    readonly organizationId: string;
    readonly challengeId: string;
    readonly now: Date;
  }): Promise<boolean> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const active = await query<{ active: boolean }>(
        client,
        `
          SELECT EXISTS (
            SELECT 1 FROM public.desafios_outbox_ativos
            WHERE organizacao_id = $1 AND id = $2
              AND status = 'ativo' AND expira_em > $3
          ) AS active
        `,
        [input.organizationId, input.challengeId, input.now],
      );
      return active.rows[0]?.active === true;
    });
  }

  public markDelivered(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly deliveredAt: Date;
    readonly providerMessageId?: string;
  }): Promise<boolean> {
    const providerMessageId = safeProviderMessageId(input.providerMessageId);
    return inTransaction(this.#pool, async (client) => {
      const updated = await query<TerminalizedRow>(
        client,
        `
          UPDATE public.outbox_email
          SET status = 'enviado', payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, bloqueado_em = NULL,
              bloqueado_por = NULL, lease_token = NULL, lease_expira_em = NULL,
              enviado_em = $3, encerrado_em = $3, provedor_mensagem_id = $4,
              erro_categoria = NULL
          WHERE id = $1 AND lease_token = $2 AND status = 'processando'
            AND lease_expira_em > $3
          RETURNING organizacao_id, usuario_id
        `,
        [input.messageId, input.leaseToken, input.deliveredAt, providerMessageId],
      );
      const row = updated.rows[0];
      if (row === undefined) return false;
      await insertWorkerAudit(client, {
        row,
        event: 'auth.email.enviado',
        result: 'sucesso',
        messageId: input.messageId,
        occurredAt: input.deliveredAt,
      });
      return true;
    });
  }

  public markCancelled(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly cancelledAt: Date;
    readonly reasonCode: string;
  }): Promise<boolean> {
    return this.#terminalFailure({
      messageId: input.messageId,
      leaseToken: input.leaseToken,
      occurredAt: input.cancelledAt,
      status: 'cancelado',
      reasonCode: safeCode(input.reasonCode),
      event: 'auth.email.cancelado',
    });
  }

  public markFailed(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly failedAt: Date;
    readonly errorCode: string;
  }): Promise<boolean> {
    return this.#terminalFailure({
      messageId: input.messageId,
      leaseToken: input.leaseToken,
      occurredAt: input.failedAt,
      status: 'falhou',
      reasonCode: safeCode(input.errorCode),
      event: 'auth.email.falhou',
    });
  }

  public reschedule(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly attemptedAt: Date;
    readonly nextAttemptAt: Date;
    readonly errorCode: string;
  }): Promise<boolean> {
    const errorCode = safeCode(input.errorCode);
    if (input.nextAttemptAt.getTime() <= input.attemptedAt.getTime()) {
      throw serviceUnavailable();
    }
    return inTransaction(this.#pool, async (client) => {
      const updated = await query(
        client,
        `
          UPDATE public.outbox_email
          SET status = 'pendente', disponivel_em = $4,
              bloqueado_em = NULL, bloqueado_por = NULL,
              lease_token = NULL, lease_expira_em = NULL,
              erro_categoria = $5
          WHERE id = $1 AND lease_token = $2 AND status = 'processando'
            AND lease_expira_em > $3 AND expira_em > $4
        `,
        [
          input.messageId,
          input.leaseToken,
          input.attemptedAt,
          input.nextAttemptAt,
          errorCode,
        ],
      );
      return updated.rowCount === 1;
    });
  }

  async #terminalFailure(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly occurredAt: Date;
    readonly status: 'falhou' | 'cancelado';
    readonly reasonCode: string;
    readonly event: string;
  }): Promise<boolean> {
    return inTransaction(this.#pool, async (client) => {
      const updated = await query<TerminalizedRow>(
        client,
        `
          UPDATE public.outbox_email
          SET status = $4, payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, bloqueado_em = NULL,
              bloqueado_por = NULL, lease_token = NULL, lease_expira_em = NULL,
              encerrado_em = $3, erro_categoria = $5
          WHERE id = $1 AND lease_token = $2 AND status = 'processando'
            AND lease_expira_em > $3
          RETURNING organizacao_id, usuario_id
        `,
        [
          input.messageId,
          input.leaseToken,
          input.occurredAt,
          input.status,
          input.reasonCode,
        ],
      );
      const row = updated.rows[0];
      if (row === undefined) return false;
      await insertWorkerAudit(client, {
        row,
        event: input.event,
        result: 'falha',
        messageId: input.messageId,
        occurredAt: input.occurredAt,
        reasonCode: input.reasonCode,
      });
      return true;
    });
  }
}
