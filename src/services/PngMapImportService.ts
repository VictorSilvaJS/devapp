import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PNG_MAP_CATEGORIAS,
  PNG_MAP_ELEMENTOS,
  PNG_MAP_IMPORT_STORAGE_KEY,
  PNG_MAP_IMPORT_VERSION,
  PNG_MAP_STATUSES,
  PngMapCategoria,
  PngMapElemento,
  PngMapEscopo,
  PngMapImportMetadata,
  PngMapImportMetadataInput,
  PngMapImportMetadataPatch,
  PngMapStatus,
} from '../types/anexoPngLocal';

export { PNG_MAP_IMPORT_STORAGE_KEY } from '../types/anexoPngLocal';

interface PngMapImportSnapshot {
  version: number;
  savedAt: string;
  items: PngMapImportMetadata[];
}

export interface PngMapImportStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface PngMapImportServiceDeps {
  storage?: PngMapImportStorageAdapter;
  now?: () => string;
  generateId?: () => string;
}

const asyncStorageAdapter: PngMapImportStorageAdapter = {
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
  'image',
  'asset',
  'source',
  'require',
];

const ALLOWED_METADATA_KEYS_WITH_SUSPICIOUS_TERMS = [
  'arquivo_tamanho_bytes',
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

const isPngMapCategoria = (value: unknown): value is PngMapCategoria =>
  typeof value === 'string' && PNG_MAP_CATEGORIAS.includes(value as PngMapCategoria);

const isPngMapElemento = (value: unknown): value is PngMapElemento =>
  typeof value === 'string' && PNG_MAP_ELEMENTOS.includes(value as PngMapElemento);

const isPngMapStatus = (value: unknown): value is PngMapStatus =>
  typeof value === 'string' && PNG_MAP_STATUSES.includes(value as PngMapStatus);

const isPngMapEscopo = (value: unknown): value is PngMapEscopo =>
  value === 'propriedade' || value === 'talhao';

const normalizeStatus = (value: unknown): PngMapStatus =>
  isPngMapStatus(value) ? value : 'rascunho';

const normalizeCategoria = (value: unknown): PngMapCategoria => {
  if (isPngMapCategoria(value)) return value;
  throw new Error('PngMapImport.categoria: categoria invalida');
};

const normalizeElemento = (value: unknown): PngMapElemento | undefined => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (isPngMapElemento(normalized)) return normalized;
  return 'outro';
};

const normalizeEscopo = (value: unknown): PngMapEscopo => {
  if (isPngMapEscopo(value)) return value;
  throw new Error('PngMapImport.escopo: obrigatorio');
};

const resolvePropriedadeIds = (input: {
  propriedade_id?: unknown;
  fazenda_id?: unknown;
}): { propriedade_id: string; fazenda_id: string } => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id, input.fazenda_id);
  const fazendaId = firstNonEmptyString(input.fazenda_id, input.propriedade_id);

  return {
    propriedade_id: propriedadeId,
    fazenda_id: fazendaId,
  };
};

const isPlainObject = (value: unknown): boolean =>
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value);

const assertSmallMetadataOnly = (input: Record<string, any>): void => {
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();

    if (
      !ALLOWED_METADATA_KEYS_WITH_SUSPICIOUS_TERMS.includes(normalizedKey)
      && SUSPICIOUS_CONTENT_KEYS.some((suspicious) => normalizedKey.includes(suspicious))
    ) {
      throw new Error(`PngMapImport.${key}: conteudo de arquivo nao deve ser salvo em metadados`);
    }

    if (typeof value === 'string' && value.length > MAX_METADATA_STRING_LENGTH) {
      throw new Error(`PngMapImport.${key}: metadado grande demais`);
    }

    if (Array.isArray(value) || isPlainObject(value) || typeof value === 'function') {
      throw new Error(`PngMapImport.${key}: metadado deve ser valor primitivo pequeno`);
    }
  }
};

