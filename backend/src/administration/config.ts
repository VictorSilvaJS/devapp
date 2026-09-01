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

export interface AdministrativeLinkCursorKeyRingConfig
  extends AdministrativeUserCursorKeyRingConfig {}

export interface AdministrativeMunicipalityCursorKeyRingConfig
  extends AdministrativeUserCursorKeyRingConfig {}

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

function decodeKey(value: string, variable = 'ADMIN_USER_CURSOR_KEYS'): Buffer {
  if (!CANONICAL_BASE64.test(value)) {
    throw new ConfigurationError(`${variable} is invalid.`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.byteLength !== KEY_BYTES || decoded.toString('base64') !== value) {
    throw new ConfigurationError(`${variable} is invalid.`);
  }
  return decoded;
}

function loadCursorRuntimeConfig(
  source: Readonly<Record<string, string | undefined>>,
  prefix: 'ADMIN_USER_CURSOR' | 'ADMIN_LINK_CURSOR' | 'ADMIN_MUNICIPALITY_CURSOR',
): AdministrativeUserCursorKeyRingConfig {
  const activeVariable = `${prefix}_ACTIVE_KEY_ID`;
  const keysVariable = `${prefix}_KEYS`;
  const activeKeyId = requiredText(source, activeVariable);
  if (!SAFE_KEY_ID.test(activeKeyId)) {
    throw new ConfigurationError(`${activeVariable} is invalid.`);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(requiredText(source, keysVariable));
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`${keysVariable} must be valid JSON.`);
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
      `${keysVariable} must map key IDs to base64 keys.`,
    );
  }

  const keys = decoded as Readonly<Record<string, string>>;
  const materials = Object.values(keys).map((encoded) => decodeKey(encoded, keysVariable));
  for (let left = 0; left < materials.length; left += 1) {
    for (let right = left + 1; right < materials.length; right += 1) {
      const candidate = materials[left];
      const other = materials[right];
      if (candidate !== undefined && other !== undefined
        && timingSafeEqual(candidate, other)) {
        throw new ConfigurationError(`${keysVariable} contains duplicate key material.`);
      }
    }
  }
  if (keys[activeKeyId] === undefined) {
    throw new ConfigurationError(
      `${activeVariable} must identify a configured key.`,
    );
  }
  return Object.freeze({ activeKeyId, keys: Object.freeze({ ...keys }) });
}

export function loadAdministrativeUserCursorRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AdministrativeUserCursorKeyRingConfig {
  return loadCursorRuntimeConfig(source, 'ADMIN_USER_CURSOR');
}

export function loadAdministrativeLinkCursorRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AdministrativeLinkCursorKeyRingConfig {
  return loadCursorRuntimeConfig(source, 'ADMIN_LINK_CURSOR');
}

export function loadAdministrativeMunicipalityCursorRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AdministrativeMunicipalityCursorKeyRingConfig {
  return loadCursorRuntimeConfig(source, 'ADMIN_MUNICIPALITY_CURSOR');
}

export function assertAdministrativeUserCursorKeysAreIndependent(
  cursorConfig: AdministrativeUserCursorKeyRingConfig,
  outboxKeys: Readonly<Record<string, string>>,
): void {
  const cursorKeys = Object.values(cursorConfig.keys).map((value) => decodeKey(value));
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

export function assertAdministrativeCursorKeysArePairwiseIndependent(input: {
  readonly user: AdministrativeUserCursorKeyRingConfig;
  readonly link: AdministrativeLinkCursorKeyRingConfig;
  readonly municipality: AdministrativeMunicipalityCursorKeyRingConfig;
  readonly outbox: Readonly<Record<string, string>>;
}): void {
  const rings = [
    Object.values(input.user.keys),
    Object.values(input.link.keys),
    Object.values(input.municipality.keys),
    Object.values(input.outbox),
  ].map((values) => values.map((value) => Buffer.from(value, 'base64')));
  for (const ring of rings) {
    for (let left = 0; left < ring.length; left += 1) {
      for (let right = left + 1; right < ring.length; right += 1) {
        const candidate = ring[left];
        const other = ring[right];
        if (candidate !== undefined && other !== undefined
          && candidate.byteLength === other.byteLength
          && timingSafeEqual(candidate, other)) {
          throw new ConfigurationError(
            'Every configured key ID must use distinct key material.',
          );
        }
      }
    }
  }
  for (let left = 0; left < rings.length; left += 1) {
    for (let right = left + 1; right < rings.length; right += 1) {
      if (rings[left]?.some((candidate) =>
        rings[right]?.some((other) =>
          candidate.byteLength === other.byteLength
          && timingSafeEqual(candidate, other),
        ))) {
        throw new ConfigurationError(
          'Administrative cursor keys must be pairwise distinct and distinct from outbox keys.',
        );
      }
    }
  }
}
