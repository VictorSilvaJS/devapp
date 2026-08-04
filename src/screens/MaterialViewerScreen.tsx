import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import InfoBox from '../components/InfoBox';
import { useToast } from '../components/Toast';
import { Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import {
  MaterialGeoPolygon,
  MaterialViewerDescriptor,
  resolveMaterialFromCatalog,
  resolveMaterialViewerDescriptor,
  resolveMaterialViewerIdentity,
} from '../navigation/materialRouteCompat';
import { MaterialCatalogService } from '../services/MaterialCatalogService';
import { MaterialTecnicoStorageService } from '../services/MaterialTecnicoStorageService';
import { PngStorageService } from '../services/PngStorageService';
import {
  filtrarProdutoresPorAcesso,
  getFazendaId,
  getFazendaIds,
  getMapaFazendaId,
  podeBaixarMapa,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  avaliarDownloadMapa,
  isMapaArquivoUrlUsavel,
} from '../utils/mapaDownloadCompat';
import {
  MATERIAL_IMAGE_DOUBLE_TAP_ZOOM,
  MATERIAL_IMAGE_MAX_ZOOM,
  MATERIAL_IMAGE_MIN_ZOOM,
  MaterialImageOffset,
  clampMaterialImageOffset,
  clampMaterialImageZoom,
  resolveMaterialImageZoomAroundPoint,
} from '../utils/materialImageGestureCompat';
import {
  getMaterialPublicDescription,
  getMaterialPublicTitle,
  getMaterialScopeLabel,
  getMaterialVersionLabel,
} from '../utils/materialPresentationCompat';
import {
  MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE,
  isMaterialTecnicoLocalMapa,
  resolveMaterialTecnicoImageSource,
} from '../utils/materialTecnicoToMapaCompat';
import {
  PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE,
  isPngLocalMapa,
  resolveMapaPngImageSource,
} from '../utils/pngMapToMapaCompat';
import { resolveSelaPrataIFertilidadeAssetSource } from '../assets/mapas/sela-prata-i/2025/fertilidade';
import { border, colors, shadows, spacing, typography } from '../theme';

type LoadState = 'loading' | 'ready' | 'invalid_route' | 'not_found' | 'access_denied' | 'error';

type MetaItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const formatDate = (value: unknown): string => {
  const raw = firstNonEmptyString(value);
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
};

const formatFileSize = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatCategory = (value: unknown): string => {
  const category = firstNonEmptyString(value).toLowerCase();
  if (category === 'fertilidade') return 'Fertilidade';
  if (category === 'correcao') return 'Correção de solo';
  if (category === 'prescricao') return 'Prescrição';
  return firstNonEmptyString(value, 'Material técnico');
};

const formatOrigin = (value: unknown): string => {
  const origin = firstNonEmptyString(value).toLowerCase();
  if (origin === 'arquivo_local') return 'Arquivo local deste aparelho';
  if (origin === 'png_local') return 'Importação PNG local';
  if (origin === 'prescription_zip_local') return 'Importação ZIP local';
  if (origin === 'drive_importado') return 'Acervo demonstrativo importado';
  return firstNonEmptyString(value, 'Catálogo demonstrativo');
};

const sanitizeDownloadName = (material: Record<string, any>, descriptor: MaterialViewerDescriptor) => {
  const original = firstNonEmptyString(
    material?.arquivo_nome_original,
    material?.titulo,
    `material.${descriptor.format}`
  );
  const sanitized = original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || `material.${descriptor.format || 'arquivo'}`;
};

const buildMetaItems = (
  material: Record<string, any>,
  propriedade?: Record<string, any> | null
): MetaItem[] => {
  const propriedadeInfo = getFazendaUiInfo(propriedade);
  const version = getMaterialVersionLabel(material) || `v${firstNonEmptyString(material?.versao, 1)}`;
  const layer = firstNonEmptyString(
    material?.elemento_label,
    material?.camada_label,
    material?.subcategoria
  );

  return [
    { icon: 'home-outline', label: 'Propriedade', value: propriedadeInfo.fazendaNome },
    { icon: 'folder-open-outline', label: 'Categoria', value: formatCategory(material?.categoria) },
    { icon: 'calendar-outline', label: 'Ano', value: firstNonEmptyString(material?.ano) },
    {
      icon: 'leaf-outline',
      label: 'Safra/Safrinha',
      value: firstNonEmptyString(material?.periodo_produtivo_label, material?.safra),
    },
    { icon: 'location-outline', label: 'Escopo', value: getMaterialScopeLabel(material) },
    { icon: 'resize-outline', label: 'Profundidade', value: firstNonEmptyString(material?.profundidade) },
    { icon: 'layers-outline', label: 'Camada', value: layer },
    { icon: 'git-branch-outline', label: 'Versão', value: version },
    { icon: 'archive-outline', label: 'Origem', value: formatOrigin(material?.origem) },
    {
      icon: 'document-attach-outline',
      label: 'Nome original',
      value: firstNonEmptyString(material?.arquivo_nome_original),
    },
    {
      icon: 'document-outline',
      label: 'Formato',
      value: firstNonEmptyString(material?.formato_arquivo).toUpperCase(),
    },
    {
      icon: 'server-outline',
      label: 'Tamanho',
      value: formatFileSize(material?.tamanho_arquivo ?? material?.arquivo_tamanho_bytes),
    },
    {
      icon: 'time-outline',
      label: 'Atualizado em',
      value: formatDate(material?.data_atualizacao ?? material?.atualizado_em ?? material?.data_criacao),
    },
  ].filter((item) => item.value);
};

const addAlpha = (color: string, alpha: string): string =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : `${colors.primary}${alpha}`;

function MaterialGeoLayerView({ polygons }: { polygons: MaterialGeoPolygon[] }) {
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState(polygons[0]?.id ?? '');
  const canvasWidth = Math.max(280, Math.min(760, width - spacing.screen * 2 - spacing.lg * 2));
  const canvasHeight = Math.max(300, Math.min(460, canvasWidth * 0.78));

  const projected = useMemo(() => {
    const points = polygons.flatMap((polygon) => polygon.coordinates);
    if (points.length === 0) return [];

    const minLat = Math.min(...points.map((point) => point.latitude));
    const maxLat = Math.max(...points.map((point) => point.latitude));
    const minLng = Math.min(...points.map((point) => point.longitude));
    const maxLng = Math.max(...points.map((point) => point.longitude));
    const padding = 26;
    const lngRange = maxLng - minLng || 0.001;
    const latRange = maxLat - minLat || 0.001;
    const usableWidth = canvasWidth - padding * 2;
    const usableHeight = canvasHeight - padding * 2;
    const scale = Math.min(usableWidth / lngRange, usableHeight / latRange);
    const offsetX = padding + (usableWidth - lngRange * scale) / 2;
    const offsetY = padding + (usableHeight - latRange * scale) / 2;

    return polygons.map((polygon) => {
      const svgPoints = polygon.coordinates.map((point) => ({
        x: offsetX + (point.longitude - minLng) * scale,
        y: offsetY + (maxLat - point.latitude) * scale,
      }));
      const centerX = svgPoints.reduce((sum, point) => sum + point.x, 0) / svgPoints.length;
      const centerY = svgPoints.reduce((sum, point) => sum + point.y, 0) / svgPoints.length;
      return { ...polygon, svgPoints, centerX, centerY };
    });
  }, [canvasHeight, canvasWidth, polygons]);

  const selected = polygons.find((polygon) => polygon.id === selectedId) ?? polygons[0];

  return (
    <View>
      <View style={styles.geoCanvas}>
        <Svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
          {projected.map((polygon) => {
            const selectedPolygon = polygon.id === selectedId;
            return (
              <G key={polygon.id} onPress={() => setSelectedId(polygon.id)}>
                <Polygon
                  points={polygon.svgPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill={addAlpha(polygon.color, selectedPolygon ? 'AA' : '66')}
                  stroke={polygon.color}
                  strokeWidth={selectedPolygon ? 4 : 2}
                  strokeLinejoin="round"
                />
                <SvgText
                  x={polygon.centerX}
                  y={polygon.centerY + 4}
                  fill={colors.white}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {polygon.label.slice(0, 12)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {selected ? (
        <View style={styles.layerSelection}>
          <View style={[styles.legendSwatch, { backgroundColor: selected.color }]} />
          <View style={styles.layerSelectionText}>
            <Text style={styles.layerSelectionLabel}>{selected.label}</Text>
            {selected.value ? <Text style={styles.layerSelectionValue}>{selected.value}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.legendGrid} accessibilityLabel="Legenda da camada">
        {polygons.map((polygon) => (
          <TouchableOpacity
            key={`legend:${polygon.id}`}
            style={[styles.legendItem, selectedId === polygon.id && styles.legendItemSelected]}
            onPress={() => setSelectedId(polygon.id)}
          >
            <View style={[styles.legendSwatch, { backgroundColor: polygon.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {polygon.label}{polygon.value ? ` • ${polygon.value}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.viewerHint}>Toque em uma área ou item da legenda para consultar a faixa.</Text>
    </View>
  );
}

function MaterialImageView({
  source,
  title,
  onError,
  onInteractionChange,
}: {
  source: ImageSourcePropType;
  title: string;
  onError: () => void;
  onInteractionChange: (active: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<MaterialImageOffset>({ x: 0, y: 0 });
  const [canPan, setCanPan] = useState(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const pinchStartZoomRef = useRef(1);
  const pinchStartOffsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const pinchFocalRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const panStartOffsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const baseWidth = Math.max(280, Math.min(760, width - spacing.screen * 2 - spacing.lg * 2));
  const viewportHeight = Math.min(600, Math.max(360, baseWidth * 0.92));
  const viewport = useMemo(
    () => ({ width: baseWidth, height: viewportHeight }),
    [baseWidth, viewportHeight]
  );

  const applyTransform = useCallback((
    nextZoom: number,
    nextOffset: MaterialImageOffset
  ) => {
    const safeZoom = clampMaterialImageZoom(nextZoom);
    const safeOffset = clampMaterialImageOffset(nextOffset, safeZoom, viewport);
    zoomRef.current = safeZoom;
    offsetRef.current = safeOffset;
    setZoom(safeZoom);
    setOffset(safeOffset);
  }, [viewport]);

  const applyZoomAroundPoint = useCallback((
    nextZoom: number,
    point: MaterialImageOffset,
    finishInteraction = true
  ) => {
    const safeZoom = clampMaterialImageZoom(nextZoom);
    const nextOffset = resolveMaterialImageZoomAroundPoint({
      startZoom: zoomRef.current,
      nextZoom: safeZoom,
      startOffset: offsetRef.current,
      point,
      viewport,
    });
    applyTransform(safeZoom, nextOffset);
    if (finishInteraction) setCanPan(safeZoom > MATERIAL_IMAGE_MIN_ZOOM);
  }, [applyTransform, viewport]);

  const resetZoom = useCallback(() => {
    applyTransform(MATERIAL_IMAGE_MIN_ZOOM, { x: 0, y: 0 });
    setCanPan(false);
  }, [applyTransform]);

  useEffect(() => {
    resetZoom();
  }, [resetZoom]);

  useEffect(() => () => {
    onInteractionChange(false);
  }, [onInteractionChange]);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .runOnJS(true)
      .onStart((event) => {
        pinchStartZoomRef.current = zoomRef.current;
        pinchStartOffsetRef.current = offsetRef.current;
        pinchFocalRef.current = { x: event.focalX, y: event.focalY };
      })
      .onUpdate((event) => {
        const nextZoom = clampMaterialImageZoom(pinchStartZoomRef.current * event.scale);
        const nextOffset = resolveMaterialImageZoomAroundPoint({
          startZoom: pinchStartZoomRef.current,
          nextZoom,
          startOffset: pinchStartOffsetRef.current,
          point: pinchFocalRef.current,
          viewport,
        });
        applyTransform(nextZoom, nextOffset);
      })
      .onFinalize(() => {
        setCanPan(zoomRef.current > MATERIAL_IMAGE_MIN_ZOOM);
      }),
    [applyTransform, viewport]
  );

  const panGesture = useMemo(
    () => Gesture.Pan()
      .enabled(canPan)
      .maxPointers(1)
      .runOnJS(true)
      .onStart(() => {
        panStartOffsetRef.current = offsetRef.current;
      })
      .onUpdate((event) => {
        applyTransform(zoomRef.current, {
          x: panStartOffsetRef.current.x + event.translationX,
          y: panStartOffsetRef.current.y + event.translationY,
        });
      }),
    [applyTransform, canPan]
  );

  const doubleTapGesture = useMemo(
    () => Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(300)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (!success) return;
        if (zoomRef.current > MATERIAL_IMAGE_MIN_ZOOM) {
          resetZoom();
          return;
        }
        applyZoomAroundPoint(
          MATERIAL_IMAGE_DOUBLE_TAP_ZOOM,
          { x: event.x, y: event.y }
        );
      }),
    [applyZoomAroundPoint, resetZoom]
  );

  const imageGesture = useMemo(
    () => Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(pinchGesture, panGesture)
    ),
    [doubleTapGesture, panGesture, pinchGesture]
  );

  const viewportCenter = useMemo(
    () => ({ x: viewport.width / 2, y: viewport.height / 2 }),
    [viewport]
  );

  return (
    <View>
      <View style={styles.zoomToolbar}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => applyZoomAroundPoint(
            Number((zoomRef.current - 0.5).toFixed(1)),
            viewportCenter
          )}
          disabled={zoom <= MATERIAL_IMAGE_MIN_ZOOM}
          accessibilityLabel="Diminuir imagem"
        >
          <Ionicons
            name="remove-outline"
            size={22}
            color={zoom <= MATERIAL_IMAGE_MIN_ZOOM ? colors.disabledText : colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => applyZoomAroundPoint(
            Number((zoomRef.current + 0.5).toFixed(1)),
            viewportCenter
          )}
          disabled={zoom >= MATERIAL_IMAGE_MAX_ZOOM}
          accessibilityLabel="Ampliar imagem"
        >
          <Ionicons
            name="add-outline"
            size={22}
            color={zoom >= MATERIAL_IMAGE_MAX_ZOOM ? colors.disabledText : colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.resetZoomButton}
          onPress={resetZoom}
          accessibilityLabel="Redefinir ampliação"
        >
          <Ionicons name="scan-outline" size={18} color={colors.primary} />
          <Text style={styles.resetZoomText}>Redefinir</Text>
        </TouchableOpacity>
      </View>
      <GestureDetector gesture={imageGesture}>
        <View
          style={[styles.imageViewport, { width: baseWidth, height: viewportHeight }]}
          accessibilityLabel={`Visualizador da imagem ${title}`}
          accessibilityHint="Use pinça ou toque duas vezes para ampliar. Os botões também controlam a ampliação."
          onTouchStart={() => onInteractionChange(true)}
          onTouchEnd={(event) => onInteractionChange(event.nativeEvent.touches.length > 0)}
          onTouchCancel={() => onInteractionChange(false)}
        >
          <View
            style={[
              styles.zoomImageTranslation,
              { transform: [{ translateX: offset.x }, { translateY: offset.y }] },
            ]}
          >
            <Image
              source={source}
              accessibilityLabel={`Imagem do material ${title}`}
              style={[
                styles.zoomImage,
                { width: baseWidth, height: viewportHeight, transform: [{ scale: zoom }] },
              ]}
              resizeMode="contain"
              onError={onError}
            />
          </View>
        </View>
      </GestureDetector>
      <Text style={styles.viewerHint}>
        Use pinça ou toque duas vezes para ampliar até 400%. Quando ampliada, arraste a imagem em qualquer direção. Gestos iniciados no quadro não rolam a página.
      </Text>
    </View>
  );
}

export default function MaterialViewerScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const toast = useToast();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [material, setMaterial] = useState<Record<string, any> | null>(null);
  const [propriedade, setPropriedade] = useState<Record<string, any> | null>(null);
  const [fazendasPermitidas, setFazendasPermitidas] = useState<Record<string, any>[]>([]);
  const [imageSource, setImageSource] = useState<ImageSourcePropType | null>(null);
  const [imageError, setImageError] = useState('');
  const [imageTouchActive, setImageTouchActive] = useState(false);
  const [fileActionLoading, setFileActionLoading] = useState(false);

  const identity = useMemo(
    () => resolveMaterialViewerIdentity(route?.params),
    [route?.params]
  );

  useEffect(() => {
    let active = true;

    const loadMaterial = async () => {
      setLoadState('loading');
      setMaterial(null);
      setPropriedade(null);

      if (!identity) {
        setLoadState('invalid_route');
        return;
      }

      try {
        const todasPropriedades = await Produtor.list();
        const permitidas = user ? filtrarProdutoresPorAcesso(todasPropriedades, user) : [];
        const idsPermitidos = getFazendaIds(permitidas);

        if (!active) return;
        setFazendasPermitidas(permitidas);

        if (identity.fazendaId && !idsPermitidos.includes(identity.fazendaId)) {
          setLoadState('access_denied');
          return;
        }

        const catalog = await MaterialCatalogService.consultarMateriais({
          propriedadeIds: idsPermitidos,
          perfil: user?.perfil,
        });
        if (!active) return;

        const resolved = resolveMaterialFromCatalog(catalog.materiais, route?.params);
        if (!resolved) {
          setLoadState('not_found');
          return;
        }

        const materialPropertyId = getMapaFazendaId(resolved);
        const materialProperty = permitidas.find((item) => getFazendaId(item) === materialPropertyId) ?? null;
        if (!materialProperty) {
          setLoadState('access_denied');
          return;
        }

        setMaterial(resolved);
        setPropriedade(materialProperty);
        setLoadState('ready');
      } catch (error) {
        console.error('Erro ao resolver material pela rota:', error);
        if (active) setLoadState('error');
      }
    };

    void loadMaterial();
    return () => {
      active = false;
    };
  }, [identity, route?.params, user]);

  const descriptor = useMemo(
    () => resolveMaterialViewerDescriptor(material),
    [material]
  );

  useEffect(() => {
    let active = true;
    setImageSource(null);
    setImageError('');

    const resolveImage = async () => {
      if (!material || descriptor.kind !== 'image') return;

      try {
        if (isMaterialTecnicoLocalMapa(material)) {
          const result = await resolveMaterialTecnicoImageSource(material, {
            isSafeMaterialTecnicoStorageUri: MaterialTecnicoStorageService.isSafeMaterialTecnicoStorageUri,
            getStoredMaterialTecnicoInfo: MaterialTecnicoStorageService.getStoredMaterialTecnicoInfo,
          });
          if (!active) return;
          if (!result.ok || !result.source) {
            setImageError(result.message || MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE);
            return;
          }
          setImageSource(result.source);
          return;
        }

        if (isPngLocalMapa(material)) {
          const result = await resolveMapaPngImageSource(material, {
            isSafePngStorageUri: PngStorageService.isSafePngStorageUri,
            getStoredPngInfo: PngStorageService.getStoredPngInfo,
          });
          if (!active) return;
          if (!result.ok || !result.source) {
            setImageError(result.message || PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE);
            return;
          }
          setImageSource(result.source);
          return;
        }

        const assetSource = resolveSelaPrataIFertilidadeAssetSource(descriptor.sourceUri);
        if (assetSource) {
          if (active) setImageSource(assetSource);
          return;
        }

        if (descriptor.sourceUri && isMapaArquivoUrlUsavel(descriptor.sourceUri)) {
          if (active) setImageSource({ uri: descriptor.sourceUri });
          return;
        }

        setImageError('O arquivo desta imagem não está disponível para visualização.');
      } catch {
        if (active) setImageError('Não foi possível carregar a imagem deste material.');
      }
    };

    void resolveImage();
    return () => {
      active = false;
    };
  }, [descriptor.kind, descriptor.sourceUri, material]);

  const title = material ? getMaterialPublicTitle(material) : 'Visualizar material';
  const description = material ? getMaterialPublicDescription(material) : '';
  const metaItems = useMemo(
    () => material ? buildMetaItems(material, propriedade) : [],
    [material, propriedade]
  );
  const downloadStatus = useMemo(
    () => avaliarDownloadMapa(material),
    [material]
  );
  const canUseFileAction = Boolean(
    material
    && descriptor.sourceUri
    && !descriptor.sourceUri.startsWith('asset://')
    && downloadStatus.podeAbrir
    && podeBaixarMapa(user, material, fazendasPermitidas)
  );
  const canEmbedPdf = descriptor.kind === 'pdf'
    && Platform.OS === 'ios'
    && Boolean(descriptor.sourceUri && /^(https?:|data:)/i.test(descriptor.sourceUri));

  const handleFileAction = async () => {
    if (!material || !descriptor.sourceUri || !canUseFileAction) {
      toast.showInfo('A ação do arquivo não está disponível para este material e perfil.');
      return;
    }

    setFileActionLoading(true);
    try {
      const isRemote = /^https?:/i.test(descriptor.sourceUri);
      const shouldDownload = isRemote && descriptor.kind !== 'pdf';

      if (shouldDownload) {
        const baseDir = `${FileSystem.documentDirectory ?? ''}materiais-download/`;
        if (!FileSystem.documentDirectory) throw new Error('storage_unavailable');
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
        const destination = `${baseDir}${sanitizeDownloadName(material, descriptor)}`;
        await FileSystem.downloadAsync(descriptor.sourceUri, destination);
        toast.showSuccess('Arquivo baixado para o armazenamento local do aplicativo.');
        return;
      }

      const supported = await Linking.canOpenURL(descriptor.sourceUri);
      if (!supported) throw new Error('viewer_unavailable');
      await Linking.openURL(descriptor.sourceUri);
    } catch {
      toast.showError(
        descriptor.kind === 'pdf'
          ? 'Nenhum visualizador compatível conseguiu abrir este PDF.'
          : 'Não foi possível abrir ou baixar este arquivo.'
      );
    } finally {
      setFileActionLoading(false);
    }
  };

  const renderLoadState = () => {
    if (loadState === 'loading') {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Resolvendo material e versão...</Text>
        </View>
      );
    }

    const state = loadState === 'invalid_route'
      ? {
          icon: 'git-branch-outline' as const,
          title: 'Rota de material incompleta',
          message: 'O identificador e a versão do material são obrigatórios para abrir esta tela.',
        }
      : loadState === 'access_denied'
        ? {
            icon: 'lock-closed-outline' as const,
            title: 'Acesso negado',
            message: 'Este material não pertence a uma Propriedade disponível no seu perfil.',
          }
        : loadState === 'not_found'
          ? {
              icon: 'document-outline' as const,
              title: 'Material não encontrado',
              message: 'A versão solicitada foi removida, substituída ou não está visível para este perfil.',
            }
          : {
              icon: 'alert-circle-outline' as const,
              title: 'Não foi possível carregar',
              message: 'Tente voltar para a lista e abrir o material novamente.',
            };

    return (
      <EmptyState
        icon={state.icon}
        title={state.title}
        message={state.message}
        actionLabel="Voltar aos materiais"
        actionIcon="arrow-back-outline"
        onActionPress={() => navigation.goBack()}
      />
    );
  };

  const renderViewer = () => {
    if (!material) return null;

    if (descriptor.kind === 'geospatial') {
      return (
        <>
          <View style={styles.viewerSectionHeader}>
            <Ionicons name="map-outline" size={22} color={colors.primary} />
            <Text style={styles.viewerSectionTitle}>Camada georreferenciada</Text>
          </View>
          <MaterialGeoLayerView polygons={descriptor.polygons} />
        </>
      );
    }

    if (descriptor.kind === 'image') {
      if (imageError) {
        return <InfoBox variant="error" title="Imagem indisponível" message={imageError} />;
      }
      if (!imageSource) {
        return (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.inlineLoadingText}>Carregando imagem...</Text>
          </View>
        );
      }
      return (
        <>
          <View style={styles.viewerSectionHeader}>
            <Ionicons name="image-outline" size={22} color={colors.primary} />
            <Text style={styles.viewerSectionTitle}>Imagem técnica</Text>
          </View>
          <MaterialImageView
            source={imageSource}
            title={title}
            onError={() => setImageError('Não foi possível renderizar esta imagem.')}
            onInteractionChange={setImageTouchActive}
          />
        </>
      );
    }

    if (descriptor.kind === 'pdf') {
      return (
        <>
          <View style={styles.viewerSectionHeader}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            <Text style={styles.viewerSectionTitle}>Documento PDF</Text>
          </View>
          {canEmbedPdf && descriptor.sourceUri ? (
            <View style={styles.pdfFrame}>
              <WebView
                source={{ uri: descriptor.sourceUri }}
                originWhitelist={['*']}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.pdfLoading}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.inlineLoadingText}>Carregando documento...</Text>
                  </View>
                )}
              />
            </View>
          ) : (
            <InfoBox
              title="Visualização pelo sistema"
              message="Neste aparelho, o PDF será aberto somente por um visualizador compatível instalado. Nenhuma prévia é simulada."
            />
          )}
        </>
      );
    }

    return (
      <>
        <View style={styles.viewerSectionHeader}>
          <Ionicons name={descriptor.format === 'zip' ? 'archive-outline' : 'document-outline'} size={22} color={colors.primary} />
          <Text style={styles.viewerSectionTitle}>
            {descriptor.format === 'zip' ? 'Pacote técnico ZIP' : 'Arquivo técnico'}
          </Text>
        </View>
        <InfoBox
          title="Sem prévia disponível"
          message={descriptor.noPreviewMessage}
        />
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <Header title="Visualizar material" showBack />
      {loadState !== 'ready' ? renderLoadState() : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!imageTouchActive}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons
                name={
                  descriptor.kind === 'geospatial'
                    ? 'map-outline'
                    : descriptor.kind === 'image'
                      ? 'image-outline'
                      : descriptor.kind === 'pdf'
                        ? 'document-text-outline'
                        : 'archive-outline'
                }
                size={30}
                color={colors.primary}
              />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {formatCategory(material?.categoria)} • {descriptor.format.toUpperCase()}
              </Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
          </View>

          <View style={styles.viewerCard}>
            {renderViewer()}
          </View>

          {canUseFileAction ? (
            <TouchableOpacity
              style={[styles.primaryButton, fileActionLoading && styles.buttonDisabled]}
              onPress={handleFileAction}
              disabled={fileActionLoading}
              accessibilityRole="button"
              accessibilityLabel={descriptor.primaryActionLabel}
            >
              {fileActionLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons
                  name={descriptor.kind === 'pdf' ? 'open-outline' : 'download-outline'}
                  size={21}
                  color={colors.white}
                />
              )}
              <Text style={styles.primaryButtonText}>{descriptor.primaryActionLabel}</Text>
            </TouchableOpacity>
          ) : descriptor.sourceUri?.startsWith('asset://') ? (
            <InfoBox
              variant="success"
              title="Disponível no aplicativo"
              message="Este material faz parte do acervo demonstrativo instalado e não exige download."
            />
          ) : (
            <InfoBox
              variant="warning"
              title="Ação de arquivo indisponível"
              message="O arquivo não está liberado, não possui referência abrível ou este perfil não tem autorização para baixá-lo."
            />
          )}

          <View style={styles.metadataCard}>
            <View style={styles.viewerSectionHeader}>
              <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.viewerSectionTitle}>Metadados do material</Text>
            </View>
            <View style={styles.metaGrid}>
              {metaItems.map((item) => (
                <View key={item.label} style={styles.metaItem}>
                  <Ionicons name={item.icon} size={17} color={colors.primary} />
                  <View style={styles.metaText}>
                    <Text style={styles.metaLabel}>{item.label}</Text>
                    <Text style={styles.metaValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 3,
    gap: spacing.lg,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textLight,
    fontSize: typography.fontBody,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: border.radiusLg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: border.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    lineHeight: 26,
  },
  subtitle: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    marginTop: spacing.xs,
  },
  description: {
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  viewerCard: {
    borderRadius: border.radiusLg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  viewerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  viewerSectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  geoCanvas: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: border.radius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  layerSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: border.radius,
    backgroundColor: colors.primaryLight,
  },
  layerSelectionText: {
    flex: 1,
  },
  layerSelectionLabel: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  layerSelectionValue: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendItem: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: border.radiusSm,
    backgroundColor: colors.card,
  },
  legendItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
  viewerHint: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  zoomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: border.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  zoomValue: {
    minWidth: 54,
    color: colors.text,
    textAlign: 'center',
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  resetZoomButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: border.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  resetZoomText: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
  },
  imageViewport: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: border.radius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.black,
  },
  zoomImageTranslation: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    backgroundColor: colors.black,
  },
  inlineLoading: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inlineLoadingText: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
  },
  pdfFrame: {
    height: 560,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: border.radius,
    backgroundColor: colors.backgroundAlt,
  },
  pdfLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAlt,
  },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: border.radius,
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  metadataCard: {
    borderRadius: border.radiusLg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaItem: {
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: border.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightMedium,
    marginTop: 2,
  },
});
