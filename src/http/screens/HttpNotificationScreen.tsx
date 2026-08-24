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
  NotificationProjection,
  NotificationState,
  SessionSnapshot,
} from '../contracts';
import { ApiResponseError } from '../backendApi';
import { InvalidBackendResponseError } from '../decoders';
import { useHttpNotifications } from '../HttpNotificationContext';
import { useHttpSession } from '../HttpSessionContext';
import { NotificationOpenGate } from '../notificationOpenGate';
import {
  controlledUiError,
  HttpButton,
  HttpFeedback,
  HttpParagraph,
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
  return (
    <View style={[styles.card, item.lida_em === null && styles.cardUnread]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir destino: ${item.conteudo.titulo}`}
        disabled={busy}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.conteudo.titulo}</Text>
          {item.lida_em === null ? <Text style={styles.unreadBadge}>Nova</Text> : null}
        </View>
        <Text style={styles.cardSummary}>{item.conteudo.resumo}</Text>
        <Text style={styles.cardDate}>
          {new Date(item.criada_em).toLocaleString()}
        </Text>
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(Object.keys(FILTER_LABELS) as NotificationState[]).map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{ selected: notifications.stateFilter === filter }}
              disabled={interactionBusy}
              onPress={() => {
                if (!openGate.busy) notifications.setStateFilter(filter);
              }}
              style={[
                styles.filter,
                notifications.stateFilter === filter && styles.filterActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  notifications.stateFilter === filter && styles.filterTextActive,
                ]}
              >
                {FILTER_LABELS[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
        <HttpButton
          title={notifications.markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
          variant="secondary"
          disabled={
            interactionBusy ||
            notifications.unreadCount === 0
          }
          onPress={() => {
            if (!openGate.busy) {
              void notifications.markAllRead().catch(() => undefined);
            }
          }}
        />
      </View>
      <HttpFeedback message={openError ?? notifications.error} />
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
            <HttpParagraph>Nenhuma notificação disponível.</HttpParagraph>
          )}
          ListFooterComponent={notifications.loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: spacing.screen, paddingBottom: spacing.sm, gap: spacing.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterText: { color: colors.textLight, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: colors.primaryDark },
  list: { flexGrow: 1, padding: spacing.screen, gap: spacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardUnread: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.text, fontSize: typography.fontBody, fontWeight: '700' },
  cardSummary: { color: colors.textLight, fontSize: typography.fontBody, lineHeight: 22 },
  cardDate: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  unreadBadge: {
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionCell: { flex: 1 },
  pressed: { opacity: 0.75 },
});
