import type { HttpRuntime } from './runtime';
import type { AdministrativeHolderController } from './administrativeHolderController';
import type { AdministrativeLocalityController } from './administrativeLocalityController';
import type { AdministrativePropertyCommandLifecycle, AdministrativePropertyCommandState } from './administrativePropertyCommandLifecycle';
import type { AdministrativePropertyReadLease } from './administrativePropertyDataBoundary';
import type { AdministrativePropertyProjection, PropertyStatus } from './contracts';
import {
  buildCreateAdministrativePropertyPayload, buildPatchAdministrativePropertyPayload,
  createAdministrativePropertyEditModel, rebaseAdministrativePropertyEditModel,
  resolveAdministrativePropertyEditConflict, updateAdministrativePropertyEditField,
  InvalidAdministrativePropertyModelError,
  type AdministrativePropertyEditField, type AdministrativePropertyEditModel,
} from './administrativePropertyModels';
import { AdministrativePropertyConflictError } from './administrativePropertyCommands';
import { ApiResponseError } from './backendApi';
import { safeClientErrorMessage } from './errorMessages';

type Inputs = Readonly<{ nome: string; area_total: string; cultura_principal: string; status: PropertyStatus }>;
export interface AdministrativePropertyFormState {
  readonly active: boolean;
  readonly inputs: Inputs | null;
  readonly model: AdministrativePropertyEditModel | null;
  readonly holder: AdministrativeHolderController['snapshot'] | null;
  readonly localities: AdministrativeLocalityController['snapshot'] | null;
  readonly command: AdministrativePropertyCommandState | null;
  readonly busy: boolean;
  readonly loading: boolean;
  readonly canSubmit: boolean;
  readonly message: string | null;
  readonly errors: Readonly<Record<string, string>>;
}
const FIELD_ERRORS: Readonly<Record<string, string>> = {
  nome: 'Informe um nome com até 200 caracteres, sem espaços nas extremidades.',
  area_total: 'Informe uma área válida usando ponto decimal, sem espaços ou separador de milhar.',
  cultura_principal: 'Informe uma cultura com até 120 caracteres, sem espaços nas extremidades.',
};

function commandMessage(error: unknown): string {
  if (error instanceof AdministrativePropertyConflictError) {
    if (error.reloadError) return 'Os dados mudaram, mas não foi possível carregar a versão atual. Tente atualizar os dados.';
    return error.original.code === 'version_conflict'
      ? 'Os dados mudaram no servidor. Revise os valores antes de salvar novamente.'
      : 'A alteração conflita com uma regra do cadastro. Revise os dados atualizados.';
  }
  if (error instanceof ApiResponseError && error.status === 422) return 'O servidor recusou os dados. Revise os campos informados.';
  if (error instanceof ApiResponseError && error.status === 400) return 'O serviço não aceitou o formato da solicitação. Atualize os dados antes de tentar novamente.';
  if (error instanceof ApiResponseError && error.code === 'business_rule_conflict') return 'A alteração conflita com uma regra do cadastro. Revise os dados.';
  return safeClientErrorMessage(error);
}

/** Owns one mounted form. Commands, queries and payload rules remain in their existing ports. */
export class AdministrativePropertyFormController {
  readonly #runtime: HttpRuntime;
  readonly #lease: AdministrativePropertyReadLease;
  readonly #propertyId?: string;
  readonly #listeners = new Set<() => void>();
  #subscriptions: (() => void)[] = [];
  #active = false;
  #disposed = false;
  #inputs: Inputs | null = null;
  #model: AdministrativePropertyEditModel | null = null;
  #holder: AdministrativeHolderController | null = null;
  #localities: AdministrativeLocalityController | null = null;
  #flow: AdministrativePropertyCommandLifecycle | null = null;
  #flowSubscriptions: (() => void)[] = [];
  #pending: Promise<void> | null = null;
  #loading = false;
  #message: string | null = null;
  #reloadRequired = false;
  #onCompleted: ((property: AdministrativePropertyProjection) => void) | null;
  #state: AdministrativePropertyFormState;

