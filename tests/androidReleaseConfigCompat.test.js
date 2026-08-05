const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const read = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, '..', relativePath),
  'utf8'
);

const packageConfig = JSON.parse(read('package.json'));
const buildScriptSource = read('scripts/buildAndroidRelease.js');
const signingPatchSource = read('scripts/configureAndroidReleaseSigning.js');
const memoryPatchSource = read('scripts/configureAndroidGradleMemory.js');

test('o comando oficial de release define NODE_ENV sem sobrescrever valor explícito', () => {
  assert.equal(packageConfig.scripts['build:android:release'], 'node scripts/buildAndroidRelease.js');
  assert.match(buildScriptSource, /NODE_ENV: process\.env\.NODE_ENV \|\| 'production'/);
  assert.match(buildScriptSource, /':app:packageRelease'/);
  assert.match(buildScriptSource, /'--no-parallel'/);
  assert.match(buildScriptSource, /'--max-workers=2'/);
  assert.match(buildScriptSource, /configureAndroidReleaseSigning\(\)/);
  assert.match(buildScriptSource, /configureAndroidGradleMemory\(\)/);
  assert.match(memoryPatchSource, /org\.gradle\.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m/);
});

test('a assinatura produtiva vem apenas de propriedades ou ambiente', () => {
  assert.match(signingPatchSource, /TCHE_RELEASE_STORE_FILE/);
  assert.match(signingPatchSource, /TCHE_RELEASE_STORE_PASSWORD/);
  assert.match(signingPatchSource, /TCHE_RELEASE_KEY_ALIAS/);
  assert.match(signingPatchSource, /TCHE_RELEASE_KEY_PASSWORD/);
  assert.match(signingPatchSource, /hasAnyProductionSigning && !hasProductionSigning/);
  assert.match(signingPatchSource, /Assinatura de produção incompleta/);
  assert.match(signingPatchSource, /hasProductionSigning/);
});

test('a chave debug permanece somente como fallback demonstrativo explícito', () => {
  assert.match(signingPatchSource, /APK demonstrativo assinado com a chave debug/);
  assert.match(signingPatchSource, /TCHE_RELEASE_SIGNING_SELECTION/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de androidReleaseConfigCompat passaram.');
}
