import { normalizeNome } from '../domain';
import { getFazendaId, getTitularIdFazenda } from './acessoControle';
import { getFazendaUiInfo } from './fazendaUiCompat';

export const PERFIS_USUARIO_ADMIN = [
  { key: 'todos', label: 'Todos' },
  { key: 'produtor', label: 'Produtores' },
  { key: 'colaborador', label: 'Colaboradores' },
  { key: 'admin', label: 'Admins' },
];

export const STATUS_USUARIO_ADMIN = [
  { key: 'ativo', label: 'Ativo', ativo: true },
  { key: 'inativo', label: 'Inativo', ativo: false },
];

export const getUsuarioNome = (usuario: any) => normalizeNome(usuario || {}) || 'Usuário sem nome';

export const getUsuarioPerfilLabel = (perfil?: string) => {
  const labels = {
    admin: 'Admin',
    colaborador: 'Colaborador',
    produtor: 'Produtor',
  };

  return labels[perfil || ''] || 'Perfil não definido';
};

export const getUsuarioStatusInfo = (usuario: any) => {
  const ativo = usuario?.ativo !== false;
  return {
    ativo,
    label: ativo ? 'Ativo' : 'Inativo',
  };
};

export const getUsuarioProdutorId = (usuario: any) =>
  typeof usuario?.produtor_id === 'string' ? usuario.produtor_id.trim() : '';

export const getSubRegioesUsuario = (usuario: any): string[] =>
  Array.isArray(usuario?.sub_regioes)
    ? usuario.sub_regioes.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

export const getPropriedadeIdsAtribuidas = (usuario: any): string[] =>
  Array.isArray(usuario?.propriedades_atribuidas)
    ? usuario.propriedades_atribuidas.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

export const getPropriedadesDoUsuarioProdutor = (usuario: any, propriedades: any[] = []) => {
  const produtorId = getUsuarioProdutorId(usuario);
  if (!produtorId) return [];

  return propriedades.filter((propriedade) => getTitularIdFazenda(propriedade) === produtorId);
};

export const getPropriedadesDoColaborador = (usuario: any, propriedades: any[] = []) => {
  const idsAtribuidos = new Set(getPropriedadeIdsAtribuidas(usuario));
  if (idsAtribuidos.size > 0) {
    return propriedades.filter((propriedade) => idsAtribuidos.has(getFazendaId(propriedade)));
  }

  const subRegioes = new Set(getSubRegioesUsuario(usuario));
  if (subRegioes.size === 0) return [];

  return propriedades.filter((propriedade) => subRegioes.has(propriedade?.microregiao));
};

export const buildUsuarioVinculoPrincipal = (usuario: any, propriedades: any[] = []) => {
  if (usuario?.perfil === 'admin') {
    return 'Acesso global';
  }

  if (usuario?.perfil === 'colaborador') {
    const subRegioes = getSubRegioesUsuario(usuario);
    if (subRegioes.length > 0) {
      return `${usuario?.regiao || 'Região'} • ${subRegioes.length} sub-região${subRegioes.length === 1 ? '' : 's'}`;
    }

    return usuario?.regiao ? `Região ${usuario.regiao}` : 'Sem escopo definido';
  }

  if (usuario?.perfil === 'produtor') {
    const vinculadas = getPropriedadesDoUsuarioProdutor(usuario, propriedades);
    if (vinculadas.length > 0) {
      return `${vinculadas.length} propriedade${vinculadas.length === 1 ? '' : 's'} vinculada${vinculadas.length === 1 ? '' : 's'}`;
    }

    return 'Sem propriedade vinculada';
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
    usuario?.perfil,
    usuario?.regiao,
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
  const ativo = form.status === 'inativo' ? false : true;
  const base: Record<string, any> = {
    nome: form.nome?.trim() || '',
    email: form.email?.trim() || '',
    telefone: form.telefone?.trim() || '',
    perfil,
    ativo,
    observacoes: form.observacoes?.trim() || '',
    senha: existing?.senha || 'mock123',
  };

  if (perfil === 'produtor') {
    const propriedadeSelecionada = (propriedades || []).find(
      (propriedade) => getFazendaId(propriedade) === form.propriedadePrincipalId
    );
    const produtorId =
      form.produtor_id?.trim()
      || getTitularIdFazenda(propriedadeSelecionada)
      || existing?.produtor_id
      || '';

    return {
      ...base,
      produtor_id: produtorId,
      tipo_vinculo_produtor: form.tipoVinculoProdutor || 'titular',
      regiao: '',
      cargo: '',
      sub_regioes: [],
      propriedades_atribuidas: [],
      regioes_acesso: [],
      acesso_global: false,
    };
  }

  if (perfil === 'colaborador') {
    return {
      ...base,
      produtor_id: '',
      tipo_vinculo_produtor: '',
      regiao: form.regiao?.trim() || '',
      cargo: form.cargo?.trim() || '',
      sub_regioes: parseListaTexto(form.subRegioesText),
      propriedades_atribuidas: Array.isArray(form.propriedadesAtribuidas)
        ? form.propriedadesAtribuidas
        : [],
      regioes_acesso: [],
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
    regioes_acesso: ['Brasil'],
    acesso_global: true,
  };
};

export const parseListaTexto = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const buildUsuarioFormFromMock = (usuario: any, propriedades: any[] = []) => {
  const propriedadesProdutor = getPropriedadesDoUsuarioProdutor(usuario, propriedades);
  const propriedadePrincipal = propriedadesProdutor[0];

  return {
    nome: getUsuarioNome(usuario) === 'Usuário sem nome' ? '' : getUsuarioNome(usuario),
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
    perfil: usuario?.perfil || 'produtor',
    status: usuario?.ativo === false ? 'inativo' : 'ativo',
    observacoes: usuario?.observacoes || '',
    propriedadePrincipalId: propriedadePrincipal ? getFazendaId(propriedadePrincipal) : '',
    produtor_id: usuario?.produtor_id || '',
    tipoVinculoProdutor: usuario?.tipo_vinculo_produtor || 'titular',
    regiao: usuario?.regiao || '',
    cargo: usuario?.cargo || '',
    subRegioesText: getSubRegioesUsuario(usuario).join(', '),
    propriedadesAtribuidas: getPropriedadeIdsAtribuidas(usuario),
  };
};

export const getFazendaOptionLabel = (propriedade: any) => {
  const info = getFazendaUiInfo(propriedade);
  return {
    id: info.id,
    title: info.fazendaNome || 'Propriedade sem nome',
    subtitle: [info.titularNome, info.localizacao].filter(Boolean).join(' • '),
  };
};
