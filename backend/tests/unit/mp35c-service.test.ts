import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import type { AuthenticationService } from '../../src/auth/service.js';
import type {
  Mp35cMutationResult,
  Mp35cRepository,
} from '../../src/administration/mp35c-contracts.js';
import { DefaultMp35cService } from '../../src/administration/mp35c-service.js';
import { SecureAdministrativeCursorCodec } from '../../src/administration/secure-cursor.js';
import { HttpError } from '../../src/security/http-error.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';

const USER = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const ADMIN_TOKEN = issueOpaqueToken().value;
const COLLABORATOR_TOKEN = issueOpaqueToken().value;

function principal(profile: AuthenticatedPrincipal['profile']): AuthenticatedPrincipal {
  return { id: USER, organizationId: 'org_tche_fertilidade', name: profile,
    email: `${profile}@example.test`, profile, status: 'ativo',
    authorizationVersion: 1, sessionId: SESSION };
}

class FakeRepository implements Mp35cRepository {
  public deltaInput: Parameters<Mp35cRepository['applyUserPropertyDelta']>[0] | undefined;
  public createInput: Parameters<Mp35cRepository['createProperty']>[0] | undefined;
  public updateInput: Parameters<Mp35cRepository['updateProperty']>[0] | undefined;
  public municipalityInputs: Parameters<Mp35cRepository['listMunicipalities']>[0][] = [];
  public mutationStatus: 'completed' | 'business_rule_conflict' = 'completed';
  public municipalitySortKey = 'caxias do sul';
  public relationSortKey = 'propriedade';
  result(outcome: 'criado' | 'atualizado' | 'status_alterado' | 'vinculos_alterados',
    resourceType: 'propriedade' | 'vinculo', httpStatus: 200 | 201): Mp35cMutationResult {
    return (this.mutationStatus === 'business_rule_conflict' ? { status: 'business_rule_conflict' as const }
      : { status: 'completed' as const, httpStatus,
        receipt: { outcome, resourceType, resourceId: PROPERTY, version: 2 } as const }) as Mp35cMutationResult;
  }
  public async listUserProperties() { return { userVersion: 1, items: [
    { id: '44444444-4444-4444-8444-444444444444', propertyId: PROPERTY,
      propertyName: 'Propriedade', propertyStatus: 'ativa' as const,
      accessOrigin: 'vinculo_direto' as const, linkType: 'colaborador' as const,
      linkStatus: 'ativo' as const, editable: true, linkVersion: 1,
      reasonCode: null, reasonDetail: null, createdAt: new Date(), updatedAt: new Date(),
      sortKey: this.relationSortKey, relationOrder: 1 },
    { id: '55555555-5555-4555-8555-555555555555',
      propertyId: '66666666-6666-4666-8666-666666666666',
      propertyName: 'Segunda', propertyStatus: 'ativa' as const,
      accessOrigin: 'vinculo_direto' as const, linkType: 'colaborador' as const,
      linkStatus: 'ativo' as const, editable: true, linkVersion: 1,
      reasonCode: null, reasonDetail: null, createdAt: new Date(), updatedAt: new Date(),
      sortKey: 'segunda', relationOrder: 1 },
  ] }; }
  public async listStates() { return { versionId: 'ibge-localidades-2026-08-25', items: [] }; }
  public async listMunicipalities(input: Parameters<Mp35cRepository['listMunicipalities']>[0]) {
    this.municipalityInputs.push(input); return { versionId: input.versionId ?? 'ibge-localidades-2026-08-25',
      items: [{ id: '4305108', name: 'Caxias do Sul', stateId: '43', sortKey: this.municipalitySortKey },
        { id: '4305207', name: 'Cerro Largo', stateId: '43', sortKey: 'cerro largo' }] };
  }
  public async createProperty(input: Parameters<Mp35cRepository['createProperty']>[0]) {
    this.createInput = input; return this.result('criado', 'propriedade', 201);
  }
  public async updateProperty(input: Parameters<Mp35cRepository['updateProperty']>[0]) {
    this.updateInput = input; return this.result('atualizado', 'propriedade', 200);
  }
  public async changePropertyStatus() { return this.result('status_alterado', 'propriedade', 200); }
  public async applyUserPropertyDelta(input: Parameters<Mp35cRepository['applyUserPropertyDelta']>[0]) {
    this.deltaInput = input; return this.result('vinculos_alterados', 'vinculo', 200);
  }
}

