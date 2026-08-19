import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConfigurationError, type NodeEnvironment } from '../config.js';

const DEFAULT_PASSWORD_MIN_LENGTH = 8;
const REQUIRED_PASSWORD_MAX_LENGTH = 128;
const MINIMUM_ARGON2_MEMORY_KIB = 19 * 1_024;
const MINIMUM_ARGON2_TIME_COST = 2;
const MINIMUM_ARGON2_PARALLELISM = 1;
const MAXIMUM_ARGON2_AGGREGATE_MEMORY_KIB = 1_048_576;
const MAXIMUM_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MAXIMUM_SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAXIMUM_SESSION_INACTIVITY_TTL_SECONDS = 14 * 24 * 60 * 60;
const MINIMUM_SECRET_BYTES = 32;
const NON_PRODUCTION_EMAIL_HMAC_KEY_BASE64 =
  'dGNoZS1hZ3JvLWRldi1lbWFpbC1obWFjLWtleS0wMDAx';
const NON_PRODUCTION_IP_HMAC_KEY_BASE64 =
  'dGNoZS1hZ3JvLWRldi1pcC1obWFjLWtleS0wMDAwMDE=';
const NON_PRODUCTION_EXTERNAL_REFERENCE_HMAC_KEY_BASE64 =
  'dGNoZS1hZ3JvLWRldi1yZWYtaG1hYy1rZXktMDAwMDAx';

export const DEFAULT_PASSWORD_BLOCKLIST_MANIFEST_PATH = fileURLToPath(
  new URL('../../security/blocklists/passwords.manifest.json', import.meta.url),
);

export interface PasswordRuntimeConfig {
  readonly policyVersion: string;
  readonly minimumLength: number;
  readonly maximumLength: 128;
  readonly blocklistManifestPath: string;
  readonly argon2: Readonly<{
    memoryCostKiB: number;
    timeCost: number;
    parallelism: number;
    maximumConcurrency: number;
  }>;
}

export interface AuthenticationRuntimeConfig {
  readonly password: PasswordRuntimeConfig;
  readonly tokens: Readonly<{
    accessTtlSeconds: number;
    refreshAbsoluteTtlSeconds: number;
    refreshInactivityTtlSeconds: number;
  }>;
  readonly abuseProtection: Readonly<{
    emailHmacKey: Uint8Array;
    ipHmacKey: Uint8Array;
    externalReferenceHmacKey: Uint8Array;
    windowSeconds: number;
    failureThreshold: number;
    lockScheduleSeconds: readonly number[];
  }>;
  readonly challenges: Readonly<{
    inviteTtlSeconds: number;
    actionTtlSeconds: number;
    passwordRecoveryTtlSeconds: number;
    restrictedAuthorizationTtlSeconds: number;
  }>;
  readonly assistedRecovery: Readonly<{
    enabled: boolean;
    policyVersion?: string;
  }>;
}

function integerEnvironmentValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  defaultValue: number,
  options: Readonly<{ minimum: number; maximum: number }>,
): number {
  const rawValue = source[key];
  const value = rawValue === undefined ? defaultValue : Number(rawValue);

  if (
    !Number.isSafeInteger(value) ||
    value < options.minimum ||
    value > options.maximum
  ) {
    throw new ConfigurationError(`${key} is outside its approved range.`);
  }

  return value;
}

function requiredSecret(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  environment: NodeEnvironment,
  nonProductionDefault: string,
): Uint8Array {
  const value = source[key] ??
    (environment === 'production' ? undefined : nonProductionDefault);
  if (value === undefined || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw new ConfigurationError(`${key} must be valid base64.`);
  }

  const decoded = Buffer.from(value, 'base64');
  const canonical = decoded.toString('base64').replace(/=+$/u, '');
  if (
    decoded.length < MINIMUM_SECRET_BYTES ||
    canonical !== value.replace(/=+$/u, '')
  ) {
    throw new ConfigurationError(`${key} must decode to at least 32 bytes.`);
  }

  return Uint8Array.from(decoded);
}

function booleanEnvironmentValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  defaultValue: boolean,
): boolean {
  const rawValue = source[key];
  if (rawValue === undefined) return defaultValue;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new ConfigurationError(`${key} must be true or false.`);
}

