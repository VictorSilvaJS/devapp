const test = require('node:test');
const { assert, load, USER, PROPERTY, SECOND, PRODUCER, id, fixture, page, relation, historicRelation, titular, user, property, receipt, token, ok, failure, deferred, tick } = require('./fixtures/mp35d5');
const { ApiTransportError } = load('httpTransport');

test('F01 original: Colaborador consulta histórico usuario_autorizado inativo sem PATCH', async t => {
  const history = historicRelation();
  const f = await fixture({ user: { perfil: 'colaborador', status: 'inativo' }, items: [history] }); t.after(f.dispose);
  assert.equal(f.controller.snapshot.phase, 'editing');
  assert.deepEqual(f.controller.snapshot.relations.items, [history]);
  assert.equal(f.controller.snapshot.user.versao, 4);
  assert.equal(f.controller.snapshot.count, 0); assert.equal(f.patches().length, 0);
});
for (const [name, target, history] of [
  ['Colaborador ativo', {}, historicRelation()],
  ['Propriedade inativa', {}, historicRelation({ propriedade_status: 'inativa' })],
  ['Produtor', { perfil: 'produtor', produtor_id: PRODUCER }, historicRelation({ tipo_vinculo: 'colaborador' })],
  ['Admin com usuario_autorizado', { perfil: 'admin' }, historicRelation()],
  ['Admin com colaborador', { perfil: 'admin' }, historicRelation({ tipo_vinculo: 'colaborador' })],
]) test(`F01 histórico: ${name} consulta o tipo original sem autorização automática`, async t => {
  const f = await fixture({ user: target, items: [history] }); t.after(f.dispose);
  assert.equal(f.controller.snapshot.phase, 'editing');
  assert.deepEqual(f.controller.snapshot.relations.items, [history]);
  assert.equal(f.controller.snapshot.count, 0); assert.equal(f.patches().length, 0);
  if (target.perfil === 'admin') {
    f.controller.selectRelation(f.controller.snapshot.relations.items[0], true);
    f.controller.update('reason', 'correcao_administrativa'); f.controller.review();
    await f.controller.searchProperties(''); await f.controller.confirm();
    assert.equal(f.controller.snapshot.count, 0); assert.equal(f.patches().length, 0);
    assert.equal(f.requests.some(r => new URL(r.url).pathname === '/v1/propriedades'), false);
  }
});

for (const [profile, type] of [
  ['colaborador', 'usuario_autorizado'], ['produtor', 'colaborador'],
  ['admin', 'usuario_autorizado'], ['admin', 'colaborador'],
]) test(`F01 negativo: ${profile} recusa ${type} ATIVO mesmo com conta/Propriedade inativas`, async t => {
  const f = await fixture({ user: { perfil: profile, status: 'inativo', produtor_id: profile === 'produtor' ? PRODUCER : null },
    items: [relation({ tipo_vinculo: type, propriedade_status: 'inativa' })] }); t.after(f.dispose);
  assert.equal(f.controller.snapshot.phase, 'error'); assert.equal(f.controller.snapshot.user, null);
  assert.equal(f.controller.snapshot.relations.items.length, 0); assert.equal(f.patches().length, 0);
});

for (const profile of ['admin', 'colaborador']) test(`F01 negativo: Titularidade com status nulo não é histórico direto de ${profile}`, async t => {
  const f = await fixture({ user: { perfil: profile }, items: [titular()] }); t.after(f.dispose);
  assert.equal(f.controller.snapshot.phase, 'error'); assert.equal(f.patches().length, 0);
});

test('F01 negativo: histórico inativo não dispensa a estrutura validada pelo decoder', async t => {
  for (const patch of [{ editavel: false }, { tipo_vinculo: 'titular' }, { versao_vinculo: null }, { propriedade_id: USER + '-invalid' }]) {
    const f = await fixture({ items: [historicRelation(patch)] }); t.after(f.dispose);
    assert.equal(f.controller.snapshot.phase, 'error'); assert.equal(f.patches().length, 0);
  }
});

