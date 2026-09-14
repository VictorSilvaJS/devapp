import { InvalidApiRequestError, type BackendApi } from './backendApi';
import type { AdministrativeUserDataBoundary } from './administrativeUserDataBoundary';
import { createAdministrativePropertyEditModel, type AdministrativePropertyMunicipality } from './administrativePropertyModels';
import type { AdministrativePropertyProjection, LocalityMunicipality, LocalityUf } from './contracts';
import type { SessionCoordinator } from './sessionCoordinator';
import { AdministrativeSelectionQuery, AdministrativeSelectionScope, selectionSearch } from './administrativeSelectionController';

interface MunicipalityQuery { readonly uf_id: string; readonly busca: string; readonly limite: number }
type SelectedUf = Readonly<Pick<LocalityUf, 'id' | 'sigla'> & { nome?: string }>;

/** UF and municipality are selection state; catalog pages never choose or overwrite them. */
export class AdministrativeLocalityController {
  readonly #scope: AdministrativeSelectionScope;
  readonly #ufs: AdministrativeSelectionQuery<LocalityUf, Record<string, never>>;
  readonly #municipalities: AdministrativeSelectionQuery<LocalityMunicipality, MunicipalityQuery>;
  readonly #listeners = new Set<() => void>();
  #selectedUf: SelectedUf | null = null;
  #selected: AdministrativePropertyMunicipality | null = null;
  constructor(api: BackendApi, session: SessionCoordinator, boundary: AdministrativeUserDataBoundary,
    readonly limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new InvalidApiRequestError();
    this.#scope = new AdministrativeSelectionScope(session, boundary, () => {
      this.#selectedUf = null; this.#selected = null;
      // Clear both query snapshots before exposing the terminal state to consumers.
      const listeners = [...this.#listeners]; this.#listeners.clear();
      this.#ufs.dispose(); this.#municipalities.dispose();
      for (const listener of listeners) { try { listener(); } catch { /* Continue cancellation. */ } }
    });
    this.#ufs = new AdministrativeSelectionQuery(this.#scope, async (_query, _cursor, lease) => {
      const page = await this.#scope.authenticated(lease, token => api.listLocalityUfs(token));
      return { items: page.itens, nextCursor: null, versionId: page.versao_id };
    }, item => item.id);
    this.#municipalities = new AdministrativeSelectionQuery(this.#scope, async (query, cursor, lease) => {
      const page = await this.#scope.authenticated(lease, token => api.listLocalityMunicipalities(token, {
        uf_id: query.uf_id, limite: query.limite, ...(query.busca ? { busca: query.busca } : {}),
        ...(cursor === null ? {} : { cursor }),
      }));
      return { items: page.itens, nextCursor: page.paginacao.proximo_cursor, versionId: page.versao_id };
    }, item => item.id);
    this.#ufs.subscribe(() => this.#notify()); this.#municipalities.subscribe(() => this.#notify());
  }
  get snapshot() {
    return Object.freeze({ cancelled: !this.#scope.active, ufs: this.#ufs.snapshot,
      municipalities: this.#municipalities.snapshot, selectedUf: this.#selectedUf, selected: this.#selected });
  }
  subscribe(listener: () => void): () => void {
    if (!this.#scope.active) return () => {};
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  start(): Promise<void> { return this.#ufs.snapshot.phase === 'idle' ? this.#ufs.reset({}) : Promise.resolve(); }
  refreshUfs(): Promise<void> { return this.#ufs.refresh(); }
  retryUfs(): Promise<void> { return this.#ufs.retry(); }
  setUf(uf: LocalityUf, generation = this.#ufs.snapshot.generation): Promise<void> {
    if (!this.#ufs.contains(uf, generation) || this.#selectedUf?.id === uf.id) return Promise.resolve();
    this.#selectedUf = uf; this.#selected = null;
    return this.search('');
  }
  ufSelectionCallback(uf: LocalityUf): () => Promise<void> {
    const generation = this.#ufs.snapshot.generation;
    return () => this.setUf(uf, generation);
  }
  clearUf(): void {
    if (!this.#scope.active) return;
    this.#selectedUf = null; this.#selected = null; void this.#municipalities.reset(null);
  }
  /** Explicit initialization from an authoritative detail. Does not issue or scan GETs. */
  initializeFromProperty(property: AdministrativePropertyProjection): void {
    if (!this.#scope.active) return;
    const selected = createAdministrativePropertyEditModel(property).draft.municipio;
    this.#selectedUf = Object.freeze({ id: selected.uf_id, sigla: selected.uf_sigla });
    this.#selected = selected; void this.#municipalities.reset(null);
  }
  search(text: string): Promise<void> {
    if (!this.#scope.active || this.#selectedUf === null) return Promise.resolve();
    return this.#municipalities.reset({ uf_id: this.#selectedUf.id, busca: selectionSearch(text), limite: this.limit });
  }
  refresh(): Promise<void> { return this.#municipalities.refresh(); }
  retry(): Promise<void> { return this.#municipalities.retry(); }
  loadMore(): Promise<void> { return this.#municipalities.loadMore(); }
  selectMunicipality(item: LocalityMunicipality, generation = this.#municipalities.snapshot.generation): boolean {
    if (!this.#municipalities.contains(item, generation) || !this.#selectedUf ||
      item.uf_id !== this.#selectedUf.id || item.uf_id !== this.#municipalities.snapshot.query?.uf_id) return false;
    this.#selected = Object.freeze({ municipio_id: item.id, municipio_nome: item.nome,
      uf_id: item.uf_id, uf_sigla: this.#selectedUf.sigla });
    this.#notify(); return true;
  }
  municipalitySelectionCallback(item: LocalityMunicipality): () => boolean {
    const generation = this.#municipalities.snapshot.generation;
    return () => this.selectMunicipality(item, generation);
  }
  selectionInput(): AdministrativePropertyMunicipality | null { return this.#selected; }
  dispose(): void { this.#scope.dispose(); }
  #notify(): void {
    for (const listener of this.#listeners) { try { listener(); } catch { /* Notify remaining consumers. */ } }
  }
}
