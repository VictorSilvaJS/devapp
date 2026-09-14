import {
  administrativeCommandDispositionForError, createAdministrativeIntentId,
} from './administrativeCommandCoordinator';
import type { AdministrativePropertyDataBoundary, AdministrativePropertyReadLease } from './administrativePropertyDataBoundary';
import type { AdministrativePropertyEditModel } from './administrativePropertyModels';
import type { AdministrativePropertyProjection, AdministrativePropertyReceipt } from './contracts';
import { AdministrativePropertyContextStaleError } from './administrativePropertyRepository';

export interface AdministrativePropertyIntent {
  readonly intentId: string;
  readonly action: 'create' | 'edit' | 'status';
  readonly method: 'POST' | 'PATCH';
  readonly route: string;
  readonly propertyId?: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly editModel?: AdministrativePropertyEditModel;
}
export type AdministrativePropertyCommandPhase = 'idle' | 'submitting' | 'ambiguous' | 'review_required'
  | 'confirmed_reconciling' | 'confirmed_reconciliation_failed' | 'reconciled' | 'cancelled';
export interface AdministrativePropertyCommandState {
  readonly phase: AdministrativePropertyCommandPhase;
  readonly mutationConfirmed: boolean;
  readonly receipt?: AdministrativePropertyReceipt;
  readonly property?: AdministrativePropertyProjection;
  readonly error?: unknown;
}
export interface AdministrativePropertyCommandDriver {
  mutate(intent: AdministrativePropertyIntent, lease: AdministrativePropertyReadLease): Promise<AdministrativePropertyReceipt>;
  reconcile(receipt: AdministrativePropertyReceipt, lease: AdministrativePropertyReadLease): Promise<AdministrativePropertyProjection>;
  discard(intentId: string): void;
}

/** One immutable operator intention. Retry after confirmation can only call reconcile. */
export class AdministrativePropertyCommandLifecycle {
  #intent: AdministrativePropertyIntent | null;
  readonly #boundary: AdministrativePropertyDataBoundary;
  readonly #driver: AdministrativePropertyCommandDriver;
  readonly #listeners = new Set<() => void>();
  readonly #completionListeners = new Set<(property: AdministrativePropertyProjection) => void>();
  #authorizationLease: AdministrativePropertyReadLease;
  #unsubscribe: (() => void) | null = null;
  #mounted = false;
  #cancelled = false;
  #completed = false;
  #pending: Promise<AdministrativePropertyCommandState> | null = null;
  #state: AdministrativePropertyCommandState = Object.freeze({ phase: 'idle', mutationConfirmed: false });

