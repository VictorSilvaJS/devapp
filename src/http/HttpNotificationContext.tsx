import React from 'react';

import { ApiResponseError } from './backendApi';
import type {
  NotificationDestination,
  NotificationProjection,
  NotificationState,
} from './contracts';
import { InvalidBackendResponseError } from './decoders';
import { createNotificationIdempotencyKey } from './idempotencyKey';
import { ApiTransportError } from './httpTransport';
import { useHttpSession } from './HttpSessionContext';
import {
  NotificationContextCoordinator,
  type NotificationContextInvalidation,
} from './notificationContextCoordinator';
import { controlledUiError } from './ui';

interface HttpNotificationContextValue {
  readonly items: readonly NotificationProjection[];
  readonly unreadCount: number;
  readonly nextCursor: string | null;
  readonly stateFilter: NotificationState;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly loadingMore: boolean;
  readonly markingAll: boolean;
  readonly mutating: boolean;
  readonly resolving: boolean;
  readonly busyIds: ReadonlySet<string>;
  readonly error: string | null;
  setStateFilter(value: NotificationState): void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  discard(id: string): Promise<void>;
  resolveDestination(id: string): Promise<NotificationDestination>;
}

const HttpNotificationContext = React.createContext<
  HttpNotificationContextValue | null
>(null);

function shouldRetainCommandKey(error: unknown): boolean {
  return (
    error instanceof ApiTransportError ||
    error instanceof InvalidBackendResponseError ||
    (error instanceof ApiResponseError &&
      (error.status === 429 || error.status >= 500))
  );
}

function mergeUnique(
  current: readonly NotificationProjection[],
  incoming: readonly NotificationProjection[],
): readonly NotificationProjection[] {
  const known = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...incoming.filter((item) => !known.has(item.id)),
  ];
}

