const assert = require('node:assert/strict');
const { Mapa, Visita, CadernoCampo, LimiteArea } = require('../.tmp-domain-compat/src/api/mock');

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
  await test('Mapa.get expõe leitura compatível com fazenda_id e alias de download', async () => {
    const mapa = await Mapa.get('m1');

    assert.equal(mapa.fazenda_id, 'p1');
    assert.equal(mapa.produtor_id, 'p1');
    assert.equal(mapa.disponivel_para_download, mapa.disponivel_download);
  });

  await test('Mapa.create aceita contrato canônico e mantém leitura legada compatível', async () => {
    const criado = await Mapa.create({
      titulo: 'Mapa Canônico',
      categoria: 'panorama',
      fazenda_id: 'p1',
      talhao: 'Área total',
      disponivel_para_download: false,
    });

    assert.ok(criado.id);
    assert.equal(criado.fazenda_id, 'p1');
    assert.equal(criado.produtor_id, 'p1');
    assert.equal(criado.disponivel_download, false);
    assert.equal(criado.disponivel_para_download, false);

    const porFazenda = await Mapa.filter({ fazenda_id: 'p1' });
    assert.ok(porFazenda.some((item) => item.id === criado.id));

    const porProdutorLegado = await Mapa.filter({ produtor_id: 'p1' });
    assert.ok(porProdutorLegado.some((item) => item.id === criado.id));
  });

  await test('Mapa.update aceita alias legado e ressincroniza o contrato compatível', async () => {
    const criado = await Mapa.create({
      titulo: 'Mapa Atualizável',
      categoria: 'fertilidade',
      fazenda_id: 'p2',
      talhao: 'Talhão X',
    });

    const atualizado = await Mapa.update(criado.id, {
      produtor_id: 'p3',
      disponivel_para_download: false,
    });

    assert.equal(atualizado.fazenda_id, 'p3');
    assert.equal(atualizado.produtor_id, 'p3');
    assert.equal(atualizado.disponivel_download, false);
    assert.equal(atualizado.disponivel_para_download, false);
  });

  await test('Visita.create aceita fazenda_id e retorna alias legado compatível', async () => {
    const visita = await Visita.create({
      fazenda_id: 'p1',
      tecnico_responsavel: 'Ana Santos',
      data_visita: new Date().toISOString(),
      objetivo: 'consultoria',
    });

    assert.ok(visita.id);
    assert.equal(visita.fazenda_id, 'p1');
    assert.equal(visita.produtor_id, 'p1');
    assert.deepEqual(visita.fotos, []);
    assert.equal(visita.status, 'agendada');
  });

  await test('Visita.update parcial preserva fazenda existente e valida o registro completo', async () => {
    const visita = await Visita.create({
      fazenda_id: 'p2',
      tecnico_responsavel: 'Carlos Silva',
      data_visita: new Date().toISOString(),
      objetivo: 'coleta_solo',
    });

    const atualizada = await Visita.update(visita.id, {
      status: 'realizada',
    });

    assert.equal(atualizada.fazenda_id, 'p2');
    assert.equal(atualizada.produtor_id, 'p2');
    assert.equal(atualizada.status, 'realizada');
  });

  await test('CadernoCampo.create aceita fazenda_id canônico e reexpõe produtor_id legado', async () => {
    const registro = await CadernoCampo.create({
      fazenda_id: 'p4',
      colaborador_responsavel: 'Carlos Silva',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'vistoria',
      criado_por_user_id: 'u2',
    });

    assert.ok(registro.id);
    assert.equal(registro.fazenda_id, 'p4');
    assert.equal(registro.produtor_id, 'p4');
    assert.equal(registro.criado_por, 'u2');
    assert.equal(registro.visivel_para_produtor, true);
  });

  await test('CadernoCampo.filter funciona com fazenda_id canônico e produtor_id legado', async () => {
    const registro = await CadernoCampo.create({
      fazenda_id: 'p5',
      colaborador_responsavel: 'Marcos Ferreira',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'adubacao',
    });

    const porFazenda = await CadernoCampo.filter({ fazenda_id: 'p5' });
    const porProdutor = await CadernoCampo.filter({ produtor_id: 'p5' });

    assert.ok(porFazenda.some((item) => item.id === registro.id));
    assert.ok(porProdutor.some((item) => item.id === registro.id));
  });

  await test('LimiteArea.get expõe fazenda_id em leituras de seed legado', async () => {
    const limite = await LimiteArea.get('lt1');

    assert.equal(limite.fazenda_id, 'p1');
    assert.equal(limite.produtor_id, 'p1');
  });

  await test('LimiteArea.create e getByProdutor continuam funcionando com contrato canônico', async () => {
    const limite = await LimiteArea.create({
      nome: 'LT 2026 - Talhão Z',
      ano: 2026,
      fazenda_id: 'p6',
      talhao: 'Talhão Z',
      poligono: [{ lat: -12.34, lng: -56.78 }],
    });

    assert.ok(limite.id);
    assert.equal(limite.fazenda_id, 'p6');
    assert.equal(limite.produtor_id, 'p6');

    const encontrados = await LimiteArea.getByProdutor('p6');
    assert.ok(encontrados.some((item) => item.id === limite.id));
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de mockCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
