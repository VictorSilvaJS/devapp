import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool, type PoolClient, type QueryConfig } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import type { AuthenticatedPrincipal, UserProfile } from '../../src/auth/contracts.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { PostgresNotificationRepository } from '../../src/notifications/postgres-notification-repository.js';
import { PostgresNotificationPurgeRepository } from '../../src/notifications/purge.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';

interface Fixture {
  readonly producer: AuthenticatedPrincipal;
  readonly admin: AuthenticatedPrincipal;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function requestDigest(command: string, targetId?: string): Buffer {
  return digest(`${command}\u0000${targetId ?? ''}`);
}

describe('MP-34 notification persistence', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let pool: Pool | undefined;
  let runtimePool: Pool | undefined;
  let runtimeLoginRole: string | undefined;
  let repository: PostgresNotificationRepository | undefined;
  let fixture: Fixture | undefined;
  let lastDatabaseError: unknown;

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    testDatabase = await startPostgisTestDatabase();
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({ command: 'up', database: testDatabase.database });
    pool = new Pool(buildPostgresPoolConfig(testDatabase.database));
    fixture = await seedFixture(pool);
    runtimeLoginRole =
      `tche_test_runtime_notifications_${randomUUID().replaceAll('-', '')}`;
    const runtimePassword = randomBytes(24).toString('hex');
    await pool.query(
      `CREATE ROLE ${runtimeLoginRole} LOGIN PASSWORD '${runtimePassword}'`,
    );
    await pool.query(`GRANT tche_agro_runtime TO ${runtimeLoginRole}`);
    const runtimeUrl = new URL(testDatabase.connectionString);
    runtimeUrl.username = runtimeLoginRole;
    runtimeUrl.password = runtimePassword;
    runtimePool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: runtimeUrl.toString(),
      application_name: runtimeLoginRole,
    });
    repository = new PostgresNotificationRepository({
      async connect() {
        const client = await runtimePool!.connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return async (config: QueryConfig | string) => {
                try {
                  return await target.query(config as QueryConfig);
                } catch (error) {
                  lastDatabaseError = error;
                  throw error;
                }
              };
            }
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }) as PoolClient;
      },
    });
  });

  after(async () => {
    await runtimePool?.end();
    if (pool !== undefined && runtimeLoginRole !== undefined) {
      await pool.query(`DROP ROLE IF EXISTS ${runtimeLoginRole}`);
    }
    await pool?.end();
    await testDatabase?.container.stop();
  });

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
  }

  function requireRuntimePool(): Pool {
    assert.ok(runtimePool);
    return runtimePool;
  }

  function requireRepository(): PostgresNotificationRepository {
    assert.ok(repository);
    return repository;
  }

  function requireFixture(): Fixture {
    assert.ok(fixture);
    return fixture;
  }

  test('isola destinatários, serializa comandos e preserva replay após descarte, expiração e purga', async () => {
    const database = requirePool();
    const notifications = requireRepository();
    const actors = requireFixture();
    const producerFirst = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.senha_alterada.v1',
      authorUserId: actors.producer.id,
    });
    const producerSecond = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.email_principal_alterado.v1',
    });
    const adminOnly = await createNotification(database, {
      recipient: actors.admin,
      eventType: 'conta.recuperacao_concluida.v1',
    });

    const producerRows = await notifications.list({
      principal: actors.producer,
      state: 'todas',
      limit: 20,
    });
    assert.deepEqual(
      new Set(producerRows.map((row) => row.id)),
      new Set([producerFirst.deliveryId, producerSecond.deliveryId]),
    );
    assert.equal(producerRows.some((row) => row.id === adminOnly.deliveryId), false);
    assert.deepEqual(
      (await notifications.list({
        principal: actors.admin,
        state: 'todas',
        limit: 20,
      })).map((row) => row.id),
      [adminOnly.deliveryId],
    );
    assert.equal(
      await notifications.countUnread({ principal: actors.producer }),
      2,
    );

    const firstKey = digest('read-first-key');
    const firstRequest = requestDigest('leitura', producerFirst.deliveryId);
    const firstRead = await notifications
      .markRead({
        principal: actors.producer,
        notificationId: producerFirst.deliveryId,
        idempotencyKeyHash: firstKey,
        requestHash: firstRequest,
        requestId: 'notification-integration-read-1',
      })
      .catch((error: unknown) => {
        const databaseMessage =
          lastDatabaseError instanceof Error
            ? `${lastDatabaseError.message}; ${(lastDatabaseError as { readonly where?: string }).where ?? 'sem contexto SQL'}`
            : String(lastDatabaseError);
        assert.fail(
          `notification command failed (${String(error)}): ${databaseMessage}`,
        );
      });
    assert.equal(firstRead.status, 'completed');
    assert.equal(firstRead.status === 'completed' && firstRead.replayed, false);
    const firstReplay = await notifications.markRead({
      principal: actors.producer,
      notificationId: producerFirst.deliveryId,
      idempotencyKeyHash: firstKey,
      requestHash: firstRequest,
      requestId: 'notification-integration-read-replay',
    });
    assert.deepEqual(firstReplay, {
      ...firstRead,
      replayed: true,
    });
    assert.deepEqual(
      await notifications.markRead({
        principal: actors.producer,
        notificationId: producerSecond.deliveryId,
        idempotencyKeyHash: firstKey,
        requestHash: requestDigest('leitura', producerSecond.deliveryId),
        requestId: 'notification-integration-read-conflict',
      }),
      { status: 'conflict' },
    );

    const secondKey = digest('read-already-read-key');
    const secondRead = await notifications.markRead({
      principal: actors.producer,
      notificationId: producerFirst.deliveryId,
      idempotencyKeyHash: secondKey,
      requestHash: firstRequest,
      requestId: 'notification-integration-already-read',
    });
    assert.equal(secondRead.status, 'completed');
    if (firstRead.status !== 'completed' || secondRead.status !== 'completed') {
      assert.fail('read commands must complete');
    }
    assert.deepEqual(secondRead.value, firstRead.value);
    const commandTimes = await database.query<{
      resultado_em: Date;
      processado_em: Date;
      expira_em: Date;
    }>(
      `
        SELECT resultado_em, processado_em, expira_em
        FROM public.notificacao_comando_idempotencia
        WHERE usuario_id = $1 AND chave_idempotencia_hash = $2
      `,
      [actors.producer.id, secondKey],
    );
    const commandTime = commandTimes.rows[0];
    assert.ok(commandTime);
    assert.ok(commandTime.resultado_em <= commandTime.processado_em);
    assert.equal(
      commandTime.expira_em.getTime() - commandTime.processado_em.getTime(),
      90 * 24 * 60 * 60 * 1_000,
    );

    const concurrentKey = digest('concurrent-read-key');
    const concurrentInput = {
      principal: actors.producer,
      notificationId: producerSecond.deliveryId,
      idempotencyKeyHash: concurrentKey,
      requestHash: requestDigest('leitura', producerSecond.deliveryId),
      requestId: 'notification-integration-concurrent',
    } as const;
    const concurrent = await Promise.all([
      notifications.markRead(concurrentInput),
      notifications.markRead(concurrentInput),
    ]);
    assert.equal(concurrent.every((result) => result.status === 'completed'), true);
    assert.deepEqual(
      concurrent
        .map((result) => result.status === 'completed' && result.replayed)
        .sort(),
      [false, true],
    );
    assert.deepEqual(
      await notifications.markAllRead({
        principal: actors.producer,
        idempotencyKeyHash: concurrentKey,
        requestHash: requestDigest('leituras'),
        requestId: 'notification-integration-command-conflict',
      }),
      { status: 'conflict' },
    );

    const bulkKey = digest('bulk-read-key');
    const bulkInput = {
      principal: actors.producer,
      idempotencyKeyHash: bulkKey,
      requestHash: requestDigest('leituras'),
      requestId: 'notification-integration-bulk',
    } as const;
    const bulk = await notifications.markAllRead(bulkInput);
    assert.equal(bulk.status, 'completed');
    const bulkAudit = await database.query<{
      recurso_tipo: string;
      recurso_id: string;
      usuario_afetado_id: string;
    }>(
      `
        SELECT recurso_tipo, recurso_id, usuario_afetado_id
        FROM public.eventos_auditoria
        WHERE organizacao_id = $1
          AND evento = 'notificacao.leituras_em_lote'
          AND request_id = $2
      `,
      [ORGANIZATION_ID, bulkInput.requestId],
    );
    assert.deepEqual(bulkAudit.rows, [
      {
        recurso_tipo: 'usuario',
        recurso_id: actors.producer.id,
        usuario_afetado_id: actors.producer.id,
      },
    ]);
    const afterCutoff = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.recuperacao_concluida.v1',
    });
    const bulkReplay = await notifications.markAllRead(bulkInput);
    assert.deepEqual(bulkReplay, { ...bulk, replayed: true });
    assert.equal(
      (await notifications.list({
        principal: actors.producer,
        state: 'nao_lida',
        limit: 20,
      })).some((row) => row.id === afterCutoff.deliveryId),
      true,
    );

    const discardKey = digest('discard-first-key');
    const discardInput = {
      principal: actors.producer,
      notificationId: producerFirst.deliveryId,
      idempotencyKeyHash: discardKey,
      requestHash: requestDigest('descarte', producerFirst.deliveryId),
      requestId: 'notification-integration-discard',
    } as const;
    const discarded = await notifications.discard(discardInput);
    assert.equal(discarded.status, 'completed');
    assert.deepEqual(await notifications.discard(discardInput), {
      ...discarded,
      replayed: true,
    });
    assert.equal(
      (
        await notifications.list({
          principal: actors.producer,
          state: 'todas',
          limit: 20,
        })
      ).some((row) => row.id === producerFirst.deliveryId),
      false,
    );
    assert.deepEqual(
      await notifications.markRead({
        principal: actors.producer,
        notificationId: producerFirst.deliveryId,
        idempotencyKeyHash: digest('new-key-after-discard'),
        requestHash: firstRequest,
        requestId: 'notification-integration-after-discard',
      }),
      { status: 'not_found' },
    );

    await database.query(
      `
        UPDATE public.notificacao_entrega AS entrega
        SET criada_em = tempo.agora - interval '91 days',
            expira_em = tempo.agora - interval '1 day'
        FROM (SELECT pg_catalog.clock_timestamp() AS agora) AS tempo
        WHERE entrega.id = $1
      `,
      [producerFirst.deliveryId],
    );
    assert.deepEqual(
      await notifications.markRead({
        principal: actors.producer,
        notificationId: producerFirst.deliveryId,
        idempotencyKeyHash: firstKey,
        requestHash: firstRequest,
        requestId: 'notification-integration-after-expiry',
      }),
      firstReplay,
    );
    const purge = await new PostgresNotificationPurgeRepository(database).run(10);
    assert.equal(purge.deletedDeliveries, 1);
    assert.ok(purge.deletedEvents >= 1);
    assert.deepEqual(
      await notifications.markRead({
        principal: actors.producer,
        notificationId: producerFirst.deliveryId,
        idempotencyKeyHash: firstKey,
        requestHash: firstRequest,
        requestId: 'notification-integration-after-target-purge',
      }),
      firstReplay,
    );

    assert.deepEqual(
      await notifications.resolveDestination({
        principal: actors.producer,
        notificationId: afterCutoff.deliveryId,
        requestId: 'notification-integration-resolve-own',
      }),
      { resourceType: 'conta', resourceId: actors.producer.id },
    );
    const deniedRequestId = 'notification-integration-resolve-foreign';
    assert.equal(
      await notifications.resolveDestination({
        principal: actors.admin,
        notificationId: afterCutoff.deliveryId,
        requestId: deniedRequestId,
      }),
      null,
    );
    assert.equal(
      await notifications.resolveDestination({
        principal: actors.admin,
        notificationId: afterCutoff.deliveryId,
        requestId: deniedRequestId,
      }),
      null,
    );
    const deniedAudit = await database.query<{
      organizacao_id: string;
      resultado: string;
      ator_tipo: string;
      ator_usuario_id: string;
      sessao_id: string;
      usuario_afetado_id: string;
      recurso_tipo: string;
      recurso_id: string;
      request_id: string;
      metadados: Record<string, never>;
      ocorrido_em: Date;
      server_now: Date;
    }>(
      `
        SELECT auditoria.organizacao_id, auditoria.resultado,
               auditoria.ator_tipo, auditoria.ator_usuario_id,
               auditoria.sessao_id, auditoria.usuario_afetado_id,
               auditoria.recurso_tipo, auditoria.recurso_id,
               auditoria.request_id, auditoria.metadados,
               auditoria.ocorrido_em,
               pg_catalog.clock_timestamp() AS server_now
        FROM public.eventos_auditoria AS auditoria
        WHERE auditoria.evento = 'notificacao.destino_resolucao_negada'
          AND auditoria.request_id = $1
      `,
      [deniedRequestId],
    );
    assert.equal(deniedAudit.rowCount, 1);
    assert.deepEqual(deniedAudit.rows[0], {
      organizacao_id: actors.admin.organizationId,
      resultado: 'negado',
      ator_tipo: 'usuario',
      ator_usuario_id: actors.admin.id,
      sessao_id: actors.admin.sessionId,
      usuario_afetado_id: actors.admin.id,
      recurso_tipo: 'notificacao_entrega',
      recurso_id: afterCutoff.deliveryId,
      request_id: deniedRequestId,
      metadados: {},
      ocorrido_em: deniedAudit.rows[0]?.ocorrido_em,
      server_now: deniedAudit.rows[0]?.server_now,
    });
    assert.ok(
      deniedAudit.rows[0]!.ocorrido_em.getTime() <=
        deniedAudit.rows[0]!.server_now.getTime(),
    );
    assert.deepEqual(
      await notifications.list({
        principal: { ...actors.producer, authorizationVersion: 999 },
        state: 'todas',
        limit: 20,
      }),
      [],
    );
  });

  test('internaliza criação e deduplicação com ACL mínima, replay e rollback atômico', async () => {
    const database = requirePool();
    const runtimeDatabase = requireRuntimePool();
    const actors = requireFixture();
    const acl = await runtimeDatabase.query<{
      can_insert_event: boolean;
      can_insert_event_column: boolean;
      can_insert_delivery: boolean;
      can_insert_delivery_column: boolean;
      can_execute_created_wrapper: boolean;
      can_execute_deduplicated_wrapper: boolean;
      can_execute_denied_wrapper: boolean;
      can_execute_generic_writer: boolean;
      can_execute_delivery_operation: boolean;
      can_execute_resolution_operation: boolean;
    }>(`
      SELECT
        pg_catalog.has_table_privilege(
          current_user, 'public.notificacao_evento', 'INSERT'
        ) AS can_insert_event,
        pg_catalog.has_any_column_privilege(
          current_user, 'public.notificacao_evento', 'INSERT'
        ) AS can_insert_event_column,
        pg_catalog.has_table_privilege(
          current_user, 'public.notificacao_entrega', 'INSERT'
        ) AS can_insert_delivery,
        pg_catalog.has_any_column_privilege(
          current_user, 'public.notificacao_entrega', 'INSERT'
        ) AS can_insert_delivery_column,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_aud_notificacao_criada_mp35b(jsonb)', 'EXECUTE'
        ) AS can_execute_created_wrapper,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_aud_notificacao_deduplicada_mp35b(jsonb)', 'EXECUTE'
        ) AS can_execute_deduplicated_wrapper,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_aud_notificacao_destino_negado_mp35b(jsonb)', 'EXECUTE'
        ) AS can_execute_denied_wrapper,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_auditoria_inserir_interno_mp35b(text,jsonb)', 'EXECUTE'
        ) AS can_execute_generic_writer,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_notificacao_entregar_conta_mp35b(uuid,uuid)', 'EXECUTE'
        ) AS can_execute_delivery_operation,
        pg_catalog.has_function_privilege(
          current_user,
          'public.tche_notificacao_resolver_destino_mp35b(uuid,uuid,text)',
          'EXECUTE'
        ) AS can_execute_resolution_operation
    `);
    assert.deepEqual(acl.rows[0], {
      can_insert_event: false,
      can_insert_event_column: false,
      can_insert_delivery: false,
      can_insert_delivery_column: false,
      can_execute_created_wrapper: false,
      can_execute_deduplicated_wrapper: false,
      can_execute_denied_wrapper: false,
      can_execute_generic_writer: false,
      can_execute_delivery_operation: true,
      can_execute_resolution_operation: true,
    });
    const publicAcl = await database.query<{
      created_wrapper: boolean;
      deduplicated_wrapper: boolean;
      denied_wrapper: boolean;
      generic_writer: boolean;
      delivery_operation: boolean;
      resolution_operation: boolean;
    }>(`
      SELECT
        pg_catalog.has_function_privilege(
          'public', 'public.tche_aud_notificacao_criada_mp35b(jsonb)',
          'EXECUTE'
        ) AS created_wrapper,
        pg_catalog.has_function_privilege(
          'public', 'public.tche_aud_notificacao_deduplicada_mp35b(jsonb)',
          'EXECUTE'
        ) AS deduplicated_wrapper,
        pg_catalog.has_function_privilege(
          'public', 'public.tche_aud_notificacao_destino_negado_mp35b(jsonb)',
          'EXECUTE'
        ) AS denied_wrapper,
        pg_catalog.has_function_privilege(
          'public',
          'public.tche_auditoria_inserir_interno_mp35b(text,jsonb)',
          'EXECUTE'
        ) AS generic_writer,
        pg_catalog.has_function_privilege(
          'public',
          'public.tche_notificacao_entregar_conta_mp35b(uuid,uuid)',
          'EXECUTE'
        ) AS delivery_operation,
        pg_catalog.has_function_privilege(
          'public',
          'public.tche_notificacao_resolver_destino_mp35b(uuid,uuid,text)',
          'EXECUTE'
        ) AS resolution_operation
    `);
    assert.deepEqual(publicAcl.rows[0], {
      created_wrapper: false,
      deduplicated_wrapper: false,
      denied_wrapper: false,
      generic_writer: false,
      delivery_operation: false,
      resolution_operation: false,
    });

    const sourceAuditId = randomUUID();
    const firstAttemptId = randomUUID();
    const secondAttemptId = randomUUID();
    const client = await runtimeDatabase.connect();
    let deliveryId = '';
    try {
      await client.query('BEGIN');
      await client.query(
        `
          UPDATE public.credenciais_usuario
          SET senha_phc =
            '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1ub3Zh$aGFzaC1ub3ZhLW5hby1yZWFs',
              senha_definida_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND usuario_id = $2
        `,
        [ORGANIZATION_ID, actors.producer.id],
      );
      await client.query(
        `SELECT public.tche_aud_senha_alterada_mp35b($1::jsonb)`,
        [JSON.stringify({
          id: sourceAuditId,
          organizationId: ORGANIZATION_ID,
          result: 'sucesso',
          actorType: 'usuario',
          actorUserId: actors.producer.id,
          sessionId: actors.producer.sessionId,
          affectedUserId: actors.producer.id,
          resourceType: 'usuario',
          resourceId: actors.producer.id,
          requestId: 'notification-real-source',
          metadata: {
            sessao_atual_preservada: true,
            tokens_girados: true,
          },
        })],
      );
      const first = await client.query<{
        entrega_id: string;
        evento_id: string;
        organizacao_id: string;
        destinatario_usuario_id: string;
        tipo_evento: string;
        autor_usuario_id: string;
        resultado_tentativa: string;
        ocorrido_em: Date;
      }>(
        `SELECT * FROM public.tche_notificacao_entregar_conta_mp35b($1, $2)`,
        [sourceAuditId, firstAttemptId],
      );
      assert.equal(first.rowCount, 1);
      deliveryId = first.rows[0]!.entrega_id;
      assert.deepEqual(first.rows[0], {
        entrega_id: deliveryId,
        evento_id: first.rows[0]?.evento_id,
        organizacao_id: ORGANIZATION_ID,
        destinatario_usuario_id: actors.producer.id,
        tipo_evento: 'conta.senha_alterada.v1',
        autor_usuario_id: actors.producer.id,
        resultado_tentativa: 'criada',
        ocorrido_em: first.rows[0]?.ocorrido_em,
      });
      const beforeDedup = await client.query<{ agora: Date }>(
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      const second = await client.query<{
        entrega_id: string;
        resultado_tentativa: string;
        ocorrido_em: Date;
      }>(
        `SELECT * FROM public.tche_notificacao_entregar_conta_mp35b($1, $2)`,
        [sourceAuditId, secondAttemptId],
      );
      const afterDedup = await client.query<{ agora: Date }>(
        'SELECT pg_catalog.clock_timestamp() AS agora',
      );
      assert.equal(second.rows[0]?.entrega_id, deliveryId);
      assert.equal(second.rows[0]?.resultado_tentativa, 'deduplicada');
      assert.ok(
        second.rows[0]!.ocorrido_em.getTime() >=
          beforeDedup.rows[0]!.agora.getTime(),
      );
      assert.ok(
        second.rows[0]!.ocorrido_em.getTime() <=
          afterDedup.rows[0]!.agora.getTime(),
      );
      const replay = await client.query<{
        entrega_id: string;
        resultado_tentativa: string;
        ocorrido_em: Date;
      }>(
        `SELECT * FROM public.tche_notificacao_entregar_conta_mp35b($1, $2)`,
        [sourceAuditId, secondAttemptId],
      );
      assert.deepEqual(replay.rows[0], second.rows[0]);
      const persisted = await client.query<{
        deliveries: string;
        created_audits: string;
        deduplicated_audits: string;
        created_matches_delivery_time: boolean;
      }>(
        `
          SELECT
            (SELECT count(*)::text
             FROM public.notificacao_entrega AS entrega
             JOIN public.notificacao_evento AS evento
               ON evento.id = entrega.evento_id
             WHERE evento.chave_origem = $1) AS deliveries,
            (SELECT count(*)::text FROM public.eventos_auditoria
             WHERE id = $2 AND evento = 'notificacao.criada') AS created_audits,
            (SELECT count(*)::text FROM public.eventos_auditoria
             WHERE id = $3 AND evento = 'notificacao.deduplicada')
              AS deduplicated_audits,
            (SELECT auditoria.ocorrido_em = entrega.criada_em
             FROM public.eventos_auditoria AS auditoria
             JOIN public.notificacao_entrega AS entrega
               ON entrega.id::text = auditoria.recurso_id
             WHERE auditoria.id = $2) AS created_matches_delivery_time
        `,
        [sourceAuditId, firstAttemptId, secondAttemptId],
      );
      assert.deepEqual(persisted.rows[0], {
        deliveries: '1',
        created_audits: '1',
        deduplicated_audits: '1',
        created_matches_delivery_time: true,
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const auditCountBefore = await database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.eventos_auditoria
       WHERE recurso_id = $1`,
      [deliveryId],
    );
    for (const attempt of [
      () => runtimeDatabase.query(
        'SELECT public.tche_aud_notificacao_deduplicada_mp35b($1::jsonb)',
        [JSON.stringify({ resourceId: deliveryId })],
      ),
      () => runtimeDatabase.query(
        'SELECT public.tche_aud_notificacao_criada_mp35b($1::jsonb)',
        [JSON.stringify({ resourceId: deliveryId })],
      ),
      () => runtimeDatabase.query(
        `SELECT public.tche_auditoria_inserir_interno_mp35b(
           'notificacao.deduplicada', $1::jsonb
         )`,
        [JSON.stringify({ resourceId: deliveryId })],
      ),
    ]) {
      await assert.rejects(attempt(), (error: unknown) =>
        (error as { readonly code?: string }).code === '42501');
    }
    assert.deepEqual(
      await database.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.eventos_auditoria
         WHERE recurso_id = $1`,
        [deliveryId],
      ).then((result) => result.rows[0]),
      auditCountBefore.rows[0],
    );

    const rollbackSourceId = randomUUID();
    const rollbackAttemptId = randomUUID();
    const rollbackClient = await runtimeDatabase.connect();
    try {
      await rollbackClient.query('BEGIN');
      await rollbackClient.query(
        `
          UPDATE public.credenciais_usuario
          SET senha_definida_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND usuario_id = $2
        `,
        [ORGANIZATION_ID, actors.producer.id],
      );
      await rollbackClient.query(
        `SELECT public.tche_aud_senha_alterada_mp35b($1::jsonb)`,
        [JSON.stringify({
          id: rollbackSourceId,
          organizationId: ORGANIZATION_ID,
          result: 'sucesso',
          actorType: 'usuario',
          actorUserId: actors.producer.id,
          sessionId: actors.producer.sessionId,
          affectedUserId: actors.producer.id,
          resourceType: 'usuario',
          resourceId: actors.producer.id,
          requestId: 'notification-rollback-source',
          metadata: {
            sessao_atual_preservada: true,
            tokens_girados: true,
          },
        })],
      );
      await rollbackClient.query(
        `SELECT * FROM public.tche_notificacao_entregar_conta_mp35b($1, $2)`,
        [rollbackSourceId, rollbackAttemptId],
      );
      await rollbackClient.query('ROLLBACK');
    } catch (error) {
      await rollbackClient.query('ROLLBACK');
      throw error;
    } finally {
      rollbackClient.release();
    }
    const rolledBack = await database.query<{ facts: string }>(
      `
        SELECT (
          (SELECT count(*) FROM public.eventos_auditoria
           WHERE id IN ($1, $2)) +
          (SELECT count(*) FROM public.notificacao_evento
           WHERE chave_origem = $1::text) +
          (SELECT count(*)
           FROM public.notificacao_entrega AS entrega
           JOIN public.notificacao_evento AS evento
             ON evento.id = entrega.evento_id
           WHERE evento.chave_origem = $1::text)
        )::text AS facts
      `,
      [rollbackSourceId, rollbackAttemptId],
    );
    assert.equal(rolledBack.rows[0]?.facts, '0');
  });

  test('resolução negada deriva identidade, rejeita sessão inválida e acompanha rollback', async () => {
    const database = requirePool();
    const runtimeDatabase = requireRuntimePool();
    const actors = requireFixture();
    const target = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.recuperacao_concluida.v1',
    });
    const invalidRequest = 'notification-invalid-session';
    await assert.rejects(
      runtimeDatabase.query(
        `SELECT * FROM public.tche_notificacao_resolver_destino_mp35b(
           $1, $2, $3
         )`,
        [randomUUID(), target.deliveryId, invalidRequest],
      ),
      (error: unknown) =>
        (error as { readonly code?: string }).code === '42501',
    );
    assert.equal(
      (
        await database.query(
          `SELECT 1 FROM public.eventos_auditoria WHERE request_id = $1`,
          [invalidRequest],
        )
      ).rowCount,
      0,
    );

    const nonexistentRequest = 'notification-nonexistent-isolated';
    await assert.rejects(
      runtimeDatabase.query(
        'SELECT public.tche_aud_notificacao_destino_negado_mp35b($1::jsonb)',
        [JSON.stringify({
          organizationId: ORGANIZATION_ID,
          actorUserId: actors.admin.id,
          sessionId: actors.admin.sessionId,
          resourceId: randomUUID(),
          requestId: nonexistentRequest,
        })],
      ),
      (error: unknown) =>
        (error as { readonly code?: string }).code === '42501',
    );
    assert.equal(
      (
        await database.query(
          `SELECT 1 FROM public.eventos_auditoria WHERE request_id = $1`,
          [nonexistentRequest],
        )
      ).rowCount,
      0,
    );

    const rollbackRequest = 'notification-resolution-rollback';
    const rollbackClient = await runtimeDatabase.connect();
    try {
      await rollbackClient.query('BEGIN');
      const denied = await rollbackClient.query(
        `SELECT * FROM public.tche_notificacao_resolver_destino_mp35b(
           $1, $2, $3
         )`,
        [actors.admin.sessionId, target.deliveryId, rollbackRequest],
      );
      assert.equal(denied.rowCount, 0);
      assert.equal(
        (
          await rollbackClient.query(
            `SELECT 1 FROM public.eventos_auditoria WHERE request_id = $1`,
            [rollbackRequest],
          )
        ).rowCount,
        1,
      );
      await rollbackClient.query('ROLLBACK');
    } catch (error) {
      await rollbackClient.query('ROLLBACK');
      throw error;
    } finally {
      rollbackClient.release();
    }
    assert.equal(
      (
        await database.query(
          `SELECT 1 FROM public.eventos_auditoria WHERE request_id = $1`,
          [rollbackRequest],
        )
      ).rowCount,
      0,
    );
  });

  test('credencial de manutenção tem somente leitura operacional e purga expirada', async () => {
    const database = requirePool();
    const actors = requireFixture();
    const live = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.senha_alterada.v1',
    });
    const expired = await createNotification(database, {
      recipient: actors.producer,
      eventType: 'conta.recuperacao_concluida.v1',
    });
    await expireDelivery(database, expired.deliveryId);
    const maintenanceCommandKey = digest('maintenance-expired-command');
    assert.equal(
      (
        await requireRepository().markRead({
          principal: actors.producer,
          notificationId: live.deliveryId,
          idempotencyKeyHash: maintenanceCommandKey,
          requestHash: requestDigest('leitura', live.deliveryId),
          requestId: 'notification-maintenance-expired-command',
        })
      ).status,
      'completed',
    );
    const expiredCommand = await database.query<{ id: string }>(
      `
        WITH alvo AS (
          SELECT id
          FROM public.notificacao_comando_idempotencia
          WHERE chave_idempotencia_hash = $1
          LIMIT 1
        ), tempo AS (
          SELECT pg_catalog.clock_timestamp() - interval '91 days' AS antigo
        )
        UPDATE public.notificacao_comando_idempotencia AS comando
        SET resultado_em = CASE
              WHEN comando.resultado_em IS NULL THEN NULL
              ELSE tempo.antigo
            END,
            corte_em = CASE
              WHEN comando.corte_em IS NULL THEN NULL
              ELSE tempo.antigo
            END,
            processado_em = tempo.antigo,
            expira_em = tempo.antigo + interval '90 days'
        FROM alvo, tempo
        WHERE comando.id = alvo.id
        RETURNING comando.id
      `,
      [maintenanceCommandKey],
    );
    assert.equal(expiredCommand.rowCount, 1);

    const role = `tche_test_notification_maintenance_${randomUUID().replaceAll('-', '')}`;
    const password = createHash('sha256')
      .update(randomUUID())
      .digest('hex');
    await database.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
    await database.query(
      `GRANT tche_agro_notifications_maintenance TO ${role}`,
    );
    const databaseUrl = new URL(testDatabase!.connectionString);
    databaseUrl.username = role;
    databaseUrl.password = password;
    const maintenancePool = new Pool({ connectionString: databaseUrl.toString() });
    try {
      await assert.rejects(
        maintenancePool.query(
          'SELECT destinatario_usuario_id FROM public.notificacao_entrega LIMIT 1',
        ),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '42501',
      );
      await assert.rejects(
        maintenancePool.query(
          `
            INSERT INTO public.notificacao_evento (
              organizacao_id, tipo_evento, chave_origem, recurso_tipo, recurso_id
            ) VALUES ($1, 'conta.senha_alterada.v1', $2, 'conta', $3)
          `,
          [ORGANIZATION_ID, randomUUID(), actors.producer.id],
        ),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '42501',
      );
      await assert.rejects(
        maintenancePool.query(
          'DELETE FROM public.notificacao_entrega WHERE id = $1',
          [live.deliveryId],
        ),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'constraint' in error &&
          error.constraint === 'ck_notificacao_entrega_purga_expirada',
      );

      await database.query(`GRANT tche_agro_runtime TO ${role}`);
      await assert.rejects(
        maintenancePool.query(
          'DELETE FROM public.notificacao_entrega WHERE id = $1',
          [expired.deliveryId],
        ),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          'constraint' in error &&
          error.constraint === 'ck_notificacoes_papeis_exclusivos',
      );
      await database.query(`REVOKE tche_agro_runtime FROM ${role}`);

      const result = await new PostgresNotificationPurgeRepository(
        maintenancePool,
      ).run(10);
      assert.equal(result.deletedDeliveries, 1);
      assert.ok(result.deletedEvents >= 1);
      assert.equal(result.deletedIdempotencyKeys, 1);
      assert.equal(
        (
          await database.query(
            'SELECT 1 FROM public.notificacao_entrega WHERE id = $1',
            [live.deliveryId],
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await database.query(
            'SELECT 1 FROM public.notificacao_entrega WHERE id = $1',
            [expired.deliveryId],
          )
        ).rowCount,
        0,
      );
    } finally {
      await maintenancePool.end();
      await database.query(`DROP ROLE ${role}`);
    }
  });
});

