import {
  GeoJsonNormalizeOptions,
  GeoJsonValidationResult,
  validateAndNormalizeGeoJson,
} from '../utils/geojsonImportValidator';

declare const require: (moduleName: string) => any;

export const MAX_GEOJSON_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type GeoJsonFilePickerErrorCode =
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_READ_FAILED'
  | 'INVALID_GEOJSON'
  | 'VALIDATION_FAILED';

export interface PickedGeoJsonFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface GeoJsonFilePickerMessage {
  code: string;
  message: string;
}

export interface GeoJsonFilePickerError {
  code: GeoJsonFilePickerErrorCode;
  message: string;
}

export interface GeoJsonReadAndValidateResult {
  ok: boolean;
  file?: PickedGeoJsonFile;
  validation?: GeoJsonValidationResult;
  error?: GeoJsonFilePickerError;
  warnings: GeoJsonFilePickerMessage[];
}

export interface GeoJsonDocumentPickerAdapter {
  getDocumentAsync: (options?: Record<string, unknown>) => Promise<unknown>;
}

export interface GeoJsonFileSystemAdapter {
  readAsStringAsync: (uri: string, options?: Record<string, unknown>) => Promise<string>;
  EncodingType?: {
    UTF8?: string;
    [key: string]: unknown;
  };
}

export interface GeoJsonFilePickerServiceDeps {
  documentPicker?: GeoJsonDocumentPickerAdapter;
  fileSystem?: GeoJsonFileSystemAdapter;
  validateGeoJson?: (
    input: unknown,
    options: GeoJsonNormalizeOptions
  ) => GeoJsonValidationResult;
}

const SUPPORTED_EXTENSIONS = ['.geojson', '.json'];
const SUPPORTED_MIME_TYPES = [
  'application/geo+json',
  'application/json',
  'application/octet-stream',
  'text/json',
  'text/plain',
];

const PICKER_MIME_TYPES = [
  'application/geo+json',
  'application/json',
  'application/octet-stream',
  'text/json',
  'text/plain',
];

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

const normalizeSize = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

const normalizeMimeType = (mimeType?: string): string =>
  firstNonEmptyString(mimeType).toLowerCase().split(';')[0].trim();

const getDefaultDocumentPicker = (): GeoJsonDocumentPickerAdapter =>
  require('expo-document-picker') as GeoJsonDocumentPickerAdapter;

const getDefaultFileSystem = (): GeoJsonFileSystemAdapter =>
  require('expo-file-system/legacy') as GeoJsonFileSystemAdapter;

const buildError = (
  code: GeoJsonFilePickerErrorCode,
  message: string
): GeoJsonFilePickerError => ({ code, message });

const buildResultError = (
  error: GeoJsonFilePickerError,
  file?: PickedGeoJsonFile,
  validation?: GeoJsonValidationResult,
  warnings: GeoJsonFilePickerMessage[] = []
): GeoJsonReadAndValidateResult => ({
  ok: false,
  file,
  validation,
  error,
  warnings,
});

