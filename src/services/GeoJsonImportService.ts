import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GEOJSON_IMPORT_STATUSES,
  GEOJSON_IMPORT_VERSION,
  GeoJsonImportMetadata,
  GeoJsonImportMetadataInput,
  GeoJsonImportMetadataPatch,
  GeoJsonImportStatus,
} from '../types/geojsonImport';

export const GEOJSON_IMPORT_STORAGE_KEY = '@tche:geojson-imports:v1';

interface GeoJsonImportSnapshot {
  version: number;
  savedAt: string;
  imports: GeoJsonImportMetadata[];
}

export interface GeoJsonImportStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

interface GeoJsonImportServiceDeps {
  storage?: GeoJsonImportStorageAdapter;
  now?: () => string;
  generateId?: () => string;
}

const asyncStorageAdapter: GeoJsonImportStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
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
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const normalizeGeometryTypes = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const types = Array.from(new Set(
    value
      .map((item) => firstNonEmptyString(item))
      .filter(Boolean)
  ));

  return types.length > 0 ? types : undefined;
};

const isGeoJsonImportStatus = (value: unknown): value is GeoJsonImportStatus =>
  typeof value === 'string' && GEOJSON_IMPORT_STATUSES.includes(value as GeoJsonImportStatus);

const normalizeStatus = (value: unknown): GeoJsonImportStatus =>
  isGeoJsonImportStatus(value) ? value : 'rascunho';

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

const isMetadataRecord = (value: any): value is GeoJsonImportMetadata =>
  typeof value?.id === 'string'
  && typeof value?.propriedade_id === 'string'
  && typeof value?.fazenda_id === 'string'
  && typeof value?.arquivo_nome_original === 'string'
  && typeof value?.importado_em === 'string'
  && typeof value?.atualizado_em === 'string'
  && isGeoJsonImportStatus(value?.status)
  && value?.origem === 'arquivo_local'
  && value?.versao === GEOJSON_IMPORT_VERSION;

const isSnapshot = (value: any): value is GeoJsonImportSnapshot =>
  value?.version === GEOJSON_IMPORT_VERSION
  && typeof value?.savedAt === 'string'
  && Array.isArray(value?.imports)
  && value.imports.every(isMetadataRecord);

const emptySnapshot = (): GeoJsonImportSnapshot => ({
  version: GEOJSON_IMPORT_VERSION,
  savedAt: '',
  imports: [],
});

