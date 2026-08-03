const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildLocationMapProjection,
} = require('../.tmp-domain-compat/src/utils/locationMapProjectionCompat');

let failed = 0;
let passed = 0;

const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const square = [
  { lat: -14.801, lng: -39.181 },
  { lat: -14.801, lng: -39.179 },
  { lat: -14.799, lng: -39.179 },
  { lat: -14.799, lng: -39.181 },
];

const build = (overrides = {}) => buildLocationMapProjection({
  shapes: [],
  location: {
    latitude: -14.8,
    longitude: -39.18,
    accuracy: 20,
  },
  width: 1000,
  height: 600,
  padding: 50,
  ...overrides,
});

test('ponto sem Talhão fica centralizado e mantém círculo de precisão', () => {
  const projection = build();

  assert.ok(projection.location);
  assert.equal(projection.location.x, 500);
  assert.equal(projection.location.y, 300);
  assert.ok(projection.location.accuracyRadius > 0);
  assert.deepEqual(projection.shapes, []);
});

test('ponto e Talhão usam a mesma projeção e permanecem dentro da área visível', () => {
  const projection = build({
    shapes: [{ id: 'talhao-a', polygons: [square] }],
    location: {
      latitude: -14.7985,
      longitude: -39.1785,
      accuracy: 12,
    },
  });

  assert.equal(projection.shapes.length, 1);
  assert.ok(projection.location);
  assert.ok(projection.location.x >= 50 && projection.location.x <= 950);
  assert.ok(projection.location.y >= 50 && projection.location.y <= 550);
  projection.shapes[0].polygons[0].forEach((point) => {
    assert.ok(point.x >= 50 && point.x <= 950);
    assert.ok(point.y >= 50 && point.y <= 550);
  });
});

test('círculo de precisão participa do enquadramento e não corta o ponto', () => {
  const projection = build({
    location: {
      latitude: -14.8,
      longitude: -39.18,
      accuracy: 180,
    },
  });
  const point = projection.location;

  assert.ok(point);
  assert.ok(point.x - point.accuracyRadius >= 50);
  assert.ok(point.x + point.accuracyRadius <= 950);
  assert.ok(point.y - point.accuracyRadius >= 50);
  assert.ok(point.y + point.accuracyRadius <= 550);
});

test('localização externa ao Talhão continua visível em vez de sumir do fallback', () => {
  const projection = build({
    shapes: [{ id: 'talhao-a', polygons: [square] }],
    location: {
      latitude: -14.79,
      longitude: -39.17,
      accuracy: 8,
    },
  });

  assert.ok(projection.location);
  assert.ok(projection.location.x >= 50 && projection.location.x <= 950);
  assert.ok(projection.location.y >= 50 && projection.location.y <= 550);
});

test('localização inválida é recusada sem apagar geometria válida', () => {
  const projection = build({
    shapes: [{ id: 'talhao-a', polygons: [square] }],
    location: { latitude: 120, longitude: -39.18, accuracy: 10 },
  });

  assert.equal(projection.location, null);
  assert.equal(projection.shapes.length, 1);
});

test('captura solicita leitura única de maior precisão e não reutiliza posição antiga', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src/services/LocationForegroundService.ts'),
    'utf8'
  );

  assert.match(source, /Accuracy\?\.Highest/);
  assert.match(source, /getCurrentPositionAsync/);
  assert.doesNotMatch(source, /getLastKnownPositionAsync/);
  assert.doesNotMatch(source, /watchPosition|startLocationUpdates|TaskManager|geofence/i);
});

test('fallback SVG desenha marcador e precisão mesmo sem Talhões', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/MapaFazendaView.tsx'),
    'utf8'
  );

  assert.match(source, /projection\.location\?\.accuracyRadius/);
  assert.match(source, /<SvgCircle/);
  assert.match(source, /Posição marcada/);
  assert.match(source, /talhoes=\{\[\]\} userLocation=\{userLocation\}/);
  assert.doesNotMatch(source, /disponível apenas no mapa interativo/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam; ${passed} passaram.`);
} else {
  console.log(`\nTodos os ${passed} testes de locationMapProjectionCompat passaram.`);
}
