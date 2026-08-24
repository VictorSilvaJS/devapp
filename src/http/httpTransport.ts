export interface HttpTransportRequest {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly url: string;
  readonly accessToken?: string;
  readonly idempotencyKey?: string;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly timeoutMs: number;
}

export interface HttpTransportResponse {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;
}

export interface HttpTransport {
  send(request: HttpTransportRequest): Promise<HttpTransportResponse>;
}

export class ApiTransportError extends Error {
  constructor() {
    super('Não foi possível conectar ao serviço.');
    this.name = 'ApiTransportError';
  }
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export class FetchHttpTransport implements HttpTransport {
  async send(request: HttpTransportRequest): Promise<HttpTransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          accept: 'application/json',
          ...(request.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
          ...(request.accessToken === undefined
            ? {}
            : { authorization: `Bearer ${request.accessToken}` }),
          ...(request.idempotencyKey === undefined
            ? {}
            : { 'idempotency-key': request.idempotencyKey }),
        },
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      const text = await response.text();
      let body: unknown = undefined;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          body = Symbol.for('tche.invalid-json');
        }
      }
      return {
        status: response.status,
        body,
        ...(retryAfterSeconds(response.headers.get('retry-after')) === undefined
          ? {}
          : {
              retryAfterSeconds: retryAfterSeconds(
                response.headers.get('retry-after'),
              ),
            }),
      };
    } catch {
      throw new ApiTransportError();
    } finally {
      clearTimeout(timeout);
    }
  }
}
