const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const run = async () => {
  const viewer = read('src/screens/MaterialViewerScreen.tsx');
  const mapas = read('src/screens/MapasScreen.tsx');
  const produtor = read('src/screens/ProdutorScreen.tsx');
  const navigation = read('src/navigation/index.tsx');

  await test('rota dedicada esta registrada e resolve catalogo no escopo do perfil', () => {
    assert.match(navigation, /name="MaterialViewer"/);
    assert.match(viewer, /MaterialCatalogService\.consultarMateriais/);
    assert.match(viewer, /filtrarProdutoresPorAcesso/);
    assert.match(viewer, /resolveMaterialFromCatalog/);
  });

  await test('tela cobre mapa, zoom de imagem, PDF real quando suportado e arquivo honesto', () => {
    assert.match(viewer, /Camada georreferenciada/);
    assert.match(viewer, /Ampliar imagem/);
    assert.match(viewer, /Math\.min\(4/);
    assert.match(viewer, /<WebView/);
    assert.match(viewer, /Visualização pelo sistema/);
    assert.match(viewer, /Sem prévia disponível/);
  });

  await test('acao de arquivo verifica autorizacao e nao produz sucesso falso ao abrir', () => {
    assert.match(viewer, /podeBaixarMapa\(user, material, fazendasPermitidas\)/);
    assert.match(viewer, /downloadStatus\.podeAbrir/);
    assert.match(viewer, /Linking\.canOpenURL/);
    assert.match(viewer, /FileSystem\.downloadAsync/);
    assert.match(viewer, /Nenhum visualizador compatível conseguiu abrir este PDF/);
  });

  await test('lista abre rota por identidade e preserva gerenciamento local separado', () => {
    assert.match(mapas, /buildMaterialViewerRouteParams/);
    assert.match(mapas, /const podeAcionarMapa = Boolean\(buildMaterialViewerRouteParams\(mapa\)\)/);
    assert.match(mapas, /navigation\.navigate\('MaterialViewer'/);
    assert.match(mapas, /Gerenciar material local/);
    assert.match(produtor, /buildMaterialViewerRouteParams/);
    assert.match(produtor, /navigation\.navigate\('MaterialViewer'/);
    assert.doesNotMatch(produtor, /navigate\('FazendaMapa', getMapaAtualRouteParams/);
  });

  await test('retorno usa pilha e por isso preserva instancia, filtros e posicao da lista', () => {
    assert.match(viewer, /showBack/);
    assert.match(viewer, /navigation\.goBack\(\)/);
    assert.doesNotMatch(viewer, /navigation\.navigate\('Mapas'/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de materialViewerUiCompat passaram.');
  }
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
