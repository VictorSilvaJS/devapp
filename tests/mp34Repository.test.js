const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApiTransportError,
} = require('../.tmp-mp34/src/http/httpTransport');
const {
  HttpNotificationRepository,
} = require('../.tmp-mp34/src/http/notificationRepository');
const {
  SessionCoordinator,
  SessionRequiredError,
} = require('../.tmp-mp34/src/http/sessionCoordinator');

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '99999999-9999-4999-8999-999999999999';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const NOTIFICATION_ID = '33333333-3333-4333-8333-333333333333';
const ACCESS_A = 'A'.repeat(43);
const ACCESS_B = 'B'.repeat(43);
const REFRESH_A = 'C'.repeat(43);
const REFRESH_B = 'D'.repeat(43);
const IDEMPOTENCY_KEY = 'notif_retry_key_0000000000000001';
const ISSUED_AT = '2026-08-24T12:00:00.000Z';
const READ_AT = '2026-08-24T12:05:00.000Z';

function tokenResponse({
  accessToken = ACCESS_A,
  refreshToken = REFRESH_A,
  userId = USER_A_ID,
  authorizationVersion = 3,
} = {}) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: ISSUED_AT,
    access_expira_em: '2026-08-24T12:15:00.000Z',
    sessao_expira_inatividade_em: '2026-09-07T12:00:00.000Z',
    sessao_expira_absolutamente_em: '2026-09-23T12:00:00.000Z',
    id: SESSION_ID,
    usuario: {
      id: userId,
      organizacao_id: 'org_tche_fertilidade',
      nome: userId === USER_A_ID ? 'Usuário A' : 'Usuário B',
      email: userId === USER_A_ID ? 'a@example.com' : 'b@example.com',
      perfil: 'admin',
      status: 'ativo',
      versao_autorizacao: authorizationVersion,
    },
    escopo: {
      modo: 'organizacao',
      versao: authorizationVersion,
    },
  };
}

function page() {
  return {
    itens: [],
    paginacao: { proximo_cursor: null },
  };
}

