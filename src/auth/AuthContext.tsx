import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { authLogin, authLoginByProfile, authLogout } from './authMock';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeUsuario, toUsuarioCompativelBorda } from '../domain';

type CanonicalAuthUser = ReturnType<typeof normalizeUsuario> | null;
type AuthUser = ReturnType<typeof toUsuarioCompativelBorda> | null;

type AuthState = {
  user: AuthUser;
  isReady: boolean;
};

type AuthActions = {
  login: (email: string, senha: string) => Promise<any>;
  loginRapido: (profileKey: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (updates: Record<string, any>) => Promise<any>;
  loading: boolean;
};

const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<CanonicalAuthUser>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // indica que carregamento inicial terminou
  const STORAGE_KEY = '@tche:user';

  const normalizeAuthUser = useCallback((rawUser: any): CanonicalAuthUser => {
    if (!rawUser) return null;
    return normalizeUsuario(rawUser as any);
  }, []);

  const persistCanonicalUser = useCallback(async (nextUser: CanonicalAuthUser) => {
    try {
      if (nextUser) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Não foi possível persistir usuário', e);
    }
  }, []);

  useEffect(() => {
    // carregar usuario salvo ao iniciar
    const loadUser = async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          console.log('[AuthContext] loaded user from storage', parsed);
          setUser(normalizeAuthUser(parsed));
        }
      } catch (err) {
        console.error('Erro carregando usuário do storage', err);
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };
    loadUser();
  }, []);

  const login = useCallback(async (email, senha) => {
    setLoading(true);
    try {
      const rawUser = await authLogin(email, senha);
      const nextUser = normalizeAuthUser(rawUser);
      console.log('[AuthContext] login -> setUser', nextUser);
      setUser(nextUser);
      await persistCanonicalUser(nextUser);
      return nextUser ? toUsuarioCompativelBorda(nextUser) : null;
    } finally {
      setLoading(false);
    }
  }, [normalizeAuthUser, persistCanonicalUser]);

  // Login rápido por perfil (para testes/dev)
  const loginRapido = useCallback(async (profileKey) => {
    setLoading(true);
    try {
      const rawUser = await authLoginByProfile(profileKey);
      const nextUser = normalizeAuthUser(rawUser);
      console.log('[AuthContext] loginRapido -> setUser', nextUser);
      setUser(nextUser);
      await persistCanonicalUser(nextUser);
      return nextUser ? toUsuarioCompativelBorda(nextUser) : null;
    } finally {
      setLoading(false);
    }
  }, [normalizeAuthUser, persistCanonicalUser]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authLogout();
      console.log('[AuthContext] logout -> clear user');
      setUser(null);
      await persistCanonicalUser(null);
    } finally {
      setLoading(false);
    }
  }, [persistCanonicalUser]);

  const updateProfile = useCallback(async (updates) => {
    // simula atualização remota
    setLoading(true);
    try {
      const nextUser = normalizeAuthUser({ ...(user || {}), ...updates });
      console.log('[AuthContext] updateProfile -> setUser', nextUser);
      // aqui você chamaria API real
      setUser(nextUser);
      await persistCanonicalUser(nextUser);
      return nextUser ? toUsuarioCompativelBorda(nextUser) : null;
    } finally {
      setLoading(false);
    }
  }, [normalizeAuthUser, persistCanonicalUser, user]);

  const exposedUser = useMemo<AuthUser>(() => {
    if (!user) return null;
    return toUsuarioCompativelBorda(user);
  }, [user]);

  // state value (memoized) - only changes when user or isReady change
  const stateValue = useMemo(() => ({ user: exposedUser, isReady }), [exposedUser, isReady]);
  // actions value (memoized) - stable function refs, but includes loading
  const actionsValue = useMemo(() => ({ login, loginRapido, logout, updateProfile, loading }), [login, loginRapido, logout, updateProfile, loading]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState deve ser usado dentro de AuthProvider');
  }
  return context;
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions deve ser usado dentro de AuthProvider');
  }
  return context;
}

// legacy combined hook for compatibility - avoid using in performance-sensitive components
export function useAuth() {
  const s = useAuthState();
  const a = useAuthActions();
  return { ...s, ...a };
}
