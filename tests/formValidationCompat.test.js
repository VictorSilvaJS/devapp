const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getFirstFormErrorKey,
  getFormErrorScrollTarget,
} = require('../.tmp-domain-compat/src/utils/formValidationCompat');

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

test('primeiro erro segue a ordem visual e ignora mensagens vazias', () => {
  assert.equal(
    getFirstFormErrorKey(
      { area: 'Informe a área', nome: 'Informe o nome', titular: '' },
      ['nome', 'area', 'titular'],
    ),
    'nome',
  );
  assert.equal(getFirstFormErrorKey({}, ['nome']), null);
});

test('alvo de rolagem considera posição atual, container e margem superior', () => {
  assert.equal(
    getFormErrorScrollTarget({
      currentOffset: 300,
      fieldPageY: 700,
      containerPageY: 160,
      topInset: 16,
    }),
    824,
  );
  assert.equal(
    getFormErrorScrollTarget({ currentOffset: 0, fieldPageY: 100, containerPageY: 160 }),
    0,
  );
});

test('formularios principais usam foco comum após validação inválida', () => {
  const screens = [
    'NovaPropriedadeScreen.tsx',
    'EditarPropriedadeScreen.tsx',
    'NovoUsuarioScreen.tsx',
    'NovoCadernoScreen.tsx',
    'EditarCadernoScreen.tsx',
    'NovaVisitaScreen.tsx',
    'EditarVisitaScreen.tsx',
    'ConcluirVisitaScreen.tsx',
    'CorrigirVisitaScreen.tsx',
    'PeriodoProdutivoFormScreen.tsx',
  ];

  for (const screen of screens) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', screen), 'utf8');
    assert.match(source, /useFormValidationFocus/);
    assert.match(source, /focusFirstError\((?:new|next)Errors\)/);
    assert.match(source, /ref=\{formValidation\.scrollViewRef\}/);
  }
});

if (failed > 0) process.exitCode = 1;
