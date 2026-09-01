import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { loadAuthenticationRuntimeConfig } from '../../src/auth/config.js';
import type {
  AuthenticatedPrincipal,
  AuthRepository,
  LoginSubject,
  LoginThrottle,
  LoginThrottleDecision,
  PasswordRecoveryBeginInput,
  RotateRefreshResult,
  SessionSummary,
} from '../../src/auth/contracts.js';
import { normalizePassword } from '../../src/auth/normalization.js';
import type {
  AuthenticationPasswordCredentialService,
} from '../../src/auth/password-credential.js';
import { PasswordHashingCapacityError } from '../../src/auth/password-hasher.js';
import {
  DefaultAuthenticationService,
} from '../../src/auth/service.js';
import { HttpError } from '../../src/security/http-error.js';
import {
  hashOpaqueToken,
  isWellFormedOpaqueToken,
  issueOpaqueToken,
} from '../../src/security/tokens.js';

const config = loadAuthenticationRuntimeConfig({ NODE_ENV: 'test' });

const issuedTokenWindow = Object.freeze({
  issuedAt: new Date('2026-08-21T12:00:00.000Z'),
  accessExpiresAt: new Date('2026-08-21T12:15:00.000Z'),
  inactivityExpiresAt: new Date('2026-09-04T12:00:00.000Z'),
  absoluteExpiresAt: new Date('2026-09-20T12:00:00.000Z'),
});

const activeSubject: LoginSubject = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: 'org_tche_fertilidade',
  name: 'Usuário Teste',
  email: 'usuario@example.com',
  profile: 'colaborador',
  status: 'ativo',
  authorizationVersion: 3,
  credential: {
    id: '22222222-2222-4222-8222-222222222222',
    passwordHash: 'hash:SenhaSegura1',
    policyVersion: 'test-v1',
  },
};

function principal(sessionId = 'session-1'): AuthenticatedPrincipal {
  return { ...activeSubject, credential: undefined, sessionId } as unknown as AuthenticatedPrincipal;
}

class FakeCredentials implements AuthenticationPasswordCredentialService {
  public readonly verifiedHashes: string[] = [];
  public readonly validatedPasswords: string[] = [];
  public verifyError: Error | undefined;

  public async validateAndHash(password: string) {
    this.validatedPasswords.push(password);
    return {
      passwordHash: `hash:${normalizePassword(password)}`,
      policyVersion: 'test-v1',
    };
  }

  public async verify(password: string, passwordHash: string) {
    if (this.verifyError !== undefined) throw this.verifyError;
    this.verifiedHashes.push(passwordHash);
    return {
      valid: passwordHash === `hash:${normalizePassword(password)}`,
      needsRehash: false,
    };
  }

  public async rehash(password: string) {
    return this.validateAndHash(password);
  }
}

class FakeThrottle implements LoginThrottle {
  public ipDecision: LoginThrottleDecision = { allowed: true };
  public identifierDecision: LoginThrottleDecision = { allowed: true };
  public failures = 0;
  public successes = 0;
  public identifierChecks = 0;

  public async checkIp(): Promise<LoginThrottleDecision> {
    return this.ipDecision;
  }

  public async checkIdentifier(): Promise<LoginThrottleDecision> {
    this.identifierChecks += 1;
    return this.identifierDecision;
  }

  public async recordFailure(): Promise<void> {
    this.failures += 1;
  }

  public async recordSuccess(): Promise<void> {
    this.successes += 1;
  }
}

class FakeRepository implements AuthRepository {
  public subject: LoginSubject | null = activeSubject;
  public createdSession:
    | Parameters<AuthRepository['createSession']>[0]
    | undefined;
  public rotateResult: RotateRefreshResult = { status: 'invalid' };
  public resolvedPrincipal: AuthenticatedPrincipal | null = null;
  public recovery: PasswordRecoveryBeginInput | undefined;
  public recoveryTokenUsable = true;
  public checkedRecoveryTokenHash: string | undefined;
  public revokedAll:
    | Parameters<AuthRepository['revokeAllSessions']>[0]
    | undefined;
  public revokedOwned:
    | Parameters<AuthRepository['revokeOwnedSession']>[0]
    | undefined;
  public replacement:
    | Parameters<AuthRepository['replacePasswordAndRotateCurrentSession']>[0]
    | undefined;

  public async findLoginSubject(): Promise<LoginSubject | null> {
    return this.subject;
  }

  public async updateCredentialHashIfCurrent(): Promise<void> {}

  public async createSession(
    input: Parameters<AuthRepository['createSession']>[0],
  ) {
    this.createdSession = input;
    return {
      status: 'created' as const,
      sessionId: 'session-created',
      authorizationVersion: input.authorizationVersion,
      ...issuedTokenWindow,
    };
  }

