export const VISITA_ESTADOS = [
  'agendada',
  'realizada',
  'cancelada',
  'anulada',
] as const;

export type VisitaEstado = typeof VISITA_ESTADOS[number];

export type VisitaActor = {
  usuarioId: string;
  nome?: string;
  perfil: 'admin' | 'colaborador' | 'produtor' | string;
  propriedadeIds?: string[];
};

export type VisitaCommand =
  | {
    tipo: 'alterar_agendamento';
    versaoBase: number;
    chaveIdempotencia: string;
    alteracoes: Record<string, unknown>;
    motivo?: string;
  }
  | {
    tipo: 'concluir';
    versaoBase: number;
    chaveIdempotencia: string;
    inicioRealEm: string;
    resumo: string;
    responsavelExecutanteUsuarioId?: string;
    responsavelExecutanteNome?: string;
    detalhes?: Record<string, unknown>;
  }
  | {
    tipo: 'cancelar';
    versaoBase: number;
    chaveIdempotencia: string;
    motivoCodigo: VisitaCancelamentoMotivo;
    motivoDescricao?: string;
  }
  | {
    tipo: 'adicionar_complemento';
    versaoBase: number;
    chaveIdempotencia: string;
    texto: string;
    visivelParaProdutor?: boolean;
  }
  | {
    tipo: 'corrigir';
    versaoBase: number;
    chaveIdempotencia: string;
    motivo: string;
    alteracoes: Record<string, unknown>;
  }
  | {
    tipo: 'anular';
    versaoBase: number;
    chaveIdempotencia: string;
    motivo: string;
  };

export const VISITA_CANCELAMENTO_MOTIVOS = [
  { value: 'solicitacao_produtor', label: 'Solicitação do produtor' },
  { value: 'indisponibilidade_equipe', label: 'Indisponibilidade da equipe' },
  { value: 'clima', label: 'Condições climáticas' },
  { value: 'reagendada_com_nova_visita', label: 'Reagendada com nova visita' },
  { value: 'duplicidade', label: 'Duplicidade' },
  { value: 'outro', label: 'Outro motivo' },
] as const;

export type VisitaCancelamentoMotivo = typeof VISITA_CANCELAMENTO_MOTIVOS[number]['value'];

const AGENDA_FIELDS = new Set([
  'data_visita',
  'agendada_para',
  'objetivo',
  'observacoes',
  'recomendacoes',
  'clima',
  'proximaVisita',
  'tecnico_responsavel',
  'responsavel_usuario_id',
  'fotos',
]);

const CORRECTABLE_FIELDS = new Set([
  'resumo_conclusao',
  'observacoes',
  'recomendacoes',
  'clima',
  'proximaVisita',
  'tecnico_responsavel',
  'responsavel_executante_usuario_id',
  'responsavel_executante_nome',
]);

const CONCLUSION_DETAIL_FIELDS = new Set([
  'observacoes',
  'recomendacoes',
  'clima',
  'proximaVisita',
  'fotos',
]);

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])
    ) as T;
  }
  return value;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const getFazendaId = (record: any): string =>
  normalizeText(record?.propriedade_id || record?.fazenda_id || record?.fazendaId || record?.produtor_id);

const normalizeVisitaLifecycleEvent = (event: unknown, recordPropertyId: string): any => {
  const cloned = cloneValue(event);
  if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) return cloned;

  const {
    propriedadeId,
    fazenda_id,
    fazendaId,
    produtor_id,
    ...canonicalEvent
  } = cloned as Record<string, unknown>;
  const propriedadeIdCanonico = normalizeText(
    canonicalEvent.propriedade_id
    || propriedadeId
    || fazenda_id
    || fazendaId
    || produtor_id
    || recordPropertyId
  );

  return {
    ...canonicalEvent,
    ...(propriedadeIdCanonico ? { propriedade_id: propriedadeIdCanonico } : {}),
  };
};

