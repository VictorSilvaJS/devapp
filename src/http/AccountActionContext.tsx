import React from 'react';

import type {
  AccountAction,
  ParsedAccountActionLink,
} from './contracts';

export interface AccountActionContextValue {
  setPending(link: ParsedAccountActionLink): void;
  peek(allowed: readonly AccountAction[]): ParsedAccountActionLink | null;
  hasPending(allowed: readonly AccountAction[]): boolean;
  consume(allowed: readonly AccountAction[]): ParsedAccountActionLink | null;
  clear(): void;
  clearIf(link: ParsedAccountActionLink): void;
}

const AccountActionContext = React.createContext<AccountActionContextValue | null>(
  null,
);

export function AccountActionProvider({ children }: React.PropsWithChildren) {
  const pendingRef = React.useRef<ParsedAccountActionLink | null>(null);
  const [version, render] = React.useReducer((value) => value + 1, 0);

  const setPending = React.useCallback((link: ParsedAccountActionLink) => {
    pendingRef.current = link;
    render();
  }, []);
  const peek = React.useCallback((allowed: readonly AccountAction[]) => {
    const pending = pendingRef.current;
    return pending !== null && allowed.includes(pending.action)
      ? pending
      : null;
  }, []);
  const hasPending = React.useCallback((allowed: readonly AccountAction[]) => {
    const pending = pendingRef.current;
    return pending !== null && allowed.includes(pending.action);
  }, []);
  const consume = React.useCallback((allowed: readonly AccountAction[]) => {
    const pending = pendingRef.current;
    if (pending === null || !allowed.includes(pending.action)) return null;
    pendingRef.current = null;
    render();
    return pending;
  }, []);
  const clear = React.useCallback(() => {
    pendingRef.current = null;
    render();
  }, []);
  const clearIf = React.useCallback((link: ParsedAccountActionLink) => {
    const pending = pendingRef.current;
    if (
      pending?.action === link.action &&
      pending.token === link.token
    ) {
      pendingRef.current = null;
      render();
    }
  }, []);

  const value = React.useMemo<AccountActionContextValue>(() => ({
    setPending,
    peek,
    hasPending,
    consume,
    clear,
    clearIf,
  }), [clear, clearIf, consume, hasPending, peek, setPending, version]);

  return (
    <AccountActionContext.Provider value={value}>
      {children}
    </AccountActionContext.Provider>
  );
}

export function useAccountAction(): AccountActionContextValue {
  const value = React.useContext(AccountActionContext);
  if (value === null) {
    throw new Error('useAccountAction deve ser usado dentro de AccountActionProvider.');
  }
  return value;
}
