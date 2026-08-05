import type { MapaTalhao, PontoPoligono } from '../types/mapa';

export type GeoJsonValidationSeverity = 'error' | 'warning';

export interface GeoJsonValidationIssue {
  severity: GeoJsonValidationSeverity;
  code: string;
  message: string;
  featureIndex?: number;
  geometryType?: string;
  talhao?: string;
}

export interface GeoJsonNormalizeOptions {
  propriedade_id: string;
  ano?: number;
  safra?: string;
  corPadrao?: string;
  data_upload?: string;
}

export interface GeoJsonValidationSummary {
  features_count: number;
  talhoes_count: number;
  polygon_parts_count: number;
  geometry_types: string[];
  warnings_count: number;
  errors_count: number;
}

export type GeoJsonNormalizedTalhao = MapaTalhao & {
  ano?: number;
  data_upload?: string;
  disponivel_offline: boolean;
  observacoes?: string;
};

export interface GeoJsonValidationResult {
  ok: boolean;
  errors: GeoJsonValidationIssue[];
  warnings: GeoJsonValidationIssue[];
  talhoes: GeoJsonNormalizedTalhao[];
  summary: GeoJsonValidationSummary;
}

type GeoJsonFeature = {
  type?: unknown;
  id?: unknown;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: unknown;
    coordinates?: unknown;
  } | null;
};

const DEFAULT_TALHAO_COLOR = '#0EA5E9';

const emptySummary = (
  featuresCount = 0,
  geometryTypes: string[] = [],
  talhoesCount = 0,
  polygonPartsCount = 0,
  warningsCount = 0,
  errorsCount = 0
): GeoJsonValidationSummary => ({
  features_count: featuresCount,
  talhoes_count: talhoesCount,
  polygon_parts_count: polygonPartsCount,
  geometry_types: geometryTypes,
  warnings_count: warningsCount,
  errors_count: errorsCount,
});

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const isCoordinateInRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

const areSamePoint = (a: PontoPoligono, b: PontoPoligono): boolean =>
  a.lat === b.lat && a.lng === b.lng;

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean))).sort();

const normalizeOptionalString = (value: unknown): string | undefined => {
  const normalized = firstNonEmptyString(value);
  return normalized || undefined;
};

const normalizePositiveNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) && value > 0 ? value : undefined;

const normalizeAno = (optionValue: unknown, propertyValue: unknown): number | undefined => {
  if (isInteger(optionValue) && optionValue > 0) return optionValue;
  if (isInteger(propertyValue) && propertyValue > 0) return propertyValue;
  return undefined;
};

const resolveAreaHectares = (properties: Record<string, unknown>): number =>
  normalizePositiveNumber(properties.area_hectares)
  ?? normalizePositiveNumber(properties.area_ha)
  ?? normalizePositiveNumber(properties.area)
  ?? 0;

const resolveTalhaoName = (
  feature: GeoJsonFeature,
  properties: Record<string, unknown>,
  featureIndex: number
): string => {
  const resolved = firstNonEmptyString(
    properties.talhao,
    properties.nome,
    properties.name,
    properties.codigo,
    properties.id,
    feature.id
  );

  return resolved || `Talhao ${featureIndex + 1}`;
};

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return slug || 'sem_nome';
};

const buildStableTalhaoId = (
  propriedadeId: string,
  featureIndex: number,
  talhao: string
): string =>
  `geojson_${slugify(propriedadeId)}_${String(featureIndex + 1).padStart(3, '0')}_${slugify(talhao)}`;

interface NormalizationContext {
  addError: (issue: Omit<GeoJsonValidationIssue, 'severity'>) => void;
  addWarning: (issue: Omit<GeoJsonValidationIssue, 'severity'>) => void;
}

interface FeatureContext {
  featureIndex: number;
  geometryType: string;
  talhao: string;
}

