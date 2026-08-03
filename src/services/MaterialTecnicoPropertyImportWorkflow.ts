import type {
  MaterialTecnicoCategoria,
  MaterialTecnicoEscopo,
  MaterialTecnicoImportMetadata,
  MaterialTecnicoImportMetadataInput,
  MaterialTecnicoPrescricaoInferida,
} from '../types/materialTecnicoLocal';
import type { PeriodoProdutivoMetadata } from '../types/periodoProdutivo';
import {
  MaterialTecnicoFilePickerServiceDeps,
  MaterialTecnicoFileValidationResult,
  PickedMaterialTecnicoFile,
  pickMaterialTecnicoDocument,
} from './MaterialTecnicoFilePickerService';
import {
  MaterialTecnicoImportService,
  createMaterialTecnicoImportService,
} from './MaterialTecnicoImportService';
import {
  MaterialTecnicoStorageCopyResult,
  MaterialTecnicoStorageDeleteResult,
  MaterialTecnicoStorageServiceDeps,
  StoredMaterialTecnicoFile,
  copyMaterialTecnicoToInternalStorage,
  deleteStoredMaterialTecnico,
} from './MaterialTecnicoStorageService';
import { PeriodoProdutivoService } from './PeriodoProdutivoService';
import { getFazendaId, getTitularIdFazenda, podeEditarProdutor } from '../utils/acessoControle';

export type MaterialTecnicoPropertyImportWorkflowErrorCode =
  | 'IMPORT_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'CATEGORY_INVALID'
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME'
  | 'FORM_INVALID'
  | 'PERIODO_INVALID'
  | 'STORAGE_FAILED'
  | 'METADATA_FAILED'
  | 'ROLLBACK_FAILED';

export interface MaterialTecnicoPropertyImportWorkflowError {
  code: MaterialTecnicoPropertyImportWorkflowErrorCode;
  message: string;
  details?: unknown;
}

export interface MaterialTecnicoPropertyImportWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface MaterialTecnicoPropertyImportContext {
  user: any;
  propriedade: any;
  categoria: MaterialTecnicoCategoria;
  propriedade_id?: string;
  fazenda_id?: string;
  produtor_id?: string;
  nome_propriedade?: string;
}

export interface MaterialTecnicoPropertyImportResolvedContext {
  user: any;
  propriedade: any;
  propriedade_id: string;
  fazenda_id: string;
  produtor_id: string;
  nome_propriedade?: string;
  importado_por_usuario_id?: string;
  importado_por_nome?: string;
}

export interface MaterialTecnicoPropertyImportFormInput {
  ano?: number | string;
  periodo_produtivo_id?: string;
  periodo_produtivo_label?: string;
  profundidade?: string;
  escopo?: MaterialTecnicoEscopo;
  talhao_id?: string;
  talhao_nome?: string;
  visivel_para_produtor?: boolean;
}

export interface MaterialTecnicoPropertyImportNormalizedForm {
  ano: number;
  periodo_produtivo_id?: string;
  periodo_produtivo_label?: string;
  profundidade?: string;
  escopo: MaterialTecnicoEscopo;
  talhao_id?: string;
  talhao_nome?: string;
  visivel_para_produtor: boolean;
}

export interface MaterialTecnicoPropertyImportFormValidation {
  ok: boolean;
  errors: Record<string, string>;
  normalized?: MaterialTecnicoPropertyImportNormalizedForm;
}

export interface MaterialTecnicoPropertyImportPreview {
  importId: string;
  categoria: MaterialTecnicoCategoria;
  categoriaLabel: string;
  file: PickedMaterialTecnicoFile;
  resolvedContext: MaterialTecnicoPropertyImportResolvedContext;
  form: MaterialTecnicoPropertyImportFormInput;
  tituloAutomatico: string;
  prescricaoInferida?: MaterialTecnicoPrescricaoInferida;
  prescricaoInferidaLabel?: string;
  warnings: MaterialTecnicoPropertyImportWarning[];
}

export interface MaterialTecnicoPropertyImportPrepareResult {
  ok: boolean;
  preview?: MaterialTecnicoPropertyImportPreview;
  error?: MaterialTecnicoPropertyImportWorkflowError;
}

export interface MaterialTecnicoPropertyImportConfirmResult {
  ok: boolean;
  metadata?: MaterialTecnicoImportMetadata;
  storedFile?: StoredMaterialTecnicoFile;
  imports?: MaterialTecnicoImportMetadata[];
  warnings?: MaterialTecnicoPropertyImportWarning[];
  error?: MaterialTecnicoPropertyImportWorkflowError;
  rollback?: {
    attempted: boolean;
    ok: boolean;
    deleted?: boolean;
    error?: unknown;
  };
}

