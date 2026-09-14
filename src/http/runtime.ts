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
import { AdministrativeUserCommandService } from './administrativeUserCommands';
import { AdministrativePropertyDataBoundary } from './administrativePropertyDataBoundary';
import { AdministrativePropertyCommandService } from './administrativePropertyCommands';
import { HttpAdministrativePropertyRepository } from './administrativePropertyRepository';
import { AdministrativeHolderController } from './administrativeHolderController';
import { AdministrativeLocalityController } from './administrativeLocalityController';
import type { PropertyStatus } from './contracts';
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
  readonly administrativeUserCommands: AdministrativeUserCommandService;
  readonly administrativeUserData: AdministrativeUserDataBoundary;
  readonly administrativeUsers: AdministrativeUserRepository;
  readonly administrativeUserControllers: AdministrativeUserControllerFactory;
  readonly properties: PropertyRepository;
  readonly administrativePropertyData: AdministrativePropertyDataBoundary;
  readonly administrativeProperties: HttpAdministrativePropertyRepository;
  readonly administrativePropertyCommands: AdministrativePropertyCommandService;
  readonly administrativePropertySelectors: {
    createHolder(initialStatus: PropertyStatus, limit?: number): AdministrativeHolderController;
    createLocalities(limit?: number): AdministrativeLocalityController;
  };
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
  const administrativeUsers = new HttpAdministrativeUserRepository(api, session, administrativeUserData);
  const administrativePropertyData = new AdministrativePropertyDataBoundary();
  const administrativeProperties = new HttpAdministrativePropertyRepository(api, session, administrativePropertyData);
  administrativeCommands.synchronizeSession(session.snapshot, session.epoch);
  administrativeUserData.synchronizePartition(
    administrativeUserSessionPartition(session.snapshot, session.epoch),
  );
  session.subscribe((snapshot) => {
    administrativeCommands.synchronizeSession(snapshot, session.epoch);
    administrativeUserData.synchronizePartition(
      administrativeUserSessionPartition(snapshot, session.epoch),
    );
    administrativePropertyData.synchronizePartition(
      administrativeUserSessionPartition(snapshot, session.epoch),
      snapshot?.usuario.perfil === 'admin' && snapshot.usuario.status === 'ativo',
    );
  });
  session.subscribeRevalidation(() => {
    const lease = administrativeUserData.issueLease();
    const propertyLease = administrativePropertyData.issueLease();
    return (snapshot) => {
      if (snapshot.usuario.perfil !== 'admin' || snapshot.usuario.status !== 'ativo') return;
      administrativeUserData.acceptSessionRevalidation(
        lease,
        administrativeUserSessionPartition(snapshot, session.epoch),
      );
      administrativePropertyData.acceptSessionRevalidation(
        propertyLease,
        administrativeUserSessionPartition(snapshot, session.epoch),
      );
      administrativePropertyData.revokeLease(propertyLease);
    };
  });
  return {
    config,
    api,
    session,
    administrativeCommands,
    administrativeUserCommands: new AdministrativeUserCommandService({
      api,
      session,
      coordinator: administrativeCommands,
      boundary: administrativeUserData,
    }),
    administrativeUserData,
    administrativePropertyData,
    administrativeProperties,
    administrativePropertyCommands: new AdministrativePropertyCommandService({
      api, session, coordinator: administrativeCommands, boundary: administrativePropertyData,
      repository: administrativeProperties,
      captureAuthorizationEffects: () => {
        // D13 does not enumerate affected Users. Invalidate existing projections as a whole.
        const lease = administrativeUserData.issueLease();
        return () => { administrativeUserData.invalidateReconciliation(lease); };
      },
    }),
    administrativeUsers,
    administrativePropertySelectors: Object.freeze({
      createHolder: (initialStatus: PropertyStatus, limit?: number) =>
        new AdministrativeHolderController(administrativeUsers, session, administrativeUserData, initialStatus, limit),
      createLocalities: (limit?: number) => new AdministrativeLocalityController(api, session, administrativeUserData, limit),
    }),
    administrativeUserControllers:
      dependencies.administrativeUserControllerFactory ??
      DEFAULT_ADMINISTRATIVE_USER_CONTROLLER_FACTORY,
    properties: new HttpPropertyRepository(api, session),
    notifications: new HttpNotificationRepository(api, session),
  };
}
