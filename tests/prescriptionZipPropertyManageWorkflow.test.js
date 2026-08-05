const assert = require('node:assert/strict');
const {
  PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY,
  createPrescriptionZipImportService,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipImportService');
const {
  PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipStorageService');
const {
  canManagePrescriptionZipForPropriedade,
  canManagePrescriptionZipItem,
  removePrescriptionZipForPropriedade,
  replacePrescriptionZipForPropriedade,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipPropertyManageWorkflow');

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

const admin = { id: 'u_admin', nome: 'Admin', perfil: 'admin' };
const colaboradorNoEscopo = {
  id: 'u_colab',
  nome: 'Colaborador Rio Verde',
  perfil: 'colaborador',
  sub_regioes: ['Rio Verde'],
};
const colaboradorFora = {
  id: 'u_colab_fora',
  nome: 'Colaborador Sorriso',
  perfil: 'colaborador',
  sub_regioes: ['Sorriso'],
};
const produtor = {
  id: 'u_produtor',
  nome: 'Produtor',
  perfil: 'produtor',
  produtor_id: 'titular_a',
};

const propriedadeA = {
  id: 'prop_a',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  fazenda: 'Propriedade A',
  produtor_id: 'titular_a',
  microregiao: 'Rio Verde',
};
const propriedadeB = {
  id: 'prop_b',
  propriedade_id: 'prop_b',
  fazenda_id: 'prop_b',
  fazenda: 'Propriedade B',
  produtor_id: 'titular_b',
  microregiao: 'Rio Verde',
};

const localUri = (propriedadeId, importId, name = 'prescricao.zip') =>
  `file:///app/${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/${propriedadeId}/${importId}-${name}`;

const baseMetadataInput = (overrides = {}) => ({
  id: 'zip_antigo',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  nome_propriedade: 'Propriedade A',
  titulo: 'Prescrição localizada',
  descricao: 'Metadados que devem ser preservados.',
  camada: 'taxa_variavel',
  camada_label: 'Taxa variável',
  elemento: 'taxa_variavel',
  elemento_label: 'Taxa variável',
  safra: '2025/2026',
  ano: 2026,
  escopo: 'talhao',
  talhao_id: 'T01',
  talhao_nome: 'Talhão 01',
  arquivo_nome_original: 'prescricao-antiga.zip',
  arquivo_uri_local: localUri('prop_a', 'zip_antigo', 'antiga.zip'),
  arquivo_tamanho_bytes: 2048,
  arquivo_mime: 'application/zip',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  ...overrides,
});

const zipLocalMapa = (metadata) => ({
  id: `zip_local:${metadata.id}`,
  titulo: metadata.titulo,
  tipo_anexo: 'prescricao_zip_local',
  tipo_material: 'prescricao',
  formato_arquivo: 'zip',
  origem: 'arquivo_local',
  arquivo_uri_local: metadata.arquivo_uri_local,
  prescription_zip_import_id: metadata.id,
  is_prescription_zip_local: true,
});

const assetMapa = {
  id: 'm_prescricao_asset',
  titulo: 'Prescrição preparada',
  tipo_anexo: 'anexo_prescricao',
  formato_arquivo: 'zip',
  origem: 'drive_importado',
  arquivo_url: 'asset://prescricao.zip',
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
  let timestamp = 0;
  const service = createPrescriptionZipImportService({
    storage: storage.adapter,
    now: () => `2026-08-05T10:00:0${Math.min(timestamp++, 9)}.000Z`,
    generateId: () => 'id_nao_usado',
  });
  return { service, storage };
};

const seedZip = (service, overrides = {}) =>
  service.createPrescriptionZipImportMetadata(baseMetadataInput(overrides));

const createCopyMock = (calls, options = {}) => async (input) => {
  calls.events.push('copy');
  calls.copy.push(input);
  if (options.fail) {
    return {
      ok: false,
      error: { code: 'ZIP_COPY_FAILED', message: 'Falha controlada de cópia.' },
    };
  }
  return {
    ok: true,
    file: {
      propriedade_id: input.propriedade_id,
      fazenda_id: input.fazenda_id,
      uri: localUri(input.propriedade_id, input.importId, 'nova.zip'),
      name: `${input.importId}-nova.zip`,
      originalName: input.originalName,
      size: options.size ?? 4096,
      mimeType: 'application/zip',
      copiedAt: '2026-08-05T10:00:00.000Z',
    },
  };
};

const createWorkflowDeps = ({
  service,
  importId = 'zip_novo',
  copyMock,
  deleteMock,
  pickMock,
  serviceOverrides = {},
} = {}) => {
  const calls = { copy: [], delete: [], events: [] };
  const trackedService = service ? {
    createPrescriptionZipImportMetadata: async (input) => {
      calls.events.push('create');
      return serviceOverrides.createPrescriptionZipImportMetadata
        ? serviceOverrides.createPrescriptionZipImportMetadata(input)
        : service.createPrescriptionZipImportMetadata(input);
    },
    getPrescriptionZipImportById: (...args) => (
      serviceOverrides.getPrescriptionZipImportById
        ? serviceOverrides.getPrescriptionZipImportById(...args)
        : service.getPrescriptionZipImportById(...args)
    ),
    listActivePrescriptionZipImportsByPropriedade: (...args) =>
      service.listActivePrescriptionZipImportsByPropriedade(...args),
    markPrescriptionZipImportAsSubstituido: async (...args) => {
      calls.events.push('mark_substituido');
      return serviceOverrides.markPrescriptionZipImportAsSubstituido
        ? serviceOverrides.markPrescriptionZipImportAsSubstituido(...args)
        : service.markPrescriptionZipImportAsSubstituido(...args);
    },
    markPrescriptionZipImportAsRemoved: async (...args) => {
      calls.events.push('mark_removed');
      return serviceOverrides.markPrescriptionZipImportAsRemoved
        ? serviceOverrides.markPrescriptionZipImportAsRemoved(...args)
        : service.markPrescriptionZipImportAsRemoved(...args);
    },
  } : undefined;

  return {
    calls,
    deps: {
      importService: trackedService,
      generateImportId: () => importId,
      pickPrescriptionZipDocument: pickMock ?? (async () => ({
        ok: true,
        file: {
          uri: 'content://picker/nova-prescricao.zip',
          name: 'Nova prescrição.zip',
          size: 4096,
          mimeType: 'application/zip',
        },
        errors: [],
        warnings: [],
      })),
      copyPrescriptionZipToInternalStorage: copyMock ?? createCopyMock(calls),
      deleteStoredPrescriptionZip: deleteMock ?? (async (uri) => {
        calls.events.push('delete');
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      }),
    },
  };
};

const createFileSystem = () => {
  const calls = { delete: [] };
  return {
    calls,
    adapter: {
      documentDirectory: 'file:///app/',
      getInfoAsync: async () => ({ exists: true, isDirectory: false }),
      makeDirectoryAsync: async () => undefined,
      copyAsync: async () => undefined,
      deleteAsync: async (uri) => calls.delete.push(uri),
    },
  };
};

const run = async () => {
  await test('permissao de gestao respeita perfil, escopo e tipo local', () => {
    const mapa = zipLocalMapa(baseMetadataInput());
    assert.equal(canManagePrescriptionZipForPropriedade(admin, propriedadeA), true);
    assert.equal(canManagePrescriptionZipForPropriedade(colaboradorNoEscopo, propriedadeA), true);
    assert.equal(canManagePrescriptionZipForPropriedade(colaboradorFora, propriedadeA), false);
    assert.equal(canManagePrescriptionZipForPropriedade(produtor, propriedadeA), false);
    assert.equal(canManagePrescriptionZipItem(admin, propriedadeA, mapa), true);
    assert.equal(canManagePrescriptionZipItem(admin, propriedadeA, assetMapa), false);
  });

  await test('Admin substitui ZIP local e remove o arquivo anterior', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const { calls, deps } = createWorkflowDeps({ service });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'zip_novo');
    assert.equal(result.previousMetadata.status, 'substituido');
    assert.equal(result.deletedPreviousFile, true);
    assert.deepEqual(calls.events, ['copy', 'create', 'mark_substituido', 'delete']);
  });

  await test('Colaborador no escopo substitui e Produtor permanece bloqueado', async () => {
    const { service } = createService();
    const first = await seedZip(service);
    const colabDeps = createWorkflowDeps({ service, importId: 'zip_colab' });
    const allowed = await replacePrescriptionZipForPropriedade({
      user: colaboradorNoEscopo,
      propriedade: propriedadeA,
      metadataId: first.id,
    }, colabDeps.deps);
    const producerDeps = createWorkflowDeps({ service, importId: 'zip_produtor' });
    const denied = await replacePrescriptionZipForPropriedade({
      user: produtor,
      propriedade: propriedadeA,
      metadata: allowed.metadata,
    }, producerDeps.deps);

    assert.equal(allowed.ok, true);
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'MANAGE_NOT_ALLOWED');
    assert.equal(producerDeps.calls.copy.length, 0);
  });

  await test('Admin remove ZIP local e metadado deixa a lista ativa', async () => {
    const { service } = createService();
    const active = await seedZip(service);
    const { calls, deps } = createWorkflowDeps({ service });
    const result = await removePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      mapa: zipLocalMapa(active),
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.status, 'removido');
    assert.equal(result.deletedFile, true);
    assert.equal(calls.delete[0], active.arquivo_uri_local);
    assert.deepEqual(await service.listActivePrescriptionZipImportsByPropriedade('prop_a'), []);
  });

  await test('item asset e ausencia de Propriedade sao recusados antes do storage', async () => {
    const { service } = createService();
    const active = await seedZip(service);
    const { calls, deps } = createWorkflowDeps({ service });
    const assetResult = await removePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      mapa: assetMapa,
    }, deps);
    const missingContext = await removePrescriptionZipForPropriedade({
      user: admin,
      propriedade: null,
      metadata: active,
    }, deps);

    assert.equal(assetResult.error.code, 'ZIP_IMPORT_NOT_LOCAL');
    assert.equal(missingContext.error.code, 'PROPRIEDADE_ID_REQUIRED');
    assert.equal(calls.delete.length, 0);
  });

  await test('substituicao preserva metadados e troca somente autoria e arquivo', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const { deps } = createWorkflowDeps({ service });
    const result = await replacePrescriptionZipForPropriedade({
      user: { ...admin, nome: 'Admin Atual' },
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.titulo, previous.titulo);
    assert.equal(result.metadata.descricao, previous.descricao);
    assert.equal(result.metadata.camada, previous.camada);
    assert.equal(result.metadata.safra, previous.safra);
    assert.equal(result.metadata.ano, previous.ano);
    assert.equal(result.metadata.escopo, previous.escopo);
    assert.equal(result.metadata.talhao_id, previous.talhao_id);
    assert.equal(result.metadata.talhao_nome, previous.talhao_nome);
    assert.equal(result.metadata.visivel_para_produtor, true);
    assert.equal(result.metadata.arquivo_nome_original, 'Nova prescrição.zip');
    assert.equal(result.metadata.arquivo_tamanho_bytes, 4096);
    assert.equal(result.metadata.importado_por_nome, 'Admin Atual');
  });

  await test('falha na copia mantem o ZIP anterior ativo', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const calls = { copy: [], delete: [], events: [] };
    const { deps } = createWorkflowDeps({
      service,
      copyMock: createCopyMock(calls, { fail: true }),
    });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_FAILED');
    assert.equal((await service.getPrescriptionZipImportById(previous.id)).status, 'ativo');
  });

  await test('falha ao criar metadado remove a nova copia', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const { calls, deps } = createWorkflowDeps({
      service,
      serviceOverrides: {
        createPrescriptionZipImportMetadata: async () => {
          throw new Error('falha controlada');
        },
      },
    });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_CREATE_FAILED');
    assert.equal(result.rollback.ok, true);
    assert.equal(calls.delete.length, 1);
    assert.equal((await service.getPrescriptionZipImportById(previous.id)).status, 'ativo');
  });

  await test('falha ao substituir anterior faz rollback do novo ZIP e metadado', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const { calls, deps } = createWorkflowDeps({
      service,
      serviceOverrides: {
        markPrescriptionZipImportAsSubstituido: async () => {
          throw new Error('falha ao substituir');
        },
      },
    });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_REPLACE_FAILED');
    assert.equal(result.rollback.ok, true);
    assert.equal(calls.delete.length, 1);
    assert.equal((await service.getPrescriptionZipImportById('zip_novo')).status, 'removido');
    assert.equal((await service.getPrescriptionZipImportById(previous.id)).status, 'ativo');
  });

  await test('falha ao apagar arquivo anterior retorna warning sem sucesso falso', async () => {
    const { service } = createService();
    const previous = await seedZip(service);
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({
        ok: false,
        deleted: false,
        error: { code: 'ZIP_DELETE_FAILED', message: 'Falha ao apagar anterior.' },
      }),
    });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.warnings[0].code, 'PREVIOUS_FILE_DELETE_FAILED');
    assert.equal((await service.getPrescriptionZipImportById(previous.id)).status, 'substituido');
  });

  await test('arquivo ja ausente nao derruba a remocao', async () => {
    const { service } = createService();
    const active = await seedZip(service);
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({ ok: true, deleted: false }),
    });
    const result = await removePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: active,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.deletedFile, false);
    assert.equal(result.warnings[0].code, 'REMOVED_FILE_ALREADY_MISSING');
  });

  await test('path externo e recusado pelo storage sem apagar arquivo', async () => {
    const { service } = createService();
    const active = await seedZip(service, {
      arquivo_uri_local: 'file:///app/outro-diretorio/prescricao.zip',
    });
    const fileSystem = createFileSystem();
    const { deps } = createWorkflowDeps({ service });
    deps.deleteStoredPrescriptionZip = undefined;
    deps.storageDeps = { fileSystem: fileSystem.adapter };
    const result = await removePrescriptionZipForPropriedade({
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

  await test('Propriedade A nao gerencia ZIP pertencente a Propriedade B', async () => {
    const { service } = createService();
    const activeB = await seedZip(service, {
      id: 'zip_b',
      propriedade_id: 'prop_b',
      fazenda_id: 'prop_b',
      arquivo_uri_local: localUri('prop_b', 'zip_b'),
    });
    const { calls, deps } = createWorkflowDeps({ service });
    const removeResult = await removePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: activeB,
    }, deps);
    const replaceResult = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: activeB,
    }, deps);

    assert.equal(removeResult.error.code, 'ZIP_IMPORT_OUT_OF_SCOPE');
    assert.equal(replaceResult.error.code, 'ZIP_IMPORT_OUT_OF_SCOPE');
    assert.equal(calls.copy.length, 0);
    assert.equal(calls.delete.length, 0);
    assert.equal((await service.getPrescriptionZipImportById(activeB.id)).status, 'ativo');
    assert.equal(propriedadeB.propriedade_id, 'prop_b');
  });

  await test('persistencia guarda somente metadados e nao altera o mock', async () => {
    const { service, storage } = createService();
    const previous = await seedZip(service);
    const { deps } = createWorkflowDeps({ service });
    const result = await replacePrescriptionZipForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      metadata: previous,
    }, deps);

    assert.equal(result.ok, true);
    const raw = storage.values.get(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY);
    assert.equal(raw.includes('base64'), false);
    assert.equal(raw.includes('blob'), false);
    assert.equal(raw.includes('buffer'), false);
    assert.equal(storage.values.has('@tche:mock-mvp:v1'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de prescriptionZipPropertyManageWorkflow passaram.');
  }
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
