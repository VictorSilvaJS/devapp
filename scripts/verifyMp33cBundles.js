const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { removeTemporaryChild } = require('./mp33cTemporarySafety');

const projectRoot = path.resolve(__dirname, '..');
const temporaryRoot = removeTemporaryChild(projectRoot, 'bundles');
const httpOutput = path.join(temporaryRoot, 'http');
const demoOutput = path.join(temporaryRoot, 'demo');

fs.mkdirSync(temporaryRoot, { recursive: true });

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });

function exportVariant(variant, cwd, outputDirectory, extraEnvironment = {}) {
  const result = spawnSync(
    process.execPath,
    [
      expoCli,
      'export',
      '--platform',
      'android',
      '--output-dir',
      outputDirectory,
      '--no-bytecode',
      '--no-minify',
      '--max-workers',
      '1',
      '--clear',
    ],
    {
      cwd,
      env: {
        ...process.env,
        CI: '1',
        APP_VARIANT: variant,
        EXPO_PUBLIC_APP_VARIANT: variant,
        ...extraEnvironment,
      },
      shell: false,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Expo export ${variant} falhou com status ${result.status}.`);
  }
}

function javascriptText(directory) {
  const pending = [directory];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(resolved);
      else if (/\.(?:js|map)$/.test(entry.name)) files.push(resolved);
    }
  }
  if (files.length === 0) throw new Error(`Nenhum bundle JavaScript em ${directory}.`);
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

exportVariant('http', projectRoot, httpOutput, {
  EXPO_PUBLIC_API_BASE_URL: 'https://api.tcheagro.example',
  EXPO_PUBLIC_AUTH_ACTION_BASE_URL: 'https://conta.tcheagro.example/acoes',
});
exportVariant('demo', path.join(projectRoot, 'demo'), demoOutput);

const httpBundle = javascriptText(httpOutput);
const demoBundle = javascriptText(demoOutput);
const forbiddenProductionMarkers = [
  '@react-native-async-storage/async-storage',
  'admin.demonstracao@example.com',
  'qaAtivo123',
  'demo_clientes_26_1_mt_2026_08',
  'mockV2DemoSeed',
];
for (const marker of forbiddenProductionMarkers) {
  if (httpBundle.includes(marker)) {
    throw new Error(`Bundle HTTP contém marcador proibido do mock: ${marker}`);
  }
}
if (!httpBundle.includes('tche_agro.http.refresh_token.v1')) {
  throw new Error('Bundle HTTP não contém a composição SecureStore esperada.');
}
if (!demoBundle.includes('admin.demonstracao@example.com')) {
  throw new Error('Bundle Demo não contém a composição mock preservada.');
}

process.stdout.write(
  'Bundles HTTP e Demo exportados; grafo HTTP sem marcadores mock/AsyncStorage.\n',
);
