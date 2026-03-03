import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, border, shadows } from '../theme';

export default function ProdutorCard({ produtor, onPress }) {
  const getStatusInfo = () => {
    switch (produtor.status) {
      case 'ativo':
        return { 
          color: colors.success, 
          label: 'Ativo',
          icon: 'checkmark-circle'
        };
      case 'pendente':
        return { 
          color: colors.warning, 
          label: 'Pendente',
          icon: 'time'
        };
      case 'inativo':
        return { 
          color: colors.muted, 
          label: 'Inativo',
          icon: 'close-circle'
        };
      default:
        return { 
          color: colors.muted, 
          label: 'N/A',
          icon: 'help-circle'
        };
    }
  };

  const statusInfo = getStatusInfo();

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
            <View style={[styles.statusBadge, { 
              backgroundColor: statusInfo.color + '15',
              borderColor: statusInfo.color + '40'
            }]}>
              <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.fazenda} numberOfLines={1}>{produtor.fazenda}</Text>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="location" size={13} color={colors.muted} />
              <Text style={styles.meta} numberOfLines={1}>
                {produtor.cidade}, {produtor.estado}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="resize" size={13} color={colors.muted} />
              <Text style={styles.meta}>{produtor.area_total} ha</Text>
            </View>
          </View>
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
    color: colors.white, 
    fontWeight: typography.weightBold, 
    fontSize: typography.sizes.xl + 2 
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 8,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightBold,
    letterSpacing: 0.3,
  },
  fazenda: { 
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    marginBottom: 6
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.muted,
    marginHorizontal: 8,
  },
  meta: { 
    color: colors.muted, 
    fontSize: typography.fontCaption + 1,
    fontWeight: '500',
  }
});
