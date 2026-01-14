/**
 * Utilitários de Validação
 * Funções para validar campos de formulários
 */

/**
 * Valida email
 * @param {string} email 
 * @returns {boolean}
 */
export const validarEmail = (email) => {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Valida telefone brasileiro (com ou sem formatação)
 * @param {string} telefone 
 * @returns {boolean}
 */
export const validarTelefone = (telefone) => {
  if (!telefone) return false;
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length >= 10 && numeros.length <= 11;
};

/**
 * Valida CPF
 * @param {string} cpf 
 * @returns {boolean}
 */
export const validarCPF = (cpf) => {
  if (!cpf) return false;
  
  cpf = cpf.replace(/\D/g, '');
  
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // Todos os dígitos iguais
  
  let soma = 0;
  let resto;
  
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
};

/**
 * Valida CNPJ
 * @param {string} cnpj 
 * @returns {boolean}
 */
export const validarCNPJ = (cnpj) => {
  if (!cnpj) return false;
  
  cnpj = cnpj.replace(/\D/g, '');
  
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
};

/**
 * Formata telefone (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * @param {string} telefone 
 * @returns {string}
 */
export const formatarTelefone = (telefone) => {
  if (!telefone) return '';
  const numeros = telefone.replace(/\D/g, '');
  
  if (numeros.length === 11) {
    return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (numeros.length === 10) {
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return telefone;
};

/**
 * Formata CPF XXX.XXX.XXX-XX
 * @param {string} cpf 
 * @returns {string}
 */
export const formatarCPF = (cpf) => {
  if (!cpf) return '';
  const numeros = cpf.replace(/\D/g, '');
  
  if (numeros.length === 11) {
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  return cpf;
};

/**
 * Formata CNPJ XX.XXX.XXX/XXXX-XX
 * @param {string} cnpj 
 * @returns {string}
 */
export const formatarCNPJ = (cnpj) => {
  if (!cnpj) return '';
  const numeros = cnpj.replace(/\D/g, '');
  
  if (numeros.length === 14) {
    return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return cnpj;
};

/**
 * Valida área (número positivo)
 * @param {string|number} area 
 * @returns {boolean}
 */
export const validarArea = (area) => {
  const numero = parseFloat(area);
  return !isNaN(numero) && numero > 0;
};

/**
 * Valida nome (mínimo 3 caracteres)
 * @param {string} nome 
 * @returns {boolean}
 */
export const validarNome = (nome) => {
  return nome && nome.trim().length >= 3;
};

/**
 * Valida campo obrigatório
 * @param {any} valor 
 * @returns {boolean}
 */
export const validarObrigatorio = (valor) => {
  if (typeof valor === 'string') {
    return valor.trim().length > 0;
  }
  return valor !== null && valor !== undefined;
};

/**
 * Valida UF (estado)
 * @param {string} uf 
 * @returns {boolean}
 */
export const validarUF = (uf) => {
  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  return estados.includes(uf?.toUpperCase());
};

/**
 * Remove formatação de string (deixa só números)
 * @param {string} texto 
 * @returns {string}
 */
export const removerFormatacao = (texto) => {
  return texto ? texto.replace(/\D/g, '') : '';
};

/**
 * Valida URL
 * @param {string} url 
 * @returns {boolean}
 */
export const validarURL = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Retorna mensagem de erro para campo
 * @param {string} campo 
 * @param {string} tipo 
 * @returns {string}
 */
export const getMensagemErro = (campo, tipo = 'obrigatorio') => {
  const mensagens = {
    obrigatorio: `${campo} é obrigatório`,
    invalido: `${campo} inválido`,
    minimo: `${campo} muito curto`,
    email: 'Email inválido',
    telefone: 'Telefone inválido',
    cpf: 'CPF inválido',
    cnpj: 'CNPJ inválido',
    area: 'Área deve ser maior que zero',
    uf: 'UF inválida',
  };
  
  return mensagens[tipo] || `${campo} inválido`;
};
