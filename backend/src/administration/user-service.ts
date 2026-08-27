import { createHash, randomUUID } from 'node:crypto';

import type { UserProfile, UserStatus } from '../auth/contracts.js';
import { InvalidEmailError, normalizeEmail } from '../auth/normalization.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unprocessableEntity,
} from '../security/http-error.js';
import { bearerTokenFromAuthorizationHeader } from '../auth/service.js';
import type { AuthenticationService } from '../auth/service.js';
import type {
  AdministrativeReason,
  AdministrativeSafeReceipt,
} from './contracts.js';
import {
  validateChangeAdministrativeUserStatusCommand,
  validateCreateAdministrativeUserCommand,
  validateIssueAdministrativeInvitationCommand,
  validateUpdateAdministrativeUserCommand,
} from './validation.js';
import type { AdministrativeUserCursorFilters } from './user-cursor.js';
import { AdministrativeUserCursorCodec } from './user-cursor.js';
import type {
  AdministrativeCommandIdentity,
  AdministrativeCommandResult,
  AdministrativeUserRepository,
  AdministrativeUserView,
} from './user-contracts.js';

const ORGANIZATION_ID = 'org_tche_fertilidade' as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:/-]{1,128}$/u;

function validationError(message?: string) {
  return unprocessableEntity(
    message ?? 'A requisição contém valor semanticamente inválido.',
    'validation_error',
  );
}

export interface AdministrativeUserListQuery {
  readonly busca?: string;
  readonly perfil?: UserProfile;
  readonly status?: UserStatus;
  readonly limite?: number;
  readonly cursor?: string;
}

export interface AdministrativeUserPage {
  readonly items: readonly AdministrativeUserView[];
  readonly nextCursor: string | null;
}

export interface AdministrativeMutationResponse {
  readonly httpStatus: 200 | 201;
  readonly receipt: AdministrativeSafeReceipt;
}

export interface AdministrativeUserService {
  list(input: {
    readonly authorization: string | undefined;
    readonly query: AdministrativeUserListQuery;
  }): Promise<AdministrativeUserPage>;
  detail(input: {
    readonly authorization: string | undefined;
    readonly userId: string;
  }): Promise<AdministrativeUserView>;
  create(input: {
    readonly authorization: string | undefined;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly body: Readonly<{
      nome: string;
      email: string;
      perfil: UserProfile;
      telefone?: string;
      documento?: string;
      observacoes?: string;
    }>;
  }): Promise<AdministrativeMutationResponse>;
  update(input: {
    readonly authorization: string | undefined;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly userId: string;
    readonly body: Readonly<{
      versao: number;
      nome?: string;
      email?: string;
      telefone?: string | null;
      documento?: string | null;
      observacoes?: string | null;
    }>;
  }): Promise<AdministrativeMutationResponse>;
  changeStatus(input: {
    readonly authorization: string | undefined;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly userId: string;
    readonly body: Readonly<{
      versao: number;
      status: Extract<UserStatus, 'ativo' | 'inativo'>;
      motivo: AdministrativeReason['code'];
      motivo_detalhe?: string;
    }>;
  }): Promise<AdministrativeMutationResponse>;
  issueInvitation(input: {
    readonly authorization: string | undefined;
    readonly idempotencyKey: string;
    readonly requestId: string;
    readonly userId: string;
    readonly body: Readonly<{ modo_ativacao: string }>;
  }): Promise<AdministrativeMutationResponse>;
}

function normalizedText(
  value: string,
  field: string,
  maximumCodePoints?: number,
): string {
  const normalized = value.normalize('NFC').trim();
  const length = Array.from(normalized).length;
  if (
    length === 0
    || (maximumCodePoints !== undefined && length > maximumCodePoints)
  ) {
    throw validationError(`${field} inválido.`);
  }
  return normalized;
}

function nullableText(value: string | null, field: string): string | null {
  return value === null ? null : normalizedText(value, field);
}

function normalizedIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) throw badRequest();
  return normalized;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function commandIdentity(input: {
  readonly principal: Awaited<ReturnType<AuthenticationService['authenticate']>>;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly command: AdministrativeCommandIdentity['command'];
  readonly request: unknown;
}): AdministrativeCommandIdentity {
  const key = normalizedIdempotencyKey(input.idempotencyKey);
  return {
    organizationId: ORGANIZATION_ID,
    actorUserId: input.principal.id,
    sessionId: input.principal.sessionId,
    requestId: input.requestId,
    correlationId: input.requestId,
    idempotencyKeyHash: sha256(key),
    requestHash: sha256(
      canonicalJson({ command: input.command, request: input.request }),
    ),
    command: input.command,
  };
}

function reason(input: {
  readonly motivo: AdministrativeReason['code'];
  readonly motivo_detalhe?: string;
}): AdministrativeReason {
  if (input.motivo === 'outro') {
    return {
      code: 'outro',
      detail: normalizedText(input.motivo_detalhe ?? '', 'motivo_detalhe'),
    };
  }
  return {
    code: input.motivo,
    ...(input.motivo_detalhe === undefined
      ? {}
      : { detail: normalizedText(input.motivo_detalhe, 'motivo_detalhe') }),
  };
}

function mutationResult(
  result: AdministrativeCommandResult,
): AdministrativeMutationResponse {
  if (result.status === 'completed' || result.status === 'replayed') {
    return { httpStatus: result.httpStatus, receipt: result.receipt };
  }
  switch (result.status) {
    case 'invalid_session':
      throw unauthorized();
    case 'forbidden':
      throw forbidden();
    case 'not_found':
      throw notFound();
    case 'version_conflict':
      throw conflict(undefined, 'version_conflict');
    case 'idempotency_conflict':
      throw conflict(undefined, 'idempotency_conflict');
    case 'pending_status_transition':
      throw validationError(
        'Usuário pendente não participa da rota de alteração de status.',
      );
    case 'duplicate_email':
    case 'active_holder_conflict':
    case 'self_deactivation':
    case 'last_admin_conflict':
    case 'invalid_transition':
    case 'email_change_forbidden':
    case 'credential_required':
    case 'not_pending':
    case 'no_change':
      throw conflict(undefined, 'business_rule_conflict');
  }
}

