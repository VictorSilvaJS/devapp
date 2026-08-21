import type {
  PropertyFilters,
  PropertyPage,
  PropertyProjection,
} from './contracts';
import type { BackendApi } from './backendApi';
import type { SessionCoordinator } from './sessionCoordinator';

export interface PropertyRepository {
  list(filters?: PropertyFilters): Promise<PropertyPage>;
  getById(id: string): Promise<PropertyProjection>;
}

export class HttpPropertyRepository implements PropertyRepository {
  readonly #api: BackendApi;
  readonly #session: SessionCoordinator;

  constructor(api: BackendApi, session: SessionCoordinator) {
    this.#api = api;
    this.#session = session;
  }

  async list(filters: PropertyFilters = {}): Promise<PropertyPage> {
    return this.#session.authenticated((accessToken) => {
      return this.#api.listProperties(accessToken, filters);
    });
  }

  async getById(id: string): Promise<PropertyProjection> {
    return this.#session.authenticated((accessToken) => {
      return this.#api.getProperty(accessToken, id);
    });
  }
}
