const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AdministrativeCommandChangedError,
  AdministrativeCommandCoordinator,
  createAdministrativeIntentId,
} = require('../.tmp-mp35d3/src/http/administrativeCommandCoordinator');
const {
  AdministrativeUserCommandLifecycle,
} = require('../.tmp-mp35d3/src/http/administrativeUserCommandLifecycle');
const {
  AdministrativeUserCommandService,
  AdministrativeUserConflictError,
  classifyAdministrativeUserCommandFailure,
  createAdministrativeUserEditModel,
  updateAdministrativeUserEditField,
} = require('../.tmp-mp35d3/src/http/administrativeUserCommands');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d3/src/http/administrativeUserDataBoundary');
const { ApiResponseError } = require('../.tmp-mp35d3/src/http/backendApi');
const { InvalidBackendResponseError } = require('../.tmp-mp35d3/src/http/decoders');
const { ApiTransportError } = require('../.tmp-mp35d3/src/http/httpTransport');
const {
  AdministrativeUserDetailController,
  administrativeUserDetailStateForTarget,
} = require('../.tmp-mp35d3/src/http/administrativeUserDetailController');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCER_ID = '22222222-2222-4222-8222-222222222222';
const INTENT_A = createAdministrativeIntentId(() => '33333333-3333-4333-8333-333333333333');
const ACCESS_TOKEN = 'A'.repeat(43);
global.expo = { uuidv4: require('node:crypto').randomUUID };

// The D-3 script also compiles the real runtime used by the navigation suite.
// Only the native storage module is replaced; session, decoders and wiring are real.
const Module = require('node:module');
const originalLoad = Module._load;
let createRecoveryRuntime;
try {
  Module._load = function(request, parent, isMain) {
    if (request === 'expo-secure-store') return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'test' };
    return originalLoad.call(this, request, parent, isMain);
  };
  createRecoveryRuntime = require('../.tmp-mp35d2-navigation/src/http/runtime').createHttpRuntime;
} finally {
  Module._load = originalLoad;
}
const { AdministrativeUserCommandLifecycle: RecoveryLifecycle } =
  require('../.tmp-mp35d2-navigation/src/http/administrativeUserCommandLifecycle');

async function recoveryFixture() {
  const requests = [];
  const pendingMe = [];
  const pendingReads = [];
  const store = {
    value: null,
    async read() { return this.value; },
    async write(value) { this.value = value; },
    async clear() { this.value = null; },
  };
  const runtime = createRecoveryRuntime({ apiBaseUrl: 'https://api.example.test' }, {
    refreshTokenStore: store,
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
    transport: {
      async send(request) {
        requests.push(request);
        if (request.url.endsWith('/v1/auth/login')) return { status: 200, body: {
          access_token: ACCESS_TOKEN, refresh_token: 'B'.repeat(43), token_type: 'Bearer', expires_in: 900,
          emitido_em: '2026-09-01T12:00:00.000Z', access_expira_em: '2026-09-01T12:15:00.000Z',
          sessao: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            expira_inatividade_em: '2026-09-15T12:00:00.000Z',
            expira_absolutamente_em: '2026-10-01T12:00:00.000Z' },
          usuario: { ...user(), perfil: 'admin', status: 'ativo', versao_autorizacao: 1 },
          escopo: { modo: 'organizacao', versao: 1 },
        } };
        if (request.url.endsWith('/v1/auth/me')) {
          const gate = deferred(); pendingMe.push(gate); return gate.promise;
        }
        if (request.url.endsWith('/v1/auth/logout')) return { status: 204 };
        if (request.method === 'POST') return { status: 201, body: {
          resultado: 'criado', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 1,
        } };
        if (request.url.endsWith(`/v1/usuarios/${USER_ID}`)) {
          const gate = deferred(); pendingReads.push(gate); return gate.promise;
        }
        throw new Error(`HTTP inesperado: ${request.url}`);
      },
    },
  });
  await runtime.session.login('admin@example.test', 'Senha 123');
  const lifecycles = [];
  const context = {
    ...runtime, requests, pendingMe, pendingReads,
    lifecycle() {
      const lifecycle = new RecoveryLifecycle({
        boundary: runtime.administrativeUserData,
        discardIntent: (id) => runtime.administrativeUserCommands.discardIntent(id),
        createIntent: () => createAdministrativeIntentId(() => require('node:crypto').randomUUID()),
      });
      lifecycle.start(); lifecycles.push(lifecycle); return lifecycle;
    },
    identity(overrides = {}) {
      const current = runtime.session.snapshot;
      return { sessao: { id: current.id }, usuario: current.usuario, escopo: current.escopo, ...overrides };
    },
    async revalidate(response) {
      const pending = runtime.session.revalidate();
      const observed = pending.then((value) => ({ value }), (error) => ({ error }));
      await new Promise((resolve) => setImmediate(resolve));
      pendingMe.at(-1).resolve(response ?? { status: 200, body: context.identity() });
      return observed;
    },
    async forbid(lifecycle = context.lifecycle()) {
      const pending = lifecycle.runRead((operation) => runtime.administrativeUserCommands.reloadAdministrativeUser(operation, USER_ID));
      await new Promise((resolve) => setImmediate(resolve));
      pendingReads.at(-1).resolve({ status: 403, body: { error: { code: 'forbidden' } } });
      assert.equal((await pending).current, false);
      assert.equal(runtime.administrativeUserData.current.invalidation, 'forbidden');
      return lifecycle;
    },
    dispose() { for (const lifecycle of lifecycles) lifecycle.dispose(); },
  };
  return context;
}

