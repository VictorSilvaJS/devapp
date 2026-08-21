import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import SwaggerParser from '@apidevtools/swagger-parser';
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
    assert.equal(typeof securityServices.propertyRoutes.service.list, 'function');

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
      const document = response.json<{
        components?: {
          securitySchemes?: Record<string, unknown>;
        };
        paths: Record<
          string,
          {
            get?: {
              security?: readonly Record<string, readonly string[]>[];
              responses?: Record<string, unknown>;
            };
            post?: {
              security?: readonly Record<string, readonly string[]>[];
              responses?: Record<
                string,
                {
                  content?: Record<
                    string,
                    {
                      schema?: {
                        properties?: Record<
                          string,
                          { properties?: Record<string, unknown> }
                        >;
                      };
                    }
                  >;
                }
              >;
            };
            delete?: {
              security?: readonly Record<string, readonly string[]>[];
            };
          }
        >;
      }>();
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
        '/v1/propriedades',
        '/v1/propriedades/{id}',
      ]) {
        assert.ok(document.paths[path], `missing composed route ${path}`);
      }
      assert.deepEqual(document.components?.securitySchemes?.bearerAuth, {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',
      });
      const bearerProtectedOperations = Object.entries(document.paths)
        .flatMap(([path, operations]) =>
          (['get', 'post', 'delete'] as const).flatMap((method) => {
            const operation = operations[method];
            if (operation?.security === undefined) return [];
            assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
            return [`${method.toUpperCase()} ${path}`];
          }),
        )
        .sort();
      assert.deepEqual(bearerProtectedOperations, [
        'DELETE /v1/auth/sessions/{sessionId}',
        'GET /v1/auth/me',
        'GET /v1/auth/sessions',
        'GET /v1/propriedades',
        'GET /v1/propriedades/{id}',
        'POST /v1/auth/assisted-recovery',
        'POST /v1/auth/email-change/request',
        'POST /v1/auth/invitations',
        'POST /v1/auth/logout',
        'POST /v1/auth/logout-all',
        'POST /v1/auth/password/change',
        'POST /v1/auth/secondary-email/request',
      ]);
      assert.deepEqual(document.paths['/v1/propriedades']?.get?.security, [
        { bearerAuth: [] },
      ]);
      assert.deepEqual(document.paths['/v1/propriedades/{id}']?.get?.security, [
        { bearerAuth: [] },
      ]);
      assert.ok(
        document.paths['/v1/propriedades']?.get?.responses?.['500'],
      );
      assert.ok(
        document.paths['/v1/propriedades/{id}']?.get?.responses?.['500'],
      );
      for (const path of [
        '/v1/auth/login',
        '/v1/auth/refresh',
        '/v1/auth/password/change',
      ]) {
        const responseSchema =
          document.paths[path]?.post?.responses?.['200']?.content?.[
            'application/json'
          ]?.schema;
        assert.ok(responseSchema?.properties?.emitido_em);
        assert.ok(responseSchema?.properties?.access_expira_em);
        assert.ok(
          responseSchema?.properties?.sessao?.properties?.expira_inatividade_em,
        );
        assert.ok(
          responseSchema?.properties?.sessao?.properties
            ?.expira_absolutamente_em,
        );
      }
      assert.equal(document.paths['/v1/auth/admin-break-glass'], undefined);
      await SwaggerParser.validate(JSON.parse(response.payload));
      assert.equal(databaseCalls, 0);
    } finally {
      await app.close();
    }
  });
});
