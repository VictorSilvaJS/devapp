const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AdministrativeCommandChangedError,
  AdministrativeCommandCoordinator,
  AdministrativeCommandInFlightError,
  AdministrativeCommandPartitionChangedError,
  InvalidAdministrativeCommandError,
  createAdministrativeIdempotencyKey,
  createAdministrativeIntentId,
} = require('../.tmp-mp35d1/src/http/administrativeCommandCoordinator');
const {
  ApiResponseError,
} = require('../.tmp-mp35d1/src/http/backendApi');
const {
  ApiTransportError,
} = require('../.tmp-mp35d1/src/http/httpTransport');
const {
  InvalidBackendResponseError,
} = require('../.tmp-mp35d1/src/http/decoders');
const {
  SessionCoordinator,
  SessionRequiredError,
} = require('../.tmp-mp35d1/src/http/sessionCoordinator');

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '99999999-9999-4999-8999-999999999999';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ACCESS_A = 'A'.repeat(43);
const ACCESS_B = 'B'.repeat(43);
const REFRESH_A = 'C'.repeat(43);
const REFRESH_B = 'D'.repeat(43);
const INTENT_UUID = '33333333-3333-4333-8333-333333333333';
const KEY_UUID_A = '44444444-4444-4444-8444-444444444444';
const KEY_UUID_B = '55555555-5555-4555-8555-555555555555';
const INTENT_UUID_B = '66666666-6666-4666-8666-666666666666';
const INTENT_UUID_C = '77777777-7777-4777-8777-777777777777';
const INTENT_ID = createAdministrativeIntentId(() => INTENT_UUID);
const INTENT_ID_B = createAdministrativeIntentId(() => INTENT_UUID_B);
const INTENT_ID_C = createAdministrativeIntentId(() => INTENT_UUID_C);

function keySequence(...uuids) {
  let index = 0;
  return () => createAdministrativeIdempotencyKey(() => uuids[index++]);
}

const directSession = {
  async authenticated(operation) {
    return operation(ACCESS_A);
  },
};

function coordinatorWithKeys(...uuids) {
  return new AdministrativeCommandCoordinator({
    session: directSession,
    createKey: keySequence(...uuids),
  });
}

function commandInput(body = { versao: 1, area_total: '1.2300' }) {
  return {
    intentId: INTENT_ID,
    method: 'PATCH',
    route: `/v1/propriedades/${USER_A_ID}`,
    body,
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

function canonicalByteLength(body) {
  return Buffer.byteLength(JSON.stringify(body), 'utf8');
}

async function assertRejectedBeforeExecution(body) {
  let attempts = 0;
  let keyCreations = 0;
  const coordinator = new AdministrativeCommandCoordinator({
    session: directSession,
    createKey: () => {
      keyCreations += 1;
      return createAdministrativeIdempotencyKey(() => KEY_UUID_A);
    },
  });
  await assert.rejects(
    coordinator.execute(commandInput(body), async () => { attempts += 1; }),
    InvalidAdministrativeCommandError,
  );
  assert.equal(attempts, 0);
  assert.equal(keyCreations, 0);
  assert.equal(coordinator.size, 0);
}

function snapshot(
  userId = USER_A_ID,
  authorizationVersion = 3,
  sessionId = SESSION_ID,
  scopeVersion = authorizationVersion,
) {
  return {
    id: sessionId,
    usuario: {
      id: userId,
      organizacao_id: 'org_tche_fertilidade',
      nome: 'Admin',
      email: 'admin@example.test',
      perfil: 'admin',
      status: 'ativo',
      versao_autorizacao: authorizationVersion,
    },
    escopo: { modo: 'organizacao', versao: scopeVersion },
    emitido_em: '2026-09-01T12:00:00.000Z',
    access_expira_em: '2026-09-01T12:15:00.000Z',
    sessao_expira_inatividade_em: '2026-09-15T12:00:00.000Z',
    sessao_expira_absolutamente_em: '2026-10-01T12:00:00.000Z',
    access_expires_monotonic: 900_000,
  };
}

function tokenResponse(
  accessToken = ACCESS_A,
  refreshToken = REFRESH_A,
  current = snapshot(),
) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: current.emitido_em,
    access_expira_em: current.access_expira_em,
    sessao_expira_inatividade_em: current.sessao_expira_inatividade_em,
    sessao_expira_absolutamente_em: current.sessao_expira_absolutamente_em,
    id: current.id,
    usuario: current.usuario,
    escopo: current.escopo,
  };
}

