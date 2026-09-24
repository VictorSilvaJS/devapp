const assert = require('node:assert/strict');
const Module = require('node:module');
const load = file => require(`../../.tmp-mp35d5/src/http/${file}`);
const original = Module._load;
let createHttpRuntime;
try {
  Module._load = function(name, ...args) { return name === 'expo-secure-store' ? {} : original.call(this, name, ...args); };
  ({ createHttpRuntime } = load('runtime'));
} finally { Module._load = original; }
global.expo = { uuidv4: require('node:crypto').randomUUID };
const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const USER = id(1), ADMIN = id(2), PRODUCER = id(3), PROPERTY = id(4), SECOND = id(5), SESSION = id(6);
const stamp = '2026-09-01T12:00:00.000Z';
const ok = body => ({ status: 200, body });
const failure = (status, code) => ({ status, body: { error: { code } } });
const user = (extra = {}) => ({ id: USER, organizacao_id: 'org_tche_fertilidade', nome: 'Usuário teste',
  email: 'user@example.test', perfil: 'colaborador', status: 'ativo', versao: 4, produtor_id: null,
  telefone: null, documento: null, observacoes: null, criado_em: stamp, atualizado_em: stamp, ...extra });
const relation = (extra = {}) => ({ id: id(7), propriedade_id: PROPERTY, propriedade_nome: 'Propriedade Um',
  propriedade_status: 'ativa', origem_acesso: 'vinculo_direto', tipo_vinculo: 'colaborador', status_vinculo: 'ativo',
  editavel: true, versao_vinculo: 22, motivo: null, criado_em: stamp, atualizado_em: stamp, ...extra });
// Inactive direct history is valid even when its type differs from the current profile.
const historicRelation = (extra = {}) => relation({ id: id(8), propriedade_id: SECOND,
  propriedade_nome: 'Propriedade histórica', tipo_vinculo: 'usuario_autorizado', status_vinculo: 'inativo',
  motivo: { codigo: 'fim_relacao', detalhe: 'Relação anterior encerrada' }, ...extra });
const titular = () => relation({ id: PROPERTY, origem_acesso: 'titularidade', tipo_vinculo: 'titular',
  status_vinculo: null, editavel: false, versao_vinculo: null, criado_em: null, atualizado_em: null });
const page = (extra = {}) => ({ usuario_id: USER, versao: 4, itens: [relation()], paginacao: { proximo_cursor: null }, ...extra });
const property = (extra = {}) => ({ id: SECOND, organizacao_id: 'org_tche_fertilidade', titular_id: PRODUCER,
  titular: { id: PRODUCER, nome: 'Titular teste' }, nome: 'Propriedade Dois', municipio_id: '4305108', municipio_nome: 'Caxias do Sul',
  uf_id: '43', uf_sigla: 'RS', area_total: 1, area_total_decimal: '1', cultura_principal: 'Soja', status: 'ativa',
  tipo_acesso: 'admin', versao: 1, criado_em: stamp, atualizado_em: stamp, ...extra });
const receipt = (extra = {}) => ({ resultado: 'vinculos_alterados', recurso_tipo: 'vinculo', recurso_id: USER, versao: 5, ...extra });
const token = () => ({ access_token: 'A'.repeat(43), refresh_token: 'B'.repeat(43), token_type: 'Bearer', expires_in: 900,
  emitido_em: stamp, access_expira_em: '2026-09-01T12:15:00.000Z',
  sessao: { id: SESSION, expira_inatividade_em: '2026-09-15T12:00:00.000Z', expira_absolutamente_em: '2026-10-01T12:00:00.000Z' },
  usuario: { id: ADMIN, organizacao_id: 'org_tche_fertilidade', nome: 'Admin', email: 'admin@example.test', perfil: 'admin', status: 'ativo', versao_autorizacao: 1 },
  escopo: { modo: 'organizacao', versao: 1 } });
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture(extra = {}) {
  const f = { requests: [], handlers: {}, user: user(extra.user), items: extra.items ?? [relation()], completed: 0 };
  const runtime = createHttpRuntime({ apiBaseUrl: 'https://api.example.test' }, {
    refreshTokenStore: { async read() { return null; }, async write() {}, async clear() {} }, monotonicNow: () => 0,
    wallClockNow: () => Date.parse(stamp), transport: { async send(request) {
      f.requests.push(request); const path = new URL(request.url).pathname;
      if (path.endsWith('/login')) return f.handlers.login?.(request) ?? ok(token());
      if (path.endsWith('/refresh')) return failure(401, 'invalid_session');
      if (path.endsWith('/logout')) return { status: 204 };
      if (path.endsWith('/me')) { const t = token(); return f.handlers.me?.(request) ?? ok({ sessao: { id: t.sessao.id }, usuario: t.usuario, escopo: t.escopo }); }
      if (path === `/v1/usuarios/${USER}/propriedades`) {
        if (request.method === 'PATCH') {
          if (f.handlers.patch) return f.handlers.patch(request);
          f.user = user({ ...f.user, versao: f.user.versao + 1 });
          f.items = f.items.map(item => request.body.remover.includes(item.propriedade_id) ? { ...item, status_vinculo: 'inativo' }
            : request.body.adicionar.includes(item.propriedade_id) ? { ...item, status_vinculo: 'ativo' } : item);
          return ok(receipt({ versao: f.user.versao }));
        }
        return f.handlers.relations?.(request) ?? ok(page({ versao: f.user.versao, itens: f.items }));
      }
      if (path === `/v1/usuarios/${USER}`) return f.handlers.user?.(request) ?? ok(f.user);
      if (path === '/v1/propriedades') return f.handlers.catalog?.(request) ?? ok({ itens: [property()], paginacao: { proximo_cursor: null } });
      throw new Error(`Unexpected ${path}`);
    } },
  });
  await runtime.session.login('admin@example.test', 'Senha 123');
  f.runtime = runtime;
  f.controller = new (load('administrativeUserPropertyController').AdministrativeUserPropertyController)(runtime, USER, () => f.completed++);
  await f.controller.start();
  f.patches = () => f.requests.filter(r => r.method === 'PATCH');
  f.remove = () => { f.controller.selectRelation(f.controller.snapshot.relations.items[0], false); f.controller.update('reason', 'fim_relacao'); f.controller.review(); };
  f.dispose = () => f.controller.dispose();
  return f;
}
module.exports = { assert, load, id, USER, ADMIN, PRODUCER, PROPERTY, SECOND, user, relation, historicRelation, titular, page, property,
  receipt, ok, failure, token, deferred, tick, fixture };
