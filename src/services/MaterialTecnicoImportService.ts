import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MATERIAL_TECNICO_CATEGORIAS,
  MATERIAL_TECNICO_FORMATOS,
  MATERIAL_TECNICO_IMPORT_STORAGE_KEY,
  MATERIAL_TECNICO_IMPORT_VERSION,
  MATERIAL_TECNICO_STATUSES,
  MaterialTecnicoCategoria,
  MaterialTecnicoEscopo,
  MaterialTecnicoFormato,
  MaterialTecnicoImportMetadata,
  MaterialTecnicoImportMetadataInput,
  MaterialTecnicoImportMetadataPatch,
  MaterialTecnicoStatus,
} from '../types/materialTecnicoLocal';

export { MATERIAL_TECNICO_IMPORT_STORAGE_KEY } from '../types/materialTecnicoLocal';

interface MaterialTecnicoImportSnapshot {
  version: number;
  savedAt: string;
  items: MaterialTecnicoImportMetadata[];
}

export interface MaterialTecnicoImportStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface MaterialTecnicoImportServiceDeps {
  storage?: MaterialTecnicoImportStorageAdapter;
  now?: () => string;
  generateId?: () => string;
}

const asyncStorageAdapter: MaterialTecnicoImportStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const CATEGORY_LABELS: Record<MaterialTecnicoCategoria, string> = {
  fertilidade: 'Fertilidade',
  correcao: 'Correção de solo',
  prescricao: 'Prescrição',
};

const PRESCRIPTION_LABELS = {
  calcario: 'Calcário',
  fosforo: 'Fósforo',
  potassio: 'Potássio',
  nao_identificada: 'Não identificada',
} as const;

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
};
const optionalString = (...values: unknown[]): string | undefined =>
  firstNonEmptyString(...values) || undefined;
const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const isCategoria = (value: unknown): value is MaterialTecnicoCategoria =>
  typeof value === 'string'
  && MATERIAL_TECNICO_CATEGORIAS.includes(value as MaterialTecnicoCategoria);
const isFormato = (value: unknown): value is MaterialTecnicoFormato =>
  typeof value === 'string'
  && MATERIAL_TECNICO_FORMATOS.includes(value as MaterialTecnicoFormato);
const isStatus = (value: unknown): value is MaterialTecnicoStatus =>
  typeof value === 'string'
  && MATERIAL_TECNICO_STATUSES.includes(value as MaterialTecnicoStatus);
const isEscopo = (value: unknown): value is MaterialTecnicoEscopo =>
  value === 'propriedade' || value === 'talhao';
const isValidYear = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;

const assertSmallMetadataOnly = (input: Record<string, any>): void => {
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value) || (typeof value === 'object' && value !== null) || typeof value === 'function') {
      throw new Error(`MaterialTecnicoImport.${key}: metadado deve ser valor primitivo pequeno`);
    }
    if (typeof value === 'string' && value.length > 4096) {
      throw new Error(`MaterialTecnicoImport.${key}: metadado grande demais`);
    }
    const normalizedKey = key.toLowerCase();
    const allowedFileMetadata = [
      'arquivo_nome_original',
      'arquivo_uri_local',
      'arquivo_tamanho_bytes',
      'arquivo_mime',
      'formato_arquivo',
    ].includes(normalizedKey);
    if (
      !allowedFileMetadata
      && ['base64', 'content', 'bytes', 'blob', 'buffer', 'data', 'file', 'image', 'asset']
        .some((term) => normalizedKey.includes(term))
    ) {
      throw new Error(`MaterialTecnicoImport.${key}: conteúdo de arquivo não deve ser salvo em metadados`);
    }
  }
};

