const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PNG_MAP_IMPORT_STORAGE_KEY,
  createPngMapImportService,
} = require('../.tmp-domain-compat/src/services/PngMapImportService');
const {
  canStartPngMapPropertyImport,
  confirmPngMapPropertyImport,
  importPngMapForPropriedade,
  preparePngMapPropertyImport,
  validatePngMapPropertyImportForm,
} = require('../.tmp-domain-compat/src/services/PngMapPropertyImportWorkflow');
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

const baseFile = (overrides = {}) => ({
  uri: 'content://picker/mapa-ph.png',
  name: 'Mapa pH.PNG',
  size: 123456,
  mimeType: 'image/png',
  ...overrides,
});

const baseForm = (overrides = {}) => ({
  titulo: 'pH - Propriedade A',
  elemento: 'ph',
  safra: '2025/2026',
  ano: 2026,
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  visivel_para_produtor: true,
  descricao: 'Anexo local validado.',
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
    '2026-06-05T15:00:00.000Z',
    '2026-06-05T15:00:01.000Z',
    '2026-06-05T15:00:02.000Z',
    '2026-06-05T15:00:03.000Z',
    '2026-06-05T15:00:04.000Z',
    '2026-06-05T15:00:05.000Z',
  ];
  const service = createPngMapImportService({
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
      uri: `file:///app/tche-png-imports/${input.propriedade_id}/${input.importId}-mapa-ph.png`,
      name: `${input.importId}-mapa-ph.png`,
      originalName: input.originalName,
      size: 123456,
      mimeType: 'image/png',
      copiedAt: '2026-06-05T15:00:00.000Z',
    },
  };
};

const createWorkflowDeps = ({
  service,
  importId = 'png_import_1',
  pickResult,
  copyMock,
  deleteMock,
} = {}) => {
  const calls = {
    copy: [],
    delete: [],
    pick: [],
  };

  return {
    calls,
    deps: {
      importService: service,
      generateImportId: () => importId,
      now: () => '2026-06-05T15:00:00.000Z',
      pickPngDocument: async () => {
        calls.pick.push(true);
        return pickResult ?? {
          ok: true,
          file: baseFile(),
          errors: [],
          warnings: [],
        };
      },
      copyPngToInternalStorage: copyMock ?? createCopyMock(calls),
      deleteStoredPng: deleteMock ?? (async (uri) => {
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      }),
    },
  };
};

const readRawImports = (storage) => storage.values.get(PNG_MAP_IMPORT_STORAGE_KEY) || '';

const prepareOk = async (service, overrides = {}) => {
  const { deps } = createWorkflowDeps({
    service,
    importId: overrides.importId ?? 'png_prepare_ok',
    pickResult: overrides.pickResult,
  });
  return preparePngMapPropertyImport({
    user: overrides.user ?? admin,
    propriedade: overrides.propriedade ?? propriedadeA,
  }, deps);
};

