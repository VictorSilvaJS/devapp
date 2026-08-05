import {
  MATERIAL_TECNICO_CATEGORIAS,
  MATERIAL_TECNICO_FORMATOS,
  MaterialTecnicoCategoria,
  MaterialTecnicoFormato,
} from '../types/materialTecnicoLocal';

declare const require: (moduleName: string) => any;

export const MATERIAL_TECNICO_STORAGE_DIRECTORY_NAME = 'tche-materiais-tecnicos';

export type MaterialTecnicoStorageErrorCode =
  | 'MATERIAL_PROPRIEDADE_ID_REQUIRED'
  | 'MATERIAL_YEAR_REQUIRED'
  | 'MATERIAL_CATEGORY_INVALID'
  | 'MATERIAL_FORMAT_INVALID'
  | 'MATERIAL_SOURCE_URI_REQUIRED'
  | 'MATERIAL_ORIGINAL_NAME_REQUIRED'
  | 'MATERIAL_STORAGE_DIRECTORY_FAILED'
  | 'MATERIAL_INVALID_STORAGE_PATH'
  | 'MATERIAL_COPY_FAILED'
  | 'MATERIAL_STORED_FILE_NOT_FOUND'
  | 'MATERIAL_DELETE_FAILED'
  | 'MATERIAL_UNSAFE_DELETE_PATH'
  | 'MATERIAL_FILE_ALREADY_EXISTS'
  | 'MATERIAL_FILE_INFO_FAILED';

export interface MaterialTecnicoStorageError {
  code: MaterialTecnicoStorageErrorCode;
  message: string;
}

export interface CopyMaterialTecnicoToStorageInput {
  propriedade_id: string;
  ano: number;
  categoria: MaterialTecnicoCategoria;
  formato_arquivo: MaterialTecnicoFormato;
  sourceUri: string;
  originalName: string;
  importId?: string;
  overwrite?: boolean;
}

export interface BuildMaterialTecnicoStorageUriInput {
  propriedade_id: string;
  ano: number;
  categoria: MaterialTecnicoCategoria;
  formato_arquivo: MaterialTecnicoFormato;
  importId?: string;
  originalName: string;
}

export interface StoredMaterialTecnicoFile {
  propriedade_id: string;
  ano: number;
  categoria: MaterialTecnicoCategoria;
  formato_arquivo: MaterialTecnicoFormato;
  uri: string;
  name: string;
  originalName: string;
  size?: number;
  mimeType: string;
  copiedAt: string;
}

export interface MaterialTecnicoStoredFileInfo {
  uri: string;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
}

export interface MaterialTecnicoStorageCopyResult {
  ok: boolean;
  file?: StoredMaterialTecnicoFile;
  error?: MaterialTecnicoStorageError;
}

export interface MaterialTecnicoStorageInfoResult {
  ok: boolean;
  info?: MaterialTecnicoStoredFileInfo;
  error?: MaterialTecnicoStorageError;
}

export interface MaterialTecnicoStorageDeleteResult {
  ok: boolean;
  deleted: boolean;
  error?: MaterialTecnicoStorageError;
}

export interface MaterialTecnicoFileSystemInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  [key: string]: unknown;
}

export interface MaterialTecnicoFileSystemAdapter {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string, options?: Record<string, unknown>) => Promise<MaterialTecnicoFileSystemInfo>;
  makeDirectoryAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface MaterialTecnicoStorageServiceDeps {
  fileSystem?: MaterialTecnicoFileSystemAdapter;
  now?: () => string;
  generateImportId?: () => string;
}

