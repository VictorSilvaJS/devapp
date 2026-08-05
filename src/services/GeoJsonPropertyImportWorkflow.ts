import {
  GeoJsonNormalizeOptions,
  GeoJsonValidationIssue,
  GeoJsonValidationResult,
  validateAndNormalizeGeoJson,
} from '../utils/geojsonImportValidator';
import {
  GeoJsonFilePickerMessage,
  GeoJsonFilePickerServiceDeps,
  GeoJsonReadAndValidateResult,
  PickedGeoJsonFile,
  pickGeoJsonDocument,
  readGeoJsonFileAsString,
} from './GeoJsonFilePickerService';
import {
  GeoJsonStorageCopyResult,
  GeoJsonStorageDeleteResult,
  GeoJsonStorageServiceDeps,
  StoredGeoJsonFile,
  copyGeoJsonToInternalStorage,
  deleteStoredGeoJson,
} from './GeoJsonStorageService';
import {
  GeoJsonImportMetadata,
  GeoJsonImportMetadataInput,
} from '../types/geojsonImport';
import {
  GeoJsonImportService,
  createGeoJsonImportService,
} from './GeoJsonImportService';
import {
  getFazendaId,
  getTitularIdFazenda,
  podeEditarProdutor,
} from '../utils/acessoControle';

export const SELA_PRATA_I_PROPRIEDADE_ID = 'p_sela1';

export type GeoJsonPropertyImportWorkflowErrorCode =
  | 'IMPORT_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_READ_FAILED'
  | 'INVALID_GEOJSON'
  | 'VALIDATION_FAILED'
  | 'STORAGE_FAILED'
  | 'METADATA_FAILED'
  | 'ROLLBACK_FAILED'
  | 'SELA_PRATA_CONFIRMATION_REQUIRED';

export interface GeoJsonPropertyImportWorkflowError {
  code: GeoJsonPropertyImportWorkflowErrorCode;
  message: string;
  details?: unknown;
}

export interface GeoJsonPropertyImportWarning {
  code: string;
  message: string;
}

export interface GeoJsonPropertyImportContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  titular_id?: string;
  nome_propriedade?: string;
  ano?: number;
  safra?: string;
  observacoes?: string;
}

export interface GeoJsonPropertyImportConfirmInput {
  selaPrataConfirmed?: boolean;
}

export interface GeoJsonPropertyImportResolvedContext {
  user: any;
  propriedade: any;
  propriedade_id: string;
  titular_id: string;
  nome_propriedade?: string;
  ano: number;
  safra?: string;
  observacoes?: string;
  importado_por_usuario_id?: string;
  importado_por_nome?: string;
  requiresSelaPrataConfirmation: boolean;
}

export interface GeoJsonPropertyImportPreviewSummary {
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  talhoes_count: number;
  polygon_parts_count: number;
  geometry_types: string[];
  warnings_count: number;
  area_total_hectares?: number;
}

export interface GeoJsonPropertyImportPreview {
  importId: string;
  file: PickedGeoJsonFile;
  content: string;
  validation: GeoJsonValidationResult;
  summary: GeoJsonPropertyImportPreviewSummary;
  warnings: GeoJsonPropertyImportWarning[];
  resolvedContext: GeoJsonPropertyImportResolvedContext;
}

export interface GeoJsonPropertyImportPrepareResult {
  ok: boolean;
  preview?: GeoJsonPropertyImportPreview;
  error?: GeoJsonPropertyImportWorkflowError;
}

export interface GeoJsonPropertyImportRollbackResult {
  attempted: boolean;
  ok: boolean;
  deleted?: boolean;
  error?: unknown;
}

export interface GeoJsonPropertyImportConfirmResult {
  ok: boolean;
  metadata?: GeoJsonImportMetadata;
  storedFile?: StoredGeoJsonFile;
  imports?: GeoJsonImportMetadata[];
  error?: GeoJsonPropertyImportWorkflowError;
  rollback?: GeoJsonPropertyImportRollbackResult;
}

