// API mock simples para testes offline/local
// Baseado nas entidades definidas em /entities
import {
  validateUser,
  validateProdutor,
  validateVisita,
  validateCadernoCampo,
  validateMapa,
  validateLimiteArea,
} from './validators';
import {
  filterMockCadernosCampo,
  filterMockLimitesArea,
  filterMockMapas,
  filterMockVisitas,
  listMockCadernosCampo,
  listMockLimitesArea,
  listMockMapas,
  listMockVisitas,
  persistMockCadernoCampo,
  persistMockLimiteArea,
  persistMockMapa,
  persistMockVisita,
  readMockCadernoCampo,
  readMockLimiteArea,
  readMockMapa,
  readMockVisita,
} from './mockCompat';
import {
  buildFazendaDeleteIntegrity,
  filterMockProdutores,
  listMockProdutores,
  persistMockProdutor,
  readMockProdutor,
} from './produtorCompat';
import {
  talhoesSelaDePrata1Shape,
  SELA_DE_PRATA_1_SHAPE_FAZENDA_ID,
} from '../assets/geojson/selaDePrata1Talhoes';

const SELA_DEPRATA_1_PRODUTOR_ID = SELA_DE_PRATA_1_SHAPE_FAZENDA_ID;

// Usuários do sistema
// NOTA: "produtor" = "cliente" = "proprietário" - mesma pessoa (dono da fazenda)
// Várias pessoas (pai, mãe) podem ter login vinculado ao mesmo proprietário
const users = [
  // ADMINISTRADORES - Acesso total ao Brasil
  {
    id: 'u1',
    nome: 'Bruna Administradora',
    email: 'bruna@agrotche.com',
    senha: 'admin123',
    perfil: 'admin',
    telefone: '(51) 99999-9999',
    regioes_acesso: ['Brasil'],
    ativo: true,
    data_cadastro: new Date('2024-01-01').toISOString()
  },
  {
    id: 'u1b',
    nome: 'César Administrador',
    email: 'cesar@agrotche.com',
    senha: 'admin123',
    perfil: 'admin',
    telefone: '(51) 99998-9998',
    regioes_acesso: ['Brasil'],
    ativo: true,
    data_cadastro: new Date('2024-01-01').toISOString()
  },
  // COLABORADORES - Mesmas funções do admin, LIMITADO à região
  {
    id: 'u2',
    nome: 'Carlos Silva',
    email: 'carlos@agrotche.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Goiás',
    sub_regioes: ['Goiás 1', 'Rio Verde', 'Jataí'],
    telefone: '(62) 98888-8888',
    ativo: true,
    data_cadastro: new Date('2024-02-15').toISOString()
  },
  {
    id: 'u3',
    nome: 'Ana Santos',
    email: 'ana@agrotche.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Sul',
    sub_regioes: ['RS - Norte', 'RS - Centro', 'RS - Sul'],
    telefone: '(51) 97777-7777',
    ativo: true,
    data_cadastro: new Date('2024-03-10').toISOString()
  },
  {
    id: 'u5',
    nome: 'Marcos Ferreira',
    email: 'marcos@agrotche.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Mato Grosso',
    sub_regioes: ['MT - Norte', 'Sorriso', 'Lucas do Rio Verde'],
    telefone: '(65) 97776-7776',
    ativo: true,
    data_cadastro: new Date('2024-04-01').toISOString()
  },
  {
    id: 'u6',
    nome: 'Patrícia Lima',
    email: 'patricia@agrotche.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Goiás',
    sub_regioes: ['Goiás 2', 'Goiânia', 'Anápolis'],
    telefone: '(62) 97775-7775',
    ativo: true,
    data_cadastro: new Date('2024-04-10').toISOString()
  },
  // PRODUTORES / CLIENTES / PROPRIETÁRIOS - Donos de fazenda
  // Produtor = Cliente = Proprietário (dono da fazenda)
  // Um proprietário pode ter VÁRIAS fazendas (relação 1:N via proprietario_id)
  {
    id: 'u7',
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop1', // proprietário - várias fazendas vinculadas
    telefone: '(51) 96666-6666',
    ativo: true,
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'u8',
    nome: 'Maria Silva', // Esposa do João - mesmo proprietário
    email: 'maria.silva@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop1', // MESMO proprietário que o João
    telefone: '(51) 96665-6665',
    ativo: true,
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'u9',
    nome: 'Roberto Oliveira',
    email: 'roberto@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop2',
    telefone: '(62) 93333-3333',
    ativo: true,
    data_cadastro: new Date('2024-03-15').toISOString()
  },
  {
    id: 'u10',
    nome: 'Fernanda Costa',
    email: 'fernanda@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop3',
    telefone: '(65) 92222-2222',
    ativo: true,
    data_cadastro: new Date('2024-02-01').toISOString()
  },
  {
    id: 'u11',
    nome: 'Pedro Santos',
    email: 'pedro.santos@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop_pedro',
    telefone: '(54) 94444-4444',
    ativo: true,
    data_cadastro: new Date('2024-06-01').toISOString()
  },
  {
    id: 'u12',
    nome: 'Maria Pereira',
    email: 'maria.pereira@email.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop_maria',
    telefone: '(55) 95555-5555',
    ativo: true,
    data_cadastro: new Date('2024-05-10').toISOString()
  }
];

