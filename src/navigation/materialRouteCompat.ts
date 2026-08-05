type MaterialRoutePropertyContext = {
  propriedadeId?: string;
  fazendaId?: string;
  produtorId?: string;
};

export type MaterialViewerRouteParams = MaterialRoutePropertyContext & {
  materialId?: string;
  material_id?: string;
  materialVersion?: string | number;
  material_version?: string | number;
  versao?: string | number;
};

export type MaterialViewerIdentity = {
  materialId: string;
  materialVersion: string;
  propriedadeId?: string;
};

export type MaterialViewerKind = 'geospatial' | 'image' | 'pdf' | 'file';

export type MaterialGeoPolygon = {
  id: string;
  label: string;
  value?: string;
  color: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
};

export type MaterialViewerDescriptor = {
  kind: MaterialViewerKind;
  format: string;
  sourceUri?: string;
  previewAvailable: boolean;
  primaryActionLabel: string;
  noPreviewMessage?: string;
  polygons: MaterialGeoPolygon[];
};

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const DEFAULT_VERSION = '1';
const DEFAULT_LAYER_COLOR = '#1F7A1F';

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const resolveMaterialId = (material?: Record<string, any> | null): string | undefined =>
  firstNonEmptyString(material?.id, material?.material_id, material?.materialId);

export const resolveMaterialVersion = (
  material?: Record<string, any> | null
): string => firstNonEmptyString(
  material?.versao,
  material?.version,
  material?.versao_dados,
  DEFAULT_VERSION
) as string;

const normalizeVersion = (value: unknown): string | undefined => {
  const normalized = firstNonEmptyString(value)?.toLowerCase();
  return normalized?.replace(/^v(?=\d)/, '');
};

const resolveMaterialFazendaId = (
  material?: Record<string, any> | null
): string | undefined => firstNonEmptyString(
  material?.propriedade_id,
  material?.propriedadeId,
  material?.fazenda_id,
  material?.fazendaId,
  material?.produtor_id
);

const resolveRouteFazendaId = (
  params?: MaterialViewerRouteParams | null
): string | undefined => firstNonEmptyString(params?.propriedadeId, params?.fazendaId, params?.produtorId);

export const buildMaterialViewerRouteParams = (
  material?: Record<string, any> | null
): MaterialViewerRouteParams | undefined => {
  const materialId = resolveMaterialId(material);
  if (!materialId) return undefined;

  const materialVersion = resolveMaterialVersion(material);
  const fazendaId = resolveMaterialFazendaId(material);

  return {
    materialId,
    materialVersion,
    ...(fazendaId ? { propriedadeId: fazendaId } : {}),
  };
};

export const resolveMaterialViewerIdentity = (
  params?: MaterialViewerRouteParams | null
): MaterialViewerIdentity | null => {
  const materialId = firstNonEmptyString(params?.materialId, params?.material_id);
  const materialVersion = firstNonEmptyString(
    params?.materialVersion,
    params?.material_version,
    params?.versao
  );

  if (!materialId || !materialVersion) return null;

  return {
    materialId,
    materialVersion,
    propriedadeId: resolveRouteFazendaId(params),
  };
};

export const resolveMaterialFromCatalog = (
  materiais: Record<string, any>[] = [],
  params?: MaterialViewerRouteParams | null
): Record<string, any> | null => {
  const identity = resolveMaterialViewerIdentity(params);
  if (!identity) return null;

  return materiais.find((material) => {
    if (resolveMaterialId(material) !== identity.materialId) return false;
    if (normalizeVersion(resolveMaterialVersion(material)) !== normalizeVersion(identity.materialVersion)) {
      return false;
    }

    return !identity.propriedadeId || resolveMaterialFazendaId(material) === identity.propriedadeId;
  }) ?? null;
};

const isCoordinatePair = (value: unknown): value is [number, number] =>
  Array.isArray(value)
  && value.length >= 2
  && typeof value[0] === 'number'
  && Number.isFinite(value[0])
  && value[0] >= -180
  && value[0] <= 180
  && typeof value[1] === 'number'
  && Number.isFinite(value[1])
  && value[1] >= -90
  && value[1] <= 90;

const toCoordinates = (ring: unknown): MaterialGeoPolygon['coordinates'] =>
  Array.isArray(ring)
    ? ring
        .filter(isCoordinatePair)
        .map(([longitude, latitude]) => ({ latitude, longitude }))
    : [];

const normalizeColor = (value: unknown): string => {
  const color = firstNonEmptyString(value);
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_LAYER_COLOR;
};

const resolveGeoJson = (material?: Record<string, any> | null): Record<string, any> | null => {
  const candidate = material?.camada_geojson
    ?? material?.geojson
    ?? material?.feature_collection
    ?? material?.featureCollection;
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate
    : null;
};

