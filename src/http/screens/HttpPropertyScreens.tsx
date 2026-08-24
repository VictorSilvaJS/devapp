import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import EmptyState from '../../components/EmptyState';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../../components/FilterBottomSheet';
import InfoBox from '../../components/InfoBox';
import { PropertyCardView } from '../../components/ProdutorCard';
import SearchBar from '../../components/SearchBar';
import SectionCard from '../../components/SectionCard';
import SegmentedChips from '../../components/SegmentedChips';
import { colors, shadows, spacing, typography } from '../../theme';
import { formatAreaHa } from '../../utils/talhaoMedidasCompat';
import type {
  PropertyFilters,
  PropertyProjection,
  PropertyStatus,
} from '../contracts';
import { HttpDetailHeader, HttpTabHeader } from '../HttpAppHeader';
import { useHttpSession } from '../HttpSessionContext';
import {
  HttpFeedback,
  HttpField,
  controlledUiError,
} from '../ui';

const ACCESS_LABELS: Record<PropertyProjection['tipo_acesso'], string> = {
  admin: 'Acesso administrativo',
  titular: 'Acesso como Titular',
  usuario_autorizado: 'Produtor autorizado',
  colaborador: 'Colaborador vinculado',
};

type StatusFilter = 'todas' | PropertyStatus;

