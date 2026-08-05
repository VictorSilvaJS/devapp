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

  await test('v2: colaborador ve somente Propriedades vinculadas diretamente', () => {
    const colaborador = {
      id: 'u_colaborador',
      perfil: 'colaborador',
      vinculos_propriedades: [
        { propriedade_id: 'faz_micro_a_1', tipo_vinculo: 'colaborador', status: 'ativo' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
    ]);
  });

  await test('v2: microregiao sem vinculo direto nao concede acesso', () => {
    const colaborador = {
      id: 'u_colaborador_vinculos_microregioes',
      perfil: 'colaborador',
      regiao: 'Sul',
      vinculos_microregioes: [
        { usuario_id: 'u_colaborador_vinculos_microregioes', regiao: 'Sul', microregiao: 'Micro B' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), []);
  });

  await test('v2: vinculo direto ativo prevalece sobre qualquer texto territorial legado', () => {
    const colaborador = {
      id: 'u_colaborador_prioridade_subregioes',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      vinculos_microregioes: [
        { usuario_id: 'u_colaborador_prioridade_subregioes', regiao: 'Sul', microregiao: 'Micro B' },
      ],
      vinculos_propriedades: [
        { propriedade_id: 'faz_micro_b_1', tipo_vinculo: 'colaborador', status: 'ativo' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_b_1',
    ]);
  });

  await test('v2: authMock alimenta colaborador com vinculos diretos efetivos', () => {
    const colaboradorGoias = authUsers.find((user) => user.id === 'u2');
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

    assert.ok(colaboradorGoias);
    assert.ok(colaboradorGoias.vinculos_propriedades.some((item) => item.propriedade_id === 'p4'));
    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasGoias, colaboradorGoias)), [
      // Os IDs territoriais não coincidem com os vínculos e não concedem acesso.
    ]);
  });

  await test('diagnostico 16B.1: authMock alinha as tres personas principais demonstrativas', () => {
    const admin = authUsers.find((user) => user.id === 'u1');
    const colaborador = authUsers.find((user) => user.id === 'u5');
    const produtor = authUsers.find((user) => user.id === 'u_sela1');

    assert.equal(admin.full_name, 'Admin Demonstração');
    assert.equal(admin.email, 'admin.demonstracao@example.com');
    assert.equal(admin.perfil, 'admin');

    assert.equal(colaborador.full_name, 'Colaborador de Campo');
    assert.equal(colaborador.email, 'colaborador.campo@example.com');
    assert.equal(colaborador.perfil, 'colaborador');
    assert.ok(colaborador.vinculos_propriedades.some((item) => item.propriedade_id === 'p_sela1'));

    assert.equal(produtor.full_name, 'Produtor Demonstração');
    assert.equal(produtor.email, 'produtor.demonstracao@example.com');
    assert.equal(produtor.perfil, 'produtor');
    assert.equal(produtor.produtor_id, 'prop_sela1');
  });

  await test('v2: colaborador usa vinculo direto como regra efetiva', () => {
    const colaborador = {
      id: 'u_colaborador_atribuido',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      propriedades_atribuidas: ['faz_micro_b_1'],
      vinculos_propriedades: [
        { propriedade_id: 'faz_micro_b_1', tipo_vinculo: 'colaborador', status: 'ativo' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_b_1',
    ]);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), [
      'faz_micro_b_1',
    ]);
  });

  await test('v2: sub_regioes ampla nao permite Propriedade sem vinculo direto', () => {
    const colaborador = {
      id: 'u_colaborador_amplo',
      perfil: 'colaborador',
      regiao: 'Sul',
      sub_regioes: ['Micro A'],
      propriedades_atribuidas: ['faz_micro_a_1'],
      vinculos_propriedades: [
        { propriedade_id: 'faz_micro_a_1', tipo_vinculo: 'colaborador', status: 'ativo' },
      ],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), [
      'faz_micro_a_1',
    ]);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), [
      'faz_micro_a_1',
    ]);
  });

  await test('v2: propriedades_atribuidas sem vinculo direto nao concede acesso', () => {
    const colaborador = {
      id: 'u_colaborador_sem_subregiao',
      perfil: 'colaborador',
      regiao: 'Sul',
      propriedades_atribuidas: ['faz_micro_a_1'],
    };

    assert.deepEqual(ids(filtrarProdutoresPorAcesso(fazendasBase, colaborador)), []);
    assert.deepEqual(ids(getPropriedadesDoColaborador(colaborador, fazendasBase)), []);
  });

  await test('v2: propriedade_id e titular_id sustentam o acesso efetivo', () => {
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
    assert.deepEqual(ids(filtrarProdutoresPorAcesso([somenteAliasesFuturos], produtor)), [
      'faz_alias',
    ]);

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
