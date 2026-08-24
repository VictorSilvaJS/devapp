const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BackendApi,
} = require('../.tmp-mp34/src/http/backendApi');
const {
  decodeNotification,
  decodeNotificationDestination,
  decodeNotificationDiscardResult,
  decodeNotificationPage,
  decodeNotificationReadAllResult,
  decodeNotificationReadResult,
  decodeNotificationUnreadCount,
  InvalidBackendResponseError,
} = require('../.tmp-mp34/src/http/decoders');
const {
  FetchHttpTransport,
} = require('../.tmp-mp34/src/http/httpTransport');
const {
  createNotificationIdempotencyKey,
  isNotificationIdempotencyKey,
} = require('../.tmp-mp34/src/http/idempotencyKey');

const ACCESS_TOKEN = 'A'.repeat(43);
const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = '2026-08-24T12:00:00.000Z';
const READ_AT = '2026-08-24T12:05:00.000Z';
const EXPIRES_AT = '2026-11-22T12:00:00.000Z';
const IDEMPOTENCY_KEY = 'notif_retry_key_0000000000000001';

function notification(overrides = {}) {
  const base = {
    id: NOTIFICATION_ID,
    tipo_evento: 'conta.senha_alterada.v1',
    prioridade: 'alta',
    criada_em: CREATED_AT,
    lida_em: null,
    expira_em: EXPIRES_AT,
    recurso_tipo: 'conta',
    recurso_id: USER_ID,
    conteudo: {
      titulo: 'Senha alterada',
      resumo: 'A senha da sua conta foi alterada.',
    },
  };
  return {
    ...base,
    ...overrides,
    conteudo: overrides.conteudo ?? base.conteudo,
  };
}

function notificationPage(overrides = {}) {
  return {
    itens: [notification()],
    paginacao: { proximo_cursor: null },
    ...overrides,
  };
}

test('decoder aceita somente o catálogo inicial e todas as prioridades aprovadas', () => {
  const eventTypes = {
    'conta.senha_alterada.v1': {
      titulo: 'Senha alterada',
      resumo: 'A senha da sua conta foi alterada.',
    },
    'conta.email_principal_alterado.v1': {
      titulo: 'E-mail principal alterado',
      resumo: 'O e-mail principal da sua conta foi alterado.',
    },
    'conta.recuperacao_concluida.v1': {
      titulo: 'Recuperação concluída',
      resumo: 'A recuperação da sua conta foi concluída.',
    },
  };
  const priorities = ['baixa', 'normal', 'alta'];

  for (const [tipo_evento, conteudo] of Object.entries(eventTypes)) {
    for (const prioridade of priorities) {
      const decoded = decodeNotification(notification({
        tipo_evento,
        prioridade,
        conteudo,
      }));
      assert.equal(decoded.tipo_evento, tipo_evento);
      assert.equal(decoded.prioridade, prioridade);
      assert.equal(decoded.recurso_tipo, 'conta');
      assert.equal(decoded.recurso_id, USER_ID);
    }
  }
});

test('decoder projeta apenas o conteúdo seguro e nunca expõe metadados internos', () => {
  const decoded = decodeNotification(notification({
    destinatario_usuario_id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    email: 'nao-deve-sair@example.com',
    token: 'segredo',
    payload_interno: { livre: true },
    conteudo: {
      titulo: 'Senha alterada',
      resumo: 'A senha da sua conta foi alterada.',
      html: '<strong>não permitido</strong>',
      url: 'https://nao-permitido.example',
    },
  }));

  assert.deepEqual(Object.keys(decoded).sort(), [
    'conteudo',
    'criada_em',
    'expira_em',
    'id',
    'lida_em',
    'prioridade',
    'recurso_id',
    'recurso_tipo',
    'tipo_evento',
  ]);
  assert.deepEqual(decoded.conteudo, {
    titulo: 'Senha alterada',
    resumo: 'A senha da sua conta foi alterada.',
  });
  assert.equal('destinatario_usuario_id' in decoded, false);
  assert.equal('organizacao_id' in decoded, false);
  assert.equal('token' in decoded, false);
});

test('decoder falha fechado para evento, recurso, UUID e prioridade fora da allowlist', () => {
  const invalid = [
    notification({ tipo_evento: 'propriedade.criada.v1' }),
    notification({ tipo_evento: 'conta.senha_alterada' }),
    notification({ recurso_tipo: 'propriedade' }),
    notification({ id: 'notificacao-previsivel' }),
    notification({ recurso_id: 'usuario-previsivel' }),
    notification({ prioridade: 'urgente' }),
  ];

  for (const payload of invalid) {
    assert.throws(
      () => decodeNotification(payload),
      InvalidBackendResponseError,
    );
  }
});

