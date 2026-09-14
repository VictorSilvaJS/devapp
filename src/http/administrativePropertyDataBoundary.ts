import type { AdministrativePropertyPage, AdministrativePropertyProjection, PropertyFilters } from './contracts';
import { decodeAdministrativeProperty, decodeAdministrativePropertyPage } from './decoders';

export type AdministrativePropertyInvalidation = 'partition_changed' | 'forbidden' | 'invalid_session'
  | 'command_confirmed' | 'reconciliation_failed' | 'disposed' | null;
export interface AdministrativePropertyReadLease {
  readonly partitionKey: string | null;
  readonly generation: number;
  readonly authorizationGeneration: number;
}
export interface AdministrativePropertyListState {
  readonly filters: PropertyFilters;
  readonly page: AdministrativePropertyPage | null;
  readonly stale: boolean;
}
export interface AdministrativePropertyBoundarySnapshot {
  readonly partitionKey: string | null;
  readonly generation: number;
  readonly authorizationGeneration: number;
  readonly authorized: boolean;
  readonly invalidation: AdministrativePropertyInvalidation;
  readonly details: Readonly<Record<string, AdministrativePropertyProjection>>;
  readonly lists: readonly AdministrativePropertyListState[];
}

function queryKey(filters: PropertyFilters): string {
  return JSON.stringify(Object.keys(filters).sort().map((key) => [key, filters[key as keyof PropertyFilters]]));
}
function immutableProperty(value: AdministrativePropertyProjection): AdministrativePropertyProjection {
  const property = decodeAdministrativeProperty(value);
  return Object.freeze({ ...property, titular: Object.freeze({ ...property.titular }) });
}

/** Memory only. Data generations retire reads; authorization generations retire entire flows. */
export class AdministrativePropertyDataBoundary {
  readonly #listeners = new Set<() => void>();
  readonly #leases = new WeakSet<object>();
  #disposed = false;
  #snapshot: AdministrativePropertyBoundarySnapshot = Object.freeze({
    partitionKey: null, generation: 0, authorizationGeneration: 0, authorized: false,
    invalidation: null, details: Object.freeze({}), lists: Object.freeze([]),
  });
  get current(): AdministrativePropertyBoundarySnapshot { return this.#snapshot; }
  get activeSubscriptionCount(): number { return this.#listeners.size; }
  subscribe(listener: () => void): () => void {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
  synchronizePartition(partitionKey: string | null, authorized: boolean): boolean {
    if (this.#disposed || partitionKey === this.current.partitionKey) return false;
    this.#publish({ ...this.current, partitionKey, authorized,
      generation: this.current.generation + 1,
      authorizationGeneration: this.current.authorizationGeneration + 1,
      invalidation: 'partition_changed', details: Object.freeze({}), lists: Object.freeze([]) });
    return true;
  }
  issueLease(): AdministrativePropertyReadLease {
    const { partitionKey, generation, authorizationGeneration } = this.current;
    const lease = Object.freeze({ partitionKey, generation, authorizationGeneration });
    this.#leases.add(lease);
    return lease;
  }
  isAuthorizationCurrent(lease: AdministrativePropertyReadLease): boolean {
    return !this.#disposed && this.#leases.has(lease) && lease.partitionKey === this.current.partitionKey &&
      lease.authorizationGeneration === this.current.authorizationGeneration;
  }
  isLeaseCurrent(lease: AdministrativePropertyReadLease): boolean {
    return this.isAuthorizationCurrent(lease) && lease.generation === this.current.generation;
  }
  revokeLease(lease: AdministrativePropertyReadLease): void { this.#leases.delete(lease); }
  acceptSessionRevalidation(lease: AdministrativePropertyReadLease, partitionKey: string | null): boolean {
    if (!this.isLeaseCurrent(lease) || !partitionKey || partitionKey !== this.current.partitionKey ||
      this.current.invalidation !== 'forbidden') return false;
    this.#publish({ ...this.current, authorized: true, invalidation: null,
      generation: this.current.generation + 1,
      authorizationGeneration: this.current.authorizationGeneration + 1 });
    return true;
  }
  invalidateAccess(lease: AdministrativePropertyReadLease, reason: 'forbidden' | 'invalid_session'): boolean {
    // Never borrow a lease from a newer generation for a late failure.
    if (!this.isLeaseCurrent(lease)) return false;
    this.#publish({ ...this.current, authorized: false, invalidation: reason,
      generation: this.current.generation + 1,
      authorizationGeneration: this.current.authorizationGeneration + 1,
      details: Object.freeze({}), lists: Object.freeze([]) });
    return true;
  }
  invalidateData(lease: AdministrativePropertyReadLease,
    reason: 'command_confirmed' | 'reconciliation_failed'): boolean {
    if (!this.isLeaseCurrent(lease) || !this.current.authorized) return false;
    this.#publish({ ...this.current, generation: this.current.generation + 1,
      invalidation: reason, details: Object.freeze({}),
      lists: Object.freeze(this.current.lists.map(({ filters }) => Object.freeze({ filters, page: null, stale: true }))) });
    return true;
  }
  publishDetail(lease: AdministrativePropertyReadLease, property: AdministrativePropertyProjection,
    reconcile = false): boolean {
    if (!this.isLeaseCurrent(lease) || !this.current.authorized) return false;
    const current = this.current.details[property.id];
    if (current && current.versao > property.versao) return false;
    const authoritative = immutableProperty(property);
    this.#publish({ ...this.current,
      ...(reconcile ? { generation: this.current.generation + 1, invalidation: null,
        lists: Object.freeze(this.current.lists.map(({ filters }) => Object.freeze({ filters, page: null, stale: true }))) } : {}),
      details: Object.freeze({ ...this.current.details, [property.id]: authoritative }) });
    return true;
  }
  rememberList(filters: PropertyFilters): void {
    if (!this.current.authorized || this.#disposed) return;
    const key = queryKey(filters);
    if (this.current.lists.some((list) => queryKey(list.filters) === key)) return;
    this.#publish({ ...this.current, lists: Object.freeze([...this.current.lists,
      Object.freeze({ filters: Object.freeze({ ...filters }), page: null, stale: true })]) });
  }
  publishList(lease: AdministrativePropertyReadLease, filters: PropertyFilters, value: AdministrativePropertyPage): boolean {
    if (!this.isLeaseCurrent(lease) || !this.current.authorized) return false;
    const decoded = decodeAdministrativePropertyPage(value);
    if (decoded.itens.some((item) => (this.current.details[item.id]?.versao ?? 0) > item.versao)) return false;
    const page = Object.freeze({ ...decoded, itens: Object.freeze(decoded.itens.map(immutableProperty)) });
    const key = queryKey(filters);
    const state = Object.freeze({ filters: Object.freeze({ ...filters }), page, stale: false });
    this.#publish({ ...this.current, lists: Object.freeze([
      ...this.current.lists.filter((list) => queryKey(list.filters) !== key), state,
    ]) });
    return true;
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#publish({ ...this.current, authorized: false, invalidation: 'disposed',
      generation: this.current.generation + 1, authorizationGeneration: this.current.authorizationGeneration + 1,
      details: Object.freeze({}), lists: Object.freeze([]) });
    this.#listeners.clear();
  }
  #publish(snapshot: AdministrativePropertyBoundarySnapshot): void {
    this.#snapshot = Object.freeze(snapshot);
    for (const listener of this.#listeners) {
      try { listener(); } catch { /* One consumer cannot prevent invalidation of the others. */ }
    }
  }
}