class MemoryRefreshStore {
  constructor() {
    this.value = null;
  }
  async read() { return this.value; }
  async write(value) { this.value = value; }
  async clear() { this.value = null; }
}

async function assertRefreshContextIdentityRejected(changed) {
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      return tokenResponse(ACCESS_B, REFRESH_B, changed);
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    SessionRequiredError,
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
  assert.equal(session.snapshot, null);
}

test('erro ambíguo conserva chave, método, rota e corpo canônico até sucesso', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const first = [];
  await assert.rejects(
    coordinator.execute(commandInput(), async (_accessToken, command) => {
      first.push(command);
      throw new ApiTransportError();
    }),
    ApiTransportError,
  );
  assert.equal(coordinator.size, 1);

  let retried;
  const result = await coordinator.execute(commandInput({
    area_total: '1.2300',
    versao: 1,
  }), async (_accessToken, command) => {
    retried = command;
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.equal(retried.idempotencyKey, first[0].idempotencyKey);
  assert.equal(retried.method, 'PATCH');
  assert.equal(retried.route, commandInput().route);
  assert.deepEqual(retried.body, { area_total: '1.2300', versao: 1 });
  assert.equal(Object.isFrozen(retried.body), true);
  assert.notStrictEqual(retried, first[0]);
  assert.notStrictEqual(retried.body, first[0].body);
  assert.equal(coordinator.size, 0);
});

test('snapshot profundo impede mutação de método, rota, chave, objetos e arrays', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const input = commandInput({
    versao: 1,
    area_total: '1.2300',
    nested: { nome: 'original', itens: ['a', { valor: 'b' }] },
  });
  let firstSnapshot;
  await assert.rejects(
    coordinator.execute(input, async (_accessToken, command) => {
      firstSnapshot = command;
      for (const mutation of [
        () => { command.method = 'DELETE'; },
        () => { command.route = '/v1/usuarios/alterado'; },
        () => { command.idempotencyKey = 'admin_55555555555545558555555555555555'; },
        () => { command.body.nested.nome = 'alterado'; },
        () => { command.body.nested.itens[1].valor = 'alterado'; },
        () => { command.body.nested.itens.push('alterado'); },
      ]) {
        try { mutation(); } catch {}
      }
      assert.equal(command.method, 'PATCH');
      assert.equal(command.route, input.route);
      assert.equal(command.idempotencyKey, 'admin_44444444444444448444444444444444');
      assert.deepEqual(command.body, {
        area_total: '1.2300',
        nested: { itens: ['a', { valor: 'b' }], nome: 'original' },
        versao: 1,
      });
      assert.equal(Object.isFrozen(command), true);
      assert.equal(Object.isFrozen(command.body), true);
      assert.equal(Object.isFrozen(command.body.nested), true);
      assert.equal(Object.isFrozen(command.body.nested.itens), true);
      assert.equal(Object.isFrozen(command.body.nested.itens[1]), true);
      throw new ApiTransportError();
    }),
    ApiTransportError,
  );

  let retrySnapshot;
  await coordinator.execute(input, async (_accessToken, command) => {
    retrySnapshot = command;
    assert.equal(command.method, 'PATCH');
    assert.equal(command.route, input.route);
    assert.equal(command.idempotencyKey, firstSnapshot.idempotencyKey);
    assert.deepEqual(command.body, firstSnapshot.body);
  });
  assert.notStrictEqual(retrySnapshot, firstSnapshot);
  assert.notStrictEqual(retrySnapshot.body, firstSnapshot.body);

  const newIntent = {
    ...commandInput({ versao: 2, nested: { itens: ['íntegro'] } }),
    intentId: createAdministrativeIntentId(() => KEY_UUID_B),
  };
  await coordinator.execute(newIntent, async (_accessToken, command) => {
    assert.deepEqual(command.body, { nested: { itens: ['íntegro'] }, versao: 2 });
  });
});

