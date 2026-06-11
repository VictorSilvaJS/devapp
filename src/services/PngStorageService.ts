declare const require: (moduleName: string) => any;

export const PNG_STORAGE_DIRECTORY_NAME = 'tche-png-imports';
export const DEFAULT_PNG_FILE_NAME = 'mapa-tecnico.png';

export type PngStorageErrorCode =
  | 'PNG_PROPRIEDADE_ID_REQUIRED'
  | 'PNG_SOURCE_URI_REQUIRED'
  | 'PNG_STORAGE_DIRECTORY_FAILED'
  | 'PNG_INVALID_STORAGE_PATH'
  | 'PNG_COPY_FAILED'
  | 'PNG_STORED_FILE_NOT_FOUND'
  | 'PNG_DELETE_FAILED'
  | 'PNG_UNSAFE_DELETE_PATH'
  | 'PNG_FILE_ALREADY_EXISTS'
  | 'PNG_FILE_INFO_FAILED';

export interface PngStorageError {
  code: PngStorageErrorCode;
  message: string;
}

export interface CopyPngToStorageInput {
  propriedade_id: string;
  fazenda_id?: string;
  sourceUri: string;
  originalName: string;
  importId?: string;
  overwrite?: boolean;
}

export interface BuildPngStorageUriInput {
  propriedade_id: string;
  importId?: string;
  originalName: string;
}

export interface StoredPngFile {
  propriedade_id: string;
  fazenda_id: string;
  uri: string;
  name: string;
  originalName: string;
  size?: number;
  mimeType?: string;
  copiedAt: string;
}

export interface PngStorageDirectoryResult {
  ok: boolean;
  uri?: string;
  error?: PngStorageError;
}

export interface PngStorageCopyResult {
  ok: boolean;
  file?: StoredPngFile;
  error?: PngStorageError;
}

export interface PngStoredFileInfo {
  uri: string;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
}

export interface PngStorageInfoResult {
  ok: boolean;
  info?: PngStoredFileInfo;
  error?: PngStorageError;
}

export interface PngStorageDeleteResult {
  ok: boolean;
  deleted: boolean;
  error?: PngStorageError;
}

export interface PngFileSystemInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  [key: string]: unknown;
}

export interface PngFileSystemAdapter {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string, options?: Record<string, unknown>) => Promise<PngFileSystemInfo>;
  makeDirectoryAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface PngStorageServiceDeps {
  fileSystem?: PngFileSystemAdapter;
  now?: () => string;
  generateImportId?: () => string;
}

const MAX_FILE_BASE_LENGTH = 80;
const MAX_PATH_SEGMENT_LENGTH = 80;
const DEFAULT_PNG_BASE_NAME = 'mapa-tecnico';
const PNG_MIME_TYPE = 'image/png';

const getDefaultFileSystem = (): PngFileSystemAdapter =>
  require('expo-file-system/legacy') as PngFileSystemAdapter;

