import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  createOutboxPayloadCipherFromBase64KeyRing,
  OutboxPayloadCipher,
  OutboxPayloadCryptoError,
} from '../../src/outbox/crypto.js';

const context = {
  organizationId: 'org_tche_fertilidade',
  messageId: 'message-1',
  messageType: 'email.smtp.v1',
};

describe('versioned outbox AEAD', () => {
  it('round-trips a payload without exposing plaintext in the envelope', () => {
    const cipher = new OutboxPayloadCipher({
      activeKeyId: 'key-2026-08',
      keys: [{ id: 'key-2026-08', key: Buffer.alloc(32, 0x11) }],
      randomBytes: (size) => Buffer.alloc(size, 0x22),
    });
    const envelope = cipher.encrypt(
      { to: 'private@example.test', token: 'must-not-leak' },
      context,
    );

    assert.equal(envelope.version, 1);
    assert.equal(envelope.algorithm, 'aes-256-gcm');
    assert.doesNotMatch(JSON.stringify(envelope), /private|must-not-leak/);
    assert.deepEqual(cipher.decrypt(envelope, context), {
      to: 'private@example.test',
      token: 'must-not-leak',
    });
  });

  it('binds ciphertext to organization, message and type', () => {
    const cipher = new OutboxPayloadCipher({
      activeKeyId: 'active',
      keys: [{ id: 'active', key: Buffer.alloc(32, 0x31) }],
    });
    const envelope = cipher.encrypt({ value: 'secret' }, context);

    assert.throws(
      () =>
        cipher.decrypt(envelope, {
          ...context,
          organizationId: 'other-organization',
        }),
      (error: unknown) =>
        error instanceof OutboxPayloadCryptoError &&
        error.code === 'decryption_failed',
    );
  });

  it('decrypts old envelopes while encrypting with the active rotated key', () => {
    const oldOnly = new OutboxPayloadCipher({
      activeKeyId: 'old',
      keys: [{ id: 'old', key: Buffer.alloc(32, 0x41) }],
    });
    const oldEnvelope = oldOnly.encrypt({ value: 'old-secret' }, context);
    const rotated = new OutboxPayloadCipher({
      activeKeyId: 'new',
      keys: [
        { id: 'old', key: Buffer.alloc(32, 0x41) },
        { id: 'new', key: Buffer.alloc(32, 0x42) },
      ],
    });

    assert.deepEqual(rotated.decrypt(oldEnvelope, context), {
      value: 'old-secret',
    });
    assert.equal(rotated.encrypt({ value: 'new-secret' }, context).keyId, 'new');
  });

  it('accepts only canonical base64 32-byte environment key material', () => {
    const cipher = createOutboxPayloadCipherFromBase64KeyRing({
      activeKeyId: 'active',
      keys: { active: Buffer.alloc(32, 0x51).toString('base64') },
    });
    assert.equal(cipher.encrypt({ ok: true }, context).keyId, 'active');

    assert.throws(
      () =>
        createOutboxPayloadCipherFromBase64KeyRing({
          activeKeyId: 'active',
          keys: { active: Buffer.alloc(31).toString('base64') },
        }),
      OutboxPayloadCryptoError,
    );
  });
});
