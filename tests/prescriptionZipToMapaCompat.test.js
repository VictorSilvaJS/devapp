const assert = require('node:assert/strict');
const {
  PRESCRIPTION_ZIP_DETAILS_MESSAGE,
  getPrescriptionZipLocalMapaUri,
  isPrescriptionZipLocalMapa,
  mergeMapasWithPrescriptionZipImports,
  prescriptionZipImportToMapaCompat,
  prescriptionZipImportsToMapaCompatList,
} = require('../.tmp-domain-compat/src/utils/prescriptionZipToMapaCompat');

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

const baseMetadata = (overrides = {}) => ({
  id: 'zip_001',
  propriedade_id: 'prop_a',
  fazenda_id: 'fazenda_a',
  nome_propriedade: 'Propriedade A',
  titulo: 'Prescrição calcário',
  descricao: 'Pacote técnico de prescrição.',
  categoria: 'prescricao',
  categoria_label: 'Prescrição',
  tipo_material: 'prescricao',
  camada: 'prescricao',
  camada_label: 'Prescrição',
  elemento: 'prescricao',
  elemento_label: 'Prescrição',
  safra: '2025/2026',
  ano: 2026,
  escopo: 'propriedade',
  arquivo_nome_original: 'prescricao.zip',
  arquivo_uri_local: 'file:///app/tche-prescription-zips/prop_a/zip_001-prescricao.zip',
  arquivo_tamanho_bytes: 2048,
  arquivo_mime: 'application/zip',
  importado_por_usuario_id: 'u_admin',
  importado_por_nome: 'Admin',
  importado_em: '2026-06-05T10:00:00.000Z',
  atualizado_em: '2026-06-05T10:00:01.000Z',
  status: 'ativo',
  visivel_para_produtor: true,
  origem: 'arquivo_local',
  versao: 1,
  ...overrides,
});

const run = async () => {
  await test('converte metadado ZIP para item de mapa sem download nem preview de imagem', () => {
    const item = prescriptionZipImportToMapaCompat(baseMetadata());

    assert.equal(item.id, 'zip_local:zip_001');
    assert.equal(item.categoria, 'prescricao');
    assert.equal(item.categoria_label, 'Prescrição');
    assert.equal(item.tipo_anexo, 'prescricao_zip_local');
    assert.equal(item.tipo_material, 'prescricao');
    assert.equal(item.formato_arquivo, 'zip');
    assert.equal(item.disponivel_download, false);
    assert.equal(item.disponivel_para_download, false);
    assert.equal(item.is_prescription_zip_local, true);
    assert.equal(item.arquivo_uri_local.endsWith('.zip'), true);
    assert.equal(PRESCRIPTION_ZIP_DETAILS_MESSAGE.includes('processamento do ZIP não faz parte do MVP atual'), true);
  });

  await test('escopo talhao mostra talhao e escopo propriedade mostra Propriedade inteira', () => {
    const propriedade = prescriptionZipImportToMapaCompat(baseMetadata());
    const talhao = prescriptionZipImportToMapaCompat(baseMetadata({
      escopo: 'talhao',
      talhao_id: 't01',
      talhao_nome: 'Talhao Norte',
    }));

    assert.equal(propriedade.talhao, 'Propriedade inteira');
    assert.equal(propriedade.talhao_id, null);
    assert.equal(talhao.talhao, 'Talhao Norte');
    assert.equal(talhao.talhao_id, 't01');
  });

  await test('produtor ve somente prescricao ativa marcada como visivel', () => {
    const items = prescriptionZipImportsToMapaCompatList([
      baseMetadata({ id: 'visivel', visivel_para_produtor: true }),
      baseMetadata({ id: 'oculto', visivel_para_produtor: false }),
      baseMetadata({ id: 'removido', status: 'removido' }),
    ], { perfil: 'produtor' });

    assert.deepEqual(items.map((item) => item.prescription_zip_import_id), ['visivel']);
  });

  await test('filtra por propriedade_id ou fazenda_id e mescla ao final da lista', () => {
    const mapas = [{ id: 'mock_1', titulo: 'Mapa existente' }];
    const merged = mergeMapasWithPrescriptionZipImports(mapas, [
      baseMetadata({ id: 'zip_a', propriedade_id: 'prop_a' }),
      baseMetadata({ id: 'zip_b', propriedade_id: 'prop_b', fazenda_id: 'fazenda_b' }),
    ], { propriedadeIds: ['fazenda_b'] });

    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'mock_1');
    assert.equal(merged[1].prescription_zip_import_id, 'zip_b');
  });

  await test('identifica item ZIP local e normaliza URI', () => {
    const item = prescriptionZipImportToMapaCompat(baseMetadata({
      arquivo_uri_local: 'file:\\\\app\\\\tche-prescription-zips\\\\prop_a\\\\arquivo.zip',
    }));

    assert.equal(isPrescriptionZipLocalMapa(item), true);
    assert.equal(getPrescriptionZipLocalMapaUri(item), 'file://app/tche-prescription-zips/prop_a/arquivo.zip');
    assert.equal(isPrescriptionZipLocalMapa({ formato_arquivo: 'png' }), false);
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de prescriptionZipToMapaCompat passaram.');
});
