import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PERIODO_PRODUTIVO_REGISTRO_STATUSES,
  PERIODO_PRODUTIVO_STATUSES,
  PERIODO_PRODUTIVO_STORAGE_KEY,
  PERIODO_PRODUTIVO_TIPOS,
  PERIODO_PRODUTIVO_VERSION,
  PeriodoProdutivoMetadata,
  PeriodoProdutivoMetadataInput,
  PeriodoProdutivoMetadataPatch,
  PeriodoProdutivoRegistroStatus,
  PeriodoProdutivoStatus,
  PeriodoProdutivoTipo,
} from '../types/periodoProdutivo';
import { isPeriodoProdutivoAnoAgricolaValido } from '../utils/periodoProdutivoFormCompat';

export { PERIODO_PRODUTIVO_STORAGE_KEY } from '../types/periodoProdutivo';

interface PeriodoProdutivoSnapshot {
  version: number;
  savedAt: string;
  items: PeriodoProdutivoMetadata[];
}

export interface PeriodoProdutivoStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface PeriodoProdutivoServiceDeps {
  storage?: PeriodoProdutivoStorageAdapter;
  now?: () => string;
  generateId?: () => string;
}

const asyncStorageAdapter: PeriodoProdutivoStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const FORBIDDEN_RAW_CONTENT_KEYS = [
  'geojson',
  'feature',
  'features',
  'coordinates',
  'coordinate',
  'poligono',
  'polygon',
  'png',
  'zip',
  'base64',
  'bytes',
  'binary',
  'binario',
  'blob',
  'buffer',
  'arquivo',
  'file',
  'raw',
  'content',
  'conteudo',
  'asset',
  'source',
  'require',
];

const MAX_METADATA_STRING_LENGTH = 4096;

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }

  return '';
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  const normalized = firstNonEmptyString(value);
  return normalized || undefined;
};

const isPlainObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertSmallMetadataOnly = (input: Record<string, any>): void => {
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();

    if (FORBIDDEN_RAW_CONTENT_KEYS.some((forbidden) => normalizedKey.includes(forbidden))) {
      throw new Error(`PeriodoProdutivo.${key}: conteudo bruto nao deve ser salvo em metadados`);
    }

    if (typeof value === 'string' && value.length > MAX_METADATA_STRING_LENGTH) {
      throw new Error(`PeriodoProdutivo.${key}: metadado grande demais`);
    }

    if (Array.isArray(value) || isPlainObject(value) || typeof value === 'function') {
      throw new Error(`PeriodoProdutivo.${key}: metadado deve ser valor primitivo pequeno`);
    }
  }
};

const isPeriodoTipo = (value: unknown): value is PeriodoProdutivoTipo =>
  typeof value === 'string' && PERIODO_PRODUTIVO_TIPOS.includes(value as PeriodoProdutivoTipo);

const isPeriodoStatus = (value: unknown): value is PeriodoProdutivoStatus =>
  typeof value === 'string' && PERIODO_PRODUTIVO_STATUSES.includes(value as PeriodoProdutivoStatus);

const isRegistroStatus = (value: unknown): value is PeriodoProdutivoRegistroStatus =>
  typeof value === 'string'
  && PERIODO_PRODUTIVO_REGISTRO_STATUSES.includes(value as PeriodoProdutivoRegistroStatus);

const normalizeTipoPeriodo = (value: unknown): PeriodoProdutivoTipo => {
  if (isPeriodoTipo(value)) return value;
  throw new Error('PeriodoProdutivo.tipo_periodo: obrigatorio');
};

const normalizeStatus = (value: unknown): PeriodoProdutivoStatus => {
  if (isPeriodoStatus(value)) return value;
  throw new Error('PeriodoProdutivo.status: obrigatorio');
};

const normalizeRegistroStatus = (value: unknown): PeriodoProdutivoRegistroStatus =>
  isRegistroStatus(value) ? value : 'ativo';

const getTipoPeriodoLabel = (tipo: PeriodoProdutivoTipo): string =>
  tipo === 'safrinha' ? 'Safrinha' : 'Safra';

