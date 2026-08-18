import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

import {
  buildDatabaseConfig,
  type DatabaseConfig,
} from '../../src/config.js';

export interface StartedPostgisTestDatabase {
  container: StartedPostgreSqlContainer;
  connectionString: string;
  database: DatabaseConfig;
}

export async function startPostgisTestDatabase(): Promise<StartedPostgisTestDatabase> {
  const container = await new PostgreSqlContainer('postgis/postgis:17-3.5')
    .withDatabase('tche_agro_test')
    .withUsername('tche_agro_test_user')
    .withPassword('testcontainer_only_password')
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
