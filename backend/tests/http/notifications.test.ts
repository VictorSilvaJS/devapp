import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import fastify from 'fastify';

import type { NotificationView } from '../../src/notifications/contracts.js';
import { notificationRoutesPlugin } from '../../src/notifications/routes.js';
import type {
  NotificationListQuery,
  NotificationService,
} from '../../src/notifications/service.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';

const notificationId = '11111111-1111-4111-8111-111111111111';
const resourceId = '22222222-2222-4222-8222-222222222222';
const sample: NotificationView = {
  id: notificationId,
  eventType: 'conta.recuperacao_concluida.v1',
  priority: 'alta',
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
  readAt: null,
  expiresAt: new Date('2026-11-22T12:00:00.000Z'),
  resourceType: 'conta',
  resourceId,
  content: {
    title: 'Recuperação concluída',
    summary: 'A recuperação da sua conta foi concluída.',
  },
};

class FakeNotificationService implements NotificationService {
  public calls: unknown[] = [];

  public async list(input: {
    readonly accessToken: string;
    readonly query: NotificationListQuery;
  }) {
    this.calls.push({ operation: 'list', input });
    return { items: [sample], nextCursor: 'next-cursor' };
  }

  public async countUnread(accessToken: string) {
    this.calls.push({ operation: 'count', accessToken });
    return 4;
  }

  public async markRead(
    input: Parameters<NotificationService['markRead']>[0],
  ) {
    this.calls.push({ operation: 'read', input });
    return { id: input.notificationId, readAt: new Date('2026-08-24T12:01:00.000Z') };
  }

  public async markAllRead(
    input: Parameters<NotificationService['markAllRead']>[0],
  ) {
    this.calls.push({ operation: 'read-all', input });
    return { cutoffAt: new Date('2026-08-24T12:02:00.000Z'), updated: 3 };
  }

  public async discard(
    input: Parameters<NotificationService['discard']>[0],
  ) {
    this.calls.push({ operation: 'discard', input });
    return {
      id: input.notificationId,
      discardedAt: new Date('2026-08-24T12:03:00.000Z'),
    };
  }

  public async resolveDestination(
    input: Parameters<NotificationService['resolveDestination']>[0],
  ) {
    this.calls.push({ operation: 'resolve', input });
    return { resourceType: 'conta' as const, resourceId };
  }
}

async function buildTestApp(service: NotificationService) {
  const app = fastify({ logger: false, genReqId: () => 'req-notification-test' });
  await app.register(notificationRoutesPlugin, {
    prefix: '/v1/notificacoes',
    service,
  });
  return app;
}

