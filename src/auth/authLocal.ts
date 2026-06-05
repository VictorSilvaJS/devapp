import { User } from '../api/mock';
import { authLogin } from './authMock';
import { LocalCredentialService, normalizeEmail } from './localCredentials';
import { sanitizeAuthUserForSession } from './authSession';

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
}

const invalidCredentials = () => new Error(AUTH_INVALID_CREDENTIALS_MESSAGE);

export const authenticateWithEmailAndPassword = async (
  email: string,
  senha: string,
  {
    credentialService = LocalCredentialService,
    userApi = User,
    fallbackLogin = authLogin,
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
      return sanitizeAuthUserForSession(persistedUser);
    } catch (error) {
      const controlledError = new Error(AUTH_LOCAL_USER_NOT_FOUND_MESSAGE);
      (controlledError as any).cause = error;
      throw controlledError;
    }
  }

  const fallbackUser = await fallbackLogin(emailNormalizado, senha);
  return sanitizeAuthUserForSession(fallbackUser);
};
