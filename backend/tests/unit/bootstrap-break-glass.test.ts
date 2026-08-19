import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AdminBreakGlassCliService,
  AdminBreakGlassContinuationService,
  type AdminBreakGlassRepository,
  type BreakGlassAuthorizationVerifier,
} from '../../src/account-actions/admin-break-glass-service.js';
import {
  InitialAdminBootstrapCliService,
  InitialAdminInvitationCorrectionCliService,
  type InitialAdminBootstrapRepository,
  type InitialAdminBootstrapState,
} from '../../src/account-actions/bootstrap-service.js';
import type { AccountSnapshot } from '../../src/account-actions/contracts.js';
import { AccountActionError } from '../../src/account-actions/errors.js';
import type { PasswordCredentialService } from '../../src/auth/password-credential.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { hashActionToken } from '../../src/security/action-token.js';

const now = new Date('2026-08-19T12:00:00.000Z');

function ids(): () => string {
  let value = 0;
  return () => `id-${++value}`;
}

function emailFactory(): EncryptedEmailOutboxFactory {
  return new EncryptedEmailOutboxFactory(
    new OutboxPayloadCipher({
      activeKeyId: 'test',
      keys: [{ id: 'test', key: Buffer.alloc(32, 0x71) }],
    }),
  );
}

const passwordCredentials: PasswordCredentialService = {
  async validateAndHash(password) {
    return { passwordHash: `phc:${password}`, policyVersion: 'v1' };
  },
  async verify() {
    return { valid: true, needsRehash: false };
  },
};

class FakeBootstrapRepository implements InitialAdminBootstrapRepository {
  state: InitialAdminBootstrapState = { state: 'uninitialized' };
  initialized:
    | Parameters<InitialAdminBootstrapRepository['initializeAtomically']>[0]
    | undefined;

  async inspect(): Promise<InitialAdminBootstrapState> {
    return this.state;
  }

  async initializeAtomically(
    input: Parameters<
      InitialAdminBootstrapRepository['initializeAtomically']
    >[0],
  ): Promise<'initialized'> {
    this.initialized = input;
    return 'initialized';
  }

  async correctPendingEmailAtomically(): Promise<'corrected'> {
    return 'corrected';
  }
}

function activeAdmin(): AccountSnapshot {
  return {
    id: 'admin-target',
    organizationId: 'org_tche_fertilidade',
    name: 'Admin',
    normalizedEmail: 'admin-old@example.test',
    profile: 'admin',
    status: 'ativo',
    version: 'v1',
  };
}

class FakeBreakGlassRepository implements AdminBreakGlassRepository {
  started:
    | Parameters<AdminBreakGlassRepository['startAtomically']>[0]
    | undefined;
  challenge:
    | {
        challengeId: string;
        recoveryId: string;
        organizationId: string;
        userId: string;
      }
    | null = null;
  restricted:
    | {
        authorizationId: string;
        recoveryId: string;
        organizationId: string;
        user: AccountSnapshot;
        currentNormalizedEmail: string;
        pendingNormalizedEmail: string;
        verifiedSecondaryEmail?: string;
      }
    | null = null;
  confirmed:
    | Parameters<AdminBreakGlassRepository['confirmEmailAtomically']>[0]
    | undefined;
  completed:
    | Parameters<AdminBreakGlassRepository['completeAtomically']>[0]
    | undefined;

  async findActiveAdminTarget() {
    return {
      account: activeAdmin(),
      verifiedSecondaryEmail: 'admin-secondary@example.test',
    };
  }

  async startAtomically(
    input: Parameters<AdminBreakGlassRepository['startAtomically']>[0],
  ): Promise<'created'> {
    this.started = input;
    return 'created';
  }

  async inspectUsableEmailChallenge() {
    return this.challenge;
  }

  async confirmEmailAtomically(
    input: Parameters<AdminBreakGlassRepository['confirmEmailAtomically']>[0],
  ): Promise<'confirmed'> {
    this.confirmed = input;
    return 'confirmed';
  }

  async inspectRestrictedAuthorization() {
    return this.restricted;
  }

  async completeAtomically(
    input: Parameters<AdminBreakGlassRepository['completeAtomically']>[0],
  ): Promise<'completed'> {
    this.completed = input;
    return 'completed';
  }
}

