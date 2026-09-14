const assert = require('node:assert/strict');
const test = require('node:test');

// Registered in the forms runner: the real D-2 navigation harness is imported only once.
module.exports = h => {
  const { nav, data, load, mount, scenario, navigate, texts, propertyStack, button, press, input, field, choose } = h;
  const { act, flush, mountFixture, unmount, httpNavigationRef, currentRouteName, rootState } = nav;
  const { ID, property, ok, failure, deferred } = data;
  const modal = renderer => renderer.root.findAllByType('Modal').find(n => n.props.visible && n.props.transparent === false);
  const receipt = (version = 2) => ok({ resultado: 'status_alterado', recurso_tipo: 'propriedade', recurso_id: ID, versao: version });
  const action = status => status === 'ativa' ? 'Inativar Propriedade' : 'Reativar Propriedade';
  const confirmation = status => status === 'ativa' ? 'Confirmar inativação' : 'Confirmar reativação';
  async function open(renderer, status = 'ativa') {
    if (currentRouteName() !== 'PropertyDetail') await navigate('PropertyDetail', { id: ID });
    await press(renderer.root, action(status)); assert.ok(modal(renderer)); return modal(renderer);
  }
  async function review(renderer, reason = 'Correção administrativa', detail) {
    const root = modal(renderer); await choose(root, 'Motivo', reason);
    if (detail !== undefined) await input(root, 'Detalhe do motivo', detail);
    await press(root, 'Revisar alteração'); return root;
  }
  async function restore(f) {
    await act(async () => { void f.runtime.session.revalidate(); }); await flush();
    await act(async () => { f.pendingRevalidations.at(-1).resolve(ok(f.sessionIdentityWire())); }); await flush();
  }
  async function deny(f) {
    await act(async () => { const lease = f.runtime.administrativePropertyData.issueLease();
      f.runtime.administrativePropertyData.invalidateAccess(lease, 'forbidden'); f.runtime.administrativePropertyData.revokeLease(lease); }); await flush();
  }

  test('status: smoke inativar → reabrir → reativar preserva detalhe e payloads exatos', async t => {
    const { f, renderer } = await mount(t); await navigate('PropertyDetail', { id: ID }); const before = propertyStack();
    for (const status of ['ativa', 'inativa']) {
      await open(renderer, status); const root = await review(renderer); const version = f.detail.versao;
      const reads = f.reads().length; const mutations = f.mutations().length;
      assert.equal(f.mutations().length, mutations); assert.match(texts(root), /Confirme/);
      await press(root, confirmation(status), true);
      assert.equal(f.mutations().length, mutations + 1); assert.equal(f.reads().length, reads + 1);
      const request = f.mutations().at(-1);
      assert.equal(request.method, 'PATCH'); assert.equal(new URL(request.url).pathname, `/v1/propriedades/${ID}/status`);
      assert.deepEqual(request.body, { versao: version, status: status === 'ativa' ? 'inativa' : 'ativa', motivo: 'correcao_administrativa' });
      assert.ok(request.idempotencyKey); assert.equal(modal(renderer), undefined);
      assert.deepEqual(propertyStack(), before); assert.match(texts(renderer.root), /Status da Propriedade atualizado/);
      assert.ok(button(renderer.root, action(f.detail.status)));
    }
    assert.notEqual(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
    await act(async () => httpNavigationRef.goBack()); await flush(); assert.equal(rootState().index, 0);
  });

  for (const status of ['ativa', 'inativa']) for (const version of [2, 7]) test(`status: ${status} reconcilia GET v${version} após recibo v2`, async t => {
    const { f, renderer } = await mount(t); f.detail = property({ status });
    await open(renderer, status); const root = await review(renderer); const target = status === 'ativa' ? 'inativa' : 'ativa';
    f.handlers.mutate = () => receipt(); f.handlers.detail = () => ok(property({ status: target, versao: version, nome: 'Nome do GET' }));
    await press(root, confirmation(status));
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].versao, version);
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].status, target);
    assert.match(texts(renderer.root), /Nome do GET/); assert.equal(modal(renderer), undefined);
  });

  for (const stage of ['reason', 'confirmation']) test(`status: cancelar em ${stage} não faz PATCH ou altera detalhe`, async t => {
    const { f, renderer } = await mount(t); await open(renderer); const before = propertyStack();
    if (stage === 'confirmation') await review(renderer);
    await press(modal(renderer), 'Cancelar'); assert.equal(modal(renderer), undefined);
    assert.equal(f.mutations().length, 0); assert.equal(f.detail.status, 'ativa'); assert.deepEqual(propertyStack(), before);
  });

  test('status: D10 exige motivo válido e Outro/detalhe D9 com NFC; ausência omitida', async t => {
    const { f, renderer } = await mount(t); let root = await open(renderer);
    await press(root, 'Revisar alteração'); assert.match(texts(root), /Selecione um motivo/);
    assert.equal(button(root, 'Confirmar inativação'), undefined);
    await act(async () => field(root, 'Motivo').props.onChange('invalid_holder')); await press(root, 'Revisar alteração');
    assert.equal(button(root, 'Confirmar inativação'), undefined);
    assert.deepEqual(field(root, 'Motivo').props.options.map(o => o.value), load('http/administrativePropertyModels').PROPERTY_REASON_CODES);
    for (const value of ['', 'a'.repeat(301), ' espaço ']) {
      await choose(root, 'Motivo', 'Outro'); await input(root, 'Detalhe do motivo', value); await press(root, 'Revisar alteração');
      assert.match(texts(root), /até 300 caracteres/); assert.equal(button(root, 'Confirmar inativação'), undefined);
    }
    assert.equal(f.mutations().length, 0);
    await input(root, 'Detalhe do motivo', 'e\u0301'.repeat(300)); await press(root, 'Revisar alteração');
    await press(root, 'Confirmar inativação'); assert.equal(f.mutations()[0].body.motivo_detalhe, 'é'.repeat(300));
    assert.equal(f.mutations()[0].body.motivo, 'outro');
  });

  test('status: motivo não Outro permite detalhe opcional sem enviar campos cadastrais', async t => {
    const { f, renderer } = await mount(t); await open(renderer); const version = f.detail.versao;
    const root = await review(renderer, 'Suspensão operacional', 'Revisão de cadastro');
    await press(root, 'Confirmar inativação');
    assert.deepEqual(f.mutations()[0].body, { versao: version, status: 'inativa', motivo: 'suspensao_operacional', motivo_detalhe: 'Revisão de cadastro' });
    assert.equal(f.requests.some(r => /usuarios|localidades/.test(r.url)), false);
  });

  for (const status of ['ativa', 'inativa']) test(`status: ${status} receipt → GET falha → retry falha → sucesso, sem novo PATCH`, async t => {
    const { f, renderer } = await mount(t); f.detail = property({ status }); await open(renderer, status); const root = await review(renderer);
    const before = propertyStack(); const gate = deferred(); let reads = 0;
    f.handlers.detail = () => { reads++; return reads === 1 ? gate.promise : reads === 2 ? failure(503, 'service_unavailable') : ok(f.detail); };
    await press(root, confirmation(status), true); assert.match(texts(root), /Alteração confirmada. Atualizando/);
    assert.ok(modal(renderer)); assert.equal(button(root, 'Cancelar'), undefined); assert.equal(button(root, confirmation(status)), undefined);
    await act(async () => gate.resolve(failure(503, 'service_unavailable'))); await flush();
    assert.match(texts(root), /confirmada, mas não foi possível atualizar/); assert.equal(root.findAllByType('ActivityIndicator').length, 0);
    await press(root, 'Tentar atualizar', true); assert.ok(modal(renderer)); assert.equal(reads, 2);
    const oldRetry = button(root, 'Tentar atualizar').props.onPress;
    await press(root, 'Tentar atualizar', true); assert.equal(modal(renderer), undefined); assert.equal(reads, 3);
    await act(async () => { oldRetry(); oldRetry(); }); await flush();
    assert.equal(reads, 3); assert.equal(f.mutations().length, 1); assert.deepEqual(propertyStack(), before);
  });

  test('status: GET com ID errado ou versão abaixo do recibo não conclui', async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer);
    f.handlers.detail = () => ok(property({ versao: 1 })); await press(root, 'Confirmar inativação');
    assert.match(texts(root), /confirmada, mas não foi possível atualizar/);
    f.handlers.detail = () => ok(property({ id: data.PRODUCER_ID, versao: 5 })); await press(root, 'Tentar atualizar');
    assert.ok(modal(renderer)); delete f.handlers.detail; await press(root, 'Tentar atualizar');
    assert.equal(modal(renderer), undefined); assert.equal(f.mutations().length, 1);
  });

  test('status: transporte ambíguo conserva chave, corpo e versão; duplo retry é uma tentativa', async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer);
    f.handlers.mutate = () => { throw new (load('http/httpTransport').ApiTransportError)('network'); };
    await press(root, 'Confirmar inativação'); assert.match(texts(root), /mesma operação/);
    // An incidental newer GET cannot turn an uncertain command into a fresh intention.
    f.detail = property({ status: 'ativa', versao: 8 });
    await act(async () => { void f.runtime.administrativeProperties.getById(ID); }); await flush();
    assert.equal(button(root, 'Nova decisão de status'), undefined);
    await act(async () => field(root, 'Motivo').props.onChange('outro'));
    delete f.handlers.mutate; await press(root, 'Tentar enviar novamente', true);
    assert.equal(f.mutations().length, 2); assert.deepEqual(f.mutations()[0].body, f.mutations()[1].body);
    assert.equal(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey); assert.equal(modal(renderer), undefined);
  });

  for (const nextStatus of ['ativa', 'inativa']) test(`status: version_conflict converge a ${nextStatus} v3 e exige nova decisão/chave`, async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer); const oldConfirm = button(root, 'Confirmar inativação').props.onPress;
    f.handlers.mutate = () => { f.detail = property({ status: nextStatus, versao: 3 }); return failure(409, 'version_conflict'); };
    await press(root, 'Confirmar inativação'); assert.match(texts(root), /Propriedade mudou/);
    assert.match(texts(root), nextStatus === 'ativa' ? /Status atual:.*Ativa/ : /Status atual:.*Inativa/);
    await act(async () => oldConfirm()); await flush(); assert.equal(f.mutations().length, 1);
    await press(root, 'Nova decisão de status'); assert.equal(field(root, 'Motivo').props.value, '');
    const fresh = await review(renderer); delete f.handlers.mutate;
    await press(fresh, confirmation(nextStatus)); assert.equal(f.mutations().length, 2);
    assert.equal(f.mutations()[1].body.versao, 3); assert.notEqual(f.mutations()[0].idempotencyKey, f.mutations()[1].idempotencyKey);
  });

  test('status: conflito sem GET bloqueia nova decisão até releitura explícita', async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer);
    f.handlers.mutate = () => failure(409, 'version_conflict'); f.handlers.detail = () => failure(503, 'service_unavailable');
    await press(root, 'Confirmar inativação'); assert.equal(button(root, 'Nova decisão de status').props.disabled, true);
    await press(root, 'Nova decisão de status'); assert.equal(f.mutations().length, 1);
    f.detail = property({ status: 'inativa', versao: 3 }); delete f.handlers.detail; await press(root, 'Atualizar dados');
    assert.match(texts(root), /Inativa/); assert.equal(button(root, 'Nova decisão de status').props.disabled, false);
    assert.equal(f.mutations().length, 1);
  });

  test('status: business_rule_conflict de reativação é seguro e não marca ativa', async t => {
    const { f, renderer } = await mount(t); f.detail = property({ status: 'inativa' }); await open(renderer, 'inativa'); const root = await review(renderer);
    f.handlers.mutate = () => ({ status: 409, body: { error: { code: 'business_rule_conflict', message: 'invalid_holder SQL ' + ID } } });
    await press(root, 'Confirmar reativação'); assert.match(texts(root), /Não é possível alterar o status/);
    assert.doesNotMatch(texts(root), /invalid_holder|SQL|11111111/);
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].status, 'inativa');
    assert.equal(f.requests.some(r => /usuarios|localidades/.test(r.url)), false); assert.equal(f.mutations().length, 1);
  });

  for (const profile of ['produtor', 'colaborador']) test(`status: ${profile} sem ação, rota, deep link ou modal`, async t => {
    const { f, renderer } = await mount(t, { initialProfile: profile, initialUrl: 'https://app.tcheagro.example/AdministrativePropertyStatus' });
    await navigate('PropertyDetail', { id: ID }); assert.equal(button(renderer.root, 'Inativar Propriedade'), undefined);
    assert.equal(button(renderer.root, 'Reativar Propriedade'), undefined); assert.equal(rootState().routeNames.includes('AdministrativePropertyStatus'), false);
    await act(async () => httpNavigationRef.navigate('AdministrativePropertyStatus', { id: ID })); await flush();
    assert.equal(modal(renderer), undefined); assert.equal(currentRouteName(), 'PropertyDetail'); assert.equal(f.mutations().length, 0);
  });

  for (const profile of ['produtor', 'colaborador']) test(`status: redução de Admin para ${profile} descarta confirmação`, async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer); const old = button(root, 'Confirmar inativação').props.onPress;
    await act(async () => { void f.sessionUi.login(`${profile}@example.test`, 'Senha válida 123'); }); await flush();
    await act(async () => old()); await flush(); assert.equal(modal(renderer), undefined); assert.equal(f.mutations().length, 0);
    assert.deepEqual(f.runtime.administrativePropertyData.current.details, {});
  });

  test('status: callbacks de A após 403/retomada não fecham nem confirmam fluxo B', async t => {
    const { f, renderer } = await mount(t); await open(renderer); let root = await review(renderer);
    const old = [button(root, 'Cancelar').props.onPress, root.props.onRequestClose, button(root, 'Confirmar inativação').props.onPress];
    await deny(f); assert.equal(modal(renderer), undefined); await restore(f); await open(renderer);
    root = modal(renderer); await choose(root, 'Motivo', 'Outro'); await input(root, 'Detalhe do motivo', 'Draft B'); const before = propertyStack();
    await act(async () => old.forEach(fn => fn())); await flush();
    assert.ok(modal(renderer)); assert.deepEqual(propertyStack(), before); assert.equal(f.mutations().length, 0);
    assert.equal(root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Detalhe do motivo').props.value, 'Draft B');
  });

  for (const code of [401, 403]) for (const phase of ['before', 'patch', 'get']) test(`status: ${code} em ${phase} encerra fluxo, callback antigo inerte`, async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer); const old = button(root, 'Confirmar inativação').props.onPress;
    const response = () => failure(code, code === 401 ? 'invalid_session' : 'forbidden');
    if (phase === 'before') { f.handlers.detail = response; await act(async () => { void f.runtime.administrativeProperties.getById(ID).catch(() => {}); }); await flush(); }
    else { if (phase === 'patch') f.handlers.mutate = response; else f.handlers.detail = response; await press(root, 'Confirmar inativação'); }
    assert.equal(modal(renderer), undefined); await act(async () => old()); await flush();
    assert.equal(f.mutations().length, phase === 'before' ? 0 : 1);
    assert.deepEqual(f.runtime.administrativePropertyData.current.details, {});
  });

  for (const phase of ['patch', 'get']) test(`status: resposta tardia em ${phase} após perda de Admin não publica`, async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer); const gate = deferred();
    if (phase === 'patch') f.handlers.mutate = () => gate.promise; else f.handlers.detail = () => gate.promise;
    await press(root, 'Confirmar inativação'); await deny(f);
    await act(async () => gate.resolve(phase === 'patch' ? receipt() : ok(property({ status: 'inativa', versao: 2 })))); await flush();
    assert.equal(modal(renderer), undefined); assert.deepEqual(f.runtime.administrativePropertyData.current.details, {}); assert.equal(f.mutations().length, 1);
  });

  test('status: StrictMode aposenta instância antiga e subscriptions, sem envio automático', async t => {
    const module = load('http/administrativePropertyStatusController'); const Original = module.AdministrativePropertyStatusController; const instances = [];
    module.AdministrativePropertyStatusController = class extends Original { constructor(...args) { super(...args); instances.push(this); } };
    t.after(() => { module.AdministrativePropertyStatusController = Original; });
    const { f, renderer } = await mount(t, { strict: true }); await open(renderer); const count = f.runtime.administrativePropertyData.activeSubscriptionCount;
    assert.ok(instances.length >= 2); assert.equal(instances[0].current, false); assert.equal(instances[0].snapshot.property, null);
    instances[0].start(); await instances[0].confirm(); assert.equal(f.mutations().length, 0);
    await press(modal(renderer), 'Cancelar'); await open(renderer); assert.equal(f.runtime.administrativePropertyData.activeSubscriptionCount, count);
    const root = await review(renderer); await press(root, 'Confirmar inativação', true); assert.equal(f.mutations().length, 1); assert.equal(modal(renderer), undefined);
  });

  test('status: ID inválido não expõe ação nem faz request indevido; nenhuma rota status Admin', async t => {
    const { f, renderer } = await mount(t); const before = f.requests.length;
    await navigate('PropertyDetail', { id: 'not-a-uuid' }); assert.equal(f.requests.length, before);
    assert.equal(button(renderer.root, 'Inativar Propriedade'), undefined); assert.equal(rootState().routeNames.includes('AdministrativePropertyStatus'), false);
  });

  test('status: lista filtrada é recarregada do servidor; detalhe Admin inativo independe da lista', async t => {
    const { f, renderer } = await mount(t); const queries = [];
    f.handlers.list = request => { const status = new URL(request.url).searchParams.get('status'); queries.push(status);
      return ok({ itens: !status || status === f.detail.status ? [f.detail] : [], paginacao: { proximo_cursor: null } }); };
    const Filter = load('components/FilterBottomSheet').default; const Chips = load('components/SegmentedChips').default;
    const sheet = renderer.root.findByType(Filter); const statusChips = sheet.findAllByType(Chips)[0];
    await act(async () => statusChips.props.onChange('ativa')); await flush();
    await act(async () => renderer.root.findByType(Filter).props.onApply()); await flush();
    await open(renderer); await review(renderer); await press(modal(renderer), 'Confirmar inativação');
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].status, 'inativa');
    await act(async () => httpNavigationRef.goBack()); await flush();
    const Card = load('components/ProdutorCard').PropertyCardView;
    assert.equal(renderer.root.findAllByType(Card).length, 0); assert.equal(queries.at(-1), 'ativa');
    await navigate('PropertyDetail', { id: ID }); await open(renderer, 'inativa'); await review(renderer); await press(modal(renderer), 'Confirmar reativação');
    await act(async () => httpNavigationRef.goBack()); await flush();
    assert.equal(renderer.root.findAllByType(Card).length, 1); assert.equal(queries.at(-1), 'ativa');
  });

  test('status: fechar após recibo não oferece cancelamento e resposta antiga não fecha nova operação', async t => {
    const { f, renderer } = await mount(t); await open(renderer); const root = await review(renderer); const gate = deferred();
    f.handlers.detail = () => gate.promise; await press(root, 'Confirmar inativação');
    assert.equal(button(root, 'Cancelar'), undefined); await press(root, 'Fechar'); assert.equal(modal(renderer), undefined);
    delete f.handlers.detail; await act(async () => { void f.runtime.administrativeProperties.getById(ID); }); await flush();
    await open(renderer, 'inativa'); await choose(modal(renderer), 'Motivo', 'Outro');
    await act(async () => gate.resolve(ok(property({ status: 'ativa', versao: 99 })))); await flush();
    assert.ok(modal(renderer)); assert.equal(f.runtime.administrativePropertyData.current.details[ID].status, 'inativa');
    assert.equal(f.mutations().length, 1);
  });

  test('status: conclusão repetida do lifecycle não fecha fluxo novo ou duplica sucesso', async t => {
    const Flow = load('http/administrativePropertyCommandLifecycle').AdministrativePropertyCommandLifecycle;
    const original = Flow.prototype.onCompleted; const callbacks = [];
    Flow.prototype.onCompleted = function(callback) { callbacks.push(callback); return original.call(this, p => { callback(p); callback(p); }); };
    t.after(() => { Flow.prototype.onCompleted = original; });
    const { f, renderer } = await mount(t); await open(renderer); await review(renderer); await press(modal(renderer), 'Confirmar inativação');
    const before = propertyStack(); assert.equal(modal(renderer), undefined); assert.equal(f.mutations().length, 1);
    await open(renderer, 'inativa'); await act(async () => callbacks.forEach(cb => cb(f.detail))); await flush();
    assert.ok(modal(renderer)); assert.deepEqual(propertyStack(), before); assert.equal(f.mutations().length, 1);
  });

  test('status: GET mais novo prevalece mesmo com status diferente do destino solicitado', async t => {
    const { f, renderer } = await mount(t); await open(renderer); await review(renderer);
    f.handlers.detail = () => ok(property({ status: 'ativa', versao: 10 }));
    await press(modal(renderer), 'Confirmar inativação');
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].status, 'ativa');
    assert.equal(f.runtime.administrativePropertyData.current.details[ID].versao, 10);
    assert.ok(button(renderer.root, 'Inativar Propriedade')); assert.equal(modal(renderer), undefined);
  });

  test('status: indisponibilidade não gera sucesso nem spinner residual', async t => {
    const { f, renderer } = await mount(t); await open(renderer); await review(renderer);
    f.handlers.mutate = () => failure(503, 'service_unavailable'); await press(modal(renderer), 'Confirmar inativação');
    const root = modal(renderer); assert.ok(root); assert.equal(root.findAllByType('ActivityIndicator').length, 0);
    assert.doesNotMatch(texts(renderer.root), /Status da Propriedade atualizado/); assert.equal(f.detail.status, 'ativa');
    assert.equal(f.mutations().length, 1);
  });

  test('status: edição cadastral continua sem controles de status e PATCH somente cadastral', async t => {
    const { f, renderer } = await mount(t); await navigate('PropertyDetail', { id: ID }); const before = propertyStack();
    await press(renderer.root, 'Editar Propriedade');
    const Edit = load('http/screens/HttpAdministrativePropertyFormScreens').HttpAdministrativePropertyEditScreen;
    const root = renderer.root.findByType(Edit);
    assert.equal(button(root, 'Inativar Propriedade'), undefined); assert.equal(button(root, 'Reativar Propriedade'), undefined);
    assert.equal(root.findAllByType(load('components/SegmentedChips').default).length, 0);
    const version = f.detail.versao; await input(root, 'Nome da Propriedade', 'Nome cadastral'); await press(root, 'Salvar alterações');
    assert.deepEqual(f.mutations()[0].body, { versao: version, nome: 'Nome cadastral' });
    assert.equal(new URL(f.mutations()[0].url).pathname, `/v1/propriedades/${ID}`); assert.deepEqual(propertyStack(), before);
  });
};
