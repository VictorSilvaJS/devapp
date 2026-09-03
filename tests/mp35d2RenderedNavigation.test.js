const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const TestRenderer = require('react-test-renderer');

const consoleErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.map(String).join(' ');
  if (message.startsWith('react-test-renderer is deprecated')) return;
  consoleErrors.push(message);
  if (message.includes("The action 'NAVIGATE'") && message.includes('was not handled')) {
    return;
  }
  originalConsoleError(...args);
};

global.IS_REACT_ACT_ENVIRONMENT = true;
global.document = { title: '' };
const browserListeners = new Map();
const browserLocation = { hash: '', pathname: '/', search: '' };
const browserHistory = {
  state: null,
  go() {},
  pushState(state, _title, url) {
    this.state = state;
    browserLocation.pathname = url || '/';
  },
  replaceState(state, _title, url) {
    this.state = state;
    browserLocation.pathname = url || '/';
  },
};
global.location = browserLocation;
global.window = {
  document: global.document,
  history: browserHistory,
  location: browserLocation,
  addEventListener(event, listener) {
    const listeners = browserListeners.get(event) ?? new Set();
    listeners.add(listener);
    browserListeners.set(event, listeners);
  },
  removeEventListener(event, listener) {
    browserListeners.get(event)?.delete(listener);
  },
};

const { act } = TestRenderer;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COLLABORATOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FRAME = Object.freeze({ x: 0, y: 0, width: 400, height: 800 });
const INSETS = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function host(name) {
  return React.forwardRef(function NativePrimitive({ children, ...props }, ref) {
    return React.createElement(name, { ...props, ref }, children);
  });
}

const NativeView = host('View');
const NativeText = host('Text');
const NativePressable = host('Pressable');

const FlatList = React.forwardRef(function FlatList({
  data = [],
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  ...props
}, ref) {
  const children = [];
  if (ListHeaderComponent) {
    children.push(React.cloneElement(ListHeaderComponent, { key: 'header' }));
  }
  data.forEach((item, index) => {
    children.push(React.createElement(
      React.Fragment,
      { key: item.id ?? index },
      renderItem({ item, index }),
    ));
  });
  if (data.length === 0 && ListEmptyComponent) {
    children.push(React.cloneElement(ListEmptyComponent, { key: 'empty' }));
  }
  if (ListFooterComponent) {
    children.push(React.cloneElement(ListFooterComponent, { key: 'footer' }));
  }
  return React.createElement('FlatList', { ...props, ref }, children);
});

class AnimatedValue {
  constructor(value) {
    this.value = value;
  }

  interpolate() {
    return this;
  }

  setValue(value) {
    this.value = value;
  }

  stopAnimation(callback) {
    callback?.(this.value);
  }
}

function animation() {
  return {
    start(callback) { callback?.({ finished: true }); },
    stop() {},
  };
}

const linkingControl = {
  initialUrl: null,
  getInitialUrlCalls: 0,
  listeners: new Set(),
  reset(initialUrl = null) {
    this.initialUrl = initialUrl;
    this.getInitialUrlCalls = 0;
    this.listeners.clear();
  },
  emit(url) {
    for (const listener of this.listeners) listener({ url });
  },
};

