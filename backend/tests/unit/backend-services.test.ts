import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import SwaggerParser from '@apidevtools/swagger-parser';
import type { Pool } from 'pg';

import { buildApp } from '../../src/app.js';
import { createBackendSecurityServices } from '../../src/backend-services.js';
import { loadRuntimeConfig } from '../../src/config.js';
import { ConfigurationError } from '../../src/config.js';

const OUTBOX_KEY = Buffer.alloc(32, 0x42).toString('base64');
const CURSOR_KEY = Buffer.alloc(32, 0x43).toString('base64');
const LINK_CURSOR_KEY = Buffer.alloc(32, 0x44).toString('base64');
const MUNICIPALITY_CURSOR_KEY = Buffer.alloc(32, 0x45).toString('base64');

function cursorEnvironment() {
  return {
    ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'test-admin-cursor-v1',
    ADMIN_USER_CURSOR_KEYS: JSON.stringify({
      'test-admin-cursor-v1': CURSOR_KEY,
    }),
    ADMIN_LINK_CURSOR_ACTIVE_KEY_ID: 'test-link-cursor-v1',
    ADMIN_LINK_CURSOR_KEYS: JSON.stringify({
      'test-link-cursor-v1': LINK_CURSOR_KEY,
    }),
    ADMIN_MUNICIPALITY_CURSOR_ACTIVE_KEY_ID: 'test-municipality-cursor-v1',
    ADMIN_MUNICIPALITY_CURSOR_KEYS: JSON.stringify({
      'test-municipality-cursor-v1': MUNICIPALITY_CURSOR_KEY,
    }),
  } as const;
}

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
      ...cursorEnvironment(),
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
    assert.equal(typeof securityServices.notificationRoutes.service.list, 'function');
    assert.equal(
      typeof securityServices.administrativeUserRoutes.service.create,
      'function',
    );
    assert.equal(typeof securityServices.mp35cRoutes.service.createProperty, 'function');

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
              parameters?: readonly {
                in?: string;
                name?: string;
                required?: boolean;
              }[];
              requestBody?: {
                content?: Record<
                  string,
                  {
                    schema?: {
                      required?: readonly string[];
                      properties?: Record<
                        string,
                        { enum?: readonly string[] }
                      >;
                    };
                  }
                >;
              };
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
            patch?: {
              security?: readonly Record<string, readonly string[]>[];
              parameters?: readonly {
                in?: string;
                name?: string;
                required?: boolean;
              }[];
              requestBody?: {
                content?: Record<
                  string,
                  { schema?: { required?: readonly string[] } }
                >;
              };
              responses?: Record<string, unknown>;
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
        '/v1/auth/invitations/accept',
        '/v1/auth/email-change/request',
        '/v1/auth/secondary-email/request',
        '/v1/auth/admin-secondary-recovery/request',
        '/v1/auth/admin-break-glass/confirm-email',
        '/v1/auth/admin-break-glass/complete',
        '/v1/auth/assisted-recovery',
        '/v1/propriedades',
        '/v1/propriedades/{id}',
        '/v1/propriedades/{id}/status',
        '/v1/localidades/ufs',
        '/v1/localidades/municipios',
        '/v1/usuarios',
        '/v1/usuarios/{id}',
        '/v1/usuarios/{id}/propriedades',
        '/v1/usuarios/{id}/status',
        '/v1/usuarios/{id}/convites',
        '/v1/notificacoes',
        '/v1/notificacoes/contador-nao-lidas',
        '/v1/notificacoes/{id}/leitura',
        '/v1/notificacoes/leituras',
        '/v1/notificacoes/{id}',
        '/v1/notificacoes/{id}/resolver-destino',
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
          (['get', 'post', 'patch', 'delete'] as const).flatMap((method) => {
            const operation = operations[method];
            if (operation?.security === undefined) return [];
            assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
            return [`${method.toUpperCase()} ${path}`];
          }),
        )
        .sort();
      assert.deepEqual(bearerProtectedOperations, [
        'DELETE /v1/auth/sessions/{sessionId}',
        'DELETE /v1/notificacoes/{id}',
        'GET /v1/auth/me',
        'GET /v1/auth/sessions',
        'GET /v1/localidades/municipios',
        'GET /v1/localidades/ufs',
        'GET /v1/notificacoes',
        'GET /v1/notificacoes/contador-nao-lidas',
        'GET /v1/propriedades',
        'GET /v1/propriedades/{id}',
        'GET /v1/usuarios',
        'GET /v1/usuarios/{id}',
        'GET /v1/usuarios/{id}/propriedades',
        'PATCH /v1/propriedades/{id}',
        'PATCH /v1/propriedades/{id}/status',
        'PATCH /v1/usuarios/{id}',
        'PATCH /v1/usuarios/{id}/propriedades',
        'PATCH /v1/usuarios/{id}/status',
        'POST /v1/auth/assisted-recovery',
        'POST /v1/auth/email-change/request',
        'POST /v1/auth/logout',
        'POST /v1/auth/logout-all',
        'POST /v1/auth/password/change',
        'POST /v1/auth/secondary-email/request',
        'POST /v1/notificacoes/leituras',
        'POST /v1/notificacoes/{id}/leitura',
        'POST /v1/notificacoes/{id}/resolver-destino',
        'POST /v1/propriedades',
        'POST /v1/usuarios',
        'POST /v1/usuarios/{id}/convites',
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
      assert.equal(document.paths['/v1/auth/invitations'], undefined);
      const invitationAcceptance =
        document.paths['/v1/auth/invitations/accept']?.post;
      assert.ok(invitationAcceptance?.responses?.['204']);
      assert.equal(invitationAcceptance?.security, undefined);

      const administrativeMutations = [
        document.paths['/v1/usuarios']?.post,
        document.paths['/v1/usuarios/{id}']?.patch,
        document.paths['/v1/usuarios/{id}/status']?.patch,
        document.paths['/v1/usuarios/{id}/convites']?.post,
      ];
      for (const operation of administrativeMutations) {
        assert.ok(operation);
        const idempotencyKey = operation.parameters?.find(
          (parameter) =>
            parameter.in === 'header'
            && parameter.name?.toLowerCase() === 'idempotency-key',
        );
        assert.equal(idempotencyKey?.required, true);
        for (const status of ['400', '401', '403', '404', '409', '422']) {
          assert.ok(operation.responses?.[status]);
        }
      }
      for (const operation of [
        document.paths['/v1/usuarios/{id}']?.patch,
        document.paths['/v1/usuarios/{id}/status']?.patch,
      ]) {
        const required = operation?.requestBody?.content?.['application/json']
          ?.schema?.required;
        assert.ok(required?.includes('versao'));
      }
      const invitationMode =
        document.paths['/v1/usuarios/{id}/convites']?.post
          ?.requestBody?.content?.['application/json']?.schema
          ?.properties?.modo_ativacao?.enum;
      assert.deepEqual(invitationMode, ['ativar_usuario']);

      const administrativeReads = [
        document.paths['/v1/usuarios']?.get,
        document.paths['/v1/usuarios/{id}']?.get,
      ];
      for (const operation of administrativeReads) {
        for (const status of ['400', '401', '403']) {
          assert.ok(operation?.responses?.[status]);
        }
      }
      assert.ok(document.paths['/v1/usuarios']?.get?.responses?.['422']);
      assert.ok(document.paths['/v1/usuarios/{id}']?.get?.responses?.['404']);
      await SwaggerParser.validate(JSON.parse(response.payload));
      assert.equal(databaseCalls, 0);
    } finally {
      await app.close();
    }
  });

  it('falha no startup sem keyring administrativo, com configuração inválida ou chave curta', async () => {
    const database = {
      connect() {
        throw new Error('composition must not connect');
      },
      query() {
        throw new Error('composition must not query');
      },
      async end() {},
    } as unknown as Pool;
    const base = {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://runtime:local@127.0.0.1:5432/tche_agro_test',
    } as const;
    const runtimeConfig = loadRuntimeConfig(base);

    for (const environment of [
      base,
      {
        ...base,
        ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'test-admin-cursor-v1',
        ADMIN_USER_CURSOR_KEYS: '{invalid-json',
      },
      {
        ...base,
        ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'test-admin-cursor-v1',
        ADMIN_USER_CURSOR_KEYS: JSON.stringify({
          'test-admin-cursor-v1': 'not-a-base64-key',
        }),
      },
      {
        ...base,
        ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'test-admin-cursor-v1',
        ADMIN_USER_CURSOR_KEYS: JSON.stringify({
          'test-admin-cursor-v1': Buffer.alloc(31, 0x43).toString('base64'),
        }),
      },
    ]) {
      await assert.rejects(
        createBackendSecurityServices({ database, runtimeConfig, environment }),
        ConfigurationError,
      );
    }
  });

  it('aceita keyring administrativo exclusivo e não aceita a chave da outbox como substituto', async () => {
    const database = {
      connect() {
        throw new Error('composition must not connect');
      },
      query() {
        throw new Error('composition must not query');
      },
      async end() {},
    } as unknown as Pool;
    const base = {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://runtime:local@127.0.0.1:5432/tche_agro_test',
      OUTBOX_ACTIVE_KEY_ID: 'test-outbox-v1',
      OUTBOX_ENCRYPTION_KEYS: JSON.stringify({ 'test-outbox-v1': OUTBOX_KEY }),
    } as const;
    const runtimeConfig = loadRuntimeConfig(base);

    await assert.rejects(
      createBackendSecurityServices({ database, runtimeConfig, environment: base }),
      ConfigurationError,
    );
    await assert.rejects(
      createBackendSecurityServices({
        database,
        runtimeConfig,
        environment: {
          ...base,
          ...cursorEnvironment(),
          ADMIN_USER_CURSOR_ACTIVE_KEY_ID: 'test-admin-cursor-v1',
          ADMIN_USER_CURSOR_KEYS: JSON.stringify({
            'test-admin-cursor-v1': OUTBOX_KEY,
          }),
        },
      }),
      ConfigurationError,
    );
    await assert.rejects(
      createBackendSecurityServices({
        database,
        runtimeConfig,
        environment: {
          ...base,
          ...cursorEnvironment(),
          OUTBOX_ENCRYPTION_KEYS: JSON.stringify({
            'test-outbox-v1': OUTBOX_KEY,
            'test-outbox-v2': OUTBOX_KEY,
          }),
        },
      }),
      ConfigurationError,
    );
    await assert.rejects(
      createBackendSecurityServices({
        database,
        runtimeConfig,
        environment: {
          ...base,
          ...cursorEnvironment(),
          ADMIN_LINK_CURSOR_KEYS: JSON.stringify({
            'test-link-cursor-v1': CURSOR_KEY,
          }),
        },
      }),
      ConfigurationError,
    );
    await assert.rejects(
      createBackendSecurityServices({
        database,
        runtimeConfig,
        environment: {
          ...base,
          ...cursorEnvironment(),
          ADMIN_USER_CURSOR_KEYS: JSON.stringify({
            'test-admin-cursor-v1': CURSOR_KEY,
            'test-admin-cursor-v2': CURSOR_KEY,
          }),
        },
      }),
      ConfigurationError,
    );
    await assert.doesNotReject(
      createBackendSecurityServices({
        database,
        runtimeConfig,
        environment: { ...base, ...cursorEnvironment() },
      }),
    );
  });
});
