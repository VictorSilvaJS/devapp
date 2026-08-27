import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { PoolClient, QueryConfig, QueryResult } from 'pg';

import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import type { AuthenticationService } from '../../src/auth/service.js';
import type {
  IdempotentCommandInput,
  NotificationRepository,
  NotificationView,
} from '../../src/notifications/contracts.js';
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from '../../src/notifications/cursor.js';
import { PostgresAccountNotificationWriter } from '../../src/notifications/postgres-account-notification-writer.js';
import {
  notificationMaintenanceEnvironment,
  runNotificationPurgeWithRetries,
} from '../../src/notifications/purge.js';
import { DefaultNotificationService } from '../../src/notifications/service.js';
import { notificationContent } from '../../src/notifications/templates.js';
import { HttpError } from '../../src/security/http-error.js';

const principal: AuthenticatedPrincipal = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: 'org_tche_fertilidade',
  name: 'Produtor',
  email: 'produtor@example.test',
  profile: 'produtor',
  status: 'ativo',
  authorizationVersion: 3,
  sessionId: '22222222-2222-4222-8222-222222222222',
};

function notification(id: string, createdAt: string): NotificationView {
  return {
    id,
    eventType: 'conta.senha_alterada.v1',
    priority: 'alta',
    createdAt: new Date(createdAt),
    readAt: null,
    expiresAt: new Date('2026-11-22T12:00:00.000Z'),
    resourceType: 'conta',
    resourceId: principal.id,
    content: notificationContent('conta.senha_alterada.v1'),
  };
}

class FakeRepository implements NotificationRepository {
  public rows: readonly NotificationView[] = [];
  public listInput: Parameters<NotificationRepository['list']>[0] | undefined;
  public commandInput:
    | (IdempotentCommandInput & Readonly<{ notificationId?: string }>)
    | undefined;
  public commandResult: Awaited<ReturnType<NotificationRepository['markRead']>> = {
    status: 'completed',
    value: { id: '33333333-3333-4333-8333-333333333333', readAt: new Date() },
    replayed: false,
  };

  public async list(input: Parameters<NotificationRepository['list']>[0]) {
    this.listInput = input;
    return this.rows;
  }

  public async countUnread() {
    return 2;
  }

  public async markRead(
    input: Parameters<NotificationRepository['markRead']>[0],
  ) {
    this.commandInput = input;
    return this.commandResult;
  }

  public async markAllRead(
    input: Parameters<NotificationRepository['markAllRead']>[0],
  ) {
    this.commandInput = input;
    return {
      status: 'completed' as const,
      value: { cutoffAt: new Date('2026-08-24T12:00:00.000Z'), updated: 2 },
      replayed: false,
    };
  }

  public async discard(
    input: Parameters<NotificationRepository['discard']>[0],
  ) {
    this.commandInput = input;
    return {
      status: 'completed' as const,
      value: { id: input.notificationId, discardedAt: new Date() },
      replayed: false,
    };
  }

  public async resolveDestination() {
    return { resourceType: 'conta' as const, resourceId: principal.id };
  }
}

function service(repository: NotificationRepository): DefaultNotificationService {
  return new DefaultNotificationService({
    authentication: {
      async authenticate(token: string) {
        assert.equal(token, 'access-token');
        return principal;
      },
    } as unknown as AuthenticationService,
    repository,
  });
}

