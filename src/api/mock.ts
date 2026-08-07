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
  applyCadernoCommand,
  createCadernoDraft,
  isCadernoDraft,
  isCadernoDraftOwner,
  submitCadernoRecord,
  updateCadernoDraft,
  type CadernoActor,
  type CadernoCommand,
} from '../utils/cadernoLifecycleCompat';
import {
  applyVisitaCommand,
  buildVisitaIdempotencyKey,
  createVisitaLifecycleRecord,
  getVisitaEstado,
  withVisitaLifecycleReadCompat,
  type VisitaActor,
  type VisitaCommand,
} from '../utils/visitaLifecycleCompat';
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
import { createMockLocalPersistence } from './mockLocalPersistence';
import type { MockLocalState, MockLocalStorageAdapter } from './mockLocalPersistence';
import { createMockV2LocalPersistence } from './mockV2LocalPersistence';
import type { MockV2State } from '../domain/contractsV2';
import { mergeRuntimeIntoMockV2, projectMockV2ToRuntime } from './mockV2RuntimeCompat';
import { buildMockV2LimitesArea, buildMockV2TalhaoEntries } from './mockV2TalhaoGeometry';

const SELA_DEPRATA_1_PRODUTOR_ID = SELA_DE_PRATA_1_SHAPE_FAZENDA_ID;
const SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL =
  'asset://mapas/sela-prata-i/2025/fertilidade';

// Usuários do sistema
// NOTA: "produtor" = "cliente" = "proprietário" - mesma pessoa (dono da fazenda)
// Várias pessoas (pai, mãe) podem ter login vinculado ao mesmo proprietário
const users = [
  // ADMINISTRADORES - Acesso total ao Brasil
  {
    id: 'u1',
    nome: 'Admin Demonstração',
    email: 'admin.demonstracao@example.com',
    senha: 'admin123',
    perfil: 'admin',
    telefone: '',
    regioes_acesso: ['Brasil'],
    ativo: true,
    data_cadastro: new Date('2024-01-01').toISOString()
  },
  {
    id: 'u1b',
    nome: 'Admin Apoio Demonstração',
    email: 'admin.apoio@example.com',
    senha: 'admin123',
    perfil: 'admin',
    telefone: '',
    regioes_acesso: ['Brasil'],
    ativo: true,
    data_cadastro: new Date('2024-01-01').toISOString()
  },
  // COLABORADORES - Mesmas funções do admin, LIMITADO à região
  {
    id: 'u2',
    nome: 'Colaborador Campo Goiás',
    email: 'colaborador.goias@example.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Goiás',
    sub_regioes: ['Goiás 1', 'Rio Verde', 'Jataí'],
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-02-15').toISOString()
  },
  {
    id: 'u3',
    nome: 'Colaborador Campo Sul',
    email: 'colaborador.sul@example.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Sul',
    sub_regioes: ['RS - Norte', 'RS - Centro', 'RS - Sul'],
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-03-10').toISOString()
  },
  {
    id: 'u5',
    nome: 'Colaborador de Campo',
    email: 'colaborador.campo@example.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Mato Grosso',
    sub_regioes: ['MT - Norte', 'Sorriso', 'Lucas do Rio Verde'],
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-04-01').toISOString()
  },
  {
    id: 'u6',
    nome: 'Colaborador Campo Goiás 2',
    email: 'colaborador.goias2@example.com',
    senha: 'colab123',
    perfil: 'colaborador',
    regiao: 'Goiás',
    sub_regioes: ['Goiás 2', 'Goiânia', 'Anápolis'],
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-04-10').toISOString()
  },
  // PRODUTORES / CLIENTES / PROPRIETÁRIOS - Donos de fazenda
  // Produtor = Cliente = Proprietário (dono da fazenda)
  // Um proprietário pode ter VÁRIAS fazendas (relação 1:N via proprietario_id)
  {
    id: 'u7',
    nome: 'Produtor Demonstração Sul',
    email: 'produtor.sul@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop1', // proprietário - várias fazendas vinculadas
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'u8',
    nome: 'Responsável Demonstração Sul',
    email: 'responsavel.sul@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop1', // MESMO proprietário que o João
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'u9',
    nome: 'Produtor Demonstração Goiás',
    email: 'produtor.goias@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop2',
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-03-15').toISOString()
  },
  {
    id: 'u10',
    nome: 'Produtor Demonstração MT',
    email: 'produtor.mt@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop3',
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-02-01').toISOString()
  },
  {
    id: 'u11',
    nome: 'Produtor Demonstração Norte RS',
    email: 'produtor.norte.rs@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop_pedro',
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-06-01').toISOString()
  },
  {
    id: 'u12',
    nome: 'Produtor Demonstração Centro RS',
    email: 'produtor.centro.rs@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop_maria',
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-05-10').toISOString()
  },
  {
    id: 'u_sela1',
    nome: 'Produtor Demonstração',
    email: 'produtor.demonstracao@example.com',
    senha: 'prod123',
    perfil: 'produtor',
    produtor_id: 'prop_sela1',
    telefone: '',
    ativo: true,
    data_cadastro: new Date('2024-05-15').toISOString()
  }
];

