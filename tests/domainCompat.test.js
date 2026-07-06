const assert = require('node:assert/strict');
const domainCompat = require('../.tmp-domain-compat/src/domain');

const {
  CATEGORIAS_MAPA_PROVISORIAS,
  normalizeNome,
  normalizeDisponibilidadeDownload,
  normalizeUsuario,
  toUsuarioCompativelBorda,
  deriveProdutorFromUsuario,
  normalizeFazenda,
  toFazendaCompativelBorda,
  deriveProdutorFromFazenda,
  normalizeMapa,
  toMapaCompativelBorda,
  normalizeVisita,
  toVisitaCompativelBorda,
  normalizeCadernoCampo,
  toCadernoCampoCompativelBorda,
  normalizeLimiteArea,
  toLimiteAreaCompativelBorda,
} = domainCompat;

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

test('normalizeNome prioriza nome e usa full_name como fallback', () => {
  assert.equal(normalizeNome({ nome: 'Ana Silva', full_name: 'Ana S.' }), 'Ana Silva');
  assert.equal(normalizeNome({ full_name: 'Carlos Souza' }), 'Carlos Souza');
});

test('normalizeDisponibilidadeDownload centraliza os aliases e padrao atual', () => {
  assert.equal(normalizeDisponibilidadeDownload({ disponivel_download: false, disponivel_para_download: true }), false);
  assert.equal(normalizeDisponibilidadeDownload({ disponivel_para_download: false }), false);
  assert.equal(normalizeDisponibilidadeDownload({}), true);
});

test('normalizeUsuario gera contrato canonico e espelha full_name na borda', () => {
  const canonico = normalizeUsuario({
    id: 'u1',
    full_name: 'Bruna Administradora',
    perfil: 'admin',
    email: 'bruna@agrotche.com',
  });

  assert.deepEqual(canonico, {
    id: 'u1',
    nome: 'Bruna Administradora',
    perfil: 'admin',
    email: 'bruna@agrotche.com',
  });

  const compativel = toUsuarioCompativelBorda(canonico);
  assert.equal(compativel.nome, 'Bruna Administradora');
  assert.equal(compativel.full_name, 'Bruna Administradora');
});

test('deriveProdutorFromUsuario usa produtor_id como referencia canonica do titular', () => {
  const produtor = deriveProdutorFromUsuario({
    id: 'u7',
    full_name: 'Joao Silva',
    perfil: 'produtor',
    produtor_id: 'prop1',
    email: 'joao@email.com',
  });

  assert.deepEqual(produtor, {
    id: 'prop1',
    nome: 'Joao Silva',
    email: 'joao@email.com',
    telefone: undefined,
    ativo: undefined,
    data_cadastro: undefined,
  });
});

test('normalizeFazenda converte proprietario_id e separa nome da fazenda do nome do produtor', () => {
  const canonica = normalizeFazenda({
    id: 'p1',
    proprietario_id: 'prop1',
    nome: 'Joao Silva',
    fazenda: 'Fazenda Boa Vista',
    cidade: 'Cruz Alta',
  });

  assert.deepEqual(canonica, {
    id: 'p1',
    produtor_id: 'prop1',
    nome: 'Fazenda Boa Vista',
    produtor_nome: 'Joao Silva',
    cidade: 'Cruz Alta',
  });
});

test('toFazendaCompativelBorda reintroduz os campos legados apenas na borda', () => {
  const compativel = toFazendaCompativelBorda({
    id: 'p1',
    produtor_id: 'prop1',
    nome: 'Fazenda Boa Vista',
    produtor_nome: 'Joao Silva',
    cidade: 'Cruz Alta',
  });

  assert.deepEqual(compativel, {
    id: 'p1',
    produtor_id: 'prop1',
    nome: 'Joao Silva',
    fazenda: 'Fazenda Boa Vista',
    proprietario_id: 'prop1',
    produtor_nome: 'Joao Silva',
    cidade: 'Cruz Alta',
  });
});

