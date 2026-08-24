import { randomUUID } from 'node:crypto';

import swagger from '@fastify/swagger';
import fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  LogController,
} from 'fastify';

import type { RuntimeConfig } from './config.js';
import {
  accountActionRoutesPlugin,
  type AccountActionRoutesOptions,
} from './account-actions/account-action-routes.js';
import { authRoutesPlugin } from './auth/routes.js';
import type { AuthenticationService } from './auth/service.js';
import { checkDatabaseReadiness } from './database/readiness.js';
import type { DatabasePool } from './database/pool.js';
import { createAppLogger } from './observability/logger.js';
import {
  propertyRoutesPlugin,
  type PropertyRoutesOptions,
} from './properties/routes.js';
import {
  notificationRoutesPlugin,
  type NotificationRoutesOptions,
} from './notifications/routes.js';

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', const: 'ok' },
  },
} as const;

const readinessResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', const: 'ready' },
  },
} as const;

const notReadyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'request_id'],
  properties: {
    status: { type: 'string', const: 'not_ready' },
    request_id: { type: 'string' },
  },
} as const;

export interface BuildAppOptions {
  readonly config: RuntimeConfig;
  readonly database: DatabasePool;
  readonly logger?: FastifyBaseLogger | false;
  readonly requestIdFactory?: () => string;
  readonly readinessTimeoutMs?: number;
  readonly authenticationService?: AuthenticationService;
  readonly accountActionRoutes?: Omit<
    AccountActionRoutesOptions,
    'authenticationService'
  >;
  readonly propertyRoutes?: PropertyRoutesOptions;
  readonly notificationRoutes?: NotificationRoutesOptions;
}

function generatedRequestId(): string {
  return `req_${randomUUID()}`;
}

function createFastifyInstance(
  config: RuntimeConfig,
  logger: FastifyBaseLogger | false | undefined,
  requestIdFactory: () => string,
): FastifyInstance {
  const commonOptions = {
    trustProxy: false as const,
    requestIdHeader: false as const,
    genReqId: requestIdFactory,
    logController: new LogController({
      requestIdLogLabel: 'request_id',
    }),
  };

  if (logger === false) {
    return fastify({ ...commonOptions, logger: false });
  }

  return fastify({
    ...commonOptions,
    loggerInstance: logger ?? createAppLogger(config.logLevel),
  });
}

function safeErrorBody(requestId: string, code: string, message: string) {
  return {
    error: {
      code,
      message,
      request_id: requestId,
      details: [],
    },
  };
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const requestIdFactory = options.requestIdFactory ?? generatedRequestId;
  const readinessTimeoutMs =
    options.readinessTimeoutMs ?? options.config.readinessTimeoutMs;
  const app = createFastifyInstance(
    options.config,
    options.logger,
    requestIdFactory,
  );

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Tchê Agro Backend API',
        description: 'Contrato HTTP da fundação do backend Tchê Agro.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'opaque',
          },
        },
      },
      tags: [
        {
          name: 'Operação',
          description: 'Sinais operacionais do processo HTTP.',
        },
        {
          name: 'Autenticação',
          description: 'Login, sessão, tokens e recuperação comum de senha.',
        },
        {
          name: 'Ações de conta',
          description: 'Convites, e-mails verificados e recuperações controladas.',
        },
        {
          name: 'Propriedades',
          description: 'Consulta de Propriedades dentro do escopo autorizado.',
        },
        {
          name: 'Notificações',
          description: 'Notificações in-app próprias, persistidas e isoladas.',
        },
      ],
    },
  });

  if (options.authenticationService !== undefined) {
    await app.register(authRoutesPlugin, {
      prefix: '/v1/auth',
      service: options.authenticationService,
    });
    if (options.accountActionRoutes !== undefined) {
      await app.register(accountActionRoutesPlugin, {
        prefix: '/v1/auth',
        authenticationService: options.authenticationService,
        ...options.accountActionRoutes,
      });
    }
  } else if (options.accountActionRoutes !== undefined) {
    throw new TypeError(
      'Account action routes require an authentication service.',
    );
  }

  if (options.propertyRoutes !== undefined) {
    if (options.authenticationService === undefined) {
      throw new TypeError('Property routes require an authentication service.');
    }
    await app.register(propertyRoutesPlugin, {
      prefix: '/v1/propriedades',
      ...options.propertyRoutes,
    });
  }

  if (options.notificationRoutes !== undefined) {
    if (options.authenticationService === undefined) {
      throw new TypeError(
        'Notification routes require an authentication service.',
      );
    }
    await app.register(notificationRoutesPlugin, {
      prefix: '/v1/notificacoes',
      ...options.notificationRoutes,
    });
  }

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.get(
    '/v1/health',
    {
      schema: {
        operationId: 'getHealth',
        summary: 'Verifica se o processo HTTP está ativo',
        tags: ['Operação'],
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({ status: 'ok' as const }),
  );

  app.get(
    '/v1/readiness',
    {
      schema: {
        operationId: 'getReadiness',
        summary: 'Verifica PostgreSQL e PostGIS',
        tags: ['Operação'],
        response: {
          200: readinessResponseSchema,
          503: notReadyResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await checkDatabaseReadiness(
        options.database,
        readinessTimeoutMs,
      );

      if (!result.ready) {
        request.log.warn(
          { event: 'readiness_check_failed' },
          'PostgreSQL/PostGIS readiness check failed.',
        );
        return reply.code(503).send({
          status: 'not_ready',
          request_id: request.id,
        });
      }

      return reply.code(200).send({ status: 'ready' });
    },
  );

  app.get(
    '/v1/openapi.json',
    {
      schema: {
        hide: true,
      },
    },
    async (_request, reply) => {
      return reply.type('application/json; charset=utf-8').send(app.swagger());
    },
  );

  app.setNotFoundHandler(async (request, reply) => {
    return reply
      .code(404)
      .send(safeErrorBody(request.id, 'not_found', 'Recurso não encontrado.'));
  });

  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(
      { event: 'request_failed', err: error },
      'Request processing failed.',
    );

    if (reply.sent) {
      return;
    }

    return reply
      .code(500)
      .send(safeErrorBody(request.id, 'internal_error', 'Erro interno.'));
  });

  return app;
}
