import { normalizeUsuario } from '../domain';

export const AUTH_STORAGE_KEY = '@tche:user';

export interface AuthSessionStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const sensitiveAuthFields = new Set([
  'senha',
  'senha_hash',
  'salt',
  'credencial',
  'credential',
  'credentials',
  'token',
  'accessToken',
  'refreshToken',
]);

export const stripSensitiveAuthFields = (rawUser: any) => {
  if (!rawUser || typeof rawUser !== 'object') return rawUser;

  return Object.keys(rawUser).reduce((acc, key) => {
    if (!sensitiveAuthFields.has(key)) {
      acc[key] = rawUser[key];
    }
    return acc;
  }, {} as Record<string, any>);
};

export const sanitizeAuthUserForSession = (rawUser: any) => {
  if (!rawUser) return null;
  return normalizeUsuario(stripSensitiveAuthFields(rawUser));
};

export const persistAuthSessionUser = async (
  storage: AuthSessionStorageAdapter,
  rawUser: any
) => {
  const sanitized = sanitizeAuthUserForSession(rawUser);

  if (sanitized) {
    await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sanitized));
  } else {
    await storage.removeItem(AUTH_STORAGE_KEY);
  }

  return sanitized;
};

export const restoreAuthSessionUser = async (storage: AuthSessionStorageAdapter) => {
  const raw = await storage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  return sanitizeAuthUserForSession(JSON.parse(raw));
};

export const clearAuthSessionUser = async (storage: AuthSessionStorageAdapter) => {
  await storage.removeItem(AUTH_STORAGE_KEY);
};
