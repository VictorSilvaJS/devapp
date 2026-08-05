const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PNG_MAP_IMPORT_STORAGE_KEY,
  createPngMapImportService,
} = require('../.tmp-domain-compat/src/services/PngMapImportService');
const {
  PNG_STORAGE_DIRECTORY_NAME,
} = require('../.tmp-domain-compat/src/services/PngStorageService');
const {
  canManagePngMapForPropriedade,
  canManagePngMapItem,
  removePngMapForPropriedade,
  replacePngMapForPropriedade,
} = require('../.tmp-domain-compat/src/services/PngMapPropertyManageWorkflow');

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

const pickedFile = (overrides = {}) => ({
  uri: 'content://picker/novo.png',
  name: 'Novo mapa.PNG',
  size: 2048,
  mimeType: 'image/png',
  ...overrides,
});

const localUri = (propriedadeId, importId, name = 'mapa.png') =>
  `file:///app/${PNG_STORAGE_DIRECTORY_NAME}/${propriedadeId}/${importId}-${name}`;

const baseMetadataInput = (overrides = {}) => ({
  id: 'png_antigo',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  nome_propriedade: 'Propriedade A',
  titulo: 'Mapa pH local',
  descricao: 'Observacao preservada.',
  categoria: 'fertilidade',
  categoria_label: 'Fertilidade',
  elemento: 'ph',
  elemento_label: 'pH',
  safra: '2025/2026',
  ano: 2026,
  profundidade: '10-20 cm',
  escopo: 'talhao',
  talhao_id: 'T01',
  talhao_nome: 'Talhao 01',
  arquivo_nome_original: 'antigo.png',
  arquivo_uri_local: localUri('prop_a', 'png_antigo', 'antigo.png'),
  arquivo_tamanho_bytes: 1234,
  arquivo_mime: 'image/png',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
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
    '2026-06-06T12:00:00.000Z',
    '2026-06-06T12:00:01.000Z',
    '2026-06-06T12:00:02.000Z',
    '2026-06-06T12:00:03.000Z',
    '2026-06-06T12:00:04.000Z',
    '2026-06-06T12:00:05.000Z',
    '2026-06-06T12:00:06.000Z',
    '2026-06-06T12:00:07.000Z',
  ];
  const service = createPngMapImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)],
    generateId: () => 'id_nao_deve_ser_usado_pelo_workflow',
  });

  return { service, storage };
};

const seedPng = async (service, overrides = {}) =>
  service.createPngMapImportMetadata(baseMetadataInput(overrides));

const createCopyMock = (calls, options = {}) => async (input) => {
  calls.events.push('copy');
  calls.copy.push(input);

  if (options.fail) {
    return {
      ok: false,
      error: {
        code: 'PNG_COPY_FAILED',
        message: 'Falha controlada de copia.',
      },
    };
  }

  return {
    ok: true,
    file: {
      propriedade_id: input.propriedade_id,
      fazenda_id: input.fazenda_id,
      uri: localUri(input.propriedade_id, input.importId, 'novo-mapa.png'),
      name: `${input.importId}-novo-mapa.png`,
      originalName: input.originalName,
      size: options.size ?? 4096,
      mimeType: 'image/png',
      copiedAt: '2026-06-06T12:00:00.000Z',
    },
  };
};

const createWorkflowDeps = ({
  service,
  importId = 'png_novo',
  copyMock,
  deleteMock,
  pickMock,
  serviceOverrides = {},
} = {}) => {
  const calls = {
    copy: [],
    delete: [],
    events: [],
  };
  const trackedService = service
    ? {
        createPngMapImportMetadata: async (input) => {
          calls.events.push('create');
          if (serviceOverrides.createPngMapImportMetadata) {
            return serviceOverrides.createPngMapImportMetadata(input);
          }
          return service.createPngMapImportMetadata(input);
        },
        getPngMapImportById: async (...args) => {
          if (serviceOverrides.getPngMapImportById) {
            return serviceOverrides.getPngMapImportById(...args);
          }
          return service.getPngMapImportById(...args);
        },
        listActivePngMapImportsByPropriedade: (...args) =>
          service.listActivePngMapImportsByPropriedade(...args),
        markPngMapImportAsSubstituido: async (...args) => {
          calls.events.push('mark_substituido');
          if (serviceOverrides.markPngMapImportAsSubstituido) {
            return serviceOverrides.markPngMapImportAsSubstituido(...args);
          }
          return service.markPngMapImportAsSubstituido(...args);
        },
        markPngMapImportAsRemoved: async (...args) => {
          calls.events.push('mark_removed');
          if (serviceOverrides.markPngMapImportAsRemoved) {
            return serviceOverrides.markPngMapImportAsRemoved(...args);
          }
          return service.markPngMapImportAsRemoved(...args);
        },
      }
    : undefined;

  return {
    calls,
    deps: {
      importService: trackedService,
      generateImportId: () => importId,
      pickPngDocument: pickMock ?? (async () => ({
        ok: true,
        file: pickedFile(),
        warnings: [],
        errors: [],
      })),
      copyPngToInternalStorage: copyMock ?? createCopyMock(calls),
      deleteStoredPng: deleteMock ?? (async (uri) => {
        calls.events.push('delete');
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      }),
    },
  };
};