const buildMetadata = (
  input: MaterialTecnicoImportMetadataInput & Record<string, any>,
  params: { timestamp: string; generateId: () => string }
): MaterialTecnicoImportMetadata => {
  assertSmallMetadataOnly(input);
  const propriedadeId = firstNonEmptyString(input.propriedade_id);
  const arquivoNome = firstNonEmptyString(input.arquivo_nome_original);
  if (!propriedadeId) throw new Error('MaterialTecnicoImport.propriedade_id: obrigatório');
  if (!arquivoNome) throw new Error('MaterialTecnicoImport.arquivo_nome_original: obrigatório');
  if (!isCategoria(input.categoria)) throw new Error('MaterialTecnicoImport.categoria: inválida');
  if (!isFormato(input.formato_arquivo)) throw new Error('MaterialTecnicoImport.formato_arquivo: inválido');
  if (!isValidYear(input.ano)) throw new Error('MaterialTecnicoImport.ano: obrigatório');
  if (input.origem !== undefined && input.origem !== 'arquivo_local') {
    throw new Error('MaterialTecnicoImport.origem: deve ser arquivo_local');
  }

  const periodoId = optionalString(input.periodo_produtivo_id);
  const periodoLabel = optionalString(input.periodo_produtivo_label);
  if (!!periodoId !== !!periodoLabel) {
    throw new Error('MaterialTecnicoImport.periodo_produtivo: id e label devem ser informados juntos');
  }

  const profundidade = optionalString(input.profundidade);
  if ((input.categoria === 'fertilidade' || input.categoria === 'correcao') && !profundidade) {
    throw new Error('MaterialTecnicoImport.profundidade: obrigatória');
  }

  const requestedScope = isEscopo(input.escopo) ? input.escopo : 'propriedade';
  const escopo: MaterialTecnicoEscopo = input.categoria === 'correcao'
    ? requestedScope
    : 'propriedade';
  const talhaoId = escopo === 'talhao' ? optionalString(input.talhao_id) : undefined;
  const talhaoNome = escopo === 'talhao' ? optionalString(input.talhao_nome) : undefined;
  if (escopo === 'talhao' && !talhaoId && !talhaoNome) {
    throw new Error('MaterialTecnicoImport.talhao: obrigatório para escopo talhão');
  }

  const inferred = input.categoria === 'prescricao'
    && Object.prototype.hasOwnProperty.call(PRESCRIPTION_LABELS, input.prescricao_inferida)
    ? input.prescricao_inferida
    : input.categoria === 'prescricao'
      ? 'nao_identificada'
      : undefined;

  return {
    id: firstNonEmptyString(input.id) || params.generateId(),
    propriedade_id: propriedadeId,
    nome_propriedade: optionalString(input.nome_propriedade),
    titulo: arquivoNome,
    categoria: input.categoria,
    categoria_label: CATEGORY_LABELS[input.categoria],
    ano: input.ano,
    periodo_produtivo_id: periodoId,
    periodo_produtivo_label: periodoLabel,
    safra: optionalString(input.safra, periodoLabel),
    profundidade: input.categoria === 'prescricao' ? undefined : profundidade,
    escopo,
    talhao_id: talhaoId,
    talhao_nome: escopo === 'talhao' ? talhaoNome : 'Propriedade inteira',
    prescricao_inferida: inferred,
    prescricao_inferida_label: inferred ? PRESCRIPTION_LABELS[inferred] : undefined,
    arquivo_nome_original: arquivoNome,
    arquivo_uri_local: optionalString(input.arquivo_uri_local),
    arquivo_tamanho_bytes: finiteNumber(input.arquivo_tamanho_bytes),
    arquivo_mime: optionalString(input.arquivo_mime),
    formato_arquivo: input.formato_arquivo,
    importado_por_usuario_id: optionalString(input.importado_por_usuario_id),
    importado_por_nome: optionalString(input.importado_por_nome),
    importado_em: params.timestamp,
    atualizado_em: params.timestamp,
    status: isStatus(input.status) ? input.status : 'rascunho',
    visivel_para_produtor: typeof input.visivel_para_produtor === 'boolean'
      ? input.visivel_para_produtor
      : true,
    origem: 'arquivo_local',
    versao: MATERIAL_TECNICO_IMPORT_VERSION,
  };
};

const isMetadataRecord = (value: any): value is MaterialTecnicoImportMetadata =>
  typeof value?.id === 'string'
  && Boolean(firstNonEmptyString(value?.propriedade_id, value?.fazenda_id))
  && typeof value?.titulo === 'string'
  && isCategoria(value?.categoria)
  && typeof value?.categoria_label === 'string'
  && isValidYear(value?.ano)
  && isEscopo(value?.escopo)
  && typeof value?.arquivo_nome_original === 'string'
  && isFormato(value?.formato_arquivo)
  && typeof value?.importado_em === 'string'
  && typeof value?.atualizado_em === 'string'
  && isStatus(value?.status)
  && typeof value?.visivel_para_produtor === 'boolean'
  && value?.origem === 'arquivo_local'
  && value?.versao === MATERIAL_TECNICO_IMPORT_VERSION;

const normalizeStoredMetadata = (value: any): MaterialTecnicoImportMetadata | null => {
  if (!isMetadataRecord(value)) return null;
  const stored: any = value;
  const { fazenda_id: _legacyFazendaId, ...canonical } = stored;
  return {
    ...canonical,
    propriedade_id: firstNonEmptyString(stored.propriedade_id, stored.fazenda_id),
  };
};

const emptySnapshot = (): MaterialTecnicoImportSnapshot => ({
  version: MATERIAL_TECNICO_IMPORT_VERSION,
  savedAt: '',
  items: [],
});

