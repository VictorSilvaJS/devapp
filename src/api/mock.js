// API mock simples para testes offline/local
const produtores = [
  {
    id: 'p1',
    nome: 'João Silva',
    fazenda: 'Fazenda Boa Vista',
    area_total: 850,
    cultura_atual: 'Soja',
    cidade: 'Cruz Alta',
    estado: 'RS',
    status: 'ativo'
  },
  {
    id: 'p2',
    nome: 'Maria Pereira',
    fazenda: 'Sítio Esperança',
    area_total: 120,
    cultura_atual: 'Milho',
    cidade: 'Santa Maria',
    estado: 'RS',
    status: 'pendente'
  }
];

const visitas = [
  {
    id: 'v1',
    produtor_id: 'p1',
    tecnico_responsavel: 'Carlos',
    data_visita: new Date().toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Boa presença de plantas',
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

export const Produtor = {
  list: async (order) => {
    // retorna cópia
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
    const id = `p${Date.now()}`;
    const novo = { id, ...data };
    produtores.unshift(novo);
    return new Promise((res) => setTimeout(() => res(novo), 200));
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

export const Visita = {
  list: async () => new Promise((res) => setTimeout(() => res([...visitas]), 200)),
  filter: async (q) => new Promise((res) => setTimeout(() => res(visitas.filter(v => Object.keys(q).every(k => String(v[k]) === String(q[k])))), 200))
};

export const CadernoCampo = {
  list: async () => new Promise((res) => setTimeout(() => res([...cadernos]), 200)),
  filter: async (q) => new Promise((res) => setTimeout(() => res(cadernos.filter(c => Object.keys(q).every(k => String(c[k]) === String(q[k])))), 200))
};
