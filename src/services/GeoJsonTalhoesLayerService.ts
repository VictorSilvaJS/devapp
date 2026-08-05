import { MapaTalhao } from '../types/mapa';
import { GeoJsonImportMetadata } from '../types/geojsonImport';
import {
  GeoJsonValidationResult,
  GeoJsonNormalizeOptions,
} from '../utils/geojsonImportValidator';
import {
  GeoJsonImportService,
  createGeoJsonImportService,
} from './GeoJsonImportService';
import {
  GeoJsonStorageServiceDeps,
  GeoJsonStoredValidationResult,
  validateStoredGeoJson,
} from './GeoJsonStorageService';

export type GeoJsonTalhoesLayerSource =
  | 'sem_geojson_ativo'
  | 'geojson_local_ativo'
  | 'erro_geojson_local';

export type EffectiveTalhoesLayerSource =
  | 'geojson_local'
  | 'seed'
  | 'seed_fallback';

export type GeoJsonTalhoesLayerErrorCode =
  | 'PROPRIEDADE_ID_REQUIRED'
  | 'ACTIVE_IMPORT_URI_MISSING'
  | 'STORED_GEOJSON_FAILED'
  | 'INVALID_GEOJSON'
  | 'VALIDATION_FAILED';

export interface GeoJsonTalhoesLayerError {
  code: GeoJsonTalhoesLayerErrorCode;
  message: string;
  details?: unknown;
}

export interface LoadGeoJsonTalhoesLayerInput {
  propriedade_id: string;
  ano?: number;
  safra?: string;
  activeMetadata?: GeoJsonImportMetadata | null;
}

export interface GeoJsonTalhoesLayerResult {
  ok: boolean;
  source: GeoJsonTalhoesLayerSource;
  talhoes: MapaTalhao[];
  metadata?: GeoJsonImportMetadata;
  validation?: GeoJsonValidationResult;
  error?: GeoJsonTalhoesLayerError;
}

export interface EffectiveTalhoesLayerResult {
  source: EffectiveTalhoesLayerSource;
  talhoes: MapaTalhao[];
  metadata?: GeoJsonImportMetadata;
  error?: GeoJsonTalhoesLayerError;
}

type GeoJsonImportServiceLike = Pick<
  ReturnType<typeof createGeoJsonImportService>,
  'getActiveGeoJsonImportForPropriedade'
>;

export interface GeoJsonTalhoesLayerServiceDeps {
  importService?: GeoJsonImportServiceLike;
  storageDeps?: GeoJsonStorageServiceDeps;
  validateStoredGeoJson?: (
    uri: string,
    options: GeoJsonNormalizeOptions,
    deps?: GeoJsonStorageServiceDeps
  ) => Promise<GeoJsonStoredValidationResult>;
  now?: () => string;
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
  code: GeoJsonTalhoesLayerErrorCode,
  message: string,
  details?: unknown
): GeoJsonTalhoesLayerError => ({ code, message, details });

const buildErrorResult = (
  metadata: GeoJsonImportMetadata | undefined,
  error: GeoJsonTalhoesLayerError,
  validation?: GeoJsonValidationResult
): GeoJsonTalhoesLayerResult => ({
  ok: false,
  source: 'erro_geojson_local',
  talhoes: [],
  metadata,
  validation,
  error,
});

