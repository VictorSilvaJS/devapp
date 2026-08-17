import {
  CADERNO_LOCALIZACAO_ALL_KEYS,
  clearCadernoLocalizacaoBundleFields,
  validateCadernoLocalizacao,
} from './cadernoLocalizacaoCompat';

export const CADERNO_ESTADOS = [
  'rascunho',
  'registrado',
  'registrado_legado',
  'arquivado',
  'anulado',
] as const;

export type CadernoEstado = typeof CADERNO_ESTADOS[number];

export type CadernoActor = {
  usuarioId: string;
  nome?: string;
  perfil: 'admin' | 'colaborador' | 'produtor' | string;
  propriedadeIds?: string[];
};

export type CadernoCommand =
  | {
    tipo: 'corrigir';
    versaoBase: number;
    motivo: string;
    alteracoes: Record<string, unknown>;
  }
  | {
    tipo: 'alterar_visibilidade';
    versaoBase: number;
    visivelParaProdutor: boolean;
    motivo?: string;
  }
  | {
    tipo: 'arquivar' | 'reativar' | 'anular';
    versaoBase: number;
    motivo: string;
  };

export type CadernoValidationErrors = Record<string, string>;

const ORIGINAL_FIELDS = [
  'propriedade_id',
  'responsavel_usuario_id',
  'colaborador_responsavel',
  'data_atividade',
  'tipo_atividade',
  'talhao_id',
  'talhaoId',
  'talhao_nome',
  'talhao',
  'periodo_produtivo_id',
  'periodoProdutivoId',
  'periodo_produtivo_label',
  'tipo_periodo',
  'cultura_periodo',
  'ano_agricola',
  'operacao',
  'produtos_utilizados',
  'dosagem',
  'area_aplicada',
  'produtividade',
  'condicoes_clima',
  'observacoes',
  'fotos',
  'visivel_para_produtor',
  ...CADERNO_LOCALIZACAO_ALL_KEYS,
] as const;

const CORRECTABLE_FIELDS = new Set<string>([
  'responsavel_usuario_id',
  'colaborador_responsavel',
  'data_atividade',
  'tipo_atividade',
  'talhao_id',
  'talhaoId',
  'talhao_nome',
  'talhao',
  'periodo_produtivo_id',
  'periodoProdutivoId',
  'periodo_produtivo_label',
  'tipo_periodo',
  'cultura_periodo',
  'ano_agricola',
  'operacao',
  'produtos_utilizados',
  'dosagem',
  'area_aplicada',
  'produtividade',
  'condicoes_clima',
  'observacoes',
  'fotos',
  ...CADERNO_LOCALIZACAO_ALL_KEYS,
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

const hasOwn = (value: unknown, key: string): boolean =>
  Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));

const getFazendaId = (record: any): string =>
  normalizeText(record?.propriedade_id || record?.fazenda_id || record?.fazendaId || record?.produtor_id);

const getCreatorId = (record: any): string =>
  normalizeText(record?.criado_por_user_id || record?.criado_por);

