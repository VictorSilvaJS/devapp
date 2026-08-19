import type { AuthenticationRuntimeConfig } from './config.js';
import type {
  AuthenticatedPrincipal,
  AuthRepository,
  AuthUser,
  LoginSubject,
  LoginThrottle,
  SessionSummary,
} from './contracts.js';
import { InvalidEmailError, normalizeEmail } from './normalization.js';
import type {
  AuthenticationPasswordCredentialService,
} from './password-credential.js';
import { PasswordPolicyError } from './password-policy.js';
import {
  badRequest,
  invalidOrExpiredChallenge,
  notFound,
  rateLimited,
  unauthorized,
  unprocessable,
} from '../security/http-error.js';
import {
  hashOpaqueToken,
  hmacIdentifier,
  isWellFormedOpaqueToken,
  issueOpaqueToken,
} from '../security/tokens.js';

export interface AuthTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly sessionId: string;
  readonly user: AuthUser;
  readonly scope: Readonly<{
    mode: 'organization' | 'property_bindings';
    version: number;
  }>;
}

export interface AuthenticationService {
  login(input: {
    readonly email: string;
    readonly password: string;
    readonly ipAddress: string;
    readonly requestId: string;
    readonly clientLabel?: string;
  }): Promise<AuthTokenResponse>;
  refresh(input: {
    readonly refreshToken: string;
    readonly requestId: string;
  }): Promise<AuthTokenResponse>;
  authenticate(accessToken: string): Promise<AuthenticatedPrincipal>;
  logout(input: { readonly accessToken: string; readonly requestId: string }): Promise<void>;
  logoutAll(input: { readonly accessToken: string; readonly requestId: string }): Promise<void>;
  me(accessToken: string): Promise<Readonly<{ user: AuthUser; sessionId: string; scope: AuthTokenResponse['scope'] }>>;
  sessions(accessToken: string): Promise<readonly SessionSummary[]>;
  revokeSession(input: {
    readonly accessToken: string;
    readonly sessionId: string;
    readonly requestId: string;
  }): Promise<void>;
  changePassword(input: {
    readonly accessToken: string;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly requestId: string;
  }): Promise<AuthTokenResponse>;
  requestPasswordRecovery(input: {
    readonly email: string;
    readonly ipAddress: string;
    readonly requestId: string;
  }): Promise<void>;
  completePasswordRecovery(input: {
    readonly token: string;
    readonly newPassword: string;
    readonly ipAddress: string;
    readonly requestId: string;
  }): Promise<void>;
}

interface AuthenticationServiceDependencies {
  readonly config: AuthenticationRuntimeConfig;
  readonly repository: AuthRepository;
  readonly throttle: LoginThrottle;
  readonly credentials: AuthenticationPasswordCredentialService;
  readonly dummyPasswordHash: string;
}

function userFromSubject(subject: AuthenticatedPrincipal | LoginSubject): AuthUser {
  return {
    id: subject.id,
    organizationId: subject.organizationId,
    name: subject.name,
    email: subject.email,
    profile: subject.profile,
    status: subject.status,
    authorizationVersion: subject.authorizationVersion,
  };
}

function scopeFor(subject: AuthenticatedPrincipal | LoginSubject): AuthTokenResponse['scope'] {
  return {
    mode: subject.profile === 'admin' ? 'organization' : 'property_bindings',
    version: subject.authorizationVersion,
  };
}

function tokenResponse(input: {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionId: string;
  readonly subject: AuthenticatedPrincipal | LoginSubject;
  readonly accessTtlSeconds: number;
}): AuthTokenResponse {
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenType: 'Bearer',
    expiresIn: input.accessTtlSeconds,
    sessionId: input.sessionId,
    user: userFromSubject(input.subject),
    scope: scopeFor(input.subject),
  };
}

function retryAfter(decision: {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}): number {
  return Math.max(1, decision.retryAfterSeconds ?? 1);
}

function passwordPolicyHttpError(error: unknown): never {
  if (error instanceof PasswordPolicyError) {
    throw unprocessable('A senha não atende à política de segurança.');
  }
  throw error;
}

export class DefaultAuthenticationService implements AuthenticationService {
  readonly #config: AuthenticationRuntimeConfig;
  readonly #repository: AuthRepository;
  readonly #throttle: LoginThrottle;
  readonly #credentials: AuthenticationPasswordCredentialService;
  readonly #dummyPasswordHash: string;

