const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApiResponseError,
  InvalidApiRequestError,
} = require('../.tmp-mp35d2/src/http/backendApi');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d2/src/http/administrativeUserDataBoundary');
const {
  AdministrativeUserListController,
} = require('../.tmp-mp35d2/src/http/administrativeUserListController');
const {
  AdministrativeUserDetailController,
} = require('../.tmp-mp35d2/src/http/administrativeUserDetailController');
const {
  InvalidBackendResponseError,
} = require('../.tmp-mp35d2/src/http/decoders');
const {
  ApiTransportError,
} = require('../.tmp-mp35d2/src/http/httpTransport');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function listUser(id, overrides = {}) {
  return Object.freeze({
    id,
    nome: `Usuário ${id.slice(0, 1)}`,
    email: `${id.slice(0, 1)}@example.test`,
    perfil: 'admin',
    status: 'ativo',
    versao: 1,
    ...overrides,
  });
}

function detailUser(id, overrides = {}) {
  return Object.freeze({
    ...listUser(id),
    organizacao_id: 'org_tche_fertilidade',
    telefone: null,
    documento: `documento-${id.slice(0, 1)}`,
    observacoes: null,
    criado_em: '2026-08-27T12:00:00.000Z',
    atualizado_em: '2026-08-27T12:00:00.000Z',
    ...overrides,
  });
}