const getEvents = (record: any): any[] =>
  Array.isArray(record?.eventos_visita)
    ? record.eventos_visita.map((event) => normalizeVisitaLifecycleEvent(event, getFazendaId(record)))
    : [];

const getComplements = (record: any): any[] =>
  Array.isArray(record?.complementos_visita) ? cloneValue(record.complementos_visita) : [];

const normalizeIso = (value: unknown): string | null => {
  const timestamp = new Date(value as any).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

const normalizeVersion = (value: unknown, fallback = 1): number => {
  const version = Number(value);
  return Number.isInteger(version) && version >= 1 ? version : fallback;
};

const buildEventId = (recordId: string, sequence: number, type: string): string =>
  `${recordId || 'visita'}:${String(sequence).padStart(4, '0')}:${type}`;

const buildEvent = ({
  record,
  type,
  actor,
  now,
  versionBase,
  versionResult,
  idempotencyKey,
  details = {},
}: {
  record: any;
  type: string;
  actor: VisitaActor;
  now: string;
  versionBase: number;
  versionResult: number;
  idempotencyKey?: string;
  details?: Record<string, unknown>;
}) => {
  const sequence = getEvents(record).length + 1;
  return {
    evento_id: buildEventId(normalizeText(record?.id), sequence, type),
    visita_id: normalizeText(record?.id) || undefined,
    tipo: type,
    sequencia: sequence,
    estado_anterior: details.estado_anterior,
    estado_novo: details.estado_novo,
    autor_usuario_id: normalizeText(actor.usuarioId),
    autor_nome: normalizeText(actor.nome) || undefined,
    autor_perfil: normalizeText(actor.perfil),
    ocorrido_em: now,
    versao_base: versionBase,
    versao_resultante: versionResult,
    ...(normalizeText(idempotencyKey) ? { chave_idempotencia: normalizeText(idempotencyKey) } : {}),
    ...cloneValue(details),
    propriedade_id: getFazendaId(record),
  };
};

const assertActor = (actor: VisitaActor): void => {
  if (!normalizeText(actor?.usuarioId) || !normalizeText(actor?.perfil)) {
    throw new Error('Visita.autor: Usuário e perfil são obrigatórios para a operação.');
  }
};

const assertTeamActorInScope = (record: any, actor: VisitaActor): void => {
  assertActor(actor);
  if (actor.perfil === 'admin') return;
  if (actor.perfil !== 'colaborador') {
    throw new Error('Visita.comando: Operação permitida somente para equipe autorizada.');
  }

  const allowedIds = new Set(
    (Array.isArray(actor.propriedadeIds) ? actor.propriedadeIds : [])
      .map(normalizeText)
      .filter(Boolean)
  );
  if (!allowedIds.has(getFazendaId(record))) {
    throw new Error('Visita.comando: Propriedade fora do escopo informado.');
  }
};

const assertIdempotencyKey = (value: unknown): string => {
  const key = normalizeText(value);
  if (!key) throw new Error('Visita.idempotencia: Chave obrigatória para a operação.');
  return key;
};

const assertBaseVersion = (record: any, versionBase: number): number => {
  const current = normalizeVersion(record?.versao_atual);
  if (!Number.isInteger(versionBase) || versionBase !== current) {
    throw new Error(`Visita.conflito: Versão atual ${current}; recarregue antes de continuar.`);
  }
  return current;
};

const assertState = (record: any, expected: VisitaEstado, command: string): void => {
  const state = getVisitaEstado(record);
  if (state !== expected) {
    throw new Error(`Visita.estado: ${command} indisponível a partir de ${state || 'estado não reconhecido'}.`);
  }
};

const findIdempotentResult = (record: any, key: string): any | null =>
  getEvents(record).some((event) => normalizeText(event?.chave_idempotencia) === key)
    ? cloneValue(record)
    : null;

const hasChanged = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before) !== JSON.stringify(after);

