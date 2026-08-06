/**
 * Utilitários para controle de acesso baseado em perfil e vínculo direto.
 * 
 * PERFIS:
 * - admin: Bruna/César - acesso TOTAL ao Brasil
 * - colaborador: funcionalidades operacionais limitadas às Propriedades vinculadas
 * - produtor: (= cliente = proprietário) - Dono da fazenda
 *   - Apenas visualização e download
 *   - Pode registrar caderno de campo nas próprias fazendas
 *   - Consulta Safra/Safrinha vinculada à sua Propriedade, sem gerenciar períodos
 *   - Não edita ou remove registros do caderno no MVP atual
 *   - Um produtor pode ter VÁRIAS fazendas (1:N)
 *   - Várias pessoas podem ter login vinculado ao mesmo proprietário
 */

import {
  normalizeCadernoCampo,
  normalizeFazenda,
  normalizeLimiteArea,
  normalizeMapa,
  normalizeVisita,
} from '../domain';
import {
  getCadernoEstado,
  isCadernoDraft,
  isCadernoDraftOwner,
  isCadernoOperational,
} from './cadernoLifecycleCompat';

// ────────────────────────────────────────────────────────────────
// HELPERS DE PERFIL
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se o usuário é administrador
 */
export const isAdmin = (user) => user?.perfil === 'admin';

/**
 * Verifica se o usuário é colaborador
 */
export const isColaborador = (user) => user?.perfil === 'colaborador';

/**
 * Verifica se o usuário é produtor/cliente/proprietário
 * Todos os termos se referem à mesma pessoa: o dono da fazenda
 */
export const isProdutor = (user) => user?.perfil === 'produtor';

/**
 * Verifica se o usuário pode gerenciar dados (admin ou colaborador)
 * O recurso concreto ainda precisa passar pela validação da Propriedade.
 */
export const podeGerenciar = (user) => isAdmin(user) || isColaborador(user);

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return '';
};

const buildAllowedIds = (ids = []) =>
  new Set((ids || []).filter((value) => typeof value === 'string' && value.trim().length > 0));

const getVinculosPropriedadeAtivos = (user) =>
  (Array.isArray(user?.vinculos_propriedades) ? user.vinculos_propriedades : [])
    .filter((vinculo) => vinculo?.status !== 'inativo')
    .filter((vinculo) => firstNonEmptyString(vinculo?.propriedade_id));

export const getPropriedadeIdsVinculados = (user) => {
  if (!user) return [];

  const tiposPermitidos = isColaborador(user)
    ? new Set(['colaborador', 'colaborador_atribuido'])
    : isProdutor(user)
      ? new Set(['titular', 'usuario_autorizado', 'responsavel'])
      : null;

  return [...new Set(
    getVinculosPropriedadeAtivos(user)
      .filter((vinculo) => !tiposPermitidos || tiposPermitidos.has(vinculo?.tipo_vinculo))
      .map((vinculo) => firstNonEmptyString(vinculo?.propriedade_id))
      .filter(Boolean)
  )];
};

const filterByFazendaIds = (items, getId, fazendaIds) => {
  if (!items) return [];

  const allowedIds = buildAllowedIds(fazendaIds);
  if (allowedIds.size === 0) return [];

  return items.filter((item) => allowedIds.has(getId(item)));
};

const cadernoVisivelParaProdutor = (registro) => registro?.visivel_para_produtor !== false;

const cadernoVisivelNaLista = (
  registro,
  options: {
    somenteVisivelParaProdutor?: boolean;
    incluirRascunhosDoUsuario?: boolean;
    usuarioId?: string;
  } = {}
) => {
  if (isCadernoDraft(registro)) {
    return options.incluirRascunhosDoUsuario === true
      && isCadernoDraftOwner(registro, options.usuarioId);
  }

  if (!isCadernoOperational(registro)) return false;
  if (options.somenteVisivelParaProdutor && !cadernoVisivelParaProdutor(registro)) return false;
  return true;
};

