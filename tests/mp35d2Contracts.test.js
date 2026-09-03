const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ApiResponseError,
  BackendApi,
  InvalidApiRequestError,
} = require('../.tmp-mp35d2/src/http/backendApi');
const {
  decodeAdministrativeUserDetail,
  decodeAdministrativeUserListItem,
  decodeAdministrativeUserPage,
  decodeAdministrativeUserProfile,
  decodeAdministrativeUserStatus,
  decodeOpaqueCursor,
  decodePositiveVersion,
  InvalidBackendResponseError,
} = require('../.tmp-mp35d2/src/http/decoders');
const {
  AdministrativeUserAccessDeniedError,
  AdministrativeUserContextStaleError,
  HttpAdministrativeUserRepository,
} = require('../.tmp-mp35d2/src/http/administrativeUserRepository');
const {
  administrativeUserSessionPartition,
} = require('../.tmp-mp35d2/src/http/administrativeUserAccess');
const {
  AdministrativeUserDataBoundary,
} = require('../.tmp-mp35d2/src/http/administrativeUserDataBoundary');
const {
  SessionRequiredError,
} = require('../.tmp-mp35d2/src/http/sessionCoordinator');

const ACCESS_TOKEN = 'A'.repeat(43);
const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCER_ID = '22222222-2222-4222-8222-222222222222';

