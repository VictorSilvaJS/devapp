const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApiResponseError,
  InvalidApiRequestError,
} = require('../.tmp-mp35d2/src/http/backendApi');
const {
  AdministrativeUserListController,
  administrativeUserEmptyState,
  classifyAdministrativeUserReadFailure,
  mergeAdministrativeUsers,
} = require('../.tmp-mp35d2/src/http/administrativeUserListController');
const {
  AdministrativeUserAccessDeniedError,
} = require('../.tmp-mp35d2/src/http/administrativeUserRepository');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d2/src/http/administrativeUserDataBoundary');
const { InvalidBackendResponseError } = require('../.tmp-mp35d2/src/http/decoders');
const { ApiTransportError } = require('../.tmp-mp35d2/src/http/httpTransport');
const { SessionRequiredError } = require('../.tmp-mp35d2/src/http/sessionCoordinator');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const USER_C = '33333333-3333-4333-8333-333333333333';

function user(id, overrides = {}) {
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

function queuedRepository() {
  const calls = [];
  return {
    calls,
    list(filters) {
      const result = deferred();
      calls.push({ filters, result });
      return result.promise;
    },
    async getById() { throw new Error('não usado'); },
  };
}

function nextMicrotask() {
  return Promise.resolve();
}

function listController(repository, initialFilters = { limite: 50 }, partitionKey = 'admin-A') {
  return new AdministrativeUserListController(
    repository,
    new AdministrativeUserDataBoundary(partitionKey),
    initialFilters,
  );
}

test('ensureInitialLoad inicia uma vez com fronteira já sincronizada e coalesce efeitos', async () => {
  const repository = queuedRepository();
  const boundary = new AdministrativeUserDataBoundary('admin-pronto');
  const controller = new AdministrativeUserListController(
    repository,
    boundary,
  );
  assert.equal(controller.snapshot.loading, false);

  const first = controller.ensureInitialLoad();
  const repeated = controller.ensureInitialLoad();
  assert.equal(first, repeated);
  assert.equal(repository.calls.length, 0);
  await nextMicrotask();
  assert.equal(repository.calls.length, 1);
  assert.equal(controller.snapshot.loading, true);
  repository.calls[0].result.resolve(page([]));
  await first;
  assert.equal(controller.snapshot.loading, false);
  assert.deepEqual(controller.snapshot.items, []);

  await controller.ensureInitialLoad();
  assert.equal(repository.calls.length, 1);
});

test('ensureInitialLoad falho encerra loading e permite retry explícito', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.ensureInitialLoad();
  await nextMicrotask();
  repository.calls[0].result.reject(new ApiTransportError());
  await initial;
  assert.equal(controller.snapshot.loading, false);
  assert.equal(controller.snapshot.failure.kind, 'unavailable');
  assert.equal(controller.snapshot.failure.retryable, true);

  const retry = controller.retry();
  repository.calls[1].result.resolve(page([user(USER_A)]));
  await retry;
  assert.equal(controller.snapshot.loading, false);
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
});

test('mudança de partição limpa e habilita uma única nova carga inicial', async () => {
  const repository = queuedRepository();
  const controller = listController(repository, { limite: 50 }, 'admin-A');
  const initial = controller.ensureInitialLoad();
  await nextMicrotask();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
  await initial;

  assert.equal(controller.synchronizePartition('admin-B'), true);
  assert.equal(controller.snapshot.loading, false);
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);
  const changed = controller.ensureInitialLoad();
  const repeated = controller.ensureInitialLoad();
  assert.equal(changed, repeated);
  await nextMicrotask();
  assert.equal(repository.calls.length, 2);
  repository.calls[1].result.resolve(page([user(USER_B)]));
  await changed;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_B]);
});

test('remontagem cria uma nova leitura definida, sem duplicar dentro de cada montagem', async () => {
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  for (let mount = 0; mount < 2; mount += 1) {
    const repository = queuedRepository();
    const controller = new AdministrativeUserListController(repository, boundary);
    const first = controller.ensureInitialLoad();
    const repeated = controller.ensureInitialLoad();
    assert.equal(first, repeated);
    await nextMicrotask();
    assert.equal(repository.calls.length, 1);
    repository.calls[0].result.resolve(page([]));
    await first;
    controller.dispose();
  }
});

test('dispose antes da microtask da carga inicial produz zero repositório', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.ensureInitialLoad();
  controller.dispose();
  await initial;
  assert.equal(repository.calls.length, 0);
  assert.equal(controller.snapshot.loading, false);
});

