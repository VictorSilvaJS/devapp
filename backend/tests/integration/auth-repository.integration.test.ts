import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import { loadAuthenticationRuntimeConfig } from '../../src/auth/config.js';
import type { AuthenticationPasswordCredentialService } from '../../src/auth/password-credential.js';
import { PostgresAuthRepository } from '../../src/auth/postgres-auth-repository.js';
import { PostgresLoginThrottle } from '../../src/auth/postgres-login-throttle.js';
import { DefaultAuthenticationService } from '../../src/auth/service.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { HttpError } from '../../src/security/http-error.js';
import {
  hashOpaqueToken,
  hmacIdentifier,
  issueOpaqueToken,
} from '../../src/security/tokens.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import type { AccountNotificationWriter } from '../../src/notifications/contracts.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';
const initialPassword = 'SenhaInicial1';

function phcFor(password: string): string {
  return `$argon2id$v=19$m=19456,p=1,t=2$c2FsdC1maXh0dXJl$${Buffer.from(
    password.normalize('NFC'),
  ).toString('base64url')}`;
}

class FixturePasswordCredentials
  implements AuthenticationPasswordCredentialService
{
  public async validateAndHash(password: string) {
    return { passwordHash: phcFor(password), policyVersion: 'integration-v1' };
  }

  public async verify(password: string, passwordHash: string) {
    return {
      valid: passwordHash === phcFor(password),
      needsRehash: false,
    };
  }

  public async rehash(password: string) {
    return this.validateAndHash(password);
  }
}

