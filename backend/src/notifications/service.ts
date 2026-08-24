import { createHash } from 'node:crypto';

import type { AuthenticationService } from '../auth/service.js';
import { badRequest, conflict, notFound } from '../security/http-error.js';
import type {
  NotificationListState,
  NotificationRepository,
  NotificationView,
} from './contracts.js';
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from './cursor.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const UUID_INPUT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface NotificationListQuery {
  readonly estado?: NotificationListState;
  readonly limite?: number;
  readonly cursor?: string;
}

export interface NotificationPage {
  readonly items: readonly NotificationView[];
  readonly nextCursor: string | null;
}

export interface NotificationService {
  list(input: {
    readonly accessToken: string;
    readonly query: NotificationListQuery;
  }): Promise<NotificationPage>;
  countUnread(accessToken: string): Promise<number>;
  markRead(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ id: string; readAt: Date }>>;
  markAllRead(input: {
    readonly accessToken: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ cutoffAt: Date; updated: number }>>;
  discard(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ id: string; discardedAt: Date }>>;
  resolveDestination(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly requestId: string;
  }): Promise<Readonly<{ resourceType: 'conta'; resourceId: string }>>;
}

function idempotencyKey(value: string): string {
  const normalized = value.normalize('NFC').trim();
  if (
    normalized.length < 8 ||
    normalized.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/u.test(normalized)
  ) {
    throw badRequest();
  }
  return normalized;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function canonicalNotificationId(value: string): string {
  if (typeof value !== 'string' || !UUID_INPUT_PATTERN.test(value)) {
    throw badRequest();
  }
  return value.toLowerCase();
}

function commandDigests(
  key: string,
  command: 'leitura' | 'leituras' | 'descarte',
  targetId?: string,
): Readonly<{ idempotencyKeyHash: Buffer; requestHash: Buffer }> {
  const normalizedKey = idempotencyKey(key);
  return {
    idempotencyKeyHash: digest(normalizedKey),
    requestHash: digest(`${command}\u0000${targetId ?? ''}`),
  };
}

export class DefaultNotificationService implements NotificationService {
  readonly #authentication: AuthenticationService;
  readonly #repository: NotificationRepository;

  public constructor(input: {
    readonly authentication: AuthenticationService;
    readonly repository: NotificationRepository;
  }) {
    this.#authentication = input.authentication;
    this.#repository = input.repository;
  }

  public async list(input: {
    readonly accessToken: string;
    readonly query: NotificationListQuery;
  }): Promise<NotificationPage> {
    const principal = await this.#authentication.authenticate(input.accessToken);
    const limit = input.query.limite ?? DEFAULT_LIMIT;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw badRequest();
    }
    const cursor =
      input.query.cursor === undefined
        ? undefined
        : decodeNotificationCursor(input.query.cursor);
    const rows = await this.#repository.list({
      principal,
      state: input.query.estado ?? 'todas',
      limit: limit + 1,
      ...(cursor === undefined ? {} : { cursor }),
    });
    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNext && last !== undefined
          ? encodeNotificationCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  public async countUnread(accessToken: string): Promise<number> {
    const principal = await this.#authentication.authenticate(accessToken);
    return this.#repository.countUnread({ principal });
  }

  public async markRead(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ id: string; readAt: Date }>> {
    const notificationId = canonicalNotificationId(input.notificationId);
    const principal = await this.#authentication.authenticate(input.accessToken);
    const result = await this.#repository.markRead({
      principal,
      notificationId,
      requestId: input.requestId,
      ...commandDigests(input.idempotencyKey, 'leitura', notificationId),
    });
    if (result.status === 'conflict') throw conflict();
    if (result.status === 'not_found') throw notFound();
    return result.value;
  }

  public async markAllRead(input: {
    readonly accessToken: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ cutoffAt: Date; updated: number }>> {
    const principal = await this.#authentication.authenticate(input.accessToken);
    const result = await this.#repository.markAllRead({
      principal,
      requestId: input.requestId,
      ...commandDigests(input.idempotencyKey, 'leituras'),
    });
    if (result.status === 'conflict') throw conflict();
    if (result.status === 'not_found') throw notFound();
    return result.value;
  }

  public async discard(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }): Promise<Readonly<{ id: string; discardedAt: Date }>> {
    const notificationId = canonicalNotificationId(input.notificationId);
    const principal = await this.#authentication.authenticate(input.accessToken);
    const result = await this.#repository.discard({
      principal,
      notificationId,
      requestId: input.requestId,
      ...commandDigests(input.idempotencyKey, 'descarte', notificationId),
    });
    if (result.status === 'conflict') throw conflict();
    if (result.status === 'not_found') throw notFound();
    return result.value;
  }

  public async resolveDestination(input: {
    readonly accessToken: string;
    readonly notificationId: string;
    readonly requestId: string;
  }): Promise<Readonly<{ resourceType: 'conta'; resourceId: string }>> {
    const notificationId = canonicalNotificationId(input.notificationId);
    const principal = await this.#authentication.authenticate(input.accessToken);
    const destination = await this.#repository.resolveDestination({
      principal,
      notificationId,
      requestId: input.requestId,
    });
    if (destination === null) throw notFound();
    return destination;
  }
}