test('decoder valida datas, limites e o template exato versionado', () => {
  const invalid = [
    notification({ criada_em: 'data-invalida' }),
    notification({ expira_em: CREATED_AT }),
    notification({ expira_em: '2026-08-24T11:59:59.999Z' }),
    notification({ lida_em: '2026-08-24T11:59:59.999Z' }),
    notification({ conteudo: { titulo: '', resumo: 'Resumo' } }),
    notification({
      conteudo: {
        titulo: 'Senha alterada',
        resumo: 'Conteúdo arbitrário mesmo dentro do limite.',
      },
    }),
    notification({
      tipo_evento: 'conta.recuperacao_concluida.v1',
      conteudo: {
        titulo: 'Senha alterada',
        resumo: 'A senha da sua conta foi alterada.',
      },
    }),
    notification({
      conteudo: { titulo: 'T'.repeat(121), resumo: 'Resumo' },
    }),
    notification({
      conteudo: { titulo: 'Título', resumo: 'R'.repeat(501) },
    }),
  ];

  for (const payload of invalid) {
    assert.throws(
      () => decodeNotification(payload),
      InvalidBackendResponseError,
    );
  }

  const valid = decodeNotification(notification({
    lida_em: READ_AT,
  }));
  assert.ok(valid.conteudo.titulo.length <= 120);
  assert.ok(valid.conteudo.resumo.length <= 500);
  assert.equal(valid.lida_em, READ_AT);
});

test('página, cursor e contador recusam limites incompatíveis', () => {
  assert.equal(decodeNotificationPage(notificationPage()).itens.length, 1);
  assert.equal(
    decodeNotificationPage(notificationPage({
      paginacao: { proximo_cursor: 'cursor-opaco' },
    })).paginacao.proximo_cursor,
    'cursor-opaco',
  );

  assert.throws(
    () => decodeNotificationPage(notificationPage({
      itens: Array.from({ length: 101 }, () => notification()),
    })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeNotificationPage(notificationPage({
      paginacao: { proximo_cursor: '' },
    })),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeNotificationPage(notificationPage({
      paginacao: { proximo_cursor: 'C'.repeat(32_769) },
    })),
    InvalidBackendResponseError,
  );

  assert.equal(
    decodeNotificationUnreadCount({ total_nao_lidas: 0 }).total_nao_lidas,
    0,
  );
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => decodeNotificationUnreadCount({ total_nao_lidas: value }),
      InvalidBackendResponseError,
    );
  }
});

test('decoders de comandos e destino exigem IDs, datas e contagens canônicas', () => {
  assert.deepEqual(decodeNotificationReadResult({
    id: NOTIFICATION_ID,
    lida_em: READ_AT,
  }), {
    id: NOTIFICATION_ID,
    lida_em: READ_AT,
  });
  assert.deepEqual(decodeNotificationReadAllResult({
    corte_em: READ_AT,
    atualizadas: 2,
  }), {
    corte_em: READ_AT,
    atualizadas: 2,
  });
  assert.deepEqual(decodeNotificationDiscardResult({
    id: NOTIFICATION_ID,
    descartada_em: READ_AT,
  }), {
    id: NOTIFICATION_ID,
    descartada_em: READ_AT,
  });
  assert.deepEqual(decodeNotificationDestination({
    recurso_tipo: 'conta',
    recurso_id: USER_ID,
  }), {
    recurso_tipo: 'conta',
    recurso_id: USER_ID,
  });

  assert.throws(
    () => decodeNotificationReadResult({
      id: 'invalido',
      lida_em: READ_AT,
    }),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeNotificationReadAllResult({
      corte_em: READ_AT,
      atualizadas: -1,
    }),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeNotificationDiscardResult({
      id: NOTIFICATION_ID,
      descartada_em: 'invalido',
    }),
    InvalidBackendResponseError,
  );
  assert.throws(
    () => decodeNotificationDestination({
      recurso_tipo: 'propriedade',
      recurso_id: USER_ID,
    }),
    InvalidBackendResponseError,
  );
});

