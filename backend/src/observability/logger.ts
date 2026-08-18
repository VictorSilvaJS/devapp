import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino';

import type { LogLevel } from '../config.js';

const REDACTION_CENSOR = '[REDACTED]';

export const LOGGER_REDACTION_PATHS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'senha',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'DATABASE_URL',
  'databaseUrl',
  'connectionString',
  'connection',
  'database',
  'postgres',
  'pg',
  'config',
  'env',
  '*.authorization',
  '*.cookie',
  '*.password',
  '*.senha',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.access_token',
  '*.refresh_token',
  '*.connectionString',
  '*.*.authorization',
  '*.*.cookie',
  '*.*.password',
  '*.*.senha',
  '*.*.token',
  '*.*.accessToken',
  '*.*.refreshToken',
  '*.*.access_token',
  '*.*.refresh_token',
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',
  'res.headers.set-cookie',
  'response.headers.set-cookie',
] as const;

export interface SafeLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  warn(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function safeIdentifier(value: unknown, fallback: string): string {
  const candidate = optionalText(value);
  if (candidate !== undefined && /^[A-Za-z0-9_.-]{1,64}$/.test(candidate)) {
    return candidate;
  }

  return fallback;
}

function removeQueryAndFragment(value: string): string {
  const queryIndex = value.indexOf('?');
  const fragmentIndex = value.indexOf('#');
  const indexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);
  const endIndex = indexes.length === 0 ? value.length : Math.min(...indexes);
  return value.slice(0, endIndex);
}

export function serializeRequest(value: unknown): Record<string, unknown> {
  const request = asRecord(value);
  if (request === undefined) {
    return {};
  }

  const serialized: Record<string, unknown> = {};
  const requestId = optionalText(request.id ?? request.reqId);
  const method = optionalText(request.method);
  const url = optionalText(request.url);
  const hostname = optionalText(request.hostname);
  const remoteAddress = optionalText(request.remoteAddress);

  if (requestId !== undefined) serialized.request_id = requestId;
  if (method !== undefined) serialized.method = method;
  if (url !== undefined) serialized.path = removeQueryAndFragment(url);
  if (hostname !== undefined) serialized.hostname = hostname;
  if (remoteAddress !== undefined) serialized.remote_address = remoteAddress;

  return serialized;
}

export function serializeResponse(value: unknown): Record<string, unknown> {
  const response = asRecord(value);
  if (response === undefined) {
    return {};
  }

  const statusCode = response.statusCode;
  return typeof statusCode === 'number' && Number.isInteger(statusCode)
    ? { status_code: statusCode }
    : {};
}

export function serializeError(value: unknown): Record<string, unknown> {
  const error = asRecord(value);
  if (error === undefined) {
    return { type: 'Error' };
  }

  return {
    type: safeIdentifier(error.name, 'Error'),
    ...(error.code === undefined
      ? {}
      : { code: safeIdentifier(error.code, 'unknown') }),
  };
}

export function createLoggerOptions(level: LogLevel): LoggerOptions {
  return {
    level,
    messageKey: 'message',
    redact: {
      paths: [...LOGGER_REDACTION_PATHS],
      censor: REDACTION_CENSOR,
    },
    serializers: {
      req: serializeRequest,
      request: serializeRequest,
      res: serializeResponse,
      response: serializeResponse,
      err: serializeError,
      error: serializeError,
    },
  };
}

export function createAppLogger(
  level: LogLevel,
  destination?: DestinationStream,
): Logger {
  const options = createLoggerOptions(level);
  return destination === undefined
    ? pino(options)
    : pino(options, destination);
}
