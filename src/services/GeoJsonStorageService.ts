import {
  GeoJsonNormalizeOptions,
  GeoJsonValidationResult,
  validateAndNormalizeGeoJson,
} from '../utils/geojsonImportValidator';

declare const require: (moduleName: string) => any;

export const GEOJSON_STORAGE_DIRECTORY_NAME = 'tche-geojson-imports';
export const DEFAULT_GEOJSON_FILE_NAME = 'limites-talhoes.geojson';

export type GeoJsonStorageErrorCode =
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'SOURCE_URI_REQUIRED'
  | 'STORAGE_DIRECTORY_FAILED'
  | 'INVALID_STORAGE_PATH'
  | 'DESTINATION_EXISTS'
  | 'COPY_FAILED'
  | 'WRITE_FALLBACK_FAILED'
  | 'STORED_FILE_NOT_FOUND'
  | 'READ_STORED_FILE_FAILED'
  | 'DELETE_FAILED'
  | 'UNSAFE_DELETE_PATH'
  | 'FILE_INFO_FAILED';

export interface GeoJsonStorageError {
  code: GeoJsonStorageErrorCode;
  message: string;
}

export interface CopyGeoJsonToStorageInput {
  propriedade_id: string;
  sourceUri: string;
  originalName: string;
  content?: string;
  importId?: string;
  overwrite?: boolean;
}

export interface BuildGeoJsonStorageUriInput {
  propriedade_id: string;
  importId?: string;
  originalName: string;
}

export interface StoredGeoJsonFile {
  propriedade_id: string;
  uri: string;
  name: string;
  originalName: string;
  size?: number;
  copiedAt: string;
}

export interface GeoJsonStorageDirectoryResult {
  ok: boolean;
  uri?: string;
  error?: GeoJsonStorageError;
}

export interface GeoJsonStorageCopyResult {
  ok: boolean;
  file?: StoredGeoJsonFile;
  error?: GeoJsonStorageError;
}

export interface GeoJsonStorageReadResult {
  ok: boolean;
  content?: string;
  error?: GeoJsonStorageError;
}

export interface GeoJsonStoredFileInfo {
  uri: string;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
}

export interface GeoJsonStorageInfoResult {
  ok: boolean;
  info?: GeoJsonStoredFileInfo;
  error?: GeoJsonStorageError;
}

export interface GeoJsonStorageDeleteResult {
  ok: boolean;
  deleted: boolean;
  error?: GeoJsonStorageError;
}

export interface GeoJsonStoredValidationResult {
  ok: boolean;
  validation?: GeoJsonValidationResult;
  error?: GeoJsonStorageError;
}

export interface GeoJsonFileSystemInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  [key: string]: unknown;
}

