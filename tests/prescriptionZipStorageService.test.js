const assert = require('node:assert/strict');
const {
  DEFAULT_PRESCRIPTION_ZIP_FILE_NAME,
  PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME,
  buildPrescriptionZipStorageDirectoryUri,
  buildPrescriptionZipStorageUri,
  copyPrescriptionZipToInternalStorage,
  deleteStoredPrescriptionZip,
  isSafePrescriptionZipStorageUri,
  sanitizePrescriptionZipFileName,
  sanitizePrescriptionZipPathSegment,
} = require('../.tmp-domain-compat/src/services/PrescriptionZipStorageService');

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

const normalizeUri = (uri) => String(uri).replace(/\\/g, '/');
const ensureSlash = (uri) => normalizeUri(uri).endsWith('/') ? normalizeUri(uri) : `${normalizeUri(uri)}/`;

const createFileSystem = (options = {}) => {
  const directories = new Set(['file:///app/']);
  const files = new Map();
  const calls = { getInfo: [], makeDirectory: [], copy: [], delete: [], read: [], write: [] };

  const adapter = {
    documentDirectory: options.documentDirectory ?? 'file:///app/',
    getInfoAsync: async (uri) => {
      const normalized = normalizeUri(uri);
      calls.getInfo.push(normalized);
      if (directories.has(ensureSlash(normalized))) return { exists: true, isDirectory: true, size: 0 };
      if (files.has(normalized)) return { exists: true, isDirectory: false, size: files.get(normalized).length };
      return { exists: false, isDirectory: false };
    },
    makeDirectoryAsync: async (uri, makeOptions) => {
      calls.makeDirectory.push({ uri: ensureSlash(uri), options: makeOptions });
      directories.add(ensureSlash(uri));
    },
    copyAsync: async ({ from, to }) => {
      calls.copy.push({ from: normalizeUri(from), to: normalizeUri(to) });
      if (options.failCopy) throw new Error('copy failed');
      files.set(normalizeUri(to), files.get(normalizeUri(from)) ?? Buffer.from([80, 75, 3, 4]));
    },
    deleteAsync: async (uri, deleteOptions) => {
      calls.delete.push({ uri: normalizeUri(uri), options: deleteOptions });
      files.delete(normalizeUri(uri));
    },
  };

  return {
    adapter,
    calls,
    files,
    putFile: (uri, content = Buffer.from([80, 75, 3, 4])) => files.set(normalizeUri(uri), content),
  };
};

const run = async () => {
  await test('sanitiza propriedade e nome mantendo somente ZIP', () => {
    assert.equal(sanitizePrescriptionZipPathSegment('../P Sela 1'), 'p-sela-1');
    assert.equal(sanitizePrescriptionZipFileName('../Prescrição Final.ZIP'), 'prescricao-final.zip');
    assert.equal(sanitizePrescriptionZipFileName('mapa.png'), DEFAULT_PRESCRIPTION_ZIP_FILE_NAME);
  });

  await test('constroi URI interna em tche-prescription-zips', () => {
    const fileSystem = createFileSystem();
    const deps = { fileSystem: fileSystem.adapter, generateImportId: () => 'zip-001' };

    const directory = buildPrescriptionZipStorageDirectoryUri('../Prop A', deps);
    const uri = buildPrescriptionZipStorageUri({
      propriedade_id: '../Prop A',
      originalName: 'Pacote Prescricao.zip',
    }, deps);

    assert.equal(directory, `file:///app/${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/prop-a/`);
    assert.equal(uri, `file:///app/${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/prop-a/zip-001-pacote-prescricao.zip`);
    assert.equal(isSafePrescriptionZipStorageUri(uri, deps), true);
    assert.equal(isSafePrescriptionZipStorageUri(`file:///app/${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/prop-a/arquivo.png`, deps), false);
    assert.equal(isSafePrescriptionZipStorageUri('file:///app/outro/arquivo.zip', deps), false);
  });

  await test('copia ZIP usando copyAsync sem ler nem gravar conteudo manualmente', async () => {
    const fileSystem = createFileSystem();
    fileSystem.putFile('content://picker/prescricao.zip', Buffer.from([80, 75, 3, 4, 5]));

    const result = await copyPrescriptionZipToInternalStorage({
      propriedade_id: 'prop_a',
      fazenda_id: 'fazenda_a',
      sourceUri: 'content://picker/prescricao.zip',
      originalName: 'Prescricao.zip',
      importId: 'zip-001',
    }, {
      fileSystem: fileSystem.adapter,
      now: () => '2026-06-05T10:00:00.000Z',
    });

    assert.equal(result.ok, true);
    assert.equal(result.file.uri, `file:///app/${PRESCRIPTION_ZIP_STORAGE_DIRECTORY_NAME}/prop_a/zip-001-prescricao.zip`);
    assert.equal(result.file.fazenda_id, 'fazenda_a');
    assert.equal(result.file.size, 5);
    assert.equal(result.file.mimeType, 'application/zip');
    assert.equal(fileSystem.calls.copy.length, 1);
    assert.equal(fileSystem.calls.read.length, 0);
    assert.equal(fileSystem.calls.write.length, 0);
  });

  await test('recusa copia sem propriedade e remocao fora do diretorio seguro', async () => {
    const fileSystem = createFileSystem();
    const missing = await copyPrescriptionZipToInternalStorage({
      propriedade_id: '',
      sourceUri: 'content://picker/prescricao.zip',
      originalName: 'Prescricao.zip',
    }, { fileSystem: fileSystem.adapter });
    const unsafeDelete = await deleteStoredPrescriptionZip('file:///app/outro/prescricao.zip', {
      fileSystem: fileSystem.adapter,
    });

    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, 'ZIP_PROPRIEDADE_ID_REQUIRED');
    assert.equal(unsafeDelete.ok, false);
    assert.equal(unsafeDelete.deleted, false);
    assert.equal(unsafeDelete.error.code, 'ZIP_UNSAFE_DELETE_PATH');
  });
};

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log('\nTodos os testes de prescriptionZipStorageService passaram.');
});
