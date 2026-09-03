import type { SessionSnapshot } from './contracts';

export class AdministrativeUserAccessDeniedError extends Error {
  constructor() {
    super('Somente Administradores podem consultar Usuários.');
    this.name = 'AdministrativeUserAccessDeniedError';
  }
}

export interface AdministrativeUserNavigationCapabilities {
  readonly usersTab: boolean;
  readonly userDetail: boolean;
}

export function administrativeUserNavigationCapabilities(
  snapshot: SessionSnapshot | null,
): AdministrativeUserNavigationCapabilities {
  const allowed = snapshot?.usuario.perfil === 'admin';
  return Object.freeze({ usersTab: allowed, userDetail: allowed });
}

export function assertAdministrativeUserNavigationAccess(
  snapshot: SessionSnapshot | null,
): void {
  if (!administrativeUserNavigationCapabilities(snapshot).userDetail) {
    throw new AdministrativeUserAccessDeniedError();
  }
}

export function administrativeUserSessionPartition(
  snapshot: SessionSnapshot | null,
  sessionEpoch: number,
): string | null {
  if (snapshot === null) return null;
  return [
    snapshot.usuario.organizacao_id,
    snapshot.usuario.id,
    snapshot.id,
    snapshot.usuario.perfil,
    snapshot.usuario.versao_autorizacao,
    snapshot.escopo.versao,
    sessionEpoch,
  ].join(':');
}
