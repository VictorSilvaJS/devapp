const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  GEOJSON_IMPORT_STORAGE_KEY,
  createGeoJsonImportService,
} = require('../.tmp-domain-compat/src/services/GeoJsonImportService');
const {
  canStartGeoJsonPropertyImport,
  confirmGeoJsonPropertyImport,
  importGeoJsonForPropriedade,
  isSelaPrataIPropriedade,
  prepareGeoJsonPropertyImport,
} = require('../.tmp-domain-compat/src/services/GeoJsonPropertyImportWorkflow');

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

const admin = {
  id: 'u_admin',
  nome: 'Admin Demonstracao',
  email: 'admin@example.com',
  perfil: 'admin',
};

const colaboradorRioVerde = {
  id: 'u_colab',
  nome: 'Colaborador Rio Verde',
  perfil: 'colaborador',
  sub_regioes: ['Rio Verde'],
};

const colaboradorForaDoEscopo = {
  id: 'u_colab_fora',
  nome: 'Colaborador Fora',
  perfil: 'colaborador',
  sub_regioes: ['Sorriso'],
};

const produtor = {
  id: 'u_produtor',
  nome: 'Produtor Consulta',
  perfil: 'produtor',
  produtor_id: 'titular_a',
};

const propriedadeA = {
  id: 'prop_a',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  fazenda: 'Propriedade A',
  produtor_id: 'titular_a',
  produtor_nome: 'Titular A',
  microregiao: 'Rio Verde',
};

const propriedadeB = {
  id: 'prop_b',
  propriedade_id: 'prop_b',
  fazenda_id: 'prop_b',
  fazenda: 'Propriedade B',
  produtor_id: 'titular_b',
  produtor_nome: 'Titular B',
  microregiao: 'Rio Verde',
};

const propriedadeComIdsDuplos = {
  id: 'legacy_id',
  propriedade_id: 'prop_duplo',
  fazenda_id: 'fazenda_dupla',
  fazenda: 'Propriedade Com IDs Duplos',
  produtor_id: 'titular_duplo',
  produtor_nome: 'Titular Duplo',
  microregiao: 'Rio Verde',
};

const selaDePrata = {
  id: 'p_sela1',
  propriedade_id: 'p_sela1',
  fazenda_id: 'p_sela1',
  fazenda: 'Fazenda Sela de Prata I',
  produtor_id: 'prop_sela1',
  produtor_nome: 'Titular Sela',
  microregiao: 'Rio Verde',
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

const baseFile = (overrides = {}) => ({
  uri: 'content://picker/limites.geojson',
  name: 'limites.geojson',
  size: Buffer.byteLength(validGeoJsonString, 'utf8'),
  mimeType: 'application/geo+json',
  ...overrides,
});

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
  let timestampIndex = 0;
  const timestamps = [
    '2026-06-05T12:00:00.000Z',
    '2026-06-05T12:00:01.000Z',
    '2026-06-05T12:00:02.000Z',
    '2026-06-05T12:00:03.000Z',
    '2026-06-05T12:00:04.000Z',
    '2026-06-05T12:00:05.000Z',
  ];
  const service = createGeoJsonImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)],
    generateId: () => 'id_nao_deve_ser_usado_pelo_workflow',
  });

  return { service, storage };
};

const createCopyMock = (calls, options = {}) => async (input) => {
  calls.copy.push(input);

  if (options.fail) {
    return {
      ok: false,
      error: {
        code: 'COPY_FAILED',
        message: 'Falha controlada de copia.',
      },
    };
  }

  return {
    ok: true,
    file: {
      propriedade_id: input.propriedade_id,
      fazenda_id: input.fazenda_id,
      uri: `file:///app/tche-geojson-imports/${input.propriedade_id}/${input.importId}-limites.geojson`,
      name: `${input.importId}-limites.geojson`,
      originalName: input.originalName,
      size: Buffer.byteLength(input.content || '', 'utf8'),
      copiedAt: '2026-06-05T12:00:00.000Z',
    },
  };
};

const createWorkflowDeps = ({
  service,
  importId = 'import_test_1',
  pickResult,
  content = validGeoJsonString,
  validateGeoJson,
  copyMock,
  deleteMock,
} = {}) => {
  const calls = {
    copy: [],
    delete: [],
    read: [],
  };

  return {
    calls,
    deps: {
      importService: service,
      generateImportId: () => importId,
      now: () => '2026-06-05T12:00:00.000Z',
      pickGeoJsonDocument: async () => pickResult ?? ({
        ok: true,
        file: baseFile(),
        warnings: [],
      }),
      readGeoJsonFileAsString: async (file) => {
        calls.read.push(file);
        return content;
      },
      validateGeoJson,
      copyGeoJsonToInternalStorage: copyMock ?? createCopyMock(calls),
      deleteStoredGeoJson: deleteMock ?? (async (uri) => {
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      }),
    },
  };
};