// Produtores / Fazendas
// IMPORTANTE: Produtor = Cliente = Proprietário (dono da fazenda)
// Um proprietário pode ter VÁRIAS fazendas (relação 1:N)
// proprietario_id vincula a fazenda ao dono
const produtores: any[] = [
  // ─── Fazendas do proprietário "prop1" (João Silva) ───
  {
    id: 'p1',
    proprietario_id: 'prop1', // João e Maria Silva (mesma família)
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
    id: 'p1b',
    proprietario_id: 'prop1', // Segunda fazenda do João Silva
    nome: 'João Silva',
    fazenda: 'Fazenda Horizonte',
    area_total: 420,
    cultura_atual: 'Milho',
    telefone: '(51) 96666-6666',
    email: 'joao.silva@email.com',
    endereco: 'Estrada Rural, Km 20',
    cidade: 'Cruz Alta',
    estado: 'RS',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
    cep: '98100-000',
    ultima_analise: new Date('2024-11-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-06-15').toISOString()
  },
  // ─── Outras fazendas ───
  {
    id: 'p2',
    proprietario_id: 'prop_maria', // Proprietária: Maria Pereira
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
    proprietario_id: 'prop_pedro', // Proprietário: Pedro Santos
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
  // ─── Fazendas do proprietário "prop2" (Roberto Oliveira) ───
  {
    id: 'p4',
    proprietario_id: 'prop2', // Roberto Oliveira
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
    microregiao: 'Rio Verde',
    cep: '75900-000',
    ultima_analise: new Date('2024-11-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-03-15').toISOString()
  },
  {
    id: 'p4b',
    proprietario_id: 'prop2', // Segunda fazenda do Roberto
    nome: 'Roberto Oliveira',
    fazenda: 'Fazenda Cerrado Alto',
    area_total: 800,
    cultura_atual: 'Milho',
    telefone: '(62) 93333-3333',
    email: 'roberto.oliveira@email.com',
    endereco: 'GO-060, Km 150',
    cidade: 'Jataí',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Jataí',
    cep: '75800-000',
    ultima_analise: new Date('2024-10-20').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-05-20').toISOString()
  },
  // ─── Fazendas do proprietário "prop3" (Fernanda Costa) ───
  {
    id: 'p5',
    proprietario_id: 'prop3', // Fernanda Costa
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
    microregiao: 'Sorriso',
    cep: '78890-000',
    ultima_analise: new Date('2024-10-25').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-02-01').toISOString()
  },
  {
    id: 'p5b',
    proprietario_id: 'prop3', // Segunda fazenda da Fernanda
    nome: 'Fernanda Costa',
    fazenda: 'Fazenda Ouro Verde',
    area_total: 1800,
    cultura_atual: 'Soja',
    telefone: '(65) 92222-2222',
    email: 'fernanda.costa@email.com',
    endereco: 'MT-242, Km 30',
    cidade: 'Lucas do Rio Verde',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'Lucas do Rio Verde',
    cep: '78455-000',
    ultima_analise: new Date('2024-11-10').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-03-01').toISOString()
  },
  // ─── Fazendas na região de Patrícia Lima (Goiânia/Anápolis) ───
  {
    id: 'p6',
    proprietario_id: 'prop5',
    nome: 'Antônio Ferreira',
    fazenda: 'Fazenda Ouro Branco',
    area_total: 600,
    cultura_atual: 'Soja',
    telefone: '(62) 97777-7777',
    email: 'antonio.ferreira@email.com',
    endereco: 'GO-060, Km 45',
    cidade: 'Goiânia',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Goiânia',
    cep: '74000-000',
    ultima_analise: new Date('2024-10-20').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-04-01').toISOString()
  },
  {
    id: 'p6b',
    proprietario_id: 'prop5',
    nome: 'Antônio Ferreira',
    fazenda: 'Fazenda Santa Helena',
    area_total: 480,
    cultura_atual: 'Milho',
    telefone: '(62) 97777-7777',
    email: 'antonio.ferreira@email.com',
    endereco: 'BR-153, Km 80',
    cidade: 'Anápolis',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Anápolis',
    cep: '75000-000',
    ultima_analise: new Date('2024-11-05').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-05-15').toISOString()
  },
  // ─── Fazenda Sela de Prata I — dados reais importados de KML ───────────────
  {
    id: SELA_DEPRATA_1_PRODUTOR_ID,
    proprietario_id: 'prop_sela1',
    nome: 'Fazenda Sela de Prata I',
    fazenda: 'Fazenda Sela de Prata I',
    area_total: 6200,
    cultura_atual: 'Soja',
    telefone: '(66) 99000-0001',
    email: 'seladeprataI@agrotche.com',
    endereco: 'Zona Rural, s/n',
    cidade: 'Alta Floresta',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'MT - Norte',
    cep: '78580-000',
    ultima_analise: new Date('2025-06-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2025-01-10').toISOString()
  }
];

// Visitas técnicas
const visitas: any[] = [
  {
    id: 'v1',
    produtor_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
    data_visita: new Date().toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Boa presença de plantas. Desenvolvimento adequado da cultura.',
    recomendacoes: 'Monitorar pragas nas próximas semanas.',
    fotos: ['https://picsum.photos/400/300?random=101', 'https://picsum.photos/400/300?random=102'],
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
    fotos: ['https://picsum.photos/400/300?random=103'],
    clima: 'Parcialmente nublado',
    proximaVisita: new Date(Date.now() + 86400000 * 45).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v3',
    produtor_id: 'p1',
    tecnico_responsavel: 'Ana Santos',
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
  },
  // ─── Visitas em Goiás (Carlos e Patrícia) ───
  {
    id: 'v5',
    produtor_id: 'p4', // Fazenda Planalto - Rio Verde (Carlos)
    tecnico_responsavel: 'Carlos Silva',
    data_visita: new Date(Date.now() - 86400000 * 3).toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Avaliação geral da lavoura de soja. Desenvolvimento dentro do esperado para o estágio V6.',
    recomendacoes: 'Aplicar fungicida preventivo nos próximos 10 dias.',
    fotos: ['https://picsum.photos/400/300?random=105', 'https://picsum.photos/400/300?random=106'],
    clima: 'Ensolarado, 32°C',
    proximaVisita: new Date(Date.now() + 86400000 * 20).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v6',
    produtor_id: 'p4b', // Fazenda Cerrado Alto - Jataí (Carlos)
    tecnico_responsavel: 'Carlos Silva',
    data_visita: new Date(Date.now() + 86400000 * 5).toISOString(),
    objetivo: 'coleta_solo',
    observacoes: '',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  {
    id: 'v7',
    produtor_id: 'p4', // Fazenda Planalto - Rio Verde (Carlos)
    tecnico_responsavel: 'Carlos Silva',
    data_visita: new Date(Date.now() - 86400000 * 20).toISOString(),
    objetivo: 'avaliacao_cultivo',
    observacoes: 'Primeira visita da safra. Lavoura recém-plantada.',
    recomendacoes: 'Monitorar germinação e stand de plantas.',
    fotos: ['https://picsum.photos/400/300?random=107'],
    clima: 'Parcialmente nublado, 28°C',
    status: 'realizada'
  },
  // ─── Visitas em Mato Grosso (Marcos) ───
  {
    id: 'v8',
    produtor_id: 'p5', // Agrícola Cerrado Verde - Sorriso (Marcos)
    tecnico_responsavel: 'Marcos Ferreira',
    data_visita: new Date(Date.now() - 86400000 * 2).toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Avaliação de algodão em estágio avançado. Excelente desenvolvimento.',
    recomendacoes: 'Programar colheita para as próximas 3 semanas.',
    fotos: ['https://picsum.photos/400/300?random=108', 'https://picsum.photos/400/300?random=109', 'https://picsum.photos/400/300?random=110'],
    clima: 'Ensolarado, 35°C',
    proximaVisita: new Date(Date.now() + 86400000 * 15).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v9',
    produtor_id: 'p5b', // Fazenda Ouro Verde - Lucas do Rio Verde (Marcos)
    tecnico_responsavel: 'Marcos Ferreira',
    data_visita: new Date(Date.now() + 86400000 * 10).toISOString(),
    objetivo: 'coleta_solo',
    observacoes: '',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  // ─── Visitas em Goiás - Patrícia Lima (Goiânia/Anápolis) ───
  {
    id: 'v10',
    produtor_id: 'p6', // Fazenda Ouro Branco - Goiânia
    tecnico_responsavel: 'Patrícia Lima',
    data_visita: new Date(Date.now() - 86400000 * 4).toISOString(),
    objetivo: 'consultoria',
    observacoes: 'Avaliação de soja em estágio R1. Bom desenvolvimento vegetativo.',
    recomendacoes: 'Monitorar ferrugem asiática e aplicar fungicida preventivo.',
    fotos: ['https://picsum.photos/400/300?random=111', 'https://picsum.photos/400/300?random=112'],
    clima: 'Parcialmente nublado, 29°C',
    proximaVisita: new Date(Date.now() + 86400000 * 14).toISOString(),
    status: 'realizada'
  },
  {
    id: 'v11',
    produtor_id: 'p6b', // Fazenda Santa Helena - Anápolis
    tecnico_responsavel: 'Patrícia Lima',
    data_visita: new Date(Date.now() + 86400000 * 3).toISOString(),
    objetivo: 'coleta_solo',
    observacoes: '',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  {
    id: 'v12',
    produtor_id: 'p6', // Fazenda Ouro Branco - Goiânia
    tecnico_responsavel: 'Patrícia Lima',
    data_visita: new Date(Date.now() - 86400000 * 18).toISOString(),
    objetivo: 'avaliacao_cultivo',
    observacoes: 'Primeira vistoria da safra. Plantio recém-emergido com stand uniforme.',
    recomendacoes: 'Manter controle de plantas daninhas.',
    fotos: ['https://picsum.photos/400/300?random=113'],
    clima: 'Ensolarado, 31°C',
    status: 'realizada'
  }
];

const cadernos: any[] = [
  {
    id: 'c1',
    produtor_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date().toISOString(),
    tipo_atividade: 'adubacao',
    talhao: 'Talhão A',
    produtos_utilizados: ['NPK 10-20-20', 'Ureia'],
    dosagem: '300 kg/ha',
    area_aplicada: 50,
    condicoes_clima: 'Ensolarado, 22°C',
    observacoes: 'Aplicação realizada com boa distribuição. Solo em boas condições de umidade.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=201', 'https://picsum.photos/400/300?random=202']
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
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=203']
  },
  {
    id: 'c3',
    produtor_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 dias atrás
    tipo_atividade: 'vistoria',
    talhao: 'Talhão C',
    produtos_utilizados: [],
    area_aplicada: null,
    condicoes_clima: 'Ensolarado, 28°C',
    observacoes: 'Vistoria de rotina. Identificada presença leve de lagarta do cartucho. População abaixo do nível de controle.',
    visivel_para_produtor: false,
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
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=204', 'https://picsum.photos/400/300?random=205', 'https://picsum.photos/400/300?random=206']
  },
  {
    id: 'c5',
    produtor_id: 'p1',
    colaborador_responsavel: 'Ana Santos',
    data_atividade: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 dias atrás
    tipo_atividade: 'aplicacao',
    talhao: 'Talhão D',
    produtos_utilizados: ['Fungicida Azoxistrobina', 'Adjuvante'],
    dosagem: '0,3 L/ha + 0,5% v/v',
    area_aplicada: 75,
    condicoes_clima: 'Ensolarado, sem vento, 24°C',
    observacoes: 'Aplicação de fungicida preventivo. Condições climáticas favoráveis para aplicação.',
    visivel_para_produtor: true,
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
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=207']
  },
  // ─── Cadernos em Goiás (Carlos) ───
  {
    id: 'c7',
    produtor_id: 'p4', // Fazenda Planalto - Rio Verde
    colaborador_responsavel: 'Carlos Silva',
    data_atividade: new Date(Date.now() - 86400000 * 1).toISOString(),
    tipo_atividade: 'adubacao',
    talhao: 'Pivô Central',
    produtos_utilizados: ['MAP', 'KCl'],
    dosagem: '250 kg/ha',
    area_aplicada: 200,
    condicoes_clima: 'Ensolarado, 30°C',
    observacoes: 'Adubação de cobertura realizada com sucesso.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=208']
  },
  {
    id: 'c8',
    produtor_id: 'p4b', // Fazenda Cerrado Alto - Jataí
    colaborador_responsavel: 'Carlos Silva',
    data_atividade: new Date(Date.now() - 86400000 * 4).toISOString(),
    tipo_atividade: 'aplicacao',
    talhao: 'Área 2',
    produtos_utilizados: ['Herbicida Glifosato'],
    dosagem: '2,5 L/ha',
    area_aplicada: 150,
    condicoes_clima: 'Nublado, 27°C',
    observacoes: 'Aplicação de dessecação pré-plantio.',
    visivel_para_produtor: true,
    fotos: []
  },
  // ─── Cadernos em Mato Grosso (Marcos) ───
  {
    id: 'c9',
    produtor_id: 'p5', // Agrícola Cerrado Verde - Sorriso
    colaborador_responsavel: 'Marcos Ferreira',
    data_atividade: new Date(Date.now() - 86400000 * 2).toISOString(),
    tipo_atividade: 'vistoria',
    talhao: 'Talhão B3',
    produtos_utilizados: [],
    area_aplicada: null,
    condicoes_clima: 'Ensolarado, 34°C',
    observacoes: 'Vistoria de acompanhamento do ciclo do algodão. Sem pragas detectadas.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=209', 'https://picsum.photos/400/300?random=210']
  },
  {
    id: 'c10',
    produtor_id: 'p5b', // Fazenda Ouro Verde - Lucas do Rio Verde
    colaborador_responsavel: 'Marcos Ferreira',
    data_atividade: new Date(Date.now() - 86400000 * 6).toISOString(),
    tipo_atividade: 'plantio',
    talhao: 'Área Norte',
    produtos_utilizados: ['Semente Soja TMG 2381'],
    dosagem: '14 sementes/m',
    area_aplicada: 300,
    condicoes_clima: 'Parcialmente nublado, 31°C',
    observacoes: 'Plantio de soja safrinha concluído. Solo com boa umidade.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=211']
  },
  // ─── Cadernos em Goiás - Patrícia Lima (Goiânia/Anápolis) ───
  {
    id: 'c11',
    produtor_id: 'p6', // Fazenda Ouro Branco - Goiânia
    colaborador_responsavel: 'Patrícia Lima',
    data_atividade: new Date(Date.now() - 86400000 * 3).toISOString(),
    tipo_atividade: 'adubacao',
    talhao: 'Talhão Sul',
    produtos_utilizados: ['NPK 5-25-25', 'KCl'],
    dosagem: '280 kg/ha',
    area_aplicada: 180,
    condicoes_clima: 'Ensolarado, 30°C',
    observacoes: 'Adubação de base pré-plantio. Solo com boa umidade.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=212']
  },
  {
    id: 'c12',
    produtor_id: 'p6b', // Fazenda Santa Helena - Anápolis
    colaborador_responsavel: 'Patrícia Lima',
    data_atividade: new Date(Date.now() - 86400000 * 7).toISOString(),
    tipo_atividade: 'vistoria',
    talhao: 'Área Central',
    produtos_utilizados: [],
    area_aplicada: null,
    condicoes_clima: 'Parcialmente nublado, 28°C',
    observacoes: 'Vistoria de acompanhamento. Milho em estágio V4, desenvolvimento uniforme.',
    visivel_para_produtor: true,
    fotos: ['https://picsum.photos/400/300?random=213', 'https://picsum.photos/400/300?random=214']
  }
];

