import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, border, shadows } from '../theme';

export default function ProdutorCard({ produtor, onPress }) {
  const getStatusColor = () => {
    switch (produtor.status) {
      case 'ativo':
        return colors.success;
      case 'pendente':
        return colors.warning;
      default:
        return colors.muted;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.cardWrapper} activeOpacity={0.7}>
      <View style={styles.card}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.letter}>{produtor.nome.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={styles.nome} numberOfLines={1}>{produtor.nome}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            </View>
          </View>
          <Text style={styles.fazenda} numberOfLines={1}>{produtor.fazenda}</Text>
          <Text style={styles.meta} numberOfLines={1}>{produtor.cidade}, {produtor.estado} • {produtor.area_total} ha</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: spacing.gap,
    ...shadows.md
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: spacing.card + 2,
    borderRadius: border.radiusLg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...shadows.sm
  },
  letter: { 
    color: '#fff', 
    fontWeight: typography.weightBold, 
    fontSize: 22 
  },
  info: { 
    flex: 1 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  nome: { 
    flex: 1,
    fontSize: typography.fontBody + 2, 
    fontWeight: typography.weightBold, 
    color: colors.text 
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  fazenda: { 
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    marginBottom: 2
  },
  meta: { 
    color: colors.muted, 
    fontSize: typography.fontCaption + 1,
    marginTop: 2
  }
});
