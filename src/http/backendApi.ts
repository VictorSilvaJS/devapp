import type {
  AcceptedResponse,
  ApiErrorCode,
  HttpSessionIdentity,
  NotificationDestination,
  NotificationDiscardResult,
  NotificationFilters,
  NotificationPage,
  NotificationReadAllResult,
  NotificationReadResult,
  NotificationUnreadCount,
  PropertyFilters,
  PropertyPage,
  PropertyProjection,
  RemoteSessionProjection,
  RestrictedTokenResponse,
  TokenResponse,
} from './contracts';
import {
  decodeAcceptedResponse,
  decodeApiError,
  decodeNotificationDestination,
  decodeNotificationDiscardResult,
  decodeNotificationPage,
  decodeNotificationReadAllResult,
  decodeNotificationReadResult,
  decodeNotificationUnreadCount,
  decodeProperty,
  decodePropertyPage,
  decodeRemoteSessions,
  decodeRestrictedTokenResponse,
  decodeSessionIdentity,
  decodeTokenResponse,
  InvalidBackendResponseError,
} from './decoders';
import type {
  HttpTransport,
  HttpTransportRequest,
  HttpTransportResponse,
} from './httpTransport';

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
    readonly requestId?: string;
    readonly retryAfterSeconds?: number;
  }) {
    super(input.message);
    this.name = 'ApiResponseError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

const INVALID_JSON = Symbol.for('tche.invalid-json');

const ERROR_CODES_BY_STATUS: Readonly<Record<number, readonly ApiErrorCode[]>> = {
  400: ['invalid_request', 'invalid_or_expired_challenge'],
  401: ['invalid_session'],
  403: ['forbidden'],
  404: ['not_found'],
  409: ['conflict'],
  422: ['password_policy_violation'],
  429: ['rate_limited'],
  503: ['service_unavailable'],
};

function safeError(
  response: HttpTransportResponse,
  allowedUnauthorizedCodes: readonly Extract<
    ApiErrorCode,
    'invalid_credentials' | 'invalid_session'
  >[],
): ApiResponseError {
  try {
    if (response.body === INVALID_JSON) throw new InvalidBackendResponseError();
    const allowedCodes = response.status === 401
      ? allowedUnauthorizedCodes
      : ERROR_CODES_BY_STATUS[response.status] ?? [];
    const decoded = decodeApiError(response.body, allowedCodes);
    return new ApiResponseError({
      status: response.status,
      code: decoded.code,
      message: 'A solicitação HTTP falhou.',
      requestId: decoded.request_id,
      retryAfterSeconds: response.retryAfterSeconds,
    });
  } catch {
    return new ApiResponseError({
      status: response.status,
      code: response.status === 401
        ? 'invalid_session'
        : response.status === 503
          ? 'service_unavailable'
          : 'unexpected_response',
      message: response.status === 503
        ? 'Serviço temporariamente indisponível.'
        : response.status === 401
          ? 'Sua sessão não é mais válida.'
          : 'Não foi possível concluir a solicitação.',
      retryAfterSeconds: response.retryAfterSeconds,
    });
  }
}

export class BackendApi {
  readonly #baseUrl: string;
  readonly #transport: HttpTransport;
  readonly #timeoutMs: number;

  constructor(input: {
    readonly baseUrl: string;
    readonly transport: HttpTransport;
    readonly timeoutMs?: number;
  }) {
    this.#baseUrl = input.baseUrl.replace(/\/$/, '');
    this.#transport = input.transport;
    this.#timeoutMs = input.timeoutMs ?? 8_000;
  }

  async #send(input: Omit<HttpTransportRequest, 'url' | 'timeoutMs'> & {
    readonly path: string;
    readonly expectedStatus: number;
    readonly allowedUnauthorizedCodes?: readonly Extract<
      ApiErrorCode,
      'invalid_credentials' | 'invalid_session'
    >[];
  }): Promise<HttpTransportResponse> {
    const {
      path,
      expectedStatus,
      allowedUnauthorizedCodes,
      ...request
    } = input;
    const response = await this.#transport.send({
      ...request,
      url: `${this.#baseUrl}${path}`,
      timeoutMs: this.#timeoutMs,
    });
    if (response.status < 200 || response.status >= 300) {
      const defaults = input.accessToken === undefined
        ? []
        : ['invalid_session'] as const;
      throw safeError(
        response,
        allowedUnauthorizedCodes ?? defaults,
      );
    }
    if (
      response.status !== expectedStatus ||
      (expectedStatus === 204 && response.body !== undefined)
    ) {
      throw new InvalidBackendResponseError();
    }
    if (response.body === INVALID_JSON) throw new InvalidBackendResponseError();
    return response;
  }

  async login(
    email: string,
    password: string,
  ): Promise<TokenResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/login',
      expectedStatus: 200,
      body: { email, senha: password },
      allowedUnauthorizedCodes: ['invalid_credentials'],
    });
    return decodeTokenResponse(response.body);
  }

  async refresh(
    refreshToken: string,
  ): Promise<TokenResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/refresh',
      expectedStatus: 200,
      body: { refresh_token: refreshToken },
    });
    return decodeTokenResponse(response.body);
  }

  async logout(accessToken: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/logout',
      expectedStatus: 204,
      accessToken,
    });
  }

  async logoutAll(accessToken: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/logout-all',
      expectedStatus: 204,
      accessToken,
    });
  }

  async me(
    accessToken: string,
  ): Promise<HttpSessionIdentity> {
    const response = await this.#send({
      method: 'GET',
      path: '/v1/auth/me',
      expectedStatus: 200,
      accessToken,
    });
    return decodeSessionIdentity(response.body);
  }

  async listSessions(
    accessToken: string,
  ): Promise<readonly RemoteSessionProjection[]> {
    const response = await this.#send({
      method: 'GET',
      path: '/v1/auth/sessions',
      expectedStatus: 200,
      accessToken,
    });
    return decodeRemoteSessions(response.body);
  }

  async revokeSession(
    accessToken: string,
    sessionId: string,
  ): Promise<void> {
    await this.#send({
      method: 'DELETE',
      path: `/v1/auth/sessions/${encodeURIComponent(sessionId)}`,
      expectedStatus: 204,
      accessToken,
    });
  }

  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<TokenResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/password/change',
      expectedStatus: 200,
      accessToken,
      body: { senha_atual: currentPassword, nova_senha: newPassword },
      allowedUnauthorizedCodes: ['invalid_credentials', 'invalid_session'],
    });
    return decodeTokenResponse(response.body);
  }

  async requestPasswordRecovery(email: string): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/password-recovery/request',
      expectedStatus: 202,
      body: { email },
    });
    return decodeAcceptedResponse(response.body);
  }

  async completePasswordRecovery(
    token: string,
    password: string,
  ): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/password-recovery/complete',
      expectedStatus: 204,
      body: { token, nova_senha: password },
    });
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/invitations/accept',
      expectedStatus: 204,
      body: { token, senha: password },
    });
  }

  async requestPrimaryEmailChange(
    accessToken: string,
    newEmail: string,
    currentPassword: string,
  ): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/email-change/request',
      expectedStatus: 202,
      accessToken,
      body: { novo_email: newEmail, senha_atual: currentPassword },
      allowedUnauthorizedCodes: ['invalid_credentials', 'invalid_session'],
    });
    return decodeAcceptedResponse(response.body);
  }

  async confirmCurrentPrimaryEmail(token: string): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/email-change/confirm-current',
      expectedStatus: 202,
      body: { token },
    });
    return decodeAcceptedResponse(response.body);
  }

  async confirmNewPrimaryEmail(
    token: string,
  ): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/email-change/confirm-new',
      expectedStatus: 204,
      body: { token },
    });
  }

  async requestSecondaryEmail(
    accessToken: string,
    newEmail: string,
  ): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/secondary-email/request',
      expectedStatus: 202,
      accessToken,
      body: { novo_email: newEmail },
    });
    return decodeAcceptedResponse(response.body);
  }

  async confirmSecondaryEmail(token: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/secondary-email/confirm',
      expectedStatus: 204,
      body: { token },
    });
  }

  async requestAdminSecondaryRecovery(
    secondaryEmail: string,
    newPrimaryEmail: string,
  ): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/admin-secondary-recovery/request',
      expectedStatus: 202,
      body: {
        email_secundario: secondaryEmail,
        novo_email_principal: newPrimaryEmail,
      },
    });
    return decodeAcceptedResponse(response.body);
  }

  async confirmAdminSecondaryRecovery(token: string): Promise<AcceptedResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/admin-secondary-recovery/confirm-secondary',
      expectedStatus: 202,
      body: { token },
    });
    return decodeAcceptedResponse(response.body);
  }

  async confirmAdminRecoveryNewPrimary(
    token: string,
  ): Promise<RestrictedTokenResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/admin-secondary-recovery/confirm-new-primary',
      expectedStatus: 200,
      body: { token },
    });
    return decodeRestrictedTokenResponse(response.body);
  }

  async completeAdminSecondaryRecovery(
    restrictedToken: string,
    newPassword: string,
  ): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/admin-secondary-recovery/complete',
      expectedStatus: 204,
      body: { token: restrictedToken, nova_senha: newPassword },
    });
  }

  async cancelAdminSecondaryRecovery(restrictedToken: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/admin-secondary-recovery/cancel',
      expectedStatus: 204,
      body: { token: restrictedToken },
    });
  }

  async confirmAssistedRecoveryEmail(
    token: string,
  ): Promise<RestrictedTokenResponse> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/auth/assisted-recovery/confirm-email',
      expectedStatus: 200,
      body: { token },
    });
    return decodeRestrictedTokenResponse(response.body);
  }

  async completeAssistedRecovery(
    restrictedToken: string,
    newPassword: string,
  ): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/assisted-recovery/complete',
      expectedStatus: 204,
      body: { token: restrictedToken, nova_senha: newPassword },
    });
  }

  async cancelAssistedRecovery(restrictedToken: string): Promise<void> {
    await this.#send({
      method: 'POST',
      path: '/v1/auth/assisted-recovery/cancel',
      expectedStatus: 204,
      body: { token: restrictedToken },
    });
  }

  async listProperties(
    accessToken: string,
    filters: PropertyFilters,
  ): Promise<PropertyPage> {
    const query = new URLSearchParams();
    if (filters.busca) query.set('busca', filters.busca);
    if (filters.status) query.set('status', filters.status);
    if (filters.uf) query.set('uf', filters.uf);
    if (filters.municipio) query.set('municipio', filters.municipio);
    if (filters.limite !== undefined) query.set('limite', String(filters.limite));
    if (filters.cursor) query.set('cursor', filters.cursor);
    const serialized = query.toString();
    const response = await this.#send({
      method: 'GET',
      path: `/v1/propriedades${serialized ? `?${serialized}` : ''}`,
      expectedStatus: 200,
      accessToken,
    });
    return decodePropertyPage(response.body);
  }

  async getProperty(
    accessToken: string,
    propertyId: string,
  ): Promise<PropertyProjection> {
    const response = await this.#send({
      method: 'GET',
      path: `/v1/propriedades/${encodeURIComponent(propertyId)}`,
      expectedStatus: 200,
      accessToken,
    });
    return decodeProperty(response.body);
  }

  async listNotifications(
    accessToken: string,
    filters: NotificationFilters,
  ): Promise<NotificationPage> {
    const query = new URLSearchParams();
    if (filters.estado) query.set('estado', filters.estado);
    if (filters.limite !== undefined) query.set('limite', String(filters.limite));
    if (filters.cursor) query.set('cursor', filters.cursor);
    const serialized = query.toString();
    const response = await this.#send({
      method: 'GET',
      path: `/v1/notificacoes${serialized ? `?${serialized}` : ''}`,
      expectedStatus: 200,
      accessToken,
    });
    return decodeNotificationPage(response.body);
  }

  async countUnreadNotifications(
    accessToken: string,
  ): Promise<NotificationUnreadCount> {
    const response = await this.#send({
      method: 'GET',
      path: '/v1/notificacoes/contador-nao-lidas',
      expectedStatus: 200,
      accessToken,
    });
    return decodeNotificationUnreadCount(response.body);
  }

  async markNotificationRead(
    accessToken: string,
    notificationId: string,
    idempotencyKey: string,
  ): Promise<NotificationReadResult> {
    const response = await this.#send({
      method: 'POST',
      path: `/v1/notificacoes/${encodeURIComponent(notificationId)}/leitura`,
      expectedStatus: 200,
      accessToken,
      idempotencyKey,
    });
    return decodeNotificationReadResult(response.body);
  }

  async markAllNotificationsRead(
    accessToken: string,
    idempotencyKey: string,
  ): Promise<NotificationReadAllResult> {
    const response = await this.#send({
      method: 'POST',
      path: '/v1/notificacoes/leituras',
      expectedStatus: 200,
      accessToken,
      idempotencyKey,
    });
    return decodeNotificationReadAllResult(response.body);
  }

  async discardNotification(
    accessToken: string,
    notificationId: string,
    idempotencyKey: string,
  ): Promise<NotificationDiscardResult> {
    const response = await this.#send({
      method: 'DELETE',
      path: `/v1/notificacoes/${encodeURIComponent(notificationId)}`,
      expectedStatus: 200,
      accessToken,
      idempotencyKey,
    });
    return decodeNotificationDiscardResult(response.body);
  }

  async resolveNotificationDestination(
    accessToken: string,
    notificationId: string,
  ): Promise<NotificationDestination> {
    const response = await this.#send({
      method: 'POST',
      path: `/v1/notificacoes/${encodeURIComponent(notificationId)}/resolver-destino`,
      expectedStatus: 200,
      accessToken,
    });
    return decodeNotificationDestination(response.body);
  }
}