const applyAllowedChanges = (
  record: any,
  changes: Record<string, unknown>,
  allowedFields: Set<string>,
  context: 'agendamento' | 'conclusao' | 'correcao'
): { next: any; before: Record<string, unknown>; after: Record<string, unknown> } => {
  const entries = Object.entries(changes || {});
  if (entries.length === 0) {
    throw new Error(`Visita.${context}: Informe ao menos um campo para alterar.`);
  }
  const forbidden = entries.map(([key]) => key).filter((key) => !allowedFields.has(key));
  if (forbidden.length > 0) {
    throw new Error(`Visita.${context}: Campos não permitidos: ${forbidden.join(', ')}.`);
  }

  const next = cloneValue(record);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  entries.forEach(([key, value]) => {
    if (!hasChanged(next[key], value)) return;
    before[key] = cloneValue(next[key]);
    after[key] = cloneValue(value);
    if (value === undefined) delete next[key];
    else next[key] = cloneValue(value);
  });
  if (Object.keys(after).length === 0) {
    throw new Error(`Visita.${context}: Os valores informados já estão vigentes.`);
  }
  return { next, before, after };
};

export const getVisitaEstado = (record: any): VisitaEstado | null => {
  const state = normalizeText(record?.status).toLocaleLowerCase('pt-BR');
  return VISITA_ESTADOS.includes(state as VisitaEstado) ? state as VisitaEstado : null;
};

export const isVisitaLegacy = (record: any): boolean => record?.registro_legado === true;

export const withVisitaLifecycleReadCompat = (record: any): any => {
  const state = getVisitaEstado(record);
  const hasLifecycle = Number.isInteger(Number(record?.versao_atual))
    && Array.isArray(record?.eventos_visita);

  return {
    ...cloneValue(record),
    status: state || record?.status,
    versao_atual: normalizeVersion(record?.versao_atual),
    eventos_visita: getEvents(record),
    complementos_visita: getComplements(record),
    registro_legado: hasLifecycle ? record?.registro_legado === true : true,
    ...(state ? {} : { estado_visita_reconciliacao: true }),
  };
};

export const getVisitaCancelamentoMotivoLabel = (value?: unknown): string =>
  VISITA_CANCELAMENTO_MOTIVOS.find((item) => item.value === value)?.label || 'Motivo não informado';

export const getVisitaEventLabel = (type?: unknown): string => {
  const labels: Record<string, string> = {
    visita_agendada: 'Visita agendada',
    visita_realizada_registrada: 'Visita realizada registrada',
    nova_visita_vinculada: 'Nova Visita vinculada',
    agendamento_alterado: 'Agendamento alterado',
    visita_concluida: 'Visita concluída',
    visita_cancelada: 'Visita cancelada',
    visita_complementada: 'Complemento adicionado',
    visita_corrigida: 'Correção registrada',
    visita_anulada: 'Visita anulada',
  };
  return labels[normalizeText(type)] || 'Evento da Visita';
};

