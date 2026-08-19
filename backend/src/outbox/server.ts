import { fileURLToPath } from 'node:url';

import type { Pool } from 'pg';

import { ConfigurationError, loadRuntimeConfig } from '../config.js';
import { createPostgresPool } from '../database/pool.js';
import { loadEmailRuntimeConfig } from '../email/config.js';
import { createNodemailerSmtpEmailSender } from '../email/smtp.js';
import { createAppLogger, type SafeLogger } from '../observability/logger.js';
import { createOutboxPayloadCipherFromBase64KeyRing } from './crypto.js';
import { PostgresOutboxRepository } from './postgres-repository.js';
import { OutboxWorker, SmtpOutboxDispatcher } from './worker.js';

export interface OutboxWorkerProcess {
  readonly database: Pool;
  readonly completion: Promise<void>;
  stop(): Promise<void>;
}

export function outboxWorkerEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  const workerDatabaseUrl = source.OUTBOX_DATABASE_URL;
  if (source.NODE_ENV === 'production' && workerDatabaseUrl === undefined) {
    throw new ConfigurationError(
      'OUTBOX_DATABASE_URL is required in production.',
    );
  }

  return {
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: workerDatabaseUrl ?? source.DATABASE_URL,
    DATABASE_SSL_CA:
      source.OUTBOX_DATABASE_SSL_CA ?? source.DATABASE_SSL_CA,
    HOST: source.HOST,
    PORT: source.PORT,
    LOG_LEVEL: source.LOG_LEVEL,
  };
}

export function createOutboxPollingLoop(input: {
  readonly worker: Pick<OutboxWorker, 'runOnce'>;
  readonly pollIntervalMs: number;
  readonly logger: SafeLogger;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Readonly<{ completion: Promise<void>; stop(): Promise<void> }> {
  if (
    !Number.isSafeInteger(input.pollIntervalMs) ||
    input.pollIntervalMs < 100 ||
    input.pollIntervalMs > 60_000
  ) {
    throw new RangeError('Outbox poll interval is outside its approved range.');
  }

  const wait =
    input.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  let stopping = false;
  let stopPromise: Promise<void> | undefined;
  let releaseStopSignal: (() => void) | undefined;
  const stopSignal = new Promise<void>((resolve) => {
    releaseStopSignal = resolve;
  });

  const completion = (async (): Promise<void> => {
    while (!stopping) {
      try {
        const result = await input.worker.runOnce();
        if (result.claimed > 0) {
          input.logger.info(
            {
              event: 'outbox_cycle_completed',
              claimed: result.claimed,
              delivered: result.delivered,
              retried: result.retried,
              failed: result.failed,
              cancelled: result.cancelled,
              stale_lease: result.staleLease,
            },
            'Outbox delivery cycle completed.',
          );
        }
      } catch {
        input.logger.warn(
          { event: 'outbox_cycle_failed' },
          'Outbox delivery cycle failed and will be retried.',
        );
      }

      if (!stopping) {
        await Promise.race([wait(input.pollIntervalMs), stopSignal]);
      }
    }
  })();

  return Object.freeze({
    completion,
    stop(): Promise<void> {
      stopping = true;
      releaseStopSignal?.();
      stopPromise ??= completion;
      return stopPromise;
    },
  });
}

export async function startOutboxWorker(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<OutboxWorkerProcess> {
  const runtimeConfig = loadRuntimeConfig(outboxWorkerEnvironment(environment));
  const emailConfig = loadEmailRuntimeConfig(runtimeConfig.nodeEnv, environment);
  const logger = createAppLogger(runtimeConfig.logLevel);
  const database = createPostgresPool(
    runtimeConfig.database,
    logger,
    undefined,
    'tche_agro_outbox_worker',
  );

  let loop: ReturnType<typeof createOutboxPollingLoop>;
  try {
    const cipher = createOutboxPayloadCipherFromBase64KeyRing(
      emailConfig.outboxKeyRing,
    );
    const worker = new OutboxWorker({
      repository: new PostgresOutboxRepository({ pool: database }),
      dispatchers: [
        new SmtpOutboxDispatcher({
          cipher,
          sender: createNodemailerSmtpEmailSender(emailConfig.smtp),
        }),
      ],
      workerId: emailConfig.worker.id,
      concurrency: emailConfig.worker.concurrency,
      batchSize: emailConfig.worker.batchSize,
      logger,
    });
    loop = createOutboxPollingLoop({
      worker,
      pollIntervalMs: emailConfig.worker.pollIntervalMs,
      logger,
    });
  } catch {
    await database.end().catch(() => undefined);
    throw new Error('Outbox worker initialization failed.');
  }

  let shutdownPromise: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      await loop.stop();
      await database.end();
      logger.info(
        { event: 'outbox_worker_stopped' },
        'Outbox worker stopped.',
      );
    })();
    return shutdownPromise;
  };
  function onSignal(): void {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  }
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  logger.info(
    { event: 'outbox_worker_started' },
    'Outbox worker started.',
  );
  return Object.freeze({ database, completion: loop.completion, stop });
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && fileURLToPath(import.meta.url) === entryPoint;
}

if (isMainModule()) {
  try {
    const running = await startOutboxWorker();
    await running.completion;
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'outbox_worker_startup_failed',
        message: 'Outbox worker startup failed.',
      })}\n`,
    );
    process.exitCode = 1;
  }
}
