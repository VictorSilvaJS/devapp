import { listMockProdutoresTitulares } from '../api/produtorCompat';

export type CadastroTitularMode = 'existente' | 'novo';

export type CadastroTitularOption = {
  id: string;
  nome: string;
  fazendas_ids: string[];
  fazendas_nomes: string[];
};

export type CadastroFazendaPayload = {
  nome: string;
  produtor_nome: string;
  produtor_id: string;
  proprietario_id: string;
  fazenda: string;
  fazenda_nome: string;
  area_total: number;
  cultura_atual?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
  microregiao?: string;
  status?: string;
};

type BuildCadastroFazendaPayloadInput = {
  mode: CadastroTitularMode;
  titularId?: string | null;
  produtorNome?: string | null;
  fazendaNome?: string | null;
  areaTotal?: string | number | null;
  culturaAtual?: string | null;
  cidade?: string | null;
  estado?: string | null;
  regiao?: string | null;
  microregiao?: string | null;
  status?: string | null;
  titulares?: CadastroTitularOption[];
};

type UserScope = {
  perfil?: string;
  regiao?: string;
  sub_regioes?: string[];
};

export type CadastroFazendaScopeResult = {
  ok: boolean;
  reason?: 'sem_usuario' | 'perfil_sem_permissao' | 'regiao_fora_escopo' | 'microregiao_fora_escopo';
};

const trimString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = trimString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const normalizeArea = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  return Number.parseFloat(String(value ?? '').replace(',', '.'));
};

const toSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const setOptionalString = (
  target: Record<string, unknown>,
  key: string,
  value: unknown
) => {
  const normalized = trimString(value);
  if (normalized) {
    target[key] = normalized;
  }
};

export const buildCadastroTitularOptions = (fazendas: any[] = []): CadastroTitularOption[] =>
  listMockProdutoresTitulares(fazendas)
    .map((titular) => ({
      id: trimString(titular.id),
      nome: trimString(titular.nome),
      fazendas_ids: Array.isArray(titular.fazendas_ids) ? titular.fazendas_ids : [],
      fazendas_nomes: Array.isArray(titular.fazendas_nomes) ? titular.fazendas_nomes : [],
    }))
    .filter((titular) => titular.id && titular.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome));

export const buildNovoTitularId = (
  produtorNome: string,
  existingTitularIds: string[] = []
): string => {
  const base = `prop_${toSlug(produtorNome) || 'titular'}`;
  const usedIds = new Set(existingTitularIds.map(trimString).filter(Boolean));
  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const buildCadastroFazendaPayload = ({
  mode,
  titularId,
  produtorNome,
  fazendaNome,
  areaTotal,
  culturaAtual,
  cidade,
  estado,
  regiao,
  microregiao,
  status,
  titulares = [],
}: BuildCadastroFazendaPayloadInput): CadastroFazendaPayload => {
  const titularSelecionado = titulares.find((titular) => titular.id === titularId);
  const existingIds = titulares.map((titular) => titular.id);
  const titularNomeFinal =
    mode === 'existente'
      ? firstNonEmptyString(titularSelecionado?.nome, produtorNome)
      : trimString(produtorNome);
  const titularIdFinal =
    mode === 'existente'
      ? firstNonEmptyString(titularSelecionado?.id, titularId)
      : buildNovoTitularId(titularNomeFinal, existingIds);
  const fazendaNomeFinal = trimString(fazendaNome);
  const payload: CadastroFazendaPayload = {
    nome: titularNomeFinal,
    produtor_nome: titularNomeFinal,
    produtor_id: titularIdFinal,
    proprietario_id: titularIdFinal,
    fazenda: fazendaNomeFinal,
    fazenda_nome: fazendaNomeFinal,
    area_total: normalizeArea(areaTotal),
    status: trimString(status) || 'ativo',
  };

  setOptionalString(payload, 'cultura_atual', culturaAtual);
  setOptionalString(payload, 'cidade', cidade);
  setOptionalString(payload, 'estado', trimString(estado).toUpperCase());
  setOptionalString(payload, 'regiao', regiao);
  setOptionalString(payload, 'microregiao', microregiao);

  return payload;
};

export const validateCadastroFazendaScope = (
  user: UserScope | null | undefined,
  payload: Pick<CadastroFazendaPayload, 'regiao' | 'microregiao'>
): CadastroFazendaScopeResult => {
  if (!user) {
    return { ok: false, reason: 'sem_usuario' };
  }

  if (user.perfil === 'admin') {
    return { ok: true };
  }

  if (user.perfil !== 'colaborador') {
    return { ok: false, reason: 'perfil_sem_permissao' };
  }

  if (!trimString(user.regiao) || trimString(payload.regiao) !== trimString(user.regiao)) {
    return { ok: false, reason: 'regiao_fora_escopo' };
  }

  const subRegioesPermitidas = (user.sub_regioes || []).map(trimString).filter(Boolean);
  if (
    subRegioesPermitidas.length === 0 ||
    !subRegioesPermitidas.includes(trimString(payload.microregiao))
  ) {
    return { ok: false, reason: 'microregiao_fora_escopo' };
  }

  return { ok: true };
};

