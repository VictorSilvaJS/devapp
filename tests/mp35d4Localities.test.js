const test = require('node:test');
const { assert, load, fixture, localities, deferred, tick, failure, ok, ufs, page,
  VERSION, BA, ITA, SP, RS, property, params } = require('./fixtures/mp35d4Selectors');
const { decodeLocalityUfs, decodeLocalityMunicipalities, InvalidBackendResponseError } = load('decoders');
const { BackendApi, InvalidApiRequestError } = load('backendApi');
const models = load('administrativePropertyModels');

async function municipalityPageFailure(t, selected = true) {
  const { f, c } = await localities(t);
  f.handlers.municipalities = () => ok(page([BA], 'page-2'));
  await c.search('ilh');
  if (selected) c.selectMunicipality(c.snapshot.municipalities.items[0]);
  f.handlers.municipalities = () => failure(503, 'service_unavailable');
  const a = c.loadMore(); const b = c.loadMore(); assert.equal(a, b);
  await Promise.all([a, b]);
  assert.deepEqual(c.snapshot.municipalities.items, [BA]);
  assert.equal(c.snapshot.municipalities.nextPageFailure.retryable, true);
  return { f, c };
}
function assertMunicipalityRecovery(f, c, before, selection, start) {
  const requests = f.selectorRequests().slice(start);
  assert.equal(requests.filter(r => params(r).get('cursor') === 'page-2').length, 1);
  assert.equal(requests.filter(r => !params(r).has('cursor')).length, 0);
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.fromEntries(params(requests[0])), { uf_id: '29', limite: '50', busca: 'ilh', cursor: 'page-2' });
  assert.equal(c.snapshot.municipalities.generation, before.generation);
  assert.equal(c.snapshot.municipalities.query, before.query);
  assert.equal(c.snapshot.municipalities.items, before.items);
  assert.equal(c.snapshot.municipalities.versionId, before.versionId);
  assert.equal(c.snapshot.selected, selection);
}
for (const selected of [false, true]) test(`A1 Município: retries concorrentes preservam página/seleção (${selected}) e anexam recovery`, async t => {
  const { f, c } = await municipalityPageFailure(t, selected);
  const before = c.snapshot.municipalities; const selection = c.snapshot.selected;
  const wait = deferred(); f.handlers.municipalities = () => wait.promise;
  const start = f.selectorRequests().length;
  const a = c.retry(); await tick(); const b = c.retry(); const d = c.retry(); await tick();
  assertMunicipalityRecovery(f, c, before, selection, start);
  assert.equal(a, b); assert.equal(a, d); assert.equal(c.loadMore(), a);
  wait.resolve(ok(page([BA, ITA], 'page-3'))); await Promise.all([a, b, d]);
  assert.deepEqual(c.snapshot.municipalities.items, [BA, ITA]);
  assert.equal(c.snapshot.municipalities.nextCursor, 'page-3');
  assert.equal(c.snapshot.municipalities.versionId, VERSION);
  assert.equal(c.snapshot.municipalities.nextPageFailure, null); assert.equal(c.snapshot.selected, selection);
  // The existing retry-without-failure contract is refresh once recovery has settled.
  f.handlers.municipalities = () => ok(page([ITA])); await c.retry();
  assert.equal(c.snapshot.municipalities.generation, before.generation + 1);
  assert.equal(params(f.selectorRequests().at(-1)).has('cursor'), false);
  assert.deepEqual(c.snapshot.municipalities.items, [ITA]); assert.equal(c.snapshot.selected, selection);
});
test('A1 Município: recovery compartilhada falha novamente e permite retry posterior do mesmo cursor', async t => {
  const { f, c } = await municipalityPageFailure(t); const before = c.snapshot.municipalities;
  const selection = c.snapshot.selected; const wait = deferred(); f.handlers.municipalities = () => wait.promise;
  const start = f.selectorRequests().length; const a = c.retry(); await tick(); const b = c.retry(); await tick();
  assertMunicipalityRecovery(f, c, before, selection, start); assert.equal(a, b);
  const observed = [a.then(() => c.snapshot.municipalities), b.then(() => c.snapshot.municipalities)];
  wait.resolve(failure(503, 'service_unavailable')); const [left, right] = await Promise.all(observed);
  assert.equal(left, right); assert.equal(left.items, before.items); assert.equal(left.nextCursor, 'page-2');
  assert.equal(left.nextPageFailure.retryable, true); assert.equal(c.snapshot.selected, selection);
  f.handlers.municipalities = () => ok(page([ITA])); await c.retry();
  assert.deepEqual(c.snapshot.municipalities.items, [BA, ITA]);
  assert.equal(c.snapshot.municipalities.nextPageFailure, null);
  assert.equal(params(f.selectorRequests().at(-1)).get('cursor'), 'page-2');
});
for (const transition of ['busca', 'UF', 'refresh explícito']) {
  test(`A1 Município: ${transition} invalida recovery compartilhada sem reutilizar operação antiga`, async t => {
    const { f, c } = await municipalityPageFailure(t); const before = c.snapshot.municipalities;
    const selection = c.snapshot.selected; const wait = deferred(); f.handlers.municipalities = () => wait.promise;
    const start = f.selectorRequests().length; const a = c.retry(); await tick(); const b = c.retry(); await tick();
    assertMunicipalityRecovery(f, c, before, selection, start); assert.equal(a, b);
    const next = deferred(); f.handlers.municipalities = () => next.promise;
    const fresh = transition === 'busca' ? c.search('ita') : transition === 'UF'
      ? c.setUf(c.snapshot.ufs.items.find(item => item.id === '35')) : c.refresh();
    await tick(); assert.notEqual(fresh, a);
    assert.equal(c.snapshot.municipalities.generation, before.generation + 1);
    assert.equal(params(f.selectorRequests().at(-1)).has('cursor'), false);
    const current = c.snapshot.municipalities;
    wait.resolve(ok(page([ITA]))); await Promise.all([a, b]); assert.equal(c.snapshot.municipalities, current);
    next.resolve(ok(page([transition === 'UF' ? SP : ITA]))); await fresh;
    assert.deepEqual(c.snapshot.municipalities.items, [transition === 'UF' ? SP : ITA]);
    assert.equal(c.snapshot.selected, transition === 'UF' ? null : selection);
  });
}

