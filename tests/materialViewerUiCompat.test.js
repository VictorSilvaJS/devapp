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
  const app = read('App.tsx');
  const exportService = read('src/services/PhoneFileExportService.ts');

  await test('rota dedicada esta registrada e resolve catalogo no escopo do perfil', () => {
    assert.match(navigation, /name="MaterialViewer"/);
    assert.match(viewer, /MaterialCatalogService\.consultarMateriais/);
    assert.match(viewer, /filtrarProdutoresPorAcesso/);
    assert.match(viewer, /resolveMaterialFromCatalog/);
  });

  await test('tela cobre mapa, zoom de imagem, PDF real quando suportado e arquivo honesto', () => {
    assert.match(viewer, /Camada georreferenciada/);
    assert.match(viewer, /Ampliar imagem/);
    assert.match(viewer, /MATERIAL_IMAGE_MAX_ZOOM/);
    assert.match(viewer, /<WebView/);
    assert.match(viewer, /Visualização pelo sistema/);
    assert.match(viewer, /Sem prévia disponível/);
  });

  await test('imagem usa modal de tela cheia, pinca, arraste e toque duplo com alternativa acessivel', () => {
    assert.match(navigation, /presentation: 'transparentModal'/);
    assert.match(navigation, /animation: 'slide_from_bottom'/);
    assert.match(app, /GestureHandlerRootView/);
    assert.match(viewer, /Gesture\.Pinch\(\)/);
    assert.match(viewer, /Gesture\.Pan\(\)/);
    assert.match(viewer, /Gesture\.Race\(/);
    assert.match(viewer, /numberOfTaps\(2\)/);
    assert.match(viewer, /Use pinça ou toque duas vezes/);
    assert.match(viewer, /accessibilityLabel="Redefinir ampliação"/);
  });

  await test('toque dentro da imagem neutraliza a rolagem da pagina externa', () => {
    assert.match(viewer, /onTouchStart=\{\(\) => onInteractionChange\(true\)\}/);
    assert.match(viewer, /onTouchEnd=\{\(event\) => onInteractionChange\(event\.nativeEvent\.touches\.length > 0\)\}/);
    assert.match(viewer, /onTouchCancel=\{\(\) => onInteractionChange\(false\)\}/);
    assert.match(viewer, /scrollEnabled=\{!imageTouchActive\}/);
    assert.match(viewer, /Gestos iniciados no quadro não rolam a página/);
  });

  await test('PDF oferece download real e abertura separada sem produzir sucesso falso', () => {
    assert.match(viewer, /podeBaixarMapa\(user, material, fazendasPermitidas\)/);
    assert.match(viewer, /downloadStatus\.podeAbrir/);
    assert.match(viewer, /MaterialTecnicoStorageService\.getStoredMaterialTecnicoInfo/);
    assert.match(viewer, /Este PDF não está mais disponível neste aparelho/);
    assert.match(viewer, /Linking\.canOpenURL/);
    assert.match(viewer, /exportFileToPhone/);
    assert.match(viewer, /descriptor\.kind === 'pdf'[\s\S]*?'application\/pdf'/);
    assert.doesNotMatch(viewer, /if \(descriptor\.kind !== 'pdf'\) \{/);
    assert.match(viewer, /handleDownloadFile/);
    assert.match(viewer, /handleOpenPdf/);
    assert.match(viewer, /Abrir documento/);
    assert.match(viewer, /Arquivo salvo na pasta escolhida como/);
    assert.match(viewer, /Nenhum arquivo foi criado/);
    assert.match(exportService, /requestDirectoryPermissionsAsync/);
    assert.match(exportService, /createFileAsync/);
    assert.match(viewer, /Não foi possível baixar este PDF/);
    assert.match(viewer, /Nenhum visualizador compatível conseguiu abrir este PDF/);
  });

  await test('lista abre rota por identidade e preserva gerenciamento local separado', () => {
    assert.match(mapas, /buildMaterialViewerRouteParams/);
    assert.match(mapas, /const podeAcionarMapa = Boolean\(buildMaterialViewerRouteParams\(mapa\)\)/);
    assert.match(mapas, /navigation\.navigate\('MaterialViewer'/);
    assert.match(mapas, /Gerenciar material local/);
    assert.match(produtor, /buildMaterialViewerRouteParams/);
    assert.match(produtor, /navigation\.navigate\('MaterialViewer'/);
    assert.match(produtor, /skipNextMaterialFocusReloadRef/);
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