export interface GeoJsonFileSystemAdapter {
  documentDirectory?: string | null;
  EncodingType?: {
    UTF8?: string;
    [key: string]: unknown;
  };
  getInfoAsync: (uri: string, options?: Record<string, unknown>) => Promise<GeoJsonFileSystemInfo>;
  makeDirectoryAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  writeAsStringAsync: (
    uri: string,
    contents: string,
    options?: Record<string, unknown>
  ) => Promise<void>;
  readAsStringAsync: (uri: string, options?: Record<string, unknown>) => Promise<string>;
  deleteAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface GeoJsonStorageServiceDeps {
  fileSystem?: GeoJsonFileSystemAdapter;
  now?: () => string;
  generateImportId?: () => string;
  validateGeoJson?: (
    input: unknown,
    options: GeoJsonNormalizeOptions
  ) => GeoJsonValidationResult;
}

const SUPPORTED_EXTENSIONS = ['.geojson', '.json'];
const DEFAULT_GEOJSON_BASE_NAME = 'limites-talhoes';
const MAX_FILE_BASE_LENGTH = 80;
const MAX_PATH_SEGMENT_LENGTH = 80;

const getDefaultFileSystem = (): GeoJsonFileSystemAdapter =>
  require('expo-file-system/legacy') as GeoJsonFileSystemAdapter;

const createDefaultImportId = (): string =>
  `geojson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

const normalizeUri = (uri: string): string => firstNonEmptyString(uri).replace(/\\/g, '/');

const ensureTrailingSlash = (uri: string): string => {
  const normalized = normalizeUri(uri);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const stripPathComponents = (value: string): string => {
  const withoutNullBytes = value.replace(/\0/g, '');
  const parts = withoutNullBytes.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : withoutNullBytes;
};

const slugifyPathValue = (
  value: string,
  fallback: string,
  maxLength: number
): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
};

const resolveSupportedExtension = (name: string): '.geojson' | '.json' | null => {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.geojson')) return '.geojson';
  if (lowerName.endsWith('.json')) return '.json';
  return null;
};

const removeExtension = (name: string, extension: string): string =>
  name.slice(0, name.length - extension.length);

const buildError = (
  code: GeoJsonStorageErrorCode,
  message: string
): GeoJsonStorageError => ({ code, message });

const resolveFileSystem = (deps: GeoJsonStorageServiceDeps = {}): GeoJsonFileSystemAdapter =>
  deps.fileSystem ?? getDefaultFileSystem();

const resolveEncoding = (fileSystem: GeoJsonFileSystemAdapter): string =>
  fileSystem.EncodingType?.UTF8 ?? 'utf8';

const resolveBaseDirectoryUri = (fileSystem: GeoJsonFileSystemAdapter): string =>
  ensureTrailingSlash(`${firstNonEmptyString(fileSystem.documentDirectory)}${GEOJSON_STORAGE_DIRECTORY_NAME}/`);

const normalizeInfo = (uri: string, info: GeoJsonFileSystemInfo): GeoJsonStoredFileInfo => ({
  uri,
  exists: info.exists === true,
  isDirectory: typeof info.isDirectory === 'boolean' ? info.isDirectory : undefined,
  size: typeof info.size === 'number' && Number.isFinite(info.size) && info.size >= 0
    ? info.size
    : undefined,
});

export const sanitizeGeoJsonPathSegment = (
  value: string,
  fallback = 'propriedade'
): string => {
  const raw = stripPathComponents(firstNonEmptyString(value));
  return slugifyPathValue(raw, fallback, MAX_PATH_SEGMENT_LENGTH);
};

export const sanitizeGeoJsonFileName = (name: string): string => {
  const rawName = stripPathComponents(firstNonEmptyString(name));
  const extension = resolveSupportedExtension(rawName);
  if (!extension) return DEFAULT_GEOJSON_FILE_NAME;

  const rawBase = removeExtension(rawName, extension);
  const baseName = slugifyPathValue(rawBase, DEFAULT_GEOJSON_BASE_NAME, MAX_FILE_BASE_LENGTH);

  return `${baseName}${extension}`;
};

export const buildGeoJsonStorageDirectoryUri = (
  propriedadeId: string,
  deps: GeoJsonStorageServiceDeps = {}
): string => {
  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeSegment = sanitizeGeoJsonPathSegment(propriedadeId);

  return ensureTrailingSlash(`${baseDirectory}${propriedadeSegment}/`);
};

export const buildGeoJsonStorageUri = (
  input: BuildGeoJsonStorageUriInput,
  deps: GeoJsonStorageServiceDeps = {}
): string => {
  const directoryUri = buildGeoJsonStorageDirectoryUri(input.propriedade_id, deps);
  const importId = firstNonEmptyString(input.importId)
    || (deps.generateImportId ?? createDefaultImportId)();
  const importSegment = sanitizeGeoJsonPathSegment(importId, 'geojson');
  const fileName = sanitizeGeoJsonFileName(input.originalName);

  return `${directoryUri}${importSegment}-${fileName}`;
};

export const isSafeStoredGeoJsonFileUri = (
  uri: string,
  deps: GeoJsonStorageServiceDeps = {}
): boolean => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);

  if (!normalizedUri.startsWith(baseDirectory)) return false;

  const relativePath = normalizedUri.slice(baseDirectory.length);
  if (!relativePath || relativePath.includes('..')) return false;

  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length !== 2) return false;

  const fileName = parts[1];
  return resolveSupportedExtension(fileName) !== null;
};

export const ensureGeoJsonStorageDirectory = async (
  propriedadeId: string,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStorageDirectoryResult> => {
  const normalizedPropriedadeId = firstNonEmptyString(propriedadeId);
  if (!normalizedPropriedadeId) {
    return {
      ok: false,
      error: buildError('PROPRIEDADE_ID_REQUIRED', 'propriedade_id e obrigatorio para o storage de GeoJSON.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeDirectory = buildGeoJsonStorageDirectoryUri(normalizedPropriedadeId, {
    ...deps,
    fileSystem,
  });

  try {
    for (const directory of [baseDirectory, propriedadeDirectory]) {
      const info = await fileSystem.getInfoAsync(directory);
      if (info.exists && info.isDirectory === false) {
        return {
          ok: false,
          error: buildError('STORAGE_DIRECTORY_FAILED', 'Caminho reservado para GeoJSON nao e um diretorio.'),
        };
      }

      if (!info.exists) {
        await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
    }

    return {
      ok: true,
      uri: propriedadeDirectory,
    };
  } catch {
    return {
      ok: false,
      error: buildError('STORAGE_DIRECTORY_FAILED', 'Nao foi possivel preparar o diretorio interno de GeoJSON.'),
    };
  }
};

export const getStoredGeoJsonInfo = async (
  uri: string,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStorageInfoResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafeStoredGeoJsonFileUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('INVALID_STORAGE_PATH', 'URI fora do diretorio interno de GeoJSON.'),
    };
  }

  try {
    const info = await fileSystem.getInfoAsync(normalizedUri);
    return {
      ok: true,
      info: normalizeInfo(normalizedUri, info),
    };
  } catch {
    return {
      ok: false,
      error: buildError('FILE_INFO_FAILED', 'Nao foi possivel consultar o arquivo GeoJSON armazenado.'),
    };
  }
};

export const copyGeoJsonToInternalStorage = async (
  input: CopyGeoJsonToStorageInput,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStorageCopyResult> => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id);
  const sourceUri = firstNonEmptyString(input.sourceUri);

  if (!propriedadeId) {
    return {
      ok: false,
      error: buildError('PROPRIEDADE_ID_REQUIRED', 'propriedade_id e obrigatorio para copiar GeoJSON.'),
    };
  }

  if (!sourceUri) {
    return {
      ok: false,
      error: buildError('SOURCE_URI_REQUIRED', 'sourceUri e obrigatorio para copiar GeoJSON.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const directory = await ensureGeoJsonStorageDirectory(propriedadeId, { ...deps, fileSystem });
  if (!directory.ok || !directory.uri) {
    return {
      ok: false,
      error: directory.error ?? buildError('STORAGE_DIRECTORY_FAILED', 'Nao foi possivel preparar o storage.'),
    };
  }

  const destinationUri = buildGeoJsonStorageUri({
    propriedade_id: propriedadeId,
    importId: input.importId,
    originalName: input.originalName,
  }, { ...deps, fileSystem });
  const name = destinationUri.split('/').filter(Boolean).pop() ?? sanitizeGeoJsonFileName(input.originalName);

  if (!isSafeStoredGeoJsonFileUri(destinationUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('INVALID_STORAGE_PATH', 'Destino de GeoJSON invalido.'),
    };
  }

  let shouldDeleteExistingDestination = false;

  try {
    const existingInfo = await fileSystem.getInfoAsync(destinationUri);
    if (existingInfo.exists && !input.overwrite) {
      return {
        ok: false,
        error: buildError('DESTINATION_EXISTS', 'Arquivo GeoJSON ja existe no storage interno.'),
      };
    }

    if (existingInfo.exists && existingInfo.isDirectory === true) {
      return {
        ok: false,
        error: buildError('INVALID_STORAGE_PATH', 'Destino de GeoJSON aponta para um diretorio.'),
      };
    }

    shouldDeleteExistingDestination = existingInfo.exists === true;
  } catch {
    return {
      ok: false,
      error: buildError('FILE_INFO_FAILED', 'Nao foi possivel verificar o destino do GeoJSON.'),
    };
  }

  if (shouldDeleteExistingDestination) {
    try {
      await fileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch {
      return {
        ok: false,
        error: buildError('DELETE_FAILED', 'Nao foi possivel remover o GeoJSON anterior antes de sobrescrever.'),
      };
    }
  }

  try {
    await fileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch {
    if (typeof input.content !== 'string') {
      return {
        ok: false,
        error: buildError('COPY_FAILED', 'Nao foi possivel copiar o GeoJSON para o storage interno.'),
      };
    }

    try {
      await fileSystem.writeAsStringAsync(destinationUri, input.content, {
        encoding: resolveEncoding(fileSystem),
      });
    } catch {
      return {
        ok: false,
        error: buildError('WRITE_FALLBACK_FAILED', 'Nao foi possivel gravar o GeoJSON pelo fallback textual.'),
      };
    }
  }

  try {
    const storedInfo = await fileSystem.getInfoAsync(destinationUri);
    if (!storedInfo.exists) {
      return {
        ok: false,
        error: buildError('STORED_FILE_NOT_FOUND', 'Arquivo GeoJSON nao foi encontrado apos a copia.'),
      };
    }

    return {
      ok: true,
      file: {
        propriedade_id: propriedadeId,
        uri: destinationUri,
        name,
        originalName: firstNonEmptyString(input.originalName) || DEFAULT_GEOJSON_FILE_NAME,
        size: normalizeInfo(destinationUri, storedInfo).size,
        copiedAt: (deps.now ?? (() => new Date().toISOString()))(),
      },
    };
  } catch {
    return {
      ok: false,
      error: buildError('STORED_FILE_NOT_FOUND', 'Nao foi possivel confirmar a existencia do GeoJSON copiado.'),
    };
  }
};

export const readStoredGeoJson = async (
  uri: string,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStorageReadResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafeStoredGeoJsonFileUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('INVALID_STORAGE_PATH', 'URI fora do diretorio interno de GeoJSON.'),
    };
  }

  try {
    const content = await fileSystem.readAsStringAsync(normalizedUri, {
      encoding: resolveEncoding(fileSystem),
    });

    return {
      ok: true,
      content,
    };
  } catch {
    return {
      ok: false,
      error: buildError('READ_STORED_FILE_FAILED', 'Nao foi possivel ler o GeoJSON armazenado.'),
    };
  }
};

export const validateStoredGeoJson = async (
  uri: string,
  options: GeoJsonNormalizeOptions,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStoredValidationResult> => {
  const readResult = await readStoredGeoJson(uri, deps);
  if (!readResult.ok || readResult.content === undefined) {
    return {
      ok: false,
      error: readResult.error ?? buildError('READ_STORED_FILE_FAILED', 'Nao foi possivel ler o GeoJSON armazenado.'),
    };
  }

  const validateGeoJson = deps.validateGeoJson ?? validateAndNormalizeGeoJson;
  const validation = validateGeoJson(readResult.content, options);

  return {
    ok: validation.ok,
    validation,
  };
};

export const deleteStoredGeoJson = async (
  uri: string,
  deps: GeoJsonStorageServiceDeps = {}
): Promise<GeoJsonStorageDeleteResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafeStoredGeoJsonFileUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      deleted: false,
      error: buildError('UNSAFE_DELETE_PATH', 'Remocao recusada fora do diretorio interno de GeoJSON.'),
    };
  }

  try {
    const info = await fileSystem.getInfoAsync(normalizedUri);
    if (!info.exists) {
      return {
        ok: true,
        deleted: false,
      };
    }

    if (info.isDirectory === true) {
      return {
        ok: false,
        deleted: false,
        error: buildError('UNSAFE_DELETE_PATH', 'Remocao de diretorio GeoJSON recusada.'),
      };
    }

    await fileSystem.deleteAsync(normalizedUri, { idempotent: true });

    return {
      ok: true,
      deleted: true,
    };
  } catch {
    return {
      ok: false,
      deleted: false,
      error: buildError('DELETE_FAILED', 'Nao foi possivel remover o GeoJSON armazenado.'),
    };
  }
};

export const createGeoJsonStorageService = (
  deps: GeoJsonStorageServiceDeps = {}
) => ({
  sanitizeGeoJsonFileName,
  sanitizeGeoJsonPathSegment,
  buildGeoJsonStorageDirectoryUri: (propriedadeId: string) =>
    buildGeoJsonStorageDirectoryUri(propriedadeId, deps),
  buildGeoJsonStorageUri: (input: BuildGeoJsonStorageUriInput) =>
    buildGeoJsonStorageUri(input, deps),
  ensureGeoJsonStorageDirectory: (propriedadeId: string) =>
    ensureGeoJsonStorageDirectory(propriedadeId, deps),
  copyGeoJsonToInternalStorage: (input: CopyGeoJsonToStorageInput) =>
    copyGeoJsonToInternalStorage(input, deps),
  readStoredGeoJson: (uri: string) => readStoredGeoJson(uri, deps),
  validateStoredGeoJson: (uri: string, options: GeoJsonNormalizeOptions) =>
    validateStoredGeoJson(uri, options, deps),
  deleteStoredGeoJson: (uri: string) => deleteStoredGeoJson(uri, deps),
  getStoredGeoJsonInfo: (uri: string) => getStoredGeoJsonInfo(uri, deps),
});

export const GeoJsonStorageService = createGeoJsonStorageService();
