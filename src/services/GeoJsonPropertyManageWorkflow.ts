import { GeoJsonImportMetadata } from '../types/geojsonImport';
import {
  GeoJsonImportService,
  createGeoJsonImportService,
} from './GeoJsonImportService';
import {
  GeoJsonStorageDeleteResult,
  GeoJsonStorageServiceDeps,
  deleteStoredGeoJson,
} from './GeoJsonStorageService';
import {
  GeoJsonPropertyImportConfirmInput,
  GeoJsonPropertyImportConfirmResult,
  GeoJsonPropertyImportPreview,
  GeoJsonPropertyImportWorkflowDeps,
  canStartGeoJsonPropertyImport,
  confirmGeoJsonPropertyImport,
  isSelaPrataIPropriedade,
} from './GeoJsonPropertyImportWorkflow';
import { getFazendaId } from '../utils/acessoControle';

export type GeoJsonPropertyManageErrorCode =
  | 'MANAGE_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'ACTIVE_IMPORT_NOT_FOUND'
  | 'ACTIVE_IMPORT_OUT_OF_SCOPE'
  | 'METADATA_REMOVE_FAILED';

export type GeoJsonPropertyManageWarningCode =
  | 'ACTIVE_IMPORT_URI_MISSING'
  | 'ACTIVE_FILE_ALREADY_MISSING'
  | 'ACTIVE_FILE_DELETE_FAILED'
  | 'PREVIOUS_IMPORT_URI_MISSING'
  | 'PREVIOUS_FILE_ALREADY_MISSING'
  | 'PREVIOUS_FILE_DELETE_FAILED';

export interface GeoJsonPropertyManageError {
  code: GeoJsonPropertyManageErrorCode;
  message: string;
  details?: unknown;
}

export interface GeoJsonPropertyManageWarning {
  code: GeoJsonPropertyManageWarningCode;
  message: string;
  details?: unknown;
}

export interface GeoJsonPropertyManageContext {
  user: any;
  propriedade: any;
  propriedade_id?: string;
  activeMetadata?: GeoJsonImportMetadata | null;
}

export interface GeoJsonPropertyRemoveResult {
  ok: boolean;
  metadata?: GeoJsonImportMetadata;
  activeMetadata?: GeoJsonImportMetadata;
  deletedFile?: boolean;
  deleteResult?: GeoJsonStorageDeleteResult;
  warnings?: GeoJsonPropertyManageWarning[];
  error?: GeoJsonPropertyManageError;
}

export type GeoJsonPropertyReplaceResult = Omit<GeoJsonPropertyImportConfirmResult, 'error'> & {
  previousActiveMetadata?: GeoJsonImportMetadata | null;
  deletedPreviousFile?: boolean;
  previousDeleteResult?: GeoJsonStorageDeleteResult;
  warnings?: GeoJsonPropertyManageWarning[];
  error?: GeoJsonPropertyImportConfirmResult['error'] | GeoJsonPropertyManageError;
};

type GeoJsonImportManageServiceLike = Pick<
  ReturnType<typeof createGeoJsonImportService>,
  | 'createGeoJsonImportMetadata'
  | 'listGeoJsonImportsByPropriedade'
  | 'getActiveGeoJsonImportForPropriedade'
  | 'markGeoJsonImportAsRemoved'
>;

export interface GeoJsonPropertyManageWorkflowDeps
  extends Omit<GeoJsonPropertyImportWorkflowDeps, 'importService'> {
  importService?: GeoJsonImportManageServiceLike;
  storageDeps?: GeoJsonStorageServiceDeps;
  deleteStoredGeoJson?: (
    uri: string,
    deps?: GeoJsonStorageServiceDeps
  ) => Promise<GeoJsonStorageDeleteResult>;
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
  code: GeoJsonPropertyManageErrorCode,
  message: string,
  details?: unknown
): GeoJsonPropertyManageError => ({ code, message, details });

const createWarning = (
  code: GeoJsonPropertyManageWarningCode,
  message: string,
  details?: unknown
): GeoJsonPropertyManageWarning => ({ code, message, details });

const resolveIds = (input: Pick<GeoJsonPropertyManageContext, 'propriedade' | 'propriedade_id'>) => {
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
  return {
    propriedade_id: propriedadeId,
  };
};

