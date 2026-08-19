import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { serviceUnavailable } from '../security/http-error.js';

export type AuthPostgresPool = Pick<Pool, 'connect'>;

export async function query<Row extends QueryResultRow>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> {
  return client.query<Row>({ text, values });
}

export async function inTransaction<T>(
  pool: AuthPostgresPool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await query(client, 'BEGIN');
    const result = await operation(client);
    await query(client, 'COMMIT');
    return result;
  } catch {
    if (client !== undefined) {
      try {
        await query(client, 'ROLLBACK');
      } catch {
        // The original failure is deliberately replaced by one safe 503.
      }
    }
    throw serviceUnavailable();
  } finally {
    client?.release();
  }
}

export async function safeDatabaseRead<T>(
  pool: AuthPostgresPool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    return await operation(client);
  } catch {
    throw serviceUnavailable();
  } finally {
    client?.release();
  }
}

export function decodeDigest(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw serviceUnavailable();
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.byteLength !== 32 || decoded.toString('base64url') !== value) {
    throw serviceUnavailable();
  }
  return decoded;
}

export function safeRequestId(value: string): string {
  return value.length <= 200 ? value : value.slice(0, 200);
}

export function safeDurationSeconds(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 31_536_000) {
    throw serviceUnavailable();
  }
  return value;
}

export function databaseInteger(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw serviceUnavailable();
  return parsed;
}

