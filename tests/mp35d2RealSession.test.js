const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BackendApi,
  InvalidApiRequestError,
} = require('../.tmp-mp35d2/src/http/backendApi');
const {
  AdministrativeUserAccessDeniedError,
  administrativeUserSessionPartition,
} = require('../.tmp-mp35d2/src/http/administrativeUserAccess');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d2/src/http/administrativeUserDataBoundary');
const {
  HttpAdministrativeUserRepository,
} = require('../.tmp-mp35d2/src/http/administrativeUserRepository');
const {
  SessionCoordinator,
  SessionRequiredError,
} = require('../.tmp-mp35d2/src/http/sessionCoordinator');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ACCESS_TOKEN = 'A'.repeat(43);
const STORED_REFRESH = 'B'.repeat(43);
const ROTATED_REFRESH = 'C'.repeat(43);

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function tokenResponse(profile = 'admin') {
  return Object.freeze({
    access_token: ACCESS_TOKEN,
    refresh_token: ROTATED_REFRESH,
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: '2026-08-21T12:00:00.000Z',
    access_expira_em: '2026-08-21T12:15:00.000Z',
    sessao: Object.freeze({
      id: SESSION_ID,
      expira_inatividade_em: '2026-09-04T12:00:00.000Z',
      expira_absolutamente_em: '2026-09-20T12:00:00.000Z',
    }),
    usuario: Object.freeze({
      id: USER_ID,
      organizacao_id: 'org_tche_fertilidade',
      nome: 'Operador HTTP',
      email: 'operador@example.test',
      perfil: profile,
      status: 'ativo',
      versao_autorizacao: 3,
    }),
    escopo: Object.freeze({
      modo: profile === 'admin' ? 'organizacao' : 'vinculos_propriedade',
      versao: 3,
    }),
  });
}

function administrativeDetail() {
  return Object.freeze({
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: null,
    nome: 'Usuário consultado',
    email: 'consultado@example.test',
    perfil: 'admin',
    status: 'ativo',
    versao: 1,
    telefone: null,
    documento: null,
    observacoes: null,
    criado_em: '2026-08-21T12:00:00.000Z',
    atualizado_em: '2026-08-21T12:00:00.000Z',
  });
}

class InstrumentedStore {
  constructor(value = STORED_REFRESH) {
    this.value = value;
    this.readCount = 0;
    this.writeCount = 0;
    this.clearCount = 0;
    this.readGate = null;
  }

  async read() {
    this.readCount += 1;
    if (this.readGate !== null) await this.readGate.promise;
    return this.value;
  }

  async write(value) {
    this.writeCount += 1;
    this.value = value;
  }

  async clear() {
    this.clearCount += 1;
    this.value = null;
  }
}

function fixture(
  profile = 'admin',
  store = new InstrumentedStore(),
  refreshGate = null,
) {
  const calls = {
    backendApi: 0,
    refresh: 0,
    detail: 0,
    logout: 0,
  };
  const requests = [];
  const backendApi = new BackendApi({
    baseUrl: 'https://api.tcheagro.example/',
    transport: {
      async send(request) {
        requests.push(request);
        if (request.url.endsWith('/v1/auth/refresh')) {
          if (refreshGate !== null) await refreshGate.promise;
          return { status: 200, body: tokenResponse(profile) };
        }
        if (request.method === 'GET' && request.url.endsWith(`/v1/usuarios/${USER_ID}`)) {
          return { status: 200, body: administrativeDetail() };
        }
        if (request.url.endsWith('/v1/auth/logout')) {
          return { status: 204, body: undefined };
        }
        throw new Error(`Requisição inesperada: ${request.method} ${request.url}`);
      },
    },
  });
  const api = {
    async refresh(refreshToken) {
      calls.backendApi += 1;
      calls.refresh += 1;
      assert.equal(refreshToken, STORED_REFRESH);
      return backendApi.refresh(refreshToken);
    },
    async getAdministrativeUser(accessToken, id) {
      calls.backendApi += 1;
      calls.detail += 1;
      assert.equal(accessToken, ACCESS_TOKEN);
      assert.equal(id, USER_ID);
      return backendApi.getAdministrativeUser(accessToken, id);
    },
    async logout(accessToken) {
      calls.backendApi += 1;
      calls.logout += 1;
      return backendApi.logout(accessToken);
    },
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: store,
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-08-21T12:00:00.000Z'),
  });
  const boundary = new AdministrativeUserDataBoundary();
  session.subscribe((snapshot) => {
    boundary.synchronizePartition(
      administrativeUserSessionPartition(snapshot, session.epoch),
    );
  });
  const repository = new HttpAdministrativeUserRepository(
    api,
    session,
    boundary,
  );
  return { api, boundary, calls, repository, requests, session, store };
}

