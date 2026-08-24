import { strict as assert } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool, type QueryResultRow } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import {
  AdminBreakGlassCliService,
  AdminBreakGlassContinuationService,
  type BreakGlassAuthorizationVerifier,
  AdminSecondaryRecoveryService,
  AssistedRecoveryService,
  InitialAdminBootstrapCliService,
  InitialAdminInvitationCorrectionCliService,
  InvitationService,
  PostgresAdminBreakGlassRepository,
  PostgresAdminSecondaryRecoveryRepository,
  PostgresAssistedRecoveryRepository,
  PostgresInitialAdminBootstrapRepository,
  PostgresInvitationRepository,
  PostgresPrimaryEmailChangeRepository,
  PostgresPrimaryEmailPasswordVerifier,
  PostgresSecondaryEmailRepository,
  PrimaryEmailChangeService,
  SecondaryEmailService,
} from '../../src/account-actions/index.js';
import { loadAuthenticationRuntimeConfig } from '../../src/auth/config.js';
import type { AuthenticationPasswordCredentialService } from '../../src/auth/password-credential.js';
import { PostgresLoginThrottle } from '../../src/auth/postgres-login-throttle.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import type { EncryptedOutboxPayload } from '../../src/outbox/contracts.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { PostgresOutboxRepository } from '../../src/outbox/postgres-repository.js';
import type { AccountNotificationWriter } from '../../src/notifications/contracts.js';
import { HttpError } from '../../src/security/http-error.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';
const ACTION_URL = 'https://example.test/auth/action';
const authenticationConfig = loadAuthenticationRuntimeConfig({ NODE_ENV: 'test' });

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
    return { valid: passwordHash === phcFor(password), needsRehash: false };
  }

  public async rehash(password: string) {
    return this.validateAndHash(password);
  }
}

interface OutboxPayloadRow extends QueryResultRow {
  readonly id: string;
  readonly organizacao_id: string;
  readonly tipo_mensagem: string;
  readonly chave_id: string;
  readonly nonce: Buffer;
  readonly payload_cifrado: Buffer;
  readonly tag_autenticacao: Buffer;
}

