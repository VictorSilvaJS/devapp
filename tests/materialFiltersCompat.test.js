const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  path.join(__dirname, '..', 'src/screens/MapasScreen.tsx'),
  'utf8'
);

test('panorama inicia sem selecionar automaticamente a demarcacao mais recente', () => {
  assert.match(source, /const \[anoFiltroLimite, setAnoFiltroLimite\] = useState\(null\)/);
  assert.doesNotMatch(source, /return anoAtual && anos\.includes\(anoAtual\) \? anoAtual : anos\[0\]/);

  const neutralFallbacks = source.match(
    /return anoAtual && anos\.includes\(anoAtual\) \? anoAtual : null;/g
  ) || [];
  assert.equal(neutralFallbacks.length, 2);
});

test('barra principal mantem busca, acionador e resumo dos filtros aplicados', () => {
  const panorama = source.match(/const renderPanorama = \(\) => \(([\s\S]*?)\n  \);/);
  assert.ok(panorama, 'renderPanorama deve existir');

  const searchIndex = panorama[1].indexOf('<SearchBar');
  const triggerIndex = panorama[1].indexOf('<FilterTrigger');
  const activeBarIndex = panorama[1].indexOf('<ActiveFilterBar');
  const contentIndex = panorama[1].indexOf('{renderGeoJsonImportPanel()}');

  assert.ok(searchIndex >= 0 && triggerIndex > searchIndex);
  assert.ok(activeBarIndex > triggerIndex && contentIndex > activeBarIndex);
  assert.match(panorama[1], /label="Filtros do panorama"/);
  assert.doesNotMatch(panorama[1], /Limpar filtros do panorama/);
});

test('bottom sheet concentra contexto, materiais e ordenacao em rascunho', () => {
  [
    'Propriedade',
    'Demarcação',
    'Talhão',
    'Ano dos materiais',
    'Safra/Safrinha',
    'Categoria',
    'Ordenar por',
  ].forEach((title) => {
    assert.match(source, new RegExp(`<FilterSection title="${title.replace('/', '\\/')}"`));
  });

  ['fazenda', 'demarcacao', 'talhao', 'anoMaterial', 'safra', 'categoria', 'ordenacao']
    .forEach((field) => assert.match(source, new RegExp(`${field}:`)));

  assert.match(source, /onRequestClose=\{cancelarFiltrosMateriais\}/);
  assert.match(source, /onClear=\{\(\) => setFiltrosMateriaisRascunho\(\{/);
  assert.match(source, /onApply=\{\(\) => \{/);
  assert.match(source, /setAnoFiltroMateriais\(filtrosMateriaisRascunho\.anoMaterial\)/);
  assert.match(source, /setSafraFiltroMapas\(filtrosMateriaisRascunho\.safra\)/);
});

test('resumo ativo cobre todos os filtros movidos e oferece limpeza unica', () => {
  ['fazenda', 'demarcacao', 'talhao', 'ano-material', 'safra', 'categoria', 'ordenacao']
    .forEach((key) => assert.match(source, new RegExp(`key: '${key}'`)));

  assert.match(source, /onClear=\{limparFiltrosPanorama\}/);
  assert.match(source, /setOrdenacao\('recente'\)/);
});

test('secao usa titulo plural sem alterar a fonte de materiais', () => {
  assert.match(source, /const tituloTela = 'Materiais técnicos';/);
  assert.match(source, /const tituloSecaoMateriais = 'Materiais técnicos';/);
  assert.doesNotMatch(source, /const tituloTela = 'Material técnico';/);
  assert.doesNotMatch(source, /const tituloSecaoMateriais = 'Material técnico';/);
  assert.match(source, /materiaisTecnicosNoContexto/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de materialFiltersCompat passaram.');
}
