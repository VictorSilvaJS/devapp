declare const require: (moduleName: string) => any;

export const MAX_PRESCRIPTION_ZIP_FILE_SIZE_BYTES = 80 * 1024 * 1024;

export type PrescriptionZipFilePickerErrorCode =
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME';

export interface PickedPrescriptionZipFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface PrescriptionZipFilePickerMessage {
  code: string;
  message: string;
}

export interface PrescriptionZipFilePickerError {
  code: PrescriptionZipFilePickerErrorCode;
  message: string;
}

export interface PrescriptionZipFileValidationResult {
  ok: boolean;
  file?: PickedPrescriptionZipFile;
  errors: PrescriptionZipFilePickerError[];
  warnings: PrescriptionZipFilePickerMessage[];
}

export interface PrescriptionZipDocumentPickerAdapter {
  getDocumentAsync: (options?: Record<string, unknown>) => Promise<unknown>;
}

export interface PrescriptionZipFilePickerServiceDeps {
  documentPicker?: PrescriptionZipDocumentPickerAdapter;
}

const SUPPORTED_EXTENSION = '.zip';
const SUPPORTED_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];
const GENERIC_ANDROID_MIME_TYPE = 'application/octet-stream';
const PICKER_MIME_TYPES = [...SUPPORTED_MIME_TYPES, GENERIC_ANDROID_MIME_TYPE];

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

const getDefaultDocumentPicker = (): PrescriptionZipDocumentPickerAdapter =>
  require('expo-document-picker') as PrescriptionZipDocumentPickerAdapter;

const buildError = (
  code: PrescriptionZipFilePickerErrorCode,
  message: string
): PrescriptionZipFilePickerError => ({ code, message });

const buildResult = (
  file: PickedPrescriptionZipFile | undefined,
  errors: PrescriptionZipFilePickerError[],
  warnings: PrescriptionZipFilePickerMessage[] = []
): PrescriptionZipFileValidationResult => ({
  ok: errors.length === 0,
  file,
  errors,
  warnings,
});

export const isSupportedPrescriptionZipFileName = (name: string): boolean => {
  const normalized = firstNonEmptyString(name).toLowerCase();
  return normalized.endsWith(SUPPORTED_EXTENSION);
};

export const isSupportedPrescriptionZipMimeType = (mimeType?: string, name?: string): boolean => {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return name ? isSupportedPrescriptionZipFileName(name) : true;
  if (SUPPORTED_MIME_TYPES.includes(normalized)) return true;
  if (normalized === GENERIC_ANDROID_MIME_TYPE) {
    return name ? isSupportedPrescriptionZipFileName(name) : false;
  }

  return false;
};

const isPickerCancelled = (result: unknown): boolean => {
  const value = result as any;
  return value?.type === 'cancel' || value?.canceled === true;
};

export const normalizePickedPrescriptionZipDocumentResult = (
  result: unknown
): PickedPrescriptionZipFile | null => {
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

export const validatePickedPrescriptionZipFile = (
  file: Partial<PickedPrescriptionZipFile>
): PrescriptionZipFileValidationResult => {
  const errors: PrescriptionZipFilePickerError[] = [];
  const warnings: PrescriptionZipFilePickerMessage[] = [];
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

  if (!uri) errors.push(buildError('MISSING_FILE_URI', 'Arquivo selecionado sem URI local.'));
  if (!name) errors.push(buildError('MISSING_FILE_NAME', 'Arquivo selecionado sem nome.'));
  if (name && !isSupportedPrescriptionZipFileName(name)) {
    errors.push(buildError('UNSUPPORTED_FILE_TYPE', 'Selecione um arquivo ZIP de prescrição.'));
  }
  if (name && !isSupportedPrescriptionZipMimeType(file.mimeType, name)) {
    errors.push(buildError('UNSUPPORTED_MIME_TYPE', 'Selecione um arquivo ZIP de prescrição.'));
  }

  const size = normalizeSize(file.size);
  if (size !== undefined && size > MAX_PRESCRIPTION_ZIP_FILE_SIZE_BYTES) {
    errors.push(buildError(
      'FILE_TOO_LARGE',
      'Arquivo ZIP muito grande para anexar localmente nesta versão.'
    ));
  }
  if (size === undefined) {
    warnings.push({
      code: 'UNKNOWN_FILE_SIZE',
      message: 'Tamanho do arquivo não informado pelo seletor.',
    });
  }

  return buildResult(normalizedFile, errors, warnings);
};

export const pickPrescriptionZipDocument = async (
  deps: PrescriptionZipFilePickerServiceDeps = {}
): Promise<PrescriptionZipFileValidationResult> => {
  const documentPicker = deps.documentPicker ?? getDefaultDocumentPicker();
  const result = await documentPicker.getDocumentAsync({
    type: PICKER_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (isPickerCancelled(result)) {
    return buildResult(undefined, [
      buildError('PICKER_CANCELLED', 'Seleção de arquivo cancelada.'),
    ]);
  }

  const file = normalizePickedPrescriptionZipDocumentResult(result);
  if (!file) {
    return buildResult(undefined, [
      buildError('PICKER_RESULT_INVALID', 'Arquivo selecionado sem dados suficientes.'),
    ]);
  }

  return validatePickedPrescriptionZipFile(file);
};

export const pickAndValidatePrescriptionZipDocument = pickPrescriptionZipDocument;

export const createPrescriptionZipFilePickerService = (
  deps: PrescriptionZipFilePickerServiceDeps = {}
) => ({
  isSupportedPrescriptionZipFileName,
  isSupportedPrescriptionZipMimeType,
  normalizePickedPrescriptionZipDocumentResult,
  validatePickedPrescriptionZipFile,
  pickPrescriptionZipDocument: () => pickPrescriptionZipDocument(deps),
  pickAndValidatePrescriptionZipDocument: () => pickAndValidatePrescriptionZipDocument(deps),
});

export const PrescriptionZipFilePickerService = createPrescriptionZipFilePickerService();
