const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CADERNO_LOCALIZACAO_TOLERANCIA_PADRAO_M,
  appendCadernoLocalizacaoSpatialAssessment,
  assessCadernoLocationAgainstTalhao,
  getCadernoLocalizacaoRelacaoLabel,
  normalizeCadernoLocalizacaoSpatialAssessment,
  resolveCadernoTalhaoGeometry,
  validateCadernoLocalizacaoSpatialAssessment,
} = require('../.tmp-domain-compat/src/utils/cadernoLocalizacaoSpatialCompat');
const { validateCadernoCampo } = require('../.tmp-domain-compat/src/api/validators');
const { CadernoCampo, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');
const { toCadernoProducerProjection } = require('../.tmp-domain-compat/src/utils/cadernoLifecycleCompat');

let failed = 0;
let passed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const square = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.001 },
  { lat: 0.001, lng: 0.001 },
  { lat: 0.001, lng: 0 },
];

const geometries = [
  {
    id: 'limite-2024',
    talhao_id: 'talhao-a',
    talhao: 'Talhão A',
    ano: 2024,
    data_upload: '2024-01-01T00:00:00.000Z',
    poligono: square,
  },
  {
    id: 'limite-2026',
    talhao_id: 'talhao-a',
    talhao: 'Talhão A',
    ano: 2026,
    data_upload: '2026-01-01T00:00:00.000Z',
    poligono: square,
  },
];

const location = (overrides = {}) => ({
  localizacao_latitude: 0.0005,
  localizacao_longitude: 0.0005,
  localizacao_accuracy: 8,
  localizacao_captured_at: '2026-08-03T12:00:00.000Z',
  localizacao_captured_by: 'usuario-1',
  localizacao_origem: 'foreground_explicit',
  ...overrides,
});

const baseRecord = (overrides = {}) => ({
  id: 'cad-mp26',
  fazenda_id: 'faz-1',
  colaborador_responsavel: 'Pessoa de teste',
  responsavel_usuario_id: 'usuario-1',
  data_atividade: '2026-08-03T12:00:00.000Z',
  tipo_atividade: 'observacao',
  observacoes: 'Registro espacial',
  talhao_id: 'talhao-a',
  talhao_nome: 'Talhão A',
  ...location(),
  ...overrides,
});

const storageValues = new Map();
const storageAdapter = {
  getItem: async (key) => storageValues.get(key) ?? null,
  setItem: async (key, value) => storageValues.set(key, value),
  removeItem: async (key) => storageValues.delete(key),
};

