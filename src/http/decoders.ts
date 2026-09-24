import { normalizeAdministrativeAreaTotal } from './administrativeArea';
import type {
  AdministrativeUserPropertyPage,
  AdministrativeUserPropertyRelation,
  AdministrativeUserPropertyReceipt,
  AcceptedResponse,
  AdministrativePropertyProjection,
  AdministrativePropertyPage,
  AdministrativePropertyReceipt,
  AdministrativeReceipt,
  AdministrativeUserCreatedReceipt,
  AdministrativeUserDetail,
  AdministrativeUserInvitationIssuedReceipt,
  AdministrativeUserInvitationCommandReceipt,
  AdministrativeUserListItem,
  AdministrativeUserPage,
  AdministrativeUserStatusChangedReceipt,
  AdministrativeUserUpdatedReceipt,
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorDetailCode,
  ApiErrorDetailField,
  ApiErrorPayload,
  HttpScope,
  HttpProfile,
  HttpSessionIdentity,
  HttpUser,
  HttpUserStatus,
  LocalityUf,
  LocalityUfCollection,
  LocalityMunicipalityPage,
  NotificationDestination,
  NotificationDiscardResult,
  NotificationPage,
  NotificationProjection,
  NotificationReadAllResult,
  NotificationReadResult,
  NotificationUnreadCount,
  PropertyPage,
  PropertyProjection,
  RemoteSessionProjection,
  RestrictedTokenResponse,
  TokenResponse,
} from './contracts';

export function decodeAdministrativeUserPropertyPage(value: unknown, userId: string, limit = 50): AdministrativeUserPropertyPage {
  const page = record(value);
  exactKeys(page, ['usuario_id', 'versao', 'itens', 'paginacao']);
  if (uuidV4(page.usuario_id) !== userId || !Array.isArray(page.itens) || page.itens.length > limit) throw new InvalidBackendResponseError();
  const ids = new Set<string>();
  const items = page.itens.map((value): AdministrativeUserPropertyRelation => {
    const item = record(value);
    exactKeys(item, ['id', 'propriedade_id', 'propriedade_nome', 'propriedade_status', 'origem_acesso',
      'tipo_vinculo', 'status_vinculo', 'editavel', 'versao_vinculo', 'motivo', 'criado_em', 'atualizado_em']);
    const id = uuidV4(item.id);
    if (ids.has(id)) throw new InvalidBackendResponseError();
    ids.add(id);
    const origin = oneOf(item.origem_acesso, ['titularidade', 'vinculo_direto'] as const);
    const type = oneOf(item.tipo_vinculo, ['titular', 'usuario_autorizado', 'colaborador'] as const);
    const status = item.status_vinculo === null ? null : oneOf(item.status_vinculo, ['ativo', 'inativo'] as const);
    const version = item.versao_vinculo === null ? null : positiveInteger(item.versao_vinculo);
    let reason = null;
    if (item.motivo !== null) {
      const input = record(item.motivo); exactKeys(input, ['codigo', 'detalhe']);
      // Historical projected reasons may retain their original detail text.
      reason = Object.freeze({ codigo: requiredString(input.codigo), detalhe: input.detalhe === null ? null : requiredString(input.detalhe) });
    }
    const created = item.criado_em === null ? null : decodeTimestamp(item.criado_em);
    const updated = item.atualizado_em === null ? null : decodeTimestamp(item.atualizado_em);
    const propertyId = uuidV4(item.propriedade_id);
    if (origin === 'titularidade'
      ? type !== 'titular' || item.editavel !== false || status !== null || version !== null || reason !== null || created !== null || updated !== null || id !== propertyId
      : type === 'titular' || item.editavel !== true || status === null || version === null || created === null || updated === null) throw new InvalidBackendResponseError();
    return Object.freeze({ id, propriedade_id: propertyId, propriedade_nome: boundedString(item.propriedade_nome, 200),
      propriedade_status: oneOf(item.propriedade_status, ['ativa', 'inativa'] as const), origem_acesso: origin,
      tipo_vinculo: type, status_vinculo: status, editavel: item.editavel as boolean, versao_vinculo: version,
      motivo: reason, criado_em: created, atualizado_em: updated });
  });
  const pagination = record(page.paginacao); exactKeys(pagination, ['proximo_cursor']);
  const cursor = pagination.proximo_cursor === null ? null : requiredString(pagination.proximo_cursor);
  if (cursor !== null && (cursor.length > 2048 || items.length === 0)) throw new InvalidBackendResponseError();
  return Object.freeze({ usuario_id: userId, versao: positiveInteger(page.versao), itens: Object.freeze(items),
    paginacao: Object.freeze({ proximo_cursor: cursor }) });
}

