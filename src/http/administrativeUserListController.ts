import { ApiResponseError, InvalidApiRequestError } from './backendApi';
import {
  AdministrativeUserAccessDeniedError,
  type AdministrativeUserRepository,
} from './administrativeUserRepository';
import {
  type AdministrativeUserBoundaryInvalidation,
  type AdministrativeUserDataBoundary,
  type AdministrativeUserReadLease,
} from './administrativeUserDataBoundary';
import type {
  AdministrativeUserFilters,
  AdministrativeUserListItem,
  AdministrativeUserPage,
} from './contracts';
import { InvalidBackendResponseError } from './decoders';
import { ApiTransportError } from './httpTransport';
import { SessionRequiredError } from './sessionCoordinator';

export type AdministrativeUserReadFailureKind =
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'incompatible_response'
  | 'unavailable'
  | 'unexpected';

export interface AdministrativeUserReadFailure {
  readonly kind: AdministrativeUserReadFailureKind;
  readonly message: string;
  readonly retryable: boolean;
}

export interface AdministrativeUserListState {
  readonly partitionKey: string | null;
  readonly filters: AdministrativeUserFilters;
  readonly items: readonly AdministrativeUserListItem[];
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly loadingMore: boolean;
  readonly failure: AdministrativeUserReadFailure | null;
  readonly nextPageFailure: AdministrativeUserReadFailure | null;
}

type Listener = () => void;

const EMPTY_ITEMS: readonly AdministrativeUserListItem[] = Object.freeze([]);
const DEFAULT_FILTERS: AdministrativeUserFilters = Object.freeze({ limite: 50 });

function failureMessage(kind: AdministrativeUserReadFailureKind): string {
  if (kind === 'session_expired') return 'Sua sessão expirou. Entre novamente.';
  if (kind === 'forbidden') return 'Somente Administradores podem consultar Usuários.';
  if (kind === 'not_found') return 'O Usuário não foi encontrado.';
  if (kind === 'invalid_request') return 'A solicitação informada é inválida.';
  if (kind === 'incompatible_response') {
    return 'O serviço retornou uma página incompatível. A paginação foi encerrada com segurança.';
  }
  if (kind === 'unavailable') {
    return 'Os Usuários estão temporariamente indisponíveis. Nenhum dado demonstrativo foi carregado.';
  }
  return 'Não foi possível carregar os Usuários.';
}

export function classifyAdministrativeUserReadFailure(
  error: unknown,
): AdministrativeUserReadFailure {
  let kind: AdministrativeUserReadFailureKind = 'unexpected';
  if (
    error instanceof SessionRequiredError ||
    (error instanceof ApiResponseError && error.status === 401)
  ) {
    kind = 'session_expired';
  } else if (
    error instanceof AdministrativeUserAccessDeniedError ||
    (error instanceof ApiResponseError && error.status === 403)
  ) {
    kind = 'forbidden';
  } else if (error instanceof ApiResponseError && error.status === 404) {
    kind = 'not_found';
  } else if (error instanceof InvalidApiRequestError) {
    kind = 'invalid_request';
  } else if (error instanceof InvalidBackendResponseError) {
    kind = 'incompatible_response';
  } else if (
    error instanceof ApiTransportError ||
    (error instanceof ApiResponseError &&
      (error.status === 429 || error.status >= 500))
  ) {
    kind = 'unavailable';
  }
  return Object.freeze({
    kind,
    message: failureMessage(kind),
    retryable: kind === 'unavailable',
  });
}

export function administrativeUserBoundaryFailure(
  invalidation: AdministrativeUserBoundaryInvalidation | null,
): AdministrativeUserReadFailure | null {
  if (invalidation !== 'invalid_session' && invalidation !== 'forbidden') {
    return null;
  }
  const kind = invalidation === 'invalid_session'
    ? 'session_expired'
    : 'forbidden';
  return Object.freeze({
    kind,
    message: failureMessage(kind),
    retryable: false,
  });
}

export function isAdministrativeUserAccessFailure(
  failure: AdministrativeUserReadFailure,
): boolean {
  return failure.kind === 'session_expired' || failure.kind === 'forbidden';
}

export function administrativeUserEmptyState(
  filters: AdministrativeUserFilters,
): Readonly<{ title: string; message: string }> {
  const filtered = Boolean(filters.busca || filters.perfil || filters.status);
  return Object.freeze(filtered
    ? {
        title: 'Nenhum resultado',
        message: 'Tente ajustar a busca ou limpar os filtros aplicados.',
      }
    : {
        title: 'Nenhum Usuário cadastrado',
        message: 'Nenhum Usuário administrativo foi retornado pelo servidor.',
      });
}

