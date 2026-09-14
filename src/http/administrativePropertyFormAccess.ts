import React from 'react';
import type { HttpRuntime } from './runtime';
import { useHttpSession } from './HttpSessionContext';

export function canAdministerProperties(runtime: HttpRuntime): boolean {
  const user = runtime.session.snapshot?.usuario;
  const invalidation = runtime.administrativeUserData.current.invalidation;
  return user?.perfil === 'admin' && user.status === 'ativo' && runtime.administrativePropertyData.current.authorized &&
    invalidation !== 'forbidden' && invalidation !== 'invalid_session';
}

export function useAdministrativePropertyAccess() {
  const { runtime, snapshot } = useHttpSession();
  const boundary = runtime.administrativePropertyData;
  const users = runtime.administrativeUserData;
  const propertyState = React.useSyncExternalStore(
    React.useCallback((listener) => boundary.subscribe(listener), [boundary]),
    React.useCallback(() => boundary.current, [boundary]),
  );
  const admin = snapshot?.usuario.perfil === 'admin' && snapshot.usuario.status === 'ativo';
  React.useSyncExternalStore(React.useCallback((listener) => admin ? users.subscribe(listener) : () => {}, [users, admin]),
    React.useCallback(() => users.current, [users]));
  return { allowed: canAdministerProperties(runtime), propertyState };
}
