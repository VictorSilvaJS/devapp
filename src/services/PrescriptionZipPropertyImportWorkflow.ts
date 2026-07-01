import {
  PickedPrescriptionZipFile,
  PrescriptionZipFilePickerServiceDeps,
  PrescriptionZipFileValidationResult,
  pickPrescriptionZipDocument,
} from './PrescriptionZipFilePickerService';
import {
  PrescriptionZipStorageCopyResult,
  PrescriptionZipStorageDeleteResult,
  PrescriptionZipStorageServiceDeps,
  StoredPrescriptionZipFile,
  copyPrescriptionZipToInternalStorage,
  deleteStoredPrescriptionZip,
} from './PrescriptionZipStorageService';
import {
  PrescriptionZipCamada,
  PrescriptionZipEscopo,
  PrescriptionZipImportMetadata,
  PrescriptionZipImportMetadataInput,
} from '../types/anexoPrescricaoZipLocal';
import {
  PrescriptionZipImportService,
  createPrescriptionZipImportService,
} from './PrescriptionZipImportService';
import {
  getFazendaId,
  getTitularIdFazenda,
  podeEditarProdutor,
} from '../utils/acessoControle';

export type PrescriptionZipPropertyImportWorkflowErrorCode =
  | 'IMPORT_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME'
  | 'FORM_INVALID'
  | 'STORAGE_FAILED'
  | 'METADATA_FAILED'
  | 'ROLLBACK_FAILED';

export interface PrescriptionZipPropertyImportWorkflowError {
  code: PrescriptionZipPropertyImportWorkflowErrorCode;
  message: string;
  details?: unknown;
}

export interface PrescriptionZipPropertyImportWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface PrescriptionZipPropertyImportContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  fazenda_id?: string;
  produtor_id?: string;
  nome_propriedade?: string;
}

export interface PrescriptionZipPropertyImportResolvedContext {
  user: any;
  propriedade: any;
  propriedade_id: string;
  fazenda_id: string;
  produtor_id: string;
  nome_propriedade?: string;
  importado_por_usuario_id?: string;
  importado_por_nome?: string;
}

export interface PrescriptionZipPropertyImportFormInput {
  titulo?: string;
  camada?: PrescriptionZipCamada | string;
  safra?: string;
  ano?: number | string;
  escopo?: PrescriptionZipEscopo;
  talhao_id?: string;
  talhao_nome?: string;
  descricao?: string;
  visivel_para_produtor?: boolean;
}

export interface PrescriptionZipPropertyImportFormValidation {
  ok: boolean;
  errors: Record<string, string>;
  normalized?: Required<Pick<PrescriptionZipPropertyImportFormInput, 'titulo' | 'camada' | 'escopo' | 'visivel_para_produtor'>> & {
    safra?: string;
    ano?: number;
    talhao_id?: string;
    talhao_nome?: string;
    descricao?: string;
  };
}

export interface PrescriptionZipLayerOption {
  value: PrescriptionZipCamada;
  label: string;
}

export interface PrescriptionZipPropertyImportPreview {
  importId: string;
  file: PickedPrescriptionZipFile;
  resolvedContext: PrescriptionZipPropertyImportResolvedContext;
  form: PrescriptionZipPropertyImportFormInput;
  warnings: PrescriptionZipPropertyImportWarning[];
}

export interface PrescriptionZipPropertyImportPrepareResult {
  ok: boolean;
  preview?: PrescriptionZipPropertyImportPreview;
  error?: PrescriptionZipPropertyImportWorkflowError;
}

export interface PrescriptionZipPropertyImportRollbackResult {
  attempted: boolean;
  ok: boolean;
  deleted?: boolean;
  error?: unknown;
}

export interface PrescriptionZipPropertyImportConfirmResult {
  ok: boolean;
  metadata?: PrescriptionZipImportMetadata;
  storedFile?: StoredPrescriptionZipFile;
  imports?: PrescriptionZipImportMetadata[];
  warnings?: PrescriptionZipPropertyImportWarning[];
  error?: PrescriptionZipPropertyImportWorkflowError;
  rollback?: PrescriptionZipPropertyImportRollbackResult;
}

type PrescriptionZipImportServiceLike = Pick<
  ReturnType<typeof createPrescriptionZipImportService>,
  | 'createPrescriptionZipImportMetadata'
  | 'listPrescriptionZipImportsByPropriedade'
  | 'listActivePrescriptionZipImportsByPropriedade'
>;

