const assert = require('node:assert/strict');
const test = require('node:test');

const fixture = require('./mp35d2RenderedNavigation.test.js');
const {
  USER_ID,
  act,
  administrativeUserWire,
  currentRouteName,
  flush,
  httpNavigationRef,
  mountFixture,
  renderedFixture,
  rootState,
  textContent,
  unmount,
  waitFor,
} = fixture;

async function navigate(name, params) {
  await act(async () => { httpNavigationRef.navigate(name, params); });
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (currentRouteName() === name) break;
    await flush(1);
  }
  assert.equal(currentRouteName(), name, `rota ${name}`);
  await flush(2);
}

async function openFromDetail(context, renderer, commandRoute) {
  await navigate('AdministrativeUserDetail', { id: USER_ID });
  await waitFor(() => /Usuário Renderizado/.test(textContent(renderer)), 'detalhe carregado');
  await navigate(commandRoute, { id: USER_ID });
  await waitFor(() => currentRouteName() === commandRoute, `formulário ${commandRoute}`);
  assert.ok(context.runtime.administrativeUserData.activeSubscriptionCount >= 1);
}

function inputs(renderer) {
  return renderer.root.findAllByType('TextInput');
}

function pressablesWithText(renderer, expectedText) {
  return renderer.root.findAll((node) => (
    (node.type === 'Pressable' || node.type === 'TouchableOpacity') &&
    typeof node.props.onPress === 'function' &&
    node.findAllByType('Text').some((text) => text.children.includes(expectedText))
  )).sort((left, right) => (
    left.findAllByType('Text').length - right.findAllByType('Text').length
  ));
}

function buttonWithText(renderer, expectedText) {
  return pressablesWithText(renderer, expectedText)[0];
}

async function pressTwice(button) {
  await act(async () => {
    button.props.onPress();
    button.props.onPress();
  });
  await flush(2);
}

async function resolveCommandRead(context, overrides = {}) {
  const gate = context.pendingCommandReads.at(-1);
  assert.ok(gate, 'a releitura autoritativa deve estar pendente');
  await act(async () => {
    gate.resolve({ status: 200, body: administrativeUserWire({
      ...context.currentUser,
      ...overrides,
    }) });
    await gate.promise;
  });
  await flush(5);
}

test('criação real de Produtor e Colaborador usa uma mutação, uma releitura e um replace', async () => {
  for (const profile of ['produtor', 'colaborador']) {
    const context = renderedFixture({ deferCommandRead: true });
    const renderer = await mountFixture(context);
    await navigate('AdministrativeUserCreate');
    assert.doesNotMatch(textContent(renderer), /Senha inicial|Administrador|Excluir Usuário/);
    const fields = inputs(renderer).slice(-5);
    assert.ok(fields.length >= 5);
    await act(async () => {
      fields[0].props.onChangeText(`Novo ${profile}`);
      fields[1].props.onChangeText(`${profile}@example.test`);
      if (profile === 'colaborador') {
        buttonWithText(renderer, 'Colaborador').props.onPress();
      }
    });
    await flush(2);
    let navigationEvents = 0;
    const unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
    const beforeCompletion = navigationEvents;
    await pressTwice(buttonWithText(renderer, 'Criar Usuário'));
    await flush(4);
    assert.equal(
      context.calls.create,
      1,
      `POST único ${profile}; tela=${textContent(renderer)}; chamadas=${JSON.stringify(context.calls)}`,
    );
    assert.equal(context.pendingCommandReads.length, 1);
    assert.equal(context.commandRequests[0].body.perfil, profile);
    assert.equal(Object.hasOwn(context.commandRequests[0].body, 'senha'), false);
    await resolveCommandRead(context);
    await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'replace para detalhe');
    assert.equal(navigationEvents - beforeCompletion, 1);
    unsubscribe();
    await unmount(renderer);
    assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
  }
});

test('edição real envia só dirty field e duplo submit volta exatamente uma vez', async () => {
  const context = renderedFixture({ deferCommandRead: true });
  const renderer = await mountFixture(context);
  await openFromDetail(context, renderer, 'AdministrativeUserEdit');
  const nameField = inputs(renderer).find((input) => input.props.value === 'Usuário Renderizado');
  assert.ok(nameField);
  await act(async () => { nameField.props.onChangeText('Nome editado'); });
  await flush(2);
  let navigationEvents = 0;
  const unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
  const beforeCompletion = navigationEvents;
  await pressTwice(buttonWithText(renderer, 'Salvar alterações'));
  await flush(4);
  assert.equal(
    context.calls.edit,
    1,
    `PATCH cadastral único; tela=${textContent(renderer)}; chamadas=${JSON.stringify(context.calls)}`,
  );
  assert.deepEqual(context.commandRequests[0].body, { versao: 1, nome: 'Nome editado' });
  await resolveCommandRead(context);
  await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'goBack único da edição');
  assert.equal(navigationEvents - beforeCompletion, 1);
  unsubscribe();
  await unmount(renderer);
});

test('conflito com releitura falha preserva draft, bloqueia submit e oferece nova leitura', async () => {
  for (const code of ['version_conflict', 'business_rule_conflict']) {
    const context = renderedFixture({
      deferCommandRead: true,
      commandFailure: { status: 409, body: { error: { code } } },
    });
    const renderer = await mountFixture(context);
    await openFromDetail(context, renderer, 'AdministrativeUserEdit');
    const nameField = inputs(renderer).find((input) => input.props.value === 'Usuário Renderizado');
    await act(async () => { nameField.props.onChangeText('Rascunho preservado'); });
    await act(async () => { buttonWithText(renderer, 'Salvar alterações').props.onPress(); });
    await waitFor(() => context.pendingCommandReads.length === 1, `reload automático ${code}`);
    await act(async () => { context.pendingCommandReads[0].reject(new Error('indisponível')); });
    await flush(4);
    assert.match(textContent(renderer), /não foi possível carregar/i);
    assert.ok(buttonWithText(renderer, 'Tentar carregar versão atual'));
    assert.equal(
      inputs(renderer).some((input) => input.props.value === 'Rascunho preservado'),
      true,
    );
    const submit = buttonWithText(renderer, 'Salvar alterações');
    assert.equal(submit.props.disabled, true);

    await act(async () => { buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress(); });
    await waitFor(() => context.pendingCommandReads.length === 2, `reload explícito ${code}`);
    await act(async () => {
      context.pendingCommandReads[1].resolve({
        status: 200,
        body: administrativeUserWire({ versao: 2 }),
      });
    });
    await flush(4);
    assert.doesNotMatch(textContent(renderer), /não foi possível carregar/i);
    assert.equal(
      inputs(renderer).some((input) => input.props.value === 'Rascunho preservado'),
      true,
    );
    await unmount(renderer);
  }
});

