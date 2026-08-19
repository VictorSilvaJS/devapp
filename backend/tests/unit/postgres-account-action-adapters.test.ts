import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

import type { AuthenticationPasswordCredentialService } from '../../src/auth/password-credential.js';
import type { AuthPostgresPool } from '../../src/auth/postgres-common.js';
import { HttpError } from '../../src/security/http-error.js';
import { hashActionToken } from '../../src/security/action-token.js';
import {
  PostgresPrimaryEmailPasswordVerifier,
} from '../../src/account-actions/postgres-email-repositories.js';
import { PostgresInvitationRepository } from '../../src/account-actions/postgres-invitation-bootstrap-repositories.js';
import { decodeSha256Hex } from '../../src/account-actions/postgres-common.js';
import { PostgresOutboxRepository } from '../../src/outbox/postgres-repository.js';

type Step = QueryResult<QueryResultRow> | Error;

function result(rows: QueryResultRow[] = []): QueryResult<QueryResultRow> {
  return { command: 'SELECT', rowCount: rows.length, oid: 0, fields: [], rows };
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

describe('PostgreSQL account-action and outbox adapters', () => {
  it('accepts only canonical lowercase SHA-256 hex digests', () => {
    const digest = hashActionToken('one-time-secret');
    assert.deepEqual(decodeSha256Hex(digest), Buffer.from(digest, 'hex'));
    for (const invalid of ['', digest.toUpperCase(), `${digest}0`, 'g'.repeat(64)]) {
      assert.throws(
        () => decodeSha256Hex(invalid),
        (error: unknown) =>
          error instanceof HttpError && error.code === 'service_unavailable',
      );
    }
  });

  it('verifies the current password without returning or logging the PHC', async () => {
    const passwordHash = '$argon2id$fixture-that-must-remain-inside-the-adapter';
    const calls: unknown[][] = [];
    const credentials: AuthenticationPasswordCredentialService = {
      async validateAndHash() {
        throw new Error('not used');
      },
      async rehash() {
        throw new Error('not used');
      },
      async verify(...args) {
        calls.push(args);
        return { valid: true, needsRehash: false };
      },
    };
    const client = new ScriptedClient([
      result([{ senha_phc: passwordHash, credential_version: '42' }]),
    ]);
    const verifier = new PostgresPrimaryEmailPasswordVerifier({
      pool: poolFor(client),
      passwordCredentials: credentials,
    });
    const verified = await verifier.verifyCurrentPassword({
      organizationId: 'org_tche_fertilidade',
      userId: '00000000-0000-4000-8000-000000000001',
      password: 'SenhaInformada1',
    });
    assert.deepEqual(verified, { valid: true, credentialVersion: '42' });
    assert.deepEqual(calls, [['SenhaInformada1', passwordHash]]);
    assert.equal(JSON.stringify(verified).includes('argon2'), false);
  });

  it('revalidates invitation expiry under lock and sends the digest as bytea', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const tokenSha256 = hashActionToken('invitation-token');
    const client = new ScriptedClient([
      result(),
      result([{ organizacao_id: 'org_tche_fertilidade' }]),
      result([{ id: 'org_tche_fertilidade' }]),
      result([{
        id: '00000000-0000-4000-8000-000000000002',
        organizacao_id: 'org_tche_fertilidade',
        nome: 'Convidado',
        email: 'invite@example.test',
        perfil: 'colaborador',
        status: 'pendente',
        version: '7',
        challenge_id: '00000000-0000-4000-8000-000000000003',
        desafio_status: 'ativo',
        convite_id: '00000000-0000-4000-8000-000000000004',
        convite_status: 'pendente',
        modo_ativacao: 'manter_status',
        credencial_id: null,
      }]),
      result(),
      result(),
      result(),
      result(),
      result(),
      result(),
    ]);
    const repository = new PostgresInvitationRepository({
      pool: poolFor(client),
      emailHmacKey: Buffer.alloc(32, 1),
      externalReferenceHmacKey: Buffer.alloc(32, 2),
    });
    const accepted = await repository.acceptInvitationAtomically({
      tokenSha256,
      expectedChallengeId: '00000000-0000-4000-8000-000000000003',
      expectedRecipientVersion: '7',
      passwordPhc: '$argon2id$integration-fixture-value',
      passwordPolicyVersion: 'password-v1',
      acceptedAt: now,
      audit: {
        id: '00000000-0000-4000-8000-000000000005',
        organizationId: 'org_tche_fertilidade',
        eventType: 'auth.convite.aceito',
        result: 'success',
        occurredAt: now,
        actorUserId: '00000000-0000-4000-8000-000000000006',
        actorSessionId: '00000000-0000-4000-8000-000000000007',
        affectedUserId: '00000000-0000-4000-8000-000000000002',
      },
    });
    assert.equal(accepted, 'accepted');
    const lockingQuery = client.queries.find((candidate) =>
      candidate.text?.includes('FOR UPDATE OF desafio, convite, usuario'),
    );
    assert.ok(lockingQuery?.text?.includes('FOR UPDATE OF desafio, convite, usuario'));
    assert.ok(lockingQuery?.text?.includes('desafio.expira_em > $2'));
    assert.deepEqual(lockingQuery?.values, [Buffer.from(tokenSha256, 'hex'), now]);
    const auditQuery = client.queries.find((candidate) =>
      candidate.text?.includes('INSERT INTO public.eventos_auditoria'),
    );
    assert.ok(auditQuery?.text?.includes('sessao_id, usuario_afetado_id'));
    assert.equal(auditQuery?.values?.[6], '00000000-0000-4000-8000-000000000007');
    assert.equal(auditQuery?.values?.[7], '00000000-0000-4000-8000-000000000002');
    assert.equal(client.queries.at(-1)?.text, 'COMMIT');
  });

  it('claims with SKIP LOCKED and maps a versioned AEAD envelope', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const leaseExpiresAt = new Date('2026-08-19T12:00:30.000Z');
    const expiresAt = new Date('2026-08-19T13:00:00.000Z');
    const client = new ScriptedClient([
      result(),
      result(),
      result(),
      result([{
        id: '00000000-0000-4000-8000-000000000010',
        organizacao_id: 'org_tche_fertilidade',
        desafio_id: null,
        tipo_mensagem: 'auth.email',
        payload_cifrado: Buffer.from('ciphertext'),
        chave_id: 'key-1',
        nonce: Buffer.alloc(12, 3),
        tag_autenticacao: Buffer.alloc(16, 4),
        contexto_autenticado: { version: 1, algorithm: 'aes-256-gcm' },
        tentativas: 1,
        maximo_tentativas: 8,
        expira_em: expiresAt,
        lease_token: '00000000-0000-4000-8000-000000000011',
      }]),
      result(),
    ]);
    const repository = new PostgresOutboxRepository({ pool: poolFor(client) });
    const claimed = await repository.claimReady({
      workerId: 'worker-1',
      limit: 20,
      now,
      leaseExpiresAt,
    });
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.attempt, 1);
    assert.equal(claimed[0]?.payload.iv, Buffer.alloc(12, 3).toString('base64url'));
    const claimQuery = client.queries.find((candidate) =>
      candidate.text?.includes('FOR UPDATE SKIP LOCKED'),
    );
    assert.ok(claimQuery);
    assert.deepEqual(claimQuery.values, [now, 20, 'worker-1', leaseExpiresAt]);
  });

  it('uses lease CAS and wipes all decryptable payload parts on delivery', async () => {
    const deliveredAt = new Date('2026-08-19T12:00:10.000Z');
    const client = new ScriptedClient([
      result(),
      result([{
        organizacao_id: 'org_tche_fertilidade',
        usuario_id: null,
      }]),
      result(),
      result(),
    ]);
    const repository = new PostgresOutboxRepository({ pool: poolFor(client) });
    assert.equal(await repository.markDelivered({
      messageId: '00000000-0000-4000-8000-000000000010',
      leaseToken: '00000000-0000-4000-8000-000000000011',
      deliveredAt,
      providerMessageId: ' smtp-provider-42 ',
    }), true);
    const terminal = client.queries[1]?.text ?? '';
    assert.match(terminal, /payload_cifrado = NULL, nonce = NULL/u);
    assert.match(terminal, /lease_token = \$2/u);
    assert.match(terminal, /lease_expira_em > \$3/u);
    assert.equal(client.queries[2]?.text?.includes('eventos_auditoria'), true);
    assert.equal(client.queries.at(-1)?.text, 'COMMIT');
  });

  it('maps PostgreSQL details to one safe 503', async () => {
    const client = new ScriptedClient([
      new Error('postgres://user:secret@internal/production'),
    ]);
    await assert.rejects(
      new PostgresOutboxRepository({ pool: poolFor(client) }).isChallengeActive({
        organizationId: 'org_tche_fertilidade',
        challengeId: '00000000-0000-4000-8000-000000000001',
        now: new Date(),
      }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.statusCode === 503 &&
        !error.message.includes('secret'),
    );
  });
});
