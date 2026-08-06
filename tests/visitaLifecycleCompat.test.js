const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lifecycle = require('../.tmp-domain-compat/src/utils/visitaLifecycleCompat');
const { Visita, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');

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

const NOW = '2026-08-04T15:00:00.000Z';
const team = {
  usuarioId: 'user_visita_1',
  nome: 'Técnica Responsável',
  perfil: 'colaborador',
  propriedadeIds: ['faz_mp27'],
};
const admin = { usuarioId: 'admin_visita', nome: 'Admin', perfil: 'admin', propriedadeIds: [] };
const producer = { usuarioId: 'prod_visita', nome: 'Produtor', perfil: 'produtor', propriedadeIds: ['faz_mp27'] };
const outsideTeam = { ...team, usuarioId: 'user_outside', propriedadeIds: ['outra_fazenda'] };
const base = (overrides = {}) => ({
  fazenda_id: 'faz_mp27',
  tecnico_responsavel: 'Técnica Responsável',
  data_visita: '2026-08-05T15:00:00.000Z',
  objetivo: 'consultoria',
  observacoes: 'Acompanhamento planejado.',
  status: 'agendada',
  fotos: [],
  ...overrides,
});
const scheduled = (overrides = {}) => lifecycle.createVisitaLifecycleRecord({
  id: 'visita_mp27',
  data: base(overrides),
  actor: team,
  now: NOW,
  idempotencyKey: 'create-scheduled-1',
});
const command = (record, value, actor = team, now = '2026-08-04T16:00:00.000Z') =>
  lifecycle.applyVisitaCommand({ record, command: value, actor, now });

const run = async () => {
  await test('registro legado permanece legível sem histórico inventado', () => {
    const legacy = lifecycle.withVisitaLifecycleReadCompat(base({ id: 'legacy' }));
    assert.equal(legacy.status, 'agendada');
    assert.equal(legacy.registro_legado, true);
    assert.equal(legacy.versao_atual, 1);
    assert.deepEqual(legacy.eventos_visita, []);
  });

  await test('histórico legado de Visita é lido com propriedade_id sem perder o vínculo', () => {
    const record = lifecycle.withVisitaLifecycleReadCompat(base({
      id: 'legacy-events',
      propriedade_id: 'faz_registro',
      versao_atual: 3,
      eventos_visita: [
        { evento_id: 'e1', propriedade_id: 'faz_canonica', fazenda_id: 'faz_incorreta', tipo: 'canonico' },
        { evento_id: 'e2', fazenda_id: 'faz_legada', tipo: 'legado' },
        { evento_id: 'e3', tipo: 'sem_contexto' },
      ],
    }));

    assert.deepEqual(
      record.eventos_visita.map((event) => event.propriedade_id),
      ['faz_canonica', 'faz_legada', 'faz_registro']
    );
    assert.equal(record.eventos_visita.some((event) => 'fazenda_id' in event || 'fazendaId' in event), false);
  });

  await test('estado desconhecido exige reconciliação e bloqueia comando', () => {
    const unknown = lifecycle.withVisitaLifecycleReadCompat(base({ status: 'em_campo' }));
    assert.equal(lifecycle.getVisitaEstado(unknown), null);
    assert.equal(unknown.estado_visita_reconciliacao, true);
    assert.throws(() => command(unknown, {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'unknown',
      inicioRealEm: NOW, resumo: 'Tentativa',
    }), /estado não reconhecido/);
  });

  await test('agendamento novo registra autoria, versão e evento inicial', () => {
    const record = scheduled();
    assert.equal(record.status, 'agendada');
    assert.equal(record.agendada_para, base().data_visita);
    assert.equal(record.criada_por_usuario_id, team.usuarioId);
    assert.equal(record.versao_atual, 1);
    assert.equal(record.eventos_visita[0].tipo, 'visita_agendada');
    assert.equal(record.eventos_visita[0].estado_novo, 'agendada');
    assert.equal(record.eventos_visita[0].propriedade_id, 'faz_mp27');
    assert.equal('fazenda_id' in record.eventos_visita[0], false);
  });

  await test('registro direto realizado usa o contrato de conclusão', () => {
    const record = lifecycle.createVisitaLifecycleRecord({
      id: 'realizada_direta',
      data: base({
        status: 'realizada',
        data_visita: '2026-08-04T14:00:00.000Z',
        observacoes: 'Resumo da execução direta.',
      }),
      actor: team,
      now: NOW,
      idempotencyKey: 'create-completed-1',
    });
    assert.equal(record.status, 'realizada');
    assert.equal(record.inicio_real_em, '2026-08-04T14:00:00.000Z');
    assert.equal(record.resumo_conclusao, 'Resumo da execução direta.');
    assert.equal(record.concluida_por_usuario_id, team.usuarioId);
    assert.equal(record.eventos_visita[0].tipo, 'visita_realizada_registrada');
  });

  await test('criação rejeita estado inicial terminal e datas incoerentes', () => {
    assert.throws(() => lifecycle.createVisitaLifecycleRecord({
      id: 'cancelada', data: base({ status: 'cancelada' }), actor: team, now: NOW,
      idempotencyKey: 'invalid-cancelled',
    }), /estado inicial/);
    assert.throws(() => lifecycle.createVisitaLifecycleRecord({
      id: 'past', data: base({ data_visita: '2026-08-04T14:00:00.000Z' }), actor: team, now: NOW,
      idempotencyKey: 'invalid-past',
    }), /devem ser futuras/);
    assert.throws(() => lifecycle.createVisitaLifecycleRecord({
      id: 'future-completed', data: base({ status: 'realizada', observacoes: 'Resumo' }), actor: team, now: NOW,
      idempotencyKey: 'invalid-future-completed',
    }), /não pode estar no futuro/);
    assert.throws(() => lifecycle.createVisitaLifecycleRecord({
      id: 'unknown', data: base({ status: 'em_andamento' }), actor: team, now: NOW,
      idempotencyKey: 'invalid-unknown',
    }), /não reconhecido/);
  });

  await test('criação e comandos recusam Produtor e Colaborador fora do escopo', () => {
    assert.throws(() => lifecycle.createVisitaLifecycleRecord({
      id: 'producer', data: base(), actor: producer, now: NOW, idempotencyKey: 'producer-create',
    }), /somente para equipe/);
    assert.throws(() => command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'outside-cancel', motivoCodigo: 'clima',
    }, outsideTeam), /fora do escopo/);
  });

  await test('Admin pode operar sem lista local de Propriedades', () => {
    const updated = command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'admin-cancel', motivoCodigo: 'clima',
    }, admin);
    assert.equal(updated.status, 'cancelada');
  });

  await test('reagendamento exige motivo e preserva antes/depois', () => {
    const record = scheduled();
    assert.throws(() => command(record, {
      tipo: 'alterar_agendamento', versaoBase: 1, chaveIdempotencia: 'reschedule-no-reason',
      alteracoes: { data_visita: '2026-08-06T15:00:00.000Z' },
    }), /Informe o motivo/);
    const updated = command(record, {
      tipo: 'alterar_agendamento', versaoBase: 1, chaveIdempotencia: 'reschedule-ok',
      alteracoes: { data_visita: '2026-08-06T15:00:00.000Z' }, motivo: 'Produtor solicitou nova data',
    });
    assert.equal(updated.status, 'agendada');
    assert.equal(updated.data_visita, '2026-08-06T15:00:00.000Z');
    assert.equal(updated.agendada_para, '2026-08-06T15:00:00.000Z');
    assert.equal(updated.eventos_visita.at(-1).antes.data_visita, base().data_visita);
    assert.equal(updated.eventos_visita.at(-1).motivo, 'Produtor solicitou nova data');
  });

  await test('alteração de agenda não aceita status, Propriedade nem campos administrativos', () => {
    for (const field of ['status', 'propriedade_id', 'fazenda_id', 'versao_atual', 'eventos_visita']) {
      assert.throws(() => command(scheduled(), {
        tipo: 'alterar_agendamento', versaoBase: 1, chaveIdempotencia: `forbidden-${field}`,
        alteracoes: { [field]: field === 'status' ? 'realizada' : 'tentativa' },
      }), /Campos não permitidos/);
    }
  });

  await test('conclusão exige início real e resumo não futuro', () => {
    assert.throws(() => command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-empty',
      inicioRealEm: '2026-08-04T14:00:00.000Z', resumo: ' ',
    }), /resumo operacional/);
    assert.throws(() => command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-future',
      inicioRealEm: '2026-08-04T17:00:00.000Z', resumo: 'Resumo',
    }), /não pode estar no futuro/);
  });

  await test('conclusão muda estado e preserva agenda e histórico', () => {
    const record = scheduled();
    const completed = command(record, {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-ok',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Acompanhamento concluído.',
      responsavelExecutanteNome: 'Técnica Responsável',
    });
    assert.equal(completed.status, 'realizada');
    assert.equal(completed.data_visita, record.data_visita);
    assert.equal(completed.inicio_real_em, '2026-08-04T14:30:00.000Z');
    assert.equal(completed.resumo_conclusao, 'Acompanhamento concluído.');
    assert.equal(completed.versao_atual, 2);
    assert.equal(completed.eventos_visita.at(-1).tipo, 'visita_concluida');
  });

  await test('realizada não regride para agendada nem cancelada', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-terminal',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Concluída.',
    });
    assert.throws(() => command(completed, {
      tipo: 'alterar_agendamento', versaoBase: 2, chaveIdempotencia: 'regress-schedule',
      alteracoes: { objetivo: 'outro' },
    }), /indisponível a partir de realizada/);
    assert.throws(() => command(completed, {
      tipo: 'cancelar', versaoBase: 2, chaveIdempotencia: 'regress-cancel', motivoCodigo: 'clima',
    }), /indisponível a partir de realizada/);
  });

  await test('cancelamento exige catálogo e descrição para outro', () => {
    assert.throws(() => command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'cancel-invalid', motivoCodigo: 'invalido',
    }), /motivo válido/);
    assert.throws(() => command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'cancel-other-empty', motivoCodigo: 'outro',
    }), /Descreva o outro motivo/);
  });

  await test('cancelamento é terminal e persiste motivo, autor e data', () => {
    const cancelled = command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'cancel-ok',
      motivoCodigo: 'solicitacao_produtor',
    });
    assert.equal(cancelled.status, 'cancelada');
    assert.equal(cancelled.cancelamento_motivo_codigo, 'solicitacao_produtor');
    assert.equal(cancelled.cancelada_por_usuario_id, team.usuarioId);
    assert.equal(cancelled.cancelada_em, '2026-08-04T16:00:00.000Z');
    assert.throws(() => command(cancelled, {
      tipo: 'concluir', versaoBase: 2, chaveIdempotencia: 'cancelled-complete',
      inicioRealEm: NOW, resumo: 'Não pode',
    }), /indisponível a partir de cancelada/);
  });

  await test('complemento e correção de realizada são versionados sem apagar conclusão', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-for-audit',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Resumo original.',
    });
    const complemented = command(completed, {
      tipo: 'adicionar_complemento', versaoBase: 2, chaveIdempotencia: 'complement-ok',
      texto: 'Recomendação posterior.', visivelParaProdutor: true,
    });
    const corrected = command(complemented, {
      tipo: 'corrigir', versaoBase: 3, chaveIdempotencia: 'correction-ok',
      motivo: 'Ajuste confirmado', alteracoes: { clima: 'Nublado' },
    });
    assert.equal(corrected.status, 'realizada');
    assert.equal(corrected.resumo_conclusao, 'Resumo original.');
    assert.equal(corrected.complementos_visita.length, 1);
    assert.equal(corrected.clima, 'Nublado');
    assert.equal(corrected.eventos_visita.at(-1).antes.clima, undefined);
    assert.equal(corrected.eventos_visita.at(-1).depois.clima, 'Nublado');
    assert.equal(corrected.versao_atual, 4);
  });

  await test('correção não altera identidade, estado nem datas protegidas', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-for-forbidden-correction',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Resumo.',
    });
    for (const field of ['id', 'propriedade_id', 'fazenda_id', 'status', 'concluida_em', 'concluida_por_usuario_id']) {
      assert.throws(() => command(completed, {
        tipo: 'corrigir', versaoBase: 2, chaveIdempotencia: `correction-forbidden-${field}`,
        motivo: 'Tentativa', alteracoes: { [field]: 'outro' },
      }), /Campos não permitidos/);
    }
  });

  await test('anulação preserva a conclusão e é terminal', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'complete-for-annulment',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Resumo preservado.',
    });
    const annulled = command(completed, {
      tipo: 'anular', versaoBase: 2, chaveIdempotencia: 'annul-ok', motivo: 'Registro duplicado',
    });
    assert.equal(annulled.status, 'anulada');
    assert.equal(annulled.resumo_conclusao, 'Resumo preservado.');
    assert.equal(annulled.anulacao_motivo, 'Registro duplicado');
    assert.throws(() => command(annulled, {
      tipo: 'adicionar_complemento', versaoBase: 3, chaveIdempotencia: 'annulled-complement', texto: 'Não pode',
    }), /indisponível a partir de anulada/);
  });

  await test('comando desconhecido é recusado sem cair em anulação', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'unknown-base',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Executada.',
    });
    assert.throws(() => lifecycle.applyVisitaCommand({
      record: completed,
      command: { tipo: 'forcar_estado', versaoBase: 2, chaveIdempotencia: 'unknown-command', motivo: 'invalido' },
      actor: team,
      now: NOW,
    }), /Comando não reconhecido/);
    assert.equal(completed.status, 'realizada');
  });

  await test('versão base obsoleta é recusada', () => {
    const cancelled = command(scheduled(), {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'version-first', motivoCodigo: 'clima',
    });
    assert.throws(() => command(cancelled, {
      tipo: 'anular', versaoBase: 1, chaveIdempotencia: 'version-stale', motivo: 'Tentativa',
    }), /Versão atual 2/);
  });

  await test('mesma chave idempotente não duplica evento', () => {
    const record = scheduled();
    const value = {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'same-key', motivoCodigo: 'clima',
    };
    const first = command(record, value);
    const repeated = command(first, value);
    assert.equal(repeated.versao_atual, 2);
    assert.equal(repeated.eventos_visita.length, first.eventos_visita.length);
  });

  await test('projeção do Produtor oculta auditoria e complemento interno', () => {
    const completed = command(scheduled(), {
      tipo: 'concluir', versaoBase: 1, chaveIdempotencia: 'producer-complete',
      inicioRealEm: '2026-08-04T14:30:00.000Z', resumo: 'Resumo.',
    });
    const visible = command(completed, {
      tipo: 'adicionar_complemento', versaoBase: 2, chaveIdempotencia: 'producer-visible',
      texto: 'Liberado.', visivelParaProdutor: true,
    });
    const internal = command(visible, {
      tipo: 'adicionar_complemento', versaoBase: 3, chaveIdempotencia: 'producer-internal',
      texto: 'Interno.', visivelParaProdutor: false,
    });
    const projection = lifecycle.toVisitaProducerProjection(internal);
    assert.equal(Object.hasOwn(projection, 'eventos_visita'), false);
    assert.equal(Object.hasOwn(projection, 'versao_atual'), false);
    assert.deepEqual(projection.complementos_visita.map((item) => item.texto), ['Liberado.']);
  });

  await test('nova Visita vinculada preserva origem no histórico', () => {
    const linked = lifecycle.createVisitaLifecycleRecord({
      id: 'linked',
      data: base({ visita_origem_id: 'cancelled-origin' }),
      actor: team,
      now: NOW,
      idempotencyKey: 'linked-create',
    });
    assert.equal(linked.visita_origem_id, 'cancelled-origin');
    assert.deepEqual(linked.eventos_visita.map((item) => item.tipo), ['visita_agendada', 'nova_visita_vinculada']);
  });

  await test('API bloqueia status manipulado e exclusão física', async () => {
    const storage = new Map();
    MockLocalData.__setStorageForTests({
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async (key) => storage.delete(key),
    });
    await MockLocalData.restoreSeed();
    const apiActor = { ...team, propriedadeIds: ['p_sela1'] };
    const record = await Visita.createScheduled({
      fazenda_id: 'p_sela1', tecnico_responsavel: team.nome,
      data_visita: new Date(Date.now() + 86400000).toISOString(), objetivo: 'consultoria', fotos: [],
    }, apiActor, 'api-create-mp27');
    await assert.rejects(() => Visita.createScheduled({
      fazenda_id: 'p_sela1', tecnico_responsavel: team.nome,
      data_visita: new Date(Date.now() + 86400000).toISOString(), objetivo: 'consultoria', fotos: [],
      visita_origem_id: 'origem-injetada',
    }, apiActor, 'api-origin-injection-mp27'), /Campos protegidos/);
    await assert.rejects(() => Visita.createScheduled({
      fazenda_id: 'p_sela1', tecnico_responsavel: team.nome,
      data_visita: new Date(Date.now() + 86400000).toISOString(), objetivo: 'consultoria', fotos: [],
      eventos_visita: [{ tipo: 'forjado' }],
    }, apiActor, 'api-history-injection-mp27'), /Campos protegidos/);
    await assert.rejects(() => Visita.update(record.id, { status: 'realizada' }), /Estado não pode ser alterado/);
    await assert.rejects(() => Visita.updateAgenda(record.id, { fazenda_id: 'p2', objetivo: 'outro' }, apiActor), /não pode ser reatribuída/);
    await assert.rejects(() => Visita.updateAgenda(record.id, {
      objetivo: 'outro', concluida_em: new Date().toISOString(),
    }, apiActor), /Campos não permitidos/);
    await assert.rejects(() => Visita.delete(record.id), /não pode ser excluída/);
  });

  await test('API persiste comando e restaura eventos no snapshot local', async () => {
    const apiActor = { ...team, propriedadeIds: ['p_sela1'] };
    const created = await Visita.createScheduled({
      fazenda_id: 'p_sela1', tecnico_responsavel: team.nome,
      data_visita: new Date(Date.now() + 172800000).toISOString(), objetivo: 'consultoria', fotos: [],
    }, apiActor, 'api-persist-create-mp27');
    const cancelled = await Visita.command(created.id, {
      tipo: 'cancelar', versaoBase: 1, chaveIdempotencia: 'api-persist-cancel-mp27', motivoCodigo: 'clima',
    }, apiActor);
    assert.equal(cancelled.status, 'cancelada');
    const snapshot = await MockLocalData.readLocalSnapshot();
    const persisted = snapshot.visitas.find((item) => item.id === created.id);
    assert.equal(persisted.status, 'cancelada');
    assert.equal(persisted.eventos_visita.at(-1).tipo, 'visita_cancelada');
  });

  await test('UI usa comandos explícitos e remove status livre e exclusão', () => {
    const root = path.join(__dirname, '..');
    const detail = fs.readFileSync(path.join(root, 'src/screens/VisitaDetailScreen.tsx'), 'utf8');
    const edit = fs.readFileSync(path.join(root, 'src/screens/EditarVisitaScreen.tsx'), 'utf8');
    const create = fs.readFileSync(path.join(root, 'src/screens/NovaVisitaScreen.tsx'), 'utf8');
    const actions = fs.readFileSync(path.join(root, 'src/components/VisitaLifecycleActions.tsx'), 'utf8');
    assert.match(detail, /VisitaLifecycleActions/);
    assert.doesNotMatch(detail, /Visita\.delete|Marcar Realizada|showDeleteDialog/);
    assert.match(detail, /\['agendada', 'realizada', 'cancelada'\]\.includes\(estado\)/);
    assert.doesNotMatch(edit, /statusOptions|onChange=\{setStatus\}|buildVisitaPayload/);
    assert.match(edit, /Visita\.updateAgenda/);
    assert.match(create, /Visita\.createScheduled|Visita\.registerCompleted|ConfirmDialog/);
    assert.match(actions, /Resumo operacional|Motivo do cancelamento|Complementar|Corrigir|Anular/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
};

run();