test('rebase renderizado mostra valores de servidor/operador e exige resolução do campo', async () => {
  const context = renderedFixture({
    deferCommandRead: true,
    commandFailure: { status: 409, body: { error: {
      code: 'version_conflict',
      details: [{ field: 'versao', current_version: 2 }],
    } } },
  });
  const renderer = await mountFixture(context);
  await openFromDetail(context, renderer, 'AdministrativeUserEdit');
  const nameField = inputs(renderer).find((input) => input.props.value === 'Usuário Renderizado');
  await act(async () => { nameField.props.onChangeText('Nome operador'); });
  await act(async () => { buttonWithText(renderer, 'Salvar alterações').props.onPress(); });
  await waitFor(() => context.pendingCommandReads.length === 1, 'releitura concorrente');
  await act(async () => {
    context.pendingCommandReads[0].resolve({
      status: 200,
      body: administrativeUserWire({ nome: 'Nome servidor', versao: 2 }),
    });
  });
  await flush(4);
  assert.match(textContent(renderer), /Conflito em nome/);
  assert.match(textContent(renderer), /Servidor:\s+Nome servidor/);
  assert.match(textContent(renderer), /Operador:\s+Nome operador/);
  assert.equal(buttonWithText(renderer, 'Salvar alterações').props.disabled, true);
  await act(async () => { buttonWithText(renderer, 'Manter valor do operador').props.onPress(); });
  await flush(2);
  assert.doesNotMatch(textContent(renderer), /Conflito em nome/);
  assert.equal(buttonWithText(renderer, 'Salvar alterações').props.disabled, false);
  await unmount(renderer);
});

test('status real exige detalhe para motivo outro e navega uma vez sob duplo submit', async () => {
  const context = renderedFixture({ deferCommandRead: true, userStatus: 'ativo' });
  const renderer = await mountFixture(context);
  await openFromDetail(context, renderer, 'AdministrativeUserStatus');
  await act(async () => { buttonWithText(renderer, 'Outro').props.onPress(); });
  await flush(2);
  await act(async () => { buttonWithText(renderer, 'Inativar Usuário').props.onPress(); });
  await flush(1);
  let confirms = pressablesWithText(renderer, 'Confirmar alteração');
  await act(async () => { confirms[0].props.onPress(); });
  await flush(3);
  assert.equal(context.calls.status, 0);
  assert.match(textContent(renderer), /Explique o motivo/);

  const detailField = inputs(renderer).at(-1);
  await act(async () => { detailField.props.onChangeText('Encerramento controlado'); });
  await act(async () => { buttonWithText(renderer, 'Inativar Usuário').props.onPress(); });
  await flush(1);
  confirms = pressablesWithText(renderer, 'Confirmar alteração');
  let navigationEvents = 0;
  const unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
  const beforeCompletion = navigationEvents;
  await pressTwice(confirms[0]);
  await waitFor(() => context.calls.status === 1, 'PATCH status único');
  assert.deepEqual(context.commandRequests[0].body, {
    versao: 1,
    status: 'inativo',
    motivo: 'outro',
    motivo_detalhe: 'Encerramento controlado',
  });
  await resolveCommandRead(context);
  await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'goBack único de status');
  assert.equal(navigationEvents - beforeCompletion, 1);
  unsubscribe();
  await unmount(renderer);
});

test('convite real mantém ativar_usuario, não expõe token e navega uma vez', async () => {
  const context = renderedFixture({ deferCommandRead: true, userStatus: 'pendente' });
  const renderer = await mountFixture(context);
  await openFromDetail(context, renderer, 'AdministrativeUserInvitation');
  assert.doesNotMatch(textContent(renderer), /token de convite|token_ativacao/i);
  await act(async () => { buttonWithText(renderer, 'Reemitir convite').props.onPress(); });
  await flush(1);
  const confirmations = pressablesWithText(renderer, 'Confirmar reemissão');
  let navigationEvents = 0;
  const unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
  const beforeCompletion = navigationEvents;
  await pressTwice(confirmations[0]);
  await waitFor(() => context.calls.invitation === 1, 'POST convite único');
  assert.deepEqual(context.commandRequests[0].body, { modo_ativacao: 'ativar_usuario' });
  await resolveCommandRead(context);
  await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'goBack único de convite');
  assert.equal(navigationEvents - beforeCompletion, 1);
  unsubscribe();
  await unmount(renderer);
});

test('duplo submit separado por microtask ou durante releitura navega uma vez nas quatro telas', async () => {
  for (const mode of ['microtask', 'during_read']) {
    for (const [route, label, target] of [
      ['AdministrativeUserCreate', 'Criar Usuário', null],
      ['AdministrativeUserEdit', 'Salvar alterações', 'edit'],
      ['AdministrativeUserStatus', 'Inativar Usuário', 'status'],
      ['AdministrativeUserInvitation', 'Reemitir convite', 'invitation'],
    ]) {
      const context = renderedFixture({
        deferCommandRead: true,
        userStatus: target === 'invitation' ? 'pendente' : 'ativo',
      });
      const renderer = await mountFixture(context);
      let invokeSubmit;
      if (target === null) {
        await navigate(route);
        const fields = inputs(renderer).slice(-5);
        await act(async () => {
          fields[0].props.onChangeText(`Novo ${mode}`);
          fields[1].props.onChangeText(`${mode}@example.test`);
        });
        invokeSubmit = buttonWithText(renderer, label).props.onPress;
      } else {
        await openFromDetail(context, renderer, route);
        if (target === 'edit') {
          const nameField = inputs(renderer).find(
            (input) => input.props.value === 'Usuário Renderizado',
          );
          assert.ok(nameField);
          await act(async () => { nameField.props.onChangeText(`Editado ${mode}`); });
          invokeSubmit = buttonWithText(renderer, label).props.onPress;
        } else {
          await act(async () => { buttonWithText(renderer, label).props.onPress(); });
          await flush(1);
          const confirmation = target === 'status'
            ? 'Confirmar alteração'
            : 'Confirmar reemissão';
          invokeSubmit = pressablesWithText(renderer, confirmation)[0].props.onPress;
        }
      }

      let navigationEvents = 0;
      const unsubscribe = httpNavigationRef.addListener('state', () => {
        navigationEvents += 1;
      });
      const beforeCompletion = navigationEvents;
      if (mode === 'microtask') {
        await act(async () => {
          invokeSubmit();
          await Promise.resolve();
          invokeSubmit();
        });
      } else {
        await act(async () => { invokeSubmit(); });
        await waitFor(
          () => context.pendingCommandReads.length === 1,
          `primeira releitura ${route}`,
        );
        await act(async () => { invokeSubmit(); });
      }
      await waitFor(
        () => context.pendingCommandReads.length === 1,
        `releitura única ${route}/${mode}`,
      );
      assert.equal(context.calls[target ?? 'create'], 1, `${route}/${mode}`);
      await resolveCommandRead(context);
      await waitFor(
        () => currentRouteName() === 'AdministrativeUserDetail',
        `navegação única ${route}/${mode}`,
      );
      assert.equal(navigationEvents - beforeCompletion, 1, `${route}/${mode}`);
      unsubscribe();
      await unmount(renderer);
    }
  }
});

