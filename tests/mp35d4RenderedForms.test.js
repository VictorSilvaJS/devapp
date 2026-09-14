const assert = require('node:assert/strict');
const test = require('node:test');
// Same real NavigationContainer/native-stack harness as D-3. Its 11 D-2 cases also execute.
const nav = require('./mp35d2RenderedNavigation.test');
const data = require('./fixtures/mp35d4Selectors');
const { act, flush, waitFor, renderedFixture, mountFixture, unmount, httpNavigationRef, currentRouteName, rootState } = nav;
const { property, ID, USER_ID, PRODUCER_ID, user, users, ufs, page, BA, ITA, SP, RS, ok, failure, deferred } = data;
const load = file => require(`../.tmp-mp35d2-navigation/src/${file}`);
const screens = load('http/screens/HttpAdministrativePropertyFormScreens');
const SelectField = load('components/SelectField').default;
const Footer = load('components/FormFooter').default;
const AppHeader = load('components/AppHeader').default;

function scenario(options = {}) {
  const f = { requests: [], handlers: {}, detail: property(), afterMutation: false };
  const transport = request => {
    const url = new URL(request.url); const path = url.pathname;
    if (path === '/v1/auth/refresh') return failure(401, 'invalid_session');
    if (!/^\/v1\/(propriedades|localidades|usuarios)/.test(path)) return undefined;
    f.requests.push(request);
    if (path === '/v1/localidades/ufs') return f.handlers.ufs?.(request) ?? ok(ufs());
    if (path === '/v1/localidades/municipios') return f.handlers.municipalities?.(request) ?? ok(page([{ '29': BA, '35': SP, '43': RS }[url.searchParams.get('uf_id')]]));
    if (path === '/v1/usuarios') return f.handlers.holders?.(request) ?? ok(users());
    if (path === `/v1/usuarios/${USER_ID}`) return f.handlers.holder?.(request) ?? ok(user());
    if (request.method !== 'GET') {
      f.afterMutation = true;
      if (f.handlers.mutate) return f.handlers.mutate(request);
      const { versao, motivo, motivo_detalhe, ...fields } = request.body;
      const municipality = [BA, ITA, SP, RS].find(item => item.id === fields.municipio_id);
      f.detail = property({ ...f.detail, ...fields, versao: f.detail.versao + 1,
        ...(Object.hasOwn(fields, 'area_total') ? { area_total: fields.area_total === null ? null : Number(fields.area_total), area_total_decimal: fields.area_total } : {}),
        ...(municipality ? { municipio_nome: municipality.nome, uf_id: municipality.uf_id, uf_sigla: { '29': 'BA', '35': 'SP', '43': 'RS' }[municipality.uf_id] } : {}) });
      return { status: request.method === 'POST' ? 201 : 200, body: { resultado: request.method === 'POST' ? 'criado' : path.endsWith('/status') ? 'status_alterado' : 'atualizado', recurso_tipo: 'propriedade', recurso_id: ID, versao: f.detail.versao } };
    }
    if (path === '/v1/propriedades') return f.handlers.list?.(request) ?? ok({ itens: [f.detail], paginacao: { proximo_cursor: null } });
    if (path === `/v1/propriedades/${ID}`) return f.handlers.detail?.(request) ?? ok(f.detail);
    throw new Error(`Unexpected test route ${path}`);
  };
  Object.defineProperties(f, Object.getOwnPropertyDescriptors(renderedFixture({ ...options, additionalTransport: transport })));
  f.mutations = () => f.requests.filter(r => r.method !== 'GET');
  f.reads = () => f.requests.filter(r => new URL(r.url).pathname === `/v1/propriedades/${ID}` && r.method === 'GET');
  return f;
}
async function mount(t, options) {
  const f = scenario(options); const renderer = await mountFixture(f, options?.strict);
  t.after(async () => { await unmount(renderer); assert.equal(f.runtime.administrativePropertyData.activeSubscriptionCount, 0); });
  return { f, renderer };
}
async function navigate(name, params) {
  await act(async () => { httpNavigationRef.navigate(name, params); }); await flush(4);
  assert.equal(currentRouteName(), name);
}
function surface(renderer, editing = currentRouteName() === 'AdministrativePropertyEdit') {
  return renderer.root.findByType(editing ? screens.HttpAdministrativePropertyEditScreen : screens.HttpAdministrativePropertyCreateScreen);
}
function texts(root) { return root.findAllByType('Text').flatMap(n => n.children).filter(x => typeof x === 'string').join(' '); }
function propertyStack() {
  const state = rootState();
  return { index: state.index, routes: state.routes.map(({ name, key, params }) => ({ name, key, id: params?.id })) };
}
function button(root, text) {
  const candidates = root.findAll(n => ['TouchableOpacity', 'Pressable'].includes(n.type) && typeof n.props.onPress === 'function' &&
    n.findAllByType('Text').some(t => t.children.includes(text)));
  return candidates.sort((a, b) => a.findAllByType('Text').length - b.findAllByType('Text').length)[0];
}
async function press(root, text, twice = false) {
  const control = button(root, text); assert.ok(control, `botão ${text}`);
  await act(async () => { control.props.onPress(); if (twice) control.props.onPress(); }); await flush(3);
}
async function input(root, label, value) {
  const control = root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === label);
  assert.ok(control, `campo ${label}`);
  await act(async () => { control.props.onChangeText(value); }); await flush(2);
}
function field(root, label) { return root.findAllByType(SelectField).find(n => n.props.label === label); }
async function choose(root, label, option) {
  const select = field(root, label); assert.ok(select);
  const trigger = select.findAllByType('TouchableOpacity').find(n => n.props.accessibilityLabel === label);
  await act(async () => { trigger.props.onPress(); });
  const choice = select.findAllByType('TouchableOpacity').find(n => n.props.accessibilityLabel === option);
  assert.ok(choice, `opção ${option}`); await act(async () => { choice.props.onPress(); }); await flush(3);
}
async function createReady(renderer) {
  await navigate('AdministrativePropertyCreate'); const root = surface(renderer);
  await input(root, 'Nome da Propriedade', 'Nova HTTP');
  await input(root, 'Buscar Produtor Titular', 'Produtor');
  await choose(root, 'Produtor Titular', 'Produtor HTTP');
  await press(root, 'Confirmar Titular');
  await choose(root, 'UF', 'Bahia (BA)');
  await input(root, 'Buscar Município', 'Ilhéus');
  await choose(root, 'Município', 'Ilhéus'); return root;
}
async function editReady(renderer) {
  await navigate('AdministrativePropertyEdit', { id: ID });
  await waitFor(() => surface(renderer).findAllByType('TextInput').some(n => n.props.value === 'Propriedade HTTP'), 'detalhe administrativo');
  return surface(renderer);
}