const readRawImports = (storage) => storage.values.get(PNG_MAP_IMPORT_STORAGE_KEY) || '';

const createFileSystem = () => {
  const calls = {
    getInfo: [],
    delete: [],
  };
  return {
    calls,
    adapter: {
      documentDirectory: 'file:///app/',
      getInfoAsync: async (uri) => {
        calls.getInfo.push(uri);
        return { exists: true, isDirectory: false };
      },
      makeDirectoryAsync: async () => undefined,
      copyAsync: async () => undefined,
      deleteAsync: async (uri) => {
        calls.delete.push(uri);
      },
    },
  };
};

const pngLocalMapa = (metadata) => ({
  id: `png_local:${metadata.id}`,
  titulo: metadata.titulo,
  tipo_anexo: 'anexo_png_local',
  origem: 'arquivo_local',
  formato_arquivo: 'png',
  arquivo_uri_local: metadata.arquivo_uri_local,
  png_map_import_id: metadata.id,
  is_png_local: true,
});

const assetMapa = {
  id: 'm_sela1_ph_10a20_2025',
  titulo: 'pH - Fazenda Sela de Prata I',
  categoria: 'fertilidade',
  tipo_anexo: 'anexo_fertilidade',
  formato_arquivo: 'png',
  origem: 'drive_importado',
  arquivo_url: 'asset://mapas/sela-prata-i/2025/fertilidade/ph_10a20.png',
};

