import {
  administrativeCommandDispositionForError,
  createAdministrativeIntentId,
} from './administrativeCommandCoordinator';
import type {
  AdministrativeUserDataBoundary,
  AdministrativeUserReadLease,
} from './administrativeUserDataBoundary';

export interface AdministrativeUserOperationContext {
  readonly boundaryLease: AdministrativeUserReadLease;
  isCurrent(): boolean;
}

export class AdministrativeUserOperationCancelledError extends Error {
  constructor() {
    super('A operação pertence a uma tela que não está mais ativa.');
    this.name = 'AdministrativeUserOperationCancelledError';
  }
}

export type AdministrativeUserLifecycleOutcome<T> =
  | Readonly<{ current: true; leader: boolean; ok: true; value: T }>
  | Readonly<{ current: true; leader: boolean; ok: false; error: unknown }>
  | Readonly<{ current: false; leader: boolean; ok: false }>;

export interface AdministrativeUserCommandLifecycleState {
  readonly active: boolean;
  readonly submitting: boolean;
  readonly resetVersion: number;
}

type Listener = () => void;
type SharedOutcome<T> =
  | Readonly<{ current: true; ok: true; value: T }>
  | Readonly<{ current: true; ok: false; error: unknown }>
  | Readonly<{ current: false; ok: false }>;

function state(
  active: boolean,
  submitting: boolean,
  resetVersion: number,
): AdministrativeUserCommandLifecycleState {
  return Object.freeze({ active, submitting, resetVersion });
}

function withLeadership<T>(
  outcome: SharedOutcome<T>,
  leader: boolean,
): AdministrativeUserLifecycleOutcome<T> {
  return Object.freeze({ ...outcome, leader });
}

