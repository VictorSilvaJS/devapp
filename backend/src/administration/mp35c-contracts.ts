import type { AuthenticatedPrincipal } from '../auth/contracts.js';
import type { PropertyStatus } from '../properties/contracts.js';
import type {
  AdditionalPropertyAccessType,
  AdministrativeAreaDecimal,
  AdministrativeCommandType,
  AdministrativeReason,
  AdministrativeSafeReceipt,
} from './contracts.js';

export interface Mp35cCommandIdentity {
  readonly sessionId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKeyHash: Buffer;
  readonly requestHash: Buffer;
  readonly command: Extract<
    AdministrativeCommandType,
    | 'propriedade.criar'
    | 'propriedade.atualizar'
    | 'propriedade.alterar_status'
    | 'usuario.alterar_vinculos'
  >;
}

export type Mp35cMutationResult =
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
        | 'business_rule_conflict'
        | 'invalid_municipality'
        | 'invalid_holder';
    }>;

export interface PropertyRelationView {
  readonly id: string;
  readonly propertyId: string;
  readonly propertyName: string;
  readonly propertyStatus: PropertyStatus;
  readonly accessOrigin: 'titularidade' | 'vinculo_direto';
  readonly linkType: 'titular' | AdditionalPropertyAccessType;
  readonly linkStatus: 'ativo' | 'inativo' | null;
  readonly editable: boolean;
  readonly linkVersion: number | null;
  readonly reasonCode: string | null;
  readonly reasonDetail: string | null;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
  readonly sortKey: string;
  readonly relationOrder: number;
}

export interface PropertyRelationCursor {
  readonly sortKey: string;
  readonly propertyId: string;
  readonly relationOrder: number;
  readonly relationId: string;
}

export interface StateView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface MunicipalityView {
  readonly id: string;
  readonly name: string;
  readonly stateId: string;
  readonly sortKey: string;
}

export interface MunicipalityCursor {
  readonly versionId: string;
  readonly sortKey: string;
  readonly id: string;
}

export interface Mp35cRepository {
  listUserProperties(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly userId: string;
    readonly search?: string;
    readonly accessType?: 'titular' | AdditionalPropertyAccessType;
    readonly linkStatus?: 'ativo' | 'inativo';
    readonly cursor?: PropertyRelationCursor;
    readonly limit: number;
  }): Promise<Readonly<{ userVersion: number; items: readonly PropertyRelationView[] }> | null>;
  listStates(input: {
    readonly principal: AuthenticatedPrincipal;
  }): Promise<Readonly<{ versionId: string; items: readonly StateView[] }>>;
  listMunicipalities(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly stateId: string;
    readonly search?: string;
    readonly versionId?: string;
    readonly cursor?: MunicipalityCursor;
    readonly limit: number;
  }): Promise<Readonly<{ versionId: string; items: readonly MunicipalityView[] }> | null>;
  createProperty(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly identity: Mp35cCommandIdentity & { readonly command: 'propriedade.criar' };
    readonly name: string;
    readonly holderId: string;
    readonly municipalityId: string;
    readonly totalArea?: AdministrativeAreaDecimal;
    readonly mainCrop?: string;
    readonly status: PropertyStatus;
  }): Promise<Mp35cMutationResult>;
  updateProperty(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly identity: Mp35cCommandIdentity & { readonly command: 'propriedade.atualizar' };
    readonly propertyId: string;
    readonly expectedVersion: number;
    readonly name?: string;
    readonly municipalityId?: string;
    readonly totalArea?: AdministrativeAreaDecimal | null;
    readonly mainCrop?: string | null;
  }): Promise<Mp35cMutationResult>;
  changePropertyStatus(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly identity: Mp35cCommandIdentity & { readonly command: 'propriedade.alterar_status' };
    readonly propertyId: string;
    readonly expectedVersion: number;
    readonly status: PropertyStatus;
    readonly reason: AdministrativeReason;
  }): Promise<Mp35cMutationResult>;
  applyUserPropertyDelta(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly identity: Mp35cCommandIdentity & { readonly command: 'usuario.alterar_vinculos' };
    readonly userId: string;
    readonly expectedVersion: number;
    readonly add: readonly string[];
    readonly remove: readonly string[];
    readonly reason: AdministrativeReason;
  }): Promise<Mp35cMutationResult>;
}
