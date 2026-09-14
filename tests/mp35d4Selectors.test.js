const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { assert, load, fixture, deferred, tick, failure, ok, ufs, page, BA, SP,
  user, users, params, USER_ID, PRODUCER_ID, ID, tokenResponse, property, draft } = require('./fixtures/mp35d4Selectors');
const { buildCreateAdministrativePropertyPayload } = load('administrativePropertyModels');

async function holderPageFailure(t, selected = true) {
  const f = await fixture(t); const c = f.holder();
  f.handlers.users = () => ok(users([user()], 'page-2')); await c.search('Titular');
  if (selected) c.select(c.snapshot.items[0]);
  f.handlers.users = () => failure(503, 'service_unavailable');
  const a = c.loadMore(); const b = c.loadMore(); assert.equal(a, b); await Promise.all([a, b]);
  assert.equal(c.snapshot.items.length, 1); assert.equal(c.snapshot.nextPageFailure.retryable, true);
  return { f, c };
}
function assertHolderRecovery(f, c, before, start) {
  const requests = f.selectorRequests().slice(start);
  assert.equal(requests.filter(r => params(r).get('cursor') === 'page-2').length, 1);
  assert.equal(requests.filter(r => !params(r).has('cursor')).length, 0); assert.equal(requests.length, 1);
  assert.deepEqual(Object.fromEntries(params(requests[0])), { perfil: 'produtor', status: 'ativo',
    limite: '50', busca: 'Titular', cursor: 'page-2' });
  assert.equal(c.snapshot.generation, before.generation); assert.equal(c.snapshot.query, before.query);
  assert.equal(c.snapshot.items, before.items); assert.equal(c.snapshot.selected, before.selected);
}
for (const selected of [false, true]) test(`A1 Titular: retries concorrentes preservam opções/candidato (${selected}) e anexam recovery`, async t => {
  const { f, c } = await holderPageFailure(t, selected); const before = c.snapshot;
  const wait = deferred(); f.handlers.users = () => wait.promise; const start = f.selectorRequests().length;
  const a = c.retry(); await tick(); const b = c.retry(); const d = c.retry(); await tick();
  assertHolderRecovery(f, c, before, start); assert.equal(a, b); assert.equal(a, d); assert.equal(c.loadMore(), a);
  wait.resolve(ok(users([user(), user({ id: ID })], 'page-3'))); await Promise.all([a, b, d]);
  assert.deepEqual(c.snapshot.items.map(item => item.usuario_id), [USER_ID, ID]);
  assert.equal(c.snapshot.selected, before.selected); assert.equal(c.snapshot.nextCursor, 'page-3');
  assert.equal(c.snapshot.nextPageFailure, null);
  f.handlers.users = () => ok(users([])); await c.retry();
  assert.equal(c.snapshot.generation, before.generation + 1); assert.equal(c.snapshot.selected, before.selected);
  assert.equal(params(f.selectorRequests().at(-1)).has('cursor'), false); assert.deepEqual(c.snapshot.items, []);
});
test('A1 Titular: recovery compartilhada falha novamente sem perder opções e próximo retry recupera', async t => {
  const { f, c } = await holderPageFailure(t); const before = c.snapshot;
  const wait = deferred(); f.handlers.users = () => wait.promise; const start = f.selectorRequests().length;
  const a = c.retry(); await tick(); const b = c.retry(); await tick();
  assertHolderRecovery(f, c, before, start); assert.equal(a, b);
  const observed = [a.then(() => c.snapshot), b.then(() => c.snapshot)];
  wait.resolve(failure(503, 'service_unavailable')); const [left, right] = await Promise.all(observed);
  assert.deepEqual(left, right); assert.equal(left.items, before.items); assert.equal(left.nextCursor, 'page-2');
  assert.equal(left.nextPageFailure.retryable, true); assert.equal(left.selected, before.selected);
  f.handlers.users = () => ok(users([user({ id: ID })])); await c.retry();
  assert.deepEqual(c.snapshot.items.map(item => item.usuario_id), [USER_ID, ID]);
  assert.equal(c.snapshot.nextPageFailure, null); assert.equal(params(f.selectorRequests().at(-1)).get('cursor'), 'page-2');
});
for (const transition of ['busca', 'refresh explícito']) {
  test(`A1 Titular: ${transition} invalida recovery compartilhada e preserva candidato`, async t => {
    const { f, c } = await holderPageFailure(t); const before = c.snapshot;
    const wait = deferred(); f.handlers.users = () => wait.promise; const start = f.selectorRequests().length;
    const a = c.retry(); await tick(); const b = c.retry(); await tick();
    assertHolderRecovery(f, c, before, start); assert.equal(a, b);
    const next = deferred(); f.handlers.users = () => next.promise;
    const fresh = transition === 'busca' ? c.search('Outro') : c.refresh(); await tick();
    assert.notEqual(fresh, a); assert.equal(c.snapshot.generation, before.generation + 1);
    assert.equal(params(f.selectorRequests().at(-1)).has('cursor'), false);
    const current = c.snapshot; wait.resolve(ok(users([user({ id: ID })]))); await Promise.all([a, b]);
    assert.deepEqual(c.snapshot, current); next.resolve(ok(users([]))); await fresh;
    assert.deepEqual(c.snapshot.items, []); assert.equal(c.snapshot.selected, before.selected);
  });
}
for (const event of ['dispose', 'perda de autorização']) {
  test(`A1 recovery: ${event} descarta promises/páginas/seleções dos dois controllers e retomada não revive`, async t => {
    const { f, c: h } = await holderPageFailure(t); const l = f.localities(); await l.start();
    f.handlers.municipalities = () => ok(page([BA], 'page-2'));
    await l.setUf(l.snapshot.ufs.items.find(item => item.id === '29'));
    l.selectMunicipality(l.snapshot.municipalities.items[0]);
    f.handlers.municipalities = () => failure(503, 'service_unavailable'); await l.loadMore();
    const holderWait = deferred(); const localityWait = deferred();
    f.handlers.users = () => holderWait.promise; f.handlers.municipalities = () => localityWait.promise;
    const hBefore = h.snapshot; const lBefore = l.snapshot; const start = f.selectorRequests().length;
    const a = h.retry(); const b = l.retry(); await tick(); const c = h.retry(); const d = l.retry(); await tick();
    const requests = f.selectorRequests().slice(start);
    assert.equal(requests.length, 2); assert.ok(requests.every(r => params(r).get('cursor') === 'page-2'));
    assert.equal(a, c); assert.equal(b, d); assert.equal(h.snapshot.items, hBefore.items);
    assert.equal(l.snapshot.municipalities.items, lBefore.municipalities.items);
    if (event === 'dispose') { h.dispose(); l.dispose(); } else await f.revalidate('produtor');
    assertCancelled(h, l);
    const deadH = h.retry(); const deadL = l.retry(); assert.notEqual(deadH, a); assert.notEqual(deadL, b);
    await Promise.all([deadH, deadL]); assert.equal(f.selectorRequests().length, start + 2);
    if (event !== 'dispose') await f.revalidate('admin');
    f.handlers.users = () => ok(users()); f.handlers.municipalities = () => ok(page([SP]));
    const freshH = f.holder(); const freshL = f.localities(); await freshH.start(); await freshL.start();
    await freshL.setUf(freshL.snapshot.ufs.items.find(item => item.id === '35'));
    holderWait.resolve(ok(users([user({ id: ID })]))); localityWait.resolve(ok(page([BA])));
    await Promise.all([a, b, c, d]); assertCancelled(h, l);
    assert.equal(freshH.snapshot.items[0].usuario_id, USER_ID); assert.deepEqual(freshL.snapshot.municipalities.items, [SP]);
  });
}