// Mapas técnicos
const mapas: any[] = [
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
    disponivel_download: true
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
    disponivel_download: true
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
    disponivel_download: false
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
  },
  // ─── Mapas para Goiás (p4 e p4b) ───
  {
    id: 'm13',
    titulo: 'NDVI - Fazenda Planalto',
    categoria: 'indice_vegetacao',
    subcategoria: 'NDVI',
    produtor_id: 'p4',
    talhao: 'Pivô Central',
    data_criacao: new Date('2024-11-25').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/ndvi_p4_pivo.jpg',
    formato_arquivo: 'jpg',
    tamanho_arquivo: 3500000,
    disponivel_download: true,
    coordenadas: { latitude: -17.7832, longitude: -50.9154 },
    observacoes: 'Índice de vegetação da lavoura de soja - Rio Verde.'
  },
  {
    id: 'm14',
    titulo: 'Mapa de Fertilidade - Cerrado Alto',
    categoria: 'fertilidade',
    produtor_id: 'p4b',
    talhao: 'Área 2',
    data_criacao: new Date('2024-10-28').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_p4b_area2.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 2100000,
    disponivel_download: true,
    coordenadas: { latitude: -17.8821, longitude: -51.7149 },
    observacoes: 'Análise de fertilidade do solo - Jataí.'
  },
  // ─── Mapas para Mato Grosso (p5 e p5b) ───
  {
    id: 'm15',
    titulo: 'Panorama - Agrícola Cerrado Verde',
    categoria: 'panorama',
    produtor_id: 'p5',
    talhao: 'Completo',
    data_criacao: new Date('2024-11-20').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/panorama_p5_completo.jpg',
    formato_arquivo: 'jpg',
    tamanho_arquivo: 5600000,
    disponivel_download: true,
    coordenadas: { latitude: -12.5496, longitude: -55.7148 },
    observacoes: 'Vista aérea da propriedade em Sorriso - MT.'
  },
  {
    id: 'm16',
    titulo: 'Mapa de Correção - Fazenda Ouro Verde',
    categoria: 'correcao',
    produtor_id: 'p5b',
    talhao: 'Área Norte',
    data_criacao: new Date('2024-10-15').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/correcao_p5b_norte.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1890000,
    disponivel_download: true,
    coordenadas: { latitude: -13.0497, longitude: -55.9064 },
    observacoes: 'Recomendação de calcário e gesso - Lucas do Rio Verde.'
  },
  // ─── Mapas Goiás - Patrícia Lima (Goiânia/Anápolis) ───
  {
    id: 'm17',
    titulo: 'NDVI - Fazenda Ouro Branco',
    categoria: 'indice_vegetacao',
    produtor_id: 'p6',
    talhao: 'Talhão Sul',
    data_criacao: new Date('2024-11-10').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/ndvi_p6_sul.png',
    formato_arquivo: 'png',
    tamanho_arquivo: 3100000,
    disponivel_download: true,
    coordenadas: { latitude: -16.6869, longitude: -49.2648 },
    observacoes: 'Índice de vegetação da lavoura de soja - Goiânia.'
  },
  {
    id: 'm18',
    titulo: 'Mapa de Fertilidade - Fazenda Santa Helena',
    categoria: 'fertilidade',
    produtor_id: 'p6b',
    talhao: 'Área Central',
    data_criacao: new Date('2024-10-25').toISOString(),
    safra: '2024/2025',
    arquivo_url: 'mapas/fertilidade_p6b_central.pdf',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 2200000,
    disponivel_download: true,
    coordenadas: { latitude: -16.3269, longitude: -48.9539 },
    observacoes: 'Análise de fertilidade do solo - Anápolis.'
  },
  // ─── Materiais técnicos da Fazenda Sela de Prata I ───
  // MVP: um arquivo técnico por fazenda + talhão/campo + elemento/camada.
  {
    id: 'm_sela1_t01_argila_2025',
    titulo: 'Argila - T01 - 230',
    categoria: 'fertilidade',
    subcategoria: 'Argila',
    tipo_material: 'diagnostico',
    elemento: 'argila',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    talhao: 'T01 - 230',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025/2026',
    arquivo_url: 'https://drive.google.com/file/d/mock-sela1-t01-argila-2025/view',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1840000,
    disponivel_download: true,
    coordenadas: { latitude: -10.3018, longitude: -55.3451 },
    observacoes: 'Arquivo técnico liberado para consulta/download do produtor.'
  },
  {
    id: 'm_sela1_t01_ph_2025',
    titulo: 'pH - T01 - 230',
    categoria: 'fertilidade',
    subcategoria: 'pH',
    tipo_material: 'diagnostico',
    elemento: 'ph',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    talhao: 'T01 - 230',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025/2026',
    arquivo_url: 'https://drive.google.com/file/d/mock-sela1-t01-ph-2025/view',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1760000,
    disponivel_download: true,
    coordenadas: { latitude: -10.3018, longitude: -55.3451 },
    observacoes: 'Diagnóstico de pH associado ao campo/talhão informado.'
  },
  {
    id: 'm_sela1_t02_fosforo_2025',
    titulo: 'Fósforo - T02 - Sede Nova',
    categoria: 'fertilidade',
    subcategoria: 'Fósforo',
    tipo_material: 'diagnostico',
    elemento: 'fosforo',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    talhao: 'T02 - Sede Nova',
    data_criacao: new Date('2025-06-06').toISOString(),
    safra: '2025/2026',
    arquivo_url: 'https://drive.google.com/file/d/mock-sela1-t02-fosforo-2025/view',
    formato_arquivo: 'pdf',
    tamanho_arquivo: 1920000,
    disponivel_download: true,
    coordenadas: { latitude: -10.3072, longitude: -55.3424 },
    observacoes: 'Diagnóstico de fósforo disponível para o produtor.'
  },
  {
    id: 'm_sela1_t02_potassio_2025',
    titulo: 'Potássio - T02 - Sede Nova',
    categoria: 'fertilidade',
    subcategoria: 'Potássio',
    tipo_material: 'diagnostico',
    elemento: 'potassio',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    talhao: 'T02 - Sede Nova',
    data_criacao: new Date('2025-06-06').toISOString(),
    safra: '2025/2026',
    disponivel_download: false,
    formato_arquivo: 'pdf',
    coordenadas: { latitude: -10.3072, longitude: -55.3424 },
    observacoes: 'Material identificado, mas ainda sem arquivo liberado pela equipe.'
  }
];

