import { X509Certificate } from 'node:crypto';

import envSchema from 'env-schema';

const ALLOWED_NODE_ENVIRONMENTS = [
  'development',
  'test',
  'production',
] as const;

const ALLOWED_LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

const ENVIRONMENT_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'DATABASE_SSL_CA',
  'HOST',
  'PORT',
  'LOG_LEVEL',
] as const;

export const DEFAULT_READINESS_TIMEOUT_MS = 2_000;

export type NodeEnvironment = (typeof ALLOWED_NODE_ENVIRONMENTS)[number];
export type LogLevel = (typeof ALLOWED_LOG_LEVELS)[number];

export type DatabaseSslConfig =
  | false
  | Readonly<{
      rejectUnauthorized: true;
      ca?: string;
    }>;

export interface DatabaseConfig {
  readonly connectionString: string;
  readonly ssl: DatabaseSslConfig;
  readonly connectionTimeoutMillis: number;
}

export interface RuntimeConfig {
  readonly nodeEnv: NodeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly readinessTimeoutMs: number;
  readonly database: DatabaseConfig;
}

interface RawEnvironmentConfig {
  NODE_ENV: NodeEnvironment;
  DATABASE_URL: string;
  DATABASE_SSL_CA?: string;
  HOST: string;
  PORT: number;
  LOG_LEVEL: LogLevel;
}

export class ConfigurationError extends Error {
  public constructor(message = 'Invalid backend environment configuration.') {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const environmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['DATABASE_URL'],
  properties: {
    NODE_ENV: {
      type: 'string',
      enum: [...ALLOWED_NODE_ENVIRONMENTS],
      default: 'development',
    },
    DATABASE_URL: {
      type: 'string',
      minLength: 1,
    },
    DATABASE_SSL_CA: {
      type: 'string',
      minLength: 1,
    },
    HOST: {
      type: 'string',
      minLength: 1,
      default: '0.0.0.0',
    },
    PORT: {
      type: 'integer',
      minimum: 1,
      maximum: 65_535,
      default: 3_000,
    },
    LOG_LEVEL: {
      type: 'string',
      enum: [...ALLOWED_LOG_LEVELS],
      default: 'info',
    },
  },
} as const;

function selectKnownEnvironmentValues(
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const selected: Record<string, string> = {};

  for (const key of ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      selected[key] = value;
    }
  }

  return selected;
}

function parseDatabaseUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigurationError('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new ConfigurationError('DATABASE_URL must use PostgreSQL.');
  }

  if (parsed.hostname.length === 0 || parsed.pathname.length <= 1) {
    throw new ConfigurationError(
      'DATABASE_URL must identify a PostgreSQL host and database.',
    );
  }

  if (parsed.hash.length > 0) {
    throw new ConfigurationError(
      'DATABASE_URL must not contain a fragment.',
    );
  }

  if (parsed.port !== '' && Number(parsed.port) < 1) {
    throw new ConfigurationError(
      'DATABASE_URL must use a valid PostgreSQL port.',
    );
  }

  if (parsed.searchParams.size > 0) {
    throw new ConfigurationError(
      'DATABASE_URL must not contain query parameters.',
    );
  }

  return value;
}

function parseTrustedCertificate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.replaceAll('\\n', '\n').trim();
  const certificatePattern =
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const certificates = normalized.match(certificatePattern) ?? [];
  const remainder = normalized.replace(certificatePattern, '').trim();

  if (certificates.length === 0 || remainder.length > 0) {
    throw new ConfigurationError(
      'DATABASE_SSL_CA must contain one or more PEM certificates.',
    );
  }

  try {
    for (const certificate of certificates) {
      new X509Certificate(certificate);
    }
  } catch {
    throw new ConfigurationError(
      'DATABASE_SSL_CA must contain one or more valid X.509 certificates.',
    );
  }

  return certificates.join('\n');
}

export function buildDatabaseConfig(input: {
  readonly nodeEnv: NodeEnvironment;
  readonly databaseUrl: string;
  readonly certificateAuthority?: string;
}): DatabaseConfig {
  const connectionString = parseDatabaseUrl(input.databaseUrl.trim());
  const certificateAuthority = parseTrustedCertificate(
    input.certificateAuthority,
  );

  const requiresTls =
    input.nodeEnv === 'production' || certificateAuthority !== undefined;
  const ssl: DatabaseSslConfig = requiresTls
    ? Object.freeze({
        rejectUnauthorized: true as const,
        ...(certificateAuthority === undefined
          ? {}
          : { ca: certificateAuthority }),
      })
    : false;

  return Object.freeze({
    connectionString,
    ssl,
    connectionTimeoutMillis: DEFAULT_READINESS_TIMEOUT_MS,
  });
}

export function loadRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfig {
  let rawConfig: RawEnvironmentConfig;

  try {
    rawConfig = envSchema<RawEnvironmentConfig>({
      schema: environmentSchema,
      data: selectKnownEnvironmentValues(source),
    });
  } catch {
    throw new ConfigurationError();
  }

  const database = buildDatabaseConfig({
    nodeEnv: rawConfig.NODE_ENV,
    databaseUrl: rawConfig.DATABASE_URL,
    ...(rawConfig.DATABASE_SSL_CA === undefined
      ? {}
      : { certificateAuthority: rawConfig.DATABASE_SSL_CA }),
  });

  return Object.freeze({
    nodeEnv: rawConfig.NODE_ENV,
    host: rawConfig.HOST,
    port: rawConfig.PORT,
    logLevel: rawConfig.LOG_LEVEL,
    readinessTimeoutMs: DEFAULT_READINESS_TIMEOUT_MS,
    database,
  });
}
