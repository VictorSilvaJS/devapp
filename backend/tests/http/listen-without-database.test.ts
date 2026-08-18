import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildApp } from '../../src/app.js';
import { SequenceDatabase, testConfig } from './helpers.js';

describe('HTTP startup while PostgreSQL is unavailable', () => {
  it('opens the real HTTP port and readiness recovers in the same process', async () => {
    const database = new SequenceDatabase([
      new Error('temporary PostgreSQL outage'),
      '3.5 USE_GEOS=1',
    ]);
    let requestSequence = 0;
    const app = await buildApp({
      config: testConfig,
      database,
      logger: false,
      requestIdFactory: () => `req_listen_${++requestSequence}`,
    });

    try {
      const address = await app.listen({ host: '127.0.0.1', port: 0 });

      const health = await fetch(`${address}/v1/health`, {
        headers: { 'x-request-id': 'req_external' },
      });
      assert.equal(health.status, 200);
      assert.equal(health.headers.get('x-request-id'), 'req_listen_1');
      assert.deepEqual(await health.json(), { status: 'ok' });
      assert.equal(database.queries.length, 0);

      const unavailable = await fetch(`${address}/v1/readiness`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), {
        status: 'not_ready',
        request_id: 'req_listen_2',
      });

      const recovered = await fetch(`${address}/v1/readiness`);
      assert.equal(recovered.status, 200);
      assert.deepEqual(await recovered.json(), { status: 'ready' });
    } finally {
      await app.close();
    }
  });
});
