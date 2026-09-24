import type { HttpRuntime } from './runtime';
import type { AdministrativePropertyProjection, AdministrativeUserDetail, AdministrativeUserPropertyFilters,
  AdministrativeUserPropertyPage, AdministrativeUserPropertyRelation, AdministrativeUserPropertyReceipt } from './contracts';
import { ApiResponseError, InvalidApiRequestError } from './backendApi';
import { administrativeUserSessionPartition } from './administrativeUserAccess';
import { administrativeCommandDispositionForError } from './administrativeCommandCoordinator';
import { AdministrativeUserCommandLifecycle, AdministrativeUserOperationCancelledError } from './administrativeUserCommandLifecycle';
import { AdministrativeUserDataBoundary } from './administrativeUserDataBoundary';
import { AdministrativeSelectionQuery, AdministrativeSelectionScope, selectionSearch } from './administrativeSelectionController';
import { InvalidBackendResponseError, isCanonicalUuidV4 } from './decoders';
import { SessionRequiredError } from './sessionCoordinator';
import { safeClientErrorMessage } from './errorMessages';
import { InvalidUserPropertyModelError, UserPropertyEditModel } from './administrativeUserPropertyModels';

type Phase = 'loading' | 'editing' | 'confirming' | 'submitting' | 'ambiguous' | 'review' | 'error'
  | 'reconciling' | 'reconciliation_failed' | 'completed' | 'disposed';
type RelationsQuery = Omit<AdministrativeUserPropertyFilters, 'cursor'>;
type CatalogQuery = { busca?: string };

/** One modal instance. Existing D-3 lifecycle owns the intent; D-4 queries own cursor recovery.
 * The local lease lifetime follows authorization, not incidental publications of User projections.
 * Every transport operation still checks the shared boundary and authenticated session.
 */
export class AdministrativeUserPropertyController {
  readonly #runtime: HttpRuntime;
  readonly #userId: string;
  readonly #partition: string | null;
  readonly #boundary: AdministrativeUserDataBoundary;
  readonly #scope: AdministrativeSelectionScope;
  readonly #flow: AdministrativeUserCommandLifecycle;
  readonly #relations: AdministrativeSelectionQuery<AdministrativeUserPropertyRelation, RelationsQuery>;
  readonly #catalog: AdministrativeSelectionQuery<AdministrativePropertyProjection, CatalogQuery>;
  readonly #listeners = new Set<() => void>();
  readonly #stops: (() => void)[] = [];
  #model: UserPropertyEditModel | null = null;
  #phase: Phase = 'loading';
  #message: string | null = null;
  #reason = '';
  #detail = '';
  #payload: ReturnType<UserPropertyEditModel['payload']> | null = null;
  #receipt: AdministrativeUserPropertyReceipt | null = null;
  #reconciled: AdministrativeUserPropertyPage | null = null;
  #pending: Promise<void> | null = null;
  #reloadReady = false;
  #started = false;
  #publishing = false;
  #completed = false;
  #onCompleted: (() => void) | null;

