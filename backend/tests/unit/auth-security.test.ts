import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  loadAuthenticationRuntimeConfig,
  type PasswordRuntimeConfig,
} from '../../src/auth/config.js';
import {
  countUnicodeCodePoints,
  foldPasswordForBlocklist,
  normalizeEmail,
  normalizePassword,
} from '../../src/auth/normalization.js';
import {
  PasswordBlocklistIntegrityError,
  loadPasswordBlocklist,
  type PasswordBlocklist,
} from '../../src/auth/password-blocklist.js';
import {
  Argon2idPasswordHasher,
  PasswordHashingCapacityError,
  type Argon2Adapter,
} from '../../src/auth/password-hasher.js';
import { PasswordPolicy, PasswordPolicyError } from '../../src/auth/password-policy.js';
import {
  hashOpaqueToken,
  hmacIdentifier,
  isWellFormedOpaqueToken,
  issueOpaqueToken,
} from '../../src/security/tokens.js';

const testPasswordConfig: PasswordRuntimeConfig = {
  policyVersion: 'test-v1',
  minimumLength: 8,
  maximumLength: 128,
  blocklistManifestPath: 'unused',
  argon2: {
    memoryCostKiB: 19_456,
    timeCost: 2,
    parallelism: 1,
    maximumConcurrency: 2,
  },
};

describe('authentication runtime configuration', () => {
  it('uses approved non-production defaults and never weakens security floors', () => {
    const config = loadAuthenticationRuntimeConfig({ NODE_ENV: 'test' });
    assert.equal(config.password.minimumLength, 8);
    assert.equal(config.password.maximumLength, 128);
    assert.equal(config.password.argon2.memoryCostKiB, 19_456);
    assert.equal(config.tokens.accessTtlSeconds, 900);
    assert.equal(config.tokens.refreshAbsoluteTtlSeconds, 2_592_000);
    assert.equal(config.tokens.refreshInactivityTtlSeconds, 1_209_600);
    assert.equal(config.abuseProtection.emailHmacKey.length >= 32, true);
    assert.equal(config.abuseProtection.ipHmacKey.length >= 32, true);
    assert.equal(
      config.abuseProtection.externalReferenceHmacKey.length >= 32,
      true,
    );
    assert.notDeepEqual(
      config.abuseProtection.emailHmacKey,
      config.abuseProtection.ipHmacKey,
    );
    assert.notDeepEqual(
      config.abuseProtection.emailHmacKey,
      config.abuseProtection.externalReferenceHmacKey,
    );
    assert.notDeepEqual(
      config.abuseProtection.ipHmacKey,
      config.abuseProtection.externalReferenceHmacKey,
    );
    assert.equal(config.assistedRecovery.enabled, false);

    for (const source of [
      { PASSWORD_MIN_LENGTH: '7' },
      { PASSWORD_MAX_LENGTH: '127' },
      { ARGON2_MEMORY_KIB: '19455' },
      { ARGON2_TIME_COST: '1' },
      { AUTH_ACCESS_TOKEN_TTL_SECONDS: '901' },
      { AUTH_SESSION_ABSOLUTE_TTL_SECONDS: '2592001' },
      { AUTH_SESSION_INACTIVITY_TTL_SECONDS: '1209601' },
      { ARGON2_MEMORY_KIB: '1048576', ARGON2_MAX_CONCURRENCY: '2' },
    ]) {
      assert.throws(() =>
        loadAuthenticationRuntimeConfig({ NODE_ENV: 'test', ...source }),
      );
    }
  });

  it('requires independent base64 secrets and a policy gate in production', () => {
    assert.throws(() =>
      loadAuthenticationRuntimeConfig({ NODE_ENV: 'production' }),
    );

    const common = {
      NODE_ENV: 'production',
      AUTH_EMAIL_HMAC_KEY: Buffer.alloc(32, 1).toString('base64'),
      AUTH_IP_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
      AUTH_EXTERNAL_REFERENCE_HMAC_KEY: Buffer.alloc(32, 3).toString('base64'),
      ASSISTED_RECOVERY_ENABLED: 'true',
    } as const;
    assert.throws(() => loadAuthenticationRuntimeConfig(common));
    assert.throws(() =>
      loadAuthenticationRuntimeConfig({
        ...common,
        AUTH_IP_HMAC_KEY: common.AUTH_EMAIL_HMAC_KEY,
        ASSISTED_RECOVERY_ENABLED: 'false',
      }),
    );

    const config = loadAuthenticationRuntimeConfig({
      ...common,
      ASSISTED_RECOVERY_POLICY_VERSION: 'operational-policy-v1',
    });
    assert.equal(config.assistedRecovery.enabled, true);
    assert.equal(config.assistedRecovery.policyVersion, 'operational-policy-v1');
  });
});

