const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const datePicker = read('src/components/DatePicker.tsx');
assert.match(datePicker, /minimumDay/);
assert.match(datePicker, /maximumDay/);
assert.match(datePicker, /setShowYears\(true\)/);
assert.match(datePicker, /currentYear - 80/);
assert.match(datePicker, /date\.getHours\(\) \* TIME_ROW_HEIGHT/);
assert.match(datePicker, /Array\.from\(\{ length: 60 \}/);

const validationHook = read('src/hooks/useFormValidationFocus.ts');
assert.match(validationHook, /currentlyFocusedInput/);
assert.match(validationHook, /scrollResponderScrollNativeHandleToKeyboard/);
assert.match(validationHook, /keyboardDidShow/);

[
  'NovaVisitaScreen.tsx', 'EditarVisitaScreen.tsx', 'ConcluirVisitaScreen.tsx',
  'CorrigirVisitaScreen.tsx', 'NovoCadernoScreen.tsx', 'EditarCadernoScreen.tsx',
  'NovaPropriedadeScreen.tsx', 'EditarPropriedadeScreen.tsx', 'NovoUsuarioScreen.tsx',
  'PeriodoProdutivoFormScreen.tsx', 'CorrigirCadernoScreen.tsx', 'EditProfileScreen.tsx',
].forEach((screen) => {
  const source = read(`src/screens/${screen}`);
  assert.match(source, /keyboardShouldPersistTaps="handled"/, `${screen} deve preservar toques com teclado aberto`);
  assert.match(source, /keyboardDismissMode="on-drag"/, `${screen} deve permitir dispensar o teclado ao rolar`);
  assert.match(source, /automaticallyAdjustKeyboardInsets/, `${screen} deve ajustar o espaço útil ao teclado`);
});

const cadernoDetail = read('src/screens/CadernoDetailScreen.tsx');
assert.match(cadernoDetail, /Rascunho privado/);
assert.match(cadernoDetail, /Continuar rascunho/);
assert.match(cadernoDetail, /Descartar rascunho\?/);
assert.match(cadernoDetail, /CadernoCampo\.delete/);

const cadernoActions = read('src/components/CadernoAuditActions.tsx');
assert.match(cadernoActions, /navigation\.navigate\('CorrigirCaderno'/);
assert.doesNotMatch(cadernoActions, /Campo a corrigir/);
assert.match(read('src/navigation/index.tsx'), /<Stack\.Screen name="CorrigirCaderno"/);

console.log('Todos os testes de formInteractionCompat passaram.');
