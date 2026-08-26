import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const execFileAsync = promisify(execFile);
const generator = fileURLToPath(
  new URL('../../scripts/generate-ibge-snapshot-migration.mjs', import.meta.url),
);

function locality(index: number, overrides: Record<string, unknown> = {}) {
  const stateIndex = index - 1;
  const stateId = String(index + 10);
  const stateCode = String.fromCharCode(65 + Math.floor(stateIndex / 26))
    + String.fromCharCode(65 + (stateIndex % 26));
  return {
    id: 1_000_000 + index,
    nome: `Município ${index}`,
    'regiao-imediata': {
      'regiao-intermediaria': {
        UF: { id: Number(stateId), sigla: stateCode, nome: `UF ${index}` },
      },
    },
    ...overrides,
  };
}

test('gerador recusa sobrescrever uma versão já publicada', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tche-ibge-generator-'));
  try {
    const source = join(directory, 'municipios.json');
    const target = join(directory, '000007.sql');
    await writeFile(
      source,
      JSON.stringify(Array.from({ length: 27 }, (_, index) => locality(index + 1))),
      'utf8',
    );
    const arguments_ = [
      generator,
      source,
      target,
      'ibge-localidades-2026-08-25',
      '2026-08-25',
      '27',
    ];
    await execFileAsync(process.execPath, arguments_);
    const first = await readFile(target, 'utf8');
    await assert.rejects(
      execFileAsync(process.execPath, arguments_),
      /EEXIST|file already exists/,
    );
    assert.equal(await readFile(target, 'utf8'), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gerador detecta metadados divergentes para a mesma UF', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tche-ibge-generator-'));
  try {
    const source = join(directory, 'municipios.json');
    const target = join(directory, '000007.sql');
    const localities = Array.from({ length: 27 }, (_, index) =>
      locality(index + 1),
    );
    localities.push(
      locality(1, {
        id: 2_000_001,
        nome: 'Município divergente',
        'regiao-imediata': {
          'regiao-intermediaria': {
            UF: { id: 11, sigla: 'ZZ', nome: 'UF divergente' },
          },
        },
      }),
    );
    await writeFile(source, JSON.stringify(localities), 'utf8');
    await assert.rejects(
      execFileAsync(process.execPath, [
        generator,
        source,
        target,
        'ibge-localidades-2026-08-25',
        '2026-08-25',
        '28',
      ]),
      /metadados divergentes/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
