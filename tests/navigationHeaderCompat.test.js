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

const getHeaderTags = (source) => source.match(/<Header\b[\s\S]*?\/>/g) || [];

const internalHeaderScreens = [
  'ProdutorScreen',
  'MapasScreen',
  'NovaPropriedadeScreen',
  'EditarPropriedadeScreen',
  'UsuarioDetailScreen',
  'NovoUsuarioScreen',
  'NovaVisitaScreen',
  'VisitaDetailScreen',
  'EditarVisitaScreen',
  'CadernoDetailScreen',
  'NovoCadernoScreen',
  'EditarCadernoScreen',
  'PeriodoProdutivoFormScreen',
  'NotificacoesScreen',
  'EditProfileScreen',
];

const rootHeaderScreens = [
  'DashboardScreen',
  'PropriedadesScreen',
  'UsuariosScreen',
  'VisitasScreen',
  'CadernoCampoScreen',
  'ClienteDashboardScreen',
];

test('Header oferece um único contrato de retorno acessível', () => {
  const source = readSource('src/components/Header.tsx');

  assert.doesNotMatch(source, /showBackButton/);
  assert.match(source, /showBack\?: boolean/);
  assert.match(source, /onBack \? onBack\(\) : navigation\.goBack\(\)/);
  assert.match(source, /accessibilityRole="button"/);
  assert.match(source, /accessibilityLabel="Voltar"/);
});

test('telas internas com Header exibem seta em todos os estados', () => {
  internalHeaderScreens.forEach((screen) => {
    const tags = getHeaderTags(readSource(`src/screens/${screen}.tsx`));
    assert.ok(tags.length > 0, `${screen} deve renderizar Header`);
    tags.forEach((tag) => {
      assert.match(tag, /\bshowBack\b/, `${screen} possui Header sem showBack: ${tag}`);
    });
  });
});

test('telas raiz das abas preservam a marca sem seta de retorno', () => {
  rootHeaderScreens.forEach((screen) => {
    const tags = getHeaderTags(readSource(`src/screens/${screen}.tsx`));
    assert.ok(tags.length > 0, `${screen} deve renderizar Header`);
    tags.forEach((tag) => {
      assert.doesNotMatch(tag, /\bshowBack\b/, `${screen} não deve exibir retorno: ${tag}`);
    });
  });
});

test('mapa de limites mantém retorno próprio em todos os estados', () => {
  const source = readSource('src/screens/FazendaMapaScreen.tsx');
  const backCalls = source.match(/navigation\.goBack\(\)/g) || [];

  assert.ok(backCalls.length >= 5);
  assert.match(source, /style=\{styles\.btnVoltar\}/);
  assert.match(source, /style=\{styles\.voltarLoading\}/);
  assert.match(source, /name="arrow-back"/);
});

test('todas as rotas internas permanecem no native stack', () => {
  const source = readSource('src/navigation/index.tsx');
  const routeNames = [
    'ProdutorDetail',
    'Mapas',
    'NovaPropriedade',
    'EditarPropriedade',
    'UsuarioDetail',
    'NovoUsuario',
    'EditarUsuario',
    'NovaVisita',
    'VisitaDetail',
    'EditarVisita',
    'CadernoDetail',
    'NovoCaderno',
    'EditarCaderno',
    'NovoPeriodoProdutivo',
    'EditarPeriodoProdutivo',
    'Notificacoes',
    'EditProfile',
    'FazendaMapa',
  ];

  assert.match(source, /createNativeStackNavigator\(\)/);
  routeNames.forEach((routeName) => {
    assert.match(source, new RegExp(`<Stack\\.Screen name="${routeName}"`));
  });
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de navigationHeaderCompat passaram.');
}
