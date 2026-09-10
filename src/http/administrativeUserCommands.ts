import {
  ApiResponseError,
  InvalidApiRequestError,
  type BackendApi,
} from './backendApi';
import {
  AdministrativeCommandChangedError,
  AdministrativeCommandInFlightError,
  AdministrativeCommandPartitionChangedError,
  InvalidAdministrativeCommandError,
  type AdministrativeCommandCoordinator,
} from './administrativeCommandCoordinator';
import type {
  AdministrativeUserDataBoundary,
  AdministrativeUserReadLease,
} from './administrativeUserDataBoundary';
import {
  AdministrativeUserOperationCancelledError,
  type AdministrativeUserOperationContext,
} from './administrativeUserCommandLifecycle';
import type {
  AdministrativeReasonCode,
  AdministrativeReceipt,
  AdministrativeUserDetail,
  AdministrativeUserWritableProfile,
  ApiErrorDetailField,
  ChangeAdministrativeUserStatusPayload,
  CreateAdministrativeUserPayload,
  IssueAdministrativeUserInvitationPayload,
  PatchAdministrativeUserPayload,
} from './contracts';
import { InvalidBackendResponseError, isCanonicalUuidV4 } from './decoders';
import { ApiTransportError } from './httpTransport';
import {
  SessionRequiredError,
  type SessionCoordinator,
} from './sessionCoordinator';
import {
  AdministrativeUserAccessDeniedError,
  assertAdministrativeUserNavigationAccess,
} from './administrativeUserAccess';

const USER_TEXT_LIMITS = Object.freeze({
  nome: 200,
  email: 254,
  telefone: 32,
  documento: 64,
  observacoes: 2_000,
  motivo_detalhe: 300,
});

const REASON_CODES: readonly AdministrativeReasonCode[] = Object.freeze([
  'fim_relacao',
  'mudanca_responsabilidade',
  'cadastro_duplicado',
  'correcao_administrativa',
  'suspensao_operacional',
  'outro',
]);

const CREATE_FIELDS = Object.freeze([
  'nome',
  'email',
  'perfil',
  'telefone',
  'documento',
  'observacoes',
]);
const EDIT_FIELDS = Object.freeze([
  'nome',
  'email',
  'telefone',
  'documento',
  'observacoes',
]);
const STATUS_FIELDS = Object.freeze(['motivo', 'motivo_detalhe']);

function isAdministrativeReasonCode(
  value: unknown,
): value is AdministrativeReasonCode {
  return typeof value === 'string' && REASON_CODES.some(
    (reason) => reason === value,
  );
}

export type AdministrativeUserCommandAction =
  | 'create'
  | 'edit'
  | 'status'
  | 'invitation';

export interface AdministrativeUserCreateDraft {
  readonly nome: string;
  readonly email: string;
  readonly perfil: AdministrativeUserWritableProfile;
  readonly telefone?: string;
  readonly documento?: string;
  readonly observacoes?: string;
}

export interface AdministrativeUserEditDraft {
  readonly nome: string;
  readonly email: string;
  readonly telefone: string;
  readonly documento: string;
  readonly observacoes: string;
}

export type AdministrativeUserEditField = keyof AdministrativeUserEditDraft;

export interface AdministrativeUserFieldConflict {
  readonly serverValue: string;
  readonly operatorValue: string;
}

export interface AdministrativeUserEditModel {
  readonly userId: string;
  readonly baselineValues: AdministrativeUserEditDraft;
  readonly baselineVersion: number;
  readonly baselineStatus: AdministrativeUserDetail['status'];
  readonly draftValues: AdministrativeUserEditDraft;
  readonly dirtyFields: readonly AdministrativeUserEditField[];
  readonly fieldConflicts: Readonly<Partial<
    Record<AdministrativeUserEditField, AdministrativeUserFieldConflict>
  >>;
}

export interface AdministrativeUserStatusDraft {
  readonly motivo: AdministrativeReasonCode;
  readonly motivo_detalhe?: string;
}

export type AdministrativeUserCommandResult =
  | Readonly<{
      readonly kind: 'mutation_confirmed_and_reconciled';
      readonly receipt: AdministrativeReceipt;
      readonly user: AdministrativeUserDetail;
    }>
  | Readonly<{
      readonly kind: 'mutation_confirmed_reconciliation_failed';
      readonly receipt: AdministrativeReceipt;
      readonly expectedUserId: string;
      readonly minimumVersion: number;
      readonly error: unknown;
    }>;

export type AdministrativeUserCommandFailureKind =
  | 'invalid_request'
  | 'in_flight'
  | 'invalid_session'
  | 'forbidden'
  | 'not_found'
  | 'version_conflict_reloaded'
  | 'version_conflict_reload_failed'
  | 'idempotency_conflict'
  | 'business_rule_conflict_reloaded'
  | 'business_rule_conflict_reload_failed'
  | 'mutation_confirmed_reconciliation_failed'
  | 'validation_error'
  | 'ambiguous'
  | 'unexpected';

