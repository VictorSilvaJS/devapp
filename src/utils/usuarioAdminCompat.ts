import { normalizeNome } from '../domain';
import { getFazendaId, getTitularIdFazenda } from './acessoControle';
import { getFazendaUiInfo } from './fazendaUiCompat';
import {
  getPropriedadeId,
  getPropriedadeNome,
  getTitularId,
  getTitularNome,
} from './propriedadeCompat';

export const PERFIS_USUARIO_ADMIN = [
  { key: 'todos', label: 'Todos' },
  { key: 'produtor', label: 'Produtores' },
  { key: 'colaborador', label: 'Colaboradores' },
  { key: 'admin', label: 'Administradores' },
];

export const STATUS_USUARIO_ADMIN = [
  { key: 'ativo', label: 'Ativo', ativo: true },
  { key: 'inativo', label: 'Inativo', ativo: false },
  { key: 'pendente', label: 'Pendente', ativo: false },
];

export const TIPOS_VINCULO_PROPRIEDADE_USUARIO = [
  { key: 'titular', label: 'Titular' },
  { key: 'responsavel', label: 'Responsável' },
  { key: 'colaborador_atribuido', label: 'Colaborador atribuído' },
  { key: 'outro', label: 'Outro' },
];

export const NIVEIS_ADMIN_USUARIO = [
  { key: 'global', label: 'Global' },
  { key: 'operacional', label: 'Operacional' },
  { key: 'suporte', label: 'Suporte' },
];

const statusLabels = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  pendente: 'Pendente',
};

const validStatus = new Set(Object.keys(statusLabels));

const resolvePropriedadeId = (propriedade: any): string =>
  getFazendaId(propriedade) || getPropriedadeId(propriedade) || '';

const resolveTitularId = (propriedade: any): string =>
  getTitularIdFazenda(propriedade) || getTitularId(propriedade) || '';

const normalizeTerritorio = (value: any): string =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const buildVinculosPropriedadesPorMicroregioes = ({
  propriedades = [],
  regiao,
  microregioes = [],
}: {
  propriedades?: any[];
  regiao?: string;
  microregioes?: string[];
}) => {
  const regiaoNormalizada = normalizeTerritorio(regiao);
  const microregioesNormalizadas = new Set(microregioes.map(normalizeTerritorio).filter(Boolean));

  if (microregioesNormalizadas.size === 0) return [];

  return propriedades
    .filter((propriedade) => {
      const mesmaMicroregiao = microregioesNormalizadas.has(normalizeTerritorio(propriedade?.microregiao));
      const mesmaRegiao =
        !regiaoNormalizada || normalizeTerritorio(propriedade?.regiao) === regiaoNormalizada;
      return mesmaMicroregiao && mesmaRegiao;
    })
    .map((propriedade, index) => ({
      propriedade_id: resolvePropriedadeId(propriedade),
      tipo_vinculo: 'colaborador_atribuido',
      principal: index === 0,
    }))
    .filter((vinculo) => Boolean(vinculo.propriedade_id));
};

export const getUsuarioNome = (usuario: any) => normalizeNome(usuario || {}) || 'Usuário sem nome';

export const getUsuarioPerfilLabel = (perfil?: string) => {
  const labels = {
    admin: 'Administrador',
    colaborador: 'Colaborador',
    produtor: 'Produtor',
  };

  return labels[perfil || ''] || 'Perfil não definido';
};

export const getUsuarioStatusKey = (usuario: any) => {
  if (typeof usuario?.status === 'string' && validStatus.has(usuario.status)) {
    return usuario.status;
  }

  return usuario?.ativo === false ? 'inativo' : 'ativo';
};

export const getUsuarioStatusInfo = (usuario: any) => {
  const key = getUsuarioStatusKey(usuario);
  return {
    key,
    ativo: key === 'ativo',
    label: statusLabels[key] || 'Status não definido',
  };
};

export const getUsuarioProdutorId = (usuario: any) => {
  const produtorId = typeof usuario?.produtor_id === 'string' ? usuario.produtor_id.trim() : '';
  if (produtorId) return produtorId;

  return usuario?.perfil === 'produtor' && typeof usuario?.id === 'string'
    ? usuario.id.trim()
    : '';
};

