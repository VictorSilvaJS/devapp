const assert = require('node:assert/strict');
const {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptions,
  buildCadastroTitularOptionsFromUsers,
  buildNovoTitularId,
  validateCadastroFazendaScope,
} = require('../.tmp-domain-compat/src/utils/fazendaCadastroCompat');
const { Produtor } = require('../.tmp-domain-compat/src/api/mock');
const { filtrarProdutoresPorAcesso } = require('../.tmp-domain-compat/src/utils/acessoControle');

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

  await test('buildCadastroTitularOptionsFromUsers lista somente usuarios produtores por nome', () => {
    const titulares = buildCadastroTitularOptionsFromUsers(
      [
        { id: 'u1', nome: 'Ana Usuária', perfil: 'produtor', produtor_id: 'prop1' },
        { id: 'u2', nome: 'Carlos Campo', perfil: 'colaborador' },
        { id: 'u3', nome: 'Produtor Pendente', perfil: 'produtor', produtor_id: '' },
      ],
      fazendasBase
    );

    assert.deepEqual(titulares.map((titular) => titular.id), ['prop1']);
    assert.equal(titulares[0].nome, 'Ana Usuária');
    assert.equal(titulares[0].usuario_id, 'u1');
    assert.deepEqual(titulares[0].fazendas_nomes, ['Fazenda Sol']);
  });

  await test('buildCadastroFazendaPayload vincula nova fazenda a titular existente', () => {
    const titulares = buildCadastroTitularOptions(fazendasBase);
    const payload = buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: 'prop1',
      fazendaNome: 'Fazenda Nova',
      areaTotal: '315,5',
      culturaAtual: 'Soja',
      cidade: 'Cruz Alta',
      estado: 'rs',
      regiao: 'Sul',
      microregiao: 'Sul 1',
      documento: 'IE-123',
      colaboradorResponsavelId: 'u_colab',
      colaboradorResponsavelNome: 'Carlos Campo',
      status: 'pendente',
      titulares,
    });

    assert.equal(payload.produtor_id, 'prop1');
    assert.equal(payload.proprietario_id, 'prop1');
    assert.equal(payload.nome, 'Ana Souza');
    assert.equal(payload.produtor_nome, 'Ana Souza');
    assert.equal(payload.fazenda, 'Fazenda Nova');
    assert.equal(payload.fazenda_nome, 'Fazenda Nova');
    assert.equal(payload.area_total, 315.5);
    assert.equal(payload.estado, 'RS');
    assert.equal(payload.regiao, 'Sul');
    assert.equal(payload.microregiao, 'Sul 1');
    assert.equal(payload.documento, 'IE-123');
    assert.equal(payload.colaborador_responsavel_id, 'u_colab');
    assert.equal(payload.colaborador_responsavel, 'Carlos Campo');
    assert.equal(payload.status, 'pendente');
  });

  await test('buildCadastroFazendaPayload cria titular minimo quando nao ha titular existente', () => {
    const titulares = buildCadastroTitularOptions(fazendasBase);
    const payload = buildCadastroFazendaPayload({
      mode: 'novo',
      produtorNome: 'Carla Mendes',
      fazendaNome: 'Fazenda Campo Alto',
      areaTotal: 90,
      regiao: 'Sul',
      microregiao: 'Sul 1',
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

  await test('validateCadastroFazendaScope permite colaborador dentro da regiao e microregiao', () => {
    const result = validateCadastroFazendaScope(
      { perfil: 'colaborador', regiao: 'Sul', sub_regioes: ['Sul 1'] },
      { regiao: 'Sul', microregiao: 'Sul 1' }
    );

    assert.equal(result.ok, true);
  });

  await test('validateCadastroFazendaScope bloqueia colaborador fora do proprio escopo', () => {
    const foraRegiao = validateCadastroFazendaScope(
      { perfil: 'colaborador', regiao: 'Sul', sub_regioes: ['Sul 1'] },
      { regiao: 'Norte', microregiao: 'Norte 1' }
    );
    const foraMicroregiao = validateCadastroFazendaScope(
      { perfil: 'colaborador', regiao: 'Sul', sub_regioes: ['Sul 1'] },
      { regiao: 'Sul', microregiao: 'Sul 2' }
    );

    assert.deepEqual(foraRegiao, { ok: false, reason: 'regiao_fora_escopo' });
    assert.deepEqual(foraMicroregiao, { ok: false, reason: 'microregiao_fora_escopo' });
  });

  await test('validateCadastroFazendaScope permite admin sem restricao regional', () => {
    const result = validateCadastroFazendaScope(
      { perfil: 'admin' },
      { regiao: 'Norte', microregiao: 'Norte 1' }
    );

    assert.equal(result.ok, true);
  });

  await test('payload do cadastro cria fazenda visivel no escopo do colaborador', async () => {
    const user = { perfil: 'colaborador', regiao: 'Sul', sub_regioes: ['RS - Norte'] };
    const titulares = buildCadastroTitularOptions(await Produtor.list());
    const titularProp1 = titulares.find((titular) => titular.id === 'prop1');
    assert.ok(titularProp1);
    const payload = buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: 'prop1',
      fazendaNome: 'Fazenda Teste Cadastro',
      areaTotal: '210',
      culturaAtual: 'Soja',
      cidade: 'Cruz Alta',
      estado: 'RS',
      regiao: 'Sul',
      microregiao: 'RS - Norte',
      titulares,
    });

    const scope = validateCadastroFazendaScope(user, payload);
    assert.equal(scope.ok, true);

    const criado = await Produtor.create(payload);
    assert.equal(criado.produtor_id, 'prop1');
    assert.equal(criado.proprietario_id, 'prop1');
    assert.equal(criado.produtor_nome, titularProp1.nome);
    assert.equal(criado.fazenda_nome, 'Fazenda Teste Cadastro');
    assert.equal(criado.regiao, 'Sul');
    assert.equal(criado.microregiao, 'RS - Norte');

    const listaAtualizada = await Produtor.list();
    const visiveis = filtrarProdutoresPorAcesso(listaAtualizada, user);
    assert.ok(visiveis.some((fazenda) => fazenda.id === criado.id));
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