const resolvePropriedadeIds = (input: {
  propriedade_id?: unknown;
  propriedadeId?: unknown;
  fazenda_id?: unknown;
  fazendaId?: unknown;
}): { propriedade_id: string; propriedadeId: string; fazenda_id: string; fazendaId: string } => {
  const propriedadeId = firstNonEmptyString(
    input.propriedade_id,
    input.propriedadeId,
    input.fazenda_id,
    input.fazendaId
  );
  const fazendaId = firstNonEmptyString(
    input.fazenda_id,
    input.fazendaId,
    input.propriedade_id,
    input.propriedadeId
  );

  return {
    propriedade_id: propriedadeId,
    propriedadeId,
    fazenda_id: fazendaId,
    fazendaId,
  };
};

const normalizeDateString = (value: unknown, fieldName: string): string | undefined => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;

  const timestamp = new Date(normalized).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`PeriodoProdutivo.${fieldName}: data invalida`);
  }

  return normalized;
};

const compareDateStrings = (start?: string, end?: string): void => {
  if (!start || !end) return;

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime > endTime) {
    throw new Error('PeriodoProdutivo.data_fim: deve ser igual ou posterior ao inicio');
  }
};

export const buildPeriodoProdutivoLabel = (input: {
  tipo_periodo?: unknown;
  cultura?: unknown;
  ano_agricola?: unknown;
  talhao_nome?: unknown;
  talhao?: unknown;
}): string => {
  const tipo = isPeriodoTipo(input.tipo_periodo)
    ? getTipoPeriodoLabel(input.tipo_periodo)
    : 'Período';
  const cultura = firstNonEmptyString(input.cultura);
  const anoAgricola = firstNonEmptyString(input.ano_agricola);
  const talhao = firstNonEmptyString(input.talhao_nome, input.talhao);

  return [tipo, cultura, anoAgricola, talhao].filter(Boolean).join(' • ');
};

const isMetadataRecord = (value: any): value is PeriodoProdutivoMetadata =>
  typeof value?.id === 'string'
  && typeof value?.propriedade_id === 'string'
  && typeof value?.propriedadeId === 'string'
  && typeof value?.fazenda_id === 'string'
  && typeof value?.fazendaId === 'string'
  && isPeriodoTipo(value?.tipo_periodo)
  && typeof value?.tipo_periodo_label === 'string'
  && typeof value?.cultura === 'string'
  && typeof value?.ano_agricola === 'string'
  && typeof value?.label === 'string'
  && isPeriodoStatus(value?.status)
  && typeof value?.criado_em === 'string'
  && typeof value?.atualizado_em === 'string'
  && isRegistroStatus(value?.registro_status)
  && value?.origem === 'local'
  && value?.versao === PERIODO_PRODUTIVO_VERSION;

const isSnapshot = (value: any): value is PeriodoProdutivoSnapshot =>
  value?.version === PERIODO_PRODUTIVO_VERSION
  && typeof value?.savedAt === 'string'
  && Array.isArray(value?.items)
  && value.items.every(isMetadataRecord);

const emptySnapshot = (): PeriodoProdutivoSnapshot => ({
  version: PERIODO_PRODUTIVO_VERSION,
  savedAt: '',
  items: [],
});

