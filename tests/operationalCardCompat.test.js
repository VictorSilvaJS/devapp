const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  formatOperationalDateTime,
  resolveOperationalSummary,
} = require('../.tmp-domain-compat/src/utils/operationalCardCompat');

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

const readSource = (relativePath) => (
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
);

test('data operacional inclui data e hora e possui fallback controlado', () => {
  const formatted = formatOperationalDateTime('2026-08-03T14:30:00.000Z');
  assert.match(formatted, /^\d{2}\/\d{2}\/\d{4} • \d{2}:\d{2}$/);
  assert.equal(formatOperationalDateTime('invalida'), 'Data não informada');
  assert.equal(formatOperationalDateTime(null), 'Data não informada');
});

test('resumo escolhe primeiro conteúdo útil e mantém fallback', () => {
  assert.equal(resolveOperationalSummary([' ', ' Segundo resumo ']), 'Segundo resumo');
  assert.equal(resolveOperationalSummary([]), 'Sem resumo informado');
});

test('casca compartilhada oferece hierarquia, duas linhas e chevron acessível', () => {
  const source = readSource('src/components/OperationalCard.tsx');
  assert.match(source, /accessibilityRole="button"/);
  assert.match(source, /chevron-forward-outline/);
  assert.match(source, /numberOfLines=\{2\}/);
  assert.match(source, /formatOperationalDateTime/);
  assert.match(source, /tags\.map/);
  assert.match(source, /chips\.map/);
});

test('Caderno e Visitas usam a mesma casca sem duplicar o cartão antigo', () => {
  const caderno = readSource('src/screens/CadernoCampoScreen.tsx');
  const visitas = readSource('src/screens/VisitasScreen.tsx');
  assert.match(caderno, /<OperationalCard/);
  assert.match(visitas, /<OperationalCard/);
  assert.doesNotMatch(caderno, /style=\{styles\.card\}/);
  assert.doesNotMatch(visitas, /style=\{styles\.card\}/);
});

test('diferenças de domínio e visibilidade do Produtor são preservadas', () => {
  const caderno = readSource('src/screens/CadernoCampoScreen.tsx');
  const visitas = readSource('src/screens/VisitasScreen.tsx');
  assert.match(caderno, /Talhão:/);
  assert.match(caderno, /Safra\/Safrinha:/);
  assert.match(caderno, /!isProdutorView/);
  assert.match(caderno, /Com ponto geográfico/);
  assert.match(visitas, /objetivoLabel/);
  assert.match(visitas, /visita\.status/);
  assert.match(visitas, /getVisitaStatusPresentation/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de operationalCardCompat passaram.');
}
