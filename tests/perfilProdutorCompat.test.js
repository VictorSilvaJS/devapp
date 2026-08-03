const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSolicitacaoAtualizacaoCadastral,
} = require('../.tmp-domain-compat/src/utils/perfilProdutorCompat');

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

test('solicitação identifica Produtor e uma Propriedade sem afirmar envio', () => {
  const message = buildSolicitacaoAtualizacaoCadastral({
    produtorNome: ' Produtor Demonstração ',
    propriedades: ['Fazenda Sela de Prata I'],
  });

  assert.match(message, /^Solicitação de atualização cadastral/);
  assert.match(message, /Produtor: Produtor Demonstração/);
  assert.match(message, /Propriedade vinculada: Fazenda Sela de Prata I/);
  assert.doesNotMatch(message, /enviad|registrad|protocolo/i);
});

test('solicitação aceita várias Propriedades e remove duplicação visual', () => {
  const message = buildSolicitacaoAtualizacaoCadastral({
    produtorNome: 'Maria',
    propriedades: ['Boa Vista', 'Boa Vista', 'Horizonte'],
  });

  assert.match(message, /Propriedades vinculadas: Boa Vista, Horizonte/);
});

test('solicitação possui fallback controlado sem vínculo', () => {
  const message = buildSolicitacaoAtualizacaoCadastral({
    produtorNome: null,
    propriedades: [],
  });

  assert.match(message, /Produtor: Não informado/);
  assert.match(message, /Propriedades vinculadas: Nenhuma informada/);
});

test('Perfil do Produtor abre Propriedade com affordance explícita', () => {
  const source = readSource('src/screens/PerfilScreen.tsx');

  assert.match(source, /buildPropriedadeDetailRouteParams/);
  assert.match(source, /navigation\.navigate\('ProdutorDetail', params\)/);
  assert.match(source, /accessibilityRole="button"/);
  assert.match(source, /name="chevron-forward-outline"/);
  assert.doesNotMatch(source, /Propriedades vinculadas ao seu cadastro local\./);
});

test('Perfil prepara compartilhamento cadastral sem habilitar edição direta', () => {
  const profileSource = readSource('src/screens/PerfilScreen.tsx');
  const editSource = readSource('src/screens/EditProfileScreen.tsx');

  assert.match(profileSource, /Solicitar atualização cadastral/);
  assert.match(profileSource, /Share\.share/);
  assert.match(profileSource, /buildSolicitacaoAtualizacaoCadastral/);
  assert.doesNotMatch(profileSource, /Solicitação compartilhada|Share\.sharedAction/);
  assert.match(profileSource, /usuarioPerfil\.perfil !== 'produtor'/);
  assert.match(editSource, /if \(perfil === 'produtor'\)/);
  const producerBranchStart = editSource.indexOf("if (perfil === 'produtor')");
  const nextReturnStart = editSource.indexOf('\n  return (', producerBranchStart + 1);
  const producerBranch = editSource.slice(producerBranchStart, nextReturnStart);
  assert.doesNotMatch(producerBranch, /<FormField/);
  assert.match(producerBranch, /solicite atualização/i);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de perfilProdutorCompat passaram.');
}