const normalizeCadernoLifecycleEvent = (event: unknown, recordPropertyId: string): any => {
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
  Array.isArray(record?.eventos_caderno)
    ? record.eventos_caderno.map((event) => normalizeCadernoLifecycleEvent(event, getFazendaId(record)))
    : [];

const getComplements = (record: any): any[] =>
  Array.isArray(record?.complementos_caderno) ? cloneValue(record.complementos_caderno) : [];

const buildId = (recordId: string, sequence: number, type: string): string =>
  `${recordId}:${String(sequence).padStart(4, '0')}:${type}`;

const buildEvent = ({
  record,
  type,
  actor,
  now,
  versionBase,
  versionResult,
  details = {},
}: {
  record: any;
  type: string;
  actor: CadernoActor;
  now: string;
  versionBase?: number;
  versionResult?: number;
  details?: Record<string, unknown>;
}) => {
  const sequence = getEvents(record).length + 1;
  return {
    evento_id: buildId(normalizeText(record?.id) || 'caderno', sequence, type),
    registro_id: normalizeText(record?.id) || undefined,
    tipo: type,
    sequencia: sequence,
    autor_usuario_id: normalizeText(actor.usuarioId),
    autor_nome: normalizeText(actor.nome) || undefined,
    autor_perfil: normalizeText(actor.perfil),
    ocorrido_em: now,
    ...(versionBase !== undefined ? { versao_base: versionBase } : {}),
    ...(versionResult !== undefined ? { versao_resultante: versionResult } : {}),
    ...cloneValue(details),
    propriedade_id: getFazendaId(record),
  };
};

const assertActor = (actor: CadernoActor): void => {
  if (!normalizeText(actor?.usuarioId) || !normalizeText(actor?.perfil)) {
    throw new Error('CadernoCampo.autor: Usuário e perfil são obrigatórios para a operação.');
  }
};

const assertTeamActorInScope = (record: any, actor: CadernoActor): void => {
  assertActor(actor);
  if (actor.perfil === 'admin') return;
  if (actor.perfil !== 'colaborador') {
    throw new Error('CadernoCampo.comando: Operação permitida somente para equipe autorizada.');
  }

  const allowedIds = new Set(
    (Array.isArray(actor.propriedadeIds) ? actor.propriedadeIds : [])
      .map(normalizeText)
      .filter(Boolean)
  );
  if (!allowedIds.has(getFazendaId(record))) {
    throw new Error('CadernoCampo.comando: Propriedade fora do escopo informado.');
  }
};

const assertBaseVersion = (record: any, versionBase: number): number => {
  const currentVersion = Number(record?.versao_atual);
  const normalizedCurrent = Number.isInteger(currentVersion) && currentVersion >= 1
    ? currentVersion
    : 1;
  if (!Number.isInteger(versionBase) || versionBase !== normalizedCurrent) {
    throw new Error(`CadernoCampo.conflito: Versão atual ${normalizedCurrent}; recarregue antes de continuar.`);
  }
  return normalizedCurrent;
};

const assertRegisteredForEvent = (record: any): void => {
  const state = getCadernoEstado(record);
  if (state !== 'registrado') {
    throw new Error(`CadernoCampo.estado: Comando indisponível para registro ${state}.`);
  }
};

export const getCadernoEstado = (record: any): CadernoEstado => {
  const explicit = normalizeText(record?.estado_caderno);
  return CADERNO_ESTADOS.includes(explicit as CadernoEstado)
    ? explicit as CadernoEstado
    : 'registrado_legado';
};

export const getCadernoEstadoLabel = (record: any): string => {
  const labels: Record<CadernoEstado, string> = {
    rascunho: 'Rascunho',
    registrado: 'Registrado',
    registrado_legado: 'Registro legado',
    arquivado: 'Arquivado',
    anulado: 'Anulado',
  };
  return labels[getCadernoEstado(record)];
};

export const isCadernoDraft = (record: any): boolean => getCadernoEstado(record) === 'rascunho';

export const isCadernoDraftOwner = (record: any, userId?: unknown): boolean =>
  isCadernoDraft(record)
  && Boolean(getCreatorId(record))
  && getCreatorId(record) === normalizeText(userId);

export const isCadernoOperational = (record: any): boolean => {
  const state = getCadernoEstado(record);
  return state === 'registrado' || state === 'registrado_legado' || state === 'anulado';
};

export const buildCadernoOriginalSnapshot = (record: any): Record<string, unknown> => {
  const snapshot = ORIGINAL_FIELDS.reduce<Record<string, unknown>>((result, key) => {
    if (hasOwn(record, key) && record[key] !== undefined) {
      result[key] = cloneValue(record[key]);
    }
    return result;
  }, {});
  const propriedadeId = getFazendaId(record);
  if (propriedadeId) snapshot.propriedade_id = propriedadeId;
  return snapshot;
};

export const withCadernoLifecycleReadCompat = (record: any): any => {
  const state = getCadernoEstado(record);
  if (state !== 'registrado_legado') {
    return {
      ...cloneValue(record),
      estado_caderno: state,
      versao_atual: Number.isInteger(Number(record?.versao_atual))
        ? Number(record.versao_atual)
        : state === 'rascunho' ? 0 : 1,
      eventos_caderno: getEvents(record),
      complementos_caderno: getComplements(record),
    };
  }

  return {
    ...cloneValue(record),
    estado_caderno: 'registrado_legado',
    versao_atual: 1,
    conteudo_original: buildCadernoOriginalSnapshot(record),
    eventos_caderno: [],
    complementos_caderno: [],
    registro_legado: true,
  };
};

export const getCadernoTypeValidationErrors = (record: any): CadernoValidationErrors => {
  const errors: CadernoValidationErrors = {};
  const type = normalizeText(record?.tipo_atividade);
  const talhaoId = normalizeText(record?.talhao_id || record?.talhaoId);
  const periodoId = normalizeText(record?.periodo_produtivo_id || record?.periodoProdutivoId);
  const observation = normalizeText(record?.observacoes);
  const operation = normalizeText(record?.operacao);
  const dosage = normalizeText(record?.dosagem);
  const products = Array.isArray(record?.produtos_utilizados)
    ? record.produtos_utilizados.map(normalizeText).filter(Boolean)
    : [];
  const area = Number(record?.area_aplicada);
  const productivity = Number(record?.produtividade);

  if (['observacao', 'ocorrencia', 'outro'].includes(type) && !observation) {
    errors.observacoes = type === 'ocorrencia'
      ? 'Descreva a ocorrência'
      : 'Descreva o registro';
  }

  if (type === 'plantio') {
    if (!talhaoId) errors.talhaoId = 'Selecione um Talhão com referência estável';
    if (!periodoId) errors.periodoProdutivoId = 'Selecione a Safra/Safrinha do plantio';
    if (!operation) errors.operacao = 'Informe a operação de plantio';
  }

  if (type === 'aplicacao') {
    if (!talhaoId) errors.talhaoId = 'Selecione um Talhão com referência estável';
    if (products.length === 0) errors.produtos = 'Informe ao menos um produto';
    if (!dosage) errors.dosagem = 'Informe a dose aplicada';
    if (!Number.isFinite(area) || area <= 0) errors.areaAplicada = 'Informe a área aplicada';
  }

  if (type === 'colheita') {
    if (!talhaoId) errors.talhaoId = 'Selecione um Talhão com referência estável';
    if (!periodoId) errors.periodoProdutivoId = 'Selecione a Safra/Safrinha da colheita';
    if (!Number.isFinite(area) || area <= 0) errors.areaAplicada = 'Informe a área colhida';
    if (!Number.isFinite(productivity) || productivity <= 0) {
      errors.produtividade = 'Informe a produtividade obtida';
    }
  }

  return errors;
};

export const assertCadernoReadyToSubmit = (record: any): void => {
  const errors: CadernoValidationErrors = {};
  if (!getFazendaId(record)) errors.fazendaId = 'Selecione uma Propriedade';
  if (!normalizeText(record?.data_atividade)) errors.dataAtividade = 'Selecione a data da atividade';
  if (!normalizeText(record?.tipo_atividade)) errors.tipoAtividade = 'Selecione o tipo de registro';
  if (!normalizeText(record?.responsavel_usuario_id)) {
    errors.responsavel = 'O responsável precisa estar vinculado por ID';
  }
  Object.assign(errors, getCadernoTypeValidationErrors(record));
  const entries = Object.entries(errors);
  if (entries.length > 0) {
    throw new Error(`CadernoCampo.requisitos: ${entries.map(([, message]) => message).join('; ')}`);
  }
};

export const createCadernoDraft = ({
  id,
  data,
  actor,
  now = new Date().toISOString(),
}: {
  id: string;
  data: any;
  actor: CadernoActor;
  now?: string;
}): any => {
  assertActor(actor);
  const record = {
    ...cloneValue(data),
    id,
    estado_caderno: 'rascunho',
    versao_atual: 0,
    criado_por_user_id: normalizeText(actor.usuarioId),
    criado_por: normalizeText(actor.usuarioId),
    criado_por_nome: normalizeText(actor.nome) || data?.criado_por_nome,
    origem_registro: actor.perfil === 'produtor' ? 'produtor' : 'equipe',
    data_criacao: data?.data_criacao || now,
    conteudo_original: undefined,
    complementos_caderno: [],
    eventos_caderno: [],
  };
  return {
    ...record,
    eventos_caderno: [buildEvent({ record, type: 'rascunho_criado', actor, now })],
  };
};

export const updateCadernoDraft = ({
  record,
  data,
  actor,
  replaceLocationGroup = false,
  now = new Date().toISOString(),
}: {
  record: any;
  data: any;
  actor: CadernoActor;
  replaceLocationGroup?: boolean;
  now?: string;
}): any => {
  assertActor(actor);
  if (!isCadernoDraft(record)) {
    throw new Error('CadernoCampo.update: Registro consolidado não aceita edição destrutiva.');
  }
  if (!isCadernoDraftOwner(record, actor.usuarioId)) {
    throw new Error('CadernoCampo.rascunho: Somente o criador pode editar este rascunho.');
  }
  const originalFazendaId = getFazendaId(record);
  const attemptedFazendaId = getFazendaId(data);
  if (attemptedFazendaId && attemptedFazendaId !== originalFazendaId) {
    throw new Error('CadernoCampo.rascunho: A Propriedade do rascunho não pode ser reatribuída.');
  }
  const sanitized = { ...cloneValue(data) };
  [
    'id', 'estado_caderno', 'versao_atual', 'conteudo_original', 'eventos_caderno',
    'complementos_caderno', 'criado_por_user_id', 'criado_por', 'criado_por_nome',
    'origem_registro', 'registrado_em', 'registrado_por_usuario_id',
  ].forEach((key) => delete sanitized[key]);
  const currentBase = replaceLocationGroup
    ? clearCadernoLocalizacaoBundleFields(cloneValue(record))
    : cloneValue(record);
  const next = {
    ...currentBase,
    ...sanitized,
    id: record.id,
    fazenda_id: originalFazendaId,
    fazendaId: originalFazendaId,
  };
  return {
    ...next,
    eventos_caderno: [
      ...getEvents(record),
      buildEvent({ record: next, type: 'rascunho_atualizado', actor, now }),
    ],
  };
};

export const submitCadernoRecord = ({
  record,
  actor,
  now = new Date().toISOString(),
}: {
  record: any;
  actor: CadernoActor;
  now?: string;
}): any => {
  assertActor(actor);
  if (!isCadernoDraft(record)) {
    throw new Error('CadernoCampo.envio: Somente rascunho pode ser enviado.');
  }
  if (!isCadernoDraftOwner(record, actor.usuarioId)) {
    throw new Error('CadernoCampo.rascunho: Somente o criador pode enviar este rascunho.');
  }
  assertCadernoReadyToSubmit(record);
  const next = {
    ...cloneValue(record),
    estado_caderno: 'registrado',
    versao_atual: 1,
    registrado_em: now,
    registrado_por_usuario_id: normalizeText(actor.usuarioId),
    registrado_por_nome: normalizeText(actor.nome) || undefined,
    conteudo_original: buildCadernoOriginalSnapshot(record),
  };
  return {
    ...next,
    eventos_caderno: [
      ...getEvents(record),
      buildEvent({
        record: next,
        type: 'registro_enviado',
        actor,
        now,
        versionBase: 0,
        versionResult: 1,
      }),
    ],
  };
};

const applyCorrection = (record: any, changes: Record<string, unknown>): {
  next: any;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} => {
  const entries = Object.entries(changes || {});
  if (entries.length === 0) {
    throw new Error('CadernoCampo.correcao: Informe ao menos um campo para corrigir.');
  }
  const forbidden = entries.map(([key]) => key).filter((key) => !CORRECTABLE_FIELDS.has(key));
  if (forbidden.length > 0) {
    throw new Error(`CadernoCampo.correcao: Campos não permitidos: ${forbidden.join(', ')}.`);
  }

  const locationTouched = entries.some(([key]) => (CADERNO_LOCALIZACAO_ALL_KEYS as readonly string[]).includes(key));
  if (locationTouched) {
    const locationResult = validateCadernoLocalizacao(changes);
    if (locationResult.valid === false || locationResult.status !== 'valid') {
      throw new Error('CadernoCampo.correcao: A localização deve ser enviada como grupo integral válido.');
    }
  }

  let next = cloneValue(record);
  if (locationTouched) next = clearCadernoLocalizacaoBundleFields(next);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  entries.forEach(([key, value]) => {
    if (JSON.stringify(next[key]) === JSON.stringify(value)) return;
    before[key] = cloneValue(next[key]);
    after[key] = cloneValue(value);
    if (value === undefined) delete next[key];
    else next[key] = cloneValue(value);
  });
  if (Object.keys(after).length === 0) {
    throw new Error('CadernoCampo.correcao: A correção não altera o valor vigente.');
  }
  assertCadernoReadyToSubmit(next);
  return { next, before, after };
};

export const applyCadernoCommand = ({
  record: rawRecord,
  command,
  actor,
  now = new Date().toISOString(),
}: {
  record: any;
  command: CadernoCommand;
  actor: CadernoActor;
  now?: string;
}): any => {
  const record = withCadernoLifecycleReadCompat(rawRecord);
  assertTeamActorInScope(record, actor);
  const currentVersion = assertBaseVersion(record, command.versaoBase);
  const nextVersion = currentVersion + 1;

  if (command.tipo === 'corrigir') {
    assertRegisteredForEvent(record);
    const reason = normalizeText(command.motivo);
    if (!reason) throw new Error('CadernoCampo.correcao: Motivo obrigatório.');
    const { next: corrected, before, after } = applyCorrection(record, command.alteracoes);
    const next = { ...corrected, versao_atual: nextVersion };
    return {
      ...next,
      eventos_caderno: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'correcao_aplicada',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          details: { motivo: reason, antes: before, depois: after },
        }),
      ],
    };
  }

  if (command.tipo === 'alterar_visibilidade') {
    const state = getCadernoEstado(record);
    if (!['registrado', 'arquivado'].includes(state)) {
      throw new Error(`CadernoCampo.estado: Visibilidade indisponível para registro ${state}.`);
    }
    const before = record.visivel_para_produtor !== false;
    const after = command.visivelParaProdutor === true;
    if (before === after) {
      throw new Error('CadernoCampo.visibilidade: O valor informado já está vigente.');
    }
    const next = { ...record, visivel_para_produtor: after, versao_atual: nextVersion };
    return {
      ...next,
      eventos_caderno: [
        ...getEvents(record),
        buildEvent({
          record: next,
          type: 'visibilidade_alterada',
          actor,
          now,
          versionBase: currentVersion,
          versionResult: nextVersion,
          details: {
            antes: before,
            depois: after,
            ...(normalizeText(command.motivo) ? { motivo: normalizeText(command.motivo) } : {}),
          },
        }),
      ],
    };
  }

  const reason = normalizeText(command.motivo);
  if (!reason) throw new Error('CadernoCampo.transicao: Justificativa obrigatória.');
  const state = getCadernoEstado(record);
  const allowed = command.tipo === 'arquivar'
    ? state === 'registrado'
    : command.tipo === 'reativar'
      ? state === 'arquivado'
      : state === 'registrado' || state === 'arquivado';
  if (!allowed) {
    throw new Error(`CadernoCampo.estado: Transição ${command.tipo} indisponível a partir de ${state}.`);
  }
  const nextState: CadernoEstado = command.tipo === 'arquivar'
    ? 'arquivado'
    : command.tipo === 'reativar'
      ? 'registrado'
      : 'anulado';
  const eventType = command.tipo === 'arquivar'
    ? 'registro_arquivado'
    : command.tipo === 'reativar'
      ? 'registro_reativado'
      : 'registro_anulado';
  const next = { ...record, estado_caderno: nextState, versao_atual: nextVersion };
  return {
    ...next,
    eventos_caderno: [
      ...getEvents(record),
      buildEvent({
        record: next,
        type: eventType,
        actor,
        now,
        versionBase: currentVersion,
        versionResult: nextVersion,
        details: { motivo: reason },
      }),
    ],
  };
};

export const toCadernoProducerProjection = (record: any): any => {
  const normalized = withCadernoLifecycleReadCompat(record);
  const complements = getComplements(normalized)
    .filter((item) => item?.visivel_para_produtor === true)
    .map((item) => ({
      complemento_id: item.complemento_id,
      texto: item.texto,
      autor_nome: item.autor_nome,
      criado_em: item.criado_em,
    }));
  const projection = {
    ...normalized,
    complementos_caderno: complements,
  };
  [
    'eventos_caderno',
    'conteudo_original',
    'registrado_por_usuario_id',
    'criado_por_user_id',
    'criado_por',
    'responsavel_usuario_id',
    'colaborador_responsavel_id',
    'localizacao_captured_by',
    'localizacao_distancia_talhao_m',
    'localizacao_tolerancia_talhao_m',
    'talhao_geometria_versao_id',
    'talhao_geometria_fonte',
    'talhao_geometria_ano',
    'versao_atual',
    'registro_legado',
  ].forEach((key) => delete projection[key]);
  return projection;
};
