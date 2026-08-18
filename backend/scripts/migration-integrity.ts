import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';

const MANIFEST_VERSION = 1;
const HASH_ALGORITHM = 'sha256';
const NORMALIZATION = 'utf8-lf';
const MIGRATION_FILE_PATTERN = /^(?<id>\d{6})-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UP_MARKER = '-- Up Migration';
const DOWN_MARKER = '-- Down Migration';

export interface MigrationManifestEntry {
  id: string;
  file: string;
  sha256: string;
}

export interface MigrationManifest {
  version: number;
  algorithm: 'sha256';
  normalization: 'utf8-lf';
  migrations: MigrationManifestEntry[];
}

export interface MigrationSnapshot {
  manifest: MigrationManifest;
  normalizedSqlByFile: ReadonlyMap<string, string>;
}

export interface VerifyMigrationIntegrityOptions {
  migrationsDirectory?: string;
  manifestPath?: string;
  baseRef?: string;
  repositoryRoot?: string;
}

export interface MigrationIntegrityResult {
  checkedMigrations: number;
  checkedAgainstBase: string | null;
}

export class MigrationIntegrityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MigrationIntegrityError';
  }
}

function countExactLine(lines: readonly string[], marker: string): number {
  return lines.filter((line) => line === marker).length;
}

function firstNonBlankLine(lines: readonly string[]): string | undefined {
  return lines.find((line) => line.trim().length > 0);
}

function assertSqlSections(file: string, normalizedSql: string): void {
  const lines = normalizedSql.split('\n');
  const upCount = countExactLine(lines, UP_MARKER);
  const downCount = countExactLine(lines, DOWN_MARKER);

  if (upCount !== 1 || downCount !== 1) {
    throw new MigrationIntegrityError(
      `${file}: deve conter exatamente uma secao "${UP_MARKER}" e uma secao "${DOWN_MARKER}".`,
    );
  }

  if (firstNonBlankLine(lines) !== UP_MARKER) {
    throw new MigrationIntegrityError(
      `${file}: a primeira linha nao vazia deve ser "${UP_MARKER}".`,
    );
  }

  const upIndex = lines.indexOf(UP_MARKER);
  const downIndex = lines.indexOf(DOWN_MARKER);
  if (downIndex <= upIndex) {
    throw new MigrationIntegrityError(
      `${file}: a secao Down deve aparecer depois da secao Up.`,
    );
  }

  const upBody = lines.slice(upIndex + 1, downIndex).join('\n').trim();
  const downBody = lines.slice(downIndex + 1).join('\n').trim();
  if (upBody.length === 0 || downBody.length === 0) {
    throw new MigrationIntegrityError(
      `${file}: as secoes Up e Down devem ser explicitas e nao vazias.`,
    );
  }
}

export function normalizeMigrationSql(bytes: Uint8Array): string {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new MigrationIntegrityError('Migration SQL deve usar codificacao UTF-8 valida.');
  }

  if (decoded.startsWith('\uFEFF')) {
    throw new MigrationIntegrityError('Migration SQL deve usar UTF-8 sem BOM.');
  }

  return decoded.replace(/\r\n?/g, '\n');
}

export function migrationSha256(normalizedSql: string): string {
  return createHash(HASH_ALGORITHM).update(normalizedSql, 'utf8').digest('hex');
}

