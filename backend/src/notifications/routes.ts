import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { bearerTokenFromAuthorizationHeader } from '../auth/service.js';
import {
  HttpError,
  badRequest,
  httpErrorBody,
} from '../security/http-error.js';
import type { NotificationView } from './contracts.js';
import type {
  NotificationListQuery,
  NotificationService,
} from './service.js';

export interface NotificationRoutesOptions {
  readonly service: NotificationService;
}

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'request_id', 'details'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        request_id: { type: 'string' },
        details: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

const notificationIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      pattern:
        '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-8][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$',
    },
  },
} as const;

const idempotencyHeadersSchema = {
  type: 'object',
  required: ['idempotency-key'],
  properties: {
    'idempotency-key': {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[A-Za-z0-9._:-]+$',
    },
  },
} as const;

const notificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'tipo_evento',
    'prioridade',
    'criada_em',
    'lida_em',
    'expira_em',
    'recurso_tipo',
    'recurso_id',
    'conteudo',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    tipo_evento: {
      type: 'string',
      enum: [
        'conta.senha_alterada.v1',
        'conta.email_principal_alterado.v1',
        'conta.recuperacao_concluida.v1',
      ],
    },
    prioridade: {
      type: 'string',
      enum: ['baixa', 'normal', 'alta'],
    },
    criada_em: { type: 'string', format: 'date-time' },
    lida_em: {
      anyOf: [
        { type: 'string', format: 'date-time' },
        { type: 'null' },
      ],
    },
    expira_em: { type: 'string', format: 'date-time' },
    recurso_tipo: { type: 'string', const: 'conta' },
    recurso_id: { type: 'string', format: 'uuid' },
    conteudo: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'resumo'],
      properties: {
        titulo: { type: 'string', maxLength: 120 },
        resumo: { type: 'string', maxLength: 500 },
      },
    },
  },
} as const;

function externalNotification(notification: NotificationView) {
  return {
    id: notification.id,
    tipo_evento: notification.eventType,
    prioridade: notification.priority,
    criada_em: notification.createdAt.toISOString(),
    lida_em: notification.readAt?.toISOString() ?? null,
    expira_em: notification.expiresAt.toISOString(),
    recurso_tipo: notification.resourceType,
    recurso_id: notification.resourceId,
    conteudo: {
      titulo: notification.content.title,
      resumo: notification.content.summary,
    },
  };
}

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
}

async function assertNoRequestBody(request: FastifyRequest): Promise<void> {
  const contentLength = request.headers['content-length'];
  if (
    (contentLength !== undefined && contentLength !== '0') ||
    request.headers['transfer-encoding'] !== undefined
  ) {
    throw badRequest();
  }
}

function assertAllowedQuery(
  rawUrl: string | undefined,
  allowed: ReadonlySet<string>,
): void {
  const queryIndex = rawUrl?.indexOf('?') ?? -1;
  if (rawUrl === undefined || queryIndex < 0) return;
  const parameters = new URLSearchParams(rawUrl.slice(queryIndex + 1));
  for (const key of parameters.keys()) {
    if (!allowed.has(key)) throw badRequest();
  }
}

const LIST_QUERY = new Set(['estado', 'limite', 'cursor']);
const NO_QUERY = new Set<string>();

export const notificationRoutesPlugin: FastifyPluginAsync<
  NotificationRoutesOptions
