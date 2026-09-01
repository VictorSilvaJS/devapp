import { Pool } from 'pg';

import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

async function main(): Promise<void> {
  const startBeganAt = Date.now();
  let database: StartedPostgisTestDatabase | undefined;
  let pool: Pool | undefined;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await pool?.end(); }
    finally { await database?.container.stop(); }
    process.send?.({ type: 'stopped', containerId: database?.container.getId() });
  };
  const exitAfterStop = () => { void stop().then(
    () => process.exit(0),
    (error: unknown) => {
      process.send?.({ type: 'error', message: error instanceof Error ? error.message : 'unknown' });
      process.exit(1);
    },
  ); };
  try {
    database = await startPostgisTestDatabase();
    pool = new Pool({ connectionString: database.connectionString });
    process.once('disconnect', exitAfterStop);
    process.once('SIGTERM', exitAfterStop);
    await pool.query('SELECT 1');
    const url = new URL(database.connectionString);
    process.send?.({
      type: 'started',
      containerId: database.container.getId(),
      hostPort: database.hostPort,
      databaseName: url.pathname.slice(1),
      startBeganAt,
      startedAt: Date.now(),
    });
    process.on('message', (message: unknown) => {
      if (typeof message === 'object' && message !== null
        && 'type' in message && message.type === 'stop') exitAfterStop();
    });
  } catch (error) {
    try { await stop(); } catch { /* preserve the startup error */ }
    throw error;
  }
}

main().catch((error: unknown) => {
  process.send?.({ type: 'error', message: error instanceof Error ? error.message : 'unknown' });
  process.exitCode = 1;
});