// ─── Limites de Área (Shape / Demarcação de Talhões) ───
// Referência: arquivos no drive com formato LT 2022, 23, 24, 25
const limitesArea: any[] = [
  // ─── Produtor p1 - RS ───
  {
    id: 'lt1',
    nome: 'LT 2022 - Talhão A',
    ano: 2022,
    produtor_id: 'p1',
    talhao: 'Talhão A',
    area_hectares: 45.5,
    perimetro_km: 2.8,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho',
    elementos: {
      ph: 5.8,
      fosforo: 12.5,
      potassio: 0.35,
      calcio: 4.2,
      magnesio: 1.8,
      materia_organica: 2.8,
      ctc: 12.5,
      saturacao_bases: 65,
      aluminio: 0.2,
      enxofre: 8.5
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -28.6341, lng: -53.6055 },
      { lat: -28.6341, lng: -53.6020 },
      { lat: -28.6370, lng: -53.6015 },
      { lat: -28.6380, lng: -53.6030 },
      { lat: -28.6375, lng: -53.6055 }
    ],
    cor: '#228B22',
    data_upload: new Date('2022-06-15').toISOString(),
    safra: '2022/2023',
    disponivel_offline: true,
    observacoes: 'Demarcação oficial do talhão A - Levantamento topográfico 2022.'
  },
  {
    id: 'lt2',
    nome: 'LT 2022 - Talhão B',
    ano: 2022,
    produtor_id: 'p1',
    talhao: 'Talhão B',
    area_hectares: 32.8,
    perimetro_km: 2.3,
    textura: 'Argilo-arenosa',
    tipo_solo: 'Latossolo Vermelho-Amarelo',
    elementos: {
      ph: 5.5,
      fosforo: 8.2,
      potassio: 0.28,
      calcio: 3.5,
      magnesio: 1.2,
      materia_organica: 2.3,
      ctc: 10.8,
      saturacao_bases: 58,
      aluminio: 0.4,
      enxofre: 6.0
    },
    cultura_atual: 'Milho',
    poligono: [
      { lat: -28.6355, lng: -53.6065 },
      { lat: -28.6355, lng: -53.6035 },
      { lat: -28.6385, lng: -53.6030 },
      { lat: -28.6390, lng: -53.6050 },
      { lat: -28.6380, lng: -53.6070 }
    ],
    cor: '#D4A017',
    data_upload: new Date('2022-06-15').toISOString(),
    safra: '2022/2023',
    disponivel_offline: true,
    observacoes: 'Demarcação talhão B - Solo misto com boa drenagem.'
  },
  {
    id: 'lt3',
    nome: 'LT 2023 - Talhão A',
    ano: 2023,
    produtor_id: 'p1',
    talhao: 'Talhão A',
    area_hectares: 46.2,
    perimetro_km: 2.85,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho',
    elementos: {
      ph: 6.0,
      fosforo: 15.0,
      potassio: 0.40,
      calcio: 4.8,
      magnesio: 2.0,
      materia_organica: 3.0,
      ctc: 13.2,
      saturacao_bases: 70,
      aluminio: 0.1,
      enxofre: 9.5
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -28.6340, lng: -53.6056 },
      { lat: -28.6340, lng: -53.6018 },
      { lat: -28.6372, lng: -53.6013 },
      { lat: -28.6382, lng: -53.6028 },
      { lat: -28.6376, lng: -53.6056 }
    ],
    cor: '#228B22',
    data_upload: new Date('2023-07-10').toISOString(),
    safra: '2023/2024',
    disponivel_offline: true,
    observacoes: 'Atualização de limites 2023 - Leve expansão da área.'
  },
  {
    id: 'lt4',
    nome: 'LT 2023 - Talhão C',
    ano: 2023,
    produtor_id: 'p1',
    talhao: 'Talhão C',
    area_hectares: 28.0,
    perimetro_km: 2.1,
    textura: 'Arenosa',
    tipo_solo: 'Neossolo Quartzarênico',
    elementos: {
      ph: 5.2,
      fosforo: 6.0,
      potassio: 0.20,
      calcio: 2.5,
      magnesio: 0.8,
      materia_organica: 1.5,
      ctc: 7.5,
      saturacao_bases: 45,
      aluminio: 0.8,
      enxofre: 4.0
    },
    cultura_atual: 'Pastagem',
    poligono: [
      { lat: -28.6395, lng: -53.6060 },
      { lat: -28.6395, lng: -53.6035 },
      { lat: -28.6420, lng: -53.6030 },
      { lat: -28.6425, lng: -53.6055 },
      { lat: -28.6410, lng: -53.6065 }
    ],
    cor: '#8B4513',
    data_upload: new Date('2023-07-10').toISOString(),
    safra: '2023/2024',
    disponivel_offline: true,
    observacoes: 'Talhão de pastagem com solo arenoso - necessita correção.'
  },
  {
    id: 'lt5',
    nome: 'LT 2024 - Talhão A',
    ano: 2024,
    produtor_id: 'p1',
    talhao: 'Talhão A',
    area_hectares: 46.2,
    perimetro_km: 2.85,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho',
    elementos: {
      ph: 6.2,
      fosforo: 18.0,
      potassio: 0.45,
      calcio: 5.2,
      magnesio: 2.2,
      materia_organica: 3.2,
      ctc: 14.0,
      saturacao_bases: 72,
      aluminio: 0.05,
      enxofre: 10.0
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -28.6340, lng: -53.6056 },
      { lat: -28.6340, lng: -53.6018 },
      { lat: -28.6372, lng: -53.6013 },
      { lat: -28.6382, lng: -53.6028 },
      { lat: -28.6376, lng: -53.6056 }
    ],
    cor: '#228B22',
    data_upload: new Date('2024-05-20').toISOString(),
    safra: '2024/2025',
    disponivel_offline: true,
    observacoes: 'Melhoria de fertilidade após correção com calcário e gesso.'
  },
  {
    id: 'lt6',
    nome: 'LT 2024 - Talhão B',
    ano: 2024,
    produtor_id: 'p1',
    talhao: 'Talhão B',
    area_hectares: 33.5,
    perimetro_km: 2.35,
    textura: 'Argilo-arenosa',
    tipo_solo: 'Latossolo Vermelho-Amarelo',
    elementos: {
      ph: 5.9,
      fosforo: 11.0,
      potassio: 0.32,
      calcio: 4.0,
      magnesio: 1.5,
      materia_organica: 2.6,
      ctc: 11.5,
      saturacao_bases: 62,
      aluminio: 0.3,
      enxofre: 7.5
    },
    cultura_atual: 'Milho Safrinha',
    poligono: [
      { lat: -28.6355, lng: -53.6065 },
      { lat: -28.6355, lng: -53.6035 },
      { lat: -28.6385, lng: -53.6030 },
      { lat: -28.6390, lng: -53.6050 },
      { lat: -28.6380, lng: -53.6070 }
    ],
    cor: '#D4A017',
    data_upload: new Date('2024-05-20').toISOString(),
    safra: '2024/2025',
    disponivel_offline: true,
    observacoes: 'Rotação soja/milho safrinha. Solo em evolução.'
  },
  {
    id: 'lt7',
    nome: 'LT 2025 - Talhão A',
    ano: 2025,
    produtor_id: 'p1',
    talhao: 'Talhão A',
    area_hectares: 46.5,
    perimetro_km: 2.86,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho',
    elementos: {
      ph: 6.3,
      fosforo: 20.0,
      potassio: 0.50,
      calcio: 5.5,
      magnesio: 2.4,
      materia_organica: 3.5,
      ctc: 14.8,
      saturacao_bases: 75,
      aluminio: 0.0,
      enxofre: 11.0
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -28.6339, lng: -53.6057 },
      { lat: -28.6339, lng: -53.6017 },
      { lat: -28.6373, lng: -53.6012 },
      { lat: -28.6383, lng: -53.6027 },
      { lat: -28.6377, lng: -53.6057 }
    ],
    cor: '#228B22',
    data_upload: new Date('2025-04-10').toISOString(),
    safra: '2025/2026',
    disponivel_offline: true,
    observacoes: 'Solo em excelente condição após 3 anos de manejo integrado.'
  },
  {
    id: 'lt8',
    nome: 'LT 2025 - Talhão B',
    ano: 2025,
    produtor_id: 'p1',
    talhao: 'Talhão B',
    area_hectares: 33.8,
    perimetro_km: 2.36,
    textura: 'Argilo-arenosa',
    tipo_solo: 'Latossolo Vermelho-Amarelo',
    elementos: {
      ph: 6.1,
      fosforo: 14.0,
      potassio: 0.38,
      calcio: 4.5,
      magnesio: 1.8,
      materia_organica: 2.9,
      ctc: 12.2,
      saturacao_bases: 66,
      aluminio: 0.15,
      enxofre: 8.0
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -28.6354, lng: -53.6066 },
      { lat: -28.6354, lng: -53.6034 },
      { lat: -28.6386, lng: -53.6029 },
      { lat: -28.6391, lng: -53.6049 },
      { lat: -28.6381, lng: -53.6071 }
    ],
    cor: '#D4A017',
    data_upload: new Date('2025-04-10').toISOString(),
    safra: '2025/2026',
    disponivel_offline: true,
    observacoes: 'Evolução constante do perfil de solo.'
  },
  {
    id: 'lt9',
    nome: 'LT 2025 - Talhão C',
    ano: 2025,
    produtor_id: 'p1',
    talhao: 'Talhão C',
    area_hectares: 29.0,
    perimetro_km: 2.15,
    textura: 'Franco-arenosa',
    tipo_solo: 'Neossolo Quartzarênico',
    elementos: {
      ph: 5.6,
      fosforo: 9.0,
      potassio: 0.25,
      calcio: 3.2,
      magnesio: 1.0,
      materia_organica: 2.0,
      ctc: 9.0,
      saturacao_bases: 52,
      aluminio: 0.5,
      enxofre: 5.5
    },
    cultura_atual: 'Milho',
    poligono: [
      { lat: -28.6394, lng: -53.6061 },
      { lat: -28.6394, lng: -53.6034 },
      { lat: -28.6421, lng: -53.6029 },
      { lat: -28.6426, lng: -53.6054 },
      { lat: -28.6411, lng: -53.6066 }
    ],
    cor: '#8B4513',
    data_upload: new Date('2025-04-10').toISOString(),
    safra: '2025/2026',
    disponivel_offline: true,
    observacoes: 'Melhoria significativa após calagem. Agora Franco-arenosa.'
  },
  // ─── Produtor p4 - Goiás ───
  {
    id: 'lt10',
    nome: 'LT 2024 - Pivô Central',
    ano: 2024,
    produtor_id: 'p4',
    talhao: 'Pivô Central',
    area_hectares: 120.0,
    perimetro_km: 3.88,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho-Escuro',
    elementos: {
      ph: 5.5,
      fosforo: 10.0,
      potassio: 0.30,
      calcio: 3.8,
      magnesio: 1.5,
      materia_organica: 2.5,
      ctc: 11.0,
      saturacao_bases: 55,
      aluminio: 0.5,
      enxofre: 7.0
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -17.7820, lng: -50.9140 },
      { lat: -17.7820, lng: -50.9100 },
      { lat: -17.7860, lng: -50.9095 },
      { lat: -17.7870, lng: -50.9120 },
      { lat: -17.7855, lng: -50.9145 }
    ],
    cor: '#2E86C1',
    data_upload: new Date('2024-06-01').toISOString(),
    safra: '2024/2025',
    disponivel_offline: true,
    observacoes: 'Área de pivô central - Cerrado goiano, Rio Verde.'
  },
  {
    id: 'lt11',
    nome: 'LT 2025 - Pivô Central',
    ano: 2025,
    produtor_id: 'p4',
    talhao: 'Pivô Central',
    area_hectares: 120.5,
    perimetro_km: 3.90,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Vermelho-Escuro',
    elementos: {
      ph: 5.8,
      fosforo: 13.0,
      potassio: 0.35,
      calcio: 4.2,
      magnesio: 1.8,
      materia_organica: 2.8,
      ctc: 12.0,
      saturacao_bases: 60,
      aluminio: 0.3,
      enxofre: 8.0
    },
    cultura_atual: 'Milho Safrinha',
    poligono: [
      { lat: -17.7819, lng: -50.9141 },
      { lat: -17.7819, lng: -50.9099 },
      { lat: -17.7861, lng: -50.9094 },
      { lat: -17.7871, lng: -50.9119 },
      { lat: -17.7856, lng: -50.9146 }
    ],
    cor: '#2E86C1',
    data_upload: new Date('2025-05-15').toISOString(),
    safra: '2025/2026',
    disponivel_offline: true,
    observacoes: 'Atualização 2025 - Resultado pós-correção.'
  },
  // ─── Produtor p5 - Mato Grosso ───
  {
    id: 'lt12',
    nome: 'LT 2024 - Área Norte',
    ano: 2024,
    produtor_id: 'p5',
    talhao: 'Área Norte',
    area_hectares: 250.0,
    perimetro_km: 6.32,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Amarelo',
    elementos: {
      ph: 5.0,
      fosforo: 7.0,
      potassio: 0.22,
      calcio: 2.8,
      magnesio: 1.0,
      materia_organica: 2.0,
      ctc: 8.5,
      saturacao_bases: 42,
      aluminio: 1.0,
      enxofre: 5.0
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -12.5480, lng: -55.7130 },
      { lat: -12.5480, lng: -55.7080 },
      { lat: -12.5530, lng: -55.7075 },
      { lat: -12.5540, lng: -55.7110 },
      { lat: -12.5520, lng: -55.7140 }
    ],
    cor: '#E67E22',
    data_upload: new Date('2024-05-01').toISOString(),
    safra: '2024/2025',
    disponivel_offline: true,
    observacoes: 'Área de expansão em Sorriso-MT. Solo ácido, necessita correção intensiva.'
  },
  {
    id: 'lt13',
    nome: 'LT 2025 - Área Norte',
    ano: 2025,
    produtor_id: 'p5',
    talhao: 'Área Norte',
    area_hectares: 252.0,
    perimetro_km: 6.35,
    textura: 'Argilosa',
    tipo_solo: 'Latossolo Amarelo',
    elementos: {
      ph: 5.4,
      fosforo: 10.0,
      potassio: 0.28,
      calcio: 3.5,
      magnesio: 1.3,
      materia_organica: 2.3,
      ctc: 9.5,
      saturacao_bases: 50,
      aluminio: 0.6,
      enxofre: 6.5
    },
    cultura_atual: 'Soja',
    poligono: [
      { lat: -12.5479, lng: -55.7131 },
      { lat: -12.5479, lng: -55.7079 },
      { lat: -12.5531, lng: -55.7074 },
      { lat: -12.5541, lng: -55.7109 },
      { lat: -12.5521, lng: -55.7141 }
    ],
    cor: '#E67E22',
    data_upload: new Date('2025-06-01').toISOString(),
    safra: '2025/2026',
    disponivel_offline: true,
    observacoes: 'Evolução pós-correção 2024. Solo melhorando.'
  },
  // ─── Fazenda Sela de Prata I — talhões reais do shapefile ───────────────────
  // Demarcação real vinda do SHP. Não contém análise de solo.
  ...talhoesSelaDePrata1Shape.map((t) => ({
    id: t.id,
    nome: t.nome || `LT 2025 - ${t.talhao}`,
    ano: t.ano,
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    talhao: t.talhao,
    area_hectares: t.area_hectares,
    perimetro_km: t.perimetro_km,
    textura: t.textura,
    tipo_solo: t.tipo_solo,
    cultura_atual: t.cultura_atual,
    poligono: t.poligono,
    poligonos: t.poligonos,
    cor: t.cor,
    data_upload: t.data_upload || new Date('2025-05-01').toISOString(),
    safra: t.safra,
    disponivel_offline: true,
    observacoes: t.observacoes || `Contorno importado de shapefile real — ${t.talhao}`,
  })),
];

