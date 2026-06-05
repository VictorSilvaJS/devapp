const assert = require('node:assert/strict');
const {
  GEOJSON_IMPORT_STORAGE_KEY,
  createGeoJsonImportService,
} = require('../.tmp-domain-compat/src/services/GeoJsonImportService');
const {
  GEOJSON_IMPORT_VERSION,
} = require('../.tmp-domain-compat/src/types/geojsonImport');
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
      setItem: async (key, value) => {
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    },
  };
};

const createService = () => {
  const storage = createMemoryStorage();
  let nowIndex = 0;
  let idIndex = 0;
  const timestamps = [
    '2026-06-05T12:00:00.000Z',
    '2026-06-05T12:00:01.000Z',
    '2026-06-05T12:00:02.000Z',
    '2026-06-05T12:00:03.000Z',
    '2026-06-05T12:00:04.000Z',
    '2026-06-05T12:00:05.000Z',
    '2026-06-05T12:00:06.000Z',
    '2026-06-05T12:00:07.000Z',
    '2026-06-05T12:00:08.000Z',
    '2026-06-05T12:00:09.000Z',
    '2026-06-05T12:00:10.000Z',
    '2026-06-05T12:00:11.000Z',
  ];
  const service = createGeoJsonImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(nowIndex++, timestamps.length - 1)],
    generateId: () => {
      idIndex += 1;
      return `geojson_test_${idIndex}`;
    },
  });

  return { service, storage };
};

const baseInput = (overrides = {}) => ({
  propriedade_id: 'p_geo_a',
  arquivo_nome_original: 'limites.geojson',
  nome_propriedade: 'Propriedade Geo A',
  arquivo_tamanho_bytes: 1234,
  arquivo_mime: 'application/geo+json',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin Demonstracao',
  talhoes_count: 2,
  polygon_parts_count: 3,
  geometry_types: ['Polygon', 'MultiPolygon', 'Polygon'],
  area_total_hectares: 42.5,
  safra: '2025/2026',
  ano: 2025,
  observacoes: 'Indice local de metadados.',
  ...overrides,
});