const isMetadataRecord = (value: any): value is PngMapImportMetadata =>
  typeof value?.id === 'string'
  && typeof value?.propriedade_id === 'string'
  && typeof value?.fazenda_id === 'string'
  && typeof value?.titulo === 'string'
  && isPngMapCategoria(value?.categoria)
  && typeof value?.categoria_label === 'string'
  && isPngMapEscopo(value?.escopo)
  && typeof value?.arquivo_nome_original === 'string'
  && typeof value?.importado_em === 'string'
  && typeof value?.atualizado_em === 'string'
  && isPngMapStatus(value?.status)
  && typeof value?.visivel_para_produtor === 'boolean'
  && value?.origem === 'arquivo_local'
  && value?.versao === PNG_MAP_IMPORT_VERSION;

const isSnapshot = (value: any): value is PngMapImportSnapshot =>
  value?.version === PNG_MAP_IMPORT_VERSION
  && typeof value?.savedAt === 'string'
  && Array.isArray(value?.items)
  && value.items.every(isMetadataRecord);

const emptySnapshot = (): PngMapImportSnapshot => ({
  version: PNG_MAP_IMPORT_VERSION,
  savedAt: '',
  items: [],
});

const createDefaultId = (): string =>
  `pngmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildMetadataFromInput = (
  input: PngMapImportMetadataInput & Record<string, any>,
  params: {
    now: string;
    generateId: () => string;
  }
): PngMapImportMetadata => {
  assertSmallMetadataOnly(input);

  const ids = resolvePropriedadeIds(input);
  const titulo = firstNonEmptyString(input.titulo);
  const categoria = normalizeCategoria(input.categoria);
  const categoriaLabel = firstNonEmptyString(input.categoria_label);
  const escopo = normalizeEscopo(input.escopo);
  const arquivoNomeOriginal = firstNonEmptyString(input.arquivo_nome_original);
  const talhaoId = normalizeOptionalString(input.talhao_id);
  const talhaoNome = normalizeOptionalString(input.talhao_nome);

  if (!ids.propriedade_id || !ids.fazenda_id) {
    throw new Error('PngMapImport.propriedade_id: obrigatorio');
  }
  if (!titulo) {
    throw new Error('PngMapImport.titulo: obrigatorio');
  }
  if (!categoriaLabel) {
    throw new Error('PngMapImport.categoria_label: obrigatorio');
  }
  if (!arquivoNomeOriginal) {
    throw new Error('PngMapImport.arquivo_nome_original: obrigatorio');
  }
  if (input.origem !== 'arquivo_local') {
    throw new Error('PngMapImport.origem: deve ser arquivo_local');
  }
  if (escopo === 'talhao' && !talhaoId && !talhaoNome) {
    throw new Error('PngMapImport.talhao: obrigatorio para escopo talhao');
  }

  return {
    id: firstNonEmptyString(input.id) || params.generateId(),
    propriedade_id: ids.propriedade_id,
    fazenda_id: ids.fazenda_id,
    nome_propriedade: normalizeOptionalString(input.nome_propriedade),
    titulo,
    descricao: normalizeOptionalString(input.descricao),
    categoria,
    categoria_label: categoriaLabel,
    elemento: normalizeElemento(input.elemento),
    elemento_label: normalizeOptionalString(input.elemento_label),
    safra: normalizeOptionalString(input.safra),
    ano: normalizeInteger(input.ano),
    profundidade: normalizeOptionalString(input.profundidade),
    escopo,
    talhao_id: talhaoId,
    talhao_nome: talhaoNome,
    arquivo_nome_original: arquivoNomeOriginal,
    arquivo_uri_local: normalizeOptionalString(input.arquivo_uri_local),
    arquivo_tamanho_bytes: normalizeNumber(input.arquivo_tamanho_bytes),
    arquivo_mime: normalizeOptionalString(input.arquivo_mime),
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
    versao: PNG_MAP_IMPORT_VERSION,
  };
};

const applyPatchToMetadata = (
  existing: PngMapImportMetadata,
  patch: PngMapImportMetadataPatch & Record<string, any>,
  atualizadoEm: string
): PngMapImportMetadata => {
  assertSmallMetadataOnly(patch);

  const merged = {
    ...existing,
    ...patch,
    origem: 'arquivo_local' as const,
    versao: PNG_MAP_IMPORT_VERSION,
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

export const createPngMapImportService = ({
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
  generateId = createDefaultId,
}: PngMapImportServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();

  const loadSnapshot = async (): Promise<PngMapImportSnapshot> => {
    const raw = await storage.getItem(PNG_MAP_IMPORT_STORAGE_KEY);
    if (!raw) return emptySnapshot();

    try {
      const parsed = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      return emptySnapshot();
    }
  };

  const saveItems = async (items: PngMapImportMetadata[]): Promise<PngMapImportSnapshot> => {
    const snapshot: PngMapImportSnapshot = {
      version: PNG_MAP_IMPORT_VERSION,
      savedAt: now(),
      items,
    };
    await storage.setItem(PNG_MAP_IMPORT_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  const mutate = async <T>(fn: () => Promise<T>): Promise<T> => {
    const nextMutation = mutationQueue.then(fn, fn);
    mutationQueue = nextMutation.then(() => undefined, () => undefined);
    return nextMutation;
  };

  const findIndexById = (items: PngMapImportMetadata[], id: string): number =>
    items.findIndex((item) => item.id === id);

  return {
    async listPngMapImports(): Promise<PngMapImportMetadata[]> {
      const snapshot = await loadSnapshot();
      return snapshot.items;
    },

    async listPngMapImportsByPropriedade(propriedadeId: string): Promise<PngMapImportMetadata[]> {
      const id = firstNonEmptyString(propriedadeId);
      if (!id) return [];

      const snapshot = await loadSnapshot();
      return snapshot.items.filter((item) => item.propriedade_id === id || item.fazenda_id === id);
    },

    async listActivePngMapImportsByPropriedade(propriedadeId: string): Promise<PngMapImportMetadata[]> {
      const items = await this.listPngMapImportsByPropriedade(propriedadeId);
      return items.filter((item) => item.status === 'ativo');
    },

    async getPngMapImportById(id: string): Promise<PngMapImportMetadata | null> {
      const normalizedId = firstNonEmptyString(id);
      if (!normalizedId) return null;

      const snapshot = await loadSnapshot();
      return snapshot.items.find((item) => item.id === normalizedId) ?? null;
    },

    async createPngMapImportMetadata(
      input: PngMapImportMetadataInput & Record<string, any>
    ): Promise<PngMapImportMetadata> {
      return mutate(async () => {
        const timestamp = now();
        const metadata = buildMetadataFromInput(input, { now: timestamp, generateId });
        const snapshot = await loadSnapshot();

        if (snapshot.items.some((item) => item.id === metadata.id)) {
          throw new Error('PngMapImport.id: metadado ja existe');
        }

        const items = [metadata, ...snapshot.items];
        await saveItems(items);
        return metadata;
      });
    },

    async updatePngMapImportMetadata(
      id: string,
      patch: PngMapImportMetadataPatch & Record<string, any>
    ): Promise<PngMapImportMetadata> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) throw new Error('PngMapImport.id: obrigatorio');

        const snapshot = await loadSnapshot();
        const index = findIndexById(snapshot.items, normalizedId);
        if (index === -1) throw new Error('PngMapImport: metadado nao encontrado');

        const timestamp = now();
        const updated = applyPatchToMetadata(snapshot.items[index], patch, timestamp);
        const items = [...snapshot.items];
        items[index] = updated;

        await saveItems(items);
        return updated;
      });
    },

    async markPngMapImportAsActive(id: string): Promise<PngMapImportMetadata> {
      return this.updatePngMapImportMetadata(id, { status: 'ativo' });
    },

    async markPngMapImportAsSubstituido(id: string): Promise<PngMapImportMetadata> {
      return this.updatePngMapImportMetadata(id, { status: 'substituido' });
    },

    async markPngMapImportAsRemoved(id: string): Promise<PngMapImportMetadata> {
      return this.updatePngMapImportMetadata(id, { status: 'removido' });
    },

    async deletePngMapImportMetadata(id: string): Promise<boolean> {
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

    __setStorageForTests(nextStorage: PngMapImportStorageAdapter) {
      storage = nextStorage;
      mutationQueue = Promise.resolve();
    },
  };
};

export const PngMapImportService = createPngMapImportService();
