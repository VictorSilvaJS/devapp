import { createHash } from 'node:crypto';

import type { AuthenticationService } from '../auth/service.js';
import { bearerTokenFromAuthorizationHeader } from '../auth/service.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unprocessableEntity,
} from '../security/http-error.js';
import type {
  AdditionalPropertyAccessType,
  AdministrativeReason,
  AdministrativeSafeReceipt,
} from './contracts.js';
import { ADMINISTRATION_LIMITS } from './contracts.js';
import type {
  Mp35cCommandIdentity,
  Mp35cMutationResult,
  Mp35cRepository,
  MunicipalityCursor,
  MunicipalityView,
  PropertyRelationCursor,
  PropertyRelationView,
  StateView,
} from './mp35c-contracts.js';
import { SecureAdministrativeCursorCodec } from './secure-cursor.js';
import {
  isCanonicalUuid,
  normalizeAdministrativeArea,
  requireCanonicalUuid,
  validateChangeAdministrativePropertyStatusCommand,
  validateCreateAdministrativePropertyCommand,
  validatePropertyLinkDeltaCommand,
  validateUpdateAdministrativePropertyCommand,
} from './validation.js';

const ORGANIZATION_ID = 'org_tche_fertilidade' as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:/-]{1,128}$/u;
const MUNICIPALITY_ID = /^[0-9]{7}$/u;
const STATE_ID = /^[0-9]{2}$/u;
const CATALOG_VERSION = /^ibge-localidades-[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

export interface Mp35cMutationResponse {
  readonly httpStatus: 200 | 201;
  readonly receipt: AdministrativeSafeReceipt;
}

export interface Mp35cService {
  listUserProperties(input: {
    readonly authorization: string | undefined; readonly userId: string;
    readonly query: Readonly<{ busca?: string; tipo_acesso?: 'titular' | AdditionalPropertyAccessType;
      status_vinculo?: 'ativo' | 'inativo'; limite?: number; cursor?: string }>;
  }): Promise<Readonly<{ userVersion: number; items: readonly PropertyRelationView[]; nextCursor: string | null }>>;
  applyUserPropertyDelta(input: {
    readonly authorization: string | undefined; readonly idempotencyKey: string;
    readonly requestId: string; readonly userId: string;
    readonly body: Readonly<{ versao: number; adicionar: readonly string[];
      remover: readonly string[]; motivo: AdministrativeReason['code']; motivo_detalhe?: string }>;
  }): Promise<Mp35cMutationResponse>;
  createProperty(input: {
    readonly authorization: string | undefined; readonly idempotencyKey: string; readonly requestId: string;
    readonly body: Readonly<{ nome: string; titular_id: string; municipio_id: string;
      area_total?: string | null; cultura_principal?: string; status: 'ativa' | 'inativa' }>;
  }): Promise<Mp35cMutationResponse>;
  updateProperty(input: {
    readonly authorization: string | undefined; readonly idempotencyKey: string; readonly requestId: string;
    readonly propertyId: string; readonly body: Readonly<{ versao: number; nome?: string;
      municipio_id?: string; area_total?: string | null; cultura_principal?: string | null }>;
  }): Promise<Mp35cMutationResponse>;
  changePropertyStatus(input: {
    readonly authorization: string | undefined; readonly idempotencyKey: string; readonly requestId: string;
    readonly propertyId: string; readonly body: Readonly<{ versao: number;
      status: 'ativa' | 'inativa'; motivo: AdministrativeReason['code']; motivo_detalhe?: string }>;
  }): Promise<Mp35cMutationResponse>;
  listStates(input: { readonly authorization: string | undefined }): Promise<Readonly<{ versionId: string; items: readonly StateView[] }>>;
  listMunicipalities(input: {
    readonly authorization: string | undefined; readonly query: Readonly<{ uf_id: string;
      busca?: string; limite?: number; cursor?: string }>;
  }): Promise<Readonly<{ versionId: string; items: readonly MunicipalityView[]; nextCursor: string | null }>>;
}

function validation(message = 'A requisição contém valor semanticamente inválido.') {
  return unprocessableEntity(message, 'validation_error');
}

function text(value: string, field: string, maximum: number): string {
  const normalized = value.normalize('NFC').trim();
  if (normalized.length === 0 || Array.from(normalized).length > maximum) throw validation(`${field} inválido.`);
  return normalized;
}

function nullableText(value: string | null, field: string, maximum: number): string | null {
  return value === null ? null : text(value, field, maximum);
}

function uuid(value: unknown, field: string): string {
  try { return requireCanonicalUuid(value, field); }
  catch (error) { if (error instanceof TypeError) throw validation(error.message); throw error; }
}

function area(value: unknown, field: string): string {
  try { return normalizeAdministrativeArea(value, field); }
  catch (error) { if (error instanceof TypeError) throw validation(error.message); throw error; }
}

function limit(value: number | undefined): number {
  const result = value ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(result) || result < 1 || result > MAX_LIMIT) throw validation();
  return result;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function sha256(value: string): Buffer { return createHash('sha256').update(value, 'utf8').digest(); }

function administrativeReason(code: AdministrativeReason['code'], detail?: string): AdministrativeReason {
  if (code === 'outro') return { code, detail: text(detail ?? '', 'motivo_detalhe', ADMINISTRATION_LIMITS.reasonDetail) };
  return { code, ...(detail === undefined ? {} : { detail: text(detail, 'motivo_detalhe', ADMINISTRATION_LIMITS.reasonDetail) }) };
}

function mutation(result: Mp35cMutationResult): Mp35cMutationResponse {
  if (result.status === 'completed' || result.status === 'replayed') {
    return { httpStatus: result.httpStatus, receipt: result.receipt };
  }
  switch (result.status) {
    case 'invalid_session': throw unauthorized();
    case 'forbidden': throw forbidden();
    case 'not_found': throw notFound();
    case 'version_conflict': throw conflict(undefined, 'version_conflict');
    case 'idempotency_conflict': throw conflict(undefined, 'idempotency_conflict');
    case 'invalid_municipality': throw validation('Município inválido para o catálogo ativo.');
    case 'invalid_holder':
    case 'business_rule_conflict': throw conflict(undefined, 'business_rule_conflict');
  }
}

function validRelationCursor(payload: Readonly<Record<string, unknown>>): PropertyRelationCursor {
  if (Object.keys(payload).length !== 4 || typeof payload.sort_key !== 'string'
    || Array.from(payload.sort_key.normalize('NFC')).length === 0
    || Array.from(payload.sort_key.normalize('NFC')).length > 200
    || payload.sort_key !== payload.sort_key.normalize('NFC')
    || !isCanonicalUuid(payload.property_id)
    || (payload.relation_order !== 0 && payload.relation_order !== 1)
    || !isCanonicalUuid(payload.relation_id)) throw badRequest();
  return { sortKey: payload.sort_key, propertyId: payload.property_id,
    relationOrder: payload.relation_order, relationId: payload.relation_id };
}

function validMunicipalityCursor(payload: Readonly<Record<string, unknown>>): MunicipalityCursor {
  if (Object.keys(payload).length !== 3 || typeof payload.version_id !== 'string'
    || !CATALOG_VERSION.test(payload.version_id) || typeof payload.sort_key !== 'string'
    || Array.from(payload.sort_key.normalize('NFC')).length === 0
    || Array.from(payload.sort_key.normalize('NFC')).length > 200
    || payload.sort_key !== payload.sort_key.normalize('NFC')
    || typeof payload.id !== 'string' || !MUNICIPALITY_ID.test(payload.id)) throw badRequest();
  return { versionId: payload.version_id, sortKey: payload.sort_key, id: payload.id };
}

export class DefaultMp35cService implements Mp35cService {
  readonly #authentication: AuthenticationService;
  readonly #repository: Mp35cRepository;
  readonly #linkCursor: SecureAdministrativeCursorCodec;
  readonly #municipalityCursor: SecureAdministrativeCursorCodec;

  public constructor(input: { readonly authentication: AuthenticationService;
    readonly repository: Mp35cRepository; readonly linkCursor: SecureAdministrativeCursorCodec;
    readonly municipalityCursor: SecureAdministrativeCursorCodec }) {
    this.#authentication = input.authentication; this.#repository = input.repository;
    this.#linkCursor = input.linkCursor; this.#municipalityCursor = input.municipalityCursor;
  }

  async #admin(authorization?: string) {
    const principal = await this.#authentication.authenticate(
      bearerTokenFromAuthorizationHeader(authorization));
    if (principal.organizationId !== ORGANIZATION_ID || principal.profile !== 'admin'
      || principal.status !== 'ativo') throw forbidden();
    return principal;
  }

  #identity<Command extends Mp35cCommandIdentity['command']>(
    principal: Awaited<ReturnType<AuthenticationService['authenticate']>>,
    requestId: string, idempotencyKey: string, command: Command,
    request: unknown): Mp35cCommandIdentity & { readonly command: Command } {
    const key = idempotencyKey.trim();
    if (!IDEMPOTENCY_KEY.test(key)) throw badRequest();
    return { sessionId: principal.sessionId, requestId, correlationId: requestId,
      idempotencyKeyHash: sha256(key), requestHash: sha256(canonical({ command, request })), command };
  }

  public async listUserProperties(input: Parameters<Mp35cService['listUserProperties']>[0]) {
    const principal = await this.#admin(input.authorization);
    if (!isCanonicalUuid(input.userId)) throw badRequest();
    const search = input.query.busca === undefined ? undefined
      : text(input.query.busca, 'busca', ADMINISTRATION_LIMITS.propertyName);
    const binding = { user_id: input.userId, search: search ?? null,
      access_type: input.query.tipo_acesso ?? null, link_status: input.query.status_vinculo ?? null };
    const cursor = input.query.cursor === undefined ? undefined
      : validRelationCursor(this.#linkCursor.decode(input.query.cursor, binding));
    const pageLimit = limit(input.query.limite);
    const result = await this.#repository.listUserProperties({ principal,
      userId: input.userId, ...(search === undefined ? {} : { search }),
      ...(input.query.tipo_acesso === undefined ? {} : { accessType: input.query.tipo_acesso }),
      ...(input.query.status_vinculo === undefined ? {} : { linkStatus: input.query.status_vinculo }),
      ...(cursor === undefined ? {} : { cursor }), limit: pageLimit + 1 });
    if (result === null) throw notFound();
    const hasNext = result.items.length > pageLimit;
    const items = hasNext ? result.items.slice(0, pageLimit) : result.items;
    const last = items.at(-1);
    return { userVersion: result.userVersion, items,
      nextCursor: hasNext && last !== undefined ? this.#linkCursor.encode({
        sort_key: last.sortKey, property_id: last.propertyId,
        relation_order: last.relationOrder, relation_id: last.id,
      }, binding) : null };
  }

  public async createProperty(input: Parameters<Mp35cService['createProperty']>[0]) {
    const principal = await this.#admin(input.authorization);
    const command = { context: { organizationId: ORGANIZATION_ID,
      actorUserId: principal.id, sessionId: principal.sessionId,
      requestId: input.requestId, correlationId: input.requestId,
      idempotencyKey: input.idempotencyKey },
      name: text(input.body.nome, 'nome', ADMINISTRATION_LIMITS.propertyName),
      holderId: uuid(input.body.titular_id, 'titular_id'), municipalityId: input.body.municipio_id,
      ...(input.body.area_total === undefined ? {} : { totalArea: area(input.body.area_total, 'area_total') }),
      ...(input.body.cultura_principal === undefined ? {}
        : { mainCrop: text(input.body.cultura_principal, 'cultura_principal', ADMINISTRATION_LIMITS.mainCrop) }),
      status: input.body.status };
    try { validateCreateAdministrativePropertyCommand(command); } catch (error) {
      if (error instanceof TypeError) throw validation(error.message); throw error;
    }
    return mutation(await this.#repository.createProperty({ principal,
      identity: this.#identity(principal, input.requestId, input.idempotencyKey,
        'propriedade.criar', input.body), ...command }));
  }

  public async updateProperty(input: Parameters<Mp35cService['updateProperty']>[0]) {
    const principal = await this.#admin(input.authorization);
    const command = { context: { organizationId: ORGANIZATION_ID,
      actorUserId: principal.id, sessionId: principal.sessionId,
      requestId: input.requestId, correlationId: input.requestId,
      idempotencyKey: input.idempotencyKey, expectedVersion: input.body.versao },
      propertyId: uuid(input.propertyId, 'propriedade_id'),
      ...(input.body.nome === undefined ? {} : { name: text(input.body.nome, 'nome', ADMINISTRATION_LIMITS.propertyName) }),
      ...(input.body.municipio_id === undefined ? {} : { municipalityId: input.body.municipio_id }),
      ...(input.body.area_total === undefined ? {} : { totalArea: input.body.area_total === null
        ? null : area(input.body.area_total, 'area_total') }),
      ...(input.body.cultura_principal === undefined ? {}
        : { mainCrop: nullableText(input.body.cultura_principal, 'cultura_principal', ADMINISTRATION_LIMITS.mainCrop) }) };
    try { validateUpdateAdministrativePropertyCommand(command); } catch (error) {
      if (error instanceof TypeError) throw validation(error.message); throw error;
    }
    return mutation(await this.#repository.updateProperty({ principal,
      identity: this.#identity(principal, input.requestId, input.idempotencyKey,
        'propriedade.atualizar', { id: input.propertyId, ...input.body }),
      expectedVersion: input.body.versao, ...command }));
  }

  public async changePropertyStatus(input: Parameters<Mp35cService['changePropertyStatus']>[0]) {
    const principal = await this.#admin(input.authorization);
    const reason = administrativeReason(input.body.motivo, input.body.motivo_detalhe);
    const command = { context: { organizationId: ORGANIZATION_ID,
      actorUserId: principal.id, sessionId: principal.sessionId,
      requestId: input.requestId, correlationId: input.requestId,
      idempotencyKey: input.idempotencyKey, expectedVersion: input.body.versao },
      propertyId: uuid(input.propertyId, 'propriedade_id'), status: input.body.status, reason };
    try { validateChangeAdministrativePropertyStatusCommand(command); } catch (error) {
      if (error instanceof TypeError) throw validation(error.message); throw error;
    }
    return mutation(await this.#repository.changePropertyStatus({ principal,
      identity: this.#identity(principal, input.requestId, input.idempotencyKey,
        'propriedade.alterar_status', { id: input.propertyId, ...input.body }),
      expectedVersion: input.body.versao, ...command }));
  }

  public async applyUserPropertyDelta(input: Parameters<Mp35cService['applyUserPropertyDelta']>[0]) {
    const principal = await this.#admin(input.authorization);
    if (input.body.adicionar.length === 0 && input.body.remover.length === 0) {
      throw conflict(undefined, 'business_rule_conflict');
    }
    const reason = administrativeReason(input.body.motivo, input.body.motivo_detalhe);
    const command = { context: { organizationId: ORGANIZATION_ID,
      actorUserId: principal.id, sessionId: principal.sessionId,
      requestId: input.requestId, correlationId: input.requestId,
      idempotencyKey: input.idempotencyKey, expectedVersion: input.body.versao },
      userId: uuid(input.userId, 'usuario_id'),
      add: input.body.adicionar.map((propertyId) => ({
        propertyId: uuid(propertyId, 'adicionar'),
      })),
      remove: input.body.remover.map((propertyId) => ({
        propertyId: uuid(propertyId, 'remover'),
      })), reason };
    try { validatePropertyLinkDeltaCommand(command); } catch (error) {
      if (error instanceof TypeError) throw validation(error.message); throw error;
    }
    return mutation(await this.#repository.applyUserPropertyDelta({ principal,
      identity: this.#identity(principal, input.requestId, input.idempotencyKey,
        'usuario.alterar_vinculos', { id: input.userId, ...input.body }),
      userId: command.userId, expectedVersion: input.body.versao,
      add: command.add.map((item) => item.propertyId),
      remove: command.remove.map((item) => item.propertyId), reason }));
  }

  public async listStates(input: Parameters<Mp35cService['listStates']>[0]) {
    return this.#repository.listStates({ principal: await this.#admin(input.authorization) });
  }

  public async listMunicipalities(input: Parameters<Mp35cService['listMunicipalities']>[0]) {
    const principal = await this.#admin(input.authorization);
    if (!STATE_ID.test(input.query.uf_id)) throw badRequest('uf_id inválido.');
    const search = input.query.busca === undefined ? undefined : text(input.query.busca, 'busca', 200);
    const binding = { uf_id: input.query.uf_id, search: search ?? null };
    const cursor = input.query.cursor === undefined ? undefined
      : validMunicipalityCursor(this.#municipalityCursor.decode(input.query.cursor, binding));
    const pageLimit = limit(input.query.limite);
    const result = await this.#repository.listMunicipalities({ principal,
      stateId: input.query.uf_id, ...(search === undefined ? {} : { search }),
      ...(cursor === undefined ? {} : { versionId: cursor.versionId, cursor }),
      limit: pageLimit + 1 });
    if (result === null) throw badRequest('UF ou versão de catálogo inválida.');
    const hasNext = result.items.length > pageLimit;
    const items = hasNext ? result.items.slice(0, pageLimit) : result.items;
    const last = items.at(-1);
    return { versionId: result.versionId, items,
      nextCursor: hasNext && last !== undefined ? this.#municipalityCursor.encode({
        version_id: result.versionId, sort_key: last.sortKey, id: last.id,
      }, binding) : null };
  }
}