test('N1: detalhe → editar → salvar reutiliza a mesma key; Voltar alcança Main', async t => {
  const { f, renderer } = await mount(t);
  await navigate('PropertyDetail', { id: ID });
  const sourceKey = httpNavigationRef.getCurrentRoute().key;
  await press(renderer.root, 'Editar Propriedade');
  const before = propertyStack(); const root = surface(renderer);
  await input(root, 'Nome da Propriedade', 'Nome reconciliado N1');
  const readsBefore = f.reads().length;
  await press(root, 'Salvar alterações');
  const after = propertyStack();
  assert.equal(f.mutations().length, 1); assert.equal(f.mutations()[0].method, 'PATCH');
  assert.equal(f.reads().length - readsBefore, 1, 'um GET de reconciliação');
  await act(async () => { httpNavigationRef.goBack(); }); await flush();
  const afterBack = propertyStack();
  // Inspect before asserting so a pre-fix run records both duplicate keys and the faulty Back.
  t.diagnostic(JSON.stringify({ before, after, afterBack }));
  assert.deepEqual(before.routes.map(route => route.name), ['Main', 'PropertyDetail', 'AdministrativePropertyEdit']);
  assert.deepEqual(after, { index: 1, routes: [before.routes[0], { name: 'PropertyDetail', key: sourceKey, id: ID }] });
  assert.deepEqual(afterBack, { index: 0, routes: [before.routes[0]] });
});

test('N1: detalhe de origem mantém identidade e mostra Nome/Área/Município reconciliados sem refetch', async t => {
  const { f, renderer } = await mount(t);
  await navigate('PropertyDetail', { id: ID }); const origin = httpNavigationRef.getCurrentRoute();
  await press(renderer.root, 'Editar Propriedade'); const edit = surface(renderer);
  assert.deepEqual(httpNavigationRef.getCurrentRoute().params.origin, { routeKey: origin.key, propertyId: ID });
  await input(edit, 'Nome da Propriedade', 'Propriedade reconciliada N1');
  await input(edit, 'Área cadastral em hectares', '8.75');
  await choose(edit, 'UF', 'Bahia (BA)'); await choose(edit, 'Município', 'Ilhéus');
  const beforeReads = f.reads().length;
  await press(edit, 'Salvar alterações', true);
  assert.equal(httpNavigationRef.getCurrentRoute().key, origin.key);
  const authoritative = f.runtime.administrativePropertyData.current.details[ID];
  assert.equal(authoritative.nome, 'Propriedade reconciliada N1');
  assert.equal(authoritative.area_total_decimal, '8.75'); assert.equal(authoritative.municipio_id, BA.id);
  const detail = renderer.root.findByType(load('http/screens/HttpPropertyScreens').HttpPropertyDetailScreen);
  assert.match(texts(detail), /Propriedade reconciliada N1/);
  assert.match(texts(detail), /8[,.]75\s*ha/); assert.match(texts(detail), /Ilhéus\s*\/\s*BA/);
  assert.equal(f.mutations().length, 1); assert.equal(f.reads().length - beforeReads, 1);
  assert.deepEqual(propertyStack().routes.map(r => [r.name, r.id]), [['Main', undefined], ['PropertyDetail', ID]]);
});

test('N1: edição direta termina em um detalhe canônico e Voltar alcança Main', async t => {
  const { f, renderer } = await mount(t); const edit = await editReady(renderer);
  const before = propertyStack(); assert.equal(before.index, 1);
  assert.deepEqual(before.routes.map(r => r.name), ['Main', 'AdministrativePropertyEdit']);
  await input(edit, 'Nome da Propriedade', 'Entrada direta N1'); const readsBefore = f.reads().length;
  let transitions = 0; const stop = httpNavigationRef.addListener('state', () => { transitions += 1; });
  await press(edit, 'Salvar alterações', true); stop();
  const after = propertyStack(); assert.equal(after.index, 1);
  assert.deepEqual(after.routes.map(r => [r.name, r.id]), [['Main', undefined], ['PropertyDetail', ID]]);
  assert.notEqual(after.routes[1].key, before.routes[1].key); assert.equal(transitions, 1);
  assert.equal(f.mutations().length, 1); assert.equal(f.reads().length - readsBefore, 1);
  await act(async () => { httpNavigationRef.goBack(); }); await flush();
  const afterBack = propertyStack(); assert.deepEqual(afterBack, { index: 0, routes: [before.routes[0]] });
  t.diagnostic(JSON.stringify({ before, after, afterBack }));
});

