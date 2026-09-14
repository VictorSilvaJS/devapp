const test = require('node:test');
const { assert, load, property, ID, receipt } = require('./fixtures/mp35d4');
const { decodeAdministrativeProperty, decodeAdministrativePropertyPage, decodeAdministrativePropertyReceipt,
  decodeProperty, InvalidBackendResponseError } = load('decoders');
const { BackendApi } = load('backendApi');

test('leitura administrativa preserva representação completa versionada e decimal', () => {
  assert.deepEqual(decodeAdministrativeProperty(property()), property());
  assert.equal(decodeAdministrativeProperty(property({ area_total_decimal: '1.2300' })).area_total_decimal, '1.23');
  assert.equal(decodeAdministrativeProperty(property({ area_total: null, area_total_decimal: null })).area_total_decimal, null);
});
for (const field of Object.keys(property())) test(`leitura falha sem obrigatório ${field}`, () => {
  const input = property(); delete input[field];
  assert.throws(() => decodeAdministrativeProperty(input), InvalidBackendResponseError);
});
for (const [field, value] of [['area_total_decimal', 1.23], ['area_total_decimal', '1e2'],
  ['area_total_decimal', null], ['area_total', null], ['versao', 0], ['versao', 1.1],
  ['criado_em', '2026-02-30T12:00:00.000Z'], ['criado_em', '2026-09-01T12:00:00.000Z\n'],
  ['atualizado_em', '2026-08-01T12:00:00.000Z'], ['titular', { id: ID, nome: 'Outro' }]]) {
  test(`leitura recusa corrupção ${field} ${JSON.stringify(value)}`, () => {
    assert.throws(() => decodeAdministrativeProperty(property({ [field]: value })), InvalidBackendResponseError);
  });
}
test('operacional continua aceitando Admin, Produtor e Colaborador sem decimal/versão', () => {
  for (const tipo_acesso of ['admin', 'titular', 'usuario_autorizado', 'colaborador']) {
    const input = property({ tipo_acesso }); delete input.area_total_decimal; delete input.versao;
    assert.equal(decodeProperty(input).area_total, 1.23);
    assert.equal(decodeProperty(input).tipo_acesso, tipo_acesso);
  }
});
test('lista administrativa não preenche itens incompletos nem duplicados', () => {
  for (const itens of [[{ id: ID }], [property(), property()]]) {
    assert.throws(() => decodeAdministrativePropertyPage({ itens, paginacao: { proximo_cursor: null } }));
  }
  const page = decodeAdministrativePropertyPage({ itens: [property()], paginacao: { proximo_cursor: 'cursor' } });
  assert.equal(page.itens[0].versao, 2); assert.equal(page.paginacao.proximo_cursor, 'cursor');
});
for (const outcome of ['criado', 'atualizado', 'status_alterado']) {
  test(`recibo ${outcome}: exato, sem conteúdo indevido, tipo/ID/versão validados`, () => {
    assert.deepEqual(decodeAdministrativePropertyReceipt(receipt(outcome), outcome, ID), receipt(outcome));
    for (const invalid of [receipt(outcome, { recurso_tipo: 'usuario' }), receipt(outcome, { recurso_id: 'local' }),
      receipt(outcome, { versao: -1 }), receipt(outcome, { versao: 1.5 }), receipt(outcome, { nome: 'PII' }),
      receipt('convite_emitido'), { resultado: outcome }, [], null]) {
      assert.throws(() => decodeAdministrativePropertyReceipt(invalid, outcome, ID), InvalidBackendResponseError);
    }
  });
}
test('API administrativa usa GETs reais e conserva filtros/cursor', async () => {
  const calls = [];
  const api = new BackendApi({ baseUrl: 'https://api.example.test', transport: { async send(request) {
    calls.push(request); return { status: 200, body: request.url.includes('?')
      ? { itens: [property()], paginacao: { proximo_cursor: null } } : property() };
  } } });
  await api.listAdministrativeProperties('access', { status: 'inativa', uf: 'RS', municipio: 'Caxias', busca: 'A & B', limite: 5, cursor: 'opaque' });
  assert.equal(new URL(calls[0].url).searchParams.get('busca'), 'A & B');
  assert.equal(new URL(calls[0].url).searchParams.get('status'), 'inativa');
  assert.equal((await api.getAdministrativeProperty('access', ID)).versao, 2);
  assert.equal(calls[1].url, `https://api.example.test/v1/propriedades/${ID}`);
});

test('três portas de escrita recusam chave ausente/inválida antes do transporte', async () => {
  let sent = 0;
  const api = new BackendApi({ baseUrl: 'https://api.example.test', transport: { async send() { sent++; } } });
  for (const key of [undefined, '', 'x\n', 'x'.repeat(129)]) {
    await assert.rejects(api.createAdministrativeProperty('token', key, {}));
    await assert.rejects(api.updateAdministrativeProperty('token', ID, key, {}));
    await assert.rejects(api.changeAdministrativePropertyStatus('token', ID, key, {}));
  }
  assert.equal(sent, 0);
});
