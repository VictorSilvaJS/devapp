import {
  CADERNO_LOCALIZACAO_SPATIAL_KEYS,
  type CadernoLocalizacaoSpatialKey,
  normalizeCadernoLocalizacao,
} from './cadernoLocalizacaoCompat';
import {
  getRegistroTalhaoId,
  getTalhaoConsultaId,
  getTalhaoStableId,
} from './talhaoConsultaCompat';

export const CADERNO_LOCALIZACAO_TOLERANCIA_PADRAO_M = 15;

export const CADERNO_LOCALIZACAO_RELACOES = ['dentro', 'proximo', 'fora'] as const;
export type CadernoLocalizacaoRelacaoTalhao = typeof CADERNO_LOCALIZACAO_RELACOES[number];

export const CADERNO_TALHAO_GEOMETRIA_FONTES = [
  'geojson_local',
  'limite_area_local',
] as const;
export type CadernoTalhaoGeometriaFonte = typeof CADERNO_TALHAO_GEOMETRIA_FONTES[number];

export type CadernoLocalizacaoSpatialAssessment = {
  localizacao_relacao_talhao: CadernoLocalizacaoRelacaoTalhao;
  localizacao_distancia_talhao_m: number;
  localizacao_tolerancia_talhao_m: number;
  talhao_geometria_versao_id: string;
  talhao_geometria_fonte: CadernoTalhaoGeometriaFonte;
  talhao_geometria_ano?: number;
};

export type CadernoLocalizacaoSpatialValidationResult =
  | { valid: true; status: 'absent'; value: null }
  | { valid: true; status: 'valid'; value: CadernoLocalizacaoSpatialAssessment }
  | { valid: false; status: 'invalid'; value: null; error: string };

export type CadernoTalhaoGeometrySnapshot = {
  talhaoId: string;
  geometryVersionId: string;
  source: CadernoTalhaoGeometriaFonte;
  year?: number;
  polygons: Array<Array<{ lat: number; lng: number }>>;
  raw: Record<string, any>;
};

const EARTH_RADIUS_M = 6371008.8;

const hasOwn = (value: unknown, key: string): boolean =>
  Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeYear = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const normalizePoint = (value: unknown): { lat: number; lng: number } | null => {
  if (!value || typeof value !== 'object') return null;
  const lat = (value as any).lat;
  const lng = (value as any).lng;
  return isFiniteNumber(lat) && lat >= -90 && lat <= 90
    && isFiniteNumber(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
};

const normalizePolygon = (value: unknown): Array<{ lat: number; lng: number }> => {
  if (!Array.isArray(value)) return [];
  const points = value.map(normalizePoint).filter(Boolean) as Array<{ lat: number; lng: number }>;
  return points.length >= 3 ? points : [];
};

const getGeometryPolygons = (geometry: Record<string, any>): Array<Array<{ lat: number; lng: number }>> => {
  const parts = Array.isArray(geometry.poligonos)
    ? geometry.poligonos.map(normalizePolygon).filter((polygon) => polygon.length >= 3)
    : [];
  if (parts.length > 0) return parts;

  const polygon = normalizePolygon(geometry.poligono);
  return polygon.length >= 3 ? [polygon] : [];
};

const toLocalMeters = (
  point: { lat: number; lng: number },
  origin: { lat: number; lng: number }
): { x: number; y: number } => {
  const latitudeRad = ((point.lat + origin.lat) / 2) * Math.PI / 180;
  return {
    x: (point.lng - origin.lng) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(latitudeRad),
    y: (point.lat - origin.lat) * Math.PI / 180 * EARTH_RADIUS_M,
  };
};

const distancePointToSegmentMeters = (
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number => {
  const p = toLocalMeters(point, point);
  const a = toLocalMeters(start, point);
  const b = toLocalMeters(end, point);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(a.x - p.x, a.y - p.y);

  const projection = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + projection * dx), p.y - (a.y + projection * dy));
};

const isPointInsidePolygon = (
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean => {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects = (a.lat > point.lat) !== (b.lat > point.lat)
      && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (intersects) inside = !inside;
  }
  return inside;
};

const distanceToPolygonMeters = (
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): number => {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    minimum = Math.min(minimum, distancePointToSegmentMeters(point, start, end));
  }
  return minimum;
};

export const hasCadernoLocalizacaoSpatialFieldIntent = (value: unknown): boolean =>
  CADERNO_LOCALIZACAO_SPATIAL_KEYS.some((key) => hasOwn(value, key));