export function decodeAdministrativeUserPropertyReceipt(value: unknown, userId: string, baseVersion: number): AdministrativeUserPropertyReceipt {
  const receipt = decodeAdministrativeReceipt(value);
  if (receipt.resultado !== 'vinculos_alterados' || receipt.recurso_id !== userId || receipt.versao <= baseVersion) throw new InvalidBackendResponseError();
  return receipt;
}

export class InvalidBackendResponseError extends Error {
  constructor() {
    super('A resposta do serviço é inválida. Tente novamente mais tarde.');
    this.name = 'InvalidBackendResponseError';
  }
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_REQUEST_ID_PATTERN =
  /^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const ADMINISTRATIVE_CURSOR_MAX_LENGTH = 2_048;

const API_ERROR_DETAIL_FIELDS = [
  'nome',
  'email',
  'perfil',
  'telefone',
  'documento',
  'observacoes',
  'versao',
  'status',
  'motivo',
  'motivo_detalhe',
  'modo_ativacao',
  'titular_id',
  'municipio_id',
  'area_total',
  'cultura_principal',
  'adicionar',
  'remover',
  'busca',
  'limite',
  'cursor',
  'uf_id',
  'tipo_acesso',
  'status_vinculo',
] as const satisfies readonly ApiErrorDetailField[];

const API_ERROR_DETAIL_CODES = [
  'required',
  'invalid',
  'unsupported',
  'out_of_range',
  'too_short',
  'too_long',
  'duplicate',
  'conflict',
] as const satisfies readonly ApiErrorDetailCode[];

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidBackendResponseError();
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const keys = Object.keys(value);
  if (
    keys.length !== allowed.length ||
    keys.some((key) => !allowed.includes(key))
  ) {
    throw new InvalidBackendResponseError();
  }
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidBackendResponseError();
  }
  return value;
}

function requiredInteger(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw new InvalidBackendResponseError();
  return value as number;
}

function positiveInteger(value: unknown): number {
  const decoded = requiredInteger(value);
  if (decoded < 1) throw new InvalidBackendResponseError();
  return decoded;
}

function boundedString(value: unknown, maximumLength: number): string {
  const decoded = requiredString(value);
  if (
    [...decoded].length > maximumLength ||
    decoded.normalize('NFC') !== decoded
  ) {
    throw new InvalidBackendResponseError();
  }
  return decoded;
}

function nullableBoundedString(
  value: unknown,
  maximumLength: number,
): string | null {
  return value === null ? null : boundedString(value, maximumLength);
}

function nonNegativeInteger(value: unknown): number {
  const decoded = requiredInteger(value);
  if (decoded < 0) throw new InvalidBackendResponseError();
  return decoded;
}

export function isCanonicalUuidV4(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length === 36 &&
    UUID_V4_PATTERN.test(value);
}

function uuidV4(value: unknown): string {
  const decoded = requiredString(value);
  if (!isCanonicalUuidV4(decoded)) throw new InvalidBackendResponseError();
  return decoded;
}

function dateTime(value: unknown): string {
  const decoded = requiredString(value);
  if (!Number.isFinite(Date.parse(decoded))) {
    throw new InvalidBackendResponseError();
  }
  return decoded;
}

export function decodeTimestamp(value: unknown): string {
  const decoded = requiredString(value);
  const match = ISO_UTC_TIMESTAMP_PATTERN.exec(decoded);
  if (match === null) {
    throw new InvalidBackendResponseError();
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new InvalidBackendResponseError();
  }
  return decoded;
}

export function decodePositiveVersion(value: unknown): number {
  return positiveInteger(value);
}

export function decodeOpaqueCursor(
  value: unknown,
  maximumLength = ADMINISTRATIVE_CURSOR_MAX_LENGTH,
): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    throw new InvalidBackendResponseError();
  }
  return value;
}