// Produtores / Fazendas
// IMPORTANTE: Produtor = Cliente = Proprietário (dono da fazenda)
// Um proprietário pode ter VÁRIAS fazendas (relação 1:N)
// proprietario_id vincula a fazenda ao dono
const produtores: any[] = [
  // ─── Fazendas do titular demonstrativo "prop1" ───
  {
    id: 'p1',
    propriedade_id: 'p1',
    propriedadeId: 'p1',
    proprietario_id: 'prop1',
    titular_id: 'prop1',
    titularId: 'prop1',
    nome: 'Produtor Demonstração Sul',
    titular_nome: 'Produtor Demonstração Sul',
    fazenda: 'Fazenda Boa Vista',
    propriedade_nome: 'Fazenda Boa Vista',
    propriedadeNome: 'Fazenda Boa Vista',
    area_total: 850,
    cultura_atual: 'Soja',
    telefone: '',
    email: 'produtor.sul@example.com',
    endereco: '',
    cidade: 'Cruz Alta',
    estado: 'RS',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
    cep: '',
    ultima_analise: new Date('2024-10-15').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-04-20').toISOString()
  },
  {
    id: 'p1b',
    propriedade_id: 'p1b',
    propriedadeId: 'p1b',
    proprietario_id: 'prop1',
    titular_id: 'prop1',
    titularId: 'prop1',
    nome: 'Produtor Demonstração Sul',
    titular_nome: 'Produtor Demonstração Sul',
    fazenda: 'Fazenda Horizonte',
    propriedade_nome: 'Fazenda Horizonte',
    propriedadeNome: 'Fazenda Horizonte',
    area_total: 420,
    cultura_atual: 'Milho',
    telefone: '',
    email: 'produtor.sul@example.com',
    endereco: '',
    cidade: 'Cruz Alta',
    estado: 'RS',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
    cep: '',
    ultima_analise: new Date('2024-11-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-06-15').toISOString()
  },
  // ─── Outras fazendas ───
  {
    id: 'p2',
    propriedade_id: 'p2',
    propriedadeId: 'p2',
    proprietario_id: 'prop_maria',
    titular_id: 'prop_maria',
    titularId: 'prop_maria',
    nome: 'Produtor Demonstração Centro RS',
    titular_nome: 'Produtor Demonstração Centro RS',
    fazenda: 'Sítio Esperança',
    propriedade_nome: 'Sítio Esperança',
    propriedadeNome: 'Sítio Esperança',
    area_total: 120,
    cultura_atual: 'Milho',
    telefone: '',
    email: 'produtor.centro.rs@example.com',
    endereco: '',
    cidade: 'Santa Maria',
    estado: 'RS',
    regiao: 'Sul',
    microregiao: 'RS - Centro',
    cep: '',
    ultima_analise: new Date('2024-09-20').toISOString(),
    status: 'pendente',
    data_cadastro: new Date('2024-05-10').toISOString()
  },
  {
    id: 'p3',
    propriedade_id: 'p3',
    propriedadeId: 'p3',
    proprietario_id: 'prop_pedro',
    titular_id: 'prop_pedro',
    titularId: 'prop_pedro',
    nome: 'Produtor Demonstração Norte RS',
    titular_nome: 'Produtor Demonstração Norte RS',
    fazenda: 'Estância Santa Clara',
    propriedade_nome: 'Estância Santa Clara',
    propriedadeNome: 'Estância Santa Clara',
    area_total: 500,
    cultura_atual: 'Trigo',
    telefone: '',
    email: 'produtor.norte.rs@example.com',
    endereco: '',
    cidade: 'Passo Fundo',
    estado: 'RS',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
    cep: '',
    status: 'ativo',
    data_cadastro: new Date('2024-06-01').toISOString()
  },
  // ─── Fazendas do titular demonstrativo "prop2" ───
  {
    id: 'p4',
    propriedade_id: 'p4',
    propriedadeId: 'p4',
    proprietario_id: 'prop2',
    titular_id: 'prop2',
    titularId: 'prop2',
    nome: 'Produtor Demonstração Goiás',
    titular_nome: 'Produtor Demonstração Goiás',
    fazenda: 'Fazenda Planalto',
    propriedade_nome: 'Fazenda Planalto',
    propriedadeNome: 'Fazenda Planalto',
    area_total: 1200,
    cultura_atual: 'Soja',
    telefone: '',
    email: 'produtor.goias@example.com',
    endereco: '',
    cidade: 'Rio Verde',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Rio Verde',
    cep: '',
    ultima_analise: new Date('2024-11-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-03-15').toISOString()
  },
  {
    id: 'p4b',
    propriedade_id: 'p4b',
    propriedadeId: 'p4b',
    proprietario_id: 'prop2',
    titular_id: 'prop2',
    titularId: 'prop2',
    nome: 'Produtor Demonstração Goiás',
    titular_nome: 'Produtor Demonstração Goiás',
    fazenda: 'Fazenda Cerrado Alto',
    propriedade_nome: 'Fazenda Cerrado Alto',
    propriedadeNome: 'Fazenda Cerrado Alto',
    area_total: 800,
    cultura_atual: 'Milho',
    telefone: '',
    email: 'produtor.goias@example.com',
    endereco: '',
    cidade: 'Jataí',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Jataí',
    cep: '',
    ultima_analise: new Date('2024-10-20').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-05-20').toISOString()
  },
  // ─── Fazendas do titular demonstrativo "prop3" ───
  {
    id: 'p5',
    propriedade_id: 'p5',
    propriedadeId: 'p5',
    proprietario_id: 'prop3',
    titular_id: 'prop3',
    titularId: 'prop3',
    nome: 'Produtor Demonstração MT',
    titular_nome: 'Produtor Demonstração MT',
    fazenda: 'Agrícola Cerrado Verde',
    propriedade_nome: 'Agrícola Cerrado Verde',
    propriedadeNome: 'Agrícola Cerrado Verde',
    area_total: 2500,
    cultura_atual: 'Algodão',
    telefone: '',
    email: 'produtor.mt@example.com',
    endereco: '',
    cidade: 'Sorriso',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'Sorriso',
    cep: '',
    ultima_analise: new Date('2024-10-25').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-02-01').toISOString()
  },
  {
    id: 'p5b',
    propriedade_id: 'p5b',
    propriedadeId: 'p5b',
    proprietario_id: 'prop3',
    titular_id: 'prop3',
    titularId: 'prop3',
    nome: 'Produtor Demonstração MT',
    titular_nome: 'Produtor Demonstração MT',
    fazenda: 'Fazenda Ouro Verde',
    propriedade_nome: 'Fazenda Ouro Verde',
    propriedadeNome: 'Fazenda Ouro Verde',
    area_total: 1800,
    cultura_atual: 'Soja',
    telefone: '',
    email: 'produtor.mt@example.com',
    endereco: '',
    cidade: 'Lucas do Rio Verde',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'Lucas do Rio Verde',
    cep: '',
    ultima_analise: new Date('2024-11-10').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-03-01').toISOString()
  },
  // ─── Fazendas demonstrativas em Goiânia/Anápolis ───
  {
    id: 'p6',
    propriedade_id: 'p6',
    propriedadeId: 'p6',
    proprietario_id: 'prop5',
    titular_id: 'prop5',
    titularId: 'prop5',
    nome: 'Produtor Demonstração Goiás 2',
    titular_nome: 'Produtor Demonstração Goiás 2',
    fazenda: 'Fazenda Ouro Branco',
    propriedade_nome: 'Fazenda Ouro Branco',
    propriedadeNome: 'Fazenda Ouro Branco',
    area_total: 600,
    cultura_atual: 'Soja',
    telefone: '',
    email: 'produtor.goias2@example.com',
    endereco: '',
    cidade: 'Goiânia',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Goiânia',
    cep: '',
    ultima_analise: new Date('2024-10-20').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-04-01').toISOString()
  },
  {
    id: 'p6b',
    propriedade_id: 'p6b',
    propriedadeId: 'p6b',
    proprietario_id: 'prop5',
    titular_id: 'prop5',
    titularId: 'prop5',
    nome: 'Produtor Demonstração Goiás 2',
    titular_nome: 'Produtor Demonstração Goiás 2',
    fazenda: 'Fazenda Santa Helena',
    propriedade_nome: 'Fazenda Santa Helena',
    propriedadeNome: 'Fazenda Santa Helena',
    area_total: 480,
    cultura_atual: 'Milho',
    telefone: '',
    email: 'produtor.goias2@example.com',
    endereco: '',
    cidade: 'Anápolis',
    estado: 'GO',
    regiao: 'Goiás',
    microregiao: 'Anápolis',
    cep: '',
    ultima_analise: new Date('2024-11-05').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2024-05-15').toISOString()
  },
  // ─── Propriedade principal do pacote demonstrativo ─────────────────────────
  {
    id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedadeId: SELA_DEPRATA_1_PRODUTOR_ID,
    proprietario_id: 'prop_sela1',
    titular_id: 'prop_sela1',
    titularId: 'prop_sela1',
    nome: 'Produtor Demonstração',
    titular_nome: 'Produtor Demonstração',
    fazenda: 'Fazenda Sela de Prata I',
    propriedade_nome: 'Fazenda Sela de Prata I',
    propriedadeNome: 'Fazenda Sela de Prata I',
    area_total: 6200,
    cultura_atual: 'Soja',
    telefone: '',
    email: 'produtor.demonstracao@example.com',
    endereco: '',
    cidade: 'Alta Floresta',
    estado: 'MT',
    regiao: 'Mato Grosso',
    microregiao: 'MT - Norte',
    cep: '',
    ultima_analise: new Date('2025-06-01').toISOString(),
    status: 'ativo',
    data_cadastro: new Date('2025-01-10').toISOString()
  }
];

