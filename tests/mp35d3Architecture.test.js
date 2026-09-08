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
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
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

test('grafo real integra comandos sem Demo, mock, src/api ou persistência de rascunho', () => {
  const graph = staticGraph(path.join(root, 'src/entry/http.tsx'));
  const files = [...graph].map((file) => path.relative(root, file).replaceAll('\\', '/'));
  for (const expected of [
    'src/http/administrativeUserCommands.ts',
    'src/http/administrativeUserCommandLifecycle.ts',
    'src/http/administrativeUserCommandNavigationDefinition.ts',
    'src/http/screens/HttpAdministrativeUserCommandScreens.tsx',
  ]) {
    assert.ok(files.includes(expected), `${expected} deve integrar o build HTTP`);
  }
  assert.equal(files.some((file) => file.startsWith('src/api/')), false);
  assert.equal(files.some((file) => /(?:^|\/)mock(?:\.|\/)/i.test(file)), false);
  assert.equal(files.some((file) => file.startsWith('demo/')), false);
  for (const file of graph) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /@react-native-async-storage\/async-storage|\bAsyncStorage\b/);
  }
});

test('quatro rotas e superfícies são condicionais ao Admin e guardadas antes do formulário', () => {
  const navigation = source('src/http/HttpNavigation.tsx');
  const definition = source('src/http/administrativeUserCommandNavigationDefinition.ts');
  const screens = source('src/http/screens/HttpAdministrativeUserCommandScreens.tsx');
  for (const name of [
    'AdministrativeUserCreate',
    'AdministrativeUserEdit',
    'AdministrativeUserStatus',
    'AdministrativeUserInvitation',
  ]) {
    assert.match(navigation, new RegExp(`name=\\{administrativeUserCommands\\.${name.replace('AdministrativeUser', '').toLowerCase()}\\.name\\}`));
    assert.ok(definition.includes(`name: '${name}'`));
  }
  assert.match(definition, /snapshot\?\.usuario\.perfil !== 'admin'/);
  assert.match(definition, /create: null,[\s\S]*edit: null,[\s\S]*status: null,[\s\S]*invitation: null/);
  assert.equal([...screens.matchAll(/administrativeUserNavigationCapabilities\(snapshot\)\.userDetail/g)].length, 4);
  assert.match(source('src/http/administrativeUserCommands.ts'), /assertAdministrativeUserNavigationAccess\(this\.#session\.snapshot\)/);
});

test('formulários mantêm o corte D3 sem Admin, senha, exclusão, vínculos ou token de convite', () => {
  const screens = source('src/http/screens/HttpAdministrativeUserCommandScreens.tsx');
  const createStart = screens.indexOf('function HttpAdministrativeUserCreateAdminSurface');
  const editStart = screens.indexOf('function HttpAdministrativeUserEditAdminSurface');
  const createSurface = screens.slice(createStart, editStart);
  assert.match(createSurface, /value: 'produtor'/);
  assert.match(createSurface, /value: 'colaborador'/);
  assert.doesNotMatch(createSurface, /value: 'admin'|Senha|password|propriedade_id|fazenda_id|produtor_id|v[ií]nculo/i);
  assert.match(screens, /Perfil e status não pertencem a este formulário/);
  assert.match(screens, /ConfirmDialog/);
  assert.match(screens, /ativar_usuario/);
  assert.doesNotMatch(screens, /token(?:_ativacao|_convite)?/i);
  assert.doesNotMatch(screens, /Excluir Usuário|DELETE|remover usu[aá]rio/i);
});

test('serviço reaproveita D1 e D2, relê após recibo e não restaura sessão manualmente', () => {
  const commands = source('src/http/administrativeUserCommands.ts');
  const runtime = source('src/http/runtime.ts');
  assert.match(commands, /this\.#coordinator\.execute/);
  assert.match(commands, /command\.idempotencyKey/);
  assert.match(commands, /command\.body/);
  assert.match(commands, /this\.#api\.getAdministrativeUser/);
  assert.match(commands, /this\.#boundary\.publishAuthoritativeUser/);
  assert.match(commands, /publishUserNotFound/);
  assert.doesNotMatch(commands, /login\(|restore\(|write\(|AsyncStorage|setItem/);
  assert.equal([...runtime.matchAll(/new AdministrativeUserDataBoundary\(/g)].length, 1);
  assert.match(runtime, /new AdministrativeUserCommandService\([\s\S]*?administrativeUserData/);
});

test('API usa apenas os endpoints administrativos atuais e decoders específicos', () => {
  const api = source('src/http/backendApi.ts');
  const start = api.indexOf('  async createAdministrativeUser(');
  const vertical = api.slice(start);
  for (const expected of [
    "path: '/v1/usuarios'",
    'path: `/v1/usuarios/${encodeURIComponent(userId)}`',
    'path: `/v1/usuarios/${encodeURIComponent(userId)}/status`',
    'path: `/v1/usuarios/${encodeURIComponent(userId)}/convites`',
    'decodeAdministrativeUserCreatedReceipt',
    'decodeAdministrativeUserUpdatedReceipt',
    'decodeAdministrativeUserStatusChangedReceipt',
    'decodeAdministrativeUserInvitationCommandReceipt',
  ]) {
    assert.ok(vertical.includes(expected), expected);
  }
  assert.doesNotMatch(vertical, /\/v1\/auth\/(?:convite|ativacao)|password|senha|DELETE/);
  assert.doesNotMatch(source('src/http/decoders.ts'), /as AdministrativeUser(?:Created|Updated|StatusChanged|Invitation(?:Issued|Command))Receipt/);
});

test('lifecycle só conecta em start, exige lease e telas consomem apenas o líder', () => {
  const lifecycle = source('src/http/administrativeUserCommandLifecycle.ts');
  const screens = source('src/http/screens/HttpAdministrativeUserCommandScreens.tsx');
  const commands = source('src/http/administrativeUserCommands.ts');
  const constructorBody = lifecycle.slice(
    lifecycle.indexOf('  constructor('),
    lifecycle.indexOf('  get snapshot'),
  );
  assert.doesNotMatch(constructorBody, /\.subscribe\(|issueLease\(|createIntent\(/);
  assert.match(lifecycle, /start\(\): boolean/);
  assert.match(lifecycle, /revokeLease/);
  assert.match(screens, /React\.useEffect\(\(\) => \{\s*lifecycle\.start\(\)/);
  assert.equal([...screens.matchAll(/!outcome\.current \|\| !outcome\.leader/g)].length >= 8, true);
  assert.equal([...commands.matchAll(/assertOperationCurrent\(input\.context\)/g)].length >= 5, true);
  assert.match(commands, /mutation_confirmed_and_reconciled/);
  assert.match(commands, /mutation_confirmed_reconciliation_failed/);
});