describe('notification domain', () => {
  it('keeps fixed, generic and safe account templates', () => {
    assert.deepEqual(notificationContent('conta.senha_alterada.v1'), {
      title: 'Senha alterada',
      summary: 'A senha da sua conta foi alterada.',
    });
    assert.deepEqual(notificationContent('conta.email_principal_alterado.v1'), {
      title: 'E-mail principal alterado',
      summary: 'O e-mail principal da sua conta foi alterado.',
    });
    assert.deepEqual(notificationContent('conta.recuperacao_concluida.v1'), {
      title: 'Recuperação concluída',
      summary: 'A recuperação da sua conta foi concluída.',
    });
    assert.doesNotMatch(
      JSON.stringify(notificationContent('conta.recuperacao_concluida.v1')),
      /token|senha nova|endereço|@/i,
    );
  });

  it('round-trips only a canonical opaque cursor', () => {
    const cursor = {
      createdAt: new Date('2026-08-24T12:00:00.000Z'),
      id: '44444444-4444-4444-8444-444444444444',
    };
    const encoded = encodeNotificationCursor(cursor);
    assert.deepEqual(decodeNotificationCursor(encoded), cursor);
    assert.throws(() => decodeNotificationCursor(`${encoded}=`), HttpError);
    assert.throws(
      () =>
        decodeNotificationCursor(
          Buffer.from('{"v":1}', 'utf8').toString('base64url'),
        ),
      HttpError,
    );
  });

  it('paginates with limit+1 and emits the last visible item as cursor', async () => {
    const repository = new FakeRepository();
    repository.rows = [
      notification('55555555-5555-4555-8555-555555555555', '2026-08-24T12:00:02.000Z'),
      notification('66666666-6666-4666-8666-666666666666', '2026-08-24T12:00:01.000Z'),
      notification('77777777-7777-4777-8777-777777777777', '2026-08-24T12:00:00.000Z'),
    ];

    const page = await service(repository).list({
      accessToken: 'access-token',
      query: { estado: 'nao_lida', limite: 2 },
    });

    assert.equal(repository.listInput?.limit, 3);
    assert.equal(repository.listInput?.state, 'nao_lida');
    assert.deepEqual(page.items, repository.rows.slice(0, 2));
    assert.deepEqual(
      decodeNotificationCursor(assertString(page.nextCursor)),
      {
        createdAt: repository.rows[1]!.createdAt,
        id: repository.rows[1]!.id,
      },
    );
  });

  it('hashes the normalized key and canonical UUID for one stable command target', async () => {
    const repository = new FakeRepository();
    const canonicalTarget = '33333333-3333-4333-8333-333333333333';
    const uppercaseTarget = canonicalTarget.toUpperCase();
    await service(repository).markRead({
      accessToken: 'access-token',
      notificationId: uppercaseTarget,
      idempotencyKey: '  key-12345  ',
      requestId: 'request-1',
    });

    assert.equal(repository.commandInput?.notificationId, canonicalTarget);
    assert.deepEqual(
      repository.commandInput?.idempotencyKeyHash,
      createHash('sha256').update('key-12345').digest(),
    );
    const uppercaseRequestHash = repository.commandInput?.requestHash;
    assert.deepEqual(
      uppercaseRequestHash,
      createHash('sha256').update(`leitura\u0000${canonicalTarget}`).digest(),
    );

    await service(repository).markRead({
      accessToken: 'access-token',
      notificationId: canonicalTarget,
      idempotencyKey: 'key-12345',
      requestId: 'request-2',
    });
    assert.deepEqual(repository.commandInput?.requestHash, uppercaseRequestHash);
    await assert.rejects(
      service(repository).markRead({
        accessToken: 'access-token',
        notificationId: `urn:uuid:${canonicalTarget}`,
        idempotencyKey: 'key-12345',
        requestId: 'request-3',
      }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    );
  });

  it('maps repository conflicts and missing deliveries without leaking scope', async () => {
    const repository = new FakeRepository();
    repository.commandResult = { status: 'conflict' };
    await assert.rejects(
      service(repository).markRead({
        accessToken: 'access-token',
        notificationId: '33333333-3333-4333-8333-333333333333',
        idempotencyKey: 'key-12345',
        requestId: 'request-1',
      }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
    repository.commandResult = { status: 'not_found' };
    await assert.rejects(
      service(repository).markRead({
        accessToken: 'access-token',
        notificationId: '33333333-3333-4333-8333-333333333333',
        idempotencyKey: 'key-67890',
        requestId: 'request-2',
      }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 404,
    );
  });
});

describe('notification writer and purge', () => {
  it('wires exactly the five approved transactional producers and excludes break-glass', async () => {
    const source = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
    const [auth, email, secondary, assisted, breakGlass, invitation] = await Promise.all([
      readFile(join(source, 'auth', 'postgres-auth-repository.ts'), 'utf8'),
      readFile(
        join(source, 'account-actions', 'postgres-email-repositories.ts'),
        'utf8',
      ),
      readFile(
        join(
          source,
          'account-actions',
          'postgres-admin-secondary-recovery-repository.ts',
        ),
        'utf8',
      ),
      readFile(
        join(
          source,
          'account-actions',
          'postgres-assisted-recovery-repository.ts',
        ),
        'utf8',
      ),
      readFile(
        join(
          source,
          'account-actions',
          'postgres-admin-break-glass-repository.ts',
        ),
        'utf8',
      ),
      readFile(
        join(
          source,
          'account-actions',
          'postgres-invitation-bootstrap-repositories.ts',
        ),
        'utf8',
      ),
    ]);

    assert.equal(auth.match(/#notificationWriter\.create\(/gu)?.length, 2);
    assert.equal(email.match(/insertAccountNotification\(/gu)?.length, 1);
    assert.equal(secondary.match(/insertAccountNotification\(/gu)?.length, 1);
    assert.equal(assisted.match(/insertAccountNotification\(/gu)?.length, 1);
    assert.doesNotMatch(breakGlass, /Notification|notificacao|insertAccountNotification/i);
    assert.doesNotMatch(invitation, /Notification|notificacao|insertAccountNotification/i);
    const rehashStart = auth.indexOf('public updateCredentialHashIfCurrent');
    const nextProducerBoundary = auth.indexOf('public createSession', rehashStart);
    assert.ok(rehashStart >= 0 && nextProducerBoundary > rehashStart);
    assert.doesNotMatch(
      auth.slice(rehashStart, nextProducerBoundary),
      /#notificationWriter\.create\(/u,
    );
    assert.match(auth, /eventType: 'conta\.senha_alterada\.v1'/u);
    assert.equal(
      [auth, secondary, assisted]
        .map(
          (file) =>
            file.match(/eventType: 'conta\.recuperacao_concluida\.v1'/gu)
              ?.length ?? 0,
        )
        .reduce((total, count) => total + count, 0),
      3,
    );
    assert.match(email, /eventType: 'conta\.email_principal_alterado\.v1'/u);
    assert.match(
      email,
      /eventType: 'conta\.email_principal_alterado\.v1',[\s\S]*?authorUserId: row\.id/u,
    );
    assert.match(
      assisted,
      /eventType: 'conta\.recuperacao_concluida\.v1',[\s\S]*?authorUserId: row\.solicitada_por_usuario_id/u,
    );
  });

  it('delegates account delivery and created audit derivation to one database operation', async () => {
    const sourceAuditId = '88888888-8888-4888-8888-888888888888';
    const attemptId = '77777777-7777-4777-8777-777777777777';
    const eventId = '99999999-9999-4999-8999-999999999999';
    const deliveryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const calls: QueryConfig[] = [];
    const client = {
      async query(config: QueryConfig) {
        calls.push(config);
        return {
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [{
            entrega_id: deliveryId,
            evento_id: eventId,
            organizacao_id: principal.organizationId,
            destinatario_usuario_id: principal.id,
            tipo_evento: 'conta.senha_alterada.v1',
            autor_usuario_id: principal.id,
            resultado_tentativa: 'criada',
            ocorrido_em: new Date('2026-08-24T12:00:00.000Z'),
          }],
        } as QueryResult;
      },
    } as unknown as PoolClient;
    const writer = new PostgresAccountNotificationWriter(() => attemptId);

    await writer.create(client, {
      organizationId: principal.organizationId,
      recipientUserId: principal.id,
      eventType: 'conta.senha_alterada.v1',
      sourceKey: sourceAuditId,
      authorUserId: principal.id,
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0]?.text ?? '', /tche_notificacao_entregar_conta_mp35b/u);
    assert.deepEqual(calls[0]?.values, [sourceAuditId, attemptId]);
    assert.doesNotMatch(calls[0]?.text ?? '', /eventos_auditoria|tche_aud_/u);
  });

  it('accepts a database-derived deduplication outcome without a generic audit call', async () => {
    const sourceAuditId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const attemptId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const deliveryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const calls: QueryConfig[] = [];
    const client = {
      async query(config: QueryConfig) {
        calls.push(config);
        return {
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [{
            entrega_id: deliveryId,
            evento_id: eventId,
            organizacao_id: principal.organizationId,
            destinatario_usuario_id: principal.id,
            tipo_evento: 'conta.recuperacao_concluida.v1',
            autor_usuario_id: null,
            resultado_tentativa: 'deduplicada',
            ocorrido_em: new Date('2026-08-24T12:01:00.000Z'),
          }],
        } as QueryResult;
      },
    } as unknown as PoolClient;
    await new PostgresAccountNotificationWriter(() => attemptId).create(
      client,
      {
        organizationId: principal.organizationId,
        recipientUserId: principal.id,
        eventType: 'conta.recuperacao_concluida.v1',
        sourceKey: sourceAuditId,
      },
    );

    assert.equal(calls.length, 1);
    assert.match(calls[0]?.text ?? '', /tche_notificacao_entregar_conta_mp35b/u);
    assert.deepEqual(calls[0]?.values, [sourceAuditId, attemptId]);
    assert.doesNotMatch(calls[0]?.text ?? '', /eventos_auditoria|tche_aud_/u);
  });

  it('retries only transient purge failures with bounded exponential delay', async () => {
    const waits: number[] = [];
    let attempts = 0;
    const result = await runNotificationPurgeWithRetries({
      repository: {
        async run() {
          attempts += 1;
          if (attempts < 3) throw Object.assign(new Error('transient'), { code: '40001' });
          return {
            status: 'completed' as const,
            deletedDeliveries: 1,
            deletedEvents: 1,
            deletedIdempotencyKeys: 0,
            pendingDeliveriesAtStart: 1,
            oldestExpiredAtStart: null,
            batches: 1,
          };
        },
      },
      wait: async (milliseconds) => {
        waits.push(milliseconds);
      },
      random: () => 0,
    });

    assert.equal(attempts, 3);
    assert.deepEqual(waits, [250, 500]);
    assert.equal(result.status, 'completed');
  });

  it('requires a dedicated maintenance credential in production', () => {
    assert.throws(
      () => notificationMaintenanceEnvironment({ NODE_ENV: 'production' }),
      /NOTIFICATIONS_MAINTENANCE_DATABASE_URL/,
    );
    const environment = notificationMaintenanceEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://runtime',
        NOTIFICATIONS_MAINTENANCE_DATABASE_URL: 'postgresql://maintenance',
        DATABASE_SSL_CA: 'runtime-ca',
        NOTIFICATIONS_MAINTENANCE_DATABASE_SSL_CA: 'maintenance-ca',
      });
    assert.equal(environment.DATABASE_URL, 'postgresql://maintenance');
    assert.equal(environment.DATABASE_SSL_CA, 'maintenance-ca');
  });
});

function assertString(value: string | null): string {
  if (typeof value !== 'string') assert.fail('expected a string');
  return value;
}

function randomDeliveryId(): string {
  return 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
}
