const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  filterFazendaMapaTalhoes,
  resolveClosestFazendaMapaSheetSnap,
  resolveFazendaMapaPanelMode,
  resolveFazendaMapaSheetSnapPoints,
  resolveFazendaMapaSidePanelWidth,
} = require('../.tmp-domain-compat/src/utils/fazendaMapaResponsiveCompat');

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

const screenSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/screens/FazendaMapaScreen.tsx'),
  'utf8'
);
const mapSource = fs.readFileSync(
  path.join(__dirname, '..', 'src/components/MapaFazendaView.tsx'),
  'utf8'
);

test('celular em retrato usa bottom sheet e paisagem ou tablet usa painel lateral', () => {
  assert.equal(resolveFazendaMapaPanelMode(393, 852), 'bottom-sheet');
  assert.equal(resolveFazendaMapaPanelMode(852, 393), 'side-panel');
  assert.equal(resolveFazendaMapaPanelMode(800, 1280), 'side-panel');
  assert.equal(resolveFazendaMapaSidePanelWidth(852), 290);
  assert.equal(resolveFazendaMapaSidePanelWidth(1600), 420);
});

test('bottom sheet possui tres snap points reais, ordenados e alcancaveis', () => {
  const snaps = resolveFazendaMapaSheetSnapPoints(852, 24);
  assert.ok(snaps.collapsed < snaps.medium);
  assert.ok(snaps.medium < snaps.expanded);
  assert.equal(resolveClosestFazendaMapaSheetSnap(snaps.collapsed + 3, snaps), 'collapsed');
  assert.equal(resolveClosestFazendaMapaSheetSnap(snaps.medium + 3, snaps), 'medium');
  assert.equal(resolveClosestFazendaMapaSheetSnap(snaps.expanded - 3, snaps), 'expanded');
  assert.equal(resolveClosestFazendaMapaSheetSnap(snaps.medium, snaps, 1), 'collapsed');
  assert.equal(resolveClosestFazendaMapaSheetSnap(snaps.medium, snaps, -1), 'expanded');
});

test('busca percorre a lista completa por nome, cultura e solo sem depender de acentos', () => {
  const talhoes = [
    { id: 't1', talhao: 'Talhão Norte', cultura_atual: 'Soja', tipo_solo: 'Argiloso' },
    { id: 't2', talhao: 'Baixada', cultura_atual: 'Milho', tipo_solo: 'Arenoso' },
  ];
  assert.deepEqual(filterFazendaMapaTalhoes(talhoes, 'talhao norte').map((item) => item.id), ['t1']);
  assert.deepEqual(filterFazendaMapaTalhoes(talhoes, 'milho').map((item) => item.id), ['t2']);
  assert.deepEqual(filterFazendaMapaTalhoes(talhoes, 'argiloso').map((item) => item.id), ['t1']);
});

test('selecao simples atualiza o mapa por JavaScript sem reconstruir a WebView', () => {
  assert.match(mapSource, /\(\) => gerarHTMLLeaflet\(talhoes \|\| \[\]\),\s*\[talhoes\]/s);
  assert.match(mapSource, /const webViewSource = useMemo\(\(\) => \(\{ html \}\), \[html\]\)/);
  assert.match(mapSource, /source=\{webViewSource\}/);
  assert.match(mapSource, /window\.selecionarTalhao/);
  assert.doesNotMatch(mapSource, /\[talhoes, talhaoSelecionadoId\]/);
});