type GeoJsonImportServiceLike = Pick<
  ReturnType<typeof createGeoJsonImportService>,
  | 'createGeoJsonImportMetadata'
  | 'listGeoJsonImportsByPropriedade'
  | 'getActiveGeoJsonImportForPropriedade'
>;

export interface GeoJsonPropertyImportWorkflowDeps {
  pickerDeps?: GeoJsonFilePickerServiceDeps;
  storageDeps?: GeoJsonStorageServiceDeps;
  pickGeoJsonDocument?: (
    deps?: GeoJsonFilePickerServiceDeps
  ) => Promise<GeoJsonReadAndValidateResult>;
  readGeoJsonFileAsString?: (
    file: PickedGeoJsonFile,
    deps?: GeoJsonFilePickerServiceDeps
  ) => Promise<string>;
  validateGeoJson?: (
    input: unknown,
    options: GeoJsonNormalizeOptions
  ) => GeoJsonValidationResult;
  copyGeoJsonToInternalStorage?: (
    input: {
      propriedade_id: string;
      sourceUri: string;
      originalName: string;
      content?: string;
      importId?: string;
      overwrite?: boolean;
    },
    deps?: GeoJsonStorageServiceDeps
  ) => Promise<GeoJsonStorageCopyResult>;
  deleteStoredGeoJson?: (
    uri: string,
    deps?: GeoJsonStorageServiceDeps
  ) => Promise<GeoJsonStorageDeleteResult>;
  importService?: GeoJsonImportServiceLike;
  now?: () => string;
  generateImportId?: () => string;
}

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

const normalizeOptionalString = (...values: unknown[]): string | undefined => {
  const normalized = firstNonEmptyString(...values);
  return normalized || undefined;
};

const createDefaultImportId = (): string =>
  `geojson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createError = (
  code: GeoJsonPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): GeoJsonPropertyImportWorkflowError => ({
  code,
  message,
  details,
});

const prepareError = (
  code: GeoJsonPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): GeoJsonPropertyImportPrepareResult => ({
  ok: false,
  error: createError(code, message, details),
});

const confirmError = (
  code: GeoJsonPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown,
  rollback?: GeoJsonPropertyImportRollbackResult,
  storedFile?: StoredGeoJsonFile
): GeoJsonPropertyImportConfirmResult => ({
  ok: false,
  error: createError(code, message, details),
  rollback,
  storedFile,
});

const resolveNow = (deps: GeoJsonPropertyImportWorkflowDeps): string =>
  (deps.now ?? (() => new Date().toISOString()))();

const resolveAno = (
  ano: unknown,
  deps: GeoJsonPropertyImportWorkflowDeps
): number => {
  if (typeof ano === 'number' && Number.isInteger(ano)) return ano;

  const currentYear = new Date(resolveNow(deps)).getFullYear();
  return Number.isFinite(currentYear) ? currentYear : new Date().getFullYear();
};

const normalizeWarning = (
  warning: GeoJsonFilePickerMessage | GeoJsonValidationIssue
): GeoJsonPropertyImportWarning => ({
  code: firstNonEmptyString((warning as any)?.code) || 'WARNING',
  message: firstNonEmptyString((warning as any)?.message) || 'Aviso de validacao local.',
});

const mergeWarnings = (
  ...groups: Array<Array<GeoJsonFilePickerMessage | GeoJsonValidationIssue> | undefined>
): GeoJsonPropertyImportWarning[] => {
  const seen = new Set<string>();
  const merged: GeoJsonPropertyImportWarning[] = [];

  groups.flatMap((group) => group ?? []).forEach((warning) => {
    const normalized = normalizeWarning(warning);
    const key = `${normalized.code}|${normalized.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });

  return merged;
};

const roundOptionalArea = (value: number): number | undefined => {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Number(value.toFixed(4));
};

const sumAreaTotalHectares = (validation: GeoJsonValidationResult): number | undefined => {
  const total = validation.talhoes.reduce((sum, talhao: any) => {
    const area = typeof talhao?.area_hectares === 'number' ? talhao.area_hectares : 0;
    return Number.isFinite(area) ? sum + area : sum;
  }, 0);

  return roundOptionalArea(total);
};

