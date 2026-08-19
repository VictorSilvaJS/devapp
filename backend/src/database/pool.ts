import {
  Pool,
  type PoolConfig,
  type QueryConfig,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

import type { DatabaseConfig } from '../config.js';
import type { SafeLogger } from '../observability/logger.js';

export interface DatabasePool {
  query<Row extends QueryResultRow = QueryResultRow>(
    query: QueryConfig,
  ): Promise<QueryResult<Row>>;
  end(): Promise<void>;
}

export type PostgresPoolFactory = (config: PoolConfig) => Pool;

function safeApplicationName(value: string): string {
  if (!/^[a-z][a-z0-9_]{2,62}$/u.test(value)) {
    throw new TypeError('Invalid PostgreSQL application name.');
  }
  return value;
}

export function buildPostgresPoolConfig(
  config: DatabaseConfig,
  applicationName = 'tche_agro_backend',
): PoolConfig {
  return {
    connectionString: config.connectionString,
    ssl: config.ssl,
    application_name: safeApplicationName(applicationName),
    options: '-c search_path=pg_catalog,public',
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: 30_000,
    max: 10,
  };
}

export function createPostgresPool(
  config: DatabaseConfig,
  logger: SafeLogger,
  poolFactory: PostgresPoolFactory = (poolConfig) => new Pool(poolConfig),
  applicationName = 'tche_agro_backend',
): Pool {
  const pool = poolFactory(buildPostgresPoolConfig(config, applicationName));

  pool.on('error', () => {
    logger.error(
      { event: 'postgres_pool_error' },
      'PostgreSQL pool emitted an unexpected idle-client error.',
    );
  });

  return pool;
}
