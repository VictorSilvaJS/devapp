import type { PasswordHasher, PasswordVerificationResult } from './password-hasher.js';
import type { PasswordPolicy } from './password-policy.js';

export interface PasswordCredentialService {
  validateAndHash(password: string): Promise<{
    readonly passwordHash: string;
    readonly policyVersion: string;
  }>;
  /** Optional for account-action consumers that only create credentials. */
  verify?(
    password: string,
    passwordHash: string,
  ): Promise<PasswordVerificationResult>;
}

export interface AuthenticationPasswordCredentialService
  extends PasswordCredentialService {
  verify(password: string, passwordHash: string): Promise<PasswordVerificationResult>;
  /** Rehashes a valid legacy credential without applying new-account block rules. */
  rehash(password: string): Promise<{
    readonly passwordHash: string;
    readonly policyVersion: string;
  }>;
}

export class DefaultPasswordCredentialService
  implements AuthenticationPasswordCredentialService
{
  readonly #policy: PasswordPolicy;
  readonly #hasher: PasswordHasher;

  public constructor(policy: PasswordPolicy, hasher: PasswordHasher) {
    this.#policy = policy;
    this.#hasher = hasher;
  }

  public async validateAndHash(password: string): Promise<{
    readonly passwordHash: string;
    readonly policyVersion: string;
  }> {
    const normalizedPassword = this.#policy.validate(password);
    const passwordHash = await this.#hasher.hash(normalizedPassword);
    return { passwordHash, policyVersion: this.#policy.version };
  }

  public verify(
    password: string,
    passwordHash: string,
  ): Promise<PasswordVerificationResult> {
    return this.#hasher.verify(password, passwordHash);
  }

  public async rehash(password: string): Promise<{
    readonly passwordHash: string;
    readonly policyVersion: string;
  }> {
    return {
      passwordHash: await this.#hasher.hash(password),
      policyVersion: this.#policy.version,
    };
  }
}
