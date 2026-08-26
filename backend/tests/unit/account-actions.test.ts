import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { PasswordCredentialService } from '../../src/auth/password-credential.js';
import type { AccountSnapshot } from '../../src/account-actions/contracts.js';
import { AccountActionError } from '../../src/account-actions/errors.js';
import {
  InvitationService,
  type InvitationIssueRepository,
} from '../../src/account-actions/invitation-service.js';
import {
  PrimaryEmailChangeService,
  type PrimaryEmailChangeRepository,
  type PrimaryEmailPasswordVerifier,
} from '../../src/account-actions/primary-email-service.js';
import {
  SecondaryEmailService,
  type SecondaryEmailRepository,
} from '../../src/account-actions/secondary-email-service.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';

const now = new Date('2026-08-19T12:00:00.000Z');

const passwordCredentials: PasswordCredentialService = {
  async validateAndHash(password) {
    return { passwordHash: `phc:${password}`, policyVersion: 'policy-v1' };
  },
  async verify() {
    return { valid: true, needsRehash: false };
  },
};

function account(
  overrides: Partial<AccountSnapshot> = {},
): AccountSnapshot {
  return {
    id: 'user-1',
    organizationId: 'org_tche_fertilidade',
    name: 'Usuário',
    normalizedEmail: 'user@example.test',
    profile: 'produtor',
    status: 'pendente',
    version: 'v1',
    ...overrides,
  };
}

function ids(): () => string {
  let current = 0;
  return () => `generated-${++current}`;
}

function outboxFixture(): {
  cipher: OutboxPayloadCipher;
  factory: EncryptedEmailOutboxFactory;
} {
  const cipher = new OutboxPayloadCipher({
    activeKeyId: 'test-key',
    keys: [{ id: 'test-key', key: Buffer.alloc(32, 0x55) }],
  });
  return { cipher, factory: new EncryptedEmailOutboxFactory(cipher) };
}

