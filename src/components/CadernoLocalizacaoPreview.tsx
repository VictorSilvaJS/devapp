import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Polygon as SvgPolygon,
  Rect as SvgRect,
} from 'react-native-svg';
import { colors, shadows, spacing, typography } from '../theme';
import { normalizeCadernoLocalizacao } from '../utils/cadernoLocalizacaoCompat';
import type { CadernoTalhaoGeometrySnapshot } from '../utils/cadernoLocalizacaoSpatialCompat';

type CadernoLocalizacaoPreviewProps = {
  registro: unknown;
  geometry?: CadernoTalhaoGeometrySnapshot | null;
};

type MetricPoint = {
  x: number;
  y: number;
};

type PreviewProjection = {
  accuracyRadius: number | null;
  point: MetricPoint;
  polygons: MetricPoint[][];
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 600;
const VIEW_PADDING = 62;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const DEFAULT_HALF_SPAN_METERS = 60;

const buildProjection = ({
  latitude,
  longitude,
  accuracy,
  geometry,
}: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  geometry?: CadernoTalhaoGeometrySnapshot | null;
}): PreviewProjection => {
  const metersPerLongitudeDegree = Math.max(
    METERS_PER_LATITUDE_DEGREE * Math.cos(latitude * Math.PI / 180),
    1
  );
  const toMeters = ({ lat, lng }: { lat: number; lng: number }): MetricPoint => ({
    x: (lng - longitude) * metersPerLongitudeDegree,
    y: (lat - latitude) * METERS_PER_LATITUDE_DEGREE,
  });
  const metricPolygons = geometry?.polygons.map((polygon) => polygon.map(toMeters)) ?? [];
  const metricPoints = metricPolygons.flat();
  const accuracyMeters = accuracy != null && accuracy > 0 ? accuracy : null;
  const halfSpan = Math.max(accuracyMeters ?? 0, DEFAULT_HALF_SPAN_METERS);

  let minX = metricPoints.length > 0 ? Math.min(0, ...metricPoints.map(({ x }) => x)) : -halfSpan;
  let maxX = metricPoints.length > 0 ? Math.max(0, ...metricPoints.map(({ x }) => x)) : halfSpan;
  let minY = metricPoints.length > 0 ? Math.min(0, ...metricPoints.map(({ y }) => y)) : -halfSpan;
  let maxY = metricPoints.length > 0 ? Math.max(0, ...metricPoints.map(({ y }) => y)) : halfSpan;

  if (accuracyMeters != null) {
    minX = Math.min(minX, -accuracyMeters);
    maxX = Math.max(maxX, accuracyMeters);
    minY = Math.min(minY, -accuracyMeters);
    maxY = Math.max(maxY, accuracyMeters);
  }

  const rangeX = Math.max(maxX - minX, DEFAULT_HALF_SPAN_METERS * 2);
  const rangeY = Math.max(maxY - minY, DEFAULT_HALF_SPAN_METERS * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = Math.min(
    (VIEW_WIDTH - VIEW_PADDING * 2) / rangeX,
    (VIEW_HEIGHT - VIEW_PADDING * 2) / rangeY
  );
  const project = ({ x, y }: MetricPoint): MetricPoint => ({
    x: VIEW_WIDTH / 2 + (x - centerX) * scale,
    y: VIEW_HEIGHT / 2 - (y - centerY) * scale,
  });

  return {
    point: project({ x: 0, y: 0 }),
    polygons: metricPolygons.map((polygon) => polygon.map(project)),
    accuracyRadius: accuracyMeters != null ? Math.max(accuracyMeters * scale, 3) : null,
  };
};

export default function CadernoLocalizacaoPreview({
  registro,
  geometry,
}: CadernoLocalizacaoPreviewProps) {
  const location = normalizeCadernoLocalizacao(registro);
  const projection = useMemo(() => {
    if (!location) return null;

    return buildProjection({
      latitude: location.localizacao_latitude,
      longitude: location.localizacao_longitude,
      accuracy: typeof location.localizacao_accuracy === 'number'
        ? location.localizacao_accuracy
        : null,
      geometry,
    });
  }, [geometry, location]);

  if (!location || !projection) return null;

  const accessibilityLabel = geometry
    ? 'Mini mapa do ponto registrado, da precisão e do limite do Talhão.'
    : 'Mini mapa do ponto registrado e da precisão da leitura.';

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <SvgRect x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#EEF3EF" />
        {[1, 2, 3].map((step) => (
          <React.Fragment key={`grid-${step}`}>
            <SvgLine
              x1={(VIEW_WIDTH / 4) * step}
              y1={0}
              x2={(VIEW_WIDTH / 4) * step}
              y2={VIEW_HEIGHT}
              stroke="rgba(47, 72, 55, 0.10)"
              strokeWidth={2}
            />
            <SvgLine
              x1={0}
              y1={(VIEW_HEIGHT / 4) * step}
              x2={VIEW_WIDTH}
              y2={(VIEW_HEIGHT / 4) * step}
              stroke="rgba(47, 72, 55, 0.10)"
              strokeWidth={2}
            />
          </React.Fragment>
        ))}

        {projection.polygons.map((polygon, index) => (
          <SvgPolygon
            key={`${geometry?.geometryVersionId || 'geometria'}:${index}`}
            points={polygon.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke={colors.primaryDark}
            strokeWidth={7}
            strokeLinejoin="round"
            fill="rgba(45, 106, 79, 0.20)"
          />
        ))}

        {projection.accuracyRadius != null ? (
          <SvgCircle
            cx={projection.point.x}
            cy={projection.point.y}
            r={projection.accuracyRadius}
            stroke="rgba(37, 99, 235, 0.90)"
            strokeWidth={5}
            fill="rgba(59, 130, 246, 0.16)"
          />
        ) : null}
        <SvgCircle
          cx={projection.point.x}
          cy={projection.point.y}
          r={19}
          fill={colors.white}
        />
        <SvgCircle
          cx={projection.point.x}
          cy={projection.point.y}
          r={13}
          fill={colors.info}
        />
      </Svg>

      <View style={styles.legend} pointerEvents="none">
        <Ionicons name="map-outline" size={14} color={colors.textLight} />
        <Text style={styles.legendText}>
          {projection.polygons.length > 0 ? 'Ponto, precisão e limite do Talhão' : 'Ponto e precisão registrados'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 210,
    overflow: 'hidden',
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  legend: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusSm,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  legendText: {
    color: colors.textLight,
    fontSize: typography.fontSmall,
    fontWeight: '600',
  },
});
