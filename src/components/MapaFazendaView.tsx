import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Polygon as SvgPolygon, Rect, Text as SvgText } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { colors, spacing, typography } from '../theme';

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
  poligonos?: PontoPoligono[][];
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

type SvgTalhao = TalhaoMapa & {
  svgPolygons: string[];
  center: { x: number; y: number };
};

const LEAFLET_READY_TIMEOUT_MS = 6500;
const SVG_PADDING = 26;

const normalizeHexColor = (value?: string): string => {
  if (!value) return colors.primary;
  const normalized = value.startsWith('#') ? value : `#${value}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : colors.primary;
};

const colorWithOpacity = (hex: string | undefined, opacity: number): string => {
  const normalized = normalizeHexColor(hex).replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const shortenTalhaoLabel = (value: string): string =>
  String(value || '')
    .replace(/^Talh[aã]o\s*/i, '')
    .trim()
    .slice(0, 12);

const getTalhaoPoligonos = (talhao: TalhaoMapa): PontoPoligono[][] => {
  const parts = Array.isArray(talhao.poligonos) && talhao.poligonos.length > 0
    ? talhao.poligonos
    : [talhao.poligono];

  return parts.filter((poligono) => Array.isArray(poligono) && poligono.length >= 3);
};

function buildSvgTalhoes(talhoes: TalhaoMapa[], width: number, height: number): SvgTalhao[] {
  const validTalhoes = talhoes.filter((talhao) => getTalhaoPoligonos(talhao).length > 0);
  if (validTalhoes.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  validTalhoes.forEach((talhao) => {
    getTalhaoPoligonos(talhao).forEach((poligono) => {
      poligono.forEach((ponto) => {
        minLat = Math.min(minLat, ponto.lat);
        maxLat = Math.max(maxLat, ponto.lat);
        minLng = Math.min(minLng, ponto.lng);
        maxLng = Math.max(maxLng, ponto.lng);
      });
    });
  });

  const latRange = Math.max(maxLat - minLat, 0.000001);
  const lngRange = Math.max(maxLng - minLng, 0.000001);
  const usableW = Math.max(width - SVG_PADDING * 2, 1);
  const usableH = Math.max(height - SVG_PADDING * 2, 1);
  const scale = Math.min(usableW / lngRange, usableH / latRange);
  const offsetX = SVG_PADDING + (usableW - lngRange * scale) / 2;
  const offsetY = SVG_PADDING + (usableH - latRange * scale) / 2;

  return validTalhoes.map((talhao) => {
    const polygons = getTalhaoPoligonos(talhao).map((poligono) =>
      poligono.map((ponto) => {
        const x = offsetX + (ponto.lng - minLng) * scale;
        const y = offsetY + (maxLat - ponto.lat) * scale;
        return { x, y };
      })
    );
    const allPoints = polygons.flat();
    const center = allPoints.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );

    return {
      ...talhao,
      svgPolygons: polygons.map((points) => points.map((point) => `${point.x},${point.y}`).join(' ')),
      center: {
        x: center.x / allPoints.length,
        y: center.y / allPoints.length,
      },
    };
  });
}

function gerarHTMLLeaflet(talhoes: TalhaoMapa[], talhaoSelecionadoId?: string | null): string {
  const features = talhoes
    .filter((talhao) => getTalhaoPoligonos(talhao).length > 0)
    .map((talhao) => ({
      type: 'Feature',
      geometry: (() => {
        const poligonos = getTalhaoPoligonos(talhao);
        const rings = poligonos.map((poligono) => {
          const coordinates = poligono.map((ponto) => [ponto.lng, ponto.lat]);
          const first = poligono[0];
          const last = poligono[poligono.length - 1];
          if (first.lat !== last.lat || first.lng !== last.lng) {
            coordinates.push([first.lng, first.lat]);
          }
          return coordinates;
        });

        return poligonos.length > 1
          ? { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) }
          : { type: 'Polygon', coordinates: [rings[0]] };
      })(),
      properties: {
        id: talhao.id,
        talhao: talhao.talhao,
        area_hectares: talhao.area_hectares,
        cor: normalizeHexColor(talhao.cor),
        cultura_atual: talhao.cultura_atual || '',
        textura: talhao.textura || '',
        tipo_solo: talhao.tipo_solo || '',
        safra: talhao.safra || '',
        nome: talhao.nome || '',
      },
    }));

  const geojsonStr = JSON.stringify({ type: 'FeatureCollection', features });
  const selectedStr = JSON.stringify(talhaoSelecionadoId || null);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #101827; }
    .leaflet-container { background: #101827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .leaflet-control-zoom { border: none !important; margin-top: 76px !important; }
    .leaflet-control-zoom a {
      background: rgba(255,255,255,0.94) !important;
      color: #172033 !important;
      font-weight: 800;
      border-radius: 8px !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      font-size: 18px !important;
      margin-bottom: 6px !important;
      border: 0 !important;
      box-shadow: 0 2px 12px rgba(0,0,0,0.32) !important;
    }
    .leaflet-control-attribution {
      background: rgba(255,255,255,0.76) !important;
      font-size: 9px !important;
    }
    .talhao-label {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    .talhao-label-text {
      color: white;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.9);
      pointer-events: none;
      white-space: nowrap;
      line-height: 1.25;
    }
    .talhao-label-area {
      color: rgba(255,255,255,0.9);
      font-size: 10px;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0,0,0,1);
      pointer-events: none;
      white-space: nowrap;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var GEOJSON = ${geojsonStr};
      var SELECTED_ID = ${selectedStr};
      var layersById = {};
      var labelsById = {};
      var geojsonLayer = null;
      var map = null;

      function post(tipo, payload) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ tipo: tipo }, payload || {})));
        } catch (err) {}
      }

      if (typeof L === 'undefined') {
        post('erro_mapa', { motivo: 'leaflet_indisponivel' });
        return;
      }

      function escapeLabel(value) {
        return String(value || '').replace(/[&<>"']/g, function (c) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
        });
      }

      function getEstilo(feature, selecionado) {
        var cor = feature.properties.cor || '#22C55E';
        return {
          color: selecionado ? '#FFFFFF' : cor,
          weight: selecionado ? 4 : 2.4,
          opacity: 1,
          fillColor: cor,
          fillOpacity: selecionado ? 0.48 : 0.26,
        };
      }

      function ajustarLimites() {
        if (!geojsonLayer || geojsonLayer.getLayers().length === 0) {
          map.setView([-15.0, -52.0], 4);
          return;
        }
        map.fitBounds(geojsonLayer.getBounds(), {
          padding: [34, 34],
          maxZoom: 16,
          animate: true
        });
      }

      function selecionarTalhao(id) {
        Object.keys(layersById).forEach(function (layerId) {
          var layer = layersById[layerId];
          layer.setStyle(getEstilo(layer.feature, false));
        });

        SELECTED_ID = id || null;
        if (id && layersById[id]) {
          var selectedLayer = layersById[id];
          selectedLayer.setStyle(getEstilo(selectedLayer.feature, true));
          selectedLayer.bringToFront();
          map.panTo(selectedLayer.getBounds().getCenter(), { animate: true, duration: 0.45 });
        }
      }

      window.selecionarTalhao = selecionarTalhao;
      window.ajustarLimites = ajustarLimites;

      try {
        map = L.map('map', {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
          tap: true,
          zoomSnap: 0.25
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        geojsonLayer = L.geoJSON(GEOJSON, {
          style: function (feature) {
            return getEstilo(feature, SELECTED_ID === feature.properties.id);
          },
          onEachFeature: function (feature, layer) {
            var id = feature.properties.id;
            layersById[id] = layer;

            layer.on('click', function (event) {
              L.DomEvent.stopPropagation(event);
              post('talhaoPress', { id: id });
            });

            try {
              var bounds = layer.getBounds();
              var center = bounds.getCenter();
              var label = feature.properties.talhao || '';
              var labelHtml =
                '<div class="talhao-label-text">' + escapeLabel(label) + '</div>' +
                '<div class="talhao-label-area">' + Number(feature.properties.area_hectares || 0).toFixed(1) + ' ha</div>';
              var icon = L.divIcon({
                className: 'talhao-label',
                html: labelHtml,
                iconSize: [140, 38],
                iconAnchor: [70, 19],
              });
              labelsById[id] = L.marker(center, { icon: icon, interactive: false }).addTo(map);
            } catch (err) {}
          }
        }).addTo(map);

        if (geojsonLayer.getLayers().length > 0) {
          ajustarLimites();
        } else {
          map.setView([-15.0, -52.0], 4);
        }

        if (SELECTED_ID) {
          selecionarTalhao(SELECTED_ID);
        }

        map.on('click', function () {
          post('mapaPress');
        });

        function handleMensagem(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.tipo === 'selecionarTalhao') {
              selecionarTalhao(data.id);
            }
            if (data.tipo === 'ajustarLimites') {
              ajustarLimites();
            }
          } catch (err) {}
        }

        document.addEventListener('message', handleMensagem);
        window.addEventListener('message', handleMensagem);
        setTimeout(function () {
          map.invalidateSize(false);
          ajustarLimites();
          post('ready');
        }, 180);
      } catch (err) {
        post('erro_mapa', { motivo: String(err && err.message ? err.message : err) });
      }
    })();
  </script>
</body>
</html>`;
}

