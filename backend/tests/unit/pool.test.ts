import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { rootCertificates } from 'node:tls';

import { Client, type Pool, type PoolConfig } from 'pg';

import { buildDatabaseConfig } from '../../src/config.js';
import {
  buildPostgresPoolConfig,
  createPostgresPool,
} from '../../src/database/pool.js';
import type { SafeLogger } from '../../src/observability/logger.js';

describe('PostgreSQL pool', () => {
  it('builds a production pool config with verified TLS and no SSL URL option', () => {
    const database = buildDatabaseConfig({
      nodeEnv: 'production',
      databaseUrl: 'postgresql://backend:secret@db/prod',
    });

    const poolConfig = buildPostgresPoolConfig(database);

    assert.equal(poolConfig.connectionString, database.connectionString);
    assert.deepEqual(poolConfig.ssl, { rejectUnauthorized: true });
    assert.equal(poolConfig.connectionTimeoutMillis, 2_000);
    assert.equal(poolConfig.application_name, 'tche_agro_backend');
    assert.equal(poolConfig.options, '-c search_path=pg_catalog,public');

    const client = new Client(poolConfig) as Client & {
      connectionParameters: { ssl: unknown; options: string };
    };
    assert.deepEqual(client.connectionParameters.ssl, {
      rejectUnauthorized: true,
    });
    assert.equal(
      client.connectionParameters.options,
      '-c search_path=pg_catalog,public',
    );
  });

  it('preserves an injected CA in the effective pg client configuration', () => {
    const certificateAuthority = rootCertificates[0];
    assert.ok(certificateAuthority);
    const database = buildDatabaseConfig({
      nodeEnv: 'production',
      databaseUrl: 'postgresql://backend:secret@db/prod',
      certificateAuthority,
    });

    const client = new Client(buildPostgresPoolConfig(database)) as Client & {
      connectionParameters: { ssl: unknown };
    };

    assert.deepEqual(client.connectionParameters.ssl, {
      rejectUnauthorized: true,
      ca: certificateAuthority,
    });
  });

  it('constructs the pool lazily and sanitizes idle-client errors', () => {
    let constructedWith: PoolConfig | undefined;
    let errorListener: ((error: Error) => void) | undefined;
    let queryCount = 0;
    const logEntries: Array<Record<string, unknown>> = [];
    const logger: SafeLogger = {
      info() {},
      warn() {},
      error(bindings) {
        logEntries.push(bindings);
      },
    };
    const fakePool = {
      on(event: string, listener: (error: Error) => void) {
        assert.equal(event, 'error');
        errorListener = listener;
        return this;
      },
      query() {
        queryCount += 1;
      },
    } as unknown as Pool;

    const database = buildDatabaseConfig({
      nodeEnv: 'test',
      databaseUrl: 'postgresql://backend:local@localhost/tche_agro_test',
    });
    const pool = createPostgresPool(database, logger, (poolConfig) => {
      constructedWith = poolConfig;
      return fakePool;
    });

    assert.equal(pool, fakePool);
    assert.equal(queryCount, 0);
    assert.equal(constructedWith?.connectionString, database.connectionString);

    errorListener?.(new Error('password authentication failed for secret-user'));
    assert.deepEqual(logEntries, [{ event: 'postgres_pool_error' }]);
  });
});
