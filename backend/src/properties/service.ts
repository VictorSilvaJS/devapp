import type { AuthenticationService } from '../auth/service.js';
import { badRequest, notFound } from '../security/http-error.js';
import type {
  PropertyRepository,
  PropertyStatus,
  PropertyView,
} from './contracts.js';
import { decodePropertyCursor, encodePropertyCursor } from './cursor.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface PropertyListQuery {
  readonly busca?: string;
  readonly status?: PropertyStatus;
  readonly uf?: string;
  readonly municipio?: string;
  readonly limite?: number;
  readonly cursor?: string;
}

export interface PropertyPage {
  readonly items: readonly PropertyView[];
  readonly nextCursor: string | null;
}

export interface PropertyService {
  list(input: {
    readonly accessToken: string;
    readonly query: PropertyListQuery;
  }): Promise<PropertyPage>;
  detail(input: {
    readonly accessToken: string;
    readonly propertyId: string;
  }): Promise<PropertyView>;
}

function normalizedFilter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize('NFC').trim();
  if (normalized.length === 0) throw badRequest();
  return normalized;
}

export class DefaultPropertyService implements PropertyService {
  readonly #authentication: AuthenticationService;
  readonly #repository: PropertyRepository;

  public constructor(input: {
    readonly authentication: AuthenticationService;
    readonly repository: PropertyRepository;
  }) {
    this.#authentication = input.authentication;
    this.#repository = input.repository;
  }

  public async list(input: {
    readonly accessToken: string;
    readonly query: PropertyListQuery;
  }): Promise<PropertyPage> {
    const principal = await this.#authentication.authenticate(input.accessToken);
    const limit = input.query.limite ?? DEFAULT_LIMIT;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw badRequest();
    }
    const cursor =
      input.query.cursor === undefined
        ? undefined
        : decodePropertyCursor(input.query.cursor);
    const search = normalizedFilter(input.query.busca);
    const state = normalizedFilter(input.query.uf);
    const municipality = normalizedFilter(input.query.municipio);
    const rows = await this.#repository.list({
      principal,
      limit: limit + 1,
      ...(cursor === undefined ? {} : { cursor }),
      ...(input.query.status === undefined
        ? {}
        : { status: input.query.status }),
      ...(search === undefined ? {} : { search }),
      ...(state === undefined ? {} : { state }),
      ...(municipality === undefined ? {} : { municipality }),
    });
    const hasNextPage = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last !== undefined
          ? encodePropertyCursor({ name: last.name, id: last.id })
          : null,
    };
  }

  public async detail(input: {
    readonly accessToken: string;
    readonly propertyId: string;
  }): Promise<PropertyView> {
    const principal = await this.#authentication.authenticate(input.accessToken);
    const property = await this.#repository.findById({
      principal,
      propertyId: input.propertyId,
    });
    if (property === null) throw notFound();
    return property;
  }
}