const run = async () => {
  await test('permissao visual/local respeita Admin, Colaborador no escopo e Produtor', () => {
    assert.equal(canStartPngMapPropertyImport(admin, propriedadeA), true);
    assert.equal(canStartPngMapPropertyImport(colaboradorRioVerde, propriedadeA), true);
    assert.equal(canStartPngMapPropertyImport(produtor, propriedadeA), false);
    assert.equal(canStartPngMapPropertyImport(colaboradorForaDoEscopo, propriedadeA), false);
    assert.equal(canStartPngMapPropertyImport(null, propriedadeA), false);
    assert.equal(canStartPngMapPropertyImport(admin, null), false);
  });

  await test('sem contexto de Propriedade bloqueia antes do picker', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await preparePngMapPropertyImport({
      user: admin,
      propriedade: null,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PROPRIEDADE_ID_REQUIRED');
    assert.equal(calls.pick.length, 0);
    assert.equal(calls.copy.length, 0);
  });

  await test('Produtor nao pode anexar PNG', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await preparePngMapPropertyImport({
      user: produtor,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'IMPORT_NOT_ALLOWED');
    assert.equal(calls.pick.length, 0);
  });

  await test('picker cancelado retorna erro controlado sem copiar', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      pickResult: {
        ok: false,
        errors: [{ code: 'PICKER_CANCELLED', message: 'Selecao cancelada.' }],
        warnings: [],
      },
    });

    const result = await preparePngMapPropertyImport({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PICKER_CANCELLED');
    assert.equal(calls.copy.length, 0);
  });

  await test('arquivo invalido retorna erro controlado', async () => {
    const { service } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      pickResult: {
        ok: false,
        file: baseFile({ name: 'mapa.pdf', mimeType: 'application/pdf' }),
        errors: [{ code: 'UNSUPPORTED_FILE_TYPE', message: 'Selecione um PNG.' }],
        warnings: [],
      },
    });

    const result = await preparePngMapPropertyImport({
      user: admin,
      propriedade: propriedadeA,
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal(calls.copy.length, 0);
  });

  await test('formulario invalido sem titulo ou categoria bloqueia', async () => {
    const { service } = createService();
    const prepared = await prepareOk(service);

    assert.equal(prepared.ok, true);

    const semTitulo = await confirmPngMapPropertyImport(prepared.preview, baseForm({
      titulo: '',
    }), {
      importService: service,
    });
    const semCategoria = await confirmPngMapPropertyImport(prepared.preview, baseForm({
      elemento: '',
    }), {
      importService: service,
    });

    assert.equal(semTitulo.ok, false);
    assert.equal(semTitulo.error.code, 'FORM_INVALID');
    assert.equal(semTitulo.error.details.titulo, 'Informe um titulo para o mapa PNG.');
    assert.equal(semCategoria.ok, false);
    assert.equal(semCategoria.error.code, 'FORM_INVALID');
    assert.equal(semCategoria.error.details.elemento, 'Selecione o tipo de mapa PNG.');
  });

  await test('escopo talhao sem talhao bloqueia', () => {
    const validation = validatePngMapPropertyImportForm(baseForm({
      escopo: 'talhao',
      talhao_id: '',
      talhao_nome: '',
    }));

    assert.equal(validation.ok, false);
    assert.equal(validation.errors.talhao, 'Selecione ou informe o talhao do mapa PNG.');
  });

  await test('prescricao nao entra no fluxo PNG', () => {
    const validation = validatePngMapPropertyImportForm(baseForm({
      elemento: 'prescricao',
    }));

    assert.equal(validation.ok, false);
    assert.equal(validation.errors.elemento, 'Selecione o tipo de mapa PNG.');
  });

  await test('sucesso copia PNG e cria metadado ativo sem conteudo bruto', async () => {
    const { service, storage } = createService();
    const { calls, deps } = createWorkflowDeps({
      service,
      importId: 'png_ok_1',
    });

    const result = await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeComIdsDuplos,
      form: baseForm({
        elemento: 'ph',
        talhao_nome: undefined,
      }),
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'png_ok_1');
    assert.equal(result.metadata.propriedade_id, 'prop_duplo');
    assert.equal(result.metadata.fazenda_id, 'fazenda_dupla');
    assert.equal(result.metadata.nome_propriedade, 'Propriedade Com IDs Duplos');
    assert.equal(result.metadata.titulo, 'pH - Propriedade A');
    assert.equal(result.metadata.categoria, 'fertilidade');
    assert.equal(result.metadata.categoria_label, 'Fertilidade');
    assert.equal(result.metadata.elemento, 'ph');
    assert.equal(result.metadata.elemento_label, 'pH');
    assert.equal(result.metadata.safra, '2025/2026');
    assert.equal(result.metadata.ano, 2026);
    assert.equal(result.metadata.profundidade, '10-20 cm');
    assert.equal(result.metadata.escopo, 'propriedade');
    assert.equal(result.metadata.talhao_nome, 'Propriedade inteira');
    assert.equal(result.metadata.status, 'ativo');
    assert.equal(result.metadata.visivel_para_produtor, true);
    assert.equal(result.metadata.arquivo_nome_original, 'Mapa pH.PNG');
    assert.equal(result.metadata.arquivo_uri_local, 'file:///app/tche-png-imports/prop_duplo/png_ok_1-mapa-ph.png');
    assert.equal(result.metadata.arquivo_tamanho_bytes, 123456);
    assert.equal(result.metadata.arquivo_mime, 'image/png');
    assert.equal(result.metadata.importado_por_usuario_id, 'u_admin');
    assert.equal(result.metadata.importado_por_nome, 'Admin Demonstracao');
    assert.equal(calls.copy[0].importId, 'png_ok_1');
    assert.equal(calls.copy[0].sourceUri, 'content://picker/mapa-ph.png');

    const raw = readRawImports(storage);
    assert.equal(raw.includes('base64'), false);
    assert.equal(raw.includes('"bytes"'), false);
    assert.equal(raw.includes('"buffer"'), false);
    assert.equal(raw.includes('"blob"'), false);
    assert.equal(raw.includes('data:image'), false);
    assert.equal(raw.includes('require('), false);
    assert.equal(storage.values.has(MOCK_LOCAL_STORAGE_KEY), false);
  });

  await test('Colaborador autorizado pode anexar', async () => {
    const { service } = createService();
    const { deps } = createWorkflowDeps({
      service,
      importId: 'png_colab',
    });

    const result = await importPngMapForPropriedade({
      user: colaboradorRioVerde,
      propriedade: propriedadeA,
      form: baseForm({ titulo: 'Calcario local', elemento: 'calcario' }),
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.importado_por_usuario_id, 'u_colab');
    assert.equal(result.metadata.categoria, 'correcao');
    assert.equal(result.metadata.elemento, 'calcario');
  });

  await test('falha no storage nao cria metadado', async () => {
    const { service, storage } = createService();
    const calls = { copy: [], delete: [], pick: [] };
    const { deps } = createWorkflowDeps({
      service,
      copyMock: createCopyMock(calls, { fail: true }),
    });

    const result = await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      form: baseForm(),
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'STORAGE_FAILED');
    assert.equal(calls.copy.length, 1);
    assert.equal(storage.values.has(PNG_MAP_IMPORT_STORAGE_KEY), false);
  });

  await test('falha no metadado remove arquivo copiado', async () => {
    const service = {
      createPngMapImportMetadata: async () => {
        throw new Error('metadata failed');
      },
      listPngMapImportsByPropriedade: async () => [],
      listActivePngMapImportsByPropriedade: async () => [],
    };
    const { calls, deps } = createWorkflowDeps({ service });

    const result = await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      form: baseForm(),
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_FAILED');
    assert.equal(result.rollback.attempted, true);
    assert.equal(result.rollback.ok, true);
    assert.equal(result.rollback.deleted, true);
    assert.equal(calls.delete.length, 1);
    assert.equal(calls.delete[0].includes('png_import_1-mapa-ph.png'), true);
  });

  await test('rollback com falha retorna warning controlado de sucesso parcial evitado', async () => {
    const service = {
      createPngMapImportMetadata: async () => {
        throw new Error('metadata failed');
      },
      listPngMapImportsByPropriedade: async () => [],
      listActivePngMapImportsByPropriedade: async () => [],
    };
    const { deps } = createWorkflowDeps({
      service,
      deleteMock: async () => ({
        ok: false,
        deleted: false,
        error: { code: 'PNG_DELETE_FAILED', message: 'Nao removeu.' },
      }),
    });

    const result = await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      form: baseForm(),
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ROLLBACK_FAILED');
    assert.equal(result.rollback.attempted, true);
    assert.equal(result.rollback.ok, false);
    assert.equal(Boolean(result.storedFile.uri), true);
  });

  await test('multiplos ativos por Propriedade sao permitidos', async () => {
    const { service } = createService();
    const depsA = createWorkflowDeps({
      service,
      importId: 'png_a',
    }).deps;
    const depsB = createWorkflowDeps({
      service,
      importId: 'png_b',
    }).deps;

    await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeB,
      form: baseForm({ titulo: 'pH local', elemento: 'ph' }),
    }, depsA);
    await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeB,
      form: baseForm({ titulo: 'Argila local', elemento: 'argila' }),
    }, depsB);

    const activeItems = await service.listActivePngMapImportsByPropriedade('prop_b');
    assert.deepEqual(activeItems.map((item) => item.id), ['png_b', 'png_a']);
    assert.equal(activeItems.every((item) => item.status === 'ativo'), true);
  });

  await test('lista por Propriedade nao vaza anexos de outra Propriedade', async () => {
    const { service } = createService();
    await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeA,
      form: baseForm({ titulo: 'pH A' }),
    }, createWorkflowDeps({ service, importId: 'png_prop_a' }).deps);
    await importPngMapForPropriedade({
      user: admin,
      propriedade: propriedadeB,
      form: baseForm({ titulo: 'pH B' }),
    }, createWorkflowDeps({ service, importId: 'png_prop_b' }).deps);

    const importsA = await service.listActivePngMapImportsByPropriedade('prop_a');
    const importsB = await service.listActivePngMapImportsByPropriedade('prop_b');
    assert.deepEqual(importsA.map((item) => item.id), ['png_prop_a']);
    assert.deepEqual(importsB.map((item) => item.id), ['png_prop_b']);
  });

  await test('Sela de Prata I aceita PNG local adicional sem alterar assets ou mocks', async () => {
    const { service, storage } = createService();
    const result = await importPngMapForPropriedade({
      user: admin,
      propriedade: selaDePrata,
      form: baseForm({
        titulo: 'pH local Sela',
        elemento: 'ph',
      }),
    }, createWorkflowDeps({
      service,
      importId: 'png_sela_local',
    }).deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.propriedade_id, 'p_sela1');
    assert.equal(result.metadata.fazenda_id, 'p_sela1');

    const raw = readRawImports(storage);
    assert.equal(raw.includes('m_sela1_ph_10a20_2025'), false);

    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'PngMapPropertyImportWorkflow.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes("from '../api/mock'"), false);
    assert.equal(source.includes('Mapa.list'), false);
    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('sela-prata-i'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
    assert.equal(source.includes('readAsStringAsync'), false);
    assert.equal(source.includes('writeAsStringAsync'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de PngMapPropertyImportWorkflow passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
