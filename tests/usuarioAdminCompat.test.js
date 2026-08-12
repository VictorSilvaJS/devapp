const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildUsuarioAdminPayload,
  buildUsuarioVinculoPrincipal,
  buildVinculosPropriedadesPorMicroregioes,
  getPropriedadesDoColaborador,
  getPropriedadesDoUsuarioProdutor,
  getVinculosPropriedadeAtivosUsuario,
  getVinculosPropriedadeUsuario,
} = require('../.tmp-domain-compat/src/utils/usuarioAdminCompat');
const {
  getColaboradoresRelacionadosAPropriedade,
  getUsuariosProdutoresDaPropriedade,
} = require('../.tmp-domain-compat/src/utils/territorioCompat');

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

const propriedades = [
  {
    id: 'prop_sul_1',
    fazenda_id: 'prop_sul_1',
    fazenda_nome: 'Propriedade Sul Um',
    produtor_id: 'titular_sul',
    titular_id: 'titular_sul',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
  },
  {
    id: 'prop_sul_2',
    fazenda_id: 'prop_sul_2',
    fazenda_nome: 'Propriedade Sul Dois',
    produtor_id: 'titular_sul_2',
    titular_id: 'titular_sul_2',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
  },
  {
    id: 'prop_centro',
    fazenda_id: 'prop_centro',
    fazenda_nome: 'Propriedade Centro',
    produtor_id: 'titular_centro',
    titular_id: 'titular_centro',
    regiao: 'Centro-Oeste',
    microregiao: 'Goiás Central',
  },
];

const baseForm = {
  nome: 'Usuário Teste',
  email: 'usuario.teste@example.com',
  telefone: '',
  documento: '',
  status: 'ativo',
  observacoes: '',
};