test('UUIDs adversariais falham antes de sessão, storage e API', async () => {
  const invalidIds = [
    '',
    ' ',
    'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    USER_ID.replace(/-/g, ''),
    `${USER_ID}/properties`,
    `${USER_ID}?expand=true`,
    ` ${USER_ID}`,
    `${USER_ID} `,
    `${USER_ID}\n`,
    '11111111-1111-1111-8111-111111111111',
    '11111111-1111-4111-7111-111111111111',
    null,
    1,
    {},
    [],
    true,
    () => undefined,
  ];
  for (const id of invalidIds) {
    const context = fixture();
    const before = context.boundary.current;
    await assert.rejects(
      context.repository.getById(id),
      InvalidApiRequestError,
    );
    assert.equal(context.session.epoch, 0);
    assert.equal(context.session.snapshot, null);
    assert.equal(context.store.readCount, 0);
    assert.equal(context.store.writeCount, 0);
    assert.deepEqual(context.calls, {
      backendApi: 0,
      refresh: 0,
      detail: 0,
      logout: 0,
    });
    assert.equal(context.requests.length, 0);
    assert.equal(context.boundary.current, before);
  }
});

test('ID válido restaura sessão Admin real e executa exatamente uma leitura', async () => {
  const context = fixture('admin');
  const result = await context.repository.getById(USER_ID);
  assert.equal(result.id, USER_ID);
  assert.equal(context.store.readCount, 1);
  assert.equal(context.store.writeCount, 1);
  assert.deepEqual(context.calls, {
    backendApi: 2,
    refresh: 1,
    detail: 1,
    logout: 0,
  });
  assert.equal(
    context.requests.filter((request) => request.method === 'GET').length,
    1,
  );
});

test('restauração real de Produtor e Colaborador bloqueia antes do GET', async () => {
  for (const profile of ['produtor', 'colaborador']) {
    const context = fixture(profile);
    await assert.rejects(
      context.repository.getById(USER_ID),
      AdministrativeUserAccessDeniedError,
    );
    assert.equal(context.store.readCount, 1);
    assert.equal(context.calls.refresh, 1);
    assert.equal(context.calls.detail, 0);
    assert.equal(
      context.requests.filter((request) => request.method === 'GET').length,
      0,
    );
    assert.equal(context.boundary.current.invalidation, 'forbidden');
  }
});

test('logout durante restauração real invalida o epoch e impede refresh e GET', async () => {
  const store = new InstrumentedStore();
  store.readGate = deferred();
  const context = fixture('admin', store);
  const reading = context.repository.getById(USER_ID);
  while (store.readCount === 0) await Promise.resolve();
  const loggingOut = context.session.logout();
  store.readGate.resolve();
  await assert.rejects(reading, SessionRequiredError);
  await loggingOut;
  assert.equal(context.calls.refresh, 0);
  assert.equal(context.calls.detail, 0);
  assert.equal(context.requests.length, 0);
  assert.equal(context.session.snapshot, null);
  assert.equal(context.boundary.current.invalidation, 'invalid_session');
});

test('mudança de epoch durante refresh real descarta a sessão e faz zero GET', async () => {
  const refreshGate = deferred();
  const context = fixture('admin', new InstrumentedStore(), refreshGate);
  const reading = context.repository.getById(USER_ID);
  while (context.calls.refresh === 0) await Promise.resolve();
  const loggingOut = context.session.logout();
  refreshGate.resolve();
  await assert.rejects(reading, SessionRequiredError);
  await loggingOut;
  assert.equal(context.calls.refresh, 1);
  assert.equal(context.calls.detail, 0);
  assert.equal(
    context.requests.filter((request) => request.method === 'GET').length,
    0,
  );
  assert.equal(context.session.snapshot, null);
});
