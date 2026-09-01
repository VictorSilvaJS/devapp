import type { AuthenticatedPrincipal } from '../auth/contracts.js';

export type PropertyStatus = 'ativa' | 'inativa';
export type PropertyAccessType =
  | 'admin'
  | 'titular'
  | 'usuario_autorizado'
  | 'colaborador';

export interface PropertyView {
  readonly id: string;
  readonly organizationId: string;
  readonly holderId: string;
  readonly holder: Readonly<{
    id: string;
    name: string;
  }>;
  readonly name: string;
  readonly municipalityId: string;
  readonly municipalityName: string;
  readonly stateId: string;
  readonly stateCode: string;
  readonly totalArea: number | null;
  readonly mainCrop: string | null;
  readonly status: PropertyStatus;
  readonly accessType: PropertyAccessType;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PropertyCursor {
  readonly name: string;
  readonly id: string;
}

export interface ListPropertiesInput {
  readonly principal: AuthenticatedPrincipal;
  readonly limit: number;
  readonly cursor?: PropertyCursor;
  readonly search?: string;
  readonly status?: PropertyStatus;
  readonly state?: string;
  readonly municipality?: string;
}

export interface PropertyRepository {
  list(input: ListPropertiesInput): Promise<readonly PropertyView[]>;
  findById(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly propertyId: string;
  }): Promise<PropertyView | null>;
}
