const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function randomSegment(random: () => number): string {
  const value = Math.floor(random() * 0x1_0000_0000);
  return value.toString(36).padStart(7, '0');
}

/**
 * Generates a process-local opaque command key. It is not a credential and
 * contains no identity or notification data.
 */
export function createNotificationIdempotencyKey(
  now: () => number = Date.now,
  random: () => number = Math.random,
): string {
  const key = [
    'notif',
    Math.max(0, Math.floor(now())).toString(36),
    randomSegment(random),
    randomSegment(random),
    randomSegment(random),
    randomSegment(random),
  ].join('_');
  if (!KEY_PATTERN.test(key)) {
    throw new Error('Não foi possível criar a chave idempotente local.');
  }
  return key;
}

export function isNotificationIdempotencyKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}
