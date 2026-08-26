import assert from 'node:assert/strict';

const [
  { buildApp },
  { startBackend },
  { startOutboxWorker },
  { parseBootstrapAdminCommand },
  { parseBreakGlassStartCommand },
  { validateAdministrativeIdempotencyReceipt },
  { invitationAcceptanceModeFromPersisted },
] = await Promise.all([
  import('../dist/app.js'),
  import('../dist/server.js'),
  import('../dist/outbox/server.js'),
  import('../dist/cli/bootstrap-admin.js'),
  import('../dist/cli/break-glass-admin.js'),
  import('../dist/administration/validation.js'),
  import('../dist/account-actions/contracts.js'),
]);

assert.equal(typeof buildApp, 'function');
assert.equal(typeof startBackend, 'function');
assert.equal(typeof startOutboxWorker, 'function');
assert.equal(typeof parseBootstrapAdminCommand, 'function');
assert.equal(typeof parseBreakGlassStartCommand, 'function');
assert.equal(typeof validateAdministrativeIdempotencyReceipt, 'function');
assert.equal(typeof invitationAcceptanceModeFromPersisted, 'function');

process.stdout.write('Artefato JavaScript ESM carregado com sucesso.\n');