const metadataMatchesContext = (
  metadata: GeoJsonImportMetadata,
  ids: { propriedade_id: string }
): boolean => {
  const allowedIds = new Set(
    [ids.propriedade_id]
      .map(firstNonEmptyString)
      .filter(Boolean)
  );

  return allowedIds.has(metadata.propriedade_id);
};

const getImportService = (
  deps: GeoJsonPropertyManageWorkflowDeps
): GeoJsonImportManageServiceLike => deps.importService ?? GeoJsonImportService;

export const canManageGeoJsonForPropriedade = (
  user: any,
  propriedade: any
): boolean => canStartGeoJsonPropertyImport(user, propriedade);

export const shouldShowSelaPrataIRemovalWarning = (
  input: Pick<GeoJsonPropertyManageContext, 'propriedade' | 'propriedade_id'>
): boolean => isSelaPrataIPropriedade(input);

const deleteGeoJsonWithWarnings = async (
  uri: string,
  params: {
    deleteStored: NonNullable<GeoJsonPropertyManageWorkflowDeps['deleteStoredGeoJson']>;
    storageDeps?: GeoJsonStorageServiceDeps;
    missingWarning: GeoJsonPropertyManageWarning;
    failedWarningMessage: string;
    failedWarningCode: GeoJsonPropertyManageWarningCode;
  }
): Promise<{
  deletedFile: boolean;
  deleteResult?: GeoJsonStorageDeleteResult;
  warnings: GeoJsonPropertyManageWarning[];
}> => {
  const warnings: GeoJsonPropertyManageWarning[] = [];

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

export const removeActiveGeoJsonForPropriedade = async (
  input: GeoJsonPropertyManageContext,
  deps: GeoJsonPropertyManageWorkflowDeps = {}
): Promise<GeoJsonPropertyRemoveResult> => {
  if (!canManageGeoJsonForPropriedade(input.user, input.propriedade)) {
    return {
      ok: false,
      error: createError(
        'MANAGE_NOT_ALLOWED',
        'Somente Admin ou Colaborador dentro do escopo da Propriedade pode gerenciar GeoJSON.'
      ),
    };
  }

  const ids = resolveIds(input);
  if (!ids.propriedade_id) {
    return {
      ok: false,
      error: createError(
        'PROPRIEDADE_ID_REQUIRED',
        'Propriedade obrigatoria para remover GeoJSON local.'
      ),
    };
  }

  const importService = getImportService(deps);
  const activeMetadata = input.activeMetadata !== undefined
    ? input.activeMetadata
    : await importService.getActiveGeoJsonImportForPropriedade(ids.propriedade_id);

  if (!activeMetadata || activeMetadata.status !== 'ativo') {
    return {
      ok: false,
      error: createError(
        'ACTIVE_IMPORT_NOT_FOUND',
        'Nao ha GeoJSON local ativo para remover nesta Propriedade.'
      ),
    };
  }

  if (!metadataMatchesContext(activeMetadata, ids)) {
    return {
      ok: false,
      activeMetadata,
      error: createError(
        'ACTIVE_IMPORT_OUT_OF_SCOPE',
        'GeoJSON ativo informado nao pertence a esta Propriedade.',
        activeMetadata
      ),
    };
  }

  let metadata: GeoJsonImportMetadata;
  try {
    metadata = await importService.markGeoJsonImportAsRemoved(activeMetadata.id);
  } catch (error) {
    return {
      ok: false,
      activeMetadata,
      error: createError(
        'METADATA_REMOVE_FAILED',
        'Nao foi possivel remover o vinculo do GeoJSON local.',
        error
      ),
    };
  }

  const uri = firstNonEmptyString(activeMetadata.arquivo_uri_local);
  if (!uri) {
    return {
      ok: true,
      metadata,
      activeMetadata,
      deletedFile: false,
      warnings: [
        createWarning(
          'ACTIVE_IMPORT_URI_MISSING',
          'O vinculo foi removido, mas o metadado ativo nao tinha URI de arquivo local.',
          activeMetadata
        ),
      ],
    };
  }

  const deleteStored = deps.deleteStoredGeoJson ?? deleteStoredGeoJson;
  const deleted = await deleteGeoJsonWithWarnings(uri, {
    deleteStored,
    storageDeps: deps.storageDeps,
    missingWarning: createWarning(
      'ACTIVE_FILE_ALREADY_MISSING',
      'O vinculo foi removido. O arquivo local ja nao existia no aparelho.',
      activeMetadata
    ),
    failedWarningCode: 'ACTIVE_FILE_DELETE_FAILED',
    failedWarningMessage: 'O vinculo foi removido, mas nao foi possivel apagar o arquivo local.',
  });

  return {
    ok: true,
    metadata,
    activeMetadata,
    deletedFile: deleted.deletedFile,
    deleteResult: deleted.deleteResult,
    warnings: deleted.warnings,
  };
};

export const replaceGeoJsonForPropriedade = async (
  preview: GeoJsonPropertyImportPreview,
  input: GeoJsonPropertyImportConfirmInput = {},
  deps: GeoJsonPropertyManageWorkflowDeps = {}
): Promise<GeoJsonPropertyReplaceResult> => {
  const context = preview.resolvedContext;
  if (!canManageGeoJsonForPropriedade(context.user, context.propriedade)) {
    return {
      ok: false,
      previousActiveMetadata: null,
      warnings: [],
      error: createError(
        'MANAGE_NOT_ALLOWED',
        'Somente Admin ou Colaborador dentro do escopo da Propriedade pode substituir GeoJSON.'
      ),
    };
  }

  const importService = getImportService(deps);
  const previousActiveMetadata = await importService.getActiveGeoJsonImportForPropriedade(
    context.propriedade_id
  );
  const ids = {
    propriedade_id: context.propriedade_id,
  };

  if (previousActiveMetadata && !metadataMatchesContext(previousActiveMetadata, ids)) {
    return {
      ok: false,
      previousActiveMetadata,
      warnings: [],
      error: createError(
        'ACTIVE_IMPORT_OUT_OF_SCOPE',
        'GeoJSON ativo anterior nao pertence a esta Propriedade.',
        previousActiveMetadata
      ),
    };
  }

  const confirmed = await confirmGeoJsonPropertyImport(preview, input, deps);
  if (!confirmed.ok) {
    return {
      ...confirmed,
      previousActiveMetadata: previousActiveMetadata ?? null,
      warnings: [],
    };
  }

  const warnings: GeoJsonPropertyManageWarning[] = [];
  const newUri = firstNonEmptyString(confirmed.metadata?.arquivo_uri_local);
  const previousUri = firstNonEmptyString(previousActiveMetadata?.arquivo_uri_local);

  if (
    previousActiveMetadata
    && previousActiveMetadata.id !== confirmed.metadata?.id
    && previousUri
    && previousUri !== newUri
  ) {
    const deleteStored = deps.deleteStoredGeoJson ?? deleteStoredGeoJson;
    const deleted = await deleteGeoJsonWithWarnings(previousUri, {
      deleteStored,
      storageDeps: deps.storageDeps,
      missingWarning: createWarning(
        'PREVIOUS_FILE_ALREADY_MISSING',
        'O novo GeoJSON foi ativado. O arquivo local anterior ja nao existia no aparelho.',
        previousActiveMetadata
      ),
      failedWarningCode: 'PREVIOUS_FILE_DELETE_FAILED',
      failedWarningMessage: 'O novo GeoJSON foi ativado, mas nao foi possivel apagar o arquivo local anterior.',
    });

    return {
      ...confirmed,
      previousActiveMetadata,
      deletedPreviousFile: deleted.deletedFile,
      previousDeleteResult: deleted.deleteResult,
      warnings: deleted.warnings,
    };
  }

  if (previousActiveMetadata && previousActiveMetadata.id !== confirmed.metadata?.id && !previousUri) {
    warnings.push(createWarning(
      'PREVIOUS_IMPORT_URI_MISSING',
      'O novo GeoJSON foi ativado, mas o metadado anterior nao tinha URI de arquivo local.',
      previousActiveMetadata
    ));
  }

  return {
    ...confirmed,
    previousActiveMetadata: previousActiveMetadata ?? null,
    deletedPreviousFile: false,
    warnings,
  };
};
