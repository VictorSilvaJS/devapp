export type AccountActionErrorCode =
  | 'account_not_found'
  | 'account_not_pending'
  | 'account_not_active'
  | 'account_action_forbidden'
  | 'email_unavailable'
  | 'email_change_invalid'
  | 'email_verification_invalid'
  | 'recent_authentication_required'
  | 'invitation_invalid'
  | 'recovery_invalid'
  | 'restricted_authorization_invalid'
  | 'admin_assisted_recovery_forbidden'
  | 'bootstrap_disabled'
  | 'bootstrap_already_initialized'
  | 'bootstrap_not_correctable'
  | 'break_glass_authorization_invalid'
  | 'concurrent_account_change';

const PUBLIC_MESSAGES: Readonly<Record<AccountActionErrorCode, string>> = {
  account_not_found: 'Conta não encontrada.',
  account_not_pending: 'A conta não está disponível para convite.',
  account_not_active: 'A conta não está disponível para esta operação.',
  account_action_forbidden: 'A conta não pode executar esta operação.',
  email_unavailable: 'O endereço de e-mail não está disponível.',
  email_change_invalid: 'A alteração de e-mail é inválida ou expirou.',
  email_verification_invalid: 'A verificação de e-mail é inválida ou expirou.',
  recent_authentication_required: 'Esta ação exige autenticação recente.',
  invitation_invalid: 'O convite é inválido ou expirou.',
  recovery_invalid: 'A recuperação é inválida ou expirou.',
  restricted_authorization_invalid:
    'A autorização restrita é inválida ou expirou.',
  admin_assisted_recovery_forbidden:
    'Contas administrativas exigem o procedimento break-glass.',
  bootstrap_disabled: 'O bootstrap inicial está desabilitado.',
  bootstrap_already_initialized: 'O bootstrap inicial já foi utilizado.',
  bootstrap_not_correctable:
    'O convite inicial não está disponível para correção.',
  break_glass_authorization_invalid:
    'A autorização break-glass não atende à política.',
  concurrent_account_change: 'A conta foi alterada durante a operação.',
};

export class AccountActionError extends Error {
  readonly code: AccountActionErrorCode;

  constructor(code: AccountActionErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.name = 'AccountActionError';
    this.code = code;
  }
}
