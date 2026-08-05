const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  GEOJSON_IMPORT_STORAGE_KEY,
  createGeoJsonImportService,
} = require('../.tmp-domain-compat/src/services/GeoJsonImportService');
const {
  GEOJSON_STORAGE_DIRECTORY_NAME,
} = require('../.tmp-domain-compat/src/services/GeoJsonStorageService');
const {
  prepareGeoJsonPropertyImport,
} = require('../.tmp-domain-compat/src/services/GeoJsonPropertyImportWorkflow');
const {
  canManageGeoJsonForPropriedade,
  removeActiveGeoJsonForPropriedade,
  replaceGeoJsonForPropriedade,
  shouldShowSelaPrataIRemovalWarning,
} = require('../.tmp-domain-compat/src/services/GeoJsonPropertyManageWorkflow');

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
  perfil: 'admin',
};

const colaboradorRioVerde = {
  id: 'u_colab',
  nome: 'Colaborador Rio Verde',
  perfil: 'colaborador',
  vinculos_propriedades: [
    { propriedade_id: 'prop_a', tipo_vinculo: 'colaborador', status: 'ativo' },
  ],
};

const colaboradorForaDoEscopo = {
  id: 'u_colab_fora',
  nome: 'Colaborador Fora',
  perfil: 'colaborador',
  vinculos_propriedades: [],
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
  features: [{
    type: 'Feature',
    properties: {
      talhao: 'T01',
      area_hectares: 10,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring()],
    },
  }],
});

const baseFile = (overrides = {}) => ({
  uri: 'content://picker/limites.geojson',
  name: 'limites.geojson',
  size: Buffer.byteLength(validGeoJsonString, 'utf8'),
  mimeType: 'application/geo+json',
  ...overrides,
});

const localUri = (propriedadeId, importId) =>
  `file:///app/${GEOJSON_STORAGE_DIRECTORY_NAME}/${propriedadeId}/${importId}-limites.geojson`;

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
    '2026-06-05T12:00:06.000Z',
    '2026-06-05T12:00:07.000Z',
  ];
  const service = createGeoJsonImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)],
    generateId: () => 'id_nao_deve_ser_usado_pelo_workflow',
  });

  return { service, storage };
};

const seedActive = async (service, overrides = {}) => service.createGeoJsonImportMetadata({
  id: 'import_antigo',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  arquivo_nome_original: 'antigo.geojson',
  arquivo_uri_local: localUri('prop_a', 'import_antigo'),
  status: 'ativo',
  talhoes_count: 1,
  ano: 2026,
  ...overrides,
});

const createCopyMock = (calls, options = {}) => async (input) => {
  calls.events.push('copy');
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
      uri: localUri(input.propriedade_id, input.importId),
      name: `${input.importId}-limites.geojson`,
      originalName: input.originalName,
      size: Buffer.byteLength(input.content || '', 'utf8'),
      copiedAt: '2026-06-05T12:00:00.000Z',
    },
  };
};

const createWorkflowDeps = ({
  service,
  importId = 'import_novo',
  copyMock,
  deleteMock,
} = {}) => {
  const calls = {
    copy: [],
    delete: [],
    read: [],
    events: [],
  };
  const trackedService = service
    ? {
        createGeoJsonImportMetadata: async (input) => {
          calls.events.push('create');
          return service.createGeoJsonImportMetadata(input);
        },
        listGeoJsonImportsByPropriedade: (...args) => service.listGeoJsonImportsByPropriedade(...args),
        getActiveGeoJsonImportForPropriedade: (...args) => service.getActiveGeoJsonImportForPropriedade(...args),
        markGeoJsonImportAsRemoved: (...args) => service.markGeoJsonImportAsRemoved(...args),
      }
    : undefined;

  return {
    calls,
    deps: {
      importService: trackedService,
      generateImportId: () => importId,
      now: () => '2026-06-05T12:00:00.000Z',
      pickGeoJsonDocument: async () => ({
        ok: true,
        file: baseFile(),
        warnings: [],
      }),
      readGeoJsonFileAsString: async (file) => {
        calls.read.push(file);
        return validGeoJsonString;
      },
      copyGeoJsonToInternalStorage: copyMock ?? createCopyMock(calls),
      deleteStoredGeoJson: deleteMock ?? (async (uri) => {
        calls.events.push('delete');
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      }),
    },
  };
};

const preparePreview = async ({ service, propriedade = propriedadeA, deps }) => {
  const prepared = await prepareGeoJsonPropertyImport({
    user: admin,
    propriedade,
  }, deps);

  assert.equal(prepared.ok, true);
  assert.ok(prepared.preview);
  return prepared.preview;
};

const readRawImports = (storage) => storage.values.get(GEOJSON_IMPORT_STORAGE_KEY) || '';

