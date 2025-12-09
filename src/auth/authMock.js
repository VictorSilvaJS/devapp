// mock simples de autenticação
export const users = {
  admin: { 
    id: 'u1', 
    full_name: 'Bruna Administradora', 
    perfil: 'admin',
    email: 'bruna@agrotche.com',
    regioes_acesso: ['Sul', 'Centro-Oeste', 'Norte', 'Mato Grosso', 'São Paulo', 'Recife']
  },
  admin2: { 
    id: 'u1b', 
    full_name: 'César Administrador', 
    perfil: 'admin',
    email: 'cesar@agrotche.com',
    regioes_acesso: ['Sul', 'Centro-Oeste', 'Norte', 'Mato Grosso', 'São Paulo', 'Recife']
  },
  colaborador: { 
    id: 'u2', 
    full_name: 'Carlos Silva', 
    perfil: 'colaborador', 
    regiao: 'Goiás',
    email: 'carlos@agrotche.com'
  },
  colaborador2: { 
    id: 'u3', 
    full_name: 'Ana Santos', 
    perfil: 'colaborador', 
    regiao: 'Sul',
    email: 'ana@agrotche.com'
  },
  cliente: { 
    id: 'u4', 
    full_name: 'João Silva', 
    perfil: 'cliente', 
    produtor_id: 'p1',
    email: 'joao.silva@email.com'
  }
};

export const authLogin = async (profileKey) => {
  // simula atraso
  return new Promise((res, rej) => {
    setTimeout(() => {
      const u = users[profileKey];
      if (u) res(u); else rej(new Error('Perfil não encontrado'));
    }, 300);
  });
};

export const authLogout = async () => {
  return new Promise((res) => setTimeout(res, 100));
};