test('API usa somente as rotas e filtros allowlisted da MP-34', async () => {
  const requests = [];
  const responses = [
    { status: 200, body: notificationPage() },
    { status: 200, body: { total_nao_lidas: 1 } },
    { status: 200, body: { id: NOTIFICATION_ID, lida_em: READ_AT } },
    { status: 200, body: { corte_em: READ_AT, atualizadas: 1 } },
    { status: 200, body: { id: NOTIFICATION_ID, descartada_em: READ_AT } },
    {
      status: 200,
      body: { recurso_tipo: 'conta', recurso_id: USER_ID },
    },
  ];
  const transport = {
    async send(request) {
      requests.push(request);
      return responses.shift();
    },
  };
  const api = new BackendApi({
    baseUrl: 'https://api.tcheagro.example/',
    transport,
  });

  await api.listNotifications(ACCESS_TOKEN, {
    estado: 'nao_lida',
    limite: 50,
    cursor: 'cursor +/=',
    destinatario_usuario_id: USER_ID,
    propriedade_id: 'nao-permitida',
  });
  await api.countUnreadNotifications(ACCESS_TOKEN);
  await api.markNotificationRead(
    ACCESS_TOKEN,
    NOTIFICATION_ID,
    IDEMPOTENCY_KEY,
  );
  await api.markAllNotificationsRead(ACCESS_TOKEN, IDEMPOTENCY_KEY);
  await api.discardNotification(
    ACCESS_TOKEN,
    NOTIFICATION_ID,
    IDEMPOTENCY_KEY,
  );
  await api.resolveNotificationDestination(ACCESS_TOKEN, NOTIFICATION_ID);

  const listUrl = new URL(requests[0].url);
  assert.equal(listUrl.pathname, '/v1/notificacoes');
  assert.deepEqual(Object.fromEntries(listUrl.searchParams), {
    estado: 'nao_lida',
    limite: '50',
    cursor: 'cursor +/=',
  });
  assert.equal(listUrl.searchParams.has('destinatario_usuario_id'), false);
  assert.equal(listUrl.searchParams.has('propriedade_id'), false);

  assert.deepEqual(
    requests.map(({ method, url }) => [method, new URL(url).pathname]),
    [
      ['GET', '/v1/notificacoes'],
      ['GET', '/v1/notificacoes/contador-nao-lidas'],
      ['POST', `/v1/notificacoes/${NOTIFICATION_ID}/leitura`],
      ['POST', '/v1/notificacoes/leituras'],
      ['DELETE', `/v1/notificacoes/${NOTIFICATION_ID}`],
      ['POST', `/v1/notificacoes/${NOTIFICATION_ID}/resolver-destino`],
    ],
  );

  for (const index of [2, 3, 4]) {
    assert.equal(requests[index].idempotencyKey, IDEMPOTENCY_KEY);
    assert.equal(requests[index].accessToken, ACCESS_TOKEN);
    assert.equal(requests[index].body, undefined);
  }
  assert.equal(requests[0].idempotencyKey, undefined);
  assert.equal(requests[1].idempotencyKey, undefined);
  assert.equal(requests[5].idempotencyKey, undefined);
});

test('API recusa sucesso 2xx incompatível em vez de aceitar payload parcial', async () => {
  const api = new BackendApi({
    baseUrl: 'https://api.tcheagro.example',
    transport: {
      async send() {
        return {
          status: 200,
          body: notificationPage({
            itens: [notification({ recurso_tipo: 'propriedade' })],
          }),
        };
      },
    },
  });

  await assert.rejects(
    api.listNotifications(ACCESS_TOKEN, {}),
    InvalidBackendResponseError,
  );
});

test('transporte materializa exatamente Idempotency-Key sem persistir payload', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, init) => {
    captured = { url, init };
    return {
      status: 200,
      headers: { get() { return null; } },
      async text() { return ''; },
    };
  };

  try {
    const transport = new FetchHttpTransport();
    await transport.send({
      method: 'POST',
      url: `https://api.tcheagro.example/v1/notificacoes/${NOTIFICATION_ID}/leitura`,
      accessToken: ACCESS_TOKEN,
      idempotencyKey: IDEMPOTENCY_KEY,
      timeoutMs: 1_000,
    });

    assert.equal(captured.init.headers['idempotency-key'], IDEMPOTENCY_KEY);
    assert.equal(
      captured.init.headers.authorization,
      `Bearer ${ACCESS_TOKEN}`,
    );
    assert.equal('Idempotency-Key' in captured.init.headers, false);
    assert.equal(captured.init.body, undefined);
    assert.equal(captured.init.credentials, 'omit');
    assert.equal(captured.init.redirect, 'error');
  } finally {
    global.fetch = originalFetch;
  }
});

test('chave idempotente é opaca, limitada e não incorpora identidade', () => {
  const randomValues = [0.1, 0.2, 0.3, 0.4];
  let index = 0;
  const key = createNotificationIdempotencyKey(
    () => Date.parse(CREATED_AT),
    () => randomValues[index++],
  );

  assert.equal(isNotificationIdempotencyKey(key), true);
  assert.match(key, /^[A-Za-z0-9_-]{16,128}$/);
  assert.equal(key.includes(USER_ID), false);
  assert.equal(key.includes('org_tche_fertilidade'), false);
  assert.equal(key.includes('@'), false);

  for (const invalid of [
    'curta',
    'x'.repeat(129),
    'chave com espaco suficiente',
    'usuario@example.com-chave',
    'chave:idempotente:com:dois-pontos',
  ]) {
    assert.equal(isNotificationIdempotencyKey(invalid), false);
  }
});
