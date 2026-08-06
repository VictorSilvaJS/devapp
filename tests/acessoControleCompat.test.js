const assert = require('node:assert/strict');
const {
  avaliarAcessoCaderno,
  avaliarAcessoFazendaPorId,
  avaliarAcessoVisita,
  filtrarCadernosPorAcesso,
  filtrarCadernosPorFazendaIds,
  filtrarMapasPorAcesso,
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorAcesso,
  getFazendaId,
  getFazendaIdsPorAcesso,
  podeBaixarMapa,
  podeCriarProdutor,
  podeCriarVisita,
  podeCriarVisitaEmFazenda,
  podeEditarCadastroPropriedade,
  podeEditarProdutor,
  podeEditarCaderno,
  podeEditarCadernoEmFazenda,
  podeEditarVisita,
  podeExcluirProdutor,
  podeGerenciarPeriodoProdutivo,
  podeGerenciarPeriodoProdutivoEmFazenda,
  podeIncluirCaderno,
  podeIncluirCadernoEmFazenda,
  temAcessoProdutor,
} = require('../.tmp-domain-compat/src/utils/acessoControle');

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

const fazendasBase = [
  {
    id: 'fz1',
    fazenda_id: 'fz1',
    produtor_id: 'prop1',
    proprietario_id: 'prop1',
    nome: 'Ana Souza',
    produtor_nome: 'Ana Souza',
    fazenda: 'Fazenda Sol',
    fazenda_nome: 'Fazenda Sol',
    microregiao: 'Sul 1',
  },
  {
    id: 'fz2',
    fazenda_id: 'fz2',
    produtor_id: 'prop2',
    proprietario_id: 'prop2',
    nome: 'Bruno Lima',
    produtor_nome: 'Bruno Lima',
    fazenda: 'Fazenda Lua',
    fazenda_nome: 'Fazenda Lua',
    microregiao: 'Norte 1',
  },
  {
    id: 'fz3',
    produtor_id: 'prop1',
    nome: 'Fazenda Serra',
    produtor_nome: 'Ana Souza',
    microregiao: 'Sul 1',
  },
];

const produtorUser = { id: 'u1', perfil: 'produtor', produtor_id: 'prop1' };
const colaboradorUser = {
  id: 'u2',
  perfil: 'colaborador',
  vinculos_propriedades: [
    { propriedade_id: 'fz1', tipo_vinculo: 'colaborador', status: 'ativo' },
    { propriedade_id: 'fz3', tipo_vinculo: 'colaborador', status: 'ativo' },
  ],
};
const adminUser = { id: 'u3', perfil: 'admin' };

