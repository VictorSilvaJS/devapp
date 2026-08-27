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

interface DeliveryAttemptRow extends QueryResultRow {
  readonly entrega_id: string;
  readonly evento_id: string;
  readonly organizacao_id: string;
  readonly destinatario_usuario_id: string;
  readonly tipo_evento: string;
  readonly autor_usuario_id: string | null;
  readonly resultado_tentativa: 'criada' | 'deduplicada';
  readonly ocorrido_em: Date;
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
    const attemptId = this.#idGenerator();
    if (!UUID_PATTERN.test(attemptId)) throw serviceUnavailable();
    const delivery = await query<DeliveryAttemptRow>(
      client,
      `
        SELECT entrega_id, evento_id, organizacao_id,
               destinatario_usuario_id, tipo_evento, autor_usuario_id,
               resultado_tentativa, ocorrido_em
        FROM public.tche_notificacao_entregar_conta_mp35b($1, $2)
      `,
      [draft.sourceKey, attemptId],
    );
    const row = delivery.rows[0];
    if (
      delivery.rowCount !== 1 ||
      row === undefined ||
      row.organizacao_id !== draft.organizationId ||
      row.destinatario_usuario_id !== draft.recipientUserId ||
      row.tipo_evento !== draft.eventType ||
      row.autor_usuario_id !== (draft.authorUserId ?? null) ||
      (row.resultado_tentativa !== 'criada' &&
        row.resultado_tentativa !== 'deduplicada') ||
      !(row.ocorrido_em instanceof Date)
    ) {
      throw serviceUnavailable();
    }
  }
}
