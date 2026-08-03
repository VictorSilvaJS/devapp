const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CADERNO_LOCALIZACAO_ALL_KEYS,
  CADERNO_LOCALIZACAO_KEYS,
  CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA,
  applyCadernoLocalizacaoChange,
  buildCadernoLocalizacaoFields,
  buildCadernoLocalizacaoRemovalPatch,
  extractCadernoLocalizacao,
  hasCadernoLocalizacao,
  normalizeCadernoLocalizacao,
  validateCadernoLocalizacao,
} = require('../.tmp-domain-compat/src/utils/cadernoLocalizacaoCompat');
const { validateCadernoCampo } = require('../.tmp-domain-compat/src/api/validators');
const { CadernoCampo, MockLocalData } = require('../.tmp-domain-compat/src/api/mock');
const { normalizeCadernoCampo } = require('../.tmp-domain-compat/src/domain/domainCompat');
const { buildCadernoPayload } = require('../.tmp-domain-compat/src/utils/cadernoFormCompat');

let failed = 0;
let passed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const hasAnyLocationField = (value) => CADERNO_LOCALIZACAO_ALL_KEYS.some((key) => hasOwn(value, key));

const validLocation = (overrides = {}) => ({
  localizacao_latitude: 12.345678,
  localizacao_longitude: -45.678901,
  localizacao_accuracy: 8,
  localizacao_captured_at: '2026-07-21T15:30:00.000Z',
  localizacao_captured_by: 'usuario_teste',
  localizacao_origem: CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA,
  ...overrides,
});

const baseCaderno = (overrides = {}) => ({
  fazenda_id: 'faz_teste_localizacao',
  fazendaId: 'faz_teste_localizacao',
  colaborador_responsavel: 'Pessoa de Teste',
  data_atividade: '2026-07-21T15:40:00.000Z',
  tipo_atividade: 'observacao',
  talhao: 'Talhão Fictício',
  talhao_id: 'talhao_ficticio',
  talhaoId: 'talhao_ficticio',
  periodo_produtivo_id: 'periodo_teste',
  periodoProdutivoId: 'periodo_teste',
  periodo_produtivo_label: 'Safra • Teste • 2026/2027',
  tipo_periodo: 'safra',
  cultura_periodo: 'Cultura de Teste',
  ano_agricola: '2026/2027',
  ...overrides,
});

const storageValues = new Map();
const storageAdapter = {
  getItem: async (key) => storageValues.get(key) ?? null,
  setItem: async (key, value) => storageValues.set(key, value),
  removeItem: async (key) => storageValues.delete(key),
};

const expectInvalid = (value, errorPattern) => {
  const result = validateCadernoLocalizacao(value);
  assert.equal(result.valid, false);
  assert.equal(result.status, 'invalid');
  assert.match(result.error, errorPattern);
};

