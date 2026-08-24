import type { PoolClient } from 'pg';

import type { AuthenticatedPrincipal } from '../auth/contracts.js';

export type NotificationEventType =
  | 'conta.senha_alterada.v1'
  | 'conta.email_principal_alterado.v1'
  | 'conta.recuperacao_concluida.v1';

export type NotificationPriority = 'baixa' | 'normal' | 'alta';
export type NotificationListState = 'nao_lida' | 'lida' | 'todas';

export interface NotificationContent {
  readonly title: string;
  readonly summary: string;
}

export interface NotificationView {
  readonly id: string;
  readonly eventType: NotificationEventType;
  readonly priority: NotificationPriority;
  readonly createdAt: Date;
  readonly readAt: Date | null;
  readonly expiresAt: Date;
  readonly resourceType: 'conta';
  readonly resourceId: string;
  readonly content: NotificationContent;
}

export interface NotificationCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface ListNotificationsInput {
  readonly principal: AuthenticatedPrincipal;
  readonly state: NotificationListState;
  readonly limit: number;
  readonly cursor?: NotificationCursor;
}

export interface IdempotentCommandInput {
  readonly principal: AuthenticatedPrincipal;
  readonly idempotencyKeyHash: Buffer;
  readonly requestHash: Buffer;
  readonly requestId: string;
}

export type NotificationCommandResult<Value> =
  | Readonly<{ status: 'completed'; value: Value; replayed: boolean }>
  | Readonly<{ status: 'not_found' }>
  | Readonly<{ status: 'conflict' }>;

export interface NotificationRepository {
  list(input: ListNotificationsInput): Promise<readonly NotificationView[]>;
  countUnread(input: {
    readonly principal: AuthenticatedPrincipal;
  }): Promise<number>;
  markRead(
    input: IdempotentCommandInput & Readonly<{ notificationId: string }>,
  ): Promise<
    NotificationCommandResult<Readonly<{ id: string; readAt: Date }>>
  >;
  markAllRead(input: IdempotentCommandInput): Promise<
    NotificationCommandResult<
      Readonly<{ cutoffAt: Date; updated: number }>
    >
  >;
  discard(
    input: IdempotentCommandInput & Readonly<{ notificationId: string }>,
  ): Promise<
    NotificationCommandResult<Readonly<{ id: string; discardedAt: Date }>>
  >;
  resolveDestination(input: {
    readonly principal: AuthenticatedPrincipal;
    readonly notificationId: string;
    readonly requestId: string;
  }): Promise<Readonly<{ resourceType: 'conta'; resourceId: string }> | null>;
}

export interface AccountNotificationDraft {
  readonly organizationId: string;
  readonly recipientUserId: string;
  readonly eventType: NotificationEventType;
  readonly sourceKey: string;
  readonly authorUserId?: string;
}

export interface AccountNotificationWriter {
  create(
    client: PoolClient,
    draft: AccountNotificationDraft,
  ): Promise<void>;
}
