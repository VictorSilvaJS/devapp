declare const require: (moduleName: string) => any;

export const PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME = 'tche-prescription-zips';
export const DEFAULT_PRESCRIPTION_ZIP_FILE_NAME = 'prescricao.zip';

export type PrescriptionZipStorageErrorCode =
  | 'ZIP_PROPRIEDADE_ID_REQUIRED'
  | 'ZIP_SOURCE_URI_REQUIRED'
  | 'ZIP_STORAGE_DIRECTORY_FAILED'
  | 'ZIP_INVALID_STORAGE_PATH'
  | 'ZIP_COPY_FAILED'
  | 'ZIP_STORED_FILE_NOT_FOUND'
  | 'ZIP_DELETE_FAILED'
  | 'ZIP_UNSAFE_DELETE_PATH'
  | 'ZIP_FILE_ALREADY_EXISTS'
  | 'ZIP_FILE_INFO_FAILED';

export interface PrescriptionZipStorageError {
  code: PrescriptionZipStorageErrorCode;
  message: string;
}

export interface CopyPrescriptionZipToStorageInput {
  propriedade_id: string;
  sourceUri: string;
  originalName: string;
  importId?: string;
  overwrite?: boolean;
}

export interface BuildPrescriptionZipStorageUriInput {
  propriedade_id: string;
  importId?: string;
  originalName: string;
}

export interface StoredPrescriptionZipFile {
  propriedade_id: string;
  uri: string;
  name: string;
  originalName: string;
  size?: number;
  mimeType?: string;
  copiedAt: string;
}

export interface PrescriptionZipStorageCopyResult {
  ok: boolean;
  file?: StoredPrescriptionZipFile;
  error?: PrescriptionZipStorageError;
}

export interface PrescriptionZipStoredFileInfo {
  uri: string;
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
}

export interface PrescriptionZipStorageInfoResult {
  ok: boolean;
  info?: PrescriptionZipStoredFileInfo;
  error?: PrescriptionZipStorageError;
}

export interface PrescriptionZipStorageDeleteResult {
  ok: boolean;
  deleted: boolean;
  error?: PrescriptionZipStorageError;
}

export interface PrescriptionZipFileSystemInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  [key: string]: unknown;
}

export interface PrescriptionZipFileSystemAdapter {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string, options?: Record<string, unknown>) => Promise<PrescriptionZipFileSystemInfo>;
  makeDirectoryAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface PrescriptionZipStorageServiceDeps {
  fileSystem?: PrescriptionZipFileSystemAdapter;
  now?: () => string;
  generateImportId?: () => string;
}

const MAX_FILE_BASE_LENGTH = 80;
const MAX_PATH_SEGMENT_LENGTH = 80;
const DEFAULT_ZIP_BASE_NAME = 'prescricao';
const ZIP_MIME_TYPE = 'application/zip';

const getDefaultFileSystem = (): PrescriptionZipFileSystemAdapter =>
  require('expo-file-system/legacy') as PrescriptionZipFileSystemAdapter;

