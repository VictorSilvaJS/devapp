export type AdministrativeUserBoundaryInvalidation =
  | 'partition_changed'
  | 'invalid_session'
  | 'forbidden';

export interface AdministrativeUserBoundarySnapshot {
  readonly partitionKey: string | null;
  readonly generation: number;
  readonly invalidation: AdministrativeUserBoundaryInvalidation | null;
}

export interface AdministrativeUserReadLease {
  readonly issuedPartitionKey: string | null;
  readonly issuedGeneration: number;
}

type Listener = () => void;

interface LeaseRecord {
  readonly partitionKey: string | null;
  readonly generation: number;
  readonly allowInitialRestore: boolean;
}

function snapshot(
  partitionKey: string | null,
  generation: number,
  invalidation: AdministrativeUserBoundaryInvalidation | null,
): AdministrativeUserBoundarySnapshot {
  return Object.freeze({ partitionKey, generation, invalidation });
}

export class AdministrativeUserDataBoundary {
  readonly #listeners = new Set<Listener>();
  readonly #leases = new WeakMap<object, LeaseRecord>();
  #snapshot: AdministrativeUserBoundarySnapshot;

  constructor(partitionKey: string | null = null) {
    this.#snapshot = snapshot(partitionKey, 0, null);
  }

  get current(): AdministrativeUserBoundarySnapshot {
    return this.#snapshot;
  }

  get activeSubscriptionCount(): number {
    return this.#listeners.size;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  synchronizePartition(partitionKey: string | null): boolean {
    if (partitionKey === this.#snapshot.partitionKey) return false;
    this.#snapshot = snapshot(
      partitionKey,
      this.#snapshot.generation + 1,
      'partition_changed',
    );
    this.#notify();
    return true;
  }

  issueLease(
    options: Readonly<{ allowInitialRestore?: boolean }> = {},
  ): AdministrativeUserReadLease {
    const lease = Object.freeze({
      issuedPartitionKey: this.#snapshot.partitionKey,
      issuedGeneration: this.#snapshot.generation,
    });
    this.#leases.set(lease, {
      partitionKey: this.#snapshot.partitionKey,
      generation: this.#snapshot.generation,
      allowInitialRestore:
        options.allowInitialRestore === true &&
        this.#snapshot.partitionKey === null,
    });
    return lease;
  }

  isLeaseCurrent(
    lease: AdministrativeUserReadLease,
    expectedPartitionKey: string | null = this.#snapshot.partitionKey,
  ): boolean {
    const record = this.#leases.get(lease);
    return record !== undefined &&
      record.partitionKey === expectedPartitionKey &&
      record.partitionKey === this.#snapshot.partitionKey &&
      record.generation === this.#snapshot.generation;
  }

  resolveAfterInitialRestore(
    lease: AdministrativeUserReadLease,
    restoredPartitionKey: string,
  ): AdministrativeUserReadLease | null {
    if (this.isLeaseCurrent(lease, restoredPartitionKey)) return lease;
    const record = this.#leases.get(lease);
    if (
      record === undefined ||
      !record.allowInitialRestore ||
      record.partitionKey !== null ||
      record.generation + 1 !== this.#snapshot.generation ||
      this.#snapshot.invalidation !== 'partition_changed' ||
      restoredPartitionKey !== this.#snapshot.partitionKey
    ) {
      return null;
    }
    return this.issueLease();
  }

  invalidateAccess(
    lease: AdministrativeUserReadLease,
    reason: 'invalid_session' | 'forbidden',
  ): boolean {
    if (!this.isLeaseCurrent(lease)) return false;
    this.#snapshot = snapshot(
      this.#snapshot.partitionKey,
      this.#snapshot.generation + 1,
      reason,
    );
    this.#notify();
    return true;
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch {
        // Uma superfície defeituosa não pode impedir a limpeza das demais.
      }
    }
  }
}
