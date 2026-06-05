const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateAndNormalizeGeoJson,
} = require('../.tmp-domain-compat/src/utils/geojsonImportValidator');

let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const options = (overrides = {}) => ({
  propriedade_id: 'prop_geo',
  ano: 2025,
  safra: '2025/2026',
  corPadrao: '#22C55E',
  data_upload: '2026-06-05T12:00:00.000Z',
  ...overrides,
});

const ring = (lng = -55, lat = -10) => [
  [lng, lat],
  [lng - 0.1, lat],
  [lng - 0.1, lat - 0.1],
  [lng, lat],
];

const openRing = (lng = -55, lat = -10) => [
  [lng, lat],
  [lng - 0.1, lat],
  [lng - 0.1, lat - 0.1],
  [lng, lat - 0.1],
];

const polygonFeature = (properties = {}, coordinates = [ring()], featureOverrides = {}) => ({
  type: 'Feature',
  properties,
  geometry: {
    type: 'Polygon',
    coordinates,
  },
  ...featureOverrides,
});

const multiPolygonFeature = (properties = {}, coordinates = [[ring()], [ring(-56, -11)]]) => ({
  type: 'Feature',
  properties,
  geometry: {
    type: 'MultiPolygon',
    coordinates,
  },
});

const collection = (features) => ({
  type: 'FeatureCollection',
  features,
});

const codes = (issues) => issues.map((issue) => issue.code);

test('normaliza FeatureCollection com um Polygon para o runtime do app', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({
      talhao: 'T01',
      area_hectares: 12.5,
    }),
  ]), options());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.features_count, 1);
  assert.equal(result.summary.talhoes_count, 1);
  assert.equal(result.summary.polygon_parts_count, 1);
  assert.deepEqual(result.summary.geometry_types, ['Polygon']);

  const [talhao] = result.talhoes;
  assert.equal(talhao.id, 'geojson_prop_geo_001_t01');
  assert.equal(talhao.fazenda_id, 'prop_geo');
  assert.equal(talhao.produtor_id, 'prop_geo');
  assert.equal(talhao.talhao, 'T01');
  assert.equal(talhao.nome, 'T01');
  assert.equal(talhao.ano, 2025);
  assert.equal(talhao.safra, '2025/2026');
  assert.equal(talhao.area_hectares, 12.5);
  assert.equal(talhao.cor, '#22C55E');
  assert.equal(talhao.data_upload, '2026-06-05T12:00:00.000Z');
  assert.equal(talhao.disponivel_offline, true);
  assert.deepEqual(talhao.poligono[0], { lat: -10, lng: -55 });
  assert.equal(talhao.poligonos.length, 1);
  assert.deepEqual(talhao.poligonos[0], talhao.poligono);
});

test('normaliza MultiPolygon com poligono principal e partes multiplas', () => {
  const result = validateAndNormalizeGeoJson(collection([
    multiPolygonFeature({
      talhao: 'T02',
      area_ha: 7.25,
    }),
  ]), options());

  assert.equal(result.ok, true);
  assert.equal(result.talhoes.length, 1);
  assert.equal(result.talhoes[0].area_hectares, 7.25);
  assert.equal(result.talhoes[0].poligonos.length, 2);
  assert.deepEqual(result.talhoes[0].poligono, result.talhoes[0].poligonos[0]);
  assert.equal(result.summary.polygon_parts_count, 2);
  assert.deepEqual(result.summary.geometry_types, ['MultiPolygon']);
});

test('normaliza multiplas features e resolve nomes por fallback controlado', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Por talhao', area: 1 }),
    polygonFeature({ nome: 'Por nome', area: 2 }),
    polygonFeature({ name: 'Por name', area: 3 }),
    polygonFeature({ codigo: 'Por codigo', area: 4 }),
    polygonFeature({ id: 123, area: 5 }),
    polygonFeature({ area: 6 }, [ring(-56, -11)], { id: 'feature-id' }),
    polygonFeature({ area: 7 }),
  ]), options());

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.talhoes.map((talhao) => talhao.talhao),
    ['Por talhao', 'Por nome', 'Por name', 'Por codigo', '123', 'feature-id', 'Talhao 7']
  );
  assert.deepEqual(
    result.talhoes.map((talhao) => talhao.area_hectares),
    [1, 2, 3, 4, 5, 6, 7]
  );
  assert.equal(result.summary.features_count, 7);
  assert.equal(result.summary.talhoes_count, 7);
});

