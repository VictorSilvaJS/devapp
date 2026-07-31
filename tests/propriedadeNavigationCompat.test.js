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

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/screens/ProdutorScreen.tsx'),
  'utf8'
);

test('navegacao da Propriedade usa os seis destinos aprovados na ordem correta', () => {
  const navigationBlock = source.match(
    /const PROPRIEDADE_NAVIGATION_ITEMS = \[([\s\S]*?)\] as const;/
  );

  assert.ok(navigationBlock, 'a lista canonica de navegacao deve existir');

  const items = [...navigationBlock[1].matchAll(/id: '([^']+)', label: '([^']+)'/g)]
    .map((match) => ({ id: match[1], label: match[2] }));

  assert.deepEqual(items, [
    { id: 'resumo', label: 'Resumo' },
    { id: 'talhoes', label: 'Talhões' },
    { id: 'safras', label: 'Safras e Safrinha' },
    { id: 'materiais', label: 'Materiais' },
    { id: 'visitas', label: 'Visitas' },
    { id: 'caderno', label: 'Caderno' },
  ]);
});

test('destinos ficam em navegacao horizontal acessivel e possuem conteudo proprio', () => {
  assert.match(
    source,
    /<ScrollView\s+horizontal\s+showsHorizontalScrollIndicator=\{false\}[\s\S]*?PROPRIEDADE_NAVIGATION_ITEMS\.map/
  );
  assert.match(source, /accessibilityRole="tab"/);
  assert.match(source, /accessibilityState=\{\{ selected: isActive \}\}/);

  ['resumo', 'talhoes', 'safras', 'materiais', 'visitas', 'caderno'].forEach((id) => {
    assert.match(source, new RegExp(`activeTab === '${id}'`));
  });

  assert.doesNotMatch(source, /activeTab === 'lavoura'/);
});

test('Resumo nao repete atalhos e Safras oferece uma unica acao de criacao', () => {
  assert.doesNotMatch(source, /Atalhos da Propriedade/);
  assert.doesNotMatch(source, /quickAction(?:Grid|Card|Title|Text)/);

  const createActions = source.match(
    /onActionPress=\{podeGerenciarPeriodosNaFazenda \? handleNovoPeriodoProdutivo : undefined\}/g
  ) || [];

  assert.equal(createActions.length, 1);
  assert.doesNotMatch(source, /actionLabel=\{podeGerenciarPeriodosNaFazenda \? 'Nova Safra\/Safrinha'/);
});

test('MP-15 nao antecipa a entrada Lista e Mapa reservada para MP-16', () => {
  assert.doesNotMatch(source, /Lista\s*\|\s*Mapa/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de propriedadeNavigationCompat passaram.');
}
