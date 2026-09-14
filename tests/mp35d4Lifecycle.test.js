const test = require('node:test');
const { assert, load, fixture, property, draft, receipt, ID, PRODUCER_ID, failure, deferred, tick, tokenResponse } = require('./fixtures/mp35d4');
const { AdministrativePropertyDataBoundary } = load('administrativePropertyDataBoundary');
const { ApiTransportError } = load('httpTransport');
const m = load('administrativePropertyModels');

function editWithAdministrativeData() {
  let model = m.createAdministrativePropertyEditModel(property());
  for (const [field, value] of Object.entries({
    nome: 'Intenção local de edição',
    municipio: { municipio_id: '4314902', municipio_nome: 'Porto Alegre', uf_id: '43', uf_sigla: 'RS' },
    area_total: '2.5', cultura_principal: 'Milho',
  })) model = m.updateAdministrativePropertyEditField(model, field, value);
  return model;
}
function assertDiscarded(flow) {
  assert.equal(flow.snapshot.phase, 'cancelled');
  assert.equal(flow.intent, null, 'F1: o próprio lifecycle cancelado ainda conserva a intenção administrativa');
  assert.deepEqual(Object.keys(flow.snapshot).sort(), ['mutationConfirmed', 'phase']);
}
async function assertInert(flow, f) {
  const requests = f.requests.length;
  assert.equal(flow.start(), false);
  assert.equal((await flow.submit()).phase, 'cancelled');
  assert.equal((await flow.retryReconciliation()).phase, 'cancelled');
  assert.equal(f.requests.length, requests);
  assertDiscarded(flow);
}

