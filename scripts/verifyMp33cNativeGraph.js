const assert = require('node:assert/strict');
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
  'expo-secure-store',
  'expo-linear-gradient',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-screens',
];

const httpPackages = androidNativePackages(projectRoot);
const demoPackages = androidNativePackages(demoRoot);

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

process.stdout.write(
  'Grafos nativos Android HTTP/Demo verificados por Expo Autolinking.\n',
);
