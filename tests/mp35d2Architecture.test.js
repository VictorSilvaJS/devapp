const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function staticGraph(entry) {
  const pending = [entry];
  const visited = new Set();
  const pattern = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      const resolved = resolveLocal(file, match[1]);
      if (resolved !== null) pending.push(resolved);
    }
  }
  return visited;
}

function relativeFiles(graph) {
  return [...graph].map((file) => path.relative(root, file).replaceAll('\\', '/'));
}

function assertCleanConnectedGraph(graph) {
  const files = relativeFiles(graph);
  assert.equal(files.some((file) => file.startsWith('src/api/')), false);
  assert.equal(files.some((file) => /(?:^|\/)mock(?:\.|\/)/i.test(file)), false);
  assert.equal(files.some((file) => file.startsWith('demo/')), false);
  for (const file of graph) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /@react-native-async-storage\/async-storage|\bAsyncStorage\b/,
      `${path.relative(root, file)} alcança AsyncStorage`,
    );
  }
}

test('grafo HTTP integra a leitura administrativa sem Demo, mock, src/api ou AsyncStorage', () => {
  const graph = staticGraph(path.join(root, 'src/entry/http.tsx'));
  const files = relativeFiles(graph);
  for (const expected of [
    'src/http/administrativeUserAccess.ts',
    'src/http/administrativeUserRepository.ts',
    'src/http/administrativeUserDataBoundary.ts',
    'src/http/administrativeUserNavigationDefinition.ts',
    'src/http/administrativeUserListController.ts',
    'src/http/administrativeUserDetailController.ts',
    'src/http/screens/HttpAdministrativeUserScreens.tsx',
  ]) {
    assert.ok(files.includes(expected), `${expected} deve integrar o build HTTP`);
  }
  assertCleanConnectedGraph(graph);
});