  public async rotateRefreshToken(): Promise<RotateRefreshResult> {
    return this.rotateResult;
  }

  public async resolveAccessToken(): Promise<AuthenticatedPrincipal | null> {
    return this.resolvedPrincipal;
  }

  public async revokeSessionByAccessToken(): Promise<void> {}
  public async revokeAllSessions(
    input: Parameters<AuthRepository['revokeAllSessions']>[0],
  ): Promise<void> {
    this.revokedAll = input;
  }
  public async listSessions(): Promise<readonly SessionSummary[]> {
    return [];
  }
  public async revokeOwnedSession(
    input: Parameters<AuthRepository['revokeOwnedSession']>[0],
  ): Promise<boolean> {
    this.revokedOwned = input;
    return true;
  }
  public async getCredentialForUser(): Promise<LoginSubject | null> {
    return this.subject;
  }
  public async replacePasswordAndRotateCurrentSession(
    input: Parameters<AuthRepository['replacePasswordAndRotateCurrentSession']>[0],
  ) {
    this.replacement = input;
    return {
      status: 'changed' as const,
      principal: principal(input.currentSessionId),
      ...issuedTokenWindow,
    };
  }
  public async beginPasswordRecovery(input: PasswordRecoveryBeginInput): Promise<void> {
    this.recovery = input;
  }
  public async isPasswordRecoveryTokenUsable(tokenHash: string): Promise<boolean> {
    this.checkedRecoveryTokenHash = tokenHash;
    return this.recoveryTokenUsable;
  }
  public async completePasswordRecovery(): Promise<boolean> {
    return true;
  }
}

function serviceFixture() {
  const repository = new FakeRepository();
  const throttle = new FakeThrottle();
  const credentials = new FakeCredentials();
  const service = new DefaultAuthenticationService({
    config,
    repository,
    throttle,
    credentials,
    dummyPasswordHash: 'hash:DummyPassword1',
  });
  return { service, repository, throttle, credentials };
}

async function expectHttpError(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) => error instanceof HttpError && error.code === code,
  );
}

