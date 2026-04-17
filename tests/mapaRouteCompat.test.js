const assert = require('node:assert/strict');
const {
  buildFazendaMapaRouteParams,
  buildMapasRouteParams,
  resolveRouteFazendaId,
} = require('../.tmp-domain-compat/src/navigation/mapaRouteCompat');

let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const run = async () => {
  await test('resolveRouteFazendaId prioriza fazendaId canônico', () => {
    const fazendaId = resolveRouteFazendaId({
      fazendaId: 'faz_001',
      produtorId: 'legado_ignorado',
    });

    assert.equal(fazendaId, 'faz_001');
  });

  await test('resolveRouteFazendaId aceita alias legado produtorId', () => {
    const fazendaId = resolveRouteFazendaId({
      produtorId: 'faz_legado',
    });

    assert.equal(fazendaId, 'faz_legado');
  });

  await test('buildMapasRouteParams gera params compatíveis com alias legado controlado', () => {
    const params = buildMapasRouteParams({
      fazendaId: 'faz_mapas',
    });

    assert.deepEqual(params, {
      fazendaId: 'faz_mapas',
      produtorId: 'faz_mapas',
    });
  });

  await test('buildFazendaMapaRouteParams preserva nomes e talhao junto com compatibilidade de id', () => {
    const params = buildFazendaMapaRouteParams({
      produtorId: 'faz_sat',
      fazendaNome: 'Fazenda Satélite',
      produtorNome: 'João Silva',
      talhaoId: 'talhao_7',
    });

    assert.deepEqual(params, {
      fazendaId: 'faz_sat',
      produtorId: 'faz_sat',
      fazendaNome: 'Fazenda Satélite',
      produtorNome: 'João Silva',
      talhaoId: 'talhao_7',
    });
  });

  await test('buildFazendaMapaRouteParams retorna undefined quando não há contexto nem metadados úteis', () => {
    const params = buildFazendaMapaRouteParams({
      fazendaId: '   ',
      produtorId: '',
      fazendaNome: '   ',
    });

    assert.equal(params, undefined);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de mapaRouteCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
