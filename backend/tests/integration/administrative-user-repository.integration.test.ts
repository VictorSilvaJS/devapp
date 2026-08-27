import { strict as assert } from 'node:assert';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { PostgresOutboxRepository } from '../../src/outbox/postgres-repository.js';
import { PostgresAdministrativeUserRepository } from '../../src/administration/postgres-user-repository.js';
import { validateAdministrativeIdempotencyReceipt } from '../../src/administration/validation.js';
import type {
  AdministrativeCommandIdentity,
  AdministrativeCommandResult,
} from '../../src/administration/user-contracts.js';
import { HttpError } from '../../src/security/http-error.js';
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

function hash(label: string): Buffer {
  return createHash('sha256').update(label).digest();
}

describe('PostgresAdministrativeUserRepository', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let ownerPool: Pool | undefined;
  let runtimePool: Pool | undefined;
  let runtimeLoginRole: string | undefined;
  let runtimeConnectionString: string | undefined;
  let repository: PostgresAdministrativeUserRepository | undefined;
  let admin: AuthenticatedPrincipal | undefined;

  const emailOutbox = new EncryptedEmailOutboxFactory(
    new OutboxPayloadCipher({
      activeKeyId: 'mp35b-integration-key',
      keys: [{ id: 'mp35b-integration-key', key: Buffer.alloc(32, 0x37) }],
    }),
  );
  const commonOptions = {
    emailHmacKey: Buffer.alloc(32, 0x41),
    externalReferenceHmacKey: Buffer.alloc(32, 0x42),
  } as const;

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    testDatabase = await startPostgisTestDatabase();
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({ command: 'up', database: testDatabase.database });
    ownerPool = new Pool(buildPostgresPoolConfig(testDatabase.database));

    const adminId = randomUUID();
    const sessionId = randomUUID();
    const now = new Date();
    const setup = await ownerPool.connect();
    try {
      await setup.query('BEGIN');
      await setup.query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, 'Admin MP-35B', $3, 'admin', 'ativo')
        `,
        [adminId, ORGANIZATION_ID, `admin-${adminId}@example.test`],
      );
      await setup.query(
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, adminId, phcFor('SenhaAdmin1')],
      );
      await setup.query(
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
          adminId,
          now,
          new Date(now.getTime() + 60 * 60_000),
          new Date(now.getTime() + 24 * 60 * 60_000),
        ],
      );
      await setup.query('COMMIT');
    } catch (error) {
      await setup.query('ROLLBACK');
      throw error;
    } finally {
      setup.release();
    }

    admin = {
      id: adminId,
      organizationId: ORGANIZATION_ID,
      name: 'Admin MP-35B',
      email: `admin-${adminId}@example.test`,
      profile: 'admin',
      status: 'ativo',
      authorizationVersion: 1,
      sessionId,
    };

    runtimeLoginRole = `tche_test_runtime_mp35b_${randomUUID().replaceAll('-', '')}`;
    const password = randomBytes(24).toString('hex');
    await ownerPool.query(
      `CREATE ROLE ${runtimeLoginRole} LOGIN PASSWORD '${password}'`,
    );
    await ownerPool.query(`GRANT tche_agro_runtime TO ${runtimeLoginRole}`);
    const runtimeUrl = new URL(testDatabase.connectionString);
    runtimeUrl.username = runtimeLoginRole;
    runtimeUrl.password = password;
    runtimeConnectionString = runtimeUrl.toString();
    runtimePool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeUrl.toString(),
      application_name: runtimeLoginRole,
    });
    repository = new PostgresAdministrativeUserRepository({
      pool: runtimePool,
      ...commonOptions,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
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

  function requireOwner(): Pool {
    assert.ok(ownerPool);
    return ownerPool;
  }

  function requireRepository(): PostgresAdministrativeUserRepository {
    assert.ok(repository);
    return repository;
  }

  function requireAdmin(): AuthenticatedPrincipal {
    assert.ok(admin);
    return admin;
  }

  function identity(
    command: AdministrativeCommandIdentity['command'],
    label: string,
  ): AdministrativeCommandIdentity {
    const actor = requireAdmin();
    return {
      organizationId: ORGANIZATION_ID,
      actorUserId: actor.id,
      sessionId: actor.sessionId,
      requestId: `request-${label}`,
      correlationId: `correlation-${label}`,
      idempotencyKeyHash: hash(`key-${label}`),
      requestHash: hash(`request-${command}-${label}`),
      command,
    };
  }

  async function directRuntimeMutationMustFail(
    sql: string,
    values: readonly unknown[],
    expectedCode?: string,
  ): Promise<void> {
    assert.ok(runtimePool);
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await assert.rejects(client.query(sql, [...values]), (error: unknown) => {
        if (expectedCode !== undefined) {
          assert.equal((error as { readonly code?: string }).code, expectedCode);
        }
        return true;
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  test('login runtime real não possui DML administrativo direto', async () => {
    assert.ok(runtimePool);
    assert.ok(runtimeLoginRole);
    const identityResult = await runtimePool.query<{
      current_user: string;
      session_user: string;
      rolsuper: boolean;
      runtime_owns_users: boolean;
      runtime_member: boolean;
      platform_member: boolean;
      worker_member: boolean;
      can_insert_audit: boolean;
      can_insert_any_audit_column: boolean;
      can_execute_internal_audit: boolean;
      public_can_execute_internal_audit: boolean;
    }>(
      `
        SELECT current_user,
               session_user,
               role.rolsuper,
               table_owner.rolname = current_user AS runtime_owns_users,
               pg_catalog.pg_has_role(
                 current_user, 'tche_agro_runtime', 'MEMBER'
               ) AS runtime_member,
               pg_catalog.pg_has_role(
                 current_user, 'tche_agro_platform_ops', 'MEMBER'
               ) AS platform_member,
               pg_catalog.pg_has_role(
                 current_user, 'tche_agro_outbox_worker', 'MEMBER'
               ) AS worker_member,
               pg_catalog.has_table_privilege(
                 current_user, 'public.eventos_auditoria', 'INSERT'
               ) AS can_insert_audit,
               pg_catalog.has_any_column_privilege(
                 current_user, 'public.eventos_auditoria', 'INSERT'
               ) AS can_insert_any_audit_column,
               pg_catalog.has_function_privilege(
                 current_user,
                 'public.tche_auditoria_inserir_interno_mp35b(text,jsonb)',
                 'EXECUTE'
               ) AS can_execute_internal_audit,
               pg_catalog.has_function_privilege(
                 'public',
                 'public.tche_auditoria_inserir_interno_mp35b(text,jsonb)',
                 'EXECUTE'
               ) AS public_can_execute_internal_audit
        FROM pg_catalog.pg_roles AS role
        JOIN pg_catalog.pg_class AS relation ON relation.oid = 'public.usuarios'::regclass
        JOIN pg_catalog.pg_roles AS table_owner ON table_owner.oid = relation.relowner
        WHERE role.rolname = current_user
      `,
    );
    assert.deepEqual(identityResult.rows[0], {
      current_user: runtimeLoginRole,
      session_user: runtimeLoginRole,
      rolsuper: false,
      runtime_owns_users: false,
      runtime_member: true,
      platform_member: false,
      worker_member: false,
      can_insert_audit: false,
      can_insert_any_audit_column: false,
      can_execute_internal_audit: false,
      public_can_execute_internal_audit: false,
    });

    const narrowAuditInterfaces = await runtimePool.query<{
      count: string;
      executable_count: string;
      all_narrow: boolean;
      fragile_interfaces_revoked: boolean;
    }>(`
      SELECT count(*)::text AS count,
             count(*) FILTER (WHERE pg_catalog.has_function_privilege(
               current_user, procedure.oid, 'EXECUTE'
             ))::text AS executable_count,
             bool_and(procedure.pronargs = 1
               AND procedure.proargnames = ARRAY['entrada']::text[])
               AS all_narrow,
             bool_and(NOT pg_catalog.has_function_privilege(
               current_user, procedure.oid, 'EXECUTE'
             )) FILTER (WHERE procedure.proname IN (
               'tche_aud_notificacao_criada_mp35b',
               'tche_aud_notificacao_deduplicada_mp35b',
               'tche_aud_notificacao_destino_negado_mp35b'
             )) AS fragile_interfaces_revoked
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname LIKE 'tche_aud_%_mp35b'
        AND procedure.pronargs = 1
    `);
    assert.deepEqual(narrowAuditInterfaces.rows[0], {
      count: '35',
      executable_count: '32',
      all_narrow: true,
      fragile_interfaces_revoked: true,
    });

    const actor = requireAdmin();
    const auditCountBefore = await requireOwner().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM public.eventos_auditoria',
    );
    const forgedAuditId = randomUUID();
    await directRuntimeMutationMustFail(
      `INSERT INTO public.eventos_auditoria (
         id, organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
         sessao_id, usuario_afetado_id, recurso_tipo, recurso_id, request_id,
         metadados
       ) VALUES (
         $1::uuid, $2::text, 'administracao.usuario.atualizado', 'sucesso',
         'usuario', $3::uuid, $4::uuid, $3::uuid, 'usuario', $3::uuid::text,
         'req-legitima-forjada',
         '{"acao":"perfil_forjado"}'::jsonb
       )`,
      [forgedAuditId, ORGANIZATION_ID, actor.id, actor.sessionId],
      '42501',
    );
    await directRuntimeMutationMustFail(
      `INSERT INTO public.eventos_auditoria (
         organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
         sessao_id, usuario_afetado_id, recurso_tipo, recurso_id, metadados
       )
       SELECT $1::text, 'administracao.usuario.status_alterado', 'sucesso',
              'usuario', $2::uuid, $3::uuid, usuario.id, 'usuario', usuario.id::text,
              '{}'::jsonb
       FROM public.usuarios AS usuario
       WHERE usuario.organizacao_id = $1 AND usuario.id = $2`,
      [ORGANIZATION_ID, actor.id, actor.sessionId],
      '42501',
    );
    await directRuntimeMutationMustFail(
      `INSERT INTO public.eventos_auditoria (
         organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
         sessao_id, usuario_afetado_id, recurso_tipo, recurso_id, request_id,
         metadados
       ) VALUES (
         $1::text, 'administracao.usuario.convite_emitido', 'sucesso', 'usuario',
         $2::uuid, $3::uuid, $2::uuid, 'usuario', $2::uuid::text,
         'req-existente-sem-mutacao',
         '{}'::jsonb
       )`,
      [ORGANIZATION_ID, actor.id, actor.sessionId],
      '42501',
    );
    await directRuntimeMutationMustFail(
      'SELECT public.tche_aud_convite_criado_mp35b($1::jsonb)',
      [
        JSON.stringify({
          id: randomUUID(),
          organizationId: ORGANIZATION_ID,
          result: 'sucesso',
          actorType: 'usuario',
          actorUserId: actor.id,
          sessionId: actor.sessionId,
          affectedUserId: actor.id,
          resourceType: 'usuario',
          resourceId: actor.id,
          requestId: 'req-legitima-sem-convite',
          metadata: { token: 'segredo-forjado' },
        }),
      ],
      '42501',
    );
    const auditCountAfter = await requireOwner().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM public.eventos_auditoria',
    );
    assert.equal(auditCountAfter.rows[0]?.count, auditCountBefore.rows[0]?.count);
    await directRuntimeMutationMustFail(
      'UPDATE public.usuarios SET nome = nome WHERE organizacao_id = $1 AND id = $2',
      [ORGANIZATION_ID, actor.id],
    );
    await directRuntimeMutationMustFail(
      'UPDATE public.usuarios SET email = email WHERE organizacao_id = $1 AND id = $2',
      [ORGANIZATION_ID, actor.id],
    );
    await directRuntimeMutationMustFail(
      'UPDATE public.usuarios SET status = status WHERE organizacao_id = $1 AND id = $2',
      [ORGANIZATION_ID, actor.id],
    );
    await directRuntimeMutationMustFail(
      'UPDATE public.usuarios SET versao_autorizacao = versao_autorizacao WHERE organizacao_id = $1 AND id = $2',
      [ORGANIZATION_ID, actor.id],
    );
    await directRuntimeMutationMustFail(
      `INSERT INTO public.produtores (id, organizacao_id, usuario_id, nome)
       VALUES ($1, $2, $3, 'DML indevido')`,
      [randomUUID(), ORGANIZATION_ID, actor.id],
    );
    await directRuntimeMutationMustFail(
      'UPDATE public.produtores SET nome = nome WHERE organizacao_id = $1',
      [ORGANIZATION_ID],
    );
    await directRuntimeMutationMustFail(
      'DELETE FROM public.usuarios WHERE organizacao_id = $1 AND id = $2',
      [ORGANIZATION_ID, actor.id],
    );
  });

  async function seedActiveCollaborator(): Promise<{
    readonly userId: string;
    readonly sessionId: string;
  }> {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const now = new Date();
    const client = await requireOwner().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, 'Colaborador ativo', $3, 'colaborador', 'ativo')
        `,
        [userId, ORGANIZATION_ID, `collaborator-${userId}@example.test`],
      );
      await client.query(
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, userId, phcFor('SenhaColaborador1')],
      );
      await client.query(
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
      await client.query(
        `
          INSERT INTO public.tokens_acesso (
            organizacao_id, sessao_id, token_hash,
            versao_autorizacao, expira_em
          ) VALUES ($1, $2, $3, 1, $4)
        `,
        [
          ORGANIZATION_ID,
          sessionId,
          randomBytes(32),
          new Date(now.getTime() + 15 * 60_000),
        ],
      );
      await client.query(
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
      await client.query('COMMIT');
      return { userId, sessionId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  test('cria Produtor pendente, convite, outbox, auditoria e recibo em uma transação idempotente', async () => {
    const userId = randomUUID();
    const producerId = randomUUID();
    const command = identity('usuario.criar', 'create-producer');
    const input = {
      principal: requireAdmin(),
      identity: { ...command, command: 'usuario.criar' as const },
      userId,
      producerId,
      name: 'Produtor literal',
      email: `producer-${userId}@example.test`,
      profile: 'produtor' as const,
      document: 'DOC%_\\LITERAL',
    };

    const created = await requireRepository().create(input);
    assert.deepEqual(created, {
      status: 'completed',
      httpStatus: 201,
      receipt: {
        outcome: 'criado',
        resourceType: 'usuario',
        resourceId: userId,
        version: 1,
      },
    });
    const persistedEnvelope = await requireOwner().query<{
      comando: string;
      status: string;
      sessao_id: string;
      request_id: string;
      correlation_id: string;
      codigo_http: number;
      recibo: unknown;
      criado_em: Date;
      expira_em: Date;
    }>(
      `
        SELECT comando, status, sessao_id, request_id, correlation_id,
               codigo_http, recibo, criado_em, expira_em
        FROM public.comandos_administrativos_idempotencia
        WHERE ator_usuario_id = $1 AND chave_idempotencia_hash = $2
      `,
      [requireAdmin().id, command.idempotencyKeyHash],
    );
    const envelope = persistedEnvelope.rows[0];
    assert.ok(envelope);
    validateAdministrativeIdempotencyReceipt({
      command: envelope.comando,
      state: envelope.status,
      sessionId: envelope.sessao_id,
      requestId: envelope.request_id,
      correlationId: envelope.correlation_id,
      httpStatus: envelope.codigo_http,
      receipt: envelope.recibo,
      createdAt: envelope.criado_em,
      expiresAt: envelope.expira_em,
    });
    const replayed: AdministrativeCommandResult =
      await requireRepository().create(input);
    assert.deepEqual(replayed, {
      ...created,
      status: 'replayed',
    });

    const state = await requireOwner().query<{
      usuario_status: string;
      produtor_status: string;
      convites: string;
      desafios: string;
      outbox: string;
      auditorias: string;
      comandos: string;
      recibo: Record<string, unknown>;
    }>(
      `
        SELECT usuario.status AS usuario_status,
               produtor.status AS produtor_status,
               (SELECT count(*) FROM public.convites_usuario
                WHERE usuario_id = usuario.id AND status = 'pendente')::text AS convites,
               (SELECT count(*) FROM public.desafios_autenticacao
                WHERE usuario_id = usuario.id AND status = 'ativo')::text AS desafios,
               (SELECT count(*) FROM public.outbox_email
                WHERE usuario_id = usuario.id AND status = 'pendente')::text AS outbox,
               (SELECT count(*) FROM public.eventos_auditoria
                WHERE usuario_afetado_id = usuario.id)::text AS auditorias,
               (SELECT count(*) FROM public.comandos_administrativos_idempotencia
                WHERE ator_usuario_id = $3
                  AND chave_idempotencia_hash = $4)::text AS comandos,
               comando.recibo
        FROM public.usuarios AS usuario
        JOIN public.produtores AS produtor ON produtor.usuario_id = usuario.id
        JOIN public.comandos_administrativos_idempotencia AS comando
          ON comando.ator_usuario_id = $3
         AND comando.chave_idempotencia_hash = $4
        WHERE usuario.organizacao_id = $1 AND usuario.id = $2
      `,
      [ORGANIZATION_ID, userId, requireAdmin().id, command.idempotencyKeyHash],
    );
    assert.deepEqual(state.rows[0], {
      usuario_status: 'pendente',
      produtor_status: 'inativo',
      convites: '1',
      desafios: '1',
      outbox: '1',
      auditorias: '2',
      comandos: '1',
      recibo: {
        outcome: 'criado',
        resourceId: userId,
        resourceType: 'usuario',
        version: 1,
      },
    });
    assert.equal(JSON.stringify(state.rows[0]?.recibo).includes(input.email), false);

    const phoneIdentity = identity('usuario.atualizar', 'producer-phone-only');
    assert.equal((await requireRepository().update({
      principal: requireAdmin(),
      identity: { ...phoneIdentity, command: 'usuario.atualizar' },
      userId,
      expectedVersion: 1,
      phone: '(55) 99999-0000',
    })).status, 'completed');
    const sameNameIdentity = identity('usuario.atualizar', 'producer-same-name');
    assert.deepEqual(await requireRepository().update({
      principal: requireAdmin(),
      identity: { ...sameNameIdentity, command: 'usuario.atualizar' },
      userId,
      expectedVersion: 2,
      name: input.name,
    }), { status: 'no_change' });
    const nameIdentity = identity('usuario.atualizar', 'producer-real-name');
    assert.equal((await requireRepository().update({
      principal: requireAdmin(),
      identity: { ...nameIdentity, command: 'usuario.atualizar' },
      userId,
      expectedVersion: 2,
      name: 'Produtor com nome corrigido',
    })).status, 'completed');
    const aggregateVersions = await requireOwner().query<{
      user_name: string;
      user_version: string;
      producer_name: string;
      producer_version: string;
    }>(`
      SELECT usuario.nome AS user_name, usuario.versao::text AS user_version,
             produtor.nome AS producer_name,
             produtor.versao::text AS producer_version
      FROM public.usuarios AS usuario
      JOIN public.produtores AS produtor ON produtor.usuario_id = usuario.id
      WHERE usuario.id = $1
    `, [userId]);
    assert.deepEqual(aggregateVersions.rows[0], {
      user_name: 'Produtor com nome corrigido',
      user_version: '3',
      producer_name: 'Produtor com nome corrigido',
      producer_version: '2',
    });

    const list = await requireRepository().list({
      principal: requireAdmin(),
      organizationId: ORGANIZATION_ID,
      search: '%_\\',
      limit: 10,
    });
    assert.deepEqual(list.map((item) => item.id), [userId]);

    const conflict = await requireRepository().create({
      ...input,
      identity: {
        ...input.identity,
        requestHash: hash('different-request'),
      },
    });
    assert.deepEqual(conflict, { status: 'idempotency_conflict' });
  });

  test('troca e-mail somente de pendente e substitui convite/desafio/outbox atomicamente', async () => {
    const userId = randomUUID();
    const initialEmail = `pending-before-${userId}@example.test`;
    const createIdentity = identity('usuario.criar', 'pending-email-create');
    await requireRepository().create({
      principal: requireAdmin(),
      identity: { ...createIdentity, command: 'usuario.criar' },
      userId,
      name: 'Pendente para correção',
      email: initialEmail,
      profile: 'colaborador',
    });
    const before = await requireOwner().query<{
      convite_id: string;
      desafio_id: string;
      outbox_id: string;
    }>(
      `
        SELECT convite.id AS convite_id, convite.desafio_id,
               outbox.id AS outbox_id
        FROM public.convites_usuario AS convite
        JOIN public.outbox_email AS outbox
          ON outbox.origem_tipo = 'convite' AND outbox.origem_id = convite.id
        WHERE convite.usuario_id = $1 AND convite.status = 'pendente'
      `,
      [userId],
    );
    const old = before.rows[0];
    assert.ok(old);

    const updateIdentity = identity('usuario.atualizar', 'pending-email-update');
    const newEmail = `pending-after-${userId}@example.test`;
    const result = await requireRepository().update({
      principal: requireAdmin(),
      identity: { ...updateIdentity, command: 'usuario.atualizar' },
      userId,
      expectedVersion: 1,
      email: newEmail,
    });
    assert.deepEqual(result, {
      status: 'completed',
      httpStatus: 200,
      receipt: {
        outcome: 'atualizado',
        resourceType: 'usuario',
        resourceId: userId,
        version: 2,
      },
    });
    const replaced = await requireOwner().query<{
      email: string;
      versao: string;
      old_invitation_status: string;
      old_challenge_status: string;
      old_outbox_status: string;
      new_invitations: string;
    }>(
      `
        SELECT usuario.email, usuario.versao::text,
               convite.status AS old_invitation_status,
               desafio.status AS old_challenge_status,
               outbox.status AS old_outbox_status,
               (SELECT count(*) FROM public.convites_usuario
                WHERE usuario_id = usuario.id AND status = 'pendente')::text
                 AS new_invitations
        FROM public.usuarios AS usuario
        JOIN public.convites_usuario AS convite ON convite.id = $2
        JOIN public.desafios_autenticacao AS desafio ON desafio.id = $3
        JOIN public.outbox_email AS outbox ON outbox.id = $4
        WHERE usuario.id = $1
      `,
      [userId, old.convite_id, old.desafio_id, old.outbox_id],
    );
    assert.deepEqual(replaced.rows[0], {
      email: newEmail,
      versao: '2',
      old_invitation_status: 'revogado',
      old_challenge_status: 'revogado',
      old_outbox_status: 'cancelado',
      new_invitations: '1',
    });

    const active = await seedActiveCollaborator();
    const deniedIdentity = identity('usuario.atualizar', 'active-email-denied');
    assert.deepEqual(
      await requireRepository().update({
        principal: requireAdmin(),
        identity: { ...deniedIdentity, command: 'usuario.atualizar' },
        userId: active.userId,
        expectedVersion: 1,
        email: `denied-${active.userId}@example.test`,
      }),
      { status: 'email_change_forbidden' },
    );
    const reservation = await requireOwner().query(
      `
        SELECT 1 FROM public.comandos_administrativos_idempotencia
        WHERE ator_usuario_id = $1 AND chave_idempotencia_hash = $2
      `,
      [requireAdmin().id, deniedIdentity.idempotencyKeyHash],
    );
    assert.equal(reservation.rowCount, 0);
  });

  test('inativação revoga sessões/tokens e reativação exige credencial ativa', async () => {
    const target = await seedActiveCollaborator();
    const deactivate = identity('usuario.alterar_status', 'deactivate-user');
    const result = await requireRepository().changeStatus({
      principal: requireAdmin(),
      identity: { ...deactivate, command: 'usuario.alterar_status' },
      userId: target.userId,
      expectedVersion: 1,
      status: 'inativo',
      reason: { code: 'outro', detail: 'Suspensão operacional validada' },
    });
    assert.equal(result.status, 'completed');

    const inactive = await requireOwner().query<{
      status: string;
      versao: string;
      versao_autorizacao: string;
      session_status: string;
      access_status: string;
      refresh_status: string;
    }>(
      `
        SELECT usuario.status, usuario.versao::text,
               usuario.versao_autorizacao::text,
               sessao.status AS session_status,
               acesso.status AS access_status,
               refresh.status AS refresh_status
        FROM public.usuarios AS usuario
        JOIN public.sessoes_autenticacao AS sessao ON sessao.id = $2
        JOIN public.tokens_acesso AS acesso ON acesso.sessao_id = sessao.id
        JOIN public.tokens_refresh AS refresh ON refresh.sessao_id = sessao.id
        WHERE usuario.id = $1
      `,
      [target.userId, target.sessionId],
    );
    assert.deepEqual(inactive.rows[0], {
      status: 'inativo',
      versao: '2',
      versao_autorizacao: '2',
      session_status: 'revogada',
      access_status: 'revogado',
      refresh_status: 'revogado',
    });
    const statusAudit = await requireOwner().query<{
      motivo_categoria: string;
      motivo_detalhe: string;
    }>(`
      SELECT motivo_categoria,
             metadados ->> 'motivo_detalhe' AS motivo_detalhe
      FROM public.eventos_auditoria
      WHERE evento = 'administracao.usuario.status_alterado'
        AND usuario_afetado_id = $1
      ORDER BY ocorrido_em DESC
      LIMIT 1
    `, [target.userId]);
    assert.deepEqual(statusAudit.rows[0], {
      motivo_categoria: 'outro',
      motivo_detalhe: 'Suspensão operacional validada',
    });

    const reactivate = identity('usuario.alterar_status', 'reactivate-user');
    const activated = await requireRepository().changeStatus({
      principal: requireAdmin(),
      identity: { ...reactivate, command: 'usuario.alterar_status' },
      userId: target.userId,
      expectedVersion: 2,
      status: 'ativo',
      reason: { code: 'correcao_administrativa' },
    });
    assert.deepEqual(activated, {
      status: 'completed',
      httpStatus: 200,
      receipt: {
        outcome: 'status_alterado',
        resourceType: 'usuario',
        resourceId: target.userId,
        version: 3,
      },
    });

    const selfIdentity = identity('usuario.alterar_status', 'self-deactivate');
    assert.deepEqual(
      await requireRepository().changeStatus({
        principal: requireAdmin(),
        identity: { ...selfIdentity, command: 'usuario.alterar_status' },
        userId: requireAdmin().id,
        expectedVersion: 1,
        status: 'inativo',
        reason: { code: 'outro', detail: 'Teste de proteção' },
      }),
      { status: 'self_deactivation' },
    );

    const holderUserId = randomUUID();
    const holderProducerId = randomUUID();
    const holderPropertyId = randomUUID();
    const holderSetup = await requireOwner().connect();
    try {
      await holderSetup.query('BEGIN');
      await holderSetup.query(
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, 'Titular ativo', $3, 'produtor', 'ativo')
        `,
        [
          holderUserId,
          ORGANIZATION_ID,
          `holder-${holderUserId}@example.test`,
        ],
      );
      await holderSetup.query(
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha
          ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, holderUserId, phcFor('SenhaTitular1')],
      );
      await holderSetup.query(
        `
          INSERT INTO public.produtores (
            id, organizacao_id, usuario_id, nome, status
          ) VALUES ($1, $2, $3, 'Titular ativo', 'ativo')
        `,
        [holderProducerId, ORGANIZATION_ID, holderUserId],
      );
      await holderSetup.query(
        `
          INSERT INTO public.propriedades (
            id, organizacao_id, titular_id, nome,
            municipio_id, municipio_nome, uf_id, uf_sigla, status
          ) VALUES (
            $1, $2, $3, 'Propriedade titularizada',
            '4306106', 'Cruz Alta', '43', 'RS', 'ativa'
          )
        `,
        [holderPropertyId, ORGANIZATION_ID, holderProducerId],
      );
      await holderSetup.query('COMMIT');
    } catch (error) {
      await holderSetup.query('ROLLBACK');
      throw error;
    } finally {
      holderSetup.release();
    }
    const holderIdentity = identity(
      'usuario.alterar_status',
      'active-holder-deactivate',
    );
    assert.deepEqual(
      await requireRepository().changeStatus({
        principal: requireAdmin(),
        identity: {
          ...holderIdentity,
          command: 'usuario.alterar_status',
        },
        userId: holderUserId,
        expectedVersion: 1,
        status: 'inativo',
        reason: { code: 'fim_relacao' },
      }),
      { status: 'active_holder_conflict' },
    );

    const credentiallessId = randomUUID();
    await requireOwner().query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Sem credencial', $3, 'colaborador', 'inativo')
      `,
      [
        credentiallessId,
        ORGANIZATION_ID,
        `credentialless-${credentiallessId}@example.test`,
      ],
    );
    const credentiallessIdentity = identity(
      'usuario.alterar_status',
      'credentialless-activate',
    );
    assert.deepEqual(
      await requireRepository().changeStatus({
        principal: requireAdmin(),
        identity: {
          ...credentiallessIdentity,
          command: 'usuario.alterar_status',
        },
        userId: credentiallessId,
        expectedVersion: 1,
        status: 'ativo',
        reason: { code: 'correcao_administrativa' },
      }),
      { status: 'credential_required' },
    );
  });

  test('falha após reserva reverte usuário e linha processando', async () => {
    assert.ok(runtimePool);
    const failingRepository = new PostgresAdministrativeUserRepository({
      pool: runtimePool,
      ...commonOptions,
      emailOutbox,
      actionBaseUrl: 'http://example.test/insecure',
    });
    const userId = randomUUID();
    const command = identity('usuario.criar', 'forced-rollback');
    await assert.rejects(
      failingRepository.create({
        principal: requireAdmin(),
        identity: { ...command, command: 'usuario.criar' },
        userId,
        name: 'Deve reverter',
        email: `rollback-${userId}@example.test`,
        profile: 'colaborador',
      }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 503,
    );
    const state = await requireOwner().query<{ users: string; commands: string }>(
      `
        SELECT
          (SELECT count(*) FROM public.usuarios WHERE id = $1)::text AS users,
          (SELECT count(*)
           FROM public.comandos_administrativos_idempotencia
           WHERE ator_usuario_id = $2
             AND chave_idempotencia_hash = $3)::text AS commands
      `,
      [userId, requireAdmin().id, command.idempotencyKeyHash],
    );
    assert.deepEqual(state.rows[0], { users: '0', commands: '0' });
  });

  test('serializa comandos administrativos concorrentes em duas conexões com barreira explícita', async () => {
    assert.ok(testDatabase);
    assert.ok(runtimeConnectionString);
    const leftPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeConnectionString,
      application_name: 'tche_test_mp35b_race_left',
      max: 1,
    });
    const rightPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeConnectionString,
      application_name: 'tche_test_mp35b_race_right',
      max: 1,
    });
    const left = new PostgresAdministrativeUserRepository({
      pool: leftPool,
      ...commonOptions,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const right = new PostgresAdministrativeUserRepository({
      pool: rightPool,
      ...commonOptions,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const overlapEvidence = new Map<string, readonly string[]>();

    try {
      const [leftPid, rightPid] = await Promise.all([
        leftPool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'),
        rightPool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'),
      ]);
      const leftBackendPid = leftPid.rows[0]?.pid;
      const rightBackendPid = rightPid.rows[0]?.pid;
      assert.ok(leftBackendPid);
      assert.ok(rightBackendPid);
      assert.notEqual(leftBackendPid, rightBackendPid);

      const observedRace = async <T, U>(input: {
        readonly label: string;
        readonly lockText: string;
        readonly lockSeed: number;
        readonly leftOperation: () => Promise<T>;
        readonly rightOperation: () => Promise<U>;
      }): Promise<readonly [T, U]> => {
        const controller = await requireOwner().connect();
        let lockHeld = false;
        try {
          await controller.query(
            `SELECT pg_catalog.pg_advisory_lock(
               pg_catalog.hashtextextended($1, $2)
             )`,
            [input.lockText, input.lockSeed],
          );
          lockHeld = true;
          const operations = [
            input.leftOperation(),
            input.rightOperation(),
          ] as const;
          const deadline = Date.now() + 5_000;
          let waits: readonly Readonly<{
            pid: number;
            wait_event_type: string;
            wait_event: string;
          }>[] = [];
          while (Date.now() < deadline && waits.length < 2) {
            const activity = await requireOwner().query<{
              pid: number;
              wait_event_type: string;
              wait_event: string;
            }>(
              `
                SELECT pid, wait_event_type, wait_event
                FROM pg_catalog.pg_stat_activity
                WHERE pid = ANY($1::integer[])
                  AND state = 'active'
                  AND wait_event_type = 'Lock'
                  AND query LIKE '%tche_admin_%_usuario_mp35b%'
                ORDER BY pid
              `,
              [[leftBackendPid, rightBackendPid]],
            );
            waits = activity.rows;
            if (waits.length < 2) {
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          }
          assert.deepEqual(
            waits.map((row) => row.pid).sort((leftValue, rightValue) => leftValue - rightValue),
            [leftBackendPid, rightBackendPid].sort((leftValue, rightValue) => leftValue - rightValue),
            `${input.label}: ambas as conexões devem aguardar lock no PostgreSQL`,
          );
          overlapEvidence.set(
            input.label,
            waits.map(
              (row) => `${row.pid}:${row.wait_event_type}:${row.wait_event}`,
            ),
          );
          await controller.query(
            `SELECT pg_catalog.pg_advisory_unlock(
               pg_catalog.hashtextextended($1, $2)
             )`,
            [input.lockText, input.lockSeed],
          );
          lockHeld = false;
          return Promise.all(operations);
        } finally {
          if (lockHeld) {
            await controller.query(
              `SELECT pg_catalog.pg_advisory_unlock(
                 pg_catalog.hashtextextended($1, $2)
               )`,
              [input.lockText, input.lockSeed],
            );
          }
          controller.release();
        }
      };

      const sameUserId = randomUUID();
      const sameIdentity = identity('usuario.criar', 'race-idem-same');
      const sameInput = {
        principal: requireAdmin(),
        identity: { ...sameIdentity, command: 'usuario.criar' as const },
        userId: sameUserId,
        name: 'Idempotência concorrente igual',
        email: `race-idem-same-${sameUserId}@example.test`,
        profile: 'colaborador' as const,
      };
      const sameResults = await observedRace({
        label: 'same-idempotency-key-same-body',
        lockText: `${ORGANIZATION_ID}:${requireAdmin().id}:${sameIdentity.idempotencyKeyHash.toString('hex')}`,
        lockSeed: 35000036,
        leftOperation: () => left.create(sameInput),
        rightOperation: () => right.create(sameInput),
      });
      assert.deepEqual(
        sameResults.map((result) => result.status).sort(),
        ['completed', 'replayed'],
      );
      const samePersisted = await requireOwner().query<{
        total: string;
        commands: string;
        processing: string;
      }>(
        `
          SELECT
            (SELECT count(*)::text FROM public.usuarios WHERE id = $1) AS total,
            (SELECT count(*)::text
             FROM public.comandos_administrativos_idempotencia
             WHERE ator_usuario_id = $2 AND chave_idempotencia_hash = $3) AS commands,
            (SELECT count(*)::text
             FROM public.comandos_administrativos_idempotencia
             WHERE ator_usuario_id = $2 AND chave_idempotencia_hash = $3
               AND status = 'processando') AS processing
        `,
        [sameUserId, requireAdmin().id, sameIdentity.idempotencyKeyHash],
      );
      assert.deepEqual(samePersisted.rows[0], {
        total: '1',
        commands: '1',
        processing: '0',
      });

      const divergentIdentity = identity('usuario.criar', 'race-idem-different');
      const divergentLeftId = randomUUID();
      const divergentRightId = randomUUID();
      const divergentResults = await observedRace({
        label: 'same-idempotency-key-different-body',
        lockText: `${ORGANIZATION_ID}:${requireAdmin().id}:${divergentIdentity.idempotencyKeyHash.toString('hex')}`,
        lockSeed: 35000036,
        leftOperation: () => left.create({
          principal: requireAdmin(),
          identity: { ...divergentIdentity, command: 'usuario.criar' },
          userId: divergentLeftId,
          name: 'Payload concorrente esquerdo',
          email: `race-idem-left-${divergentLeftId}@example.test`,
          profile: 'colaborador',
        }),
        rightOperation: () => right.create({
          principal: requireAdmin(),
          identity: {
            ...divergentIdentity,
            command: 'usuario.criar',
            requestHash: hash('race-idem-different-payload'),
          },
          userId: divergentRightId,
          name: 'Payload concorrente direito',
          email: `race-idem-right-${divergentRightId}@example.test`,
          profile: 'colaborador',
        }),
      });
      assert.deepEqual(
        divergentResults.map((result) => result.status).sort(),
        ['completed', 'idempotency_conflict'],
      );
      const divergentPersisted = await requireOwner().query<{ total: string }>(
        `SELECT count(*)::text AS total FROM public.usuarios WHERE id = ANY($1::uuid[])`,
        [[divergentLeftId, divergentRightId]],
      );
      assert.equal(divergentPersisted.rows[0]?.total, '1');

      const updateUserId = randomUUID();
      await requireRepository().create({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.criar', 'race-update-seed'),
          command: 'usuario.criar',
        },
        userId: updateUserId,
        name: 'Atualização concorrente',
        email: `race-update-${updateUserId}@example.test`,
        profile: 'colaborador',
      });
      const updateResults = await observedRace({
        label: 'same-version-updates',
        lockText: `${ORGANIZATION_ID}:${updateUserId}`,
        lockSeed: 35000035,
        leftOperation: () => left.update({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.atualizar', 'race-update-left'),
            command: 'usuario.atualizar',
          },
          userId: updateUserId,
          expectedVersion: 1,
          name: 'Atualização concorrente esquerda',
        }),
        rightOperation: () => right.update({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.atualizar', 'race-update-right'),
            command: 'usuario.atualizar',
          },
          userId: updateUserId,
          expectedVersion: 1,
          name: 'Atualização concorrente direita',
        }),
      });
      assert.deepEqual(
        updateResults.map((result) => result.status).sort(),
        ['completed', 'version_conflict'],
      );
      const updateVersion = await requireOwner().query<{ versao: string }>(
        `SELECT versao::text FROM public.usuarios WHERE id = $1`,
        [updateUserId],
      );
      assert.equal(updateVersion.rows[0]?.versao, '2');

      const emailUserId = randomUUID();
      await requireRepository().create({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.criar', 'race-email-seed'),
          command: 'usuario.criar',
        },
        userId: emailUserId,
        name: 'E-mail concorrente',
        email: `race-email-${emailUserId}@example.test`,
        profile: 'colaborador',
      });
      const emailResults = await observedRace({
        label: 'concurrent-email-changes',
        lockText: `${ORGANIZATION_ID}:${emailUserId}`,
        lockSeed: 35000035,
        leftOperation: () => left.update({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.atualizar', 'race-email-left'),
            command: 'usuario.atualizar',
          },
          userId: emailUserId,
          expectedVersion: 1,
          email: `race-email-left-${emailUserId}@example.test`,
        }),
        rightOperation: () => right.update({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.atualizar', 'race-email-right'),
            command: 'usuario.atualizar',
          },
          userId: emailUserId,
          expectedVersion: 1,
          email: `race-email-right-${emailUserId}@example.test`,
        }),
      });
      assert.deepEqual(
        emailResults.map((result) => result.status).sort(),
        ['completed', 'version_conflict'],
      );
      const emailState = await requireOwner().query<{
        invitations: string;
        challenges: string;
        outbox: string;
      }>(
        `
          SELECT
            (SELECT count(*)::text FROM public.convites_usuario
             WHERE usuario_id = $1 AND status = 'pendente') AS invitations,
            (SELECT count(*)::text FROM public.desafios_autenticacao
             WHERE usuario_id = $1 AND status = 'ativo') AS challenges,
            (SELECT count(*)::text FROM public.outbox_email
             WHERE usuario_id = $1 AND status = 'pendente') AS outbox
        `,
        [emailUserId],
      );
      assert.deepEqual(emailState.rows[0], {
        invitations: '1',
        challenges: '1',
        outbox: '1',
      });

      const invitationResults = await observedRace({
        label: 'concurrent-invitation-reissues',
        lockText: `${ORGANIZATION_ID}:${emailUserId}`,
        lockSeed: 35000035,
        leftOperation: () => left.issueInvitation({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.emitir_convite', 'race-invitation-left'),
            command: 'usuario.emitir_convite',
          },
          userId: emailUserId,
        }),
        rightOperation: () => right.issueInvitation({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.emitir_convite', 'race-invitation-right'),
            command: 'usuario.emitir_convite',
          },
          userId: emailUserId,
        }),
      });
      assert.deepEqual(
        invitationResults.map((result) => result.status).sort(),
        ['completed', 'completed'],
      );
      const invitationState = await requireOwner().query<{
        invitations: string;
        challenges: string;
        outbox: string;
      }>(
        `
          SELECT
            (SELECT count(*)::text FROM public.convites_usuario
             WHERE usuario_id = $1 AND status = 'pendente') AS invitations,
            (SELECT count(*)::text FROM public.desafios_autenticacao
             WHERE usuario_id = $1 AND status = 'ativo') AS challenges,
            (SELECT count(*)::text FROM public.outbox_email
             WHERE usuario_id = $1 AND status = 'pendente') AS outbox
        `,
        [emailUserId],
      );
      assert.deepEqual(invitationState.rows[0], {
        invitations: '1',
        challenges: '1',
        outbox: '1',
      });

      const statusTarget = await seedActiveCollaborator();
      const statusResults = await observedRace({
        label: 'concurrent-status-changes',
        lockText: ORGANIZATION_ID,
        lockSeed: 35000037,
        leftOperation: () => left.changeStatus({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.alterar_status', 'race-status-left'),
            command: 'usuario.alterar_status',
          },
          userId: statusTarget.userId,
          expectedVersion: 1,
          status: 'inativo',
          reason: { code: 'fim_relacao' },
        }),
        rightOperation: () => right.changeStatus({
          principal: requireAdmin(),
          identity: {
            ...identity('usuario.alterar_status', 'race-status-right'),
            command: 'usuario.alterar_status',
          },
          userId: statusTarget.userId,
          expectedVersion: 1,
          status: 'inativo',
          reason: { code: 'fim_relacao' },
        }),
      });
      assert.deepEqual(
        statusResults.map((result) => result.status).sort(),
        ['completed', 'version_conflict'],
      );
      const statusState = await requireOwner().query<{
        status: string;
        versao: string;
        session_status: string;
      }>(
        `
          SELECT usuario.status, usuario.versao::text,
                 sessao.status AS session_status
          FROM public.usuarios AS usuario
          JOIN public.sessoes_autenticacao AS sessao
            ON sessao.usuario_id = usuario.id
          WHERE usuario.id = $1 AND sessao.id = $2
        `,
        [statusTarget.userId, statusTarget.sessionId],
      );
      assert.deepEqual(statusState.rows[0], {
        status: 'inativo',
        versao: '2',
        session_status: 'revogada',
      });
      assert.deepEqual(
        [...overlapEvidence.keys()].sort(),
        [
          'concurrent-email-changes',
          'concurrent-invitation-reissues',
          'concurrent-status-changes',
          'same-idempotency-key-different-body',
          'same-idempotency-key-same-body',
          'same-version-updates',
        ],
      );
      for (const waits of overlapEvidence.values()) assert.equal(waits.length, 2);
      const orphanedReservations = await requireOwner().query<{ total: string }>(
        `
          SELECT count(*)::text AS total
          FROM public.comandos_administrativos_idempotencia
          WHERE request_id LIKE 'request-race-%' AND status = 'processando'
        `,
      );
      assert.equal(orphanedReservations.rows[0]?.total, '0');
    } finally {
      await Promise.all([leftPool.end(), rightPool.end()]);
    }
  });

  test('serializa inativação de Produtor versus ativação de Propriedade e preserva a invariável', async () => {
    const userId = randomUUID();
    const producerId = randomUUID();
    const propertyId = randomUUID();
    const setupClient = await requireOwner().connect();
    try {
      await setupClient.query('BEGIN');
      await setupClient.query(
        `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES ($1, $2, 'Produtor da corrida', $3, 'produtor', 'ativo')
        `,
        [userId, ORGANIZATION_ID, `race-holder-${userId}@example.test`],
      );
      await setupClient.query(
        `
        INSERT INTO public.credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        ) VALUES ($1, $2, $3, 'integration-v1')
        `,
        [ORGANIZATION_ID, userId, phcFor('SenhaProdutorRace1')],
      );
      await setupClient.query(
        `
        INSERT INTO public.produtores (
          id, organizacao_id, usuario_id, nome, status
        ) VALUES ($1, $2, $3, 'Produtor da corrida', 'ativo')
        `,
        [producerId, ORGANIZATION_ID, userId],
      );
      await setupClient.query(
        `
        INSERT INTO public.propriedades (
          id, organizacao_id, titular_id, nome,
          municipio_id, municipio_nome, uf_id, uf_sigla, status
        ) VALUES (
          $1, $2, $3, 'Propriedade da corrida',
          '4306106', 'Cruz Alta', '43', 'RS', 'inativa'
        )
        `,
        [propertyId, ORGANIZATION_ID, producerId],
      );
      await setupClient.query('COMMIT');
    } catch (error) {
      await setupClient.query('ROLLBACK');
      throw error;
    } finally {
      setupClient.release();
    }
    assert.ok(testDatabase);
    assert.ok(runtimeConnectionString);
    const statusPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeConnectionString,
      application_name: 'tche_test_mp35b_holder_status',
      max: 1,
    });
    const propertyPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      application_name: 'tche_test_mp35b_property_activation',
      max: 1,
    });
    const statusRepository = new PostgresAdministrativeUserRepository({
      pool: statusPool,
      ...commonOptions,
      emailOutbox,
      actionBaseUrl: ACTION_URL,
    });
    const lockController = await requireOwner().connect();
    let organizationLockHeld = false;
    try {
      const [statusPidResult, propertyPidResult] = await Promise.all([
        statusPool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'),
        propertyPool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'),
      ]);
      const statusPid = statusPidResult.rows[0]?.pid;
      const propertyPid = propertyPidResult.rows[0]?.pid;
      assert.ok(statusPid);
      assert.ok(propertyPid);
      assert.notEqual(statusPid, propertyPid);

      await lockController.query(
        `SELECT pg_catalog.pg_advisory_lock(
           pg_catalog.hashtextextended($1, 35000037)
         )`,
        [ORGANIZATION_ID],
      );
      organizationLockHeld = true;
      const statusOperation = statusRepository.changeStatus({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.alterar_status', 'race-holder-deactivate'),
          command: 'usuario.alterar_status',
        },
        userId,
        expectedVersion: 1,
        status: 'inativo',
        reason: { code: 'fim_relacao' },
      });
      const propertyOperation = (async () => {
        const propertyClient = await propertyPool.connect();
        try {
          await propertyClient.query('BEGIN');
          await propertyClient.query(
            `UPDATE public.propriedades SET status = 'ativa' WHERE id = $1`,
            [propertyId],
          );
          await propertyClient.query('COMMIT');
          return 'completed' as const;
        } catch {
          await propertyClient.query('ROLLBACK');
          return 'rejected' as const;
        } finally {
          propertyClient.release();
        }
      })();

      const deadline = Date.now() + 5_000;
      let waits: readonly Readonly<{
        pid: number;
        wait_event_type: string;
        wait_event: string;
      }>[] = [];
      while (Date.now() < deadline && waits.length < 2) {
        const activity = await requireOwner().query<{
          pid: number;
          wait_event_type: string;
          wait_event: string;
        }>(
          `
            SELECT pid, wait_event_type, wait_event
            FROM pg_catalog.pg_stat_activity
            WHERE pid = ANY($1::integer[])
              AND state = 'active' AND wait_event_type = 'Lock'
            ORDER BY pid
          `,
          [[statusPid, propertyPid]],
        );
        waits = activity.rows;
        if (waits.length < 2) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      assert.deepEqual(
        waits.map((row) => row.pid).sort((leftValue, rightValue) => leftValue - rightValue),
        [statusPid, propertyPid].sort((leftValue, rightValue) => leftValue - rightValue),
        'status e ativação da Propriedade devem sobrepor no lock PostgreSQL',
      );
      assert.deepEqual(
        waits.map((row) => `${row.wait_event_type}:${row.wait_event}`),
        ['Lock:advisory', 'Lock:advisory'],
      );
      await lockController.query(
        `SELECT pg_catalog.pg_advisory_unlock(
           pg_catalog.hashtextextended($1, 35000037)
         )`,
        [ORGANIZATION_ID],
      );
      organizationLockHeld = false;
      const [statusResult, propertyResult] = await Promise.all([
        statusOperation,
        propertyOperation,
      ]);
      assert.equal(
        [statusResult.status, propertyResult].filter(
          (result) => result === 'completed',
        ).length,
        1,
      );
      const finalState = await requireOwner().query<{
        user_status: string;
        producer_status: string;
        property_status: string;
      }>(
        `
          SELECT usuario.status AS user_status,
                 produtor.status AS producer_status,
                 propriedade.status AS property_status
          FROM public.usuarios AS usuario
          JOIN public.produtores AS produtor ON produtor.usuario_id = usuario.id
          JOIN public.propriedades AS propriedade ON propriedade.titular_id = produtor.id
          WHERE usuario.id = $1 AND propriedade.id = $2
        `,
        [userId, propertyId],
      );
      const state = finalState.rows[0];
      assert.ok(state);
      assert.equal(
        state.property_status === 'ativa'
          && (state.user_status !== 'ativo' || state.producer_status !== 'ativo'),
        false,
      );
    } finally {
      if (organizationLockHeld) {
        await lockController.query(
          `SELECT pg_catalog.pg_advisory_unlock(
             pg_catalog.hashtextextended($1, 35000037)
           )`,
          [ORGANIZATION_ID],
        );
      }
      lockController.release();
      await Promise.all([statusPool.end(), propertyPool.end()]);
    }
  });

  test('substituição de convite e dispatch do outbox são linearizáveis pelo mesmo lock', async () => {
    assert.ok(testDatabase);
    assert.ok(runtimeLoginRole);
    const userId = randomUUID();
    const created = await requireRepository().create({
      principal: requireAdmin(),
      identity: {
        ...identity('usuario.criar', 'outbox-linearizable-create'),
        command: 'usuario.criar',
      },
      userId,
      name: 'Convite concorrente',
      email: `outbox-linearizable-${userId}@example.test`,
      profile: 'colaborador',
    });
    assert.equal(created.status, 'completed');

    const workerLoginRole =
      `tche_test_worker_mp35b_${randomUUID().replaceAll('-', '')}`;
    const workerPassword = randomBytes(24).toString('hex');
    await requireOwner().query(
      `CREATE ROLE ${workerLoginRole} LOGIN PASSWORD '${workerPassword}'`,
    );
    await requireOwner().query(
      `GRANT tche_agro_outbox_worker TO ${workerLoginRole}`,
    );
    const workerUrl = new URL(testDatabase.connectionString);
    workerUrl.username = workerLoginRole;
    workerUrl.password = workerPassword;
    const workerPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: workerUrl.toString(),
      application_name: workerLoginRole,
    });

    try {
      const outbox = new PostgresOutboxRepository({ pool: workerPool });
      const firstClaimAt = new Date();
      const firstClaims = await outbox.claimReady({
        workerId: 'mp35b-linearizable-worker',
        limit: 500,
        now: firstClaimAt,
        leaseExpiresAt: new Date(firstClaimAt.getTime() + 60_000),
      });
      const firstMessage = firstClaims.find((message) => message.userId === userId);
      assert.ok(firstMessage);

      let enterDispatch!: () => void;
      let releaseDispatch!: () => void;
      const dispatchEntered = new Promise<void>((resolve) => {
        enterDispatch = resolve;
      });
      const dispatchRelease = new Promise<void>((resolve) => {
        releaseDispatch = resolve;
      });
      const dispatch = outbox.dispatchUnderEntityLock({
        message: firstMessage,
        dispatch: async () => {
          enterDispatch();
          await dispatchRelease;
          return {
            status: 'delivered',
            occurredAt: new Date(),
            providerMessageId: 'provider-linearizable-first',
          };
        },
      });
      await dispatchEntered;

      let replacementSettled = false;
      const replacement = requireRepository().issueInvitation({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.emitir_convite', 'outbox-linearizable-replace'),
          command: 'usuario.emitir_convite',
        },
        userId,
      }).finally(() => {
        replacementSettled = true;
      });

      const waitDeadline = Date.now() + 5_000;
      let replacementWaitingForLock = false;
      while (Date.now() < waitDeadline && !replacementWaitingForLock) {
        const activity = await requireOwner().query<{ waiting: boolean }>(
          `
            SELECT EXISTS (
              SELECT 1 FROM pg_catalog.pg_stat_activity
              WHERE application_name = $1 AND state = 'active'
                AND wait_event_type = 'Lock'
                AND query LIKE '%tche_admin_emitir_convite_usuario_mp35b%'
            ) AS waiting
          `,
          [runtimeLoginRole],
        );
        replacementWaitingForLock = activity.rows[0]?.waiting === true;
        if (!replacementWaitingForLock) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      assert.equal(replacementWaitingForLock, true);
      assert.equal(replacementSettled, false);

      releaseDispatch();
      assert.equal(await dispatch, 'delivered');
      assert.equal((await replacement).status, 'completed');

      const afterFirstOrdering = await requireOwner().query<{
        old_outbox_status: string;
        active_invitations: string;
        active_challenges: string;
        pending_outbox: string;
      }>(
        `
          SELECT mensagem.status AS old_outbox_status,
                 (SELECT count(*)::text FROM public.convites_usuario
                  WHERE usuario_id = $2 AND status = 'pendente') AS active_invitations,
                 (SELECT count(*)::text FROM public.desafios_autenticacao
                  WHERE usuario_id = $2 AND status = 'ativo') AS active_challenges,
                 (SELECT count(*)::text FROM public.outbox_email
                  WHERE usuario_id = $2 AND status = 'pendente') AS pending_outbox
          FROM public.outbox_email AS mensagem WHERE mensagem.id = $1
        `,
        [firstMessage.id, userId],
      );
      assert.deepEqual(afterFirstOrdering.rows[0], {
        old_outbox_status: 'enviado',
        active_invitations: '1',
        active_challenges: '1',
        pending_outbox: '1',
      });

      const secondClaimAt = new Date();
      const secondClaims = await outbox.claimReady({
        workerId: 'mp35b-linearizable-worker',
        limit: 500,
        now: secondClaimAt,
        leaseExpiresAt: new Date(secondClaimAt.getTime() + 60_000),
      });
      const secondMessage = secondClaims.find((message) => message.userId === userId);
      assert.ok(secondMessage);
      const replacementBeforeDispatch = await requireRepository().issueInvitation({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.emitir_convite', 'outbox-replace-before-dispatch'),
          command: 'usuario.emitir_convite',
        },
        userId,
      });
      assert.equal(replacementBeforeDispatch.status, 'completed');

      let staleDispatcherCalled = false;
      const staleResult = await outbox.dispatchUnderEntityLock({
        message: secondMessage,
        dispatch: async () => {
          staleDispatcherCalled = true;
          return { status: 'delivered', occurredAt: new Date() };
        },
      });
      assert.equal(staleResult, 'stale');
      assert.equal(staleDispatcherCalled, false);
      const afterSecondOrdering = await requireOwner().query<{
        old_outbox_status: string;
        old_challenge_status: string;
        active_invitations: string;
        active_challenges: string;
        pending_outbox: string;
      }>(
        `
          SELECT mensagem.status AS old_outbox_status,
                 desafio.status AS old_challenge_status,
                 (SELECT count(*)::text FROM public.convites_usuario
                  WHERE usuario_id = $3 AND status = 'pendente') AS active_invitations,
                 (SELECT count(*)::text FROM public.desafios_autenticacao
                  WHERE usuario_id = $3 AND status = 'ativo') AS active_challenges,
                 (SELECT count(*)::text FROM public.outbox_email
                  WHERE usuario_id = $3 AND status = 'pendente') AS pending_outbox
          FROM public.outbox_email AS mensagem
          JOIN public.desafios_autenticacao AS desafio ON desafio.id = $2
          WHERE mensagem.id = $1
        `,
        [secondMessage.id, secondMessage.challengeId, userId],
      );
      assert.deepEqual(afterSecondOrdering.rows[0], {
        old_outbox_status: 'cancelado',
        old_challenge_status: 'revogado',
        active_invitations: '1',
        active_challenges: '1',
        pending_outbox: '1',
      });

      const expiringUserId = randomUUID();
      const expiringCreated = await requireRepository().create({
        principal: requireAdmin(),
        identity: {
          ...identity('usuario.criar', 'outbox-expire-behind-lock'),
          command: 'usuario.criar',
        },
        userId: expiringUserId,
        name: 'Convite que expira atrás do lock',
        email: `outbox-expiring-${expiringUserId}@example.test`,
        profile: 'colaborador',
      });
      assert.equal(expiringCreated.status, 'completed');
      const expiringClaimAt = new Date();
      const expiringClaims = await outbox.claimReady({
        workerId: 'mp35b-expiring-worker',
        limit: 500,
        now: expiringClaimAt,
        leaseExpiresAt: new Date(expiringClaimAt.getTime() + 2_000),
      });
      const expiringMessage = expiringClaims.find(
        (message) => message.userId === expiringUserId,
      );
      assert.ok(expiringMessage);
      assert.ok(expiringMessage.challengeId);

      const expiresAt = new Date(Date.now() + 2_000);
      const expirySetup = await requireOwner().connect();
      try {
        await expirySetup.query('BEGIN');
        await expirySetup.query(
          `UPDATE public.outbox_email SET expira_em = $2 WHERE id = $1`,
          [expiringMessage.id, expiresAt],
        );
        await expirySetup.query(
          `UPDATE public.desafios_autenticacao SET expira_em = $2 WHERE id = $1`,
          [expiringMessage.challengeId, expiresAt],
        );
        await expirySetup.query(
          `UPDATE public.convites_usuario SET expira_em = $2
           WHERE desafio_id = $1`,
          [expiringMessage.challengeId, expiresAt],
        );
        await expirySetup.query('COMMIT');
      } catch (error) {
        await expirySetup.query('ROLLBACK');
        throw error;
      } finally {
        expirySetup.release();
      }

      const lockController = await requireOwner().connect();
      let entityLockHeld = false;
      try {
        await lockController.query(
          `SELECT pg_catalog.pg_advisory_lock(
             pg_catalog.hashtextextended($1 || ':' || $2, 35000035)
           )`,
          [ORGANIZATION_ID, expiringUserId],
        );
        entityLockHeld = true;
        let expiredDispatcherCalled = false;
        const expiredDispatch = outbox.dispatchUnderEntityLock({
          message: expiringMessage,
          dispatch: async () => {
            expiredDispatcherCalled = true;
            return { status: 'delivered', occurredAt: new Date() };
          },
        });

        const waitDeadline = Date.now() + 5_000;
        let workerWaitingForLock = false;
        while (Date.now() < waitDeadline && !workerWaitingForLock) {
          const activity = await requireOwner().query<{ waiting: boolean }>(
            `
              SELECT EXISTS (
                SELECT 1 FROM pg_catalog.pg_stat_activity
                WHERE application_name = $1 AND state = 'active'
                  AND wait_event_type = 'Lock'
                  AND query LIKE '%pg_advisory_xact_lock%'
              ) AS waiting
            `,
            [workerLoginRole],
          );
          workerWaitingForLock = activity.rows[0]?.waiting === true;
          if (!workerWaitingForLock) {
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }
        assert.equal(
          workerWaitingForLock,
          true,
          'o worker deve estar observavelmente bloqueado no PostgreSQL',
        );

        let persistentClockPassedExpiry = false;
        while (Date.now() < waitDeadline && !persistentClockPassedExpiry) {
          const clock = await requireOwner().query<{ expired: boolean }>(
            `SELECT pg_catalog.clock_timestamp() > $1 AS expired`,
            [expiresAt],
          );
          persistentClockPassedExpiry = clock.rows[0]?.expired === true;
          if (!persistentClockPassedExpiry) {
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }
        assert.equal(persistentClockPassedExpiry, true);
        await lockController.query(
          `SELECT pg_catalog.pg_advisory_unlock(
             pg_catalog.hashtextextended($1 || ':' || $2, 35000035)
           )`,
          [ORGANIZATION_ID, expiringUserId],
        );
        entityLockHeld = false;

        assert.equal(await expiredDispatch, 'cancelled');
        assert.equal(expiredDispatcherCalled, false);
        const expiredState = await requireOwner().query<{
          status: string;
          erro_categoria: string;
          enviado_em: Date | null;
          lease_token: string | null;
        }>(
          `SELECT status, erro_categoria, enviado_em, lease_token
           FROM public.outbox_email WHERE id = $1`,
          [expiringMessage.id],
        );
        assert.deepEqual(expiredState.rows[0], {
          status: 'expirado',
          erro_categoria: 'message_expired',
          enviado_em: null,
          lease_token: null,
        });
      } finally {
        if (entityLockHeld) {
          await lockController.query(
            `SELECT pg_catalog.pg_advisory_unlock(
               pg_catalog.hashtextextended($1 || ':' || $2, 35000035)
             )`,
            [ORGANIZATION_ID, expiringUserId],
          );
        }
        lockController.release();
      }
    } finally {
      await workerPool.end();
      await requireOwner().query(`DROP ROLE IF EXISTS ${workerLoginRole}`);
    }
  });

  test('lista e detalhe respondem 401 quando a sessão Admin muda após autenticação', async () => {
    const actor = requireAdmin();
    const visible = await requireRepository().list({
      principal: actor,
      organizationId: ORGANIZATION_ID,
      limit: 10,
    });
    assert.ok(visible.length > 0);

    await requireOwner().query(
      `
        UPDATE public.sessoes_autenticacao
        SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
            motivo_revogacao = 'teste_mp35b'
        WHERE id = $1
      `,
      [actor.sessionId],
    );
    await assert.rejects(
      requireRepository().list({
        principal: actor,
        organizationId: ORGANIZATION_ID,
        limit: 10,
      }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 401
        && error.code === 'invalid_session',
    );
    await assert.rejects(
      requireRepository().findById({
        principal: actor,
        organizationId: ORGANIZATION_ID,
        userId: actor.id,
      }),
      (error: unknown) =>
        error instanceof HttpError
        && error.statusCode === 401
        && error.code === 'invalid_session',
    );
  });
});
