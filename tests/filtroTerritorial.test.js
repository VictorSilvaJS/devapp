const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  filtrarPropriedadesPorLocalizacao,
  getMunicipioIdPropriedade,
  listarMunicipios,
  listarPropriedadesParaFiltro,
  listarUfs,
} = require('../.tmp-domain-compat/src/utils/filtroTerritorial');

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
    id: 'prop_mt_1', nome: 'Fazenda Um', titular_nome: 'Titular Um',
    municipio_id: '5106240', municipio_nome: 'Nova Ubiratã', uf_sigla: 'MT',
  },
  {
    id: 'prop_mt_2', nome: 'Fazenda Dois', titular_nome: 'Titular Dois',
    municipio_id: '5107909', municipio_nome: 'Sinop', uf_sigla: 'MT',
  },
  {
    id: 'prop_go_1', nome: 'Fazenda Três', titular_nome: 'Titular Três',
    cidade: 'Jataí', estado: 'GO',
  },
];

const run = async () => {
  await test('lista UF e Município pelos campos canônicos com fallback de leitura', () => {
    assert.deepEqual(listarUfs(propriedades), ['GO', 'MT']);
    assert.deepEqual(
      listarMunicipios(propriedades, 'MT').map(({ id, nome, uf }) => ({ id, nome, uf })),
      [
        { id: '5106240', nome: 'Nova Ubiratã', uf: 'MT' },
        { id: '5107909', nome: 'Sinop', uf: 'MT' },
      ],
    );
    assert.equal(getMunicipioIdPropriedade(propriedades[2]), 'local:go:jatai');
  });

  await test('cascata UF e Município limita as opções de Propriedade', () => {
    const opcoes = listarPropriedadesParaFiltro(propriedades, 'MT', '5107909');
    assert.deepEqual(opcoes.map((item) => item.id), ['prop_mt_2']);
  });

  await test('filtro territorial apenas reduz um conjunto previamente autorizado', () => {
    const propriedadesAutorizadasDoColaborador = [propriedades[0]];
    const resultado = filtrarPropriedadesPorLocalizacao(propriedadesAutorizadasDoColaborador, {
      uf: 'MT', municipio: '5107909',
    });

    assert.deepEqual(resultado, []);
    assert.equal(resultado.some((item) => item.id === 'prop_mt_2'), false);
  });

  await test('Dashboard e Propriedades não exibem filtros de Região ou Microrregião', () => {
    const arquivos = [
      'src/components/FiltroTerritorial.tsx',
      'src/screens/DashboardScreen.tsx',
      'src/screens/PropriedadesScreen.tsx',
    ];
    const source = arquivos
      .map((arquivo) => fs.readFileSync(path.join(process.cwd(), arquivo), 'utf8'))
      .join('\n');

    assert.match(source, /Todas as UFs/);
    assert.match(source, /Todos os municípios/);
    assert.match(source, /Todas as propriedades/);
    assert.doesNotMatch(source, /Região|Regiões|Microrregião|Microrregiões/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de filtroTerritorial passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