test('corpos não JSON, ciclos, funções, undefined e arrays esparsos falham antes do envio', async () => {
  const cycle = {};
  cycle.self = cycle;
  const sparse = [];
  sparse[1] = 'valor';
  for (const body of [
    { value: undefined },
    { value() {} },
    { value: Symbol('x') },
    { value: new Date() },
    { value: cycle },
    { value: sparse },
  ]) {
    let attempts = 0;
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    await assert.rejects(
      coordinator.execute(commandInput(body), async () => { attempts += 1; }),
      InvalidAdministrativeCommandError,
    );
    assert.equal(attempts, 0);
    assert.equal(coordinator.size, 0);
  }
});

test('arrays são validados integralmente por descritores sem executar getters', async () => {
  let getterCalls = 0;
  const getterIndex = ['valor'];
  Object.defineProperty(getterIndex, '0', {
    configurable: true,
    enumerable: true,
    get() { getterCalls += 1; return 'não executar'; },
  });
  const getterExtra = [];
  Object.defineProperty(getterExtra, 'extra', {
    configurable: true,
    enumerable: true,
    get() { getterCalls += 1; return 'não executar'; },
  });
  const setterIndex = [];
  Object.defineProperty(setterIndex, '0', {
    configurable: true,
    enumerable: true,
    set(_value) {},
  });
  const setterExtra = [];
  Object.defineProperty(setterExtra, 'extra', {
    configurable: true,
    enumerable: true,
    set(_value) {},
  });
  const extraUndefined = [];
  extraUndefined.extra = undefined;
  const extraFunction = [];
  extraFunction.extra = () => undefined;
  const extraCycle = [];
  extraCycle.extra = extraCycle;
  const extraValid = [];
  extraValid.extra = { valido: true };
  const extraHidden = [];
  Object.defineProperty(extraHidden, 'extra', { value: 'oculto' });
  const extraSymbol = [];
  extraSymbol[Symbol('extra')] = 'oculto';
  const sparse = [];
  sparse[1] = 'valor';
  const undefinedIndex = [undefined];
  const functionIndex = [() => undefined];
  const bigintIndex = [1n];
  const symbolIndex = [Symbol('valor')];
  const nonFiniteIndex = [Infinity];
  const cycleIndex = [];
  cycleIndex.push(cycleIndex);

  for (const value of [
    getterIndex,
    getterExtra,
    setterIndex,
    setterExtra,
    extraUndefined,
    extraFunction,
    extraCycle,
    extraValid,
    extraHidden,
    extraSymbol,
    sparse,
    undefinedIndex,
    functionIndex,
    bigintIndex,
    symbolIndex,
    nonFiniteIndex,
    cycleIndex,
  ]) {
    let attempts = 0;
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    await assert.rejects(
      coordinator.execute(commandInput({ value }), async () => { attempts += 1; }),
      InvalidAdministrativeCommandError,
    );
    assert.equal(attempts, 0);
    assert.equal(coordinator.size, 0);
  }
  assert.equal(getterCalls, 0);
});

test('objetos usam descritores, rejeitam propriedades ocultas e aceitam referência compartilhada', async () => {
  let getterCalls = 0;
  const getterObject = {};
  Object.defineProperty(getterObject, 'value', {
    configurable: true,
    enumerable: true,
    get() { getterCalls += 1; return 'não executar'; },
  });
  const setterObject = {};
  Object.defineProperty(setterObject, 'value', {
    configurable: true,
    enumerable: true,
    set(_value) {},
  });
  const hiddenObject = {};
  Object.defineProperty(hiddenObject, 'value', { value: 'oculto' });
  const symbolObject = { value: 'visível' };
  symbolObject[Symbol('oculto')] = 'segredo';
  const cycle = {};
  cycle.self = cycle;

  for (const value of [getterObject, setterObject, hiddenObject, symbolObject, cycle]) {
    let attempts = 0;
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    await assert.rejects(
      coordinator.execute(commandInput({ value }), async () => { attempts += 1; }),
      InvalidAdministrativeCommandError,
    );
    assert.equal(attempts, 0);
    assert.equal(coordinator.size, 0);
  }
  assert.equal(getterCalls, 0);

  const shared = { nome: 'compartilhado' };
  const coordinator = coordinatorWithKeys(KEY_UUID_A);
  await coordinator.execute(
    commandInput({ esquerda: shared, direita: shared }),
    async (_accessToken, command) => {
      assert.deepEqual(command.body, {
        direita: { nome: 'compartilhado' },
        esquerda: { nome: 'compartilhado' },
      });
      assert.notStrictEqual(command.body.esquerda, command.body.direita);
      assert.equal(Object.isFrozen(command.body.esquerda), true);
      assert.equal(Object.isFrozen(command.body.direita), true);
    },
  );
  assert.equal(coordinator.size, 0);
});

