import {
  ADMINISTRATION_LIMITS,
  ADMINISTRATIVE_COMMAND_TYPES,
  ADMINISTRATIVE_REASON_CODES,
  type AdministrativeCommandContext,
  type AdministrativeCommandType,
  type AdministrativeIdempotencyReceipt,
  type AdministrativeReason,
  type ApplyPropertyLinkDeltaCommand,
  type ChangeAdministrativePropertyStatusCommand,
  type ChangeAdministrativeUserStatusCommand,
  type CreateAdministrativePropertyCommand,
  type CreateAdministrativeUserCommand,
  type IssueAdministrativeInvitationCommand,
  type PropertyLinkDeltaItem,
  type UpdateAdministrativePropertyCommand,
  type UpdateAdministrativeUserCommand,
} from './contracts.js';

const SAFE_OPAQUE_IDENTIFIER = /^[A-Za-z0-9._:/-]{1,128}$/;
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IBGE_MUNICIPALITY_ID = /^[0-9]{7}$/;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60_000;

const CONTEXT_FIELDS = new Set([
  'organizationId',
  'actorUserId',
  'sessionId',
  'requestId',
  'correlationId',
  'idempotencyKey',
  'expectedVersion',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${field}: objeto obrigatório.`);
  return value;
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  field: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${field}.${key}: campo não permitido.`);
    }
  }
}

function requireCanonicalUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !CANONICAL_UUID.test(value)) {
    throw new TypeError(`${field}: UUID canônico inválido.`);
  }
  return value;
}

function requireSafeIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_OPAQUE_IDENTIFIER.test(value)) {
    throw new TypeError(`${field}: identificador opaco inválido.`);
  }
  return value;
}

function requirePositiveVersion(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new TypeError(`${field}: versão positiva obrigatória.`);
  }
  return Number(value);
}

function requireValidDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${field}: data válida obrigatória.`);
  }
  return value;
}

function requireTrimmedText(
  value: unknown,
  field: string,
  maximumLength: number,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new TypeError(`${field}: texto preenchido inválido.`);
  }
  return value;
}

function validateNullableText(
  value: unknown,
  field: string,
  maximumLength: number,
): void {
  if (value !== null) requireTrimmedText(value, field, maximumLength);
}

function requireEmail(value: unknown, field: string): string {
  const email = requireTrimmedText(value, field, ADMINISTRATION_LIMITS.email);
  const separator = email.indexOf('@');
  if (
    email !== email.trim() ||
    separator <= 0 ||
    separator >= email.length - 1
  ) {
    throw new TypeError(`${field}: e-mail inválido.`);
  }
  return email;
}

function requireMunicipalityId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !IBGE_MUNICIPALITY_ID.test(value)) {
    throw new TypeError(`${field}: código IBGE de Município inválido.`);
  }
  return value;
}

function validateOptionalArea(value: unknown, field: string): void {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new TypeError(`${field}: área positiva obrigatória.`);
  }
}

function assertDenseArray(value: readonly unknown[], field: string): void {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new TypeError(`${field}[${index}]: lista esparsa não permitida.`);
    }
  }
}

export function validateAdministrativeReason(
  value: unknown,
): asserts value is AdministrativeReason {
  const reason = requireRecord(value, 'reason');
  rejectUnknownFields(reason, new Set(['code', 'detail']), 'reason');
  if (
    typeof reason.code !== 'string' ||
    !ADMINISTRATIVE_REASON_CODES.some((code) => code === reason.code)
  ) {
    throw new TypeError('reason.code: motivo administrativo inválido.');
  }
  if (reason.detail !== undefined) {
    requireTrimmedText(
      reason.detail,
      'reason.detail',
      ADMINISTRATION_LIMITS.reasonDetail,
    );
  }
  if (reason.code === 'outro' && reason.detail === undefined) {
    throw new TypeError('reason.detail: obrigatório para o motivo outro.');
  }
}

export function validateAdministrativeCommandContext(
  value: unknown,
  options: Readonly<{
    expectedVersionRequired?: boolean;
    expectedVersion?: 'required' | 'optional' | 'forbidden';
  }> = {},
): asserts value is AdministrativeCommandContext {
  const context = requireRecord(value, 'context');
  rejectUnknownFields(context, CONTEXT_FIELDS, 'context');
  if (context.organizationId !== 'org_tche_fertilidade') {
    throw new TypeError('context.organizationId: organização inválida.');
  }
  requireCanonicalUuid(context.actorUserId, 'context.actorUserId');
  requireCanonicalUuid(context.sessionId, 'context.sessionId');
  requireSafeIdentifier(context.requestId, 'context.requestId');
  requireSafeIdentifier(context.correlationId, 'context.correlationId');
  requireSafeIdentifier(context.idempotencyKey, 'context.idempotencyKey');

  const expectedVersion =
    options.expectedVersion ??
    (options.expectedVersionRequired === true ? 'required' : 'optional');
  if (expectedVersion === 'required') {
    requirePositiveVersion(context.expectedVersion, 'context.expectedVersion');
  } else if (expectedVersion === 'forbidden') {
    if (context.expectedVersion !== undefined) {
      throw new TypeError(
        'context.expectedVersion: não permitido em comando de criação.',
      );
    }
  } else if (context.expectedVersion !== undefined) {
    requirePositiveVersion(context.expectedVersion, 'context.expectedVersion');
  }
}

export function validateCreateAdministrativeUserCommand(
  value: unknown,
): asserts value is CreateAdministrativeUserCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'name', 'email', 'profile', 'phone', 'document', 'notes']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'forbidden',
  });
  requireTrimmedText(command.name, 'command.name', ADMINISTRATION_LIMITS.userName);
  requireEmail(command.email, 'command.email');
  if (
    command.profile !== 'admin' &&
    command.profile !== 'colaborador' &&
    command.profile !== 'produtor'
  ) {
    throw new TypeError('command.profile: perfil inválido.');
  }
  if (command.phone !== undefined) {
    requireTrimmedText(command.phone, 'command.phone', ADMINISTRATION_LIMITS.phone);
  }
  if (command.document !== undefined) {
    requireTrimmedText(
      command.document,
      'command.document',
      ADMINISTRATION_LIMITS.document,
    );
  }
  if (command.notes !== undefined) {
    requireTrimmedText(command.notes, 'command.notes', ADMINISTRATION_LIMITS.notes);
  }
}

export function validateUpdateAdministrativeUserCommand(
  value: unknown,
): asserts value is UpdateAdministrativeUserCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'userId', 'name', 'email', 'phone', 'document', 'notes']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'required',
  });
  requireCanonicalUuid(command.userId, 'command.userId');
  const mutableFields = ['name', 'email', 'phone', 'document', 'notes'] as const;
  if (!mutableFields.some((field) => command[field] !== undefined)) {
    throw new TypeError('command: atualização de Usuário sem efeito.');
  }
  if (command.name !== undefined) {
    requireTrimmedText(command.name, 'command.name', ADMINISTRATION_LIMITS.userName);
  }
  if (command.email !== undefined) requireEmail(command.email, 'command.email');
  if (command.phone !== undefined) {
    validateNullableText(command.phone, 'command.phone', ADMINISTRATION_LIMITS.phone);
  }
  if (command.document !== undefined) {
    validateNullableText(
      command.document,
      'command.document',
      ADMINISTRATION_LIMITS.document,
    );
  }
  if (command.notes !== undefined) {
    validateNullableText(command.notes, 'command.notes', ADMINISTRATION_LIMITS.notes);
  }
}

export function validateChangeAdministrativeUserStatusCommand(
  value: unknown,
): asserts value is ChangeAdministrativeUserStatusCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'userId', 'status', 'reason']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'required',
  });
  requireCanonicalUuid(command.userId, 'command.userId');
  if (command.status !== 'ativo' && command.status !== 'inativo') {
    throw new TypeError('command.status: status de Usuário inválido.');
  }
  validateAdministrativeReason(command.reason);
}

export function validateIssueAdministrativeInvitationCommand(
  value: unknown,
): asserts value is IssueAdministrativeInvitationCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'userId', 'activationMode']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'forbidden',
  });
  requireCanonicalUuid(command.userId, 'command.userId');
  if (command.activationMode !== 'ativar_usuario') {
    throw new TypeError(
      'command.activationMode: novos convites usam ativar_usuario.',
    );
  }
}

function validateDeltaItem(
  value: unknown,
  field: string,
): asserts value is PropertyLinkDeltaItem {
  const item = requireRecord(value, field);
  rejectUnknownFields(item, new Set(['propertyId', 'accessType']), field);
  requireCanonicalUuid(item.propertyId, `${field}.propertyId`);
  if (
    item.accessType !== 'usuario_autorizado' &&
    item.accessType !== 'colaborador'
  ) {
    throw new TypeError(`${field}.accessType: tipo de acesso inválido.`);
  }
}

export function validatePropertyLinkDeltaCommand(
  value: unknown,
): asserts value is ApplyPropertyLinkDeltaCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'userId', 'add', 'remove', 'reason']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'required',
  });
  requireCanonicalUuid(command.userId, 'command.userId');
  if (!Array.isArray(command.add) || !Array.isArray(command.remove)) {
    throw new TypeError('command.add/remove: listas obrigatórias.');
  }
  assertDenseArray(command.add, 'command.add');
  assertDenseArray(command.remove, 'command.remove');
  if (command.add.length === 0 && command.remove.length === 0) {
    throw new TypeError('command: delta vazio.');
  }
  if (
    command.add.length + command.remove.length >
    ADMINISTRATION_LIMITS.linkIdsPerDelta
  ) {
    throw new TypeError('command: limite de vínculos por delta excedido.');
  }

  const added = new Set<string>();
  for (let index = 0; index < command.add.length; index += 1) {
    const item = command.add[index];
    validateDeltaItem(item, `command.add[${index}]`);
    if (added.has(item.propertyId)) {
      throw new TypeError('command.add: propriedade duplicada.');
    }
    added.add(item.propertyId);
  }
  const removed = new Set<string>();
  for (let index = 0; index < command.remove.length; index += 1) {
    const item = command.remove[index];
    validateDeltaItem(item, `command.remove[${index}]`);
    if (removed.has(item.propertyId)) {
      throw new TypeError('command.remove: propriedade duplicada.');
    }
    if (added.has(item.propertyId)) {
      throw new TypeError('command: propriedade presente em add e remove.');
    }
    removed.add(item.propertyId);
  }
  if (command.remove.length > 0) validateAdministrativeReason(command.reason);
  else if (command.reason !== undefined) validateAdministrativeReason(command.reason);
}

export function validateCreateAdministrativePropertyCommand(
  value: unknown,
): asserts value is CreateAdministrativePropertyCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set([
      'context',
      'name',
      'holderId',
      'municipalityId',
      'totalArea',
      'mainCrop',
      'status',
    ]),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'forbidden',
  });
  requireTrimmedText(
    command.name,
    'command.name',
    ADMINISTRATION_LIMITS.propertyName,
  );
  requireCanonicalUuid(command.holderId, 'command.holderId');
  requireMunicipalityId(command.municipalityId, 'command.municipalityId');
  if (command.totalArea !== undefined) {
    validateOptionalArea(command.totalArea, 'command.totalArea');
  }
  if (command.mainCrop !== undefined) {
    requireTrimmedText(
      command.mainCrop,
      'command.mainCrop',
      ADMINISTRATION_LIMITS.mainCrop,
    );
  }
  if (command.status !== 'ativa' && command.status !== 'inativa') {
    throw new TypeError('command.status: status de Propriedade inválido.');
  }
}

export function validateUpdateAdministrativePropertyCommand(
  value: unknown,
): asserts value is UpdateAdministrativePropertyCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set([
      'context',
      'propertyId',
      'name',
      'municipalityId',
      'totalArea',
      'mainCrop',
    ]),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'required',
  });
  requireCanonicalUuid(command.propertyId, 'command.propertyId');
  const mutableFields = [
    'name',
    'municipalityId',
    'totalArea',
    'mainCrop',
  ] as const;
  if (!mutableFields.some((field) => command[field] !== undefined)) {
    throw new TypeError('command: atualização de Propriedade sem efeito.');
  }
  if (command.name !== undefined) {
    requireTrimmedText(
      command.name,
      'command.name',
      ADMINISTRATION_LIMITS.propertyName,
    );
  }
  if (command.municipalityId !== undefined) {
    requireMunicipalityId(command.municipalityId, 'command.municipalityId');
  }
  if (command.totalArea !== undefined && command.totalArea !== null) {
    validateOptionalArea(command.totalArea, 'command.totalArea');
  }
  if (command.mainCrop !== undefined) {
    validateNullableText(
      command.mainCrop,
      'command.mainCrop',
      ADMINISTRATION_LIMITS.mainCrop,
    );
  }
}

export function validateChangeAdministrativePropertyStatusCommand(
  value: unknown,
): asserts value is ChangeAdministrativePropertyStatusCommand {
  const command = requireRecord(value, 'command');
  rejectUnknownFields(
    command,
    new Set(['context', 'propertyId', 'status', 'reason']),
    'command',
  );
  validateAdministrativeCommandContext(command.context, {
    expectedVersion: 'required',
  });
  requireCanonicalUuid(command.propertyId, 'command.propertyId');
  if (command.status !== 'ativa' && command.status !== 'inativa') {
    throw new TypeError('command.status: status de Propriedade inválido.');
  }
  validateAdministrativeReason(command.reason);
}

const RECEIPT_CONTRACT_BY_COMMAND: Readonly<
  Record<
    AdministrativeCommandType,
    Readonly<{
      resourceType: string;
      outcome: string;
      httpStatus: number;
      versionRequired: boolean;
    }>
  >
> = Object.freeze({
  'usuario.criar': {
    resourceType: 'usuario',
    outcome: 'criado',
    httpStatus: 201,
    versionRequired: true,
  },
  'usuario.atualizar': {
    resourceType: 'usuario',
    outcome: 'atualizado',
    httpStatus: 200,
    versionRequired: true,
  },
  'usuario.alterar_status': {
    resourceType: 'usuario',
    outcome: 'status_alterado',
    httpStatus: 200,
    versionRequired: true,
  },
  'usuario.alterar_vinculos': {
    resourceType: 'vinculo',
    outcome: 'vinculos_alterados',
    httpStatus: 200,
    versionRequired: true,
  },
  'usuario.emitir_convite': {
    resourceType: 'convite',
    outcome: 'convite_emitido',
    httpStatus: 201,
    versionRequired: false,
  },
  'propriedade.criar': {
    resourceType: 'propriedade',
    outcome: 'criado',
    httpStatus: 201,
    versionRequired: true,
  },
  'propriedade.atualizar': {
    resourceType: 'propriedade',
    outcome: 'atualizado',
    httpStatus: 200,
    versionRequired: true,
  },
  'propriedade.alterar_status': {
    resourceType: 'propriedade',
    outcome: 'status_alterado',
    httpStatus: 200,
    versionRequired: true,
  },
});

export function validateAdministrativeIdempotencyReceipt(
  value: unknown,
): asserts value is AdministrativeIdempotencyReceipt {
  const envelope = requireRecord(value, 'idempotencyReceipt');
  rejectUnknownFields(
    envelope,
    new Set([
      'command',
      'state',
      'sessionId',
      'requestId',
      'correlationId',
      'httpStatus',
      'receipt',
      'createdAt',
      'expiresAt',
    ]),
    'idempotencyReceipt',
  );
  if (
    typeof envelope.command !== 'string' ||
    !ADMINISTRATIVE_COMMAND_TYPES.some(
      (command) => command === envelope.command,
    )
  ) {
    throw new TypeError('idempotencyReceipt.command: comando inválido.');
  }
  const command = envelope.command as AdministrativeCommandType;
  requireCanonicalUuid(envelope.sessionId, 'idempotencyReceipt.sessionId');
  requireSafeIdentifier(envelope.requestId, 'idempotencyReceipt.requestId');
  requireSafeIdentifier(
    envelope.correlationId,
    'idempotencyReceipt.correlationId',
  );
  const createdAt = requireValidDate(
    envelope.createdAt,
    'idempotencyReceipt.createdAt',
  );
  const expiresAt = requireValidDate(
    envelope.expiresAt,
    'idempotencyReceipt.expiresAt',
  );
  if (expiresAt.getTime() - createdAt.getTime() !== NINETY_DAYS_MS) {
    throw new TypeError('idempotencyReceipt: retenção deve ser de 90 dias.');
  }

  if (envelope.state === 'processando') {
    if (envelope.httpStatus !== undefined || envelope.receipt !== undefined) {
      throw new TypeError('idempotencyReceipt: processamento não possui recibo.');
    }
    return;
  }
  if (envelope.state !== 'concluido') {
    throw new TypeError('idempotencyReceipt.state: estado inválido.');
  }
  const contract = RECEIPT_CONTRACT_BY_COMMAND[command];
  if (envelope.httpStatus !== contract.httpStatus) {
    throw new TypeError('idempotencyReceipt.httpStatus: status incoerente.');
  }
  const receipt = requireRecord(envelope.receipt, 'idempotencyReceipt.receipt');
  rejectUnknownFields(
    receipt,
    new Set(['outcome', 'resourceType', 'resourceId', 'version']),
    'idempotencyReceipt.receipt',
  );
  if (receipt.resourceType !== contract.resourceType) {
    throw new TypeError('idempotencyReceipt.receipt: recurso incoerente.');
  }
  if (receipt.outcome !== contract.outcome) {
    throw new TypeError('idempotencyReceipt.receipt: resultado incoerente.');
  }
  requireCanonicalUuid(
    receipt.resourceId,
    'idempotencyReceipt.receipt.resourceId',
  );
  if (contract.versionRequired) {
    requirePositiveVersion(receipt.version, 'idempotencyReceipt.receipt.version');
  } else if (receipt.version !== undefined) {
    throw new TypeError(
      'idempotencyReceipt.receipt.version: não permitida para convite.',
    );
  }
}
