import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AdministrativeUserCursorCodec } from '../../src/administration/user-cursor.js';
import { HttpError } from '../../src/security/http-error.js';

const USER_ID = '30000000-0000-4000-8000-000000000001';

function expectBadCursor(operation: () => unknown): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof HttpError
    && error.statusCode === 400
    && error.code === 'invalid_request');
}

describe('AdministrativeUserCursorCodec', () => {
  it('mantém confidencialidade, autentica o envelope e vincula todos os filtros', () => {
    let now = new Date('2026-08-26T12:00:00.000Z');
    const codec = new AdministrativeUserCursorCodec({
      activeKeyId: 'cursor-v1',
      keys: [{ id: 'cursor-v1', key: Buffer.alloc(32, 0x35) }],
      clock: () => now,
      randomBytes: () => Buffer.alloc(12, 0x08),
      ttlMs: 60_000,
    });
    const filters = { search: 'Ágata', profile: 'produtor', status: 'ativo' };
    const cursor = { sortKey: 'ágata sigilosa', id: USER_ID };
    const encoded = codec.encode(cursor, filters);

    assert.deepEqual(codec.decode(encoded, filters), cursor);
    for (const segment of encoded.split('.')) {
      assert.equal(
        Buffer.from(segment, 'base64url').toString('utf8').includes('ágata'),
        false,
      );
    }
    assert.equal(encoded.includes('sigilosa'), false);

    const last = encoded.at(-1);
    assert.ok(last);
    expectBadCursor(() => codec.decode(`${encoded.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`, filters));
    expectBadCursor(() => codec.decode(encoded.slice(0, -8), filters));
    expectBadCursor(() => codec.decode(encoded.replace(/^v1\./u, 'v2.'), filters));
    expectBadCursor(() => codec.decode(encoded.replace('.cursor-v1.', '.unknown.'), filters));
    expectBadCursor(() => codec.decode(encoded, { ...filters, search: 'Outra' }));
    expectBadCursor(() => codec.decode(encoded, { ...filters, profile: 'admin' }));
    expectBadCursor(() => codec.decode(encoded, { ...filters, status: 'inativo' }));

    now = new Date('2026-08-26T12:01:00.001Z');
    expectBadCursor(() => codec.decode(encoded, filters));
  });

  it('conta pontos de código e preserva a chave Unicode exata do PostgreSQL', () => {
    const codec = new AdministrativeUserCursorCodec({
      activeKeyId: 'cursor-v1',
      keys: [{ id: 'cursor-v1', key: Buffer.alloc(32, 0x36) }],
      randomBytes: () => Buffer.alloc(12, 0x09),
    });
    for (const sortKey of ['ÁGATA'.normalize('NFC'), 'ÁGATA'.normalize('NFD'), '😀'.repeat(200)]) {
      const encoded = codec.encode({ sortKey, id: USER_ID }, {});
      assert.equal(codec.decode(encoded, {}).sortKey, sortKey);
    }
    assert.throws(() => codec.encode({ sortKey: '😀'.repeat(201), id: USER_ID }, {}), TypeError);
  });
});
