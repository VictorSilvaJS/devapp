import {
  ApiResponseError,
  InvalidApiRequestError,
  type BackendApi,
} from './backendApi';
import {
  AdministrativeUserAccessDeniedError,
  administrativeUserSessionPartition,
} from './administrativeUserAccess';
import {
  type AdministrativeUserDataBoundary,
  type AdministrativeUserReadLease,
} from './administrativeUserDataBoundary';
import type {
  AdministrativeUserDetail,
  AdministrativeUserFilters,
  AdministrativeUserPage,
} from './contracts';
import { isCanonicalUuidV4 } from './decoders';
import {
  SessionRequiredError,
  type AuthenticatedSessionContext,
  type SessionCoordinator,
} from './sessionCoordinator';

export interface AdministrativeUserRepository {
  list(
    filters?: AdministrativeUserFilters,
    lease?: AdministrativeUserReadLease,
  ): Promise<AdministrativeUserPage>;
  getById(
    id: string,
    lease?: AdministrativeUserReadLease,
  ): Promise<AdministrativeUserDetail>;
}

export { AdministrativeUserAccessDeniedError } from './administrativeUserAccess';

export class AdministrativeUserContextStaleError extends Error {
  constructor() {
    super('O contexto administrativo mudou antes da leitura.');
    this.name = 'AdministrativeUserContextStaleError';
  }
}

export class HttpAdministrativeUserRepository
implements AdministrativeUserRepository {
  readonly #api: BackendApi;
  readonly #session: SessionCoordinator;
  readonly #boundary: AdministrativeUserDataBoundary;

  constructor(
    api: BackendApi,
    session: SessionCoordinator,
    boundary: AdministrativeUserDataBoundary,
  ) {
    this.#api = api;
    this.#session = session;
    this.#boundary = boundary;
  }

  #assertAdministrativeAccess(lease: AdministrativeUserReadLease): void {
    if (!this.#boundary.isLeaseCurrent(lease)) {
      throw new AdministrativeUserContextStaleError();
    }
    const snapshot = this.#session.snapshot;
    if (snapshot !== null && snapshot.usuario.perfil !== 'admin') {
      this.#boundary.invalidateAccess(lease, 'forbidden');
      throw new AdministrativeUserAccessDeniedError();
    }
  }

  #assertAuthoritativeAdministrativeAccess(
    context: AuthenticatedSessionContext,
    lease: AdministrativeUserReadLease,
  ): AdministrativeUserReadLease {
    if (
      this.#session.epoch !== context.epoch ||
      this.#session.snapshot !== context.snapshot
    ) {
      throw new AdministrativeUserContextStaleError();
    }
    const partitionKey = administrativeUserSessionPartition(
      context.snapshot,
      context.epoch,
    );
    if (partitionKey === null) throw new AdministrativeUserContextStaleError();
    const effectiveLease = this.#boundary.resolveAfterInitialRestore(
      lease,
      partitionKey,
    );
    if (effectiveLease === null) {
      throw new AdministrativeUserContextStaleError();
    }
    if (context.snapshot.usuario.perfil !== 'admin') {
      this.#boundary.invalidateAccess(effectiveLease, 'forbidden');
      throw new AdministrativeUserAccessDeniedError();
    }
    return effectiveLease;
  }

  async #administrativeRead<T>(
    lease: AdministrativeUserReadLease,
    operation: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    this.#assertAdministrativeAccess(lease);
    let effectiveLease = lease;
    try {
      const result = await this.#session.authenticated((accessToken, context) => {
        effectiveLease = this.#assertAuthoritativeAdministrativeAccess(
          context,
          lease,
        );
        return operation(accessToken);
      });
      if (!this.#boundary.isLeaseCurrent(effectiveLease)) {
        throw new AdministrativeUserContextStaleError();
      }
      return result;
    } catch (error) {
      if (
        error instanceof SessionRequiredError ||
        (error instanceof ApiResponseError && error.status === 401)
      ) {
        this.#boundary.invalidateAccess(effectiveLease, 'invalid_session');
      } else if (
        error instanceof AdministrativeUserAccessDeniedError ||
        (error instanceof ApiResponseError && error.status === 403)
      ) {
        this.#boundary.invalidateAccess(effectiveLease, 'forbidden');
      }
      if (error instanceof ApiResponseError && error.status === 403) {
        void this.#session.revalidate().catch(() => {
          // A revalidação publica a identidade atual ou invalida a sessão.
        });
      }
      throw error;
    }
  }

  list(
    filters: AdministrativeUserFilters = {},
    lease = this.#boundary.issueLease({ allowInitialRestore: true }),
  ): Promise<AdministrativeUserPage> {
    return this.#administrativeRead(lease, (accessToken) => {
      return this.#api.listAdministrativeUsers(accessToken, filters);
    });
  }

  getById(
    id: string,
    lease?: AdministrativeUserReadLease,
  ): Promise<AdministrativeUserDetail> {
    if (!isCanonicalUuidV4(id)) {
      return Promise.reject(
        new InvalidApiRequestError('O ID do Usuário é inválido.'),
      );
    }
    const readLease = lease ??
      this.#boundary.issueLease({ allowInitialRestore: true });
    return this.#administrativeRead(readLease, (accessToken) => {
      return this.#api.getAdministrativeUser(accessToken, id);
    });
  }
}