export interface AdministrativeUserCommandFailure {
  readonly kind: AdministrativeUserCommandFailureKind;
  readonly message: string;
  readonly fieldErrors: Readonly<Partial<Record<ApiErrorDetailField, string>>>;
  readonly retrySameIntent: boolean;
  readonly reviewRequired: boolean;
  readonly preserveDraft: boolean;
  readonly reloadRequired: boolean;
  readonly currentVersion?: number;
}

export class AdministrativeUserConflictError extends Error {
  readonly outcome:
    | 'version_conflict_reloaded'
    | 'version_conflict_reload_failed'
    | 'business_rule_conflict_reloaded'
    | 'business_rule_conflict_reload_failed';
  readonly original: ApiResponseError;
  readonly reloadedUser?: AdministrativeUserDetail;
  readonly reloadError?: unknown;

  constructor(input: Readonly<{
    outcome: AdministrativeUserConflictError['outcome'];
    original: ApiResponseError;
    reloadedUser?: AdministrativeUserDetail;
    reloadError?: unknown;
  }>) {
    super(input.outcome);
    this.name = 'AdministrativeUserConflictError';
    this.outcome = input.outcome;
    this.original = input.original;
    this.reloadedUser = input.reloadedUser;
    this.reloadError = input.reloadError;
  }
}

export class InvalidAdministrativeUserFormError extends Error {
  readonly fieldErrors: Readonly<Partial<Record<ApiErrorDetailField, string>>>;

  constructor(
    message: string,
    fieldErrors: Readonly<Partial<Record<ApiErrorDetailField, string>>> = {},
  ) {
    super(message);
    this.name = 'InvalidAdministrativeUserFormError';
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

function exactRecord(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new InvalidAdministrativeUserFormError('O formulário é inválido.');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    throw new InvalidAdministrativeUserFormError(
      'O formulário contém campos não permitidos.',
    );
  }
  const record: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, 'value') ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      throw new InvalidAdministrativeUserFormError('O formulário é inválido.');
    }
    record[key] = descriptor.value;
  }
  if (required.some((key) => !Object.hasOwn(record, key))) {
    throw new InvalidAdministrativeUserFormError(
      'Preencha todos os campos obrigatórios.',
    );
  }
  return Object.freeze(record);
}

function normalizedText(
  value: unknown,
  field: keyof typeof USER_TEXT_LIMITS,
  optional = false,
): string | undefined {
  if (typeof value !== 'string') {
    throw new InvalidAdministrativeUserFormError(
      `O campo ${field} é inválido.`,
      { [field]: 'Informe um valor textual válido.' },
    );
  }
  const normalized = value.normalize('NFC').trim();
  if (normalized.length === 0 && optional) return undefined;
  const length = Array.from(normalized).length;
  if (length === 0 || length > USER_TEXT_LIMITS[field]) {
    throw new InvalidAdministrativeUserFormError(
      `O campo ${field} é inválido.`,
      {
        [field]: length === 0
          ? 'Este campo é obrigatório.'
          : `Use no máximo ${USER_TEXT_LIMITS[field]} caracteres.`,
      },
    );
  }
  return normalized;
}

function normalizedEmail(value: unknown): string {
  const email = normalizedText(value, 'email');
  if (email === undefined) {
    throw new InvalidAdministrativeUserFormError(
      'O e-mail é obrigatório.',
      { email: 'Informe o e-mail.' },
    );
  }
  const normalized = email.toLowerCase().normalize('NFC');
  const at = normalized.indexOf('@');
  if (
    Array.from(normalized).length > USER_TEXT_LIMITS.email ||
    at <= 0 ||
    at !== normalized.lastIndexOf('@') ||
    normalized.endsWith('@') ||
    /\s/u.test(normalized)
  ) {
    throw new InvalidAdministrativeUserFormError(
      'O e-mail é inválido.',
      { email: 'Informe um e-mail válido.' },
    );
  }
  return normalized;
}

function positiveVersion(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new InvalidAdministrativeUserFormError(
      'A versão autoritativa do Usuário é inválida.',
      { versao: 'Recarregue o cadastro antes de continuar.' },
    );
  }
  return value;
}

function assertUserId(userId: string): void {
  if (!isCanonicalUuidV4(userId)) {
    throw new InvalidApiRequestError('O ID do Usuário é inválido.');
  }
}

