export type LocationMapGeoPoint = {
  lat: number;
  lng: number;
};

export type LocationMapShape = {
  id: string;
  polygons: LocationMapGeoPoint[][];
};

export type LocationMapPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export type LocationMapProjectedPoint = {
  x: number;
  y: number;
};

export type LocationMapProjectedShape = {
  id: string;
  polygons: LocationMapProjectedPoint[][];
  center: LocationMapProjectedPoint;
};

export type LocationMapProjection = {
  shapes: LocationMapProjectedShape[];
  location: (LocationMapProjectedPoint & { accuracyRadius: number | null }) | null;
};

const METERS_PER_LATITUDE_DEGREE = 111_320;
const DEFAULT_MIN_SPAN_METERS = 120;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidGeoPoint = (point: LocationMapGeoPoint): boolean =>
  isFiniteNumber(point?.lat)
  && point.lat >= -90
  && point.lat <= 90
  && isFiniteNumber(point?.lng)
  && point.lng >= -180
  && point.lng <= 180;

const normalizeLocation = (location?: LocationMapPoint | null): LocationMapPoint | null => {
  if (
    !location
    || !isFiniteNumber(location.latitude)
    || location.latitude < -90
    || location.latitude > 90
    || !isFiniteNumber(location.longitude)
    || location.longitude < -180
    || location.longitude > 180
  ) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: isFiniteNumber(location.accuracy) && location.accuracy >= 0
      ? location.accuracy
      : null,
  };
};

export const buildLocationMapProjection = ({
  shapes,
  location,
  width,
  height,
  padding,
  minSpanMeters = DEFAULT_MIN_SPAN_METERS,
}: {
  shapes: LocationMapShape[];
  location?: LocationMapPoint | null;
  width: number;
  height: number;
  padding: number;
  minSpanMeters?: number;
}): LocationMapProjection => {
  const safeWidth = isFiniteNumber(width) && width > 0 ? width : 0;
  const safeHeight = isFiniteNumber(height) && height > 0 ? height : 0;
  const safePadding = isFiniteNumber(padding) && padding >= 0 ? padding : 0;
  const safeMinSpan = isFiniteNumber(minSpanMeters) && minSpanMeters > 0
    ? minSpanMeters
    : DEFAULT_MIN_SPAN_METERS;
  const normalizedLocation = normalizeLocation(location);
  const validShapes = (Array.isArray(shapes) ? shapes : []).map((shape) => ({
    id: String(shape?.id || ''),
    polygons: (Array.isArray(shape?.polygons) ? shape.polygons : [])
      .map((polygon) => (Array.isArray(polygon) ? polygon.filter(isValidGeoPoint) : []))
      .filter((polygon) => polygon.length >= 3),
  })).filter((shape) => shape.id && shape.polygons.length > 0);
  const geoPoints = validShapes.flatMap((shape) => shape.polygons.flat());

  if (safeWidth === 0 || safeHeight === 0 || (geoPoints.length === 0 && !normalizedLocation)) {
    return { shapes: [], location: null };
  }

  const referencePoints = normalizedLocation
    ? [...geoPoints, { lat: normalizedLocation.latitude, lng: normalizedLocation.longitude }]
    : geoPoints;
  const referenceLatitude = referencePoints.reduce((sum, point) => sum + point.lat, 0)
    / referencePoints.length;
  const referenceLongitude = referencePoints.reduce((sum, point) => sum + point.lng, 0)
    / referencePoints.length;
  const metersPerLongitudeDegree = Math.max(
    METERS_PER_LATITUDE_DEGREE * Math.cos(referenceLatitude * Math.PI / 180),
    1
  );
  const toMeters = (point: LocationMapGeoPoint): LocationMapProjectedPoint => ({
    x: (point.lng - referenceLongitude) * metersPerLongitudeDegree,
    y: (point.lat - referenceLatitude) * METERS_PER_LATITUDE_DEGREE,
  });
  const metricShapes = validShapes.map((shape) => ({
    id: shape.id,
    polygons: shape.polygons.map((polygon) => polygon.map(toMeters)),
  }));
  const metricLocation = normalizedLocation
    ? toMeters({ lat: normalizedLocation.latitude, lng: normalizedLocation.longitude })
    : null;
  const metricPoints = [
    ...metricShapes.flatMap((shape) => shape.polygons.flat()),
    ...(metricLocation ? [metricLocation] : []),
  ];
  const accuracyMeters = normalizedLocation?.accuracy ?? null;

  let minX = Math.min(...metricPoints.map((point) => point.x));
  let maxX = Math.max(...metricPoints.map((point) => point.x));
  let minY = Math.min(...metricPoints.map((point) => point.y));
  let maxY = Math.max(...metricPoints.map((point) => point.y));

  if (metricLocation && accuracyMeters != null) {
    minX = Math.min(minX, metricLocation.x - accuracyMeters);
    maxX = Math.max(maxX, metricLocation.x + accuracyMeters);
    minY = Math.min(minY, metricLocation.y - accuracyMeters);
    maxY = Math.max(maxY, metricLocation.y + accuracyMeters);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const rangeX = Math.max(maxX - minX, safeMinSpan);
  const rangeY = Math.max(maxY - minY, safeMinSpan);
  const usableWidth = Math.max(safeWidth - safePadding * 2, 1);
  const usableHeight = Math.max(safeHeight - safePadding * 2, 1);
  const scale = Math.min(usableWidth / rangeX, usableHeight / rangeY);
  const project = (point: LocationMapProjectedPoint): LocationMapProjectedPoint => ({
    x: safeWidth / 2 + (point.x - centerX) * scale,
    y: safeHeight / 2 - (point.y - centerY) * scale,
  });

  return {
    shapes: metricShapes.map((shape) => {
      const polygons = shape.polygons.map((polygon) => polygon.map(project));
      const allPoints = polygons.flat();
      const pointSum = allPoints.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 }
      );

      return {
        id: shape.id,
        polygons,
        center: {
          x: pointSum.x / allPoints.length,
          y: pointSum.y / allPoints.length,
        },
      };
    }),
    location: metricLocation
      ? {
          ...project(metricLocation),
          accuracyRadius: accuracyMeters != null ? Math.max(accuracyMeters * scale, 3) : null,
        }
      : null,
  };
};