test('F01 coleção mista: histórico íntegro não bloqueia remoção atual de outra Propriedade', async t => {
  const history = historicRelation();
  const f = await fixture({ items: [relation(), history] }); t.after(f.dispose);
  assert.equal(f.controller.snapshot.relations.items.length, 2); f.remove(); await f.controller.confirm();
  assert.deepEqual(f.patches()[0].body, { versao: 4, adicionar: [], remover: [PROPERTY], motivo: 'fim_relacao' });
  assert.equal(f.controller.snapshot.phase, 'completed'); assert.equal(f.completed, 1);
  assert.deepEqual(f.controller.snapshot.reconciled.itens.find(item => item.id === history.id), history);
});

test('F01 página posterior: histórico mantém páginas e seleção inclusive após retry', async t => {
  const f = await fixture(); t.after(f.dispose); const history = historicRelation(); let nextAttempts = 0;
  f.handlers.relations = request => new URL(request.url).searchParams.has('cursor')
    ? (++nextAttempts === 1 ? failure(503, 'service_unavailable') : ok(page({ itens: [history] })))
    : ok(page({ paginacao: { proximo_cursor: 'history-next' } }));
  await f.controller.searchRelations({}); f.controller.selectRelation(f.controller.snapshot.relations.items[0], false);
  await f.controller.more('relations'); assert.equal(f.controller.snapshot.relations.items.length, 1);
  assert.deepEqual(f.controller.snapshot.removals, [[PROPERTY, 'Propriedade Um']]);
  await f.controller.retry('relations');
  assert.equal(f.controller.snapshot.phase, 'editing'); assert.equal(f.controller.snapshot.relations.nextPageFailure, null);
  assert.deepEqual(f.controller.snapshot.relations.items, [relation(), history]);
  assert.deepEqual(f.controller.snapshot.removals, [[PROPERTY, 'Propriedade Um']]);
  assert.equal(f.controller.snapshot.additions.length, 0); assert.equal(f.patches().length, 0);
});

test('F01 reconciliação: histórico na releitura conclui após falha sem repetir PATCH', async t => {
  const f = await fixture(); t.after(f.dispose); const history = historicRelation(); f.remove();
  f.handlers.relations = () => failure(503, 'service_unavailable'); await f.controller.confirm();
  assert.equal(f.controller.snapshot.phase, 'reconciliation_failed'); assert.equal(f.controller.snapshot.mutationConfirmed, true);
  f.items.push(history); delete f.handlers.relations;
  await f.controller.retryReconciliation(); await f.controller.retryReconciliation();
  assert.equal(f.controller.snapshot.phase, 'completed'); assert.equal(f.controller.snapshot.user.versao, 5);
  assert.equal(f.controller.snapshot.reconciled.versao, 5);
  assert.deepEqual(f.controller.snapshot.reconciled.itens.find(item => item.id === history.id), history);
  assert.equal(f.completed, 1); assert.equal(f.patches().length, 1);
});

