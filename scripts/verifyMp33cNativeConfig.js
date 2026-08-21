const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { removeTemporaryChild } = require('./mp33cTemporarySafety');

const projectRoot = path.resolve(__dirname, '..');
const temporaryProject = removeTemporaryChild(projectRoot, 'native-http');
fs.mkdirSync(path.join(temporaryProject, 'src', 'assets', 'images'), {
  recursive: true,
});
for (const file of ['app.config.js', 'app.json', 'package.json']) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(temporaryProject, file));
}
fs.copyFileSync(
  path.join(projectRoot, 'src', 'assets', 'images', 'app-icon.png'),
  path.join(temporaryProject, 'src', 'assets', 'images', 'app-icon.png'),
);

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const result = spawnSync(
  process.execPath,
  [
    expoCli,
    'prebuild',
    '--platform',
    'android',
    '--no-install',
    '--clean',
  ],
  {
    cwd: temporaryProject,
    env: {
      ...process.env,
      CI: '1',
      NODE_ENV: 'production',
      APP_VARIANT: 'http',
      EXPO_PUBLIC_APP_VARIANT: 'http',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.tcheagro.example',
      EXPO_PUBLIC_AUTH_ACTION_BASE_URL:
        'https://conta.tcheagro.example/acoes',
    },
    shell: false,
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Prebuild HTTP temporário falhou com status ${result.status}.`);
}

const androidRoot = path.join(temporaryProject, 'android');
const manifest = fs.readFileSync(
  path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'),
  'utf8',
);
const permissionTags = [...manifest.matchAll(
  /<uses-permission[^>]+android:name="([^"]+)"[^>]*\/>/g,
)];
const effectivePermissions = permissionTags
  .filter((match) => !match[0].includes('tools:node="remove"'))
  .map((match) => match[1])
  .sort();
if (JSON.stringify(effectivePermissions) !== JSON.stringify([
  'android.permission.INTERNET',
])) {
  throw new Error(
    `Permissões efetivas inesperadas no HTTP: ${effectivePermissions.join(', ')}`,
  );
}
for (const forbiddenPermission of [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]) {
  const tag = permissionTags.find((match) => match[1] === forbiddenPermission);
  if (tag === undefined || !tag[0].includes('tools:node="remove"')) {
    throw new Error(`Permissão não bloqueada: ${forbiddenPermission}`);
  }
}
for (const requiredFragment of [
  'android:autoVerify="true"',
  'android:scheme="https"',
  'android:host="conta.tcheagro.example"',
  'android:pathPrefix="/acoes"',
  'android:dataExtractionRules="@xml/secure_store_data_extraction_rules"',
  'android:fullBackupContent="@xml/secure_store_backup_rules"',
]) {
  if (!manifest.includes(requiredFragment)) {
    throw new Error(`Manifest HTTP não contém ${requiredFragment}.`);
  }
}

const buildGradle = fs.readFileSync(
  path.join(androidRoot, 'app', 'build.gradle'),
  'utf8',
);
for (const requiredFragment of [
  'namespace \'com.tcheagro.mobile\'',
  'applicationId \'com.tcheagro.mobile\'',
]) {
  if (!buildGradle.includes(requiredFragment)) {
    throw new Error(`Gradle HTTP não contém ${requiredFragment}.`);
  }
}

const backupRules = fs.readFileSync(
  path.join(
    projectRoot,
    'node_modules',
    'expo-secure-store',
    'android',
    'src',
    'main',
    'res',
    'xml',
    'secure_store_backup_rules.xml',
  ),
  'utf8',
);
const extractionRules = fs.readFileSync(
  path.join(
    projectRoot,
    'node_modules',
    'expo-secure-store',
    'android',
    'src',
    'main',
    'res',
    'xml',
    'secure_store_data_extraction_rules.xml',
  ),
  'utf8',
);
if (
  !backupRules.includes('SecureStore') ||
  !extractionRules.includes('SecureStore')
) {
  throw new Error('Regras de backup não excluem o armazenamento seguro.');
}

process.stdout.write(
  'Prebuild HTTP temporário validado: ID, App Link, backup e INTERNET-only.\n',
);