describe('initial Admin bootstrap CLI services', () => {
  it('creates one pending Admin invitation without returning its token', async () => {
    const repository = new FakeBootstrapRepository();
    const service = new InitialAdminBootstrapCliService({
      enabled: true,
      repository,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    const result = await service.run({
      organizationId: 'org_tche_fertilidade',
      name: 'Primeiro Admin',
      email: 'FIRST.ADMIN@EXAMPLE.TEST',
    });

    assert.deepEqual(Object.keys(result).sort(), [
      'adminUserId',
      'challengeId',
      'expiresAt',
    ]);
    assert.equal(repository.initialized?.admin.status, 'pendente');
    assert.equal(
      repository.initialized?.challenge.activationMode,
      'activate_bootstrap_admin',
    );
    assert.doesNotMatch(JSON.stringify(result), /token/i);
    assert.doesNotMatch(
      JSON.stringify(repository.initialized?.outbox.payload),
      /FIRST.ADMIN|token=/,
    );
  });

  it('never reopens a sealed bootstrap through the correction command', async () => {
    const repository = new FakeBootstrapRepository();
    repository.state = { state: 'sealed', adminUserId: 'admin-1' };
    const correction = new InitialAdminInvitationCorrectionCliService({
      enabled: true,
      repository,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
    });

    await assert.rejects(
      () =>
        correction.run({
          organizationId: 'org_tche_fertilidade',
          correctedEmail: 'corrected@example.test',
          reasonCode: 'bootstrap_email_typo',
        }),
      (error: unknown) =>
        error instanceof AccountActionError &&
        error.code === 'bootstrap_not_correctable',
    );
  });
});

describe('Admin break-glass CLI service', () => {
  it('requires two distinct externally verified approvers', async () => {
    const repository = new FakeBreakGlassRepository();
    const verifier: BreakGlassAuthorizationVerifier = {
      async verify(input) {
        return {
          authorizationId: 'platform-auth-1',
          policyVersion: 'break-glass-v1',
          organizationId: input.organizationId,
          targetUserId: input.targetUserId,
          pendingNormalizedEmail: input.pendingNormalizedEmail,
          externalCaseReference: input.externalCaseReference,
          approverIds: ['operator-one'],
          expiresAt: new Date('2026-08-19T13:00:00.000Z'),
        };
      },
    };
    const service = new AdminBreakGlassCliService({
      enabled: true,
      verifier,
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
    });

    await assert.rejects(
      () =>
        service.start({
          authorizationArtifact: 'opaque-platform-artifact',
          organizationId: 'org_tche_fertilidade',
          targetAdminUserId: 'admin-target',
          newEmail: 'admin-new@example.test',
          externalCaseReference: 'case-1',
        }),
      (error: unknown) =>
        error instanceof AccountActionError &&
        error.code === 'break_glass_authorization_invalid',
    );
    assert.equal(repository.started, undefined);
  });

  it('uses a separate ceremony and notifies primary and verified secondary contacts', async () => {
    const repository = new FakeBreakGlassRepository();
    const verifier: BreakGlassAuthorizationVerifier = {
      async verify(input) {
        return {
          authorizationId: 'platform-auth-2',
          policyVersion: 'break-glass-v1',
          organizationId: input.organizationId,
          targetUserId: input.targetUserId,
          pendingNormalizedEmail: input.pendingNormalizedEmail,
          externalCaseReference: input.externalCaseReference,
          approverIds: ['operator-two', 'operator-one'],
          expiresAt: new Date('2026-08-19T13:00:00.000Z'),
        };
      },
    };
    const service = new AdminBreakGlassCliService({
      enabled: true,
      verifier,
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    const result = await service.start({
      authorizationArtifact: 'opaque-platform-artifact',
      organizationId: 'org_tche_fertilidade',
      targetAdminUserId: 'admin-target',
      newEmail: 'ADMIN-NEW@EXAMPLE.TEST',
      externalCaseReference: 'case-2',
    });

    assert.equal(result.recoveryId, 'id-1');
    assert.equal(repository.started?.securityNotices.length, 2);
    assert.deepEqual(repository.started?.recovery.platformApproverIds, [
      'operator-one',
      'operator-two',
    ]);
    assert.equal(
      repository.started?.audit.metadata?.execution_channel,
      'cli_break_glass',
    );
    assert.doesNotMatch(
      JSON.stringify(repository.started),
      /opaque-platform-artifact/,
    );
  });

  it('continues an initiated flow by one-time tokens without the CLI enable flag', async () => {
    const repository = new FakeBreakGlassRepository();
    repository.challenge = {
      challengeId: 'challenge-break-glass',
      recoveryId: 'recovery-break-glass',
      organizationId: 'org_tche_fertilidade',
      userId: 'admin-target',
    };
    const continuation = new AdminBreakGlassContinuationService({
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      clock: () => now,
      idGenerator: ids(),
    });
    const emailToken = 'A'.repeat(43);
    const restricted = await continuation.confirmNewEmail({
      token: emailToken,
      requestId: 'req-break-glass-email',
    });

    assert.equal(repository.confirmed?.tokenSha256, hashActionToken(emailToken));
    assert.equal(
      repository.confirmed?.restrictedAuthorization.tokenSha256,
      hashActionToken(restricted.token),
    );
    assert.equal(
      repository.confirmed?.restrictedAuthorization.purpose,
      'admin_break_glass',
    );
    assert.equal(repository.confirmed?.audit.requestId, 'req-break-glass-email');
    assert.doesNotMatch(JSON.stringify(repository.confirmed), new RegExp(emailToken));

    repository.restricted = {
      authorizationId: repository.confirmed?.restrictedAuthorization.id ?? '',
      recoveryId: 'recovery-break-glass',
      organizationId: 'org_tche_fertilidade',
      user: activeAdmin(),
      currentNormalizedEmail: 'admin-old@example.test',
      pendingNormalizedEmail: 'admin-new@example.test',
      verifiedSecondaryEmail: 'admin-secondary@example.test',
    };
    const completed = await continuation.complete({
      token: restricted.token,
      newPassword: 'Senha break-glass 2',
      requestId: 'req-break-glass-complete',
    });

    assert.deepEqual(completed, {
      userId: 'admin-target',
      loginRequired: true,
    });
    assert.equal(repository.completed?.passwordPhc, 'phc:Senha break-glass 2');
    assert.equal(
      repository.completed?.restrictedTokenSha256,
      hashActionToken(restricted.token),
    );
    assert.equal(repository.completed?.securityNotices.length, 2);
    assert.equal(
      repository.completed?.audit.metadata?.execution_channel,
      'email_break_glass',
    );
    assert.doesNotMatch(
      JSON.stringify(repository.completed),
      new RegExp(restricted.token),
    );
  });
});
