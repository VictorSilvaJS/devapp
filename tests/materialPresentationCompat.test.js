const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getMaterialPublicDescription,
  getMaterialPublicTitle,
  getMaterialScopeLabel,
  getMaterialVersionLabel,
  isInternalFixtureLabel,
} = require('../.tmp-domain-compat/src/utils/materialPresentationCompat');

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

const run = () => {
  test('códigos de fixture e arquivo não viram títulos públicos', () => {
    assert.equal(isInternalFixtureLabel('17H113_PROD_SEM_PONTO'), true);
    assert.equal(isInternalFixtureLabel('PH_10a20.png'), true);
    assert.equal(
      getMaterialPublicTitle({
        titulo: '17H113_PROD_SEM_PONTO',
        elemento_label: 'pH',
      }),
      'pH'
    );
    assert.equal(
      getMaterialPublicTitle({
        titulo: 'PH_10a20',
        categoria_label: 'Fertilidade',
      }),
      'Fertilidade'
    );
    assert.equal(
      getMaterialPublicTitle({ titulo: 'pH - Fazenda Sela de Prata I' }),
      'pH - Fazenda Sela de Prata I'
    );
  });

  test('nome original é removido do resumo, mas a descrição útil permanece', () => {
    assert.equal(
      getMaterialPublicDescription({
        observacoes: 'Anexo visual de fertilidade. Arquivo original: PH_10a20.',
      }),
      'Anexo visual de fertilidade.'
    );
  });

  test('versão e escopo recebem rótulos legíveis', () => {
    assert.equal(getMaterialVersionLabel({ versao: 1 }), 'v1');
    assert.equal(getMaterialVersionLabel({ versao_dados: '2.1' }), 'v2.1');
    assert.equal(
      getMaterialVersionLabel({
        id: 'm_sela1_ph_10a20_2025',
        tipo_anexo: 'anexo_fertilidade',
      }),
      'v1'
    );
    assert.equal(
      getMaterialVersionLabel({
        id: 'material_sem_versao',
        tipo_anexo: 'anexo_fertilidade',
      }),
      ''
    );
    assert.equal(getMaterialScopeLabel({ escopo: 'propriedade' }), 'Propriedade inteira');
    assert.equal(
      getMaterialScopeLabel({ escopo: 'talhao', talhao_nome: 'T01 - 230' }),
      'T01 - 230'
    );
  });

  test('cartão mostra metadados legíveis e reserva nome original ao detalhe', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/screens/MapasScreen.tsx'),
      'utf8'
    );
    const cardMetadata = source.match(/const mapaMetaChips = \[[\s\S]*?\]\.filter\(Boolean\);/)?.[0] || '';
    const detailMetadata = source.match(/const buildImagePreviewMetaItems[\s\S]*?^  };/m)?.[0] || '';

    assert.match(source, /getMaterialPublicTitle\(mapa\)/);
    assert.match(source, /getMaterialPublicDescription\(mapa\)/);
    assert.match(cardMetadata, /'Data'/);
    assert.match(cardMetadata, /'Escopo'/);
    assert.match(cardMetadata, /'Versão'/);
    assert.doesNotMatch(cardMetadata, /Nome original|arquivoNomeOriginal/);
    assert.match(detailMetadata, /'Nome original'/);
  });

  if (failed > 0) process.exitCode = 1;
};

run();
