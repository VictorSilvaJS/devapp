import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import SearchBar from '../../components/SearchBar';
import SectionCard from '../../components/SectionCard';
import SegmentedChips from '../../components/SegmentedChips';
import { colors, semanticColors, shadows, spacing, typography } from '../../theme';
import {
  administrativeUserEmptyState,
  administrativeUserListStateForPartition,
  type AdministrativeUserReadFailure,
} from '../administrativeUserListController';
import {
  administrativeUserDetailStateForTarget,
} from '../administrativeUserDetailController';
import {
  administrativeUserNavigationCapabilities,
  administrativeUserSessionPartition,
} from '../administrativeUserAccess';
import type { AdministrativeUserDataBoundary } from '../administrativeUserDataBoundary';
import type { AdministrativeUserRepository } from '../administrativeUserRepository';
import type { AdministrativeUserControllerFactory } from '../runtime';
import type {
  AdministrativeUserFilters,
  AdministrativeUserListItem,
  HttpProfile,
  HttpUserStatus,
} from '../contracts';
import { HttpDetailHeader, HttpTabHeader } from '../HttpAppHeader';
import { useHttpSession } from '../HttpSessionContext';
import { isCanonicalUuidV4 } from '../decoders';
import { HttpButton, HttpFeedback } from '../ui';

type ProfileFilter = 'todos' | HttpProfile;
type StatusFilter = 'todos' | HttpUserStatus;

const PROFILE_LABELS: Readonly<Record<HttpProfile, string>> = {
  admin: 'Administrador',
  colaborador: 'Colaborador',
  produtor: 'Produtor',
};

const STATUS_LABELS: Readonly<Record<HttpUserStatus, string>> = {
  pendente: 'Pendente',
  ativo: 'Ativo',
  inativo: 'Inativo',
};

const FORBIDDEN_FAILURE: AdministrativeUserReadFailure = Object.freeze({
  kind: 'forbidden',
  message: 'Somente Administradores podem consultar Usuários.',
  retryable: false,
});

const INVALID_ID_FAILURE: AdministrativeUserReadFailure = Object.freeze({
  kind: 'invalid_request',
  message: 'O ID do Usuário é inválido.',
  retryable: false,
});

function useControllerDisposal(controller: Readonly<{ dispose(): void }>) {
  const lifecycle = React.useRef<Readonly<{
    controller: Readonly<{ dispose(): void }>;
    generation: number;
  }> | null>(null);
  React.useEffect(() => {
    const generation = (lifecycle.current?.generation ?? 0) + 1;
    lifecycle.current = { controller, generation };
    return () => {
      queueMicrotask(() => {
        const current = lifecycle.current;
        if (
          current?.controller !== controller ||
          current.generation === generation
        ) {
          controller.dispose();
        }
      });
    };
  }, [controller]);
}

function useAdministrativeUserList(
  controllerFactory: AdministrativeUserControllerFactory,
  repository: AdministrativeUserRepository,
  boundary: AdministrativeUserDataBoundary,
  partitionKey: string | null,
  enabled: boolean,
) {
  const controller = React.useMemo(
    () => controllerFactory.createList(repository, boundary),
    [boundary, controllerFactory, repository],
  );
  const subscribe = React.useCallback(
    (listener: () => void) => controller.subscribe(listener),
    [controller],
  );
  const getSnapshot = React.useCallback(() => controller.snapshot, [controller]);
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const current = administrativeUserListStateForPartition(snapshot, partitionKey);

  React.useLayoutEffect(() => {
    controller.synchronizePartition(partitionKey);
    if (enabled) void controller.ensureInitialLoad();
  }, [controller, enabled, partitionKey]);

  useControllerDisposal(controller);

  return { controller, current };
}

function useAdministrativeUserDetail(
  controllerFactory: AdministrativeUserControllerFactory,
  repository: AdministrativeUserRepository,
  boundary: AdministrativeUserDataBoundary,
  partitionKey: string | null,
  enabled: boolean,
  userId: string,
) {
  const controller = React.useMemo(
    () => controllerFactory.createDetail(repository, boundary),
    [boundary, controllerFactory, repository],
  );
  const subscribe = React.useCallback(
    (listener: () => void) => controller.subscribe(listener),
    [controller],
  );
  const getSnapshot = React.useCallback(() => controller.snapshot, [controller]);
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const current = administrativeUserDetailStateForTarget(
    snapshot,
    userId,
    partitionKey,
  );

  React.useLayoutEffect(() => {
    const changed = controller.synchronizePartition(partitionKey);
    if (enabled && (changed || controller.snapshot.requestedUserId !== userId)) {
      void controller.load(userId);
    }
  }, [controller, enabled, partitionKey, userId]);

  useControllerDisposal(controller);

  return { controller, current };
}

