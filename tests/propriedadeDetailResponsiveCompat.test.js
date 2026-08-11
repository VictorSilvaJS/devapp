const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getPropriedadeDetailResponsiveLayout,
} = require('../.tmp-domain-compat/src/utils/propriedadeDetailResponsive');

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

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/screens/ProdutorScreen.tsx'),
  'utf8'
);

test('retrato do aparelho fisico preserva uma coluna e navegacao rolavel', () => {
  assert.deepEqual(getPropriedadeDetailResponsiveLayout(533, 853), {
    isLandscape: false,
    useWideOverview: false,
    useWideIndicators: false,
    navigationFits: false,
    summaryColumns: 1,
    stackActions: true,
  });
});

test('paisagem do aparelho fisico ocupa a largura com duas colunas', () => {
  assert.deepEqual(getPropriedadeDetailResponsiveLayout(853, 533), {
    isLandscape: true,
    useWideOverview: true,
    useWideIndicators: true,
    navigationFits: true,
    summaryColumns: 2,
    stackActions: true,
  });
});

test('paisagem compacta nao comprime conteudo em colunas estreitas', () => {
  assert.deepEqual(getPropriedadeDetailResponsiveLayout(700, 480), {
    isLandscape: true,
    useWideOverview: false,
    useWideIndicators: false,
    navigationFits: false,
    summaryColumns: 1,
    stackActions: false,
  });
});

test('detalhe reage as dimensoes e mantem indicadores de rolagem acessiveis', () => {
  assert.match(source, /useWindowDimensions\(\)/);
  assert.match(source, /getPropriedadeDetailResponsiveLayout\(width, height\)/);
  assert.match(source, /showsVerticalScrollIndicator/);
  assert.match(source, /persistentScrollbar/);
  assert.match(source, /Deslize para ver todos os indicadores/);
  assert.doesNotMatch(source, /Deslize para ver todas as seções/);
  assert.match(source, /Role para ver todos os dados desta seção/);
  assert.match(source, /responsiveLayout\.summaryColumns === 2/);
  assert.match(source, /styles\.summaryGridWide/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de propriedadeDetailResponsiveCompat passaram.');
}
