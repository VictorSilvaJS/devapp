const assert = require('node:assert/strict');
const {
  filtrarCadernosPorAcesso,
  filtrarMapasPorAcesso,
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorAcesso,
  getFazendaIdsPorAcesso,
  podeBaixarMapa,
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
  regiao: 'Sul',
  sub_regioes: ['Sul 1'],
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

  await test('filtrarMapasPorAcesso usa fazenda_id explicitamente e respeita download para produtor', () => {
    const mapas = [
      { id: 'm1', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: true },
      { id: 'm2', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: false },
      { id: 'm3', fazenda_id: 'fz2', produtor_id: 'fz2', disponivel_download: true },
    ];

    const resultado = filtrarMapasPorAcesso(mapas, produtorUser, fazendasBase);

    assert.deepEqual(resultado.map((mapa) => mapa.id), ['m1']);
  });

  await test('filtrarVisitasPorAcesso usa fazenda_id canônico para colaborador', () => {
    const visitas = [
      { id: 'v1', fazenda_id: 'fz1', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' },
      { id: 'v2', fazenda_id: 'fz2', tecnico_responsavel: 'Ana', data_visita: '2026-04-16', objetivo: 'consultoria' },
    ];

    const resultado = filtrarVisitasPorAcesso(visitas, colaboradorUser, fazendasBase);

    assert.deepEqual(resultado.map((visita) => visita.id), ['v1']);
  });

  await test('filtrarCadernosPorAcesso mantém compatibilidade legada e restringe visibilidade do produtor', () => {
    const registros = [
      { id: 'c1', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
      { id: 'c2', produtor_id: 'fz1', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: false },
      { id: 'c3', produtor_id: 'fz2', colaborador_responsavel: 'Ana', data_atividade: '2026-04-16', tipo_atividade: 'vistoria', visivel_para_produtor: true },
    ];

    const resultado = filtrarCadernosPorAcesso(registros, produtorUser, fazendasBase);

    assert.deepEqual(resultado.map((registro) => registro.id), ['c1']);
  });

  await test('podeBaixarMapa usa a fazenda do mapa quando a lista de fazendas está disponível', () => {
    const mapaProprio = { id: 'm1', fazenda_id: 'fz1', produtor_id: 'fz1', disponivel_download: true };
    const mapaDeOutro = { id: 'm2', fazenda_id: 'fz2', produtor_id: 'fz2', disponivel_download: true };

    assert.equal(podeBaixarMapa(produtorUser, mapaProprio, fazendasBase), true);
    assert.equal(podeBaixarMapa(produtorUser, mapaDeOutro, fazendasBase), false);
    assert.equal(podeBaixarMapa(adminUser, { ...mapaDeOutro, disponivel_download: false }, fazendasBase), true);
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
