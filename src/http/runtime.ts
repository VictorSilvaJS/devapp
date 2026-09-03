import { BackendApi } from './backendApi';
import {
  HttpAdministrativeUserRepository,
  type AdministrativeUserRepository,
} from './administrativeUserRepository';
import { administrativeUserSessionPartition } from './administrativeUserAccess';
import { AdministrativeUserDataBoundary } from './administrativeUserDataBoundary';
import { AdministrativeUserDetailController } from './administrativeUserDetailController';
import { AdministrativeUserListController } from './administrativeUserListController';
import { AdministrativeCommandCoordinator } from './administrativeCommandCoordinator';
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
  readonly administrativeCommands: AdministrativeCommandCoordinator;
  readonly administrativeUserData: AdministrativeUserDataBoundary;
  readonly administrativeUsers: AdministrativeUserRepository;
  readonly administrativeUserControllers: AdministrativeUserControllerFactory;
  readonly properties: PropertyRepository;
  readonly notifications: NotificationRepository;
}

export interface AdministrativeUserControllerFactory {
  createList(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
  ): AdministrativeUserListController;
  createDetail(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
  ): AdministrativeUserDetailController;
}

const DEFAULT_ADMINISTRATIVE_USER_CONTROLLER_FACTORY:
  AdministrativeUserControllerFactory = Object.freeze({
  createList(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
  ) {
    return new AdministrativeUserListController(repository, boundary);
  },
  createDetail(
    repository: AdministrativeUserRepository,
    boundary: AdministrativeUserDataBoundary,
  ) {
    return new AdministrativeUserDetailController(repository, boundary);
  },
});

export function createHttpRuntime(
  config: HttpRuntimeConfig,
  dependencies: {
    readonly transport?: HttpTransport;
    readonly refreshTokenStore?: RefreshTokenStore;
    readonly monotonicNow?: () => number;
    readonly wallClockNow?: () => number;
    readonly administrativeUserControllerFactory?:
      AdministrativeUserControllerFactory;
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
  const administrativeCommands = new AdministrativeCommandCoordinator({ session });
  const administrativeUserData = new AdministrativeUserDataBoundary();
  administrativeCommands.synchronizeSession(session.snapshot, session.epoch);
  administrativeUserData.synchronizePartition(
    administrativeUserSessionPartition(session.snapshot, session.epoch),
  );
  session.subscribe((snapshot) => {
    administrativeCommands.synchronizeSession(snapshot, session.epoch);
    administrativeUserData.synchronizePartition(
      administrativeUserSessionPartition(snapshot, session.epoch),
    );
  });
  return {
    config,
    api,
    session,
    administrativeCommands,
    administrativeUserData,
    administrativeUsers: new HttpAdministrativeUserRepository(
      api,
      session,
      administrativeUserData,
    ),
    administrativeUserControllers:
      dependencies.administrativeUserControllerFactory ??
      DEFAULT_ADMINISTRATIVE_USER_CONTROLLER_FACTORY,
    properties: new HttpPropertyRepository(api, session),
    notifications: new HttpNotificationRepository(api, session),
  };
}
