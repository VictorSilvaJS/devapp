import {
  administrativeUserBoundaryFailure,
  classifyAdministrativeUserReadFailure,
  isAdministrativeUserAccessFailure,
  type AdministrativeUserReadFailure,
} from './administrativeUserListController';
import type { AdministrativeUserRepository } from './administrativeUserRepository';
import {
  type AdministrativeUserDataBoundary,
  type AdministrativeUserReadLease,
} from './administrativeUserDataBoundary';
import { InvalidApiRequestError } from './backendApi';
import type { AdministrativeUserDetail } from './contracts';
import { isCanonicalUuidV4 } from './decoders';

export interface AdministrativeUserDetailState {
  readonly partitionKey: string | null;
  readonly requestedUserId: string | null;
  readonly loadedForUserId: string | null;
  readonly user: AdministrativeUserDetail | null;
  readonly loading: boolean;
  readonly failure: AdministrativeUserReadFailure | null;
}

type Listener = () => void;

function state(input: AdministrativeUserDetailState): AdministrativeUserDetailState {
  return Object.freeze(input);
}

export function administrativeUserDetailStateForTarget(
  current: AdministrativeUserDetailState,
  userId: string,
  partitionKey: string | null,
): AdministrativeUserDetailState {
  if (
    current.partitionKey === partitionKey &&
    current.requestedUserId === userId &&
    (current.user === null || current.loadedForUserId === userId)
  ) {
    return current;
  }
  return state({
    partitionKey,
    requestedUserId: userId,
    loadedForUserId: null,
    user: null,
    loading: partitionKey !== null,
    failure: null,
  });
}

export class AdministrativeUserDetailController {
  readonly #repository: AdministrativeUserRepository;
  readonly #boundary: AdministrativeUserDataBoundary;
  readonly #listeners = new Set<Listener>();
  #unsubscribeBoundary: (() => void) | null = null;
  #state: AdministrativeUserDetailState;
  #generation = 0;
  #active: Readonly<{
    generation: number;
    userId: string;
    promise: Promise<void>;
  }> | null = null;
  #disposed = false;

  constructor(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
  ) {
    this.#repository = repository;
    this.#boundary = boundary;
    this.#state = state({
      partitionKey: boundary.current.partitionKey,
      requestedUserId: null,
      loadedForUserId: null,
      user: null,
      loading: false,
      failure: administrativeUserBoundaryFailure(
        boundary.current.invalidation,
      ),
    });
  }

  get snapshot(): AdministrativeUserDetailState {
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

  load(userId: string): Promise<void> {
    if (!isCanonicalUuidV4(userId)) {
      return Promise.reject(
        new InvalidApiRequestError('O ID do Usuário é inválido.'),
      );
    }
    if (this.#disposed) return Promise.resolve();
    this.#ensureBoundarySubscription();
    if (
      this.#active !== null &&
      this.#active.userId === userId &&
      this.#active.generation === this.#generation
    ) {
      return this.#active.promise;
    }
    const generation = ++this.#generation;
    const partitionKey = this.#state.partitionKey;
    const lease = this.#boundary.issueLease();
    this.#active = null;
    this.#publish({
      ...this.#state,
      requestedUserId: userId,
      loadedForUserId: null,
      user: null,
      loading: true,
      failure: null,
    });
    const promise = Promise.resolve().then(() => {
      if (!this.#isCurrent(userId, generation, partitionKey, lease)) return;
      return this.#performLoad(
        userId,
        generation,
        partitionKey,
        lease,
      );
    });
    this.#active = Object.freeze({ generation, userId, promise });
    return promise;
  }

  retry(): Promise<void> {
    return this.#state.requestedUserId === null
      ? Promise.resolve()
      : this.load(this.#state.requestedUserId);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#active = null;
    this.#unsubscribeBoundary?.();
    this.#unsubscribeBoundary = null;
    this.#listeners.clear();
  }

  async #performLoad(
    userId: string,
    generation: number,
    partitionKey: string | null,
    lease: AdministrativeUserReadLease,
  ): Promise<void> {
    try {
      const user = await this.#repository.getById(userId, lease);
      if (!this.#isCurrent(userId, generation, partitionKey, lease)) return;
      this.#active = null;
      this.#publish({
        ...this.#state,
        requestedUserId: userId,
        loadedForUserId: userId,
        user,
        loading: false,
        failure: null,
      });
    } catch (error) {
      if (!this.#isCurrent(userId, generation, partitionKey, lease)) return;
      this.#active = null;
      const failure = classifyAdministrativeUserReadFailure(error);
      if (isAdministrativeUserAccessFailure(failure)) {
        this.#boundary.invalidateAccess(
          lease,
          failure.kind === 'session_expired'
            ? 'invalid_session'
            : 'forbidden',
        );
        return;
      }
      this.#publish({
        ...this.#state,
        requestedUserId: userId,
        loadedForUserId: null,
        user: null,
        loading: false,
        failure,
      });
    }
  }

  #invalidateRequests(): void {
    this.#generation += 1;
    this.#active = null;
  }

  #ensureBoundarySubscription(): void {
    if (this.#disposed || this.#unsubscribeBoundary !== null) return;
    this.#unsubscribeBoundary = this.#boundary.subscribe(() => {
      this.#handleBoundaryInvalidation();
    });
  }

  #handleBoundaryInvalidation(): void {
    if (this.#disposed) return;
    this.#invalidateRequests();
    const boundary = this.#boundary.current;
    this.#publish({
      partitionKey: boundary.partitionKey,
      requestedUserId: null,
      loadedForUserId: null,
      user: null,
      loading: false,
      failure: administrativeUserBoundaryFailure(boundary.invalidation),
    });
  }

  #isCurrent(
    userId: string,
    generation: number,
    partitionKey: string | null,
    lease: AdministrativeUserReadLease,
  ): boolean {
    return !this.#disposed &&
      this.#generation === generation &&
      this.#state.requestedUserId === userId &&
      this.#state.partitionKey === partitionKey &&
      this.#boundary.isLeaseCurrent(lease, partitionKey);
  }

  #publish(next: AdministrativeUserDetailState): void {
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