const createDefaultImportId = (): string =>
  `png_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

const hasPngExtension = (name: string): boolean =>
  firstNonEmptyString(name).toLowerCase().endsWith('.png');

const removePngExtension = (name: string): string =>
  name.slice(0, name.length - 4);

const buildError = (
  code: PngStorageErrorCode,
  message: string
): PngStorageError => ({ code, message });

const resolveFileSystem = (deps: PngStorageServiceDeps = {}): PngFileSystemAdapter =>
  deps.fileSystem ?? getDefaultFileSystem();

const resolveBaseDirectoryUri = (fileSystem: PngFileSystemAdapter): string =>
  ensureTrailingSlash(`${firstNonEmptyString(fileSystem.documentDirectory)}${PNG_STORAGE_DIRECTORY_NAME}/`);

const normalizeInfo = (uri: string, info: PngFileSystemInfo): PngStoredFileInfo => ({
  uri,
  exists: info.exists === true,
  isDirectory: typeof info.isDirectory === 'boolean' ? info.isDirectory : undefined,
  size: typeof info.size === 'number' && Number.isFinite(info.size) && info.size >= 0
    ? info.size
    : undefined,
});

export const sanitizePngPathSegment = (
  value: string,
  fallback = 'propriedade'
): string => {
  const raw = stripPathComponents(firstNonEmptyString(value));
  return slugifyPathValue(raw, fallback, MAX_PATH_SEGMENT_LENGTH);
};

export const sanitizePngFileName = (name: string): string => {
  const rawName = stripPathComponents(firstNonEmptyString(name));
  if (!hasPngExtension(rawName)) return DEFAULT_PNG_FILE_NAME;

  const rawBase = removePngExtension(rawName);
  const baseName = slugifyPathValue(rawBase, DEFAULT_PNG_BASE_NAME, MAX_FILE_BASE_LENGTH);

  return `${baseName}.png`;
};

export const buildPngStorageDirectoryUri = (
  propriedadeId: string,
  deps: PngStorageServiceDeps = {}
): string => {
  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeSegment = sanitizePngPathSegment(propriedadeId);

  return ensureTrailingSlash(`${baseDirectory}${propriedadeSegment}/`);
};

export const buildPngStorageUri = (
  input: BuildPngStorageUriInput,
  deps: PngStorageServiceDeps = {}
): string => {
  const directoryUri = buildPngStorageDirectoryUri(input.propriedade_id, deps);
  const importId = firstNonEmptyString(input.importId)
    || (deps.generateImportId ?? createDefaultImportId)();
  const importSegment = sanitizePngPathSegment(importId, 'png');
  const fileName = sanitizePngFileName(input.originalName);

  return `${directoryUri}${importSegment}-${fileName}`;
};

export const isSafePngStorageUri = (
  uri: string,
  deps: PngStorageServiceDeps = {}
): boolean => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);

  if (!normalizedUri.startsWith(baseDirectory)) return false;

  const relativePath = normalizedUri.slice(baseDirectory.length);
  if (!relativePath || relativePath.includes('..')) return false;

  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length !== 2) return false;

  return hasPngExtension(parts[1]);
};

export const ensurePngStorageDirectory = async (
  propriedadeId: string,
  deps: PngStorageServiceDeps = {}
): Promise<PngStorageDirectoryResult> => {
  const normalizedPropriedadeId = firstNonEmptyString(propriedadeId);
  if (!normalizedPropriedadeId) {
    return {
      ok: false,
      error: buildError('PNG_PROPRIEDADE_ID_REQUIRED', 'propriedade_id e obrigatorio para o storage de PNG.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeDirectory = buildPngStorageDirectoryUri(normalizedPropriedadeId, {
    ...deps,
    fileSystem,
  });

  try {
    for (const directory of [baseDirectory, propriedadeDirectory]) {
      const info = await fileSystem.getInfoAsync(directory);
      if (info.exists && info.isDirectory === false) {
        return {
          ok: false,
          error: buildError('PNG_STORAGE_DIRECTORY_FAILED', 'Caminho reservado para PNG nao e um diretorio.'),
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
      error: buildError('PNG_STORAGE_DIRECTORY_FAILED', 'Nao foi possivel preparar o diretorio interno de PNG.'),
    };
  }
};

export const getStoredPngInfo = async (
  uri: string,
  deps: PngStorageServiceDeps = {}
): Promise<PngStorageInfoResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafePngStorageUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('PNG_INVALID_STORAGE_PATH', 'URI fora do diretorio interno de PNG.'),
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
      error: buildError('PNG_FILE_INFO_FAILED', 'Nao foi possivel consultar o PNG armazenado.'),
    };
  }
};

export const copyPngToInternalStorage = async (
  input: CopyPngToStorageInput,
  deps: PngStorageServiceDeps = {}
): Promise<PngStorageCopyResult> => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id, input.fazenda_id);
  const fazendaId = firstNonEmptyString(input.fazenda_id, input.propriedade_id);
  const sourceUri = firstNonEmptyString(input.sourceUri);

  if (!propriedadeId || !fazendaId) {
    return {
      ok: false,
      error: buildError('PNG_PROPRIEDADE_ID_REQUIRED', 'propriedade_id e obrigatorio para copiar PNG.'),
    };
  }

  if (!sourceUri) {
    return {
      ok: false,
      error: buildError('PNG_SOURCE_URI_REQUIRED', 'sourceUri e obrigatorio para copiar PNG.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const directory = await ensurePngStorageDirectory(propriedadeId, { ...deps, fileSystem });
  if (!directory.ok || !directory.uri) {
    return {
      ok: false,
      error: directory.error ?? buildError('PNG_STORAGE_DIRECTORY_FAILED', 'Nao foi possivel preparar o storage.'),
    };
  }

  const destinationUri = buildPngStorageUri({
    propriedade_id: propriedadeId,
    importId: input.importId,
    originalName: input.originalName,
  }, { ...deps, fileSystem });
  const name = destinationUri.split('/').filter(Boolean).pop() ?? sanitizePngFileName(input.originalName);

  if (!isSafePngStorageUri(destinationUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('PNG_INVALID_STORAGE_PATH', 'Destino de PNG invalido.'),
    };
  }

  let shouldDeleteExistingDestination = false;

  try {
    const existingInfo = await fileSystem.getInfoAsync(destinationUri);
    if (existingInfo.exists && !input.overwrite) {
      return {
        ok: false,
        error: buildError('PNG_FILE_ALREADY_EXISTS', 'Arquivo PNG ja existe no storage interno.'),
      };
    }

    if (existingInfo.exists && existingInfo.isDirectory === true) {
      return {
        ok: false,
        error: buildError('PNG_INVALID_STORAGE_PATH', 'Destino de PNG aponta para um diretorio.'),
      };
    }

    shouldDeleteExistingDestination = existingInfo.exists === true;
  } catch {
    return {
      ok: false,
      error: buildError('PNG_FILE_INFO_FAILED', 'Nao foi possivel verificar o destino do PNG.'),
    };
  }

  if (shouldDeleteExistingDestination) {
    try {
      await fileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch {
      return {
        ok: false,
        error: buildError('PNG_DELETE_FAILED', 'Nao foi possivel remover o PNG anterior antes de sobrescrever.'),
      };
    }
  }

  try {
    await fileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch {
    return {
      ok: false,
      error: buildError('PNG_COPY_FAILED', 'Nao foi possivel copiar o PNG para o storage interno.'),
    };
  }

  try {
    const storedInfo = await fileSystem.getInfoAsync(destinationUri);
    if (!storedInfo.exists || storedInfo.isDirectory === true) {
      return {
        ok: false,
        error: buildError('PNG_STORED_FILE_NOT_FOUND', 'Arquivo PNG nao foi encontrado apos a copia.'),
      };
    }

    return {
      ok: true,
      file: {
        propriedade_id: propriedadeId,
        fazenda_id: fazendaId,
        uri: destinationUri,
        name,
        originalName: firstNonEmptyString(input.originalName) || DEFAULT_PNG_FILE_NAME,
        size: normalizeInfo(destinationUri, storedInfo).size,
        mimeType: PNG_MIME_TYPE,
        copiedAt: (deps.now ?? (() => new Date().toISOString()))(),
      },
    };
  } catch {
    return {
      ok: false,
      error: buildError('PNG_STORED_FILE_NOT_FOUND', 'Nao foi possivel confirmar a existencia do PNG copiado.'),
    };
  }
};

export const deleteStoredPng = async (
  uri: string,
  deps: PngStorageServiceDeps = {}
): Promise<PngStorageDeleteResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafePngStorageUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      deleted: false,
      error: buildError('PNG_UNSAFE_DELETE_PATH', 'Remocao recusada fora do diretorio interno de PNG.'),
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
        error: buildError('PNG_UNSAFE_DELETE_PATH', 'Remocao de diretorio PNG recusada.'),
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
      error: buildError('PNG_DELETE_FAILED', 'Nao foi possivel remover o PNG armazenado.'),
    };
  }
};

export const createPngStorageService = (
  deps: PngStorageServiceDeps = {}
) => ({
  sanitizePngFileName,
  sanitizePngPathSegment,
  buildPngStorageDirectoryUri: (propriedadeId: string) =>
    buildPngStorageDirectoryUri(propriedadeId, deps),
  buildPngStorageUri: (input: BuildPngStorageUriInput) =>
    buildPngStorageUri(input, deps),
  ensurePngStorageDirectory: (propriedadeId: string) =>
    ensurePngStorageDirectory(propriedadeId, deps),
  copyPngToInternalStorage: (input: CopyPngToStorageInput) =>
    copyPngToInternalStorage(input, deps),
  getStoredPngInfo: (uri: string) => getStoredPngInfo(uri, deps),
  deleteStoredPng: (uri: string) => deleteStoredPng(uri, deps),
  isSafePngStorageUri: (uri: string) => isSafePngStorageUri(uri, deps),
});

export const PngStorageService = createPngStorageService();
