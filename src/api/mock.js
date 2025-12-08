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
    colaborador_responsavel: 'Carlos',
    data_atividade: new Date().toISOString(),
    tipo_atividade: 'adubacao',
    talhao: 'Talhão A',
    area_aplicada: 50,
    visivel_para_cliente: true
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
