import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  buildFragmentActionLink,
  createOpaqueActionToken,
} from '../../src/security/action-token.js';

describe('opaque action tokens', () => {
  it('uses 256 bits and exposes only a SHA-256 persistence value', () => {
    const token = createOpaqueActionToken((size) => Buffer.alloc(size, 0xab));

    assert.equal(Buffer.from(token.token, 'base64url').byteLength, 32);
    assert.equal(
      token.sha256,
      createHash('sha256').update(token.token, 'utf8').digest('hex'),
    );
    assert.doesNotMatch(token.sha256, new RegExp(token.token));
  });

  it('puts action secrets in a URL fragment, never in query parameters', () => {
    const link = buildFragmentActionLink({
      baseUrl: 'https://app.example.test/account-action?language=pt-BR',
      action: 'accept-invitation',
      token: 'raw-secret',
    });
    const url = new URL(link);

    assert.equal(url.searchParams.get('language'), 'pt-BR');
    assert.doesNotMatch(url.search, /raw-secret/);
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'raw-secret');
    assert.equal(
      new URLSearchParams(url.hash.slice(1)).get('action'),
      'accept-invitation',
    );
  });

  it('requires HTTPS except for local development', () => {
    assert.throws(
      () =>
        buildFragmentActionLink({
          baseUrl: 'http://example.test/action',
          action: 'recover',
          token: 'secret',
        }),
      TypeError,
    );
    assert.doesNotThrow(() =>
      buildFragmentActionLink({
        baseUrl: 'http://localhost:8081/action',
        action: 'recover',
        token: 'secret',
      }),
    );
    assert.doesNotThrow(() =>
      buildFragmentActionLink({
        baseUrl: 'http://127.0.0.1:8081/action',
        action: 'recover',
        token: 'secret',
      }),
    );
  });
});
