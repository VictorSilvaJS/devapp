const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  classifyMapaWebViewFailure,
  getMapaWebViewHost,
  getMapaWebViewResourceScope,
} = require('../.tmp-domain-compat/src/utils/mapaWebViewCompat');

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

const read = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, '..', relativePath),
  'utf8'
);

const mapSource = read('src/components/MapaFazendaView.tsx');
const mapScreenSource = read('src/screens/FazendaMapaScreen.tsx');
const packageConfig = JSON.parse(read('package.json'));
const lifecyclePatchSource = read('scripts/patchReactNativeWebViewLifecycle.js');

test('recursos do mapa-base e do motor Leaflet possuem escopos distintos', () => {
  assert.equal(getMapaWebViewResourceScope('https://tile.openstreetmap.org/14/1/2.png'), 'base-map');
  assert.equal(getMapaWebViewResourceScope('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'), 'engine');
  assert.equal(getMapaWebViewResourceScope('about:blank'), 'document');
  assert.equal(getMapaWebViewHost('not-a-url'), null);
});

test('erro SSL -202 em mosaico preserva o mapa vetorial interativo', () => {
  const result = classifyMapaWebViewFailure({
    source: 'subresource',
    url: 'https://tile.openstreetmap.org/14/1/2.png?token=secret',
    code: -202,
    description: 'net::ERR_CERT_AUTHORITY_INVALID',
  });

  assert.equal(result.kind, 'ssl');
  assert.equal(result.scope, 'base-map');
  assert.equal(result.fallbackMode, 'base-only');
  assert.match(result.userMessage, /demarcação dos Talhões continua disponível/);
  assert.deepEqual(result.technical, {
    source: 'subresource',
    host: 'tile.openstreetmap.org',
    code: -202,
    statusCode: null,
    reason: null,
  });
});

test('erro do recurso Leaflet usa fallback vetorial local', () => {
  const result = classifyMapaWebViewFailure({
    source: 'subresource',
    url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    code: -2,
    description: 'net::ERR_NAME_NOT_RESOLVED',
  });

  assert.equal(result.kind, 'network');
  assert.equal(result.scope, 'engine');
  assert.equal(result.fallbackMode, 'vector');
  assert.match(result.userMessage, /demarcação local dos Talhões/);
});

test('timeout e encerramento do processo nunca são apresentados como cache offline completo', () => {
  const timeout = classifyMapaWebViewFailure({ source: 'ready-timeout' });
  const processGone = classifyMapaWebViewFailure({ source: 'render-process' });

  assert.equal(timeout.kind, 'timeout');
  assert.equal(timeout.fallbackMode, 'vector');
  assert.equal(processGone.kind, 'render-process');
  assert.equal(processGone.fallbackMode, 'vector');
  assert.doesNotMatch(`${timeout.userMessage} ${processGone.userMessage}`, /offline completo/i);
});

test('WebView permanece montado sob o fallback e evita a tela de erro nativa', () => {
  assert.match(mapSource, /event\.preventDefault\(\)/);
  assert.match(mapSource, /testID="mapa-fallback-overlay"/);
  assert.match(mapSource, /<WebView[\s\S]*\{fallbackAtivo \? \(/);
  assert.doesNotMatch(mapSource, /if \(fallbackAtivo\) \{\s*return \(/);
});

test('gerenciador Android aguarda o detach do WebView antes de destruí-lo', () => {
  assert.equal(packageConfig.scripts.postinstall, 'node scripts/patchReactNativeWebViewLifecycle.js');
  assert.match(lifecyclePatchSource, /viewWrapper\.isAttachedToWindow/);
  assert.match(lifecyclePatchSource, /addOnAttachStateChangeListener/);
  assert.match(lifecyclePatchSource, /onViewDetachedFromWindow/);
  assert.match(lifecyclePatchSource, /viewWrapper\.removeView\(webView\)/);
  assert.match(lifecyclePatchSource, /webView\.post \{/);
  assert.match(lifecyclePatchSource, /installedPackage\.version !== '13\.16\.1'/);
});

test('erros de subrecurso, HTTP e processo renderizador são diagnosticados', () => {
  assert.match(mapSource, /onLoadSubResourceError=\{handleSubResourceError\}/);
  assert.match(mapSource, /onHttpError=\{handleHttpError\}/);
  assert.match(mapSource, /onRenderProcessGone=\{handleRenderProcessGone\}/);
  assert.match(mapSource, /onContentProcessDidTerminate=\{handleContentProcessTerminated\}/);
  assert.match(mapSource, /console\.warn\('\[MapaWebView\]'/);
});

test('mosaicos detectam falha e recuperação sem derrubar os Talhões', () => {
  assert.match(mapSource, /baseMapLayer\.on\('tileerror'/);
  assert.match(mapSource, /baseMapLayer\.on\('tileload'/);
  assert.match(mapSource, /post\('mapa_base_status'/);
  assert.match(mapSource, /window\.recarregarMapaBase = carregarMapaBase/);
  assert.match(mapSource, /Tentar novamente/);
  assert.match(mapSource, /current\?\.fallbackMode === 'vector' && nextDiagnostic\.fallbackMode === 'base-only'/);
  assert.match(mapSource, /style=\{\[styles\.networkNotice, \{ top: noticeTopInset \}\]\}/);
  assert.match(mapScreenSource, /noticeTopInset=\{/);
});

test('cache seguro é reaproveitado sem aceitar conteúdo misto', () => {
  assert.match(mapSource, /cacheEnabled/);
  assert.match(mapSource, /cacheMode="LOAD_CACHE_ELSE_NETWORK"/);
  assert.match(mapSource, /mixedContentMode="never"/);
  assert.doesNotMatch(mapSource, /mixedContentMode="always"/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de mapaWebViewCompat passaram.');
}
