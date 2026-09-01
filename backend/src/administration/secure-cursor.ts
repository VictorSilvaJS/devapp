import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes as nodeRandomBytes,
} from 'node:crypto';

import { badRequest } from '../security/http-error.js';
import type { AdministrativeUserCursorKeyRingConfig } from './config.js';

const SAFE_KEY_ID = /^[A-Za-z0-9_.-]{1,64}$/u;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]+$/u;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_CURSOR_LENGTH = 2_048;
const DEFAULT_TTL_MS = 15 * 60_000;

function codePointLength(value: string): number {
  return Array.from(value.normalize('NFC')).length;
}

interface Envelope {
  readonly v: 1;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly fingerprint: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function decodeSegment(value: string, expectedBytes?: number): Buffer {
  if (!TOKEN_SEGMENT.test(value)) throw badRequest();
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value
    || (expectedBytes !== undefined && decoded.byteLength !== expectedBytes)) {
    throw badRequest();
  }
  return decoded;
}

export class SecureAdministrativeCursorCodec {
  readonly #activeKeyId: string;
  readonly #keys: ReadonlyMap<string, Buffer>;
  readonly #namespace: string;
  readonly #clock: () => Date;
  readonly #randomBytes: (size: number) => Buffer;
  readonly #ttlMs: number;

  public constructor(input: {
    readonly namespace: 'administrative-links' | 'administrative-municipalities';
    readonly config: AdministrativeUserCursorKeyRingConfig;
    readonly clock?: () => Date;
    readonly randomBytes?: (size: number) => Buffer;
    readonly ttlMs?: number;
  }) {
    if (!SAFE_KEY_ID.test(input.config.activeKeyId)) throw new TypeError('Invalid cursor keyring.');
    const keys = new Map<string, Buffer>();
    const sourceKeys: Buffer[] = [];
    for (const [id, encoded] of Object.entries(input.config.keys)) {
      const source = Buffer.from(encoded, 'base64');
      if (!SAFE_KEY_ID.test(id) || source.byteLength !== KEY_BYTES
        || source.toString('base64') !== encoded || keys.has(id)
        || sourceKeys.some((candidate) => candidate.equals(source))) {
        throw new TypeError('Invalid cursor keyring.');
      }
      sourceKeys.push(source);
      keys.set(id, Buffer.from(hkdfSync(
        'sha256', source, Buffer.alloc(0),
        Buffer.from(`tche-agro-${input.namespace}-cursor-v1`, 'utf8'), KEY_BYTES,
      )));
    }
    if (!keys.has(input.config.activeKeyId)) throw new TypeError('Invalid cursor keyring.');
    const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 86_400_000) {
      throw new TypeError('Invalid cursor lifetime.');
    }
    this.#activeKeyId = input.config.activeKeyId;
    this.#keys = keys;
    this.#namespace = input.namespace;
    this.#clock = input.clock ?? (() => new Date());
    this.#randomBytes = input.randomBytes ?? nodeRandomBytes;
    this.#ttlMs = ttlMs;
  }

  #fingerprint(binding: Readonly<Record<string, unknown>>): string {
    return createHash('sha256')
      .update(canonical({ namespace: this.#namespace, version: 1, ...binding }), 'utf8')
      .digest('base64url');
  }

  #aad(keyId: string, fingerprint: string): Buffer {
    return Buffer.from(canonical([this.#namespace, 1, keyId, fingerprint]), 'utf8');
  }

  public encode(
    payload: Readonly<Record<string, unknown>>,
    binding: Readonly<Record<string, unknown>>,
  ): string {
    const key = this.#keys.get(this.#activeKeyId);
    if (key === undefined) throw new TypeError('Invalid cursor keyring.');
    const now = this.#clock().getTime();
    const fingerprint = this.#fingerprint(binding);
    const envelope: Envelope = {
      v: 1,
      payload,
      fingerprint,
      issuedAt: now,
      expiresAt: now + this.#ttlMs,
    };
    const iv = this.#randomBytes(IV_BYTES);
    if (iv.byteLength !== IV_BYTES) throw new TypeError('Invalid cursor entropy source.');
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(this.#aad(this.#activeKeyId, fingerprint));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(envelope), 'utf8'), cipher.final(),
    ]);
    return ['v1', this.#activeKeyId, iv.toString('base64url'),
      ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  }

  public decode(
    encoded: string,
    binding: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    try {
      if (codePointLength(encoded) === 0 || codePointLength(encoded) > MAX_CURSOR_LENGTH) {
        throw badRequest();
      }
      const [version, keyId, encodedIv, ciphertext, encodedTag, extra] = encoded.split('.');
      if (version !== 'v1' || extra !== undefined || keyId === undefined
        || !SAFE_KEY_ID.test(keyId) || encodedIv === undefined
        || ciphertext === undefined || encodedTag === undefined) throw badRequest();
      const key = this.#keys.get(keyId);
      if (key === undefined) throw badRequest();
      const fingerprint = this.#fingerprint(binding);
      const decipher = createDecipheriv(
        'aes-256-gcm', key, decodeSegment(encodedIv, IV_BYTES),
        { authTagLength: TAG_BYTES },
      );
      decipher.setAAD(this.#aad(keyId, fingerprint));
      decipher.setAuthTag(decodeSegment(encodedTag, TAG_BYTES));
      const value: unknown = JSON.parse(Buffer.concat([
        decipher.update(decodeSegment(ciphertext)), decipher.final(),
      ]).toString('utf8'));
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw badRequest();
      const envelope = value as Partial<Envelope>;
      const now = this.#clock().getTime();
      if (Object.keys(value).length !== 5 || envelope.v !== 1
        || typeof envelope.payload !== 'object' || envelope.payload === null
        || Array.isArray(envelope.payload) || envelope.fingerprint !== fingerprint
        || !Number.isSafeInteger(envelope.issuedAt)
        || !Number.isSafeInteger(envelope.expiresAt)
        || Number(envelope.expiresAt) <= now || Number(envelope.issuedAt) > now
        || Number(envelope.expiresAt) - Number(envelope.issuedAt) !== this.#ttlMs) {
        throw badRequest();
      }
      return envelope.payload;
    } catch {
      throw badRequest();
    }
  }
}
