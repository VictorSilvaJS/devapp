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
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle as SvgCircle,
  G,
  Polygon as SvgPolygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { colors, spacing, typography } from '../theme';
import type { ForegroundUserLocation } from '../services/LocationForegroundService';
import {
  classifyMapaWebViewFailure,
  type MapaWebViewDiagnostic,
  type MapaWebViewFailureInput,
} from '../utils/mapaWebViewCompat';
import { buildLocationMapProjection } from '../utils/locationMapProjectionCompat';
import { formatAreaHa } from '../utils/talhaoMedidasCompat';

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
  centralizarTalhao: (id: string) => void;
  centralizarLocalizacao: (location: ForegroundUserLocation) => void;
  ajustarLimites: () => void;
  recalcularDimensoes: () => void;
}

interface Props {
  talhoes: TalhaoMapa[];
  talhaoSelecionadoId?: string | null;
  userLocation?: ForegroundUserLocation | null;
  onTalhaoPress?: (id: string) => void;
  onMapaReady?: () => void;
  centerUserLocationOnReady?: boolean;
  noticeTopInset?: number;
}

type SvgTalhao = TalhaoMapa & {
  svgPolygons: string[];
  center: { x: number; y: number };
};

const LEAFLET_READY_TIMEOUT_MS = 6500;
const LOCATION_READY_RETRY_MS = 420;
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

function buildSvgProjection(
  talhoes: TalhaoMapa[],
  userLocation: ForegroundUserLocation | null | undefined,
  width: number,
  height: number
): {
  talhoes: SvgTalhao[];
  location: ReturnType<typeof buildLocationMapProjection>['location'];
} {
  const validTalhoes = talhoes.filter((talhao) => getTalhaoPoligonos(talhao).length > 0);
  const projection = buildLocationMapProjection({
    shapes: validTalhoes.map((talhao) => ({
      id: talhao.id,
      polygons: getTalhaoPoligonos(talhao),
    })),
    location: userLocation,
    width,
    height,
    padding: SVG_PADDING,
  });
  const talhaoById = new Map(validTalhoes.map((talhao) => [talhao.id, talhao]));

  return {
    talhoes: projection.shapes.flatMap((shape) => {
      const talhao = talhaoById.get(shape.id);
      if (!talhao) return [];

      return [{
        ...talhao,
        svgPolygons: shape.polygons.map((points) => points
          .map((point) => `${point.x},${point.y}`)
          .join(' ')),
        center: shape.center,
      }];
    }),
    location: projection.location,
  };
}

