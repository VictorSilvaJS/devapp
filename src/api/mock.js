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
    regiao: 'Sul',
    microregiao: 'RS - Norte',
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
    regiao: 'Sul',
    microregiao: 'RS - Centro',
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
    regiao: 'Sul',
    microregiao: 'RS - Norte',
    cep: '99000-000',
    status: 'ativo',
    data_cadastro: new Date('2024-06-01').toISOString()
  },
  {
    id: 'p4',
    nome: 'Roberto Oliveira',
    fazenda: 'Fazenda Planalto',
    area_total: 1200,
    cultura_atual: 'Soja',
    telefone: '(62) 93333-3333',
    email: 'roberto.oliveira@email.com',
    endereco: 'GO-060, Km 120',
    cidade: 'Rio Verde',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'GO - Sul',
    cep: '75900-000',
    ultima_analise: new Date('2024-11-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-03-15').toISOString()
  },
  {
    id: 'p5',
    nome: 'Fernanda Costa',
    fazenda: 'Agrícola Cerrado Verde',
    area_total: 2500,
    cultura_atual: 'Algodão',
    telefone: '(65) 92222-2222',
    email: 'fernanda.costa@email.com',
    endereco: 'MT-242, s/n',
    cidade: 'Sorriso',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'MT - Norte',
    cep: '78890-000',
    ultima_analise: new Date('2024-10-25').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-02-01').toISOString()
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
    produtos_utilizados: ['NPK 10-20-20', 'Ureia'],
    dosagem: '300 kg/ha',
    area_aplicada: 50,
    condicoes_clima: 'Ensolarado, 22°C',
    observacoes: 'Aplicação realizada com boa distribuição. Solo em boas condições de umidade.',
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
    produtos_utilizados: ['Semente Híbrida AG9045'],
    dosagem: '60.000 sementes/ha',
    area_aplicada: 30,
    condicoes_clima: 'Parcialmente nublado, 20°C',
    observacoes: 'Plantio realizado com sementes selecionadas. Espaçamento de 50cm entre linhas.',
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
    produtos_utilizados: [],
    area_aplicada: null,
    condicoes_clima: 'Ensolarado, 28°C',
    observacoes: 'Vistoria de rotina. Identificada presença leve de lagarta do cartucho. População abaixo do nível de controle.',
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
    produtos_utilizados: [],
    area_aplicada: null,
    condicoes_clima: 'Nublado, 18°C',
    observacoes: 'Coleta de amostras para análise completa de solo. 10 pontos coletados em zigue-zague.',
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
    produtos_utilizados: ['Fungicida Azoxistrobina', 'Adjuvante'],
    dosagem: '0,3 L/ha + 0,5% v/v',
    area_aplicada: 75,
    condicoes_clima: 'Ensolarado, sem vento, 24°C',
    observacoes: 'Aplicação de fungicida preventivo. Condições climáticas favoráveis para aplicação.',
    visivel_para_cliente: true,
    fotos: []
  },
  {
    id: 'c6',
    produtor_id: 'p3',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 dias atrás
    tipo_atividade: 'colheita',
    talhao: 'Talhão Principal',
    produtos_utilizados: [],
    area_aplicada: 120,
    condicoes_clima: 'Seco, 26°C',
    observacoes: 'Colheita iniciada. Produtividade estimada em 4.800 kg/ha. Grãos com boa qualidade.',
    visivel_para_cliente: true,
    fotos: ['colheita1.jpg']
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
  },
  {
    id: 'm4',
    titulo: 'Mapa de Fertilidade - pH do Solo',
    categoria: 'fertilidade',
    subcategoria: 'pH',
    produtor_id: 'p1',
    talhao: 'Talhão C',
    data_criacao: new Date('2024-11-01').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_ph_p1_talhaoc.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 2548000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Análise detalhada do pH em 20 pontos.'
  },
  {
    id: 'm5',
    titulo: 'Mapa de Fertilidade - Fósforo (P)',
    categoria: 'fertilidade',
    subcategoria: 'Fósforo',
    produtor_id: 'p1',
    talhao: 'Talhão A',
    data_criacao: new Date('2024-10-20').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_p_p1_talhaoa.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1890000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Níveis de fósforo disponível no solo.'
  },
  {
    id: 'm6',
    titulo: 'Mapa de Fertilidade - Potássio (K)',
    categoria: 'fertilidade',
    subcategoria: 'Potássio',
    produtor_id: 'p1',
    talhao: 'Talhão A',
    data_criacao: new Date('2024-10-20').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_k_p1_talhaoa.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 2120000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Distribuição de potássio no solo.'
  },
  {
    id: 'm7',
    titulo: 'NDVI - Índice de Vegetação',
    categoria: 'indice_vegetacao',
    subcategoria: 'NDVI',
    produtor_id: 'p1',
    talhao: 'Propriedade Completa',
    data_criacao: new Date('2024-11-28').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/ndvi_p1_completo.jpg',
    formato_arquivo: 'jpg',
    tamanho_arquivo: 4567000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Imagem de satélite Sentinel-2 processada.'
  },
  {
    id: 'm8',
    titulo: 'NDRE - Índice de Clorofila',
    categoria: 'indice_vegetacao',
    subcategoria: 'NDRE',
    produtor_id: 'p1',
    talhao: 'Talhão B',
    data_criacao: new Date('2024-11-25').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/ndre_p1_talhaob.jpg',
    formato_arquivo: 'jpg',
    tamanho_arquivo: 3890000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6355, longitude: -53.6065 },
    observacoes: 'Análise de vigor vegetativo e clorofila.'
  },
  {
    id: 'm9',
    titulo: 'Mapa de Correção - Calcário',
    categoria: 'correcao',
    subcategoria: 'Calcário',
    produtor_id: 'p1',
    talhao: 'Talhão C',
    data_criacao: new Date('2024-10-10').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/correcao_calcario_p1_talhaoc.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1567000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Recomendação de aplicação de calcário variável.'
  },
  {
    id: 'm10',
    titulo: 'Panorama Geral da Propriedade',
    categoria: 'panorama',
    produtor_id: 'p1',
    talhao: 'Todos',
    data_criacao: new Date('2024-11-15').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/panorama_p1_geral.jpg',
    arquivo_panorama_url: 'mapas/panorama_p1_geral.jpg',
    formato_arquivo: 'jpg',
    tamanho_arquivo: 6780000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Vista aérea completa da propriedade.'
  },
  {
    id: 'm11',
    titulo: 'Mapa de Linha de Plantio - AutoCAD',
    categoria: 'plantio',
    produtor_id: 'p1',
    talhao: 'Talhão A',
    data_criacao: new Date('2024-09-01').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/plantio_p1_talhaoa.dwg',
    formato_arquivo: 'dwg',
    tamanho_arquivo: 850000,
    disponivel_download: true,
    coordenadas: { latitude: -28.6341, longitude: -53.6055 },
    observacoes: 'Arquivo CAD com linhas de plantio detalhadas.'
  },
  {
    id: 'm12',
    titulo: 'Mapa de Fertilidade - Matéria Orgânica',
    categoria: 'fertilidade',
    subcategoria: 'Matéria Orgânica',
    produtor_id: 'p4',
    talhao: 'Área 1',
    data_criacao: new Date('2024-11-05').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_mo_p4_area1.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 2340000,
    disponivel_download: true,
    coordenadas: { latitude: -17.7832, longitude: -50.9154 },
    observacoes: 'Distribuição de matéria orgânica no solo - Goiás.'
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
