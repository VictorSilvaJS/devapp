// API mock simples para testes offline/local
// Baseado nas entidades definidas em /entities
import { validateUser, validateProdutor, validateVisita, validateCadernoCampo, validateMapa } from './validators';

// Usuários do sistema
const users = [
  {
    id: 'u1',
    nome: 'Admin Sistema',
    email: 'admin@agro.com',
    senha: 'hash123',
    perfil: 'admin',
    telefone: '(51) 99999-9999',
    ativo: true,
    data_cadastro: new Date('2024-01-01').toISOString()
  },
  {
    id: 'u2',
    nome: 'Carlos Silva',
    email: 'carlos@agro.com',
    senha: 'hash456',
    perfil: 'colaborador',
    regiao: 'RS - Norte',
    telefone: '(51) 98888-8888',
    ativo: true,
    data_cadastro: new Date('2024-02-15').toISOString()
  },
  {
    id: 'u3',
    nome: 'Ana Santos',
    email: 'ana@agro.com',
    senha: 'hash789',
    perfil: 'colaborador',
    regiao: 'RS - Sul',
    telefone: '(51) 97777-7777',
    ativo: true,
    data_cadastro: new Date('2024-03-10').toISOString()
  },
  {
    id: 'u4',
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    senha: 'hash321',
    perfil: 'cliente',
    produtor_id: 'p1',
    telefone: '(51) 96666-6666',
    ativo: true,
    data_cadastro: new Date('2024-04-20').toISOString()
  }
];

// Produtores
const produtores = [
  {
    id: 'p1',
    nome: 'João Silva',
    fazenda: 'Fazenda Boa Vista',
    area_total: 850,
    cultura_atual: 'Soja',
    telefone: '(51) 96666-6666',
    email: 'joao.silva@email.com',
    endereco: 'Estrada Rural, Km 12',
    cidade: 'Cruz Alta',
    estado: 'RS',
    cep: '98100-000',
    ultima_analise: new Date('2024-10-15').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'p2',
    nome: 'Maria Pereira',
    fazenda: 'Sítio Esperança',
    area_total: 120,
    cultura_atual: 'Milho',
    telefone: '(55) 95555-5555',
    email: 'maria.pereira@email.com',
    endereco: 'Linha Esperança, s/n',
    cidade: 'Santa Maria',
    estado: 'RS',
    cep: '97105-000',
    ultima_analise: new Date('2024-09-20').toISOString(),
    status: 'pendente',
    data_cadastro: new Date('2024-05-10').toISOString()
  },
  {
    id: 'p3',
    nome: 'Pedro Santos',
    fazenda: 'Estância Santa Clara',
    area_total: 500,
    cultura_atual: 'Trigo',
    telefone: '(54) 94444-4444',
    email: 'pedro.santos@email.com',
    endereco: 'BR-285, Km 45',
    cidade: 'Passo Fundo',
    estado: 'RS',
    cep: '99000-000',
    status: 'ativo',
    data_cadastro: new Date('2024-06-01').toISOString()
  }
];

