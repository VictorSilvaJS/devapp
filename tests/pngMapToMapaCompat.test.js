const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PNG_LOCAL_MAPA_OPEN_MESSAGE,
  canShowPngMapImportInMapaList,
  evaluatePngLocalMapaOpen,
  isPngLocalMapa,
  mergeMapasWithPngMapImports,
  pngMapImportToMapaCompat,
  pngMapImportsToMapaCompatList,
} = require('../.tmp-domain-compat/src/utils/pngMapToMapaCompat');

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

const baseMetadata = (overrides = {}) => ({
  id: 'png_001',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  nome_propriedade: 'Propriedade A',
  titulo: 'pH local Propriedade A',
  descricao: 'Observacao tecnica do PNG local.',
  categoria: 'fertilidade',
  categoria_label: 'Fertilidade',
  elemento: 'ph',
  elemento_label: 'pH',
  safra: '2025/2026',
  ano: 2026,
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  arquivo_nome_original: 'Mapa pH Local.PNG',
  arquivo_uri_local: 'file:///app/tche-png-imports/prop_a/png_001-mapa-ph-local.png',
  arquivo_tamanho_bytes: 123456,
  arquivo_mime: 'image/png',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin',
  importado_em: '2026-06-05T15:00:00.000Z',
  atualizado_em: '2026-06-05T15:00:01.000Z',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  versao: 1,
  ...overrides,
});

