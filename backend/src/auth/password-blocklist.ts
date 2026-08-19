import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { TextDecoder } from 'node:util';

import { foldPasswordForBlocklist } from './normalization.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ARTIFACT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export class PasswordBlocklistIntegrityError extends Error {
  public constructor(message = 'Password blocklist integrity verification failed.') {
    super(message);
    this.name = 'PasswordBlocklistIntegrityError';
  }
}

interface PasswordBlocklistArtifactManifest {
  readonly file: string;
  readonly entry_count: number;
  readonly sha256: string;
  readonly source: string;
  readonly source_url: string;
  readonly source_version: string;
  readonly retrieved_at: string;
  readonly license: string;
  readonly license_url: string;
}

interface PasswordBlocklistManifest {
  readonly schema_version: 1;
  readonly normalization: 'utf8-lf';
  readonly lookup_normalization: 'nfc-unicode-simple-lowercase-preserve-spaces';
  readonly artifacts: readonly PasswordBlocklistArtifactManifest[];
}

export interface PasswordBlocklist {
  readonly size: number;
  has(password: string): boolean;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseArtifact(value: unknown): PasswordBlocklistArtifactManifest {
  if (typeof value !== 'object' || value === null) {
    throw new PasswordBlocklistIntegrityError();
  }

  const artifact = value as Record<string, unknown>;
  if (
    !nonEmptyText(artifact.file) ||
    !SAFE_ARTIFACT_NAME_PATTERN.test(artifact.file) ||
    basename(artifact.file) !== artifact.file ||
    !Number.isSafeInteger(artifact.entry_count) ||
    (artifact.entry_count as number) < 1 ||
    typeof artifact.sha256 !== 'string' ||
    !SHA256_PATTERN.test(artifact.sha256) ||
    !nonEmptyText(artifact.source) ||
    !nonEmptyText(artifact.source_url) ||
    !nonEmptyText(artifact.source_version) ||
    !nonEmptyText(artifact.retrieved_at) ||
    Number.isNaN(Date.parse(artifact.retrieved_at)) ||
    !nonEmptyText(artifact.license) ||
    !nonEmptyText(artifact.license_url)
  ) {
    throw new PasswordBlocklistIntegrityError();
  }

  return {
    file: artifact.file,
    entry_count: artifact.entry_count as number,
    sha256: artifact.sha256,
    source: artifact.source,
    source_url: artifact.source_url,
    source_version: artifact.source_version,
    retrieved_at: artifact.retrieved_at,
    license: artifact.license,
    license_url: artifact.license_url,
  };
}

function parseManifest(value: unknown): PasswordBlocklistManifest {
  if (typeof value !== 'object' || value === null) {
    throw new PasswordBlocklistIntegrityError();
  }

  const manifest = value as Record<string, unknown>;
  if (
    manifest.schema_version !== 1 ||
    manifest.normalization !== 'utf8-lf' ||
    manifest.lookup_normalization !==
      'nfc-unicode-simple-lowercase-preserve-spaces' ||
    !Array.isArray(manifest.artifacts) ||
    manifest.artifacts.length === 0
  ) {
    throw new PasswordBlocklistIntegrityError();
  }

  const artifacts = manifest.artifacts.map(parseArtifact);
  const names = new Set(artifacts.map((artifact) => artifact.file));
  if (names.size !== artifacts.length) {
    throw new PasswordBlocklistIntegrityError(
      'Password blocklist manifest contains duplicate artifact names.',
    );
  }

  return {
    schema_version: 1,
    normalization: 'utf8-lf',
    lookup_normalization:
      'nfc-unicode-simple-lowercase-preserve-spaces',
    artifacts,
  };
}

function decodeCanonicalArtifact(bytes: Buffer): readonly string[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new PasswordBlocklistIntegrityError(
      'Password blocklist artifact is not valid UTF-8.',
    );
  }

  if (text.startsWith('\uFEFF') || text.includes('\r')) {
    throw new PasswordBlocklistIntegrityError(
      'Password blocklist artifact must use UTF-8 without BOM and LF line endings.',
    );
  }

  const lines = text.endsWith('\n')
    ? text.slice(0, -1).split('\n')
    : text.split('\n');

  if (lines.some((line) => line !== line.normalize('NFC'))) {
    throw new PasswordBlocklistIntegrityError(
      'Password blocklist entries must be NFC strings.',
    );
  }

  return lines;
}

/** Verifies every artifact before returning the merged in-memory lookup. */
export async function loadPasswordBlocklist(
  manifestPath: string,
): Promise<PasswordBlocklist> {
  try {
    const manifestBytes = await readFile(manifestPath);
    const manifestText = new TextDecoder('utf-8', { fatal: true }).decode(
      manifestBytes,
    );
    const manifest = parseManifest(JSON.parse(manifestText) as unknown);
    const entries = new Set<string>();
    const manifestDirectory = dirname(resolve(manifestPath));

    for (const artifact of manifest.artifacts) {
      const bytes = await readFile(resolve(manifestDirectory, artifact.file));
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== artifact.sha256) {
        throw new PasswordBlocklistIntegrityError(
          `Password blocklist checksum mismatch for ${artifact.file}.`,
        );
      }

      const lines = decodeCanonicalArtifact(bytes);
      if (lines.length !== artifact.entry_count) {
        throw new PasswordBlocklistIntegrityError(
          `Password blocklist entry count mismatch for ${artifact.file}.`,
        );
      }

      for (const line of lines) {
        entries.add(foldPasswordForBlocklist(line));
      }
    }

    return Object.freeze({
      size: entries.size,
      has(password: string): boolean {
        return entries.has(foldPasswordForBlocklist(password));
      },
    });
  } catch (error) {
    if (error instanceof PasswordBlocklistIntegrityError) {
      throw error;
    }

    throw new PasswordBlocklistIntegrityError();
  }
}
