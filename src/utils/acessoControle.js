/**
 * Utilitários para controle de acesso baseado em perfil e região
 */

/**
 * Verifica se um usuário tem acesso a um produtor
 * @param {Object} user - Usuário logado
 * @param {Object} produtor - Produtor a ser verificado
 * @returns {boolean}
 */
export const temAcessoProdutor = (user, produtor) => {
  if (!user || !produtor) return false;

  // Administrador tem acesso a tudo
  if (user.perfil === 'admin') return true;

  // Cliente só acessa seu próprio produtor
  if (user.perfil === 'cliente') {
    return user.produtor_id === produtor.id;
  }

  // Colaborador só acessa produtores da sua região
  if (user.perfil === 'colaborador') {
    return user.regiao === produtor.regiao;
  }

  return false;
};

/**
 * Filtra lista de produtores de acordo com permissões do usuário
 * @param {Array} produtores - Lista de produtores
 * @param {Object} user - Usuário logado
 * @returns {Array}
 */
export const filtrarProdutoresPorAcesso = (produtores, user) => {
  if (!user || !produtores) return [];

  // Administrador vê todos
  if (user.perfil === 'admin') return produtores;

  // Cliente vê apenas o seu
  if (user.perfil === 'cliente') {
    return produtores.filter(p => p.id === user.produtor_id);
  }

  // Colaborador vê apenas da sua região
  if (user.perfil === 'colaborador') {
    return produtores.filter(p => p.regiao === user.regiao);
  }

  return [];
};

/**
 * Verifica se um usuário tem acesso a um mapa
 * @param {Object} user - Usuário logado
 * @param {Object} mapa - Mapa a ser verificado
 * @param {Object} produtor - Produtor dono do mapa
 * @returns {boolean}
 */
export const temAcessoMapa = (user, mapa, produtor) => {
  if (!user || !mapa) return false;

  // Cliente: acessa apenas mapas disponíveis do seu produtor
  if (user.perfil === 'cliente') {
    return mapa.produtor_id === user.produtor_id && mapa.disponivel_download;
  }

  // Administrador e colaborador: usam a mesma regra de acesso ao produtor
  return temAcessoProdutor(user, produtor);
};

/**
 * Filtra mapas de acordo com permissões do usuário
 * @param {Array} mapas - Lista de mapas
 * @param {Object} user - Usuário logado
 * @param {Array} produtores - Lista de produtores (para verificar região)
 * @returns {Array}
 */
export const filtrarMapasPorAcesso = (mapas, user, produtores = []) => {
  if (!user || !mapas) return [];

  // Administrador vê todos
  if (user.perfil === 'admin') return mapas;

  // Cliente vê apenas mapas disponíveis do seu produtor
  if (user.perfil === 'cliente') {
    return mapas.filter(m => 
      m.produtor_id === user.produtor_id && m.disponivel_download
    );
  }

  // Colaborador vê mapas de produtores da sua região
  if (user.perfil === 'colaborador') {
    const produtoresRegiao = produtores.filter(p => p.regiao === user.regiao);
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return mapas.filter(m => idsRegiao.includes(m.produtor_id));
  }

  return [];
};

/**
 * Verifica se um usuário tem acesso a um registro de caderno de campo
 * @param {Object} user - Usuário logado
 * @param {Object} registro - Registro do caderno
 * @param {Object} produtor - Produtor relacionado
 * @returns {boolean}
 */
export const temAcessoCaderno = (user, registro, produtor) => {
  if (!user || !registro) return false;

  // Administrador vê todos
  if (user.perfil === 'admin') return true;

  // Cliente vê apenas registros visíveis do seu produtor
  if (user.perfil === 'cliente') {
    return (
      registro.produtor_id === user.produtor_id && 
      registro.visivel_para_cliente === true
    );
  }

  // Colaborador vê registros de produtores da sua região
  if (user.perfil === 'colaborador') {
    return produtor && produtor.regiao === user.regiao;
  }

  return false;
};

/**
 * Filtra registros de caderno de campo por acesso
 * @param {Array} registros - Lista de registros
 * @param {Object} user - Usuário logado
 * @param {Array} produtores - Lista de produtores
 * @returns {Array}
 */
export const filtrarCadernosPorAcesso = (registros, user, produtores = []) => {
  if (!user || !registros) return [];

  // Administrador vê todos
  if (user.perfil === 'admin') return registros;

  // Cliente vê apenas registros visíveis do seu produtor
  if (user.perfil === 'cliente') {
    return registros.filter(r => 
      r.produtor_id === user.produtor_id && r.visivel_para_cliente === true
    );
  }

  // Colaborador vê registros de produtores da sua região
  if (user.perfil === 'colaborador') {
    const produtoresRegiao = produtores.filter(p => p.regiao === user.regiao);
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return registros.filter(r => idsRegiao.includes(r.produtor_id));
  }

  return [];
};

