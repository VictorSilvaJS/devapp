const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BackendApi,
  InvalidApiRequestError,
} = require('../.tmp-mp35d3/src/http/backendApi');
const {
  InvalidBackendResponseError,
  decodeAdministrativeUserInvitationCommandReceipt,
} = require('../.tmp-mp35d3/src/http/decoders');
const {
  InvalidAdministrativeUserFormError,
  buildChangeAdministrativeUserStatusPayload,
  buildCreateAdministrativeUserPayload,
  buildIssueAdministrativeUserInvitationPayload,
  buildPatchAdministrativeUserPayload,
  createAdministrativeUserEditModel,
  rebaseAdministrativeUserEditModel,
  resolveAdministrativeUserEditConflict,
  updateAdministrativeUserEditField,
} = require('../.tmp-mp35d3/src/http/administrativeUserCommands');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCER_ID = '33333333-3333-4333-8333-333333333333';
const ACCESS_TOKEN = 'A'.repeat(43);
const IDEMPOTENCY_KEY = 'admin_44444444444444448444444444444444';

function detail(overrides = {}) {
  return Object.freeze({
    id: USER_ID,
    organizacao_id: 'org_tche_fertilidade',
    produtor_id: PRODUCER_ID,
    nome: 'Nome A',
    email: 'a@example.test',
    perfil: 'produtor',
    status: 'pendente',
    telefone: '1',
    documento: 'DOC-1',
    observacoes: 'Obs 1',
    versao: 1,
    criado_em: '2026-09-01T12:00:00.000Z',
    atualizado_em: '2026-09-01T12:00:00.000Z',
    ...overrides,
  });
}