export class DefaultAdministrativeUserService
  implements AdministrativeUserService
{
  readonly #authentication: AuthenticationService;
  readonly #repository: AdministrativeUserRepository;
  readonly #cursorCodec: AdministrativeUserCursorCodec;
  readonly #adminCreationEnabled: boolean;

  public constructor(input: {
    readonly authentication: AuthenticationService;
    readonly repository: AdministrativeUserRepository;
    readonly cursorCodec: AdministrativeUserCursorCodec;
    readonly adminCreationEnabled?: boolean;
  }) {
    this.#authentication = input.authentication;
    this.#repository = input.repository;
    this.#cursorCodec = input.cursorCodec;
    this.#adminCreationEnabled = input.adminCreationEnabled ?? true;
  }

  async #activeAdmin(authorization: string | undefined) {
    const principal = await this.#authentication.authenticate(
      bearerTokenFromAuthorizationHeader(authorization),
    );
    if (
      principal.organizationId !== ORGANIZATION_ID ||
      principal.profile !== 'admin' ||
      principal.status !== 'ativo'
    ) {
      throw forbidden();
    }
    return principal;
  }

  public async list(input: {
    readonly authorization: string | undefined;
    readonly query: AdministrativeUserListQuery;
  }): Promise<AdministrativeUserPage> {
    const principal = await this.#activeAdmin(input.authorization);
    const limit = input.query.limite ?? DEFAULT_LIMIT;
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw badRequest();
    }
    if (limit > MAX_LIMIT) {
      throw validationError('limite excede o máximo permitido.');
    }
    if (
      input.query.perfil !== undefined
      && !['admin', 'colaborador', 'produtor'].includes(input.query.perfil)
    ) {
      throw validationError('perfil inválido.');
    }
    if (
      input.query.status !== undefined
      && !['pendente', 'ativo', 'inativo'].includes(input.query.status)
    ) {
      throw validationError('status inválido.');
    }
    const search =
      input.query.busca === undefined
        ? undefined
        : normalizedText(input.query.busca, 'busca', 254);
    const cursorFilters: AdministrativeUserCursorFilters = {
      ...(search === undefined ? {} : { search }),
      ...(input.query.perfil === undefined ? {} : { profile: input.query.perfil }),
      ...(input.query.status === undefined ? {} : { status: input.query.status }),
    };
    const cursor =
      input.query.cursor === undefined
        ? undefined
        : this.#cursorCodec.decode(input.query.cursor, cursorFilters);
    const rows = await this.#repository.list({
      principal,
      organizationId: principal.organizationId,
      limit: limit + 1,
      ...(input.query.perfil === undefined
        ? {}
        : { profile: input.query.perfil }),
      ...(input.query.status === undefined
        ? {}
        : { status: input.query.status }),
      ...(search === undefined ? {} : { search }),
      ...(cursor === undefined ? {} : { cursor }),
    });
    const hasNextPage = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last !== undefined
          ? this.#cursorCodec.encode(
              { sortKey: last.sortKey, id: last.id },
              cursorFilters,
            )
          : null,
    };
  }

  public async detail(input: {
    readonly authorization: string | undefined;
    readonly userId: string;
  }): Promise<AdministrativeUserView> {
    const principal = await this.#activeAdmin(input.authorization);
    const user = await this.#repository.findById({
      principal,
      organizationId: principal.organizationId,
      userId: input.userId,
    });
    if (user === null) throw notFound();
    return user;
  }

  public async create(input: Parameters<AdministrativeUserService['create']>[0]) {
    const principal = await this.#activeAdmin(input.authorization);
    if (input.body.perfil === 'admin' && !this.#adminCreationEnabled) {
      throw conflict(
        'A criação de Administrador exige o portão produtivo de MFA.',
        'business_rule_conflict',
      );
    }
    let email: string;
    try {
      email = normalizeEmail(input.body.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) throw validationError();
      throw error;
    }
    const command = {
      context: {
        organizationId: ORGANIZATION_ID,
        actorUserId: principal.id,
        sessionId: principal.sessionId,
        requestId: input.requestId,
        correlationId: input.requestId,
        idempotencyKey: normalizedIdempotencyKey(input.idempotencyKey),
      },
      name: normalizedText(input.body.nome, 'nome'),
      email,
      profile: input.body.perfil,
      ...(input.body.telefone === undefined
        ? {}
        : { phone: normalizedText(input.body.telefone, 'telefone') }),
      ...(input.body.documento === undefined
        ? {}
        : { document: normalizedText(input.body.documento, 'documento') }),
      ...(input.body.observacoes === undefined
        ? {}
        : { notes: normalizedText(input.body.observacoes, 'observacoes') }),
    };
    try {
      validateCreateAdministrativeUserCommand(command);
    } catch (error) {
      if (error instanceof TypeError) throw validationError();
      throw error;
    }
    const identity = commandIdentity({
      principal,
      requestId: input.requestId,
      idempotencyKey: command.context.idempotencyKey,
      command: 'usuario.criar',
      request: {
        nome: command.name,
        email: command.email,
        perfil: command.profile,
        telefone: command.phone,
        documento: command.document,
        observacoes: command.notes,
      },
    });
    return mutationResult(
      await this.#repository.create({
        principal,
        identity: { ...identity, command: 'usuario.criar' },
        userId: randomUUID(),
        ...(command.profile === 'produtor' ? { producerId: randomUUID() } : {}),
        name: command.name,
        email: command.email,
        profile: command.profile,
        ...(command.phone === undefined ? {} : { phone: command.phone }),
        ...(command.document === undefined ? {} : { document: command.document }),
        ...(command.notes === undefined ? {} : { notes: command.notes }),
      }),
    );
  }

  public async update(input: Parameters<AdministrativeUserService['update']>[0]) {
    const principal = await this.#activeAdmin(input.authorization);
    let email: string | undefined;
    try {
      email =
        input.body.email === undefined
          ? undefined
          : normalizeEmail(input.body.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) throw validationError();
      throw error;
    }
    const command = {
      context: {
        organizationId: ORGANIZATION_ID,
        actorUserId: principal.id,
        sessionId: principal.sessionId,
        requestId: input.requestId,
        correlationId: input.requestId,
        idempotencyKey: normalizedIdempotencyKey(input.idempotencyKey),
        expectedVersion: input.body.versao,
      },
      userId: input.userId,
      ...(input.body.nome === undefined
        ? {}
        : { name: normalizedText(input.body.nome, 'nome') }),
      ...(email === undefined ? {} : { email }),
      ...(input.body.telefone === undefined
        ? {}
        : { phone: nullableText(input.body.telefone, 'telefone') }),
      ...(input.body.documento === undefined
        ? {}
        : { document: nullableText(input.body.documento, 'documento') }),
      ...(input.body.observacoes === undefined
        ? {}
        : { notes: nullableText(input.body.observacoes, 'observacoes') }),
    };
    try {
      validateUpdateAdministrativeUserCommand(command);
    } catch (error) {
      if (error instanceof TypeError) throw validationError();
      throw error;
    }
    const identity = commandIdentity({
      principal,
      requestId: input.requestId,
      idempotencyKey: command.context.idempotencyKey,
      command: 'usuario.atualizar',
      request: {
        usuario_id: command.userId,
        versao: command.context.expectedVersion,
        nome: command.name,
        email: command.email,
        telefone: command.phone,
        documento: command.document,
        observacoes: command.notes,
      },
    });
    return mutationResult(
      await this.#repository.update({
        principal,
        identity: { ...identity, command: 'usuario.atualizar' },
        userId: command.userId,
        expectedVersion: command.context.expectedVersion,
        ...(command.name === undefined ? {} : { name: command.name }),
        ...(command.email === undefined ? {} : { email: command.email }),
        ...(command.phone === undefined ? {} : { phone: command.phone }),
        ...(command.document === undefined
          ? {}
          : { document: command.document }),
        ...(command.notes === undefined ? {} : { notes: command.notes }),
      }),
    );
  }

  public async changeStatus(
    input: Parameters<AdministrativeUserService['changeStatus']>[0],
  ) {
    const principal = await this.#activeAdmin(input.authorization);
    const administrativeReason = reason(input.body);
    const command = {
      context: {
        organizationId: ORGANIZATION_ID,
        actorUserId: principal.id,
        sessionId: principal.sessionId,
        requestId: input.requestId,
        correlationId: input.requestId,
        idempotencyKey: normalizedIdempotencyKey(input.idempotencyKey),
        expectedVersion: input.body.versao,
      },
      userId: input.userId,
      status: input.body.status,
      reason: administrativeReason,
    };
    try {
      validateChangeAdministrativeUserStatusCommand(command);
    } catch (error) {
      if (error instanceof TypeError) throw validationError();
      throw error;
    }
    const identity = commandIdentity({
      principal,
      requestId: input.requestId,
      idempotencyKey: command.context.idempotencyKey,
      command: 'usuario.alterar_status',
      request: {
        usuario_id: command.userId,
        versao: command.context.expectedVersion,
        status: command.status,
        motivo: command.reason.code,
        motivo_detalhe: command.reason.detail,
      },
    });
    return mutationResult(
      await this.#repository.changeStatus({
        principal,
        identity: { ...identity, command: 'usuario.alterar_status' },
        userId: command.userId,
        expectedVersion: command.context.expectedVersion,
        status: command.status,
        reason: command.reason,
      }),
    );
  }

  public async issueInvitation(
    input: Parameters<AdministrativeUserService['issueInvitation']>[0],
  ) {
    const principal = await this.#activeAdmin(input.authorization);
    const command = {
      context: {
        organizationId: ORGANIZATION_ID,
        actorUserId: principal.id,
        sessionId: principal.sessionId,
        requestId: input.requestId,
        correlationId: input.requestId,
        idempotencyKey: normalizedIdempotencyKey(input.idempotencyKey),
      },
      userId: input.userId,
      activationMode: input.body.modo_ativacao,
    };
    try {
      validateIssueAdministrativeInvitationCommand(command);
    } catch (error) {
      if (error instanceof TypeError) throw validationError();
      throw error;
    }
    const identity = commandIdentity({
      principal,
      requestId: input.requestId,
      idempotencyKey: command.context.idempotencyKey,
      command: 'usuario.emitir_convite',
      request: {
        usuario_id: command.userId,
        modo_ativacao: command.activationMode,
      },
    });
    return mutationResult(
      await this.#repository.issueInvitation({
        principal,
        identity: { ...identity, command: 'usuario.emitir_convite' },
        userId: command.userId,
      }),
    );
  }
}