describe('normalization and password policy', () => {
  const blocked = new Set(['password1', foldPasswordForBlocklist('TCHÊ AGRO1')]);
  const blocklist: PasswordBlocklist = {
    size: blocked.size,
    has: (password) => blocked.has(foldPasswordForBlocklist(password)),
  };
  const policy = new PasswordPolicy(testPasswordConfig, blocklist);

  it('normalizes e-mail and password separately', () => {
    assert.equal(normalizeEmail('  Usuário@EXEMPLO.COM '), 'usuário@exemplo.com');
    assert.equal(normalizePassword('e\u0301 Pass1'), 'é Pass1');
    assert.equal(countUnicodeCodePoints('abcdef1🌱'), 8);
    assert.equal(normalizePassword(' Password1 '), ' Password1 ');
  });

  it('uses 8-128 Unicode code points and the explicit one-of-three rule', () => {
    assert.equal(policy.validate('abcdefgh1'), 'abcdefgh1');
    assert.equal(policy.validate('Abcdefgh'), 'Abcdefgh');
    assert.equal(policy.validate('abcdefgh!'), 'abcdefgh!');
    assert.equal(policy.validate('abcdef1🌱'), 'abcdef1🌱');

    assert.throws(() => policy.validate('abcdefgh '), PasswordPolicyError);
    assert.throws(() => policy.validate('Abcdefg'), PasswordPolicyError);
    assert.throws(() => policy.validate(`${'A'.repeat(128)}1`), PasswordPolicyError);
  });

  it('matches the entire blocklisted password without substring rules', () => {
    assert.throws(() => policy.validate('Password1'), PasswordPolicyError);
    assert.throws(() => policy.validate('tchê agro1'), PasswordPolicyError);
    assert.equal(policy.validate('minha Password1 segura'), 'minha Password1 segura');
  });
});

describe('password blocklist integrity', () => {
  it('verifies every UTF-8/LF artifact, checksum and entry count', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tche-blocklist-'));
    const artifact = Buffer.from('password1\nTchê Agro1\n', 'utf8');
    const artifactName = 'passwords.txt';
    const manifestPath = join(directory, 'passwords.manifest.json');
    await writeFile(join(directory, artifactName), artifact);
    await writeFile(
      manifestPath,
      JSON.stringify({
        schema_version: 1,
        normalization: 'utf8-lf',
        lookup_normalization: 'nfc-unicode-simple-lowercase-preserve-spaces',
        artifacts: [
          {
            file: artifactName,
            entry_count: 2,
            sha256: createHash('sha256').update(artifact).digest('hex'),
            source: 'fixture',
            source_url: 'https://example.invalid/source',
            source_version: 'v1',
            retrieved_at: '2026-08-19',
            license: 'test-only',
            license_url: 'https://example.invalid/license',
          },
        ],
      }),
    );

    const blocklist = await loadPasswordBlocklist(manifestPath);
    assert.equal(blocklist.size, 2);
    assert.equal(blocklist.has('PASSWORD1'), true);
    assert.equal(blocklist.has('prefix-password1'), false);

    await writeFile(join(directory, artifactName), 'tampered\n');
    await assert.rejects(
      loadPasswordBlocklist(manifestPath),
      PasswordBlocklistIntegrityError,
    );
  });
});