test('limite canônico usa exatamente 65.536 bytes UTF-8 com escapes JSON', async () => {
  const exactValues = [
    'a'.repeat(65_528),
    '😀'.repeat(16_382),
    '"'.repeat(32_764),
    '\\'.repeat(32_764),
    '\u0000'.repeat(10_921) + 'aa',
    '\ud800'.repeat(10_921) + 'aa',
    ('😀"\\\u0000'.repeat(4_680)) + 'é'.repeat(4),
  ];

  for (const value of exactValues) {
    const body = { v: value };
    assert.equal(canonicalByteLength(body), 65_536);
    let attempts = 0;
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    await coordinator.execute(commandInput(body), async (_accessToken, command) => {
      attempts += 1;
      assert.equal(canonicalByteLength(command.body), 65_536);
    });
    assert.equal(attempts, 1);
    assert.equal(coordinator.size, 0);

    const oversized = { v: `${value}a` };
    assert.equal(canonicalByteLength(oversized), 65_537);
    await assertRejectedBeforeExecution(oversized);
  }
});

test('string de um milhão de caracteres falha pela guarda barata sem criar intenção', async () => {
  await assertRejectedBeforeExecution({ v: 'x'.repeat(1_000_000) });
});

test('array impossível falha pelo length antes de ownKeys ou descritores de índices', async () => {
  let ownKeysCalls = 0;
  let lengthDescriptorCalls = 0;
  let indexDescriptorCalls = 0;
  const target = Array.from({ length: 65_537 }, () => null);
  const controlled = new Proxy(target, {
    ownKeys(inner) {
      ownKeysCalls += 1;
      return Reflect.ownKeys(inner);
    },
    getOwnPropertyDescriptor(inner, key) {
      if (key === 'length') lengthDescriptorCalls += 1;
      else indexDescriptorCalls += 1;
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });

  await assertRejectedBeforeExecution({ v: controlled });
  assert.equal(lengthDescriptorCalls, 1);
  assert.equal(ownKeysCalls, 0);
  assert.equal(indexDescriptorCalls, 0);
});

test('orçamentos de propriedades, nós e profundidade interrompem antes da travessia restante', async () => {
  const tooManyProperties = {};
  for (let index = 0; index < 513; index += 1) {
    tooManyProperties[`p${index}`] = null;
  }
  let propertyDescriptors = 0;
  const propertyControlled = new Proxy(tooManyProperties, {
    getOwnPropertyDescriptor(inner, key) {
      propertyDescriptors += 1;
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });
  await assertRejectedBeforeExecution(propertyControlled);
  assert.equal(propertyDescriptors, 0);

  const hugeKeyTarget = { ['k'.repeat(1_025)]: null };
  let hugeKeyDescriptors = 0;
  const hugeKeyControlled = new Proxy(hugeKeyTarget, {
    getOwnPropertyDescriptor(inner, key) {
      hugeKeyDescriptors += 1;
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });
  await assertRejectedBeforeExecution(hugeKeyControlled);
  assert.equal(hugeKeyDescriptors, 0);

  let arrayOwnKeys = 0;
  const lastArray = new Proxy(Array(1_024).fill(null), {
    ownKeys(inner) {
      arrayOwnKeys += 1;
      return Reflect.ownKeys(inner);
    },
  });
  const arrays = [
    Array(1_024).fill(null),
    Array(1_024).fill(null),
    Array(1_024).fill(null),
    lastArray,
  ];
  await assertRejectedBeforeExecution({ v: arrays });
  assert.equal(arrayOwnKeys, 0);

  let objectDescriptors = 0;
  const lastObjectTarget = {};
  for (let index = 0; index < 512; index += 1) {
    lastObjectTarget[`p${index}`] = null;
  }
  const lastObject = new Proxy(lastObjectTarget, {
    getOwnPropertyDescriptor(inner, key) {
      objectDescriptors += 1;
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });
  const groups = [];
  for (let group = 0; group < 7; group += 1) {
    const current = {};
    for (let index = 0; index < 512; index += 1) {
      current[`p${index}`] = null;
    }
    groups.push(current);
  }
  groups.push(lastObject);
  await assertRejectedBeforeExecution({ v: groups });
  assert.equal(objectDescriptors, 0);

  let deepOwnKeys = 0;
  const deepLeaf = new Proxy({}, {
    ownKeys(inner) {
      deepOwnKeys += 1;
      return Reflect.ownKeys(inner);
    },
  });
  let deep = deepLeaf;
  for (let depth = 0; depth < 33; depth += 1) deep = { next: deep };
  await assertRejectedBeforeExecution(deep);
  assert.equal(deepOwnKeys, 0);
});

test('payload comum e delta de 100 IDs permanecem canônicos e determinísticos', async () => {
  const ids = Array.from(
    { length: 100 },
    (_value, index) => `${index.toString().padStart(8, '0')}-0000-4000-8000-000000000000`,
  );
  const shared = { motivo: 'correcao_administrativa', ativo: true };
  const bodies = [
    { versao: 7, adicionar: ids, metadados: shared, copia: shared },
    { copia: shared, metadados: shared, adicionar: ids, versao: 7 },
  ];
  const serialized = [];
  for (const body of bodies) {
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    await coordinator.execute(commandInput(body), async (_accessToken, command) => {
      serialized.push(JSON.stringify(command.body));
      assert.equal(command.body.adicionar.length, 100);
      assert.notStrictEqual(command.body.copia, command.body.metadados);
      assert.equal(Object.isFrozen(command.body.adicionar), true);
    });
    assert.equal(coordinator.size, 0);
  }
  assert.equal(serialized[0], serialized[1]);
});

test('resposta de sucesso incompatível mantém a intenção como ambígua', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A);
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      throw new InvalidBackendResponseError();
    }),
    InvalidBackendResponseError,
  );
  assert.equal(coordinator.size, 1);
});

