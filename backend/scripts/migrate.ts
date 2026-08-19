import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runner as nodePgMigrateRunner } from 'node-pg-migrate';

import {
  ConfigurationError,
  loadRuntimeConfig,
  type DatabaseConfig,
} from '../src/config.js';
import { buildPostgresPoolConfig } from '../src/database/pool.js';
import {
  MigrationIntegrityError,
  verifyMigrationIntegrity,
} from './migration-integrity.js';

export type MigrationCommand = 'up' | 'down' | 'redo';

export interface RunMigrationsOptions {
  command: MigrationCommand;
  database: DatabaseConfig;
  count?: number;
  migrationsDirectory?: string;
  verify?: typeof verifyMigrationIntegrity;
  runner?: typeof nodePgMigrateRunner;
}

export class MigrationCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MigrationCommandError';
  }
}

export function migrationEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  const migrationDatabaseUrl = source.MIGRATIONS_DATABASE_URL;
  if (source.NODE_ENV === 'production' && migrationDatabaseUrl === undefined) {
    throw new ConfigurationError(
      'MIGRATIONS_DATABASE_URL is required in production.',
    );
  }

  return {
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: migrationDatabaseUrl ?? source.DATABASE_URL,
    DATABASE_SSL_CA:
      source.MIGRATIONS_DATABASE_SSL_CA ?? source.DATABASE_SSL_CA,
    HOST: source.HOST,
    PORT: source.PORT,
    LOG_LEVEL: source.LOG_LEVEL,
  };
}

function discardMigrationLog(_message: string): void {
  // node-pg-migrate pode emitir SQL e mensagens internas do PostgreSQL. A
  // observabilidade da aplicacao nao deve receber esse conteudo bruto.
}

export const SILENT_MIGRATION_LOGGER = Object.freeze({
  debug: discardMigrationLog,
  info: discardMigrationLog,
  warn: discardMigrationLog,
  error: discardMigrationLog,
});

export function safeMigrationErrorMessage(error: unknown): string {
  if (
    error instanceof MigrationCommandError
    || error instanceof MigrationIntegrityError
    || error instanceof ConfigurationError
  ) {
    return error.message;
  }

  return 'Falha interna ao executar a migration.';
}

function assertMigrationCount(count: number | undefined): void {
  if (count !== undefined && (!Number.isSafeInteger(count) || count <= 0)) {
    throw new MigrationCommandError(
      'A quantidade de migrations deve ser um inteiro positivo.',
    );
  }
}

export async function runMigrations(options: RunMigrationsOptions): Promise<void> {
  assertMigrationCount(options.count);
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const migrationsDirectory = resolve(
    options.migrationsDirectory ?? resolve(scriptDirectory, '..', 'migrations'),
  );
  const verify = options.verify ?? verifyMigrationIntegrity;
  const migrationRunner = options.runner ?? nodePgMigrateRunner;

  await verify({ migrationsDirectory });

  const commonOptions = {
    databaseUrl: buildPostgresPoolConfig(options.database),
    dir: migrationsDirectory,
    schema: 'public',
    migrationsSchema: 'public',
    createSchema: false,
    createMigrationsSchema: false,
    migrationsTable: 'tche_agro_migrations',
    ignorePattern: '(?:\\..*|manifest\\.json)',
    checkOrder: true,
    singleTransaction: true,
    migrationLoaderStrategies: [
      { extensions: ['.sql'], loader: 'legacySql' as const },
    ],
    logger: SILENT_MIGRATION_LOGGER,
    verbose: false,
  };

  if (options.command === 'redo') {
    const redoCount = options.count ?? 1;
    await migrationRunner({
      ...commonOptions,
      direction: 'down',
      count: redoCount,
    });
    await migrationRunner({
      ...commonOptions,
      direction: 'up',
      count: redoCount,
    });
    return;
  }

  await migrationRunner({
    ...commonOptions,
    direction: options.command,
    ...(options.count === undefined ? {} : { count: options.count }),
  });
}

function parseCliArguments(args: readonly string[]): {
  command: MigrationCommand;
  count?: number;
} {
  const [command, rawCount, ...remaining] = args;
  if (command !== 'up' && command !== 'down' && command !== 'redo') {
    throw new MigrationCommandError('Use migrate.ts up, down ou redo.');
  }
  if (remaining.length > 0) {
    throw new MigrationCommandError('Foram informados argumentos excedentes.');
  }
  if (rawCount === undefined) {
    return { command };
  }

  const count = Number(rawCount);
  assertMigrationCount(count);
  return { command, count };
}

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const runtimeConfig = loadRuntimeConfig(migrationEnvironment(process.env));
    await runMigrations({ ...options, database: runtimeConfig.database });
    process.stdout.write(`Migration ${options.command} concluida.\n`);
  } catch (error) {
    const message = safeMigrationErrorMessage(error);
    process.stderr.write(`Migration falhou: ${message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined
  && pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