export function buildCreateAdministrativeUserPayload(
  draft: unknown,
): CreateAdministrativeUserPayload & Readonly<Record<string, unknown>> {
  const input = exactRecord(draft, CREATE_FIELDS, ['nome', 'email', 'perfil']);
  if (input.perfil !== 'produtor' && input.perfil !== 'colaborador') {
    throw new InvalidAdministrativeUserFormError(
      'O perfil é inválido.',
      { perfil: 'Selecione Produtor ou Colaborador.' },
    );
  }
  const nome = normalizedText(input.nome, 'nome');
  if (nome === undefined) {
    throw new InvalidAdministrativeUserFormError('O nome é obrigatório.');
  }
  const telefone = normalizedText(input.telefone ?? '', 'telefone', true);
  const documento = normalizedText(input.documento ?? '', 'documento', true);
  const observacoes = normalizedText(
    input.observacoes ?? '',
    'observacoes',
    true,
  );
  return Object.freeze({
    nome,
    email: normalizedEmail(input.email),
    perfil: input.perfil,
    ...(telefone === undefined ? {} : { telefone }),
    ...(documento === undefined ? {} : { documento }),
    ...(observacoes === undefined ? {} : { observacoes }),
  });
}

function nullableDraftText(
  value: unknown,
  field: 'telefone' | 'documento' | 'observacoes',
): string | null {
  return normalizedText(value, field, true) ?? null;
}

const EDIT_FIELD_NAMES: readonly AdministrativeUserEditField[] = Object.freeze([
  'nome',
  'email',
  'telefone',
  'documento',
  'observacoes',
]);

function editValuesFromUser(
  user: AdministrativeUserDetail,
): AdministrativeUserEditDraft {
  return Object.freeze({
    nome: user.nome,
    email: user.email,
    telefone: user.telefone ?? '',
    documento: user.documento ?? '',
    observacoes: user.observacoes ?? '',
  });
}

export function createAdministrativeUserEditModel(
  user: AdministrativeUserDetail,
): AdministrativeUserEditModel {
  assertUserId(user.id);
  const values = editValuesFromUser(user);
  return Object.freeze({
    userId: user.id,
    baselineValues: values,
    baselineVersion: positiveVersion(user.versao),
    baselineStatus: user.status,
    draftValues: values,
    dirtyFields: Object.freeze([]),
    fieldConflicts: Object.freeze({}),
  });
}

export function updateAdministrativeUserEditField(
  model: AdministrativeUserEditModel,
  field: AdministrativeUserEditField,
  value: string,
): AdministrativeUserEditModel {
  if (!EDIT_FIELD_NAMES.includes(field) || typeof value !== 'string') {
    throw new InvalidAdministrativeUserFormError('O formulário é inválido.');
  }
  const draftValues = Object.freeze({ ...model.draftValues, [field]: value });
  const dirty = new Set(model.dirtyFields);
  if (value === model.baselineValues[field]) dirty.delete(field);
  else dirty.add(field);
  const conflicts = { ...model.fieldConflicts };
  delete conflicts[field];
  return Object.freeze({
    ...model,
    draftValues,
    dirtyFields: Object.freeze(EDIT_FIELD_NAMES.filter((name) => dirty.has(name))),
    fieldConflicts: Object.freeze(conflicts),
  });
}

export function rebaseAdministrativeUserEditModel(
  model: AdministrativeUserEditModel,
  user: AdministrativeUserDetail,
): AdministrativeUserEditModel {
  if (user.id !== model.userId || user.versao < model.baselineVersion) {
    throw new InvalidBackendResponseError();
  }
  const nextBaseline = editValuesFromUser(user);
  const nextDraft: Record<AdministrativeUserEditField, string> = {
    ...model.draftValues,
  };
  const nextDirty = new Set<AdministrativeUserEditField>();
  const conflicts: Partial<Record<
    AdministrativeUserEditField,
    AdministrativeUserFieldConflict
  >> = {};
  const dirty = new Set(model.dirtyFields);
  for (const field of EDIT_FIELD_NAMES) {
    const operatorValue = model.draftValues[field];
    const serverValue = nextBaseline[field];
    if (model.fieldConflicts[field] !== undefined) {
      // Outra leitura atualiza a opção autoritativa, mas não escolhe pelo operador.
      conflicts[field] = Object.freeze({ serverValue, operatorValue });
      if (operatorValue !== serverValue) nextDirty.add(field);
      continue;
    }
    if (!dirty.has(field)) {
      nextDraft[field] = serverValue;
      continue;
    }
    if (serverValue === model.baselineValues[field]) {
      if (operatorValue !== serverValue) nextDirty.add(field);
      continue;
    }
    if (operatorValue === serverValue) {
      nextDraft[field] = serverValue;
      continue;
    }
    nextDirty.add(field);
    conflicts[field] = Object.freeze({ serverValue, operatorValue });
  }
  return Object.freeze({
    userId: model.userId,
    baselineValues: nextBaseline,
    baselineVersion: positiveVersion(user.versao),
    baselineStatus: user.status,
    draftValues: Object.freeze(nextDraft),
    dirtyFields: Object.freeze(EDIT_FIELD_NAMES.filter((field) => nextDirty.has(field))),
    fieldConflicts: Object.freeze(conflicts),
  });
}

