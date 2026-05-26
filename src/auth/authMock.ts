/**
 * Mock de autenticação com email/senha
 * 
 * ESTRUTURA DE PERFIS:
 * 
 * 1. ADMINISTRADOR (admin): Bruna e César
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
    full_name: 'Bruna Administradora', 
    perfil: 'admin',
    email: 'bruna@agrotche.com',
    senha: 'admin123',
    regioes_acesso: ['Brasil']
  },
  { 
    id: 'u1b', 
    full_name: 'César Administrador', 
    perfil: 'admin',
    email: 'cesar@agrotche.com',
    senha: 'admin123',
    regioes_acesso: ['Brasil']
  },

  // ─── COLABORADORES ─ Acesso regional (mesmas funções do admin, limitado à região) ──
  { 
    id: 'u2', 
    full_name: 'Carlos Silva', 
    perfil: 'colaborador', 
    regiao: 'Goiás',
    sub_regioes: ['Goiás 1', 'Rio Verde', 'Jataí'],
    email: 'carlos@agrotche.com',
    senha: 'colab123'
  },
  { 
    id: 'u3', 
    full_name: 'Ana Santos', 
    perfil: 'colaborador', 
    regiao: 'Sul',
    sub_regioes: ['RS - Norte', 'RS - Centro', 'RS - Sul'],
    email: 'ana@agrotche.com',
    senha: 'colab123'
  },
  { 
    id: 'u5', 
    full_name: 'Marcos Ferreira', 
    perfil: 'colaborador', 
    regiao: 'Mato Grosso',
    sub_regioes: ['MT - Norte', 'Sorriso', 'Lucas do Rio Verde'],
    email: 'marcos@agrotche.com',
    senha: 'colab123'
  },
  { 
    id: 'u6', 
    full_name: 'Patrícia Lima', 
    perfil: 'colaborador', 
    regiao: 'Goiás',
    sub_regioes: ['Goiás 2', 'Goiânia', 'Anápolis'],
    email: 'patricia@agrotche.com',
    senha: 'colab123'
  },

  // ─── PRODUTORES / CLIENTES / PROPRIETÁRIOS ─ Donos de fazenda ──
  // Produtor = Cliente = Proprietário (MESMA PESSOA)
  // Várias pessoas podem ter login vinculado ao mesmo produtor (pai, mãe, etc)
  // Um produtor pode ter VÁRIAS fazendas (relação 1:N)
  { 
    id: 'u7', 
    full_name: 'João Silva', 
    perfil: 'produtor',
    produtor_id: 'prop1', // proprietário - pode ter várias fazendas
    email: 'joao.silva@email.com',
    senha: 'prod123'
  },
  { 
    id: 'u8', 
    full_name: 'Maria Silva', // Esposa do João - mesmo proprietário
    perfil: 'produtor',
    produtor_id: 'prop1', // mesmo proprietário (João e Maria são da mesma família)
    email: 'maria.silva@email.com',
    senha: 'prod123'
  },
  { 
    id: 'u9', 
    full_name: 'Roberto Oliveira', 
    perfil: 'produtor',
    produtor_id: 'prop2',
    email: 'roberto@email.com',
    senha: 'prod123'
  },
  { 
    id: 'u10', 
    full_name: 'Fernanda Costa', 
    perfil: 'produtor',
    produtor_id: 'prop3',
    email: 'fernanda@email.com',
    senha: 'prod123'
  },
  { 
    id: 'u11', 
    full_name: 'Pedro Santos', 
    perfil: 'produtor',
    produtor_id: 'prop_pedro',
    email: 'pedro.santos@email.com',
    senha: 'prod123'
  },
  { 
    id: 'u12', 
    full_name: 'Maria Pereira', 
    perfil: 'produtor',
    produtor_id: 'prop_maria',
    email: 'maria.pereira@email.com',
    senha: 'prod123'
  },
  {
    id: 'u_sela1',
    full_name: 'Fazenda Sela de Prata I',
    perfil: 'produtor',
    produtor_id: 'prop_sela1',
    email: 'seladeprataI@agrotche.com',
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
        'colaborador': users.find(u => u.id === 'u2'),
        'colaborador2': users.find(u => u.id === 'u3'),
        'produtor': users.find(u => u.id === 'u7'),
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
