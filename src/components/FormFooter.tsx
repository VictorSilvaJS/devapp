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
import { buttonStyles, colors, shadows, spacing, typography } from '../theme';

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

  return (
    <View style={[styles.footer, style]}>
      {showCancel ? (
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading || !onCancel}
          activeOpacity={0.78}
        >
          {cancelIcon ? <Ionicons name={cancelIcon} size={20} color={colors.text} /> : null}
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.button, styles.submitButton, submitDisabled ? styles.disabled : null]}
        onPress={onSubmit}
        disabled={submitDisabled}
        activeOpacity={0.78}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            {submitIcon ? <Ionicons name={submitIcon} size={20} color={colors.white} /> : null}
            <Text style={styles.submitText}>{submitLabel}</Text>
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
    opacity: 0.6,
  },
});