function parseManifest(raw: string, label: string): MigrationManifest {
  let unknownManifest: unknown;
  try {
    unknownManifest = JSON.parse(raw) as unknown;
  } catch {
    throw new MigrationIntegrityError(`${label}: JSON invalido.`);
  }

  if (
    typeof unknownManifest !== 'object'
    || unknownManifest === null
    || Array.isArray(unknownManifest)
  ) {
    throw new MigrationIntegrityError(`${label}: estrutura invalida.`);
  }

  const candidate = unknownManifest as Record<string, unknown>;
  if (
    candidate.version !== MANIFEST_VERSION
    || candidate.algorithm !== HASH_ALGORITHM
    || candidate.normalization !== NORMALIZATION
    || !Array.isArray(candidate.migrations)
  ) {
    throw new MigrationIntegrityError(
      `${label}: requer version=1, algorithm=sha256, normalization=utf8-lf e migrations[].`,
    );
  }

  const migrations = candidate.migrations.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new MigrationIntegrityError(`${label}: entrada ${index + 1} invalida.`);
    }

    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== 'string'
      || typeof item.file !== 'string'
      || typeof item.sha256 !== 'string'
    ) {
      throw new MigrationIntegrityError(
        `${label}: entrada ${index + 1} deve conter id, file e sha256 textuais.`,
      );
    }

    return {
      id: item.id,
      file: item.file,
      sha256: item.sha256,
    };
  });

  return {
    version: MANIFEST_VERSION,
    algorithm: HASH_ALGORITHM,
    normalization: NORMALIZATION,
    migrations,
  };
}

function assertManifestStructure(manifest: MigrationManifest, label: string): void {
  const ids = new Set<string>();
  const files = new Set<string>();
  let previousId: bigint | null = null;

  for (const [index, entry] of manifest.migrations.entries()) {
    const match = MIGRATION_FILE_PATTERN.exec(entry.file);
    const fileId = match?.groups?.id;
    if (fileId === undefined || entry.id !== fileId) {
      throw new MigrationIntegrityError(
        `${label}: entrada ${index + 1} possui arquivo/identificador invalido ou divergente.`,
      );
    }
    if (ids.has(entry.id)) {
      throw new MigrationIntegrityError(`${label}: identificador duplicado ${entry.id}.`);
    }
    if (files.has(entry.file)) {
      throw new MigrationIntegrityError(`${label}: arquivo duplicado ${entry.file}.`);
    }
    if (!SHA256_PATTERN.test(entry.sha256)) {
      throw new MigrationIntegrityError(`${label}: checksum invalido para ${entry.file}.`);
    }

    const numericId = BigInt(entry.id);
    if (previousId !== null && numericId <= previousId) {
      throw new MigrationIntegrityError(
        `${label}: as entradas devem estar em ordem crescente e append-only.`,
      );
    }

    previousId = numericId;
    ids.add(entry.id);
    files.add(entry.file);
  }
}

function inspectSnapshot(
  manifestRaw: string,
  sqlFiles: ReadonlyMap<string, Uint8Array>,
  label: string,
): MigrationSnapshot {
  const manifest = parseManifest(manifestRaw, label);
  assertManifestStructure(manifest, label);

  const manifestFiles = new Set(manifest.migrations.map((entry) => entry.file));
  const directoryFiles = [...sqlFiles.keys()].sort();

  for (const file of directoryFiles) {
    if (!MIGRATION_FILE_PATTERN.test(file)) {
      throw new MigrationIntegrityError(`${label}: nome de migration invalido: ${file}.`);
    }
    if (!manifestFiles.has(file)) {
      throw new MigrationIntegrityError(`${label}: arquivo sem entrada no manifesto: ${file}.`);
    }
  }

  const normalizedSqlByFile = new Map<string, string>();
  for (const entry of manifest.migrations) {
    const bytes = sqlFiles.get(entry.file);
    if (bytes === undefined) {
      throw new MigrationIntegrityError(
        `${label}: entrada no manifesto sem arquivo correspondente: ${entry.file}.`,
      );
    }

    let normalizedSql: string;
    try {
      normalizedSql = normalizeMigrationSql(bytes);
    } catch (error) {
      if (error instanceof MigrationIntegrityError) {
        throw new MigrationIntegrityError(`${label}/${entry.file}: ${error.message}`);
      }
      throw error;
    }
    assertSqlSections(entry.file, normalizedSql);
    const actualHash = migrationSha256(normalizedSql);
    if (actualHash !== entry.sha256) {
      throw new MigrationIntegrityError(
        `${label}: hash divergente para ${entry.file}; migration selada foi alterada.`,
      );
    }
    normalizedSqlByFile.set(entry.file, normalizedSql);
  }

  return { manifest, normalizedSqlByFile };
}

