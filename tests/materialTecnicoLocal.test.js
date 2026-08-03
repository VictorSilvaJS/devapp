const assert = require('node:assert/strict');
const {
  MATERIAL_TECNICO_IMPORT_STORAGE_KEY,
  createMaterialTecnicoImportService,
} = require('../.tmp-domain-compat/src/services/MaterialTecnicoImportService');
const {
  createMaterialTecnicoStorageService,
} = require('../.tmp-domain-compat/src/services/MaterialTecnicoStorageService');
const {
  canStartMaterialTecnicoPropertyImport,
  confirmMaterialTecnicoPropertyImport,
  inferMaterialTecnicoPrescriptionFromFileName,
  prepareMaterialTecnicoPropertyImport,
  validateMaterialTecnicoPropertyImportForm,
} = require('../.tmp-domain-compat/src/services/MaterialTecnicoPropertyImportWorkflow');
const {
  canManageMaterialTecnicoItem,
  removeMaterialTecnicoForPropriedade,
} = require('../.tmp-domain-compat/src/services/MaterialTecnicoPropertyManageWorkflow');
const {
  groupMaterialTecnicoMapasByAnoCategoria,
  materialTecnicoImportsToMapaCompatList,
} = require('../.tmp-domain-compat/src/utils/materialTecnicoToMapaCompat');

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

const createImportService = () => {
  const memory = createMemoryStorage();
  let id = 0;
  const service = createMaterialTecnicoImportService({
    storage: memory.adapter,
    now: () => '2026-07-22T15:00:00.000Z',
    generateId: () => `material_${++id}`,
  });
  return { service, memory };
};

const baseMetadata = (overrides = {}) => ({
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  nome_propriedade: 'Propriedade A',
  categoria: 'fertilidade',
  ano: 2025,
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  arquivo_nome_original: 'Mapa pH 2025.PNG',
  arquivo_uri_local: 'file:///app/tche-materiais-tecnicos/prop_a/2025/fertilidade/id-mapa-ph-2025.png',
  arquivo_tamanho_bytes: 1234,
  arquivo_mime: 'image/png',
  formato_arquivo: 'png',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  ...overrides,
});

const admin = { id: 'admin_1', nome: 'Admin', perfil: 'admin' };
const produtor = { id: 'prod_1', perfil: 'produtor', produtor_id: 'titular_a' };
const propriedade = {
  id: 'prop_a',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  fazenda: 'Propriedade A',
  produtor_id: 'titular_a',
  microregiao: 'Rio Verde',
};

const pickedZip = {
  uri: 'content://picker/CAL_T01.zip',
  name: 'CAL_T01.zip',
  size: 2048,
  mimeType: 'application/zip',
  formato: 'zip',
};

