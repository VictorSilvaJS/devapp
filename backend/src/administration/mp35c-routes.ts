import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { HttpError, badRequest, httpErrorBody, unprocessableEntity } from '../security/http-error.js';
import type { AdministrativeReasonCode } from './contracts.js';
import type { Mp35cService } from './mp35c-service.js';
import {
  ADMINISTRATIVE_AREA_PATTERN_SOURCE,
  CANONICAL_UUID_V4_PATTERN_SOURCE,
  normalizeAdministrativeArea,
} from './validation.js';

export interface Mp35cRoutesOptions { readonly service: Mp35cService }

const reasons = ['fim_relacao', 'mudanca_responsabilidade', 'cadastro_duplicado',
  'correcao_administrativa', 'suspensao_operacional', 'outro'] as const;
const errorSchema = { type: 'object', additionalProperties: false, required: ['error'],
  properties: { error: { type: 'object', additionalProperties: false,
    required: ['code', 'message', 'request_id', 'details'], properties: {
      code: { type: 'string' }, message: { type: 'string' }, request_id: { type: 'string' },
      details: { type: 'array', items: { type: 'object' } },
    } } } } as const;
const idParams = { type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE } } } as const;
const idempotencyHeaders = { type: 'object', required: ['idempotency-key'], properties: {
  'idempotency-key': { type: 'string', pattern: '^[A-Za-z0-9._:/-]{1,128}$' },
} } as const;
const receiptSchema = { type: 'object', additionalProperties: false,
  required: ['resultado', 'recurso_tipo', 'recurso_id', 'versao'], properties: {
    resultado: { type: 'string', enum: ['criado', 'atualizado', 'status_alterado', 'vinculos_alterados'] },
    recurso_tipo: { type: 'string', enum: ['propriedade', 'vinculo'] },
    recurso_id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE },
    versao: { type: 'integer', minimum: 1 },
  } } as const;
const mutationResponses = { 400: errorSchema, 401: errorSchema, 403: errorSchema,
  404: errorSchema, 409: errorSchema, 422: errorSchema, 500: errorSchema, 503: errorSchema } as const;
const reasonProperties = { motivo: { type: 'string', enum: reasons },
  motivo_detalhe: { type: 'string', minLength: 1, maxLength: 300 } } as const;
const propertyPatchForbiddenFields = new Set([
  'titular_id', 'status', 'criado_em', 'atualizado_em', 'uf_id', 'uf_sigla',
  'municipio_nome', 'localidades_versao_id', 'tipo_vinculo',
]);
const propertyCreateForbiddenFields = new Set([
  'criado_em', 'atualizado_em', 'uf_id', 'uf_sigla',
  'municipio_nome', 'localidades_versao_id', 'tipo_vinculo',
]);
const linkDeltaForbiddenFields = new Set(['tipo_vinculo']);

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store'); reply.header('pragma', 'no-cache');
}
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
type RawFieldType = 'string' | 'uuid' | 'number' | 'nullable_string'
  | 'string_array' | 'uuid_array';