test('N1: falha GET pós-recibo mantém edição; recovery revela o detalhe original exatamente uma vez', async t => {
  const { f, renderer } = await mount(t);
  await navigate('PropertyDetail', { id: ID }); const detailKey = httpNavigationRef.getCurrentRoute().key;
  await press(renderer.root, 'Editar Propriedade'); const edit = surface(renderer); const editKey = httpNavigationRef.getCurrentRoute().key;
  await input(edit, 'Nome da Propriedade', 'Recovery N1');
  const gate = deferred(); let reads = 0;
  f.handlers.detail = () => { reads += 1; return reads === 1 ? gate.promise : reads === 2 ? failure(503, 'service_unavailable') : ok(f.detail); };
  let transitions = 0; const stop = httpNavigationRef.addListener('state', () => { transitions += 1; });
  t.after(stop);
  await press(edit, 'Salvar alterações', true); assert.equal(transitions, 0);
  await act(async () => { gate.resolve(failure(503, 'service_unavailable')); }); await flush();
  assert.match(texts(edit), /confirmada, mas não foi possível atualizar/);
  assert.equal(httpNavigationRef.getCurrentRoute().key, editKey); assert.equal(transitions, 0);
  await press(edit, 'Tentar atualizar', true); assert.equal(transitions, 0);
  const retry = button(edit, 'Tentar atualizar').props.onPress;
  await press(edit, 'Tentar atualizar', true);
  assert.equal(httpNavigationRef.getCurrentRoute().key, detailKey); assert.equal(transitions, 1);
  assert.equal(propertyStack().routes.filter(r => r.name === 'PropertyDetail' && r.id === ID).length, 1);
  assert.equal(f.mutations().length, 1); assert.equal(reads, 3);
  await act(async () => { retry(); retry(); }); await flush();
  assert.equal(transitions, 1); assert.equal(reads, 3);
});

test('N1: origem removida, recriada, incorreta ou não adjacente usa fallback sem duplicar detalhe', async t => {
  for (const invalidation of ['removed', 'new-key', 'other-property', 'other-route', 'not-adjacent']) {
    const f = scenario(); const renderer = await mountFixture(f);
    try {
      await navigate('PropertyDetail', { id: ID }); await press(renderer.root, 'Editar Propriedade');
      const edit = surface(renderer); await input(edit, 'Nome da Propriedade', 'Fallback N1');
      const stack = rootState(); const [main, origin, editRoute] = stack.routes;
      let routes;
      if (invalidation === 'removed') routes = [main, editRoute];
      if (invalidation === 'new-key') routes = [main, { ...origin, key: 'detail-recreated-N1' }, editRoute];
      if (invalidation === 'other-property') routes = [main, { ...origin, params: { id: PRODUCER_ID } }, editRoute];
      if (invalidation === 'other-route') routes = [main, { ...origin, name: 'ChangePassword' }, editRoute];
      if (invalidation === 'not-adjacent') routes = [main, origin, { name: 'ChangePassword', key: 'intervening-N1' }, editRoute];
      await act(async () => { httpNavigationRef.resetRoot({ ...stack, index: routes.length - 1, routes }); }); await flush();
      const before = propertyStack(); assert.equal(httpNavigationRef.getCurrentRoute().key, editRoute.key);
      assert.ok(surface(renderer).findAllByType('TextInput').some(n => n.props.value === 'Fallback N1'));
      const beforeReads = f.reads().length;
      await press(surface(renderer), 'Salvar alterações');
      const after = propertyStack(); const details = after.routes.filter(r => r.name === 'PropertyDetail' && r.id === ID);
      assert.equal(details.length, 1, invalidation); assert.equal(after.routes[after.index].id, ID);
      assert.equal(after.routes[after.index].name, 'PropertyDetail');
      assert.equal(after.routes.some(r => r.name === 'AdministrativePropertyEdit' && r.id === ID), false);
      assert.notEqual(after.routes[after.index].key, origin.key, 'não reutiliza key de origem inválida');
      assert.equal(f.mutations().length, 1); assert.equal(f.reads().length - beforeReads, 1);
      const retained = routes.slice(0, -1).filter(r => !(r.name === 'PropertyDetail' && r.params?.id === ID));
      assert.deepEqual(after.routes.slice(0, -1).map(r => r.key), retained.map(r => r.key), 'histórico não relacionado preservado');
      await act(async () => { httpNavigationRef.goBack(); }); await flush();
      assert.equal(rootState().routes[rootState().index].key, retained.at(-1).key);
      t.diagnostic(JSON.stringify({ invalidation, before, after, afterBack: propertyStack() }));
    } finally { await unmount(renderer); }
  }
});

test('N1: StrictMode, callback repetido e conclusão antiga após retomada não navegam sobre nova edição', async t => {
  const module = load('http/administrativePropertyFormController'); const Original = module.AdministrativePropertyFormController;
  const records = [];
  module.AdministrativePropertyFormController = class extends Original {
    constructor(runtime, id, onCompleted) {
      const record = { callback: onCompleted, calls: 0 };
      super(runtime, id, property => { record.calls += 1; onCompleted(property); onCompleted(property); });
      records.push(record);
    }
  };
  t.after(() => { module.AdministrativePropertyFormController = Original; });
  const { f, renderer } = await mount(t, { strict: true });
  await navigate('PropertyDetail', { id: ID }); const originKey = httpNavigationRef.getCurrentRoute().key;
  await press(renderer.root, 'Editar Propriedade'); const edit = surface(renderer);
  await input(edit, 'Nome da Propriedade', 'Conclusão única N1');
  const callbacksA = records.map(record => record.callback); assert.ok(callbacksA.length >= 2);
  let transitions = 0; const stop = httpNavigationRef.addListener('state', () => { transitions += 1; });
  await press(edit, 'Salvar alterações', true); stop();
  assert.equal(transitions, 1); assert.equal(records.reduce((sum, record) => sum + record.calls, 0), 1);
  assert.equal(httpNavigationRef.getCurrentRoute().key, originKey);
  await act(async () => { const lease = f.runtime.administrativePropertyData.issueLease(); f.runtime.administrativePropertyData.invalidateAccess(lease, 'forbidden'); }); await flush();
  await act(async () => { void f.runtime.session.revalidate(); }); await flush();
  await act(async () => { f.pendingRevalidations.at(-1).resolve(ok(f.sessionIdentityWire())); }); await flush();
  await press(renderer.root, 'Editar Propriedade'); const fresh = surface(renderer);
  await input(fresh, 'Nome da Propriedade', 'Draft novo N1'); const before = propertyStack(); const requestsBefore = f.requests.length;
  await act(async () => { for (const callback of callbacksA) callback(property({ nome: 'Resposta antiga', versao: 99 })); }); await flush();
  assert.deepEqual(propertyStack(), before); assert.equal(f.requests.length, requestsBefore);
  assert.ok(fresh.findAllByType('TextInput').some(n => n.props.value === 'Draft novo N1'));
});