export function assertAppendOnlyMigrations(
  current: MigrationSnapshot,
  base: MigrationSnapshot,
  baseRef: string,
): void {
  if (current.manifest.migrations.length < base.manifest.migrations.length) {
    throw new MigrationIntegrityError(
      `Migration integrada foi excluida em relacao a ${baseRef}.`,
    );
  }

  for (const [index, baseEntry] of base.manifest.migrations.entries()) {
    const currentEntry = current.manifest.migrations[index];
    if (currentEntry === undefined) {
      throw new MigrationIntegrityError(
        `Migration integrada ${baseEntry.file} foi excluida em relacao a ${baseRef}.`,
      );
    }
    if (currentEntry.id !== baseEntry.id || currentEntry.file !== baseEntry.file) {
      throw new MigrationIntegrityError(
        `Migration integrada ${baseEntry.file} foi renomeada, reordenada ou substituida em relacao a ${baseRef}.`,
      );
    }
    if (currentEntry.sha256 !== baseEntry.sha256) {
      throw new MigrationIntegrityError(
        `Migration integrada ${baseEntry.file} foi alterada em relacao a ${baseRef}.`,
      );
    }
  }
}

async function readCurrentSnapshot(
  migrationsDirectory: string,
  manifestPath: string,
): Promise<MigrationSnapshot> {
  const [manifestRaw, directoryEntries] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readdir(migrationsDirectory, { withFileTypes: true }),
  ]);
  const sqlFiles = new Map<string, Uint8Array>();

  for (const entry of directoryEntries) {
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      sqlFiles.set(entry.name, await readFile(join(migrationsDirectory, entry.name)));
    }
  }

  return inspectSnapshot(manifestRaw, sqlFiles, 'migrations atuais');
}

function repositoryRelativePath(repositoryRoot: string, absolutePath: string): string {
  const relativePath = relative(repositoryRoot, absolutePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || isAbsolute(relativePath)) {
    throw new MigrationIntegrityError(
      `Caminho de migrations fora do repositorio: ${absolutePath}.`,
    );
  }
  return relativePath.split(sep).join('/');
}

function assertGitRef(repositoryRoot: string, baseRef: string): void {
  if (baseRef.trim().length === 0 || /[\u0000-\u001f]/.test(baseRef)) {
    throw new MigrationIntegrityError('Referencia da branch-base invalida.');
  }

  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', `${baseRef}^{commit}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new MigrationIntegrityError(`Branch-base Git nao encontrada: ${baseRef}.`);
  }
}

