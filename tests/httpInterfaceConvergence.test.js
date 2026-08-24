const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Demo e HTTP compartilham apresentação de login sem compartilhar autenticação', () => {
  const demoLogin = source('src/screens/LoginScreen.tsx');
  const httpLogin = source('src/http/screens/HttpAuthScreens.tsx');
  const presentation = source('src/components/LoginPresentation.tsx');

  assert.match(demoLogin, /LoginPresentation/);
  assert.match(httpLogin, /LoginPresentation/);
  assert.match(demoLogin, /useAuthActions/);
  assert.match(httpLogin, /useHttpSession/);
  assert.doesNotMatch(presentation, /AuthContext|HttpSessionContext|src\/api|AsyncStorage/);
  assert.match(demoLogin, /quickActions=/);
  assert.doesNotMatch(httpLogin, /quickActions=/);
});

test('cabeçalho visual é compartilhado por adaptadores de composição', () => {
  const demoHeader = source('src/components/Header.tsx');
  const httpHeader = source('src/http/HttpAppHeader.tsx');
  const presentation = source('src/components/AppHeader.tsx');

  assert.match(demoHeader, /AppHeader/);
  assert.match(httpHeader, /AppHeader/);
  assert.match(demoHeader, /useNotificacao/);
  assert.match(httpHeader, /useHttpNotifications/);
  assert.doesNotMatch(presentation, /NotificacaoContext|HttpNotificationContext|AuthContext/);
});

test('Propriedades HTTP reutilizam componentes aprovados sem fabricar métricas', () => {
  const properties = source('src/http/screens/HttpPropertyScreens.tsx');

  for (const component of [
    'PropertyCardView',
    'SearchBar',
    'FilterBottomSheet',
    'SegmentedChips',
    'EmptyState',
    'SectionCard',
  ]) {
    assert.match(properties, new RegExp(component));
  }
  assert.match(properties, /runtime\.properties\.list/);
  assert.match(properties, /runtime\.properties\.getById/);
  assert.doesNotMatch(properties, /buildFazendaListMetrics|totalFazendas|areaTotal\}/);
  assert.doesNotMatch(properties, /src\/api|AsyncStorage/);
});

test('navegação HTTP mantém somente capacidades conectadas no padrão de abas', () => {
  const navigation = source('src/http/HttpNavigation.tsx');

  for (const route of ['Properties', 'Notifications', 'Account']) {
    assert.match(navigation, new RegExp(`name="${route}"`));
  }
  for (const forbidden of ['Visitas', 'Caderno', 'Materiais', 'Dashboard']) {
    assert.doesNotMatch(navigation, new RegExp(`name="${forbidden}"`));
  }
  assert.match(navigation, /headerShown: false/);
  assert.match(navigation, /resolveBottomTabSafeArea\(bottom\)/);
});

test('barras inferiores Demo e HTTP reservam a safe area física', () => {
  const demoNavigation = source('src/navigation/index.tsx');
  const httpNavigation = source('src/http/HttpNavigation.tsx');
  const layout = source('src/navigation/bottomTabSafeArea.ts');

  for (const navigation of [demoNavigation, httpNavigation]) {
    assert.match(navigation, /useSafeAreaInsets/);
    assert.match(navigation, /resolveBottomTabSafeArea/);
    assert.match(navigation, /safeAreaLayout\.paddingBottom/);
    assert.match(navigation, /safeAreaLayout\.height/);
  }
  assert.match(layout, /height: BASE_TAB_BAR_HEIGHT \+ safeBottomInset/);
  assert.match(layout, /paddingBottom: BASE_TAB_BAR_BOTTOM_PADDING \+ safeBottomInset/);
});

test('gradiente é dependência visual HTTP sem promover módulos funcionais do Demo', () => {
  const packageJson = require('../package.json');
  const excluded = packageJson.expo.autolinking.exclude;

  assert.equal(excluded.includes('expo-linear-gradient'), false);
  for (const forbidden of [
    '@react-native-async-storage/async-storage',
    'expo-image-picker',
    'expo-location',
    'react-native-maps',
    'react-native-webview',
  ]) {
    assert.ok(excluded.includes(forbidden));
  }
});

test('contrato ativo obriga integração visual por vertical antes da regressão final', () => {
  const contract = source('docs/project/contrato-convergencia-interface-http.md');

  assert.match(contract, /MP-35 conecta as telas administrativas/);
  assert.match(contract, /MP-36 conecta Caderno/);
  assert.match(contract, /MP-40 e MP-41 só validam/);
  assert.match(contract, /Visitas, Materiais e agregados do Dashboard/);
});