test('Titular: repositório existente, duas identidades, GET de detalhe obrigatório e somente produtor_id para criação', async t => {
  const f = await fixture(t); const c = f.holder(); assert.equal(c.repository, f.administrativeUsers);
  await c.start(); assert.deepEqual(Object.fromEntries(params(f.selectorRequests()[0])), { perfil: 'produtor', status: 'ativo', limite: '50' });
  const selected = c.snapshot.items[0]; assert.notEqual(selected.usuario_id, selected.produtor_id);
  assert.equal(c.select(selected), true); assert.equal(c.snapshot.verification, 'unconfirmed');
  const input = await c.prepareSelection(); assert.deepEqual(input, { produtor_id: PRODUCER_ID });
  assert.equal(c.snapshot.verification, 'confirmed');
  assert.equal(f.selectorRequests().at(-1).url, `https://api.example.test/v1/usuarios/${USER_ID}`);
  assert.equal(buildCreateAdministrativePropertyPayload(draft({ titular: input })).titular_id, PRODUCER_ID);
  await c.prepareSelection(); assert.equal(f.selectorRequests().filter(r => new URL(r.url).pathname === `/v1/usuarios/${USER_ID}`).length, 2);
  assert.equal(f.mutations().length, 0); assert.equal(f.reads().length, 0);
});
for (const status of ['ativo', 'pendente', 'inativo']) test(`Titular inativa aceita ${status} sem filtro de status ou Propriedades`, async t => {
  const f = await fixture(t); const c = f.holder('inativa');
  f.handlers.users = () => ok(users([user({ status })])); f.handlers.user = () => ok(user({ status }));
  await c.start(); assert.deepEqual(Object.fromEntries(params(f.selectorRequests()[0])), { perfil: 'produtor', limite: '50' });
  c.select(c.snapshot.items[0]); assert.deepEqual(await c.prepareSelection(), { produtor_id: PRODUCER_ID });
  assert.equal(f.requests.filter(r => /propriedades/.test(r.url)).length, 0);
});
for (const [label, detail] of [
  ['produtor_id divergente', user({ produtor_id: ID })], ['outro usuario_id', user({ id: ID })],
  ['perfil Colaborador', user({ perfil: 'colaborador', produtor_id: null })],
  ['perfil Admin', user({ perfil: 'admin', produtor_id: null })],
  ['cadastro Produtor ausente', user({ produtor_id: null })],
  ['pendente para ativa', user({ status: 'pendente' })], ['inativo para ativa', user({ status: 'inativo' })],
]) test(`revalidação de Titular falha fechada: ${label}`, async t => {
  const f = await fixture(t); const c = f.holder(); await c.start(); c.select(c.snapshot.items[0]);
  f.handlers.user = () => ok(detail); assert.equal(await c.prepareSelection(), null);
  assert.notEqual(c.snapshot.verification, 'confirmed'); assert.ok(c.snapshot.selectionFailure);
  assert.equal(c.snapshot.selected.produtor_id, PRODUCER_ID);
});
test('Titular: inativa → ativa invalida inelegível sem substituição; detalhe pode confirmar ativação posterior', async t => {
  const f = await fixture(t); const c = f.holder('inativa');
  f.handlers.users = () => ok(users([user({ status: 'pendente' })])); await c.start(); c.select(c.snapshot.items[0]);
  f.handlers.user = () => ok(user({ status: 'pendente' })); assert.ok(await c.prepareSelection());
  const selected = c.snapshot.selected; f.handlers.users = () => ok(users([])); await c.setInitialStatus('ativa');
  assert.equal(c.snapshot.selected, selected); assert.equal(c.snapshot.verification, 'invalid');
  assert.equal(c.snapshot.selectionFailure.kind, 'selection_invalid'); assert.equal(params(f.selectorRequests().at(-1)).get('status'), 'ativo');
  assert.equal(await c.prepareSelection(), null); f.handlers.user = () => ok(user()); assert.ok(await c.prepareSelection());
  await c.setInitialStatus('inativa'); assert.equal(c.snapshot.verification, 'unconfirmed');
  assert.equal(params(f.selectorRequests().at(-1)).has('status'), false);
});
test('Titular: busca NFC, cursor, dedup e seleção durante paginação; busca vazia preserva seleção', async t => {
  const f = await fixture(t); const c = f.holder('ativa', 2);
  f.handlers.users = () => ok(users([user()], 'opaque +/=')); await c.search('  Jose\u0301  ');
  const item = c.snapshot.items[0]; const wait = deferred(); f.handlers.users = () => wait.promise;
  const a = c.loadMore(); const b = c.loadMore(); assert.equal(a, b); await tick();
  assert.equal(c.select(item), true); const selected = c.snapshot.selected;
  wait.resolve(ok(users([user(), user({ id: ID, produtor_id: USER_ID })]))); await a;
  assert.equal(c.snapshot.items.length, 2); assert.equal(c.snapshot.items[0], item); assert.equal(c.snapshot.selected, selected);
  assert.deepEqual(Object.fromEntries(params(f.selectorRequests().at(-1))), { perfil: 'produtor', status: 'ativo',
    limite: '2', busca: 'José', cursor: 'opaque +/=' });
  f.handlers.users = () => ok(users([])); await c.search('   ');
  assert.equal(c.snapshot.phase, 'ready'); assert.deepEqual(c.snapshot.items, []); assert.equal(c.snapshot.selected, selected);
  assert.equal(params(f.selectorRequests().at(-1)).has('busca'), false);
});
test('Titular: rede/retry, paginação preservada, refresh e detalhe indisponível não produzem seleção pronta', async t => {
  const f = await fixture(t); const c = f.holder();
  f.handlers.users = () => failure(503, 'service_unavailable'); await c.start();
  assert.equal(c.snapshot.failure.retryable, true); f.handlers.users = () => ok(users([user()], 'next')); await c.retry();
  c.select(c.snapshot.items[0]); f.handlers.users = () => failure(503, 'service_unavailable'); await c.loadMore();
  assert.equal(c.snapshot.items.length, 1); assert.equal(c.snapshot.nextCursor, 'next');
  f.handlers.users = () => ok(users([user({ id: ID })])); await c.retry(); assert.equal(c.snapshot.items.length, 2);
  f.handlers.user = () => failure(503, 'service_unavailable'); assert.equal(await c.prepareSelection(), null);
  assert.equal(c.snapshot.selectionFailure.retryable, true);
  f.handlers.user = () => failure(404, 'not_found'); assert.equal(await c.prepareSelection(), null);
  assert.equal(c.snapshot.selectionFailure.kind, 'selection_invalid');
  f.handlers.user = () => ok(user()); assert.ok(await c.prepareSelection());
});
for (const change of ['busca', 'status']) for (const late of ['sucesso', 'erro', 'paginação']) {
  for (const order of ['B antes de A', 'A antes de B']) test(`Titular: ${change}, ${late}, ${order} descarta A e callback`, async t => {
    const f = await fixture(t); const c = f.holder('inativa');
    f.handlers.users = () => ok(users([user()], 'next')); await c.start();
    const item = c.snapshot.items[0]; c.select(item); const callback = c.selectionCallback(item);
    const old = deferred(); const current = deferred(); f.handlers.users = () => old.promise;
    const a = late === 'paginação' ? c.loadMore() : c.search('ilh'); await tick();
    f.handlers.users = () => current.promise;
    const b = change === 'busca' ? c.search('ita') : c.setInitialStatus('ativa'); await tick();
    assert.equal(callback(), false); assert.equal(c.select(item), false);
    const finishA = async () => { old.resolve(late === 'erro' ? failure(503, 'service_unavailable') : ok(users())); await a; };
    if (order === 'A antes de B') {
      const snapshot = c.snapshot; await finishA(); assert.deepEqual(c.snapshot, snapshot); assert.equal(c.snapshot.phase, 'loading');
      current.resolve(ok(users([user({ id: ID })]))); await b;
    } else {
      current.resolve(ok(users([user({ id: ID })]))); await b;
      const snapshot = c.snapshot; await finishA(); assert.deepEqual(c.snapshot, snapshot);
    }
    assert.equal(c.snapshot.items[0].usuario_id, ID); assert.equal(c.snapshot.selected, item);
    assert.equal(c.snapshot.failure, null);
  });
}
for (const change of ['seleção', 'status', 'limpeza']) test(`detalhe de Titular em voo: ${change} invalida confirmação anterior`, async t => {
  const f = await fixture(t); const c = f.holder();
  f.handlers.users = () => ok(users([user(), user({ id: ID, produtor_id: USER_ID })]));
  await c.start(); c.select(c.snapshot.items[0]); const wait = deferred(); f.handlers.user = () => wait.promise;
  const a = c.prepareSelection(); const duplicate = c.prepareSelection(); assert.equal(a, duplicate); await tick();
  if (change === 'seleção') c.select(c.snapshot.items[1]);
  else if (change === 'status') await c.setInitialStatus('inativa'); else c.clearSelection();
  const snapshot = c.snapshot; wait.resolve(ok(user())); assert.equal(await a, null); assert.deepEqual(c.snapshot, snapshot);
});
test('detalhe permanece independente da busca; busca não troca candidato nem impede confirmação', async t => {
  const f = await fixture(t); const c = f.holder(); await c.start(); c.select(c.snapshot.items[0]);
  const wait = deferred(); f.handlers.user = () => wait.promise; const a = c.prepareSelection(); await tick();
  f.handlers.users = () => ok(users([])); await c.search('outro'); wait.resolve(ok(user({ nome: 'Nome atualizado' })));
  assert.deepEqual(await a, { produtor_id: PRODUCER_ID }); assert.equal(c.snapshot.selected.nome, 'Nome atualizado');
  assert.equal(c.snapshot.items.length, 0);
});
function assertCancelled(holder, localities) {
  const h = holder.snapshot; assert.equal(h.phase, 'cancelled'); assert.equal(h.selected, null);
  assert.equal(h.initialStatus, null); assert.equal(h.query, null); assert.deepEqual(h.items, []);
  assert.equal(h.nextCursor, null); assert.equal(h.failure, null); assert.equal(h.nextPageFailure, null);
  assert.equal(h.selectionFailure, null); assert.equal(h.loadingMore, false); assert.equal(h.verification, 'unconfirmed');
  const l = localities.snapshot; assert.equal(l.cancelled, true); assert.equal(l.selected, null); assert.equal(l.selectedUf, null);
  for (const q of [l.ufs, l.municipalities]) {
    assert.equal(q.phase, 'cancelled'); assert.equal(q.query, null); assert.deepEqual(q.items, []);
    assert.equal(q.nextCursor, null); assert.equal(q.versionId, null); assert.equal(q.failure, null);
    assert.equal(q.nextPageFailure, null); assert.equal(q.loadingMore, false);
  }
}
for (const event of ['produtor', 'colaborador', 'identidade', 'logout', 'dispose', 'reconciliação']) {
  test(`F1 e sessão: ${event} descarta seleções/queries antes de notificar; retomada exige controllers novos`, async t => {
    const f = await fixture(t); const baselineSubscriptions = f.administrativeUserData.activeSubscriptionCount;
    const h = f.holder(); const l = f.localities(); await h.start(); await l.start();
    h.select(h.snapshot.items[0]); await l.setUf(l.snapshot.ufs.items.find(x => x.id === '29'));
    l.selectMunicipality(l.snapshot.municipalities.items[0]);
    const holderCallback = h.selectionCallback(h.snapshot.items[0]);
    const municipalityCallback = l.municipalitySelectionCallback(l.snapshot.municipalities.items[0]);
    const waits = [deferred(), deferred(), deferred(), deferred()];
    f.handlers.users = () => waits[0].promise; f.handlers.user = () => waits[1].promise;
    f.handlers.ufs = () => waits[2].promise; f.handlers.municipalities = () => waits[3].promise;
    const pending = [h.search('administrativo'), h.prepareSelection(), l.refreshUfs(), l.search('ilh')]; await tick();
    let hNotified = 0; let lNotified = 0;
    h.subscribe(() => { if (h.snapshot.phase === 'cancelled') { assert.equal(h.snapshot.selected, null); hNotified++; } });
    l.subscribe(() => { if (l.snapshot.cancelled) {
      assert.equal(l.snapshot.selected, null); assert.equal(l.snapshot.ufs.query, null);
      assert.equal(l.snapshot.municipalities.query, null); lNotified++;
    } });
    if (event === 'produtor' || event === 'colaborador') await f.revalidate(event);
    else if (event === 'identidade') {
      f.handlers.login = () => ok(tokenResponse('admin', PRODUCER_ID)); await f.session.login('outro@example.test', 'Senha 123');
    } else if (event === 'logout') await f.session.logout();
    else if (event === 'reconciliação') f.administrativeUserData.invalidateReconciliation(f.administrativeUserData.issueLease());
    else { h.dispose(); l.dispose(); }
    assertCancelled(h, l); assert.equal(hNotified, 1); assert.equal(lNotified, 1);
    assert.equal(f.administrativeUserData.activeSubscriptionCount, baselineSubscriptions);
    f.handlers.login = () => ok(tokenResponse()); await f.session.login('admin@example.test', 'Senha 123');
    f.handlers.users = () => ok(users()); f.handlers.user = () => ok(user());
    f.handlers.ufs = () => ok(ufs()); f.handlers.municipalities = () => ok(page());
    const freshH = f.holder(); const freshL = f.localities(); await freshH.start(); await freshL.start();
    freshH.select(freshH.snapshot.items[0]); freshL.initializeFromProperty(property());
    assert.ok(await freshH.prepareSelection()); assert.ok(freshL.selectionInput());
    waits[0].resolve(ok(users())); waits[1].resolve(ok(user())); waits[2].resolve(ok(ufs())); waits[3].resolve(ok(page()));
    const outcomes = await Promise.all(pending); assert.equal(outcomes[1], null);
    assertCancelled(h, l); assert.equal(holderCallback(), false); assert.equal(municipalityCallback(), false);
    const count = f.selectorRequests().length;
    await h.start(); await h.search('reviver'); await h.setInitialStatus('ativa'); await h.retry(); await h.loadMore();
    assert.equal(await h.prepareSelection(), null); h.clearSelection(); h.dispose();
    await l.start(); await l.search('reviver'); await l.refreshUfs(); await l.loadMore();
    l.initializeFromProperty(property()); l.clearUf(); l.dispose();
    assert.equal(f.selectorRequests().length, count); assertCancelled(h, l);
    assert.equal(hNotified, 1); assert.equal(lNotified, 1); assert.equal(f.mutations().length, 0);
  });
}
for (const resource of ['users', 'user', 'ufs', 'municipalities']) for (const status of [401, 403]) {
  test(`autorização: ${resource} ${status} cancela Titular/Localidades; /me existente permite retomada nova`, async t => {
    const f = await fixture(t); const h = f.holder(); const l = f.localities();
    await h.start(); h.select(h.snapshot.items[0]); await l.start();
    await l.setUf(l.snapshot.ufs.items.find(x => x.id === '29')); l.selectMunicipality(l.snapshot.municipalities.items[0]);
    const me = deferred(); if (status === 403) f.handlers.me = () => me.promise;
    f.handlers[resource] = () => failure(status, status === 401 ? 'invalid_session' : 'forbidden');
    if (resource === 'users') await h.refresh(); else if (resource === 'user') await h.prepareSelection();
    else if (resource === 'ufs') await l.refreshUfs(); else await l.refresh();
    await tick(); assertCancelled(h, l); assert.throws(() => f.holder()); assert.throws(() => f.localities());
    if (status === 403) { me.resolve(ok(f.identity())); await tick(); }
    else { f.handlers.login = () => ok(tokenResponse()); await f.session.login('admin@example.test', 'Senha 123'); }
    f.handlers.users = () => ok(users()); f.handlers.ufs = () => ok(ufs());
    const fresh = f.holder(); await fresh.start(); assert.equal(fresh.snapshot.phase, 'ready'); assertCancelled(h, l);
  });
}
for (const profile of ['produtor', 'colaborador']) test(`criação dos selectors recusa perfil ${profile}`, async t => {
  const f = await fixture(t, profile); assert.throws(() => f.holder()); assert.throws(() => f.localities());
  assert.equal(f.selectorRequests().length, 0);
});
test('dispose é definitivo mesmo antes de start; listener que cancela validating/confirmed impede seleção pronta', async t => {
  const f = await fixture(t); const h = f.holder(); const l = f.localities(); h.dispose(); l.dispose();
  await h.start(); await l.start(); assertCancelled(h, l); assert.equal(f.selectorRequests().length, 0);
  for (const state of ['validating', 'confirmed']) {
    const c = f.holder(); await c.start(); c.select(c.snapshot.items[0]);
    c.subscribe(() => { if (c.snapshot.verification === state) c.dispose(); });
    assert.equal(await c.prepareSelection(), null); assert.equal(c.snapshot.selected, null);
  }
});
test('arquitetura: controllers internos sem comandos, persistência, Demo, catálogo local ou dependência visual', () => {
  for (const file of ['administrativeHolderController.ts', 'administrativeLocalityController.ts', 'administrativeSelectionController.ts']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/http', file), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(?:mock|demo|storage|navigation|react|ibge)/i);
    assert.doesNotMatch(source, /(?:create|update|changeStatus)AdministrativeProperty\(|\.submit\(/);
  }
  const lifecycle = fs.readFileSync(path.join(__dirname, '../src/http/administrativePropertyCommandLifecycle.ts'), 'utf8');
  assert.match(lifecycle, /#intent = null/);
});
test('Titular: transporte rejeitado permite retry; erro corrente não é apagado por sucesso antigo', async t => {
  const f = await fixture(t); const c = f.holder(); const { ApiTransportError } = load('httpTransport');
  const old = deferred(); f.handlers.users = () => old.promise; const a = c.search('ilh'); await tick();
  f.handlers.users = () => { throw new ApiTransportError(); }; await c.search('ita'); const snapshot = c.snapshot;
  old.resolve(ok(users())); await a; assert.deepEqual(c.snapshot, snapshot); assert.equal(c.snapshot.failure.retryable, true);
  f.handlers.users = () => ok(users()); await c.retry(); assert.equal(c.snapshot.phase, 'ready');
});
test('Titular: lista incompatível com perfil/filtro ativo não fornece candidatos', async t => {
  const f = await fixture(t); const c = f.holder();
  for (const invalid of [user({ perfil: 'admin', produtor_id: null }), user({ status: 'inativo' })]) {
    f.handlers.users = () => ok(users([invalid])); await c.search('');
    assert.equal(c.snapshot.phase, 'error'); assert.deepEqual(c.snapshot.items, []);
    assert.equal(c.snapshot.failure.kind, 'incompatible_response'); assert.equal(await c.prepareSelection(), null);
  }
});
