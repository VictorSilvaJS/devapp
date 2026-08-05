const assert = require('node:assert/strict');
const {
  normalizeCadernoCampo,
  normalizeFazenda,
  normalizeLimiteArea,
  normalizeMapa,
  normalizeVisita,
} = require('../.tmp-domain-compat/src/domain');
const {
  readMockFazenda,
} = require('../.tmp-domain-compat/src/api/produtorCompat');
const {
  buildVisitaFazendaOptions,
  buildVisitaPayload,
} = require('../.tmp-domain-compat/src/utils/visitaFormCompat');
const {
  buildCadernoFazendaOptions,
  buildCadernoPayload,
} = require('../.tmp-domain-compat/src/utils/cadernoFormCompat');
const {
  getPropriedadeId,
  getPropriedadeNome,
  getTitularId,
  withPropriedadeCompat,
  withTitularCompat,
} = require('../.tmp-domain-compat/src/utils/propriedadeCompat');
const {
  buildPropriedadeContextRouteParams,
  buildPropriedadeDetailRouteParams,
  resolvePropriedadeRouteContext,
} = require('../.tmp-domain-compat/src/navigation/propriedadeRouteCompat');

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
  await test('diagnostico: getPropriedadeId registra prioridade atual de aliases de Propriedade', () => {
    assert.equal(getPropriedadeId({
      propriedade_id: 'prop_snake',
      propriedadeId: 'prop_camel',
      fazenda_id: 'faz_snake',
      fazendaId: 'faz_camel',
      id: 'id_base',
    }), 'prop_snake');

    assert.equal(getPropriedadeId({ propriedadeId: 'prop_camel' }), 'prop_camel');
    assert.equal(getPropriedadeId({ fazenda_id: 'faz_snake' }), 'faz_snake');
    assert.equal(getPropriedadeId({ fazendaId: 'faz_camel' }), 'faz_camel');

    // Diagnostico Fase 15B: id puro ainda nao e promovido pelo resolver central.
    // Quando o registro passa por produtorCompat, id e reexposto como fazenda_id/propriedade_id.
    assert.equal(getPropriedadeId({ id: 'id_puro' }), undefined);

    const pelaBordaMock = readMockFazenda({
      id: 'id_borda',
      produtor_id: 'titular_borda',
      nome: 'Propriedade Pela Borda',
      area_total: 100,
    });

    assert.equal(pelaBordaMock.fazenda_id, 'id_borda');
    assert.equal(getPropriedadeId(pelaBordaMock), 'id_borda');
  });

  await test('diagnostico: getPropriedadeNome registra prioridade atual de nomes de Propriedade', () => {
    assert.equal(getPropriedadeNome({
      propriedade_nome: 'Nome snake',
      propriedadeNome: 'Nome camel',
      fazenda_nome: 'Nome fazenda snake',
      fazendaNome: 'Nome fazenda camel',
      fazenda: 'Nome fazenda legado',
      nome: 'Nome base',
    }), 'Nome snake');

    assert.equal(getPropriedadeNome({ propriedadeNome: 'Nome camel' }), 'Nome camel');
    assert.equal(getPropriedadeNome({ fazenda_nome: 'Nome fazenda snake' }), 'Nome fazenda snake');
    assert.equal(getPropriedadeNome({ fazendaNome: 'Nome fazenda camel' }), 'Nome fazenda camel');
    assert.equal(getPropriedadeNome({ nome: 'Nome base' }), 'Nome base');

    // Diagnostico Fase 15B: fazenda puro e legado de borda; produtorCompat o converte
    // para propriedade_nome/fazenda_nome antes da leitura canonica futura.
    assert.equal(getPropriedadeNome({ fazenda: 'Nome fazenda puro' }), undefined);

    const pelaBordaMock = readMockFazenda({
      id: 'faz_nome_borda',
      proprietario_id: 'titular_nome_borda',
      nome: 'Titular Nome Borda',
      fazenda: 'Propriedade Nome Borda',
      area_total: 100,
    });

    assert.equal(pelaBordaMock.fazenda, 'Propriedade Nome Borda');
    assert.equal(getPropriedadeNome(pelaBordaMock), 'Propriedade Nome Borda');
  });

  await test('diagnostico: getTitularId registra titular_id como alias futuro e produtor_id como titular em Propriedade', () => {
    assert.equal(getTitularId({
      titular_id: 'tit_snake',
      titularId: 'tit_camel',
      proprietario_id: 'tit_proprietario',
      produtor_id: 'tit_produtor',
    }), 'tit_snake');

    assert.equal(getTitularId({ titularId: 'tit_camel' }), 'tit_camel');
    assert.equal(getTitularId({ proprietario_id: 'tit_proprietario' }), 'tit_proprietario');
    assert.equal(getTitularId({ produtor_id: 'tit_produtor' }), 'tit_produtor');
  });

  await test('diagnostico: withPropriedadeCompat preserva legado e adiciona alias futuro', () => {
    const legado = {
      id: 'registro_legado',
      fazenda_id: 'faz_legada',
      fazendaId: 'faz_legada_camel',
      fazenda: 'Propriedade Legada',
      produtor_id: 'titular_legado',
    };
    const compat = withPropriedadeCompat(legado);

    assert.equal(compat.fazenda_id, 'faz_legada');
    assert.equal(compat.fazendaId, 'faz_legada_camel');
    assert.equal(compat.propriedade_id, 'faz_legada');
    assert.equal(compat.propriedadeId, 'faz_legada');

    const existente = withPropriedadeCompat({
      fazenda_id: 'faz_legada',
      propriedade_id: 'prop_existente',
      propriedadeId: 'prop_existente_camel',
    });

    assert.equal(existente.fazenda_id, 'faz_legada');
    assert.equal(existente.propriedade_id, 'prop_existente');
    assert.equal(existente.propriedadeId, 'prop_existente_camel');
  });

  await test('diagnostico: withTitularCompat preserva legado e adiciona alias futuro', () => {
    const legado = {
      proprietario_id: 'tit_proprietario',
      produtor_id: 'tit_produtor',
      nome: 'Titular Legado',
    };
    const compat = withTitularCompat(legado);

    assert.equal(compat.proprietario_id, 'tit_proprietario');
    assert.equal(compat.produtor_id, 'tit_produtor');
    assert.equal(compat.titular_id, 'tit_proprietario');
    assert.equal(compat.titularId, 'tit_proprietario');

    const existente = withTitularCompat({
      produtor_id: 'tit_produtor',
      titular_id: 'tit_existente',
      titularId: 'tit_existente_camel',
    });

    assert.equal(existente.produtor_id, 'tit_produtor');
    assert.equal(existente.titular_id, 'tit_existente');
    assert.equal(existente.titularId, 'tit_existente_camel');
  });

  await test('diagnostico: produtorCompat emite fazenda_id e aliases futuros sem apagar titular legado', () => {
    const registro = readMockFazenda({
      id: 'faz_produtor_compat',
      produtor_id: 'titular_produtor_compat',
      proprietario_id: 'titular_produtor_compat',
      nome: 'Titular Produtor Compat',
      fazenda: 'Propriedade Produtor Compat',
      area_total: 300,
    });

    assert.equal(registro.fazenda_id, 'faz_produtor_compat');
    assert.equal(registro.propriedade_id, 'faz_produtor_compat');
    assert.equal(registro.propriedadeId, 'faz_produtor_compat');
    assert.equal(registro.fazenda_nome, 'Propriedade Produtor Compat');
    assert.equal(registro.propriedade_nome, 'Propriedade Produtor Compat');
    assert.equal(registro.propriedadeNome, 'Propriedade Produtor Compat');
    assert.equal(registro.produtor_id, 'titular_produtor_compat');
    assert.equal(registro.proprietario_id, 'titular_produtor_compat');
    assert.equal(registro.titular_id, 'titular_produtor_compat');
    assert.equal(registro.titularId, 'titular_produtor_compat');
  });

  await test('v2: Visita e Caderno emitem apenas propriedade_id nas novas escritas', () => {
    const visita = buildVisitaPayload({
      propriedadeId: 'prop_operacional',
      dataVisita: new Date('2026-04-20T00:00:00.000Z'),
      horaVisita: new Date('2026-04-20T10:00:00.000Z'),
      objetivo: 'consultoria',
    });
    const caderno = buildCadernoPayload({
      propriedadeId: 'prop_operacional',
      dataAtividade: new Date('2026-04-20T00:00:00.000Z'),
      tipoAtividade: 'vistoria',
    });

    assert.equal(visita.propriedade_id, 'prop_operacional');
    assert.equal(caderno.propriedade_id, 'prop_operacional');
    assert.equal(Object.prototype.hasOwnProperty.call(visita, 'fazenda_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(caderno, 'fazenda_id'), false);
  });

  await test('diagnostico: fixtures com propriedade_id nao quebram leitura compativel de formularios', () => {
    const propriedadeFutura = {
      propriedade_id: 'prop_futura',
      propriedade_nome: 'Propriedade Futura',
      titular_id: 'titular_futuro',
      titular_nome: 'Titular Futuro',
      cidade: 'Rio Verde',
      estado: 'GO',
    };

    assert.deepEqual(buildVisitaFazendaOptions([propriedadeFutura]), [
      {
        id: 'prop_futura',
        fazendaNome: 'Propriedade Futura',
        titularNome: 'Titular Futuro',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);

    assert.deepEqual(buildCadernoFazendaOptions([propriedadeFutura]), [
      {
        id: 'prop_futura',
        fazendaNome: 'Propriedade Futura',
        titularNome: 'Titular Futuro',
        cidade: 'Rio Verde',
        estado: 'GO',
      },
    ]);
  });

  await test('diagnostico: produtor_id em Usuario/Propriedade ainda representa Titular', () => {
    const usuarioProdutor = {
      id: 'u_titular',
      perfil: 'produtor',
      produtor_id: 'titular_usuario',
      nome: 'Usuario Titular',
    };
    const propriedade = {
      id: 'faz_titular',
      produtor_id: 'titular_propriedade',
      proprietario_id: 'titular_propriedade',
      nome: 'Titular Propriedade',
      fazenda: 'Propriedade Com Titular',
    };

    assert.equal(usuarioProdutor.produtor_id, 'titular_usuario');
    assert.equal(getTitularId(propriedade), 'titular_propriedade');
    assert.equal(normalizeFazenda(propriedade).titular_id, 'titular_propriedade');
  });

  await test('diagnostico: produtor_id em mapa/visita/caderno/limite e contexto legado de Propriedade', () => {
    // Nestas entidades, produtor_id e lido somente como alias legado do contexto
    // operacional e normalizado para propriedade_id.
    assert.equal(normalizeMapa({
      id: 'mapa_legado',
      titulo: 'Mapa Legado',
      categoria: 'fertilidade',
      produtor_id: 'faz_contexto_mapa',
      talhao: 'T1',
    }).propriedade_id, 'faz_contexto_mapa');

    assert.equal(normalizeVisita({
      id: 'visita_legada',
      produtor_id: 'faz_contexto_visita',
      tecnico_responsavel: 'Ana',
      data_visita: '2026-04-20T00:00:00.000Z',
      objetivo: 'consultoria',
    }).propriedade_id, 'faz_contexto_visita');

    assert.equal(normalizeCadernoCampo({
      id: 'caderno_legado',
      produtor_id: 'faz_contexto_caderno',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-20T00:00:00.000Z',
      tipo_atividade: 'vistoria',
    }).propriedade_id, 'faz_contexto_caderno');

    assert.equal(normalizeLimiteArea({
      id: 'limite_legado',
      nome: 'Limite Legado',
      ano: 2026,
      produtor_id: 'faz_contexto_limite',
      talhao: 'T1',
      poligono: [{ lat: -10, lng: -50 }],
    }).propriedade_id, 'faz_contexto_limite');
  });

  await test('diagnostico: helpers de rota preservam params atuais e aceitam aliases futuros', () => {
    const propriedade = {
      propriedade_id: 'prop_rota',
      propriedade_nome: 'Propriedade Rota',
      titular_nome: 'Titular Rota',
    };

    assert.deepEqual(buildPropriedadeDetailRouteParams(propriedade), {
      id: 'prop_rota',
    });

    assert.deepEqual(buildPropriedadeContextRouteParams(propriedade), {
      propriedadeId: 'prop_rota',
    });
  });

  await test('v2: resolver de rota prioriza propriedadeId e ainda le aliases legados', () => {
    assert.deepEqual(resolvePropriedadeRouteContext({
      fazendaId: 'faz_rota',
      produtorId: 'produtor_legado_rota',
      id: 'id_legado_rota',
      propriedadeId: 'prop_futura_rota',
    }), {
      fazendaId: 'faz_rota',
      produtorId: 'produtor_legado_rota',
      id: 'id_legado_rota',
      propriedadeId: 'prop_futura_rota',
      propriedadeIdAlias: 'prop_futura_rota',
      effectivePropriedadeId: 'prop_futura_rota',
      effectiveFazendaId: 'prop_futura_rota',
      source: 'propriedadeId',
    });

    assert.deepEqual(resolvePropriedadeRouteContext({
      produtorId: 'faz_produtor_alias',
      propriedadeId: 'prop_futura_rota',
    }), {
      fazendaId: undefined,
      produtorId: 'faz_produtor_alias',
      id: undefined,
      propriedadeId: 'prop_futura_rota',
      propriedadeIdAlias: 'prop_futura_rota',
      effectivePropriedadeId: 'prop_futura_rota',
      effectiveFazendaId: 'prop_futura_rota',
      source: 'propriedadeId',
    });

    assert.deepEqual(resolvePropriedadeRouteContext({
      id: 'faz_id_legado',
      propriedadeId: 'prop_futura_rota',
    }, { allowIdAsFazendaId: true }), {
      fazendaId: undefined,
      produtorId: undefined,
      id: 'faz_id_legado',
      propriedadeId: 'prop_futura_rota',
      propriedadeIdAlias: 'prop_futura_rota',
      effectivePropriedadeId: 'prop_futura_rota',
      effectiveFazendaId: 'prop_futura_rota',
      source: 'propriedadeId',
    });

    assert.deepEqual(resolvePropriedadeRouteContext({
      propriedadeId: 'prop_sozinha',
    }), {
      fazendaId: undefined,
      produtorId: undefined,
      id: undefined,
      propriedadeId: 'prop_sozinha',
      propriedadeIdAlias: 'prop_sozinha',
      effectivePropriedadeId: 'prop_sozinha',
      effectiveFazendaId: 'prop_sozinha',
      source: 'propriedadeId',
    });
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de propriedadeTitularCompatDiagnostico passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
