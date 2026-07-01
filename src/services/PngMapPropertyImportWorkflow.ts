import {
  PickedPngFile,
  PngFilePickerServiceDeps,
  PngFileValidationResult,
  pickPngDocument,
} from './PngFilePickerService';
import {
  PngStorageCopyResult,
  PngStorageDeleteResult,
  PngStorageServiceDeps,
  StoredPngFile,
  copyPngToInternalStorage,
  deleteStoredPng,
} from './PngStorageService';
import {
  PngMapCategoria,
  PngMapElemento,
  PngMapEscopo,
  PngMapImportMetadata,
  PngMapImportMetadataInput,
} from '../types/anexoPngLocal';
import {
  PngMapImportService,
  createPngMapImportService,
} from './PngMapImportService';
import {
  getFazendaId,
  getTitularIdFazenda,
  podeEditarProdutor,
} from '../utils/acessoControle';

export type PngMapPropertyImportWorkflowErrorCode =
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

export interface PngMapPropertyImportWorkflowError {
  code: PngMapPropertyImportWorkflowErrorCode;
  message: string;
  details?: unknown;
}

export interface PngMapPropertyImportWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface PngMapPropertyImportContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  fazenda_id?: string;
  produtor_id?: string;
  nome_propriedade?: string;
}

export interface PngMapPropertyImportResolvedContext {
  user: any;
  propriedade: any;
  propriedade_id: string;
  fazenda_id: string;
  produtor_id: string;
  nome_propriedade?: string;
  importado_por_usuario_id?: string;
  importado_por_nome?: string;
}

export interface PngMapPropertyImportFormInput {
  titulo?: string;
  elemento?: PngMapElemento | string;
  safra?: string;
  ano?: number | string;
  profundidade?: string;
  escopo?: PngMapEscopo;
  talhao_id?: string;
  talhao_nome?: string;
  descricao?: string;
  visivel_para_produtor?: boolean;
}

export interface PngMapPropertyImportFormValidation {
  ok: boolean;
  errors: Record<string, string>;
  normalized?: Required<Pick<PngMapPropertyImportFormInput, 'titulo' | 'elemento' | 'escopo' | 'visivel_para_produtor'>> & {
    safra?: string;
    ano?: number;
    profundidade?: string;
    talhao_id?: string;
    talhao_nome?: string;
    descricao?: string;
  };
}

export interface PngMapCategoryOption {
  value: PngMapElemento;
  label: string;
  categoria: PngMapCategoria;
  categoria_label: string;
}

export interface PngMapPropertyImportPreview {
  importId: string;
  file: PickedPngFile;
  resolvedContext: PngMapPropertyImportResolvedContext;
  form: PngMapPropertyImportFormInput;
  warnings: PngMapPropertyImportWarning[];
}

export interface PngMapPropertyImportPrepareResult {
  ok: boolean;
  preview?: PngMapPropertyImportPreview;
  error?: PngMapPropertyImportWorkflowError;
}

export interface PngMapPropertyImportRollbackResult {
  attempted: boolean;
  ok: boolean;
  deleted?: boolean;
  error?: unknown;
}

export interface PngMapPropertyImportConfirmResult {
  ok: boolean;
  metadata?: PngMapImportMetadata;
  storedFile?: StoredPngFile;
  imports?: PngMapImportMetadata[];
  warnings?: PngMapPropertyImportWarning[];
  error?: PngMapPropertyImportWorkflowError;
  rollback?: PngMapPropertyImportRollbackResult;
}

type PngMapImportServiceLike = Pick<
  ReturnType<typeof createPngMapImportService>,
  | 'createPngMapImportMetadata'
  | 'listPngMapImportsByPropriedade'
  | 'listActivePngMapImportsByPropriedade'
>;

