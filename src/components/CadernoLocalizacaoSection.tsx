import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SectionCard from './SectionCard';
import { badgeStyles, buttonStyles, colors, semanticColors, spacing, typography } from '../theme';
import {
  CadernoLocalizacaoExplicita,
  hasCadernoLocalizacao,
  normalizeCadernoLocalizacao,
} from '../utils/cadernoLocalizacaoCompat';
import { getCadernoLocalizacaoPresentation } from '../utils/cadernoLocalizacaoUiCompat';

export type CadernoLocalizacaoSectionMode = 'create' | 'edit';

export type CadernoLocalizacaoSectionProps = {
  mode: CadernoLocalizacaoSectionMode;
  currentLocation?: CadernoLocalizacaoExplicita | null;
  existingLocation?: CadernoLocalizacaoExplicita | null;
  loading?: boolean;
  errorMessage?: string | null;
  noticeMessage?: string | null;
  removalPending?: boolean;
  hasTalhaoContext?: boolean;
  disabled?: boolean;
  onCapture: () => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
};

export type CadernoLocalizacaoBadgeProps = {
  registro: unknown;
};

const INITIAL_MESSAGE =
  'Localização opcional. A posição só será incluída neste registro se você usar a ação abaixo e depois salvar o Caderno.';

const READY_MESSAGE =
  'Ao salvar este registro, a posição aproximada do aparelho, a precisão informada e o horário da leitura serão armazenados localmente no Caderno de Campo. O aplicativo não acompanha sua localização em segundo plano.';

const TALHAO_CONTEXT_MESSAGE =
  'O Talhão foi selecionado pelo contexto do registro. O aplicativo não confirmou automaticamente que a posição está dentro dele.';

const LOW_ACCURACY_MESSAGE =
  'A precisão desta leitura está baixa. Confirme visualmente o local antes de salvar.';

const REMOVAL_MESSAGE =
  'A localização será removida quando você salvar as alterações.';

type MessageBoxProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  message: string;
  tone: 'error' | 'notice' | 'warning';
};

