import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, border, shadows } from '../theme';

export default function StatCard({ label, value, accent, icon }) {
  return (
    <View style={styles.cardWrapper}>
      <LinearGradient
        colors={accent?.gradient || ['#FFFFFF', colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.content}>
          <Text style={[styles.value, accent?.color && { color: accent.color }]}>{value}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        {icon && (
          <View style={[styles.iconContainer, accent?.bgColor && { backgroundColor: accent.bgColor }]}>
            {icon}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    marginHorizontal: 6,
    ...shadows.md
  },
  card: {
    flex: 1,
    padding: spacing.card + 4,
    borderRadius: border.radiusLg,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 100
  },
  content: {
    flex: 1
  },
  value: {
    fontSize: typography.fontSubtitle + 4,
    fontWeight: typography.weightBold,
    color: colors.primary,
    marginBottom: 4
  },
  label: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    fontWeight: typography.weightSemibold
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  }
});