test('N1: Cancelar/Voltar antes do submit preservam origem e callbacks de edição descartada são inertes', async t => {
  const { f, renderer } = await mount(t); await navigate('PropertyDetail', { id: ID });
  const originKey = httpNavigationRef.getCurrentRoute().key;
  await press(renderer.root, 'Editar Propriedade'); const edit = surface(renderer);
  const cancel = edit.findByType(Footer).props.onCancel; const back = edit.findByType(AppHeader).props.onBack;
  await press(edit, 'Cancelar'); assert.equal(httpNavigationRef.getCurrentRoute().key, originKey);
  await act(async () => httpNavigationRef.goBack()); await flush();
  const direct = await editReady(renderer); await input(direct, 'Nome da Propriedade', 'Draft direto N1');
  const before = propertyStack();
  await act(async () => { cancel(); back(); }); await flush(); assert.deepEqual(propertyStack(), before);
  assert.ok(direct.findAllByType('TextInput').some(n => n.props.value === 'Draft direto N1'));
  await act(async () => direct.findByType(AppHeader).props.onBack()); await flush();
  assert.deepEqual(propertyStack().routes.map(r => r.name), ['Main']); assert.equal(f.mutations().length, 0);
});

test('smoke visual Admin: lista → criar → recibo/GET → detalhe → editar PATCH parcial → detalhe', async t => {
  const { f, renderer } = await mount(t);
  assert.ok(button(renderer.root, 'Nova Propriedade'));
  await press(renderer.root, 'Nova Propriedade');
  assert.equal(currentRouteName(), 'AdministrativePropertyCreate');
  // Fill through native controls in the actual shared presentation.
  const root = surface(renderer);
  await input(root, 'Nome da Propriedade', 'Nova HTTP');
  await input(root, 'Buscar Produtor Titular', 'Produtor');
  await choose(root, 'Produtor Titular', 'Produtor HTTP'); await press(root, 'Confirmar Titular');
  await choose(root, 'UF', 'Bahia (BA)'); await choose(root, 'Município', 'Ilhéus');
  await input(root, 'Área cadastral em hectares', '500.2500'); await input(root, 'Cultura principal', 'Milho');
  assert.equal(root.findByType(Footer).props.disabled, false);
  let creationTransitions = 0; const stopCreation = httpNavigationRef.addListener('state', () => { creationTransitions += 1; });
  await press(root, 'Salvar Propriedade', true);
  await waitFor(() => currentRouteName() === 'PropertyDetail', 'sucesso reconciliado');
  stopCreation(); assert.equal(creationTransitions, 1);
  assert.deepEqual(propertyStack().routes.map(r => [r.name, r.id]), [['Main', undefined], ['PropertyDetail', ID]]);
  assert.equal(propertyStack().index, 1);
  assert.deepEqual(f.mutations()[0].body, { nome: 'Nova HTTP', titular_id: PRODUCER_ID, municipio_id: BA.id, status: 'ativa', area_total: '500.25', cultura_principal: 'Milho' });
  assert.equal(f.reads().length, 1); assert.equal(f.mutations().length, 1);
  assert.ok(f.requests.some(r => new URL(r.url).searchParams.get('busca') === 'Produtor'));
  assert.equal(f.requests.filter(r => new URL(r.url).pathname === `/v1/usuarios/${USER_ID}`).length, 2);
  await press(renderer.root, 'Editar Propriedade'); const edit = surface(renderer);
  await input(edit, 'Nome da Propriedade', 'Nome revisado'); await input(edit, 'Área cadastral em hectares', '600.01');
  await choose(edit, 'UF', 'São Paulo (SP)'); await choose(edit, 'Município', 'São Paulo');
  await press(edit, 'Salvar alterações', true);
  assert.equal(currentRouteName(), 'PropertyDetail');
  assert.deepEqual(f.mutations()[1].body, { versao: 3, nome: 'Nome revisado', area_total: '600.01', municipio_id: SP.id });
  assert.match(nav.textContent(renderer), /Nome revisado/);
  assert.equal(f.runtime.administrativePropertyData.current.details[ID].area_total_decimal, '600.01');
});

test('criação bloqueia ausências, confirmação, decimal inválido e revalida ao trocar status inicial', async t => {
  const { f, renderer } = await mount(t); await navigate('AdministrativePropertyCreate'); const root = surface(renderer);
  assert.equal(root.findByType(Footer).props.disabled, true);
  await input(root, 'Nome da Propriedade', 'Nova'); await choose(root, 'Produtor Titular', 'Produtor HTTP');
  await choose(root, 'UF', 'Bahia (BA)'); await choose(root, 'Município', 'Ilhéus');
  assert.equal(root.findByType(Footer).props.disabled, true);
  await press(root, 'Confirmar Titular'); assert.equal(root.findByType(Footer).props.disabled, false);
  for (const value of [' 1.23', '1,23', '1e2']) {
    await input(root, 'Área cadastral em hectares', value); assert.equal(root.findByType(Footer).props.disabled, true);
  }
  await input(root, 'Área cadastral em hectares', ''); await press(root, 'Inativa');
  assert.equal(field(root, 'Produtor Titular').props.selectedOption.label, 'Produtor HTTP');
  assert.equal(root.findByType(Footer).props.disabled, true);
  await press(root, 'Confirmar Titular'); await press(root, 'Ativa');
  assert.equal(root.findByType(Footer).props.disabled, true); await press(root, 'Confirmar Titular');
  await press(root, 'Salvar Propriedade'); assert.equal(Object.hasOwn(f.mutations()[0].body, 'area_total'), false);
});

