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

test('botao de criacao possui um unico posicionamento flutuante compartilhado', () => {
  const source = readSource('src/components/CreateActionButton.tsx');

  assert.match(source, /container:[\s\S]*?position: 'absolute'/);
  assert.match(source, /right: spacing\.screen/);
  assert.match(source, /bottom: spacing\.screen \+ 20/);
  assert.doesNotMatch(source, /placement|dockedContainer|floatingContainer/);
});

test('Caderno conserva o padding seguro sob o FAB flutuante', () => {
  const source = readSource('src/screens/CadernoCampoScreen.tsx');

  assert.match(source, /<CreateActionButton/);
  assert.match(source, /paddingBottom: spacing\.screen \+ 80/);
  assert.doesNotMatch(source, /placement="docked"|safeActionArea/);
});

test('Propriedades, Caderno, Usuarios e Visitas usam o mesmo FAB', () => {
  [
    'src/screens/PropriedadesScreen.tsx',
    'src/screens/CadernoCampoScreen.tsx',
    'src/screens/UsuariosScreen.tsx',
    'src/screens/VisitasScreen.tsx',
  ].forEach((screen) => {
    const source = readSource(screen);
    assert.match(source, /<CreateActionButton/);
    assert.doesNotMatch(source, /placement=|safeActionArea/);
  });
});

if (failed > 0) process.exitCode = 1;