const readSnapshot = (storage) => {
  const raw = storage.values.get(GEOJSON_IMPORT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

const run = async () => {
  await test('lista vazia quando nao ha storage', async () => {
    const { service } = createService();

    assert.deepEqual(await service.listGeoJsonImports(), []);
    assert.equal(await service.getActiveGeoJsonImportForPropriedade('p_geo_a'), null);
    assert.equal(await service.getGeoJsonImportById('geojson_inexistente'), null);
  });

  await test('cria metadado em chave propria sem usar snapshot mock', async () => {
    const { service, storage } = createService();
    const created = await service.createGeoJsonImportMetadata(baseInput());

    assert.equal(created.id, 'geojson_test_1');
    assert.equal(created.propriedade_id, 'p_geo_a');
    assert.equal(created.fazenda_id, 'p_geo_a');
    assert.equal(created.arquivo_nome_original, 'limites.geojson');
    assert.equal(created.status, 'rascunho');
    assert.equal(created.origem, 'arquivo_local');
    assert.equal(created.versao, GEOJSON_IMPORT_VERSION);
    assert.equal(created.importado_em, '2026-06-05T12:00:00.000Z');
    assert.equal(created.atualizado_em, '2026-06-05T12:00:00.000Z');
    assert.deepEqual(created.geometry_types, ['Polygon', 'MultiPolygon']);

    assert.equal(storage.values.has(GEOJSON_IMPORT_STORAGE_KEY), true);
    assert.equal(storage.values.has(MOCK_LOCAL_STORAGE_KEY), false);
  });

  await test('preenche propriedade_id e fazenda_id por fallback nos dois sentidos', async () => {
    const { service } = createService();
    const byPropriedade = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_fallback',
      fazenda_id: undefined,
      arquivo_nome_original: 'por-propriedade.geojson',
    }));
    const byFazenda = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: undefined,
      fazenda_id: 'fazenda_fallback',
      arquivo_nome_original: 'por-fazenda.geojson',
    }));

    assert.equal(byPropriedade.propriedade_id, 'prop_fallback');
    assert.equal(byPropriedade.fazenda_id, 'prop_fallback');
    assert.equal(byFazenda.propriedade_id, 'fazenda_fallback');
    assert.equal(byFazenda.fazenda_id, 'fazenda_fallback');
  });

  await test('busca por ID e lista por Propriedade sem vazar dados de outra Propriedade', async () => {
    const { service } = createService();
    const first = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_a',
      arquivo_nome_original: 'a.geojson',
    }));
    await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_b',
      arquivo_nome_original: 'b.geojson',
    }));

    assert.equal((await service.getGeoJsonImportById(first.id)).arquivo_nome_original, 'a.geojson');
    assert.deepEqual(
      (await service.listGeoJsonImportsByPropriedade('prop_a')).map((item) => item.arquivo_nome_original),
      ['a.geojson']
    );
    assert.deepEqual(
      (await service.listGeoJsonImportsByPropriedade('prop_b')).map((item) => item.arquivo_nome_original),
      ['b.geojson']
    );
  });

  await test('marcacao como ativo preserva somente um ativo por Propriedade', async () => {
    const { service } = createService();
    const first = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_ativo',
      arquivo_nome_original: 'primeiro.geojson',
    }));
    const second = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_ativo',
      arquivo_nome_original: 'segundo.geojson',
    }));

    await service.markGeoJsonImportAsActive(first.id);
    assert.equal((await service.getActiveGeoJsonImportForPropriedade('prop_ativo')).id, first.id);

    await service.markGeoJsonImportAsActive(second.id);
    const active = await service.getActiveGeoJsonImportForPropriedade('prop_ativo');
    const updatedFirst = await service.getGeoJsonImportById(first.id);
    const updatedSecond = await service.getGeoJsonImportById(second.id);

    assert.equal(active.id, second.id);
    assert.equal(updatedFirst.status, 'substituido');
    assert.equal(updatedSecond.status, 'ativo');
  });

  await test('metadado removido nao volta como ativo', async () => {
    const { service } = createService();
    const created = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_remove',
      status: 'ativo',
      arquivo_nome_original: 'ativo.geojson',
    }));

    assert.equal((await service.getActiveGeoJsonImportForPropriedade('prop_remove')).id, created.id);
    await service.markGeoJsonImportAsRemoved(created.id);
    assert.equal(await service.getActiveGeoJsonImportForPropriedade('prop_remove'), null);
    assert.equal((await service.getGeoJsonImportById(created.id)).status, 'removido');
  });

  await test('update preserva id e importado_em e altera atualizado_em', async () => {
    const { service } = createService();
    const created = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_update',
      arquivo_nome_original: 'original.geojson',
    }));

    const updated = await service.updateGeoJsonImportMetadata(created.id, {
      arquivo_nome_original: 'renomeado.geojson',
      talhoes_count: 5,
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.importado_em, created.importado_em);
    assert.notEqual(updated.atualizado_em, created.atualizado_em);
    assert.equal(updated.arquivo_nome_original, 'renomeado.geojson');
    assert.equal(updated.talhoes_count, 5);
  });

  await test('delete remove somente o metadado', async () => {
    const { service } = createService();
    const created = await service.createGeoJsonImportMetadata(baseInput());

    assert.equal(await service.deleteGeoJsonImportMetadata(created.id), true);
    assert.equal(await service.getGeoJsonImportById(created.id), null);
    assert.equal(await service.deleteGeoJsonImportMetadata(created.id), false);
  });

  await test('JSON corrompido nao derruba e pode ser sobrescrito com lista nova', async () => {
    const { service, storage } = createService();
    storage.values.set(GEOJSON_IMPORT_STORAGE_KEY, '{json invalido');

    assert.deepEqual(await service.listGeoJsonImports(), []);

    const created = await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_pos_corrupto',
    }));
    assert.equal(created.propriedade_id, 'prop_pos_corrupto');
    assert.equal(readSnapshot(storage).imports.length, 1);
  });

  await test('nao salva FeatureCollection, features, coordinates ou poligonos no indice', async () => {
    const { service, storage } = createService();
    await service.createGeoJsonImportMetadata(baseInput({
      geojson: { type: 'FeatureCollection', features: [{ id: 'f1' }] },
      features: [{ type: 'Feature' }],
      coordinates: [[[-55, -10]]],
      poligono: [{ lat: -10, lng: -55 }],
      poligonos: [[{ lat: -10, lng: -55 }]],
    }));

    const raw = storage.values.get(GEOJSON_IMPORT_STORAGE_KEY);
    assert.equal(raw.includes('FeatureCollection'), false);
    assert.equal(raw.includes('"features"'), false);
    assert.equal(raw.includes('"coordinates"'), false);
    assert.equal(raw.includes('"poligono"'), false);
    assert.equal(raw.includes('"poligonos"'), false);
  });

  await test('metadados podem ser listados por fazenda_id legado', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(baseInput({
      propriedade_id: 'prop_duplo',
      fazenda_id: 'fazenda_dupla',
      arquivo_nome_original: 'duplo.geojson',
    }));

    assert.equal((await service.listGeoJsonImportsByPropriedade('prop_duplo')).length, 1);
    assert.equal((await service.listGeoJsonImportsByPropriedade('fazenda_dupla')).length, 1);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de GeoJsonImportService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
