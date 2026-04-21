const assert = require('node:assert/strict');
const {
  buildVisitaFazendaOptions,
  buildVisitaPayload,
  combineVisitaDateTime,
  findVisitaFazendaOption,
  getVisitaFormFazendaId,
  getVisitaFormFazendaLabel,
} = require('../.tmp-domain-compat/src/utils/visitaFormCompat');

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
  await test('buildVisitaFazendaOptions explicita id operacional de fazenda para a UI', () => {
    const options = buildVisitaFazendaOptions([
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
        produtorNome: 'João Silva',
        fazendaNome: 'Fazenda Horizonte',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);
  });

  await test('getVisitaFormFazendaId resolve fazenda_id canônico e produtor_id legado', () => {
    assert.equal(getVisitaFormFazendaId({ fazenda_id: 'faz_a' }), 'faz_a');
    assert.equal(getVisitaFormFazendaId({ produtor_id: 'faz_b' }), 'faz_b');
  });

  await test('findVisitaFazendaOption e getVisitaFormFazendaLabel mantêm a borda legível', () => {
    const option = findVisitaFazendaOption(
      [
        {
          id: 'faz_10',
          produtorNome: 'Maria Souza',
          fazendaNome: 'Estância Boa Vista',
        },
      ],
      'faz_10'
    );

    assert.equal(getVisitaFormFazendaLabel(option), 'Maria Souza - Estância Boa Vista');
  });

  await test('combineVisitaDateTime junta data e hora sem depender da tela', () => {
    const dataCompleta = combineVisitaDateTime(
      new Date(2026, 3, 20),
      new Date(2026, 3, 20, 15, 45)
    );

    assert.ok(dataCompleta instanceof Date);
    assert.equal(dataCompleta.getHours(), 15);
    assert.equal(dataCompleta.getMinutes(), 45);
  });

  await test('buildVisitaPayload gera contrato canônico com fazenda_id e mantém campos atuais', () => {
    const payload = buildVisitaPayload({
      fazendaId: 'faz_payload',
      dataVisita: new Date('2026-04-20T00:00:00.000Z'),
      horaVisita: new Date('2026-04-20T13:30:00.000Z'),
      objetivo: 'consultoria',
      observacoes: 'Observação teste',
      recomendacoes: 'Recomendação teste',
      clima: 'Ensolarado',
      proximaVisita: new Date('2026-05-02T00:00:00.000Z'),
      status: 'agendada',
      fotos: [{ id: 'foto1' }],
      tecnicoResponsavel: 'Ana Silva',
    });

    assert.equal(payload.fazenda_id, 'faz_payload');
    assert.equal(payload.tecnico_responsavel, 'Ana Silva');
    assert.equal(payload.objetivo, 'consultoria');
    assert.equal(payload.proximaVisita, '2026-05-02');
    assert.deepEqual(payload.fotos, [{ id: 'foto1' }]);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de visitaFormCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
