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

export function buildPostgresPoolConfig(config: DatabaseConfig): PoolConfig {
  return {
    connectionString: config.connectionString,
    ssl: config.ssl,
    application_name: 'tche_agro_backend',
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
): Pool {
  const pool = poolFactory(buildPostgresPoolConfig(config));

  pool.on('error', () => {
    logger.error(
      { event: 'postgres_pool_error' },
      'PostgreSQL pool emitted an unexpected idle-client error.',
    );
  });

  return pool;
}
