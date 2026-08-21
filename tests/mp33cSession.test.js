const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApiResponseError,
} = require('../.tmp-mp33c/src/http/backendApi');
const {
  ApiTransportError,
} = require('../.tmp-mp33c/src/http/httpTransport');
const {
  InvalidBackendResponseError,
} = require('../.tmp-mp33c/src/http/decoders');
const {
  SessionCoordinator,
  SessionRequiredError,
  SessionStorageError,
} = require('../.tmp-mp33c/src/http/sessionCoordinator');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_B_ID = '33333333-3333-4333-8333-333333333333';
const ACCESS_A = 'A'.repeat(43);
const ACCESS_B = 'B'.repeat(43);
const REFRESH_A = 'C'.repeat(43);
const REFRESH_B = 'D'.repeat(43);

function tokenResponse({
  accessToken = ACCESS_A,
  refreshToken = REFRESH_A,
  userId = USER_ID,
  sessionId = SESSION_ID,
} = {}) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: '2026-08-21T12:00:00.000Z',
    access_expira_em: '2026-08-21T12:15:00.000Z',
    sessao_expira_inatividade_em: '2026-09-04T12:00:00.000Z',
    sessao_expira_absolutamente_em: '2026-09-20T12:00:00.000Z',
    id: sessionId,
    usuario: {
      id: userId,
      organizacao_id: 'org_tche_fertilidade',
      nome: 'Usuário HTTP',
      email: 'usuario@example.com',
      perfil: 'admin',
      status: 'ativo',
      versao_autorizacao: 3,
    },
    escopo: { modo: 'organizacao', versao: 3 },
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
    this.clearCount = 0;
    this.writeCount = 0;
    this.failRead = false;
    this.failWrite = false;
    this.readGate = null;
    this.writeGate = null;
  }

  async read() {
    if (this.readGate) await this.readGate.promise;
    if (this.failRead) throw new Error('read failed');
    return this.value;
  }

  async write(value) {
    this.writeCount += 1;
    if (this.writeGate) await this.writeGate.promise;
    if (this.failWrite) throw new Error('write failed');
    this.value = value;
  }

  async clear() {
    this.clearCount += 1;
    this.value = null;
  }
}

function fakeApi(overrides = {}) {
  const calls = {
    refresh: 0,
    logout: [],
    logoutAll: 0,
    revokeSession: [],
  };
  return {
    calls,
    async login() { return tokenResponse(); },
    async refresh() {
      calls.refresh += 1;
      return tokenResponse({ accessToken: ACCESS_B, refreshToken: REFRESH_B });
    },
    async logout(accessToken) { calls.logout.push(accessToken); },
    async logoutAll() { calls.logoutAll += 1; },
    async revokeSession(accessToken, sessionId) {
      calls.revokeSession.push([accessToken, sessionId]);
    },
    async me() {
      const token = tokenResponse();
      return { id: token.id, usuario: token.usuario, escopo: token.escopo };
    },
    async changePassword() {
      return tokenResponse({ accessToken: ACCESS_B, refreshToken: REFRESH_B });
    },
    ...overrides,
  };
}

function coordinator(api, store, clock = { now: 0 }) {
  return new SessionCoordinator({
    api,
    refreshTokenStore: store,
    monotonicNow: () => clock.now,
    wallClockNow: () => Date.parse('2026-08-21T12:00:00.000Z'),
  });
}

function apiError(status, code) {
  return new ApiResponseError({
    status,
    code,
    message: 'remote text must never be displayed',
  });
}