const run = async () => {
  await test('produtor emite somente cadastro e vinculos canonicos com propriedades existentes', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'produtor',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_sul_1',
            tipo_vinculo: 'titular',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.equal(payload.produtor_id, undefined);
    assert.equal(payload.vinculos_propriedades.length, 1);
    assert.equal(payload.vinculos_propriedades[0].propriedade_id, 'prop_sul_1');
    assert.equal(payload.vinculos_propriedades[0].tipo_vinculo, 'titular');
    assert.equal(payload.vinculos_propriedades[0].status, 'ativo');
    assert.equal(payload.propriedades_atribuidas, undefined);
    assert.equal(payload.vinculos_microregioes, undefined);
    assert.equal(payload.regiao, undefined);
    assert.equal(payload.senha, undefined);
    assert.equal(payload.ativo, undefined);
  });

  await test('colaborador recebe somente propriedades selecionadas diretamente', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'colaborador',
        cargo: 'Colaborador de Campo',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_centro',
            tipo_vinculo: 'colaborador',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.equal(payload.sub_regioes, undefined);
    assert.equal(payload.propriedades_atribuidas, undefined);
    assert.deepEqual(
      payload.vinculos_propriedades.map((vinculo) => vinculo.tipo_vinculo),
      ['colaborador']
    );
    assert.equal(payload.vinculos_propriedades[0].principal, undefined);
    assert.equal(payload.vinculos_propriedades[0].status, 'ativo');
    assert.equal(payload.vinculos_microregioes, undefined);
  });

  await test('helper territorial legado permanece isolado da montagem do payload v2', () => {
    const vinculos = buildVinculosPropriedadesPorMicroregioes({
      propriedades: [
        ...propriedades,
        {
          id: 'prop_outra_regiao',
          fazenda_id: 'prop_outra_regiao',
          regiao: 'Norte',
          microregiao: 'Goiás Central',
        },
      ],
      regiao: 'Centro Oeste',
      microregioes: ['Goias Central'],
    });

    assert.deepEqual(vinculos, []);

    const vinculosComAcento = buildVinculosPropriedadesPorMicroregioes({
      propriedades,
      regiao: 'Centro-Oeste',
      microregioes: ['Goias Central'],
    });

    assert.deepEqual(vinculosComAcento.map((vinculo) => vinculo.propriedade_id), ['prop_centro']);
  });

  await test('admin permanece sem vinculos operacionais obrigatorios', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'admin',
        nivelAdministrativo: 'global',
        regiao: 'Sul',
        subRegioesText: 'RS - Norte',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_sul_1',
            tipo_vinculo: 'responsavel',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.deepEqual(payload.vinculos_propriedades, []);
    assert.equal(payload.vinculos_microregioes, undefined);
    assert.equal(payload.propriedades_atribuidas, undefined);
    assert.equal(payload.acesso_global, undefined);
    assert.equal(payload.nivel_administrativo, undefined);
  });

  await test('Produtor projeta somente vínculos ativos compatíveis e preserva sua titularidade', () => {
    const usuario = {
      id: 'usr_altair',
      produtor_id: 'titular_sul',
      perfil: 'produtor',
      status: 'ativo',
      vinculos_propriedades: [
        {
          propriedade_id: 'prop_centro',
          tipo_vinculo: 'usuario_autorizado',
          status: 'inativo',
        },
        {
          propriedade_id: 'prop_sul_2',
          tipo_vinculo: 'usuario_autorizado',
          status: 'ativo',
        },
        {
          propriedade_id: 'prop_centro',
          tipo_vinculo: 'colaborador',
          status: 'ativo',
        },
      ],
    };

    assert.equal(getVinculosPropriedadeUsuario(usuario, propriedades).length, 3);
    assert.deepEqual(
      getVinculosPropriedadeAtivosUsuario(usuario, propriedades)
        .map((vinculo) => vinculo.propriedade_id),
      ['prop_sul_2'],
    );
    assert.deepEqual(
      getPropriedadesDoUsuarioProdutor(usuario, propriedades)
        .map((propriedade) => propriedade.id),
      ['prop_sul_1', 'prop_sul_2'],
    );
    assert.equal(buildUsuarioVinculoPrincipal(usuario, propriedades), '2 propriedades vinculadas');
  });

  await test('projeções administrativas e territoriais ignoram vínculos inativos', () => {
    const produtor = {
      id: 'usr_produtor',
      produtor_id: 'titular_sul',
      perfil: 'produtor',
      vinculos_propriedades: [
        { propriedade_id: 'prop_centro', tipo_vinculo: 'usuario_autorizado', status: 'inativo' },
        { propriedade_id: 'prop_sul_2', tipo_vinculo: 'usuario_autorizado', status: 'ativo' },
      ],
    };
    const colaborador = {
      id: 'usr_colaborador',
      perfil: 'colaborador',
      vinculos_propriedades: [
        { propriedade_id: 'prop_centro', tipo_vinculo: 'colaborador', status: 'inativo' },
        { propriedade_id: 'prop_sul_2', tipo_vinculo: 'colaborador', status: 'ativo' },
        { propriedade_id: 'prop_sul_1', tipo_vinculo: 'usuario_autorizado', status: 'ativo' },
      ],
    };

    assert.deepEqual(
      getPropriedadesDoColaborador(colaborador, propriedades).map((propriedade) => propriedade.id),
      ['prop_sul_2'],
    );
    assert.deepEqual(
      getUsuariosProdutoresDaPropriedade([produtor], propriedades[2], propriedades),
      [],
    );
    assert.deepEqual(
      getUsuariosProdutoresDaPropriedade([produtor], propriedades[0], propriedades)
        .map((usuario) => usuario.id),
      ['usr_produtor'],
    );
    assert.deepEqual(
      getColaboradoresRelacionadosAPropriedade([colaborador], propriedades[2], propriedades),
      [],
    );
    assert.deepEqual(
      getColaboradoresRelacionadosAPropriedade([colaborador], propriedades[1], propriedades)
        .map((usuario) => usuario.id),
      ['usr_colaborador'],
    );
  });

  await test('tela administrativa separa Produtor pendente, Titularidade e escopo direto', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/NovoUsuarioScreen.tsx'),
      'utf8',
    );

    assert.match(source, /Cadastre este Produtor como Pendente/);
    assert.match(source, /titularidade é definida no cadastro da Propriedade/);
    assert.match(source, /Selecione diretamente as Propriedades/);
    assert.match(source, /Admin possui visão global/);
    assert.doesNotMatch(source, /Função\/cargo|Nível administrativo|Região|Microrregião|cadastro rápido/i);
    assert.match(source, /vinculo\.status !== 'inativo'/);
    assert.match(source, /status: vinculo\.status === 'inativo' \? 'ativo' : 'inativo'/);
  });

  await test('detalhe administrativo permite excluir outro usuario com confirmacao segura', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/UsuarioDetailScreen.tsx'),
      'utf8',
    );

    assert.match(source, /deleteUsuarioAdminAndLocalCredential/);
    assert.match(source, /usuario\.id !== user\?\.id/);
    assert.match(source, /title="Excluir usuário"/);
    assert.match(source, /credencial local e os vínculos diretos também serão removidos/);
    assert.match(source, /navigation\.navigate\('Main', \{ screen: 'Usuarios' \}\)/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de usuarioAdminCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