test('página inicial e carregar mais deduplicam por ID e preservam ordem', async () => {
  const repository = queuedRepository();
  const controller = listController(repository, { limite: 2 });

  const initial = controller.loadInitial();
  assert.deepEqual(repository.calls[0].filters, { limite: 2 });
  repository.calls[0].result.resolve(page([
    user(USER_A),
    user(USER_A, { nome: 'duplicado' }),
    user(USER_B),
  ], 'opaque +/='));
  await initial;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A, USER_B]);
  assert.equal(controller.snapshot.nextCursor, 'opaque +/=');

  const more = controller.loadMore();
  await nextMicrotask();
  assert.deepEqual(repository.calls[1].filters, {
    limite: 2,
    cursor: 'opaque +/=',
  });
  repository.calls[1].result.resolve(page([
    user(USER_B, { nome: 'antigo deve prevalecer' }),
    user(USER_C),
    user(USER_C),
  ]));
  await more;

  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [
    USER_A,
    USER_B,
    USER_C,
  ]);
  assert.equal(controller.snapshot.items[1].nome, `Usuário ${USER_B.slice(0, 1)}`);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(Object.isFrozen(controller.snapshot.items), true);
});

test('mudança de filtros reinicia paginação e resposta antiga não substitui estado novo', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const oldRequest = controller.loadInitial();
  const newRequest = controller.setFilters({
    busca: 'Ana & Filhos',
    perfil: 'produtor',
    status: 'pendente',
    limite: 10,
    cursor: 'cursor que deve ser descartado',
  });

  assert.deepEqual(controller.snapshot.filters, {
    limite: 10,
    busca: 'Ana & Filhos',
    perfil: 'produtor',
    status: 'pendente',
  });
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(controller.snapshot.loading, true);
  assert.deepEqual(repository.calls[1].filters, controller.snapshot.filters);

  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-antigo'));
  await oldRequest;
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);

  repository.calls[1].result.resolve(page([
    user(USER_C, { perfil: 'produtor', status: 'pendente' }),
  ], 'cursor-novo'));
  await newRequest;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_C]);
  assert.equal(controller.snapshot.nextCursor, 'cursor-novo');
  assert.equal(controller.snapshot.loading, false);
});

test('mesmos filtros não disparam nova leitura e limite participa da identidade', async () => {
  const repository = queuedRepository();
  const controller = listController(repository, {
    busca: 'Ana',
    limite: 20,
  });
  await controller.setFilters({ busca: 'Ana', limite: 20, cursor: 'ignorado' });
  assert.equal(repository.calls.length, 0);

  const changed = controller.setFilters({ busca: 'Ana', limite: 30 });
  assert.equal(repository.calls.length, 1);
  repository.calls[0].result.resolve(page([]));
  await changed;
});

test('falha da próxima página preserva itens, cursor e oferece repetição explícita', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-2'));
  await initial;

  const failedMore = controller.loadMore();
  await nextMicrotask();
  repository.calls[1].result.reject(new ApiTransportError());
  await failedMore;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
  assert.equal(controller.snapshot.nextCursor, 'cursor-2');
  assert.equal(controller.snapshot.nextPageFailure.kind, 'unavailable');
  assert.equal(controller.snapshot.loadingMore, false);

  const retry = controller.loadMore();
  await nextMicrotask();
  assert.equal(repository.calls[2].filters.cursor, 'cursor-2');
  repository.calls[2].result.resolve(page([user(USER_B)]));
  await retry;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A, USER_B]);
  assert.equal(controller.snapshot.nextPageFailure, null);
});

test('loadMore não transitório preserva itens confirmados e encerra cursor', async () => {
  for (const error of [
    new InvalidApiRequestError(),
    new InvalidBackendResponseError(),
    new ApiResponseError({ status: 422, code: 'validation_error' }),
  ]) {
    const repository = queuedRepository();
    const controller = listController(repository);
    const initial = controller.loadInitial();
    repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-definitivo'));
    await initial;
    const more = controller.loadMore();
    await nextMicrotask();
    repository.calls[1].result.reject(error);
    await more;
    assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
    assert.equal(controller.snapshot.nextCursor, null);
    assert.equal(controller.snapshot.nextPageFailure.retryable, false);
    await controller.loadMore();
    assert.equal(repository.calls.length, 2);
  }
});

test('atualização preserva dados somente durante carga e limpa diante de falha', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-2'));
  await initial;

  const refresh = controller.refresh();
  assert.equal(controller.snapshot.refreshing, true);
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
  assert.equal(controller.snapshot.nextCursor, 'cursor-2');
  repository.calls[1].result.reject(new ApiTransportError());
  await refresh;

  assert.equal(controller.snapshot.refreshing, false);
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(controller.snapshot.failure.kind, 'unavailable');
});

test('carregar mais tardio é descartado quando uma atualização começa', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-2'));
  await initial;

  const more = controller.loadMore();
  await nextMicrotask();
  const refresh = controller.refresh();
  repository.calls[1].result.resolve(page([user(USER_B)]));
  await more;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);

  repository.calls[2].result.resolve(page([user(USER_C)]));
  await refresh;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_C]);
});