  constructor(runtime: HttpRuntime, propertyId: string | undefined,
    onCompleted: (property: AdministrativePropertyProjection) => void) {
    this.#runtime = runtime; this.#propertyId = propertyId; this.#onCompleted = onCompleted;
    this.#lease = runtime.administrativePropertyData.issueLease();
    this.#state = this.#snapshot();
  }
  get snapshot() { return this.#state; }
  get holder() { return this.#holder; }
  get localities() { return this.#localities; }
  get current(): boolean {
    const user = this.#runtime.session.snapshot?.usuario;
    const invalidation = this.#runtime.administrativeUserData.current.invalidation;
    return this.#active && !this.#disposed && user?.perfil === 'admin' && user.status === 'ativo' &&
      this.#runtime.administrativePropertyData.current.authorized &&
      this.#runtime.administrativePropertyData.isAuthorizationCurrent(this.#lease) &&
      invalidation !== 'forbidden' && invalidation !== 'invalid_session';
  }
  subscribe(listener: () => void): () => void {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener); return () => { this.#listeners.delete(listener); };
  }
  start(): void {
    if (this.#active || this.#disposed) return;
    this.#active = true;
    if (!this.current) { this.dispose(); return; }
    this.#subscriptions.push(this.#runtime.administrativePropertyData.subscribe(() => {
      if (!this.current) { this.dispose(); return; }
      const detail = this.#propertyId ? this.#runtime.administrativePropertyData.current.details[this.#propertyId] : null;
      if (detail && this.#model && detail.versao > this.#model.baseline.versao && !this.#flow?.snapshot.mutationConfirmed) {
        this.#setModel(rebaseAdministrativePropertyEditModel(this.#model, detail)); this.#publish();
      }
    }), this.#runtime.administrativeUserData.subscribe(() => {
      if (!this.current) this.dispose();
    }));
    this.#localities = this.#runtime.administrativePropertySelectors.createLocalities();
    this.#subscriptions.push(this.#localities.subscribe(() => this.#publish()));
    void this.#localities.start();
    if (this.#propertyId) { void this.reload(); }
    else {
      this.#inputs = Object.freeze({ nome: '', area_total: '', cultura_principal: '', status: 'ativa' });
      this.#holder = this.#runtime.administrativePropertySelectors.createHolder('ativa');
      this.#subscriptions.push(this.#holder.subscribe(() => this.#publish()));
      void this.#holder.start();
    }
    this.#publish();
  }
  #editable(): boolean {
    return this.current && !this.#pending && !this.#loading && !this.#reloadRequired &&
      !this.#flow?.snapshot.mutationConfirmed && this.#flow?.snapshot.phase !== 'ambiguous';
  }
  update(field: 'nome' | 'area_total' | 'cultura_principal', value: string): void {
    if (!this.#editable()) return;
    this.#retireFlow(); this.#message = null;
    if (this.#model) this.#model = updateAdministrativePropertyEditField(this.#model, field,
      value === '' && field !== 'nome' ? null : value);
    else if (this.#inputs) this.#inputs = Object.freeze({ ...this.#inputs, [field]: value });
    this.#publish();
  }
  setStatus(status: PropertyStatus): void {
    if (!this.#editable() || !this.#inputs) return;
    this.#retireFlow(); this.#message = null;
    this.#inputs = Object.freeze({ ...this.#inputs, status });
    this.#holder?.setInitialStatus(status); this.#publish();
  }
  select(action: () => unknown, municipality = false): void {
    if (!this.#editable()) return;
    try { if (action() === false) return; }
    catch {
      this.#message = 'Não foi possível alterar a seleção. Informe uma busca com até 200 caracteres.';
      this.#publish(); return;
    }
    this.#message = null;
    if (municipality && this.#model && this.#localities?.selectionInput()) {
      this.#model = updateAdministrativePropertyEditField(this.#model, 'municipio', this.#localities.selectionInput()!);
    }
    this.#retireFlow(); this.#publish();
  }
  confirmHolder(): void {
    if (!this.#editable()) return;
    void this.#holder?.prepareSelection();
  }
  resolve(field: AdministrativePropertyEditField, resolution: 'server' | 'operator'): void {
    if (!this.#editable() || !this.#model) return;
    this.#setModel(resolveAdministrativePropertyEditConflict(this.#model, field, resolution));
    this.#retireFlow(); this.#publish();
  }
  reload(): Promise<void> {
    if (!this.current || !this.#propertyId || this.#flow?.snapshot.mutationConfirmed) return Promise.resolve();
    if (this.#pending) return this.#pending;
    return this.#run(async () => {
      this.#loading = true; this.#publish();
      try {
        const property = await this.#runtime.administrativeProperties.getById(this.#propertyId!);
        if (!this.current) return;
        this.#setModel(this.#model ? rebaseAdministrativePropertyEditModel(this.#model, property)
          : createAdministrativePropertyEditModel(property));
        this.#reloadRequired = false; this.#message = null;
        this.#retireFlow();
      } catch (error) { if (this.current) this.#message = commandMessage(error); }
      finally { if (this.current) this.#loading = false; }
    });
  }
  submit(): Promise<void> {
    if (!this.current) return Promise.resolve();
    if (this.#pending) return this.#pending;
    if (this.#flow?.snapshot.phase === 'ambiguous') return this.#run(() => this.#send());
    if (!this.#snapshot().canSubmit) return Promise.resolve();
    return this.#run(async () => {
      if (this.#inputs) {
        const titular = await this.#holder?.prepareSelection();
        if (!this.current || !titular) return;
        this.#installFlow(this.#runtime.administrativePropertyCommands.create(this.#createDraft(titular)));
      } else if (this.#model) {
        this.#installFlow(this.#runtime.administrativePropertyCommands.update(this.#model));
      }
      await this.#send();
    });
  }
  retryReconciliation(): Promise<void> {
    if (!this.current || !this.#flow) return Promise.resolve();
    return this.#run(async () => { await this.#flow?.retryReconciliation(); });
  }
  async #send(): Promise<void> {
    if (!this.current || !this.#flow) return;
    const state = await this.#flow.submit();
    if (!this.current) return;
    if (state.error && !state.mutationConfirmed) {
      this.#message = commandMessage(state.error);
      if (state.error instanceof AdministrativePropertyConflictError) {
        if (state.error.editModel && (!this.#model || state.error.editModel.baseline.versao > this.#model.baseline.versao)) {
          this.#setModel(state.error.editModel);
        }
        this.#reloadRequired = !!state.error.reloadError;
      }
    }
  }
  #installFlow(flow: AdministrativePropertyCommandLifecycle): void {
    this.#retireFlow(); this.#flow = flow;
    this.#flowSubscriptions.push(flow.subscribe(() => this.#publish()), flow.onCompleted((property) => {
      if (!this.current || this.#flow !== flow) return;
      if (this.#model) this.#model = createAdministrativePropertyEditModel(property);
      this.#publish(); this.#onCompleted?.(property);
    }));
    flow.start();
  }
  #retireFlow(): void {
    for (const stop of this.#flowSubscriptions.splice(0)) stop();
    this.#flow?.dispose(); this.#flow = null;
  }
  #createDraft(titular = { produtor_id: this.#holder?.snapshot.selected?.produtor_id ?? '' }) {
    const inputs = this.#inputs!;
    return { nome: inputs.nome, status: inputs.status, titular,
      municipio_id: this.#localities?.selectionInput()?.municipio_id ?? '',
      ...(inputs.area_total === '' ? {} : { area_total: inputs.area_total }),
      ...(inputs.cultura_principal === '' ? {} : { cultura_principal: inputs.cultura_principal }) };
  }
  #setModel(model: AdministrativePropertyEditModel): void {
    const previous = this.#model?.draft.municipio;
    this.#model = model;
    const next = model.draft.municipio;
    // A read of unrelated fields must not undo a UF selection still awaiting its municipality.
    if (previous && previous.municipio_id === next.municipio_id && previous.municipio_nome === next.municipio_nome &&
      previous.uf_id === next.uf_id && previous.uf_sigla === next.uf_sigla) return;
    this.#localities?.initializeFromProperty({ ...model.baseline, ...next });
    void this.#localities?.search('');
  }
  #run(operation: () => Promise<void>): Promise<void> {
    if (this.#pending) return this.#pending;
    const pending = Promise.resolve().then(async () => {
      if (!this.current) return;
      try { await operation(); }
      catch (error) { if (this.current) this.#message = commandMessage(error); }
    }).finally(() => {
      if (this.#pending === pending) { this.#pending = null; this.#publish(); }
    });
    this.#pending = pending; this.#publish(); return pending;
  }
  #snapshot(): AdministrativePropertyFormState {
    const errors: Record<string, string> = {};
    let valid = false;
    try {
      if (this.#model) { buildPatchAdministrativePropertyPayload(this.#model); valid = true; }
      else if (this.#inputs) { buildCreateAdministrativePropertyPayload(this.#createDraft()); valid = true; }
    } catch (error) {
      if (error instanceof InvalidAdministrativePropertyModelError && FIELD_ERRORS[error.field]) {
        errors[error.field === 'nome' ? 'propriedade' : error.field] = FIELD_ERRORS[error.field];
      }
    }
    const command = this.#flow?.snapshot ?? null;
    const localities = this.#localities?.snapshot ?? null;
    const holder = this.#holder?.snapshot ?? null;
    return Object.freeze({ active: this.current, inputs: this.#inputs, model: this.#model, holder, localities,
      command, busy: !!this.#pending, loading: this.#loading,
      canSubmit: this.#editable() && valid && !localities?.cancelled && !!localities?.selected &&
        (!this.#inputs || holder?.verification === 'confirmed') &&
        (!this.#model || localities.selected.municipio_id === this.#model.draft.municipio.municipio_id),
      message: this.#message, errors: Object.freeze(errors) });
  }
  #publish(): void {
    this.#state = this.#snapshot();
    for (const listener of this.#listeners) listener();
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true; this.#active = false;
    for (const stop of this.#subscriptions.splice(0)) stop();
    this.#retireFlow(); this.#holder?.dispose(); this.#localities?.dispose();
    this.#holder = null; this.#localities = null; this.#model = null; this.#inputs = null;
    this.#pending = null; this.#message = null; this.#onCompleted = null; this.#loading = false;
    this.#runtime.administrativePropertyData.revokeLease(this.#lease);
    this.#publish(); this.#listeners.clear();
  }
}