const createDefaultImportId = (): string =>
  `zip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
  const parts = value.replace(/\0/g, '').split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : value;
};

const slugifyPathValue = (value: string, fallback: string, maxLength: number): string => {
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

const hasZipExtension = (name: string): boolean =>
  firstNonEmptyString(name).toLowerCase().endsWith('.zip');

const removeZipExtension = (name: string): string => name.slice(0, name.length - 4);

const buildError = (
  code: PrescriptionZipStorageErrorCode,
  message: string
): PrescriptionZipStorageError => ({ code, message });

const resolveFileSystem = (deps: PrescriptionZipStorageServiceDeps = {}): PrescriptionZipFileSystemAdapter =>
  deps.fileSystem ?? getDefaultFileSystem();

const resolveBaseDirectoryUri = (fileSystem: PrescriptionZipFileSystemAdapter): string =>
  ensureTrailingSlash(`${firstNonEmptyString(fileSystem.documentDirectory)}${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/`);

const normalizeInfo = (uri: string, info: PrescriptionZipFileSystemInfo): PrescriptionZipStoredFileInfo => ({
  uri,
  exists: info.exists === true,
  isDirectory: typeof info.isDirectory === 'boolean' ? info.isDirectory : undefined,
  size: typeof info.size === 'number' && Number.isFinite(info.size) && info.size >= 0
    ? info.size
    : undefined,
});

export const sanitizePrescriptionZipPathSegment = (value: string, fallback = 'propriedade'): string => {
  const raw = stripPathComponents(firstNonEmptyString(value));
  return slugifyPathValue(raw, fallback, MAX_PATH_SEGMENT_LENGTH);
};

export const sanitizePrescriptionZipFileName = (name: string): string => {
  const rawName = stripPathComponents(firstNonEmptyString(name));
  if (!hasZipExtension(rawName)) return DEFAULT_PRESCRIPTION_ZIP_FILE_NAME;

  const baseName = slugifyPathValue(
    removeZipExtension(rawName),
    DEFAULT_ZIP_BASE_NAME,
    MAX_FILE_BASE_LENGTH
  );

  return `${baseName}.zip`;
};

export const buildPrescriptionZipStorageDirectoryUri = (
  propriedadeId: string,
  deps: PrescriptionZipStorageServiceDeps = {}
): string => {
  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeSegment = sanitizePrescriptionZipPathSegment(propriedadeId);

  return ensureTrailingSlash(`${baseDirectory}${propriedadeSegment}/`);
};

export const buildPrescriptionZipStorageUri = (
  input: BuildPrescriptionZipStorageUriInput,
  deps: PrescriptionZipStorageServiceDeps = {}
): string => {
  const directoryUri = buildPrescriptionZipStorageDirectoryUri(input.propriedade_id, deps);
  const importId = firstNonEmptyString(input.importId)
    || (deps.generateImportId ?? createDefaultImportId)();
  const importSegment = sanitizePrescriptionZipPathSegment(importId, 'zip');
  const fileName = sanitizePrescriptionZipFileName(input.originalName);

  return `${directoryUri}${importSegment}-${fileName}`;
};

export const isSafePrescriptionZipStorageUri = (
  uri: string,
  deps: PrescriptionZipStorageServiceDeps = {}
): boolean => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);

  if (!normalizedUri.startsWith(baseDirectory)) return false;

  const relativePath = normalizedUri.slice(baseDirectory.length);
  if (!relativePath || relativePath.includes('..')) return false;

  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length !== 2) return false;

  return hasZipExtension(parts[1]);
};

export const ensurePrescriptionZipStorageDirectory = async (
  propriedadeId: string,
  deps: PrescriptionZipStorageServiceDeps = {}
) => {
  const normalizedPropriedadeId = firstNonEmptyString(propriedadeId);
  if (!normalizedPropriedadeId) {
    return {
      ok: false,
      error: buildError('ZIP_PROPRIEDADE_ID_REQUIRED', 'propriedade_id é obrigatório para o storage de prescrição.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const baseDirectory = resolveBaseDirectoryUri(fileSystem);
  const propriedadeDirectory = buildPrescriptionZipStorageDirectoryUri(normalizedPropriedadeId, {
    ...deps,
    fileSystem,
  });

  try {
    for (const directory of [baseDirectory, propriedadeDirectory]) {
      const info = await fileSystem.getInfoAsync(directory);
      if (info.exists && info.isDirectory === false) {
        return {
          ok: false,
          error: buildError('ZIP_STORAGE_DIRECTORY_FAILED', 'Caminho reservado para prescrição não é um diretório.'),
        };
      }

      if (!info.exists) {
        await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
    }

    return { ok: true, uri: propriedadeDirectory };
  } catch {
    return {
      ok: false,
      error: buildError('ZIP_STORAGE_DIRECTORY_FAILED', 'Não foi possível preparar o diretório interno de prescrição.'),
    };
  }
};

export const getStoredPrescriptionZipInfo = async (
  uri: string,
  deps: PrescriptionZipStorageServiceDeps = {}
): Promise<PrescriptionZipStorageInfoResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafePrescriptionZipStorageUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('ZIP_INVALID_STORAGE_PATH', 'URI fora do diretório interno de prescrição.'),
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
      error: buildError('ZIP_FILE_INFO_FAILED', 'Não foi possível consultar o ZIP armazenado.'),
    };
  }
};

export const copyPrescriptionZipToInternalStorage = async (
  input: CopyPrescriptionZipToStorageInput,
  deps: PrescriptionZipStorageServiceDeps = {}
): Promise<PrescriptionZipStorageCopyResult> => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id);
  const sourceUri = firstNonEmptyString(input.sourceUri);

  if (!propriedadeId) {
    return {
      ok: false,
      error: buildError('ZIP_PROPRIEDADE_ID_REQUIRED', 'propriedade_id é obrigatório para copiar ZIP.'),
    };
  }

  if (!sourceUri) {
    return {
      ok: false,
      error: buildError('ZIP_SOURCE_URI_REQUIRED', 'sourceUri é obrigatório para copiar ZIP.'),
    };
  }

  const fileSystem = resolveFileSystem(deps);
  const directory = await ensurePrescriptionZipStorageDirectory(propriedadeId, { ...deps, fileSystem });
  if (!directory.ok || !directory.uri) {
    return {
      ok: false,
      error: directory.error ?? buildError('ZIP_STORAGE_DIRECTORY_FAILED', 'Não foi possível preparar o storage.'),
    };
  }

  const destinationUri = buildPrescriptionZipStorageUri({
    propriedade_id: propriedadeId,
    importId: input.importId,
    originalName: input.originalName,
  }, { ...deps, fileSystem });
  const name = destinationUri.split('/').filter(Boolean).pop()
    ?? sanitizePrescriptionZipFileName(input.originalName);

  if (!isSafePrescriptionZipStorageUri(destinationUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      error: buildError('ZIP_INVALID_STORAGE_PATH', 'Destino de ZIP inválido.'),
    };
  }

  try {
    const existingInfo = await fileSystem.getInfoAsync(destinationUri);
    if (existingInfo.exists && !input.overwrite) {
      return {
        ok: false,
        error: buildError('ZIP_FILE_ALREADY_EXISTS', 'Arquivo ZIP já existe no storage interno.'),
      };
    }
    if (existingInfo.exists && existingInfo.isDirectory === true) {
      return {
        ok: false,
        error: buildError('ZIP_INVALID_STORAGE_PATH', 'Destino de ZIP aponta para um diretório.'),
      };
    }
    if (existingInfo.exists) {
      await fileSystem.deleteAsync(destinationUri, { idempotent: true });
    }
  } catch {
    return {
      ok: false,
      error: buildError('ZIP_FILE_INFO_FAILED', 'Não foi possível verificar o destino do ZIP.'),
    };
  }

  try {
    await fileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch {
    return {
      ok: false,
      error: buildError('ZIP_COPY_FAILED', 'Não foi possível copiar o ZIP para o storage interno.'),
    };
  }

  try {
    const storedInfo = await fileSystem.getInfoAsync(destinationUri);
    if (!storedInfo.exists || storedInfo.isDirectory === true) {
      return {
        ok: false,
        error: buildError('ZIP_STORED_FILE_NOT_FOUND', 'Arquivo ZIP não foi encontrado após a cópia.'),
      };
    }

    return {
      ok: true,
      file: {
        propriedade_id: propriedadeId,
        uri: destinationUri,
        name,
        originalName: firstNonEmptyString(input.originalName) || DEFAULT_PRESCRIPTION_ZIP_FILE_NAME,
        size: normalizeInfo(destinationUri, storedInfo).size,
        mimeType: ZIP_MIME_TYPE,
        copiedAt: (deps.now ?? (() => new Date().toISOString()))(),
      },
    };
  } catch {
    return {
      ok: false,
      error: buildError('ZIP_STORED_FILE_NOT_FOUND', 'Não foi possível confirmar a existência do ZIP copiado.'),
    };
  }
};

export const deleteStoredPrescriptionZip = async (
  uri: string,
  deps: PrescriptionZipStorageServiceDeps = {}
): Promise<PrescriptionZipStorageDeleteResult> => {
  const fileSystem = resolveFileSystem(deps);
  const normalizedUri = normalizeUri(uri);

  if (!isSafePrescriptionZipStorageUri(normalizedUri, { ...deps, fileSystem })) {
    return {
      ok: false,
      deleted: false,
      error: buildError('ZIP_UNSAFE_DELETE_PATH', 'Remoção recusada fora do diretório interno de prescrição.'),
    };
  }

  try {
    const info = await fileSystem.getInfoAsync(normalizedUri);
    if (!info.exists) return { ok: true, deleted: false };
    if (info.isDirectory === true) {
      return {
        ok: false,
        deleted: false,
        error: buildError('ZIP_UNSAFE_DELETE_PATH', 'Remoção de diretório de prescrição recusada.'),
      };
    }

    await fileSystem.deleteAsync(normalizedUri, { idempotent: true });
    return { ok: true, deleted: true };
  } catch {
    return {
      ok: false,
      deleted: false,
      error: buildError('ZIP_DELETE_FAILED', 'Não foi possível remover o ZIP armazenado.'),
    };
  }
};

export const createPrescriptionZipStorageService = (
  deps: PrescriptionZipStorageServiceDeps = {}
) => ({
  sanitizePrescriptionZipFileName,
  sanitizePrescriptionZipPathSegment,
  buildPrescriptionZipStorageDirectoryUri: (propriedadeId: string) =>
    buildPrescriptionZipStorageDirectoryUri(propriedadeId, deps),
  buildPrescriptionZipStorageUri: (input: BuildPrescriptionZipStorageUriInput) =>
    buildPrescriptionZipStorageUri(input, deps),
  copyPrescriptionZipToInternalStorage: (input: CopyPrescriptionZipToStorageInput) =>
    copyPrescriptionZipToInternalStorage(input, deps),
  getStoredPrescriptionZipInfo: (uri: string) => getStoredPrescriptionZipInfo(uri, deps),
  deleteStoredPrescriptionZip: (uri: string) => deleteStoredPrescriptionZip(uri, deps),
  isSafePrescriptionZipStorageUri: (uri: string) => isSafePrescriptionZipStorageUri(uri, deps),
});

export const PrescriptionZipStorageService = createPrescriptionZipStorageService();
