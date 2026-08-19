import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type {
  ClaimedOutboxMessage,
  OutboxRepository,
} from '../../src/outbox/contracts.js';
import {
  OutboxDeliveryError,
  OutboxWorker,
  type OutboxDispatcher,
  type OutboxWorkerResult,
} from '../../src/outbox/worker.js';
import {
  createOutboxPollingLoop,
  outboxWorkerEnvironment,
} from '../../src/outbox/server.js';

function claimedMessage(
  id: string,
  overrides: Partial<ClaimedOutboxMessage> = {},
): ClaimedOutboxMessage {
  return {
    id,
    organizationId: 'org_tche_fertilidade',
    messageType: 'test.v1',
    payload: {
      version: 1,
      algorithm: 'aes-256-gcm',
      keyId: 'test',
      iv: 'iv',
      ciphertext: 'ciphertext',
      authenticationTag: 'tag',
    },
    attempt: 1,
    maxAttempts: 5,
    expiresAt: new Date('2026-08-20T00:00:00.000Z'),
    leaseToken: `lease-${id}`,
    ...overrides,
  };
}

class FakeOutboxRepository implements OutboxRepository {
  readonly messages: readonly ClaimedOutboxMessage[];
  challengeActive = true;
  delivered: string[] = [];
  cancelled: string[] = [];
  retried: Array<{ id: string; nextAttemptAt: Date }> = [];
  failed: string[] = [];

  constructor(messages: readonly ClaimedOutboxMessage[]) {
    this.messages = messages;
  }

  async claimReady(): Promise<readonly ClaimedOutboxMessage[]> {
    return this.messages;
  }

  async isChallengeActive(): Promise<boolean> {
    return this.challengeActive;
  }

  async markDelivered(input: { readonly messageId: string }): Promise<boolean> {
    this.delivered.push(input.messageId);
    return true;
  }

  async markCancelled(input: { readonly messageId: string }): Promise<boolean> {
    this.cancelled.push(input.messageId);
    return true;
  }

  async reschedule(input: {
    readonly messageId: string;
    readonly nextAttemptAt: Date;
  }): Promise<boolean> {
    this.retried.push({ id: input.messageId, nextAttemptAt: input.nextAttemptAt });
    return true;
  }

  async markFailed(input: { readonly messageId: string }): Promise<boolean> {
    this.failed.push(input.messageId);
    return true;
  }
}

describe('concurrency-safe outbox worker contract', () => {
  it('respects worker concurrency and completes each claimed lease', async () => {
    const repository = new FakeOutboxRepository([
      claimedMessage('one'),
      claimedMessage('two'),
      claimedMessage('three'),
    ]);
    let active = 0;
    let maximumActive = 0;
    const dispatcher: OutboxDispatcher = {
      supports: () => true,
      async dispatch() {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => setImmediate(resolve));
        active -= 1;
        return {};
      },
    };
    const worker = new OutboxWorker({
      repository,
      dispatchers: [dispatcher],
      workerId: 'worker-1',
      concurrency: 2,
      clock: () => new Date('2026-08-19T00:00:00.000Z'),
    });

    const result = await worker.runOnce();

    assert.equal(maximumActive, 2);
    assert.deepEqual(repository.delivered.sort(), ['one', 'three', 'two']);
    assert.deepEqual(result, {
      claimed: 3,
      delivered: 3,
      retried: 0,
      failed: 0,
      cancelled: 0,
      staleLease: 0,
    });
  });

  it('revalidates a linked challenge before delivery', async () => {
    const repository = new FakeOutboxRepository([
      claimedMessage('challenge-message', { challengeId: 'challenge-1' }),
    ]);
    repository.challengeActive = false;
    let dispatched = false;
    const worker = new OutboxWorker({
      repository,
      dispatchers: [
        {
          supports: () => true,
          async dispatch() {
            dispatched = true;
            return {};
          },
        },
      ],
      workerId: 'worker-1',
      clock: () => new Date('2026-08-19T00:00:00.000Z'),
    });

    const result = await worker.runOnce();

    assert.equal(dispatched, false);
    assert.deepEqual(repository.cancelled, ['challenge-message']);
    assert.equal(result.cancelled, 1);
  });

  it('uses bounded exponential retry and stops on non-retryable failures', async () => {
    const retryRepository = new FakeOutboxRepository([
      claimedMessage('retry', { attempt: 3 }),
    ]);
    const failingDispatcher: OutboxDispatcher = {
      supports: () => true,
      async dispatch() {
        throw new OutboxDeliveryError('smtp_temporary', true);
      },
    };
    const now = new Date('2026-08-19T00:00:00.000Z');
    const retryWorker = new OutboxWorker({
      repository: retryRepository,
      dispatchers: [failingDispatcher],
      workerId: 'worker-1',
      baseBackoffMs: 1_000,
      jitter: () => 0.5,
      clock: () => now,
    });

    const retryResult = await retryWorker.runOnce();
    assert.equal(retryResult.retried, 1);
    assert.equal(
      retryRepository.retried[0]?.nextAttemptAt.toISOString(),
      '2026-08-19T00:00:04.000Z',
    );

    const failedRepository = new FakeOutboxRepository([claimedMessage('bad')]);
    const failedWorker = new OutboxWorker({
      repository: failedRepository,
      dispatchers: [
        {
          supports: () => true,
          async dispatch() {
            throw new OutboxDeliveryError('payload_invalid', false);
          },
        },
      ],
      workerId: 'worker-2',
      clock: () => now,
    });
    const failedResult = await failedWorker.runOnce();

    assert.deepEqual(failedRepository.failed, ['bad']);
    assert.equal(failedResult.failed, 1);
    assert.equal(failedResult.retried, 0);
  });
});

describe('outbox process wiring', () => {
  it('requires a distinct worker database credential in production', () => {
    assert.throws(() =>
      outboxWorkerEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://runtime:secret@db/prod',
      }),
    );

    const selected = outboxWorkerEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://runtime:secret@db/prod',
      OUTBOX_DATABASE_URL: 'postgresql://worker:secret@db/prod',
      DATABASE_SSL_CA: 'runtime-ca',
      OUTBOX_DATABASE_SSL_CA: 'worker-ca',
    });
    assert.equal(
      selected.DATABASE_URL,
      'postgresql://worker:secret@db/prod',
    );
    assert.equal(selected.DATABASE_SSL_CA, 'worker-ca');
  });

  it('stops an in-flight polling loop idempotently without another cycle', async () => {
    let releaseCycle: ((value: OutboxWorkerResult) => void) | undefined;
    let cycles = 0;
    const worker = {
      runOnce(): Promise<OutboxWorkerResult> {
        cycles += 1;
        return new Promise((resolve) => {
          releaseCycle = resolve;
        });
      },
    };
    const loop = createOutboxPollingLoop({
      worker,
      pollIntervalMs: 100,
      logger: { info() {}, warn() {}, error() {} },
    });

    const firstStop = loop.stop();
    const secondStop = loop.stop();
    assert.equal(firstStop, secondStop);
    releaseCycle?.({
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
      cancelled: 0,
      staleLease: 0,
    });
    await firstStop;
    assert.equal(cycles, 1);
  });
});
