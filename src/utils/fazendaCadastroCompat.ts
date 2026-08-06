import { listMockProdutoresTitulares } from '../api/produtorCompat';
import { getUsuarioNome, getUsuarioProdutorId, getUsuarioStatusInfo } from './usuarioAdminCompat';

export type CadastroTitularMode = 'existente' | 'novo';

export type CadastroTitularOption = {
  id: string;
  nome: string;
  fazendas_ids: string[];
  fazendas_nomes: string[];
  usuario_id?: string;
  status?: string;
  status_label?: string;
};

export type CadastroFazendaPayload = {
  propriedade_nome: string;
  titular_id: string;
  municipio_id: string;
  municipio_nome: string;
  uf_id: string;
  uf_sigla: string;
  nome: string;
  produtor_nome: string;
  produtor_id: string;
  proprietario_id: string;
  fazenda: string;
  fazenda_nome: string;
  area_total?: number;
  cultura_principal?: string;
  cultura_atual?: string;
  cidade?: string;
  estado?: string;
  status?: string;
};

type BuildCadastroFazendaPayloadInput = {
  mode: CadastroTitularMode;
  titularId?: string | null;
  produtorNome?: string | null;
  fazendaNome?: string | null;
  areaTotal?: string | number | null;
  culturaAtual?: string | null;
  municipioId?: string | null;
  municipioNome?: string | null;
  ufId?: string | null;
  ufSigla?: string | null;
  status?: string | null;
  titulares?: CadastroTitularOption[];
};

type UserScope = {
  perfil?: string;
};

export type CadastroFazendaScopeResult = {
  ok: boolean;
  reason?: 'sem_usuario' | 'perfil_sem_permissao';
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

export const buildCadastroTitularOptionsFromUsers = (
  usuarios: any[] = [],
  fazendas: any[] = []
): CadastroTitularOption[] => {
  const propriedadesPorTitular = new Map(
    buildCadastroTitularOptions(fazendas).map((titular) => [titular.id, titular])
  );
  const options = new Map<string, CadastroTitularOption>();

  usuarios
    .filter((usuario) => usuario?.perfil === 'produtor')
    .forEach((usuario) => {
      const produtorId = getUsuarioProdutorId(usuario);
      if (!produtorId || options.has(produtorId)) return;

      const propriedades = propriedadesPorTitular.get(produtorId);
      const status = getUsuarioStatusInfo(usuario);
      options.set(produtorId, {
        id: produtorId,
        nome: getUsuarioNome(usuario),
        usuario_id: trimString(usuario?.id),
        status: status.key,
        status_label: status.label,
        fazendas_ids: propriedades?.fazendas_ids || [],
        fazendas_nomes: propriedades?.fazendas_nomes || [],
      });
    });

  return Array.from(options.values()).sort((a, b) => a.nome.localeCompare(b.nome));
};

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
  municipioId,
  municipioNome,
  ufId,
  ufSigla,
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
  const areaNormalizada = normalizeArea(areaTotal);
  const statusNormalizado = trimString(status) === 'inativo' ? 'inativo' : 'ativo';
  const payload: CadastroFazendaPayload = {
    propriedade_nome: fazendaNomeFinal,
    titular_id: titularIdFinal,
    municipio_id: trimString(municipioId),
    municipio_nome: trimString(municipioNome),
    uf_id: trimString(ufId),
    uf_sigla: trimString(ufSigla).toUpperCase(),
    nome: titularNomeFinal,
    produtor_nome: titularNomeFinal,
    produtor_id: titularIdFinal,
    proprietario_id: titularIdFinal,
    fazenda: fazendaNomeFinal,
    fazenda_nome: fazendaNomeFinal,
    status: statusNormalizado,
  };

  if (Number.isFinite(areaNormalizada) && areaNormalizada > 0) payload.area_total = areaNormalizada;
  const cultura = trimString(culturaAtual);
  if (cultura) {
    payload.cultura_principal = cultura;
    payload.cultura_atual = cultura;
  }
  payload.cidade = payload.municipio_nome;
  payload.estado = payload.uf_sigla;

  return payload;
};

export const validateCadastroFazendaScope = (
  user: UserScope | null | undefined,
  _payload?: Partial<CadastroFazendaPayload>
): CadastroFazendaScopeResult => {
  if (!user) {
    return { ok: false, reason: 'sem_usuario' };
  }

  if (user.perfil === 'admin') {
    return { ok: true };
  }

  return { ok: false, reason: 'perfil_sem_permissao' };
};
