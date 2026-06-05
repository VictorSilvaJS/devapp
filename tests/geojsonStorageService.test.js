const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_GEOJSON_FILE_NAME,
  GEOJSON_STORAGE_DIRECTORY_NAME,
  buildGeoJsonStorageDirectoryUri,
  buildGeoJsonStorageUri,
  copyGeoJsonToInternalStorage,
  deleteStoredGeoJson,
  ensureGeoJsonStorageDirectory,
  getStoredGeoJsonInfo,
  isSafeStoredGeoJsonFileUri,
  readStoredGeoJson,
  sanitizeGeoJsonFileName,
  sanitizeGeoJsonPathSegment,
  validateStoredGeoJson,
} = require('../.tmp-domain-compat/src/services/GeoJsonStorageService');

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

const ring = () => [
  [-55, -10],
  [-55.1, -10],
  [-55.1, -10.1],
  [-55, -10],
];

const validGeoJsonString = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      talhao: 'T01',
      area_hectares: 12.5,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring()],
    },
  }],
});

const copyInput = (overrides = {}) => ({
  propriedade_id: 'p_sela1',
  fazenda_id: 'p_sela1',
  sourceUri: 'content://picker/limites.geojson',
  originalName: 'Limites Talhoes.geojson',
  importId: 'import-001',
  ...overrides,
});

const validationOptions = (overrides = {}) => ({
  propriedade_id: 'p_sela1',
  fazenda_id: 'p_sela1',
  produtor_id: 'p_sela1',
  ano: 2025,
  safra: '2025/2026',
  ...overrides,
});

