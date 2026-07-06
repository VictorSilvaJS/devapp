import type {
  CadernoCampoCanonico,
  CadernoCampoCompativelBorda,
  CadernoCampoLegado,
  FazendaCanonica,
  FazendaCompativelBorda,
  FazendaLegada,
  LimiteAreaCanonico,
  LimiteAreaCompativelBorda,
  LimiteAreaLegado,
  MapaCanonico,
  MapaCompativelBorda,
  MapaLegado,
  ProdutorCanonico,
  UsuarioCanonico,
  UsuarioCompativelBorda,
  UsuarioLegado,
  VisitaCanonica,
  VisitaCompativelBorda,
  VisitaLegada,
} from './contracts';

const hasOwn = (value: unknown, key: string) =>
  typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

const firstDefined = <T>(...values: Array<T | undefined>): T | undefined => {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
};

export const normalizeNome = (input: { nome?: unknown; full_name?: unknown }): string =>
  firstNonEmptyString(input.nome, input.full_name) ?? '';

export const normalizeDisponibilidadeDownload = (input: {
  disponivel_download?: boolean;
  disponivel_para_download?: boolean;
}): boolean => firstDefined(input.disponivel_download, input.disponivel_para_download) ?? true;

export const normalizeUsuario = (
  raw: UsuarioLegado | UsuarioCanonico | UsuarioCompativelBorda
): UsuarioCanonico => {
  const { full_name: _legacyFullName, ...rest } = raw as UsuarioLegado & UsuarioCanonico;

  return {
    ...rest,
    id: raw.id,
    nome: normalizeNome(raw),
    perfil: raw.perfil ?? '',
  };
};

export const toUsuarioCompativelBorda = (
  raw: UsuarioLegado | UsuarioCanonico | UsuarioCompativelBorda
): UsuarioCompativelBorda => {
  const canonico = normalizeUsuario(raw);

  return {
    ...canonico,
    full_name: canonico.nome,
  };
};

export const deriveProdutorFromUsuario = (
  raw: UsuarioLegado | UsuarioCanonico | UsuarioCompativelBorda
): ProdutorCanonico | null => {
  const usuario = normalizeUsuario(raw);

  if (!usuario.produtor_id || !usuario.nome) {
    return null;
  }

  return {
    id: usuario.produtor_id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    ativo: usuario.ativo,
    data_cadastro: usuario.data_cadastro,
  };
};

export const deriveProdutorFromFazenda = (
  raw: FazendaLegada | FazendaCanonica | FazendaCompativelBorda
): ProdutorCanonico | null => {
  const fazenda = normalizeFazenda(raw);
  const nome = firstNonEmptyString(fazenda.produtor_nome);

  if (!fazenda.produtor_id || !nome) {
    return null;
  }

  return {
    id: fazenda.produtor_id,
    nome,
    email: fazenda.email,
    telefone: fazenda.telefone,
    data_cadastro: fazenda.data_cadastro,
    ativo: fazenda.status === 'ativo' ? true : undefined,
  };
};

export const normalizeFazenda = (
  raw: FazendaLegada | FazendaCanonica | FazendaCompativelBorda
): FazendaCanonica => {
  const legadoComNomeSeparado = hasOwn(raw, 'fazenda');
  const {
    proprietario_id,
    fazenda,
    produtor_nome,
    nome,
    ...rest
  } = raw as FazendaLegada & FazendaCanonica & FazendaCompativelBorda;

  return {
    ...rest,
    id: raw.id,
    produtor_id: firstNonEmptyString(rest.produtor_id, proprietario_id) ?? '',
    nome: legadoComNomeSeparado
      ? firstNonEmptyString(fazenda, nome) ?? ''
      : firstNonEmptyString(nome) ?? '',
    produtor_nome: legadoComNomeSeparado
      ? firstNonEmptyString(nome, produtor_nome)
      : firstNonEmptyString(produtor_nome),
  };
};

export const toFazendaCompativelBorda = (
  raw: FazendaLegada | FazendaCanonica | FazendaCompativelBorda
): FazendaCompativelBorda => {
  const fazendaCanonica = normalizeFazenda(raw);

  return {
    ...fazendaCanonica,
    nome: firstNonEmptyString(fazendaCanonica.produtor_nome, fazendaCanonica.nome) ?? '',
    fazenda: fazendaCanonica.nome,
    proprietario_id: fazendaCanonica.produtor_id,
    produtor_nome: fazendaCanonica.produtor_nome,
  };
};

