import assert from 'node:assert/strict';

const [{ buildApp }, { startBackend }] = await Promise.all([
  import('../dist/app.js'),
  import('../dist/server.js'),
]);

assert.equal(typeof buildApp, 'function');
assert.equal(typeof startBackend, 'function');

process.stdout.write('Artefato JavaScript ESM carregado com sucesso.\n');