export function resolveAdministrativeUserEditConflict(
  model: AdministrativeUserEditModel,
  field: AdministrativeUserEditField,
  resolution: 'server' | 'operator',
): AdministrativeUserEditModel {
  const conflict = model.fieldConflicts[field];
  if (conflict === undefined) return model;
  const selected = resolution === 'server'
    ? conflict.serverValue
    : conflict.operatorValue;
  const conflicts = { ...model.fieldConflicts };
  delete conflicts[field];
  const dirty = new Set(model.dirtyFields);
  if (selected === model.baselineValues[field]) dirty.delete(field);
  else dirty.add(field);
  return Object.freeze({
    ...model,
    draftValues: Object.freeze({ ...model.draftValues, [field]: selected }),
    dirtyFields: Object.freeze(EDIT_FIELD_NAMES.filter((name) => dirty.has(name))),
    fieldConflicts: Object.freeze(conflicts),
  });
}

export function buildPatchAdministrativeUserPayload(
  model: AdministrativeUserEditModel,
): PatchAdministrativeUserPayload & Readonly<Record<string, unknown>> {
  assertUserId(model.userId);
  positiveVersion(model.baselineVersion);
  if (Object.keys(model.fieldConflicts).length > 0) {
    throw new InvalidAdministrativeUserFormError(
      'Resolva os conflitos de campo antes de continuar.',
    );
  }
  const dirty = new Set(model.dirtyFields);
  const payload: {
    versao: number;
    nome?: string;
    email?: string;
    telefone?: string | null;
    documento?: string | null;
    observacoes?: string | null;
  } = { versao: model.baselineVersion };
  for (const field of EDIT_FIELD_NAMES) {
    if (!dirty.has(field)) continue;
    if (field === 'nome') {
      const nome = normalizedText(model.draftValues.nome, 'nome');
      if (nome === undefined) {
        throw new InvalidAdministrativeUserFormError('O nome é obrigatório.');
      }
      payload.nome = nome;
    } else if (field === 'email') {
      if (model.baselineStatus !== 'pendente') {
        throw new InvalidAdministrativeUserFormError(
          'A conta já habilitada deve usar o fluxo verificado de troca de e-mail.',
          { email: 'Use o fluxo verificado da própria conta para alterar este e-mail.' },
        );
      }
      payload.email = normalizedEmail(model.draftValues.email);
    } else {
      payload[field] = nullableDraftText(model.draftValues[field], field);
    }
  }
  if (Object.keys(payload).length === 1) {
    throw new InvalidAdministrativeUserFormError(
      'Nenhuma alteração cadastral foi informada.',
    );
  }
  return Object.freeze(payload);
}

export function buildChangeAdministrativeUserStatusPayload(
  authoritative: AdministrativeUserDetail,
  draft: unknown,
): ChangeAdministrativeUserStatusPayload & Readonly<Record<string, unknown>> {
  assertUserId(authoritative.id);
  if (authoritative.status === 'pendente') {
    throw new InvalidAdministrativeUserFormError(
      'Usuário pendente não participa da alteração de status.',
      { status: 'Emita o convite para concluir a ativação.' },
    );
  }
  const input = exactRecord(draft, STATUS_FIELDS, ['motivo']);
  if (!isAdministrativeReasonCode(input.motivo)) {
    throw new InvalidAdministrativeUserFormError(
      'O motivo é inválido.',
      { motivo: 'Selecione um motivo válido.' },
    );
  }
  const motivo = input.motivo;
  const detail = normalizedText(
    input.motivo_detalhe ?? '',
    'motivo_detalhe',
    true,
  );
  if (motivo === 'outro' && detail === undefined) {
    throw new InvalidAdministrativeUserFormError(
      'Detalhe o motivo informado.',
      { motivo_detalhe: 'Explique o motivo em até 300 caracteres.' },
    );
  }
  return Object.freeze({
    versao: positiveVersion(authoritative.versao),
    status: authoritative.status === 'ativo' ? 'inativo' : 'ativo',
    motivo,
    ...(detail === undefined ? {} : { motivo_detalhe: detail }),
  });
}

export function buildIssueAdministrativeUserInvitationPayload(
  authoritative: AdministrativeUserDetail,
): IssueAdministrativeUserInvitationPayload & Readonly<Record<string, unknown>> {
  assertUserId(authoritative.id);
  if (authoritative.status !== 'pendente') {
    throw new InvalidAdministrativeUserFormError(
      'Somente Usuário pendente pode receber convite administrativo.',
      { status: 'Esta ação está disponível apenas enquanto o Usuário está pendente.' },
    );
  }
  return Object.freeze({ modo_ativacao: 'ativar_usuario' });
}

function allowedValidationFields(
  action: AdministrativeUserCommandAction,
): readonly ApiErrorDetailField[] {
  if (action === 'create') {
    return ['nome', 'email', 'perfil', 'telefone', 'documento', 'observacoes'];
  }
  if (action === 'edit') {
    return ['nome', 'email', 'telefone', 'documento', 'observacoes', 'versao'];
  }
  if (action === 'status') {
    return ['status', 'motivo', 'motivo_detalhe', 'versao'];
  }
  return ['modo_ativacao'];
}