test('aceita string JSON valida e rejeita string invalida', () => {
  const valid = validateAndNormalizeGeoJson(JSON.stringify(collection([
    polygonFeature({ talhao: 'String JSON' }),
  ])), options());
  const invalid = validateAndNormalizeGeoJson('{json invalido', options());

  assert.equal(valid.ok, true);
  assert.equal(valid.talhoes[0].talhao, 'String JSON');
  assert.equal(invalid.ok, false);
  assert.deepEqual(codes(invalid.errors), ['INVALID_JSON']);
});

test('rejeita raiz sem type, type diferente, features ausente e features vazia', () => {
  const withoutType = validateAndNormalizeGeoJson({ features: [polygonFeature()] }, options());
  const wrongType = validateAndNormalizeGeoJson({ type: 'Feature', features: [] }, options());
  const missingFeatures = validateAndNormalizeGeoJson({ type: 'FeatureCollection' }, options());
  const emptyFeatures = validateAndNormalizeGeoJson(collection([]), options());

  assert.equal(withoutType.ok, false);
  assert.equal(codes(withoutType.errors).includes('FEATURE_COLLECTION_REQUIRED'), true);
  assert.equal(wrongType.ok, false);
  assert.equal(codes(wrongType.errors).includes('FEATURE_COLLECTION_REQUIRED'), true);
  assert.equal(missingFeatures.ok, false);
  assert.equal(codes(missingFeatures.errors).includes('FEATURES_MISSING'), true);
  assert.equal(emptyFeatures.ok, false);
  assert.equal(codes(emptyFeatures.errors).includes('FEATURES_EMPTY'), true);
});

test('rejeita geometrias incompativeis ou ausentes', () => {
  const point = validateAndNormalizeGeoJson(collection([{
    type: 'Feature',
    properties: { talhao: 'Point' },
    geometry: { type: 'Point', coordinates: [-55, -10] },
  }]), options());
  const lineString = validateAndNormalizeGeoJson(collection([{
    type: 'Feature',
    properties: { talhao: 'Line' },
    geometry: { type: 'LineString', coordinates: [[-55, -10], [-56, -11]] },
  }]), options());
  const nullGeometry = validateAndNormalizeGeoJson(collection([{
    type: 'Feature',
    properties: { talhao: 'Sem geometria' },
    geometry: null,
  }]), options());

  assert.equal(point.ok, false);
  assert.equal(codes(point.errors).includes('GEOMETRY_TYPE_UNSUPPORTED'), true);
  assert.equal(lineString.ok, false);
  assert.equal(codes(lineString.errors).includes('GEOMETRY_TYPE_UNSUPPORTED'), true);
  assert.equal(nullGeometry.ok, false);
  assert.equal(codes(nullGeometry.errors).includes('GEOMETRY_MISSING'), true);
});

test('rejeita coordinates vazias, coordenada nao numerica, fora de faixa e anel curto', () => {
  const emptyCoordinates = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Vazio' }, []),
  ]), options());
  const nonNumeric = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'String' }, [[['-55', -10], [-55.1, -10], [-55.1, -10.1], ['-55', -10]]]),
  ]), options());
  const outOfRange = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Range' }, [[[190, -10], [190, -10.1], [190.1, -10.1], [190, -10]]]),
  ]), options());
  const shortRing = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Curto' }, [[[ -55, -10 ], [ -55.1, -10 ], [ -55, -10 ]]]),
  ]), options());

  assert.equal(emptyCoordinates.ok, false);
  assert.equal(codes(emptyCoordinates.errors).includes('GEOMETRY_COORDINATES_EMPTY'), true);
  assert.equal(nonNumeric.ok, false);
  assert.equal(codes(nonNumeric.errors).includes('COORDINATE_NOT_NUMERIC'), true);
  assert.equal(outOfRange.ok, false);
  assert.equal(codes(outOfRange.errors).includes('COORDINATE_LNG_OUT_OF_RANGE'), true);
  assert.equal(shortRing.ok, false);
  assert.equal(codes(shortRing.errors).includes('RING_TOO_FEW_POINTS'), true);
});

test('fecha anel aberto em memoria com warning', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Aberto' }, [openRing()]),
  ]), options());

  assert.equal(result.ok, true);
  assert.equal(codes(result.warnings).includes('RING_NOT_CLOSED'), true);
  assert.equal(result.talhoes[0].poligono.length, 5);
  assert.deepEqual(
    result.talhoes[0].poligono[0],
    result.talhoes[0].poligono[result.talhoes[0].poligono.length - 1]
  );
});

test('avisa nomes duplicados sem rejeitar importacao', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Duplicado' }, [ring()]),
    polygonFeature({ nome: 'Duplicado' }, [ring(-56, -11)]),
  ]), options());

  assert.equal(result.ok, true);
  assert.equal(codes(result.warnings).includes('DUPLICATE_TALHAO_NAME'), true);
  assert.equal(result.talhoes.length, 2);
});

