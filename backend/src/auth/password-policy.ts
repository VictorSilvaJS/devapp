import type { PasswordRuntimeConfig } from './config.js';
import {
  countUnicodeCodePoints,
  normalizePassword,
} from './normalization.js';
import type { PasswordBlocklist } from './password-blocklist.js';

export type PasswordPolicyViolation =
  | 'length'
  | 'complexity'
  | 'blocked';

export class PasswordPolicyError extends Error {
  public readonly violation: PasswordPolicyViolation;

  public constructor(violation: PasswordPolicyViolation) {
    super('A senha não atende à política de segurança.');
    this.name = 'PasswordPolicyError';
    this.violation = violation;
  }
}

export class PasswordPolicy {
  readonly #config: PasswordRuntimeConfig;
  readonly #blocklist: PasswordBlocklist;

  public constructor(
    config: PasswordRuntimeConfig,
    blocklist: PasswordBlocklist,
  ) {
    this.#config = config;
    this.#blocklist = blocklist;
  }

  public get version(): string {
    return this.#config.policyVersion;
  }

  /** Returns the exact NFC value that must be passed to Argon2id. */
  public validate(password: string): string {
    const normalized = normalizePassword(password);
    const length = countUnicodeCodePoints(normalized);

    if (
      length < this.#config.minimumLength ||
      length > this.#config.maximumLength
    ) {
      throw new PasswordPolicyError('length');
    }

    const satisfiesOneOfThree =
      /\p{Lu}/u.test(normalized) ||
      /\p{Nd}/u.test(normalized) ||
      /[\p{P}\p{S}]/u.test(normalized);
    if (!satisfiesOneOfThree) {
      throw new PasswordPolicyError('complexity');
    }

    if (this.#blocklist.has(normalized)) {
      throw new PasswordPolicyError('blocked');
    }

    return normalized;
  }
}