const createDefaultId = (): string =>
  `periodo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildMetadataFromInput = (
  input: PeriodoProdutivoMetadataInput & Record<string, any>,
  params: {
    now: string;
    generateId: () => string;
  }
): PeriodoProdutivoMetadata => {
  assertSmallMetadataOnly(input);

  const ids = resolvePropriedadeIds(input);
  const tipoPeriodo = normalizeTipoPeriodo(input.tipo_periodo);
  const cultura = firstNonEmptyString(input.cultura);
  const anoAgricola = firstNonEmptyString(input.ano_agricola);
  const dataInicio = normalizeDateString(input.data_inicio, 'data_inicio');
  const dataFim = normalizeDateString(input.data_fim, 'data_fim');
  const talhaoId = normalizeOptionalString(input.talhao_id ?? input.talhaoId);
  const talhaoNome = normalizeOptionalString(input.talhao_nome ?? input.talhao);

  compareDateStrings(dataInicio, dataFim);

  if (!ids.propriedade_id || !ids.fazenda_id) {
    throw new Error('PeriodoProdutivo.propriedade_id: obrigatorio');
  }
  if (!cultura) {
    throw new Error('PeriodoProdutivo.cultura: obrigatorio');
  }
  if (!anoAgricola) {
    throw new Error('PeriodoProdutivo.ano_agricola: obrigatorio');
  }
  if (!isPeriodoProdutivoAnoAgricolaValido(anoAgricola)) {
    throw new Error('PeriodoProdutivo.ano_agricola: use o formato AAAA/AAAA');
  }

  const label = firstNonEmptyString(input.label) || buildPeriodoProdutivoLabel({
    tipo_periodo: tipoPeriodo,
    cultura,
    ano_agricola: anoAgricola,
    talhao_nome: talhaoNome,
  });

  return {
    id: firstNonEmptyString(input.id) || params.generateId(),
    propriedade_id: ids.propriedade_id,
    propriedadeId: ids.propriedadeId,
    fazenda_id: ids.fazenda_id,
    fazendaId: ids.fazendaId,
    nome_propriedade: normalizeOptionalString(input.nome_propriedade),
    tipo_periodo: tipoPeriodo,
    tipo_periodo_label: firstNonEmptyString(input.tipo_periodo_label) || getTipoPeriodoLabel(tipoPeriodo),
    cultura,
    ano_agricola: anoAgricola,
    label,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: normalizeStatus(input.status),
    observacoes: normalizeOptionalString(input.observacoes),
    talhao_id: talhaoId,
    talhaoId: talhaoId,
    talhao_nome: talhaoNome,
    talhao: talhaoNome,
    criado_por_user_id: normalizeOptionalString(input.criado_por_user_id),
    criado_por_nome: normalizeOptionalString(input.criado_por_nome),
    criado_em: params.now,
    atualizado_em: params.now,
    registro_status: normalizeRegistroStatus(input.registro_status),
    origem: 'local',
    versao: PERIODO_PRODUTIVO_VERSION,
  };
};

const applyPatchToMetadata = (
  existing: PeriodoProdutivoMetadata,
  patch: PeriodoProdutivoMetadataPatch & Record<string, any>,
  atualizadoEm: string
): PeriodoProdutivoMetadata => {
  assertSmallMetadataOnly(patch);

  const merged = {
    ...existing,
    ...patch,
    id: existing.id,
    criado_em: existing.criado_em,
    origem: 'local' as const,
    versao: PERIODO_PRODUTIVO_VERSION,
  };

  const rebuilt = buildMetadataFromInput(merged, {
    now: existing.criado_em,
    generateId: () => existing.id,
  });

  return {
    ...rebuilt,
    id: existing.id,
    criado_em: existing.criado_em,
    atualizado_em: atualizadoEm,
    removido_em:
      rebuilt.registro_status === 'removido'
        ? existing.removido_em || atualizadoEm
        : undefined,
  };
};

export const sortPeriodosProdutivos = (items: PeriodoProdutivoMetadata[] = []): PeriodoProdutivoMetadata[] =>
  [...(items || [])].sort((a, b) => {
    const anoComparison = String(b.ano_agricola || '').localeCompare(String(a.ano_agricola || ''));
    if (anoComparison !== 0) return anoComparison;

    const inicioA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
    const inicioB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
    const safeA = Number.isFinite(inicioA) ? inicioA : 0;
    const safeB = Number.isFinite(inicioB) ? inicioB : 0;
    if (safeA !== safeB) return safeB - safeA;

    return String(a.label || '').localeCompare(String(b.label || ''));
  });

export const createPeriodoProdutivoService = ({
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
  generateId = createDefaultId,
}: PeriodoProdutivoServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();

  const loadSnapshot = async (): Promise<PeriodoProdutivoSnapshot> => {
    const raw = await storage.getItem(PERIODO_PRODUTIVO_STORAGE_KEY);
    if (!raw) return emptySnapshot();

    try {
      const parsed = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      return emptySnapshot();
    }
  };

  const saveItems = async (items: PeriodoProdutivoMetadata[]): Promise<PeriodoProdutivoSnapshot> => {
    const snapshot: PeriodoProdutivoSnapshot = {
      version: PERIODO_PRODUTIVO_VERSION,
      savedAt: now(),
      items: sortPeriodosProdutivos(items),
    };
    await storage.setItem(PERIODO_PRODUTIVO_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  const mutate = async <T>(fn: () => Promise<T>): Promise<T> => {
    const nextMutation = mutationQueue.then(fn, fn);
    mutationQueue = nextMutation.then(() => undefined, () => undefined);
    return nextMutation;
  };

  const findIndexById = (items: PeriodoProdutivoMetadata[], id: string): number =>
    items.findIndex((item) => item.id === id);

  return {
    async listPeriodosProdutivos(): Promise<PeriodoProdutivoMetadata[]> {
      const snapshot = await loadSnapshot();
      return sortPeriodosProdutivos(snapshot.items);
    },

    async listActivePeriodosProdutivos(): Promise<PeriodoProdutivoMetadata[]> {
      const items = await this.listPeriodosProdutivos();
      return items.filter((item) => item.registro_status === 'ativo');
    },

    async listPeriodosProdutivosByPropriedade(propriedadeId: string): Promise<PeriodoProdutivoMetadata[]> {
      const id = firstNonEmptyString(propriedadeId);
      if (!id) return [];

      const items = await this.listPeriodosProdutivos();
      return items.filter((item) => (
        item.propriedade_id === id
        || item.propriedadeId === id
        || item.fazenda_id === id
        || item.fazendaId === id
      ));
    },

    async listActivePeriodosProdutivosByPropriedade(propriedadeId: string): Promise<PeriodoProdutivoMetadata[]> {
      const items = await this.listPeriodosProdutivosByPropriedade(propriedadeId);
      return items.filter((item) => item.registro_status === 'ativo');
    },

    async listActivePeriodosProdutivosByTalhao(
      propriedadeId: string,
      talhao: string
    ): Promise<PeriodoProdutivoMetadata[]> {
      const talhaoNormalized = firstNonEmptyString(talhao).toLowerCase();
      const items = await this.listActivePeriodosProdutivosByPropriedade(propriedadeId);
      if (!talhaoNormalized) return items;

      return items.filter((item) => (
        firstNonEmptyString(item.talhao_id, item.talhaoId).toLowerCase() === talhaoNormalized
        || firstNonEmptyString(item.talhao_nome, item.talhao).toLowerCase() === talhaoNormalized
        || !firstNonEmptyString(item.talhao_id, item.talhaoId, item.talhao_nome, item.talhao)
      ));
    },

    async getPeriodoProdutivoById(id: string): Promise<PeriodoProdutivoMetadata | null> {
      const normalizedId = firstNonEmptyString(id);
      if (!normalizedId) return null;

      const snapshot = await loadSnapshot();
      return snapshot.items.find((item) => item.id === normalizedId) ?? null;
    },

    async createPeriodoProdutivoMetadata(
      input: PeriodoProdutivoMetadataInput & Record<string, any>
    ): Promise<PeriodoProdutivoMetadata> {
      return mutate(async () => {
        const timestamp = now();
        const metadata = buildMetadataFromInput(input, { now: timestamp, generateId });
        const snapshot = await loadSnapshot();

        if (snapshot.items.some((item) => item.id === metadata.id)) {
          throw new Error('PeriodoProdutivo.id: metadado ja existe');
        }

        await saveItems([metadata, ...snapshot.items]);
        return metadata;
      });
    },

    async updatePeriodoProdutivoMetadata(
      id: string,
      patch: PeriodoProdutivoMetadataPatch & Record<string, any>
    ): Promise<PeriodoProdutivoMetadata> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) throw new Error('PeriodoProdutivo.id: obrigatorio');

        const snapshot = await loadSnapshot();
        const index = findIndexById(snapshot.items, normalizedId);
        if (index === -1) throw new Error('PeriodoProdutivo: metadado nao encontrado');

        const updated = applyPatchToMetadata(snapshot.items[index], patch, now());
        const items = [...snapshot.items];
        items[index] = updated;
        await saveItems(items);
        return updated;
      });
    },

    async markPeriodoProdutivoAsRemoved(id: string): Promise<PeriodoProdutivoMetadata> {
      return this.updatePeriodoProdutivoMetadata(id, { registro_status: 'removido' });
    },

    async deletePeriodoProdutivoMetadata(id: string): Promise<boolean> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) return false;

        const snapshot = await loadSnapshot();
        const items = snapshot.items.filter((item) => item.id !== normalizedId);
        if (items.length === snapshot.items.length) return false;

        await saveItems(items);
        return true;
      });
    },
  };
};

export const PeriodoProdutivoService = createPeriodoProdutivoService();
