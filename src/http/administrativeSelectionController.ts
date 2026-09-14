import { ApiResponseError, InvalidApiRequestError } from './backendApi';
import { AdministrativeUserContextStaleError } from './administrativeUserRepository';
import type { AdministrativeUserDataBoundary, AdministrativeUserReadLease } from './administrativeUserDataBoundary';
import { InvalidBackendResponseError } from './decoders';
import { ApiTransportError } from './httpTransport';
import { SessionRequiredError, type SessionCoordinator } from './sessionCoordinator';

export interface AdministrativeSelectionFailure {
  readonly kind: 'unavailable' | 'incompatible_response' | 'invalid_request' | 'selection_invalid' | 'unexpected';
  readonly retryable: boolean;
  readonly restartRequired: boolean;
}
export function selectionFailure(error: unknown, pagination = false): AdministrativeSelectionFailure {
  const unavailable = error instanceof ApiTransportError ||
    (error instanceof ApiResponseError && (error.status === 429 || error.status >= 500));
  const incompatible = error instanceof InvalidBackendResponseError;
  const invalid = error instanceof InvalidApiRequestError || (error instanceof ApiResponseError && error.status === 400);
  return Object.freeze({ kind: unavailable ? 'unavailable' : incompatible ? 'incompatible_response'
    : invalid ? 'invalid_request' : 'unexpected', retryable: unavailable,
    restartRequired: pagination && (incompatible || invalid) });
}
export function selectionSearch(value: string): string {
  if (typeof value !== 'string') throw new InvalidApiRequestError();
  const normalized = value.normalize('NFC').trim();
  if ([...normalized].length > 200) throw new InvalidApiRequestError();
  return normalized;
}

