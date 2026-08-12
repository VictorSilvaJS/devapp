const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptions,
  buildCadastroTitularOptionsFromUsers,
  buildEdicaoFazendaPayload,
  buildNovoTitularId,
  validateCadastroFazendaScope,
} = require('../.tmp-domain-compat/src/utils/fazendaCadastroCompat');
const { Produtor, User } = require('../.tmp-domain-compat/src/api/mock');
const { filtrarProdutoresPorAcesso } = require('../.tmp-domain-compat/src/utils/acessoControle');
const {
  getPropriedadesDoUsuarioProdutor,
} = require('../.tmp-domain-compat/src/utils/usuarioAdminCompat');

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
    area_total: 150,
    regiao: 'Sul',
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
    area_total: 240,
    regiao: 'Norte',
    microregiao: 'Norte 1',
  },
];

const run = async () => {
  await test('buildCadastroTitularOptions deriva titulares para escolha no cadastro', () => {
    const titulares = buildCadastroTitularOptions(fazendasBase);

    assert.deepEqual(
      titulares.map((titular) => titular.id),
      ['prop1', 'prop2']
    );
    assert.equal(titulares[0].nome, 'Ana Souza');
    assert.deepEqual(titulares[0].fazendas_ids, ['fz1']);
  });

  await test('buildCadastroTitularOptionsFromUsers lista produtores ativos, pendentes e inativos por nome', () => {
    const titulares = buildCadastroTitularOptionsFromUsers(
      [
        { id: 'u1', nome: 'Ana Usuária', perfil: 'produtor', produtor_id: 'prop1', status: 'ativo' },
        { id: 'u2', nome: 'Carlos Campo', perfil: 'colaborador' },
        { id: 'u3', nome: 'Produtor Pendente', perfil: 'produtor', produtor_id: '', status: 'pendente' },
        { id: 'u4', nome: 'Produtor Inativo', perfil: 'produtor', ativo: false, status: 'inativo' },
        { id: 'u5', nome: 'Admin Teste', perfil: 'admin', status: 'ativo' },
      ],
      fazendasBase
    );

    const ids = titulares.map((titular) => titular.id);
    assert.deepEqual(ids, ['prop1', 'u4', 'u3']);

    const antigoComProdutorId = titulares.find((titular) => titular.id === 'prop1');
    assert.equal(antigoComProdutorId.nome, 'Ana Usuária');
    assert.equal(antigoComProdutorId.usuario_id, 'u1');
    assert.equal(antigoComProdutorId.status, 'ativo');
    assert.equal(antigoComProdutorId.status_label, 'Ativo');
    assert.deepEqual(antigoComProdutorId.fazendas_nomes, ['Fazenda Sol']);

    const pendenteSemPropriedade = titulares.find((titular) => titular.id === 'u3');
    assert.equal(pendenteSemPropriedade.nome, 'Produtor Pendente');
    assert.equal(pendenteSemPropriedade.usuario_id, 'u3');
    assert.equal(pendenteSemPropriedade.status, 'pendente');
    assert.equal(pendenteSemPropriedade.status_label, 'Pendente');
    assert.deepEqual(pendenteSemPropriedade.fazendas_nomes, []);

    const inativoSemPropriedade = titulares.find((titular) => titular.id === 'u4');
    assert.equal(inativoSemPropriedade.nome, 'Produtor Inativo');
    assert.equal(inativoSemPropriedade.usuario_id, 'u4');
    assert.equal(inativoSemPropriedade.status, 'inativo');
    assert.equal(inativoSemPropriedade.status_label, 'Inativo');
  });

  await test('buildCadastroTitularOptionsFromUsers nao duplica produtor com produtor_id legado', () => {
    const titulares = buildCadastroTitularOptionsFromUsers(
      [
        { id: 'u1', nome: 'Ana Usuária', perfil: 'produtor', produtor_id: 'prop1', status: 'ativo' },
        { id: 'u1b', nome: 'Ana Duplicada', perfil: 'produtor', produtor_id: 'prop1', status: 'pendente' },
        { id: 'u_sem_prop', nome: 'Produtor Sem Propriedade', perfil: 'produtor', status: 'pendente' },
      ],
      fazendasBase
    );

    assert.equal(titulares.filter((titular) => titular.id === 'prop1').length, 1);
    assert.equal(titulares.filter((titular) => titular.id === 'u_sem_prop').length, 1);
  });

  await test('buildCadastroFazendaPayload vincula propriedade a produtor novo usando id do usuario', () => {
    const titulares = buildCadastroTitularOptionsFromUsers(
      [
        { id: 'u_pendente', nome: 'Produtor Pendente', perfil: 'produtor', status: 'pendente' },
      ],
      fazendasBase
    );
    const payload = buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: 'u_pendente',
      fazendaNome: 'Propriedade Produtor Pendente',
      areaTotal: 100,
      municipioId: '5107925',
      municipioNome: 'Sorriso',
      ufId: '51',
      ufSigla: 'MT',
      status: 'inativo',
      titulares,
    });

    assert.equal(payload.titular_id, 'u_pendente');
    assert.equal(payload.produtor_id, 'u_pendente');
    assert.equal(payload.proprietario_id, 'u_pendente');
    assert.equal(payload.nome, 'Produtor Pendente');
    assert.equal(payload.status, 'inativo');
  });

  await test('buildCadastroFazendaPayload vincula nova fazenda a titular existente', () => {
    const titulares = buildCadastroTitularOptions(fazendasBase);
    const payload = buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: 'prop1',
      fazendaNome: 'Fazenda Nova',
      areaTotal: '315,5',
      culturaAtual: 'Soja',
      municipioId: '5107925',
      municipioNome: 'Sorriso',
      ufId: '51',
      ufSigla: 'mt',
      status: 'ativo',
      titulares,
    });

    assert.equal(payload.propriedade_nome, 'Fazenda Nova');
    assert.equal(payload.titular_id, 'prop1');
    assert.equal(payload.produtor_id, 'prop1');
    assert.equal(payload.proprietario_id, 'prop1');
    assert.equal(payload.nome, 'Ana Souza');
    assert.equal(payload.produtor_nome, 'Ana Souza');
    assert.equal(payload.fazenda, 'Fazenda Nova');
    assert.equal(payload.fazenda_nome, 'Fazenda Nova');
    assert.equal(payload.area_total, 315.5);
    assert.equal(payload.municipio_id, '5107925');
    assert.equal(payload.municipio_nome, 'Sorriso');
    assert.equal(payload.uf_id, '51');
    assert.equal(payload.uf_sigla, 'MT');
    assert.equal(payload.cultura_principal, 'Soja');
    assert.equal(payload.regiao, undefined);
    assert.equal(payload.microregiao, undefined);
    assert.equal(payload.status, 'ativo');
  });

  await test('buildCadastroFazendaPayload cria titular minimo quando nao ha titular existente', () => {
    const titulares = buildCadastroTitularOptions(fazendasBase);
    const payload = buildCadastroFazendaPayload({
      mode: 'novo',
      produtorNome: 'Carla Mendes',
      fazendaNome: 'Fazenda Campo Alto',
      areaTotal: 90,
      municipioId: '5107909',
      municipioNome: 'Sinop',
      ufId: '51',
      ufSigla: 'MT',
      titulares,
    });

    assert.equal(payload.produtor_id, 'prop_carla_mendes');
    assert.equal(payload.proprietario_id, 'prop_carla_mendes');
    assert.equal(payload.nome, 'Carla Mendes');
    assert.equal(payload.produtor_nome, 'Carla Mendes');
    assert.equal(payload.fazenda, 'Fazenda Campo Alto');
    assert.equal(payload.fazenda_nome, 'Fazenda Campo Alto');
  });

  await test('buildNovoTitularId evita colisao com titulares existentes', () => {
    assert.equal(buildNovoTitularId('Ana Souza', ['prop_ana_souza']), 'prop_ana_souza_2');
  });

  await test('buildEdicaoFazendaPayload preserva titular e elimina campos cadastrais legados', () => {
    const payload = buildEdicaoFazendaPayload({
      propriedadeAtual: {
        propriedade_nome: 'Propriedade Antiga',
        titular_id: 'prod_titular_1',
        municipio_id: '5107925',
        municipio_nome: 'Sorriso',
        uf_id: '51',
        uf_sigla: 'MT',
        regiao: 'Norte',
        microregiao: 'Legado',
        documento: '123',
        colaborador_responsavel_id: 'usr_legado',
      },
      propriedadeNome: 'Propriedade Atualizada',
      areaTotal: '321,5',
      culturaPrincipal: 'Milho',
      municipioId: '5107909',
      municipioNome: 'Sinop',
      ufId: '51',
      ufSigla: 'mt',
      status: 'inativo',
    });

    assert.equal(payload.propriedade_nome, 'Propriedade Atualizada');
    assert.equal(payload.titular_id, 'prod_titular_1');
    assert.equal(payload.municipio_id, '5107909');
    assert.equal(payload.municipio_nome, 'Sinop');
    assert.equal(payload.uf_sigla, 'MT');
    assert.equal(payload.area_total, 321.5);
    assert.equal(payload.cultura_principal, 'Milho');
    assert.equal(payload.status, 'inativo');
    assert.equal(payload.regiao, undefined);
    assert.equal(payload.microregiao, undefined);
    assert.equal(payload.documento, undefined);
    assert.equal(payload.colaborador_responsavel_id, undefined);
  });

  await test('validateCadastroFazendaScope bloqueia colaborador independentemente da localização', () => {
    const result = validateCadastroFazendaScope(
      { perfil: 'colaborador' }
    );

    assert.deepEqual(result, { ok: false, reason: 'perfil_sem_permissao' });
  });

  await test('validateCadastroFazendaScope permite somente Admin', () => {
    const result = validateCadastroFazendaScope({ perfil: 'admin' });

    assert.equal(result.ok, true);
  });

  await test('Propriedade criada pelo admin exige vinculo direto para o colaborador', async () => {
    const admin = { perfil: 'admin' };
    const titulares = buildCadastroTitularOptionsFromUsers(await User.list(), await Produtor.list());
    const titularProp1 = titulares.find((titular) => titular.id === 'prop1');
    assert.ok(titularProp1);
    const payload = buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: 'prop1',
      fazendaNome: 'Fazenda Teste Cadastro',
      areaTotal: '210',
      culturaAtual: 'Soja',
      municipioId: '5107925',
      municipioNome: 'Sorriso',
      ufId: '51',
      ufSigla: 'MT',
      titulares,
    });

    const scope = validateCadastroFazendaScope(admin, payload);
    assert.equal(scope.ok, true);

    const colaboradorSelecionado = (await User.list()).find((usuario) => usuario.perfil === 'colaborador');
    assert.ok(colaboradorSelecionado);
    const produtorAutorizado = (await User.list()).find((usuario) => (
      usuario.perfil === 'produtor'
      && usuario.id !== titularProp1.usuario_id
      && usuario.produtor_id !== titularProp1.id
      && usuario.status !== 'inativo'
      && usuario.ativo !== false
    ));
    assert.ok(produtorAutorizado);
    const criado = await Produtor.createWithLinks(payload, {
      titularUsuarioId: titularProp1.usuario_id,
      produtorAutorizadoIds: [produtorAutorizado.id],
      colaboradorIds: [colaboradorSelecionado.id],
    });
    assert.equal(criado.produtor_id, 'prop1');
    assert.equal(criado.proprietario_id, 'prop1');
    assert.equal(criado.produtor_nome, titularProp1.nome);
    assert.equal(criado.fazenda_nome, 'Fazenda Teste Cadastro');
    assert.equal(criado.municipio_id, '5107925');
    assert.equal(criado.municipio_nome, 'Sorriso');
    assert.equal(criado.uf_sigla, 'MT');

    const listaAtualizada = await Produtor.list();
    const colaboradorAtualizado = await User.get(colaboradorSelecionado.id);
    const titularAtualizado = await User.get(titularProp1.usuario_id);
    const produtorAutorizadoAtualizado = await User.get(produtorAutorizado.id);
    const visiveis = filtrarProdutoresPorAcesso(listaAtualizada, colaboradorAtualizado);
    assert.ok(visiveis.some((fazenda) => fazenda.id === criado.id));
    assert.ok(titularAtualizado.vinculos_propriedades.some((vinculo) => (
      vinculo.propriedade_id === criado.id && vinculo.tipo_vinculo === 'titular'
    )));
    assert.ok(colaboradorAtualizado.vinculos_propriedades.some((vinculo) => (
      vinculo.propriedade_id === criado.id && vinculo.tipo_vinculo === 'colaborador'
    )));
    assert.ok(produtorAutorizadoAtualizado.vinculos_propriedades.some((vinculo) => (
      vinculo.propriedade_id === criado.id
      && vinculo.tipo_vinculo === 'usuario_autorizado'
      && vinculo.status === 'ativo'
    )));
    assert.equal(
      filtrarProdutoresPorAcesso(listaAtualizada, produtorAutorizadoAtualizado)
        .some((fazenda) => fazenda.id === criado.id),
      true,
    );

    await Produtor.updateWithLinks(criado.id, criado, {
      produtorAutorizadoIds: [],
      colaboradorIds: [colaboradorSelecionado.id],
    });
    const produtorDesvinculado = await User.get(produtorAutorizado.id);
    const vinculoInativado = produtorDesvinculado.vinculos_propriedades.find((vinculo) => (
      vinculo.propriedade_id === criado.id && vinculo.tipo_vinculo === 'usuario_autorizado'
    ));
    assert.equal(vinculoInativado.status, 'inativo');
    assert.equal(
      filtrarProdutoresPorAcesso(await Produtor.list(), produtorDesvinculado)
        .some((fazenda) => fazenda.id === criado.id),
      false,
    );
    assert.equal(
      getPropriedadesDoUsuarioProdutor(produtorDesvinculado, await Produtor.list())
        .some((fazenda) => fazenda.id === criado.id),
      false,
    );

    await Produtor.updateWithLinks(criado.id, criado, {
      produtorAutorizadoIds: [produtorAutorizado.id],
      colaboradorIds: [colaboradorSelecionado.id],
    });
    const produtorRevinculado = await User.get(produtorAutorizado.id);
    const vinculosAutorizados = produtorRevinculado.vinculos_propriedades.filter((vinculo) => (
      vinculo.propriedade_id === criado.id && vinculo.tipo_vinculo === 'usuario_autorizado'
    ));
    assert.equal(vinculosAutorizados.length, 1);
    assert.equal(vinculosAutorizados[0].status, 'ativo');
    assert.equal((await Produtor.get(criado.id)).titular_id, titularProp1.id);

    await assert.rejects(
      () => Produtor.updateWithLinks(criado.id, criado, {
        produtorAutorizadoIds: [titularProp1.usuario_id],
        colaboradorIds: [colaboradorSelecionado.id],
      }),
      /Titular não pode ser adicionado como Usuário autorizado/,
    );
    const produtorAposFalha = await User.get(produtorAutorizado.id);
    assert.equal(
      produtorAposFalha.vinculos_propriedades.find((vinculo) => (
        vinculo.propriedade_id === criado.id && vinculo.tipo_vinculo === 'usuario_autorizado'
      )).status,
      'ativo',
    );

    const outroColaborador = (await User.list()).find((usuario) => (
      usuario.perfil === 'colaborador' && usuario.id !== colaboradorSelecionado.id
    ));
    assert.ok(outroColaborador);
    assert.equal(
      filtrarProdutoresPorAcesso(listaAtualizada, outroColaborador).some((fazenda) => fazenda.id === criado.id),
      false,
    );
  });

  await test('createWithLinks desfaz a Propriedade quando um vínculo é inválido', async () => {
    const antes = await Produtor.list();
    const titulares = buildCadastroTitularOptionsFromUsers(await User.list(), antes);
    const titular = titulares.find((item) => item.status === 'ativo' && item.usuario_id);
    assert.ok(titular);

    await assert.rejects(
      () => Produtor.createWithLinks(buildCadastroFazendaPayload({
        mode: 'existente',
        titularId: titular.id,
        fazendaNome: 'Propriedade que deve ser desfeita',
        municipioId: '5107925',
        municipioNome: 'Sorriso',
        ufId: '51',
        ufSigla: 'MT',
        titulares,
      }), {
        titularUsuarioId: titular.usuario_id,
        colaboradorIds: ['colaborador_inexistente'],
      }),
      /Colaborador ativo inexistente/,
    );

    const depois = await Produtor.list();
    assert.equal(depois.some((item) => item.fazenda_nome === 'Propriedade que deve ser desfeita'), false);
  });

  await test('User.create salva produtor pendente/inativo com produtor_id estavel', async () => {
    const pendente = await User.create({
      nome: 'Produtor Pendente Compat',
      email: `produtor.pendente.compat.${Date.now()}@example.com`,
      perfil: 'produtor',
      status: 'pendente',
      senha: 'mock123',
    });
    const inativo = await User.create({
      nome: 'Produtor Inativo Compat',
      email: `produtor.inativo.compat.${Date.now()}@example.com`,
      perfil: 'produtor',
      status: 'inativo',
      senha: 'mock123',
    });

    assert.equal(pendente.produtor_id, pendente.id);
    assert.equal(pendente.status, 'pendente');
    assert.equal(inativo.produtor_id, inativo.id);
    assert.equal(inativo.status, 'inativo');
  });

  await test('tela de cadastro usa Município/UF e vínculos diretos sem Região/Microrregião', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/NovaPropriedadeScreen.tsx'),
      'utf8',
    );
    assert.match(source, /Produtor\.createWithLinks/);
    assert.match(source, /municipioId/);
    assert.match(source, /colaboradorIds/);
    assert.match(source, /produtorAutorizadoIds/);
    assert.match(source, /Produtores autorizados/);
    assert.match(source, /Somente Administradores/);
    assert.doesNotMatch(source, /Região|Microrregião|territorioCompat/);
  });

  await test('tela de edição usa contrato v2, preserva Titular e salva vínculos em conjunto', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/EditarPropriedadeScreen.tsx'),
      'utf8',
    );
    assert.match(source, /Produtor\.updateWithLinks/);
    assert.match(source, /buildEdicaoFazendaPayload/);
    assert.match(source, /podeEditarCadastroPropriedade/);
    assert.match(source, /A troca de Titular exige um fluxo transacional e auditado próprio/);
    assert.match(source, /municipioId/);
    assert.match(source, /colaboradorIds/);
    assert.match(source, /produtorAutorizadoIds/);
    assert.match(source, /Desmarcar um usuário inativará o vínculo/);
    assert.doesNotMatch(source, /buildFazendaUpdatePayload|Região|Microrregião|documento|pendente/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de fazendaCadastroCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