function assertStructuralBody(value: unknown, allowed: ReadonlySet<string>,
  required: readonly string[], fields: Readonly<Record<string, RawFieldType>>): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw badRequest();
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw badRequest();
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (required.some((field) => !Object.hasOwn(record, field))) throw badRequest();
  for (const [field, expected] of Object.entries(fields)) {
    if (!(field in record)) continue;
    const item = record[field];
    const valid = expected === 'string' ? typeof item === 'string'
      : expected === 'uuid' ? typeof item === 'string' && UUID_SHAPE.test(item)
      : expected === 'number' ? typeof item === 'number'
      : expected === 'nullable_string' ? item === null || typeof item === 'string'
      : expected === 'string_array'
        ? Array.isArray(item) && item.every((entry) => typeof entry === 'string')
        : Array.isArray(item) && item.every((entry) =>
          typeof entry === 'string' && UUID_SHAPE.test(entry));
    if (!valid) throw badRequest();
  }
}
function assertNoSemanticForbidden(value: unknown, forbidden: ReadonlySet<string>): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw badRequest();
  if (Object.keys(value).some((field) => forbidden.has(field))) {
    throw unprocessableEntity(
      'A requisição contém valor semanticamente inválido.', 'validation_error');
  }
}
function assertParamUuid(params: unknown): void {
  if (typeof params !== 'object' || params === null || Array.isArray(params)
    || !('id' in params) || typeof params.id !== 'string' || !UUID_SHAPE.test(params.id)) {
    throw badRequest();
  }
}
function assertRawText(value: unknown, field: string, maximum: number): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  const item = (value as Readonly<Record<string, unknown>>)[field];
  if (item === undefined || item === null || typeof item !== 'string') return;
  if (item.trim().length === 0 || item !== item.trim()
    || Array.from(item.normalize('NFC')).length > maximum) {
    throw unprocessableEntity(
      'A requisição contém valor semanticamente inválido.', 'validation_error');
  }
}
function assertRawPositive(value: unknown, field: string, integer: boolean): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  const item = (value as Readonly<Record<string, unknown>>)[field];
  if (item === undefined || item === null || typeof item !== 'number') return;
  if (!Number.isFinite(item) || item <= 0 || (integer && !Number.isSafeInteger(item))) {
    throw unprocessableEntity(
      'A requisição contém valor semanticamente inválido.', 'validation_error');
  }
}
function assertRawArea(value: unknown, field: string, allowNull: boolean): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  const item = (value as Readonly<Record<string, unknown>>)[field];
  if (item === undefined || (item === null && allowNull)) return;
  try { normalizeAdministrativeArea(item, field); }
  catch (error) {
    if (error instanceof TypeError) throw unprocessableEntity(
      'A requisição contém valor semanticamente inválido.', 'validation_error');
    throw error;
  }
}
function assertQuery(rawUrl: string | undefined, allowed: ReadonlySet<string>): void {
  const index = rawUrl?.indexOf('?') ?? -1;
  if (index < 0 || rawUrl === undefined) return;
  for (const key of new URLSearchParams(rawUrl.slice(index + 1)).keys()) {
    if (!allowed.has(key)) throw badRequest();
  }
}
function receipt(value: Awaited<ReturnType<Mp35cService['createProperty']>>['receipt']) {
  return { resultado: value.outcome, recurso_tipo: value.resourceType,
    recurso_id: value.resourceId, ...('version' in value ? { versao: value.version } : {}) };
}
function isValidation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'validation' in error;
}
function semanticValidation(error: unknown): boolean {
  if (!isValidation(error)) return false;
  const entries = (error as { validation?: unknown }).validation;
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const hasAnyOf = entries.some((entry) => typeof entry === 'object'
    && entry !== null && 'keyword' in entry && entry.keyword === 'anyOf');
  let semantic = false;
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || !('keyword' in entry)) return false;
    const validation = entry as { keyword: string; instancePath?: string;
      params?: { additionalProperty?: string } };
    if (validation.keyword === 'additionalProperties') return false;
    if (validation.instancePath?.endsWith('/cursor') === true
      && (validation.keyword === 'minLength' || validation.keyword === 'maxLength')) return false;
    if (['enum', 'minimum', 'maximum', 'exclusiveMinimum', 'minLength', 'maxLength',
      'minItems', 'maxItems', 'uniqueItems', 'pattern'].includes(validation.keyword)) {
      semantic = true;
      continue;
    }
    if (validation.keyword === 'anyOf' || (hasAnyOf && validation.keyword === 'type')) continue;
    return false;
  }
  return semantic;
}
function key(headers: Readonly<Record<string, unknown>>): string {
  const value = headers['idempotency-key']; if (typeof value !== 'string') throw badRequest(); return value;
}

