import argon2 from 'argon2';

import type { PasswordRuntimeConfig } from './config.js';
import { normalizePassword } from './normalization.js';
import {
  AsyncSemaphore,
  SemaphoreCapacityError,
} from '../security/semaphore.js';

export interface PasswordVerificationResult {
  readonly valid: boolean;
  readonly needsRehash: boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<PasswordVerificationResult>;
}

export class PasswordHashingCapacityError extends Error {
  public constructor() {
    super('Password hashing capacity is temporarily saturated.');
    this.name = 'PasswordHashingCapacityError';
  }
}

export interface Argon2Adapter {
  readonly argon2id: 0 | 1 | 2;
  hash(
    password: string,
    options: Readonly<{
      type: 0 | 1 | 2;
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    }>,
  ): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  needsRehash(
    passwordHash: string,
    options: Readonly<{
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    }>,
  ): boolean;
}

export class Argon2idPasswordHasher implements PasswordHasher {
  readonly #adapter: Argon2Adapter;
  readonly #options: Readonly<{
    type: 0 | 1 | 2;
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  }>;
  readonly #semaphore: AsyncSemaphore;

  public constructor(
    config: PasswordRuntimeConfig['argon2'],
    adapter: Argon2Adapter = argon2,
  ) {
    this.#adapter = adapter;
    this.#options = Object.freeze({
      type: adapter.argon2id,
      memoryCost: config.memoryCostKiB,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
    });
    // Waiting requests retain their HTTP request state. Keep that queue as
    // small and explicit as the active Argon2 pool, then fail fast.
    this.#semaphore = new AsyncSemaphore(
      config.maximumConcurrency,
      config.maximumConcurrency,
    );
  }

  public async hash(password: string): Promise<string> {
    const normalized = normalizePassword(password);
    try {
      return await this.#semaphore.run(async () => {
        const passwordHash = await this.#adapter.hash(normalized, this.#options);
        if (!passwordHash.startsWith('$argon2id$')) {
          throw new Error('Argon2 adapter did not return an Argon2id PHC string.');
        }
        return passwordHash;
      });
    } catch (error) {
      if (error instanceof SemaphoreCapacityError) {
        throw new PasswordHashingCapacityError();
      }
      throw error;
    }
  }

  public async verify(
    password: string,
    passwordHash: string,
  ): Promise<PasswordVerificationResult> {
    if (!passwordHash.startsWith('$argon2id$')) {
      return { valid: false, needsRehash: false };
    }

    try {
      return await this.#semaphore.run(async () => {
        try {
          const valid = await this.#adapter.verify(
            passwordHash,
            normalizePassword(password),
          );
          return {
            valid,
            needsRehash:
              valid &&
              this.#adapter.needsRehash(passwordHash, {
                memoryCost: this.#options.memoryCost,
                timeCost: this.#options.timeCost,
                parallelism: this.#options.parallelism,
              }),
          };
        } catch {
          return { valid: false, needsRehash: false };
        }
      });
    } catch (error) {
      if (error instanceof SemaphoreCapacityError) {
        throw new PasswordHashingCapacityError();
      }
      throw error;
    }
  }
}