export const clearCadernoLocalizacaoSpatialFields = <T extends Record<string, any>>(record: T): T => {
  const next = { ...record };
  CADERNO_LOCALIZACAO_SPATIAL_KEYS.forEach((key) => delete next[key]);
  return next;
};

export const validateCadernoLocalizacaoSpatialAssessment = (
  value: unknown
): CadernoLocalizacaoSpatialValidationResult => {
  if (!hasCadernoLocalizacaoSpatialFieldIntent(value)) {
    return { valid: true, status: 'absent', value: null };
  }

  const source = value as Record<string, unknown>;
  const relation = source.localizacao_relacao_talhao;
  const distance = source.localizacao_distancia_talhao_m;
  const tolerance = source.localizacao_tolerancia_talhao_m;
  const versionId = firstNonEmptyString(source.talhao_geometria_versao_id);
  const geometrySource = source.talhao_geometria_fonte;
  const year = source.talhao_geometria_ano;

  if (!CADERNO_LOCALIZACAO_RELACOES.includes(relation as CadernoLocalizacaoRelacaoTalhao)) {
    return { valid: false, status: 'invalid', value: null, error: 'Relação espacial com o Talhão inválida.' };
  }
  if (!isFiniteNumber(distance) || distance < 0) {
    return { valid: false, status: 'invalid', value: null, error: 'Distância ao Talhão inválida.' };
  }
  if (!isFiniteNumber(tolerance) || tolerance < 0) {
    return { valid: false, status: 'invalid', value: null, error: 'Tolerância espacial do Talhão inválida.' };
  }
  if (!versionId) {
    return { valid: false, status: 'invalid', value: null, error: 'Versão da geometria do Talhão obrigatória.' };
  }
  if (!CADERNO_TALHAO_GEOMETRIA_FONTES.includes(geometrySource as CadernoTalhaoGeometriaFonte)) {
    return { valid: false, status: 'invalid', value: null, error: 'Fonte da geometria do Talhão inválida.' };
  }
  if (year !== undefined && normalizeYear(year) === undefined) {
    return { valid: false, status: 'invalid', value: null, error: 'Ano da geometria do Talhão inválido.' };
  }

  return {
    valid: true,
    status: 'valid',
    value: {
      localizacao_relacao_talhao: relation as CadernoLocalizacaoRelacaoTalhao,
      localizacao_distancia_talhao_m: distance,
      localizacao_tolerancia_talhao_m: tolerance,
      talhao_geometria_versao_id: versionId,
      talhao_geometria_fonte: geometrySource as CadernoTalhaoGeometriaFonte,
      ...(normalizeYear(year) ? { talhao_geometria_ano: normalizeYear(year) } : {}),
    },
  };
};

export const normalizeCadernoLocalizacaoSpatialAssessment = (
  value: unknown
): CadernoLocalizacaoSpatialAssessment | null => {
  const result = validateCadernoLocalizacaoSpatialAssessment(value);
  return result.valid && result.status === 'valid' ? result.value : null;
};

export const buildCadernoLocalizacaoSpatialFields = (
  value: unknown
): Partial<CadernoLocalizacaoSpatialAssessment> => {
  const result = validateCadernoLocalizacaoSpatialAssessment(value);
  if (result.status === 'absent') return {};
  if (result.valid === false) throw new Error(result.error);
  return { ...result.value };
};

export const resolveCadernoTalhaoGeometry = (
  geometries: Array<Record<string, any>> = [],
  talhaoId?: unknown
): CadernoTalhaoGeometrySnapshot | null => {
  const normalizedTalhaoId = firstNonEmptyString(talhaoId);
  if (!normalizedTalhaoId) return null;

  const candidates = geometries
    .filter((geometry) => {
      const stableId = getTalhaoStableId(geometry);
      return stableId === normalizedTalhaoId
        || getTalhaoConsultaId(geometry) === normalizedTalhaoId;
    })
    .filter((geometry) => getGeometryPolygons(geometry).length > 0)
    .sort((left, right) => {
      const yearDifference = (normalizeYear(right.ano) ?? 0) - (normalizeYear(left.ano) ?? 0);
      if (yearDifference !== 0) return yearDifference;
      const dateDifference = Date.parse(String(right.data_upload || '')) - Date.parse(String(left.data_upload || ''));
      if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
      return getTalhaoConsultaId(right).localeCompare(getTalhaoConsultaId(left));
    });

  const selected = candidates[0];
  if (!selected) return null;

  const geometryVersionId = firstNonEmptyString(
    selected.talhao_geometria_versao_id,
    selected.geojson_import_id,
    selected.importacao_id,
    selected.id
  );
  if (!geometryVersionId) return null;

  const declaredSource = firstNonEmptyString(selected.talhao_geometria_fonte);
  const source: CadernoTalhaoGeometriaFonte = declaredSource === 'geojson_local'
    ? 'geojson_local'
    : 'limite_area_local';

  return {
    talhaoId: normalizedTalhaoId,
    geometryVersionId,
    source,
    ...(normalizeYear(selected.ano) ? { year: normalizeYear(selected.ano) } : {}),
    polygons: getGeometryPolygons(selected),
    raw: selected,
  };
};

