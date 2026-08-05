const assert = require('node:assert/strict');
const {
  validateProdutor,
  validateUser,
  validateMapa,
  validateVisita,
  validateCadernoCampo,
  validateLimiteArea,
} = require('../.tmp-domain-compat/src/api/validators');

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

test('validateUser aceita full_name legado e normaliza para nome', () => {
  assert.equal(validateUser({
    full_name: 'Bruna Administradora',
    email: 'bruna@agrotche.com',
    senha: '123456',
    perfil: 'admin',
  }), true);
});

test('validateProdutor aceita payload explícito de fazenda sem quebrar legado atual', () => {
  const warnOriginal = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  try {
    assert.equal(validateProdutor({
      nome: 'Fazenda Aurora',
      produtor_nome: 'José da Silva',
      produtor_id: 'prop_jose',
      area_total: 220,
    }), true);
  } finally {
    console.warn = warnOriginal;
  }

  assert.equal(warnings.length, 0);
});

test('validateMapa aceita propriedade_id canônico e panorama do catálogo provisório', () => {
  assert.equal(validateMapa({
    titulo: 'Mapa Panorama',
    categoria: 'panorama',
    propriedade_id: 'p1',
    talhao_nome: 'Área total',
  }), true);
});

test('validateMapa aceita categoria fora do catálogo final sem quebrar a borda atual', () => {
  const warnOriginal = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  try {
    assert.equal(validateMapa({
      titulo: 'Mapa Especial',
      categoria: 'categoria_interna',
      propriedade_id: 'p1',
      talhao_nome: 'Talhão A',
    }), true);
  } finally {
    console.warn = warnOriginal;
  }

  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('fora do catálogo provisório'));
});

test('validateVisita aceita propriedade_id canônico', () => {
  assert.equal(validateVisita({
    propriedade_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
    data_visita: '2026-04-14T10:00:00.000Z',
    objetivo: 'consultoria',
  }), true);
});

test('validateCadernoCampo aceita propriedade_id canônico', () => {
  assert.equal(validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'vistoria',
  }), true);
});

test('validateCadernoCampo aceita tipos enxutos da Fase 17D', () => {
  assert.equal(validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'ocorrencia',
  }), true);
});

test('validateCadernoCampo aceita Safra/Safrinha opcional como metadado', () => {
  assert.equal(validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'observacao',
    periodo_produtivo_id: 'periodo_1',
    periodoProdutivoId: 'periodo_1',
    periodo_produtivo_label: 'Safra • Soja • 2025/2026',
    tipo_periodo: 'safra',
    cultura_periodo: 'Soja',
    ano_agricola: '2025/2026',
  }), true);
});

test('validateCadernoCampo aceita localização opcional completa e válida', () => {
  assert.equal(validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'observacao',
    localizacao_latitude: 12.345678,
    localizacao_longitude: -45.678901,
    localizacao_accuracy: 8,
    localizacao_captured_at: '2026-07-21T15:30:00.000Z',
    localizacao_captured_by: 'usuario_teste',
    localizacao_origem: 'foreground_explicit',
  }), true);
});

test('validateCadernoCampo rejeita grupo parcial de localização', () => {
  assert.throws(() => validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'observacao',
    localizacao_latitude: 12.345678,
  }), /Latitude e longitude da localização devem ser informadas juntas/);
});

test('validateCadernoCampo aceita accuracy null e captured_by ausente', () => {
  assert.equal(validateCadernoCampo({
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'observacao',
    localizacao_latitude: -29.123456,
    localizacao_longitude: -51.123456,
    localizacao_accuracy: null,
    localizacao_captured_at: '2026-07-21T15:30:00.000Z',
    localizacao_origem: 'foreground_explicit',
  }), true);
});

test('validateCadernoCampo rejeita timestamp ou origem inválidos', () => {
  const base = {
    propriedade_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'observacao',
    localizacao_latitude: -29.123456,
    localizacao_longitude: -51.123456,
    localizacao_captured_at: '2026-07-21T15:30:00.000Z',
    localizacao_origem: 'foreground_explicit',
  };

  assert.throws(
    () => validateCadernoCampo({ ...base, localizacao_captured_at: '21/07/2026' }),
    /Data\/hora da localização inválida/
  );
  assert.throws(
    () => validateCadernoCampo({ ...base, localizacao_origem: 'background' }),
    /Origem da localização inválida/
  );
});

test('validateLimiteArea aceita propriedade_id canônico', () => {
  assert.equal(validateLimiteArea({
    nome: 'LT 2025 - Talhão A',
    ano: 2025,
    propriedade_id: 'p1',
    talhao_nome: 'Talhão A',
    poligono: [{ lat: -1, lng: -2 }],
  }), true);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de validatorsCompat passaram.');
}