const run = async () => {
  MockLocalData.__setStorageForTests(storageAdapter);
  await MockLocalData.restoreSeed();

  await test('resolve a versão mais recente da geometria pelo ID lógico do Talhão', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'talhao-a');
    assert.ok(geometry);
    assert.equal(geometry.geometryVersionId, 'limite-2026');
    assert.equal(geometry.year, 2026);
    assert.equal(geometry.source, 'limite_area_local');
  });

  await test('resolve também a versão física persistida sem trocar a identidade lógica', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'limite-2024');
    assert.ok(geometry);
    assert.equal(geometry.geometryVersionId, 'limite-2024');
    assert.equal(geometry.talhaoId, 'limite-2024');
  });

  await test('ponto interno e ponto sobre o limite são classificados como dentro', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'talhao-a');
    const inside = assessCadernoLocationAgainstTalhao({
      latitude: 0.0005,
      longitude: 0.0005,
      accuracy: 5,
      geometry,
    });
    const boundary = assessCadernoLocationAgainstTalhao({
      latitude: 0.0005,
      longitude: 0.001,
      accuracy: 5,
      geometry,
    });
    assert.equal(inside.localizacao_relacao_talhao, 'dentro');
    assert.equal(inside.localizacao_distancia_talhao_m, 0);
    assert.equal(boundary.localizacao_relacao_talhao, 'dentro');
  });

  await test('ponto externo alcançado por precisão mais tolerância é próximo', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'talhao-a');
    const assessment = assessCadernoLocationAgainstTalhao({
      latitude: 0.0005,
      longitude: 0.0011,
      accuracy: 3,
      geometry,
    });
    assert.equal(assessment.localizacao_relacao_talhao, 'proximo');
    assert.ok(assessment.localizacao_distancia_talhao_m > 10);
    assert.equal(assessment.localizacao_tolerancia_talhao_m, CADERNO_LOCALIZACAO_TOLERANCIA_PADRAO_M);
  });

  await test('ponto além da precisão e tolerância é fora', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'talhao-a');
    const assessment = assessCadernoLocationAgainstTalhao({
      latitude: 0.0005,
      longitude: 0.003,
      accuracy: 10,
      geometry,
    });
    assert.equal(assessment.localizacao_relacao_talhao, 'fora');
    assert.ok(assessment.localizacao_distancia_talhao_m > 200);
  });

  await test('precisão alta amplia somente a faixa próximo, sem transformar ponto externo em dentro', () => {
    const geometry = resolveCadernoTalhaoGeometry(geometries, 'talhao-a');
    const assessment = assessCadernoLocationAgainstTalhao({
      latitude: 0.0005,
      longitude: 0.0019,
      accuracy: 100,
      geometry,
    });
    assert.equal(assessment.localizacao_relacao_talhao, 'proximo');
  });

  await test('avaliação anexada preserva versão, fonte, ano, distância e tolerância', () => {
    const assessed = appendCadernoLocalizacaoSpatialAssessment(baseRecord(), geometries);
    assert.equal(assessed.localizacao_relacao_talhao, 'dentro');
    assert.equal(assessed.talhao_geometria_versao_id, 'limite-2026');
    assert.equal(assessed.talhao_geometria_fonte, 'limite_area_local');
    assert.equal(assessed.talhao_geometria_ano, 2026);
    assert.equal(getCadernoLocalizacaoRelacaoLabel(assessed), 'Dentro do Talhão');
    assert.equal(validateCadernoCampo(assessed), true);
  });

  await test('submit persiste avaliação no original e projeção do Produtor omite detalhe técnico', async () => {
    const assessed = appendCadernoLocalizacaoSpatialAssessment(baseRecord(), geometries);
    const actor = {
      usuarioId: 'usuario-1',
      nome: 'Pessoa de teste',
      perfil: 'admin',
      propriedadeIds: ['faz-1'],
    };
    const created = await CadernoCampo.submit(assessed, actor);
    const restored = await CadernoCampo.get(created.id);
    assert.equal(restored.localizacao_relacao_talhao, 'dentro');
    assert.equal(restored.talhao_geometria_versao_id, 'limite-2026');
    assert.equal(restored.conteudo_original.talhao_geometria_versao_id, 'limite-2026');

    const producer = toCadernoProducerProjection(restored);
    assert.equal(producer.localizacao_relacao_talhao, 'dentro');
    assert.equal(Object.hasOwn(producer, 'talhao_geometria_versao_id'), false);
    assert.equal(Object.hasOwn(producer, 'localizacao_distancia_talhao_m'), false);
    assert.equal(Object.hasOwn(producer, 'localizacao_captured_by'), false);
  });

  await test('sem ponto, sem Talhão ou sem geometria não inventa avaliação', () => {
    const withoutPoint = appendCadernoLocalizacaoSpatialAssessment(
      baseRecord({
        localizacao_latitude: undefined,
        localizacao_longitude: undefined,
        localizacao_accuracy: undefined,
        localizacao_captured_at: undefined,
        localizacao_captured_by: undefined,
        localizacao_origem: undefined,
      }),
      geometries
    );
    const withoutTalhao = appendCadernoLocalizacaoSpatialAssessment(
      baseRecord({ talhao_id: undefined }),
      geometries
    );
    assert.equal(normalizeCadernoLocalizacaoSpatialAssessment(withoutPoint), null);
    assert.equal(normalizeCadernoLocalizacaoSpatialAssessment(withoutTalhao), null);
  });

  await test('grupo espacial parcial ou sem localização é rejeitado', () => {
    const partial = validateCadernoLocalizacaoSpatialAssessment({
      localizacao_relacao_talhao: 'dentro',
    });
    assert.equal(partial.valid, false);
    assert.throws(
      () => validateCadernoCampo({
        ...baseRecord({
          localizacao_latitude: undefined,
          localizacao_longitude: undefined,
          localizacao_accuracy: undefined,
          localizacao_captured_at: undefined,
          localizacao_captured_by: undefined,
          localizacao_origem: undefined,
        }),
        ...appendCadernoLocalizacaoSpatialAssessment(baseRecord(), geometries),
        localizacao_latitude: undefined,
        localizacao_longitude: undefined,
        localizacao_accuracy: undefined,
        localizacao_captured_at: undefined,
        localizacao_captured_by: undefined,
        localizacao_origem: undefined,
      }),
      /exige uma localização válida/
    );
  });

  await test('detalhe usa mini mapa, aviso persistente e recolhe coordenadas na área técnica', () => {
    const detail = fs.readFileSync(
      path.join(__dirname, '..', 'src/screens/CadernoDetailScreen.tsx'),
      'utf8'
    );
    const preview = fs.readFileSync(
      path.join(__dirname, '..', 'src/components/CadernoLocalizacaoPreview.tsx'),
      'utf8'
    );
    assert.match(detail, /CadernoLocalizacaoPreview/);
    assert.match(detail, /Baixa precisão na leitura/);
    assert.match(detail, /Detalhes técnicos/);
    assert.match(detail, /Ver no mapa/);
    assert.match(detail, /!isProdutorView && showTechnicalLocation/);
    assert.match(preview, /<SvgCircle/);
    assert.match(preview, /<SvgPolygon/);
    assert.match(preview, /accuracyRadius/);
    assert.doesNotMatch(preview, /react-native-maps/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam; ${passed} passaram.`);
  } else {
    console.log(`\nTodos os ${passed} testes de cadernoLocalizacaoSpatialCompat passaram.`);
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