const usuarioPropriedade: any[] = [
  { usuario_id: 'u7', propriedade_id: 'p1', tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u7', propriedade_id: 'p1b', tipo_vinculo: 'titular', principal: false },
  { usuario_id: 'u8', propriedade_id: 'p1', tipo_vinculo: 'responsavel', principal: true },
  { usuario_id: 'u8', propriedade_id: 'p1b', tipo_vinculo: 'responsavel', principal: false },
  { usuario_id: 'u9', propriedade_id: 'p4', tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u9', propriedade_id: 'p4b', tipo_vinculo: 'titular', principal: false },
  { usuario_id: 'u10', propriedade_id: 'p5', tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u10', propriedade_id: 'p5b', tipo_vinculo: 'titular', principal: false },
  { usuario_id: 'u11', propriedade_id: 'p3', tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u12', propriedade_id: 'p2', tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u_sela1', propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID, tipo_vinculo: 'titular', principal: true },
  { usuario_id: 'u2', propriedade_id: 'p4', tipo_vinculo: 'colaborador', status: 'ativo', principal: true },
  { usuario_id: 'u2', propriedade_id: 'p4b', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u3', propriedade_id: 'p1', tipo_vinculo: 'colaborador', status: 'ativo', principal: true },
  { usuario_id: 'u3', propriedade_id: 'p1b', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u3', propriedade_id: 'p2', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u3', propriedade_id: 'p3', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u5', propriedade_id: 'p5', tipo_vinculo: 'colaborador', status: 'ativo', principal: true },
  { usuario_id: 'u5', propriedade_id: 'p5b', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u5', propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID, tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
  { usuario_id: 'u6', propriedade_id: 'p6', tipo_vinculo: 'colaborador', status: 'ativo', principal: true },
  { usuario_id: 'u6', propriedade_id: 'p6b', tipo_vinculo: 'colaborador', status: 'ativo', principal: false },
];

const usuarioMicroregiao: any[] = [
  { usuario_id: 'u2', regiao: 'Goiás', microregiao: 'Goiás 1' },
  { usuario_id: 'u2', regiao: 'Goiás', microregiao: 'Rio Verde' },
  { usuario_id: 'u2', regiao: 'Goiás', microregiao: 'Jataí' },
  { usuario_id: 'u3', regiao: 'Sul', microregiao: 'RS - Norte' },
  { usuario_id: 'u3', regiao: 'Sul', microregiao: 'RS - Centro' },
  { usuario_id: 'u3', regiao: 'Sul', microregiao: 'RS - Sul' },
  { usuario_id: 'u5', regiao: 'Mato Grosso', microregiao: 'MT - Norte' },
  { usuario_id: 'u5', regiao: 'Mato Grosso', microregiao: 'Sorriso' },
  { usuario_id: 'u5', regiao: 'Mato Grosso', microregiao: 'Lucas do Rio Verde' },
  { usuario_id: 'u6', regiao: 'Goiás', microregiao: 'Goiás 2' },
  { usuario_id: 'u6', regiao: 'Goiás', microregiao: 'Goiânia' },
  { usuario_id: 'u6', regiao: 'Goiás', microregiao: 'Anápolis' },
];

// Visitas técnicas
const visitas: any[] = [
  {
    id: 'v_sela1_realizada_demo',
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tecnico_responsavel: 'Colaborador de Campo',
    data_visita: '2026-05-28T14:00:00.000Z',
    objetivo: 'consultoria',
    observacoes: 'Visita demonstrativa para conferência do panorama da Propriedade e registro do contexto de campo.',
    recomendacoes: 'Nenhuma recomendação técnica registrada nesta demonstração.',
    fotos: [],
    clima: 'Condições de campo registradas apenas para demonstração.',
    status: 'realizada'
  },
  {
    id: 'v_sela1_agendada_demo',
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tecnico_responsavel: 'Colaborador de Campo',
    data_visita: '2026-06-12T14:00:00.000Z',
    objetivo: 'avaliacao_cultivo',
    observacoes: 'Visita demonstrativa agendada para continuidade da validação do fluxo de campo.',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  {
    id: 'v1',
    produtor_id: 'p1',
    tecnico_responsavel: 'Colaborador Campo Sul',
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
    tecnico_responsavel: 'Colaborador Campo Sul',
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
    tecnico_responsavel: 'Colaborador Campo Sul',
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
    tecnico_responsavel: 'Colaborador Campo Sul',
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
    tecnico_responsavel: 'Colaborador Campo Goiás',
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
    tecnico_responsavel: 'Colaborador Campo Goiás',
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
    tecnico_responsavel: 'Colaborador Campo Goiás',
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
    tecnico_responsavel: 'Colaborador de Campo',
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
    tecnico_responsavel: 'Colaborador de Campo',
    data_visita: new Date(Date.now() + 86400000 * 10).toISOString(),
    objetivo: 'coleta_solo',
    observacoes: '',
    recomendacoes: '',
    fotos: [],
    clima: '',
    status: 'agendada'
  },
  // ─── Visitas demonstrativas em Goiás (Goiânia/Anápolis) ───
  {
    id: 'v10',
    produtor_id: 'p6', // Fazenda Ouro Branco - Goiânia
    tecnico_responsavel: 'Colaborador Campo Goiás 2',
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
    tecnico_responsavel: 'Colaborador Campo Goiás 2',
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
    tecnico_responsavel: 'Colaborador Campo Goiás 2',
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
    id: 'c_sela1_vistoria_demo',
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    colaborador_responsavel: 'Colaborador de Campo',
    data_atividade: '2026-05-29T14:30:00.000Z',
    tipo_atividade: 'vistoria',
    talhao: 'T01 - 230',
    produtos_utilizados: [],
    dosagem: '',
    area_aplicada: null,
    condicoes_clima: 'Condição registrada apenas para demonstração.',
    observacoes: 'Registro demonstrativo de vistoria geral, sem recomendação técnica prescritiva.',
    visivel_para_produtor: true,
    fotos: []
  },
  {
    id: 'c1',
    produtor_id: 'p1',
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Sul',
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
    colaborador_responsavel: 'Colaborador Campo Goiás',
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
    colaborador_responsavel: 'Colaborador Campo Goiás',
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
    colaborador_responsavel: 'Colaborador de Campo',
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
    colaborador_responsavel: 'Colaborador de Campo',
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
  // ─── Cadernos demonstrativos em Goiás (Goiânia/Anápolis) ───
  {
    id: 'c11',
    produtor_id: 'p6', // Fazenda Ouro Branco - Goiânia
    colaborador_responsavel: 'Colaborador Campo Goiás 2',
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
    colaborador_responsavel: 'Colaborador Campo Goiás 2',
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
  // ─── Mapas demonstrativos em Goiás (Goiânia/Anápolis) ───
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
  // MVP: PNGs de fertilidade como anexos visuais; nao sao sobrepostos ao mapa.
  {
    id: 'm_sela1_ph_10a20_2025',
    titulo: 'pH - Fazenda Sela de Prata I',
    categoria: 'fertilidade',
    subcategoria: 'pH',
    tipo_material: 'diagnostico',
    versao: 1,
    elemento: 'ph',
    elemento_label: 'pH',
    profundidade: '10-20 cm',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tipo_anexo: 'anexo_fertilidade',
    talhao: 'Propriedade inteira',
    talhao_id: null,
    talhao_nome: 'Propriedade inteira',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025',
    arquivo_nome_original: 'PH_10a20.png',
    arquivo_url: `${SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL}/ph_10a20.png`,
    formato_arquivo: 'png',
    tamanho_arquivo: 206215,
    origem: 'drive_importado',
    status: 'liberado',
    visivel_para_produtor: true,
    disponivel_download: true,
    observacoes: 'Anexo visual de fertilidade. Arquivo original: PH_10a20.'
  },
  {
    id: 'm_sela1_argila_10a20_2025',
    titulo: 'Argila - Fazenda Sela de Prata I',
    categoria: 'fertilidade',
    subcategoria: 'Argila',
    tipo_material: 'diagnostico',
    versao: 1,
    elemento: 'argila',
    elemento_label: 'Argila',
    profundidade: '10-20 cm',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tipo_anexo: 'anexo_fertilidade',
    talhao: 'Propriedade inteira',
    talhao_id: null,
    talhao_nome: 'Propriedade inteira',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025',
    arquivo_nome_original: 'AR_10a20.png',
    arquivo_url: `${SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL}/ar_10a20.png`,
    formato_arquivo: 'png',
    tamanho_arquivo: 229387,
    origem: 'drive_importado',
    status: 'liberado',
    visivel_para_produtor: true,
    disponivel_download: true,
    observacoes: 'Anexo visual de fertilidade. Arquivo original: AR_10a20.'
  },
  {
    id: 'm_sela1_materia_organica_10a20_2025',
    titulo: 'Matéria Orgânica - Fazenda Sela de Prata I',
    categoria: 'fertilidade',
    subcategoria: 'Matéria Orgânica',
    tipo_material: 'diagnostico',
    versao: 1,
    elemento: 'materia_organica',
    elemento_label: 'Matéria orgânica',
    profundidade: '10-20 cm',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tipo_anexo: 'anexo_fertilidade',
    talhao: 'Propriedade inteira',
    talhao_id: null,
    talhao_nome: 'Propriedade inteira',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025',
    arquivo_nome_original: 'MO_10a20.png',
    arquivo_url: `${SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL}/mo_10a20.png`,
    formato_arquivo: 'png',
    tamanho_arquivo: 216527,
    origem: 'drive_importado',
    status: 'liberado',
    visivel_para_produtor: true,
    disponivel_download: true,
    observacoes: 'Anexo visual de fertilidade. Arquivo original: MO_10a20.'
  },
  {
    id: 'm_sela1_fosforo_10a20_2025',
    titulo: 'Fósforo - Fazenda Sela de Prata I',
    categoria: 'fertilidade',
    subcategoria: 'Fósforo',
    tipo_material: 'diagnostico',
    versao: 1,
    elemento: 'fosforo',
    elemento_label: 'Fósforo',
    profundidade: '10-20 cm',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tipo_anexo: 'anexo_fertilidade',
    talhao: 'Propriedade inteira',
    talhao_id: null,
    talhao_nome: 'Propriedade inteira',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025',
    arquivo_nome_original: 'PP_10a20.png',
    arquivo_url: `${SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL}/pp_10a20.png`,
    formato_arquivo: 'png',
    tamanho_arquivo: 220223,
    origem: 'drive_importado',
    status: 'liberado',
    visivel_para_produtor: true,
    disponivel_download: true,
    observacoes: 'Anexo visual de fertilidade. Arquivo original: PP_10a20.'
  },
  {
    id: 'm_sela1_potassio_10a20_2025',
    titulo: 'Potássio - Fazenda Sela de Prata I',
    categoria: 'fertilidade',
    subcategoria: 'Potássio',
    tipo_material: 'diagnostico',
    versao: 1,
    elemento: 'potassio',
    elemento_label: 'Potássio',
    profundidade: '10-20 cm',
    produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
    fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
    propriedade_id: SELA_DEPRATA_1_PRODUTOR_ID,
    tipo_anexo: 'anexo_fertilidade',
    talhao: 'Propriedade inteira',
    talhao_id: null,
    talhao_nome: 'Propriedade inteira',
    data_criacao: new Date('2025-06-05').toISOString(),
    safra: '2025',
    arquivo_nome_original: 'KK_10a20.png',
    arquivo_url: `${SELA_DEPRATA_1_FERTILIDADE_ASSET_BASE_URL}/kk_10a20.png`,
    formato_arquivo: 'png',
    tamanho_arquivo: 205197,
    origem: 'drive_importado',
    status: 'liberado',
    visivel_para_produtor: true,
    disponivel_download: true,
    observacoes: 'Anexo visual de fertilidade. Arquivo original: KK_10a20.'
  }
];

// ─── Limites de Área (Shape / Demarcação de Talhões) ───
// Referência: arquivos no drive com formato LT 2022, 23, 24, 25
const talhaoEstavelPorLimiteMockId: Record<string, string> = {
  lt1: 'talhao-p1-a',
  lt2: 'talhao-p1-b',
  lt3: 'talhao-p1-a',
  lt4: 'talhao-p1-c',
  lt5: 'talhao-p1-a',
  lt6: 'talhao-p1-b',
  lt7: 'talhao-p1-a',
  lt8: 'talhao-p1-b',
  lt9: 'talhao-p1-c',
  lt10: 'talhao-p4-pivo-central',
  lt11: 'talhao-p4-pivo-central',
  lt12: 'talhao-p5-area-norte',
  lt13: 'talhao-p5-area-norte',
};

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
].map((limite) => {
  const talhaoId = talhaoEstavelPorLimiteMockId[limite.id];
  return talhaoId ? { ...limite, talhao_id: talhaoId } : limite;
});

const cloneMockRecords = <T>(records: T[]): T[] =>
  JSON.parse(JSON.stringify(records));

const seedMockLimitesArea = cloneMockRecords(limitesArea);

const seedMockLocalState: MockLocalState = {
  users: cloneMockRecords(users),
  produtores: cloneMockRecords(produtores),
  usuarioPropriedade: cloneMockRecords(usuarioPropriedade),
  usuarioMicroregiao: cloneMockRecords(usuarioMicroregiao),
  visitas: cloneMockRecords(visitas),
  cadernos: cloneMockRecords(cadernos),
  mapas: cloneMockRecords(mapas),
};

const mockLocalPersistence = createMockLocalPersistence();
const mockV2LocalPersistence = createMockV2LocalPersistence();
let mockLocalHydration: Promise<void> | null = null;
let mockLocalSaveQueue: Promise<void> = Promise.resolve();
let mockLocalMutationQueue: Promise<void> = Promise.resolve();
let activeMockStorageVersion: 1 | 2 = 1;
let activeMockV2State: MockV2State | null = null;

const replaceMockRecords = (target: any[], records: any[]) => {
  target.splice(0, target.length, ...cloneMockRecords(records));
};

const readCurrentMockLocalState = (): MockLocalState => ({
  users: cloneMockRecords(users),
  produtores: cloneMockRecords(produtores),
  usuarioPropriedade: cloneMockRecords(usuarioPropriedade),
  usuarioMicroregiao: cloneMockRecords(usuarioMicroregiao),
  visitas: cloneMockRecords(visitas),
  cadernos: cloneMockRecords(cadernos),
  mapas: cloneMockRecords(mapas),
});

const applyMockLocalState = (state: MockLocalState) => {
  replaceMockRecords(users, state.users);
  replaceMockRecords(produtores, state.produtores);
  replaceMockRecords(usuarioPropriedade, state.usuarioPropriedade);
  replaceMockRecords(usuarioMicroregiao, state.usuarioMicroregiao);
  replaceMockRecords(visitas, state.visitas);
  replaceMockRecords(cadernos, state.cadernos);
  replaceMockRecords(mapas, state.mapas);
};

const ensureMockLocalHydrated = async () => {
  if (!mockLocalHydration) {
    mockLocalHydration = (async () => {
      const savedV2 = await mockV2LocalPersistence.load();
      if (savedV2) {
        activeMockStorageVersion = 2;
        activeMockV2State = savedV2;
        applyMockLocalState(projectMockV2ToRuntime(savedV2));
        replaceMockRecords(limitesArea, buildMockV2LimitesArea(savedV2));
        return;
      }

      if (await mockV2LocalPersistence.hasSnapshot()) {
        throw new Error('MockV2.storage: snapshot v2 inválido; fallback v1 bloqueado.');
      }

      const saved = await mockLocalPersistence.load();
      if (saved) {
        activeMockStorageVersion = 1;
        activeMockV2State = null;
        applyMockLocalState(saved);
        replaceMockRecords(limitesArea, seedMockLimitesArea);
        return;
      }

      activeMockStorageVersion = 1;
      activeMockV2State = null;
      applyMockLocalState(seedMockLocalState);
      replaceMockRecords(limitesArea, seedMockLimitesArea);
      await mockLocalPersistence.save(readCurrentMockLocalState());
    })();
  }

  await mockLocalHydration;
};

const persistCurrentMockLocalState = async () => {
  const state = readCurrentMockLocalState();
  const save = mockLocalSaveQueue.then(async () => {
    if (activeMockStorageVersion === 2 && activeMockV2State) {
      const nextV2State = mergeRuntimeIntoMockV2(activeMockV2State, state);
      activeMockV2State = await mockV2LocalPersistence.save(nextV2State);
      return;
    }

    await mockLocalPersistence.save(state);
  });

  mockLocalSaveQueue = save.catch(() => undefined);
  await save;
};

const waitMockDelay = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

const readHydratedMock = async <T>(delayMs: number, read: () => T | Promise<T>): Promise<T> => {
  await ensureMockLocalHydrated();
  await waitMockDelay(delayMs);
  return read();
};

const mutateHydratedMock = async <T>(delayMs: number, mutate: () => T | Promise<T>): Promise<T> => {
  await ensureMockLocalHydrated();
  await waitMockDelay(delayMs);

  const mutation = mockLocalMutationQueue.then(async () => {
    const previousState = readCurrentMockLocalState();

    try {
      const result = await mutate();
      await persistCurrentMockLocalState();
      return result;
    } catch (error) {
      applyMockLocalState(previousState);
      throw error;
    }
  });

  mockLocalMutationQueue = mutation.then(() => undefined, () => undefined);
  return mutation;
};

const mutateHydratedRuntime = async <T>(delayMs: number, mutate: () => T | Promise<T>): Promise<T> => {
  await ensureMockLocalHydrated();
  await waitMockDelay(delayMs);
  return mutate();
};

export const MockLocalData = {
  async restoreSeed() {
    await ensureMockLocalHydrated();
    await mockLocalMutationQueue;
    await mockV2LocalPersistence.clear();
    activeMockStorageVersion = 1;
    activeMockV2State = null;
    applyMockLocalState(seedMockLocalState);
    replaceMockRecords(limitesArea, seedMockLimitesArea);
    await persistCurrentMockLocalState();
    return readCurrentMockLocalState();
  },

  async reloadFromLocal() {
    await mockLocalMutationQueue;
    await mockLocalSaveQueue;
    mockLocalHydration = null;
    await ensureMockLocalHydrated();
    return readCurrentMockLocalState();
  },

  async readLocalSnapshot() {
    await ensureMockLocalHydrated();
    return activeMockStorageVersion === 2
      ? mockV2LocalPersistence.load()
      : mockLocalPersistence.load();
  },

  async readStorageVersion() {
    await ensureMockLocalHydrated();
    return activeMockStorageVersion;
  },

  __setStorageForTests(storage: MockLocalStorageAdapter) {
    mockLocalPersistence.setStorageAdapter(storage);
    mockV2LocalPersistence.setStorageAdapter(storage);
    applyMockLocalState(seedMockLocalState);
    replaceMockRecords(limitesArea, seedMockLimitesArea);
    mockLocalHydration = null;
    mockLocalSaveQueue = Promise.resolve();
    mockLocalMutationQueue = Promise.resolve();
    activeMockStorageVersion = 1;
    activeMockV2State = null;
  },
};

const statusUsuarioMock = new Set(['ativo', 'inativo', 'pendente']);
const tiposVinculoUsuarioPropriedade = new Set([
  'titular',
  'usuario_autorizado',
  'colaborador',
  // Compatibilidade de leitura durante a migração do formulário v1.
  'responsavel',
  'colaborador_atribuido',
  'outro',
]);

const hasOwn = (value: any, key: string) =>
  value && Object.prototype.hasOwnProperty.call(value, key);

const resolveUsuarioStatus = (data: any) => {
  if (typeof data?.status === 'string' && statusUsuarioMock.has(data.status)) {
    return data.status;
  }

  return data?.ativo === false ? 'inativo' : 'ativo';
};

const resolveUsuarioProdutorId = (usuario: any, usuarioId?: string) => {
  const produtorId = typeof usuario?.produtor_id === 'string' ? usuario.produtor_id.trim() : '';
  if (produtorId) return produtorId;

  return usuario?.perfil === 'produtor' ? String(usuarioId || usuario?.id || '').trim() : '';
};

const stripUsuarioRelations = (usuario: any) => {
  const { vinculos_propriedades, vinculos_microregioes, ...rest } = usuario || {};
  return rest;
};

const normalizeUsuarioPropriedadeLink = (link: any, usuarioId: string) => {
  const propriedadeId =
    typeof link?.propriedade_id === 'string'
      ? link.propriedade_id.trim()
      : typeof link?.fazenda_id === 'string'
        ? link.fazenda_id.trim()
        : '';

  if (!propriedadeId) return null;

  const tipo = tiposVinculoUsuarioPropriedade.has(link?.tipo_vinculo)
    ? link.tipo_vinculo
    : 'outro';

  return {
    id: typeof link?.id === 'string' && link.id.trim()
      ? link.id.trim()
      : `up_${usuarioId}_${propriedadeId}_${tipo}`,
    organizacao_id: 'org_tche_fertilidade',
    usuario_id: usuarioId,
    propriedade_id: propriedadeId,
    tipo_vinculo: tipo,
    status: link?.status === 'inativo' ? 'inativo' : 'ativo',
    principal: link?.principal === true,
  };
};

const normalizeUsuarioMicroregiaoLink = (link: any, usuarioId: string, fallbackRegiao = '') => {
  const microregiao = typeof link?.microregiao === 'string' ? link.microregiao.trim() : '';
  if (!microregiao) return null;

  return {
    usuario_id: usuarioId,
    regiao: typeof link?.regiao === 'string' ? link.regiao.trim() : fallbackRegiao,
    microregiao,
  };
};

const ensurePrincipalUsuarioPropriedade = (links: any[]) => {
  const hasPrincipal = links.some((link) => link.principal);
  return links.map((link, index) => ({
    ...link,
    principal: hasPrincipal ? link.principal === true : index === 0,
  }));
};

const deriveUsuarioPropriedadeLinks = (usuario: any, usuarioId: string) => {
  const produtorId = resolveUsuarioProdutorId(usuario, usuarioId);
  if (usuario?.perfil === 'produtor' && produtorId) {
    return ensurePrincipalUsuarioPropriedade(
      produtores
        .filter((propriedade) => propriedade.proprietario_id === produtorId || propriedade.produtor_id === produtorId)
        .map((propriedade, index) => ({
          usuario_id: usuarioId,
          propriedade_id: propriedade.id,
          tipo_vinculo: usuario.tipo_vinculo_produtor || 'titular',
          principal: index === 0,
        }))
    );
  }

  if (usuario?.perfil === 'colaborador' && Array.isArray(usuario?.propriedades_atribuidas)) {
    return ensurePrincipalUsuarioPropriedade(
      usuario.propriedades_atribuidas
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
        .map((id, index) => ({
          usuario_id: usuarioId,
          propriedade_id: id.trim(),
          tipo_vinculo: 'colaborador',
          status: 'ativo',
          principal: index === 0,
        }))
    );
  }

  return [];
};

const deriveUsuarioMicroregiaoLinks = (usuario: any, usuarioId: string) =>
  Array.isArray(usuario?.sub_regioes)
    ? usuario.sub_regioes
        .filter((microregiao) => typeof microregiao === 'string' && microregiao.trim().length > 0)
        .map((microregiao) => ({
          usuario_id: usuarioId,
          regiao: usuario?.regiao || '',
          microregiao: microregiao.trim(),
        }))
    : [];

const resolveUsuarioPropriedadeLinks = (usuarioId: string, usuario: any, patch: any, creating = false) => {
  if (hasOwn(patch, 'vinculos_propriedades')) {
    return ensurePrincipalUsuarioPropriedade(
      (Array.isArray(patch.vinculos_propriedades) ? patch.vinculos_propriedades : [])
        .map((link) => normalizeUsuarioPropriedadeLink(link, usuarioId))
        .filter(Boolean)
    );
  }

  const existing = usuarioPropriedade.filter((link) => link.usuario_id === usuarioId);
  if (!creating && existing.length > 0) {
    return existing.map((link) => ({ ...link }));
  }

  return deriveUsuarioPropriedadeLinks(usuario, usuarioId);
};

const resolveUsuarioMicroregiaoLinks = (usuarioId: string, usuario: any, patch: any, creating = false) => {
  if (hasOwn(patch, 'vinculos_microregioes')) {
    return (Array.isArray(patch.vinculos_microregioes) ? patch.vinculos_microregioes : [])
      .map((link) => normalizeUsuarioMicroregiaoLink(link, usuarioId, usuario?.regiao || ''))
      .filter(Boolean);
  }

  const existing = usuarioMicroregiao.filter((link) => link.usuario_id === usuarioId);
  if (!creating && existing.length > 0) {
    return existing.map((link) => ({ ...link }));
  }

  return deriveUsuarioMicroregiaoLinks(usuario, usuarioId);
};

const replaceUsuarioPropriedadeLinks = (usuarioId: string, links: any[]) => {
  for (let i = usuarioPropriedade.length - 1; i >= 0; i--) {
    if (usuarioPropriedade[i].usuario_id === usuarioId) {
      usuarioPropriedade.splice(i, 1);
    }
  }

  usuarioPropriedade.push(...ensurePrincipalUsuarioPropriedade(links).map((link) => ({ ...link, usuario_id: usuarioId })));
};

const replaceUsuarioMicroregiaoLinks = (usuarioId: string, links: any[]) => {
  for (let i = usuarioMicroregiao.length - 1; i >= 0; i--) {
    if (usuarioMicroregiao[i].usuario_id === usuarioId) {
      usuarioMicroregiao.splice(i, 1);
    }
  }

  usuarioMicroregiao.push(...links.map((link) => ({ ...link, usuario_id: usuarioId })));
};

const ensureUsuarioEmailUnico = (email: string, ignoreId?: string) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const duplicated = users.some((usuario) =>
    usuario.id !== ignoreId && String(usuario.email || '').trim().toLowerCase() === normalizedEmail
  );

  if (duplicated) {
    throw new Error('User.email: E-mail já cadastrado no mock');
  }
};

const validateUsuarioMock = (
  usuario: any,
  {
    ignoreId,
    vinculosPropriedades,
    vinculosMicroregioes,
  }: { ignoreId?: string; vinculosPropriedades: any[]; vinculosMicroregioes: any[] }
) => {
  if (activeMockStorageVersion === 2) {
    const requiredFields = ['nome', 'email', 'perfil'].filter((field) => !String(usuario?.[field] || '').trim());
    if (requiredFields.length > 0) {
      throw new Error(`User: Campos obrigatórios faltando: ${requiredFields.join(', ')}`);
    }
  } else {
    validateUser(usuario);
  }

  if (!usuario.status || !statusUsuarioMock.has(usuario.status)) {
    throw new Error('User.status: Status obrigatório');
  }

  ensureUsuarioEmailUnico(usuario.email, ignoreId);

  const vinculosAtivos = vinculosPropriedades.filter((vinculo) => vinculo.status !== 'inativo');

  if (activeMockStorageVersion === 2) {
    const tiposPermitidos = usuario.perfil === 'produtor'
      ? new Set(['titular', 'usuario_autorizado'])
      : usuario.perfil === 'colaborador'
        ? new Set(['colaborador'])
        : new Set<string>();

    if (vinculosPropriedades.some((vinculo) => !tiposPermitidos.has(vinculo.tipo_vinculo))) {
      throw new Error(`User.${usuario.perfil}: tipo de vínculo incompatível com o perfil`);
    }

    if (usuario.perfil === 'produtor') {
      const produtorId = resolveUsuarioProdutorId(usuario, usuario.id);
      const titularIncompativel = vinculosAtivos.some((vinculo) => {
        if (vinculo.tipo_vinculo !== 'titular') return false;
        const propriedade = produtores.find((item) => item.id === vinculo.propriedade_id);
        return !propriedade || String(
          propriedade.titular_id || propriedade.produtor_id || propriedade.proprietario_id || ''
        ).trim() !== produtorId;
      });
      if (titularIncompativel) {
        throw new Error('User.produtor: vínculo Titular não corresponde ao titular_id da Propriedade');
      }
    }
  }

  if (usuario.perfil === 'produtor' && usuario.status === 'ativo' && vinculosAtivos.length === 0) {
    throw new Error('User.produtor: Produtor ativo precisa ter ao menos uma propriedade vinculada');
  }

  if (
    usuario.perfil === 'colaborador'
    && usuario.status === 'ativo'
    && vinculosAtivos.length === 0
  ) {
    throw new Error('User.colaborador: Colaborador ativo precisa ter ao menos uma Propriedade vinculada diretamente');
  }

  return true;
};

const readUsuarioMock = (usuario: any) => {
  const status = resolveUsuarioStatus(usuario);
  const produtorId = resolveUsuarioProdutorId(usuario, usuario.id);
  return {
    ...usuario,
    produtor_id: usuario?.perfil === 'produtor' ? produtorId : usuario?.produtor_id || '',
    status,
    ativo: status === 'ativo',
    vinculos_propriedades: usuarioPropriedade
      .filter((link) => link.usuario_id === usuario.id)
      .map((link) => ({ ...link })),
    vinculos_microregioes: usuarioMicroregiao
      .filter((link) => link.usuario_id === usuario.id)
      .map((link) => ({ ...link })),
  };
};

// API para User
export const User: any = {
  list: async () =>
    readHydratedMock(200, () => users.map(readUsuarioMock)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const user = users.find(u => u.id === id);
      if (!user) throw new Error('Usuário não encontrado');
      return readUsuarioMock(user);
    }),
  getByEmail: async (email) =>
    readHydratedMock(200, () => {
      const user = users.find(u => u.email === email);
      if (!user) throw new Error('Usuário não encontrado');
      return readUsuarioMock(user);
    }),
  filter: async (query) => {
    const keys = Object.keys(query || {});
    return readHydratedMock(200, () =>
      users
        .map(readUsuarioMock)
        .filter(u => keys.every(k => String(u[k]).includes(String(query[k]))))
    );
  },
  create: async (data) =>
    mutateHydratedMock(200, () => {
      const id = `u${Date.now()}`;
      const boundaryData = activeMockStorageVersion === 1 && !data?.senha
        ? { ...data, senha: 'mock123' }
        : data;
      const status = resolveUsuarioStatus(boundaryData);
      const novo = {
        id,
        ...boundaryData,
        status,
        ativo: status === 'ativo',
        data_cadastro: new Date().toISOString()
      };
      novo.produtor_id = novo.perfil === 'produtor' ? resolveUsuarioProdutorId(novo, id) : '';
      const vinculosPropriedades = resolveUsuarioPropriedadeLinks(id, novo, boundaryData, true);
      const vinculosMicroregioes = resolveUsuarioMicroregiaoLinks(id, novo, boundaryData, true);

      validateUsuarioMock(novo, { ignoreId: id, vinculosPropriedades, vinculosMicroregioes });
      users.unshift(stripUsuarioRelations(novo));
      replaceUsuarioPropriedadeLinks(id, vinculosPropriedades);
      replaceUsuarioMicroregiaoLinks(id, vinculosMicroregioes);
      return readUsuarioMock(stripUsuarioRelations(novo));
    }),
  update: async (id, data) =>
    mutateHydratedMock(300, () => {
      const index = users.findIndex(u => u.id === id);
      if (index === -1) throw new Error('Usuário não encontrado');

      const status = resolveUsuarioStatus({ ...users[index], ...data });
      const atualizado = {
        ...users[index],
        ...data,
        id,
        status,
        ativo: status === 'ativo',
      };
      atualizado.produtor_id = atualizado.perfil === 'produtor'
        ? resolveUsuarioProdutorId(atualizado, id)
        : '';
      const vinculosPropriedades = resolveUsuarioPropriedadeLinks(id, atualizado, data, false);
      const vinculosMicroregioes = resolveUsuarioMicroregiaoLinks(id, atualizado, data, false);

      validateUsuarioMock(atualizado, { ignoreId: id, vinculosPropriedades, vinculosMicroregioes });
      users[index] = stripUsuarioRelations(atualizado);

      if (hasOwn(data, 'vinculos_propriedades') || data.perfil === 'admin' || data.perfil === 'produtor' || data.perfil === 'colaborador') {
        replaceUsuarioPropriedadeLinks(id, vinculosPropriedades);
      }

      if (hasOwn(data, 'vinculos_microregioes') || data.perfil === 'admin' || data.perfil === 'produtor' || data.perfil === 'colaborador') {
        replaceUsuarioMicroregiaoLinks(id, vinculosMicroregioes);
      }

      return readUsuarioMock(users[index]);
    }),
  delete: async (id) =>
    mutateHydratedMock(200, () => {
      const index = users.findIndex(u => u.id === id);
      if (index === -1) throw new Error('Usuário não encontrado');

      users.splice(index, 1);
      replaceUsuarioPropriedadeLinks(id, []);
      replaceUsuarioMicroregiaoLinks(id, []);
      return { success: true };
    })
};

// API para Produtor
export const Produtor: any = {
  list: async (order?: any) =>
    readHydratedMock(300, () => listMockProdutores(produtores)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const p = produtores.find(x => x.id === id);
      if (!p) throw new Error('Produtor não encontrado');
      return readMockProdutor(p);
    }),
  filter: async (query) =>
    readHydratedMock(200, () => filterMockProdutores(produtores, query)),
  create: async (data) =>
    mutateHydratedMock(200, () => {
      validateProdutor(data);
      const id = `p${Date.now()}`;
      const novo = persistMockProdutor({ id, data });
      produtores.unshift(novo);
      return readMockProdutor(novo);
    }),
  createWithLinks: async (
    data,
    {
      titularUsuarioId,
      colaboradorIds = [],
    }: { titularUsuarioId?: string; colaboradorIds?: string[] } = {}
  ) =>
    mutateHydratedMock(200, () => {
      validateProdutor(data);
      const titularId = String(data?.titular_id || data?.produtor_id || '').trim();
      const titularUsuarioIndex = users.findIndex((usuario) => usuario.id === titularUsuarioId);
      const titularUsuario = users[titularUsuarioIndex];
      const titularStatus = resolveUsuarioStatus(titularUsuario);
      if (
        !titularUsuario
        || titularUsuario.perfil !== 'produtor'
        || !['ativo', 'pendente'].includes(titularStatus)
        || resolveUsuarioProdutorId(titularUsuario, titularUsuario.id) !== titularId
      ) {
        throw new Error('Propriedade.titular: Produtor ativo ou pendente incompatível com o titular informado');
      }

      const colaboradoresUnicos = [...new Set(
        (Array.isArray(colaboradorIds) ? colaboradorIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )];
      const colaboradoresSelecionados = colaboradoresUnicos.map((usuarioId) => {
        const colaborador = users.find((usuario) => usuario.id === usuarioId);
        if (
          !colaborador
          || colaborador.perfil !== 'colaborador'
          || resolveUsuarioStatus(colaborador) !== 'ativo'
        ) {
          throw new Error(`Propriedade.colaborador: Colaborador ativo inexistente ${usuarioId}`);
        }
        return colaborador;
      });

      const id = `p${Date.now()}`;
      const novo = persistMockProdutor({ id, data });
      produtores.unshift(novo);

      if (titularStatus === 'pendente') {
        Object.assign(users[titularUsuarioIndex] as any, {
          status: 'ativo',
          ativo: true,
        });
      }

      const adicionarVinculo = (usuario: any, tipoVinculo: 'titular' | 'colaborador') => {
        const existentes = usuarioPropriedade
          .filter((link) => link.usuario_id === usuario.id)
          .map((link) => ({ ...link }));
        const novosVinculos = ensurePrincipalUsuarioPropriedade([
          ...existentes,
          normalizeUsuarioPropriedadeLink({
            propriedade_id: id,
            tipo_vinculo: tipoVinculo,
            status: 'ativo',
          }, usuario.id),
        ].filter(Boolean));

        validateUsuarioMock(
          { ...usuario, status: resolveUsuarioStatus(usuario) },
          {
            ignoreId: usuario.id,
            vinculosPropriedades: novosVinculos,
            vinculosMicroregioes: usuarioMicroregiao.filter((link) => link.usuario_id === usuario.id),
          }
        );
        replaceUsuarioPropriedadeLinks(usuario.id, novosVinculos);
      };

      adicionarVinculo(users[titularUsuarioIndex], 'titular');
      colaboradoresSelecionados.forEach((colaborador) => adicionarVinculo(colaborador, 'colaborador'));
      return readMockProdutor(novo);
    }),
  update: async (id, data) =>
    mutateHydratedMock(300, () => {
      const index = produtores.findIndex(p => p.id === id);
      if (index === -1) throw new Error('Produtor não encontrado');

      const atualizado = persistMockProdutor({ id, data, existing: produtores[index] });
      validateProdutor(atualizado);
      produtores[index] = atualizado;
      return readMockProdutor(produtores[index]);
    }),
  updateWithLinks: async (
    id,
    data,
    { colaboradorIds = [] }: { colaboradorIds?: string[] } = {}
  ) =>
    mutateHydratedMock(300, () => {
      const index = produtores.findIndex((propriedade) => propriedade.id === id);
      if (index === -1) throw new Error('Propriedade não encontrada');

      const atual = readMockProdutor(produtores[index]);
      const titularAtualId = String(
        atual?.titular_id || atual?.produtor_id || atual?.proprietario_id || ''
      ).trim();
      const titularSolicitadoId = String(
        data?.titular_id || data?.produtor_id || data?.proprietario_id || titularAtualId
      ).trim();
      if (!titularAtualId || titularSolicitadoId !== titularAtualId) {
        throw new Error('Propriedade.titular: o Titular não pode ser trocado na edição cadastral');
      }

      const colaboradoresUnicos = [...new Set(
        (Array.isArray(colaboradorIds) ? colaboradorIds : [])
          .map((usuarioId) => String(usuarioId || '').trim())
          .filter(Boolean)
      )];
      const colaboradoresSelecionados = new Set(colaboradoresUnicos);
      colaboradoresUnicos.forEach((usuarioId) => {
        const colaborador = users.find((usuario) => usuario.id === usuarioId);
        if (
          !colaborador
          || colaborador.perfil !== 'colaborador'
          || resolveUsuarioStatus(colaborador) !== 'ativo'
        ) {
          throw new Error(`Propriedade.colaborador: Colaborador ativo inexistente ${usuarioId}`);
        }
      });

      const atualizado = persistMockProdutor({
        id,
        data: { ...data, titular_id: titularAtualId },
        existing: produtores[index],
      });
      validateProdutor(atualizado);
      produtores[index] = atualizado;

      const tiposColaborador = new Set(['colaborador', 'responsavel', 'colaborador_atribuido']);
      users
        .filter((usuario) => usuario.perfil === 'colaborador')
        .forEach((colaborador) => {
          const existentes = usuarioPropriedade
            .filter((link) => link.usuario_id === colaborador.id)
            .map((link) => ({ ...link }));
          const tinhaVinculo = existentes.some((link) => (
            link.propriedade_id === id && tiposColaborador.has(link.tipo_vinculo)
          ));
          const selecionado = colaboradoresSelecionados.has(colaborador.id);
          if (!tinhaVinculo && !selecionado) return;

          const preservados = existentes.filter((link) => !(
            link.propriedade_id === id && tiposColaborador.has(link.tipo_vinculo)
          ));
          const proximos = ensurePrincipalUsuarioPropriedade([
            ...preservados,
            ...(selecionado
              ? [normalizeUsuarioPropriedadeLink({
                  propriedade_id: id,
                  tipo_vinculo: 'colaborador',
                  status: 'ativo',
                }, colaborador.id)]
              : []),
          ].filter(Boolean));

          validateUsuarioMock(
            { ...colaborador, status: resolveUsuarioStatus(colaborador) },
            {
              ignoreId: colaborador.id,
              vinculosPropriedades: proximos,
              vinculosMicroregioes: usuarioMicroregiao.filter(
                (link) => link.usuario_id === colaborador.id
              ),
            }
          );
          replaceUsuarioPropriedadeLinks(colaborador.id, proximos);
        });

      return readMockProdutor(produtores[index]);
    }),
  delete: async (id) =>
    mutateHydratedMock(200, () => {
      const index = produtores.findIndex(p => p.id === id);
      if (index === -1) throw new Error('Propriedade não encontrada');

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
        throw error;
      }

      produtores.splice(index, 1);
      return { success: true };
    })
};

// API para Visita
const inferVisitaActor = (data: any = {}, fallbackRecord: any = null): VisitaActor => ({
  usuarioId: String(
    data?.criada_por_usuario_id
    || data?.concluida_por_usuario_id
    || data?.usuario_id
    || fallbackRecord?.criada_por_usuario_id
    || '__mock_local_compat__'
  ).trim(),
  nome: String(
    data?.criada_por_nome
    || data?.concluida_por_nome
    || data?.tecnico_responsavel
    || fallbackRecord?.criada_por_nome
    || fallbackRecord?.tecnico_responsavel
    || ''
  ).trim() || undefined,
  perfil: 'colaborador',
  propriedadeIds: [
    String(
      data?.propriedade_id
      || data?.fazenda_id
      || data?.fazendaId
      || data?.produtor_id
      || fallbackRecord?.propriedade_id
      || fallbackRecord?.fazenda_id
      || fallbackRecord?.fazendaId
      || fallbackRecord?.produtor_id
      || ''
    ).trim(),
  ].filter(Boolean),
});

const VISITA_AGENDA_UPDATE_FIELDS = [
  'data_visita',
  'agendada_para',
  'objetivo',
  'observacoes',
  'recomendacoes',
  'clima',
  'proximaVisita',
  'tecnico_responsavel',
  'responsavel_usuario_id',
  'fotos',
] as const;

const VISITA_AGENDA_REQUEST_FIELDS = new Set([
  ...VISITA_AGENDA_UPDATE_FIELDS,
  'propriedade_id',
  'fazenda_id',
  'fazendaId',
  'produtor_id',
  'motivo_reagendamento',
]);

const VISITA_CREATE_REQUEST_FIELDS = new Set([
  'fazenda_id',
  'fazendaId',
  'produtor_id',
  'propriedade_id',
  'tecnico_responsavel',
  'responsavel_usuario_id',
  'responsavel_executante_usuario_id',
  'responsavel_executante_nome',
  'data_visita',
  'objetivo',
  'status',
  'observacoes',
  'recomendacoes',
  'clima',
  'proximaVisita',
  'fotos',
  'resumo_conclusao',
  'visita_origem_id',
]);

const assertVisitaAgendaRequestFields = (data: any = {}): void => {
  const forbidden = Object.keys(data || {}).filter((field) => !VISITA_AGENDA_REQUEST_FIELDS.has(field));
  if (forbidden.length > 0) {
    throw new Error(`Visita.agendamento: Campos não permitidos: ${forbidden.join(', ')}.`);
  }
};

const assertVisitaCreateRequestFields = (data: any = {}, allowLinkedOrigin = false): void => {
  const forbidden = Object.keys(data || {}).filter((field) => (
    !VISITA_CREATE_REQUEST_FIELDS.has(field)
    || (field === 'visita_origem_id' && !allowLinkedOrigin)
  ));
  if (forbidden.length > 0) {
    throw new Error(`Visita.criacao: Campos protegidos: ${forbidden.join(', ')}.`);
  }
};

const buildVisitaAgendaChanges = (data: any = {}): Record<string, unknown> =>
  VISITA_AGENDA_UPDATE_FIELDS.reduce<Record<string, unknown>>((changes, field) => {
    if (Object.prototype.hasOwnProperty.call(data || {}, field)) {
      changes[field] = data[field];
    }
    return changes;
  }, {});

const assertVisitaPropertyUnchanged = (record: any, data: any): void => {
  const currentId = String(record?.propriedade_id || record?.fazenda_id || record?.produtor_id || '').trim();
  const attemptedId = String(data?.propriedade_id || data?.fazenda_id || data?.fazendaId || data?.produtor_id || '').trim();
  if (attemptedId && attemptedId !== currentId) {
    throw new Error('Visita.agendamento: A Propriedade da Visita não pode ser reatribuída.');
  }
};

const createVisitaWithLifecycle = ({
  data,
  actor,
  idempotencyKey,
  allowLinkedOrigin = false,
}: {
  data: any;
  actor: VisitaActor;
  idempotencyKey: string;
  allowLinkedOrigin?: boolean;
}) => {
  assertVisitaCreateRequestFields(data, allowLinkedOrigin);
  const duplicate = visitas.find((item) => (
    Array.isArray(item?.eventos_visita)
    && item.eventos_visita.some((event) => event?.chave_idempotencia === idempotencyKey)
  ));
  if (duplicate) return readMockVisita(duplicate);

  validateVisita(data);
  const id = `v${Date.now()}`;
  const base = persistMockVisita({ id, data });
  const novo = createVisitaLifecycleRecord({ id, data: base, actor, idempotencyKey });
  validateVisita(novo);
  visitas.unshift(novo);
  return readMockVisita(novo);
};

export const Visita: any = {
  list: async () =>
    readHydratedMock(200, () => listMockVisitas(visitas)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const visita = visitas.find(v => v.id === id);
      if (!visita) throw new Error('Visita não encontrada');
      return readMockVisita(visita);
    }),
  filter: async (query) =>
    readHydratedMock(200, () => filterMockVisitas(visitas, query)),
  create: async (data) =>
    mutateHydratedMock(200, () => {
      const actor = inferVisitaActor(data);
      return createVisitaWithLifecycle({
        data,
        actor,
        idempotencyKey: buildVisitaIdempotencyKey('nova', getVisitaEstado(data) || 'agendada'),
      });
    }),
  createScheduled: async (data, actor: VisitaActor, idempotencyKey?: string) =>
    mutateHydratedMock(200, () => createVisitaWithLifecycle({
      data: { ...data, status: 'agendada' },
      actor,
      idempotencyKey: idempotencyKey || buildVisitaIdempotencyKey('nova', 'agendar'),
    })),
  registerCompleted: async (data, actor: VisitaActor, idempotencyKey?: string) =>
    mutateHydratedMock(200, () => createVisitaWithLifecycle({
      data: { ...data, status: 'realizada' },
      actor,
      idempotencyKey: idempotencyKey || buildVisitaIdempotencyKey('nova', 'registrar_realizada'),
    })),
  createFromCancelled: async (originId, data, actor: VisitaActor, idempotencyKey?: string) =>
    mutateHydratedMock(200, () => {
      const origin = visitas.find((item) => item.id === originId);
      if (!origin) throw new Error('Visita de origem não encontrada');
      const originRecord = withVisitaLifecycleReadCompat(origin);
      if (getVisitaEstado(originRecord) !== 'cancelada') {
        throw new Error('Visita.vinculo: Somente Visita cancelada pode originar uma nova.');
      }
      const originPropertyId = String(originRecord.propriedade_id || originRecord.fazenda_id || originRecord.produtor_id || '').trim();
      const targetPropertyId = String(data?.propriedade_id || data?.fazenda_id || data?.produtor_id || '').trim();
      if (!targetPropertyId || targetPropertyId !== originPropertyId) {
        throw new Error('Visita.vinculo: A nova Visita deve permanecer na mesma Propriedade.');
      }
      return createVisitaWithLifecycle({
        data: { ...data, status: 'agendada', visita_origem_id: originId },
        actor,
        idempotencyKey: idempotencyKey || buildVisitaIdempotencyKey(originId, 'nova_vinculada'),
        allowLinkedOrigin: true,
      });
    }),
  update: async (id, data) =>
    mutateHydratedMock(300, () => {
      const index = visitas.findIndex(v => v.id === id);
      if (index === -1) throw new Error('Visita não encontrada');
      if (Object.prototype.hasOwnProperty.call(data || {}, 'status')) {
        throw new Error('Visita.update: Estado não pode ser alterado por atualização genérica.');
      }
      assertVisitaAgendaRequestFields(data);
      const current = readMockVisita(visitas[index]);
      assertVisitaPropertyUnchanged(current, data);
      const command: VisitaCommand = {
        tipo: 'alterar_agendamento',
        versaoBase: Number(current.versao_atual),
        chaveIdempotencia: buildVisitaIdempotencyKey(id, 'alterar_agendamento'),
        alteracoes: buildVisitaAgendaChanges(data),
        motivo: data?.motivo_reagendamento,
      };
      const updated = applyVisitaCommand({
        record: current,
        command,
        actor: inferVisitaActor(data, current),
      });
      validateVisita(updated);
      visitas[index] = updated;
      return readMockVisita(updated);
    }),
  updateAgenda: async (
    id,
    data,
    actor: VisitaActor,
    motivo?: string,
    idempotencyKey?: string
  ) => mutateHydratedMock(300, () => {
    const index = visitas.findIndex(v => v.id === id);
    if (index === -1) throw new Error('Visita não encontrada');
    const current = readMockVisita(visitas[index]);
    assertVisitaPropertyUnchanged(current, data);
    if (Object.prototype.hasOwnProperty.call(data || {}, 'status')) {
      throw new Error('Visita.update: Estado não pode ser alterado por atualização genérica.');
    }
    assertVisitaAgendaRequestFields(data);
    const updated = applyVisitaCommand({
      record: current,
      actor,
      command: {
        tipo: 'alterar_agendamento',
        versaoBase: Number(current.versao_atual),
        chaveIdempotencia: idempotencyKey || buildVisitaIdempotencyKey(id, 'alterar_agendamento'),
        alteracoes: buildVisitaAgendaChanges(data),
        motivo,
      },
    });
    validateVisita(updated);
    visitas[index] = updated;
    return readMockVisita(updated);
  }),
  command: async (id, command: VisitaCommand, actor: VisitaActor) =>
    mutateHydratedMock(250, () => {
      const index = visitas.findIndex(v => v.id === id);
      if (index === -1) throw new Error('Visita não encontrada');
      const updated = applyVisitaCommand({
        record: readMockVisita(visitas[index]),
        command,
        actor,
      });
      validateVisita(updated);
      visitas[index] = updated;
      return readMockVisita(updated);
    }),
  delete: async (id) =>
    mutateHydratedMock(200, () => {
      const index = visitas.findIndex(v => v.id === id);
      if (index === -1) throw new Error('Visita não encontrada');
      throw new Error('Visita.delete: Visita persistida não pode ser excluída pelo fluxo comum.');
    })
};

// API para CadernoCampo
const inferCadernoActor = (data: any = {}, fallbackRecord: any = null): CadernoActor => ({
  usuarioId: String(
    data?.criado_por_user_id
    || data?.criado_por
    || fallbackRecord?.criado_por_user_id
    || fallbackRecord?.criado_por
    || '__mock_local_compat__'
  ).trim(),
  nome: String(data?.criado_por_nome || fallbackRecord?.criado_por_nome || '').trim() || undefined,
  perfil: data?.origem_registro === 'produtor' || fallbackRecord?.origem_registro === 'produtor'
    ? 'produtor'
    : 'colaborador',
  propriedadeIds: [
    String(
      data?.propriedade_id
      || data?.fazenda_id
      || data?.fazendaId
      || data?.produtor_id
      || fallbackRecord?.propriedade_id
      || fallbackRecord?.fazenda_id
      || fallbackRecord?.fazendaId
      || fallbackRecord?.produtor_id
      || ''
    ).trim(),
  ].filter(Boolean),
});

export const CadernoCampo: any = {
  list: async () =>
    readHydratedMock(200, () => listMockCadernosCampo(cadernos)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const caderno = cadernos.find(c => c.id === id);
      if (!caderno) throw new Error('Registro não encontrado');
      return readMockCadernoCampo(caderno);
    }),
  filter: async (query) =>
    readHydratedMock(200, () => filterMockCadernosCampo(cadernos, query)),
  create: async (data) =>
    mutateHydratedMock(200, () => {
      validateCadernoCampo(data);
      const id = `c${Date.now()}`;
      const base = persistMockCadernoCampo({ id, data });
      const novo = createCadernoDraft({ id, data: base, actor: inferCadernoActor(data) });
      cadernos.unshift(novo);
      return readMockCadernoCampo(novo);
    }),
  createDraft: async (data, actor: CadernoActor) =>
    mutateHydratedMock(200, () => {
      const id = `c${Date.now()}`;
      const base = persistMockCadernoCampo({ id, data });
      const novo = createCadernoDraft({ id, data: base, actor });
      validateCadernoCampo(novo);
      cadernos.unshift(novo);
      return readMockCadernoCampo(novo);
    }),
  submit: async (data, actor: CadernoActor) =>
    mutateHydratedMock(250, () => {
      validateCadernoCampo(data);
      const id = `c${Date.now()}`;
      const base = persistMockCadernoCampo({ id, data });
      const draft = createCadernoDraft({ id, data: base, actor });
      const registered = submitCadernoRecord({ record: draft, actor });
      validateCadernoCampo(registered);
      cadernos.unshift(registered);
      return readMockCadernoCampo(registered);
    }),
  update: async (id, data) =>
    mutateHydratedMock(300, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');

      const current = readMockCadernoCampo(cadernos[index]);
      if (!isCadernoDraft(current)) {
        throw new Error('CadernoCampo.update: Registro consolidado não aceita edição destrutiva.');
      }
      const candidate = persistMockCadernoCampo({ id, data, existing: current });
      const atualizado = updateCadernoDraft({
        record: current,
        data: candidate,
        actor: inferCadernoActor(data, current),
        replaceLocationGroup: true,
      });
      validateCadernoCampo(atualizado);
      cadernos[index] = atualizado;
      return readMockCadernoCampo(cadernos[index]);
    }),
  updateDraft: async (id, data, actor: CadernoActor) =>
    mutateHydratedMock(300, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');
      const current = readMockCadernoCampo(cadernos[index]);
      const candidate = persistMockCadernoCampo({ id, data, existing: current });
      const atualizado = updateCadernoDraft({ record: current, data: candidate, actor, replaceLocationGroup: true });
      validateCadernoCampo(atualizado);
      cadernos[index] = atualizado;
      return readMockCadernoCampo(atualizado);
    }),
  saveAndSubmitDraft: async (id, data, actor: CadernoActor) =>
    mutateHydratedMock(300, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');
      const current = readMockCadernoCampo(cadernos[index]);
      const candidate = persistMockCadernoCampo({ id, data, existing: current });
      const draft = updateCadernoDraft({ record: current, data: candidate, actor, replaceLocationGroup: true });
      const registered = submitCadernoRecord({ record: draft, actor });
      validateCadernoCampo(registered);
      cadernos[index] = registered;
      return readMockCadernoCampo(registered);
    }),
  submitDraft: async (id, actor: CadernoActor) =>
    mutateHydratedMock(250, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');
      const registered = submitCadernoRecord({ record: readMockCadernoCampo(cadernos[index]), actor });
      validateCadernoCampo(registered);
      cadernos[index] = registered;
      return readMockCadernoCampo(registered);
    }),
  command: async (id, command: CadernoCommand, actor: CadernoActor) =>
    mutateHydratedMock(250, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');
      const updated = applyCadernoCommand({
        record: readMockCadernoCampo(cadernos[index]),
        command,
        actor,
      });
      validateCadernoCampo(updated);
      cadernos[index] = updated;
      return readMockCadernoCampo(updated);
    }),
  delete: async (id, actor?: CadernoActor) =>
    mutateHydratedMock(200, () => {
      const index = cadernos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Registro não encontrado');

      const current = readMockCadernoCampo(cadernos[index]);
      const effectiveActor = actor || inferCadernoActor({}, current);
      if (!isCadernoDraft(current) || !isCadernoDraftOwner(current, effectiveActor.usuarioId)) {
        throw new Error('CadernoCampo.delete: Somente o criador pode descartar o próprio rascunho.');
      }

      cadernos.splice(index, 1);
      return { success: true };
    })
};