test('edição mantém Titular/status somente leitura e Município fora da página sem dirty', async t => {
  const { f, renderer } = await mount(t); const root = await editReady(renderer);
  assert.equal(field(root, 'Produtor Titular').props.disabled, true);
  assert.match(texts(root), /Status:.*Ativa/); assert.equal(button(root, 'Inativa'), undefined);
  assert.equal(field(root, 'Município').props.selectedOption.label, 'Caxias do Sul');
  assert.equal(f.requests.filter(r => r.url.includes('/localidades/municipios')).length, 1,
    'uma página inicial, sem varredura e sem GET municipal por ID');
  assert.equal(root.findByType(Footer).props.disabled, true);
  await act(async () => root.findByType(Footer).props.onSubmit()); await flush(); assert.equal(f.mutations().length, 0);
  await input(root, 'Área cadastral em hectares', '1.2300'); assert.equal(root.findByType(Footer).props.disabled, true);
  await input(root, 'Cultura principal', 'Milho'); await input(root, 'Cultura principal', 'Soja');
  assert.equal(root.findByType(Footer).props.disabled, true);
  await input(root, 'Nome da Propriedade', 'Novo nome'); await press(root, 'Salvar alterações');
  assert.deepEqual(f.mutations()[0].body, { versao: 2, nome: 'Novo nome' });
});

test('edição limpa área/cultura apenas por interação explícita; baseline decimal é textual', async t => {
  const { f, renderer } = await mount(t); f.detail = property({ area_total: 1.23, area_total_decimal: '1.2301' });
  const root = await editReady(renderer);
  assert.ok(root.findAllByType('TextInput').some(n => n.props.value === '1.2301'));
  await input(root, 'Área cadastral em hectares', ''); await input(root, 'Cultura principal', '');
  await press(root, 'Salvar alterações');
  assert.deepEqual(f.mutations()[0].body, { versao: 2, area_total: null, cultura_principal: null });
});

test('edição de baseline vazio omite área/cultura intocadas', async t => {
  const { f, renderer } = await mount(t); f.detail = property({ area_total: null, area_total_decimal: null, cultura_principal: null });
  const root = await editReady(renderer); await input(root, 'Nome da Propriedade', 'Nova identificação'); await press(root, 'Salvar alterações');
  assert.deepEqual(f.mutations()[0].body, { versao: 2, nome: 'Nova identificação' });
});

for (const editing of [false, true]) test(`${editing ? 'PATCH' : 'POST'} confirmado: duas falhas GET, recuperação GET e conclusão única`, async t => {
  const { f, renderer } = await mount(t); const root = editing ? await editReady(renderer) : await createReady(renderer);
  if (editing) await input(root, 'Nome da Propriedade', 'Edição confirmada');
  const beforeReads = f.reads().length; const gate = deferred(); let afterReads = 0;
  f.handlers.detail = () => { afterReads += 1; return afterReads === 1 ? gate.promise : afterReads === 2 ? failure(503, 'service_unavailable') : ok({ ...f.detail, versao: f.detail.versao + 1 }); };
  await press(root, editing ? 'Salvar alterações' : 'Salvar Propriedade', true);
  assert.match(texts(root), /confirmada.*Atualizando/); assert.equal(root.findByType(Footer).props.disabled, true);
  assert.equal(currentRouteName(), editing ? 'AdministrativePropertyEdit' : 'AdministrativePropertyCreate');
  await act(async () => { gate.resolve(failure(503, 'service_unavailable')); }); await flush();
  assert.match(texts(root), /confirmada, mas não foi possível atualizar/);
  const staleSubmit = root.findByType(Footer).props.onSubmit;
  await act(async () => { staleSubmit(); }); await flush(); assert.equal(f.mutations().length, 1);
  await press(root, 'Tentar atualizar', true); assert.match(texts(root), /confirmada, mas não foi possível atualizar/);
  let completions = 0; const stop = httpNavigationRef.addListener('state', () => { completions += 1; });
  await press(root, 'Tentar atualizar', true); stop();
  assert.equal(f.reads().length - beforeReads, 3); assert.equal(f.mutations().length, 1);
  assert.equal(currentRouteName(), 'PropertyDetail'); assert.equal(completions, 1);
  assert.equal(f.runtime.administrativePropertyData.current.details[ID].versao, f.detail.versao + 1);
  await act(async () => { staleSubmit(); }); assert.equal(f.mutations().length, 1);
});

