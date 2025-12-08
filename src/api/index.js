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
export { User, Produtor, Visita, CadernoCampo, Mapa } from './mock';

// Exportar validadores
export { default as validators } from './validators';
export { 
  validateUser, 
  validateProdutor, 
  validateVisita, 
  validateCadernoCampo, 
  validateMapa,
  validate 
} from './validators';

// Exportar constantes úteis
export const PERFIS_USUARIO = ['admin', 'colaborador', 'cliente'];
export const STATUS_PRODUTOR = ['ativo', 'inativo', 'pendente'];
export const STATUS_VISITA = ['agendada', 'realizada', 'cancelada'];
export const OBJETIVOS_VISITA = ['consultoria', 'coleta_solo', 'avaliacao_cultivo', 'entrega_material', 'outro'];
export const TIPOS_ATIVIDADE = ['plantio', 'adubacao', 'aplicacao', 'colheita', 'analise_solo', 'vistoria', 'outro'];
export const CATEGORIAS_MAPA = ['fertilidade', 'correcao', 'indice_vegetacao', 'colheita', 'plantio'];

// Helper: Buscar entidade por ID em qualquer coleção
export const findById = async (entityType, id) => {
  const entities = {
    'User': (await import('./mock')).User,
    'Produtor': (await import('./mock')).Produtor,
    'Visita': (await import('./mock')).Visita,
    'CadernoCampo': (await import('./mock')).CadernoCampo,
    'Mapa': (await import('./mock')).Mapa
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
    'User': (await import('./mock')).User,
    'Produtor': (await import('./mock')).Produtor,
    'Visita': (await import('./mock')).Visita,
    'CadernoCampo': (await import('./mock')).CadernoCampo,
    'Mapa': (await import('./mock')).Mapa
  };
  
  const entity = entities[entityType];
  if (!entity) {
    throw new Error(`Tipo de entidade inválido: ${entityType}`);
  }
  
  return entity.list();
};

export default {
  User: (async () => (await import('./mock')).User)(),
  Produtor: (async () => (await import('./mock')).Produtor)(),
  Visita: (async () => (await import('./mock')).Visita)(),
  CadernoCampo: (async () => (await import('./mock')).CadernoCampo)(),
  Mapa: (async () => (await import('./mock')).Mapa)(),
  validators: (async () => (await import('./validators')).default)()
};
