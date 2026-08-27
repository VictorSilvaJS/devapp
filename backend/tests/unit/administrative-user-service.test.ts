import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import type { AuthenticationService } from '../../src/auth/service.js';
import type {
  AdministrativeCommandResult,
  AdministrativeUserRepository,
  AdministrativeUserView,
} from '../../src/administration/user-contracts.js';
import { DefaultAdministrativeUserService } from '../../src/administration/user-service.js';
import { AdministrativeUserCursorCodec } from '../../src/administration/user-cursor.js';
import { HttpError } from '../../src/security/http-error.js';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';
const USER_ID = '30000000-0000-4000-8000-000000000001';
const TOKEN = 'A'.repeat(43);

function principal(
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal {
  return {
    id: ADMIN_ID,
    organizationId: 'org_tche_fertilidade',
    name: 'Admin',
    email: 'admin@example.test',
    profile: 'admin',
    status: 'ativo',
    authorizationVersion: 4,
    sessionId: SESSION_ID,
    ...overrides,
  };
}

function user(
  id: string,
  name: string,
  overrides: Partial<AdministrativeUserView> = {},
): AdministrativeUserView {
  return {
    id,
    organizationId: 'org_tche_fertilidade',
    producerId: null,
    name,
    sortKey: name.normalize('NFC').toLowerCase(),
    email: `${id}@example.test`,
    profile: 'colaborador',
    status: 'pendente',
    phone: null,
    document: null,
    notes: null,
    version: 1,
    createdAt: new Date('2026-08-26T10:00:00.000Z'),
    updatedAt: new Date('2026-08-26T10:00:00.000Z'),
    ...overrides,
  };
}

class RepositoryStub implements AdministrativeUserRepository {
  public rows: readonly AdministrativeUserView[] = [];
  public found: AdministrativeUserView | null = null;
  public result: AdministrativeCommandResult = {
    status: 'completed',
    httpStatus: 201,
    receipt: {
      outcome: 'criado',
      resourceType: 'usuario',
      resourceId: USER_ID,
      version: 1,
    },
  };
  public lastList: unknown;
  public lastCreate: unknown;
  public lastUpdate: unknown;
  public lastStatus: unknown;
  public lastInvitation: unknown;

  async list(input: Parameters<AdministrativeUserRepository['list']>[0]) {
    this.lastList = input;
    return this.rows;
  }

  async findById() {
    return this.found;
  }

  async create(input: Parameters<AdministrativeUserRepository['create']>[0]) {
    this.lastCreate = input;
    return this.result;
  }

  async update(input: Parameters<AdministrativeUserRepository['update']>[0]) {
    this.lastUpdate = input;
    return this.result;
  }

  async changeStatus(
    input: Parameters<AdministrativeUserRepository['changeStatus']>[0],
  ) {
    this.lastStatus = input;
    return this.result;
  }

  async issueInvitation(
    input: Parameters<AdministrativeUserRepository['issueInvitation']>[0],
  ) {
    this.lastInvitation = input;
    return this.result;
  }
}

function service(input: {
  readonly repository: RepositoryStub;
  readonly principal?: AuthenticatedPrincipal;
  readonly adminCreationEnabled?: boolean;
}) {
  const authentication = {
    async authenticate(token: string) {
      assert.equal(token, TOKEN);
      return input.principal ?? principal();
    },
  } as unknown as AuthenticationService;
  return new DefaultAdministrativeUserService({
    authentication,
    repository: input.repository,
    ...(input.adminCreationEnabled === undefined
      ? {}
      : { adminCreationEnabled: input.adminCreationEnabled }),
    cursorCodec: new AdministrativeUserCursorCodec({
      activeKeyId: 'test-v1',
      keys: [{ id: 'test-v1', key: Buffer.alloc(32, 0x35) }],
    }),
  });
}

async function expectHttpStatus(
  operation: () => Promise<unknown>,
  expectedStatus: number,
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, expectedStatus);
    return true;
  });
}

