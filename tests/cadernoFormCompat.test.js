const assert = require('node:assert/strict');
const {
  buildCadernoFazendaOptions,
  buildCadernoPayload,
  findCadernoFazendaOption,
  getCadernoFormFazendaLabel,
  parseCadernoAreaAplicada,
  parseCadernoProdutos,
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
    });

    assert.equal(payload.fazenda_id, 'faz_payload');
    assert.equal(payload.colaborador_responsavel, 'Carlos Silva');
    assert.equal(payload.tipo_atividade, 'adubacao');
    assert.equal(payload.area_aplicada, 120.5);
    assert.equal(payload.visivel_para_produtor, false);
    assert.equal(payload.criado_por_user_id, 'u2');
    assert.deepEqual(payload.produtos_utilizados, ['MAP', 'KCl']);
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