export const getTitularIdUsuario = (user) => firstNonEmptyString(user?.produtor_id);

export const getFazendaId = (fazenda) => {
  if (!fazenda) return '';

  return firstNonEmptyString(
    fazenda.propriedade_id,
    fazenda.propriedadeId,
    normalizeFazenda(fazenda).id,
    fazenda.fazenda_id,
    fazenda.fazendaId
  );
};

export const getTitularIdFazenda = (fazenda) => {
  if (!fazenda) return '';
  return normalizeFazenda(fazenda).titular_id;
};

export const getNomeFazenda = (fazenda) => {
  if (!fazenda) return '';
  return normalizeFazenda(fazenda).nome;
};

export const getNomeTitularFazenda = (fazenda) => {
  if (!fazenda) return '';
  const normalized = normalizeFazenda(fazenda);
  return firstNonEmptyString(normalized.produtor_nome, fazenda?.nome);
};

export const getMapaFazendaId = (mapa) => {
  if (!mapa) return '';
  return normalizeMapa(mapa).propriedade_id;
};

export const getVisitaFazendaId = (visita) => {
  if (!visita) return '';
  return normalizeVisita(visita).propriedade_id;
};

export const getCadernoFazendaId = (registro) => {
  if (!registro) return '';
  return normalizeCadernoCampo(registro).propriedade_id;
};

export const getLimiteAreaFazendaId = (limite) => {
  if (!limite) return '';
  return normalizeLimiteArea(limite).propriedade_id;
};

export const findFazendaById = (fazendas, fazendaId) => {
  if (!fazendas || !fazendaId) return null;
  return fazendas.find((fazenda) => getFazendaId(fazenda) === fazendaId) || null;
};

export const avaliarAcessoFazendaPorId = (fazendas, user, fazendaId) => {
  const idNormalizado = firstNonEmptyString(fazendaId);

  if (!idNormalizado) {
    return {
      status: 'fazenda_nao_encontrada',
      fazenda: null,
      fazendaId: '',
    };
  }

  const fazenda = findFazendaById(fazendas, idNormalizado);

  if (!fazenda) {
    return {
      status: 'fazenda_nao_encontrada',
      fazenda: null,
      fazendaId: idNormalizado,
    };
  }

  if (!temAcessoProdutor(user, fazenda)) {
    return {
      status: 'acesso_negado',
      fazenda,
      fazendaId: getFazendaId(fazenda),
    };
  }

  return {
    status: 'permitido',
    fazenda,
    fazendaId: getFazendaId(fazenda),
  };
};

export const fazendaPertenceAoTitular = (fazenda, titularIdOrUser) => {
  const titularId =
    typeof titularIdOrUser === 'string'
      ? titularIdOrUser
      : getTitularIdUsuario(titularIdOrUser);

  if (!fazenda || !titularId) return false;
  return getTitularIdFazenda(fazenda) === titularId;
};

export const getFazendasDoTitular = (fazendas, titularIdOrUser) => {
  if (!fazendas) return [];
  return fazendas.filter((fazenda) => fazendaPertenceAoTitular(fazenda, titularIdOrUser));
};

export const getFazendaIds = (fazendas) => {
  if (!fazendas) return [];
  return fazendas.map((fazenda) => getFazendaId(fazenda)).filter(Boolean);
};

export const filtrarMapasPorFazendaIds = (
  mapas,
  fazendaIds,
  options: { somenteDisponiveisDownload?: boolean } = {}
) => {
  const mapasFiltrados = filterByFazendaIds(mapas, getMapaFazendaId, fazendaIds);

  if (options.somenteDisponiveisDownload) {
    return mapasFiltrados.filter((mapa) => normalizeMapa(mapa).disponivel_download);
  }

  return mapasFiltrados;
};

export const filtrarVisitasPorFazendaIds = (visitas, fazendaIds) =>
  filterByFazendaIds(visitas, getVisitaFazendaId, fazendaIds);