describe('DefaultAdministrativeUserService', () => {
  it('aplica escopo Admin, limite+1 e cursor estável nome+ID', async () => {
    const repository = new RepositoryStub();
    repository.rows = [
      user('30000000-0000-4000-8000-000000000001', 'Ágata'),
      user('30000000-0000-4000-8000-000000000002', 'Bruno'),
      user('30000000-0000-4000-8000-000000000003', 'Caio'),
    ];
    const target = service({ repository });
    const page = await target.list({
      authorization: `Bearer ${TOKEN}`,
      query: { busca: '  literal%_  ', perfil: 'produtor', limite: 2 },
    });

    assert.deepEqual(page.items.map((item) => item.name), ['Ágata', 'Bruno']);
    assert.equal(typeof page.nextCursor, 'string');
    assert.equal(
      Buffer.from(page.nextCursor ?? '', 'base64url')
        .toString('utf8')
        .toLocaleLowerCase('pt-BR')
        .includes('bruno'),
      false,
      'o cursor não pode expor a chave de ordenação em texto reversível',
    );
    assert.deepEqual(repository.lastList, {
      principal: principal(),
      organizationId: 'org_tche_fertilidade',
      limit: 3,
      profile: 'produtor',
      search: 'literal%_',
    });

    repository.rows = [];
    assert.ok(page.nextCursor);
    await target.list({
      authorization: `Bearer ${TOKEN}`,
      query: {
        cursor: page.nextCursor,
        busca: 'literal%_',
        perfil: 'produtor',
      },
    });
    assert.deepEqual(
      (repository.lastList as unknown as { cursor: unknown }).cursor,
      {
        sortKey: 'bruno',
        id: '30000000-0000-4000-8000-000000000002',
      },
    );

    await expectHttpStatus(
      () =>
        target.list({
          authorization: `Bearer ${TOKEN}`,
          query: { cursor: page.nextCursor ?? '', busca: 'outro filtro' },
        }),
      400,
    );
  });

  it('normaliza criação, gera IDs canônicos e retorna somente recibo seguro', async () => {
    const repository = new RepositoryStub();
    const result = await service({ repository }).create({
      authorization: `Bearer ${TOKEN}`,
      idempotencyKey: 'create:user:1',
      requestId: 'req-create-1',
      body: {
        nome: '  Produtora Ágata  ',
        email: '  AGATA@EXAMPLE.TEST ',
        perfil: 'produtor',
      },
    });

    assert.deepEqual(result, {
      httpStatus: 201,
      receipt: {
        outcome: 'criado',
        resourceType: 'usuario',
        resourceId: USER_ID,
        version: 1,
      },
    });
    const captured = repository.lastCreate as {
      name: string;
      email: string;
      userId: string;
      producerId: string;
      identity: {
        command: string;
        requestId: string;
        idempotencyKeyHash: Buffer;
        requestHash: Buffer;
      };
    };
    assert.equal(captured.name, 'Produtora Ágata');
    assert.equal(captured.email, 'agata@example.test');
    assert.match(captured.userId, /^[0-9a-f-]{36}$/u);
    assert.match(captured.producerId, /^[0-9a-f-]{36}$/u);
    assert.equal(captured.identity.command, 'usuario.criar');
    assert.equal(captured.identity.requestId, 'req-create-1');
    assert.equal(captured.identity.idempotencyKeyHash.length, 32);
    assert.equal(captured.identity.requestHash.length, 32);
  });

  it('mapeia conflitos persistidos sem vazar detalhe interno', async () => {
    const repository = new RepositoryStub();
    repository.result = { status: 'idempotency_conflict' };
    await expectHttpStatus(
      () =>
        service({ repository }).issueInvitation({
          authorization: `Bearer ${TOKEN}`,
          idempotencyKey: 'invite-1',
          requestId: 'req-invite-1',
          userId: USER_ID,
          body: { modo_ativacao: 'ativar_usuario' },
        }),
      409,
    );
  });

  it('mapeia alvo pendente da rota de status para 422 validation_error', async () => {
    const repository = new RepositoryStub();
    repository.result = { status: 'pending_status_transition' };
    await assert.rejects(
      service({ repository }).changeStatus({
        authorization: `Bearer ${TOKEN}`,
        idempotencyKey: 'status-pending',
        requestId: 'req-status-pending',
        userId: USER_ID,
        body: {
          versao: 1,
          status: 'ativo',
          motivo: 'correcao_administrativa',
        },
      }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 422
        && error.code === 'validation_error',
    );
  });

  it('mantém criação de Admin fechada em produção enquanto MFA não existe', async () => {
    const repository = new RepositoryStub();
    await assert.rejects(
      service({ repository, adminCreationEnabled: false }).create({
        authorization: `Bearer ${TOKEN}`,
        idempotencyKey: 'create-admin-without-mfa',
        requestId: 'req-create-admin-without-mfa',
        body: {
          nome: 'Admin sem MFA',
          email: 'admin-sem-mfa@example.test',
          perfil: 'admin',
        },
      }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 409
        && error.code === 'business_rule_conflict',
    );
    assert.equal(repository.lastCreate, undefined);
  });

  it('rejeita semântica inválida antes de chegar ao repositório', async () => {
    const repository = new RepositoryStub();
    const target = service({ repository });
    await expectHttpStatus(
      () =>
        target.changeStatus({
          authorization: `Bearer ${TOKEN}`,
          idempotencyKey: 'status-1',
          requestId: 'req-status-1',
          userId: USER_ID,
          body: { versao: 1, status: 'inativo', motivo: 'outro' },
        }),
      422,
    );
    await expectHttpStatus(
      () =>
        target.issueInvitation({
          authorization: `Bearer ${TOKEN}`,
          idempotencyKey: 'invite-2',
          requestId: 'req-invite-2',
          userId: USER_ID,
          body: { modo_ativacao: 'manter_status' },
        }),
      422,
    );
    assert.equal(repository.lastStatus, undefined);
    assert.equal(repository.lastInvitation, undefined);
  });

  it('nega Colaborador e Produtor antes de consultar o repositório', async () => {
    for (const profile of ['colaborador', 'produtor'] as const) {
      const repository = new RepositoryStub();
      await expectHttpStatus(
        () =>
          service({
            repository,
            principal: principal({ profile }),
          }).detail({
            authorization: `Bearer ${TOKEN}`,
            userId: USER_ID,
          }),
        403,
      );
      assert.equal(repository.found, null);
    }
  });
});
