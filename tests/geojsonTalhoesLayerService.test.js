const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  createGeoJsonImportService,
  GEOJSON_IMPORT_STORAGE_KEY,
} = require('../.tmp-domain-compat/src/services/GeoJsonImportService');
const {
  loadGeoJsonTalhoesLayer,
  resolveEffectiveTalhoesLayer,
  isGeoJsonTalhoesLayerActive,
  isGeoJsonTalhoesLayerFallback,
} = require('../.tmp-domain-compat/src/services/GeoJsonTalhoesLayerService');
const {
  validateAndNormalizeGeoJson,
} = require('../.tmp-domain-compat/src/utils/geojsonImportValidator');

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

const ring = (lng = -55, lat = -10) => [
  [lng, lat],
  [lng - 0.1, lat],
  [lng - 0.1, lat - 0.1],
  [lng, lat],
];

const validGeoJsonString = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        talhao: 'T01',
        area_hectares: 10,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring()],
      },
    },
    {
      type: 'Feature',
      properties: {
        nome: 'T02',
        area_ha: 5.5,
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[ring(-56, -11)], [ring(-57, -12)]],
      },
    },
  ],
});

const seedTalhoes = [
  {
    id: 'seed_1',
    fazenda_id: 'prop_a',
    produtor_id: 'prop_a',
    talhao: 'Seed 01',
    nome: 'Seed 01',
    ano: 2025,
    area_hectares: 3,
    poligono: [{ lat: -10, lng: -55 }, { lat: -10, lng: -55.1 }, { lat: -10.1, lng: -55 }],
    poligonos: [[{ lat: -10, lng: -55 }, { lat: -10, lng: -55.1 }, { lat: -10.1, lng: -55 }]],
    cor: '#22C55E',
  },
];

const createMemoryStorage = () => {
  const values = new Map();
  const calls = {
    getItem: [],
    setItem: [],
    removeItem: [],
  };

  return {
    values,
    calls,
    adapter: {
      getItem: async (key) => {
        calls.getItem.push(key);
        return values.get(key) ?? null;
      },
      setItem: async (key, value) => {
        calls.setItem.push({ key, value });
        values.set(key, value);
      },
      removeItem: async (key) => {
        calls.removeItem.push(key);
        values.delete(key);
      },
    },
  };
};

const createService = () => {
  const storage = createMemoryStorage();
  let timestampIndex = 0;
  const timestamps = [
    '2026-06-05T12:00:00.000Z',
    '2026-06-05T12:00:01.000Z',
    '2026-06-05T12:00:02.000Z',
    '2026-06-05T12:00:03.000Z',
  ];
  const service = createGeoJsonImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)],
    generateId: () => 'id_servico',
  });

  return { service, storage };
};

const activeInput = (overrides = {}) => ({
  id: 'import_a',
  propriedade_id: 'prop_a',
  fazenda_id: 'fazenda_a',
  nome_propriedade: 'Propriedade A',
  arquivo_nome_original: 'limites-a.geojson',
  arquivo_uri_local: 'file:///app/tche-geojson-imports/prop_a/import-a.geojson',
  status: 'ativo',
  talhoes_count: 2,
  polygon_parts_count: 3,
  geometry_types: ['Polygon', 'MultiPolygon'],
  ano: 2025,
  safra: '2025/2026',
  ...overrides,
});

const createValidateStoredOk = (calls) => async (uri, options) => {
  calls.validate.push({ uri, options });
  return {
    ok: true,
    validation: validateAndNormalizeGeoJson(validGeoJsonString, options),
  };
};

