const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PNG_MAP_IMPORT_STORAGE_KEY,
  createPngMapImportService,
} = require('../.tmp-domain-compat/src/services/PngMapImportService');
const {
  PNG_MAP_IMPORT_VERSION,
} = require('../.tmp-domain-compat/src/types/anexoPngLocal');
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
    '2026-06-05T13:00:00.000Z',
    '2026-06-05T13:00:01.000Z',
    '2026-06-05T13:00:02.000Z',
    '2026-06-05T13:00:03.000Z',
    '2026-06-05T13:00:04.000Z',
    '2026-06-05T13:00:05.000Z',
    '2026-06-05T13:00:06.000Z',
    '2026-06-05T13:00:07.000Z',
    '2026-06-05T13:00:08.000Z',
    '2026-06-05T13:00:09.000Z',
    '2026-06-05T13:00:10.000Z',
    '2026-06-05T13:00:11.000Z',
    '2026-06-05T13:00:12.000Z',
    '2026-06-05T13:00:13.000Z',
    '2026-06-05T13:00:14.000Z',
    '2026-06-05T13:00:15.000Z',
  ];
  const service = createPngMapImportService({
    storage: storage.adapter,
    now: () => timestamps[Math.min(nowIndex++, timestamps.length - 1)],
    generateId: () => {
      idIndex += 1;
      return `pngmap_test_${idIndex}`;
    },
  });

  return { service, storage };
};

const baseInput = (overrides = {}) => ({
  propriedade_id: 'p_png_a',
  titulo: 'pH - Propriedade Demo',
  categoria: 'fertilidade',
  categoria_label: 'Fertilidade',
  elemento: 'ph',
  elemento_label: 'pH',
  safra: '2025',
  ano: 2025,
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  arquivo_nome_original: 'PH_10a20.png',
  arquivo_uri_local: 'file:///app/tche-png-map-imports/p_png_a/png-001.png',
  arquivo_tamanho_bytes: 206215,
  arquivo_mime: 'image/png',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin Demonstracao',
  status: 'rascunho',
  origem: 'arquivo_local',
  ...overrides,
});