export const filtrarCadernosPorFazendaIds = (
  registros,
  fazendaIds,
  options: {
    somenteVisivelParaProdutor?: boolean;
    incluirRascunhosDoUsuario?: boolean;
    usuarioId?: string;
  } = {}
) => {
  const registrosFiltrados = filterByFazendaIds(registros, getCadernoFazendaId, fazendaIds);
  return registrosFiltrados.filter((registro) => cadernoVisivelNaLista(registro, options));
};

export const filtrarLimitesPorFazendaIds = (limites, fazendaIds) =>
  filterByFazendaIds(limites, getLimiteAreaFazendaId, fazendaIds);

export const getFazendasPorAcesso = (fazendas, user) => {
  if (!user || !fazendas) return [];

  if (isAdmin(user)) return fazendas;

  if (isProdutor(user)) {
    const idsVinculados = buildAllowedIds(getPropriedadeIdsVinculados(user));
    if (idsVinculados.size > 0) {
      return fazendas.filter((fazenda) => idsVinculados.has(getFazendaId(fazenda)));
    }
    return getFazendasDoTitular(fazendas, user);
  }

  if (isColaborador(user)) {
    const idsVinculados = buildAllowedIds(getPropriedadeIdsVinculados(user));
    return fazendas.filter((fazenda) => idsVinculados.has(getFazendaId(fazenda)));
  }

  return [];
};

export const getFazendaIdsPorAcesso = (user, fazendas) => getFazendaIds(getFazendasPorAcesso(fazendas, user));

/**
 * Alias temporário para consumidores antigos. Região não participa mais da
 * autorização; o resultado depende exclusivamente do vínculo direto ativo.
 */
export const produtorNaRegiao = (user, produtor) => {
  if (!user || !produtor) return false;
  if (isAdmin(user)) return true;
  if (!isColaborador(user)) return false;

  return getPropriedadeIdsVinculados(user).includes(getFazendaId(produtor));
};

// ────────────────────────────────────────────────────────────────
// ACESSO A PRODUTORES (PROPRIETÁRIOS / FAZENDAS)
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se um usuário tem acesso a um produtor/proprietário
 * Produtor = Cliente = Proprietário (é o dono da fazenda)
 * Um proprietário pode ter VÁRIAS fazendas
 */
export const temAcessoProdutor = (user, produtor) => {
  if (!user || !produtor) return false;

  // Admin: acesso total
  if (isAdmin(user)) return true;

  // Produtor/Cliente: acessa apenas suas próprias fazendas (pelo produtor_id = proprietário)
  if (isProdutor(user)) {
    return fazendaPertenceAoTitular(produtor, user);
  }

  // Colaborador: acessa somente Propriedades vinculadas diretamente.
  if (isColaborador(user)) {
    return produtorNaRegiao(user, produtor);
  }

  return false;
};

/**
 * Filtra lista de produtores/fazendas de acordo com permissões
 */
export const filtrarProdutoresPorAcesso = (produtores, user) => {
  return getFazendasPorAcesso(produtores, user);
};

// ────────────────────────────────────────────────────────────────
// ACESSO A MAPAS
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se um usuário tem acesso a um mapa
 */
export const temAcessoMapa = (user, mapa, produtor) => {
  if (!user || !mapa) return false;

  if (isAdmin(user)) return true;

  const mapaNormalizado = normalizeMapa(mapa);

  // Produtor: acessa apenas mapas disponíveis para download das suas fazendas
  if (isProdutor(user)) {
    return fazendaPertenceAoTitular(produtor, user) && mapaNormalizado.disponivel_download;
  }

  // Admin e colaborador: usam regra de acesso ao produtor
  return temAcessoProdutor(user, produtor);
};

/**
 * Filtra mapas de acordo com permissões do usuário
 */
export const filtrarMapasPorAcesso = (mapas, user, produtores = []) => {
  if (!user || !mapas) return [];

  if (isAdmin(user)) return mapas;

  const fazendaIdsPermitidos = getFazendaIdsPorAcesso(user, produtores);

  return filtrarMapasPorFazendaIds(mapas, fazendaIdsPermitidos, {
    somenteDisponiveisDownload: isProdutor(user),
  });
};

