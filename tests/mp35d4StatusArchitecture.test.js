const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const screen = () => read('src/http/screens/HttpPropertyStatusAction.tsx');
const controller = () => read('src/http/administrativePropertyStatusController.ts');

test('status arquitetural: apresentação cadastral e controller de edição sem comando de status', () => {
  for (const p of ['src/components/PropertyForm.tsx', 'src/http/screens/HttpAdministrativePropertyFormScreens.tsx',
    'src/http/administrativePropertyFormController.ts']) assert.doesNotMatch(read(p), /changeStatus|StatusController|motivo_detalhe|Confirmar inativação/);
});
test('status arquitetural: UI/controller sem transporte, mock, storage ou idempotência próprios', () => {
  for (const source of [screen(), controller()]) assert.doesNotMatch(source,
    /\bfetch\s*\(|AsyncStorage|mock|fallbackToMock|createAdministrativeIntentId|idempotencyKey|new AdministrativeCommandCoordinator|\.api\.|\/v1\/|from ['"][^'"]*\/api\//);
});
test('status arquitetural: modelo puro e comando existentes, sem payload cadastral', () => {
  assert.match(controller(), /buildChangeAdministrativePropertyStatusPayload/);
  assert.match(controller(), /administrativePropertyCommands\.changeStatus/);
  assert.match(controller(), /motivo_detalhe/);
  assert.doesNotMatch(controller(), /titular_id|municipio_id|area_total|cultura_principal|buildPatchAdministrativePropertyPayload/);
  assert.doesNotMatch(screen(), /\.changeStatus\(|buildChangeAdministrativePropertyStatusPayload/);
  assert.match(screen(), /PROPERTY_REASON_CODES\.map/);
});
test('status arquitetural: recovery chama apenas retryReconciliation, sem mutação ou nova intenção', () => {
  const retry = controller().split('  retryReconciliation()')[1].split('  reload()')[0];
  assert.match(retry, /#flow\?\.retryReconciliation\(\)/);
  assert.doesNotMatch(retry, /changeStatus|submit\(|new |#draft/);
  assert.match(screen(), /title="Tentar atualizar"[\s\S]*?controller!\.retryReconciliation\(\)/);
});
test('status arquitetural: modal Admin no detalhe sem rota pública nem navegação de conclusão', () => {
  assert.match(read('src/http/screens/HttpPropertyScreens.tsx'), /administrative \? <HttpPropertyStatusAction/);
  assert.match(screen(), /canAdministerProperties\(runtime\)/);
  assert.match(screen(), /isCanonicalUuidV4\(property.id\)/);
  assert.match(screen(), /<Modal/);
  assert.doesNotMatch(screen(), /navigation\.(?:navigate|replace|reset|goBack)/);
  assert.doesNotMatch(read('src/http/HttpNavigation.tsx'), /name="AdministrativePropertyStatus"/);
});
test('status arquitetural: instância, rota, lifecycle e descarte terminal de estado', () => {
  assert.match(screen(), /instance.current === next && next.current/);
  assert.match(screen(), /state.routes\[state.index\]\?\.key === route.key/);
  assert.match(controller(), /isAuthorizationCurrent\(this.#lease\)/);
  assert.match(controller(), /this.#completed = true/);
  assert.match(controller(), /this.#property = null; this.#reason = ''; this.#detail = ''/);
});
