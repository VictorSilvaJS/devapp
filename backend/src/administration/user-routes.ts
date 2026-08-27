import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import type { UserProfile, UserStatus } from '../auth/contracts.js';
import {
  HttpError,
  badRequest,
  httpErrorBody,
  unprocessableEntity,
} from '../security/http-error.js';
import type {
  AdministrativeReasonCode,
  AdministrativeSafeReceipt,
} from './contracts.js';
import type { AdministrativeUserView } from './user-contracts.js';
import type {
  AdministrativeUserListQuery,
  AdministrativeUserService,
} from './user-service.js';

export interface AdministrativeUserRoutesOptions {
  readonly service: AdministrativeUserService;
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

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

const userResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacao_id: { type: 'string', const: 'org_tche_fertilidade' },
    produtor_id: {
      anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
    },
    nome: { type: 'string' },
    email: { type: 'string' },
    perfil: { type: 'string', enum: ['admin', 'colaborador', 'produtor'] },
    status: { type: 'string', enum: ['pendente', 'ativo', 'inativo'] },
    telefone: nullableStringSchema,
    documento: nullableStringSchema,
    observacoes: nullableStringSchema,
    versao: { type: 'integer', minimum: 1 },
    criado_em: { type: 'string', format: 'date-time' },
    atualizado_em: { type: 'string', format: 'date-time' },
  },
} as const;

const receiptResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['resultado', 'recurso_tipo', 'recurso_id'],
  properties: {
    resultado: {
      type: 'string',
      enum: ['criado', 'atualizado', 'status_alterado', 'convite_emitido'],
    },
    recurso_tipo: { type: 'string', enum: ['usuario', 'convite'] },
    recurso_id: { type: 'string', format: 'uuid' },
    versao: { type: 'integer', minimum: 1 },
  },
} as const;

const idParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const idempotencyHeadersSchema = {
  type: 'object',
  required: ['idempotency-key'],
  properties: {
    'idempotency-key': {
      type: 'string',
      pattern: '^[A-Za-z0-9._:/-]{1,128}$',
    },
  },
} as const;

const commonMutationResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
  503: errorResponseSchema,
} as const;

const USER_LIST_QUERY_PARAMETERS = new Set([
  'busca',
  'perfil',
  'status',
  'limite',
  'cursor',
]);
const NO_QUERY_PARAMETERS = new Set<string>();

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
}

function isValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'validation' in error &&
    error.validation !== undefined
  );
}

const SAFE_FASTIFY_BODY_ERROR_CODES = new Set([
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
]);

function safeFastifyBodyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && SAFE_FASTIFY_BODY_ERROR_CODES.has(error.code);
}

function semanticValidationError(error: unknown): boolean {
  if (!isValidationError(error)) return false;
  const validation = (error as { validation?: unknown }).validation;
  if (!Array.isArray(validation) || validation.length === 0) return false;
  const semanticKeywords = new Set([
    'enum', 'minimum', 'maximum', 'minLength', 'maxLength',
  ]);
  return validation.every((entry) =>
    typeof entry === 'object'
    && entry !== null
    && 'keyword' in entry
    && typeof entry.keyword === 'string'
    && semanticKeywords.has(entry.keyword));
}

function formalCursorValidationError(error: unknown): boolean {
  if (!isValidationError(error)) return false;
  const validation = (error as { validation?: unknown }).validation;
  if (!Array.isArray(validation)) return false;
  return validation.some((entry) =>
    typeof entry === 'object'
    && entry !== null
    && 'instancePath' in entry
    && entry.instancePath === '/cursor'
    && 'keyword' in entry
    && (entry.keyword === 'minLength' || entry.keyword === 'maxLength'));
}

function assertOnlyAllowedQueryParameters(
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

function assertOnlyFields(value: unknown, allowed: ReadonlySet<string>): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest();
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw badRequest();
  }
}

function externalUser(user: AdministrativeUserView) {
  return {
    id: user.id,
    organizacao_id: user.organizationId,
    produtor_id: user.profile === 'produtor' ? user.producerId : null,
    nome: user.name,
    email: user.email,
    perfil: user.profile,
    status: user.status,
    telefone: user.phone,
    documento: user.document,
    observacoes: user.notes,
    versao: user.version,
    criado_em: user.createdAt.toISOString(),
    atualizado_em: user.updatedAt.toISOString(),
  };
}

