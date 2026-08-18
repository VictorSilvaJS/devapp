import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildApp } from '../../src/app.js';
import type { TimedReadinessQuery } from '../../src/database/readiness.js';
import {
  SequenceDatabase,
  capturedLogger,
  testConfig,
} from './helpers.js';

describe('HTTP readiness', () => {
  it('returns 503 safely and recovers to 200 on a later request', async () => {
    const rawDatabaseMessage =
      'password authentication failed for postgres://secret@private-db/prod';
    const database = new SequenceDatabase([
      new Error(rawDatabaseMessage),
      '3.5 USE_GEOS=1',
    ]);
    const captured = capturedLogger();
    let requestSequence = 0;
    const app = await buildApp({
      config: testConfig,
      database,
      logger: captured.logger,
      requestIdFactory: () => `req_${++requestSequence}`,
    });

    try {
      const unavailable = await app.inject({
        method: 'GET',
        url: '/v1/readiness',
      });
      assert.equal(unavailable.statusCode, 503);
      assert.deepEqual(unavailable.json(), {
        status: 'not_ready',
        request_id: 'req_1',
      });

      const recovered = await app.inject({
        method: 'GET',
        url: '/v1/readiness',
      });
      assert.equal(recovered.statusCode, 200);
      assert.deepEqual(recovered.json(), { status: 'ready' });

      assert.equal(database.queries.length, 2);
      assert.equal(
        (database.queries[0] as TimedReadinessQuery).query_timeout,
        2_000,
      );
      assert.equal(
        database.queries[0]?.text,
        "SELECT extversion AS postgis_version FROM pg_catalog.pg_extension WHERE extname = 'postgis'",
      );
      assert.doesNotMatch(captured.output(), /password authentication failed/);
      assert.doesNotMatch(captured.output(), /private-db/);
      assert.doesNotMatch(captured.output(), /secret/);
      assert.match(captured.output(), /readiness_check_failed/);
    } finally {
      await app.close();
    }
  });

  it('enforces the deadline even when the injected database never settles', async () => {
    const app = await buildApp({
      config: testConfig,
      database: new SequenceDatabase(['never']),
      logger: false,
      readinessTimeoutMs: 10,
      requestIdFactory: () => 'req_timeout',
    });

    try {
      const startedAt = performance.now();
      const response = await app.inject({
        method: 'GET',
        url: '/v1/readiness',
      });
      const elapsedMs = performance.now() - startedAt;

      assert.equal(response.statusCode, 503);
      assert.equal(response.json().status, 'not_ready');
      assert.ok(elapsedMs < 1_000, `readiness took ${elapsedMs} ms`);
    } finally {
      await app.close();
    }
  });
});
