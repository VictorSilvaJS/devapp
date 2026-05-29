import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardStyles, colors, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  actionLabel?: string;
  actionIcon?: IconName;
  onActionPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function SectionCard({
  title,
  subtitle,
  icon,
  actionLabel,
  actionIcon,
  onActionPress,
  children,
  style,
  contentStyle,
}: SectionCardProps) {
  const hasHeader = title || subtitle || icon || actionLabel || onActionPress;

  return (
    <View style={[styles.card, style]}>
      {hasHeader ? (
        <View style={styles.header}>
          {icon ? (
            <View style={styles.iconBox}>
              <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
          ) : null}

          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          {onActionPress ? (
            <TouchableOpacity style={styles.actionButton} onPress={onActionPress} activeOpacity={0.75}>
              {actionIcon ? <Ionicons name={actionIcon} size={16} color={colors.primary} /> : null}
              {actionLabel ? <Text style={styles.actionText}>{actionLabel}</Text> : null}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardStyles.base,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
    marginTop: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.accent,
  },
  actionText: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },
});
