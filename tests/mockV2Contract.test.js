const assert = require('node:assert/strict');
const {
  MOCK_V2_EMPTY_SEED,
} = require('../.tmp-domain-compat/src/api/mockV2Seed');
const {
  MOCK_V2_LOCAL_STORAGE_KEY,
  createMockV2LocalPersistence,
  isMockV2Snapshot,
} = require('../.tmp-domain-compat/src/api/mockV2LocalPersistence');
const { validateMockV2State } = require('../.tmp-domain-compat/src/api/mockV2Validation');
const { LimiteArea, MockLocalData, Produtor, User, Visita } = require('../.tmp-domain-compat/src/api/mock');
const {
  authenticateWithEmailAndPassword,
  AUTH_INVALID_CREDENTIALS_MESSAGE,
} = require('../.tmp-domain-compat/src/auth/authLocal');
const { testMockV2DemoSeed } = require('./mockV2DemoSeed.test');
const { testMockV2DemoBootstrap } = require('./mockV2DemoBootstrap.test');

const run = async () => {
  await testMockV2DemoSeed();
  await testMockV2DemoBootstrap();

  const values = new Map([['@tche:mock-mvp:v1', '{"version":1}']]);
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
  };
  const persistence = createMockV2LocalPersistence(storage);

  const snapshot = await persistence.installSeed(MOCK_V2_EMPTY_SEED);

  assert.equal(values.has('@tche:mock-mvp:v1'), false);
  assert.equal(values.has(MOCK_V2_LOCAL_STORAGE_KEY), true);
  assert.equal(isMockV2Snapshot(snapshot), true);
  assert.equal(snapshot.organizacao.id, 'org_tche_fertilidade');

  const serialized = JSON.stringify(snapshot);
  for (const legacyField of [
    'fazenda_id',
    'fazendaId',
    'regiao',
    'microregiao',
    'sub_regioes',
    'vinculos_microregioes',
  ]) {
    assert.equal(serialized.includes(`"${legacyField}"`), false, legacyField);
  }

  const loaded = await persistence.load();
  assert.deepEqual(loaded, snapshot);

  const validState = {
    ...MOCK_V2_EMPTY_SEED,
    usuarios: [
      {
        id: 'usr_produtor_1', organizacao_id: 'org_tche_fertilidade', nome: 'Produtor Teste',
        email: 'produtor@example.com', perfil: 'produtor', status: 'ativo',
      },
      {
        id: 'usr_colaborador_1', organizacao_id: 'org_tche_fertilidade', nome: 'Colaborador Teste',
        email: 'colaborador@example.com', perfil: 'colaborador', status: 'ativo',
      },
    ],
    produtores: [{
      id: 'prod_1', organizacao_id: 'org_tche_fertilidade', usuario_id: 'usr_produtor_1',
      nome: 'Produtor Teste', status: 'ativo',
    }],
    propriedades: [{
      id: 'propriedade_1', organizacao_id: 'org_tche_fertilidade', titular_id: 'prod_1',
      nome: 'Propriedade Teste', municipio_id: '4310207', municipio_nome: 'Ijuí',
      uf_id: '43', uf_sigla: 'RS', status: 'ativa',
    }],
    usuarios_propriedades: [
      {
        id: 'up_1', organizacao_id: 'org_tche_fertilidade', usuario_id: 'usr_produtor_1',
        propriedade_id: 'propriedade_1', tipo_vinculo: 'titular', status: 'ativo',
      },
      {
        id: 'up_colaborador_1', organizacao_id: 'org_tche_fertilidade', usuario_id: 'usr_colaborador_1',
        propriedade_id: 'propriedade_1', tipo_vinculo: 'colaborador', status: 'ativo',
      },
    ],
  };
  assert.equal(validateMockV2State(validState), true);
  assert.throws(
    () => validateMockV2State({
      ...validState,
      visitas: [{
        id: 'visita_invalida', organizacao_id: 'org_tche_fertilidade',
        propriedade_id: 'propriedade_inexistente',
      }],
    }),
    /Propriedade inexistente/
  );
  assert.throws(
    () => validateMockV2State({ ...validState, materiais: [{
      id: 'material_legado', organizacao_id: 'org_tche_fertilidade',
      propriedade_id: 'propriedade_1', fazenda_id: 'legado',
    }] }),
    /campo legado não permitido/
  );

  await persistence.save({
    ...validState,
    visitas: [{
      id: 'visita_v2_1',
      organizacao_id: 'org_tche_fertilidade',
      propriedade_id: 'propriedade_1',
      tecnico_responsavel: 'Técnico V2',
      data_visita: '2026-08-05T12:00:00.000Z',
      objetivo: 'consultoria',
      status: 'agendada',
    }],
  });
  values.set('@tche:mock-mvp:v1', '{"version":1,"sentinela":"nao_usar"}');

  MockLocalData.__setStorageForTests(storage);
  assert.equal(await MockLocalData.readStorageVersion(), 2);

  const runtimeUsers = await User.list();
  assert.equal(runtimeUsers.length, 2);
  const runtimeProdutor = runtimeUsers.find((usuario) => usuario.id === 'usr_produtor_1');
  assert.equal(runtimeProdutor.vinculos_propriedades[0].propriedade_id, 'propriedade_1');

  const runtimeVisitas = await Visita.list();
  assert.equal(runtimeVisitas.length, 1);
  assert.equal(runtimeVisitas[0].propriedade_id, 'propriedade_1');
  assert.deepEqual(await LimiteArea.list(), []);

  let legacyFallbackCalls = 0;
  await assert.rejects(
    () => authenticateWithEmailAndPassword('admin.demonstracao@example.com', 'admin123', {
      credentialService: {
        findCredentialByEmail: async () => null,
        verifyCredential: async () => ({ ok: false }),
      },
      fallbackLogin: async () => {
        legacyFallbackCalls += 1;
        return { id: 'usuario_v1' };
      },
    }),
    new RegExp(AUTH_INVALID_CREDENTIALS_MESSAGE)
  );
  assert.equal(legacyFallbackCalls, 0);

  await User.update('usr_produtor_1', { nome: 'Produtor Atualizado V2' });
  const propriedadeCriada = await Produtor.createWithLinks({
    propriedade_nome: 'Propriedade Nova V2',
    titular_id: 'prod_1',
    municipio_id: '5107925',
    municipio_nome: 'Sorriso',
    uf_id: '51',
    uf_sigla: 'MT',
    nome: 'Produtor Atualizado V2',
    produtor_nome: 'Produtor Atualizado V2',
    produtor_id: 'prod_1',
    proprietario_id: 'prod_1',
    fazenda: 'Propriedade Nova V2',
    fazenda_nome: 'Propriedade Nova V2',
    status: 'ativo',
  }, {
    titularUsuarioId: 'usr_produtor_1',
    colaboradorIds: ['usr_colaborador_1'],
  });
  await Visita.createScheduled({
    propriedade_id: 'propriedade_1',
    tecnico_responsavel: 'Técnico V2',
    data_visita: new Date(Date.now() + 86400000).toISOString(),
    objetivo: 'consultoria',
  }, {
    usuarioId: 'usr_produtor_1',
    nome: 'Produtor Atualizado V2',
    perfil: 'colaborador',
    propriedadeIds: ['propriedade_1'],
  }, 'teste-escrita-v2');

  const persistedV2 = JSON.parse(values.get(MOCK_V2_LOCAL_STORAGE_KEY));
  assert.equal(persistedV2.usuarios[0].nome, 'Produtor Atualizado V2');
  assert.equal(persistedV2.usuarios[0].produtor_id, undefined);
  assert.equal(persistedV2.propriedades[0].fazenda_id, undefined);
  const propriedadeNovaPersistida = persistedV2.propriedades.find((item) => item.id === propriedadeCriada.id);
  assert.equal(propriedadeNovaPersistida.titular_id, 'prod_1');
  assert.equal(propriedadeNovaPersistida.municipio_id, '5107925');
  assert.equal(propriedadeNovaPersistida.uf_sigla, 'MT');
  assert.ok(persistedV2.usuarios_propriedades.some((vinculo) => (
    vinculo.usuario_id === 'usr_produtor_1'
    && vinculo.propriedade_id === propriedadeCriada.id
    && vinculo.tipo_vinculo === 'titular'
  )));
  assert.ok(persistedV2.usuarios_propriedades.some((vinculo) => (
    vinculo.usuario_id === 'usr_colaborador_1'
    && vinculo.propriedade_id === propriedadeCriada.id
    && vinculo.tipo_vinculo === 'colaborador'
  )));
  const createdVisita = persistedV2.visitas.find((visita) => visita.id !== 'visita_v2_1');
  assert.equal(createdVisita.propriedade_id, 'propriedade_1');
  assert.equal(JSON.stringify(createdVisita).includes('fazenda_id'), false);
  assert.equal(JSON.stringify(createdVisita).includes('produtor_id'), false);
  assert.equal(values.get('@tche:mock-mvp:v1'), '{"version":1,"sentinela":"nao_usar"}');

  assert.equal(validateMockV2State(persistedV2), true);

  values.set(MOCK_V2_LOCAL_STORAGE_KEY, '{"version":2,"corrompido":true}');
  MockLocalData.__setStorageForTests(storage);
  await assert.rejects(
    () => User.list(),
    /snapshot v2 inválido; fallback v1 bloqueado/
  );
  assert.equal(values.get('@tche:mock-mvp:v1'), '{"version":1,"sentinela":"nao_usar"}');
  console.log('Todos os testes do contrato mock v2 passaram.');
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
