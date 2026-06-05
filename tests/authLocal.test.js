const assert = require('node:assert/strict');
const { User, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');
const { authLoginByProfile } = require('../.tmp-domain-compat/src/auth/authMock');
const {
  AUTH_INVALID_CREDENTIALS_MESSAGE,
  AUTH_LOCAL_USER_NOT_FOUND_MESSAGE,
  authenticateWithEmailAndPassword,
} = require('../.tmp-domain-compat/src/auth/authLocal');
const {
  AUTH_STORAGE_KEY,
  clearAuthSessionUser,
  persistAuthSessionUser,
  restoreAuthSessionUser,
} = require('../.tmp-domain-compat/src/auth/authSession');
const {
  createLocalCredentialService,
} = require('../.tmp-domain-compat/src/auth/localCredentials');

let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const createMemoryStorage = () => {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    },
  };
};

const createTestHasher = () => ({
  counter: 0,
  async generateSalt() {
    this.counter += 1;
    return `salt-${this.counter}`;
  },
  async hashPassword({ senha, salt }) {
    return `hash::${salt}::len-${senha.length}`;
  },
});

const createCredentialService = () => {
  const storage = createMemoryStorage();
  const service = createLocalCredentialService({
    storage: storage.adapter,
    hasher: createTestHasher(),
    now: () => '2026-06-05T12:00:00.000Z',
  });

  return { service, storage };
};

const setupMock = async () => {
  const mockStorage = createMemoryStorage();
  MockLocalData.__setStorageForTests(mockStorage.adapter);
  await MockLocalData.restoreSeed();
  return mockStorage;
};

const createAdminUser = async (email = 'login.admin.local@example.com') =>
  User.create({
    nome: 'Admin Login Local',
    email,
    senha: 'mock123',
    perfil: 'admin',
    status: 'ativo',
    nivel_administrativo: 'suporte',
    regioes_acesso: ['Brasil'],
    acesso_global: true,
  });

const createColaboradorUser = async (email = 'login.colab.local@example.com') =>
  User.create({
    nome: 'Colaborador Login Local',
    email,
    senha: 'mock123',
    perfil: 'colaborador',
    status: 'ativo',
    regiao: 'Mato Grosso',
    sub_regioes: ['Sorriso'],
    vinculos_microregioes: [{ regiao: 'Mato Grosso', microregiao: 'Sorriso' }],
  });

const createProdutorUser = async (email = 'login.produtor.local@example.com') =>
  User.create({
    nome: 'Produtor Login Local',
    email,
    senha: 'mock123',
    perfil: 'produtor',
    status: 'ativo',
    produtor_id: 'prop_sela1',
    vinculos_propriedades: [
      {
        propriedade_id: 'p_sela1',
        tipo_vinculo: 'titular',
        principal: true,
      },
    ],
  });

const loginLocal = (email, senha, service) =>
  authenticateWithEmailAndPassword(email, senha, { credentialService: service });

const assertNoSensitiveFields = (usuario) => {
  assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'senha'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'senha_hash'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'salt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'credential'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'token'), false);
};

