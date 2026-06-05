const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  MAX_GEOJSON_FILE_SIZE_BYTES,
  isSupportedGeoJsonFileName,
  isSupportedGeoJsonMimeType,
  normalizePickedDocumentResult,
  pickGeoJsonDocument,
  readAndValidatePickedGeoJson,
  pickReadAndValidateGeoJson,
  validatePickedGeoJsonFile,
} = require('../.tmp-domain-compat/src/services/GeoJsonFilePickerService');

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

const options = (overrides = {}) => ({
  propriedade_id: 'prop_geo',
  fazenda_id: 'fazenda_geo',
  produtor_id: 'produtor_geo',
  ano: 2025,
  safra: '2025/2026',
  ...overrides,
});

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

const baseFile = (overrides = {}) => ({
  uri: 'file:///cache/limites.geojson',
  name: 'limites.geojson',
  size: 1000,
  mimeType: 'application/geo+json',
  ...overrides,
});

const createPicker = (result) => {
  const calls = [];
  return {
    calls,
    adapter: {
      getDocumentAsync: async (optionsArg) => {
        calls.push(optionsArg);
        return result;
      },
    },
  };
};

const createFileSystem = (content, optionsArg = {}) => {
  const calls = [];
  return {
    calls,
    adapter: {
      EncodingType: { UTF8: 'utf8' },
      readAsStringAsync: async (uri, readOptions) => {
        calls.push({ uri, readOptions });
        if (optionsArg.fail) throw new Error('read failed');
        return content;
      },
    },
  };
};

const fakeValidationOk = {
  ok: true,
  errors: [],
  warnings: [],
  talhoes: [{ id: 'talhao_1', talhao: 'T01', area_hectares: 1, poligono: [] }],
  summary: {
    features_count: 1,
    talhoes_count: 1,
    polygon_parts_count: 1,
    geometry_types: ['Polygon'],
    warnings_count: 0,
    errors_count: 0,
  },
};

const fakeValidationFailed = {
  ok: false,
  errors: [{ severity: 'error', code: 'FEATURE_COLLECTION_REQUIRED', message: 'Invalido' }],
  warnings: [],
  talhoes: [],
  summary: {
    features_count: 0,
    talhoes_count: 0,
    polygon_parts_count: 0,
    geometry_types: [],
    warnings_count: 0,
    errors_count: 1,
  },
};

