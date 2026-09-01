import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import swagger from '@fastify/swagger';
import fastify from 'fastify';

import { mp35cRoutesPlugin } from '../../src/administration/mp35c-routes.js';
import type { Mp35cService } from '../../src/administration/mp35c-service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';
const LINK_ID = '33333333-3333-4333-8333-333333333333';

class FakeMp35cService implements Mp35cService {
  public calls: string[] = [];
  public async listUserProperties() { this.calls.push('list-links'); return {
    userVersion: 4, nextCursor: 'next-link-cursor', items: [{ id: LINK_ID,
      propertyId: PROPERTY_ID, propertyName: 'Propriedade HTTP', propertyStatus: 'ativa' as const,
      accessOrigin: 'vinculo_direto' as const, linkType: 'colaborador' as const,
      linkStatus: 'inativo' as const, editable: true, linkVersion: 2,
      reasonCode: 'fim_relacao', reasonDetail: null,
      createdAt: new Date('2026-08-25T10:00:00.000Z'),
      updatedAt: new Date('2026-08-26T10:00:00.000Z'), sortKey: 'propriedade http',
      relationOrder: 1 }] } as const; }
  public async applyUserPropertyDelta() { this.calls.push('delta'); return { httpStatus: 200 as const,
    receipt: { outcome: 'vinculos_alterados' as const, resourceType: 'vinculo' as const,
      resourceId: USER_ID, version: 5 } }; }
  public async createProperty() { this.calls.push('create'); return { httpStatus: 201 as const,
    receipt: { outcome: 'criado' as const, resourceType: 'propriedade' as const,
      resourceId: PROPERTY_ID, version: 1 } }; }
  public async updateProperty() { this.calls.push('update'); return { httpStatus: 200 as const,
    receipt: { outcome: 'atualizado' as const, resourceType: 'propriedade' as const,
      resourceId: PROPERTY_ID, version: 2 } }; }
  public async changePropertyStatus() { this.calls.push('status'); return { httpStatus: 200 as const,
    receipt: { outcome: 'status_alterado' as const, resourceType: 'propriedade' as const,
      resourceId: PROPERTY_ID, version: 3 } }; }
  public async listStates() { this.calls.push('states'); return { versionId: 'ibge-localidades-2026-08-25',
    items: [{ id: '43', code: 'RS', name: 'Rio Grande do Sul' }] }; }
  public async listMunicipalities() { this.calls.push('municipalities'); return {
    versionId: 'ibge-localidades-2026-08-25', nextCursor: null,
    items: [{ id: '4305108', name: 'Caxias do Sul', stateId: '43', sortKey: 'caxias do sul' }] }; }
}

async function appFor(service: Mp35cService) {
  const app = fastify({ logger: false, genReqId: () => 'req-mp35c-http' });
  await app.register(swagger, { openapi: { info: { title: 'test', version: '1' },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } } } });
  await app.register(mp35cRoutesPlugin, { service }); return app;
}

