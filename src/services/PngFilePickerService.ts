declare const require: (moduleName: string) => any;

export const MAX_PNG_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export type PngFilePickerErrorCode =
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME';

export interface PickedPngFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface PngFilePickerMessage {
  code: string;
  message: string;
}

export interface PngFilePickerError {
  code: PngFilePickerErrorCode;
  message: string;
}

export interface PngFileValidationResult {
  ok: boolean;
  file?: PickedPngFile;
  errors: PngFilePickerError[];
  warnings: PngFilePickerMessage[];
}

export interface PngDocumentPickerAdapter {
  getDocumentAsync: (options?: Record<string, unknown>) => Promise<unknown>;
}

export interface PngFilePickerServiceDeps {
  documentPicker?: PngDocumentPickerAdapter;
}

const SUPPORTED_EXTENSION = '.png';
const SUPPORTED_MIME_TYPE = 'image/png';
const GENERIC_ANDROID_MIME_TYPE = 'application/octet-stream';
const PICKER_MIME_TYPES = [SUPPORTED_MIME_TYPE, GENERIC_ANDROID_MIME_TYPE];

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

const getDefaultDocumentPicker = (): PngDocumentPickerAdapter =>
  require('expo-document-picker') as PngDocumentPickerAdapter;

const buildError = (
  code: PngFilePickerErrorCode,
  message: string
): PngFilePickerError => ({ code, message });

const buildResult = (
  file: PickedPngFile | undefined,
  errors: PngFilePickerError[],
  warnings: PngFilePickerMessage[] = []
): PngFileValidationResult => ({
  ok: errors.length === 0,
  file,
  errors,
  warnings,
});

export const isSupportedPngFileName = (name: string): boolean => {
  const normalized = firstNonEmptyString(name).toLowerCase();
  return normalized.endsWith(SUPPORTED_EXTENSION);
};

export const isSupportedPngMimeType = (mimeType?: string, name?: string): boolean => {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return name ? isSupportedPngFileName(name) : true;
  if (normalized === SUPPORTED_MIME_TYPE) return true;
  if (normalized === GENERIC_ANDROID_MIME_TYPE) {
    return name ? isSupportedPngFileName(name) : false;
  }

  return false;
};

const isPickerCancelled = (result: unknown): boolean => {
  const value = result as any;
  return value?.type === 'cancel' || value?.canceled === true;
};

export const normalizePickedPngDocumentResult = (result: unknown): PickedPngFile | null => {
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

export const validatePickedPngFile = (file: Partial<PickedPngFile>): PngFileValidationResult => {
  const errors: PngFilePickerError[] = [];
  const warnings: PngFilePickerMessage[] = [];
  const uri = firstNonEmptyString(file.uri);
  const name = firstNonEmptyString(file.name);
  const normalizedFile = uri && name
    ? {
      uri,
      name,
      size: normalizeSize(file.size),
      mimeType: normalizeOptionalString(file.mimeType),
    }
    : undefined;

  if (!uri) {
    errors.push(buildError('MISSING_FILE_URI', 'Arquivo selecionado sem URI local.'));
  }

  if (!name) {
    errors.push(buildError('MISSING_FILE_NAME', 'Arquivo selecionado sem nome.'));
  }

  if (name && !isSupportedPngFileName(name)) {
    errors.push(buildError('UNSUPPORTED_FILE_TYPE', 'Selecione um arquivo PNG.'));
  }

  if (name && !isSupportedPngMimeType(file.mimeType, name)) {
    errors.push(buildError('UNSUPPORTED_MIME_TYPE', 'Selecione um arquivo PNG.'));
  }

  const size = normalizeSize(file.size);
  if (size !== undefined && size > MAX_PNG_FILE_SIZE_BYTES) {
    errors.push(buildError(
      'FILE_TOO_LARGE',
      'Arquivo PNG muito grande para anexar localmente nesta versao.'
    ));
  }

  if (size === undefined) {
    warnings.push({
      code: 'UNKNOWN_FILE_SIZE',
      message: 'Tamanho do arquivo nao informado pelo seletor.',
    });
  }

  return buildResult(normalizedFile, errors, warnings);
};

export const pickPngDocument = async (
  deps: PngFilePickerServiceDeps = {}
): Promise<PngFileValidationResult> => {
  const documentPicker = deps.documentPicker ?? getDefaultDocumentPicker();
  const result = await documentPicker.getDocumentAsync({
    type: PICKER_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (isPickerCancelled(result)) {
    return buildResult(undefined, [
      buildError('PICKER_CANCELLED', 'Selecao de arquivo cancelada.'),
    ]);
  }

  const file = normalizePickedPngDocumentResult(result);
  if (!file) {
    return buildResult(undefined, [
      buildError('PICKER_RESULT_INVALID', 'Arquivo selecionado sem dados suficientes.'),
    ]);
  }

  return validatePickedPngFile(file);
};

export const pickAndValidatePngDocument = pickPngDocument;

export const createPngFilePickerService = (
  deps: PngFilePickerServiceDeps = {}
) => ({
  isSupportedPngFileName,
  isSupportedPngMimeType,
  normalizePickedPngDocumentResult,
  validatePickedPngFile,
  pickPngDocument: () => pickPngDocument(deps),
  pickAndValidatePngDocument: () => pickAndValidatePngDocument(deps),
});

export const PngFilePickerService = createPngFilePickerService();
