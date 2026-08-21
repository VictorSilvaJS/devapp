import type { ParsedAccountActionLink } from './contracts';

export type HttpActionRouteName =
  | 'AcceptInvitation'
  | 'CompletePasswordRecovery'
  | 'ConfirmCurrentPrimaryEmail'
  | 'ConfirmNewPrimaryEmail'
  | 'ConfirmSecondaryEmail'
  | 'ConfirmAdminSecondaryRecovery'
  | 'ConfirmAdminRecoveryNewPrimary'
  | 'ConfirmAssistedRecovery';

export function actionNavigationTarget(
  link: ParsedAccountActionLink,
): { readonly name: HttpActionRouteName } {
  switch (link.action) {
    case 'accept-invitation':
    case 'accept-initial-admin-invitation':
      return { name: 'AcceptInvitation' };
    case 'complete-password-recovery':
      return { name: 'CompletePasswordRecovery' };
    case 'confirm-current-primary-email':
      return { name: 'ConfirmCurrentPrimaryEmail' };
    case 'confirm-new-primary-email':
      return { name: 'ConfirmNewPrimaryEmail' };
    case 'verify-secondary-email':
      return { name: 'ConfirmSecondaryEmail' };
    case 'confirm-admin-secondary-recovery':
      return { name: 'ConfirmAdminSecondaryRecovery' };
    case 'confirm-admin-recovery-new-primary':
      return { name: 'ConfirmAdminRecoveryNewPrimary' };
    case 'confirm-assisted-recovery-email':
      return { name: 'ConfirmAssistedRecovery' };
  }
}
