import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PRESCRIPTION_ZIP_CAMADAS,
  PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY,
  PRESCRIPTION_ZIP_IMPORT_VERSION,
  PRESCRIPTION_ZIP_STATUSES,
  PrescriptionZipCamada,
  PrescriptionZipEscopo,
  PrescriptionZipImportMetadata,
  PrescriptionZipImportMetadataInput,
  PrescriptionZipImportMetadataPatch,
  PrescriptionZipStatus,
} from '../types/anexoPrescricaoZipLocal';

export { PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY } from '../types/anexoPrescricaoZipLocal';

interface PrescriptionZipImportSnapshot {
  version: number;
  savedAt: string;
  items: PrescriptionZipImportMetadata[];
}

export interface PrescriptionZipImportStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface PrescriptionZipImportServiceDeps {
  storage?: PrescriptionZipImportStorageAdapter;
  now?: () => string;
  generateId?: () => string;
}

const asyncStorageAdapter: PrescriptionZipImportStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const SUSPICIOUS_CONTENT_KEYS = [
  'base64',
  'content',
  'bytes',
  'data',
  'blob',
  'buffer',
  'file',
  'zip',
  'archive',
  'source',
  'require',
];

const ALLOWED_METADATA_KEYS_WITH_SUSPICIOUS_TERMS = [
  'arquivo_tamanho_bytes',
  'arquivo_uri_local',
  'arquivo_mime',
  'arquivo_nome_original',
  'formato_arquivo',
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

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const normalizeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const isPrescriptionZipStatus = (value: unknown): value is PrescriptionZipStatus =>
  typeof value === 'string' && PRESCRIPTION_ZIP_STATUSES.includes(value as PrescriptionZipStatus);

const isPrescriptionZipCamada = (value: unknown): value is PrescriptionZipCamada =>
  typeof value === 'string' && PRESCRIPTION_ZIP_CAMADAS.includes(value as PrescriptionZipCamada);

const isPrescriptionZipEscopo = (value: unknown): value is PrescriptionZipEscopo =>
  value === 'propriedade' || value === 'talhao';

const normalizeStatus = (value: unknown): PrescriptionZipStatus =>
  isPrescriptionZipStatus(value) ? value : 'rascunho';

const normalizeCamada = (value: unknown): PrescriptionZipCamada => {
  if (isPrescriptionZipCamada(value)) return value;
  throw new Error('PrescriptionZipImport.camada: camada invalida');
};

const normalizeEscopo = (value: unknown): PrescriptionZipEscopo => {
  if (isPrescriptionZipEscopo(value)) return value;
  throw new Error('PrescriptionZipImport.escopo: obrigatorio');
};

const resolvePropriedadeIds = (input: {
  propriedade_id?: unknown;
  fazenda_id?: unknown;
}): { propriedade_id: string; fazenda_id: string } => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id, input.fazenda_id);
  const fazendaId = firstNonEmptyString(input.fazenda_id, input.propriedade_id);

  return { propriedade_id: propriedadeId, fazenda_id: fazendaId };
};

const isPlainObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertSmallMetadataOnly = (input: Record<string, any>): void => {
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();

    if (
      !ALLOWED_METADATA_KEYS_WITH_SUSPICIOUS_TERMS.includes(normalizedKey)
      && SUSPICIOUS_CONTENT_KEYS.some((suspicious) => normalizedKey.includes(suspicious))
    ) {
      throw new Error(`PrescriptionZipImport.${key}: conteudo de arquivo nao deve ser salvo em metadados`);
    }

    if (typeof value === 'string' && value.length > MAX_METADATA_STRING_LENGTH) {
      throw new Error(`PrescriptionZipImport.${key}: metadado grande demais`);
    }

    if (Array.isArray(value) || isPlainObject(value) || typeof value === 'function') {
      throw new Error(`PrescriptionZipImport.${key}: metadado deve ser valor primitivo pequeno`);
    }
  }
};

const isMetadataRecord = (value: any): value is PrescriptionZipImportMetadata =>
  typeof value?.id === 'string'
  && typeof value?.propriedade_id === 'string'
  && typeof value?.fazenda_id === 'string'
  && typeof value?.titulo === 'string'
  && value?.categoria === 'prescricao'
  && value?.categoria_label === 'Prescrição'
  && value?.tipo_material === 'prescricao'
  && isPrescriptionZipCamada(value?.camada)
  && typeof value?.camada_label === 'string'
  && isPrescriptionZipEscopo(value?.escopo)
  && typeof value?.arquivo_nome_original === 'string'
  && value?.formato_arquivo === 'zip'
  && typeof value?.importado_em === 'string'
  && typeof value?.atualizado_em === 'string'
  && isPrescriptionZipStatus(value?.status)
  && typeof value?.visivel_para_produtor === 'boolean'
  && value?.origem === 'arquivo_local'
  && value?.versao === PRESCRIPTION_ZIP_IMPORT_VERSION;

