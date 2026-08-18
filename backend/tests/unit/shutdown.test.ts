import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { SafeLogger } from '../../src/observability/logger.js';
import { createGracefulShutdown } from '../../src/shutdown.js';

function silentLogger(entries: string[] = []): SafeLogger {
  return {
    info(bindings) {
      entries.push(String(bindings.event));
    },
    warn() {},
    error(bindings) {
      entries.push(String(bindings.event));
    },
  };
}

describe('graceful shutdown', () => {
  it('is idempotent and closes Fastify before the PostgreSQL pool', async () => {
    const calls: string[] = [];
    const controller = createGracefulShutdown({
      app: {
        async close() {
          calls.push('fastify.close');
        },
      },
      database: {
        async end() {
          calls.push('pool.end');
        },
      },
      logger: silentLogger(),
    });

    const first = controller.shutdown('SIGTERM');
    const second = controller.shutdown('SIGINT');

    assert.equal(first, second);
    await Promise.all([first, second]);
    assert.deepEqual(calls, ['fastify.close', 'pool.end']);
  });

  it('still closes the pool when Fastify close fails and logs no raw error', async () => {
    const calls: string[] = [];
    const logEvents: string[] = [];
    const controller = createGracefulShutdown({
      app: {
        async close() {
          calls.push('fastify.close');
          throw new Error('internal close failure with a secret');
        },
      },
      database: {
        async end() {
          calls.push('pool.end');
        },
      },
      logger: silentLogger(logEvents),
    });

    await assert.rejects(
      () => controller.shutdown(),
      /Graceful shutdown failed/,
    );
    assert.deepEqual(calls, ['fastify.close', 'pool.end']);
    assert.deepEqual(logEvents, ['shutdown_started', 'http_shutdown_failed']);
  });

  it('registers signal handlers only once and removes them explicitly', () => {
    const initialSigint = process.listenerCount('SIGINT');
    const initialSigterm = process.listenerCount('SIGTERM');
    const controller = createGracefulShutdown({
      app: { async close() {} },
      database: { async end() {} },
      logger: silentLogger(),
    });

    try {
      controller.register();
      controller.register();
      assert.equal(process.listenerCount('SIGINT'), initialSigint + 1);
      assert.equal(process.listenerCount('SIGTERM'), initialSigterm + 1);
    } finally {
      controller.unregister();
    }

    assert.equal(process.listenerCount('SIGINT'), initialSigint);
    assert.equal(process.listenerCount('SIGTERM'), initialSigterm);
  });
});
