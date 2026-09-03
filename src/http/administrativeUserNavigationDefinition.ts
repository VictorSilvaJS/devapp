import { AdministrativeUserAccessDeniedError } from './administrativeUserAccess';
import type { SessionSnapshot } from './contracts';

export type AdministrativeUserNavigationTarget =
  | 'Users'
  | 'AdministrativeUserDetail';

export interface AdministrativeUserNavigationDefinition<TList, TDetail> {
  readonly tab: Readonly<{
    readonly name: 'Users';
    readonly surface: TList;
  }> | null;
  readonly detail: Readonly<{
    readonly name: 'AdministrativeUserDetail';
    readonly surface: TDetail;
  }> | null;
}

export function buildAdministrativeUserNavigationDefinition<TList, TDetail>(
  snapshot: SessionSnapshot | null,
  surfaces: Readonly<{ readonly list: TList; readonly detail: TDetail }>,
): AdministrativeUserNavigationDefinition<TList, TDetail> {
  if (snapshot?.usuario.perfil !== 'admin') {
    return Object.freeze({ tab: null, detail: null });
  }
  return Object.freeze({
    tab: Object.freeze({ name: 'Users' as const, surface: surfaces.list }),
    detail: Object.freeze({
      name: 'AdministrativeUserDetail' as const,
      surface: surfaces.detail,
    }),
  });
}

export function resolveAdministrativeUserNavigationSurface<TList, TDetail>(
  definition: AdministrativeUserNavigationDefinition<TList, TDetail>,
  target: AdministrativeUserNavigationTarget,
): TList | TDetail {
  if (target === 'Users' && definition.tab !== null) {
    return definition.tab.surface;
  }
  if (target === 'AdministrativeUserDetail' && definition.detail !== null) {
    return definition.detail.surface;
  }
  throw new AdministrativeUserAccessDeniedError();
}