/** One controller's lifetime, using the existing administrative /me boundary. */
export class AdministrativeSelectionScope {
  readonly #leases = new Set<AdministrativeUserReadLease>();
  readonly #rootLease: AdministrativeUserReadLease;
  #unsubscribe: (() => void) | null;
  #onCancel: (() => void) | null;
  #closed = false;
  constructor(readonly session: SessionCoordinator, readonly boundary: AdministrativeUserDataBoundary,
    onCancel: () => void) {
    if (session.snapshot?.usuario.perfil !== 'admin' || session.snapshot.usuario.status !== 'ativo' ||
      ['forbidden', 'invalid_session'].includes(boundary.current.invalidation ?? '')) {
      throw new AdministrativeUserContextStaleError();
    }
    this.#rootLease = boundary.issueLease();
    this.#onCancel = onCancel;
    this.#unsubscribe = boundary.subscribe(() => { if (!this.active) this.dispose(); });
  }
  get active(): boolean {
    return !this.#closed && this.session.snapshot?.usuario.perfil === 'admin' &&
      this.session.snapshot.usuario.status === 'ativo' && this.boundary.isLeaseCurrent(this.#rootLease);
  }
  issue(): AdministrativeUserReadLease {
    if (!this.active) throw new AdministrativeUserContextStaleError();
    const lease = this.boundary.issueLease(); this.#leases.add(lease); return lease;
  }
  current(lease: AdministrativeUserReadLease): boolean {
    return this.active && this.#leases.has(lease) && this.boundary.isLeaseCurrent(lease);
  }
  release(lease: AdministrativeUserReadLease): void {
    this.boundary.revokeLease(lease); this.#leases.delete(lease);
  }
  async authenticated<T>(lease: AdministrativeUserReadLease, read: (token: string) => Promise<T>): Promise<T> {
    const assert = () => { if (!this.current(lease)) throw new AdministrativeUserContextStaleError(); };
    assert();
    try {
      const result = await this.session.authenticated(token => { assert(); return read(token); });
      assert(); return result;
    } catch (error) {
      // An old query may never borrow a new lease to invalidate shared access.
      if (this.current(lease)) {
        if (error instanceof SessionRequiredError || (error instanceof ApiResponseError && error.status === 401)) {
          this.boundary.invalidateAccess(lease, 'invalid_session');
        } else if (error instanceof ApiResponseError && error.status === 403 &&
          this.boundary.invalidateAccess(lease, 'forbidden')) {
          void this.session.revalidate().catch(() => {});
        }
      }
      throw error;
    }
  }
  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.boundary.revokeLease(this.#rootLease);
    for (const lease of this.#leases) this.boundary.revokeLease(lease);
    this.#leases.clear();
    const onCancel = this.#onCancel; this.#onCancel = null; onCancel?.();
  }
}

export interface AdministrativeSelectionPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly versionId: string | null;
}
export interface AdministrativeSelectionQueryState<T, Q> extends AdministrativeSelectionPage<T> {
  readonly phase: 'idle' | 'loading' | 'ready' | 'error' | 'cancelled';
  readonly query: Q | null;
  readonly generation: number;
  readonly loadingMore: boolean;
  readonly failure: AdministrativeSelectionFailure | null;
  readonly nextPageFailure: AdministrativeSelectionFailure | null;
}

/** Internal cursor state shared only by the new selectors; no selection is derived from pages. */
export class AdministrativeSelectionQuery<T, Q extends object> {
  readonly #listeners = new Set<() => void>();
  readonly #usedCursors = new Set<string>();
  #lease: AdministrativeUserReadLease | null = null;
  #pending: Promise<void> | null = null;
  #state: AdministrativeSelectionQueryState<T, Q> = this.#empty(0, 'idle');
  constructor(readonly scope: AdministrativeSelectionScope,
    readonly read: (query: Q, cursor: string | null, lease: AdministrativeUserReadLease) => Promise<AdministrativeSelectionPage<T>>,
    readonly itemId: (item: T) => string) {}
  get snapshot(): AdministrativeSelectionQueryState<T, Q> { return this.#state; }
  subscribe(listener: () => void): () => void {
    if (this.#state.phase === 'cancelled') return () => {};
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  notify(): void {
    for (const listener of this.#listeners) { try { listener(); } catch { /* Other consumers still receive invalidation. */ } }
  }
  contains(item: T, generation = this.#state.generation): boolean {
    return this.scope.active && generation === this.#state.generation && this.#state.items.includes(item);
  }
  reset(query: Q | null): Promise<void> {
    if (!this.scope.active || this.#state.phase === 'cancelled') return Promise.resolve();
    this.#retireRead(); this.#usedCursors.clear();
    this.#state = Object.freeze({ ...this.#empty(this.#state.generation + 1, 'idle'),
      query: query === null ? null : Object.freeze({ ...query }) });
    if (query === null) { this.notify(); return Promise.resolve(); }
    return this.#load(null);
  }
  refresh(): Promise<void> { return this.reset(this.#state.query); }
  loadMore(): Promise<void> {
    if (this.#pending) return this.#pending;
    if (this.#state.phase !== 'ready' || this.#state.nextPageFailure?.restartRequired || !this.#state.nextCursor) {
      return Promise.resolve();
    }
    return this.#load(this.#state.nextCursor);
  }
  retry(): Promise<void> {
    // #load captures this query/generation/cursor; reset and dispose retire it.
    // The pending recovery remains authoritative after nextPageFailure is cleared.
    if (this.#pending) return this.#pending;
    return this.#state.nextPageFailure ? this.loadMore() : this.refresh();
  }
  dispose(): void {
    if (this.#state.phase === 'cancelled') return;
    this.#retireRead(); this.#usedCursors.clear();
    this.#state = this.#empty(this.#state.generation + 1, 'cancelled');
    this.notify(); this.#listeners.clear();
  }
  #empty(generation: number, phase: 'idle' | 'cancelled'): AdministrativeSelectionQueryState<T, Q> {
    return Object.freeze({ phase, generation, query: null, items: Object.freeze([]), nextCursor: null,
      versionId: null, loadingMore: false, failure: null, nextPageFailure: null });
  }
  #retireRead(): void {
    if (this.#lease) this.scope.release(this.#lease);
    this.#lease = null; this.#pending = null;
  }
  #load(cursor: string | null): Promise<void> {
    if (!this.scope.active || !this.#state.query) return Promise.resolve();
    const query = this.#state.query; const generation = this.#state.generation;
    const lease = this.scope.issue(); this.#lease = lease;
    const current = () => this.scope.current(lease) && generation === this.#state.generation;
    this.#state = Object.freeze({ ...this.#state, phase: cursor === null ? 'loading' : 'ready',
      loadingMore: cursor !== null, failure: null, nextPageFailure: null });
    const pending = Promise.resolve().then(async () => {
      if (!current()) return;
      try {
        const page = await this.read(query, cursor, lease);
        if (!current()) return;
        if ((cursor !== null && page.versionId !== this.#state.versionId) ||
          (page.nextCursor !== null && (page.nextCursor === cursor || this.#usedCursors.has(page.nextCursor)))) {
          throw new InvalidBackendResponseError();
        }
        const items = new Map((cursor === null ? [] : this.#state.items).map(item => [this.itemId(item), item]));
        for (const item of page.items) if (!items.has(this.itemId(item))) items.set(this.itemId(item), item);
        if (cursor !== null) this.#usedCursors.add(cursor);
        this.#state = Object.freeze({ ...this.#state, phase: 'ready', items: Object.freeze([...items.values()]),
          nextCursor: page.nextCursor, versionId: page.versionId, loadingMore: false });
      } catch (error) {
        if (!current()) return;
        const failure = selectionFailure(error, cursor !== null);
        this.#state = Object.freeze({ ...this.#state, phase: cursor === null ? 'error' : 'ready', loadingMore: false,
          ...(cursor === null ? { failure } : { nextPageFailure: failure }) });
      } finally {
        if (current()) this.notify();
        this.scope.release(lease);
        if (this.#lease === lease) this.#lease = null;
      }
    }).finally(() => { if (this.#pending === pending) this.#pending = null; });
    this.#pending = pending; this.notify(); return pending;
  }
}