const createDefaultId = (): string =>
  `geojson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildMetadataFromInput = (
  input: GeoJsonImportMetadataInput,
  params: {
    now: string;
    generateId: () => string;
  }
): GeoJsonImportMetadata => {
  const ids = resolvePropriedadeIds(input);
  const arquivoNomeOriginal = firstNonEmptyString(input.arquivo_nome_original);

  if (!ids.propriedade_id || !ids.fazenda_id) {
    throw new Error('GeoJsonImport.propriedade_id: obrigatório');
  }
  if (!arquivoNomeOriginal) {
    throw new Error('GeoJsonImport.arquivo_nome_original: obrigatório');
  }

  return {
    id: firstNonEmptyString(input.id) || params.generateId(),
    propriedade_id: ids.propriedade_id,
    fazenda_id: ids.fazenda_id,
    nome_propriedade: normalizeOptionalString(input.nome_propriedade),
    arquivo_nome_original: arquivoNomeOriginal,
    arquivo_uri_local: normalizeOptionalString(input.arquivo_uri_local),
    arquivo_tamanho_bytes: normalizeNumber(input.arquivo_tamanho_bytes),
    arquivo_mime: normalizeOptionalString(input.arquivo_mime),
    importado_por_usuario_id: normalizeOptionalString(input.importado_por_usuario_id),
    importado_por_nome: normalizeOptionalString(input.importado_por_nome),
    importado_em: params.now,
    atualizado_em: params.now,
    status: normalizeStatus(input.status),
    talhoes_count: normalizeInteger(input.talhoes_count),
    polygon_parts_count: normalizeInteger(input.polygon_parts_count),
    geometry_types: normalizeGeometryTypes(input.geometry_types),
    area_total_hectares: normalizeNumber(input.area_total_hectares),
    safra: normalizeOptionalString(input.safra),
    ano: normalizeInteger(input.ano),
    observacoes: normalizeOptionalString(input.observacoes),
    erro_validacao: normalizeOptionalString(input.erro_validacao),
    origem: 'arquivo_local',
    versao: GEOJSON_IMPORT_VERSION,
  };
};

const applyPatchToMetadata = (
  existing: GeoJsonImportMetadata,
  patch: GeoJsonImportMetadataPatch,
  atualizadoEm: string
): GeoJsonImportMetadata => {
  const ids = resolvePropriedadeIds({
    propriedade_id: patch.propriedade_id ?? existing.propriedade_id,
    fazenda_id: patch.fazenda_id ?? existing.fazenda_id,
  });
  const arquivoNomeOriginal = patch.arquivo_nome_original !== undefined
    ? firstNonEmptyString(patch.arquivo_nome_original)
    : existing.arquivo_nome_original;

  if (!ids.propriedade_id || !ids.fazenda_id) {
    throw new Error('GeoJsonImport.propriedade_id: obrigatório');
  }
  if (!arquivoNomeOriginal) {
    throw new Error('GeoJsonImport.arquivo_nome_original: obrigatório');
  }

  return {
    ...existing,
    propriedade_id: ids.propriedade_id,
    fazenda_id: ids.fazenda_id,
    nome_propriedade:
      patch.nome_propriedade !== undefined
        ? normalizeOptionalString(patch.nome_propriedade)
        : existing.nome_propriedade,
    arquivo_nome_original: arquivoNomeOriginal,
    arquivo_uri_local:
      patch.arquivo_uri_local !== undefined
        ? normalizeOptionalString(patch.arquivo_uri_local)
        : existing.arquivo_uri_local,
    arquivo_tamanho_bytes:
      patch.arquivo_tamanho_bytes !== undefined
        ? normalizeNumber(patch.arquivo_tamanho_bytes)
        : existing.arquivo_tamanho_bytes,
    arquivo_mime:
      patch.arquivo_mime !== undefined
        ? normalizeOptionalString(patch.arquivo_mime)
        : existing.arquivo_mime,
    importado_por_usuario_id:
      patch.importado_por_usuario_id !== undefined
        ? normalizeOptionalString(patch.importado_por_usuario_id)
        : existing.importado_por_usuario_id,
    importado_por_nome:
      patch.importado_por_nome !== undefined
        ? normalizeOptionalString(patch.importado_por_nome)
        : existing.importado_por_nome,
    status:
      patch.status !== undefined
        ? normalizeStatus(patch.status)
        : existing.status,
    talhoes_count:
      patch.talhoes_count !== undefined
        ? normalizeInteger(patch.talhoes_count)
        : existing.talhoes_count,
    polygon_parts_count:
      patch.polygon_parts_count !== undefined
        ? normalizeInteger(patch.polygon_parts_count)
        : existing.polygon_parts_count,
    geometry_types:
      patch.geometry_types !== undefined
        ? normalizeGeometryTypes(patch.geometry_types)
        : existing.geometry_types,
    area_total_hectares:
      patch.area_total_hectares !== undefined
        ? normalizeNumber(patch.area_total_hectares)
        : existing.area_total_hectares,
    safra:
      patch.safra !== undefined
        ? normalizeOptionalString(patch.safra)
        : existing.safra,
    ano:
      patch.ano !== undefined
        ? normalizeInteger(patch.ano)
        : existing.ano,
    observacoes:
      patch.observacoes !== undefined
        ? normalizeOptionalString(patch.observacoes)
        : existing.observacoes,
    erro_validacao:
      patch.erro_validacao !== undefined
        ? normalizeOptionalString(patch.erro_validacao)
        : existing.erro_validacao,
    atualizado_em: atualizadoEm,
    origem: 'arquivo_local',
    versao: GEOJSON_IMPORT_VERSION,
  };
};

const setSingleActiveForPropriedade = (
  imports: GeoJsonImportMetadata[],
  activeId: string,
  propriedadeId: string,
  atualizadoEm: string
): GeoJsonImportMetadata[] =>
  imports.map((item) => {
    if (item.id === activeId) {
      return {
        ...item,
        status: 'ativo',
        atualizado_em: atualizadoEm,
      };
    }

    if (item.propriedade_id === propriedadeId && item.status === 'ativo') {
      return {
        ...item,
        status: 'substituido',
        atualizado_em: atualizadoEm,
      };
    }

    return item;
  });

export const createGeoJsonImportService = ({
  storage = asyncStorageAdapter,
  now = () => new Date().toISOString(),
  generateId = createDefaultId,
}: GeoJsonImportServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();

  const loadSnapshot = async (): Promise<GeoJsonImportSnapshot> => {
    const raw = await storage.getItem(GEOJSON_IMPORT_STORAGE_KEY);
    if (!raw) return emptySnapshot();

    try {
      const parsed = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      return emptySnapshot();
    }
  };

  const saveImports = async (imports: GeoJsonImportMetadata[]): Promise<GeoJsonImportSnapshot> => {
    const snapshot: GeoJsonImportSnapshot = {
      version: GEOJSON_IMPORT_VERSION,
      savedAt: now(),
      imports,
    };
    await storage.setItem(GEOJSON_IMPORT_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  const mutate = async <T>(fn: () => Promise<T>): Promise<T> => {
    const nextMutation = mutationQueue.then(fn, fn);
    mutationQueue = nextMutation.then(() => undefined, () => undefined);
    return nextMutation;
  };

  const findIndexById = (imports: GeoJsonImportMetadata[], id: string): number =>
    imports.findIndex((item) => item.id === id);

  return {
    async listGeoJsonImports(): Promise<GeoJsonImportMetadata[]> {
      const snapshot = await loadSnapshot();
      return snapshot.imports;
    },

    async listGeoJsonImportsByPropriedade(propriedadeId: string): Promise<GeoJsonImportMetadata[]> {
      const id = firstNonEmptyString(propriedadeId);
      if (!id) return [];

      const snapshot = await loadSnapshot();
      return snapshot.imports.filter((item) => item.propriedade_id === id || item.fazenda_id === id);
    },

    async getActiveGeoJsonImportForPropriedade(propriedadeId: string): Promise<GeoJsonImportMetadata | null> {
      const imports = await this.listGeoJsonImportsByPropriedade(propriedadeId);
      return imports.find((item) => item.status === 'ativo') ?? null;
    },

    async getGeoJsonImportById(id: string): Promise<GeoJsonImportMetadata | null> {
      const normalizedId = firstNonEmptyString(id);
      if (!normalizedId) return null;

      const snapshot = await loadSnapshot();
      return snapshot.imports.find((item) => item.id === normalizedId) ?? null;
    },

    async createGeoJsonImportMetadata(input: GeoJsonImportMetadataInput): Promise<GeoJsonImportMetadata> {
      return mutate(async () => {
        const timestamp = now();
        const metadata = buildMetadataFromInput(input, { now: timestamp, generateId });
        const snapshot = await loadSnapshot();

        if (snapshot.imports.some((item) => item.id === metadata.id)) {
          throw new Error('GeoJsonImport.id: metadado já existe');
        }

        const imports = [metadata, ...snapshot.imports];
        const nextImports = metadata.status === 'ativo'
          ? setSingleActiveForPropriedade(imports, metadata.id, metadata.propriedade_id, timestamp)
          : imports;

        await saveImports(nextImports);
        return nextImports.find((item) => item.id === metadata.id) as GeoJsonImportMetadata;
      });
    },

    async updateGeoJsonImportMetadata(
      id: string,
      patch: GeoJsonImportMetadataPatch
    ): Promise<GeoJsonImportMetadata> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) throw new Error('GeoJsonImport.id: obrigatório');

        const snapshot = await loadSnapshot();
        const index = findIndexById(snapshot.imports, normalizedId);
        if (index === -1) throw new Error('GeoJsonImport: metadado não encontrado');

        const timestamp = now();
        const updated = applyPatchToMetadata(snapshot.imports[index], patch, timestamp);
        const imports = [...snapshot.imports];
        imports[index] = updated;

        const nextImports = updated.status === 'ativo'
          ? setSingleActiveForPropriedade(imports, updated.id, updated.propriedade_id, timestamp)
          : imports;

        await saveImports(nextImports);
        return nextImports.find((item) => item.id === updated.id) as GeoJsonImportMetadata;
      });
    },

    async markGeoJsonImportAsActive(id: string): Promise<GeoJsonImportMetadata> {
      return this.updateGeoJsonImportMetadata(id, { status: 'ativo' });
    },

    async markGeoJsonImportAsSubstituido(id: string): Promise<GeoJsonImportMetadata> {
      return this.updateGeoJsonImportMetadata(id, { status: 'substituido' });
    },

    async markGeoJsonImportAsRemoved(id: string): Promise<GeoJsonImportMetadata> {
      return this.updateGeoJsonImportMetadata(id, { status: 'removido' });
    },

    async deleteGeoJsonImportMetadata(id: string): Promise<boolean> {
      return mutate(async () => {
        const normalizedId = firstNonEmptyString(id);
        if (!normalizedId) return false;

        const snapshot = await loadSnapshot();
        const imports = snapshot.imports.filter((item) => item.id !== normalizedId);
        if (imports.length === snapshot.imports.length) return false;

        await saveImports(imports);
        return true;
      });
    },

    __setStorageForTests(nextStorage: GeoJsonImportStorageAdapter) {
      storage = nextStorage;
      mutationQueue = Promise.resolve();
    },
  };
};

export const GeoJsonImportService = createGeoJsonImportService();
