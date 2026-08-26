import type { EncryptedOutboxMessageDraft } from '../outbox/contracts.js';

export type AccountProfile = 'admin' | 'colaborador' | 'produtor';
export type AccountStatus = 'pendente' | 'ativo' | 'inativo';
export type InvitationAcceptanceMode =
  | 'keep_status'
  | 'activate_user'
  | 'activate_bootstrap_admin';
export type PersistedInvitationActivationMode =
  | 'manter_status'
  | 'ativar_usuario'
  | 'ativar_admin_bootstrap';

export function invitationAcceptanceModeFromPersisted(
  value: unknown,
): InvitationAcceptanceMode {
  switch (value) {
    case 'manter_status':
      return 'keep_status';
    case 'ativar_usuario':
      return 'activate_user';
    case 'ativar_admin_bootstrap':
      return 'activate_bootstrap_admin';
    default:
      throw new TypeError('Unknown persisted invitation activation mode.');
  }
}

export interface AccountSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly normalizedEmail: string;
  readonly profile: AccountProfile;
  readonly status: AccountStatus;
  /** Opaque compare-and-set value supplied by the persistence adapter. */
  readonly version: string;
}

export interface AuditEventDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly eventType: string;
  readonly result: 'success' | 'denied' | 'failure';
  readonly occurredAt: Date;
  readonly actorUserId?: string;
  readonly actorSessionId?: string;
  readonly affectedUserId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly reasonCode?: string;
  readonly externalCaseReference?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ActionChallengeDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly purpose:
    | 'invitation'
    | 'primary_email_change_current'
    | 'primary_email_change_new'
    | 'secondary_email_verification'
    | 'assisted_recovery_email'
    | 'admin_secondary_recovery_secondary'
    | 'admin_secondary_recovery_new_primary'
    | 'admin_break_glass_email';
  readonly tokenSha256: string;
  readonly expiresAt: Date;
  readonly pendingNormalizedEmail?: string;
  readonly recoveryId?: string;
  readonly activationMode?: InvitationAcceptanceMode;
}

export interface RestrictedAuthorizationDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly recoveryId: string;
  readonly purpose:
    | 'assisted_recovery'
    | 'admin_secondary_recovery'
    | 'admin_break_glass';
  readonly tokenSha256: string;
  readonly allowedActions: readonly ['set_new_password', 'cancel_recovery'];
  readonly expiresAt: Date;
}

export interface AtomicAccountActionWrite {
  readonly outbox: EncryptedOutboxMessageDraft;
  readonly auditEvents: readonly AuditEventDraft[];
}

export type Clock = () => Date;
export type IdGenerator = () => string;

export function addMilliseconds(value: Date, milliseconds: number): Date {
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new RangeError('Duration must be a positive safe integer.');
  }

  return new Date(value.getTime() + milliseconds);
}

export function requireOpaqueCaseReference(value: string): string {
  if (!/^[A-Za-z0-9._:/-]{1,128}$/.test(value)) {
    throw new TypeError('External case reference must be an opaque identifier.');
  }
  return value;
}
