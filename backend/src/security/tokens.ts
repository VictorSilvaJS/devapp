import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export interface IssuedOpaqueToken {
  readonly value: string;
  readonly hash: string;
}

export function hashOpaqueToken(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

export function issueOpaqueToken(): IssuedOpaqueToken {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return Object.freeze({ value, hash: hashOpaqueToken(value) });
}

export function isWellFormedOpaqueToken(value: string): boolean {
  if (!OPAQUE_TOKEN_PATTERN.test(value)) {
    return false;
  }

  try {
    return Buffer.from(value, 'base64url').length === TOKEN_BYTES;
  } catch {
    return false;
  }
}

export function hmacIdentifier(value: string, key: Uint8Array): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('base64url');
}

export function hashesEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

