/**
 * API Mock - Exportações centralizadas
 * 
 * Este módulo exporta todas as entidades e utilitários da API mock.
 * Use este arquivo como ponto de entrada para importações.
 * 
 * Exemplo de uso:
 * import { Produtor, User, validators } from '../api';
 */

// Exportar todas as entidades
export { User, Produtor, Visita, CadernoCampo, Mapa, LimiteArea } from './mock';
import { User, Produtor, Visita, CadernoCampo, Mapa, LimiteArea } from './mock';

// Exportar validadores
export { default as validators } from './validators';
import validators from './validators';
export { 
  validateUser, 
  validateProdutor, 
  validateVisita, 
  validateCadernoCampo, 
  validateMapa,
  validateLimiteArea,
  validate 
} from './validators';

// Exportar constantes úteis
export const PERFIS_USUARIO = ['admin', 'colaborador', 'produtor'];
export const STATUS_PRODUTOR = ['ativo', 'inativo', 'pendente'];
export const STATUS_VISITA = ['agendada', 'realizada', 'cancelada'];
export const OBJETIVOS_VISITA = ['consultoria', 'coleta_solo', 'avaliacao_cultivo', 'entrega_material', 'outro'];
export const TIPOS_ATIVIDADE = [
  'observacao',
  'visita_tecnica',
  'fertilidade',
  'correcao_solo',
  'prescricao',
  'plantio',
  'ocorrencia',
  'colheita',
  'outro',
  'adubacao',
  'aplicacao',
  'analise_solo',
  'vistoria',
];
export const CATEGORIAS_MAPA = ['fertilidade', 'correcao', 'indice_vegetacao', 'colheita', 'plantio', 'panorama'];

// Helper: Buscar entidade por ID em qualquer coleção
export const findById = async (entityType, id) => {
  const entities = {
    'User': User,
    'Produtor': Produtor,
    'Visita': Visita,
    'CadernoCampo': CadernoCampo,
    'Mapa': Mapa,
    'LimiteArea': LimiteArea
  };
  
  const entity = entities[entityType];
  if (!entity) {
    throw new Error(`Tipo de entidade inválido: ${entityType}`);
  }
  
  return entity.get(id);
};

// Helper: Listar todas as entidades de um tipo
export const listAll = async (entityType) => {
  const entities = {
    'User': User,
    'Produtor': Produtor,
    'Visita': Visita,
    'CadernoCampo': CadernoCampo,
    'Mapa': Mapa,
    'LimiteArea': LimiteArea
  };
  
  const entity = entities[entityType];
  if (!entity) {
    throw new Error(`Tipo de entidade inválido: ${entityType}`);
  }
  
  return entity.list();
};

export default {
  User,
  Produtor,
  Visita,
  CadernoCampo,
  Mapa,
  LimiteArea,
  validators
};