describe(
  'PostgresAuthRepository e PostgresLoginThrottle',
  { timeout: 180_000 },
  () => {
    let testDatabase: StartedPostgisTestDatabase | undefined;
    let ownerPool: Pool | undefined;
    let runtimePool: Pool | undefined;
    let runtimeLoginRole: string | undefined;
    let repository: PostgresAuthRepository | undefined;
    let throttle: PostgresLoginThrottle | undefined;
    let service: DefaultAuthenticationService | undefined;
    let loginSequence = 0;
    const authConfig = loadAuthenticationRuntimeConfig({ NODE_ENV: 'test' });
    const recoveryOutboxFactory = new EncryptedEmailOutboxFactory(
      new OutboxPayloadCipher({
        activeKeyId: 'integration-key',
        keys: [{ id: 'integration-key', key: Buffer.alloc(32, 0x41) }],
      }),
    );

    before(async () => {
      assertDestructiveDatabaseTestsAllowed(
        'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
      );
      const previousAmbientUrl = process.env.DATABASE_URL;
      const ambientSentinelUrl =
        'postgresql://ambient:sentinel@database.invalid:5432/ambient_must_not_be_used';
      process.env.DATABASE_URL = ambientSentinelUrl;
      try {
        testDatabase = await startPostgisTestDatabase();
        assert.notEqual(testDatabase.connectionString, ambientSentinelUrl);
      } finally {
        if (previousAmbientUrl === undefined) {
          delete process.env.DATABASE_URL;
        } else {
          process.env.DATABASE_URL = previousAmbientUrl;
        }
      }
      assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
      await runMigrations({ command: 'up', database: testDatabase.database });
      ownerPool = new Pool(buildPostgresPoolConfig(testDatabase.database));
      runtimeLoginRole =
        `tche_test_runtime_auth_${randomUUID().replaceAll('-', '')}`;
      const runtimePassword = randomUUID();
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
      repository = createRepository();
      throttle = new PostgresLoginThrottle({ pool: runtimePool });
      service = new DefaultAuthenticationService({
        config: authConfig,
        repository,
        throttle,
        credentials: new FixturePasswordCredentials(),
        dummyPasswordHash: phcFor('DummyPassword1'),
      });
    });

    after(async () => {
      await runtimePool?.end();
      if (ownerPool !== undefined && runtimeLoginRole !== undefined) {
        await ownerPool.query(`DROP ROLE IF EXISTS ${runtimeLoginRole}`);
      }
      await ownerPool?.end();
      await testDatabase?.container.stop();
    });

    function requirePool(): Pool {
      assert.ok(ownerPool);
      return ownerPool;
    }

    function requireRuntimePool(): Pool {
      assert.ok(runtimePool);
      return runtimePool;
    }

    function requireRepository(): PostgresAuthRepository {
      assert.ok(repository);
      return repository;
    }

    function requireThrottle(): PostgresLoginThrottle {
      assert.ok(throttle);
      return throttle;
    }

    function requireService(): DefaultAuthenticationService {
      assert.ok(service);
      return service;
    }

    function createRepository(
      notificationWriter?: AccountNotificationWriter,
    ): PostgresAuthRepository {
      return new PostgresAuthRepository({
        pool: requireRuntimePool(),
        emailHmacKey: authConfig.abuseProtection.emailHmacKey,
        recoveryOutboxFactory,
        recoveryActionBaseUrl: 'https://example.test/auth/action',
        ...(notificationWriter === undefined ? {} : { notificationWriter }),
      });
    }

    async function seedActiveUser(): Promise<{ id: string; email: string }> {
      const id = randomUUID();
      const email = `auth-${id}@example.test`;
      await requirePool().query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, 'Usuário Auth', $3, 'colaborador', 'ativo')
        `,
        [id, ORGANIZATION_ID, email],
      );
      await requirePool().query(
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, id, phcFor(initialPassword)],
      );
      return { id, email };
    }

    async function login(user: { id: string; email: string }, requestId: string) {
      loginSequence += 1;
      return requireService().login({
        email: user.email,
        password: initialPassword,
        ipAddress: `192.0.2.${loginSequence}`,
        requestId,
      });
    }

    async function assertPersistedTokenWindow(tokens: {
      readonly accessToken: string;
      readonly sessionId: string;
      readonly issuedAt: Date;
      readonly accessExpiresAt: Date;
      readonly sessionInactivityExpiresAt: Date;
      readonly sessionAbsoluteExpiresAt: Date;
    }): Promise<void> {
      const persisted = await requirePool().query<{
        emitido_em: Date;
        access_expira_em: Date;
        expira_inatividade_em: Date;
        expira_absolutamente_em: Date;
      }>(
        `
          SELECT acesso.emitido_em, acesso.expira_em AS access_expira_em,
                 sessao.expira_inatividade_em, sessao.expira_absolutamente_em
          FROM public.tokens_acesso AS acesso
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = acesso.organizacao_id
           AND sessao.id = acesso.sessao_id
          WHERE acesso.token_hash = $1 AND sessao.id = $2
        `,
        [Buffer.from(hashOpaqueToken(tokens.accessToken), 'base64url'), tokens.sessionId],
      );
      const row = persisted.rows[0];
      assert.ok(row);
      assert.equal(tokens.issuedAt.getTime(), row.emitido_em.getTime());
      assert.equal(tokens.accessExpiresAt.getTime(), row.access_expira_em.getTime());
      assert.equal(
        tokens.sessionInactivityExpiresAt.getTime(),
        row.expira_inatividade_em.getTime(),
      );
      assert.equal(
        tokens.sessionAbsoluteExpiresAt.getTime(),
        row.expira_absolutamente_em.getTime(),
      );
    }

    test('login cria sessão stateful e access respeita status, idle, absoluto e auth-version', async () => {
      const regular = await seedActiveUser();
      const tokens = await login(regular, 'req-login');
      await assertPersistedTokenWindow(tokens);
      const principal = await requireRepository().resolveAccessToken(
        hashOpaqueToken(tokens.accessToken),
      );
      assert.equal(principal?.id, regular.id);
      const sessions = await requireRepository().listSessions({
        userId: regular.id,
        currentSessionId: tokens.sessionId,
      });
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0]?.current, true);

      const idle = await seedActiveUser();
      const idleTokens = await login(idle, 'req-idle');
      await requirePool().query(
        `
          UPDATE public.sessoes_autenticacao
          SET criada_em = clock_timestamp() - interval '40 days',
              ultima_renovacao_em = clock_timestamp() - interval '20 days',
              expira_inatividade_em = clock_timestamp() - interval '1 day',
              expira_absolutamente_em = clock_timestamp() + interval '1 day'
          WHERE id = $1
        `,
        [idleTokens.sessionId],
      );
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(idleTokens.accessToken),
        ),
        null,
      );

      const absolute = await seedActiveUser();
      const absoluteTokens = await login(absolute, 'req-absolute');
      await requirePool().query(
        `
          UPDATE public.sessoes_autenticacao
          SET criada_em = clock_timestamp() - interval '40 days',
              ultima_renovacao_em = clock_timestamp() - interval '31 days',
              expira_inatividade_em = clock_timestamp() - interval '2 days',
              expira_absolutamente_em = clock_timestamp() - interval '1 day'
          WHERE id = $1
        `,
        [absoluteTokens.sessionId],
      );
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(absoluteTokens.accessToken),
        ),
        null,
      );

      const changed = await seedActiveUser();
      const changedTokens = await login(changed, 'req-version');
      await requirePool().query(
        'UPDATE public.usuarios SET versao_autorizacao = versao_autorizacao + 1 WHERE id = $1',
        [changed.id],
      );
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(changedTokens.accessToken),
        ),
        null,
      );

      const inactive = await seedActiveUser();
      const inactiveTokens = await login(inactive, 'req-inactive');
      await requirePool().query(
        "UPDATE public.usuarios SET status = 'inativo' WHERE id = $1",
        [inactive.id],
      );
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(inactiveTokens.accessToken),
        ),
        null,
      );
    });

    test('refresh concorrente gira uma vez e replay revoga toda a família', async () => {
      const user = await seedActiveUser();
      const original = await login(user, 'req-refresh-login');
      const results = await Promise.allSettled([
        requireService().refresh({
          refreshToken: original.refreshToken,
          requestId: 'req-refresh-a',
        }),
        requireService().refresh({
          refreshToken: original.refreshToken,
          requestId: 'req-refresh-b',
        }),
      ]);
      assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
      const rejected = results.find((item) => item.status === 'rejected');
      assert.ok(rejected?.reason instanceof HttpError);
      assert.equal(rejected.reason.code, 'invalid_session');
      const fulfilled = results.find((item) => item.status === 'fulfilled');
      assert.ok(fulfilled);
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(fulfilled.value.accessToken),
        ),
        null,
      );
      const session = await requirePool().query<{ status: string; motivo_revogacao: string }>(
        'SELECT status, motivo_revogacao FROM public.sessoes_autenticacao WHERE id = $1',
        [original.sessionId],
      );
      assert.deepEqual(session.rows[0], {
        status: 'revogada',
        motivo_revogacao: 'refresh_reutilizado',
      });
    });

    test('troca autenticada revoga outras sessões e gira os tokens da sessão atual', async () => {
      const user = await seedActiveUser();
      const current = await login(user, 'req-password-login-a');
      const other = await login(user, 'req-password-login-b');
      const replacement = await requireService().changePassword({
        accessToken: current.accessToken,
        currentPassword: initialPassword,
        newPassword: 'NovaSenhaSegura2',
        requestId: 'req-password-change',
      });
      await assertPersistedTokenWindow(replacement);

      assert.equal(replacement.sessionId, current.sessionId);
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(current.accessToken),
        ),
        null,
      );
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(other.accessToken),
        ),
        null,
      );
      assert.equal(
        (
          await requireRepository().resolveAccessToken(
            hashOpaqueToken(replacement.accessToken),
          )
        )?.authorizationVersion,
        2,
      );
      const oldRefresh = await requirePool().query<{ status: string }>(
        'SELECT status FROM public.tokens_refresh WHERE token_hash = $1',
        [Buffer.from(hashOpaqueToken(current.refreshToken), 'base64url')],
      );
      assert.equal(oldRefresh.rows[0]?.status, 'rotacionado');
      const refreshed = await requireService().refresh({
        refreshToken: replacement.refreshToken,
        requestId: 'req-password-new-refresh',
      });
      await assertPersistedTokenWindow(refreshed);
      assert.equal(refreshed.sessionId, current.sessionId);
      assert.ok(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(refreshed.accessToken),
        ),
      );
      const credential = await requirePool().query<{
        senha_phc: string;
        versao_autorizacao: string;
      }>(
        `
          SELECT credencial.senha_phc, usuario.versao_autorizacao
          FROM public.credenciais_usuario AS credencial
          JOIN public.usuarios AS usuario ON usuario.id = credencial.usuario_id
          WHERE usuario.id = $1
        `,
        [user.id],
      );
      assert.equal(credential.rows[0]?.senha_phc, phcFor('NovaSenhaSegura2'));
      assert.equal(Number(credential.rows[0]?.versao_autorizacao), 2);
    });

    test('falha da notificação reverte atomicamente a troca autenticada de senha', async () => {
      const user = await seedActiveUser();
      const current = await login(user, 'req-password-rollback-login');
      const injectedFailure = 'notification-writer-injected-failure';
      const failingRepository = createRepository({
        async create() {
          throw new Error(injectedFailure);
        },
      });
      const failingService = new DefaultAuthenticationService({
        config: authConfig,
        repository: failingRepository,
        throttle: requireThrottle(),
        credentials: new FixturePasswordCredentials(),
        dummyPasswordHash: phcFor('DummyPassword1'),
      });

      await assert.rejects(
        failingService.changePassword({
          accessToken: current.accessToken,
          currentPassword: initialPassword,
          newPassword: 'NovaSenhaRollback2',
          requestId: 'req-password-rollback',
        }),
        (error: unknown) =>
          error instanceof HttpError && error.code === 'service_unavailable',
      );

      const state = await requirePool().query<{
        senha_phc: string;
        versao_autorizacao: string;
        session_status: string;
        access_status: string;
        refresh_status: string;
        audits: string;
        notifications: string;
      }>(
        `
          SELECT credencial.senha_phc, usuario.versao_autorizacao::text,
                 sessao.status AS session_status,
                 acesso.status AS access_status,
                 refresh.status AS refresh_status,
                 (SELECT count(*)::text FROM public.eventos_auditoria
                  WHERE request_id = 'req-password-rollback') AS audits,
                 (SELECT count(*)::text FROM public.notificacao_entrega
                  WHERE destinatario_usuario_id = usuario.id) AS notifications
          FROM public.usuarios AS usuario
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = usuario.organizacao_id
           AND sessao.id = $2
          JOIN public.tokens_acesso AS acesso
            ON acesso.organizacao_id = sessao.organizacao_id
           AND acesso.sessao_id = sessao.id
           AND acesso.token_hash = $3
          JOIN public.tokens_refresh AS refresh
            ON refresh.organizacao_id = sessao.organizacao_id
           AND refresh.sessao_id = sessao.id
           AND refresh.token_hash = $4
          WHERE usuario.organizacao_id = $1 AND usuario.id = $5
        `,
        [
          ORGANIZATION_ID,
          current.sessionId,
          Buffer.from(hashOpaqueToken(current.accessToken), 'base64url'),
          Buffer.from(hashOpaqueToken(current.refreshToken), 'base64url'),
          user.id,
        ],
      );
      assert.deepEqual(state.rows[0], {
        senha_phc: phcFor(initialPassword),
        versao_autorizacao: '1',
        session_status: 'ativa',
        access_status: 'ativo',
        refresh_status: 'ativo',
        audits: '0',
        notifications: '0',
      });
      assert.ok(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(current.accessToken),
        ),
      );
    });

    test('logout/listagem e revogação própria são isolados por usuário', async () => {
      const user = await seedActiveUser();
      const first = await login(user, 'req-list-a');
      const second = await login(user, 'req-list-b');
      const listed = await requireService().sessions(first.accessToken);
      assert.equal(listed.length, 2);
      await requireService().revokeSession({
        accessToken: first.accessToken,
        sessionId: second.sessionId,
        requestId: 'req-revoke-owned',
      });
      assert.equal(
        await requireRepository().resolveAccessToken(hashOpaqueToken(second.accessToken)),
        null,
      );
      await requireService().logout({
        accessToken: first.accessToken,
        requestId: 'req-logout',
      });
      assert.equal(
        await requireRepository().resolveAccessToken(hashOpaqueToken(first.accessToken)),
        null,
      );
    });

    test('recuperação comum cria desafio/outbox/auditoria e conclui uma única vez', async () => {
      const user = await seedActiveUser();
      const activeSession = await login(user, 'req-recovery-login');
      const supersededToken = issueOpaqueToken();
      await requireRepository().beginPasswordRecovery({
        normalizedEmail: user.email,
        tokenHash: supersededToken.hash,
        deliveryToken: supersededToken.value,
        ttlSeconds: 1_800,
        requestId: 'req-recovery-superseded',
      });
      const token = issueOpaqueToken();
      await requireRepository().beginPasswordRecovery({
        normalizedEmail: user.email,
        tokenHash: token.hash,
        deliveryToken: token.value,
        ttlSeconds: 1_800,
        requestId: 'req-recovery-start',
      });
      assert.equal(
        await requireRepository().isPasswordRecoveryTokenUsable(supersededToken.hash),
        false,
      );
      assert.equal(await requireRepository().isPasswordRecoveryTokenUsable(token.hash), true);
      const persisted = await requirePool().query<{
        desafio_id: string;
        token_hash: Buffer;
        payload_cifrado: Buffer;
        email_hmac: Buffer;
        usuario_afetado_id: string;
      }>(
        `
          SELECT desafio.id AS desafio_id, desafio.token_hash,
                 outbox.payload_cifrado, auditoria.email_hmac,
                 auditoria.usuario_afetado_id
          FROM public.desafios_autenticacao AS desafio
          JOIN public.outbox_email AS outbox ON outbox.desafio_id = desafio.id
          JOIN public.eventos_auditoria AS auditoria
            ON auditoria.recurso_id = desafio.usuario_id::text
           AND auditoria.evento = 'auth.recuperacao_senha.solicitada'
           AND auditoria.request_id = 'req-recovery-start'
          WHERE desafio.usuario_id = $1 AND desafio.status = 'ativo'
        `,
        [user.id],
      );
      const recovery = persisted.rows[0];
      assert.ok(recovery);
      assert.deepEqual(recovery.token_hash, Buffer.from(token.hash, 'base64url'));
      assert.equal(recovery.payload_cifrado.toString('utf8').includes(token.value), false);
      assert.equal(recovery.payload_cifrado.toString('utf8').includes(user.email), false);
      assert.equal(recovery.email_hmac.byteLength, 32);
      assert.equal(recovery.usuario_afetado_id, user.id);

      const superseded = await requirePool().query<{
        desafio_status: string;
        outbox_status: string;
        payload_cifrado: Buffer | null;
        nonce: Buffer | null;
        nonce_hash: Buffer;
      }>(
        `
          SELECT desafio.status AS desafio_status, outbox.status AS outbox_status,
                 outbox.payload_cifrado, outbox.nonce, outbox.nonce_hash
          FROM public.desafios_autenticacao AS desafio
          JOIN public.outbox_email AS outbox ON outbox.desafio_id = desafio.id
          WHERE desafio.token_hash = $1
        `,
        [Buffer.from(supersededToken.hash, 'base64url')],
      );
      assert.equal(superseded.rows[0]?.desafio_status, 'revogado');
      assert.equal(superseded.rows[0]?.outbox_status, 'cancelado');
      assert.equal(superseded.rows[0]?.payload_cifrado, null);
      assert.equal(superseded.rows[0]?.nonce, null);
      assert.equal(superseded.rows[0]?.nonce_hash.byteLength, 32);

      const completed = await Promise.all([
        requireRepository().completePasswordRecovery({
          tokenHash: token.hash,
          replacementPasswordHash: phcFor('SenhaRecuperada3'),
          policyVersion: 'integration-v2',
          requestId: 'req-recovery-complete-a',
        }),
        requireRepository().completePasswordRecovery({
          tokenHash: token.hash,
          replacementPasswordHash: phcFor('SenhaRecuperada3'),
          policyVersion: 'integration-v2',
          requestId: 'req-recovery-complete-b',
        }),
      ]);
      assert.deepEqual([...completed].sort(), [false, true]);
      assert.equal(await requireRepository().isPasswordRecoveryTokenUsable(token.hash), false);
      assert.equal(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(activeSession.accessToken),
        ),
        null,
      );
      const state = await requirePool().query<{
        desafio_status: string;
        senha_phc: string;
        versao_autorizacao: string;
      }>(
        `
          SELECT desafio.status AS desafio_status, credencial.senha_phc,
                 usuario.versao_autorizacao
          FROM public.desafios_autenticacao AS desafio
          JOIN public.usuarios AS usuario ON usuario.id = desafio.usuario_id
          JOIN public.credenciais_usuario AS credencial
            ON credencial.usuario_id = usuario.id
          WHERE desafio.id = $1
        `,
        [recovery.desafio_id],
      );
      assert.deepEqual(state.rows[0], {
        desafio_status: 'consumido',
        senha_phc: phcFor('SenhaRecuperada3'),
        versao_autorizacao: '2',
      });
    });

    test('falha da notificação reverte atomicamente a recuperação comum', async () => {
      const user = await seedActiveUser();
      const activeSession = await login(user, 'req-recovery-rollback-login');
      const token = issueOpaqueToken();
      await requireRepository().beginPasswordRecovery({
        normalizedEmail: user.email,
        tokenHash: token.hash,
        deliveryToken: token.value,
        ttlSeconds: 1_800,
        requestId: 'req-recovery-rollback-start',
      });
      const failingRepository = createRepository({
        async create() {
          throw new Error('notification-writer-injected-failure');
        },
      });

      await assert.rejects(
        failingRepository.completePasswordRecovery({
          tokenHash: token.hash,
          replacementPasswordHash: phcFor('SenhaRecuperadaRollback3'),
          policyVersion: 'integration-v2',
          requestId: 'req-recovery-rollback-complete',
        }),
        (error: unknown) =>
          error instanceof HttpError && error.code === 'service_unavailable',
      );

      const state = await requirePool().query<{
        desafio_status: string;
        senha_phc: string;
        versao_autorizacao: string;
        session_status: string;
        audits: string;
        notifications: string;
      }>(
        `
          SELECT desafio.status AS desafio_status, credencial.senha_phc,
                 usuario.versao_autorizacao::text,
                 sessao.status AS session_status,
                 (SELECT count(*)::text FROM public.eventos_auditoria
                  WHERE request_id = 'req-recovery-rollback-complete') AS audits,
                 (SELECT count(*)::text FROM public.notificacao_entrega
                  WHERE destinatario_usuario_id = usuario.id) AS notifications
          FROM public.desafios_autenticacao AS desafio
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = desafio.organizacao_id
           AND usuario.id = desafio.usuario_id
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = usuario.organizacao_id
           AND sessao.usuario_id = usuario.id
           AND sessao.id = $2
          WHERE desafio.token_hash = $1
        `,
        [Buffer.from(token.hash, 'base64url'), activeSession.sessionId],
      );
      assert.deepEqual(state.rows[0], {
        desafio_status: 'ativo',
        senha_phc: phcFor(initialPassword),
        versao_autorizacao: '1',
        session_status: 'ativa',
        audits: '0',
        notifications: '0',
      });
      assert.equal(
        await requireRepository().isPasswordRecoveryTokenUsable(token.hash),
        true,
      );
      assert.ok(
        await requireRepository().resolveAccessToken(
          hashOpaqueToken(activeSession.accessToken),
        ),
      );
    });

    test('limite persistente aplica 1 minuto na quinta falha e separa IP/e-mail', async () => {
      const emailHmac = hmacIdentifier(
        `limit-${randomUUID()}@example.test`,
        authConfig.abuseProtection.emailHmacKey,
      );
      const ipHmac = hmacIdentifier(
        `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
        authConfig.abuseProtection.ipHmacKey,
      );
      for (let index = 0; index < 5; index += 1) {
        await requireThrottle().recordFailure({
          ipHmac,
          identifierHmac: emailHmac,
          windowSeconds: 900,
          failureThreshold: 5,
          lockScheduleSeconds: [60, 120, 240, 480, 900],
        });
      }
      const ipDecision = await requireThrottle().checkIp(ipHmac);
      const emailDecision = await requireThrottle().checkIdentifier(emailHmac);
      assert.equal(ipDecision.allowed, false);
      assert.equal(emailDecision.allowed, false);
      assert.ok((ipDecision.retryAfterSeconds ?? 0) <= 60);
      assert.ok((ipDecision.retryAfterSeconds ?? 0) >= 55);
      await requireThrottle().recordSuccess({ identifierHmac: emailHmac });
      assert.deepEqual(await requireThrottle().checkIdentifier(emailHmac), {
        allowed: true,
      });
      assert.equal((await requireThrottle().checkIp(ipHmac)).allowed, false);
      const buckets = await requirePool().query<{
        escopo: string;
        chave_hmac: Buffer;
      }>(
        `
          SELECT escopo, chave_hmac
          FROM public.buckets_limite_autenticacao
          WHERE chave_hmac IN ($1, $2)
          ORDER BY escopo
        `,
        [Buffer.from(emailHmac, 'base64url'), Buffer.from(ipHmac, 'base64url')],
      );
      assert.equal(buckets.rows.length, 2);
      assert.notDeepEqual(buckets.rows[0]?.chave_hmac, buckets.rows[1]?.chave_hmac);
    });
  },
);
