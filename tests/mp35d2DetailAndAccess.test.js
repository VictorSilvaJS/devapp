const assert = require('node:assert/strict');
const test = require('node:test');

const { ApiResponseError } = require('../.tmp-mp35d2/src/http/backendApi');
const {
  AdministrativeUserDetailController,
  administrativeUserDetailStateForTarget,
} = require('../.tmp-mp35d2/src/http/administrativeUserDetailController');
const {
  AdministrativeUserAccessDeniedError,
  administrativeUserNavigationCapabilities,
  administrativeUserSessionPartition,
  assertAdministrativeUserNavigationAccess,
} = require('../.tmp-mp35d2/src/http/administrativeUserAccess');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d2/src/http/administrativeUserDataBoundary');
const {
  buildAdministrativeUserNavigationDefinition,
  resolveAdministrativeUserNavigationSurface,
} = require('../.tmp-mp35d2/src/http/administrativeUserNavigationDefinition');
const { SessionRequiredError } = require('../.tmp-mp35d2/src/http/sessionCoordinator');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const USER_C = '33333333-3333-4333-8333-333333333333';

function detail(id, overrides = {}) {
  return Object.freeze({
    id,
    organizacao_id: 'org_tche_fertilidade',
    nome: `Usuário ${id.slice(0, 1)}`,
    email: `${id.slice(0, 1)}@example.test`,
    perfil: 'admin',
    status: 'ativo',
    versao: 1,
    telefone: null,
    documento: null,
    observacoes: null,
    criado_em: '2026-08-27T12:00:00.000Z',
    atualizado_em: '2026-08-27T12:00:00.000Z',
    ...overrides,
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

function queuedRepository() {
  const calls = [];
  return {
    calls,
    async list() { throw new Error('não usado'); },
    getById(id) {
      const result = deferred();
      calls.push({ id, result });
      return result.promise;
    },
  };
}

function detailController(repository, partitionKey = 'admin-A') {
  return new AdministrativeUserDetailController(
    repository,
    new AdministrativeUserDataBoundary(partitionKey),
  );
}

function sessionSnapshot(profile, overrides = {}) {
  return Object.freeze({
    id: overrides.sessionId ?? 'session-1',
    usuario: Object.freeze({
      id: overrides.userId ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizacao_id: 'org_tche_fertilidade',
      nome: 'Operador',
      email: 'operador@example.test',
      perfil: profile,
      status: 'ativo',
      versao_autorizacao: overrides.authorizationVersion ?? 1,
    }),
    escopo: Object.freeze({
      modo: profile === 'admin' ? 'organizacao' : 'vinculos_propriedade',
      versao: overrides.scopeVersion ?? 1,
    }),
    emitido_em: '2026-08-27T12:00:00.000Z',
    access_expira_em: '2026-08-27T12:15:00.000Z',
    sessao_expira_inatividade_em: '2026-08-27T13:00:00.000Z',
    sessao_expira_absolutamente_em: '2026-09-03T12:00:00.000Z',
    access_expires_monotonic: 1_000,
  });
}

test('navegação pura concede aba e detalhe somente a Admin e falha fechada', () => {
  const admin = sessionSnapshot('admin');
  assert.deepEqual(administrativeUserNavigationCapabilities(admin), {
    usersTab: true,
    userDetail: true,
  });
  assert.doesNotThrow(() => assertAdministrativeUserNavigationAccess(admin));

  for (const profile of ['produtor', 'colaborador']) {
    const snapshot = sessionSnapshot(profile);
    assert.deepEqual(administrativeUserNavigationCapabilities(snapshot), {
      usersTab: false,
      userDetail: false,
    });
    assert.throws(
      () => assertAdministrativeUserNavigationAccess(snapshot),
      AdministrativeUserAccessDeniedError,
    );
  }
  assert.throws(
    () => assertAdministrativeUserNavigationAccess(null),
    AdministrativeUserAccessDeniedError,
  );
});

test('definição pura complementar registra lista e detalhe somente para Admin', () => {
  const effects = {
    listMounts: 0,
    detailMounts: 0,
    controllerCreations: 0,
    repositoryCalls: 0,
    httpCalls: 0,
  };
  const surfaces = {
    list() {
      effects.listMounts += 1;
      effects.controllerCreations += 1;
      effects.repositoryCalls += 1;
      effects.httpCalls += 1;
    },
    detail() {
      effects.detailMounts += 1;
      effects.controllerCreations += 1;
      effects.repositoryCalls += 1;
      effects.httpCalls += 1;
    },
  };
  const adminDefinition = buildAdministrativeUserNavigationDefinition(
    sessionSnapshot('admin'),
    surfaces,
  );
  assert.equal(adminDefinition.tab.name, 'Users');
  assert.equal(adminDefinition.detail.name, 'AdministrativeUserDetail');
  resolveAdministrativeUserNavigationSurface(adminDefinition, 'Users')();
  resolveAdministrativeUserNavigationSurface(
    adminDefinition,
    'AdministrativeUserDetail',
  )();
  assert.deepEqual(effects, {
    listMounts: 1,
    detailMounts: 1,
    controllerCreations: 2,
    repositoryCalls: 2,
    httpCalls: 2,
  });

  for (const snapshot of [
    sessionSnapshot('produtor'),
    sessionSnapshot('colaborador'),
    null,
  ]) {
    const definition = buildAdministrativeUserNavigationDefinition(
      snapshot,
      surfaces,
    );
    assert.equal(definition.tab, null);
    assert.equal(definition.detail, null);
    assert.throws(
      () => resolveAdministrativeUserNavigationSurface(definition, 'Users'),
      AdministrativeUserAccessDeniedError,
    );
    assert.throws(
      () => resolveAdministrativeUserNavigationSurface(
        definition,
        'AdministrativeUserDetail',
      ),
      AdministrativeUserAccessDeniedError,
    );
  }
  assert.deepEqual(effects, {
    listMounts: 1,
    detailMounts: 1,
    controllerCreations: 2,
    repositoryCalls: 2,
    httpCalls: 2,
  });
});

test('mudança de perfil ou session epoch remove a superfície e troca a partição', () => {
  const admin = sessionSnapshot('admin');
  const producer = sessionSnapshot('produtor');
  const adminPartition = administrativeUserSessionPartition(admin, 7);
  assert.equal(administrativeUserNavigationCapabilities(admin).usersTab, true);
  assert.equal(administrativeUserNavigationCapabilities(producer).usersTab, false);
  assert.notEqual(adminPartition, administrativeUserSessionPartition(producer, 7));
  assert.notEqual(adminPartition, administrativeUserSessionPartition(admin, 8));
});

test('estado projetado do novo ID oculta o detalhe anterior no primeiro frame observável', async () => {
  const repository = queuedRepository();
  const controller = detailController(repository);
  const loadingA = controller.load(USER_A);
  await Promise.resolve();
  repository.calls[0].result.resolve(detail(USER_A, {
    email: 'anterior@example.test',
    documento: 'documento-anterior',
  }));
  await loadingA;
  assert.equal(controller.snapshot.user.id, USER_A);

  const firstStateForB = administrativeUserDetailStateForTarget(
    controller.snapshot,
    USER_B,
    'admin-A',
  );
  assert.equal(firstStateForB.user, null);
  assert.equal(firstStateForB.loadedForUserId, null);
  assert.equal(firstStateForB.loading, true);
  assert.equal(JSON.stringify(firstStateForB).includes('anterior@example.test'), false);
  assert.equal(JSON.stringify(firstStateForB).includes('documento-anterior'), false);

  const loadingB = controller.load(USER_B);
  assert.equal(controller.snapshot.user, null);
  await Promise.resolve();
  repository.calls[1].result.resolve(detail(USER_B));
  await loadingB;
  assert.equal(controller.snapshot.loadedForUserId, USER_B);
  assert.equal(controller.snapshot.user.id, USER_B);
});

test('controlador rejeita ID inválido sem estado, lease ou repositório', async () => {
  const repository = queuedRepository();
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  const controller = new AdministrativeUserDetailController(repository, boundary);
  const beforeState = controller.snapshot;
  const beforeBoundary = boundary.current;
  await assert.rejects(
    controller.load('segmento/com espaço?'),
    (error) => error.code === 'invalid_request' && error.status === 400,
  );
  assert.equal(controller.snapshot, beforeState);
  assert.equal(boundary.current, beforeBoundary);
  assert.equal(repository.calls.length, 0);
});

test('resposta tardia do ID antigo é inerte e somente a resposta do ID atual aparece', async () => {
  const repository = queuedRepository();
  const controller = detailController(repository);
  const loadingA = controller.load(USER_A);
  await Promise.resolve();
  const loadingB = controller.load(USER_B);
  await Promise.resolve();

  repository.calls[0].result.resolve(detail(USER_A));
  await loadingA;
  assert.equal(controller.snapshot.requestedUserId, USER_B);
  assert.equal(controller.snapshot.user, null);

  repository.calls[1].result.resolve(detail(USER_B));
  await loadingB;
  assert.equal(controller.snapshot.loadedForUserId, USER_B);
  assert.equal(controller.snapshot.user.id, USER_B);
});

test('troca B para C com 404 limpa B antes da resposta e nunca o restaura', async () => {
  const repository = queuedRepository();
  const controller = detailController(repository);
  const loadingB = controller.load(USER_B);
  await Promise.resolve();
  repository.calls[0].result.resolve(detail(USER_B));
  await loadingB;

  const loadingC = controller.load(USER_C);
  assert.equal(controller.snapshot.user, null);
  await Promise.resolve();
  repository.calls[1].result.reject(new ApiResponseError({
    status: 404,
    code: 'not_found',
  }));
  await loadingC;
  assert.equal(controller.snapshot.user, null);
  assert.equal(controller.snapshot.loadedForUserId, null);
  assert.equal(controller.snapshot.failure.kind, 'not_found');
});

test('401 e 403 eliminam qualquer detalhe e invalidam a leitura atual', async () => {
  for (const [error, kind] of [
    [new SessionRequiredError(), 'session_expired'],
    [new ApiResponseError({ status: 401, code: 'invalid_session' }), 'session_expired'],
    [new AdministrativeUserAccessDeniedError(), 'forbidden'],
    [new ApiResponseError({ status: 403, code: 'forbidden' }), 'forbidden'],
  ]) {
    const repository = queuedRepository();
    const controller = detailController(repository);
    const loading = controller.load(USER_A);
    await Promise.resolve();
    repository.calls[0].result.reject(error);
    await loading;
    assert.equal(controller.snapshot.user, null);
    assert.equal(controller.snapshot.loadedForUserId, null);
    assert.equal(controller.snapshot.failure.kind, kind);
  }
});

test('troca de identidade durante a leitura limpa e impede publicação tardia', async () => {
  const repository = queuedRepository();
  const controller = detailController(repository, 'admin-A:epoch-1');
  const loading = controller.load(USER_A);
  await Promise.resolve();
  assert.equal(controller.synchronizePartition('produtor-B:epoch-2'), true);
  assert.equal(controller.snapshot.user, null);
  assert.equal(controller.snapshot.requestedUserId, null);
  repository.calls[0].result.resolve(detail(USER_A));
  await loading;
  assert.equal(controller.snapshot.user, null);
  assert.equal(controller.snapshot.partitionKey, 'produtor-B:epoch-2');
});

test('dispose invalida requisição e impede estado ou listener tardio', async () => {
  const repository = queuedRepository();
  const controller = detailController(repository);
  let publications = 0;
  controller.subscribe(() => { publications += 1; });
  const loading = controller.load(USER_A);
  await Promise.resolve();
  const beforeDispose = publications;
  controller.dispose();
  repository.calls[0].result.resolve(detail(USER_A));
  await loading;
  assert.equal(publications, beforeDispose);
  assert.equal(controller.snapshot.user, null);
});
