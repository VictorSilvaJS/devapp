const assert = require('node:assert/strict');
const test = require('node:test');

const {
  prepareCreateAdministrativeAreaTotal,
  preparePatchAdministrativeAreaTotal,
  validateAdministrativeAreaTotal,
  InvalidAdministrativeAreaError,
} = require('../.tmp-mp35d1/src/http/administrativeArea');
const {
  ApiResponseError,
  BackendApi,
} = require('../.tmp-mp35d1/src/http/backendApi');
const {
  decodeAdministrativeProperty,
  decodeAdministrativeReceipt,
  decodeOpaqueCursor,
  decodePositiveVersion,
  decodeTimestamp,
  InvalidBackendResponseError,
} = require('../.tmp-mp35d1/src/http/decoders');
const {
  FetchHttpTransport,
} = require('../.tmp-mp35d1/src/http/httpTransport');

const ACCESS_TOKEN = 'A'.repeat(43);
const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RESOURCE_ID = '33333333-3333-4333-8333-333333333333';

function administrativeProperty(overrides = {}) {
  return {
    id: PROPERTY_ID,
    organizacao_id: 'org_tche_fertilidade',
    titular_id: OWNER_ID,
    titular: { id: OWNER_ID, nome: 'Titular' },
    nome: 'Propriedade HTTP',
    municipio_id: '4305108',
    municipio_nome: 'Caxias do Sul',
    uf_id: '43',
    uf_sigla: 'RS',
    area_total: 1.2300,
    cultura_principal: 'Soja',
    status: 'ativa',
    tipo_acesso: 'admin',
    versao: 7,
    criado_em: '2026-08-31T12:00:00.000Z',
    atualizado_em: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function errorBody(code, details = []) {
  return {
    error: {
      code,
      message: 'texto remoto com email@example.test que não pode propagar',
      request_id: 'req_11111111-1111-4111-8111-111111111111',
      details,
    },
  };
}

function apiReturning(status, body, capture) {
  return new BackendApi({
    baseUrl: 'https://api.tcheagro.example',
    transport: {
      async send(request) {
        if (capture) capture(request);
        return { status, body };
      },
    },
  });
}

test('area_total de escrita permanece decimal textual exato e null só limpa PATCH', () => {
  for (const value of ['0.0001', '1', '1.2300', '9999999999.9999']) {
    assert.equal(validateAdministrativeAreaTotal(value), value);
  }
  assert.equal(prepareCreateAdministrativeAreaTotal(undefined), undefined);
  assert.equal(preparePatchAdministrativeAreaTotal(undefined), undefined);
  assert.equal(preparePatchAdministrativeAreaTotal(null), null);
  assert.throws(
    () => prepareCreateAdministrativeAreaTotal(null),
    InvalidAdministrativeAreaError,
  );
  for (const invalid of [
    1.25,
    '0',
    '0.0000',
    '01',
    '1.00000',
    '10000000000',
    ' 1.25',
    '1e3',
  ]) {
    assert.throws(
      () => validateAdministrativeAreaTotal(invalid),
      InvalidAdministrativeAreaError,
    );
  }
});

test('decoder administrativo exige versão e timestamps sem fingir decimal exato de leitura', () => {
  const property = decodeAdministrativeProperty(administrativeProperty());
  assert.equal(property.versao, 7);
  assert.equal(property.criado_em, '2026-08-31T12:00:00.000Z');
  assert.equal(property.atualizado_em, '2026-09-01T12:00:00.000Z');
  assert.equal(typeof property.area_total, 'number');

  assert.throws(
    () => decodeAdministrativeProperty(administrativeProperty({ versao: 0 })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeAdministrativeProperty(administrativeProperty({ extra: true })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeAdministrativeProperty(administrativeProperty({
      atualizado_em: '2026-08-30T12:00:00.000Z',
    })),
    InvalidBackendResponseError,
  );
});

test('recibos administrativos aceitam somente combinações e campos fechados', () => {
  assert.deepEqual(decodeAdministrativeReceipt({
    resultado: 'criado',
    recurso_tipo: 'usuario',
    recurso_id: RESOURCE_ID,
    versao: 1,
  }), {
    resultado: 'criado',
    recurso_tipo: 'usuario',
    recurso_id: RESOURCE_ID,
    versao: 1,
  });
  assert.deepEqual(decodeAdministrativeReceipt({
    resultado: 'vinculos_alterados',
    recurso_tipo: 'vinculo',
    recurso_id: RESOURCE_ID,
    versao: 8,
  }), {
    resultado: 'vinculos_alterados',
    recurso_tipo: 'vinculo',
    recurso_id: RESOURCE_ID,
    versao: 8,
  });
  assert.deepEqual(decodeAdministrativeReceipt({
    resultado: 'convite_emitido',
    recurso_tipo: 'convite',
    recurso_id: RESOURCE_ID,
  }), {
    resultado: 'convite_emitido',
    recurso_tipo: 'convite',
    recurso_id: RESOURCE_ID,
  });
  for (const invalid of [
    { resultado: 'convite_emitido', recurso_tipo: 'convite', recurso_id: RESOURCE_ID, versao: 1 },
    { resultado: 'vinculos_alterados', recurso_tipo: 'usuario', recurso_id: RESOURCE_ID, versao: 1 },
    { resultado: 'atualizado', recurso_tipo: 'usuario', recurso_id: RESOURCE_ID },
    { resultado: 'criado', recurso_tipo: 'usuario', recurso_id: RESOURCE_ID, versao: 1, email: 'x@y.test' },
  ]) {
    assert.throws(() => decodeAdministrativeReceipt(invalid), InvalidBackendResponseError);
  }
});

test('versão, timestamp e cursor opaco falham fechados', () => {
  assert.equal(decodePositiveVersion(1), 1);
  for (const valid of [
    '2000-02-29T00:00:00.000Z',
    '2024-02-29T00:00:00.000Z',
    '2026-02-28T23:59:59.999Z',
    '2026-04-30T12:30:45.001Z',
    '2026-01-31T00:00:00.000Z',
  ]) {
    assert.equal(decodeTimestamp(valid), valid);
  }
  assert.equal(decodeOpaqueCursor('cursor-opaco'), 'cursor-opaco');
  assert.equal(decodeOpaqueCursor(null), null);
  for (const invalid of [0, -1, 1.5, '1']) {
    assert.throws(() => decodePositiveVersion(invalid), InvalidBackendResponseError);
  }
  for (const invalid of [
    '0000-01-01T00:00:00.000Z',
    '1900-02-29T00:00:00.000Z',
    '2026-02-29T12:00:00.000Z',
    '2026-02-30T12:00:00.000Z',
    '2026-04-31T12:00:00.000Z',
    '2026-00-01T12:00:00.000Z',
    '2026-13-01T12:00:00.000Z',
    '2026-01-00T12:00:00.000Z',
    '2026-01-01T24:00:00.000Z',
    '2026-01-01T12:60:00.000Z',
    '2026-01-01T12:00:60.000Z',
    '2026-09-01',
    '2026-09-01T12:00:00Z',
    '2026-09-01T12:00:00.000+00:00',
    '2026-09-01T12:00:00.000Zx',
    ' 2026-09-01T12:00:00.000Z',
    '2026-09-01T12:00:00.000Z\n',
    'data',
  ]) {
    assert.throws(() => decodeTimestamp(invalid), InvalidBackendResponseError);
  }
  for (const invalid of ['', 'x'.repeat(2_049), 1, undefined]) {
    assert.throws(() => decodeOpaqueCursor(invalid), InvalidBackendResponseError);
  }
});

test('cliente representa separadamente todos os códigos administrativos', async () => {
  const cases = [
    [400, 'invalid_request'],
    [401, 'invalid_session'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'version_conflict'],
    [409, 'idempotency_conflict'],
    [409, 'business_rule_conflict'],
    [422, 'validation_error'],
    [503, 'service_unavailable'],
  ];
  for (const [status, code] of cases) {
    const details = code === 'version_conflict'
      ? [{ current_version: 8 }]
      : code === 'validation_error'
        ? [{ field: 'area_total', code: 'invalid' }]
        : undefined;
    await assert.rejects(
      apiReturning(status, errorBody(code, details ?? [])).getProperty(
        ACCESS_TOKEN,
        PROPERTY_ID,
      ),
      (error) => {
        assert.ok(error instanceof ApiResponseError);
        assert.equal(error.status, status);
        assert.equal(error.code, code);
        assert.equal(error.requestId, 'req_11111111-1111-4111-8111-111111111111');
        assert.deepEqual(error.details, details);
        assert.equal(error.message.includes('email@example.test'), false);
        return true;
      },
    );
  }
});

test('request_id aceita somente req_ seguido de UUID v4 canônico do backend', async () => {
  const legitimate = 'req_11111111-1111-4111-8111-111111111111';
  const rejected = [
    '11111111-1111-4111-8111-111111111111',
    'req_ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF',
    'req_11111111-1111-5111-8111-111111111111',
    'req_11111111-1111-4111-7111-111111111111',
    `x${legitimate}`,
    `${legitimate}x`,
    legitimate.slice(0, -1),
    'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-ABCDE',
    '12345678901',
    'SenhaAlfanumerica123',
    'admin_11111111111141118111111111111111',
    'x'.repeat(300),
    ` ${legitimate}`,
    `${legitimate}\n`,
    `req_11111111-1111-4111-8111-11111111111\u0000`,
  ];
  await assert.rejects(
    apiReturning(409, errorBody('version_conflict', [{ current_version: 2 }]))
      .getProperty(ACCESS_TOKEN, PROPERTY_ID),
    (error) => error instanceof ApiResponseError &&
      error.code === 'version_conflict' &&
      error.requestId === legitimate,
  );
  for (const requestId of rejected) {
    const body = errorBody('version_conflict', [{ current_version: 2 }]);
    body.error.request_id = requestId;
    await assert.rejects(
      apiReturning(409, body).getProperty(ACCESS_TOKEN, PROPERTY_ID),
      (error) => error instanceof ApiResponseError &&
        error.code === 'version_conflict' &&
        error.requestId === undefined &&
        error.message.includes(requestId) === false &&
        JSON.stringify(error.details).includes(requestId) === false,
    );
  }
});

test('details usa o wire em array e aplica allowlist item a item na ordem original', async () => {
  const cases = [
    ['version_conflict', [{ current_version: 9 }], [{ current_version: 9 }]],
    ['validation_error', [{ field: 'area_total', code: 'invalid' }],
      [{ field: 'area_total', code: 'invalid' }]],
    ['version_conflict', [{
      current_version: 9,
      password: 'segredo',
      token: 'segredo',
      unknown: 'segredo',
    }], [{ current_version: 9 }]],
    ['validation_error', [{
      field: 'area_total',
      code: 'invalid',
      password: 'segredo',
      senha: 'segredo',
      token: 'segredo',
      documento: '12345678901',
      email: 'segredo@example.test',
      'e-mail': 'segredo@example.test',
      idempotencyKey: 'segredo',
      'Idempotency-Key': 'segredo',
      message: 'mensagem remota',
      unknown: 'segredo',
    }], [{ field: 'area_total', code: 'invalid' }]],
    ['validation_error', [
      { field: 'area_total', code: 'invalid' },
      null,
      'item inválido',
      { password: 'segredo', token: 'segredo', documento: '12345678901' },
      { field: 'municipio_id', code: 'required' },
      7,
    ], [
      { field: 'area_total', code: 'invalid' },
      { field: 'municipio_id', code: 'required' },
    ]],
    ['version_conflict', [
      { current_version: '9' },
      { token: 'segredo' },
      null,
    ], undefined],
  ];
  for (const [code, details, expected] of cases) {
    const status = code === 'version_conflict' ? 409 : 422;
    await assert.rejects(
      apiReturning(status, errorBody(code, details)).getProperty(ACCESS_TOKEN, PROPERTY_ID),
      (error) => error instanceof ApiResponseError &&
        error.code === code &&
        assert.deepEqual(error.details, expected) === undefined,
    );
  }
});

test('details incompatível ou vazio é descartado sem perder o código conhecido', async () => {
  for (const details of [
    { current_version: 9 },
    null,
    'texto',
    9,
    { field: 'area_total', code: 'invalid' },
    [],
  ]) {
    await assert.rejects(
      apiReturning(409, errorBody('version_conflict', details))
        .getProperty(ACCESS_TOKEN, PROPERTY_ID),
      (error) => error instanceof ApiResponseError &&
        error.code === 'version_conflict' &&
        error.details === undefined,
    );
  }

  for (const [status, code] of [
    [401, 'invalid_session'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'idempotency_conflict'],
    [409, 'business_rule_conflict'],
    [503, 'service_unavailable'],
  ]) {
    await assert.rejects(
      apiReturning(status, errorBody(code, [{
        current_version: 3,
        email: 'segredo@example.test',
        token: 'segredo',
      }])).getProperty(ACCESS_TOKEN, PROPERTY_ID),
      (error) => error instanceof ApiResponseError &&
        error.code === code &&
        error.details === undefined,
    );
  }
});

test('ApiResponseError copia e congela a lista e cada item de details', () => {
  const sourceItem = { field: 'area_total', code: 'invalid' };
  const sourceDetails = [sourceItem];
  const error = new ApiResponseError({
    status: 422,
    code: 'validation_error',
    requestId: 'req_11111111-1111-4111-8111-111111111111',
    details: sourceDetails,
  });

  assert.notStrictEqual(error.details, sourceDetails);
  assert.notStrictEqual(error.details[0], sourceItem);
  assert.equal(Object.isFrozen(error.details), true);
  assert.equal(Object.isFrozen(error.details[0]), true);

  sourceItem.field = 'nome';
  sourceDetails.push({ field: 'nome', code: 'required' });
  assert.deepEqual(error.details, [{ field: 'area_total', code: 'invalid' }]);
  assert.throws(
    () => error.details.push({ field: 'nome', code: 'required' }),
    TypeError,
  );
  assert.equal(Reflect.set(error.details[0], 'field', 'nome'), false);
  assert.deepEqual(error.details, [{ field: 'area_total', code: 'invalid' }]);
});

test('código de erro desconhecido continua falhando fechado', async () => {
  await assert.rejects(
    apiReturning(409, errorBody('codigo_desconhecido', [{ current_version: 2 }]))
      .getProperty(ACCESS_TOKEN, PROPERTY_ID),
    (error) => error instanceof ApiResponseError &&
      error.code === 'unexpected_response' &&
      error.requestId === undefined &&
      error.details === undefined,
  );
});

test('sucesso 2xx incompatível falha fechado', async () => {
  await assert.rejects(
    apiReturning(200, { id: PROPERTY_ID }).getProperty(ACCESS_TOKEN, PROPERTY_ID),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeAdministrativeReceipt({ resultado: 'criado' }),
    InvalidBackendResponseError,
  );
});

test('query usa encoding canônico do URLSearchParams', async () => {
  let captured;
  const api = apiReturning(200, {
    itens: [],
    paginacao: { proximo_cursor: null },
  }, (request) => {
    captured = request;
  });
  await api.listProperties(ACCESS_TOKEN, {
    busca: 'Nome & Filhos',
    status: 'ativa',
    limite: 50,
    cursor: 'abc+/=',
  });
  assert.match(captured.url, /busca=Nome\+%26\+Filhos/);
  assert.match(captured.url, /cursor=abc%2B%2F%3D/);
  assert.equal(captured.method, 'GET');
});

test('transporte envia PATCH com o mesmo corpo decimal e a mesma chave', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, init) => {
    captured = { url, init };
    return {
      status: 200,
      headers: { get() { return null; } },
      async text() { return '{}'; },
    };
  };
  try {
    const transport = new FetchHttpTransport();
    await transport.send({
      method: 'PATCH',
      url: `https://api.tcheagro.example/v1/propriedades/${PROPERTY_ID}`,
      accessToken: ACCESS_TOKEN,
      idempotencyKey: 'admin_11111111111141118111111111111111',
      body: { versao: 7, area_total: '1.2300' },
      timeoutMs: 1_000,
    });
    assert.equal(captured.init.method, 'PATCH');
    assert.equal(captured.init.headers['idempotency-key'], 'admin_11111111111141118111111111111111');
    assert.equal(captured.init.body, '{"versao":7,"area_total":"1.2300"}');
  } finally {
    global.fetch = originalFetch;
  }
});