test('rebase em tela v1→v2→v3 preserva conflitos de Nome/Área/Município até resolução explícita', async t => {
  const { f, renderer } = await mount(t); f.detail = property({ versao: 1 }); const root = await editReady(renderer);
  await input(root, 'Nome da Propriedade', 'Nome local'); await input(root, 'Área cadastral em hectares', '8');
  await choose(root, 'UF', 'Bahia (BA)'); await choose(root, 'Município', 'Ilhéus');
  f.detail = property({ versao: 2, nome: 'Nome servidor', area_total: 9, area_total_decimal: '9', cultura_principal: 'Trigo', municipio_id: SP.id, municipio_nome: SP.nome, uf_id: '35', uf_sigla: 'SP' });
  f.handlers.mutate = () => failure(409, 'version_conflict');
  await press(root, 'Salvar alterações'); assert.match(texts(root), /Conflito em Nome.*Nome servidor.*Nome local/);
  assert.match(texts(root), /Conflito em Área/); assert.match(texts(root), /Conflito em Município/);
  assert.ok(root.findAllByType('TextInput').some(n => n.props.value === 'Trigo'));
  assert.equal(root.findByType(Footer).props.disabled, true);
  f.detail = { ...f.detail, versao: 3, nome: 'Servidor v3' }; await press(root, 'Atualizar dados');
  assert.match(texts(root), /Conflito em Nome.*Servidor v3.*Nome local/); assert.equal(root.findByType(Footer).props.disabled, true);
  assert.equal(f.mutations().length, 1);
  await press(root, 'Manter minha alteração — Nome'); await press(root, 'Usar valor do servidor — Área');
  await press(root, 'Manter minha alteração — Município'); assert.equal(root.findByType(Footer).props.disabled, false);
  delete f.handlers.mutate; await press(root, 'Salvar alterações');
  assert.deepEqual(f.mutations()[1].body, { versao: 3, nome: 'Nome local', municipio_id: BA.id });
});

test('busca/paginação/retry A1 visual preservam Titular, Município e os demais campos', async t => {
  const { f, renderer } = await mount(t); const root = await createReady(renderer);
  for (const kind of ['holders', 'municipalities']) {
    let attempts = 0; const gate = deferred();
    f.handlers[kind] = request => {
      if (!new URL(request.url).searchParams.has('cursor')) return ok(kind === 'holders' ? users([user()], 'next') : page([BA], 'next'));
      attempts += 1; return attempts === 1 ? failure(503, 'service_unavailable') : gate.promise;
    };
    const label = kind === 'holders' ? 'Produtor Titular' : 'Município';
    await input(root, `Buscar ${label}`, 'busca');
    const getRemote = () => field(root, label).props.remote;
    await act(async () => getRemote().onLoadMore()); await flush();
    const before = f.requests.length;
    await act(async () => { const retry = getRemote().onRetry; retry(); retry(); }); await flush();
    assert.equal(f.requests.length - before, 1); assert.equal(attempts, 2);
    await act(async () => { gate.resolve(ok(kind === 'holders' ? users([user({ id: '55555555-5555-4555-8555-555555555555', nome: 'Outro' })]) : page([ITA]))); }); await flush();
    assert.equal(field(root, label).props.options.length, 2);
    assert.equal(field(root, label).props.selectedOption.label, kind === 'holders' ? 'Produtor HTTP' : 'Ilhéus');
    assert.ok(root.findAllByType('TextInput').some(n => n.props.value === 'Nova HTTP'));
  }
  const oldMunicipality = field(root, 'Município').props.onChange;
  await choose(root, 'UF', 'São Paulo (SP)'); assert.equal(field(root, 'Município').props.value, '');
  await act(async () => oldMunicipality(BA.id)); assert.equal(field(root, 'Município').props.value, '');
});

for (const profile of ['produtor', 'colaborador']) test(`${profile}: ações ausentes e rotas diretas/deep links bloqueados antes de montar`, async t => {
  const { f, renderer } = await mount(t, { initialProfile: profile, initialUrl: 'https://app.tcheagro.example/AdministrativePropertyCreate' });
  assert.equal(button(renderer.root, 'Nova Propriedade'), undefined);
  await navigate('PropertyDetail', { id: ID }); assert.equal(button(renderer.root, 'Editar Propriedade'), undefined);
  for (const route of ['AdministrativePropertyCreate', 'AdministrativePropertyEdit']) {
    assert.equal(rootState().routeNames.includes(route), false);
    await act(async () => httpNavigationRef.navigate(route, { id: ID })); await flush();
    assert.equal(currentRouteName(), 'PropertyDetail');
  }
  assert.equal(renderer.root.findAllByType(screens.HttpAdministrativePropertyCreateScreen).length, 0);
  assert.equal(f.requests.filter(r => /localidades|usuarios/.test(r.url)).length, 0);
});

for (const editing of [false, true]) test(`${editing ? 'edição' : 'criação'}: acesso perdido, retomada e Cancelar/Voltar/submit antigos não afetam B`, async t => {
  const { f, renderer } = await mount(t); const a = editing ? await editReady(renderer) : await createReady(renderer);
  const oldCancel = a.findByType(Footer).props.onCancel; const oldSubmit = a.findByType(Footer).props.onSubmit;
  const oldBack = a.findByType(AppHeader).props.onBack;
  const oldInput = a.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Nome da Propriedade').props.onChangeText;
  await act(async () => { const lease = f.runtime.administrativePropertyData.issueLease(); f.runtime.administrativePropertyData.invalidateAccess(lease, 'forbidden'); }); await flush();
  assert.ok(!rootState().routeNames.includes('AdministrativePropertyCreate'));
  await act(async () => { void f.runtime.session.revalidate(); }); await flush();
  await act(async () => { f.pendingRevalidations.at(-1).resolve(ok(f.sessionIdentityWire())); }); await flush();
  assert.equal(f.runtime.administrativePropertyData.current.authorized, true);
  const b = editing ? await editReady(renderer) : await createReady(renderer);
  await input(b, 'Nome da Propriedade', 'Rascunho B'); const routeKey = httpNavigationRef.getCurrentRoute().key; const count = f.requests.length;
  await act(async () => { oldCancel(); oldBack(); oldSubmit(); oldInput('Velho A'); }); await flush();
  assert.equal(httpNavigationRef.getCurrentRoute().key, routeKey);
  assert.ok(b.findAllByType('TextInput').some(n => n.props.value === 'Rascunho B')); assert.equal(f.requests.length, count);
});