const COMMAND_SURFACES = [
  ['AdministrativeUserCreate', 'Criar Usuário', null],
  ['AdministrativeUserEdit', 'Salvar alterações', 'edit'],
  ['AdministrativeUserStatus', 'Inativar Usuário', 'status'],
  ['AdministrativeUserInvitation', 'Reemitir convite', 'invitation'],
];

async function prepareCommand(context, renderer, [route, label, target]) {
  if (target === null) {
    await navigate(route);
    const fields = inputs(renderer).slice(-5);
    await act(async () => {
      fields[0].props.onChangeText('Usuário para reconciliação');
      fields[1].props.onChangeText('reconciliacao@example.test');
    });
  } else {
    await openFromDetail(context, renderer, route);
    if (target === 'edit') {
      const field = inputs(renderer).find((input) => input.props.value === 'Usuário Renderizado');
      assert.ok(field);
      await act(async () => { field.props.onChangeText('Nome para reconciliação'); });
    } else {
      await act(async () => { buttonWithText(renderer, label).props.onPress(); });
      await flush(1);
      return buttonWithText(renderer, target === 'status'
        ? 'Confirmar alteração'
        : 'Confirmar reemissão').props.onPress;
    }
  }
  await flush(1);
  return buttonWithText(renderer, label).props.onPress;
}

for (const [incidentalRead, concurrentMe] of [[true, false], [false, false], [true, true], [false, true]]) {
  test(`403 → Admin na mesma partição libera nova criação (GET incidental: ${incidentalRead}${concurrentMe ? '; /me A-B' : ''})`, async () => {
    const context = renderedFixture({ deferCommandRead: true });
    const renderer = await mountFixture(context);
    let unsubscribe = () => {};
    try {
      await navigate('AdministrativeUserCreate');
      const fields = inputs(renderer).slice(-5);
      await act(async () => {
        fields[0].props.onChangeText('Primeira intenção');
        fields[1].props.onChangeText('primeira@example.test');
      });
      const oldSubmit = buttonWithText(renderer, 'Criar Usuário').props.onPress;
      const oldUpdate = fields[0].props.onChangeText;
      await act(async () => { oldSubmit(); });
      await waitFor(() => context.pendingCommandReads.length === 1, 'GET após primeiro recibo');
      await failCommandRead(context);
      const identityA = context.sessionIdentityWire();
      const a = concurrentMe ? context.runtime.session.revalidate() : null;
      if (concurrentMe) assert.equal(context.pendingRevalidations.length, 1);
      const oldRecover = buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress;
      await act(async () => { oldRecover(); });
      await waitFor(() => context.pendingCommandReads.length === 2, 'GET de recuperação');
      await failCommandRead(context, { status: 403, body: { error: { code: 'forbidden' } } });
      const boundary = context.runtime.administrativeUserData;
      const partition = boundary.current.partitionKey;
      assert.equal(boundary.current.invalidation, 'forbidden');
      assert.equal(context.calls.create, 1);
      assert.match(textContent(renderer), /acesso administrativo precisa ser validado/i);
      assert.equal(buttonWithText(renderer, 'Criar Usuário'), undefined);

      const revalidation = context.runtime.session.revalidate();
      assert.equal(context.pendingRevalidations.length, concurrentMe ? 2 : 1);
      if (concurrentMe) {
        await act(async () => {
          context.pendingRevalidations[0].resolve({ status: 200, body: identityA });
          await a;
        });
        assert.equal(boundary.current.invalidation, 'forbidden', 'A não pode restaurar o lease anterior ao 403');
      }
      await act(async () => {
        context.pendingRevalidations.at(-1).resolve({ status: 200, body: context.sessionIdentityWire() });
        await revalidation;
      });
      assert.equal(boundary.current.partitionKey, partition, 'nenhuma mudança artificial de partição');
      assert.equal(boundary.current.invalidation, null, 'retomada deriva de /me aceito');
      const readsAfterValidation = context.calls.detail;
      await act(async () => { oldUpdate('Dado descartado'); oldSubmit(); oldRecover(); });
      await flush(2);
      assert.equal(context.calls.create, 1, 'callback ainda montado permanece cancelado');
      assert.equal(context.calls.detail, readsAfterValidation);
      assert.doesNotMatch(textContent(renderer), /Primeira intenção|Dado descartado/);
      if (incidentalRead) {
        const read = context.runtime.administrativeUsers.getById(USER_ID);
        await waitFor(() => context.pendingCommandReads.length === 3, 'GET administrativo incidental');
        await resolveCommandRead(context);
        await read;
      }
      // Desmonta o fluxo confirmado antes de abrir uma intenção nova.
      await act(async () => { httpNavigationRef.goBack(); });
      await flush(3);
      await navigate('AdministrativeUserCreate');
      const newFields = inputs(renderer).slice(-5);
      await act(async () => {
        newFields[0].props.onChangeText('Segunda intenção');
        newFields[1].props.onChangeText('segunda@example.test');
      });
      const readsBeforeSubmit = context.calls.detail;
      let navigationEvents = 0;
      unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
      await act(async () => { oldUpdate('Dado descartado'); oldSubmit(); oldRecover(); });
      await flush(2);
      assert.equal(context.calls.create, 1);
      assert.equal(context.calls.detail, readsBeforeSubmit);
      assert.equal(navigationEvents, 0);
      assert.ok(inputs(renderer).some((input) => input.props.value === 'Segunda intenção'));
      assert.equal(buttonWithText(renderer, 'Criar Usuário').props.disabled, false);
      await pressTwice(buttonWithText(renderer, 'Criar Usuário'));
      assert.equal(context.calls.create, 2, 'novo submit deve acrescentar exatamente um POST');
      assert.equal(context.calls.detail, readsBeforeSubmit + 1);
      assert.deepEqual(context.commandRequests[1].body, {
        nome: 'Segunda intenção', email: 'segunda@example.test', perfil: 'produtor',
      });
      assert.ok(context.commandRequests[1].idempotencyKey);
      assert.notEqual(context.commandRequests[1].idempotencyKey,
        context.commandRequests[0].idempotencyKey, 'nova identidade idempotente');
      await resolveCommandRead(context);
      await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'conclusão da segunda intenção');
      assert.equal(navigationEvents, 1);
      const publication = boundary.current.mutation;
      const readsAfterCompletion = context.calls.detail;
      await act(async () => { oldUpdate('Dado descartado'); oldSubmit(); oldRecover(); });
      await flush(3);
      assert.equal(context.calls.create, 2);
      assert.equal(context.calls.detail, readsAfterCompletion);
      assert.equal(navigationEvents, 1);
      assert.strictEqual(boundary.current.mutation, publication);
      assert.equal(context.calls.me, concurrentMe ? 2 : 1, 'nenhuma terceira revalidação');
    } finally {
      unsubscribe();
      await unmount(renderer);
    }
  });
}

