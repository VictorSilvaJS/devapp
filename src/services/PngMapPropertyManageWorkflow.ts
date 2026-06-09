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
  PngMapImportMetadata,
  PngMapImportMetadataInput,
} from '../types/anexoPngLocal';
import {
  PngMapImportService,
  createPngMapImportService,
} from './PngMapImportService';
import { canStartPngMapPropertyImport } from './PngMapPropertyImportWorkflow';
import { getFazendaId } from '../utils/acessoControle';
import { isPngLocalMapa } from '../utils/pngMapToMapaCompat';

export type PngMapPropertyManageErrorCode =
  | 'MANAGE_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'PNG_IMPORT_NOT_FOUND'
  | 'PNG_IMPORT_OUT_OF_SCOPE'
  | 'PNG_IMPORT_NOT_LOCAL'
  | 'PICKER_CANCELLED'
  | 'PICKER_RESULT_INVALID'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE_URI'
  | 'MISSING_FILE_NAME'
  | 'STORAGE_FAILED'
  | 'METADATA_CREATE_FAILED'
  | 'METADATA_REPLACE_FAILED'
  | 'METADATA_REMOVE_FAILED'
  | 'ROLLBACK_FAILED';

export type PngMapPropertyManageWarningCode =
  | 'PREVIOUS_IMPORT_URI_MISSING'
  | 'PREVIOUS_FILE_ALREADY_MISSING'
  | 'PREVIOUS_FILE_DELETE_FAILED'
  | 'REMOVED_IMPORT_URI_MISSING'
  | 'REMOVED_FILE_ALREADY_MISSING'
  | 'REMOVED_FILE_DELETE_FAILED'
  | 'NEW_FILE_ROLLBACK_FAILED';

export interface PngMapPropertyManageError {
  code: PngMapPropertyManageErrorCode;
  message: string;
  details?: unknown;
}

export interface PngMapPropertyManageWarning {
  code: PngMapPropertyManageWarningCode;
  message: string;
  details?: unknown;
}

export interface PngMapPropertyManageContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  fazenda_id?: string;
  metadata?: PngMapImportMetadata | null;
  metadataId?: string;
  mapa?: Record<string, any> | null;
}

export interface PngMapPropertyReplaceResult {
  ok: boolean;
  metadata?: PngMapImportMetadata;
  previousMetadata?: PngMapImportMetadata;
  pickedFile?: PickedPngFile;
  storedFile?: StoredPngFile;
  imports?: PngMapImportMetadata[];
  deletedPreviousFile?: boolean;
  previousDeleteResult?: PngStorageDeleteResult;
  rollback?: {
    attempted: boolean;
    ok: boolean;
    deletedNewFile?: boolean;
    removedNewMetadata?: boolean;
    error?: unknown;
  };
  warnings?: PngMapPropertyManageWarning[];
  error?: PngMapPropertyManageError;
}

export interface PngMapPropertyRemoveResult {
  ok: boolean;
  metadata?: PngMapImportMetadata;
  activeMetadata?: PngMapImportMetadata;
  imports?: PngMapImportMetadata[];
  deletedFile?: boolean;
  deleteResult?: PngStorageDeleteResult;
  warnings?: PngMapPropertyManageWarning[];
  error?: PngMapPropertyManageError;
}

type PngMapManageServiceLike = Pick<
  ReturnType<typeof createPngMapImportService>,
  | 'createPngMapImportMetadata'
  | 'getPngMapImportById'
  | 'listActivePngMapImportsByPropriedade'
  | 'markPngMapImportAsSubstituido'
  | 'markPngMapImportAsRemoved'
>;

