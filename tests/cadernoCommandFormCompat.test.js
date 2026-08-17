const assert = require('node:assert/strict');
const { buildCadernoCorrectionChanges } = require('../.tmp-domain-compat/src/utils/cadernoCommandFormCompat');

const original = {
  data_atividade: '2026-08-10T12:00:00.000Z',
  tipo_atividade: 'observacao',
  observacoes: 'Registro original',
  operacao: 'Plantio direto',
  produtos_utilizados: ['Produto A'],
  dosagem: '2 L/ha',
  area_aplicada: 10,
  produtividade: 55,
  condicoes_clima: 'Seco',
};

assert.deepEqual(buildCadernoCorrectionChanges(original, {
  dataAtividade: new Date(original.data_atividade),
  tipoAtividade: 'observacao',
  observacoes: 'Registro original',
  operacao: 'Plantio direto',
  produtosText: 'Produto A',
  dosagem: '2 L/ha',
  areaAplicada: '10,0',
  produtividade: '55',
  condicoesClima: 'Seco',
}), {});

assert.deepEqual(buildCadernoCorrectionChanges(original, {
  dataAtividade: new Date(original.data_atividade),
  tipoAtividade: 'observacao',
  observacoes: 'Registro corrigido',
  operacao: 'Plantio direto',
  produtosText: 'Produto A, Produto B',
  dosagem: '2 L/ha',
  areaAplicada: '12,5',
  produtividade: '55',
  condicoesClima: 'Úmido',
}), {
  observacoes: 'Registro corrigido',
  produtos_utilizados: ['Produto A', 'Produto B'],
  area_aplicada: 12.5,
  condicoes_clima: 'Úmido',
});

assert.deepEqual(buildCadernoCorrectionChanges(original, {
  dataAtividade: new Date(original.data_atividade),
  tipoAtividade: 'aplicacao',
  talhaoId: 'talhao_2',
  talhao: 'Talhão Norte',
  periodoProdutivo: null,
  observacoes: 'Registro original',
  operacao: '',
  produtosText: 'Produto A',
  dosagem: '2 L/ha',
  areaAplicada: '10',
  produtividade: '',
  condicoesClima: 'Seco',
}), {
  tipo_atividade: 'aplicacao',
  talhao_id: 'talhao_2',
  talhaoId: 'talhao_2',
  talhao_nome: 'Talhão Norte',
  talhao: 'Talhão Norte',
  operacao: undefined,
  produtividade: undefined,
});

console.log('Todos os testes de cadernoCommandFormCompat passaram.');
