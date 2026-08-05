import { MockLocalData, User } from '../api/mock';
import { authLogin } from './authMock';
import { LocalCredentialService, normalizeEmail } from './localCredentials';
import { sanitizeAuthUserForSession } from './authSession';
import {
  AUTH_INACTIVE_ACCESS_MESSAGE,
  AUTH_PENDING_ACCESS_MESSAGE,
  AUTH_UNKNOWN_STATUS_MESSAGE,
  assertUsuarioPodeEntrar,
} from './authStatus';

export const AUTH_INVALID_CREDENTIALS_MESSAGE = 'Email ou senha incorretos';
export const AUTH_LOCAL_USER_NOT_FOUND_MESSAGE = 'Não foi possível localizar o cadastro deste usuário.';

export interface ManualAuthCredentialService {
  findCredentialByEmail: (email: string) => Promise<{ usuario_id: string } | null>;
  verifyCredential: (email: string, senha: string) => Promise<{ ok: boolean; usuario_id?: string }>;
}

export interface ManualAuthUserApi {
  get: (usuarioId: string) => Promise<any>;
}

export interface ManualAuthDeps {
  credentialService?: ManualAuthCredentialService;
  userApi?: ManualAuthUserApi;
  fallbackLogin?: (email: string, senha: string) => Promise<any>;
  allowLegacyFallback?: () => Promise<boolean>;
}

const invalidCredentials = () => new Error(AUTH_INVALID_CREDENTIALS_MESSAGE);

const isAuthStatusError = (error: any) =>
  [
    AUTH_PENDING_ACCESS_MESSAGE,
    AUTH_INACTIVE_ACCESS_MESSAGE,
    AUTH_UNKNOWN_STATUS_MESSAGE,
  ].includes(String(error?.message || ''));

export const authenticateWithEmailAndPassword = async (
  email: string,
  senha: string,
  {
    credentialService = LocalCredentialService,
    userApi = User,
    fallbackLogin = authLogin,
    allowLegacyFallback = async () => (await MockLocalData.readStorageVersion()) === 1,
  }: ManualAuthDeps = {}
) => {
  const emailNormalizado = normalizeEmail(email);
  if (!emailNormalizado || !senha) {
    throw invalidCredentials();
  }

  const localCredential = await credentialService.findCredentialByEmail(emailNormalizado);

  if (localCredential) {
    const verification = await credentialService.verifyCredential(emailNormalizado, senha);
    if (!verification.ok || !verification.usuario_id) {
      throw invalidCredentials();
    }

    try {
      const persistedUser = await userApi.get(verification.usuario_id);
      const sanitizedUser = sanitizeAuthUserForSession(persistedUser);
      assertUsuarioPodeEntrar(sanitizedUser);
      return sanitizedUser;
    } catch (error) {
      if (isAuthStatusError(error)) {
        throw error;
      }

      const controlledError = new Error(AUTH_LOCAL_USER_NOT_FOUND_MESSAGE);
      (controlledError as any).cause = error;
      throw controlledError;
    }
  }

  if (!(await allowLegacyFallback())) {
    throw invalidCredentials();
  }

  const fallbackUser = await fallbackLogin(emailNormalizado, senha);
  const sanitizedFallbackUser = sanitizeAuthUserForSession(fallbackUser);
  assertUsuarioPodeEntrar(sanitizedFallbackUser);
  return sanitizedFallbackUser;
};
