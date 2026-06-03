const assert = require('node:assert/strict');
const {
  filtrarProdutoresPorAcesso,
  getFazendaId,
} = require('../.tmp-domain-compat/src/utils/acessoControle');
const {
  getPropriedadesDoColaborador,
} = require('../.tmp-domain-compat/src/utils/usuarioAdminCompat');
const {
  getPropriedadeId,
  getTitularId,
} = require('../.tmp-domain-compat/src/utils/propriedadeCompat');
const { users: authUsers } = require('../.tmp-domain-compat/src/auth/authMock');

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
    id: 'faz_micro_a_1',
    fazenda_id: 'faz_micro_a_1',
    propriedade_id: 'faz_micro_a_1',
    produtor_id: 'titular_1',
    proprietario_id: 'titular_1',
    titular_id: 'titular_1',
    nome: 'Titular Um',
    produtor_nome: 'Titular Um',
    fazenda: 'Propriedade Micro A 1',
    fazenda_nome: 'Propriedade Micro A 1',
    regiao: 'Sul',
    microregiao: 'Micro A',
  },
  {
    id: 'faz_micro_a_2',
    fazenda_id: 'faz_micro_a_2',
    propriedade_id: 'faz_micro_a_2',
    produtor_id: 'titular_2',
    proprietario_id: 'titular_2',
    titular_id: 'titular_2',
    nome: 'Titular Dois',
    produtor_nome: 'Titular Dois',
    fazenda: 'Propriedade Micro A 2',
    fazenda_nome: 'Propriedade Micro A 2',
    regiao: 'Sul',
    microregiao: 'Micro A',
  },
  {
    id: 'faz_micro_b_1',
    fazenda_id: 'faz_micro_b_1',
    propriedade_id: 'faz_micro_b_1',
    produtor_id: 'titular_3',
    proprietario_id: 'titular_3',
    titular_id: 'titular_3',
    nome: 'Titular Tres',
    produtor_nome: 'Titular Tres',
    fazenda: 'Propriedade Micro B 1',
    fazenda_nome: 'Propriedade Micro B 1',
    regiao: 'Sul',
    microregiao: 'Micro B',
  },
];

const ids = (fazendas) => fazendas.map((fazenda) => getFazendaId(fazenda));

const run = async () => {
  await test('diagnostico: admin ve todas as Propriedades', () => {
    const admin = { id: 'u_admin', perfil: 'admin' };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, admin)), [
      'faz_micro_a_1',
      'faz_micro_a_2',
      'faz_micro_b_1',
    ]);
  });

  await test('diagnostico: produtor ve Propriedades onde e titular/produtor compativel', () => {
    const produtor = { id: 'u_produtor', perfil: 'produtor', produtor_id: 'titular_1' };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, produtor)), [
      'faz_micro_a_1',
    ]);
  });

  await test('diagnostico: colaborador ve Propriedades por sub_regioes', () => {
    const colaborador = {
      id: 'u_colaborador',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
      'faz_micro_a_2',
    ]);
  });

  await test('diagnostico: colaborador sem sub_regioes usa vinculos_microregioes como fallback', () => {
    const colaborador = {
      id: 'u_colaborador_vinculos_microregioes',
      perfil: 'colaborador',
      regiao: 'Sul',
      vinculos_microregioes: [
        { usuario_id: 'u_colaborador_vinculos_microregioes', regiao: 'Sul', microregiao: 'Micro B' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_b_1',
    ]);
  });

  await test('diagnostico: sub_regioes tem prioridade quando tambem existem vinculos_microregioes', () => {
    const colaborador = {
      id: 'u_colaborador_prioridade_subregioes',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      vinculos_microregioes: [
        { usuario_id: 'u_colaborador_prioridade_subregioes', regiao: 'Sul', microregiao: 'Micro B' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
      'faz_micro_a_2',
    ]);
  });

  await test('diagnostico: authMock alimenta colaborador com sub_regioes efetivas', () => {
    const carlos = authUsers.find((user) => user.id === 'u2');
    const fazendasGoias = [
      {
        id: 'faz_rio_verde',
        fazenda_id: 'faz_rio_verde',
        produtor_id: 'titular_rv',
        proprietario_id: 'titular_rv',
        fazenda: 'Propriedade Rio Verde',
        regiao: 'Goias',
        microregiao: 'Rio Verde',
      },
      {
        id: 'faz_goiania',
        fazenda_id: 'faz_goiania',
        produtor_id: 'titular_gyn',
        proprietario_id: 'titular_gyn',
        fazenda: 'Propriedade Goiania',
        regiao: 'Goias',
        microregiao: 'Goiania',
      },
    ];

    assert.ok(carlos);
    assert.ok(carlos.sub_regioes.includes('Rio Verde'));
    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasGoias, carlos)), [
      'faz_rio_verde',
    ]);
  });

  await test('diagnostico: colaborador nao usa propriedades_atribuidas como regra efetiva', () => {
    const colaborador = {
      id: 'u_colaborador_atribuido',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      propriedades_atribuidas: ['faz_micro_b_1'],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
      'faz_micro_a_2',
    ]);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), [
      'faz_micro_b_1',
    ]);
  });

  await test('diagnostico: sub_regioes ampla permite Propriedade nao atribuida diretamente', () => {
    const colaborador = {
      id: 'u_colaborador_amplo',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      propriedades_atribuidas: ['faz_micro_a_1'],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
      'faz_micro_a_2',
    ]);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), [
      'faz_micro_a_1',
    ]);
  });

  await test('diagnostico: colaborador com propriedades_atribuidas mas sem microregioes efetivas fica sem acesso efetivo', () => {
    const colaborador = {
      id: 'u_colaborador_sem_subregiao',
      perfil: 'colaborador',
      regiao: 'Sul',
      propriedades_atribuidas: ['faz_micro_a_1'],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), []);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), [
      'faz_micro_a_1',
    ]);
  });

  await test('diagnostico: propriedade_id e titular_id sao aliases, legado ainda sustenta acesso efetivo', () => {
    const somenteAliasesFuturos = {
      id: 'faz_alias',
      propriedade_id: 'prop_alias_id',
      propriedadeId: 'prop_alias_id',
      titular_id: 'titular_alias',
      titularId: 'titular_alias',
      nome: 'Propriedade Alias',
      microregiao: 'Micro A',
    };
    const produtor = { id: 'u_alias', perfil: 'produtor', produtor_id: 'titular_alias' };

    assert.equal(getPropriedadeId(somenteAliasesFuturos), 'prop_alias_id');
    assert.equal(getTitularId(somenteAliasesFuturos), 'titular_alias');
    assert.deepEqual(filtrarProdutoresPorAcesso([somenteAliasesFuturos], produtor), []);

    const comLegadoTitular = {
      ...somenteAliasesFuturos,
      produtor_id: 'titular_alias',
      proprietario_id: 'titular_alias',
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso([comLegadoTitular], produtor)), [
      'faz_alias',
    ]);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de acessoEscopoPerfilDiagnostico passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
