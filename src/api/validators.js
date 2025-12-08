/**
 * Validadores baseados nas entidades definidas em /entities
 * Garantem que os dados seguem o schema correto antes de serem salvos
 */

// Validador genérico de campos obrigatórios
const validateRequired = (data, requiredFields, entityName) => {
  const missing = requiredFields.filter(field => !data[field]);
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
  validateRequired(data, ['nome', 'email', 'senha', 'perfil'], 'User');
  
  if (!validateEmail(data.email)) {
    throw new Error('User.email: Email inválido');
  }
  
  validateEnum(data.perfil, ['admin', 'colaborador', 'cliente'], 'perfil', 'User');
  
  if (data.perfil === 'colaborador' && !data.regiao) {
    console.warn('User: Colaborador sem região definida');
  }
  
  if (data.perfil === 'cliente' && !data.produtor_id) {
    console.warn('User: Cliente sem produtor vinculado');
  }
  
  return true;
};

// Validador de Produtor
export const validateProdutor = (data) => {
  validateRequired(data, ['nome', 'fazenda', 'area_total'], 'Produtor');
  
  if (data.area_total && (typeof data.area_total !== 'number' || data.area_total <= 0)) {
    throw new Error('Produtor.area_total: Deve ser um número maior que zero');
  }
  
  if (data.status) {
    validateEnum(data.status, ['ativo', 'inativo', 'pendente'], 'status', 'Produtor');
  }
  
  if (data.email && !validateEmail(data.email)) {
    throw new Error('Produtor.email: Email inválido');
  }
  
  return true;
};

// Validador de Visita
export const validateVisita = (data) => {
  validateRequired(data, ['produtor_id', 'tecnico_responsavel', 'data_visita', 'objetivo'], 'Visita');
  
  validateEnum(data.objetivo, ['consultoria', 'coleta_solo', 'avaliacao_cultivo', 'entrega_material', 'outro'], 'objetivo', 'Visita');
  
  if (data.status) {
    validateEnum(data.status, ['agendada', 'realizada', 'cancelada'], 'status', 'Visita');
  }
  
  if (data.fotos && !Array.isArray(data.fotos)) {
    throw new Error('Visita.fotos: Deve ser um array');
  }
  
  return true;
};

// Validador de CadernoCampo
export const validateCadernoCampo = (data) => {
  validateRequired(data, ['produtor_id', 'colaborador_responsavel', 'data_atividade', 'tipo_atividade'], 'CadernoCampo');
  
  validateEnum(
    data.tipo_atividade, 
    ['plantio', 'adubacao', 'aplicacao', 'colheita', 'analise_solo', 'vistoria', 'outro'], 
    'tipo_atividade', 
    'CadernoCampo'
  );
  
  if (data.area_aplicada && (typeof data.area_aplicada !== 'number' || data.area_aplicada <= 0)) {
    throw new Error('CadernoCampo.area_aplicada: Deve ser um número maior que zero');
  }
  
  if (data.produtos_utilizados && !Array.isArray(data.produtos_utilizados)) {
    throw new Error('CadernoCampo.produtos_utilizados: Deve ser um array');
  }
  
  if (data.fotos && !Array.isArray(data.fotos)) {
    throw new Error('CadernoCampo.fotos: Deve ser um array');
  }
  
  return true;
};

// Validador de Mapa
export const validateMapa = (data) => {
  validateRequired(data, ['titulo', 'categoria', 'produtor_id', 'talhao'], 'Mapa');
  
  validateEnum(
    data.categoria, 
    ['fertilidade', 'correcao', 'indice_vegetacao', 'colheita', 'plantio'], 
    'categoria', 
    'Mapa'
  );
  
  if (data.coordenadas) {
    if (typeof data.coordenadas !== 'object') {
      throw new Error('Mapa.coordenadas: Deve ser um objeto');
    }
    
    if (data.coordenadas.latitude && typeof data.coordenadas.latitude !== 'number') {
      throw new Error('Mapa.coordenadas.latitude: Deve ser um número');
    }
    
    if (data.coordenadas.longitude && typeof data.coordenadas.longitude !== 'number') {
      throw new Error('Mapa.coordenadas.longitude: Deve ser um número');
    }
    
    if (data.coordenadas.poligono && !Array.isArray(data.coordenadas.poligono)) {
      throw new Error('Mapa.coordenadas.poligono: Deve ser um array');
    }
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
    'Mapa': validateMapa
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
  validateMapa
};