function MessageBox({ icon, message, tone }: MessageBoxProps) {
  const toneStyle = tone === 'error'
    ? styles.errorBox
    : tone === 'warning'
      ? styles.warningBox
      : styles.noticeBox;
  const toneColor = tone === 'error'
    ? colors.error
    : tone === 'warning'
      ? colors.warning
      : colors.info;

  return (
    <View style={[styles.messageBox, toneStyle]}>
      <Ionicons name={icon} size={18} color={toneColor} />
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
}

export function CadernoLocalizacaoSection({
  mode,
  currentLocation,
  existingLocation,
  loading = false,
  errorMessage,
  noticeMessage,
  removalPending = false,
  hasTalhaoContext = false,
  disabled = false,
  onCapture,
  onRemove,
  onUndoRemove,
}: CadernoLocalizacaoSectionProps) {
  const normalizedCurrent = normalizeCadernoLocalizacao(currentLocation);
  const normalizedExisting = normalizeCadernoLocalizacao(existingLocation);
  const displayedLocation = normalizedCurrent || normalizedExisting;
  const presentation = getCadernoLocalizacaoPresentation(displayedLocation);
  const isNewCapture = Boolean(normalizedCurrent);
  const isExistingLocation = mode === 'edit' && !isNewCapture && Boolean(normalizedExisting);
  const captureDisabled = disabled || loading;
  const removeDisabled = disabled || loading;

  const captureLabel = loading
    ? 'Obtendo posição...'
    : displayedLocation
      ? 'Atualizar usando posição atual'
      : 'Usar minha posição neste registro';

  return (
    <SectionCard
      title="Localização do registro"
      subtitle={INITIAL_MESSAGE}
      icon="location-outline"
    >
      {noticeMessage ? (
        <MessageBox icon="information-circle-outline" message={noticeMessage} tone="notice" />
      ) : null}

      {errorMessage ? (
        <MessageBox icon="alert-circle-outline" message={errorMessage} tone="error" />
      ) : null}

      {removalPending ? (
        <View style={styles.removalContainer}>
          <MessageBox icon="trash-outline" message={REMOVAL_MESSAGE} tone="warning" />
          {onUndoRemove ? (
            <TouchableOpacity
              style={[styles.secondaryButton, disabled ? styles.disabled : null]}
              onPress={onUndoRemove}
              disabled={disabled}
              activeOpacity={0.78}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={disabled ? semanticColors.disabled.text : colors.primary} />
              <Text style={[styles.secondaryButtonText, disabled ? styles.disabledText : null]}>Desfazer remoção</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : displayedLocation ? (
        <View style={styles.readyContainer}>
          <View style={styles.readyHeader}>
            <View style={styles.readyIcon}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </View>
            <Text style={styles.readyTitle}>
              {isExistingLocation ? 'Localização registrada' : 'Posição pronta para salvar'}
            </Text>
          </View>

          {isNewCapture ? <Text style={styles.readyMessage}>{READY_MESSAGE}</Text> : null}

          <View style={styles.metadataContainer}>
            <View style={styles.metadataRow}>
              <Ionicons name="radio-outline" size={17} color={colors.muted} />
              <Text style={styles.metadataText}>
                {presentation?.accuracyText || 'Precisão não informada'}
              </Text>
            </View>
            <View style={styles.metadataRow}>
              <Ionicons name="time-outline" size={17} color={colors.muted} />
              <Text style={styles.metadataText}>
                {presentation?.capturedAtText
                  ? `Horário da leitura: ${presentation.capturedAtText}`
                  : 'Horário da leitura não informado'}
              </Text>
            </View>
          </View>

          {presentation?.lowAccuracy ? (
            <MessageBox icon="warning-outline" message={LOW_ACCURACY_MESSAGE} tone="warning" />
          ) : null}

          {hasTalhaoContext ? (
            <MessageBox icon="leaf-outline" message={TALHAO_CONTEXT_MESSAGE} tone="notice" />
          ) : null}

          {displayedLocation ? (
            <TouchableOpacity
              style={[styles.primaryButton, captureDisabled ? styles.disabled : null]}
              onPress={onCapture}
              disabled={captureDisabled}
              activeOpacity={0.78}
            >
              {loading ? (
                <ActivityIndicator size="small" color={semanticColors.disabled.text} />
              ) : (
                <Ionicons name="locate-outline" size={19} color={captureDisabled ? semanticColors.disabled.text : colors.white} />
              )}
              <Text style={[styles.primaryButtonText, captureDisabled ? styles.disabledText : null]}>{captureLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {onRemove ? (
            <TouchableOpacity
              style={[styles.removeButton, removeDisabled ? styles.disabled : null]}
              onPress={onRemove}
              disabled={removeDisabled}
              activeOpacity={0.78}
            >
              <Ionicons name="trash-outline" size={18} color={removeDisabled ? semanticColors.disabled.text : colors.error} />
              <Text style={[styles.removeButtonText, removeDisabled ? styles.disabledText : null]}>Remover localização</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.primaryButton, captureDisabled ? styles.disabled : null]}
          onPress={onCapture}
          disabled={captureDisabled}
          activeOpacity={0.78}
        >
          {loading ? (
            <ActivityIndicator size="small" color={semanticColors.disabled.text} />
          ) : (
            <Ionicons name="locate-outline" size={19} color={captureDisabled ? semanticColors.disabled.text : colors.white} />
          )}
          <Text style={[styles.primaryButtonText, captureDisabled ? styles.disabledText : null]}>{captureLabel}</Text>
        </TouchableOpacity>
      )}
    </SectionCard>
  );
}

export function CadernoLocalizacaoBadge({ registro }: CadernoLocalizacaoBadgeProps) {
  if (!hasCadernoLocalizacao(registro)) return null;

  return (
    <View style={styles.badge}>
      <Ionicons name="location-outline" size={13} color={colors.primary} />
      <Text style={styles.badgeText}>Com ponto geográfico</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.errorBgLight,
    borderColor: colors.errorBorder,
  },
  noticeBox: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info,
  },
  warningBox: {
    backgroundColor: colors.amberLight,
    borderColor: colors.warning,
  },
  messageText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 19,
  },
  removalContainer: {
    gap: spacing.sm,
  },
  readyContainer: {
    gap: spacing.md,
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successBg,
  },
  readyTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  readyMessage: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 20,
  },
  metadataContainer: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metadataText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
  },
  primaryButton: {
    ...(buttonStyles.primary as ViewStyle),
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...buttonStyles.primaryText,
  },
  secondaryButton: {
    ...(buttonStyles.secondary as ViewStyle),
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    ...buttonStyles.secondaryText,
    color: colors.primary,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBgLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  removeButtonText: {
    color: colors.error,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
  },
  disabled: {
    backgroundColor: semanticColors.disabled.surface,
    borderColor: semanticColors.disabled.border,
  },
  disabledText: {
    color: semanticColors.disabled.text,
  },
  badge: {
    ...(badgeStyles.container as ViewStyle),
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  badgeText: {
    ...badgeStyles.text,
    color: colors.primary,
  },
});

export default CadernoLocalizacaoSection;