export const createVisitaLifecycleRecord = ({
  id,
  data,
  actor,
  now = new Date().toISOString(),
  idempotencyKey,
}: {
  id: string;
  data: any;
  actor: VisitaActor;
  now?: string;
  idempotencyKey: string;
}): any => {
  assertTeamActorInScope(data, actor);
  const key = assertIdempotencyKey(idempotencyKey);
  const providedState = normalizeText(data?.status).toLocaleLowerCase('pt-BR');
  const recognizedState = getVisitaEstado(data);
  if (providedState && !recognizedState) {
    throw new Error(`Visita.criacao: Estado inicial não reconhecido: ${providedState}.`);
  }
  const state = recognizedState || 'agendada';
  if (!['agendada', 'realizada'].includes(state)) {
    throw new Error('Visita.criacao: O estado inicial deve ser agendada ou realizada.');
  }
  const scheduledOrStartedAt = normalizeIso(data?.data_visita);
  if (!scheduledOrStartedAt) throw new Error('Visita.data: Informe data e horário válidos.');
  const nowTimestamp = new Date(now).getTime();
  const visitTimestamp = new Date(scheduledOrStartedAt).getTime();
  if (state === 'agendada' && visitTimestamp <= nowTimestamp) {
    throw new Error('Visita.agendamento: A data e hora devem ser futuras.');
  }

  const summary = normalizeText(data?.resumo_conclusao || data?.observacoes);
  if (state === 'realizada') {
    if (visitTimestamp > nowTimestamp) {
      throw new Error('Visita.conclusao: O início real não pode estar no futuro.');
    }
    if (!summary) throw new Error('Visita.conclusao: Informe o resumo operacional.');
  }

  const base = {
    ...cloneValue(data),
    id,
    status: state,
    fazenda_id: getFazendaId(data),
    criada_por_usuario_id: normalizeText(actor.usuarioId),
    criada_por_nome: normalizeText(actor.nome) || undefined,
    criada_em: now,
    versao_atual: 1,
    registro_legado: false,
    eventos_visita: [],
    complementos_visita: [],
    ...(state === 'agendada'
      ? { agendada_para: scheduledOrStartedAt }
      : {
        inicio_real_em: scheduledOrStartedAt,
        concluida_em: now,
        concluida_por_usuario_id: normalizeText(actor.usuarioId),
        concluida_por_nome: normalizeText(actor.nome) || undefined,
        resumo_conclusao: summary,
      }),
  };
  const eventType = state === 'agendada' ? 'visita_agendada' : 'visita_realizada_registrada';
  const event = buildEvent({
    record: base,
    type: eventType,
    actor,
    now,
    versionBase: 0,
    versionResult: 1,
    idempotencyKey: key,
    details: { estado_anterior: null, estado_novo: state },
  });
  const originId = normalizeText(data?.visita_origem_id);
  const linkedEvent = originId
    ? buildEvent({
      record: { ...base, eventos_visita: [event] },
      type: 'nova_visita_vinculada',
      actor,
      now,
      versionBase: 0,
      versionResult: 1,
      details: { visita_origem_id: originId },
    })
    : null;
  return { ...base, eventos_visita: linkedEvent ? [event, linkedEvent] : [event] };
};