const run = async () => {
  await test('login com usuario local ativo e senha correta', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createAdminUser();
    await service.createCredential(usuario.id, usuario.email, 'SenhaLocal123');

    const authenticated = await loginLocal(usuario.email, 'SenhaLocal123', service);

    assert.equal(authenticated.id, usuario.id);
    assert.equal(authenticated.perfil, 'admin');
    assert.equal(authenticated.status, 'ativo');
    assertNoSensitiveFields(authenticated);
  });

  await test('login local com senha incorreta nao autentica', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createAdminUser('login.senha.errada@example.com');
    await service.createCredential(usuario.id, usuario.email, 'SenhaLocal123');

    await assert.rejects(
      () => loginLocal(usuario.email, 'SenhaErrada', service),
      new RegExp(AUTH_INVALID_CREDENTIALS_MESSAGE)
    );
  });

  await test('login local ignora caixa e espacos externos no e-mail', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createAdminUser('login.case.local@example.com');
    await service.createCredential(usuario.id, usuario.email, 'SenhaLocal123');

    const authenticated = await loginLocal('  LOGIN.CASE.LOCAL@example.com  ', 'SenhaLocal123', service);

    assert.equal(authenticated.id, usuario.id);
  });

  await test('usuario local admin preserva escopo administrativo', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createAdminUser('login.admin.perfil@example.com');
    await service.createCredential(usuario.id, usuario.email, 'SenhaAdmin123');

    const authenticated = await loginLocal(usuario.email, 'SenhaAdmin123', service);

    assert.equal(authenticated.perfil, 'admin');
    assert.deepEqual(authenticated.regioes_acesso, ['Brasil']);
    assert.equal(authenticated.acesso_global, true);
  });

  await test('usuario local colaborador preserva regiao e vinculos territoriais', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createColaboradorUser();
    await service.createCredential(usuario.id, usuario.email, 'SenhaColab123');

    const authenticated = await loginLocal(usuario.email, 'SenhaColab123', service);

    assert.equal(authenticated.perfil, 'colaborador');
    assert.equal(authenticated.regiao, 'Mato Grosso');
    assert.deepEqual(authenticated.sub_regioes, ['Sorriso']);
    assert.deepEqual(authenticated.vinculos_microregioes, [
      { usuario_id: usuario.id, regiao: 'Mato Grosso', microregiao: 'Sorriso' },
    ]);
  });

  await test('usuario local produtor preserva produtor_id e vinculos com Propriedades', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createProdutorUser();
    await service.createCredential(usuario.id, usuario.email, 'SenhaProd123');

    const authenticated = await loginLocal(usuario.email, 'SenhaProd123', service);

    assert.equal(authenticated.perfil, 'produtor');
    assert.equal(authenticated.produtor_id, 'prop_sela1');
    assert.deepEqual(authenticated.vinculos_propriedades, [
      {
        usuario_id: usuario.id,
        propriedade_id: 'p_sela1',
        tipo_vinculo: 'titular',
        principal: true,
      },
    ]);
  });

  await test('credencial existe mas usuario nao existe retorna erro controlado', async () => {
    await setupMock();
    const { service } = createCredentialService();
    await service.createCredential('usuario_inexistente', 'orfa@example.com', 'SenhaOrfa123');

    await assert.rejects(
      () => loginLocal('orfa@example.com', 'SenhaOrfa123', service),
      new RegExp(AUTH_LOCAL_USER_NOT_FOUND_MESSAGE)
    );
    assert.equal(await service.hasCredential('usuario_inexistente'), true);
  });

  await test('usuario existe mas credencial nao existe nao autentica com mock123', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createAdminUser('sem.credencial.local@example.com');

    await assert.rejects(
      () => loginLocal(usuario.email, 'mock123', service),
      new RegExp(AUTH_INVALID_CREDENTIALS_MESSAGE)
    );
  });

  await test('fallback demonstrativo autentica quando nao ha credencial local', async () => {
    await setupMock();
    const { service } = createCredentialService();

    const authenticated = await loginLocal('admin.demonstracao@example.com', 'admin123', service);

    assert.equal(authenticated.id, 'u1');
    assert.equal(authenticated.perfil, 'admin');
    assertNoSensitiveFields(authenticated);
  });

  await test('acesso rapido demonstrativo continua preservado', async () => {
    const authenticated = await authLoginByProfile('produtor');

    assert.equal(authenticated.id, 'u_sela1');
    assert.equal(authenticated.perfil, 'produtor');
    assertNoSensitiveFields(authenticated);
  });

  await test('credencial local tem prioridade sobre demonstrativa', async () => {
    await setupMock();
    const { service } = createCredentialService();
    await service.createCredential('u1', 'admin.demonstracao@example.com', 'SenhaLocalDemo123');

    const authenticated = await loginLocal('admin.demonstracao@example.com', 'SenhaLocalDemo123', service);

    assert.equal(authenticated.id, 'u1');
    assert.equal(authenticated.email, 'admin.demonstracao@example.com');
  });

  await test('senha errada em credencial local nao cai para fallback demonstrativo', async () => {
    await setupMock();
    const { service } = createCredentialService();
    await service.createCredential('u1', 'admin.demonstracao@example.com', 'SenhaLocalDemo123');

    await assert.rejects(
      () => loginLocal('admin.demonstracao@example.com', 'admin123', service),
      new RegExp(AUTH_INVALID_CREDENTIALS_MESSAGE)
    );
  });

  await test('sessao nao contem senha hash salt credencial ou token', async () => {
    const sessionStorage = createMemoryStorage();
    await persistAuthSessionUser(sessionStorage.adapter, {
      id: 'u_session',
      nome: 'Sessao Segura',
      email: 'sessao@example.com',
      perfil: 'admin',
      senha: 'texto',
      senha_hash: 'hash',
      salt: 'salt',
      credential: { secret: true },
      token: 'token',
    });

    const raw = sessionStorage.values.get(AUTH_STORAGE_KEY);
    assert.equal(raw.includes('texto'), false);
    assert.equal(raw.includes('senha_hash'), false);
    assert.equal(raw.includes('salt'), false);
    assert.equal(raw.includes('credential'), false);
    assert.equal(raw.includes('token'), false);

    const restored = await restoreAuthSessionUser(sessionStorage.adapter);
    assert.equal(restored.id, 'u_session');
    assertNoSensitiveFields(restored);
  });

  await test('logout continua removendo sessao local', async () => {
    const sessionStorage = createMemoryStorage();
    await persistAuthSessionUser(sessionStorage.adapter, {
      id: 'u_logout',
      nome: 'Logout Local',
      perfil: 'admin',
    });
    assert.ok(sessionStorage.values.has(AUTH_STORAGE_KEY));

    await clearAuthSessionUser(sessionStorage.adapter);

    assert.equal(sessionStorage.values.has(AUTH_STORAGE_KEY), false);
  });

  await test('reinicio restaura usuario autenticado normalizado', async () => {
    const sessionStorage = createMemoryStorage();
    await persistAuthSessionUser(sessionStorage.adapter, {
      id: 'u_restart',
      full_name: 'Usuario Restaurado',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['RS - Norte'],
    });

    const restored = await restoreAuthSessionUser(sessionStorage.adapter);

    assert.equal(restored.id, 'u_restart');
    assert.equal(restored.nome, 'Usuario Restaurado');
    assert.equal(restored.perfil, 'colaborador');
    assert.deepEqual(restored.sub_regioes, ['RS - Norte']);
  });

  await test('mock123 nao autentica usuario administrativo sem credencial', async () => {
    await setupMock();
    const { service } = createCredentialService();
    const usuario = await createColaboradorUser('mock123.nao.autentica@example.com');

    await assert.rejects(
      () => loginLocal(usuario.email, 'mock123', service),
      new RegExp(AUTH_INVALID_CREDENTIALS_MESSAGE)
    );
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de authLocal passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