test('single-flight renova uma vez e repete cada operação no máximo uma vez', async () => {
  const refreshGate = deferred();
  const api = fakeApi({
    async refresh() {
      api.calls.refresh += 1;
      return refreshGate.promise;
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const attempts = [];
  const operation = async (accessToken) => {
    attempts.push(accessToken);
    if (accessToken === ACCESS_A) throw apiError(401, 'invalid_session');
    return accessToken;
  };
  const first = session.authenticated(operation);
  const second = session.authenticated(operation);
  await tick();
  assert.equal(api.calls.refresh, 1);
  refreshGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  assert.deepEqual(await Promise.all([first, second]), [ACCESS_B, ACCESS_B]);
  assert.equal(api.calls.refresh, 1);
  assert.equal(attempts.filter((value) => value === ACCESS_A).length, 2);
  assert.equal(attempts.filter((value) => value === ACCESS_B).length, 2);
  assert.equal(store.value, REFRESH_B);
});

test('deadline monotônico usa access_expira_em e desconta trânsito', async () => {
  const store = new MemoryRefreshStore();
  const session = new SessionCoordinator({
    api: fakeApi(),
    refreshTokenStore: store,
    monotonicNow: () => 100,
    wallClockNow: () => Date.parse('2026-08-21T12:10:00.000Z'),
  });
  const snapshot = await session.login('usuario@example.com', 'senha-valida');
  assert.equal(snapshot.access_expires_monotonic, 300_100);
});

test('reauth usa B para revogar a sessão anterior e bloqueia A durante persistência', async () => {
  let loginCount = 0;
  const api = fakeApi({
    async login() {
      loginCount += 1;
      return loginCount === 1
        ? tokenResponse()
        : tokenResponse({
            accessToken: ACCESS_B,
            refreshToken: REFRESH_B,
            sessionId: SESSION_B_ID,
          });
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  store.writeGate = deferred();
  const reauthenticating = session.reauthenticate('senha-valida');
  await tick();
  assert.equal(store.writeCount, 2);

  const observedTokens = [];
  const reading = session.authenticated(async (accessToken) => {
    observedTokens.push(accessToken);
    return accessToken;
  });
  await tick();
  assert.deepEqual(observedTokens, []);

  store.writeGate.resolve();
  const replacement = await reauthenticating;
  assert.equal(replacement.id, SESSION_B_ID);
  assert.equal(await reading, ACCESS_B);
  assert.deepEqual(observedTokens, [ACCESS_B]);
  assert.equal(store.value, REFRESH_B);
  assert.deepEqual(api.calls.revokeSession, [[ACCESS_B, SESSION_ID]]);
  assert.deepEqual(api.calls.logout, []);
});

test('troca de senha não libera A enquanto persiste a rotação', async () => {
  const api = fakeApi();
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  store.writeGate = deferred();
  const changing = session.changePassword('senha-valida', 'nova-senha');
  await tick();
  assert.equal(store.writeCount, 2);

  const observedTokens = [];
  const reading = session.authenticated(async (accessToken) => {
    observedTokens.push(accessToken);
    return accessToken;
  });
  await tick();
  assert.deepEqual(observedTokens, []);

  store.writeGate.resolve();
  await changing;
  assert.equal(await reading, ACCESS_B);
  assert.deepEqual(observedTokens, [ACCESS_B]);
  assert.equal(store.value, REFRESH_B);
});

test('invalid_credentials em troca de senha não renova nem apaga a sessão', async () => {
  const api = fakeApi({
    async changePassword() {
      throw apiError(401, 'invalid_credentials');
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  await assert.rejects(
    session.changePassword('incorreta', 'nova-senha'),
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_credentials',
  );
  assert.notEqual(session.snapshot, null);
  assert.equal(store.value, REFRESH_A);
  assert.equal(api.calls.refresh, 0);
});

test('timeout em operação que gira senha limpa sessão de forma fail-closed', async () => {
  const api = fakeApi({
    async changePassword() { throw new ApiTransportError(); },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  await assert.rejects(
    session.changePassword('senha-valida', 'nova-senha'),
    SessionRequiredError,
  );
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
});

test('GET me indisponível preserva sessão para estado visual indisponível', async () => {
  const api = fakeApi({
    async me() { throw new ApiTransportError(); },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  await assert.rejects(session.revalidate(), ApiTransportError);
  assert.notEqual(session.snapshot, null);
  assert.equal(store.value, REFRESH_A);
});

test('refresh ambíguo limpa sessão, mas 503 explícito preserva refresh', async () => {
  const transportApi = fakeApi({
    async refresh() { throw new ApiTransportError(); },
  });
  const transportStore = new MemoryRefreshStore(REFRESH_A);
  const transportSession = coordinator(transportApi, transportStore);
  await assert.rejects(transportSession.restore(), SessionRequiredError);
  assert.equal(transportStore.value, null);

  const unavailableApi = fakeApi({
    async refresh() { throw apiError(503, 'service_unavailable'); },
  });
  const unavailableStore = new MemoryRefreshStore(REFRESH_A);
  const unavailableSession = coordinator(unavailableApi, unavailableStore);
  await assert.rejects(
    unavailableSession.restore(),
    (error) => error instanceof ApiResponseError && error.status === 503,
  );
  assert.equal(unavailableStore.value, REFRESH_A);
});

test('logout invalida refresh em voo e resposta atrasada não ressuscita sessão', async () => {
  const refreshGate = deferred();
  const clock = { now: 0 };
  const api = fakeApi({
    async refresh() {
      api.calls.refresh += 1;
      return refreshGate.promise;
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store, clock);
  await session.login('usuario@example.com', 'senha-valida');
  clock.now = 901_000;

  const pending = session.authenticated(async (accessToken) => accessToken);
  await tick();
  await session.logout();
  refreshGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  await assert.rejects(pending, SessionRequiredError);
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
  assert.ok(api.calls.logout.includes(ACCESS_B));
});

test('resultado protegido atrasado não é devolvido após logout', async () => {
  const operationGate = deferred();
  const api = fakeApi();
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const pending = session.authenticated(() => operationGate.promise);
  await tick();
  await session.logout();
  operationGate.resolve('dado-antigo');
  await assert.rejects(pending, SessionRequiredError);
  assert.equal(session.snapshot, null);
});

test('write antigo é serializado antes do clear de logout', async () => {
  const api = fakeApi();
  const store = new MemoryRefreshStore();
  store.writeGate = deferred();
  const session = coordinator(api, store);

  const pendingLogin = session.login('usuario@example.com', 'senha-valida');
  await tick();
  const pendingLogout = session.logout();
  store.writeGate.resolve();

  await assert.rejects(pendingLogin, SessionRequiredError);
  await pendingLogout;
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
});

test('logout-all bloqueia e limpa local mesmo se revogação remota falhar', async () => {
  const remoteGate = deferred();
  const api = fakeApi({
    async logoutAll() {
      api.calls.logoutAll += 1;
      return remoteGate.promise;
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const pending = session.logoutAll();
  await tick();
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
  remoteGate.reject(new ApiTransportError());
  await pending;
  assert.equal(api.calls.logoutAll, 1);
});

test('identidade incompatível e falha de SecureStore terminam bloqueadas', async () => {
  const identityApi = fakeApi({
    async me() {
      const token = tokenResponse({ userId: OTHER_USER_ID });
      return { id: token.id, usuario: token.usuario, escopo: token.escopo };
    },
  });
  const identityStore = new MemoryRefreshStore();
  const identitySession = coordinator(identityApi, identityStore);
  await identitySession.login('usuario@example.com', 'senha-valida');
  await assert.rejects(identitySession.revalidate(), SessionRequiredError);
  assert.equal(identitySession.snapshot, null);
  assert.equal(identityStore.value, null);

  const failingStore = new MemoryRefreshStore();
  failingStore.failWrite = true;
  const failingSession = coordinator(fakeApi(), failingStore);
  await assert.rejects(
    failingSession.login('usuario@example.com', 'senha-valida'),
    SessionStorageError,
  );
  assert.equal(failingSession.snapshot, null);
  assert.equal(failingStore.value, null);
  assert.ok(failingStore.clearCount >= 2);
});

test('troca de senha exclui refresh concorrente e não permite replay antigo', async () => {
  const changeGate = deferred();
  const api = fakeApi({
    async changePassword() { return changeGate.promise; },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const changing = session.changePassword('senha-valida', 'nova-senha');
  await tick();
  const concurrentGet = session.authenticated(async () => {
    throw apiError(401, 'invalid_session');
  });
  await tick();
  changeGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  const changed = await changing;
  assert.equal(changed.access_expira_em, '2026-08-21T12:15:00.000Z');
  await assert.rejects(concurrentGet, SessionRequiredError);
  assert.equal(api.calls.refresh, 0);
  assert.equal(store.value, REFRESH_B);
  assert.notEqual(session.snapshot, null);
});

test('refresh com outra identidade é revogado e limpa sessão', async () => {
  const api = fakeApi({
    async refresh() {
      api.calls.refresh += 1;
      return tokenResponse({
        accessToken: ACCESS_B,
        refreshToken: REFRESH_B,
        userId: OTHER_USER_ID,
      });
    },
  });
  const store = new MemoryRefreshStore();
  const clock = { now: 0 };
  const session = coordinator(api, store, clock);
  await session.login('usuario@example.com', 'senha-valida');
  clock.now = 901_000;

  await assert.rejects(
    session.authenticated(async () => 'nunca'),
    SessionRequiredError,
  );
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
  assert.ok(api.calls.logout.includes(ACCESS_B));
});

test('read de SecureStore é serializado com clear e não restaura após logout', async () => {
  const store = new MemoryRefreshStore(REFRESH_A);
  store.readGate = deferred();
  const session = coordinator(fakeApi(), store);

  const restoring = session.restore();
  await tick();
  const loggingOut = session.logout();
  store.readGate.resolve();

  await assert.rejects(restoring, SessionRequiredError);
  await loggingOut;
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
});

test('logout-all remoto termina antes de um novo login ser aceito', async () => {
  const logoutAllGate = deferred();
  const events = [];
  let loginCount = 0;
  const api = fakeApi({
    async login() {
      loginCount += 1;
      events.push(`login:${loginCount}`);
      return tokenResponse();
    },
    async logoutAll() {
      events.push('logout-all:start');
      await logoutAllGate.promise;
      events.push('logout-all:end');
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const loggingOut = session.logoutAll();
  const loggingIn = session.login('usuario@example.com', 'senha-nova');
  await tick();
  assert.deepEqual(events, ['login:1', 'logout-all:start']);
  assert.equal(session.snapshot, null);
  logoutAllGate.resolve();
  await loggingOut;
  await loggingIn;
  assert.deepEqual(events, [
    'login:1',
    'logout-all:start',
    'logout-all:end',
    'login:2',
  ]);
  assert.notEqual(session.snapshot, null);
});

test('recovery revogatória limpa em sucesso e timeout ambíguo', async () => {
  const successfulStore = new MemoryRefreshStore();
  const successfulSession = coordinator(fakeApi({
    async completePasswordRecovery() {},
  }), successfulStore);
  await successfulSession.login('usuario@example.com', 'senha-valida');
  await successfulSession.completePasswordRecovery('E'.repeat(43), 'Nova1234');
  assert.equal(successfulSession.snapshot, null);
  assert.equal(successfulStore.value, null);

  const ambiguousStore = new MemoryRefreshStore();
  const ambiguousSession = coordinator(fakeApi({
    async completeAssistedRecovery() { throw new ApiTransportError(); },
  }), ambiguousStore);
  await ambiguousSession.login('usuario@example.com', 'senha-valida');
  await assert.rejects(
    ambiguousSession.completeAssistedRecovery('F'.repeat(43), 'Nova1234'),
    ApiTransportError,
  );
  assert.equal(ambiguousSession.snapshot, null);
  assert.equal(ambiguousStore.value, null);
});

test('logout durante troca de senha revoga a resposta rotativa atrasada', async () => {
  const changeGate = deferred();
  const api = fakeApi({
    async changePassword() { return changeGate.promise; },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const changing = session.changePassword('senha-valida', 'nova-senha');
  await tick();
  await session.logout();
  changeGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  await assert.rejects(changing, SessionRequiredError);
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
  assert.ok(api.calls.logout.includes(ACCESS_A));
  assert.ok(api.calls.logout.includes(ACCESS_B));
});

test('login enfileirado antes de logout não pode ressuscitar sessão', async () => {
  const refreshGate = deferred();
  const clock = { now: 0 };
  let loginCount = 0;
  const api = fakeApi({
    async login() {
      loginCount += 1;
      return tokenResponse();
    },
    async refresh() { return refreshGate.promise; },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store, clock);
  await session.login('usuario@example.com', 'senha-valida');
  clock.now = 901_000;

  const refreshing = session.authenticated(async () => 'não deve executar');
  await tick();
  const queuedLogin = session.login('usuario@example.com', 'outra-senha');
  await session.logout();
  refreshGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  await assert.rejects(refreshing, SessionRequiredError);
  await assert.rejects(queuedLogin, SessionRequiredError);
  assert.equal(loginCount, 1);
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
});

test('listener defeituoso não impede clear nem outros observadores', async () => {
  const store = new MemoryRefreshStore();
  const session = coordinator(fakeApi(), store);
  const observed = [];
  session.subscribe(() => { throw new Error('listener failure'); });
  session.subscribe((snapshot) => observed.push(snapshot));
  await session.login('usuario@example.com', 'senha-valida');
  await session.logout();

  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
  assert.ok(observed.some((snapshot) => snapshot !== null));
  assert.equal(observed.at(-1), null);
});

test('refresh dentro da troca é compartilhado com chamada concorrente', async () => {
  const refreshGate = deferred();
  const clock = { now: 0 };
  const api = fakeApi({
    async refresh() {
      api.calls.refresh += 1;
      return refreshGate.promise;
    },
    async changePassword() {
      throw apiError(401, 'invalid_credentials');
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store, clock);
  await session.login('usuario@example.com', 'senha-valida');
  clock.now = 901_000;

  const changing = session.changePassword('incorreta', 'nova-senha');
  await tick();
  const reading = session.authenticated(async (accessToken) => accessToken);
  await tick();
  refreshGate.resolve(tokenResponse({
    accessToken: ACCESS_B,
    refreshToken: REFRESH_B,
  }));

  await assert.rejects(
    changing,
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_credentials',
  );
  assert.equal(await reading, ACCESS_B);
  assert.equal(api.calls.refresh, 1);
  assert.equal(store.value, REFRESH_B);
});

test('revalidate inválido limpa sessão e erro 500 preserva indisponível', async () => {
  const invalidStore = new MemoryRefreshStore();
  const invalidSession = coordinator(fakeApi({
    async me() { throw new InvalidBackendResponseError(); },
  }), invalidStore);
  await invalidSession.login('usuario@example.com', 'senha-valida');
  await assert.rejects(invalidSession.revalidate(), SessionRequiredError);
  assert.equal(invalidSession.snapshot, null);
  assert.equal(invalidStore.value, null);

  const unavailableStore = new MemoryRefreshStore();
  const unavailableSession = coordinator(fakeApi({
    async me() { throw apiError(500, 'unexpected_response'); },
  }), unavailableStore);
  await unavailableSession.login('usuario@example.com', 'senha-valida');
  await assert.rejects(
    unavailableSession.revalidate(),
    (error) => error instanceof ApiResponseError && error.status === 500,
  );
  assert.notEqual(unavailableSession.snapshot, null);
  assert.equal(unavailableStore.value, REFRESH_A);

  const rateLimitedStore = new MemoryRefreshStore();
  const rateLimitedSession = coordinator(fakeApi({
    async me() { throw apiError(429, 'rate_limited'); },
  }), rateLimitedStore);
  await rateLimitedSession.login('usuario@example.com', 'senha-valida');
  await assert.rejects(
    rateLimitedSession.revalidate(),
    (error) => error instanceof ApiResponseError && error.status === 429,
  );
  assert.notEqual(rateLimitedSession.snapshot, null);
  assert.equal(rateLimitedStore.value, REFRESH_A);
});

test('401 concorrente reutiliza token já girado em vez de forçar B para C', async () => {
  const firstChangeAttempt = deferred();
  let changeAttempts = 0;
  const api = fakeApi({
    async changePassword() {
      changeAttempts += 1;
      if (changeAttempts === 1) {
        await firstChangeAttempt.promise;
        throw apiError(401, 'invalid_session');
      }
      throw apiError(401, 'invalid_credentials');
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const changing = session.changePassword('incorreta', 'nova-senha');
  await tick();
  const reading = session.authenticated(async (accessToken) => {
    if (accessToken === ACCESS_A) throw apiError(401, 'invalid_session');
    return accessToken;
  });
  await tick();
  firstChangeAttempt.resolve();

  await assert.rejects(
    changing,
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_credentials',
  );
  assert.equal(await reading, ACCESS_B);
  assert.equal(api.calls.refresh, 1);
  assert.equal(store.value, REFRESH_B);
});

test('recovery enfileirada invalida login cuja intenção é anterior', async () => {
  const recoveryGate = deferred();
  let loginCount = 0;
  const api = fakeApi({
    async login() {
      loginCount += 1;
      return tokenResponse();
    },
    async completePasswordRecovery() {
      await recoveryGate.promise;
    },
  });
  const store = new MemoryRefreshStore();
  const session = coordinator(api, store);
  await session.login('usuario@example.com', 'senha-valida');

  const recovering = session.completePasswordRecovery(
    'G'.repeat(43),
    'NovaSenha123',
  );
  await tick();
  const queuedLogin = session.login('usuario@example.com', 'senha-nova');
  recoveryGate.resolve();

  await recovering;
  await assert.rejects(queuedLogin, SessionRequiredError);
  assert.equal(loginCount, 1);
  assert.equal(session.snapshot, null);
  assert.equal(store.value, null);
});