test('refresh antigo não interfere no carregar mais de uma geração atual', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-inicial'));
  await initial;

  const oldRefresh = controller.refresh();
  const currentGeneration = controller.setFilters({ busca: 'atual', limite: 50 });
  repository.calls[2].result.resolve(page([user(USER_B)], 'cursor-atual'));
  await currentGeneration;
  const currentMore = controller.loadMore();
  await nextMicrotask();

  repository.calls[1].result.resolve(page([user(USER_A)], 'cursor-antigo'));
  await oldRefresh;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_B]);
  assert.equal(controller.snapshot.loadingMore, true);
  assert.equal(controller.snapshot.nextCursor, 'cursor-atual');

  repository.calls[3].result.resolve(page([user(USER_C)]));
  await currentMore;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_B, USER_C]);
});

test('estados vazios distinguem cadastro vazio de filtros sem resultado', () => {
  assert.deepEqual(administrativeUserEmptyState({ limite: 50 }), {
    title: 'Nenhum Usuário cadastrado',
    message: 'Nenhum Usuário administrativo foi retornado pelo servidor.',
  });
  for (const filters of [
    { busca: 'Ana' },
    { perfil: 'admin' },
    { status: 'inativo' },
  ]) {
    assert.deepEqual(administrativeUserEmptyState(filters), {
      title: 'Nenhum resultado',
      message: 'Tente ajustar a busca ou limpar os filtros aplicados.',
    });
  }
});

test('classificação cobre sessão, forbidden, not_found e indisponibilidade sem texto remoto', () => {
  const cases = [
    [new SessionRequiredError(), 'session_expired'],
    [new ApiResponseError({ status: 401, code: 'invalid_session' }), 'session_expired'],
    [new AdministrativeUserAccessDeniedError(), 'forbidden'],
    [new ApiResponseError({ status: 403, code: 'forbidden' }), 'forbidden'],
    [new ApiResponseError({ status: 404, code: 'not_found' }), 'not_found'],
    [new ApiTransportError(), 'unavailable'],
    [new InvalidBackendResponseError(), 'incompatible_response'],
    [new ApiResponseError({ status: 503, code: 'unexpected_response' }), 'unavailable'],
    [new Error('segredo remoto'), 'unexpected'],
  ];
  for (const [error, kind] of cases) {
    const failure = classifyAdministrativeUserReadFailure(error);
    assert.equal(failure.kind, kind);
    assert.doesNotMatch(failure.message, /segredo remoto/);
    if (kind === 'unavailable') assert.match(failure.message, /Nenhum dado demonstrativo/);
    if (kind === 'incompatible_response') assert.equal(failure.retryable, false);
  }
});

test('chamadas simultâneas de carregar mais coalescem a mesma Promise e uma requisição', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-2'));
  await initial;

  const first = controller.loadMore();
  const second = controller.loadMore();
  assert.equal(first, second);
  await nextMicrotask();
  assert.equal(repository.calls.length, 2);
  repository.calls[1].result.resolve(page([user(USER_B)]));
  await Promise.all([first, second]);
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A, USER_B]);
});

test('cursor repetido encerra paginação sem incorporar a página incompatível', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
  await initial;

  const more = controller.loadMore();
  await nextMicrotask();
  repository.calls[1].result.resolve(page([user(USER_B)], 'cursor-A'));
  await more;

  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(controller.snapshot.nextPageFailure.kind, 'incompatible_response');
  assert.equal(controller.snapshot.nextPageFailure.retryable, false);
});

test('ciclo de cursores A para B para A é detectado por geração', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
  await initial;

  const pageA = controller.loadMore();
  await nextMicrotask();
  repository.calls[1].result.resolve(page([user(USER_B)], 'cursor-B'));
  await pageA;
  const pageB = controller.loadMore();
  await nextMicrotask();
  repository.calls[2].result.resolve(page([user(USER_C)], 'cursor-A'));
  await pageB;

  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A, USER_B]);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(controller.snapshot.nextPageFailure.kind, 'incompatible_response');
});

test('página sem progresso não avança, mas mistura com ao menos um ID novo é aceita', async () => {
  for (const stalledItems of [[user(USER_A)], []]) {
    const repository = queuedRepository();
    const controller = listController(repository);
    const initial = controller.loadInitial();
    repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
    await initial;
    const more = controller.loadMore();
    await nextMicrotask();
    repository.calls[1].result.resolve(page(stalledItems, 'cursor-B'));
    await more;
    assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A]);
    assert.equal(controller.snapshot.nextCursor, null);
    assert.equal(controller.snapshot.nextPageFailure.kind, 'incompatible_response');
  }

  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
  await initial;
  const more = controller.loadMore();
  await nextMicrotask();
  repository.calls[1].result.resolve(page([user(USER_A), user(USER_B)], 'cursor-B'));
  await more;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_A, USER_B]);
  assert.equal(controller.snapshot.nextCursor, 'cursor-B');
  assert.equal(controller.snapshot.nextPageFailure, null);
});