test('selecao, marcador e centralizacao sao comandos independentes', () => {
  const selectionFunction = mapSource.slice(
    mapSource.indexOf('function selecionarTalhao(id)'),
    mapSource.indexOf('function centralizarTalhao(id)')
  );
  const markerFunction = mapSource.slice(
    mapSource.indexOf('function atualizarLocalizacaoUsuario(payload)'),
    mapSource.indexOf('function centralizarLocalizacaoUsuario(payload)')
  );
  const locationCenterFunction = mapSource.slice(
    mapSource.indexOf('function centralizarLocalizacaoUsuario(payload)'),
    mapSource.indexOf('function recalcularDimensoes()')
  );

  assert.doesNotMatch(selectionFunction, /panTo|setView|fitBounds/);
  assert.doesNotMatch(markerFunction, /panTo|setView|fitBounds/);
  assert.match(locationCenterFunction, /map\.setView/);
  assert.match(mapSource, /centralizarLocalizacao: \(location: ForegroundUserLocation\) => void/);
});

test('painel de retrato tem gesto funcional e nao bloqueia a area exposta do mapa', () => {
  assert.match(screenSource, /PanResponder\.create/);
  assert.match(screenSource, /resolveClosestFazendaMapaSheetSnap/);
  assert.match(screenSource, /onStartShouldSetPanResponder: \(\) => false/);
  assert.match(screenSource, /sheetTranslateY\.stopAnimation/);
  assert.match(screenSource, /sheetGestureCurrentRef\.current/);
  assert.match(screenSource, /pointerEvents="box-none"/);
  assert.doesNotMatch(screenSource, /style=\{styles\.backdrop\}/);
  assert.doesNotMatch(screenSource, /<Modal/);
});

test('paisagem mantem mapa e painel lado a lado sem remontar o componente do mapa', () => {
  assert.match(screenSource, /<View style=\{styles\.wideLayout\}>\s*\{mapa\}/s);
  assert.match(screenSource, /isSidePanel && !mapaExpandido/);
  assert.match(screenSource, /style=\{\[styles\.sidePanel, \{ width: sidePanelWidth \}\]\}/);
  assert.match(screenSource, /recalcularDimensoes/);
});

test('lista e pesquisavel, vertical e completa, sem legenda parcial mais onze', () => {
  assert.match(screenSource, /placeholder="Buscar Talhão, cultura ou solo"/);
  assert.match(screenSource, /Lista completa/);
  assert.match(screenSource, /talhoes\.map\(\(talhao\) =>/);
  assert.doesNotMatch(screenSource, /slice\(0, 4\)/);
  assert.doesNotMatch(screenSource, /legendaMais/);
});

test('Expandir mapa remove o painel e oferece restauracao explicita', () => {
  assert.match(screenSource, /setMapaExpandido\(true\)/);
  assert.match(screenSource, /setMapaExpandido\(false\)/);
  assert.match(screenSource, /Expandir mapa/);
  assert.match(screenSource, /Mostrar painel/);
  assert.match(screenSource, /!mapaExpandido/);
});

test('dimensoes e rotulos respondem ao layout atual sem constantes de tela', () => {
  assert.match(screenSource, /useWindowDimensions\(\)/);
  assert.doesNotMatch(screenSource, /Dimensions\.get\('window'\)/);
  assert.match(mapSource, /map\.on\('zoomend', atualizarVisibilidadeRotulos\)/);
  assert.match(mapSource, /map\.getBoundsZoom\(bounds, false, \[68, 68\]\)/);
  assert.match(mapSource, /labelMinZoom/);
  assert.doesNotMatch(mapSource, /projection\.talhoes\.length <= 8/);
});

test('ponto vindo do Caderno e centralizado assim que o mapa fica pronto', () => {
  assert.match(screenSource, /centerUserLocationOnReady=\{Boolean\(cadernoLocationParam\)\}/);
  assert.match(mapSource, /pendingLocationCenterRef/);
  assert.match(mapSource, /centerUserLocationOnReady \? userLocationRef\.current : null/);
  assert.match(mapSource, /locationCenterTimeoutRef/);
  assert.match(
    mapSource,
    /locationCenterTimeoutRef\.current = setTimeout\(\(\) => \{\s+centerLocationInWebView\(locationToCenter\)/
  );
  assert.match(mapSource, /clearTimeout\(locationCenterTimeoutRef\.current\)/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de fazendaMapaResponsiveCompat passaram.');
}
