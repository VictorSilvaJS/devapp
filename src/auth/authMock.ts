/**
 * Mock de autenticação com email/senha
 * 
 * ESTRUTURA DE PERFIS:
 * 
 * 1. ADMINISTRADOR (admin): personas demonstrativas
 *    - Acesso TOTAL ao Brasil
 *    - Todas as funcionalidades
 * 
 * 2. COLABORADOR (colaborador): Acesso regional
 *    - Mesmas funcionalidades do admin, mas limitado à sua região/sub-regiões
 *    - NÃO aparece "colaborador" no login - direcionamento automático
 *    - Regiões divididas por sub-regiões: Goiás 1, Goiás 2, Goiânia, Rio Verde, etc.
 * 
 * 3. PRODUTOR (produtor = cliente = proprietário): Dono da fazenda
 *    - Acesso apenas para visualização e download
 *    - Pode incluir dados apenas no caderno de campo
 *    - NÃO pode editar ou incluir outros dados
 *    - Um produtor pode ter VÁRIAS fazendas (1:N)
 *    - Várias pessoas (pai, mãe) podem ter login vinculado ao mesmo produtor
 */
import { normalizeUsuario } from '../domain';

const toCanonicalAuthUser = (user) => {
  const { senha: _senha, ...userData } = user;
  return normalizeUsuario(userData);
};

export const users = [
  // ─── ADMINISTRADORES ─ Acesso total ao Brasil ──────────────────
  { 
    id: 'u1', 
    full_name: 'Admin Demonstração',
    perfil: 'admin',
    email: 'admin.demonstracao@example.com',
    senha: 'admin123',
    regioes_acesso: ['Brasil']
  },
  { 
    id: 'u1b', 
    full_name: 'Admin Apoio Demonstração',
    perfil: 'admin',
    email: 'admin.apoio@example.com',
    senha: 'admin123',
    regioes_acesso: ['Brasil']
  },

  // ─── COLABORADORES ─ Acesso regional (mesmas funções do admin, limitado à região) ──
  { 
    id: 'u2', 
    full_name: 'Colaborador Campo Goiás',
    perfil: 'colaborador', 
    regiao: 'Goiás',
    sub_regioes: ['Goiás 1', 'Rio Verde', 'Jataí'],
    email: 'colaborador.goias@example.com',
    senha: 'colab123'
  },
  { 
    id: 'u3', 
    full_name: 'Colaborador Campo Sul',
    perfil: 'colaborador', 
    regiao: 'Sul',
    sub_regioes: ['RS - Norte', 'RS - Centro', 'RS - Sul'],
    email: 'colaborador.sul@example.com',
    senha: 'colab123'
  },
  { 
    id: 'u5', 
    full_name: 'Colaborador de Campo',
    perfil: 'colaborador', 
    regiao: 'Mato Grosso',
    sub_regioes: ['MT - Norte', 'Sorriso', 'Lucas do Rio Verde'],
    email: 'colaborador.campo@example.com',
    senha: 'colab123'
  },
  { 
    id: 'u6', 
    full_name: 'Colaborador Campo Goiás 2',
    perfil: 'colaborador', 
    regiao: 'Goiás',
    sub_regioes: ['Goiás 2', 'Goiânia', 'Anápolis'],
    email: 'colaborador.goias2@example.com',
    senha: 'colab123'
  },

  // ─── PRODUTORES / CLIENTES / PROPRIETÁRIOS ─ Donos de fazenda ──
  // Produtor = Cliente = Proprietário (MESMA PESSOA)
  // Várias pessoas podem ter login vinculado ao mesmo produtor (pai, mãe, etc)
  // Um produtor pode ter VÁRIAS fazendas (relação 1:N)
  { 
    id: 'u7', 
    full_name: 'Produtor Demonstração Sul',
    perfil: 'produtor',
    produtor_id: 'prop1', // proprietário - pode ter várias fazendas
    email: 'produtor.sul@example.com',
    senha: 'prod123'
  },
  { 
    id: 'u8', 
    full_name: 'Responsável Demonstração Sul',
    perfil: 'produtor',
    produtor_id: 'prop1', // mesmo proprietário (João e Maria são da mesma família)
    email: 'responsavel.sul@example.com',
    senha: 'prod123'
  },
  { 
    id: 'u9', 
    full_name: 'Produtor Demonstração Goiás',
    perfil: 'produtor',
    produtor_id: 'prop2',
    email: 'produtor.goias@example.com',
    senha: 'prod123'
  },
  { 
    id: 'u10', 
    full_name: 'Produtor Demonstração MT',
    perfil: 'produtor',
    produtor_id: 'prop3',
    email: 'produtor.mt@example.com',
    senha: 'prod123'
  },
  { 
    id: 'u11', 
    full_name: 'Produtor Demonstração Norte RS',
    perfil: 'produtor',
    produtor_id: 'prop_pedro',
    email: 'produtor.norte.rs@example.com',
    senha: 'prod123'
  },
  { 
    id: 'u12', 
    full_name: 'Produtor Demonstração Centro RS',
    perfil: 'produtor',
    produtor_id: 'prop_maria',
    email: 'produtor.centro.rs@example.com',
    senha: 'prod123'
  },
  {
    id: 'u_sela1',
    full_name: 'Produtor Demonstração',
    perfil: 'produtor',
    produtor_id: 'prop_sela1',
    email: 'produtor.demonstracao@example.com',
    senha: 'prod123'
  },
];

/**
 * Login por email e senha
 * Direcionamento automático baseado no perfil do usuário
 * (não aparece "colaborador" - roteamento automático)
 */
export const authLogin = async (email, senha) => {
  return new Promise((res, rej) => {
    setTimeout(() => {
      const u = users.find(
        user => user.email.toLowerCase() === email.toLowerCase() && user.senha === senha
      );
      if (u) {
        res(toCanonicalAuthUser(u));
      } else {
        rej(new Error('Email ou senha incorretos'));
      }
    }, 500);
  });
};

/**
 * Login rápido por perfil (apenas para desenvolvimento/testes)
 */
export const authLoginByProfile = async (profileKey) => {
  return new Promise((res, rej) => {
    setTimeout(() => {
      const profileMap = {
        'admin': users.find(u => u.id === 'u1'),
        'admin2': users.find(u => u.id === 'u1b'),
        'colaborador': users.find(u => u.id === 'u5'),
        'colaborador2': users.find(u => u.id === 'u3'),
        'produtor': users.find(u => u.id === 'u_sela1'),
        'produtor2': users.find(u => u.id === 'u9'),
      };
      const u = profileMap[profileKey];
      if (u) {
        res(toCanonicalAuthUser(u));
      } else {
        rej(new Error('Perfil não encontrado'));
      }
    }, 300);
  });
};

export const authLogout = async () => {
  return new Promise((res) => setTimeout(res, 100));
};