describe('Argon2id adapter and concurrency control', () => {
  it('normalizes before hashing, accepts only argon2id PHC and reports rehash', async () => {
    const hashedPasswords: string[] = [];
    const adapter: Argon2Adapter = {
      argon2id: 2,
      async hash(password) {
        hashedPasswords.push(password);
        return '$argon2id$v=19$m=19456,t=2,p=1$fixture$hash';
      },
      async verify(_passwordHash, password) {
        return password === 'éPassword1';
      },
      needsRehash() {
        return true;
      },
    };
    const hasher = new Argon2idPasswordHasher(testPasswordConfig.argon2, adapter);
    const phc = await hasher.hash('e\u0301Password1');
    assert.equal(hashedPasswords[0], 'éPassword1');
    assert.equal(phc.startsWith('$argon2id$'), true);
    assert.deepEqual(await hasher.verify('e\u0301Password1', phc), {
      valid: true,
      needsRehash: true,
    });
    assert.deepEqual(await hasher.verify('anything', '$argon2i$bad'), {
      valid: false,
      needsRehash: false,
    });
  });

  it('caps active and waiting Argon2 work and fails fast beyond both limits', async () => {
    let active = 0;
    let observedMaximum = 0;
    let releaseWork: (() => void) | undefined;
    let signalStarted: (() => void) | undefined;
    const workReleased = new Promise<void>((resolve) => {
      releaseWork = resolve;
    });
    const maximumStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const adapter: Argon2Adapter = {
      argon2id: 2,
      async hash() {
        active += 1;
        observedMaximum = Math.max(observedMaximum, active);
        if (active === 2) signalStarted?.();
        await workReleased;
        active -= 1;
        return '$argon2id$v=19$m=19456,t=2,p=1$fixture$hash';
      },
      async verify() {
        return true;
      },
      needsRehash() {
        return false;
      },
    };
    const hasher = new Argon2idPasswordHasher(testPasswordConfig.argon2, adapter);
    const activeWork = Array.from({ length: 2 }, () => hasher.hash('Password1'));
    await maximumStarted;
    const waitingWork = Array.from({ length: 2 }, () => hasher.hash('Password1'));
    await assert.rejects(
      hasher.hash('Password1'),
      PasswordHashingCapacityError,
    );
    releaseWork?.();
    await Promise.all([...activeWork, ...waitingWork]);
    assert.equal(observedMaximum, 2);
  });

  it('produces and verifies a real Argon2id PHC with the approved floor', async () => {
    const hasher = new Argon2idPasswordHasher({
      ...testPasswordConfig.argon2,
      maximumConcurrency: 1,
    });
    const phc = await hasher.hash('Senha Real Segura1');
    assert.match(phc, /^\$argon2id\$v=19\$/u);
    assert.equal(phc.includes('m=19456'), true);
    assert.equal(phc.includes('t=2'), true);
    assert.equal(phc.includes('p=1'), true);
    assert.deepEqual(await hasher.verify('Senha Real Segura1', phc), {
      valid: true,
      needsRehash: false,
    });
    assert.deepEqual(await hasher.verify('Senha Incorreta1', phc), {
      valid: false,
      needsRehash: false,
    });
  });
});

describe('opaque tokens and pseudonymous identifiers', () => {
  it('issues 256-bit values and persists only deterministic SHA-256 hashes', () => {
    const first = issueOpaqueToken();
    const second = issueOpaqueToken();
    assert.equal(isWellFormedOpaqueToken(first.value), true);
    assert.equal(Buffer.from(first.value, 'base64url').length, 32);
    assert.equal(first.hash, hashOpaqueToken(first.value));
    assert.notEqual(first.value, second.value);
    assert.notEqual(first.hash, second.hash);
    assert.equal(isWellFormedOpaqueToken(`${first.value}x`), false);
  });

  it('uses keyed HMAC for identifiers instead of reversible values', () => {
    const key = Uint8Array.from(Buffer.alloc(32, 7));
    const digest = hmacIdentifier('usuario@example.com', key);
    assert.notEqual(digest, 'usuario@example.com');
    assert.equal(digest, hmacIdentifier('usuario@example.com', key));
    assert.notEqual(digest, hmacIdentifier('outro@example.com', key));
  });
});
