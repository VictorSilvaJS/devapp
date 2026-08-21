import { badRequest } from '../security/http-error.js';
import type { PropertyCursor } from './contracts.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_ENCODED_CURSOR_LENGTH = 32_768;
const MAX_CURSOR_NAME_UTF8_BYTES = 16_384;

interface SerializedPropertyCursor {
  readonly v: 1;
  readonly nome: string;
  readonly id: string;
}

function isSerializedCursor(value: unknown): value is SerializedPropertyCursor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return (
    Object.keys(record).length === 3 &&
    record.v === 1 &&
    typeof record.nome === 'string' &&
    record.nome.length > 0 &&
    Buffer.byteLength(record.nome, 'utf8') <= MAX_CURSOR_NAME_UTF8_BYTES &&
    typeof record.id === 'string' &&
    UUID_PATTERN.test(record.id)
  );
}

export function encodePropertyCursor(cursor: PropertyCursor): string {
  if (
    cursor.name.length === 0 ||
    Buffer.byteLength(cursor.name, 'utf8') > MAX_CURSOR_NAME_UTF8_BYTES ||
    !UUID_PATTERN.test(cursor.id)
  ) {
    throw new TypeError('Cannot encode an invalid property cursor.');
  }
  const serialized: SerializedPropertyCursor = {
    v: 1,
    nome: cursor.name,
    id: cursor.id,
  };
  const encoded = Buffer.from(JSON.stringify(serialized), 'utf8').toString(
    'base64url',
  );
  if (encoded.length > MAX_ENCODED_CURSOR_LENGTH) {
    throw new TypeError('Cannot encode an oversized property cursor.');
  }
  return encoded;
}

export function decodePropertyCursor(encoded: string): PropertyCursor {
  if (
    encoded.length > MAX_ENCODED_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  ) {
    throw badRequest();
  }

  let decoded: string;
  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) throw badRequest();
    decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== encoded) {
      throw badRequest();
    }
  } catch {
    throw badRequest();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    throw badRequest();
  }
  if (!isSerializedCursor(parsed)) throw badRequest();

  const cursor = { name: parsed.nome, id: parsed.id };
  if (encodePropertyCursor(cursor) !== encoded) throw badRequest();
  return cursor;
}
