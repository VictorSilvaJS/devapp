import { strict as assert } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import { AdministrativeUserCursorCodec } from '../../src/administration/user-cursor.js';
import { PostgresAdministrativeUserRepository } from '../../src/administration/postgres-user-repository.js';
import { DefaultAdministrativeUserService } from '../../src/administration/user-service.js';
import { DefaultMp35cService } from '../../src/administration/mp35c-service.js';
import { PostgresMp35cRepository } from '../../src/administration/postgres-mp35c-repository.js';
import { SecureAdministrativeCursorCodec } from '../../src/administration/secure-cursor.js';
import { buildApp } from '../../src/app.js';
import { loadAuthenticationRuntimeConfig } from '../../src/auth/config.js';
import type { AuthenticationPasswordCredentialService } from '../../src/auth/password-credential.js';
import { PostgresAuthRepository } from '../../src/auth/postgres-auth-repository.js';
import { PostgresLoginThrottle } from '../../src/auth/postgres-login-throttle.js';
import { DefaultAuthenticationService } from '../../src/auth/service.js';
import type { UserProfile } from '../../src/auth/contracts.js';
import type { RuntimeConfig } from '../../src/config.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade' as const;
const ACTION_URL = 'https://example.test/auth/action';

function phcFor(password: string): string {
  return `$argon2id$v=19$m=19456,p=1,t=2$c2FsdC1maXh0dXJl$${Buffer.from(
    password.normalize('NFC'),
  ).toString('base64url')}`;
}

class FixturePasswordCredentials
  implements AuthenticationPasswordCredentialService
{
  public async validateAndHash(password: string) {
    return { passwordHash: phcFor(password), policyVersion: 'e2e-v1' };
  }

  public async verify(password: string, passwordHash: string) {
    return { valid: passwordHash === phcFor(password), needsRehash: false };
  }

  public async rehash(password: string) {
    return this.validateAndHash(password);
  }
}