export function decodeAdministrativeUserProfile(value: unknown): HttpProfile {
  return oneOf(value, ['admin', 'colaborador', 'produtor'] as const);
}

export function decodeAdministrativeUserStatus(
  value: unknown,
): HttpUserStatus {
  return oneOf(value, ['pendente', 'ativo', 'inativo'] as const);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new InvalidBackendResponseError();
  }
  return value as T;
}

function token(value: unknown): string {
  const decoded = requiredString(value);
  if (!TOKEN_PATTERN.test(decoded)) throw new InvalidBackendResponseError();
  return decoded;
}

export function decodeHttpUser(value: unknown): HttpUser {
  const input = record(value);
  return {
    id: uuidV4(input.id),
    organizacao_id: requiredString(input.organizacao_id),
    nome: requiredString(input.nome),
    email: requiredString(input.email),
    perfil: oneOf(input.perfil, ['admin', 'colaborador', 'produtor'] as const),
    status: oneOf(input.status, ['pendente', 'ativo', 'inativo'] as const),
    versao_autorizacao: positiveInteger(input.versao_autorizacao),
  };
}

export function decodeHttpScope(value: unknown): HttpScope {
  const input = record(value);
  return {
    modo: oneOf(input.modo, ['organizacao', 'vinculos_propriedade'] as const),
    versao: positiveInteger(input.versao),
  };
}

function decodeSessionId(value: unknown): string {
  return uuidV4(record(value).id);
}

function assertIdentityConsistency(user: HttpUser, scope: HttpScope): void {
  if (
    scope.versao !== user.versao_autorizacao ||
    (user.perfil === 'admin' && scope.modo !== 'organizacao') ||
    (user.perfil !== 'admin' && scope.modo !== 'vinculos_propriedade')
  ) {
    throw new InvalidBackendResponseError();
  }
}

export function decodeTokenResponse(value: unknown): TokenResponse {
  const input = record(value);
  const expiresIn = positiveInteger(input.expires_in);
  const issuedAt = dateTime(input.emitido_em);
  const accessExpiresAt = dateTime(input.access_expira_em);
  const session = record(input.sessao);
  const inactivityExpiresAt = dateTime(session.expira_inatividade_em);
  const absoluteExpiresAt = dateTime(session.expira_absolutamente_em);
  if (
    Date.parse(accessExpiresAt) <= Date.parse(issuedAt) ||
    Date.parse(inactivityExpiresAt) <= Date.parse(issuedAt) ||
    Date.parse(absoluteExpiresAt) <= Date.parse(issuedAt) ||
    Date.parse(inactivityExpiresAt) > Date.parse(absoluteExpiresAt) ||
    Date.parse(accessExpiresAt) > Date.parse(absoluteExpiresAt)
  ) {
    throw new InvalidBackendResponseError();
  }
  const user = decodeHttpUser(input.usuario);
  const scope = decodeHttpScope(input.escopo);
  assertIdentityConsistency(user, scope);
  return {
    access_token: token(input.access_token),
    refresh_token: token(input.refresh_token),
    token_type: oneOf(input.token_type, ['Bearer'] as const),
    expires_in: expiresIn,
    emitido_em: issuedAt,
    access_expira_em: accessExpiresAt,
    sessao_expira_inatividade_em: inactivityExpiresAt,
    sessao_expira_absolutamente_em: absoluteExpiresAt,
    id: decodeSessionId(session),
    usuario: user,
    escopo: scope,
  };
}

export function decodeSessionIdentity(value: unknown): HttpSessionIdentity {
  const input = record(value);
  const user = decodeHttpUser(input.usuario);
  const scope = decodeHttpScope(input.escopo);
  assertIdentityConsistency(user, scope);
  return {
    id: decodeSessionId(input.sessao),
    usuario: user,
    escopo: scope,
  };
}

export function decodeApiError(
  value: unknown,
  allowedCodes: readonly ApiErrorCode[],
): ApiErrorPayload {
  const envelope = record(value);
  const input = record(envelope.error);
  const code = oneOf(input.code, allowedCodes);
  const requestId = typeof input.request_id === 'string' &&
      SAFE_REQUEST_ID_PATTERN.test(input.request_id)
    ? input.request_id
    : undefined;
  const details = decodeApiErrorDetails(code, input.details);
  return {
    code,
    ...(requestId === undefined ? {} : { request_id: requestId }),
    ...(details === undefined ? {} : { details }),
  };
}

