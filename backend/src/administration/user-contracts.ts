import type { AuthenticatedPrincipal, UserProfile, UserStatus } from '../auth/contracts.js';
import type {
  AdministrativeCommandType,
  AdministrativeReason,
  AdministrativeSafeReceipt,
} from './contracts.js';

export interface AdministrativeUserView {
  readonly id: string;
  readonly organizationId: string;
  readonly producerId: string | null;
  readonly name: string;
  /** Chave de ordenação produzida pelo PostgreSQL; nunca é serializada na API. */
  readonly sortKey: string;
  readonly email: string;
  readonly profile: UserProfile;
  readonly status: UserStatus;
  readonly phone: string | null;
  readonly document: string | null;
  readonly notes: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdministrativeUserCursor {
  readonly sortKey: string;
  readonly id: string;
}

export interface AdministrativeUserListInput {
  readonly principal: AuthenticatedPrincipal;
  readonly organizationId: string;
  readonly limit: number;
  readonly profile?: UserProfile;
  readonly status?: UserStatus;
  readonly search?: string;
  readonly cursor?: AdministrativeUserCursor;
}

export interface AdministrativeCommandIdentity {
  readonly organizationId: 'org_tche_fertilidade';
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKeyHash: Buffer;
  readonly requestHash: Buffer;
  readonly command: Extract<
    AdministrativeCommandType,
    | 'usuario.criar'
    | 'usuario.atualizar'
    | 'usuario.alterar_status'
    | 'usuario.emitir_convite'
  >;
}

export type AdministrativeCommandResult =
  | Readonly<{
      status: 'completed' | 'replayed';
      httpStatus: 200 | 201;
      receipt: AdministrativeSafeReceipt;
    }>
  | Readonly<{
      status:
        | 'invalid_session'
        | 'forbidden'
        | 'not_found'
        | 'version_conflict'
        | 'idempotency_conflict'
        | 'duplicate_email'
        | 'invalid_transition'
        | 'pending_status_transition'
        | 'email_change_forbidden'
        | 'active_holder_conflict'
        | 'self_deactivation'
        | 'last_admin_conflict'
        | 'credential_required'
        | 'not_pending'
        | 'no_change';
    }>;

export interface CreateAdministrativeUserInput {
  readonly principal: AuthenticatedPrincipal;
  readonly identity: AdministrativeCommandIdentity & {
    readonly command: 'usuario.criar';
  };
  readonly userId: string;
  readonly producerId?: string;
  readonly name: string;
  readonly email: string;
  readonly profile: UserProfile;
  readonly phone?: string;
  readonly document?: string;
  readonly notes?: string;
}

export interface UpdateAdministrativeUserInput {
  readonly principal: AuthenticatedPrincipal;
  readonly identity: AdministrativeCommandIdentity & {
    readonly command: 'usuario.atualizar';
  };
  readonly userId: string;
  readonly expectedVersion: number;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string | null;
  readonly document?: string | null;
  readonly notes?: string | null;
}

export interface ChangeAdministrativeUserStatusInput {
  readonly principal: AuthenticatedPrincipal;
  readonly identity: AdministrativeCommandIdentity & {
    readonly command: 'usuario.alterar_status';
  };
  readonly userId: string;
  readonly expectedVersion: number;
  readonly status: Extract<UserStatus, 'ativo' | 'inativo'>;
  readonly reason: AdministrativeReason;
}

export interface IssueAdministrativeInvitationInput {
  readonly principal: AuthenticatedPrincipal;
  readonly identity: AdministrativeCommandIdentity & {
    readonly command: 'usuario.emitir_convite';
  };
  readonly userId: string;
}

export interface AdministrativeUserRepository {
  list(input: AdministrativeUserListInput): Promise<readonly AdministrativeUserView[]>;
  findById(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AdministrativeUserView | null>;
  create(input: CreateAdministrativeUserInput): Promise<AdministrativeCommandResult>;
  update(input: UpdateAdministrativeUserInput): Promise<AdministrativeCommandResult>;
  changeStatus(
    input: ChangeAdministrativeUserStatusInput,
  ): Promise<AdministrativeCommandResult>;
  issueInvitation(
    input: IssueAdministrativeInvitationInput,
  ): Promise<AdministrativeCommandResult>;
}
