import { BackendApi } from './backendApi';
import type { HttpRuntimeConfig } from './config';
import { FetchHttpTransport, type HttpTransport } from './httpTransport';
import {
  HttpPropertyRepository,
  type PropertyRepository,
} from './propertyRepository';
import {
  HttpNotificationRepository,
  type NotificationRepository,
} from './notificationRepository';
import {
  SecureStoreRefreshTokenStore,
  type RefreshTokenStore,
} from './refreshTokenStore';
import { SessionCoordinator } from './sessionCoordinator';

export interface HttpRuntime {
  readonly config: HttpRuntimeConfig;
  readonly api: BackendApi;
  readonly session: SessionCoordinator;
  readonly properties: PropertyRepository;
  readonly notifications: NotificationRepository;
}

export function createHttpRuntime(
  config: HttpRuntimeConfig,
  dependencies: {
    readonly transport?: HttpTransport;
    readonly refreshTokenStore?: RefreshTokenStore;
    readonly monotonicNow?: () => number;
    readonly wallClockNow?: () => number;
  } = {},
): HttpRuntime {
  const api = new BackendApi({
    baseUrl: config.apiBaseUrl,
    transport: dependencies.transport ?? new FetchHttpTransport(),
  });
  const session = new SessionCoordinator({
    api,
    refreshTokenStore:
      dependencies.refreshTokenStore ?? new SecureStoreRefreshTokenStore(),
    monotonicNow: dependencies.monotonicNow,
    wallClockNow: dependencies.wallClockNow,
  });
  return {
    config,
    api,
    session,
    properties: new HttpPropertyRepository(api, session),
    notifications: new HttpNotificationRepository(api, session),
  };
}