test('deriveProdutorFromFazenda recupera o produtor titular a partir do registro da fazenda', () => {
  const produtor = deriveProdutorFromFazenda({
    id: 'p1',
    proprietario_id: 'prop1',
    nome: 'Joao Silva',
    fazenda: 'Fazenda Boa Vista',
    telefone: '(51) 99999-9999',
  });

  assert.deepEqual(produtor, {
    id: 'prop1',
    nome: 'Joao Silva',
    email: undefined,
    telefone: '(51) 99999-9999',
    data_cadastro: undefined,
    ativo: undefined,
  });
});

test('normalizeMapa trata produtor_id legado como fazenda_id e unifica flag de download', () => {
  const mapa = normalizeMapa({
    id: 'm1',
    titulo: 'Mapa de Fertilidade',
    categoria: 'panorama',
    produtor_id: 'p1',
    talhao: 'Talhao A',
    disponivel_para_download: false,
  });

  assert.deepEqual(mapa, {
    id: 'm1',
    titulo: 'Mapa de Fertilidade',
    categoria: 'panorama',
    fazenda_id: 'p1',
    talhao: 'Talhao A',
    disponivel_download: false,
  });

  assert.ok(CATEGORIAS_MAPA_PROVISORIAS.includes('panorama'));
});

test('normalizeMapa preserva categorias fora do catalogo provisiorio sem congelar a taxonomia final', () => {
  const mapa = normalizeMapa({
    id: 'm-extra',
    titulo: 'Mapa Experimental',
    categoria: 'custom_interno',
    produtor_id: 'p1',
    talhao: 'Area total',
  });

  assert.equal(mapa.categoria, 'custom_interno');
});

test('toMapaCompativelBorda reexpone produtor_id e disponivel_para_download', () => {
  const compativel = toMapaCompativelBorda({
    id: 'm1',
    titulo: 'Mapa de Fertilidade',
    categoria: 'fertilidade',
    fazenda_id: 'p1',
    talhao: 'Talhao A',
    disponivel_download: true,
  });

  assert.deepEqual(compativel, {
    id: 'm1',
    titulo: 'Mapa de Fertilidade',
    categoria: 'fertilidade',
    fazenda_id: 'p1',
    talhao: 'Talhao A',
    disponivel_download: true,
    produtor_id: 'p1',
    disponivel_para_download: true,
  });
});

test('normalizeVisita migra produtor_id legado para fazenda_id', () => {
  const visita = normalizeVisita({
    id: 'v1',
    produtor_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
    data_visita: '2026-04-14T10:00:00.000Z',
    objetivo: 'consultoria',
  });

  assert.deepEqual(visita, {
    id: 'v1',
    fazenda_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
    data_visita: '2026-04-14T10:00:00.000Z',
    objetivo: 'consultoria',
  });

  assert.equal(toVisitaCompativelBorda(visita).produtor_id, 'p1');
});

test('normalizeCadernoCampo migra produtor_id legado e centraliza autoria futura', () => {
  const caderno = normalizeCadernoCampo({
    id: 'c1',
    produtor_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'vistoria',
    criado_por: 'u2',
  });

  assert.deepEqual(caderno, {
    id: 'c1',
    fazenda_id: 'p1',
    fazendaId: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: '2026-04-14T10:00:00.000Z',
    tipo_atividade: 'vistoria',
    criado_por_user_id: 'u2',
  });

  assert.equal(toCadernoCampoCompativelBorda(caderno).produtor_id, 'p1');
  assert.equal(toCadernoCampoCompativelBorda(caderno).fazendaId, 'p1');
});

test('normalizeLimiteArea migra produtor_id legado para fazenda_id', () => {
  const limite = normalizeLimiteArea({
    id: 'lt1',
    nome: 'Talhao A',
    ano: 2025,
    produtor_id: 'p1',
    talhao: 'Talhao A',
    poligono: [{ lat: -1, lng: -2 }],
  });

  assert.deepEqual(limite, {
    id: 'lt1',
    nome: 'Talhao A',
    ano: 2025,
    fazenda_id: 'p1',
    talhao: 'Talhao A',
    poligono: [{ lat: -1, lng: -2 }],
  });

  assert.equal(toLimiteAreaCompativelBorda(limite).produtor_id, 'p1');
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de domainCompat passaram.');
}