test('gerador padrão usa UUID v4 nativo e falha fechado sem a fonte Expo', () => {
  const previous = globalThis.expo;
  try {
    globalThis.expo = { uuidv4: () => KEY_UUID_A };
    assert.equal(
      createAdministrativeIdempotencyKey(),
      'admin_44444444444444448444444444444444',
    );
    delete globalThis.expo;
    assert.throws(() => createAdministrativeIdempotencyKey());
  } finally {
    if (previous === undefined) delete globalThis.expo;
    else globalThis.expo = previous;
  }
});

test('429 e 5xx mantêm intenção; erros 4xx definitivos a removem sem retry', async () => {
  for (const status of [429, 503]) {
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    let attempts = 0;
    await assert.rejects(
      coordinator.execute(commandInput(), async () => {
        attempts += 1;
        throw new ApiResponseError({
          status,
          code: status === 429 ? 'rate_limited' : 'service_unavailable',
        });
      }),
      ApiResponseError,
    );
    assert.equal(attempts, 1);
    assert.equal(coordinator.size, 1);
  }

  for (const [status, code] of [
    [409, 'idempotency_conflict'],
    [409, 'business_rule_conflict'],
    [422, 'validation_error'],
  ]) {
    const coordinator = coordinatorWithKeys(KEY_UUID_A);
    let attempts = 0;
    await assert.rejects(
      coordinator.execute(commandInput(), async () => {
        attempts += 1;
        throw new ApiResponseError({ status, code });
      }),
      ApiResponseError,
    );
    assert.equal(attempts, 1);
    assert.equal(coordinator.size, 0);
  }
});

