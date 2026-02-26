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

/**
 * Verifica se o produtor/fazenda pertence à região do colaborador
 * Considera tanto a região principal quanto as sub-regiões
 * Ex: Goiás 1, Goiás 2, Goiânia, Rio Verde
 */
export const produtorNaRegiao = (user, produtor) => {
  if (!user || !produtor) return false;
  if (isAdmin(user)) return true;
  if (!isColaborador(user)) return false;

  // Verificar região principal
  if (user.regiao === produtor.regiao) return true;
  
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
    return user.produtor_id === produtor.proprietario_id || user.produtor_id === produtor.id;
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
  if (!user || !produtores) return [];

  if (isAdmin(user)) return produtores;

  if (isProdutor(user)) {
    return produtores.filter(p => 
      p.proprietario_id === user.produtor_id || p.id === user.produtor_id
    );
  }

  if (isColaborador(user)) {
    return produtores.filter(p => produtorNaRegiao(user, p));
  }

  return [];
};

// ────────────────────────────────────────────────────────────────
// ACESSO A MAPAS
// ────────────────────────────────────────────────────────────────

/**
 * Verifica se um usuário tem acesso a um mapa
 */
export const temAcessoMapa = (user, mapa, produtor) => {
  if (!user || !mapa) return false;

  // Produtor: acessa apenas mapas disponíveis para download das suas fazendas
  if (isProdutor(user)) {
    const pertence = mapa.produtor_id === user.produtor_id || 
      (produtor && (produtor.proprietario_id === user.produtor_id));
    return pertence && mapa.disponivel_download;
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

  if (isProdutor(user)) {
    // Produtor vê apenas mapas disponíveis das suas fazendas
    const meusProdutorIds = produtores
      .filter(p => p.proprietario_id === user.produtor_id || p.id === user.produtor_id)
      .map(p => p.id);
    return mapas.filter(m => 
      meusProdutorIds.includes(m.produtor_id) && m.disponivel_download
    );
  }

  if (isColaborador(user)) {
    const produtoresRegiao = produtores.filter(p => produtorNaRegiao(user, p));
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return mapas.filter(m => idsRegiao.includes(m.produtor_id));
  }

  return [];
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
    const pertence = registro.produtor_id === user.produtor_id ||
      (produtor && produtor.proprietario_id === user.produtor_id);
    return pertence && registro.visivel_para_produtor === true;
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

  if (isProdutor(user)) {
    const meusProdutorIds = produtores
      .filter(p => p.proprietario_id === user.produtor_id || p.id === user.produtor_id)
      .map(p => p.id);
    return registros.filter(r => 
      meusProdutorIds.includes(r.produtor_id) && r.visivel_para_produtor === true
    );
  }

  if (isColaborador(user)) {
    const produtoresRegiao = produtores.filter(p => produtorNaRegiao(user, p));
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return registros.filter(r => idsRegiao.includes(r.produtor_id));
  }

  return [];
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
    return visita.produtor_id === user.produtor_id ||
      (produtor && produtor.proprietario_id === user.produtor_id);
  }

  if (isColaborador(user)) {
    return produtor && produtorNaRegiao(user, produtor);
  }

  return false;
};

/**
 * Filtra visitas por acesso
 */
export const filtrarVisitasPorAcesso = (visitas, user, produtores = []) => {
  if (!user || !visitas) return [];

  if (isAdmin(user)) return visitas;

  if (isProdutor(user)) {
    const meusProdutorIds = produtores
      .filter(p => p.proprietario_id === user.produtor_id || p.id === user.produtor_id)
      .map(p => p.id);
    return visitas.filter(v => meusProdutorIds.includes(v.produtor_id));
  }

  if (isColaborador(user)) {
    const produtoresRegiao = produtores.filter(p => produtorNaRegiao(user, p));
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return visitas.filter(v => idsRegiao.includes(v.produtor_id));
  }

  return [];
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
export const podeBaixarMapa = (user, mapa) => {
  if (!user || !mapa) return false;

  if (!mapa.disponivel_download) {
    return isAdmin(user);
  }

  if (isAdmin(user) || isColaborador(user)) return true;
  
  if (isProdutor(user)) {
    return mapa.produtor_id === user.produtor_id;
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
