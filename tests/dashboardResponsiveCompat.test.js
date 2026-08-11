const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getDashboardColumnWidth,
  getDashboardResponsiveLayout,
} = require('../.tmp-domain-compat/src/utils/dashboardResponsive');
const {
  getPropriedadesListResponsiveLayout,
  getPropriedadesWideMetricCardWidth,
} = require('../.tmp-domain-compat/src/utils/propriedadesListResponsive');

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
    produtorColumns: 2,
    splitProdutorOverview: false,
  });
});

test('paisagem ampla usa as dimensoes logicas do dispositivo', () => {
  assert.deepEqual(getDashboardResponsiveLayout(853, 533), {
    isLandscape: true,
    standardColumns: 3,
    produtorColumns: 2,
    splitProdutorOverview: true,
  });
  assert.equal(getDashboardColumnWidth(2), '50%');
});

test('paisagem compacta evita colunas estreitas demais', () => {
  assert.deepEqual(getDashboardResponsiveLayout(700, 480), {
    isLandscape: true,
    standardColumns: 2,
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

test('Propriedades encaixa indicadores na paisagem ampla e preserva carrossel compacto', () => {
  const source = readSource('src/screens/PropriedadesScreen.tsx');

  assert.deepEqual(getPropriedadesListResponsiveLayout(853, 533), {
    isLandscape: true,
    useWideMetrics: true,
  });
  assert.deepEqual(getPropriedadesListResponsiveLayout(533, 853), {
    isLandscape: false,
    useWideMetrics: false,
  });
  assert.deepEqual(getPropriedadesListResponsiveLayout(700, 480), {
    isLandscape: true,
    useWideMetrics: false,
  });
  assert.equal(getPropriedadesWideMetricCardWidth(853, 5, 12, 16), 154.6);
  assert.match(source, /useWindowDimensions\(\)/);
  assert.match(source, /getPropriedadesListResponsiveLayout\(width, height\)/);
  assert.match(source, /getPropriedadesWideMetricCardWidth\(width, 5, 12, spacing\.screen\)/);
  assert.match(source, /scrollEnabled=\{!responsiveLayout\.useWideMetrics\}/);
  assert.match(source, /showsHorizontalScrollIndicator=\{!responsiveLayout\.useWideMetrics\}/);
  assert.match(source, /persistentScrollbar=\{!responsiveLayout\.useWideMetrics\}/);
  assert.match(source, /responsiveLayout\.useWideMetrics && styles\.metricsContentWide/);
  assert.match(source, /responsiveLayout\.useWideMetrics[\s\S]*?styles\.metricCardWide[\s\S]*?width: wideMetricCardWidth/);
  assert.match(source, /metricCardScrollable:\s*\{[\s\S]*?minWidth: 132/);
  assert.match(source, /metricCardWide:\s*\{[\s\S]*?flexShrink: 0[\s\S]*?minWidth: 0/);
  assert.match(source, /metricCard:\s*\{[\s\S]*?borderWidth: 2/);
  assert.match(source, /Deslize para ver todos os indicadores/);
  assert.doesNotMatch(source, /placement="docked"|safeActionArea/);
  assert.match(source, /paddingBottom: spacing\.screen \+ 80/);
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
