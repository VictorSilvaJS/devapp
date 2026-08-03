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

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('botao de criacao preserva modo flutuante e oferece modo ancorado', () => {
  const source = readSource('src/components/CreateActionButton.tsx');

  assert.match(source, /placement\?: 'floating' \| 'docked'/);
  assert.match(source, /placement = 'floating'/);
  assert.match(source, /placement === 'docked'/);
  assert.match(source, /floatingContainer:[\s\S]*?position: 'absolute'/);
  assert.match(source, /dockedContainer:[\s\S]*?alignSelf: 'flex-end'/);
});

test('Caderno ancora a acao fora da rolagem e conserva o padding seguro', () => {
  const source = readSource('src/screens/CadernoCampoScreen.tsx');
  const scrollEnd = source.indexOf('</ScrollView>');
  const safeArea = source.indexOf('<View style={styles.safeActionArea}>');

  assert.ok(scrollEnd >= 0);
  assert.ok(safeArea > scrollEnd, 'a faixa de acao deve ficar fora da ScrollView');
  assert.match(source, /placement="docked"/);
  assert.match(source, /paddingBottom: spacing\.screen \+ 80/);
  assert.match(source, /safeActionArea:[\s\S]*?flexShrink: 0/);
});

test('listas ainda fora das migracoes MP-14 e MP-18 mantem o comportamento flutuante', () => {
  [
    'src/screens/UsuariosScreen.tsx',
    'src/screens/VisitasScreen.tsx',
  ].forEach((screen) => {
    const source = readSource(screen);
    assert.match(source, /<CreateActionButton/);
    assert.doesNotMatch(source, /placement="docked"/);
  });
});

if (failed > 0) process.exitCode = 1;