function decodeApiErrorDetails(
  code: ApiErrorCode,
  value: unknown,
): readonly ApiErrorDetail[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const details = value
    .map((item) => decodeApiErrorDetail(code, item))
    .filter((item): item is ApiErrorDetail => item !== undefined);
  return details.length === 0 ? undefined : Object.freeze(details);
}

function decodeApiErrorDetail(
  code: ApiErrorCode,
  value: unknown,
): ApiErrorDetail | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (code === 'version_conflict') {
    const currentVersion = input.current_version;
    if (
      typeof currentVersion !== 'number' ||
      !Number.isSafeInteger(currentVersion) ||
      currentVersion < 1
    ) {
      return undefined;
    }
    return Object.freeze({ current_version: currentVersion });
  }
  if (
    code !== 'invalid_request' &&
    code !== 'invalid_semantics' &&
    code !== 'validation_error' &&
    code !== 'password_policy_violation'
  ) {
    return undefined;
  }
  const field = typeof input.field === 'string' &&
      API_ERROR_DETAIL_FIELDS.includes(input.field as ApiErrorDetailField)
    ? input.field as ApiErrorDetailField
    : undefined;
  const detailCode = typeof input.code === 'string' &&
      API_ERROR_DETAIL_CODES.includes(input.code as ApiErrorDetailCode)
    ? input.code as ApiErrorDetailCode
    : undefined;
  if (field === undefined && detailCode === undefined) return undefined;
  return Object.freeze({
    ...(field === undefined ? {} : { field }),
    ...(detailCode === undefined ? {} : { code: detailCode }),
  });
}

export function decodeAdministrativeReceipt(
  value: unknown,
): AdministrativeReceipt {
  const input = record(value);
  const outcome = oneOf(input.resultado, [
    'criado',
    'atualizado',
    'status_alterado',
    'vinculos_alterados',
    'convite_emitido',
  ] as const);
  const resourceId = uuidV4(input.recurso_id);

  if (outcome === 'convite_emitido') {
    exactKeys(input, ['resultado', 'recurso_tipo', 'recurso_id']);
    return {
      resultado: outcome,
      recurso_tipo: oneOf(input.recurso_tipo, ['convite'] as const),
      recurso_id: resourceId,
    };
  }

  exactKeys(input, ['resultado', 'recurso_tipo', 'recurso_id', 'versao']);
  const version = positiveInteger(input.versao);
  if (outcome === 'vinculos_alterados') {
    return {
      resultado: outcome,
      recurso_tipo: oneOf(input.recurso_tipo, ['vinculo'] as const),
      recurso_id: resourceId,
      versao: version,
    };
  }
  return {
    resultado: outcome,
    recurso_tipo: oneOf(input.recurso_tipo, ['usuario', 'propriedade'] as const),
    recurso_id: resourceId,
    versao: version,
  };
}

export function decodeAdministrativeUserCreatedReceipt(
  value: unknown,
): AdministrativeUserCreatedReceipt {
  const receipt = decodeAdministrativeReceipt(value);
  if (
    receipt.resultado !== 'criado' ||
    receipt.recurso_tipo !== 'usuario'
  ) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    resultado: 'criado',
    recurso_tipo: 'usuario',
    recurso_id: receipt.recurso_id,
    versao: receipt.versao,
  });
}

export function decodeAdministrativeUserUpdatedReceipt(
  value: unknown,
): AdministrativeUserUpdatedReceipt {
  const receipt = decodeAdministrativeReceipt(value);
  if (
    receipt.resultado !== 'atualizado' ||
    receipt.recurso_tipo !== 'usuario'
  ) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    resultado: 'atualizado',
    recurso_tipo: 'usuario',
    recurso_id: receipt.recurso_id,
    versao: receipt.versao,
  });
}

export function decodeAdministrativeUserStatusChangedReceipt(
  value: unknown,
): AdministrativeUserStatusChangedReceipt {
  const receipt = decodeAdministrativeReceipt(value);
  if (
    receipt.resultado !== 'status_alterado' ||
    receipt.recurso_tipo !== 'usuario'
  ) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    resultado: 'status_alterado',
    recurso_tipo: 'usuario',
    recurso_id: receipt.recurso_id,
    versao: receipt.versao,
  });
}

