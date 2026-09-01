import {
  createCipheriv,
  createDecipheriv,
  randomBytes as nodeRandomBytes,
} from 'node:crypto';

import type {
  EncryptedOutboxPayload,
  OutboxEncryptionContext,
} from './contracts.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;

export class OutboxPayloadCryptoError extends Error {
  readonly code:
    | 'invalid_keyring'
    | 'unsupported_envelope'
    | 'decryption_failed'
    | 'invalid_payload';

  constructor(code: OutboxPayloadCryptoError['code']) {
    super('Outbox payload cryptographic operation failed.');
    this.name = 'OutboxPayloadCryptoError';
    this.code = code;
  }
}

export interface OutboxEncryptionKey {
  readonly id: string;
  readonly key: Buffer;
}

export interface Base64OutboxKeyRingConfig {
  /** Value supplied by OUTBOX_ACTIVE_KEY_ID after runtime config validation. */
  readonly activeKeyId: string;
  /** Versioned key IDs mapped to standard base64-encoded 32-byte keys. */
  readonly keys: Readonly<Record<string, string>>;
}

function assertSafeIdentifier(value: string): void {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(value)) {
    throw new OutboxPayloadCryptoError('invalid_keyring');
  }
}

function authenticatedData(context: OutboxEncryptionContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      'tche-agro-outbox',
      1,
      context.organizationId,
      context.messageId,
      context.messageType,
    ]),
    'utf8',
  );
}

function decodeBase64Url(value: string): Buffer {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    throw new OutboxPayloadCryptoError('decryption_failed');
  }
}

export class OutboxPayloadCipher {
  readonly #activeKeyId: string;
  readonly #keys: ReadonlyMap<string, Buffer>;
  readonly #randomBytes: (size: number) => Buffer;

  constructor(input: {
    readonly activeKeyId: string;
    readonly keys: readonly OutboxEncryptionKey[];
    readonly randomBytes?: (size: number) => Buffer;
  }) {
    assertSafeIdentifier(input.activeKeyId);
    const keys = new Map<string, Buffer>();

    for (const candidate of input.keys) {
      assertSafeIdentifier(candidate.id);
      if (candidate.key.byteLength !== KEY_BYTES || keys.has(candidate.id)
        || [...keys.values()].some((key) => key.equals(Buffer.from(candidate.key)))) {
        throw new OutboxPayloadCryptoError('invalid_keyring');
      }
      keys.set(candidate.id, Buffer.from(candidate.key));
    }

    if (!keys.has(input.activeKeyId)) {
      throw new OutboxPayloadCryptoError('invalid_keyring');
    }

    this.#activeKeyId = input.activeKeyId;
    this.#keys = keys;
    this.#randomBytes = input.randomBytes ?? nodeRandomBytes;
  }

  encrypt(
    payload: Readonly<Record<string, unknown>>,
    context: OutboxEncryptionContext,
  ): EncryptedOutboxPayload {
    const key = this.#keys.get(this.#activeKeyId);
    if (key === undefined) {
      throw new OutboxPayloadCryptoError('invalid_keyring');
    }

    const iv = this.#randomBytes(IV_BYTES);
    if (iv.byteLength !== IV_BYTES) {
      throw new OutboxPayloadCryptoError('invalid_keyring');
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      throw new OutboxPayloadCryptoError('invalid_payload');
    }
    if (serialized === undefined) {
      throw new OutboxPayloadCryptoError('invalid_payload');
    }

    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTHENTICATION_TAG_BYTES,
    });
    cipher.setAAD(authenticatedData(context));
    const ciphertext = Buffer.concat([
      cipher.update(serialized, 'utf8'),
      cipher.final(),
    ]);

    return {
      version: 1,
      algorithm: ALGORITHM,
      keyId: this.#activeKeyId,
      iv: iv.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      authenticationTag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decrypt(
    envelope: EncryptedOutboxPayload,
    context: OutboxEncryptionContext,
  ): Readonly<Record<string, unknown>> {
    if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
      throw new OutboxPayloadCryptoError('unsupported_envelope');
    }

    const key = this.#keys.get(envelope.keyId);
    if (key === undefined) {
      throw new OutboxPayloadCryptoError('decryption_failed');
    }

    try {
      const iv = decodeBase64Url(envelope.iv);
      const authenticationTag = decodeBase64Url(envelope.authenticationTag);
      if (
        iv.byteLength !== IV_BYTES ||
        authenticationTag.byteLength !== AUTHENTICATION_TAG_BYTES
      ) {
        throw new OutboxPayloadCryptoError('decryption_failed');
      }

      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTHENTICATION_TAG_BYTES,
      });
      decipher.setAAD(authenticatedData(context));
      decipher.setAuthTag(authenticationTag);
      const plaintext = Buffer.concat([
        decipher.update(decodeBase64Url(envelope.ciphertext)),
        decipher.final(),
      ]).toString('utf8');
      const decoded: unknown = JSON.parse(plaintext);

      if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
        throw new OutboxPayloadCryptoError('invalid_payload');
      }

      return decoded as Readonly<Record<string, unknown>>;
    } catch (error) {
      if (
        error instanceof OutboxPayloadCryptoError &&
        error.code === 'invalid_payload'
      ) {
        throw error;
      }
      throw new OutboxPayloadCryptoError('decryption_failed');
    }
  }
}

export function createOutboxPayloadCipherFromBase64KeyRing(
  config: Base64OutboxKeyRingConfig,
): OutboxPayloadCipher {
  const keys = Object.entries(config.keys).map(([id, encoded]) => {
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    ) {
      throw new OutboxPayloadCryptoError('invalid_keyring');
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.byteLength !== KEY_BYTES || key.toString('base64') !== encoded) {
      throw new OutboxPayloadCryptoError('invalid_keyring');
    }
    return { id, key };
  });

  return new OutboxPayloadCipher({
    activeKeyId: config.activeKeyId,
    keys,
  });
}