type MaterialTecnicoImportServiceLike = Pick<
  ReturnType<typeof createMaterialTecnicoImportService>,
  'createMaterialTecnicoImportMetadata'
    | 'listMaterialTecnicoImportsByPropriedade'
    | 'listActiveMaterialTecnicoImportsByPropriedade'
>;

interface PeriodoProdutivoServiceLike {
  getPeriodoProdutivoById: (id: string) => Promise<PeriodoProdutivoMetadata | null>;
}

export interface MaterialTecnicoPropertyImportWorkflowDeps {
  pickerDeps?: MaterialTecnicoFilePickerServiceDeps;
  storageDeps?: MaterialTecnicoStorageServiceDeps;
  pickMaterialTecnicoDocument?: (
    deps?: MaterialTecnicoFilePickerServiceDeps
  ) => Promise<MaterialTecnicoFileValidationResult>;
  copyMaterialTecnicoToInternalStorage?: (
    input: {
      propriedade_id: string;
      fazenda_id?: string;
      ano: number;
      categoria: MaterialTecnicoCategoria;
      formato_arquivo: PickedMaterialTecnicoFile['formato'];
      sourceUri: string;
      originalName: string;
      importId?: string;
    },
    deps?: MaterialTecnicoStorageServiceDeps
  ) => Promise<MaterialTecnicoStorageCopyResult>;
  deleteStoredMaterialTecnico?: (
    uri: string,
    deps?: MaterialTecnicoStorageServiceDeps
  ) => Promise<MaterialTecnicoStorageDeleteResult>;
  importService?: MaterialTecnicoImportServiceLike;
  periodoProdutivoService?: PeriodoProdutivoServiceLike;
  now?: () => string;
  generateImportId?: () => string;
}

export const MATERIAL_TECNICO_CATEGORY_OPTIONS = [
  { value: 'fertilidade' as const, label: 'Fertilidade', description: 'Análises e mapas de fertilidade do solo.' },
  { value: 'correcao' as const, label: 'Correção de solo', description: 'Mapas e recomendações de correção.' },
  { value: 'prescricao' as const, label: 'Prescrição', description: 'Arquivos de prescrição e taxa variável.' },
];

export const MATERIAL_TECNICO_PROFUNDIDADE_OPTIONS = [
  { value: 'nao_informada', label: 'Não informada' },
  { value: '0-10 cm', label: '0–10 cm' },
  { value: '10-20 cm', label: '10–20 cm' },
  { value: '20-40 cm', label: '20–40 cm' },
];

export const MATERIAL_TECNICO_ESCOPO_OPTIONS = [
  { value: 'propriedade' as const, label: 'Propriedade inteira', description: 'Material válido para toda a Propriedade.' },
  { value: 'talhao' as const, label: 'Talhão específico', description: 'Material vinculado a um Talhão.' },
];

const CATEGORY_LABELS: Record<MaterialTecnicoCategoria, string> = {
  fertilidade: 'Fertilidade',
  correcao: 'Correção de solo',
  prescricao: 'Prescrição',
};

const PRESCRIPTION_LABELS: Record<MaterialTecnicoPrescricaoInferida, string> = {
  calcario: 'Calcário',
  fosforo: 'Fósforo',
  potassio: 'Potássio',
  nao_identificada: 'Não identificada',
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const optionalString = (...values: unknown[]): string | undefined =>
  firstNonEmptyString(...values) || undefined;

const isCategory = (value: unknown): value is MaterialTecnicoCategoria =>
  value === 'fertilidade' || value === 'correcao' || value === 'prescricao';

const createError = (
  code: MaterialTecnicoPropertyImportWorkflowErrorCode,
  message: string,
  details?: unknown
): MaterialTecnicoPropertyImportWorkflowError => ({ code, message, details });

const resolveIds = (input: MaterialTecnicoPropertyImportContext) => {
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
  const produtorId = firstNonEmptyString(
    input.produtor_id,
    propriedade?.produtor_id,
    propriedade?.proprietario_id,
    propriedade?.titular_id,
    getTitularIdFazenda(propriedade),
    fazendaId,
    propriedadeId
  );
  return { propriedadeId, fazendaId, produtorId };
};

const resolveContext = (
  input: MaterialTecnicoPropertyImportContext
): MaterialTecnicoPropertyImportResolvedContext | null => {
  const { propriedadeId, fazendaId, produtorId } = resolveIds(input);
  if (!propriedadeId || !fazendaId) return null;
  const propriedade = input.propriedade;
  return {
    user: input.user,
    propriedade,
    propriedade_id: propriedadeId,
    fazenda_id: fazendaId,
    produtor_id: produtorId,
    nome_propriedade: optionalString(
      input.nome_propriedade,
      propriedade?.propriedade_nome,
      propriedade?.fazenda,
      propriedade?.fazenda_nome,
      propriedade?.nome
    ),
    importado_por_usuario_id: optionalString(
      input.user?.id,
      input.user?.usuario_id,
      input.user?.email
    ),
    importado_por_nome: optionalString(
      input.user?.nome,
      input.user?.nome_completo,
      input.user?.name,
      input.user?.email
    ),
  };
};

const resolveCurrentYear = (deps: MaterialTecnicoPropertyImportWorkflowDeps): number => {
  const date = new Date((deps.now ?? (() => new Date().toISOString()))());
  return Number.isInteger(date.getFullYear()) ? date.getFullYear() : new Date().getFullYear();
};

const normalizeYear = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return undefined;
};

