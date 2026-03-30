/**
 * Componente de Mapa Nativo com react-native-maps
 * 
 * Substitui MapaFazendaView.tsx (que usava WebView + Leaflet)
 * 
 * Vantagens:
 * - Performance nativa (sem overhead de WebView)
 * - Suporte offline automático com tiles em cache
 * - Gestos touch nativos (pinch-zoom, pan)
 * - Integração com MapKit (iOS) e Google Maps (Android)
 * - Menor consumo de bateria
 */

import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Polygon, Marker, MapEvent, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { MapaTalhao } from '../types/mapa';
import { obterMapaCache } from '../services/MapaCacheService';

export interface MapaFazendaNativoViewRef {
  selecionarTalhao: (id: string | null) => void;
  ajustarLimites: () => void;
  obterRegiao: () => Region | null;
}

interface Props {
  talhoes: MapaTalhao[];
  talhaoSelecionadoId?: string | null;
  onTalhaoPress?: (id: string) => void;
  onMapaReady?: () => void;
  /** Modo offline — usar apenas dados em cache */
  modoOffline?: boolean;
}

const MAPA_PADRAO_REGIAO: Region = {
  latitude: -15.7939,
  longitude: -56.0691,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

/**
 * Componente do mapa nativo
 */
const MapaFazendaNativoView = forwardRef<MapaFazendaNativoViewRef, Props>(({
  talhoes,
  talhaoSelecionadoId,
  onTalhaoPress,
  onMapaReady,
  modoOffline = false,
}, ref) => {
  const mapRef = useRef<MapView>(null);
  const [estaCarregado, setEstaCarregado] = useState(false);
  const [estadoModoOffline, setEstadoModoOffline] = useState(modoOffline);
  const cache = obterMapaCache();

  useEffect(() => {
    onMapaReady?.();
  }, [estaCarregado, onMapaReady]);

  /**
   * Calcular bounding box de todos os talhões
   */
  const calcularBoundingBox = useCallback(() => {
    if (!talhoes || talhoes.length === 0) {
      return MAPA_PADRAO_REGIAO;
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    for (const talhao of talhoes) {
      for (const ponto of talhao.poligono) {
        minLat = Math.min(minLat, ponto.lat);
        maxLat = Math.max(maxLat, ponto.lat);
        minLng = Math.min(minLng, ponto.lng);
        maxLng = Math.max(maxLng, ponto.lng);
      }
    }

    const centroLat = (minLat + maxLat) / 2;
    const centroLng = (minLng + maxLng) / 2;
    const deltaLat = (maxLat - minLat) * 1.3;
    const deltaLng = (maxLng - minLng) * 1.3;

    return {
      latitude: centroLat,
      longitude: centroLng,
      latitudeDelta: deltaLat,
      longitudeDelta: deltaLng,
    };
  }, [talhoes]);

  /**
   * Ref: ajustar limites do mapa automaticamente
   */
  useImperativeHandle(ref, () => ({
    ajustarLimites: () => {
      const bbox = calcularBoundingBox();
      mapRef.current?.animateToRegion(bbox, 300);
    },

    selecionarTalhao: (id: string | null) => {
      if (!id) return;
      const talhao = talhoes.find(t => t.id === id);
      if (talhao) {
        const firstPoint = talhao.poligono[0];
        mapRef.current?.animateToCoordinate({
          latitude: firstPoint.lat,
          longitude: firstPoint.lng,
        }, 300);
      }
    },

    obterRegiao: () => {
      // Implementar se necessário
      return null;
    },
  }), [talhoes, calcularBoundingBox]);

  /**
   * Handler: toque em um polígono
   */
  const handleTalhaoPress = useCallback((talhaoId: string) => {
    onTalhaoPress?.(talhaoId);
  }, [onTalhaoPress]);

  /**
   * Handler: mapa carregado
   */
  const handleMapReady = useCallback(() => {
    setEstaCarregado(true);
    const bbox = calcularBoundingBox();
    mapRef.current?.animateToRegion(bbox, 300);
  }, [calcularBoundingBox]);

  /**
   * Alternar modo offline
   */
  const toggleModoOffline = useCallback(() => {
    setEstadoModoOffline(!estadoModoOffline);
  }, [estadoModoOffline]);

  if (!estaCarregado) {
    return (
      <View style={styles.containerCarregando}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.textoCarregando}>Preparando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Mapa Base ─────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={MAPA_PADRAO_REGIAO}
        onMapReady={handleMapReady}
        mapType="satellite"
        loadingEnabled
        loadingIndicatorColor={colors.primary}
      >
        {/* ─── Renderizar Polígonos dos Talhões ─────────────────── */}
        {talhoes.map((talhao) => (
          <Polygon
            key={talhao.id}
            coordinates={talhao.poligono.map(p => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            fillColor={talhao.cor || colors.primary}
            fillOpacity={talhaoSelecionadoId === talhao.id ? 0.4 : 0.2}
            strokeColor={talhaoSelecionadoId === talhao.id ? colors.primary : (talhao.cor || colors.muted)}
            strokeWidth={talhaoSelecionadoId === talhao.id ? 3 : 2}
            onPress={() => handleTalhaoPress(talhao.id)}
            tappable
          />
        ))}

        {/* ─── Marcadores dos Talhões ───────────────────────────── */}
        {talhoes.map((talhao) => {
          const pontosCentro = talhao.poligono;
          if (pontosCentro.length === 0) return null;

          // Calcular centroide
          const centroLat = pontosCentro.reduce((s, p) => s + p.lat, 0) / pontosCentro.length;
          const centroLng = pontosCentro.reduce((s, p) => s + p.lng, 0) / pontosCentro.length;

          return (
            <Marker
              key={`marker_${talhao.id}`}
              coordinate={{
                latitude: centroLat,
                longitude: centroLng,
              }}
              onPress={() => handleTalhaoPress(talhao.id)}
              pinColor={talhao.cor || colors.primary}
            >
              <View style={[styles.markerLabel, { backgroundColor: talhao.cor || colors.primary }]}>
                <Text style={styles.markerLabelTexto}>{talhao.talhao}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ─── Botões de Controle ────────────────────────────────── */}
      <View style={styles.controlesContainer}>
        {/* Botão: Modo Offline */}
        <TouchableOpacity
          style={[styles.btnControle, estadoModoOffline && styles.btnControleAtivo]}
          onPress={toggleModoOffline}
        >
          <Ionicons
            name={estadoModoOffline ? 'cloud-offline' : 'cloud'}
            size={20}
            color={estadoModoOffline ? colors.warning : colors.white}
          />
          <Text style={styles.txtControle}>
            {estadoModoOffline ? 'Offline' : 'Online'}
          </Text>
        </TouchableOpacity>

        {/* Botão: Ajustar Limites */}
        <TouchableOpacity
          style={styles.btnControle}
          onPress={() => {
            const bbox = calcularBoundingBox();
            mapRef.current?.animateToRegion(bbox, 300);
          }}
        >
          <Ionicons name="fit" size={20} color={colors.white} />
          <Text style={styles.txtControle}>Ajustar</Text>
        </TouchableOpacity>

        {/* Informação: Modo e Talhões */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTexto}>
            📍 {talhoes.length} talhões
          </Text>
          {talhaoSelecionadoId && (
            <Text style={styles.infoTexto} numberOfLines={1}>
              ✓ {talhoes.find(t => t.id === talhaoSelecionadoId)?.talhao}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

MapaFazendaNativoView.displayName = 'MapaFazendaNativoView';

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  containerCarregando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  textoCarregando: {
    marginTop: spacing.lg,
    fontSize: 14,
    color: colors.text,
  },

  // ─── Controles ─────────────────────────────────────────────
  controlesContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    gap: spacing.md,
  },

  btnControle: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  btnControleAtivo: {
    backgroundColor: colors.warning,
  },

  txtControle: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Informações ───────────────────────────────────────────
  infoContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  infoTexto: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },

  // ─── Marcadores ────────────────────────────────────────────
  markerLabel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.white,
  },

  markerLabelTexto: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default MapaFazendaNativoView;