const normalizeVinculoPropriedade = (vinculo: any, usuarioId?: string) => {
  const propriedadeId = getPropriedadeId(vinculo) || '';

  if (!propriedadeId) return null;

  return {
    usuario_id: vinculo?.usuario_id || usuarioId || '',
    propriedade_id: propriedadeId,
    tipo_vinculo: vinculo?.tipo_vinculo || 'outro',
    principal: vinculo?.principal === true,
  };
};

export const getVinculosPropriedadeUsuario = (usuario: any, propriedades: any[] = []) => {
  if (Array.isArray(usuario?.vinculos_propriedades)) {
    return usuario.vinculos_propriedades
      .map((vinculo) => normalizeVinculoPropriedade(vinculo, usuario?.id))
      .filter(Boolean);
  }

  if (usuario?.perfil === 'produtor') {
    const produtorId = getUsuarioProdutorId(usuario);
    if (!produtorId) return [];

    return propriedades
      .filter((propriedade) => resolveTitularId(propriedade) === produtorId)
      .map((propriedade, index) => ({
        usuario_id: usuario?.id || '',
        propriedade_id: resolvePropriedadeId(propriedade),
        tipo_vinculo: usuario?.tipo_vinculo_produtor || 'titular',
        principal: index === 0,
      }));
  }

  if (usuario?.perfil === 'colaborador' && Array.isArray(usuario?.propriedades_atribuidas)) {
    return usuario.propriedades_atribuidas
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
      .map((id, index) => ({
        usuario_id: usuario?.id || '',
        propriedade_id: id.trim(),
        tipo_vinculo: 'colaborador_atribuido',
        principal: index === 0,
      }));
  }

  return [];
};

export const getVinculosMicroregiaoUsuario = (usuario: any) => {
  if (Array.isArray(usuario?.vinculos_microregioes)) {
    return usuario.vinculos_microregioes
      .filter((vinculo) => typeof vinculo?.microregiao === 'string' && vinculo.microregiao.trim().length > 0)
      .map((vinculo) => ({
        usuario_id: vinculo.usuario_id || usuario?.id || '',
        regiao: typeof vinculo.regiao === 'string' ? vinculo.regiao.trim() : usuario?.regiao || '',
        microregiao: vinculo.microregiao.trim(),
      }));
  }

  return getSubRegioesUsuario(usuario).map((microregiao) => ({
    usuario_id: usuario?.id || '',
    regiao: usuario?.regiao || '',
    microregiao,
  }));
};

export const getSubRegioesUsuario = (usuario: any): string[] =>
  Array.isArray(usuario?.vinculos_microregioes)
    ? usuario.vinculos_microregioes
        .map((vinculo) => vinculo?.microregiao)
        .filter((item) => typeof item === 'string' && item.trim().length > 0)
    : Array.isArray(usuario?.sub_regioes)
    ? usuario.sub_regioes.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

export const getPropriedadeIdsAtribuidas = (usuario: any): string[] =>
  getVinculosPropriedadeUsuario(usuario)
    .filter((vinculo) => usuario?.perfil !== 'colaborador' || vinculo.tipo_vinculo === 'colaborador_atribuido')
    .map((vinculo) => vinculo.propriedade_id);

export const getPropriedadesDoUsuarioProdutor = (usuario: any, propriedades: any[] = []) => {
  const vinculos = getVinculosPropriedadeUsuario(usuario, propriedades);
  if (vinculos.length > 0 || Array.isArray(usuario?.vinculos_propriedades)) {
    const ids = new Set(vinculos.map((vinculo) => vinculo.propriedade_id));
    return propriedades.filter((propriedade) => ids.has(resolvePropriedadeId(propriedade)));
  }

  const produtorId = getUsuarioProdutorId(usuario);
  if (!produtorId) return [];

  return propriedades.filter((propriedade) => resolveTitularId(propriedade) === produtorId);
};