test('construtor/start são puros; StrictMode setup/cleanup/setup usa nova instância sem mutação', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const retired = f.administrativePropertyCommands.create(draft());
  assert.equal(f.mutations().length, 0);
  assert.equal(retired.start(), true); assert.equal(retired.start(), false);
  retired.dispose(); await assertInert(retired, f);
  const flow = f.administrativePropertyCommands.create(draft());
  assert.equal(flow.start(), true);
  assert.equal(f.mutations().length, 0);
  assert.equal((await flow.submit()).phase, 'reconciled');
  flow.dispose(); assert.equal(flow.start(), false); await flow.submit();
  assert.equal(f.mutations().length, 1);
});
for (const stage of ['mutation', 'get']) test(`dispose durante ${stage} descarta resposta e mantém callback inerte`, async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gate = deferred(); f.handlers[stage] = () => gate.promise;
  const flow = f.flow(); let count = 0; flow.onCompleted(() => count++);
  const running = flow.submit(); await tick(); flow.dispose();
  assertDiscarded(flow);
  gate.resolve({ status: stage === 'mutation' ? 201 : 200, body: stage === 'mutation' ? receipt() : property() });
  await running; assert.equal(flow.snapshot.phase, 'cancelled'); assert.equal(count, 0);
  assertDiscarded(flow);
  assert.deepEqual(f.administrativePropertyData.current.details, {});
  assert.equal(flow.start(), false); await flow.submit(); await flow.retryReconciliation();
  assert.equal(f.mutations().length, 1);
});
for (const profile of ['produtor', 'colaborador']) {
  test(`Admin → ${profile} limpa dados e mata fluxos, retorno Admin só permite novos`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    await f.administrativeProperties.list(); await f.administrativeProperties.getById(ID);
    const gate = deferred(); f.handlers.get = () => gate.promise;
    const old = f.flow(); const running = old.submit(); await tick();
    await f.revalidate(profile);
    assert.equal(old.snapshot.phase, 'cancelled');
    assert.deepEqual(f.administrativePropertyData.current.details, {});
    assert.deepEqual(f.administrativePropertyData.current.lists, []);
    assert.throws(() => f.flow()); await assert.rejects(f.administrativeProperties.getById(ID));
    gate.resolve({ status: 200, body: property() }); await running;
    await f.revalidate('admin'); f.handlers.get = undefined;
    await old.submit(); await old.retryReconciliation(); assert.equal(old.start(), false);
    assert.equal((await f.flow().submit()).phase, 'reconciled'); assert.equal(f.mutations().length, 2);
  });
  test(`${profile} não tem comandos ou leitura administrativa, mas conserva leitura operacional`, async (t) => {
    const f = await fixture(profile); t.after(() => f.dispose());
    assert.throws(() => f.flow()); await assert.rejects(f.administrativeProperties.list());
    assert.equal((await f.properties.getById(ID)).id, ID);
    assert.equal(f.mutations().length, 0);
  });
}
test('logout/nova identidade cancelam fluxos e respostas antigos sem afetar novos', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gate = deferred(); f.handlers.mutation = () => gate.promise;
  const old = f.flow(); const running = old.submit(); await tick();
  await f.session.logout();
  f.handlers.login = () => ({ status: 200, body: tokenResponse('admin', PRODUCER_ID) });
  await f.session.login('outro@example.test', 'Senha 123');
  f.handlers.mutation = undefined;
  assert.equal((await f.flow().submit()).phase, 'reconciled');
  gate.resolve(failure(403, 'forbidden')); await running;
  assert.equal(old.snapshot.phase, 'cancelled'); assert.equal(old.start(), false);
  assert.equal(f.administrativePropertyData.current.authorized, true);
  assert.equal(f.administrativePropertyData.current.details[ID].id, ID);
});
for (const stage of ['mutation', 'get']) {
  test(`401 definitivo em ${stage} invalida sessão/dados e impede recuperação antiga`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    await f.administrativeProperties.list();
    f.handlers[stage] = () => failure(401, 'invalid_session');
    const flow = f.flow(); await flow.submit();
    assert.equal(flow.snapshot.phase, 'cancelled'); assert.equal(f.session.snapshot, null);
    assertDiscarded(flow);
    assert.deepEqual(f.administrativePropertyData.current.lists, []);
    await flow.submit(); await flow.retryReconciliation(); assert.equal(f.mutations().length, 1);
  });
  test(`403 em ${stage} exige revalidação aceita e mantém fluxo antigo cancelado`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    const me = deferred(); f.handlers.me = () => me.promise;
    f.handlers[stage] = () => failure(403, 'forbidden');
    const flow = f.flow(); await flow.submit(); await tick();
    assert.equal(flow.snapshot.phase, 'cancelled');
    assertDiscarded(flow);
    assert.equal(f.administrativePropertyData.current.invalidation, 'forbidden');
    assert.throws(() => f.flow());
    me.resolve({ status: 200, body: f.identity() }); await tick();
    f.handlers[stage] = undefined;
    assert.equal(f.administrativePropertyData.current.authorized, true);
    assert.equal(flow.start(), false); await flow.submit(); await flow.retryReconciliation();
    assert.equal((await f.flow().submit()).phase, 'reconciled'); assert.equal(f.mutations().length, 2);
    assertDiscarded(flow);
  });
}
for (const profile of ['admin', 'produtor', 'colaborador']) for (const order of ['A-first', 'B-first']) {
  test(`/me concorrente ${profile} ${order}: runtime preserva elegibilidade do lease pós-403`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    const gates = []; f.handlers.me = () => { const gate = deferred(); gates.push(gate); return gate.promise; };
    const a = f.session.revalidate(); await tick();
    const old = f.flow(); f.handlers.mutation = () => failure(403, 'forbidden');
    await old.submit(); await tick(); assert.equal(gates.length, 2);
    const responseA = { status: 200, body: f.identity() };
    const responseB = { status: 200, body: f.identity(profile) };
    if (order === 'A-first') { gates[0].resolve(responseA); await tick(); gates[1].resolve(responseB); }
    else { gates[1].resolve(responseB); await tick(); gates[0].resolve(responseA); }
    await a; await tick();
    assert.equal(f.session.snapshot.usuario.perfil, profile);
    assert.equal(f.administrativePropertyData.current.authorized, profile === 'admin');
    assert.equal(old.snapshot.phase, 'cancelled'); assert.equal(old.start(), false);
    assert.equal(gates.length, 2);
    f.handlers.mutation = undefined;
    if (profile === 'admin') assert.equal((await f.flow().submit()).phase, 'reconciled');
    else assert.throws(() => f.flow());
  });
}
test('lease de /me anterior a nova invalidação não restaura autorização', () => {
  const boundary = new AdministrativePropertyDataBoundary(); boundary.synchronizePartition('admin', true);
  boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
  const me = boundary.issueLease();
  boundary.invalidateAccess(boundary.issueLease(), 'forbidden');
  assert.equal(boundary.acceptSessionRevalidation(me, 'admin'), false);
  assert.equal(boundary.current.authorized, false);
});
for (const response of ['success', 'forbidden', 'transport']) test(`resposta/erro tardio ${response} não toma lease retomado`, async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gate = deferred(); f.handlers.get = () => gate.promise;
  const read = f.administrativeProperties.getById(ID).then((value) => ({ value }), (error) => ({ error }));
  await tick();
  f.administrativePropertyData.invalidateAccess(f.administrativePropertyData.issueLease(), 'forbidden');
  await f.revalidate('admin'); f.handlers.get = undefined;
  await f.administrativeProperties.getById(ID);
  const generation = f.administrativePropertyData.current.generation;
  if (response === 'transport') gate.reject(new ApiTransportError());
  else gate.resolve(response === 'success' ? { status: 200, body: property({ nome: 'Antigo' }) } : failure(403, 'forbidden'));
  assert.ok((await read).error);
  assert.equal(f.administrativePropertyData.current.generation, generation);
  assert.equal(f.administrativePropertyData.current.details[ID].nome, 'Propriedade HTTP');
});
test('lista antiga não reaparece após recibo/reconciliação e fronteira dispose é definitivo', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gate = deferred(); f.handlers.list = () => gate.promise;
  const old = f.administrativeProperties.list({ status: 'ativa' }).catch((error) => error);
  await tick(); await f.flow('status').submit();
  gate.resolve({ status: 200, body: { itens: [property()], paginacao: { proximo_cursor: null } } });
  assert.ok(await old instanceof Error);
  assert.equal(f.administrativePropertyData.current.lists[0].stale, true);
  f.administrativePropertyData.dispose();
  assert.deepEqual(f.administrativePropertyData.current.details, {});
  assert.equal(f.administrativePropertyData.activeSubscriptionCount, 0);
  await f.revalidate('admin'); assert.throws(() => f.flow());
});
test('recovery pendente morre com autorização; somente nova intenção pode prosseguir depois', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.get = () => failure(503, 'service_unavailable');
  const flow = f.flow(); await flow.submit();
  const gate = deferred(); f.handlers.get = () => gate.promise;
  const recovery = flow.retryReconciliation(); await tick();
  await f.revalidate('produtor'); await f.revalidate('admin');
  gate.resolve({ status: 200, body: property() }); await recovery;
  assert.equal(flow.snapshot.phase, 'cancelled');
  assertDiscarded(flow);
  await flow.retryReconciliation(); await flow.submit(); assert.equal(f.mutations().length, 1);
  assert.deepEqual(f.administrativePropertyData.current.details, {});
});

