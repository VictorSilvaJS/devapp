import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { authLogin, authLogout } from './authMock';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthStateContext = createContext();
const AuthActionsContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // indica que carregamento inicial terminou
  const STORAGE_KEY = '@tche:user';

  useEffect(() => {
    // carregar usuario salvo ao iniciar
    const loadUser = async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          console.log('[AuthContext] loaded user from storage', parsed);
          setUser(parsed);
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

  const login = useCallback(async (profileKey) => {
    setLoading(true);
    try {
      const u = await authLogin(profileKey);
      console.log('[AuthContext] login -> setUser', u);
      setUser(u);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch(e) { console.warn('Não foi possível salvar usuário', e); }
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authLogout();
      console.log('[AuthContext] logout -> clear user');
      setUser(null);
      try { await AsyncStorage.removeItem(STORAGE_KEY); } catch(e) { console.warn('Não foi possível remover usuário', e); }
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    // simula atualização remota
    setLoading(true);
    try {
      const newUser = { ...user, ...updates };
      console.log('[AuthContext] updateProfile -> setUser', newUser);
      // aqui você chamaria API real
      setUser(newUser);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser)); } catch (e) { console.warn('Erro salvando user atualizado', e); }
      return newUser;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // state value (memoized) - only changes when user or isReady change
  const stateValue = useMemo(() => ({ user, isReady }), [user, isReady]);
  // actions value (memoized) - stable function refs, but includes loading
  const actionsValue = useMemo(() => ({ login, logout, updateProfile, loading }), [login, logout, updateProfile, loading]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuthState() {
  return useContext(AuthStateContext);
}

export function useAuthActions() {
  return useContext(AuthActionsContext);
}

// legacy combined hook for compatibility - avoid using in performance-sensitive components
export function useAuth() {
  const s = useAuthState();
  const a = useAuthActions();
  return { ...s, ...a };
}