describe('administração HTTP de Usuários E2E', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let ownerPool: Pool | undefined;
  let runtimePool: Pool | undefined;
  let runtimeLoginRole: string | undefined;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let requestSequence = 0;
  let activeTargetUserId: string | undefined;
  let mp35cHolderId: string | undefined;
  let mp35cUpdatePropertyId: string | undefined;
  let mp35cStatusPropertyId: string | undefined;
  let mp35cLinkPropertyId: string | undefined;
  let mp35cLinkUserId: string | undefined;
  const tokens = new Map<'admin' | 'colaborador' | 'produtor' | 'stale_admin', string>();

  const authenticationConfig = loadAuthenticationRuntimeConfig({
    NODE_ENV: 'test',
  });
  const emailOutbox = new EncryptedEmailOutboxFactory(
    new OutboxPayloadCipher({
      activeKeyId: 'mp35b-e2e-key',
      keys: [{ id: 'mp35b-e2e-key', key: Buffer.alloc(32, 0x35) }],
    }),
  );

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    testDatabase = await startPostgisTestDatabase();
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({ command: 'up', database: testDatabase.database });
    ownerPool = new Pool(buildPostgresPoolConfig(testDatabase.database));

    runtimeLoginRole =
      `tche_test_runtime_http_mp35b_${randomUUID().replaceAll('-', '')}`;
    const runtimePassword = randomBytes(24).toString('hex');
    await ownerPool.query(
      `CREATE ROLE ${runtimeLoginRole} LOGIN PASSWORD '${runtimePassword}'`,
    );
    await ownerPool.query(`GRANT tche_agro_runtime TO ${runtimeLoginRole}`);
    const runtimeUrl = new URL(testDatabase.connectionString);
    runtimeUrl.username = runtimeLoginRole;
    runtimeUrl.password = runtimePassword;
    runtimePool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeUrl.toString(),
      application_name: runtimeLoginRole,
    });

    const seedAuthenticatedUser = async (input: {
      profile: UserProfile;
      label: 'admin' | 'colaborador' | 'produtor' | 'stale_admin';
      stale?: boolean;
    }) => {
      assert.ok(ownerPool);
      const userId = randomUUID();
      const sessionId = randomUUID();
      const token = issueOpaqueToken();
      const now = new Date();
      await ownerPool.query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, $3, $4, $5, 'ativo')
        `,
        [
          userId,
          ORGANIZATION_ID,
          `E2E ${input.label}`,
          `e2e-${input.label}-${userId}@example.test`,
          input.profile,
        ],
      );
      await ownerPool.query(
        `
          INSERT INTO public.sessoes_autenticacao (
            id, organizacao_id, usuario_id, versao_autorizacao,
            criada_em, ultima_renovacao_em,
            expira_inatividade_em, expira_absolutamente_em,
            status, revogada_em, motivo_revogacao
          ) VALUES (
            $1, $2, $3, 1, $4, $4, $5, $6,
            $7, $8, $9
          )
        `,
        [
          sessionId,
          ORGANIZATION_ID,
          userId,
          now,
          new Date(now.getTime() + 60 * 60_000),
          new Date(now.getTime() + 24 * 60 * 60_000),
          input.stale === true ? 'revogada' : 'ativa',
          input.stale === true ? now : null,
          input.stale === true ? 'e2e_stale_session' : null,
        ],
      );
      await ownerPool.query(
        `
          INSERT INTO public.tokens_acesso (
            organizacao_id, sessao_id, token_hash,
            versao_autorizacao, expira_em
          ) VALUES ($1, $2, $3, 1, $4)
        `,
        [
          ORGANIZATION_ID,
          sessionId,
          Buffer.from(token.hash, 'base64url'),
          new Date(now.getTime() + 15 * 60_000),
        ],
      );
      tokens.set(input.label, token.value);
      return userId;
    };

    await seedAuthenticatedUser({ profile: 'admin', label: 'admin' });
    await seedAuthenticatedUser({ profile: 'colaborador', label: 'colaborador' });
    await seedAuthenticatedUser({ profile: 'produtor', label: 'produtor' });
    await seedAuthenticatedUser({
      profile: 'admin',
      label: 'stale_admin',
      stale: true,
    });
    activeTargetUserId = randomUUID();
    const mp35cHolderUserId = randomUUID();
    mp35cHolderId = randomUUID();
    mp35cUpdatePropertyId = randomUUID();
    mp35cStatusPropertyId = randomUUID();
    mp35cLinkPropertyId = randomUUID();
    mp35cLinkUserId = randomUUID();
    await ownerPool.query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES
          ($1, $2, 'Alvo ativo E2E', $3, 'colaborador', 'ativo'),
          ($4, $2, 'Titular MP35C E2E', $5, 'produtor', 'ativo'),
          ($6, $2, 'Vínculo MP35C E2E', $7, 'colaborador', 'ativo')
      `,
      [
        activeTargetUserId,
        ORGANIZATION_ID,
        `e2e-target-${activeTargetUserId}@example.test`,
        mp35cHolderUserId,
        `e2e-holder-${mp35cHolderUserId}@example.test`,
        mp35cLinkUserId,
        `e2e-link-${mp35cLinkUserId}@example.test`,
      ],
    );
    await ownerPool.query(
      `INSERT INTO public.produtores
        (id, organizacao_id, usuario_id, nome, status)
       VALUES ($1, $2, $3, 'Titular MP35C E2E', 'ativo')`,
      [mp35cHolderId, ORGANIZATION_ID, mp35cHolderUserId],
    );
    await ownerPool.query(
      `INSERT INTO public.propriedades
        (id, organizacao_id, titular_id, nome, localidades_versao_id,
         municipio_id, municipio_nome, uf_id, uf_sigla, status)
       VALUES
        ($1,$4,$5,'Atualizável MP35C E2E','ibge-localidades-2026-08-25',
         '4305108','Caxias do Sul','43','RS','inativa'),
        ($2,$4,$5,'Status MP35C E2E','ibge-localidades-2026-08-25',
         '4305108','Caxias do Sul','43','RS','inativa'),
        ($3,$4,$5,'Vínculo MP35C E2E','ibge-localidades-2026-08-25',
         '4305108','Caxias do Sul','43','RS','ativa')`,
      [mp35cUpdatePropertyId, mp35cStatusPropertyId, mp35cLinkPropertyId,
        ORGANIZATION_ID, mp35cHolderId],
    );

    assert.ok(runtimePool);
    const authRepository = new PostgresAuthRepository({
      pool: runtimePool,
      emailHmacKey: authenticationConfig.abuseProtection.emailHmacKey,
      recoveryOutboxFactory: emailOutbox,
      recoveryActionBaseUrl: ACTION_URL,
    });
    const authenticationService = new DefaultAuthenticationService({
      config: authenticationConfig,
      repository: authRepository,
      throttle: new PostgresLoginThrottle({ pool: runtimePool }),
      credentials: new FixturePasswordCredentials(),
      dummyPasswordHash: phcFor('SenhaDummy1'),
    });
    const administrativeService = new DefaultAdministrativeUserService({
      authentication: authenticationService,
      cursorCodec: new AdministrativeUserCursorCodec({
        activeKeyId: 'mp35b-e2e-key',
        keys: [{ id: 'mp35b-e2e-key', key: Buffer.alloc(32, 0x35) }],
      }),
      repository: new PostgresAdministrativeUserRepository({
        pool: runtimePool,
        emailHmacKey: authenticationConfig.abuseProtection.emailHmacKey,
        externalReferenceHmacKey:
          authenticationConfig.abuseProtection.externalReferenceHmacKey,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      }),
    });
    const cursorConfig = {
      activeKeyId: 'mp35c-e2e-key',
      keys: { 'mp35c-e2e-key': Buffer.alloc(32, 0x63).toString('base64') },
    } as const;
    const mp35cService = new DefaultMp35cService({
      authentication: authenticationService,
      repository: new PostgresMp35cRepository(runtimePool),
      linkCursor: new SecureAdministrativeCursorCodec({
        namespace: 'administrative-links', config: cursorConfig,
      }),
      municipalityCursor: new SecureAdministrativeCursorCodec({
        namespace: 'administrative-municipalities',
        config: { activeKeyId: 'mp35c-locality-e2e-key', keys: {
          'mp35c-locality-e2e-key': Buffer.alloc(32, 0x64).toString('base64'),
        } },
      }),
    });
    const runtimeConfig: RuntimeConfig = {
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3_000,
      logLevel: 'silent',
      readinessTimeoutMs: 2_000,
      database: testDatabase.database,
    };
    app = await buildApp({
      config: runtimeConfig,
      database: runtimePool,
      logger: false,
      requestIdFactory: () => {
        requestSequence += 1;
        return `req_mp35b_e2e_${requestSequence}`;
      },
      authenticationService,
      administrativeUserRoutes: { service: administrativeService },
      mp35cRoutes: { service: mp35cService },
    });
  });

  after(async () => {
    await app?.close();
    await runtimePool?.end();
    if (ownerPool !== undefined && runtimeLoginRole !== undefined) {
      await ownerPool.query(`DROP ROLE IF EXISTS ${runtimeLoginRole}`);
    }
    await ownerPool?.end();
    await testDatabase?.container.stop();
  });

  function requireApp() {
    assert.ok(app);
    return app;
  }

  function bearer(label: 'admin' | 'colaborador' | 'produtor' | 'stale_admin') {
    const token = tokens.get(label);
    assert.ok(token);
    return { authorization: `Bearer ${token}` };
  }

  test('executa as seis rotas via bearer, autenticação, serviço e runtime PostgreSQL', async () => {
    const targetApp = requireApp();
    const list = await targetApp.inject({
      method: 'GET',
      url: '/v1/usuarios?limite=1',
      headers: bearer('admin'),
    });
    assert.equal(list.statusCode, 200);
    const firstPage = list.json<{
      itens: readonly { id: string; nome: string }[];
      paginacao: { proximo_cursor: string | null };
    }>();
    assert.equal(firstPage.itens.length, 1);
    assert.ok(firstPage.paginacao.proximo_cursor);
    assert.equal(
      firstPage.paginacao.proximo_cursor.includes(firstPage.itens[0]?.id ?? ''),
      false,
    );
    assert.equal(
      firstPage.paginacao.proximo_cursor.includes(firstPage.itens[0]?.nome ?? ''),
      false,
    );
    const secondPage = await targetApp.inject({
      method: 'GET',
      url: `/v1/usuarios?limite=1&cursor=${encodeURIComponent(firstPage.paginacao.proximo_cursor)}`,
      headers: bearer('admin'),
    });
    assert.equal(secondPage.statusCode, 200);
    assert.notEqual(secondPage.json().itens[0]?.id, firstPage.itens[0]?.id);

    const createProfile = async (
      profile: 'admin' | 'colaborador' | 'produtor',
      idempotencyKey: string,
    ) => {
      const payload = {
        nome: `Usuário HTTP ${profile}`,
        email: `http-${profile}-${randomUUID()}@example.test`,
        perfil: profile,
      } as const;
      const response = await targetApp.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          ...bearer('admin'),
          'idempotency-key': idempotencyKey,
        },
        payload,
      });
      assert.equal(response.statusCode, 201);
      const receipt = response.json<{
        resultado: string;
        recurso_tipo: string;
        recurso_id: string;
        versao: number;
      }>();
      assert.deepEqual(
        {
          resultado: receipt.resultado,
          tipo: receipt.recurso_tipo,
          versao: receipt.versao,
        },
        { resultado: 'criado', tipo: 'usuario', versao: 1 },
      );
      assert.equal(response.payload.includes(payload.email), false);
      return { payload, receipt };
    };
    const createdAdmin = await createProfile('admin', 'mp35b-e2e-create-admin');
    const createdProducer = await createProfile(
      'produtor',
      'mp35b-e2e-create-producer',
    );
    const createdCollaborator = await createProfile(
      'colaborador',
      'mp35b-e2e-create',
    );
    const createPayload = createdCollaborator.payload;
    const createdReceipt = createdCollaborator.receipt;
    const createdState = await ownerPool?.query<{
      user_id: string;
      profile: string;
      user_status: string;
      producer_status: string | null;
    }>(
      `
        SELECT usuario.id AS user_id, usuario.perfil AS profile,
               usuario.status AS user_status, produtor.status AS producer_status
        FROM public.usuarios AS usuario
        LEFT JOIN public.produtores AS produtor ON produtor.usuario_id = usuario.id
        WHERE usuario.id = ANY($1::uuid[])
        ORDER BY usuario.perfil
      `,
      [[
        createdAdmin.receipt.recurso_id,
        createdCollaborator.receipt.recurso_id,
        createdProducer.receipt.recurso_id,
      ]],
    );
    assert.deepEqual(createdState?.rows, [
      {
        user_id: createdAdmin.receipt.recurso_id,
        profile: 'admin',
        user_status: 'pendente',
        producer_status: null,
      },
      {
        user_id: createdCollaborator.receipt.recurso_id,
        profile: 'colaborador',
        user_status: 'pendente',
        producer_status: null,
      },
      {
        user_id: createdProducer.receipt.recurso_id,
        profile: 'produtor',
        user_status: 'pendente',
        producer_status: 'inativo',
      },
    ]);
    assert.deepEqual(
      {
        resultado: createdReceipt.resultado,
        tipo: createdReceipt.recurso_tipo,
        versao: createdReceipt.versao,
      },
      { resultado: 'criado', tipo: 'usuario', versao: 1 },
    );
    const createdUserId = createdReceipt.recurso_id;

    const detail = await targetApp.inject({
      method: 'GET',
      url: `/v1/usuarios/${createdUserId}`,
      headers: bearer('admin'),
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().nome, createPayload.nome);
    assert.equal(detail.json().versao, 1);

    const updated = await targetApp.inject({
      method: 'PATCH',
      url: `/v1/usuarios/${createdUserId}`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-update',
      },
      payload: { versao: 1, telefone: '(55) 99999-1010' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().versao, 2);

    const invitation = await targetApp.inject({
      method: 'POST',
      url: `/v1/usuarios/${createdUserId}/convites`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-invitation',
      },
      payload: { modo_ativacao: 'ativar_usuario' },
    });
    assert.equal(invitation.statusCode, 201);
    assert.equal(invitation.json().recurso_tipo, 'convite');

    assert.ok(activeTargetUserId);
    const changedStatus = await targetApp.inject({
      method: 'PATCH',
      url: `/v1/usuarios/${activeTargetUserId}/status`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-status',
      },
      payload: {
        versao: 1,
        status: 'inativo',
        motivo: 'outro',
        motivo_detalhe: 'Encerramento validado no cenário E2E',
      },
    });
    assert.equal(changedStatus.statusCode, 200);
    assert.equal(changedStatus.json().versao, 2);

    const versionConflict = await targetApp.inject({
      method: 'PATCH',
      url: `/v1/usuarios/${createdUserId}`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-version-conflict',
      },
      payload: { versao: 1, nome: 'Versão obsoleta' },
    });
    assert.equal(versionConflict.statusCode, 409);
    assert.equal(versionConflict.json().error.code, 'version_conflict');

    const idempotencyConflict = await targetApp.inject({
      method: 'POST',
      url: '/v1/usuarios',
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-create',
      },
      payload: { ...createPayload, nome: 'Payload divergente' },
    });
    assert.equal(idempotencyConflict.statusCode, 409);
    assert.equal(idempotencyConflict.json().error.code, 'idempotency_conflict');

    const duplicateEmail = await targetApp.inject({
      method: 'POST',
      url: '/v1/usuarios',
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-duplicate-email',
      },
      payload: { ...createPayload, nome: 'E-mail já cadastrado' },
    });
    assert.equal(duplicateEmail.statusCode, 409);
    assert.equal(duplicateEmail.json().error.code, 'business_rule_conflict');
  });

  test('aplica a matriz RBAC e os envelopes HTTP exatos sem vazar existência', async () => {
    const targetApp = requireApp();
    for (const headers of [undefined, bearer('stale_admin')]) {
      const response = await targetApp.inject({
        method: 'GET',
        url: '/v1/usuarios',
        ...(headers === undefined ? {} : { headers }),
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, 'invalid_session');
      assert.equal(response.headers['www-authenticate'], 'Bearer');
    }
    for (const profile of ['colaborador', 'produtor'] as const) {
      const response = await targetApp.inject({
        method: 'GET',
        url: '/v1/usuarios',
        headers: bearer(profile),
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, 'forbidden');
    }

    const absent = await targetApp.inject({
      method: 'GET',
      url: `/v1/usuarios/${randomUUID()}`,
      headers: bearer('admin'),
    });
    assert.equal(absent.statusCode, 404);
    assert.equal(absent.json().error.code, 'not_found');

    const invalidLimit = await targetApp.inject({
      method: 'GET',
      url: '/v1/usuarios?limite=101',
      headers: bearer('admin'),
    });
    assert.equal(invalidLimit.statusCode, 422);
    assert.equal(invalidLimit.json().error.code, 'validation_error');

    const invalidEnum = await targetApp.inject({
      method: 'POST',
      url: `/v1/usuarios/${randomUUID()}/convites`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-invalid-enum',
      },
      payload: { modo_ativacao: 'manter_status' },
    });
    assert.equal(invalidEnum.statusCode, 422);
    assert.equal(invalidEnum.json().error.code, 'validation_error');

    const malformed = await targetApp.inject({
      method: 'POST',
      url: '/v1/usuarios',
      headers: {
        ...bearer('admin'),
        'content-type': 'application/json',
        'idempotency-key': 'mp35b-e2e-malformed-json',
      },
      payload: '{"nome":"não ecoar",',
    });
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, 'invalid_request');
    assert.equal(malformed.payload.includes('não ecoar'), false);

    const adminList = await targetApp.inject({
      method: 'GET',
      url: '/v1/usuarios?limite=100',
      headers: bearer('admin'),
    });
    const adminId = adminList.json().itens.find(
      (item: { perfil: string; nome: string }) =>
        item.perfil === 'admin' && item.nome === 'E2E admin',
    )?.id;
    assert.ok(adminId);
    const selfDeactivation = await targetApp.inject({
      method: 'PATCH',
      url: `/v1/usuarios/${adminId}/status`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-e2e-self-deactivation',
      },
      payload: {
        versao: 1,
        status: 'inativo',
        motivo: 'correcao_administrativa',
      },
    });
    assert.equal(selfDeactivation.statusCode, 409);
    assert.equal(selfDeactivation.json().error.code, 'business_rule_conflict');
  });

  test('matriz E2E negativa cobre as seis rotas com Admin, ausência, stale, Produtor e Colaborador', async () => {
    const targetApp = requireApp();
    assert.ok(ownerPool);
    const pendingUserId = randomUUID();
    const activeUserId = randomUUID();
    await ownerPool.query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES
          ($1, $3, 'Alvo pendente da matriz E2E', $4, 'colaborador', 'pendente'),
          ($2, $3, 'Alvo ativo da matriz E2E', $5, 'colaborador', 'ativo')
      `,
      [
        pendingUserId,
        activeUserId,
        ORGANIZATION_ID,
        `matrix-pending-${pendingUserId}@example.test`,
        `matrix-active-${activeUserId}@example.test`,
      ],
    );

    type Actor = 'admin' | 'anonymous' | 'stale_admin' | 'produtor' | 'colaborador';
    const actors: readonly Readonly<{
      actor: Actor;
      statusCode: number;
      errorCode?: 'invalid_session' | 'forbidden';
    }>[] = [
      { actor: 'admin', statusCode: 200 },
      { actor: 'anonymous', statusCode: 401, errorCode: 'invalid_session' },
      { actor: 'stale_admin', statusCode: 401, errorCode: 'invalid_session' },
      { actor: 'produtor', statusCode: 403, errorCode: 'forbidden' },
      { actor: 'colaborador', statusCode: 403, errorCode: 'forbidden' },
    ];
    const routes = [
      {
        name: 'GET /v1/usuarios',
        method: 'GET' as const,
        url: '/v1/usuarios?limite=2',
        adminStatus: 200,
      },
      {
        name: 'GET /v1/usuarios/:id',
        method: 'GET' as const,
        url: `/v1/usuarios/${pendingUserId}`,
        adminStatus: 200,
      },
      {
        name: 'POST /v1/usuarios',
        method: 'POST' as const,
        url: '/v1/usuarios',
        adminStatus: 201,
        payload: {
          nome: 'Criado pela matriz E2E',
          email: `matrix-create-${randomUUID()}@example.test`,
          perfil: 'colaborador',
        },
      },
      {
        name: 'PATCH /v1/usuarios/:id',
        method: 'PATCH' as const,
        url: `/v1/usuarios/${pendingUserId}`,
        adminStatus: 200,
        payload: { versao: 1, nome: 'Alvo pendente atualizado pela matriz' },
      },
      {
        name: 'PATCH /v1/usuarios/:id/status',
        method: 'PATCH' as const,
        url: `/v1/usuarios/${activeUserId}/status`,
        adminStatus: 200,
        payload: {
          versao: 1,
          status: 'inativo',
          motivo: 'correcao_administrativa',
        },
      },
      {
        name: 'POST /v1/usuarios/:id/convites',
        method: 'POST' as const,
        url: `/v1/usuarios/${pendingUserId}/convites`,
        adminStatus: 201,
        payload: { modo_ativacao: 'ativar_usuario' },
      },
    ] as const;

    const evidence: Array<{
      route: string;
      actor: Actor;
      statusCode: number;
      errorCode: string | null;
    }> = [];
    for (const route of routes) {
      for (const scenario of actors) {
        const authenticatedHeaders = scenario.actor === 'anonymous'
          ? {}
          : bearer(scenario.actor);
        const mutationHeaders = route.method === 'GET'
          ? {}
          : {
              'idempotency-key': [
                'mp35b-matrix',
                route.method.toLowerCase(),
                route.name.replaceAll(/[^a-z]+/giu, '-').toLowerCase(),
                scenario.actor,
              ].join('-').slice(0, 128),
            };
        const response = await targetApp.inject({
          method: route.method,
          url: route.url,
          headers: { ...authenticatedHeaders, ...mutationHeaders },
          ...('payload' in route ? { payload: route.payload } : {}),
        });
        const expectedStatus = scenario.actor === 'admin'
          ? route.adminStatus
          : scenario.statusCode;
        assert.equal(
          response.statusCode,
          expectedStatus,
          `${route.name} / ${scenario.actor}`,
        );
        const errorCode = response.statusCode >= 400
          ? response.json().error.code as string
          : null;
        if (scenario.errorCode !== undefined) {
          assert.equal(errorCode, scenario.errorCode);
        }
        evidence.push({
          route: route.name,
          actor: scenario.actor,
          statusCode: response.statusCode,
          errorCode,
        });
      }
    }
    assert.equal(evidence.length, 30);
    assert.equal(new Set(evidence.map((item) => `${item.route}:${item.actor}`)).size, 30);

    const pendingStatus = await targetApp.inject({
      method: 'PATCH',
      url: `/v1/usuarios/${pendingUserId}/status`,
      headers: {
        ...bearer('admin'),
        'idempotency-key': 'mp35b-matrix-pending-status',
      },
      payload: {
        versao: 2,
        status: 'ativo',
        motivo: 'correcao_administrativa',
      },
    });
    assert.equal(pendingStatus.statusCode, 422);
    assert.equal(pendingStatus.json().error.code, 'validation_error');
  });

  test('cursor vazio, excessivo, truncado, malformado, adulterado ou de versão desconhecida retorna 400', async () => {
    const targetApp = requireApp();
    const firstPage = await targetApp.inject({
      method: 'GET',
      url: '/v1/usuarios?limite=1',
      headers: bearer('admin'),
    });
    assert.equal(firstPage.statusCode, 200);
    const validCursor = firstPage.json().paginacao.proximo_cursor as string;
    assert.ok(validCursor);
    const lastCharacter = validCursor.at(-1);
    assert.ok(lastCharacter);
    const invalidCursors = [
      '',
      'x'.repeat(2_049),
      validCursor.slice(0, -8),
      'not.a.valid.cursor',
      `${validCursor.slice(0, -1)}${lastCharacter === 'A' ? 'B' : 'A'}`,
      validCursor.replace(/^v1\./u, 'v99.'),
    ];
    for (const cursor of invalidCursors) {
      const response = await targetApp.inject({
        method: 'GET',
        url: `/v1/usuarios?cursor=${encodeURIComponent(cursor)}`,
        headers: bearer('admin'),
      });
      assert.equal(response.statusCode, 400, cursor.slice(0, 20));
      assert.equal(response.json().error.code, 'invalid_request');
    }
  });

  test('aplica o limite Unicode N/N+1 após NFC em HTTP, domínio e PostgreSQL', async () => {
    const targetApp = requireApp();
    const cases = [
      { label: 'ascii', unit: 'a' },
      { label: 'emoji', unit: '😀' },
      { label: 'composto', unit: 'é' },
      { label: 'decomposto', unit: 'é' },
    ] as const;
    for (const current of cases) {
      const accepted = await targetApp.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          ...bearer('admin'),
          'idempotency-key': `mp35b-e2e-unicode-${current.label}-n`,
        },
        payload: {
          nome: current.unit.repeat(200),
          email: `unicode-${current.label}-n@example.test`,
          perfil: 'colaborador',
        },
      });
      assert.equal(accepted.statusCode, 201, current.label);

      const rejected = await targetApp.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          ...bearer('admin'),
          'idempotency-key': `mp35b-e2e-unicode-${current.label}-n-plus-1`,
        },
        payload: {
          nome: current.unit.repeat(201),
          email: `unicode-${current.label}-n-plus-1@example.test`,
          perfil: 'colaborador',
        },
      });
      assert.equal(rejected.statusCode, 422, current.label);
      assert.equal(rejected.json().error.code, 'validation_error');
    }
  });

  test('aplica N/N+1 ao e-mail ASCII, emoji, composto, decomposto e fora do BMP', async () => {
    const targetApp = requireApp();
    assert.ok(ownerPool);
    const cases = [
      { label: 'ascii', unit: 'a' },
      { label: 'emoji', unit: '😀' },
      { label: 'composto', unit: 'é' },
      { label: 'decomposto', unit: 'é' },
      { label: 'fora-bmp', unit: '𐐷' },
    ] as const;
    const acceptedIds: string[] = [];
    for (const current of cases) {
      const suffix = `@${current.label}.io`;
      const atLimit = `${current.unit.repeat(254 - suffix.length)}${suffix}`;
      const aboveLimit = `${current.unit.repeat(255 - suffix.length)}${suffix}`;
      assert.equal(Array.from(atLimit.normalize('NFC')).length, 254);
      assert.equal(Array.from(aboveLimit.normalize('NFC')).length, 255);

      const accepted = await targetApp.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          ...bearer('admin'),
          'idempotency-key': `mp35b-email-${current.label}-n`,
        },
        payload: {
          nome: `E-mail Unicode ${current.label}`,
          email: atLimit,
          perfil: 'colaborador',
        },
      });
      assert.equal(accepted.statusCode, 201, current.label);
      acceptedIds.push(accepted.json().recurso_id as string);

      const rejected = await targetApp.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          ...bearer('admin'),
          'idempotency-key': `mp35b-email-${current.label}-n-plus-1`,
        },
        payload: {
          nome: `E-mail Unicode excedido ${current.label}`,
          email: aboveLimit,
          perfil: 'colaborador',
        },
      });
      assert.equal(rejected.statusCode, 422, current.label);
      assert.equal(rejected.json().error.code, 'validation_error');
    }

    const persisted = await ownerPool.query<{
      id: string;
      code_points: number;
      is_nfc: boolean;
    }>(
      `
        SELECT id, pg_catalog.char_length(email) AS code_points,
               email IS NFC NORMALIZED AS is_nfc
        FROM public.usuarios
        WHERE id = ANY($1::uuid[])
      `,
      [acceptedIds],
    );
    assert.equal(persisted.rows.length, cases.length);
    for (const row of persisted.rows) {
      assert.equal(row.code_points, 254);
      assert.equal(row.is_nfc, true);
    }
  });

  test('pagina mais de 100 nomes por keyset sem omissão ou duplicação', async () => {
    assert.ok(ownerPool);
    await ownerPool.query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        )
        SELECT pg_catalog.gen_random_uuid(), $1,
               'LoteCursor ' || pg_catalog.lpad(serie::text, 3, '0'),
               'lote-cursor-' || serie::text || '@example.test',
               'colaborador', 'inativo'
        FROM pg_catalog.generate_series(1, 105) AS serie
      `,
      [ORGANIZATION_ID],
    );
    for (const [index, name] of [
      'LoteCursor Nome igual',
      'LoteCursor Nome igual',
      'LoteCursor Árvore',
      'LoteCursor Árvore',
      'LoteCursor caixa',
      'LoteCursor CAIXA',
    ].entries()) {
      await ownerPool.query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES (
            pg_catalog.gen_random_uuid(), $1, $2, $3,
            'colaborador', 'inativo'
          )
        `,
        [ORGANIZATION_ID, name, `lote-cursor-variant-${index}@example.test`],
      );
    }

    const targetApp = requireApp();
    const collectedIds: string[] = [];
    const collectedNames: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const response: Awaited<ReturnType<typeof targetApp.inject>> =
        await targetApp.inject({
        method: 'GET',
        url: `/v1/usuarios?busca=LoteCursor&limite=25${
          cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`
        }`,
        headers: bearer('admin'),
        });
      assert.equal(response.statusCode, 200);
      const page = response.json<{
        itens: readonly { id: string; nome: string }[];
        paginacao: { proximo_cursor: string | null };
      }>();
      collectedIds.push(...page.itens.map((item) => item.id));
      collectedNames.push(...page.itens.map((item) => item.nome));
      cursor = page.paginacao.proximo_cursor;
      pages += 1;
      if (pages === 1) {
        await ownerPool.query(
          `
            INSERT INTO public.usuarios (
              id, organizacao_id, nome, email, perfil, status
            ) VALUES (
              pg_catalog.gen_random_uuid(), $1, 'LoteCursor zzz concorrente',
              'lote-cursor-concurrent@example.test', 'colaborador', 'inativo'
            )
          `,
          [ORGANIZATION_ID],
        );
      }
      assert.ok(pages < 10);
    } while (cursor !== null);

    assert.equal(collectedIds.length, 112);
    assert.equal(new Set(collectedIds).size, collectedIds.length);
    assert.equal(collectedNames.filter((name) => name === 'LoteCursor Nome igual').length, 2);
    assert.ok(collectedNames.includes('LoteCursor Árvore'));
    assert.ok(collectedNames.includes('LoteCursor Árvore'));
    assert.ok(collectedNames.includes('LoteCursor caixa'));
    assert.ok(collectedNames.includes('LoteCursor CAIXA'));
    assert.ok(collectedNames.includes('LoteCursor zzz concorrente'));
  });

  test('matriz E2E MP-35C cobre sete rotas e cinco estados com LOGIN runtime real', async () => {
    const targetApp = requireApp();
    assert.ok(mp35cHolderId);
    assert.ok(mp35cUpdatePropertyId);
    assert.ok(mp35cStatusPropertyId);
    assert.ok(mp35cLinkPropertyId);
    assert.ok(mp35cLinkUserId);

    type Actor = 'admin' | 'anonymous' | 'stale_admin' | 'produtor' | 'colaborador';
    const actors = [
      { actor: 'admin' as const, statusCode: 200 },
      { actor: 'anonymous' as const, statusCode: 401, errorCode: 'invalid_session' },
      { actor: 'stale_admin' as const, statusCode: 401, errorCode: 'invalid_session' },
      { actor: 'produtor' as const, statusCode: 403, errorCode: 'forbidden' },
      { actor: 'colaborador' as const, statusCode: 403, errorCode: 'forbidden' },
    ] satisfies readonly { actor: Actor; statusCode: number; errorCode?: string }[];
    const routes = [
      { name: 'POST /v1/propriedades', method: 'POST' as const,
        url: '/v1/propriedades', adminStatus: 201,
        payload: { nome: 'Criada pela matriz MP35C', titular_id: mp35cHolderId,
          municipio_id: '4305108', status: 'inativa' } },
      { name: 'PATCH /v1/propriedades/:id', method: 'PATCH' as const,
        url: `/v1/propriedades/${mp35cUpdatePropertyId}`, adminStatus: 200,
        payload: { versao: 1, nome: 'Atualizada pela matriz MP35C' } },
      { name: 'PATCH /v1/propriedades/:id/status', method: 'PATCH' as const,
        url: `/v1/propriedades/${mp35cStatusPropertyId}/status`, adminStatus: 200,
        payload: { versao: 1, status: 'ativa', motivo: 'correcao_administrativa' } },
      { name: 'GET /v1/usuarios/:id/propriedades', method: 'GET' as const,
        url: `/v1/usuarios/${mp35cLinkUserId}/propriedades?limite=10`, adminStatus: 200 },
      { name: 'PATCH /v1/usuarios/:id/propriedades', method: 'PATCH' as const,
        url: `/v1/usuarios/${mp35cLinkUserId}/propriedades`, adminStatus: 200,
        payload: { versao: 1, adicionar: [mp35cLinkPropertyId], remover: [],
          motivo: 'correcao_administrativa' } },
      { name: 'GET /v1/localidades/ufs', method: 'GET' as const,
        url: '/v1/localidades/ufs', adminStatus: 200 },
      { name: 'GET /v1/localidades/municipios', method: 'GET' as const,
        url: '/v1/localidades/municipios?uf_id=43&limite=2', adminStatus: 200 },
    ] as const;

    const evidence: Array<{ route: string; actor: Actor; statusCode: number }> = [];
    for (const route of routes) {
      for (const scenario of actors) {
        const authenticatedHeaders = scenario.actor === 'anonymous' ? {} : bearer(scenario.actor);
        const mutationHeaders = route.method === 'GET' ? {} : {
          'idempotency-key': `mp35c-e2e-${routes.indexOf(route)}-${scenario.actor}`,
        };
        const response = await targetApp.inject({
          method: route.method,
          url: route.url,
          headers: { ...authenticatedHeaders, ...mutationHeaders },
          ...('payload' in route ? { payload: route.payload } : {}),
        });
        const expected = scenario.actor === 'admin' ? route.adminStatus : scenario.statusCode;
        assert.equal(response.statusCode, expected, `${route.name} / ${scenario.actor}`);
        assert.equal(response.headers['cache-control'], 'no-store');
        if (scenario.errorCode !== undefined) {
          assert.equal(response.json().error.code, scenario.errorCode);
        }
        evidence.push({ route: route.name, actor: scenario.actor,
          statusCode: response.statusCode });
      }
    }
    assert.equal(evidence.length, 35);
    assert.equal(new Set(evidence.map((item) => `${item.route}:${item.actor}`)).size, 35);
  });
});
