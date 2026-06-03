const assert = require('node:assert/strict');
const {
  buildFazendaConsultaOptions,
  buildFazendaDetailContext,
  buildFazendaListMetrics,
  buildFazendaUiInfoMap,
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

  await test('getFazendaUiInfo aceita aliases futuros de Propriedade e Titular', () => {
    const info = getFazendaUiInfo({
      propriedade_id: 'prop_alias',
      propriedade_nome: 'Propriedade Alias',
      titular_id: 'tit_alias',
      titular_nome: 'Titular Alias',
      cidade: 'Jatai',
      estado: 'GO',
    });

    assert.deepEqual(info, {
      id: 'prop_alias',
      fazendaNome: 'Propriedade Alias',
      titularNome: 'Titular Alias',
      localizacao: 'Jatai/GO',
      buscaTexto: 'propriedade alias titular alias jatai go',
    });
  });

  await test('matchesFazendaUiBusca usa helper centralizado e aceita contexto extra', () => {
    const fazenda = {
      id: 'faz_02',
      nome: 'Maria Souza',
      fazenda: 'Estancia Boa Vista',
      cidade: 'Jatai',
      estado: 'GO',
      regiao: 'Goias',
      microregiao: 'Sudoeste Goiano',
    };

    assert.equal(matchesFazendaUiBusca(fazenda, 'boa vista'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'maria'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'goias'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'sudoeste'), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'coleta', ['coleta_solo']), true);
    assert.equal(matchesFazendaUiBusca(fazenda, 'milho'), false);
  });

  await test('buildFazendaUiInfoMap indexa contexto visual por id operacional da fazenda', () => {
    const mapa = buildFazendaUiInfoMap([
      {
        id: 'faz_01',
        produtor_nome: 'Joao Silva',
        fazenda: 'Fazenda Horizonte',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);

    assert.deepEqual(mapa.get('faz_01'), {
      id: 'faz_01',
      fazendaNome: 'Fazenda Horizonte',
      titularNome: 'Joao Silva',
      localizacao: 'Rio Verde/GO',
      buscaTexto: 'fazenda horizonte joao silva rio verde go',
    });
  });

  await test('buildFazendaConsultaOptions monta labels de filtro com fazenda e titular', () => {
    const options = buildFazendaConsultaOptions([
      {
        id: 'faz_b',
        produtor_nome: 'Maria Souza',
        fazenda: 'Estancia Boa Vista',
        cidade: 'Jatai',
        estado: 'GO',
      },
      {
        id: 'faz_a',
        produtor_nome: 'Joao Silva',
        fazenda: 'Fazenda Horizonte',
      },
    ]);

    assert.deepEqual(options.map((option) => option.id), ['faz_b', 'faz_a']);
    assert.equal(options[0].label, 'Estancia Boa Vista');
    assert.equal(options[0].subtitle, 'Maria Souza • Jatai/GO');
    assert.equal(options[1].subtitle, 'Joao Silva');
  });

  await test('buildFazendaListMetrics diferencia total de fazendas e titulares', () => {
    const metricas = buildFazendaListMetrics([
      {
        id: 'faz_01',
        produtor_id: 'tit_01',
        produtor_nome: 'Joao Silva',
        fazenda: 'Fazenda Horizonte',
        status: 'ativo',
        area_total: 120,
      },
      {
        id: 'faz_02',
        produtor_id: 'tit_01',
        produtor_nome: 'Joao Silva',
        fazenda: 'Fazenda Ponte Alta',
        status: 'pendente',
        area_total: 80,
      },
      {
        id: 'faz_03',
        produtor_id: 'tit_02',
        produtor_nome: 'Maria Souza',
        fazenda: 'Estancia Boa Vista',
        status: 'ativo',
        area_total: 300,
      },
    ]);

    assert.deepEqual(metricas, {
      totalFazendas: 3,
      totalTitulares: 2,
      fazendasAtivas: 2,
      fazendasPendentes: 1,
      areaTotal: 500,
    });
  });

  await test('buildFazendaDetailContext lista outras fazendas do mesmo titular', () => {
    const fazendaAtual = {
      id: 'faz_01',
      produtor_id: 'tit_01',
      produtor_nome: 'Joao Silva',
      fazenda: 'Fazenda Horizonte',
      cidade: 'Rio Verde',
      estado: 'GO',
    };

    const contexto = buildFazendaDetailContext(fazendaAtual, [
      fazendaAtual,
      {
        id: 'faz_02',
        produtor_id: 'tit_01',
        produtor_nome: 'Joao Silva',
        fazenda: 'Fazenda Ponte Alta',
        cidade: 'Jatai',
        estado: 'GO',
      },
      {
        id: 'faz_03',
        produtor_id: 'tit_02',
        produtor_nome: 'Maria Souza',
        fazenda: 'Estancia Boa Vista',
      },
    ]);

    assert.equal(contexto.id, 'faz_01');
    assert.equal(contexto.titularId, 'tit_01');
    assert.deepEqual(contexto.outrasFazendasTitular, [
      {
        id: 'faz_02',
        fazendaNome: 'Fazenda Ponte Alta',
        titularNome: 'Joao Silva',
        localizacao: 'Jatai/GO',
        buscaTexto: 'fazenda ponte alta joao silva jatai go',
      },
    ]);
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
