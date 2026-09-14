const test = require('node:test');
const { assert, load, fixture, draft, property, receipt, ID, USER_ID, PRODUCER_ID, failure, deferred, tick, tokenResponse } = require('./fixtures/mp35d4');
const m = load('administrativePropertyModels');
const { ApiTransportError } = load('httpTransport');
const edit = () => m.updateAdministrativePropertyEditField(m.createAdministrativePropertyEditModel(property()), 'nome', 'Nome editado');

for (const kind of ['create', 'edit', 'status']) {
  test(`${kind}: payload exato, recibo seguido por GET administrativo e conclusão única`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    if (kind === 'status') f.handlers.get = () => ({ status: 200, body: property({ status: 'inativa' }) });
    const flow = f.flow(kind, kind === 'edit' ? edit() : undefined);
    let completions = 0; flow.onCompleted(() => { completions++; });
    const result = await flow.submit();
    assert.equal(result.phase, 'reconciled'); assert.equal(result.mutationConfirmed, true);
    const request = f.mutations()[0];
    assert.deepEqual(request.body, kind === 'create' ? {
      nome: 'Nova Propriedade', titular_id: PRODUCER_ID, municipio_id: '4305108', status: 'ativa',
    } : kind === 'edit' ? { versao: 2, nome: 'Nome editado' } : { versao: 2, status: 'inativa', motivo: 'fim_relacao' });
    assert.equal(new URL(request.url).pathname, `/v1/propriedades${kind === 'create' ? '' : `/${ID}${kind === 'status' ? '/status' : ''}`}`);
    assert.equal(request.method, kind === 'create' ? 'POST' : 'PATCH'); assert.ok(request.idempotencyKey);
    assert.equal(f.reads().length, 1);
    await flow.submit(); await flow.retryReconciliation();
    assert.equal(f.mutations().length, 1); assert.equal(f.reads().length, 1); assert.equal(completions, 1);
    assert.equal(f.administrativePropertyData.current.details[ID].status, kind === 'status' ? 'inativa' : 'ativa');
  });
  test(`${kind}: duas falhas de GET e recuperação só de leitura, sem chave nova`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    let reads = 0;
    f.handlers.get = () => ++reads < 3 ? failure(503, 'service_unavailable') : { status: 200, body: property() };
    const flow = f.flow(kind, kind === 'edit' ? edit() : undefined);
    let completions = 0; flow.onCompleted(() => completions++);
    assert.equal((await flow.submit()).phase, 'confirmed_reconciliation_failed');
    assert.equal(flow.snapshot.mutationConfirmed, true);
    await flow.submit(); assert.equal(reads, 1);
    assert.equal((await flow.retryReconciliation()).phase, 'confirmed_reconciliation_failed');
    assert.equal((await flow.retryReconciliation()).phase, 'reconciled');
    assert.equal(f.mutations().length, 1); assert.equal(reads, 3); assert.equal(completions, 1);
    assert.equal(f.administrativeCommands.size, 0);
  });
}
test('ID criado vem exclusivamente do recibo e a releitura usa esse ID', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.mutation = () => ({ status: 201, body: receipt('criado', { recurso_id: USER_ID }) });
  f.handlers.get = () => ({ status: 200, body: property({ id: USER_ID }) });
  const result = await f.flow().submit();
  assert.equal(result.property.id, USER_ID);
  assert.equal(new URL(f.reads()[0].url).pathname, `/v1/propriedades/${USER_ID}`);
  assert.equal('id' in f.mutations()[0].body, false);
});
for (const versao of [1, 2, 3]) test(`reconciliação compara versão ${versao} com recibo 2`, async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.get = () => ({ status: 200, body: property({ versao, nome: 'Concorrente', area_total_decimal: '8', area_total: 8 }) });
  const result = await f.flow().submit();
  assert.equal(result.phase, versao < 2 ? 'confirmed_reconciliation_failed' : 'reconciled');
  if (versao >= 2) assert.equal(result.property.nome, 'Concorrente');
  else assert.deepEqual(f.administrativePropertyData.current.details, {});
});
for (const corrupt of [property({ id: USER_ID }), { id: ID }, property({ area_total_decimal: 'NaN' })]) {
  test(`GET incompatível falha fechado sem repetir POST (${JSON.stringify(corrupt).slice(0, 70)})`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    f.handlers.get = () => ({ status: 200, body: corrupt });
    const flow = f.flow(); await flow.submit(); await flow.retryReconciliation();
    assert.equal(flow.snapshot.phase, 'confirmed_reconciliation_failed'); assert.equal(f.mutations().length, 1);
    assert.deepEqual(f.administrativePropertyData.current.details, {});
  });
}
for (const invalid of [receipt('atualizado'), receipt('criado', { recurso_tipo: 'usuario' }),
  receipt('criado', { versao: 0 }), receipt('criado', { conteudo: 'indevido' }), null]) {
  test(`recibo inválido mantém ambiguidade e mesma chave no retry (${JSON.stringify(invalid)})`, async (t) => {
    const f = await fixture(); t.after(() => f.dispose());
    f.handlers.mutation = () => ({ status: 201, body: invalid });
    const flow = f.flow(); assert.equal((await flow.submit()).phase, 'ambiguous');
    assert.equal(f.reads().length, 0); assert.equal(flow.snapshot.mutationConfirmed, false);
    f.handlers.mutation = undefined;
    assert.equal((await flow.submit()).phase, 'reconciled');
    assert.equal(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
  });
}
test('ID de recibo divergente em PATCH/status não é confirmação válida', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  for (const kind of ['edit', 'status']) {
    f.handlers.mutation = () => ({ status: 200, body: receipt(kind === 'edit' ? 'atualizado' : 'status_alterado', { recurso_id: USER_ID }) });
    assert.equal((await f.flow(kind, kind === 'edit' ? edit() : undefined).submit()).phase, 'ambiguous');
  }
  assert.equal(f.reads().length, 0);
});
test('duplo submit compartilha operação; draft capturado e nova intenção usa nova chave', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const gate = deferred(); f.handlers.mutation = () => gate.promise;
  const input = draft({ area_total: '1.2300' }); const flow = f.flow('create', input);
  input.nome = 'Mudou depois'; input.titular.produtor_id = USER_ID;
  const first = flow.submit(); const second = flow.submit(); assert.equal(first, second);
  await tick(); assert.equal(f.mutations().length, 1);
  assert.equal(f.mutations()[0].body.nome, 'Nova Propriedade');
  assert.equal(f.mutations()[0].body.area_total, '1.23');
  assert.equal(f.mutations()[0].body.titular_id, PRODUCER_ID);
  gate.resolve({ status: 201, body: receipt() }); await first;
  f.handlers.mutation = undefined; await f.flow().submit();
  assert.notEqual(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
});
test('erro de transporte preserva mesma chave, payload e versão-base', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.mutation = () => { throw new ApiTransportError(); };
  const flow = f.flow('edit', edit()); await flow.submit();
  assert.equal(flow.snapshot.phase, 'ambiguous');
  f.handlers.mutation = undefined; await flow.submit();
  assert.equal(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
  assert.deepEqual(f.mutations()[0].body, f.mutations()[1].body);
});
test('GET 401 seguido de refresh válido nunca repete mutação confirmada', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  let count = 0;
  f.handlers.get = () => count++ === 0 ? failure(401, 'invalid_session') : { status: 200, body: property() };
  f.handlers.refresh = () => ({ status: 200, body: { ...tokenResponse(), access_token: 'C'.repeat(43), refresh_token: 'D'.repeat(43) } });
  const result = await f.flow().submit();
  assert.equal(result.phase, 'reconciled'); assert.equal(f.mutations().length, 1); assert.equal(f.reads().length, 2);
});
test('version_conflict relê, rebate modelo e bloqueia repetição automática', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.mutation = () => failure(409, 'version_conflict');
  f.handlers.get = () => ({ status: 200, body: property({ versao: 3, area_total: 9, area_total_decimal: '9' }) });
  const flow = f.flow('edit', edit()); const result = await flow.submit();
  assert.equal(result.phase, 'review_required');
  assert.equal(result.error.original.code, 'version_conflict');
  assert.equal(result.error.editModel.draft.area_total, '9');
  assert.equal(result.error.editModel.draft.nome, 'Nome editado');
  assert.deepEqual(m.buildPatchAdministrativePropertyPayload(result.error.editModel), { versao: 3, nome: 'Nome editado' });
  await flow.submit(); assert.equal(f.mutations().length, 1);
  f.handlers.mutation = undefined;
  await f.flow('edit', result.error.editModel).submit();
  assert.notEqual(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
});
test('version_conflict no mesmo campo retorna conflito e falha de GET preserva revisão', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.handlers.mutation = () => failure(409, 'version_conflict');
  f.handlers.get = () => ({ status: 200, body: property({ versao: 3, nome: 'Outro nome' }) });
  const result = await f.flow('edit', edit()).submit();
  assert.ok(result.error.editModel.fieldConflicts.nome);
  f.handlers.get = () => failure(503, 'service_unavailable');
  const failed = await f.flow('edit', edit()).submit();
  assert.equal(failed.phase, 'review_required'); assert.ok(failed.error.reloadError);
});
test('D13 invalida projeções de Usuários sem inventar IDs afetados; edição cadastral preserva', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  for (const kind of ['create', 'status', 'edit']) {
    const generation = f.administrativeUserData.current.generation;
    await f.flow(kind, kind === 'edit' ? edit() : undefined).submit();
    assert.equal(f.administrativeUserData.current.generation, generation + (kind === 'edit' ? 0 : 1));
    assert.equal(f.administrativeUserData.current.mutation, null);
  }
});
test('lista ativa é invalidada com filtros preservados, sem inserir draft local', async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const filters = { status: 'ativa', busca: 'HTTP', limite: 5 };
  await f.administrativeProperties.list(filters);
  f.handlers.get = () => ({ status: 200, body: property({ status: 'inativa' }) });
  await f.flow('status').submit();
  assert.deepEqual(f.administrativePropertyData.current.lists[0], { filters, page: null, stale: true });
  f.handlers.list = () => ({ status: 200, body: { itens: [], paginacao: { proximo_cursor: null } } });
  await f.administrativeProperties.list(filters);
  assert.equal(f.administrativePropertyData.current.lists[0].page.itens.length, 0);
  assert.equal(f.administrativePropertyData.current.details[ID].status, 'inativa');
});