function service(repository = new FakeRepository()) {
  const authentication = { async authenticate(token: string) {
    return principal(token === COLLABORATOR_TOKEN ? 'colaborador' : 'admin');
  } } as AuthenticationService;
  const cursor = (namespace: 'administrative-links' | 'administrative-municipalities', byte: number) =>
    new SecureAdministrativeCursorCodec({ namespace, config: { activeKeyId: 'k1',
      keys: { k1: Buffer.alloc(32, byte).toString('base64') } } });
  return { repository, target: new DefaultMp35cService({ authentication, repository,
    linkCursor: cursor('administrative-links', 0x61),
    municipalityCursor: cursor('administrative-municipalities', 0x62) }) };
}

async function forbidden(operation: () => Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof HttpError
    && error.statusCode === 403 && error.code === 'forbidden');
}

describe('DefaultMp35cService', () => {
  it('aplica Admin-only nas sete rotas antes de consultar o repositório', async () => {
    const { target } = service(); const authorization = `Bearer ${COLLABORATOR_TOKEN}`;
    const operations = [
      () => target.createProperty({ authorization, idempotencyKey: 'a', requestId: 'r1',
        body: { nome: 'P', titular_id: USER, municipio_id: '4305108', status: 'ativa' } }),
      () => target.updateProperty({ authorization, idempotencyKey: 'b', requestId: 'r2',
        propertyId: PROPERTY, body: { versao: 1, nome: 'P2' } }),
      () => target.changePropertyStatus({ authorization, idempotencyKey: 'c', requestId: 'r3',
        propertyId: PROPERTY, body: { versao: 1, status: 'inativa', motivo: 'fim_relacao' } }),
      () => target.listUserProperties({ authorization, userId: USER, query: {} }),
      () => target.applyUserPropertyDelta({ authorization, idempotencyKey: 'd', requestId: 'r4',
        userId: USER, body: { versao: 1, adicionar: [PROPERTY], remover: [],
          motivo: 'correcao_administrativa' } }),
      () => target.listStates({ authorization }),
      () => target.listMunicipalities({ authorization, query: { uf_id: '43' } }),
    ];
    for (const operation of operations) await forbidden(operation);
  });

  it('não recebe tipo_vinculo do cliente e encaminha somente IDs no delta', async () => {
    const { target, repository } = service();
    const result = await target.applyUserPropertyDelta({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'delta-one', requestId: 'request-delta', userId: USER,
      body: { versao: 1, adicionar: [PROPERTY], remover: [],
        motivo: 'correcao_administrativa' } });
    assert.equal(result.receipt.outcome, 'vinculos_alterados');
    assert.deepEqual(repository.deltaInput?.add, [PROPERTY]);
    assert.equal('accessType' in (repository.deltaInput ?? {}), false);
  });

  it('normaliza area_total por decimal textual exato antes do repositório', async () => {
    const { target, repository } = service();
    await target.createProperty({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'decimal-create', requestId: 'decimal-create', body: {
        nome: 'Área decimal', titular_id: USER, municipio_id: '4305108',
        area_total: '1.2300', status: 'inativa',
      } });
    assert.equal(repository.createInput?.totalArea, '1.23');
    await target.updateProperty({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'decimal-update', requestId: 'decimal-update',
      propertyId: PROPERTY, body: { versao: 1, area_total: '1.0' } });
    assert.equal(repository.updateInput?.totalArea, '1');
    await assert.rejects(target.updateProperty({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'decimal-invalid', requestId: 'decimal-invalid',
      propertyId: PROPERTY, body: { versao: 1, area_total: '1.00000000000000001' } }),
    (error: unknown) => error instanceof HttpError
      && error.statusCode === 422 && error.code === 'validation_error');
  });

  it('mapeia delta sem efeito para 409 business_rule_conflict', async () => {
    const repository = new FakeRepository(); repository.mutationStatus = 'business_rule_conflict';
    const { target } = service(repository);
    await assert.rejects(target.applyUserPropertyDelta({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'delta-conflict', requestId: 'request-conflict', userId: USER,
      body: { versao: 1, adicionar: [PROPERTY], remover: [],
        motivo: 'correcao_administrativa' } }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409
        && error.code === 'business_rule_conflict');
    await assert.rejects(target.applyUserPropertyDelta({ authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'delta-empty', requestId: 'request-empty', userId: USER,
      body: { versao: 1, adicionar: [], remover: [],
        motivo: 'correcao_administrativa' } }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409
        && error.code === 'business_rule_conflict');
  });

  it('exige motivo D10 em todo delta válido', async () => {
    const { target, repository } = service();
    await assert.rejects(target.applyUserPropertyDelta({
      authorization: `Bearer ${ADMIN_TOKEN}`,
      idempotencyKey: 'delta-without-reason',
      requestId: 'request-delta-without-reason',
      userId: USER,
      body: { versao: 1, adicionar: [PROPERTY], remover: [] } as never,
    }), (error: unknown) => error instanceof HttpError
      && error.statusCode === 422 && error.code === 'validation_error');
    assert.equal(repository.deltaInput, undefined);
  });

  it('continua a paginação municipal na versão imutável da primeira página', async () => {
    const { target, repository } = service();
    const first = await target.listMunicipalities({ authorization: `Bearer ${ADMIN_TOKEN}`,
      query: { uf_id: '43', busca: 'C', limite: 1 } });
    assert.ok(first.nextCursor);
    const second = await target.listMunicipalities({ authorization: `Bearer ${ADMIN_TOKEN}`,
      query: { uf_id: '43', busca: 'C', limite: 1, cursor: first.nextCursor } });
    assert.equal(second.versionId, 'ibge-localidades-2026-08-25');
    assert.equal(repository.municipalityInputs[0]?.versionId, undefined);
    assert.equal(repository.municipalityInputs[1]?.versionId, 'ibge-localidades-2026-08-25');
  });

  it('mede sort_key do cursor em pontos de código NFC, inclusive fora do BMP', async () => {
    for (const count of [100, 101, 199, 200]) {
      const { target, repository } = service();
      repository.municipalitySortKey = '🌱'.repeat(count).normalize('NFC');
      repository.relationSortKey = '🌱'.repeat(count).normalize('NFC');
      const first = await target.listMunicipalities({
        authorization: `Bearer ${ADMIN_TOKEN}`,
        query: { uf_id: '43', limite: 1 },
      });
      assert.ok(first.nextCursor, `cursor ausente para ${count} pontos de código`);
      await assert.doesNotReject(target.listMunicipalities({
        authorization: `Bearer ${ADMIN_TOKEN}`,
        query: { uf_id: '43', limite: 1, cursor: first.nextCursor },
      }), `${count} pontos de código devem round-trip`);
      const links = await target.listUserProperties({ authorization: `Bearer ${ADMIN_TOKEN}`,
        userId: USER, query: { limite: 1 } });
      assert.ok(links.nextCursor);
      await assert.doesNotReject(target.listUserProperties({
        authorization: `Bearer ${ADMIN_TOKEN}`, userId: USER,
        query: { limite: 1, cursor: links.nextCursor },
      }), `${count} pontos de código devem round-trip em vínculos`);
    }
  });

  it('normaliza busca NFC/NFD antes de autenticar o binding do cursor', async () => {
    const { target } = service();
    const first = await target.listMunicipalities({ authorization: `Bearer ${ADMIN_TOKEN}`,
      query: { uf_id: '43', busca: 'Cafe\u0301', limite: 1 } });
    assert.ok(first.nextCursor);
    await assert.doesNotReject(target.listMunicipalities({ authorization: `Bearer ${ADMIN_TOKEN}`,
      query: { uf_id: '43', busca: 'Café', limite: 1, cursor: first.nextCursor } }));
    const links = await target.listUserProperties({ authorization: `Bearer ${ADMIN_TOKEN}`,
      userId: USER, query: { busca: 'Cafe\u0301', limite: 1 } });
    assert.ok(links.nextCursor);
    await assert.doesNotReject(target.listUserProperties({ authorization: `Bearer ${ADMIN_TOKEN}`,
      userId: USER, query: { busca: 'Café', limite: 1, cursor: links.nextCursor } }));
  });
});
