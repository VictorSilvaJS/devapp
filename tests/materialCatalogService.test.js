const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildMateriaisCatalogo,
  createMaterialCatalogService,
} = require('../.tmp-domain-compat/src/services/MaterialCatalogService');

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
};

const baseMapa = (overrides = {}) => ({
  id: 'mapa-base-1',
  titulo: 'Mapa base',
  categoria: 'fertilidade',
  fazenda_id: 'prop_a',
  propriedade_id: 'prop_a',
  ano: 2025,
  talhao: 'Propriedade inteira',
  arquivo_nome_original: 'mapa-base.png',
  arquivo_url: 'asset://mapa-base.png',
  formato_arquivo: 'png',
  status: 'liberado',
  visivel_para_produtor: true,
  disponivel_download: true,
  data_criacao: '2025-06-01T00:00:00.000Z',
  versao: 1,
  ...overrides,
});

const materialImport = (overrides = {}) => ({
  id: 'material-1',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  titulo: 'Material unificado',
  categoria: 'fertilidade',
  categoria_label: 'Fertilidade',
  ano: 2025,
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  arquivo_nome_original: 'material-unificado.png',
  arquivo_uri_local: 'file:///app/tche-materiais-tecnicos/prop_a/2025/fertilidade/material-1.png',
  arquivo_mime: 'image/png',
  formato_arquivo: 'png',
  importado_em: '2025-07-01T00:00:00.000Z',
  atualizado_em: '2025-07-01T00:00:00.000Z',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  versao: 1,
  ...overrides,
});

const pngImport = (overrides = {}) => ({
  id: 'png-1',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  titulo: 'PNG legado',
  categoria: 'correcao',
  categoria_label: 'Correção de solo',
  elemento: 'calcario',
  elemento_label: 'Calcário',
  profundidade: '10-20 cm',
  escopo: 'propriedade',
  arquivo_nome_original: 'correcao-legada.png',
  arquivo_uri_local: 'file:///app/tche-png-imports/prop_a/png-1-correcao-legada.png',
  arquivo_mime: 'image/png',
  arquivo_tamanho_bytes: 123,
  ano: 2025,
  importado_em: '2025-06-15T00:00:00.000Z',
  atualizado_em: '2025-06-15T00:00:00.000Z',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  versao: 1,
  ...overrides,
});

const zipImport = (overrides = {}) => ({
  id: 'zip-1',
  propriedade_id: 'prop_a',
  fazenda_id: 'prop_a',
  titulo: 'ZIP legado',
  categoria: 'prescricao',
  categoria_label: 'Prescrição',
  camada: 'taxa_variavel',
  camada_label: 'Taxa variável',
  escopo: 'propriedade',
  arquivo_nome_original: 'prescricao-legada.zip',
  arquivo_uri_local: 'file:///app/tche-prescription-zips/prop_a/zip-1-prescricao-legada.zip',
  arquivo_mime: 'application/zip',
  arquivo_tamanho_bytes: 456,
  ano: 2025,
  importado_em: '2025-06-10T00:00:00.000Z',
  atualizado_em: '2025-06-10T00:00:00.000Z',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  versao: 1,
  ...overrides,
});

const emptySources = (overrides = {}) => ({
  mapasBase: [],
  pngImports: [],
  prescriptionZipImports: [],
  materialTecnicoImports: [],
  ...overrides,
});

