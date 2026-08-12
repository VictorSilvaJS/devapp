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

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const assertVirtualizationWindow = (source, componentName) => {
  assert.match(source, new RegExp(`<${componentName}\\b`));
  assert.match(source, /removeClippedSubviews/);
  assert.match(source, /initialNumToRender=\{8\}/);
  assert.match(source, /maxToRenderPerBatch=\{8\}/);
  assert.match(source, /updateCellsBatchingPeriod=\{50\}/);
  assert.match(source, /windowSize=\{7\}/);
  assert.match(source, /RefreshControl/);
};

test('Propriedades virtualiza cartões e carrega uma vez por foco', () => {
  const source = readSource('src/screens/PropriedadesScreen.tsx');
  assertVirtualizationWindow(source, 'FlatList');
  assert.match(source, /useFocusEffect/);
  assert.doesNotMatch(source, /navigation\.addListener\('focus'/);
  assert.doesNotMatch(source, /produtoresFiltrados\.map\(/);
  assert.match(source, /useMemo\(\(\) => filtrarPropriedadesPorLocalizacao/);
  assert.match(source, /ListHeaderComponent/);
  assert.match(source, /ActiveFilterBar/);
});

test('Visitas virtualiza grupos e usa índice de Propriedades', () => {
  const source = readSource('src/screens/VisitasScreen.tsx');
  assertVirtualizationWindow(source, 'SectionList');
  assert.match(source, /renderSectionHeader/);
  assert.match(source, /stickySectionHeadersEnabled=\{false\}/);
  assert.doesNotMatch(source, /section\.items\.map\(/);
  assert.match(source, /new Map\(/);
  assert.match(source, /useMemo\(\(\) => groupVisitasForList/);
});

test('Caderno virtualiza registros e memoriza filtro e índice', () => {
  const source = readSource('src/screens/CadernoCampoScreen.tsx');
  assertVirtualizationWindow(source, 'FlatList');
  assert.doesNotMatch(source, /registrosFiltrados\.map\(/);
  assert.match(source, /new Map\(/);
  assert.match(source, /useMemo\(\(\) => ordenarCadernosPorDataRecente/);
  assert.match(source, /ListEmptyComponent/);
});

test('abas suspendem renderização fora de foco sem desmontar estado', () => {
  const source = readSource('src/navigation/index.tsx');
  assert.match(source, /lazy: true/);
  assert.match(source, /freezeOnBlur: true/);
  assert.equal((source.match(/detachInactiveScreens/g) || []).length, 3);
  assert.doesNotMatch(source, /unmountOnBlur: true/);
});

if (failed > 0) process.exitCode = 1;
else console.log('\nTodos os testes de listVirtualizationCompat passaram.');