const readSnapshot = (storage) => {
  const raw = storage.values.get(PNG_MAP_IMPORT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

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
  await test('lista vazia sem snapshot', async () => {
    const { service } = createService();

    assert.deepEqual(await service.listPngMapImports(), []);
    assert.deepEqual(await service.listPngMapImportsByPropriedade('p_png_a'), []);
    assert.deepEqual(await service.listActivePngMapImportsByPropriedade('p_png_a'), []);
    assert.equal(await service.getPngMapImportById('png_inexistente'), null);
  });

  await test('JSON corrompido nao derruba e pode ser sobrescrito', async () => {
    const { service, storage } = createService();
    storage.values.set(PNG_MAP_IMPORT_STORAGE_KEY, '{json invalido');

    assert.deepEqual(await service.listPngMapImports(), []);

    const created = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_pos_corrupto',
    }));

    assert.equal(created.propriedade_id, 'prop_pos_corrupto');
    assert.equal(readSnapshot(storage).items.length, 1);
  });

  await test('cria metadado valido em chave propria sem alterar snapshot mock', async () => {
    const { service, storage } = createService();
    const created = await service.createPngMapImportMetadata(baseInput());

    assert.equal(created.id, 'pngmap_test_1');
    assert.equal(created.propriedade_id, 'p_png_a');
    assert.equal(Object.prototype.hasOwnProperty.call(created, 'fazenda_id'), false);
    assert.equal(created.titulo, 'pH - Propriedade Demo');
    assert.equal(created.categoria, 'fertilidade');
    assert.equal(created.categoria_label, 'Fertilidade');
    assert.equal(created.escopo, 'propriedade');
    assert.equal(created.arquivo_nome_original, 'PH_10a20.png');
    assert.equal(created.status, 'rascunho');
    assert.equal(created.origem, 'arquivo_local');
    assert.equal(created.versao, PNG_MAP_IMPORT_VERSION);
    assert.equal(created.visivel_para_produtor, true);
    assert.equal(created.importado_em, '2026-06-05T13:00:00.000Z');
    assert.equal(created.atualizado_em, '2026-06-05T13:00:00.000Z');

    assert.equal(storage.values.has(PNG_MAP_IMPORT_STORAGE_KEY), true);
    assert.equal(storage.values.has(MOCK_LOCAL_STORAGE_KEY), false);
  });

  await test('nova escrita exige propriedade_id e nao grava fazenda_id', async () => {
    const { service } = createService();
    const byPropriedade = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_fallback',
      fazenda_id: undefined,
      arquivo_nome_original: 'por-propriedade.png',
    }));

    assert.equal(byPropriedade.propriedade_id, 'prop_fallback');
    assert.equal(Object.prototype.hasOwnProperty.call(byPropriedade, 'fazenda_id'), false);
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({
        propriedade_id: undefined,
        fazenda_id: 'fazenda_fallback',
        arquivo_nome_original: 'por-fazenda.png',
      })),
      /propriedade_id/
    );
  });

  await test('gera id estavel e aplica default de visivel_para_produtor', async () => {
    const { service } = createService();
    const created = await service.createPngMapImportMetadata(baseInput({
      visivel_para_produtor: undefined,
    }));
    const loaded = await service.getPngMapImportById(created.id);

    assert.equal(created.id, 'pngmap_test_1');
    assert.equal(loaded.id, created.id);
    assert.equal(loaded.visivel_para_produtor, true);
  });

  await test('rejeita campos obrigatorios ausentes ou origem invalida', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ propriedade_id: undefined, fazenda_id: undefined })),
      /propriedade_id/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ titulo: '' })),
      /titulo/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ categoria: undefined })),
      /categoria/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ categoria_label: '' })),
      /categoria_label/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ arquivo_nome_original: '' })),
      /arquivo_nome_original/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ origem: 'mock' })),
      /origem/
    );
  });

  await test('rejeita escopo talhao sem talhao e aceita com talhao_nome', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ escopo: 'talhao' })),
      /talhao/
    );

    const created = await service.createPngMapImportMetadata(baseInput({
      escopo: 'talhao',
      talhao_nome: 'Talhao 01',
    }));

    assert.equal(created.escopo, 'talhao');
    assert.equal(created.talhao_nome, 'Talhao 01');
  });

  await test('rejeita tentativa de salvar base64, content, bytes, blob ou dados grandes', async () => {
    const { service } = createService();

    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ base64: 'abc' })),
      /conteudo de arquivo/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ content: 'abc' })),
      /conteudo de arquivo/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ bytes: [1, 2, 3] })),
      /conteudo de arquivo/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ blob: { size: 10 } })),
      /conteudo de arquivo/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ descricao: 'x'.repeat(4097) })),
      /grande demais/
    );
    await assertRejectsWith(
      () => service.createPngMapImportMetadata(baseInput({ imageSource: { uri: 'file:///x.png' } })),
      /conteudo de arquivo/
    );
  });

  await test('nao salva imagem, binario ou objetos no snapshot', async () => {
    const { service, storage } = createService();
    await service.createPngMapImportMetadata(baseInput({
      arquivo_uri_local: undefined,
    }));

    const raw = storage.values.get(PNG_MAP_IMPORT_STORAGE_KEY);
    assert.equal(raw.includes('base64'), false);
    assert.equal(raw.includes('"content"'), false);
    assert.equal(raw.includes('"bytes"'), false);
    assert.equal(raw.includes('"blob"'), false);
    assert.equal(raw.includes('data:image'), false);
    assert.equal(raw.includes('require('), false);
    assert.equal(raw.includes('ImageSource'), false);
  });

  await test('lista por Propriedade sem vazar anexos de outra Propriedade', async () => {
    const { service } = createService();
    const first = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_a',
      arquivo_nome_original: 'a.png',
    }));
    await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_b',
      arquivo_nome_original: 'b.png',
    }));

    assert.equal((await service.getPngMapImportById(first.id)).arquivo_nome_original, 'a.png');
    assert.deepEqual(
      (await service.listPngMapImportsByPropriedade('prop_a')).map((item) => item.arquivo_nome_original),
      ['a.png']
    );
    assert.deepEqual(
      (await service.listPngMapImportsByPropriedade('prop_b')).map((item) => item.arquivo_nome_original),
      ['b.png']
    );
  });

  await test('snapshot v1 com fazenda_id e normalizado na leitura', async () => {
    const { service, storage } = createService();
    await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_duplo',
      arquivo_nome_original: 'duplo.png',
    }));

    const snapshot = readSnapshot(storage);
    snapshot.items[0].fazenda_id = 'fazenda_legada';
    delete snapshot.items[0].propriedade_id;
    storage.values.set(PNG_MAP_IMPORT_STORAGE_KEY, JSON.stringify(snapshot));

    const legacy = await service.listPngMapImportsByPropriedade('fazenda_legada');
    assert.equal(legacy.length, 1);
    assert.equal(legacy[0].propriedade_id, 'fazenda_legada');
    assert.equal(Object.prototype.hasOwnProperty.call(legacy[0], 'fazenda_id'), false);
  });

  await test('lista ativos e exclui removido e substituido', async () => {
    const { service } = createService();
    const active = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_status',
      status: 'ativo',
      arquivo_nome_original: 'ativo.png',
    }));
    const removed = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_status',
      status: 'removido',
      arquivo_nome_original: 'removido.png',
    }));
    const substituted = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_status',
      status: 'substituido',
      arquivo_nome_original: 'substituido.png',
    }));

    const activeItems = await service.listActivePngMapImportsByPropriedade('prop_status');
    assert.deepEqual(activeItems.map((item) => item.id), [active.id]);
    assert.equal((await service.getPngMapImportById(removed.id)).status, 'removido');
    assert.equal((await service.getPngMapImportById(substituted.id)).status, 'substituido');
  });

  await test('permite multiplos ativos para a mesma Propriedade', async () => {
    const { service } = createService();
    const first = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_multi',
      status: 'ativo',
      arquivo_nome_original: 'ph.png',
      elemento: 'ph',
    }));
    const second = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_multi',
      status: 'ativo',
      arquivo_nome_original: 'argila.png',
      elemento: 'argila',
    }));

    const activeItems = await service.listActivePngMapImportsByPropriedade('prop_multi');
    assert.deepEqual(activeItems.map((item) => item.id), [second.id, first.id]);
    assert.equal((await service.getPngMapImportById(first.id)).status, 'ativo');
    assert.equal((await service.getPngMapImportById(second.id)).status, 'ativo');
  });

  await test('update preserva id e importado_em e altera atualizado_em', async () => {
    const { service } = createService();
    const created = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_update',
      arquivo_nome_original: 'original.png',
    }));

    const updated = await service.updatePngMapImportMetadata(created.id, {
      titulo: 'pH atualizado',
      arquivo_nome_original: 'renomeado.png',
      status: 'ativo',
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.importado_em, created.importado_em);
    assert.notEqual(updated.atualizado_em, created.atualizado_em);
    assert.equal(updated.titulo, 'pH atualizado');
    assert.equal(updated.arquivo_nome_original, 'renomeado.png');
    assert.equal(updated.status, 'ativo');
  });

  await test('mark removed, mark substituido e delete removem somente metadado', async () => {
    const { service } = createService();
    const first = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_marks',
      status: 'ativo',
      arquivo_nome_original: 'ativo.png',
    }));
    const second = await service.createPngMapImportMetadata(baseInput({
      propriedade_id: 'prop_marks',
      status: 'ativo',
      arquivo_nome_original: 'segundo.png',
    }));

    await service.markPngMapImportAsRemoved(first.id);
    await service.markPngMapImportAsSubstituido(second.id);

    assert.equal((await service.getPngMapImportById(first.id)).status, 'removido');
    assert.equal((await service.getPngMapImportById(second.id)).status, 'substituido');
    assert.deepEqual(await service.listActivePngMapImportsByPropriedade('prop_marks'), []);
    assert.equal(await service.deletePngMapImportMetadata(first.id), true);
    assert.equal(await service.getPngMapImportById(first.id), null);
    assert.equal(await service.deletePngMapImportMetadata(first.id), false);
  });

  await test('compatibilidade: servico nao altera Sela, Mapa.list, MapasScreen ou storage de arquivo', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'PngMapImportService.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('Mapa.list'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('sela-prata-i'), false);
    assert.equal(source.includes('GeoJsonStorageService'), false);
    assert.equal(source.includes('copyAsync'), false);
    assert.equal(source.includes('writeAsStringAsync'), false);
    assert.equal(source.includes('@tche:mock-mvp:v1'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de PngMapImportService passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
