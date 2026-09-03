import { ApiResponseError, BackendApi } from './backendApi';
import type {
  HttpSessionIdentity,
  RemoteSessionProjection,
  SessionSnapshot,
  TokenResponse,
} from './contracts';
import { assertActionToken, InvalidBackendResponseError } from './decoders';
import { ApiTransportError } from './httpTransport';
import type { RefreshTokenStore } from './refreshTokenStore';

export class SessionRequiredError extends Error {
  constructor(message = 'Entre novamente para continuar.') {
    super(message);
    this.name = 'SessionRequiredError';
  }
}

export class SessionStorageError extends Error {
  constructor() {
    super('Não foi possível proteger a sessão neste aparelho.');
    this.name = 'SessionStorageError';
  }
}

class StaleSessionOperationError extends Error {}

export type SessionListener = (snapshot: SessionSnapshot | null) => void;

export interface AuthenticatedSessionContext {
  readonly snapshot: SessionSnapshot;
  readonly epoch: number;
}

const REFRESH_EARLY_MS = 5_000;

export class SessionCoordinator {
  readonly #api: BackendApi;
  readonly #store: RefreshTokenStore;
  readonly #monotonicNow: () => number;
  readonly #wallClockNow: () => number;
  readonly #listeners = new Set<SessionListener>();
  #accessToken: string | null = null;
  #snapshot: SessionSnapshot | null = null;
  #epoch = 0;
  #storeTail: Promise<void> = Promise.resolve();
  #rotationTail: Promise<void> = Promise.resolve();
  #refreshInFlight: {
    readonly epoch: number;
    readonly promise: Promise<SessionSnapshot>;
  } | null = null;

  constructor(input: {
    readonly api: BackendApi;
    readonly refreshTokenStore: RefreshTokenStore;
    readonly monotonicNow?: () => number;
    readonly wallClockNow?: () => number;
  }) {
    this.#api = input.api;
    this.#store = input.refreshTokenStore;
    this.#monotonicNow = input.monotonicNow ?? (() => performance.now());
    this.#wallClockNow = input.wallClockNow ?? (() => Date.now());
  }

  get snapshot(): SessionSnapshot | null {
    return this.#snapshot;
  }

  /** Process-local identity generation. It contains no token or stable secret. */
  get epoch(): number {
    return this.#epoch;
  }

  subscribe(listener: SessionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #publish(snapshot: SessionSnapshot | null): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      try {
        listener(snapshot);
      } catch {
        // UI observers cannot interrupt token clearing or other listeners.
      }
    }
  }

  #queueStoreMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#storeTail.then(operation, operation);
    this.#storeTail = result.then(() => undefined, () => undefined);
    return result;
  }

  #queueRotation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#rotationTail.then(operation, operation);
    this.#rotationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  #advanceEpoch(): number {
    this.#epoch += 1;
    return this.#epoch;
  }

  async #revokeUnexpected(accessToken: string): Promise<void> {
    try {
      await this.#api.logout(accessToken);
    } catch {
      // A response/session that cannot be adopted is never retained locally.
    }
  }

  #activeSnapshot(response: TokenResponse): SessionSnapshot {
    if (response.usuario.status !== 'ativo') {
      throw new InvalidBackendResponseError();
    }
    const serverValidityMs =
      Date.parse(response.access_expira_em) - Date.parse(response.emitido_em);
    const serverRemainingMs =
      Date.parse(response.access_expira_em) - this.#wallClockNow();
    if (
      !Number.isFinite(serverValidityMs) ||
      serverValidityMs <= 0 ||
      !Number.isFinite(serverRemainingMs) ||
      serverRemainingMs <= 0
    ) {
      throw new InvalidBackendResponseError();
    }
    return {
      id: response.id,
      usuario: response.usuario,
      escopo: response.escopo,
      emitido_em: response.emitido_em,
      access_expira_em: response.access_expira_em,
      sessao_expira_inatividade_em: response.sessao_expira_inatividade_em,
      sessao_expira_absolutamente_em: response.sessao_expira_absolutamente_em,
      access_expires_monotonic:
        this.#monotonicNow() +
        Math.min(
          serverRemainingMs,
          serverValidityMs,
          response.expires_in * 1_000,
        ),
    };
  }

  async #invalidate(expectedEpoch?: number): Promise<boolean> {
    if (expectedEpoch !== undefined && this.#epoch !== expectedEpoch) {
      return false;
    }
    this.#advanceEpoch();
    this.#accessToken = null;
    this.#publish(null);
    try {
      await this.#queueStoreMutation(() => this.#store.clear());
    } catch {
      throw new SessionStorageError();
    }
    return true;
  }

  async #acceptTokenResponse(
    response: TokenResponse,
    expectedEpoch: number,
    continuation?: Readonly<{
      sessionId: string;
      userId: string;
      organizationId: string;
    }>,
  ): Promise<SessionSnapshot> {
    let snapshot: SessionSnapshot;
    try {
      snapshot = this.#activeSnapshot(response);
      if (
        continuation !== undefined &&
        (snapshot.id !== continuation.sessionId ||
          snapshot.usuario.id !== continuation.userId ||
          snapshot.usuario.organizacao_id !== continuation.organizationId)
      ) {
        throw new InvalidBackendResponseError();
      }
    } catch (error) {
      if (this.#epoch === expectedEpoch) {
        try {
          await this.#invalidate(expectedEpoch);
        } catch {
          // The invalid-response failure remains public; UI is already blocked.
        }
      }
      await this.#revokeUnexpected(response.access_token);
      throw error;
    }

    if (this.#epoch !== expectedEpoch) {
      await this.#revokeUnexpected(response.access_token);
      throw new SessionRequiredError();
    }

    try {
      await this.#queueStoreMutation(async () => {
        if (this.#epoch !== expectedEpoch) {
          throw new StaleSessionOperationError();
        }
        await this.#store.write(response.refresh_token);
        if (this.#epoch !== expectedEpoch) {
          await this.#store.clear();
          throw new StaleSessionOperationError();
        }
      });
    } catch (error) {
      await this.#revokeUnexpected(response.access_token);
      if (error instanceof StaleSessionOperationError) {
        throw new SessionRequiredError();
      }
      if (this.#epoch === expectedEpoch) {
        try {
          await this.#invalidate(expectedEpoch);
        } catch {
          // SessionStorageError below remains fail-closed.
        }
      }
      throw new SessionStorageError();
    }

    if (this.#epoch !== expectedEpoch) {
      await this.#revokeUnexpected(response.access_token);
      throw new SessionRequiredError();
    }
    this.#accessToken = response.access_token;
    this.#publish(snapshot);
    return snapshot;
  }

  async #readStoredRefresh(expectedEpoch: number): Promise<string | null> {
    try {
      return await this.#queueStoreMutation(async () => {
        if (this.#epoch !== expectedEpoch) {
          throw new StaleSessionOperationError();
        }
        const stored = await this.#store.read();
        if (this.#epoch !== expectedEpoch) {
          throw new StaleSessionOperationError();
        }
        return stored;
      });
    } catch (error) {
      if (error instanceof StaleSessionOperationError) {
        throw new SessionRequiredError();
      }
      if (this.#epoch === expectedEpoch) {
        try {
          await this.#invalidate(expectedEpoch);
        } catch {
          // The normalized storage error below remains fail-closed.
        }
      }
      throw new SessionStorageError();
    }
  }

  async login(email: string, password: string): Promise<SessionSnapshot> {
    const intentEpoch = this.#epoch;
    return this.#queueRotation(async () => {
      if (this.#epoch !== intentEpoch) throw new SessionRequiredError();
      const loginEpoch = this.#advanceEpoch();
      this.#accessToken = null;
      this.#publish(null);
      try {
        await this.#queueStoreMutation(() => this.#store.clear());
      } catch {
        throw new SessionStorageError();
      }
      const response = await this.#api.login(email, password);
      return this.#acceptTokenResponse(response, loginEpoch);
    });
  }

  async reauthenticate(password: string): Promise<SessionSnapshot> {
    return this.#queueRotation(async () => {
      const current = this.#snapshot;
      const initialEpoch = this.#epoch;
      if (current === null) throw new SessionRequiredError();
      const response = await this.#api.login(current.usuario.email, password);
      if (this.#epoch !== initialEpoch) {
        await this.#revokeUnexpected(response.access_token);
        throw new SessionRequiredError();
      }
      if (
        response.usuario.id !== current.usuario.id ||
        response.usuario.organizacao_id !== current.usuario.organizacao_id
      ) {
        await this.#revokeUnexpected(response.access_token);
        throw new SessionRequiredError(
          'A identidade retornada não corresponde à sessão bloqueada.',
        );
      }

      const replacementEpoch = this.#advanceEpoch();
      // Do not let a request that starts while SecureStore is being replaced
      // reuse the predecessor access token. The snapshot stays private behind
      // the lock until the replacement has been persisted and published.
      this.#accessToken = null;
      const next = await this.#acceptTokenResponse(response, replacementEpoch);
      if (current.id !== response.id) {
        try {
          await this.#api.revokeSession(response.access_token, current.id);
        } catch {
          // The replacement is protected; predecessor revocation is best effort.
        }
      }
      return next;
    });
  }

  async restore(): Promise<SessionSnapshot | null> {
    const restoreEpoch = this.#epoch;
    const stored = await this.#readStoredRefresh(restoreEpoch);
    if (stored === null) return null;
    try {
      assertActionToken(stored);
    } catch {
      await this.#invalidate(restoreEpoch);
      return null;
    }
    return this.#refresh(stored, restoreEpoch);
  }

  async #refreshCore(
    knownRefreshToken?: string,
    requestedEpoch = this.#epoch,
    force = false,
    rejectedAccessToken?: string,
  ): Promise<SessionSnapshot> {
    if (this.#epoch !== requestedEpoch) throw new SessionRequiredError();
    const current = this.#snapshot;
    if (
      force &&
      rejectedAccessToken !== undefined &&
      current !== null &&
      this.#accessToken !== null &&
      this.#accessToken !== rejectedAccessToken
    ) {
      return current;
    }
    if (
      !force &&
      knownRefreshToken === undefined &&
      current !== null &&
      this.#accessToken !== null &&
      current.access_expires_monotonic >
        this.#monotonicNow() + REFRESH_EARLY_MS
    ) {
      return current;
    }
    const refreshToken = knownRefreshToken ??
      await this.#readStoredRefresh(requestedEpoch);
    if (refreshToken === null) throw new SessionRequiredError();
    try {
      assertActionToken(refreshToken);
    } catch {
      await this.#invalidate(requestedEpoch);
      throw new SessionRequiredError();
    }

    try {
      const response = await this.#api.refresh(refreshToken);
      return await this.#acceptTokenResponse(
        response,
        requestedEpoch,
        current === null
          ? undefined
          : {
              sessionId: current.id,
              userId: current.usuario.id,
              organizationId: current.usuario.organizacao_id,
            },
      );
    } catch (error) {
      if (this.#epoch !== requestedEpoch) throw new SessionRequiredError();
      if (error instanceof ApiResponseError && error.status === 503) {
        throw error;
      }
      if (
        error instanceof ApiResponseError ||
        error instanceof ApiTransportError ||
        error instanceof InvalidBackendResponseError
      ) {
        await this.#invalidate(requestedEpoch);
        throw new SessionRequiredError(
          error instanceof ApiTransportError
            ? 'Não foi possível confirmar a renovação. Entre novamente.'
            : undefined,
        );
      }
      throw error;
    }
  }

  async #refresh(
    knownRefreshToken?: string,
    requestedEpoch = this.#epoch,
    force = false,
    rejectedAccessToken?: string,
  ): Promise<SessionSnapshot> {
    if (
      this.#refreshInFlight !== null &&
      this.#refreshInFlight.epoch === requestedEpoch
    ) {
      return this.#refreshInFlight.promise;
    }

    const promise = this.#queueRotation(() => {
      return this.#refreshCore(
        knownRefreshToken,
        requestedEpoch,
        force,
        rejectedAccessToken,
      );
    });
    const flight = { epoch: requestedEpoch, promise };
    this.#refreshInFlight = flight;
    void promise.finally(() => {
      if (this.#refreshInFlight === flight) this.#refreshInFlight = null;
    }).catch(() => {
      // The original caller observes the rejection; this only finalizes state.
    });
    return promise;
  }

  async #authenticatedCore<T>(
    operation: (
      accessToken: string,
      context: AuthenticatedSessionContext,
    ) => Promise<T>,
    rotationHeld = false,
    onStaleResult?: (result: T) => Promise<void>,
  ): Promise<T> {
    const operationEpoch = this.#epoch;
    if (
      this.#accessToken === null ||
      this.#snapshot === null ||
      this.#snapshot.access_expires_monotonic <=
        this.#monotonicNow() + REFRESH_EARLY_MS
    ) {
      if (rotationHeld) {
        await this.#refreshCore(undefined, operationEpoch);
      } else {
        await this.#refresh(undefined, operationEpoch);
      }
    }
    if (
      this.#epoch !== operationEpoch ||
      this.#accessToken === null ||
      this.#snapshot === null
    ) {
      throw new SessionRequiredError();
    }

    const attemptedAccessToken = this.#accessToken;
    const attemptedContext = Object.freeze({
      snapshot: this.#snapshot,
      epoch: operationEpoch,
    });
    try {
      const result = await operation(attemptedAccessToken, attemptedContext);
      if (this.#epoch !== operationEpoch) {
        if (onStaleResult !== undefined) await onStaleResult(result);
        throw new SessionRequiredError();
      }
      return result;
    } catch (error) {
      if (this.#epoch !== operationEpoch) throw new SessionRequiredError();
      if (
        !(error instanceof ApiResponseError) ||
        error.status !== 401 ||
        error.code !== 'invalid_session'
      ) {
        throw error;
      }
    }

    if (this.#epoch !== operationEpoch) throw new SessionRequiredError();
    if (this.#accessToken === attemptedAccessToken) {
      if (rotationHeld) {
        await this.#refreshCore(
          undefined,
          operationEpoch,
          true,
          attemptedAccessToken,
        );
      } else {
        await this.#refresh(
          undefined,
          operationEpoch,
          true,
          attemptedAccessToken,
        );
      }
    }
    if (
      this.#epoch !== operationEpoch ||
      this.#accessToken === null ||
      this.#snapshot === null
    ) {
      throw new SessionRequiredError();
    }

    const retryAccessToken = this.#accessToken;
    const retryContext = Object.freeze({
      snapshot: this.#snapshot,
      epoch: operationEpoch,
    });
    try {
      const result = await operation(retryAccessToken, retryContext);
      if (this.#epoch !== operationEpoch) {
        if (onStaleResult !== undefined) await onStaleResult(result);
        throw new SessionRequiredError();
      }
      return result;
    } catch (error) {
      if (
        error instanceof ApiResponseError &&
        error.status === 401 &&
        error.code === 'invalid_session'
      ) {
        await this.#invalidate(operationEpoch);
        throw new SessionRequiredError();
      }
      throw error;
    }
  }

  async authenticated<T>(
    operation: (
      accessToken: string,
      context: AuthenticatedSessionContext,
    ) => Promise<T>,
  ): Promise<T> {
    return this.#authenticatedCore(operation);
  }

  async revalidate(): Promise<SessionSnapshot> {
    const validationEpoch = this.#epoch;
    let identity: HttpSessionIdentity;
    try {
      identity = await this.#authenticatedCore((accessToken) => {
        return this.#api.me(accessToken);
      });
    } catch (error) {
      if (
        error instanceof InvalidBackendResponseError ||
        (error instanceof ApiResponseError &&
          error.status < 500 &&
          error.status !== 429)
      ) {
        if (this.#epoch === validationEpoch) {
          await this.#invalidate(validationEpoch);
        }
        throw new SessionRequiredError();
      }
      throw error;
    }
    return this.#applyIdentity(identity, validationEpoch);
  }

  async #applyIdentity(
    identity: HttpSessionIdentity,
    expectedEpoch: number,
  ): Promise<SessionSnapshot> {
    if (this.#epoch !== expectedEpoch) throw new SessionRequiredError();
    const current = this.#snapshot;
    if (
      current === null ||
      identity.usuario.status !== 'ativo' ||
      identity.id !== current.id ||
      identity.usuario.id !== current.usuario.id ||
      identity.usuario.organizacao_id !== current.usuario.organizacao_id
    ) {
      await this.#invalidate(expectedEpoch);
      throw new SessionRequiredError();
    }
    const next = {
      ...current,
      usuario: identity.usuario,
      escopo: identity.escopo,
    };
    if (this.#epoch !== expectedEpoch) throw new SessionRequiredError();
    this.#publish(next);
    return next;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionSnapshot> {
    return this.#queueRotation(async () => {
      const changeEpoch = this.#epoch;
      const current = this.#snapshot;
      if (current === null) throw new SessionRequiredError();
      let response: TokenResponse;
      try {
        response = await this.#authenticatedCore((accessToken) => {
          return this.#api.changePassword(
            accessToken,
            currentPassword,
            newPassword,
          );
        }, true, (staleResponse) => {
          return this.#revokeUnexpected(staleResponse.access_token);
        });
      } catch (error) {
        // A timeout or malformed success can happen after the server rotated the
        // credentials. Keeping the old token would expose data under an
        // indeterminate session state. Explicit HTTP errors (for example a 503
        // or invalid_credentials) remain ordinary operation failures.
        if (
          error instanceof ApiTransportError ||
          error instanceof InvalidBackendResponseError
        ) {
          if (this.#epoch === changeEpoch) {
            try {
              await this.#invalidate(changeEpoch);
            } catch {
              // The public outcome remains SessionRequired and local UI is blocked.
            }
          }
          throw new SessionRequiredError(
            'Não foi possível confirmar a troca de senha. Entre novamente.',
          );
        }
        throw error;
      }
      if (this.#epoch !== changeEpoch) {
        await this.#revokeUnexpected(response.access_token);
        throw new SessionRequiredError();
      }
      const replacementEpoch = this.#advanceEpoch();
      // Block new requests from using the predecessor while the rotated refresh
      // token is being persisted. Existing requests are rejected by the epoch.
      this.#accessToken = null;
      return this.#acceptTokenResponse(response, replacementEpoch, {
        sessionId: current.id,
        userId: current.usuario.id,
        organizationId: current.usuario.organizacao_id,
      });
    });
  }

  async requestPrimaryEmailChange(
    newEmail: string,
    currentPassword: string,
  ): Promise<void> {
    await this.authenticated((accessToken) => {
      return this.#api.requestPrimaryEmailChange(
        accessToken,
        newEmail,
        currentPassword,
      );
    });
  }

  async requestSecondaryEmail(newEmail: string): Promise<void> {
    await this.authenticated((accessToken) => {
      return this.#api.requestSecondaryEmail(
        accessToken,
        newEmail,
      );
    });
  }

  async listSessions(): Promise<readonly RemoteSessionProjection[]> {
    return this.authenticated((accessToken) => {
      return this.#api.listSessions(accessToken);
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.#queueRotation(async () => {
      const isCurrent = this.#snapshot?.id === sessionId;
      await this.#authenticatedCore((accessToken) => {
        return this.#api.revokeSession(
          accessToken,
          sessionId,
        );
      }, true);
      if (isCurrent) await this.#invalidate();
    });
  }

  async logoutAll(): Promise<void> {
    const accessToken = this.#accessToken;
    const invalidation = this.#invalidate();
    return this.#queueRotation(async () => {
      let clearError: unknown;
      try {
        await invalidation;
      } catch (error) {
        clearError = error;
      }
      if (accessToken !== null) {
        try {
          await this.#api.logoutAll(accessToken);
        } catch {
          // Logout-all is locally destructive even when remote status is unknown.
        }
      }
      if (clearError !== undefined) throw clearError;
    });
  }

  async logout(): Promise<void> {
    const accessToken = this.#accessToken;
    const invalidation = this.#invalidate();
    let clearError: unknown;
    try {
      await invalidation;
    } catch (error) {
      clearError = error;
    }
    if (accessToken !== null) {
      try {
        await this.#api.logout(accessToken);
      } catch {
        // The interface is blocked; remote revocation is best effort.
      }
    }
    if (clearError !== undefined) throw clearError;
  }

  async #completeSessionRevokingAction(
    operation: () => Promise<void>,
  ): Promise<void> {
    return this.#queueRotation(async () => {
      let operationError: unknown;
      try {
        await operation();
      } catch (error) {
        operationError = error;
        if (
          !(error instanceof ApiTransportError) &&
          !(error instanceof InvalidBackendResponseError)
        ) {
          throw error;
        }
      }

      await this.#invalidate();
      if (operationError !== undefined) throw operationError;
    });
  }

  async completePasswordRecovery(token: string, password: string): Promise<void> {
    return this.#completeSessionRevokingAction(() => {
      return this.#api.completePasswordRecovery(token, password);
    });
  }

  async confirmNewPrimaryEmail(token: string): Promise<void> {
    return this.#completeSessionRevokingAction(() => {
      return this.#api.confirmNewPrimaryEmail(token);
    });
  }

  async completeAdminSecondaryRecovery(
    restrictedToken: string,
    password: string,
  ): Promise<void> {
    return this.#completeSessionRevokingAction(() => {
      return this.#api.completeAdminSecondaryRecovery(
        restrictedToken,
        password,
      );
    });
  }

  async completeAssistedRecovery(
    restrictedToken: string,
    password: string,
  ): Promise<void> {
    return this.#completeSessionRevokingAction(() => {
      return this.#api.completeAssistedRecovery(
        restrictedToken,
        password,
      );
    });
  }

  async clearAfterAccountChange(): Promise<void> {
    await this.#invalidate();
  }
}