export function HttpPropertiesScreen({ navigation }: any) {
  const { runtime, snapshot } = useHttpSession();
  const [items, setItems] = React.useState<readonly PropertyProjection[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [searchDraft, setSearchDraft] = React.useState('');
  const [filters, setFilters] = React.useState<PropertyFilters>({ limite: 50 });
  const [filterSheetVisible, setFilterSheetVisible] = React.useState(false);
  const [statusDraft, setStatusDraft] = React.useState<StatusFilter>('todas');
  const [ufDraft, setUfDraft] = React.useState('');
  const [municipalityDraft, setMunicipalityDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestGeneration = React.useRef(0);
  const loadingMoreRef = React.useRef(false);
  const lastRequestedCursorRef = React.useRef<string | null>(null);

  const load = React.useCallback(async (
    activeFilters: PropertyFilters,
    mode: 'initial' | 'refresh' | 'more',
  ) => {
    const append = mode === 'more';
    const generation = append
      ? requestGeneration.current
      : ++requestGeneration.current;

    if (append) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      lastRequestedCursorRef.current = null;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      if (mode === 'initial') {
        setItems([]);
        setNextCursor(null);
      }
    }
    setError(null);

    try {
      const page = await runtime.properties.list(activeFilters);
      if (generation !== requestGeneration.current) return;
      setItems((current) => append ? [...current, ...page.itens] : page.itens);
      setNextCursor(page.paginacao.proximo_cursor);
    } catch (caught) {
      if (generation === requestGeneration.current) {
        if (append) lastRequestedCursorRef.current = null;
        setError(controlledUiError(caught));
      }
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [runtime]);

  React.useEffect(() => {
    void load(filters, 'initial');
  }, [filters, load]);

  const applySearch = () => {
    const value = searchDraft.trim();
    setFilters((current) => ({
      ...current,
      cursor: undefined,
      busca: value || undefined,
    }));
  };

  const applyFilters = () => {
    setFilters((current) => ({
      limite: current.limite ?? 50,
      busca: current.busca,
      status: statusDraft === 'todas' ? undefined : statusDraft,
      uf: ufDraft.trim() ? ufDraft.trim().toUpperCase() : undefined,
      municipio: municipalityDraft.trim() || undefined,
    }));
    setFilterSheetVisible(false);
  };

  const restoreFilterDrafts = () => {
    setStatusDraft(filters.status ?? 'todas');
    setUfDraft(filters.uf ?? '');
    setMunicipalityDraft(filters.municipio ?? '');
  };

  const openFilters = () => {
    restoreFilterDrafts();
    setFilterSheetVisible(true);
  };

  const cancelFilters = () => {
    restoreFilterDrafts();
    setFilterSheetVisible(false);
  };

  const clearFilters = () => {
    setStatusDraft('todas');
    setUfDraft('');
    setMunicipalityDraft('');
  };

  const loadMore = () => {
    if (
      !nextCursor ||
      loading ||
      refreshing ||
      loadingMoreRef.current ||
      lastRequestedCursorRef.current === nextCursor
    ) return;
    lastRequestedCursorRef.current = nextCursor;
    void load({ ...filters, cursor: nextCursor }, 'more');
  };

  const activeFilters = [
    filters.busca ? {
      key: 'busca',
      label: `Busca: ${filters.busca}`,
      icon: 'search-outline' as const,
      onRemove: () => {
        setSearchDraft('');
        setFilters((current) => ({ ...current, busca: undefined, cursor: undefined }));
      },
    } : null,
    filters.status ? {
      key: 'status',
      label: filters.status === 'ativa' ? 'Ativas' : 'Inativas',
      icon: 'checkmark-circle-outline' as const,
      onRemove: () => {
        setStatusDraft('todas');
        setFilters((current) => ({ ...current, status: undefined, cursor: undefined }));
      },
    } : null,
    filters.uf ? {
      key: 'uf',
      label: filters.uf,
      icon: 'location-outline' as const,
      onRemove: () => {
        setUfDraft('');
        setFilters((current) => ({ ...current, uf: undefined, cursor: undefined }));
      },
    } : null,
    filters.municipio ? {
      key: 'municipio',
      label: filters.municipio,
      icon: 'map-outline' as const,
      onRemove: () => {
        setMunicipalityDraft('');
        setFilters((current) => ({ ...current, municipio: undefined, cursor: undefined }));
      },
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const title = snapshot?.usuario.perfil === 'produtor'
    ? 'Minhas Propriedades'
    : 'Propriedades';

  return (
    <View style={styles.container}>
      <HttpTabHeader title={title} navigation={navigation} />

      <LinearGradient
        colors={[colors.white, colors.backgroundSoft]}
        style={styles.topBar}
      >
        <SearchBar
          value={searchDraft}
          onChangeText={setSearchDraft}
          onClear={() => {
            setSearchDraft('');
            setFilters((current) => ({ ...current, busca: undefined, cursor: undefined }));
          }}
          onSubmitEditing={applySearch}
          returnKeyType="search"
          placeholder="Buscar Propriedade, Titular ou Município"
          containerStyle={styles.searchBar}
        />
        <FilterTrigger
          activeCount={activeFilters.filter((item) => item.key !== 'busca').length}
          onPress={openFilters}
          style={styles.filterButton}
        />
      </LinearGradient>

      {error ? (
        <View style={styles.feedbackContainer}>
          <HttpFeedback message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando Propriedades...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyCardView
              property={{
                id: item.id,
                nome: item.nome,
                titularNome: item.titular.nome,
                localizacao: `${item.municipio_nome}/${item.uf_sigla}`,
                areaTotal: item.area_total,
                status: item.status === 'ativa' ? 'ativo' : 'inativo',
                accessLabel: ACCESS_LABELS[item.tipo_acesso],
              }}
              onPress={() => navigation.navigate('PropertyDetail', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => void load(filters, 'refresh')}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          ListHeaderComponent={(
            <ActiveFilterBar
              items={activeFilters}
              onClear={() => {
                setSearchDraft('');
                clearFilters();
                setFilters({ limite: 50 });
              }}
            />
          )}
          ListEmptyComponent={(
            <EmptyState
              icon={activeFilters.length > 0 ? 'search-outline' : 'business-outline'}
              title="Nenhuma Propriedade encontrada"
              message={activeFilters.length > 0
                ? 'Tente ajustar a busca ou limpar os filtros aplicados.'
                : 'Nenhuma Propriedade está disponível para este acesso.'}
              style={styles.emptyState}
            />
          )}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
          ) : null}
        />
      )}

      <FilterBottomSheet
        visible={filterSheetVisible}
        subtitle="Os filtros são aplicados pelo servidor ao seu escopo autorizado."
        onRequestClose={cancelFilters}
        onClear={clearFilters}
        onApply={applyFilters}
      >
        <FilterSection title="Status">
          <SegmentedChips<StatusFilter>
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'ativa', label: 'Ativas' },
              ...(snapshot?.usuario.perfil === 'admin'
                ? [{ value: 'inativa' as const, label: 'Inativas' }]
                : []),
            ]}
            value={statusDraft}
            onChange={setStatusDraft}
          />
        </FilterSection>
        <FilterSection title="Localização">
          <HttpField
            label="UF"
            value={ufDraft}
            onChangeText={setUfDraft}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Ex.: RS"
          />
          <HttpField
            label="Município"
            value={municipalityDraft}
            onChangeText={setMunicipalityDraft}
            autoCapitalize="words"
            placeholder="Nome ou código IBGE"
          />
        </FilterSection>
      </FilterBottomSheet>
    </View>
  );
}

export function HttpPropertyDetailScreen({ route, navigation }: any) {
  const { runtime } = useHttpSession();
  const [property, setProperty] = React.useState<PropertyProjection | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const id = typeof route.params?.id === 'string' ? route.params.id : '';

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setProperty(null);
    void runtime.properties.getById(id).then((result) => {
      if (active) setProperty(result);
    }).catch((caught) => {
      if (active) {
        setProperty(null);
        setError(controlledUiError(caught));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, runtime]);

  return (
    <View style={styles.container}>
      <HttpDetailHeader
        title={property?.nome ?? 'Propriedade'}
        navigation={navigation}
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando Propriedade...</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          style={styles.detailGradient}
        >
          <ScrollView contentContainerStyle={styles.detailContent}>
            <HttpFeedback message={error} />
            {property ? (
              <>
                <View style={styles.detailHero}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>
                      {property.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailHeroText}>
                    <Text style={styles.detailTitle}>{property.nome}</Text>
                    <View style={styles.detailLocation}>
                      <Ionicons name="location-outline" size={16} color={colors.textLight} />
                      <Text style={styles.detailSubtitle}>
                        {property.municipio_nome}/{property.uf_sigla}
                      </Text>
                    </View>
                    <Text style={styles.detailAccess}>{ACCESS_LABELS[property.tipo_acesso]}</Text>
                  </View>
                </View>

                <SectionCard title="Informações cadastrais" icon="document-text-outline">
                  <DetailRow label="Titular" value={property.titular.nome} />
                  <DetailRow label="Área total informada" value={formatAreaHa(property.area_total)} />
                  <DetailRow label="Cultura principal" value={property.cultura_principal ?? 'Não informada'} />
                  <DetailRow label="Status" value={property.status === 'ativa' ? 'Ativa' : 'Inativa'} />
                  <DetailRow label="Tipo de acesso" value={ACCESS_LABELS[property.tipo_acesso]} last />
                </SectionCard>

                <InfoBox message="Esta consulta usa dados reais e autorização do servidor. Talhões, mapas, Visitas e Caderno aparecerão nesta interface somente quando suas verticais HTTP estiverem conectadas." />
              </>
            ) : null}
          </ScrollView>
        </LinearGradient>
      )}
    </View>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMedium,
    gap: spacing.sm,
  },
  searchBar: { flex: 1, ...shadows.sm },
  filterButton: { width: 112 },
  feedbackContainer: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  list: { flexGrow: 1, padding: spacing.screen, paddingBottom: spacing.xl },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textLight, fontSize: typography.fontBody },
  emptyState: { minHeight: 360 },
  footerLoader: { marginVertical: spacing.lg },
  detailGradient: { flex: 1 },
  detailContent: { padding: spacing.screen, paddingBottom: spacing.xl * 2 },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  detailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.primary,
  },
  detailAvatarText: { color: colors.white, fontSize: 28, fontWeight: typography.weightBold },
  detailHeroText: { flex: 1, minWidth: 0 },
  detailTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold },
  detailLocation: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  detailSubtitle: { color: colors.textLight, fontSize: typography.fontBody - 1 },
  detailAccess: { color: colors.primary, fontSize: typography.fontCaption + 1, fontWeight: typography.weightBold, marginTop: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: typography.fontBody - 1, fontWeight: typography.weightSemibold },
  detailValue: { flex: 1, color: colors.text, fontSize: typography.fontBody - 1, fontWeight: typography.weightBold, textAlign: 'right' },
});