test('version_conflict encerra chave antiga e mantém o rascunho externo intacto', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const draft = { versao: 4, nome: 'Nome revisável' };
  let oldKey;
  await assert.rejects(
    coordinator.execute(commandInput(draft), async (_accessToken, command) => {
      oldKey = command.idempotencyKey;
      throw new ApiResponseError({ status: 409, code: 'version_conflict' });
    }),
    ApiResponseError,
  );
  assert.deepEqual(draft, { versao: 4, nome: 'Nome revisável' });
  assert.equal(coordinator.size, 0);

  let newKey;
  await coordinator.execute(commandInput({ ...draft, versao: 5 }), async (_accessToken, command) => {
    newKey = command.idempotencyKey;
  });
  assert.notEqual(newKey, oldKey);
});

test('alterar corpo invalida intenção ambígua sem reutilizar a chave', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  let oldKey;
  await assert.rejects(
    coordinator.execute(commandInput({ versao: 1 }), async (_accessToken, command) => {
      oldKey = command.idempotencyKey;
      throw new ApiTransportError();
    }),
    ApiTransportError,
  );
  await assert.rejects(
    coordinator.execute(commandInput({ versao: 2 }), async () => undefined),
    AdministrativeCommandChangedError,
  );
  assert.equal(coordinator.size, 0);

  let newKey;
  await coordinator.execute(commandInput({ versao: 2 }), async (_accessToken, command) => {
    newKey = command.idempotencyKey;
  });
  assert.notEqual(newKey, oldKey);
});

test('intentId externo mutado antes e depois de await não interfere na finalização capturada', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const input = commandInput();
  await coordinator.execute(input, async () => {
    input.intentId = INTENT_ID_B;
    await tick();
    input.intentId = INTENT_ID_C;
    return 'ok';
  });
  assert.equal(coordinator.size, 0);
  assert.equal(coordinator.has(INTENT_ID), false);
  assert.equal(coordinator.has(INTENT_ID_B), false);
  assert.equal(coordinator.has(INTENT_ID_C), false);

  await coordinator.execute(commandInput(), async () => 'novo envio');
  assert.equal(coordinator.size, 0);
});

test('mutar intentId para outra intenção ativa não remove a outra entrada', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const otherGate = deferred();
  const other = coordinator.execute({
    ...commandInput({ versao: 2 }),
    intentId: INTENT_ID_B,
  }, async () => otherGate.promise);
  await tick();
  const input = commandInput();
  await coordinator.execute(input, async () => {
    input.intentId = INTENT_ID_B;
  });
  assert.equal(coordinator.has(INTENT_ID), false);
  assert.equal(coordinator.has(INTENT_ID_B), true);
  assert.equal(coordinator.size, 1);
  otherGate.resolve('outra concluída');
  assert.equal(await other, 'outra concluída');
  assert.equal(coordinator.size, 0);
});

test('mutar intentId para intenção criada depois não afeta a entrada posterior', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const oldStarted = deferred();
  const oldGate = deferred();
  const input = commandInput();
  const old = coordinator.execute(input, async () => {
    oldStarted.resolve();
    await oldGate.promise;
    input.intentId = INTENT_ID_B;
    return 'antiga concluída';
  });
  await oldStarted.promise;
  const newGate = deferred();
  const later = coordinator.execute({
    ...commandInput({ versao: 2 }),
    intentId: INTENT_ID_B,
  }, async () => newGate.promise);
  await tick();
  oldGate.resolve();
  assert.equal(await old, 'antiga concluída');
  assert.equal(coordinator.has(INTENT_ID_B), true);
  assert.equal(coordinator.size, 1);
  newGate.resolve('posterior concluída');
  assert.equal(await later, 'posterior concluída');
  assert.equal(coordinator.size, 0);
});

test('erro lançado durante tentativa de mutação de intentId não prende a intenção', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  const input = commandInput();
  await assert.rejects(
    coordinator.execute(input, async () => {
      Object.defineProperty(input, 'intentId', {
        configurable: true,
        set() { throw new Error('mutação recusada'); },
      });
      input.intentId = INTENT_ID_B;
    }),
    /mutação recusada/,
  );
  assert.equal(coordinator.size, 0);
  await coordinator.execute(commandInput(), async () => 'não bloqueado');
  assert.equal(coordinator.size, 0);
});

