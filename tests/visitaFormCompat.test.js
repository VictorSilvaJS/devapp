const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  VISITA_FOTOS_MVP_INFO,
  buildVisitaFazendaOptions,
  buildVisitaPayload,
  combineVisitaDateTime,
  findVisitaFazendaOption,
  getVisitaFotoUri,
  getVisitaFluxoUi,
  getVisitaFormFazendaId,
  getVisitaFormFazendaLabel,
  removeVisitaFotoAtIndex,
  resolveVisitaEdicaoFazendaId,
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
        fazendaNome: 'Fazenda Horizonte',
        titularNome: 'João Silva',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);
  });

  await test('buildVisitaFazendaOptions usa aliases futuros em nomes visuais', () => {
    const options = buildVisitaFazendaOptions([
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

  await test('getVisitaFormFazendaId resolve fazenda_id canônico e produtor_id legado', () => {
    assert.equal(getVisitaFormFazendaId({ fazenda_id: 'faz_a' }), 'faz_a');
    assert.equal(getVisitaFormFazendaId({ produtor_id: 'faz_b' }), 'faz_b');
  });

  await test('findVisitaFazendaOption e getVisitaFormFazendaLabel mantêm a borda legível', () => {
    const option = findVisitaFazendaOption(
      [
        {
          id: 'faz_10',
          fazendaNome: 'Estância Boa Vista',
          titularNome: 'Maria Souza',
        },
      ],
      'faz_10'
    );

    assert.equal(getVisitaFormFazendaLabel(option), 'Estância Boa Vista - Maria Souza');
  });

  await test('getVisitaFluxoUi diferencia agendamento e visita realizada', () => {
    const agendada = getVisitaFluxoUi('agendada');
    const realizada = getVisitaFluxoUi('realizada');
    const cancelada = getVisitaFluxoUi('cancelada');

    assert.equal(agendada.status, 'agendada');
    assert.equal(agendada.submitLabel, 'Agendar Visita');
    assert.equal(realizada.status, 'realizada');
    assert.equal(realizada.submitLabel, 'Registrar Visita');
    assert.equal(cancelada.status, 'cancelada');
    assert.equal(cancelada.submitLabel, 'Salvar Alterações');
  });

  await test('resolveVisitaEdicaoFazendaId preserva fazenda original da visita', () => {
    assert.equal(resolveVisitaEdicaoFazendaId({ fazenda_id: 'faz_original' }, 'faz_tentativa'), 'faz_original');
    assert.equal(resolveVisitaEdicaoFazendaId({ produtor_id: 'faz_legada' }, 'faz_tentativa'), 'faz_legada');
    assert.equal(resolveVisitaEdicaoFazendaId({}, 'faz_fallback'), 'faz_fallback');
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

  await test('buildVisitaPayload preserva status realizada com fazenda_id canônico', () => {
    const payload = buildVisitaPayload({
      fazendaId: 'faz_realizada',
      dataVisita: new Date('2026-04-20T00:00:00.000Z'),
      horaVisita: new Date('2026-04-20T10:00:00.000Z'),
      objetivo: 'avaliacao_cultivo',
      status: 'realizada',
    });

    assert.equal(payload.fazenda_id, 'faz_realizada');
    assert.equal(payload.status, 'realizada');
  });

  await test('Nova Visita sem fotos gera payload válido com array vazio', () => {
    const payload = buildVisitaPayload({
      fazendaId: 'faz_sem_foto',
      dataVisita: new Date('2026-07-21T00:00:00.000Z'),
      horaVisita: new Date('2026-07-21T10:30:00.000Z'),
      objetivo: 'consultoria',
      tecnicoResponsavel: 'Colaborador Teste',
    });

    assert.equal(payload.fazenda_id, 'faz_sem_foto');
    assert.deepEqual(payload.fotos, []);
    assert.equal(JSON.stringify(payload).includes('picsum.photos'), false);
  });

  await test('editar somente texto preserva exatamente as fotos existentes', () => {
    const fotosExistentes = [
      'https://picsum.photos/400/300?random=legado',
      { id: 'foto_legada', uri: 'https://exemplo.invalid/demonstrativa.jpg' },
    ];
    const payload = buildVisitaPayload({
      fazendaId: 'faz_edicao',
      dataVisita: new Date('2026-07-21T00:00:00.000Z'),
      horaVisita: new Date('2026-07-21T11:00:00.000Z'),
      objetivo: 'consultoria',
      observacoes: 'Texto editado sem tocar nas imagens',
      fotos: fotosExistentes,
    });

    assert.equal(payload.fotos, fotosExistentes);
    assert.deepEqual(payload.fotos, fotosExistentes);
  });

  await test('registro antigo com foto string ou objeto continua legível', () => {
    assert.equal(
      getVisitaFotoUri('https://picsum.photos/400/300?random=existente'),
      'https://picsum.photos/400/300?random=existente'
    );
    assert.equal(
      getVisitaFotoUri({ uri: 'https://exemplo.invalid/foto-legada.jpg' }),
      'https://exemplo.invalid/foto-legada.jpg'
    );
    assert.equal(getVisitaFotoUri({}), null);
    assert.equal(getVisitaFotoUri(''), null);
  });

  await test('registro sem fotos continua compatível', () => {
    const payload = buildVisitaPayload({
      fazendaId: 'faz_vazio',
      dataVisita: new Date('2026-07-21T00:00:00.000Z'),
      horaVisita: new Date('2026-07-21T12:00:00.000Z'),
      objetivo: 'outro',
      fotos: [],
    });

    assert.deepEqual(payload.fotos, []);
  });

  await test('remoção explícita remove somente a imagem escolhida', () => {
    const fotos = ['foto-a', 'foto-b', 'foto-c'];
    const result = removeVisitaFotoAtIndex(fotos, 1);

    assert.deepEqual(result, ['foto-a', 'foto-c']);
    assert.deepEqual(fotos, ['foto-a', 'foto-b', 'foto-c']);
  });

  await test('payload não cria coordenada, geotag, EXIF ou alias novo de propriedade', () => {
    const payload = buildVisitaPayload({
      fazendaId: 'faz_contexto',
      dataVisita: new Date('2026-07-21T00:00:00.000Z'),
      horaVisita: new Date('2026-07-21T13:00:00.000Z'),
      objetivo: 'consultoria',
    });
    const forbiddenKeys = ['latitude', 'longitude', 'accuracy', 'geotag', 'exif', 'fazendaId'];

    assert.equal(payload.fazenda_id, 'faz_contexto');
    assert.equal(forbiddenKeys.some((key) => Object.hasOwn(payload, key)), false);
    assert.equal(getVisitaFormFazendaId({ fazendaId: 'faz_alias_existente' }), 'faz_alias_existente');
  });

  await test('formulários não geram foto simulada nem integram câmera ou storage', () => {
    const formSources = [
      'src/screens/NovaVisitaScreen.tsx',
      'src/screens/EditarVisitaScreen.tsx',
    ].map((relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')).join('\n');
    const helperSource = fs.readFileSync(
      path.join(__dirname, '..', 'src/utils/visitaFormCompat.ts'),
      'utf8'
    );

    assert.equal(/picsum\.photos|adicionarFotoSimulada|fotoSimulada/.test(formSources), false);
    assert.equal(/launchCamera|launchImageLibrary|ImagePicker|CameraView/.test(formSources), false);
    assert.equal(/latitude|longitude|accuracy|geotag|exif/i.test(formSources), false);
    assert.equal(/AsyncStorage|@tche:|base64|bytes|blob|buffer/i.test(`${formSources}\n${helperSource}`), false);
    assert.equal(VISITA_FOTOS_MVP_INFO.title, 'Fotos no MVP local');
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
