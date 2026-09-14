import { ApiResponseError, type BackendApi } from './backendApi';
import type { AdministrativePropertyDataBoundary, AdministrativePropertyReadLease } from './administrativePropertyDataBoundary';
import type { AdministrativePropertyPage, AdministrativePropertyProjection, PropertyFilters } from './contracts';
import { InvalidBackendResponseError } from './decoders';
import { SessionRequiredError, type SessionCoordinator } from './sessionCoordinator';

export class AdministrativePropertyContextStaleError extends Error {
  constructor() { super('O contexto administrativo da Propriedade não está mais autorizado.');
    this.name = 'AdministrativePropertyContextStaleError'; }
}

export interface AdministrativePropertyRepository {
  list(filters?: PropertyFilters): Promise<AdministrativePropertyPage>;
  getById(id: string): Promise<AdministrativePropertyProjection>;
}

export function assertAdministrativePropertyAccess(session: SessionCoordinator,
  boundary: AdministrativePropertyDataBoundary, lease: AdministrativePropertyReadLease): void {
  if (!boundary.isLeaseCurrent(lease) || !boundary.current.authorized ||
    session.snapshot?.usuario.perfil !== 'admin' || session.snapshot.usuario.status !== 'ativo') {
    throw new AdministrativePropertyContextStaleError();
  }
}

export function handleAdministrativePropertyAccessFailure(error: unknown, session: SessionCoordinator,
  boundary: AdministrativePropertyDataBoundary, lease: AdministrativePropertyReadLease): void {
  if (error instanceof SessionRequiredError || (error instanceof ApiResponseError && error.status === 401)) {
    boundary.invalidateAccess(lease, 'invalid_session');
  } else if (error instanceof ApiResponseError && error.status === 403 && boundary.invalidateAccess(lease, 'forbidden')) {
    void session.revalidate().catch(() => { /* The existing session coordinator orders and publishes /me. */ });
  }
}

export class HttpAdministrativePropertyRepository implements AdministrativePropertyRepository {
  readonly #reads = new Map<string, AdministrativePropertyReadLease>();
  constructor(readonly api: BackendApi, readonly session: SessionCoordinator,
    readonly boundary: AdministrativePropertyDataBoundary) {}

  async readAuthoritative(id: string, lease: AdministrativePropertyReadLease,
    minimumVersion = 1): Promise<AdministrativePropertyProjection> {
    return this.#read(lease, async (token) => {
      const property = await this.api.getAdministrativeProperty(token, id);
      if (property.id !== id || property.versao < minimumVersion || property.tipo_acesso !== 'admin' ||
        property.organizacao_id !== this.session.snapshot?.usuario.organizacao_id) throw new InvalidBackendResponseError();
      return property;
    });
  }
  async getById(id: string): Promise<AdministrativePropertyProjection> {
    const key = `detail:${id}`;
    const lease = this.#beginRead(key);
    try {
      const property = await this.readAuthoritative(id, lease);
      if (!this.boundary.publishDetail(lease, property)) throw new AdministrativePropertyContextStaleError();
      return this.boundary.current.details[id];
    } finally { this.#endRead(key, lease); }
  }
  async list(filters: PropertyFilters = {}): Promise<AdministrativePropertyPage> {
    const query = Object.freeze({ ...filters });
    const key = `list:${JSON.stringify(Object.keys(query).sort().map((field) => [field, query[field as keyof PropertyFilters]]))}`;
    const lease = this.#beginRead(key);
    try {
      assertAdministrativePropertyAccess(this.session, this.boundary, lease);
      this.boundary.rememberList(query);
      const page = await this.#read(lease, (token) => this.api.listAdministrativeProperties(token, query));
      if (page.itens.some((property) => property.tipo_acesso !== 'admin' ||
        property.organizacao_id !== this.session.snapshot?.usuario.organizacao_id)) throw new InvalidBackendResponseError();
      if (!this.boundary.publishList(lease, query, page)) throw new AdministrativePropertyContextStaleError();
      return this.boundary.current.lists.at(-1)!.page!;
    } finally { this.#endRead(key, lease); }
  }
  #beginRead(key: string): AdministrativePropertyReadLease {
    const old = this.#reads.get(key);
    if (old) this.boundary.revokeLease(old);
    const lease = this.boundary.issueLease();
    this.#reads.set(key, lease);
    return lease;
  }
  #endRead(key: string, lease: AdministrativePropertyReadLease): void {
    this.boundary.revokeLease(lease);
    if (this.#reads.get(key) === lease) this.#reads.delete(key);
  }
  async #read<T>(lease: AdministrativePropertyReadLease, operation: (token: string) => Promise<T>): Promise<T> {
    assertAdministrativePropertyAccess(this.session, this.boundary, lease);
    try {
      const result = await this.session.authenticated((token) => {
        assertAdministrativePropertyAccess(this.session, this.boundary, lease);
        return operation(token);
      });
      assertAdministrativePropertyAccess(this.session, this.boundary, lease);
      return result;
    } catch (error) {
      handleAdministrativePropertyAccessFailure(error, this.session, this.boundary, lease);
      throw error;
    }
  }
}
