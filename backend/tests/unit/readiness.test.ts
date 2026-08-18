import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';

import {
  checkDatabaseReadiness,
  type TimedReadinessQuery,
} from '../../src/database/readiness.js';
import type { DatabasePool } from '../../src/database/pool.js';

function resultWithVersion(version: string | null): QueryResult<QueryResultRow> {
  return {
    command: 'SELECT',
    rowCount: 1,
    oid: 0,
    fields: [],
    rows: [{ postgis_version: version }],
  };
}

describe('database readiness check', () => {
  it('queries PostGIS with the short timeout', async () => {
    let queryConfig: QueryConfig | undefined;
    const database = {
      async query<Row extends QueryResultRow>(query: QueryConfig) {
        queryConfig = query;
        return resultWithVersion('3.5 USE_GEOS=1') as QueryResult<Row>;
      },
      async end() {},
    } satisfies DatabasePool;

    const result = await checkDatabaseReadiness(database);

    assert.deepEqual(result, { ready: true });
    assert.equal(
      queryConfig?.text,
      "SELECT extversion AS postgis_version FROM pg_catalog.pg_extension WHERE extname = 'postgis'",
    );
    assert.equal((queryConfig as TimedReadinessQuery).query_timeout, 2_000);
  });

  it('returns not ready for connection errors or a missing PostGIS version', async () => {
    const failingDatabase = {
      async query<Row extends QueryResultRow>(): Promise<QueryResult<Row>> {
        throw new Error('raw PostgreSQL connection details');
      },
      async end() {},
    } satisfies DatabasePool;
    const missingPostgisDatabase = {
      async query<Row extends QueryResultRow>(): Promise<QueryResult<Row>> {
        return resultWithVersion(null) as QueryResult<Row>;
      },
      async end() {},
    } satisfies DatabasePool;

    assert.deepEqual(await checkDatabaseReadiness(failingDatabase), {
      ready: false,
    });
    assert.deepEqual(await checkDatabaseReadiness(missingPostgisDatabase), {
      ready: false,
    });
  });

  it('enforces a maximum timeout of two seconds', async () => {
    const database = {
      async query<Row extends QueryResultRow>(): Promise<QueryResult<Row>> {
        return resultWithVersion('3.5') as QueryResult<Row>;
      },
      async end() {},
    } satisfies DatabasePool;

    await assert.rejects(
      () => checkDatabaseReadiness(database, 2_001),
      RangeError,
    );
  });
});
