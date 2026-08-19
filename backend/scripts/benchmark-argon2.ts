import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { loadAuthenticationRuntimeConfig } from '../src/auth/config.js';
import { Argon2idPasswordHasher } from '../src/auth/password-hasher.js';

const SAMPLE_COUNT = 5;

function percentile(values: readonly number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

async function main(): Promise<void> {
  const config = loadAuthenticationRuntimeConfig(process.env);
  const hasher = new Argon2idPasswordHasher(config.password.argon2);
  const samples: number[] = [];

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const password = `Benchmark-only-${index}-${randomUUID()}`;
    const startedAt = performance.now();
    const passwordHash = await hasher.hash(password);
    const verification = await hasher.verify(password, passwordHash);
    if (!verification.valid) {
      throw new Error('Argon2id benchmark verification failed.');
    }
    samples.push(performance.now() - startedAt);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        algorithm: 'argon2id',
        node: process.version,
        samples: SAMPLE_COUNT,
        parameters: {
          memory_kib: config.password.argon2.memoryCostKiB,
          time_cost: config.password.argon2.timeCost,
          parallelism: config.password.argon2.parallelism,
          maximum_concurrency: config.password.argon2.maximumConcurrency,
        },
        milliseconds: {
          minimum: Math.round(Math.min(...samples)),
          median: Math.round(percentile(samples, 0.5)),
          p95: Math.round(percentile(samples, 0.95)),
          maximum: Math.round(Math.max(...samples)),
        },
      },
      null,
      2,
    )}\n`,
  );
}

await main();