test('StrictMode de tela real cria instâncias novas e limpa subscriptions sem submit automático', async t => {
  const module = load('http/administrativePropertyFormController');
  const Original = module.AdministrativePropertyFormController; const instances = [];
  module.AdministrativePropertyFormController = class extends Original {
    constructor(...args) { super(...args); instances.push(this); }
  };
  t.after(() => { module.AdministrativePropertyFormController = Original; });
  const { f, renderer } = await mount(t, { strict: true });
  const root = await createReady(renderer); const subscriptionCount = f.runtime.administrativePropertyData.activeSubscriptionCount;
  assert.equal(f.mutations().length, 0);
  assert.ok(instances.length >= 2, 'StrictMode realmente executou setup/cleanup/setup');
  const old = instances[0]; assert.equal(old.current, false);
  assert.equal(old.snapshot.inputs, null); assert.equal(old.snapshot.model, null);
  assert.equal(old.holder, null); assert.equal(old.localities, null);
  old.start(); await old.submit(); assert.equal(f.mutations().length, 0);
  await press(root, 'Cancelar'); await createReady(renderer);
  assert.equal(f.runtime.administrativePropertyData.activeSubscriptionCount, subscriptionCount);
  await press(surface(renderer), 'Salvar Propriedade', true); assert.equal(f.mutations().length, 1);
  assert.equal(currentRouteName(), 'PropertyDetail');
});

test('troca de UF incompleta sobrevive a GET/rebase sem restaurar Município anterior', async t => {
  const { f, renderer } = await mount(t); const root = await editReady(renderer);
  await choose(root, 'UF', 'Bahia (BA)'); assert.equal(field(root, 'Município').props.value, '');
  f.detail = { ...f.detail, versao: 3, cultura_principal: 'Milho' };
  await press(root, 'Atualizar dados');
  assert.equal(field(root, 'UF').props.value, '29'); assert.equal(field(root, 'Município').props.value, '');
  assert.equal(root.findByType(Footer).props.disabled, true);
});

test('cursor inválido oferece reinício explícito na UI sem perder seleção nem draft', async t => {
  const { f, renderer } = await mount(t); const root = await createReady(renderer);
  for (const kind of ['holders', 'municipalities']) {
    const label = kind === 'holders' ? 'Produtor Titular' : 'Município';
    f.handlers[kind] = request => new URL(request.url).searchParams.has('cursor')
      ? failure(400, 'invalid_cursor') : ok(kind === 'holders' ? users([user()], 'next') : page([BA], 'next'));
    await input(root, `Buscar ${label}`, 'busca');
    await act(async () => field(root, label).props.remote.onLoadMore()); await flush();
    assert.match(texts(root), /lista mudou/);
    const before = f.requests.length;
    await act(async () => field(root, label).props.remote.onRetry()); await flush();
    assert.equal(f.requests.length, before + 1);
    assert.equal(new URL(f.requests.at(-1).url).searchParams.has('cursor'), false);
    assert.equal(field(root, label).props.selectedOption.label, kind === 'holders' ? 'Produtor HTTP' : 'Ilhéus');
    assert.ok(root.findAllByType('TextInput').some(n => n.props.value === 'Nova HTTP'));
  }
});

test('conflito sem GET mantém draft e exige releitura; rebase sem conflito não repete PATCH', async t => {
  const { f, renderer } = await mount(t); const root = await editReady(renderer);
  await input(root, 'Nome da Propriedade', 'Nome local');
  f.handlers.mutate = () => failure(409, 'version_conflict');
  f.handlers.detail = () => failure(503, 'service_unavailable');
  await press(root, 'Salvar alterações'); assert.match(texts(root), /não foi possível carregar a versão atual/);
  assert.equal(root.findByType(Footer).props.disabled, true);
  f.detail = { ...f.detail, versao: 3, cultura_principal: 'Milho' }; delete f.handlers.detail;
  await press(root, 'Atualizar dados'); assert.equal(root.findByType(Footer).props.disabled, false);
  assert.equal(f.mutations().length, 1); assert.doesNotMatch(texts(root), /Conflito em/);
  delete f.handlers.mutate; await press(root, 'Salvar alterações');
  assert.deepEqual(f.mutations()[1].body, { versao: 3, nome: 'Nome local' });
});

test('Titular inativo não é confirmado para criação ativa e resultado tardio não habilita submit', async t => {
  const { f, renderer } = await mount(t); const root = await createReady(renderer);
  f.handlers.holders = () => ok(users([user({ status: 'inativo' })]));
  f.handlers.holder = () => ok(user({ status: 'inativo' }));
  await press(root, 'Inativa'); await choose(root, 'Produtor Titular', 'Produtor HTTP');
  await press(root, 'Confirmar Titular'); assert.equal(root.findByType(Footer).props.disabled, false);
  await press(root, 'Ativa'); assert.match(texts(root), /não habilitado/);
  const gate = deferred(); f.handlers.holder = () => gate.promise;
  await press(root, 'Confirmar Titular'); await press(root, 'Inativa');
  await act(async () => { gate.resolve(ok(user())); }); await flush();
  assert.equal(root.findByType(Footer).props.disabled, true); assert.equal(f.mutations().length, 0);
});

