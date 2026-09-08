import type { SessionSnapshot } from './contracts';

export interface AdministrativeUserCommandNavigationDefinition<
  TCreate,
  TEdit,
  TStatus,
  TInvitation,
> {
  readonly create: Readonly<{
    readonly name: 'AdministrativeUserCreate';
    readonly surface: TCreate;
  }> | null;
  readonly edit: Readonly<{
    readonly name: 'AdministrativeUserEdit';
    readonly surface: TEdit;
  }> | null;
  readonly status: Readonly<{
    readonly name: 'AdministrativeUserStatus';
    readonly surface: TStatus;
  }> | null;
  readonly invitation: Readonly<{
    readonly name: 'AdministrativeUserInvitation';
    readonly surface: TInvitation;
  }> | null;
}

export function buildAdministrativeUserCommandNavigationDefinition<
  TCreate,
  TEdit,
  TStatus,
  TInvitation,
>(
  snapshot: SessionSnapshot | null,
  surfaces: Readonly<{
    readonly create: TCreate;
    readonly edit: TEdit;
    readonly status: TStatus;
    readonly invitation: TInvitation;
  }>,
): AdministrativeUserCommandNavigationDefinition<
  TCreate,
  TEdit,
  TStatus,
  TInvitation
> {
  if (snapshot?.usuario.perfil !== 'admin') {
    return Object.freeze({
      create: null,
      edit: null,
      status: null,
      invitation: null,
    });
  }
  return Object.freeze({
    create: Object.freeze({
      name: 'AdministrativeUserCreate' as const,
      surface: surfaces.create,
    }),
    edit: Object.freeze({
      name: 'AdministrativeUserEdit' as const,
      surface: surfaces.edit,
    }),
    status: Object.freeze({
      name: 'AdministrativeUserStatus' as const,
      surface: surfaces.status,
    }),
    invitation: Object.freeze({
      name: 'AdministrativeUserInvitation' as const,
      surface: surfaces.invitation,
    }),
  });
}
