import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  parseBootstrapAdminCommand,
  platformDatabaseEnvironment,
} from '../../src/cli/bootstrap-admin.js';
import {
  parseBreakGlassStartCommand,
  runBreakGlassStartCli,
} from '../../src/cli/break-glass-admin.js';

describe('initial Admin bootstrap CLI wiring', () => {
  it('parses only explicit initialization and correction inputs', () => {
    assert.deepEqual(
      parseBootstrapAdminCommand([
        'initialize',
        '--name',
        'Administrador Inicial',
        '--email',
        'admin@example.test',
      ]),
      {
        name: 'initialize',
        organizationId: 'org_tche_fertilidade',
        adminName: 'Administrador Inicial',
        email: 'admin@example.test',
      },
    );
    assert.deepEqual(
      parseBootstrapAdminCommand([
        'correct-email',
        '--organization-id',
        'org_tche_fertilidade',
        '--email',
        'correto@example.test',
      ]),
      {
        name: 'correct-email',
        organizationId: 'org_tche_fertilidade',
        email: 'correto@example.test',
      },
    );

    assert.throws(() => parseBootstrapAdminCommand(['initialize']));
    assert.throws(() =>
      parseBootstrapAdminCommand([
        'initialize',
        '--name',
        'Admin',
        '--email',
        'a@example.test',
        '--email',
        'b@example.test',
      ]),
    );
    assert.throws(() =>
      parseBootstrapAdminCommand([
        'correct-email',
        '--email',
        'a@example.test',
        '--password',
        'must-never-be-an-input',
      ]),
    );
  });

  it('requires the platform credential in production and never selects the runtime URL', () => {
    assert.throws(() =>
      platformDatabaseEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://runtime:secret@db/prod',
      }),
    );

    const selected = platformDatabaseEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://runtime:secret@db/prod',
      PLATFORM_DATABASE_URL: 'postgresql://platform:secret@db/prod',
      DATABASE_SSL_CA: 'runtime-ca',
      PLATFORM_DATABASE_SSL_CA: 'platform-ca',
    });
    assert.equal(
      selected.DATABASE_URL,
      'postgresql://platform:secret@db/prod',
    );
    assert.equal(selected.DATABASE_SSL_CA, 'platform-ca');
  });
});

describe('Admin break-glass CLI wiring', () => {
  it('accepts only start metadata and never accepts a password or token flag', () => {
    assert.deepEqual(
      parseBreakGlassStartCommand([
        'start',
        '--organization-id',
        'org_tche_fertilidade',
        '--target-admin-user-id',
        '00000000-0000-4000-8000-000000000001',
        '--new-email',
        'novo-admin@example.test',
        '--case-reference',
        'CASE-2026-001',
      ]),
      {
        organizationId: 'org_tche_fertilidade',
        targetAdminUserId: '00000000-0000-4000-8000-000000000001',
        newEmail: 'novo-admin@example.test',
        externalCaseReference: 'CASE-2026-001',
      },
    );
    assert.throws(() =>
      parseBreakGlassStartCommand([
        'start',
        '--organization-id',
        'org_tche_fertilidade',
        '--target-admin-user-id',
        '00000000-0000-4000-8000-000000000001',
        '--new-email',
        'novo-admin@example.test',
        '--case-reference',
        'CASE-2026-001',
        '--password',
        'must-never-be-accepted',
      ]),
    );
  });

  it('keeps start unavailable even when a caller attempts to enable the scaffold', async () => {
    const command = {
      organizationId: 'org_tche_fertilidade',
      targetAdminUserId: '00000000-0000-4000-8000-000000000001',
      newEmail: 'novo-admin@example.test',
      externalCaseReference: 'CASE-2026-001',
    };
    for (const environment of [
      { NODE_ENV: 'test' },
      { NODE_ENV: 'test', ADMIN_BREAK_GLASS_ENABLED: 'true' },
    ]) {
      await assert.rejects(
        () => runBreakGlassStartCli({ command, environment }),
        /intentionally unavailable/u,
      );
    }
  });
});
