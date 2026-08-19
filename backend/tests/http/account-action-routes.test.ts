import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import fastify from 'fastify';

import {
  accountActionRoutesPlugin,
  type AccountActionRoutesOptions,
} from '../../src/account-actions/account-action-routes.js';
import { AccountActionError } from '../../src/account-actions/errors.js';
import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';

const accessToken = 'A'.repeat(43);
const actionToken = 'B'.repeat(43);
const restrictedToken = 'C'.repeat(43);
const expiresAt = new Date('2026-08-19T12:30:00.000Z');

interface CapturedCalls {
  readonly authenticatedTokens: string[];
  invitationIssue?: unknown;
  invitationAccept?: unknown;
  primaryRequest?: unknown;
  primaryCurrentConfirmation?: unknown;
  primaryNewConfirmation?: unknown;
  secondaryRequest?: unknown;
  secondaryConfirmation?: unknown;
  adminSecondaryRequest?: unknown;
  adminSecondaryConfirmation?: unknown;
  adminNewPrimaryConfirmation?: unknown;
  adminSecondaryCompletion?: unknown;
  adminSecondaryCancellation?: unknown;
  adminBreakGlassEmailConfirmation?: unknown;
  adminBreakGlassCompletion?: unknown;
  assistedStart?: unknown;
  assistedEmailConfirmation?: unknown;
  assistedCompletion?: unknown;
  assistedCancellation?: unknown;
}

interface Harness {
  readonly options: AccountActionRoutesOptions;
  readonly calls: CapturedCalls;
  setAssistedStartError(error: Error | undefined): void;
}