for (const profile of ['produtor', 'colaborador']) {
  test(`F1: edição sem submit Admin → ${profile} descarta intenção; retorno Admin cria fluxo independente`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    await f.administrativeProperties.list(); await f.administrativeProperties.getById(ID);
    const flow = f.flow('edit', editWithAdministrativeData());
    const retainedByCaller = flow.intent;
    assert.deepEqual(retainedByCaller.editModel.baseline, property());
    assert.equal(retainedByCaller.editModel.baseline.titular.nome, 'Titular HTTP');
    assert.equal(retainedByCaller.editModel.baseline.municipio_nome, 'Caxias do Sul');
    assert.equal(retainedByCaller.editModel.baseline.area_total_decimal, '1.23');
    assert.equal(retainedByCaller.editModel.baseline.cultura_principal, 'Soja');
    assert.deepEqual(retainedByCaller.body, { versao: 2, nome: 'Intenção local de edição',
      municipio_id: '4314902', area_total: '2.5', cultura_principal: 'Milho' });
    assert.equal(retainedByCaller.editModel.draft.municipio.municipio_nome, 'Porto Alegre');
    assert.equal(retainedByCaller.editModel.draft.area_total, '2.5');
    let completions = 0; flow.onCompleted(() => completions++);
    const gate = deferred(); f.handlers.get = () => gate.promise;
    const lateRead = f.administrativeProperties.getById(ID).catch((error) => error); await tick();
    assert.equal(f.mutations().length, 0);
    await f.revalidate(profile);
    assert.equal(flow.snapshot.phase, 'cancelled');
    assert.deepEqual(f.administrativePropertyData.current.details, {});
    assert.deepEqual(f.administrativePropertyData.current.lists, []);
    assertDiscarded(flow);
    await assertInert(flow, f);
    assert.throws(() => f.flow('edit', editWithAdministrativeData()));
    gate.resolve({ status: 200, body: property({ nome: 'Resposta antiga' }) });
    assert.ok(await lateRead instanceof Error);
    assertDiscarded(flow); assert.equal(completions, 0);
    assert.deepEqual(f.administrativePropertyData.current.details, {});
    await f.revalidate('admin'); f.handlers.get = undefined;
    const fresh = f.flow('edit', editWithAdministrativeData());
    assert.notEqual(fresh.intent.intentId, retainedByCaller.intentId);
    assert.notEqual(fresh.intent, retainedByCaller);
    assert.notEqual(fresh.intent.body, retainedByCaller.body);
    assert.notEqual(fresh.intent.editModel.baseline, retainedByCaller.editModel.baseline);
    assert.notEqual(fresh.intent.editModel.draft, retainedByCaller.editModel.draft);
    await assertInert(flow, f);
    assert.equal((await fresh.submit()).phase, 'reconciled');
    assert.equal(f.mutations().length, 1); assert.equal(completions, 0);
    // The caller's prior reference is outside lifecycle ownership and is not mutated.
    assert.equal(retainedByCaller.editModel.draft.nome, 'Intenção local de edição');
    assertDiscarded(flow);
  });
}

