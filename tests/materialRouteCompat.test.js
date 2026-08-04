const assert = require('node:assert/strict');

const {
  buildMaterialViewerRouteParams,
  extractMaterialGeoPolygons,
  resolveMaterialFromCatalog,
  resolveMaterialViewerDescriptor,
  resolveMaterialViewerIdentity,
} = require('../.tmp-domain-compat/src/navigation/materialRouteCompat');

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

const baseMaterial = (overrides = {}) => ({
  id: 'material_local:mat_1',
  propriedade_id: 'prop_1',
  fazenda_id: 'prop_1',
  versao: 2,
  formato_arquivo: 'png',
  arquivo_uri_local: 'file:///app/tche-materiais-tecnicos/prop_1/mat_1.png',
  ...overrides,
});

const run = async () => {
  await test('rota transporta material_id, versao e contexto da Propriedade', () => {
    assert.deepEqual(buildMaterialViewerRouteParams(baseMaterial()), {
      materialId: 'material_local:mat_1',
      materialVersion: '2',
      fazendaId: 'prop_1',
      produtorId: 'prop_1',
    });
  });

  await test('legado sem versao recebe v1 implicita e rota incompleta e recusada', () => {
    assert.equal(buildMaterialViewerRouteParams(baseMaterial({ versao: undefined })).materialVersion, '1');
    assert.equal(resolveMaterialViewerIdentity({ materialId: 'mat_1' }), null);
    assert.deepEqual(resolveMaterialViewerIdentity({ material_id: 'mat_1', versao: 'v3' }), {
      materialId: 'mat_1',
      materialVersion: 'v3',
      fazendaId: undefined,
    });
  });

  await test('resolucao exige id, versao e Propriedade da rota', () => {
    const materiais = [
      baseMaterial({ id: 'mat', versao: 1 }),
      baseMaterial({ id: 'mat', versao: 2 }),
      baseMaterial({ id: 'mat', versao: 2, propriedade_id: 'prop_2', fazenda_id: 'prop_2' }),
    ];

    assert.equal(resolveMaterialFromCatalog(materiais, {
      materialId: 'mat', materialVersion: 'v2', fazendaId: 'prop_1',
    }), materiais[1]);
    assert.equal(resolveMaterialFromCatalog(materiais, {
      materialId: 'mat', materialVersion: '3', fazendaId: 'prop_1',
    }), null);
    assert.equal(resolveMaterialFromCatalog(materiais, {
      materialId: 'mat', materialVersion: '2', fazendaId: 'prop_3',
    }), null);
  });

  await test('tipo real escolhe imagem, PDF e arquivo sem preview falso', () => {
    assert.equal(resolveMaterialViewerDescriptor(baseMaterial()).kind, 'image');
    assert.equal(resolveMaterialViewerDescriptor(baseMaterial({
      formato_arquivo: 'pdf',
      arquivo_uri_local: 'file:///app/documento.pdf',
    })).kind, 'pdf');

    const zip = resolveMaterialViewerDescriptor(baseMaterial({
      formato_arquivo: 'zip',
      arquivo_uri_local: 'file:///app/prescricao.zip',
    }));
    assert.equal(zip.kind, 'file');
    assert.equal(zip.previewAvailable, false);
    assert.match(zip.noPreviewMessage, /não descompacta nem simula uma prévia/);
  });

  await test('camada somente vira mapa quando existem geometrias renderizaveis', () => {
    const material = baseMaterial({
      formato_arquivo: 'geojson',
      arquivo_uri_local: 'file:///app/camada.geojson',
      camada_geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          id: 'faixa_1',
          properties: { label: 'pH baixo', valor: '4,8', cor: '#C02626' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-53.6, -28.6],
              [-53.5, -28.6],
              [-53.5, -28.5],
              [-53.6, -28.6],
            ]],
          },
        }],
      },
    });

    const polygons = extractMaterialGeoPolygons(material);
    const descriptor = resolveMaterialViewerDescriptor(material);
    assert.equal(polygons.length, 1);
    assert.equal(polygons[0].label, 'pH baixo');
    assert.equal(polygons[0].value, '4,8');
    assert.equal(descriptor.kind, 'geospatial');
    assert.equal(descriptor.previewAvailable, true);
  });

  await test('extensao e MIME servem apenas como fallback do formato declarado', () => {
    assert.equal(resolveMaterialViewerDescriptor({
      id: 'img',
      versao: 1,
      arquivo_url: 'https://cdn.example.com/mapa.JPEG?token=1',
    }).format, 'jpg');
    assert.equal(resolveMaterialViewerDescriptor({
      id: 'doc',
      versao: 1,
      arquivo_mime: 'application/pdf',
      arquivo_url: 'https://cdn.example.com/arquivo',
    }).kind, 'pdf');
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de materialRouteCompat passaram.');
  }
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
