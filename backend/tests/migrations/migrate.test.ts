import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { runner as NodePgMigrateRunner } from 'node-pg-migrate';

import { buildDatabaseConfig } from '../../src/config.js';
import {
  MigrationCommandError,
  SILENT_MIGRATION_LOGGER,
  runMigrations,
  safeMigrationErrorMessage,
} from '../../scripts/migrate.js';

const database = buildDatabaseConfig({
  nodeEnv: 'test',
  databaseUrl: 'postgresql://test:test@127.0.0.1:5432/tche_agro_test',
});

test('verifica a integridade antes de executar up', async () => {
  const events: string[] = [];
  let receivedOptions: Parameters<typeof NodePgMigrateRunner>[0] | undefined;
  const runner = (async (options) => {
    events.push('runner');
    receivedOptions = options;
    return [];
  }) as typeof NodePgMigrateRunner;

  await runMigrations({
    command: 'up',
    database,
    verify: async () => {
      events.push('verify');
      return { checkedMigrations: 1, checkedAgainstBase: null };
    },
    runner,
  });

  assert.deepEqual(events, ['verify', 'runner']);
  assert.equal(receivedOptions?.ignorePattern, '(?:\\..*|manifest\\.json)');
  assert.equal(receivedOptions?.logger, SILENT_MIGRATION_LOGGER);
  assert.equal(receivedOptions?.schema, 'public');
  assert.equal(receivedOptions?.migrationsSchema, 'public');
  assert.equal(receivedOptions?.createSchema, false);
  assert.equal(receivedOptions?.createMigrationsSchema, false);
});

test('logger do runner descarta SQL, segredos e mensagens internas', () => {
  const sensitiveMessages = [
    'SELECT password, token FROM usuarios',
    'postgresql://usuario:segredo@database.internal/producao',
    'password authentication failed for user privado',
  ];

  for (const message of sensitiveMessages) {
    assert.equal(SILENT_MIGRATION_LOGGER.debug(message), undefined);
    assert.equal(SILENT_MIGRATION_LOGGER.info(message), undefined);
    assert.equal(SILENT_MIGRATION_LOGGER.warn(message), undefined);
    assert.equal(SILENT_MIGRATION_LOGGER.error(message), undefined);
  }
});

test('verifica a integridade antes de executar down', async () => {
  const events: string[] = [];
  const runner = (async () => {
    events.push('runner');
    return [];
  }) as typeof NodePgMigrateRunner;

  await runMigrations({
    command: 'down',
    database,
    verify: async () => {
      events.push('verify');
      return { checkedMigrations: 1, checkedAgainstBase: null };
    },
    runner,
  });

  assert.deepEqual(events, ['verify', 'runner']);
});

test('verifica uma vez antes do par down/up de redo', async () => {
  const events: string[] = [];
  const directions: string[] = [];
  const runner = (async (options) => {
    events.push('runner');
    directions.push(options.direction);
    return [];
  }) as typeof NodePgMigrateRunner;

  await runMigrations({
    command: 'redo',
    count: 2,
    database,
    verify: async () => {
      events.push('verify');
      return { checkedMigrations: 1, checkedAgainstBase: null };
    },
    runner,
  });

  assert.deepEqual(events, ['verify', 'runner', 'runner']);
  assert.deepEqual(directions, ['down', 'up']);
});

test('nao chama o runner quando a verificacao falha', async () => {
  let runnerWasCalled = false;
  const runner = (async () => {
    runnerWasCalled = true;
    return [];
  }) as typeof NodePgMigrateRunner;

  await assert.rejects(
    runMigrations({
      command: 'up',
      database,
      verify: async () => {
        throw new Error('migration alterada');
      },
      runner,
    }),
    /migration alterada/,
  );
  assert.equal(runnerWasCalled, false);
});

test('nao expoe mensagens internas do PostgreSQL no CLI', () => {
  const rawDatabaseError = new Error(
    'password authentication failed for postgresql://secret@private/prod',
  );

  assert.equal(
    safeMigrationErrorMessage(rawDatabaseError),
    'Falha interna ao executar a migration.',
  );
  assert.equal(
    safeMigrationErrorMessage(new MigrationCommandError('Comando invalido.')),
    'Comando invalido.',
  );
});
