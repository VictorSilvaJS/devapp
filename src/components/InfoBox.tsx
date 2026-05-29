import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type InfoBoxVariant = 'info' | 'success' | 'warning' | 'error';

type InfoBoxProps = {
  variant?: InfoBoxVariant;
  title?: string;
  message?: React.ReactNode;
  icon?: IconName;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const variantConfig: Record<InfoBoxVariant, { color: string; background: string; icon: IconName }> = {
  info: { color: colors.primary, background: colors.accent, icon: 'information-circle-outline' },
  success: { color: colors.success, background: colors.successBg, icon: 'checkmark-circle-outline' },
  warning: { color: colors.warning, background: colors.amberLight, icon: 'alert-circle-outline' },
  error: { color: colors.error, background: colors.errorBgLight, icon: 'alert-circle-outline' },
};

export default function InfoBox({
  variant = 'info',
  title,
  message,
  icon,
  children,
  style,
}: InfoBoxProps) {
  const config = variantConfig[variant];

  return (
    <View style={[styles.box, { backgroundColor: config.background, borderLeftColor: config.color }, style]}>
      <Ionicons name={icon || config.icon} size={20} color={config.color} style={styles.icon} />
      <View style={styles.content}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {typeof message === 'string' ? <Text style={styles.message}>{message}</Text> : message}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    marginBottom: 2,
  },
  message: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
  },
});