const isSnapshot = (value: any): value is PrescriptionZipImportSnapshot =>
  value?.version === PRESCRIPTION_ZIP_IMPORT_VERSION
  && typeof value?.savedAt === 'string'
  && Array.isArray(value?.items)
  && value.items.every(isMetadataRecord);

const emptySnapshot = (): PrescriptionZipImportSnapshot => ({
  version: PRESCRIPTION_ZIP_IMPORT_VERSION,
  savedAt: '',
  items: [],
});

const createDefaultId = (): string =>
  `zipmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildMetadataFromInput = (
  input: PrescriptionZipImportMetadataInput & Record<string, any>,
  params: {
    now: string;
    generateId: () => string;
  }
): PrescriptionZipImportMetadata => {
  assertSmallMetadataOnly(input);

  const ids = resolvePropriedadeIds(input);
  const titulo = firstNonEmptyString(input.titulo);
  const camada = normalizeCamada(input.camada);
  const camadaLabel = firstNonEmptyString(input.camada_label, input.elemento_label);
  const escopo = normalizeEscopo(input.escopo);
  const arquivoNomeOriginal = firstNonEmptyString(input.arquivo_nome_original);
  const talhaoId = normalizeOptionalString(input.talhao_id);
  const talhaoNome = normalizeOptionalString(input.talhao_nome);

  if (!ids.propriedade_id || !ids.fazenda_id) throw new Error('PrescriptionZipImport.propriedade_id: obrigatorio');
  if (!titulo) throw new Error('PrescriptionZipImport.titulo: obrigatorio');
  if (!camadaLabel) throw new Error('PrescriptionZipImport.camada_label: obrigatorio');
  if (!arquivoNomeOriginal) throw new Error('PrescriptionZipImport.arquivo_nome_original: obrigatorio');
  if (input.origem !== 'arquivo_local') throw new Error('PrescriptionZipImport.origem: deve ser arquivo_local');
  if (escopo === 'talhao' && !talhaoId && !talhaoNome) {
    throw new Error('PrescriptionZipImport.talhao: obrigatorio para escopo talhao');
  }

  return {
    id: firstNonEmptyString(input.id) || params.generateId(),
    propriedade_id: ids.propriedade_id,
    fazenda_id: ids.fazenda_id,
    nome_propriedade: normalizeOptionalString(input.nome_propriedade),
    titulo,
    descricao: normalizeOptionalString(input.descricao),
    categoria: 'prescricao',
    categoria_label: 'Prescrição',
    tipo_material: 'prescricao',
    camada,
    camada_label: camadaLabel,
    elemento: camada,
    elemento_label: camadaLabel,
    safra: normalizeOptionalString(input.safra),
    ano: normalizeInteger(input.ano),
    escopo,
    talhao_id: talhaoId,
    talhao_nome: talhaoNome,
    arquivo_nome_original: arquivoNomeOriginal,
    arquivo_uri_local: normalizeOptionalString(input.arquivo_uri_local),
    arquivo_tamanho_bytes: normalizeNumber(input.arquivo_tamanho_bytes),
    arquivo_mime: normalizeOptionalString(input.arquivo_mime),
    formato_arquivo: 'zip',
    importado_por_usuario_id: normalizeOptionalString(input.importado_por_usuario_id),
    importado_por_nome: normalizeOptionalString(input.importado_por_nome),
    importado_em: params.now,
    atualizado_em: params.now,
    status: normalizeStatus(input.status),
    visivel_para_produtor:
      typeof input.visivel_para_produtor === 'boolean'
        ? input.visivel_para_produtor
        : true,
    origem: 'arquivo_local',
    versao: PRESCRIPTION_ZIP_IMPORT_VERSION,
  };
};

const applyPatchToMetadata = (
  existing: PrescriptionZipImportMetadata,
  patch: PrescriptionZipImportMetadataPatch & Record<string, any>,
  atualizadoEm: string
): PrescriptionZipImportMetadata => {
  assertSmallMetadataOnly(patch);
  const merged = {
    ...existing,
    ...patch,
    origem: 'arquivo_local' as const,
    versao: PRESCRIPTION_ZIP_IMPORT_VERSION,
  };
  const rebuilt = buildMetadataFromInput({
    ...merged,
    id: existing.id,
    arquivo_nome_original:
      patch.arquivo_nome_original !== undefined
        ? patch.arquivo_nome_original
        : existing.arquivo_nome_original,
  }, {
    now: existing.importado_em,
    generateId: () => existing.id,
  });

  return {
    ...rebuilt,
    id: existing.id,
    importado_em: existing.importado_em,
    atualizado_em: atualizadoEm,
  };
};

export const createPrescriptionZipImportService = ({
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
  generateId = createDefaultId,
}: PrescriptionZipImportServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();

  const loadSnapshot = async (): Promise<PrescriptionZipImportSnapshot> => {
    const raw = await storage.getItem(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY);
    if (!raw) return emptySnapshot();

    try {
      const parsed = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      return emptySnapshot();
    }
  };

  const saveItems = async (items: PrescriptionZipImportMetadata[]): Promise<PrescriptionZipImportSnapshot> => {
    const snapshot = {
      version: PRESCRIPTION_ZIP_IMPORT_VERSION,
      savedAt: now(),
      items,
    };
    await storage.setItem(PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  const mutate = async <T>(fn: () => Promise<T>): Promise<T> => {
    const nextMutation = mutationQueue.then(fn, fn);
    mutationQueue = nextMutation.then(() => undefined, () => undefined);
    return nextMutation;
  };

  return {
    async listPrescriptionZipImports(): Promise<PrescriptionZipImportMetadata[]> {
      const snapshot = await loadSnapshot();
      return snapshot.items;
    },

    async listPrescriptionZipImportsByPropriedade(propriedadeId: string): Promise<PrescriptionZipImportMetadata[]> {
      const id = firstNonEmptyString(propriedadeId);
      if (!id) return [];

      const snapshot = await loadSnapshot();
      return snapshot.items.filter((item) => item.propriedade_id === id || item.fazenda_id === id);
    },

    async listActivePrescriptionZipImportsByPropriedade(propriedadeId: string): Promise<PrescriptionZipImportMetadata[]> {
      const items = await this.listPrescriptionZipImportsByPropriedade(propriedadeId);
      return items.filter((item) => item.status === 'ativo');
    },

    async getPrescriptionZipImportById(id: string): Promise<PrescriptionZipImportMetadata | null> {
      const normalizedId = firstNonEmptyString(id);
      if (!normalizedId) return null;
      const snapshot = await loadSnapshot();
      return snapshot.items.find((item) => item.id === normalizedId) ?? null;
    },

    async createPrescriptionZipImportMetadata(
      input: PrescriptionZipImportMetadataInput & Record<string, any>
    ): Promise<PrescriptionZipImportMetadata> {
      return mutate(async () => {
        const timestamp = now();
        const metadata = buildMetadataFromInput(input, { now: timestamp, generateId });
        const snapshot = await loadSnapshot();
        if (snapshot.items.some((item) => item.id === metadata.id)) {
          throw new Error('PrescriptionZipImport.id: metadado ja existe');
        }
        await saveItems([metadata, ...snapshot.items]);
        return metadata;
      });
    },

    async updatePrescriptionZipImportMetadata(
      id: string,
      patch: PrescriptionZipImportMetadataPatch & Record<string, any>
    ): Promise<PrescriptionZipImportMetadata> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) throw new Error('PrescriptionZipImport.id: obrigatorio');
        const snapshot = await loadSnapshot();
        const index = snapshot.items.findIndex((item) => item.id === normalizedId);
        if (index === -1) throw new Error('PrescriptionZipImport: metadado nao encontrado');

        const updated = applyPatchToMetadata(snapshot.items[index], patch, now());
        const items = [...snapshot.items];
        items[index] = updated;
        await saveItems(items);
        return updated;
      });
    },

    async markPrescriptionZipImportAsSubstituido(id: string): Promise<PrescriptionZipImportMetadata> {
      return this.updatePrescriptionZipImportMetadata(id, { status: 'substituido' });
    },

    async markPrescriptionZipImportAsRemoved(id: string): Promise<PrescriptionZipImportMetadata> {
      return this.updatePrescriptionZipImportMetadata(id, { status: 'removido' });
    },

    async deletePrescriptionZipImportMetadata(id: string): Promise<boolean> {
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

export const PrescriptionZipImportService = createPrescriptionZipImportService();
