/**
 * Utilitários para controle de acesso baseado em perfil e região
 * 
 * PERFIS:
 * - admin: Bruna/César - acesso TOTAL ao Brasil
 * - colaborador: Mesmas funcionalidades do admin, mas LIMITADO à sua região/sub-regiões
 * - produtor: (= cliente = proprietário) - Dono da fazenda
 *   - Apenas visualização e download
 *   - Pode incluir dados apenas no caderno de campo
 *   - NÃO pode editar ou incluir outros dados
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
 * Colaboradores têm as MESMAS funcionalidades do admin, limitadas à região
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

const filterByFazendaIds = (items, getId, fazendaIds) => {
  if (!items) return [];

  const allowedIds = buildAllowedIds(fazendaIds);
  if (allowedIds.size === 0) return [];

  return items.filter((item) => allowedIds.has(getId(item)));
};

export const getTitularIdUsuario = (user) => firstNonEmptyString(user?.produtor_id);

export const getFazendaId = (fazenda) => {
  if (!fazenda) return '';

  const explicitId = firstNonEmptyString(fazenda.fazenda_id);
  if (explicitId) {
    return explicitId;
  }

  return normalizeFazenda(fazenda).id;
};

export const getTitularIdFazenda = (fazenda) => {
  if (!fazenda) return '';
  return normalizeFazenda(fazenda).produtor_id;
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
  return normalizeMapa(mapa).fazenda_id;
};

export const getVisitaFazendaId = (visita) => {
  if (!visita) return '';
  return normalizeVisita(visita).fazenda_id;
};

export const getCadernoFazendaId = (registro) => {
  if (!registro) return '';
  return normalizeCadernoCampo(registro).fazenda_id;
};

export const getLimiteAreaFazendaId = (limite) => {
  if (!limite) return '';
  return normalizeLimiteArea(limite).fazenda_id;
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
  options: { somenteVisivelParaProdutor?: boolean } = {}
) => {
  const registrosFiltrados = filterByFazendaIds(registros, getCadernoFazendaId, fazendaIds);

  if (options.somenteVisivelParaProdutor) {
    return registrosFiltrados.filter((registro) => registro.visivel_para_produtor === true);
  }

  return registrosFiltrados;
};

export const filtrarLimitesPorFazendaIds = (limites, fazendaIds) =>
  filterByFazendaIds(limites, getLimiteAreaFazendaId, fazendaIds);

export const getFazendasPorAcesso = (fazendas, user) => {
  if (!user || !fazendas) return [];

  if (isAdmin(user)) return fazendas;

  if (isProdutor(user)) {
    return getFazendasDoTitular(fazendas, user);
  }

  if (isColaborador(user)) {
    return fazendas.filter((fazenda) => produtorNaRegiao(user, fazenda));
  }

  return [];
};

export const getFazendaIdsPorAcesso = (user, fazendas) => getFazendaIds(getFazendasPorAcesso(fazendas, user));

/**
 * Verifica se o produtor/fazenda pertence às sub-regiões do colaborador
 * Usa APENAS sub_regioes para evitar sobreposição entre colaboradores da mesma região
 * Ex: Carlos (sub_regioes: ['Goiás 1', 'Rio Verde', 'Jataí']) não vê produtores de Patrícia (sub_regioes: ['Goiás 2', 'Goiânia', 'Anápolis'])
 */
export const produtorNaRegiao = (user, produtor) => {
  if (!user || !produtor) return false;
  if (isAdmin(user)) return true;
  if (!isColaborador(user)) return false;

  // Verificar sub-regiões do colaborador contra microregiao do produtor
  if (user.sub_regioes && produtor.microregiao) {
    return user.sub_regioes.includes(produtor.microregiao);
  }

  return false;
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

  // Colaborador: acessa produtores da sua região/sub-regiões
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
 * NOTA: Produtor PODE incluir dados no caderno de campo (única exceção de edição)
 */
export const temAcessoCaderno = (user, registro, produtor) => {
  if (!user || !registro) return false;

  if (isAdmin(user)) return true;

  // Produtor: vê registros visíveis das suas fazendas
  if (isProdutor(user)) {
    return fazendaPertenceAoTitular(produtor, user) && registro.visivel_para_produtor === true;
  }

  if (isColaborador(user)) {
    return produtor && produtorNaRegiao(user, produtor);
  }

  return false;
};

/**
 * Filtra registros de caderno de campo por acesso
 */
export const filtrarCadernosPorAcesso = (registros, user, produtores = []) => {
  if (!user || !registros) return [];

  if (isAdmin(user)) return registros;

  const fazendaIdsPermitidos = getFazendaIdsPorAcesso(user, produtores);

  return filtrarCadernosPorFazendaIds(registros, fazendaIdsPermitidos, {
    somenteVisivelParaProdutor: isProdutor(user),
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
// REGIÕES E SUB-REGIÕES
// ────────────────────────────────────────────────────────────────

/**
 * Obtém as regiões disponíveis para um usuário
 * Sub-regiões: Goiás 1, Goiás 2, Goiânia, Rio Verde, etc.
 */
export const getRegioesDisponiveis = (user, produtores = []) => {
  if (!user) return [];

  if (isAdmin(user)) {
    const regioes = [...new Set(produtores.map(p => p.regiao).filter(Boolean))];
    return regioes.sort();
  }

  if (isColaborador(user)) {
    // Retorna região principal e sub-regiões
    const regioes = [user.regiao];
    if (user.sub_regioes) {
      regioes.push(...user.sub_regioes);
    }
    return [...new Set(regioes)];
  }

  return [];
};

/**
 * Obtém as sub-regiões de um colaborador
 */
export const getSubRegioes = (user) => {
  if (!user || !isColaborador(user)) return [];
  return user.sub_regioes || [];
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
 * Verifica se usuário pode criar novo produtor/fazenda
 * Produtor (proprietário) NÃO pode criar
 */
export const podeCriarProdutor = (user) => {
  if (!user) return false;
  return podeGerenciar(user); // admin ou colaborador
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
 * Verifica se usuário pode incluir registros no caderno de campo
 * EXCEÇÃO: Produtor PODE incluir dados no caderno de campo
 */
export const podeIncluirCaderno = (user) => {
  if (!user) return false;
  // Todos podem incluir no caderno: admin, colaborador E produtor
  return true;
};

/**
 * Verifica se usuário pode editar registros do caderno (edição completa)
 * Produtor pode incluir MAS não pode editar registros existentes de outros
 */
export const podeEditarCaderno = (user, registro) => {
  if (!user || !registro) return false;

  if (isAdmin(user)) return true;
  if (isColaborador(user)) return true;

  // Produtor pode editar apenas seus próprios registros do caderno
  if (isProdutor(user) && registro.criado_por === user.id) {
    return true;
  }

  return false;
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

  if (isAdmin(user) || isColaborador(user)) return true;
  
  if (isProdutor(user)) {
    const minhasFazendas = getFazendasDoTitular(produtores, user);
    const minhasFazendaIds = getFazendaIds(minhasFazendas);

    if (minhasFazendaIds.length > 0) {
      return minhasFazendaIds.includes(mapaNormalizado.fazenda_id);
    }

    // Fallback temporário enquanto nem todos os chamadores enviam as fazendas.
    return mapaNormalizado.fazenda_id === getTitularIdUsuario(user);
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
      produtores: 'Minhas Fazendas',
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
    colaborador: 'Consultor Regional',
    produtor: 'Proprietário',
  };
  return labels[user.perfil] || user.perfil;
};
