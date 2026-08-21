const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { configureAndroidReleaseSigning } = require('./configureAndroidReleaseSigning');
const { configureAndroidGradleMemory } = require('./configureAndroidGradleMemory');

const projectRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(projectRoot, 'android');
const gradleWrapper = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

function requiredHttpsUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} é obrigatória para o build HTTP de release.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} é inválida.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} deve ser uma URL HTTPS sem credenciais, query ou fragmento.`);
  }
  return parsed;
}

requiredHttpsUrl('EXPO_PUBLIC_API_BASE_URL');
const actionBaseUrl = requiredHttpsUrl('EXPO_PUBLIC_AUTH_ACTION_BASE_URL');
if (actionBaseUrl.pathname === '/') {
  throw new Error('EXPO_PUBLIC_AUTH_ACTION_BASE_URL deve usar um caminho dedicado.');
}

const releaseEnvironment = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  APP_VARIANT: 'http',
  EXPO_PUBLIC_APP_VARIANT: 'http',
};

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const prebuild = spawnSync(
  process.execPath,
  [expoCli, 'prebuild', '--platform', 'android', '--no-install', '--clean'],
  {
    cwd: projectRoot,
    env: releaseEnvironment,
    shell: false,
    stdio: 'inherit',
  }
);

if (prebuild.error) throw prebuild.error;
if (prebuild.status !== 0) {
  process.exitCode = prebuild.status ?? 1;
  return;
}

configureAndroidReleaseSigning();
configureAndroidGradleMemory();

const result = spawnSync(
  gradleWrapper,
  [
    ':app:packageRelease',
    '--console=plain',
    '--no-parallel',
    '--max-workers=2',
  ],
  {
    cwd: androidRoot,
    env: releaseEnvironment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
