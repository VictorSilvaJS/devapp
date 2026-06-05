import { LocalCredentialMetadata, normalizeEmail } from '../auth/localCredentials';

export const MIN_SENHA_LOCAL_ADMIN = 6;

export interface SenhaLocalAdminValidation {
  valid: boolean;
  errors: {
    senha?: string;
    confirmarSenha?: string;
  };
}

export interface UsuarioAdminApi {
  create: (payload: any) => Promise<any>;
  update: (usuarioId: string, payload: any) => Promise<any>;
  delete: (usuarioId: string) => Promise<any>;
}

export interface UsuarioAdminCredentialService {
  findCredentialByUserId: (usuarioId: string) => Promise<LocalCredentialMetadata | null>;
  findCredentialByEmail: (email: string) => Promise<LocalCredentialMetadata | null>;
  hasCredential: (usuarioId: string) => Promise<boolean>;
  createCredential: (usuarioId: string, email: string, senha: string) => Promise<LocalCredentialMetadata>;
  updateCredential: (usuarioId: string, email: string, novaSenha: string) => Promise<LocalCredentialMetadata>;
  updateCredentialEmail: (usuarioId: string, email: string) => Promise<LocalCredentialMetadata>;
  removeCredential: (usuarioId: string) => Promise<boolean>;
}

export const validateSenhaLocalAdmin = ({
  senha,
  confirmarSenha,
  obrigatoria = false,
}: {
  senha?: string;
  confirmarSenha?: string;
  obrigatoria?: boolean;
}): SenhaLocalAdminValidation => {
  const senhaValue = typeof senha === 'string' ? senha : '';
  const confirmarValue = typeof confirmarSenha === 'string' ? confirmarSenha : '';
  const hasSenha = senhaValue.length > 0;
  const hasConfirmar = confirmarValue.length > 0;
  const shouldValidate = obrigatoria || hasSenha || hasConfirmar;
  const errors: SenhaLocalAdminValidation['errors'] = {};

  if (!shouldValidate) {
    return { valid: true, errors };
  }

  if (!hasSenha) {
    errors.senha = 'Informe a senha local.';
  } else if (senhaValue.trim().length === 0) {
    errors.senha = 'A senha não pode conter somente espaços.';
  } else if (senhaValue.length < MIN_SENHA_LOCAL_ADMIN) {
    errors.senha = `A senha deve ter pelo menos ${MIN_SENHA_LOCAL_ADMIN} caracteres.`;
  }

  if (!hasConfirmar) {
    errors.confirmarSenha = 'Confirme a senha local.';
  } else if (hasSenha && senhaValue !== confirmarValue) {
    errors.confirmarSenha = 'A confirmação deve ser igual à senha.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export const createUsuarioAdminWithLocalCredential = async ({
  userApi,
  credentialService,
  payload,
  email,
  senha,
}: {
  userApi: Pick<UsuarioAdminApi, 'create' | 'delete'>;
  credentialService: Pick<UsuarioAdminCredentialService, 'createCredential'>;
  payload: any;
  email: string;
  senha: string;
}) => {
  let saved: any = null;

  try {
    saved = await userApi.create(payload);
    await credentialService.createCredential(saved.id, email, senha);
    return saved;
  } catch (error) {
    if (saved?.id) {
      try {
        await userApi.delete(saved.id);
      } catch (rollbackError) {
        (error as any).rollbackFailed = true;
        (error as any).rollbackError = rollbackError;
      }
    }

    throw error;
  }
};

export const updateUsuarioAdminAndSyncLocalCredential = async ({
  userApi,
  credentialService,
  usuarioId,
  payload,
  email,
  novaSenha,
  shouldUpdatePassword,
}: {
  userApi: Pick<UsuarioAdminApi, 'update'>;
  credentialService: Pick<
    UsuarioAdminCredentialService,
    | 'findCredentialByUserId'
    | 'findCredentialByEmail'
    | 'createCredential'
    | 'updateCredential'
    | 'updateCredentialEmail'
  >;
  usuarioId: string;
  payload: any;
  email: string;
  novaSenha?: string;
  shouldUpdatePassword?: boolean;
}) => {
  const currentCredential = await credentialService.findCredentialByUserId(usuarioId);
  const emailNormalizado = normalizeEmail(email);
  const emailChangedInCredential =
    Boolean(currentCredential) && currentCredential?.email_normalizado !== emailNormalizado;
  const willTouchCredential = Boolean(shouldUpdatePassword) || emailChangedInCredential;

  if (willTouchCredential) {
    const credentialByEmail = await credentialService.findCredentialByEmail(email);
    if (credentialByEmail && credentialByEmail.usuario_id !== usuarioId) {
      throw new Error('LocalCredential.email: e-mail já possui credencial');
    }
  }

  const saved = await userApi.update(usuarioId, payload);

  if (shouldUpdatePassword) {
    if (currentCredential) {
      await credentialService.updateCredential(usuarioId, email, novaSenha || '');
    } else {
      await credentialService.createCredential(usuarioId, email, novaSenha || '');
    }
  } else if (emailChangedInCredential) {
    await credentialService.updateCredentialEmail(usuarioId, email);
  }

  return saved;
};

export const deleteUsuarioAdminAndLocalCredential = async ({
  userApi,
  credentialService,
  usuarioId,
}: {
  userApi: Pick<UsuarioAdminApi, 'delete'>;
  credentialService: Pick<UsuarioAdminCredentialService, 'removeCredential'>;
  usuarioId: string;
}) => {
  const result = await userApi.delete(usuarioId);
  await credentialService.removeCredential(usuarioId);
  return result;
};