// ────────────────────────────────────────────────────────────────
// ACESSO A CADERNO DE CAMPO
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se um usuário tem acesso a um registro de caderno de campo
 */
export const temAcessoCaderno = (user, registro, produtor) => {
  if (!user || !registro) return false;

  if (isCadernoDraft(registro)) {
    return isCadernoDraftOwner(registro, user?.id);
  }

  if (isAdmin(user)) return true;

  // Produtor: vê registros visíveis das suas fazendas
  if (isProdutor(user)) {
    return isCadernoOperational(registro)
      && fazendaPertenceAoTitular(produtor, user)
      && cadernoVisivelParaProdutor(registro);
  }

  if (isColaborador(user)) {
    return produtor && produtorNaRegiao(user, produtor);
  }

  return false;
};

export const avaliarAcessoCaderno = (user, registro, fazendas = []) => {
  if (!user || !registro) {
    return {
      status: 'caderno_nao_encontrado',
      fazenda: null,
      fazendaId: '',
    };
  }

  const fazendaId = getCadernoFazendaId(registro);
  const acessoFazenda = avaliarAcessoFazendaPorId(fazendas, user, fazendaId);

  if (acessoFazenda.status !== 'permitido') {
    return acessoFazenda;
  }

  if (!temAcessoCaderno(user, registro, acessoFazenda.fazenda)) {
    return {
      status: 'acesso_negado',
      fazenda: acessoFazenda.fazenda,
      fazendaId: acessoFazenda.fazendaId,
    };
  }

  return acessoFazenda;
};

/**
 * Filtra registros de caderno de campo por acesso
 */
export const filtrarCadernosPorAcesso = (registros, user, produtores = []) => {
  if (!user || !registros) return [];

  const fazendaIdsPermitidos = getFazendaIdsPorAcesso(user, produtores);

  return filtrarCadernosPorFazendaIds(registros, fazendaIdsPermitidos, {
    somenteVisivelParaProdutor: isProdutor(user),
    incluirRascunhosDoUsuario: true,
    usuarioId: user?.id,
  });
};

// ────────────────────────────────────────────────────────────────
// ACESSO A VISITAS
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se um usuário tem acesso a uma visita
 */
export const temAcessoVisita = (user, visita, produtor) => {
  if (!user || !visita) return false;

  if (isAdmin(user)) return true;

  // Produtor: vê visitas das suas fazendas (apenas visualização)
  if (isProdutor(user)) {
    return fazendaPertenceAoTitular(produtor, user);
  }

  if (isColaborador(user)) {
    return produtor && produtorNaRegiao(user, produtor);
  }

  return false;
};

export const avaliarAcessoVisita = (user, visita, fazendas = []) => {
  if (!user || !visita) {
    return {
      status: 'visita_nao_encontrada',
      fazenda: null,
      fazendaId: '',
    };
  }

  const fazendaId = getVisitaFazendaId(visita);
  const acessoFazenda = avaliarAcessoFazendaPorId(fazendas, user, fazendaId);

  if (acessoFazenda.status !== 'permitido') {
    return acessoFazenda;
  }

  if (!temAcessoVisita(user, visita, acessoFazenda.fazenda)) {
    return {
      status: 'acesso_negado',
      fazenda: acessoFazenda.fazenda,
      fazendaId: acessoFazenda.fazendaId,
    };
  }

  return acessoFazenda;
};

/**
 * Filtra visitas por acesso
 */
export const filtrarVisitasPorAcesso = (visitas, user, produtores = []) => {
  if (!user || !visitas) return [];

  if (isAdmin(user)) return visitas;

  const fazendaIdsPermitidos = getFazendaIdsPorAcesso(user, produtores);
  return filtrarVisitasPorFazendaIds(visitas, fazendaIdsPermitidos);
};

