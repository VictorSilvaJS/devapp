const assert = require('node:assert/strict');
const test = require('node:test');

const {
  decodeProperty,
  decodePropertyPage,
  decodeRemoteSessions,
  decodeTokenResponse,
  InvalidBackendResponseError,
} = require('../.tmp-mp33c/src/http/decoders');
const { createHttpRuntimeConfig } = require('../.tmp-mp33c/src/http/config');
const { parseAccountActionLink } = require('../.tmp-mp33c/src/http/actionLinks');
const { actionNavigationTarget } = require('../.tmp-mp33c/src/http/actionNavigation');
const {
  ApiResponseError,
  BackendApi,
} = require('../.tmp-mp33c/src/http/backendApi');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'A'.repeat(43);

function tokenResponse(overrides = {}) {
  return {
    access_token: TOKEN,
    refresh_token: 'B'.repeat(43),
    token_type: 'Bearer',
    expires_in: 900,
    emitido_em: '2026-08-21T12:00:00.000Z',
    access_expira_em: '2026-08-21T12:15:00.000Z',
    sessao: {
      id: SESSION_ID,
      expira_inatividade_em: '2026-09-04T12:00:00.000Z',
      expira_absolutamente_em: '2026-09-20T12:00:00.000Z',
    },
    usuario: {
      id: USER_ID,
      organizacao_id: 'org_tche_fertilidade',
      nome: 'Usuário HTTP',
      email: 'usuario@example.com',
      perfil: 'admin',
      status: 'ativo',
      versao_autorizacao: 3,
    },
    escopo: { modo: 'organizacao', versao: 3 },
    ...overrides,
  };
}

function property(overrides = {}) {
  return {
    id: PROPERTY_ID,
    organizacao_id: 'org_tche_fertilidade',
    titular_id: OWNER_ID,
    titular: { id: OWNER_ID, nome: 'Produtor Titular' },
    nome: 'Sela de Prata',
    municipio_id: '4306106',
    municipio_nome: 'Cruz Alta',
    uf_id: '43',
    uf_sigla: 'RS',
    area_total: null,
    cultura_principal: null,
    status: 'ativa',
    tipo_acesso: 'admin',
    ...overrides,
  };
}

