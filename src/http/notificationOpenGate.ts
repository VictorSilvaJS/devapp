export interface NotificationOpenLease {
  isActive(): boolean;
  release(): boolean;
}

/**
 * Synchronous process-local gate for the complete notification-open flow.
 * The lease remains active across destination resolution, session
 * revalidation and navigation; a second tap cannot replace its owner.
 */
export class NotificationOpenGate {
  #generation = 0;
  #active = false;

  get busy(): boolean {
    return this.#active;
  }

  tryAcquire(): NotificationOpenLease | null {
    if (this.#active) return null;
    this.#active = true;
    const generation = ++this.#generation;
    let released = false;

    return Object.freeze({
      isActive: (): boolean => (
        !released && this.#active && this.#generation === generation
      ),
      release: (): boolean => {
        if (released) return false;
        released = true;
        if (!this.#active || this.#generation !== generation) return false;
        this.#active = false;
        return true;
      },
    });
  }

  invalidate(): void {
    this.#generation += 1;
    this.#active = false;
  }
}
