import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EmptyState from '../../components/EmptyState';
import SegmentedChips from '../../components/SegmentedChips';
import type {
  NotificationProjection,
  NotificationState,
  SessionSnapshot,
} from '../contracts';
import { ApiResponseError } from '../backendApi';
import { InvalidBackendResponseError } from '../decoders';
import { HttpTabHeader } from '../HttpAppHeader';
import { useHttpNotifications } from '../HttpNotificationContext';
import { useHttpSession } from '../HttpSessionContext';
import { NotificationOpenGate } from '../notificationOpenGate';
import {
  controlledUiError,
  HttpButton,
  HttpFeedback,
} from '../ui';
import { colors, spacing, typography } from '../../theme';

const FILTER_LABELS: Readonly<Record<NotificationState, string>> = {
  todas: 'Todas',
  nao_lida: 'Não lidas',
  lida: 'Lidas',
};

function NotificationCard({
  item,
  busy,
  onOpen,
  onRead,
  onDiscard,
}: {
  readonly item: NotificationProjection;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onRead: () => void;
  readonly onDiscard: () => void;
}) {
  const priorityColor = item.prioridade === 'alta'
    ? colors.error
    : item.prioridade === 'baixa'
      ? colors.muted
      : colors.primary;
  const icon = item.tipo_evento === 'conta.senha_alterada.v1'
    ? 'key-outline'
    : item.tipo_evento === 'conta.email_principal_alterado.v1'
      ? 'mail-outline'
      : 'shield-checkmark-outline';

  return (
    <View style={[styles.card, item.lida_em === null && styles.cardUnread]}>
      {item.lida_em === null ? <View style={styles.unreadIndicator} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir destino: ${item.conteudo.titulo}`}
        disabled={busy}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.cardMain}>
          <View style={[styles.iconContainer, { backgroundColor: `${priorityColor}20` }]}>
            <Ionicons name={icon} size={24} color={priorityColor} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.conteudo.titulo}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.criada_em).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <Text style={styles.cardSummary}>{item.conteudo.resumo}</Text>
            {item.prioridade === 'alta' ? (
              <View style={styles.priorityBadge}>
                <Ionicons name="warning-outline" size={14} color={colors.error} />
                <Text style={styles.priorityText}>Prioridade alta</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {item.lida_em === null ? (
          <View style={styles.actionCell}>
            <HttpButton
              title="Marcar como lida"
              variant="secondary"
              disabled={busy}
              onPress={onRead}
            />
          </View>
        ) : null}
        <View style={styles.actionCell}>
          <HttpButton
            title="Descartar"
            variant="secondary"
            disabled={busy}
            onPress={onDiscard}
          />
        </View>
      </View>
    </View>
  );
}

export function HttpNotificationScreen({ navigation }: any) {
  const notifications = useHttpNotifications();
  const { runtime, snapshot, sessionEpoch } = useHttpSession();
  const [openError, setOpenError] = React.useState<string | null>(null);
  const [opening, setOpening] = React.useState(false);
  const openGate = React.useRef(new NotificationOpenGate()).current;

  React.useEffect(() => {
    return () => {
      openGate.invalidate();
    };
  }, [openGate]);

  const open = async (item: NotificationProjection) => {
    const expectedSnapshot = snapshot;
    if (
      expectedSnapshot === null ||
      runtime.session.epoch !== sessionEpoch
    ) return;
    const lease = openGate.tryAcquire();
    if (lease === null) return;
    const sameIdentity = (candidate: SessionSnapshot | null): boolean => (
      lease.isActive() &&
      runtime.session.epoch === sessionEpoch &&
      candidate !== null &&
      candidate.usuario.organizacao_id ===
        expectedSnapshot.usuario.organizacao_id &&
      candidate.usuario.id === expectedSnapshot.usuario.id &&
      candidate.usuario.perfil === expectedSnapshot.usuario.perfil &&
      candidate.usuario.versao_autorizacao ===
        expectedSnapshot.usuario.versao_autorizacao &&
      candidate.escopo.modo === expectedSnapshot.escopo.modo &&
      candidate.escopo.versao === expectedSnapshot.escopo.versao
    );
    setOpening(true);
    setOpenError(null);
    try {
      const destination = await notifications.resolveDestination(item.id);
      if (!sameIdentity(runtime.session.snapshot)) return;
      if (
        destination.recurso_tipo !== 'conta' ||
        destination.recurso_id !== expectedSnapshot.usuario.id
      ) {
        throw new InvalidBackendResponseError();
      }
      const revalidated = await runtime.session.revalidate();
      if (!sameIdentity(revalidated) || !sameIdentity(runtime.session.snapshot)) {
        return;
      }
      navigation.navigate('Account');
    } catch (caught) {
      if (!sameIdentity(runtime.session.snapshot)) return;
      setOpenError(controlledUiError(caught));
      if (
        caught instanceof ApiResponseError &&
        (caught.status === 403 || caught.status === 404)
      ) {
        void notifications.refresh().catch(() => undefined);
      }
    } finally {
      if (lease.release()) setOpening(false);
    }
  };

  const interactionBusy = opening || notifications.mutating || notifications.resolving;

  return (
    <View style={styles.container}>
      <HttpTabHeader
        title="Notificações"
        navigation={navigation}
        showNotifications={false}
      />
      <View style={styles.toolbar}>
        <SegmentedChips
          options={(Object.keys(FILTER_LABELS) as NotificationState[]).map((filter) => ({
            value: filter,
            label: FILTER_LABELS[filter],
            count: filter === 'nao_lida' ? notifications.unreadCount : undefined,
            disabled: interactionBusy,
          }))}
          value={notifications.stateFilter}
          onChange={(filter) => {
            if (!openGate.busy) notifications.setStateFilter(filter);
          }}
          horizontal
        />
        <TouchableOpacity
          style={[
            styles.markAllButton,
            (interactionBusy || notifications.unreadCount === 0) && styles.disabled,
          ]}
          disabled={
            interactionBusy ||
            notifications.unreadCount === 0
          }
          onPress={() => {
            if (!openGate.busy) {
              void notifications.markAllRead().catch(() => undefined);
            }
          }}
        >
          <Ionicons name="checkmark-done" size={20} color={colors.primary} />
          <Text style={styles.markAllText}>
            {notifications.markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
          </Text>
        </TouchableOpacity>
      </View>
      {openError ?? notifications.error ? (
        <View style={styles.feedbackContainer}>
          <HttpFeedback message={openError ?? notifications.error} />
        </View>
      ) : null}
      {notifications.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              busy={
                interactionBusy ||
                notifications.busyIds.has(item.id)
              }
              onOpen={() => void open(item)}
              onRead={() => {
                if (!openGate.busy) {
                  void notifications.markRead(item.id).catch(() => undefined);
                }
              }}
              onDiscard={() => {
                if (!openGate.busy) {
                  void notifications.discard(item.id).catch(() => undefined);
                }
              }}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={notifications.refreshing}
          onRefresh={() => {
            if (!interactionBusy && !openGate.busy) {
              void notifications.refresh();
            }
          }}
          onEndReached={() => {
            if (!interactionBusy && !openGate.busy) {
              void notifications.loadMore();
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={(
            <EmptyState
              icon="notifications-off-outline"
              title="Nenhuma notificação"
              message="Você está em dia. Não há notificações disponíveis neste filtro."
              style={styles.emptyState}
            />
          )}
          ListFooterComponent={notifications.loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  markAllButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  markAllText: { color: colors.primary, fontSize: typography.fontCaption + 1, fontWeight: typography.weightSemibold },
  disabled: { opacity: 0.5 },
  feedbackContainer: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: `${colors.accent}10` },
  unreadIndicator: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardMain: { flexDirection: 'row' },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardContent: { flex: 1, minWidth: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { flex: 1, color: colors.text, fontSize: typography.fontBody, fontWeight: '700' },
  cardSummary: { color: colors.textLight, fontSize: typography.fontCaption + 1, lineHeight: 18 },
  cardDate: { color: colors.muted, fontSize: typography.fontCaption },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
    backgroundColor: `${colors.error}20`,
  },
  priorityText: { color: colors.error, fontSize: typography.fontCaption, fontWeight: typography.weightSemibold },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionCell: { flex: 1 },
  pressed: { opacity: 0.75 },
  emptyState: { minHeight: 360 },
});