export const extractMaterialGeoPolygons = (
  material?: Record<string, any> | null
): MaterialGeoPolygon[] => {
  const geoJson = resolveGeoJson(material);
  if (!geoJson) return [];

  const features = geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)
    ? geoJson.features
    : geoJson.type === 'Feature'
      ? [geoJson]
      : [{ type: 'Feature', geometry: geoJson, properties: {} }];

  const polygons: MaterialGeoPolygon[] = [];

  features.forEach((feature: any, featureIndex: number) => {
    const geometry = feature?.geometry;
    const properties = feature?.properties ?? {};
    const polygonRings = geometry?.type === 'Polygon'
      ? [geometry.coordinates?.[0]]
      : geometry?.type === 'MultiPolygon'
        ? (geometry.coordinates ?? []).map((polygon: any) => polygon?.[0])
        : [];

    polygonRings.forEach((ring: unknown, polygonIndex: number) => {
      const coordinates = toCoordinates(ring);
      if (coordinates.length < 3) return;

      const label = firstNonEmptyString(
        properties.label,
        properties.nome,
        properties.talhao,
        properties.classe,
        `Área ${featureIndex + 1}`
      ) as string;
      const value = firstNonEmptyString(
        properties.valor_label,
        properties.valor,
        properties.value,
        properties.faixa
      );

      const featureId = firstNonEmptyString(feature?.id, properties.id, String(featureIndex)) as string;
      polygons.push({
        id: `${featureId}:${polygonIndex}`,
        label,
        value,
        color: normalizeColor(properties.cor ?? properties.color ?? material?.cor),
        coordinates,
      });
    });
  });

  return polygons;
};

const inferFormatFromUri = (value: unknown): string | undefined => {
  const uri = firstNonEmptyString(value);
  if (!uri) return undefined;

  const mimeSubtype = uri.match(/^data:[^/]+\/([^;,]+)/i)?.[1]?.toLowerCase();
  if (mimeSubtype) return mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;

  const cleanPath = uri.split(/[?#]/)[0];
  const extension = cleanPath.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension;
};

export const resolveMaterialFormat = (
  material?: Record<string, any> | null
): string => {
  const explicit = firstNonEmptyString(material?.formato_arquivo)?.toLowerCase();
  if (explicit) return explicit === 'jpeg' ? 'jpg' : explicit;

  const mimeSubtype = firstNonEmptyString(material?.arquivo_mime)
    ?.toLowerCase()
    .split('/')[1];
  if (mimeSubtype) return mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;

  return inferFormatFromUri(
    material?.arquivo_uri_local
    ?? material?.arquivo_url
    ?? material?.arquivoUrl
  ) ?? 'arquivo';
};

const resolveSourceUri = (material?: Record<string, any> | null): string | undefined =>
  firstNonEmptyString(
    material?.arquivo_uri_local,
    material?.arquivo_url,
    material?.arquivoUrl,
    material?.download_url,
    material?.url_download
  );

export const resolveMaterialViewerDescriptor = (
  material?: Record<string, any> | null
): MaterialViewerDescriptor => {
  const format = resolveMaterialFormat(material);
  const sourceUri = resolveSourceUri(material);
  const polygons = extractMaterialGeoPolygons(material);

  if (polygons.length > 0) {
    return {
      kind: 'geospatial',
      format,
      sourceUri,
      previewAvailable: true,
      primaryActionLabel: 'Baixar arquivo fonte',
      polygons,
    };
  }

  if (IMAGE_FORMATS.has(format)) {
    return {
      kind: 'image',
      format,
      sourceUri,
      previewAvailable: Boolean(sourceUri),
      primaryActionLabel: 'Baixar imagem',
      noPreviewMessage: sourceUri
        ? undefined
        : 'A imagem não possui um arquivo disponível para visualização.',
      polygons: [],
    };
  }

  if (format === 'pdf') {
    return {
      kind: 'pdf',
      format,
      sourceUri,
      previewAvailable: Boolean(sourceUri),
      primaryActionLabel: 'Abrir documento',
      noPreviewMessage: sourceUri
        ? undefined
        : 'O PDF não possui um arquivo disponível neste aparelho.',
      polygons: [],
    };
  }

  return {
    kind: 'file',
    format,
    sourceUri,
    previewAvailable: false,
    primaryActionLabel: 'Baixar arquivo',
    noPreviewMessage: format === 'zip'
      ? 'Pacote ZIP disponível somente como arquivo. O aplicativo não descompacta nem simula uma prévia.'
      : 'Este formato não possui prévia no aplicativo. Consulte os metadados e use a ação autorizada do arquivo.',
    polygons: [],
  };
};