function gerarHTMLLeaflet(talhoes: TalhaoMapa[]): string {
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
        area_formatada: formatAreaHa(talhao.area_hectares),
        cor: normalizeHexColor(talhao.cor),
        cultura_atual: talhao.cultura_atual || '',
        textura: talhao.textura || '',
        tipo_solo: talhao.tipo_solo || '',
        safra: talhao.safra || '',
        nome: talhao.nome || '',
      },
    }));

  const geojsonStr = JSON.stringify({ type: 'FeatureCollection', features });
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
    .leaflet-control-zoom { display: none !important; }
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
      var SELECTED_ID = null;
      var layersById = {};
      var labelsById = {};
      var geojsonLayer = null;
      var map = null;
      var userLocationMarker = null;
      var userLocationAccuracyCircle = null;
      var baseMapLayer = null;
      var baseMapLoadedTiles = 0;
      var baseMapFailedTiles = 0;
      var baseMapConsecutiveFailures = 0;
      var baseMapTimeout = null;
      var baseMapStatus = 'idle';
      var labelMinZoom = 15.5;

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
        var bounds = geojsonLayer.getBounds();
        try {
          labelMinZoom = Math.min(15.5, Math.max(10, map.getBoundsZoom(bounds, false, [68, 68]) - 0.25));
        } catch (err) {}
        map.fitBounds(bounds, {
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
        }

        atualizarVisibilidadeRotulos();
        trazerLocalizacaoUsuarioParaFrente();
      }

      function centralizarTalhao(id) {
        if (!id || !layersById[id]) {
          return false;
        }
        map.panTo(layersById[id].getBounds().getCenter(), { animate: true, duration: 0.45 });
        return true;
      }

      function atualizarVisibilidadeRotulos() {
        var mostrarTodos = map && map.getZoom() >= labelMinZoom;
        Object.keys(labelsById).forEach(function (id) {
          labelsById[id].setOpacity(mostrarTodos || SELECTED_ID === id ? 1 : 0);
        });
      }

      function isFiniteNumber(value) {
        return typeof value === 'number' && isFinite(value);
      }

      function normalizarLocalizacaoUsuario(payload) {
        if (!payload || typeof payload !== 'object') {
          return null;
        }

        var latitude = Number(payload.latitude);
        var longitude = Number(payload.longitude);
        var accuracy = payload.accuracy == null ? null : Number(payload.accuracy);

        if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
          return null;
        }
        if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
          return null;
        }
        if (accuracy != null && (!isFiniteNumber(accuracy) || accuracy < 0)) {
          accuracy = null;
        }

        return {
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy,
        };
      }

      function removerLocalizacaoUsuario() {
        if (userLocationMarker) {
          map.removeLayer(userLocationMarker);
          userLocationMarker = null;
        }
        if (userLocationAccuracyCircle) {
          map.removeLayer(userLocationAccuracyCircle);
          userLocationAccuracyCircle = null;
        }
      }

      function trazerLocalizacaoUsuarioParaFrente() {
        if (userLocationAccuracyCircle && userLocationAccuracyCircle.bringToBack) {
          userLocationAccuracyCircle.bringToBack();
        }
        if (userLocationMarker && userLocationMarker.bringToFront) {
          userLocationMarker.bringToFront();
        }
      }

      function atualizarLocalizacaoUsuario(payload) {
        if (!payload) {
          removerLocalizacaoUsuario();
          return false;
        }

        var localizacao = normalizarLocalizacaoUsuario(payload);
        if (!localizacao) {
          return false;
        }

        var latLng = [localizacao.latitude, localizacao.longitude];

        if (localizacao.accuracy != null) {
          if (!userLocationAccuracyCircle) {
            userLocationAccuracyCircle = L.circle(latLng, {
              radius: localizacao.accuracy,
              pane: 'user-location-pane',
              color: '#2563EB',
              weight: 1.5,
              opacity: 0.9,
              fillColor: '#3B82F6',
              fillOpacity: 0.16,
              interactive: false
            }).addTo(map);
          } else {
            userLocationAccuracyCircle.setLatLng(latLng);
            userLocationAccuracyCircle.setRadius(localizacao.accuracy);
          }
        } else if (userLocationAccuracyCircle) {
          map.removeLayer(userLocationAccuracyCircle);
          userLocationAccuracyCircle = null;
        }

        if (!userLocationMarker) {
          userLocationMarker = L.circleMarker(latLng, {
            radius: 8,
            pane: 'user-location-pane',
            color: '#FFFFFF',
            weight: 3,
            opacity: 1,
            fillColor: '#2563EB',
            fillOpacity: 1,
            interactive: false
          }).addTo(map);
        } else {
          userLocationMarker.setLatLng(latLng);
        }

        trazerLocalizacaoUsuarioParaFrente();
        map.invalidateSize(false);
        return true;
      }

      function centralizarLocalizacaoUsuario(payload) {
        var localizacao = normalizarLocalizacaoUsuario(payload);
        if (!localizacao) {
          return false;
        }
        atualizarLocalizacaoUsuario(localizacao);
        var latLng = [localizacao.latitude, localizacao.longitude];
        if (map.stop) {
          map.stop();
        }
        map.setView(latLng, Math.max(map.getZoom(), 16), { animate: false });
        return true;
      }

      function recalcularDimensoes() {
        if (!map) return;
        map.invalidateSize(false);
      }

      function informarStatusMapaBase(status, motivo) {
        if (baseMapStatus === status && status !== 'loading') {
          return;
        }
        baseMapStatus = status;
        post('mapa_base_status', { status: status, motivo: motivo || null });
      }

      function limparTimeoutMapaBase() {
        if (baseMapTimeout) {
          clearTimeout(baseMapTimeout);
          baseMapTimeout = null;
        }
      }

      function carregarMapaBase() {
        if (!map) return false;

        limparTimeoutMapaBase();
        if (baseMapLayer) {
          map.removeLayer(baseMapLayer);
        }

        baseMapLoadedTiles = 0;
        baseMapFailedTiles = 0;
        baseMapConsecutiveFailures = 0;
        informarStatusMapaBase('loading', 'retry');

        baseMapLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        });

        baseMapLayer.on('tileload', function () {
          baseMapLoadedTiles += 1;
          baseMapConsecutiveFailures = 0;
          limparTimeoutMapaBase();
          informarStatusMapaBase('available', 'tile_loaded');
        });

        baseMapLayer.on('tileerror', function () {
          baseMapFailedTiles += 1;
          baseMapConsecutiveFailures += 1;
          if (
            (baseMapLoadedTiles === 0 && baseMapFailedTiles >= 2)
            || baseMapConsecutiveFailures >= 3
          ) {
            informarStatusMapaBase('unavailable', 'tile_error');
          }
        });

        baseMapLayer.addTo(map);
        baseMapTimeout = setTimeout(function () {
          baseMapTimeout = null;
          if (baseMapLoadedTiles === 0) {
            informarStatusMapaBase('unavailable', 'tile_timeout');
          }
        }, 4500);
        return true;
      }

      window.selecionarTalhao = selecionarTalhao;
      window.centralizarTalhao = centralizarTalhao;
      window.ajustarLimites = ajustarLimites;
      window.atualizarLocalizacaoUsuario = atualizarLocalizacaoUsuario;
      window.centralizarLocalizacaoUsuario = centralizarLocalizacaoUsuario;
      window.recalcularDimensoes = recalcularDimensoes;
      window.recarregarMapaBase = carregarMapaBase;

      try {
        map = L.map('map', {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
          tap: true,
          zoomSnap: 0.25
        });

        var userLocationPane = map.createPane('user-location-pane');
        userLocationPane.style.zIndex = 720;
        userLocationPane.style.pointerEvents = 'none';

        carregarMapaBase();

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
                '<div class="talhao-label-area">' + escapeLabel(feature.properties.area_formatada || 'Não informado') + '</div>';
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

        atualizarVisibilidadeRotulos();
        map.on('zoomend', atualizarVisibilidadeRotulos);

        map.on('click', function () {
          post('mapaPress');
        });

        function handleMensagem(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.tipo === 'selecionarTalhao') {
              selecionarTalhao(data.id);
            }
            if (data.tipo === 'centralizarTalhao') {
              centralizarTalhao(data.id);
            }
            if (data.tipo === 'ajustarLimites') {
              ajustarLimites();
            }
            if (data.tipo === 'atualizarLocalizacaoUsuario') {
              atualizarLocalizacaoUsuario(data.payload);
            }
            if (data.tipo === 'centralizarLocalizacaoUsuario') {
              centralizarLocalizacaoUsuario(data.payload);
            }
            if (data.tipo === 'recalcularDimensoes') {
              recalcularDimensoes();
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
  userLocation,
  onTalhaoPress,
}: {
  talhoes: TalhaoMapa[];
  talhaoSelecionadoId?: string | null;
  userLocation?: ForegroundUserLocation | null;
  onTalhaoPress?: (id: string) => void;
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const projection = useMemo(
    () => buildSvgProjection(talhoes, userLocation, layout.width, layout.height),
    [talhoes, userLocation, layout.width, layout.height]
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
          {projection.talhoes.map((talhao) => {
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
          {projection.location?.accuracyRadius != null ? (
            <SvgCircle
              cx={projection.location.x}
              cy={projection.location.y}
              r={projection.location.accuracyRadius}
              fill="rgba(59,130,246,0.20)"
              stroke="#60A5FA"
              strokeWidth={2}
            />
          ) : null}
          {projection.location ? (
            <>
              <SvgCircle
                cx={projection.location.x}
                cy={projection.location.y}
                r={10}
                fill={colors.white}
              />
              <SvgCircle
                cx={projection.location.x}
                cy={projection.location.y}
                r={6.5}
                fill="#2563EB"
                stroke="#93C5FD"
                strokeWidth={1.5}
              />
            </>
          ) : null}
        </Svg>
      )}
      {projection.location ? (
        <View style={styles.fallbackLocationBadge}>
          <Ionicons name="location" size={15} color="#93C5FD" />
          <Text style={styles.fallbackLocationBadgeText}>
            Posição marcada
            {userLocation?.accuracy != null ? ` · precisão ${Math.round(userLocation.accuracy)} m` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const MapaFazendaView = forwardRef<MapaFazendaViewRef, Props>(
  ({
    talhoes,
    talhaoSelecionadoId,
    userLocation,
    onTalhaoPress,
    onMapaReady,
    centerUserLocationOnReady = false,
    noticeTopInset = spacing.md,
  }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const locationSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const locationCenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userLocationRef = useRef<ForegroundUserLocation | null | undefined>(userLocation);
    const onMapaReadyRef = useRef(onMapaReady);
    const mapaReadyNotificadoRef = useRef(false);
    const mapaProntoRef = useRef(false);
    const pendingLocationCenterRef = useRef<ForegroundUserLocation | null>(null);
    const ultimoDiagnosticoRef = useRef<string | null>(null);
    const [mapaPronto, setMapaPronto] = useState(false);
    const [fallbackAtivo, setFallbackAtivo] = useState(false);
    const [diagnostico, setDiagnostico] = useState<MapaWebViewDiagnostic | null>(null);
    userLocationRef.current = userLocation;
    onMapaReadyRef.current = onMapaReady;

    const html = useMemo(
      () => gerarHTMLLeaflet(talhoes || []),
      [talhoes]
    );
    const webViewSource = useMemo(() => ({ html }), [html]);

    const clearReadyTimeout = useCallback(() => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    }, []);

    const notifyMapaReady = useCallback(() => {
      if (mapaReadyNotificadoRef.current) return;
      mapaReadyNotificadoRef.current = true;
      onMapaReadyRef.current?.();
    }, []);

    const reportFailure = useCallback((input: MapaWebViewFailureInput) => {
      const nextDiagnostic = classifyMapaWebViewFailure(input);
      const diagnosticKey = JSON.stringify(nextDiagnostic.technical);

      if (ultimoDiagnosticoRef.current !== diagnosticKey) {
        ultimoDiagnosticoRef.current = diagnosticKey;
        console.warn('[MapaWebView]', {
          kind: nextDiagnostic.kind,
          scope: nextDiagnostic.scope,
          fallbackMode: nextDiagnostic.fallbackMode,
          ...nextDiagnostic.technical,
        });
      }

      setDiagnostico((current) => (
        current?.fallbackMode === 'vector' && nextDiagnostic.fallbackMode === 'base-only'
          ? current
          : nextDiagnostic
      ));
      if (nextDiagnostic.fallbackMode === 'vector') {
        clearReadyTimeout();
        setMapaPronto(false);
        mapaProntoRef.current = false;
        setFallbackAtivo(true);
        notifyMapaReady();
      }
    }, [clearReadyTimeout, notifyMapaReady]);

    const armReadyTimeout = useCallback(() => {
      clearReadyTimeout();
      readyTimeoutRef.current = setTimeout(() => {
        reportFailure({
          source: 'ready-timeout',
          reason: 'leaflet_ready_timeout',
        });
      }, LEAFLET_READY_TIMEOUT_MS);
    }, [clearReadyTimeout, reportFailure]);

    useEffect(() => {
      setMapaPronto(false);
      mapaProntoRef.current = false;
      setFallbackAtivo(false);
      setDiagnostico(null);
      ultimoDiagnosticoRef.current = null;
      mapaReadyNotificadoRef.current = false;

      if (locationSyncTimeoutRef.current) {
        clearTimeout(locationSyncTimeoutRef.current);
        locationSyncTimeoutRef.current = null;
      }
      if (locationCenterTimeoutRef.current) {
        clearTimeout(locationCenterTimeoutRef.current);
        locationCenterTimeoutRef.current = null;
      }

      armReadyTimeout();

      return () => {
        clearReadyTimeout();
        if (locationSyncTimeoutRef.current) {
          clearTimeout(locationSyncTimeoutRef.current);
          locationSyncTimeoutRef.current = null;
        }
        if (locationCenterTimeoutRef.current) {
          clearTimeout(locationCenterTimeoutRef.current);
          locationCenterTimeoutRef.current = null;
        }
      };
    }, [armReadyTimeout, clearReadyTimeout, html]);

    const syncUserLocationToWebView = useCallback(() => {
      const currentLocation = userLocationRef.current;
      const payload = currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: currentLocation.accuracy,
            capturedAt: currentLocation.capturedAt,
          }
        : null;

      webViewRef.current?.injectJavaScript(
        `window.atualizarLocalizacaoUsuario && window.atualizarLocalizacaoUsuario(${JSON.stringify(payload)}); true;`
      );
    }, []);

    const centerLocationInWebView = useCallback((location: ForegroundUserLocation) => {
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        capturedAt: location.capturedAt,
      };
      webViewRef.current?.injectJavaScript(
        `window.centralizarLocalizacaoUsuario && window.centralizarLocalizacaoUsuario(${JSON.stringify(payload)}); true;`
      );
    }, []);

    useEffect(() => {
      if (!mapaPronto || fallbackAtivo) {
        return;
      }

      syncUserLocationToWebView();
      if (locationSyncTimeoutRef.current) {
        clearTimeout(locationSyncTimeoutRef.current);
      }
      locationSyncTimeoutRef.current = setTimeout(() => {
        syncUserLocationToWebView();
        locationSyncTimeoutRef.current = null;
      }, LOCATION_READY_RETRY_MS);

      return () => {
        if (locationSyncTimeoutRef.current) {
          clearTimeout(locationSyncTimeoutRef.current);
          locationSyncTimeoutRef.current = null;
        }
      };
    }, [fallbackAtivo, mapaPronto, syncUserLocationToWebView, userLocation]);

    useEffect(() => {
      if (!mapaPronto || fallbackAtivo) {
        return;
      }

      webViewRef.current?.injectJavaScript(
        `window.selecionarTalhao && window.selecionarTalhao(${JSON.stringify(talhaoSelecionadoId || null)}); true;`
      );
    }, [fallbackAtivo, mapaPronto, talhaoSelecionadoId]);

    useImperativeHandle(ref, () => ({
      selecionarTalhao(id: string | null) {
        webViewRef.current?.injectJavaScript(
          `window.selecionarTalhao && window.selecionarTalhao(${JSON.stringify(id)}); true;`
        );
      },
      centralizarTalhao(id: string) {
        webViewRef.current?.injectJavaScript(
          `window.centralizarTalhao && window.centralizarTalhao(${JSON.stringify(id)}); true;`
        );
      },
      centralizarLocalizacao(location: ForegroundUserLocation) {
        if (!mapaProntoRef.current || fallbackAtivo) {
          pendingLocationCenterRef.current = location;
          return;
        }
        pendingLocationCenterRef.current = null;
        centerLocationInWebView(location);
      },
      ajustarLimites() {
        webViewRef.current?.injectJavaScript(
          `window.ajustarLimites && window.ajustarLimites(); true;`
        );
      },
      recalcularDimensoes() {
        webViewRef.current?.injectJavaScript(
          'window.recalcularDimensoes && window.recalcularDimensoes(); true;'
        );
      },
    }));

    const handleMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.tipo === 'ready') {
            clearReadyTimeout();
            setMapaPronto(true);
            mapaProntoRef.current = true;
            setFallbackAtivo(false);
            setDiagnostico((current) => (
              current?.fallbackMode === 'vector' ? null : current
            ));
            notifyMapaReady();
            syncUserLocationToWebView();
            const locationToCenter = pendingLocationCenterRef.current
              ?? (centerUserLocationOnReady ? userLocationRef.current : null);
            if (locationToCenter) {
              pendingLocationCenterRef.current = null;
              centerLocationInWebView(locationToCenter);
              if (locationCenterTimeoutRef.current) {
                clearTimeout(locationCenterTimeoutRef.current);
              }
              locationCenterTimeoutRef.current = setTimeout(() => {
                centerLocationInWebView(locationToCenter);
                locationCenterTimeoutRef.current = null;
              }, LOCATION_READY_RETRY_MS);
            }
            return;
          }
          if (data.tipo === 'erro_mapa') {
            reportFailure({
              source: 'leaflet',
              reason: data.motivo || 'leaflet_error',
            });
            return;
          }
          if (data.tipo === 'mapa_base_status') {
            if (data.status === 'available') {
              setDiagnostico((current) => {
                if (current?.fallbackMode !== 'base-only') return current;
                ultimoDiagnosticoRef.current = null;
                return null;
              });
            }
            if (data.status === 'unavailable') {
              reportFailure({
                source: 'tile-layer',
                url: 'https://tile.openstreetmap.org/',
                reason: data.motivo || 'tile_error',
              });
            }
            return;
          }
          if (data.tipo === 'talhaoPress') {
            onTalhaoPress?.(data.id);
          }
        } catch (_) {}
      },
      [
        centerLocationInWebView,
        centerUserLocationOnReady,
        clearReadyTimeout,
        notifyMapaReady,
        onTalhaoPress,
        reportFailure,
        syncUserLocationToWebView,
      ]
    );

    const handleWebViewError = useCallback((event: WebViewErrorEvent) => {
      event.preventDefault();
      reportFailure({
        source: 'main-frame',
        url: event.nativeEvent.url,
        code: event.nativeEvent.code,
        description: event.nativeEvent.description,
      });
    }, [reportFailure]);

    const handleSubResourceError = useCallback((event: WebViewErrorEvent) => {
      reportFailure({
        source: 'subresource',
        url: event.nativeEvent.url,
        code: event.nativeEvent.code,
        description: event.nativeEvent.description,
      });
    }, [reportFailure]);

    const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
      reportFailure({
        source: 'http',
        url: event.nativeEvent.url,
        statusCode: event.nativeEvent.statusCode,
        description: event.nativeEvent.description,
      });
    }, [reportFailure]);

    const handleRenderProcessGone = useCallback((event: WebViewRenderProcessGoneEvent) => {
      reportFailure({
        source: 'render-process',
        reason: event.nativeEvent.didCrash ? 'android_webview_crash' : 'android_webview_killed',
      });
    }, [reportFailure]);

    const handleContentProcessTerminated = useCallback((event: WebViewTerminatedEvent) => {
      reportFailure({
        source: 'render-process',
        url: event.nativeEvent.url,
        reason: 'ios_webview_terminated',
      });
    }, [reportFailure]);

    const retryMap = useCallback(() => {
      ultimoDiagnosticoRef.current = null;
      setDiagnostico(null);

      if (fallbackAtivo) {
        setMapaPronto(false);
        setFallbackAtivo(false);
        armReadyTimeout();
        webViewRef.current?.reload();
        return;
      }

      webViewRef.current?.injectJavaScript(
        'window.recarregarMapaBase && window.recarregarMapaBase(); true;'
      );
    }, [armReadyTimeout, fallbackAtivo]);

    if ((!talhoes || talhoes.length === 0) && !userLocation) {
      return (
        <View style={styles.vazio}>
          <Ionicons name="map-outline" size={48} color={colors.muted} />
          <Text style={styles.vazioTexto}>Sem talhões para exibir</Text>
        </View>
      );
    }

    if (!talhoes || talhoes.length === 0) {
      return <FallbackShapeMap talhoes={[]} userLocation={userLocation} />;
    }

    return (
      <View
        style={styles.webviewContainer}
        onLayout={() => {
          if (mapaPronto) {
            webViewRef.current?.injectJavaScript(
              'window.recalcularDimensoes && window.recalcularDimensoes(); true;'
            );
          }
        }}
      >
        <WebView
          ref={webViewRef}
          source={webViewSource}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          onError={handleWebViewError}
          onLoadSubResourceError={handleSubResourceError}
          onHttpError={handleHttpError}
          onRenderProcessGone={handleRenderProcessGone}
          onContentProcessDidTerminate={handleContentProcessTerminated}
          cacheEnabled
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="never"
        />
        {fallbackAtivo ? (
          <View testID="mapa-fallback-overlay" style={styles.fallbackOverlay}>
            <FallbackShapeMap
              talhoes={talhoes}
              talhaoSelecionadoId={talhaoSelecionadoId}
              userLocation={userLocation}
              onTalhaoPress={onTalhaoPress}
            />
          </View>
        ) : null}
        {!mapaPronto && !fallbackAtivo && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}
        {diagnostico ? (
          <View
            testID="mapa-network-notice"
            accessibilityLiveRegion="polite"
            style={[styles.networkNotice, { top: noticeTopInset }]}
          >
            <Ionicons
              name={diagnostico.kind === 'ssl' ? 'shield-outline' : 'cloud-offline-outline'}
              size={20}
              color="#FCD34D"
            />
            <Text style={styles.networkNoticeText}>{diagnostico.userMessage}</Text>
            <Pressable
              testID="mapa-retry-button"
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar o mapa novamente"
              onPress={retryMap}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.retryButtonPressed : null,
              ]}
            >
              <Ionicons name="refresh" size={16} color={colors.white} />
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
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
    ...StyleSheet.absoluteFill,
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
  fallbackOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
  },
  networkNotice: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.72)',
    backgroundColor: 'rgba(17,24,39,0.96)',
  },
  networkNoticeText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    lineHeight: 17,
  },
  retryButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  retryButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
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
  fallbackLocationBadge: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.68)',
    backgroundColor: 'rgba(0,0,0,0.74)',
  },
  fallbackLocationBadgeText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
});