(async () => {
  await test('unifica base, PNG, ZIP e indice atual no mesmo catalogo', () => {
    const materiais = buildMateriaisCatalogo(emptySources({
      mapasBase: [baseMapa()],
      pngImports: [pngImport()],
      prescriptionZipImports: [zipImport()],
      materialTecnicoImports: [materialImport()],
    }), {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.equal(materiais.length, 4);
    assert.deepEqual(
      new Set(materiais.map((item) => item.material_catalog_source)),
      new Set(['mapa_base', 'png_local_legado', 'zip_local_legado', 'material_tecnico_local'])
    );
  });

  await test('aplica Propriedade, categoria, status e disponibilidade antes da contagem', () => {
    const materiais = buildMateriaisCatalogo(emptySources({
      mapasBase: [
        baseMapa({ id: 'ok' }),
        baseMapa({ id: 'fora', fazenda_id: 'prop_b', propriedade_id: 'prop_b' }),
        baseMapa({ id: 'rascunho', status: 'rascunho' }),
        baseMapa({ id: 'indisponivel', disponivel_download: false }),
        baseMapa({ id: 'categoria-fora', categoria: 'indice_vegetacao' }),
      ],
      pngImports: [
        pngImport({ id: 'removido', status: 'removido' }),
        pngImport({ id: 'sem-arquivo', arquivo_uri_local: '' }),
      ],
    }), {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.deepEqual(materiais.map((item) => item.id), ['ok']);
  });

  await test('Produtor recebe somente materiais explicitamente visiveis no catalogo consultavel', () => {
    const fontes = emptySources({
      mapasBase: [
        baseMapa({ id: 'base-visivel' }),
        baseMapa({ id: 'base-oculto', arquivo_nome_original: 'oculto.png', visivel_para_produtor: false }),
      ],
      materialTecnicoImports: [
        materialImport({ id: 'local-visivel' }),
        materialImport({
          id: 'local-oculto',
          arquivo_nome_original: 'local-oculto.png',
          arquivo_uri_local: 'file:///app/tche-materiais-tecnicos/prop_a/2025/fertilidade/local-oculto.png',
          visivel_para_produtor: false,
        }),
      ],
    });

    const produtor = buildMateriaisCatalogo(fontes, {
      propriedadeIds: ['prop_a'],
      perfil: 'produtor',
    });
    const equipe = buildMateriaisCatalogo(fontes, {
      propriedadeIds: ['prop_a'],
      perfil: 'colaborador',
    });

    assert.deepEqual(new Set(produtor.map((item) => item.id)), new Set(['base-visivel', 'material_local:local-visivel']));
    assert.equal(equipe.length, 4);
  });

  await test('deduplica arquivo compativel e prioriza o indice unificado', () => {
    const duplicateBase = baseMapa({
      id: 'fixture-duplicada',
      titulo: 'Fixture antiga',
      arquivo_nome_original: 'DUPLICADO.PNG',
      data_criacao: '2025-01-01T00:00:00.000Z',
    });
    const duplicateLocal = materialImport({
      id: 'duplicado-local',
      titulo: 'Registro canonico',
      arquivo_nome_original: 'duplicado.png',
    });

    const materiais = buildMateriaisCatalogo(emptySources({
      mapasBase: [duplicateBase],
      materialTecnicoImports: [duplicateLocal],
    }), {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.equal(materiais.length, 1);
    assert.equal(materiais[0].id, 'material_local:duplicado-local');
    assert.equal(materiais[0].material_catalog_source, 'material_tecnico_local');
  });

  await test('preserva versoes distintas mesmo quando o nome original coincide', () => {
    const materiais = buildMateriaisCatalogo(emptySources({
      mapasBase: [baseMapa({ arquivo_nome_original: 'mesmo.png', versao: 1 })],
      materialTecnicoImports: [materialImport({ arquivo_nome_original: 'mesmo.png', versao: 2 })],
    }), {
      propriedadeIds: ['prop_a'],
      perfil: 'admin',
    });

    assert.equal(materiais.length, 2);
  });

  await test('nova consulta restaura o mesmo catalogo e reflete remocao persistida', async () => {
    let storedMaterials = [materialImport({ id: 'persistido' })];
    const service = createMaterialCatalogService({
      listMapasBase: async () => [baseMapa({ id: 'base-persistida' })],
      listPngImports: async () => [],
      listPrescriptionZipImports: async () => [],
      listMaterialTecnicoImports: async () => storedMaterials.map((item) => ({ ...item })),
    });
    const query = { propriedadeIds: ['prop_a'], perfil: 'produtor' };

    const primeira = await service.consultarMateriais(query);
    const aposReinicio = await service.consultarMateriais(query);
    assert.deepEqual(
      aposReinicio.materiais.map((item) => item.id),
      primeira.materiais.map((item) => item.id)
    );

    storedMaterials = storedMaterials.map((item) => ({ ...item, status: 'removido' }));
    const aposRemocao = await service.consultarMateriais(query);
    assert.deepEqual(aposRemocao.materiais.map((item) => item.id), ['base-persistida']);
  });

  await test('telas consumidoras usam a consulta central em vez de Mapa.list', () => {
    [
      'src/screens/MapasScreen.tsx',
      'src/screens/ProdutorScreen.tsx',
      'src/screens/DashboardScreen.tsx',
      'src/screens/ClienteDashboardScreen.tsx',
    ].forEach((relativePath) => {
      const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
      assert.match(source, /MaterialCatalogService/);
      assert.doesNotMatch(source, /Mapa\.list\(\)/);
    });
  });

  console.log('\nTodos os testes de MaterialCatalogService passaram.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
