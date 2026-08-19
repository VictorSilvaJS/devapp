import { ConfigurationError, type NodeEnvironment } from '../config.js';
import {
  createOutboxPayloadCipherFromBase64KeyRing,
  type Base64OutboxKeyRingConfig,
} from '../outbox/crypto.js';
import type { SmtpAdapterConfig } from './smtp.js';

const LOCAL_OUTBOX_KEY =
  'bG9jYWwtb25seS1vdXRib3gta2V5LTAwMDAwMDAwMDA=';

export interface EmailRuntimeConfig {
  readonly actionBaseUrl: string;
  readonly outboxKeyRing: Base64OutboxKeyRingConfig;
  readonly smtp: SmtpAdapterConfig;
  readonly worker: Readonly<{
    id: string;
    concurrency: number;
    batchSize: number;
    pollIntervalMs: number;
  }>;
}

function integerValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(source[key] ?? defaultValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(`${key} is outside its approved range.`);
  }
  return value;
}

function booleanValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = source[key];
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ConfigurationError(`${key} must be true or false.`);
}

function requiredText(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
  defaultValue: string | undefined,
): string {
  const value = source[key] ?? defaultValue;
  if (
    value === undefined ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    throw new ConfigurationError(`${key} is invalid.`);
  }
  return value;
}

function parseActionBaseUrl(value: string, environment: NodeEnvironment): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigurationError('AUTH_ACTION_BASE_URL must be a valid URL.');
  }

  const localHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '[::1]');
  if (parsed.protocol !== 'https:' && !(environment !== 'production' && localHttp)) {
    throw new ConfigurationError(
      'AUTH_ACTION_BASE_URL must use HTTPS outside local development.',
    );
  }
  if (
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new ConfigurationError(
      'AUTH_ACTION_BASE_URL must not contain credentials, query or fragment.',
    );
  }

  return parsed.toString().replace(/\/$/u, '');
}

function parseOutboxKeyRing(
  source: Readonly<Record<string, string | undefined>>,
  environment: NodeEnvironment,
): Base64OutboxKeyRingConfig {
  const activeKeyId = requiredText(
    source,
    'OUTBOX_ACTIVE_KEY_ID',
    environment === 'production' ? undefined : 'local-v1',
  );
  const serialized = requiredText(
    source,
    'OUTBOX_ENCRYPTION_KEYS',
    environment === 'production'
      ? undefined
      : JSON.stringify({ 'local-v1': LOCAL_OUTBOX_KEY }),
  );

  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new ConfigurationError('OUTBOX_ENCRYPTION_KEYS must be valid JSON.');
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    Array.isArray(decoded) ||
    Object.values(decoded).some((value) => typeof value !== 'string')
  ) {
    throw new ConfigurationError(
      'OUTBOX_ENCRYPTION_KEYS must map key IDs to base64 keys.',
    );
  }

  const config = {
    activeKeyId,
    keys: decoded as Readonly<Record<string, string>>,
  };
  try {
    createOutboxPayloadCipherFromBase64KeyRing(config);
  } catch {
    throw new ConfigurationError('OUTBOX_ENCRYPTION_KEYS is invalid.');
  }
  return Object.freeze({
    activeKeyId,
    keys: Object.freeze({ ...config.keys }),
  });
}

export function loadEmailRuntimeConfig(
  environment: NodeEnvironment,
  source: Readonly<Record<string, string | undefined>> = process.env,
): EmailRuntimeConfig {
  const actionBaseUrl = parseActionBaseUrl(
    requiredText(
      source,
      'AUTH_ACTION_BASE_URL',
      environment === 'production'
        ? undefined
        : 'http://127.0.0.1:8081/auth-action',
    ),
    environment,
  );
  const secure = booleanValue(source, 'SMTP_SECURE', false);
  const requireTls = booleanValue(
    source,
    'SMTP_REQUIRE_TLS',
    environment === 'production',
  );
  if (environment === 'production' && !secure && !requireTls) {
    throw new ConfigurationError('Production SMTP must require verified TLS.');
  }

  const username = source.SMTP_USERNAME;
  const password = source.SMTP_PASSWORD;
  if ((username === undefined) !== (password === undefined)) {
    throw new ConfigurationError(
      'SMTP_USERNAME and SMTP_PASSWORD must be configured together.',
    );
  }

  return Object.freeze({
    actionBaseUrl,
    outboxKeyRing: parseOutboxKeyRing(source, environment),
    smtp: Object.freeze({
      host: requiredText(
        source,
        'SMTP_HOST',
        environment === 'production' ? undefined : '127.0.0.1',
      ),
      port: integerValue(source, 'SMTP_PORT', 1_025, 1, 65_535),
      secure,
      requireTls,
      from: requiredText(
        source,
        'SMTP_FROM',
        environment === 'production'
          ? undefined
          : 'Tchê Agro <nao-responda@tche-agro.local>',
      ),
      ...(username === undefined
        ? {}
        : {
            username: requiredText(source, 'SMTP_USERNAME', undefined),
            password: requiredText(source, 'SMTP_PASSWORD', undefined),
          }),
      connectionTimeoutMs: integerValue(
        source,
        'SMTP_CONNECTION_TIMEOUT_MS',
        10_000,
        1_000,
        30_000,
      ),
      greetingTimeoutMs: integerValue(
        source,
        'SMTP_GREETING_TIMEOUT_MS',
        10_000,
        1_000,
        30_000,
      ),
      socketTimeoutMs: integerValue(
        source,
        'SMTP_SOCKET_TIMEOUT_MS',
        30_000,
        1_000,
        60_000,
      ),
    }),
    worker: Object.freeze({
      id: requiredText(source, 'OUTBOX_WORKER_ID', 'worker-local'),
      concurrency: integerValue(source, 'OUTBOX_WORKER_CONCURRENCY', 4, 1, 32),
      batchSize: integerValue(source, 'OUTBOX_WORKER_BATCH_SIZE', 20, 1, 500),
      pollIntervalMs: integerValue(
        source,
        'OUTBOX_WORKER_POLL_INTERVAL_MS',
        1_000,
        100,
        60_000,
      ),
    }),
  });
}