test('primeira página vazia com cursor é rejeitada sem ciclo de retry automático', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([], 'cursor-sem-itens'));
  await initial;

  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);
  assert.equal(controller.snapshot.failure.kind, 'incompatible_response');
  assert.equal(controller.snapshot.failure.retryable, false);
  assert.equal(repository.calls.length, 1);
});

test('401 e 403 limpam imediatamente itens e cursor em primeira página, refresh e carregar mais', async () => {
  const accessErrors = [
    [new SessionRequiredError(), 'session_expired'],
    [new ApiResponseError({ status: 401, code: 'invalid_session' }), 'session_expired'],
    [new AdministrativeUserAccessDeniedError(), 'forbidden'],
    [new ApiResponseError({ status: 403, code: 'forbidden' }), 'forbidden'],
  ];
  for (const [error, kind] of accessErrors) {
    const initialRepository = queuedRepository();
    const initialController = listController(initialRepository);
    const initial = initialController.loadInitial();
    initialRepository.calls[0].result.reject(error);
    await initial;
    assert.deepEqual(initialController.snapshot.items, []);
    assert.equal(initialController.snapshot.nextCursor, null);
    assert.equal(initialController.snapshot.failure.kind, kind);

    const repository = queuedRepository();
    const controller = listController(repository);
    const seed = controller.loadInitial();
    repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
    await seed;
    const refresh = controller.refresh();
    repository.calls[1].result.reject(error);
    await refresh;
    assert.deepEqual(controller.snapshot.items, []);
    assert.equal(controller.snapshot.nextCursor, null);
    assert.equal(controller.snapshot.failure.kind, kind);

    const reseed = controller.loadInitial();
    repository.calls[2].result.resolve(page([user(USER_A)], 'cursor-A'));
    await reseed;
    const more = controller.loadMore();
    await nextMicrotask();
    repository.calls[3].result.reject(error);
    await more;
    assert.deepEqual(controller.snapshot.items, []);
    assert.equal(controller.snapshot.nextCursor, null);
    assert.equal(controller.snapshot.failure.kind, kind);
    assert.equal(controller.snapshot.nextPageFailure, null);
  }
});

test('troca de partição limpa dados e torna resposta anterior inerte', async () => {
  const repository = queuedRepository();
  const controller = listController(repository, { limite: 50 }, 'admin-A');
  const initial = controller.loadInitial();
  assert.equal(controller.synchronizePartition('produtor-B'), true);
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.nextCursor, null);
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-antigo'));
  await initial;
  assert.deepEqual(controller.snapshot.items, []);
  assert.equal(controller.snapshot.partitionKey, 'produtor-B');
});

test('mudança de filtros reinicia histórico de cursores', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  const initial = controller.loadInitial();
  repository.calls[0].result.resolve(page([user(USER_A)], 'cursor-A'));
  await initial;
  const firstMore = controller.loadMore();
  await nextMicrotask();
  repository.calls[1].result.resolve(page([user(USER_B)], 'cursor-B'));
  await firstMore;

  const filtered = controller.setFilters({ busca: 'novo', limite: 50 });
  repository.calls[2].result.resolve(page([user(USER_C)], 'cursor-A'));
  await filtered;
  const filteredMore = controller.loadMore();
  await nextMicrotask();
  repository.calls[3].result.resolve(page([user(USER_A)], 'cursor-C'));
  await filteredMore;
  assert.deepEqual(controller.snapshot.items.map((item) => item.id), [USER_C, USER_A]);
  assert.equal(controller.snapshot.nextCursor, 'cursor-C');
});

test('dispose remove observadores e impede publicação de resposta tardia', async () => {
  const repository = queuedRepository();
  const controller = listController(repository);
  let publications = 0;
  controller.subscribe(() => { publications += 1; });
  const initial = controller.loadInitial();
  const beforeDispose = publications;
  controller.dispose();
  repository.calls[0].result.resolve(page([user(USER_A)]));
  await initial;
  assert.equal(publications, beforeDispose);
  assert.deepEqual(controller.snapshot.items, []);
});

test('merge isolado deduplica inclusive dentro da primeira página', () => {
  const merged = mergeAdministrativeUsers(
    [user(USER_A)],
    [user(USER_A), user(USER_B), user(USER_B)],
  );
  assert.deepEqual(merged.map((item) => item.id), [USER_A, USER_B]);
  assert.equal(Object.isFrozen(merged), true);
});
