const test = require('node:test');
const { assert, load, id, USER, PROPERTY, SECOND, user, relation, titular, page, receipt, fixture } = require('./fixtures/mp35d5');
const { decodeAdministrativeUserPropertyPage: decode, decodeAdministrativeUserPropertyReceipt: decodeReceipt } = load('decoders');
const { validateUserPropertyDelta: delta, validateUserPropertyFilters: filters, UserPropertyEditModel: Model, userPropertyAccessLabel: label } = load('administrativeUserPropertyModels');
const body = extra => ({ versao: 4, adicionar: [SECOND], remover: [PROPERTY], motivo: 'fim_relacao', ...extra });
test('coleção preserva versão do Usuário e distingue titularidade, ativo e inativo', () => {
  const p = decode(page({ itens: [titular(), relation({ id: id(8), propriedade_id: SECOND }), relation({ id: id(9), propriedade_id: id(10), status_vinculo: 'inativo' })] }), USER);
  assert.equal(p.versao, 4); assert.equal(p.itens[1].versao_vinculo, 22); assert.equal(p.itens[0].editavel, false);
  assert.ok(Object.isFrozen(p.itens));
});
for (const [name, patch] of Object.entries({ wrongUser: { usuario_id: SECOND }, version: { versao: 0 }, missingItems: { itens: null },
  cursor: { paginacao: { proximo_cursor: '' } }, emptyPageCursor: { itens: [], paginacao: { proximo_cursor: 'next' } },
  extra: { segredo: 'unwanted' }, duplicates: { itens: [relation(), relation()] } })) {
  test(`envelope inválido: ${name}`, () => assert.throws(() => decode(page(patch), USER)));
}
for (const [name, patch] of Object.entries({ editableHolder: { ...titular(), editavel: true }, invalidOrigin: { origem_acesso: 'territorio' },
  invalidType: { tipo_vinculo: 'admin' }, missingVersion: { versao_vinculo: null }, zeroVersion: { versao_vinculo: 0 },
  malformedTime: { criado_em: '2026-02-30T12:00:00.000Z' }, status: { status_vinculo: 'pendente' }, missingId: { propriedade_id: 'legacy' },
  sensitive: { token: 'secret' }, nullEditable: { editavel: null } })) {
  test(`item inválido: ${name}`, () => assert.throws(() => decode(page({ itens: [relation(patch)] }), USER)));
}
test('paginação valida tamanho máximo sem exigir coleção completa', () => {
  assert.equal(decode(page({ paginacao: { proximo_cursor: 'opaque' } }), USER).itens.length, 1);
  assert.throws(() => decode(page(), USER, 0));
});
test('recibo exige tipo, usuário correlacionado e avanço da versão do Usuário', () => {
  assert.equal(decodeReceipt(receipt(), USER, 4).versao, 5);
  for (const patch of [{ recurso_id: SECOND }, { recurso_tipo: 'usuario' }, { versao: 4 }, { resultado: 'status_alterado' }, { versao: null }]) assert.throws(() => decodeReceipt(receipt(patch), USER, 4));
});
test('payload exato, arrays canônicos, NFC e omissão do detalhe opcional', () => {
  assert.deepEqual(delta(body()), body());
  assert.equal(delta(body({ motivo: 'outro', motivo_detalhe: 'e\u0301'.repeat(300) })).motivo_detalhe, 'é'.repeat(300));
});
for (const [name, patch] of Object.entries({ empty: { adicionar: [], remover: [] }, duplicate: { adicionar: [SECOND, SECOND] },
  overlap: { adicionar: [PROPERTY] }, missingReason: { motivo: undefined }, badReason: { motivo: 'invalid' },
  anotherWithoutDetail: { motivo: 'outro' }, emptyDetail: { motivo_detalhe: '' }, longDetail: { motivo_detalhe: 'a'.repeat(301) },
  whitespace: { motivo_detalhe: ' a ' }, oldAlias: { fazenda_id: PROPERTY }, suppliedType: { tipo_vinculo: 'titular' },
  arrayOfObjects: { adicionar: [{ propriedade_id: SECOND }] }, version: { versao: 0 }, tooMany: { adicionar: Array.from({ length: 101 }, (_, n) => id(n+50)), remover: [] } })) {
  test(`delta inválido: ${name}`, () => assert.throws(() => delta(body(patch))));
}
test('100 IDs somados aceitos; campo ausente e getter recusados', () => {
  assert.equal(delta(body({ adicionar: Array.from({ length: 100 }, (_, n) => id(n+50)), remover: [] })).adicionar.length, 100);
  const missing = body(); delete missing.remover; assert.throws(() => delta(missing));
  assert.throws(() => delta({ ...body(), get motivo() { throw Error('must not execute'); } }));
});
test('filtros usam apenas nomes reais do contrato', () => {
  assert.deepEqual(filters({ busca: 'e\u0301', tipo_acesso: 'titular', status_vinculo: 'ativo', cursor: 'abc', limite: 100 }),
    { busca: 'é', tipo_acesso: 'titular', status_vinculo: 'ativo', cursor: 'abc', limite: 100 });
  for (const invalid of [{ propriedade_id: PROPERTY }, { tipo_acesso: 'admin' }, { status_vinculo: 'ativa' }, { cursor: '' }, { limite: 101 }]) assert.throws(() => filters(invalid));
});
test('modelo não remove invisíveis; desfazer retorna ao baseline; titular e Admin imutáveis', () => {
  const m = new Model(user()); m.remember([relation()]); m.set(SECOND, 'Não carregada', false); assert.equal(m.count, 0);
  m.set(PROPERTY, 'Um', false); assert.equal(m.count, 1); m.set(PROPERTY, 'Um', true); assert.equal(m.count, 0);
  m.set(SECOND, 'Dois', true); m.set(SECOND, 'Dois', false); assert.equal(m.count, 0);
  m.remember([titular()]); m.set(PROPERTY, 'Titular', false); assert.equal(m.count, 0);
  const admin = new Model(user({ perfil: 'admin' })); admin.set(SECOND, 'Dois', true); assert.equal(admin.count, 0); assert.throws(() => admin.payload('fim_relacao', ''));
});
test('baseline descoberto em outra página retira adição sem efeito', () => {
  const m = new Model(user()); m.set(PROPERTY, 'Um', true); m.remember([relation()]); assert.equal(m.count, 0);
});
test('acesso efetivo não é inferido de vínculo isolado nem de status Produtor ausente', () => {
  assert.match(label(user(), relation()), /Condições de acesso atendidas/);
  assert.match(label(user({ status: 'pendente' }), relation()), /não está ativo/);
  assert.match(label(user(), relation({ propriedade_status: 'inativa' })), /Propriedade inativa/);
  assert.match(label(user(), relation({ status_vinculo: 'inativo' })), /outros acessos podem existir/);
  assert.match(label(user({ perfil: 'produtor' }), relation({ tipo_vinculo: 'usuario_autorizado' })), /habilitação do Produtor/);
});
test('porta HTTP produz GET/PATCH exatos e rejeita entrada antes do transporte', async t => {
  const f = await fixture(); t.after(f.dispose);
  await f.runtime.api.listAdministrativeUserProperties('token', USER, { busca: 'Um', tipo_acesso: 'colaborador', status_vinculo: 'ativo', limite: 3, cursor: 'opaque' });
  const url = new URL(f.requests.at(-1).url); assert.equal(url.pathname, `/v1/usuarios/${USER}/propriedades`);
  assert.equal(url.searchParams.get('status_vinculo'), 'ativo'); assert.equal(url.searchParams.get('limite'), '3');
  const n = f.requests.length;
  await assert.rejects(f.runtime.api.changeAdministrativeUserProperties('token', USER, '', body()));
  await assert.rejects(f.runtime.api.changeAdministrativeUserProperties('token', USER, 'key', body({ tipo_vinculo: 'titular' })));
  assert.equal(f.requests.length, n);
});
