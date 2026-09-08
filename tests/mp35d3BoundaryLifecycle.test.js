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

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCER_ID = '22222222-2222-4222-8222-222222222222';
const INTENT_A = createAdministrativeIntentId(() => '33333333-3333-4333-8333-333333333333');
const ACCESS_TOKEN = 'A'.repeat(43);

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
