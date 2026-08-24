import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, border, shadows } from '../theme';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { formatAreaHa, resolveAreaTotalInformada } from '../utils/talhaoMedidasCompat';

export type PropertyCardPresentation = {
  readonly id: string;
  readonly nome: string;
  readonly titularNome: string;
  readonly localizacao: string;
  readonly areaTotal: number | null;
  readonly status: 'ativo' | 'pendente' | 'inativo';
  readonly accessLabel?: string;
};

type PropertyCardViewProps = {
  readonly property: PropertyCardPresentation;
  readonly onPress: () => void;
};

export function PropertyCardView({ property, onPress }: PropertyCardViewProps) {
  const nomeFazenda = property.nome || 'Propriedade sem nome';
  const nomeTitular = property.titularNome || 'Titular não informado';
  const localizacao = property.localizacao;
  const areaTotalInformada = formatAreaHa(property.areaTotal);

  const getStatusInfo = () => {
    switch (property.status) {
      case 'ativo':
        return { color: colors.success, label: 'Ativa', icon: 'checkmark-circle' as const };
      case 'pendente':
        return { color: colors.warning, label: 'Pendente', icon: 'time' as const };
      case 'inativo':
        return { color: colors.muted, label: 'Inativa', icon: 'close-circle' as const };
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
          <Text style={styles.letter}>{nomeFazenda.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={styles.nome} numberOfLines={1}>{nomeFazenda}</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: `${statusInfo.color}15`,
              borderColor: `${statusInfo.color}40`,
            }]}>
              <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <View style={styles.titularContainer}>
            <Ionicons name="person-outline" size={14} color={colors.textLight} />
            <Text style={styles.fazenda} numberOfLines={1}>Titular: {nomeTitular}</Text>
          </View>
          <View style={styles.metaContainer}>
            <View style={[styles.metaItem, styles.locationMetaItem]}>
              <Ionicons name="location" size={13} color={colors.muted} />
              <Text style={styles.meta} numberOfLines={1}>
                {localizacao || 'Localização não informada'}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="resize" size={13} color={colors.muted} />
              <Text style={styles.meta}>{areaTotalInformada}</Text>
            </View>
          </View>
          {property.accessLabel ? (
            <Text style={styles.accessLabel}>{property.accessLabel}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ProdutorCard({ produtor, onPress }) {
  const fazendaInfo = getFazendaUiInfo(produtor);
  const localizacao = [fazendaInfo.localizacao, produtor.regiao].filter(Boolean).join(' • ');
  return (
    <PropertyCardView
      property={{
        id: fazendaInfo.id,
        nome: fazendaInfo.fazendaNome,
        titularNome: fazendaInfo.titularNome,
        localizacao,
        areaTotal: resolveAreaTotalInformada(produtor),
        status: produtor.status === 'pendente'
          ? 'pendente'
          : produtor.status === 'inativo'
            ? 'inativo'
            : 'ativo',
      }}
      onPress={onPress}
    />
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
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
  },
  titularContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
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
  locationMetaItem: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 1,
  },
  accessLabel: {
    color: colors.primaryDark,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    marginTop: spacing.xs,
  },
});