  constructor(runtime: HttpRuntime, userId: string, onCompleted: () => void = () => {}) {
    if (!isCanonicalUuidV4(userId)) throw new InvalidApiRequestError();
    this.#runtime = runtime; this.#userId = userId; this.#onCompleted = onCompleted;
    this.#partition = administrativeUserSessionPartition(runtime.session.snapshot, runtime.session.epoch);
    this.#boundary = new AdministrativeUserDataBoundary(this.#partition);
    this.#scope = new AdministrativeSelectionScope(runtime.session, this.#boundary, () => this.dispose());
    this.#flow = new AdministrativeUserCommandLifecycle({ boundary: this.#boundary,
      discardIntent: id => runtime.administrativeCommands.invalidateIntent(id) });
    this.#relations = new AdministrativeSelectionQuery(this.#scope, async (filters, cursor, lease) => {
      const seed = this.#seed; this.#seed = null;
      const page = seed ?? await this.#guard(() => runtime.session.authenticated(token => {
        if (!this.#scope.current(lease)) throw new AdministrativeUserOperationCancelledError();
        return runtime.api.listAdministrativeUserProperties(token, userId, { ...filters, ...(cursor ? { cursor } : {}) });
      }), () => this.#scope.current(lease));
      if (!this.#scope.current(lease)) throw new AdministrativeUserOperationCancelledError();
      if (page.versao !== this.#model?.user.versao) {
        this.#requireReview('Os acessos mudaram durante a consulta. Atualize os dados e decida novamente.');
        throw new InvalidBackendResponseError();
      }
      this.#assertRelations(page, this.#model.user);
      return { items: page.itens, nextCursor: page.paginacao.proximo_cursor, versionId: String(page.versao) };
    }, item => item.id);
    this.#catalog = new AdministrativeSelectionQuery(this.#scope, async (filters, cursor, lease) => {
      // Reuse the administrative property HTTP reader, with this query's cancellation lease.
      // An obsolete selector must not publish into the shared property list or invalidate a new query.
      const page = await this.#guard(() => runtime.session.authenticated(token => {
        if (!this.#scope.current(lease)) throw new AdministrativeUserOperationCancelledError();
        return runtime.api.listAdministrativeProperties(token, { ...filters, limite: 50, ...(cursor ? { cursor } : {}) });
      }), () => this.#scope.current(lease));
      if (!this.#scope.current(lease)) throw new AdministrativeUserOperationCancelledError();
      if (page.itens.some(item => item.tipo_acesso !== 'admin' || item.organizacao_id !== runtime.session.snapshot?.usuario.organizacao_id)) throw new InvalidBackendResponseError();
      return { items: page.itens, nextCursor: page.paginacao.proximo_cursor, versionId: null };
    }, item => item.id);
  }
  get active(): boolean {
    const runtime = this.#runtime, user = runtime.session.snapshot?.usuario;
    return this.#phase !== 'disposed' && user?.perfil === 'admin' && user.status === 'ativo' &&
      this.#partition === administrativeUserSessionPartition(runtime.session.snapshot, runtime.session.epoch) &&
      !['forbidden', 'invalid_session'].includes(runtime.administrativeUserData.current.invalidation ?? '') &&
      runtime.administrativePropertyData.current.authorized;
  }
  get snapshot() {
    return { active: this.active, phase: this.#phase, user: this.#model?.user ?? null, message: this.#message,
      reason: this.#reason, detail: this.#detail, busy: this.#pending !== null, reloadReady: this.#reloadReady,
      additions: [...(this.#model?.additions ?? [])], removals: [...(this.#model?.removals ?? [])],
      count: this.#model?.count ?? 0, relations: this.#relations.snapshot, catalog: this.#catalog.snapshot,
      reconciled: this.#reconciled, mutationConfirmed: this.#receipt !== null } as const;
  }
  subscribe(listener: () => void) {
    if (this.#phase === 'disposed') return () => {};
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  start(): Promise<void> {
    if (this.#started || this.#phase === 'disposed') return Promise.resolve();
    this.#started = true;
    if (!this.active) { this.dispose(); return Promise.resolve(); }
    const check = () => { if (!this.active) this.dispose(); };
    this.#stops.push(this.#runtime.session.subscribe(check), this.#runtime.administrativePropertyData.subscribe(check),
      this.#runtime.administrativeUserData.subscribe(() => {
        check();
        if (!this.active || this.#publishing || !['editing', 'confirming'].includes(this.#phase)) return;
        const event = this.#runtime.administrativeUserData.current;
        if (event.invalidation === 'reconciliation_failed' ||
          (event.mutation?.kind === 'authoritative_user' && event.mutation.user.id === this.#userId &&
            event.mutation.user.versao !== this.#model?.user.versao)) {
          this.#requireReview('O Usuário foi atualizado. Recarregue os acessos antes de uma nova decisão.');
        }
      }), this.#relations.subscribe(() => {
        if (this.active && this.#relations.snapshot.phase === 'ready') this.#model?.remember(this.#relations.snapshot.items);
        this.#publish();
      }), this.#catalog.subscribe(() => this.#publish()));
    this.#flow.start();
    return this.reload();
  }
  async #guard<T>(operation: () => Promise<T>, current: () => boolean = () => this.active): Promise<T> {
    if (!this.active) throw new AdministrativeUserOperationCancelledError();
    const lease = this.#runtime.administrativeUserData.issueLease();
    try {
      const result = await operation();
      if (!this.active) throw new AdministrativeUserOperationCancelledError();
      return result;
    } catch (error) {
      if (this.active && current()) {
        if (error instanceof SessionRequiredError || (error instanceof ApiResponseError && error.status === 401)) {
          this.#runtime.administrativeUserData.invalidateAccess(lease, 'invalid_session'); this.dispose();
        } else if (error instanceof ApiResponseError && error.status === 403) {
          const changed = this.#runtime.administrativeUserData.invalidateAccess(lease, 'forbidden');
          this.dispose(); if (changed) void this.#runtime.session.revalidate().catch(() => {});
        }
      }
      throw error;
    } finally { this.#runtime.administrativeUserData.revokeLease(lease); }
  }
  #assertRelations(page: AdministrativeUserPropertyPage, user: AdministrativeUserDetail) {
    if (page.usuario_id !== user.id || page.versao !== user.versao || page.itens.some(item => {
      if (item.origem_acesso === 'titularidade') return user.perfil !== 'produtor';
      // The decoder validates direct-link structure. Inactive history can retain a previous
      // profile's type, including for Admin; current command eligibility remains separate.
      if (item.status_vinculo === 'inativo') return false;
      return user.perfil === 'admin' || item.tipo_vinculo !==
        (user.perfil === 'produtor' ? 'usuario_autorizado' : 'colaborador');
    })) throw new InvalidBackendResponseError();
  }
  async #readSnapshot(minimumVersion = 1) {
    // Neither request alone proves both the account projection and the relation collection.
    const page = await this.#guard(() => this.#runtime.session.authenticated(token =>
      this.#runtime.api.listAdministrativeUserProperties(token, this.#userId)));
    const user = await this.#guard(() => this.#runtime.session.authenticated(token => this.#runtime.api.getAdministrativeUser(token, this.#userId)));
    this.#assertRelations(page, user);
    if (page.versao < minimumVersion || user.organizacao_id !== this.#runtime.session.snapshot?.usuario.organizacao_id) throw new InvalidBackendResponseError();
    return { user, page };
  }
  reload(): Promise<void> {
    if (!this.active || this.#receipt || ['submitting', 'ambiguous', 'confirming', 'completed'].includes(this.#phase)) return Promise.resolve();
    const review = this.#phase === 'review';
    return this.#run(async () => {
      this.#relations.reset(null); this.#catalog.reset(null); this.#reloadReady = false;
      const { user, page } = await this.#readSnapshot();
      if (!this.active) return;
      this.#model = new UserPropertyEditModel(user); this.#model.remember(page.itens);
      this.#reconciled = page; this.#reason = ''; this.#detail = ''; this.#payload = null;
      this.#reloadReady = true; this.#phase = review ? 'review' : 'editing';
      this.#message = review ? 'Dados atualizados. Inicie uma nova decisão e selecione as alterações desejadas.' : null;
      // Seed the first query through the existing query controller, without a second transport read.
      this.#seed = page;
      await this.#relations.reset({ limite: 50 });
    }, review ? 'review' : 'error');
  }
  #seed: AdministrativeUserPropertyPage | null = null;
  searchRelations(filters: RelationsQuery): Promise<void> {
    if (!this.active || this.#phase !== 'editing') return Promise.resolve();
    this.#reconciled = null;
    return this.#relations.reset(filters);
  }
  searchProperties(search: string): Promise<void> {
    if (!this.active || this.#phase !== 'editing' || this.#model?.user.perfil === 'admin') return Promise.resolve();
    try { const busca = selectionSearch(search); return this.#catalog.reset(busca ? { busca } : {}); }
    catch (error) { this.#message = 'Use até 200 caracteres na busca.'; this.#publish(); return Promise.resolve(); }
  }
  more(kind: 'relations' | 'catalog') { return this.#editable() ? (kind === 'relations' ? this.#relations : this.#catalog).loadMore() : Promise.resolve(); }
  retry(kind: 'relations' | 'catalog') { return this.#editable() ? (kind === 'relations' ? this.#relations : this.#catalog).retry() : Promise.resolve(); }
  restart(kind: 'relations' | 'catalog') { return this.#editable() ? (kind === 'relations' ? this.#relations : this.#catalog).refresh() : Promise.resolve(); }
  #editable() { return this.active && this.#phase === 'editing' && !this.#pending; }
  selectRelation(item: AdministrativeUserPropertyRelation, active: boolean) {
    if (!this.#editable() || !this.#relations.contains(item) || !item.editavel) return;
    this.#model?.set(item.propriedade_id, item.propriedade_nome, active); this.#publish();
  }
  selectProperty(item: AdministrativePropertyProjection) {
    if (!this.#editable() || !this.#catalog.contains(item) || !this.#model ||
      (this.#model.user.perfil === 'produtor' && item.titular_id === this.#model.user.produtor_id)) return;
    this.#model.set(item.id, item.nome, true); this.#publish();
  }
  undo(id: string) {
    if (!this.#editable()) return;
    this.#model?.additions.delete(id); this.#model?.removals.delete(id); this.#publish();
  }
  update(field: 'reason' | 'detail', value: string) {
    if (!this.#editable()) return;
    if (field === 'reason') this.#reason = value; else this.#detail = value;
    this.#message = null; this.#publish();
  }
  review() {
    if (!this.#editable() || !this.#model?.count) return;
    try {
      this.#payload = this.#model.payload(this.#reason, this.#detail); this.#phase = 'confirming'; this.#message = null;
      // Retire outstanding reads so they cannot mutate a frozen confirmation or replay.
      this.#relations.reset(null); this.#catalog.reset(null);
    } catch (error) { this.#message = error instanceof InvalidUserPropertyModelError ? error.message : 'Revise os vínculos.'; }
    this.#publish();
  }
  backToEditing() {
    if (!this.active || this.#phase !== 'confirming' || this.#pending) return;
    this.#payload = null; this.#phase = 'editing'; this.#publish();
    void this.#relations.reset({ limite: 50 });
  }
  confirm(): Promise<void> {
    if (!this.active || !this.#payload || this.#receipt || !['confirming', 'ambiguous', 'submitting'].includes(this.#phase)) return Promise.resolve();
    return this.#run(async () => {
      this.#phase = 'submitting'; this.#publish();
      const payload = this.#payload!;
      const outcome = await this.#flow.run(async (intentId, context) => {
        const receipt = await this.#guard(() => this.#runtime.administrativeCommands.execute({ intentId, method: 'PATCH',
          route: `/v1/usuarios/${this.#userId}/propriedades`, body: payload }, (token, command) => {
          if (!this.active || !context.isCurrent() || this.#model?.user.perfil === 'admin') throw new AdministrativeUserOperationCancelledError();
          return this.#runtime.api.changeAdministrativeUserProperties(token, this.#userId, command.idempotencyKey, command.body);
        }));
        context.confirmMutation(); this.#receipt = receipt; this.#phase = 'reconciling';
        const lease = this.#runtime.administrativeUserData.issueLease();
        this.#runtime.administrativeUserData.invalidateReconciliation(lease);
        this.#runtime.administrativeUserData.revokeLease(lease); this.#publish();
        return receipt;
      });
      if (!this.active || !outcome.current || !outcome.leader) return;
      if (outcome.ok) { await this.#reconcile(); return; }
      if ('error' in outcome && administrativeCommandDispositionForError(outcome.error) === 'ambiguous') {
        this.#phase = 'ambiguous'; this.#message = 'Envio não confirmado. Tente novamente a mesma operação.'; return;
      }
      this.#requireReview('error' in outcome ? safeClientErrorMessage(outcome.error) : 'Não foi possível confirmar a alteração.');
      if ('error' in outcome && outcome.error instanceof ApiResponseError &&
          ['version_conflict', 'business_rule_conflict'].includes(outcome.error.code)) {
        try {
          const { user, page } = await this.#readSnapshot();
          if (!this.active) return;
          this.#model = new UserPropertyEditModel(user); this.#model.remember(page.itens);
          this.#reconciled = page; this.#reloadReady = true;
          this.#message = 'A alteração não foi aplicada. Revise o estado atual e inicie uma nova decisão.';
        } catch { if (this.active) this.#message = 'A alteração não foi aplicada e a releitura falhou. Atualize os dados.'; }
      }
    });
  }
  async #reconcile() {
    if (!this.#receipt || !this.active) return;
    this.#phase = 'reconciling'; this.#message = null; this.#publish();
    const lease = this.#runtime.administrativeUserData.issueLease();
    try {
      const { user, page } = await this.#readSnapshot(this.#receipt.versao);
      if (!this.active) return;
      this.#publishing = true;
      if (!this.#runtime.administrativeUserData.publishAuthoritativeUser(lease, user)) throw new InvalidBackendResponseError();
      this.#model = new UserPropertyEditModel(user); this.#model.remember(page.itens);
      this.#reconciled = page; this.#payload = null; this.#reason = ''; this.#detail = '';
      this.#phase = 'completed'; this.#message = 'Vínculos atualizados. Esta consulta mostra o estado atual do servidor.';
      if (!this.#completed) { this.#completed = true; this.#onCompleted?.(); }
    } catch (error) {
      if (this.active) { this.#phase = 'reconciliation_failed'; this.#message = 'Alteração confirmada, mas a atualização dos acessos falhou. Tente atualizar; a operação não será reenviada.'; }
    } finally { this.#publishing = false; this.#runtime.administrativeUserData.revokeLease(lease); }
  }
  retryReconciliation() {
    return this.active && this.#receipt && this.#phase === 'reconciliation_failed' ? this.#run(() => this.#reconcile()) : Promise.resolve();
  }
  newDecision() {
    if (!this.active || this.#phase !== 'review' || !this.#reloadReady || this.#pending) return;
    this.#flow.restartIntent(); this.#payload = null; this.#reason = ''; this.#detail = '';
    this.#model = this.#model ? new UserPropertyEditModel(this.#model.user) : null;
    this.#phase = 'editing'; this.#message = null;
    void this.#relations.reset({ limite: 50 }); this.#publish();
  }
  #requireReview(message: string) {
    this.#phase = 'review'; this.#reloadReady = false; this.#message = message; this.#payload = null; this.#publish();
  }
  #run(operation: () => Promise<void>, failurePhase: Phase = 'review'): Promise<void> {
    if (this.#pending) return this.#pending;
    const pending = Promise.resolve().then(async () => {
      if (!this.active) return;
      try { await operation(); }
      catch (error) { if (this.active) { this.#phase = failurePhase; this.#message = safeClientErrorMessage(error); } }
    }).finally(() => { if (this.#pending === pending) { this.#pending = null; if (this.active) this.#publish(); } });
    this.#pending = pending; this.#publish(); return pending;
  }
  #publish() { for (const listener of this.#listeners) listener(); }
  dispose() {
    if (this.#phase === 'disposed') return;
    this.#phase = 'disposed'; this.#onCompleted = null;
    for (const stop of this.#stops.splice(0)) stop();
    this.#flow.dispose(); this.#relations.dispose(); this.#catalog.dispose(); this.#scope.dispose();
    this.#model = null; this.#payload = null; this.#receipt = null; this.#reconciled = null; this.#seed = null;
    this.#reason = ''; this.#detail = ''; this.#message = null; this.#pending = null;
    this.#publish(); this.#listeners.clear();
  }
}
