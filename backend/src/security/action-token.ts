import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';

const ACTION_TOKEN_BYTES = 32;

export interface OpaqueActionToken {
  /** The raw value is returned once and must never be logged or persisted in plaintext. */
  readonly token: string;
  /** Lowercase SHA-256 hex digest suitable for indexed persistence. */
  readonly sha256: string;
}

export type RandomBytesSource = (size: number) => Buffer;

export function hashActionToken(value: string): string {
  if (value.length === 0) {
    throw new TypeError('Action token must not be empty.');
  }

  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function createOpaqueActionToken(
  randomBytes: RandomBytesSource = nodeRandomBytes,
): OpaqueActionToken {
  const entropy = randomBytes(ACTION_TOKEN_BYTES);
  if (entropy.byteLength !== ACTION_TOKEN_BYTES) {
    throw new RangeError('Action token entropy source returned an invalid size.');
  }

  const value = entropy.toString('base64url');
  return {
    token: value,
    sha256: hashActionToken(value),
  };
}

export interface FragmentActionLinkInput {
  readonly baseUrl: string;
  readonly token: string;
  readonly action: string;
}

function isLocalLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  );
}

/**
 * Builds a user-facing link without exposing the secret to HTTP request targets.
 * Browser clients must extract the fragment and submit the token to the API by POST.
 */
export function buildFragmentActionLink(input: FragmentActionLinkInput): string {
  const url = new URL(input.baseUrl);

  if (url.protocol !== 'https:' && !isLocalLoopbackHost(url.hostname)) {
    throw new TypeError('Action links must use HTTPS outside localhost.');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new TypeError('Action-link base URL must not contain credentials.');
  }
  if (url.hash.length > 0) {
    throw new TypeError('Action-link base URL must not contain a fragment.');
  }
  if (input.token.length === 0 || input.action.length === 0) {
    throw new TypeError('Action link requires an action and token.');
  }

  url.hash = new URLSearchParams({
    action: input.action,
    token: input.token,
  }).toString();

  return url.toString();
}
