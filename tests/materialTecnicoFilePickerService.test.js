const assert = require('node:assert/strict');
const {
  MAX_MATERIAL_TECNICO_FILE_SIZE_BYTES,
  getMaterialTecnicoFormatoFromName,
  pickMaterialTecnicoDocument,
  validatePickedMaterialTecnicoFile,
} = require('../.tmp-domain-compat/src/services/MaterialTecnicoFilePickerService');

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
  await test('reconhece PNG, PDF e ZIP sem alterar o nome', () => {
    assert.equal(getMaterialTecnicoFormatoFromName('Mapa pH.PNG'), 'png');
    assert.equal(getMaterialTecnicoFormatoFromName('Laudo 2025.pdf'), 'pdf');
    assert.equal(getMaterialTecnicoFormatoFromName('CAL_T01.zip'), 'zip');

    const result = validatePickedMaterialTecnicoFile({
      uri: 'content://picker/arquivo',
      name: 'Nome Original 01.PDF',
      size: 1024,
      mimeType: 'application/pdf',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.name, 'Nome Original 01.PDF');
    assert.equal(result.file.formato, 'pdf');
  });

  await test('aceita MIME generico do Android quando a extensao e valida', () => {
    const result = validatePickedMaterialTecnicoFile({
      uri: 'content://picker/pacote',
      name: 'KCL_T01.zip',
      size: 2048,
      mimeType: 'application/octet-stream',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.formato, 'zip');
  });

  await test('rejeita extensao, MIME divergente e arquivo acima de 80 MB', () => {
    const extension = validatePickedMaterialTecnicoFile({
      uri: 'content://picker/mapa',
      name: 'mapa.shp',
      size: 10,
    });
    const mime = validatePickedMaterialTecnicoFile({
      uri: 'content://picker/mapa',
      name: 'mapa.png',
      size: 10,
      mimeType: 'application/pdf',
    });
    const size = validatePickedMaterialTecnicoFile({
      uri: 'content://picker/mapa',
      name: 'mapa.pdf',
      size: MAX_MATERIAL_TECNICO_FILE_SIZE_BYTES + 1,
      mimeType: 'application/pdf',
    });

    assert.equal(extension.errors[0].code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal(mime.errors[0].code, 'UNSUPPORTED_MIME_TYPE');
    assert.equal(size.errors[0].code, 'FILE_TOO_LARGE');
  });

  await test('cancelamento do seletor e controlado', async () => {
    const result = await pickMaterialTecnicoDocument({
      documentPicker: {
        getDocumentAsync: async () => ({ canceled: true, assets: null }),
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'PICKER_CANCELLED');
  });

  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de MaterialTecnicoFilePickerService passaram.');
};

run();
