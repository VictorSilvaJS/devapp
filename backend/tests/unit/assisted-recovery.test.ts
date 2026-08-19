import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { PasswordCredentialService } from '../../src/auth/password-credential.js';
import type { AccountSnapshot } from '../../src/account-actions/contracts.js';
import { AccountActionError } from '../../src/account-actions/errors.js';
import {
  AssistedRecoveryService,
  type AssistedRecoveryRepository,
} from '../../src/account-actions/assisted-recovery-service.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';

const now = new Date('2026-08-19T12:00:00.000Z');

function account(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    id: 'target-1',
    organizationId: 'org_tche_fertilidade',
    name: 'Conta alvo',
    normalizedEmail: 'old@example.test',
    profile: 'produtor',
    status: 'ativo',
    version: 'user-v1',
    ...overrides,
  };
}

function ids(): () => string {
  let value = 0;
  return () => `id-${++value}`;
}

const passwordCredentials: PasswordCredentialService = {
  async validateAndHash(password) {
    return { passwordHash: `argon2:${password}`, policyVersion: 'password-v1' };
  },
  async verify() {
    return { valid: true, needsRehash: false };
  },
};

function emailFactory(): EncryptedEmailOutboxFactory {
  return new EncryptedEmailOutboxFactory(
    new OutboxPayloadCipher({
      activeKeyId: 'test',
      keys: [{ id: 'test', key: Buffer.alloc(32, 0x61) }],
    }),
  );
}

class FakeRecoveryRepository implements AssistedRecoveryRepository {
  target: AccountSnapshot = account();
  started:
    | Parameters<AssistedRecoveryRepository['startForNonAdminAtomically']>[0]
    | undefined;
  confirmed:
    | Parameters<AssistedRecoveryRepository['confirmEmailAtomically']>[0]
    | undefined;
  completed:
    | Parameters<AssistedRecoveryRepository['completeAtomically']>[0]
    | undefined;

  async findRecoveryTarget(): Promise<AccountSnapshot | null> {
    return this.target;
  }

  async startForNonAdminAtomically(
    input: Parameters<
      AssistedRecoveryRepository['startForNonAdminAtomically']
    >[0],
  ): Promise<'created'> {
    this.started = input;
    return 'created';
  }

  async inspectUsableEmailChallenge() {
    return {
      challengeId: 'email-challenge-1',
      recoveryId: 'recovery-1',
      organizationId: this.target.organizationId,
      userId: this.target.id,
      expiresAt: new Date('2026-08-19T13:00:00.000Z'),
    };
  }

  async confirmEmailAtomically(
    input: Parameters<AssistedRecoveryRepository['confirmEmailAtomically']>[0],
  ): Promise<'confirmed'> {
    this.confirmed = input;
    return 'confirmed';
  }

  async inspectRestrictedAuthorization() {
    return {
      authorizationId: 'restricted-1',
      recoveryId: 'recovery-1',
      organizationId: this.target.organizationId,
      user: this.target,
      pendingNormalizedEmail: 'new@example.test',
      currentNormalizedEmail: this.target.normalizedEmail,
    };
  }

  async completeAtomically(
    input: Parameters<AssistedRecoveryRepository['completeAtomically']>[0],
  ): Promise<'completed'> {
    this.completed = input;
    return 'completed';
  }

  async cancelWithRestrictedAuthorizationAtomically(): Promise<'cancelled'> {
    return 'cancelled';
  }
}

describe('assisted recovery for Produtor/Colaborador', () => {
  it('blocks Admin targets at the HTTP-capable service boundary', async () => {
    const repository = new FakeRecoveryRepository();
    repository.target = account({ profile: 'admin' });
    const service = new AssistedRecoveryService({
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
    });

    await assert.rejects(
      () =>
        service.startByAdministrator({
          organizationId: repository.target.organizationId,
          actorAdminUserId: 'admin-actor',
          actorSessionId: 'admin-session',
          targetUserId: repository.target.id,
          newEmail: 'new@example.test',
          reasonCode: 'lost_email_access',
          externalCaseReference: 'case-admin-target',
        }),
      (error: unknown) =>
        error instanceof AccountActionError &&
        error.code === 'admin_assisted_recovery_forbidden',
    );
    assert.equal(repository.started, undefined);
  });

  it('records the accepted single-Admin risk and queues only encrypted secrets', async () => {
    const repository = new FakeRecoveryRepository();
    const service = new AssistedRecoveryService({
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    const result = await service.startByAdministrator({
      organizationId: repository.target.organizationId,
      actorAdminUserId: 'admin-actor',
      actorSessionId: 'admin-session',
      targetUserId: repository.target.id,
      newEmail: 'NEW@EXAMPLE.TEST',
      reasonCode: 'lost_email_access',
      externalCaseReference: 'case-123',
    });

    assert.equal(result.recoveryId, 'id-1');
    assert.equal(
      repository.started?.recovery.approvalMode,
      'single_admin_risk_accepted',
    );
    assert.equal(
      repository.started?.recovery.pendingNormalizedEmail,
      'new@example.test',
    );
    assert.doesNotMatch(JSON.stringify(repository.started?.outbox.payload), /token=/);
    assert.deepEqual(
      repository.started?.auditEvents.map((event) => event.eventType),
      [
        'auth.recuperacao_assistida.solicitada',
        'auth.recuperacao_assistida.aprovada',
      ],
    );
    assert.deepEqual(
      repository.started?.auditEvents.map((event) => event.actorSessionId),
      ['admin-session', 'admin-session'],
    );
  });

  it('uses a restricted one-time authorization and completes without a session', async () => {
    const repository = new FakeRecoveryRepository();
    const service = new AssistedRecoveryService({
      repository,
      passwordCredentials,
      emailOutbox: emailFactory(),
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    const confirmation = await service.confirmNewEmail({
      token: 'email-confirmation-secret',
    });
    assert.equal(
      repository.confirmed?.restrictedAuthorization.allowedActions[0],
      'set_new_password',
    );
    assert.doesNotMatch(
      JSON.stringify(repository.confirmed),
      /email-confirmation-secret/,
    );

    const completed = await service.complete({
      token: confirmation.token,
      newPassword: 'new-password-secret',
    });

    assert.deepEqual(completed, {
      userId: repository.target.id,
      loginRequired: true,
    });
    assert.equal(repository.completed?.passwordPhc, 'argon2:new-password-secret');
    assert.doesNotMatch(
      JSON.stringify(repository.completed),
      new RegExp(confirmation.token),
    );
    assert.equal(
      repository.completed?.audit.eventType,
      'auth.recuperacao_assistida.concluida',
    );
  });
});