function validationFieldMessage(field: ApiErrorDetailField): string {
  if (field === 'nome') return 'Revise o nome informado.';
  if (field === 'email') return 'Revise o e-mail informado.';
  if (field === 'perfil') return 'Selecione Produtor ou Colaborador.';
  if (field === 'telefone') return 'Revise o telefone informado.';
  if (field === 'documento') return 'Revise o documento informado.';
  if (field === 'observacoes') return 'Revise as observações informadas.';
  if (field === 'motivo') return 'Selecione um motivo válido.';
  if (field === 'motivo_detalhe') return 'Revise o detalhe do motivo.';
  if (field === 'versao') return 'Recarregue o cadastro antes de continuar.';
  if (field === 'status') return 'Esta transição de status não é permitida.';
  return 'Revise os dados desta ação.';
}

function mappedFieldErrors(
  action: AdministrativeUserCommandAction,
  error: ApiResponseError,
): Readonly<Partial<Record<ApiErrorDetailField, string>>> {
  const allowed = new Set(allowedValidationFields(action));
  const fields: Partial<Record<ApiErrorDetailField, string>> = {};
  for (const detail of error.details ?? []) {
    if (detail.field !== undefined && allowed.has(detail.field)) {
      fields[detail.field] = validationFieldMessage(detail.field);
    }
  }
  return Object.freeze(fields);
}

function businessConflictMessage(action: AdministrativeUserCommandAction): string {
  if (action === 'create') {
    return 'Não foi possível criar o Usuário. Revise se o e-mail já está cadastrado.';
  }
  if (action === 'edit') {
    return 'O cadastro não pode ser alterado neste estado.';
  }
  if (action === 'invitation') {
    return 'O convite não pode ser emitido no estado atual.';
  }
  return 'A alteração foi bloqueada para proteger a própria conta, o último Administrador, um Produtor Titular ou uma reativação sem credencial.';
}

function failure(
  kind: AdministrativeUserCommandFailureKind,
  message: string,
  options: Readonly<{
    fieldErrors?: Readonly<Partial<Record<ApiErrorDetailField, string>>>;
    retrySameIntent?: boolean;
    reviewRequired?: boolean;
    reloadRequired?: boolean;
    currentVersion?: number;
  }> = {},
): AdministrativeUserCommandFailure {
  return Object.freeze({
    kind,
    message,
    fieldErrors: options.fieldErrors ?? Object.freeze({}),
    retrySameIntent: options.retrySameIntent === true,
    reviewRequired: options.reviewRequired === true,
    reloadRequired: options.reloadRequired === true,
    preserveDraft: true,
    ...(options.currentVersion === undefined
      ? {}
      : { currentVersion: options.currentVersion }),
  });
}

export function classifyAdministrativeUserCommandFailure(
  action: AdministrativeUserCommandAction,
  error: unknown,
): AdministrativeUserCommandFailure {
  if (error instanceof AdministrativeUserConflictError) {
    const currentVersion = error.original.details?.find(
      (detail) => detail.current_version !== undefined,
    )?.current_version;
    if (error.outcome === 'version_conflict_reloaded') {
      return failure(
        error.outcome,
        'O cadastro foi alterado por outra operação. A versão atual foi carregada; revise os campos antes de confirmar novamente.',
        { currentVersion },
      );
    }
    if (error.outcome === 'version_conflict_reload_failed') {
      return failure(
        error.outcome,
        'O cadastro foi alterado, mas não foi possível carregar a versão atual. O rascunho foi preservado.',
        { reloadRequired: true, reviewRequired: true, currentVersion },
      );
    }
    if (error.outcome === 'business_rule_conflict_reloaded') {
      return failure(
        error.outcome,
        `${businessConflictMessage(action)} A versão atual foi carregada para revisão.`,
      );
    }
    return failure(
      error.outcome,
      `${businessConflictMessage(action)} Não foi possível carregar a versão atual; o rascunho foi preservado.`,
      { reloadRequired: true, reviewRequired: true },
    );
  }
  if (error instanceof InvalidAdministrativeUserFormError) {
    return failure('validation_error', error.message, {
      fieldErrors: error.fieldErrors,
    });
  }
  if (error instanceof AdministrativeCommandInFlightError) {
    return failure('in_flight', 'Esta ação já está em andamento.');
  }
  if (error instanceof AdministrativeUserAccessDeniedError) {
    return failure('forbidden', 'Você não possui permissão para esta ação.');
  }
  if (
    error instanceof SessionRequiredError ||
    error instanceof AdministrativeCommandPartitionChangedError ||
    (error instanceof ApiResponseError && error.status === 401)
  ) {
    return failure('invalid_session', 'Sua sessão não é mais válida. Entre novamente.');
  }
  if (error instanceof ApiResponseError) {
    if (error.status === 403) {
      return failure('forbidden', 'Você não possui permissão para esta ação.');
    }
    if (error.status === 404) {
      return failure('not_found', 'O Usuário não foi encontrado. A lista foi atualizada.');
    }
    if (error.status === 409 && error.code === 'version_conflict') {
      return failure(
        'version_conflict_reload_failed',
        'O cadastro foi alterado, mas a versão atual não foi carregada.',
        { reloadRequired: true, reviewRequired: true },
      );
    }
    if (error.status === 409 && error.code === 'idempotency_conflict') {
      return failure(
        'idempotency_conflict',
        'A intenção idempotente conflita com outro comando. Revise os dados antes de confirmar novamente.',
        { reviewRequired: true },
      );
    }
    if (error.status === 409 && error.code === 'business_rule_conflict') {
      return failure(
        'business_rule_conflict_reload_failed',
        `${businessConflictMessage(action)} A versão atual não foi carregada.`,
        { reloadRequired: true, reviewRequired: true },
      );
    }
    if (error.status === 422 && error.code === 'validation_error') {
      return failure('validation_error', 'Revise os campos indicados.', {
        fieldErrors: mappedFieldErrors(action, error),
      });
    }
    if (error.status === 400) {
      return failure('invalid_request', 'A solicitação é inválida e não será repetida automaticamente.');
    }
    if (error.status === 429 || error.status >= 500) {
      return failure(
        'ambiguous',
        'O resultado da operação não pôde ser confirmado. Tente novamente para reutilizar a mesma intenção.',
        { retrySameIntent: true },
      );
    }
  }
  if (error instanceof ApiTransportError || error instanceof InvalidBackendResponseError) {
    return failure(
      'ambiguous',
      'O resultado da operação não pôde ser confirmado. Tente novamente para reutilizar a mesma intenção.',
      { retrySameIntent: true },
    );
  }
  if (
    error instanceof InvalidApiRequestError ||
    error instanceof InvalidAdministrativeCommandError ||
    error instanceof AdministrativeCommandChangedError
  ) {
    return failure('invalid_request', error.message, {
      reviewRequired: error instanceof AdministrativeCommandChangedError,
    });
  }
  return failure('unexpected', 'Não foi possível concluir a ação administrativa.');
}

