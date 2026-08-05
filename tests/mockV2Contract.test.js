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

const run = async () => {
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
    usuarios: [{
      id: 'usr_produtor_1', organizacao_id: 'org_tche_fertilidade', nome: 'Produtor Teste',
      email: 'produtor@example.com', perfil: 'produtor', status: 'ativo',
    }],
    produtores: [{
      id: 'prod_1', organizacao_id: 'org_tche_fertilidade', usuario_id: 'usr_produtor_1',
      nome: 'Produtor Teste', status: 'ativo',
    }],
    propriedades: [{
      id: 'propriedade_1', organizacao_id: 'org_tche_fertilidade', titular_id: 'prod_1',
      nome: 'Propriedade Teste', municipio_id: '4310207', municipio_nome: 'Ijuí',
      uf_id: '43', uf_sigla: 'RS', status: 'ativa',
    }],
    usuarios_propriedades: [{
      id: 'up_1', organizacao_id: 'org_tche_fertilidade', usuario_id: 'usr_produtor_1',
      propriedade_id: 'propriedade_1', tipo_vinculo: 'titular', status: 'ativo',
    }],
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
  console.log('Todos os testes do contrato mock v2 passaram.');
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