export function HttpNotificationProvider({ children }: React.PropsWithChildren) {
  const { runtime, snapshot, sessionEpoch } = useHttpSession();
  const [items, setItems] = React.useState<readonly NotificationProjection[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [stateFilter, setStateFilterState] =
    React.useState<NotificationState>('todas');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [mutating, setMutating] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState<ReadonlySet<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  const mounted = React.useRef(true);
  const initializedPartition = React.useRef<string | null>(null);
  const lastCountedSnapshot = React.useRef(snapshot);
  const stateFilterRef = React.useRef(stateFilter);
  const coordinator = React.useRef(new NotificationContextCoordinator()).current;
  const inFlightCommands = React.useRef(new Set<string>());
  const inFlightItems = React.useRef(new Set<string>());
  const mutationInFlight = React.useRef(false);
  const destinationInFlight = React.useRef(false);

  const partition = snapshot === null
    ? `none:${sessionEpoch}`
    : [
        snapshot.usuario.organizacao_id,
        snapshot.usuario.id,
        snapshot.usuario.versao_autorizacao,
        snapshot.escopo.versao,
        sessionEpoch,
      ].join(':');
  const partitionRef = React.useRef(partition);
  partitionRef.current = partition;
  stateFilterRef.current = stateFilter;

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      coordinator.invalidate('unmount');
    };
  }, [coordinator]);

  const isCurrentPartition = React.useCallback((expected: string): boolean => {
    return mounted.current && partitionRef.current === expected;
  }, []);

  const commandKey = React.useCallback((intent: string): string => {
    return coordinator.commandKey(intent, createNotificationIdempotencyKey);
  }, [coordinator]);

  const invalidateReads = React.useCallback((
    reason: NotificationContextInvalidation,
  ) => {
    coordinator.invalidate(reason);
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [coordinator]);

  const loadCount = React.useCallback(async (expectedPartition: string) => {
    const request = coordinator.beginCount();
    try {
      const count = await runtime.notifications.countUnread();
      if (
        isCurrentPartition(expectedPartition) &&
        coordinator.isCurrent(request)
      ) {
        setUnreadCount(count);
      }
    } catch (caught) {
      if (
        isCurrentPartition(expectedPartition) &&
        coordinator.isCurrent(request)
      ) {
        setError(controlledUiError(caught));
      }
    }
  }, [coordinator, isCurrentPartition, runtime]);

  const loadFirstPage = React.useCallback(async (
    expectedPartition: string,
    filter: NotificationState,
    mode: 'initial' | 'refresh',
  ) => {
    const request = coordinator.beginList();
    setLoadingMore(false);
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const page = await runtime.notifications.list({
        estado: filter,
        limite: 50,
      });
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === filter &&
        coordinator.isCurrent(request)
      ) {
        setItems(page.itens);
        setNextCursor(page.paginacao.proximo_cursor);
      }
    } catch (caught) {
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === filter &&
        coordinator.isCurrent(request)
      ) {
        setError(controlledUiError(caught));
      }
    } finally {
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === filter &&
        coordinator.isCurrent(request)
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [coordinator, isCurrentPartition, runtime]);

  const reloadConfirmed = React.useCallback(async (
    expectedPartition: string,
    filter: NotificationState,
    mode: 'initial' | 'refresh',
  ) => {
    if (isCurrentPartition(expectedPartition)) setError(null);
    await Promise.all([
      loadFirstPage(expectedPartition, filter, mode),
      loadCount(expectedPartition),
    ]);
  }, [isCurrentPartition, loadCount, loadFirstPage]);

  React.useEffect(() => {
    const identityChanged = initializedPartition.current !== partition;
    initializedPartition.current = partition;
    invalidateReads(identityChanged ? 'partition' : 'filter');
    setItems([]);
    setNextCursor(null);
    setError(null);
    setLoading(true);
    setRefreshing(false);
    if (identityChanged) {
      inFlightCommands.current.clear();
      inFlightItems.current.clear();
      mutationInFlight.current = false;
      destinationInFlight.current = false;
      setUnreadCount(0);
      setMarkingAll(false);
      setMutating(false);
      setResolving(false);
      setBusyIds(new Set());
    }
    void reloadConfirmed(partition, stateFilter, 'initial');
  }, [invalidateReads, partition, reloadConfirmed, stateFilter]);

  React.useEffect(() => {
    if (lastCountedSnapshot.current === snapshot) return;
    lastCountedSnapshot.current = snapshot;
    if (snapshot !== null && initializedPartition.current === partition) {
      void loadCount(partition);
    }
  }, [loadCount, partition, snapshot]);

  const setStateFilter = React.useCallback((value: NotificationState) => {
    if (stateFilterRef.current === value) return;
    invalidateReads('filter');
    setItems([]);
    setNextCursor(null);
    setError(null);
    setLoading(true);
    setRefreshing(false);
    setStateFilterState(value);
  }, [invalidateReads]);

  const refresh = React.useCallback(() => {
    return reloadConfirmed(
      partitionRef.current,
      stateFilterRef.current,
      'refresh',
    );
  }, [reloadConfirmed]);

  const loadMore = React.useCallback(async () => {
    const cursor = nextCursor;
    if (cursor === null) return;
    const request = coordinator.beginLoadMore();
    if (request === null) return;
    const expectedPartition = partitionRef.current;
    const expectedFilter = stateFilterRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await runtime.notifications.list({
        estado: expectedFilter,
        limite: 50,
        cursor,
      });
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === expectedFilter &&
        coordinator.isCurrent(request)
      ) {
        setItems((current) => mergeUnique(current, page.itens));
        setNextCursor(page.paginacao.proximo_cursor);
      }
    } catch (caught) {
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === expectedFilter &&
        coordinator.isCurrent(request)
      ) {
        setError(controlledUiError(caught));
      }
    } finally {
      if (
        isCurrentPartition(expectedPartition) &&
        stateFilterRef.current === expectedFilter &&
        coordinator.finishLoadMore(request)
      ) {
        setLoadingMore(false);
      }
    }
  }, [coordinator, isCurrentPartition, nextCursor, runtime]);

  const setItemBusy = React.useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const beginMutation = React.useCallback((intent: string, id?: string) => {
    if (
      mutationInFlight.current ||
      destinationInFlight.current ||
      inFlightCommands.current.has(intent) ||
      (id !== undefined && inFlightItems.current.has(id))
    ) {
      return false;
    }
    mutationInFlight.current = true;
    inFlightCommands.current.add(intent);
    if (id !== undefined) inFlightItems.current.add(id);
    setMutating(true);
    return true;
  }, []);

  const finishMutation = React.useCallback((
    expectedPartition: string,
    intent: string,
    id?: string,
  ) => {
    if (!isCurrentPartition(expectedPartition)) return;
    mutationInFlight.current = false;
    inFlightCommands.current.delete(intent);
    if (id !== undefined) inFlightItems.current.delete(id);
    setMutating(false);
    if (id !== undefined) setItemBusy(id, false);
  }, [isCurrentPartition, setItemBusy]);

  const markRead = React.useCallback(async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (current === undefined || current.lida_em !== null) return;
    const intent = `read:${id}`;
    if (!beginMutation(intent, id)) return;
    const key = commandKey(intent);
    const expectedPartition = partitionRef.current;
    setItemBusy(id, true);
    setError(null);
    try {
      const result = await runtime.notifications.markRead(id, key);
      if (!isCurrentPartition(expectedPartition)) return;
      if (result.id !== id) throw new InvalidBackendResponseError();
      coordinator.settleCommandKey(intent, key, 'confirmed');
      invalidateReads('mutation');
      setItems((existing) => (
        stateFilterRef.current === 'nao_lida'
          ? existing.filter((item) => item.id !== id)
          : existing.map((item) => (
              item.id === id ? { ...item, lida_em: result.lida_em } : item
            ))
      ));
      await reloadConfirmed(
        expectedPartition,
        stateFilterRef.current,
        'refresh',
      );
    } catch (caught) {
      if (isCurrentPartition(expectedPartition)) {
        coordinator.settleCommandKey(
          intent,
          key,
          shouldRetainCommandKey(caught) ? 'ambiguous' : 'definitive',
        );
        setError(controlledUiError(caught));
      }
      throw caught;
    } finally {
      finishMutation(expectedPartition, intent, id);
    }
  }, [
    beginMutation,
    commandKey,
    coordinator,
    finishMutation,
    invalidateReads,
    isCurrentPartition,
    items,
    reloadConfirmed,
    runtime,
    setItemBusy,
  ]);

  const markAllRead = React.useCallback(async () => {
    const intent = 'read-all';
    if (!beginMutation(intent)) return;
    const key = commandKey(intent);
    const expectedPartition = partitionRef.current;
    setMarkingAll(true);
    setError(null);
    try {
      const result = await runtime.notifications.markAllRead(key);
      if (!isCurrentPartition(expectedPartition)) return;
      coordinator.settleCommandKey(intent, key, 'confirmed');
      invalidateReads('mutation');
      const cutoff = Date.parse(result.corte_em);
      setItems((existing) => {
        if (stateFilterRef.current === 'nao_lida') {
          return existing.filter((item) => Date.parse(item.criada_em) > cutoff);
        }
        if (stateFilterRef.current === 'todas') {
          return existing.map((item) => (
            item.lida_em === null && Date.parse(item.criada_em) <= cutoff
              ? { ...item, lida_em: result.corte_em }
              : item
          ));
        }
        return existing;
      });
      await reloadConfirmed(
        expectedPartition,
        stateFilterRef.current,
        'refresh',
      );
    } catch (caught) {
      if (isCurrentPartition(expectedPartition)) {
        coordinator.settleCommandKey(
          intent,
          key,
          shouldRetainCommandKey(caught) ? 'ambiguous' : 'definitive',
        );
        setError(controlledUiError(caught));
      }
      throw caught;
    } finally {
      if (isCurrentPartition(expectedPartition)) setMarkingAll(false);
      finishMutation(expectedPartition, intent);
    }
  }, [
    beginMutation,
    commandKey,
    coordinator,
    finishMutation,
    invalidateReads,
    isCurrentPartition,
    reloadConfirmed,
    runtime,
  ]);

  const discard = React.useCallback(async (id: string) => {
    if (!items.some((item) => item.id === id)) return;
    const intent = `discard:${id}`;
    if (!beginMutation(intent, id)) return;
    const key = commandKey(intent);
    const expectedPartition = partitionRef.current;
    setItemBusy(id, true);
    setError(null);
    try {
      const result = await runtime.notifications.discard(id, key);
      if (!isCurrentPartition(expectedPartition)) return;
      if (result.id !== id) throw new InvalidBackendResponseError();
      coordinator.settleCommandKey(intent, key, 'confirmed');
      invalidateReads('mutation');
      setItems((existing) => existing.filter((item) => item.id !== id));
      await reloadConfirmed(
        expectedPartition,
        stateFilterRef.current,
        'refresh',
      );
    } catch (caught) {
      if (isCurrentPartition(expectedPartition)) {
        coordinator.settleCommandKey(
          intent,
          key,
          shouldRetainCommandKey(caught) ? 'ambiguous' : 'definitive',
        );
        setError(controlledUiError(caught));
      }
      throw caught;
    } finally {
      finishMutation(expectedPartition, intent, id);
    }
  }, [
    beginMutation,
    commandKey,
    coordinator,
    finishMutation,
    invalidateReads,
    isCurrentPartition,
    items,
    reloadConfirmed,
    runtime,
    setItemBusy,
  ]);

  const resolveDestination = React.useCallback(async (id: string) => {
    if (
      mutationInFlight.current ||
      destinationInFlight.current ||
      inFlightItems.current.has(id)
    ) {
      throw new Error('A notificação já possui uma ação em andamento.');
    }
    destinationInFlight.current = true;
    inFlightItems.current.add(id);
    const expectedPartition = partitionRef.current;
    setItemBusy(id, true);
    setResolving(true);
    setError(null);
    try {
      const destination = await runtime.notifications.resolveDestination(id);
      if (!isCurrentPartition(expectedPartition)) {
        throw new Error('A sessão mudou durante a solicitação.');
      }
      return destination;
    } catch (caught) {
      if (isCurrentPartition(expectedPartition)) {
        setError(controlledUiError(caught));
      }
      throw caught;
    } finally {
      if (isCurrentPartition(expectedPartition)) {
        destinationInFlight.current = false;
        inFlightItems.current.delete(id);
        setItemBusy(id, false);
        setResolving(false);
      }
    }
  }, [isCurrentPartition, runtime, setItemBusy]);

  const value = React.useMemo<HttpNotificationContextValue>(() => ({
    items,
    unreadCount,
    nextCursor,
    stateFilter,
    loading,
    refreshing,
    loadingMore,
    markingAll,
    mutating,
    resolving,
    busyIds,
    error,
    setStateFilter,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    discard,
    resolveDestination,
  }), [
    items,
    unreadCount,
    nextCursor,
    stateFilter,
    loading,
    refreshing,
    loadingMore,
    markingAll,
    mutating,
    resolving,
    busyIds,
    error,
    setStateFilter,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    discard,
    resolveDestination,
  ]);

  return (
    <HttpNotificationContext.Provider value={value}>
      {children}
    </HttpNotificationContext.Provider>
  );
}

export function useHttpNotifications(): HttpNotificationContextValue {
  const value = React.useContext(HttpNotificationContext);
  if (value === null) {
    throw new Error(
      'useHttpNotifications deve ser usado dentro de HttpNotificationProvider.',
    );
  }
  return value;
}
