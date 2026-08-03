const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CADERNO_LOCALIZACAO_ALL_KEYS,
  CADERNO_LOCALIZACAO_KEYS,
  hasCadernoLocalizacao,
} = require('../.tmp-domain-compat/src/utils/cadernoLocalizacaoCompat');
const {
  CADERNO_LOCALIZACAO_ERROR_MESSAGE,
  CADERNO_LOCALIZACAO_PERMISSION_DENIED_MESSAGE,
  CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE,
  CADERNO_LOCALIZACAO_SERVICES_DISABLED_MESSAGE,
  CADERNO_LOCALIZACAO_UNAVAILABLE_MESSAGE,
  appendCadernoLocalizacaoDraft,
  buildCadernoLocalizacaoDraft,
  buildCadernoLocalizacaoEditPatch,
  getCadernoLocalizacaoCaptureErrorMessage,
  getCadernoLocalizacaoPresentation,
  getInitialCadernoLocalizacaoEditState,
  isCadernoLocalizacaoLowAccuracy,
  setCadernoLocalizacaoEditRemoval,
  setCadernoLocalizacaoEditReplacement,
  shouldAcceptCadernoLocalizacaoCaptureResponse,
  shouldDiscardCadernoLocalizacaoDraftForPropertyChange,
  undoCadernoLocalizacaoEditRemoval,
} = require('../.tmp-domain-compat/src/utils/cadernoLocalizacaoUiCompat');

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
const locationKeys = (value) => Object.keys(value)
  .filter((key) => key.startsWith('localizacao_'))
  .sort();

const validCapture = (overrides = {}) => ({
  latitude: 12.345678,
  longitude: -45.678901,
  accuracy: 8,
  capturedAt: '2026-07-21T15:30:00.000Z',
  ...overrides,
});

const validLocation = (overrides = {}) => ({
  localizacao_latitude: 12.345678,
  localizacao_longitude: -45.678901,
  localizacao_accuracy: 8,
  localizacao_captured_at: '2026-07-21T15:30:00.000Z',
  localizacao_captured_by: 'usuario_teste',
  localizacao_origem: 'foreground_explicit',
  ...overrides,
});