export const filtrarLimitesPorAcesso = (limites, user, produtores = []) => {
  if (!user || !limites) return [];

  if (isAdmin(user)) return limites;

  const fazendaIdsPermitidos = getFazendaIdsPorAcesso(user, produtores);
  return filtrarLimitesPorFazendaIds(limites, fazendaIdsPermitidos);
};

// ────────────────────────────────────────────────────────────────
// LOCALIZAÇÃO (FILTRO, NÃO AUTORIZAÇÃO)
// ────────────────────────────────────────────────────────────────

/**
 * Mantém o nome público por compatibilidade. Os valores retornados são
 * localizações das Propriedades já autorizadas, nunca fonte de permissão.
 */
export const getRegioesDisponiveis = (user, produtores = []) => {
  if (!user) return [];

  if (isAdmin(user)) {
    const localizacoes = [...new Set(produtores
      .map((propriedade) => [propriedade?.cidade, propriedade?.estado].filter(Boolean).join(' - '))
      .filter(Boolean))];
    return localizacoes.sort();
  }

  if (isColaborador(user)) {
    return getFazendasPorAcesso(produtores, user)
      .map((propriedade) => [propriedade?.cidade, propriedade?.estado].filter(Boolean).join(' - '))
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort();
  }

  return [];
};

/**
 * Obtém as sub-regiões de um colaborador
 */
export const getSubRegioes = (user) => {
  return [];
};

// ────────────────────────────────────────────────────────────────
// PERMISSÕES DE EDIÇÃO/CRIAÇÃO
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se usuário pode editar um produtor/fazenda
 * Produtor (proprietário) NÃO pode editar - apenas visualizar
 */
export const podeEditarProdutor = (user, produtor) => {
  if (!user || !produtor) return false;

  if (isAdmin(user)) return true;
  
  if (isColaborador(user)) {
    return produtorNaRegiao(user, produtor);
  }

  // Produtor NÃO pode editar dados de produtor
  return false;
};

/**
 * Verifica se usuário pode excluir um produtor/fazenda.
 * Por enquanto segue a mesma regra defensiva de edição estrutural:
 * admin pode, colaborador apenas dentro do seu escopo, produtor não pode.
 */
export const podeExcluirProdutor = (user, produtor) => podeEditarProdutor(user, produtor);

/**
 * Cadastro estrutural de Propriedade é administrativo no contrato v2.
 */
export const podeCriarProdutor = (user) => {
  if (!user) return false;
  return isAdmin(user);
};

/**
 * Edição cadastral estrutural da Propriedade e de seus vínculos diretos.
 * Operações técnicas do Colaborador continuam usando podeEditarProdutor.
 */
export const podeEditarCadastroPropriedade = (user, propriedade) => {
  if (!user || !propriedade) return false;
  return isAdmin(user);
};

/**
 * Verifica se usuário pode criar visitas
 * Produtor NÃO pode criar visitas
 */
export const podeCriarVisita = (user) => {
  if (!user) return false;
  return podeGerenciar(user);
};

export const podeCriarVisitaEmFazenda = (user, fazenda) => {
  if (!podeCriarVisita(user)) return false;
  return temAcessoProdutor(user, fazenda);
};

/**
 * Verifica se usuário pode editar visitas
 * Produtor NÃO pode editar visitas
 */
export const podeEditarVisita = (user, visita, produtor) => {
  if (!user || !visita) return false;

  if (isAdmin(user)) return true;
  
  if (isColaborador(user)) {
    return produtor && produtorNaRegiao(user, produtor);
  }

  return false;
};

/**
 * Verifica se usuario pode incluir registros no caderno de campo.
 * Produtor registra apenas nas Propriedades do proprio vinculo efetivo.
 */
export const podeIncluirCaderno = (user) => {
  if (!user) return false;
  return podeGerenciar(user) || isProdutor(user);
};

export const podeIncluirCadernoEmFazenda = (user, fazenda) => {
  if (!podeIncluirCaderno(user)) return false;
  return temAcessoProdutor(user, fazenda);
};

/**
 * Verifica se usuario pode gerenciar Safra/Safrinha local.
 * Produtor consulta e usa o periodo no Caderno, mas nao cria/edita no MVP.
 */