function apiReturning(responses, requests = []) {
  return new BackendApi({
    baseUrl: 'https://api.tcheagro.example',
    transport: {
      async send(request) {
        requests.push(request);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  });
}

test('quatro métodos preservam rota, status, chave e payload fechados', async () => {
  const requests = [];
  const api = apiReturning([
    { status: 201, body: { resultado: 'criado', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 1 } },
    { status: 200, body: { resultado: 'atualizado', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 2 } },
    { status: 200, body: { resultado: 'status_alterado', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 3 } },
    { status: 201, body: { resultado: 'convite_emitido', recurso_tipo: 'usuario', recurso_id: USER_ID, versao: 3 } },
  ], requests);
  const createBody = { nome: 'Novo', email: 'novo@example.test', perfil: 'produtor' };
  const patchBody = { versao: 1, nome: 'Novo nome' };
  const statusBody = { versao: 2, status: 'inativo', motivo: 'fim_relacao' };
  const inviteBody = { modo_ativacao: 'ativar_usuario' };

  await api.createAdministrativeUser(ACCESS_TOKEN, IDEMPOTENCY_KEY, createBody);
  await api.updateAdministrativeUser(ACCESS_TOKEN, USER_ID, IDEMPOTENCY_KEY, patchBody);
  await api.changeAdministrativeUserStatus(ACCESS_TOKEN, USER_ID, IDEMPOTENCY_KEY, statusBody);
  await api.issueAdministrativeUserInvitation(ACCESS_TOKEN, USER_ID, IDEMPOTENCY_KEY, inviteBody);

  assert.deepEqual(requests.map(({ method, url, body, idempotencyKey }) => ({
    method,
    path: new URL(url).pathname,
    body,
    idempotencyKey,
  })), [
    { method: 'POST', path: '/v1/usuarios', body: createBody, idempotencyKey: IDEMPOTENCY_KEY },
    { method: 'PATCH', path: `/v1/usuarios/${USER_ID}`, body: patchBody, idempotencyKey: IDEMPOTENCY_KEY },
    { method: 'PATCH', path: `/v1/usuarios/${USER_ID}/status`, body: statusBody, idempotencyKey: IDEMPOTENCY_KEY },
    { method: 'POST', path: `/v1/usuarios/${USER_ID}/convites`, body: inviteBody, idempotencyKey: IDEMPOTENCY_KEY },
  ]);
});

test('recibo D-3 de convite exige usuario, alvo canônico, versão e nenhuma chave extra', async () => {
  const valid = {
    resultado: 'convite_emitido',
    recurso_tipo: 'usuario',
    recurso_id: USER_ID,
    versao: 2,
  };
  assert.deepEqual(decodeAdministrativeUserInvitationCommandReceipt(valid), valid);
  for (const invalid of [
    { ...valid, recurso_tipo: 'convite' },
    { ...valid, recurso_id: 'não-uuid' },
    { ...valid, versao: 0 },
    { ...valid, token: 'segredo' },
  ]) {
    assert.throws(
      () => decodeAdministrativeUserInvitationCommandReceipt(invalid),
      InvalidBackendResponseError,
    );
  }
  const api = apiReturning([{ status: 201, body: { ...valid, recurso_id: OTHER_ID } }]);
  await assert.rejects(
    api.issueAdministrativeUserInvitation(
      ACCESS_TOKEN,
      USER_ID,
      IDEMPOTENCY_KEY,
      { modo_ativacao: 'ativar_usuario' },
    ),
    InvalidBackendResponseError,
  );
});

test('UUID do alvo é recusado antes de transporte', async () => {
  const requests = [];
  const api = apiReturning([], requests);
  await assert.rejects(
    api.updateAdministrativeUser(ACCESS_TOKEN, 'inválido', IDEMPOTENCY_KEY, { versao: 1, nome: 'X' }),
    InvalidApiRequestError,
  );
  assert.equal(requests.length, 0);
});

test('criação aceita só Produtor/Colaborador e não admite senha, status ou vínculo', () => {
  assert.deepEqual(buildCreateAdministrativeUserPayload({
    nome: '  Ana  ',
    email: ' ANA@EXAMPLE.TEST ',
    perfil: 'colaborador',
    telefone: '',
    documento: '',
    observacoes: '',
  }), { nome: 'Ana', email: 'ana@example.test', perfil: 'colaborador' });
  for (const draft of [
    { nome: 'A', email: 'a@example.test', perfil: 'admin' },
    { nome: 'A', email: 'a@example.test', perfil: 'produtor', senha: 'segredo' },
    { nome: 'A', email: 'a@example.test', perfil: 'produtor', status: 'ativo' },
    { nome: 'A', email: 'a@example.test', perfil: 'produtor', propriedade_id: USER_ID },
  ]) assert.throws(() => buildCreateAdministrativeUserPayload(draft), InvalidAdministrativeUserFormError);
});

test('dirtyFields remove campo revertido e PATCH contém somente alterações explícitas', () => {
  let model = createAdministrativeUserEditModel(detail());
  model = updateAdministrativeUserEditField(model, 'nome', 'Nome operador');
  assert.deepEqual(model.dirtyFields, ['nome']);
  assert.deepEqual(buildPatchAdministrativeUserPayload(model), {
    versao: 1,
    nome: 'Nome operador',
  });
  model = updateAdministrativeUserEditField(model, 'nome', 'Nome A');
  assert.deepEqual(model.dirtyFields, []);
  assert.throws(() => buildPatchAdministrativeUserPayload(model), /Nenhuma alteração/);
});

test('rebase adota campo intocado, preserva alteração exclusiva e marca concorrência por campo', () => {
  let model = createAdministrativeUserEditModel(detail());
  model = updateAdministrativeUserEditField(model, 'nome', 'Nome operador');
  model = updateAdministrativeUserEditField(model, 'telefone', 'Telefone operador');
  model = rebaseAdministrativeUserEditModel(model, detail({
    nome: 'Nome A',
    telefone: 'Telefone servidor',
    documento: 'DOC-2',
    versao: 2,
  }));

  assert.equal(model.baselineVersion, 2);
  assert.equal(model.draftValues.documento, 'DOC-2');
  assert.equal(model.draftValues.nome, 'Nome operador');
  assert.deepEqual(model.fieldConflicts.telefone, {
    serverValue: 'Telefone servidor',
    operatorValue: 'Telefone operador',
  });
  assert.throws(() => buildPatchAdministrativeUserPayload(model), /Resolva os conflitos/);

  model = resolveAdministrativeUserEditConflict(model, 'telefone', 'server');
  assert.deepEqual(buildPatchAdministrativeUserPayload(model), {
    versao: 2,
    nome: 'Nome operador',
  });
});

test('nome, telefone, documento, observações e e-mail têm resolução explícita sem reversão concorrente', () => {
  for (const field of ['nome', 'telefone', 'documento', 'observacoes', 'email']) {
    let model = createAdministrativeUserEditModel(detail());
    model = updateAdministrativeUserEditField(model, field, `operador-${field}@example.test`);
    model = rebaseAdministrativeUserEditModel(model, detail({
      [field]: `servidor-${field}@example.test`,
      versao: 2,
    }));
    assert.ok(model.fieldConflicts[field]);
    model = resolveAdministrativeUserEditConflict(model, field, 'operator');
    const payload = buildPatchAdministrativeUserPayload(model);
    assert.deepEqual(Object.keys(payload).sort(), [field, 'versao'].sort());
    assert.equal(payload.versao, 2);
  }
});

test('rebase consecutivo v1→v2→v3 preserva conflito pendente com servidor estável e adota campo intocado', () => {
  let model = createAdministrativeUserEditModel(detail({ nome: 'A' }));
  model = updateAdministrativeUserEditField(model, 'nome', 'Operador');
  model = rebaseAdministrativeUserEditModel(model, detail({ nome: 'Servidor', versao: 2 }));
  assert.deepEqual(model.fieldConflicts.nome, {
    serverValue: 'Servidor',
    operatorValue: 'Operador',
  });
  assert.throws(() => buildPatchAdministrativeUserPayload(model), /Resolva os conflitos/);

  const latest = detail({ nome: 'Servidor', documento: 'DOC-3', versao: 3 });
  for (const authoritative of [latest, latest]) {
    model = rebaseAdministrativeUserEditModel(model, authoritative);
    assert.equal(model.baselineVersion, 3);
    assert.equal(model.baselineValues.nome, 'Servidor');
    assert.equal(model.baselineValues.documento, 'DOC-3');
    assert.equal(model.draftValues.nome, 'Operador');
    assert.equal(model.draftValues.documento, 'DOC-3');
    assert.deepEqual(model.dirtyFields, ['nome']);
    assert.deepEqual(model.fieldConflicts.nome, {
      serverValue: 'Servidor',
      operatorValue: 'Operador',
    });
    assert.throws(() => buildPatchAdministrativeUserPayload(model), /Resolva os conflitos/);
  }
});

for (const resolution of ['server', 'operator']) {
  test(`resolução ${resolution} após rebases consecutivos preserva dirtyFields e usa a versão autoritativa atual`, () => {
    let model = createAdministrativeUserEditModel(detail({ nome: 'A' }));
    model = updateAdministrativeUserEditField(model, 'nome', 'Operador');
    model = updateAdministrativeUserEditField(model, 'telefone', 'Telefone operador');
    model = rebaseAdministrativeUserEditModel(model, detail({ nome: 'Servidor', versao: 2 }));
    model = rebaseAdministrativeUserEditModel(model, detail({
      nome: 'Servidor', documento: 'DOC-3', versao: 3,
    }));
    assert.ok(model.fieldConflicts.nome);

    model = resolveAdministrativeUserEditConflict(model, 'nome', resolution);
    assert.equal(model.baselineVersion, 3);
    assert.equal(model.baselineValues.nome, 'Servidor');
    assert.equal(model.draftValues.nome, resolution === 'server' ? 'Servidor' : 'Operador');
    assert.equal(model.draftValues.documento, 'DOC-3');
    assert.deepEqual(model.fieldConflicts, {});
    assert.deepEqual(model.dirtyFields, resolution === 'server' ? ['telefone'] : ['nome', 'telefone']);
    assert.deepEqual(buildPatchAdministrativeUserPayload(model), {
      versao: 3,
      ...(resolution === 'operator' ? { nome: 'Operador' } : {}),
      telefone: 'Telefone operador',
    });
  });
}

test('conflito pendente acompanha o valor autoritativo sem resolução silenciosa quando servidor converge ao draft', () => {
  let model = createAdministrativeUserEditModel(detail({ nome: 'A' }));
  model = updateAdministrativeUserEditField(model, 'nome', 'Operador');
  model = rebaseAdministrativeUserEditModel(model, detail({ nome: 'Servidor', versao: 2 }));

  for (const [versao, nome] of [[3, 'Servidor v3'], [4, 'Operador'], [5, 'Operador']]) {
    model = rebaseAdministrativeUserEditModel(model, detail({ nome, versao }));
    assert.equal(model.baselineVersion, versao);
    assert.equal(model.baselineValues.nome, nome);
    assert.equal(model.draftValues.nome, 'Operador');
    assert.deepEqual(model.dirtyFields, nome === 'Operador' ? [] : ['nome']);
    assert.deepEqual(model.fieldConflicts.nome, { serverValue: nome, operatorValue: 'Operador' });
    assert.throws(() => buildPatchAdministrativeUserPayload(model), /Resolva os conflitos/);
  }
  for (const resolution of ['server', 'operator']) {
    const resolved = resolveAdministrativeUserEditConflict(model, 'nome', resolution);
    assert.equal(resolved.baselineVersion, 5);
    assert.equal(resolved.draftValues.nome, 'Operador');
    assert.deepEqual(resolved.fieldConflicts, {});
    assert.deepEqual(resolved.dirtyFields, []);
    assert.throws(() => buildPatchAdministrativeUserPayload(resolved), /Nenhuma alteração/);
  }
});

test('mudança pendente→ativo durante conflito bloqueia e-mail administrativo', () => {
  let model = createAdministrativeUserEditModel(detail());
  model = updateAdministrativeUserEditField(model, 'email', 'operador@example.test');
  model = rebaseAdministrativeUserEditModel(model, detail({ status: 'ativo', versao: 2 }));
  assert.equal(model.draftValues.email, 'operador@example.test');
  assert.throws(() => buildPatchAdministrativeUserPayload(model), /fluxo verificado/);
});

test('status deriva ativo↔inativo, exige motivo e convite mantém ativar_usuario', () => {
  assert.deepEqual(buildChangeAdministrativeUserStatusPayload(
    detail({ status: 'ativo', versao: 8 }),
    { motivo: 'outro', motivo_detalhe: '  Motivo controlado  ' },
  ), {
    versao: 8,
    status: 'inativo',
    motivo: 'outro',
    motivo_detalhe: 'Motivo controlado',
  });
  assert.throws(
    () => buildChangeAdministrativeUserStatusPayload(detail({ status: 'ativo' }), { motivo: 'outro' }),
    InvalidAdministrativeUserFormError,
  );
  assert.deepEqual(buildIssueAdministrativeUserInvitationPayload(detail()), {
    modo_ativacao: 'ativar_usuario',
  });
});