export function decodeAdministrativeUserInvitationIssuedReceipt(
  value: unknown,
): AdministrativeUserInvitationIssuedReceipt {
  const receipt = decodeAdministrativeReceipt(value);
  if (
    receipt.resultado !== 'convite_emitido' ||
    receipt.recurso_tipo !== 'convite'
  ) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    resultado: 'convite_emitido',
    recurso_tipo: 'convite',
    recurso_id: receipt.recurso_id,
  });
}

export function decodeAdministrativeUserInvitationCommandReceipt(
  value: unknown,
): AdministrativeUserInvitationCommandReceipt {
  const input = record(value);
  exactKeys(input, ['resultado', 'recurso_tipo', 'recurso_id', 'versao']);
  return Object.freeze({
    resultado: oneOf(input.resultado, ['convite_emitido'] as const),
    recurso_tipo: oneOf(input.recurso_tipo, ['usuario'] as const),
    recurso_id: uuidV4(input.recurso_id),
    versao: positiveInteger(input.versao),
  });
}

const ADMINISTRATIVE_USER_REQUIRED_KEYS = [
  'id',
  'organizacao_id',
  'produtor_id',
  'nome',
  'email',
  'perfil',
  'status',
  'telefone',
  'documento',
  'observacoes',
  'versao',
  'criado_em',
  'atualizado_em',
] as const;

function decodeAdministrativeUserWire(value: unknown): AdministrativeUserDetail {
  const input = record(value);
  exactKeys(input, ADMINISTRATIVE_USER_REQUIRED_KEYS);
  const profile = decodeAdministrativeUserProfile(input.perfil);
  const producerValue = input.produtor_id;
  const producerId = producerValue === null
    ? undefined
    : uuidV4(producerValue);
  if ((producerId !== undefined) !== (profile === 'produtor')) {
    throw new InvalidBackendResponseError();
  }
  const createdAt = decodeTimestamp(input.criado_em);
  const updatedAt = decodeTimestamp(input.atualizado_em);
  if (updatedAt < createdAt) throw new InvalidBackendResponseError();

  return Object.freeze({
    id: uuidV4(input.id),
    organizacao_id: oneOf(
      input.organizacao_id,
      ['org_tche_fertilidade'] as const,
    ),
    nome: boundedString(input.nome, 200),
    email: boundedString(input.email, 254),
    perfil: profile,
    status: decodeAdministrativeUserStatus(input.status),
    telefone: nullableBoundedString(input.telefone, 32),
    documento: nullableBoundedString(input.documento, 64),
    observacoes: nullableBoundedString(input.observacoes, 2_000),
    versao: decodePositiveVersion(input.versao),
    criado_em: createdAt,
    atualizado_em: updatedAt,
    ...(producerId === undefined ? {} : { produtor_id: producerId }),
  });
}

export function decodeAdministrativeUserListItem(
  value: unknown,
): AdministrativeUserListItem {
  const user = decodeAdministrativeUserWire(value);
  return Object.freeze({
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    status: user.status,
    versao: user.versao,
    ...(user.produtor_id === undefined
      ? {}
      : { produtor_id: user.produtor_id }),
  });
}

export function decodeAdministrativeUserDetail(
  value: unknown,
): AdministrativeUserDetail {
  return decodeAdministrativeUserWire(value);
}

export function decodeAdministrativeUserPage(
  value: unknown,
  maximumItems = 100,
): AdministrativeUserPage {
  if (
    !Number.isInteger(maximumItems) ||
    maximumItems < 1 ||
    maximumItems > 100
  ) {
    throw new InvalidBackendResponseError();
  }
  const input = record(value);
  exactKeys(input, ['itens', 'paginacao']);
  if (!Array.isArray(input.itens)) throw new InvalidBackendResponseError();
  if (input.itens.length > maximumItems) throw new InvalidBackendResponseError();
  const pagination = record(input.paginacao);
  exactKeys(pagination, ['proximo_cursor']);
  const items = Object.freeze(input.itens.map(decodeAdministrativeUserListItem));
  const nextCursor = decodeOpaqueCursor(pagination.proximo_cursor);
  if (items.length === 0 && nextCursor !== null) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    itens: items,
    paginacao: Object.freeze({ proximo_cursor: nextCursor }),
  });
}

