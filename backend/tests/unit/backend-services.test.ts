import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { Pool } from 'pg';

import { buildApp } from '../../src/app.js';
import { createBackendSecurityServices } from '../../src/backend-services.js';
import { loadRuntimeConfig } from '../../src/config.js';

describe('MP-33B production composition', () => {
  it('loads security assets and publishes the complete route set without querying PostgreSQL', async () => {
    let databaseCalls = 0;
    const database = {
      connect() {
        databaseCalls += 1;
        throw new Error('composition must not connect');
      },
      query() {
        databaseCalls += 1;
        throw new Error('composition must not query');
      },
      async end() {},
    } as unknown as Pool;
    const environment = {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://runtime:local@127.0.0.1:5432/tche_agro_test',
    } as const;
    const runtimeConfig = loadRuntimeConfig(environment);
    const securityServices = await createBackendSecurityServices({
      database,
      runtimeConfig,
      environment,
    });

    assert.equal(databaseCalls, 0);
    assert.equal(typeof securityServices.authenticationService.login, 'function');
    assert.equal(
      typeof securityServices.accountActionRoutes.invitationService.accept,
      'function',
    );
    assert.equal(
      typeof securityServices.accountActionRoutes
        .adminBreakGlassContinuationService.confirmNewEmail,
      'function',
    );

    const app = await buildApp({
      config: runtimeConfig,
      database,
      logger: false,
      ...securityServices,
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/openapi.json',
      });
      const document = response.json<{ paths: Record<string, unknown> }>();
      assert.equal(response.statusCode, 200);
      for (const path of [
        '/v1/auth/login',
        '/v1/auth/refresh',
        '/v1/auth/me',
        '/v1/auth/invitations',
        '/v1/auth/email-change/request',
        '/v1/auth/secondary-email/request',
        '/v1/auth/admin-secondary-recovery/request',
        '/v1/auth/admin-break-glass/confirm-email',
        '/v1/auth/admin-break-glass/complete',
        '/v1/auth/assisted-recovery',
      ]) {
        assert.ok(document.paths[path], `missing composed route ${path}`);
      }
      assert.equal(document.paths['/v1/auth/admin-break-glass'], undefined);
      assert.equal(databaseCalls, 0);
    } finally {
      await app.close();
    }
  });
});
