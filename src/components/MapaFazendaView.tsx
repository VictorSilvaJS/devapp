import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, typography } from '../theme';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
export interface PontoPoligono {
  lat: number;
  lng: number;
}

export interface TalhaoMapa {
  id: string;
  talhao: string;
  area_hectares: number;
  cor?: string;
  poligono: PontoPoligono[];
  cultura_atual?: string;
  textura?: string;
  tipo_solo?: string;
  safra?: string;
  nome?: string;
}

export interface MapaFazendaViewRef {
  selecionarTalhao: (id: string | null) => void;
  ajustarLimites: () => void;
}

interface Props {
  talhoes: TalhaoMapa[];
  talhaoSelecionadoId?: string | null;
  onTalhaoPress?: (id: string) => void;
  onMapaReady?: () => void;
}

// ─────────────────────────────────────────────────────────────
// GERADOR DE HTML LEAFLET
// ─────────────────────────────────────────────────────────────
function gerarHTMLLeaflet(talhoes: TalhaoMapa[], talhaoSelecionadoId?: string | null): string {
  const features = talhoes
    .filter(t => t.poligono && t.poligono.length >= 3)
    .map(t => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...t.poligono.map(p => [p.lng, p.lat]),
          [t.poligono[0].lng, t.poligono[0].lat], // fechar o anel
        ]],
      },
      properties: {
        id: t.id,
        talhao: t.talhao,
        area_hectares: t.area_hectares,
        cor: t.cor || '#22C55E',
        cultura_atual: t.cultura_atual || '',
        textura: t.textura || '',
        tipo_solo: t.tipo_solo || '',
        safra: t.safra || '',
        nome: t.nome || '',
      },
    }));

  const geojsonStr = JSON.stringify({ type: 'FeatureCollection', features });
  const selectedStr = talhaoSelecionadoId ? `'${talhaoSelecionadoId}'` : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #111; }
    .leaflet-control-zoom { border: none !important; }
    .leaflet-control-zoom a {
      background: rgba(255,255,255,0.9) !important;
      color: #333 !important;
      font-weight: bold;
      border-radius: 6px !important;
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
      font-size: 18px !important;
      margin-bottom: 4px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
    }
    .talhao-label {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    .talhao-label-text {
      color: white;
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      text-shadow:
        0 0 4px rgba(0,0,0,1),
        0 1px 3px rgba(0,0,0,0.9),
        -1px 0 2px rgba(0,0,0,0.8),
        1px 0 2px rgba(0,0,0,0.8);
      pointer-events: none;
      white-space: nowrap;
      line-height: 1.3;
    }
    .talhao-label-area {
      color: rgba(255,255,255,0.85);
      font-size: 10px;
      text-align: center;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      pointer-events: none;
      white-space: nowrap;
    }
    .leaflet-bottom.leaflet-right { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var GEOJSON = ${geojsonStr};
    var SELECTED_ID = ${selectedStr};

    // ── Inicializa mapa ──
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      tap: true,
    });

    // ── Tiles satélite ESRI (gratuito, sem API key) ──
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, tileSize: 256 }
    ).addTo(map);

    // ── Overlay de rótulos geográficos ──
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, tileSize: 256, opacity: 0.6 }
    ).addTo(map);

    // ── Controle de zoom ──
    L.control.zoom({ position: 'topright' }).addTo(map);

    // ── Estado ──
    var layersById = {};
    var labelMarkersById = {};

    function normalizarCor(hex) {
      if (!hex || typeof hex !== 'string') return '#22C55E';
      return hex.startsWith('#') ? hex : '#' + hex;
    }

    function getEstilo(feature, selecionado) {
      var cor = normalizarCor(feature.properties.cor);
      return {
        color: cor,
        weight: selecionado ? 3.5 : 2,
        opacity: 1,
        fillColor: cor,
        fillOpacity: selecionado ? 0.55 : 0.25,
        dashArray: null,
      };
    }

    // ── Renderiza camada GeoJSON ──
    var geojsonLayer = L.geoJSON(GEOJSON, {
      style: function(feature) {
        return getEstilo(feature, SELECTED_ID === feature.properties.id);
      },
      onEachFeature: function(feature, layer) {
        var id = feature.properties.id;
        layersById[id] = layer;

        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              tipo: 'talhaoPress',
              id: id
            }));
          } catch(err) {}
        });

        // Label no centróide do polígono
        try {
          var bounds = layer.getBounds();
          var center = bounds.getCenter();
          var icon = L.divIcon({
            className: 'talhao-label',
            html:
              '<div class="talhao-label-text">' + feature.properties.talhao + '</div>' +
              '<div class="talhao-label-area">' + feature.properties.area_hectares.toFixed(1) + ' ha</div>',
            iconSize: [120, 36],
            iconAnchor: [60, 18],
          });
          var marker = L.marker(center, { icon: icon, interactive: false });
          labelMarkersById[id] = marker;
          marker.addTo(map);
        } catch(e) {}
      }
    }).addTo(map);

    // ── Ajusta visão inicial ──
    if (geojsonLayer.getLayers().length > 0) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40], animate: false });
    } else {
      map.setView([-15.0, -52.0], 5);
    }

    // ── Toque fora de polígonos desmarca ──
    map.on('click', function() {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'mapaPress' }));
      } catch(e) {}
    });

    // ── Recebe mensagens do React Native ──
    function handleMensagem(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.tipo === 'selecionarTalhao') {
          selecionarTalhao(data.id);
        } else if (data.tipo === 'ajustarLimites') {
          if (geojsonLayer.getLayers().length > 0) {
            map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40] });
          }
        }
      } catch(e) {}
    }
    document.addEventListener('message', handleMensagem);
    window.addEventListener('message', handleMensagem);

    function selecionarTalhao(id) {
      Object.keys(layersById).forEach(function(lid) {
        var feat = layersById[lid].feature;
        layersById[lid].setStyle(getEstilo(feat, false));
      });
      if (id && layersById[id]) {
        var feat = layersById[id].feature;
        layersById[id].setStyle(getEstilo(feat, true));
        layersById[id].bringToFront();
        var bounds = layersById[id].getBounds();
        map.panTo(bounds.getCenter(), { animate: true, duration: 0.5 });
      }
    }

    // Seleciona inicial se houver
    if (SELECTED_ID) {
      selecionarTalhao(SELECTED_ID);
    }

    // Notifica que está pronto
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'ready' }));
    } catch(e) {}
  </script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────
