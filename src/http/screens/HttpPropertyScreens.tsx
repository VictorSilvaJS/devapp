import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  PropertyFilters,
  PropertyProjection,
  PropertyStatus,
} from '../contracts';
import { useHttpSession } from '../HttpSessionContext';
import {
  HttpButton,
  HttpFeedback,
  HttpField,
  HttpParagraph,
  HttpScreen,
  HttpTitle,
  controlledUiError,
} from '../ui';
import { colors, spacing, typography } from '../../theme';

const ACCESS_LABELS: Record<PropertyProjection['tipo_acesso'], string> = {
  admin: 'Administrador',
  titular: 'Titular',
  usuario_autorizado: 'Usuário autorizado',
  colaborador: 'Colaborador',
};

function PropertyCard({
  item,
  onPress,
}: {
  readonly item: PropertyProjection;
  readonly onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.cardTitle}>{item.nome}</Text>
      <Text style={styles.cardText}>
        {item.municipio_nome}/{item.uf_sigla}
      </Text>
      <Text style={styles.cardText}>Titular: {item.titular.nome}</Text>
      <Text style={styles.badge}>{ACCESS_LABELS[item.tipo_acesso]}</Text>
    </Pressable>
  );
}

export function HttpPropertiesScreen({ navigation }: any) {
  const { runtime } = useHttpSession();
  const [items, setItems] = React.useState<readonly PropertyProjection[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [searchDraft, setSearchDraft] = React.useState('');
  const [ufDraft, setUfDraft] = React.useState('');
  const [municipalityDraft, setMunicipalityDraft] = React.useState('');
  const [statusDraft, setStatusDraft] = React.useState<PropertyStatus | undefined>();
  const [filters, setFilters] = React.useState<PropertyFilters>({ limite: 50 });
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestGeneration = React.useRef(0);
  const loadingMoreRef = React.useRef(false);
  const lastRequestedCursorRef = React.useRef<string | null>(null);

  const load = React.useCallback(async (
    activeFilters: PropertyFilters,
    append: boolean,
  ) => {
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
      setItems([]);
      setNextCursor(null);
      setLoading(true);
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
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [runtime]);

  React.useEffect(() => {
    void load(filters, false);
  }, [filters, load]);

  const applyFilters = () => {
    setFilters({
      limite: 50,
      ...(searchDraft.trim() ? { busca: searchDraft.trim() } : {}),
      ...(ufDraft.trim() ? { uf: ufDraft.trim().toUpperCase() } : {}),
      ...(municipalityDraft.trim()
        ? { municipio: municipalityDraft.trim() }
        : {}),
      ...(statusDraft ? { status: statusDraft } : {}),
    });
  };

  const loadMore = () => {
    if (
      !nextCursor ||
      loading ||
      loadingMoreRef.current ||
      lastRequestedCursorRef.current === nextCursor
    ) return;
    lastRequestedCursorRef.current = nextCursor;
    void load({ ...filters, cursor: nextCursor }, true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.filters}>
        <HttpField
          label="Busca"
          value={searchDraft}
          onChangeText={setSearchDraft}
          autoCapitalize="sentences"
          placeholder="Nome da Propriedade"
        />
        <View style={styles.filterRow}>
          <View style={styles.filterCell}>
            <HttpField
              label="UF"
              value={ufDraft}
              onChangeText={setUfDraft}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <View style={styles.filterCellWide}>
            <HttpField
              label="Município"
              value={municipalityDraft}
              onChangeText={setMunicipalityDraft}
              autoCapitalize="words"
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <HttpButton
            title={statusDraft === 'ativa' ? 'Status: ativa' : statusDraft === 'inativa' ? 'Status: inativa' : 'Status: todos'}
            variant="secondary"
            onPress={() => setStatusDraft((current) => (
              current === undefined ? 'ativa' : current === 'ativa' ? 'inativa' : undefined
            ))}
          />
          <View style={styles.filterCellWide}>
            <HttpButton title="Aplicar filtros" onPress={applyFilters} />
          </View>
        </View>
      </View>
      <HttpFeedback message={error} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyCard
              item={item}
              onPress={() => navigation.navigate('PropertyDetail', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={(
            <HttpParagraph>Nenhuma Propriedade encontrada.</HttpParagraph>
          )}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

export function HttpPropertyDetailScreen({ route }: any) {
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
    return () => {
      active = false;
    };
  }, [id, runtime]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <HttpScreen>
      <HttpTitle>{property?.nome ?? 'Propriedade'}</HttpTitle>
      <HttpFeedback message={error} />
      {property ? (
        <>
          <HttpParagraph>
            {property.municipio_nome}/{property.uf_sigla}
          </HttpParagraph>
          <HttpParagraph>Titular: {property.titular.nome}</HttpParagraph>
          <HttpParagraph>
            Área total: {property.area_total === null ? 'Não informada' : `${property.area_total} ha`}
          </HttpParagraph>
          <HttpParagraph>
            Cultura principal: {property.cultura_principal ?? 'Não informada'}
          </HttpParagraph>
          <HttpParagraph>Status: {property.status}</HttpParagraph>
          <HttpParagraph>
            Tipo de acesso: {ACCESS_LABELS[property.tipo_acesso]}
          </HttpParagraph>
          <HttpFeedback
            kind="info"
            message="Consulta somente leitura. Dados operacionais, mapas e métricas permanecem indisponíveis no modo HTTP desta fase."
          />
        </>
      ) : null}
    </HttpScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  filters: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  filterCell: { width: 88 },
  filterCellWide: { flex: 1 },
  list: { padding: spacing.screen, gap: spacing.md, flexGrow: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    gap: spacing.xs,
  },
  cardTitle: { color: colors.text, fontSize: typography.fontBody, fontWeight: '700' },
  cardText: { color: colors.textLight, fontSize: 14 },
  badge: {
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
  },
});