const normalizePosition = (
  position: unknown,
  featureContext: FeatureContext,
  context: NormalizationContext
): PontoPoligono | null => {
  if (!Array.isArray(position) || position.length < 2) {
    context.addError({
      code: 'COORDINATE_INVALID_SHAPE',
      message: 'Coordenada deve ser um array com pelo menos dois numeros.',
      ...featureContext,
    });
    return null;
  }

  const lng = position[0];
  const lat = position[1];

  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    context.addError({
      code: 'COORDINATE_NOT_NUMERIC',
      message: 'Coordenada deve usar numeros finitos para lng e lat.',
      ...featureContext,
    });
    return null;
  }

  const lngInRange = isCoordinateInRange(lng, -180, 180);
  const latInRange = isCoordinateInRange(lat, -90, 90);

  if (!lngInRange) {
    context.addError({
      code: 'COORDINATE_LNG_OUT_OF_RANGE',
      message: 'Longitude fora do intervalo -180 a 180.',
      ...featureContext,
    });
  }

  if (!latInRange) {
    const looksLikeLatLng =
      isCoordinateInRange(lng, -90, 90)
      && isCoordinateInRange(lat, -180, 180);

    if (looksLikeLatLng) {
      context.addWarning({
        code: 'PROBABLE_LAT_LNG_INVERSION',
        message: 'Coordenada parece estar em [lat, lng], mas GeoJSON esperado usa [lng, lat].',
        ...featureContext,
      });
    }

    context.addError({
      code: 'COORDINATE_LAT_OUT_OF_RANGE',
      message: 'Latitude fora do intervalo -90 a 90.',
      ...featureContext,
    });
  }

  if (!lngInRange || !latInRange) return null;

  return { lat, lng };
};

const normalizeLinearRing = (
  ring: unknown,
  featureContext: FeatureContext,
  context: NormalizationContext
): PontoPoligono[] | null => {
  if (!Array.isArray(ring) || ring.length === 0) {
    context.addError({
      code: 'LINEAR_RING_EMPTY',
      message: 'Anel externo do poligono esta vazio.',
      ...featureContext,
    });
    return null;
  }

  if (ring.length < 4) {
    context.addError({
      code: 'RING_TOO_FEW_POINTS',
      message: 'Anel externo deve ter ao menos quatro coordenadas.',
      ...featureContext,
    });
    return null;
  }

  const points: PontoPoligono[] = [];
  let hasInvalidPoint = false;

  for (const position of ring) {
    const point = normalizePosition(position, featureContext, context);
    if (!point) {
      hasInvalidPoint = true;
      continue;
    }
    points.push(point);
  }

  if (hasInvalidPoint) return null;
  if (points.length < 4) {
    context.addError({
      code: 'RING_TOO_FEW_POINTS',
      message: 'Anel externo deve ter ao menos quatro coordenadas validas.',
      ...featureContext,
    });
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (!areSamePoint(first, last)) {
    points.push({ ...first });
    context.addWarning({
      code: 'RING_NOT_CLOSED',
      message: 'Anel externo nao estava fechado e foi fechado em memoria.',
      ...featureContext,
    });
  }

  return points;
};

const normalizePolygonCoordinates = (
  coordinates: unknown,
  featureContext: FeatureContext,
  context: NormalizationContext
): PontoPoligono[][] => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    context.addError({
      code: 'GEOMETRY_COORDINATES_EMPTY',
      message: 'Polygon sem coordinates validas.',
      ...featureContext,
    });
    return [];
  }

  if (coordinates.length > 1) {
    context.addWarning({
      code: 'INTERIOR_RING_IGNORED',
      message: 'Anéis internos foram ignorados nesta fase; apenas o anel externo foi normalizado.',
      ...featureContext,
    });
  }

  const exterior = normalizeLinearRing(coordinates[0], featureContext, context);
  return exterior ? [exterior] : [];
};

