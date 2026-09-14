const test = require('node:test');
const { assert, load, property, draft, PRODUCER_ID, USER_ID } = require('./fixtures/mp35d4');
const m = load('administrativePropertyModels');
const create = m.createAdministrativePropertyEditModel;
const change = m.updateAdministrativePropertyEditField;
const patch = m.buildPatchAdministrativePropertyPayload;
const rebase = m.rebaseAdministrativePropertyEditModel;

test('criação usa produtor_id, sem versão, área omitida e sem localização derivada', () => {
  assert.deepEqual(m.buildCreateAdministrativePropertyPayload(draft()), {
    nome: 'Nova Propriedade', titular_id: PRODUCER_ID, municipio_id: '4305108', status: 'ativa',
  });
  assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ titular: { usuario_id: USER_ID } })));
  assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ titular: null })));
  assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ municipio_id: undefined })));
  assert.equal(m.buildCreateAdministrativePropertyPayload(draft({ status: 'inativa' })).status, 'inativa');
});
test('POST rejeita campos não previstos, null e undefined explícitos', () => {
  for (const extra of [{ versao: 1 }, { uf_id: '43' }, { municipio_nome: 'Caxias' },
    { area_total_decimal: '1' }, { tipo_acesso: 'admin' }, { area_total: null }, { area_total: undefined },
    { cultura_principal: null }, { usuario_id: USER_ID }]) {
    assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft(extra)));
  }
});
for (const value of ['+1', '-1', '1e2', '0', '0.0000', '01', '0.00001', '10000000000',
  ' 1', '1 ', '1\n', '1\r', '1\r\n', '1\u2028', '1\u2029', '1\t', 1]) {
  test(`área rejeitada em criação e edição: ${JSON.stringify(value)}`, () => {
    assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ area_total: value })));
    assert.throws(() => patch(change(create(property()), 'area_total', value)));
  });
}
test('canonicalização exata textual, limites NFC e whitespace sem gramática alternativa', () => {
  for (const [input, expected] of [['1.2300', '1.23'], ['1.0000', '1'], ['0.0001', '0.0001'], ['9999999999.9999', '9999999999.9999']]) {
    assert.equal(m.buildCreateAdministrativePropertyPayload(draft({ area_total: input })).area_total, expected);
  }
  assert.equal(m.buildCreateAdministrativePropertyPayload(draft({ nome: 'Cafe\u0301' })).nome, 'Café');
  for (const nome of ['', ' nome', 'nome ', 'x'.repeat(201)]) assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ nome })));
  assert.equal(m.buildCreateAdministrativePropertyPayload(draft({ nome: '😀'.repeat(200) })).nome.length, 400);
  assert.throws(() => m.buildCreateAdministrativePropertyPayload(draft({ cultura_principal: 'a'.repeat(121) })));
});
test('PATCH parcial, baseline decimal e limpezas intencionais', () => {
  const base = create(property({ area_total: 9999999999.9999, area_total_decimal: '9999999999.9999' }));
  assert.equal(base.draft.area_total, '9999999999.9999');
  assert.deepEqual(patch(change(base, 'nome', 'Novo nome')), { versao: 2, nome: 'Novo nome' });
  assert.deepEqual(patch(change(change(base, 'area_total', null), 'cultura_principal', null)),
    { versao: 2, area_total: null, cultura_principal: null });
  assert.throws(() => patch(base));
  for (const field of ['titular', 'titular_id', 'status', 'area_total_decimal']) assert.throws(() => change(base, field, 'x'));
});
test('retorno decimal equivalente remove dirty; nenhum comando artificial', () => {
  const base = create(property());
  const model = change(change(base, 'area_total', '9'), 'area_total', '1.2300');
  assert.deepEqual(model.dirtyFields, []); assert.throws(() => patch(model));
  assert.deepEqual(change(change(base, 'nome', 'X'), 'nome', base.baseline.nome).dirtyFields, []);
  assert.throws(() => m.validatePatchAdministrativePropertyPayload({ nome: 'X' }));
});
test('rebase adota área e município do servidor quando intocados e preserva outro campo local', () => {
  const model = change(create(property()), 'cultura_principal', 'Milho');
  const next = rebase(model, property({ versao: 3, area_total: 2, area_total_decimal: '2',
    municipio_id: '3550308', municipio_nome: 'São Paulo', uf_id: '35', uf_sigla: 'SP' }));
  assert.equal(next.draft.area_total, '2');
  assert.deepEqual(next.draft.municipio, { municipio_id: '3550308', municipio_nome: 'São Paulo', uf_id: '35', uf_sigla: 'SP' });
  assert.deepEqual(patch(next), { versao: 3, cultura_principal: 'Milho' });
});
for (const field of ['nome', 'area_total', 'municipio', 'cultura_principal']) {
  test(`conflito ${field} sobrevive a rebases consecutivos até resolução explícita`, () => {
    const local = { nome: 'Local', area_total: '5', cultura_principal: 'Milho',
      municipio: { municipio_id: '3550308', municipio_nome: 'São Paulo', uf_id: '35', uf_sigla: 'SP' } };
    const server = property({ nome: 'Servidor', area_total: 8, area_total_decimal: '8', cultura_principal: 'Arroz',
      municipio_id: '5103403', municipio_nome: 'Cuiabá', uf_id: '51', uf_sigla: 'MT', versao: 3 });
    const first = rebase(change(create(property()), field, local[field]), server);
    assert.ok(first.fieldConflicts[field]); assert.throws(() => patch(first));
    const second = rebase(first, { ...server, versao: 4 });
    assert.ok(second.fieldConflicts[field]); assert.deepEqual(second.draft[field], local[field]);
    const resolved = m.resolveAdministrativePropertyEditConflict(second, field, 'operator');
    assert.equal(patch(resolved).versao, 4);
    const accept = m.resolveAdministrativePropertyEditConflict(second, field, 'server');
    assert.deepEqual(accept.dirtyFields, []);
  });
}
test('seleção municipal nunca serializa rótulos; rejeita UF incoerente', () => {
  const base = create(property());
  assert.deepEqual(patch(change(base, 'municipio', { municipio_id: '3550308', municipio_nome: 'São Paulo', uf_id: '35', uf_sigla: 'SP' })),
    { versao: 2, municipio_id: '3550308' });
  assert.throws(() => change(base, 'municipio', { municipio_id: '3550308', municipio_nome: 'Caxias', uf_id: '43', uf_sigla: 'RS' }));
});
test('status separado, catálogo D10, outro exige detalhe e destino atual bloqueado', () => {
  for (const motivo of m.PROPERTY_REASON_CODES) {
    const input = { status: 'inativa', motivo, ...(motivo === 'outro' ? { motivo_detalhe: 'Ajuste cadastral' } : {}) };
    assert.deepEqual(m.buildChangeAdministrativePropertyStatusPayload(property(), input), { versao: 2, ...input });
  }
  for (const input of [{ status: 'inativa', motivo: 'invalid_holder' }, { status: 'inativa', motivo: 'outro' },
    { status: 'ativa', motivo: 'fim_relacao' }, { status: 'inativa', motivo: 'fim_relacao', nome: 'X' },
    { status: 'inativa', motivo: 'outro', motivo_detalhe: 'x'.repeat(301) }]) {
    assert.throws(() => m.buildChangeAdministrativePropertyStatusPayload(property(), input));
  }
});
