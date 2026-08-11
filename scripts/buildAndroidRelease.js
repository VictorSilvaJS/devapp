const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { configureAndroidReleaseSigning } = require('./configureAndroidReleaseSigning');
const { configureAndroidGradleMemory } = require('./configureAndroidGradleMemory');

const projectRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(projectRoot, 'android');
const gradleWrapper = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

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
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