describe('notification HTTP plugin', () => {
  it('lists and counts only through the frozen no-store envelopes', async () => {
    const service = new FakeNotificationService();
    const app = await buildTestApp(service);
    const accessToken = issueOpaqueToken().value;
    const headers = { authorization: `Bearer ${accessToken}` };

    const list = await app.inject({
      method: 'GET',
      url: '/v1/notificacoes?estado=nao_lida&limite=25',
      headers,
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.headers['cache-control'], 'no-store');
    assert.equal(list.headers.pragma, 'no-cache');
    assert.deepEqual(list.json(), {
      itens: [
        {
          id: notificationId,
          tipo_evento: 'conta.recuperacao_concluida.v1',
          prioridade: 'alta',
          criada_em: '2026-08-24T12:00:00.000Z',
          lida_em: null,
          expira_em: '2026-11-22T12:00:00.000Z',
          recurso_tipo: 'conta',
          recurso_id: resourceId,
          conteudo: {
            titulo: sample.content.title,
            resumo: sample.content.summary,
          },
        },
      ],
      paginacao: { proximo_cursor: 'next-cursor' },
    });

    const counter = await app.inject({
      method: 'GET',
      url: '/v1/notificacoes/contador-nao-lidas',
      headers,
    });
    assert.equal(counter.statusCode, 200);
    assert.deepEqual(counter.json(), { total_nao_lidas: 4 });
    const listCall = service.calls[0] as {
      operation: string;
      input: { accessToken: string; query: NotificationListQuery };
    };
    assert.deepEqual(
      { ...listCall, input: { ...listCall.input, query: { ...listCall.input.query } } },
      {
        operation: 'list',
        input: { accessToken, query: { estado: 'nao_lida', limite: 25 } },
      },
    );
    await app.close();
  });

  it('exposes read, bulk-read, discard and resolver with exact response shapes', async () => {
    const service = new FakeNotificationService();
    const app = await buildTestApp(service);
    const accessToken = issueOpaqueToken().value;
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'idempotency-key': 'operation-12345',
    };

    const read = await app.inject({
      method: 'POST',
      url: `/v1/notificacoes/${notificationId}/leitura`,
      headers,
    });
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.json(), {
      id: notificationId,
      lida_em: '2026-08-24T12:01:00.000Z',
    });

    const bulk = await app.inject({
      method: 'POST',
      url: '/v1/notificacoes/leituras',
      headers,
    });
    assert.equal(bulk.statusCode, 200);
    assert.deepEqual(bulk.json(), {
      corte_em: '2026-08-24T12:02:00.000Z',
      atualizadas: 3,
    });

    const discarded = await app.inject({
      method: 'DELETE',
      url: `/v1/notificacoes/${notificationId}`,
      headers,
    });
    assert.equal(discarded.statusCode, 200);
    assert.deepEqual(discarded.json(), {
      id: notificationId,
      descartada_em: '2026-08-24T12:03:00.000Z',
    });

    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/notificacoes/${notificationId}/resolver-destino`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(resolved.statusCode, 200);
    assert.deepEqual(resolved.json(), {
      recurso_tipo: 'conta',
      recurso_id: resourceId,
    });
    assert.equal(
      (service.calls[0] as { input: { idempotencyKey: string } }).input
        .idempotencyKey,
      'operation-12345',
    );
    await app.close();
  });

  it('rejects missing credentials, unknown input, bodies and invalid identifiers', async () => {
    const app = await buildTestApp(new FakeNotificationService());
    const accessToken = issueOpaqueToken().value;
    const authorized = { authorization: `Bearer ${accessToken}` };

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/v1/notificacoes',
    });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.headers['www-authenticate'], 'Bearer');

    const unknown = await app.inject({
      method: 'GET',
      url: '/v1/notificacoes?destinatario=outro',
      headers: authorized,
    });
    assert.equal(unknown.statusCode, 400);

    const missingKey = await app.inject({
      method: 'POST',
      url: `/v1/notificacoes/${notificationId}/leitura`,
      headers: authorized,
    });
    assert.equal(missingKey.statusCode, 400);

    const clientPayload = await app.inject({
      method: 'POST',
      url: '/v1/notificacoes/leituras',
      headers: { ...authorized, 'idempotency-key': 'operation-12345' },
      payload: { corte_em: '2026-08-24T12:00:00.000Z' },
    });
    assert.equal(clientPayload.statusCode, 400);

    const emptyPayload = await app.inject({
      method: 'POST',
      url: `/v1/notificacoes/${notificationId}/resolver-destino`,
      headers: authorized,
      payload: {},
    });
    assert.equal(emptyPayload.statusCode, 400);

    const invalidId = await app.inject({
      method: 'DELETE',
      url: '/v1/notificacoes/not-a-uuid',
      headers: { ...authorized, 'idempotency-key': 'operation-12345' },
    });
    assert.equal(invalidId.statusCode, 400);

    const urnId = await app.inject({
      method: 'POST',
      url: `/v1/notificacoes/urn:uuid:${notificationId}/resolver-destino`,
      headers: authorized,
    });
    assert.equal(urnId.statusCode, 400);
    await app.close();
  });
});