  public constructor(dependencies: AuthenticationServiceDependencies) {
    this.#config = dependencies.config;
    this.#repository = dependencies.repository;
    this.#throttle = dependencies.throttle;
    this.#credentials = dependencies.credentials;
    this.#dummyPasswordHash = dependencies.dummyPasswordHash;
  }

  public async login(input: {
    readonly email: string;
    readonly password: string;
    readonly ipAddress: string;
    readonly requestId: string;
    readonly clientLabel?: string;
  }): Promise<AuthTokenResponse> {
    const ipHmac = hmacIdentifier(
      input.ipAddress.normalize('NFC'),
      this.#config.abuseProtection.ipHmacKey,
    );
    const ipDecision = await this.#throttle.checkIp(ipHmac);
    if (!ipDecision.allowed) {
      throw rateLimited(retryAfter(ipDecision));
    }

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmail(input.email);
    } catch (error) {
      if (!(error instanceof InvalidEmailError)) throw error;
      normalizedEmail = `${hmacIdentifier(
        input.email.normalize('NFC').toLowerCase(),
        this.#config.abuseProtection.emailHmacKey,
      )}@invalid.local`;
    }

    const identifierHmac = hmacIdentifier(
      normalizedEmail,
      this.#config.abuseProtection.emailHmacKey,
    );
    const identifierDecision = await this.#throttle.checkIdentifier(identifierHmac);
    if (!identifierDecision.allowed) {
      throw rateLimited(retryAfter(identifierDecision));
    }

    const subject = await this.#repository.findLoginSubject(normalizedEmail);
    const passwordHash = subject?.credential?.passwordHash ?? this.#dummyPasswordHash;
    const verification = await this.#credentials.verify(input.password, passwordHash);
    const accepted =
      verification.valid &&
      subject !== null &&
      subject.credential !== null &&
      subject.status === 'ativo';