function administrativeUser(overrides = {}) {
  return {
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: null,
    nome: 'Usuário HTTP',
    email: 'usuario@example.test',
    perfil: 'admin',
    status: 'ativo',
    telefone: '+55 51 99999-9999',
    documento: '12345678900',
    observacoes: 'Cadastro administrativo',
    versao: 7,
    criado_em: '2026-08-31T12:00:00.000Z',
    atualizado_em: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function page(overrides = {}) {
  return {
    itens: [administrativeUser()],
    paginacao: { proximo_cursor: null },
    ...overrides,
  };
}

function apiReturning(responses, requests) {
  return new BackendApi({
    baseUrl: 'https://api.tcheagro.example/',
    transport: {
      async send(request) {
        requests.push(request);
        return responses.shift();
      },
    },
  });
}

function repositorySnapshot(profile = 'admin') {
  return {
    id: 'session-1',
    usuario: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizacao_id: 'org_tche_fertilidade',
      perfil: profile,
      versao_autorizacao: 1,
    },
    escopo: {
      versao: 1,
    },
  };
}

function repositorySession(profile = 'admin') {
  const session = {
    epoch: 7,
    snapshot: repositorySnapshot(profile),
    authenticated(operation) {
      return operation(ACCESS_TOKEN, {
        snapshot: this.snapshot,
        epoch: this.epoch,
      });
    },
    async revalidate() { return this.snapshot; },
  };
  return session;
}

function repositoryWithBoundary(api, session) {
  const boundary = new AdministrativeUserDataBoundary(
    administrativeUserSessionPartition(session.snapshot, session.epoch),
  );
  session.administrativeUserData = boundary;
  return new HttpAdministrativeUserRepository(api, session, boundary);
}

function publishRepositorySession(session, snapshot, advanceEpoch = false) {
  session.snapshot = snapshot;
  if (advanceEpoch) session.epoch += 1;
  session.administrativeUserData.synchronizePartition(
    administrativeUserSessionPartition(session.snapshot, session.epoch),
  );
}

function userWithSequence(sequence) {
  const prefix = sequence.toString(16).padStart(8, '0');
  const suffix = sequence.toString(16).padStart(12, '0');
  return administrativeUser({ id: `${prefix}-1111-4111-8111-${suffix}` });
}

test('lista constrói GET exato e codifica busca, filtros e cursor opaco', async () => {
  const requests = [];
  const api = apiReturning([{ status: 200, body: page() }], requests);
  await api.listAdministrativeUsers(ACCESS_TOKEN, {
    busca: 'João & Filhos + café',
    perfil: 'produtor',
    status: 'pendente',
    limite: 25,
    cursor: 'opaque +/=%25',
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    method: 'GET',
    url: 'https://api.tcheagro.example/v1/usuarios?busca=Jo%C3%A3o+%26+Filhos+%2B+caf%C3%A9&perfil=produtor&status=pendente&limite=25&cursor=opaque+%2B%2F%3D%2525',
    accessToken: ACCESS_TOKEN,
    timeoutMs: 8_000,
  });
});

test('lista aplica limite padrão e detalhe canônico constroem somente dois GETs', async () => {
  const requests = [];
  const api = apiReturning([
    { status: 200, body: page() },
    { status: 200, body: administrativeUser() },
  ], requests);

  await api.listAdministrativeUsers(ACCESS_TOKEN, {});
  await api.getAdministrativeUser(ACCESS_TOKEN, USER_ID);

  assert.deepEqual(
    requests.map(({ method, url, accessToken, body, idempotencyKey }) => ({
      method,
      url,
      accessToken,
      body,
      idempotencyKey,
    })),
    [
      {
        method: 'GET',
        url: 'https://api.tcheagro.example/v1/usuarios?limite=50',
        accessToken: ACCESS_TOKEN,
        body: undefined,
        idempotencyKey: undefined,
      },
      {
        method: 'GET',
        url: `https://api.tcheagro.example/v1/usuarios/${USER_ID}`,
        accessToken: ACCESS_TOKEN,
        body: undefined,
        idempotencyKey: undefined,
      },
    ],
  );
});

test('detalhe rejeita UUID não canônico antes de construir rota ou chamar HTTP', async () => {
  const invalidIds = [
    'segmento/com espaço?',
    USER_ID.replaceAll('-', ''),
    'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
    '11111111-1111-1111-8111-111111111111',
    '11111111-1111-4111-7111-111111111111',
    '',
    '   ',
    '11111111-1111-4111-8111-111111111111\n',
    null,
    123,
    {},
  ];
  for (const invalidId of invalidIds) {
    const requests = [];
    const api = apiReturning([], requests);
    await assert.rejects(
      api.getAdministrativeUser(ACCESS_TOKEN, invalidId),
      (error) => error instanceof InvalidApiRequestError &&
        error.code === 'invalid_request' && error.status === 400,
    );
    assert.equal(requests.length, 0, String(invalidId));
  }
});

test('limite é validado em runtime antes do transporte', async () => {
  for (const invalidLimit of [
    null,
    undefined,
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    101,
    '50',
  ]) {
    const requests = [];
    const api = apiReturning([], requests);
    await assert.rejects(
      api.listAdministrativeUsers(ACCESS_TOKEN, { limite: invalidLimit }),
      InvalidApiRequestError,
    );
    assert.equal(requests.length, 0, String(invalidLimit));
  }
});

test('contrato da página respeita teto absoluto e limite efetivo solicitado', async () => {
  const hundred = Array.from({ length: 100 }, (_, index) => userWithSequence(index + 1));
  const acceptedRequests = [];
  const acceptedApi = apiReturning([{
    status: 200,
    body: { itens: hundred, paginacao: { proximo_cursor: null } },
  }], acceptedRequests);
  const accepted = await acceptedApi.listAdministrativeUsers(ACCESS_TOKEN, { limite: 100 });
  assert.equal(accepted.itens.length, 100);

  for (const testCase of [
    { limite: 100, itens: [...hundred, userWithSequence(101)] },
    { limite: 1, itens: [userWithSequence(1), userWithSequence(2)] },
  ]) {
    const requests = [];
    const api = apiReturning([{
      status: 200,
      body: { itens: testCase.itens, paginacao: { proximo_cursor: null } },
    }], requests);
    await assert.rejects(
      api.listAdministrativeUsers(ACCESS_TOKEN, { limite: testCase.limite }),
      InvalidBackendResponseError,
    );
    assert.equal(requests.length, 1);
  }

  assert.deepEqual(
    decodeAdministrativeUserPage({ itens: [], paginacao: { proximo_cursor: null } }),
    { itens: [], paginacao: { proximo_cursor: null } },
  );
  assert.throws(
    () => decodeAdministrativeUserPage({
      itens: [],
      paginacao: { proximo_cursor: 'não-pode-avançar' },
    }),
    InvalidBackendResponseError,
  );
});

test('item de lista é uma projeção mínima e detalhe preserva só o contrato administrativo', () => {
  const wire = administrativeUser({
    produtor_id: PRODUCER_ID,
    perfil: 'produtor',
  });
  const item = decodeAdministrativeUserListItem(wire);
  const detail = decodeAdministrativeUserDetail(wire);

  assert.deepEqual(Object.keys(item), [
    'id',
    'nome',
    'email',
    'perfil',
    'status',
    'versao',
    'produtor_id',
  ]);
  assert.equal(item.produtor_id, PRODUCER_ID);
  assert.deepEqual(Object.keys(detail), [
    'id',
    'organizacao_id',
    'nome',
    'email',
    'perfil',
    'status',
    'telefone',
    'documento',
    'observacoes',
    'versao',
    'criado_em',
    'atualizado_em',
    'produtor_id',
  ]);
  assert.equal(Object.isFrozen(item), true);
  assert.equal(Object.isFrozen(detail), true);
});

test('produtor_id é obrigatório e anulável no wire, mas opcional na projeção', () => {
  const absent = administrativeUser();
  delete absent.produtor_id;
  assert.throws(
    () => decodeAdministrativeUserDetail(absent),
    InvalidBackendResponseError,
  );
  assert.equal(
    decodeAdministrativeUserDetail(administrativeUser()).produtor_id,
    undefined,
  );
  assert.equal(
    decodeAdministrativeUserDetail(administrativeUser({
      perfil: 'produtor',
      produtor_id: PRODUCER_ID,
    })).produtor_id,
    PRODUCER_ID,
  );
  assert.throws(
    () => decodeAdministrativeUserDetail(administrativeUser({
      perfil: 'colaborador',
      produtor_id: PRODUCER_ID,
    })),
    InvalidBackendResponseError,
  );
});

test('perfil, status, versão e cursor falham fechados fora das allowlists', () => {
  for (const profile of ['admin', 'colaborador', 'produtor']) {
    assert.equal(decodeAdministrativeUserProfile(profile), profile);
  }
  for (const status of ['pendente', 'ativo', 'inativo']) {
    assert.equal(decodeAdministrativeUserStatus(status), status);
  }
  for (const invalid of ['root', '', null, 1]) {
    assert.throws(() => decodeAdministrativeUserProfile(invalid), InvalidBackendResponseError);
  }
  for (const invalid of ['bloqueado', '', null, 1]) {
    assert.throws(() => decodeAdministrativeUserStatus(invalid), InvalidBackendResponseError);
  }
  for (const invalid of [0, -1, 1.5, '7', null]) {
    assert.throws(() => decodePositiveVersion(invalid), InvalidBackendResponseError);
  }
  assert.equal(decodePositiveVersion(9), 9);
  assert.equal(decodeOpaqueCursor('opaque +/='), 'opaque +/=');
  assert.equal(decodeOpaqueCursor(null), null);
  for (const invalid of ['', undefined, 1, 'x'.repeat(2049)]) {
    assert.throws(() => decodeOpaqueCursor(invalid), InvalidBackendResponseError);
  }
});

test('paginação preserva cursor opaco, congela estruturas e rejeita envelopes parciais', () => {
  const decoded = decodeAdministrativeUserPage(page({
    paginacao: { proximo_cursor: 'cursor:+/=%25' },
  }));
  assert.equal(decoded.paginacao.proximo_cursor, 'cursor:+/=%25');
  assert.equal(Object.isFrozen(decoded), true);
  assert.equal(Object.isFrozen(decoded.itens), true);
  assert.equal(Object.isFrozen(decoded.paginacao), true);

  for (const invalid of [
    { itens: [], paginacao: {} },
    { itens: [], paginacao: { proximo_cursor: null, total: 0 } },
    { itens: [], paginacao: { proximo_cursor: '' } },
    { itens: {}, paginacao: { proximo_cursor: null } },
    { itens: [], paginacao: { proximo_cursor: null }, total: 0 },
  ]) {
    assert.throws(() => decodeAdministrativeUserPage(invalid), InvalidBackendResponseError);
  }
});

test('payload administrativo livre, desconhecido ou sensível é recusado integralmente', () => {
  for (const sensitive of [
    ['senha', 'segredo'],
    ['password', 'secret'],
    ['token', 'secret'],
    ['desafio', 'secret'],
    ['outbox', []],
    ['hash', 'secret'],
    ['senha_hash', 'secret'],
    ['fazenda_id', USER_ID],
    ['campo_mock', true],
  ]) {
    assert.throws(
      () => decodeAdministrativeUserDetail(administrativeUser({ [sensitive[0]]: sensitive[1] })),
      InvalidBackendResponseError,
    );
  }
});

test('campos administrativos obrigatórios não aceitam tipos, limites ou datas incompatíveis', () => {
  for (const overrides of [
    { id: 'não-uuid' },
    { organizacao_id: 'outra_org' },
    { nome: '' },
    { nome: 'x'.repeat(201) },
    { email: null },
    { telefone: 123 },
    { documento: {} },
    { observacoes: 'x'.repeat(2001) },
    { versao: 0 },
    { criado_em: '2026-08-31' },
    { atualizado_em: '2026-08-01T12:00:00.000Z' },
  ]) {
    assert.throws(
      () => decodeAdministrativeUserDetail(administrativeUser(overrides)),
      InvalidBackendResponseError,
    );
  }
});

test('repositório usa sessão autenticada e envia filtros sem alterar o cursor', async () => {
  const calls = [];
  const expectedPage = Object.freeze({ itens: Object.freeze([]), paginacao: Object.freeze({ proximo_cursor: null }) });
  const expectedDetail = decodeAdministrativeUserDetail(administrativeUser());
  const api = {
    async listAdministrativeUsers(token, filters) {
      calls.push(['list', token, filters]);
      return expectedPage;
    },
    async getAdministrativeUser(token, id) {
      calls.push(['detail', token, id]);
      return expectedDetail;
    },
  };
  const session = repositorySession();
  const repository = repositoryWithBoundary(api, session);
  const filters = Object.freeze({ busca: 'Ana', limite: 10, cursor: 'opaque +/=' });

  assert.equal(await repository.list(filters), expectedPage);
  assert.equal(await repository.getById(USER_ID), expectedDetail);
  assert.deepEqual(calls, [
    ['list', ACCESS_TOKEN, filters],
    ['detail', ACCESS_TOKEN, USER_ID],
  ]);
});

test('repositório bloqueia Colaborador e Produtor antes de qualquer chamada HTTP', async () => {
  for (const profile of ['colaborador', 'produtor']) {
    let authenticatedCalls = 0;
    const session = {
      epoch: 1,
      snapshot: repositorySnapshot(profile),
      authenticated() { authenticatedCalls += 1; },
    };
    const repository = repositoryWithBoundary({}, session);
    await assert.rejects(repository.list(), AdministrativeUserAccessDeniedError);
    await assert.rejects(repository.getById(USER_ID), AdministrativeUserAccessDeniedError);
    assert.equal(authenticatedCalls, 0);
  }
});

test('guarda decisiva usa identidade restaurada dentro de authenticated', async () => {
  for (const profile of ['produtor', 'colaborador']) {
    let httpCalls = 0;
    const session = repositorySession(profile);
    session.snapshot = null;
    session.authenticated = async function authenticated(operation) {
      publishRepositorySession(
        this,
        repositorySnapshot(profile),
        true,
      );
      return operation(ACCESS_TOKEN, { snapshot: this.snapshot, epoch: this.epoch });
    };
    const repository = repositoryWithBoundary({
      async listAdministrativeUsers() { httpCalls += 1; },
    }, session);
    await assert.rejects(repository.list(), AdministrativeUserAccessDeniedError);
    assert.equal(httpCalls, 0);
  }

  let adminHttpCalls = 0;
  const adminSession = repositorySession();
  adminSession.snapshot = null;
  adminSession.authenticated = async function authenticated(operation) {
    publishRepositorySession(
      this,
      repositorySnapshot('admin'),
      true,
    );
    return operation(ACCESS_TOKEN, { snapshot: this.snapshot, epoch: this.epoch });
  };
  const expected = { itens: [], paginacao: { proximo_cursor: null } };
  const adminRepository = repositoryWithBoundary({
    async listAdministrativeUsers() { adminHttpCalls += 1; return expected; },
  }, adminSession);
  assert.equal(await adminRepository.list(), expected);
  assert.equal(adminHttpCalls, 1);
});

test('refresh que troca Admin por não-Admin e sessão ausente fazem zero GETs', async () => {
  let httpCalls = 0;
  const changedSession = repositorySession('admin');
  changedSession.authenticated = async function authenticated(operation) {
    publishRepositorySession(this, repositorySnapshot('produtor'));
    return operation(ACCESS_TOKEN, { snapshot: this.snapshot, epoch: this.epoch });
  };
  const changedRepository = repositoryWithBoundary({
    async getAdministrativeUser() { httpCalls += 1; },
  }, changedSession);
  await assert.rejects(
    changedRepository.getById(USER_ID),
    AdministrativeUserContextStaleError,
  );
  assert.equal(httpCalls, 0);

  const absentSession = repositorySession();
  absentSession.snapshot = null;
  absentSession.authenticated = async () => { throw new SessionRequiredError(); };
  const absentRepository = repositoryWithBoundary({
    async listAdministrativeUsers() { httpCalls += 1; },
  }, absentSession);
  await assert.rejects(absentRepository.list(), SessionRequiredError);
  assert.equal(httpCalls, 0);
});

test('troca de Admin, identidade ou epoch entre lease e callback faz zero GETs', async () => {
  const transitions = [
    (session) => {
      const next = repositorySnapshot('admin');
      next.usuario.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      publishRepositorySession(session, next);
    },
    (session) => {
      publishRepositorySession(session, repositorySnapshot('admin'), true);
    },
  ];
  for (const transition of transitions) {
    let httpCalls = 0;
    const session = repositorySession('admin');
    session.authenticated = async function authenticated(operation) {
      transition(this);
      return operation(ACCESS_TOKEN, {
        snapshot: this.snapshot,
        epoch: this.epoch,
      });
    };
    const repository = repositoryWithBoundary({
      async getAdministrativeUser() { httpCalls += 1; },
    }, session);
    await assert.rejects(
      repository.getById(USER_ID),
      AdministrativeUserContextStaleError,
    );
    assert.equal(httpCalls, 0);
  }
});

test('403 administrativo solicita revalidação e não cria retry oculto do GET', async () => {
  let httpCalls = 0;
  let revalidations = 0;
  const session = repositorySession();
  session.revalidate = async () => { revalidations += 1; return session.snapshot; };
  const repository = repositoryWithBoundary({
    async listAdministrativeUsers() {
      httpCalls += 1;
      throw new ApiResponseError({ status: 403, code: 'forbidden' });
    },
  }, session);
  await assert.rejects(repository.list(), (error) => error.status === 403);
  await Promise.resolve();
  assert.equal(httpCalls, 1);
  assert.equal(revalidations, 1);
});
