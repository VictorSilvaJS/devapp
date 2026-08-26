import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import {
  InitialAdminBootstrapCliService,
  InvitationService,
  PostgresInitialAdminBootstrapRepository,
  PostgresInvitationRepository,
} from '../../src/account-actions/index.js';
import type { AuthenticationPasswordCredentialService } from '../../src/auth/password-credential.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import type { EncryptedOutboxPayload } from '../../src/outbox/contracts.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { hashActionToken } from '../../src/security/action-token.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';
const ACTION_URL = 'https://example.test/auth/action';

async function expectSqlState(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as Error & { readonly code?: string }).code, expectedCode);
    return true;
  });
}

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

describe('MP-35A upgrade e concorrência adversariais', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let pool: Pool | undefined;
  let adminUserId: string;
  let historicalUserId: string;
  let historicalToken: string;
  let historicalLinkId: string;
  const historicalUpdatedAt = new Date('2024-03-02T15:04:05.000Z');
  const cipher = new OutboxPayloadCipher({
    activeKeyId: 'mp35a-adversarial-key',
    keys: [{ id: 'mp35a-adversarial-key', key: Buffer.alloc(32, 0x51) }],
  });
  const emailOutbox = new EncryptedEmailOutboxFactory(cipher);
  const credentials = new FixturePasswordCredentials();
  const repositoryKeys = {
    emailHmacKey: Buffer.alloc(32, 0x52),
    externalReferenceHmacKey: Buffer.alloc(32, 0x53),
  };

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    testDatabase = await startPostgisTestDatabase();
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({
      command: 'up',
      count: 5,
      database: testDatabase.database,
    });
    pool = new Pool(buildPostgresPoolConfig(testDatabase.database));

    const platform = await createLoginPoolForRole('tche_agro_platform_ops');
    try {
      const bootstrap = new InitialAdminBootstrapCliService({
        enabled: true,
        repository: new PostgresInitialAdminBootstrapRepository(
          postgresOptions(platform.pool),
        ),
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      const initialized = await bootstrap.run({
        organizationId: ORGANIZATION_ID,
        name: 'Administrador do upgrade MP-35A',
        email: `upgrade-admin-${randomUUID()}@example.test`,
      });
      adminUserId = initialized.adminUserId;
      const invitation = new InvitationService({
        repository: new PostgresInvitationRepository(postgresOptions()),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      await invitation.accept({
        token: await tokenForChallenge(initialized.challengeId),
        password: 'SenhaUpgrade1',
      });
    } finally {
      await platform.pool.end();
      await requirePool().query(`DROP ROLE IF EXISTS ${platform.loginRole}`);
    }

    historicalUserId = randomUUID();
    historicalToken = `legacy-${randomBytes(24).toString('base64url')}`;
    const historicalChallengeId = randomUUID();
    await requirePool().query(`
      INSERT INTO public.usuarios (
        id, organizacao_id, nome, email, perfil, status
      ) VALUES ($1, $2, 'Convite histórico', $3, 'colaborador', 'pendente')
    `, [
      historicalUserId,
      ORGANIZATION_ID,
      `historico-${historicalUserId}@example.test`,
    ]);
    await requirePool().query(`
      INSERT INTO public.desafios_autenticacao (
        id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
      ) VALUES ($1, $2, $3, 'convite', $4, clock_timestamp() + interval '72 hours')
    `, [
      historicalChallengeId,
      ORGANIZATION_ID,
      historicalUserId,
      Buffer.from(hashActionToken(historicalToken), 'hex'),
    ]);
    await requirePool().query(`
      INSERT INTO public.convites_usuario (
        organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
        criado_por_usuario_id, expira_em
      ) VALUES ($1, $2, $3, 'admin', 'manter_status', $4,
        clock_timestamp() + interval '72 hours')
    `, [ORGANIZATION_ID, historicalUserId, historicalChallengeId, adminUserId]);

    const holderUserId = randomUUID();
    const holderId = randomUUID();
    const collaboratorId = randomUUID();
    const propertyId = randomUUID();
    historicalLinkId = randomUUID();
    const seed = await requirePool().connect();
    try {
      await seed.query('BEGIN');
      await seed.query(`
        INSERT INTO public.usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES
          ($1, $3, 'Titular histórico', $4, 'produtor', 'ativo'),
          ($2, $3, 'Colaborador histórico', $5, 'colaborador', 'ativo')
      `, [
        holderUserId,
        collaboratorId,
        ORGANIZATION_ID,
        `titular-historico-${holderUserId}@example.test`,
        `colaborador-historico-${collaboratorId}@example.test`,
      ]);
      await seed.query(`
        INSERT INTO public.produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1, $2, $3, 'Titular histórico', 'ativo')
      `, [holderId, ORGANIZATION_ID, holderUserId]);
      await seed.query(`
        INSERT INTO public.propriedades (
          id, organizacao_id, titular_id, nome,
          municipio_id, municipio_nome, uf_id, uf_sigla, status
        ) VALUES ($1, $2, $3, 'Propriedade histórica',
          '4305108', 'Porto Alegre', '43', 'RS', 'ativa')
      `, [propertyId, ORGANIZATION_ID, holderId]);
      await seed.query(`
        INSERT INTO public.usuario_propriedade (
          id, organizacao_id, usuario_id, propriedade_id, tipo_vinculo,
          status, motivo_inativacao, criado_em, atualizado_em
        ) VALUES ($1, $2, $3, $4, 'colaborador', 'inativo',
          'registro legado detalhado', $5, $5)
      `, [
        historicalLinkId,
        ORGANIZATION_ID,
        collaboratorId,
        propertyId,
        historicalUpdatedAt,
      ]);
      await seed.query('COMMIT');
    } finally {
      seed.release();
    }
  });

  after(async () => {
    await pool?.end();
    await testDatabase?.container.stop();
  });

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
  }

  function postgresOptions(databasePool = requirePool()) {
    return { pool: databasePool, ...repositoryKeys };
  }

  type OperationalRole =
    | 'tche_agro_platform_ops'
    | 'tche_agro_runtime'
    | 'tche_agro_administration_maintenance';

  async function createLoginPoolForRole(
    roleOrRoles: OperationalRole | readonly OperationalRole[],
  ) {
    assert.ok(testDatabase);
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    const loginRole = `tche_test_operational_${randomUUID().replaceAll('-', '')}`;
    const password = randomBytes(24).toString('hex');
    await requirePool().query(
      `CREATE ROLE ${loginRole} LOGIN PASSWORD '${password}'`,
    );
    await requirePool().query(`GRANT ${roles.join(', ')} TO ${loginRole}`);
    const connectionUrl = new URL(testDatabase.connectionString);
    connectionUrl.username = loginRole;
    connectionUrl.password = password;
    return {
      loginRole,
      pool: new Pool({
        ...buildPostgresPoolConfig(testDatabase.database),
        connectionString: connectionUrl.toString(),
      }),
    };
  }

  async function seedSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    await requirePool().query(`
      INSERT INTO public.sessoes_autenticacao (
        id, organizacao_id, usuario_id, versao_autorizacao,
        expira_inatividade_em, expira_absolutamente_em
      ) VALUES ($1, $2, $3, 1,
        clock_timestamp() + interval '1 day',
        clock_timestamp() + interval '2 days')
    `, [sessionId, ORGANIZATION_ID, userId]);
    return sessionId;
  }

  async function tokenForChallenge(challengeId: string): Promise<string> {
    const result = await requirePool().query<OutboxPayloadRow>(`
      SELECT id, organizacao_id, tipo_mensagem, chave_id, nonce,
             payload_cifrado, tag_autenticacao
      FROM public.outbox_email
      WHERE desafio_id = $1
      ORDER BY criado_em DESC LIMIT 1
    `, [challengeId]);
    const row = result.rows[0];
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
    assert.equal(typeof payload.text, 'string');
    const match = /[?&#]token=([A-Za-z0-9_-]{43})(?:&|\s|$)/u.exec(
      String(payload.text),
    );
    assert.ok(match?.[1]);
    return match[1];
  }

  async function waitUntilBlocked(
    pid: number,
    observerPool = requirePool(),
  ): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await observerPool.query<{
        wait_event_type: string | null;
        state: string;
      }>(`
        SELECT wait_event_type, state
        FROM pg_catalog.pg_stat_activity
        WHERE pid = $1
      `, [pid]);
      if (state.rows[0]?.wait_event_type === 'Lock') return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('A segunda conexão não alcançou a barreira de lock.');
  }

  async function rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A conexão pode já estar fora de uma transação após erro de COMMIT.
    }
  }

  test('upgrade 000005 -> 000006 falha atomicamente sem Admin ativo', async () => {
    await requirePool().query(
      "UPDATE public.usuarios SET status = 'inativo' WHERE id = $1",
      [adminUserId],
    );
    assert.ok(testDatabase);
    await assert.rejects(
      runMigrations({
        command: 'up',
        count: 1,
        database: testDatabase.database,
      }),
      /Bootstrap concluido sem Administrador ativo|dados_ultimo_admin/i,
    );
    const atomicState = await requirePool().query<{
      migration_count: number;
      reason_table: string | null;
      version_column_count: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM public.tche_agro_migrations) AS migration_count,
        to_regclass('public.motivos_administrativos')::text AS reason_table,
        (
          SELECT count(*)::integer
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'usuarios'
            AND column_name = 'versao'
        ) AS version_column_count
    `);
    assert.deepEqual(atomicState.rows[0], {
      migration_count: 5,
      reason_table: null,
      version_column_count: 0,
    });
  });

  test('upgrade preserva timestamps e convite histórico continua consumível', async () => {
    assert.ok(testDatabase);
    await requirePool().query(
      "UPDATE public.usuarios SET status = 'ativo' WHERE id = $1",
      [adminUserId],
    );
    await runMigrations({
      command: 'up',
      count: 1,
      database: testDatabase.database,
    });

    const link = await requirePool().query<{
      atualizado_em: Date;
      versao: string;
      motivo_inativacao_codigo: string;
      motivo_inativacao_detalhe: string;
    }>(`
      SELECT atualizado_em, versao::text, motivo_inativacao_codigo,
             motivo_inativacao_detalhe
      FROM public.usuario_propriedade
      WHERE id = $1
    `, [historicalLinkId]);
    assert.equal(
      link.rows[0]?.atualizado_em.toISOString(),
      historicalUpdatedAt.toISOString(),
    );
    assert.deepEqual(
      {
        versao: link.rows[0]?.versao,
        codigo: link.rows[0]?.motivo_inativacao_codigo,
        detalhe: link.rows[0]?.motivo_inativacao_detalhe,
      },
      {
        versao: '1',
        codigo: 'outro',
        detalhe: 'registro legado detalhado',
      },
    );

    const invitation = new InvitationService({
      repository: new PostgresInvitationRepository(postgresOptions()),
      passwordCredentials: credentials,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    await invitation.accept({
      token: historicalToken,
      password: 'SenhaHistorica1',
    });
    const historical = await requirePool().query<{
      user_status: string;
      invitation_status: string;
      activation_mode: string;
      credential_count: string;
    }>(`
      SELECT usuario.status AS user_status,
             convite.status AS invitation_status,
             convite.modo_ativacao AS activation_mode,
             count(credencial.id)::text AS credential_count
      FROM public.usuarios AS usuario
      JOIN public.convites_usuario AS convite
        ON convite.organizacao_id = usuario.organizacao_id
       AND convite.usuario_id = usuario.id
      LEFT JOIN public.credenciais_usuario AS credencial
        ON credencial.organizacao_id = usuario.organizacao_id
       AND credencial.usuario_id = usuario.id
       AND credencial.status = 'ativa'
      WHERE usuario.id = $1
      GROUP BY usuario.status, convite.status, convite.modo_ativacao
    `, [historicalUserId]);
    assert.deepEqual(historical.rows[0], {
      user_status: 'pendente',
      invitation_status: 'aceito',
      activation_mode: 'manter_status',
      credential_count: '1',
    });
  });

  test('runtime não ativa Usuario sem credencial', async () => {
    const pendingId = randomUUID();
    await requirePool().query(`
      INSERT INTO public.usuarios (
        id, organizacao_id, nome, email, perfil, status
      ) VALUES ($1, $2, 'Pendente sem credencial', $3, 'colaborador', 'pendente')
    `, [pendingId, ORGANIZATION_ID, `sem-credencial-${pendingId}@example.test`]);
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE tche_agro_runtime');
      await client.query(
        "UPDATE public.usuarios SET status = 'ativo' WHERE id = $1",
        [pendingId],
      );
      await assert.rejects(
        client.query('COMMIT'),
        /Ativar Usuario exige credencial|ativacao_exige_credencial/i,
      );
      await rollbackQuietly(client);
    } finally {
      client.release();
    }
    const state = await requirePool().query<{ status: string; versao: string }>(
      'SELECT status, versao::text FROM public.usuarios WHERE id = $1',
      [pendingId],
    );
    assert.deepEqual(state.rows[0], { status: 'pendente', versao: '1' });
  });

  test('login runtime real aceita convites novos de Produtor e Colaborador sem UPDATE amplo', async () => {
    const runtime = await createLoginPoolForRole('tche_agro_runtime');
    try {
      const identity = await runtime.pool.query<{
        current_user: string;
        session_user: string;
        runtime_member: boolean;
        function_execute: boolean;
        producer_select: boolean;
        producer_insert: boolean;
        producer_update: boolean;
        producer_delete: boolean;
      }>(`
        SELECT current_user, session_user,
               pg_has_role(current_user, 'tche_agro_runtime', 'USAGE')
                 AS runtime_member,
               has_function_privilege(
                 current_user,
                 'public.tche_ativar_produtor_por_convite_mp35a(uuid)',
                 'EXECUTE'
               ) AS function_execute,
               has_table_privilege(
                 current_user,
                 'public.produtores',
                 'SELECT'
               ) AS producer_select,
               has_table_privilege(
                 current_user,
                 'public.produtores',
                 'INSERT'
               ) AS producer_insert,
               has_any_column_privilege(
                 current_user,
                 'public.produtores',
                 'UPDATE'
               ) AS producer_update,
               has_table_privilege(
                 current_user,
                 'public.produtores',
                 'DELETE'
               ) AS producer_delete
      `);
      assert.deepEqual(identity.rows[0], {
        current_user: runtime.loginRole,
        session_user: runtime.loginRole,
        runtime_member: true,
        function_execute: true,
        producer_select: true,
        producer_insert: false,
        producer_update: false,
        producer_delete: false,
      });

      const adminSessionId = await seedSession(adminUserId);
      const producerUserId = randomUUID();
      const producerId = randomUUID();
      await requirePool().query(`
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Produtor via runtime real', $3, 'produtor', 'pendente')
      `, [
        producerUserId,
        ORGANIZATION_ID,
        `produtor-runtime-${producerUserId}@example.test`,
      ]);
      await requirePool().query(`
        INSERT INTO public.produtores (
          id, organizacao_id, usuario_id, nome, status
        ) VALUES ($1, $2, $3, 'Produtor via runtime real', 'inativo')
      `, [producerId, ORGANIZATION_ID, producerUserId]);

      const runtimeService = new InvitationService({
        repository: new PostgresInvitationRepository(
          postgresOptions(runtime.pool),
        ),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      const producerInvitation =
        await runtimeService.issueForExistingPendingUser({
          organizationId: ORGANIZATION_ID,
          actorAdminUserId: adminUserId,
          actorSessionId: adminSessionId,
          userId: producerUserId,
          requestId: 'runtime-producer-invitation',
        });
      const producerInvitationId = await requirePool().query<{ id: string }>(
        `SELECT id FROM public.convites_usuario WHERE desafio_id = $1`,
        [producerInvitation.challengeId],
      );
      assert.ok(producerInvitationId.rows[0]?.id);
      const narrowInterfaceProbe = await runtime.pool.connect();
      try {
        await narrowInterfaceProbe.query('BEGIN');
        await narrowInterfaceProbe.query(`
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `, [
          ORGANIZATION_ID,
          producerUserId,
          phcFor('SenhaProbeRuntime1'),
        ]);
        await narrowInterfaceProbe.query(
          'SELECT public.tche_ativar_produtor_por_convite_mp35a($1)',
          [producerInvitationId.rows[0].id],
        );
      } finally {
        await rollbackQuietly(narrowInterfaceProbe);
        narrowInterfaceProbe.release();
      }
      await runtimeService.accept({
        token: await tokenForChallenge(producerInvitation.challengeId),
        password: 'SenhaProdutorRuntime1',
        requestId: 'runtime-producer-acceptance',
      });

      const producerState = await requirePool().query<{
        user_status: string;
        producer_status: string;
        invitation_status: string;
        challenge_status: string;
        user_version: string;
        producer_version: string;
        credential_count: string;
        audit_count: string;
      }>(`
        SELECT usuario.status AS user_status,
               produtor.status AS producer_status,
               convite.status AS invitation_status,
               desafio.status AS challenge_status,
               usuario.versao::text AS user_version,
               produtor.versao::text AS producer_version,
               (SELECT count(*)::text
                FROM public.credenciais_usuario AS credencial
                WHERE credencial.organizacao_id = usuario.organizacao_id
                  AND credencial.usuario_id = usuario.id
                  AND credencial.status = 'ativa') AS credential_count,
               (SELECT count(*)::text
                FROM public.eventos_auditoria AS auditoria
                WHERE auditoria.organizacao_id = usuario.organizacao_id
                  AND auditoria.usuario_afetado_id = usuario.id
                  AND auditoria.evento = 'auth.convite.aceito') AS audit_count
        FROM public.usuarios AS usuario
        JOIN public.produtores AS produtor
          ON produtor.organizacao_id = usuario.organizacao_id
         AND produtor.usuario_id = usuario.id
        JOIN public.convites_usuario AS convite
          ON convite.organizacao_id = usuario.organizacao_id
         AND convite.usuario_id = usuario.id
        JOIN public.desafios_autenticacao AS desafio
          ON desafio.organizacao_id = convite.organizacao_id
         AND desafio.id = convite.desafio_id
        WHERE usuario.id = $1
      `, [producerUserId]);
      assert.deepEqual(producerState.rows[0], {
        user_status: 'ativo',
        producer_status: 'ativo',
        invitation_status: 'aceito',
        challenge_status: 'consumido',
        user_version: '2',
        producer_version: '2',
        credential_count: '1',
        audit_count: '1',
      });

      await assert.rejects(
        runtime.pool.query(
          "UPDATE public.produtores SET status = 'inativo' WHERE id = $1",
          [producerId],
        ),
        /permission denied|permissão negada/i,
      );

      const collaboratorId = randomUUID();
      await requirePool().query(`
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Colaborador via runtime real', $3,
          'colaborador', 'pendente')
      `, [
        collaboratorId,
        ORGANIZATION_ID,
        `colaborador-runtime-${collaboratorId}@example.test`,
      ]);
      const collaboratorInvitation =
        await runtimeService.issueForExistingPendingUser({
          organizationId: ORGANIZATION_ID,
          actorAdminUserId: adminUserId,
          actorSessionId: adminSessionId,
          userId: collaboratorId,
        });
      await runtimeService.accept({
        token: await tokenForChallenge(collaboratorInvitation.challengeId),
        password: 'SenhaColaboradorRuntime1',
      });
      const collaboratorState = await requirePool().query<{
        status: string;
        version: string;
        credential_count: string;
        producer_count: string;
      }>(`
        SELECT usuario.status, usuario.versao::text AS version,
               (SELECT count(*)::text FROM public.credenciais_usuario
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_id = usuario.id AND status = 'ativa')
                 AS credential_count,
               (SELECT count(*)::text FROM public.produtores
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_id = usuario.id) AS producer_count
        FROM public.usuarios AS usuario
        WHERE usuario.id = $1
      `, [collaboratorId]);
      assert.deepEqual(collaboratorState.rows[0], {
        status: 'ativo',
        version: '2',
        credential_count: '1',
        producer_count: '0',
      });
    } finally {
      await runtime.pool.end();
      await requirePool().query(`DROP ROLE IF EXISTS ${runtime.loginRole}`);
    }
  });

  test('falha intermediária no aceite runtime reverte todo o agregado de Produtor', async () => {
    const runtime = await createLoginPoolForRole('tche_agro_runtime');
    try {
      const adminSessionId = await seedSession(adminUserId);
      const producerUserId = randomUUID();
      const producerId = randomUUID();
      await requirePool().query(`
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Produtor rollback runtime', $3, 'produtor', 'pendente')
      `, [
        producerUserId,
        ORGANIZATION_ID,
        `produtor-rollback-${producerUserId}@example.test`,
      ]);
      await requirePool().query(`
        INSERT INTO public.produtores (
          id, organizacao_id, usuario_id, nome, status
        ) VALUES ($1, $2, $3, 'Produtor rollback runtime', 'inativo')
      `, [producerId, ORGANIZATION_ID, producerUserId]);
      const issuer = new InvitationService({
        repository: new PostgresInvitationRepository(
          postgresOptions(runtime.pool),
        ),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
      });
      const invitation = await issuer.issueForExistingPendingUser({
        organizationId: ORGANIZATION_ID,
        actorAdminUserId: adminUserId,
        actorSessionId: adminSessionId,
        userId: producerUserId,
      });
      const token = await tokenForChallenge(invitation.challengeId);
      const duplicateAuditId = randomUUID();
      await requirePool().query(`
        INSERT INTO public.eventos_auditoria (
          id, organizacao_id, evento, resultado, ator_tipo, metadados
        ) VALUES ($1, $2, 'auth.fixture.duplicada', 'sucesso', 'sistema', '{}')
      `, [duplicateAuditId, ORGANIZATION_ID]);
      const failingAcceptance = new InvitationService({
        repository: new PostgresInvitationRepository(
          postgresOptions(runtime.pool),
        ),
        passwordCredentials: credentials,
        emailOutbox,
        actionBaseUrl: ACTION_URL,
        idGenerator: () => duplicateAuditId,
      });
      await assert.rejects(
        failingAcceptance.accept({
          token,
          password: 'SenhaRollbackRuntime1',
        }),
        /temporariamente indisponível/i,
      );

      const state = await requirePool().query<{
        user_status: string;
        producer_status: string;
        invitation_status: string;
        challenge_status: string;
        user_version: string;
        producer_version: string;
        credential_count: string;
        acceptance_audit_count: string;
      }>(`
        SELECT usuario.status AS user_status,
               produtor.status AS producer_status,
               convite.status AS invitation_status,
               desafio.status AS challenge_status,
               usuario.versao::text AS user_version,
               produtor.versao::text AS producer_version,
               (SELECT count(*)::text FROM public.credenciais_usuario
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_id = usuario.id) AS credential_count,
               (SELECT count(*)::text FROM public.eventos_auditoria
                WHERE organizacao_id = usuario.organizacao_id
                  AND usuario_afetado_id = usuario.id
                  AND evento = 'auth.convite.aceito') AS acceptance_audit_count
        FROM public.usuarios AS usuario
        JOIN public.produtores AS produtor
          ON produtor.organizacao_id = usuario.organizacao_id
         AND produtor.usuario_id = usuario.id
        JOIN public.convites_usuario AS convite
          ON convite.organizacao_id = usuario.organizacao_id
         AND convite.usuario_id = usuario.id
        JOIN public.desafios_autenticacao AS desafio
          ON desafio.organizacao_id = convite.organizacao_id
         AND desafio.id = convite.desafio_id
        WHERE usuario.id = $1
      `, [producerUserId]);
      assert.deepEqual(state.rows[0], {
        user_status: 'pendente',
        producer_status: 'inativo',
        invitation_status: 'pendente',
        challenge_status: 'ativo',
        user_version: '1',
        producer_version: '1',
        credential_count: '0',
        acceptance_audit_count: '0',
      });
    } finally {
      await runtime.pool.end();
      await requirePool().query(`DROP ROLE IF EXISTS ${runtime.loginRole}`);
    }
  });

  test('reserva idempotente vincula ator à própria sessão e reverte tentativas cruzadas', async () => {
    const ownSessionId = await seedSession(adminUserId);
    const otherActorId = randomUUID();
    const otherSessionId = randomUUID();
    const seed = await requirePool().connect();
    try {
      await seed.query('BEGIN');
      await seed.query(`
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Outro ator idempotente', $3,
          'colaborador', 'ativo')
      `, [
        otherActorId,
        ORGANIZATION_ID,
        `outro-ator-${otherActorId}@example.test`,
      ]);
      await seed.query(`
        INSERT INTO public.credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        ) VALUES ($1, $2, $3, 'integration-v1')
      `, [ORGANIZATION_ID, otherActorId, phcFor('SenhaOutroAtor1')]);
      await seed.query(`
        INSERT INTO public.sessoes_autenticacao (
          id, organizacao_id, usuario_id, versao_autorizacao,
          expira_inatividade_em, expira_absolutamente_em
        ) VALUES ($1, $2, $3, 1,
          clock_timestamp() + interval '1 day',
          clock_timestamp() + interval '2 days')
      `, [otherSessionId, ORGANIZATION_ID, otherActorId]);
      await seed.query('COMMIT');
    } finally {
      await rollbackQuietly(seed);
      seed.release();
    }

    const ownCommandId = randomUUID();
    await requirePool().query(`
      WITH instante AS (SELECT clock_timestamp() AS valor)
      INSERT INTO public.comandos_administrativos_idempotencia (
        id, organizacao_id, ator_usuario_id, sessao_id,
        request_id, correlation_id, chave_idempotencia_hash,
        comando, hash_requisicao, criado_em, expira_em
      )
      SELECT $1, $2, $3, $4, 'request-own-session',
             'correlation-own-session', $5, 'usuario.atualizar', $6,
             instante.valor, instante.valor + interval '90 days'
      FROM instante
    `, [
      ownCommandId,
      ORGANIZATION_ID,
      adminUserId,
      ownSessionId,
      Buffer.alloc(32, 0x61),
      Buffer.alloc(32, 0x62),
    ]);
    const ownLink = await requirePool().query<{
      ator_usuario_id: string;
      sessao_id: string;
    }>(`
      SELECT ator_usuario_id, sessao_id
      FROM public.comandos_administrativos_idempotencia
      WHERE id = $1
    `, [ownCommandId]);
    assert.deepEqual(ownLink.rows[0], {
      ator_usuario_id: adminUserId,
      sessao_id: ownSessionId,
    });

    const rollbackCommandId = randomUUID();
    const transaction = await requirePool().connect();
    try {
      await transaction.query('BEGIN');
      await transaction.query(`
        WITH instante AS (SELECT clock_timestamp() AS valor)
        INSERT INTO public.comandos_administrativos_idempotencia (
          id, organizacao_id, ator_usuario_id, sessao_id,
          request_id, correlation_id, chave_idempotencia_hash,
          comando, hash_requisicao, criado_em, expira_em
        )
        SELECT $1, $2, $3, $4, 'request-before-rollback',
               'correlation-before-rollback', $5, 'usuario.atualizar', $6,
               instante.valor, instante.valor + interval '90 days'
        FROM instante
      `, [
        rollbackCommandId,
        ORGANIZATION_ID,
        adminUserId,
        ownSessionId,
        Buffer.alloc(32, 0x63),
        Buffer.alloc(32, 0x64),
      ]);
      await assert.rejects(
        transaction.query(`
          WITH instante AS (SELECT clock_timestamp() AS valor)
          INSERT INTO public.comandos_administrativos_idempotencia (
            organizacao_id, ator_usuario_id, sessao_id,
            request_id, correlation_id, chave_idempotencia_hash,
            comando, hash_requisicao, criado_em, expira_em
          )
          SELECT $1, $2, $3, 'request-cross-actor',
                 'correlation-cross-actor', $4, 'usuario.atualizar', $5,
                 instante.valor, instante.valor + interval '90 days'
          FROM instante
        `, [
          ORGANIZATION_ID,
          adminUserId,
          otherSessionId,
          Buffer.alloc(32, 0x65),
          Buffer.alloc(32, 0x66),
        ]),
        /fk_comandos_administrativos_sessao|foreign key/i,
      );
      await rollbackQuietly(transaction);
    } finally {
      await rollbackQuietly(transaction);
      transaction.release();
    }
    const rolledBack = await requirePool().query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM public.comandos_administrativos_idempotencia
       WHERE id = $1`,
      [rollbackCommandId],
    );
    assert.equal(rolledBack.rows[0]?.total, '0');

    await assert.rejects(
      requirePool().query(`
        WITH instante AS (SELECT clock_timestamp() AS valor)
        INSERT INTO public.comandos_administrativos_idempotencia (
          organizacao_id, ator_usuario_id, sessao_id,
          request_id, correlation_id, chave_idempotencia_hash,
          comando, hash_requisicao, criado_em, expira_em
        )
        SELECT 'org_alheia', $1, $2, 'request-other-org',
               'correlation-other-org', $3, 'usuario.atualizar', $4,
               instante.valor, instante.valor + interval '90 days'
        FROM instante
      `, [
        adminUserId,
        ownSessionId,
        Buffer.alloc(32, 0x67),
        Buffer.alloc(32, 0x68),
      ]),
      /foreign key|organiza/i,
    );
  });

  test('purga administrativa usa login exclusivo, lote e função sem DML direto', async () => {
    const sessionId = await seedSession(adminUserId);
    const expiredId = randomUUID();
    const futureId = randomUUID();
    const bulkCorrelationId = `correlation-bulk-${randomUUID()}`;
    await requirePool().query(`
      WITH instante AS (SELECT clock_timestamp() AS valor)
      INSERT INTO public.comandos_administrativos_idempotencia (
        id, organizacao_id, ator_usuario_id, sessao_id,
        request_id, correlation_id, chave_idempotencia_hash,
        comando, hash_requisicao, criado_em, expira_em
      )
      SELECT $1::uuid, $3, $4::uuid, $5::uuid,
          'request-expired', 'correlation-expired',
          $6::bytea, 'usuario.atualizar', $7::bytea,
          instante.valor - interval '91 days',
          instante.valor - interval '1 day'
      FROM instante
      UNION ALL
      SELECT $2::uuid, $3, $4::uuid, $5::uuid,
          'request-future', 'correlation-future',
          $8::bytea, 'usuario.atualizar', $9::bytea,
          instante.valor, instante.valor + interval '90 days'
      FROM instante
    `, [
      expiredId,
      futureId,
      ORGANIZATION_ID,
      adminUserId,
      sessionId,
      Buffer.alloc(32, 0x71),
      Buffer.alloc(32, 0x72),
      Buffer.alloc(32, 0x73),
      Buffer.alloc(32, 0x74),
    ]);

    const maintenance = await createLoginPoolForRole(
      'tche_agro_administration_maintenance',
    );
    const runtime = await createLoginPoolForRole('tche_agro_runtime');
    const combined = await createLoginPoolForRole([
      'tche_agro_runtime',
      'tche_agro_administration_maintenance',
    ]);
    try {
      const identity = await maintenance.pool.query<{
        current_user: string;
        session_user: string;
        can_execute: boolean;
        can_select: boolean;
        can_delete: boolean;
      }>(`
        SELECT current_user, session_user,
               has_function_privilege(
                 current_user,
                 'public.tche_purgar_comandos_administrativos_mp35a(integer)',
                 'EXECUTE'
               ) AS can_execute,
               has_table_privilege(
                 current_user,
                 'public.comandos_administrativos_idempotencia',
                 'SELECT'
               ) AS can_select,
               has_table_privilege(
                 current_user,
                 'public.comandos_administrativos_idempotencia',
                 'DELETE'
               ) AS can_delete
      `);
      assert.deepEqual(identity.rows[0], {
        current_user: maintenance.loginRole,
        session_user: maintenance.loginRole,
        can_execute: true,
        can_select: false,
        can_delete: false,
      });

      await expectSqlState(
        maintenance.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(NULL::integer)',
        ),
        '22023',
      );
      await expectSqlState(
        maintenance.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(0)',
        ),
        '22023',
      );
      await expectSqlState(
        maintenance.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(-1)',
        ),
        '22023',
      );
      await expectSqlState(
        maintenance.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(5001)',
        ),
        '22023',
      );

      const afterInvalidLimits = await requirePool().query<{
        expired: string;
        future: string;
      }>(`
        SELECT
          count(*) FILTER (WHERE id = $1)::text AS expired,
          count(*) FILTER (WHERE id = $2)::text AS future
        FROM public.comandos_administrativos_idempotencia
      `, [expiredId, futureId]);
      assert.deepEqual(afterInvalidLimits.rows[0], {
        expired: '1',
        future: '1',
      });

      const transaction = await maintenance.pool.connect();
      try {
        await transaction.query('BEGIN');
        const removedInsideTransaction = await transaction.query<{
          removed: number;
        }>(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(1) AS removed',
        );
        assert.equal(removedInsideTransaction.rows[0]?.removed, 1);
        await transaction.query('ROLLBACK');
      } finally {
        transaction.release();
      }

      const afterRollback = await requirePool().query<{ expired: string }>(`
        SELECT count(*)::text AS expired
        FROM public.comandos_administrativos_idempotencia
        WHERE id = $1
      `, [expiredId]);
      assert.equal(afterRollback.rows[0]?.expired, '1');

      const purged = await maintenance.pool.query<{ removed: number }>(
        'SELECT public.tche_purgar_comandos_administrativos_mp35a(1) AS removed',
      );
      assert.equal(purged.rows[0]?.removed, 1);

      await requirePool().query(`
        WITH instante AS (
          SELECT clock_timestamp() AS valor
        ), serie AS (
          SELECT generate_series(1, 5001) AS valor
        )
        INSERT INTO public.comandos_administrativos_idempotencia (
          organizacao_id, ator_usuario_id, sessao_id,
          request_id, correlation_id, chave_idempotencia_hash,
          comando, hash_requisicao, criado_em, expira_em
        )
        SELECT $1, $2::uuid, $3::uuid,
          'request-bulk-' || $4 || '-' || serie.valor::text,
          $4,
          pg_catalog.decode(
            pg_catalog.md5($4 || '-key-a-' || serie.valor::text)
            || pg_catalog.md5($4 || '-key-b-' || serie.valor::text),
            'hex'
          ),
          'usuario.atualizar',
          pg_catalog.decode(
            pg_catalog.md5($4 || '-body-a-' || serie.valor::text)
            || pg_catalog.md5($4 || '-body-b-' || serie.valor::text),
            'hex'
          ),
          instante.valor - interval '91 days',
          instante.valor - interval '1 day'
        FROM instante
        CROSS JOIN serie
      `, [ORGANIZATION_ID, adminUserId, sessionId, bulkCorrelationId]);

      const bulkPurged = await maintenance.pool.query<{ removed: number }>(
        'SELECT public.tche_purgar_comandos_administrativos_mp35a(5000) AS removed',
      );
      assert.equal(bulkPurged.rows[0]?.removed, 5000);

      const bulkRemaining = await requirePool().query<{
        expired: string;
        future: string;
      }>(`
        SELECT
          count(*) FILTER (WHERE correlation_id = $1)::text AS expired,
          count(*) FILTER (WHERE id = $2)::text AS future
        FROM public.comandos_administrativos_idempotencia
      `, [bulkCorrelationId, futureId]);
      assert.deepEqual(bulkRemaining.rows[0], {
        expired: '1',
        future: '1',
      });

      const defaultPurged = await maintenance.pool.query<{ removed: number }>(
        'SELECT public.tche_purgar_comandos_administrativos_mp35a() AS removed',
      );
      assert.equal(defaultPurged.rows[0]?.removed, 1);

      await assert.rejects(
        runtime.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(100)',
        ),
        /permission denied|permissão negada/i,
      );
      await assert.rejects(
        combined.pool.query(
          'SELECT public.tche_purgar_comandos_administrativos_mp35a(100)',
        ),
        /credencial de manutencao exclusiva|papel_exclusivo/i,
      );
      const remaining = await requirePool().query<{
        expired: string;
        future: string;
      }>(`
        SELECT
          count(*) FILTER (WHERE id = $1)::text AS expired,
          count(*) FILTER (WHERE id = $2)::text AS future
        FROM public.comandos_administrativos_idempotencia
      `, [expiredId, futureId]);
      assert.deepEqual(remaining.rows[0], { expired: '0', future: '1' });
    } finally {
      await Promise.all([
        maintenance.pool.end(),
        runtime.pool.end(),
        combined.pool.end(),
      ]);
      await requirePool().query(
        `DROP ROLE IF EXISTS ${maintenance.loginRole}, ${runtime.loginRole}, ${combined.loginRole}`,
      );
    }
  });

  test('bootstrap e último Admin compartilham lock com duas conexões e barreira explícita', async () => {
    const concurrencyDatabase = await startPostgisTestDatabase();
    let concurrencyPool: Pool | undefined;
    try {
      await runMigrations({
        command: 'up',
        count: 5,
        database: concurrencyDatabase.database,
      });
      concurrencyPool = new Pool(
        buildPostgresPoolConfig(concurrencyDatabase.database),
      );
      const concurrentAdminId = randomUUID();
      const challengeId = randomUUID();
      const invitationId = randomUUID();
      const seed = await concurrencyPool.connect();
      try {
        await seed.query('BEGIN');
        // Estado adversarial intencional: representa o instante intermediário
        // da aceitação atômica em que Admin/credencial já existem, mas a
        // conclusão do singleton ainda não foi publicada.
        await seed.query('SET LOCAL session_replication_role = replica');
        await seed.query(`
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, 'Admin da corrida', $3, 'admin', 'ativo')
        `, [
          concurrentAdminId,
          ORGANIZATION_ID,
          `admin-corrida-${concurrentAdminId}@example.test`,
        ]);
        await seed.query(`
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `, [ORGANIZATION_ID, concurrentAdminId, phcFor('SenhaCorrida1')]);
        await seed.query(`
          INSERT INTO public.desafios_autenticacao (
            id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
          ) VALUES ($1, $2, $3, 'convite', $4,
            clock_timestamp() + interval '72 hours')
        `, [challengeId, ORGANIZATION_ID, concurrentAdminId, Buffer.alloc(32, 0x54)]);
        await seed.query(`
          INSERT INTO public.convites_usuario (
            id, organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
            criado_por_usuario_id, expira_em
          ) VALUES ($1, $2, $3, $4, 'bootstrap',
            'ativar_admin_bootstrap', NULL,
            clock_timestamp() + interval '72 hours')
        `, [invitationId, ORGANIZATION_ID, concurrentAdminId, challengeId]);
        await seed.query(`
          UPDATE public.bootstrap_autenticacao
          SET status = 'convite_pendente', usuario_admin_id = $2,
              ultimo_convite_id = $3, iniciado_em = clock_timestamp()
          WHERE organizacao_id = $1
        `, [ORGANIZATION_ID, concurrentAdminId, invitationId]);
        await seed.query('COMMIT');
      } finally {
        await rollbackQuietly(seed);
        seed.release();
      }
      await runMigrations({
        command: 'up',
        count: 1,
        database: concurrencyDatabase.database,
      });

      const completion = await concurrencyPool.connect();
      const deactivation = await concurrencyPool.connect();
      try {
        await completion.query('BEGIN');
        await deactivation.query('BEGIN');
        const pid = await deactivation.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid',
        );
        assert.ok(pid.rows[0]?.pid);

        const completed = await completion.query(`
          UPDATE public.bootstrap_autenticacao
          SET status = 'concluido', concluido_em = clock_timestamp()
          WHERE organizacao_id = $1 AND status = 'convite_pendente'
        `, [ORGANIZATION_ID]);
        assert.equal(completed.rowCount, 1);
        const deactivationUpdate = deactivation.query(
          "UPDATE public.usuarios SET status = 'inativo' WHERE id = $1",
          [concurrentAdminId],
        );
        await waitUntilBlocked(pid.rows[0].pid, concurrencyPool);

        await completion.query('COMMIT');
        await deactivationUpdate;
        await assert.rejects(
          deactivation.query('COMMIT'),
          /ao menos um Administrador ativo|ultimo_admin_ativo/i,
        );
        await rollbackQuietly(deactivation);
      } finally {
        await rollbackQuietly(completion);
        await rollbackQuietly(deactivation);
        completion.release();
        deactivation.release();
      }

      const state = await concurrencyPool.query<{
        bootstrap_status: string;
        admin_status: string;
      }>(`
        SELECT bootstrap.status AS bootstrap_status,
               usuario.status AS admin_status
        FROM public.bootstrap_autenticacao AS bootstrap
        JOIN public.usuarios AS usuario
          ON usuario.organizacao_id = bootstrap.organizacao_id
         AND usuario.id = bootstrap.usuario_admin_id
        WHERE bootstrap.organizacao_id = $1
      `, [ORGANIZATION_ID]);
      assert.deepEqual(state.rows[0], {
        bootstrap_status: 'concluido',
        admin_status: 'ativo',
      });
    } finally {
      await concurrencyPool?.end();
      await concurrencyDatabase.container.stop();
    }
  });
});
