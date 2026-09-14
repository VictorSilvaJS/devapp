import { ApiResponseError, InvalidApiRequestError } from './backendApi';
import type { AdministrativeUserDataBoundary, AdministrativeUserReadLease } from './administrativeUserDataBoundary';
import type { AdministrativeUserRepository } from './administrativeUserRepository';
import type { AdministrativeUserListItem, PropertyStatus, HttpUserStatus } from './contracts';
import { InvalidBackendResponseError, isCanonicalUuidV4 } from './decoders';
import type { SessionCoordinator } from './sessionCoordinator';
import {
  AdministrativeSelectionQuery, AdministrativeSelectionScope, selectionFailure, selectionSearch,
  type AdministrativeSelectionFailure,
} from './administrativeSelectionController';

export interface AdministrativeHolderCandidate {
  readonly usuario_id: string;
  readonly produtor_id: string;
  readonly nome: string;
  readonly email: string;
  readonly status: HttpUserStatus;
}
interface HolderQuery { readonly busca: string; readonly status: PropertyStatus; readonly limite: number }
type Verification = 'unconfirmed' | 'invalid' | 'validating' | 'confirmed' | 'error';
const INVALID_SELECTION: AdministrativeSelectionFailure = Object.freeze({
  kind: 'selection_invalid', retryable: false, restartRequired: false,
});
function eligible(status: HttpUserStatus, initialStatus: PropertyStatus): boolean {
  return status === 'ativo' || (initialStatus === 'inativa' && (status === 'pendente' || status === 'inativo'));
}
function candidate(user: AdministrativeUserListItem): AdministrativeHolderCandidate {
  if (user.perfil !== 'produtor' || !isCanonicalUuidV4(user.produtor_id)) throw new InvalidBackendResponseError();
  return Object.freeze({ usuario_id: user.id, produtor_id: user.produtor_id, nome: user.nome,
    email: user.email, status: user.status });
}
function propertyStatus(value: PropertyStatus): PropertyStatus {
  if (value !== 'ativa' && value !== 'inativa') throw new InvalidApiRequestError();
  return value;
}