describe('account-action PostgreSQL adapters', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let pool: Pool | undefined;
  let bootstrapAdminUserId: string | undefined;
  const cipher = new OutboxPayloadCipher({
    activeKeyId: 'integration-action-key',
    keys: [{ id: 'integration-action-key', key: Buffer.alloc(32, 0x37) }],
  });
  const emailOutbox = new EncryptedEmailOutboxFactory(cipher);
  const credentials = new FixturePasswordCredentials();
  const repositoryKeys = {
    emailHmacKey: Buffer.alloc(32, 0x41),
    externalReferenceHmacKey: Buffer.alloc(32, 0x42),
  };

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    const previousAmbientUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://ambient:sentinel@database.invalid/ambient_must_not_be_used';
    try {
      testDatabase = await startPostgisTestDatabase();
    } finally {
      if (previousAmbientUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousAmbientUrl;
    }
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({ command: 'up', database: testDatabase.database });
    pool = new Pool(buildPostgresPoolConfig(testDatabase.database));

    const platformBootstrap = await createLoginPoolForRole(
      'tche_agro_platform_ops',
    );
    let initialized: Awaited<
      ReturnType<InitialAdminBootstrapCliService['run']>
    > | undefined;
    let corrected: Awaited<
      ReturnType<InitialAdminInvitationCorrectionCliService['run']>
    > | undefined;
    try {
      const orphanAdminId = randomUUID();
      const orphanClient = await platformBootstrap.pool.connect();
      try {
        await orphanClient.query('BEGIN');
        await orphanClient.query(
          `
            INSERT INTO public.usuarios (
              id, organizacao_id, nome, email, perfil, status
            ) VALUES ($1, $2, 'Admin orfao bloqueado', $3, 'admin', 'pendente')
          `,
          [
            orphanAdminId,
            ORGANIZATION_ID,
            `bootstrap-orphan-${orphanAdminId}@example.test`,
          ],
        );
        await assert.rejects(
          orphanClient.query('COMMIT'),
          /Admin orfao|admin_referenciado/i,
        );
        await orphanClient.query('ROLLBACK');
      } finally {
        orphanClient.release();
      }

      const repository = new PostgresInitialAdminBootstrapRepository(
        postgresOptions(platformBootstrap.pool),
      );
      const bootstrap = new InitialAdminBootstrapCliService({
        enabled: true,
        repository,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      initialized = await bootstrap.run({
        organizationId: ORGANIZATION_ID,
        name: 'Administrador bootstrap da integração',
        email: `bootstrap-integration-incorreto-${randomUUID()}@example.test`,
      });

      const partialEmailClient = await platformBootstrap.pool.connect();
      try {
        await partialEmailClient.query('BEGIN');
        await partialEmailClient.query(
          `UPDATE public.usuarios SET email = $2 WHERE id = $1`,
          [
            initialized.adminUserId,
            `bootstrap-parcial-${randomUUID()}@example.test`,
          ],
        );
        await assert.rejects(
          partialEmailClient.query('COMMIT'),
          /substituir o convite|email_com_rotacao/i,
        );
        await partialEmailClient.query('ROLLBACK');
      } finally {
        partialEmailClient.release();
      }

      const correction = new InitialAdminInvitationCorrectionCliService({
        enabled: true,
        repository,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      corrected = await correction.run({
        organizationId: ORGANIZATION_ID,
        correctedEmail: `bootstrap-integration-${randomUUID()}@example.test`,
        reasonCode: 'bootstrap_email_typo',
      });

      const currentBootstrap = await platformBootstrap.pool.query<{
        readonly convite_id: string;
        readonly desafio_id: string;
        readonly corrigido_em: Date;
      }>(`
        SELECT convite.id AS convite_id, convite.desafio_id,
               bootstrap.corrigido_em
        FROM public.bootstrap_autenticacao AS bootstrap
        JOIN public.convites_usuario AS convite
          ON convite.organizacao_id = bootstrap.organizacao_id
         AND convite.id = bootstrap.ultimo_convite_id
        WHERE bootstrap.organizacao_id = '${ORGANIZATION_ID}'
      `);
      const current = currentBootstrap.rows[0];
      assert.ok(current);
      await assert.rejects(
        platformBootstrap.pool.query(
          `
            INSERT INTO public.eventos_auditoria (
              organizacao_id, evento, resultado, ator_tipo,
              usuario_afetado_id, recurso_tipo, recurso_id,
              metadados, ocorrido_em
            ) VALUES (
              $1, 'auth.bootstrap_admin.email_corrigido', 'sucesso',
              'plataforma', $2, 'action_challenge', $3, '{}'::jsonb, $4
            )
          `,
          [
            ORGANIZATION_ID,
            initialized.adminUserId,
            current.desafio_id,
            current.corrigido_em,
          ],
        ),
        /auditoria do bootstrap corrente|somente_bootstrap/i,
      );

      for (const order of ['convite_primeiro', 'desafio_primeiro'] as const) {
        const partialRevocationClient = await platformBootstrap.pool.connect();
        await partialRevocationClient.query('BEGIN');
        const revokeInvitation = () =>
          partialRevocationClient.query(
            `
              UPDATE public.convites_usuario
              SET status = 'revogado', encerrado_em = pg_catalog.clock_timestamp(),
                  motivo_encerramento = 'bootstrap_email_corrigido'
              WHERE id = $1
            `,
            [current.convite_id],
          );
        const revokeChallenge = () =>
          partialRevocationClient.query(
            `
              UPDATE public.desafios_autenticacao
              SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                  motivo_encerramento = 'bootstrap_email_corrigido'
              WHERE id = $1
            `,
            [current.desafio_id],
          );
        try {
          if (order === 'convite_primeiro') {
            await revokeInvitation();
            await revokeChallenge();
          } else {
            await revokeChallenge();
            await revokeInvitation();
          }
          await partialRevocationClient.query(
            `
              UPDATE public.outbox_email
              SET status = 'cancelado', payload_cifrado = NULL, nonce = NULL,
                  tag_autenticacao = NULL, bloqueado_em = NULL,
                  bloqueado_por = NULL, lease_token = NULL,
                  lease_expira_em = NULL,
                  encerrado_em = pg_catalog.clock_timestamp(),
                  erro_categoria = 'challenge_revoked'
              WHERE desafio_id = $1 AND status IN ('pendente', 'processando')
            `,
            [current.desafio_id],
          );
          await assert.rejects(
            partialRevocationClient.query('COMMIT'),
            /convite corrente completo|estado_final_completo/i,
          );
          await partialRevocationClient.query('ROLLBACK');
        } finally {
          partialRevocationClient.release();
        }
      }
    } finally {
      await platformBootstrap.pool.end();
      await requirePool().query(
        `DROP ROLE IF EXISTS ${platformBootstrap.loginRole}`,
      );
    }
    assert.ok(initialized);
    assert.ok(corrected);
    const invitation = new InvitationService({
      repository: new PostgresInvitationRepository(postgresOptions()),
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    await invitation.accept({
      token: await tokenForChallenge(corrected.challengeId),
      password: 'SenhaBootstrap1',
    });
    bootstrapAdminUserId = initialized.adminUserId;
  });

  after(async () => {
    await pool?.end();
    await testDatabase?.container.stop();
  });

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
  }

  function postgresOptions(databasePool: Pool = requirePool()) {
    return { pool: databasePool, ...repositoryKeys };
  }

  async function createLoginPoolForRole(role: string): Promise<{
    readonly pool: Pool;
    readonly loginRole: string;
  }> {
    assert.ok(testDatabase);
    assert.match(role, /^tche_agro_(?:runtime|platform_ops|outbox_worker)$/u);
    const loginRole = `tche_test_${role.slice('tche_agro_'.length)}_${randomUUID().replaceAll('-', '')}`;
    const password = randomBytes(24).toString('hex');
    await requirePool().query(
      `CREATE ROLE ${loginRole} LOGIN PASSWORD '${password}'`,
    );
    await requirePool().query(`GRANT ${role} TO ${loginRole}`);
    const connectionUrl = new URL(testDatabase.connectionString);
    connectionUrl.username = loginRole;
    connectionUrl.password = password;
    const rolePool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: connectionUrl.toString(),
      application_name: loginRole,
    });
    return { pool: rolePool, loginRole };
  }

  async function seedUser(input: {
    profile: 'admin' | 'colaborador' | 'produtor';
    status?: 'ativo' | 'pendente';
    withCredential?: boolean;
  }): Promise<{ id: string; email: string }> {
    const id = randomUUID();
    const email = `${input.profile}-${id}@example.test`;
    await requirePool().query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        id,
        ORGANIZATION_ID,
        `Usuário ${input.profile}`,
        email,
        input.profile,
        input.status ?? 'ativo',
      ],
    );
    if (input.withCredential ?? input.status !== 'pendente') {
      await requirePool().query(
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, id, phcFor('SenhaAtual1')],
      );
    }
    return { id, email };
  }

  async function seedSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date();
    await requirePool().query(
      `
        INSERT INTO public.sessoes_autenticacao (
          id, organizacao_id, usuario_id, versao_autorizacao,
          criada_em, ultima_renovacao_em,
          expira_inatividade_em, expira_absolutamente_em
        ) VALUES ($1, $2, $3, 1, $4, $4, $5, $6)
      `,
      [
        sessionId,
        ORGANIZATION_ID,
        userId,
        now,
        new Date(now.getTime() + 60 * 60_000),
        new Date(now.getTime() + 24 * 60 * 60_000),
      ],
    );
    await requirePool().query(
      `
        INSERT INTO public.tokens_acesso (
          organizacao_id, sessao_id, token_hash, versao_autorizacao, expira_em
        ) VALUES ($1, $2, $3, 1, $4)
      `,
      [ORGANIZATION_ID, sessionId, randomBytes(32), new Date(now.getTime() + 900_000)],
    );
    await requirePool().query(
      `
        INSERT INTO public.tokens_refresh (
          organizacao_id, sessao_id, token_hash, expira_em
        ) VALUES ($1, $2, $3, $4)
      `,
      [
        ORGANIZATION_ID,
        sessionId,
        randomBytes(32),
        new Date(now.getTime() + 24 * 60 * 60_000),
      ],
    );
    return sessionId;
  }

  async function tokenForChallenge(challengeId: string): Promise<string> {
    const outbox = await requirePool().query<OutboxPayloadRow>(
      `
        SELECT id, organizacao_id, tipo_mensagem, chave_id, nonce,
               payload_cifrado, tag_autenticacao
        FROM public.outbox_email
        WHERE organizacao_id = $1 AND desafio_id = $2
        ORDER BY criado_em DESC LIMIT 1
      `,
      [ORGANIZATION_ID, challengeId],
    );
    const row = outbox.rows[0];
    assert.ok(row);
    const envelope: EncryptedOutboxPayload = {
      version: 1,
      algorithm: 'aes-256-gcm',
      keyId: row.chave_id,
      iv: row.nonce.toString('base64url'),
      ciphertext: row.payload_cifrado.toString('base64url'),
      authenticationTag: row.tag_autenticacao.toString('base64url'),
    };
    const payload = cipher.decrypt(envelope, {
      organizationId: row.organizacao_id,
      messageId: row.id,
      messageType: row.tipo_mensagem,
    });
    const text = payload.text;
    assert.equal(typeof text, 'string');
    if (typeof text !== 'string') throw new TypeError('Invalid e-mail fixture.');
    const match = /[?&#]token=([A-Za-z0-9_-]{43})(?:&|\s|$)/u.exec(text);
    assert.ok(match?.[1]);
    return match[1];
  }

  async function activeChallenge(
    userId: string,
    purpose: string,
  ): Promise<{ id: string }> {
    const challenge = await requirePool().query<{ id: string }>(
      `
        SELECT id FROM public.desafios_autenticacao
        WHERE organizacao_id = $1 AND usuario_id = $2
          AND finalidade = $3 AND status = 'ativo'
        ORDER BY criado_em DESC LIMIT 1
      `,
      [ORGANIZATION_ID, userId, purpose],
    );
    assert.ok(challenge.rows[0]);
    return challenge.rows[0];
  }

  test('invitation is atomic and the same token is accepted once under concurrency', async () => {
    const admin = await seedUser({ profile: 'admin' });
    const adminSessionId = await seedSession(admin.id);
    const pending = await seedUser({
      profile: 'colaborador',
      status: 'pendente',
      withCredential: false,
    });
    const service = new InvitationService({
      repository: new PostgresInvitationRepository(postgresOptions()),
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const issued = await service.issueForExistingPendingUser({
      organizationId: ORGANIZATION_ID,
      actorAdminUserId: admin.id,
      actorSessionId: adminSessionId,
      userId: pending.id,
    });
    const token = await tokenForChallenge(issued.challengeId);
    const attempts = await Promise.allSettled([
      service.accept({ token, password: 'SenhaNova1' }),
      service.accept({ token, password: 'SenhaNova1' }),
    ]);
    assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
    const state = await requirePool().query<{ credentials: string; accepted: string }>(
      `
        SELECT
          (SELECT count(*)::text FROM public.credenciais_usuario
           WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'ativa') AS credentials,
          (SELECT count(*)::text FROM public.convites_usuario
           WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'aceito') AS accepted
      `,
      [ORGANIZATION_ID, pending.id],
    );
    assert.deepEqual(state.rows[0], { credentials: '1', accepted: '1' });
  });

  test('primary e-mail change requires both addresses and revokes all active grants', async () => {
    const user = await seedUser({ profile: 'colaborador' });
    const sessionId = await seedSession(user.id);
    const repository = new PostgresPrimaryEmailChangeRepository(postgresOptions());
    const service = new PrimaryEmailChangeService({
      repository,
      passwordVerifier: new PostgresPrimaryEmailPasswordVerifier({
        pool: requirePool(),
        passwordCredentials: credentials,
      }),
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const requested = await service.request({
      organizationId: ORGANIZATION_ID,
      authenticatedUserId: user.id,
      authenticatedSessionId: sessionId,
      currentPassword: 'SenhaAtual1',
      newEmail: `new-${user.id}@example.test`,
    });
    await service.confirmCurrentAddress({
      token: await tokenForChallenge(requested.challengeId),
    });
    const newChallenge = await activeChallenge(user.id, 'confirmacao_email_novo');
    await service.confirmNewAddress({ token: await tokenForChallenge(newChallenge.id) });

    const account = await requirePool().query<{
      email: string;
      versao_autorizacao: string;
      session_status: string;
      access_status: string;
      refresh_status: string;
    }>(
      `
        SELECT usuario.email, usuario.versao_autorizacao::text,
               sessao.status AS session_status,
               acesso.status AS access_status, refresh.status AS refresh_status
        FROM public.usuarios AS usuario
        JOIN public.sessoes_autenticacao AS sessao ON sessao.id = $3
        JOIN public.tokens_acesso AS acesso ON acesso.sessao_id = sessao.id
        JOIN public.tokens_refresh AS refresh ON refresh.sessao_id = sessao.id
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [ORGANIZATION_ID, user.id, sessionId],
    );
    assert.equal(account.rows[0]?.email, `new-${user.id}@example.test`);
    assert.equal(account.rows[0]?.versao_autorizacao, '2');
    assert.equal(account.rows[0]?.session_status, 'revogada');
    assert.equal(account.rows[0]?.access_status, 'revogado');
    assert.equal(account.rows[0]?.refresh_status, 'revogado');

    const publicConfirmationAudit = await requirePool().query<{
      evento: string;
      ator_tipo: string;
      ator_usuario_id: string | null;
      sessao_id: string | null;
      usuario_afetado_id: string | null;
    }>(
      `
        SELECT evento, ator_tipo, ator_usuario_id, sessao_id, usuario_afetado_id
        FROM public.eventos_auditoria
        WHERE organizacao_id = $1
          AND usuario_afetado_id = $2
          AND evento IN (
            'auth.email_principal.endereco_atual_confirmado',
            'auth.email_principal.alterado'
          )
        ORDER BY evento
      `,
      [ORGANIZATION_ID, user.id],
    );
    assert.equal(publicConfirmationAudit.rowCount, 2);
    for (const audit of publicConfirmationAudit.rows) {
      assert.equal(audit.ator_tipo, 'sistema');
      assert.equal(audit.ator_usuario_id, null);
      assert.equal(audit.sessao_id, null);
      assert.equal(audit.usuario_afetado_id, user.id);
    }
  });

  test('Admin secondary recovery performs both confirmations before password reset', async () => {
    const admin = await seedUser({ profile: 'admin' });
    const oldSessionId = await seedSession(admin.id);
    const secondaryEmail = `secondary-${admin.id}@example.test`;
    const secondaryEmailService = new SecondaryEmailService({
      repository: new PostgresSecondaryEmailRepository(postgresOptions()),
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const secondaryVerification = await secondaryEmailService.requestVerification({
      organizationId: ORGANIZATION_ID,
      authenticatedUserId: admin.id,
      actorSessionId: oldSessionId,
      newEmail: secondaryEmail,
    });
    await secondaryEmailService.confirm({
      token: await tokenForChallenge(secondaryVerification.challengeId),
    });
    const secondaryConfirmationAudit = await requirePool().query<{
      ator_tipo: string;
      ator_usuario_id: string | null;
      sessao_id: string | null;
      usuario_afetado_id: string | null;
    }>(
      `
        SELECT ator_tipo, ator_usuario_id, sessao_id, usuario_afetado_id
        FROM public.eventos_auditoria
        WHERE organizacao_id = $1
          AND usuario_afetado_id = $2
          AND evento = 'auth.email_secundario.verificado'
        ORDER BY ocorrido_em DESC
        LIMIT 1
      `,
      [ORGANIZATION_ID, admin.id],
    );
    assert.deepEqual(secondaryConfirmationAudit.rows[0], {
      ator_tipo: 'sistema',
      ator_usuario_id: null,
      sessao_id: null,
      usuario_afetado_id: admin.id,
    });
    const repository = new PostgresAdminSecondaryRecoveryRepository(
      postgresOptions(),
    );
    const service = new AdminSecondaryRecoveryService({
      repository,
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
      throttle: new PostgresLoginThrottle({ pool: requirePool() }),
      abuseProtection: authenticationConfig.abuseProtection,
    });
    const newEmail = `recovered-${admin.id}@example.test`;
    await service.request({
      secondaryEmail,
      newPrimaryEmail: newEmail,
      ipAddress: '198.51.100.42',
    });
    const secondaryChallenge = await activeChallenge(
      admin.id,
      'recuperacao_admin_secundario',
    );
    await service.confirmSecondaryAddress({
      token: await tokenForChallenge(secondaryChallenge.id),
    });
    const newPrimaryChallenge = await activeChallenge(
      admin.id,
      'recuperacao_admin_email_novo',
    );
    const restricted = await service.confirmNewPrimaryAddress({
      token: await tokenForChallenge(newPrimaryChallenge.id),
    });
    await service.complete({ token: restricted.token, newPassword: 'SenhaNova2' });
    const state = await requirePool().query<{
      email: string;
      senha_phc: string;
      session_status: string;
      recovery_status: string;
    }>(
      `
        SELECT usuario.email, credencial.senha_phc,
               sessao.status AS session_status,
               recuperacao.status AS recovery_status
        FROM public.usuarios AS usuario
        JOIN public.credenciais_usuario AS credencial
          ON credencial.organizacao_id = usuario.organizacao_id
         AND credencial.usuario_id = usuario.id
        JOIN public.sessoes_autenticacao AS sessao ON sessao.id = $3
        JOIN public.recuperacoes_admin_email_secundario AS recuperacao
          ON recuperacao.organizacao_id = usuario.organizacao_id
         AND recuperacao.usuario_admin_id = usuario.id
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [ORGANIZATION_ID, admin.id, oldSessionId],
    );
    assert.equal(state.rows[0]?.email, newEmail);
    assert.equal(state.rows[0]?.senha_phc, phcFor('SenhaNova2'));
    assert.equal(state.rows[0]?.session_status, 'revogada');
    assert.equal(state.rows[0]?.recovery_status, 'concluida');
  });

  test('platform cannot mint break-glass and runtime only continues an owner fixture by one-time tokens', async () => {
    const runtime = await createLoginPoolForRole('tche_agro_runtime');
    const platform = await createLoginPoolForRole('tche_agro_platform_ops');
    try {
      const runtimeRole = await runtime.pool.query<{
        inherited: boolean;
      }>(
        `SELECT pg_has_role(current_user, 'tche_agro_runtime', 'USAGE') AS inherited`,
      );
      assert.equal(runtimeRole.rows[0]?.inherited, true);

      assert.ok(bootstrapAdminUserId);
      const targetAdminUserId = bootstrapAdminUserId;
      const oldSessionId = await seedSession(targetAdminUserId);

      const newEmail = `break-glass-${targetAdminUserId}@example.test`;
      const verifier: BreakGlassAuthorizationVerifier = {
        async verify(input) {
          return {
            authorizationId: `authorization-${input.externalCaseReference}`,
            policyVersion: 'integration-break-glass-v1',
            organizationId: input.organizationId,
            targetUserId: input.targetUserId,
            pendingNormalizedEmail: input.pendingNormalizedEmail,
            externalCaseReference: input.externalCaseReference,
            approverIds: ['platform-approver-a', 'platform-approver-b'],
            expiresAt: new Date(input.now.getTime() + 30 * 60_000),
          };
        },
      };
      const platformStart = new AdminBreakGlassCliService({
        enabled: true,
        verifier,
        repository: new PostgresAdminBreakGlassRepository(
          postgresOptions(platform.pool),
        ),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      await assert.rejects(
        platformStart.start({
          authorizationArtifact: 'integration-platform-denied',
          organizationId: ORGANIZATION_ID,
          targetAdminUserId,
          newEmail: `denied-${targetAdminUserId}@example.test`,
          externalCaseReference: `CASE-${targetAdminUserId}-DENIED`,
        }),
      );

      // Owner-only fixture: production platform credentials intentionally lack
      // this DML until the database can validate an external attestation.
      const start = new AdminBreakGlassCliService({
        enabled: true,
        verifier,
        repository: new PostgresAdminBreakGlassRepository(postgresOptions()),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      const superseded = await start.start({
        authorizationArtifact: 'integration-platform-authorization-first',
        organizationId: ORGANIZATION_ID,
        targetAdminUserId,
        newEmail: `superseded-${targetAdminUserId}@example.test`,
        externalCaseReference: `CASE-${targetAdminUserId}-FIRST`,
      });
      const started = await start.start({
        authorizationArtifact: 'integration-platform-authorization',
        organizationId: ORGANIZATION_ID,
        targetAdminUserId,
        newEmail,
        externalCaseReference: `CASE-${targetAdminUserId}-SECOND`,
      });
      const supersededState = await requirePool().query<{
        recovery_status: string;
        challenge_status: string;
        pending_outbox: string;
      }>(
        `
          SELECT recuperacao.status AS recovery_status,
                 desafio.status AS challenge_status,
                 (SELECT count(*)::text FROM public.outbox_email AS mensagem
                  WHERE mensagem.desafio_id = recuperacao.desafio_email_id
                    AND mensagem.status = 'pendente') AS pending_outbox
          FROM public.recuperacoes_assistidas AS recuperacao
          JOIN public.desafios_autenticacao AS desafio
            ON desafio.organizacao_id = recuperacao.organizacao_id
           AND desafio.id = recuperacao.desafio_email_id
          WHERE recuperacao.id = $1
        `,
        [superseded.recoveryId],
      );
      assert.deepEqual(supersededState.rows[0], {
        recovery_status: 'cancelada',
        challenge_status: 'revogado',
        pending_outbox: '0',
      });
      const emailChallenge = await activeChallenge(
        targetAdminUserId,
        'recuperacao_assistida',
      );

      const continuation = new AdminBreakGlassContinuationService({
        repository: new PostgresAdminBreakGlassRepository(
          postgresOptions(runtime.pool),
        ),
        passwordCredentials: credentials,
        emailOutbox,
      });
      const restricted = await continuation.confirmNewEmail({
        token: await tokenForChallenge(emailChallenge.id),
      });
      const completions = await Promise.allSettled([
        continuation.complete({
          token: restricted.token,
          newPassword: 'SenhaBreakGlass2',
        }),
        continuation.complete({
          token: restricted.token,
          newPassword: 'SenhaBreakGlass2',
        }),
      ]);
      assert.equal(
        completions.filter((item) => item.status === 'fulfilled').length,
        1,
      );

      const state = await requirePool().query<{
        email: string;
        senha_phc: string;
        recovery_status: string;
        authorization_status: string;
        session_status: string;
        active_sessions: string;
        audits: string;
      }>(
        `
          SELECT usuario.email, credencial.senha_phc,
                 recuperacao.status AS recovery_status,
                 autorizacao.status AS authorization_status,
                 sessao.status AS session_status,
                 (SELECT count(*)::text FROM public.sessoes_autenticacao AS ativa
                  WHERE ativa.organizacao_id = usuario.organizacao_id
                    AND ativa.usuario_id = usuario.id AND ativa.status = 'ativa')
                   AS active_sessions,
                 (SELECT count(*)::text FROM public.eventos_auditoria AS evento
                  WHERE evento.recurso_id = recuperacao.id::text) AS audits
          FROM public.recuperacoes_assistidas AS recuperacao
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id AND credencial.status = 'ativa'
          JOIN public.autorizacoes_restritas AS autorizacao
            ON autorizacao.organizacao_id = recuperacao.organizacao_id
           AND autorizacao.id = recuperacao.autorizacao_restrita_id
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.organizacao_id = usuario.organizacao_id
           AND sessao.id = $2
          WHERE recuperacao.id = $1
        `,
        [started.recoveryId, oldSessionId],
      );
      assert.equal(state.rows[0]?.email, newEmail);
      assert.equal(state.rows[0]?.senha_phc, phcFor('SenhaBreakGlass2'));
      assert.equal(state.rows[0]?.recovery_status, 'concluida');
      assert.equal(state.rows[0]?.authorization_status, 'consumida');
      assert.equal(state.rows[0]?.session_status, 'revogada');
      assert.equal(state.rows[0]?.active_sessions, '0');
      assert.equal(Number(state.rows[0]?.audits), 3);

      const breakGlassAudits = await requirePool().query<{
        evento: string;
        ator_tipo: string;
        ator_usuario_id: string | null;
        sessao_id: string | null;
      }>(`
        SELECT evento, ator_tipo, ator_usuario_id, sessao_id
        FROM public.eventos_auditoria
        WHERE recurso_id = $1
        ORDER BY evento
      `, [started.recoveryId]);
      assert.deepEqual(breakGlassAudits.rows, [
        {
          evento: 'auth.recuperacao_admin.break_glass_concluida',
          ator_tipo: 'sistema',
          ator_usuario_id: null,
          sessao_id: null,
        },
        {
          evento: 'auth.recuperacao_admin.break_glass_iniciada',
          ator_tipo: 'plataforma',
          ator_usuario_id: null,
          sessao_id: null,
        },
        {
          evento: 'auth.recuperacao_admin.email_confirmado',
          ator_tipo: 'sistema',
          ator_usuario_id: null,
          sessao_id: null,
        },
      ]);

      await assert.rejects(
        runtime.pool.query(
          `
            INSERT INTO public.recuperacoes_assistidas (
              organizacao_id, usuario_id, perfil_alvo, origem, novo_email,
              categoria_motivo, referencia_externa, autorizacao_plataforma_id,
              aprovadores_plataforma, aprovacoes_necessarias, expira_em
            ) VALUES (
              $1, $2, 'admin', 'plataforma_cli', $3,
              'runtime_must_not_start', 'RUNTIME-FORGED-CASE',
              'forged-authorization', '["forged-a", "forged-b"]'::jsonb,
              0, clock_timestamp() + interval '30 minutes'
            )
          `,
          [
            ORGANIZATION_ID,
            targetAdminUserId,
            `runtime-forged-${targetAdminUserId}@example.test`,
          ],
        ),
        /permission denied|runtime nao pode operar recuperacao da plataforma/i,
      );
    } finally {
      await Promise.allSettled([runtime.pool.end(), platform.pool.end()]);
      await requirePool().query(`DROP ROLE IF EXISTS ${runtime.loginRole}`);
      await requirePool().query(`DROP ROLE IF EXISTS ${platform.loginRole}`);
    }
  });

  test('assisted non-Admin recovery is same-org, audited and consumes authorization once', async () => {
    const admin = await seedUser({ profile: 'admin' });
    const adminSessionId = await seedSession(admin.id);
    const target = await seedUser({ profile: 'produtor' });
    await seedSession(target.id);
    const repository = new PostgresAssistedRecoveryRepository(postgresOptions());
    const service = new AssistedRecoveryService({
      repository,
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const newEmail = `assisted-${target.id}@example.test`;
    const started = await service.startByAdministrator({
      organizationId: ORGANIZATION_ID,
      actorAdminUserId: admin.id,
      actorSessionId: adminSessionId,
      targetUserId: target.id,
      newEmail,
      reasonCode: 'other_verified_case',
      externalCaseReference: `CASE-${target.id}`,
    });
    const recovery = await requirePool().query<{ desafio_email_id: string }>(
      `SELECT desafio_email_id FROM public.recuperacoes_assistidas WHERE id = $1`,
      [started.recoveryId],
    );
    const challengeId = recovery.rows[0]?.desafio_email_id;
    assert.ok(challengeId);
    const privilegedAudits = await requirePool().query<{
      ator_usuario_id: string;
      sessao_id: string;
      usuario_afetado_id: string;
    }>(`
      SELECT ator_usuario_id, sessao_id, usuario_afetado_id
      FROM public.eventos_auditoria
      WHERE recurso_id = $1
        AND evento IN (
          'auth.recuperacao_assistida.solicitada',
          'auth.recuperacao_assistida.aprovada'
        )
      ORDER BY evento
    `, [started.recoveryId]);
    assert.equal(privilegedAudits.rowCount, 2);
    for (const audit of privilegedAudits.rows) {
      assert.deepEqual(audit, {
        ator_usuario_id: admin.id,
        sessao_id: adminSessionId,
        usuario_afetado_id: target.id,
      });
    }
    const restricted = await service.confirmNewEmail({
      token: await tokenForChallenge(challengeId),
    });
    const completions = await Promise.allSettled([
      service.complete({ token: restricted.token, newPassword: 'SenhaNova3' }),
      service.complete({ token: restricted.token, newPassword: 'SenhaNova3' }),
    ]);
    assert.equal(completions.filter((item) => item.status === 'fulfilled').length, 1);
    const state = await requirePool().query<{
      email: string;
      recovery_status: string;
      authorization_status: string;
      approvals: string;
      audits: string;
    }>(
      `
        SELECT usuario.email, recuperacao.status AS recovery_status,
               autorizacao.status AS authorization_status,
               (SELECT count(*)::text FROM public.aprovacoes_recuperacao_assistida
                WHERE recuperacao_id = recuperacao.id AND status = 'ativa') AS approvals,
               (SELECT count(*)::text FROM public.eventos_auditoria
                WHERE recurso_id = recuperacao.id::text) AS audits
        FROM public.recuperacoes_assistidas AS recuperacao
        JOIN public.usuarios AS usuario
          ON usuario.organizacao_id = recuperacao.organizacao_id
         AND usuario.id = recuperacao.usuario_id
        JOIN public.autorizacoes_restritas AS autorizacao
          ON autorizacao.organizacao_id = recuperacao.organizacao_id
         AND autorizacao.id = recuperacao.autorizacao_restrita_id
        WHERE recuperacao.id = $1
      `,
      [started.recoveryId],
    );
    assert.equal(state.rows[0]?.email, newEmail);
    assert.equal(state.rows[0]?.recovery_status, 'concluida');
    assert.equal(state.rows[0]?.authorization_status, 'consumida');
    assert.equal(state.rows[0]?.approvals, '1');
    assert.equal(Number(state.rows[0]?.audits), 4);
  });

  test('falha da notificação reverte os três fatos transacionais de AccountAction', async () => {
    let writerCalls = 0;
    const notificationWriter: AccountNotificationWriter = {
      async create() {
        writerCalls += 1;
        throw new Error('notification-writer-injected-failure');
      },
    };
    const failingOptions = () => ({
      ...postgresOptions(),
      notificationWriter,
    });
    const assertServiceUnavailable = (error: unknown) =>
      error instanceof HttpError && error.code === 'service_unavailable';

    const emailUser = await seedUser({ profile: 'colaborador' });
    const emailSessionId = await seedSession(emailUser.id);
    const emailService = new PrimaryEmailChangeService({
      repository: new PostgresPrimaryEmailChangeRepository(failingOptions()),
      passwordVerifier: new PostgresPrimaryEmailPasswordVerifier({
        pool: requirePool(),
        passwordCredentials: credentials,
      }),
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const pendingEmail = `rollback-primary-${emailUser.id}@example.test`;
    const emailRequest = await emailService.request({
      organizationId: ORGANIZATION_ID,
      authenticatedUserId: emailUser.id,
      authenticatedSessionId: emailSessionId,
      currentPassword: 'SenhaAtual1',
      newEmail: pendingEmail,
    });
    await emailService.confirmCurrentAddress({
      token: await tokenForChallenge(emailRequest.challengeId),
    });
    const pendingEmailChallenge = await activeChallenge(
      emailUser.id,
      'confirmacao_email_novo',
    );
    await assert.rejects(
      emailService.confirmNewAddress({
        token: await tokenForChallenge(pendingEmailChallenge.id),
      }),
      assertServiceUnavailable,
    );
    const emailState = await requirePool().query<{
      email: string;
      versao_autorizacao: string;
      session_status: string;
      request_status: string;
      challenge_status: string;
      completion_audits: string;
      notifications: string;
    }>(
      `
        SELECT usuario.email, usuario.versao_autorizacao::text,
               sessao.status AS session_status,
               solicitacao.status AS request_status,
               desafio.status AS challenge_status,
               (SELECT count(*)::text FROM public.eventos_auditoria
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_afetado_id = usuario.id
                  AND evento = 'auth.email_principal.alterado') AS completion_audits,
               (SELECT count(*)::text FROM public.notificacao_entrega
                WHERE organizacao_id = usuario.organizacao_id
                  AND destinatario_usuario_id = usuario.id) AS notifications
        FROM public.usuarios AS usuario
        JOIN public.sessoes_autenticacao AS sessao
          ON sessao.organizacao_id = usuario.organizacao_id
         AND sessao.id = $3
        JOIN public.solicitacoes_alteracao_email AS solicitacao
          ON solicitacao.organizacao_id = usuario.organizacao_id
         AND solicitacao.usuario_id = usuario.id
        JOIN public.desafios_autenticacao AS desafio
          ON desafio.organizacao_id = solicitacao.organizacao_id
         AND desafio.id = solicitacao.desafio_email_novo_id
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [ORGANIZATION_ID, emailUser.id, emailSessionId],
    );
    assert.deepEqual(emailState.rows[0], {
      email: emailUser.email,
      versao_autorizacao: '1',
      session_status: 'ativa',
      request_status: 'aguardando_confirmacao_novo',
      challenge_status: 'ativo',
      completion_audits: '0',
      notifications: '0',
    });

    const secondaryAdmin = await seedUser({ profile: 'admin' });
    const secondaryAdminSessionId = await seedSession(secondaryAdmin.id);
    const verifiedSecondaryEmail =
      `rollback-secondary-${secondaryAdmin.id}@example.test`;
    const secondaryEmailService = new SecondaryEmailService({
      repository: new PostgresSecondaryEmailRepository(postgresOptions()),
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const secondaryVerification =
      await secondaryEmailService.requestVerification({
        organizationId: ORGANIZATION_ID,
        authenticatedUserId: secondaryAdmin.id,
        actorSessionId: secondaryAdminSessionId,
        newEmail: verifiedSecondaryEmail,
      });
    await secondaryEmailService.confirm({
      token: await tokenForChallenge(secondaryVerification.challengeId),
    });
    const secondaryRecovery = new AdminSecondaryRecoveryService({
      repository: new PostgresAdminSecondaryRecoveryRepository(
        failingOptions(),
      ),
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
      throttle: new PostgresLoginThrottle({ pool: requirePool() }),
      abuseProtection: authenticationConfig.abuseProtection,
    });
    const recoveredAdminEmail =
      `rollback-recovered-${secondaryAdmin.id}@example.test`;
    await secondaryRecovery.request({
      secondaryEmail: verifiedSecondaryEmail,
      newPrimaryEmail: recoveredAdminEmail,
      ipAddress: '198.51.100.77',
    });
    const secondaryRecoveryChallenge = await activeChallenge(
      secondaryAdmin.id,
      'recuperacao_admin_secundario',
    );
    await secondaryRecovery.confirmSecondaryAddress({
      token: await tokenForChallenge(secondaryRecoveryChallenge.id),
    });
    const recoveredEmailChallenge = await activeChallenge(
      secondaryAdmin.id,
      'recuperacao_admin_email_novo',
    );
    const secondaryRestricted =
      await secondaryRecovery.confirmNewPrimaryAddress({
        token: await tokenForChallenge(recoveredEmailChallenge.id),
      });
    await assert.rejects(
      secondaryRecovery.complete({
        token: secondaryRestricted.token,
        newPassword: 'SenhaRollbackAdmin2',
      }),
      assertServiceUnavailable,
    );
    const secondaryState = await requirePool().query<{
      email: string;
      versao_autorizacao: string;
      senha_phc: string;
      session_status: string;
      recovery_status: string;
      authorization_status: string;
      completion_audits: string;
      notifications: string;
    }>(
      `
        SELECT usuario.email, usuario.versao_autorizacao::text,
               credencial.senha_phc, sessao.status AS session_status,
               recuperacao.status AS recovery_status,
               autorizacao.status AS authorization_status,
               (SELECT count(*)::text FROM public.eventos_auditoria
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_afetado_id = usuario.id
                  AND evento = 'auth.recuperacao_admin.concluida') AS completion_audits,
               (SELECT count(*)::text FROM public.notificacao_entrega
                WHERE organizacao_id = usuario.organizacao_id
                  AND destinatario_usuario_id = usuario.id) AS notifications
        FROM public.usuarios AS usuario
        JOIN public.credenciais_usuario AS credencial
          ON credencial.organizacao_id = usuario.organizacao_id
         AND credencial.usuario_id = usuario.id
        JOIN public.sessoes_autenticacao AS sessao
          ON sessao.organizacao_id = usuario.organizacao_id
         AND sessao.id = $3
        JOIN public.recuperacoes_admin_email_secundario AS recuperacao
          ON recuperacao.organizacao_id = usuario.organizacao_id
         AND recuperacao.usuario_admin_id = usuario.id
        JOIN public.autorizacoes_restritas AS autorizacao
          ON autorizacao.organizacao_id = recuperacao.organizacao_id
         AND autorizacao.id = recuperacao.autorizacao_restrita_id
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [ORGANIZATION_ID, secondaryAdmin.id, secondaryAdminSessionId],
    );
    assert.deepEqual(secondaryState.rows[0], {
      email: secondaryAdmin.email,
      versao_autorizacao: '1',
      senha_phc: phcFor('SenhaAtual1'),
      session_status: 'ativa',
      recovery_status: 'aguardando_nova_senha',
      authorization_status: 'ativa',
      completion_audits: '0',
      notifications: '0',
    });

    const assistedAdmin = await seedUser({ profile: 'admin' });
    const assistedAdminSessionId = await seedSession(assistedAdmin.id);
    const assistedTarget = await seedUser({ profile: 'produtor' });
    const assistedTargetSessionId = await seedSession(assistedTarget.id);
    const assistedRecovery = new AssistedRecoveryService({
      repository: new PostgresAssistedRecoveryRepository(failingOptions()),
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const assistedPendingEmail =
      `rollback-assisted-${assistedTarget.id}@example.test`;
    const assistedStarted = await assistedRecovery.startByAdministrator({
      organizationId: ORGANIZATION_ID,
      actorAdminUserId: assistedAdmin.id,
      actorSessionId: assistedAdminSessionId,
      targetUserId: assistedTarget.id,
      newEmail: assistedPendingEmail,
      reasonCode: 'other_verified_case',
      externalCaseReference: `ROLLBACK-${assistedTarget.id}`,
    });
    const assistedChallenge = await requirePool().query<{
      desafio_email_id: string;
    }>(
      `SELECT desafio_email_id FROM public.recuperacoes_assistidas WHERE id = $1`,
      [assistedStarted.recoveryId],
    );
    const assistedChallengeId = assistedChallenge.rows[0]?.desafio_email_id;
    assert.ok(assistedChallengeId);
    const assistedRestricted = await assistedRecovery.confirmNewEmail({
      token: await tokenForChallenge(assistedChallengeId),
    });
    await assert.rejects(
      assistedRecovery.complete({
        token: assistedRestricted.token,
        newPassword: 'SenhaRollbackAssisted2',
      }),
      assertServiceUnavailable,
    );
    const assistedState = await requirePool().query<{
      email: string;
      versao_autorizacao: string;
      senha_phc: string;
      session_status: string;
      recovery_status: string;
      authorization_status: string;
      completion_audits: string;
      notifications: string;
    }>(
      `
        SELECT usuario.email, usuario.versao_autorizacao::text,
               credencial.senha_phc, sessao.status AS session_status,
               recuperacao.status AS recovery_status,
               autorizacao.status AS authorization_status,
               (SELECT count(*)::text FROM public.eventos_auditoria
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_afetado_id = usuario.id
                  AND evento = 'auth.recuperacao_assistida.concluida') AS completion_audits,
               (SELECT count(*)::text FROM public.notificacao_entrega
                WHERE organizacao_id = usuario.organizacao_id
                  AND destinatario_usuario_id = usuario.id) AS notifications
        FROM public.usuarios AS usuario
        JOIN public.credenciais_usuario AS credencial
          ON credencial.organizacao_id = usuario.organizacao_id
         AND credencial.usuario_id = usuario.id
        JOIN public.sessoes_autenticacao AS sessao
          ON sessao.organizacao_id = usuario.organizacao_id
         AND sessao.id = $3
        JOIN public.recuperacoes_assistidas AS recuperacao
          ON recuperacao.organizacao_id = usuario.organizacao_id
         AND recuperacao.id = $4
        JOIN public.autorizacoes_restritas AS autorizacao
          ON autorizacao.organizacao_id = recuperacao.organizacao_id
         AND autorizacao.id = recuperacao.autorizacao_restrita_id
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [
        ORGANIZATION_ID,
        assistedTarget.id,
        assistedTargetSessionId,
        assistedStarted.recoveryId,
      ],
    );
    assert.deepEqual(assistedState.rows[0], {
      email: assistedTarget.email,
      versao_autorizacao: '1',
      senha_phc: phcFor('SenhaAtual1'),
      session_status: 'ativa',
      recovery_status: 'aguardando_nova_senha',
      authorization_status: 'ativa',
      completion_audits: '0',
      notifications: '0',
    });
    assert.equal(writerCalls, 3);
  });

  test('outbox workers claim disjoint leases and terminal delivery wipes ciphertext', async () => {
    const worker = await createLoginPoolForRole('tche_agro_outbox_worker');
    try {
      const repository = new PostgresOutboxRepository({ pool: worker.pool });
      const now = new Date();
      const [left, right] = await Promise.all([
        repository.claimReady({
          workerId: 'integration-worker-left',
          limit: 100,
          now,
          leaseExpiresAt: new Date(now.getTime() + 30_000),
        }),
        repository.claimReady({
          workerId: 'integration-worker-right',
          limit: 100,
          now,
          leaseExpiresAt: new Date(now.getTime() + 30_000),
        }),
      ]);
      const allIds = [...left, ...right].map((message) => message.id);
      assert.ok(allIds.length > 0);
      assert.equal(new Set(allIds).size, allIds.length);
      const delivered = [...left, ...right].find(
        (message) => message.challengeId === undefined,
      );
      assert.ok(delivered);
      const deliveredAt = new Date(now.getTime() + 1_000);
      assert.equal(await repository.markDelivered({
        messageId: delivered.id,
        leaseToken: delivered.leaseToken,
        deliveredAt,
        providerMessageId: 'integration-provider-id',
      }), true);
      assert.equal(await repository.markDelivered({
        messageId: delivered.id,
        leaseToken: delivered.leaseToken,
        deliveredAt,
      }), false);
      const row = await requirePool().query<{
        status: string;
        payload_cifrado: Buffer | null;
        nonce: Buffer | null;
        tag_autenticacao: Buffer | null;
        nonce_hash: Buffer;
      }>(
        `
          SELECT status, payload_cifrado, nonce, tag_autenticacao, nonce_hash
          FROM public.outbox_email WHERE id = $1
        `,
        [delivered.id],
      );
      assert.equal(row.rows[0]?.status, 'enviado');
      assert.equal(row.rows[0]?.payload_cifrado, null);
      assert.equal(row.rows[0]?.nonce, null);
      assert.equal(row.rows[0]?.tag_autenticacao, null);
      assert.equal(row.rows[0]?.nonce_hash.byteLength, 32);
    } finally {
      await worker.pool.end();
      await requirePool().query(`DROP ROLE IF EXISTS ${worker.loginRole}`);
    }
  });
});
