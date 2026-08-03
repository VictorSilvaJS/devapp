const assert = require('node:assert/strict');
const {
  buildCadernoFazendaOptions,
  buildCadernoPeriodoProdutivoOptions,
  buildCadernoPayload,
  buildCadernoTalhaoOptions,
  CADERNO_TALHAO_LEGADO_VALUE,
  findCadernoFazendaOption,
  findCadernoPeriodoProdutivoOption,
  getCadernoFormFazendaId,
  getCadernoFormFazendaLabel,
  getCadernoFormPeriodoProdutivoLabel,
  getCadernoOrigemLabel,
  getCadernoRegistradoPorLabel,
  getCadernoPeriodoProdutivoLabel,
  getCadernoTalhaoLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoRegistradoPeloProdutor,
  isCadernoTalhaoLegado,
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
      talhaoId: 'talhao_a',
      talhao: 'Talhão A',
      produtosText: 'MAP, KCl',
      dosagem: '250 kg/ha',
      areaAplicadaText: '120,5',
      condicoesClima: 'Ensolarado',
      observacoes: 'Aplicação concluída',
      visivelParaProdutor: false,
      responsavelUsuarioId: 'u2',
      colaboradorResponsavel: 'Carlos Silva',
      criadoPorUserId: 'u2',
      criadoPorNome: 'Carlos Silva',
      origemRegistro: 'produtor',
    });

    assert.equal(payload.fazenda_id, 'faz_payload');
    assert.equal(payload.fazendaId, 'faz_payload');
    assert.equal(payload.colaborador_responsavel, 'Carlos Silva');
    assert.equal(payload.responsavel_usuario_id, 'u2');
    assert.equal(payload.criado_por_nome, 'Carlos Silva');
    assert.equal(payload.talhao_id, 'talhao_a');
    assert.equal(payload.talhao_nome, 'Talhão A');
    assert.equal(payload.tipo_atividade, 'adubacao');
    assert.equal(payload.area_aplicada, 120.5);
    assert.equal(payload.visivel_para_produtor, false);
    assert.equal(payload.criado_por_user_id, 'u2');
    assert.equal(payload.origem_registro, 'produtor');
    assert.deepEqual(payload.produtos_utilizados, ['MAP', 'KCl']);
    assert.equal(
      Object.keys(payload).some((key) => key.startsWith('localizacao_')),
      false
    );
  });

  await test('helpers de Safra/Safrinha do caderno mantêm vínculo opcional no payload', () => {
    const options = buildCadernoPeriodoProdutivoOptions([
      {
        id: 'periodo_1',
        fazenda_id: 'faz_payload',
        propriedade_id: 'faz_payload',
        label: 'Safra • Soja • 2025/2026',
        tipo_periodo: 'safra',
        cultura: 'Soja',
        ano_agricola: '2025/2026',
        status: 'em_andamento',
      },
    ]);
    const periodo = findCadernoPeriodoProdutivoOption(options, 'periodo_1');
    const payload = buildCadernoPayload({
      fazendaId: 'faz_payload',
      dataAtividade: new Date('2026-04-20T00:00:00.000Z'),
      tipoAtividade: 'observacao',
      periodoProdutivo: periodo,
    });

    assert.equal(getCadernoFormPeriodoProdutivoLabel(periodo), 'Safra • Soja • 2025/2026');
    assert.equal(payload.periodo_produtivo_id, 'periodo_1');
    assert.equal(payload.periodoProdutivoId, 'periodo_1');
    assert.equal(payload.periodo_produtivo_label, 'Safra • Soja • 2025/2026');
    assert.equal(payload.tipo_periodo, 'safra');
    assert.equal(payload.cultura_periodo, 'Soja');
    assert.equal(payload.ano_agricola, '2025/2026');
    assert.equal(getCadernoPeriodoProdutivoLabel(payload), 'Safra • Soja • 2025/2026');
    assert.equal(getCadernoFormPeriodoProdutivoLabel(null), 'Sem Safra/Safrinha vinculada');
  });

  await test('estado auxiliar da UI de localização não entra no payload comum do formulário', () => {
    const payload = buildCadernoPayload({
      fazendaId: 'faz_payload',
      dataAtividade: new Date('2026-07-21T12:00:00.000Z'),
      tipoAtividade: 'observacao',
      talhaoId: 'talhao_2',
      talhao: 'Talhão alterado na UI',
      localizacaoDraft: {
        localizacao_latitude: -29.123456,
        localizacao_longitude: -51.123456,
      },
      capturedForPropertyId: 'faz_payload',
      removalPending: true,
    });

    assert.equal(payload.talhao_id, 'talhao_2');
    assert.equal(payload.talhao, 'Talhão alterado na UI');
    assert.equal(Object.keys(payload).some((key) => key.startsWith('localizacao_')), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'localizacaoDraft'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'capturedForPropertyId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'removalPending'), false);
  });

  await test('helpers de apresentação do caderno cobrem tipo, talhão, visibilidade e ordenação', () => {
    assert.equal(getCadernoTipoLabel('correcao_solo'), 'Correção de solo');
    assert.equal(getCadernoTipoLabel('ocorrencia'), 'Ocorrência');
    assert.equal(getCadernoTipoLabel('vistoria'), 'Vistoria');
    assert.equal(getCadernoTalhaoLabel({}), 'Toda a Propriedade');
    assert.equal(getCadernoTalhaoLabel({ talhao: 'Talhão A' }), 'Talhão A');
    assert.equal(isCadernoTalhaoLegado({ talhao: 'Talhão A' }), true);
    assert.equal(isCadernoTalhaoLegado({ talhao_id: 't1', talhao: 'Talhão A' }), false);
    assert.equal(getCadernoRegistradoPorLabel({ criado_por_nome: 'Ana Souza' }), 'Ana Souza');
    assert.equal(getCadernoRegistradoPorLabel({
      criado_por_user_id: 'id-interno',
      origem_registro: 'equipe',
    }), 'Registrado pela equipe');
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

  await test('opções de Talhão usam ID, oferecem Toda a Propriedade e explicitam legado', () => {
    const stable = buildCadernoTalhaoOptions([
      { id: 'geometria_1', talhao_id: 'talhao_1', talhao: 'Talhão Norte' },
      { id: 'geometria_2', talhao_id: 'talhao_1', talhao: 'Talhão Norte' },
      { id: 'geometria_sem_identidade', talhao: 'Somente geometria' },
      { talhao: 'Somente nome' },
    ]);
    assert.deepEqual(stable.options.map(({ value, label }) => ({ value, label })), [
      { value: '', label: 'Toda a Propriedade' },
      { value: 'talhao_1', label: 'Talhão Norte' },
    ]);

    const legacy = buildCadernoTalhaoOptions([], { nome: 'Talhão antigo' });
    assert.equal(legacy.selectedValue, CADERNO_TALHAO_LEGADO_VALUE);
    assert.equal(legacy.legacy, true);
    assert.match(legacy.options[1].description, /legada em texto/i);
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
