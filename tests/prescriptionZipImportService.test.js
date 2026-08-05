const assert = require('node:assert/strict');
const {
  PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY,
  createPrescriptionZipImportService,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipImportService');
const {
  PRESCRIPTION_ZIP_IMPORT_VERSION,
} = require('../.tmp-domain-compat/src/types/anexoPrescricaoZipLocal');
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
    '2026-06-05T10:00:00.000Z',
    '2026-06-05T10:00:01.000Z',
    '2026-06-05T10:00:02.000Z',
    '2026-06-05T10:00:03.000Z',
  ];
  const service = createPrescriptionZipImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(index++, timestamps.length - 1)],
    generateId: () => 'zip_import_gerado',
  });
  return { service, storage };
};

const baseInput = (overrides = {}) => ({
  propriedade_id: 'prop_a',
  fazenda_id: 'fazenda_a',
  nome_propriedade: 'Propriedade A',
  titulo: 'Prescrição calcário',
  camada: 'prescricao',
  camada_label: 'Prescrição',
  safra: '2025/2026',
  ano: 2026,
  escopo: 'propriedade',
  arquivo_nome_original: 'prescricao.zip',
  arquivo_uri_local: 'file:///app/tche-prescription-zips/prop_a/zip-001-prescricao.zip',
  arquivo_tamanho_bytes: 2048,
  arquivo_mime: 'application/zip',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  ...overrides,
});

const readSnapshot = (storage) => JSON.parse(storage.values.get(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY));

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
  await test('cria metadado de prescrição ZIP em chave propria', async () => {
    const { service, storage } = createService();
    const created = await service.createPrescriptionZipImportMetadata(baseInput());

    assert.equal(created.id, 'zip_import_gerado');
    assert.equal(created.categoria, 'prescricao');
    assert.equal(created.categoria_label, 'Prescrição');
    assert.equal(created.tipo_material, 'prescricao');
    assert.equal(created.formato_arquivo, 'zip');
    assert.equal(created.status, 'ativo');
    assert.equal(created.versao, PRESCRIPTION_ZIP_IMPORT_VERSION);
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'fazenda_id'), false);
    assert.equal(storage.values.has(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY), true);
    assert.equal(storage.values.has(MOCK_LOCAL_STORAGE_KEY), false);
    assert.equal(readSnapshot(storage).items.length, 1);
  });

  await test('lista por propriedade, normaliza snapshot legado e filtra ativos', async () => {
    const { service, storage } = createService();
    await service.createPrescriptionZipImportMetadata(baseInput({ id: 'zip_1' }));
    await service.createPrescriptionZipImportMetadata(baseInput({
      id: 'zip_2',
      propriedade_id: 'prop_b',
      status: 'removido',
    }));

    assert.equal((await service.listPrescriptionZipImportsByPropriedade('prop_a')).length, 1);
    assert.equal((await service.listActivePrescriptionZipImportsByPropriedade('prop_b')).length, 0);

    const snapshot = readSnapshot(storage);
    snapshot.items[0].fazenda_id = 'fazenda_legada';
    delete snapshot.items[0].propriedade_id;
    storage.values.set(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY, JSON.stringify(snapshot));
    const legacy = await service.listPrescriptionZipImportsByPropriedade('fazenda_legada');
    assert.equal(legacy.length, 1);
    assert.equal(legacy[0].propriedade_id, 'fazenda_legada');
    assert.equal(Object.prototype.hasOwnProperty.call(legacy[0], 'fazenda_id'), false);
  });

  await test('marca substituido e removido sem apagar metadado imediatamente', async () => {
    const { service } = createService();
    const created = await service.createPrescriptionZipImportMetadata(baseInput());
    const replaced = await service.markPrescriptionZipImportAsSubstituido(created.id);
    const removed = await service.markPrescriptionZipImportAsRemoved(created.id);

    assert.equal(replaced.status, 'substituido');
    assert.equal(removed.status, 'removido');
    assert.equal((await service.listPrescriptionZipImports()).length, 1);
  });

  await test('rejeita conteudo binario ou campos grandes em metadados', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPrescriptionZipImportMetadata(baseInput({ base64: 'abc' })),
      /conteudo de arquivo/
    );
    await assertRejectsWith(
      () => service.createPrescriptionZipImportMetadata(baseInput({ descricao: 'x'.repeat(4097) })),
      /grande demais/
    );
  });

  await test('rejeita camada invalida e talhao sem referencia', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPrescriptionZipImportMetadata(baseInput({ camada: 'ph' })),
      /camada/
    );
    await assertRejectsWith(
      () => service.createPrescriptionZipImportMetadata(baseInput({ escopo: 'talhao' })),
      /talhao/
    );
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de prescriptionZipImportService passaram.');
});