const run = async () => {
  await test('DocumentPicker cancelado antigo retorna erro controlado', async () => {
    const picker = createPicker({ type: 'cancel' });
    const result = await pickGeoJsonDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PICKER_CANCELLED');
    assert.equal(normalizePickedDocumentResult({ type: 'cancel' }), null);
  });

  await test('DocumentPicker cancelado novo retorna erro controlado', async () => {
    const picker = createPicker({ canceled: true });
    const result = await pickGeoJsonDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PICKER_CANCELLED');
    assert.equal(normalizePickedDocumentResult({ canceled: true }), null);
  });

  await test('normaliza resultado sucesso antigo do DocumentPicker', () => {
    const file = normalizePickedDocumentResult({
      type: 'success',
      uri: 'file:///tmp/a.geojson',
      name: 'a.geojson',
      size: 10,
      mimeType: 'application/geo+json',
    });

    assert.deepEqual(file, {
      uri: 'file:///tmp/a.geojson',
      name: 'a.geojson',
      size: 10,
      mimeType: 'application/geo+json',
    });
  });

  await test('normaliza resultado sucesso novo do DocumentPicker', () => {
    const file = normalizePickedDocumentResult({
      canceled: false,
      assets: [{
        uri: 'file:///tmp/b.json',
        name: 'b.json',
        size: 20,
        mimeType: 'application/json',
      }],
    });

    assert.deepEqual(file, {
      uri: 'file:///tmp/b.json',
      name: 'b.json',
      size: 20,
      mimeType: 'application/json',
    });
  });

  await test('resultado sem asset, uri ou nome nao normaliza arquivo', () => {
    assert.equal(normalizePickedDocumentResult({ canceled: false, assets: [] }), null);
    assert.equal(normalizePickedDocumentResult({ type: 'success', name: 'a.geojson' }), null);
    assert.equal(normalizePickedDocumentResult({ type: 'success', uri: 'file:///tmp/a.geojson' }), null);
  });

  await test('pick configura tipos aceitos e copyToCacheDirectory temporario', async () => {
    const picker = createPicker({
      type: 'success',
      uri: 'file:///tmp/a.geojson',
      name: 'a.geojson',
      size: 10,
      mimeType: 'application/geo+json',
    });
    const result = await pickGeoJsonDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'a.geojson');
    assert.equal(picker.calls[0].copyToCacheDirectory, true);
    assert.equal(picker.calls[0].multiple, false);
    assert.deepEqual(picker.calls[0].type, [
      'application/geo+json',
      'application/json',
      'application/octet-stream',
      'text/json',
      'text/plain',
    ]);
  });

  await test('aceita extensoes e MIME de GeoJSON suportados', () => {
    assert.equal(isSupportedGeoJsonFileName('limites.geojson'), true);
    assert.equal(isSupportedGeoJsonFileName('limites.json'), true);
    assert.equal(isSupportedGeoJsonMimeType('application/geo+json'), true);
    assert.equal(isSupportedGeoJsonMimeType('application/json'), true);
    assert.equal(isSupportedGeoJsonMimeType('application/octet-stream'), true);
    assert.equal(isSupportedGeoJsonMimeType('text/json'), true);
    assert.equal(isSupportedGeoJsonMimeType('text/plain'), true);
    assert.equal(isSupportedGeoJsonMimeType(undefined), true);

    assert.equal(validatePickedGeoJsonFile(baseFile()).error, undefined);
    assert.equal(validatePickedGeoJsonFile(baseFile({ mimeType: 'application/octet-stream' })).error, undefined);
    assert.equal(validatePickedGeoJsonFile(baseFile({ mimeType: undefined })).error, undefined);
    assert.equal(validatePickedGeoJsonFile(baseFile({ mimeType: 'text/plain' })).error, undefined);
  });

  await test('rejeita extensoes ou nomes nao suportados', () => {
    ['limites.zip', 'limites.kml', 'limites.kmz', 'limites.shp', 'limites.png', 'limites.jpg', 'limites.pdf', 'limites'].forEach((name) => {
      const validation = validatePickedGeoJsonFile(baseFile({ name, mimeType: undefined }));
      assert.equal(validation.error.code, 'UNSUPPORTED_FILE_TYPE');
    });

    const genericMimeInvalidName = validatePickedGeoJsonFile(baseFile({
      name: 'limites.png',
      mimeType: 'application/octet-stream',
    }));
    assert.equal(genericMimeInvalidName.error.code, 'UNSUPPORTED_FILE_TYPE');
  });

  await test('rejeita MIME incompativel mesmo com extensao valida', () => {
    const validation = validatePickedGeoJsonFile(baseFile({ mimeType: 'image/png' }));

    assert.equal(validation.error.code, 'UNSUPPORTED_FILE_TYPE');
  });

  await test('controla limite de tamanho antes da leitura', () => {
    const tooLarge = validatePickedGeoJsonFile(baseFile({
      size: MAX_GEOJSON_FILE_SIZE_BYTES + 1,
    }));
    const belowLimit = validatePickedGeoJsonFile(baseFile({
      size: MAX_GEOJSON_FILE_SIZE_BYTES,
    }));
    const unknownSize = validatePickedGeoJsonFile(baseFile({
      size: undefined,
    }));

    assert.equal(tooLarge.error.code, 'FILE_TOO_LARGE');
    assert.equal(belowLimit.error, undefined);
    assert.equal(unknownSize.error, undefined);
    assert.equal(unknownSize.warnings[0].code, 'FILE_SIZE_UNKNOWN');
  });

  await test('le string via FileSystem mockado e valida com helper real', async () => {
    const fileSystem = createFileSystem(validGeoJsonString);
    const result = await readAndValidatePickedGeoJson(baseFile(), options(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'limites.geojson');
    assert.equal(result.validation.talhoes.length, 1);
    assert.equal(result.validation.talhoes[0].fazenda_id, 'fazenda_geo');
    assert.equal(fileSystem.calls[0].uri, 'file:///cache/limites.geojson');
    assert.equal(fileSystem.calls[0].readOptions.encoding, 'utf8');
  });

  await test('erro de leitura retorna FILE_READ_FAILED sem vazar erro tecnico', async () => {
    const fileSystem = createFileSystem('', { fail: true });
    const result = await readAndValidatePickedGeoJson(baseFile(), options(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FILE_READ_FAILED');
    assert.equal(result.error.message.includes('read failed'), false);
  });

  await test('GeoJSON invalido retorna INVALID_GEOJSON com validation ok false', async () => {
    const fileSystem = createFileSystem('{json invalido');
    const result = await readAndValidatePickedGeoJson(baseFile(), options(), {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_GEOJSON');
    assert.equal(result.validation.ok, false);
  });

  await test('validacao sem sucesso retorna VALIDATION_FAILED', async () => {
    const fileSystem = createFileSystem('{}');
    const result = await readAndValidatePickedGeoJson(baseFile(), options(), {
      fileSystem: fileSystem.adapter,
      validateGeoJson: () => fakeValidationFailed,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'VALIDATION_FAILED');
    assert.equal(result.validation, fakeValidationFailed);
  });

  await test('repassa options de Propriedade ao validador injetado', async () => {
    const fileSystem = createFileSystem(validGeoJsonString);
    let capturedInput = null;
    let capturedOptions = null;

    const result = await readAndValidatePickedGeoJson(baseFile(), options(), {
      fileSystem: fileSystem.adapter,
      validateGeoJson: (input, validateOptions) => {
        capturedInput = input;
        capturedOptions = validateOptions;
        return fakeValidationOk;
      },
    });

    assert.equal(result.ok, true);
    assert.equal(capturedInput, validGeoJsonString);
    assert.deepEqual(capturedOptions, options());
  });

  await test('pickReadAndValidate integra picker, leitura e validacao em memoria', async () => {
    const picker = createPicker({
      canceled: false,
      assets: [{
        uri: 'file:///tmp/sem-size.geojson',
        name: 'sem-size.geojson',
        mimeType: 'application/geo+json',
      }],
    });
    const fileSystem = createFileSystem(validGeoJsonString);
    const result = await pickReadAndValidateGeoJson(options(), {
      documentPicker: picker.adapter,
      fileSystem: fileSystem.adapter,
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'sem-size.geojson');
    assert.equal(result.validation.ok, true);
    assert.deepEqual(result.warnings.map((warning) => warning.code), ['FILE_SIZE_UNKNOWN']);
  });

  await test('escopo: servico nao importa persistencia, telas, mocks ou storage local', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'GeoJsonFilePickerService.ts');
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
    console.log('\nTodos os testes de GeoJsonFilePickerService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