const getCurrentYear = (deps: GeoJsonTalhoesLayerServiceDeps): number => {
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const year = new Date(now).getFullYear();
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

const buildValidationOptions = (
  input: LoadGeoJsonTalhoesLayerInput,
  metadata: GeoJsonImportMetadata,
  deps: GeoJsonTalhoesLayerServiceDeps
): GeoJsonNormalizeOptions => {
  const propriedadeId = firstNonEmptyString(
    metadata.propriedade_id,
    input.propriedade_id,
    input.propriedade_id
  );
  return {
    propriedade_id: propriedadeId,
    ano: metadata.ano ?? input.ano ?? getCurrentYear(deps),
    safra: firstNonEmptyString(metadata.safra, input.safra) || undefined,
    data_upload: firstNonEmptyString(metadata.importado_em) || (deps.now ?? (() => new Date().toISOString()))(),
  };
};

const buildValidationError = (
  validation?: GeoJsonValidationResult
): GeoJsonTalhoesLayerError => {
  const hasInvalidJson = validation?.errors?.some((issue) => issue.code === 'INVALID_JSON');

  return createError(
    hasInvalidJson ? 'INVALID_GEOJSON' : 'VALIDATION_FAILED',
    hasInvalidJson
      ? 'GeoJSON local anexado esta invalido.'
      : 'GeoJSON local anexado nao passou na validacao.',
    validation
  );
};

export const loadGeoJsonTalhoesLayer = async (
  input: LoadGeoJsonTalhoesLayerInput,
  deps: GeoJsonTalhoesLayerServiceDeps = {}
): Promise<GeoJsonTalhoesLayerResult> => {
  const propriedadeId = firstNonEmptyString(input.propriedade_id);
  if (!propriedadeId) {
    return buildErrorResult(
      undefined,
      createError('PROPRIEDADE_ID_REQUIRED', 'Propriedade obrigatoria para carregar GeoJSON local.')
    );
  }

  const importService = deps.importService ?? GeoJsonImportService;
  const metadata = input.activeMetadata !== undefined
    ? input.activeMetadata
    : await importService.getActiveGeoJsonImportForPropriedade(propriedadeId);

  if (!metadata || metadata.status !== 'ativo') {
    return {
      ok: true,
      source: 'sem_geojson_ativo',
      talhoes: [],
    };
  }

  const uri = firstNonEmptyString(metadata.arquivo_uri_local);
  if (!uri) {
    return buildErrorResult(
      metadata,
      createError(
        'ACTIVE_IMPORT_URI_MISSING',
        'GeoJSON local ativo nao possui URI de arquivo interno.',
        metadata
      )
    );
  }

  const validateStored = deps.validateStoredGeoJson ?? validateStoredGeoJson;
  let validated: GeoJsonStoredValidationResult;
  try {
    validated = await validateStored(
      uri,
      buildValidationOptions(input, metadata, deps),
      deps.storageDeps
    );
  } catch (error) {
    return buildErrorResult(
      metadata,
      createError(
        'STORED_GEOJSON_FAILED',
        'Nao foi possivel carregar o GeoJSON local anexado.',
        error
      )
    );
  }

  if (!validated.ok || !validated.validation?.ok) {
    const error = validated.error
      ? createError(
          'STORED_GEOJSON_FAILED',
          validated.error.message || 'Nao foi possivel carregar o GeoJSON local anexado.',
          validated.error
        )
      : buildValidationError(validated.validation);

    return buildErrorResult(metadata, error, validated.validation);
  }

  return {
    ok: true,
    source: 'geojson_local_ativo',
    talhoes: validated.validation.talhoes,
    metadata,
    validation: validated.validation,
  };
};

export const resolveEffectiveTalhoesLayer = (
  seedTalhoes: MapaTalhao[] = [],
  layer?: GeoJsonTalhoesLayerResult | null
): EffectiveTalhoesLayerResult => {
  if (layer?.ok && layer.source === 'geojson_local_ativo' && layer.talhoes.length > 0) {
    return {
      source: 'geojson_local',
      talhoes: layer.talhoes,
      metadata: layer.metadata,
    };
  }

  if (layer && !layer.ok && layer.source === 'erro_geojson_local') {
    return {
      source: 'seed_fallback',
      talhoes: seedTalhoes,
      metadata: layer.metadata,
      error: layer.error,
    };
  }

  return {
    source: 'seed',
    talhoes: seedTalhoes,
  };
};

export const isGeoJsonTalhoesLayerActive = (
  layer?: GeoJsonTalhoesLayerResult | null
): boolean => layer?.ok === true && layer.source === 'geojson_local_ativo' && layer.talhoes.length > 0;

export const isGeoJsonTalhoesLayerFallback = (
  layer?: GeoJsonTalhoesLayerResult | null
): boolean => layer?.ok === false && layer.source === 'erro_geojson_local';
