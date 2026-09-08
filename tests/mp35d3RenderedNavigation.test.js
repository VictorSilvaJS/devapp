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
