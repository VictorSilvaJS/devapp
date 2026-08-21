export type UserProfile = 'admin' | 'colaborador' | 'produtor';
export type UserStatus = 'pendente' | 'ativo' | 'inativo';

export interface AuthUser {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly email: string;
  readonly profile: UserProfile;
  readonly status: UserStatus;
  readonly authorizationVersion: number;
}

export interface LoginSubject extends AuthUser {
  readonly credential:
    | Readonly<{
        id: string;
        passwordHash: string;
        policyVersion: string;
      }>
    | null;
}

export interface AuthenticatedPrincipal extends AuthUser {
  readonly sessionId: string;
}

export interface SessionSummary {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastRefreshedAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly current: boolean;
  readonly clientLabel?: string;
  readonly revokedAt?: Date;
}

export interface LoginThrottleDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

export interface LoginThrottle {
  /** Must run before any password hash operation. */
  checkIp(ipHmac: string): Promise<LoginThrottleDecision>;
  checkIdentifier(identifierHmac: string): Promise<LoginThrottleDecision>;
  recordFailure(input: {
    readonly ipHmac: string;
    readonly identifierHmac: string;
    readonly windowSeconds: number;
    readonly failureThreshold: number;
    readonly lockScheduleSeconds: readonly number[];
  }): Promise<void>;
  recordSuccess(input: {
    readonly identifierHmac: string;
  }): Promise<void>;
}

export interface IssuedTokenWindow {
  readonly issuedAt: Date;
  readonly accessExpiresAt: Date;
  readonly inactivityExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface CreateSessionResult extends IssuedTokenWindow {
  readonly status: 'created';
  readonly sessionId: string;
}

export type RotateRefreshResult =
  | Readonly<{
      status: 'rotated';
      principal: AuthenticatedPrincipal;
    } & IssuedTokenWindow>
  | Readonly<{ status: 'invalid' | 'replayed' }>;

export type PasswordChangeResult =
  | Readonly<{
      status: 'changed';
      principal: AuthenticatedPrincipal;
    } & IssuedTokenWindow>
  | Readonly<{ status: 'denied' }>;

export interface PasswordRecoveryBeginInput {
  readonly normalizedEmail: string;
  readonly tokenHash: string;
  /**
   * This value is sensitive. The PostgreSQL implementation must encrypt it
   * into the transactional outbox and must never persist or log plaintext.
   */
  readonly deliveryToken: string;
  readonly ttlSeconds: number;
  readonly requestId: string;
}

export interface AuthRepository {
  findLoginSubject(normalizedEmail: string): Promise<LoginSubject | null>;

  updateCredentialHashIfCurrent(input: {
    readonly credentialId: string;
    readonly expectedPasswordHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
  }): Promise<void>;

  /** Must revalidate user status/version and persist both tokens atomically. */
  createSession(input: {
    readonly userId: string;
    readonly authorizationVersion: number;
    readonly accessTokenHash: string;
    readonly refreshTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly absoluteTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly clientLabel?: string;
    readonly requestId: string;
  }): Promise<CreateSessionResult | Readonly<{ status: 'denied' }>>;

  /**
   * Locks the refresh family, consumes the current token, persists its
   * successor and a new access token in one transaction. Reuse of a consumed
   * token must revoke that session/family, including the newest successor.
   */
  rotateRefreshToken(input: {
    readonly currentRefreshTokenHash: string;
    readonly replacementRefreshTokenHash: string;
    readonly replacementAccessTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly requestId: string;
  }): Promise<RotateRefreshResult>;

  /** Returns null for expired, revoked, stale-version or inactive identities. */
  resolveAccessToken(accessTokenHash: string): Promise<AuthenticatedPrincipal | null>;

  revokeSessionByAccessToken(input: {
    readonly accessTokenHash: string;
    readonly requestId: string;
  }): Promise<void>;

  revokeAllSessions(input: {
    readonly userId: string;
    readonly actorSessionId: string;
    readonly exceptSessionId?: string;
    readonly requestId: string;
  }): Promise<void>;

  listSessions(input: {
    readonly userId: string;
    readonly currentSessionId: string;
  }): Promise<readonly SessionSummary[]>;

  revokeOwnedSession(input: {
    readonly userId: string;
    readonly actorSessionId: string;
    readonly sessionId: string;
    readonly requestId: string;
  }): Promise<boolean>;

  getCredentialForUser(userId: string): Promise<LoginSubject | null>;

  /**
   * Replaces the hash, bumps auth version, revokes every other session and
   * rotates both token classes of the current session atomically.
   */
  replacePasswordAndRotateCurrentSession(input: {
    readonly userId: string;
    readonly currentSessionId: string;
    readonly currentAccessTokenHash: string;
    readonly expectedPasswordHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
    readonly replacementAccessTokenHash: string;
    readonly replacementRefreshTokenHash: string;
    readonly accessTtlSeconds: number;
    readonly inactivityTtlSeconds: number;
    readonly requestId: string;
  }): Promise<PasswordChangeResult>;

  /**
   * Always uses the same repository entry point. An unknown or ineligible
   * identity is a no-op and must remain indistinguishable in the HTTP
   * response. Eligible identities create challenge, outbox and audit in one
   * transaction.
   */
  beginPasswordRecovery(input: PasswordRecoveryBeginInput): Promise<void>;

  /**
   * Performs a cheap, read-only check before Argon2 work. The final consume
   * remains atomic in completePasswordRecovery, so this is not an
   * authorization decision by itself.
   */
  isPasswordRecoveryTokenUsable(tokenHash: string): Promise<boolean>;

  /** Consumes once, changes password, bumps auth version and revokes all auth state. */
  completePasswordRecovery(input: {
    readonly tokenHash: string;
    readonly replacementPasswordHash: string;
    readonly policyVersion: string;
    readonly requestId: string;
  }): Promise<boolean>;
}
