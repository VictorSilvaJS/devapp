import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, border, shadows } from '../theme';

const colorSchemes = {
  green: {
    gradient: [colors.accent, colors.white],
    border: colors.accentDark,
    color: colors.primary,
    bgColor: colors.accent
  },
  blue: {
    gradient: [colors.infoLight, colors.white],
    border: '#bfdbfe',
    color: colors.info,
    bgColor: colors.infoLight
  },
  purple: {
    gradient: [colors.purpleLight, colors.white],
    border: '#ddd6fe',
    color: colors.purple,
    bgColor: colors.purpleLight
  },
  amber: {
    gradient: [colors.amberLight, colors.white],
    border: '#fde68a',
    color: colors.amber,
    bgColor: colors.amberLight
  }
};

type StatCardProps = {
  label: any;
  value: any;
  accent?: any;
  icon?: any;
  colorScheme?: keyof typeof colorSchemes;
};

export default function StatCard({ label, value, accent, icon, colorScheme }: StatCardProps) {
  // Se colorScheme for passado, usa o esquema pré-definido
  const scheme = colorScheme ? colorSchemes[colorScheme] : null;
  const finalAccent = scheme || accent;

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
        colors={finalAccent?.gradient || [colors.white, colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, scheme && { borderColor: scheme.border }]}
      >
        <View style={styles.content}>
          <Text 
            style={[
              styles.value, 
              { fontSize: getValueFontSize() },
              finalAccent?.color && { color: finalAccent.color }
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {typeof icon === 'string' ? `${icon} ${value}` : value}
          </Text>
          <Text style={styles.label} numberOfLines={2}>{label}</Text>
        </View>
        {typeof icon !== 'string' && icon && (
          <View style={[styles.iconContainer, finalAccent?.bgColor && { backgroundColor: finalAccent.bgColor }]}>
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
