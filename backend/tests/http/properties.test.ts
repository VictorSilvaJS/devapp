import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import fastify from 'fastify';

import type { PropertyView } from '../../src/properties/contracts.js';
import { propertyRoutesPlugin } from '../../src/properties/routes.js';
import type {
  PropertyListQuery,
  PropertyService,
} from '../../src/properties/service.js';
import { notFound, serviceUnavailable } from '../../src/security/http-error.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';

const sampleProperty: PropertyView = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: 'org_tche_fertilidade',
  holderId: '22222222-2222-4222-8222-222222222222',
  holder: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Produtor Titular',
  },
  name: 'Propriedade HTTP',
  municipalityId: '4306106',
  municipalityName: 'Cruz Alta',
  stateId: '43',
  stateCode: 'RS',
  totalArea: 125.5,
  mainCrop: 'Soja',
  status: 'ativa',
  accessType: 'titular',
};

class FakePropertyService implements PropertyService {
  public listInput:
    | Readonly<{ accessToken: string; query: PropertyListQuery }>
    | undefined;
  public detailError: Error | undefined;
  public listError: Error | undefined;

  public async list(input: {
    readonly accessToken: string;
    readonly query: PropertyListQuery;
  }) {
    this.listInput = input;
    if (this.listError !== undefined) throw this.listError;
    return { items: [sampleProperty], nextCursor: 'cursor-seguinte' };
  }

  public async detail() {
    if (this.detailError !== undefined) throw this.detailError;
    return sampleProperty;
  }
}

async function buildTestApp(service: PropertyService) {
  const app = fastify({ logger: false, genReqId: () => 'req-property-test' });
  await app.register(propertyRoutesPlugin, {
    prefix: '/v1/propriedades',
    service,
  });
  return app;
}

describe('property HTTP plugin', () => {
  it('serves the exact no-slash collection path with snake_case and no-store', async () => {
    const service = new FakePropertyService();
    const app = await buildTestApp(service);
    const accessToken = issueOpaqueToken().value;
    const response = await app.inject({
      method: 'GET',
      url: '/v1/propriedades?limite=10&uf=RS&municipio=Cruz%20Alta',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers.pragma, 'no-cache');
    assert.deepEqual(
      service.listInput === undefined
        ? undefined
        : { ...service.listInput, query: { ...service.listInput.query } },
      {
      accessToken,
      query: { limite: 10, uf: 'RS', municipio: 'Cruz Alta' },
      },
    );
    assert.deepEqual(response.json(), {
      itens: [
        {
          id: sampleProperty.id,
          organizacao_id: sampleProperty.organizationId,
          titular_id: sampleProperty.holderId,
          titular: {
            id: sampleProperty.holder.id,
            nome: sampleProperty.holder.name,
          },
          nome: sampleProperty.name,
          municipio_id: sampleProperty.municipalityId,
          municipio_nome: sampleProperty.municipalityName,
          uf_id: sampleProperty.stateId,
          uf_sigla: sampleProperty.stateCode,
          area_total: sampleProperty.totalArea,
          cultura_principal: sampleProperty.mainCrop,
          status: sampleProperty.status,
          tipo_acesso: sampleProperty.accessType,
        },
      ],
      paginacao: { proximo_cursor: 'cursor-seguinte' },
    });
    await app.close();
  });

  it('rejects missing authentication, unknown filters and malformed IDs', async () => {
    const app = await buildTestApp(new FakePropertyService());

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/v1/propriedades',
    });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.headers['www-authenticate'], 'Bearer');
    assert.equal(unauthenticated.headers['cache-control'], 'no-store');

    const unknownFilter = await app.inject({
      method: 'GET',
      url: '/v1/propriedades?regiao=norte',
      headers: { authorization: `Bearer ${issueOpaqueToken().value}` },
    });
    assert.equal(unknownFilter.statusCode, 400);

    const invalidId = await app.inject({
      method: 'GET',
      url: '/v1/propriedades/not-a-uuid',
      headers: { authorization: `Bearer ${issueOpaqueToken().value}` },
    });
    assert.equal(invalidId.statusCode, 400);
    await app.close();
  });

  it('keeps nonexistent and out-of-scope details indistinguishable', async () => {
    const service = new FakePropertyService();
    service.detailError = notFound();
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'GET',
      url: `/v1/propriedades/${sampleProperty.id}`,
      headers: { authorization: `Bearer ${issueOpaqueToken().value}` },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        code: 'not_found',
        message: 'Recurso não encontrado.',
        request_id: 'req-property-test',
        details: [],
      },
    });
    await app.close();
  });

  it('maps database unavailability to a detail-free 503', async () => {
    const service = new FakePropertyService();
    service.listError = serviceUnavailable();
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/propriedades',
      headers: { authorization: `Bearer ${issueOpaqueToken().value}` },
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'service_unavailable');
    assert.equal(response.body.toLowerCase().includes('postgres'), false);
    await app.close();
  });
});
