const assert = require('node:assert/strict');
const {
  resolvePhoneExportCreatedFileName,
  resolvePhoneExportMimeType,
  sanitizePhoneExportFileName,
  splitPhoneExportFileName,
} = require('../.tmp-domain-compat/src/utils/phoneFileExportCompat');

let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

test('preserva nome legivel e normaliza extensao', () => {
  assert.equal(
    sanitizePhoneExportFileName('../Mapa de pH 2026.PNG', '', 'image/png'),
    'Mapa de pH 2026.png'
  );
  assert.equal(
    sanitizePhoneExportFileName('', 'https://example.test/fotos/folha.webp?token=1'),
    'folha.webp'
  );
});

test('remove caracteres proibidos e infere extensao pelo MIME', () => {
  assert.equal(
    sanitizePhoneExportFileName('Diagnóstico: lote 1?', '', 'image/jpeg'),
    'Diagnóstico- lote 1.jpg'
  );
  assert.equal(resolvePhoneExportMimeType('', 'arquivo.geojson'), 'application/geo+json');
  assert.equal(resolvePhoneExportMimeType('', 'documento.pdf'), 'application/pdf');
});

test('separa base e extensao para criacao via seletor Android', () => {
  assert.deepEqual(splitPhoneExportFileName('Mapa final.pdf'), {
    baseName: 'Mapa final',
    extension: 'pdf',
  });
});

test('usa o nome fisico devolvido pelo Android quando o provedor resolve colisao', () => {
  assert.equal(
    resolvePhoneExportCreatedFileName(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FTeste/document/primary%3ADownload%2FTeste%2F1013%20(1).png',
      '1013.png'
    ),
    '1013 (1).png'
  );
});

test('mantem o nome solicitado quando o provedor usa um identificador opaco', () => {
  assert.equal(
    resolvePhoneExportCreatedFileName('content://example.test/document/opaque-id', '1013.png'),
    '1013.png'
  );
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de phoneFileExportCompat passaram.');
}