const normalizeMultiPolygonCoordinates = (
  coordinates: unknown,
  featureContext: FeatureContext,
  context: NormalizationContext
): PontoPoligono[][] => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    context.addError({
      code: 'GEOMETRY_COORDINATES_EMPTY',
      message: 'MultiPolygon sem coordinates validas.',
      ...featureContext,
    });
    return [];
  }

  const parts: PontoPoligono[][] = [];

  coordinates.forEach((polygonCoordinates, index) => {
    if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
      context.addError({
        code: 'MULTIPOLYGON_PART_EMPTY',
        message: `Parte ${index + 1} do MultiPolygon esta vazia.`,
        ...featureContext,
      });
      return;
    }

    if (polygonCoordinates.length > 1) {
      context.addWarning({
        code: 'INTERIOR_RING_IGNORED',
        message: 'Anéis internos foram ignorados nesta fase; apenas o anel externo foi normalizado.',
        ...featureContext,
      });
    }

    const exterior = normalizeLinearRing(polygonCoordinates[0], featureContext, context);
    if (exterior) parts.push(exterior);
  });

  if (parts.length === 0) {
    context.addError({
      code: 'MULTIPOLYGON_WITHOUT_VALID_PARTS',
      message: 'MultiPolygon nao possui partes externas validas.',
      ...featureContext,
    });
  }

  return parts;
};