async function acceptRenderedRevalidation(context) {
  const pending = context.runtime.session.revalidate();
  await flush(1);
  await act(async () => {
    context.pendingRevalidations.at(-1).resolve({ status: 200, body: context.sessionIdentityWire() });
    await pending;
  });
  await flush(2);
}

for (const profile of ['produtor', 'colaborador']) {
  for (const order of ['A-B', 'B-A']) {
    test(`redução concorrente para ${profile} remove administração e draft com entrega ${order}`, async () => {
      const context = renderedFixture({ deferCommandRead: true });
      const renderer = await mountFixture(context);
      try {
        const submit = await prepareCommand(context, renderer, COMMAND_SURFACES[0]);
        await act(async () => { submit(); });
        await waitFor(() => context.pendingCommandReads.length === 1, 'GET após recibo');
        await failCommandRead(context);
        const identity = context.sessionIdentityWire();
        const a = context.runtime.session.revalidate();
        const recover = buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress;
        await act(async () => { recover(); });
        await waitFor(() => context.pendingCommandReads.length === 2, 'GET de recuperação');
        await failCommandRead(context, { status: 403, body: { error: { code: 'forbidden' } } });
        const b = context.runtime.session.revalidate();
        assert.equal(context.pendingRevalidations.length, 2);
        if (order === 'A-B') {
          await act(async () => {
            context.pendingRevalidations[0].resolve({ status: 200, body: identity });
            await a;
          });
          assert.equal(context.runtime.administrativeUserData.current.invalidation, 'forbidden');
        }
        await act(async () => {
          context.pendingRevalidations[1].resolve({ status: 200, body: {
            ...identity, usuario: { ...identity.usuario, perfil: profile },
            escopo: { ...identity.escopo, modo: 'vinculos_propriedade' },
          } });
          assert.equal((await b).usuario.perfil, profile);
        });
        if (order === 'B-A') {
          await act(async () => {
            context.pendingRevalidations[0].resolve({ status: 200, body: identity });
            await a;
          });
        }
        await flush(3);
        assert.equal(context.sessionUi.snapshot.usuario.perfil, profile);
        assert.equal(currentRouteName(), 'Properties');
        assert.equal(rootState().routeNames.includes('AdministrativeUserCreate'), false);
        assert.equal(context.runtime.administrativeUserData.current.mutation, null);
        assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
        assert.equal(inputs(renderer).some((input) => input.props.value === 'Usuário para reconciliação'), false);
        const reads = context.calls.detail;
        await act(async () => { submit(); recover(); });
        await flush(2);
        assert.equal(context.calls.create, 1);
        assert.equal(context.calls.detail, reads);
        assert.equal(context.calls.me, 2);
        assert.equal(currentRouteName(), 'Properties');
      } finally { await unmount(renderer); }
    });
  }
}

for (const surface of COMMAND_SURFACES.slice(0, 2)) {
  test(`${surface[0]}: Cancelar descartado não navega na nova criação; Cancelar atual funciona`, async () => {
    const context = renderedFixture({ deferCommandRead: true });
    const renderer = await mountFixture(context);
    let unsubscribe = () => {};
    try {
      const submit = await prepareCommand(context, renderer, surface);
      const oldCancel = buttonWithText(renderer, 'Cancelar').props.onPress;
      const oldKey = httpNavigationRef.getCurrentRoute().key;
      await act(async () => { submit(); });
      await waitFor(() => context.pendingCommandReads.length === 1, 'GET após recibo');
      await failCommandRead(context);
      await act(async () => { buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress(); });
      await waitFor(() => context.pendingCommandReads.length === 2, 'GET de recuperação');
      await failCommandRead(context, { status: 403, body: { error: { code: 'forbidden' } } });
      await acceptRenderedRevalidation(context);
      await act(async () => { httpNavigationRef.goBack(); });
      await flush(2);
      await navigate('AdministrativeUserCreate');
      const fields = inputs(renderer).slice(-5);
      await act(async () => {
        fields[0].props.onChangeText('Draft da nova instância');
        fields[1].props.onChangeText('nova-instancia@example.test');
      });
      const currentKey = httpNavigationRef.getCurrentRoute().key;
      assert.notEqual(currentKey, oldKey);
      const currentCancel = buttonWithText(renderer, 'Cancelar');
      assert.equal(currentCancel.props.disabled, false);
      const calls = { ...context.calls };
      let navigationEvents = 0;
      unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
      await act(async () => { oldCancel(); });
      await flush(2);
      assert.equal(navigationEvents, 0, 'Cancelar de tela descartada não navega');
      assert.equal(httpNavigationRef.getCurrentRoute().key, currentKey);
      assert.ok(inputs(renderer).some((input) => input.props.value === 'Draft da nova instância'));
      assert.ok(inputs(renderer).some((input) => input.props.value === 'nova-instancia@example.test'));
      assert.deepEqual(context.calls, calls);
      await act(async () => { currentCancel.props.onPress(); });
      await flush(2);
      assert.notEqual(httpNavigationRef.getCurrentRoute().key, currentKey);
      assert.equal(navigationEvents, 1, 'Cancelar atual mantém o goBack real');
    } finally { unsubscribe(); await unmount(renderer); }
  });
}

