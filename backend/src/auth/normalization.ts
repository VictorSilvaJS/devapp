export class InvalidEmailError extends Error {
  public constructor() {
    super('Endereço de e-mail inválido.');
    this.name = 'InvalidEmailError';
  }
}

/** Product login identifiers are case-insensitive and stored in NFC. */
export function normalizeEmail(value: string): string {
  const normalized = value.normalize('NFC').trim().toLowerCase();
  const atIndex = normalized.indexOf('@');

  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    atIndex <= 0 ||
    atIndex !== normalized.lastIndexOf('@') ||
    atIndex >= normalized.length - 1 ||
    /\s/u.test(normalized)
  ) {
    throw new InvalidEmailError();
  }

  return normalized;
}

/** Passwords are never trimmed or case-folded for hashing or verification. */
export function normalizePassword(value: string): string {
  return value.normalize('NFC');
}

/**
 * Versioned, locale-independent simple lowercase used only for whole-password
 * blocklist lookup. It deliberately preserves spaces and never changes the
 * password that reaches Argon2id.
 */
export function foldPasswordForBlocklist(value: string): string {
  return normalizePassword(value)
    .toLowerCase()
    .normalize('NFC');
}

export function countUnicodeCodePoints(value: string): number {
  return Array.from(value).length;
}