const MapaFazendaView = forwardRef<MapaFazendaViewRef, Props>(
  ({ talhoes, talhaoSelecionadoId, onTalhaoPress, onMapaReady }, ref) => {
    const webViewRef = useRef<any>(null);

    const html = React.useMemo(
      () => gerarHTMLLeaflet(talhoes, talhaoSelecionadoId),
      // Re-gera HTML apenas quando a lista de talhões muda (não na seleção, pois usamos postMessage)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [JSON.stringify(talhoes.map(t => t.id))]
    );

    // Expõe métodos para o pai via ref
    useImperativeHandle(ref, () => ({
      selecionarTalhao(id: string | null) {
        webViewRef.current?.injectJavaScript(
          `selecionarTalhao(${id ? `'${id}'` : 'null'}); true;`
        );
      },
      ajustarLimites() {
        webViewRef.current?.injectJavaScript(
          `if (geojsonLayer.getLayers().length > 0) { map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40] }); } true;`
        );
      },
    }));

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.tipo === 'talhaoPress' && onTalhaoPress) {
            onTalhaoPress(data.id);
          } else if (data.tipo === 'ready' && onMapaReady) {
            onMapaReady();
          }
        } catch (_) {}
      },
      [onTalhaoPress, onMapaReady]
    );

    if (!talhoes || talhoes.length === 0) {
      return (
        <View style={styles.vazio}>
          <Ionicons name="map-outline" size={48} color={colors.muted} />
          <Text style={styles.vazioTexto}>Sem talhões para exibir</Text>
        </View>
      );
    }

    return (
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa satélite...</Text>
          </View>
        )}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
      />
    );
  }
);

MapaFazendaView.displayName = 'MapaFazendaView';
export default MapaFazendaView;

// Importação necessária para o ícone no estado vazio
import { Ionicons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#111',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: typography.fontBody,
    marginTop: 8,
  },
  vazio: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  vazioTexto: {
    color: colors.muted,
    fontSize: typography.fontBody,
  },
});