test('runtime real: dois ciclos 403/revalidação na mesma partição liberam novos comandos/leituras e nunca lifecycles antigos', async () => {
  const context = await recoveryFixture();
  try {
    const boundary = context.administrativeUserData;
    const partition = boundary.current.partitionKey;
    const cancelled = [];
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const old = context.lifecycle();
      const oldLease = old.currentLease;
      await context.forbid(old);
      cancelled.push(old);
      const blocked = context.lifecycle();
      cancelled.push(blocked);
      assert.equal(boundary.synchronizePartition(partition), false);
      let forbiddenCalls = 0;
      await blocked.run(async () => { forbiddenCalls += 1; });
      await blocked.runRead(async () => { forbiddenCalls += 1; });
      assert.equal(forbiddenCalls, 0, 'montagem não restaura autorização');
      assert.equal((await context.revalidate()).error, undefined);
      assert.equal(boundary.current.partitionKey, partition);
      assert.equal(boundary.current.invalidation, null);
      assert.equal(boundary.current.mutation, null);
      assert.equal(boundary.isLeaseCurrent(oldLease), false);
      for (const lifecycle of cancelled) {
        lifecycle.start();
        assert.equal(lifecycle.restartIntent(), false);
        await lifecycle.run(async () => { forbiddenCalls += 1; });
        await lifecycle.runRead(async () => { forbiddenCalls += 1; });
        lifecycle.dispose(); lifecycle.start();
        await lifecycle.run(async () => { forbiddenCalls += 1; });
      }
      assert.equal(forbiddenCalls, 0, 'retomada não revive callbacks/start/remount antigos');
      const next = context.lifecycle();
      const read = next.runRead((operation) => context.administrativeUserCommands.reloadAdministrativeUser(operation, USER_ID));
      await new Promise((resolve) => setImmediate(resolve));
      context.pendingReads.at(-1).resolve({ status: 200, body: user() });
      assert.equal((await read).ok, true);
      const command = next.run((intent, operation) => context.administrativeUserCommands.create(intent, {
        nome: `Nova intenção ${cycle}`, email: `nova${cycle}@example.test`, perfil: 'produtor',
      }, operation));
      await new Promise((resolve) => setImmediate(resolve));
      context.pendingReads.at(-1).resolve({ status: 200, body: user() });
      const commandResult = await command;
      assert.equal(commandResult.ok, true, String(commandResult.error));
      assert.equal(context.requests.filter((request) => request.url.endsWith('/v1/usuarios') && request.method === 'POST').length, cycle + 1);
    }
  } finally { context.dispose(); }
});