export function mergeAdministrativeUsers(
  current: readonly AdministrativeUserListItem[],
  incoming: readonly AdministrativeUserListItem[],
): readonly AdministrativeUserListItem[] {
  const known = new Set<string>();
  const merged: AdministrativeUserListItem[] = [];
  for (const item of [...current, ...incoming]) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    merged.push(item);
  }
  return Object.freeze(merged);
}

function countNewAdministrativeUsers(
  current: readonly AdministrativeUserListItem[],
  incoming: readonly AdministrativeUserListItem[],
): number {
  const known = new Set(current.map((item) => item.id));
  let added = 0;
  for (const item of incoming) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    added += 1;
  }
  return added;
}

function normalizeFilters(
  filters: AdministrativeUserFilters,
): AdministrativeUserFilters {
  return Object.freeze({
    limite: filters.limite ?? 50,
    ...(filters.busca ? { busca: filters.busca } : {}),
    ...(filters.perfil ? { perfil: filters.perfil } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  });
}

function filterKey(filters: AdministrativeUserFilters): string {
  return [
    filters.busca ?? '',
    filters.perfil ?? '',
    filters.status ?? '',
    String(filters.limite ?? 50),
  ].join('\u0000');
}

function state(input: AdministrativeUserListState): AdministrativeUserListState {
  return Object.freeze(input);
}

function incompatiblePagination(): InvalidBackendResponseError {
  return new InvalidBackendResponseError();
}

export function administrativeUserListStateForPartition(
  current: AdministrativeUserListState,
  partitionKey: string | null,
): AdministrativeUserListState {
  if (current.partitionKey === partitionKey) return current;
  return state({
    partitionKey,
    filters: current.filters,
    items: EMPTY_ITEMS,
    nextCursor: null,
    loading: false,
    refreshing: false,
    loadingMore: false,
    failure: null,
    nextPageFailure: null,
  });
}

export class AdministrativeUserListController {
  readonly #repository: AdministrativeUserRepository;
  readonly #boundary: AdministrativeUserDataBoundary;
  readonly #listeners = new Set<Listener>();
  readonly #consumedCursors = new Set<string>();
  #unsubscribeBoundary: (() => void) | null = null;
  #state: AdministrativeUserListState;
  #generation = 0;
  #loadMoreRequest = 0;
  #activeLoadMore: Readonly<{
    request: number;
    generation: number;
    promise: Promise<void>;
  }> | null = null;
  #activeInitialLoad: Readonly<{
    boundaryGeneration: number;
    partitionKey: string;
    promise: Promise<void>;
  }> | null = null;
  #completedInitialLoad: Readonly<{
    boundaryGeneration: number;
    partitionKey: string | null;
  }> | null = null;
  #disposed = false;

  constructor(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
    initialFilters: AdministrativeUserFilters = DEFAULT_FILTERS,
  ) {
    this.#repository = repository;
    this.#boundary = boundary;
    this.#state = state({
      partitionKey: boundary.current.partitionKey,
      filters: normalizeFilters(initialFilters),
      items: EMPTY_ITEMS,
      nextCursor: null,
      loading: false,
      refreshing: false,
      loadingMore: false,
      failure: null,
      nextPageFailure: null,
    });
  }

  get snapshot(): AdministrativeUserListState {
    return this.#state;
  }

  subscribe(listener: Listener): () => void {
    if (this.#disposed) return () => undefined;
    this.#ensureBoundarySubscription();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  synchronizePartition(partitionKey: string | null): boolean {
    this.#ensureBoundarySubscription();
    return !this.#disposed && this.#boundary.synchronizePartition(partitionKey);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#loadMoreRequest += 1;
    this.#activeLoadMore = null;
    this.#activeInitialLoad = null;
    this.#completedInitialLoad = null;
    this.#consumedCursors.clear();
    this.#unsubscribeBoundary?.();
    this.#unsubscribeBoundary = null;
    this.#listeners.clear();
  }

  loadInitial(): Promise<void> {
    this.#ensureBoundarySubscription();
    return this.#loadFirstPage(this.#state.filters, 'initial');
  }

  ensureInitialLoad(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#ensureBoundarySubscription();
    const boundary = this.#boundary.current;
    const partitionKey = boundary.partitionKey;
    if (
      partitionKey === null ||
      this.#state.partitionKey !== partitionKey
    ) {
      return Promise.resolve();
    }
    if (
      this.#completedInitialLoad?.boundaryGeneration === boundary.generation &&
      this.#completedInitialLoad.partitionKey === partitionKey
    ) {
      return Promise.resolve();
    }
    if (
      this.#activeInitialLoad?.boundaryGeneration === boundary.generation &&
      this.#activeInitialLoad.partitionKey === partitionKey
    ) {
      return this.#activeInitialLoad.promise;
    }

    const boundaryGeneration = boundary.generation;
    const lease = this.#boundary.issueLease();
    const run = Promise.resolve().then(() => {
      if (
        this.#disposed ||
        this.#boundary.current.generation !== boundaryGeneration ||
        this.#state.partitionKey !== partitionKey ||
        !this.#boundary.isLeaseCurrent(lease, partitionKey)
      ) {
        return;
      }
      return this.#loadFirstPage(this.#state.filters, 'initial', lease);
    });
    const promise = run.finally(() => {
      if (this.#activeInitialLoad?.promise === promise) {
        this.#activeInitialLoad = null;
      }
    });
    this.#activeInitialLoad = Object.freeze({
      boundaryGeneration,
      partitionKey,
      promise,
    });
    return promise;
  }

  setFilters(filters: AdministrativeUserFilters): Promise<void> {
    this.#ensureBoundarySubscription();
    const normalized = normalizeFilters(filters);
    if (filterKey(normalized) === filterKey(this.#state.filters)) {
      return Promise.resolve();
    }
    return this.#loadFirstPage(normalized, 'initial');
  }

  refresh(): Promise<void> {
    this.#ensureBoundarySubscription();
    return this.#loadFirstPage(this.#state.filters, 'refresh');
  }

  retry(): Promise<void> {
    this.#ensureBoundarySubscription();
    return this.#state.items.length === 0
      ? this.#loadFirstPage(this.#state.filters, 'initial')
      : this.#loadFirstPage(this.#state.filters, 'refresh');
  }

  loadMore(): Promise<void> {
    this.#ensureBoundarySubscription();
    if (this.#activeLoadMore !== null) return this.#activeLoadMore.promise;
    const cursor = this.#state.nextCursor;
    if (
      this.#disposed ||
      cursor === null ||
      this.#state.loading ||
      this.#state.refreshing
    ) {
      return Promise.resolve();
    }
    const request = ++this.#loadMoreRequest;
    const generation = this.#generation;
    const partitionKey = this.#state.partitionKey;
    const lease = this.#boundary.issueLease();
    const filters = this.#state.filters;
    this.#publish({
      ...this.#state,
      loadingMore: true,
      nextPageFailure: null,
    });
    const promise = Promise.resolve().then(() => {
      if (!this.#isCurrentLoadMore(
        request,
        generation,
        partitionKey,
        lease,
      )) {
        return;
      }
      return this.#performLoadMore(
        request,
        generation,
        partitionKey,
        lease,
        filters,
        cursor,
      );
    });
    this.#activeLoadMore = Object.freeze({ request, generation, promise });
    return promise;
  }

  async #performLoadMore(
    request: number,
    generation: number,
    partitionKey: string | null,
    lease: AdministrativeUserReadLease,
    filters: AdministrativeUserFilters,
    cursor: string,
  ): Promise<void> {
    try {
      const page = await this.#repository.list(
        { ...filters, cursor },
        lease,
      );
      if (!this.#isCurrentLoadMore(
        request,
        generation,
        partitionKey,
        lease,
      )) return;
      const newItems = countNewAdministrativeUsers(this.#state.items, page.itens);
      this.#assertPaginationProgress(page, cursor, newItems);
      this.#consumedCursors.add(cursor);
      this.#activeLoadMore = null;
      this.#publish({
        ...this.#state,
        items: mergeAdministrativeUsers(this.#state.items, page.itens),
        nextCursor: page.paginacao.proximo_cursor,
        loadingMore: false,
        nextPageFailure: null,
      });
    } catch (error) {
      if (!this.#isCurrentLoadMore(
        request,
        generation,
        partitionKey,
        lease,
      )) return;
      this.#activeLoadMore = null;
      const failure = classifyAdministrativeUserReadFailure(error);
      if (isAdministrativeUserAccessFailure(failure)) {
        this.#invalidateBoundaryForAccessFailure(failure, lease);
        return;
      }
      const transient = failure.kind === 'unavailable';
      if (!transient) this.#consumedCursors.clear();
      this.#publish({
        ...this.#state,
        nextCursor: transient ? this.#state.nextCursor : null,
        loadingMore: false,
        nextPageFailure: failure,
      });
    }
  }

  async #loadFirstPage(
    filters: AdministrativeUserFilters,
    mode: 'initial' | 'refresh',
    suppliedLease?: AdministrativeUserReadLease,
  ): Promise<void> {
    if (this.#disposed) return;
    const generation = ++this.#generation;
    const partitionKey = this.#state.partitionKey;
    const lease = suppliedLease ?? this.#boundary.issueLease();
    this.#completedInitialLoad = null;
    this.#activeLoadMore = null;
    this.#loadMoreRequest += 1;
    this.#consumedCursors.clear();
    this.#publish({
      ...this.#state,
      filters,
      items: mode === 'initial' ? EMPTY_ITEMS : this.#state.items,
      nextCursor: mode === 'initial' ? null : this.#state.nextCursor,
      loading: mode === 'initial',
      refreshing: mode === 'refresh',
      loadingMore: false,
      failure: null,
      nextPageFailure: null,
    });
    try {
      if (!this.#isCurrent(generation, partitionKey, lease)) return;
      const page = await this.#repository.list(filters, lease);
      if (!this.#isCurrent(generation, partitionKey, lease)) return;
      const items = mergeAdministrativeUsers([], page.itens);
      if (items.length === 0 && page.paginacao.proximo_cursor !== null) {
        throw incompatiblePagination();
      }
      this.#publish({
        ...this.#state,
        items,
        nextCursor: page.paginacao.proximo_cursor,
        loading: false,
        refreshing: false,
        failure: null,
      });
      this.#completedInitialLoad = Object.freeze({
        boundaryGeneration: this.#boundary.current.generation,
        partitionKey,
      });
    } catch (error) {
      if (!this.#isCurrent(generation, partitionKey, lease)) return;
      const failure = classifyAdministrativeUserReadFailure(error);
      if (isAdministrativeUserAccessFailure(failure)) {
        this.#invalidateBoundaryForAccessFailure(failure, lease);
        return;
      }
      this.#consumedCursors.clear();
      this.#publish({
        ...this.#state,
        items: EMPTY_ITEMS,
        nextCursor: null,
        loading: false,
        refreshing: false,
        failure,
      });
    }
  }

  #assertPaginationProgress(
    page: AdministrativeUserPage,
    consumedCursor: string,
    newItems: number,
  ): void {
    const nextCursor = page.paginacao.proximo_cursor;
    if (
      nextCursor !== null &&
      (nextCursor === consumedCursor ||
        this.#consumedCursors.has(nextCursor) ||
        newItems === 0)
    ) {
      throw incompatiblePagination();
    }
  }

  #invalidateBoundaryForAccessFailure(
    failure: AdministrativeUserReadFailure,
    lease: AdministrativeUserReadLease,
  ): void {
    this.#boundary.invalidateAccess(
      lease,
      failure.kind === 'session_expired' ? 'invalid_session' : 'forbidden',
    );
  }

  #handleBoundaryInvalidation(): void {
    if (this.#disposed) return;
    this.#invalidateRequests();
    const boundary = this.#boundary.current;
    this.#publish({
      ...this.#state,
      partitionKey: boundary.partitionKey,
      items: EMPTY_ITEMS,
      nextCursor: null,
      loading: false,
      refreshing: false,
      loadingMore: false,
      failure: administrativeUserBoundaryFailure(boundary.invalidation),
      nextPageFailure: null,
    });
  }

  #invalidateRequests(): void {
    this.#generation += 1;
    this.#loadMoreRequest += 1;
    this.#activeLoadMore = null;
    this.#activeInitialLoad = null;
    this.#completedInitialLoad = null;
    this.#consumedCursors.clear();
  }

  #ensureBoundarySubscription(): void {
    if (this.#disposed || this.#unsubscribeBoundary !== null) return;
    this.#unsubscribeBoundary = this.#boundary.subscribe(() => {
      this.#handleBoundaryInvalidation();
    });
  }

  #isCurrent(
    generation: number,
    partitionKey: string | null,
    lease: AdministrativeUserReadLease,
  ): boolean {
    return !this.#disposed &&
      this.#generation === generation &&
      this.#state.partitionKey === partitionKey &&
      this.#boundary.isLeaseCurrent(lease, partitionKey);
  }

  #isCurrentLoadMore(
    request: number,
    generation: number,
    partitionKey: string | null,
    lease: AdministrativeUserReadLease,
  ): boolean {
    return this.#isCurrent(generation, partitionKey, lease) &&
      this.#activeLoadMore?.request === request &&
      this.#activeLoadMore.generation === generation;
  }

  #publish(next: AdministrativeUserListState): void {
    if (this.#disposed) return;
    this.#state = state(next);
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch {
        // Um observador de interface não pode interromper os demais.
      }
    }
  }
}