function authenticatedSessionStub(userId = USER_A_ID) {
  return {
    snapshot: {
      usuario: { id: userId },
    },
    async authenticated(operation) {
      return operation(ACCESS_A);
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

class MemoryRefreshStore {
  constructor(value = null) {
    this.value = value;
  }

  async read() {
    return this.value;
  }

  async write(value) {
    this.value = value;
  }

  async clear() {
    this.value = null;
  }
}

function fakeApi(overrides = {}) {
  return {
    async login() {
      return tokenResponse();
    },
    async refresh() {
      return tokenResponse({
        accessToken: ACCESS_B,
        refreshToken: REFRESH_B,
      });
    },
    async logout() {},
    async logoutAll() {},
    async revokeSession() {},
    async me() {
      const response = tokenResponse();
      return {
        id: response.id,
        usuario: response.usuario,
        escopo: response.escopo,
      };
    },
    async changePassword() {
      return tokenResponse({
        accessToken: ACCESS_B,
        refreshToken: REFRESH_B,
      });
    },
    async listNotifications() {
      return page();
    },
    async countUnreadNotifications() {
      return { total_nao_lidas: 0 };
    },
    async markNotificationRead() {
      return { id: NOTIFICATION_ID, lida_em: READ_AT };
    },
    async markAllNotificationsRead() {
      return { corte_em: READ_AT, atualizadas: 0 };
    },
    async discardNotification() {
      return { id: NOTIFICATION_ID, descartada_em: READ_AT };
    },
    async resolveNotificationDestination() {
      return { recurso_tipo: 'conta', recurso_id: USER_A_ID };
    },
    ...overrides,
  };
}

function coordinator(api, store = new MemoryRefreshStore()) {
  return new SessionCoordinator({
    api,
    refreshTokenStore: store,
    monotonicNow: () => 100,
    wallClockNow: () => Date.parse(ISSUED_AT),
  });
}

test('repositório autentica cada operação e preserva argumentos canônicos', async () => {
  const calls = [];
  const api = {
    async listNotifications(...args) {
      calls.push(['list', ...args]);
      return page();
    },
    async countUnreadNotifications(...args) {
      calls.push(['count', ...args]);
      return { total_nao_lidas: 4 };
    },
    async markNotificationRead(...args) {
      calls.push(['read', ...args]);
      return { id: NOTIFICATION_ID, lida_em: READ_AT };
    },
    async markAllNotificationsRead(...args) {
      calls.push(['read-all', ...args]);
      return { corte_em: READ_AT, atualizadas: 4 };
    },
    async discardNotification(...args) {
      calls.push(['discard', ...args]);
      return { id: NOTIFICATION_ID, descartada_em: READ_AT };
    },
    async resolveNotificationDestination(...args) {
      calls.push(['resolve', ...args]);
      return { recurso_tipo: 'conta', recurso_id: USER_A_ID };
    },
  };
  const session = authenticatedSessionStub();
  const repository = new HttpNotificationRepository(api, session);
  const filters = {
    estado: 'nao_lida',
    limite: 50,
    cursor: 'cursor-opaco',
  };

  await repository.list(filters);
  assert.equal(await repository.countUnread(), 4);
  await repository.markRead(NOTIFICATION_ID, IDEMPOTENCY_KEY);
  await repository.markAllRead(IDEMPOTENCY_KEY);
  await repository.discard(NOTIFICATION_ID, IDEMPOTENCY_KEY);
  await repository.resolveDestination(NOTIFICATION_ID);

  assert.deepEqual(calls, [
    ['list', ACCESS_A, filters],
    ['count', ACCESS_A],
    ['read', ACCESS_A, NOTIFICATION_ID, IDEMPOTENCY_KEY],
    ['read-all', ACCESS_A, IDEMPOTENCY_KEY],
    ['discard', ACCESS_A, NOTIFICATION_ID, IDEMPOTENCY_KEY],
    ['resolve', ACCESS_A, NOTIFICATION_ID],
  ]);
});

test('repetição explícita reutiliza a chave recebida e não cria retry oculto', async () => {
  const keys = [];
  let attempt = 0;
  const repository = new HttpNotificationRepository({
    async markNotificationRead(_accessToken, _id, key) {
      keys.push(key);
      attempt += 1;
      if (attempt === 1) throw new ApiTransportError();
      return { id: NOTIFICATION_ID, lida_em: READ_AT };
    },
  }, authenticatedSessionStub());

  await assert.rejects(
    repository.markRead(NOTIFICATION_ID, IDEMPOTENCY_KEY),
    ApiTransportError,
  );
  const confirmed = await repository.markRead(
    NOTIFICATION_ID,
    IDEMPOTENCY_KEY,
  );

  assert.equal(confirmed.id, NOTIFICATION_ID);
  assert.deepEqual(keys, [IDEMPOTENCY_KEY, IDEMPOTENCY_KEY]);
  assert.equal(attempt, 2);
});

test('repositório falha fechado para recurso ou resultado de outro alvo', async () => {
  const otherId = USER_B_ID;
  const session = authenticatedSessionStub();

  await assert.rejects(
    new HttpNotificationRepository({
      async listNotifications() {
        return {
          itens: [{ recurso_id: otherId }],
          paginacao: { proximo_cursor: null },
        };
      },
    }, session).list(),
  );

  await assert.rejects(
    new HttpNotificationRepository({
      async markNotificationRead() {
        return { id: otherId, lida_em: READ_AT };
      },
    }, session).markRead(NOTIFICATION_ID, IDEMPOTENCY_KEY),
  );

  await assert.rejects(
    new HttpNotificationRepository({
      async discardNotification() {
        return { id: otherId, descartada_em: READ_AT };
      },
    }, session).discard(NOTIFICATION_ID, IDEMPOTENCY_KEY),
  );

  await assert.rejects(
    new HttpNotificationRepository({
      async resolveNotificationDestination() {
        return { recurso_tipo: 'conta', recurso_id: otherId };
      },
    }, session).resolveDestination(NOTIFICATION_ID),
  );
});

test('respostas tardias de todas as operações são descartadas após logout', async (t) => {
  const scenarios = [
    {
      name: 'listagem',
      method: 'listNotifications',
      invoke: (repository) => repository.list(),
      result: page(),
    },
    {
      name: 'contador',
      method: 'countUnreadNotifications',
      invoke: (repository) => repository.countUnread(),
      result: { total_nao_lidas: 3 },
    },
    {
      name: 'leitura individual',
      method: 'markNotificationRead',
      invoke: (repository) => repository.markRead(
        NOTIFICATION_ID,
        IDEMPOTENCY_KEY,
      ),
      result: { id: NOTIFICATION_ID, lida_em: READ_AT },
    },
    {
      name: 'leitura em lote',
      method: 'markAllNotificationsRead',
      invoke: (repository) => repository.markAllRead(IDEMPOTENCY_KEY),
      result: { corte_em: READ_AT, atualizadas: 3 },
    },
    {
      name: 'descarte',
      method: 'discardNotification',
      invoke: (repository) => repository.discard(
        NOTIFICATION_ID,
        IDEMPOTENCY_KEY,
      ),
      result: { id: NOTIFICATION_ID, descartada_em: READ_AT },
    },
    {
      name: 'resolução de destino',
      method: 'resolveNotificationDestination',
      invoke: (repository) => repository.resolveDestination(NOTIFICATION_ID),
      result: { recurso_tipo: 'conta', recurso_id: USER_A_ID },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const gate = deferred();
      let calls = 0;
      const api = fakeApi({
        [scenario.method]: async () => {
          calls += 1;
          return gate.promise;
        },
      });
      const store = new MemoryRefreshStore();
      const session = coordinator(api, store);
      await session.login('a@example.com', 'senha-valida');
      const repository = new HttpNotificationRepository(api, session);

      const pending = scenario.invoke(repository);
      await tick();
      assert.equal(calls, 1);
      const epochBeforeLogout = session.epoch;
      await session.logout();
      assert.ok(session.epoch > epochBeforeLogout);
      assert.equal(session.snapshot, null);
      assert.equal(store.value, null);

      const rejected = assert.rejects(pending, SessionRequiredError);
      gate.resolve(scenario.result);
      await rejected;
      assert.equal(session.snapshot, null);
    });
  }
});

test('troca de usuário não entrega resposta da identidade anterior', async () => {
  const gate = deferred();
  let loginCount = 0;
  const api = fakeApi({
    async login() {
      loginCount += 1;
      return loginCount === 1
        ? tokenResponse()
        : tokenResponse({ userId: USER_B_ID });
    },
    async listNotifications() {
      return gate.promise;
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  const repository = new HttpNotificationRepository(api, session);

  await session.login('a@example.com', 'senha-a');
  const pendingFromA = repository.list();
  await tick();
  await session.logout();
  await session.login('b@example.com', 'senha-b');
  assert.equal(session.snapshot.usuario.id, USER_B_ID);

  const rejected = assert.rejects(pendingFromA, SessionRequiredError);
  gate.resolve(page());
  await rejected;
  assert.equal(session.snapshot.usuario.id, USER_B_ID);
  assert.equal(store.value, REFRESH_A);
});

test('troca de senha avança o epoch e invalida consulta iniciada antes da rotação', async () => {
  const gate = deferred();
  const listTokens = [];
  let firstList = true;
  const api = fakeApi({
    async listNotifications(accessToken) {
      listTokens.push(accessToken);
      if (firstList) {
        firstList = false;
        return gate.promise;
      }
      return page();
    },
    async changePassword() {
      return tokenResponse({
        accessToken: ACCESS_B,
        refreshToken: REFRESH_B,
      });
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  const repository = new HttpNotificationRepository(api, session);

  await session.login('a@example.com', 'senha-a');
  const oldEpoch = session.epoch;
  const staleList = repository.list();
  await tick();

  await session.changePassword('senha-a', 'senha-b');
  assert.ok(session.epoch > oldEpoch);
  assert.equal(store.value, REFRESH_B);

  const rejected = assert.rejects(staleList, SessionRequiredError);
  gate.resolve(page());
  await rejected;

  assert.deepEqual(await repository.list(), page());
  assert.deepEqual(listTokens, [ACCESS_A, ACCESS_B]);
  assert.equal(session.snapshot.usuario.id, USER_A_ID);
});
