/**
 * Validadores baseados nas entidades definidas em /entities
 * Garantem que os dados seguem o schema correto antes de serem salvos
 */
import {
  CATEGORIAS_MAPA_PROVISORIAS,
  ELEMENTOS_DIAGNOSTICO_MVP,
  normalizeCadernoCampo,
  normalizeLimiteArea,
  normalizeMapa,
  normalizeUsuario,
  normalizeVisita,
} from '../domain';
import { normalizeMockFazendaInput } from './produtorCompat';

const isMissingValue = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

// Validador genérico de campos obrigatórios
const validateRequired = (data, requiredFields, entityName) => {
  const missing = requiredFields.filter(field => isMissingValue(data[field]));
  if (missing.length > 0) {
    throw new Error(`${entityName}: Campos obrigatórios faltando: ${missing.join(', ')}`);
  }
};

// Validador de enum
const validateEnum = (value, enumValues, fieldName, entityName) => {
  if (value && !enumValues.includes(value)) {
    throw new Error(`${entityName}.${fieldName}: Valor inválido. Valores permitidos: ${enumValues.join(', ')}`);
  }
};

// Validador de email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validador de User
export const validateUser = (data) => {
  const normalized = normalizeUsuario(data);

  validateRequired(normalized, ['nome', 'email', 'senha', 'perfil'], 'User');
  
  if (!validateEmail(normalized.email)) {
    throw new Error('User.email: Email inválido');
  }
  
  validateEnum(normalized.perfil, ['admin', 'colaborador', 'produtor'], 'perfil', 'User');
  
  if (normalized.perfil === 'colaborador' && !normalized.regiao) {
    console.warn('User: Colaborador sem região definida');
  }
  
  if (normalized.perfil === 'produtor' && !normalized.produtor_id) {
    console.warn('User: Produtor/Proprietário sem produtor_id vinculado');
  }
  
  return true;
};

// Validador de Produtor
export const validateProdutor = (data) => {
  const normalized = normalizeMockFazendaInput(data);

  validateRequired(normalized, ['nome', 'area_total'], 'Produtor');

  if (!normalized.produtor_nome) {
    console.warn('Produtor/Fazenda: nome do produtor titular não informado de forma explícita');
  }

  if (!normalized.produtor_id) {
    console.warn('Produtor/Fazenda: produtor_id do titular não informado');
  }
  
  if (normalized.area_total && (typeof normalized.area_total !== 'number' || normalized.area_total <= 0)) {
    throw new Error('Produtor.area_total: Deve ser um número maior que zero');
  }
  
  if (normalized.status) {
    validateEnum(normalized.status, ['ativo', 'inativo', 'pendente'], 'status', 'Produtor');
  }
  
  if (normalized.email && !validateEmail(normalized.email)) {
    throw new Error('Produtor.email: Email inválido');
  }
  
  return true;
};

// Validador de Visita
export const validateVisita = (data) => {
  const normalized = normalizeVisita(data);

  validateRequired(normalized, ['fazenda_id', 'tecnico_responsavel', 'data_visita', 'objetivo'], 'Visita');
  
  validateEnum(normalized.objetivo, ['consultoria', 'coleta_solo', 'avaliacao_cultivo', 'entrega_material', 'outro'], 'objetivo', 'Visita');
  
  if (normalized.status) {
    validateEnum(normalized.status, ['agendada', 'realizada', 'cancelada'], 'status', 'Visita');
  }
  
  if (normalized.fotos && !Array.isArray(normalized.fotos)) {
    throw new Error('Visita.fotos: Deve ser um array');
  }
  
  return true;
};