describe('MP-35C HTTP routes', () => {
  it('publica as sete rotas, snake_case e no-store', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    const requests = [
      { method: 'POST', url: '/v1/propriedades', payload: { nome: 'Nova',
        titular_id: USER_ID, municipio_id: '4305108', status: 'ativa' }, expected: 201 },
      { method: 'PATCH', url: `/v1/propriedades/${PROPERTY_ID}`,
        payload: { versao: 1, nome: 'Atualizada' }, expected: 200 },
      { method: 'PATCH', url: `/v1/propriedades/${PROPERTY_ID}/status`,
        payload: { versao: 2, status: 'inativa', motivo: 'suspensao_operacional' }, expected: 200 },
      { method: 'GET', url: `/v1/usuarios/${USER_ID}/propriedades?limite=1`, expected: 200 },
      { method: 'PATCH', url: `/v1/usuarios/${USER_ID}/propriedades`,
        payload: { versao: 4, adicionar: [PROPERTY_ID], remover: [],
          motivo: 'correcao_administrativa' }, expected: 200 },
      { method: 'GET', url: '/v1/localidades/ufs', expected: 200 },
      { method: 'GET', url: '/v1/localidades/municipios?uf_id=43', expected: 200 },
    ] as const;
    for (const [index, request] of requests.entries()) {
      const response = await app.inject({ method: request.method, url: request.url,
        headers: { authorization: 'Bearer opaque',
          ...('payload' in request ? { 'idempotency-key': `http-${index}` } : {}) },
        ...('payload' in request ? { payload: request.payload } : {}) });
      assert.equal(response.statusCode, request.expected, request.url);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers.pragma, 'no-cache');
      assert.equal(response.payload.includes('organizationId'), false);
      assert.equal(response.payload.includes('resourceType'), false);
    }
    assert.deepEqual(service.calls, ['create', 'update', 'status', 'list-links',
      'delta', 'states', 'municipalities']);

    const links = await app.inject({ method: 'GET',
      url: `/v1/usuarios/${USER_ID}/propriedades?limite=1`,
      headers: { authorization: 'Bearer opaque' } });
    const link = links.json<{ itens: readonly Record<string, unknown>[] }>().itens[0];
    assert.equal(link?.origem_acesso, 'vinculo_direto');
    assert.equal(link?.tipo_vinculo, 'colaborador');
    assert.equal('tipo_acesso' in (link ?? {}), false);
    assert.equal('derivado' in (link ?? {}), false);
    const paths = app.swagger().paths ?? {};
    assert.ok(paths['/v1/propriedades']?.post);
    assert.ok(paths['/v1/propriedades/{id}']?.patch);
    assert.ok(paths['/v1/propriedades/{id}/status']?.patch);
    assert.ok(paths['/v1/usuarios/{id}/propriedades']?.get);
    assert.ok(paths['/v1/usuarios/{id}/propriedades']?.patch);
    assert.ok(paths['/v1/localidades/ufs']?.get);
    assert.ok(paths['/v1/localidades/municipios']?.get);
    const postProperty = paths['/v1/propriedades']?.post as unknown as {
      requestBody: { content: { 'application/json': { schema: {
        properties: { area_total: { anyOf: readonly { type: string; pattern?: string }[] } };
      } } } };
    };
    assert.deepEqual(postProperty.requestBody.content['application/json']
      .schema.properties.area_total.anyOf.map((entry) => entry.type), ['string', 'null']);
    assert.match(postProperty.requestBody.content['application/json']
      .schema.properties.area_total.anyOf[0]?.pattern ?? '', /^\^/u);
    await app.close();
  });

  it('rejeita campos semanticamente proibidos por rota', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    for (const input of [
      { url: `/v1/propriedades/${PROPERTY_ID}`, payload: { versao: 1, status: 'inativa' } },
      { url: `/v1/propriedades/${PROPERTY_ID}`, payload: { versao: 1, titular_id: USER_ID } },
      { url: `/v1/propriedades/${PROPERTY_ID}`, payload: { versao: 1, uf_id: '43' } },
      { url: `/v1/usuarios/${USER_ID}/propriedades`, payload: { versao: 1,
        adicionar: [PROPERTY_ID], remover: [], motivo: 'correcao_administrativa',
        tipo_vinculo: 'colaborador' } },
    ]) {
      const response = await app.inject({ method: 'PATCH', url: input.url,
        headers: { authorization: 'Bearer opaque', 'idempotency-key': randomKey(input.url) },
        payload: input.payload });
      assert.equal(response.statusCode, 422);
      assert.equal(response.json().error.code, 'validation_error');
    }
    const malformedDelta = await app.inject({ method: 'PATCH',
      url: `/v1/usuarios/${USER_ID}/propriedades`,
      headers: { authorization: 'Bearer opaque', 'idempotency-key': 'malformed-delta-object' },
      payload: { versao: 1,
        adicionar: [{ propriedade_id: PROPERTY_ID, tipo_vinculo: 'colaborador' }], remover: [],
        motivo: 'correcao_administrativa' } });
    assert.equal(malformedDelta.statusCode, 400);
    assert.equal(malformedDelta.json().error.code, 'invalid_request');
    assert.deepEqual(service.calls, []); await app.close();
  });

  it('separa estrutura inválida de limites semânticos do delta', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    const duplicated = await app.inject({ method: 'PATCH',
      url: `/v1/usuarios/${USER_ID}/propriedades`,
      headers: { authorization: 'Bearer opaque', 'idempotency-key': 'duplicate-delta' },
      payload: { versao: 1, adicionar: [PROPERTY_ID, PROPERTY_ID], remover: [],
        motivo: 'correcao_administrativa' } });
    assert.equal(duplicated.statusCode, 422);
    assert.equal(duplicated.json().error.code, 'validation_error');
    assert.equal(duplicated.headers['cache-control'], 'no-store');
    assert.deepEqual(service.calls, []); await app.close();
  });

  it('classifica parsing, estrutura, anyOf e valores semânticos pela allowlist HTTP', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    const headers = { authorization: 'Bearer opaque', 'content-type': 'application/json',
      'idempotency-key': 'mp35c-http-validation' };
    const structural = [
      { payload: '', raw: true },
      { payload: '{"versao":1,', raw: true },
      { payload: { versao: '1', nome: 'Nova' } },
      { payload: { versao: 1, desconhecido: true } },
      { payload: { versao: 1, area_total: { valor: 1 } } },
      { payload: { versao: 1, area_total: 1 } },
      { payload: { versao: 1, area_total: true } },
      { payload: { versao: 1, area_total: [] } },
    ] as const;
    for (const [index, current] of structural.entries()) {
      const response = await app.inject({ method: 'PATCH',
        url: `/v1/propriedades/${PROPERTY_ID}`,
        headers: { ...headers, 'idempotency-key': `mp35c-structure-${index}` },
        payload: current.payload });
      assert.equal(response.statusCode, 400, `estrutura ${index}`);
      assert.equal(response.json().error.code, 'invalid_request');
    }
    const semantic = [
      { versao: 1, area_total: '-1' },
      { versao: 1, cultura_principal: '' },
      { versao: 0, nome: 'Nova' },
      { versao: 1, nome: '' },
      { versao: 1, status: 'inativa' },
    ] as const;
    for (const [index, payload] of semantic.entries()) {
      const response = await app.inject({ method: 'PATCH',
        url: `/v1/propriedades/${PROPERTY_ID}`,
        headers: { ...headers, 'idempotency-key': `mp35c-semantic-${index}` }, payload });
      assert.equal(response.statusCode, 422, `semântica ${index}`);
      assert.equal(response.json().error.code, 'validation_error');
    }
    const blank = await app.inject({ method: 'POST', url: '/v1/propriedades', headers,
      payload: { nome: '   ', titular_id: USER_ID, municipio_id: '4305108', status: 'ativa' } });
    assert.equal(blank.statusCode, 422);
    assert.equal(blank.json().error.code, 'validation_error');
    assert.deepEqual(service.calls, []); await app.close();
  });

  it('classifica titular_id e status conforme a rota e preserva precedência estrutural', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    const headers = { authorization: 'Bearer opaque', 'content-type': 'application/json',
      'idempotency-key': 'mp35c-route-specific-validation' };
    const validCreate = await app.inject({ method: 'POST', url: '/v1/propriedades', headers,
      payload: { nome: 'Titular válido', titular_id: USER_ID,
        municipio_id: '4305108', status: 'inativa' } });
    assert.equal(validCreate.statusCode, 201);
    const invalidCreateHolder = await app.inject({ method: 'POST', url: '/v1/propriedades',
      headers: { ...headers, 'idempotency-key': 'invalid-create-holder-type' },
      payload: { nome: 'Titular inválido', titular_id: 123,
        municipio_id: '4305108', status: 'inativa' } });
    assert.equal(invalidCreateHolder.statusCode, 400);
    assert.equal(invalidCreateHolder.json().error.code, 'invalid_request');

    const forbiddenHolder = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}`, headers,
      payload: { versao: 1, titular_id: USER_ID } });
    assert.equal(forbiddenHolder.statusCode, 422);
    assert.equal(forbiddenHolder.json().error.code, 'validation_error');
    const holderWithStructuralError = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}`,
      headers: { ...headers, 'idempotency-key': 'holder-plus-structural-error' },
      payload: { versao: 1, titular_id: USER_ID, nome: 123 } });
    assert.equal(holderWithStructuralError.statusCode, 400);
    assert.equal(holderWithStructuralError.json().error.code, 'invalid_request');
    const precedenceCases = [
      { key: 'holder-without-version', payload: { titular_id: USER_ID } },
      { key: 'status-without-version', payload: { status: 'inativa' } },
      { key: 'holder-invalid-peer-type', payload: { versao: 1,
        titular_id: USER_ID, municipio_id: 123 } },
      { key: 'status-invalid-peer-type', payload: { versao: 1,
        status: 'inativa', nome: 123 } },
      { key: 'holder-invalid-type', payload: { versao: 1, titular_id: 123 } },
    ] as const;
    const precedenceResponses = [];
    for (const current of precedenceCases) {
      const response = await app.inject({ method: 'PATCH',
        url: `/v1/propriedades/${PROPERTY_ID}`,
        headers: { ...headers, 'idempotency-key': current.key }, payload: current.payload });
      assert.equal(response.statusCode, 400, current.key);
      assert.equal(response.json().error.code, 'invalid_request');
      precedenceResponses.push(response);
    }
    const forbiddenDerived = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}`,
      headers: { ...headers, 'idempotency-key': 'forbidden-derived-complete' },
      payload: { versao: 1, uf_id: '43' } });
    assert.equal(forbiddenDerived.statusCode, 422);
    assert.equal(forbiddenDerived.json().error.code, 'validation_error');

    const validStatus = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}/status`, headers,
      payload: { versao: 1, status: 'inativa', motivo: 'suspensao_operacional' } });
    assert.equal(validStatus.statusCode, 200);
    const invalidStatusType = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}/status`,
      headers: { ...headers, 'idempotency-key': 'invalid-status-type' },
      payload: { versao: 1, status: 123, motivo: 'suspensao_operacional' } });
    assert.equal(invalidStatusType.statusCode, 400);
    assert.equal(invalidStatusType.json().error.code, 'invalid_request');
    const forbiddenStatus = await app.inject({ method: 'PATCH',
      url: `/v1/propriedades/${PROPERTY_ID}`,
      headers: { ...headers, 'idempotency-key': 'forbidden-status-on-common-patch' },
      payload: { versao: 1, status: 'inativa' } });
    assert.equal(forbiddenStatus.statusCode, 422);
    assert.equal(forbiddenStatus.json().error.code, 'validation_error');

    const malformed = await app.inject({ method: 'POST', url: '/v1/propriedades', headers,
      payload: '{"nome":' });
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, 'invalid_request');
    const unknown = await app.inject({ method: 'POST', url: '/v1/propriedades', headers,
      payload: { nome: 'Campo desconhecido', titular_id: USER_ID,
        municipio_id: '4305108', status: 'inativa', desconhecido: true } });
    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().error.code, 'invalid_request');
    const semantic = await app.inject({ method: 'POST', url: '/v1/propriedades', headers,
      payload: { nome: '', titular_id: USER_ID, municipio_id: '4305108', status: 'inativa' } });
    assert.equal(semantic.statusCode, 422);
    assert.equal(semantic.json().error.code, 'validation_error');
    for (const response of [validCreate, invalidCreateHolder, forbiddenHolder,
      holderWithStructuralError, validStatus, invalidStatusType, forbiddenStatus,
      forbiddenDerived, malformed, unknown, semantic, ...precedenceResponses]) {
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.match(String(response.headers['content-type']), /^application\/json/u);
      assert.equal(response.json().error?.request_id === undefined && response.statusCode >= 400,
        false, `envelope ${response.statusCode}`);
      assert.equal(/sql|postgres|stack|function|table/iu.test(response.payload), false);
    }
    assert.deepEqual(service.calls, ['create', 'status']); await app.close();
  });

  it('aplica UUID v4 e decimal textual exato antes do serviço', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    const headers = { authorization: 'Bearer opaque', 'content-type': 'application/json',
      'idempotency-key': 'canonical-domain' };
    for (const [label, titularId, expected] of [
      ['uuid-v4', USER_ID, 201],
      ['uuid-version-zero', '11111111-1111-0111-8111-111111111111', 422],
      ['uuid-invalid-variant', '11111111-1111-4111-7111-111111111111', 422],
      ['uuid-malformed', 'not-a-uuid', 400],
    ] as const) {
      const response = await app.inject({ method: 'POST', url: '/v1/propriedades',
        headers: { ...headers, 'idempotency-key': label }, payload: {
          nome: 'Política UUID', titular_id: titularId,
          municipio_id: '4305108', status: 'inativa',
        } });
      assert.equal(response.statusCode, expected, label);
      if (expected >= 400) assert.equal(response.json().error.code,
        expected === 400 ? 'invalid_request' : 'validation_error');
    }

    const areas = [
      ['minimum', '{"versao":1,"area_total":"0.0001"}', 200],
      ['integer', '{"versao":1,"area_total":"1"}', 200],
      ['trailing-zero', '{"versao":1,"area_total":"1.0"}', 200],
      ['four-decimals', '{"versao":1,"area_total":"1.2345"}', 200],
      ['maximum', '{"versao":1,"area_total":"9999999999.9999"}', 200],
      ['number', '{"versao":1,"area_total":1}', 400],
      ['boolean', '{"versao":1,"area_total":true}', 400],
      ['array', '{"versao":1,"area_total":[]}', 400],
      ['object', '{"versao":1,"area_total":{}}', 400],
      ['zero', '{"versao":1,"area_total":"0"}', 422],
      ['negative', '{"versao":1,"area_total":"-1"}', 422],
      ['five-decimals', '{"versao":1,"area_total":"0.00001"}', 422],
      ['rounded-by-number-before', '{"versao":1,"area_total":"1.00000000000000001"}', 422],
      ['maximum-five-decimals', '{"versao":1,"area_total":"9999999999.99999"}', 422],
      ['above-maximum', '{"versao":1,"area_total":"10000000000"}', 422],
      ['leading-zero', '{"versao":1,"area_total":"01.25"}', 422],
      ['whitespace', '{"versao":1,"area_total":" 1.25 "}', 422],
      ['leading-space', '{"versao":1,"area_total":" 1"}', 422],
      ['trailing-space', '{"versao":1,"area_total":"1 "}', 422],
      ['escaped-tab', '{"versao":1,"area_total":"1\\t"}', 422],
      ['escaped-lf-zero', '{"versao":1,"area_total":"0\\n"}', 422],
      ['escaped-lf', '{"versao":1,"area_total":"1\\n"}', 422],
      ['escaped-lf-decimal', '{"versao":1,"area_total":"1.0\\n"}', 422],
      ['escaped-cr', '{"versao":1,"area_total":"1\\r"}', 422],
      ['escaped-crlf', '{"versao":1,"area_total":"1\\r\\n"}', 422],
      ['u2028', JSON.stringify({ versao: 1, area_total: '1\u2028' }), 422],
      ['u2029', JSON.stringify({ versao: 1, area_total: '1\u2029' }), 422],
      ['raw-lf-malformed', '{"versao":1,"area_total":"1\n"}', 400],
      ['nan', '{"versao":1,"area_total":"NaN"}', 422],
      ['infinity', '{"versao":1,"area_total":"Infinity"}', 422],
      ['exponent', '{"versao":1,"area_total":"1e-4"}', 422],
      ['clear', '{"versao":1,"area_total":null}', 200],
    ] as const;
    for (const [label, payload, expected] of areas) {
      const callsBefore = service.calls.length;
      const response = await app.inject({ method: 'PATCH',
        url: `/v1/propriedades/${PROPERTY_ID}`,
        headers: { ...headers, 'idempotency-key': `area-${label}` }, payload });
      assert.equal(response.statusCode, expected, label);
      assert.equal(response.headers['cache-control'], 'no-store', label);
      assert.match(response.headers['content-type'] ?? '', /^application\/json/u, label);
      if (expected >= 400) {
        assert.equal(service.calls.length, callsBefore, `${label}: serviço não chamado`);
        const body = response.json<{ error: { code: string }; stack?: unknown }>();
        assert.equal(body.error.code, expected === 400 ? 'invalid_request' : 'validation_error');
        assert.equal('stack' in body, false);
      }
    }
    const createNull = await app.inject({ method: 'POST', url: '/v1/propriedades',
      headers: { ...headers, 'idempotency-key': 'create-area-null' }, payload: {
        nome: 'Área nula', titular_id: USER_ID, municipio_id: '4305108',
        status: 'inativa', area_total: null,
      } });
    assert.equal(createNull.statusCode, 422);
    assert.equal(createNull.json().error.code, 'validation_error');
    await app.close();
  });

  it('classifica cursor vazio e acima do máximo como 400, preservando filtro inválido em 422', async () => {
    const service = new FakeMp35cService(); const app = await appFor(service);
    for (const cursor of ['', 'a'.repeat(2049)]) {
      const response = await app.inject({ method: 'GET',
        url: `/v1/localidades/municipios?uf_id=43&cursor=${cursor}`,
        headers: { authorization: 'Bearer opaque' } });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, 'invalid_request');
    }
    for (const query of ['uf_id=XX', 'uf_id=43&limite=0', 'uf_id=43&busca=']) {
      const response = await app.inject({ method: 'GET',
        url: `/v1/localidades/municipios?${query}`,
        headers: { authorization: 'Bearer opaque' } });
      assert.equal(response.statusCode, 422, query);
      assert.equal(response.json().error.code, 'validation_error');
    }
    assert.deepEqual(service.calls, []); await app.close();
  });
});

function randomKey(value: string): string {
  return `key-${Buffer.from(value).toString('base64url')}`.slice(0, 100);
}