function readGitFile(
  repositoryRoot: string,
  baseRef: string,
  repositoryPath: string,
): Uint8Array | undefined {
  const exists = spawnSync(
    'git',
    ['cat-file', '-e', `${baseRef}:${repositoryPath}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  if (exists.status !== 0) {
    return undefined;
  }

  return execFileSync(
    'git',
    ['show', `${baseRef}:${repositoryPath}`],
    { cwd: repositoryRoot, encoding: 'buffer' },
  );
}

function listGitSqlFiles(
  repositoryRoot: string,
  baseRef: string,
  migrationsRepositoryPath: string,
): string[] {
  const output = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', baseRef, '--', migrationsRepositoryPath],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const prefix = `${migrationsRepositoryPath}/`;
  return output
    .split(/\r?\n/)
    .filter((path) => path.startsWith(prefix) && path.endsWith('.sql'))
    .map((path) => path.slice(prefix.length));
}

function emptySnapshot(): MigrationSnapshot {
  return {
    manifest: {
      version: MANIFEST_VERSION,
      algorithm: HASH_ALGORITHM,
      normalization: NORMALIZATION,
      migrations: [],
    },
    normalizedSqlByFile: new Map(),
  };
}

function readBaseSnapshot(
  repositoryRoot: string,
  baseRef: string,
  migrationsDirectory: string,
  manifestPath: string,
): MigrationSnapshot {
  assertGitRef(repositoryRoot, baseRef);
  const migrationsRepositoryPath = repositoryRelativePath(
    repositoryRoot,
    migrationsDirectory,
  );
  const manifestRepositoryPath = repositoryRelativePath(repositoryRoot, manifestPath);
  const manifestBytes = readGitFile(repositoryRoot, baseRef, manifestRepositoryPath);
  const sqlFileNames = listGitSqlFiles(
    repositoryRoot,
    baseRef,
    migrationsRepositoryPath,
  );

  if (manifestBytes === undefined) {
    if (sqlFileNames.length > 0) {
      throw new MigrationIntegrityError(
        `${baseRef}: migrations SQL integradas sem manifesto.`,
      );
    }
    return emptySnapshot();
  }

  const sqlFiles = new Map<string, Uint8Array>();
  for (const file of sqlFileNames) {
    const bytes = readGitFile(
      repositoryRoot,
      baseRef,
      `${migrationsRepositoryPath}/${file}`,
    );
    if (bytes !== undefined) {
      sqlFiles.set(file, bytes);
    }
  }

  const manifestRaw = normalizeMigrationSql(manifestBytes);
  return inspectSnapshot(manifestRaw, sqlFiles, `branch-base ${baseRef}`);
}

export async function verifyMigrationIntegrity(
  options: VerifyMigrationIntegrityOptions = {},
): Promise<MigrationIntegrityResult> {
  if (options.baseRef !== undefined && options.baseRef.trim().length === 0) {
    throw new MigrationIntegrityError('A referencia da branch-base nao pode ser vazia.');
  }

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const backendDirectory = resolve(scriptDirectory, '..');
  const migrationsDirectory = resolve(
    options.migrationsDirectory ?? join(backendDirectory, 'migrations'),
  );
  const manifestPath = resolve(
    options.manifestPath ?? join(migrationsDirectory, 'manifest.json'),
  );
  const current = await readCurrentSnapshot(migrationsDirectory, manifestPath);
  const baseRef = options.baseRef?.trim() || null;

  if (baseRef !== null) {
    const repositoryRoot = resolve(
      options.repositoryRoot
        ?? execFileSync('git', ['rev-parse', '--show-toplevel'], {
          cwd: backendDirectory,
          encoding: 'utf8',
        }).trim(),
    );
    const base = readBaseSnapshot(
      repositoryRoot,
      baseRef,
      migrationsDirectory,
      manifestPath,
    );
    assertAppendOnlyMigrations(current, base, baseRef);
  }

  return {
    checkedMigrations: current.manifest.migrations.length,
    checkedAgainstBase: baseRef,
  };
}

export function parseBaseRef(args: readonly string[]): string | undefined {
  let baseRef: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base-ref') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new MigrationIntegrityError('--base-ref exige um valor.');
      }
      if (value.trim().length === 0) {
        throw new MigrationIntegrityError('--base-ref exige um valor nao vazio.');
      }
      baseRef = value.trim();
      index += 1;
      continue;
    }
    if (argument?.startsWith('--base-ref=')) {
      const value = argument.slice('--base-ref='.length).trim();
      if (value.length === 0) {
        throw new MigrationIntegrityError('--base-ref exige um valor nao vazio.');
      }
      baseRef = value;
      continue;
    }
    throw new MigrationIntegrityError(`Argumento desconhecido: ${argument}.`);
  }
  return baseRef;
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const command = args[0] === 'verify' || args[0] === 'verify-base'
      ? args.shift()
      : 'verify';
    const cliBaseRef = parseBaseRef(args);
    const baseRef = command === 'verify-base'
      ? cliBaseRef ?? process.env.MIGRATIONS_BASE_REF
      : cliBaseRef;
    if (command === 'verify-base' && baseRef === undefined) {
      throw new MigrationIntegrityError(
        'verify-base exige --base-ref ou MIGRATIONS_BASE_REF.',
      );
    }
    const result = await verifyMigrationIntegrity(
      baseRef === undefined ? {} : { baseRef },
    );
    const baseMessage = result.checkedAgainstBase === null
      ? ''
      : ` e comparada com ${result.checkedAgainstBase}`;
    process.stdout.write(
      `Integridade confirmada para ${result.checkedMigrations} migration(s)${baseMessage}.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida.';
    process.stderr.write(`Verificacao de migrations falhou: ${message}\n`);
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