test('token response exige tempos do servidor e identidade coerente', () => {
  const decoded = decodeTokenResponse(tokenResponse());
  assert.equal(decoded.id, SESSION_ID);
  assert.equal(decoded.access_expira_em, '2026-08-21T12:15:00.000Z');

  assert.throws(
    () => decodeTokenResponse(tokenResponse({ access_expira_em: undefined })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeTokenResponse(tokenResponse({ escopo: { modo: 'organizacao', versao: 2 } })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeTokenResponse(tokenResponse({
      usuario: { ...tokenResponse().usuario, perfil: 'produtor' },
    })),
    InvalidBackendResponseError,
  );
});

test('property decoder aceita null explícito e rejeita ausência/inconsistência', () => {
  const decoded = decodeProperty(property());
  assert.equal(decoded.area_total, null);
  assert.equal(decoded.cultura_principal, null);

  const missingArea = property();
  delete missingArea.area_total;
  assert.throws(() => decodeProperty(missingArea), InvalidBackendResponseError);
  assert.throws(
    () => decodeProperty(property({ area_total: 0 })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeProperty(property({ titular: { id: USER_ID, nome: 'Outro' } })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeProperty(property({ uf_sigla: 'rs' })),
    InvalidBackendResponseError,
  );
});

test('paginação exige cursor não vazio e campos obrigatórios', () => {
  const page = decodePropertyPage({
    itens: [property()],
    paginacao: { proximo_cursor: 'cursor-seguro' },
  });
  assert.equal(page.itens.length, 1);
  assert.equal(page.paginacao.proximo_cursor, 'cursor-seguro');
  assert.throws(
    () => decodePropertyPage({ itens: [], paginacao: { proximo_cursor: '' } }),
    InvalidBackendResponseError,
  );
});

test('sessões remotas são decodificadas em fail-closed', () => {
  const sessions = decodeRemoteSessions({
    sessoes: [{
      id: SESSION_ID,
      criada_em: '2026-08-20T12:00:00.000Z',
      ultima_renovacao_em: '2026-08-21T12:00:00.000Z',
      expira_em: '2026-09-20T12:00:00.000Z',
      atual: true,
    }],
  });
  assert.equal(sessions[0].atual, true);
  assert.throws(
    () => decodeRemoteSessions({ sessoes: [{ id: 'não-uuid' }] }),
    InvalidBackendResponseError,
  );
});

test('configuração HTTP insegura só existe em development e loopback', () => {
  assert.throws(() => createHttpRuntimeConfig({
    appVariant: 'http',
    apiBaseUrl: 'http://localhost:3000',
    actionBaseUrl: 'http://localhost:3000/acoes',
    allowInsecureDevelopmentHttp: true,
    isDevelopment: false,
  }));
  assert.throws(() => createHttpRuntimeConfig({
    appVariant: 'http',
    apiBaseUrl: 'http://192.168.1.20:3000',
    actionBaseUrl: 'http://192.168.1.20:3000/acoes',
    allowInsecureDevelopmentHttp: true,
    isDevelopment: true,
  }));
  assert.equal(createHttpRuntimeConfig({
    appVariant: 'http',
    apiBaseUrl: 'http://10.0.2.2:3000',
    actionBaseUrl: 'http://10.0.2.2:3000/acoes',
    allowInsecureDevelopmentHttp: true,
    isDevelopment: true,
  }).apiBaseUrl, 'http://10.0.2.2:3000');
});

test('links aceitam somente base e ações self-service allowlisted', () => {
  const base = 'https://conta.tcheagro.example/acoes';
  const parsed = parseAccountActionLink(
    `${base}#action=accept-invitation&token=${TOKEN}`,
    base,
  );
  assert.deepEqual(parsed, { action: 'accept-invitation', token: TOKEN });
  assert.deepEqual(actionNavigationTarget(parsed), { name: 'AcceptInvitation' });
  assert.equal('token' in actionNavigationTarget(parsed), false);

  assert.equal(parseAccountActionLink(
    `${base}#action=confirm-admin-break-glass-email&token=${TOKEN}`,
    base,
  ), null);
  assert.equal(parseAccountActionLink(
    `${base}#action=confirm-assisted-recovery-email&token=${TOKEN}`,
    base,
  ).action, 'confirm-assisted-recovery-email');
  assert.equal(parseAccountActionLink(
    `https://evil.example/acoes#action=accept-invitation&token=${TOKEN}`,
    base,
  ), null);
  assert.equal(parseAccountActionLink(
    `${base}?route=mock#action=accept-invitation&token=${TOKEN}`,
    base,
  ), null);
  assert.equal(parseAccountActionLink(
    `${base}#action=accept-invitation&token=${TOKEN}&token=${TOKEN}`,
    base,
  ), null);
});

function errorBody(code) {
  return {
    error: {
      code,
      message: 'texto remoto não confiável',
      request_id: 'request-1',
      details: [],
    },
  };
}

function apiReturning(status, body) {
  return new BackendApi({
    baseUrl: 'https://api.tcheagro.example',
    transport: { async send() { return { status, body }; } },
  });
}

test('401 usa allowlist por operação e nunca propaga mensagem remota', async () => {
  await assert.rejects(
    apiReturning(401, errorBody('invalid_credentials')).login('a@b.com', 'x'),
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_credentials' &&
      !error.message.includes('texto remoto'),
  );

  await assert.rejects(
    apiReturning(401, errorBody('invalid_credentials')).me(TOKEN),
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_session',
  );

  await assert.rejects(
    apiReturning(401, errorBody('codigo_inventado')).login('a@b.com', 'x'),
    (error) => error instanceof ApiResponseError &&
      error.code === 'invalid_session',
  );
});

test('status 2xx inesperado é resposta incompatível, não sucesso silencioso', async () => {
  await assert.rejects(
    apiReturning(200, undefined).completePasswordRecovery(TOKEN, 'Senha1234'),
    InvalidBackendResponseError,
  );
  await assert.rejects(
    apiReturning(204, { inesperado: true }).completePasswordRecovery(
      TOKEN,
      'Senha1234',
    ),
    InvalidBackendResponseError,
  );
});
