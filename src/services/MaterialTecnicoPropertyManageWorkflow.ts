import type { MaterialTecnicoImportMetadata } from '../types/materialTecnicoLocal';
import {
  MaterialTecnicoImportService,
  createMaterialTecnicoImportService,
} from './MaterialTecnicoImportService';
import {
  MaterialTecnicoStorageDeleteResult,
  MaterialTecnicoStorageServiceDeps,
  deleteStoredMaterialTecnico,
} from './MaterialTecnicoStorageService';
import { canStartMaterialTecnicoPropertyImport } from './MaterialTecnicoPropertyImportWorkflow';
import { getFazendaId } from '../utils/acessoControle';
import { isMaterialTecnicoLocalMapa } from '../utils/materialTecnicoToMapaCompat';

export type MaterialTecnicoPropertyManageErrorCode =
  | 'MANAGE_NOT_ALLOWED'
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'MATERIAL_NOT_LOCAL'
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_OUT_OF_SCOPE'
  | 'METADATA_REMOVE_FAILED';

export interface MaterialTecnicoPropertyManageError {
  code: MaterialTecnicoPropertyManageErrorCode;
  message: string;
  details?: unknown;
}

export interface MaterialTecnicoPropertyManageWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface MaterialTecnicoPropertyManageContext {
  user: any;
  propriedade: any;
  mapa?: Record<string, any> | null;
  metadata?: MaterialTecnicoImportMetadata | null;
}

export interface MaterialTecnicoPropertyRemoveResult {
  ok: boolean;
  metadata?: MaterialTecnicoImportMetadata;
  activeMetadata?: MaterialTecnicoImportMetadata;
  imports?: MaterialTecnicoImportMetadata[];
  deletedFile?: boolean;
  deleteResult?: MaterialTecnicoStorageDeleteResult;
  warnings?: MaterialTecnicoPropertyManageWarning[];
  error?: MaterialTecnicoPropertyManageError;
}

type MaterialTecnicoManageServiceLike = Pick<
  ReturnType<typeof createMaterialTecnicoImportService>,
  'getMaterialTecnicoImportById'
    | 'markMaterialTecnicoImportAsRemoved'
    | 'listActiveMaterialTecnicoImportsByPropriedade'
>;

export interface MaterialTecnicoPropertyManageWorkflowDeps {
  importService?: MaterialTecnicoManageServiceLike;
  storageDeps?: MaterialTecnicoStorageServiceDeps;
  deleteStoredMaterialTecnico?: (
    uri: string,
    deps?: MaterialTecnicoStorageServiceDeps
  ) => Promise<MaterialTecnicoStorageDeleteResult>;
}

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const createError = (
  code: MaterialTecnicoPropertyManageErrorCode,
  message: string,
  details?: unknown
): MaterialTecnicoPropertyManageError => ({ code, message, details });

const resolvePropriedadeIds = (propriedade: any): string[] => [
  propriedade?.propriedade_id,
  propriedade?.propriedadeId,
  propriedade?.fazenda_id,
  propriedade?.fazendaId,
  getFazendaId(propriedade),
  propriedade?.id,
].map((id) => firstNonEmptyString(id)).filter(Boolean);

const getMetadataId = (input: MaterialTecnicoPropertyManageContext): string =>
  firstNonEmptyString(
    input.metadata?.id,
    input.mapa?.material_tecnico_import_id,
    typeof input.mapa?.id === 'string' && input.mapa.id.startsWith('material_local:')
      ? input.mapa.id.slice('material_local:'.length)
      : ''
  );

export const canManageMaterialTecnicoItem = (
  user: any,
  propriedade: any,
  mapa?: Record<string, any> | null
): boolean =>
  canStartMaterialTecnicoPropertyImport(user, propriedade)
  && isMaterialTecnicoLocalMapa(mapa);

export const removeMaterialTecnicoForPropriedade = async (
  input: MaterialTecnicoPropertyManageContext,
  deps: MaterialTecnicoPropertyManageWorkflowDeps = {}
): Promise<MaterialTecnicoPropertyRemoveResult> => {
  const propriedadeIds = resolvePropriedadeIds(input.propriedade);
  if (propriedadeIds.length === 0) {
    return { ok: false, error: createError('PROPRIEDADE_ID_REQUIRED', 'Propriedade obrigatória para remover o material.') };
  }
  if (!canStartMaterialTecnicoPropertyImport(input.user, input.propriedade)) {
    return { ok: false, error: createError('MANAGE_NOT_ALLOWED', 'Você não tem permissão para remover material desta Propriedade.') };
  }
  if (input.mapa && !isMaterialTecnicoLocalMapa(input.mapa)) {
    return { ok: false, error: createError('MATERIAL_NOT_LOCAL', 'Este item não pertence ao catálogo local unificado.') };
  }

  const service = deps.importService ?? MaterialTecnicoImportService;
  const metadataId = getMetadataId(input);
  const metadata = input.metadata ?? (metadataId
    ? await service.getMaterialTecnicoImportById(metadataId)
    : null);
  if (!metadata || metadata.status !== 'ativo') {
    return { ok: false, error: createError('MATERIAL_NOT_FOUND', 'Material local ativo não encontrado.') };
  }
  if (
    !propriedadeIds.includes(metadata.propriedade_id)
  ) {
    return { ok: false, error: createError('MATERIAL_OUT_OF_SCOPE', 'O material não pertence a esta Propriedade.') };
  }

  let removedMetadata: MaterialTecnicoImportMetadata;
  try {
    removedMetadata = await service.markMaterialTecnicoImportAsRemoved(metadata.id);
  } catch (error) {
    return {
      ok: false,
      activeMetadata: metadata,
      error: createError('METADATA_REMOVE_FAILED', 'Não foi possível remover o material da lista.', error),
    };
  }

  const warnings: MaterialTecnicoPropertyManageWarning[] = [];
  let deletedFile = false;
  let deleteResult: MaterialTecnicoStorageDeleteResult | undefined;
  const uri = firstNonEmptyString(metadata.arquivo_uri_local);
  if (!uri) {
    warnings.push({ code: 'MATERIAL_URI_MISSING', message: 'O material saiu da lista, mas não tinha arquivo local associado.' });
  } else {
    try {
      const remove = deps.deleteStoredMaterialTecnico ?? deleteStoredMaterialTecnico;
      deleteResult = await remove(uri, deps.storageDeps);
      deletedFile = deleteResult.ok && deleteResult.deleted;
      if (!deleteResult.ok) {
        warnings.push({
          code: 'MATERIAL_FILE_DELETE_FAILED',
          message: deleteResult.error?.message || 'O material saiu da lista, mas o arquivo local não pôde ser apagado.',
          details: deleteResult.error,
        });
      } else if (!deleteResult.deleted) {
        warnings.push({ code: 'MATERIAL_FILE_ALREADY_MISSING', message: 'O material saiu da lista; o arquivo já não existia no aparelho.' });
      }
    } catch (error) {
      warnings.push({
        code: 'MATERIAL_FILE_DELETE_FAILED',
        message: 'O material saiu da lista, mas o arquivo local não pôde ser apagado.',
        details: error,
      });
    }
  }

  let imports: MaterialTecnicoImportMetadata[] = [];
  try {
    imports = await service.listActiveMaterialTecnicoImportsByPropriedade(metadata.propriedade_id);
  } catch {
    // A remoção principal já foi persistida.
  }

  return {
    ok: true,
    metadata: removedMetadata,
    activeMetadata: metadata,
    imports,
    deletedFile,
    deleteResult,
    warnings,
  };
};
