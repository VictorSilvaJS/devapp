export type HttpErrorCode =
  | 'invalid_request'
  | 'invalid_credentials'
  | 'invalid_session'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'password_policy_violation'
  | 'invalid_or_expired_challenge'
  | 'rate_limited'
  | 'service_unavailable';

export class HttpError extends Error {
  public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;
  public readonly code: HttpErrorCode;
  public readonly details: readonly Readonly<Record<string, unknown>>[];
  public readonly retryAfterSeconds: number | undefined;

  public constructor(input: {
    readonly statusCode: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;
    readonly code: HttpErrorCode;
    readonly message: string;
    readonly details?: readonly Readonly<Record<string, unknown>>[];
    readonly retryAfterSeconds?: number;
  }) {
    super(input.message);
    this.name = 'HttpError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.details = Object.freeze([...(input.details ?? [])]);
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export function badRequest(message = 'Requisição inválida.'): HttpError {
  return new HttpError({ statusCode: 400, code: 'invalid_request', message });
}

export function unauthorized(
  code: 'invalid_credentials' | 'invalid_session' = 'invalid_session',
): HttpError {
  return new HttpError({
    statusCode: 401,
    code,
    message: 'Credenciais ou sessão inválidas.',
  });
}

export function forbidden(): HttpError {
  return new HttpError({
    statusCode: 403,
    code: 'forbidden',
    message: 'Acesso negado.',
  });
}

export function notFound(): HttpError {
  return new HttpError({
    statusCode: 404,
    code: 'not_found',
    message: 'Recurso não encontrado.',
  });
}

export function conflict(message = 'A operação conflita com o estado atual.'): HttpError {
  return new HttpError({ statusCode: 409, code: 'conflict', message });
}

export function unprocessable(message: string): HttpError {
  return new HttpError({
    statusCode: 422,
    code: 'password_policy_violation',
    message,
  });
}

export function invalidOrExpiredChallenge(): HttpError {
  return new HttpError({
    statusCode: 400,
    code: 'invalid_or_expired_challenge',
    message: 'Código inválido ou expirado.',
  });
}

export function rateLimited(retryAfterSeconds: number): HttpError {
  return new HttpError({
    statusCode: 429,
    code: 'rate_limited',
    message: 'Muitas tentativas. Tente novamente mais tarde.',
    retryAfterSeconds,
  });
}

export function serviceUnavailable(): HttpError {
  return new HttpError({
    statusCode: 503,
    code: 'service_unavailable',
    message: 'Serviço temporariamente indisponível.',
  });
}

export function httpErrorBody(error: HttpError, requestId: string): Readonly<{
  error: Readonly<{
    code: HttpErrorCode;
    message: string;
    request_id: string;
    details: readonly Readonly<Record<string, unknown>>[];
  }>;
}> {
  return {
    error: {
      code: error.code,
      message: error.message,
      request_id: requestId,
      details: error.details,
    },
  };
}
