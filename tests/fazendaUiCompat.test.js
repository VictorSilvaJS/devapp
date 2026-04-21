const assert = require('node:assert/strict');
const {
  getFazendaUiInfo,
  matchesFazendaUiBusca,
} = require('../.tmp-domain-compat/src/utils/fazendaUiCompat');

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
  await test('getFazendaUiInfo centraliza nomes de fazenda, titular e localizacao', () => {
    const info = getFazendaUiInfo({
      id: 'faz_01',
      nome: 'Joao Silva',
      fazenda: 'Fazenda Horizonte',
      cidade: 'Rio Verde',
      estado: 'GO',
    });

    assert.deepEqual(info, {
      id: 'faz_01',
      fazendaNome: 'Fazenda Horizonte',
      titularNome: 'Joao Silva',
      localizacao: 'Rio Verde/GO',
      buscaTexto: 'fazenda horizonte joao silva rio verde go',
    });
  });

  await test('matchesFazendaUiBusca usa helper centralizado e aceita contexto extra', () => {
    const fazenda = {
      id: 'faz_02',
      nome: 'Maria Souza',
      fazenda: 'Estancia Boa Vista',
      cidade: 'Jatai',
      estado: 'GO',
    };

    assert.equal(matchesFazendaUiBusca(fazenda, 'boa vista'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'maria'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'coleta', ['coleta_solo']), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'milho'), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de fazendaUiCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
