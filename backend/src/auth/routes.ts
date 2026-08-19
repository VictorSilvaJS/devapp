import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import type {
  AuthenticationService,
  AuthTokenResponse,
} from './service.js';
import { bearerTokenFromAuthorizationHeader } from './service.js';
import { PasswordHashingCapacityError } from './password-hasher.js';
import {
  HttpError,
  badRequest,
  httpErrorBody,
  rateLimited,
} from '../security/http-error.js';

export interface AuthRoutesOptions {
  readonly service: AuthenticationService;
}

const emailSchema = { type: 'string', minLength: 1, maxLength: 254 } as const;
const passwordSchema = { type: 'string', minLength: 1, maxLength: 1_024 } as const;
const tokenSchema = {
  type: 'string',
  pattern: '^[A-Za-z0-9_-]{43}$',
} as const;

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

const userResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'organizacao_id',
    'nome',
    'email',
    'perfil',
    'status',
    'versao_autorizacao',
  ],
  properties: {
    id: { type: 'string' },
    organizacao_id: { type: 'string' },
    nome: { type: 'string' },
    email: { type: 'string' },
    perfil: { type: 'string', enum: ['admin', 'colaborador', 'produtor'] },
    status: { type: 'string', enum: ['pendente', 'ativo', 'inativo'] },
    versao_autorizacao: { type: 'integer' },
  },
} as const;

const scopeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['modo', 'versao'],
  properties: {
    modo: { type: 'string', enum: ['organizacao', 'vinculos_propriedade'] },
    versao: { type: 'integer' },
  },
} as const;

const tokenResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'access_token',
    'refresh_token',
    'token_type',
    'expires_in',
    'sessao',
    'usuario',
    'escopo',
  ],
  properties: {
    access_token: tokenSchema,
    refresh_token: tokenSchema,
    token_type: { type: 'string', const: 'Bearer' },
    expires_in: { type: 'integer', minimum: 1 },
    sessao: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    usuario: userResponseSchema,
    escopo: scopeResponseSchema,
  },
} as const;

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
  reply.header('referrer-policy', 'no-referrer');
}

function externalUser(user: AuthTokenResponse['user']) {
  return {
    id: user.id,
    organizacao_id: user.organizationId,
    nome: user.name,
    email: user.email,
    perfil: user.profile,
    status: user.status,
    versao_autorizacao: user.authorizationVersion,
  };
}

function externalScope(scope: AuthTokenResponse['scope']) {
  return {
    modo:
      scope.mode === 'organization'
        ? ('organizacao' as const)
        : ('vinculos_propriedade' as const),
    versao: scope.version,
  };
}

function externalTokenResponse(response: AuthTokenResponse) {
  return {
    access_token: response.accessToken,
    refresh_token: response.refreshToken,
    token_type: response.tokenType,
    expires_in: response.expiresIn,
    sessao: { id: response.sessionId },
    usuario: externalUser(response.user),
    escopo: externalScope(response.scope),
  };
}

function requestBearer(authorization: string | undefined): string {
  return bearerTokenFromAuthorizationHeader(authorization);
}