const createFileSystem = (options = {}) => {
  const directories = new Set(['file:///app/']);
  const files = new Map();
  const calls = {
    getInfo: [],
    makeDirectory: [],
    copy: [],
    write: [],
    read: [],
    delete: [],
  };

  const hiddenInfoUris = new Set(
    (options.hiddenInfoUris ?? []).map((uri) => normalizeUri(uri))
  );

  const adapter = {
    documentDirectory: options.documentDirectory ?? 'file:///app/',
    EncodingType: { UTF8: 'utf8' },
    getInfoAsync: async (uri) => {
      const normalized = normalizeUri(uri);
      calls.getInfo.push(normalized);

      if (options.failGetInfo) throw new Error('getInfo failed');
      if (options.forceMissingInfoForFiles && files.has(normalized)) {
        return { exists: false, isDirectory: false };
      }
      if (hiddenInfoUris.has(normalized)) {
        return { exists: false, isDirectory: false };
      }
      if (directories.has(ensureSlash(normalized))) {
        return { exists: true, isDirectory: true, size: 0 };
      }
      if (files.has(normalized)) {
        return {
          exists: true,
          isDirectory: false,
          size: Buffer.byteLength(files.get(normalized), 'utf8'),
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
        : options.defaultCopiedContent ?? '';
      files.set(normalizedTo, content);
    },
    writeAsStringAsync: async (uri, content, writeOptions) => {
      const normalized = normalizeUri(uri);
      calls.write.push({
        uri: normalized,
        contentLength: content.length,
        options: writeOptions,
      });
      if (options.failWrite) throw new Error('write failed');
      files.set(normalized, content);
    },
    readAsStringAsync: async (uri, readOptions) => {
      const normalized = normalizeUri(uri);
      calls.read.push({ uri: normalized, options: readOptions });
      if (options.failRead) throw new Error('read failed');
      if (!files.has(normalized)) throw new Error('file not found');
      return files.get(normalized);
    },
    deleteAsync: async (uri, deleteOptions) => {
      const normalized = normalizeUri(uri);
      calls.delete.push({ uri: normalized, options: deleteOptions });
      if (options.failDelete) throw new Error('delete failed');
      files.delete(normalized);
      directories.delete(ensureSlash(normalized));
    },
  };

  const putFile = (uri, content) => {
    files.set(normalizeUri(uri), content);
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
  await test('sanitiza propriedade_id e nomes de arquivo GeoJSON', () => {
    assert.equal(sanitizeGeoJsonPathSegment('../P Sela 1'), 'p-sela-1');
    assert.equal(sanitizeGeoJsonPathSegment('Áreas/Propriedade Demo'), 'propriedade-demo');
    assert.equal(sanitizeGeoJsonPathSegment(''), 'propriedade');

    assert.equal(sanitizeGeoJsonFileName('../Meu Arquivo Perigoso.GEOJSON'), 'meu-arquivo-perigoso.geojson');
    assert.equal(sanitizeGeoJsonFileName('folder/limites final.JSON'), 'limites-final.json');
    assert.equal(sanitizeGeoJsonFileName('../../.geojson'), DEFAULT_GEOJSON_FILE_NAME);
    assert.equal(sanitizeGeoJsonFileName('limites.zip'), DEFAULT_GEOJSON_FILE_NAME);
    assert.equal(sanitizeGeoJsonFileName(''), DEFAULT_GEOJSON_FILE_NAME);
  });

  await test('constroi diretorio e URI estavel por Propriedade', () => {
    const fileSystem = createFileSystem();
    const deps = {
      fileSystem: fileSystem.adapter,
      generateImportId: () => 'gerado-001',
    };

    const directoryUri = buildGeoJsonStorageDirectoryUri('../P Sela 1', deps);
    const uri = buildGeoJsonStorageUri({
      propriedade_id: '../P Sela 1',
      importId: '../Import 01',
      originalName: 'Meu Arquivo.geojson',
    }, deps);
    const generatedUri = buildGeoJsonStorageUri({
      propriedade_id: 'P Sela 1',
      originalName: 'Limites.json',
    }, deps);

    assert.equal(directoryUri, `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/`);
    assert.equal(uri, `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/import-01-meu-arquivo.geojson`);
    assert.equal(generatedUri, `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/gerado-001-limites.json`);
    assert.equal(isSafeStoredGeoJsonFileUri(uri, deps), true);
    assert.equal(isSafeStoredGeoJsonFileUri(`file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/`, deps), false);
    assert.equal(isSafeStoredGeoJsonFileUri('file:///app/outro.geojson', deps), false);
  });

  await test('cria diretorio base e subdiretorio da Propriedade', async () => {
    const fileSystem = createFileSystem();
    const result = await ensureGeoJsonStorageDirectory('../P Sela 1', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.uri, `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/`);
    assert.deepEqual(fileSystem.calls.makeDirectory.map((call) => call.uri), [
      `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/`,
      `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p-sela-1/`,
    ]);
    assert.equal(fileSystem.calls.makeDirectory[0].options.intermediates, true);
  });

  await test('copia GeoJSON com copyAsync e retorna URI, nome e tamanho', async () => {
    const fileSystem = createFileSystem();
    fileSystem.putFile('content://picker/limites.geojson', validGeoJsonString);

    const result = await copyGeoJsonToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T12:00:00.000Z',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.propriedade_id, 'p_sela1');
    assert.equal(result.file.fazenda_id, 'p_sela1');
    assert.equal(result.file.name, 'import-001-limites-talhoes.geojson');
    assert.equal(result.file.uri, `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites-talhoes.geojson`);
    assert.equal(result.file.originalName, 'Limites Talhoes.geojson');
    assert.equal(result.file.size, Buffer.byteLength(validGeoJsonString, 'utf8'));
    assert.equal(result.file.copiedAt, '2026-06-05T12:00:00.000Z');
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.write.length, 0);
  });

  await test('usa writeAsStringAsync como fallback quando copyAsync falha e content existe', async () => {
    const fileSystem = createFileSystem({ failCopy: true });

    const result = await copyGeoJsonToInternalStorage(copyInput({
      sourceUri: 'content://picker/content-uri.geojson',
      content: validGeoJsonString,
    }), {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T12:00:00.000Z',
    });

    assert.equal(result.ok, true);
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.write.length, 1);
    assert.equal(fileSystem.calls.write[0].options.encoding, 'utf8');
    assert.equal(result.file.size, Buffer.byteLength(validGeoJsonString, 'utf8'));
  });

  await test('retorna COPY_FAILED quando copyAsync falha sem content', async () => {
    const fileSystem = createFileSystem({ failCopy: true });

    const result = await copyGeoJsonToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COPY_FAILED');
    assert.equal(fileSystem.calls.write.length, 0);
  });

  await test('retorna WRITE_FALLBACK_FAILED quando fallback textual falha', async () => {
    const fileSystem = createFileSystem({ failCopy: true, failWrite: true });

    const result = await copyGeoJsonToInternalStorage(copyInput({
      content: validGeoJsonString,
    }), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'WRITE_FALLBACK_FAILED');
  });

  await test('nao sobrescreve por padrao e permite overwrite explicito', async () => {
    const destination = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites-talhoes.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(destination, 'conteudo anterior');
    fileSystem.putFile('content://picker/limites.geojson', validGeoJsonString);

    const blocked = await copyGeoJsonToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, 'DESTINATION_EXISTS');
    assert.equal(fileSystem.calls.copy.length, 0);
    assert.equal(fileSystem.calls.delete.length, 0);
    assert.equal(fileSystem.files.get(destination), 'conteudo anterior');

    const overwritten = await copyGeoJsonToInternalStorage(copyInput({
      overwrite: true,
    }), {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T12:00:00.000Z',
    });

    assert.equal(overwritten.ok, true);
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.delete.length, 1);
    assert.equal(fileSystem.calls.delete[0].uri, destination);
    assert.equal(fileSystem.calls.delete[0].options.idempotent, true);
    assert.equal(fileSystem.files.get(destination), validGeoJsonString);
  });

  await test('confirma existencia apos copia e retorna STORED_FILE_NOT_FOUND se ausente', async () => {
    const fileSystem = createFileSystem({ forceMissingInfoForFiles: true });
    fileSystem.putFile('content://picker/limites.geojson', validGeoJsonString);

    const result = await copyGeoJsonToInternalStorage(copyInput(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORED_FILE_NOT_FOUND');
  });

  await test('le arquivo armazenado por URI segura', async () => {
    const storedUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, validGeoJsonString);

    const result = await readStoredGeoJson(storedUri, {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.content, validGeoJsonString);
    assert.equal(fileSystem.calls.read[0].options.encoding, 'utf8');
  });

  await test('valida arquivo armazenado com helper real e retorna talhoes', async () => {
    const storedUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, validGeoJsonString);

    const result = await validateStoredGeoJson(storedUri, validationOptions(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.validation.ok, true);
    assert.equal(result.validation.talhoes.length, 1);
    assert.equal(result.validation.talhoes[0].talhao, 'T01');
    assert.equal(result.validation.talhoes[0].fazenda_id, 'p_sela1');
  });

  await test('retorna validation false para conteudo invalido armazenado', async () => {
    const storedUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, '{json invalido');

    const result = await validateStoredGeoJson(storedUri, validationOptions(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, undefined);
    assert.equal(result.validation.ok, false);
    assert.equal(result.validation.errors[0].code, 'INVALID_JSON');
  });

  await test('consulta info de arquivo armazenado e rejeita path externo', async () => {
    const storedUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, validGeoJsonString);

    const info = await getStoredGeoJsonInfo(storedUri, {
      fileSystem: fileSystem.adapter,
    });
    const outside = await getStoredGeoJsonInfo('file:///app/outro.geojson', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(info.ok, true);
    assert.equal(info.info.exists, true);
    assert.equal(info.info.isDirectory, false);
    assert.equal(info.info.size, Buffer.byteLength(validGeoJsonString, 'utf8'));
    assert.equal(outside.ok, false);
    assert.equal(outside.error.code, 'INVALID_STORAGE_PATH');
  });

  await test('remove arquivo seguro e arquivo inexistente nao derruba', async () => {
    const storedUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-001-limites.geojson`;
    const missingUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/import-002-limites.geojson`;
    const fileSystem = createFileSystem();
    fileSystem.putFile(storedUri, validGeoJsonString);

    const removed = await deleteStoredGeoJson(storedUri, {
      fileSystem: fileSystem.adapter,
    });
    const missing = await deleteStoredGeoJson(missingUri, {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(removed.ok, true);
    assert.equal(removed.deleted, true);
    assert.equal(fileSystem.files.has(storedUri), false);
    assert.equal(fileSystem.calls.delete[0].options.idempotent, true);
    assert.equal(missing.ok, true);
    assert.equal(missing.deleted, false);
  });

  await test('recusa remocao fora do diretorio base ou de diretorio amplo', async () => {
    const baseUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/`;
    const propertyUri = `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/`;
    const fileSystem = createFileSystem();
    fileSystem.putDirectory(baseUri);
    fileSystem.putDirectory(propertyUri);

    const outside = await deleteStoredGeoJson('file:///app/outro.geojson', {
      fileSystem: fileSystem.adapter,
    });
    const base = await deleteStoredGeoJson(baseUri, {
      fileSystem: fileSystem.adapter,
    });
    const property = await deleteStoredGeoJson(propertyUri, {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(outside.ok, false);
    assert.equal(outside.error.code, 'UNSAFE_DELETE_PATH');
    assert.equal(base.ok, false);
    assert.equal(base.error.code, 'UNSAFE_DELETE_PATH');
    assert.equal(property.ok, false);
    assert.equal(property.error.code, 'UNSAFE_DELETE_PATH');
    assert.equal(fileSystem.calls.delete.length, 0);
  });

  await test('escopo: servico nao importa persistencia, telas, mocks ou entidades fora da fase', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'GeoJsonStorageService.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('GeoJsonImportService'), false);
    assert.equal(source.includes('LimiteArea'), false);
    assert.equal(source.includes('Mapa'), false);
    assert.equal(source.includes('User'), false);
    assert.equal(source.includes('Produtor'), false);
    assert.equal(source.includes('React'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('FazendaMapaScreen'), false);
    assert.equal(source.includes('AsyncStorage'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
    assert.equal(source.includes('@tche:geojson-imports:v1'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de GeoJsonStorageService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
