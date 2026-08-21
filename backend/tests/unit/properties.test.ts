import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { PoolClient, QueryConfig, QueryResult } from 'pg';

import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import type { AuthenticationService } from '../../src/auth/service.js';
import type {
  ListPropertiesInput,
  PropertyRepository,
  PropertyView,
} from '../../src/properties/contracts.js';
import {
  decodePropertyCursor,
  encodePropertyCursor,
} from '../../src/properties/cursor.js';
import { PostgresPropertyRepository } from '../../src/properties/postgres-property-repository.js';
import { DefaultPropertyService } from '../../src/properties/service.js';
import { HttpError } from '../../src/security/http-error.js';

const principal: AuthenticatedPrincipal = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: 'org_tche_fertilidade',
  name: 'Usuário Teste',
  email: 'usuario@example.test',
  profile: 'colaborador',
  status: 'ativo',
  authorizationVersion: 7,
  sessionId: '22222222-2222-4222-8222-222222222222',
};

function property(index: number): PropertyView {
  const suffix = String(index).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    organizationId: principal.organizationId,
    holderId: '33333333-3333-4333-8333-333333333333',
    holder: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Titular',
    },
    name: `Propriedade ${String(index).padStart(3, '0')}`,
    municipalityId: '4306106',
    municipalityName: 'Cruz Alta',
    stateId: '43',
    stateCode: 'RS',
    totalArea: 10.5,
    mainCrop: 'Soja',
    status: 'ativa',
    accessType: 'colaborador',
  };
}

class FakePropertyRepository implements PropertyRepository {
  public listInput: ListPropertiesInput | undefined;
  public rows: readonly PropertyView[] = [];
  public detail: PropertyView | null = null;

  public async list(input: ListPropertiesInput) {
    this.listInput = input;
    return this.rows;
  }

  public async findById() {
    return this.detail;
  }
}

function serviceFixture() {
  const repository = new FakePropertyRepository();
  const authentication = {
    async authenticate() {
      return principal;
    },
  } as unknown as AuthenticationService;
  return {
    repository,
    service: new DefaultPropertyService({ authentication, repository }),
  };
}

describe('Property service and cursor', () => {
  it('uses limit + 1 and emits a stable opaque name/id cursor', async () => {
    const fixture = serviceFixture();
    fixture.repository.rows = Array.from({ length: 51 }, (_, index) =>
      property(index + 1),
    );

    const page = await fixture.service.list({
      accessToken: 'opaque-access-token',
      query: {},
    });

    assert.equal(fixture.repository.listInput?.limit, 51);
    assert.equal(page.items.length, 50);
    assert.ok(page.nextCursor);
    assert.deepEqual(decodePropertyCursor(page.nextCursor), {
      name: property(50).name,
      id: property(50).id,
    });
  });

  it('normalizes allowlisted filters and forwards an incoming cursor', async () => {
    const fixture = serviceFixture();
    const cursor = encodePropertyCursor({
      name: 'Propriedade 010',
      id: property(10).id,
    });

    await fixture.service.list({
      accessToken: 'opaque-access-token',
      query: {
        busca: '  100%_Real\\  ',
        uf: ' rs ',
        municipio: ' Cruz Alta ',
        status: 'ativa',
        limite: 10,
        cursor,
      },
    });

    assert.deepEqual(fixture.repository.listInput, {
      principal,
      limit: 11,
      cursor: { name: 'Propriedade 010', id: property(10).id },
      search: '100%_Real\\',
      state: 'rs',
      municipality: 'Cruz Alta',
      status: 'ativa',
    });
  });

  it('rejects non-canonical and structurally invalid cursors fail-closed', () => {
    const nonCanonical = Buffer.from(
      JSON.stringify({ id: property(1).id, nome: property(1).name, v: 1 }),
      'utf8',
    ).toString('base64url');

    for (const cursor of [nonCanonical, 'not+base64url', 'e30']) {
      assert.throws(
        () => decodePropertyCursor(cursor),
        (error: unknown) =>
          error instanceof HttpError && error.code === 'invalid_request',
      );
    }

    const oversizedDecodedName = Buffer.from(
      JSON.stringify({
        v: 1,
        nome: 'a'.repeat(16_385),
        id: property(1).id,
      }),
      'utf8',
    ).toString('base64url');
    assert.throws(
      () => decodePropertyCursor(oversizedDecodedName),
      (error: unknown) =>
        error instanceof HttpError && error.code === 'invalid_request',
    );
  });

  it('maps a missing or out-of-scope detail to the same 404', async () => {
    const fixture = serviceFixture();
    await assert.rejects(
      fixture.service.detail({
        accessToken: 'opaque-access-token',
        propertyId: property(1).id,
      }),
      (error: unknown) =>
        error instanceof HttpError && error.code === 'not_found',
    );
  });
});

describe('PostgresPropertyRepository query contract', () => {
  it('escapes %, _ and backslash as literals before ILIKE', async () => {
    const queries: QueryConfig[] = [];
    const client = {
      async query(config: QueryConfig): Promise<QueryResult> {
        queries.push(config);
        return {
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
          rows: [],
        };
      },
      release() {},
    } as unknown as PoolClient;
    const repository = new PostgresPropertyRepository({
      async connect() {
        return client;
      },
    });

    await repository.list({
      principal,
      limit: 2,
      search: '%_/\\',
    });

    assert.equal(queries.length, 1);
    assert.equal(queries[0]?.values?.[7], '%\\%\\_/\\\\%');
    assert.match(queries[0]?.text ?? '', /ILIKE \$8 ESCAPE E'\\\\'/u);
    assert.match(queries[0]?.text ?? '', /usuario\.versao_autorizacao = \$4/u);
    assert.match(queries[0]?.text ?? '', /LIMIT \$11/u);
  });
});
