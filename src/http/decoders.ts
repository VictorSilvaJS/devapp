import type {
  AcceptedResponse,
  ApiErrorCode,
  ApiErrorPayload,
  HttpScope,
  HttpSessionIdentity,
  HttpUser,
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

export class InvalidBackendResponseError extends Error {
  constructor() {
    super('A resposta do serviço é inválida. Tente novamente mais tarde.');
    this.name = 'InvalidBackendResponseError';
  }
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidBackendResponseError();
  }
  return value as Record<string, unknown>;
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

function nonNegativeInteger(value: unknown): number {
  const decoded = requiredInteger(value);
  if (decoded < 0) throw new InvalidBackendResponseError();
  return decoded;
}

function uuidV4(value: unknown): string {
  const decoded = requiredString(value);
  if (!UUID_V4_PATTERN.test(decoded)) throw new InvalidBackendResponseError();
  return decoded;
}

function dateTime(value: unknown): string {
  const decoded = requiredString(value);
  if (!Number.isFinite(Date.parse(decoded))) {
    throw new InvalidBackendResponseError();
  }
  return decoded;
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
  const input = record(record(value).error);
  const code = oneOf(input.code, allowedCodes);
  const details = input.details;
  if (!Array.isArray(details) || details.some((item) => {
    return typeof item !== 'object' || item === null || Array.isArray(item);
  })) {
    throw new InvalidBackendResponseError();
  }
  return {
    code,
    message: requiredString(input.message),
    request_id: requiredString(input.request_id),
    details: details as Record<string, unknown>[],
  };
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

export function decodePropertyPage(value: unknown): PropertyPage {
  const input = record(value);
  if (!Array.isArray(input.itens)) throw new InvalidBackendResponseError();
  const pagination = record(input.paginacao);
  const cursor = pagination.proximo_cursor;
  if (cursor !== null && (typeof cursor !== 'string' || cursor.length === 0)) {
    throw new InvalidBackendResponseError();
  }
  return {
    itens: input.itens.map(decodeProperty),
    paginacao: { proximo_cursor: cursor as string | null },
  };
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
