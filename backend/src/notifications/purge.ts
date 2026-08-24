import { fileURLToPath } from 'node:url';

import type { Pool, PoolClient, QueryResultRow } from 'pg';

import {
  ConfigurationError,
  loadRuntimeConfig,
} from '../config.js';
import { createPostgresPool } from '../database/pool.js';
import { createAppLogger, type SafeLogger } from '../observability/logger.js';

const PURGE_LOCK_NAMESPACE = 1_410_441;
const PURGE_LOCK_KEY = 34;
const DEFAULT_BATCH_SIZE = 1_000;
const MAX_BATCH_SIZE = 5_000;
const MAX_RETRIES = 3;

interface CountRow extends QueryResultRow {
  readonly count: string | number;
}

interface BacklogRow extends QueryResultRow {
  readonly pending_deliveries: string | number;
  readonly oldest_expired_at: Date | null;
}

export interface NotificationPurgeResult {
  readonly status: 'completed' | 'already_running';
  readonly deletedDeliveries: number;
  readonly deletedEvents: number;
  readonly deletedIdempotencyKeys: number;
  readonly pendingDeliveriesAtStart: number;
  readonly oldestExpiredAtStart: Date | null;
  readonly batches: number;
}

function nonNegativeInteger(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Invalid purge count.');
  }
  return parsed;
}

async function rollback(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK').catch(() => undefined);
}

export class PostgresNotificationPurgeRepository {
  readonly #pool: Pick<Pool, 'connect'>;

  public constructor(pool: Pick<Pool, 'connect'>) {
    this.#pool = pool;
  }

  public async run(batchSize = DEFAULT_BATCH_SIZE): Promise<NotificationPurgeResult> {
    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_BATCH_SIZE
    ) {
      throw new RangeError('Notification purge batch size is invalid.');
    }
    const client = await this.#pool.connect();
    let failed: Error | undefined;
    let lockAcquired = false;
    try {
      const lock = await client.query<{ acquired: boolean }>({
        text: 'SELECT pg_catalog.pg_try_advisory_lock($1, $2) AS acquired',
        values: [PURGE_LOCK_NAMESPACE, PURGE_LOCK_KEY],
      });
      lockAcquired = lock.rows[0]?.acquired === true;
      if (!lockAcquired) {
        return {
          status: 'already_running',
          deletedDeliveries: 0,
          deletedEvents: 0,
          deletedIdempotencyKeys: 0,
          pendingDeliveriesAtStart: 0,
          oldestExpiredAtStart: null,
          batches: 0,
        };
      }

      const backlog = await client.query<BacklogRow>({
        text: `
          SELECT count(id) AS pending_deliveries,
                 min(expira_em) AS oldest_expired_at
          FROM public.notificacao_entrega
          WHERE expira_em <= pg_catalog.clock_timestamp()
        `,
      });
      const pendingDeliveriesAtStart = nonNegativeInteger(
        backlog.rows[0]?.pending_deliveries ?? 0,
      );
      const oldestExpiredAtStart = backlog.rows[0]?.oldest_expired_at ?? null;
      let deletedDeliveries = 0;
      let deletedEvents = 0;
      let deletedIdempotencyKeys = 0;
      let batches = 0;

      while (true) {
        await client.query('BEGIN');
        try {
          const deliveries = await client.query<CountRow>({
            text: `
              WITH candidatas AS (
                SELECT id
                FROM public.notificacao_entrega
                WHERE expira_em <= pg_catalog.clock_timestamp()
                ORDER BY expira_em, id
                LIMIT $1
              ), removidas AS (
                DELETE FROM public.notificacao_entrega AS entrega
                USING candidatas
                WHERE entrega.id = candidatas.id
                RETURNING entrega.id
              )
              SELECT count(*) AS count FROM removidas
            `,
            values: [batchSize],
          });
          const events = await client.query<CountRow>({
            text: `
              WITH candidatos AS (
                SELECT evento.id
                FROM public.notificacao_evento AS evento
                WHERE NOT EXISTS (
                  SELECT 1 FROM public.notificacao_entrega AS entrega
                  WHERE entrega.organizacao_id = evento.organizacao_id
                    AND entrega.evento_id = evento.id
                )
                ORDER BY evento.criado_em, evento.id
                LIMIT $1
              ), removidos AS (
                DELETE FROM public.notificacao_evento AS evento
                USING candidatos
                WHERE evento.id = candidatos.id
                RETURNING evento.id
              )
              SELECT count(*) AS count FROM removidos
            `,
            values: [batchSize],
          });
          const idempotency = await client.query<CountRow>({
            text: `
              WITH candidatas AS (
                SELECT id
                FROM public.notificacao_comando_idempotencia
                WHERE expira_em <= pg_catalog.clock_timestamp()
                ORDER BY expira_em, id
                LIMIT $1
              ), removidas AS (
                DELETE FROM public.notificacao_comando_idempotencia AS comando
                USING candidatas
                WHERE comando.id = candidatas.id
                RETURNING comando.id
              )
              SELECT count(*) AS count FROM removidas
            `,
            values: [batchSize],
          });
          await client.query('COMMIT');
          const currentDeliveries = nonNegativeInteger(
            deliveries.rows[0]?.count ?? 0,
          );
          const currentEvents = nonNegativeInteger(events.rows[0]?.count ?? 0);
          const currentIdempotency = nonNegativeInteger(
            idempotency.rows[0]?.count ?? 0,
          );
          if (
            currentDeliveries === 0 &&
            currentEvents === 0 &&
            currentIdempotency === 0
          ) {
            break;
          }
          batches += 1;
          deletedDeliveries += currentDeliveries;
          deletedEvents += currentEvents;
          deletedIdempotencyKeys += currentIdempotency;
        } catch (error) {
          await rollback(client);
          throw error;
        }
      }

      return {
        status: 'completed',
        deletedDeliveries,
        deletedEvents,
        deletedIdempotencyKeys,
        pendingDeliveriesAtStart,
        oldestExpiredAtStart,
        batches,
      };
    } catch (error) {
      failed = error instanceof Error ? error : new Error('Notification purge failed.');
      throw failed;
    } finally {
      if (lockAcquired) {
        await client
          .query({
            text: 'SELECT pg_catalog.pg_advisory_unlock($1, $2)',
            values: [PURGE_LOCK_NAMESPACE, PURGE_LOCK_KEY],
          })
          .catch(() => undefined);
      }
      client.release(failed);
    }
  }
}

function transientDatabaseFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as Readonly<{ code?: unknown }>).code;
  return (
    typeof code === 'string' &&
    new Set([
      '40001',
      '40P01',
      '55P03',
      '57P01',
      '57P02',
      '57P03',
      '08000',
      '08001',
      '08003',
      '08004',
      '08006',
      '53300',
      'ECONNRESET',
      'ETIMEDOUT',
    ]).has(code)
  );
}

export async function runNotificationPurgeWithRetries(input: {
  readonly repository: Pick<PostgresNotificationPurgeRepository, 'run'>;
  readonly batchSize?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
}): Promise<NotificationPurgeResult> {
  const wait =
    input.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = input.random ?? Math.random;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await input.repository.run(input.batchSize);
    } catch (error) {
      if (attempt >= MAX_RETRIES || !transientDatabaseFailure(error)) throw error;
      const jitter = Math.floor(Math.max(0, Math.min(0.999, random())) * 100);
      await wait(250 * 2 ** attempt + jitter);
    }
  }
}

export function notificationMaintenanceEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  const maintenanceUrl = source.NOTIFICATIONS_MAINTENANCE_DATABASE_URL;
  if (source.NODE_ENV === 'production' && maintenanceUrl === undefined) {
    throw new ConfigurationError(
      'NOTIFICATIONS_MAINTENANCE_DATABASE_URL is required in production.',
    );
  }
  return {
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: maintenanceUrl ?? source.DATABASE_URL,
    DATABASE_SSL_CA:
      source.NOTIFICATIONS_MAINTENANCE_DATABASE_SSL_CA ??
      source.DATABASE_SSL_CA,
    LOG_LEVEL: source.LOG_LEVEL,
  };
}

function purgeBatchSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_BATCH_SIZE;
  if (!/^[1-9][0-9]*$/u.test(value)) throw new ConfigurationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_BATCH_SIZE) {
    throw new ConfigurationError();
  }
  return parsed;
}

export async function executeNotificationPurge(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  logger?: SafeLogger,
): Promise<NotificationPurgeResult> {
  const runtimeConfig = loadRuntimeConfig(
    notificationMaintenanceEnvironment(environment),
  );
  const activeLogger = logger ?? createAppLogger(runtimeConfig.logLevel);
  const database = createPostgresPool(
    runtimeConfig.database,
    activeLogger,
    undefined,
    'tche_agro_notifications_maintenance',
  );
  const startedAt = Date.now();
  try {
    const result = await runNotificationPurgeWithRetries({
      repository: new PostgresNotificationPurgeRepository(database),
      batchSize: purgeBatchSize(environment.NOTIFICATIONS_PURGE_BATCH_SIZE),
    });
    activeLogger.info(
      {
        event: 'notification_purge_completed',
        status: result.status,
        deleted_deliveries: result.deletedDeliveries,
        deleted_events: result.deletedEvents,
        deleted_idempotency_keys: result.deletedIdempotencyKeys,
        pending_deliveries_at_start: result.pendingDeliveriesAtStart,
        oldest_expired_at_start:
          result.oldestExpiredAtStart?.toISOString() ?? null,
        batches: result.batches,
        duration_ms: Date.now() - startedAt,
      },
      'Notification purge completed.',
    );
    return result;
  } finally {
    await database.end();
  }
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && fileURLToPath(import.meta.url) === entryPoint;
}

if (isMainModule()) {
  try {
    await executeNotificationPurge();
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'notification_purge_failed',
        message: 'Notification purge failed.',
      })}\n`,
    );
    process.exitCode = 1;
  }
}