function FallbackShapeMap({
  talhoes,
  talhaoSelecionadoId,
  onTalhaoPress,
}: {
  talhoes: TalhaoMapa[];
  talhaoSelecionadoId?: string | null;
  onTalhaoPress?: (id: string) => void;
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const svgTalhoes = useMemo(
    () => buildSvgTalhoes(talhoes, layout.width, layout.height),
    [talhoes, layout.width, layout.height]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  return (
    <View style={styles.fallbackContainer} onLayout={handleLayout}>
      {layout.width > 0 && layout.height > 0 && (
        <Svg width={layout.width} height={layout.height}>
          <Rect x={0} y={0} width={layout.width} height={layout.height} fill="#111827" />
          {svgTalhoes.map((talhao) => {
            const selected = talhaoSelecionadoId === talhao.id;
            const cor = normalizeHexColor(talhao.cor);

            return (
              <G key={talhao.id} onPress={() => onTalhaoPress?.(talhao.id)}>
                {talhao.svgPolygons.map((svgPoints, index) => (
                  <SvgPolygon
                    key={`${talhao.id}-${index}`}
                    points={svgPoints}
                    fill={colorWithOpacity(cor, selected ? 0.48 : 0.24)}
                    stroke={selected ? colors.white : cor}
                    strokeWidth={selected ? 3.4 : 2.2}
                    strokeLinejoin="round"
                  />
                ))}
                <SvgText
                  x={talhao.center.x}
                  y={talhao.center.y}
                  fill={colors.white}
                  fontSize={11}
                  fontWeight="700"
                  textAnchor="middle"
                  stroke="rgba(0,0,0,0.9)"
                  strokeWidth={0.8}
                >
                  {shortenTalhaoLabel(talhao.talhao)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

const MapaFazendaView = forwardRef<MapaFazendaViewRef, Props>(
  ({ talhoes, talhaoSelecionadoId, onTalhaoPress, onMapaReady }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mapaPronto, setMapaPronto] = useState(false);
    const [fallbackAtivo, setFallbackAtivo] = useState(false);

    const html = useMemo(
      () => gerarHTMLLeaflet(talhoes || [], talhaoSelecionadoId),
      [talhoes, talhaoSelecionadoId]
    );

    useEffect(() => {
      setMapaPronto(false);
      setFallbackAtivo(false);

      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }

      readyTimeoutRef.current = setTimeout(() => {
        setFallbackAtivo(true);
      }, LEAFLET_READY_TIMEOUT_MS);

      return () => {
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
          readyTimeoutRef.current = null;
        }
      };
    }, [html]);

    useEffect(() => {
      if (fallbackAtivo) {
        onMapaReady?.();
      }
    }, [fallbackAtivo, onMapaReady]);

    useImperativeHandle(ref, () => ({
      selecionarTalhao(id: string | null) {
        webViewRef.current?.injectJavaScript(
          `window.selecionarTalhao && window.selecionarTalhao(${JSON.stringify(id)}); true;`
        );
      },
      ajustarLimites() {
        webViewRef.current?.injectJavaScript(
          `window.ajustarLimites && window.ajustarLimites(); true;`
        );
      },
    }));

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.tipo === 'ready') {
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
              readyTimeoutRef.current = null;
            }
            setMapaPronto(true);
            setFallbackAtivo(false);
            onMapaReady?.();
            return;
          }
          if (data.tipo === 'erro_mapa') {
            setFallbackAtivo(true);
            return;
          }
          if (data.tipo === 'talhaoPress') {
            onTalhaoPress?.(data.id);
          }
        } catch (_) {}
      },
      [onMapaReady, onTalhaoPress]
    );

    if (!talhoes || talhoes.length === 0) {
      return (
        <View style={styles.vazio}>
          <Ionicons name="map-outline" size={48} color={colors.muted} />
          <Text style={styles.vazioTexto}>Sem talhões para exibir</Text>
        </View>
      );
    }

    if (fallbackAtivo) {
      return (
        <FallbackShapeMap
          talhoes={talhoes}
          talhaoSelecionadoId={talhaoSelecionadoId}
          onTalhaoPress={onTalhaoPress}
        />
      );
    }

    return (
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          onError={() => setFallbackAtivo(true)}
          onHttpError={() => setFallbackAtivo(true)}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
        />
        {!mapaPronto && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}
      </View>
    );
  }
);

MapaFazendaView.displayName = 'MapaFazendaView';
export default MapaFazendaView;

const styles = StyleSheet.create({
  webviewContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  webview: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.white,
    fontSize: typography.fontBody,
    marginTop: spacing.xs,
  },
  vazio: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  vazioTexto: {
    color: colors.muted,
    fontSize: typography.fontBody,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
});