export const applyVisitaCommand = ({
  record: rawRecord,
  command,
  actor,
  now = new Date().toISOString(),
}: {
  record: any;
  command: VisitaCommand;
  actor: VisitaActor;
  now?: string;
}): any => {
  const record = withVisitaLifecycleReadCompat(rawRecord);
  assertTeamActorInScope(record, actor);
  const key = assertIdempotencyKey(command.chaveIdempotencia);
  const idempotent = findIdempotentResult(record, key);
  if (idempotent) return idempotent;
  const currentVersion = assertBaseVersion(record, command.versaoBase);
  const nextVersion = currentVersion + 1;

  if (command.tipo === 'alterar_agendamento') {
    assertState(record, 'agendada', 'Alteração de agendamento');
    const normalizedChanges = { ...cloneValue(command.alteracoes) };
    if (Object.prototype.hasOwnProperty.call(normalizedChanges, 'agendada_para')) {
      normalizedChanges.data_visita = normalizedChanges.agendada_para;
      delete normalizedChanges.agendada_para;
    }
    const { next: changed, before, after } = applyAllowedChanges(
      record,
      normalizedChanges,
      AGENDA_FIELDS,
      'agendamento'
    );
    const schedulingChanged = Object.prototype.hasOwnProperty.call(after, 'data_visita');
    const responsibleChanged = Object.prototype.hasOwnProperty.call(after, 'tecnico_responsavel')
      || Object.prototype.hasOwnProperty.call(after, 'responsavel_usuario_id');
    const reason = normalizeText(command.motivo);
    if ((schedulingChanged || responsibleChanged) && !reason) {
      throw new Error('Visita.reagendamento: Informe o motivo da mudança de data, hora ou responsável.');
    }
    if (schedulingChanged) {
      const scheduledAt = normalizeIso(after.data_visita);
      if (!scheduledAt || new Date(scheduledAt).getTime() <= new Date(now).getTime()) {
        throw new Error('Visita.reagendamento: A nova data e hora devem ser futuras.');
      }
      changed.data_visita = scheduledAt;
      changed.agendada_para = scheduledAt;
      after.data_visita = scheduledAt;
    }
    const next = { ...changed, status: 'agendada', versao_atual: nextVersion };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'agendamento_alterado',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: { antes: before, depois: after, ...(reason ? { motivo: reason } : {}) },
        }),
      ],
    };
  }

  if (command.tipo === 'concluir') {
    assertState(record, 'agendada', 'Conclusão');
    const startedAt = normalizeIso(command.inicioRealEm);
    if (!startedAt || new Date(startedAt).getTime() > new Date(now).getTime()) {
      throw new Error('Visita.conclusao: O início real deve ser válido e não pode estar no futuro.');
    }
    const summary = normalizeText(command.resumo);
    if (!summary) throw new Error('Visita.conclusao: Informe o resumo operacional.');
    const conclusionDetails = cloneValue(command.detalhes || {});
    const forbiddenDetails = Object.keys(conclusionDetails).filter(
      (field) => !CONCLUSION_DETAIL_FIELDS.has(field)
    );
    if (forbiddenDetails.length > 0) {
      throw new Error(`Visita.conclusao: Campos não permitidos: ${forbiddenDetails.join(', ')}.`);
    }
    const actualDetails = Object.fromEntries(
      Object.entries(conclusionDetails).filter(([field, value]) => hasChanged(record[field], value))
    );
    const detailChanges = Object.keys(actualDetails).length > 0
      ? applyAllowedChanges(record, actualDetails, CONCLUSION_DETAIL_FIELDS, 'conclusao')
      : { next: cloneValue(record), before: {}, after: {} };
    const next = {
      ...detailChanges.next,
      status: 'realizada',
      inicio_real_em: startedAt,
      concluida_em: now,
      concluida_por_usuario_id: normalizeText(actor.usuarioId),
      concluida_por_nome: normalizeText(actor.nome) || undefined,
      responsavel_executante_usuario_id: normalizeText(command.responsavelExecutanteUsuarioId) || undefined,
      responsavel_executante_nome: normalizeText(command.responsavelExecutanteNome)
        || normalizeText(record.tecnico_responsavel)
        || undefined,
      resumo_conclusao: summary,
      versao_atual: nextVersion,
    };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visita_concluida',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: {
            estado_anterior: 'agendada',
            estado_novo: 'realizada',
            inicio_real_em: startedAt,
            resumo_conclusao: summary,
            ...(Object.keys(detailChanges.after).length > 0
              ? { antes: detailChanges.before, depois: detailChanges.after }
              : {}),
          },
        }),
      ],
    };
  }

  if (command.tipo === 'cancelar') {
    assertState(record, 'agendada', 'Cancelamento');
    const validReason = VISITA_CANCELAMENTO_MOTIVOS.some((item) => item.value === command.motivoCodigo);
    if (!validReason) throw new Error('Visita.cancelamento: Selecione um motivo válido.');
    const description = normalizeText(command.motivoDescricao);
    if (command.motivoCodigo === 'outro' && !description) {
      throw new Error('Visita.cancelamento: Descreva o outro motivo.');
    }
    const next = {
      ...record,
      status: 'cancelada',
      cancelamento_motivo_codigo: command.motivoCodigo,
      cancelamento_motivo_descricao: description || undefined,
      cancelada_em: now,
      cancelada_por_usuario_id: normalizeText(actor.usuarioId),
      cancelada_por_nome: normalizeText(actor.nome) || undefined,
      versao_atual: nextVersion,
    };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visita_cancelada',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: {
            estado_anterior: 'agendada',
            estado_novo: 'cancelada',
            motivo_codigo: command.motivoCodigo,
            ...(description ? { motivo: description } : {}),
          },
        }),
      ],
    };
  }

  if (command.tipo === 'adicionar_complemento') {
    assertState(record, 'realizada', 'Complemento');
    const text = normalizeText(command.texto);
    if (!text) throw new Error('Visita.complemento: Informe o conteúdo técnico.');
    const complementSequence = getComplements(record).length + 1;
    const complement = {
      complemento_id: buildEventId(normalizeText(record.id), complementSequence, 'complemento'),
      visita_id: record.id,
      texto: text,
      autor_usuario_id: normalizeText(actor.usuarioId),
      autor_nome: normalizeText(actor.nome) || undefined,
      criado_em: now,
      visivel_para_produtor: command.visivelParaProdutor === true,
      sequencia: complementSequence,
    };
    const next = {
      ...record,
      versao_atual: nextVersion,
      complementos_visita: [...getComplements(record), complement],
    };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visita_complementada',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: { complemento_id: complement.complemento_id },
        }),
      ],
    };
  }

  if (command.tipo === 'corrigir') {
    assertState(record, 'realizada', 'Correção');
    const reason = normalizeText(command.motivo);
    if (!reason) throw new Error('Visita.correcao: Motivo obrigatório.');
    const { next: corrected, before, after } = applyAllowedChanges(
      record,
      command.alteracoes,
      CORRECTABLE_FIELDS,
      'correcao'
    );
    const next = { ...corrected, status: 'realizada', versao_atual: nextVersion };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visita_corrigida',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: { motivo: reason, antes: before, depois: after },
        }),
      ],
    };
  }

  if (command.tipo === 'anular') {
    assertState(record, 'realizada', 'Anulação');
    const reason = normalizeText(command.motivo);
    if (!reason) throw new Error('Visita.anulacao: Justificativa obrigatória.');
    const next = {
      ...record,
      status: 'anulada',
      anulada_em: now,
      anulada_por_usuario_id: normalizeText(actor.usuarioId),
      anulada_por_nome: normalizeText(actor.nome) || undefined,
      anulacao_motivo: reason,
      versao_atual: nextVersion,
    };
    return {
      ...next,
      eventos_visita: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visita_anulada',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          idempotencyKey: key,
          details: { estado_anterior: 'realizada', estado_novo: 'anulada', motivo: reason },
        }),
      ],
    };
  }

  throw new Error(`Visita.comando: Comando não reconhecido: ${normalizeText((command as any)?.tipo)}.`);
};

export const toVisitaProducerProjection = (record: any): any => {
  const normalized = withVisitaLifecycleReadCompat(record);
  const projection = {
    ...normalized,
    complementos_visita: getComplements(normalized)
      .filter((item) => item?.visivel_para_produtor === true)
      .map((item) => ({
        complemento_id: item.complemento_id,
        texto: item.texto,
        autor_nome: item.autor_nome,
        criado_em: item.criado_em,
      })),
  };
  [
    'eventos_visita',
    'versao_atual',
    'registro_legado',
    'estado_visita_reconciliacao',
    'criada_por_usuario_id',
    'concluida_por_usuario_id',
    'cancelada_por_usuario_id',
    'anulada_por_usuario_id',
    'responsavel_usuario_id',
    'responsavel_executante_usuario_id',
  ].forEach((key) => delete projection[key]);
  return projection;
};

export const buildVisitaIdempotencyKey = (visitaId: unknown, command: string): string =>
  `${normalizeText(visitaId) || 'nova'}:${normalizeText(command) || 'comando'}:${Date.now()}`;
