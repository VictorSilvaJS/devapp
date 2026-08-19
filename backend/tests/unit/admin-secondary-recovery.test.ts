import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AdminSecondaryRecoveryService,
  type AdminSecondaryRecoveryRepository,
  type AdminSecondaryRecoveryTarget,
} from '../../src/account-actions/admin-secondary-recovery-service.js';
import type { AccountSnapshot } from '../../src/account-actions/contracts.js';
import { loadAuthenticationRuntimeConfig } from '../../src/auth/config.js';
import type { LoginThrottle } from '../../src/auth/contracts.js';
import type { PasswordCredentialService } from '../../src/auth/password-credential.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';

const now = new Date('2026-08-19T12:00:00.000Z');
const abuseProtection = loadAuthenticationRuntimeConfig({ NODE_ENV: 'test' }).abuseProtection;
const allowingThrottle: LoginThrottle = {
  async checkIp() {
    return { allowed: true };
  },
  async checkIdentifier() {
    return { allowed: true };
  },
  async recordFailure() {},
  async recordSuccess() {},
};

function account(): AccountSnapshot {
  return {
    id: 'admin-1',
    organizationId: 'org_tche_fertilidade',
    name: 'Administrador',
    normalizedEmail: 'old-admin@example.test',
    profile: 'admin',
    status: 'ativo',
    version: 'account-v1',
  };
}

function target(): AdminSecondaryRecoveryTarget {
  return {
    account: account(),
    verifiedSecondaryEmail: 'secondary@example.test',
    secondaryEmailVersion: 'secondary-v1',
  };
}

function ids(): () => string {
  let current = 0;
  return () => `id-${++current}`;
}

const passwordCredentials: PasswordCredentialService = {
  async validateAndHash(password) {
    return { passwordHash: `phc:${password}`, policyVersion: 'policy-v1' };
  },
  async verify() {
    return { valid: true, needsRehash: false };
  },
};

class FakeRepository implements AdminSecondaryRecoveryRepository {
  public target: AdminSecondaryRecoveryTarget | null = target();
  public started:
    | Parameters<AdminSecondaryRecoveryRepository['startAtomically']>[0]
    | undefined;
  public secondaryConfirmed:
    | Parameters<
        AdminSecondaryRecoveryRepository['confirmSecondaryAtomically']
      >[0]
    | undefined;
  public newPrimaryConfirmed:
    | Parameters<
        AdminSecondaryRecoveryRepository['confirmNewPrimaryAtomically']
      >[0]
    | undefined;
  public completed:
    | Parameters<AdminSecondaryRecoveryRepository['completeAtomically']>[0]
    | undefined;

  async findActiveAdminByVerifiedSecondary(
    normalizedSecondaryEmail: string,
  ) {
    return this.target?.verifiedSecondaryEmail === normalizedSecondaryEmail
      ? this.target
      : null;
  }

  async startAtomically(
    input: Parameters<AdminSecondaryRecoveryRepository['startAtomically']>[0],
  ): Promise<'created'> {
    this.started = input;
    return 'created';
  }

  async inspectUsableSecondaryChallenge() {
    if (this.started === undefined) return null;
    return {
      challengeId: this.started.secondaryChallenge.id,
      recoveryId: this.started.recovery.id,
      target: this.started.expectedTarget,
      pendingNormalizedEmail: this.started.recovery.pendingNormalizedEmail,
    };
  }

  async confirmSecondaryAtomically(
    input: Parameters<
      AdminSecondaryRecoveryRepository['confirmSecondaryAtomically']
    >[0],
  ): Promise<'confirmed'> {
    this.secondaryConfirmed = input;
    return 'confirmed';
  }

  async inspectUsableNewPrimaryChallenge() {
    if (this.started === undefined || this.secondaryConfirmed === undefined) {
      return null;
    }
    return {
      challengeId: this.secondaryConfirmed.newPrimaryChallenge.id,
      recoveryId: this.started.recovery.id,
      target: this.started.expectedTarget,
      pendingNormalizedEmail: this.started.recovery.pendingNormalizedEmail,
    };
  }

  async confirmNewPrimaryAtomically(
    input: Parameters<
      AdminSecondaryRecoveryRepository['confirmNewPrimaryAtomically']
    >[0],
  ): Promise<'confirmed'> {
    this.newPrimaryConfirmed = input;
    return 'confirmed';
  }

