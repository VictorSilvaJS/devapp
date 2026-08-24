const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];
  return candidates.find((candidate) => {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  }) ?? null;
}

function staticGraph(entry) {
  const pending = [entry];
  const visited = new Set();
  const importPattern =
    /(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g;
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (path.extname(file) === '.json') continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const resolved = resolveLocal(file, match[1]);
      if (resolved !== null) pending.push(resolved);
    }
  }
  return visited;
}

function relativeFiles(files) {
  return [...files].map((file) => {
    return path.relative(root, file).replaceAll('\\', '/');
  });
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('grafo HTTP usa a vertical real e mantém notificações legadas somente no Demo', () => {
  const packageJson = require('../package.json');
  const demoPackage = require('../demo/package.json');
  const httpGraph = staticGraph(path.join(root, packageJson.main));
  const demoGraph = staticGraph(path.resolve(root, 'demo', demoPackage.main));
  const httpFiles = relativeFiles(httpGraph);
  const demoFiles = relativeFiles(demoGraph);

  for (const expected of [
    'src/http/notificationRepository.ts',
    'src/http/HttpNotificationContext.tsx',
    'src/http/idempotencyKey.ts',
    'src/http/notificationContextCoordinator.ts',
    'src/http/notificationOpenGate.ts',
    'src/http/screens/HttpNotificationScreen.tsx',
  ]) {
    assert.ok(httpFiles.includes(expected), `${expected} deve integrar HTTP`);
  }

  for (const forbidden of [
    'src/contexts/NotificacaoContext.tsx',
    'src/screens/NotificacoesScreen.tsx',
  ]) {
    assert.equal(
      httpFiles.includes(forbidden),
      false,
      `${forbidden} pertence somente ao Demo`,
    );
    assert.ok(demoFiles.includes(forbidden), `${forbidden} deve permanecer no Demo`);
  }

  assert.equal(
    httpFiles.some((file) => file.startsWith('src/api/')),
    false,
    'runtime HTTP não pode alcançar implementações mock de src/api',
  );
  assert.ok(
    demoFiles.some((file) => file.startsWith('src/api/')),
    'Demo deve preservar seu grafo local',
  );
});

test('grafo HTTP proíbe AsyncStorage, mock legado e infraestrutura de push', () => {
  const packageJson = require('../package.json');
  const httpGraph = staticGraph(path.join(root, packageJson.main));
  const forbiddenPatterns = [
    /@react-native-async-storage\/async-storage|\bAsyncStorage\b/,
    /\bNOTIFICACOES_INICIAIS\b/,
    /\bNotificacaoContext\b/,
    /\bNotificacoesScreen\b/,
    /\bexpo-notifications\b/,
    /@react-native-firebase\/messaging/,
    /@notifee\/react-native/,
    /\bExpoPushToken\b/,
    /\b(?:device|dispositivo)[_-]?token\b/i,
    /\b(?:fcm|apns)[_-]?token\b/i,
  ];

  for (const file of httpGraph) {
    if (path.extname(file) === '.json') continue;
    const fileSource = fs.readFileSync(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(
        fileSource,
        pattern,
        `${path.relative(root, file)} contém dependência proibida`,
      );
    }
  }

  const httpFiles = relativeFiles(httpGraph);
  assert.equal(
    httpFiles.some((file) => file.includes('expo-crypto')),
    false,
    'chave idempotente HTTP não deve depender do módulo nativo do Demo',
  );
});

test('configuração HTTP não adiciona SDK, plugin ou permissão de notificação do sistema', () => {
  const previous = {
    APP_VARIANT: process.env.APP_VARIANT,
    EXPO_PUBLIC_AUTH_ACTION_BASE_URL:
      process.env.EXPO_PUBLIC_AUTH_ACTION_BASE_URL,
  };
  process.env.APP_VARIANT = 'http';
  process.env.EXPO_PUBLIC_AUTH_ACTION_BASE_URL =
    'https://conta.tcheagro.example/acoes';

  try {
    const config = require('../app.config.js')();
    const pluginNames = config.plugins.map((plugin) => {
      return Array.isArray(plugin) ? plugin[0] : plugin;
    });
    assert.equal(pluginNames.includes('expo-notifications'), false);
    assert.equal(
      config.android.permissions.includes('android.permission.POST_NOTIFICATIONS'),
      false,
    );
    assert.equal(
      config.android.permissions.includes('com.google.android.c2dm.permission.RECEIVE'),
      false,
    );
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('destino só abre Conta depois de resolução e revalidação no servidor', () => {
  const screen = source('src/http/screens/HttpNotificationScreen.tsx');
  const resolveIndex = screen.indexOf(
    'await notifications.resolveDestination(item.id)',
  );
  const typeGuardIndex = screen.indexOf(
    "destination.recurso_tipo !== 'conta'",
  );
  const recipientGuardIndex = screen.indexOf(
    'destination.recurso_id !== expectedSnapshot.usuario.id',
  );
  const revalidateIndex = screen.indexOf('await runtime.session.revalidate()');
  const navigateIndex = screen.indexOf("navigation.navigate('Account')");

  assert.ok(resolveIndex >= 0);
  assert.ok(typeGuardIndex > resolveIndex);
  assert.ok(recipientGuardIndex > typeGuardIndex);
  assert.ok(revalidateIndex > recipientGuardIndex);
  assert.ok(navigateIndex > revalidateIndex);
  assert.match(screen, /runtime\.session\.epoch !== sessionEpoch/);
  assert.match(screen, /sameIdentity\(runtime\.session\.snapshot\)/);
  assert.match(screen, /sameIdentity\(revalidated\)/);
  assert.match(screen, /openGate\.tryAcquire\(\)/);
  assert.match(screen, /lease\.isActive\(\)/);
  assert.match(screen, /lease\.release\(\)/);
  assert.doesNotMatch(screen, /navigation\.navigate\(\s*destination/);
  assert.doesNotMatch(screen, /destination\.(?:route|rota|url|screen|params)/i);
});

test('lock de abertura permanece dono durante resolução e revalidação', async () => {
  const { NotificationOpenGate } = require(
    '../.tmp-mp34/src/http/notificationOpenGate.js'
  );
  const gate = new NotificationOpenGate();
  const first = gate.tryAcquire();

  assert.notEqual(first, null);
  assert.equal(first.isActive(), true);
  assert.equal(gate.busy, true);
  assert.equal(gate.tryAcquire(), null, 'segundo toque deve ser ignorado');

  let releaseResolution;
  const resolution = new Promise((resolve) => {
    releaseResolution = resolve;
  });
  let releaseRevalidation;
  const revalidation = new Promise((resolve) => {
    releaseRevalidation = resolve;
  });
  const flow = (async () => {
    await resolution;
    assert.equal(first.isActive(), true);
    assert.equal(gate.tryAcquire(), null, 'lock cobre a revalidação');
    await revalidation;
    assert.equal(first.isActive(), true);
    assert.equal(first.release(), true);
  })();

  releaseResolution();
  await Promise.resolve();
  assert.equal(gate.busy, true);
  releaseRevalidation();
  await flow;
  assert.equal(gate.busy, false);
  assert.notEqual(gate.tryAcquire(), null, 'novo toque é aceito após o fluxo');
});

test('invalidação torna lease tardio inerte', () => {
  const { NotificationOpenGate } = require(
    '../.tmp-mp34/src/http/notificationOpenGate.js'
  );
  const gate = new NotificationOpenGate();
  const stale = gate.tryAcquire();
  assert.notEqual(stale, null);

  gate.invalidate();

  assert.equal(stale.isActive(), false);
  assert.equal(stale.release(), false);
  assert.equal(gate.busy, false);
  assert.notEqual(gate.tryAcquire(), null);
});

test('estado é particionado pela identidade e ignora resposta tardia', () => {
  const context = source('src/http/HttpNotificationContext.tsx');
  const navigation = source('src/http/HttpNavigation.tsx');
  const session = source('src/http/sessionCoordinator.ts');

  for (const marker of [
    'snapshot.usuario.organizacao_id',
    'snapshot.usuario.id',
    'snapshot.usuario.versao_autorizacao',
    'snapshot.escopo.versao',
    'sessionEpoch',
  ]) {
    assert.match(context, new RegExp(marker.replaceAll('.', '\\.')));
  }
  assert.match(context, /partitionRef\.current === expected/);
  assert.match(context, /coordinator\.isCurrent\(request\)/);
  assert.match(context, /coordinator\.finishLoadMore\(request\)/);
  assert.match(context, /invalidateReads\(identityChanged \? 'partition' : 'filter'\)/);
  assert.match(context, /setItems\(\[\]\)/);
  assert.match(context, /setUnreadCount\(0\)/);
  assert.match(context, /setNextCursor\(null\)/);
  assert.match(navigation, /sessionEpoch/);
  assert.match(session, /get epoch\(\): number/);
  assert.match(session, /#advanceEpoch\(\)/);
});

test('retry explícito conserva a chave incerta e sucesso encerra a intenção', () => {
  const context = source('src/http/HttpNotificationContext.tsx');
  const retainedOnUncertainFailure = [
    /error instanceof ApiTransportError/,
    /error instanceof InvalidBackendResponseError/,
    /error\.status === 429 \|\| error\.status >= 500/,
    /shouldRetainCommandKey\(caught\) \? 'ambiguous' : 'definitive'/,
  ];
  for (const pattern of retainedOnUncertainFailure) {
    assert.match(context, pattern);
  }

  assert.ok(
    [...context.matchAll(/settleCommandKey\(/g)].length >= 6,
    'leitura, lote e descarte encerram ou descartam a chave de modo explícito',
  );
});

test('filtro não apaga comandos e mutação invalida consultas anteriores', () => {
  const context = source('src/http/HttpNotificationContext.tsx');
  const filterStart = context.indexOf('const setStateFilter =');
  const filterEnd = context.indexOf('const refresh =', filterStart);
  const filterSource = context.slice(filterStart, filterEnd);

  assert.ok(filterStart >= 0 && filterEnd > filterStart);
  assert.doesNotMatch(filterSource, /invalidateReads\('partition'\)/);
  assert.doesNotMatch(filterSource, /inFlightCommands\.current\.clear/);
  assert.match(filterSource, /invalidateReads\('filter'\)/);

  for (const command of ['markRead', 'markAllRead', 'discard']) {
    const start = context.indexOf(`const ${command} =`);
    const next = context.indexOf('\n  const ', start + 10);
    const commandSource = context.slice(start, next < 0 ? undefined : next);
    assert.match(commandSource, /invalidateReads\('mutation'\)/);
    assert.match(commandSource, /reloadConfirmed\(/);
  }

  assert.match(context, /mutationInFlight\.current/);
  assert.match(context, /destinationInFlight\.current/);
  assert.match(context, /stateFilterRef\.current === 'nao_lida'/);
  assert.match(context, /result\.id !== id/);
});

test('filtro durante comando preserva a chave de retry ambíguo', async () => {
  const { NotificationContextCoordinator } = require(
    '../.tmp-mp34/src/http/notificationContextCoordinator.js'
  );
  const coordinator = new NotificationContextCoordinator();
  const network = deferred();
  const intent = 'read:notification-a';
  const firstKey = coordinator.commandKey(intent, () => 'stable-key');

  const pending = (async () => {
    try {
      await network.promise;
      coordinator.settleCommandKey(intent, firstKey, 'confirmed');
    } catch {
      coordinator.settleCommandKey(intent, firstKey, 'ambiguous');
    }
  })();

  coordinator.invalidate('filter');
  network.reject(new Error('falha de transporte ambígua'));
  await pending;

  assert.equal(
    coordinator.commandKey(intent, () => 'new-key-must-not-be-used'),
    firstKey,
  );
});

test('lista tardia iniciada antes da mutação não pode ser aceita', async () => {
  const { NotificationContextCoordinator } = require(
    '../.tmp-mp34/src/http/notificationContextCoordinator.js'
  );
  const coordinator = new NotificationContextCoordinator();
  const oldResponse = deferred();
  const staleRequest = coordinator.beginList();
  const staleResult = oldResponse.promise.then(() => {
    return coordinator.isCurrent(staleRequest);
  });

  coordinator.invalidate('mutation');
  const confirmedRequest = coordinator.beginList();
  oldResponse.resolve();

  assert.equal(await staleResult, false);
  assert.equal(coordinator.isCurrent(confirmedRequest), true);
});

test('loadMore antigo não publica nem libera o flight novo', async () => {
  const { NotificationContextCoordinator } = require(
    '../.tmp-mp34/src/http/notificationContextCoordinator.js'
  );
  const coordinator = new NotificationContextCoordinator();
  const oldResponse = deferred();
  coordinator.beginList();
  const staleRequest = coordinator.beginLoadMore();
  assert.notEqual(staleRequest, null);
  const staleResult = oldResponse.promise.then(() => ({
    accepted: coordinator.isCurrent(staleRequest),
    finished: coordinator.finishLoadMore(staleRequest),
  }));

  coordinator.invalidate('filter');
  coordinator.beginList();
  const currentRequest = coordinator.beginLoadMore();
  assert.notEqual(currentRequest, null);
  oldResponse.resolve();

  assert.deepEqual(await staleResult, { accepted: false, finished: false });
  assert.equal(coordinator.loadMoreBusy, true);
  assert.equal(coordinator.isCurrent(currentRequest), true);
  assert.equal(coordinator.finishLoadMore(currentRequest), true);
  assert.equal(coordinator.loadMoreBusy, false);
});

test('tsconfig focado compila em strict apenas contratos HTTP necessários', () => {
  const config = JSON.parse(source('tsconfig.mp34-tests.json'));
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.outDir, '.tmp-mp34');
  for (const required of [
    'src/http/contracts.ts',
    'src/http/decoders.ts',
    'src/http/httpTransport.ts',
    'src/http/backendApi.ts',
    'src/http/sessionCoordinator.ts',
    'src/http/notificationRepository.ts',
    'src/http/idempotencyKey.ts',
    'src/http/notificationContextCoordinator.ts',
    'src/http/notificationOpenGate.ts',
    'src/http/runtime.ts',
    'src/http/HttpNotificationContext.tsx',
    'src/http/screens/HttpNotificationScreen.tsx',
  ]) {
    assert.ok(config.include.includes(required), `${required} deve ser compilado`);
  }
  assert.equal(
    config.include.some((file) => file.startsWith('src/api/')),
    false,
  );
});