// API para Mapa
export const Mapa: any = {
  list: async () =>
    readHydratedMock(200, () => listMockMapas(mapas)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const mapa = mapas.find(m => m.id === id);
      if (!mapa) throw new Error('Mapa não encontrado');
      return readMockMapa(mapa);
    }),
  filter: async (query) =>
    readHydratedMock(200, () => filterMockMapas(mapas, query)),
  create: async (data) =>
    mutateHydratedMock(200, () => {
      validateMapa(data);
      const id = `m${Date.now()}`;
      const novo = persistMockMapa({ id, data });
      mapas.unshift(novo);
      return readMockMapa(novo);
    }),
  update: async (id, data) =>
    mutateHydratedMock(300, () => {
      const index = mapas.findIndex(m => m.id === id);
      if (index === -1) throw new Error('Mapa não encontrado');

      const atualizado = persistMockMapa({ id, data, existing: mapas[index] });
      validateMapa(atualizado);
      mapas[index] = atualizado;
      return readMockMapa(mapas[index]);
    }),
  delete: async (id) =>
    mutateHydratedMock(200, () => {
      const index = mapas.findIndex(m => m.id === id);
      if (index === -1) throw new Error('Mapa não encontrado');

      mapas.splice(index, 1);
      return { success: true };
    })
};

