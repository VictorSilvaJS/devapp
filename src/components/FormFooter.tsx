import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buttonStyles, colors, semanticColors, shadows, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type FormFooterProps = {
  onCancel?: () => void;
  onSubmit: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  cancelIcon?: IconName;
  submitIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  showCancel?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function FormFooter({
  onCancel,
  onSubmit,
  cancelLabel = 'Cancelar',
  submitLabel = 'Salvar',
  cancelIcon,
  submitIcon = 'checkmark',
  loading = false,
  disabled = false,
  showCancel = true,
  style,
}: FormFooterProps) {
  const submitDisabled = loading || disabled;
  const cancelDisabled = loading || !onCancel;

  return (
    <View style={[styles.footer, style]}>
      {showCancel ? (
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, cancelDisabled ? styles.disabled : null]}
          onPress={onCancel}
          disabled={cancelDisabled}
          activeOpacity={0.78}
        >
          {cancelIcon ? <Ionicons name={cancelIcon} size={20} color={cancelDisabled ? semanticColors.disabled.text : colors.text} /> : null}
          <Text style={[styles.cancelText, cancelDisabled ? styles.disabledText : null]}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.button, styles.submitButton, submitDisabled ? styles.disabled : null]}
        onPress={onSubmit}
        disabled={submitDisabled}
        activeOpacity={0.78}
      >
        {loading ? (
          <ActivityIndicator color={semanticColors.disabled.text} size="small" />
        ) : (
          <>
            {submitIcon ? <Ionicons name={submitIcon} size={20} color={submitDisabled ? semanticColors.disabled.text : colors.white} /> : null}
            <Text style={[styles.submitText, submitDisabled ? styles.disabledText : null]}>{submitLabel}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.screen,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  cancelButton: {
    ...(buttonStyles.secondary as ViewStyle),
  },
  submitButton: {
    ...(buttonStyles.primary as ViewStyle),
  },
  cancelText: {
    ...buttonStyles.secondaryText,
  },
  submitText: {
    ...buttonStyles.primaryText,
  },
  disabled: {
    backgroundColor: semanticColors.disabled.surface,
    borderColor: semanticColors.disabled.border,
  },
  disabledText: {
    color: semanticColors.disabled.text,
  },
});