const run = async () => {
  await test('captura foreground válida vira draft com somente os seis campos canônicos', () => {
    const draft = buildCadernoLocalizacaoDraft({
      ...validCapture(),
      coords: { latitude: 1, longitude: 2 },
      altitude: 100,
      speed: 4,
      heading: 90,
      capturedForPropertyId: 'nao_persistir',
    }, '  usuario_teste  ');

    assert.ok(draft);
    assert.deepEqual(Object.keys(draft).sort(), [...CADERNO_LOCALIZACAO_KEYS].sort());
    assert.equal(draft.localizacao_captured_by, 'usuario_teste');
    assert.equal(hasOwn(draft, 'coords'), false);
    assert.equal(hasOwn(draft, 'capturedForPropertyId'), false);
  });

  await test('capturedBy ausente, vazio ou não textual é omitido', () => {
    [undefined, '   ', 123].forEach((capturedBy) => {
      const draft = buildCadernoLocalizacaoDraft(validCapture(), capturedBy);
      assert.ok(draft);
      assert.equal(hasOwn(draft, 'localizacao_captured_by'), false);
    });
  });

  await test('captura inválida não vira draft pronto para submit', () => {
    assert.equal(buildCadernoLocalizacaoDraft({ ...validCapture(), longitude: undefined }), null);
    assert.equal(buildCadernoLocalizacaoDraft({ ...validCapture(), capturedAt: 'data inválida' }), null);
    assert.equal(buildCadernoLocalizacaoDraft(null), null);
  });

  await test('Novo Caderno sem captura não emite localização', () => {
    const payload = appendCadernoLocalizacaoDraft({
      fazenda_id: 'faz_1',
      observacoes: 'Registro comum',
    }, null);

    assert.deepEqual(locationKeys(payload), []);
    assert.equal(payload.observacoes, 'Registro comum');
  });

  await test('Novo Caderno com draft válido emite apenas o grupo canônico', () => {
    const draft = {
      ...validLocation(),
      coords: { latitude: 1, longitude: 2 },
      removalPending: false,
      capturedForPropertyId: 'faz_1',
    };
    const payload = appendCadernoLocalizacaoDraft({ fazenda_id: 'faz_1' }, draft);

    assert.deepEqual(locationKeys(payload), [...CADERNO_LOCALIZACAO_KEYS].sort());
    assert.equal(hasOwn(payload, 'coords'), false);
    assert.equal(hasOwn(payload, 'removalPending'), false);
    assert.equal(hasOwn(payload, 'capturedForPropertyId'), false);
  });

  await test('draft inválido não é enviado e limpa grupo parcial acidental do payload base', () => {
    const payload = appendCadernoLocalizacaoDraft({
      fazenda_id: 'faz_1',
      localizacao_latitude: 10,
    }, { localizacao_latitude: 10 });

    assert.deepEqual(locationKeys(payload), []);
  });

  await test('mudança de Talhão no payload não altera o draft', () => {
    const draft = validLocation();
    const before = appendCadernoLocalizacaoDraft({ fazenda_id: 'faz_1', talhao_id: 't1' }, draft);
    const after = appendCadernoLocalizacaoDraft({ fazenda_id: 'faz_1', talhao_id: 't2' }, draft);

    CADERNO_LOCALIZACAO_KEYS.forEach((key) => assert.equal(after[key], before[key]));
    assert.equal(after.talhao_id, 't2');
  });

  await test('edição inicia em preserve sem alterar timestamp existente', () => {
    const location = validLocation();
    const state = getInitialCadernoLocalizacaoEditState({ id: 'cad_1', ...location });

    assert.equal(state.intent, 'preserve');
    assert.equal(state.draftLocation, null);
    assert.equal(state.existingLocation.localizacao_captured_at, location.localizacao_captured_at);
    assert.deepEqual(buildCadernoLocalizacaoEditPatch(state.intent, state.draftLocation), {});
  });

  await test('edição de registro sem ponto ou com grupo parcial inicia segura em preserve', () => {
    const absent = getInitialCadernoLocalizacaoEditState({ id: 'cad_sem_ponto' });
    const partial = getInitialCadernoLocalizacaoEditState({ localizacao_latitude: 10 });

    assert.equal(absent.intent, 'preserve');
    assert.equal(absent.existingLocation, null);
    assert.equal(partial.intent, 'preserve');
    assert.equal(partial.existingLocation, null);
  });

  await test('replace guarda draft novo em state sem modificar o ponto existente', () => {
    const initial = getInitialCadernoLocalizacaoEditState(validLocation());
    const replacement = validLocation({
      localizacao_latitude: -22.2,
      localizacao_longitude: 33.3,
      localizacao_captured_at: '2026-07-21T16:00:00.000Z',
    });
    const state = setCadernoLocalizacaoEditReplacement(initial, replacement, ' faz_1 ');

    assert.equal(state.intent, 'replace');
    assert.equal(state.draftLocation.localizacao_latitude, -22.2);
    assert.equal(state.existingLocation.localizacao_latitude, 12.345678);
    assert.equal(state.capturedForPropertyId, 'faz_1');
  });

  await test('replace inválido não troca a intenção nem o state atual', () => {
    const initial = getInitialCadernoLocalizacaoEditState(validLocation());
    const state = setCadernoLocalizacaoEditReplacement(
      initial,
      { localizacao_latitude: 10 },
      'faz_1'
    );

    assert.deepEqual(state, initial);
  });

  await test('patch replace contém somente o grupo novo integral', () => {
    const replacement = validLocation({
      localizacao_latitude: -22.2,
      localizacao_longitude: 33.3,
      localizacao_accuracy: undefined,
      localizacao_captured_by: undefined,
      localizacao_captured_at: '2026-07-21T16:00:00.000Z',
    });
    const patch = buildCadernoLocalizacaoEditPatch('replace', replacement);

    assert.equal(patch.localizacao_latitude, -22.2);
    assert.equal(patch.localizacao_longitude, 33.3);
    assert.equal(hasOwn(patch, 'localizacao_accuracy'), false);
    assert.equal(hasOwn(patch, 'localizacao_captured_by'), false);
    assert.equal(hasOwn(patch, 'id'), false);
  });

  await test('patch replace inválido não envia localização parcial', () => {
    assert.deepEqual(
      buildCadernoLocalizacaoEditPatch('replace', { localizacao_latitude: 10 }),
      {}
    );
  });

  await test('remove fica pendente no state e não apaga o ponto existente', () => {
    const initial = getInitialCadernoLocalizacaoEditState(validLocation());
    const state = setCadernoLocalizacaoEditRemoval(initial);

    assert.equal(state.intent, 'remove');
    assert.equal(state.draftLocation, null);
    assert.equal(state.existingLocation.localizacao_latitude, 12.345678);
  });

  await test('remover draft novo sem ponto persistido apenas descarta o draft', () => {
    const initial = getInitialCadernoLocalizacaoEditState({ id: 'cad_sem_ponto' });
    const replaced = setCadernoLocalizacaoEditReplacement(initial, validLocation(), 'faz_1');
    const discarded = setCadernoLocalizacaoEditRemoval(replaced);

    assert.equal(discarded.intent, 'preserve');
    assert.equal(discarded.draftLocation, null);
    assert.equal(discarded.existingLocation, null);
    assert.equal(discarded.capturedForPropertyId, null);
    assert.deepEqual(buildCadernoLocalizacaoEditPatch(discarded.intent), {});
  });

  await test('remover substituição de ponto persistido mantém remoção pendente', () => {
    const initial = getInitialCadernoLocalizacaoEditState(validLocation());
    const replaced = setCadernoLocalizacaoEditReplacement(
      initial,
      validLocation({ localizacao_latitude: -22.2 }),
      'faz_1'
    );
    const removed = setCadernoLocalizacaoEditRemoval(replaced);

    assert.equal(removed.intent, 'remove');
    assert.equal(removed.draftLocation, null);
    assert.ok(removed.existingLocation);
  });

  await test('patch remove limpa captura e avaliação espacial sem resíduo', () => {
    const patch = buildCadernoLocalizacaoEditPatch('remove');

    assert.deepEqual(Object.keys(patch).sort(), [...CADERNO_LOCALIZACAO_ALL_KEYS].sort());
    CADERNO_LOCALIZACAO_ALL_KEYS.forEach((key) => assert.equal(patch[key], undefined));
    assert.equal(JSON.stringify(patch), '{}');
  });

  await test('desfazer remoção volta para preserve e reapresenta o ponto existente', () => {
    const initial = getInitialCadernoLocalizacaoEditState(validLocation());
    const removed = setCadernoLocalizacaoEditRemoval(initial);
    const restored = undoCadernoLocalizacaoEditRemoval(removed);

    assert.equal(restored.intent, 'preserve');
    assert.equal(restored.draftLocation, null);
    assert.deepEqual(restored.existingLocation, initial.existingLocation);
    assert.deepEqual(buildCadernoLocalizacaoEditPatch(restored.intent), {});
  });

  await test('apresentação não existe para registro ausente ou parcial', () => {
    assert.equal(getCadernoLocalizacaoPresentation({}), null);
    assert.equal(getCadernoLocalizacaoPresentation({ localizacao_latitude: 10 }), null);
  });

  await test('apresentação válida formata coordenadas, precisão, horário, origem e selo', () => {
    const presentation = getCadernoLocalizacaoPresentation(validLocation());

    assert.ok(presentation);
    assert.equal(presentation.latitudeText, '12,345678');
    assert.equal(presentation.longitudeText, '-45,678901');
    assert.equal(presentation.accuracyText, 'Precisão informada: 8 m');
    assert.equal(presentation.accuracyValueText, '8 m');
    assert.match(presentation.capturedAtText, /21\/07\/2026/);
    assert.equal(presentation.originText, 'Localização registrada por ação explícita');
    assert.equal(presentation.badgeLabel, 'Com ponto geográfico');
  });

  await test('selo só é elegível para localização canônica válida', () => {
    assert.equal(hasCadernoLocalizacao(validLocation()), true);
    assert.equal(hasCadernoLocalizacao({}), false);
    assert.equal(hasCadernoLocalizacao({ localizacao_latitude: 10 }), false);
  });

  await test('accuracy null é apresentada como não informada', () => {
    const presentation = getCadernoLocalizacaoPresentation(validLocation({
      localizacao_accuracy: null,
    }));

    assert.equal(presentation.accuracyText, 'Precisão não informada');
    assert.equal(presentation.accuracyValueText, 'Não informado');
    assert.equal(presentation.lowAccuracy, false);
  });

  await test('somente accuracy maior que 50 produz baixa precisão', () => {
    assert.equal(isCadernoLocalizacaoLowAccuracy(validLocation({ localizacao_accuracy: 50 })), false);
    assert.equal(isCadernoLocalizacaoLowAccuracy(validLocation({ localizacao_accuracy: 50.01 })), true);
    assert.equal(isCadernoLocalizacaoLowAccuracy(validLocation({ localizacao_accuracy: null })), false);
    assert.equal(
      getCadernoLocalizacaoPresentation(validLocation({ localizacao_accuracy: 80 })).lowAccuracy,
      true
    );
  });

  await test('mudança real de Propriedade descarta draft; mesma Propriedade não', () => {
    assert.equal(shouldDiscardCadernoLocalizacaoDraftForPropertyChange('faz_1', 'faz_1'), false);
    assert.equal(shouldDiscardCadernoLocalizacaoDraftForPropertyChange(' faz_1 ', 'faz_1'), false);
    assert.equal(shouldDiscardCadernoLocalizacaoDraftForPropertyChange('faz_1', 'faz_2'), true);
    assert.equal(shouldDiscardCadernoLocalizacaoDraftForPropertyChange('faz_1', null), true);
    assert.equal(shouldDiscardCadernoLocalizacaoDraftForPropertyChange(null, 'faz_2'), false);
    assert.equal(
      CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE,
      'A localização foi removida porque a Propriedade do registro foi alterada. Capture uma nova posição se desejar.'
    );
  });

  await test('erros do serviço são mapeados para mensagens controladas', () => {
    assert.equal(
      getCadernoLocalizacaoCaptureErrorMessage('permission_denied'),
      CADERNO_LOCALIZACAO_PERMISSION_DENIED_MESSAGE
    );
    assert.equal(
      getCadernoLocalizacaoCaptureErrorMessage('services_disabled'),
      CADERNO_LOCALIZACAO_SERVICES_DISABLED_MESSAGE
    );
    assert.equal(
      getCadernoLocalizacaoCaptureErrorMessage('unavailable'),
      CADERNO_LOCALIZACAO_UNAVAILABLE_MESSAGE
    );
    assert.equal(getCadernoLocalizacaoCaptureErrorMessage('error'), CADERNO_LOCALIZACAO_ERROR_MESSAGE);
    assert.equal(getCadernoLocalizacaoCaptureErrorMessage('desconhecido'), CADERNO_LOCALIZACAO_ERROR_MESSAGE);
  });

  await test('erro de captura permite compor Caderno comum sem ponto', () => {
    ['permission_denied', 'services_disabled', 'unavailable', 'error'].forEach((status) => {
      assert.ok(getCadernoLocalizacaoCaptureErrorMessage(status));
      const payload = appendCadernoLocalizacaoDraft({ fazenda_id: 'faz_1' }, null);
      assert.deepEqual(locationKeys(payload), []);
    });
  });

  await test('resposta só é aceita se componente estiver montado e request ainda for atual', () => {
    assert.equal(shouldAcceptCadernoLocalizacaoCaptureResponse(true, 2, 2), true);
    assert.equal(shouldAcceptCadernoLocalizacaoCaptureResponse(true, 2, 1), false);
    assert.equal(shouldAcceptCadernoLocalizacaoCaptureResponse(false, 2, 2), false);
    assert.equal(shouldAcceptCadernoLocalizacaoCaptureResponse(true, Number.NaN, Number.NaN), false);
  });

  await test('helper de UI é puro e não captura, persiste, navega ou cria timestamp automaticamente', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/utils/cadernoLocalizacaoUiCompat.ts'),
      'utf8'
    );

    assert.equal(/react|react-native|expo-location|requestCurrentForegroundLocation/i.test(source), false);
    assert.equal(/AsyncStorage|api\/mock|CadernoCampo\.(create|update)|navigation/i.test(source), false);
    assert.equal(/console\.(log|warn|error)/.test(source), false);
    assert.equal(/new Date\(\)/.test(source), false);
    assert.equal(/@tche:/.test(source), false);
  });

  await test('seção mantém recaptura explícita disponível depois de um draft pronto', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/components/CadernoLocalizacaoSection.tsx'),
      'utf8'
    );

    assert.match(source, /: displayedLocation\s*\? 'Atualizar usando posição atual'/);
    assert.match(source, /\{displayedLocation \? \(\s*<TouchableOpacity[\s\S]*?onPress=\{onCapture\}/);
  });

  await test('telas delegam captura somente aos handlers explícitos da seção', () => {
    const novoSource = fs.readFileSync(
      path.join(__dirname, '..', 'src/screens/NovoCadernoScreen.tsx'),
      'utf8'
    );
    const editarSource = fs.readFileSync(
      path.join(__dirname, '..', 'src/screens/EditarCadernoScreen.tsx'),
      'utf8'
    );

    [novoSource, editarSource].forEach((source) => {
      assert.equal(/from ['"]expo-location['"]|AsyncStorage/.test(source), false);
      assert.equal(/requestCurrentForegroundLocation/.test(source), false);
      assert.equal(/coords|altitudeAccuracy|\bspeed\b|\bheading\b/.test(source), false);
      assert.equal((source.match(/captureLocalizacao\(/g) || []).length, 1);
      assert.match(source, /onCapture=\{\(\) => \{[\s\S]*?captureLocalizacao\(/);
    });
  });

  await test('edição invalida carregamentos antigos no blur e antes de aplicar respostas assíncronas', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/screens/EditarCadernoScreen.tsx'),
      'utf8'
    );

    assert.match(source, /editLoadGenerationRef = useRef\(0\)/);
    assert.match(source, /const loadGeneration = \+\+editLoadGenerationRef\.current/);
    assert.match(source, /editLoadGenerationRef\.current === loadGeneration[\s\S]*?editLoadGenerationRef\.current \+= 1/);
    assert.match(source, /Promise\.all\([\s\S]*?if \(editLoadGenerationRef\.current !== loadGeneration\) return;[\s\S]*?setLocalizacaoState/);
    assert.match(source, /listActivePeriodosProdutivosByPropriedade[\s\S]*?if \(editLoadGenerationRef\.current !== loadGeneration\) return;[\s\S]*?setPeriodosProdutivos/);
    assert.match(source, /loadPeriodosProdutivos\(contextoFazendaId, periodoAtualId, loadGeneration\)/);
  });

  await test('hook protege montagem, duplo toque, cancelamento e resposta antiga sem persistir', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/hooks/useCadernoLocalizacaoCapture.ts'),
      'utf8'
    );

    assert.match(source, /mountedRef/);
    assert.match(source, /inFlightRef/);
    assert.match(source, /requestIdRef/);
    assert.match(source, /isCapturePending/);
    assert.match(source, /requestIdRef\.current === requestId/);
    assert.equal(/CadernoCampo\.(create|update)|AsyncStorage|console\.(log|warn|error)/.test(source), false);
    assert.equal(/new Date\(/.test(source), false);
  });

  await test('serviço limita espera do provider e mantém timeout como unavailable', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src/services/LocationForegroundService.ts'),
      'utf8'
    );

    assert.match(source, /POSITION_REQUEST_TIMEOUT_MS/);
    assert.match(source, /withTimeout\(/);
    assert.match(source, /positionTimeoutMs/);
    assert.match(source, /Accuracy\?\.Highest/);
    assert.match(source, /status: 'unavailable'/);
    assert.equal(/getLastKnownPositionAsync/.test(source), false);
    assert.equal(/watchPosition|startLocationUpdates|TaskManager|geofence/i.test(source), false);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam; ${passed} passaram.`);
  } else {
    console.log(`\nTodos os ${passed} testes de cadernoLocalizacaoUiCompat passaram.`);
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