const nativeMock = {
  ActivityIndicator: host('ActivityIndicator'),
  Animated: {
    Value: AnimatedValue,
    View: host('AnimatedView'),
    Text: host('AnimatedText'),
    createAnimatedComponent: (Component) => Component,
    parallel: animation,
    spring: animation,
    timing: animation,
  },
  AppState: {
    currentState: 'active',
    addEventListener() { return { remove() {} }; },
  },
  Dimensions: {
    get: () => FRAME,
    addEventListener: () => ({ remove() {} }),
  },
  Easing: {
    in: (value) => value,
    out: (value) => value,
    quadratic: (value) => value,
  },
  FlatList,
  I18nManager: {
    isRTL: false,
    getConstants: () => ({ isRTL: false }),
  },
  Image: host('Image'),
  Keyboard: {
    addListener() { return { remove() {} }; },
    dismiss() {},
  },
  KeyboardAvoidingView: host('KeyboardAvoidingView'),
  Linking: {
    async getInitialURL() {
      linkingControl.getInitialUrlCalls += 1;
      return linkingControl.initialUrl;
    },
    addEventListener(event, listener) {
      assert.equal(event, 'url');
      linkingControl.listeners.add(listener);
      return { remove: () => linkingControl.listeners.delete(listener) };
    },
    async canOpenURL() { return true; },
    async openURL() {},
  },
  Modal: host('Modal'),
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Platform: {
    OS: 'android',
    Version: 35,
    isPad: false,
    select: (options) => options.android ?? options.default,
  },
  Pressable: NativePressable,
  ScrollView: host('ScrollView'),
  StyleSheet: {
    absoluteFill: {},
    absoluteFillObject: {},
    create: (styles) => styles,
    flatten(style) {
      if (!Array.isArray(style)) return style ?? {};
      return Object.assign({}, ...style.filter(Boolean).map((item) => (
        typeof item === 'object' ? item : {}
      )));
    },
    hairlineWidth: 1,
  },
  Switch: host('Switch'),
  Text: NativeText,
  TextInput: host('TextInput'),
  TouchableOpacity: host('TouchableOpacity'),
  UIManager: { getViewManagerConfig: () => null },
  View: NativeView,
  findNodeHandle: () => null,
  useWindowDimensions: () => ({ ...FRAME, scale: 1, fontScale: 1 }),
};

const SafeAreaInsetsContext = React.createContext(INSETS);
const SafeAreaFrameContext = React.createContext(FRAME);

function SafeAreaProvider({ children }) {
  return React.createElement(
    SafeAreaFrameContext.Provider,
    { value: FRAME },
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: INSETS },
      React.createElement('SafeAreaProvider', null, children),
    ),
  );
}

const safeAreaMock = {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView: host('SafeAreaView'),
  initialWindowMetrics: { frame: FRAME, insets: INSETS },
  useSafeAreaFrame: () => FRAME,
  useSafeAreaInsets: () => INSETS,
};

const screensMock = {
  Screen: host('Screen'),
  ScreenContainer: host('ScreenContainer'),
  ScreenStack: host('ScreenStack'),
  ScreenStackHeaderBackButtonImage: host('ScreenStackHeaderBackButtonImage'),
  ScreenStackHeaderCenterView: host('ScreenStackHeaderCenterView'),
  ScreenStackHeaderConfig: host('ScreenStackHeaderConfig'),
  ScreenStackHeaderLeftView: host('ScreenStackHeaderLeftView'),
  ScreenStackHeaderRightView: host('ScreenStackHeaderRightView'),
  ScreenStackHeaderSearchBarView: host('ScreenStackHeaderSearchBarView'),
  enableFreeze() {},
  enableScreens() {},
  freezeEnabled: () => true,
  isSearchBarAvailableForCurrentPlatform: false,
  screensEnabled: () => true,
  shouldUseActivityState: true,
};

