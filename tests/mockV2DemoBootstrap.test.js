const assert = require('node:assert/strict');
const {
  MOCK_V2_DEMO_BOOTSTRAP_KEY,
  MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY,
  MOCK_V1_AUXILIARY_STORAGE_KEYS,
  MOCK_V1_CACHE_STORAGE_PREFIXES,
  MOCK_V1_FILE_DIRECTORIES,
  runMockV2DemoBootstrap,
} = require('../.tmp-domain-compat/src/api/mockV2DemoBootstrap');
const {
  MOCK_V2_LOCAL_STORAGE_KEY,
  createMockV2LocalPersistence,
} = require('../.tmp-domain-compat/src/api/mockV2LocalPersistence');
const { MOCK_V2_EMPTY_SEED } = require('../.tmp-domain-compat/src/api/mockV2Seed');
const {
  MOCK_V2_DEMO_DATASET_ID,
} = require('../.tmp-domain-compat/src/api/mockV2DemoSeed');
const {
  MOCK_V2_DEMO_QA_PERIODOS,
} = require('../.tmp-domain-compat/src/api/mockV2DemoQaCoverage');
const { LOCAL_CREDENTIAL_STORAGE_KEY } = require('../.tmp-domain-compat/src/auth/localCredentials');
const { PERIODO_PRODUTIVO_STORAGE_KEY } = require('../.tmp-domain-compat/src/types/periodoProdutivo');
const { authLoginByProfile } = require('../.tmp-domain-compat/src/auth/authMock');
const { MockLocalData } = require('../.tmp-domain-compat/src/api/mock');

const createMemoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  const calls = { set: [], remove: [] };
  let failSetKey = null;
  return {
    values,
    calls,
    failNextSet(key) {
      failSetKey = key;
    },
    adapter: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        calls.set.push(key);
        if (failSetKey === key) {
          failSetKey = null;
          throw new Error(`falha simulada em ${key}`);
        }
        values.set(key, value);
      },
      removeItem: async (key) => {
        calls.remove.push(key);
        values.delete(key);
      },
      getAllKeys: async () => [...values.keys()],
    },
  };
};

const createFileSystem = () => {
  const base = 'file:///app/';
  const existing = new Set(MOCK_V1_FILE_DIRECTORIES.map((name) => `${base}${name}/`));
  const deleted = [];
  let failDirectory = null;
  return {
    existing,
    deleted,
    failOnce(directory) {
      failDirectory = `${base}${directory}/`;
    },
    adapter: {
      documentDirectory: base,
      getInfoAsync: async (uri) => ({ exists: existing.has(uri) }),
      deleteAsync: async (uri) => {
        if (failDirectory === uri) {
          failDirectory = null;
          throw new Error('falha simulada de arquivo');
        }
        deleted.push(uri);
        existing.delete(uri);
      },
    },
  };
};

const createHasher = () => {
  let counter = 0;
  return {
    async generateSalt() {
      counter += 1;
      return `demo-salt-${counter}`;
    },
    async hashPassword({ senha, salt }) {
      return `demo-hash:${salt}:${senha.length}`;
    },
  };
};

const bootstrapDeps = (storage, fileSystem) => ({
  storage: storage.adapter,
  fileSystem: fileSystem.adapter,
  credentialHasher: createHasher(),
  now: () => '2026-08-05T12:00:00.000Z',
});