export function decodeProperty(value: unknown): PropertyProjection {
  const input = record(value);
  const owner = record(input.titular);
  const area = input.area_total;
  const crop = input.cultura_principal;
  const ownerId = uuidV4(owner.id);
  const titularId = uuidV4(input.titular_id);
  if (ownerId !== titularId) throw new InvalidBackendResponseError();
  if (
    area !== null &&
    (typeof area !== 'number' || !Number.isFinite(area) || area <= 0)
  ) {
    throw new InvalidBackendResponseError();
  }
  if (crop !== null && (typeof crop !== 'string' || crop.length === 0)) {
    throw new InvalidBackendResponseError();
  }
  return {
    id: uuidV4(input.id),
    organizacao_id: requiredString(input.organizacao_id),
    titular_id: titularId,
    titular: {
      id: ownerId,
      nome: requiredString(owner.nome),
    },
    nome: requiredString(input.nome),
    municipio_id: requiredString(input.municipio_id),
    municipio_nome: requiredString(input.municipio_nome),
    uf_id: requiredString(input.uf_id),
    uf_sigla: oneOf(input.uf_sigla, [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT',
      'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO',
      'RR', 'SC', 'SP', 'SE', 'TO',
    ] as const),
    area_total: area as number | null,
    cultura_principal: crop as string | null,
    status: oneOf(input.status, ['ativa', 'inativa'] as const),
    tipo_acesso: oneOf(input.tipo_acesso, [
      'admin',
      'titular',
      'usuario_autorizado',
      'colaborador',
    ] as const),
  };
}

export function decodeAdministrativeProperty(
  value: unknown,
): AdministrativePropertyProjection {
  const input = record(value);
  exactKeys(input, [
    'id',
    'organizacao_id',
    'titular_id',
    'titular',
    'nome',
    'municipio_id',
    'municipio_nome',
    'uf_id',
    'uf_sigla',
    'area_total',
    'area_total_decimal',
    'cultura_principal',
    'status',
    'tipo_acesso',
    'versao',
    'criado_em',
    'atualizado_em',
  ]);
  exactKeys(record(input.titular), ['id', 'nome']);
  const property = decodeProperty(input);
  let areaDecimal: AdministrativePropertyProjection['area_total_decimal'];
  try {
    areaDecimal = input.area_total_decimal === null
      ? null
      : normalizeAdministrativeAreaTotal(input.area_total_decimal);
  } catch {
    throw new InvalidBackendResponseError();
  }
  if ((property.area_total === null) !== (areaDecimal === null)) {
    throw new InvalidBackendResponseError();
  }
  const createdAt = decodeTimestamp(input.criado_em);
  const updatedAt = decodeTimestamp(input.atualizado_em);
  if (updatedAt < createdAt || createdAt.length !== 24 || updatedAt.length !== 24) {
    throw new InvalidBackendResponseError();
  }
  return {
    ...property,
    area_total_decimal: areaDecimal,
    versao: positiveInteger(input.versao),
    criado_em: createdAt,
    atualizado_em: updatedAt,
  };
}

export function decodePropertyPage(value: unknown): PropertyPage {
  const input = record(value);
  if (!Array.isArray(input.itens)) throw new InvalidBackendResponseError();
  const pagination = record(input.paginacao);
  const cursor = decodeOpaqueCursor(pagination.proximo_cursor, 32_768);
  return {
    itens: input.itens.map(decodeProperty),
    paginacao: { proximo_cursor: cursor as string | null },
  };
}

