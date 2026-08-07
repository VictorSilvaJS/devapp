import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { exportFileToPhone } from '../services/PhoneFileExportService';
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
  RegistroFotoOrigem,
  buildRegistroFotoDownloadName,
  isRegistroFotoUriBaixavel,
} from '../utils/registroFotoCompat';
import { colors, spacing, typography } from '../theme';

type RegistroFotoViewerModalProps = {
  visible: boolean;
  uri: string | null;
  title: string;
  origem: RegistroFotoOrigem;
  index: number;
  total: number;
  downloadAuthorized: boolean;
  preferredFileName?: string | null;
  onClose: () => void;
};

export default function RegistroFotoViewerModal({
  visible,
  uri,
  title,
  origem,
  index,
  total,
  downloadAuthorized,
  preferredFileName,
  onClose,
}: RegistroFotoViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<MaterialImageOffset>({ x: 0, y: 0 });
  const [canPan, setCanPan] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [imageError, setImageError] = useState(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const pinchStartZoomRef = useRef(1);
  const pinchStartOffsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const pinchFocalRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const panStartOffsetRef = useRef<MaterialImageOffset>({ x: 0, y: 0 });
  const viewport = useMemo(() => ({
    width: Math.max(240, width - spacing.lg * 2),
    height: Math.max(140, height - (height < 500 ? 210 : 250)),
  }), [height, width]);

  const applyTransform = useCallback((nextZoom: number, nextOffset: MaterialImageOffset) => {
    const safeZoom = clampMaterialImageZoom(nextZoom);
    const safeOffset = clampMaterialImageOffset(nextOffset, safeZoom, viewport);
    zoomRef.current = safeZoom;
    offsetRef.current = safeOffset;
    setZoom(safeZoom);
    setOffset(safeOffset);
  }, [viewport]);

  const applyZoomAroundPoint = useCallback((nextZoom: number, point: MaterialImageOffset) => {
    const safeZoom = clampMaterialImageZoom(nextZoom);
    const nextOffset = resolveMaterialImageZoomAroundPoint({
      startZoom: zoomRef.current,
      nextZoom: safeZoom,
      startOffset: offsetRef.current,
      point,
      viewport,
    });
    applyTransform(safeZoom, nextOffset);
    setCanPan(safeZoom > MATERIAL_IMAGE_MIN_ZOOM);
  }, [applyTransform, viewport]);

  const resetZoom = useCallback(() => {
    applyTransform(MATERIAL_IMAGE_MIN_ZOOM, { x: 0, y: 0 });
    setCanPan(false);
  }, [applyTransform]);

  useEffect(() => {
    resetZoom();
    setImageError(false);
    setDownloadLoading(false);
    setDownloadFeedback(null);
  }, [resetZoom, uri, visible]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
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
    .onFinalize(() => setCanPan(zoomRef.current > MATERIAL_IMAGE_MIN_ZOOM)), [applyTransform, viewport]);

  const panGesture = useMemo(() => Gesture.Pan()
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
    }), [applyTransform, canPan]);

  const doubleTapGesture = useMemo(() => Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      if (zoomRef.current > MATERIAL_IMAGE_MIN_ZOOM) {
        resetZoom();
      } else {
        applyZoomAroundPoint(MATERIAL_IMAGE_DOUBLE_TAP_ZOOM, { x: event.x, y: event.y });
      }
    }), [applyZoomAroundPoint, resetZoom]);

  const imageGesture = useMemo(() => Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  ), [doubleTapGesture, panGesture, pinchGesture]);

  const viewportCenter = useMemo(
    () => ({ x: viewport.width / 2, y: viewport.height / 2 }),
    [viewport]
  );

  const handleDownload = async () => {
    if (!downloadAuthorized || !uri || !isRegistroFotoUriBaixavel(uri)) {
      setDownloadFeedback({
        tone: 'info',
        message: 'O download não está disponível para esta imagem e perfil.',
      });
      return;
    }

    setDownloadLoading(true);
    setDownloadFeedback(null);
    try {
      const fileName = buildRegistroFotoDownloadName(uri, origem, index, preferredFileName);
      const result = await exportFileToPhone({
        sourceUri: uri,
        preferredFileName: fileName,
        fallbackBaseName: `foto-${origem}-${index + 1}`,
      });
      if (result.status === 'cancelled') {
        setDownloadFeedback({
          tone: 'info',
          message: 'Salvamento cancelado. Nenhum arquivo foi criado.',
        });
        return;
      }
      setDownloadFeedback({
        tone: 'success',
        message: result.userSelectedDirectory
          ? `Foto salva na pasta escolhida como ${result.fileName}.`
          : `Foto salva como ${result.fileName} no armazenamento do aplicativo.`,
      });
    } catch {
      setDownloadFeedback({
        tone: 'error',
        message: 'Não foi possível salvar esta foto. Verifique a conexão, a pasta escolhida e tente novamente.',
      });
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.position}>Imagem {index + 1} de {total}</Text>
            </View>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar imagem ampliada"
            >
              <Ionicons name="close-outline" size={30} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.viewerArea}>
            {uri && !imageError ? (
              <GestureDetector gesture={imageGesture}>
                <View
                  style={[styles.viewport, viewport]}
                  accessibilityLabel={`Visualizador da foto ${index + 1}`}
                  accessibilityHint="Use pinça ou toque duas vezes para ampliar. A imagem não rola a tela externa."
                >
                  <View style={{ transform: [{ translateX: offset.x }, { translateY: offset.y }] }}>
                    <Image
                      source={{ uri }}
                      style={[styles.image, viewport, { transform: [{ scale: zoom }] }]}
                      resizeMode="contain"
                      onError={() => setImageError(true)}
                    />
                  </View>
                </View>
              </GestureDetector>
            ) : (
              <View style={[styles.viewport, styles.unavailable, viewport]}>
                <Ionicons name="image-outline" size={54} color={colors.mutedLight} />
                <Text style={styles.unavailableText}>Imagem indisponível</Text>
              </View>
            )}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => applyZoomAroundPoint(zoomRef.current - 0.5, viewportCenter)}
              disabled={zoom <= MATERIAL_IMAGE_MIN_ZOOM}
              accessibilityLabel="Diminuir foto"
            >
              <Ionicons name="remove-outline" size={24} color={zoom <= 1 ? colors.muted : colors.white} />
            </TouchableOpacity>
            <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => applyZoomAroundPoint(zoomRef.current + 0.5, viewportCenter)}
              disabled={zoom >= MATERIAL_IMAGE_MAX_ZOOM}
              accessibilityLabel="Ampliar foto"
            >
              <Ionicons name="add-outline" size={24} color={zoom >= 4 ? colors.muted : colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetZoom}
              accessibilityLabel="Redefinir ampliação da foto"
            >
              <Ionicons name="scan-outline" size={18} color={colors.white} />
              <Text style={styles.resetText}>Redefinir</Text>
            </TouchableOpacity>
            {downloadAuthorized ? (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownload}
                disabled={downloadLoading}
                accessibilityRole="button"
                accessibilityLabel="Salvar foto no telefone"
              >
                {downloadLoading
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Ionicons name="download-outline" size={20} color={colors.white} />}
                <Text style={styles.downloadText}>{downloadLoading ? 'Salvando...' : 'Salvar foto'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {downloadFeedback ? (
            <View
              style={[
                styles.downloadFeedback,
                downloadFeedback.tone === 'success'
                  ? styles.downloadFeedbackSuccess
                  : downloadFeedback.tone === 'error'
                    ? styles.downloadFeedbackError
                    : styles.downloadFeedbackInfo,
              ]}
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name={downloadFeedback.tone === 'success'
                  ? 'checkmark-circle-outline'
                  : downloadFeedback.tone === 'error'
                    ? 'alert-circle-outline'
                    : 'information-circle-outline'}
                size={18}
                color={colors.white}
              />
              <Text style={styles.downloadFeedbackText}>{downloadFeedback.message}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>
            Use pinça ou toque duas vezes para ampliar até 400%. O arraste fica contido na imagem.
          </Text>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  safeArea: { flex: 1, backgroundColor: colors.black },
  header: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#29323A',
  },
  headerText: { flex: 1, marginRight: spacing.md },
  title: { color: colors.white, fontSize: typography.fontBody, fontWeight: '700' },
  position: { color: '#C7D0D9', fontSize: typography.fontCaption, marginTop: spacing.xs },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  viewerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewport: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { backgroundColor: colors.black },
  unavailable: { gap: spacing.md, backgroundColor: '#111820' },
  unavailableText: { color: colors.white, fontSize: typography.fontBody },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#53616E',
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomValue: { minWidth: 48, color: colors.white, textAlign: 'center', fontWeight: '700' },
  resetButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#53616E',
    borderRadius: spacing.radiusSm,
  },
  resetText: { color: colors.white, fontSize: typography.fontCaption, fontWeight: '700' },
  downloadButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  downloadText: { color: colors.white, fontSize: typography.fontCaption, fontWeight: '700' },
  downloadFeedback: {
    minHeight: 38,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: spacing.radiusSm,
  },
  downloadFeedbackSuccess: { backgroundColor: colors.success },
  downloadFeedbackError: { backgroundColor: colors.error },
  downloadFeedbackInfo: { backgroundColor: colors.info },
  downloadFeedbackText: {
    flexShrink: 1,
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: '#C7D0D9',
    fontSize: typography.fontCaption,
    lineHeight: 17,
    textAlign: 'center',
  },
});
