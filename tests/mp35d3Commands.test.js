const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AdministrativeCommandCoordinator,
  createAdministrativeIdempotencyKey,
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
const {
  ApiResponseError,
  BackendApi,
} = require('../.tmp-mp35d3/src/http/backendApi');
const {
  InvalidBackendResponseError,
} = require('../.tmp-mp35d3/src/http/decoders');
const {
  ApiTransportError,
} = require('../.tmp-mp35d3/src/http/httpTransport');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCER_ID = '33333333-3333-4333-8333-333333333333';
const INTENT_ID = createAdministrativeIntentId(() => '44444444-4444-4444-8444-444444444444');
const KEY = createAdministrativeIdempotencyKey(() => '55555555-5555-4555-8555-555555555555');
const ACCESS_TOKEN = 'A'.repeat(43);

function detail(overrides = {}) {
  return {
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: PRODUCER_ID,
    nome: 'Usuário Teste',
    email: 'usuario@example.test',
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

function session(profile = 'admin') {
  return {
    snapshot: {
      id: 'session-A',
      usuario: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        organizacao_id: 'org_tche_fertilidade',
        perfil: profile,
        status: 'ativo',
        versao_autorizacao: 1,
      },
      escopo: { modo: 'organizacao', versao: 1 },
    },
    authenticated(operation) { return operation(ACCESS_TOKEN); },
    async revalidate() { return this.snapshot; },
  };
}

function harness(responses, options = {}) {
  const requests = [];
  const currentSession = options.session ?? session(options.profile);
  const api = options.api ?? new BackendApi({
    baseUrl: 'https://api.tcheagro.example',
    transport: {
      async send(request) {
        requests.push(request);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        if (next === undefined) throw new Error('Resposta de teste ausente.');
        return next;
      },
    },
  });
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  let keySequence = 0;
  const coordinator = new AdministrativeCommandCoordinator({
    session: currentSession,
    createKey: () => {
      keySequence += 1;
      return keySequence === 1
        ? KEY
        : createAdministrativeIdempotencyKey(() => (
            `${String(keySequence).padStart(8, '0')}-5555-4555-8555-555555555555`
          ));
    },
  });
  const service = new AdministrativeUserCommandService({
    api,
    session: currentSession,
    coordinator,
    boundary,
  });
  const lifecycle = new AdministrativeUserCommandLifecycle({
    boundary,
    discardIntent: (intentId) => service.discardIntent(intentId),
    createIntent: (() => {
      let sequence = 0;
      return () => {
        sequence += 1;
        return sequence === 1
          ? INTENT_ID
          : createAdministrativeIntentId(() => (
              `${String(sequence).padStart(8, '0')}-4444-4444-8444-444444444444`
            ));
      };
    })(),
  });
  lifecycle.start();
  return { requests, session: currentSession, boundary, coordinator, service, lifecycle };
}

const COMMANDS = Object.freeze([
  {
    action: 'create', method: 'POST', path: '/v1/usuarios', status: 201, outcome: 'criado',
    authoritative: () => detail(),
    run: (context, intentId, operation) => context.service.create(
      intentId,
      { nome: 'Usuário Teste', email: 'usuario@example.test', perfil: 'produtor' },
      operation,
    ),
  },
  {
    action: 'edit', method: 'PATCH', path: `/v1/usuarios/${USER_ID}`, status: 200, outcome: 'atualizado',
    authoritative: () => detail(),
    run: (context, intentId, operation) => {
      const user = detail();
      const model = updateAdministrativeUserEditField(
        createAdministrativeUserEditModel(user),
        'nome',
        'Nome novo',
      );
      return context.service.update(intentId, user, model, operation);
    },
  },
  {
    action: 'status', method: 'PATCH', path: `/v1/usuarios/${USER_ID}/status`, status: 200, outcome: 'status_alterado',
    authoritative: () => detail({ status: 'ativo' }),
    run: (context, intentId, operation) => context.service.changeStatus(
      intentId,
      detail({ status: 'ativo' }),
      { motivo: 'fim_relacao' },
      operation,
    ),
  },
  {
    action: 'invitation', method: 'POST', path: `/v1/usuarios/${USER_ID}/convites`, status: 201, outcome: 'convite_emitido',
    authoritative: () => detail(),
    run: (context, intentId, operation) => context.service.issueInvitation(
      intentId,
      detail(),
      operation,
    ),
  },
]);

function receipt(command, overrides = {}) {
  return {
    resultado: command.outcome,
    recurso_tipo: 'usuario',
    recurso_id: USER_ID,
    versao: 2,
    ...overrides,
  };
}

function runCommand(context, command) {
  return context.lifecycle.run((intentId, operation) => (
    command.run(context, intentId, operation)
  ));
}

test('cada comando aceita versão igual ou superior e publica somente GET correlacionado', async () => {
  for (const command of COMMANDS) {
    for (const readVersion of [2, 3]) {
      const context = harness([
        { status: command.status, body: receipt(command) },
        { status: 200, body: detail({ versao: readVersion }) },
      ]);
      const outcome = await runCommand(context, command);
      assert.equal(outcome.current, true, command.action);
      assert.equal(outcome.leader, true, command.action);
      assert.equal(outcome.ok, true, command.action);
      assert.equal(outcome.value.kind, 'mutation_confirmed_and_reconciled');
      assert.equal(outcome.value.user.versao, readVersion);
      assert.equal(context.requests.length, 2);
      assert.equal(context.requests[0].method, command.method);
      assert.equal(new URL(context.requests[0].url).pathname, command.path);
      assert.equal(context.requests[0].idempotencyKey, KEY);
      assert.equal(context.requests[1].method, 'GET');
      assert.equal(new URL(context.requests[1].url).pathname, `/v1/usuarios/${USER_ID}`);
      assert.equal(context.boundary.current.mutation.user.versao, readVersion);
      assert.equal(context.coordinator.size, 0);
      context.lifecycle.dispose();
    }
  }
});

test('cada comando rejeita versão inferior, outro ID e perfil/produtor incoerente sem publicar', async () => {
  const invalidReads = [
    () => detail({ versao: 1 }),
    () => detail({ id: OTHER_ID, versao: 2 }),
    () => detail({ perfil: 'colaborador', produtor_id: PRODUCER_ID, versao: 2 }),
  ];
  for (const command of COMMANDS) {
    for (const invalidRead of invalidReads) {
      const context = harness([
        { status: command.status, body: receipt(command) },
        { status: 200, body: invalidRead() },
      ]);
      const outcome = await runCommand(context, command);
      assert.equal(outcome.ok, true, command.action);
      assert.equal(outcome.value.kind, 'mutation_confirmed_reconciliation_failed');
      assert.equal(context.boundary.current.mutation, null);
      assert.equal(context.boundary.current.invalidation, 'reconciliation_failed');
      assert.equal(context.coordinator.size, 0);
      context.lifecycle.dispose();
    }
  }
});

test('cada comando rejeita recurso_tipo e alvo divergentes antes da releitura', async () => {
  for (const command of COMMANDS) {
    const badReceipts = [receipt(command, { recurso_tipo: 'propriedade' })];
    if (command.action !== 'create') {
      badReceipts.push(receipt(command, { recurso_id: OTHER_ID }));
    }
    for (const badReceipt of badReceipts) {
      const context = harness([{ status: command.status, body: badReceipt }]);
      const outcome = await runCommand(context, command);
      assert.equal(outcome.ok, false, command.action);
      assert.equal(outcome.error instanceof InvalidBackendResponseError, true);
      assert.equal(context.requests.length, 1);
      assert.equal(context.boundary.current.mutation, null);
      context.lifecycle.dispose();
    }
  }
});

test('falha de releitura após recibo confirmado não repete mutação e só permite novo GET', async () => {
  for (const command of COMMANDS) {
    const context = harness([
      { status: command.status, body: receipt(command) },
      new ApiTransportError(),
      { status: 200, body: detail({ versao: 2 }) },
    ]);
    const first = await runCommand(context, command);
    assert.equal(first.ok, true);
    assert.equal(first.value.kind, 'mutation_confirmed_reconciliation_failed');
    assert.equal(context.coordinator.size, 0);
    const reread = await context.lifecycle.runRead((operation) => (
      context.service.reloadAdministrativeUser(operation, USER_ID, 2)
    ));
    assert.equal(reread.ok, true);
    assert.equal(context.requests.filter((request) => request.method !== 'GET').length, 1);
    assert.equal(context.requests.filter((request) => request.method === 'GET').length, 2);
    assert.equal(context.boundary.current.mutation.user.versao, 2);
    context.lifecycle.dispose();
  }
});

test('retry único após 401 conserva chave e corpo nas quatro rotas', async () => {
  for (const command of COMMANDS) {
    const currentSession = session();
    currentSession.authenticated = async (operation) => {
      try {
        return await operation('token-anterior');
      } catch (error) {
        if (!(error instanceof ApiResponseError) || error.status !== 401) throw error;
        return operation('token-renovado');
      }
    };
    const calls = [];
    let mutations = 0;
    const mutation = async (accessToken, idempotencyKey, body) => {
      calls.push({ accessToken, idempotencyKey, body });
      mutations += 1;
      if (mutations === 1) throw new ApiResponseError({ status: 401, code: 'invalid_session' });
      return receipt(command);
    };
    const api = {
      createAdministrativeUser: mutation,
      updateAdministrativeUser: mutation,
      changeAdministrativeUserStatus: mutation,
      issueAdministrativeUserInvitation: mutation,
      async getAdministrativeUser() { return detail({ versao: 2 }); },
    };
    const context = harness([], { api, session: currentSession });
    const outcome = await runCommand(context, command);
    assert.equal(outcome.ok, true, command.action);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
    assert.deepEqual(calls[0].body, calls[1].body);
    context.lifecycle.dispose();
  }
});

test('resultado ambíguo preserva a mesma intenção para retry explícito nos quatro comandos', async () => {
  for (const command of COMMANDS) {
    const context = harness([
      new ApiTransportError(),
      { status: command.status, body: receipt(command) },
      { status: 200, body: detail({ versao: 2 }) },
    ]);
    const first = await runCommand(context, command);
    assert.equal(first.ok, false, command.action);
    assert.equal(first.error instanceof ApiTransportError, true);
    assert.equal(context.coordinator.size, 1);
    const second = await runCommand(context, command);
    assert.equal(second.ok, true, command.action);
    assert.equal(second.value.kind, 'mutation_confirmed_and_reconciled');
    const mutations = context.requests.filter((request) => request.method !== 'GET');
    assert.equal(mutations.length, 2);
    assert.equal(mutations[0].idempotencyKey, mutations[1].idempotencyKey);
    assert.deepEqual(mutations[0].body, mutations[1].body);
    context.lifecycle.dispose();
  }
});

test('conflitos distinguem releitura concluída e falha sem nova mutação automática', async () => {
  for (const command of COMMANDS.filter(({ action }) => action !== 'create')) {
    for (const code of ['version_conflict', 'business_rule_conflict']) {
      const context = harness([
        { status: 409, body: { error: { code, details: code === 'version_conflict' ? [{ field: 'versao', current_version: 3 }] : [] } } },
        { status: 200, body: detail({ versao: 3 }) },
      ]);
      const outcome = await runCommand(context, command);
      assert.equal(outcome.ok, false);
      assert.equal(outcome.error instanceof AdministrativeUserConflictError, true);
      assert.equal(outcome.error.outcome, `${code}_reloaded`);
      assert.equal(context.requests.length, 2);
      assert.equal(context.coordinator.size, 0);
      context.lifecycle.dispose();

      for (const reloadFailure of [
        new ApiTransportError(),
        { status: 200, body: detail({ id: OTHER_ID, versao: 3 }) },
      ]) {
        const failed = harness([
          { status: 409, body: { error: { code } } },
          reloadFailure,
        ]);
        const failedOutcome = await runCommand(failed, command);
        assert.equal(failedOutcome.ok, false);
        assert.equal(failedOutcome.error.outcome, `${code}_reload_failed`);
        const ui = classifyAdministrativeUserCommandFailure(command.action, failedOutcome.error);
        assert.equal(ui.reloadRequired, true);
        assert.match(ui.message, /não foi possível carregar|não foi carregada/i);
        assert.equal(failed.requests.length, 2);
        failed.lifecycle.dispose();
      }
    }
  }
});

test('401/403 durante releitura de conflito limpam a fronteira sem repetir mutação', async () => {
  for (const command of COMMANDS.filter(({ action }) => action !== 'create')) {
    for (const conflictCode of ['version_conflict', 'business_rule_conflict']) {
      for (const [status, code, invalidation] of [
        [401, 'invalid_session', 'invalid_session'],
        [403, 'forbidden', 'forbidden'],
      ]) {
        const context = harness([
          { status: 409, body: { error: { code: conflictCode } } },
          { status, body: { error: { code } } },
        ]);
        const outcome = await runCommand(context, command);
        assert.equal(outcome.current, false);
        assert.equal(context.boundary.current.invalidation, invalidation);
        assert.equal(context.requests.filter((request) => request.method !== 'GET').length, 1);
        context.lifecycle.dispose();
      }
    }
  }
});

test('400, 403, 404, três 409 e 422 atravessam cada fluxo real sem mutação automática', async () => {
  const errors = [
    [400, 'invalid_request'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'version_conflict'],
    [409, 'idempotency_conflict'],
    [409, 'business_rule_conflict'],
    [422, 'validation_error'],
  ];
  for (const command of COMMANDS) {
    for (const [status, code] of errors) {
      const responses = [{ status, body: { error: { code } } }];
      if (
        command.action !== 'create' &&
        (code === 'version_conflict' || code === 'business_rule_conflict')
      ) responses.push({ status: 200, body: detail({ versao: 2 }) });
      const context = harness(responses);
      const outcome = await runCommand(context, command);
      assert.equal(context.requests.filter((request) => request.method !== 'GET').length, 1);
      if (status === 403) {
        assert.equal(context.boundary.current.invalidation, 'forbidden');
      } else {
        assert.equal(outcome.current, true);
        assert.equal(outcome.ok, false);
      }
      context.lifecycle.dispose();
    }
  }
});

test('duplo submit compartilha operação, mas somente o líder pode consumir conclusão', async () => {
  const boundary = new AdministrativeUserDataBoundary('admin-A');
  let resolve;
  const gate = new Promise((done) => { resolve = done; });
  let calls = 0;
  const lifecycle = new AdministrativeUserCommandLifecycle({
    boundary,
    discardIntent: () => true,
    createIntent: () => INTENT_ID,
  });
  lifecycle.start();
  const operation = async () => { calls += 1; await gate; return 'ok'; };
  const first = lifecycle.run(operation);
  const second = lifecycle.run(operation);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve();
  const [leader, follower] = await Promise.all([first, second]);
  assert.deepEqual(leader, { current: true, leader: true, ok: true, value: 'ok' });
  assert.deepEqual(follower, { current: true, leader: false, ok: true, value: 'ok' });
  lifecycle.dispose();
});