export function confirmedReconciliationFailure(
): AdministrativeUserCommandFailure {
  return failure(
    'mutation_confirmed_reconciliation_failed',
    'A operação foi confirmada pelo servidor, mas a atualização local não pôde ser concluída. Carregue novamente o estado autoritativo; o comando não será repetido.',
    { reloadRequired: true, reviewRequired: true },
  );
}

function assertOperationCurrent(
  context: AdministrativeUserOperationContext,
): void {
  if (!context.isCurrent()) {
    throw new AdministrativeUserOperationCancelledError();
  }
}

function correlatedReceiptVersion(
  receipt: AdministrativeReceipt,
  expectedTargetId: string,
): number {
  if (
    receipt.recurso_tipo !== 'usuario' ||
    !isCanonicalUuidV4(receipt.recurso_id) ||
    receipt.recurso_id !== expectedTargetId ||
    !('versao' in receipt) ||
    !Number.isSafeInteger(receipt.versao) ||
    receipt.versao < 1
  ) {
    throw new InvalidBackendResponseError();
  }
  return receipt.versao;
}

function assertCorrelatedAdministrativeUser(
  user: AdministrativeUserDetail,
  expectedUserId: string,
  minimumVersion: number,
): void {
  const hasProducer = user.produtor_id !== undefined;
  if (
    user.id !== expectedUserId ||
    user.versao < minimumVersion ||
    (user.perfil === 'produtor') !== hasProducer ||
    (hasProducer && !isCanonicalUuidV4(user.produtor_id ?? ''))
  ) {
    throw new InvalidBackendResponseError();
  }
}

export class AdministrativeUserCommandService {
  readonly #api: BackendApi;
  readonly #session: SessionCoordinator;
  readonly #coordinator: AdministrativeCommandCoordinator;
  readonly #boundary: AdministrativeUserDataBoundary;

  constructor(input: Readonly<{
    api: BackendApi;
    session: SessionCoordinator;
    coordinator: AdministrativeCommandCoordinator;
    boundary: AdministrativeUserDataBoundary;
  }>) {
    this.#api = input.api;
    this.#session = input.session;
    this.#coordinator = input.coordinator;
    this.#boundary = input.boundary;
  }

  discardIntent(intentId: string): boolean {
    return this.#coordinator.invalidateIntent(intentId);
  }

