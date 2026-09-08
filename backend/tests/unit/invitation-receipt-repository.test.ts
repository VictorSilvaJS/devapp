import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { PostgresAdministrativeUserRepository } from '../../src/administration/postgres-user-repository.js';
import type { IssueAdministrativeInvitationInput } from '../../src/administration/user-contracts.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';

const input: IssueAdministrativeInvitationInput = {
  principal: { id: '10000000-0000-4000-8000-000000000001', organizationId: 'org_tche_fertilidade',
    sessionId: '20000000-0000-4000-8000-000000000001', authorizationVersion: 1,
    name: 'Admin', email: 'admin@example.test', profile: 'admin', status: 'ativo' },
  identity: { organizationId: 'org_tche_fertilidade', actorUserId: '10000000-0000-4000-8000-000000000001',
    sessionId: '20000000-0000-4000-8000-000000000001', requestId: 'test', correlationId: 'test',
    idempotencyKeyHash: Buffer.alloc(32, 1), requestHash: Buffer.alloc(32, 2), command: 'usuario.emitir_convite' },
  userId: '30000000-0000-4000-8000-000000000001',
};
const receipt = { outcome: 'convite_emitido', resourceType: 'usuario', resourceId: input.userId, version: 7 };

function harness(row: unknown) {
  const events: string[] = [];
  const client = {
    async query(config: { text: string }) {
      const text = config.text;
      if (text.includes('SELECT nome, email')) return { rowCount: 1, rows: [{ nome: 'Alvo', email: 'alvo@example.test' }] };
      if (text.includes('tche_admin_emitir_convite_usuario_mp35b')) {
        events.push('COMMAND'); return { rowCount: 1, rows: [row] };
      }
      events.push(text); return { rowCount: 0, rows: [] };
    },
    release() { events.push('RELEASE'); },
  };
  const repo = new PostgresAdministrativeUserRepository({
    pool: { async connect() { return client as unknown as PoolClient; } },
    emailHmacKey: Buffer.alloc(32, 3), externalReferenceHmacKey: Buffer.alloc(32, 4),
    emailOutbox: new EncryptedEmailOutboxFactory(new OutboxPayloadCipher({
      activeKeyId: 'test', keys: [{ id: 'test', key: Buffer.alloc(32, 5) }] })),
    actionBaseUrl: 'https://example.test/auth/action',
  });
  return { repo, events };
}

test('recibo SQL de convite é validado antes do COMMIT em execução e replay', async () => {
  for (const status of ['completed', 'replayed']) {
    const { repo, events } = harness({ status, codigo_http: 201, recibo: receipt });
    assert.deepEqual(await repo.issueInvitation(input), { status, httpStatus: 201, receipt });
    assert.deepEqual(events, ['RELEASE', 'BEGIN', 'COMMAND', 'COMMIT', 'RELEASE']);
  }
});

test('recibo SQL legado, sem versão, de outro alvo ou com segredo causa ROLLBACK', async () => {
  for (const status of ['completed', 'replayed']) {
    for (const invalid of [
      { outcome: 'convite_emitido', resourceType: 'convite', resourceId: input.userId },
      { ...receipt, version: undefined }, { ...receipt, version: 0 }, { ...receipt, version: 1.5 },
      { ...receipt, resourceId: input.principal.id }, { ...receipt, token: 'proibido' },
      { ...receipt, convite_id: input.userId },
    ]) {
      const { repo, events } = harness({ status, codigo_http: 201, recibo: invalid });
      await assert.rejects(repo.issueInvitation(input), { statusCode: 503, code: 'service_unavailable' });
      assert.deepEqual(events, ['RELEASE', 'BEGIN', 'COMMAND', 'ROLLBACK', 'RELEASE']);
    }
  }
});
