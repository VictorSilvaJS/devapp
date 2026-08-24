import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool, type PoolClient, type QueryConfig } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import type { AuthenticatedPrincipal, UserProfile } from '../../src/auth/contracts.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { PostgresAccountNotificationWriter } from '../../src/notifications/postgres-account-notification-writer.js';
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
    repository = new PostgresNotificationRepository({
      async connect() {
        const client = await pool!.connect();
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
    fixture = await seedFixture(pool);
  });

  after(async () => {
    await pool?.end();
    await testDatabase?.container.stop();
  });

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
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
            ? lastDatabaseError.message
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
    assert.equal(
      await notifications.resolveDestination({
        principal: actors.admin,
        notificationId: afterCutoff.deliveryId,
        requestId: 'notification-integration-resolve-foreign',
      }),
      null,
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
  const generatedIds = [eventId, deliveryId];
  const writer = new PostgresAccountNotificationWriter(() => generatedIds.shift()!);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writer.create(client, {
      organizationId: input.recipient.organizationId,
      recipientUserId: input.recipient.id,
      eventType: input.eventType,
      sourceKey,
      ...(input.authorUserId === undefined
        ? {}
        : { authorUserId: input.authorUserId }),
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
