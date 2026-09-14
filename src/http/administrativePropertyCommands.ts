import { ApiResponseError, type BackendApi } from './backendApi';
import type { AdministrativeCommandCoordinator } from './administrativeCommandCoordinator';
import { AdministrativePropertyCommandLifecycle, type AdministrativePropertyIntent } from './administrativePropertyCommandLifecycle';
import type { AdministrativePropertyDataBoundary, AdministrativePropertyReadLease } from './administrativePropertyDataBoundary';
import {
  buildCreateAdministrativePropertyPayload, buildPatchAdministrativePropertyPayload,
  buildChangeAdministrativePropertyStatusPayload, createAdministrativePropertyEditModel,
  rebaseAdministrativePropertyEditModel, type AdministrativePropertyEditModel,
} from './administrativePropertyModels';
import {
  assertAdministrativePropertyAccess, handleAdministrativePropertyAccessFailure,
  HttpAdministrativePropertyRepository,
} from './administrativePropertyRepository';
import type { AdministrativePropertyProjection, AdministrativePropertyReceipt } from './contracts';
import type { SessionCoordinator } from './sessionCoordinator';
import { decodeAdministrativePropertyReceipt } from './decoders';

export class AdministrativePropertyConflictError extends Error {
  constructor(readonly original: ApiResponseError,
    readonly property?: AdministrativePropertyProjection,
    readonly editModel?: AdministrativePropertyEditModel,
    readonly reloadError?: unknown) {
    super('O servidor exige revisão da intenção administrativa.');
    this.name = 'AdministrativePropertyConflictError';
  }
}

export class AdministrativePropertyCommandService {
  readonly #api: BackendApi;
  readonly #session: SessionCoordinator;
  readonly #coordinator: AdministrativeCommandCoordinator;
  readonly #boundary: AdministrativePropertyDataBoundary;
  readonly #repository: HttpAdministrativePropertyRepository;
  readonly #captureAuthorizationEffects: () => () => void;
  constructor(input: Readonly<{
    api: BackendApi; session: SessionCoordinator; coordinator: AdministrativeCommandCoordinator;
    boundary: AdministrativePropertyDataBoundary; repository: HttpAdministrativePropertyRepository;
    captureAuthorizationEffects?: () => () => void;
  }>) {
    this.#api = input.api; this.#session = input.session; this.#coordinator = input.coordinator;
    this.#boundary = input.boundary; this.#repository = input.repository;
    this.#captureAuthorizationEffects = input.captureAuthorizationEffects ?? (() => () => {});
  }
  create(draft: unknown): AdministrativePropertyCommandLifecycle {
    return this.#flow({ action: 'create', method: 'POST', route: '/v1/propriedades',
      body: buildCreateAdministrativePropertyPayload(draft) });
  }
  update(model: AdministrativePropertyEditModel): AdministrativePropertyCommandLifecycle {
    const body = buildPatchAdministrativePropertyPayload(model);
    // Rebuild the baseline/draft snapshot so later caller mutation cannot change a conflict rebase.
    const editModel = rebaseAdministrativePropertyEditModel(model,
      createAdministrativePropertyEditModel(model.baseline).baseline);
    const id = editModel.baseline.id;
    return this.#flow({ action: 'edit', method: 'PATCH', route: `/v1/propriedades/${id}`,
      propertyId: id, body, editModel });
  }
  changeStatus(authoritative: AdministrativePropertyProjection, draft: unknown): AdministrativePropertyCommandLifecycle {
    const property = createAdministrativePropertyEditModel(authoritative).baseline;
    return this.#flow({ action: 'status', method: 'PATCH', route: `/v1/propriedades/${property.id}/status`,
      propertyId: property.id, body: buildChangeAdministrativePropertyStatusPayload(property, draft) });
  }
  #flow(intent: Omit<AdministrativePropertyIntent, 'intentId'>): AdministrativePropertyCommandLifecycle {
    const lease = this.#boundary.issueLease();
    try { assertAdministrativePropertyAccess(this.#session, this.#boundary, lease); }
    finally { this.#boundary.revokeLease(lease); }
    return new AdministrativePropertyCommandLifecycle({ intent, boundary: this.#boundary, driver: {
      mutate: (command, commandLease) => this.#mutate(command, commandLease),
      reconcile: (receipt, readLease) => this.#repository.readAuthoritative(receipt.recurso_id, readLease, receipt.versao),
      discard: (id) => { this.#coordinator.invalidateIntent(id); },
    } });
  }
  async #mutate(intent: AdministrativePropertyIntent, lease: AdministrativePropertyReadLease): Promise<AdministrativePropertyReceipt> {
    const invalidateAffectedProjections = intent.action === 'edit' ? () => {} : this.#captureAuthorizationEffects();
    try {
      // Only the mutation is inside authenticated/coordinator execution. A GET 401 must never replay it.
      const receipt = await this.#coordinator.execute(intent, async (token, command) => {
        assertAdministrativePropertyAccess(this.#session, this.#boundary, lease);
        const value = intent.action === 'create'
          ? await this.#api.createAdministrativeProperty(token, command.idempotencyKey, command.body)
          : intent.action === 'edit'
            ? await this.#api.updateAdministrativeProperty(token, intent.propertyId!, command.idempotencyKey, command.body)
            : await this.#api.changeAdministrativePropertyStatus(token, intent.propertyId!, command.idempotencyKey, command.body);
        return decodeAdministrativePropertyReceipt(value,
          intent.action === 'create' ? 'criado' : intent.action === 'edit' ? 'atualizado' : 'status_alterado', intent.propertyId);
      });
      if (this.#boundary.isAuthorizationCurrent(lease) && this.#boundary.current.authorized) invalidateAffectedProjections();
      return receipt;
    } catch (error) {
      handleAdministrativePropertyAccessFailure(error, this.#session, this.#boundary, lease);
      if (error instanceof ApiResponseError && error.status === 409 && intent.propertyId &&
        (error.code === 'version_conflict' || error.code === 'business_rule_conflict')) {
        let property: AdministrativePropertyProjection;
        try {
          const minimumVersion = Math.max(typeof intent.body.versao === 'number' ? intent.body.versao : 1,
            error.details?.find((detail) => detail.current_version !== undefined)?.current_version ?? 1);
          property = await this.#repository.readAuthoritative(intent.propertyId, lease, minimumVersion);
          const model = intent.editModel ? rebaseAdministrativePropertyEditModel(intent.editModel, property) : undefined;
          if (!this.#boundary.publishDetail(lease, property, true)) throw new Error('Leitura de conflito obsoleta.');
          throw new AdministrativePropertyConflictError(error, property, model);
        } catch (reloadError) {
          if (reloadError instanceof AdministrativePropertyConflictError) throw reloadError;
          throw new AdministrativePropertyConflictError(error, undefined, undefined, reloadError);
        }
      }
      throw error;
    }
  }
}