    if (!accepted || subject === null || subject.credential === null) {
      await this.#throttle.recordFailure({
        ipHmac,
        identifierHmac,
        windowSeconds: this.#config.abuseProtection.windowSeconds,
        failureThreshold: this.#config.abuseProtection.failureThreshold,
        lockScheduleSeconds: this.#config.abuseProtection.lockScheduleSeconds,
      });
      throw unauthorized('invalid_credentials');
    }

    await this.#throttle.recordSuccess({ identifierHmac });

    if (verification.needsRehash) {
      const replacement = await this.#credentials.rehash(input.password);
      await this.#repository.updateCredentialHashIfCurrent({
        credentialId: subject.credential.id,
        expectedPasswordHash: subject.credential.passwordHash,
        replacementPasswordHash: replacement.passwordHash,
        policyVersion: replacement.policyVersion,
      });
    }

    const accessToken = issueOpaqueToken();
    const refreshToken = issueOpaqueToken();
    const created = await this.#repository.createSession({
      userId: subject.id,
      authorizationVersion: subject.authorizationVersion,
      accessTokenHash: accessToken.hash,
      refreshTokenHash: refreshToken.hash,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
      absoluteTtlSeconds: this.#config.tokens.refreshAbsoluteTtlSeconds,
      inactivityTtlSeconds: this.#config.tokens.refreshInactivityTtlSeconds,
      ...(input.clientLabel === undefined ? {} : { clientLabel: input.clientLabel }),
      requestId: input.requestId,
    });
    if (created.status !== 'created') {
      throw unauthorized('invalid_credentials');
    }

    return tokenResponse({
      accessToken: accessToken.value,
      refreshToken: refreshToken.value,
      sessionId: created.sessionId,
      subject,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
    });
  }

  public async refresh(input: {
    readonly refreshToken: string;
    readonly requestId: string;
  }): Promise<AuthTokenResponse> {
    if (!isWellFormedOpaqueToken(input.refreshToken)) {
      throw unauthorized();
    }

    const accessToken = issueOpaqueToken();
    const refreshToken = issueOpaqueToken();
    const result = await this.#repository.rotateRefreshToken({
      currentRefreshTokenHash: hashOpaqueToken(input.refreshToken),
      replacementRefreshTokenHash: refreshToken.hash,
      replacementAccessTokenHash: accessToken.hash,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
      inactivityTtlSeconds: this.#config.tokens.refreshInactivityTtlSeconds,
      requestId: input.requestId,
    });

    if (result.status !== 'rotated') {
      throw unauthorized();
    }

    return tokenResponse({
      accessToken: accessToken.value,
      refreshToken: refreshToken.value,
      sessionId: result.principal.sessionId,
      subject: result.principal,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
    });
  }

  public async authenticate(accessToken: string): Promise<AuthenticatedPrincipal> {
    if (!isWellFormedOpaqueToken(accessToken)) {
      throw unauthorized();
    }
    const principal = await this.#repository.resolveAccessToken(
      hashOpaqueToken(accessToken),
    );
    if (principal === null) {
      throw unauthorized();
    }
    return principal;
  }

  public async logout(input: {
    readonly accessToken: string;
    readonly requestId: string;
  }): Promise<void> {
    if (!isWellFormedOpaqueToken(input.accessToken)) return;
    await this.#repository.revokeSessionByAccessToken({
      accessTokenHash: hashOpaqueToken(input.accessToken),
      requestId: input.requestId,
    });
  }

  public async logoutAll(input: {
    readonly accessToken: string;
    readonly requestId: string;
  }): Promise<void> {
    const principal = await this.authenticate(input.accessToken);
    await this.#repository.revokeAllSessions({
      userId: principal.id,
      actorSessionId: principal.sessionId,
      requestId: input.requestId,
    });
  }

  public async me(accessToken: string): Promise<Readonly<{
    user: AuthUser;
    sessionId: string;
    scope: AuthTokenResponse['scope'];
  }>> {
    const principal = await this.authenticate(accessToken);
    return {
      user: userFromSubject(principal),
      sessionId: principal.sessionId,
      scope: scopeFor(principal),
    };
  }

  public async sessions(accessToken: string): Promise<readonly SessionSummary[]> {
    const principal = await this.authenticate(accessToken);
    return this.#repository.listSessions({
      userId: principal.id,
      currentSessionId: principal.sessionId,
    });
  }

  public async revokeSession(input: {
    readonly accessToken: string;
    readonly sessionId: string;
    readonly requestId: string;
  }): Promise<void> {
    const principal = await this.authenticate(input.accessToken);
    const revoked = await this.#repository.revokeOwnedSession({
      userId: principal.id,
      actorSessionId: principal.sessionId,
      sessionId: input.sessionId,
      requestId: input.requestId,
    });
    if (!revoked) throw notFound();
  }

  public async changePassword(input: {
    readonly accessToken: string;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly requestId: string;
  }): Promise<AuthTokenResponse> {
    const principal = await this.authenticate(input.accessToken);
    const subject = await this.#repository.getCredentialForUser(principal.id);
    if (subject?.credential === null || subject === null) throw unauthorized();

    const current = await this.#credentials.verify(
      input.currentPassword,
      subject.credential.passwordHash,
    );
    if (!current.valid) throw unauthorized('invalid_credentials');

    const repeated = await this.#credentials.verify(
      input.newPassword,
      subject.credential.passwordHash,
    );
    if (repeated.valid) {
      throw unprocessable('A nova senha deve ser diferente da senha atual.');
    }

    let replacement: Awaited<
      ReturnType<AuthenticationPasswordCredentialService['validateAndHash']>
    >;
    try {
      replacement = await this.#credentials.validateAndHash(input.newPassword);
    } catch (error) {
      passwordPolicyHttpError(error);
    }

    const accessToken = issueOpaqueToken();
    const refreshToken = issueOpaqueToken();
    const changed = await this.#repository.replacePasswordAndRotateCurrentSession({
      userId: principal.id,
      currentSessionId: principal.sessionId,
      currentAccessTokenHash: hashOpaqueToken(input.accessToken),
      expectedPasswordHash: subject.credential.passwordHash,
      replacementPasswordHash: replacement.passwordHash,
      policyVersion: replacement.policyVersion,
      replacementAccessTokenHash: accessToken.hash,
      replacementRefreshTokenHash: refreshToken.hash,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
      inactivityTtlSeconds: this.#config.tokens.refreshInactivityTtlSeconds,
      requestId: input.requestId,
    });
    if (changed.status !== 'changed') throw unauthorized();
    return tokenResponse({
      accessToken: accessToken.value,
      refreshToken: refreshToken.value,
      sessionId: changed.principal.sessionId,
      subject: changed.principal,
      accessTtlSeconds: this.#config.tokens.accessTtlSeconds,
    });
  }

  public async requestPasswordRecovery(input: {
    readonly email: string;
    readonly ipAddress: string;
    readonly requestId: string;
  }): Promise<void> {
    const ipHmac = hmacIdentifier(
      `password-recovery-request:${input.ipAddress.normalize('NFC')}`,
      this.#config.abuseProtection.ipHmacKey,
    );
    const ipDecision = await this.#throttle.checkIp(ipHmac);
    if (!ipDecision.allowed) return;

    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmail(input.email);
    } catch (error) {
      if (!(error instanceof InvalidEmailError)) throw error;
      normalizedEmail = `${hmacIdentifier(
        input.email.normalize('NFC').toLowerCase(),
        this.#config.abuseProtection.emailHmacKey,
      )}@invalid.local`;
    }
    const identifierHmac = hmacIdentifier(
      `password-recovery-request:${normalizedEmail}`,
      this.#config.abuseProtection.emailHmacKey,
    );
    const identifierDecision = await this.#throttle.checkIdentifier(identifierHmac);
    if (!identifierDecision.allowed) return;
    await this.#throttle.recordFailure({
      ipHmac,
      identifierHmac,
      windowSeconds: this.#config.abuseProtection.windowSeconds,
      failureThreshold: this.#config.abuseProtection.failureThreshold,
      lockScheduleSeconds: this.#config.abuseProtection.lockScheduleSeconds,
    });

    const token = issueOpaqueToken();
    await this.#repository.beginPasswordRecovery({
      normalizedEmail,
      tokenHash: token.hash,
      deliveryToken: token.value,
      ttlSeconds: this.#config.challenges.passwordRecoveryTtlSeconds,
      requestId: input.requestId,
    });
  }

  public async completePasswordRecovery(input: {
    readonly token: string;
    readonly newPassword: string;
    readonly ipAddress: string;
    readonly requestId: string;
  }): Promise<void> {
    const ipHmac = hmacIdentifier(
      `password-recovery-complete:${input.ipAddress.normalize('NFC')}`,
      this.#config.abuseProtection.ipHmacKey,
    );
    const ipDecision = await this.#throttle.checkIp(ipHmac);
    if (!ipDecision.allowed) throw rateLimited(retryAfter(ipDecision));
    const identifierHmac = hmacIdentifier(
      `password-recovery-complete:${input.token.normalize('NFC')}`,
      this.#config.abuseProtection.externalReferenceHmacKey,
    );
    const identifierDecision = await this.#throttle.checkIdentifier(identifierHmac);
    if (!identifierDecision.allowed) {
      throw rateLimited(retryAfter(identifierDecision));
    }
    const recordRejectedAttempt = () =>
      this.#throttle.recordFailure({
        ipHmac,
        identifierHmac,
        windowSeconds: this.#config.abuseProtection.windowSeconds,
        failureThreshold: this.#config.abuseProtection.failureThreshold,
        lockScheduleSeconds: this.#config.abuseProtection.lockScheduleSeconds,
      });
    if (!isWellFormedOpaqueToken(input.token)) {
      await recordRejectedAttempt();
      throw invalidOrExpiredChallenge();
    }
    const tokenHash = hashOpaqueToken(input.token);
    if (!(await this.#repository.isPasswordRecoveryTokenUsable(tokenHash))) {
      await recordRejectedAttempt();
      throw invalidOrExpiredChallenge();
    }

    let replacement: Awaited<
      ReturnType<AuthenticationPasswordCredentialService['validateAndHash']>
    >;
    try {
      replacement = await this.#credentials.validateAndHash(input.newPassword);
    } catch (error) {
      passwordPolicyHttpError(error);
    }

    const completed = await this.#repository.completePasswordRecovery({
      tokenHash,
      replacementPasswordHash: replacement.passwordHash,
      policyVersion: replacement.policyVersion,
      requestId: input.requestId,
    });
    if (!completed) {
      await recordRejectedAttempt();
      throw invalidOrExpiredChallenge();
    }
    await this.#throttle.recordSuccess({ identifierHmac });
  }
}

export async function createAuthenticationService(
  dependencies: Omit<AuthenticationServiceDependencies, 'dummyPasswordHash'>,
): Promise<AuthenticationService> {
  const dummy = await dependencies.credentials.validateAndHash(
    issueOpaqueToken().value,
  );
  return new DefaultAuthenticationService({
    ...dependencies,
    dummyPasswordHash: dummy.passwordHash,
  });
}

export function bearerTokenFromAuthorizationHeader(
  authorization: string | undefined,
): string {
  if (authorization === undefined) throw unauthorized();
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(authorization);
  if (match?.[1] === undefined) throw unauthorized();
  return match[1];
}
