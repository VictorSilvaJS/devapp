const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SELF_TERRITORIAL_UPDATE_FORBIDDEN_CODE,
  SELF_TERRITORIAL_UPDATE_FORBIDDEN_MESSAGE,
  getSelfTerritorialUpdateFields,
  sanitizeSelfProfileUpdate,
} = require('../.tmp-domain-compat/src/auth/selfProfileUpdate');

let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const run = async () => {
  await test('edicao comum de nome permanece permitida', () => {
    assert.deepEqual(sanitizeSelfProfileUpdate({ nome: 'Nome Atualizado' }), {
      nome: 'Nome Atualizado',
    });
  });

  await test('payload territorial direto e recusado com campos identificados', () => {
    assert.throws(
      () =>
        sanitizeSelfProfileUpdate({
          nome: 'Colaborador',
          regiao: 'Outra região',
          sub_regioes: ['Área externa'],
          propriedades_atribuidas: ['p_fora'],
        }),
      (error) => {
        assert.equal(error.message, SELF_TERRITORIAL_UPDATE_FORBIDDEN_MESSAGE);
        assert.equal(error.code, SELF_TERRITORIAL_UPDATE_FORBIDDEN_CODE);
        assert.deepEqual(error.fields, [
          'regiao',
          'sub_regioes',
          'propriedades_atribuidas',
        ]);
        return true;
      }
    );
  });

  await test('aliases canonicos futuros tambem sao protegidos', () => {
    const fields = getSelfTerritorialUpdateFields({
      regional_id: 'regional_1',
      area_operacional_id: 'area_1',
      vinculos_areas_operacionais: [{ area_operacional_id: 'area_1' }],
      vinculos_propriedades: [{ propriedade_id: 'p1' }],
    });

    assert.deepEqual(fields, [
      'regional_id',
      'area_operacional_id',
      'vinculos_areas_operacionais',
      'vinculos_propriedades',
    ]);
  });

  await test('entrada ausente ou invalida produz patch vazio seguro', () => {
    assert.deepEqual(sanitizeSelfProfileUpdate(null), {});
    assert.deepEqual(sanitizeSelfProfileUpdate('regiao=fora'), {});
    assert.deepEqual(sanitizeSelfProfileUpdate([]), {});
  });

  await test('AuthContext aplica a defesa antes de mesclar a sessao', () => {
    const source = readSource('src/auth/AuthContext.tsx');
    assert.match(source, /sanitizeSelfProfileUpdate\(updates\)/);
    assert.match(source, /\.\.\.safeUpdates/);
  });

  await test('tela de autoedicao nao possui campo livre de Regiao', () => {
    const source = readSource('src/screens/EditProfileScreen.tsx');
    assert.equal(source.includes('label="Região"'), false);
    assert.equal(source.includes('form.regiao'), false);
    assert.match(source, /vínculos administrativos/i);
    assert.match(source, /solicite correção ao administrador/i);
  });

  await test('Perfil apresenta escopo legado como somente leitura', () => {
    const source = readSource('src/screens/PerfilScreen.tsx');
    assert.match(source, /Escopo operacional/);
    assert.match(source, /somente leitura/i);
    assert.match(source, /Regional\/Área operacional e Município\/UF/);
    assert.match(source, /solicite correção ao administrador/i);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de selfProfileUpdate passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