const run = async () => {
  await test('sem GeoJSON ativo retorna vazio para a tela usar seed', async () => {
    const { service } = createService();
    const calls = { validate: [] };
    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_sem_local',
      fazenda_id: 'prop_sem_local',
    }, {
      importService: service,
      validateStoredGeoJson: createValidateStoredOk(calls),
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, 'sem_geojson_ativo');
    assert.deepEqual(result.talhoes, []);
    assert.equal(calls.validate.length, 0);

    const effective = resolveEffectiveTalhoesLayer(seedTalhoes, result);
    assert.equal(effective.source, 'seed');
    assert.deepEqual(effective.talhoes, seedTalhoes);
  });

  await test('GeoJSON ativo valido retorna talhoes normalizados em runtime', async () => {
    const { service, storage } = createService();
    await service.createGeoJsonImportMetadata(activeInput());
    const setCallsBeforeLoad = storage.calls.setItem.length;
    const calls = { validate: [] };

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
      fazenda_id: 'fazenda_a',
      produtor_id: 'titular_a',
    }, {
      importService: service,
      validateStoredGeoJson: createValidateStoredOk(calls),
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, 'geojson_local_ativo');
    assert.equal(result.metadata.id, 'import_a');
    assert.equal(result.talhoes.length, 2);
    assert.equal(result.talhoes[0].propriedade_id, 'prop_a');
    assert.equal(Object.prototype.hasOwnProperty.call(result.talhoes[0], 'fazenda_id'), false);
    assert.equal(result.talhoes[0].talhao, 'T01');
    assert.equal(result.talhoes[0].poligono.length >= 4, true);
    assert.equal(result.talhoes[1].poligonos.length, 2);
    assert.equal(calls.validate[0].uri, 'file:///app/tche-geojson-imports/prop_a/import-a.geojson');
    assert.equal(calls.validate[0].options.propriedade_id, 'prop_a');
    assert.equal(Object.prototype.hasOwnProperty.call(calls.validate[0].options, 'fazenda_id'), false);
    assert.equal(calls.validate[0].options.ano, 2025);
    assert.equal(calls.validate[0].options.safra, '2025/2026');
    assert.equal(storage.calls.setItem.length, setCallsBeforeLoad);

    const effective = resolveEffectiveTalhoesLayer(seedTalhoes, result);
    assert.equal(effective.source, 'geojson_local');
    assert.deepEqual(effective.talhoes.map((talhao) => talhao.talhao), ['T01', 'T02']);
    assert.equal(isGeoJsonTalhoesLayerActive(result), true);
  });

  await test('GeoJSON ativo sem URI retorna erro controlado', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(activeInput({
      id: 'import_sem_uri',
      arquivo_uri_local: undefined,
    }));

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
    }, {
      importService: service,
    });

    assert.equal(result.ok, false);
    assert.equal(result.source, 'erro_geojson_local');
    assert.equal(result.error.code, 'ACTIVE_IMPORT_URI_MISSING');
    assert.equal(isGeoJsonTalhoesLayerFallback(result), true);
  });

  await test('arquivo ausente ou ilegivel retorna erro controlado com fallback seed', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(activeInput());

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
    }, {
      importService: service,
      validateStoredGeoJson: async () => ({
        ok: false,
        error: {
          code: 'READ_STORED_FILE_FAILED',
          message: 'Nao foi possivel ler o arquivo GeoJSON armazenado.',
        },
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORED_GEOJSON_FAILED');

    const effective = resolveEffectiveTalhoesLayer(seedTalhoes, result);
    assert.equal(effective.source, 'seed_fallback');
    assert.deepEqual(effective.talhoes, seedTalhoes);
  });

  await test('validacao invalida retorna erro controlado sem salvar talhoes', async () => {
    const { service, storage } = createService();
    await service.createGeoJsonImportMetadata(activeInput());
    const setCallsBeforeLoad = storage.calls.setItem.length;

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
    }, {
      importService: service,
      validateStoredGeoJson: async (_uri, options) => ({
        ok: false,
        validation: validateAndNormalizeGeoJson('{json invalido', options),
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_GEOJSON');
    assert.equal(result.talhoes.length, 0);
    assert.equal(storage.calls.setItem.length, setCallsBeforeLoad);
  });

  await test('Propriedade A nao carrega GeoJSON ativo da Propriedade B', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(activeInput({
      id: 'import_b',
      propriedade_id: 'prop_b',
      fazenda_id: 'prop_b',
      arquivo_uri_local: 'file:///app/tche-geojson-imports/prop_b/import-b.geojson',
    }));
    const calls = { validate: [] };

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
    }, {
      importService: service,
      validateStoredGeoJson: createValidateStoredOk(calls),
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, 'sem_geojson_ativo');
    assert.equal(calls.validate.length, 0);
  });

  await test('busca usa propriedade_id canônico quando aliases divergem', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(activeInput({
      propriedade_id: 'prop_duplo',
      fazenda_id: 'fazenda_dupla',
      arquivo_uri_local: 'file:///app/tche-geojson-imports/prop_duplo/import.geojson',
    }));
    const calls = { validate: [] };

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_duplo',
    }, {
      importService: service,
      validateStoredGeoJson: createValidateStoredOk(calls),
    });

    assert.equal(result.ok, true);
    assert.equal(result.metadata.propriedade_id, 'prop_duplo');
    assert.equal(calls.validate[0].options.propriedade_id, 'prop_duplo');
  });

  await test('Sela de Prata I usa fallback seed quando GeoJSON local falha', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata(activeInput({
      id: 'import_sela',
      propriedade_id: 'p_sela1',
      fazenda_id: 'p_sela1',
      arquivo_uri_local: 'file:///app/tche-geojson-imports/p_sela1/import-sela.geojson',
    }));

    const result = await loadGeoJsonTalhoesLayer({
      propriedade_id: 'p_sela1',
      fazenda_id: 'p_sela1',
    }, {
      importService: service,
      validateStoredGeoJson: async () => ({
        ok: false,
        validation: validateAndNormalizeGeoJson('{}', {
          propriedade_id: 'p_sela1',
          fazenda_id: 'p_sela1',
        }),
      }),
    });
    const effective = resolveEffectiveTalhoesLayer(seedTalhoes, result);

    assert.equal(result.ok, false);
    assert.equal(effective.source, 'seed_fallback');
    assert.deepEqual(effective.talhoes, seedTalhoes);
  });

  await test('service nao persiste talhoes normalizados nem chama atualizacao de metadados', async () => {
    const { service, storage } = createService();
    await service.createGeoJsonImportMetadata(activeInput());
    const rawBefore = storage.values.get(GEOJSON_IMPORT_STORAGE_KEY);
    const setCallsBeforeLoad = storage.calls.setItem.length;

    await loadGeoJsonTalhoesLayer({
      propriedade_id: 'prop_a',
    }, {
      importService: service,
      validateStoredGeoJson: createValidateStoredOk({ validate: [] }),
    });

    const rawAfter = storage.values.get(GEOJSON_IMPORT_STORAGE_KEY);
    assert.equal(storage.calls.setItem.length, setCallsBeforeLoad);
    assert.equal(rawAfter, rawBefore);
    assert.equal(rawAfter.includes('FeatureCollection'), false);
    assert.equal(rawAfter.includes('"features"'), false);
    assert.equal(rawAfter.includes('"coordinates"'), false);
    assert.equal(rawAfter.includes('"poligono"'), false);
    assert.equal(rawAfter.includes('"poligonos"'), false);
  });

  await test('escopo: service nao importa React, telas, mock ou update de metadados', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'GeoJsonTalhoesLayerService.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('React'), false);
    assert.equal(source.includes("from '../api/mock'"), false);
    assert.equal(source.includes('LimiteArea'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('FazendaMapaScreen'), false);
    assert.equal(source.includes('ShapeRenderer'), false);
    assert.equal(source.includes('MapaFazendaView'), false);
    assert.equal(source.includes('updateGeoJsonImportMetadata'), false);
    assert.equal(source.includes('markGeoJsonImportAsActive'), false);
    assert.equal(source.includes('setItem'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de GeoJsonTalhoesLayerService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
