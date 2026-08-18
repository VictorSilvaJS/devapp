import type { SafeLogger } from './observability/logger.js';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'startup_failure' | 'manual';

export interface GracefulShutdownController {
  shutdown(signal?: ShutdownSignal): Promise<void>;
  register(): void;
  unregister(): void;
}

export interface GracefulShutdownOptions {
  readonly app: {
    close(): Promise<unknown>;
  };
  readonly database: {
    end(): Promise<unknown>;
  };
  readonly logger: SafeLogger;
  readonly onFailure?: () => void;
}

export function createGracefulShutdown(
  options: GracefulShutdownOptions,
): GracefulShutdownController {
  let shutdownPromise: Promise<void> | undefined;
  let registered = false;

  const closeResources = async (signal: ShutdownSignal): Promise<void> => {
    options.logger.info(
      { event: 'shutdown_started', signal },
      'Graceful shutdown started.',
    );

    let closeFailed = false;

    try {
      await options.app.close();
    } catch {
      closeFailed = true;
      options.logger.error(
        { event: 'http_shutdown_failed' },
        'Fastify shutdown failed.',
      );
    }

    try {
      await options.database.end();
    } catch {
      closeFailed = true;
      options.logger.error(
        { event: 'postgres_shutdown_failed' },
        'PostgreSQL pool shutdown failed.',
      );
    }

    if (closeFailed) {
      throw new Error('Graceful shutdown failed.');
    }

    options.logger.info(
      { event: 'shutdown_completed', signal },
      'Graceful shutdown completed.',
    );
  };

  const shutdown = (signal: ShutdownSignal = 'manual'): Promise<void> => {
    shutdownPromise ??= closeResources(signal);
    return shutdownPromise;
  };

  const handleSigint = (): void => {
    void shutdown('SIGINT').catch(() => options.onFailure?.());
  };

  const handleSigterm = (): void => {
    void shutdown('SIGTERM').catch(() => options.onFailure?.());
  };

  const register = (): void => {
    if (registered) return;
    registered = true;
    process.once('SIGINT', handleSigint);
    process.once('SIGTERM', handleSigterm);
  };

  const unregister = (): void => {
    if (!registered) return;
    registered = false;
    process.off('SIGINT', handleSigint);
    process.off('SIGTERM', handleSigterm);
  };

  return { shutdown, register, unregister };
}
