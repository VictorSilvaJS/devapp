const assert = require('node:assert/strict');
const {
  buildCadernoFazendaOptions,
  buildCadernoPayload,
  findCadernoFazendaOption,
  getCadernoFormFazendaId,
  getCadernoFormFazendaLabel,
  getCadernoOrigemLabel,
  getCadernoTalhaoLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoRegistradoPeloProdutor,
  isCadernoVisivelParaProdutor,
  ordenarCadernosPorDataRecente,
  parseCadernoAreaAplicada,
  parseCadernoProdutos,
  resolveCadernoEdicaoFazendaId,
} = require('../.tmp-domain-compat/src/utils/cadernoFormCompat');

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
  await test('buildCadernoFazendaOptions explicita id operacional de fazenda para a UI', () => {
    const options = buildCadernoFazendaOptions([
      {
        id: 'faz_01',
        nome: 'João Silva',
        fazenda: 'Fazenda Horizonte',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);

    assert.deepEqual(options, [
      {
        id: 'faz_01',
        fazendaNome: 'Fazenda Horizonte',
        titularNome: 'João Silva',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);
  });

  await test('buildCadernoFazendaOptions usa aliases futuros em nomes visuais', () => {
    const options = buildCadernoFazendaOptions([
      {
        propriedade_id: 'prop_alias',
        propriedade_nome: 'Propriedade Alias',
        titular_nome: 'Titular Alias',
        cidade: 'Jataí',
        estado: 'GO',
      },
    ]);

    assert.deepEqual(options, [
      {
        id: 'prop_alias',
        fazendaNome: 'Propriedade Alias',
        titularNome: 'Titular Alias',
        cidade: 'Jataí',
        estado: 'GO',
      },
    ]);
  });

  await test('findCadernoFazendaOption e getCadernoFormFazendaLabel mantêm seleção legível', () => {
    const option = findCadernoFazendaOption(
      [
        {
          id: 'faz_10',
          fazendaNome: 'Estância Boa Vista',
          titularNome: 'Maria Souza',
        },
      ],
      'faz_10'
    );

    assert.equal(getCadernoFormFazendaLabel(option), 'Estância Boa Vista - Maria Souza');
  });

  await test('resolveCadernoEdicaoFazendaId preserva fazenda original do registro', () => {
    assert.equal(getCadernoFormFazendaId({ fazenda_id: 'faz_a' }), 'faz_a');
    assert.equal(getCadernoFormFazendaId({ produtor_id: 'faz_b' }), 'faz_b');
    assert.equal(resolveCadernoEdicaoFazendaId({ fazenda_id: 'faz_original' }, 'faz_tentativa'), 'faz_original');
    assert.equal(resolveCadernoEdicaoFazendaId({ produtor_id: 'faz_legada' }, 'faz_tentativa'), 'faz_legada');
    assert.equal(resolveCadernoEdicaoFazendaId({}, 'faz_fallback'), 'faz_fallback');
  });

  await test('parseCadernoProdutos normaliza lista simples separada por vírgula', () => {
    assert.deepEqual(parseCadernoProdutos('MAP, KCl, , Ureia '), ['MAP', 'KCl', 'Ureia']);
  });

  await test('parseCadernoAreaAplicada aceita vírgula decimal e rejeita valores inválidos', () => {
    assert.equal(parseCadernoAreaAplicada('25,5'), 25.5);
    assert.equal(parseCadernoAreaAplicada(''), undefined);
    assert.equal(parseCadernoAreaAplicada('0'), null);
    assert.equal(parseCadernoAreaAplicada('abc'), null);
  });

  await test('buildCadernoPayload gera contrato canônico com fazenda_id e visibilidade explícita', () => {
    const payload = buildCadernoPayload({
      fazendaId: 'faz_payload',
      dataAtividade: new Date('2026-04-20T00:00:00.000Z'),
      tipoAtividade: 'adubacao',
      talhao: 'Talhão A',
      produtosText: 'MAP, KCl',
      dosagem: '250 kg/ha',
      areaAplicadaText: '120,5',
      condicoesClima: 'Ensolarado',
      observacoes: 'Aplicação concluída',
      visivelParaProdutor: false,
      colaboradorResponsavel: 'Carlos Silva',
      criadoPorUserId: 'u2',
      origemRegistro: 'produtor',
    });

    assert.equal(payload.fazenda_id, 'faz_payload');
    assert.equal(payload.fazendaId, 'faz_payload');
    assert.equal(payload.colaborador_responsavel, 'Carlos Silva');
    assert.equal(payload.tipo_atividade, 'adubacao');
    assert.equal(payload.area_aplicada, 120.5);
    assert.equal(payload.visivel_para_produtor, false);
    assert.equal(payload.criado_por_user_id, 'u2');
    assert.equal(payload.origem_registro, 'produtor');
    assert.deepEqual(payload.produtos_utilizados, ['MAP', 'KCl']);
  });

  await test('helpers de apresentação do caderno cobrem tipo, talhão, visibilidade e ordenação', () => {
    assert.equal(getCadernoTipoLabel('correcao_solo'), 'Correção de solo');
    assert.equal(getCadernoTipoLabel('ocorrencia'), 'Ocorrência');
    assert.equal(getCadernoTipoLabel('vistoria'), 'Vistoria');
    assert.equal(getCadernoTalhaoLabel({}), 'Sem talhão vinculado');
    assert.equal(getCadernoTalhaoLabel({ talhao: 'Talhão A' }), 'Talhão A');
    assert.equal(isCadernoVisivelParaProdutor({ visivel_para_produtor: false }), false);
    assert.equal(isCadernoVisivelParaProdutor({}), true);
    assert.equal(getCadernoVisibilidadeLabel({ visivel_para_produtor: false }), 'Interno');
    assert.equal(isCadernoRegistradoPeloProdutor({ origem_registro: 'produtor' }), true);
    assert.equal(isCadernoRegistradoPeloProdutor({ origem_registro: 'equipe' }), false);
    assert.equal(getCadernoOrigemLabel({ origem_registro: 'produtor' }), 'Registrado pelo produtor');
    assert.deepEqual(
      ordenarCadernosPorDataRecente([
        { id: 'antigo', data_atividade: '2026-04-01T00:00:00.000Z' },
        { id: 'novo', data_atividade: '2026-04-03T00:00:00.000Z' },
      ]).map((item) => item.id),
      ['novo', 'antigo']
    );
  });

  await test('buildCadernoPayload retorna null para data ou área inválida', () => {
    assert.equal(buildCadernoPayload({
      fazendaId: 'faz_payload',
      dataAtividade: null,
      tipoAtividade: 'vistoria',
    }), null);

    assert.equal(buildCadernoPayload({
      fazendaId: 'faz_payload',
      dataAtividade: new Date('2026-04-20T00:00:00.000Z'),
      tipoAtividade: 'vistoria',
      areaAplicadaText: '-1',
    }), null);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de cadernoFormCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