const originalLoad = Module._load;
Module._load = function loadWithNativePrimitives(request, parent, isMain) {
  if (/\.(?:png|jpe?g|gif|webp)$/i.test(request)) {
    return { uri: `test-asset:${request}` };
  }
  if (request === 'react-native') return nativeMock;
  if (request === 'react-native-safe-area-context') return safeAreaMock;
  if (request === 'react-native-screens') return screensMock;
  if (request === 'react-native-gesture-handler') {
    return { GestureHandlerRootView: host('GestureHandlerRootView') };
  }
  if (request === '@expo/vector-icons') return { Ionicons: host('Ionicons') };
  if (request === 'expo-linear-gradient') {
    return { LinearGradient: host('LinearGradient') };
  }
  if (request === 'expo-secure-store') {
    return {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'test',
      async deleteItemAsync() {},
      async getItemAsync() { return null; },
      async setItemAsync() {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  AccountActionProvider,
} = require('../.tmp-mp35d2-navigation/src/http/AccountActionContext');
const {
  HttpNavigation,
  httpNavigationRef,
} = require('../.tmp-mp35d2-navigation/src/http/HttpNavigation');
const {
  HttpSessionProvider,
  useHttpSession,
} = require('../.tmp-mp35d2-navigation/src/http/HttpSessionContext');
const {
  createHttpRuntime,
} = require('../.tmp-mp35d2-navigation/src/http/runtime');
const {
  AdministrativeUserListController,
} = require('../.tmp-mp35d2-navigation/src/http/administrativeUserListController');
const {
  AdministrativeUserDetailController,
} = require('../.tmp-mp35d2-navigation/src/http/administrativeUserDetailController');
const {
  HttpAdministrativeUsersScreen,
} = require('../.tmp-mp35d2-navigation/src/http/screens/HttpAdministrativeUserScreens');
const {
  HttpNotificationProvider,
} = require('../.tmp-mp35d2-navigation/src/http/HttpNotificationContext');

function tokenWire(profile, sequence) {
  const userId = profile === 'admin'
    ? ADMIN_ID
    : profile === 'produtor'
      ? PRODUCER_ID
      : COLLABORATOR_ID;
  const tokenCharacter = String.fromCharCode(65 + (sequence % 20));
  return {
    access_token: tokenCharacter.repeat(43),
    refresh_token: tokenCharacter.toLowerCase().repeat(43),
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: '2026-09-03T12:00:00.000Z',
    access_expira_em: '2026-09-03T12:15:00.000Z',
    sessao: {
      id: `${String(sequence).padStart(8, '0')}-1111-4111-8111-111111111111`,
      expira_inatividade_em: '2026-09-10T12:00:00.000Z',
      expira_absolutamente_em: '2026-10-03T12:00:00.000Z',
    },
    usuario: {
      id: userId,
      organizacao_id: 'org_tche_fertilidade',
      nome: `Operador ${profile}`,
      email: `${profile}@example.test`,
      perfil: profile,
      status: 'ativo',
      versao_autorizacao: sequence,
    },
    escopo: {
      modo: profile === 'admin' ? 'organizacao' : 'vinculos_propriedade',
      versao: sequence,
    },
  };
}

function administrativeUserWire() {
  return {
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: null,
    nome: 'Usuário Renderizado',
    email: 'renderizado@example.test',
    perfil: 'admin',
    status: 'ativo',
    telefone: null,
    documento: 'DOC-RENDERIZADO',
    observacoes: null,
    versao: 1,
    criado_em: '2026-09-01T12:00:00.000Z',
    atualizado_em: '2026-09-02T12:00:00.000Z',
  };
}

function controllerCounters() {
  return {
    list: {
      created: 0,
      disposed: 0,
      subscriptions: 0,
      unsubscriptions: 0,
      listenerCalls: 0,
      instances: [],
    },
    detail: {
      created: 0,
      disposed: 0,
      subscriptions: 0,
      unsubscriptions: 0,
      listenerCalls: 0,
      instances: [],
    },
  };
}

function instrumentController(controller, counter) {
  counter.created += 1;
  counter.instances.push(controller);
  const originalSubscribe = controller.subscribe.bind(controller);
  const originalDispose = controller.dispose.bind(controller);
  let disposed = false;
  controller.subscribe = (listener) => {
    counter.subscriptions += 1;
    const unsubscribe = originalSubscribe(() => {
      counter.listenerCalls += 1;
      listener();
    });
    let subscribed = true;
    return () => {
      if (subscribed) {
        subscribed = false;
        counter.unsubscriptions += 1;
      }
      unsubscribe();
    };
  };
  controller.dispose = () => {
    if (!disposed) {
      disposed = true;
      counter.disposed += 1;
    }
    originalDispose();
  };
  return controller;
}

function createInstrumentedControllerFactory(counters) {
  return Object.freeze({
    createList(repository, boundary) {
      return instrumentController(
        new AdministrativeUserListController(repository, boundary),
        counters.list,
      );
    },
    createDetail(repository, boundary) {
      return instrumentController(
        new AdministrativeUserDetailController(repository, boundary),
        counters.detail,
      );
    },
  });
}

function renderedFixture({
  initialProfile = 'admin',
  failInitial = false,
  deferDetail = false,
  initialUrl = null,
} = {}) {
  linkingControl.reset(initialUrl);
  let loginSequence = 0;
  const calls = {
    administrativeHttp: 0,
    detail: 0,
    list: 0,
    notifications: 0,
    properties: 0,
  };
  const pendingDetails = [];
  const pendingList = [];
  const counters = controllerCounters();
  const store = {
    value: null,
    async read() { return this.value; },
    async write(value) { this.value = value; },
    async clear() { this.value = null; },
  };
  const transport = {
    async send(request) {
      const url = new URL(request.url);
      if (url.pathname === '/v1/auth/login') {
        loginSequence += 1;
        const email = String(request.body.email);
        const profile = email.startsWith('produtor')
          ? 'produtor'
          : email.startsWith('colaborador')
            ? 'colaborador'
            : 'admin';
        return { status: 200, body: tokenWire(profile, loginSequence) };
      }
      if (url.pathname === '/v1/propriedades') {
        calls.properties += 1;
        return {
          status: 200,
          body: { itens: [], paginacao: { proximo_cursor: null } },
        };
      }
      if (url.pathname === '/v1/usuarios') {
        calls.list += 1;
        calls.administrativeHttp += 1;
        if (failInitial && calls.list === 1) {
          return {
            status: 503,
            body: { error: { code: 'service_unavailable' } },
          };
        }
        const gate = deferred();
        pendingList.push(gate);
        return gate.promise;
      }
      if (url.pathname === `/v1/usuarios/${USER_ID}`) {
        calls.detail += 1;
        calls.administrativeHttp += 1;
        if (!deferDetail) {
          return { status: 200, body: administrativeUserWire() };
        }
        const gate = deferred();
        pendingDetails.push(gate);
        return gate.promise;
      }
      if (url.pathname === '/v1/notificacoes/contador-nao-lidas') {
        calls.notifications += 1;
        return { status: 200, body: { total_nao_lidas: 0 } };
      }
      if (url.pathname === '/v1/notificacoes') {
        calls.notifications += 1;
        return {
          status: 200,
          body: { itens: [], paginacao: { proximo_cursor: null } },
        };
      }
      throw new Error(`HTTP não previsto no teste: ${request.method} ${request.url}`);
    },
  };
  const runtime = createHttpRuntime({
    apiBaseUrl: 'https://api.tcheagro.example',
    actionBaseUrl: 'https://app.tcheagro.example/actions/',
    allowInsecureDevelopmentHttp: false,
  }, {
    administrativeUserControllerFactory:
      createInstrumentedControllerFactory(counters),
    transport,
    refreshTokenStore: store,
    monotonicNow: () => 0,
    wallClockNow: () => Date.parse('2026-09-03T12:00:00.000Z'),
  });
  let sessionUi = null;
  function SessionDriver() {
    const value = useHttpSession();
    const started = React.useRef(false);
    sessionUi = value;
    React.useEffect(() => {
      if (value.status === 'anonymous' && !started.current) {
        started.current = true;
        void value.login(`${initialProfile}@example.test`, 'Senha válida 123');
      }
    }, [value]);
    return null;
  }
  function App() {
    return React.createElement(
      HttpSessionProvider,
      { runtime },
      React.createElement(
        AccountActionProvider,
        null,
        React.createElement(SessionDriver),
        React.createElement(HttpNavigation),
      ),
    );
  }
  function StrictListApp() {
    return React.createElement(
      HttpSessionProvider,
      { runtime },
      React.createElement(SessionDriver),
      React.createElement(
        HttpNotificationProvider,
        null,
        React.createElement(HttpAdministrativeUsersScreen, {
          navigation: { navigate() {} },
        }),
      ),
    );
  }
  return {
    App,
    calls,
    counters,
    get sessionUi() { return sessionUi; },
    pendingDetails,
    pendingList,
    runtime,
    StrictListApp,
  };
}

async function flush(times = 6) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });
}

