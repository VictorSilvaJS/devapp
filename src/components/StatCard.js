import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, border } from '../theme';

export default function StatCard({ label, value, accent }) {
  return (
    <View style={[styles.card, accent ? { borderColor: accent.border } : null]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.card,
    borderRadius: border.radius,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#f0f7f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  value: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.primary
  },
  label: {
    marginTop: 6,
    fontSize: typography.fontBody,
    color: colors.muted
  }
});
