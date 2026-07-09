const assert = require('assert');

const {
  filtrarRegistrosDoTalhao,
  filtrarRegistrosGeraisDaPropriedade,
  getTalhaoOrigemDemarcacaoLabel,
  registroPertenceAoTalhao,
  separarMateriaisPorTalhao,
  separarPeriodosPorTalhao,
} = require('../.tmp-domain-compat/src/utils/talhaoConsultaCompat');

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

(async () => {
  const talhao = { id: 'talhao_1', talhao: 'T01 - 230' };

  await test('identifica registros do Talhao por id ou nome normalizado', () => {
    assert.equal(registroPertenceAoTalhao({ talhao_id: 'talhao_1', talhao: 'Outro' }, talhao), true);
    assert.equal(registroPertenceAoTalhao({ talhao: 't01 - 230' }, talhao), true);
    assert.equal(registroPertenceAoTalhao({ talhao: 'T02 - 230' }, talhao), false);
    assert.equal(registroPertenceAoTalhao({ observacoes: 'sem talhao' }, talhao), false);
  });

  await test('filtra Caderno por Talhao sem incluir registros gerais da Propriedade', () => {
    const registros = [
      { id: 'c1', talhao: 'T01 - 230' },
      { id: 'c2' },
      { id: 'c3', talhao: 'T02 - 230' },
    ];

    assert.deepEqual(filtrarRegistrosDoTalhao(registros, talhao).map((item) => item.id), ['c1']);
    assert.deepEqual(filtrarRegistrosGeraisDaPropriedade(registros).map((item) => item.id), ['c2']);
  });

  await test('separa periodos especificos do Talhao e periodos gerais da Propriedade', () => {
    const periodos = [
      { id: 'p1', talhao_id: 'talhao_1', talhao_nome: 'T01 - 230' },
      { id: 'p2', cultura: 'Soja' },
      { id: 'p3', talhao: 'T03 - 230' },
    ];

    const result = separarPeriodosPorTalhao(periodos, talhao);
    assert.deepEqual(result.doTalhao.map((item) => item.id), ['p1']);
    assert.deepEqual(result.daPropriedade.map((item) => item.id), ['p2']);
  });

  await test('separa materiais do Talhao e materiais da Propriedade inteira', () => {
    const materiais = [
      { id: 'm1', escopo: 'talhao', talhao_id: 'talhao_1', talhao_nome: 'T01 - 230' },
      { id: 'm2', escopo: 'propriedade', talhao: 'Propriedade inteira' },
      { id: 'm3', talhao: 'T02 - 230' },
    ];

    const result = separarMateriaisPorTalhao(materiais, talhao);
    assert.deepEqual(result.doTalhao.map((item) => item.id), ['m1']);
    assert.deepEqual(result.daPropriedade.map((item) => item.id), ['m2']);
  });

  await test('rotula origem segura da demarcacao sem expor coordenadas', () => {
    assert.equal(getTalhaoOrigemDemarcacaoLabel('geojson_local', true), 'GeoJSON local ativo');
    assert.equal(getTalhaoOrigemDemarcacaoLabel('geojson_local_fallback', false), 'Seed/mock como fallback');
    assert.equal(getTalhaoOrigemDemarcacaoLabel('seed', false), 'Seed/mock');
  });

  if (process.exitCode) {
    process.exit(process.exitCode);
  }

  console.log('\nTodos os testes de talhaoConsultaCompat passaram.');
})();
