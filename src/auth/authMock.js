// mock simples de autenticação
export const users = {
  admin: { id: 'u1', full_name: 'Admin Tchê', perfil: 'admin' },
  colaborador: { id: 'u2', full_name: 'Carlos Silva', perfil: 'colaborador', regiao: 'Região Sul' },
  cliente: { id: 'u3', full_name: 'João Cliente', perfil: 'cliente', produtor_id: 'p1' }
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