function lockSchedule(
  source: Readonly<Record<string, string | undefined>>,
): readonly number[] {
  const rawValue = source.AUTH_LOGIN_LOCK_SCHEDULE_SECONDS ?? '60,120,240,480,900';
  const values = rawValue.split(',').map((item) => Number(item));

  if (
    values.length === 0 ||
    values.length > 10 ||
    values.some(
      (value, index) =>
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 15 * 60 ||
        (index > 0 && value < (values[index - 1] ?? 0)),
    )
  ) {
    throw new ConfigurationError(
      'AUTH_LOGIN_LOCK_SCHEDULE_SECONDS must be an increasing list capped at 900 seconds.',
    );
  }

  return Object.freeze(values);
}

function nodeEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): NodeEnvironment {
  const value = source.NODE_ENV ?? 'development';
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new ConfigurationError('NODE_ENV is invalid.');
  }

  return value;
}

/**
 * Loads only authentication-specific values. Security floors apply in every
 * environment so a deployment cannot silently weaken them through env vars.
 */
export function loadAuthenticationRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AuthenticationRuntimeConfig {
  const environment = nodeEnvironment(source);
  const minimumLength = integerEnvironmentValue(
    source,
    'PASSWORD_MIN_LENGTH',
    DEFAULT_PASSWORD_MIN_LENGTH,
    { minimum: DEFAULT_PASSWORD_MIN_LENGTH, maximum: REQUIRED_PASSWORD_MAX_LENGTH },
  );
  const maximumLength = integerEnvironmentValue(
    source,
    'PASSWORD_MAX_LENGTH',
    REQUIRED_PASSWORD_MAX_LENGTH,
    { minimum: REQUIRED_PASSWORD_MAX_LENGTH, maximum: REQUIRED_PASSWORD_MAX_LENGTH },
  ) as 128;

  if (minimumLength > maximumLength) {
    throw new ConfigurationError(
      'PASSWORD_MIN_LENGTH must not exceed PASSWORD_MAX_LENGTH.',
    );
  }

  const accessTtlSeconds = integerEnvironmentValue(
    source,
    'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    MAXIMUM_ACCESS_TOKEN_TTL_SECONDS,
    { minimum: 60, maximum: MAXIMUM_ACCESS_TOKEN_TTL_SECONDS },
  );
  const refreshAbsoluteTtlSeconds = integerEnvironmentValue(
    source,
    'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
    MAXIMUM_SESSION_ABSOLUTE_TTL_SECONDS,
    { minimum: accessTtlSeconds, maximum: MAXIMUM_SESSION_ABSOLUTE_TTL_SECONDS },
  );
  const refreshInactivityTtlSeconds = integerEnvironmentValue(
    source,
    'AUTH_SESSION_INACTIVITY_TTL_SECONDS',
    MAXIMUM_SESSION_INACTIVITY_TTL_SECONDS,
    { minimum: accessTtlSeconds, maximum: MAXIMUM_SESSION_INACTIVITY_TTL_SECONDS },
  );

  if (refreshInactivityTtlSeconds > refreshAbsoluteTtlSeconds) {
    throw new ConfigurationError(
      'AUTH_SESSION_INACTIVITY_TTL_SECONDS must not exceed the absolute session TTL.',
    );
  }

  const assistedRecoveryEnabled = booleanEnvironmentValue(
    source,
    'ASSISTED_RECOVERY_ENABLED',
    false,
  );
  const assistedRecoveryPolicyVersion =
    source.ASSISTED_RECOVERY_POLICY_VERSION?.trim() || undefined;
  if (
    environment === 'production' &&
    assistedRecoveryEnabled &&
    assistedRecoveryPolicyVersion === undefined
  ) {
    throw new ConfigurationError(
      'ASSISTED_RECOVERY_POLICY_VERSION is required when assisted recovery is enabled in production.',
    );
  }

  const manifestPath =
    source.PASSWORD_BLOCKLIST_MANIFEST_PATH?.trim() ||
    DEFAULT_PASSWORD_BLOCKLIST_MANIFEST_PATH;

  if (
    (environment === 'test' || environment === 'production') &&
    manifestPath.length === 0
  ) {
    throw new ConfigurationError(
      'PASSWORD_BLOCKLIST_MANIFEST_PATH is required in test and production.',
    );
  }

  const emailHmacKey = requiredSecret(
    source,
    'AUTH_EMAIL_HMAC_KEY',
    environment,
    NON_PRODUCTION_EMAIL_HMAC_KEY_BASE64,
  );
  const ipHmacKey = requiredSecret(
    source,
    'AUTH_IP_HMAC_KEY',
    environment,
    NON_PRODUCTION_IP_HMAC_KEY_BASE64,
  );
  const externalReferenceHmacKey = requiredSecret(
    source,
    'AUTH_EXTERNAL_REFERENCE_HMAC_KEY',
    environment,
    NON_PRODUCTION_EXTERNAL_REFERENCE_HMAC_KEY_BASE64,
  );
  if (
    Buffer.from(emailHmacKey).equals(Buffer.from(ipHmacKey)) ||
    Buffer.from(emailHmacKey).equals(Buffer.from(externalReferenceHmacKey)) ||
    Buffer.from(ipHmacKey).equals(Buffer.from(externalReferenceHmacKey))
  ) {
    throw new ConfigurationError(
      'Authentication HMAC purposes must use different keys.',
    );
  }

  const argon2MemoryCostKiB = integerEnvironmentValue(
    source,
    'ARGON2_MEMORY_KIB',
    MINIMUM_ARGON2_MEMORY_KIB,
    { minimum: MINIMUM_ARGON2_MEMORY_KIB, maximum: 1_048_576 },
  );
  const argon2MaximumConcurrency = integerEnvironmentValue(
    source,
    'ARGON2_MAX_CONCURRENCY',
    2,
    { minimum: 1, maximum: 32 },
  );
  if (
    argon2MemoryCostKiB * argon2MaximumConcurrency >
    MAXIMUM_ARGON2_AGGREGATE_MEMORY_KIB
  ) {
    throw new ConfigurationError(
      'ARGON2_MEMORY_KIB times ARGON2_MAX_CONCURRENCY exceeds the approved memory budget.',
    );
  }

  return Object.freeze({
    password: Object.freeze({
      policyVersion: source.PASSWORD_POLICY_VERSION?.trim() || 'mp33b-v1',
      minimumLength,
      maximumLength,
      blocklistManifestPath: resolve(manifestPath),
      argon2: Object.freeze({
        memoryCostKiB: argon2MemoryCostKiB,
        timeCost: integerEnvironmentValue(source, 'ARGON2_TIME_COST', 2, {
          minimum: MINIMUM_ARGON2_TIME_COST,
          maximum: 10,
        }),
        parallelism: integerEnvironmentValue(source, 'ARGON2_PARALLELISM', 1, {
          minimum: MINIMUM_ARGON2_PARALLELISM,
          maximum: 8,
        }),
        maximumConcurrency: argon2MaximumConcurrency,
      }),
    }),
    tokens: Object.freeze({
      accessTtlSeconds,
      refreshAbsoluteTtlSeconds,
      refreshInactivityTtlSeconds,
    }),
    abuseProtection: Object.freeze({
      emailHmacKey,
      ipHmacKey,
      externalReferenceHmacKey,
      windowSeconds: integerEnvironmentValue(
        source,
        'AUTH_LOGIN_FAILURE_WINDOW_SECONDS',
        15 * 60,
        { minimum: 60, maximum: 15 * 60 },
      ),
      failureThreshold: integerEnvironmentValue(
        source,
        'AUTH_LOGIN_FAILURE_THRESHOLD',
        5,
        { minimum: 5, maximum: 20 },
      ),
      lockScheduleSeconds: lockSchedule(source),
    }),
    challenges: Object.freeze({
      inviteTtlSeconds: integerEnvironmentValue(
        source,
        'AUTH_INVITE_TTL_SECONDS',
        72 * 60 * 60,
        { minimum: 60 * 60, maximum: 72 * 60 * 60 },
      ),
      actionTtlSeconds: integerEnvironmentValue(
        source,
        'AUTH_ACTION_TTL_SECONDS',
        30 * 60,
        { minimum: 5 * 60, maximum: 30 * 60 },
      ),
      passwordRecoveryTtlSeconds: integerEnvironmentValue(
        source,
        'AUTH_PASSWORD_RECOVERY_TTL_SECONDS',
        30 * 60,
        { minimum: 5 * 60, maximum: 30 * 60 },
      ),
      restrictedAuthorizationTtlSeconds: integerEnvironmentValue(
        source,
        'AUTH_RESTRICTED_AUTHORIZATION_TTL_SECONDS',
        15 * 60,
        { minimum: 5 * 60, maximum: 30 * 60 },
      ),
    }),
    assistedRecovery: Object.freeze({
      enabled: assistedRecoveryEnabled,
      ...(assistedRecoveryPolicyVersion === undefined
        ? {}
        : { policyVersion: assistedRecoveryPolicyVersion }),
    }),
  });
}
