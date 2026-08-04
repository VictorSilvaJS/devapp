const assert = require('node:assert/strict');
const {
  User,
  Produtor,
  Mapa,
  Visita,
  CadernoCampo,
  LimiteArea,
  MockLocalData,
} = require('../.tmp-domain-compat/src/api/mock');
const { avaliarDownloadMapa } = require('../.tmp-domain-compat/src/utils/mapaDownloadCompat');

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

const localStorageValues = new Map();
const localStorageAdapter = {
  getItem: async (key) => localStorageValues.get(key) ?? null,
  setItem: async (key, value) => {
    localStorageValues.set(key, value);
  },
  removeItem: async (key) => {
    localStorageValues.delete(key);
  },
};

const run = async () => {
  MockLocalData.__setStorageForTests(localStorageAdapter);
  await MockLocalData.restoreSeed();

  await test('mock 16B.1 alinha personas e Propriedade principal sem alterar contratos', async () => {
    const admin = await User.get('u1');
    const colaborador = await User.get('u5');
    const produtor = await User.get('u_sela1');
    const propriedade = await Produtor.get('p_sela1');
    const usuarios = await User.list();
    const propriedades = await Produtor.list();

    assert.equal(admin.nome, 'Admin Demonstração');
    assert.equal(admin.email, 'admin.demonstracao@example.com');
    assert.equal(admin.telefone, '');

    assert.equal(colaborador.nome, 'Colaborador de Campo');
    assert.equal(colaborador.email, 'colaborador.campo@example.com');
    assert.ok(colaborador.sub_regioes.includes('MT - Norte'));
    assert.ok(colaborador.vinculos_propriedades.some((item) => item.propriedade_id === 'p_sela1'));

    assert.equal(produtor.nome, 'Produtor Demonstração');
    assert.equal(produtor.email, 'produtor.demonstracao@example.com');
    assert.equal(produtor.produtor_id, 'prop_sela1');
    assert.ok(produtor.vinculos_propriedades.some((item) => item.propriedade_id === 'p_sela1'));

    assert.equal(propriedade.fazenda_id, 'p_sela1');
    assert.equal(propriedade.produtor_id, 'prop_sela1');
    assert.equal(propriedade.produtor_nome, 'Produtor Demonstração');
    assert.equal(propriedade.fazenda_nome, 'Fazenda Sela de Prata I');
    assert.equal(propriedade.area_total, 6200);
    assert.equal(propriedade.telefone, '');
    assert.equal(propriedade.endereco, '');
    assert.equal(propriedade.cep, '');

    assert.ok(usuarios.every((item) => item.email.endsWith('@example.com') && item.telefone === ''));
    assert.ok(propriedades.every((item) => (
      item.telefone === ''
      && item.endereco === ''
      && item.cep === ''
    )));
  });

  await test('mock 16B.1 entrega visita e caderno demonstrativos fixos para p_sela1', async () => {
    const visitas = await Visita.filter({ fazenda_id: 'p_sela1' });
    const cadernos = await CadernoCampo.filter({ fazenda_id: 'p_sela1' });
    const mapas = await Mapa.filter({ fazenda_id: 'p_sela1' });

    assert.ok(visitas.some((item) => (
      item.id === 'v_sela1_realizada_demo'
      && item.status === 'realizada'
      && item.data_visita === '2026-05-28T14:00:00.000Z'
    )));
    assert.ok(visitas.some((item) => (
      item.id === 'v_sela1_agendada_demo'
      && item.status === 'agendada'
      && item.data_visita === '2026-06-12T14:00:00.000Z'
    )));
    assert.ok(visitas.every((item) => item.fazenda_id === 'p_sela1' && item.produtor_id === 'p_sela1'));
    assert.ok(visitas.every((item) => item.fotos.length === 0));

    assert.ok(cadernos.some((item) => (
      item.id === 'c_sela1_vistoria_demo'
      && item.data_atividade === '2026-05-29T14:30:00.000Z'
      && item.talhao === 'T01 - 230'
      && item.visivel_para_produtor === true
    )));
    assert.ok(cadernos.every((item) => item.fotos.length === 0));
    assert.ok(mapas.length >= 5);
  });

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

  await test('Mapa.update persiste URL real associada ao material do mapa', async () => {
    const criado = await Mapa.create({
      titulo: 'Mapa com material associado',
      categoria: 'panorama',
      fazenda_id: 'p1',
      talhao: 'Área total',
      disponivel_para_download: false,
    });

    const atualizado = await Mapa.update(criado.id, {
      arquivo_url: 'https://cdn.exemplo.com/mapas/panorama-p1.pdf',
      formato_arquivo: 'pdf',
      tamanho_arquivo: 98765,
      disponivel_download: true,
    });

    assert.equal(atualizado.arquivo_url, 'https://cdn.exemplo.com/mapas/panorama-p1.pdf');
    assert.equal(atualizado.disponivel_download, true);
    assert.equal(atualizado.disponivel_para_download, true);
    assert.equal(avaliarDownloadMapa(atualizado).podeAbrir, true);
  });

  await test('Visita.create aceita fazenda_id e retorna alias legado compatível', async () => {
    const visita = await Visita.create({
      fazenda_id: 'p1',
      tecnico_responsavel: 'Ana Santos',
      data_visita: new Date(Date.now() + 86400000).toISOString(),
      objetivo: 'consultoria',
    });

    assert.ok(visita.id);
    assert.equal(visita.fazenda_id, 'p1');
    assert.equal(visita.produtor_id, 'p1');
    assert.deepEqual(visita.fotos, []);
    assert.equal(visita.status, 'agendada');
  });

  await test('Visita exige comando para concluir e preserva fazenda existente', async () => {
    const visita = await Visita.create({
      fazenda_id: 'p2',
      tecnico_responsavel: 'Carlos Silva',
      data_visita: new Date(Date.now() + 86400000).toISOString(),
      objetivo: 'coleta_solo',
    });

    await assert.rejects(
      () => Visita.update(visita.id, { status: 'realizada' }),
      /Estado não pode ser alterado/
    );
    const atualizada = await Visita.command(visita.id, {
      tipo: 'concluir',
      versaoBase: visita.versao_atual,
      chaveIdempotencia: `mock-compat-concluir-${visita.id}`,
      inicioRealEm: new Date().toISOString(),
      resumo: 'Coleta de solo concluída.',
    }, {
      usuarioId: 'u2',
      nome: 'Carlos Silva',
      perfil: 'colaborador',
      propriedadeIds: ['p2'],
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
    assert.equal(registro.fazendaId, 'p4');
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

  await test('CadernoCampo.update parcial preserva fazenda existente e valida o registro completo', async () => {
    const registro = await CadernoCampo.create({
      fazenda_id: 'p4',
      colaborador_responsavel: 'Carlos Silva',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'vistoria',
      visivel_para_produtor: true,
    });

    const atualizado = await CadernoCampo.update(registro.id, {
      observacoes: 'Registro ajustado',
      visivel_para_produtor: false,
    });

    assert.equal(atualizado.fazenda_id, 'p4');
    assert.equal(atualizado.fazendaId, 'p4');
    assert.equal(atualizado.produtor_id, 'p4');
    assert.equal(atualizado.observacoes, 'Registro ajustado');
    assert.equal(atualizado.visivel_para_produtor, false);
  });

  await test('LimiteArea.get expõe fazenda_id em leituras de seed legado', async () => {
    const limite = await LimiteArea.get('lt1');

    assert.equal(limite.fazenda_id, 'p1');
    assert.equal(limite.produtor_id, 'p1');
  });

  await test('LimiteArea.create aceita contrato canônico e expõe aliases de leitura compatíveis', async () => {
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

    const encontradosCanonicos = await LimiteArea.getByFazenda('p6');
    const encontradosLegados = await LimiteArea.getByProdutor('p6');

    assert.ok(encontradosCanonicos.some((item) => item.id === limite.id));
    assert.ok(encontradosLegados.some((item) => item.id === limite.id));
  });

  await test('mock 16B.2 persiste cadastros, recarrega estado local e restaura seed', async () => {
    const propriedade = await Produtor.create({
      fazenda_nome: 'Propriedade Persistência Local',
      produtor_id: 'titular_persistencia_local',
      produtor_nome: 'Titular Persistência Local',
      area_total: 42,
      regiao: 'Mato Grosso',
      microregiao: 'MT - Norte',
    });
    const usuario = await User.create({
      nome: 'Admin Persistência Local',
      email: 'admin.persistencia.local@example.com',
      senha: 'admin123',
      perfil: 'admin',
      status: 'ativo',
    });
    const visita = await Visita.create({
      fazenda_id: 'p_sela1',
      tecnico_responsavel: 'Colaborador de Campo',
      data_visita: new Date(Date.now() + 86400000 * 3).toISOString(),
      objetivo: 'outro',
      observacoes: 'Registro local demonstrativo.',
    });
    const caderno = await CadernoCampo.create({
      fazenda_id: 'p_sela1',
      colaborador_responsavel: 'Colaborador de Campo',
      data_atividade: '2026-06-15T15:00:00.000Z',
      tipo_atividade: 'vistoria',
      observacoes: 'Registro local demonstrativo.',
    });
    const mapa = await Mapa.create({
      titulo: 'Metadado local demonstrativo',
      categoria: 'panorama',
      fazenda_id: 'p_sela1',
      talhao: 'Propriedade inteira',
    });
    const visitaRemovida = await Visita.create({
      fazenda_id: 'p_sela1',
      tecnico_responsavel: 'Colaborador de Campo',
      data_visita: new Date(Date.now() + 86400000 * 4).toISOString(),
      objetivo: 'outro',
    });

    await Produtor.update(propriedade.id, {
      fazenda_nome: 'Propriedade Persistência Local Atualizada',
    });
    const visitaCancelada = await Visita.command(visitaRemovida.id, {
      tipo: 'cancelar',
      versaoBase: visitaRemovida.versao_atual,
      chaveIdempotencia: `mock-compat-cancelar-${visitaRemovida.id}`,
      motivoCodigo: 'duplicidade',
    }, {
      usuarioId: 'u2',
      nome: 'Colaborador de Campo',
      perfil: 'colaborador',
      propriedadeIds: ['p_sela1'],
    });

    const snapshot = await MockLocalData.readLocalSnapshot();
    assert.ok(snapshot.produtores.some((item) => (
      item.id === propriedade.id
      && item.fazenda_nome === 'Propriedade Persistência Local Atualizada'
    )));
    assert.ok(snapshot.users.some((item) => item.id === usuario.id));
    assert.ok(snapshot.visitas.some((item) => item.id === visita.id));
    assert.ok(snapshot.visitas.some((item) => (
      item.id === visitaCancelada.id
      && item.status === 'cancelada'
      && item.eventos_visita.at(-1).tipo === 'visita_cancelada'
    )));
    assert.ok(snapshot.cadernos.some((item) => item.id === caderno.id));
    assert.ok(snapshot.mapas.some((item) => item.id === mapa.id));
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'limitesArea'), false);

    MockLocalData.__setStorageForTests(localStorageAdapter);

    assert.equal(
      (await Produtor.get(propriedade.id)).fazenda_nome,
      'Propriedade Persistência Local Atualizada'
    );
    assert.equal((await User.get(usuario.id)).email, usuario.email);
    assert.equal((await Visita.get(visita.id)).fazenda_id, 'p_sela1');
    assert.equal((await CadernoCampo.get(caderno.id)).fazenda_id, 'p_sela1');
    assert.equal((await Mapa.get(mapa.id)).fazenda_id, 'p_sela1');

    await MockLocalData.restoreSeed();

    await assert.rejects(() => Produtor.get(propriedade.id), /Produtor não encontrado/);
    await assert.rejects(() => User.get(usuario.id), /Usuário não encontrado/);
    assert.equal((await Produtor.get('p_sela1')).fazenda_id, 'p_sela1');
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