async function seedFixture(pool: Pool): Promise<Fixture> {
  const producerId = randomUUID();
  const adminId = randomUUID();
  const producerSessionId = randomUUID();
  const adminSessionId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status
        ) VALUES
          ($1, $3, 'Produtor notificações', $1::uuid::text || '@example.test',
           'produtor', 'ativo'),
          ($2, $3, 'Admin notificações', $2::uuid::text || '@example.test',
           'admin', 'ativo')
      `,
      [producerId, adminId, ORGANIZATION_ID],
    );
    await client.query(
      `
        INSERT INTO public.credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        ) VALUES (
          $1, $2,
          '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1ub3RpZmljYWNhbw$aGFzaC1ub3RpZmljYWNhby1uYW8tcmVhbA',
          'integration-v1'
        )
      `,
      [ORGANIZATION_ID, producerId],
    );
    await client.query(
      `
        INSERT INTO public.sessoes_autenticacao (
          id, organizacao_id, usuario_id, status, versao_autorizacao,
          expira_inatividade_em, expira_absolutamente_em
        ) VALUES
          ($3, $5, $1, 'ativa', 1,
           pg_catalog.clock_timestamp() + interval '1 day',
           pg_catalog.clock_timestamp() + interval '30 days'),
          ($4, $5, $2, 'ativa', 1,
           pg_catalog.clock_timestamp() + interval '1 day',
           pg_catalog.clock_timestamp() + interval '30 days')
      `,
      [producerId, adminId, producerSessionId, adminSessionId, ORGANIZATION_ID],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return {
    producer: principal(producerId, producerSessionId, 'produtor'),
    admin: principal(adminId, adminSessionId, 'admin'),
  };
}

function principal(
  id: string,
  sessionId: string,
  profile: UserProfile,
): AuthenticatedPrincipal {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    name: 'Principal de integração',
    email: `${id}@example.test`,
    profile,
    status: 'ativo',
    authorizationVersion: 1,
    sessionId,
  };
}

async function createNotification(
  pool: Pool,
  input: {
    readonly recipient: AuthenticatedPrincipal;
    readonly eventType:
      | 'conta.senha_alterada.v1'
      | 'conta.email_principal_alterado.v1'
      | 'conta.recuperacao_concluida.v1';
    readonly authorUserId?: string;
  },
): Promise<Readonly<{ eventId: string; deliveryId: string }>> {
  const sourceKey = randomUUID();
  const eventId = randomUUID();
  const deliveryId = randomUUID();
  await pool.query(
    `
      WITH evento AS (
        INSERT INTO public.notificacao_evento (
          id, organizacao_id, tipo_evento, chave_origem, recurso_tipo,
          recurso_id, autor_id, dados_apresentacao
        ) VALUES ($1, $3, $5, $4, 'conta', $6, $7, '{}'::jsonb)
        RETURNING criado_em
      )
      INSERT INTO public.notificacao_entrega (
        id, evento_id, destinatario_usuario_id, organizacao_id,
        prioridade, criada_em, chave_deduplicacao, expira_em
      )
      SELECT $2, $1, $6, $3, 'alta', evento.criado_em,
             $5 || ':' || $4, evento.criado_em + interval '90 days'
      FROM evento
    `,
    [
      eventId,
      deliveryId,
      input.recipient.organizationId,
      sourceKey,
      input.eventType,
      input.recipient.id,
      input.authorUserId ?? null,
    ],
  );
  return { eventId, deliveryId };
}

async function expireDelivery(pool: Pool, deliveryId: string): Promise<void> {
  await pool.query(
    `
      UPDATE public.notificacao_entrega AS entrega
      SET criada_em = tempo.agora - interval '91 days',
          expira_em = tempo.agora - interval '1 day'
      FROM (SELECT pg_catalog.clock_timestamp() AS agora) AS tempo
      WHERE entrega.id = $1
    `,
    [deliveryId],
  );
}