test('F1: criação cancelada por logout descarta Titular/Município/área/cultura antes de notificar', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow('create', draft({ area_total: '1.2300', cultura_principal: 'Soja' }));
  assert.deepEqual(flow.intent.body, { nome: 'Nova Propriedade', titular_id: PRODUCER_ID,
    municipio_id: '4305108', status: 'ativa', area_total: '1.23', cultura_principal: 'Soja' });
  const observed = []; flow.subscribe(() => { if (flow.snapshot.phase === 'cancelled') observed.push(flow.intent); });
  await f.session.logout();
  assertDiscarded(flow); assert.deepEqual(observed, [null]);
  await assertInert(flow, f); assert.equal(f.mutations().length, 0);
});

test('F1: status cancelado por dispose da fronteira descarta versão/destino/motivo/detalhe', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow('status', { property: property(),
    draft: { status: 'inativa', motivo: 'outro', motivo_detalhe: 'Encerramento solicitado' } });
  assert.deepEqual(flow.intent.body, { versao: 2, status: 'inativa', motivo: 'outro', motivo_detalhe: 'Encerramento solicitado' });
  f.administrativePropertyData.dispose();
  assertDiscarded(flow); await assertInert(flow, f);
  assert.equal(f.mutations().length, 0);
});

for (const started of [false, true]) test(`F1: dispose antes de submit descarta edição (start=${started})`, async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.administrativePropertyCommands.update(editWithAdministrativeData());
  assert.ok(flow.intent.editModel.draft);
  if (started) flow.start();
  flow.dispose(); flow.dispose();
  assertDiscarded(flow); await assertInert(flow, f);
  assert.equal(f.administrativePropertyData.activeSubscriptionCount, 0);
  assert.equal(f.mutations().length, 0);
});