const createFileSystem = () => {
  const calls = {
    getInfo: [],
    delete: [],
  };
  return {
    calls,
    adapter: {
      documentDirectory: 'file:///app/',
      EncodingType: { UTF8: 'utf8' },
      getInfoAsync: async (uri) => {
        calls.getInfo.push(uri);
        return { exists: true, isDirectory: false };
      },
      makeDirectoryAsync: async () => undefined,
      copyAsync: async () => undefined,
      writeAsStringAsync: async () => undefined,
      readAsStringAsync: async () => validGeoJsonString,
      deleteAsync: async (uri) => {
        calls.delete.push(uri);
      },
    },
  };
};

const run = async () => {
  await test('permissao de gestao respeita Admin, Colaborador no escopo e Produtor', () => {
    assert.equal(canManageGeoJsonForPropriedade(admin, propriedadeA), true);
    assert.equal(canManageGeoJsonForPropriedade(colaboradorRioVerde, propriedadeA), true);
    assert.equal(canManageGeoJsonForPropriedade(produtor, propriedadeA), false);
    assert.equal(canManageGeoJsonForPropriedade(colaboradorForaDoEscopo, propriedadeA), false);
    assert.equal(canManageGeoJsonForPropriedade(null, propriedadeA), false);
  });

  await test('Admin pode remover GeoJSON ativo e apagar arquivo local', async () => {
    const { service } = createService();
    await seedActive(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, true);
    assert.equal(calls.delete.length, 1);
    assert.equal(await service.getActiveGeoJsonImportForPropriedade('prop_a'), null);
  });

  await test('Colaborador dentro do escopo pode remover GeoJSON ativo', async () => {
    const { service } = createService();
    await seedActive(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removeActiveGeoJsonForPropriedade({
      user: colaboradorRioVerde,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(calls.delete.length, 1);
  });

  await test('Produtor e Colaborador fora do escopo nao podem remover', async () => {
    const { service } = createService();
    await seedActive(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const blockedProdutor = await removeActiveGeoJsonForPropriedade({
      user: produtor,
      propriedade: propriedadeA,
    }, deps);
    const blockedColaborador = await removeActiveGeoJsonForPropriedade({
      user: colaboradorForaDoEscopo,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(blockedProdutor.ok, false);
    assert.equal(blockedProdutor.error.code, 'MANAGE_NOT_ALLOWED');
    assert.equal(blockedColaborador.ok, false);
    assert.equal(blockedColaborador.error.code, 'MANAGE_NOT_ALLOWED');
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getActiveGeoJsonImportForPropriedade('prop_a')).status, 'ativo');
  });

  await test('remover sem ativo retorna erro controlado', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ACTIVE_IMPORT_NOT_FOUND');
    assert.equal(calls.delete.length, 0);
  });

  await test('metadado ativo sem URI e removido com warning controlado', async () => {
    const { service } = createService();
    await seedActive(service, { arquivo_uri_local: undefined });
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'ACTIVE_IMPORT_URI_MISSING');
    assert.equal(calls.delete.length, 0);
  });

  await test('arquivo inexistente nao derruba a remocao', async () => {
    const { service } = createService();
    await seedActive(service);
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({ ok: true, deleted: false }),
    });

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'ACTIVE_FILE_ALREADY_MISSING');
    assert.equal(await service.getActiveGeoJsonImportForPropriedade('prop_a'), null);
  });

  await test('path fora do diretorio seguro e recusado sem apagar arquivo externo', async () => {
    const { service } = createService();
    await seedActive(service, { arquivo_uri_local: 'file:///app/outro.geojson' });
    const fileSystem = createFileSystem();
    const { deps } = createWorkflowDeps({ service });
    deps.deleteStoredGeoJson = undefined;
    deps.storageDeps = { fileSystem: fileSystem.adapter };

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'ACTIVE_FILE_DELETE_FAILED');
    assert.equal(fileSystem.calls.delete.length, 0);
  });

  await test('Propriedade A nao remove GeoJSON da Propriedade B', async () => {
    const { service } = createService();
    await seedActive(service, {
      id: 'import_b',
      propriedade_id: 'prop_b',
      fazenda_id: 'prop_b',
      arquivo_uri_local: localUri('prop_b', 'import_b'),
    });
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ACTIVE_IMPORT_NOT_FOUND');
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getActiveGeoJsonImportForPropriedade('prop_b')).status, 'ativo');
  });

  await test('Sela de Prata I remove apenas arquivo local e preserva seed', async () => {
    const { service } = createService();
    await seedActive(service, {
      id: 'import_sela',
      propriedade_id: 'p_sela1',
      fazenda_id: 'p_sela1',
      arquivo_uri_local: localUri('p_sela1', 'import_sela'),
    });
    const { calls, deps } = createWorkflowDeps({ service });

    assert.equal(shouldShowSelaPrataIRemovalWarning({ propriedade: selaDePrata }), true);

    const result = await removeActiveGeoJsonForPropriedade({
      user: admin,
      propriedade: selaDePrata,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(calls.delete.length, 1);
    assert.equal(calls.delete[0].includes(`${GEOJSON_STORAGE_DIRECTORY_NAME}/p_sela1/`), true);
    assert.equal(await service.getActiveGeoJsonImportForPropriedade('p_sela1'), null);
  });

  await test('substituir cria novo ativo e move ativo anterior para substituido', async () => {
    const { service } = createService();
    await seedActive(service);
    const { calls, deps } = createWorkflowDeps({ service, importId: 'import_novo' });
    const preview = await preparePreview({ service, deps });

    const result = await replaceGeoJsonForPropriedade(preview, {
      selaPrataConfirmed: true,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'import_novo');
    assert.equal(result.deletedPreviousFile, true);
    assert.equal(calls.delete.length, 1);

    const imports = await service.listGeoJsonImportsByPropriedade('prop_a');
    const antigo = imports.find((item) => item.id === 'import_antigo');
    const novo = imports.find((item) => item.id === 'import_novo');
    assert.equal(antigo.status, 'substituido');
    assert.equal(novo.status, 'ativo');
  });

  await test('substituicao nao apaga antigo antes de novo ativo existir', async () => {
    const { service } = createService();
    await seedActive(service);
    const { calls, deps } = createWorkflowDeps({ service, importId: 'import_novo' });
    const preview = await preparePreview({ service, deps });

    const result = await replaceGeoJsonForPropriedade(preview, {}, deps);

    assert.equal(result.ok, true);
    assert.deepEqual(calls.events, ['copy', 'create', 'delete']);
  });

  await test('falha de novo arquivo mantem ativo anterior e nao apaga antigo', async () => {
    const { service } = createService();
    await seedActive(service);
    const calls = { copy: [], delete: [], read: [], events: [] };
    const { deps } = createWorkflowDeps({
      service,
      importId: 'import_falha',
      copyMock: createCopyMock(calls, { fail: true }),
    });
    const preview = await preparePreview({ service, deps });

    const result = await replaceGeoJsonForPropriedade(preview, {}, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_FAILED');
    assert.equal(calls.delete.length, 0);
    const active = await service.getActiveGeoJsonImportForPropriedade('prop_a');
    assert.equal(active.id, 'import_antigo');
    assert.equal(active.status, 'ativo');
  });

  await test('falha ao apagar antigo apos substituicao retorna warning controlado', async () => {
    const { service } = createService();
    await seedActive(service);
    const { deps } = createWorkflowDeps({
      service,
      importId: 'import_novo',
      deleteMock: async () => ({
        ok: false,
        deleted: false,
        error: { code: 'DELETE_FAILED', message: 'Falha ao apagar antigo.' },
      }),
    });
    const preview = await preparePreview({ service, deps });

    const result = await replaceGeoJsonForPropriedade(preview, {}, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'import_novo');
    assert.equal(result.warnings[0].code, 'PREVIOUS_FILE_DELETE_FAILED');
    const imports = await service.listGeoJsonImportsByPropriedade('prop_a');
    assert.equal(imports.find((item) => item.id === 'import_antigo').status, 'substituido');
    assert.equal(imports.find((item) => item.id === 'import_novo').status, 'ativo');
  });

  await test('nao salva GeoJSON bruto nem altera snapshot mock', async () => {
    const { service, storage } = createService();
    await seedActive(service);
    const { deps } = createWorkflowDeps({ service, importId: 'import_novo' });
    const preview = await preparePreview({ service, deps });

    const result = await replaceGeoJsonForPropriedade(preview, {}, deps);
    assert.equal(result.ok, true);

    const raw = readRawImports(storage);
    assert.equal(raw.includes('FeatureCollection'), false);
    assert.equal(raw.includes('"features"'), false);
    assert.equal(raw.includes('"coordinates"'), false);
    assert.equal(raw.includes('"poligono"'), false);
    assert.equal(raw.includes('"poligonos"'), false);
    assert.equal(storage.values.has('@tche:mock-mvp:v1'), false);
  });

  await test('escopo do workflow nao importa telas, LimiteArea, mocks ou assets', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'GeoJsonPropertyManageWorkflow.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes("from '../api/mock'"), false);
    assert.equal(source.includes('LimiteArea'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('FazendaMapaScreen'), false);
    assert.equal(source.includes('ShapeRenderer'), false);
    assert.equal(source.includes('MapaFazendaView'), false);
    assert.equal(source.includes('selaDePrata1Talhoes'), false);
    assert.equal(source.includes('data/processados'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de GeoJsonPropertyManageWorkflow passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
