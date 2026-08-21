import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import fastify from 'fastify';

import { authRoutesPlugin } from '../../src/auth/routes.js';
import { PasswordHashingCapacityError } from '../../src/auth/password-hasher.js';
import type {
  AuthenticationService,
  AuthTokenResponse,
} from '../../src/auth/service.js';
import {
  rateLimited,
  serviceUnavailable,
} from '../../src/security/http-error.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';

function successfulTokens(): AuthTokenResponse {
  const issuedAt = new Date('2026-08-21T12:00:00.000Z');
  return {
    accessToken: issueOpaqueToken().value,
    refreshToken: issueOpaqueToken().value,
    tokenType: 'Bearer',
    expiresIn: 900,
    issuedAt,
    accessExpiresAt: new Date('2026-08-21T12:15:00.000Z'),
    sessionInactivityExpiresAt: new Date('2026-09-04T12:00:00.000Z'),
    sessionAbsoluteExpiresAt: new Date('2026-09-20T12:00:00.000Z'),
    sessionId: 'session-1',
    user: {
      id: 'user-1',
      organizationId: 'org_tche_fertilidade',
      name: 'Usuário Teste',
      email: 'usuario@example.com',
      profile: 'admin',
      status: 'ativo',
      authorizationVersion: 4,
    },
    scope: { mode: 'organization', version: 4 },
  };
}

class FakeService implements AuthenticationService {
  public loginInput: Parameters<AuthenticationService['login']>[0] | undefined;
  public recoveryInput:
    | Parameters<AuthenticationService['requestPasswordRecovery']>[0]
    | undefined;
  public recoveryCompletionInput:
    | Parameters<AuthenticationService['completePasswordRecovery']>[0]
    | undefined;
  public changePasswordInput:
    | Parameters<AuthenticationService['changePassword']>[0]
    | undefined;
  public loginError: Error | undefined;

  public async login(input: Parameters<AuthenticationService['login']>[0]) {
    this.loginInput = input;
    if (this.loginError !== undefined) throw this.loginError;
    return successfulTokens();
  }
  public async refresh() {
    return successfulTokens();
  }
  public async authenticate() {
    return {
      ...successfulTokens().user,
      sessionId: 'session-1',
    };
  }
  public async logout(): Promise<void> {}
  public async logoutAll(): Promise<void> {}
  public async me() {
    const response = successfulTokens();
    return {
      user: response.user,
      sessionId: response.sessionId,
      scope: response.scope,
    };
  }
  public async sessions() {
    return [];
  }
  public async revokeSession(): Promise<void> {}
  public async changePassword(
    input: Parameters<AuthenticationService['changePassword']>[0],
  ) {
    this.changePasswordInput = input;
    return successfulTokens();
  }
  public async requestPasswordRecovery(
    input: Parameters<AuthenticationService['requestPasswordRecovery']>[0],
  ): Promise<void> {
    this.recoveryInput = input;
  }
  public async completePasswordRecovery(
    input: Parameters<AuthenticationService['completePasswordRecovery']>[0],
  ): Promise<void> {
    this.recoveryCompletionInput = input;
  }
}

async function buildTestApp(service: AuthenticationService) {
  const app = fastify({ logger: false, genReqId: () => 'req-auth-test' });
  await app.register(authRoutesPlugin, { prefix: '/v1/auth', service });
  return app;
}

