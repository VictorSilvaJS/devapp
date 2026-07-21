import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Polygon, G, Text as SvgText, Circle } from 'react-native-svg';
import { colors, spacing, typography, shadows } from '../theme';
import { formatAreaHa } from '../utils/talhaoMedidasCompat';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SVG_PADDING = 30;

const getTalhaoPoligonos = (talhao) => {
  const parts = Array.isArray(talhao.poligonos) && talhao.poligonos.length > 0
    ? talhao.poligonos
    : [talhao.poligono];

  return parts.filter((poligono) => Array.isArray(poligono) && poligono.length >= 3);
};

/**
 * Converte coordenadas geográficas (lat/lng) para coordenadas de tela SVG.
 * Normaliza todos os polígonos para caber dentro do viewBox.
 */
function geoToSvg(talhoes, width, height) {
  if (!talhoes || talhoes.length === 0) return [];

  // Encontrar bounds de todos os polígonos juntos
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  talhoes.forEach(t => {
    getTalhaoPoligonos(t).forEach(poligono => {
      poligono.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
    });
  });

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const usableW = width - SVG_PADDING * 2;
  const usableH = height - SVG_PADDING * 2;

  // Manter aspecto
  const scaleX = usableW / lngRange;
  const scaleY = usableH / latRange;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = SVG_PADDING + (usableW - lngRange * scale) / 2;
  const offsetY = SVG_PADDING + (usableH - latRange * scale) / 2;

  return talhoes.map(t => {
    const polygons = getTalhaoPoligonos(t).map(poligono =>
      poligono.map(p => {
        const x = offsetX + (p.lng - minLng) * scale;
        const y = offsetY + (maxLat - p.lat) * scale; // inverter Y
        return { x, y };
      })
    );
    const allPoints = polygons.flat();

    // Centróide para label
    const cx = allPoints.reduce((s, p) => s + p.x, 0) / (allPoints.length || 1);
    const cy = allPoints.reduce((s, p) => s + p.y, 0) / (allPoints.length || 1);

    return {
      ...t,
      svgPolygons: polygons.map(points => points.map(p => `${p.x},${p.y}`).join(' ')),
      center: { x: cx, y: cy },
    };
  });
}

/**
 * Componente ShapeRenderer
 * Renderiza polígonos de talhões usando SVG.
 * 
 * Props:
 * - talhoes: Array de objetos com { id, talhao, poligono, cor, area_hectares, ... }
 * - onTalhaoPress: callback quando um talhão é tocado
 * - selectedId: ID do talhão selecionado (destaque)
 * - height: altura do container SVG (default: 280)
 * - showLabels: mostrar labels nos talhões (default: true)
 * - showLegend: mostrar legenda abaixo (default: true)
 */
export default function ShapeRenderer({
  talhoes = [],
  onTalhaoPress,
  selectedId,
  height = 280,
  showLabels = true,
  showLegend = true,
}) {
  const containerWidth = SCREEN_WIDTH - spacing.screen * 2 - spacing.md * 2;
  
  const svgTalhoes = useMemo(
    () => geoToSvg(talhoes, containerWidth, height),
    [talhoes, containerWidth, height]
  );

  if (!talhoes || talhoes.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>Nenhum talhão disponível</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { height: height + 20 }]}>
        <Svg width={containerWidth} height={height} viewBox={`0 0 ${containerWidth} ${height}`}>
          {svgTalhoes.map((t, i) => {
            const isSelected = selectedId === t.id;
            return (
              <G key={t.id} onPress={() => onTalhaoPress && onTalhaoPress(t)}>
                {t.svgPolygons.map((svgPoints, partIndex) => (
                  <Polygon
                    key={`${t.id}-${partIndex}`}
                    points={svgPoints}
                    fill={isSelected ? t.cor + 'AA' : t.cor + '55'}
                    stroke={isSelected ? t.cor : t.cor + 'CC'}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeLinejoin="round"
                  />
                ))}
                {showLabels && (
                  <>
                    <Circle
                      cx={t.center.x}
                      cy={t.center.y}
                      r={14}
                      fill={t.cor + 'DD'}
                    />
                    <SvgText
                      x={t.center.x}
                      y={t.center.y + 4}
                      fontSize={10}
                      fontWeight="bold"
                      fill="white"
                      textAnchor="middle"
                    >
                      {t.talhao?.replace('Talhão ', '').substring(0, 3)}
                    </SvgText>
                  </>
                )}
              </G>
            );
          })}
        </Svg>

        {/* Instrução */}
        <Text style={styles.instruction}>Toque em um talhão para ver detalhes</Text>
      </View>

      {/* Legenda */}
      {showLegend && (
        <View style={styles.legend}>
          {svgTalhoes.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.legendItem,
                selectedId === t.id && styles.legendItemSelected
              ]}
              onPress={() => onTalhaoPress && onTalhaoPress(t)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendColor, { backgroundColor: t.cor }]} />
              <View style={styles.legendInfo}>
                <Text style={styles.legendName} numberOfLines={1}>{t.talhao}</Text>
                <Text style={styles.legendArea}>{formatAreaHa(t.area_hectares)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  container: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
  },
  instruction: {
    position: 'absolute',
    bottom: 6,
    fontSize: typography.fontCaption,
    color: colors.muted,
    fontStyle: 'italic',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.radiusSm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  legendItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendName: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  legendArea: {
    fontSize: typography.fontCaption,
    color: colors.muted,
  },
});