const run = async () => {
  await test('converte metadado PNG para item compativel de mapa', () => {
    const item = pngMapImportToMapaCompat(baseMetadata());

    assert.equal(item.id, 'png_local:png_001');
    assert.equal(item.titulo, 'pH local Propriedade A');
    assert.equal(item.categoria, 'fertilidade');
    assert.equal(item.categoria_label, 'Fertilidade');
    assert.equal(item.subcategoria, 'pH');
    assert.equal(item.tipo_anexo, 'anexo_png_local');
    assert.equal(item.tipo_material, 'png_local');
    assert.equal(item.elemento, 'ph');
    assert.equal(item.elemento_label, 'pH');
    assert.equal(item.formato_arquivo, 'png');
    assert.equal(item.origem, 'arquivo_local');
    assert.equal(item.status, 'ativo');
    assert.equal(item.disponivel_download, true);
    assert.equal(item.data_criacao, '2026-06-05T15:00:00.000Z');
    assert.equal(item.data_atualizacao, '2026-06-05T15:00:01.000Z');
  });

  await test('preserva arquivo_uri_local sem expor URI como titulo', () => {
    const item = pngMapImportToMapaCompat(baseMetadata({
      titulo: 'Mapa tecnico cadastrado',
      arquivo_uri_local: 'file:///app/tche-png-imports/prop_a/arquivo-interno.png',
    }));

    assert.equal(item.arquivo_uri_local, 'file:///app/tche-png-imports/prop_a/arquivo-interno.png');
    assert.equal(item.arquivo_url, 'file:///app/tche-png-imports/prop_a/arquivo-interno.png');
    assert.equal(item.titulo.includes('file:///'), false);
    assert.equal(item.arquivo_nome_original, 'Mapa pH Local.PNG');
  });

  await test('mapeia categoria e labels amigaveis', () => {
    assert.equal(pngMapImportToMapaCompat(baseMetadata({ elemento: 'fosforo' })).elemento_label, 'Fósforo');
    assert.equal(pngMapImportToMapaCompat(baseMetadata({ elemento: 'potassio' })).elemento_label, 'Potássio');
    assert.equal(pngMapImportToMapaCompat(baseMetadata({ elemento: 'materia_organica' })).elemento_label, 'Matéria orgânica');
    assert.equal(pngMapImportToMapaCompat(baseMetadata({
      categoria: 'indice_vegetacao',
      categoria_label: 'Indice de vegetacao',
      elemento: 'ndvi',
      elemento_label: 'NDVI',
    })).categoria_label, 'Índice de vegetação');
    assert.equal(pngMapImportToMapaCompat(baseMetadata({
      categoria: 'outro',
      categoria_label: 'Outro',
      elemento: 'outro',
      elemento_label: 'Outro',
    })).subcategoria, 'Material técnico');
  });

  await test('escopo propriedade vira Propriedade inteira', () => {
    const item = pngMapImportToMapaCompat(baseMetadata({
      escopo: 'propriedade',
      talhao_id: undefined,
      talhao_nome: undefined,
    }));

    assert.equal(item.talhao, 'Propriedade inteira');
    assert.equal(item.talhao_nome, 'Propriedade inteira');
    assert.equal(item.talhao_id, null);
  });

  await test('escopo talhao usa talhao_nome', () => {
    const item = pngMapImportToMapaCompat(baseMetadata({
      escopo: 'talhao',
      talhao_id: 'T01',
      talhao_nome: 'Talhao Norte',
    }));

    assert.equal(item.talhao, 'Talhao Norte');
    assert.equal(item.talhao_nome, 'Talhao Norte');
    assert.equal(item.talhao_id, 'T01');
  });

  await test('preenche fazenda_id, propriedade_id e safra por ano quando necessario', () => {
    const item = pngMapImportToMapaCompat(baseMetadata({
      propriedade_id: 'prop_dupla',
      fazenda_id: 'fazenda_dupla',
      safra: undefined,
      ano: 2025,
    }));

    assert.equal(item.propriedade_id, 'prop_dupla');
    assert.equal(item.fazenda_id, 'fazenda_dupla');
    assert.equal(item.produtor_id, 'fazenda_dupla');
    assert.equal(item.safra, '2025');
    assert.equal(item.ano, 2025);
  });

  await test('status ativo entra e removido/substituido nao entram na lista ativa', () => {
    const items = pngMapImportsToMapaCompatList([
      baseMetadata({ id: 'ativo', status: 'ativo' }),
      baseMetadata({ id: 'removido', status: 'removido' }),
      baseMetadata({ id: 'substituido', status: 'substituido' }),
    ], {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.deepEqual(items.map((item) => item.png_map_import_id), ['ativo']);
  });

  await test('multiplos PNGs ativos aparecem e Propriedade A nao recebe PNG da B', () => {
    const items = pngMapImportsToMapaCompatList([
      baseMetadata({ id: 'a1', propriedade_id: 'prop_a', fazenda_id: 'prop_a' }),
      baseMetadata({ id: 'a2', propriedade_id: 'prop_a', fazenda_id: 'prop_a' }),
      baseMetadata({ id: 'b1', propriedade_id: 'prop_b', fazenda_id: 'prop_b' }),
    ], {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.deepEqual(items.map((item) => item.png_map_import_id), ['a1', 'a2']);
  });

  await test('produtor so ve PNG visivel e admin/colaborador veem nao visivel', () => {
    const oculto = baseMetadata({ id: 'oculto', visivel_para_produtor: false });

    assert.equal(canShowPngMapImportInMapaList(oculto, {
      propriedadeIds: ['prop_a'],
      perfil: 'produtor',
    }), false);
    assert.equal(canShowPngMapImportInMapaList(oculto, {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    }), true);
    assert.equal(canShowPngMapImportInMapaList(oculto, {
      propriedadeIds: ['prop_a'],
      perfil: 'colaborador',
    }), true);
  });

  await test('lista combinada preserva mapas mockados e nao substitui PNG mockado da Sela', () => {
    const mapaMockado = {
      id: 'm_sela1_ph_10a20_2025',
      titulo: 'pH - Fazenda Sela de Prata I',
      categoria: 'fertilidade',
      fazenda_id: 'p_sela1',
      arquivo_url: 'asset://mapas/sela-prata-i/2025/fertilidade/ph_10a20.png',
    };
    const merged = mergeMapasWithPngMapImports([
      mapaMockado,
    ], [
      baseMetadata({
        id: 'png_sela_local',
        propriedade_id: 'p_sela1',
        fazenda_id: 'p_sela1',
        titulo: 'pH local Sela',
      }),
    ], {
      propriedadeIds: ['p_sela1'],
      perfil: 'admin',
    });

    assert.equal(merged.length, 2);
    assert.equal(merged[0], mapaMockado);
    assert.equal(merged[1].id, 'png_local:png_sela_local');
    assert.equal(merged[1].titulo, 'pH local Sela');
  });

  await test('PNG local e identificado e abertura retorna aviso controlado nesta fase', () => {
    const item = pngMapImportToMapaCompat(baseMetadata());
    const status = evaluatePngLocalMapaOpen(item);

    assert.equal(isPngLocalMapa(item), true);
    assert.equal(status.supported, false);
    assert.equal(status.message, PNG_LOCAL_MAPA_OPEN_MESSAGE);
    assert.deepEqual(evaluatePngLocalMapaOpen({ id: 'mock' }), {
      supported: true,
      message: '',
    });
  });

  await test('helper nao importa telas, mocks, assets, require ou storage', () => {
    const sourcePath = path.resolve(__dirname, '..', 'src', 'utils', 'pngMapToMapaCompat.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.equal(source.includes('MapasScreen'), false);
    assert.equal(source.includes('../api/mock'), false);
    assert.equal(source.includes('src/api/mock'), false);
    assert.equal(source.includes('resolveSelaPrataIFertilidadeAssetSource'), false);
    assert.equal(source.includes('require('), false);
    assert.equal(source.includes('AsyncStorage'), false);
    assert.equal(source.includes('expo-file-system'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('\nTodos os testes de pngMapToMapaCompat passaram.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