for (const failure of ['503', 'transport', 'malformed', 'inactive', 'forbidden', 'produtor', 'colaborador', 'identity']) {
  test(`revalidação ${failure} não retoma acesso administrativo`, async () => {
    const context = await recoveryFixture();
    try {
      const old = await context.forbid();
      const pending = context.session.revalidate();
      const observed = pending.then((value) => ({ value }), (error) => ({ error }));
      await new Promise((resolve) => setImmediate(resolve));
      const gate = context.pendingMe.at(-1);
      const blocked = context.lifecycle();
      let calls = 0;
      await blocked.run(async () => { calls += 1; });
      await blocked.runRead(async () => { calls += 1; });
      assert.equal(calls, 0, 'revalidação pendente');
      const identity = context.identity();
      if (failure === 'transport') gate.reject(new Error('offline'));
      else if (failure === '503') gate.resolve({ status: 503, body: { error: { code: 'service_unavailable' } } });
      else if (failure === 'forbidden') gate.resolve({ status: 403, body: { error: { code: 'forbidden' } } });
      else if (failure === 'malformed') gate.resolve({ status: 200, body: {} });
      else {
        const usuario = { ...identity.usuario };
        let escopo = identity.escopo;
        if (failure === 'inactive') usuario.status = 'inativo';
        else if (failure === 'identity') usuario.id = PRODUCER_ID;
        else { usuario.perfil = failure; escopo = { ...escopo, modo: 'vinculos_propriedade' }; }
        gate.resolve({ status: 200, body: { ...identity, usuario, escopo } });
      }
      const outcome = await observed;
      if (failure === 'produtor' || failure === 'colaborador') assert.equal(outcome.value.usuario.perfil, failure);
      else assert.ok(outcome.error);
      await old.run(async () => { calls += 1; });
      await blocked.runRead(async () => { calls += 1; });
      assert.equal(calls, 0);
      const next = context.lifecycle();
      const creation = await next.run((intent, operation) => context.administrativeUserCommands.create(intent, {
        nome: 'Não autorizado', email: 'negado@example.test', perfil: 'produtor',
      }, operation));
      assert.equal(creation.ok, false);
      assert.equal(context.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/v1/usuarios')).length, 0);
    } finally { context.dispose(); }
  });
}

test('revalidação iniciada antes de uma invalidação mais recente não restaura acesso', async () => {
  const context = await recoveryFixture();
  try {
    const old = await context.forbid();
    const pending = context.session.revalidate();
    await new Promise((resolve) => setImmediate(resolve));
    // Outro 403 observado pela fronteira depois do início desta revalidação.
    const boundary = context.administrativeUserData;
    boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
    const invalidated = boundary.current;
    context.pendingMe.at(-1).resolve({ status: 200, body: context.identity() });
    await pending;
    assert.strictEqual(boundary.current, invalidated);
    assert.equal(old.snapshot.active, false);
    assert.equal((await context.revalidate()).error, undefined);
    assert.equal(boundary.current.invalidation, null);
    assert.equal(old.snapshot.active, false);
  } finally { context.dispose(); }
});

test('resposta /me concorrente antiga não desfaz redução de perfil aceita', async () => {
  for (const lateResponse of ['admin', 'malformed', 'forbidden']) {
    const context = await recoveryFixture();
    try {
      await context.forbid();
      const identity = context.identity();
      const old = context.session.revalidate();
      await new Promise((resolve) => setImmediate(resolve));
      const newer = await context.revalidate({ status: 200, body: {
        ...identity, usuario: { ...identity.usuario, perfil: 'produtor' },
        escopo: { modo: 'vinculos_propriedade', versao: 1 },
      } });
      assert.equal(newer.value.usuario.perfil, 'produtor');
      context.pendingMe[0].resolve(lateResponse === 'forbidden'
        ? { status: 403, body: { error: { code: 'forbidden' } } }
        : { status: 200, body: lateResponse === 'admin' ? identity : {} });
      assert.strictEqual(await old, newer.value, 'resposta descartada preserva a sessão já aceita');
      assert.equal(context.session.snapshot.usuario.perfil, 'produtor');
    } finally { context.dispose(); }
  }
});

for (const profile of ['admin', 'produtor', 'colaborador']) {
  for (const order of ['A-B', 'B-A']) {
    test(`A antes de 403, B=${profile} depois: runtime aceita B com entrega ${order}`, async () => {
      const context = await recoveryFixture();
      try {
        const boundary = context.administrativeUserData;
        const partition = boundary.current.partitionKey;
        const identity = context.identity();
        const a = context.session.revalidate();
        assert.equal(context.pendingMe.length, 1);
        const old = await context.forbid();
        const invalidated = boundary.current;
        const b = context.session.revalidate();
        assert.equal(context.pendingMe.length, 2);
        if (order === 'A-B') {
          context.pendingMe[0].resolve({ status: 200, body: identity });
          await a;
          assert.strictEqual(boundary.current, invalidated, 'A não restaura acesso após o 403');
        }
        context.pendingMe[1].resolve({ status: 200, body: {
          ...identity, usuario: { ...identity.usuario, perfil: profile },
          escopo: { ...identity.escopo, modo: profile === 'admin' ? 'organizacao' : 'vinculos_propriedade' },
        } });
        assert.equal((await b).usuario.perfil, profile);
        const afterB = boundary.current;
        if (order === 'B-A') {
          context.pendingMe[0].resolve({ status: 200, body: identity });
          await a;
          assert.strictEqual(boundary.current, afterB, 'A tardia não publica nem restaura Admin');
        }
        assert.equal(context.session.snapshot.usuario.perfil, profile);
        assert.equal(old.snapshot.active, false);
        let oldCalls = 0;
        await old.run(async () => { oldCalls += 1; });
        await old.runRead(async () => { oldCalls += 1; });
        assert.equal(oldCalls, 0);
        assert.equal(boundary.current.mutation, null);
        if (profile === 'admin') {
          assert.equal(boundary.current.partitionKey, partition);
          assert.equal(boundary.current.invalidation, null);
          const next = context.lifecycle();
          assert.equal((await next.run(async () => 'novo comando')).value, 'novo comando');
          assert.equal((await next.runRead(async () => 'nova leitura')).value, 'nova leitura');
        } else {
          assert.notEqual(boundary.current.partitionKey, partition);
          assert.equal(boundary.current.invalidation, 'partition_changed');
          const next = context.lifecycle();
          const outcome = await next.run((intent, operation) => context.administrativeUserCommands.create(intent, {
            nome: 'Negado', email: 'negado@example.test', perfil: 'produtor',
          }, operation));
          assert.equal(outcome.ok, false);
          assert.equal(context.requests.some((request) => request.url.endsWith('/v1/usuarios')), false);
        }
        assert.equal(context.pendingMe.length, 2, 'sem terceira revalidação');
      } finally { context.dispose(); }
    });
  }
}

test('invalidação posterior à captura de B impede retomada mesmo com duas respostas Admin', async () => {
  const context = await recoveryFixture();
  try {
    const identity = context.identity();
    const a = context.session.revalidate();
    const old = await context.forbid();
    const b = context.session.revalidate();
    const boundary = context.administrativeUserData;
    boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
    const invalidated = boundary.current;
    context.pendingMe[0].resolve({ status: 200, body: identity }); await a;
    context.pendingMe[1].resolve({ status: 200, body: identity }); await b;
    assert.strictEqual(boundary.current, invalidated);
    assert.equal(old.snapshot.active, false);
    assert.equal(context.lifecycle().snapshot.active, false);
    assert.equal(context.pendingMe.length, 2);
  } finally { context.dispose(); }
});

test('troca de identidade ou dispose durante /me mantém callbacks e leases antigos inertes', async () => {
  for (const interruption of ['login', 'dispose']) {
    const context = await recoveryFixture();
    try {
      const old = await context.forbid();
      const identity = context.identity();
      const pending = context.session.revalidate().then((value) => ({ value }), (error) => ({ error }));
      await new Promise((resolve) => setImmediate(resolve));
      if (interruption === 'login') await context.session.login('admin@example.test', 'Senha 123');
      else old.dispose();
      context.pendingMe[0].resolve({ status: 200, body: identity });
      const result = await pending;
      if (interruption === 'login') assert.ok(result.error);
      let calls = 0;
      await old.run(async () => { calls += 1; });
      await old.runRead(async () => { calls += 1; });
      assert.equal(calls, 0);
      assert.equal(old.snapshot.active, false);
    } finally { context.dispose(); }
  }
});

function user(overrides = {}) {
  return {
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: PRODUCER_ID,
    nome: 'Usuário A',
    email: 'a@example.test',
    perfil: 'produtor',
    status: 'pendente',
    telefone: null,
    documento: null,
    observacoes: null,
    versao: 1,
    criado_em: '2026-09-01T12:00:00.000Z',
    atualizado_em: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function currentSession() {
  return {
    snapshot: {
      id: 'session-A',
      usuario: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        organizacao_id: 'org_tche_fertilidade',
        perfil: 'admin',
        status: 'ativo',
        versao_autorizacao: 1,
      },
      escopo: { modo: 'organizacao', versao: 1 },
    },
    authenticated(operation) { return operation(ACCESS_TOKEN); },
    async revalidate() { return this.snapshot; },
  };
}

test('construtor é puro; start/dispose são idempotentes e remount recebe lease distinto', () => {
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  const lifecycle = new AdministrativeUserCommandLifecycle({
    boundary,
    discardIntent: () => true,
    createIntent: () => INTENT_A,
  });
  assert.equal(boundary.activeSubscriptionCount, 0);
  assert.equal(lifecycle.snapshot.active, false);
  assert.equal(lifecycle.start(), true);
  assert.equal(lifecycle.start(), false);
  assert.equal(boundary.activeSubscriptionCount, 1);
  const firstLease = lifecycle.currentLease;
  lifecycle.dispose();
  lifecycle.dispose();
  assert.equal(boundary.activeSubscriptionCount, 0);
  assert.equal(boundary.isLeaseCurrent(firstLease), false);
  assert.equal(lifecycle.start(), true);
  const secondLease = lifecycle.currentLease;
  assert.notStrictEqual(secondLease, firstLease);
  assert.equal(boundary.isLeaseCurrent(secondLease), true);
  assert.equal(boundary.activeSubscriptionCount, 1);
  lifecycle.dispose();
  assert.equal(boundary.activeSubscriptionCount, 0);
});

test('nenhum submit inicia antes de start', async () => {
  const lifecycle = new AdministrativeUserCommandLifecycle({
    boundary: new AdministrativeUserDataBoundary('admin-A'),
    discardIntent: () => true,
    createIntent: () => INTENT_A,
  });
  let calls = 0;
  const outcome = await lifecycle.run(async () => { calls += 1; });
  assert.deepEqual(outcome, { current: false, leader: false, ok: false });
  assert.equal(calls, 0);
});

test('reconciliação falha limpa detalhe e leitura antiga sem inventar carregamento', async () => {
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  const oldRead = deferred();
  let reads = 0;
  const controller = new AdministrativeUserDetailController({
    getById() {
      reads += 1;
      return reads === 1 ? Promise.resolve(user()) : oldRead.promise;
    },
  }, boundary);
  const unsubscribe = controller.subscribe(() => {});
  try {
    await controller.load(USER_ID);
    const pending = controller.load(USER_ID);
    await Promise.resolve();
    boundary.invalidateReconciliation(boundary.issueLease());
    const cleared = controller.snapshot;
    assert.equal(cleared.requestedUserId, USER_ID);
    assert.equal(cleared.loadedForUserId, null);
    assert.equal(cleared.user, null);
    assert.equal(cleared.loading, false);
    assert.equal(cleared.failure.kind, 'unavailable');
    assert.strictEqual(
      administrativeUserDetailStateForTarget(cleared, USER_ID, 'admin-A'),
      cleared,
    );
    oldRead.resolve(user({ versao: 1 }));
    await pending;
    assert.strictEqual(controller.snapshot, cleared);
    boundary.publishAuthoritativeUser(boundary.issueLease(), user({ versao: 3 }));
    assert.equal(controller.snapshot.user.versao, 3);
    assert.equal(controller.snapshot.failure, null);
    assert.equal(controller.snapshot.loading, false);
    assert.equal(reads, 2, 'a publicação reconciliada não inicia um GET adicional');
    boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
    assert.equal(controller.snapshot.requestedUserId, null);
    assert.equal(controller.snapshot.user, null);
    assert.equal(controller.snapshot.failure.kind, 'forbidden');
  } finally {
    oldRead.resolve(user());
    unsubscribe();
    controller.dispose();
  }
  assert.equal(boundary.activeSubscriptionCount, 0);
});

const COMMANDS = [
  {
    name: 'create', outcome: 'criado',
    run: (service, intent, context) => service.create(
      intent,
      { nome: 'Usuário A', email: 'a@example.test', perfil: 'produtor' },
      context,
    ),
  },
  {
    name: 'edit', outcome: 'atualizado',
    run: (service, intent, context) => {
      const baseline = user();
      const model = updateAdministrativeUserEditField(
        createAdministrativeUserEditModel(baseline),
        'nome',
        'Operador',
      );
      return service.update(intent, baseline, model, context);
    },
  },
  {
    name: 'status', outcome: 'status_alterado',
    run: (service, intent, context) => service.changeStatus(
      intent,
      user({ status: 'ativo' }),
      { motivo: 'fim_relacao' },
      context,
    ),
  },
  {
    name: 'invitation', outcome: 'convite_emitido',
    run: (service, intent, context) => service.issueInvitation(intent, user(), context),
  },
];

test('dispose durante releitura torna resposta tardia inerte nos quatro comandos', async () => {
  for (const command of COMMANDS) {
    const boundary = new AdministrativeUserDataBoundary('admin-A');
    const session = currentSession();
    const coordinator = new AdministrativeCommandCoordinator({
      session,
      createKey: () => 'admin_44444444444444448444444444444444',
    });
    const read = deferred();
    let mutations = 0;
    let reads = 0;
    const mutation = async () => {
      mutations += 1;
      return {
        resultado: command.outcome,
        recurso_tipo: 'usuario',
        recurso_id: USER_ID,
        versao: 2,
      };
    };
    const api = {
      createAdministrativeUser: mutation,
      updateAdministrativeUser: mutation,
      changeAdministrativeUserStatus: mutation,
      issueAdministrativeUserInvitation: mutation,
      getAdministrativeUser() { reads += 1; return read.promise; },
    };
    const service = new AdministrativeUserCommandService({ api, session, coordinator, boundary });
    const oldLifecycle = new AdministrativeUserCommandLifecycle({
      boundary,
      discardIntent: (intent) => service.discardIntent(intent),
      createIntent: () => INTENT_A,
    });
    let oldListenerCalls = 0;
    oldLifecycle.subscribe(() => { oldListenerCalls += 1; });
    oldLifecycle.start();
    const oldLease = oldLifecycle.currentLease;
    const pending = oldLifecycle.run((intent, context) => command.run(service, intent, context));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(mutations, 1, command.name);
    assert.equal(reads, 1, command.name);
    oldLifecycle.dispose();
    const callsAtDispose = oldListenerCalls;
    assert.equal(boundary.isLeaseCurrent(oldLease), false);

    const newLifecycle = new AdministrativeUserCommandLifecycle({
      boundary,
      discardIntent: () => true,
      createIntent: () => INTENT_A,
    });
    newLifecycle.start();
    const newLease = newLifecycle.currentLease;
    assert.notStrictEqual(newLease, oldLease);
    assert.equal(boundary.publishAuthoritativeUser(newLease, user({ nome: 'Novo formulário', versao: 3 })), true);
    read.resolve(user({ nome: 'Resposta antiga', versao: 2 }));
    assert.deepEqual(await pending, { current: false, leader: true, ok: false });
    assert.equal(boundary.current.mutation.user.nome, 'Novo formulário');
    assert.equal(oldListenerCalls, callsAtDispose);
    newLifecycle.dispose();
    assert.equal(boundary.activeSubscriptionCount, 0);
  }
});

test('dispose durante mutação impede GET e publicação nos quatro comandos', async () => {
  for (const command of COMMANDS) {
    const boundary = new AdministrativeUserDataBoundary('admin-A');
    const session = currentSession();
    const coordinator = new AdministrativeCommandCoordinator({
      session,
      createKey: () => 'admin_44444444444444448444444444444444',
    });
    const mutationGate = deferred();
    let reads = 0;
    const mutation = () => mutationGate.promise;
    const api = {
      createAdministrativeUser: mutation,
      updateAdministrativeUser: mutation,
      changeAdministrativeUserStatus: mutation,
      issueAdministrativeUserInvitation: mutation,
      async getAdministrativeUser() { reads += 1; return user({ versao: 2 }); },
    };
    const service = new AdministrativeUserCommandService({ api, session, coordinator, boundary });
    const lifecycle = new AdministrativeUserCommandLifecycle({
      boundary,
      discardIntent: (intent) => service.discardIntent(intent),
      createIntent: () => INTENT_A,
    });
    lifecycle.start();
    const pending = lifecycle.run((intent, context) => command.run(service, intent, context));
    await new Promise((resolve) => setImmediate(resolve));
    lifecycle.dispose();
    mutationGate.resolve({
      resultado: command.outcome,
      recurso_tipo: 'usuario',
      recurso_id: USER_ID,
      versao: 2,
    });
    assert.deepEqual(await pending, { current: false, leader: true, ok: false });
    assert.equal(reads, 0, command.name);
    assert.equal(boundary.current.mutation, null);
  }
});

test('mudança de identidade/session epoch invalida resposta antiga em cada comando', async () => {
  for (const command of COMMANDS) {
    const boundary = new AdministrativeUserDataBoundary('admin-A');
    const session = currentSession();
    const coordinator = new AdministrativeCommandCoordinator({
      session,
      createKey: () => 'admin_44444444444444448444444444444444',
    });
    coordinator.synchronizeSession(session.snapshot, 1);
    const read = deferred();
    const mutation = async () => ({
      resultado: command.outcome,
      recurso_tipo: 'usuario',
      recurso_id: USER_ID,
      versao: 2,
    });
    const api = {
      createAdministrativeUser: mutation,
      updateAdministrativeUser: mutation,
      changeAdministrativeUserStatus: mutation,
      issueAdministrativeUserInvitation: mutation,
      getAdministrativeUser: () => read.promise,
    };
    const service = new AdministrativeUserCommandService({ api, session, coordinator, boundary });
    const lifecycle = new AdministrativeUserCommandLifecycle({
      boundary,
      discardIntent: (intent) => service.discardIntent(intent),
      createIntent: () => INTENT_A,
    });
    lifecycle.start();
    const pending = lifecycle.run((intent, context) => command.run(service, intent, context));
    await new Promise((resolve) => setImmediate(resolve));
    coordinator.synchronizeSession(session.snapshot, 2);
    boundary.synchronizePartition('admin-epoch-2');
    read.resolve(user({ nome: 'Resposta da sessão antiga', versao: 2 }));
    assert.deepEqual(await pending, { current: false, leader: true, ok: false });
    assert.equal(boundary.current.mutation, null);
    assert.equal(boundary.current.invalidation, 'partition_changed');
    lifecycle.dispose();
  }
});

test('dispose após recibo e antes do GET evita releitura desnecessária', async () => {
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  const lifecycle = new AdministrativeUserCommandLifecycle({
    boundary,
    discardIntent: () => true,
    createIntent: () => INTENT_A,
  });
  lifecycle.start();
  const receipt = deferred();
  let reads = 0;
  const pending = lifecycle.run(async (_intent, context) => {
    await receipt.promise;
    if (!context.isCurrent()) return 'cancelled-before-read';
    reads += 1;
    return 'read';
  });
  await Promise.resolve();
  lifecycle.dispose();
  receipt.resolve();
  assert.equal((await pending).current, false);
  assert.equal(reads, 0);
});

test('classificador diferencia conflitos relidos, falhas de reload e não ecoa backend', () => {
  const original = new ApiResponseError({
    status: 409,
    code: 'version_conflict',
    details: [{ field: 'versao', current_version: 9 }],
  });
  for (const [outcome, reloadRequired] of [
    ['version_conflict_reloaded', false],
    ['version_conflict_reload_failed', true],
    ['business_rule_conflict_reloaded', false],
    ['business_rule_conflict_reload_failed', true],
  ]) {
    const classified = classifyAdministrativeUserCommandFailure('edit', new AdministrativeUserConflictError({
      outcome,
      original,
      ...(reloadRequired ? { reloadError: new ApiTransportError() } : { reloadedUser: user({ versao: 9 }) }),
    }));
    assert.equal(classified.kind, outcome);
    assert.equal(classified.reloadRequired, reloadRequired);
    assert.equal(classified.preserveDraft, true);
  }

  const injected = 'MENSAGEM_INTERNA_QUE_NAO_PODE_VAZAR';
  const validation = classifyAdministrativeUserCommandFailure('create', new ApiResponseError({
    status: 422,
    code: 'validation_error',
    details: [
      { field: 'email', code: 'invalid_format', message: injected },
      { field: 'motivo', code: 'invalid_value', message: injected },
    ],
  }));
  assert.deepEqual(validation.fieldErrors, { email: 'Revise o e-mail informado.' });
  assert.equal(JSON.stringify(validation).includes(injected), false);

  const changed = classifyAdministrativeUserCommandFailure('edit', new AdministrativeCommandChangedError());
  assert.equal(changed.reviewRequired, true);
  const ambiguous = classifyAdministrativeUserCommandFailure('edit', new InvalidBackendResponseError());
  assert.equal(ambiguous.retrySameIntent, true);
});