async function waitFor(predicate, description) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await flush(1);
  }
  assert.fail(`Tempo esgotado: ${description}`);
}

function currentRouteName() {
  return httpNavigationRef.getCurrentRoute()?.name ?? null;
}

function rootState() {
  assert.equal(httpNavigationRef.isReady(), true);
  return httpNavigationRef.getRootState();
}

function findNavigationState(state, predicate) {
  if (!state) return null;
  if (predicate(state)) return state;
  for (const route of state.routes ?? []) {
    const found = findNavigationState(route.state, predicate);
    if (found !== null) return found;
  }
  return null;
}

function tabState() {
  return findNavigationState(rootState(), (state) => state.type === 'tab');
}

function mainRouteKey() {
  return rootState().routes.find((route) => route.name === 'Main')?.key ?? null;
}

function textContent(renderer) {
  return renderer.root.findAllByType('Text')
    .flatMap((node) => node.children)
    .filter((value) => typeof value === 'string')
    .join(' ');
}

function pressableWithText(renderer, expectedText) {
  return renderer.root.findAllByType('Pressable').find((node) => (
    node.findAllByType('Text').some((text) => text.children.includes(expectedText))
  ));
}

async function mountFixture(context, strict = false) {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      strict
        ? React.createElement(
          React.StrictMode,
          null,
          React.createElement(context.App),
        )
        : React.createElement(context.App),
    );
  });
  await waitFor(
    () => context.sessionUi?.status === 'authenticated' && httpNavigationRef.isReady(),
    'sessão autenticada e NavigationContainer pronto',
  );
  await flush(3);
  return renderer;
}

