import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes as nodeRandomBytes,
} from 'node:crypto';

import { badRequest } from '../security/http-error.js';
import type { AdministrativeUserCursorKeyRingConfig } from './config.js';
import type { AdministrativeUserCursor } from './user-contracts.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_KEY_ID = /^[A-Za-z0-9_.-]{1,64}$/u;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]+$/u;
const MAX_CURSOR_LENGTH = 2_048;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_TTL_MS = 15 * 60_000;

export interface AdministrativeUserCursorFilters {
  readonly search?: string;
  readonly profile?: string;
  readonly status?: string;
}

interface SerializedCursor {
  readonly v: 1;
  readonly order: string;
  readonly id: string;
  readonly fingerprint: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function filterFingerprint(filters: AdministrativeUserCursorFilters): string {
  return createHash('sha256')
    .update(JSON.stringify([
      'administrative-users',
      1,
      filters.search ?? null,
      filters.profile ?? null,
      filters.status ?? null,
    ]), 'utf8')
    .digest('base64url');
}

function authenticatedData(keyId: string, fingerprint: string): Buffer {
  return Buffer.from(
    JSON.stringify(['tche-agro-administrative-user-cursor', 1, keyId, fingerprint]),
    'utf8',
  );
}

function decodeCanonicalBase64Url(value: string, expectedBytes?: number): Buffer {
  if (!TOKEN_SEGMENT.test(value)) throw badRequest();
  const bytes = Buffer.from(value, 'base64url');
  if (
    bytes.toString('base64url') !== value
    || (expectedBytes !== undefined && bytes.byteLength !== expectedBytes)
  ) {
    throw badRequest();
  }
  return bytes;
}

function isSerializedCursor(value: unknown): value is SerializedCursor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.keys(record).length === 6
    && record.v === 1
    && typeof record.order === 'string'
    && Array.from(record.order).length > 0
    && Array.from(record.order).length <= 200
    && typeof record.id === 'string'
    && UUID_PATTERN.test(record.id)
    && typeof record.fingerprint === 'string'
    && /^[A-Za-z0-9_-]{43}$/u.test(record.fingerprint)
    && Number.isSafeInteger(record.issuedAt)
    && Number.isSafeInteger(record.expiresAt);
}

export class AdministrativeUserCursorCodec {
  readonly #activeKeyId: string;
  readonly #keys: ReadonlyMap<string, Buffer>;
  readonly #clock: () => Date;
  readonly #randomBytes: (size: number) => Buffer;
  readonly #ttlMs: number;

  public constructor(input: {
    readonly activeKeyId: string;
    readonly keys: readonly Readonly<{ id: string; key: Uint8Array }>[];
    readonly clock?: () => Date;
    readonly randomBytes?: (size: number) => Buffer;
    readonly ttlMs?: number;
  }) {
    if (!SAFE_KEY_ID.test(input.activeKeyId)) throw new TypeError('Invalid cursor keyring.');
    const keys = new Map<string, Buffer>();
    for (const candidate of input.keys) {
      if (
        !SAFE_KEY_ID.test(candidate.id)
        || candidate.key.byteLength !== KEY_BYTES
        || keys.has(candidate.id)
      ) {
        throw new TypeError('Invalid cursor keyring.');
      }
      const derived = hkdfSync(
        'sha256',
        Buffer.from(candidate.key),
        Buffer.alloc(0),
        Buffer.from('tche-agro-administrative-user-cursor-v1', 'utf8'),
        KEY_BYTES,
      );
      keys.set(candidate.id, Buffer.from(derived));
    }
    if (!keys.has(input.activeKeyId)) throw new TypeError('Invalid cursor keyring.');
    const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 24 * 60 * 60_000) {
      throw new TypeError('Invalid cursor lifetime.');
    }
    this.#activeKeyId = input.activeKeyId;
    this.#keys = keys;
    this.#clock = input.clock ?? (() => new Date());
    this.#randomBytes = input.randomBytes ?? nodeRandomBytes;
    this.#ttlMs = ttlMs;
  }

  public encode(
    cursor: AdministrativeUserCursor,
    filters: AdministrativeUserCursorFilters,
  ): string {
    if (
      Array.from(cursor.sortKey).length === 0
      || Array.from(cursor.sortKey).length > 200
      || !UUID_PATTERN.test(cursor.id)
    ) {
      throw new TypeError('Cannot encode an invalid administrative user cursor.');
    }
    const key = this.#keys.get(this.#activeKeyId);
    if (key === undefined) throw new TypeError('Invalid cursor keyring.');
    const now = this.#clock().getTime();
    if (!Number.isSafeInteger(now)) throw new TypeError('Invalid cursor clock.');
    const fingerprint = filterFingerprint(filters);
    const serialized: SerializedCursor = {
      v: 1,
      order: cursor.sortKey,
      id: cursor.id,
      fingerprint,
      issuedAt: now,
      expiresAt: now + this.#ttlMs,
    };
    const iv = this.#randomBytes(IV_BYTES);
    if (iv.byteLength !== IV_BYTES) throw new TypeError('Invalid cursor entropy source.');
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(authenticatedData(this.#activeKeyId, fingerprint));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(serialized), 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      this.#activeKeyId,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  public decode(
    encoded: string,
    filters: AdministrativeUserCursorFilters,
  ): AdministrativeUserCursor {
    try {
      if (encoded.length === 0 || encoded.length > MAX_CURSOR_LENGTH) throw badRequest();
      const segments = encoded.split('.');
      if (segments.length !== 5 || segments[0] !== 'v1') throw badRequest();
      const keyId = segments[1];
      const encodedIv = segments[2];
      const encodedCiphertext = segments[3];
      const encodedTag = segments[4];
      if (
        keyId === undefined || !SAFE_KEY_ID.test(keyId)
        || encodedIv === undefined || encodedCiphertext === undefined
        || encodedTag === undefined
      ) {
        throw badRequest();
      }
      const key = this.#keys.get(keyId);
      if (key === undefined) throw badRequest();
      const fingerprint = filterFingerprint(filters);
      const decipher = createDecipheriv('aes-256-gcm', key, decodeCanonicalBase64Url(encodedIv, IV_BYTES), {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(authenticatedData(keyId, fingerprint));
      decipher.setAuthTag(decodeCanonicalBase64Url(encodedTag, TAG_BYTES));
      const plaintext = Buffer.concat([
        decipher.update(decodeCanonicalBase64Url(encodedCiphertext)),
        decipher.final(),
      ]).toString('utf8');
      const parsed: unknown = JSON.parse(plaintext);
      if (!isSerializedCursor(parsed)) throw badRequest();
      const now = this.#clock().getTime();
      if (
        parsed.fingerprint !== fingerprint
        || parsed.expiresAt <= now
        || parsed.issuedAt > now
        || parsed.expiresAt - parsed.issuedAt !== this.#ttlMs
      ) {
        throw badRequest();
      }
      return { sortKey: parsed.order, id: parsed.id };
    } catch {
      throw badRequest();
    }
  }
}

export function createAdministrativeUserCursorCodecFromBase64KeyRing(
  config: AdministrativeUserCursorKeyRingConfig,
): AdministrativeUserCursorCodec {
  const keys = Object.entries(config.keys).map(([id, encoded]) => {
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
    ) {
      throw new TypeError('Invalid cursor keyring.');
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.byteLength !== KEY_BYTES || key.toString('base64') !== encoded) {
      throw new TypeError('Invalid cursor keyring.');
    }
    return { id, key };
  });
  return new AdministrativeUserCursorCodec({ activeKeyId: config.activeKeyId, keys });
}