export const assessCadernoLocationAgainstTalhao = ({
  latitude,
  longitude,
  accuracy,
  geometry,
  toleranceMeters = CADERNO_LOCALIZACAO_TOLERANCIA_PADRAO_M,
}: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  geometry: CadernoTalhaoGeometrySnapshot;
  toleranceMeters?: number;
}): CadernoLocalizacaoSpatialAssessment => {
  const point = { lat: latitude, lng: longitude };
  const boundaryDistance = Math.min(
    ...geometry.polygons.map((polygon) => distanceToPolygonMeters(point, polygon))
  );
  const inside = boundaryDistance <= 0.05
    || geometry.polygons.some((polygon) => isPointInsidePolygon(point, polygon));
  const distance = inside ? 0 : boundaryDistance;
  const normalizedTolerance = isFiniteNumber(toleranceMeters) && toleranceMeters >= 0
    ? toleranceMeters
    : CADERNO_LOCALIZACAO_TOLERANCIA_PADRAO_M;
  const accuracyRadius = isFiniteNumber(accuracy) && accuracy >= 0 ? accuracy : 0;
  const relation: CadernoLocalizacaoRelacaoTalhao = inside
    ? 'dentro'
    : distance <= normalizedTolerance + accuracyRadius
      ? 'proximo'
      : 'fora';

  return {
    localizacao_relacao_talhao: relation,
    localizacao_distancia_talhao_m: Math.round(distance * 10) / 10,
    localizacao_tolerancia_talhao_m: normalizedTolerance,
    talhao_geometria_versao_id: geometry.geometryVersionId,
    talhao_geometria_fonte: geometry.source,
    ...(geometry.year ? { talhao_geometria_ano: geometry.year } : {}),
  };
};

export const appendCadernoLocalizacaoSpatialAssessment = <T extends Record<string, any>>(
  record: T,
  geometries: Array<Record<string, any>> = []
): T & Partial<CadernoLocalizacaoSpatialAssessment> => {
  const withoutAssessment = clearCadernoLocalizacaoSpatialFields(record);
  const location = normalizeCadernoLocalizacao(record);
  const geometry = resolveCadernoTalhaoGeometry(geometries, getRegistroTalhaoId(record));
  if (!location || !geometry) return withoutAssessment;

  return {
    ...withoutAssessment,
    ...assessCadernoLocationAgainstTalhao({
      latitude: location.localizacao_latitude,
      longitude: location.localizacao_longitude,
      accuracy: location.localizacao_accuracy,
      geometry,
    }),
  };
};

export const getCadernoLocalizacaoRelacaoLabel = (value: unknown): string | null => {
  const assessment = normalizeCadernoLocalizacaoSpatialAssessment(value);
  if (!assessment) return null;
  if (assessment.localizacao_relacao_talhao === 'dentro') return 'Dentro do Talhão';
  if (assessment.localizacao_relacao_talhao === 'proximo') return 'Próximo ao Talhão';
  return 'Fora do Talhão';
};

export const pickCadernoLocalizacaoBundleFields = (
  value: unknown
): Record<string, unknown> => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return [
    'localizacao_latitude',
    'localizacao_longitude',
    'localizacao_accuracy',
    'localizacao_captured_at',
    'localizacao_captured_by',
    'localizacao_origem',
    ...CADERNO_LOCALIZACAO_SPATIAL_KEYS,
  ].reduce((result, key) => {
    if (hasOwn(source, key) && source[key] !== undefined) result[key] = source[key];
    return result;
  }, {} as Record<string, unknown>);
};

export const buildCadernoLocalizacaoSpatialRemovalPatch = ():
Record<CadernoLocalizacaoSpatialKey, undefined> =>
  CADERNO_LOCALIZACAO_SPATIAL_KEYS.reduce((patch, key) => {
    patch[key] = undefined;
    return patch;
  }, {} as Record<CadernoLocalizacaoSpatialKey, undefined>);