export const getPropriedadesDoColaborador = (usuario: any, propriedades: any[] = []) => {
  const idsAtribuidos = new Set(getPropriedadeIdsAtribuidas(usuario));
  if (idsAtribuidos.size > 0) {
    return propriedades.filter((propriedade) => idsAtribuidos.has(resolvePropriedadeId(propriedade)));
  }

  const subRegioes = new Set(getSubRegioesUsuario(usuario));
  if (subRegioes.size === 0) return [];

  return propriedades.filter((propriedade) => subRegioes.has(propriedade?.microregiao));
};

export const getVinculoPropriedadeLabel = (tipo?: string) => {
  const found = TIPOS_VINCULO_PROPRIEDADE_USUARIO.find((item) => item.key === tipo);
  return found?.label || 'Outro';
};

export const buildUsuarioVinculoPrincipal = (usuario: any, propriedades: any[] = []) => {
  if (usuario?.perfil === 'admin') {
    const nivel = usuario?.nivel_administrativo ? ` • ${getNivelAdminLabel(usuario.nivel_administrativo)}` : '';
    return `Acesso global${nivel}`;
  }

  if (usuario?.perfil === 'colaborador') {
    const subRegioes = getSubRegioesUsuario(usuario);
    const propriedadesAtribuidas = getPropriedadeIdsAtribuidas(usuario);

    if (subRegioes.length > 0) {
      return `${usuario?.regiao || 'Região'} • ${subRegioes.length} microregião${subRegioes.length === 1 ? '' : 's'}`;
    }

    if (propriedadesAtribuidas.length > 0) {
      return `${propriedadesAtribuidas.length} propriedade${propriedadesAtribuidas.length === 1 ? '' : 's'} atribuída${propriedadesAtribuidas.length === 1 ? '' : 's'}`;
    }

    return usuario?.regiao ? `Região ${usuario.regiao}` : 'Sem escopo definido';
  }

  if (usuario?.perfil === 'produtor') {
    const vinculadas = getPropriedadesDoUsuarioProdutor(usuario, propriedades);
    if (vinculadas.length > 0) {
      return `${vinculadas.length} propriedade${vinculadas.length === 1 ? '' : 's'} vinculada${vinculadas.length === 1 ? '' : 's'}`;
    }

    return getUsuarioStatusKey(usuario) === 'pendente' ? 'Pendente de vínculo' : 'Sem propriedade vinculada';
  }

  return 'Vínculo não definido';
};