  constructor(input: Readonly<{
    intent: Omit<AdministrativePropertyIntent, 'intentId'>;
    boundary: AdministrativePropertyDataBoundary;
    driver: AdministrativePropertyCommandDriver;
    createIntent?: () => string;
  }>) {
    this.#intent = Object.freeze({ ...input.intent, body: Object.freeze({ ...input.intent.body }),
      intentId: (input.createIntent ?? createAdministrativeIntentId)() });
    this.#boundary = input.boundary;
    this.#driver = input.driver;
    this.#authorizationLease = this.#boundary.issueLease();
  }
  get intent(): AdministrativePropertyIntent | null { return this.#intent; }
  get snapshot(): AdministrativePropertyCommandState { return this.#state; }
  start(): boolean {
    if (this.#mounted || this.#cancelled) return false;
    if (!this.#authorized()) { this.#cancel(); return false; }
    this.#mounted = true;
    this.#unsubscribe = this.#boundary.subscribe(() => {
      if (!this.#authorized()) this.#cancel();
    });
    return true;
  }
  subscribe(listener: () => void): () => void {
    if (this.#cancelled) return () => {};
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
  onCompleted(listener: (property: AdministrativePropertyProjection) => void): () => void {
    if (this.#cancelled) return () => {};
    this.#completionListeners.add(listener);
    return () => { this.#completionListeners.delete(listener); };
  }
  submit(): Promise<AdministrativePropertyCommandState> {
    if (!this.#current()) return Promise.resolve(this.#state);
    if (this.#pending) return this.#pending;
    if (this.#state.phase !== 'idle' && this.#state.phase !== 'ambiguous') return Promise.resolve(this.#state);
    return this.#run(async () => {
      this.#publish({ phase: 'submitting', mutationConfirmed: false });
      if (!this.#current() || !this.#intent) return;
      const lease = this.#boundary.issueLease();
      let receipt: AdministrativePropertyReceipt;
      try {
        receipt = await this.#driver.mutate(this.#intent, lease);
      } catch (error) {
        if (this.#current()) this.#publish({ phase: administrativeCommandDispositionForError(error) === 'ambiguous'
          ? 'ambiguous' : 'review_required', mutationConfirmed: false, error });
        return;
      } finally { this.#boundary.revokeLease(lease); }
      if (!this.#current()) return;
      // Receipt acceptance precedes every read. No authenticated mutation wraps this GET.
      this.#publish({ phase: 'confirmed_reconciling', mutationConfirmed: true, receipt });
      if (!this.#current()) return;
      const invalidationLease = this.#boundary.issueLease();
      this.#boundary.invalidateData(invalidationLease, 'command_confirmed');
      this.#boundary.revokeLease(invalidationLease);
      await this.#reconcile(receipt);
    });
  }
  retryReconciliation(): Promise<AdministrativePropertyCommandState> {
    if (!this.#current()) return Promise.resolve(this.#state);
    if (this.#pending) return this.#pending;
    const receipt = this.#state.receipt;
    if (this.#state.phase !== 'confirmed_reconciliation_failed' || !receipt) return Promise.resolve(this.#state);
    return this.#run(() => this.#reconcile(receipt));
  }
  dispose(): void {
    // Cleanup is terminal even before submit. A new setup must create a new flow.
    this.#cancel();
  }
  async #reconcile(receipt: AdministrativePropertyReceipt): Promise<void> {
    if (!this.#current()) return;
    this.#publish({ phase: 'confirmed_reconciling', mutationConfirmed: true, receipt });
    if (!this.#current()) return;
    const lease = this.#boundary.issueLease();
    try {
      const property = await this.#driver.reconcile(receipt, lease);
      if (!this.#current()) return;
      if (!this.#boundary.publishDetail(lease, property, true)) throw new AdministrativePropertyContextStaleError();
      if (!this.#current()) return;
      this.#publish({ phase: 'reconciled', mutationConfirmed: true, receipt,
        property: this.#boundary.current.details[property.id] });
      if (!this.#completed && this.#current()) {
        this.#completed = true;
        for (const listener of this.#completionListeners) {
          if (!this.#current()) break;
          try { listener(this.#state.property!); } catch { /* Completion is never replayed. */ }
        }
      }
    } catch (error) {
      if (!this.#current()) return;
      this.#boundary.invalidateData(lease, 'reconciliation_failed');
      this.#publish({ phase: 'confirmed_reconciliation_failed', mutationConfirmed: true, receipt, error });
    } finally { this.#boundary.revokeLease(lease); }
  }
  #run(operation: () => Promise<void>): Promise<AdministrativePropertyCommandState> {
    const pending = Promise.resolve().then(async () => {
      if (this.#current()) await operation();
      return this.#state;
    }).finally(() => { if (this.#pending === pending) this.#pending = null; });
    this.#pending = pending;
    return pending;
  }
  #authorized(): boolean {
    return this.#boundary.current.authorized && this.#boundary.isAuthorizationCurrent(this.#authorizationLease);
  }
  #current(): boolean { return this.#mounted && !this.#cancelled && this.#authorized(); }
  #cancel(): void {
    if (this.#cancelled) return;
    this.#cancelled = true;
    this.#mounted = false;
    this.#unsubscribe?.(); this.#unsubscribe = null;
    const intentId = this.#intent?.intentId;
    // Release the actual owned reference, before discard/notification callbacks.
    // Only the scalar ID is needed to retire the coordinator entry.
    this.#intent = null;
    this.#pending = null;
    this.#boundary.revokeLease(this.#authorizationLease);
    if (intentId) this.#driver.discard(intentId);
    // Erase resource/draft/result projections from observable state on access loss.
    this.#publish({ phase: 'cancelled', mutationConfirmed: this.#state.mutationConfirmed });
    this.#listeners.clear(); this.#completionListeners.clear();
  }
  #publish(state: AdministrativePropertyCommandState): void {
    this.#state = Object.freeze(state);
    for (const listener of this.#listeners) {
      try { listener(); } catch { /* Continue notifying other consumers. */ }
    }
  }
}