test('UFs: contrato real com 27 itens e versão textual; estado idle/loading/ready sem paginação artificial', async t => {
  assert.equal(ufs().itens.length, 27);
  assert.deepEqual(decodeLocalityUfs(ufs()), ufs());
  const f = await fixture(t); const c = f.localities(); const wait = deferred();
  assert.equal(c.snapshot.ufs.phase, 'idle'); f.handlers.ufs = () => wait.promise;
  const pending = c.start(); assert.equal(c.snapshot.ufs.phase, 'loading');
  wait.resolve(ok(ufs())); await pending;
  assert.equal(c.snapshot.ufs.phase, 'ready'); assert.equal(c.snapshot.ufs.items.length, 27);
  assert.equal(c.snapshot.ufs.nextCursor, null);
  const request = f.selectorRequests()[0]; assert.equal(request.url, 'https://api.example.test/v1/localidades/ufs');
  assert.equal(request.method, 'GET'); assert.equal(request.accessToken, 'A'.repeat(43));
});
for (const [label, transform] of [
  ['estrutura', () => []], ['versão ausente', x => { delete x.versao_id; return x; }],
  ['versão UUID', x => ({ ...x, versao_id: '11111111-1111-4111-8111-111111111111' })],
  ['versão inválida', x => ({ ...x, versao_id: `${VERSION}\n` })],
  ['itens ausentes', x => { delete x.itens; return x; }],
  ['ID inválido', x => ({ ...x, itens: [{ id: 'BA', sigla: 'BA', nome: 'Bahia' }] })],
  ['sigla inválida', x => ({ ...x, itens: [{ id: '29', sigla: 'ba', nome: 'Bahia' }] })],
  ['nome ausente', x => ({ ...x, itens: [{ id: '29', sigla: 'BA' }] })],
  ['alias Demo', x => ({ ...x, itens: [{ uf_id: '29', sigla: 'BA', nome: 'Bahia' }] })],
  ['IDs duplicados', x => ({ ...x, itens: [x.itens[0], x.itens[0]] })],
  ['mais de 27', x => ({ ...x, itens: [...x.itens, x.itens[0]] })],
]) test(`decoder UF falha fechado: ${label}`, () => {
  assert.throws(() => decodeLocalityUfs(transform(ufs())), InvalidBackendResponseError);
});
for (const [label, value] of [
  ['estrutura', null], ['versão ausente', { itens: [BA], paginacao: { proximo_cursor: null } }],
  ['versão inválida', page([BA], null, '2026-08-25')],
  ['ID inválido', page([{ ...BA, id: 'local' }])], ['ID de outra UF', page([{ ...BA, id: SP.id }])],
  ['UF incompatível', page([SP])], ['nome ausente', page([{ id: BA.id, uf_id: '29' }])],
  ['chave extra', page([{ ...BA, municipio_id: BA.id }])],
  ['cursor numérico', page([BA], 5)], ['cursor vazio', page([BA], '')],
  ['cursor longo', page([BA], 'x'.repeat(2049))], ['página vazia com cursor', page([], 'cursor')],
  ['paginação ausente', { versao_id: VERSION, itens: [BA] }],
]) test(`decoder Município falha fechado: ${label}`, () => {
  assert.throws(() => decodeLocalityMunicipalities(value, '29'), InvalidBackendResponseError);
});
test('API municipal valida filtros antes do transporte e respeita limites reais, NFC, trim e cursor opaco', async () => {
  const requests = []; const api = new BackendApi({ baseUrl: 'https://api.example.test', transport: {
    async send(request) { requests.push(request); return ok(page()); },
  } });
  for (const filters of [undefined, {}, { uf_id: 29 }, { uf_id: '29\n' }, { uf_id: '29', limite: null },
    { uf_id: '29', limite: 0 }, { uf_id: '29', limite: 101 }, { uf_id: '29', limite: 1.5 },
    { uf_id: '29', busca: null }, { uf_id: '29', busca: 'x'.repeat(201) },
    { uf_id: '29', cursor: null }, { uf_id: '29', cursor: '' }, { uf_id: '29', cursor: 'x'.repeat(2049) },
    { uf_id: '29', municipio: 'Demo' }]) {
    await assert.rejects(api.listLocalityMunicipalities('token', filters), InvalidApiRequestError);
  }
  assert.equal(requests.length, 0);
  await api.listLocalityMunicipalities('token', { uf_id: '29', busca: '   ' });
  assert.equal(params(requests[0]).has('busca'), false); assert.equal(params(requests[0]).get('limite'), '50');
  const cursor = '+ opaque=&/'.padEnd(2048, 'a');
  await api.listLocalityMunicipalities('token', { uf_id: '29', busca: '  Ilhe\u0301us  ', limite: 100, cursor });
  assert.equal(params(requests[1]).get('busca'), 'Ilhéus'); assert.equal(params(requests[1]).get('cursor'), cursor);
  assert.equal(params(requests[1]).get('limite'), '100');
  assert.throws(() => decodeLocalityMunicipalities(page([BA, ITA]), '29', 1));
});
test('UF: erro de contrato/rede, retry e refresh limpam erro sem tocar Município selecionado', async t => {
  const { f, c } = await localities(t); c.selectMunicipality(c.snapshot.municipalities.items[0]);
  const selected = c.snapshot.selected;
  f.handlers.ufs = () => ok({ versao_id: VERSION, itens: [{ id: 'bad' }] }); await c.refreshUfs();
  assert.equal(c.snapshot.ufs.failure.kind, 'incompatible_response');
  f.handlers.ufs = () => failure(503, 'temporarily_unavailable'); await c.retryUfs();
  assert.equal(c.snapshot.ufs.failure.retryable, true);
  f.handlers.ufs = () => ok(ufs()); await c.retryUfs();
  assert.equal(c.snapshot.ufs.phase, 'ready'); assert.equal(c.snapshot.ufs.failure, null);
  assert.equal(c.snapshot.selected, selected);
});
test('Município: dedup, single flight por cursor e seleção da página válida durante paginação', async t => {
  const { f, c } = await localities(t); f.handlers.municipalities = () => ok(page([BA], 'next +/='));
  await c.search('  ilh '); const item = c.snapshot.municipalities.items[0];
  const next = deferred(); f.handlers.municipalities = () => next.promise;
  const a = c.loadMore(); const b = c.loadMore(); assert.equal(a, b); await tick();
  assert.equal(c.snapshot.municipalities.loadingMore, true); assert.equal(c.selectMunicipality(item), true);
  const selected = c.selectionInput(); next.resolve(ok(page([BA, ITA]))); await a;
  assert.deepEqual(c.snapshot.municipalities.items.map(x => x.id), [BA.id, ITA.id]);
  assert.equal(c.snapshot.selected, selected); assert.equal(c.snapshot.municipalities.items[0], item);
  const sent = f.selectorRequests().filter(r => params(r).has('cursor')); assert.equal(sent.length, 1);
  assert.deepEqual(Object.fromEntries(params(sent[0])), { uf_id: '29', limite: '50', busca: 'ilh', cursor: 'next +/=' });
});
test('Município: falha de próxima página preserva páginas/seleção e retry usa exatamente o mesmo GET', async t => {
  const { f, c } = await localities(t); f.handlers.municipalities = () => ok(page([BA], 'next'));
  await c.refresh(); c.selectMunicipality(c.snapshot.municipalities.items[0]); const selected = c.snapshot.selected;
  f.handlers.municipalities = () => failure(503, 'temporarily_unavailable'); await c.loadMore();
  const snapshot = c.snapshot.municipalities; assert.equal(snapshot.phase, 'ready');
  assert.deepEqual(snapshot.items, [BA]); assert.equal(snapshot.nextCursor, 'next');
  assert.equal(snapshot.nextPageFailure.retryable, true); assert.equal(c.snapshot.selected, selected);
  f.handlers.municipalities = () => ok(page([ITA])); await c.retry();
  assert.equal(c.snapshot.municipalities.nextPageFailure, null); assert.equal(c.snapshot.municipalities.items.length, 2);
  const sent = f.selectorRequests().filter(r => params(r).has('cursor')); assert.equal(sent[0].url, sent[1].url);
});
for (const [label, response] of [
  ['cursor inválido/expirado', failure(400, 'invalid_request')],
  ['versão divergente', ok(page([ITA], null, 'ibge-localidades-2026-09-14'))],
  ['cursor cíclico', ok(page([ITA], 'next'))],
]) test(`Município: ${label} exige reinício, preserva páginas e não mistura catálogos`, async t => {
  const { f, c } = await localities(t); f.handlers.municipalities = () => ok(page([BA], 'next')); await c.refresh();
  f.handlers.municipalities = () => response; await c.loadMore();
  assert.deepEqual(c.snapshot.municipalities.items, [BA]);
  assert.equal(c.snapshot.municipalities.nextPageFailure.restartRequired, true);
  if (response.status === 400) assert.equal(c.snapshot.municipalities.nextPageFailure.kind, 'invalid_request');
  const before = f.selectorRequests().length; await c.retry(); assert.equal(f.selectorRequests().length, before);
  f.handlers.municipalities = () => ok(page([ITA], null, 'ibge-localidades-2026-09-14')); await c.refresh();
  assert.deepEqual(c.snapshot.municipalities.items, [ITA]); assert.equal(c.snapshot.municipalities.versionId, 'ibge-localidades-2026-09-14');
  assert.equal(params(f.selectorRequests().at(-1)).has('cursor'), false);
});
for (const change of ['busca', 'UF']) for (const order of ['B antes de A', 'A antes de B']) {
  for (const late of ['sucesso', 'erro', 'paginação']) test(`Município: ${change}, ${order}, ${late} antigo não publica`, async t => {
    const { f, c } = await localities(t); const old = deferred(); const current = deferred();
    if (late === 'paginação') { f.handlers.municipalities = () => ok(page([BA], 'next')); await c.search('ilh'); }
    const item = c.snapshot.municipalities.items[0]; const callback = c.municipalitySelectionCallback(item);
    c.selectMunicipality(item); const selected = c.snapshot.selected;
    f.handlers.municipalities = () => old.promise;
    const a = late === 'paginação' ? c.loadMore() : c.search('ilh'); await tick();
    f.handlers.municipalities = () => current.promise;
    const b = change === 'busca' ? c.search('ita') : c.setUf(c.snapshot.ufs.items.find(x => x.id === '35')); await tick();
    assert.equal(callback(), false); assert.equal(c.selectMunicipality(item), false);
    assert.equal(c.snapshot.selected, change === 'busca' ? selected : null);
    const resultB = change === 'busca' ? ITA : SP;
    const finishA = async () => { old.resolve(late === 'erro' ? failure(503, 'temporarily_unavailable') : ok(page([BA]))); await a; };
    if (order === 'A antes de B') {
      const snapshot = c.snapshot.municipalities; await finishA(); assert.equal(c.snapshot.municipalities, snapshot);
      assert.equal(snapshot.phase, 'loading'); current.resolve(ok(page([resultB]))); await b;
    } else {
      current.resolve(ok(page([resultB]))); await b; const snapshot = c.snapshot.municipalities;
      await finishA(); assert.equal(c.snapshot.municipalities, snapshot);
    }
    assert.deepEqual(c.snapshot.municipalities.items, [resultB]); assert.equal(c.snapshot.municipalities.failure, null);
    assert.equal(c.snapshot.selected, change === 'busca' ? selected : null);
  });
}
test('Município: erro atual não é apagado por sucesso antigo; refresh vazio é estado válido', async t => {
  const { f, c } = await localities(t); const old = deferred(); f.handlers.municipalities = () => old.promise;
  const a = c.search('ilh'); await tick(); f.handlers.municipalities = () => failure(503, 'temporarily_unavailable');
  await c.search('ita'); const snapshot = c.snapshot.municipalities; old.resolve(ok(page())); await a;
  assert.equal(c.snapshot.municipalities, snapshot);
  f.handlers.municipalities = () => ok(page([])); await c.retry();
  assert.equal(c.snapshot.municipalities.phase, 'ready'); assert.deepEqual(c.snapshot.municipalities.items, []);
});
test('edição: Município autoritativo fora da página é exibível, sem GET por ID, varredura ou PATCH espúrio', async t => {
  const f = await fixture(t); const c = f.localities(); const baseline = property();
  c.initializeFromProperty(baseline); assert.equal(f.selectorRequests().length, 0);
  const selected = c.selectionInput(); assert.deepEqual(selected, {
    municipio_id: baseline.municipio_id, municipio_nome: baseline.municipio_nome, uf_id: '43', uf_sigla: 'RS',
  });
  await c.start(); await c.search(''); assert.deepEqual(c.snapshot.municipalities.items, [RS]);
  assert.equal(c.selectionInput(), selected); assert.equal(f.selectorRequests().length, 2);
  let model = models.createAdministrativePropertyEditModel(baseline);
  model = models.updateAdministrativePropertyEditField(model, 'municipio', selected);
  model = models.updateAdministrativePropertyEditField(model, 'nome', 'Nome alterado');
  assert.deepEqual(models.buildPatchAdministrativePropertyPayload(model), { versao: 2, nome: 'Nome alterado' });
  c.selectMunicipality(c.snapshot.municipalities.items[0]);
  model = models.updateAdministrativePropertyEditField(model, 'municipio', c.selectionInput());
  assert.equal(models.buildPatchAdministrativePropertyPayload(model).municipio_id, RS.id);
  const old = c.municipalitySelectionCallback(c.snapshot.municipalities.items[0]);
  await c.setUf(c.snapshot.ufs.items.find(x => x.id === '35'));
  assert.equal(c.selectionInput(), null); assert.equal(old(), false); assert.equal(c.snapshot.selectedUf.sigla, 'SP');
  c.selectMunicipality(c.snapshot.municipalities.items[0]); assert.equal(c.selectionInput().uf_sigla, 'SP');
  assert.equal(c.selectionInput().municipio_id, SP.id);
});
test('inicialização autoritativa substitui query em voo; UF vazia não consulta; callbacks UF de refresh são stale', async t => {
  const { f, c } = await localities(t); const wait = deferred(); f.handlers.municipalities = () => wait.promise;
  const a = c.search('ilh'); await tick(); c.initializeFromProperty(property());
  const selected = c.selectionInput(); wait.resolve(ok(page())); await a;
  assert.equal(c.selectionInput(), selected); assert.equal(c.snapshot.municipalities.query, null);
  const callback = c.ufSelectionCallback(c.snapshot.ufs.items[0]); await c.refreshUfs();
  await callback(); assert.equal(c.snapshot.selectedUf.id, '43');
  c.clearUf(); const before = f.selectorRequests().length; await c.search('ita'); await c.loadMore();
  assert.equal(f.selectorRequests().length, before); assert.equal(c.selectionInput(), null);
});
for (const late of ['sucesso', 'erro']) for (const order of ['A primeiro', 'B primeiro']) {
  test(`UFs: nova geração, ${late} antigo, ${order} preserva consulta B`, async t => {
    const f = await fixture(t); const c = f.localities(); const old = deferred(); const current = deferred();
    f.handlers.ufs = () => old.promise; const a = c.start(); await tick();
    f.handlers.ufs = () => current.promise; const b = c.refreshUfs(); await tick();
    const finishA = async () => { old.resolve(late === 'erro' ? failure(503, 'service_unavailable') : ok(ufs())); await a; };
    const bodyB = { ...ufs(), versao_id: 'ibge-localidades-2026-09-14' };
    if (order === 'A primeiro') {
      const snapshot = c.snapshot.ufs; await finishA(); assert.equal(c.snapshot.ufs, snapshot);
      current.resolve(ok(bodyB)); await b;
    } else {
      current.resolve(ok(bodyB)); await b; const snapshot = c.snapshot.ufs;
      await finishA(); assert.equal(c.snapshot.ufs, snapshot);
    }
    assert.equal(c.snapshot.ufs.versionId, bodyB.versao_id); assert.equal(c.snapshot.ufs.failure, null);
  });
}
test('Localidades: rejeição real do transporte é retryable sem dados de erro retidos', async t => {
  const { f, c } = await localities(t); const { ApiTransportError } = load('httpTransport');
  f.handlers.municipalities = () => { throw new ApiTransportError(); }; await c.search('rede');
  assert.deepEqual(c.snapshot.municipalities.failure, { kind: 'unavailable', retryable: true, restartRequired: false });
  f.handlers.municipalities = () => ok(page()); await c.retry(); assert.equal(c.snapshot.municipalities.phase, 'ready');
});