describe('authentication service', () => {
  it('performs the dummy password work and uses a uniform 401 for unknown identities', async () => {
    const fixture = serviceFixture();
    fixture.repository.subject = null;

    await expectHttpError(
      fixture.service.login({
        email: 'nao-existe@example.com',
        password: 'QualquerSenha1',
        ipAddress: '192.0.2.1',
        requestId: 'req-1',
      }),
      'invalid_credentials',
    );

    assert.deepEqual(fixture.credentials.verifiedHashes, ['hash:DummyPassword1']);
    assert.equal(fixture.throttle.failures, 1);
    assert.equal(fixture.repository.createdSession, undefined);
  });

  it('checks the IP before Argon2 and returns Retry-After semantics', async () => {
    const fixture = serviceFixture();
    fixture.throttle.ipDecision = { allowed: false, retryAfterSeconds: 60 };

    await assert.rejects(
      fixture.service.login({
        email: activeSubject.email,
        password: 'SenhaSegura1',
        ipAddress: '192.0.2.1',
        requestId: 'req-2',
      }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === 'rate_limited' &&
        error.retryAfterSeconds === 60,
    );
    assert.equal(fixture.credentials.verifiedHashes.length, 0);
    assert.equal(fixture.throttle.identifierChecks, 0);
  });

  it('does not record an invalid credential when Argon2 capacity is saturated', async () => {
    const fixture = serviceFixture();
    fixture.credentials.verifyError = new PasswordHashingCapacityError();

    await assert.rejects(
      fixture.service.login({
        email: activeSubject.email,
        password: 'SenhaSegura1',
        ipAddress: '192.0.2.1',
        requestId: 'req-capacity',
      }),
      PasswordHashingCapacityError,
    );
    assert.equal(fixture.throttle.failures, 0);
    assert.equal(fixture.throttle.successes, 0);
    assert.equal(fixture.repository.createdSession, undefined);
  });

  it('creates a stateful session with hashes only and no property projection', async () => {
    const fixture = serviceFixture();
    const response = await fixture.service.login({
      email: 'USUARIO@example.com',
      password: 'SenhaSegura1',
      ipAddress: '192.0.2.1',
      requestId: 'req-3',
    });

    assert.equal(response.expiresIn, 900);
    assert.deepEqual(response.issuedAt, issuedTokenWindow.issuedAt);
    assert.deepEqual(response.accessExpiresAt, issuedTokenWindow.accessExpiresAt);
    assert.deepEqual(
      response.sessionInactivityExpiresAt,
      issuedTokenWindow.inactivityExpiresAt,
    );
    assert.deepEqual(
      response.sessionAbsoluteExpiresAt,
      issuedTokenWindow.absoluteExpiresAt,
    );
    assert.equal(response.scope.mode, 'property_bindings');
    assert.equal('properties' in response.scope, false);
    assert.equal(isWellFormedOpaqueToken(response.accessToken), true);
    assert.equal(isWellFormedOpaqueToken(response.refreshToken), true);
    assert.equal(
      fixture.repository.createdSession?.accessTokenHash,
      hashOpaqueToken(response.accessToken),
    );
    assert.equal(
      fixture.repository.createdSession?.refreshTokenHash,
      hashOpaqueToken(response.refreshToken),
    );
    assert.notEqual(
      fixture.repository.createdSession?.refreshTokenHash,
      response.refreshToken,
    );
    assert.equal(fixture.throttle.successes, 1);
  });

  it('delegates refresh reuse detection to the atomic repository and exposes only 401', async () => {
    const fixture = serviceFixture();
    const refreshToken = issueOpaqueToken().value;
    fixture.repository.rotateResult = { status: 'replayed' };
    await expectHttpError(
      fixture.service.refresh({ refreshToken, requestId: 'req-4' }),
      'invalid_session',
    );

    fixture.repository.rotateResult = {
      status: 'rotated',
      principal: principal('rotated-session'),
      ...issuedTokenWindow,
    };
    const response = await fixture.service.refresh({
      refreshToken,
      requestId: 'req-5',
    });
    assert.equal(response.sessionId, 'rotated-session');
    assert.notEqual(response.refreshToken, refreshToken);
  });

  it('changes the password through one atomic replace-and-revoke operation', async () => {
    const fixture = serviceFixture();
    const accessToken = issueOpaqueToken().value;
    fixture.repository.resolvedPrincipal = principal();

    const response = await fixture.service.changePassword({
      accessToken,
      currentPassword: 'SenhaSegura1',
      newPassword: 'NovaSenhaSegura2',
      requestId: 'req-6',
    });

    assert.equal(fixture.repository.replacement?.userId, activeSubject.id);
    assert.equal(
      fixture.repository.replacement?.replacementPasswordHash,
      'hash:NovaSenhaSegura2',
    );
    assert.equal(response.sessionId, 'session-1');
    assert.equal(isWellFormedOpaqueToken(response.accessToken), true);
    assert.equal(isWellFormedOpaqueToken(response.refreshToken), true);
    assert.equal(
      fixture.repository.replacement?.replacementAccessTokenHash,
      hashOpaqueToken(response.accessToken),
    );
  });

  it('propagates the authenticated actor session to session revocation audits', async () => {
    const fixture = serviceFixture();
    const accessToken = issueOpaqueToken().value;
    fixture.repository.resolvedPrincipal = principal('actor-session');

    await fixture.service.logoutAll({ accessToken, requestId: 'req-logout-all' });
    assert.deepEqual(fixture.repository.revokedAll, {
      userId: activeSubject.id,
      actorSessionId: 'actor-session',
      requestId: 'req-logout-all',
    });

    await fixture.service.revokeSession({
      accessToken,
      sessionId: 'target-session',
      requestId: 'req-revoke-session',
    });
    assert.deepEqual(fixture.repository.revokedOwned, {
      userId: activeSubject.id,
      actorSessionId: 'actor-session',
      sessionId: 'target-session',
      requestId: 'req-revoke-session',
    });
  });

  it('always invokes one generic recovery command and keeps the raw token out of the response', async () => {
    const fixture = serviceFixture();
    const result = await fixture.service.requestPasswordRecovery({
      email: 'unknown@example.com',
      ipAddress: '192.0.2.10',
      requestId: 'req-7',
    });

    assert.equal(result, undefined);
    assert.ok(fixture.repository.recovery);
    assert.equal(isWellFormedOpaqueToken(fixture.repository.recovery.deliveryToken), true);
    assert.equal(
      fixture.repository.recovery.tokenHash,
      hashOpaqueToken(fixture.repository.recovery.deliveryToken),
    );
    assert.equal(fixture.repository.recovery.ttlSeconds, 1_800);
  });

  it('rejects an unknown recovery token before any Argon2-equivalent work', async () => {
    const fixture = serviceFixture();
    const token = issueOpaqueToken().value;
    fixture.repository.recoveryTokenUsable = false;

    await assert.rejects(
      () =>
        fixture.service.completePasswordRecovery({
          token,
          newPassword: 'SenhaNova1',
          ipAddress: '192.0.2.11',
          requestId: 'req-invalid-recovery',
        }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.statusCode === 400 &&
        error.code === 'invalid_or_expired_challenge',
    );
    assert.equal(fixture.repository.checkedRecoveryTokenHash, hashOpaqueToken(token));
    assert.deepEqual(fixture.credentials.validatedPasswords, []);
  });
});