const testMockV2DemoBootstrap = async () => {
  const initial = {
    '@tche:mock-mvp:v1': '{"version":1}',
    '@tche:user': '{"id":"u1"}',
    '@tche:geojson-imports:v1': '{"version":1}',
    '@tche:png-map-imports:v1': '{"version":1}',
    '@tche:prescription-zip-imports:v1': '{"version":1}',
    '@tche:material-tecnico-imports:v1': '{"version":1}',
    '@tche:periodos-produtivos:v1': '{"version":1}',
    '@mapas_metadata_p1': 'legado',
    '@mapas_talhao_p1_t1': 'legado',
    '@mapas_tiles_p1': 'legado',
    '@app:nao-relacionado': 'preservar',
    [LOCAL_CREDENTIAL_STORAGE_KEY]: '{"credencial":"antiga"}',
  };
  const storage = createMemoryStorage(initial);
  const fileSystem = createFileSystem();
  const installed = await runMockV2DemoBootstrap(bootstrapDeps(storage, fileSystem));

  assert.equal(installed.status, 'installed');
  assert.equal(installed.dataset_id, MOCK_V2_DEMO_DATASET_ID);
  assert.equal(installed.cleanup_complete, true);
  assert.deepEqual(installed.warnings, []);
  assert.equal(storage.values.has(MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY), false);
  assert.equal(storage.values.get('@app:nao-relacionado'), 'preservar');
  for (const key of [
    '@tche:mock-mvp:v1',
    ...MOCK_V1_AUXILIARY_STORAGE_KEYS.filter((item) => item !== PERIODO_PRODUTIVO_STORAGE_KEY),
  ]) {
    assert.equal(storage.values.has(key), false, key);
  }
  assert.equal([...storage.values.keys()].some((key) =>
    MOCK_V1_CACHE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  ), false);
  assert.equal(fileSystem.deleted.length, MOCK_V1_FILE_DIRECTORIES.length);

  const snapshot = JSON.parse(storage.values.get(MOCK_V2_LOCAL_STORAGE_KEY));
  assert.equal(snapshot.dataset.id, MOCK_V2_DEMO_DATASET_ID);
  assert.equal(snapshot.usuarios.length, 44);
  assert.equal(snapshot.propriedades.length, 73);
  const credentialRaw = storage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY);
  const credentialSnapshot = JSON.parse(credentialRaw);
  assert.equal(credentialSnapshot.credentials.length, 44);
  assert.equal(credentialRaw.includes('admin123'), false);
  assert.equal(credentialRaw.includes('colab123'), false);
  assert.equal(credentialRaw.includes('prod123'), false);
  const installedMarker = JSON.parse(storage.values.get(MOCK_V2_DEMO_BOOTSTRAP_KEY));
  assert.equal(installedMarker.version, 3);
  assert.equal(installedMarker.cleanup_complete, true);
  const installedPeriodos = JSON.parse(storage.values.get(PERIODO_PRODUTIVO_STORAGE_KEY));
  assert.equal(installedPeriodos.items.length, MOCK_V2_DEMO_QA_PERIODOS.length);

  const writesBeforeRepeat = storage.calls.set.length;
  const repeated = await runMockV2DemoBootstrap(bootstrapDeps(storage, fileSystem));
  assert.equal(repeated.status, 'already_installed');
  assert.equal(repeated.cleanup_complete, true);
  assert.equal(storage.calls.set.length, writesBeforeRepeat);
  assert.equal(storage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY), credentialRaw);

  MockLocalData.__setStorageForTests(storage.adapter);
  const quickAdmin = await authLoginByProfile('admin');
  const quickCollaborator = await authLoginByProfile('colaborador');
  const quickProducer = await authLoginByProfile('produtor');
  assert.equal(quickAdmin.id, 'usr_admin_cesar');
  assert.equal(quickCollaborator.id, 'usr_colaborador_victor');
  assert.equal(quickCollaborator.vinculos_propriedades.length, 37);
  assert.equal(quickProducer.perfil, 'produtor');
  assert.ok(quickProducer.vinculos_propriedades.length >= 1);

  const existingStorage = createMemoryStorage({ '@tche:mock-mvp:v1': '{"preservar":true}' });
  const existingFs = createFileSystem();
  await createMockV2LocalPersistence(existingStorage.adapter).save(MOCK_V2_EMPTY_SEED);
  const existingRaw = existingStorage.values.get(MOCK_V2_LOCAL_STORAGE_KEY);
  const preserved = await runMockV2DemoBootstrap(bootstrapDeps(existingStorage, existingFs));
  assert.equal(preserved.status, 'preserved_existing_v2');
  assert.equal(existingStorage.values.get(MOCK_V2_LOCAL_STORAGE_KEY), existingRaw);
  assert.equal(existingStorage.values.has('@tche:mock-mvp:v1'), true);
  assert.equal(existingFs.deleted.length, 0);

  const invalidStorage = createMemoryStorage({
    [MOCK_V2_LOCAL_STORAGE_KEY]: '{"version":2,"invalido":true}',
    '@tche:mock-mvp:v1': '{"version":1}',
  });
  await assert.rejects(
    () => runMockV2DemoBootstrap(bootstrapDeps(invalidStorage, createFileSystem())),
    /snapshot v2 existente é inválido/
  );
  assert.equal(invalidStorage.values.has('@tche:mock-mvp:v1'), true);

  const rollbackStorage = createMemoryStorage({
    '@tche:mock-mvp:v1': '{"version":1}',
    '@tche:user': '{"id":"u1"}',
    [LOCAL_CREDENTIAL_STORAGE_KEY]: '{"credencial":"anterior"}',
  });
  rollbackStorage.failNextSet(MOCK_V2_LOCAL_STORAGE_KEY);
  await assert.rejects(
    () => runMockV2DemoBootstrap(bootstrapDeps(rollbackStorage, createFileSystem())),
    /falha simulada/
  );
  assert.equal(rollbackStorage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY), '{"credencial":"anterior"}');
  assert.equal(rollbackStorage.values.has(MOCK_V2_LOCAL_STORAGE_KEY), false);
  assert.equal(rollbackStorage.values.has('@tche:mock-mvp:v1'), true);
  assert.equal(rollbackStorage.values.has('@tche:user'), true);

  const retryStorage = createMemoryStorage({ '@tche:mock-mvp:v1': '{"version":1}' });
  const retryFs = createFileSystem();
  retryFs.failOnce('tche-png-imports');
  const partial = await runMockV2DemoBootstrap(bootstrapDeps(retryStorage, retryFs));
  assert.equal(partial.cleanup_complete, false);
  assert.ok(partial.warnings.some((warning) => warning.includes('tche-png-imports')));
  const partialMarker = JSON.parse(retryStorage.values.get(MOCK_V2_DEMO_BOOTSTRAP_KEY));
  assert.equal(partialMarker.storage_cleanup_complete, true);
  assert.equal(partialMarker.file_cleanup_complete, false);
  const customPeriodo = {
    ...MOCK_V2_DEMO_QA_PERIODOS[0],
    id: 'periodo_custom_preservado_retry',
    label: 'Período customizado preservado no retry',
  };
  retryStorage.values.set(PERIODO_PRODUTIVO_STORAGE_KEY, JSON.stringify({
    version: 1,
    savedAt: '2026-08-05T12:30:00.000Z',
    items: [customPeriodo],
  }));
  const retryCredentialRaw = retryStorage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY);
  const completed = await runMockV2DemoBootstrap(bootstrapDeps(retryStorage, retryFs));
  assert.equal(completed.status, 'already_installed');
  assert.equal(completed.cleanup_complete, true);
  assert.equal(retryStorage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY), retryCredentialRaw);
  const retryPeriodos = JSON.parse(retryStorage.values.get(PERIODO_PRODUTIVO_STORAGE_KEY));
  assert.equal(retryPeriodos.items.some((item) => item.id === customPeriodo.id), true);
  assert.equal(retryPeriodos.items.length, MOCK_V2_DEMO_QA_PERIODOS.length + 1);

  const baseSnapshot = {
    ...snapshot,
    usuarios: snapshot.usuarios.filter((item) => !item.id.includes('_qa_')),
    produtores: snapshot.produtores.filter((item) => !item.id.includes('_qa_')),
    propriedades: snapshot.propriedades.filter((item) => !item.id.includes('_qa_')),
    usuarios_propriedades: snapshot.usuarios_propriedades.filter((item) => !item.id.includes('_qa_')),
    talhoes: snapshot.talhoes.filter((item) => !item.id.includes('_qa_')),
    visitas: snapshot.visitas.filter((item) => !item.id.includes('_qa_')),
    cadernos: snapshot.cadernos.filter((item) => !item.id.includes('_qa_')),
    materiais: snapshot.materiais.filter((item) => !item.id.includes('_qa_')),
  };
  const customVisit = {
    id: 'visita_custom_preservada',
    organizacao_id: 'org_tche_fertilidade',
    propriedade_id: baseSnapshot.propriedades[0].id,
    tecnico_responsavel: 'Registro do usuário',
    data_visita: '2026-08-20T12:00:00.000Z',
    objetivo: 'outro',
    status: 'agendada',
  };
  baseSnapshot.visitas.push(customVisit);
  const customCredential = {
    usuario_id: 'usuario_custom_credencial',
    email_normalizado: 'custom@example.com',
    senha_hash: 'hash-preservado',
    salt: 'salt-preservado',
    versao: 1,
    criado_em: '2026-08-04T12:00:00.000Z',
    atualizado_em: '2026-08-04T12:00:00.000Z',
  };
  const oldCredentialSnapshot = {
    ...credentialSnapshot,
    credentials: [
      ...credentialSnapshot.credentials.filter((item) => !item.usuario_id.includes('_qa_')),
      customCredential,
    ],
  };
  const migrationPeriodo = {
    ...MOCK_V2_DEMO_QA_PERIODOS[0],
    id: 'periodo_custom_preservado_migracao',
    propriedade_id: baseSnapshot.propriedades[0].id,
    nome_propriedade: baseSnapshot.propriedades[0].nome,
    label: 'Período customizado anterior à complementação',
  };
  const migrationStorage = createMemoryStorage({
    [MOCK_V2_LOCAL_STORAGE_KEY]: JSON.stringify(baseSnapshot),
    [LOCAL_CREDENTIAL_STORAGE_KEY]: JSON.stringify(oldCredentialSnapshot),
    [PERIODO_PRODUTIVO_STORAGE_KEY]: JSON.stringify({
      version: 1,
      savedAt: '2026-08-04T12:00:00.000Z',
      items: [migrationPeriodo],
    }),
    [MOCK_V2_DEMO_BOOTSTRAP_KEY]: JSON.stringify({
      version: 1,
      dataset_id: MOCK_V2_DEMO_DATASET_ID,
      installed_at: '2026-08-04T12:00:00.000Z',
      cleanup_complete: true,
      storage_cleanup_complete: true,
      file_cleanup_complete: true,
    }),
  });
  const migrationFs = createFileSystem();
  const migrated = await runMockV2DemoBootstrap(bootstrapDeps(migrationStorage, migrationFs));
  assert.equal(migrated.status, 'already_installed');
  const migratedSnapshot = JSON.parse(migrationStorage.values.get(MOCK_V2_LOCAL_STORAGE_KEY));
  assert.equal(migratedSnapshot.usuarios.length, 44);
  assert.equal(migratedSnapshot.visitas.some((item) => item.id === customVisit.id), true);
  const migratedCredentials = JSON.parse(migrationStorage.values.get(LOCAL_CREDENTIAL_STORAGE_KEY));
  assert.equal(migratedCredentials.credentials.length, 45);
  assert.equal(
    migratedCredentials.credentials.some((item) => item.usuario_id === customCredential.usuario_id),
    true
  );
  const migratedPeriodos = JSON.parse(migrationStorage.values.get(PERIODO_PRODUTIVO_STORAGE_KEY));
  assert.equal(migratedPeriodos.items.some((item) => item.id === migrationPeriodo.id), true);
  assert.equal(migratedPeriodos.items.length, MOCK_V2_DEMO_QA_PERIODOS.length + 1);
  assert.equal(JSON.parse(migrationStorage.values.get(MOCK_V2_DEMO_BOOTSTRAP_KEY)).version, 3);
  assert.equal(migrationFs.deleted.length, 0);

  const logicalNameUpgradeState = JSON.parse(JSON.stringify(snapshot));
  for (const collection of ['visitas', 'cadernos', 'materiais']) {
    logicalNameUpgradeState[collection].forEach((record) => {
      if (record.id.includes('_qa_')) delete record.talhao_nome;
    });
  }
  const logicalNameUpgradeStorage = createMemoryStorage({
    [MOCK_V2_LOCAL_STORAGE_KEY]: JSON.stringify(logicalNameUpgradeState),
    [LOCAL_CREDENTIAL_STORAGE_KEY]: credentialRaw,
    [PERIODO_PRODUTIVO_STORAGE_KEY]: JSON.stringify(installedPeriodos),
    [MOCK_V2_DEMO_BOOTSTRAP_KEY]: JSON.stringify({
      version: 2,
      dataset_id: MOCK_V2_DEMO_DATASET_ID,
      installed_at: '2026-08-06T12:00:00.000Z',
      cleanup_complete: true,
      storage_cleanup_complete: true,
      file_cleanup_complete: true,
    }),
  });
  await runMockV2DemoBootstrap(bootstrapDeps(logicalNameUpgradeStorage, createFileSystem()));
  const upgradedLogicalNames = JSON.parse(
    logicalNameUpgradeStorage.values.get(MOCK_V2_LOCAL_STORAGE_KEY)
  );
  for (const collection of ['visitas', 'cadernos', 'materiais']) {
    assert.equal(
      upgradedLogicalNames[collection].filter((record) => (
        record.id.includes('_qa_') && record.talhao_id
      )).every(
        (record) => record.talhao_nome === '[QA] Talhão sem geometria'
      ),
      true,
      collection
    );
  }
  assert.equal(
    JSON.parse(logicalNameUpgradeStorage.values.get(MOCK_V2_DEMO_BOOTSTRAP_KEY)).version,
    3
  );

  console.log('Bootstrap do dataset demonstrativo mock v2 validado.');
};

module.exports = { testMockV2DemoBootstrap };