describe('account invitation actions', () => {
  it('invites an existing pending user and keeps the token only in encrypted outbox', async () => {
    const recipient = account();
    const captured: {
      issued?: Parameters<
        InvitationIssueRepository['issueInvitationAtomically']
      >[0];
    } = {};
    const repository: InvitationIssueRepository = {
      async findPendingRecipient() {
        return recipient;
      },
      async issueInvitationAtomically(input) {
        captured.issued = input;
        return 'issued';
      },
      async inspectUsableInvitation() {
        return null;
      },
      async acceptInvitationAtomically() {
        return 'invalid';
      },
    };
    const { cipher, factory } = outboxFixture();
    const service = new InvitationService({
      repository,
      passwordCredentials,
      emailOutbox: factory,
      actionBaseUrl: 'https://app.example.test/account-action',
      clock: () => now,
      idGenerator: ids(),
    });

    const result = await service.issueForExistingPendingUser({
      organizationId: recipient.organizationId,
      actorAdminUserId: 'admin-1',
      actorSessionId: 'admin-session-1',
      userId: recipient.id,
    });

    assert.equal(result.challengeId, 'generated-1');
    assert.ok(captured.issued);
    assert.equal(captured.issued.challenge.activationMode, 'activate_user');
    assert.equal(captured.issued.challenge.tokenSha256.length, 64);
    assert.doesNotMatch(JSON.stringify(captured.issued.outbox.payload), /token=/);
    const decoded = cipher.decrypt(captured.issued.outbox.payload, {
      organizationId: recipient.organizationId,
      messageId: captured.issued.outbox.id,
      messageType: captured.issued.outbox.messageType,
    });
    assert.match(String(decoded.text), /#action=accept-invitation&token=/);
    assert.equal(captured.issued.audit.eventType, 'auth.convite.criado');
    assert.equal(captured.issued.audit.actorSessionId, 'admin-session-1');
  });

  it('accepts once, stores only the PHC and does not create a login session', async () => {
    const recipient = account();
    const captured: {
      completion?: Parameters<
        InvitationIssueRepository['acceptInvitationAtomically']
      >[0];
    } = {};
    const repository: InvitationIssueRepository = {
      async findPendingRecipient() {
        return recipient;
      },
      async issueInvitationAtomically() {
        return 'issued';
      },
      async inspectUsableInvitation() {
        return {
          challengeId: 'challenge-1',
          recipient,
          activationMode: 'activate_user',
        };
      },
      async acceptInvitationAtomically(input) {
        captured.completion = input;
        return 'accepted';
      },
    };
    const service = new InvitationService({
      repository,
      passwordCredentials,
      emailOutbox: outboxFixture().factory,
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    const result = await service.accept({
      token: 'one-time-invitation-token',
      password: 'secret-password',
    });

    assert.deepEqual(result, { userId: recipient.id, loginRequired: true });
    assert.ok(captured.completion);
    assert.equal(captured.completion.passwordPhc, 'phc:secret-password');
    assert.equal(captured.completion.passwordPolicyVersion, 'policy-v1');
    assert.doesNotMatch(
      JSON.stringify(captured.completion),
      /one-time-invitation-token/,
    );
  });
});

describe('verified secondary Admin email', () => {
  it('rejects non-Admin accounts at the domain boundary', async () => {
    const repository: SecondaryEmailRepository = {
      async findActiveAccount() {
        return account({ status: 'ativo', profile: 'produtor' });
      },
      async requestVerificationAtomically() {
        return 'created';
      },
      async confirmVerificationAtomically() {
        return { status: 'invalid' };
      },
    };
    const service = new SecondaryEmailService({
      repository,
      emailOutbox: outboxFixture().factory,
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
    });

    await assert.rejects(
      () =>
        service.requestVerification({
          organizationId: 'org_tche_fertilidade',
          authenticatedUserId: 'user-1',
          actorSessionId: 'user-session-1',
          newEmail: 'secondary@example.test',
        }),
      (error: unknown) =>
        error instanceof AccountActionError &&
        error.code === 'account_action_forbidden',
    );
  });

  it('persists a pending address until a one-time verification is consumed', async () => {
    const admin = account({ status: 'ativo', profile: 'admin' });
    let pendingEmail: string | undefined;
    const repository: SecondaryEmailRepository = {
      async findActiveAccount() {
        return admin;
      },
      async requestVerificationAtomically(input) {
        pendingEmail = input.pendingNormalizedEmail;
        return 'created';
      },
      async confirmVerificationAtomically() {
        return { status: 'confirmed', userId: admin.id };
      },
    };
    const service = new SecondaryEmailService({
      repository,
      emailOutbox: outboxFixture().factory,
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    await service.requestVerification({
      organizationId: admin.organizationId,
      authenticatedUserId: admin.id,
      actorSessionId: 'admin-session-1',
      newEmail: 'SECONDARY@EXAMPLE.TEST',
    });
    const confirmed = await service.confirm({ token: 'verification-token' });

    assert.equal(pendingEmail, 'secondary@example.test');
    assert.deepEqual(confirmed, { userId: admin.id, loginRequired: true });
  });
});

describe('primary email change', () => {
  it('keeps the address pending and requires current-password plus both address confirmations', async () => {
    const active = account({ status: 'ativo' });
    const captured: {
      request?: Parameters<
        PrimaryEmailChangeRepository['requestChangeAtomically']
      >[0];
      currentConfirmation?: Parameters<
        PrimaryEmailChangeRepository['confirmCurrentAddressAtomically']
      >[0];
      newConfirmation?: Parameters<
        PrimaryEmailChangeRepository['confirmNewAddressAtomically']
      >[0];
    } = {};
    const repository: PrimaryEmailChangeRepository = {
      async findActiveAccount() {
        return active;
      },
      async requestChangeAtomically(input) {
        captured.request = input;
        return 'created';
      },
      async inspectUsableCurrentAddressChallenge() {
        return {
          challengeId: 'email-change-current',
          account: active,
          pendingNormalizedEmail: 'new@example.test',
        };
      },
      async confirmCurrentAddressAtomically(input) {
        captured.currentConfirmation = input;
        return 'confirmed';
      },
      async inspectUsableNewAddressChallenge() {
        return {
          challengeId: 'email-change-new',
          account: active,
          pendingNormalizedEmail: 'new@example.test',
        };
      },
      async confirmNewAddressAtomically(input) {
        captured.newConfirmation = input;
        return 'confirmed';
      },
    };
    const passwordVerifier: PrimaryEmailPasswordVerifier = {
      async verifyCurrentPassword(input) {
        assert.equal(input.password, 'current-password');
        return { valid: true, credentialVersion: 'credential-v1' };
      },
    };
    const service = new PrimaryEmailChangeService({
      repository,
      passwordVerifier,
      emailOutbox: outboxFixture().factory,
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
      idGenerator: ids(),
    });

    await service.request({
      organizationId: active.organizationId,
      authenticatedUserId: active.id,
      authenticatedSessionId: 'session-1',
      currentPassword: 'current-password',
      newEmail: 'NEW@EXAMPLE.TEST',
    });
    assert.equal(captured.request?.pendingNormalizedEmail, 'new@example.test');
    assert.equal(captured.request?.expectedAccount.normalizedEmail, 'user@example.test');
    assert.equal(captured.request?.expectedCredentialVersion, 'credential-v1');
    assert.equal(captured.request?.audit.actorSessionId, 'session-1');

    const currentResult = await service.confirmCurrentAddress({
      token: 'current-address-secret',
    });
    assert.deepEqual(currentResult, { status: 'accepted' });
    assert.ok(captured.currentConfirmation);
    assert.equal(
      captured.currentConfirmation.newAddressChallenge.purpose,
      'primary_email_change_new',
    );

    const result = await service.confirmNewAddress({
      token: 'new-address-secret',
    });
    assert.deepEqual(result, { userId: active.id, loginRequired: true });
    assert.ok(captured.newConfirmation);
    assert.doesNotMatch(
      JSON.stringify(captured.newConfirmation),
      /new-address-secret/,
    );
  });

  it('rejects an invalid current password before creating a challenge', async () => {
    let writes = 0;
    const repository: PrimaryEmailChangeRepository = {
      async findActiveAccount() {
        return account({ status: 'ativo' });
      },
      async requestChangeAtomically() {
        writes += 1;
        return 'created';
      },
      async inspectUsableCurrentAddressChallenge() {
        return null;
      },
      async confirmCurrentAddressAtomically() {
        return 'invalid';
      },
      async inspectUsableNewAddressChallenge() {
        return null;
      },
      async confirmNewAddressAtomically() {
        return 'invalid';
      },
    };
    const service = new PrimaryEmailChangeService({
      repository,
      passwordVerifier: {
        async verifyCurrentPassword() {
          return { valid: false };
        },
      },
      emailOutbox: outboxFixture().factory,
      actionBaseUrl: 'https://app.example.test/action',
      clock: () => now,
    });

    await assert.rejects(
      () =>
        service.request({
          organizationId: 'org_tche_fertilidade',
          authenticatedUserId: 'user-1',
          authenticatedSessionId: 'session-1',
          currentPassword: 'wrong-password',
          newEmail: 'new@example.test',
        }),
      (error: unknown) =>
        error instanceof AccountActionError &&
        error.code === 'recent_authentication_required',
    );
    assert.equal(writes, 0);
  });
});
