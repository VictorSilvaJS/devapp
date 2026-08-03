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
import { buildLocationMapProjection } from '../utils/locationMapProjectionCompat';

type CadernoLocalizacaoPreviewProps = {
  registro: unknown;
  geometry?: CadernoTalhaoGeometrySnapshot | null;
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 600;
const VIEW_PADDING = 62;

export default function CadernoLocalizacaoPreview({
  registro,
  geometry,
}: CadernoLocalizacaoPreviewProps) {
  const location = normalizeCadernoLocalizacao(registro);
  const projection = useMemo(() => {
    if (!location) return null;

    return buildLocationMapProjection({
      shapes: geometry ? [{ id: geometry.geometryVersionId, polygons: geometry.polygons }] : [],
      location: {
        latitude: location.localizacao_latitude,
        longitude: location.localizacao_longitude,
        accuracy: typeof location.localizacao_accuracy === 'number'
          ? location.localizacao_accuracy
          : null,
      },
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      padding: VIEW_PADDING,
    });
  }, [geometry, location]);

  if (!location || !projection?.location) return null;

  const projectedLocation = projection.location;

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

        {projection.shapes.flatMap((shape) => shape.polygons.map((polygon, index) => (
          <SvgPolygon
            key={`${shape.id}:${index}`}
            points={polygon.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke={colors.primaryDark}
            strokeWidth={7}
            strokeLinejoin="round"
            fill="rgba(45, 106, 79, 0.20)"
          />
        )))}

        {projectedLocation.accuracyRadius != null ? (
          <SvgCircle
            cx={projectedLocation.x}
            cy={projectedLocation.y}
            r={projectedLocation.accuracyRadius}
            stroke="rgba(37, 99, 235, 0.90)"
            strokeWidth={5}
            fill="rgba(59, 130, 246, 0.16)"
          />
        ) : null}
        <SvgCircle
          cx={projectedLocation.x}
          cy={projectedLocation.y}
          r={19}
          fill={colors.white}
        />
        <SvgCircle
          cx={projectedLocation.x}
          cy={projectedLocation.y}
          r={13}
          fill={colors.info}
        />
      </Svg>

      <View style={styles.legend} pointerEvents="none">
        <Ionicons name="map-outline" size={14} color={colors.textLight} />
        <Text style={styles.legendText}>
          {projection.shapes.length > 0 ? 'Ponto, precisão e limite do Talhão' : 'Ponto e precisão registrados'}
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
