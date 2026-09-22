const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const demoRoot = path.join(projectRoot, 'demo');
const autolinkingCli = path.join(
  projectRoot,
  'node_modules',
  'expo-modules-autolinking',
  'bin',
  'expo-modules-autolinking',
);

function autolinkingJson(root, command, platform) {
  const result = spawnSync(
    process.execPath,
    [
      autolinkingCli,
      command,
      '--project-root',
      root,
      '--platform',
      platform,
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      shell: false,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Expo Autolinking ${command}/${platform} falhou: ${result.stderr}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Expo Autolinking ${command}/${platform} não retornou JSON válido.`,
    );
  }
}

function androidNativePackages(root) {
  const expo = autolinkingJson(root, 'resolve', 'android');
  const reactNative = autolinkingJson(
    root,
    'react-native-config',
    'android',
  );
  // The Expo entrypoint imports these modules from Expo's own dependency tree.
  // A flat searchPaths scan can find Expo while missing its nested dependencies.
  const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [root] }));
  for (const [packageName, classifier] of [
    ['expo-asset', 'expo.modules.asset.AssetModule'],
    ['expo-constants', 'expo.modules.constants.ConstantsModule'],
  ]) {
    const manifest = require.resolve(`${packageName}/package.json`, { paths: [expoRoot] });
    const expectedRoot = fs.realpathSync(path.dirname(manifest));
    const linked = expo.modules.find(module => module.packageName === packageName);
    assert.ok(linked, `${packageName} ausente do autolinking de ${root}`);
    assert.equal(linked.packageVersion, JSON.parse(fs.readFileSync(manifest, 'utf8')).version);
    assert.ok(linked.projects.some(project =>
      fs.realpathSync(path.dirname(project.sourceDir)) === expectedRoot &&
      project.modules.some(module => module.classifier === classifier)),
    `${packageName}: autolinking deve registrar o módulo resolvido pelo JavaScript de ${root}`);
  }
  return new Set([
    ...expo.modules.map((module) => module.packageName),
    ...Object.keys(reactNative.dependencies ?? {}),
  ]);
}

const forbiddenInHttp = [
  '@react-native-async-storage/async-storage',
  'expo-crypto',
  'expo-document-picker',
  'expo-image-picker',
  'expo-intent-launcher',
  'expo-location',
  'react-native-maps',
  'react-native-svg',
  'react-native-webview',
];
const requiredInHttp = [
  'expo-asset',
  'expo-constants',
  'expo-modules-core',
  'expo-secure-store',
  'expo-linear-gradient',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-screens',
];

const httpPackages = androidNativePackages(projectRoot);
const demoPackages = androidNativePackages(demoRoot);

// Demo consumes the physical installation and lockfile of its parent project.
// Keep prebuild from filling an empty manifest with template defaults.
const workspaceManifest = require('../package.json');
const demoManifest = require('../demo/package.json');
const lock = require('../package-lock.json');
for (const packageName of ['expo', 'react', 'react-native']) {
  assert.equal(demoManifest.dependencies?.[packageName], workspaceManifest.dependencies[packageName],
    `${packageName}: Demo e raiz devem declarar a mesma versão`);
  const resolved = require.resolve(`${packageName}/package.json`, { paths: [demoRoot] });
  assert.equal(fs.realpathSync(resolved), fs.realpathSync(require.resolve(`${packageName}/package.json`, { paths: [projectRoot] })),
    `${packageName}: Demo deve consumir a instalação da raiz`);
  assert.equal(JSON.parse(fs.readFileSync(resolved, 'utf8')).version, lock.packages[`node_modules/${packageName}`].version,
    `${packageName}: instalação deve corresponder ao lockfile da raiz`);
}

for (const packageName of forbiddenInHttp) {
  assert.equal(
    httpPackages.has(packageName),
    false,
    `${packageName} não pode ser autolinkado no aplicativo HTTP`,
  );
  assert.equal(
    demoPackages.has(packageName),
    true,
    `${packageName} deve continuar disponível no Demo`,
  );
}
for (const packageName of requiredInHttp) {
  assert.equal(
    httpPackages.has(packageName),
    true,
    `${packageName} é obrigatório no aplicativo HTTP`,
  );
}

for (const packageName of ['expo-asset', 'expo-constants', 'expo-modules-core']) {
  assert.equal(
    demoPackages.has(packageName),
    true,
    `${packageName} é obrigatório na inicialização do Demo`,
  );
}

process.stdout.write(
  'Grafos nativos Android HTTP/Demo verificados por Expo Autolinking.\n',
);