const MAX_PATH_SEGMENT_LENGTH = 80;
const MAX_FILE_BASE_LENGTH = 120;
const MIME_BY_FORMAT: Record<MaterialTecnicoFormato, string> = {
  png: 'image/png',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeUri = (uri: string): string => firstNonEmptyString(uri).replace(/\\/g, '/');
const ensureTrailingSlash = (uri: string): string => {
  const normalized = normalizeUri(uri);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};
const stripPathComponents = (value: string): string => {
  const parts = value.replace(/\0/g, '').split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : value;
};
const slugify = (value: string, fallback: string, maxLength: number): string => {
  const result = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
  return result || fallback;
};

const isCategoria = (value: unknown): value is MaterialTecnicoCategoria =>
  typeof value === 'string'
  && MATERIAL_TECNICO_CATEGORIAS.includes(value as MaterialTecnicoCategoria);
const isFormato = (value: unknown): value is MaterialTecnicoFormato =>
  typeof value === 'string'
  && MATERIAL_TECNICO_FORMATOS.includes(value as MaterialTecnicoFormato);
const isValidYear = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;

const getFormatoFromFileName = (name: string): MaterialTecnicoFormato | null => {
  const normalized = stripPathComponents(firstNonEmptyString(name)).toLowerCase();
  if (normalized.endsWith('.png')) return 'png';
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.zip')) return 'zip';
  return null;
};

const getDefaultFileSystem = (): MaterialTecnicoFileSystemAdapter =>
  require('expo-file-system/legacy') as MaterialTecnicoFileSystemAdapter;
const resolveFileSystem = (deps: MaterialTecnicoStorageServiceDeps): MaterialTecnicoFileSystemAdapter =>
  deps.fileSystem ?? getDefaultFileSystem();
const createDefaultImportId = (): string =>
  `material_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildError = (
  code: MaterialTecnicoStorageErrorCode,
  message: string
): MaterialTecnicoStorageError => ({ code, message });

const resolveBaseDirectoryUri = (fileSystem: MaterialTecnicoFileSystemAdapter): string =>
  ensureTrailingSlash(`${firstNonEmptyString(fileSystem.documentDirectory)}${MATERIAL_TECNICO_STORAGE_DIRECTORY_NAME}/`);

export const sanitizeMaterialTecnicoPathSegment = (
  value: string,
  fallback = 'item'
): string => slugify(stripPathComponents(firstNonEmptyString(value)), fallback, MAX_PATH_SEGMENT_LENGTH);

export const sanitizeMaterialTecnicoFileName = (
  name: string,
  formato: MaterialTecnicoFormato
): string => {
  const raw = stripPathComponents(firstNonEmptyString(name));
  const extension = `.${formato}`;
  const base = raw.toLowerCase().endsWith(extension)
    ? raw.slice(0, -extension.length)
    : raw.replace(/\.[^.]+$/, '');
  return `${slugify(base, 'material-tecnico', MAX_FILE_BASE_LENGTH)}${extension}`;
};

export const buildMaterialTecnicoStorageDirectoryUri = (
  input: Pick<BuildMaterialTecnicoStorageUriInput, 'propriedade_id' | 'ano' | 'categoria'>,
  deps: MaterialTecnicoStorageServiceDeps = {}
): string => {
  const fileSystem = resolveFileSystem(deps);
  const base = resolveBaseDirectoryUri(fileSystem);
  const propriedade = sanitizeMaterialTecnicoPathSegment(input.propriedade_id, 'propriedade');
  const ano = String(input.ano);
  const categoria = sanitizeMaterialTecnicoPathSegment(input.categoria, 'material');
  return ensureTrailingSlash(`${base}${propriedade}/${ano}/${categoria}/`);
};

export const buildMaterialTecnicoStorageUri = (
  input: BuildMaterialTecnicoStorageUriInput,
  deps: MaterialTecnicoStorageServiceDeps = {}
): string => {
  const directory = buildMaterialTecnicoStorageDirectoryUri(input, deps);
  const id = sanitizeMaterialTecnicoPathSegment(
    firstNonEmptyString(input.importId) || (deps.generateImportId ?? createDefaultImportId)(),
    'material'
  );
  return `${directory}${id}-${sanitizeMaterialTecnicoFileName(input.originalName, input.formato_arquivo)}`;
};

export const isSafeMaterialTecnicoStorageUri = (
  uri: string,
  deps: MaterialTecnicoStorageServiceDeps = {}
): boolean => {
  const fileSystem = resolveFileSystem(deps);
  const normalized = normalizeUri(uri);
  const base = resolveBaseDirectoryUri(fileSystem);
  if (!firstNonEmptyString(fileSystem.documentDirectory) || !normalized.startsWith(base)) return false;
  const relative = normalized.slice(base.length);
  if (
    !relative
    || relative.includes('..')
    || relative.includes('%')
    || relative.includes('?')
    || relative.includes('#')
    || relative.includes('\0')
  ) return false;
  const parts = relative.split('/').filter(Boolean);
  if (parts.length !== 4 || !/^\d{4}$/.test(parts[1])) return false;
  if (!/^[a-z0-9_-]{1,80}$/.test(parts[0])) return false;
  if (!isCategoria(parts[2])) return false;
  const lowerName = parts[3].toLowerCase();
  if (!/^[a-z0-9_-]+-[a-z0-9_-]+\.(png|pdf|zip)$/.test(lowerName)) return false;
  return MATERIAL_TECNICO_FORMATOS.some((format) => lowerName.endsWith(`.${format}`));
};

const normalizeInfo = (
  uri: string,
  info: MaterialTecnicoFileSystemInfo
): MaterialTecnicoStoredFileInfo => ({
  uri,
  exists: info.exists === true,
  isDirectory: typeof info.isDirectory === 'boolean' ? info.isDirectory : undefined,
  size: typeof info.size === 'number' && Number.isFinite(info.size) && info.size >= 0
    ? info.size
    : undefined,
});

export const ensureMaterialTecnicoStorageDirectory = async (
  input: Pick<BuildMaterialTecnicoStorageUriInput, 'propriedade_id' | 'ano' | 'categoria'>,
  deps: MaterialTecnicoStorageServiceDeps = {}
): Promise<{ ok: boolean; uri?: string; error?: MaterialTecnicoStorageError }> => {
  if (!firstNonEmptyString(input.propriedade_id)) {
    return { ok: false, error: buildError('MATERIAL_PROPRIEDADE_ID_REQUIRED', 'propriedade_id é obrigatório.') };
  }
  if (!isValidYear(input.ano)) {
    return { ok: false, error: buildError('MATERIAL_YEAR_REQUIRED', 'Ano válido é obrigatório.') };
  }
  if (!isCategoria(input.categoria)) {
    return { ok: false, error: buildError('MATERIAL_CATEGORY_INVALID', 'Categoria de material inválida.') };
  }

  const fileSystem = resolveFileSystem(deps);
  const documentDirectory = firstNonEmptyString(fileSystem.documentDirectory);
  if (!documentDirectory) {
    return { ok: false, error: buildError('MATERIAL_STORAGE_DIRECTORY_FAILED', 'Storage interno indisponível.') };
  }
  const base = resolveBaseDirectoryUri(fileSystem);
  const propriedade = ensureTrailingSlash(`${base}${sanitizeMaterialTecnicoPathSegment(input.propriedade_id, 'propriedade')}/`);
  const ano = ensureTrailingSlash(`${propriedade}${input.ano}/`);
  const categoria = buildMaterialTecnicoStorageDirectoryUri(input, { ...deps, fileSystem });

  try {
    for (const directory of [base, propriedade, ano, categoria]) {
      const info = await fileSystem.getInfoAsync(directory);
      if (info.exists && info.isDirectory === false) {
        return { ok: false, error: buildError('MATERIAL_STORAGE_DIRECTORY_FAILED', 'Caminho reservado não é um diretório.') };
      }
      if (!info.exists) await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
    return { ok: true, uri: categoria };
  } catch {
    return { ok: false, error: buildError('MATERIAL_STORAGE_DIRECTORY_FAILED', 'Não foi possível preparar o diretório interno.') };
  }
};

export const getStoredMaterialTecnicoInfo = async (
  uri: string,
  deps: MaterialTecnicoStorageServiceDeps = {}
): Promise<MaterialTecnicoStorageInfoResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalized = normalizeUri(uri);
  if (!isSafeMaterialTecnicoStorageUri(normalized, { ...deps, fileSystem })) {
    return { ok: false, error: buildError('MATERIAL_INVALID_STORAGE_PATH', 'URI fora do diretório de materiais técnicos.') };
  }
  try {
    return { ok: true, info: normalizeInfo(normalized, await fileSystem.getInfoAsync(normalized)) };
  } catch {
    return { ok: false, error: buildError('MATERIAL_FILE_INFO_FAILED', 'Não foi possível consultar o arquivo armazenado.') };
  }
};

export const copyMaterialTecnicoToInternalStorage = async (
  input: CopyMaterialTecnicoToStorageInput,
  deps: MaterialTecnicoStorageServiceDeps = {}
): Promise<MaterialTecnicoStorageCopyResult> => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id);
  if (!propriedadeId) {
    return { ok: false, error: buildError('MATERIAL_PROPRIEDADE_ID_REQUIRED', 'Propriedade é obrigatória para copiar o arquivo.') };
  }
  if (!isValidYear(input.ano)) {
    return { ok: false, error: buildError('MATERIAL_YEAR_REQUIRED', 'Ano válido é obrigatório para copiar o arquivo.') };
  }
  if (!isCategoria(input.categoria)) {
    return { ok: false, error: buildError('MATERIAL_CATEGORY_INVALID', 'Categoria de material inválida.') };
  }
  if (!isFormato(input.formato_arquivo)) {
    return { ok: false, error: buildError('MATERIAL_FORMAT_INVALID', 'Formato de material inválido.') };
  }
  const sourceUri = firstNonEmptyString(input.sourceUri);
  if (!sourceUri) {
    return { ok: false, error: buildError('MATERIAL_SOURCE_URI_REQUIRED', 'URI de origem é obrigatória.') };
  }
  const originalName = typeof input.originalName === 'string' ? input.originalName : '';
  if (!firstNonEmptyString(originalName)) {
    return { ok: false, error: buildError('MATERIAL_ORIGINAL_NAME_REQUIRED', 'Nome original do arquivo é obrigatório.') };
  }
  const originalFormato = getFormatoFromFileName(originalName);
  if (!originalFormato || originalFormato !== input.formato_arquivo) {
    return {
      ok: false,
      error: buildError(
        'MATERIAL_FORMAT_INVALID',
        'O nome original deve terminar com a extensão PNG, PDF ou ZIP correspondente ao formato informado.'
      ),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const directory = await ensureMaterialTecnicoStorageDirectory({
    propriedade_id: propriedadeId,
    ano: input.ano,
    categoria: input.categoria,
  }, { ...deps, fileSystem });
  if (!directory.ok) return { ok: false, error: directory.error };

  const destinationUri = buildMaterialTecnicoStorageUri({
    propriedade_id: propriedadeId,
    ano: input.ano,
    categoria: input.categoria,
    formato_arquivo: input.formato_arquivo,
    importId: input.importId,
    originalName: input.originalName,
  }, { ...deps, fileSystem });
  if (!isSafeMaterialTecnicoStorageUri(destinationUri, { ...deps, fileSystem })) {
    return { ok: false, error: buildError('MATERIAL_INVALID_STORAGE_PATH', 'Destino de material inválido.') };
  }

  let shouldDeleteExistingDestination = false;
  try {
    const existing = await fileSystem.getInfoAsync(destinationUri);
    if (existing.exists && !input.overwrite) {
      return { ok: false, error: buildError('MATERIAL_FILE_ALREADY_EXISTS', 'O arquivo já existe no storage interno.') };
    }
    if (existing.exists && existing.isDirectory === true) {
      return { ok: false, error: buildError('MATERIAL_INVALID_STORAGE_PATH', 'O destino aponta para um diretório.') };
    }
    shouldDeleteExistingDestination = existing.exists === true;
  } catch {
    return { ok: false, error: buildError('MATERIAL_FILE_INFO_FAILED', 'Não foi possível verificar o destino do arquivo.') };
  }

  if (shouldDeleteExistingDestination) {
    try {
      await fileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch {
      return { ok: false, error: buildError('MATERIAL_DELETE_FAILED', 'Não foi possível remover o material anterior antes de sobrescrever.') };
    }
  }

  try {
    await fileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch {
    try {
      const partial = await fileSystem.getInfoAsync(destinationUri);
      if (partial.exists && partial.isDirectory !== true) {
        await fileSystem.deleteAsync(destinationUri, { idempotent: true });
      }
    } catch {
      // Limpeza de melhor esforco; o erro principal continua sendo a copia.
    }
    return { ok: false, error: buildError('MATERIAL_COPY_FAILED', 'Não foi possível copiar o material para o storage interno.') };
  }

  try {
    const info = await fileSystem.getInfoAsync(destinationUri);
    if (!info.exists || info.isDirectory === true) {
      if (info.exists && info.isDirectory !== true) {
        try {
          await fileSystem.deleteAsync(destinationUri, { idempotent: true });
        } catch {
          // Limpeza de melhor esforco; a verificacao continua sendo a falha principal.
        }
      }
      return { ok: false, error: buildError('MATERIAL_STORED_FILE_NOT_FOUND', 'Arquivo não encontrado após a cópia.') };
    }
    const destinationParts = destinationUri.split('/').filter(Boolean);
    return {
      ok: true,
      file: {
        propriedade_id: propriedadeId,
        ano: input.ano,
        categoria: input.categoria,
        formato_arquivo: input.formato_arquivo,
        uri: destinationUri,
        name: destinationParts[destinationParts.length - 1]
          ?? sanitizeMaterialTecnicoFileName(input.originalName, input.formato_arquivo),
        originalName,
        size: normalizeInfo(destinationUri, info).size,
        mimeType: MIME_BY_FORMAT[input.formato_arquivo],
        copiedAt: (deps.now ?? (() => new Date().toISOString()))(),
      },
    };
  } catch {
    try {
      const partial = await fileSystem.getInfoAsync(destinationUri);
      if (partial.exists && partial.isDirectory !== true) {
        await fileSystem.deleteAsync(destinationUri, { idempotent: true });
      }
    } catch {
      // Limpeza de melhor esforco; a verificacao continua sendo a falha principal.
    }
    return { ok: false, error: buildError('MATERIAL_STORED_FILE_NOT_FOUND', 'Não foi possível confirmar o arquivo copiado.') };
  }
};

export const deleteStoredMaterialTecnico = async (
  uri: string,
  deps: MaterialTecnicoStorageServiceDeps = {}
): Promise<MaterialTecnicoStorageDeleteResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalized = normalizeUri(uri);
  if (!isSafeMaterialTecnicoStorageUri(normalized, { ...deps, fileSystem })) {
    return { ok: false, deleted: false, error: buildError('MATERIAL_UNSAFE_DELETE_PATH', 'Remoção recusada fora do diretório interno.') };
  }
  try {
    const info = await fileSystem.getInfoAsync(normalized);
    if (!info.exists) return { ok: true, deleted: false };
    if (info.isDirectory === true) {
      return { ok: false, deleted: false, error: buildError('MATERIAL_UNSAFE_DELETE_PATH', 'Remoção de diretório recusada.') };
    }
    await fileSystem.deleteAsync(normalized, { idempotent: true });
    return { ok: true, deleted: true };
  } catch {
    return { ok: false, deleted: false, error: buildError('MATERIAL_DELETE_FAILED', 'Não foi possível remover o material armazenado.') };
  }
};

export const createMaterialTecnicoStorageService = (
  deps: MaterialTecnicoStorageServiceDeps = {}
) => ({
  buildMaterialTecnicoStorageDirectoryUri: (
    input: Pick<BuildMaterialTecnicoStorageUriInput, 'propriedade_id' | 'ano' | 'categoria'>
  ) => buildMaterialTecnicoStorageDirectoryUri(input, deps),
  buildMaterialTecnicoStorageUri: (input: BuildMaterialTecnicoStorageUriInput) =>
    buildMaterialTecnicoStorageUri(input, deps),
  copyMaterialTecnicoToInternalStorage: (input: CopyMaterialTecnicoToStorageInput) =>
    copyMaterialTecnicoToInternalStorage(input, deps),
  getStoredMaterialTecnicoInfo: (uri: string) => getStoredMaterialTecnicoInfo(uri, deps),
  deleteStoredMaterialTecnico: (uri: string) => deleteStoredMaterialTecnico(uri, deps),
  isSafeMaterialTecnicoStorageUri: (uri: string) => isSafeMaterialTecnicoStorageUri(uri, deps),
});

export const MaterialTecnicoStorageService = createMaterialTecnicoStorageService();
