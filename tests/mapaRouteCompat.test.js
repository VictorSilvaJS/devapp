const assert = require('node:assert/strict');
const {
  buildFazendaMapaRouteParams,
  buildMapaTalhaoRouteSelection,
  buildMapasRouteParams,
  resolveRouteFazendaId,
  resolveRouteTitularNome,
  resolveTalhaoSelecionadoFromRoute,
} = require('../.tmp-domain-compat/src/navigation/mapaRouteCompat');

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
  await test('resolveRouteFazendaId prioriza fazendaId canônico', () => {
    const fazendaId = resolveRouteFazendaId({
      fazendaId: 'faz_001',
      produtorId: 'legado_ignorado',
    });

    assert.equal(fazendaId, 'faz_001');
  });

  await test('resolveRouteFazendaId aceita alias legado produtorId', () => {
    const fazendaId = resolveRouteFazendaId({
      produtorId: 'faz_legado',
    });

    assert.equal(fazendaId, 'faz_legado');
  });

  await test('buildMapasRouteParams gera params compatíveis com alias legado controlado', () => {
    const params = buildMapasRouteParams({
      fazendaId: 'faz_mapas',
    });

    assert.deepEqual(params, {
      fazendaId: 'faz_mapas',
      produtorId: 'faz_mapas',
    });
  });

  await test('buildFazendaMapaRouteParams preserva nomes e talhao junto com compatibilidade de id', () => {
    const params = buildFazendaMapaRouteParams({
      produtorId: 'faz_sat',
      fazendaNome: 'Fazenda Satélite',
      titularNome: 'João Silva',
      talhaoId: 'talhao_7',
      talhaoNome: 'Talhão 7',
      talhao: 'Talhão 7',
      talhaoAno: '2025',
    });

    assert.deepEqual(params, {
      fazendaId: 'faz_sat',
      produtorId: 'faz_sat',
      fazendaNome: 'Fazenda Satélite',
      titularNome: 'João Silva',
      produtorNome: 'João Silva',
      talhaoId: 'talhao_7',
      talhaoNome: 'Talhão 7',
      talhao: 'Talhão 7',
      talhaoAno: '2025',
    });
  });

  await test('buildMapaTalhaoRouteSelection resolve id canônico do limite por talhão e safra', () => {
    const params = buildMapaTalhaoRouteSelection(
      {
        id: 'mapa_1',
        fazenda_id: 'faz_1',
        talhao: 'Talhão A',
        safra: '2024/2025',
      },
      [
        { id: 'limite_2024', fazenda_id: 'faz_1', talhao: 'Talhão A', ano: 2024 },
        { id: 'limite_2025', fazenda_id: 'faz_1', talhao: 'Talhão A', ano: 2025 },
        { id: 'limite_outra_fazenda', fazenda_id: 'faz_2', talhao: 'Talhão A', ano: 2025 },
      ]
    );

    assert.deepEqual(params, {
      talhaoId: 'limite_2025',
      talhaoNome: 'Talhão A',
      talhao: 'Talhão A',
      talhaoAno: '2025',
    });
  });

  await test('resolveTalhaoSelecionadoFromRoute usa id canônico quando disponível', () => {
    const selecao = resolveTalhaoSelecionadoFromRoute(
      [
        { id: 'limite_2024', talhao: 'Talhão A', ano: 2024 },
        { id: 'limite_2025', talhao: 'Talhão A', ano: 2025 },
      ],
      { talhaoId: 'limite_2024', talhaoNome: 'Talhão A', talhaoAno: '2025' }
    );

    assert.deepEqual(selecao, {
      talhaoId: 'limite_2024',
      talhaoAno: 2024,
      matchType: 'id',
    });
  });

  await test('resolveTalhaoSelecionadoFromRoute aceita talhaoId legado como nome controlado', () => {
    const selecao = resolveTalhaoSelecionadoFromRoute(
      [
        { id: 'limite_2024', talhao: 'Talhão A', ano: 2024 },
        { id: 'limite_2025', talhao: 'Talhão A', ano: 2025 },
      ],
      { talhaoId: 'Talhão A', talhaoAno: '2024' }
    );

    assert.deepEqual(selecao, {
      talhaoId: 'limite_2024',
      talhaoAno: 2024,
      matchType: 'legado',
    });
  });

  await test('resolveRouteTitularNome prioriza titularNome canônico e aceita alias legado', () => {
    assert.equal(
      resolveRouteTitularNome({
        titularNome: 'Maria Souza',
        produtorNome: 'Legado Ignorado',
      }),
      'Maria Souza'
    );

    assert.equal(
      resolveRouteTitularNome({
        produtorNome: 'João Silva',
      }),
      'João Silva'
    );
  });

  await test('buildFazendaMapaRouteParams retorna undefined quando não há contexto nem metadados úteis', () => {
    const params = buildFazendaMapaRouteParams({
      fazendaId: '   ',
      produtorId: '',
      fazendaNome: '   ',
    });

    assert.equal(params, undefined);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de mapaRouteCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