// Visitas técnicas
const visitas = [
  {
    id: 'v1',
    produtor_id: 'p1',
    tecnico_responsavel: 'Carlos Silva',
    data_visita: new Date().toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Boa presença de plantas. Desenvolvimento adequado da cultura.',
    recomendacoes: 'Monitorar pragas nas próximas semanas.',
    fotos: ['visita1_foto1.jpg', 'visita1_foto2.jpg'],
    clima: 'Ensolarado, 25°C',
    proximaVisita: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v2',
    produtor_id: 'p2',
    tecnico_responsavel: 'Ana Santos',
    data_visita: new Date(Date.now() - 86400000 * 5).toISOString(),
    objetivo: 'coleta_solo',
    observacoes: 'Coleta de amostras em 8 pontos diferentes da propriedade.',
    recomendacoes: 'Aguardar análise laboratorial para recomendações de correção.',
    fotos: ['visita2_foto1.jpg'],
    clima: 'Parcialmente nublado',
    proximaVisita: new Date(Date.now() + 86400000 * 45).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v3',
    produtor_id: 'p1',
    tecnico_responsavel: 'Carlos Silva',
    data_visita: new Date(Date.now() + 86400000 * 7).toISOString(),
    objetivo: 'avaliacao_cultivo',
    observacoes: '',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  {
    id: 'v4',
    produtor_id: 'p3',
    tecnico_responsavel: 'Ana Santos',
    data_visita: new Date(Date.now() - 86400000 * 15).toISOString(),
    objetivo: 'entrega_material',
    observacoes: 'Entrega de relatório de análise de solo e plano de adubação.',
    recomendacoes: 'Iniciar correção do solo conforme plano apresentado.',
    fotos: [],
    clima: 'Chuvoso',
    proximaVisita: new Date(Date.now() + 86400000 * 60).toISOString(),
    status: 'realizada'
  }
];

const cadernos = [
  {
    id: 'c1',
    produtor_id: 'p1',
    colaborador_responsavel: 'Carlos Silva',
    data_atividade: new Date().toISOString(),
    tipo_atividade: 'adubacao',
    talhao: 'Talhão A',
    area_aplicada: 50,
    observacoes: 'Aplicação de NPK 10-20-20 com boa distribuição. Solo em boas condições de umidade.',
    recomendacoes: 'Monitorar crescimento nas próximas 2 semanas. Recomenda-se irrigação leve em caso de seca.',
    visivel_para_cliente: true,
    fotos: ['foto1.jpg', 'foto2.jpg']
  },
  {
    id: 'c2',
    produtor_id: 'p2',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 dias atrás
    tipo_atividade: 'plantio',
    talhao: 'Talhão B',
    area_aplicada: 30,
    observacoes: 'Plantio realizado com sementes selecionadas. Espaçamento adequado mantido.',
    recomendacoes: 'Aplicar herbicida pré-emergente em 3-5 dias.',
    visivel_para_cliente: true,
    fotos: ['foto3.jpg']
  },
  {
    id: 'c3',
    produtor_id: 'p1',
    colaborador_responsavel: 'Carlos Silva',
    data_atividade: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 dias atrás
    tipo_atividade: 'vistoria',
    talhao: 'Talhão C',
    area_aplicada: null,
    observacoes: 'Vistoria de rotina. Identificada presença leve de lagarta.',
    recomendacoes: 'Programar aplicação de inseticida biológico na próxima semana.',
    visivel_para_cliente: false,
    fotos: []
  },
  {
    id: 'c4',
    produtor_id: 'p2',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 dias atrás
    tipo_atividade: 'analise_solo',
    talhao: 'Talhão A',
    area_aplicada: null,
    observacoes: 'Coleta de amostras para análise completa de solo. 10 pontos coletados.',
    recomendacoes: 'Aguardar resultado laboratorial para definir plano de correção.',
    visivel_para_cliente: true,
    fotos: ['foto4.jpg', 'foto5.jpg', 'foto6.jpg']
  },
  {
    id: 'c5',
    produtor_id: 'p1',
    colaborador_responsavel: 'Carlos Silva',
    data_atividade: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 dias atrás
    tipo_atividade: 'aplicacao',
    talhao: 'Talhão D',
    area_aplicada: 75,
    observacoes: 'Aplicação de fungicida preventivo. Condições climáticas favoráveis.',
    recomendacoes: 'Reaplicar em 15 dias ou após chuvas fortes.',
    visivel_para_cliente: true,
    fotos: []
  }
];

// Mapas técnicos
const mapas = [
  {
    id: 'm1',
    titulo: 'Mapa de Fertilidade - Talhão A',
    categoria: 'fertilidade',
    produtor_id: 'p1',
    talhao: 'Talhão A',
    data_criacao: new Date('2024-10-15').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_p1_talhaoa.pdf',
    arquivo_panorama_url: 'mapas/panorama_p1_talhaoa.jpg',
    coordenadas: {
      latitude: -28.6341,
      longitude: -53.6055,
      poligono: [
        { lat: -28.6341, lng: -53.6055 },
        { lat: -28.6350, lng: -53.6055 },
        { lat: -28.6350, lng: -53.6040 },
        { lat: -28.6341, lng: -53.6040 }
      ]
    },
    observacoes: 'Mapa gerado a partir de análise de solo detalhada.',
    disponivel_para_download: true
  },
  {
    id: 'm2',
    titulo: 'Índice de Vegetação - Safra Atual',
    categoria: 'indice_vegetacao',
    produtor_id: 'p1',
    talhao: 'Talhão B',
    data_criacao: new Date('2024-11-20').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/ndvi_p1_talhaob.pdf',
    coordenadas: {
      latitude: -28.6355,
      longitude: -53.6065
    },
    observacoes: 'NDVI obtido via imagem de satélite.',
    disponivel_para_download: true
  },
  {
    id: 'm3',
    titulo: 'Mapa de Correção do Solo',
    categoria: 'correcao',
    produtor_id: 'p2',
    talhao: 'Talhão Principal',
    data_criacao: new Date('2024-09-20').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/correcao_p2_principal.pdf',
    coordenadas: {
      latitude: -29.6842,
      longitude: -53.8069
    },
    observacoes: 'Recomendações de calcário e gesso.',
    disponivel_para_download: false
  }
];

// API para User
export const User = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res([...users]), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const user = users.find(u => u.id === id);
      if (user) res(user); else rej(new Error('Usuário não encontrado'));
    }, 200));
  },
  getByEmail: async (email) => {
    return new Promise((res, rej) => setTimeout(() => {
      const user = users.find(u => u.email === email);
      if (user) res(user); else rej(new Error('Usuário não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return new Promise((res) => setTimeout(() => {
      const result = users.filter(u => keys.every(k => String(u[k]).includes(String(query[k]))));
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateUser(data);
        const id = `u${Date.now()}`;
        const novo = { 
          id, 
          ...data,
          ativo: data.ativo !== undefined ? data.ativo : true,
          data_cadastro: new Date().toISOString()
        };
        users.unshift(novo);
        res(novo);
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = users.findIndex(u => u.id === id);
      if (index === -1) {
        rej(new Error('Usuário não encontrado'));
      } else {
        users[index] = { ...users[index], ...data, id };
        res(users[index]);
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = users.findIndex(u => u.id === id);
      if (index === -1) {
        rej(new Error('Usuário não encontrado'));
      } else {
        users.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};

// API para Produtor
export const Produtor = {
  list: async (order) => {
    return new Promise((res) => setTimeout(() => res([...produtores]), 300));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const p = produtores.find(x => x.id === id);
      if (p) res(p); else rej(new Error('Produtor não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return new Promise((res) => setTimeout(() => {
      const result = produtores.filter(p => keys.every(k => String(p[k]).includes(String(query[k]))));
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateProdutor(data);
        const id = `p${Date.now()}`;
        const novo = { 
          id, 
          ...data,
          status: data.status || 'ativo',
          data_cadastro: new Date().toISOString()
        };
        produtores.unshift(novo);
        res(novo);
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = produtores.findIndex(p => p.id === id);
      if (index === -1) {
        rej(new Error('Produtor não encontrado'));
      } else {
        produtores[index] = { ...produtores[index], ...data, id };
        res(produtores[index]);
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = produtores.findIndex(p => p.id === id);
      if (index === -1) {
        rej(new Error('Produtor não encontrado'));
      } else {
        produtores.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};

// API para Visita
export const Visita = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res([...visitas]), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const visita = visitas.find(v => v.id === id);
      if (visita) res(visita); else rej(new Error('Visita não encontrada'));
    }, 200));
  },
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return new Promise((res) => setTimeout(() => {
      const result = visitas.filter(v => keys.every(k => String(v[k]) === String(query[k])));
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateVisita(data);
        const id = `v${Date.now()}`;
        const novo = { 
          id, 
          ...data,
          status: data.status || 'agendada',
          fotos: data.fotos || []
        };
        visitas.unshift(novo);
        res(novo);
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = visitas.findIndex(v => v.id === id);
      if (index === -1) {
        rej(new Error('Visita não encontrada'));
      } else {
        visitas[index] = { ...visitas[index], ...data, id };
        res(visitas[index]);
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = visitas.findIndex(v => v.id === id);
      if (index === -1) {
        rej(new Error('Visita não encontrada'));
      } else {
        visitas.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};

// API para CadernoCampo
export const CadernoCampo = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res([...cadernos]), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const caderno = cadernos.find(c => c.id === id);
      if (caderno) res(caderno); else rej(new Error('Registro não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return new Promise((res) => setTimeout(() => {
      const result = cadernos.filter(c => keys.every(k => String(c[k]) === String(query[k])));
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateCadernoCampo(data);
        const id = `c${Date.now()}`;
        const novo = { 
          id, 
          ...data,
          visivel_para_cliente: data.visivel_para_cliente !== undefined ? data.visivel_para_cliente : true,
          fotos: data.fotos || [],
          data_criacao: new Date().toISOString()
        };
        cadernos.unshift(novo);
        res(novo);
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) {
        rej(new Error('Registro não encontrado'));
      } else {
        cadernos[index] = { ...cadernos[index], ...data, id };
        res(cadernos[index]);
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) {
        rej(new Error('Registro não encontrado'));
      } else {
        cadernos.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};

// API para Mapa
export const Mapa = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res([...mapas]), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const mapa = mapas.find(m => m.id === id);
      if (mapa) res(mapa); else rej(new Error('Mapa não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return new Promise((res) => setTimeout(() => {
      const result = mapas.filter(m => keys.every(k => String(m[k]) === String(query[k])));
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateMapa(data);
        const id = `m${Date.now()}`;
        const novo = { 
          id, 
          ...data,
          data_criacao: new Date().toISOString(),
          disponivel_para_download: data.disponivel_para_download !== undefined ? data.disponivel_para_download : true
        };
        mapas.unshift(novo);
        res(novo);
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = mapas.findIndex(m => m.id === id);
      if (index === -1) {
        rej(new Error('Mapa não encontrado'));
      } else {
        mapas[index] = { ...mapas[index], ...data, id };
        res(mapas[index]);
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = mapas.findIndex(m => m.id === id);
      if (index === -1) {
        rej(new Error('Mapa não encontrado'));
      } else {
        mapas.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};
