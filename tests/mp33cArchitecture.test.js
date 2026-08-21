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
  const importPattern = /(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g;
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
  return [...files].map((file) => path.relative(root, file).replaceAll('\\', '/'));
}

test('entry HTTP tem grafo estático separado do App mock', () => {
  const packageJson = require('../package.json');
  assert.equal(packageJson.main, 'src/entry/http.tsx');
  const httpGraph = staticGraph(path.join(root, packageJson.main));
  const demoPackage = require('../demo/package.json');
  const demoGraph = staticGraph(path.resolve(root, 'demo', demoPackage.main));
  const httpFiles = relativeFiles(httpGraph);
  const demoFiles = relativeFiles(demoGraph);

  assert.ok(httpFiles.includes('src/http/HttpApp.tsx'));
  assert.equal(httpFiles.includes('App.tsx'), false);
  assert.equal(httpFiles.some((file) => file.startsWith('src/api/')), false);
  assert.equal(httpFiles.some((file) => /mock/i.test(file)), false);
  assert.ok(demoFiles.includes('App.tsx'));
  assert.ok(demoFiles.some((file) => file.startsWith('src/api/')));

  for (const file of httpGraph) {
    if (path.extname(file) === '.json') continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      /AsyncStorage|@react-native-async-storage/.test(source),
      false,
      `${path.relative(root, file)} não pode importar armazenamento persistente comum`,
    );
  }
});

test('configuração resolvida separa IDs, plugins e permissões', () => {
  const packageJson = require('../package.json');
  const demoPackage = require('../demo/package.json');
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
    const demo = require('../demo/app.json').expo;
    assert.equal(config.android.package, 'com.tcheagro.mobile');
    assert.equal(config.ios.bundleIdentifier, 'com.tcheagro.mobile');
    assert.equal(demo.android.package, 'com.tcheagro.mobile.demo');
    assert.notEqual(config.android.package, demo.android.package);
    assert.deepEqual(config.plugins, [[
      'expo-secure-store',
      { configureAndroidBackup: true },
    ]]);
    assert.deepEqual(config.android.permissions, []);
    for (const permission of [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ]) {
      assert.ok(config.android.blockedPermissions.includes(permission));
    }
    assert.deepEqual(config.android.intentFilters, [{
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: [{
        scheme: 'https',
        host: 'conta.tcheagro.example',
        pathPrefix: '/acoes',
      }],
    }]);
    assert.deepEqual(config.ios.associatedDomains, [
      'applinks:conta.tcheagro.example',
    ]);
    assert.ok(demo.plugins.some(([name]) => name === 'expo-location'));
    assert.ok(demo.plugins.some(([name]) => name === 'expo-image-picker'));
    for (const nativePackage of [
      '@react-native-async-storage/async-storage',
      'expo-image-picker',
      'expo-location',
      'react-native-maps',
      'react-native-webview',
    ]) {
      assert.ok(packageJson.expo.autolinking.exclude.includes(nativePackage));
    }
    assert.deepEqual(demoPackage.expo.autolinking.searchPaths, [
      '../node_modules',
    ]);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('build release valida URLs antes de prebuild limpo e Gradle', () => {
  const source = fs.readFileSync(
    path.join(root, 'scripts/buildAndroidRelease.js'),
    'utf8',
  );
  const firstUrlCheck = source.indexOf("requiredHttpsUrl('EXPO_PUBLIC_API_BASE_URL')");
  const prebuild = source.indexOf("'prebuild', '--platform', 'android', '--no-install', '--clean'");
  const signing = source.indexOf('configureAndroidReleaseSigning();');
  const gradle = source.indexOf("':app:packageRelease'");
  assert.ok(firstUrlCheck >= 0 && firstUrlCheck < prebuild);
  assert.ok(prebuild < signing && signing < gradle);
  assert.match(source, /pathname === '\/'/);
});

test('scripts de plataforma sempre selecionam variante HTTP explicitamente', () => {
  const scripts = require('../package.json').scripts;
  assert.match(scripts.android, /runExpoVariant\.js http run:android/);
  assert.match(scripts.ios, /runExpoVariant\.js http run:ios/);
  assert.match(scripts.web, /runExpoVariant\.js http start --web/);
  assert.equal('ios:demo' in scripts, false);
  const runner = fs.readFileSync(
    path.join(root, 'scripts/runExpoVariant.js'),
    'utf8',
  );
  assert.match(runner, /command === 'run:android' \|\| command === 'run:ios'/);
  assert.match(runner, /'prebuild',[\s\S]*'--no-install'/);
});

test('tokens de ação não entram em params e Context atualiza por versão', () => {
  const navigation = fs.readFileSync(
    path.join(root, 'src/http/actionNavigation.ts'),
    'utf8',
  );
  const context = fs.readFileSync(
    path.join(root, 'src/http/AccountActionContext.tsx'),
    'utf8',
  );
  const httpNavigation = fs.readFileSync(
    path.join(root, 'src/http/HttpNavigation.tsx'),
    'utf8',
  );
  assert.doesNotMatch(navigation, /token\s*:/);
  assert.match(context, /\[version, render\]/);
  assert.match(httpNavigation, /setPendingAction/);
  assert.match(
    httpNavigation,
    /liveLinkGeneration\.current === initialGeneration/,
  );
  assert.match(httpNavigation, /liveLinkGeneration\.current \+= 1/);
  const sessionProvider = fs.readFileSync(
    path.join(root, 'src/http/HttpSessionContext.tsx'),
    'utf8',
  );
  assert.match(
    sessionProvider,
    /setStatus\(restored === null \? 'anonymous' : 'locked'\)/,
  );
  assert.match(sessionProvider, /Sair desta conta/);
  assert.match(sessionProvider, /status === 'locked'[\s\S]*lockOverlay/);
  const actionScreens = fs.readFileSync(
    path.join(root, 'src/http/screens/HttpActionScreens.tsx'),
    'utf8',
  );
  assert.match(
    actionScreens,
    /sameActionLink\(action\.peek\(allowed\), submitted\)/,
  );
  assert.match(actionScreens, /source: submitted/);
});