export const normalizeMapa = (
  raw: MapaLegado | MapaCanonico | MapaCompativelBorda
): MapaCanonico => {
  const {
    produtor_id,
    fazenda_id,
    disponivel_para_download,
    disponivel_download,
    ...rest
  } = raw as MapaLegado & MapaCanonico & MapaCompativelBorda;

  return {
    ...rest,
    id: raw.id,
    titulo: raw.titulo ?? '',
    categoria: raw.categoria ?? '',
    talhao: raw.talhao ?? '',
    fazenda_id: firstNonEmptyString(fazenda_id, produtor_id) ?? '',
    disponivel_download: normalizeDisponibilidadeDownload({
      disponivel_download,
      disponivel_para_download,
    }),
  };
};

export const toMapaCompativelBorda = (
  raw: MapaLegado | MapaCanonico | MapaCompativelBorda
): MapaCompativelBorda => {
  const mapa = normalizeMapa(raw);

  return {
    ...mapa,
    produtor_id: mapa.fazenda_id,
    disponivel_para_download: mapa.disponivel_download,
  };
};

export const normalizeVisita = (
  raw: VisitaLegada | VisitaCanonica | VisitaCompativelBorda
): VisitaCanonica => {
  const { produtor_id, fazenda_id, ...rest } = raw as VisitaLegada & VisitaCanonica & VisitaCompativelBorda;

  return {
    ...rest,
    id: raw.id,
    fazenda_id: firstNonEmptyString(fazenda_id, produtor_id) ?? '',
    tecnico_responsavel: raw.tecnico_responsavel ?? '',
    data_visita: raw.data_visita ?? '',
    objetivo: raw.objetivo ?? '',
  };
};

export const toVisitaCompativelBorda = (
  raw: VisitaLegada | VisitaCanonica | VisitaCompativelBorda
): VisitaCompativelBorda => {
  const visita = normalizeVisita(raw);

  return {
    ...visita,
    produtor_id: visita.fazenda_id,
  };
};

export const normalizeCadernoCampo = (
  raw: CadernoCampoLegado | CadernoCampoCanonico | CadernoCampoCompativelBorda
): CadernoCampoCanonico => {
  const { produtor_id, criado_por, fazenda_id, fazendaId, ...rest } =
    raw as CadernoCampoLegado & CadernoCampoCanonico & CadernoCampoCompativelBorda;
  const contextoFazendaId = firstNonEmptyString(fazenda_id, fazendaId, produtor_id) ?? '';

  return {
    ...rest,
    id: raw.id,
    fazenda_id: contextoFazendaId,
    fazendaId: contextoFazendaId,
    colaborador_responsavel: raw.colaborador_responsavel ?? '',
    data_atividade: raw.data_atividade ?? '',
    tipo_atividade: raw.tipo_atividade ?? '',
    criado_por_user_id: firstNonEmptyString(raw.criado_por_user_id, criado_por),
  };
};

export const toCadernoCampoCompativelBorda = (
  raw: CadernoCampoLegado | CadernoCampoCanonico | CadernoCampoCompativelBorda
): CadernoCampoCompativelBorda => {
  const caderno = normalizeCadernoCampo(raw);

  return {
    ...caderno,
    produtor_id: caderno.fazenda_id,
    criado_por: caderno.criado_por_user_id,
    fazendaId: caderno.fazenda_id,
  };
};

export const normalizeLimiteArea = (
  raw: LimiteAreaLegado | LimiteAreaCanonico | LimiteAreaCompativelBorda
): LimiteAreaCanonico => {
  const { produtor_id, fazenda_id, ...rest } =
    raw as LimiteAreaLegado & LimiteAreaCanonico & LimiteAreaCompativelBorda;

  return {
    ...rest,
    id: raw.id,
    nome: raw.nome ?? '',
    ano: raw.ano ?? 0,
    fazenda_id: firstNonEmptyString(fazenda_id, produtor_id) ?? '',
    talhao: raw.talhao ?? '',
    poligono: raw.poligono ?? [],
  };
};

export const toLimiteAreaCompativelBorda = (
  raw: LimiteAreaLegado | LimiteAreaCanonico | LimiteAreaCompativelBorda
): LimiteAreaCompativelBorda => {
  const limite = normalizeLimiteArea(raw);

  return {
    ...limite,
    produtor_id: limite.fazenda_id,
  };
};
