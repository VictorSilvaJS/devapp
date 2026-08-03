const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getDashboardColumnWidth,
  getDashboardResponsiveLayout,
} = require('../.tmp-domain-compat/src/utils/dashboardResponsive');

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

const readSource = (relativePath) => (
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
);

test('breakpoints preservam duas colunas no retrato', () => {
  assert.deepEqual(getDashboardResponsiveLayout(800, 1280), {
    isLandscape: false,
    standardColumns: 2,
    propriedadesColumns: 2,
    produtorColumns: 2,
    splitProdutorOverview: false,
  });
});

test('paisagem ampla usa as dimensoes logicas do dispositivo', () => {
  assert.deepEqual(getDashboardResponsiveLayout(853, 533), {
    isLandscape: true,
    standardColumns: 3,
    propriedadesColumns: 5,
    produtorColumns: 2,
    splitProdutorOverview: true,
  });
  assert.equal(getDashboardColumnWidth(5), '20%');
});

test('paisagem compacta evita colunas estreitas demais', () => {
  assert.deepEqual(getDashboardResponsiveLayout(700, 480), {
    isLandscape: true,
    standardColumns: 2,
    propriedadesColumns: 3,
    produtorColumns: 2,
    splitProdutorOverview: false,
  });
  assert.equal(getDashboardColumnWidth(0), '100%');
});

test('Dashboard de Admin e Colaborador reage a orientacao sem largura fixa', () => {
  const source = readSource('src/screens/DashboardScreen.tsx');

  assert.match(source, /useWindowDimensions\(\)/);
  assert.match(source, /getDashboardResponsiveLayout\(width, height\)/);
  assert.match(source, /getDashboardColumnWidth\(responsiveLayout\.standardColumns\)/);
  assert.match(source, /style=\{\[styles\.statCardWrapper, \{ width: statCardWidth \}\]\}/);
  assert.doesNotMatch(source, /statCardWrapper:\s*\{[\s\S]*?width: '50%'/);
});

test('Propriedades usa grade fluida e acao ancorada fora da rolagem', () => {
  const source = readSource('src/screens/PropriedadesScreen.tsx');
  const scrollEnd = source.indexOf('</ScrollView>');
  const safeArea = source.indexOf('<View style={styles.safeActionArea}>');

  assert.match(source, /getDashboardColumnWidth\(responsiveLayout\.propriedadesColumns\)/);
  assert.match(source, /styles\.metricsGrid/);
  assert.doesNotMatch(source, /style=\{styles\.metricsCarousel\}/);
  assert.doesNotMatch(source, /metricCard:\s*\{[\s\S]*?width: 100/);
  assert.ok(safeArea > scrollEnd, 'a acao deve ficar fora da ScrollView principal');
  assert.match(source, /placement="docked"/);
  assert.match(source, /safeActionArea:[\s\S]*?flexShrink: 0/);
});

test('Dashboard do Produtor divide Propriedade e indicadores somente no paisagem', () => {
  const source = readSource('src/screens/ClienteDashboardScreen.tsx');
  const propertyPane = source.indexOf('styles.propriedadesOverview');
  const statsPane = source.indexOf('styles.statsGrid');

  assert.match(source, /getDashboardColumnWidth\(responsiveLayout\.produtorColumns\)/);
  assert.match(source, /responsiveLayout\.splitProdutorOverview && styles\.overviewLayoutLandscape/);
  assert.match(source, /cardsResumo\.map/);
  assert.ok(propertyPane >= 0 && statsPane > propertyPane);
  assert.match(source, /overviewLayoutLandscape:[\s\S]*?flexDirection: 'row'/);
  assert.match(source, /propriedadesOverviewLandscape:[\s\S]*?width: '38%'/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de dashboardResponsiveCompat passaram.');
}
