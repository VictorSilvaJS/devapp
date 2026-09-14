const assert = require('node:assert/strict');
const Module = require('node:module');
const load = (file) => require(`../../.tmp-mp35d4/src/http/${file}`);
const originalLoad = Module._load;
let createHttpRuntime;
try {
  Module._load = function(request, parent, isMain) {
    if (request === 'expo-secure-store') return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'test' };
    return originalLoad.call(this, request, parent, isMain);
  };
  ({ createHttpRuntime } = load('runtime'));
} finally { Module._load = originalLoad; }
global.expo = { uuidv4: require('node:crypto').randomUUID };
const ID = '11111111-1111-4111-8111-111111111111';
const PRODUCER_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';
function property(overrides = {}) {
  return { id: ID, organizacao_id: 'org_tche_fertilidade', titular_id: PRODUCER_ID,
    titular: { id: PRODUCER_ID, nome: 'Titular HTTP' }, nome: 'Propriedade HTTP',
    municipio_id: '4305108', municipio_nome: 'Caxias do Sul', uf_id: '43', uf_sigla: 'RS',
    area_total: 1.23, area_total_decimal: '1.23', cultura_principal: 'Soja',
    status: 'ativa', tipo_acesso: 'admin', versao: 2,
    criado_em: '2026-09-01T12:00:00.000Z', atualizado_em: '2026-09-02T12:00:00.000Z', ...overrides };
}
function draft(overrides = {}) {
  return { nome: 'Nova Propriedade', titular: { produtor_id: PRODUCER_ID }, municipio_id: '4305108',
    status: 'ativa', ...overrides };
}
function receipt(outcome = 'criado', overrides = {}) {
  return { resultado: outcome, recurso_tipo: 'propriedade', recurso_id: ID, versao: 2, ...overrides };
}
function tokenResponse(profile = 'admin', id = USER_ID) {
  return { access_token: 'A'.repeat(43), refresh_token: 'B'.repeat(43), token_type: 'Bearer', expires_in: 900,
    emitido_em: '2026-09-01T12:00:00.000Z', access_expira_em: '2026-09-01T12:15:00.000Z',
    sessao: { id: SESSION_ID, expira_inatividade_em: '2026-09-15T12:00:00.000Z', expira_absolutamente_em: '2026-10-01T12:00:00.000Z' },
    usuario: { id, organizacao_id: 'org_tche_fertilidade', nome: 'Admin', email: 'admin@example.test',
      perfil: profile, status: 'ativo', versao_autorizacao: 1 },
    escopo: { modo: profile === 'admin' ? 'organizacao' : 'vinculos_propriedade', versao: 1 } };
}
function failure(status, code) { return { status, body: { error: { code } } }; }
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(profile = 'admin') {
  const requests = [];
  const handlers = {};
  const runtime = createHttpRuntime({ apiBaseUrl: 'https://api.example.test' }, {
    refreshTokenStore: { async read() { return 'B'.repeat(43); }, async write() {}, async clear() {} },
    monotonicNow: () => 0, wallClockNow: () => Date.parse('2026-09-01T12:00:00.000Z'),
    transport: { async send(request) {
      requests.push(request);
      const path = new URL(request.url).pathname;
      if (path.endsWith('/login')) return handlers.login?.(request) ?? { status: 200, body: tokenResponse(profile) };
      if (path.endsWith('/refresh')) return handlers.refresh?.(request) ?? failure(401, 'invalid_session');
      if (path.endsWith('/logout')) return { status: 204 };
      if (path.endsWith('/me')) return handlers.me?.(request) ?? { status: 200, body: identity() };
      if (request.method === 'POST' || request.method === 'PATCH') {
        return handlers.mutation?.(request) ?? { status: request.method === 'POST' ? 201 : 200,
          body: receipt(request.method === 'POST' ? 'criado' : path.endsWith('/status') ? 'status_alterado' : 'atualizado') };
      }
      if (path === '/v1/propriedades') return handlers.list?.(request) ?? { status: 200,
        body: { itens: [property()], paginacao: { proximo_cursor: null } } };
      if (path.startsWith('/v1/propriedades/')) return handlers.get?.(request) ?? { status: 200, body: property() };
      throw new Error(`Requisição inesperada: ${request.method} ${path}`);
    } },
  });
  function identity(nextProfile) {
    const snapshot = runtime.session.snapshot;
    return { sessao: { id: snapshot.id }, usuario: { ...snapshot.usuario,
      ...(nextProfile ? { perfil: nextProfile } : {}) }, escopo: nextProfile
      ? { modo: nextProfile === 'admin' ? 'organizacao' : 'vinculos_propriedade', versao: snapshot.escopo.versao }
      : snapshot.escopo };
  }
  await runtime.session.login('admin@example.test', 'Senha 123');
  const flows = [];
  return { ...runtime, requests, handlers, identity,
    flow(kind = 'create', input) {
      const service = runtime.administrativePropertyCommands;
      const flow = kind === 'create' ? service.create(input ?? draft())
        : kind === 'edit' ? service.update(input)
        : service.changeStatus(input?.property ?? property(), input?.draft ?? { status: 'inativa', motivo: 'fim_relacao' });
      flow.start(); flows.push(flow); return flow;
    },
    mutations: () => requests.filter((request) => /\/v1\/propriedades/.test(request.url) && request.method !== 'GET'),
    reads: () => requests.filter((request) => /\/v1\/propriedades\//.test(request.url) && request.method === 'GET'),
    async revalidate(nextProfile) {
      handlers.me = () => ({ status: 200, body: identity(nextProfile) });
      return runtime.session.revalidate();
    },
    dispose() { for (const flow of flows) flow.dispose(); runtime.administrativePropertyData.dispose(); },
  };
}
module.exports = { assert, load, ID, PRODUCER_ID, USER_ID, property, draft, receipt, tokenResponse,
  failure, deferred, tick, fixture };
