const assert = require('node:assert/strict');
const {
  MOCK_LOCAL_STORAGE_KEY,
} = require('../.tmp-domain-compat/src/api/mockLocalPersistence');
const { User, Produtor, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');
const {
  LOCAL_CREDENTIAL_STORAGE_KEY,
  createLocalCredentialService,
} = require('../.tmp-domain-compat/src/auth/localCredentials');
const {
  createUsuarioAdminWithLocalCredential,
  deleteUsuarioAdminAndLocalCredential,
  updateUsuarioAdminAndSyncLocalCredential,
  validateSenhaLocalAdmin,
} = require('../.tmp-domain-compat/src/utils/usuarioLocalAccessAdmin');
const { buildUsuarioAdminPayload } = require('../.tmp-domain-compat/src/utils/usuarioAdminCompat');

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

const createService = () => {
  const storage = createMemoryStorage();
  let nowIndex = 0;
  const timestamps = [
    '2026-06-05T11:00:00.000Z',
    '2026-06-05T11:01:00.000Z',
    '2026-06-05T11:02:00.000Z',
    '2026-06-05T11:03:00.000Z',
    '2026-06-05T11:04:00.000Z',
    '2026-06-05T11:05:00.000Z',
  ];
  const service = createLocalCredentialService({
    storage: storage.adapter,
    hasher: createTestHasher(),
    now: () => timestamps[Math.min(nowIndex++, timestamps.length - 1)],
  });
  return { service, storage };
};

const setupMock = async () => {
  const mockStorage = createMemoryStorage();
  MockLocalData.__setStorageForTests(mockStorage.adapter);
  await MockLocalData.restoreSeed();
  return mockStorage;
};

const adminPayload = (overrides = {}, propriedades = []) =>
  buildUsuarioAdminPayload({
    form: {
      nome: 'Usuário Local Teste',
      email: `usuario.local.${Date.now()}@example.com`,
      telefone: '',
      documento: '',
      perfil: 'admin',
      status: 'ativo',
      observacoes: '',
      nivelAdministrativo: 'suporte',
      ...overrides,
    },
    propriedades,
  });

const run = async () => {
  await test('valida senha inicial obrigatoria e confirmacao', () => {
    assert.equal(validateSenhaLocalAdmin({
      senha: 'Senha123',
      confirmarSenha: 'Senha123',
      obrigatoria: true,
    }).valid, true);

    const mismatch = validateSenhaLocalAdmin({
      senha: 'Senha123',
      confirmarSenha: 'Outra123',
      obrigatoria: true,
    });
    assert.equal(mismatch.valid, false);
    assert.match(mismatch.errors.confirmarSenha, /igual/);

    const short = validateSenhaLocalAdmin({
      senha: '12345',
      confirmarSenha: '12345',
      obrigatoria: true,
    });
    assert.equal(short.valid, false);
    assert.match(short.errors.senha, /pelo menos 6/);

    const spaces = validateSenhaLocalAdmin({
      senha: '      ',
      confirmarSenha: '      ',
      obrigatoria: true,
    });
    assert.equal(spaces.valid, false);
    assert.match(spaces.errors.senha, /somente espaços/);

    assert.equal(validateSenhaLocalAdmin({ senha: '', confirmarSenha: '', obrigatoria: false }).valid, true);
  });

  await test('cria usuario com senha valida e credencial usa o ID retornado', async () => {
    const mockStorage = await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'cred.criacao@example.com' });

    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaInicial123',
    });

    assert.ok(saved.id);
    assert.equal(await service.hasCredential(saved.id), true);
    assert.deepEqual(await service.verifyCredential('cred.criacao@example.com', 'SenhaInicial123'), {
      ok: true,
      usuario_id: saved.id,
    });

    const usuario = await User.get(saved.id);
    assert.equal(JSON.stringify(usuario).includes('SenhaInicial123'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'senha_hash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(usuario, 'salt'), false);

    const rawMock = mockStorage.values.get(MOCK_LOCAL_STORAGE_KEY);
    assert.equal(rawMock.includes('SenhaInicial123'), false);

    const usuarios = await User.list();
    const listed = usuarios.find((item) => item.id === saved.id);
    assert.ok(listed);
    assert.equal(JSON.stringify(listed).includes('SenhaInicial123'), false);
  });

  await test('cria usuarios ativos por perfil com senha inicial', async () => {
    await setupMock();
    const { service } = createService();
    const propriedades = await Produtor.list();
    const propriedade = propriedades[0];

    const admin = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload: adminPayload({ email: 'admin.ativo.cred@example.com', perfil: 'admin', status: 'ativo' }, propriedades),
      email: 'admin.ativo.cred@example.com',
      senha: 'SenhaAdmin123',
    });

    const colaboradorPayload = adminPayload({
      email: 'colaborador.ativo.cred@example.com',
      perfil: 'colaborador',
      status: 'ativo',
      vinculosPropriedades: [{
        propriedade_id: propriedade.id,
        tipo_vinculo: 'colaborador',
        status: 'ativo',
        principal: true,
      }],
    }, propriedades);
    const colaborador = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload: colaboradorPayload,
      email: colaboradorPayload.email,
      senha: 'SenhaColab123',
    });

    const produtorPayload = adminPayload({
      email: 'produtor.ativo.cred@example.com',
      perfil: 'produtor',
      status: 'ativo',
      vinculosPropriedades: [{
        propriedade_id: propriedade.id,
        tipo_vinculo: 'titular',
        principal: true,
      }],
    }, propriedades);
    const produtor = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload: produtorPayload,
      email: produtorPayload.email,
      senha: 'SenhaProdutor123',
    });

    assert.equal((await User.get(admin.id)).perfil, 'admin');
    assert.equal((await User.get(colaborador.id)).perfil, 'colaborador');
    assert.equal((await User.get(produtor.id)).perfil, 'produtor');
    assert.deepEqual(await service.verifyCredential('admin.ativo.cred@example.com', 'SenhaAdmin123'), {
      ok: true,
      usuario_id: admin.id,
    });
    assert.deepEqual(await service.verifyCredential('colaborador.ativo.cred@example.com', 'SenhaColab123'), {
      ok: true,
      usuario_id: colaborador.id,
    });
    assert.deepEqual(await service.verifyCredential('produtor.ativo.cred@example.com', 'SenhaProdutor123'), {
      ok: true,
      usuario_id: produtor.id,
    });
  });

  await test('cria usuarios pendente e inativo com senha inicial', async () => {
    await setupMock();
    const { service } = createService();
    const pendentePayload = adminPayload({
      email: 'usuario.pendente.cred@example.com',
      status: 'pendente',
    });
    const inativoPayload = adminPayload({
      email: 'usuario.inativo.cred@example.com',
      status: 'inativo',
    });

    const pendente = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload: pendentePayload,
      email: pendentePayload.email,
      senha: 'SenhaPendente123',
    });
    const inativo = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload: inativoPayload,
      email: inativoPayload.email,
      senha: 'SenhaInativo123',
    });

    assert.equal((await User.get(pendente.id)).status, 'pendente');
    assert.equal((await User.get(inativo.id)).status, 'inativo');
    assert.deepEqual(await service.verifyCredential('usuario.pendente.cred@example.com', 'SenhaPendente123'), {
      ok: true,
      usuario_id: pendente.id,
    });
    assert.deepEqual(await service.verifyCredential('usuario.inativo.cred@example.com', 'SenhaInativo123'), {
      ok: true,
      usuario_id: inativo.id,
    });
  });

  await test('edicao sem senha preserva credencial existente', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'preserva.cred@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaAntiga123',
    });

    const updatedPayload = adminPayload({
      nome: 'Usuário Local Editado',
      email: 'preserva.cred@example.com',
    });
    await updateUsuarioAdminAndSyncLocalCredential({
      userApi: User,
      credentialService: service,
      usuarioId: saved.id,
      payload: updatedPayload,
      email: updatedPayload.email,
      novaSenha: '',
      shouldUpdatePassword: false,
    });

    assert.deepEqual(await service.verifyCredential('preserva.cred@example.com', 'SenhaAntiga123'), {
      ok: true,
      usuario_id: saved.id,
    });
  });

  await test('redefinicao altera senha e senha antiga deixa de validar', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'redefine.cred@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaAntiga123',
    });

    await updateUsuarioAdminAndSyncLocalCredential({
      userApi: User,
      credentialService: service,
      usuarioId: saved.id,
      payload,
      email: payload.email,
      novaSenha: 'SenhaNova123',
      shouldUpdatePassword: true,
    });

    assert.deepEqual(await service.verifyCredential('redefine.cred@example.com', 'SenhaAntiga123'), { ok: false });
    assert.deepEqual(await service.verifyCredential('redefine.cred@example.com', 'SenhaNova123'), {
      ok: true,
      usuario_id: saved.id,
    });
  });

  await test('usuario antigo sem credencial pode receber senha local', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'antigo.sem.cred@example.com' });
    const saved = await User.create(payload);

    assert.equal(await service.hasCredential(saved.id), false);

    await updateUsuarioAdminAndSyncLocalCredential({
      userApi: User,
      credentialService: service,
      usuarioId: saved.id,
      payload,
      email: payload.email,
      novaSenha: 'SenhaNovaLocal',
      shouldUpdatePassword: true,
    });

    assert.deepEqual(await service.verifyCredential('antigo.sem.cred@example.com', 'SenhaNovaLocal'), {
      ok: true,
      usuario_id: saved.id,
    });
  });

  await test('alteracao de e-mail atualiza credencial sem trocar senha', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'email.antigo.admin@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaMantida123',
    });
    const oldCredential = await service.findCredentialByUserId(saved.id);
    const updatedPayload = adminPayload({ email: 'email.novo.admin@example.com' });

    await updateUsuarioAdminAndSyncLocalCredential({
      userApi: User,
      credentialService: service,
      usuarioId: saved.id,
      payload: updatedPayload,
      email: updatedPayload.email,
      novaSenha: '',
      shouldUpdatePassword: false,
    });

    const newCredential = await service.findCredentialByUserId(saved.id);
    assert.equal(newCredential.criado_em, oldCredential.criado_em);
    assert.deepEqual(await service.verifyCredential('email.novo.admin@example.com', 'SenhaMantida123'), {
      ok: true,
      usuario_id: saved.id,
    });
    assert.deepEqual(await service.verifyCredential('email.antigo.admin@example.com', 'SenhaMantida123'), { ok: false });
  });

  await test('duplicidade de e-mail de credencial bloqueia antes de alterar usuario', async () => {
    await setupMock();
    const { service } = createService();
    await service.createCredential('ghost_cred', 'email.credencial.duplicada@example.com', 'SenhaGhost');
    const payload = adminPayload({ email: 'email.usuario.original@example.com' });
    const saved = await User.create(payload);
    const duplicatedPayload = adminPayload({ email: 'email.credencial.duplicada@example.com' });

    await assert.rejects(
      () => updateUsuarioAdminAndSyncLocalCredential({
        userApi: User,
        credentialService: service,
        usuarioId: saved.id,
        payload: duplicatedPayload,
        email: duplicatedPayload.email,
        novaSenha: 'SenhaNova123',
        shouldUpdatePassword: true,
      }),
      /e-mail já possui credencial/
    );

    assert.equal((await User.get(saved.id)).email, 'email.usuario.original@example.com');
  });

  await test('falha ao atualizar credencial desfaz a edicao cadastral e os vinculos', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'rollback.update.original@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaOriginal123',
    });
    const failingCredentialService = {
      findCredentialByUserId: service.findCredentialByUserId,
      findCredentialByEmail: service.findCredentialByEmail,
      createCredential: service.createCredential,
      updateCredential: async () => {
        throw new Error('LocalCredential: falha simulada na atualização');
      },
      updateCredentialEmail: service.updateCredentialEmail,
    };
    const changedPayload = adminPayload({
      nome: 'Nome que deve ser desfeito',
      email: 'rollback.update.novo@example.com',
    });

    await assert.rejects(
      () => updateUsuarioAdminAndSyncLocalCredential({
        userApi: User,
        credentialService: failingCredentialService,
        usuarioId: saved.id,
        payload: changedPayload,
        email: changedPayload.email,
        novaSenha: 'SenhaNova123',
        shouldUpdatePassword: true,
      }),
      /falha simulada na atualização/,
    );

    const restored = await User.get(saved.id);
    assert.equal(restored.nome, payload.nome);
    assert.equal(restored.email, payload.email);
    assert.deepEqual(await service.verifyCredential(payload.email, 'SenhaOriginal123'), {
      ok: true,
      usuario_id: saved.id,
    });
  });

  await test('falha na criacao da credencial remove usuario recem-criado', async () => {
    await setupMock();
    const payload = adminPayload({ email: 'rollback.cred@example.com' });
    const failingService = {
      createCredential: async () => {
        throw new Error('LocalCredential: falha simulada');
      },
    };

    await assert.rejects(
      () => createUsuarioAdminWithLocalCredential({
        userApi: User,
        credentialService: failingService,
        payload,
        email: payload.email,
        senha: 'SenhaRollback123',
      }),
      /falha simulada/
    );

    const usuarios = await User.list();
    assert.equal(usuarios.some((usuario) => usuario.email === 'rollback.cred@example.com'), false);
  });

  await test('exclusao administrativa remove credencial local', async () => {
    await setupMock();
    const { service } = createService();
    const payload = adminPayload({ email: 'delete.cred@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaDelete123',
    });

    assert.equal(await service.hasCredential(saved.id), true);
    await deleteUsuarioAdminAndLocalCredential({
      userApi: User,
      credentialService: service,
      usuarioId: saved.id,
    });

    assert.equal(await service.hasCredential(saved.id), false);
    await assert.rejects(() => User.get(saved.id), /não encontrado/);
  });

  await test('indicador hasCredential funciona sem expor hash ou salt em metadados', async () => {
    await setupMock();
    const { service, storage } = createService();
    const payload = adminPayload({ email: 'indicador.cred@example.com' });
    const saved = await createUsuarioAdminWithLocalCredential({
      userApi: User,
      credentialService: service,
      payload,
      email: payload.email,
      senha: 'SenhaIndicador123',
    });

    assert.equal(await service.hasCredential(saved.id), true);
    const metadata = await service.findCredentialByUserId(saved.id);
    assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'senha_hash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'salt'), false);

    const rawCredential = storage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY);
    assert.equal(rawCredential.includes('SenhaIndicador123'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de usuarioLocalAccessAdmin passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
