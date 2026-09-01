import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';

import {
  buildDatabaseConfig,
  type DatabaseConfig,
} from '../../src/config.js';

export interface StartedPostgisTestDatabase {
  container: StartedPostgreSqlContainer;
  connectionString: string;
  database: DatabaseConfig;
  hostPort: number;
}

export async function startPostgisTestDatabase(): Promise<StartedPostgisTestDatabase> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const container = await new PostgreSqlContainer('postgis/postgis:17-3.5')
    .withDatabase(`tche_agro_${suffix}_test`)
    .withUsername(`tche_test_${suffix}`)
    .withPassword('testcontainer_only_password')
    .withExposedPorts(5432)
    .withStartupTimeout(120_000)
    .start();
  const connectionString = container.getConnectionUri();

  return {
    container,
    connectionString,
    hostPort: container.getMappedPort(5432),
    database: buildDatabaseConfig({
      nodeEnv: 'test',
      databaseUrl: connectionString,
    }),
  };
}
