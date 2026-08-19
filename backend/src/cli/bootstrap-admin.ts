import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  InitialAdminBootstrapCliService,
  InitialAdminInvitationCorrectionCliService,
} from '../account-actions/bootstrap-service.js';
import { AccountActionError } from '../account-actions/errors.js';
import { PostgresInitialAdminBootstrapRepository } from '../account-actions/postgres-invitation-bootstrap-repositories.js';
import { loadAuthenticationRuntimeConfig } from '../auth/config.js';
import {
  ConfigurationError,
  loadRuntimeConfig,
} from '../config.js';
import { createPostgresPool } from '../database/pool.js';
import { loadEmailRuntimeConfig } from '../email/config.js';
import { createAppLogger } from '../observability/logger.js';
import { createOutboxPayloadCipherFromBase64KeyRing } from '../outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../outbox/email-message.js';

const DEFAULT_ORGANIZATION_ID = 'org_tche_fertilidade';

export type BootstrapAdminCommand =
  | Readonly<{
      name: 'initialize';
      organizationId: string;
      adminName: string;
      email: string;
    }>
  | Readonly<{
      name: 'correct-email';
      organizationId: string;
      email: string;
    }>;

function safeArgument(value: string | undefined, name: string): string {
  if (
    value === undefined ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    throw new ConfigurationError(`Invalid ${name} argument.`);
  }
  return value;
}

export function parseBootstrapAdminCommand(
  arguments_: readonly string[],
): BootstrapAdminCommand {
  const [command, ...rawFlags] = arguments_;
  if (command !== 'initialize' && command !== 'correct-email') {
    throw new ConfigurationError(
      'Use bootstrap-admin initialize or correct-email.',
    );
  }
  if (rawFlags.length % 2 !== 0) {
    throw new ConfigurationError('Bootstrap CLI flags require values.');
  }

  const flags = new Map<string, string>();
  for (let index = 0; index < rawFlags.length; index += 2) {
    const flag = rawFlags[index];
    const value = rawFlags[index + 1];
    if (
      flag === undefined ||
      value === undefined ||
      !flag.startsWith('--') ||
      flags.has(flag)
    ) {
      throw new ConfigurationError('Invalid or duplicate bootstrap CLI flag.');
    }
    flags.set(flag, value);
  }

  const allowed = new Set(
    command === 'initialize'
      ? ['--organization-id', '--name', '--email']
      : ['--organization-id', '--email'],
  );
  if ([...flags.keys()].some((flag) => !allowed.has(flag))) {
    throw new ConfigurationError('Unknown bootstrap CLI flag.');
  }
  const organizationId = safeArgument(
    flags.get('--organization-id') ?? DEFAULT_ORGANIZATION_ID,
    'organization-id',
  );
  if (!/^[a-z][a-z0-9_-]{2,99}$/u.test(organizationId)) {
    throw new ConfigurationError('Invalid organization-id argument.');
  }
  const email = safeArgument(flags.get('--email'), 'email');

  if (command === 'initialize') {
    const adminName = safeArgument(flags.get('--name'), 'name').normalize('NFC');
    if (adminName.length > 160) {
      throw new ConfigurationError('Invalid name argument.');
    }
    return { name: command, organizationId, adminName, email };
  }
  return { name: command, organizationId, email };
}

export function platformDatabaseEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  const platformDatabaseUrl = source.PLATFORM_DATABASE_URL;
  if (source.NODE_ENV === 'production' && platformDatabaseUrl === undefined) {
    throw new ConfigurationError(
      'PLATFORM_DATABASE_URL is required in production.',
    );
  }
  return {
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: platformDatabaseUrl ?? source.DATABASE_URL,
    DATABASE_SSL_CA:
      source.PLATFORM_DATABASE_SSL_CA ?? source.DATABASE_SSL_CA,
    HOST: source.HOST,
    PORT: source.PORT,
    LOG_LEVEL: source.LOG_LEVEL,
  };
}

function bootstrapEnabled(
  source: Readonly<Record<string, string | undefined>>,
): boolean {
  const value = source.INITIAL_ADMIN_BOOTSTRAP_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new ConfigurationError(
      'INITIAL_ADMIN_BOOTSTRAP_ENABLED must be true or false.',
    );
  }
  return value === 'true';
}

export async function runBootstrapAdminCli(input: {
  readonly command: BootstrapAdminCommand;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): Promise<Readonly<Record<string, string>>> {
  const environment = input.environment ?? process.env;
  const enabled = bootstrapEnabled(environment);
  const runtimeConfig = loadRuntimeConfig(
    platformDatabaseEnvironment(environment),
  );
  const authenticationConfig = loadAuthenticationRuntimeConfig(environment);
  const emailConfig = loadEmailRuntimeConfig(
    runtimeConfig.nodeEnv,
    environment,
  );
  const emailOutbox = new EncryptedEmailOutboxFactory(
    createOutboxPayloadCipherFromBase64KeyRing(emailConfig.outboxKeyRing),
  );
  const logger = createAppLogger(runtimeConfig.logLevel);
  const database = createPostgresPool(
    runtimeConfig.database,
    logger,
    undefined,
    'tche_agro_platform_ops',
  );

  try {
    const repository = new PostgresInitialAdminBootstrapRepository({
      pool: database,
      emailHmacKey: authenticationConfig.abuseProtection.emailHmacKey,
      externalReferenceHmacKey:
        authenticationConfig.abuseProtection.externalReferenceHmacKey,
    });
    const common = {
      repository,
      emailOutbox,
      actionBaseUrl: emailConfig.actionBaseUrl,
      invitationTtlMs:
        authenticationConfig.challenges.inviteTtlSeconds * 1_000,
      enabled,
    } as const;
    const requestId = `cli_${randomUUID()}`;

    if (input.command.name === 'initialize') {
      const result = await new InitialAdminBootstrapCliService(common).run({
        organizationId: input.command.organizationId,
        name: input.command.adminName,
        email: input.command.email,
        requestId,
      });
      return Object.freeze({
        status: 'invitation_enqueued',
        admin_user_id: result.adminUserId,
        challenge_id: result.challengeId,
        expires_at: result.expiresAt.toISOString(),
      });
    }

    const result = await new InitialAdminInvitationCorrectionCliService(
      common,
    ).run({
      organizationId: input.command.organizationId,
      correctedEmail: input.command.email,
      reasonCode: 'bootstrap_email_typo',
      requestId,
    });
    return Object.freeze({
      status: 'replacement_invitation_enqueued',
      challenge_id: result.challengeId,
      expires_at: result.expiresAt.toISOString(),
    });
  } finally {
    await database.end().catch(() => undefined);
  }
}

function safeCliFailure(error: unknown): string {
  if (error instanceof ConfigurationError) return error.message;
  if (error instanceof AccountActionError) return error.code;
  return 'bootstrap_admin_failed';
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && fileURLToPath(import.meta.url) === entryPoint;
}

if (isMainModule()) {
  try {
    const command = parseBootstrapAdminCommand(process.argv.slice(2));
    const result = await runBootstrapAdminCli({ command });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'bootstrap_admin_failed',
        message: safeCliFailure(error),
      })}\n`,
    );
    process.exitCode = 1;
  }
}