const mergeWarnings = (
  ...groups: GeoJsonFilePickerMessage[][]
): GeoJsonFilePickerMessage[] => {
  const seen = new Set<string>();
  const merged: GeoJsonFilePickerMessage[] = [];

  groups.flat().forEach((warning) => {
    const key = `${warning.code}|${warning.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(warning);
  });

  return merged;
};

export const isSupportedGeoJsonFileName = (name: string): boolean => {
  const normalized = firstNonEmptyString(name).toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const isSupportedGeoJsonMimeType = (mimeType?: string): boolean => {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return true;
  return SUPPORTED_MIME_TYPES.includes(normalized);
};

const isPickerCancelled = (result: unknown): boolean => {
  const value = result as any;
  return value?.type === 'cancel' || value?.canceled === true;
};

export const normalizePickedDocumentResult = (result: unknown): PickedGeoJsonFile | null => {
  const value = result as any;
  const asset = value?.canceled === false
    ? (Array.isArray(value?.assets) ? value.assets[0] : null)
    : value?.type === 'success'
      ? value
      : null;

  const uri = firstNonEmptyString(asset?.uri);
  const name = firstNonEmptyString(asset?.name);

  if (!uri || !name) return null;

  return {
    uri,
    name,
    size: normalizeSize(asset?.size),
    mimeType: normalizeOptionalString(asset?.mimeType),
  };
};

export const validatePickedGeoJsonFile = (
  file: PickedGeoJsonFile
): { error?: GeoJsonFilePickerError; warnings: GeoJsonFilePickerMessage[] } => {
  const warnings: GeoJsonFilePickerMessage[] = [];

  if (!isSupportedGeoJsonFileName(file.name) || !isSupportedGeoJsonMimeType(file.mimeType)) {
    return {
      error: buildError(
        'UNSUPPORTED_FILE_TYPE',
        'Selecione um arquivo GeoJSON no formato .geojson ou .json.'
      ),
      warnings,
    };
  }

  if (file.size !== undefined && file.size > MAX_GEOJSON_FILE_SIZE_BYTES) {
    return {
      error: buildError(
        'FILE_TOO_LARGE',
        'Arquivo muito grande para importacao local nesta versao.'
      ),
      warnings,
    };
  }

  if (file.size === undefined) {
    warnings.push({
      code: 'FILE_SIZE_UNKNOWN',
      message: 'Tamanho do arquivo nao informado pelo seletor.',
    });
  }

  return { warnings };
};

export const pickGeoJsonDocument = async (
  deps: GeoJsonFilePickerServiceDeps = {}
): Promise<GeoJsonReadAndValidateResult> => {
  const documentPicker = deps.documentPicker ?? getDefaultDocumentPicker();
  const result = await documentPicker.getDocumentAsync({
    type: PICKER_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (isPickerCancelled(result)) {
    return buildResultError(buildError('PICKER_CANCELLED', 'Selecao de arquivo cancelada.'));
  }

  const file = normalizePickedDocumentResult(result);
  if (!file) {
    return buildResultError(buildError('PICKER_RESULT_INVALID', 'Arquivo selecionado sem dados suficientes.'));
  }

  const fileValidation = validatePickedGeoJsonFile(file);
  if (fileValidation.error) {
    return buildResultError(fileValidation.error, file, undefined, fileValidation.warnings);
  }

  return {
    ok: true,
    file,
    warnings: fileValidation.warnings,
  };
};

export const readGeoJsonFileAsString = async (
  file: PickedGeoJsonFile,
  deps: GeoJsonFilePickerServiceDeps = {}
): Promise<string> => {
  const fileSystem = deps.fileSystem ?? getDefaultFileSystem();
  const encoding = fileSystem.EncodingType?.UTF8 ?? 'utf8';

  return fileSystem.readAsStringAsync(file.uri, { encoding });
};

export const readAndValidatePickedGeoJson = async (
  file: PickedGeoJsonFile,
  options: GeoJsonNormalizeOptions,
  deps: GeoJsonFilePickerServiceDeps = {}
): Promise<GeoJsonReadAndValidateResult> => {
  const fileValidation = validatePickedGeoJsonFile(file);
  if (fileValidation.error) {
    return buildResultError(fileValidation.error, file, undefined, fileValidation.warnings);
  }

  let content: string;
  try {
    content = await readGeoJsonFileAsString(file, deps);
  } catch {
    return buildResultError(
      buildError('FILE_READ_FAILED', 'Nao foi possivel ler o arquivo selecionado.'),
      file,
      undefined,
      fileValidation.warnings
    );
  }

  const validateGeoJson = deps.validateGeoJson ?? validateAndNormalizeGeoJson;
  const validation = validateGeoJson(content, options);
  const error = validation.ok
    ? undefined
    : buildError(
      validation.errors.some((issue) => issue.code === 'INVALID_JSON')
        ? 'INVALID_GEOJSON'
        : 'VALIDATION_FAILED',
      validation.errors.some((issue) => issue.code === 'INVALID_JSON')
        ? 'Arquivo GeoJSON invalido.'
        : 'GeoJSON nao passou na validacao local.'
    );

  return {
    ok: validation.ok,
    file,
    validation,
    error,
    warnings: fileValidation.warnings,
  };
};

export const pickReadAndValidateGeoJson = async (
  options: GeoJsonNormalizeOptions,
  deps: GeoJsonFilePickerServiceDeps = {}
): Promise<GeoJsonReadAndValidateResult> => {
  const picked = await pickGeoJsonDocument(deps);
  if (!picked.ok || !picked.file) return picked;

  const validated = await readAndValidatePickedGeoJson(picked.file, options, deps);
  return {
    ...validated,
    warnings: mergeWarnings(picked.warnings, validated.warnings),
  };
};

export const createGeoJsonFilePickerService = (
  deps: GeoJsonFilePickerServiceDeps = {}
) => ({
  isSupportedGeoJsonFileName,
  isSupportedGeoJsonMimeType,
  normalizePickedDocumentResult,
  validatePickedGeoJsonFile,
  pickGeoJsonDocument: () => pickGeoJsonDocument(deps),
  readGeoJsonFileAsString: (file: PickedGeoJsonFile) => readGeoJsonFileAsString(file, deps),
  readAndValidatePickedGeoJson: (
    file: PickedGeoJsonFile,
    options: GeoJsonNormalizeOptions
  ) => readAndValidatePickedGeoJson(file, options, deps),
  pickReadAndValidateGeoJson: (options: GeoJsonNormalizeOptions) =>
    pickReadAndValidateGeoJson(options, deps),
});

export const GeoJsonFilePickerService = createGeoJsonFilePickerService();