// API para User
export const User: any = {
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
export const Produtor: any = {
  list: async (order?: any) => {
    return new Promise((res) => setTimeout(() => res(listMockProdutores(produtores)), 300));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const p = produtores.find(x => x.id === id);
      if (p) res(readMockProdutor(p)); else rej(new Error('Produtor não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockProdutores(produtores, query);
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateProdutor(data);
        const id = `p${Date.now()}`;
        const novo = persistMockProdutor({ id, data });
        produtores.unshift(novo);
        res(readMockProdutor(novo));
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
        const atualizado = persistMockProdutor({ id, data, existing: produtores[index] });
        validateProdutor(atualizado);
        produtores[index] = atualizado;
        res(readMockProdutor(produtores[index]));
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = produtores.findIndex(p => p.id === id);
      if (index === -1) {
        rej(new Error('Fazenda não encontrada'));
      } else {
        const integridade = buildFazendaDeleteIntegrity(produtores[index], {
          mapas,
          visitas,
          cadernos,
          limites: limitesArea,
        });

        if (!integridade.canDelete) {
          const error: any = new Error(integridade.blockingMessage);
          error.code = 'FAZENDA_DELETE_BLOCKED';
          error.integridade = integridade;
          rej(error);
          return;
        }

        produtores.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  }
};

// API para Visita
export const Visita: any = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res(listMockVisitas(visitas)), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const visita = visitas.find(v => v.id === id);
      if (visita) res(readMockVisita(visita)); else rej(new Error('Visita não encontrada'));
    }, 200));
  },
  filter: async (query) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockVisitas(visitas, query);
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateVisita(data);
        const id = `v${Date.now()}`;
        const novo = persistMockVisita({ id, data });
        visitas.unshift(novo);
        res(readMockVisita(novo));
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
        const atualizado = persistMockVisita({ id, data, existing: visitas[index] });
        validateVisita(atualizado);
        visitas[index] = atualizado;
        res(readMockVisita(visitas[index]));
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
export const CadernoCampo: any = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res(listMockCadernosCampo(cadernos)), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const caderno = cadernos.find(c => c.id === id);
      if (caderno) res(readMockCadernoCampo(caderno)); else rej(new Error('Registro não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockCadernosCampo(cadernos, query);
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateCadernoCampo(data);
        const id = `c${Date.now()}`;
        const novo = persistMockCadernoCampo({ id, data });
        cadernos.unshift(novo);
        res(readMockCadernoCampo(novo));
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
        const atualizado = persistMockCadernoCampo({ id, data, existing: cadernos[index] });
        validateCadernoCampo(atualizado);
        cadernos[index] = atualizado;
        res(readMockCadernoCampo(cadernos[index]));
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
export const Mapa: any = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res(listMockMapas(mapas)), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const mapa = mapas.find(m => m.id === id);
      if (mapa) res(readMockMapa(mapa)); else rej(new Error('Mapa não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockMapas(mapas, query);
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateMapa(data);
        const id = `m${Date.now()}`;
        const novo = persistMockMapa({ id, data });
        mapas.unshift(novo);
        res(readMockMapa(novo));
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
        const atualizado = persistMockMapa({ id, data, existing: mapas[index] });
        validateMapa(atualizado);
        mapas[index] = atualizado;
        res(readMockMapa(mapas[index]));
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

// API para LimiteArea (Shape / Demarcação)
export const LimiteArea: any = {
  list: async () => {
    return new Promise((res) => setTimeout(() => res(listMockLimitesArea(limitesArea)), 200));
  },
  get: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const limite = limitesArea.find(l => l.id === id);
      if (limite) res(readMockLimiteArea(limite)); else rej(new Error('Limite não encontrado'));
    }, 200));
  },
  filter: async (query) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockLimitesArea(limitesArea, query);
      res(result);
    }, 200));
  },
  getByAno: async (ano) => {
    return new Promise((res) => setTimeout(() => {
      const result = listMockLimitesArea(limitesArea).filter(l => l.ano === ano);
      res(result);
    }, 200));
  },
  getByFazenda: async (fazendaId) => {
    return new Promise((res) => setTimeout(() => {
      const result = filterMockLimitesArea(limitesArea, { fazenda_id: fazendaId });
      res(result);
    }, 200));
  },
  getByProdutor: async (fazendaId) => {
    return new Promise((res) => setTimeout(() => {
      // Alias legado mantido enquanto consumidores antigos ainda pedem "produtor".
      const result = filterMockLimitesArea(limitesArea, { fazenda_id: fazendaId });
      res(result);
    }, 200));
  },
  create: async (data) => {
    return new Promise((res, rej) => setTimeout(() => {
      try {
        validateLimiteArea(data);
        const id = `lt${Date.now()}`;
        const novo = persistMockLimiteArea({ id, data });
        limitesArea.unshift(novo);
        res(readMockLimiteArea(novo));
      } catch (error) {
        rej(error);
      }
    }, 200));
  },
  update: async (id, data) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = limitesArea.findIndex(l => l.id === id);
      if (index === -1) {
        rej(new Error('Limite não encontrado'));
      } else {
        const atualizado = persistMockLimiteArea({ id, data, existing: limitesArea[index] });
        validateLimiteArea(atualizado);
        limitesArea[index] = atualizado;
        res(readMockLimiteArea(limitesArea[index]));
      }
    }, 300));
  },
  delete: async (id) => {
    return new Promise((res, rej) => setTimeout(() => {
      const index = limitesArea.findIndex(l => l.id === id);
      if (index === -1) {
        rej(new Error('Limite não encontrado'));
      } else {
        limitesArea.splice(index, 1);
        res({ success: true });
      }
    }, 200));
  },
  getAnosDisponiveis: async () => {
    return new Promise((res) => setTimeout(() => {
      const anos = [...new Set(limitesArea.map(l => l.ano))].sort((a, b) => b - a);
      res(anos);
    }, 100));
  }
};
