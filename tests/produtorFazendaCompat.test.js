const assert = require('node:assert/strict');
const { Produtor } = require('../.tmp-domain-compat/src/api/mock');
const { listMockProdutoresTitulares } = require('../.tmp-domain-compat/src/api/produtorCompat');

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
  await test('Produtor.get mantém compatibilidade legada e adiciona semântica explícita de fazenda', async () => {
    const registro = await Produtor.get('p1');

    assert.equal(registro.id, 'p1');
    assert.equal(registro.fazenda_id, 'p1');
    assert.equal(registro.proprietario_id, 'prop1');
    assert.equal(registro.produtor_id, 'prop1');
    assert.equal(registro.nome, 'João Silva');
    assert.equal(registro.produtor_nome, 'João Silva');
    assert.equal(registro.fazenda, 'Fazenda Boa Vista');
    assert.equal(registro.fazenda_nome, 'Fazenda Boa Vista');
  });

  await test('Produtor.list continua entregando shape compatível para a UI atual', async () => {
    const registros = await Produtor.list();
    const primeiro = registros[0];

    assert.ok(Array.isArray(registros));
    assert.ok(primeiro.id);
    assert.ok(primeiro.nome);
    assert.ok(primeiro.fazenda);
    assert.ok(primeiro.fazenda_id);
    assert.ok(primeiro.fazenda_nome);
  });

  await test('Produtor.create aceita payload legado atual', async () => {
    const criado = await Produtor.create({
      nome: 'Mariana Costa',
      fazenda: 'Fazenda Bela Vista',
      area_total: 180,
      proprietario_id: 'prop_mariana',
    });

    assert.ok(criado.id);
    assert.equal(criado.nome, 'Mariana Costa');
    assert.equal(criado.produtor_nome, 'Mariana Costa');
    assert.equal(criado.fazenda, 'Fazenda Bela Vista');
    assert.equal(criado.fazenda_nome, 'Fazenda Bela Vista');
    assert.equal(criado.proprietario_id, 'prop_mariana');
    assert.equal(criado.produtor_id, 'prop_mariana');
  });

  await test('Produtor.create aceita payload explícito/canônico de fazenda', async () => {
    const criado = await Produtor.create({
      nome: 'Fazenda Horizonte Azul',
      produtor_nome: 'Joana Martins',
      produtor_id: 'prop_joana',
      area_total: 340,
      cidade: 'Rio Verde',
    });

    assert.ok(criado.id);
    assert.equal(criado.fazenda_id, criado.id);
    assert.equal(criado.fazenda, 'Fazenda Horizonte Azul');
    assert.equal(criado.fazenda_nome, 'Fazenda Horizonte Azul');
    assert.equal(criado.nome, 'Joana Martins');
    assert.equal(criado.produtor_nome, 'Joana Martins');
    assert.equal(criado.produtor_id, 'prop_joana');
    assert.equal(criado.proprietario_id, 'prop_joana');
  });

  await test('Produtor.update reconcilia payload explícito e preserva compatibilidade legada', async () => {
    const base = await Produtor.create({
      nome: 'Carlos Antigo',
      fazenda: 'Fazenda Antiga',
      area_total: 90,
      proprietario_id: 'prop_antigo',
    });

    const atualizado = await Produtor.update(base.id, {
      nome: 'Fazenda Nova Aurora',
      produtor_nome: 'Carlos Novo',
      produtor_id: 'prop_novo',
    });

    assert.equal(atualizado.fazenda_id, base.id);
    assert.equal(atualizado.fazenda, 'Fazenda Nova Aurora');
    assert.equal(atualizado.fazenda_nome, 'Fazenda Nova Aurora');
    assert.equal(atualizado.nome, 'Carlos Novo');
    assert.equal(atualizado.produtor_nome, 'Carlos Novo');
    assert.equal(atualizado.produtor_id, 'prop_novo');
    assert.equal(atualizado.proprietario_id, 'prop_novo');
  });

  await test('Produtor.filter aceita nomes legados e campos explícitos', async () => {
    const criado = await Produtor.create({
      nome: 'Fernanda Luz',
      fazenda: 'Fazenda Campo Claro',
      area_total: 120,
      proprietario_id: 'prop_fernanda',
    });

    const porNomeLegado = await Produtor.filter({ nome: 'Fernanda' });
    const porFazendaLegada = await Produtor.filter({ fazenda: 'Campo Claro' });
    const porFazendaExplicita = await Produtor.filter({ fazenda_nome: 'Campo Claro' });
    const porProdutorId = await Produtor.filter({ produtor_id: 'prop_fernanda' });
    const porFazendaId = await Produtor.filter({ fazenda_id: criado.id });

    assert.ok(porNomeLegado.some((item) => item.id === criado.id));
    assert.ok(porFazendaLegada.some((item) => item.id === criado.id));
    assert.ok(porFazendaExplicita.some((item) => item.id === criado.id));
    assert.ok(porProdutorId.some((item) => item.id === criado.id));
    assert.ok(porFazendaId.some((item) => item.id === criado.id));
  });

  await test('Compat helper consegue derivar produtores titulares distintos a partir das fazendas', async () => {
    const registros = await Produtor.list();
    const titulares = listMockProdutoresTitulares(registros);
    const prop1 = titulares.find((item) => item.id === 'prop1');

    assert.ok(Array.isArray(titulares));
    assert.ok(prop1);
    assert.ok(prop1.fazendas_ids.includes('p1'));
    assert.ok(prop1.fazendas_ids.includes('p1b'));
    assert.ok(prop1.fazendas_nomes.includes('Fazenda Boa Vista'));
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de produtorFazendaCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
