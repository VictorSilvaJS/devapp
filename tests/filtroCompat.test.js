const assert = require('node:assert/strict');
const {
  normalizeFiltrosState,
  resolveFiltroFazendaId,
  resolveFiltroPropriedadeId,
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
  await test('normalizeFiltrosState usa UF, Município e Propriedade canônicos', () => {
    const filtros = normalizeFiltrosState({
      uf: 'MT',
      municipio: '5106240',
      propriedade: 'Fazenda Backes',
      produtorId: 'faz_01',
    });

    assert.deepEqual(filtros, {
      uf: 'MT',
      municipio: '5106240',
      propriedade: 'Fazenda Backes',
      propriedadeId: 'faz_01',
    });
  });

  await test('normalizeFiltrosState não promove Região ou Microrregião para o contrato atual', () => {
    const filtros = normalizeFiltrosState({ regiao: 'Norte', microregiao: 'Sinop' });

    assert.deepEqual(filtros, {
      uf: 'todas',
      municipio: 'todas',
      propriedade: 'todas',
      propriedadeId: null,
    });
  });

  await test('resolveFiltroFazendaId prioriza fazendaId quando ambos os campos existem', () => {
    const fazendaId = resolveFiltroFazendaId({
      fazendaId: 'faz_canonica',
      produtorId: 'faz_legada',
    });

    assert.equal(fazendaId, 'faz_canonica');
    assert.equal(resolveFiltroPropriedadeId({ propriedadeId: 'prop_01' }), 'prop_01');
  });

  await test('toFiltrosCompativeis reexpõe produtorId apenas como alias temporário', () => {
    const filtros = toFiltrosCompativeis({
      fazenda: 'Sede',
      fazendaId: 'faz_77',
    });

    assert.equal(filtros.fazendaId, 'faz_77');
    assert.equal(filtros.produtorId, 'faz_77');
    assert.equal(filtros.fazenda, 'Sede');
    assert.equal(filtros.propriedadeId, 'faz_77');
    assert.equal(filtros.propriedade, 'Sede');
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
