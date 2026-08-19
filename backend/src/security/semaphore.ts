export class SemaphoreCapacityError extends Error {
  public constructor() {
    super('Semaphore capacity is saturated.');
    this.name = 'SemaphoreCapacityError';
  }
}

export class AsyncSemaphore {
  readonly #maximumConcurrency: number;
  readonly #maximumWaiting: number;
  readonly #waiting: Array<() => void> = [];
  #active = 0;

  public constructor(maximumConcurrency: number, maximumWaiting: number) {
    if (!Number.isSafeInteger(maximumConcurrency) || maximumConcurrency < 1) {
      throw new TypeError('maximumConcurrency must be a positive integer.');
    }
    if (!Number.isSafeInteger(maximumWaiting) || maximumWaiting < 0) {
      throw new TypeError('maximumWaiting must be a non-negative integer.');
    }

    this.#maximumConcurrency = maximumConcurrency;
    this.#maximumWaiting = maximumWaiting;
  }

  public async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await operation();
    } finally {
      this.#release();
    }
  }

  async #acquire(): Promise<void> {
    if (this.#active < this.#maximumConcurrency) {
      this.#active += 1;
      return;
    }

    if (this.#waiting.length >= this.#maximumWaiting) {
      throw new SemaphoreCapacityError();
    }

    await new Promise<void>((resolve) => {
      this.#waiting.push(resolve);
    });
  }

  #release(): void {
    const next = this.#waiting.shift();
    if (next === undefined) {
      this.#active -= 1;
      return;
    }
    // Transfer the occupied slot directly. Decrementing before waking the
    // waiter would let a new caller barge in and temporarily exceed the cap.
    next();
  }
}