const buildUsuarioNome = (user: any): string | undefined =>
  normalizeOptionalString(
    user?.nome,
    user?.nome_completo,
    user?.full_name,
    user?.name,
    user?.email
  );

const buildUsuarioId = (user: any): string | undefined =>
  normalizeOptionalString(
    user?.id,
    user?.usuario_id,
    user?.user_id,
    user?.email
  );

const resolveNomePropriedade = (input: GeoJsonPropertyImportContext): string | undefined => {
  const propriedade = input.propriedade;

  return normalizeOptionalString(
    input.nome_propriedade,
    propriedade?.propriedade_nome,
    propriedade?.propriedadeNome,
    propriedade?.fazenda,
    propriedade?.fazenda_nome,
    propriedade?.fazendaNome,
    propriedade?.nome
  );
};

const resolveIds = (input: GeoJsonPropertyImportContext) => {
  const propriedade = input.propriedade;
  const compatFazendaId = getFazendaId(propriedade);
  const propriedadeId = firstNonEmptyString(
    input.propriedade_id,
    propriedade?.propriedade_id,
    propriedade?.propriedadeId,
    compatFazendaId,
    propriedade?.id,
    propriedade?.fazenda_id,
    propriedade?.fazendaId
  );
  const titularId = firstNonEmptyString(
    input.titular_id,
    propriedade?.titular_id,
    propriedade?.produtor_id,
    propriedade?.proprietario_id,
    propriedade?.titularId,
    getTitularIdFazenda(propriedade),
    propriedadeId
  );

  return {
    propriedade_id: propriedadeId,
    titular_id: titularId,
  };
};

export const isSelaPrataIPropriedade = (
  input: Pick<GeoJsonPropertyImportContext, 'propriedade' | 'propriedade_id'>
): boolean => {
  const propriedade = input.propriedade;
  const ids = [
    input.propriedade_id,
    propriedade?.propriedade_id,
    propriedade?.propriedadeId,
    propriedade?.fazenda_id,
    propriedade?.fazendaId,
    propriedade?.id,
    getFazendaId(propriedade),
  ];

  return ids.some((id) => firstNonEmptyString(id).toLowerCase() === SELA_PRATA_I_PROPRIEDADE_ID);
};

export const canStartGeoJsonPropertyImport = (
  user: any,
  propriedade: any
): boolean => podeEditarProdutor(user, propriedade);

const resolveContext = (
  input: GeoJsonPropertyImportContext,
  deps: GeoJsonPropertyImportWorkflowDeps
): GeoJsonPropertyImportResolvedContext | null => {
  const ids = resolveIds(input);
  if (!ids.propriedade_id) return null;

  return {
    user: input.user,
    propriedade: input.propriedade,
    propriedade_id: ids.propriedade_id,
    titular_id: ids.titular_id,
    nome_propriedade: resolveNomePropriedade(input),
    ano: resolveAno(input.ano, deps),
    safra: normalizeOptionalString(input.safra),
    observacoes: normalizeOptionalString(input.observacoes),
    importado_por_usuario_id: buildUsuarioId(input.user),
    importado_por_nome: buildUsuarioNome(input.user),
    requiresSelaPrataConfirmation: isSelaPrataIPropriedade({
      propriedade: input.propriedade,
      propriedade_id: ids.propriedade_id,
    }),
  };
};

const buildValidationOptions = (
  context: GeoJsonPropertyImportResolvedContext,
  deps: GeoJsonPropertyImportWorkflowDeps
): GeoJsonNormalizeOptions => ({
  propriedade_id: context.propriedade_id,
  ano: context.ano,
  safra: context.safra,
  data_upload: resolveNow(deps),
});

const buildPreviewSummary = (
  file: PickedGeoJsonFile,
  validation: GeoJsonValidationResult
): GeoJsonPropertyImportPreviewSummary => ({
  file_name: file.name,
  file_size_bytes: file.size,
  mime_type: file.mimeType,
  talhoes_count: validation.summary.talhoes_count,
  polygon_parts_count: validation.summary.polygon_parts_count,
  geometry_types: validation.summary.geometry_types,
  warnings_count: validation.summary.warnings_count,
  area_total_hectares: sumAreaTotalHectares(validation),
});