test('F1: nova identidade descarta edição sem submit e resposta tardia não a restaura', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow('edit', editWithAdministrativeData()); assert.ok(flow.intent);
  let completions = 0; flow.onCompleted(() => completions++);
  const gate = deferred(); f.handlers.get = () => gate.promise;
  const lateRead = f.administrativeProperties.getById(ID).catch((error) => error); await tick();
  f.handlers.login = () => ({ status: 200, body: tokenResponse('admin', PRODUCER_ID) });
  await f.session.login('outro@example.test', 'Senha 123');
  assertDiscarded(flow); await assertInert(flow, f);
  gate.resolve({ status: 200, body: property() }); assert.ok(await lateRead instanceof Error);
  assertDiscarded(flow); assert.equal(completions, 0);
  assert.deepEqual(f.administrativePropertyData.current.details, {});
});

test('F1: recovery de edição conserva intenção válida, conclui só com GET e descarta ao invalidar', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow('edit', editWithAdministrativeData()); const intent = flow.intent;
  let completions = 0; flow.onCompleted(() => completions++);
  f.handlers.get = () => failure(503, 'service_unavailable');
  assert.equal((await flow.submit()).phase, 'confirmed_reconciliation_failed');
  assert.equal(flow.snapshot.mutationConfirmed, true); assert.equal(flow.intent, intent);
  await flow.submit(); assert.equal(f.reads().length, 1);
  assert.equal((await flow.retryReconciliation()).phase, 'confirmed_reconciliation_failed');
  assert.equal(flow.intent, intent); assert.equal(completions, 0);
  f.handlers.get = undefined;
  assert.equal((await flow.retryReconciliation()).phase, 'reconciled');
  await flow.retryReconciliation(); await flow.submit();
  assert.equal(f.reads().length, 3); assert.equal(f.mutations().length, 1); assert.equal(completions, 1);
  await f.revalidate('produtor');
  assertDiscarded(flow); await assertInert(flow, f);
  assert.equal(completions, 1);
});

test('F1: cancelamento após version_conflict descarta intenção e snapshot com rebase/conflitos', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow('edit', editWithAdministrativeData());
  f.handlers.mutation = () => failure(409, 'version_conflict');
  f.handlers.get = () => ({ status: 200, body: property({ versao: 3, nome: 'Nome concorrente' }) });
  assert.equal((await flow.submit()).phase, 'review_required');
  assert.equal(flow.snapshot.error.editModel.baseline.versao, 3);
  assert.equal(flow.snapshot.error.editModel.fieldConflicts.nome.operatorValue, 'Intenção local de edição');
  assert.ok(flow.intent.editModel.baseline);
  await f.revalidate('colaborador');
  assertDiscarded(flow); await assertInert(flow, f);
  assert.deepEqual(f.administrativePropertyData.current.details, {});
});

test('dispose síncrono ao publicar submitting impede qualquer mutação', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const flow = f.flow(); flow.subscribe(() => { if (flow.snapshot.phase === 'submitting') flow.dispose(); });
  assert.equal((await flow.submit()).phase, 'cancelled'); assert.equal(f.mutations().length, 0);
});
for (const kind of ['list', 'detail']) test(`${kind}: requisição anterior não sobrescreve leitura mais recente`, async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gates = []; f.handlers[kind === 'list' ? 'list' : 'get'] = () => {
    const gate = deferred(); gates.push(gate); return gate.promise;
  };
  const read = () => kind === 'list' ? f.administrativeProperties.list() : f.administrativeProperties.getById(ID);
  const old = read().catch((error) => error); await tick(); const recent = read(); await tick();
  const response = (versao) => ({ status: 200, body: kind === 'list'
    ? { itens: [property({ versao })], paginacao: { proximo_cursor: null } } : property({ versao }) });
  gates[1].resolve(response(4)); await recent; gates[0].resolve(response(2));
  assert.ok(await old instanceof Error);
  assert.equal(kind === 'list' ? f.administrativePropertyData.current.lists[0].page.itens[0].versao
    : f.administrativePropertyData.current.details[ID].versao, 4);
});