test('ignora interior rings com warning', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Com hole' }, [ring(), ring(-55.02, -10.02)]),
  ]), options());

  assert.equal(result.ok, true);
  assert.equal(codes(result.warnings).includes('INTERIOR_RING_IGNORED'), true);
  assert.equal(result.talhoes[0].poligonos.length, 1);
});

test('detecta provavel inversao lat/lng evidente sem corrigir silenciosamente', () => {
  const inverted = [
    [-10, -120],
    [-10.1, -120],
    [-10.1, -120.1],
    [-10, -120],
  ];
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Invertido' }, [inverted]),
  ]), options());

  assert.equal(result.ok, false);
  assert.equal(codes(result.warnings).includes('PROBABLE_LAT_LNG_INVERSION'), true);
  assert.equal(codes(result.errors).includes('COORDINATE_LAT_OUT_OF_RANGE'), true);
  assert.equal(result.talhoes.length, 0);
});

test('preenche fazenda_id e produtor_id por fallback compativel', () => {
  const defaultScope = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Escopo padrao' }),
  ]), options({ propriedade_id: 'prop_escopo' }));
  const explicitScope = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Escopo explicito' }),
  ]), options({
    propriedade_id: 'prop_escopo',
    fazenda_id: 'fazenda_legada',
    produtor_id: 'produtor_legado',
  }));

  assert.equal(defaultScope.talhoes[0].fazenda_id, 'prop_escopo');
  assert.equal(defaultScope.talhoes[0].produtor_id, 'prop_escopo');
  assert.equal(explicitScope.talhoes[0].fazenda_id, 'fazenda_legada');
  assert.equal(explicitScope.talhoes[0].produtor_id, 'produtor_legado');
});

test('gera IDs estaveis em duas execucoes iguais', () => {
  const input = collection([
    polygonFeature({ talhao: 'Talhao Estavel' }),
  ]);
  const first = validateAndNormalizeGeoJson(input, options());
  const second = validateAndNormalizeGeoJson(input, options());

  assert.equal(first.talhoes[0].id, second.talhoes[0].id);
});

test('caracteriza amostra leve compativel com campos da Sela de Prata I', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({
      fazenda_id: 'p_sela1',
      talhao: 'T01 - 230',
      nome: 'LT 2025 - T01 - 230',
      ano: 2025,
      area_hectares: 274.1,
    }),
  ]), options({
    propriedade_id: 'p_sela1',
    safra: '2025/2026',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.talhoes[0].fazenda_id, 'p_sela1');
  assert.equal(result.talhoes[0].produtor_id, 'p_sela1');
  assert.equal(result.talhoes[0].talhao, 'T01 - 230');
  assert.equal(result.talhoes[0].nome, 'T01 - 230');
  assert.equal(result.talhoes[0].ano, 2025);
  assert.equal(result.talhoes[0].area_hectares, 274.1);
});

test('helper puro nao importa storage, picker, filesystem, telas ou mocks', () => {
  const sourcePath = path.resolve(__dirname, '..', 'src', 'utils', 'geojsonImportValidator.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.equal(source.includes('AsyncStorage'), false);
  assert.equal(source.includes('FileSystem'), false);
  assert.equal(source.includes('DocumentPicker'), false);
  assert.equal(source.includes('expo-file-system'), false);
  assert.equal(source.includes('expo-document-picker'), false);
  assert.equal(source.includes('GeoJsonImportService'), false);
  assert.equal(source.includes('LimiteArea'), false);
  assert.equal(source.includes('MapasScreen'), false);
  assert.equal(source.includes('FazendaMapaScreen'), false);
  assert.equal(source.includes('MapaFazendaView'), false);
  assert.equal(source.includes('ShapeRenderer'), false);
});

test('saida normalizada nao persiste FeatureCollection, features ou coordinates brutas', () => {
  const result = validateAndNormalizeGeoJson(collection([
    polygonFeature({ talhao: 'Sem bruto' }),
  ]), options());
  const serializedTalhoes = JSON.stringify(result.talhoes);

  assert.equal(serializedTalhoes.includes('FeatureCollection'), false);
  assert.equal(serializedTalhoes.includes('"features"'), false);
  assert.equal(serializedTalhoes.includes('"coordinates"'), false);
  assert.equal(serializedTalhoes.includes('"poligono"'), true);
  assert.equal(serializedTalhoes.includes('"poligonos"'), true);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de GeoJsonImportValidator passaram.');
}
