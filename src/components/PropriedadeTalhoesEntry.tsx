import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from './EmptyState';
import ShapeRenderer from './ShapeRenderer';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import { formatAreaHa } from '../utils/talhaoMedidasCompat';

type TalhoesView = 'lista' | 'mapa';
type TalhaoEntry = Record<string, any>;

type PropriedadeTalhoesEntryProps = {
  talhoes: TalhaoEntry[];
  onOpenMapa: (talhao?: TalhaoEntry) => void;
};

const getTalhaoNome = (talhao: TalhaoEntry, index: number) =>
  talhao?.talhao || talhao?.nome || `Talhão ${index + 1}`;

const temGeometria = (talhao: TalhaoEntry) => {
  if (Array.isArray(talhao?.poligono) && talhao.poligono.length >= 3) return true;
  return Array.isArray(talhao?.poligonos)
    && talhao.poligonos.some((poligono) => Array.isArray(poligono) && poligono.length >= 3);
};

export default function PropriedadeTalhoesEntry({
  talhoes,
  onOpenMapa,
}: PropriedadeTalhoesEntryProps) {
  const [activeView, setActiveView] = useState<TalhoesView>('lista');
  const talhoesComGeometria = talhoes.filter(temGeometria);

  return (
    <View style={styles.container}>
      <View style={styles.viewSelector} accessibilityLabel="Modo de exibição dos Talhões">
        {(['lista', 'mapa'] as const).map((view) => {
          const isActive = activeView === view;
          const label = view === 'lista' ? 'Lista' : 'Mapa';
          const icon = view === 'lista' ? 'list-outline' : 'map-outline';

          return (
            <TouchableOpacity
              key={view}
              style={[styles.viewOption, isActive && styles.viewOptionActive]}
              onPress={() => setActiveView(view)}
              activeOpacity={0.78}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Exibir Talhões em ${label.toLowerCase()}`}
            >
              <Ionicons
                name={icon}
                size={18}
                color={isActive ? colors.white : semanticColors.primary.text}
              />
              <Text style={[styles.viewOptionText, isActive && styles.viewOptionTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.countText} accessibilityLiveRegion="polite">
        {talhoes.length} {talhoes.length === 1 ? 'talhão disponível' : 'talhões disponíveis'}
      </Text>

      {talhoes.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="Nenhum Talhão disponível"
          message="Esta Propriedade ainda não possui Talhões para consulta."
          style={styles.emptyState}
        />
      ) : activeView === 'lista' ? (
        <View style={styles.list} accessibilityLabel="Lista de Talhões">
          {talhoes.map((talhao, index) => {
            const nome = getTalhaoNome(talhao, index);
            const possuiGeometria = temGeometria(talhao);
            const nomeSecundario = talhao?.talhao && talhao?.nome && talhao.nome !== talhao.talhao
              ? talhao.nome
              : null;
            const metadados = [talhao?.cultura, talhao?.ano ? String(talhao.ano) : null]
              .filter(Boolean);

            return (
              <TouchableOpacity
                key={String(talhao?.id ?? `${nome}-${index}`)}
                style={styles.talhaoCard}
                onPress={() => onOpenMapa(talhao)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={possuiGeometria
                  ? `Abrir ${nome} no mapa`
                  : `${nome}, sem demarcação disponível`}
              >
                <View style={styles.talhaoIcon}>
                  <Ionicons name="git-network-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.talhaoContent}>
                  <Text style={styles.talhaoTitle}>{nome}</Text>
                  {nomeSecundario ? <Text style={styles.talhaoSubtitle}>{nomeSecundario}</Text> : null}
                  <Text style={styles.talhaoArea}>
                    Área: {formatAreaHa(talhao?.area_hectares)}
                  </Text>
                  {metadados.length > 0 ? (
                    <Text style={styles.talhaoMetadata}>{metadados.join(' • ')}</Text>
                  ) : null}
                  {!possuiGeometria ? (
                    <View style={styles.geometryStatus}>
                      <Ionicons name="map-outline" size={15} color={semanticColors.warning.text} />
                      <Text style={styles.geometryStatusText}>Sem demarcação disponível</Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward-outline" size={22} color={colors.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.mapContent} accessibilityLabel="Mapa dos Talhões">
          {talhoesComGeometria.length > 0 ? (
            <ShapeRenderer
              talhoes={talhoesComGeometria}
              selectedId={undefined}
              height={240}
              showLabels
              showLegend={false}
              onTalhaoPress={onOpenMapa}
            />
          ) : (
            <View style={styles.mapUnavailable}>
              <Ionicons name="map-outline" size={32} color={colors.muted} />
              <Text style={styles.mapUnavailableTitle}>Demarcação indisponível</Text>
              <Text style={styles.mapUnavailableText}>
                Os Talhões estão disponíveis na lista, mas ainda não possuem geometria para esta prévia.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.openMapButton}
            onPress={() => onOpenMapa()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Abrir mapa interativo da Propriedade"
          >
            <Ionicons name="map-outline" size={19} color={colors.white} />
            <Text style={styles.openMapButtonText}>Abrir mapa interativo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  viewSelector: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: spacing.radius,
    backgroundColor: colors.backgroundNeutral,
  },
  viewOption: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radiusSm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  viewOptionActive: {
    backgroundColor: colors.primary,
  },
  viewOptionText: {
    color: semanticColors.primary.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weightBold,
  },
  viewOptionTextActive: {
    color: colors.white,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
  list: {
    gap: spacing.sm,
  },
  talhaoCard: {
    minHeight: 76,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: spacing.radius,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  talhaoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  talhaoContent: {
    flex: 1,
    gap: 2,
  },
  talhaoTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  talhaoSubtitle: {
    color: colors.textLight,
    fontSize: typography.fontCaption,
  },
  talhaoArea: {
    color: colors.textLight,
    fontSize: typography.sizes.sm,
  },
  talhaoMetadata: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  geometryStatus: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  geometryStatusText: {
    color: semanticColors.warning.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weightSemibold,
  },
  mapContent: {
    gap: spacing.md,
  },
  mapUnavailable: {
    minHeight: 180,
    padding: spacing.xl,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mapUnavailableTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  mapUnavailableText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  openMapButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  openMapButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weightBold,
  },
  emptyState: {
    paddingVertical: spacing.xl,
  },
});
