import { randomUUID } from 'node:crypto';

import type { PoolClient, QueryResultRow } from 'pg';

import { query } from '../auth/postgres-common.js';
import { serviceUnavailable } from '../security/http-error.js';
import type {
  AccountNotificationDraft,
  AccountNotificationWriter,
} from './contracts.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface EventRow extends QueryResultRow {
  readonly id: string;
  readonly recurso_id: string;
  readonly autor_id: string | null;
  readonly criado_em: Date;
}

interface DeliveryRow extends QueryResultRow {
  readonly id: string;
  readonly evento_id: string;
}

function validSourceKey(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export class PostgresAccountNotificationWriter
  implements AccountNotificationWriter
{
  readonly #idGenerator: () => string;

  public constructor(idGenerator: () => string = randomUUID) {
    this.#idGenerator = idGenerator;
  }

  public async create(
    client: PoolClient,
    draft: AccountNotificationDraft,
  ): Promise<void> {
    if (
      !UUID_PATTERN.test(draft.recipientUserId) ||
      !validSourceKey(draft.sourceKey) ||
      (draft.authorUserId !== undefined &&
        !UUID_PATTERN.test(draft.authorUserId))
    ) {
      throw serviceUnavailable();
    }

    await query(
      client,
      `
        INSERT INTO public.notificacao_evento (
          id, organizacao_id, tipo_evento, chave_origem, recurso_tipo,
          recurso_id, autor_id, dados_apresentacao
        ) VALUES ($1, $2, $3, $4, 'conta', $5, $6, '{}'::jsonb)
        ON CONFLICT (organizacao_id, tipo_evento, chave_origem) DO NOTHING
      `,
      [
        this.#idGenerator(),
        draft.organizationId,
        draft.eventType,
        draft.sourceKey,
        draft.recipientUserId,
        draft.authorUserId ?? null,
      ],
    );

    const event = await query<EventRow>(
      client,
      `
        SELECT id, recurso_id, autor_id, criado_em
        FROM public.notificacao_evento
        WHERE organizacao_id = $1 AND tipo_evento = $2 AND chave_origem = $3
        FOR KEY SHARE
      `,
      [draft.organizationId, draft.eventType, draft.sourceKey],
    );
    const row = event.rows[0];
    if (
      row === undefined ||
      row.recurso_id !== draft.recipientUserId ||
      row.autor_id !== (draft.authorUserId ?? null)
    ) {
      throw serviceUnavailable();
    }

    const insertedDelivery = await query(
      client,
      `
        INSERT INTO public.notificacao_entrega (
          id, evento_id, destinatario_usuario_id, organizacao_id,
          prioridade, criada_em, chave_deduplicacao, expira_em
        )
        SELECT $1, evento.id, $2, evento.organizacao_id, 'alta',
               evento.criado_em, $3, evento.criado_em + interval '90 days'
        FROM public.notificacao_evento AS evento
        WHERE evento.organizacao_id = $4 AND evento.id = $5
        ON CONFLICT (
          organizacao_id, destinatario_usuario_id, chave_deduplicacao
        ) DO NOTHING
      `,
      [
        this.#idGenerator(),
        draft.recipientUserId,
        `${draft.eventType}:${draft.sourceKey}`,
        draft.organizationId,
        row.id,
      ],
    );

    const delivery = await query<DeliveryRow>(
      client,
      `
        SELECT id, evento_id
        FROM public.notificacao_entrega
        WHERE organizacao_id = $1 AND destinatario_usuario_id = $2
          AND chave_deduplicacao = $3
      `,
      [
        draft.organizationId,
        draft.recipientUserId,
        `${draft.eventType}:${draft.sourceKey}`,
      ],
    );
    const deliveryRow = delivery.rows[0];
    if (deliveryRow?.evento_id !== row.id) throw serviceUnavailable();

    const auditEvent =
      insertedDelivery.rowCount === 1
        ? 'notificacao.criada'
        : 'notificacao.deduplicada';
    await query(
      client,
      `
        INSERT INTO public.eventos_auditoria (
          organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
          usuario_afetado_id, recurso_tipo, recurso_id, metadados, ocorrido_em
        ) VALUES (
          $1, $2, 'sucesso', $3, $4, $5, 'notificacao_entrega', $6,
          $7::jsonb,
          CASE
            WHEN $8::timestamptz IS NULL THEN pg_catalog.clock_timestamp()
            ELSE $8::timestamptz
          END
        )
      `,
      [
        draft.organizationId,
        auditEvent,
        draft.authorUserId === undefined ? 'sistema' : 'usuario',
        draft.authorUserId ?? null,
        draft.recipientUserId,
        deliveryRow.id,
        JSON.stringify({
          evento_origem_id: draft.sourceKey,
          tipo_evento: draft.eventType,
        }),
        insertedDelivery.rowCount === 1 ? row.criado_em : null,
      ],
    );
  }
}