const run = async () => {
  await test('catalogo preserva nome original, separa IDs e salva somente metadados', async () => {
    const { service, memory } = createImportService();
    const created = await service.createMaterialTecnicoImportMetadata(baseMetadata({
      titulo: 'Título digitado que não deve prevalecer',
      periodo_produtivo_id: 'periodo_1',
      periodo_produtivo_label: 'Safra Soja 2025/2026',
    }));

    assert.equal(created.titulo, 'Mapa pH 2025.PNG');
    assert.equal(created.arquivo_nome_original, 'Mapa pH 2025.PNG');
    assert.equal(created.propriedade_id, 'prop_a');
    assert.equal(created.fazenda_id, 'prop_a');
    assert.equal(created.ano, 2025);
    assert.equal(created.periodo_produtivo_id, 'periodo_1');
    assert.equal(created.safra, 'Safra Soja 2025/2026');

    const raw = memory.values.get(MATERIAL_TECNICO_IMPORT_STORAGE_KEY);
    assert.equal(raw.includes('data:image'), false);
    assert.equal(raw.includes('base64'), false);
    await assert.rejects(
      () => service.createMaterialTecnicoImportMetadata(baseMetadata({ base64: 'abc' })),
      /conteúdo de arquivo/
    );
  });

  await test('catalogo isola Propriedades, visibilidade e estados', async () => {
    const { service } = createImportService();
    const a = await service.createMaterialTecnicoImportMetadata(baseMetadata({ id: 'a' }));
    await service.createMaterialTecnicoImportMetadata(baseMetadata({
      id: 'b',
      propriedade_id: 'prop_b',
      fazenda_id: 'prop_b',
      visivel_para_produtor: false,
    }));
    await service.markMaterialTecnicoImportAsRemoved(a.id);

    assert.deepEqual(await service.listActiveMaterialTecnicoImportsByPropriedade('prop_a'), []);
    assert.deepEqual(
      (await service.listActiveMaterialTecnicoImportsByPropriedade('prop_b')).map((item) => item.id),
      ['b']
    );
  });

  await test('snapshot corrompido volta a lista vazia sem quebrar o app', async () => {
    const memory = createMemoryStorage();
    memory.values.set(MATERIAL_TECNICO_IMPORT_STORAGE_KEY, '{invalido');
    const service = createMaterialTecnicoImportService({ storage: memory.adapter });
    assert.deepEqual(await service.listMaterialTecnicoImports(), []);
  });

  await test('regras condicionais exigem ano, profundidade e Talhao apenas quando cabivel', () => {
    assert.equal(validateMaterialTecnicoPropertyImportForm('fertilidade', {
      ano: '',
      profundidade: '10-20 cm',
    }).errors.ano.length > 0, true);
    assert.equal(validateMaterialTecnicoPropertyImportForm('fertilidade', {
      ano: 2025,
      profundidade: '',
    }).errors.profundidade.length > 0, true);
    assert.equal(validateMaterialTecnicoPropertyImportForm('correcao', {
      ano: 2025,
      profundidade: 'nao_informada',
      escopo: 'talhao',
    }).errors.talhao.length > 0, true);
    assert.equal(validateMaterialTecnicoPropertyImportForm('correcao', {
      ano: 2025,
      profundidade: 'nao_informada',
      escopo: 'talhao',
      talhao_nome: 'T01',
    }).errors.talhao.length > 0, true);
    assert.equal(validateMaterialTecnicoPropertyImportForm('correcao', {
      ano: 2025,
      profundidade: 'nao_informada',
      escopo: 'talhao',
      talhao_id: 'talhao_1',
      talhao_nome: 'T01',
    }).ok, true);

    const prescricao = validateMaterialTecnicoPropertyImportForm('prescricao', {
      ano: '2025',
      profundidade: '10-20 cm',
      escopo: 'talhao',
      talhao_nome: 'T01',
    });
    assert.equal(prescricao.ok, true);
    assert.equal(prescricao.normalized.profundidade, undefined);
    assert.equal(prescricao.normalized.escopo, 'propriedade');
    assert.equal(prescricao.normalized.talhao_nome, 'Propriedade inteira');
  });

  await test('prescricao infere CAL, FOR e KCL sem tornar o nome autoridade', () => {
    assert.equal(inferMaterialTecnicoPrescriptionFromFileName('CAL_T01.zip').value, 'calcario');
    assert.equal(inferMaterialTecnicoPrescriptionFromFileName('FOR_12e14.pdf').value, 'fosforo');
    assert.equal(inferMaterialTecnicoPrescriptionFromFileName('KCL-T02.png').value, 'potassio');
    assert.equal(inferMaterialTecnicoPrescriptionFromFileName('arquivo-livre.zip').value, 'nao_identificada');
  });

  await test('workflow respeita permissao, copia e cria metadado com rollback possivel', async () => {
    const { service } = createImportService();
    assert.equal(canStartMaterialTecnicoPropertyImport(admin, propriedade), true);
    assert.equal(canStartMaterialTecnicoPropertyImport(produtor, propriedade), false);

    const prepared = await prepareMaterialTecnicoPropertyImport({
      user: admin,
      propriedade,
      categoria: 'prescricao',
    }, {
      generateImportId: () => 'material_zip_1',
      now: () => '2026-07-22T15:00:00.000Z',
      pickMaterialTecnicoDocument: async () => ({
        ok: true,
        file: pickedZip,
        errors: [],
        warnings: [],
      }),
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.preview.tituloAutomatico, 'CAL_T01.zip');
    assert.equal(prepared.preview.prescricaoInferida, 'calcario');

    const copyCalls = [];
    const confirmed = await confirmMaterialTecnicoPropertyImport(
      prepared.preview,
      { ano: 2025, visivel_para_produtor: true },
      {
        importService: service,
        copyMaterialTecnicoToInternalStorage: async (input) => {
          copyCalls.push(input);
          return {
            ok: true,
            file: {
              propriedade_id: input.propriedade_id,
              fazenda_id: input.fazenda_id,
              ano: input.ano,
              categoria: input.categoria,
              formato_arquivo: input.formato_arquivo,
              uri: 'file:///app/tche-materiais-tecnicos/prop_a/2025/prescricao/material_zip_1-cal-t01.zip',
              name: 'material_zip_1-cal-t01.zip',
              originalName: input.originalName,
              size: 2048,
              mimeType: 'application/zip',
              copiedAt: '2026-07-22T15:00:00.000Z',
            },
          };
        },
      }
    );

    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.metadata.titulo, 'CAL_T01.zip');
    assert.equal(confirmed.metadata.categoria, 'prescricao');
    assert.equal(confirmed.metadata.escopo, 'propriedade');
    assert.equal(confirmed.metadata.prescricao_inferida, 'calcario');
    assert.equal(copyCalls[0].ano, 2025);
  });

  await test('periodo opcional precisa estar ativo na mesma Propriedade', async () => {
    const prepared = await prepareMaterialTecnicoPropertyImport({
      user: admin,
      propriedade,
      categoria: 'prescricao',
    }, {
      pickMaterialTecnicoDocument: async () => ({ ok: true, file: pickedZip, errors: [], warnings: [] }),
    });
    const result = await confirmMaterialTecnicoPropertyImport(prepared.preview, {
      ano: 2025,
      periodo_produtivo_id: 'periodo_fora',
      periodo_produtivo_label: 'Safra externa',
    }, {
      periodoProdutivoService: {
        getPeriodoProdutivoById: async () => ({
          id: 'periodo_fora',
          propriedade_id: 'prop_b',
          propriedadeId: 'prop_b',
          fazenda_id: 'prop_b',
          fazendaId: 'prop_b',
          label: 'Safra externa',
          registro_status: 'ativo',
        }),
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PERIODO_INVALID');
  });

  await test('storage espelha Propriedade/Ano/Categoria e recusa caminho externo', async () => {
    const entries = new Map([['file:///app/', { exists: true, isDirectory: true }]]);
    const fileSystem = {
      documentDirectory: 'file:///app/',
      getInfoAsync: async (uri) => entries.get(uri) ?? { exists: false },
      makeDirectoryAsync: async (uri) => entries.set(uri, { exists: true, isDirectory: true }),
      copyAsync: async ({ to }) => entries.set(to, { exists: true, isDirectory: false, size: 321 }),
      deleteAsync: async (uri) => entries.delete(uri),
    };
    const storage = createMaterialTecnicoStorageService({
      fileSystem,
      now: () => '2026-07-22T15:00:00.000Z',
    });
    const copied = await storage.copyMaterialTecnicoToInternalStorage({
      propriedade_id: 'Propriedade A',
      fazenda_id: 'prop_a',
      ano: 2025,
      categoria: 'correcao',
      formato_arquivo: 'pdf',
      sourceUri: 'content://picker/laudo',
      originalName: 'Correção T01.PDF',
      importId: 'item_1',
    });

    assert.equal(copied.ok, true);
    assert.match(copied.file.uri, /tche-materiais-tecnicos\/propriedade-a\/2025\/correcao\/item_1-correcao-t01\.pdf$/);
    assert.equal(copied.file.originalName, 'Correção T01.PDF');
    assert.equal(storage.isSafeMaterialTecnicoStorageUri(copied.file.uri), true);
    assert.equal(storage.isSafeMaterialTecnicoStorageUri('file:///app/outro/segredo.pdf'), false);
  });

  await test('remocao atua somente no item local e na Propriedade correta', async () => {
    const { service } = createImportService();
    const metadata = await service.createMaterialTecnicoImportMetadata(baseMetadata({ id: 'remove_me' }));
    const mapa = materialTecnicoImportsToMapaCompatList([metadata])[0];
    const deletedUris = [];

    assert.equal(canManageMaterialTecnicoItem(admin, propriedade, mapa), true);
    assert.equal(canManageMaterialTecnicoItem(produtor, propriedade, mapa), false);

    const outOfScope = await removeMaterialTecnicoForPropriedade({
      user: admin,
      propriedade: { ...propriedade, id: 'prop_b', propriedade_id: 'prop_b', fazenda_id: 'prop_b' },
      mapa,
    }, { importService: service });
    assert.equal(outOfScope.ok, false);
    assert.equal(outOfScope.error.code, 'MATERIAL_OUT_OF_SCOPE');

    const removed = await removeMaterialTecnicoForPropriedade({
      user: admin,
      propriedade,
      mapa,
    }, {
      importService: service,
      deleteStoredMaterialTecnico: async (uri) => {
        deletedUris.push(uri);
        return { ok: true, deleted: true };
      },
    });
    assert.equal(removed.ok, true);
    assert.equal(removed.metadata.status, 'removido');
    assert.equal(removed.deletedFile, true);
    assert.deepEqual(deletedUris, [metadata.arquivo_uri_local]);
    assert.deepEqual(await service.listActiveMaterialTecnicoImportsByPropriedade('prop_a'), []);
  });

  await test('compatibilidade filtra Produtor e agrupa Ano antes da Categoria', async () => {
    const { service } = createImportService();
    const visible = await service.createMaterialTecnicoImportMetadata(baseMetadata({ id: 'visible' }));
    const hidden = await service.createMaterialTecnicoImportMetadata(baseMetadata({
      id: 'hidden',
      ano: 2024,
      categoria: 'prescricao',
      profundidade: undefined,
      formato_arquivo: 'pdf',
      arquivo_nome_original: 'Prescrição.pdf',
      visivel_para_produtor: false,
    }));
    const producerItems = materialTecnicoImportsToMapaCompatList([visible, hidden], {
      propriedadeIds: ['prop_a'],
      perfil: 'produtor',
    });
    assert.deepEqual(producerItems.map((item) => item.id), ['material_local:visible']);

    const grouped = groupMaterialTecnicoMapasByAnoCategoria(
      materialTecnicoImportsToMapaCompatList([visible, hidden], { propriedadeIds: ['prop_a'] })
    );
    assert.deepEqual(grouped.map((group) => group.ano), [2025, 2024]);
    assert.equal(grouped[0].categorias.fertilidade.length, 1);
    assert.equal(grouped[1].categorias.prescricao.length, 1);
  });

  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de MaterialTecnicoLocal passaram.');
};

run();