test('Cancelar atual pode sair após recibo confirmado e falha de releitura', async () => {
  const context = renderedFixture({ deferCommandRead: true });
  const renderer = await mountFixture(context);
  try {
    const submit = await prepareCommand(context, renderer, COMMAND_SURFACES[0]);
    const key = httpNavigationRef.getCurrentRoute().key;
    await act(async () => { submit(); });
    await waitFor(() => context.pendingCommandReads.length === 1, 'GET após recibo');
    await failCommandRead(context);
    const cancel = buttonWithText(renderer, 'Cancelar');
    assert.equal(cancel.props.disabled, false);
    await act(async () => { cancel.props.onPress(); });
    await flush(2);
    assert.notEqual(httpNavigationRef.getCurrentRoute().key, key);
    assert.equal(context.calls.create, 1);
  } finally { await unmount(renderer); }
});

for (const surface of COMMAND_SURFACES) {
  test(`${surface[0]}: Voltar capturado não navega sobre outra instância, mesmo ainda montado`, async () => {
    const context = renderedFixture({ userStatus: surface[2] === 'invitation' ? 'pendente' : 'ativo' });
    const renderer = await mountFixture(context);
    try {
      await prepareCommand(context, renderer, surface);
      const backButtons = () => renderer.root.findAll((node) => (
        node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Voltar'
      ));
      const oldBack = backButtons().at(-1).props.onPress;
      const oldKey = httpNavigationRef.getCurrentRoute().key;
      const { StackActions } = require('@react-navigation/native');
      await act(async () => { httpNavigationRef.dispatch(StackActions.push('AdministrativeUserCreate')); });
      await flush(3);
      const newKey = httpNavigationRef.getCurrentRoute().key;
      assert.notEqual(newKey, oldKey);
      assert.ok(rootState().routes.some((route) => route.key === oldKey), 'origem ainda montada na pilha');
      const fields = inputs(renderer).slice(-5);
      await act(async () => { fields[0].props.onChangeText('Draft da rota sobreposta'); });
      const calls = { ...context.calls };
      await act(async () => { oldBack(); });
      await flush(2);
      assert.equal(httpNavigationRef.getCurrentRoute().key, newKey, 'Voltar exige a chave da rota atual');
      assert.ok(inputs(renderer).some((input) => input.props.value === 'Draft da rota sobreposta'));
      assert.deepEqual(context.calls, calls);
      await act(async () => { backButtons().at(-1).props.onPress(); });
      await flush(2);
      assert.equal(httpNavigationRef.getCurrentRoute().key, oldKey, 'Voltar da instância atual funciona');
    } finally { await unmount(renderer); }
  });
}

test('remontagem antes de /me não oferece criação silenciosa nem restaura draft descartado', async () => {
  const context = renderedFixture({ deferCommandRead: true });
  const renderer = await mountFixture(context);
  try {
    const submit = await prepareCommand(context, renderer, COMMAND_SURFACES[0]);
    await act(async () => { submit(); });
    await waitFor(() => context.pendingCommandReads.length === 1, 'GET confirmado');
    await failCommandRead(context, { status: 403, body: { error: { code: 'forbidden' } } });
    await act(async () => { httpNavigationRef.goBack(); });
    await flush(2);
    await navigate('AdministrativeUserCreate');
    assert.match(textContent(renderer), /acesso administrativo precisa ser validado/i);
    assert.equal(buttonWithText(renderer, 'Criar Usuário'), undefined);
    assert.equal(inputs(renderer).some((input) => input.props.value === 'Usuário para reconciliação'), false);
    assert.equal(context.runtime.administrativeUserData.current.invalidation, 'forbidden');
    await acceptRenderedRevalidation(context);
    assert.equal(buttonWithText(renderer, 'Criar Usuário'), undefined, 'fluxo aberto sem autorização continua cancelado');
    assert.equal(context.calls.create, 1);
  } finally { await unmount(renderer); }
});

test('revalidação rotineira preserva draft legítimo e comando em andamento', async () => {
  const context = renderedFixture({ deferMutation: true, deferCommandRead: true });
  const renderer = await mountFixture(context);
  let unsubscribe = () => {};
  try {
    const submit = await prepareCommand(context, renderer, COMMAND_SURFACES[0]);
    const draft = inputs(renderer).map((input) => input.props.value);
    const boundary = context.runtime.administrativeUserData.current;
    await acceptRenderedRevalidation(context);
    assert.strictEqual(context.runtime.administrativeUserData.current, boundary);
    assert.deepEqual(inputs(renderer).map((input) => input.props.value), draft);
    await act(async () => { submit(); });
    await waitFor(() => context.pendingMutations.length === 1, 'POST em andamento');
    await acceptRenderedRevalidation(context);
    assert.strictEqual(context.runtime.administrativeUserData.current, boundary);
    assert.deepEqual(inputs(renderer).map((input) => input.props.value), draft);
    let navigationEvents = 0;
    unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
    await act(async () => { context.pendingMutations[0].resolve(context.pendingMutations[0].response); });
    await waitFor(() => context.pendingCommandReads.length === 1, 'GET após recibo');
    await resolveCommandRead(context);
    assert.equal(currentRouteName(), 'AdministrativeUserDetail');
    assert.equal(context.calls.create, 1);
    assert.equal(navigationEvents, 1);
  } finally { unsubscribe(); await unmount(renderer); }
});

