const assert = require('node:assert/strict');
const {
  MAX_PRESCRIPTION_ZIP_FILE_SIZE_BYTES,
  isSupportedPrescriptionZipFileName,
  isSupportedPrescriptionZipMimeType,
  normalizePickedPrescriptionZipDocumentResult,
  pickPrescriptionZipDocument,
  validatePickedPrescriptionZipFile,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipFilePickerService');

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

const run = async () => {
  await test('aceita somente extensao ZIP e MIME compatível', () => {
    assert.equal(isSupportedPrescriptionZipFileName('Prescricao.ZIP'), true);
    assert.equal(isSupportedPrescriptionZipFileName('mapa.png'), false);

    assert.equal(isSupportedPrescriptionZipMimeType('application/zip', 'a.zip'), true);
    assert.equal(isSupportedPrescriptionZipMimeType('application/x-zip-compressed', 'a.zip'), true);
    assert.equal(isSupportedPrescriptionZipMimeType('application/octet-stream', 'a.zip'), true);
    assert.equal(isSupportedPrescriptionZipMimeType(undefined, 'a.zip'), true);
    assert.equal(isSupportedPrescriptionZipMimeType('application/octet-stream', 'a.png'), false);
    assert.equal(isSupportedPrescriptionZipMimeType('image/png', 'a.zip'), false);
  });

  await test('rejeita png, pdf, geojson, json, shp, kml e kmz no fluxo ZIP', () => {
    for (const name of ['mapa.png', 'laudo.pdf', 'area.geojson', 'dados.json', 'shape.shp', 'rota.kml', 'pacote.kmz']) {
      const result = validatePickedPrescriptionZipFile({
        uri: `content://picker/${name}`,
        name,
        size: 100,
        mimeType: name.endsWith('.png') ? 'image/png' : 'application/octet-stream',
      });

      assert.equal(result.ok, false);
      assert.equal(result.errors.some((error) => error.code === 'UNSUPPORTED_FILE_TYPE'), true);
    }
  });

  await test('valida ZIP sem ler bytes do arquivo', () => {
    const result = validatePickedPrescriptionZipFile({
      uri: 'content://picker/prescricao.zip',
      name: 'Prescricao.zip',
      size: 1024,
      mimeType: 'application/zip',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'Prescricao.zip');
    assert.deepEqual(result.errors, []);
  });

  await test('bloqueia arquivo grande e campos obrigatorios ausentes', () => {
    const large = validatePickedPrescriptionZipFile({
      uri: 'content://picker/prescricao.zip',
      name: 'Prescricao.zip',
      size: MAX_PRESCRIPTION_ZIP_FILE_SIZE_BYTES + 1,
      mimeType: 'application/zip',
    });
    const missing = validatePickedPrescriptionZipFile({});

    assert.equal(large.ok, false);
    assert.equal(large.errors[0].code, 'FILE_TOO_LARGE');
    assert.equal(missing.ok, false);
    assert.equal(missing.errors.some((error) => error.code === 'MISSING_FILE_URI'), true);
    assert.equal(missing.errors.some((error) => error.code === 'MISSING_FILE_NAME'), true);
  });

  await test('normaliza resultado novo e legado do DocumentPicker', () => {
    assert.deepEqual(normalizePickedPrescriptionZipDocumentResult({
      canceled: false,
      assets: [{ uri: 'content://a', name: 'a.zip', size: 1, mimeType: 'application/zip' }],
    }), {
      uri: 'content://a',
      name: 'a.zip',
      size: 1,
      mimeType: 'application/zip',
    });

    assert.deepEqual(normalizePickedPrescriptionZipDocumentResult({
      type: 'success',
      uri: 'content://b',
      name: 'b.zip',
    }), {
      uri: 'content://b',
      name: 'b.zip',
      size: undefined,
      mimeType: undefined,
    });
  });

  await test('picker cancelado retorna erro controlado', async () => {
    const result = await pickPrescriptionZipDocument({
      documentPicker: {
        getDocumentAsync: async () => ({ canceled: true }),
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'PICKER_CANCELLED');
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de prescriptionZipFilePickerService passaram.');
});