const buildValidationErrorCode = (
  validation: GeoJsonValidationResult
): GeoJsonPropertyImportWorkflowErrorCode =>
  validation.errors.some((issue) => issue.code === 'INVALID_JSON')
    ? 'INVALID_GEOJSON'
    : 'VALIDATION_FAILED';

const buildValidationErrorMessage = (
  validation: GeoJsonValidationResult
): string =>
  validation.errors.some((issue) => issue.code === 'INVALID_JSON')
    ? 'Arquivo GeoJSON invalido.'
    : 'GeoJSON nao passou na validacao local.';

export const prepareGeoJsonPropertyImport = async (
  input: GeoJsonPropertyImportContext,
  deps: GeoJsonPropertyImportWorkflowDeps = {}
): Promise<GeoJsonPropertyImportPrepareResult> => {
  if (!canStartGeoJsonPropertyImport(input.user, input.propriedade)) {
    return prepareError(
      'IMPORT_NOT_ALLOWED',
      'Somente Admin ou Colaborador dentro do escopo da Propriedade pode anexar GeoJSON.'
    );
  }

  const resolvedContext = resolveContext(input, deps);
  if (!resolvedContext) {
    return prepareError(
      'PROPRIEDADE_ID_REQUIRED',
      'Propriedade obrigatoria para anexar GeoJSON.'
    );
  }

  const picker = deps.pickGeoJsonDocument ?? pickGeoJsonDocument;
  const picked = await picker(deps.pickerDeps);

  if (!picked.ok || !picked.file) {
    const code = (picked.error?.code ?? 'PICKER_RESULT_INVALID') as GeoJsonPropertyImportWorkflowErrorCode;
    return prepareError(
      code,
      picked.error?.message ?? 'Arquivo selecionado sem dados suficientes.',
      picked
    );
  }

  const readFile = deps.readGeoJsonFileAsString ?? readGeoJsonFileAsString;
  let content: string;
  try {
    content = await readFile(picked.file, deps.pickerDeps);
  } catch {
    return prepareError(
      'FILE_READ_FAILED',
      'Nao foi possivel ler o arquivo selecionado.',
      picked.file
    );
  }

  const validateGeoJson = deps.validateGeoJson ?? validateAndNormalizeGeoJson;
  const validation = validateGeoJson(content, buildValidationOptions(resolvedContext, deps));

  if (!validation.ok) {
    return prepareError(
      buildValidationErrorCode(validation),
      buildValidationErrorMessage(validation),
      validation
    );
  }

  const importId = (deps.generateImportId ?? createDefaultImportId)();

  return {
    ok: true,
    preview: {
      importId,
      file: picked.file,
      content,
      validation,
      summary: buildPreviewSummary(picked.file, validation),
      warnings: mergeWarnings(picked.warnings, validation.warnings),
      resolvedContext,
    },
  };
};

const buildMetadataInput = (
  preview: GeoJsonPropertyImportPreview,
  storedFile: StoredGeoJsonFile
): GeoJsonImportMetadataInput => ({
  id: preview.importId,
  propriedade_id: preview.resolvedContext.propriedade_id,
  nome_propriedade: preview.resolvedContext.nome_propriedade,
  arquivo_nome_original: preview.file.name,
  arquivo_uri_local: storedFile.uri,
  arquivo_tamanho_bytes: storedFile.size ?? preview.file.size,
  arquivo_mime: preview.file.mimeType,
  importado_por_usuario_id: preview.resolvedContext.importado_por_usuario_id,
  importado_por_nome: preview.resolvedContext.importado_por_nome,
  status: 'ativo',
  talhoes_count: preview.summary.talhoes_count,
  polygon_parts_count: preview.summary.polygon_parts_count,
  geometry_types: preview.summary.geometry_types,
  area_total_hectares: preview.summary.area_total_hectares,
  safra: preview.resolvedContext.safra,
  ano: preview.resolvedContext.ano,
  observacoes: preview.resolvedContext.observacoes,
});