test('duplo envio da mesma intenção em voo é bloqueado', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A);
  const gate = deferred();
  const first = coordinator.execute(commandInput(), async () => gate.promise);
  await tick();
  await assert.rejects(
    coordinator.execute(commandInput(), async () => 'duplicado'),
    AdministrativeCommandInFlightError,
  );
  gate.resolve('ok');
  assert.equal(await first, 'ok');
  assert.equal(coordinator.size, 0);
});

test('troca de identidade ou epoch limpa intenções e torna resultado tardio inerte', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A);
  coordinator.synchronizeSession(snapshot(), 1);
  const gate = deferred();
  const pending = coordinator.execute(commandInput(), async () => gate.promise);
  await tick();
  assert.equal(coordinator.size, 1);
  assert.equal(coordinator.synchronizeSession(snapshot(), 1), false);
  assert.equal(coordinator.size, 1);
  assert.equal(coordinator.synchronizeSession(snapshot(USER_B_ID), 2), true);
  assert.equal(coordinator.size, 0);
  gate.resolve('tardio');
  await assert.rejects(pending, AdministrativeCommandPartitionChangedError);
  assert.equal(coordinator.synchronizeSession(snapshot(USER_B_ID), 2), false);
  assert.equal(coordinator.size, 0);
});

test('resposta antiga não altera intenção nova que reutiliza o mesmo ID após clear', async () => {
  const coordinator = coordinatorWithKeys(KEY_UUID_A, KEY_UUID_B);
  coordinator.synchronizeSession(snapshot(), 1);
  const oldStarted = deferred();
  const oldGate = deferred();
  const old = coordinator.execute(commandInput(), async () => {
    oldStarted.resolve();
    return oldGate.promise;
  });
  await oldStarted.promise;
  coordinator.clear();
  assert.equal(coordinator.size, 0);

  const newGate = deferred();
  const current = coordinator.execute(commandInput(), async () => newGate.promise);
  await tick();
  assert.equal(coordinator.size, 1);
  oldGate.resolve('resposta antiga');
  await assert.rejects(old, AdministrativeCommandPartitionChangedError);
  assert.equal(coordinator.has(INTENT_ID), true);
  assert.equal(coordinator.size, 1);

  newGate.resolve('resposta nova');
  assert.equal(await current, 'resposta nova');
  assert.equal(coordinator.size, 0);
});

test('401 repete uma vez após refresh com a mesma chave e o mesmo corpo', async () => {
  const calls = { refresh: 0 };
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      calls.refresh += 1;
      return tokenResponse(ACCESS_B, REFRESH_B);
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');

  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  const attempts = [];
  const originalInput = commandInput({
    versao: 1,
    area_total: '1.2300',
    nested: { itens: ['original'] },
  });
  const result = await coordinator.execute(originalInput, async (accessToken, command) => {
    attempts.push({
      accessToken,
      method: command.method,
      route: command.route,
      key: command.idempotencyKey,
      body: command.body,
    });
    if (accessToken === ACCESS_A) {
      for (const mutation of [
        () => { command.method = 'DELETE'; },
        () => { command.route = '/v1/usuarios/alterado'; },
        () => { command.idempotencyKey = 'admin_55555555555545558555555555555555'; },
        () => { command.body.nested.itens.push('alterado'); },
      ]) {
        try { mutation(); } catch {}
      }
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }
    return 'confirmado';
  });
  assert.equal(result, 'confirmado');
  assert.equal(calls.refresh, 1);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].accessToken, ACCESS_A);
  assert.equal(attempts[1].accessToken, ACCESS_B);
  assert.equal(attempts[0].key, attempts[1].key);
  assert.equal(attempts[0].method, attempts[1].method);
  assert.equal(attempts[0].route, attempts[1].route);
  assert.deepEqual(attempts[0].body, attempts[1].body);
  assert.notStrictEqual(attempts[0].body, attempts[1].body);
  assert.equal(attempts[1].body.area_total, '1.2300');
  assert.deepEqual(attempts[1].body.nested.itens, ['original']);
  assert.equal(coordinator.size, 0);
});

