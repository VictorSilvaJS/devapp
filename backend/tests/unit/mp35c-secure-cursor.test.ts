import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { SecureAdministrativeCursorCodec } from '../../src/administration/secure-cursor.js';
import { HttpError } from '../../src/security/http-error.js';

function codec(namespace: 'administrative-links' | 'administrative-municipalities') {
  return new SecureAdministrativeCursorCodec({ namespace,
    config: { activeKeyId: 'test-v1', keys: {
      'test-v1': Buffer.alloc(32, namespace === 'administrative-links' ? 0x51 : 0x52).toString('base64'),
    } }, clock: () => new Date('2026-08-28T12:00:00.000Z'),
    randomBytes: () => Buffer.alloc(12, 0x21) });
}

function mustBeBadRequest(operation: () => unknown): void {
  assert.throws(operation, (error: unknown) => error instanceof HttpError
    && error.statusCode === 400 && error.code === 'invalid_request');
}

describe('MP-35C secure cursors', () => {
  it('vínculo é confidencial, autenticado e ligado ao usuario_id e filtros', () => {
    const target = codec('administrative-links');
    const payload = { sort_key: 'propriedade secreta',
      property_id: '11111111-1111-4111-8111-111111111111', relation_order: 1,
      relation_id: '22222222-2222-4222-8222-222222222222' };
    const binding = { user_id: '33333333-3333-4333-8333-333333333333',
      search: 'soja', access_type: 'colaborador', link_status: 'ativo' };
    const encoded = target.encode(payload, binding);
    assert.deepEqual(target.decode(encoded, binding), payload);
    assert.equal(encoded.includes('propriedade'), false);
    assert.equal(encoded.includes(binding.user_id), false);
    mustBeBadRequest(() => target.decode(encoded, { ...binding,
      user_id: '44444444-4444-4444-8444-444444444444' }));
    mustBeBadRequest(() => target.decode(encoded, { ...binding, search: 'milho' }));
    mustBeBadRequest(() => target.decode(`${encoded.slice(0, -1)}A`, binding));
  });

  it('Município autentica versão imutável, uf_id e busca com chave exclusiva', () => {
    const municipalities = codec('administrative-municipalities');
    const links = codec('administrative-links');
    const payload = { version_id: 'ibge-localidades-2026-08-25',
      sort_key: 'caxias do sul', id: '4305108' };
    const binding = { uf_id: '43', search: null };
    const encoded = municipalities.encode(payload, binding);
    assert.deepEqual(municipalities.decode(encoded, binding), payload);
    mustBeBadRequest(() => municipalities.decode(encoded, { uf_id: '42', search: null }));
    mustBeBadRequest(() => municipalities.decode(encoded, { uf_id: '43', search: 'caxias' }));
    mustBeBadRequest(() => links.decode(encoded, binding));
  });

  it('rejeita cursor truncado, expirado e com versão de envelope incompatível', () => {
    let now = new Date('2026-08-28T12:00:00.000Z');
    const target = new SecureAdministrativeCursorCodec({
      namespace: 'administrative-links',
      config: { activeKeyId: 'test-v1', keys: {
        'test-v1': Buffer.alloc(32, 0x53).toString('base64'),
      } }, clock: () => now, randomBytes: () => Buffer.alloc(12, 0x22), ttlMs: 1_000,
    });
    const binding = { user_id: '33333333-3333-4333-8333-333333333333',
      search: null, access_type: null, link_status: null };
    const encoded = target.encode({ sort_key: 'propriedade',
      property_id: '11111111-1111-4111-8111-111111111111', relation_order: 1,
      relation_id: '22222222-2222-4222-8222-222222222222' }, binding);
    mustBeBadRequest(() => target.decode(encoded.slice(0, -10), binding));
    mustBeBadRequest(() => target.decode(`v2.${encoded.split('.').slice(1).join('.')}`, binding));
    now = new Date('2026-08-28T12:00:01.001Z');
    mustBeBadRequest(() => target.decode(encoded, binding));
  });
});
