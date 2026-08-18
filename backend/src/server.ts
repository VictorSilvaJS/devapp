import { fileURLToPath } from 'node:url';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { buildApp } from './app.js';
import { loadRuntimeConfig, type RuntimeConfig } from './config.js';
import { createPostgresPool } from './database/pool.js';
import { createAppLogger } from './observability/logger.js';
import {
  createGracefulShutdown,
  type GracefulShutdownController,
} from './shutdown.js';

export interface RunningBackend {
  readonly app: FastifyInstance;
  readonly database: Pool;
  readonly config: RuntimeConfig;
  readonly shutdown: GracefulShutdownController;
}

export async function startBackend(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<RunningBackend> {
  const config = loadRuntimeConfig(environment);
  const logger = createAppLogger(config.logLevel);
  const database = createPostgresPool(config.database, logger);
  const app = await buildApp({
    config,
    database,
    logger: logger as FastifyBaseLogger,
  });
  const shutdown = createGracefulShutdown({
    app,
    database,
    logger,
    onFailure: () => {
      process.exitCode = 1;
    },
  });

  shutdown.register();

  try {
    await app.listen({ host: config.host, port: config.port });
    logger.info({ event: 'http_started' }, 'HTTP server started.');
  } catch {
    shutdown.unregister();
    await shutdown.shutdown('startup_failure').catch(() => undefined);
    throw new Error('Backend startup failed.');
  }

  return { app, database, config, shutdown };
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && fileURLToPath(import.meta.url) === entryPoint;
}

if (isMainModule()) {
  void startBackend().catch(() => {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'backend_startup_failed',
        message: 'Backend startup failed.',
      })}\n`,
    );
    process.exitCode = 1;
  });
}
