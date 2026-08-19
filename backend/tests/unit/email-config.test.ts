import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ConfigurationError } from '../../src/config.js';
import { loadEmailRuntimeConfig } from '../../src/email/config.js';

const KEY = Buffer.alloc(32, 0x42).toString('base64');

describe('email and outbox runtime configuration', () => {
  it('uses local-only defaults outside production', () => {
    const config = loadEmailRuntimeConfig('test', {});

    assert.equal(config.actionBaseUrl, 'http://127.0.0.1:8081/auth-action');
    assert.equal(config.smtp.host, '127.0.0.1');
    assert.equal(config.smtp.requireTls, false);
    assert.equal(config.outboxKeyRing.activeKeyId, 'local-v1');
  });

  it('requires HTTPS, verified SMTP TLS and an external keyring in production', () => {
    const base = {
      AUTH_ACTION_BASE_URL: 'https://app.example.test/auth-action',
      OUTBOX_ACTIVE_KEY_ID: 'prod-v1',
      OUTBOX_ENCRYPTION_KEYS: JSON.stringify({ 'prod-v1': KEY }),
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '587',
      SMTP_FROM: 'Tchê Agro <no-reply@example.test>',
      SMTP_REQUIRE_TLS: 'true',
    };

    assert.doesNotThrow(() => loadEmailRuntimeConfig('production', base));
    assert.throws(
      () =>
        loadEmailRuntimeConfig('production', {
          ...base,
          AUTH_ACTION_BASE_URL: 'http://app.example.test/auth-action',
        }),
      ConfigurationError,
    );
    assert.throws(
      () =>
        loadEmailRuntimeConfig('production', {
          ...base,
          SMTP_REQUIRE_TLS: 'false',
        }),
      ConfigurationError,
    );
    assert.throws(
      () =>
        loadEmailRuntimeConfig('production', {
          ...base,
          OUTBOX_ENCRYPTION_KEYS: JSON.stringify({ 'prod-v1': 'not-a-key' }),
        }),
      ConfigurationError,
    );
  });

  it('rejects partial SMTP credentials and URL fragments', () => {
    assert.throws(
      () => loadEmailRuntimeConfig('test', { SMTP_USERNAME: 'user' }),
      ConfigurationError,
    );
    assert.throws(
      () =>
        loadEmailRuntimeConfig('test', {
          AUTH_ACTION_BASE_URL:
            'http://127.0.0.1:8081/auth-action#token=secret',
        }),
      ConfigurationError,
    );
  });
});
