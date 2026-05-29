import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buttonStyles, colors, emptyStateStyles, iconSizes, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function EmptyState({
  icon = 'information-circle-outline',
  title,
  message,
  actionLabel,
  actionIcon,
  onActionPress,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={iconSizes.xxl} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onActionPress ? (
        <TouchableOpacity style={styles.actionButton} onPress={onActionPress} activeOpacity={0.78}>
          {actionIcon ? <Ionicons name={actionIcon} size={18} color={colors.white} /> : null}
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(emptyStateStyles.container as ViewStyle),
  },
  iconContainer: {
    ...(emptyStateStyles.iconContainer as ViewStyle),
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: spacing.lg,
  },
  title: {
    ...(emptyStateStyles.title as TextStyle),
  },
  message: {
    ...(emptyStateStyles.message as TextStyle),
  },
  actionButton: {
    ...(buttonStyles.primary as ViewStyle),
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
});
