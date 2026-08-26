import type { UserProfile, UserStatus } from '../auth/contracts.js';
export type {
  PersistedInvitationActivationMode as InvitationActivationMode,
} from '../account-actions/contracts.js';
import type {
  PropertyAccessType,
  PropertyStatus,
} from '../properties/contracts.js';

export type { PropertyStatus } from '../properties/contracts.js';

export const ADMINISTRATION_LIMITS = Object.freeze({
  userName: 200,
  propertyName: 200,
  email: 254,
  phone: 32,
  document: 64,
  notes: 2_000,
  mainCrop: 120,
  reasonDetail: 300,
  linkIdsPerDelta: 100,
} as const);

export const ADMINISTRATIVE_REASON_CODES = Object.freeze([
  'fim_relacao',
  'mudanca_responsabilidade',
  'cadastro_duplicado',
  'correcao_administrativa',
  'suspensao_operacional',
  'outro',
] as const);

export type AdministrativeReasonCode =
  (typeof ADMINISTRATIVE_REASON_CODES)[number];

type StandardAdministrativeReasonCode = Exclude<
  AdministrativeReasonCode,
  'outro'
>;

export type AdministrativeReason =
  | Readonly<{ code: 'outro'; detail: string }>
  | Readonly<{ code: StandardAdministrativeReasonCode; detail?: string }>;

export const ADMINISTRATIVE_COMMAND_TYPES = Object.freeze([
  'usuario.criar',
  'usuario.atualizar',
  'usuario.alterar_status',
  'usuario.alterar_vinculos',
  'usuario.emitir_convite',
  'propriedade.criar',
  'propriedade.atualizar',
  'propriedade.alterar_status',
] as const);

export type AdministrativeCommandType =
  (typeof ADMINISTRATIVE_COMMAND_TYPES)[number];

export type AdministrativeCommandState = 'processando' | 'concluido';
export type ProducerStatus = 'ativo' | 'inativo';
export type AdditionalPropertyAccessType = Extract<
  PropertyAccessType,
  'usuario_autorizado' | 'colaborador'
>;

export interface AdministrativeCommandContext {
  readonly organizationId: 'org_tche_fertilidade';
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion?: number;
}

export interface CreateAdministrativeUserCommand {
  readonly context: AdministrativeCommandContext;
  readonly name: string;
  readonly email: string;
  readonly profile: UserProfile;
  readonly phone?: string;
  readonly document?: string;
  readonly notes?: string;
}

export interface UpdateAdministrativeUserCommand {
  readonly context: AdministrativeCommandContext & {
    readonly expectedVersion: number;
  };
  readonly userId: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string | null;
  readonly document?: string | null;
  readonly notes?: string | null;
}

export interface ChangeAdministrativeUserStatusCommand {
  readonly context: AdministrativeCommandContext & {
    readonly expectedVersion: number;
  };
  readonly userId: string;
  readonly status: Extract<UserStatus, 'ativo' | 'inativo'>;
  readonly reason: AdministrativeReason;
}

export interface IssueAdministrativeInvitationCommand {
  readonly context: AdministrativeCommandContext;
  readonly userId: string;
  readonly activationMode: 'ativar_usuario';
}

export interface PropertyLinkDeltaItem {
  readonly propertyId: string;
  readonly accessType: AdditionalPropertyAccessType;
}

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

interface PropertyLinkDeltaCommandBase {
  readonly context: AdministrativeCommandContext & {
    readonly expectedVersion: number;
  };
  readonly userId: string;
}

export type ApplyPropertyLinkDeltaCommand =
  | (PropertyLinkDeltaCommandBase & {
      readonly add: NonEmptyReadonlyArray<PropertyLinkDeltaItem>;
      readonly remove: readonly [];
      readonly reason?: AdministrativeReason;
    })
  | (PropertyLinkDeltaCommandBase & {
      readonly add: readonly [];
      readonly remove: NonEmptyReadonlyArray<PropertyLinkDeltaItem>;
      readonly reason: AdministrativeReason;
    })
  | (PropertyLinkDeltaCommandBase & {
      readonly add: NonEmptyReadonlyArray<PropertyLinkDeltaItem>;
      readonly remove: NonEmptyReadonlyArray<PropertyLinkDeltaItem>;
      readonly reason: AdministrativeReason;
    });