  async inspectRestrictedAuthorization() {
    if (
      this.started === undefined ||
      this.newPrimaryConfirmed === undefined ||
      this.target === null
    ) {
      return null;
    }
    return {
      authorizationId:
        this.newPrimaryConfirmed.restrictedAuthorization.id,
      recoveryId: this.started.recovery.id,
      organizationId: this.target.account.organizationId,
      user: this.target.account,
      currentNormalizedEmail: this.target.account.normalizedEmail,
      verifiedSecondaryEmail: this.target.verifiedSecondaryEmail,
      pendingNormalizedEmail: this.started.recovery.pendingNormalizedEmail,
    };
  }

  async completeAtomically(
    input: Parameters<AdminSecondaryRecoveryRepository['completeAtomically']>[0],
  ): Promise<'completed'> {
    this.completed = input;
    return 'completed';
  }

  async cancelAtomically(): Promise<'cancelled'> {
    return 'cancelled';
  }
}

function fixture(repository: AdminSecondaryRecoveryRepository) {
  const cipher = new OutboxPayloadCipher({
    activeKeyId: 'test-key',
    keys: [{ id: 'test-key', key: Buffer.alloc(32, 0x35) }],
  });
  const service = new AdminSecondaryRecoveryService({
    repository,
    passwordCredentials,
    emailOutbox: new EncryptedEmailOutboxFactory(cipher),
    actionBaseUrl: 'https://app.example.test/account-action',
    throttle: allowingThrottle,
    abuseProtection,
    clock: () => now,
    idGenerator: ids(),
  });
  return { cipher, service };
}

function decrypt(
  cipher: OutboxPayloadCipher,
  message: NonNullable<FakeRepository['started']>['secondaryActionEmail'],
) {
  return cipher.decrypt(message.payload, {
    organizationId: message.organizationId,
    messageId: message.id,
    messageType: message.messageType,
  });
}

describe('Admin recovery through a verified secondary contact', () => {
  it('answers uniformly when the verified secondary address is unknown', async () => {
    const repository = new FakeRepository();
    repository.target = null;
    const { service } = fixture(repository);

    const result = await service.request({
      secondaryEmail: 'unknown@example.test',
      newPrimaryEmail: 'new@example.test',
      ipAddress: '192.0.2.20',
    });

    assert.deepEqual(result, { status: 'accepted' });
    assert.equal(repository.started, undefined);
  });

  it('proves the verified secondary first, then the new primary, before issuing a restricted grant', async () => {
    const repository = new FakeRepository();
    const { cipher, service } = fixture(repository);

    await service.request({
      secondaryEmail: 'SECONDARY@EXAMPLE.TEST',
      newPrimaryEmail: 'NEW-ADMIN@EXAMPLE.TEST',
      ipAddress: '192.0.2.21',
    });
    assert.ok(repository.started);
    assert.equal(
      repository.started.secondaryChallenge.purpose,
      'admin_secondary_recovery_secondary',
    );
    const secondaryMessage = decrypt(
      cipher,
      repository.started.secondaryActionEmail,
    );
    assert.equal(secondaryMessage.to, 'secondary@example.test');
    assert.match(String(secondaryMessage.text), /#action=confirm-admin-secondary-recovery&token=/);
    assert.equal(repository.secondaryConfirmed, undefined);

    await service.confirmSecondaryAddress({ token: 'secondary-proof' });
    const secondaryConfirmed = repository.secondaryConfirmed as
      | Parameters<
          AdminSecondaryRecoveryRepository['confirmSecondaryAtomically']
        >[0]
      | undefined;
    assert.ok(secondaryConfirmed);
    assert.equal(
      secondaryConfirmed.newPrimaryChallenge.purpose,
      'admin_secondary_recovery_new_primary',
    );
    const newPrimaryMessage = decrypt(
      cipher,
      secondaryConfirmed.newPrimaryActionEmail,
    );
    assert.equal(newPrimaryMessage.to, 'new-admin@example.test');

    const grant = await service.confirmNewPrimaryAddress({
      token: 'new-primary-proof',
    });
    assert.equal(grant.token.length, 43);
    assert.equal(
      repository.newPrimaryConfirmed?.restrictedAuthorization.purpose,
      'admin_secondary_recovery',
    );
    assert.deepEqual(
      repository.newPrimaryConfirmed?.restrictedAuthorization.allowedActions,
      ['set_new_password', 'cancel_recovery'],
    );

    const result = await service.complete({
      token: grant.token,
      newPassword: 'Uma nova senha segura',
    });
    assert.deepEqual(result, { userId: 'admin-1', loginRequired: true });
    assert.equal(repository.completed?.passwordPhc, 'phc:Uma nova senha segura');
    assert.equal(repository.completed?.securityNotices.length, 2);
    assert.doesNotMatch(JSON.stringify(repository.completed), new RegExp(grant.token));
  });
});
