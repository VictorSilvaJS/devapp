const assert = require('node:assert/strict');
const {
  buildDashboardScopeData,
  buildDashboardLocationSummary,
  buildDashboardSummary,
  formatDashboardArea,
  getPropriedadesPorStatus,
  getPropriedadeStatusLabel,
} = require('../.tmp-domain-compat/src/utils/dashboardCompat');

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
    id: 'p_sul',
    propriedade_id: 'p_sul',
    proprietario_id: 'titular_sul',
    titular_id: 'titular_sul',
    area_total: 750,
    municipio_id: '4310207',
    municipio_nome: 'Ijuí',
    uf_id: '43',
    uf_sigla: 'RS',
    status: 'ativo',
  },
  {
    id: 'p_mt',
    propriedade_id: 'p_mt',
    proprietario_id: 'titular_mt',
    titular_id: 'titular_mt',
    area_total: 1500,
    municipio_id: '5107925',
    municipio_nome: 'Sorriso',
    uf_id: '51',
    uf_sigla: 'MT',
    status: 'pendente',
  },
  {
    id: 'p_mt_2',
    propriedade_id: 'p_mt_2',
    proprietario_id: 'titular_mt',
    titular_id: 'titular_mt',
    area_total: 250,
    municipio_id: '5107925',
    municipio_nome: 'Sorriso',
    uf_id: '51',
    uf_sigla: 'MT',
    ativo: false,
  },
];

const visitas = propriedades.map((propriedade, index) => ({
  id: `v${index}`,
  fazenda_id: propriedade.id,
}));
const cadernos = [
  { id: 'c_sul', fazenda_id: 'p_sul', visivel_para_produtor: true },
  { id: 'c_mt', fazenda_id: 'p_mt', visivel_para_produtor: false },
  { id: 'c_mt_2', fazenda_id: 'p_mt_2', visivel_para_produtor: true },
];
const mapas = [
  { id: 'm_sul', fazenda_id: 'p_sul', disponivel_download: true },
  { id: 'm_mt', fazenda_id: 'p_mt', disponivel_download: false },
  { id: 'm_mt_2', fazenda_id: 'p_mt_2', disponivel_download: true },
];

const run = async () => {
  await test('admin recebe panorama local completo', () => {
    const escopo = buildDashboardScopeData({
      user: { perfil: 'admin' },
      propriedades,
      visitas,
      cadernos,
      mapas,
    });

    assert.equal(escopo.propriedades.length, 3);
    assert.equal(escopo.visitas.length, 3);
    assert.equal(escopo.cadernos.length, 3);
    assert.equal(escopo.mapas.length, 3);
  });

  await test('colaborador recebe somente dados das Propriedades vinculadas', () => {
    const escopo = buildDashboardScopeData({
      user: {
        perfil: 'colaborador',
        vinculos_propriedades: [
          { propriedade_id: 'p_mt', tipo_vinculo: 'colaborador', status: 'ativo' },
          { propriedade_id: 'p_mt_2', tipo_vinculo: 'colaborador', status: 'ativo' },
        ],
      },
      propriedades,
      visitas,
      cadernos,
      mapas,
    });

    assert.deepEqual(escopo.propriedades.map((item) => item.id), ['p_mt', 'p_mt_2']);
    assert.deepEqual(escopo.visitas.map((item) => item.id), ['v1', 'v2']);
    assert.equal(escopo.cadernos.length, 2);
  });

  await test('produtor recebe somente dados vinculados e visiveis', () => {
    const escopo = buildDashboardScopeData({
      user: { perfil: 'produtor', produtor_id: 'titular_mt' },
      propriedades,
      visitas,
      cadernos,
      mapas,
    });

    assert.deepEqual(escopo.propriedades.map((item) => item.id), ['p_mt', 'p_mt_2']);
    assert.deepEqual(escopo.cadernos.map((item) => item.id), ['c_mt_2']);
    assert.deepEqual(escopo.mapas.map((item) => item.id), ['m_mt_2']);
  });

  await test('resumo calcula usuarios, titulares, area e status sem numeros fixos', () => {
    const resumo = buildDashboardSummary({
      propriedades,
      usuarios: [
        { perfil: 'admin' },
        { perfil: 'produtor' },
        { perfil: 'produtor' },
        { perfil: 'colaborador' },
      ],
      visitas,
      cadernos,
      mapas,
    });

    assert.equal(resumo.produtores, 2);
    assert.equal(resumo.colaboradores, 1);
    assert.equal(resumo.titularesNoEscopo, 2);
    assert.equal(resumo.areaTotalLabel, '2.500 ha');
    assert.deepEqual(resumo.status, { ativo: 1, pendente: 1, inativo: 1 });
    assert.deepEqual(getPropriedadesPorStatus(propriedades), resumo.status);
    assert.equal(getPropriedadeStatusLabel(propriedades[1]), 'Pendente');
    assert.equal(formatDashboardArea(750), '750 ha');
  });

  await test('resumo de localização usa somente as Propriedades recebidas no escopo', () => {
    const resumo = buildDashboardLocationSummary([propriedades[1], propriedades[2]]);

    assert.equal(resumo.headline, 'MT • 1 município');
    assert.equal(resumo.detail, 'Sorriso: 2');
    assert.deepEqual(resumo.ufs, ['MT']);
    assert.deepEqual(resumo.municipios.map((item) => item.id), ['5107925']);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de dashboardCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