export interface PrescriptionZipPropertyImportWorkflowDeps {
  pickerDeps?: PrescriptionZipFilePickerServiceDeps;
  storageDeps?: PrescriptionZipStorageServiceDeps;
  pickPrescriptionZipDocument?: (
    deps?: PrescriptionZipFilePickerServiceDeps
  ) => Promise<PrescriptionZipFileValidationResult>;
  copyPrescriptionZipToInternalStorage?: (
    input: {
      propriedade_id: string;
      fazenda_id?: string;
      sourceUri: string;
      originalName: string;
      importId?: string;
      overwrite?: boolean;
    },
    deps?: PrescriptionZipStorageServiceDeps
  ) => Promise<PrescriptionZipStorageCopyResult>;
  deleteStoredPrescriptionZip?: (
    uri: string,
    deps?: PrescriptionZipStorageServiceDeps
  ) => Promise<PrescriptionZipStorageDeleteResult>;
  importService?: PrescriptionZipImportServiceLike;
  now?: () => string;
  generateImportId?: () => string;
}

export const PRESCRIPTION_ZIP_LAYER_OPTIONS: PrescriptionZipLayerOption[] = [
  { value: 'prescricao', label: 'Prescrição' },
  { value: 'taxa_variavel', label: 'Taxa variável' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'pacote_prescricao', label: 'Pacote de prescrição' },
];

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
  `zipmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createError = (
  code: PrescriptionZipPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): PrescriptionZipPropertyImportWorkflowError => ({ code, message, details });

const prepareError = (
  code: PrescriptionZipPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): PrescriptionZipPropertyImportPrepareResult => ({
  ok: false,
  error: createError(code, message, details),
});

const confirmError = (
  code: PrescriptionZipPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown,
  rollback?: PrescriptionZipPropertyImportRollbackResult,
  storedFile?: StoredPrescriptionZipFile
): PrescriptionZipPropertyImportConfirmResult => ({
  ok: false,
  error: createError(code, message, details),
  rollback,
  storedFile,
});

const resolveNow = (deps: PrescriptionZipPropertyImportWorkflowDeps): string =>
  (deps.now ?? (() => new Date().toISOString()))();

const resolveAnoDefault = (deps: PrescriptionZipPropertyImportWorkflowDeps): number => {
  const currentYear = new Date(resolveNow(deps)).getFullYear();
  return Number.isFinite(currentYear) ? currentYear : new Date().getFullYear();
};

const buildUsuarioNome = (user: any): string | undefined =>
  normalizeOptionalString(user?.nome, user?.nome_completo, user?.full_name, user?.name, user?.email);

const buildUsuarioId = (user: any): string | undefined =>
  normalizeOptionalString(user?.id, user?.usuario_id, user?.user_id, user?.email);

const resolveNomePropriedade = (input: PrescriptionZipPropertyImportContext): string | undefined => {
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

const resolveIds = (input: PrescriptionZipPropertyImportContext) => {
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
  const fazendaId = firstNonEmptyString(
    input.fazenda_id,
    propriedade?.fazenda_id,
    propriedade?.fazendaId,
    compatFazendaId,
    propriedadeId
  );
  const titularId = firstNonEmptyString(
    input.produtor_id,
    propriedade?.produtor_id,
    propriedade?.proprietario_id,
    propriedade?.titular_id,
    propriedade?.titularId,
    getTitularIdFazenda(propriedade),
    fazendaId,
    propriedadeId
  );

  return { propriedade_id: propriedadeId, fazenda_id: fazendaId, produtor_id: titularId };
};

const resolveContext = (
  input: PrescriptionZipPropertyImportContext
): PrescriptionZipPropertyImportResolvedContext | null => {
  const ids = resolveIds(input);
  if (!ids.propriedade_id || !ids.fazenda_id) return null;

  return {
    user: input.user,
    propriedade: input.propriedade,
    propriedade_id: ids.propriedade_id,
    fazenda_id: ids.fazenda_id,
    produtor_id: ids.produtor_id,
    nome_propriedade: resolveNomePropriedade(input),
    importado_por_usuario_id: buildUsuarioId(input.user),
    importado_por_nome: buildUsuarioNome(input.user),
  };
};

const stripZipExtension = (name: string): string =>
  name.toLowerCase().endsWith('.zip') ? name.slice(0, name.length - 4) : name;

const stripPathComponents = (name: string): string => {
  const parts = firstNonEmptyString(name).replace(/\0/g, '').split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : firstNonEmptyString(name);
};

export const buildDefaultPrescriptionZipTitle = (fileName: string): string => {
  const base = stripZipExtension(stripPathComponents(fileName))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base || 'Prescrição ZIP local';
};

const normalizeYear = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return String(parsed) === trimmed && Number.isInteger(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

export const getPrescriptionZipLayerOption = (
  value: unknown
): PrescriptionZipLayerOption | null => {
  const normalized = firstNonEmptyString(value) as PrescriptionZipCamada;
  return PRESCRIPTION_ZIP_LAYER_OPTIONS.find((option) => option.value === normalized) ?? null;
};

export const canStartPrescriptionZipPropertyImport = (
  user: any,
  propriedade: any
): boolean => podeEditarProdutor(user, propriedade);

export const validatePrescriptionZipPropertyImportForm = (
  form: PrescriptionZipPropertyImportFormInput
): PrescriptionZipPropertyImportFormValidation => {
  const errors: Record<string, string> = {};
  const titulo = firstNonEmptyString(form.titulo);
  const layerOption = getPrescriptionZipLayerOption(form.camada);
  const escopo = form.escopo === 'talhao' ? 'talhao' : 'propriedade';
  const safra = normalizeOptionalString(form.safra);
  const descricao = normalizeOptionalString(form.descricao);
  const talhaoId = normalizeOptionalString(form.talhao_id);
  const talhaoNome = normalizeOptionalString(form.talhao_nome);
  const ano = normalizeYear(form.ano);

  if (!titulo) errors.titulo = 'Informe um título para a prescrição.';
  if (!layerOption) errors.camada = 'Selecione a camada da prescrição.';
  if (Number.isNaN(ano)) errors.ano = 'Informe um ano válido ou deixe em branco.';
  if (escopo === 'talhao' && !talhaoId && !talhaoNome) {
    errors.talhao = 'Selecione ou informe o talhão da prescrição.';
  }

  if (Object.keys(errors).length > 0 || !layerOption) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    normalized: {
      titulo,
      camada: layerOption.value,
      safra,
      ano,
      escopo,
      talhao_id: escopo === 'talhao' ? talhaoId : undefined,
      talhao_nome: escopo === 'talhao' ? talhaoNome : 'Propriedade inteira',
      descricao,
      visivel_para_produtor:
        typeof form.visivel_para_produtor === 'boolean'
          ? form.visivel_para_produtor
          : true,
    },
  };
};

const normalizePickerWarning = (warning: unknown): PrescriptionZipPropertyImportWarning => ({
  code: firstNonEmptyString((warning as any)?.code) || 'WARNING',
  message: firstNonEmptyString((warning as any)?.message) || 'Aviso de validação local.',
});

export const preparePrescriptionZipPropertyImport = async (
  input: PrescriptionZipPropertyImportContext,
  deps: PrescriptionZipPropertyImportWorkflowDeps = {}
): Promise<PrescriptionZipPropertyImportPrepareResult> => {
  const resolvedContext = resolveContext(input);
  if (!resolvedContext) {
    return prepareError('PROPRIEDADE_ID_REQUIRED', 'Propriedade obrigatória para anexar prescrição.');
  }
  if (!canStartPrescriptionZipPropertyImport(input.user, input.propriedade)) {
    return prepareError(
      'IMPORT_NOT_ALLOWED',
      'Somente Admin ou Colaborador dentro do escopo da Propriedade pode anexar prescrição.'
    );
  }

  const picker = deps.pickPrescriptionZipDocument ?? pickPrescriptionZipDocument;
  const picked = await picker(deps.pickerDeps);
  if (!picked.ok || !picked.file) {
    const pickerError = picked.errors[0];
    const code = (pickerError?.code ?? 'PICKER_RESULT_INVALID') as PrescriptionZipPropertyImportWorkflowErrorCode;
    return prepareError(
      code,
      pickerError?.message ?? 'Arquivo selecionado sem dados suficientes.',
      picked
    );
  }

  const importId = (deps.generateImportId ?? createDefaultImportId)();
  return {
    ok: true,
    preview: {
      importId,
      file: picked.file,
      resolvedContext,
      form: {
        titulo: buildDefaultPrescriptionZipTitle(picked.file.name),
        camada: 'prescricao',
        ano: resolveAnoDefault(deps),
        escopo: 'propriedade',
        visivel_para_produtor: true,
      },
      warnings: (picked.warnings ?? []).map(normalizePickerWarning),
    },
  };
};

const buildMetadataInput = (
  preview: PrescriptionZipPropertyImportPreview,
  form: NonNullable<PrescriptionZipPropertyImportFormValidation['normalized']>,
  storedFile: StoredPrescriptionZipFile
): PrescriptionZipImportMetadataInput => {
  const layerOption = getPrescriptionZipLayerOption(form.camada);
  if (!layerOption) throw new Error('Camada ZIP invalida');

  return {
    id: preview.importId,
    propriedade_id: preview.resolvedContext.propriedade_id,
    fazenda_id: preview.resolvedContext.fazenda_id,
    nome_propriedade: preview.resolvedContext.nome_propriedade,
    titulo: form.titulo,
    descricao: form.descricao,
    camada: layerOption.value,
    camada_label: layerOption.label,
    elemento: layerOption.value,
    elemento_label: layerOption.label,
    safra: form.safra,
    ano: form.ano,
    escopo: form.escopo,
    talhao_id: form.talhao_id,
    talhao_nome: form.talhao_nome,
    arquivo_nome_original: preview.file.name,
    arquivo_uri_local: storedFile.uri,
    arquivo_tamanho_bytes: storedFile.size ?? preview.file.size,
    arquivo_mime: storedFile.mimeType ?? preview.file.mimeType ?? 'application/zip',
    importado_por_usuario_id: preview.resolvedContext.importado_por_usuario_id,
    importado_por_nome: preview.resolvedContext.importado_por_nome,
    status: 'ativo',
    visivel_para_produtor: form.visivel_para_produtor,
    origem: 'arquivo_local',
  };
};

export const confirmPrescriptionZipPropertyImport = async (
  preview: PrescriptionZipPropertyImportPreview,
  formInput: PrescriptionZipPropertyImportFormInput,
  deps: PrescriptionZipPropertyImportWorkflowDeps = {}
): Promise<PrescriptionZipPropertyImportConfirmResult> => {
  const validation = validatePrescriptionZipPropertyImportForm(formInput);
  if (!validation.ok || !validation.normalized) {
    return confirmError('FORM_INVALID', 'Revise os campos obrigatórios da prescrição.', validation.errors);
  }

  const copy = deps.copyPrescriptionZipToInternalStorage ?? copyPrescriptionZipToInternalStorage;
  const copied = await copy({
    propriedade_id: preview.resolvedContext.propriedade_id,
    fazenda_id: preview.resolvedContext.fazenda_id,
    sourceUri: preview.file.uri,
    originalName: preview.file.name,
    importId: preview.importId,
  }, deps.storageDeps);

  if (!copied.ok || !copied.file) {
    return confirmError(
      'STORAGE_FAILED',
      copied.error?.message ?? 'Não foi possível copiar o ZIP para o storage interno.',
      copied
    );
  }

  const importService = deps.importService ?? PrescriptionZipImportService;
  let metadata: PrescriptionZipImportMetadata;

  try {
    metadata = await importService.createPrescriptionZipImportMetadata(
      buildMetadataInput(preview, validation.normalized, copied.file)
    );
  } catch (error) {
    const remove = deps.deleteStoredPrescriptionZip ?? deleteStoredPrescriptionZip;
    let rollback: PrescriptionZipPropertyImportRollbackResult;
    try {
      const removed = await remove(copied.file.uri, deps.storageDeps);
      rollback = {
        attempted: true,
        ok: removed.ok,
        deleted: removed.deleted,
        error: removed.error,
      };
    } catch (deleteError) {
      rollback = { attempted: true, ok: false, error: deleteError };
    }

    return confirmError(
      rollback.ok ? 'METADATA_FAILED' : 'ROLLBACK_FAILED',
      rollback.ok
        ? 'Não foi possível associar a prescrição à Propriedade.'
        : 'A cópia foi feita, mas os metadados falharam e não foi possível remover o ZIP copiado.',
      error,
      rollback,
      copied.file
    );
  }

  let imports: PrescriptionZipImportMetadata[] = [metadata];
  try {
    imports = await importService.listActivePrescriptionZipImportsByPropriedade(
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
    warnings: preview.warnings,
  };
};

export const listActivePrescriptionZipImportsForPropriedade = async (
  propriedadeId: string,
  deps: PrescriptionZipPropertyImportWorkflowDeps = {}
): Promise<PrescriptionZipImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];
  const importService = deps.importService ?? PrescriptionZipImportService;
  return importService.listActivePrescriptionZipImportsByPropriedade(id);
};
