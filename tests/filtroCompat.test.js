const assert = require('node:assert/strict');
const {
  normalizeFiltrosState,
  resolveFiltroFazendaId,
  toFiltrosCompativeis,
} = require('../.tmp-domain-compat/src/contexts/filtroCompat');

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
  await test('normalizeFiltrosState usa fazendaId canônico e aceita alias legado produtorId', () => {
    const filtros = normalizeFiltrosState({
      regiao: 'Sul',
      produtorId: 'faz_01',
    });

    assert.deepEqual(filtros, {
      regiao: 'Sul',
      microregiao: 'todas',
      fazenda: 'todas',
      fazendaId: 'faz_01',
      cidade: 'todas',
    });
  });

  await test('resolveFiltroFazendaId prioriza fazendaId quando ambos os campos existem', () => {
    const fazendaId = resolveFiltroFazendaId({
      fazendaId: 'faz_canonica',
      produtorId: 'faz_legada',
    });

    assert.equal(fazendaId, 'faz_canonica');
  });

  await test('toFiltrosCompativeis reexpõe produtorId apenas como alias temporário', () => {
    const filtros = toFiltrosCompativeis({
      fazenda: 'Sede',
      fazendaId: 'faz_77',
    });

    assert.equal(filtros.fazendaId, 'faz_77');
    assert.equal(filtros.produtorId, 'faz_77');
    assert.equal(filtros.fazenda, 'Sede');
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de filtroCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