const run = async () => {
  MockLocalData.__setStorageForTests(storageAdapter);
  await MockLocalData.restoreSeed();

  await test('registro sem qualquer campo é válido e não possui localização', () => {
    assert.deepEqual(validateCadernoLocalizacao({}), { valid: true, status: 'absent', value: null });
    assert.equal(hasCadernoLocalizacao({}), false);
  });

  await test('localização válida é normalizada', () => {
    const normalized = normalizeCadernoLocalizacao(validLocation({
      localizacao_captured_by: '  usuario_teste  ',
    }));
    assert.equal(normalized.localizacao_captured_by, 'usuario_teste');
    assert.equal(normalized.localizacao_origem, 'foreground_explicit');
  });

  await test('latitude -90 é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_latitude: -90 })).valid, true);
  });

  await test('latitude 90 é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_latitude: 90 })).valid, true);
  });

  await test('latitude abaixo de -90 é inválida', () => {
    expectInvalid(validLocation({ localizacao_latitude: -90.000001 }), /Latitude/);
  });

  await test('latitude acima de 90 é inválida', () => {
    expectInvalid(validLocation({ localizacao_latitude: 90.000001 }), /Latitude/);
  });

  await test('longitude -180 é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_longitude: -180 })).valid, true);
  });

  await test('longitude 180 é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_longitude: 180 })).valid, true);
  });

  await test('longitude fora do limite é inválida', () => {
    expectInvalid(validLocation({ localizacao_longitude: 180.000001 }), /Longitude/);
    expectInvalid(validLocation({ localizacao_longitude: -180.000001 }), /Longitude/);
  });

  await test('NaN é inválido', () => {
    expectInvalid(validLocation({ localizacao_latitude: Number.NaN }), /Latitude/);
  });

  await test('Infinity é inválido', () => {
    expectInvalid(validLocation({ localizacao_longitude: Number.POSITIVE_INFINITY }), /Longitude/);
  });

  await test('latitude sem longitude é inválida', () => {
    const value = validLocation();
    delete value.localizacao_longitude;
    expectInvalid(value, /informadas juntas/);
  });

  await test('longitude sem latitude é inválida', () => {
    const value = validLocation();
    delete value.localizacao_latitude;
    expectInvalid(value, /informadas juntas/);
  });

  await test('accuracy ausente é válida', () => {
    const value = validLocation();
    delete value.localizacao_accuracy;
    const result = validateCadernoLocalizacao(value);
    assert.equal(result.valid, true);
    assert.equal(hasOwn(result.value, 'localizacao_accuracy'), false);
  });

  await test('accuracy null é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_accuracy: null })).valid, true);
  });

  await test('grupo mínimo válido aceita accuracy null e omite captured_by', () => {
    const value = validLocation({ localizacao_accuracy: null });
    delete value.localizacao_captured_by;
    const result = validateCadernoLocalizacao(value);

    assert.equal(result.valid, true);
    assert.equal(result.status, 'valid');
    assert.equal(result.value.localizacao_accuracy, null);
    assert.equal(hasOwn(result.value, 'localizacao_captured_by'), false);
  });

  await test('accuracy zero é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_accuracy: 0 })).valid, true);
  });

  await test('accuracy positiva é válida', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({ localizacao_accuracy: 15.5 })).valid, true);
  });

  await test('accuracy negativa é inválida', () => {
    expectInvalid(validLocation({ localizacao_accuracy: -0.1 }), /Precisão/);
  });

  await test('captured_at ISO válido passa', () => {
    assert.equal(validateCadernoLocalizacao(validLocation({
      localizacao_captured_at: '2026-07-21T12:30:00-03:00',
    })).valid, true);
  });

  await test('captured_at inválido falha', () => {
    expectInvalid(validLocation({ localizacao_captured_at: '21/07/2026 15:30' }), /Data\/hora/);
    expectInvalid(validLocation({ localizacao_captured_at: '2026-02-30T15:30:00.000Z' }), /Data\/hora/);
  });

  await test('captured_by ausente passa', () => {
    const value = validLocation();
    delete value.localizacao_captured_by;
    assert.equal(validateCadernoLocalizacao(value).valid, true);
  });

  await test('captured_by vazia falha quando fornecida', () => {
    expectInvalid(validLocation({ localizacao_captured_by: '   ' }), /Responsável/);
  });

  await test('origem foreground_explicit passa', () => {
    assert.equal(validateCadernoLocalizacao(validLocation()).valid, true);
  });

  await test('outra origem falha', () => {
    expectInvalid(validLocation({ localizacao_origem: 'background' }), /Origem/);
  });

  await test('coords não é copiado', () => {
    const normalized = normalizeCadernoLocalizacao({
      ...validLocation(),
      coords: { latitude: 1, longitude: 2 },
    });
    assert.equal(hasOwn(normalized, 'coords'), false);
  });

  await test('altitude, speed e heading não são copiados', () => {
    const normalized = normalizeCadernoLocalizacao({
      ...validLocation(),
      altitude: 99,
      altitudeAccuracy: 4,
      speed: 3,
      heading: 180,
    });
    ['altitude', 'altitudeAccuracy', 'speed', 'heading'].forEach((key) => {
      assert.equal(hasOwn(normalized, key), false);
    });
  });

  await test('arrays de coordenadas não são copiados', () => {
    const normalized = normalizeCadernoLocalizacao({
      ...validLocation(),
      coordinates: [[1, 2], [3, 4]],
      trilha: [{ latitude: 1, longitude: 2 }],
    });
    assert.equal(hasOwn(normalized, 'coordinates'), false);
    assert.equal(hasOwn(normalized, 'trilha'), false);
  });

  await test('campos extras são removidos', () => {
    const normalized = normalizeCadernoLocalizacao({ ...validLocation(), extra: 'não copiar' });
    assert.deepEqual(Object.keys(normalized).sort(), [...CADERNO_LOCALIZACAO_KEYS].sort());
  });

  await test('build sem localização não emite localizacao_*', () => {
    assert.deepEqual(buildCadernoLocalizacaoFields({}), {});
  });

  await test('build válido emite somente os seis campos permitidos', () => {
    const fields = buildCadernoLocalizacaoFields({ ...validLocation(), extra: true });
    assert.deepEqual(Object.keys(fields).sort(), [...CADERNO_LOCALIZACAO_KEYS].sort());
  });

  await test('preserve mantém localização existente sem alterar captured_at', () => {
    const record = { id: 'c_preserve', ...validLocation() };
    const result = applyCadernoLocalizacaoChange(record, { kind: 'preserve' });
    assert.deepEqual(result, record);
    assert.equal(result.localizacao_captured_at, record.localizacao_captured_at);
  });

  await test('replace troca integralmente todos os campos', () => {
    const replacement = validLocation({
      localizacao_latitude: -22.222222,
      localizacao_longitude: 33.333333,
      localizacao_captured_at: '2026-07-21T16:00:00.000Z',
      localizacao_captured_by: undefined,
      localizacao_accuracy: undefined,
    });
    const result = applyCadernoLocalizacaoChange(
      { id: 'c_replace', ...validLocation() },
      { kind: 'replace', value: replacement }
    );
    assert.equal(result.localizacao_latitude, -22.222222);
    assert.equal(result.localizacao_captured_at, '2026-07-21T16:00:00.000Z');
    assert.equal(hasOwn(result, 'localizacao_accuracy'), false);
    assert.equal(hasOwn(result, 'localizacao_captured_by'), false);
  });

  await test('remove elimina integralmente todos os campos', () => {
    const result = applyCadernoLocalizacaoChange(
      { id: 'c_remove', ...validLocation() },
      { kind: 'remove' }
    );
    assert.equal(hasAnyLocationField(result), false);
  });

  await test('registro antigo sem localização continua compatível', () => {
    const result = extractCadernoLocalizacao(baseCaderno());
    assert.equal(result.valid, true);
    assert.equal(result.status, 'absent');
  });

  await test('registro parcial na leitura não derruba o helper', () => {
    const result = extractCadernoLocalizacao({ localizacao_latitude: 10 });
    assert.equal(result.valid, false);
    assert.equal(result.status, 'invalid');
    assert.equal(result.value, null);
  });

  await test('registro parcial legado é lido sem propagar o grupo corrompido', () => {
    const result = normalizeCadernoCampo(baseCaderno({ localizacao_latitude: 10 }));
    assert.equal(result.fazenda_id, 'faz_teste_localizacao');
    assert.equal(hasAnyLocationField(result), false);
  });

  await test('Caderno comum continua passando no validator', () => {
    assert.equal(validateCadernoCampo(baseCaderno()), true);
  });

  await test('Caderno com localização válida passa no validator', () => {
    assert.equal(validateCadernoCampo(baseCaderno(validLocation())), true);
  });

  await test('Caderno com localização parcial falha no validator', () => {
    assert.throws(
      () => validateCadernoCampo(baseCaderno({ localizacao_latitude: 10 })),
      /informadas juntas/
    );
  });

  await test('payload atual do formulário continua sem localização', () => {
    const payload = buildCadernoPayload({
      fazendaId: 'faz_teste_localizacao',
      dataAtividade: new Date('2026-07-21T15:40:00.000Z'),
      tipoAtividade: 'observacao',
      talhao: 'Talhão Fictício',
    });
    assert.equal(hasAnyLocationField(payload), false);
  });

  await test('create rejeita localização parcial antes de persistir', async () => {
    await assert.rejects(
      () => CadernoCampo.create(baseCaderno({ localizacao_latitude: 10 })),
      /informadas juntas/
    );
  });

  let registroId;

  await test('create/get/list faz round-trip dos campos válidos', async () => {
    const created = await CadernoCampo.create(baseCaderno(validLocation()));
    registroId = created.id;
    const fromGet = await CadernoCampo.get(registroId);
    const fromList = (await CadernoCampo.list()).find((item) => item.id === registroId);
    CADERNO_LOCALIZACAO_KEYS.forEach((key) => {
      assert.equal(fromGet[key], created[key]);
      assert.equal(fromList[key], created[key]);
    });
  });

  await test('update preserve mantém os campos', async () => {
    const before = await CadernoCampo.get(registroId);
    const updated = await CadernoCampo.update(registroId, { observacoes: 'Edição comum' });
    CADERNO_LOCALIZACAO_KEYS.forEach((key) => assert.equal(updated[key], before[key]));
  });

  await test('update com undefined parcial não é confundido com remoção', async () => {
    const before = await CadernoCampo.get(registroId);
    await assert.rejects(
      () => CadernoCampo.update(registroId, { localizacao_accuracy: undefined }),
      /Grupo parcial de localização inválido para escrita/
    );
    const after = await CadernoCampo.get(registroId);
    CADERNO_LOCALIZACAO_KEYS.forEach((key) => assert.equal(after[key], before[key]));
  });

  await test('update replace altera integralmente os campos', async () => {
    const replacement = validLocation({
      localizacao_latitude: -22.222222,
      localizacao_longitude: 33.333333,
      localizacao_accuracy: undefined,
      localizacao_captured_at: '2026-07-21T16:00:00.000Z',
      localizacao_captured_by: undefined,
    });
    const updated = await CadernoCampo.update(registroId, replacement);
    assert.equal(updated.localizacao_latitude, -22.222222);
    assert.equal(updated.localizacao_longitude, 33.333333);
    assert.equal(updated.localizacao_captured_at, '2026-07-21T16:00:00.000Z');
    assert.equal(hasOwn(updated, 'localizacao_accuracy'), false);
    assert.equal(hasOwn(updated, 'localizacao_captured_by'), false);
  });

  await test('serialização/restauração preserva localização válida', async () => {
    const snapshot = await MockLocalData.readLocalSnapshot();
    const persisted = snapshot.cadernos.find((item) => item.id === registroId);
    assert.equal(persisted.localizacao_latitude, -22.222222);
    assert.equal(persisted.localizacao_origem, 'foreground_explicit');
    await MockLocalData.reloadFromLocal();
    assert.equal((await CadernoCampo.get(registroId)).localizacao_latitude, -22.222222);
  });

  await test('fazenda, Talhão e Safra/Safrinha permanecem após localização', async () => {
    const record = await CadernoCampo.get(registroId);
    assert.equal(record.fazenda_id, 'faz_teste_localizacao');
    assert.equal(record.fazendaId, 'faz_teste_localizacao');
    assert.equal(record.produtor_id, 'faz_teste_localizacao');
    assert.equal(record.talhao, 'Talhão Fictício');
    assert.equal(record.talhao_id, 'talhao_ficticio');
    assert.equal(record.periodo_produtivo_id, 'periodo_teste');
    assert.equal(record.periodoProdutivoId, 'periodo_teste');
  });

  await test('update remove limpa os campos sem sentinel ou null residual', async () => {
    const updated = await CadernoCampo.update(
      registroId,
      buildCadernoLocalizacaoRemovalPatch()
    );
    assert.equal(hasAnyLocationField(updated), false);
    assert.equal(JSON.stringify(updated).includes('localizacao_'), false);
  });

  await test('serialização/restauração não ressuscita localização removida', async () => {
    const snapshot = await MockLocalData.readLocalSnapshot();
    const persisted = snapshot.cadernos.find((item) => item.id === registroId);
    assert.equal(hasAnyLocationField(persisted), false);
    assert.equal(JSON.stringify(persisted).includes('localizacao_'), false);
    await MockLocalData.reloadFromLocal();
    assert.equal(hasAnyLocationField(await CadernoCampo.get(registroId)), false);
  });

  await test('nenhuma chave nova de storage é necessária', () => {
    assert.deepEqual([...storageValues.keys()], ['@tche:mock-mvp:v1']);
  });

  await test('helper puro não importa UI, Expo, storage, filesystem, mock ou navegação', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/utils/cadernoLocalizacaoCompat.ts'),
      'utf8'
    );
    assert.equal(/react-native|expo-location|AsyncStorage|FileSystem|api\/mock|navigation/i.test(source), false);
    assert.equal(/console\.(log|warn|error)/.test(source), false);
    assert.equal(/new Date\(\)/.test(source), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam; ${passed} passaram.`);
  } else {
    console.log(`\nTodos os ${passed} testes de cadernoLocalizacaoCompat passaram.`);
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
