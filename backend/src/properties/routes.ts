import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { bearerTokenFromAuthorizationHeader } from '../auth/service.js';
import {
  HttpError,
  badRequest,
  httpErrorBody,
} from '../security/http-error.js';
import type { PropertyView } from './contracts.js';
import type { PropertyListQuery, PropertyService } from './service.js';

export interface PropertyRoutesOptions {
  readonly service: PropertyService;
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

const nullableNumberSchema = {
  anyOf: [{ type: 'number' }, { type: 'null' }],
} as const;
const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

const propertyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
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
    'cultura_principal',
    'status',
    'tipo_acesso',
    'versao',
    'criado_em',
    'atualizado_em',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    organizacao_id: { type: 'string' },
    titular_id: { type: 'string', format: 'uuid' },
    titular: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'nome'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        nome: { type: 'string' },
      },
    },
    nome: { type: 'string' },
    municipio_id: { type: 'string' },
    municipio_nome: { type: 'string' },
    uf_id: { type: 'string' },
    uf_sigla: { type: 'string', pattern: '^[A-Z]{2}$' },
    area_total: nullableNumberSchema,
    cultura_principal: nullableStringSchema,
    status: { type: 'string', enum: ['ativa', 'inativa'] },
    tipo_acesso: {
      type: 'string',
      enum: ['admin', 'titular', 'usuario_autorizado', 'colaborador'],
    },
    versao: { type: 'integer', minimum: 1 },
    criado_em: { type: 'string', format: 'date-time' },
    atualizado_em: { type: 'string', format: 'date-time' },
  },
} as const;

const propertyIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

function externalProperty(property: PropertyView) {
  return {
    id: property.id,
    organizacao_id: property.organizationId,
    titular_id: property.holderId,
    titular: {
      id: property.holder.id,
      nome: property.holder.name,
    },
    nome: property.name,
    municipio_id: property.municipalityId,
    municipio_nome: property.municipalityName,
    uf_id: property.stateId,
    uf_sigla: property.stateCode,
    area_total: property.totalArea,
    cultura_principal: property.mainCrop,
    status: property.status,
    tipo_acesso: property.accessType,
    versao: property.version,
    criado_em: property.createdAt.toISOString(),
    atualizado_em: property.updatedAt.toISOString(),
  };
}

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
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

const PROPERTY_LIST_QUERY_PARAMETERS = new Set([
  'busca',
  'status',
  'uf',
  'municipio',
  'limite',
  'cursor',
]);
const NO_QUERY_PARAMETERS = new Set<string>();

export const propertyRoutesPlugin: FastifyPluginAsync<
  PropertyRoutesOptions
> = async (app, options) => {
  app.addHook('onRequest', async (_request, reply) => {
    noStore(reply);
  });

  app.setErrorHandler(async (error, request, reply) => {
    const isValidationError =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    const safeError =
      error instanceof HttpError
        ? error
        : isValidationError
          ? badRequest()
          : undefined;
    if (safeError === undefined) {
      request.log.error(
        { event: 'property_request_failed' },
        'Property request processing failed.',
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

  app.get<{ Querystring: PropertyListQuery }>(
    '/',
    {
      prefixTrailingSlash: 'no-slash',
      schema: {
        operationId: 'getProperties',
        summary: 'Lista Propriedades dentro do escopo autorizado',
        description:
          'UF compara uf_id ou uf_sigla; Município compara municipio_id ou nome. Os filtros somente reduzem o escopo autorizado.',
        tags: ['Propriedades'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            busca: { type: 'string', minLength: 1, maxLength: 200 },
            status: { type: 'string', enum: ['ativa', 'inativa'] },
            uf: { type: 'string', minLength: 1, maxLength: 100 },
            municipio: { type: 'string', minLength: 1, maxLength: 200 },
            limite: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            cursor: { type: 'string', minLength: 1, maxLength: 32_768 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['itens', 'paginacao'],
            properties: {
              itens: { type: 'array', items: propertyResponseSchema },
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
      noStore(reply);
      assertOnlyAllowedQueryParameters(
        request.raw.url,
        PROPERTY_LIST_QUERY_PARAMETERS,
      );
      const page = await options.service.list({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        query: request.query,
      });
      return reply.code(200).send({
        itens: page.items.map(externalProperty),
        paginacao: { proximo_cursor: page.nextCursor },
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        operationId: 'getPropertyById',
        summary: 'Retorna uma Propriedade autorizada por ID',
        tags: ['Propriedades'],
        security: [{ bearerAuth: [] }],
        params: propertyIdParamsSchema,
        response: {
          200: propertyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      noStore(reply);
      assertOnlyAllowedQueryParameters(request.raw.url, NO_QUERY_PARAMETERS);
      const property = await options.service.detail({
        accessToken: bearerTokenFromAuthorizationHeader(
          request.headers.authorization,
        ),
        propertyId: request.params.id,
      });
      return reply.code(200).send(externalProperty(property));
    },
  );
};