export class AdministrativeUserCommandLifecycle {
  readonly #boundary: AdministrativeUserDataBoundary;
  readonly #createIntent: () => string;
  readonly #discardIntent: (intentId: string) => boolean;
  readonly #instanceToken = Object.freeze({});
  readonly #listeners = new Set<Listener>();
  #unsubscribeBoundary: (() => void) | null = null;
  #boundaryLease: AdministrativeUserReadLease | null = null;
  #intentId: string | null = null;
  #generation = 0;
  #activeOperation: Readonly<{
    token: object;
    promise: Promise<SharedOutcome<unknown>>;
  }> | null = null;
  #state = state(false, false, 0);
  #mounted = false;

  constructor(input: Readonly<{
    boundary: AdministrativeUserDataBoundary;
    discardIntent: (intentId: string) => boolean;
    createIntent?: () => string;
  }>) {
    this.#boundary = input.boundary;
    this.#discardIntent = input.discardIntent;
    this.#createIntent = input.createIntent ?? createAdministrativeIntentId;
  }

  get snapshot(): AdministrativeUserCommandLifecycleState {
    return this.#state;
  }

  get currentLease(): AdministrativeUserReadLease | null {
    return this.#boundaryLease;
  }

  start(): boolean {
    if (this.#mounted) return false;
    this.#mounted = true;
    this.#boundaryLease = this.#boundary.issueLease();
    this.#unsubscribeBoundary = this.#boundary.subscribe(() => {
      const boundary = this.#boundary.current;
      if (
        boundary.invalidation === 'partition_changed' ||
        boundary.invalidation === 'invalid_session' ||
        boundary.invalidation === 'forbidden'
      ) {
        this.#resetSensitiveState();
        return;
      }
      this.#replaceBoundaryLease();
    });
    this.#publish(state(true, false, this.#state.resetVersion));
    return true;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  run<T>(
    operation: (
      intentId: string,
      context: AdministrativeUserOperationContext,
    ) => Promise<T>,
  ): Promise<AdministrativeUserLifecycleOutcome<T>> {
    if (!this.#mounted || this.#boundaryLease === null) {
      return Promise.resolve(Object.freeze({ current: false, leader: false, ok: false }));
    }
    if (this.#activeOperation !== null) {
      return this.#asFollower<T>(this.#activeOperation.promise);
    }
    const intentId = this.#intentId ?? this.#createIntent();
    this.#intentId = intentId;
    return this.#begin(
      (context) => operation(intentId, context),
      (outcome) => {
        if (outcome.ok) {
          this.#retireIntent(intentId);
        } else if (
          'error' in outcome &&
          administrativeCommandDispositionForError(outcome.error) !== 'ambiguous'
        ) {
          this.#retireIntent(intentId);
        }
      },
    );
  }

  runRead<T>(
    operation: (context: AdministrativeUserOperationContext) => Promise<T>,
  ): Promise<AdministrativeUserLifecycleOutcome<T>> {
    if (!this.#mounted || this.#boundaryLease === null) {
      return Promise.resolve(Object.freeze({ current: false, leader: false, ok: false }));
    }
    if (this.#activeOperation !== null) {
      return this.#asFollower<T>(this.#activeOperation.promise);
    }
    return this.#begin(operation);
  }

  restartIntent(): boolean {
    if (!this.#mounted || this.#state.submitting) return false;
    this.#generation += 1;
    if (this.#intentId !== null) this.#discardIntent(this.#intentId);
    this.#intentId = null;
    return true;
  }

  dispose(): void {
    if (!this.#mounted) return;
    this.#mounted = false;
    this.#generation += 1;
    const lease = this.#boundaryLease;
    this.#boundaryLease = null;
    if (lease !== null) this.#boundary.revokeLease(lease);
    this.#unsubscribeBoundary?.();
    this.#unsubscribeBoundary = null;
    if (this.#intentId !== null) this.#discardIntent(this.#intentId);
    this.#intentId = null;
    this.#activeOperation = null;
    this.#state = state(false, false, this.#state.resetVersion);
    this.#listeners.clear();
  }

  #begin<T>(
    operation: (context: AdministrativeUserOperationContext) => Promise<T>,
    settle?: (outcome: SharedOutcome<T>) => void,
  ): Promise<AdministrativeUserLifecycleOutcome<T>> {
    const generation = this.#generation;
    const boundaryLease = this.#boundaryLease;
    if (boundaryLease === null) {
      return Promise.resolve(Object.freeze({ current: false, leader: false, ok: false }));
    }
    const operationToken = Object.freeze({});
    const instanceToken = this.#instanceToken;
    const context: AdministrativeUserOperationContext = Object.freeze({
      boundaryLease,
      isCurrent: () => (
        this.#mounted &&
        this.#instanceToken === instanceToken &&
        this.#generation === generation &&
        this.#activeOperation?.token === operationToken &&
        this.#boundary.isLeaseCurrent(boundaryLease)
      ),
    });
    this.#publish(state(true, true, this.#state.resetVersion));
    const run = Promise.resolve()
      .then(() => operation(context))
      .then<SharedOutcome<T>>((value) => {
        if (!this.#isOperationCurrent(generation, operationToken)) {
          return Object.freeze({ current: false, ok: false });
        }
        return Object.freeze({ current: true, ok: true, value });
      })
      .catch((error: unknown): SharedOutcome<T> => {
        if (
          error instanceof AdministrativeUserOperationCancelledError ||
          !this.#isOperationCurrent(generation, operationToken)
        ) {
          return Object.freeze({ current: false, ok: false });
        }
        return Object.freeze({ current: true, ok: false, error });
      })
      .then((outcome) => {
        settle?.(outcome);
        return outcome;
      });
    const promise = run.finally(() => {
      if (this.#isOperationCurrent(generation, operationToken)) {
        this.#activeOperation = null;
        this.#publish(state(true, false, this.#state.resetVersion));
      }
    });
    this.#activeOperation = Object.freeze({
      token: operationToken,
      promise: promise as Promise<SharedOutcome<unknown>>,
    });
    return promise.then((outcome) => withLeadership(outcome, true));
  }

  #asFollower<T>(
    promise: Promise<SharedOutcome<unknown>>,
  ): Promise<AdministrativeUserLifecycleOutcome<T>> {
    return promise.then((outcome) => withLeadership(
      outcome as SharedOutcome<T>,
      false,
    ));
  }

  #retireIntent(intentId: string): void {
    this.#discardIntent(intentId);
    if (this.#intentId === intentId) this.#intentId = null;
  }

  #replaceBoundaryLease(): void {
    if (!this.#mounted) return;
    const previous = this.#boundaryLease;
    this.#boundaryLease = this.#boundary.issueLease();
    if (previous !== null) this.#boundary.revokeLease(previous);
  }

  #resetSensitiveState(): void {
    if (!this.#mounted) return;
    this.#generation += 1;
    const lease = this.#boundaryLease;
    this.#boundaryLease = this.#boundary.issueLease();
    if (lease !== null) this.#boundary.revokeLease(lease);
    if (this.#intentId !== null) this.#discardIntent(this.#intentId);
    this.#intentId = null;
    this.#activeOperation = null;
    this.#publish(state(true, false, this.#state.resetVersion + 1));
  }

  #isOperationCurrent(generation: number, token: object): boolean {
    return this.#mounted &&
      this.#generation === generation &&
      this.#activeOperation?.token === token;
  }

  #publish(next: AdministrativeUserCommandLifecycleState): void {
    if (!this.#mounted) return;
    this.#state = next;
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch {
        // Uma superfície defeituosa não pode impedir a limpeza das demais.
      }
    }
  }
}
