import type { BackendApi } from './backendApi';
import { InvalidBackendResponseError } from './decoders';
import type {
  NotificationDestination,
  NotificationDiscardResult,
  NotificationFilters,
  NotificationPage,
  NotificationReadAllResult,
  NotificationReadResult,
} from './contracts';
import type { SessionCoordinator } from './sessionCoordinator';

export interface NotificationRepository {
  list(filters?: NotificationFilters): Promise<NotificationPage>;
  countUnread(): Promise<number>;
  markRead(id: string, idempotencyKey: string): Promise<NotificationReadResult>;
  markAllRead(idempotencyKey: string): Promise<NotificationReadAllResult>;
  discard(
    id: string,
    idempotencyKey: string,
  ): Promise<NotificationDiscardResult>;
  resolveDestination(id: string): Promise<NotificationDestination>;
}

export class HttpNotificationRepository implements NotificationRepository {
  readonly #api: BackendApi;
  readonly #session: SessionCoordinator;

  constructor(api: BackendApi, session: SessionCoordinator) {
    this.#api = api;
    this.#session = session;
  }

  async list(filters: NotificationFilters = {}): Promise<NotificationPage> {
    const page = await this.#session.authenticated((accessToken) => {
      return this.#api.listNotifications(accessToken, filters);
    });
    const userId = this.#session.snapshot?.usuario.id;
    if (
      userId === undefined ||
      page.itens.some((item) => item.recurso_id !== userId)
    ) {
      throw new InvalidBackendResponseError();
    }
    return page;
  }

  async countUnread(): Promise<number> {
    const result = await this.#session.authenticated((accessToken) => {
      return this.#api.countUnreadNotifications(accessToken);
    });
    return result.total_nao_lidas;
  }

  async markRead(
    id: string,
    idempotencyKey: string,
  ): Promise<NotificationReadResult> {
    const result = await this.#session.authenticated((accessToken) => {
      return this.#api.markNotificationRead(
        accessToken,
        id,
        idempotencyKey,
      );
    });
    if (result.id !== id) throw new InvalidBackendResponseError();
    return result;
  }

  markAllRead(idempotencyKey: string): Promise<NotificationReadAllResult> {
    return this.#session.authenticated((accessToken) => {
      return this.#api.markAllNotificationsRead(accessToken, idempotencyKey);
    });
  }

  async discard(
    id: string,
    idempotencyKey: string,
  ): Promise<NotificationDiscardResult> {
    const result = await this.#session.authenticated((accessToken) => {
      return this.#api.discardNotification(
        accessToken,
        id,
        idempotencyKey,
      );
    });
    if (result.id !== id) throw new InvalidBackendResponseError();
    return result;
  }

  async resolveDestination(id: string): Promise<NotificationDestination> {
    const destination = await this.#session.authenticated((accessToken) => {
      return this.#api.resolveNotificationDestination(accessToken, id);
    });
    const userId = this.#session.snapshot?.usuario.id;
    if (userId === undefined || destination.recurso_id !== userId) {
      throw new InvalidBackendResponseError();
    }
    return destination;
  }
}