function page(items, cursor = null) {
  return Object.freeze({
    itens: Object.freeze(items),
    paginacao: Object.freeze({ proximo_cursor: cursor }),
  });
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

function controlledRepository() {
  const listCalls = [];
  const detailCalls = [];
  return {
    listCalls,
    detailCalls,
    list(filters, lease) {
      const result = deferred();
      listCalls.push({ filters, lease, result });
      return result.promise;
    },
    getById(id, lease) {
      const result = deferred();
      detailCalls.push({ id, lease, result });
      return result.promise;
    },
  };
}

async function nextMicrotask() {
  await Promise.resolve();
}

async function seedBoth(repository, list, detail) {
  const listLoad = list.loadInitial();
  repository.listCalls.at(-1).result.resolve(page([listUser(USER_A)], 'cursor-A'));
  await listLoad;
  const detailLoad = detail.load(USER_A);
  await nextMicrotask();
  repository.detailCalls.at(-1).result.resolve(detailUser(USER_A, {
    email: 'anterior@example.test',
    documento: 'documento-anterior',
  }));
  await detailLoad;
}

function sharedControllers() {
  const repository = controlledRepository();
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  return {
    repository,
    boundary,
    list: new AdministrativeUserListController(repository, boundary),
    detail: new AdministrativeUserDetailController(repository, boundary),
  };
}

function assertNoAdministrativeData(list, detail) {
  assert.deepEqual(list.snapshot.items, []);
  assert.equal(list.snapshot.nextCursor, null);
  assert.equal(detail.snapshot.user, null);
  assert.equal(detail.snapshot.loadedForUserId, null);
  const serialized = JSON.stringify({ list: list.snapshot, detail: detail.snapshot });
  assert.equal(serialized.includes('anterior@example.test'), false);
  assert.equal(serialized.includes('documento-anterior'), false);
}

test('403 no detalhe limpa sincronamente detalhe, lista, cursor e geração compartilhada', async () => {
  const context = sharedControllers();
  await seedBoth(context.repository, context.list, context.detail);
  const generation = context.boundary.current.generation;

  const denied = context.detail.load(USER_B);
  await nextMicrotask();
  context.repository.detailCalls.at(-1).result.reject(
    new ApiResponseError({ status: 403, code: 'forbidden' }),
  );
  await denied;

  assertNoAdministrativeData(context.list, context.detail);
  assert.equal(context.boundary.current.generation, generation + 1);
  assert.equal(context.list.snapshot.failure.kind, 'forbidden');
  assert.equal(context.detail.snapshot.failure.kind, 'forbidden');
});

test('403 na lista e 401 em qualquer superfície limpam as duas projeções', async () => {
  for (const [origin, error, expectedKind] of [
    ['list', new ApiResponseError({ status: 403, code: 'forbidden' }), 'forbidden'],
    ['list', new ApiResponseError({ status: 401, code: 'invalid_session' }), 'session_expired'],
    ['detail', new ApiResponseError({ status: 401, code: 'invalid_session' }), 'session_expired'],
  ]) {
    const context = sharedControllers();
    await seedBoth(context.repository, context.list, context.detail);
    if (origin === 'list') {
      const refresh = context.list.refresh();
      context.repository.listCalls.at(-1).result.reject(error);
      await refresh;
    } else {
      const load = context.detail.load(USER_B);
      await nextMicrotask();
      context.repository.detailCalls.at(-1).result.reject(error);
      await load;
    }
    assertNoAdministrativeData(context.list, context.detail);
    assert.equal(context.list.snapshot.failure.kind, expectedKind);
    assert.equal(context.detail.snapshot.failure.kind, expectedKind);
  }
});

test('respostas anteriores à invalidação não restauram lista, detalhe ou cursor', async () => {
  const context = sharedControllers();
  await seedBoth(context.repository, context.list, context.detail);
  const refresh = context.list.refresh();
  const detailLoad = context.detail.load(USER_B);
  await nextMicrotask();

  const accessLease = context.boundary.issueLease();
  assert.equal(context.boundary.invalidateAccess(accessLease, 'forbidden'), true);
  assertNoAdministrativeData(context.list, context.detail);

  context.repository.listCalls.at(-1).result.resolve(page([listUser(USER_B)], 'cursor-B'));
  context.repository.detailCalls.at(-1).result.resolve(detailUser(USER_B));
  await Promise.all([refresh, detailLoad]);
  assertNoAdministrativeData(context.list, context.detail);
});

test('revalidação do mesmo Admin não revive dados; somente novas leituras repopulam', async () => {
  const context = sharedControllers();
  await seedBoth(context.repository, context.list, context.detail);
  context.boundary.invalidateAccess(context.boundary.issueLease(), 'forbidden');
  assertNoAdministrativeData(context.list, context.detail);
  assert.equal(context.boundary.synchronizePartition('admin-A'), false);
  assertNoAdministrativeData(context.list, context.detail);

  const listReload = context.list.loadInitial();
  context.repository.listCalls.at(-1).result.resolve(page([listUser(USER_B)]));
  const detailReload = context.detail.load(USER_B);
  await nextMicrotask();
  context.repository.detailCalls.at(-1).result.resolve(detailUser(USER_B));
  await Promise.all([listReload, detailReload]);
  assert.deepEqual(context.list.snapshot.items.map((item) => item.id), [USER_B]);
  assert.equal(context.detail.snapshot.user.id, USER_B);
});

test('refresh falho limpa itens, cursor e histórico para todas as classes de erro', async () => {
  for (const error of [
    new ApiTransportError(),
    new ApiResponseError({ status: 503, code: 'service_unavailable' }),
    new InvalidBackendResponseError(),
    new InvalidApiRequestError(),
    new Error('falha não classificada'),
  ]) {
    const context = sharedControllers();
    const initial = context.list.loadInitial();
    context.repository.listCalls[0].result.resolve(page([listUser(USER_A)], 'cursor-A'));
    await initial;
    const refresh = context.list.refresh();
    assert.deepEqual(context.list.snapshot.items.map((item) => item.id), [USER_A]);
    context.repository.listCalls[1].result.reject(error);
    await refresh;
    assert.deepEqual(context.list.snapshot.items, []);
    assert.equal(context.list.snapshot.nextCursor, null);
    await context.list.loadMore();
    assert.equal(context.repository.listCalls.length, 2);
  }
});

test('invalidação no mesmo turno impede loadMore e detalhe antes do repositório', async () => {
  const context = sharedControllers();
  const initial = context.list.loadInitial();
  context.repository.listCalls[0].result.resolve(page([listUser(USER_A)], 'cursor-A'));
  await initial;

  const more = context.list.loadMore();
  context.list.synchronizePartition('admin-B');
  await more;
  assert.equal(context.repository.listCalls.length, 1);
  assert.deepEqual(context.list.snapshot.items, []);

  const detailLoad = context.detail.load(USER_A);
  context.detail.synchronizePartition('admin-C');
  await detailLoad;
  assert.equal(context.repository.detailCalls.length, 0);
  assert.equal(context.detail.snapshot.user, null);
});

test('dispose antes da microtask faz zero repositório e remove inscrição', async () => {
  const repository = controlledRepository();
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  const detail = new AdministrativeUserDetailController(repository, boundary);
  let publications = 0;
  detail.subscribe(() => { publications += 1; });
  const load = detail.load(USER_A);
  const beforeDispose = publications;
  detail.dispose();
  await load;
  assert.equal(repository.detailCalls.length, 0);
  boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
  assert.equal(publications, beforeDispose);
  assert.equal(detail.snapshot.user, null);
});

test('lease inicial não atravessa invalidação anterior à restauração', () => {
  const boundary = new AdministrativeUserDataBoundary();
  const lease = boundary.issueLease({ allowInitialRestore: true });
  assert.equal(boundary.invalidateAccess(lease, 'invalid_session'), true);
  assert.equal(boundary.synchronizePartition('admin-restaurado'), true);
  assert.equal(
    boundary.resolveAfterInitialRestore(lease, 'admin-restaurado'),
    null,
  );
});