test('remoção usa versão do Usuário, confirma uma vez e preserva Admin/conta alvo', async t => {
  const f = await fixture(); t.after(f.dispose); f.remove(); await Promise.all([f.controller.confirm(), f.controller.confirm()]);
  assert.equal(f.patches().length, 1); assert.deepEqual(f.patches()[0].body, { versao: 4, adicionar: [], remover: [PROPERTY], motivo: 'fim_relacao' });
  assert.equal(f.controller.snapshot.phase, 'completed'); assert.equal(f.completed, 1); assert.equal(f.controller.snapshot.user.status, 'ativo');
  assert.equal(f.runtime.session.snapshot.usuario.perfil, 'admin'); assert.equal(f.requests.some(r => /logout|revoke|\/status/.test(r.url)), false);
  await f.controller.confirm(); await f.controller.retryReconciliation(); assert.equal(f.completed, 1); assert.equal(f.patches().length, 1);
});
test('adição remota e reativação usam adicionar; não existe endpoint novo', async t => {
  const f = await fixture({ items: [relation({ status_vinculo: 'inativo' })] }); t.after(f.dispose);
  f.controller.selectRelation(f.controller.snapshot.relations.items[0], true);
  await f.controller.searchProperties('Dois'); f.controller.selectProperty(f.controller.snapshot.catalog.items[0]);
  f.controller.update('reason', 'mudanca_responsabilidade'); f.controller.review(); await f.controller.confirm();
  assert.deepEqual(f.patches()[0].body.adicionar, [PROPERTY, SECOND].sort()); assert.deepEqual(f.patches()[0].body.remover, []);
});
test('sem delta não abre confirmação, cria intenção ou envia PATCH', async t => {
  const f = await fixture(); t.after(f.dispose); f.controller.review(); await f.controller.confirm();
  assert.equal(f.controller.snapshot.phase, 'editing'); assert.equal(f.patches().length, 0); assert.equal(f.runtime.administrativeCommands.size, 0);
});
test('Admin alvo somente consulta; Titularidade não entra em delta', async t => {
  const a = await fixture({ user: { perfil: 'admin' }, items: [] }); t.after(a.dispose);
  await a.controller.searchProperties(''); assert.equal(a.requests.some(r => new URL(r.url).pathname === '/v1/propriedades'), false);
  a.controller.review(); await a.controller.confirm(); assert.equal(a.patches().length, 0);
  const p = await fixture({ user: { perfil: 'produtor', produtor_id: PRODUCER }, items: [titular()] }); t.after(p.dispose);
  p.controller.selectRelation(p.controller.snapshot.relations.items[0], false);
  await p.controller.searchProperties(''); p.controller.selectProperty(p.controller.snapshot.catalog.items[0]); assert.equal(p.controller.snapshot.count, 0);
});
test('paginação preserva seleção e páginas durante falha/retry concorrente', async t => {
  const f = await fixture(); t.after(f.dispose); let attempt = 0; const gate = deferred();
  f.handlers.relations = r => new URL(r.url).searchParams.has('cursor') ? (++attempt === 1 ? failure(503, 'service_unavailable') : gate.promise)
    : ok(page({ paginacao: { proximo_cursor: 'next' } }));
  await f.controller.searchRelations({}); f.controller.selectRelation(f.controller.snapshot.relations.items[0], false);
  await f.controller.more('relations'); assert.equal(f.controller.snapshot.relations.items.length, 1); assert.equal(f.controller.snapshot.count, 1);
  const a = f.controller.retry('relations'), b = f.controller.retry('relations'); await tick(); assert.equal(attempt, 2);
  gate.resolve(ok(page({ itens: [relation({ id: id(8), propriedade_id: SECOND })] }))); await Promise.all([a,b]);
  assert.equal(f.controller.snapshot.relations.items.length, 2); assert.deepEqual(f.controller.snapshot.removals.map(x => x[0]), [PROPERTY]);
  f.handlers.relations = () => ok(page({ itens: [] })); await f.controller.searchRelations({ busca: 'Sem resultado' });
  f.controller.update('reason','fim_relacao'); f.controller.review(); await f.controller.confirm(); assert.deepEqual(f.patches()[0].body.remover, [PROPERTY]);
});
test('página de outra versão exige recarga explícita e nunca é mesclada', async t => {
  const f = await fixture(); t.after(f.dispose);
  f.handlers.relations = r => ok(page(new URL(r.url).searchParams.has('cursor') ? { versao: 5, itens: [relation({ id: id(8) })] } : { paginacao: { proximo_cursor: 'next' } }));
  await f.controller.searchRelations({}); await f.controller.more('relations');
  assert.equal(f.controller.snapshot.phase, 'review'); assert.equal(f.controller.snapshot.relations.items.length, 1);
  const n = f.requests.length; await f.controller.more('relations'); await f.controller.confirm(); assert.equal(f.requests.length, n);
  delete f.handlers.relations; await f.controller.reload(); f.controller.newDecision(); await tick(); assert.equal(f.controller.snapshot.phase, 'editing');
});
test('cursor repetido interrompe paginação sem loop', async t => {
  const f = await fixture(); t.after(f.dispose); f.handlers.relations = () => ok(page({ paginacao: { proximo_cursor: 'same' } }));
  await f.controller.searchRelations({}); await f.controller.more('relations'); assert.equal(f.controller.snapshot.relations.nextPageFailure.restartRequired, true);
  const n = f.requests.length; await f.controller.more('relations'); assert.equal(f.requests.length, n);
});
test('busca antiga que termina depois da nova é inerte', async t => {
  const f = await fixture(); t.after(f.dispose); const gate = deferred();
  f.handlers.relations = r => new URL(r.url).searchParams.get('busca') === 'old' ? gate.promise : ok(page({ itens: [] }));
  const old = f.controller.searchRelations({ busca: 'old' }); await tick(); await f.controller.searchRelations({ busca: 'new' });
  gate.resolve(ok(page())); await old; assert.equal(f.controller.snapshot.relations.items.length, 0);
});
test('403 tardio de busca substituída não invalida consulta nova', async t => {
  const f = await fixture(); t.after(f.dispose); const gate = deferred();
  f.handlers.relations = r => new URL(r.url).searchParams.get('busca') === 'old' ? gate.promise : ok(page());
  const old = f.controller.searchRelations({ busca: 'old' }); await tick(); await f.controller.searchRelations({ busca: 'new' });
  gate.resolve(failure(403, 'forbidden')); await old; assert.equal(f.controller.active, true);
});
test('transporte ambíguo retém chave/corpo/versão, mesmo com GET incidental', async t => {
  const f = await fixture(); t.after(f.dispose); f.handlers.patch = () => { throw new ApiTransportError('network'); };
  f.remove(); await f.controller.confirm(); assert.equal(f.controller.snapshot.phase, 'ambiguous');
  const lease = f.runtime.administrativeUserData.issueLease(); f.runtime.administrativeUserData.publishAuthoritativeUser(lease, user({ versao: 8 }));
  f.controller.update('reason','outro'); await f.controller.reload(); f.controller.newDecision();
  delete f.handlers.patch; await Promise.all([f.controller.confirm(),f.controller.confirm()]);
  assert.equal(f.patches().length, 2); assert.deepEqual(f.patches()[0].body, f.patches()[1].body); assert.equal(f.patches()[0].idempotencyKey, f.patches()[1].idempotencyKey);
});
for (const fault of ['network', 'wrongUser', 'older', 'accountMismatch']) test(`recibo confirmado → ${fault} → recovery somente GET`, async t => {
  const f = await fixture(); t.after(f.dispose); f.remove();
  f.handlers.relations = () => fault === 'network' ? failure(503,'service_unavailable') : ok(page({
    usuario_id: fault === 'wrongUser' ? SECOND : USER, versao: fault === 'older' ? 4 : 5 }));
  if (fault === 'accountMismatch') f.handlers.user = () => ok(user({ versao: 6 }));
  await f.controller.confirm(); assert.equal(f.controller.snapshot.mutationConfirmed, true); assert.equal(f.controller.snapshot.phase,'reconciliation_failed');
  await f.controller.retryReconciliation(); assert.equal(f.patches().length,1); assert.equal(f.completed,0);
  delete f.handlers.relations; delete f.handlers.user; await f.controller.retryReconciliation();
  assert.equal(f.controller.snapshot.phase,'completed'); assert.equal(f.patches().length,1); assert.equal(f.completed,1);
});
test('recibo inválido é ambíguo e nunca dispara releitura como confirmação', async t => {
  const f = await fixture(); t.after(f.dispose); f.handlers.patch = () => ok(receipt({ recurso_id: SECOND }));
  f.remove(); const n = f.requests.length; await f.controller.confirm();
  assert.equal(f.controller.snapshot.phase,'ambiguous'); assert.equal(f.requests.length,n+1); assert.equal(f.completed,0);
});
test('GET posterior ao recibo prevalece e não exige item alterado na primeira página', async t => {
  const f = await fixture(); t.after(f.dispose); f.remove();
  f.handlers.relations = () => ok(page({ versao: 9, itens: [relation({ id: id(10), propriedade_id: SECOND })], paginacao: { proximo_cursor: 'more' } }));
  f.handlers.user = () => ok(user({ versao: 9, nome: 'Versão posterior' })); await f.controller.confirm();
  assert.equal(f.controller.snapshot.phase,'completed'); assert.equal(f.controller.snapshot.user.versao,9);
  assert.equal(f.controller.snapshot.reconciled.itens[0].propriedade_id,SECOND); assert.equal(f.controller.snapshot.count,0);
});
for (const code of ['version_conflict','business_rule_conflict']) test(`${code} relê e exige nova decisão/chave`, async t => {
  const f = await fixture(); t.after(f.dispose); f.handlers.patch = () => { f.user = user({ versao: 7 }); return failure(409,code); };
  f.remove(); await f.controller.confirm(); assert.equal(f.controller.snapshot.phase,'review'); assert.equal(f.controller.snapshot.reloadReady,true);
  await f.controller.confirm(); assert.equal(f.patches().length,1);
  delete f.handlers.patch; f.controller.newDecision(); await tick(); f.remove(); await f.controller.confirm();
  assert.equal(f.patches()[1].body.versao,7); assert.notEqual(f.patches()[0].idempotencyKey,f.patches()[1].idempotencyKey);
});
test('conflito com GET falho conserva necessidade de recarga sem PATCH automático', async t => {
  const f = await fixture(); t.after(f.dispose); f.remove(); f.handlers.patch = () => failure(409,'version_conflict'); f.handlers.relations = () => failure(503,'service_unavailable');
  await f.controller.confirm(); f.controller.newDecision(); assert.equal(f.controller.snapshot.phase,'review'); assert.equal(f.controller.snapshot.reloadReady,false);
  delete f.handlers.relations; await f.controller.reload(); f.controller.newDecision(); await tick(); assert.equal(f.controller.snapshot.phase,'editing'); assert.equal(f.patches().length,1);
});
for (const stage of ['read','patch','reconcile']) for (const status of [401,403]) test(`${status} em ${stage} descarta todos os dados da instância`, async t => {
  const f = await fixture(); t.after(f.dispose); const bad = () => failure(status,status === 401 ? 'invalid_session' : 'forbidden');
  if (stage === 'read') { f.handlers.relations=bad; await f.controller.searchRelations({ busca:'x' }); }
  else { f.remove(); if (stage === 'patch') f.handlers.patch=bad; else f.handlers.relations=bad; await f.controller.confirm(); }
  assert.equal(f.controller.snapshot.phase,'disposed'); assert.equal(f.controller.snapshot.user,null); assert.equal(f.controller.snapshot.count,0);
  assert.equal(f.controller.snapshot.relations.items.length,0); assert.equal(f.completed,0);
});
for (const action of ['logout','profile','identity','dispose']) test(`${action} torna callbacks e respostas antigas inertes`, async t => {
  const f = await fixture(); t.after(f.dispose); const gate = deferred(); f.handlers.patch=()=>gate.promise; f.remove(); const pending=f.controller.confirm(); await tick();
  if (action==='logout') await f.runtime.session.logout();
  else if (action==='dispose') f.dispose();
  else if (action==='identity') { f.handlers.login=()=>{const value=token(); value.usuario.id=SECOND; return ok(value);}; await f.runtime.session.login('other@example.test','Senha 123'); }
  else { f.handlers.me=()=>{const value=token(); return ok({sessao:{id:value.sessao.id},usuario:{...value.usuario,perfil:'produtor',versao_autorizacao:2},escopo:{modo:'vinculos_propriedade',versao:2}});}; await f.runtime.session.revalidate(); }
  gate.resolve(ok(receipt())); await pending; await f.controller.confirm(); await f.controller.reload();
  assert.equal(f.controller.snapshot.phase,'disposed'); assert.equal(f.completed,0); assert.equal(f.patches().length,1);
});