for (const lateStatus of [200, 403]) {
  test(`recovery antigo com resposta tardia ${lateStatus} não interfere no novo fluxo após revalidação`, async () => {
    const context = renderedFixture({ deferCommandRead: true });
    const renderer = await mountFixture(context);
    let unsubscribe = () => {};
    try {
      const oldSubmit = await prepareCommand(context, renderer, COMMAND_SURFACES[1]);
      await act(async () => { oldSubmit(); });
      await waitFor(() => context.pendingCommandReads.length === 1, 'GET da edição');
      await failCommandRead(context);
      const oldRecover = buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress;
      await act(async () => { oldRecover(); });
      await waitFor(() => context.pendingCommandReads.length === 2, 'recovery antigo pendente');
      const lateRead = context.pendingCommandReads[1];
      // Outra tela real recebe 403 enquanto a edição anterior permanece montada.
      const firstCreate = await prepareCommand(context, renderer, COMMAND_SURFACES[0]);
      await act(async () => { firstCreate(); });
      await waitFor(() => context.pendingCommandReads.length === 3, 'GET da criação');
      await failCommandRead(context, { status: 403, body: { error: { code: 'forbidden' } } });
      await acceptRenderedRevalidation(context);
      await act(async () => { httpNavigationRef.goBack(); });
      await flush(2);
      assert.equal(currentRouteName(), 'AdministrativeUserEdit');
      assert.equal(buttonWithText(renderer, 'Tentar carregar versão atual'), undefined);
      await act(async () => { httpNavigationRef.goBack(); });
      await flush(2);
      await navigate('AdministrativeUserCreate');
      const fields = inputs(renderer).slice(-5);
      await act(async () => {
        fields[0].props.onChangeText('Novo draft preservado');
        fields[1].props.onChangeText('novo-draft@example.test');
      });
      const before = context.calls.detail;
      const boundaryBefore = context.runtime.administrativeUserData.current;
      let navigationEvents = 0;
      unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
      await act(async () => {
        oldSubmit(); oldRecover(); firstCreate();
        lateRead.resolve(lateStatus === 200
          ? { status: 200, body: administrativeUserWire({ nome: 'Resposta antiga', versao: 9 }) }
          : { status: 403, body: { error: { code: 'forbidden' } } });
      });
      await flush(3);
      assert.strictEqual(context.runtime.administrativeUserData.current, boundaryBefore);
      assert.equal(context.calls.detail, before);
      assert.equal(context.calls.edit, 1);
      assert.equal(context.calls.create, 1);
      assert.equal(navigationEvents, 0);
      assert.ok(inputs(renderer).some((input) => input.props.value === 'Novo draft preservado'));
      assert.doesNotMatch(textContent(renderer), /Resposta antiga/);
      await pressTwice(buttonWithText(renderer, 'Criar Usuário'));
      assert.equal(context.calls.create, 2);
      await resolveCommandRead(context);
      assert.equal(currentRouteName(), 'AdministrativeUserDetail');
      assert.equal(navigationEvents, 1);
      const after = context.runtime.administrativeUserData.current;
      const readsAfter = context.calls.detail;
      await act(async () => { oldSubmit(); oldRecover(); firstCreate(); });
      await flush(2);
      assert.strictEqual(context.runtime.administrativeUserData.current, after);
      assert.equal(context.calls.detail, readsAfter);
      assert.equal(context.calls.create, 2);
      assert.equal(context.calls.edit, 1);
      assert.equal(navigationEvents, 1);
    } finally { unsubscribe(); await unmount(renderer); }
  });
}

async function failCommandRead(context, response = null) {
  const gate = context.pendingCommandReads.at(-1);
  assert.ok(gate, 'GET controlado pendente');
  await act(async () => {
    if (response === null) gate.reject(new Error('GET indisponível'));
    else gate.resolve(response);
  });
  await flush(5);
}

function assertExplicitReconciliationFailure(context, renderer, route) {
  assert.equal(currentRouteName(), route, 'a falha não consome a conclusão');
  assert.match(textContent(renderer), /comando foi confirmado|operação foi confirmada/i);
  assert.match(textContent(renderer), /não foi possível|não puderam|não pôde/i);
  assert.doesNotMatch(textContent(renderer), /Carregando detalhe autoritativo/);
  const recovery = buttonWithText(renderer, 'Tentar carregar versão atual');
  assert.ok(recovery, 'a recuperação GET permanece acessível');
  assert.notEqual(recovery.props.disabled, true, 'nenhum GET está em andamento');
  assert.equal(context.runtime.administrativeUserData.current.mutation, null);
}