export const validateAndNormalizeGeoJson = (
  input: unknown,
  options: GeoJsonNormalizeOptions
): GeoJsonValidationResult => {
  const errors: GeoJsonValidationIssue[] = [];
  const warnings: GeoJsonValidationIssue[] = [];
  const warningKeys = new Set<string>();
  const geometryTypes: string[] = [];
  const talhoes: GeoJsonNormalizedTalhao[] = [];

  const addError: NormalizationContext['addError'] = (issue) => {
    errors.push({ severity: 'error', ...issue });
  };

  const addWarning: NormalizationContext['addWarning'] = (issue) => {
    const key = [
      issue.code,
      issue.featureIndex ?? '',
      issue.geometryType ?? '',
      issue.talhao ?? '',
    ].join('|');

    if (warningKeys.has(key)) return;
    warningKeys.add(key);
    warnings.push({ severity: 'warning', ...issue });
  };

  const context: NormalizationContext = { addError, addWarning };
  const propriedadeId = firstNonEmptyString(options?.propriedade_id);

  if (!propriedadeId) {
    addError({
      code: 'PROPRIEDADE_ID_REQUIRED',
      message: 'propriedade_id e obrigatorio para normalizar talhoes.',
    });
  }

  let parsedInput = input;
  if (typeof input === 'string') {
    try {
      parsedInput = JSON.parse(input);
    } catch {
      addError({
        code: 'INVALID_JSON',
        message: 'String informada nao e um JSON valido.',
      });
      return {
        ok: false,
        errors,
        warnings,
        talhoes,
        summary: emptySummary(0, [], 0, 0, warnings.length, errors.length),
      };
    }
  }

  if (!isRecord(parsedInput)) {
    addError({
      code: 'GEOJSON_ROOT_INVALID',
      message: 'Entrada deve ser um objeto GeoJSON.',
    });
    return {
      ok: false,
      errors,
      warnings,
      talhoes,
      summary: emptySummary(0, [], 0, 0, warnings.length, errors.length),
    };
  }

  if (parsedInput.type !== 'FeatureCollection') {
    addError({
      code: 'FEATURE_COLLECTION_REQUIRED',
      message: 'GeoJSON deve ser do tipo FeatureCollection.',
    });
  }

  if (!Array.isArray(parsedInput.features)) {
    addError({
      code: 'FEATURES_MISSING',
      message: 'FeatureCollection deve possuir features como array.',
    });
    return {
      ok: false,
      errors,
      warnings,
      talhoes,
      summary: emptySummary(0, [], 0, 0, warnings.length, errors.length),
    };
  }

  const features = parsedInput.features as GeoJsonFeature[];

  if (features.length === 0) {
    addError({
      code: 'FEATURES_EMPTY',
      message: 'FeatureCollection deve possuir ao menos uma feature.',
    });
  }

  const seenNames = new Map<string, number>();

  features.forEach((feature, featureIndex) => {
    if (!isRecord(feature)) {
      addError({
        code: 'FEATURE_INVALID',
        message: 'Feature deve ser um objeto.',
        featureIndex,
      });
      return;
    }

    if (feature.type !== undefined && feature.type !== 'Feature') {
      addError({
        code: 'FEATURE_TYPE_INVALID',
        message: 'Item de features deve ser do tipo Feature.',
        featureIndex,
      });
      return;
    }

    const properties = isRecord(feature.properties) ? feature.properties : {};
    const talhao = resolveTalhaoName(feature, properties, featureIndex);
    const geometry = feature.geometry;

    if (!isRecord(geometry)) {
      addError({
        code: 'GEOMETRY_MISSING',
        message: 'Feature sem geometry valida.',
        featureIndex,
        talhao,
      });
      return;
    }

    const geometryType = firstNonEmptyString(geometry.type);
    if (geometryType) geometryTypes.push(geometryType);

    const featureContext: FeatureContext = {
      featureIndex,
      geometryType: geometryType || 'desconhecida',
      talhao,
    };

    let parts: PontoPoligono[][];
    if (geometryType === 'Polygon') {
      parts = normalizePolygonCoordinates(geometry.coordinates, featureContext, context);
    } else if (geometryType === 'MultiPolygon') {
      parts = normalizeMultiPolygonCoordinates(geometry.coordinates, featureContext, context);
    } else {
      addError({
        code: 'GEOMETRY_TYPE_UNSUPPORTED',
        message: 'Somente Polygon e MultiPolygon sao aceitos nesta fase.',
        ...featureContext,
      });
      return;
    }

    if (parts.length === 0) return;

    const duplicatedName = seenNames.get(talhao.toLowerCase());
    if (duplicatedName !== undefined) {
      addWarning({
        code: 'DUPLICATE_TALHAO_NAME',
        message: `Nome de talhao duplicado; ja apareceu na feature ${duplicatedName}.`,
        ...featureContext,
      });
    } else {
      seenNames.set(talhao.toLowerCase(), featureIndex);
    }

    const normalizedTalhao: GeoJsonNormalizedTalhao = {
      id: buildStableTalhaoId(propriedadeId || 'propriedade', featureIndex, talhao),
      propriedade_id: propriedadeId,
      talhao_id: buildStableTalhaoId(propriedadeId || 'propriedade', featureIndex, talhao),
      talhao_nome: talhao,
      talhao,
      nome: talhao,
      ano: normalizeAno(options?.ano, properties.ano),
      area_hectares: resolveAreaHectares(properties),
      poligono: parts[0],
      poligonos: parts,
      cor: firstNonEmptyString(options?.corPadrao) || DEFAULT_TALHAO_COLOR,
      data_upload: normalizeOptionalString(options?.data_upload),
      safra: normalizeOptionalString(options?.safra) ?? normalizeOptionalString(properties.safra),
      disponivel_offline: true,
      observacoes: 'Talhão carregado de um GeoJSON local. Anéis internos, quando existirem, não são exibidos nesta etapa.',
    };

    talhoes.push(normalizedTalhao);
  });

  const polygonPartsCount = talhoes.reduce((total, talhao) => {
    if (Array.isArray(talhao.poligonos) && talhao.poligonos.length > 0) {
      return total + talhao.poligonos.length;
    }
    return total + 1;
  }, 0);

  return {
    ok: errors.length === 0 && talhoes.length > 0,
    errors,
    warnings,
    talhoes,
    summary: emptySummary(
      features.length,
      uniqueSorted(geometryTypes),
      talhoes.length,
      polygonPartsCount,
      warnings.length,
      errors.length
    ),
  };
};