const run = async () => {
  await test('filtrarProdutoresPorAcesso usa o titular da fazenda em vez de comparar com o id da fazenda', () => {
    const resultado = filtrarProdutoresPorAcesso(fazendasBase, produtorUser);

    assert.deepEqual(
      resultado.map((fazenda) => fazenda.id),
      ['fz1', 'fz3']
    );
  });

  await test('getFazendaIdsPorAcesso devolve ids operacionais das fazendas do titular', () => {
    const ids = getFazendaIdsPorAcesso(produtorUser, fazendasBase);

    assert.deepEqual(ids, ['fz1', 'fz3']);
  });

  await test('propriedade_id prevalece sobre id e aliases legados no controle de acesso', () => {
    const propriedadeComConflito = {
      id: 'fz_id_intermediario',
      propriedade_id: 'fz_canonica',
      propriedadeId: 'fz_camel',
      fazenda_id: 'fz_legada',
      fazendaId: 'fz_legada_camel',
      produtor_id: 'titular_1',
      nome: 'Propriedade canônica',
    };
    const colaboradorCanonico = {
      id: 'colaborador_canonico',
      perfil: 'colaborador',
      vinculos_propriedades: [{
        propriedade_id: 'fz_canonica', tipo_vinculo: 'colaborador', status: 'ativo',
      }],
    };
    const colaboradorLegado = {
      ...colaboradorCanonico,
      id: 'colaborador_legado',
      vinculos_propriedades: [{
        propriedade_id: 'fz_legada', tipo_vinculo: 'colaborador', status: 'ativo',
      }],
    };

    assert.equal(getFazendaId(propriedadeComConflito), 'fz_canonica');
    assert.equal(getFazendaId({ propriedadeId: 'fz_camel', fazenda_id: 'fz_legada' }), 'fz_camel');
    assert.equal(getFazendaId({ id: 'fz_id', fazenda_id: 'fz_legada' }), 'fz_id');
    assert.equal(getFazendaId({ fazenda_id: 'fz_legada' }), 'fz_legada');
    assert.equal(temAcessoProdutor(colaboradorCanonico, propriedadeComConflito), true);
    assert.equal(temAcessoProdutor(colaboradorLegado, propriedadeComConflito), false);
  });

  await test('recursos com IDs conflitantes são autorizados somente por propriedade_id', () => {
    const propriedade = {
      id: 'fz_canonica', propriedade_id: 'fz_canonica', fazenda_id: 'fz_legada',
      produtor_id: 'titular_1', nome: 'Propriedade canônica',
    };
    const colaborador = {
      id: 'colaborador_canonico', perfil: 'colaborador',
      vinculos_propriedades: [{
        propriedade_id: 'fz_canonica', tipo_vinculo: 'colaborador', status: 'ativo',
      }],
    };
    const conflito = { propriedade_id: 'fz_canonica', fazenda_id: 'fz_legada' };

    assert.deepEqual(
      filtrarVisitasPorAcesso([{
        id: 'v_conflito', ...conflito, tecnico_responsavel: 'Ana',
        data_visita: '2026-08-06', objetivo: 'consultoria',
      }], colaborador, [propriedade]).map((item) => item.id),
      ['v_conflito']
    );
    assert.deepEqual(
      filtrarCadernosPorAcesso([{
        id: 'c_conflito', ...conflito, colaborador_responsavel: 'Ana',
        data_atividade: '2026-08-06', tipo_atividade: 'observacao',
      }], colaborador, [propriedade]).map((item) => item.id),
      ['c_conflito']
    );
    assert.deepEqual(
      filtrarMapasPorAcesso([{
        id: 'm_conflito', ...conflito, produtor_id: 'fz_legada', disponivel_download: true,
      }], colaborador, [propriedade]).map((item) => item.id),
      ['m_conflito']
    );
  });

  await test('filtrarMapasPorAcesso mantém fallback de fazenda_id e respeita download para produtor', () => {
    const mapas = [
      { id: 'm1', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: true },
      { id: 'm2', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: false },
      { id: 'm3', fazenda_id: 'fz2', produtor_id: 'fz2', disponivel_download: true },
    ];

    const resultado = filtrarMapasPorAcesso(mapas, produtorUser, fazendasBase);

    assert.deepEqual(resultado.map((mapa) => mapa.id), ['m1']);
  });

  await test('filtrarVisitasPorAcesso mantém fallback de fazenda_id para colaborador', () => {
    const visitas = [
      { id: 'v1', fazenda_id: 'fz1', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' },
      { id: 'v2', fazenda_id: 'fz2', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' },
    ];

    const resultado = filtrarVisitasPorAcesso(visitas, colaboradorUser, fazendasBase);

    assert.deepEqual(resultado.map((visita) => visita.id), ['v1']);
  });

  await test('avaliarAcessoVisita bloqueia visita fora da fazenda autorizada', () => {
    const visitaPropria = { id: 'v1', fazenda_id: 'fz1', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' };
    const visitaForaEscopo = { id: 'v2', fazenda_id: 'fz2', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' };
    const visitaSemFazenda = { id: 'v3', fazenda_id: 'fz999', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' };

    const acessoProdutor = avaliarAcessoVisita(produtorUser, visitaPropria, fazendasBase);
    const acessoProdutorFora = avaliarAcessoVisita(produtorUser, visitaForaEscopo, fazendasBase);
    const acessoColaboradorFora = avaliarAcessoVisita(colaboradorUser, visitaForaEscopo, fazendasBase);
    const acessoAdmin = avaliarAcessoVisita(adminUser, visitaForaEscopo, fazendasBase);
    const acessoSemFazenda = avaliarAcessoVisita(adminUser, visitaSemFazenda, fazendasBase);

    assert.equal(acessoProdutor.status, 'permitido');
    assert.equal(acessoProdutor.fazendaId, 'fz1');
    assert.equal(acessoProdutorFora.status, 'acesso_negado');
    assert.equal(acessoColaboradorFora.status, 'acesso_negado');
    assert.equal(acessoAdmin.status, 'permitido');
    assert.equal(acessoSemFazenda.status, 'fazenda_nao_encontrada');
  });

  await test('podeCriarVisita e podeCriarVisitaEmFazenda bloqueiam produtor e colaborador fora do escopo', () => {
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(podeCriarVisita(produtorUser), false);
    assert.equal(podeCriarVisita(adminUser), true);
    assert.equal(podeCriarVisita(colaboradorUser), true);
    assert.equal(podeCriarVisitaEmFazenda(produtorUser, fazendaNoEscopo), false);
    assert.equal(podeCriarVisitaEmFazenda(colaboradorUser, fazendaNoEscopo), true);
    assert.equal(podeCriarVisitaEmFazenda(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(podeCriarVisitaEmFazenda(adminUser, fazendaForaEscopo), true);
  });

  await test('podeEditarVisita bloqueia produtor e colaborador fora do escopo', () => {
    const visita = { id: 'v1', fazenda_id: 'fz1', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' };
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(podeEditarVisita(produtorUser, visita, fazendaNoEscopo), false);
    assert.equal(podeEditarVisita(colaboradorUser, visita, fazendaNoEscopo), true);
    assert.equal(podeEditarVisita(colaboradorUser, visita, fazendaForaEscopo), false);
    assert.equal(podeEditarVisita(adminUser, visita, fazendaForaEscopo), true);
  });

  await test('filtrarCadernosPorAcesso mantém compatibilidade legada e restringe visibilidade do produtor', () => {
    const registros = [
      { id: 'c1', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
      { id: 'c2', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: false },
      { id: 'c3', produtor_id: 'fz2', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
      { id: 'c4', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-17', tipo_atividade: 'observacao' },
    ];

    const resultado = filtrarCadernosPorAcesso(registros, produtorUser, fazendasBase);

    assert.deepEqual(resultado.map((registro) => registro.id), ['c1', 'c4']);
  });

  await test('filtrarCadernosPorFazendaIds alimenta detalhe da fazenda com visibilidade correta', () => {
    const registros = [
      { id: 'c1', fazenda_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
      { id: 'c2', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'adubacao', visivel_para_produtor: false },
      { id: 'c3', fazenda_id: 'fz2', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
    ];

    const equipe = filtrarCadernosPorFazendaIds(registros, ['fz1']);
    const produtor = filtrarCadernosPorFazendaIds(registros, ['fz1'], {
      somenteVisivelParaProdutor: true,
    });

    assert.deepEqual(equipe.map((registro) => registro.id), ['c1', 'c2']);
    assert.deepEqual(produtor.map((registro) => registro.id), ['c1']);
  });

  await test('avaliarAcessoCaderno valida fazenda e visibilidade do detalhe', () => {
    const registroVisivel = {
      id: 'c1',
      fazenda_id: 'fz1',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-16',
      tipo_atividade: 'vistoria',
      visivel_para_produtor: true,
    };
    const registroRestrito = {
      id: 'c2',
      fazenda_id: 'fz1',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-16',
      tipo_atividade: 'vistoria',
      visivel_para_produtor: false,
    };
    const registroForaEscopo = {
      id: 'c3',
      fazenda_id: 'fz2',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-16',
      tipo_atividade: 'vistoria',
      visivel_para_produtor: true,
    };
    const registroSemFazenda = {
      id: 'c4',
      fazenda_id: 'fz999',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-16',
      tipo_atividade: 'vistoria',
      visivel_para_produtor: true,
    };

    assert.equal(avaliarAcessoCaderno(produtorUser, registroVisivel, fazendasBase).status, 'permitido');
    assert.equal(avaliarAcessoCaderno(produtorUser, registroRestrito, fazendasBase).status, 'acesso_negado');
    assert.equal(avaliarAcessoCaderno(produtorUser, registroForaEscopo, fazendasBase).status, 'acesso_negado');
    assert.equal(avaliarAcessoCaderno(colaboradorUser, registroVisivel, fazendasBase).status, 'permitido');
    assert.equal(avaliarAcessoCaderno(colaboradorUser, registroForaEscopo, fazendasBase).status, 'acesso_negado');
    assert.equal(avaliarAcessoCaderno(adminUser, registroRestrito, fazendasBase).status, 'permitido');
    assert.equal(avaliarAcessoCaderno(adminUser, registroSemFazenda, fazendasBase).status, 'fazenda_nao_encontrada');
  });

  await test('podeIncluirCadernoEmFazenda permite produtor na propria Propriedade e equipe no escopo', () => {
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(podeIncluirCaderno(produtorUser), true);
    assert.equal(podeIncluirCaderno(colaboradorUser), true);
    assert.equal(podeIncluirCaderno(adminUser), true);
    assert.equal(podeIncluirCadernoEmFazenda(produtorUser, fazendaNoEscopo), true);
    assert.equal(podeIncluirCadernoEmFazenda(produtorUser, fazendaForaEscopo), false);
    assert.equal(podeIncluirCadernoEmFazenda(colaboradorUser, fazendaNoEscopo), true);
    assert.equal(podeIncluirCadernoEmFazenda(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(podeIncluirCadernoEmFazenda(adminUser, fazendaForaEscopo), true);
  });

  await test('podeGerenciarPeriodoProdutivo bloqueia produtor e preserva escopo da equipe', () => {
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(podeGerenciarPeriodoProdutivo(produtorUser), false);
    assert.equal(podeGerenciarPeriodoProdutivo(colaboradorUser), true);
    assert.equal(podeGerenciarPeriodoProdutivo(adminUser), true);
    assert.equal(podeGerenciarPeriodoProdutivoEmFazenda(produtorUser, fazendaNoEscopo), false);
    assert.equal(podeGerenciarPeriodoProdutivoEmFazenda(colaboradorUser, fazendaNoEscopo), true);
    assert.equal(podeGerenciarPeriodoProdutivoEmFazenda(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(podeGerenciarPeriodoProdutivoEmFazenda(adminUser, fazendaForaEscopo), true);
  });

  await test('podeEditarCadernoEmFazenda limita edição destrutiva ao próprio rascunho e ao escopo', () => {
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];
    const registroDoProdutor = {
      id: 'c1',
      fazenda_id: 'fz1',
      colaborador_responsavel: 'Ana',
      data_atividade: '2026-04-16',
      tipo_atividade: 'vistoria',
      visivel_para_produtor: true,
      criado_por_user_id: 'u1',
      estado_caderno: 'rascunho',
    };
    const registroDeOutro = {
      ...registroDoProdutor,
      id: 'c2',
      criado_por_user_id: 'u99',
    };

    const registroDoColaborador = { ...registroDoProdutor, id: 'c3', criado_por_user_id: 'u2' };
    const registroDoAdmin = { ...registroDoProdutor, id: 'c4', fazenda_id: 'fz2', criado_por_user_id: 'u3' };
    const registroConsolidado = { ...registroDoColaborador, estado_caderno: 'registrado' };

    assert.equal(podeEditarCaderno(produtorUser, registroDoProdutor), true);
    assert.equal(podeEditarCaderno(produtorUser, registroDeOutro), false);
    assert.equal(podeEditarCadernoEmFazenda(produtorUser, registroDoProdutor, fazendaNoEscopo), true);
    assert.equal(podeEditarCadernoEmFazenda(produtorUser, registroDoProdutor, fazendaForaEscopo), false);
    assert.equal(podeEditarCadernoEmFazenda(colaboradorUser, registroDoColaborador, fazendaNoEscopo), true);
    assert.equal(podeEditarCadernoEmFazenda(colaboradorUser, registroConsolidado, fazendaNoEscopo), false);
    assert.equal(podeEditarCadernoEmFazenda(colaboradorUser, registroDoColaborador, fazendaForaEscopo), false);
    assert.equal(podeEditarCadernoEmFazenda(adminUser, registroDoAdmin, fazendaForaEscopo), true);
    assert.equal(podeEditarCadernoEmFazenda(adminUser, registroDeOutro, fazendaForaEscopo), false);
  });

  await test('podeBaixarMapa usa a fazenda do mapa quando a lista de fazendas está disponível', () => {
    const mapaProprio = { id: 'm1', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: true };
    const mapaDeOutro = { id: 'm2', fazenda_id: 'fz2', produtor_id: 'fz2', disponivel_download: true };

    assert.equal(podeBaixarMapa(produtorUser, mapaProprio, fazendasBase), true);
    assert.equal(podeBaixarMapa(produtorUser, mapaDeOutro, fazendasBase), false);
    assert.equal(podeBaixarMapa(adminUser, { ...mapaDeOutro, disponivel_download: false }, fazendasBase), true);
  });

  await test('temAcessoProdutor protege detalhe por titular e vínculo direto', () => {
    const fazendaPropria = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(temAcessoProdutor(produtorUser, fazendaPropria), true);
    assert.equal(temAcessoProdutor(produtorUser, fazendaForaEscopo), false);
    assert.equal(temAcessoProdutor(colaboradorUser, fazendaPropria), true);
    assert.equal(temAcessoProdutor(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(temAcessoProdutor(adminUser, fazendaForaEscopo), true);
  });

  await test('avaliarAcessoFazendaPorId valida rota de fazenda contra escopo do usuário', () => {
    const acessoProdutor = avaliarAcessoFazendaPorId(fazendasBase, produtorUser, 'fz1');
    const acessoColaboradorForaEscopo = avaliarAcessoFazendaPorId(fazendasBase, colaboradorUser, 'fz2');
    const acessoAdmin = avaliarAcessoFazendaPorId(fazendasBase, adminUser, 'fz2');
    const fazendaInexistente = avaliarAcessoFazendaPorId(fazendasBase, adminUser, 'fz999');

    assert.equal(acessoProdutor.status, 'permitido');
    assert.equal(acessoProdutor.fazendaId, 'fz1');
    assert.equal(acessoColaboradorForaEscopo.status, 'acesso_negado');
    assert.equal(acessoAdmin.status, 'permitido');
    assert.equal(acessoAdmin.fazendaId, 'fz2');
    assert.equal(fazendaInexistente.status, 'fazenda_nao_encontrada');
    assert.equal(fazendaInexistente.fazenda, null);
  });

  await test('podeEditarProdutor e podeExcluirProdutor bloqueiam produtor e colaborador fora do escopo', () => {
    const fazendaNoEscopo = fazendasBase[0];
    const fazendaForaEscopo = fazendasBase[1];

    assert.equal(podeEditarProdutor(produtorUser, fazendaNoEscopo), false);
    assert.equal(podeExcluirProdutor(produtorUser, fazendaNoEscopo), false);
    assert.equal(podeEditarProdutor(colaboradorUser, fazendaNoEscopo), true);
    assert.equal(podeExcluirProdutor(colaboradorUser, fazendaNoEscopo), true);
    assert.equal(podeEditarProdutor(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(podeExcluirProdutor(colaboradorUser, fazendaForaEscopo), false);
    assert.equal(podeEditarProdutor(adminUser, fazendaForaEscopo), true);
    assert.equal(podeExcluirProdutor(adminUser, fazendaForaEscopo), true);
  });

  await test('edição cadastral da Propriedade é exclusiva do Admin', () => {
    assert.equal(podeEditarCadastroPropriedade(adminUser, fazendasBase[0]), true);
    assert.equal(podeEditarCadastroPropriedade(colaboradorUser, fazendasBase[0]), false);
    assert.equal(podeEditarCadastroPropriedade(produtorUser, fazendasBase[0]), false);
    assert.equal(podeEditarCadastroPropriedade(adminUser, null), false);
  });

  await test('cadastro estrutural de Propriedade fica restrito ao Admin', () => {
    assert.equal(podeCriarProdutor(adminUser), true);
    assert.equal(podeCriarProdutor(colaboradorUser), false);
    assert.equal(podeCriarProdutor(produtorUser), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de acessoControleCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