for (const choice of ['server', 'operator']) {
  test(`rebase consecutivo real preserva conflito v1→v2→v3 até escolha ${choice}`, async () => {
    const commandResponse = {
      status: 409,
      body: { error: { code: 'version_conflict', details: [{ field: 'versao', current_version: 2 }] } },
    };
    const context = renderedFixture({ deferCommandRead: true, commandFailure: commandResponse });
    context.setCurrentUser({ nome: 'A', versao: 1 });
    const renderer = await mountFixture(context);
    try {
      await navigate('AdministrativeUserDetail', { id: USER_ID });
      await waitFor(() => renderer.root.findAllByType('Text').some(
        (node) => node.children.includes('A'),
      ), 'baseline A carregada');
      await navigate('AdministrativeUserEdit', { id: USER_ID });
      const field = inputs(renderer).find((input) => input.props.value === 'A');
      assert.ok(field);
      await act(async () => { field.props.onChangeText('Operador'); });
      await act(async () => { buttonWithText(renderer, 'Salvar alterações').props.onPress(); });
      await waitFor(() => context.pendingCommandReads.length === 1, 'GET após 409');
      await resolveCommandRead(context, { nome: 'Servidor', versao: 2 });
      assert.match(textContent(renderer), /Conflito em nome/);
      assert.equal(buttonWithText(renderer, 'Salvar alterações').props.disabled, true);

      const boundary = context.runtime.administrativeUserData;
      const currentUser = administrativeUserWire({ nome: 'Servidor', documento: 'DOC-V3', versao: 3 });
      await act(async () => {
        assert.equal(boundary.publishAuthoritativeUser(boundary.issueLease(), currentUser), true);
      });
      await flush(4);
      assert.match(textContent(renderer), /Conflito em nome/);
      assert.match(textContent(renderer), /Servidor:\s+Servidor/);
      assert.match(textContent(renderer), /Operador:\s+Operador/);
      assert.equal(inputs(renderer).some((input) => input.props.value === 'DOC-V3'), true);
      assert.equal(inputs(renderer).some((input) => input.props.value === '3'), true);
      assert.equal(buttonWithText(renderer, 'Salvar alterações').props.disabled, true);
      await act(async () => { buttonWithText(renderer, 'Salvar alterações').props.onPress(); });
      await flush(3);
      assert.equal(context.calls.edit, 1, 'nenhum PATCH novo sem escolha explícita');

      await act(async () => {
        buttonWithText(renderer, choice === 'server'
          ? 'Usar valor do servidor'
          : 'Manter valor do operador').props.onPress();
      });
      await flush(2);
      assert.doesNotMatch(textContent(renderer), /Conflito em nome/);
      assert.equal(inputs(renderer).some((input) => input.props.value === (
        choice === 'server' ? 'Servidor' : 'Operador'
      )), true);
      if (choice === 'server') {
        // Um novo campo sujo permite observar que o nome aceito não vai ao PATCH.
        const document = inputs(renderer).find((input) => input.props.value === 'DOC-V3');
        await act(async () => { document.props.onChangeText('DOC-OPERADOR'); });
      }
      commandResponse.status = 200;
      commandResponse.body = {
        resultado: 'atualizado', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 4,
      };
      assert.equal(buttonWithText(renderer, 'Salvar alterações').props.disabled, false);
      await act(async () => { buttonWithText(renderer, 'Salvar alterações').props.onPress(); });
      await waitFor(() => context.calls.edit === 2, 'PATCH posterior à resolução');
      assert.deepEqual(context.commandRequests[1].body, choice === 'server'
        ? { versao: 3, documento: 'DOC-OPERADOR' }
        : { versao: 3, nome: 'Operador' });
      await resolveCommandRead(context, {
        ...currentUser,
        nome: choice === 'server' ? 'Servidor' : 'Operador',
        documento: choice === 'server' ? 'DOC-OPERADOR' : 'DOC-V3',
        versao: 4,
      });
      await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'conclusão após escolha');
    } finally {
      await unmount(renderer);
    }
  });
}

for (const surface of COMMAND_SURFACES) {
  const [route, label, target] = surface;
  test(`${route}: recibo confirmado expõe falha, recupera somente GET e conclui uma vez`, async () => {
    const context = renderedFixture({
      deferMutation: true,
      deferCommandRead: true,
      userStatus: target === 'invitation' ? 'pendente' : 'ativo',
    });
    const renderer = await mountFixture(context);
    let unsubscribe = () => {};
    try {
      const submit = await prepareCommand(context, renderer, surface);
      const beforeGet = context.calls.detail;
      let navigationEvents = 0;
      unsubscribe = httpNavigationRef.addListener('state', () => { navigationEvents += 1; });
      await act(async () => {
        submit();
        await Promise.resolve();
        submit();
      });
      await waitFor(() => context.pendingMutations.length === 1, 'mutação única pendente');
      assert.equal(context.pendingCommandReads.length, 0, 'GET aguarda confirmação da mutação');
      assert.equal(context.calls[target ?? 'create'], 1);
      assert.match(textContent(renderer), /Processando solicitação/);
      assert.doesNotMatch(textContent(renderer), /Comando confirmado\. Carregando versão atual/);
      await act(async () => {
        const gate = context.pendingMutations[0];
        gate.resolve(gate.response);
      });
      await waitFor(() => context.pendingCommandReads.length === 1, 'GET após recibo confirmado');
      assert.match(textContent(renderer), /Comando confirmado\. Carregando versão atual/);
      await act(async () => { submit(); });
      await flush(2);
      assert.equal(context.calls[target ?? 'create'], 1, 'submit durante primeira releitura');
      await failCommandRead(context);
      assertExplicitReconciliationFailure(context, renderer, route);
      assert.equal(context.calls.detail, beforeGet + 1);
      assert.equal(navigationEvents, 0);
      const normalSubmit = buttonWithText(renderer, label);
      assert.ok(normalSubmit === undefined || normalSubmit.props.disabled === true,
        'submit normal indisponível enquanto a reconciliação está pendente');
      await act(async () => { submit(); });
      await flush(2);
      assert.equal(context.calls[target ?? 'create'], 1, 'submit enfileirado não repete comando confirmado');
      assertExplicitReconciliationFailure(context, renderer, route);

      // Nova falha de rede e respostas não correlacionadas mantêm a recuperação explícita.
      for (const failure of [
        null,
        { status: 200, body: administrativeUserWire({
          ...context.currentUser, id: '99999999-9999-4999-8999-999999999999',
        }) },
        { status: 200, body: administrativeUserWire({ ...context.currentUser, versao: 1 }) },
      ]) {
        const beforeRetry = context.pendingCommandReads.length;
        await pressTwice(buttonWithText(renderer, 'Tentar carregar versão atual'));
        await waitFor(() => context.pendingCommandReads.length === beforeRetry + 1, 'GET único da recuperação');
        assert.match(textContent(renderer), /Comando confirmado\. Carregando versão atual/);
        await act(async () => { submit(); });
        await flush(2);
        assert.equal(context.calls[target ?? 'create'], 1, 'recovery/submit não repetem POST/PATCH');
        assert.equal(context.pendingCommandReads.length, beforeRetry + 1);
        assert.equal(navigationEvents, 0);
        await failCommandRead(context, failure);
        assertExplicitReconciliationFailure(context, renderer, route);
        assert.equal(navigationEvents, 0, 'falha ou GET não correlacionado não navega');
      }

      const beforeFinalRead = context.pendingCommandReads.length;
      await pressTwice(buttonWithText(renderer, 'Tentar carregar versão atual'));
      await waitFor(() => context.pendingCommandReads.length === beforeFinalRead + 1, 'GET final único');
      const receipt = context.pendingMutations[0].response.body;
      await resolveCommandRead(context, { versao: receipt.versao + 1 });
      await waitFor(() => currentRouteName() === 'AdministrativeUserDetail', 'conclusão reconciliada');
      const publication = context.runtime.administrativeUserData.current.mutation;
      assert.equal(publication?.kind, 'authoritative_user');
      assert.equal(publication.user.id, receipt.recurso_id);
      assert.equal(publication.user.versao, receipt.versao + 1);
      assert.equal(context.calls[target ?? 'create'], 1);
      assert.equal(context.calls.detail, beforeGet + context.pendingCommandReads.length);
      assert.equal(navigationEvents, 1, 'conclusão consumida uma única vez');
      await act(async () => { submit(); });
      await flush(3);
      assert.equal(context.calls[target ?? 'create'], 1, 'callback da tela desmontada permanece inerte');
      assert.equal(navigationEvents, 1);
    } finally {
      unsubscribe();
      await unmount(renderer);
    }
  });
}

