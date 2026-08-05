const assert = require('node:assert/strict');
const {
  PERIODO_PRODUTIVO_STORAGE_KEY,
  createPeriodoProdutivoService,
} = require('../.tmp-domain-compat/src/services/PeriodoProdutivoService');
const {
  PERIODO_PRODUTIVO_VERSION,
} = require('../.tmp-domain-compat/src/types/periodoProdutivo');
const {
  MOCK_LOCAL_STORAGE_KEY,
} = require('../.tmp-domain-compat/src/api/mockLocalPersistence');

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
      setItem: async (key, value) => values.set(key, value),
      removeItem: async (key) => values.delete(key),
    },
  };
};

const createService = () => {
  const storage = createMemoryStorage();
  let index = 0;
  const timestamps = [
    '2026-06-08T10:00:00.000Z',
    '2026-06-08T10:00:01.000Z',
    '2026-06-08T10:00:02.000Z',
    '2026-06-08T10:00:03.000Z',
    '2026-06-08T10:00:04.000Z',
  ];
  const service = createPeriodoProdutivoService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(index++, timestamps.length - 1)],
    generateId: () => 'periodo_gerado',
  });

  return { service, storage };
};

const baseInput = (overrides = {}) => ({
  propriedade_id: 'prop_a',
  fazenda_id: 'fazenda_a',
  nome_propriedade: 'Propriedade A',
  tipo_periodo: 'safra',
  cultura: 'Soja',
  ano_agricola: '2025/2026',
  data_inicio: '2025-10-01T00:00:00.000Z',
  data_fim: '2026-02-15T00:00:00.000Z',
  status: 'em_andamento',
  talhao_nome: 'Talhao 1',
  observacoes: 'Periodo local demonstrativo',
  criado_por_user_id: 'u_admin',
  criado_por_nome: 'Admin',
  origem: 'local',
  ...overrides,
});

const readSnapshot = (storage) => JSON.parse(storage.values.get(PERIODO_PRODUTIVO_STORAGE_KEY));

const assertRejectsWith = async (fn, pattern) => {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = true;
    assert.match(String(error.message || error), pattern);
  }
  assert.equal(rejected, true);
};

const run = async () => {
  await test('cria periodo produtivo canônico somente com propriedade_id', async () => {
    const { service, storage } = createService();
    const created = await service.createPeriodoProdutivoMetadata(baseInput());

    assert.equal(created.id, 'periodo_gerado');
    assert.equal(created.propriedade_id, 'prop_a');
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'fazenda_id'), false);
    assert.equal(created.tipo_periodo_label, 'Safra');
    assert.equal(created.label, 'Safra • Soja • 2025/2026 • Talhao 1');
    assert.equal(created.registro_status, 'ativo');
    assert.equal(created.versao, PERIODO_PRODUTIVO_VERSION);
    assert.equal(storage.values.has(PERIODO_PRODUTIVO_STORAGE_KEY), true);
    assert.equal(storage.values.has(MOCK_LOCAL_STORAGE_KEY), false);
    assert.equal(readSnapshot(storage).items.length, 1);
  });

  await test('lista por propriedade e talhao sem bloquear periodo da propriedade inteira', async () => {
    const { service } = createService();
    await service.createPeriodoProdutivoMetadata(baseInput({ id: 'safra_talhao' }));
    await service.createPeriodoProdutivoMetadata(baseInput({
      id: 'safrinha_propriedade',
      tipo_periodo: 'safrinha',
      cultura: 'Milho',
      talhao_nome: undefined,
    }));
    await service.createPeriodoProdutivoMetadata(baseInput({
      id: 'outra_fazenda',
      propriedade_id: 'prop_b',
    }));

    assert.deepEqual(
      (await service.listPeriodosProdutivosByPropriedade('prop_a')).map((item) => item.id).sort(),
      ['safra_talhao', 'safrinha_propriedade'].sort()
    );
    assert.deepEqual(
      (await service.listActivePeriodosProdutivosByTalhao('prop_a', 'Talhao 1')).map((item) => item.id).sort(),
      ['safra_talhao', 'safrinha_propriedade'].sort()
    );
  });

  await test('atualiza e marca como removido sem apagar metadado imediatamente', async () => {
    const { service } = createService();
    const created = await service.createPeriodoProdutivoMetadata(baseInput());
    const updated = await service.updatePeriodoProdutivoMetadata(created.id, {
      status: 'encerrada',
      cultura: 'Milho',
    });
    const removed = await service.markPeriodoProdutivoAsRemoved(created.id);

    assert.equal(updated.status, 'encerrada');
    assert.equal(updated.cultura, 'Milho');
    assert.equal(removed.registro_status, 'removido');
    assert.equal((await service.listPeriodosProdutivos()).length, 1);
    assert.equal((await service.listActivePeriodosProdutivos()).length, 0);
  });

  await test('storage corrompido retorna lista vazia', async () => {
    const { service, storage } = createService();
    storage.values.set(PERIODO_PRODUTIVO_STORAGE_KEY, '{json-invalido');

    assert.deepEqual(await service.listPeriodosProdutivos(), []);
  });

  await test('rejeita conteudo bruto, objetos e datas inconsistentes', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ geojson: '{}' })),
      /conteudo bruto/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ coordinates: '-1,-2' })),
      /conteudo bruto/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ metadados: { bruto: true } })),
      /valor primitivo pequeno/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({
        data_inicio: '2026-02-15T00:00:00.000Z',
        data_fim: '2025-10-01T00:00:00.000Z',
      })),
      /posterior/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ tipo_periodo: undefined })),
      /tipo_periodo: obrigatorio/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ cultura: '   ' })),
      /cultura: obrigatorio/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ status: undefined })),
      /status: obrigatorio/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ status: 'desconhecida' })),
      /status: obrigatorio/
    );
    await assertRejectsWith(
      () => service.createPeriodoProdutivoMetadata(baseInput({ ano_agricola: '2026' })),
      /AAAA\/AAAA/
    );
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de periodoProdutivoService passaram.');
});
