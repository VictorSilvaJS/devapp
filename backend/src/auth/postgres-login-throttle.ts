import type { PoolClient, QueryResultRow } from 'pg';

import type {
  LoginThrottle,
  LoginThrottleDecision,
} from './contracts.js';
import {
  decodeDigest,
  inTransaction,
  query,
  safeDatabaseRead,
  safeDurationSeconds,
  type AuthPostgresPool,
} from './postgres-common.js';

const DEFAULT_ORGANIZATION_ID = 'org_tche_fertilidade';

type BucketScope = 'identificador' | 'endereco_ip';

interface BucketRow extends QueryResultRow {
  id: string;
  janela_iniciada_em: Date;
  falhas: number;
  bloqueado_ate: Date | null;
  agora: Date;
}

export interface PostgresLoginThrottleOptions {
  readonly pool: AuthPostgresPool;
  readonly organizationId?: string;
}

export class PostgresLoginThrottle implements LoginThrottle {
  readonly #pool: AuthPostgresPool;
  readonly #organizationId: string;

  public constructor(options: PostgresLoginThrottleOptions) {
    this.#pool = options.pool;
    this.#organizationId = options.organizationId ?? DEFAULT_ORGANIZATION_ID;
  }

  public checkIp(ipHmac: string): Promise<LoginThrottleDecision> {
    return this.#check('endereco_ip', ipHmac);
  }

  public checkIdentifier(identifierHmac: string): Promise<LoginThrottleDecision> {
    return this.#check('identificador', identifierHmac);
  }

  async #check(
    scope: BucketScope,
    digest: string,
  ): Promise<LoginThrottleDecision> {
    const key = decodeDigest(digest);
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<{ retry_after_seconds: number | null }>(
        client,
        `
          SELECT CASE
            WHEN bloqueado_ate > pg_catalog.clock_timestamp()
            THEN GREATEST(
              1,
              pg_catalog.ceil(
                EXTRACT(
                  epoch FROM bloqueado_ate - pg_catalog.clock_timestamp()
                )
              )::integer
            )
            ELSE NULL
          END AS retry_after_seconds
          FROM public.buckets_limite_autenticacao
          WHERE organizacao_id = $1 AND escopo = $2 AND chave_hmac = $3
        `,
        [this.#organizationId, scope, key],
      );
      const retryAfterSeconds = result.rows[0]?.retry_after_seconds ?? null;
      return retryAfterSeconds === null
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds };
    });
  }

  public recordFailure(input: {
    readonly ipHmac: string;
    readonly identifierHmac: string;
    readonly windowSeconds: number;
    readonly failureThreshold: number;
    readonly lockScheduleSeconds: readonly number[];
  }): Promise<void> {
    const ipKey = decodeDigest(input.ipHmac);
    const identifierKey = decodeDigest(input.identifierHmac);
    const windowSeconds = safeDurationSeconds(input.windowSeconds);
    if (
      !Number.isSafeInteger(input.failureThreshold) ||
      input.failureThreshold < 1 ||
      input.lockScheduleSeconds.length === 0
    ) {
      return Promise.reject(new TypeError('Invalid login throttle policy.'));
    }
    const schedule = input.lockScheduleSeconds.map(safeDurationSeconds);

    return inTransaction(this.#pool, async (client) => {
      // Always acquire IP before identifier so concurrent identities cannot
      // deadlock each other while sharing one source address.
      await this.#recordBucketFailure(client, {
        scope: 'endereco_ip',
        key: ipKey,
        windowSeconds,
        failureThreshold: input.failureThreshold,
        schedule,
      });
      await this.#recordBucketFailure(client, {
        scope: 'identificador',
        key: identifierKey,
        windowSeconds,
        failureThreshold: input.failureThreshold,
        schedule,
      });
    });
  }

  async #recordBucketFailure(
    client: PoolClient,
    input: {
      readonly scope: BucketScope;
      readonly key: Buffer;
      readonly windowSeconds: number;
      readonly failureThreshold: number;
      readonly schedule: readonly number[];
    },
  ): Promise<void> {
    await query(
      client,
      `
        INSERT INTO public.buckets_limite_autenticacao (
          organizacao_id, escopo, chave_hmac
        ) VALUES ($1, $2, $3)
        ON CONFLICT (organizacao_id, escopo, chave_hmac) DO NOTHING
      `,
      [this.#organizationId, input.scope, input.key],
    );
    const locked = await query<BucketRow>(
      client,
      `
        SELECT id, janela_iniciada_em, falhas, bloqueado_ate,
               pg_catalog.clock_timestamp() AS agora
        FROM public.buckets_limite_autenticacao
        WHERE organizacao_id = $1 AND escopo = $2 AND chave_hmac = $3
        FOR UPDATE
      `,
      [this.#organizationId, input.scope, input.key],
    );
    const row = locked.rows[0];
    if (row === undefined) throw new Error('Authentication bucket unavailable.');
    const windowExpired =
      row.agora.getTime() - row.janela_iniciada_em.getTime() >=
      input.windowSeconds * 1_000;
    const failures = windowExpired ? 1 : Number(row.falhas) + 1;
    let blockedUntil: Date | null = null;
    if (failures >= input.failureThreshold) {
      const scheduleIndex = Math.min(
        failures - input.failureThreshold,
        input.schedule.length - 1,
      );
      const seconds = input.schedule[scheduleIndex];
      if (seconds === undefined) throw new Error('Lock schedule unavailable.');
      blockedUntil = new Date(row.agora.getTime() + seconds * 1_000);
    }
    await query(
      client,
      `
        UPDATE public.buckets_limite_autenticacao
        SET janela_iniciada_em = $2, falhas = $3, bloqueado_ate = $4,
            ultima_falha_em = $5
        WHERE id = $1
      `,
      [
        row.id,
        windowExpired ? row.agora : row.janela_iniciada_em,
        failures,
        blockedUntil,
        row.agora,
      ],
    );
  }

  public recordSuccess(input: {
    readonly identifierHmac: string;
  }): Promise<void> {
    const identifierKey = decodeDigest(input.identifierHmac);
    return inTransaction(this.#pool, async (client) => {
      await query(
        client,
        `
          UPDATE public.buckets_limite_autenticacao
          SET janela_iniciada_em = pg_catalog.clock_timestamp(), falhas = 0,
              bloqueado_ate = NULL, ultima_falha_em = NULL
          WHERE organizacao_id = $1 AND escopo = 'identificador'
            AND chave_hmac = $2
        `,
        [this.#organizationId, identifierKey],
      );
    });
  }
}
