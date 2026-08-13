const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolvePropriedadeRouteContext } = require('../.tmp-domain-compat/src/navigation/propriedadeRouteCompat');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.equal(resolvePropriedadeRouteContext({
  propriedadeId: 'prop_canonica',
  fazendaId: 'prop_legada_camel',
  fazenda_id: 'prop_legada_snake',
  produtorId: 'prop_legada_produtor',
}).effectivePropriedadeId, 'prop_canonica');
assert.equal(resolvePropriedadeRouteContext({ fazenda_id: 'prop_legada_snake' }).effectivePropriedadeId, 'prop_legada_snake');
assert.equal(resolvePropriedadeRouteContext({ id: 'prop_detalhe' }, { allowIdAsFazendaId: true }).effectivePropriedadeId, 'prop_detalhe');

['NovaVisitaScreen.tsx', 'NovoCadernoScreen.tsx', 'PeriodoProdutivoFormScreen.tsx'].forEach((screen) => {
  assert.match(read(`src/screens/${screen}`), /resolvePropriedadeRouteContext\(route\.params\)\.effectivePropriedadeId/);
});

const propriedadeSource = read('src/screens/ProdutorScreen.tsx');
assert.match(propriedadeSource, /navigation\.navigate\('NovoPeriodoProdutivo', params\)/);
assert.doesNotMatch(propriedadeSource, /navigation\.navigate\('NovoPeriodoProdutivo', \{ fazendaId:/);
assert.match(propriedadeSource, /incluirRascunhosDoUsuario: true/);
assert.match(propriedadeSource, /usuarioId: user\?\.id/);

const visitaDetailSource = read('src/screens/VisitaDetailScreen.tsx');
assert.match(visitaDetailSource, /navigation\.navigate\('NovaVisita', \{[\s\S]*?propriedadeId: fazendaInfo\.id/);

console.log('Todos os testes de propriedadeRouteFlowCompat passaram.');