export interface PngMapPropertyManageWorkflowDeps {
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
  importService?: PngMapManageServiceLike;
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

const createError = (
  code: PngMapPropertyManageErrorCode,
  message: string,
  details?: unknown
): PngMapPropertyManageError => ({ code, message, details });

const createWarning = (
  code: PngMapPropertyManageWarningCode,
  message: string,
  details?: unknown
): PngMapPropertyManageWarning => ({ code, message, details });

const createDefaultImportId = (): string =>
  `pngmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildUsuarioNome = (user: any): string | undefined =>
  firstNonEmptyString(
    user?.nome,
    user?.nome_completo,
    user?.full_name,
    user?.name,
    user?.email
  ) || undefined;

const buildUsuarioId = (user: any): string | undefined =>
  firstNonEmptyString(
    user?.id,
    user?.usuario_id,
    user?.user_id,
    user?.email
  ) || undefined;

const resolveIds = (
  input: Pick<PngMapPropertyManageContext, 'propriedade' | 'propriedade_id' | 'fazenda_id'>
) => {
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

  return {
    propriedade_id: propriedadeId,
    fazenda_id: fazendaId,
  };
};

const metadataMatchesContext = (
  metadata: PngMapImportMetadata,
  ids: { propriedade_id: string; fazenda_id: string }
): boolean => {
  const allowedIds = new Set(
    [ids.propriedade_id, ids.fazenda_id]
      .map(firstNonEmptyString)
      .filter(Boolean)
  );

  return allowedIds.has(metadata.propriedade_id) || allowedIds.has(metadata.fazenda_id);
};

const getImportService = (
  deps: PngMapPropertyManageWorkflowDeps
): PngMapManageServiceLike => deps.importService ?? PngMapImportService;

const getMetadataId = (input: PngMapPropertyManageContext): string =>
  firstNonEmptyString(
    input.metadata?.id,
    input.metadataId,
    input.mapa?.png_map_import_id,
    input.mapa?.id?.startsWith?.('png_local:') ? input.mapa.id.slice('png_local:'.length) : ''
  );

const resolveMetadata = async (
  input: PngMapPropertyManageContext,
  service: PngMapManageServiceLike
): Promise<PngMapImportMetadata | null> => {
  if (input.metadata) return input.metadata;

  const id = getMetadataId(input);
  if (!id) return null;

  return service.getPngMapImportById(id);
};

const isLocalMetadata = (metadata: PngMapImportMetadata | null | undefined): metadata is PngMapImportMetadata =>
  !!metadata
  && firstNonEmptyString(metadata.id).length > 0
  && metadata.origem === 'arquivo_local';

export const canManagePngMapForPropriedade = (
  user: any,
  propriedade: any
): boolean => canStartPngMapPropertyImport(user, propriedade);

export const canManagePngMapItem = (
  user: any,
  propriedade: any,
  mapa?: Record<string, any> | null
): boolean => canManagePngMapForPropriedade(user, propriedade) && isPngLocalMapa(mapa);

const resolveManageTarget = async (
  input: PngMapPropertyManageContext,
  deps: PngMapPropertyManageWorkflowDeps,
  actionLabel: 'substituir' | 'remover'
): Promise<{
  ok: boolean;
  ids?: { propriedade_id: string; fazenda_id: string };
  metadata?: PngMapImportMetadata;
  service?: PngMapManageServiceLike;
  error?: PngMapPropertyManageError;
}> => {
  const ids = resolveIds(input);
  if (!ids.propriedade_id || !ids.fazenda_id) {
    return {
      ok: false,
      error: createError(
        'PROPRIEDADE_ID_REQUIRED',
        `Propriedade obrigatoria para ${actionLabel} PNG local.`
      ),
    };
  }

  if (!canManagePngMapForPropriedade(input.user, input.propriedade)) {
    return {
      ok: false,
      error: createError(
        'MANAGE_NOT_ALLOWED',
        'Somente Admin ou Colaborador dentro do escopo da Propriedade pode gerenciar PNG local.'
      ),
    };
  }

  if (input.mapa && !isPngLocalMapa(input.mapa)) {
    return {
      ok: false,
      error: createError(
        'PNG_IMPORT_NOT_LOCAL',
        'Este material nao e um PNG local gerenciavel.'
      ),
    };
  }

  const service = getImportService(deps);
  const metadata = await resolveMetadata(input, service);

  if (!metadata) {
    return {
      ok: false,
      service,
      error: createError(
        'PNG_IMPORT_NOT_FOUND',
        'Metadado do PNG local nao encontrado.'
      ),
    };
  }

  if (!isLocalMetadata(metadata)) {
    return {
      ok: false,
      ids,
      metadata,
      service,
      error: createError(
        'PNG_IMPORT_NOT_LOCAL',
        'Este material nao e um PNG local gerenciavel.',
        metadata
      ),
    };
  }

  if (!metadataMatchesContext(metadata, ids)) {
    return {
      ok: false,
      ids,
      metadata,
      service,
      error: createError(
        'PNG_IMPORT_OUT_OF_SCOPE',
        'PNG local informado nao pertence a esta Propriedade.',
        metadata
      ),
    };
  }

  return {
    ok: true,
    ids,
    metadata,
    service,
  };
};

const pickReplacementPng = async (
  deps: PngMapPropertyManageWorkflowDeps
): Promise<{ ok: boolean; file?: PickedPngFile; error?: PngMapPropertyManageError }> => {
  const picker = deps.pickPngDocument ?? pickPngDocument;
  const picked = await picker(deps.pickerDeps);

  if (!picked.ok || !picked.file) {
    const pickerError = picked.errors[0];
    const code = (pickerError?.code ?? 'PICKER_RESULT_INVALID') as PngMapPropertyManageErrorCode;
    return {
      ok: false,
      error: createError(
        code,
        pickerError?.message ?? 'Arquivo selecionado sem dados suficientes.',
        picked
      ),
    };
  }

  return {
    ok: true,
    file: picked.file,
  };
};

const buildReplacementMetadataInput = (
  previous: PngMapImportMetadata,
  params: {
    newId: string;
    file: PickedPngFile;
    storedFile: StoredPngFile;
    user: any;
  }
): PngMapImportMetadataInput => ({
  id: params.newId,
  propriedade_id: previous.propriedade_id,
  fazenda_id: previous.fazenda_id,
  nome_propriedade: previous.nome_propriedade,
  titulo: previous.titulo,
  descricao: previous.descricao,
  categoria: previous.categoria,
  categoria_label: previous.categoria_label,
  elemento: previous.elemento,
  elemento_label: previous.elemento_label,
  safra: previous.safra,
  ano: previous.ano,
  profundidade: previous.profundidade,
  escopo: previous.escopo,
  talhao_id: previous.talhao_id,
  talhao_nome: previous.talhao_nome,
  arquivo_nome_original: params.file.name,
  arquivo_uri_local: params.storedFile.uri,
  arquivo_tamanho_bytes: params.storedFile.size ?? params.file.size,
  arquivo_mime: params.storedFile.mimeType ?? params.file.mimeType ?? 'image/png',
  importado_por_usuario_id: buildUsuarioId(params.user) ?? previous.importado_por_usuario_id,
  importado_por_nome: buildUsuarioNome(params.user) ?? previous.importado_por_nome,
  status: 'ativo',
  visivel_para_produtor: previous.visivel_para_produtor,
  origem: 'arquivo_local',
});

const deletePngWithWarning = async (
  uri: string,
  params: {
    deleteStored: NonNullable<PngMapPropertyManageWorkflowDeps['deleteStoredPng']>;
    storageDeps?: PngStorageServiceDeps;
    missingWarning: PngMapPropertyManageWarning;
    failedWarningCode: PngMapPropertyManageWarningCode;
    failedWarningMessage: string;
  }
): Promise<{
  deletedFile: boolean;
  deleteResult?: PngStorageDeleteResult;
  warnings: PngMapPropertyManageWarning[];
}> => {
  const warnings: PngMapPropertyManageWarning[] = [];

  try {
    const deleteResult = await params.deleteStored(uri, params.storageDeps);
    if (!deleteResult.ok) {
      warnings.push(createWarning(
        params.failedWarningCode,
        deleteResult.error?.message || params.failedWarningMessage,
        deleteResult.error
      ));
      return {
        deletedFile: false,
        deleteResult,
        warnings,
      };
    }

    if (!deleteResult.deleted) {
      warnings.push(params.missingWarning);
    }

    return {
      deletedFile: deleteResult.deleted,
      deleteResult,
      warnings,
    };
  } catch (error) {
    warnings.push(createWarning(
      params.failedWarningCode,
      params.failedWarningMessage,
      error
    ));
    return {
      deletedFile: false,
      warnings,
    };
  }
};

const rollbackNewPng = async (
  params: {
    service: PngMapManageServiceLike;
    metadata?: PngMapImportMetadata;
    storedFile?: StoredPngFile;
    deleteStored: NonNullable<PngMapPropertyManageWorkflowDeps['deleteStoredPng']>;
    storageDeps?: PngStorageServiceDeps;
  }
): Promise<PngMapPropertyReplaceResult['rollback']> => {
  let removedNewMetadata = false;
  let deletedNewFile = false;
  let error: unknown;

  if (!params.metadata && !params.storedFile) {
    return {
      attempted: false,
      ok: true,
    };
  }

  if (params.metadata) {
    try {
      await params.service.markPngMapImportAsRemoved(params.metadata.id);
      removedNewMetadata = true;
    } catch (metadataError) {
      error = metadataError;
    }
  }

  if (params.storedFile?.uri) {
    try {
      const deleted = await params.deleteStored(params.storedFile.uri, params.storageDeps);
      deletedNewFile = deleted.ok && deleted.deleted;
      if (!deleted.ok && !error) {
        error = deleted.error;
      }
    } catch (deleteError) {
      if (!error) error = deleteError;
    }
  }

  return {
    attempted: true,
    ok: (!params.metadata || removedNewMetadata) && (!params.storedFile || deletedNewFile),
    removedNewMetadata,
    deletedNewFile,
    error,
  };
};

export const replacePngMapForPropriedade = async (
  input: PngMapPropertyManageContext,
  deps: PngMapPropertyManageWorkflowDeps = {}
): Promise<PngMapPropertyReplaceResult> => {
  const target = await resolveManageTarget(input, deps, 'substituir');
  if (!target.ok || !target.ids || !target.metadata || !target.service) {
    return {
      ok: false,
      error: target.error,
    };
  }

  if (target.metadata.status !== 'ativo') {
    return {
      ok: false,
      previousMetadata: target.metadata,
      error: createError(
        'PNG_IMPORT_NOT_FOUND',
        'PNG local ativo nao encontrado para substituicao.',
        target.metadata
      ),
    };
  }

  const picked = await pickReplacementPng(deps);
  if (!picked.ok || !picked.file) {
    return {
      ok: false,
      previousMetadata: target.metadata,
      error: picked.error,
    };
  }

  const newId = (deps.generateImportId ?? createDefaultImportId)();
  const copy = deps.copyPngToInternalStorage ?? copyPngToInternalStorage;
  const copied = await copy({
    propriedade_id: target.ids.propriedade_id,
    fazenda_id: target.ids.fazenda_id,
    sourceUri: picked.file.uri,
    originalName: picked.file.name,
    importId: newId,
  }, deps.storageDeps);

  if (!copied.ok || !copied.file) {
    return {
      ok: false,
      previousMetadata: target.metadata,
      pickedFile: picked.file,
      error: createError(
        'STORAGE_FAILED',
        copied.error?.message ?? 'Nao foi possivel copiar o novo PNG para o storage interno.',
        copied
      ),
    };
  }

  let newMetadata: PngMapImportMetadata | undefined;
  const deleteStored = deps.deleteStoredPng ?? deleteStoredPng;

  try {
    newMetadata = await target.service.createPngMapImportMetadata(
      buildReplacementMetadataInput(target.metadata, {
        newId,
        file: picked.file,
        storedFile: copied.file,
        user: input.user,
      })
    );
  } catch (error) {
    const rollback = await rollbackNewPng({
      service: target.service,
      storedFile: copied.file,
      deleteStored,
      storageDeps: deps.storageDeps,
    });

    return {
      ok: false,
      previousMetadata: target.metadata,
      pickedFile: picked.file,
      storedFile: copied.file,
      rollback,
      error: createError(
        rollback.ok ? 'METADATA_CREATE_FAILED' : 'ROLLBACK_FAILED',
        rollback.ok
          ? 'Nao foi possivel criar o novo metadado do PNG local.'
          : 'A copia foi feita, mas os metadados falharam e nao foi possivel remover o novo arquivo.',
        error
      ),
    };
  }

  let previousUpdated: PngMapImportMetadata;
  try {
    previousUpdated = await target.service.markPngMapImportAsSubstituido(target.metadata.id);
  } catch (error) {
    const rollback = await rollbackNewPng({
      service: target.service,
      metadata: newMetadata,
      storedFile: copied.file,
      deleteStored,
      storageDeps: deps.storageDeps,
    });

    return {
      ok: false,
      metadata: newMetadata,
      previousMetadata: target.metadata,
      pickedFile: picked.file,
      storedFile: copied.file,
      rollback,
      error: createError(
        rollback.ok ? 'METADATA_REPLACE_FAILED' : 'ROLLBACK_FAILED',
        rollback.ok
          ? 'Nao foi possivel marcar o PNG anterior como substituido.'
          : 'Nao foi possivel marcar o PNG anterior como substituido nem desfazer o novo PNG.',
        error
      ),
    };
  }

  const warnings: PngMapPropertyManageWarning[] = [];
  let deletedPreviousFile = false;
  let previousDeleteResult: PngStorageDeleteResult | undefined;
  const previousUri = firstNonEmptyString(target.metadata.arquivo_uri_local);
  const newUri = firstNonEmptyString(newMetadata.arquivo_uri_local);

  if (previousUri && previousUri !== newUri) {
    const deleted = await deletePngWithWarning(previousUri, {
      deleteStored,
      storageDeps: deps.storageDeps,
      missingWarning: createWarning(
        'PREVIOUS_FILE_ALREADY_MISSING',
        'O novo PNG foi ativado. O arquivo local anterior ja nao existia no aparelho.',
        target.metadata
      ),
      failedWarningCode: 'PREVIOUS_FILE_DELETE_FAILED',
      failedWarningMessage: 'O novo PNG foi ativado, mas nao foi possivel apagar o arquivo local anterior.',
    });
    deletedPreviousFile = deleted.deletedFile;
    previousDeleteResult = deleted.deleteResult;
    warnings.push(...deleted.warnings);
  } else if (!previousUri) {
    warnings.push(createWarning(
      'PREVIOUS_IMPORT_URI_MISSING',
      'O novo PNG foi ativado, mas o metadado anterior nao tinha URI de arquivo local.',
      target.metadata
    ));
  }

  let imports: PngMapImportMetadata[] | undefined;
  try {
    imports = await target.service.listActivePngMapImportsByPropriedade(target.ids.propriedade_id);
  } catch {
    imports = [newMetadata];
  }

  return {
    ok: true,
    metadata: newMetadata,
    previousMetadata: previousUpdated,
    pickedFile: picked.file,
    storedFile: copied.file,
    imports,
    deletedPreviousFile,
    previousDeleteResult,
    warnings,
  };
};

export const removePngMapForPropriedade = async (
  input: PngMapPropertyManageContext,
  deps: PngMapPropertyManageWorkflowDeps = {}
): Promise<PngMapPropertyRemoveResult> => {
  const target = await resolveManageTarget(input, deps, 'remover');
  if (!target.ok || !target.ids || !target.metadata || !target.service) {
    return {
      ok: false,
      error: target.error,
    };
  }

  if (target.metadata.status !== 'ativo') {
    return {
      ok: false,
      activeMetadata: target.metadata,
      error: createError(
        'PNG_IMPORT_NOT_FOUND',
        'PNG local ativo nao encontrado para remover.',
        target.metadata
      ),
    };
  }

  let metadata: PngMapImportMetadata;
  try {
    metadata = await target.service.markPngMapImportAsRemoved(target.metadata.id);
  } catch (error) {
    return {
      ok: false,
      activeMetadata: target.metadata,
      error: createError(
        'METADATA_REMOVE_FAILED',
        'Nao foi possivel remover o PNG local da lista.',
        error
      ),
    };
  }

  const warnings: PngMapPropertyManageWarning[] = [];
  let deletedFile = false;
  let deleteResult: PngStorageDeleteResult | undefined;
  const uri = firstNonEmptyString(target.metadata.arquivo_uri_local);

  if (!uri) {
    warnings.push(createWarning(
      'REMOVED_IMPORT_URI_MISSING',
      'O anexo foi removido da lista, mas o metadado nao tinha URI de arquivo local.',
      target.metadata
    ));
  } else {
    const deleteStored = deps.deleteStoredPng ?? deleteStoredPng;
    const deleted = await deletePngWithWarning(uri, {
      deleteStored,
      storageDeps: deps.storageDeps,
      missingWarning: createWarning(
        'REMOVED_FILE_ALREADY_MISSING',
        'O anexo foi removido da lista. O arquivo local ja nao existia no aparelho.',
        target.metadata
      ),
      failedWarningCode: 'REMOVED_FILE_DELETE_FAILED',
      failedWarningMessage: 'O anexo foi removido da lista, mas nao foi possivel apagar o arquivo local.',
    });
    deletedFile = deleted.deletedFile;
    deleteResult = deleted.deleteResult;
    warnings.push(...deleted.warnings);
  }

  let imports: PngMapImportMetadata[] | undefined;
  try {
    imports = await target.service.listActivePngMapImportsByPropriedade(target.ids.propriedade_id);
  } catch {
    imports = [];
  }

  return {
    ok: true,
    metadata,
    activeMetadata: target.metadata,
    imports,
    deletedFile,
    deleteResult,
    warnings,
  };
};
