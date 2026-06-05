const assert = require('node:assert/strict');
const {
  LOCAL_CREDENTIAL_STORAGE_KEY,
  LOCAL_CREDENTIAL_VERSION,
  createLocalCredentialService,
  normalizeEmail,
} = require('../.tmp-domain-compat/src/auth/localCredentials');
const { User, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');

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

const createService = ({ nowValues } = {}) => {
  const storage = createMemoryStorage();
  const hasher = createTestHasher();
  const timestamps = nowValues || [
    '2026-06-05T10:00:00.000Z',
    '2026-06-05T10:01:00.000Z',
    '2026-06-05T10:02:00.000Z',
    '2026-06-05T10:03:00.000Z',
  ];
  let nowIndex = 0;
  const service = createLocalCredentialService({
    storage: storage.adapter,
    hasher,
    now: () => timestamps[Math.min(nowIndex++, timestamps.length - 1)],
  });

  return { service, storage, hasher };
};

const readSnapshot = (storage) => {
  const raw = storage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

const run = async () => {
  await test('normalizeEmail aplica trim e lowercase sem alterar caracteres internos', () => {
    assert.equal(normalizeEmail('  Usuario.Teste+Campo@Example.COM  '), 'usuario.teste+campo@example.com');
    assert.equal(normalizeEmail('nome com espaco@example.com'), 'nome com espaco@example.com');
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
  });

  await test('cria credencial sem retornar hash ou salt em metadados', async () => {
    const { service, storage } = createService();
    const created = await service.createCredential(' u_local ', '  Usuario@Example.COM ', 'senha-secreta');

    assert.deepEqual(created, {
      usuario_id: 'u_local',
      email_normalizado: 'usuario@example.com',
      versao: LOCAL_CREDENTIAL_VERSION,
      criado_em: '2026-06-05T10:00:00.000Z',
      atualizado_em: '2026-06-05T10:00:00.000Z',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'senha_hash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'salt'), false);

    const snapshot = readSnapshot(storage);
    assert.equal(snapshot.version, LOCAL_CREDENTIAL_VERSION);
    assert.equal(snapshot.credentials.length, 1);
    assert.equal(snapshot.credentials[0].usuario_id, 'u_local');
    assert.equal(snapshot.credentials[0].email_normalizado, 'usuario@example.com');
  });

  await test('busca credencial por usuario e por e-mail ignorando caixa e espacos externos', async () => {
    const { service } = createService();
    await service.createCredential('u_busca', 'busca@example.com', 'abc123');

    assert.equal((await service.findCredentialByUserId('u_busca')).usuario_id, 'u_busca');
    assert.equal((await service.findCredentialByEmail('  BUSCA@EXAMPLE.COM  ')).usuario_id, 'u_busca');
    assert.equal(await service.findCredentialByUserId('sem_credencial'), null);
    assert.equal(await service.findCredentialByEmail('sem.credencial@example.com'), null);
  });

  await test('impede duplicidade de e-mail normalizado', async () => {
    const { service } = createService();
    await service.createCredential('u_um', 'duplicado@example.com', 'abc123');

    await assert.rejects(
      () => service.createCredential('u_dois', '  DUPLICADO@example.com ', 'def456'),
      /e-mail já possui credencial/
    );
  });

  await test('impede duplicidade de usuario_id', async () => {
    const { service } = createService();
    await service.createCredential('u_repetido', 'um@example.com', 'abc123');

    await assert.rejects(
      () => service.createCredential('u_repetido', 'dois@example.com', 'def456'),
      /credencial já existe/
    );
  });

  await test('verifica senha correta e rejeita senha incorreta', async () => {
    const { service } = createService();
    await service.createCredential('u_verify', 'verify@example.com', 'senha-correta');

    assert.deepEqual(await service.verifyCredential('VERIFY@example.com', 'senha-correta'), {
      ok: true,
      usuario_id: 'u_verify',
    });
    assert.deepEqual(await service.verifyCredential('verify@example.com', 'senha-errada'), { ok: false });
    assert.deepEqual(await service.verifyCredential('naoexiste@example.com', 'senha-correta'), { ok: false });
  });

  await test('atualiza senha preservando criado_em e alterando atualizado_em', async () => {
    const { service, storage } = createService();
    await service.createCredential('u_update', 'update@example.com', 'senha-antiga');
    const updated = await service.updateCredential('u_update', 'update.novo@example.com', 'senha-nova');

    assert.equal(updated.criado_em, '2026-06-05T10:00:00.000Z');
    assert.equal(updated.atualizado_em, '2026-06-05T10:02:00.000Z');
    assert.equal(updated.email_normalizado, 'update.novo@example.com');
    assert.deepEqual(await service.verifyCredential('update.novo@example.com', 'senha-antiga'), { ok: false });
    assert.deepEqual(await service.verifyCredential('update.novo@example.com', 'senha-nova'), {
      ok: true,
      usuario_id: 'u_update',
    });

    const snapshot = readSnapshot(storage);
    assert.equal(snapshot.credentials[0].criado_em, '2026-06-05T10:00:00.000Z');
    assert.equal(snapshot.credentials[0].atualizado_em, '2026-06-05T10:02:00.000Z');
  });

  await test('remove credencial e usuario sem credencial retorna false em hasCredential', async () => {
    const { service } = createService();
    await service.createCredential('u_remove', 'remove@example.com', 'abc123');

    assert.equal(await service.hasCredential('u_remove'), true);
    assert.equal(await service.removeCredential('u_remove'), true);
    assert.equal(await service.hasCredential('u_remove'), false);
    assert.equal(await service.removeCredential('u_remove'), false);
    assert.equal(await service.hasCredential('u_sem_credencial'), false);
  });

  await test('armazenamento corrompido usa fallback seguro sem derrubar', async () => {
    const { service, storage } = createService();
    storage.values.set(LOCAL_CREDENTIAL_STORAGE_KEY, '{json inválido');

    assert.deepEqual(await service.listCredentialMetadata(), []);
    assert.equal(await service.hasCredential('u_qualquer'), false);

    await service.createCredential('u_pos_corrupto', 'pos.corrupto@example.com', 'abc123');
    assert.equal(readSnapshot(storage).credentials[0].usuario_id, 'u_pos_corrupto');
  });

  await test('credencial nao aparece em objetos administrativos', async () => {
    const mockStorage = createMemoryStorage();
    MockLocalData.__setStorageForTests(mockStorage.adapter);
    await MockLocalData.restoreSeed();

    const { service } = createService();
    await service.createCredential('u_admin_local', 'admin.local@example.com', 'senha-admin');

    const usuarios = await User.list();
    assert.ok(usuarios.length > 0);
    assert.ok(usuarios.every((usuario) => !Object.prototype.hasOwnProperty.call(usuario, 'senha_hash')));
    assert.ok(usuarios.every((usuario) => !Object.prototype.hasOwnProperty.call(usuario, 'salt')));
    assert.ok(usuarios.every((usuario) => !Object.prototype.hasOwnProperty.call(usuario, 'email_normalizado')));
  });

  await test('snapshot persistido nao guarda senha em texto original', async () => {
    const { service, storage } = createService();
    await service.createCredential('u_snapshot', 'snapshot@example.com', 'senha-super-secreta');

    const raw = storage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY);
    assert.equal(raw.includes('senha-super-secreta'), false);
    assert.equal(raw.includes('senha_hash'), true);
    assert.equal(raw.includes('salt'), true);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de localCredentials passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
