const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const [variant, command = 'start', ...args] = process.argv.slice(2);

if (variant !== 'http' && variant !== 'demo') {
  throw new Error('Use a variante http ou demo.');
}

const expoCli = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const workingDirectory = variant === 'demo'
  ? path.join(projectRoot, 'demo')
  : projectRoot;
const environment = {
  ...process.env,
  APP_VARIANT: variant,
  EXPO_PUBLIC_APP_VARIANT: variant,
};

function runExpo(commandArguments) {
  const result = spawnSync(process.execPath, [expoCli, ...commandArguments], {
    cwd: workingDirectory,
    env: environment,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (
  variant === 'http' &&
  (command === 'run:android' || command === 'run:ios')
) {
  const platform = command === 'run:android' ? 'android' : 'ios';
  const prebuildStatus = runExpo([
    'prebuild',
    '--platform',
    platform,
    '--no-install',
  ]);
  if (prebuildStatus !== 0) {
    process.exitCode = prebuildStatus;
    return;
  }
}

process.exitCode = runExpo([command, ...args]);
