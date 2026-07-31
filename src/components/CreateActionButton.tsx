import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type CreateActionButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  placement?: 'floating' | 'docked';
};

export default function CreateActionButton({
  label,
  icon = 'add-outline',
  onPress,
  accessibilityLabel = label,
  placement = 'floating',
}: CreateActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        placement === 'docked' ? styles.dockedContainer : styles.floatingContainer,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.gradient}>
        <Ionicons name={icon} size={22} color={colors.white} />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.lg,
  },
  floatingContainer: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen + 20,
  },
  dockedContainer: {
    alignSelf: 'flex-end',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
});
