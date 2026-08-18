import type { QueryResultRow } from 'pg';

import { DEFAULT_READINESS_TIMEOUT_MS } from '../config.js';
import type { DatabasePool } from './pool.js';

const READINESS_QUERY =
  "SELECT extversion AS postgis_version FROM pg_catalog.pg_extension WHERE extname = 'postgis'";
const timeoutMarker = Symbol('readiness-timeout');

interface PostgisVersionRow extends QueryResultRow {
  postgis_version: string | null;
}

export interface TimedReadinessQuery {
  readonly text: string;
  readonly query_timeout: number;
}

export interface DatabaseReadinessResult {
  readonly ready: boolean;
}

export async function checkDatabaseReadiness(
  pool: DatabasePool,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
): Promise<DatabaseReadinessResult> {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > DEFAULT_READINESS_TIMEOUT_MS
  ) {
    throw new RangeError('Readiness timeout must be between 1 and 2000 ms.');
  }

  let timeout: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(timeoutMarker), timeoutMs);
  });

  const queryConfig: TimedReadinessQuery = {
      text: READINESS_QUERY,
      query_timeout: timeoutMs,
  };
  const query = Promise.resolve().then(() =>
    pool.query<PostgisVersionRow>(queryConfig),
  );

  try {
    const result = await Promise.race([query, deadline]);
    const version = result.rows[0]?.postgis_version;
    return { ready: typeof version === 'string' && version.length > 0 };
  } catch {
    return { ready: false };
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