const normalizeDepth = (value: unknown): string | undefined => {
  const depth = firstNonEmptyString(value);
  return depth === 'nao_informada' ? 'Não informada' : depth || undefined;
};

export const inferMaterialTecnicoPrescriptionFromFileName = (
  fileName: string
): { value: MaterialTecnicoPrescricaoInferida; label: string } => {
  const tokens = firstNonEmptyString(fileName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\.[^.]+$/, '')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const value: MaterialTecnicoPrescricaoInferida = tokens.includes('CAL')
    ? 'calcario'
    : tokens.includes('FOR')
      ? 'fosforo'
      : tokens.includes('KCL')
        ? 'potassio'
        : 'nao_identificada';
  return { value, label: PRESCRIPTION_LABELS[value] };
};

export const canStartMaterialTecnicoPropertyImport = (
  user: any,
  propriedade: any
): boolean => podeEditarProdutor(user, propriedade);

export const validateMaterialTecnicoPropertyImportForm = (
  categoria: MaterialTecnicoCategoria,
  form: MaterialTecnicoPropertyImportFormInput
): MaterialTecnicoPropertyImportFormValidation => {
  const errors: Record<string, string> = {};
  const ano = normalizeYear(form.ano);
  const periodoId = optionalString(form.periodo_produtivo_id);
  const periodoLabel = optionalString(form.periodo_produtivo_label);
  const profundidade = normalizeDepth(form.profundidade);
  const escopo: MaterialTecnicoEscopo = categoria === 'correcao' && form.escopo === 'talhao'
    ? 'talhao'
    : 'propriedade';
  const talhaoId = optionalString(form.talhao_id);
  const talhaoNome = optionalString(form.talhao_nome);

  if (!isCategory(categoria)) errors.categoria = 'Selecione a categoria do material.';
  if (!ano || ano < 1900 || ano > 2100) errors.ano = 'Informe um ano válido entre 1900 e 2100.';
  if (!!periodoId !== !!periodoLabel) {
    errors.periodo_produtivo_id = 'Selecione um período produtivo válido ou deixe o campo vazio.';
  }
  if ((categoria === 'fertilidade' || categoria === 'correcao') && !profundidade) {
    errors.profundidade = 'Informe a profundidade ou selecione “Não informada”.';
  }
  if (escopo === 'talhao' && (!talhaoId || !talhaoNome)) {
    errors.talhao = 'Selecione o Talhão deste material.';
  }

  if (Object.keys(errors).length > 0 || !ano) return { ok: false, errors };
  return {
    ok: true,
    errors: {},
    normalized: {
      ano,
      periodo_produtivo_id: periodoId,
      periodo_produtivo_label: periodoLabel,
      profundidade: categoria === 'prescricao' ? undefined : profundidade,
      escopo,
      talhao_id: escopo === 'talhao' ? talhaoId : undefined,
      talhao_nome: escopo === 'talhao' ? talhaoNome : 'Propriedade inteira',
      visivel_para_produtor: typeof form.visivel_para_produtor === 'boolean'
        ? form.visivel_para_produtor
        : true,
    },
  };
};

