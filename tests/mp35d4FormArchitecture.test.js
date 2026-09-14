const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('formulário compartilhado puro integra as duas composições sem apresentação cadastral duplicada', () => {
  for (const file of ['src/components/PropertyForm.tsx', 'src/components/SelectField.tsx']) {
    assert.doesNotMatch(read(file), /from ['"][^'"]*(?:\/api|\/http|mock|AsyncStorage|BackendApi)/);
  }
  for (const file of ['src/screens/NovaPropriedadeScreen.tsx', 'src/screens/EditarPropriedadeScreen.tsx', 'src/http/screens/HttpAdministrativePropertyFormScreens.tsx']) {
    const source = read(file);
    assert.match(source, /<PropertyFormLayout/); assert.match(source, /<PropertyCadastralFields/);
    assert.doesNotMatch(source, /label="Nome da Propriedade"/);
  }
  for (const file of ['src/screens/NovaPropriedadeScreen.tsx', 'src/screens/EditarPropriedadeScreen.tsx']) {
    assert.doesNotMatch(read(file), /from ['"][^'"]*\/http/);
    assert.match(read(file), /Produtor\.(?:create|updateWithLinks)/);
  }
});

test('container compõe modelos/controllers/services existentes, sem fetch/storage/idempotência paralela', () => {
  const screen = read('src/http/screens/HttpAdministrativePropertyFormScreens.tsx');
  const controller = read('src/http/administrativePropertyFormController.ts');
  for (const source of [screen, controller]) assert.doesNotMatch(source, /\bfetch\s*\(|AsyncStorage|createAdministrativeIntentId|idempotencyKey|area_total_decimal.*(?:Number|parseFloat)/);
  assert.doesNotMatch(screen, /BackendApi|backendApi|\.api\./);
  for (const call of ['createHolder', 'createLocalities', 'prepareSelection', 'buildCreateAdministrativePropertyPayload',
    'buildPatchAdministrativePropertyPayload', 'rebaseAdministrativePropertyEditModel', 'retryReconciliation', 'onCompleted']) assert.ok(controller.includes(call));
  assert.doesNotMatch(controller, /changeStatus|titular_id\s*:|usuario_id\s*:/);
});

test('somente criação oferece status inicial e seleção de Titular; edição não expõe transferência/status', () => {
  const source = read('src/http/screens/HttpAdministrativePropertyFormScreens.tsx');
  assert.match(source, /model \? <SectionCard title="Titular"[\s\S]*?onChange=\{\(\) => \{\}\} disabled/);
  assert.match(source, /state\?\.inputs \? <SectionCard title="Status inicial"/);
  assert.doesNotMatch(source, /Trocar Titular|Transferir|changeStatus|PropertyStatusScreen/);
  const navigation = read('src/http/HttpNavigation.tsx');
  assert.match(navigation, /propertyAccess\.allowed \? <Stack.Group navigationKey=/);
  assert.doesNotMatch(navigation, /name="AdministrativeProperty(?:Status|Links|Transfer)"/);
});

test('layout preserva rolagem, foco e teclado ATUAL-13; seletores têm rótulos e feedback textual', () => {
  const form = read('src/components/PropertyForm.tsx');
  for (const pattern of [/ref=\{focus.scrollViewRef\}/, /keyboardShouldPersistTaps="handled"/, /keyboardDismissMode="on-drag"/,
    /automaticallyAdjustKeyboardInsets/, /focus.registerFocusable/, /accessibilityLabel="Nome da Propriedade"/]) assert.match(form, pattern);
  const select = read('src/components/SelectField.tsx');
  assert.match(select, /accessibilityLabel=\{`Buscar \$\{label\}`\}/);
  assert.match(select, /Nenhuma opção encontrada/); assert.match(select, /Tentar novamente/);
});