function authenticatedPrincipal(
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal {
  return {
    id: 'admin-1',
    organizationId: 'org_tche_fertilidade',
    name: 'Administrador',
    email: 'admin@example.test',
    profile: 'admin',
    status: 'ativo',
    authorizationVersion: 7,
    sessionId: 'session-1',
    ...overrides,
  };
}

function harness(input: {
  readonly principal?: AuthenticatedPrincipal;
  readonly assistedRecoveryEnabled?: boolean;
} = {}): Harness {
  const calls: CapturedCalls = { authenticatedTokens: [] };
  const principal = input.principal ?? authenticatedPrincipal();
  let assistedStartError: Error | undefined;

  return {
    calls,
    setAssistedStartError(error) {
      assistedStartError = error;
    },
    options: {
      authenticationService: {
        async authenticate(token) {
          calls.authenticatedTokens.push(token);
          return principal;
        },
      },
      invitationService: {
        async issueForExistingPendingUser(request) {
          calls.invitationIssue = request;
          return { challengeId: 'invitation-1', expiresAt };
        },
        async accept(request) {
          calls.invitationAccept = request;
          return { userId: 'user-pending', loginRequired: true };
        },
      },
      primaryEmailService: {
        async request(request) {
          calls.primaryRequest = request;
          return { challengeId: 'primary-current-1', expiresAt };
        },
        async confirmCurrentAddress(request) {
          calls.primaryCurrentConfirmation = request;
          return { status: 'accepted' };
        },
        async confirmNewAddress(request) {
          calls.primaryNewConfirmation = request;
          return { userId: principal.id, loginRequired: true };
        },
      },
      secondaryEmailService: {
        async requestVerification(request) {
          calls.secondaryRequest = request;
          return { challengeId: 'secondary-1', expiresAt };
        },
        async confirm(request) {
          calls.secondaryConfirmation = request;
          return { userId: principal.id, loginRequired: true };
        },
      },
      adminSecondaryRecoveryService: {
        async request(request) {
          calls.adminSecondaryRequest = request;
          return { status: 'accepted' };
        },
        async confirmSecondaryAddress(request) {
          calls.adminSecondaryConfirmation = request;
          return { status: 'accepted' };
        },
        async confirmNewPrimaryAddress(request) {
          calls.adminNewPrimaryConfirmation = request;
          return { token: restrictedToken, expiresAt };
        },
        async complete(request) {
          calls.adminSecondaryCompletion = request;
          return { userId: principal.id, loginRequired: true };
        },
        async cancel(request) {
          calls.adminSecondaryCancellation = request;
        },
      },
      adminBreakGlassContinuationService: {
        async confirmNewEmail(request) {
          calls.adminBreakGlassEmailConfirmation = request;
          return { token: restrictedToken, expiresAt };
        },
        async complete(request) {
          calls.adminBreakGlassCompletion = request;
          return { userId: 'admin-1', loginRequired: true };
        },
      },
      assistedRecoveryService: {
        async startByAdministrator(request) {
          calls.assistedStart = request;
          if (assistedStartError !== undefined) throw assistedStartError;
          return { recoveryId: 'recovery-1', expiresAt };
        },
        async confirmNewEmail(request) {
          calls.assistedEmailConfirmation = request;
          return { token: restrictedToken, expiresAt };
        },
        async complete(request) {
          calls.assistedCompletion = request;
          return { userId: 'producer-1', loginRequired: true };
        },
        async cancel(request) {
          calls.assistedCancellation = request;
        },
      },
      assistedRecoveryEnabled: input.assistedRecoveryEnabled ?? true,
    },
  };
}

async function buildTestApp(options: AccountActionRoutesOptions) {
  const app = fastify({ logger: false, genReqId: () => 'req-account-action' });
  await app.register(accountActionRoutesPlugin, {
    prefix: '/v1/auth',
    ...options,
  });
  return app;
}

const bearerHeaders = { authorization: `Bearer ${accessToken}` };

describe('account-action HTTP plugin', () => {
  it('derives Admin and organization from bearer authentication for privileged actions', async () => {
    const testHarness = harness();
    const app = await buildTestApp(testHarness.options);

    const invitation = await app.inject({
      method: 'POST',
      url: '/v1/auth/invitations',
      headers: bearerHeaders,
      payload: { usuario_id: 'pending-1' },
    });
    assert.equal(invitation.statusCode, 202);
    assert.deepEqual(invitation.json(), { status: 'aceito' });
    assert.equal(invitation.headers['cache-control'], 'no-store');
    assert.equal(invitation.headers.pragma, 'no-cache');
    assert.equal(invitation.headers['referrer-policy'], 'no-referrer');
    assert.deepEqual(testHarness.calls.invitationIssue, {
      organizationId: 'org_tche_fertilidade',
      actorAdminUserId: 'admin-1',
      actorSessionId: 'session-1',
      userId: 'pending-1',
      requestId: 'req-account-action',
    });

    const secondary = await app.inject({
      method: 'POST',
      url: '/v1/auth/secondary-email/request',
      headers: bearerHeaders,
      payload: { novo_email: 'secundario@example.test' },
    });
    assert.equal(secondary.statusCode, 202);
    assert.deepEqual(testHarness.calls.secondaryRequest, {
      organizationId: 'org_tche_fertilidade',
      authenticatedUserId: 'admin-1',
      actorSessionId: 'session-1',
      newEmail: 'secundario@example.test',
      requestId: 'req-account-action',
    });

    const recovery = await app.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery',
      headers: bearerHeaders,
      payload: {
        usuario_id: 'producer-1',
        novo_email: 'novo@example.test',
        motivo: 'lost_email_access',
        referencia_operacional: 'CASE-2026/0081',
      },
    });
    assert.equal(recovery.statusCode, 202);
    assert.deepEqual(testHarness.calls.assistedStart, {
      organizationId: 'org_tche_fertilidade',
      actorAdminUserId: 'admin-1',
      actorSessionId: 'session-1',
      targetUserId: 'producer-1',
      newEmail: 'novo@example.test',
      reasonCode: 'lost_email_access',
      externalCaseReference: 'CASE-2026/0081',
      requestId: 'req-account-action',
    });
    assert.deepEqual(testHarness.calls.authenticatedTokens, [
      accessToken,
      accessToken,
      accessToken,
    ]);
    await app.close();
  });

  it('maps the authenticated self-service primary-email request without accepting identity fields', async () => {
    const testHarness = harness({
      principal: authenticatedPrincipal({
        id: 'producer-1',
        profile: 'produtor',
        sessionId: 'producer-session',
      }),
    });
    const app = await buildTestApp(testHarness.options);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/email-change/request',
      headers: bearerHeaders,
      payload: {
        novo_email: 'novo@example.test',
        senha_atual: 'Senha atual protegida',
      },
    });

    assert.equal(response.statusCode, 202);
    assert.deepEqual(testHarness.calls.primaryRequest, {
      organizationId: 'org_tche_fertilidade',
      authenticatedUserId: 'producer-1',
      authenticatedSessionId: 'producer-session',
      currentPassword: 'Senha atual protegida',
      newEmail: 'novo@example.test',
      requestId: 'req-account-action',
    });
    assert.equal(response.body.includes('Senha atual protegida'), false);
    await app.close();
  });

  it('keeps all token continuations public, POST-only and no-store', async () => {
    const testHarness = harness();
    const app = await buildTestApp(testHarness.options);

    const invitation = await app.inject({
      method: 'POST',
      url: '/v1/auth/invitations/accept',
      payload: { token: actionToken, senha: 'Nova senha protegida' },
    });
    assert.equal(invitation.statusCode, 204);
    assert.deepEqual(testHarness.calls.invitationAccept, {
      token: actionToken,
      password: 'Nova senha protegida',
      requestId: 'req-account-action',
    });

    const currentEmail = await app.inject({
      method: 'POST',
      url: '/v1/auth/email-change/confirm-current',
      payload: { token: actionToken },
    });
    assert.equal(currentEmail.statusCode, 202);
    assert.deepEqual(currentEmail.json(), { status: 'aceito' });

    const newEmail = await app.inject({
      method: 'POST',
      url: '/v1/auth/email-change/confirm-new',
      payload: { token: actionToken },
    });
    assert.equal(newEmail.statusCode, 204);

    const secondaryEmail = await app.inject({
      method: 'POST',
      url: '/v1/auth/secondary-email/confirm',
      payload: { token: actionToken },
    });
    assert.equal(secondaryEmail.statusCode, 204);

    const adminSecondaryRequest = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-secondary-recovery/request',
      payload: {
        email_secundario: 'secondary@example.test',
        novo_email_principal: 'new-admin@example.test',
      },
    });
    assert.equal(adminSecondaryRequest.statusCode, 202);
    assert.deepEqual(testHarness.calls.adminSecondaryRequest, {
      secondaryEmail: 'secondary@example.test',
      newPrimaryEmail: 'new-admin@example.test',
      ipAddress: '127.0.0.1',
      requestId: 'req-account-action',
    });

    const adminSecondaryConfirmation = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-secondary-recovery/confirm-secondary',
      payload: { token: actionToken },
    });
    assert.equal(adminSecondaryConfirmation.statusCode, 202);
    assert.deepEqual(testHarness.calls.adminSecondaryConfirmation, {
      token: actionToken,
      requestId: 'req-account-action',
    });

    const adminNewPrimaryConfirmation = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-secondary-recovery/confirm-new-primary',
      payload: { token: actionToken },
    });
    assert.equal(adminNewPrimaryConfirmation.statusCode, 200);
    assert.deepEqual(adminNewPrimaryConfirmation.json(), {
      token: restrictedToken,
      expira_em: expiresAt.toISOString(),
    });

    const adminSecondaryCompletion = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-secondary-recovery/complete',
      payload: { token: restrictedToken, nova_senha: 'Senha nova Admin' },
    });
    assert.equal(adminSecondaryCompletion.statusCode, 204);
    assert.deepEqual(testHarness.calls.adminSecondaryCompletion, {
      token: restrictedToken,
      newPassword: 'Senha nova Admin',
      requestId: 'req-account-action',
    });

    const adminSecondaryCancellation = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-secondary-recovery/cancel',
      payload: { token: restrictedToken },
    });
    assert.equal(adminSecondaryCancellation.statusCode, 204);

    const breakGlassEmail = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-break-glass/confirm-email',
      payload: { token: actionToken },
    });
    assert.equal(breakGlassEmail.statusCode, 200);
    assert.deepEqual(breakGlassEmail.json(), {
      token: restrictedToken,
      expira_em: expiresAt.toISOString(),
    });
    assert.equal(breakGlassEmail.headers['cache-control'], 'no-store');
    assert.deepEqual(testHarness.calls.adminBreakGlassEmailConfirmation, {
      token: actionToken,
      requestId: 'req-account-action',
    });

    const breakGlassCompletion = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-break-glass/complete',
      payload: { token: restrictedToken, nova_senha: 'Senha break-glass nova' },
    });
    assert.equal(breakGlassCompletion.statusCode, 204);
    assert.equal(breakGlassCompletion.headers['cache-control'], 'no-store');
    assert.deepEqual(testHarness.calls.adminBreakGlassCompletion, {
      token: restrictedToken,
      newPassword: 'Senha break-glass nova',
      requestId: 'req-account-action',
    });

    for (const url of [
      '/v1/auth/admin-break-glass/confirm-email',
      '/v1/auth/admin-break-glass/complete',
    ]) {
      const get = await app.inject({ method: 'GET', url });
      assert.equal(get.statusCode, 404);
    }

    const recoveryEmail = await app.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery/confirm-email',
      payload: { token: actionToken },
    });
    assert.equal(recoveryEmail.statusCode, 200);
    assert.deepEqual(recoveryEmail.json(), {
      token: restrictedToken,
      expira_em: expiresAt.toISOString(),
    });
    assert.equal(recoveryEmail.headers['cache-control'], 'no-store');

    const completion = await app.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery/complete',
      payload: { token: restrictedToken, nova_senha: 'Outra senha protegida' },
    });
    assert.equal(completion.statusCode, 204);
    assert.deepEqual(testHarness.calls.assistedCompletion, {
      token: restrictedToken,
      newPassword: 'Outra senha protegida',
      requestId: 'req-account-action',
    });

    const cancellation = await app.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery/cancel',
      payload: { token: restrictedToken },
    });
    assert.equal(cancellation.statusCode, 204);
    assert.equal(testHarness.calls.authenticatedTokens.length, 0);
    await app.close();
  });

  it('rejects missing bearer, non-Admin actors, disabled starts and Admin targets safely', async () => {
    const missingHarness = harness();
    const missingApp = await buildTestApp(missingHarness.options);
    const missing = await missingApp.inject({
      method: 'POST',
      url: '/v1/auth/invitations',
      payload: { usuario_id: 'pending-1' },
    });
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.headers['www-authenticate'], 'Bearer');
    assert.equal(missing.headers['cache-control'], 'no-store');
    assert.equal(missing.json().error.code, 'invalid_session');
    assert.equal(missingHarness.calls.invitationIssue, undefined);
    await missingApp.close();

    const producerHarness = harness({
      principal: authenticatedPrincipal({ profile: 'produtor' }),
    });
    const producerApp = await buildTestApp(producerHarness.options);
    const forbiddenInvitation = await producerApp.inject({
      method: 'POST',
      url: '/v1/auth/invitations',
      headers: bearerHeaders,
      payload: { usuario_id: 'pending-1' },
    });
    assert.equal(forbiddenInvitation.statusCode, 403);
    assert.equal(producerHarness.calls.invitationIssue, undefined);
    await producerApp.close();

    const disabledHarness = harness({ assistedRecoveryEnabled: false });
    const disabledApp = await buildTestApp(disabledHarness.options);
    const disabled = await disabledApp.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery',
      headers: bearerHeaders,
      payload: {
        usuario_id: 'producer-1',
        novo_email: 'novo@example.test',
        motivo: 'lost_email_access',
        referencia_operacional: 'CASE-1',
      },
    });
    assert.equal(disabled.statusCode, 503);
    assert.equal(disabledHarness.calls.authenticatedTokens.length, 1);
    assert.equal(disabledHarness.calls.assistedStart, undefined);
    await disabledApp.close();

    const targetHarness = harness();
    targetHarness.setAssistedStartError(
      new AccountActionError('admin_assisted_recovery_forbidden'),
    );
    const targetApp = await buildTestApp(targetHarness.options);
    const adminTarget = await targetApp.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery',
      headers: bearerHeaders,
      payload: {
        usuario_id: 'another-admin',
        novo_email: 'novo@example.test',
        motivo: 'other_verified_case',
        referencia_operacional: 'CASE-2',
      },
    });
    assert.equal(adminTarget.statusCode, 403);
    assert.equal(adminTarget.body.includes('another-admin'), false);
    await targetApp.close();
  });

  it('returns a generic validation envelope without echoing secrets or accepting English fields', async () => {
    const testHarness = harness();
    const app = await buildTestApp(testHarness.options);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/invitations/accept',
      payload: { token: actionToken, password: 'never-echo-this-secret' },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: {
        code: 'invalid_request',
        message: 'Requisição inválida.',
        request_id: 'req-account-action',
        details: [],
      },
    });
    assert.equal(response.body.includes('never-echo-this-secret'), false);
    assert.equal(response.headers['cache-control'], 'no-store');

    const missingOperationalReference = await app.inject({
      method: 'POST',
      url: '/v1/auth/assisted-recovery',
      headers: bearerHeaders,
      payload: {
        usuario_id: 'producer-1',
        novo_email: 'novo@example.test',
        motivo: 'lost_email_access',
      },
    });
    assert.equal(missingOperationalReference.statusCode, 400);
    assert.equal(testHarness.calls.assistedStart, undefined);
    await app.close();
  });

  it('does not expose bootstrap or break-glass initiation over HTTP', async () => {
    const app = await buildTestApp(harness().options);
    const bootstrap = await app.inject({
      method: 'POST',
      url: '/v1/auth/bootstrap',
      payload: {},
    });
    const breakGlass = await app.inject({
      method: 'POST',
      url: '/v1/auth/admin-break-glass',
      payload: {},
    });

    assert.equal(bootstrap.statusCode, 404);
    assert.equal(breakGlass.statusCode, 404);
    await app.close();
  });
});
