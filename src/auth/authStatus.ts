export const AUTH_PENDING_ACCESS_MESSAGE = 'Seu acesso ainda está pendente de liberação pelo administrador.';
export const AUTH_INACTIVE_ACCESS_MESSAGE = 'Seu acesso está inativo. Solicite a reativação ao administrador.';
export const AUTH_UNKNOWN_STATUS_MESSAGE = 'Não foi possível validar a situação deste acesso.';

export type UsuarioStatusEfetivo = 'ativo' | 'pendente' | 'inativo' | 'desconhecido';

export const getUsuarioStatusEfetivo = (usuario: any): UsuarioStatusEfetivo => {
  if (!usuario || typeof usuario !== 'object') {
    return 'desconhecido';
  }

  const status = typeof usuario?.status === 'string'
    ? usuario.status.trim().toLowerCase()
    : '';

  if (status === 'ativo' || status === 'pendente' || status === 'inativo') {
    return status;
  }

  if (status) {
    return 'desconhecido';
  }

  return usuario?.ativo === false ? 'inativo' : 'ativo';
};

export const canUsuarioLogin = (usuario: any): boolean =>
  getUsuarioStatusEfetivo(usuario) === 'ativo';

export const assertUsuarioPodeEntrar = (usuario: any) => {
  const status = getUsuarioStatusEfetivo(usuario);

  if (status === 'ativo') {
    return usuario;
  }

  if (status === 'pendente') {
    throw new Error(AUTH_PENDING_ACCESS_MESSAGE);
  }

  if (status === 'inativo') {
    throw new Error(AUTH_INACTIVE_ACCESS_MESSAGE);
  }

  throw new Error(AUTH_UNKNOWN_STATUS_MESSAGE);
};