export const createMaterialTecnicoImportService = ({
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
  generateId = () => `material_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
}: MaterialTecnicoImportServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();
  const loadSnapshot = async (): Promise<MaterialTecnicoImportSnapshot> => {
    const raw = await storage.getItem(MATERIAL_TECNICO_IMPORT_STORAGE_KEY);
    if (!raw) return emptySnapshot();
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed?.version === MATERIAL_TECNICO_IMPORT_VERSION
        && typeof parsed?.savedAt === 'string'
        && Array.isArray(parsed?.items)
      ) {
        return {
          version: MATERIAL_TECNICO_IMPORT_VERSION,
          savedAt: parsed.savedAt,
          items: parsed.items.map(normalizeStoredMetadata).filter(Boolean) as MaterialTecnicoImportMetadata[],
        };
      }
    } catch {
      // Snapshot ausente/corrompido volta para o catálogo vazio local.
    }
    return emptySnapshot();
  };
  const saveItems = async (items: MaterialTecnicoImportMetadata[]): Promise<void> => {
    await storage.setItem(MATERIAL_TECNICO_IMPORT_STORAGE_KEY, JSON.stringify({
      version: MATERIAL_TECNICO_IMPORT_VERSION,
      savedAt: now(),
      items,
    }));
  };
  const mutate = async <T>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.then(operation, operation);
    mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  };

  return {
    async listMaterialTecnicoImports(): Promise<MaterialTecnicoImportMetadata[]> {
      return (await loadSnapshot()).items;
    },
    async listMaterialTecnicoImportsByPropriedade(propriedadeId: string): Promise<MaterialTecnicoImportMetadata[]> {
      const id = firstNonEmptyString(propriedadeId);
      if (!id) return [];
      return (await loadSnapshot()).items.filter((item) => item.propriedade_id === id);
    },
    async listActiveMaterialTecnicoImportsByPropriedade(propriedadeId: string): Promise<MaterialTecnicoImportMetadata[]> {
      return (await this.listMaterialTecnicoImportsByPropriedade(propriedadeId))
        .filter((item) => item.status === 'ativo');
    },
    async getMaterialTecnicoImportById(id: string): Promise<MaterialTecnicoImportMetadata | null> {
      const normalized = firstNonEmptyString(id);
      if (!normalized) return null;
      return (await loadSnapshot()).items.find((item) => item.id === normalized) ?? null;
    },
    async createMaterialTecnicoImportMetadata(
      input: MaterialTecnicoImportMetadataInput & Record<string, any>
    ): Promise<MaterialTecnicoImportMetadata> {
      return mutate(async () => {
        const metadata = buildMetadata(input, { timestamp: now(), generateId });
        const snapshot = await loadSnapshot();
        if (snapshot.items.some((item) => item.id === metadata.id)) {
          throw new Error('MaterialTecnicoImport.id: metadado já existe');
        }
        await saveItems([metadata, ...snapshot.items]);
        return metadata;
      });
    },
    async updateMaterialTecnicoImportMetadata(
      id: string,
      patch: MaterialTecnicoImportMetadataPatch & Record<string, any>
    ): Promise<MaterialTecnicoImportMetadata> {
      return mutate(async () => {
        const normalized = firstNonEmptyString(id);
        if (!normalized) throw new Error('MaterialTecnicoImport.id: obrigatório');
        assertSmallMetadataOnly(patch);

        const snapshot = await loadSnapshot();
        const index = snapshot.items.findIndex((item) => item.id === normalized);
        if (index === -1) throw new Error('MaterialTecnicoImport: metadado não encontrado');

        const existing = snapshot.items[index];
        const updatedAt = now();
        const rebuilt = buildMetadata({
          ...existing,
          ...patch,
          id: existing.id,
          origem: 'arquivo_local',
          arquivo_nome_original:
            patch.arquivo_nome_original !== undefined
              ? patch.arquivo_nome_original
              : existing.arquivo_nome_original,
        }, {
          timestamp: existing.importado_em,
          generateId: () => existing.id,
        });
        const updated: MaterialTecnicoImportMetadata = {
          ...rebuilt,
          id: existing.id,
          importado_em: existing.importado_em,
          atualizado_em: updatedAt,
        };
        const items = [...snapshot.items];
        items[index] = updated;
        await saveItems(items);
        return updated;
      });
    },
    async markMaterialTecnicoImportAsActive(id: string): Promise<MaterialTecnicoImportMetadata> {
      return this.updateMaterialTecnicoImportMetadata(id, { status: 'ativo' });
    },
    async markMaterialTecnicoImportAsSubstituido(id: string): Promise<MaterialTecnicoImportMetadata> {
      return this.updateMaterialTecnicoImportMetadata(id, { status: 'substituido' });
    },
    async markMaterialTecnicoImportAsRemoved(id: string): Promise<MaterialTecnicoImportMetadata> {
      return this.updateMaterialTecnicoImportMetadata(id, { status: 'removido' });
    },
    async deleteMaterialTecnicoImportMetadata(id: string): Promise<boolean> {
      return mutate(async () => {
        const normalized = firstNonEmptyString(id);
        if (!normalized) return false;
        const snapshot = await loadSnapshot();
        const items = snapshot.items.filter((item) => item.id !== normalized);
        if (items.length === snapshot.items.length) return false;
        await saveItems(items);
        return true;
      });
    },
    __setStorageForTests(nextStorage: MaterialTecnicoImportStorageAdapter) {
      storage = nextStorage;
      mutationQueue = Promise.resolve();
    },
  };
};

export const MaterialTecnicoImportService = createMaterialTecnicoImportService();