test('401 com refresh que altera autorização bloqueia a segunda requisição', async () => {
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      return tokenResponse(ACCESS_B, REFRESH_B, snapshot(USER_A_ID, 4, SESSION_ID, 3));
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    AdministrativeCommandPartitionChangedError,
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
  assert.equal(session.snapshot.usuario.versao_autorizacao, 4);
  assert.equal(session.snapshot.escopo.versao, 3);
});

test('401 com refresh que altera somente escopo bloqueia a segunda requisição', async () => {
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      return tokenResponse(
        ACCESS_B,
        REFRESH_B,
        snapshot(USER_A_ID, 3, SESSION_ID, 4),
      );
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    AdministrativeCommandPartitionChangedError,
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
  assert.equal(session.snapshot.usuario.versao_autorizacao, 3);
  assert.equal(session.snapshot.escopo.versao, 4);
});

test('401 com mudança isolada do session epoch bloqueia a segunda requisição', async () => {
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      return tokenResponse(ACCESS_B, REFRESH_B);
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    const publishedEpoch = refreshes === 0 ? session.epoch : session.epoch + 1;
    coordinator.synchronizeSession(current, publishedEpoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    AdministrativeCommandPartitionChangedError,
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
  assert.equal(session.snapshot.usuario.id, USER_A_ID);
  assert.equal(session.snapshot.id, SESSION_ID);
});

test('401 com mudança isolada da partição do coordenador bloqueia a segunda requisição', async () => {
  let refreshes = 0;
  let coordinator;
  let session;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      const alternate = snapshot();
      coordinator.synchronizeSession({
        ...alternate,
        usuario: { ...alternate.usuario, organizacao_id: 'org_particao_nova' },
      }, session.epoch);
      return tokenResponse(ACCESS_B, REFRESH_B);
    },
    async logout() {},
  };
  session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    AdministrativeCommandPartitionChangedError,
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
  assert.equal(session.snapshot.usuario.organizacao_id, 'org_tche_fertilidade');
});

test('401 com refresh que altera somente identidade não produz segundo efeito', async () => {
  await assertRefreshContextIdentityRejected(snapshot(USER_B_ID, 3));
});

test('401 com refresh que altera somente sessionId não produz segundo efeito', async () => {
  await assertRefreshContextIdentityRejected(
    snapshot(USER_A_ID, 3, '77777777-7777-4777-8777-777777777777'),
  );
});

test('clear durante refresh impede segunda requisição e não recria entrada', async () => {
  const refreshStarted = deferred();
  const refreshGate = deferred();
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      refreshStarted.resolve();
      return refreshGate.promise;
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  const pending = coordinator.execute(commandInput(), async () => {
    requests += 1;
    throw new ApiResponseError({ status: 401, code: 'invalid_session' });
  });
  await refreshStarted.promise;
  coordinator.clear();
  assert.equal(coordinator.size, 0);
  refreshGate.resolve(tokenResponse(ACCESS_B, REFRESH_B));
  await assert.rejects(pending, AdministrativeCommandPartitionChangedError);
  assert.equal(refreshes, 1);
  assert.equal(requests, 1);
  assert.equal(coordinator.size, 0);
});

test('segundo 401 encerra sessão sem segundo refresh ou terceira requisição', async () => {
  let refreshes = 0;
  const api = {
    async login() { return tokenResponse(); },
    async refresh() {
      refreshes += 1;
      return tokenResponse(ACCESS_B, REFRESH_B);
    },
    async logout() {},
  };
  const session = new SessionCoordinator({
    api,
    refreshTokenStore: new MemoryRefreshStore(),
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
  });
  await session.login('admin@example.test', 'senha');
  const coordinator = new AdministrativeCommandCoordinator({
    session,
    createKey: keySequence(KEY_UUID_A),
  });
  coordinator.synchronizeSession(session.snapshot, session.epoch);
  session.subscribe((current) => {
    coordinator.synchronizeSession(current, session.epoch);
  });
  let requests = 0;
  await assert.rejects(
    coordinator.execute(commandInput(), async () => {
      requests += 1;
      throw new ApiResponseError({ status: 401, code: 'invalid_session' });
    }),
    SessionRequiredError,
  );
  assert.equal(requests, 2);
  assert.equal(refreshes, 1);
  assert.equal(session.snapshot, null);
  assert.equal(coordinator.size, 0);
});
