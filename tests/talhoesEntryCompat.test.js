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

const componentSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/components/PropriedadeTalhoesEntry.tsx'),
  'utf8'
);
const screenSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/screens/ProdutorScreen.tsx'),
  'utf8'
);

test('entrada de Talhoes inicia em Lista e oferece o seletor Lista e Mapa', () => {
  assert.match(componentSource, /useState<TalhoesView>\('lista'\)/);
  assert.match(componentSource, /view === 'lista' \? 'Lista' : 'Mapa'/);
  assert.match(componentSource, /accessibilityRole="tab"/);
  assert.match(componentSource, /accessibilityState=\{\{ selected: isActive \}\}/);
});

test('Lista apresenta Talhoes individualmente e trata a ausencia de dados', () => {
  assert.match(componentSource, /activeView === 'lista'/);
  assert.match(componentSource, /talhoes\.map\(\(talhao, index\)/);
  assert.match(componentSource, /formatAreaHa\(talhao\?\.area_hectares\)/);
  assert.match(componentSource, /title="Nenhum Talhão disponível"/);
  assert.match(componentSource, /onPress=\{\(\) => onOpenMapa\(talhao\)\}/);
  assert.match(componentSource, /Sem demarcação disponível/);
  assert.match(componentSource, /const possuiGeometria = temGeometria\(talhao\)/);
});

test('Mapa reutiliza a demarcacao existente e oferece acesso ao mapa interativo', () => {
  assert.match(componentSource, /<ShapeRenderer/);
  assert.match(componentSource, /onTalhaoPress=\{onOpenMapa\}/);
  assert.match(componentSource, /Abrir mapa interativo/);
  assert.match(componentSource, /Demarcação indisponível/);
});

test('navegacao de um Talhao preserva Propriedade e selecao no FazendaMapa', () => {
  assert.match(screenSource, /const handleAbrirTalhaoNoMapa = \(talhao\?\) => navigation\.navigate\(/);
  assert.match(screenSource, /'FazendaMapa'/);
  assert.match(screenSource, /buildFazendaMapaRouteParamsFromPropriedade\(/);
  assert.match(screenSource, /talhaoId: talhao\.geometria_id \|\| talhao\.id/);
  assert.match(screenSource, /Talhao\.getByFazenda\(fazendaAtualId\)/);
  assert.match(screenSource, /talhoes=\{talhoes\}/);
  assert.match(screenSource, /onOpenMapa=\{handleAbrirTalhaoNoMapa\}/);
  assert.doesNotMatch(screenSource, /subtitle="Abra um Talhão/);
  assert.doesNotMatch(screenSource, /actionLabel="Abrir detalhes"/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de talhoesEntryCompat passaram.');
}