async function navigateToUsers(renderer) {
  const tabs = tabState();
  assert.ok(tabs?.routeNames.includes('Users'));
  const tabButtons = renderer.root.findAllByType('Pressable').filter((node) => (
    node.props.accessibilityRole === 'tab' &&
    node.findAllByType('Text').some((text) => text.children.includes('Usuários'))
  ));
  const tabButton = tabButtons.at(-1);
  assert.ok(tabButton, 'o tab bar real deve expor a ação Usuários');
  assert.equal(tabButton.props.accessibilityState.selected, false);
  await act(async () => {
    tabButton.props.onPress();
  });
  try {
    await waitFor(() => currentRouteName() === 'Users', 'aba Usuários focada');
  } catch (error) {
    throw new Error(
      `${error.message}; rota=${currentRouteName()}; estado=${JSON.stringify(rootState())}`,
    );
  }
}

async function resolveListPage(gate, {
  items = [administrativeUserWire()],
  nextCursor = null,
} = {}) {
  await act(async () => {
    gate.resolve({
      status: 200,
      body: {
        itens: items,
        paginacao: { proximo_cursor: nextCursor },
      },
    });
    await gate.promise;
  });
  await flush();
}

async function unmount(renderer) {
  await act(async () => { renderer.unmount(); });
  await flush(2);
}