test('loading e indisponibilidade de seletores são independentes do draft; revalidação final bloqueia POST', async t => {
  const { f, renderer } = await mount(t); const holderGate = deferred();
  f.handlers.holders = () => holderGate.promise;
  await navigate('AdministrativePropertyCreate'); const root = surface(renderer);
  assert.equal(field(root, 'Produtor Titular').props.remote.loading, true);
  await input(root, 'Nome da Propriedade', 'Rascunho mantido'); await input(root, 'Área cadastral em hectares', '9.2');
  f.handlers.municipalities = () => failure(503, 'service_unavailable');
  await choose(root, 'UF', 'Bahia (BA)'); assert.match(texts(root), /Não foi possível carregar as opções/);
  assert.ok(root.findAllByType('TextInput').some(n => n.props.value === '9.2'));
  await act(async () => { holderGate.resolve(ok(users())); }); await flush();
  await choose(root, 'Produtor Titular', 'Produtor HTTP'); await press(root, 'Confirmar Titular');
  const beforeInvalidSearch = f.requests.length;
  await input(root, 'Buscar Produtor Titular', 'a'.repeat(201));
  assert.match(texts(root), /busca com até 200 caracteres/); assert.equal(f.requests.length, beforeInvalidSearch);
  assert.equal(field(root, 'Produtor Titular').props.selectedOption.label, 'Produtor HTTP');
  delete f.handlers.municipalities;
  await act(async () => field(root, 'Município').props.remote.onRetry()); await flush();
  await choose(root, 'Município', 'Ilhéus');
  f.handlers.holder = () => ok(user({ perfil: 'colaborador', produtor_id: null }));
  await press(root, 'Salvar Propriedade'); assert.equal(f.mutations().length, 0); assert.equal(root.findByType(Footer).props.disabled, true);
});

for (const code of [401, 403]) test(`HTTP ${code} descarta o formulário e callbacks; 403 retoma só em nova operação`, async t => {
  const { f, renderer } = await mount(t); const root = await createReady(renderer);
  const submit = root.findByType(Footer).props.onSubmit;
  f.handlers.mutate = () => failure(code, code === 401 ? 'invalid_session' : 'forbidden');
  await press(root, 'Salvar Propriedade'); await flush();
  assert.equal(renderer.root.findAllByType(screens.HttpAdministrativePropertyCreateScreen).length, 0);
  await act(async () => { submit(); }); await flush(); assert.equal(f.mutations().length, 1);
  if (code === 403) {
    assert.equal(f.pendingRevalidations.length, 1);
    await act(async () => { f.pendingRevalidations[0].resolve(ok(f.sessionIdentityWire())); }); await flush();
    delete f.handlers.mutate; const fresh = await createReady(renderer);
    await press(fresh, 'Salvar Propriedade'); assert.equal(f.mutations().length, 2);
    assert.notEqual(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
  }
});

test('403 de seletor também remove a rota e limpa o draft administrativo', async t => {
  const { f, renderer } = await mount(t); f.handlers.holders = () => failure(403, 'forbidden');
  await navigate('AdministrativePropertyCreate').catch(error => {
    assert.equal(currentRouteName(), 'Properties');
  });
  assert.equal(renderer.root.findAllByType(screens.HttpAdministrativePropertyCreateScreen).length, 0);
  assert.equal(rootState().routeNames.includes('AdministrativePropertyCreate'), false);
  assert.equal(f.mutations().length, 0);
});

test('perda de Admin durante POST ou GET pós-recibo impede resposta/navegação antigas', async t => {
  for (const phase of ['mutation', 'reconciliation']) {
    const f = scenario(); const renderer = await mountFixture(f);
    try {
      const root = await createReady(renderer); const gate = deferred(); const submit = root.findByType(Footer).props.onSubmit;
      if (phase === 'mutation') f.handlers.mutate = () => gate.promise;
      else f.handlers.detail = () => gate.promise;
      await press(root, 'Salvar Propriedade'); assert.equal(root.findByType(Footer).props.disabled, true);
      await act(async () => { void f.sessionUi.login('colaborador@example.test', 'Senha válida 123'); }); await flush();
      assert.equal(currentRouteName(), 'Properties');
      await act(async () => { gate.resolve(phase === 'mutation' ? { status: 201, body: { resultado: 'criado', recurso_tipo: 'propriedade', recurso_id: ID, versao: 2 } } : ok(f.detail)); submit(); }); await flush();
      assert.equal(currentRouteName(), 'Properties'); assert.equal(f.mutations().length, 1);
      assert.deepEqual(f.runtime.administrativePropertyData.current.details, {});
    } finally { await unmount(renderer); }
  }
});

test('transporte ambíguo mantém a mesma intenção e bloqueia edição dos campos', async t => {
  const { f, renderer } = await mount(t); const root = await createReady(renderer);
  const { ApiTransportError } = load('http/httpTransport');
  f.handlers.mutate = () => { throw new ApiTransportError('network'); };
  await press(root, 'Salvar Propriedade'); assert.match(texts(root), /conectar ao serviço/);
  assert.equal(root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Nome da Propriedade').props.editable, false);
  delete f.handlers.mutate; await press(root, 'Tentar salvar novamente', true);
  assert.equal(f.mutations().length, 2);
  assert.deepEqual(f.mutations()[0].body, f.mutations()[1].body);
  assert.equal(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
  assert.equal(currentRouteName(), 'PropertyDetail');
});

for (const [status, code, message] of [[422, 'validation_error', /servidor recusou/], [400, 'invalid_request', /formato da solicitação/],
  [404, 'resource_not_found', /não foi encontrado/], [409, 'business_rule_conflict', /regra do cadastro/]]) {
  test(`erro ${status}/${code} em tela usa mensagem controlada sem conteúdo interno`, async t => {
    const { f, renderer } = await mount(t); const root = await createReady(renderer);
    f.handlers.mutate = () => ({ status, body: { error: { code, message: `PostgreSQL segredo ${ID}` } } });
    await press(root, 'Salvar Propriedade'); assert.match(texts(root), message);
    assert.doesNotMatch(texts(root), /PostgreSQL|segredo|11111111/); assert.equal(f.mutations().length, 1);
  });
}

require('./mp35d4RenderedStatus.test')({ nav, data, load, scenario, mount, navigate, texts, propertyStack, button, press, input, field, choose });
