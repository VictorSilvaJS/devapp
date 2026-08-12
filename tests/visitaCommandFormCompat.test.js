const assert = require('node:assert/strict');
const {
  buildVisitaConclusionDetails,
  buildVisitaCorrectionChanges,
} = require('../.tmp-domain-compat/src/utils/visitaCommandFormCompat');

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

test('conclusão envia somente detalhes técnicos alterados', () => {
  const visita = {
    observacoes: 'Observação atual',
    recomendacoes: 'Recomendação atual',
    clima: 'Sol',
    proximaVisita: '2026-08-20T03:00:00.000Z',
    fotos: [{ uri: 'file:///foto-1.jpg' }],
  };

  const changes = buildVisitaConclusionDetails(visita, {
    observacoes: 'Observação atual',
    recomendacoes: 'Nova recomendação',
    clima: ' ',
    proximaVisita: new Date('2026-08-20T03:00:00.000Z'),
    fotos: [{ uri: 'file:///foto-1.jpg' }, { uri: 'file:///foto-2.jpg' }],
  });

  assert.deepEqual(changes, {
    recomendacoes: 'Nova recomendação',
    clima: undefined,
    fotos: [{ uri: 'file:///foto-1.jpg' }, { uri: 'file:///foto-2.jpg' }],
  });
});

test('correção reúne vários campos e ignora os que não mudaram', () => {
  const visita = {
    resumo_conclusao: 'Resumo original',
    observacoes: 'Observação atual',
    recomendacoes: undefined,
    clima: 'Sol',
    proximaVisita: '2026-08-20T03:00:00.000Z',
    tecnico_responsavel: 'Técnica prevista',
    responsavel_executante_nome: 'Técnica executante',
  };

  const changes = buildVisitaCorrectionChanges(visita, {
    resumoConclusao: 'Resumo corrigido',
    observacoes: 'Observação atual',
    recomendacoes: 'Nova recomendação',
    clima: 'Sol',
    proximaVisita: null,
    responsavelExecutanteNome: 'Técnica corrigida',
  });

  assert.deepEqual(changes, {
    resumo_conclusao: 'Resumo corrigido',
    recomendacoes: 'Nova recomendação',
    proximaVisita: undefined,
    responsavel_executante_nome: 'Técnica corrigida',
  });
});

test('formulário sem mudanças produz comando vazio', () => {
  const visita = {
    resumo_conclusao: 'Resumo',
    observacoes: 'Observação',
    tecnico_responsavel: 'Técnica',
  };

  assert.deepEqual(buildVisitaCorrectionChanges(visita, {
    resumoConclusao: ' Resumo ',
    observacoes: ' Observação ',
    responsavelExecutanteNome: ' Técnica ',
  }), {});
});

if (failed > 0) process.exitCode = 1;
else console.log('\nTodos os testes de visitaCommandFormCompat passaram.');
