const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildPropriedadeResumo,
  getMaterialMaisRecenteDaPropriedade,
  getProximaVisitaDaPropriedade,
  getUltimaAtividadeDaPropriedade,
} = require('../.tmp-domain-compat/src/utils/propriedadeResumoCompat');

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

const referenceDate = '2026-08-03T12:00:00.000Z';

test('proxima Visita usa somente agendada futura e escolhe a mais proxima', () => {
  const visita = getProximaVisitaDaPropriedade([
    { id: 'realizada', status: 'realizada', data_visita: '2026-08-04T12:00:00.000Z' },
    { id: 'passada', status: 'agendada', data_visita: '2026-08-02T12:00:00.000Z' },
    { id: 'depois', status: 'agendada', data_visita: '2026-08-12T12:00:00.000Z' },
    { id: 'primeira', status: 'agendada', data_visita: '2026-08-05T12:00:00.000Z' },
  ], referenceDate);

  assert.equal(visita.id, 'primeira');
});

test('ultima atividade compara Caderno e Visita sem promover agenda futura', () => {
  const atividade = getUltimaAtividadeDaPropriedade({
    visitas: [
      { id: 'v1', status: 'realizada', data_visita: '2026-08-01T10:00:00.000Z' },
      { id: 'v2', status: 'agendada', data_visita: '2026-08-05T10:00:00.000Z' },
    ],
    cadernos: [
      { id: 'c1', data_atividade: '2026-08-02T10:00:00.000Z' },
      { id: 'c-futuro', data_atividade: '2026-08-06T10:00:00.000Z' },
    ],
    referenceDate,
  });

  assert.equal(atividade.kind, 'caderno');
  assert.equal(atividade.item.id, 'c1');
});

test('material mais recente aceita os campos de data compativeis', () => {
  const material = getMaterialMaisRecenteDaPropriedade([
    { id: 'criado', data_criacao: '2026-06-01T10:00:00.000Z' },
    { id: 'upload', data_upload: '2026-07-01T10:00:00.000Z' },
    { id: 'atualizado', updated_at: '2026-08-01T10:00:00.000Z' },
    { id: 'invalido', data_criacao: 'sem-data' },
  ]);

  assert.equal(material.id, 'atualizado');
});

test('resumo do Produtor explicita somente pontos visiveis e nao inventa totais', () => {
  const resumo = buildPropriedadeResumo({
    propriedade: { status: 'pendente' },
    visitas: [],
    cadernos: [],
    mapas: [],
    limites: [],
    isProdutor: true,
    referenceDate,
  });

  assert.deepEqual(resumo.pontosAtencao.map((item) => item.id), [
    'status',
    'visita',
    'material',
    'talhao',
  ]);
  assert.match(resumo.pontosAtencao[2].message, /liberado/);
  assert.equal(resumo.proximaVisita, null);
  assert.equal(resumo.ultimaAtividade, null);
  assert.equal(resumo.materialMaisRecente, null);
});

test('tela remove Panorama repetido e prioriza os quatro indicadores', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src/screens/ProdutorScreen.tsx'),
    'utf8'
  );

  assert.match(source, /buildPropriedadeResumo/);
  assert.match(source, /Próxima Visita/);
  assert.match(source, /Última atividade/);
  assert.match(source, /Material (?:liberado|atualizado)/);
  assert.match(source, /Pontos de atenção/);
  assert.doesNotMatch(source, /title="Panorama da Propriedade"/);
  assert.doesNotMatch(source, /title="Contexto da Propriedade"/);
  assert.match(source, /const localizacaoFazenda = fazendaInfo\.localizacao/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de propriedadeResumoCompat passaram.');
}