> = async (app, options) => {
  app.addHook('onRequest', async (_request, reply) => {
    noStore(reply);
  });

  app.setErrorHandler(async (error, request, reply) => {
    const validationError =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    const safeError =
      error instanceof HttpError
        ? error
        : validationError
          ? badRequest()
          : undefined;
    if (safeError === undefined) {
      request.log.error(
        { event: 'notification_request_failed' },
        'Notification request processing failed.',
      );
      return reply.code(500).send({
        error: {
          code: 'internal_error',
          message: 'Erro interno.',
          request_id: request.id,
          details: [],
        },
      });
    }
    if (safeError.statusCode === 401) {
      reply.header('www-authenticate', 'Bearer');
    }
    return reply
      .code(safeError.statusCode)
      .send(httpErrorBody(safeError, request.id));
  });

  app.get<{ Querystring: NotificationListQuery }>(
    '/',
    {
      prefixTrailingSlash: 'no-slash',
      schema: {
        operationId: 'getNotifications',
        summary: 'Lista notificações próprias visíveis',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            estado: {
              type: 'string',
              enum: ['nao_lida', 'lida', 'todas'],
              default: 'todas',
            },
            limite: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            cursor: { type: 'string', minLength: 1, maxLength: 1_024 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['itens', 'paginacao'],
            properties: {
              itens: { type: 'array', items: notificationSchema },
              paginacao: {
                type: 'object',
                additionalProperties: false,
                required: ['proximo_cursor'],
                properties: {
                  proximo_cursor: {
                    anyOf: [{ type: 'string' }, { type: 'null' }],
                  },
                },
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, LIST_QUERY);
      const page = await options.service.list({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        query: request.query,
      });
      return reply.code(200).send({
        itens: page.items.map(externalNotification),
        paginacao: { proximo_cursor: page.nextCursor },
      });
    },
  );

  app.get(
    '/contador-nao-lidas',
    {
      schema: {
        operationId: 'getUnreadNotificationCount',
        summary: 'Conta notificações próprias não lidas',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['total_nao_lidas'],
            properties: {
              total_nao_lidas: { type: 'integer', minimum: 0 },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, NO_QUERY);
      const total = await options.service.countUnread(
        bearerTokenFromAuthorizationHeader(request.headers.authorization),
      );
      return reply.code(200).send({ total_nao_lidas: total });
    },
  );

  app.post<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
  }>(
    '/:id/leitura',
    {
      schema: {
        operationId: 'postNotificationRead',
        summary: 'Marca uma notificação própria como lida',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        params: notificationIdParamsSchema,
        headers: idempotencyHeadersSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'lida_em'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              lida_em: { type: 'string', format: 'date-time' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preValidation: assertNoRequestBody,
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, NO_QUERY);
      const result = await options.service.markRead({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        notificationId: request.params.id,
        idempotencyKey: request.headers['idempotency-key'],
        requestId: request.id,
      });
      return reply.code(200).send({
        id: result.id,
        lida_em: result.readAt.toISOString(),
      });
    },
  );

  app.post<{ Headers: { 'idempotency-key': string } }>(
    '/leituras',
    {
      schema: {
        operationId: 'postAllNotificationsRead',
        summary: 'Marca como lidas as notificações até o corte do servidor',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        headers: idempotencyHeadersSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['corte_em', 'atualizadas'],
            properties: {
              corte_em: { type: 'string', format: 'date-time' },
              atualizadas: { type: 'integer', minimum: 0 },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preValidation: assertNoRequestBody,
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, NO_QUERY);
      const result = await options.service.markAllRead({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        idempotencyKey: request.headers['idempotency-key'],
        requestId: request.id,
      });
      return reply.code(200).send({
        corte_em: result.cutoffAt.toISOString(),
        atualizadas: result.updated,
      });
    },
  );

  app.delete<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
  }>(
    '/:id',
    {
      schema: {
        operationId: 'deleteNotification',
        summary: 'Descarta logicamente uma notificação própria',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        params: notificationIdParamsSchema,
        headers: idempotencyHeadersSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'descartada_em'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              descartada_em: { type: 'string', format: 'date-time' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preValidation: assertNoRequestBody,
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, NO_QUERY);
      const result = await options.service.discard({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        notificationId: request.params.id,
        idempotencyKey: request.headers['idempotency-key'],
        requestId: request.id,
      });
      return reply.code(200).send({
        id: result.id,
        descartada_em: result.discardedAt.toISOString(),
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/resolver-destino',
    {
      schema: {
        operationId: 'postNotificationDestinationResolution',
        summary: 'Reautoriza o destino canônico de uma notificação própria',
        tags: ['Notificações'],
        security: [{ bearerAuth: [] }],
        params: notificationIdParamsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['recurso_tipo', 'recurso_id'],
            properties: {
              recurso_tipo: { type: 'string', const: 'conta' },
              recurso_id: { type: 'string', format: 'uuid' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preValidation: assertNoRequestBody,
    },
    async (request, reply) => {
      assertAllowedQuery(request.raw.url, NO_QUERY);
      const result = await options.service.resolveDestination({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        notificationId: request.params.id,
        requestId: request.id,
      });
      return reply.code(200).send({
        recurso_tipo: result.resourceType,
        recurso_id: result.resourceId,
      });
    },
  );
};