const run = async () => {
  await test('permissao de gestao respeita Admin, Colaborador no escopo e Produtor', () => {
    const mapa = pngLocalMapa(baseMetadataInput());

    assert.equal(canManagePngMapForPropriedade(admin, propriedadeA), true);
    assert.equal(canManagePngMapForPropriedade(colaboradorRioVerde, propriedadeA), true);
    assert.equal(canManagePngMapForPropriedade(produtor, propriedadeA), false);
    assert.equal(canManagePngMapForPropriedade(colaboradorForaDoEscopo, propriedadeA), false);
    assert.equal(canManagePngMapForPropriedade(admin, null), false);
    assert.equal(canManagePngMapItem(admin, propriedadeA, mapa), true);
    assert.equal(canManagePngMapItem(produtor, propriedadeA, mapa), false);
    assert.equal(canManagePngMapItem(admin, propriedadeA, assetMapa), false);
  });

  await test('Admin pode substituir PNG local', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'png_novo');
    assert.equal(result.previousMetadata.status, 'substituido');
    assert.equal(result.deletedPreviousFile, true);
    assert.deepEqual(calls.events, ['copy', 'create', 'mark_substituido', 'delete']);
  });

  await test('Colaborador autorizado pode substituir PNG local', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { deps } = createWorkflowDeps({ service, importId: 'png_colab' });

    const result = await replacePngMapForPropriedade({
      user: colaboradorRioVerde,
      propriedade: propriedadeA,
      metadataId: previous.id,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'png_colab');
    assert.equal(result.previousMetadata.status, 'substituido');
  });

  await test('Produtor nao pode substituir PNG local', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await replacePngMapForPropriedade({
      user: produtor,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'MANAGE_NOT_ALLOWED');
    assert.equal(calls.copy.length, 0);
    assert.equal((await service.getPngMapImportById(previous.id)).status, 'ativo');
  });

  await test('Admin pode remover PNG local', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, true);
    assert.equal(calls.delete.length, 1);
    assert.deepEqual(await service.listActivePngMapImportsByPropriedade('prop_a'), []);
  });

  await test('Colaborador autorizado pode remover PNG local', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removePngMapForPropriedade({
      user: colaboradorRioVerde,
      propriedade: propriedadeA,
      metadataId: active.id,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(calls.delete.length, 1);
  });

  await test('Produtor nao pode remover PNG local', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removePngMapForPropriedade({
      user: produtor,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'MANAGE_NOT_ALLOWED');
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getPngMapImportById(active.id)).status, 'ativo');
  });

  await test('item asset/mockado nao pode ser substituido/removido', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({ service });

    const replaceResult = await replacePngMapForPropriedade({
      user: admin,
      propriedade: selaDePrata,
      mapa: assetMapa,
    }, deps);
    const removeResult = await removePngMapForPropriedade({
      user: admin,
      propriedade: selaDePrata,
      mapa: assetMapa,
    }, deps);

    assert.equal(replaceResult.ok, false);
    assert.equal(replaceResult.error.code, 'PNG_IMPORT_NOT_LOCAL');
    assert.equal(removeResult.ok, false);
    assert.equal(removeResult.error.code, 'PNG_IMPORT_NOT_LOCAL');
    assert.equal(calls.copy.length, 0);
    assert.equal(calls.delete.length, 0);
  });

  await test('sem contexto de Propriedade bloqueia', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { deps } = createWorkflowDeps({ service });

    const result = await removePngMapForPropriedade({
      user: admin,
      propriedade: null,
      metadata: active,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PROPRIEDADE_ID_REQUIRED');
  });

  await test('substituicao cria novo ativo e marca anterior como substituido', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { deps } = createWorkflowDeps({ service, importId: 'png_novo' });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);

    const imports = await service.listPngMapImportsByPropriedade('prop_a');
    assert.equal(imports.find((item) => item.id === 'png_antigo').status, 'substituido');
    assert.equal(imports.find((item) => item.id === 'png_novo').status, 'ativo');
  });

  await test('substituicao preserva metadados principais e troca arquivo', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { deps } = createWorkflowDeps({
      service,
      importId: 'png_novo',
      pickMock: async () => ({
        ok: true,
        file: pickedFile({
          name: 'Mapa substituto.png',
          size: 9000,
          mimeType: 'image/png',
        }),
        errors: [],
        warnings: [],
      }),
      copyMock: async (input) => ({
        ok: true,
        file: {
          propriedade_id: input.propriedade_id,
          fazenda_id: input.fazenda_id,
          uri: localUri(input.propriedade_id, input.importId, 'substituto.png'),
          name: `${input.importId}-substituto.png`,
          originalName: input.originalName,
          size: 9000,
          mimeType: 'image/png',
          copiedAt: '2026-06-06T12:00:00.000Z',
        },
      }),
    });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.titulo, previous.titulo);
    assert.equal(result.metadata.categoria, previous.categoria);
    assert.equal(result.metadata.categoria_label, previous.categoria_label);
    assert.equal(result.metadata.elemento_label, previous.elemento_label);
    assert.equal(result.metadata.escopo, previous.escopo);
    assert.equal(result.metadata.talhao_id, previous.talhao_id);
    assert.equal(result.metadata.talhao_nome, previous.talhao_nome);
    assert.equal(result.metadata.safra, previous.safra);
    assert.equal(result.metadata.ano, previous.ano);
    assert.equal(result.metadata.profundidade, previous.profundidade);
    assert.equal(result.metadata.visivel_para_produtor, previous.visivel_para_produtor);
    assert.equal(result.metadata.descricao, previous.descricao);
    assert.equal(result.metadata.arquivo_nome_original, 'Mapa substituto.png');
    assert.equal(result.metadata.arquivo_uri_local.includes('substituto.png'), true);
    assert.equal(result.metadata.arquivo_tamanho_bytes, 9000);
    assert.equal(result.metadata.arquivo_mime, 'image/png');
  });

  await test('falha na copia mantem anterior ativo', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const calls = { copy: [], delete: [], events: [] };
    const { deps } = createWorkflowDeps({
      service,
      copyMock: createCopyMock(calls, { fail: true }),
    });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_FAILED');
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getPngMapImportById(previous.id)).status, 'ativo');
  });

  await test('falha ao criar metadado novo mantem anterior ativo e remove copia', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({
      service,
      serviceOverrides: {
        createPngMapImportMetadata: async () => {
          throw new Error('falha controlada');
        },
      },
    });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_CREATE_FAILED');
    assert.equal(result.rollback.ok, true);
    assert.equal(calls.delete.length, 1);
    assert.equal((await service.getPngMapImportById(previous.id)).status, 'ativo');
  });

  await test('falha ao marcar antigo como substituido faz rollback do novo PNG', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({
      service,
      serviceOverrides: {
        markPngMapImportAsSubstituido: async () => {
          throw new Error('falha ao substituir');
        },
      },
    });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_REPLACE_FAILED');
    assert.equal(result.rollback.ok, true);
    assert.equal(calls.delete.length, 1);
    assert.equal((await service.getPngMapImportById(previous.id)).status, 'ativo');
    assert.equal((await service.getPngMapImportById('png_novo')).status, 'removido');
  });

  await test('falha ao remover arquivo antigo retorna warning', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({
        ok: false,
        deleted: false,
        error: { code: 'PNG_DELETE_FAILED', message: 'Falha ao apagar antigo.' },
      }),
    });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.warnings[0].code, 'PREVIOUS_FILE_DELETE_FAILED');
    assert.equal((await service.getPngMapImportById(previous.id)).status, 'substituido');
  });

  await test('remocao marca metadado como removido e chama deleteStoredPng', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await removePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(calls.delete[0], active.arquivo_uri_local);
  });

  await test('arquivo inexistente nao derruba remocao', async () => {
    const { service } = createService();
    const active = await seedPng(service);
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({
        ok: true,
        deleted: false,
      }),
    });

    const result = await removePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'REMOVED_FILE_ALREADY_MISSING');
  });

  await test('path inseguro e recusado pelo storage sem apagar arquivo externo', async () => {
    const { service } = createService();
    const active = await seedPng(service, {
      arquivo_uri_local: 'file:///app/outro-diretorio/mapa.png',
    });
    const fileSystem = createFileSystem();
    const { deps } = createWorkflowDeps({ service });
    deps.deleteStoredPng = undefined;
    deps.storageDeps = { fileSystem: fileSystem.adapter };

    const result = await removePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'REMOVED_FILE_DELETE_FAILED');
    assert.equal(fileSystem.calls.delete.length, 0);
  });

  await test('Propriedade A nao remove ou substitui PNG da Propriedade B', async () => {
    const { service } = createService();
    const activeB = await seedPng(service, {
      id: 'png_b',
      propriedade_id: 'prop_b',
      fazenda_id: 'prop_b',
      arquivo_uri_local: localUri('prop_b', 'png_b', 'mapa-b.png'),
    });
    const { calls, deps } = createWorkflowDeps({ service });

    const removeResult = await removePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: activeB,
    }, deps);
    const replaceResult = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: activeB,
    }, deps);

    assert.equal(removeResult.ok, false);
    assert.equal(removeResult.error.code, 'PNG_IMPORT_OUT_OF_SCOPE');
    assert.equal(replaceResult.ok, false);
    assert.equal(replaceResult.error.code, 'PNG_IMPORT_OUT_OF_SCOPE');
    assert.equal(calls.copy.length, 0);
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getPngMapImportById(activeB.id)).status, 'ativo');
  });

  await test('Sela de Prata I preserva PNGs asset/mockados e permite gerir somente PNG local', async () => {
    const { service } = createService();
    const local = await seedPng(service, {
      id: 'png_sela_local',
      propriedade_id: 'p_sela1',
      fazenda_id: 'p_sela1',
      arquivo_uri_local: localUri('p_sela1', 'png_sela_local', 'local.png'),
    });
    const { calls, deps } = createWorkflowDeps({ service, importId: 'png_sela_novo' });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: selaDePrata,
      metadata: local,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'png_sela_novo');
    assert.equal(calls.delete[0].includes(`${PNG_STORAGE_DIRECTORY_NAME}/p_sela1/`), true);
    assert.equal(canManagePngMapItem(admin, selaDePrata, assetMapa), false);
  });

  await test('nao salva base64/binario nem altera snapshot mock', async () => {
    const { service, storage } = createService();
    const previous = await seedPng(service);
    const { deps } = createWorkflowDeps({ service });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);

    const raw = readRawImports(storage);
    assert.equal(raw.includes('base64'), false);
    assert.equal(raw.includes('blob'), false);
    assert.equal(raw.includes('buffer'), false);
    const parsed = JSON.parse(raw);
    assert.equal(typeof parsed.items[0].arquivo_tamanho_bytes, 'number');
    assert.equal(storage.values.has('@tche:mock-mvp:v1'), false);
  });

  await test('nao chama Mapa.list e multiplos ativos por Propriedade continuam permitidos', async () => {
    const { service } = createService();
    const previous = await seedPng(service);
    await seedPng(service, {
      id: 'png_outro_ativo',
      titulo: 'Outro PNG ativo',
      arquivo_uri_local: localUri('prop_a', 'png_outro_ativo', 'outro.png'),
    });
    const { deps } = createWorkflowDeps({ service, importId: 'png_novo' });

    const result = await replacePngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    const active = await service.listActivePngMapImportsByPropriedade('prop_a');
    assert.deepEqual(active.map((item) => item.id).sort(), ['png_novo', 'png_outro_ativo']);

    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'PngMapPropertyManageWorkflow.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');
    assert.equal(source.includes('Mapa.list'), false);
    assert.equal(source.includes("from '../api/mock'"), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('src/assets'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de PngMapPropertyManageWorkflow passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