function localityCode(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new InvalidBackendResponseError();
  return value;
}
function localityVersion(value: unknown): string {
  return localityCode(value, /^ibge-localidades-[0-9]{4}-[0-9]{2}-[0-9]{2}(?![\s\S])/u);
}
export function decodeLocalityUf(value: unknown): LocalityUf {
  const input = record(value);
  exactKeys(input, ['id', 'sigla', 'nome']);
  return Object.freeze({ id: localityCode(input.id, /^[0-9]{2}(?![\s\S])/u),
    sigla: localityCode(input.sigla, /^[A-Z]{2}(?![\s\S])/u), nome: boundedString(input.nome, 100) });
}
export function decodeLocalityUfs(value: unknown): LocalityUfCollection {
  const input = record(value);
  exactKeys(input, ['versao_id', 'itens']);
  if (!Array.isArray(input.itens) || input.itens.length === 0 || input.itens.length > 27) {
    throw new InvalidBackendResponseError();
  }
  const items = Object.freeze(input.itens.map(decodeLocalityUf));
  if (new Set(items.map(item => item.id)).size !== items.length ||
    new Set(items.map(item => item.sigla)).size !== items.length) throw new InvalidBackendResponseError();
  return Object.freeze({ versao_id: localityVersion(input.versao_id), itens: items });
}
export function decodeLocalityMunicipalities(value: unknown, expectedUf: string,
  maximumItems = 100): LocalityMunicipalityPage {
  localityCode(expectedUf, /^[0-9]{2}(?![\s\S])/u);
  const input = record(value);
  exactKeys(input, ['versao_id', 'itens', 'paginacao']);
  if (!Number.isInteger(maximumItems) || maximumItems < 1 || maximumItems > 100 ||
    !Array.isArray(input.itens) || input.itens.length > maximumItems) throw new InvalidBackendResponseError();
  const items = Object.freeze(input.itens.map(value => {
    const item = record(value); exactKeys(item, ['id', 'nome', 'uf_id']);
    const id = localityCode(item.id, /^[0-9]{7}(?![\s\S])/u);
    const uf = localityCode(item.uf_id, /^[0-9]{2}(?![\s\S])/u);
    if (uf !== expectedUf || !id.startsWith(uf)) throw new InvalidBackendResponseError();
    return Object.freeze({ id, nome: boundedString(item.nome, 200), uf_id: uf });
  }));
  const pagination = record(input.paginacao); exactKeys(pagination, ['proximo_cursor']);
  const cursor = decodeOpaqueCursor(pagination.proximo_cursor);
  if (items.length === 0 && cursor !== null) throw new InvalidBackendResponseError();
  return Object.freeze({ versao_id: localityVersion(input.versao_id), itens: items,
    paginacao: Object.freeze({ proximo_cursor: cursor }) });
}

export function decodeAdministrativePropertyPage(
  value: unknown,
): AdministrativePropertyPage {
  const input = record(value);
  exactKeys(input, ['itens', 'paginacao']);
  if (!Array.isArray(input.itens) || input.itens.length > 100) {
    throw new InvalidBackendResponseError();
  }
  const pagination = record(input.paginacao);
  exactKeys(pagination, ['proximo_cursor']);
  const items = input.itens.map(decodeAdministrativeProperty);
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({
    itens: Object.freeze(items),
    paginacao: Object.freeze({
      proximo_cursor: decodeOpaqueCursor(pagination.proximo_cursor, 32_768),
    }),
  });
}

export function decodeAdministrativePropertyReceipt(
  value: unknown,
  outcome: AdministrativePropertyReceipt['resultado'],
  targetId?: string,
): AdministrativePropertyReceipt {
  const input = record(value);
  exactKeys(input, ['resultado', 'recurso_tipo', 'recurso_id', 'versao']);
  const id = uuidV4(input.recurso_id);
  if (input.resultado !== outcome || input.recurso_tipo !== 'propriedade' ||
    (targetId !== undefined && id !== targetId)) {
    throw new InvalidBackendResponseError();
  }
  return Object.freeze({ resultado: outcome, recurso_tipo: 'propriedade',
    recurso_id: id, versao: positiveInteger(input.versao) });
}

