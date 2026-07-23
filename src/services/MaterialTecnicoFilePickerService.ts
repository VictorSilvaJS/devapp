import type { MaterialTecnicoFormato } from '../types/materialTecnicoLocal';

declare const require: (moduleName: string) => any;

export const MAX_MATERIAL_TECNICO_FILE_SIZE_BYTES = 80 * 1024 * 1024;

export type MaterialTecnicoFilePickerErrorCode =
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME';

export interface PickedMaterialTecnicoFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  formato: MaterialTecnicoFormato;
}

export interface MaterialTecnicoFilePickerMessage {
  code: string;
  message: string;
}

export interface MaterialTecnicoFilePickerError {
  code: MaterialTecnicoFilePickerErrorCode;
  message: string;
}

export interface MaterialTecnicoFileValidationResult {
  ok: boolean;
  file?: PickedMaterialTecnicoFile;
  errors: MaterialTecnicoFilePickerError[];
  warnings: MaterialTecnicoFilePickerMessage[];
}

export interface MaterialTecnicoDocumentPickerAdapter {
  getDocumentAsync: (options?: Record<string, unknown>) => Promise<unknown>;
}

export interface MaterialTecnicoFilePickerServiceDeps {
  documentPicker?: MaterialTecnicoDocumentPickerAdapter;
}

const SUPPORTED_MIME_TYPES = [
  'image/png',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
];

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeSize = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

const normalizeMimeType = (value: unknown): string =>
  firstNonEmptyString(value).toLowerCase().split(';')[0].trim();

export const getMaterialTecnicoFormatoFromName = (
  name: string
): MaterialTecnicoFormato | null => {
  const normalized = firstNonEmptyString(name).toLowerCase();
  if (normalized.endsWith('.png')) return 'png';
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.zip')) return 'zip';
  return null;
};

export const isSupportedMaterialTecnicoMimeType = (
  mimeType: unknown,
  formato: MaterialTecnicoFormato
): boolean => {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized || normalized === 'application/octet-stream') return true;
  if (formato === 'png') return normalized === 'image/png';
  if (formato === 'pdf') return normalized === 'application/pdf';
  return normalized === 'application/zip' || normalized === 'application/x-zip-compressed';
};

const buildResult = (
  file: PickedMaterialTecnicoFile | undefined,
  errors: MaterialTecnicoFilePickerError[],
  warnings: MaterialTecnicoFilePickerMessage[] = []
): MaterialTecnicoFileValidationResult => ({
  ok: errors.length === 0,
  file,
  errors,
  warnings,
});

export const validatePickedMaterialTecnicoFile = (
  input: Partial<PickedMaterialTecnicoFile>
): MaterialTecnicoFileValidationResult => {
  const errors: MaterialTecnicoFilePickerError[] = [];
  const warnings: MaterialTecnicoFilePickerMessage[] = [];
  const uri = firstNonEmptyString(input.uri);
  const name = firstNonEmptyString(input.name);
  const formato = getMaterialTecnicoFormatoFromName(name);
  const size = normalizeSize(input.size);
  const mimeType = firstNonEmptyString(input.mimeType) || undefined;

  if (!uri) errors.push({ code: 'MISSING_FILE_URI', message: 'Arquivo selecionado sem URI local.' });
  if (!name) errors.push({ code: 'MISSING_FILE_NAME', message: 'Arquivo selecionado sem nome.' });
  if (name && !formato) {
    errors.push({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Selecione um arquivo PNG, PDF ou ZIP.',
    });
  }
  if (formato && !isSupportedMaterialTecnicoMimeType(mimeType, formato)) {
    errors.push({
      code: 'UNSUPPORTED_MIME_TYPE',
      message: 'O tipo do arquivo não corresponde à extensão PNG, PDF ou ZIP.',
    });
  }
  if (size !== undefined && size > MAX_MATERIAL_TECNICO_FILE_SIZE_BYTES) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: 'O arquivo ultrapassa o limite local de 80 MB.',
    });
  }
  if (size === undefined) {
    warnings.push({
      code: 'UNKNOWN_FILE_SIZE',
      message: 'O seletor não informou o tamanho do arquivo.',
    });
  }

  const file = uri && name && formato
    ? { uri, name, size, mimeType, formato }
    : undefined;
  return buildResult(file, errors, warnings);
};

const isPickerCancelled = (result: any): boolean =>
  result?.type === 'cancel' || result?.canceled === true;

export const normalizePickedMaterialTecnicoDocumentResult = (
  result: unknown
): Partial<PickedMaterialTecnicoFile> | null => {
  const value = result as any;
  const asset = value?.canceled === false
    ? (Array.isArray(value?.assets) ? value.assets[0] : null)
    : value?.type === 'success'
      ? value
      : null;

  if (!asset) return null;
  return {
    uri: firstNonEmptyString(asset.uri),
    name: firstNonEmptyString(asset.name),
    size: normalizeSize(asset.size),
    mimeType: firstNonEmptyString(asset.mimeType) || undefined,
  };
};

const getDefaultDocumentPicker = (): MaterialTecnicoDocumentPickerAdapter =>
  require('expo-document-picker') as MaterialTecnicoDocumentPickerAdapter;

export const pickMaterialTecnicoDocument = async (
  deps: MaterialTecnicoFilePickerServiceDeps = {}
): Promise<MaterialTecnicoFileValidationResult> => {
  const picker = deps.documentPicker ?? getDefaultDocumentPicker();
  const result = await picker.getDocumentAsync({
    type: SUPPORTED_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (isPickerCancelled(result)) {
    return buildResult(undefined, [{ code: 'PICKER_CANCELLED', message: 'Seleção de arquivo cancelada.' }]);
  }

  const file = normalizePickedMaterialTecnicoDocumentResult(result);
  if (!file) {
    return buildResult(undefined, [{
      code: 'PICKER_RESULT_INVALID',
      message: 'Arquivo selecionado sem dados suficientes.',
    }]);
  }

  return validatePickedMaterialTecnicoFile(file);
};

export const MaterialTecnicoFilePickerService = {
  getMaterialTecnicoFormatoFromName,
  isSupportedMaterialTecnicoMimeType,
  validatePickedMaterialTecnicoFile,
  pickMaterialTecnicoDocument,
};
