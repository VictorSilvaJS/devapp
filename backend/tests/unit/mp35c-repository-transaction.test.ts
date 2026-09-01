import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import type { PoolClient } from 'pg';

import type { AuthPostgresPool } from '../../src/auth/postgres-common.js';
import type { Mp35cCommandIdentity } from '../../src/administration/mp35c-contracts.js';
import {
  decodeMp35cMutationQueryResult,
  executeMp35cMutationTransaction,
  type Mp35cCommandRow,
} from '../../src/administration/postgres-mp35c-repository.js';
import { HttpError } from '../../src/security/http-error.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

const identity: Mp35cCommandIdentity = {
  sessionId: SESSION_ID,
  requestId: 'request-transaction-decoder',
  correlationId: 'correlation-transaction-decoder',
  idempotencyKeyHash: createHash('sha256').update('key').digest(),
  requestHash: createHash('sha256').update('request').digest(),
  command: 'propriedade.criar',
};

const validRow = (): Mp35cCommandRow => ({
  status: 'completed',
  codigo_http: 201,
  recibo: {
    outcome: 'criado', resourceType: 'propriedade',
    resourceId: PROPERTY_ID, version: 1,
  },
});

function result(...rows: Mp35cCommandRow[]) {
  return { rowCount: rows.length, rows };
}

function isSafe503(error: unknown): boolean {
  return error instanceof HttpError
    && error.statusCode === 503
    && error.code === 'service_unavailable';
}

describe('MP-35C transaction decoder', () => {
  it('aceita somente a linha completa e coerente do comando', () => {
    assert.deepEqual(decodeMp35cMutationQueryResult(result(validRow()), identity), {
      status: 'completed',
      httpStatus: 201,
      receipt: {
        outcome: 'criado', resourceType: 'propriedade',
        resourceId: PROPERTY_ID, version: 1,
      },
    });
    assert.deepEqual(decodeMp35cMutationQueryResult(result({
      status: 'invalid_holder', codigo_http: null, recibo: null,
    }), identity), { status: 'invalid_holder' });
  });

  it('rejeita cardinalidade, resultado, HTTP, recibo, UUID, versão e campos extras', () => {
    const invalidResults = [
      result(),
      result(validRow(), validRow()),
      result({ status: 'unexpected', codigo_http: null, recibo: null }),
      result({ ...validRow(), codigo_http: 200 }),
      result({ ...validRow(), recibo: null }),
      result({ ...validRow(), recibo: { ...(validRow().recibo as object), extra: 'pii' } }),
      result({ ...validRow(), recibo: { ...(validRow().recibo as object), resourceId: 'uuid-invalido' } }),
      result({ ...validRow(), recibo: { ...(validRow().recibo as object), version: 0 } }),
      result({ ...validRow(), campo_extra: 'não permitido' }),
      result({ status: 'not_found', codigo_http: 404, recibo: null }),
      result({ status: 'not_found', codigo_http: null, recibo: null }),
    ];
    for (const [index, invalid] of invalidResults.entries()) {
      assert.throws(() => decodeMp35cMutationQueryResult(invalid, identity),
        isSafe503, `resultado inválido ${index}`);
    }
  });

  it('decodifica antes do COMMIT e faz ROLLBACK quando a resposta é incompatível', async () => {
    const events: string[] = [];
    const client = {
      async query(config: { text: string }) { events.push(config.text); return result(); },
      release() { events.push('RELEASE'); },
    };
    const pool = { async connect() { return client as unknown as PoolClient; } } as AuthPostgresPool;
    await assert.rejects(executeMp35cMutationTransaction(pool, identity, async () => {
      events.push('WRITE'); return result({ ...validRow(), codigo_http: 500 });
    }), isSafe503);
    assert.deepEqual(events, ['BEGIN', 'WRITE', 'ROLLBACK', 'RELEASE']);
  });

  it('faz COMMIT somente do objeto já validado', async () => {
    const events: string[] = [];
    const client = {
      async query(config: { text: string }) { events.push(config.text); return result(); },
      release() { events.push('RELEASE'); },
    };
    const pool = { async connect() { return client as unknown as PoolClient; } } as AuthPostgresPool;
    const decoded = await executeMp35cMutationTransaction(pool, identity, async () => {
      events.push('WRITE'); return result(validRow());
    });
    assert.equal(decoded.status, 'completed');
    assert.deepEqual(events, ['BEGIN', 'WRITE', 'COMMIT', 'RELEASE']);
  });

  it('erro no COMMIT não afirma sucesso e tenta ROLLBACK', async () => {
    const events: string[] = [];
    const client = {
      async query(config: { text: string }) {
        events.push(config.text);
        if (config.text === 'COMMIT') throw new Error('commit failure');
        return result();
      },
      release() { events.push('RELEASE'); },
    };
    const pool = { async connect() { return client as unknown as PoolClient; } } as AuthPostgresPool;
    await assert.rejects(executeMp35cMutationTransaction(pool, identity,
      async () => result(validRow())), isSafe503);
    assert.deepEqual(events, ['BEGIN', 'COMMIT', 'ROLLBACK', 'RELEASE']);
  });
});
