const base = require('./mp35d4');
const fs = require('node:fs');
const path = require('node:path');
const VERSION = 'ibge-localidades-2026-08-25';
// Test-only fixture from the existing authoritative seed, never a runtime fallback.
const ufSeed = fs.readFileSync(path.join(__dirname, '../../backend/migrations/000007-catalogo-ibge-2026-08-25.sql'), 'utf8')
  .split('INSERT INTO public.ufs_ibge')[1].split('INSERT INTO public.municipios_ibge')[0];
const UF_ITEMS = [...ufSeed.matchAll(/\('ibge-localidades-2026-08-25', '([0-9]{2})', '([A-Z]{2})', '([^']+)'\)/g)]
  .map(([, id, sigla, nome]) => ({ id, sigla, nome }));
const ufs = () => ({ versao_id: VERSION, itens: UF_ITEMS.map(item => ({ ...item })) });
const BA = { id: '2913606', nome: 'Ilhéus', uf_id: '29' };
const ITA = { id: '2914802', nome: 'Itabuna', uf_id: '29' };
const SP = { id: '3550308', nome: 'São Paulo', uf_id: '35' };
const RS = { id: '4314902', nome: 'Porto Alegre', uf_id: '43' };
const page = (itens = [BA], cursor = null, version = VERSION) =>
  ({ versao_id: version, itens, paginacao: { proximo_cursor: cursor } });
const user = (overrides = {}) => ({ id: base.USER_ID, organizacao_id: 'org_tche_fertilidade',
  nome: 'Produtor HTTP', email: 'produtor@example.test', perfil: 'produtor', status: 'ativo', versao: 1,
  produtor_id: base.PRODUCER_ID, telefone: null, documento: null, observacoes: null,
  criado_em: '2026-09-01T12:00:00.000Z', atualizado_em: '2026-09-01T12:00:00.000Z', ...overrides });
const users = (itens = [user()], cursor = null) => ({ itens, paginacao: { proximo_cursor: cursor } });
const ok = body => ({ status: 200, body });
const params = request => new URL(request.url).searchParams;
async function fixture(t, profile = 'admin') {
  const f = await base.fixture(profile); const controllers = [];
  f.handlers.users = () => ok(users()); f.handlers.user = () => ok(user());
  f.handlers.ufs = () => ok(ufs());
  f.handlers.municipalities = request => ok(page([{ '29': BA, '35': SP, '43': RS }[params(request).get('uf_id')]]));
  f.holder = (status = 'ativa', limit) => {
    const controller = f.administrativePropertySelectors.createHolder(status, limit);
    controllers.push(controller); return controller;
  };
  f.localities = limit => {
    const controller = f.administrativePropertySelectors.createLocalities(limit);
    controllers.push(controller); return controller;
  };
  t.after(() => { for (const controller of controllers) controller.dispose(); f.dispose(); });
  f.selectorRequests = () => f.requests.filter(request => /\/v1\/(usuarios|localidades)/.test(request.url));
  return f;
}
async function localities(t) {
  const f = await fixture(t); const c = f.localities(); await c.start();
  await c.setUf(c.snapshot.ufs.items.find(item => item.id === '29')); return { f, c };
}
module.exports = { ...base, fixture, localities, VERSION, UF_ITEMS, ufs, BA, ITA, SP, RS, page, user, users, ok, params };