export const confirmGeoJsonPropertyImport = async (
  preview: GeoJsonPropertyImportPreview,
  input: GeoJsonPropertyImportConfirmInput = {},
  deps: GeoJsonPropertyImportWorkflowDeps = {}
): Promise<GeoJsonPropertyImportConfirmResult> => {
  if (preview.resolvedContext.requiresSelaPrataConfirmation && !input.selaPrataConfirmed) {
    return confirmError(
      'SELA_PRATA_CONFIRMATION_REQUIRED',
      'Esta Propriedade ja possui demarcacao demonstrativa. Confirme para salvar apenas como anexo local.'
    );
  }

  const copy = deps.copyGeoJsonToInternalStorage ?? copyGeoJsonToInternalStorage;
  const copied = await copy({
    propriedade_id: preview.resolvedContext.propriedade_id,
    sourceUri: preview.file.uri,
    originalName: preview.file.name,
    content: preview.content,
    importId: preview.importId,
  }, deps.storageDeps);

  if (!copied.ok || !copied.file) {
    return confirmError(
      'STORAGE_FAILED',
      copied.error?.message ?? 'Nao foi possivel copiar o GeoJSON para o storage interno.',
      copied
    );
  }

  const importService = deps.importService ?? GeoJsonImportService;

  let metadata: GeoJsonImportMetadata;

  try {
    metadata = await importService.createGeoJsonImportMetadata(
      buildMetadataInput(preview, copied.file)
    );
  } catch (error) {
    const remove = deps.deleteStoredGeoJson ?? deleteStoredGeoJson;
    let rollback: GeoJsonPropertyImportRollbackResult;

    try {
      const removed = await remove(copied.file.uri, deps.storageDeps);
      rollback = {
        attempted: true,
        ok: removed.ok,
        deleted: removed.deleted,
        error: removed.error,
      };
    } catch (deleteError) {
      rollback = {
        attempted: true,
        ok: false,
        error: deleteError,
      };
    }

    if (!rollback.ok) {
      return confirmError(
        'ROLLBACK_FAILED',
        'A copia foi feita, mas os metadados falharam e nao foi possivel remover o arquivo copiado.',
        error,
        rollback,
        copied.file
      );
    }

    return confirmError(
      'METADATA_FAILED',
      'Nao foi possivel associar o GeoJSON a Propriedade.',
      error,
      rollback,
      copied.file
    );
  }

  let imports: GeoJsonImportMetadata[] = [metadata];
  try {
    imports = await importService.listGeoJsonImportsByPropriedade(
      preview.resolvedContext.propriedade_id
    );
  } catch {
    imports = [metadata];
  }

  return {
    ok: true,
    metadata,
    storedFile: copied.file,
    imports,
  };
};

export const importGeoJsonForPropriedade = async (
  input: GeoJsonPropertyImportContext & GeoJsonPropertyImportConfirmInput,
  deps: GeoJsonPropertyImportWorkflowDeps = {}
): Promise<GeoJsonPropertyImportPrepareResult | GeoJsonPropertyImportConfirmResult> => {
  const prepared = await prepareGeoJsonPropertyImport(input, deps);
  if (!prepared.ok || !prepared.preview) return prepared;

  return confirmGeoJsonPropertyImport(prepared.preview, {
    selaPrataConfirmed: input.selaPrataConfirmed,
  }, deps);
};

export const listGeoJsonImportsForPropriedade = async (
  propriedadeId: string,
  deps: GeoJsonPropertyImportWorkflowDeps = {}
): Promise<GeoJsonImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];

  const importService = deps.importService ?? GeoJsonImportService;
  return importService.listGeoJsonImportsByPropriedade(id);
};

export const getActiveGeoJsonImportForPropriedade = async (
  propriedadeId: string,
  deps: GeoJsonPropertyImportWorkflowDeps = {}
): Promise<GeoJsonImportMetadata | null> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return null;

  const importService = deps.importService ?? GeoJsonImportService;
  return importService.getActiveGeoJsonImportForPropriedade(id);
};