  create(
    intentId: string,
    draft: unknown,
    context: AdministrativeUserOperationContext,
  ): Promise<AdministrativeUserCommandResult> {
    assertAdministrativeUserNavigationAccess(this.#session.snapshot);
    const body = buildCreateAdministrativeUserPayload(draft);
    let createdUserId: string | undefined;
    return this.#execute({
      action: 'create',
      intentId,
      method: 'POST',
      route: '/v1/usuarios',
      body,
      context,
      targetUserId: () => createdUserId,
      mutate: async (accessToken, idempotencyKey, commandBody) => {
        const receipt = await this.#api.createAdministrativeUser(
          accessToken,
          idempotencyKey,
          commandBody,
        );
        createdUserId = receipt.recurso_id;
        return receipt;
      },
    });
  }

  update(
    intentId: string,
    authoritative: AdministrativeUserDetail,
    model: AdministrativeUserEditModel,
    context: AdministrativeUserOperationContext,
  ): Promise<AdministrativeUserCommandResult> {
    assertAdministrativeUserNavigationAccess(this.#session.snapshot);
    if (authoritative.id !== model.userId) throw new InvalidBackendResponseError();
    const body = buildPatchAdministrativeUserPayload(model);
    return this.#execute({
      action: 'edit',
      intentId,
      method: 'PATCH',
      route: `/v1/usuarios/${authoritative.id}`,
      body,
      context,
      targetUserId: () => authoritative.id,
      mutate: (accessToken, idempotencyKey, commandBody) => (
        this.#api.updateAdministrativeUser(
          accessToken,
          authoritative.id,
          idempotencyKey,
          commandBody,
        )
      ),
    });
  }

  changeStatus(
    intentId: string,
    authoritative: AdministrativeUserDetail,
    draft: unknown,
    context: AdministrativeUserOperationContext,
  ): Promise<AdministrativeUserCommandResult> {
    assertAdministrativeUserNavigationAccess(this.#session.snapshot);
    const body = buildChangeAdministrativeUserStatusPayload(authoritative, draft);
    return this.#execute({
      action: 'status',
      intentId,
      method: 'PATCH',
      route: `/v1/usuarios/${authoritative.id}/status`,
      body,
      context,
      targetUserId: () => authoritative.id,
      mutate: (accessToken, idempotencyKey, commandBody) => (
        this.#api.changeAdministrativeUserStatus(
          accessToken,
          authoritative.id,
          idempotencyKey,
          commandBody,
        )
      ),
    });
  }

  issueInvitation(
    intentId: string,
    authoritative: AdministrativeUserDetail,
    context: AdministrativeUserOperationContext,
  ): Promise<AdministrativeUserCommandResult> {
    assertAdministrativeUserNavigationAccess(this.#session.snapshot);
    const body = buildIssueAdministrativeUserInvitationPayload(authoritative);
    return this.#execute({
      action: 'invitation',
      intentId,
      method: 'POST',
      route: `/v1/usuarios/${authoritative.id}/convites`,
      body,
      context,
      targetUserId: () => authoritative.id,
      mutate: (accessToken, idempotencyKey, commandBody) => (
        this.#api.issueAdministrativeUserInvitation(
          accessToken,
          authoritative.id,
          idempotencyKey,
          commandBody,
        )
      ),
    });
  }

  async #execute(input: Readonly<{
    action: AdministrativeUserCommandAction;
    intentId: string;
    method: 'POST' | 'PATCH';
    route: string;
    body: Readonly<Record<string, unknown>>;
    context: AdministrativeUserOperationContext;
    targetUserId: () => string | undefined;
    mutate: (
      accessToken: string,
      idempotencyKey: string,
      body: Readonly<Record<string, unknown>>,
    ) => Promise<AdministrativeReceipt>;
  }>): Promise<AdministrativeUserCommandResult> {
    assertOperationCurrent(input.context);
    try {
      return await this.#coordinator.execute(
        {
          intentId: input.intentId,
          method: input.method,
          route: input.route,
          body: input.body,
        },
        async (accessToken, command) => {
          assertOperationCurrent(input.context);
          const receipt = await input.mutate(
            accessToken,
            command.idempotencyKey,
            command.body,
          );
          assertOperationCurrent(input.context);
          const userId = input.targetUserId();
          if (userId === undefined) throw new InvalidBackendResponseError();
          let minimumVersion = 1;
          try {
            minimumVersion = correlatedReceiptVersion(receipt, userId);
            input.context.confirmMutation();
            assertOperationCurrent(input.context);
            const user = await this.#api.getAdministrativeUser(
              accessToken,
              receipt.recurso_id,
            );
            assertOperationCurrent(input.context);
            assertCorrelatedAdministrativeUser(
              user,
              receipt.recurso_id,
              minimumVersion,
            );
            assertOperationCurrent(input.context);
            if (!this.#boundary.publishAuthoritativeUser(
              input.context.boundaryLease,
              user,
            )) {
              throw new AdministrativeUserOperationCancelledError();
            }
            return Object.freeze({
              kind: 'mutation_confirmed_and_reconciled' as const,
              receipt,
              user,
            });
          } catch (error) {
            if (error instanceof AdministrativeUserOperationCancelledError) {
              throw error;
            }
            assertOperationCurrent(input.context);
            this.#handleAccessFailure(error, input.context.boundaryLease);
            if (input.context.isCurrent()) {
              this.#boundary.invalidateReconciliation(input.context.boundaryLease);
            }
            return Object.freeze({
              kind: 'mutation_confirmed_reconciliation_failed' as const,
              receipt,
              expectedUserId: userId,
              minimumVersion,
              error,
            });
          }
        },
      );
    } catch (error) {
      const handled = await this.#handleFailure(
        input.action,
        error,
        input.targetUserId(),
        input.context,
      );
      throw handled;
    }
  }

  async #handleFailure(
    action: AdministrativeUserCommandAction,
    error: unknown,
    userId: string | undefined,
    context: AdministrativeUserOperationContext,
  ): Promise<unknown> {
    const lease = context.boundaryLease;
    if (
      error instanceof SessionRequiredError ||
      (error instanceof ApiResponseError && error.status === 401)
    ) {
      this.#invalidateAccessForCurrentPartition(lease, 'invalid_session');
      return error;
    }
    if (error instanceof ApiResponseError && error.status === 403) {
      if (!this.#boundary.isLeaseCurrent(lease)) return error;
      this.#invalidateAccessForCurrentPartition(lease, 'forbidden');
      void this.#session.revalidate().catch(() => {
        // A revalidação publica a identidade válida ou encerra a sessão.
      });
      return error;
    }
    if (
      userId !== undefined &&
      error instanceof ApiResponseError &&
      error.status === 404
    ) {
      this.#boundary.publishUserNotFound(lease, userId);
      return error;
    }
    if (
      userId !== undefined &&
      error instanceof ApiResponseError &&
      error.status === 409 &&
      (error.code === 'version_conflict' ||
        error.code === 'business_rule_conflict')
    ) {
      return this.#rereadAfterConflict(action, userId, error, context);
    }
    return error;
  }

  async #rereadAfterConflict(
    action: AdministrativeUserCommandAction,
    userId: string,
    original: ApiResponseError,
    context: AdministrativeUserOperationContext,
  ): Promise<AdministrativeUserConflictError | ApiResponseError> {
    if (action === 'create') return original;
    const lease = context.boundaryLease;
    try {
      assertOperationCurrent(context);
      const user = await this.#session.authenticated((accessToken) => (
        this.#api.getAdministrativeUser(accessToken, userId)
      ));
      assertOperationCurrent(context);
      if (user.id !== userId) throw new InvalidBackendResponseError();
      const reportedVersion = original.details?.find(
        (detail) => detail.current_version !== undefined,
      )?.current_version;
      assertCorrelatedAdministrativeUser(user, userId, reportedVersion ?? 1);
      assertOperationCurrent(context);
      if (!this.#boundary.publishAuthoritativeUser(lease, user)) {
        throw new AdministrativeUserOperationCancelledError();
      }
      return new AdministrativeUserConflictError({
        outcome: original.code === 'version_conflict'
          ? 'version_conflict_reloaded'
          : 'business_rule_conflict_reloaded',
        original,
        reloadedUser: user,
      });
    } catch (reloadError) {
      if (reloadError instanceof AdministrativeUserOperationCancelledError) {
        throw reloadError;
      }
      this.#handleAccessFailure(reloadError, lease);
      return new AdministrativeUserConflictError({
        outcome: original.code === 'version_conflict'
          ? 'version_conflict_reload_failed'
          : 'business_rule_conflict_reload_failed',
        original,
        reloadError,
      });
    }
  }

  async reloadAdministrativeUser(
    context: AdministrativeUserOperationContext,
    userId: string,
    minimumVersion = 1,
  ): Promise<AdministrativeUserDetail> {
    assertAdministrativeUserNavigationAccess(this.#session.snapshot);
    assertUserId(userId);
    assertOperationCurrent(context);
    try {
      const user = await this.#session.authenticated((accessToken) => (
        this.#api.getAdministrativeUser(accessToken, userId)
      ));
      assertOperationCurrent(context);
      assertCorrelatedAdministrativeUser(user, userId, minimumVersion);
      assertOperationCurrent(context);
      if (!this.#boundary.publishAuthoritativeUser(context.boundaryLease, user)) {
        throw new AdministrativeUserOperationCancelledError();
      }
      return user;
    } catch (error) {
      this.#handleAccessFailure(error, context.boundaryLease);
      throw error;
    }
  }

  #handleAccessFailure(
    error: unknown,
    lease: AdministrativeUserReadLease,
  ): void {
    if (
      error instanceof SessionRequiredError ||
      (error instanceof ApiResponseError && error.status === 401)
    ) {
      this.#invalidateAccessForCurrentPartition(lease, 'invalid_session');
    } else if (error instanceof ApiResponseError && error.status === 403) {
      this.#invalidateAccessForCurrentPartition(lease, 'forbidden');
    }
  }

  #invalidateAccessForCurrentPartition(
    lease: AdministrativeUserReadLease,
    reason: 'invalid_session' | 'forbidden',
  ): void {
    // A late failure must not borrow a lease from the resumed generation.
    this.#boundary.invalidateAccess(lease, reason);
  }
}