const readRawImports = (storage) => storage.values.get(GEOJSON_IMPORT_STORAGE_KEY) || '';

const fakeValidationFailed = {
  ok: false,
  errors: [{ severity: 'error', code: 'FEATURE_COLLECTION_REQUIRED', message: 'Invalido' }],
  warnings: [],
  talhoes: [],
  summary: {
    features_count: 0,
    talhoes_count: 0,
    polygon_parts_count: 0,
    geometry_types: [],
    warnings_count: 0,
    errors_count: 1,
  },
};

const run = async () => {
  await test('executa fluxo completo e salva somente metadados pequenos', async () => {
    const { service, storage } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      importId: 'import_ok_1',
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeComIdsDuplos,
      safra: '2025/2026',
      observacoes: 'Anexo local validado.',
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'import_ok_1');
    assert.equal(result.metadata.propriedade_id, 'prop_duplo');
    assert.equal(result.metadata.fazenda_id, 'fazenda_dupla');
    assert.equal(result.metadata.nome_propriedade, 'Propriedade Com IDs Duplos');
    assert.equal(result.metadata.status, 'ativo');
    assert.equal(result.metadata.arquivo_nome_original, 'limites.geojson');
    assert.equal(result.metadata.importado_por_usuario_id, 'u_admin');
    assert.equal(result.metadata.importado_por_nome, 'Admin Demonstracao');
    assert.equal(result.metadata.talhoes_count, 2);
    assert.equal(result.metadata.polygon_parts_count, 3);
    assert.deepEqual(result.metadata.geometry_types, ['MultiPolygon', 'Polygon']);
    assert.equal(result.metadata.area_total_hectares, 15.5);
    assert.equal(result.metadata.safra, '2025/2026');
    assert.equal(result.metadata.ano, 2026);
    assert.equal(calls.copy[0].content, validGeoJsonString);
    assert.equal(calls.copy[0].importId, 'import_ok_1');

    const raw = readRawImports(storage);
    assert.equal(raw.includes('FeatureCollection'), false);
    assert.equal(raw.includes('"features"'), false);
    assert.equal(raw.includes('"coordinates"'), false);
    assert.equal(raw.includes('"poligono"'), false);
    assert.equal(raw.includes('"poligonos"'), false);
  });

  await test('cancelamento do picker retorna erro controlado sem copiar', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      pickResult: {
        ok: false,
        error: { code: 'PICKER_CANCELLED', message: 'Selecao cancelada.' },
        warnings: [],
      },
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PICKER_CANCELLED');
    assert.equal(calls.copy.length, 0);
  });

  await test('arquivo com extensao invalida retorna erro controlado', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      pickResult: {
        ok: false,
        file: baseFile({ name: 'limites.zip', mimeType: 'application/zip' }),
        error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Formato invalido.' },
        warnings: [],
      },
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal(calls.copy.length, 0);
  });

  await test('validacao false retorna VALIDATION_FAILED sem persistir', async () => {
    const { service, storage } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      validateGeoJson: () => fakeValidationFailed,
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'VALIDATION_FAILED');
    assert.equal(calls.copy.length, 0);
    assert.equal(storage.values.has(GEOJSON_IMPORT_STORAGE_KEY), false);
  });

  await test('falha de storage nao cria metadado', async () => {
    const { service, storage } = createService();
    const calls = { copy: [], delete: [], read: [] };
    const { deps } = createWorkflowDeps({
      service,
      copyMock: createCopyMock(calls, { fail: true }),
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_FAILED');
    assert.equal(calls.copy.length, 1);
    assert.equal(storage.values.has(GEOJSON_IMPORT_STORAGE_KEY), false);
  });

  await test('falha de metadado apos copia remove arquivo copiado', async () => {
    const service = {
      createGeoJsonImportMetadata: async () => {
        throw new Error('metadata failed');
      },
      listGeoJsonImportsByPropriedade: async () => [],
      getActiveGeoJsonImportForPropriedade: async () => null,
    };
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_FAILED');
    assert.equal(result.rollback.attempted, true);
    assert.equal(result.rollback.ok, true);
    assert.equal(result.rollback.deleted, true);
    assert.equal(calls.delete.length, 1);
    assert.equal(calls.delete[0].includes('import_test_1-limites.geojson'), true);
  });

  await test('falha apenas na recarga de metadados nao desfaz associacao criada', async () => {
    const service = {
      createGeoJsonImportMetadata: async (input) => ({
        ...input,
        importado_em: '2026-06-05T12:00:00.000Z',
        atualizado_em: '2026-06-05T12:00:00.000Z',
        origem: 'arquivo_local',
        versao: 1,
      }),
      listGeoJsonImportsByPropriedade: async () => {
        throw new Error('list failed');
      },
      getActiveGeoJsonImportForPropriedade: async () => null,
    };
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'import_test_1');
    assert.deepEqual(result.imports.map((item) => item.id), ['import_test_1']);
    assert.equal(calls.delete.length, 0);
  });

  await test('falha de rollback retorna erro explicito de sucesso parcial evitado', async () => {
    const service = {
      createGeoJsonImportMetadata: async () => {
        throw new Error('metadata failed');
      },
      listGeoJsonImportsByPropriedade: async () => [],
      getActiveGeoJsonImportForPropriedade: async () => null,
    };
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({
        ok: false,
        deleted: false,
        error: { code: 'DELETE_FAILED', message: 'Nao removeu.' },
      }),
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ROLLBACK_FAILED');
    assert.equal(result.rollback.attempted, true);
    assert.equal(result.rollback.ok, false);
    assert.equal(Boolean(result.storedFile.uri), true);
  });

  await test('novo ativo substitui ativo anterior da mesma Propriedade', async () => {
    const { service } = createService();
    await service.createGeoJsonImportMetadata({
      id: 'import_antigo',
      propriedade_id: 'prop_sub',
      arquivo_nome_original: 'antigo.geojson',
      status: 'ativo',
    });
    const propriedadeSub = {
      ...propriedadeA,
      id: 'prop_sub',
      propriedade_id: 'prop_sub',
      fazenda_id: 'prop_sub',
    };
    const { deps } = createWorkflowDeps({
      service,
      importId: 'import_novo',
    });

    const result = await importGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeSub,
    }, deps);

    assert.equal(result.ok, true);
    const imports = await service.listGeoJsonImportsByPropriedade('prop_sub');
    const antigo = imports.find((item) => item.id === 'import_antigo');
    const novo = imports.find((item) => item.id === 'import_novo');
    assert.equal(antigo.status, 'substituido');
    assert.equal(novo.status, 'ativo');
  });

  await test('lista por Propriedade nao vaza importacoes de outra Propriedade', async () => {
    const { service } = createService();
    const depsA = createWorkflowDeps({
      service,
      importId: 'import_a',
    }).deps;
    const depsB = createWorkflowDeps({
      service,
      importId: 'import_b',
    }).deps;

    await importGeoJsonForPropriedade({ user: admin, propriedade: propriedadeA }, depsA);
    await importGeoJsonForPropriedade({ user: admin, propriedade: propriedadeB }, depsB);

    const importsA = await service.listGeoJsonImportsByPropriedade('prop_a');
    const importsB = await service.listGeoJsonImportsByPropriedade('prop_b');
    assert.deepEqual(importsA.map((item) => item.id), ['import_a']);
    assert.deepEqual(importsB.map((item) => item.id), ['import_b']);
  });

  await test('permissao de inicio respeita Admin, Colaborador no escopo e Produtor', () => {
    assert.equal(canStartGeoJsonPropertyImport(admin, propriedadeA), true);
    assert.equal(canStartGeoJsonPropertyImport(colaboradorRioVerde, propriedadeA), true);
    assert.equal(canStartGeoJsonPropertyImport(produtor, propriedadeA), false);
    assert.equal(canStartGeoJsonPropertyImport(colaboradorForaDoEscopo, propriedadeA), false);
    assert.equal(canStartGeoJsonPropertyImport(null, propriedadeA), false);
    assert.equal(canStartGeoJsonPropertyImport(admin, null), false);
  });

  await test('Sela de Prata I exige confirmacao extra antes de copiar', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      importId: 'import_sela',
    });

    assert.equal(isSelaPrataIPropriedade({ propriedade: selaDePrata }), true);

    const prepared = await prepareGeoJsonPropertyImport({
      user: admin,
      propriedade: selaDePrata,
    }, deps);

    assert.equal(prepared.ok, true);
    assert.equal(prepared.preview.resolvedContext.requiresSelaPrataConfirmation, true);

    const blocked = await confirmGeoJsonPropertyImport(prepared.preview, {}, deps);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, 'SELA_PRATA_CONFIRMATION_REQUIRED');
    assert.equal(calls.copy.length, 0);

    const confirmed = await confirmGeoJsonPropertyImport(prepared.preview, {
      selaPrataConfirmed: true,
    }, deps);
    assert.equal(confirmed.ok, true);
    assert.equal(calls.copy.length, 1);
  });

  await test('escopo do workflow nao importa telas, mocks ou entidades de mapa', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'GeoJsonPropertyImportWorkflow.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes("from '../api/mock'"), false);
    assert.equal(source.includes('LimiteArea'), false);
    assert.equal(source.includes('MapaFazendaView'), false);
    assert.equal(source.includes('ShapeRenderer'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('FazendaMapaScreen'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de GeoJsonPropertyImportWorkflow passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
