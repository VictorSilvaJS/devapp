import type { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';
import type { AuthenticationRuntimeConfig } from './config.js';
import { loadPasswordBlocklist } from './password-blocklist.js';
import { DefaultPasswordCredentialService } from './password-credential.js';
import { Argon2idPasswordHasher } from './password-hasher.js';
import { PasswordPolicy } from './password-policy.js';
import {
  PostgresAuthRepository,
  type PostgresAuthRepositoryOptions,
} from './postgres-auth-repository.js';
import type { AuthPostgresPool } from './postgres-common.js';
import { PostgresLoginThrottle } from './postgres-login-throttle.js';
import {
  createAuthenticationService,
  type AuthenticationService,
} from './service.js';

export interface PostgresAuthenticationRuntimeOptions {
  readonly pool: AuthPostgresPool;
  readonly config: AuthenticationRuntimeConfig;
  readonly recoveryOutboxFactory: EncryptedEmailOutboxFactory;
  readonly recoveryActionBaseUrl: string;
  readonly organizationId?: string;
  readonly idGenerator?: PostgresAuthRepositoryOptions['idGenerator'];
}

/**
 * Composes the production adapters without opening a database connection.
 * Loading and verifying the password blocklist, plus the dummy Argon2id hash,
 * are deliberately completed before this factory resolves.
 */
export async function createPostgresAuthenticationRuntime(
  options: PostgresAuthenticationRuntimeOptions,
): Promise<Readonly<{
  service: AuthenticationService;
  repository: PostgresAuthRepository;
  throttle: PostgresLoginThrottle;
  credentials: DefaultPasswordCredentialService;
}>> {
  const blocklist = await loadPasswordBlocklist(
    options.config.password.blocklistManifestPath,
  );
  const credentials = new DefaultPasswordCredentialService(
    new PasswordPolicy(options.config.password, blocklist),
    new Argon2idPasswordHasher(options.config.password.argon2),
  );
  const repository = new PostgresAuthRepository({
    pool: options.pool,
    emailHmacKey: options.config.abuseProtection.emailHmacKey,
    recoveryOutboxFactory: options.recoveryOutboxFactory,
    recoveryActionBaseUrl: options.recoveryActionBaseUrl,
    ...(options.organizationId === undefined
      ? {}
      : { organizationId: options.organizationId }),
    ...(options.idGenerator === undefined
      ? {}
      : { idGenerator: options.idGenerator }),
  });
  const throttle = new PostgresLoginThrottle({
    pool: options.pool,
    ...(options.organizationId === undefined
      ? {}
      : { organizationId: options.organizationId }),
  });
  const service = await createAuthenticationService({
    config: options.config,
    repository,
    throttle,
    credentials,
  });

  return Object.freeze({ service, repository, throttle, credentials });
}
