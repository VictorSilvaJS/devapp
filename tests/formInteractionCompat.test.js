const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const datePicker = read('src/components/DatePicker.tsx');
assert.match(datePicker, /minimumDay/);
assert.match(datePicker, /maximumDay/);
assert.match(datePicker, /setShowYears\(true\)/);
assert.match(datePicker, /CALENDAR_MIN_YEAR = 2000/);
assert.match(datePicker, /CALENDAR_MAX_YEAR = 2100/);
assert.match(datePicker, /Array\.from\(\{ length: 42 \}/);
assert.match(datePicker, /dayTextOutside/);
assert.doesNotMatch(datePicker, /isYearUnavailable/);
assert.doesNotMatch(datePicker, /yearOptionDisabled/);
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
assert.match(cadernoActions, /label="Editar dados"/);
assert.doesNotMatch(cadernoActions, /Complementar|adicionar_complemento/);
assert.doesNotMatch(cadernoActions, /Campo a corrigir/);
const corrigirCaderno = read('src/screens/CorrigirCadernoScreen.tsx');
assert.match(corrigirCaderno, /title="Editar dados do Caderno"/);
assert.match(corrigirCaderno, /CADERNO_TIPOS_ATIVIDADE/);
assert.match(corrigirCaderno, /getCadernoFormFieldVisibility/);
assert.match(corrigirCaderno, /label="Safra\/Safrinha"/);
assert.match(corrigirCaderno, /label="Talhão"/);
assert.match(corrigirCaderno, /tipo: 'corrigir'/);
assert.match(read('src/navigation/index.tsx'), /<Stack\.Screen name="CorrigirCaderno"/);

console.log('Todos os testes de formInteractionCompat passaram.');