// Validador de CadernoCampo
export const validateCadernoCampo = (data) => {
  const normalized = normalizeCadernoCampo(data);

  validateRequired(normalized, ['fazenda_id', 'colaborador_responsavel', 'data_atividade', 'tipo_atividade'], 'CadernoCampo');
  
  validateEnum(
    normalized.tipo_atividade, 
    ['plantio', 'adubacao', 'aplicacao', 'colheita', 'analise_solo', 'vistoria', 'outro'], 
    'tipo_atividade', 
    'CadernoCampo'
  );
  
  if (normalized.area_aplicada !== undefined && normalized.area_aplicada !== null &&
      (typeof normalized.area_aplicada !== 'number' || normalized.area_aplicada <= 0)) {
    throw new Error('CadernoCampo.area_aplicada: Deve ser um número maior que zero');
  }
  
  if (normalized.produtos_utilizados && !Array.isArray(normalized.produtos_utilizados)) {
    throw new Error('CadernoCampo.produtos_utilizados: Deve ser um array');
  }
  
  if (normalized.fotos && !Array.isArray(normalized.fotos)) {
    throw new Error('CadernoCampo.fotos: Deve ser um array');
  }
  
  return true;
};

// Validador de Mapa
export const validateMapa = (data) => {
  const normalized = normalizeMapa(data);

  validateRequired(normalized, ['titulo', 'categoria', 'fazenda_id', 'talhao'], 'Mapa');

  if (normalized.categoria && !CATEGORIAS_MAPA_PROVISORIAS.includes(normalized.categoria as any)) {
    console.warn(
      `Mapa.categoria: "${normalized.categoria}" fora do catálogo provisório (${CATEGORIAS_MAPA_PROVISORIAS.join(', ')}).`
    );
  }

  if (normalized.tipo_material === 'diagnostico' && !normalized.elemento && !normalized.subcategoria) {
    console.warn('Mapa: material diagnóstico sem elemento/subcategoria informado');
  }

  if (normalized.elemento && !ELEMENTOS_DIAGNOSTICO_MVP.includes(normalized.elemento as any)) {
    console.warn(
      `Mapa.elemento: "${normalized.elemento}" fora do catálogo inicial do MVP (${ELEMENTOS_DIAGNOSTICO_MVP.join(', ')}).`
    );
  }
  
  if (normalized.coordenadas) {
    if (typeof normalized.coordenadas !== 'object' || Array.isArray(normalized.coordenadas)) {
      throw new Error('Mapa.coordenadas: Deve ser um objeto');
    }
    
    if (normalized.coordenadas.latitude !== undefined && typeof normalized.coordenadas.latitude !== 'number') {
      throw new Error('Mapa.coordenadas.latitude: Deve ser um número');
    }
    
    if (normalized.coordenadas.longitude !== undefined && typeof normalized.coordenadas.longitude !== 'number') {
      throw new Error('Mapa.coordenadas.longitude: Deve ser um número');
    }
    
    if (normalized.coordenadas.poligono && !Array.isArray(normalized.coordenadas.poligono)) {
      throw new Error('Mapa.coordenadas.poligono: Deve ser um array');
    }
  }
  
  return true;
};

// Validador de LimiteArea
export const validateLimiteArea = (data) => {
  const normalized = normalizeLimiteArea(data);

  validateRequired(normalized, ['nome', 'fazenda_id', 'talhao'], 'LimiteArea');

  if (typeof normalized.ano !== 'number' || normalized.ano <= 0) {
    throw new Error('LimiteArea.ano: Deve ser um ano válido');
  }

  if (!Array.isArray(normalized.poligono) || normalized.poligono.length === 0) {
    throw new Error('LimiteArea.poligono: Deve ser um array com coordenadas');
  }

  if (normalized.area_hectares !== undefined &&
      (typeof normalized.area_hectares !== 'number' || normalized.area_hectares <= 0)) {
    throw new Error('LimiteArea.area_hectares: Deve ser um número maior que zero');
  }

  return true;
};

// Função helper para validar qualquer entidade
export const validate = (entityType, data) => {
  const validators = {
    'User': validateUser,
    'Produtor': validateProdutor,
    'Visita': validateVisita,
    'CadernoCampo': validateCadernoCampo,
    'Mapa': validateMapa,
    'LimiteArea': validateLimiteArea
  };
  
  const validator = validators[entityType];
  if (!validator) {
    throw new Error(`Validador não encontrado para entidade: ${entityType}`);
  }
  
  return validator(data);
};

export default {
  validate,
  validateUser,
  validateProdutor,
  validateVisita,
  validateCadernoCampo,
  validateMapa,
  validateLimiteArea
};
