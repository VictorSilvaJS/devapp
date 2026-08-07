const assert = require('node:assert/strict');
const {
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
});

test('separa base e extensao para criacao via seletor Android', () => {
  assert.deepEqual(splitPhoneExportFileName('Mapa final.pdf'), {
    baseName: 'Mapa final',
    extension: 'pdf',
  });
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de phoneFileExportCompat passaram.');
}
