import { strict as assert } from 'node:assert';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';

import { buildApp } from '../../src/app.js';
import { startBackend } from '../../src/server.js';
import { SequenceDatabase, testConfig } from './helpers.js';

describe('HTTP startup while PostgreSQL is unavailable', () => {
  async function reservePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Failed to reserve an HTTP test port.');
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
    return address.port;
  }

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

  it('composes the real MP-33B server and opens health before PostgreSQL recovers', async () => {
    const port = await reservePort();
    const running = await startBackend({
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://runtime:local@127.0.0.1:1/tche_agro_test',
      HOST: '127.0.0.1',
      PORT: String(port),
      LOG_LEVEL: 'silent',
      ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'http-startup-test-v1',
      ADMIN_USER_CURSOR_KEYS: JSON.stringify({
        'http-startup-test-v1': Buffer.alloc(32, 0x44).toString('base64'),
      }),
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    } finally {
      running.shutdown.unregister();
      await running.shutdown.shutdown('manual');
    }
  });
});