export function decodeNotification(value: unknown): NotificationProjection {
  const input = record(value);
  const content = record(input.conteudo);
  const title = requiredString(content.titulo);
  const summary = requiredString(content.resumo);
  const type = oneOf(input.tipo_evento, [
    'conta.senha_alterada.v1',
    'conta.email_principal_alterado.v1',
    'conta.recuperacao_concluida.v1',
  ] as const);
  const expectedContent = {
    'conta.senha_alterada.v1': {
      title: 'Senha alterada',
      summary: 'A senha da sua conta foi alterada.',
    },
    'conta.email_principal_alterado.v1': {
      title: 'E-mail principal alterado',
      summary: 'O e-mail principal da sua conta foi alterado.',
    },
    'conta.recuperacao_concluida.v1': {
      title: 'Recuperação concluída',
      summary: 'A recuperação da sua conta foi concluída.',
    },
  }[type];
  const createdAt = dateTime(input.criada_em);
  const expiresAt = dateTime(input.expira_em);
  const readAt = input.lida_em === null ? null : dateTime(input.lida_em);
  if (
    title.length > 120 ||
    summary.length > 500 ||
    title !== expectedContent.title ||
    summary !== expectedContent.summary ||
    Date.parse(expiresAt) <= Date.parse(createdAt) ||
    (readAt !== null && Date.parse(readAt) < Date.parse(createdAt))
  ) {
    throw new InvalidBackendResponseError();
  }
  return {
    id: uuidV4(input.id),
    tipo_evento: type,
    prioridade: oneOf(input.prioridade, ['baixa', 'normal', 'alta'] as const),
    criada_em: createdAt,
    lida_em: readAt,
    expira_em: expiresAt,
    recurso_tipo: oneOf(input.recurso_tipo, ['conta'] as const),
    recurso_id: uuidV4(input.recurso_id),
    conteudo: { titulo: title, resumo: summary },
  };
}

export function decodeNotificationPage(value: unknown): NotificationPage {
  const input = record(value);
  if (!Array.isArray(input.itens) || input.itens.length > 100) {
    throw new InvalidBackendResponseError();
  }
  const pagination = record(input.paginacao);
  const cursor = pagination.proximo_cursor;
  if (
    cursor !== null &&
    (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 32_768)
  ) {
    throw new InvalidBackendResponseError();
  }
  return {
    itens: input.itens.map(decodeNotification),
    paginacao: { proximo_cursor: cursor as string | null },
  };
}

export function decodeNotificationUnreadCount(
  value: unknown,
): NotificationUnreadCount {
  return {
    total_nao_lidas: nonNegativeInteger(record(value).total_nao_lidas),
  };
}

export function decodeNotificationReadResult(
  value: unknown,
): NotificationReadResult {
  const input = record(value);
  return { id: uuidV4(input.id), lida_em: dateTime(input.lida_em) };
}

export function decodeNotificationReadAllResult(
  value: unknown,
): NotificationReadAllResult {
  const input = record(value);
  return {
    corte_em: dateTime(input.corte_em),
    atualizadas: nonNegativeInteger(input.atualizadas),
  };
}

export function decodeNotificationDiscardResult(
  value: unknown,
): NotificationDiscardResult {
  const input = record(value);
  return {
    id: uuidV4(input.id),
    descartada_em: dateTime(input.descartada_em),
  };
}

export function decodeNotificationDestination(
  value: unknown,
): NotificationDestination {
  const input = record(value);
  return {
    recurso_tipo: oneOf(input.recurso_tipo, ['conta'] as const),
    recurso_id: uuidV4(input.recurso_id),
  };
}

export function decodeAcceptedResponse(value: unknown): AcceptedResponse {
  const input = record(value);
  return { status: oneOf(input.status, ['aceito'] as const) };
}

export function decodeRestrictedTokenResponse(
  value: unknown,
): RestrictedTokenResponse {
  const input = record(value);
  const expiresAt = dateTime(input.expira_em);
  return { token: token(input.token), expira_em: expiresAt };
}

export function decodeRemoteSessions(value: unknown): readonly RemoteSessionProjection[] {
  const input = record(value);
  if (!Array.isArray(input.sessoes)) throw new InvalidBackendResponseError();
  return input.sessoes.map((rawSession) => {
    const session = record(rawSession);
    const clientLabel = session.identificacao_cliente;
    const revokedAt = session.revogada_em;
    if (
      (clientLabel !== undefined &&
        (typeof clientLabel !== 'string' || clientLabel.length === 0)) ||
      (revokedAt !== undefined && typeof revokedAt !== 'string') ||
      typeof session.atual !== 'boolean'
    ) {
      throw new InvalidBackendResponseError();
    }
    return {
      id: uuidV4(session.id),
      criada_em: dateTime(session.criada_em),
      ultima_renovacao_em: dateTime(session.ultima_renovacao_em),
      expira_em: dateTime(session.expira_em),
      atual: session.atual,
      ...(clientLabel === undefined
        ? {}
        : { identificacao_cliente: clientLabel as string }),
      ...(revokedAt === undefined
        ? {}
        : { revogada_em: dateTime(revokedAt) }),
    };
  });
}

export function assertActionToken(value: unknown): string {
  return token(value);
}