test('novo subgrafo administrativo conectado não alcança fallback demonstrativo', () => {
  for (const entry of [
    'src/http/administrativeUserAccess.ts',
    'src/http/administrativeUserRepository.ts',
    'src/http/administrativeUserDataBoundary.ts',
    'src/http/administrativeUserNavigationDefinition.ts',
    'src/http/administrativeUserListController.ts',
    'src/http/administrativeUserDetailController.ts',
    'src/http/screens/HttpAdministrativeUserScreens.tsx',
  ]) {
    assertCleanConnectedGraph(staticGraph(path.join(root, entry)));
  }

  const repository = source('src/http/administrativeUserRepository.ts');
  const screen = source('src/http/screens/HttpAdministrativeUserScreens.tsx');
  assert.doesNotMatch(repository, /from ['"].*(?:mock|src\/api|\.\.\/api)/i);
  assert.doesNotMatch(screen, /from ['"].*(?:mock|src\/api|\.\.\/api)/i);
  assert.match(
    source('src/http/administrativeUserListController.ts'),
    /Nenhum dado demonstrativo foi carregado/,
  );
});

test('aba e detalhe só são registrados para Admin e as duas superfícies guardam acesso', () => {
  const navigation = source('src/http/HttpNavigation.tsx');
  const definition = source('src/http/administrativeUserNavigationDefinition.ts');
  const screen = source('src/http/screens/HttpAdministrativeUserScreens.tsx');
  const repository = source('src/http/administrativeUserRepository.ts');
  const access = source('src/http/administrativeUserAccess.ts');

  assert.match(navigation, /buildAdministrativeUserNavigationDefinition\(\s*snapshot,/);
  assert.match(
    navigation,
    /\{administrativeUsers\.tab \? \(\s*<Tabs\.Screen[\s\S]*?name=\{administrativeUsers\.tab\.name\}[\s\S]*?component=\{administrativeUsers\.tab\.surface\}/,
  );
  assert.match(
    navigation,
    /\{administrativeUsers\.detail \? \(\s*<Stack\.Screen[\s\S]*?name=\{administrativeUsers\.detail\.name\}[\s\S]*?component=\{administrativeUsers\.detail\.surface\}/,
  );
  assert.match(definition, /snapshot\?\.usuario\.perfil !== 'admin'/);
  assert.match(definition, /return Object\.freeze\(\{ tab: null, detail: null \}\)/);
  assert.match(definition, /throw new AdministrativeUserAccessDeniedError\(\)/);
  assert.match(
    screen,
    /if \(!administrativeUserNavigationCapabilities\(snapshot\)\.usersTab\)/,
  );
  assert.match(
    screen,
    /if \(!administrativeUserNavigationCapabilities\(snapshot\)\.userDetail\)/,
  );
  assert.ok(
    screen.indexOf('if (!administrativeUserNavigationCapabilities(snapshot).usersTab)') <
      screen.indexOf('function HttpAdministrativeUsersAdminSurface'),
  );
  assert.ok(
    screen.indexOf('if (!administrativeUserNavigationCapabilities(snapshot).userDetail)') <
      screen.indexOf('function HttpAdministrativeUserDetailAdminSurface'),
  );
  assert.match(access, /snapshot\?\.usuario\.perfil === 'admin'/);
  assert.match(repository, /context\.snapshot\.usuario\.perfil !== 'admin'/);
  assert.match(repository, /this\.#session\.epoch !== context\.epoch/);
  assert.match(repository, /this\.#boundary\.isLeaseCurrent/);
  assert.match(repository, /throw new AdministrativeUserAccessDeniedError\(\)/);
});

test('vertical D-2 materializa somente GET de lista e detalhe', () => {
  const api = source('src/http/backendApi.ts');
  const start = api.indexOf('  async listAdministrativeUsers(');
  const end = api.indexOf('\n  async listNotifications(', start);
  const vertical = api.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(vertical, /method: 'GET'/);
  assert.match(vertical, /path: `\/v1\/usuarios\$\{/);
  assert.match(vertical, /path: `\/v1\/usuarios\/\$\{encodeURIComponent\(userId\)\}`/);
  assert.doesNotMatch(vertical, /method: '(?:POST|PATCH|DELETE)'/);
  assert.doesNotMatch(vertical, /Idempotency|idempotency|body:/);

  const repository = source('src/http/administrativeUserRepository.ts');
  assert.match(repository, /listAdministrativeUsers/);
  assert.match(repository, /getAdministrativeUser/);
  assert.doesNotMatch(
    repository,
    /create|update|changeStatus|invite|convite|vinculo|localidade/i,
  );
});

test('lista envia busca e filtros ao controlador e pagina somente por ação explícita', () => {
  const screen = source('src/http/screens/HttpAdministrativeUserScreens.tsx');
  assert.match(screen, /onSubmitEditing=\{applySearch\}/);
  assert.match(screen, /perfil: profileDraft === 'todos'/);
  assert.match(screen, /status: statusDraft === 'todos'/);
  assert.match(screen, /title="Carregar mais"/);
  assert.doesNotMatch(screen, /onEndReached/);
  assert.match(screen, /refreshing=\{current\.refreshing\}/);
  assert.match(screen, /onRefresh=/);
  assert.match(screen, /Tentar carregar novamente/);
  assert.match(screen, /Atualizar lista/);
  assert.match(screen, /controller\.ensureInitialLoad\(\)/);
  assert.doesNotMatch(screen, /if \(enabled && changed\)/);
});

test('interface cobre carregamento, vazios e erros sem revelar dados proibidos', () => {
  const screen = source('src/http/screens/HttpAdministrativeUserScreens.tsx');
  const controller = source('src/http/administrativeUserListController.ts');
  for (const expected of [
    'Carregando Usuários',
    'Carregando Usuário',
    'Tentar novamente',
    'Nenhum Usuário cadastrado',
    'Nenhum resultado',
    'Sessão expirada',
    'Acesso restrito',
    'Usuário não encontrado',
  ]) {
    assert.ok(screen.includes(expected) || controller.includes(expected), expected);
  }
  assert.match(controller, /Nenhum dado demonstrativo foi carregado/);
  assert.doesNotMatch(
    screen,
    /user\.(?:senha|password|token|desafio|outbox|fazenda_id|credencial|hash)/i,
  );
  assert.match(screen, /user\.perfil === 'produtor' && user\.produtor_id/);
  assert.match(
    source('src/http/administrativeUserDetailController.ts'),
    /this\.#repository\.getById\(userId, lease\)/,
  );
  assert.doesNotMatch(screen, /route\.params.*(?:nome|email|documento)/i);
});

test('build focalizado compila a navegação e a tela TSX reais', () => {
  for (const output of [
    '.tmp-mp35d2-navigation/src/http/HttpNavigation.js',
    '.tmp-mp35d2-navigation/src/http/screens/HttpAdministrativeUserScreens.js',
  ]) {
    assert.equal(fs.existsSync(path.join(root, output)), true, output);
  }
  assert.match(
    source('package.json'),
    /node tests\/mp35d2RenderedNavigation\.test\.js/,
  );
  const renderedTest = source('tests/mp35d2RenderedNavigation.test.js');
  assert.match(renderedTest, /require\('react-test-renderer'\)/);
  assert.match(renderedTest, /require\('\.\.\/\.tmp-mp35d2-navigation\/src\/http\/HttpNavigation'\)/);
  assert.match(renderedTest, /React\.StrictMode/);
  for (const navigationPackage of [
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    '@react-navigation/native-stack',
  ]) {
    assert.doesNotMatch(
      renderedTest,
      new RegExp(`request === ['"]${navigationPackage.replace('/', '\\/')}['"]`),
      `${navigationPackage} não pode ser substituído na prova principal`,
    );
  }
  assert.match(renderedTest, /httpNavigationRef\.getRootState\(\)/);
  assert.match(renderedTest, /httpNavigationRef\.getCurrentRoute\(\)/);
  assert.match(renderedTest, /httpNavigationRef\.navigate\(/);
  assert.match(renderedTest, /activeSubscriptionCount/);

  const packageJson = JSON.parse(source('package.json'));
  assert.equal(packageJson.dependencies?.['react-test-renderer'], undefined);
  assert.equal(packageJson.devDependencies['react-test-renderer'], '19.2.3');
  assert.equal(
    packageJson.devDependencies['react-test-renderer'],
    packageJson.dependencies.react,
  );
});

test('runtime compartilha uma única fronteira administrativa entre sessão, repositório e telas', () => {
  const runtime = source('src/http/runtime.ts');
  assert.equal(
    [...runtime.matchAll(/new AdministrativeUserDataBoundary\(/g)].length,
    1,
  );
  assert.match(runtime, /administrativeUserData\.synchronizePartition/);
  assert.match(
    runtime,
    /administrativeUsers: new HttpAdministrativeUserRepository\([\s\S]*?administrativeUserData,/,
  );
  assert.match(runtime, /new AdministrativeUserListController\(repository, boundary\)/);
  assert.match(runtime, /new AdministrativeUserDetailController\(repository, boundary\)/);
  assert.match(runtime, /administrativeUserControllerFactory\?:/);
  const screens = source('src/http/screens/HttpAdministrativeUserScreens.tsx');
  assert.match(screens, /runtime\.administrativeUserData/);
  assert.match(screens, /runtime\.administrativeUserControllers/);
  assert.doesNotMatch(screens, /new AdministrativeUser(?:List|Detail)Controller/);
});

test('decoders fecham envelopes e projetam lista sem campos exclusivos do detalhe', () => {
  const decoders = source('src/http/decoders.ts');
  const contracts = source('src/http/contracts.ts');
  assert.match(decoders, /exactKeys\(input, ADMINISTRATIVE_USER_REQUIRED_KEYS\)/);
  assert.match(decoders, /ADMINISTRATIVE_USER_REQUIRED_KEYS/);
  assert.match(decoders, /decodeAdministrativeUserProfile/);
  assert.match(decoders, /decodeAdministrativeUserStatus/);
  assert.match(decoders, /decodePositiveVersion/);
  assert.match(decoders, /decodeOpaqueCursor\(pagination\.proximo_cursor\)/);
  assert.match(decoders, /input\.itens\.length > maximumItems/);
  assert.match(decoders, /items\.length === 0 && nextCursor !== null/);
  assert.match(contracts, /readonly produtor_id\?: string/);
  assert.match(contracts, /readonly itens: readonly AdministrativeUserListItem\[\]/);
});