for (const interruption of ['admin', 'produtor', 'dispose']) {
  test(`recovery real de edição descarta resposta e callbacks após ${interruption}`, async () => {
    const context = renderedFixture({ deferCommandRead: true });
    let renderer = await mountFixture(context);
    try {
      const submit = await prepareCommand(context, renderer, COMMAND_SURFACES[1]);
      await act(async () => { submit(); });
      await waitFor(() => context.pendingCommandReads.length === 1, 'primeira releitura');
      await failCommandRead(context);
      assertExplicitReconciliationFailure(context, renderer, 'AdministrativeUserEdit');
      const recover = buttonWithText(renderer, 'Tentar carregar versão atual').props.onPress;
      await act(async () => { recover(); });
      await waitFor(() => context.pendingCommandReads.length === 2, 'recovery pendente');
      if (interruption === 'dispose') {
        await unmount(renderer);
        renderer = null;
      } else {
        const previousPartition = context.runtime.administrativeUserData.current.partitionKey;
        await act(async () => {
          await context.sessionUi.login(`${interruption}@example.test`, 'Senha válida 123');
        });
        await waitFor(() => context.runtime.administrativeUserData.current.partitionKey !== previousPartition,
          'nova partição da sessão');
        assert.equal(currentRouteName(), 'Properties');
        assert.equal(buttonWithText(renderer, 'Tentar carregar versão atual'), undefined);
      }
      const publicationAfterInterruption = context.runtime.administrativeUserData.current.mutation;
      const readsAfterInterruption = context.calls.detail;
      await act(async () => {
        recover();
        submit();
      });
      await resolveCommandRead(context, { nome: 'Resposta antiga de recovery', versao: 3 });
      assert.equal(context.calls.detail, readsAfterInterruption, 'callback antigo não dispara GET');
      assert.equal(context.calls.edit, 1, 'callback antigo não dispara PATCH');
      assert.strictEqual(context.runtime.administrativeUserData.current.mutation, publicationAfterInterruption,
        'resposta da identidade/tela anterior não publica dados');
      assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
      if (renderer !== null) {
        assert.equal(currentRouteName(), 'Properties', 'resposta tardia não navega');
        assert.doesNotMatch(textContent(renderer), /Resposta antiga de recovery|Nome para reconciliação/);
      }
    } finally {
      if (renderer !== null) await unmount(renderer);
    }
  });
}

test('StrictMode monta e desmonta as quatro telas sem assinatura residual', async () => {
  for (const [route, _label, target] of COMMAND_SURFACES) {
    const context = renderedFixture({ userStatus: target === 'invitation' ? 'pendente' : 'ativo' });
    const renderer = await mountFixture(context, true);
    if (target === null) await navigate(route);
    else await openFromDetail(context, renderer, route);
    assert.ok(context.runtime.administrativeUserData.activeSubscriptionCount >= 1);
    await unmount(renderer);
    assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0, route);
  }
});

test('Admin→não-Admin durante releitura desmonta cada comando e impede publicação/navegação tardias', async () => {
  for (const [route, label, target] of COMMAND_SURFACES) {
    const context = renderedFixture({
      deferCommandRead: true,
      userStatus: target === 'invitation' ? 'pendente' : 'ativo',
    });
    const renderer = await mountFixture(context);
    if (target === null) {
      await navigate(route);
      const fields = inputs(renderer).slice(-5);
      await act(async () => {
        fields[0].props.onChangeText('Novo');
        fields[1].props.onChangeText('novo@example.test');
      });
      await pressTwice(buttonWithText(renderer, label));
    } else {
      await openFromDetail(context, renderer, route);
      if (target === 'edit') {
        const nameField = inputs(renderer).find((input) => input.props.value === 'Usuário Renderizado');
        assert.ok(nameField);
        await act(async () => { nameField.props.onChangeText('Editado'); });
        await pressTwice(buttonWithText(renderer, label));
      } else {
        await act(async () => { buttonWithText(renderer, label).props.onPress(); });
        await flush(1);
        const confirmation = target === 'status' ? 'Confirmar alteração' : 'Confirmar reemissão';
        await pressTwice(pressablesWithText(renderer, confirmation)[0]);
      }
    }
    await waitFor(() => context.pendingCommandReads.length === 1, `releitura pendente ${route}`);
    const mutationKind = target ?? 'create';
    assert.equal(context.calls[mutationKind], 1);
    await act(async () => {
      await context.sessionUi.login('produtor@example.test', 'Senha válida 123');
    });
    await waitFor(() => context.sessionUi.snapshot.usuario.perfil === 'produtor', 'troca para Produtor');
    const routeAfterSwitch = currentRouteName();
    assert.equal(routeAfterSwitch, 'Properties');
    const mutationBeforeLate = context.runtime.administrativeUserData.current.mutation;
    await resolveCommandRead(context, { nome: 'Resposta tardia', versao: 2 });
    assert.equal(currentRouteName(), routeAfterSwitch);
    assert.strictEqual(context.runtime.administrativeUserData.current.mutation, mutationBeforeLate);
    assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
    await unmount(renderer);
  }
});

test('navegação programática não-Admin falha fechada para as quatro rotas', async () => {
  for (const profile of ['produtor', 'colaborador']) {
    const context = renderedFixture({ initialProfile: profile });
    const renderer = await mountFixture(context);
    const before = context.calls.administrativeHttp;
    for (const [route] of COMMAND_SURFACES) {
      await act(async () => { httpNavigationRef.navigate(route, { id: USER_ID }); });
      await flush(1);
      assert.equal(rootState().routeNames.includes(route), false);
      assert.equal(currentRouteName(), 'Properties');
    }
    assert.equal(context.calls.administrativeHttp, before);
    await unmount(renderer);
  }
});
