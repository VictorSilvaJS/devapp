import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  assertAppendOnlyMigrations,
  migrationSha256,
  normalizeMigrationSql,
  parseBaseRef,
  verifyMigrationIntegrity,
  type MigrationManifest,
  type MigrationManifestEntry,
  type MigrationSnapshot,
} from '../../scripts/migration-integrity.js';

const temporaryDirectories: string[] = [];
const validSql = `-- Up Migration

SELECT 1;

-- Down Migration

SELECT 2;
`;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function checksum(sql: string): string {
  return migrationSha256(normalizeMigrationSql(Buffer.from(sql, 'utf8')));
}

function manifest(entries: MigrationManifestEntry[]): MigrationManifest {
  return {
    version: 1,
    algorithm: 'sha256',
    normalization: 'utf8-lf',
    migrations: entries,
  };
}

async function createFixture(
  files: Readonly<Record<string, string>>,
  entries: MigrationManifestEntry[],
): Promise<{ directory: string; manifestPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'tche-migrations-'));
  temporaryDirectories.push(root);
  const directory = join(root, 'migrations');
  const manifestPath = join(directory, 'manifest.json');
  await mkdir(directory);
  await Promise.all(
    Object.entries(files).map(([file, sql]) => writeFile(join(directory, file), sql, 'utf8')),
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest(entries), null, 2)}\n`, 'utf8');
  return { directory, manifestPath };
}

function snapshot(entries: MigrationManifestEntry[]): MigrationSnapshot {
  return {
    manifest: manifest(entries),
    normalizedSqlByFile: new Map(),
  };
}

test('aceita manifesto selado e normaliza CRLF para o mesmo SHA-256', async () => {
  const file = '000001-valid.sql';
  const fixture = await createFixture(
    { [file]: validSql.replace(/\n/g, '\r\n') },
    [{ id: '000001', file, sha256: checksum(validSql) }],
  );

  const result = await verifyMigrationIntegrity({
    migrationsDirectory: fixture.directory,
    manifestPath: fixture.manifestPath,
  });

  assert.equal(result.checkedMigrations, 1);
  assert.equal(result.checkedAgainstBase, null);
});

test('rejeita hash divergente', async () => {
  const file = '000001-valid.sql';
  const fixture = await createFixture(
    { [file]: validSql.replace('SELECT 1', 'SELECT 3') },
    [{ id: '000001', file, sha256: checksum(validSql) }],
  );

  await assert.rejects(
    verifyMigrationIntegrity({
      migrationsDirectory: fixture.directory,
      manifestPath: fixture.manifestPath,
    }),
    /hash divergente/,
  );
});

test('rejeita arquivo SQL sem entrada no manifesto', async () => {
  const fixture = await createFixture(
    { '000001-valid.sql': validSql },
    [],
  );

  await assert.rejects(
    verifyMigrationIntegrity({
      migrationsDirectory: fixture.directory,
      manifestPath: fixture.manifestPath,
    }),
    /arquivo sem entrada/,
  );
});

test('rejeita entrada no manifesto sem arquivo', async () => {
  const fixture = await createFixture(
    {},
    [{ id: '000001', file: '000001-valid.sql', sha256: checksum(validSql) }],
  );

  await assert.rejects(
    verifyMigrationIntegrity({
      migrationsDirectory: fixture.directory,
      manifestPath: fixture.manifestPath,
    }),
    /sem arquivo correspondente/,
  );
});

test('rejeita identificador duplicado', async () => {
  const fixture = await createFixture(
    {
      '000001-first.sql': validSql,
      '000001-second.sql': validSql,
    },
    [
      { id: '000001', file: '000001-first.sql', sha256: checksum(validSql) },
      { id: '000001', file: '000001-second.sql', sha256: checksum(validSql) },
    ],
  );

  await assert.rejects(
    verifyMigrationIntegrity({
      migrationsDirectory: fixture.directory,
      manifestPath: fixture.manifestPath,
    }),
    /identificador duplicado/,
  );
});

test('rejeita migration sem as duas secoes explicitas', async () => {
  const file = '000001-valid.sql';
  const sqlWithoutDown = '-- Up Migration\n\nSELECT 1;\n';
  const fixture = await createFixture(
    { [file]: sqlWithoutDown },
    [{ id: '000001', file, sha256: checksum(sqlWithoutDown) }],
  );

  await assert.rejects(
    verifyMigrationIntegrity({
      migrationsDirectory: fixture.directory,
      manifestPath: fixture.manifestPath,
    }),
    /exatamente uma secao/,
  );
});

test('rejeita exclusao, renomeacao e alteracao de migration integrada', () => {
  const integrated: MigrationManifestEntry = {
    id: '000001',
    file: '000001-integrated.sql',
    sha256: 'a'.repeat(64),
  };
  const base = snapshot([integrated]);

  assert.throws(
    () => assertAppendOnlyMigrations(snapshot([]), base, 'origin/main'),
    /excluida/,
  );
  assert.throws(
    () => assertAppendOnlyMigrations(
      snapshot([{ ...integrated, file: '000001-renamed.sql' }]),
      base,
      'origin/main',
    ),
    /renomeada/,
  );
  assert.throws(
    () => assertAppendOnlyMigrations(
      snapshot([{ ...integrated, sha256: 'b'.repeat(64) }]),
      base,
      'origin/main',
    ),
    /alterada/,
  );
});

test('aceita somente novas entradas depois das migrations da branch-base', () => {
  const integrated: MigrationManifestEntry = {
    id: '000001',
    file: '000001-integrated.sql',
    sha256: 'a'.repeat(64),
  };
  const added: MigrationManifestEntry = {
    id: '000002',
    file: '000002-added.sql',
    sha256: 'b'.repeat(64),
  };

  assert.doesNotThrow(() =>
    assertAppendOnlyMigrations(snapshot([integrated, added]), snapshot([integrated]), 'origin/main'),
  );
});

test('rejeita branch-base vazia no CLI e na API de verificacao', async () => {
  assert.throws(() => parseBaseRef(['--base-ref=']), /valor nao vazio/);
  assert.throws(() => parseBaseRef(['--base-ref', '   ']), /valor nao vazio/);

  await assert.rejects(
    verifyMigrationIntegrity({ baseRef: '   ' }),
    /branch-base nao pode ser vazia/,
  );
});