test('React Navigation real registra Admin, abre detalhe e volta para a lista', async () => {
  const context = renderedFixture();
  const renderer = await mountFixture(context);

  assert.equal(currentRouteName(), 'Properties');
  assert.ok(rootState().routeNames.includes('AdministrativeUserDetail'));
  assert.ok(tabState().routeNames.includes('Users'));
  assert.equal(context.counters.list.created, 0);
  assert.equal(context.counters.detail.created, 0);

  await navigateToUsers(renderer);
  assert.equal(context.counters.list.created, 1);
  assert.equal(context.counters.list.subscriptions, 1);
  assert.equal(context.calls.list, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 1);
  assert.match(textContent(renderer), /Carregando Usuários/);

  await resolveListPage(context.pendingList[0]);
  assert.match(textContent(renderer), /Usuário Renderizado/);
  const card = pressableWithText(renderer, 'Usuário Renderizado');
  assert.ok(card);
  await act(async () => { card.props.onPress(); });
  await waitFor(
    () => currentRouteName() === 'AdministrativeUserDetail',
    'detalhe administrativo focado',
  );
  assert.equal(context.counters.detail.created, 1);
  assert.equal(context.counters.detail.subscriptions, 1);
  assert.equal(context.calls.detail, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 2);
  assert.match(textContent(renderer), /DOC-RENDERIZADO/);

  await act(async () => { httpNavigationRef.goBack(); });
  await waitFor(() => currentRouteName() === 'Users', 'retorno para Usuários');
  await flush(2);
  assert.equal(context.counters.detail.disposed, 1);
  assert.equal(context.counters.detail.unsubscriptions, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 1);
  assert.match(textContent(renderer), /Usuário Renderizado/);
  assert.equal(context.calls.list, 1);

  await unmount(renderer);
  assert.equal(context.counters.list.disposed, 1);
  assert.equal(context.counters.list.unsubscriptions, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
});

async function assertNonAdminNavigation(profile) {
  const administrativeUrl = `https://app.tcheagro.example/usuarios/${USER_ID}`;
  const context = renderedFixture({ initialProfile: profile, initialUrl: administrativeUrl });
  const renderer = await mountFixture(context);

  assert.equal(currentRouteName(), 'Properties');
  assert.equal(rootState().routeNames.includes('AdministrativeUserDetail'), false);
  assert.equal(tabState().routeNames.includes('Users'), false);
  assert.equal(context.counters.list.created, 0);
  assert.equal(context.counters.detail.created, 0);
  assert.equal(context.counters.list.subscriptions, 0);
  assert.equal(context.counters.detail.subscriptions, 0);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
  assert.equal(context.calls.administrativeHttp, 0);
  assert.ok(linkingControl.getInitialUrlCalls > 0);

  const routeBefore = currentRouteName();
  const errorCount = consoleErrors.length;
  let navigateResult;
  await act(async () => {
    navigateResult = httpNavigationRef.navigate(
      'AdministrativeUserDetail',
      { id: USER_ID },
    );
  });
  await flush();
  assert.equal(navigateResult, undefined);
  assert.equal(currentRouteName(), routeBefore);
  assert.equal(rootState().routeNames.includes('AdministrativeUserDetail'), false);
  assert.equal(context.counters.list.created, 0);
  assert.equal(context.counters.detail.created, 0);
  assert.equal(context.calls.administrativeHttp, 0);
  assert.ok(
    consoleErrors.slice(errorCount).some((message) => (
      message.includes("The action 'NAVIGATE'") &&
      message.includes('AdministrativeUserDetail')
    )),
  );

  await act(async () => { linkingControl.emit(administrativeUrl); });
  await flush();
  assert.equal(currentRouteName(), routeBefore);
  assert.equal(context.counters.list.created, 0);
  assert.equal(context.counters.detail.created, 0);
  assert.equal(context.calls.administrativeHttp, 0);

  await unmount(renderer);
}

test('Produtor usa React Navigation real e não registra nem cria superfície administrativa', async () => {
  await assertNonAdminNavigation('produtor');
});

test('Colaborador usa React Navigation real e não registra nem cria superfície administrativa', async () => {
  await assertNonAdminNavigation('colaborador');
});

async function assertDirectProfileTransition(targetProfile, remountAdmin = false) {
  const context = renderedFixture();
  const renderer = await mountFixture(context);
  await navigateToUsers(renderer);
  await resolveListPage(context.pendingList[0], { nextCursor: 'cursor-pendente' });

  const loadMoreButton = pressableWithText(renderer, 'Carregar mais');
  assert.ok(loadMoreButton);
  await act(async () => { loadMoreButton.props.onPress(); });
  await waitFor(() => context.calls.list === 2, 'loadMore pendente');
  const stalePage = context.pendingList[1];

  await act(async () => {
    httpNavigationRef.navigate('AdministrativeUserDetail', { id: USER_ID });
  });
  await waitFor(
    () => currentRouteName() === 'AdministrativeUserDetail',
    'detalhe antes da troca de perfil',
  );
  assert.equal(context.counters.list.created, 1);
  assert.equal(context.counters.detail.created, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 2);
  assert.match(textContent(renderer), /DOC-RENDERIZADO/);

  const oldMainKey = mainRouteKey();
  const listController = context.counters.list.instances[0];
  const detailController = context.counters.detail.instances[0];
  const administrativeHttpBeforeSwitch = context.calls.administrativeHttp;
  await act(async () => {
    await context.sessionUi.login(
      `${targetProfile}@example.test`,
      'Senha válida 123',
    );
  });
  await waitFor(
    () => context.sessionUi?.snapshot?.usuario?.perfil === targetProfile,
    `sessão ${targetProfile}`,
  );
  await flush(3);

  assert.equal(currentRouteName(), 'Properties');
  assert.equal(rootState().routeNames.includes('AdministrativeUserDetail'), false);
  assert.equal(tabState().routeNames.includes('Users'), false);
  assert.notEqual(mainRouteKey(), oldMainKey);
  assert.equal(context.counters.list.disposed, 1);
  assert.equal(context.counters.detail.disposed, 1);
  assert.equal(context.counters.list.unsubscriptions, 1);
  assert.equal(context.counters.detail.unsubscriptions, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
  assert.deepEqual(listController.snapshot.items, []);
  assert.equal(listController.snapshot.nextCursor, null);
  assert.equal(detailController.snapshot.user, null);
  assert.doesNotMatch(textContent(renderer), /Usuário Renderizado|DOC-RENDERIZADO/);

  await act(async () => {
    linkingControl.emit(`https://app.tcheagro.example/usuarios/${USER_ID}`);
  });
  await flush();
  assert.equal(rootState().routeNames.includes('AdministrativeUserDetail'), false);
  assert.equal(context.counters.list.created, 1);
  assert.equal(context.counters.detail.created, 1);
  assert.equal(context.calls.administrativeHttp, administrativeHttpBeforeSwitch);
  assert.doesNotMatch(textContent(renderer), /Usuário Renderizado|DOC-RENDERIZADO/);

  const listSnapshotAfterRemoval = listController.snapshot;
  const detailSnapshotAfterRemoval = detailController.snapshot;
  const listenerCallsAfterRemoval =
    context.counters.list.listenerCalls + context.counters.detail.listenerCalls;
  stalePage.resolve({
    status: 200,
    body: {
      itens: [administrativeUserWire()],
      paginacao: { proximo_cursor: 'cursor-tardio' },
    },
  });
  await flush();
  assert.strictEqual(listController.snapshot, listSnapshotAfterRemoval);
  assert.strictEqual(detailController.snapshot, detailSnapshotAfterRemoval);
  assert.equal(
    context.counters.list.listenerCalls + context.counters.detail.listenerCalls,
    listenerCallsAfterRemoval,
  );
  assert.equal(context.calls.administrativeHttp, administrativeHttpBeforeSwitch);
  assert.equal(context.counters.list.created, 1);
  assert.equal(context.counters.detail.created, 1);
  assert.doesNotMatch(textContent(renderer), /Usuário Renderizado|DOC-RENDERIZADO/);

  if (remountAdmin) {
    await act(async () => {
      await context.sessionUi.login('admin@example.test', 'Senha válida 123');
    });
    await waitFor(
      () => context.sessionUi?.snapshot?.usuario?.perfil === 'admin',
      'retorno para Admin',
    );
    assert.ok(rootState().routeNames.includes('AdministrativeUserDetail'));
    assert.ok(tabState().routeNames.includes('Users'));
    assert.equal(context.counters.list.created, 1);
    await navigateToUsers(renderer);
    assert.equal(context.counters.list.created, 2);
    assert.equal(context.calls.list, 3);
    assert.doesNotMatch(textContent(renderer), /Usuário Renderizado/);
    await resolveListPage(context.pendingList[2], { nextCursor: null });
    assert.match(textContent(renderer), /Usuário Renderizado/);
  }

  await unmount(renderer);
  assert.equal(context.counters.list.disposed, remountAdmin ? 2 : 1);
  assert.equal(context.counters.detail.disposed, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
}

test('navigationKey real desmonta Admin e limpa Promise pendente na troca direta para Produtor', async () => {
  await assertDirectProfileTransition('produtor');
});

test('navigationKey real desmonta Admin na troca direta para Colaborador e remonta limpo', async () => {
  await assertDirectProfileTransition('colaborador', true);
});

test('falha inicial na tela real encerra spinner e apresenta retry', async () => {
  const context = renderedFixture({ failInitial: true });
  const renderer = await mountFixture(context);
  await navigateToUsers(renderer);
  await waitFor(() => context.calls.list === 1, 'primeira carga falha');
  await flush();
  assert.equal(context.counters.list.created, 1);
  assert.doesNotMatch(textContent(renderer), /Carregando Usuários/);
  assert.match(textContent(renderer), /Tentar novamente/);
  await unmount(renderer);
  assert.equal(context.counters.list.disposed, 1);
});

test('StrictMode monta e desmonta o estado real do React Navigation', async () => {
  const context = renderedFixture();
  const renderer = await mountFixture(context, true);
  assert.equal(currentRouteName(), 'Properties');
  assert.ok(rootState().routeNames.includes('AdministrativeUserDetail'));
  assert.ok(tabState().routeNames.includes('Users'));
  assert.equal(context.counters.list.created, 0);
  assert.equal(context.counters.detail.created, 0);
  assert.equal(context.calls.administrativeHttp, 0);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
  await unmount(renderer);
  assert.equal(httpNavigationRef.isReady(), false);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
});

test('StrictMode da tela real não duplica o GET inicial', async () => {
  const context = renderedFixture();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(
      React.StrictMode,
      null,
      React.createElement(context.StrictListApp),
    ));
  });
  await waitFor(
    () => context.sessionUi?.status === 'authenticated' && context.calls.list === 1,
    'tela administrativa autenticada em StrictMode',
  );
  assert.equal(context.calls.list, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 1);
  await resolveListPage(context.pendingList[0], { items: [], nextCursor: null });
  assert.equal(context.calls.list, 1);
  assert.doesNotMatch(textContent(renderer), /Carregando Usuários/);
  assert.match(textContent(renderer), /Nenhum Usuário cadastrado/);
  await unmount(renderer);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
});

