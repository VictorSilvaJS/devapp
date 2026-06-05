const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_PNG_FILE_NAME,
  PNG_STORAGE_DIRECTORY_NAME,
  buildPngStorageDirectoryUri,
  buildPngStorageUri,
  copyPngToInternalStorage,
  deleteStoredPng,
  ensurePngStorageDirectory,
  getStoredPngInfo,
  isSafePngStorageUri,
  sanitizePngFileName,
  sanitizePngPathSegment,
} = require('../.tmp-domain-compat/src/services/PngStorageService');
const {
  PNG_MAP_IMPORT_STORAGE_KEY,
} = require('../.tmp-domain-compat/src/services/PngMapImportService');
const {
  MOCK_LOCAL_STORAGE_KEY,
} = require('../.tmp-domain-compat/src/api/mockLocalPersistence');

let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const normalizeUri = (uri) => String(uri).replace(/\\/g, '/');

const ensureSlash = (uri) => {
  const normalized = normalizeUri(uri);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const copyInput = (overrides = {}) => ({
  propriedade_id: 'p_sela1',
  fazenda_id: 'p_sela1',
  sourceUri: 'content://picker/mapa.png',
  originalName: 'Mapa pH.PNG',
  importId: 'import-001',
  ...overrides,
});

const createFileSystem = (options = {}) => {
  const directories = new Set(['file:///app/']);
  const files = new Map();
  const calls = {
    getInfo: [],
    makeDirectory: [],
    copy: [],
    delete: [],
    read: [],
    write: [],
  };

  const adapter = {
    documentDirectory: options.documentDirectory ?? 'file:///app/',
    getInfoAsync: async (uri) => {
      const normalized = normalizeUri(uri);
      calls.getInfo.push(normalized);

      if (options.failGetInfo) throw new Error('getInfo failed');
      if (options.forceMissingInfoForFiles && files.has(normalized)) {
        return { exists: false, isDirectory: false };
      }
      if (directories.has(ensureSlash(normalized))) {
        return { exists: true, isDirectory: true, size: 0 };
      }
      if (files.has(normalized)) {
        return {
          exists: true,
          isDirectory: false,
          size: files.get(normalized).length,
        };
      }

      return { exists: false, isDirectory: false };
    },
    makeDirectoryAsync: async (uri, makeOptions) => {
      const normalized = ensureSlash(uri);
      calls.makeDirectory.push({ uri: normalized, options: makeOptions });
      if (options.failMakeDirectory) throw new Error('makeDirectory failed');
      directories.add(normalized);
    },
    copyAsync: async ({ from, to }) => {
      const normalizedFrom = normalizeUri(from);
      const normalizedTo = normalizeUri(to);
      calls.copy.push({ from: normalizedFrom, to: normalizedTo });
      if (options.failCopy) throw new Error('copy failed');

      const content = files.has(normalizedFrom)
        ? files.get(normalizedFrom)
        : Buffer.from([137, 80, 78, 71]);
      files.set(normalizedTo, content);
    },
    deleteAsync: async (uri, deleteOptions) => {
      const normalized = normalizeUri(uri);
      calls.delete.push({ uri: normalized, options: deleteOptions });
      if (options.failDelete) throw new Error('delete failed');
      files.delete(normalized);
      directories.delete(ensureSlash(normalized));
    },
  };

  const putFile = (uri, content = Buffer.from([1, 2, 3, 4])) => {
    files.set(normalizeUri(uri), Buffer.isBuffer(content) ? content : Buffer.from(String(content)));
  };

  const putDirectory = (uri) => {
    directories.add(ensureSlash(uri));
  };

  return {
    adapter,
    calls,
    directories,
    files,
    putDirectory,
    putFile,
  };
};

const run = async () => {
  await test('sanitiza propriedade_id e nome de arquivo PNG', () => {
    assert.equal(sanitizePngPathSegment('../P Sela 1'), 'p-sela-1');
    assert.equal(sanitizePngPathSegment('Áreas/Propriedade Demo'), 'propriedade-demo');
    assert.equal(sanitizePngPathSegment(''), 'propriedade');

    assert.equal(sanitizePngFileName('../Meu Arquivo Perigoso.PNG'), 'meu-arquivo-perigoso.png');
    assert.equal(sanitizePngFileName('folder/mapa final.png'), 'mapa-final.png');
    assert.equal(sanitizePngFileName('../../.png'), DEFAULT_PNG_FILE_NAME);
    assert.equal(sanitizePngFileName('mapa.jpg'), DEFAULT_PNG_FILE_NAME);
    assert.equal(sanitizePngFileName(''), DEFAULT_PNG_FILE_NAME);
  });

  await test('constroi diretorio e URI estavel por Propriedade', () => {
    const fileSystem = createFileSystem();
    const deps = {
      fileSystem: fileSystem.adapter,
      generateImportId: () => 'gerado-001',
    };

    const directoryUri = buildPngStorageDirectoryUri('../P Sela 1', deps);
    const uri = buildPngStorageUri({
      propriedade_id: '../P Sela 1',
      importId: '../Import 01',
      originalName: 'Meu Arquivo.PNG',
    }, deps);
    const generatedUri = buildPngStorageUri({
      propriedade_id: 'P Sela 1',
      originalName: 'Mapa.png',
    }, deps);

    assert.equal(directoryUri, `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/`);
    assert.equal(uri, `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/import-01-meu-arquivo.png`);
    assert.equal(generatedUri, `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/gerado-001-mapa.png`);
    assert.equal(isSafePngStorageUri(uri, deps), true);
    assert.equal(isSafePngStorageUri(`file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/`, deps), false);
    assert.equal(isSafePngStorageUri('file:///app/outro.png', deps), false);
    assert.equal(isSafePngStorageUri(`file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/arquivo.jpg`, deps), false);
  });

  await test('cria diretorio base e subdiretorio da Propriedade', async () => {
    const fileSystem = createFileSystem();
    const result = await ensurePngStorageDirectory('../P Sela 1', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.uri, `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/`);
    assert.deepEqual(fileSystem.calls.makeDirectory.map((call) => call.uri), [
      `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/`,
      `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p-sela-1/`,
    ]);
    assert.equal(fileSystem.calls.makeDirectory[0].options.intermediates, true);
  });

  await test('copia PNG com copyAsync e retorna URI, nome, tamanho e MIME', async () => {
    const fileSystem = createFileSystem();
    fileSystem.putFile('content://picker/mapa.png', Buffer.from([137, 80, 78, 71, 1, 2]));

    const result = await copyPngToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T14:00:00.000Z',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.propriedade_id, 'p_sela1');
    assert.equal(result.file.fazenda_id, 'p_sela1');
    assert.equal(result.file.name, 'import-001-mapa-ph.png');
    assert.equal(result.file.uri, `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-mapa-ph.png`);
    assert.equal(result.file.originalName, 'Mapa pH.PNG');
    assert.equal(result.file.size, 6);
    assert.equal(result.file.mimeType, 'image/png');
    assert.equal(result.file.copiedAt, '2026-06-05T14:00:00.000Z');
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.read.length, 0);
    assert.equal(fileSystem.calls.write.length, 0);
  });

  await test('retorna erro controlado quando copyAsync falha', async () => {
    const fileSystem = createFileSystem({ failCopy: true });

    const result = await copyPngToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PNG_COPY_FAILED');
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.read.length, 0);
    assert.equal(fileSystem.calls.write.length, 0);
  });

  await test('nao sobrescreve por padrao e permite overwrite explicito', async () => {
    const destination = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-mapa-ph.png`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(destination, Buffer.from([9, 9, 9]));
    fileSystem.putFile('content://picker/mapa.png', Buffer.from([1, 2, 3, 4]));

    const blocked = await copyPngToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, 'PNG_FILE_ALREADY_EXISTS');
    assert.equal(fileSystem.calls.copy.length, 0);
    assert.equal(fileSystem.calls.delete.length, 0);
    assert.deepEqual([...fileSystem.files.get(destination)], [9, 9, 9]);

    const overwritten = await copyPngToInternalStorage(copyInput({
      overwrite: true,
    }), {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T14:00:00.000Z',
    });

    assert.equal(overwritten.ok, true);
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.delete.length, 1);
    assert.equal(fileSystem.calls.delete[0].uri, destination);
    assert.equal(fileSystem.calls.delete[0].options.idempotent, true);
    assert.deepEqual([...fileSystem.files.get(destination)], [1, 2, 3, 4]);
  });

  await test('confirma existencia apos copia e retorna erro se ausente', async () => {
    const fileSystem = createFileSystem({ forceMissingInfoForFiles: true });
    fileSystem.putFile('content://picker/mapa.png');

    const result = await copyPngToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PNG_STORED_FILE_NOT_FOUND');
  });

  await test('valida inputs obrigatorios', async () => {
    const fileSystem = createFileSystem();

    const missingId = await copyPngToInternalStorage(copyInput({
      propriedade_id: '',
      fazenda_id: '',
    }), {
      fileSystem: fileSystem.adapter,
    });
    const missingSource = await copyPngToInternalStorage(copyInput({
      sourceUri: '',
    }), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(missingId.ok, false);
    assert.equal(missingId.error.code, 'PNG_PROPRIEDADE_ID_REQUIRED');
    assert.equal(missingSource.ok, false);
    assert.equal(missingSource.error.code, 'PNG_SOURCE_URI_REQUIRED');
  });

  await test('consulta info de arquivo armazenado e rejeita path externo', async () => {
    const storedUri = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-mapa.png`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, Buffer.from([1, 2, 3]));

    const info = await getStoredPngInfo(storedUri, {
      fileSystem: fileSystem.adapter,
    });
    const outside = await getStoredPngInfo('file:///app/outro.png', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(info.ok, true);
    assert.equal(info.info.exists, true);
    assert.equal(info.info.isDirectory, false);
    assert.equal(info.info.size, 3);
    assert.equal(outside.ok, false);
    assert.equal(outside.error.code, 'PNG_INVALID_STORAGE_PATH');
  });

  await test('remove arquivo seguro e arquivo inexistente nao derruba', async () => {
    const storedUri = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-mapa.png`;
    const missingUri = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/import-002-mapa.png`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri);

    const removed = await deleteStoredPng(storedUri, {
      fileSystem: fileSystem.adapter,
    });
    const missing = await deleteStoredPng(missingUri, {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(removed.ok, true);
    assert.equal(removed.deleted, true);
    assert.equal(fileSystem.files.has(storedUri), false);
    assert.equal(fileSystem.calls.delete[0].options.idempotent, true);
    assert.equal(missing.ok, true);
    assert.equal(missing.deleted, false);
  });

  await test('recusa remocao fora do diretorio base, diretorios amplos e assets da Sela', async () => {
    const baseUri = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/`;
    const propertyUri = `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/`;
    const fileSystem = createFileSystem();
    fileSystem.putDirectory(baseUri);
    fileSystem.putDirectory(propertyUri);

    const outside = await deleteStoredPng('file:///app/outro.png', {
      fileSystem: fileSystem.adapter,
    });
    const base = await deleteStoredPng(baseUri, {
      fileSystem: fileSystem.adapter,
    });
    const property = await deleteStoredPng(propertyUri, {
      fileSystem: fileSystem.adapter,
    });
    const selaAsset = await deleteStoredPng('file:///app/src/assets/mapas/sela-prata-i/2025/fertilidade/ph_10a20.png', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(outside.ok, false);
    assert.equal(outside.error.code, 'PNG_UNSAFE_DELETE_PATH');
    assert.equal(base.ok, false);
    assert.equal(base.error.code, 'PNG_UNSAFE_DELETE_PATH');
    assert.equal(property.ok, false);
    assert.equal(property.error.code, 'PNG_UNSAFE_DELETE_PATH');
    assert.equal(selaAsset.ok, false);
    assert.equal(selaAsset.error.code, 'PNG_UNSAFE_DELETE_PATH');
    assert.equal(fileSystem.calls.delete.length, 0);
  });

  await test('escopo: servico nao importa persistencia, telas, mocks ou assets', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'PngStorageService.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('PngMapImportService'), false);
    assert.equal(source.includes(PNG_MAP_IMPORT_STORAGE_KEY), false);
    assert.equal(source.includes(MOCK_LOCAL_STORAGE_KEY), false);
    assert.equal(source.includes('AsyncStorage'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('Mapa.list'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('sela-prata-i'), false);
    assert.equal(source.includes('User'), false);
    assert.equal(source.includes('Produtor'), false);
    assert.equal(source.includes('React'), false);
    assert.equal(source.includes('readAsStringAsync'), false);
    assert.equal(source.includes('writeAsStringAsync'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de PngStorageService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