export const prepareMaterialTecnicoPropertyImport = async (
  input: MaterialTecnicoPropertyImportContext,
  deps: MaterialTecnicoPropertyImportWorkflowDeps = {}
): Promise<MaterialTecnicoPropertyImportPrepareResult> => {
  const resolvedContext = resolveContext(input);
  if (!resolvedContext) {
    return { ok: false, error: createError('PROPRIEDADE_ID_REQUIRED', 'Abra uma Propriedade para anexar material.') };
  }
  if (!isCategory(input.categoria)) {
    return { ok: false, error: createError('CATEGORY_INVALID', 'Selecione Fertilidade, Correção de solo ou Prescrição.') };
  }
  if (!canStartMaterialTecnicoPropertyImport(input.user, input.propriedade)) {
    return { ok: false, error: createError('IMPORT_NOT_ALLOWED', 'Você não tem permissão para anexar material nesta Propriedade.') };
  }

  const picker = deps.pickMaterialTecnicoDocument ?? pickMaterialTecnicoDocument;
  const picked = await picker(deps.pickerDeps);
  if (!picked.ok || !picked.file) {
    const error = picked.errors[0];
    return {
      ok: false,
      error: createError(
        (error?.code ?? 'PICKER_RESULT_INVALID') as MaterialTecnicoPropertyImportWorkflowErrorCode,
        error?.message ?? 'Arquivo selecionado sem dados suficientes.',
        picked
      ),
    };
  }

  const inference = input.categoria === 'prescricao'
    ? inferMaterialTecnicoPrescriptionFromFileName(picked.file.name)
    : undefined;
  const importId = (deps.generateImportId ?? (() => `material_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`))();

  return {
    ok: true,
    preview: {
      importId,
      categoria: input.categoria,
      categoriaLabel: CATEGORY_LABELS[input.categoria],
      file: picked.file,
      resolvedContext,
      tituloAutomatico: picked.file.name,
      prescricaoInferida: inference?.value,
      prescricaoInferidaLabel: inference?.label,
      form: {
        ano: resolveCurrentYear(deps),
        profundidade: input.categoria === 'prescricao' ? undefined : 'nao_informada',
        escopo: 'propriedade',
        visivel_para_produtor: true,
      },
      warnings: (picked.warnings ?? []).map((warning) => ({
        code: firstNonEmptyString(warning.code) || 'WARNING',
        message: firstNonEmptyString(warning.message) || 'Aviso da validação local.',
      })),
    },
  };
};

const periodoMatchesContext = (
  periodo: PeriodoProdutivoMetadata,
  context: MaterialTecnicoPropertyImportResolvedContext
): boolean => {
  const ids = [
    periodo.propriedade_id,
    periodo.propriedadeId,
    periodo.fazenda_id,
    periodo.fazendaId,
  ].map((id) => firstNonEmptyString(id)).filter(Boolean);
  return ids.includes(context.propriedade_id) || ids.includes(context.fazenda_id);
};

const resolvePeriodo = async (
  normalized: MaterialTecnicoPropertyImportNormalizedForm,
  preview: MaterialTecnicoPropertyImportPreview,
  deps: MaterialTecnicoPropertyImportWorkflowDeps
): Promise<{ ok: true; form: MaterialTecnicoPropertyImportNormalizedForm } | { ok: false; error: MaterialTecnicoPropertyImportWorkflowError }> => {
  if (!normalized.periodo_produtivo_id) return { ok: true, form: normalized };
  try {
    const service = deps.periodoProdutivoService ?? PeriodoProdutivoService;
    const periodo = await service.getPeriodoProdutivoById(normalized.periodo_produtivo_id);
    if (!periodo || periodo.registro_status !== 'ativo' || !periodoMatchesContext(periodo, preview.resolvedContext)) {
      return { ok: false, error: createError('PERIODO_INVALID', 'O período selecionado não está ativo nesta Propriedade.') };
    }
    return {
      ok: true,
      form: {
        ...normalized,
        periodo_produtivo_label: firstNonEmptyString(periodo.label, normalized.periodo_produtivo_label),
      },
    };
  } catch (error) {
    return { ok: false, error: createError('PERIODO_INVALID', 'Não foi possível validar o período produtivo.', error) };
  }
};

const buildMetadataInput = (
  preview: MaterialTecnicoPropertyImportPreview,
  form: MaterialTecnicoPropertyImportNormalizedForm,
  storedFile: StoredMaterialTecnicoFile
): MaterialTecnicoImportMetadataInput => ({
  id: preview.importId,
  propriedade_id: preview.resolvedContext.propriedade_id,
  fazenda_id: preview.resolvedContext.fazenda_id,
  nome_propriedade: preview.resolvedContext.nome_propriedade,
  titulo: preview.file.name,
  categoria: preview.categoria,
  categoria_label: preview.categoriaLabel,
  ano: form.ano,
  periodo_produtivo_id: form.periodo_produtivo_id,
  periodo_produtivo_label: form.periodo_produtivo_label,
  safra: form.periodo_produtivo_label,
  profundidade: form.profundidade,
  escopo: form.escopo,
  talhao_id: form.talhao_id,
  talhao_nome: form.talhao_nome,
  prescricao_inferida: preview.prescricaoInferida,
  prescricao_inferida_label: preview.prescricaoInferidaLabel,
  arquivo_nome_original: preview.file.name,
  arquivo_uri_local: storedFile.uri,
  arquivo_tamanho_bytes: storedFile.size ?? preview.file.size,
  arquivo_mime: preview.file.mimeType ?? storedFile.mimeType,
  formato_arquivo: preview.file.formato,
  importado_por_usuario_id: preview.resolvedContext.importado_por_usuario_id,
  importado_por_nome: preview.resolvedContext.importado_por_nome,
  status: 'ativo',
  visivel_para_produtor: form.visivel_para_produtor,
  origem: 'arquivo_local',
});

