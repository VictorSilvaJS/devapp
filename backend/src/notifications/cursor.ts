import { badRequest } from '../security/http-error.js';
import type { NotificationCursor } from './contracts.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_CURSOR_LENGTH = 1_024;

interface SerializedNotificationCursor {
  readonly v: 1;
  readonly criada_em: string;
  readonly id: string;
}

function serializedCursor(
  value: unknown,
): value is SerializedNotificationCursor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    Object.keys(record).length !== 3 ||
    record.v !== 1 ||
    typeof record.criada_em !== 'string' ||
    typeof record.id !== 'string' ||
    !UUID_PATTERN.test(record.id)
  ) {
    return false;
  }
  const parsed = new Date(record.criada_em);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString() === record.criada_em
  );
}

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  if (Number.isNaN(cursor.createdAt.getTime()) || !UUID_PATTERN.test(cursor.id)) {
    throw new TypeError('Cannot encode an invalid notification cursor.');
  }
  const value: SerializedNotificationCursor = {
    v: 1,
    criada_em: cursor.createdAt.toISOString(),
    id: cursor.id,
  };
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeNotificationCursor(encoded: string): NotificationCursor {
  if (
    encoded.length === 0 ||
    encoded.length > MAX_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw badRequest();
  }
  let parsed: unknown;
  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) throw badRequest();
    const decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== encoded) {
      throw badRequest();
    }
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    throw badRequest();
  }
  if (!serializedCursor(parsed)) throw badRequest();
  const cursor = { createdAt: new Date(parsed.criada_em), id: parsed.id };
  if (encodeNotificationCursor(cursor) !== encoded) throw badRequest();
  return cursor;
}