export interface CreateAdministrativePropertyCommand {
  readonly context: AdministrativeCommandContext;
  readonly name: string;
  readonly holderId: string;
  readonly municipalityId: string;
  readonly totalArea?: number;
  readonly mainCrop?: string;
  readonly status: PropertyStatus;
}

export interface UpdateAdministrativePropertyCommand {
  readonly context: AdministrativeCommandContext & {
    readonly expectedVersion: number;
  };
  readonly propertyId: string;
  readonly name?: string;
  readonly municipalityId?: string;
  readonly totalArea?: number | null;
  readonly mainCrop?: string | null;
}

export interface ChangeAdministrativePropertyStatusCommand {
  readonly context: AdministrativeCommandContext & {
    readonly expectedVersion: number;
  };
  readonly propertyId: string;
  readonly status: PropertyStatus;
  readonly reason: AdministrativeReason;
}

export type AdministrativeReceiptOutcome =
  | 'criado'
  | 'atualizado'
  | 'status_alterado'
  | 'vinculos_alterados'
  | 'convite_emitido';

export type AdministrativeSafeReceipt =
  | Readonly<{
      outcome: 'criado' | 'atualizado' | 'status_alterado';
      resourceType: 'usuario' | 'propriedade';
      resourceId: string;
      version: number;
    }>
  | Readonly<{
      outcome: 'vinculos_alterados';
      resourceType: 'vinculo';
      resourceId: string;
      version: number;
    }>
  | Readonly<{
      outcome: 'convite_emitido';
      resourceType: 'convite';
      resourceId: string;
      version?: never;
    }>;

interface AdministrativeIdempotencyReceiptBase {
  readonly command: AdministrativeCommandType;
  readonly sessionId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

type CompletedAdministrativeIdempotencyReceipt<
  Command extends AdministrativeCommandType,
  HttpStatus extends number,
  Receipt extends AdministrativeSafeReceipt,
> = AdministrativeIdempotencyReceiptBase & {
  readonly command: Command;
  readonly state: 'concluido';
  readonly httpStatus: HttpStatus;
  readonly receipt: Receipt;
};

type VersionedReceipt<
  Outcome extends Exclude<AdministrativeReceiptOutcome, 'convite_emitido'>,
  Resource extends Exclude<
    AdministrativeSafeReceipt['resourceType'],
    'convite'
  >,
> = Readonly<{
  outcome: Outcome;
  resourceType: Resource;
  resourceId: string;
  version: number;
}>;

export type AdministrativeIdempotencyReceipt =
  | (AdministrativeIdempotencyReceiptBase & {
      readonly state: 'processando';
      readonly httpStatus?: never;
      readonly receipt?: never;
    })
  | CompletedAdministrativeIdempotencyReceipt<
      'usuario.criar',
      201,
      VersionedReceipt<'criado', 'usuario'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'usuario.atualizar',
      200,
      VersionedReceipt<'atualizado', 'usuario'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'usuario.alterar_status',
      200,
      VersionedReceipt<'status_alterado', 'usuario'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'usuario.alterar_vinculos',
      200,
      VersionedReceipt<'vinculos_alterados', 'vinculo'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'usuario.emitir_convite',
      201,
      Readonly<{
        outcome: 'convite_emitido';
        resourceType: 'convite';
        resourceId: string;
        version?: never;
      }>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'propriedade.criar',
      201,
      VersionedReceipt<'criado', 'propriedade'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'propriedade.atualizar',
      200,
      VersionedReceipt<'atualizado', 'propriedade'>
    >
  | CompletedAdministrativeIdempotencyReceipt<
      'propriedade.alterar_status',
      200,
      VersionedReceipt<'status_alterado', 'propriedade'>
    >;

export interface IbgeLocalityVersion {
  readonly id: string;
  readonly sourceUrl: string;
  readonly sha256: string;
  readonly capturedOn: string;
  readonly stateCount: number;
  readonly municipalityCount: number;
}

export function administrativeReasonRequiresDetail(
  code: AdministrativeReasonCode,
): boolean {
  return code === 'outro';
}