export const podeGerenciarPeriodoProdutivo = (user) => {
  if (!user) return false;
  return podeGerenciar(user);
};

export const podeGerenciarPeriodoProdutivoEmFazenda = (user, fazenda) => {
  if (!podeGerenciarPeriodoProdutivo(user)) return false;
  return temAcessoProdutor(user, fazenda);
};

/**
 * Edição destrutiva existe somente enquanto o registro é rascunho e pertence ao criador.
 */
export const podeEditarCaderno = (user, registro, fazenda = null) => {
  if (!user || !registro) return false;
  if (!isCadernoDraftOwner(registro, user?.id)) return false;
  if (isAdmin(user) || isProdutor(user)) return true;
  return isColaborador(user) && (fazenda ? produtorNaRegiao(user, fazenda) : true);
};

export const podeEditarCadernoEmFazenda = (user, registro, fazenda) => {
  if (!registro || !fazenda) return false;
  if (!temAcessoProdutor(user, fazenda)) return false;
  return podeEditarCaderno(user, registro, fazenda);
};

/**
 * Complemento, correção, visibilidade, arquivamento e anulação são comandos da equipe.
 * A versão e o estado ainda são revalidados atomicamente pelo contrato do Caderno.
 */
export const podeExecutarComandoCaderno = (user, registro, fazenda = null) => {
  if (!user || !registro || !['registrado', 'arquivado'].includes(getCadernoEstado(registro))) {
    return false;
  }
  if (isAdmin(user)) return true;
  return isColaborador(user) && (fazenda ? produtorNaRegiao(user, fazenda) : true);
};

/**
 * Verifica se usuário pode fazer download de um mapa
 */
export const podeBaixarMapa = (user, mapa, produtores = []) => {
  if (!user || !mapa) return false;

  const mapaNormalizado = normalizeMapa(mapa);

  if (!mapaNormalizado.disponivel_download) {
    return isAdmin(user);
  }

  if (isAdmin(user)) return true;

  if (isColaborador(user)) {
    return getPropriedadeIdsVinculados(user).includes(mapaNormalizado.propriedade_id);
  }
  
  if (isProdutor(user)) {
    const minhasFazendas = getFazendasDoTitular(produtores, user);
    const minhasFazendaIds = getFazendaIds(minhasFazendas);

    if (minhasFazendaIds.length > 0) {
      return minhasFazendaIds.includes(mapaNormalizado.propriedade_id);
    }

    // Fallback temporário enquanto nem todos os chamadores enviam as fazendas.
    return mapaNormalizado.propriedade_id === getTitularIdUsuario(user);
  }

  return false;
};

// ────────────────────────────────────────────────────────────────
// TÍTULOS E LABELS POR PERFIL
// ────────────────────────────────────────────────────────────────

/**
 * Obtém título da tela de acordo com o perfil
 */
export const getTituloTela = (user, tela) => {
  if (!user) return tela;

  const titulos = {
    admin: {
      produtores: 'Produtores',
      visitas: 'Visitas',
      caderno: 'Caderno de Campo',
      dashboard: 'Dashboard Geral',
    },
    colaborador: {
      produtores: 'Meus Produtores',
      visitas: 'Minhas Visitas',
      caderno: 'Caderno de Campo',
      dashboard: 'Meu Dashboard',
    },
    produtor: {
      produtores: 'Minhas Propriedades',
      visitas: 'Visitas Recebidas',
      caderno: 'Caderno de Campo',
      dashboard: 'Minha Propriedade',
    },
  };

  return titulos[user.perfil]?.[tela.toLowerCase()] || tela;
};

/**
 * Obtém label do perfil para exibição
 * Nota: "Colaborador" NÃO deve aparecer na tela de login
 */
export const getLabelPerfil = (user) => {
  if (!user) return '';
  const labels = {
    admin: 'Administrador',
    colaborador: 'Colaborador',
    produtor: 'Proprietário',
  };
  return labels[user.perfil] || user.perfil;
};
