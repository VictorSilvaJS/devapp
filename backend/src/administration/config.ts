import { timingSafeEqual } from 'node:crypto';

import { ConfigurationError } from '../config.js';

const SAFE_KEY_ID = /^[A-Za-z0-9_.-]{1,64}$/u;
const CANONICAL_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const KEY_BYTES = 32;

export interface AdministrativeUserCursorKeyRingConfig {
  readonly activeKeyId: string;
  readonly keys: Readonly<Record<string, string>>;
}

function requiredText(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = source[key];
  if (
    value === undefined
    || value.length === 0
    || value !== value.trim()
    || value.includes('\r')
    || value.includes('\n')
  ) {
    throw new ConfigurationError(`${key} is required and must be valid.`);
  }
  return value;
}

function decodeKey(value: string): Buffer {
  if (!CANONICAL_BASE64.test(value)) {
    throw new ConfigurationError('ADMIN_USER_CURSOR_KEYS is invalid.');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.byteLength !== KEY_BYTES || decoded.toString('base64') !== value) {
    throw new ConfigurationError('ADMIN_USER_CURSOR_KEYS is invalid.');
  }
  return decoded;
}

export function loadAdministrativeUserCursorRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AdministrativeUserCursorKeyRingConfig {
  const activeKeyId = requiredText(source, 'ADMIN_USER_CURSOR_ACTIVE_KEY_ID');
  if (!SAFE_KEY_ID.test(activeKeyId)) {
    throw new ConfigurationError('ADMIN_USER_CURSOR_ACTIVE_KEY_ID is invalid.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(requiredText(source, 'ADMIN_USER_CURSOR_KEYS'));
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError('ADMIN_USER_CURSOR_KEYS must be valid JSON.');
  }
  if (
    typeof decoded !== 'object'
    || decoded === null
    || Array.isArray(decoded)
    || Object.keys(decoded).length === 0
    || Object.entries(decoded).some(
      ([id, value]) => !SAFE_KEY_ID.test(id) || typeof value !== 'string',
    )
  ) {
    throw new ConfigurationError(
      'ADMIN_USER_CURSOR_KEYS must map key IDs to base64 keys.',
    );
  }

  const keys = decoded as Readonly<Record<string, string>>;
  for (const encoded of Object.values(keys)) decodeKey(encoded);
  if (keys[activeKeyId] === undefined) {
    throw new ConfigurationError(
      'ADMIN_USER_CURSOR_ACTIVE_KEY_ID must identify a configured key.',
    );
  }
  return Object.freeze({
    activeKeyId,
    keys: Object.freeze({ ...keys }),
  });
}

export function assertAdministrativeUserCursorKeysAreIndependent(
  cursorConfig: AdministrativeUserCursorKeyRingConfig,
  outboxKeys: Readonly<Record<string, string>>,
): void {
  const cursorKeys = Object.values(cursorConfig.keys).map(decodeKey);
  const decodedOutboxKeys = Object.values(outboxKeys).map((value) =>
    Buffer.from(value, 'base64'),
  );
  if (
    cursorKeys.some((cursorKey) =>
      decodedOutboxKeys.some(
        (outboxKey) =>
          outboxKey.byteLength === cursorKey.byteLength
          && timingSafeEqual(outboxKey, cursorKey),
      ),
    )
  ) {
    throw new ConfigurationError(
      'Administrative cursor keys must be distinct from outbox keys.',
    );
  }
}
