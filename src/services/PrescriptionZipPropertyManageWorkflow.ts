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
  PrescriptionZipImportMetadata,
  PrescriptionZipImportMetadataInput,
} from '../types/anexoPrescricaoZipLocal';
import {
  PrescriptionZipImportService,
  createPrescriptionZipImportService,
} from './PrescriptionZipImportService';
import { canStartPrescriptionZipPropertyImport } from './PrescriptionZipPropertyImportWorkflow';
import { getFazendaId } from '../utils/acessoControle';
import { isPrescriptionZipLocalMapa } from '../utils/prescriptionZipToMapaCompat';

export type PrescriptionZipPropertyManageErrorCode =
  | 'MANAGE_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'ZIP_IMPORT_NOT_FOUND'
  | 'ZIP_IMPORT_OUT_OF_SCOPE'
  | 'ZIP_IMPORT_NOT_LOCAL'
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

export interface PrescriptionZipPropertyManageError {
  code: PrescriptionZipPropertyManageErrorCode;
  message: string;
  details?: unknown;
}

export interface PrescriptionZipPropertyManageWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface PrescriptionZipPropertyManageContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  fazenda_id?: string;
  metadata?: PrescriptionZipImportMetadata | null;
  metadataId?: string;
  mapa?: Record<string, any> | null;
}

export interface PrescriptionZipPropertyReplaceResult {
  ok: boolean;
  metadata?: PrescriptionZipImportMetadata;
  previousMetadata?: PrescriptionZipImportMetadata;
  pickedFile?: PickedPrescriptionZipFile;
  storedFile?: StoredPrescriptionZipFile;
  imports?: PrescriptionZipImportMetadata[];
  deletedPreviousFile?: boolean;
  previousDeleteResult?: PrescriptionZipStorageDeleteResult;
  rollback?: {
    attempted: boolean;
    ok: boolean;
    deletedNewFile?: boolean;
    removedNewMetadata?: boolean;
    error?: unknown;
  };
  warnings?: PrescriptionZipPropertyManageWarning[];
  error?: PrescriptionZipPropertyManageError;
}

export interface PrescriptionZipPropertyRemoveResult {
  ok: boolean;
  metadata?: PrescriptionZipImportMetadata;
  activeMetadata?: PrescriptionZipImportMetadata;
  imports?: PrescriptionZipImportMetadata[];
  deletedFile?: boolean;
  deleteResult?: PrescriptionZipStorageDeleteResult;
  warnings?: PrescriptionZipPropertyManageWarning[];
  error?: PrescriptionZipPropertyManageError;
}

type PrescriptionZipManageServiceLike = Pick<
  ReturnType<typeof createPrescriptionZipImportService>,
  | 'createPrescriptionZipImportMetadata'
  | 'getPrescriptionZipImportById'
  | 'listActivePrescriptionZipImportsByPropriedade'
  | 'markPrescriptionZipImportAsSubstituido'
  | 'markPrescriptionZipImportAsRemoved'
>;

export interface PrescriptionZipPropertyManageWorkflowDeps {
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
  importService?: PrescriptionZipManageServiceLike;
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
  code: PrescriptionZipPropertyManageErrorCode,
  message: string,
  details?: unknown
): PrescriptionZipPropertyManageError => ({ code, message, details });

const createWarning = (
  code: string,
  message: string,
  details?: unknown
): PrescriptionZipPropertyManageWarning => ({ code, message, details });