export const authRoutesPlugin: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  app.setErrorHandler(async (error, request, reply) => {
    const isValidationError =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    const safeError =
      error instanceof HttpError
        ? error
        : error instanceof PasswordHashingCapacityError
          ? rateLimited(1)
        : isValidationError
          ? badRequest()
          : undefined;

    if (safeError === undefined) {
      request.log.error(
        { event: 'auth_request_failed', err: error },
        'Authentication request processing failed.',
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
    if (
      safeError.statusCode === 429 &&
      safeError.retryAfterSeconds !== undefined
    ) {
      reply.header('retry-after', String(safeError.retryAfterSeconds));
    }
    return reply
      .code(safeError.statusCode)
      .send(httpErrorBody(safeError, request.id));
  });

  app.post<{ Body: { email: string; senha: string } }>(
    '/login',
    {
      schema: {
        operationId: 'postAuthLogin',
        summary: 'Inicia uma sessão',
        tags: ['Autenticação'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email', 'senha'],
          properties: { email: emailSchema, senha: passwordSchema },
        },
        response: {
          200: tokenResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      const response = await options.service.login({
        email: request.body.email,
        password: request.body.senha,
        ipAddress: request.ip,
        requestId: request.id,
      });
      return externalTokenResponse(response);
    },
  );

  app.post<{ Body: { refresh_token: string } }>(
    '/refresh',
    {
      schema: {
        operationId: 'postAuthRefresh',
        summary: 'Rotaciona o refresh token',
        tags: ['Autenticação'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['refresh_token'],
          properties: {
            refresh_token: { type: 'string', minLength: 1, maxLength: 1_024 },
          },
        },
        response: {
          200: tokenResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      const response = await options.service.refresh({
        refreshToken: request.body.refresh_token,
        requestId: request.id,
      });
      return externalTokenResponse(response);
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        operationId: 'postAuthLogout',
        summary: 'Revoga a sessão atual',
        tags: ['Autenticação'],
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      await options.service.logout({
        accessToken: requestBearer(request.headers.authorization),
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post(
    '/logout-all',
    {
      schema: {
        operationId: 'postAuthLogoutAll',
        summary: 'Revoga todas as sessões do usuário',
        tags: ['Autenticação'],
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      await options.service.logoutAll({
        accessToken: requestBearer(request.headers.authorization),
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.get(
    '/me',
    {
      schema: {
        operationId: 'getAuthMe',
        summary: 'Retorna identidade e versão de escopo da sessão',
        tags: ['Autenticação'],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['usuario', 'sessao', 'escopo'],
            properties: {
              usuario: userResponseSchema,
              sessao: {
                type: 'object',
                additionalProperties: false,
                required: ['id'],
                properties: { id: { type: 'string' } },
              },
              escopo: scopeResponseSchema,
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      const response = await options.service.me(
        requestBearer(request.headers.authorization),
      );
      return {
        usuario: externalUser(response.user),
        sessao: { id: response.sessionId },
        escopo: externalScope(response.scope),
      };
    },
  );

  app.get(
    '/sessions',
    {
      schema: {
        operationId: 'getAuthSessions',
        summary: 'Lista sessões do usuário',
        tags: ['Autenticação'],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['sessoes'],
            properties: {
              sessoes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'id',
                    'criada_em',
                    'ultima_renovacao_em',
                    'expira_em',
                    'atual',
                  ],
                  properties: {
                    id: { type: 'string' },
                    criada_em: { type: 'string', format: 'date-time' },
                    ultima_renovacao_em: { type: 'string', format: 'date-time' },
                    expira_em: { type: 'string', format: 'date-time' },
                    atual: { type: 'boolean' },
                    identificacao_cliente: { type: 'string' },
                    revogada_em: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      const sessions = await options.service.sessions(
        requestBearer(request.headers.authorization),
      );
      return {
        sessoes: sessions.map((session) => ({
          id: session.id,
          criada_em: session.createdAt.toISOString(),
          ultima_renovacao_em: session.lastRefreshedAt.toISOString(),
          expira_em: session.absoluteExpiresAt.toISOString(),
          atual: session.current,
          ...(session.clientLabel === undefined
            ? {}
            : { identificacao_cliente: session.clientLabel }),
          ...(session.revokedAt === undefined
            ? {}
            : { revogada_em: session.revokedAt.toISOString() }),
        })),
      };
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    {
      schema: {
        operationId: 'deleteAuthSession',
        summary: 'Revoga uma sessão pertencente ao usuário',
        tags: ['Autenticação'],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', minLength: 1 } },
        },
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      await options.service.revokeSession({
        accessToken: requestBearer(request.headers.authorization),
        sessionId: request.params.sessionId,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { senha_atual: string; nova_senha: string } }>(
    '/password/change',
    {
      schema: {
        operationId: 'postAuthPasswordChange',
        summary: 'Troca a senha, revoga outras sessões e gira os tokens atuais',
        tags: ['Autenticação'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['senha_atual', 'nova_senha'],
          properties: {
            senha_atual: passwordSchema,
            nova_senha: passwordSchema,
          },
        },
        response: {
          200: tokenResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      const response = await options.service.changePassword({
        accessToken: requestBearer(request.headers.authorization),
        currentPassword: request.body.senha_atual,
        newPassword: request.body.nova_senha,
        requestId: request.id,
      });
      return reply.code(200).send(externalTokenResponse(response));
    },
  );

  app.post<{ Body: { email: string } }>(
    '/password-recovery/request',
    {
      schema: {
        operationId: 'postAuthPasswordRecoveryRequest',
        summary: 'Solicita recuperação de senha',
        tags: ['Autenticação'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email'],
          properties: { email: emailSchema },
        },
        response: {
          202: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: { status: { type: 'string', const: 'aceito' } },
          },
          400: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      await options.service.requestPasswordRecovery({
        email: request.body.email,
        ipAddress: request.ip,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string; nova_senha: string } }>(
    '/password-recovery/complete',
    {
      schema: {
        operationId: 'postAuthPasswordRecoveryComplete',
        summary: 'Conclui recuperação de senha sem login automático',
        tags: ['Autenticação'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'nova_senha'],
          properties: { token: tokenSchema, nova_senha: passwordSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      await options.service.completePasswordRecovery({
        token: request.body.token,
        newPassword: request.body.nova_senha,
        ipAddress: request.ip,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );
};