/** Internal selection only. prepareSelection always reads the User detail before returning a Produtor ID. */
export class AdministrativeHolderController {
  readonly #scope: AdministrativeSelectionScope;
  readonly #query: AdministrativeSelectionQuery<AdministrativeHolderCandidate, HolderQuery>;
  #initialStatus: PropertyStatus | null;
  #selected: AdministrativeHolderCandidate | null = null;
  #verification: Verification = 'unconfirmed';
  #failure: AdministrativeSelectionFailure | null = null;
  #detailLease: AdministrativeUserReadLease | null = null;
  #detailPending: Promise<Readonly<{ produtor_id: string }> | null> | null = null;
  constructor(readonly repository: AdministrativeUserRepository, session: SessionCoordinator,
    boundary: AdministrativeUserDataBoundary, initialStatus: PropertyStatus, readonly limit = 50) {
    this.#initialStatus = propertyStatus(initialStatus);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new InvalidApiRequestError();
    this.#scope = new AdministrativeSelectionScope(session, boundary, () => {
      this.#clearDetail(); this.#selected = null; this.#initialStatus = null;
      this.#verification = 'unconfirmed'; this.#failure = null; this.#query.dispose();
    });
    this.#query = new AdministrativeSelectionQuery(this.#scope, async (query, cursor, lease) => {
      const page = await repository.list({ perfil: 'produtor', limite: query.limite,
        ...(query.status === 'ativa' ? { status: 'ativo' } : {}),
        ...(query.busca ? { busca: query.busca } : {}), ...(cursor === null ? {} : { cursor }) }, lease);
      const items = page.itens.map(user => {
        const item = candidate(user);
        if (!eligible(item.status, query.status)) throw new InvalidBackendResponseError();
        return item;
      });
      return { items, nextCursor: page.paginacao.proximo_cursor, versionId: null };
    }, item => item.usuario_id);
  }
  get snapshot() {
    return Object.freeze({ ...this.#query.snapshot, initialStatus: this.#initialStatus,
      selected: this.#selected, verification: this.#verification, selectionFailure: this.#failure });
  }
  subscribe(listener: () => void): () => void { return this.#query.subscribe(listener); }
  start(): Promise<void> {
    return this.#query.snapshot.phase === 'idle' ? this.search('') : Promise.resolve();
  }
  search(text: string): Promise<void> {
    if (!this.#scope.active || this.#initialStatus === null) return Promise.resolve();
    return this.#query.reset({ busca: selectionSearch(text), status: this.#initialStatus, limite: this.limit });
  }
  setInitialStatus(status: PropertyStatus): Promise<void> {
    if (!this.#scope.active) return Promise.resolve();
    propertyStatus(status);
    if (status === this.#initialStatus) return Promise.resolve();
    this.#initialStatus = status; this.#clearDetail();
    this.#verification = this.#selected && !eligible(this.#selected.status, status) ? 'invalid' : 'unconfirmed';
    this.#failure = this.#verification === 'invalid' ? INVALID_SELECTION : null;
    return this.search(this.#query.snapshot.query?.busca ?? '');
  }
  refresh(): Promise<void> { return this.#query.refresh(); }
  retry(): Promise<void> { return this.#query.retry(); }
  loadMore(): Promise<void> { return this.#query.loadMore(); }
  select(item: AdministrativeHolderCandidate, generation = this.#query.snapshot.generation): boolean {
    if (!this.#query.contains(item, generation)) return false;
    this.#clearDetail(); this.#selected = item;
    this.#verification = 'unconfirmed'; this.#failure = null; this.#query.notify(); return true;
  }
  selectionCallback(item: AdministrativeHolderCandidate): () => boolean {
    const generation = this.#query.snapshot.generation;
    return () => this.select(item, generation);
  }
  clearSelection(): void {
    if (!this.#scope.active) return;
    this.#clearDetail(); this.#selected = null; this.#verification = 'unconfirmed';
    this.#failure = null; this.#query.notify();
  }
  prepareSelection(): Promise<Readonly<{ produtor_id: string }> | null> {
    if (this.#detailPending) return this.#detailPending;
    if (!this.#scope.active || !this.#selected || !this.#initialStatus) return Promise.resolve(null);
    const selected = this.#selected; const initialStatus = this.#initialStatus;
    const lease = this.#scope.issue(); this.#detailLease = lease;
    const current = () => this.#scope.current(lease) && this.#detailLease === lease;
    this.#verification = 'validating'; this.#failure = null;
    const pending = Promise.resolve().then(async () => {
      if (!current()) return null;
      try {
        const user = await this.repository.getById(selected.usuario_id, lease);
        if (!current()) return null;
        if (user.id !== selected.usuario_id || user.perfil !== 'produtor' ||
          user.produtor_id !== selected.produtor_id || !isCanonicalUuidV4(user.produtor_id) ||
          !eligible(user.status, initialStatus)) {
          this.#verification = 'invalid'; this.#failure = INVALID_SELECTION; return null;
        }
        this.#selected = candidate(user); this.#verification = 'confirmed'; this.#query.notify();
        return current() ? Object.freeze({ produtor_id: user.produtor_id }) : null;
      } catch (error) {
        if (current()) {
          this.#verification = 'error';
          this.#failure = error instanceof ApiResponseError && error.status === 404
            ? INVALID_SELECTION : selectionFailure(error);
        }
        return null;
      } finally {
        if (current() && this.#verification !== 'confirmed') this.#query.notify();
        this.#scope.release(lease);
        if (this.#detailLease === lease) this.#detailLease = null;
      }
    }).finally(() => { if (this.#detailPending === pending) this.#detailPending = null; });
    this.#detailPending = pending; this.#query.notify(); return pending;
  }
  dispose(): void { this.#scope.dispose(); }
  #clearDetail(): void {
    if (this.#detailLease) this.#scope.release(this.#detailLease);
    this.#detailLease = null; this.#detailPending = null;
  }
}
