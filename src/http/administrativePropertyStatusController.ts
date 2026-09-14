import type { HttpRuntime } from './runtime';
import type { AdministrativePropertyProjection, PropertyStatus } from './contracts';
import type { AdministrativePropertyReadLease } from './administrativePropertyDataBoundary';
import type { AdministrativePropertyCommandLifecycle } from './administrativePropertyCommandLifecycle';
import { buildChangeAdministrativePropertyStatusPayload, createAdministrativePropertyEditModel,
  InvalidAdministrativePropertyModelError } from './administrativePropertyModels';
import { AdministrativePropertyConflictError } from './administrativePropertyCommands';
import { safeClientErrorMessage } from './errorMessages';

/** One mounted status decision. Payload, idempotency and reconciliation belong to existing ports. */
export class AdministrativePropertyStatusController {
  readonly #runtime: HttpRuntime;
  readonly #lease: AdministrativePropertyReadLease;
  readonly #listeners = new Set<() => void>();
  #subscriptions: (() => void)[] = [];
  #flowSubscriptions: (() => void)[] = [];
  #flow: AdministrativePropertyCommandLifecycle | null = null;
  #property: AdministrativePropertyProjection | null;
  #target: PropertyStatus;
  #reason = '';
  #detail = '';
  #confirmation = false;
  #review = false;
  #reloadRequired = false;
  #message: string | null = null;
  #pending: Promise<void> | null = null;
  #active = false;
  #disposed = false;
  #completed = false;
  #onCompleted: (() => void) | null;
  constructor(runtime: HttpRuntime, property: AdministrativePropertyProjection, onCompleted: () => void) {
    this.#runtime = runtime;
    this.#property = createAdministrativePropertyEditModel(property).baseline;
    this.#target = property.status === 'ativa' ? 'inativa' : 'ativa';
    this.#lease = runtime.administrativePropertyData.issueLease();
    this.#onCompleted = onCompleted;
  }
  get current() {
    const user = this.#runtime.session.snapshot?.usuario;
    const invalidation = this.#runtime.administrativeUserData.current.invalidation;
    return this.#active && !this.#disposed && user?.perfil === 'admin' && user.status === 'ativo' &&
      this.#runtime.administrativePropertyData.current.authorized &&
      this.#runtime.administrativePropertyData.isAuthorizationCurrent(this.#lease) &&
      invalidation !== 'forbidden' && invalidation !== 'invalid_session';
  }
  get snapshot() {
    return { active: this.current, property: this.#property, target: this.#target, reason: this.#reason,
      detail: this.#detail, confirmation: this.#confirmation, review: this.#review,
      reloadRequired: this.#reloadRequired, message: this.#message, busy: !!this.#pending,
      command: this.#flow?.snapshot ?? null } as const;
  }
  subscribe(listener: () => void) {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  start() {
    if (this.#active || this.#disposed) return;
    this.#active = true;
    if (!this.current) { this.dispose(); return; }
    this.#subscriptions.push(this.#runtime.administrativePropertyData.subscribe(() => {
      if (!this.current) { this.dispose(); return; }
      const next = this.#property && this.#runtime.administrativePropertyData.current.details[this.#property.id];
      if (next && next.versao > this.#property!.versao && !this.#pending && !this.#flow?.snapshot.mutationConfirmed &&
        this.#flow?.snapshot.phase !== 'ambiguous') {
        this.#property = next; this.#requireReview('A Propriedade mudou. Revise o estado atual antes de decidir novamente.');
      }
    }), this.#runtime.administrativeUserData.subscribe(() => { if (!this.current) this.dispose(); }));
  }
  #editable() {
    return this.current && !this.#pending && !this.#review && !this.#flow?.snapshot.mutationConfirmed &&
      this.#flow?.snapshot.phase !== 'ambiguous';
  }
  update(field: 'reason' | 'detail', value: string) {
    if (!this.#editable() || this.#confirmation) return;
    if (field === 'reason') this.#reason = value; else this.#detail = value;
    this.#message = null; this.#publish();
  }
  #draft() {
    return { status: this.#target, motivo: this.#reason, ...(this.#detail === '' ? {} : { motivo_detalhe: this.#detail }) };
  }
  requestConfirmation() {
    if (!this.#editable() || !this.#property) return;
    try {
      buildChangeAdministrativePropertyStatusPayload(this.#property, this.#draft());
      this.#confirmation = true; this.#message = null;
    } catch (error) {
      this.#message = error instanceof InvalidAdministrativePropertyModelError && error.field === 'motivo_detalhe'
        ? 'Informe o detalhe do motivo com até 300 caracteres, sem espaços nas extremidades.'
        : 'Selecione um motivo administrativo válido.';
    }
    this.#publish();
  }
  confirm(): Promise<void> {
    if (!this.current || this.#completed) return Promise.resolve();
    if (this.#pending) return this.#pending;
    if (this.#flow?.snapshot.phase !== 'ambiguous' && (!this.#editable() || !this.#confirmation)) return Promise.resolve();
    return this.#run(async () => {
      if (!this.#flow) {
        const flow = this.#runtime.administrativePropertyCommands.changeStatus(this.#property!, this.#draft());
        this.#flow = flow;
        this.#flowSubscriptions.push(flow.subscribe(() => this.#publish()), flow.onCompleted(() => {
          if (!this.current || this.#flow !== flow || this.#completed) return;
          this.#completed = true; this.#onCompleted?.();
        }));
        flow.start();
      }
      const result = await this.#flow.submit();
      if (!this.current || !result.error || result.mutationConfirmed) return;
      if (result.phase === 'ambiguous') {
        this.#message = 'Não foi possível confirmar o envio. Tente novamente a mesma operação.'; return;
      }
      if (result.error instanceof AdministrativePropertyConflictError) {
        const error = result.error;
        if (error.property) this.#property = error.property;
        this.#reloadRequired = !!error.reloadError;
        this.#requireReview(error.reloadError ? 'A Propriedade mudou, mas não foi possível carregar o estado atual. Atualize os dados.'
          : error.original.code === 'version_conflict' ? 'A Propriedade mudou. Revise o estado atual antes de decidir novamente.'
            : safeClientErrorMessage(error.original) + ' Não é possível alterar o status no estado atual.');
      } else this.#requireReview(safeClientErrorMessage(result.error));
    });
  }
  retryReconciliation() {
    if (!this.current || !this.#flow) return Promise.resolve();
    return this.#run(async () => { await this.#flow?.retryReconciliation(); });
  }
  reload() {
    if (!this.current || !this.#review || this.#flow?.snapshot.mutationConfirmed) return Promise.resolve();
    return this.#run(async () => {
      const property = await this.#runtime.administrativeProperties.getById(this.#property!.id);
      if (!this.current) return;
      this.#property = property; this.#reloadRequired = false;
      this.#message = 'Estado atualizado. Revise a Propriedade antes de decidir novamente.';
    });
  }
  newDecision() {
    if (!this.current || this.#pending || !this.#review || this.#reloadRequired || !this.#property) return;
    this.#retireFlow(); this.#target = this.#property.status === 'ativa' ? 'inativa' : 'ativa';
    this.#reason = ''; this.#detail = ''; this.#confirmation = false; this.#review = false; this.#message = null;
    this.#publish();
  }
  #requireReview(message: string) {
    this.#review = true; this.#confirmation = false; this.#message = message; this.#publish();
  }
  #run(operation: () => Promise<void>): Promise<void> {
    if (this.#pending) return this.#pending;
    const pending = Promise.resolve().then(async () => {
      if (!this.current) return;
      try { await operation(); }
      catch (error) { if (this.current) this.#message = safeClientErrorMessage(error); }
    }).finally(() => { if (this.#pending === pending) { this.#pending = null; if (this.current) this.#publish(); } });
    this.#pending = pending; this.#publish(); return pending;
  }
  #publish() { for (const listener of this.#listeners) listener(); }
  #retireFlow() {
    for (const stop of this.#flowSubscriptions.splice(0)) stop();
    this.#flow?.dispose(); this.#flow = null;
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true; this.#active = false;
    for (const stop of this.#subscriptions.splice(0)) stop();
    this.#retireFlow(); this.#property = null; this.#reason = ''; this.#detail = '';
    this.#message = null; this.#confirmation = false; this.#pending = null; this.#onCompleted = null;
    this.#runtime.administrativePropertyData.revokeLease(this.#lease);
    this.#publish(); this.#listeners.clear();
  }
}