export const mp35cRoutesPlugin: FastifyPluginAsync<Mp35cRoutesOptions> = async (app, options) => {
  const rawBodies = new WeakMap<FastifyRequest, unknown>();
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' },
    (request, body, done) => {
      try {
        const parsed = JSON.parse(body.toString());
        rawBodies.set(request, structuredClone(parsed));
        done(null, parsed);
      } catch {
        done(badRequest());
      }
    });
  app.addHook('onRequest', async (_request, reply) => { noStore(reply); });
  app.setErrorHandler(async (error, request, reply) => {
    const safe = error instanceof HttpError ? error
      : semanticValidation(error) ? unprocessableEntity(
        'A requisição contém valor semanticamente inválido.', 'validation_error')
      : isValidation(error)
        || (typeof error === 'object' && error !== null && 'statusCode' in error
          && error.statusCode === 400) ? badRequest() : undefined;
    if (safe === undefined) {
      request.log.error({ event: 'mp35c_request_failed' }, 'MP-35C request processing failed.');
      return reply.code(500).send({ error: { code: 'internal_error', message: 'Erro interno.',
        request_id: request.id, details: [] } });
    }
    if (safe.statusCode === 401) reply.header('www-authenticate', 'Bearer');
    return reply.code(safe.statusCode).send(httpErrorBody(safe, request.id));
  });

  app.post<{ Headers: { 'idempotency-key': string }; Body: { nome: string; titular_id: string;
    municipio_id: string; area_total?: string | null; cultura_principal?: string; status: 'ativa' | 'inativa' } }>(
    '/v1/propriedades', { preValidation: async (request) => {
      const body = rawBodies.get(request) ?? request.body;
      assertStructuralBody(body, new Set([
        'nome', 'titular_id', 'municipio_id', 'area_total', 'cultura_principal', 'status',
        ...propertyCreateForbiddenFields,
      ]), ['nome', 'titular_id', 'municipio_id', 'status'], {
        nome: 'string', titular_id: 'uuid', municipio_id: 'string',
        area_total: 'nullable_string', cultura_principal: 'string', status: 'string',
        criado_em: 'string', atualizado_em: 'string', uf_id: 'string', uf_sigla: 'string',
        municipio_nome: 'string', localidades_versao_id: 'string', tipo_vinculo: 'string',
      });
    }, preHandler: async (request) => {
      const body = rawBodies.get(request) ?? request.body;
      assertNoSemanticForbidden(body, propertyCreateForbiddenFields);
      assertRawText(body, 'nome', 200);
      assertRawText(body, 'cultura_principal', 120);
      assertRawArea(body, 'area_total', false);
    },
      schema: { operationId: 'postAdministrativeProperty', summary: 'Cria Propriedade',
        tags: ['Administração de Propriedades'], security: [{ bearerAuth: [] }],
        headers: idempotencyHeaders, body: { type: 'object', additionalProperties: false,
          required: ['nome', 'titular_id', 'municipio_id', 'status'], properties: {
            nome: { type: 'string', minLength: 1, maxLength: 200 },
            titular_id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE },
            municipio_id: { type: 'string', pattern: '^[0-9]{7}$' },
            area_total: { anyOf: [{ type: 'string', pattern: ADMINISTRATIVE_AREA_PATTERN_SOURCE,
              examples: ['0.0001', '1', '1.25', '9999999999.9999'] }, { type: 'null' }] },
            cultura_principal: { type: 'string', minLength: 1, maxLength: 120 },
            status: { type: 'string', enum: ['ativa', 'inativa'] },
            criado_em: { type: 'string' }, atualizado_em: { type: 'string' },
            uf_id: { type: 'string' }, uf_sigla: { type: 'string' },
            municipio_nome: { type: 'string' }, localidades_versao_id: { type: 'string' },
            tipo_vinculo: { type: 'string' },
          } }, response: { 201: receiptSchema, ...mutationResponses } } },
    async (request, reply) => { assertQuery(request.raw.url, new Set());
      const result = await options.service.createProperty({ authorization: request.headers.authorization,
        idempotencyKey: key(request.headers), requestId: request.id, body: request.body });
      return reply.code(result.httpStatus).send(receipt(result.receipt)); },
  );

  app.patch<{ Params: { id: string }; Headers: { 'idempotency-key': string };
    Body: { versao: number; nome?: string; municipio_id?: string;
      area_total?: string | null; cultura_principal?: string | null } }>(
    '/v1/propriedades/:id', { preValidation: async (request) => {
      assertParamUuid(request.params);
      const body = rawBodies.get(request) ?? request.body;
      assertStructuralBody(body, new Set([
        'versao', 'nome', 'municipio_id', 'area_total', 'cultura_principal',
        ...propertyPatchForbiddenFields,
      ]), ['versao'], { versao: 'number', nome: 'string', municipio_id: 'string',
        area_total: 'nullable_string', cultura_principal: 'nullable_string',
        titular_id: 'uuid', status: 'string', criado_em: 'string', atualizado_em: 'string',
        uf_id: 'string', uf_sigla: 'string', municipio_nome: 'string',
        localidades_versao_id: 'string', tipo_vinculo: 'string' });
    }, preHandler: async (request) => {
      const body = rawBodies.get(request) ?? request.body;
      assertNoSemanticForbidden(body, propertyPatchForbiddenFields);
      assertRawPositive(body, 'versao', true);
      assertRawArea(body, 'area_total', true);
      assertRawText(body, 'nome', 200);
      assertRawText(body, 'cultura_principal', 120);
    },
      schema: { operationId: 'patchAdministrativeProperty', summary: 'Atualiza cadastro da Propriedade',
        tags: ['Administração de Propriedades'], security: [{ bearerAuth: [] }], headers: idempotencyHeaders,
        params: idParams, body: { type: 'object', additionalProperties: false, required: ['versao'], properties: {
          versao: { type: 'integer', minimum: 1 }, nome: { type: 'string', minLength: 1, maxLength: 200 },
          municipio_id: { type: 'string', pattern: '^[0-9]{7}$' },
          area_total: { anyOf: [{ type: 'string', pattern: ADMINISTRATIVE_AREA_PATTERN_SOURCE,
            examples: ['0.0001', '1', '1.25', '9999999999.9999'] }, { type: 'null' }] },
          cultura_principal: { anyOf: [{ type: 'string', minLength: 1, maxLength: 120 }, { type: 'null' }] },
          titular_id: { type: 'string' }, status: { type: 'string' },
          criado_em: { type: 'string' }, atualizado_em: { type: 'string' },
          uf_id: { type: 'string' }, uf_sigla: { type: 'string' },
          municipio_nome: { type: 'string' }, localidades_versao_id: { type: 'string' },
          tipo_vinculo: { type: 'string' },
        } }, response: { 200: receiptSchema, ...mutationResponses } } },
    async (request, reply) => { assertQuery(request.raw.url, new Set());
      const result = await options.service.updateProperty({ authorization: request.headers.authorization,
        idempotencyKey: key(request.headers), requestId: request.id,
        propertyId: request.params.id, body: request.body });
      return reply.code(result.httpStatus).send(receipt(result.receipt)); },
  );

  app.patch<{ Params: { id: string }; Headers: { 'idempotency-key': string };
    Body: { versao: number; status: 'ativa' | 'inativa'; motivo: AdministrativeReasonCode; motivo_detalhe?: string } }>(
    '/v1/propriedades/:id/status', { preValidation: async (request) => {
      assertParamUuid(request.params);
      const body = rawBodies.get(request) ?? request.body;
      assertStructuralBody(body, new Set(['versao', 'status', 'motivo', 'motivo_detalhe']),
        ['versao', 'status', 'motivo'], { versao: 'number', status: 'string', motivo: 'string',
          motivo_detalhe: 'string' });
    }, preHandler: async (request) => {
      const body = rawBodies.get(request) ?? request.body;
      assertRawPositive(body, 'versao', true);
      assertRawText(body, 'motivo_detalhe', 300);
    },
      schema: { operationId: 'patchAdministrativePropertyStatus', summary: 'Muda status da Propriedade com motivo',
        tags: ['Administração de Propriedades'], security: [{ bearerAuth: [] }], headers: idempotencyHeaders,
        params: idParams, body: { type: 'object', additionalProperties: false,
          required: ['versao', 'status', 'motivo'], properties: { versao: { type: 'integer', minimum: 1 },
            status: { type: 'string', enum: ['ativa', 'inativa'] }, ...reasonProperties } },
        response: { 200: receiptSchema, ...mutationResponses } } },
    async (request, reply) => { assertQuery(request.raw.url, new Set());
      const result = await options.service.changePropertyStatus({ authorization: request.headers.authorization,
        idempotencyKey: key(request.headers), requestId: request.id,
        propertyId: request.params.id, body: request.body });
      return reply.code(result.httpStatus).send(receipt(result.receipt)); },
  );

  const relationSchema = { type: 'object', additionalProperties: false,
    required: ['id', 'propriedade_id', 'propriedade_nome', 'propriedade_status',
      'origem_acesso', 'tipo_vinculo', 'status_vinculo', 'editavel',
      'versao_vinculo', 'motivo', 'criado_em', 'atualizado_em'],
    properties: { id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE },
      propriedade_id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE },
      propriedade_nome: { type: 'string' }, propriedade_status: { type: 'string', enum: ['ativa', 'inativa'] },
      origem_acesso: { type: 'string', enum: ['titularidade', 'vinculo_direto'] },
      tipo_vinculo: { type: 'string', enum: ['titular', 'usuario_autorizado', 'colaborador'] },
      status_vinculo: { anyOf: [{ type: 'string', enum: ['ativo', 'inativo'] }, { type: 'null' }] },
      editavel: { type: 'boolean' },
      versao_vinculo: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
      motivo: { anyOf: [{ type: 'object', additionalProperties: false, required: ['codigo', 'detalhe'],
        properties: { codigo: { type: 'string' }, detalhe: { anyOf: [{ type: 'string' }, { type: 'null' }] } } }, { type: 'null' }] },
      criado_em: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
      atualizado_em: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
    } } as const;

  app.get<{ Params: { id: string }; Querystring: { busca?: string;
    tipo_acesso?: 'titular' | 'usuario_autorizado' | 'colaborador';
    status_vinculo?: 'ativo' | 'inativo'; limite?: number; cursor?: string } }>(
    '/v1/usuarios/:id/propriedades', { preValidation: async (request) => {
      assertParamUuid(request.params);
    }, schema: { operationId: 'getAdministrativeUserProperties',
      summary: 'Lista titularidades derivadas e vínculos diretos do Usuário', tags: ['Administração de Vínculos'],
      security: [{ bearerAuth: [] }], params: idParams, querystring: { type: 'object', additionalProperties: false,
        properties: { busca: { type: 'string', minLength: 1, maxLength: 200 },
          tipo_acesso: { type: 'string', enum: ['titular', 'usuario_autorizado', 'colaborador'] },
          status_vinculo: { type: 'string', enum: ['ativo', 'inativo'] },
          limite: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          cursor: { type: 'string', minLength: 1, maxLength: 2048 } } },
      response: { 200: { type: 'object', additionalProperties: false,
        required: ['usuario_id', 'versao', 'itens', 'paginacao'], properties: {
          usuario_id: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE },
          versao: { type: 'integer', minimum: 1 },
          itens: { type: 'array', items: relationSchema }, paginacao: { type: 'object', additionalProperties: false,
            required: ['proximo_cursor'], properties: { proximo_cursor: { anyOf: [{ type: 'string' }, { type: 'null' }] } } },
        } }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema,
        422: errorSchema, 500: errorSchema, 503: errorSchema } } },
    async (request, reply) => { assertQuery(request.raw.url,
      new Set(['busca', 'tipo_acesso', 'status_vinculo', 'limite', 'cursor']));
      const page = await options.service.listUserProperties({ authorization: request.headers.authorization,
        userId: request.params.id, query: request.query });
      return reply.code(200).send({ usuario_id: request.params.id, versao: page.userVersion,
        itens: page.items.map((item) => ({ id: item.id, propriedade_id: item.propertyId,
          propriedade_nome: item.propertyName, propriedade_status: item.propertyStatus,
          origem_acesso: item.accessOrigin, tipo_vinculo: item.linkType,
          status_vinculo: item.linkStatus, editavel: item.editable,
          versao_vinculo: item.linkVersion,
          motivo: item.reasonCode === null ? null : { codigo: item.reasonCode, detalhe: item.reasonDetail },
          criado_em: item.createdAt?.toISOString() ?? null,
          atualizado_em: item.updatedAt?.toISOString() ?? null })),
        paginacao: { proximo_cursor: page.nextCursor } }); },
  );

  app.patch<{ Params: { id: string }; Headers: { 'idempotency-key': string };
    Body: { versao: number; adicionar: readonly string[]; remover: readonly string[];
      motivo: AdministrativeReasonCode; motivo_detalhe?: string } }>(
    '/v1/usuarios/:id/propriedades', { preValidation: async (request) => {
      assertParamUuid(request.params);
      const body = rawBodies.get(request) ?? request.body;
      assertStructuralBody(body, new Set([
        'versao', 'adicionar', 'remover', 'motivo', 'motivo_detalhe',
        ...linkDeltaForbiddenFields,
      ]), ['versao', 'adicionar', 'remover', 'motivo'], {
        versao: 'number', adicionar: 'uuid_array', remover: 'uuid_array',
        motivo: 'string', motivo_detalhe: 'string', tipo_vinculo: 'string',
      });
    }, preHandler: async (request) => {
      const body = rawBodies.get(request) ?? request.body;
      assertNoSemanticForbidden(body, linkDeltaForbiddenFields);
      assertRawPositive(body, 'versao', true);
      assertRawText(body, 'motivo_detalhe', 300);
    },
      schema: { operationId: 'patchAdministrativeUserProperties',
        summary: 'Aplica delta atômico de vínculos diretos', tags: ['Administração de Vínculos'],
        security: [{ bearerAuth: [] }], headers: idempotencyHeaders, params: idParams,
        body: { type: 'object', additionalProperties: false,
          required: ['versao', 'adicionar', 'remover', 'motivo'],
          properties: { versao: { type: 'integer', minimum: 1 },
            adicionar: { type: 'array', maxItems: 100, uniqueItems: true,
              items: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE } },
            remover: { type: 'array', maxItems: 100, uniqueItems: true,
              items: { type: 'string', format: 'uuid', pattern: CANONICAL_UUID_V4_PATTERN_SOURCE } },
            tipo_vinculo: { type: 'string' }, ...reasonProperties } },
        response: { 200: receiptSchema, ...mutationResponses } } },
    async (request, reply) => { assertQuery(request.raw.url, new Set());
      const result = await options.service.applyUserPropertyDelta({ authorization: request.headers.authorization,
        idempotencyKey: key(request.headers), requestId: request.id,
        userId: request.params.id, body: request.body });
      return reply.code(result.httpStatus).send(receipt(result.receipt)); },
  );

  app.get('/v1/localidades/ufs', { schema: { operationId: 'getAdministrativeStates',
    summary: 'Lista UFs do catálogo IBGE ativo', tags: ['Localidades'], security: [{ bearerAuth: [] }],
    response: { 200: { type: 'object', additionalProperties: false, required: ['versao_id', 'itens'],
      properties: { versao_id: { type: 'string' }, itens: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'sigla', 'nome'], properties: {
          id: { type: 'string', pattern: '^[0-9]{2}$' }, sigla: { type: 'string', pattern: '^[A-Z]{2}$' },
          nome: { type: 'string' } } } } } }, 400: errorSchema, 401: errorSchema, 403: errorSchema,
      500: errorSchema, 503: errorSchema } } }, async (request, reply) => {
        assertQuery(request.raw.url, new Set());
        const result = await options.service.listStates({ authorization: request.headers.authorization });
        return reply.code(200).send({ versao_id: result.versionId,
          itens: result.items.map((item) => ({ id: item.id, sigla: item.code, nome: item.name })) });
      });

  app.get<{ Querystring: { uf_id: string; busca?: string; limite?: number; cursor?: string } }>(
    '/v1/localidades/municipios', { schema: { operationId: 'getAdministrativeMunicipalities',
      summary: 'Lista Municípios paginados de uma UF', tags: ['Localidades'], security: [{ bearerAuth: [] }],
      querystring: { type: 'object', additionalProperties: false, required: ['uf_id'], properties: {
        uf_id: { type: 'string', pattern: '^[0-9]{2}$' }, busca: { type: 'string', minLength: 1, maxLength: 200 },
        limite: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        cursor: { type: 'string', minLength: 1, maxLength: 2048 } } },
      response: { 200: { type: 'object', additionalProperties: false,
        required: ['versao_id', 'itens', 'paginacao'], properties: { versao_id: { type: 'string' },
          itens: { type: 'array', items: { type: 'object', additionalProperties: false,
            required: ['id', 'nome', 'uf_id'], properties: { id: { type: 'string', pattern: '^[0-9]{7}$' },
              nome: { type: 'string' }, uf_id: { type: 'string', pattern: '^[0-9]{2}$' } } } },
          paginacao: { type: 'object', additionalProperties: false, required: ['proximo_cursor'],
            properties: { proximo_cursor: { anyOf: [{ type: 'string' }, { type: 'null' }] } } } } },
        400: errorSchema, 401: errorSchema, 403: errorSchema, 422: errorSchema,
        500: errorSchema, 503: errorSchema } } }, async (request, reply) => {
          assertQuery(request.raw.url, new Set(['uf_id', 'busca', 'limite', 'cursor']));
          const page = await options.service.listMunicipalities({ authorization: request.headers.authorization,
            query: request.query });
          return reply.code(200).send({ versao_id: page.versionId,
            itens: page.items.map((item) => ({ id: item.id, nome: item.name, uf_id: item.stateId })),
            paginacao: { proximo_cursor: page.nextCursor } });
        });
};