const createDefaultImportId = (): string =>
  `zipmap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resolveIds = (
  input: Pick<PrescriptionZipPropertyManageContext, 'propriedade' | 'propriedade_id' | 'fazenda_id'>
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
  return { propriedade_id: propriedadeId, fazenda_id: fazendaId };
};

const metadataMatchesContext = (
  metadata: PrescriptionZipImportMetadata,
  ids: { propriedade_id: string; fazenda_id: string }
): boolean => {
  const allowedIds = new Set([ids.propriedade_id, ids.fazenda_id].map(firstNonEmptyString).filter(Boolean));
  return allowedIds.has(metadata.propriedade_id) || allowedIds.has(metadata.fazenda_id);
};

const getMetadataId = (input: PrescriptionZipPropertyManageContext): string =>
  firstNonEmptyString(
    input.metadata?.id,
    input.metadataId,
    input.mapa?.prescription_zip_import_id,
    input.mapa?.id?.startsWith?.('zip_local:') ? input.mapa.id.slice('zip_local:'.length) : ''
  );

const resolveMetadata = async (
  input: PrescriptionZipPropertyManageContext,
  service: PrescriptionZipManageServiceLike
): Promise<PrescriptionZipImportMetadata | null> => {
  if (input.metadata) return input.metadata;
  const id = getMetadataId(input);
  if (!id) return null;
  return service.getPrescriptionZipImportById(id);
};

const isLocalMetadata = (
  metadata: PrescriptionZipImportMetadata | null | undefined
): metadata is PrescriptionZipImportMetadata =>
  !!metadata && firstNonEmptyString(metadata.id).length > 0 && metadata.origem === 'arquivo_local';

export const canManagePrescriptionZipForPropriedade = (
  user: any,
  propriedade: any
): boolean => canStartPrescriptionZipPropertyImport(user, propriedade);

export const canManagePrescriptionZipItem = (
  user: any,
  propriedade: any,
  mapa?: Record<string, any> | null
): boolean => canManagePrescriptionZipForPropriedade(user, propriedade) && isPrescriptionZipLocalMapa(mapa);

const resolveManageTarget = async (
  input: PrescriptionZipPropertyManageContext,
  deps: PrescriptionZipPropertyManageWorkflowDeps,
  actionLabel: 'substituir' | 'remover'
) => {
  const ids = resolveIds(input);
  if (!ids.propriedade_id || !ids.fazenda_id) {
    return {
      ok: false,
      error: createError('PROPRIEDADE_ID_REQUIRED', `Propriedade obrigatória para ${actionLabel} prescrição local.`),
    };
  }
  if (!canManagePrescriptionZipForPropriedade(input.user, input.propriedade)) {
    return {
      ok: false,
      error: createError(
        'MANAGE_NOT_ALLOWED',
        'Somente Admin ou Colaborador dentro do escopo da Propriedade pode gerenciar prescrição local.'
      ),
    };
  }
  if (input.mapa && !isPrescriptionZipLocalMapa(input.mapa)) {
    return {
      ok: false,
      error: createError('ZIP_IMPORT_NOT_LOCAL', 'Este material não é uma prescrição local gerenciável.'),
    };
  }

  const service = deps.importService ?? PrescriptionZipImportService;
  const metadata = await resolveMetadata(input, service);
  if (!metadata) {
    return {
      ok: false,
      service,
      error: createError('ZIP_IMPORT_NOT_FOUND', 'Metadado da prescrição local não encontrado.'),
    };
  }
  if (!isLocalMetadata(metadata)) {
    return {
      ok: false,
      ids,
      metadata,
      service,
      error: createError('ZIP_IMPORT_NOT_LOCAL', 'Este material não é uma prescrição local gerenciável.', metadata),
    };
  }
  if (!metadataMatchesContext(metadata, ids)) {
    return {
      ok: false,
      ids,
      metadata,
      service,
      error: createError('ZIP_IMPORT_OUT_OF_SCOPE', 'Prescrição informada não pertence a esta Propriedade.', metadata),
    };
  }

  return { ok: true, ids, metadata, service };
};

const pickReplacementZip = async (deps: PrescriptionZipPropertyManageWorkflowDeps) => {
  const picker = deps.pickPrescriptionZipDocument ?? pickPrescriptionZipDocument;
  const picked = await picker(deps.pickerDeps);
  if (!picked.ok || !picked.file) {
    const pickerError = picked.errors[0];
    const code = (pickerError?.code ?? 'PICKER_RESULT_INVALID') as PrescriptionZipPropertyManageErrorCode;
    return {
      ok: false,
      error: createError(code, pickerError?.message ?? 'Arquivo selecionado sem dados suficientes.', picked),
    };
  }
  return { ok: true, file: picked.file };
};

const buildReplacementMetadataInput = (
  previous: PrescriptionZipImportMetadata,
  params: {
    newId: string;
    file: PickedPrescriptionZipFile;
    storedFile: StoredPrescriptionZipFile;
    user: any;
  }
): PrescriptionZipImportMetadataInput => ({
  id: params.newId,
  propriedade_id: previous.propriedade_id,
  fazenda_id: previous.fazenda_id,
  nome_propriedade: previous.nome_propriedade,
  titulo: previous.titulo,
  descricao: previous.descricao,
  camada: previous.camada,
  camada_label: previous.camada_label,
  elemento: previous.elemento,
  elemento_label: previous.elemento_label,
  safra: previous.safra,
  ano: previous.ano,
  escopo: previous.escopo,
  talhao_id: previous.talhao_id,
  talhao_nome: previous.talhao_nome,
  arquivo_nome_original: params.file.name,
  arquivo_uri_local: params.storedFile.uri,
  arquivo_tamanho_bytes: params.storedFile.size ?? params.file.size,
  arquivo_mime: params.storedFile.mimeType ?? params.file.mimeType ?? 'application/zip',
  importado_por_usuario_id: firstNonEmptyString(params.user?.id, params.user?.usuario_id, previous.importado_por_usuario_id) || undefined,
  importado_por_nome: firstNonEmptyString(params.user?.nome, params.user?.nome_completo, params.user?.email, previous.importado_por_nome) || undefined,
  status: 'ativo',
  visivel_para_produtor: previous.visivel_para_produtor,
  origem: 'arquivo_local',
});

const rollbackNewZip = async (params: {
  service: PrescriptionZipManageServiceLike;
  metadata?: PrescriptionZipImportMetadata;
  storedFile?: StoredPrescriptionZipFile;
  deleteStored: NonNullable<PrescriptionZipPropertyManageWorkflowDeps['deleteStoredPrescriptionZip']>;
  storageDeps?: PrescriptionZipStorageServiceDeps;
}): Promise<PrescriptionZipPropertyReplaceResult['rollback']> => {
  let removedNewMetadata = false;
  let deletedNewFile = false;
  let error: unknown;

  if (params.metadata) {
    try {
      await params.service.markPrescriptionZipImportAsRemoved(params.metadata.id);
      removedNewMetadata = true;
    } catch (metadataError) {
      error = metadataError;
    }
  }
  if (params.storedFile?.uri) {
    try {
      const deleted = await params.deleteStored(params.storedFile.uri, params.storageDeps);
      deletedNewFile = deleted.ok && deleted.deleted;
      if (!deleted.ok && !error) error = deleted.error;
    } catch (deleteError) {
      if (!error) error = deleteError;
    }
  }

  return {
    attempted: !!params.metadata || !!params.storedFile,
    ok: (!params.metadata || removedNewMetadata) && (!params.storedFile || deletedNewFile),
    removedNewMetadata,
    deletedNewFile,
    error,
  };
};

export const replacePrescriptionZipForPropriedade = async (
  input: PrescriptionZipPropertyManageContext,
  deps: PrescriptionZipPropertyManageWorkflowDeps = {}
): Promise<PrescriptionZipPropertyReplaceResult> => {
  const target = await resolveManageTarget(input, deps, 'substituir');
  if (!target.ok || !target.ids || !target.metadata || !target.service) {
    return { ok: false, error: target.error };
  }
  if (target.metadata.status !== 'ativo') {
    return {
      ok: false,
      previousMetadata: target.metadata,
      error: createError('ZIP_IMPORT_NOT_FOUND', 'Prescrição local ativa não encontrada para substituição.', target.metadata),
    };
  }

  const picked = await pickReplacementZip(deps);
  if (!picked.ok || !picked.file) {
    return { ok: false, previousMetadata: target.metadata, error: picked.error };
  }

  const newId = (deps.generateImportId ?? createDefaultImportId)();
  const copy = deps.copyPrescriptionZipToInternalStorage ?? copyPrescriptionZipToInternalStorage;
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
      error: createError('STORAGE_FAILED', copied.error?.message ?? 'Não foi possível copiar o novo ZIP.', copied),
    };
  }

  const deleteStored = deps.deleteStoredPrescriptionZip ?? deleteStoredPrescriptionZip;
  let newMetadata: PrescriptionZipImportMetadata | undefined;
  try {
    newMetadata = await target.service.createPrescriptionZipImportMetadata(
      buildReplacementMetadataInput(target.metadata, {
        newId,
        file: picked.file,
        storedFile: copied.file,
        user: input.user,
      })
    );
  } catch (error) {
    const rollback = await rollbackNewZip({ service: target.service, storedFile: copied.file, deleteStored, storageDeps: deps.storageDeps });
    return {
      ok: false,
      previousMetadata: target.metadata,
      pickedFile: picked.file,
      storedFile: copied.file,
      rollback,
      error: createError(rollback.ok ? 'METADATA_CREATE_FAILED' : 'ROLLBACK_FAILED', 'Não foi possível criar o novo metadado da prescrição.', error),
    };
  }

  let previousUpdated: PrescriptionZipImportMetadata;
  try {
    previousUpdated = await target.service.markPrescriptionZipImportAsSubstituido(target.metadata.id);
  } catch (error) {
    const rollback = await rollbackNewZip({ service: target.service, metadata: newMetadata, storedFile: copied.file, deleteStored, storageDeps: deps.storageDeps });
    return {
      ok: false,
      metadata: newMetadata,
      previousMetadata: target.metadata,
      pickedFile: picked.file,
      storedFile: copied.file,
      rollback,
      error: createError(rollback.ok ? 'METADATA_REPLACE_FAILED' : 'ROLLBACK_FAILED', 'Não foi possível marcar a prescrição anterior como substituída.', error),
    };
  }

  const warnings: PrescriptionZipPropertyManageWarning[] = [];
  let deletedPreviousFile = false;
  let previousDeleteResult: PrescriptionZipStorageDeleteResult | undefined;
  const previousUri = firstNonEmptyString(target.metadata.arquivo_uri_local);
  if (previousUri && previousUri !== newMetadata.arquivo_uri_local) {
    try {
      const deleted = await deleteStored(previousUri, deps.storageDeps);
      deletedPreviousFile = deleted.ok && deleted.deleted;
      previousDeleteResult = deleted;
      if (deleted.ok && !deleted.deleted) {
        warnings.push(createWarning('PREVIOUS_FILE_ALREADY_MISSING', 'O ZIP anterior já não existia no aparelho.', target.metadata));
      } else if (!deleted.ok) {
        warnings.push(createWarning('PREVIOUS_FILE_DELETE_FAILED', deleted.error?.message || 'Não foi possível apagar o ZIP anterior.', deleted.error));
      }
    } catch (error) {
      warnings.push(createWarning('PREVIOUS_FILE_DELETE_FAILED', 'Não foi possível apagar o ZIP anterior.', error));
    }
  }

  let imports: PrescriptionZipImportMetadata[] | undefined;
  try {
    imports = await target.service.listActivePrescriptionZipImportsByPropriedade(target.ids.propriedade_id);
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

export const removePrescriptionZipForPropriedade = async (
  input: PrescriptionZipPropertyManageContext,
  deps: PrescriptionZipPropertyManageWorkflowDeps = {}
): Promise<PrescriptionZipPropertyRemoveResult> => {
  const target = await resolveManageTarget(input, deps, 'remover');
  if (!target.ok || !target.ids || !target.metadata || !target.service) {
    return { ok: false, error: target.error };
  }
  if (target.metadata.status !== 'ativo') {
    return {
      ok: false,
      activeMetadata: target.metadata,
      error: createError('ZIP_IMPORT_NOT_FOUND', 'Prescrição local ativa não encontrada para remover.', target.metadata),
    };
  }

  let metadata: PrescriptionZipImportMetadata;
  try {
    metadata = await target.service.markPrescriptionZipImportAsRemoved(target.metadata.id);
  } catch (error) {
    return {
      ok: false,
      activeMetadata: target.metadata,
      error: createError('METADATA_REMOVE_FAILED', 'Não foi possível remover a prescrição local da lista.', error),
    };
  }

  const warnings: PrescriptionZipPropertyManageWarning[] = [];
  let deletedFile = false;
  let deleteResult: PrescriptionZipStorageDeleteResult | undefined;
  const uri = firstNonEmptyString(target.metadata.arquivo_uri_local);

  if (!uri) {
    warnings.push(createWarning('REMOVED_IMPORT_URI_MISSING', 'A prescrição foi removida da lista, mas não tinha URI local.', target.metadata));
  } else {
    const deleteStored = deps.deleteStoredPrescriptionZip ?? deleteStoredPrescriptionZip;
    try {
      deleteResult = await deleteStored(uri, deps.storageDeps);
      deletedFile = deleteResult.ok && deleteResult.deleted;
      if (deleteResult.ok && !deleteResult.deleted) {
        warnings.push(createWarning('REMOVED_FILE_ALREADY_MISSING', 'A prescrição foi removida da lista. O ZIP já não existia no aparelho.', target.metadata));
      } else if (!deleteResult.ok) {
        warnings.push(createWarning('REMOVED_FILE_DELETE_FAILED', deleteResult.error?.message || 'Não foi possível apagar o ZIP local.', deleteResult.error));
      }
    } catch (error) {
      warnings.push(createWarning('REMOVED_FILE_DELETE_FAILED', 'Não foi possível apagar o ZIP local.', error));
    }
  }

  let imports: PrescriptionZipImportMetadata[] | undefined;
  try {
    imports = await target.service.listActivePrescriptionZipImportsByPropriedade(target.ids.propriedade_id);
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
