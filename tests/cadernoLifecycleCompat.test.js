const assert = require('node:assert/strict');
const lifecycle = require('../.tmp-domain-compat/src/utils/cadernoLifecycleCompat');
const access = require('../.tmp-domain-compat/src/utils/acessoControle');
const { CadernoCampo, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');

let failed = 0;
let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const team = {
  usuarioId: 'user_team_1', nome: 'Técnica Responsável', perfil: 'colaborador',
  propriedadeIds: ['faz_mp25'],
};
const otherTeam = { ...team, usuarioId: 'user_team_2' };
const base = (overrides = {}) => ({
  fazenda_id: 'faz_mp25', fazendaId: 'faz_mp25',
  colaborador_responsavel: 'Técnica Responsável', responsavel_usuario_id: 'user_team_1',
  data_atividade: '2026-08-03T12:00:00.000Z', tipo_atividade: 'observacao',
  observacoes: 'Corpo original do registro.', visivel_para_produtor: true,
  ...overrides,
});
const draft = (data = base(), actor = team) => lifecycle.createCadernoDraft({
  id: `cad_mp25_${actor.usuarioId}`, data, actor, now: '2026-08-03T12:05:00.000Z',
});
const submitted = () => lifecycle.submitCadernoRecord({
  record: draft(), actor: team, now: '2026-08-03T12:10:00.000Z',
});

const run = async () => {
  await test('validação por tipo exige os campos de negócio definidos', () => {
    assert.deepEqual(lifecycle.getCadernoTypeValidationErrors(base({ observacoes: '' })), {
      observacoes: 'Descreva o registro',
    });
    assert.deepEqual(Object.keys(lifecycle.getCadernoTypeValidationErrors(base({ tipo_atividade: 'ocorrencia', observacoes: '' }))), ['observacoes']);
    assert.deepEqual(Object.keys(lifecycle.getCadernoTypeValidationErrors(base({ tipo_atividade: 'outro', observacoes: '' }))), ['observacoes']);
    assert.deepEqual(
      Object.keys(lifecycle.getCadernoTypeValidationErrors(base({ tipo_atividade: 'plantio' }))).sort(),
      ['operacao', 'periodoProdutivoId', 'talhaoId'].sort()
    );
    assert.deepEqual(
      Object.keys(lifecycle.getCadernoTypeValidationErrors(base({ tipo_atividade: 'aplicacao' }))).sort(),
      ['areaAplicada', 'dosagem', 'produtos', 'talhaoId'].sort()
    );
    assert.deepEqual(
      Object.keys(lifecycle.getCadernoTypeValidationErrors(base({ tipo_atividade: 'colheita' }))).sort(),
      ['areaAplicada', 'periodoProdutivoId', 'produtividade', 'talhaoId'].sort()
    );
  });

  await test('rascunho registra autoria estável e só o criador pode editar', () => {
    const record = draft();
    assert.equal(record.estado_caderno, 'rascunho');
    assert.equal(record.criado_por_user_id, team.usuarioId);
    assert.equal(lifecycle.isCadernoDraftOwner(record, team.usuarioId), true);
    assert.equal(access.podeEditarCaderno({ id: team.usuarioId, perfil: 'colaborador' }, record), true);
    assert.equal(access.podeEditarCaderno({ id: otherTeam.usuarioId, perfil: 'colaborador' }, record), false);
    assert.throws(() => lifecycle.updateCadernoDraft({ record, data: { observacoes: 'Tentativa' }, actor: otherTeam }), /Somente o criador/);
    assert.equal(record.eventos_caderno[0].propriedade_id, 'faz_mp25');
    assert.equal('fazenda_id' in record.eventos_caderno[0], false);
  });

  await test('histórico legado do Caderno é lido com propriedade_id sem perder o vínculo', () => {
    const record = lifecycle.withCadernoLifecycleReadCompat(base({
      id: 'legacy-events',
      propriedade_id: 'faz_registro',
      estado_caderno: 'registrado',
      versao_atual: 3,
      eventos_caderno: [
        { evento_id: 'e1', propriedade_id: 'faz_canonica', fazenda_id: 'faz_incorreta', tipo: 'canonico' },
        { evento_id: 'e2', fazenda_id: 'faz_legada', tipo: 'legado' },
        { evento_id: 'e3', tipo: 'sem_contexto' },
      ],
    }));

    assert.deepEqual(
      record.eventos_caderno.map((event) => event.propriedade_id),
      ['faz_canonica', 'faz_legada', 'faz_registro']
    );
    assert.equal(record.eventos_caderno.some((event) => 'fazenda_id' in event || 'fazendaId' in event), false);
  });

  await test('envio preserva corpo e localização originais e bloqueia sobrescrita', () => {
    const location = {
      localizacao_latitude: -27.123, localizacao_longitude: -52.456,
      localizacao_accuracy: 7, localizacao_captured_at: '2026-08-03T12:00:00.000Z',
      localizacao_captured_by: team.usuarioId, localizacao_origem: 'foreground_explicit',
    };
    const record = lifecycle.submitCadernoRecord({ record: draft(base(location)), actor: team });
    assert.equal(record.estado_caderno, 'registrado');
    assert.equal(record.versao_atual, 1);
    assert.equal(record.conteudo_original.observacoes, 'Corpo original do registro.');
    assert.equal(record.conteudo_original.propriedade_id, 'faz_mp25');
    assert.equal('fazenda_id' in record.conteudo_original, false);
    assert.equal(record.conteudo_original.localizacao_latitude, -27.123);
    assert.equal(record.eventos_caderno.at(-1).tipo, 'registro_enviado');
    assert.throws(() => lifecycle.updateCadernoDraft({ record, data: { observacoes: 'Sobrescrita' }, actor: team }), /não aceita edição destrutiva/);
  });

  await test('complemento e correção são versionados com antes/depois', () => {
    const original = submitted();
    const complemented = lifecycle.applyCadernoCommand({
      record: original, actor: team,
      command: { tipo: 'adicionar_complemento', versaoBase: 1, texto: 'Recomendação posterior.', visivelParaProdutor: true },
    });
    const corrected = lifecycle.applyCadernoCommand({
      record: complemented, actor: team,
      command: { tipo: 'corrigir', versaoBase: 2, motivo: 'Ajuste confirmado', alteracoes: { observacoes: 'Corpo vigente corrigido.' } },
    });
    assert.equal(corrected.versao_atual, 3);
    assert.equal(corrected.observacoes, 'Corpo vigente corrigido.');
    assert.equal(corrected.conteudo_original.observacoes, 'Corpo original do registro.');
    const event = corrected.eventos_caderno.at(-1);
    assert.equal(event.motivo, 'Ajuste confirmado');
    assert.equal(event.antes.observacoes, 'Corpo original do registro.');
    assert.equal(event.depois.observacoes, 'Corpo vigente corrigido.');
    for (const field of ['propriedade_id', 'fazenda_id']) {
      assert.throws(() => lifecycle.applyCadernoCommand({
        record: corrected, actor: team,
        command: { tipo: 'corrigir', versaoBase: 3, motivo: 'Tentativa', alteracoes: { [field]: 'outra' } },
      }), /Campos não permitidos/);
    }
  });

  await test('correção de localização exige o grupo integral', () => {
    assert.throws(() => lifecycle.applyCadernoCommand({
      record: submitted(), actor: team,
      command: { tipo: 'corrigir', versaoBase: 1, motivo: 'Ajuste GPS', alteracoes: { localizacao_latitude: -28 } },
    }), /grupo integral válido/);
  });

  await test('visibilidade, arquivamento, reativação e anulação deixam trilha', () => {
    const hidden = lifecycle.applyCadernoCommand({
      record: submitted(), actor: team,
      command: { tipo: 'alterar_visibilidade', versaoBase: 1, visivelParaProdutor: false, motivo: 'Revisão interna' },
    });
    assert.equal(hidden.eventos_caderno.at(-1).tipo, 'visibilidade_alterada');
    const archived = lifecycle.applyCadernoCommand({ record: hidden, actor: team, command: { tipo: 'arquivar', versaoBase: 2, motivo: 'Encerrado' } });
    const reactivated = lifecycle.applyCadernoCommand({ record: archived, actor: team, command: { tipo: 'reativar', versaoBase: 3, motivo: 'Retorno' } });
    const annulled = lifecycle.applyCadernoCommand({ record: reactivated, actor: team, command: { tipo: 'anular', versaoBase: 4, motivo: 'Inválido' } });
    assert.equal(lifecycle.getCadernoEstado(archived), 'arquivado');
    assert.equal(lifecycle.getCadernoEstado(annulled), 'anulado');
    assert.equal(annulled.eventos_caderno.at(-1).motivo, 'Inválido');
  });

  await test('comando rejeita versão obsoleta e escopo incorreto', () => {
    assert.throws(() => lifecycle.applyCadernoCommand({
      record: submitted(), actor: team,
      command: { tipo: 'adicionar_complemento', versaoBase: 99, texto: 'Conflito' },
    }), /Versão atual 1/);
    assert.throws(() => lifecycle.applyCadernoCommand({
      record: submitted(), actor: { ...team, propriedadeIds: ['outra'] },
      command: { tipo: 'adicionar_complemento', versaoBase: 1, texto: 'Fora' },
    }), /fora do escopo/);
  });

  await test('projeção do produtor remove auditoria e complemento restrito', () => {
    const publicRecord = lifecycle.applyCadernoCommand({
      record: submitted(), actor: team,
      command: { tipo: 'adicionar_complemento', versaoBase: 1, texto: 'Público', visivelParaProdutor: true },
    });
    const mixed = lifecycle.applyCadernoCommand({
      record: publicRecord, actor: team,
      command: { tipo: 'adicionar_complemento', versaoBase: 2, texto: 'Interno', visivelParaProdutor: false },
    });
    const projection = lifecycle.toCadernoProducerProjection(mixed);
    assert.equal('eventos_caderno' in projection, false);
    assert.equal('conteudo_original' in projection, false);
    assert.equal('responsavel_usuario_id' in projection, false);
    assert.deepEqual(projection.complementos_caderno.map((item) => item.texto), ['Público']);
  });

  await test('listas exibem somente rascunho próprio e ocultam arquivados', () => {
    const ownDraft = draft();
    const otherDraft = draft(base(), otherTeam);
    const archived = lifecycle.applyCadernoCommand({
      record: submitted(), actor: team,
      command: { tipo: 'arquivar', versaoBase: 1, motivo: 'Arquivo' },
    });
    const list = access.filtrarCadernosPorFazendaIds([ownDraft, otherDraft, submitted(), archived], ['faz_mp25'], {
      incluirRascunhosDoUsuario: true, usuarioId: team.usuarioId,
    });
    assert.equal(list.includes(ownDraft), true);
    assert.equal(list.includes(otherDraft), false);
    assert.equal(list.includes(archived), false);
  });

  await test('legado é marcado e não recebe comando moderno por suposição', () => {
    const legacy = lifecycle.withCadernoLifecycleReadCompat({ id: 'legacy', ...base() });
    assert.equal(legacy.estado_caderno, 'registrado_legado');
    assert.equal(legacy.conteudo_original.observacoes, base().observacoes);
    assert.throws(() => lifecycle.applyCadernoCommand({
      record: legacy, actor: team,
      command: { tipo: 'adicionar_complemento', versaoBase: 1, texto: 'Não permitido' },
    }), /indisponível para registro registrado_legado/);
  });

  await test('API não exclui nem sobrescreve registro enviado', async () => {
    const storage = new Map();
    MockLocalData.__setStorageForTests({
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async (key) => storage.delete(key),
    });
    await MockLocalData.restoreSeed();
    const created = await CadernoCampo.submit(base(), team);
    await assert.rejects(() => CadernoCampo.update(created.id, { observacoes: 'Sobrescrita' }), /não aceita edição destrutiva/);
    await assert.rejects(() => CadernoCampo.delete(created.id, team), /Somente o criador pode descartar/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
};

run();