function statusPalette(status: HttpUserStatus) {
  if (status === 'ativo') {
    return {
      backgroundColor: semanticColors.success.surface,
      color: semanticColors.success.text,
    };
  }
  if (status === 'pendente') {
    return {
      backgroundColor: semanticColors.warning.surface,
      color: semanticColors.warning.text,
    };
  }
  return {
    backgroundColor: semanticColors.error.surface,
    color: semanticColors.error.text,
  };
}

function AdministrativeUserCard({
  user,
  onPress,
}: {
  readonly user: AdministrativeUserListItem;
  readonly onPress: () => void;
}) {
  const palette = statusPalette(user.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir Usuário ${user.nome}`}
      onPress={onPress}
      style={({ pressed }) => [styles.userCard, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.nome.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.userName} numberOfLines={2}>{user.nome}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        <View style={styles.badges}>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{PROFILE_LABELS[user.perfil]}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: palette.backgroundColor }]}>
            <Text style={[styles.statusBadgeText, { color: palette.color }]}>
              {STATUS_LABELS[user.status]}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function FailurePanel({
  failure,
  onRetry,
}: {
  readonly failure: AdministrativeUserReadFailure;
  readonly onRetry?: () => void;
}) {
  const title = failure.kind === 'forbidden'
    ? 'Acesso restrito'
    : failure.kind === 'session_expired'
      ? 'Sessão expirada'
      : failure.kind === 'not_found'
        ? 'Usuário não encontrado'
        : 'Usuários indisponíveis';
  return (
    <View style={styles.failurePanel}>
      <Ionicons
        name={failure.kind === 'forbidden' ? 'lock-closed-outline' : 'cloud-offline-outline'}
        size={48}
        color={colors.muted}
      />
      <Text style={styles.failureTitle}>{title}</Text>
      <HttpFeedback message={failure.message} />
      {onRetry ? <HttpButton title="Tentar novamente" onPress={onRetry} /> : null}
    </View>
  );
}

export function HttpAdministrativeUsersScreen({ navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).usersTab) {
    return (
      <View style={styles.container}>
        <FailurePanel failure={FORBIDDEN_FAILURE} />
      </View>
    );
  }
  return <HttpAdministrativeUsersAdminSurface navigation={navigation} />;
}

function HttpAdministrativeUsersAdminSurface({ navigation }: any) {
  const { runtime, snapshot, sessionEpoch } = useHttpSession();
  const capabilities = administrativeUserNavigationCapabilities(snapshot);
  const isAdmin = capabilities.usersTab;
  const partitionKey = administrativeUserSessionPartition(snapshot, sessionEpoch);
  const { controller, current } = useAdministrativeUserList(
    runtime.administrativeUserControllers,
    runtime.administrativeUsers,
    runtime.administrativeUserData,
    partitionKey,
    isAdmin,
  );
  const [searchDraft, setSearchDraft] = React.useState('');
  const [profileDraft, setProfileDraft] = React.useState<ProfileFilter>('todos');
  const [statusDraft, setStatusDraft] = React.useState<StatusFilter>('todos');
  const [filtersVisible, setFiltersVisible] = React.useState(false);

  const updateFilters = (filters: AdministrativeUserFilters) => {
    void controller.setFilters(filters);
  };
  const applySearch = () => {
    const search = searchDraft.trim();
    updateFilters({
      ...current.filters,
      busca: search || undefined,
      cursor: undefined,
    });
  };
  const restoreDrafts = () => {
    setProfileDraft(current.filters.perfil ?? 'todos');
    setStatusDraft(current.filters.status ?? 'todos');
  };
  const applyFilters = () => {
    updateFilters({
      limite: current.filters.limite ?? 50,
      busca: current.filters.busca,
      perfil: profileDraft === 'todos' ? undefined : profileDraft,
      status: statusDraft === 'todos' ? undefined : statusDraft,
    });
    setFiltersVisible(false);
  };
  const clearDrafts = () => {
    setProfileDraft('todos');
    setStatusDraft('todos');
  };
  const clearAll = () => {
    setSearchDraft('');
    clearDrafts();
    updateFilters({ limite: 50 });
  };

  const activeFilters = [
    current.filters.busca ? {
      key: 'busca',
      label: `Busca: ${current.filters.busca}`,
      icon: 'search-outline' as const,
      onRemove: () => {
        setSearchDraft('');
        updateFilters({ ...current.filters, busca: undefined });
      },
    } : null,
    current.filters.perfil ? {
      key: 'perfil',
      label: PROFILE_LABELS[current.filters.perfil],
      icon: 'people-outline' as const,
      onRemove: () => {
        setProfileDraft('todos');
        updateFilters({ ...current.filters, perfil: undefined });
      },
    } : null,
    current.filters.status ? {
      key: 'status',
      label: STATUS_LABELS[current.filters.status],
      icon: 'checkmark-circle-outline' as const,
      onRemove: () => {
        setStatusDraft('todos');
        updateFilters({ ...current.filters, status: undefined });
      },
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const empty = administrativeUserEmptyState(current.filters);
  const retryInitial = current.failure?.retryable
    ? () => { void controller.retry(); }
    : undefined;

  const footer = current.loadingMore ? (
    <View style={styles.footerBusy}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>Carregando mais Usuários...</Text>
    </View>
  ) : current.nextPageFailure ? (
    <View style={styles.nextPageFailure}>
      <HttpFeedback message={current.nextPageFailure.message} />
      <HttpButton
        title={current.nextPageFailure.retryable
          ? 'Tentar carregar novamente'
          : 'Atualizar lista'}
        onPress={() => {
          if (current.nextPageFailure?.retryable) {
            void controller.loadMore();
          } else {
            void controller.refresh();
          }
        }}
      />
    </View>
  ) : current.nextCursor ? (
    <View style={styles.loadMoreButton}>
      <HttpButton title="Carregar mais" onPress={() => {
        void controller.loadMore();
      }} />
    </View>
  ) : <View style={styles.footerSpace} />;

  return (
    <View style={styles.container}>
      <HttpTabHeader title="Usuários" navigation={navigation} />
      <LinearGradient colors={[colors.white, colors.backgroundSoft]} style={styles.topBar}>
        <SearchBar
          value={searchDraft}
          onChangeText={setSearchDraft}
          onClear={() => {
            setSearchDraft('');
            updateFilters({ ...current.filters, busca: undefined });
          }}
          onSubmitEditing={applySearch}
          returnKeyType="search"
          placeholder="Buscar nome, e-mail ou documento"
          containerStyle={styles.searchBar}
        />
        <FilterTrigger
          activeCount={activeFilters.filter((item) => item.key !== 'busca').length}
          onPress={() => {
            restoreDrafts();
            setFiltersVisible(true);
          }}
          style={styles.filterButton}
        />
      </LinearGradient>

      {current.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando Usuários...</Text>
        </View>
      ) : current.failure && current.items.length === 0 ? (
        <FailurePanel failure={current.failure} onRetry={retryInitial} />
      ) : (
        <FlatList
          data={current.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AdministrativeUserCard
              user={item}
              onPress={() => navigation.navigate('AdministrativeUserDetail', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={current.refreshing}
          onRefresh={() => { void controller.refresh(); }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          ListHeaderComponent={(
            <>
              <ActiveFilterBar items={activeFilters} onClear={clearAll} />
              {current.failure ? (
                <View style={styles.refreshFailure}>
                  <HttpFeedback message={current.failure.message} />
                  {current.failure.retryable ? (
                    <HttpButton title="Tentar novamente" onPress={() => {
                      void controller.retry();
                    }} />
                  ) : null}
                </View>
              ) : null}
            </>
          )}
          ListEmptyComponent={(
            <EmptyState
              icon={activeFilters.length > 0 ? 'search-outline' : 'people-outline'}
              title={empty.title}
              message={empty.message}
              style={styles.emptyState}
            />
          )}
          ListFooterComponent={footer}
        />
      )}

      <FilterBottomSheet
        visible={filtersVisible}
        subtitle="Busca, perfil e status são aplicados pelo servidor."
        onRequestClose={() => {
          restoreDrafts();
          setFiltersVisible(false);
        }}
        onClear={clearDrafts}
        onApply={applyFilters}
      >
        <FilterSection title="Perfil">
          <SegmentedChips<ProfileFilter>
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'admin', label: 'Administradores' },
              { value: 'colaborador', label: 'Colaboradores' },
              { value: 'produtor', label: 'Produtores' },
            ]}
            value={profileDraft}
            onChange={setProfileDraft}
          />
        </FilterSection>
        <FilterSection title="Status">
          <SegmentedChips<StatusFilter>
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'pendente', label: 'Pendentes' },
              { value: 'ativo', label: 'Ativos' },
              { value: 'inativo', label: 'Inativos' },
            ]}
            value={statusDraft}
            onChange={setStatusDraft}
          />
        </FilterSection>
      </FilterBottomSheet>
    </View>
  );
}

export function HttpAdministrativeUserDetailScreen({ route, navigation }: any) {
  const { snapshot } = useHttpSession();
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    return (
      <View style={styles.container}>
        <FailurePanel failure={FORBIDDEN_FAILURE} />
      </View>
    );
  }
  const id = typeof route.params?.id === 'string' ? route.params.id : '';
  if (!isCanonicalUuidV4(id)) {
    return (
      <View style={styles.container}>
        <HttpDetailHeader title="Usuário" navigation={navigation} />
        <FailurePanel failure={INVALID_ID_FAILURE} />
      </View>
    );
  }
  return (
    <HttpAdministrativeUserDetailAdminSurface
      id={id}
      navigation={navigation}
    />
  );
}

function HttpAdministrativeUserDetailAdminSurface({
  id,
  navigation,
}: Readonly<{ readonly id: string; readonly navigation: any }>) {
  const { runtime, snapshot, sessionEpoch } = useHttpSession();
  const partitionKey = administrativeUserSessionPartition(snapshot, sessionEpoch);
  const { controller, current } = useAdministrativeUserDetail(
    runtime.administrativeUserControllers,
    runtime.administrativeUsers,
    runtime.administrativeUserData,
    partitionKey,
    true,
    id,
  );
  const { user, failure, loading } = current;

  const retry = failure?.retryable
    ? () => { void controller.retry(); }
    : undefined;

  return (
    <View style={styles.container}>
      <HttpDetailHeader title={user?.nome ?? 'Usuário'} navigation={navigation} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Carregando Usuário...</Text>
        </View>
      ) : failure ? (
        <FailurePanel failure={failure} onRetry={retry} />
      ) : user ? (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          style={styles.detailGradient}
        >
          <ScrollView contentContainerStyle={styles.detailContent}>
            <View style={styles.detailHero}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>
                  {user.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.detailHeroText}>
                <Text style={styles.detailTitle}>{user.nome}</Text>
                <Text style={styles.detailSubtitle}>{user.email}</Text>
                <Text style={styles.detailAccess}>{PROFILE_LABELS[user.perfil]}</Text>
              </View>
            </View>

            <InfoBox message="Consulta autoritativa do servidor. Nenhuma credencial, senha, token, desafio, outbox ou campo demonstrativo é carregado nesta tela." />

            <SectionCard title="Dados administrativos" icon="person-outline">
              <DetailRow label="Perfil" value={PROFILE_LABELS[user.perfil]} />
              <DetailRow label="Status" value={STATUS_LABELS[user.status]} />
              <DetailRow label="E-mail" value={user.email} />
              <DetailRow label="Telefone" value={user.telefone ?? 'Não informado'} />
              <DetailRow label="Documento" value={user.documento ?? 'Não informado'} />
              {user.perfil === 'produtor' && user.produtor_id ? (
                <DetailRow label="ID do Produtor" value={user.produtor_id} />
              ) : null}
              <DetailRow label="Versão" value={String(user.versao)} last />
            </SectionCard>

            <SectionCard title="Observações" icon="document-text-outline">
              <Text style={styles.notes}>{user.observacoes ?? 'Nenhuma observação informada.'}</Text>
            </SectionCard>

            <SectionCard title="Histórico cadastral" icon="time-outline">
              <DetailRow label="Criado em" value={formatTimestamp(user.criado_em)} />
              <DetailRow label="Atualizado em" value={formatTimestamp(user.atualizado_em)} last />
            </SectionCard>
          </ScrollView>
        </LinearGradient>
      ) : null}
    </View>
  );
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
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
      <Text style={styles.detailValue} selectable>{value}</Text>
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
  list: {
    flexGrow: 1,
    padding: spacing.screen,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textLight, fontSize: typography.fontBody },
  failurePanel: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  failureTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: spacing.radius,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  pressed: { opacity: 0.82 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: typography.weightBold },
  cardContent: { flex: 1, minWidth: 0 },
  userName: { color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightBold },
  userEmail: { color: colors.textLight, fontSize: typography.fontCaption + 1, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  profileBadge: { backgroundColor: colors.accent, borderRadius: spacing.radiusSm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  profileBadgeText: { color: colors.primary, fontSize: typography.fontCaption, fontWeight: typography.weightBold },
  statusBadge: { borderRadius: spacing.radiusSm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: typography.fontCaption, fontWeight: typography.weightBold },
  emptyState: { minHeight: 320 },
  refreshFailure: { gap: spacing.sm, marginBottom: spacing.md },
  footerBusy: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  nextPageFailure: { gap: spacing.sm, paddingVertical: spacing.md },
  loadMoreButton: { paddingVertical: spacing.md },
  footerSpace: { height: spacing.md },
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
  detailSubtitle: { color: colors.textLight, fontSize: typography.fontBody - 1, marginTop: spacing.xs },
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
  notes: { color: colors.text, fontSize: typography.fontBody, lineHeight: 22 },
});