test('unmount real remove listeners e torna resposta administrativa tardia inerte', async () => {
  const context = renderedFixture();
  const renderer = await mountFixture(context);
  await navigateToUsers(renderer);
  assert.equal(context.calls.list, 1);
  assert.equal(context.counters.list.created, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 1);

  const controller = context.counters.list.instances[0];
  const listenerCallsBeforeUnmount = context.counters.list.listenerCalls;
  const consoleErrorStart = consoleErrors.length;
  await unmount(renderer);
  assert.equal(context.counters.list.disposed, 1);
  assert.equal(context.counters.list.unsubscriptions, 1);
  assert.equal(context.runtime.administrativeUserData.activeSubscriptionCount, 0);
  const snapshotAfterUnmount = controller.snapshot;

  context.pendingList[0].resolve({
    status: 200,
    body: {
      itens: [administrativeUserWire()],
      paginacao: { proximo_cursor: 'cursor-tardio' },
    },
  });
  await flush();
  assert.strictEqual(controller.snapshot, snapshotAfterUnmount);
  assert.equal(context.counters.list.listenerCalls, listenerCallsBeforeUnmount);
  assert.equal(renderer.toJSON(), null);
  assert.equal(
    consoleErrors.slice(consoleErrorStart).some((message) => (
      /unmounted component|state update on an unmounted/i.test(message)
    )),
    false,
  );
  assert.equal(context.calls.list, 1);
  assert.equal(context.counters.list.created, 1);
});

test('deep-link administrativo é formalmente não aplicável ao produto atual', () => {
  const navigationSource = fs.readFileSync(
    path.resolve(__dirname, '../src/http/HttpNavigation.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    navigationSource,
    /<NavigationContainer[\s\S]*?\blinking=/,
  );
  assert.match(navigationSource, /parseAccountActionLink/);
  assert.doesNotMatch(
    navigationSource,
    /AdministrativeUserDetail[\s\S]*?(?:path|prefix|linking)/,
  );
});