export const confirmMaterialTecnicoPropertyImport = async (
  preview: MaterialTecnicoPropertyImportPreview,
  formInput: MaterialTecnicoPropertyImportFormInput,
  deps: MaterialTecnicoPropertyImportWorkflowDeps = {}
): Promise<MaterialTecnicoPropertyImportConfirmResult> => {
  const validation = validateMaterialTecnicoPropertyImportForm(preview.categoria, formInput);
  if (!validation.ok || !validation.normalized) {
    return {
      ok: false,
      error: createError('FORM_INVALID', 'Revise os campos obrigatórios do material.', validation.errors),
    };
  }

  const periodoResult = await resolvePeriodo(validation.normalized, preview, deps);
  if ('error' in periodoResult) return { ok: false, error: periodoResult.error };
  const form = periodoResult.form;

  const copy = deps.copyMaterialTecnicoToInternalStorage ?? copyMaterialTecnicoToInternalStorage;
  const copied = await copy({
    propriedade_id: preview.resolvedContext.propriedade_id,
    fazenda_id: preview.resolvedContext.fazenda_id,
    ano: form.ano,
    categoria: preview.categoria,
    formato_arquivo: preview.file.formato,
    sourceUri: preview.file.uri,
    originalName: preview.file.name,
    importId: preview.importId,
  }, deps.storageDeps);
  if (!copied.ok || !copied.file) {
    return {
      ok: false,
      error: createError('STORAGE_FAILED', copied.error?.message ?? 'Não foi possível salvar o arquivo no aparelho.', copied),
    };
  }

  const importService = deps.importService ?? MaterialTecnicoImportService;
  let metadata: MaterialTecnicoImportMetadata;
  try {
    metadata = await importService.createMaterialTecnicoImportMetadata(
      buildMetadataInput(preview, form, copied.file)
    );
  } catch (error) {
    const remove = deps.deleteStoredMaterialTecnico ?? deleteStoredMaterialTecnico;
    let rollback: MaterialTecnicoPropertyImportConfirmResult['rollback'];
    try {
      const removed = await remove(copied.file.uri, deps.storageDeps);
      rollback = { attempted: true, ok: removed.ok, deleted: removed.deleted, error: removed.error };
    } catch (deleteError) {
      rollback = { attempted: true, ok: false, error: deleteError };
    }
    return {
      ok: false,
      storedFile: copied.file,
      rollback,
      error: createError(
        rollback.ok ? 'METADATA_FAILED' : 'ROLLBACK_FAILED',
        rollback.ok
          ? 'Não foi possível associar o arquivo à Propriedade.'
          : 'Os metadados falharam e o arquivo copiado não pôde ser removido.',
        error
      ),
    };
  }

  let imports = [metadata];
  try {
    imports = await importService.listActiveMaterialTecnicoImportsByPropriedade(
      preview.resolvedContext.propriedade_id
    );
  } catch {
    // O anexo foi concluído; a tela pode recarregar a lista depois.
  }

  return {
    ok: true,
    metadata,
    storedFile: copied.file,
    imports,
    warnings: preview.warnings,
  };
};

export const listMaterialTecnicoImportsForPropriedade = async (
  propriedadeId: string,
  deps: MaterialTecnicoPropertyImportWorkflowDeps = {}
): Promise<MaterialTecnicoImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];
  return (deps.importService ?? MaterialTecnicoImportService)
    .listMaterialTecnicoImportsByPropriedade(id);
};

export const listActiveMaterialTecnicoImportsForPropriedade = async (
  propriedadeId: string,
  deps: MaterialTecnicoPropertyImportWorkflowDeps = {}
): Promise<MaterialTecnicoImportMetadata[]> => {
  const id = firstNonEmptyString(propriedadeId);
  if (!id) return [];
  return (deps.importService ?? MaterialTecnicoImportService)
    .listActiveMaterialTecnicoImportsByPropriedade(id);
};