/**
 * Verifica se um usuário tem acesso a uma visita
 * @param {Object} user - Usuário logado
 * @param {Object} visita - Visita a ser verificada
 * @param {Object} produtor - Produtor relacionado
 * @returns {boolean}
 */
export const temAcessoVisita = (user, visita, produtor) => {
  if (!user || !visita) return false;

  // Administrador vê todas
  if (user.perfil === 'admin') return true;

  // Cliente vê visitas do seu produtor
  if (user.perfil === 'cliente') {
    return visita.produtor_id === user.produtor_id;
  }

  // Colaborador vê visitas de produtores da sua região
  if (user.perfil === 'colaborador') {
    return produtor && produtor.regiao === user.regiao;
  }

  return false;
};

/**
 * Filtra visitas por acesso
 * @param {Array} visitas - Lista de visitas
 * @param {Object} user - Usuário logado
 * @param {Array} produtores - Lista de produtores
 * @returns {Array}
 */
export const filtrarVisitasPorAcesso = (visitas, user, produtores = []) => {
  if (!user || !visitas) return [];

  // Administrador vê todas
  if (user.perfil === 'admin') return visitas;

  // Cliente vê apenas do seu produtor
  if (user.perfil === 'cliente') {
    return visitas.filter(v => v.produtor_id === user.produtor_id);
  }

  // Colaborador vê visitas de produtores da sua região
  if (user.perfil === 'colaborador') {
    const produtoresRegiao = produtores.filter(p => p.regiao === user.regiao);
    const idsRegiao = produtoresRegiao.map(p => p.id);
    return visitas.filter(v => idsRegiao.includes(v.produtor_id));
  }

  return [];
};

/**
 * Obtém as regiões disponíveis para um usuário
 * @param {Object} user - Usuário logado
 * @param {Array} produtores - Lista de todos os produtores
 * @returns {Array}
 */
export const getRegioesDisponiveis = (user, produtores = []) => {
  if (!user) return [];

  // Administrador vê todas as regiões
  if (user.perfil === 'admin') {
    const regioes = [...new Set(produtores.map(p => p.regiao).filter(Boolean))];
    return regioes.sort();
  }

  // Colaborador vê apenas sua região
  if (user.perfil === 'colaborador' && user.regiao) {
    return [user.regiao];
  }

  // Cliente não precisa ver regiões
  return [];
};

/**
 * Verifica se usuário pode editar um produtor
 * @param {Object} user - Usuário logado
 * @param {Object} produtor - Produtor a ser editado
 * @returns {boolean}
 */
export const podeEditarProdutor = (user, produtor) => {
  if (!user || !produtor) return false;

  // Apenas admin e colaborador podem editar
  if (user.perfil === 'admin') return true;
  
  if (user.perfil === 'colaborador') {
    return user.regiao === produtor.regiao;
  }

  return false;
};

/**
 * Verifica se usuário pode criar novo produtor
 * @param {Object} user - Usuário logado
 * @returns {boolean}
 */
export const podeCriarProdutor = (user) => {
  if (!user) return false;
  // Apenas admin e colaborador podem criar produtores
  return user.perfil === 'admin' || user.perfil === 'colaborador';
};

/**
 * Verifica se usuário pode fazer download de um mapa
 * @param {Object} user - Usuário logado
 * @param {Object} mapa - Mapa a ser baixado
 * @returns {boolean}
 */
export const podeBaixarMapa = (user, mapa) => {
  if (!user || !mapa) return false;

  // Verifica se o mapa está disponível para download
  if (!mapa.disponivel_download) {
    // Apenas admin pode baixar mapas não disponíveis
    return user.perfil === 'admin';
  }

  // Se está disponível, verifica acesso normal
  return user.perfil === 'admin' || 
         user.perfil === 'colaborador' ||
         (user.perfil === 'cliente' && mapa.produtor_id === user.produtor_id);
};

/**
 * Obtém título da tela de acordo com o perfil
 * @param {Object} user - Usuário logado
 * @param {string} tela - Nome da tela
 * @returns {string}
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
    cliente: {
      produtores: 'Minha Propriedade',
      visitas: 'Visitas Recebidas',
      caderno: 'Histórico de Atividades',
      dashboard: 'Minha Propriedade',
    },
  };

  return titulos[user.perfil]?.[tela.toLowerCase()] || tela;
};
