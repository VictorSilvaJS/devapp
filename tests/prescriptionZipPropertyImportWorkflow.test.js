const assert = require('node:assert/strict');
const {
  createPrescriptionZipImportService,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipImportService');
const {
  canStartPrescriptionZipPropertyImport,
  confirmPrescriptionZipPropertyImport,
  preparePrescriptionZipPropertyImport,
  validatePrescriptionZipPropertyImportForm,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipPropertyImportWorkflow');

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

const admin = { id: 'u_admin', nome: 'Admin', perfil: 'admin' };
const produtor = { id: 'u_produtor', nome: 'Produtor', perfil: 'produtor', produtor_id: 'titular_a' };
const colaboradorFora = { id: 'u_colab', nome: 'Colab', perfil: 'colaborador', vinculos_propriedades: [] };
const propriedade = {
  id: 'prop_a',
  propriedade_id: 'prop_a',
  fazenda_id: 'fazenda_a',
  fazenda: 'Propriedade A',
  produtor_id: 'titular_a',
  microregiao: 'Rio Verde',
};

const createMemoryStorage = () => {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => values.set(key, value),
      removeItem: async (key) => values.delete(key),
    },
  };
};

const createService = () => {
  const storage = createMemoryStorage();
  const service = createPrescriptionZipImportService({
    storage: storage.adapter,
    now: () => '2026-06-05T10:00:00.000Z',
    generateId: () => 'service_id',
  });
  return { service, storage };
};

const createDeps = ({ service, copyFail = false, metadataFail = false } = {}) => {
  const calls = { pick: [], copy: [], delete: [] };
  return {
    calls,
    deps: {
      importService: metadataFail ? {
        createPrescriptionZipImportMetadata: async () => {
          throw new Error('metadata failed');
        },
        listPrescriptionZipImportsByPropriedade: async () => [],
        listActivePrescriptionZipImportsByPropriedade: async () => [],
      } : service,
      generateImportId: () => 'zip_import_1',
      now: () => '2026-06-05T10:00:00.000Z',
      pickPrescriptionZipDocument: async () => {
        calls.pick.push(true);
        return {
          ok: true,
          file: {
            uri: 'content://picker/prescricao.zip',
            name: 'Prescricao.zip',
            size: 2048,
            mimeType: 'application/zip',
          },
          errors: [],
          warnings: [],
        };
      },
      copyPrescriptionZipToInternalStorage: async (input) => {
        calls.copy.push(input);
        if (copyFail) {
          return { ok: false, error: { code: 'ZIP_COPY_FAILED', message: 'Falha controlada.' } };
        }
        return {
          ok: true,
          file: {
            propriedade_id: input.propriedade_id,
            fazenda_id: input.fazenda_id,
            uri: `file:///app/tche-prescription-zips/${input.propriedade_id}/${input.importId}-prescricao.zip`,
            name: `${input.importId}-prescricao.zip`,
            originalName: input.originalName,
            size: 2048,
            mimeType: 'application/zip',
            copiedAt: '2026-06-05T10:00:00.000Z',
          },
        };
      },
      deleteStoredPrescriptionZip: async (uri) => {
        calls.delete.push(uri);
        return { ok: true, deleted: true };
      },
    },
  };
};

const run = async () => {
  await test('permissao bloqueia Produtor e colaborador fora do escopo', () => {
    assert.equal(canStartPrescriptionZipPropertyImport(admin, propriedade), true);
    assert.equal(canStartPrescriptionZipPropertyImport(produtor, propriedade), false);
    assert.equal(canStartPrescriptionZipPropertyImport(colaboradorFora, propriedade), false);
  });

  await test('prepare resolve propriedade e monta preview com camada prescrição', async () => {
    const { service } = createService();
    const { calls, deps } = createDeps({ service });

    const result = await preparePrescriptionZipPropertyImport({ user: admin, propriedade }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.preview.importId, 'zip_import_1');
    assert.equal(result.preview.resolvedContext.propriedade_id, 'prop_a');
    assert.equal(Object.prototype.hasOwnProperty.call(result.preview.resolvedContext, 'fazenda_id'), false);
    assert.equal(result.preview.form.camada, 'prescricao');
    assert.equal(calls.pick.length, 1);
  });

  await test('valida formulario de prescricao e talhao obrigatorio quando escopo talhao', () => {
    const invalid = validatePrescriptionZipPropertyImportForm({
      titulo: '',
      camada: 'ph',
      escopo: 'talhao',
    });
    const valid = validatePrescriptionZipPropertyImportForm({
      titulo: 'Prescrição',
      camada: 'taxa_variavel',
      escopo: 'talhao',
      talhao_nome: 'Talhao Norte',
      ano: '2026',
    });

    assert.equal(invalid.ok, false);
    assert.equal(invalid.errors.titulo, 'Informe um título para a prescrição.');
    assert.equal(invalid.errors.camada, 'Selecione a camada da prescrição.');
    assert.equal(invalid.errors.talhao, 'Selecione ou informe o talhão da prescrição.');
    assert.equal(valid.ok, true);
    assert.equal(valid.normalized.ano, 2026);
  });

  await test('confirm copia ZIP e grava somente metadados', async () => {
    const { service } = createService();
    const { deps } = createDeps({ service });
    const prepared = await preparePrescriptionZipPropertyImport({ user: admin, propriedade }, deps);

    const result = await confirmPrescriptionZipPropertyImport(prepared.preview, {
      titulo: 'Prescrição calcário',
      camada: 'prescricao',
      safra: '2025/2026',
      ano: 2026,
      escopo: 'propriedade',
      visivel_para_produtor: true,
    }, deps);

    assert.equal(result.ok, true);
    assert.equal(result.metadata.id, 'zip_import_1');
    assert.equal(result.metadata.categoria, 'prescricao');
    assert.equal(result.metadata.formato_arquivo, 'zip');
    assert.equal(result.metadata.arquivo_uri_local.includes('tche-prescription-zips'), true);
    assert.equal(typeof result.metadata.arquivo_uri_local, 'string');
    assert.equal(result.imports.length, 1);
  });

  await test('rollback remove arquivo copiado se metadados falham', async () => {
    const { service } = createService();
    const { calls, deps } = createDeps({ service, metadataFail: true });
    const prepared = await preparePrescriptionZipPropertyImport({ user: admin, propriedade }, deps);

    const result = await confirmPrescriptionZipPropertyImport(prepared.preview, {
      titulo: 'Prescrição',
      camada: 'prescricao',
      escopo: 'propriedade',
    }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'METADATA_FAILED');
    assert.equal(result.rollback.ok, true);
    assert.equal(calls.delete.length, 1);
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de prescriptionZipPropertyImportWorkflow passaram.');
});