function externalReceipt(receipt: AdministrativeSafeReceipt) {
  return {
    resultado: receipt.outcome,
    recurso_tipo: receipt.resourceType,
    recurso_id: receipt.resourceId,
    ...('version' in receipt ? { versao: receipt.version } : {}),
  };
}

function idempotencyKey(headers: Readonly<Record<string, unknown>>): string {
  const value = headers['idempotency-key'];
  if (typeof value !== 'string') throw badRequest();
  return value;
}

export const administrativeUserRoutesPlugin: FastifyPluginAsync<
  AdministrativeUserRoutesOptions
> = async (app, options) => {
  app.addHook('onRequest', async (_request, reply) => {
    noStore(reply);
  });

  app.setErrorHandler(async (error, request, reply) => {
    const safeError =
      error instanceof HttpError
        ? error
        : formalCursorValidationError(error)
          ? badRequest()
        : semanticValidationError(error)
          ? unprocessableEntity(
              'A requisição contém valor semanticamente inválido.',
              'validation_error',
            )
          : isValidationError(error) || safeFastifyBodyError(error)
            ? badRequest()
            : undefined;
    if (safeError === undefined) {
      request.log.error(
        { event: 'administrative_user_request_failed' },
        'Administrative user request processing failed.',
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
    if (safeError.statusCode === 401) reply.header('www-authenticate', 'Bearer');
    return reply
      .code(safeError.statusCode)
      .send(httpErrorBody(safeError, request.id));
  });

  app.get<{ Querystring: AdministrativeUserListQuery }>(
    '/',
    {
      prefixTrailingSlash: 'no-slash',
      schema: {
        operationId: 'getAdministrativeUsers',
        summary: 'Lista Usuários para administração global',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            busca: { type: 'string', minLength: 1 },
            perfil: {
              type: 'string',
              enum: ['admin', 'colaborador', 'produtor'],
            },
            status: {
              type: 'string',
              enum: ['pendente', 'ativo', 'inativo'],
            },
            limite: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            cursor: { type: 'string', minLength: 1, maxLength: 2_048 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['itens', 'paginacao'],
            properties: {
              itens: { type: 'array', items: userResponseSchema },
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
          403: errorResponseSchema,
          422: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(
        request.raw.url,
        USER_LIST_QUERY_PARAMETERS,
      );
      const page = await options.service.list({
        authorization: request.headers.authorization,
        query: request.query,
      });
      return reply.code(200).send({
        itens: page.items.map(externalUser),
        paginacao: { proximo_cursor: page.nextCursor },
      });
    },
  );

  app.post<{
    Headers: { 'idempotency-key': string };
    Body: {
      nome: string;
      email: string;
      perfil: UserProfile;
      telefone?: string;
      documento?: string;
      observacoes?: string;
    };
  }>(
    '/',
    {
      prefixTrailingSlash: 'no-slash',
      preValidation: async (request) => {
        assertOnlyFields(
          request.body,
          new Set([
            'nome',
            'email',
            'perfil',
            'telefone',
            'documento',
            'observacoes',
          ]),
        );
      },
      schema: {
        operationId: 'postAdministrativeUser',
        summary: 'Cria Usuário pendente e emite convite',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        headers: idempotencyHeadersSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['nome', 'email', 'perfil'],
          properties: {
            nome: { type: 'string', minLength: 1 },
            email: { type: 'string', minLength: 1 },
            perfil: {
              type: 'string',
              enum: ['admin', 'colaborador', 'produtor'],
            },
            telefone: { type: 'string', minLength: 1 },
            documento: { type: 'string', minLength: 1 },
            observacoes: { type: 'string', minLength: 1 },
          },
        },
        response: { 201: receiptResponseSchema, ...commonMutationResponses },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const result = await options.service.create({
        authorization: request.headers.authorization,
        idempotencyKey: idempotencyKey(request.headers),
        requestId: request.id,
        body: request.body,
      });
      return reply.code(result.httpStatus).send(externalReceipt(result.receipt));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        operationId: 'getAdministrativeUserById',
        summary: 'Detalha um Usuário para administração global',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: userResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const user = await options.service.detail({
        authorization: request.headers.authorization,
        userId: request.params.id,
      });
      return reply.code(200).send(externalUser(user));
    },
  );

  app.patch<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
    Body: {
      versao: number;
      nome?: string;
      email?: string;
      telefone?: string | null;
      documento?: string | null;
      observacoes?: string | null;
    };
  }>(
    '/:id',
    {
      preValidation: async (request) => {
        assertOnlyFields(
          request.body,
          new Set([
            'versao',
            'nome',
            'email',
            'telefone',
            'documento',
            'observacoes',
          ]),
        );
      },
      schema: {
        operationId: 'patchAdministrativeUser',
        summary: 'Atualiza dados cadastrais versionados de um Usuário',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        headers: idempotencyHeadersSchema,
        params: idParamsSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['versao'],
          properties: {
            versao: { type: 'integer', minimum: 1 },
            nome: { type: 'string', minLength: 1 },
            email: { type: 'string', minLength: 1 },
            telefone: {
              anyOf: [
                { type: 'string', minLength: 1 },
                { type: 'null' },
              ],
            },
            documento: {
              anyOf: [
                { type: 'string', minLength: 1 },
                { type: 'null' },
              ],
            },
            observacoes: {
              anyOf: [
                { type: 'string', minLength: 1 },
                { type: 'null' },
              ],
            },
          },
        },
        response: { 200: receiptResponseSchema, ...commonMutationResponses },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const result = await options.service.update({
        authorization: request.headers.authorization,
        idempotencyKey: idempotencyKey(request.headers),
        requestId: request.id,
        userId: request.params.id,
        body: request.body,
      });
      return reply.code(result.httpStatus).send(externalReceipt(result.receipt));
    },
  );

  app.patch<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
    Body: {
      versao: number;
      status: Extract<UserStatus, 'ativo' | 'inativo'>;
      motivo: AdministrativeReasonCode;
      motivo_detalhe?: string;
    };
  }>(
    '/:id/status',
    {
      preValidation: async (request) => {
        assertOnlyFields(
          request.body,
          new Set(['versao', 'status', 'motivo', 'motivo_detalhe']),
        );
      },
      schema: {
        operationId: 'patchAdministrativeUserStatus',
        summary: 'Alterna Usuário ativo ou inativo; pendente retorna 422',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        headers: idempotencyHeadersSchema,
        params: idParamsSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['versao', 'status', 'motivo'],
          properties: {
            versao: { type: 'integer', minimum: 1 },
            status: { type: 'string', enum: ['ativo', 'inativo'] },
            motivo: {
              type: 'string',
              enum: [
                'fim_relacao',
                'mudanca_responsabilidade',
                'cadastro_duplicado',
                'correcao_administrativa',
                'suspensao_operacional',
                'outro',
              ],
            },
            motivo_detalhe: {
              type: 'string',
              minLength: 1,
            },
          },
        },
        response: { 200: receiptResponseSchema, ...commonMutationResponses },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const result = await options.service.changeStatus({
        authorization: request.headers.authorization,
        idempotencyKey: idempotencyKey(request.headers),
        requestId: request.id,
        userId: request.params.id,
        body: request.body,
      });
      return reply.code(result.httpStatus).send(externalReceipt(result.receipt));
    },
  );

  app.post<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
    Body: { modo_ativacao: string };
  }>(
    '/:id/convites',
    {
      preValidation: async (request) => {
        assertOnlyFields(request.body, new Set(['modo_ativacao']));
      },
      schema: {
        operationId: 'postAdministrativeUserInvitation',
        summary: 'Emite ou substitui o convite de um Usuário pendente',
        tags: ['Administração de Usuários'],
        security: [{ bearerAuth: [] }],
        headers: idempotencyHeadersSchema,
        params: idParamsSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['modo_ativacao'],
          properties: {
            modo_ativacao: { type: 'string', enum: ['ativar_usuario'] },
          },
        },
        response: { 201: receiptResponseSchema, ...commonMutationResponses },
      },
    },
    async (request, reply) => {
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const result = await options.service.issueInvitation({
        authorization: request.headers.authorization,
        idempotencyKey: idempotencyKey(request.headers),
        requestId: request.id,
        userId: request.params.id,
        body: request.body,
      });
      return reply.code(result.httpStatus).send(externalReceipt(result.receipt));
    },
  );
};
