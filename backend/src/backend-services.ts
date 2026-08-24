import type { Pool } from 'pg';

import type { AccountActionRoutesOptions } from './account-actions/account-action-routes.js';
import { AdminBreakGlassContinuationService } from './account-actions/admin-break-glass-service.js';
import { AdminSecondaryRecoveryService } from './account-actions/admin-secondary-recovery-service.js';
import { AssistedRecoveryService } from './account-actions/assisted-recovery-service.js';
import { InvitationService } from './account-actions/invitation-service.js';
import { PostgresAdminSecondaryRecoveryRepository } from './account-actions/postgres-admin-secondary-recovery-repository.js';
import { PostgresAdminBreakGlassRepository } from './account-actions/postgres-admin-break-glass-repository.js';
import { PostgresAssistedRecoveryRepository } from './account-actions/postgres-assisted-recovery-repository.js';
import {
  PostgresPrimaryEmailChangeRepository,
  PostgresPrimaryEmailPasswordVerifier,
  PostgresSecondaryEmailRepository,
} from './account-actions/postgres-email-repositories.js';
import { PostgresInvitationRepository } from './account-actions/postgres-invitation-bootstrap-repositories.js';
import { PrimaryEmailChangeService } from './account-actions/primary-email-service.js';
import { SecondaryEmailService } from './account-actions/secondary-email-service.js';
import { loadAuthenticationRuntimeConfig } from './auth/config.js';
import { createPostgresAuthenticationRuntime } from './auth/runtime.js';
import type { AuthenticationService } from './auth/service.js';
import type { RuntimeConfig } from './config.js';
import { loadEmailRuntimeConfig } from './email/config.js';
import { createOutboxPayloadCipherFromBase64KeyRing } from './outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from './outbox/email-message.js';
import { PostgresNotificationRepository } from './notifications/postgres-notification-repository.js';
import {
  DefaultNotificationService,
  type NotificationService,
} from './notifications/service.js';
import { PostgresPropertyRepository } from './properties/postgres-property-repository.js';
import { DefaultPropertyService, type PropertyService } from './properties/service.js';

export interface BackendSecurityServices {
  readonly authenticationService: AuthenticationService;
  readonly accountActionRoutes: Omit<
    AccountActionRoutesOptions,
    'authenticationService'
  >;
  readonly propertyRoutes: Readonly<{ service: PropertyService }>;
  readonly notificationRoutes: Readonly<{ service: NotificationService }>;
}

/**
 * Composes the MP-33B/MP-34 services without touching PostgreSQL. Keeping this
 * factory free of queries preserves the operational contract that a temporary
 * database outage must not prevent the HTTP port from opening.
 */
export async function createBackendSecurityServices(input: {
  readonly database: Pool;
  readonly runtimeConfig: RuntimeConfig;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): Promise<BackendSecurityServices> {
  const environment = input.environment ?? process.env;
  const authenticationConfig = loadAuthenticationRuntimeConfig(environment);
  const emailConfig = loadEmailRuntimeConfig(
    input.runtimeConfig.nodeEnv,
    environment,
  );
  const outboxCipher = createOutboxPayloadCipherFromBase64KeyRing(
    emailConfig.outboxKeyRing,
  );
  const emailOutbox = new EncryptedEmailOutboxFactory(outboxCipher);
  const authenticationRuntime = await createPostgresAuthenticationRuntime({
    pool: input.database,
    config: authenticationConfig,
    recoveryOutboxFactory: emailOutbox,
    recoveryActionBaseUrl: emailConfig.actionBaseUrl,
  });
  const passwordCredentials = authenticationRuntime.credentials;
  const commonAccountRepositoryOptions = {
    pool: input.database,
    emailHmacKey: authenticationConfig.abuseProtection.emailHmacKey,
    externalReferenceHmacKey:
      authenticationConfig.abuseProtection.externalReferenceHmacKey,
  } as const;

  const authenticationService = authenticationRuntime.service;

  const actionTtlMs = authenticationConfig.challenges.actionTtlSeconds * 1_000;
  const restrictedAuthorizationTtlMs =
    authenticationConfig.challenges.restrictedAuthorizationTtlSeconds * 1_000;

  return Object.freeze({
    authenticationService,
    propertyRoutes: Object.freeze({
      service: new DefaultPropertyService({
        authentication: authenticationService,
        repository: new PostgresPropertyRepository(input.database),
      }),
    }),
    notificationRoutes: Object.freeze({
      service: new DefaultNotificationService({
        authentication: authenticationService,
        repository: new PostgresNotificationRepository(input.database),
      }),
    }),
    accountActionRoutes: Object.freeze({
      invitationService: new InvitationService({
        repository: new PostgresInvitationRepository(
          commonAccountRepositoryOptions,
        ),
        passwordCredentials,
        emailOutbox,
        actionBaseUrl: emailConfig.actionBaseUrl,
        invitationTtlMs:
          authenticationConfig.challenges.inviteTtlSeconds * 1_000,
      }),
      primaryEmailService: new PrimaryEmailChangeService({
        repository: new PostgresPrimaryEmailChangeRepository(
          commonAccountRepositoryOptions,
        ),
        passwordVerifier: new PostgresPrimaryEmailPasswordVerifier({
          pool: input.database,
          passwordCredentials,
        }),
        emailOutbox,
        actionBaseUrl: emailConfig.actionBaseUrl,
        changeTtlMs: actionTtlMs,
      }),
      secondaryEmailService: new SecondaryEmailService({
        repository: new PostgresSecondaryEmailRepository(
          commonAccountRepositoryOptions,
        ),
        emailOutbox,
        actionBaseUrl: emailConfig.actionBaseUrl,
        verificationTtlMs: actionTtlMs,
      }),
      adminSecondaryRecoveryService: new AdminSecondaryRecoveryService({
        repository: new PostgresAdminSecondaryRecoveryRepository(
          commonAccountRepositoryOptions,
        ),
        passwordCredentials,
        emailOutbox,
        actionBaseUrl: emailConfig.actionBaseUrl,
        throttle: authenticationRuntime.throttle,
        abuseProtection: authenticationConfig.abuseProtection,
        challengeTtlMs: actionTtlMs,
        restrictedAuthorizationTtlMs,
      }),
      adminBreakGlassContinuationService: new AdminBreakGlassContinuationService({
        repository: new PostgresAdminBreakGlassRepository(
          commonAccountRepositoryOptions,
        ),
        passwordCredentials,
        emailOutbox,
        restrictedAuthorizationTtlMs,
      }),
      assistedRecoveryService: new AssistedRecoveryService({
        repository: new PostgresAssistedRecoveryRepository(
          commonAccountRepositoryOptions,
        ),
        passwordCredentials,
        emailOutbox,
        actionBaseUrl: emailConfig.actionBaseUrl,
        emailChallengeTtlMs: actionTtlMs,
        restrictedAuthorizationTtlMs,
      }),
      assistedRecoveryEnabled: authenticationConfig.assistedRecovery.enabled,
    }),
  });
}
