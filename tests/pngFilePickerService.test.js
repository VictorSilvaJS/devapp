const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  MAX_PNG_FILE_SIZE_BYTES,
  isSupportedPngFileName,
  isSupportedPngMimeType,
  normalizePickedPngDocumentResult,
  pickPngDocument,
  validatePickedPngFile,
} = require('../.tmp-domain-compat/src/services/PngFilePickerService');

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

const baseFile = (overrides = {}) => ({
  uri: 'file:///cache/mapa.png',
  name: 'mapa.png',
  size: 1000,
  mimeType: 'image/png',
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

const run = async () => {
  await test('DocumentPicker cancelado antigo retorna erro controlado', async () => {
    const picker = createPicker({ type: 'cancel' });
    const result = await pickPngDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'PICKER_CANCELLED');
    assert.equal(normalizePickedPngDocumentResult({ type: 'cancel' }), null);
  });

  await test('DocumentPicker cancelado novo retorna erro controlado', async () => {
    const picker = createPicker({ canceled: true });
    const result = await pickPngDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'PICKER_CANCELLED');
    assert.equal(normalizePickedPngDocumentResult({ canceled: true }), null);
  });

  await test('normaliza resultado sucesso antigo do DocumentPicker', () => {
    const file = normalizePickedPngDocumentResult({
      type: 'success',
      uri: 'file:///tmp/a.png',
      name: 'a.png',
      size: 10,
      mimeType: 'image/png',
    });

    assert.deepEqual(file, {
      uri: 'file:///tmp/a.png',
      name: 'a.png',
      size: 10,
      mimeType: 'image/png',
    });
  });

  await test('normaliza resultado sucesso novo do DocumentPicker', () => {
    const file = normalizePickedPngDocumentResult({
      canceled: false,
      assets: [{
        uri: 'content://picker/b',
        name: 'b.PNG',
        size: 20,
        mimeType: 'application/octet-stream',
      }],
    });

    assert.deepEqual(file, {
      uri: 'content://picker/b',
      name: 'b.PNG',
      size: 20,
      mimeType: 'application/octet-stream',
    });
  });

  await test('resultado sem asset, uri ou nome nao normaliza arquivo', () => {
    assert.equal(normalizePickedPngDocumentResult({ canceled: false, assets: [] }), null);
    assert.equal(normalizePickedPngDocumentResult({ type: 'success', name: 'a.png' }), null);
    assert.equal(normalizePickedPngDocumentResult({ type: 'success', uri: 'file:///tmp/a.png' }), null);
  });

  await test('pick configura somente PNG, sem multiplos arquivos e com cache temporario', async () => {
    const picker = createPicker({
      type: 'success',
      uri: 'file:///tmp/a.png',
      name: 'a.png',
      size: 10,
      mimeType: 'image/png',
    });
    const result = await pickPngDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'a.png');
    assert.equal(picker.calls[0].copyToCacheDirectory, true);
    assert.equal(picker.calls[0].multiple, false);
    assert.deepEqual(picker.calls[0].type, [
      'image/png',
      'application/octet-stream',
    ]);
  });

  await test('aceita apenas extensao PNG, case-insensitive', () => {
    assert.equal(isSupportedPngFileName('mapa.png'), true);
    assert.equal(isSupportedPngFileName('MAPA.PNG'), true);
    assert.equal(isSupportedPngFileName('mapa.PnG'), true);
    assert.equal(isSupportedPngFileName('mapa.jpg'), false);
    assert.equal(isSupportedPngFileName('mapa.jpeg'), false);
    assert.equal(isSupportedPngFileName('mapa.webp'), false);
    assert.equal(isSupportedPngFileName('mapa.gif'), false);
    assert.equal(isSupportedPngFileName('mapa.pdf'), false);
    assert.equal(isSupportedPngFileName('mapa.zip'), false);
    assert.equal(isSupportedPngFileName('mapa.geojson'), false);
    assert.equal(isSupportedPngFileName('mapa.json'), false);
    assert.equal(isSupportedPngFileName('mapa'), false);
  });

  await test('aceita MIME image/png, MIME ausente e fallback generico Android com nome PNG', () => {
    assert.equal(isSupportedPngMimeType('image/png', 'mapa.png'), true);
    assert.equal(isSupportedPngMimeType('image/png; charset=utf-8', 'mapa.png'), true);
    assert.equal(isSupportedPngMimeType(undefined, 'mapa.png'), true);
    assert.equal(isSupportedPngMimeType('', 'mapa.png'), true);
    assert.equal(isSupportedPngMimeType('application/octet-stream', 'mapa.png'), true);

    assert.equal(validatePickedPngFile(baseFile()).ok, true);
    assert.equal(validatePickedPngFile(baseFile({ mimeType: undefined })).ok, true);
    assert.equal(validatePickedPngFile(baseFile({ mimeType: 'application/octet-stream' })).ok, true);
  });

  await test('rejeita extensoes nao PNG mesmo com MIME generico', () => {
    ['mapa.jpg', 'mapa.jpeg', 'mapa.webp', 'mapa.gif', 'mapa.pdf', 'mapa.zip', 'mapa.geojson', 'mapa.json', 'mapa'].forEach((name) => {
      const validation = validatePickedPngFile(baseFile({ name, mimeType: 'application/octet-stream' }));
      assert.equal(validation.ok, false);
      assert.equal(validation.errors.some((error) => error.code === 'UNSUPPORTED_FILE_TYPE'), true);
    });
  });

  await test('rejeita MIME incompativel mesmo com extensao PNG', () => {
    const validation = validatePickedPngFile(baseFile({ mimeType: 'image/jpeg' }));

    assert.equal(validation.ok, false);
    assert.equal(validation.errors[0].code, 'UNSUPPORTED_MIME_TYPE');
  });

  await test('controla limite de tamanho sem ler conteudo do arquivo', () => {
    const tooLarge = validatePickedPngFile(baseFile({
      size: MAX_PNG_FILE_SIZE_BYTES + 1,
    }));
    const belowLimit = validatePickedPngFile(baseFile({
      size: MAX_PNG_FILE_SIZE_BYTES,
    }));
    const unknownSize = validatePickedPngFile(baseFile({
      size: undefined,
    }));

    assert.equal(tooLarge.ok, false);
    assert.equal(tooLarge.errors[0].code, 'FILE_TOO_LARGE');
    assert.equal(belowLimit.ok, true);
    assert.equal(unknownSize.ok, true);
    assert.equal(unknownSize.warnings[0].code, 'UNKNOWN_FILE_SIZE');
  });

  await test('valida ausencia de uri e nome como erros controlados', () => {
    const missingUri = validatePickedPngFile(baseFile({ uri: '' }));
    const missingName = validatePickedPngFile(baseFile({ name: '' }));

    assert.equal(missingUri.ok, false);
    assert.equal(missingUri.errors[0].code, 'MISSING_FILE_URI');
    assert.equal(missingName.ok, false);
    assert.equal(missingName.errors[0].code, 'MISSING_FILE_NAME');
  });

  await test('resultado invalido do picker nao persiste nem tenta recuperar arquivo', async () => {
    const picker = createPicker({ canceled: false, assets: [] });
    const result = await pickPngDocument({ documentPicker: picker.adapter });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'PICKER_RESULT_INVALID');
  });

  await test('escopo: servico nao importa persistencia, telas, mocks, storage ou assets', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'PngFilePickerService.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('PngMapImportService'), false);
    assert.equal(source.includes('@tche:png-map-imports:v1'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
    assert.equal(source.includes('AsyncStorage'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('Mapa.list'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('sela-prata-i'), false);
    assert.equal(source.includes('expo-file-system'), false);
    assert.equal(source.includes('readAsStringAsync'), false);
    assert.equal(source.includes('copyAsync'), false);
    assert.equal(source.includes('writeAsStringAsync'), false);
    assert.equal(source.includes('React'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de PngFilePickerService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
