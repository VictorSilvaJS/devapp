import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createServer } from 'node:net';

import {
  buildDatabaseConfig,
  type DatabaseConfig,
} from '../../src/config.js';

export interface StartedPostgisTestDatabase {
  container: StartedPostgreSqlContainer;
  connectionString: string;
  database: DatabaseConfig;
}

async function reserveAvailableHostPort(): Promise<number> {
  const server = createServer();

  return new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Nao foi possivel reservar uma porta TCP local.')));
        return;
      }

      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function ensureExplicitRyukPort(): Promise<void> {
  if (
    process.env.TESTCONTAINERS_RYUK_DISABLED === 'true' ||
    process.env.TESTCONTAINERS_RYUK_PORT !== undefined
  ) {
    return;
  }

  process.env.TESTCONTAINERS_RYUK_PORT = String(
    await reserveAvailableHostPort(),
  );
}

export async function startPostgisTestDatabase(): Promise<StartedPostgisTestDatabase> {
  // Docker Desktop 4.47 / Engine 28 pode manter HostPort="0" sem publicar a
  // porta. Um binding explicito preserva o isolamento do Testcontainer e evita
  // que a suite recorra a qualquer DATABASE_URL do ambiente.
  await ensureExplicitRyukPort();
  const hostPort = await reserveAvailableHostPort();
  const container = await new PostgreSqlContainer('postgis/postgis:17-3.5')
    .withDatabase('tche_agro_test')
    .withUsername('tche_agro_test_user')
    .withPassword('testcontainer_only_password')
    .withExposedPorts({ container: 5432, host: hostPort })
    .withStartupTimeout(120_000)
    .start();
  const connectionString = container.getConnectionUri();

  return {
    container,
    connectionString,
    database: buildDatabaseConfig({
      nodeEnv: 'test',
      databaseUrl: connectionString,
    }),
  };
}
