import type { PoolClient, QueryResultRow } from 'pg';

import {
  databaseInteger,
  inTransaction,
  query,
  safeDatabaseRead,
  safeRequestId,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import { serviceUnavailable } from '../security/http-error.js';
import type {
  IdempotentCommandInput,
  ListNotificationsInput,
  NotificationCommandResult,
  NotificationEventType,
  NotificationPriority,
  NotificationRepository,
  NotificationView,
} from './contracts.js';
import { notificationContent } from './templates.js';

interface NotificationRow extends QueryResultRow {
  readonly id: string;
  readonly tipo_evento: string;
  readonly prioridade: string;
  readonly criada_em: Date;
  readonly lida_em: Date | null;
  readonly expira_em: Date;
  readonly recurso_tipo: string;
  readonly recurso_id: string;
}

interface IdempotencyRow extends QueryResultRow {
  readonly comando: string;
  readonly alvo_entrega_id: string | null;
  readonly hash_requisicao: Buffer;
  readonly corte_em: Date | null;
  readonly resultado_em: Date | null;
  readonly resultado_quantidade: string | number | null;
}

const VISIBLE_NOTIFICATION = `
  entrega.organizacao_id = ator.organizacao_id
  AND entrega.destinatario_usuario_id = ator.id
  AND entrega.descartada_em IS NULL
  AND entrega.expira_em > pg_catalog.clock_timestamp()
  AND evento.organizacao_id = entrega.organizacao_id
  AND evento.id = entrega.evento_id
  AND evento.recurso_tipo = 'conta'
  AND evento.recurso_id = ator.id
`;

function eventType(value: string): NotificationEventType {
  if (
    value !== 'conta.senha_alterada.v1' &&
    value !== 'conta.email_principal_alterado.v1' &&
    value !== 'conta.recuperacao_concluida.v1'
  ) {
    throw serviceUnavailable();
  }
  return value;
}

function priority(value: string): NotificationPriority {
  if (value !== 'baixa' && value !== 'normal' && value !== 'alta') {
    throw serviceUnavailable();
  }
  return value;
}

function mapNotification(row: NotificationRow): NotificationView {
  const type = eventType(row.tipo_evento);
  if (row.recurso_tipo !== 'conta') throw serviceUnavailable();
  return {
    id: row.id,
    eventType: type,
    priority: priority(row.prioridade),
    createdAt: row.criada_em,
    readAt: row.lida_em,
    expiresAt: row.expira_em,
    resourceType: 'conta',
    resourceId: row.recurso_id,
    content: notificationContent(type),
  };
}

function validDigest(value: Buffer): boolean {
  return Buffer.isBuffer(value) && value.byteLength === 32;
}

async function lockActor(
  client: PoolClient,
  principal: IdempotentCommandInput['principal'],
): Promise<boolean> {
  const locked = await query(
    client,
    `
      SELECT id
      FROM public.usuarios
      WHERE organizacao_id = $1 AND id = $2 AND perfil = $3
        AND status = 'ativo' AND versao_autorizacao = $4
      FOR UPDATE
    `,
    [
      principal.organizationId,
      principal.id,
      principal.profile,
      principal.authorizationVersion,
    ],
  );
  return locked.rowCount === 1;
}

async function existingCommand(
  client: PoolClient,
  input: IdempotentCommandInput,
): Promise<IdempotencyRow | null> {
  const result = await query<IdempotencyRow>(
    client,
    `
      SELECT comando, alvo_entrega_id, hash_requisicao, corte_em,
             resultado_em, resultado_quantidade
      FROM public.notificacao_comando_idempotencia
      WHERE organizacao_id = $1 AND usuario_id = $2
        AND chave_idempotencia_hash = $3
      FOR UPDATE
    `,
    [input.principal.organizationId, input.principal.id, input.idempotencyKeyHash],
  );
  return result.rows[0] ?? null;
}

function commandMatches(
  row: IdempotencyRow,
  input: IdempotentCommandInput,
  command: 'leitura' | 'leituras' | 'descarte',
  targetId?: string,
): boolean {
  return (
    row.comando === command &&
    row.alvo_entrega_id === (targetId ?? null) &&
    Buffer.isBuffer(row.hash_requisicao) &&
    row.hash_requisicao.equals(input.requestHash)
  );
}

async function insertCommandAudit(
  client: PoolClient,
  input: {
    readonly principal: IdempotentCommandInput['principal'];
    readonly event: string;
    readonly requestId: string;
    readonly resourceType?: 'notificacao_entrega' | 'usuario';
    readonly resourceId: string;
    readonly occurredAt: Date;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly result?: 'sucesso' | 'negado';
  },
): Promise<void> {
  await query(
    client,
    `
      INSERT INTO public.eventos_auditoria (
        organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
        sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
        request_id, metadados, ocorrido_em
      ) VALUES ($1, $2, $3, 'usuario', $4, $5, $4,
                $6, $7, $8, $9::jsonb, $10)
    `,
    [
      input.principal.organizationId,
      input.event,
      input.result ?? 'sucesso',
      input.principal.id,
      input.principal.sessionId,
      input.resourceType ?? 'notificacao_entrega',
      input.resourceId,
      safeRequestId(input.requestId),
      JSON.stringify(input.metadata ?? {}),
      input.occurredAt,
    ],
  );
}

export class PostgresNotificationRepository implements NotificationRepository {
  readonly #pool: AuthPostgresPool;

  public constructor(pool: AuthPostgresPool) {
    this.#pool = pool;
  }

  public list(
    input: ListNotificationsInput,
  ): Promise<readonly NotificationView[]> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<NotificationRow>(
        client,
        `
          WITH ator AS (
            SELECT id, organizacao_id
            FROM public.usuarios
            WHERE organizacao_id = $1 AND id = $2 AND perfil = $3
              AND status = 'ativo' AND versao_autorizacao = $4
          )
          SELECT entrega.id, evento.tipo_evento, entrega.prioridade,
                 entrega.criada_em, entrega.lida_em, entrega.expira_em,
                 evento.recurso_tipo, evento.recurso_id
          FROM ator
          JOIN public.notificacao_entrega AS entrega ON true
          JOIN public.notificacao_evento AS evento
            ON evento.organizacao_id = entrega.organizacao_id
           AND evento.id = entrega.evento_id
          WHERE ${VISIBLE_NOTIFICATION}
            AND (
              $5::text = 'todas'
              OR ($5::text = 'nao_lida' AND entrega.lida_em IS NULL)
              OR ($5::text = 'lida' AND entrega.lida_em IS NOT NULL)
            )
            AND (
              ($6::timestamptz IS NULL AND $7::uuid IS NULL)
              OR (entrega.criada_em, entrega.id) < ($6::timestamptz, $7::uuid)
            )
          ORDER BY entrega.criada_em DESC, entrega.id DESC
          LIMIT $8
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.principal.profile,
          input.principal.authorizationVersion,
          input.state,
          input.cursor?.createdAt ?? null,
          input.cursor?.id ?? null,
          input.limit,
        ],
      );
      return result.rows.map(mapNotification);
    });
  }

  public countUnread(input: {
    readonly principal: IdempotentCommandInput['principal'];
  }): Promise<number> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<{ total: string | number }>(
        client,
        `
          WITH ator AS (
            SELECT id, organizacao_id
            FROM public.usuarios
            WHERE organizacao_id = $1 AND id = $2 AND perfil = $3
              AND status = 'ativo' AND versao_autorizacao = $4
          )
          SELECT count(*) AS total
          FROM ator
          JOIN public.notificacao_entrega AS entrega ON true
          JOIN public.notificacao_evento AS evento
            ON evento.organizacao_id = entrega.organizacao_id
           AND evento.id = entrega.evento_id
          WHERE ${VISIBLE_NOTIFICATION} AND entrega.lida_em IS NULL
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.principal.profile,
          input.principal.authorizationVersion,
        ],
      );
      const total = databaseInteger(result.rows[0]?.total ?? Number.NaN);
      if (total < 0) throw serviceUnavailable();
      return total;
    });
  }

  public markRead(
    input: IdempotentCommandInput & Readonly<{ notificationId: string }>,
  ): Promise<
    NotificationCommandResult<Readonly<{ id: string; readAt: Date }>>
  > {
    if (!validDigest(input.idempotencyKeyHash) || !validDigest(input.requestHash)) {
      return Promise.reject(serviceUnavailable());
    }
    return inTransaction(this.#pool, async (client) => {
      if (!(await lockActor(client, input.principal))) {
        return { status: 'not_found' as const };
      }
      const existing = await existingCommand(client, input);
      if (existing !== null) {
        if (!commandMatches(existing, input, 'leitura', input.notificationId)) {
          return { status: 'conflict' as const };
        }
        if (existing.resultado_em === null) throw new Error('Invalid command result.');
        return {
          status: 'completed' as const,
          value: { id: input.notificationId, readAt: existing.resultado_em },
          replayed: true,
        };
      }

      const found = await query<{ lida_em: Date | null; expira_em: Date }>(
        client,
        `
          SELECT entrega.lida_em, entrega.expira_em
          FROM public.notificacao_entrega AS entrega
          JOIN public.notificacao_evento AS evento
            ON evento.organizacao_id = entrega.organizacao_id
           AND evento.id = entrega.evento_id
          WHERE entrega.organizacao_id = $1
            AND entrega.destinatario_usuario_id = $2 AND entrega.id = $3
            AND entrega.descartada_em IS NULL
            AND entrega.expira_em > pg_catalog.clock_timestamp()
            AND evento.recurso_tipo = 'conta' AND evento.recurso_id = $2
          FOR UPDATE OF entrega
        `,
        [input.principal.organizationId, input.principal.id, input.notificationId],
      );
      const current = found.rows[0];
      if (current === undefined) return { status: 'not_found' as const };
      const updated = await query<{ lida_em: Date }>(
        client,
        `
          UPDATE public.notificacao_entrega
          SET lida_em = COALESCE(lida_em, pg_catalog.clock_timestamp())
          WHERE organizacao_id = $1 AND destinatario_usuario_id = $2 AND id = $3
          RETURNING lida_em
        `,
        [input.principal.organizationId, input.principal.id, input.notificationId],
      );
      const readAt = updated.rows[0]?.lida_em;
      if (readAt === undefined) throw new Error('Read timestamp unavailable.');
      const clock = await query<{ agora: Date }>(
        client,
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const processedAt = clock.rows[0]?.agora;
      if (processedAt === undefined) {
        throw new Error('Command timestamp unavailable.');
      }
      await query(
        client,
        `
          INSERT INTO public.notificacao_comando_idempotencia (
            organizacao_id, usuario_id, chave_idempotencia_hash, comando,
            alvo_entrega_id, hash_requisicao, resultado_em, processado_em,
            expira_em
          ) VALUES ($1, $2, $3, 'leitura', $4, $5, $6, $7,
                    $7::timestamptz + interval '90 days')
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.idempotencyKeyHash,
          input.notificationId,
          input.requestHash,
          readAt,
          processedAt,
        ],
      );
      if (current.lida_em === null) {
        await insertCommandAudit(client, {
          principal: input.principal,
          event: 'notificacao.lida',
          requestId: input.requestId,
          resourceId: input.notificationId,
          occurredAt: readAt,
        });
      }
      return {
        status: 'completed' as const,
        value: { id: input.notificationId, readAt },
        replayed: false,
      };
    });
  }

  public markAllRead(input: IdempotentCommandInput): Promise<
    NotificationCommandResult<Readonly<{ cutoffAt: Date; updated: number }>>
  > {
    if (!validDigest(input.idempotencyKeyHash) || !validDigest(input.requestHash)) {
      return Promise.reject(serviceUnavailable());
    }
    return inTransaction(this.#pool, async (client) => {
      if (!(await lockActor(client, input.principal))) {
        return { status: 'not_found' as const };
      }
      const existing = await existingCommand(client, input);
      if (existing !== null) {
        if (!commandMatches(existing, input, 'leituras')) {
          return { status: 'conflict' as const };
        }
        if (
          existing.corte_em === null ||
          existing.resultado_quantidade === null
        ) {
          throw new Error('Invalid bulk command result.');
        }
        return {
          status: 'completed' as const,
          value: {
            cutoffAt: existing.corte_em,
            updated: databaseInteger(existing.resultado_quantidade),
          },
          replayed: true,
        };
      }
      const clock = await query<{ agora: Date }>(
        client,
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const cutoffAt = clock.rows[0]?.agora;
      if (cutoffAt === undefined) throw new Error('Server cutoff unavailable.');
      const updated = await query<{ id: string }>(
        client,
        `
          UPDATE public.notificacao_entrega AS entrega
          SET lida_em = $3
          WHERE entrega.organizacao_id = $1
            AND entrega.destinatario_usuario_id = $2
            AND entrega.criada_em <= $3 AND entrega.lida_em IS NULL
            AND entrega.descartada_em IS NULL AND entrega.expira_em > $3
            AND EXISTS (
              SELECT 1 FROM public.notificacao_evento AS evento
              WHERE evento.organizacao_id = entrega.organizacao_id
                AND evento.id = entrega.evento_id
                AND evento.recurso_tipo = 'conta' AND evento.recurso_id = $2
            )
          RETURNING entrega.id
        `,
        [input.principal.organizationId, input.principal.id, cutoffAt],
      );
      const count = updated.rowCount ?? 0;
      await query(
        client,
        `
          INSERT INTO public.notificacao_comando_idempotencia (
            organizacao_id, usuario_id, chave_idempotencia_hash, comando,
            hash_requisicao, corte_em, resultado_quantidade, processado_em,
            expira_em
          ) VALUES ($1, $2, $3, 'leituras', $4, $5, $6, $5,
                    $5::timestamptz + interval '90 days')
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.idempotencyKeyHash,
          input.requestHash,
          cutoffAt,
          count,
        ],
      );
      await insertCommandAudit(client, {
        principal: input.principal,
        event: 'notificacao.leituras_em_lote',
        requestId: input.requestId,
        resourceType: 'usuario',
        resourceId: input.principal.id,
        occurredAt: cutoffAt,
        metadata: { atualizadas: count },
      });
      return {
        status: 'completed' as const,
        value: { cutoffAt, updated: count },
        replayed: false,
      };
    });
  }

  public discard(
    input: IdempotentCommandInput & Readonly<{ notificationId: string }>,
  ): Promise<
    NotificationCommandResult<Readonly<{ id: string; discardedAt: Date }>>
  > {
    if (!validDigest(input.idempotencyKeyHash) || !validDigest(input.requestHash)) {
      return Promise.reject(serviceUnavailable());
    }
    return inTransaction(this.#pool, async (client) => {
      if (!(await lockActor(client, input.principal))) {
        return { status: 'not_found' as const };
      }
      const existing = await existingCommand(client, input);
      if (existing !== null) {
        if (!commandMatches(existing, input, 'descarte', input.notificationId)) {
          return { status: 'conflict' as const };
        }
        if (existing.resultado_em === null) throw new Error('Invalid command result.');
        return {
          status: 'completed' as const,
          value: { id: input.notificationId, discardedAt: existing.resultado_em },
          replayed: true,
        };
      }
      const updated = await query<{ descartada_em: Date }>(
        client,
        `
          UPDATE public.notificacao_entrega AS entrega
          SET descartada_em = pg_catalog.clock_timestamp()
          WHERE entrega.organizacao_id = $1
            AND entrega.destinatario_usuario_id = $2 AND entrega.id = $3
            AND entrega.descartada_em IS NULL
            AND entrega.expira_em > pg_catalog.clock_timestamp()
            AND EXISTS (
              SELECT 1 FROM public.notificacao_evento AS evento
              WHERE evento.organizacao_id = entrega.organizacao_id
                AND evento.id = entrega.evento_id
                AND evento.recurso_tipo = 'conta' AND evento.recurso_id = $2
            )
          RETURNING entrega.descartada_em
        `,
        [input.principal.organizationId, input.principal.id, input.notificationId],
      );
      const discardedAt = updated.rows[0]?.descartada_em;
      if (discardedAt === undefined) return { status: 'not_found' as const };
      await query(
        client,
        `
          INSERT INTO public.notificacao_comando_idempotencia (
            organizacao_id, usuario_id, chave_idempotencia_hash, comando,
            alvo_entrega_id, hash_requisicao, resultado_em, processado_em,
            expira_em
          ) VALUES ($1, $2, $3, 'descarte', $4, $5, $6, $6,
                    $6::timestamptz + interval '90 days')
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.idempotencyKeyHash,
          input.notificationId,
          input.requestHash,
          discardedAt,
        ],
      );
      await insertCommandAudit(client, {
        principal: input.principal,
        event: 'notificacao.descartada',
        requestId: input.requestId,
        resourceId: input.notificationId,
        occurredAt: discardedAt,
      });
      return {
        status: 'completed' as const,
        value: { id: input.notificationId, discardedAt },
        replayed: false,
      };
    });
  }

  public resolveDestination(input: {
    readonly principal: IdempotentCommandInput['principal'];
    readonly notificationId: string;
    readonly requestId: string;
  }): Promise<Readonly<{ resourceType: 'conta'; resourceId: string }> | null> {
    return inTransaction(this.#pool, async (client) => {
      const result = await query<{ recurso_id: string }>(
        client,
        `
          WITH ator AS (
            SELECT id, organizacao_id
            FROM public.usuarios
            WHERE organizacao_id = $1 AND id = $2 AND perfil = $3
              AND status = 'ativo' AND versao_autorizacao = $4
          )
          SELECT evento.recurso_id
          FROM ator
          JOIN public.notificacao_entrega AS entrega ON true
          JOIN public.notificacao_evento AS evento
            ON evento.organizacao_id = entrega.organizacao_id
           AND evento.id = entrega.evento_id
          WHERE ${VISIBLE_NOTIFICATION} AND entrega.id = $5
          LIMIT 1
        `,
        [
          input.principal.organizationId,
          input.principal.id,
          input.principal.profile,
          input.principal.authorizationVersion,
          input.notificationId,
        ],
      );
      const row = result.rows[0];
      if (row !== undefined) {
        return { resourceType: 'conta' as const, resourceId: row.recurso_id };
      }
      const now = await query<{ agora: Date }>(
        client,
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const occurredAt = now.rows[0]?.agora;
      if (occurredAt === undefined) throw new Error('Server timestamp unavailable.');
      await insertCommandAudit(client, {
        principal: input.principal,
        event: 'notificacao.destino_resolucao_negada',
        requestId: input.requestId,
        resourceId: input.notificationId,
        occurredAt,
        result: 'negado',
      });
      return null;
    });
  }
}