// API para LimiteArea (Shape / Demarcação)
export const LimiteArea: any = {
  list: async () =>
    readHydratedMock(200, () => listMockLimitesArea(limitesArea)),
  get: async (id) =>
    readHydratedMock(200, () => {
      const limite = limitesArea.find(l => l.id === id);
      if (!limite) throw new Error('Limite não encontrado');
      return readMockLimiteArea(limite);
    }),
  filter: async (query) =>
    readHydratedMock(200, () => filterMockLimitesArea(limitesArea, query)),
  getByAno: async (ano) =>
    readHydratedMock(200, () => listMockLimitesArea(limitesArea).filter(l => l.ano === ano)),
  getByFazenda: async (fazendaId) =>
    readHydratedMock(200, () => filterMockLimitesArea(limitesArea, { fazenda_id: fazendaId })),
  getByProdutor: async (fazendaId) =>
    readHydratedMock(200, () => {
      // Alias legado mantido enquanto consumidores antigos ainda pedem "produtor".
      return filterMockLimitesArea(limitesArea, { fazenda_id: fazendaId });
    }),
  create: async (data) =>
    mutateHydratedRuntime(200, () => {
      validateLimiteArea(data);
      const id = `lt${Date.now()}`;
      const novo = persistMockLimiteArea({ id, data });
      limitesArea.unshift(novo);
      return readMockLimiteArea(novo);
    }),
  update: async (id, data) =>
    mutateHydratedRuntime(300, () => {
      const index = limitesArea.findIndex(l => l.id === id);
      if (index === -1) throw new Error('Limite não encontrado');

      const atualizado = persistMockLimiteArea({ id, data, existing: limitesArea[index] });
      validateLimiteArea(atualizado);
      limitesArea[index] = atualizado;
      return readMockLimiteArea(limitesArea[index]);
    }),
  delete: async (id) =>
    mutateHydratedRuntime(200, () => {
      const index = limitesArea.findIndex(l => l.id === id);
      if (index === -1) throw new Error('Limite não encontrado');

      limitesArea.splice(index, 1);
      return { success: true };
    }),
  getAnosDisponiveis: async () =>
    readHydratedMock(100, () =>
      [...new Set(limitesArea.map(l => l.ano))].sort((a, b) => b - a)
    )
};

// API para o cadastro lógico de Talhão. A geometria é opcional e permanece em LimiteArea.
export const Talhao: any = {
  list: async () =>
    readHydratedMock(200, () => activeMockV2State
      ? buildMockV2TalhaoEntries(activeMockV2State, limitesArea)
      : listMockLimitesArea(limitesArea)),
  getByFazenda: async (fazendaId) =>
    readHydratedMock(200, () => {
      const talhoes = activeMockV2State
        ? buildMockV2TalhaoEntries(activeMockV2State, limitesArea)
        : listMockLimitesArea(limitesArea);
      return talhoes.filter((talhao) => (
        talhao?.propriedade_id === fazendaId
        || talhao?.fazenda_id === fazendaId
        || talhao?.produtor_id === fazendaId
      ));
    }),
};