export const usuarioMatchesBusca = (usuario: any, busca?: string) => {
  const termo = (busca || '').trim().toLowerCase();
  if (!termo) return true;

  const texto = [
    getUsuarioNome(usuario),
    usuario?.email,
    usuario?.telefone,
    usuario?.documento,
    usuario?.perfil,
    usuario?.regiao,
    usuario?.nivel_administrativo,
    ...(getSubRegioesUsuario(usuario) || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return texto.includes(termo);
};

export const buildUsuarioAdminPayload = ({
  form,
  propriedades,
  existing,
}: {
  form: Record<string, any>;
  propriedades?: any[];
  existing?: any;
}) => {
  const perfil = form.perfil || existing?.perfil || 'produtor';
  const status = form.status || existing?.status || 'ativo';
  const ativo = status === 'ativo';
  const base: Record<string, any> = {
    nome: form.nome?.trim() || '',
    email: form.email?.trim() || '',
    telefone: form.telefone?.trim() || '',
    documento: form.documento?.trim() || '',
    perfil,
    status,
    ativo,
    observacoes: form.observacoes?.trim() || '',
    senha: existing?.senha || 'mock123',
  };

  const vinculosPropriedades = normalizeFormVinculosPropriedade(form.vinculosPropriedades);

  if (perfil === 'produtor') {
    const vinculoPrincipal = vinculosPropriedades.find((vinculo) => vinculo.principal) || vinculosPropriedades[0];
    const propriedadePrincipal = (propriedades || []).find(
      (propriedade) => resolvePropriedadeId(propriedade) === vinculoPrincipal?.propriedade_id
    );
    const produtorId =
      resolveTitularId(propriedadePrincipal)
      || form.produtor_id?.trim()
      || existing?.produtor_id
      || '';

    return {
      ...base,
      produtor_id: produtorId,
      tipo_vinculo_produtor: vinculoPrincipal?.tipo_vinculo || 'titular',
      vinculos_propriedades: vinculosPropriedades,
      vinculos_microregioes: [],
      regiao: '',
      cargo: '',
      sub_regioes: [],
      propriedades_atribuidas: [],
      regioes_acesso: [],
      nivel_administrativo: '',
      acesso_global: false,
    };
  }

  if (perfil === 'colaborador') {
    const subRegioes = parseListaTexto(form.subRegioesText);
    const regiao = form.regiao?.trim() || '';
    const vinculosColaborador = buildVinculosPropriedadesPorMicroregioes({
      propriedades,
      regiao,
      microregioes: subRegioes,
    });

    return {
      ...base,
      produtor_id: '',
      tipo_vinculo_produtor: '',
      regiao,
      cargo: form.cargo?.trim() || '',
      sub_regioes: subRegioes,
      propriedades_atribuidas: vinculosColaborador.map((vinculo) => vinculo.propriedade_id),
      vinculos_propriedades: vinculosColaborador,
      vinculos_microregioes: subRegioes.map((microregiao) => ({
        regiao,
        microregiao,
      })),
      regioes_acesso: [],
      nivel_administrativo: '',
      acesso_global: false,
    };
  }

  return {
    ...base,
    produtor_id: '',
    tipo_vinculo_produtor: '',
    regiao: '',
    cargo: '',
    sub_regioes: [],
    propriedades_atribuidas: [],
    vinculos_propriedades: [],
    vinculos_microregioes: [],
    regioes_acesso: ['Brasil'],
    nivel_administrativo: form.nivelAdministrativo || existing?.nivel_administrativo || 'global',
    acesso_global: true,
  };
};

export const parseListaTexto = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeFormVinculosPropriedade = (vinculos?: any[]) => {
  const normalized = Array.isArray(vinculos)
    ? vinculos
        .map((vinculo) => normalizeVinculoPropriedade(vinculo))
        .filter(Boolean)
    : [];

  const hasPrincipal = normalized.some((vinculo) => vinculo.principal);

  return normalized.map((vinculo, index) => ({
    ...vinculo,
    principal: hasPrincipal ? vinculo.principal : index === 0,
  }));
};

export const buildUsuarioFormFromMock = (usuario: any, propriedades: any[] = []) => {
  const vinculosPropriedades = getVinculosPropriedadeUsuario(usuario, propriedades);
  const vinculosMicroregioes = getVinculosMicroregiaoUsuario(usuario);

  return {
    nome: getUsuarioNome(usuario) === 'Usuário sem nome' ? '' : getUsuarioNome(usuario),
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
    documento: usuario?.documento || '',
    perfil: usuario?.perfil || 'produtor',
    status: getUsuarioStatusKey(usuario),
    observacoes: usuario?.observacoes || '',
    vinculosPropriedades,
    produtor_id: usuario?.produtor_id || '',
    regiao: usuario?.regiao || vinculosMicroregioes[0]?.regiao || '',
    cargo: usuario?.cargo || '',
    subRegioesText: vinculosMicroregioes.map((vinculo) => vinculo.microregiao).join(', '),
    nivelAdministrativo: usuario?.nivel_administrativo || 'global',
  };
};

export const getFazendaOptionLabel = (propriedade: any) => {
  const info = getFazendaUiInfo(propriedade);
  return {
    id: info.id,
    title: info.fazendaNome || getPropriedadeNome(propriedade) || 'Propriedade sem nome',
    subtitle: [info.titularNome || getTitularNome(propriedade), info.localizacao].filter(Boolean).join(' • '),
  };
};

export const getNivelAdminLabel = (nivel?: string) => {
  const found = NIVEIS_ADMIN_USUARIO.find((item) => item.key === nivel);
  return found?.label || 'Global';
};