export interface PngMapPropertyImportWorkflowDeps {
  pickerDeps?: PngFilePickerServiceDeps;
  storageDeps?: PngStorageServiceDeps;
  pickPngDocument?: (
    deps?: PngFilePickerServiceDeps
  ) => Promise<PngFileValidationResult>;
  copyPngToInternalStorage?: (
    input: {
      propriedade_id: string;
      fazenda_id?: string;
      sourceUri: string;
      originalName: string;
      importId?: string;
      overwrite?: boolean;
    },
    deps?: PngStorageServiceDeps
  ) => Promise<PngStorageCopyResult>;
  deleteStoredPng?: (
    uri: string,
    deps?: PngStorageServiceDeps
  ) => Promise<PngStorageDeleteResult>;
  importService?: PngMapImportServiceLike;
  now?: () => string;
  generateImportId?: () => string;
}

export const PNG_MAP_PROPERTY_CATEGORY_OPTIONS: PngMapCategoryOption[] = [
  { value: 'ph', label: 'pH', categoria: 'fertilidade', categoria_label: 'Fertilidade' },
  { value: 'fosforo', label: 'Fósforo', categoria: 'fertilidade', categoria_label: 'Fertilidade' },
  { value: 'potassio', label: 'Potássio', categoria: 'fertilidade', categoria_label: 'Fertilidade' },
  { value: 'argila', label: 'Argila', categoria: 'fertilidade', categoria_label: 'Fertilidade' },
  { value: 'materia_organica', label: 'Matéria orgânica', categoria: 'fertilidade', categoria_label: 'Fertilidade' },
  { value: 'calcario', label: 'Calcário', categoria: 'correcao', categoria_label: 'Correção de solo' },
  { value: 'gesso', label: 'Gesso', categoria: 'correcao', categoria_label: 'Correção de solo' },
  { value: 'corretivo', label: 'Corretivo', categoria: 'correcao', categoria_label: 'Correção de solo' },
  { value: 'correcao_solo', label: 'Correção de solo', categoria: 'correcao', categoria_label: 'Correção de solo' },
  { value: 'necessidade_aplicacao', label: 'Necessidade de aplicação', categoria: 'correcao', categoria_label: 'Correção de solo' },
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
  `pngmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createError = (
  code: PngMapPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): PngMapPropertyImportWorkflowError => ({ code, message, details });

const prepareError = (
  code: PngMapPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): PngMapPropertyImportPrepareResult => ({
  ok: false,
  error: createError(code, message, details),
});

const confirmError = (
  code: PngMapPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown,
  rollback?: PngMapPropertyImportRollbackResult,
  storedFile?: StoredPngFile
): PngMapPropertyImportConfirmResult => ({
  ok: false,
  error: createError(code, message, details),
  rollback,
  storedFile,
});

const resolveNow = (deps: PngMapPropertyImportWorkflowDeps): string =>
  (deps.now ?? (() => new Date().toISOString()))();

const resolveAnoDefault = (
  deps: PngMapPropertyImportWorkflowDeps
): number => {
  const currentYear = new Date(resolveNow(deps)).getFullYear();
  return Number.isFinite(currentYear) ? currentYear : new Date().getFullYear();
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

const resolveNomePropriedade = (input: PngMapPropertyImportContext): string | undefined => {
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

const resolveIds = (input: PngMapPropertyImportContext) => {
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

  return {
    propriedade_id: propriedadeId,
    fazenda_id: fazendaId,
    produtor_id: titularId,
  };
};

const resolveContext = (
  input: PngMapPropertyImportContext
): PngMapPropertyImportResolvedContext | null => {
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

const stripPngExtension = (name: string): string =>
  name.toLowerCase().endsWith('.png') ? name.slice(0, name.length - 4) : name;

const stripPathComponents = (name: string): string => {
  const parts = firstNonEmptyString(name).replace(/\0/g, '').split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : firstNonEmptyString(name);
};

export const buildDefaultPngMapTitle = (fileName: string): string => {
  const base = stripPngExtension(stripPathComponents(fileName))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return base || 'Mapa PNG local';
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

export const getPngMapCategoryOption = (
  value: unknown
): PngMapCategoryOption | null => {
  const normalized = firstNonEmptyString(value) as PngMapElemento;
  return PNG_MAP_PROPERTY_CATEGORY_OPTIONS.find((option) => option.value === normalized) ?? null;
};

export const canStartPngMapPropertyImport = (
  user: any,
  propriedade: any
): boolean => podeEditarProdutor(user, propriedade);

export const validatePngMapPropertyImportForm = (
  form: PngMapPropertyImportFormInput
): PngMapPropertyImportFormValidation => {
  const errors: Record<string, string> = {};
  const titulo = firstNonEmptyString(form.titulo);
  const categoryOption = getPngMapCategoryOption(form.elemento);
  const escopo = form.escopo === 'talhao' ? 'talhao' : 'propriedade';
  const safra = normalizeOptionalString(form.safra);
  const profundidade = normalizeOptionalString(form.profundidade);
  const descricao = normalizeOptionalString(form.descricao);
  const talhaoId = normalizeOptionalString(form.talhao_id);
  const talhaoNome = normalizeOptionalString(form.talhao_nome);
  const ano = normalizeYear(form.ano);

  if (!titulo) {
    errors.titulo = 'Informe um titulo para o mapa PNG.';
  }

  if (!categoryOption) {
    errors.elemento = 'Selecione o tipo de mapa PNG.';
  }

  if (Number.isNaN(ano)) {
    errors.ano = 'Informe um ano valido ou deixe em branco.';
  }

  if (escopo === 'talhao' && !talhaoId && !talhaoNome) {
    errors.talhao = 'Selecione ou informe o talhao do mapa PNG.';
  }

  if (Object.keys(errors).length > 0 || !categoryOption) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: {},
    normalized: {
      titulo,
      elemento: categoryOption.value,
      safra,
      ano,
      profundidade,
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

const normalizePickerWarning = (warning: unknown): PngMapPropertyImportWarning => ({
  code: firstNonEmptyString((warning as any)?.code) || 'WARNING',
  message: firstNonEmptyString((warning as any)?.message) || 'Aviso de validacao local.',
});

export const preparePngMapPropertyImport = async (
  input: PngMapPropertyImportContext,
  deps: PngMapPropertyImportWorkflowDeps = {}
): Promise<PngMapPropertyImportPrepareResult> => {
  const resolvedContext = resolveContext(input);
  if (!resolvedContext) {
    return prepareError(
      'PROPRIEDADE_ID_REQUIRED',
      'Propriedade obrigatoria para anexar PNG.'
    );
  }

  if (!canStartPngMapPropertyImport(input.user, input.propriedade)) {
    return prepareError(
      'IMPORT_NOT_ALLOWED',
      'Somente Admin ou Colaborador dentro do escopo da Propriedade pode anexar PNG.'
    );
  }

  const picker = deps.pickPngDocument ?? pickPngDocument;
  const picked = await picker(deps.pickerDeps);

  if (!picked.ok || !picked.file) {
    const pickerError = picked.errors[0];
    const code = (pickerError?.code ?? 'PICKER_RESULT_INVALID') as PngMapPropertyImportWorkflowErrorCode;
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
        titulo: buildDefaultPngMapTitle(picked.file.name),
        elemento: 'ph',
        ano: resolveAnoDefault(deps),
        escopo: 'propriedade',
        visivel_para_produtor: true,
      },
      warnings: (picked.warnings ?? []).map(normalizePickerWarning),
    },
  };
};

const buildMetadataInput = (
  preview: PngMapPropertyImportPreview,
  form: NonNullable<PngMapPropertyImportFormValidation['normalized']>,
  storedFile: StoredPngFile
): PngMapImportMetadataInput => {
  const categoryOption = getPngMapCategoryOption(form.elemento);
  if (!categoryOption) {
    throw new Error('Categoria PNG invalida');
  }

  return {
    id: preview.importId,
    propriedade_id: preview.resolvedContext.propriedade_id,
    fazenda_id: preview.resolvedContext.fazenda_id,
    nome_propriedade: preview.resolvedContext.nome_propriedade,
    titulo: form.titulo,
    descricao: form.descricao,
    categoria: categoryOption.categoria,
    categoria_label: categoryOption.categoria_label,
    elemento: categoryOption.value,
    elemento_label: categoryOption.label,
    safra: form.safra,
    ano: form.ano,
    profundidade: form.profundidade,
    escopo: form.escopo,
    talhao_id: form.talhao_id,
    talhao_nome: form.talhao_nome,
    arquivo_nome_original: preview.file.name,
    arquivo_uri_local: storedFile.uri,
    arquivo_tamanho_bytes: storedFile.size ?? preview.file.size,
    arquivo_mime: storedFile.mimeType ?? preview.file.mimeType ?? 'image/png',
    importado_por_usuario_id: preview.resolvedContext.importado_por_usuario_id,
    importado_por_nome: preview.resolvedContext.importado_por_nome,
    status: 'ativo',
    visivel_para_produtor: form.visivel_para_produtor,
    origem: 'arquivo_local',
  };
};

export const confirmPngMapPropertyImport = async (
  preview: PngMapPropertyImportPreview,
  formInput: PngMapPropertyImportFormInput,
  deps: PngMapPropertyImportWorkflowDeps = {}
): Promise<PngMapPropertyImportConfirmResult> => {
  const validation = validatePngMapPropertyImportForm(formInput);
  if (!validation.ok || !validation.normalized) {
    return confirmError(
      'FORM_INVALID',
      'Revise os campos obrigatorios do mapa PNG.',
      validation.errors
    );
  }

  const copy = deps.copyPngToInternalStorage ?? copyPngToInternalStorage;
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
      copied.error?.message ?? 'Nao foi possivel copiar o PNG para o storage interno.',
      copied
    );
  }

  const importService = deps.importService ?? PngMapImportService;

  let metadata: PngMapImportMetadata;

  try {
    metadata = await importService.createPngMapImportMetadata(
      buildMetadataInput(preview, validation.normalized, copied.file)
    );
  } catch (error) {
    const remove = deps.deleteStoredPng ?? deleteStoredPng;
    let rollback: PngMapPropertyImportRollbackResult;

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
        'A copia foi feita, mas os metadados falharam e nao foi possivel remover o PNG copiado.',
        error,
        rollback,
        copied.file
      );
    }

    return confirmError(
      'METADATA_FAILED',
      'Nao foi possivel associar o PNG a Propriedade.',
      error,
      rollback,
      copied.file
    );
  }

  let imports: PngMapImportMetadata[] = [metadata];
  try {
    imports = await importService.listActivePngMapImportsByPropriedade(
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

export const importPngMapForPropriedade = async (
  input: PngMapPropertyImportContext & { form?: PngMapPropertyImportFormInput },
  deps: PngMapPropertyImportWorkflowDeps = {}
): Promise<PngMapPropertyImportPrepareResult | PngMapPropertyImportConfirmResult> => {
  const prepared = await preparePngMapPropertyImport(input, deps);
  if (!prepared.ok || !prepared.preview) return prepared;

  return confirmPngMapPropertyImport(
    prepared.preview,
    input.form ?? prepared.preview.form,
    deps
  );
};

export const listPngMapImportsForPropriedade = async (
  propriedadeId: string,
  deps: PngMapPropertyImportWorkflowDeps = {}
): Promise<PngMapImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];

  const importService = deps.importService ?? PngMapImportService;
  return importService.listPngMapImportsByPropriedade(id);
};

export const listActivePngMapImportsForPropriedade = async (
  propriedadeId: string,
  deps: PngMapPropertyImportWorkflowDeps = {}
): Promise<PngMapImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];

  const importService = deps.importService ?? PngMapImportService;
  return importService.listActivePngMapImportsByPropriedade(id);
};