describe('authentication HTTP plugin', () => {
  it('uses the Portuguese external contract and no-store headers', async () => {
    const service = new FakeService();
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'USUARIO@example.com', senha: 'SenhaSegura1' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers.pragma, 'no-cache');
    const body = response.json();
    assert.equal(typeof body.access_token, 'string');
    assert.equal(typeof body.refresh_token, 'string');
    assert.equal(body.emitido_em, '2026-08-21T12:00:00.000Z');
    assert.equal(body.access_expira_em, '2026-08-21T12:15:00.000Z');
    assert.equal(
      body.sessao.expira_inatividade_em,
      '2026-09-04T12:00:00.000Z',
    );
    assert.equal(
      body.sessao.expira_absolutamente_em,
      '2026-09-20T12:00:00.000Z',
    );
    assert.equal(body.usuario.organizacao_id, 'org_tche_fertilidade');
    assert.deepEqual(body.escopo, { modo: 'organizacao', versao: 4 });
    assert.deepEqual(service.loginInput?.password, 'SenhaSegura1');
    assert.equal(JSON.stringify(body).includes('password'), false);
    await app.close();
  });

  it('returns a safe validation envelope without echoing the rejected payload', async () => {
    const app = await buildTestApp(new FakeService());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'usuario@example.com', segredo: 'secret' },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: {
        code: 'invalid_request',
        message: 'Requisição inválida.',
        request_id: 'req-auth-test',
        details: [],
      },
    });
    assert.equal(response.body.includes('secret'), false);
    await app.close();
  });

  it('sets Retry-After for throttled login without exposing an identity', async () => {
    const service = new FakeService();
    service.loginError = rateLimited(120);
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'usuario@example.com', senha: 'SenhaSegura1' },
    });

    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['retry-after'], '120');
    assert.equal(response.json().error.code, 'rate_limited');
    await app.close();
  });

  it('maps saturated password hashing capacity to a detail-free 429', async () => {
    const service = new FakeService();
    service.loginError = new PasswordHashingCapacityError();
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'usuario@example.com', senha: 'SenhaSegura1' },
    });

    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['retry-after'], '1');
    assert.deepEqual(response.json(), {
      error: {
        code: 'rate_limited',
        message: 'Muitas tentativas. Tente novamente mais tarde.',
        request_id: 'req-auth-test',
        details: [],
      },
    });
    await app.close();
  });

  it('returns a documented safe 503 without PostgreSQL details', async () => {
    const service = new FakeService();
    service.loginError = serviceUnavailable();
    const app = await buildTestApp(service);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'usuario@example.com', senha: 'SenhaSegura1' },
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: {
        code: 'service_unavailable',
        message: 'Serviço temporariamente indisponível.',
        request_id: 'req-auth-test',
        details: [],
      },
    });
    assert.equal(response.body.includes('postgres'), false);
    await app.close();
  });

  it('keeps recovery generic and /me free of property lists', async () => {
    const service = new FakeService();
    const app = await buildTestApp(service);
    const recovery = await app.inject({
      method: 'POST',
      url: '/v1/auth/password-recovery/request',
      payload: { email: 'unknown@example.com' },
    });
    assert.equal(recovery.statusCode, 202);
    assert.deepEqual(recovery.json(), { status: 'aceito' });
    assert.equal(service.recoveryInput?.ipAddress, '127.0.0.1');

    const recoveryToken = issueOpaqueToken().value;
    const completed = await app.inject({
      method: 'POST',
      url: '/v1/auth/password-recovery/complete',
      payload: { token: recoveryToken, nova_senha: 'SenhaNova1' },
    });
    assert.equal(completed.statusCode, 204);
    assert.deepEqual(service.recoveryCompletionInput, {
      token: recoveryToken,
      newPassword: 'SenhaNova1',
      ipAddress: '127.0.0.1',
      requestId: 'req-auth-test',
    });

    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${issueOpaqueToken().value}` },
    });
    assert.equal(me.statusCode, 200);
    assert.equal('propriedades' in me.json().escopo, false);
    await app.close();
  });

  it('returns the rotated pair after an authenticated password change', async () => {
    const service = new FakeService();
    const app = await buildTestApp(service);
    const accessToken = issueOpaqueToken().value;
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        senha_atual: 'SenhaAnterior1',
        nova_senha: 'SenhaNova2',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(typeof response.json().access_token, 'string');
    assert.equal(typeof response.json().refresh_token, 'string');
    assert.deepEqual(service.changePasswordInput, {
      accessToken,
      currentPassword: 'SenhaAnterior1',
      newPassword: 'SenhaNova2',
      requestId: 'req-auth-test',
    });
    await app.close();
  });
});
