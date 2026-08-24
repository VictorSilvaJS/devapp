/**
 * Badge de Notificações
 * Mostra contador de notificações não lidas
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

type NotificationBadgeProps = {
  readonly count: number;
  readonly size?: 'small' | 'medium' | 'large';
};

export default function NotificationBadge({ count, size = 'medium' }: NotificationBadgeProps) {
  if (!count || count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  const sizeStyles = {
    small: {
      container: { minWidth: 16, height: 16, borderRadius: 8 },
      text: { fontSize: 9 },
    },
    medium: {
      container: { minWidth: 20, height: 20, borderRadius: 10 },
      text: { fontSize: 11 },
    },
    large: {
      container: { minWidth: 24, height: 24, borderRadius: 12 },
      text: { fontSize: 12 },
    },
  };

  return (
    <View style={[styles.badge, sizeStyles[size].container]}>
      <Text style={[styles.badgeText, sizeStyles[size].text]}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -4,
    right: -4,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
});
