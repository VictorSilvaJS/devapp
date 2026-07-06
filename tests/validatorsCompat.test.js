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

test('validateMapa aceita fazenda_id canônico e panorama do catálogo provisório', () => {
  assert.equal(validateMapa({
    titulo: 'Mapa Panorama',
    categoria: 'panorama',
    fazenda_id: 'p1',
    talhao: 'Área total',
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
      fazenda_id: 'p1',
      talhao: 'Talhão A',
    }), true);
  } finally {
    console.warn = warnOriginal;
  }

  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('fora do catálogo provisório'));
});

test('validateVisita aceita fazenda_id canônico', () => {
  assert.equal(validateVisita({
    fazenda_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
    data_visita: '2026-04-14T10:00:00.000Z',
    objetivo: 'consultoria',
  }), true);
});

test('validateCadernoCampo aceita fazenda_id canônico', () => {
  assert.equal(validateCadernoCampo({
    fazenda_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'vistoria',
  }), true);
});

test('validateCadernoCampo aceita tipos enxutos da Fase 17D', () => {
  assert.equal(validateCadernoCampo({
    fazenda_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'prescricao',
  }), true);
});

test('validateLimiteArea aceita fazenda_id canônico', () => {
  assert.equal(validateLimiteArea({
    nome: 'LT 2025 - Talhão A',
    ano: 2025,
    fazenda_id: 'p1',
    talhao: 'Talhão A',
    poligono: [{ lat: -1, lng: -2 }],
  }), true);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de validatorsCompat passaram.');
}
