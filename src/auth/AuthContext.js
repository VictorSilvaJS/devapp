import React, { createContext, useState, useContext } from 'react';
import { authLogin, authLogout } from './authMock';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (profileKey) => {
    setLoading(true);
    try {
      const u = await authLogin(profileKey);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authLogout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    // simula atualização remota
    setLoading(true);
    try {
      const newUser = { ...user, ...updates };
      // aqui você chamaria API real
      setUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
