import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

import { PostgresAuthRepository } from '../../src/auth/postgres-auth-repository.js';
import { decodeDigest, type AuthPostgresPool } from '../../src/auth/postgres-common.js';
import { PostgresLoginThrottle } from '../../src/auth/postgres-login-throttle.js';
import { HttpError } from '../../src/security/http-error.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';

type Step = QueryResult<QueryResultRow> | Error;

function result(rows: QueryResultRow[] = []): QueryResult<QueryResultRow> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

class ScriptedClient {
  public readonly queries: QueryConfig[] = [];
  public released = false;
  readonly #steps: Step[];

  public constructor(steps: Step[]) {
    this.#steps = [...steps];
  }

  public async query<Row extends QueryResultRow>(
    config: QueryConfig,
  ): Promise<QueryResult<Row>> {
    this.queries.push(config);
    const step = this.#steps.shift() ?? result();
    if (step instanceof Error) throw step;
    return step as QueryResult<Row>;
  }

  public release(): void {
    this.released = true;
  }
}

function poolFor(client: ScriptedClient): AuthPostgresPool {
  return {
    async connect() {
      return client as unknown as PoolClient;
    },
  };
}

function repository(client: ScriptedClient): PostgresAuthRepository {
  return new PostgresAuthRepository({
    pool: poolFor(client),
    emailHmacKey: Buffer.alloc(32, 1),
    recoveryOutboxFactory: new EncryptedEmailOutboxFactory(
      new OutboxPayloadCipher({
        activeKeyId: 'test-key',
        keys: [{ id: 'test-key', key: Buffer.alloc(32, 2) }],
      }),
    ),
    recoveryActionBaseUrl: 'https://example.test/auth/action',
  });
}

describe('PostgreSQL authentication adapters', () => {
  it('decodes only canonical 32-byte base64url digests', () => {
    const token = issueOpaqueToken();
    assert.deepEqual(decodeDigest(token.hash), Buffer.from(token.hash, 'base64url'));
    for (const invalid of ['', 'abc', `${token.hash}x`, '*'.repeat(43)]) {
      assert.throws(
        () => decodeDigest(invalid),
        (error: unknown) =>
          error instanceof HttpError && error.code === 'service_unavailable',
      );
    }
  });

  it('maps a login subject without returning database naming to the service', async () => {
    const client = new ScriptedClient([
      result([
        {
          id: 'user-1',
          organizacao_id: 'org_tche_fertilidade',
          nome: 'Usuário',
          email: 'user@example.test',
          perfil: 'colaborador',
          status: 'ativo',
          versao_autorizacao: '7',
          credencial_id: 'credential-1',
          senha_phc: '$argon2id$fixture',
          versao_politica_senha: 'policy-v1',
        },
      ]),
    ]);
    const subject = await repository(client).findLoginSubject('user@example.test');
    assert.deepEqual(subject, {
      id: 'user-1',
      organizationId: 'org_tche_fertilidade',
      name: 'Usuário',
      email: 'user@example.test',
      profile: 'colaborador',
      status: 'ativo',
      authorizationVersion: 7,
      credential: {
        id: 'credential-1',
        passwordHash: '$argon2id$fixture',
        policyVersion: 'policy-v1',
      },
    });
    assert.equal(client.released, true);
    assert.equal(client.queries[0]?.text?.includes('lower(usuario.email)'), true);
  });

  it('replaces every PostgreSQL failure with a safe 503', async () => {
    const internal = 'password authentication failed for postgres://secret';
    const client = new ScriptedClient([new Error(internal)]);
    await assert.rejects(
      repository(client).findLoginSubject('user@example.test'),
      (error: unknown) =>
        error instanceof HttpError &&
        error.statusCode === 503 &&
        !error.message.includes(internal) &&
        error.code === 'service_unavailable',
    );
    assert.equal(client.released, true);
  });

  it('keeps opaque-token lookups inside the configured organization', async () => {
    const client = new ScriptedClient([result()]);
    const token = issueOpaqueToken();
    assert.equal(await repository(client).resolveAccessToken(token.hash), null);
    assert.deepEqual(client.queries[0]?.values, [
      Buffer.from(token.hash, 'base64url'),
      'org_tche_fertilidade',
    ]);
  });

  it('keeps IP and identifier in different bucket scopes and bytea values', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const client = new ScriptedClient([
      result(),
      result(),
      result([
        {
          id: 'ip-bucket',
          janela_iniciada_em: now,
          falhas: 4,
          bloqueado_ate: null,
          agora: now,
        },
      ]),
      result(),
      result(),
      result([
        {
          id: 'email-bucket',
          janela_iniciada_em: now,
          falhas: 4,
          bloqueado_ate: null,
          agora: now,
        },
      ]),
      result(),
      result(),
    ]);
    const throttle = new PostgresLoginThrottle({ pool: poolFor(client) });
    const ip = issueOpaqueToken().hash;
    const email = issueOpaqueToken().hash;
    await throttle.recordFailure({
      ipHmac: ip,
      identifierHmac: email,
      windowSeconds: 900,
      failureThreshold: 5,
      lockScheduleSeconds: [60, 120, 240, 480, 900],
    });

    const inserts = client.queries.filter((candidate) =>
      candidate.text?.includes('INSERT INTO public.buckets_limite_autenticacao'),
    );
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0]?.values?.[1], 'endereco_ip');
    assert.equal(inserts[1]?.values?.[1], 'identificador');
    assert.deepEqual(inserts[0]?.values?.[2], Buffer.from(ip, 'base64url'));
    assert.deepEqual(inserts[1]?.values?.[2], Buffer.from(email, 'base64url'));
    assert.equal(client.queries.at(-1)?.text, 'COMMIT');
    assert.equal(client.released, true);
  });
});
