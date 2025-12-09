import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, border, shadows } from '../theme';

export default function StatCard({ label, value, accent, icon }) {
  // Ajusta o tamanho da fonte baseado no comprimento do valor
  const getValueFontSize = () => {
    const valueStr = String(value);
    if (valueStr.length > 10) return typography.fontBody + 2;
    if (valueStr.length > 6) return typography.fontSubtitle;
    return typography.fontSubtitle + 4;
  };

  return (
    <View style={styles.cardWrapper}>
      <LinearGradient
        colors={accent?.gradient || ['#FFFFFF', colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.content}>
          <Text 
            style={[
              styles.value, 
              { fontSize: getValueFontSize() },
              accent?.color && { color: accent.color }
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {value}
          </Text>
          <Text style={styles.label} numberOfLines={2}>{label}</Text>
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
    flex: 1,
    marginRight: 8
  },
  value: {
    fontWeight: typography.weightBold,
    color: colors.primary,
    marginBottom: 4,
    flexShrink: 1
  },
  label: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    flexWrap: 'wrap'
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
