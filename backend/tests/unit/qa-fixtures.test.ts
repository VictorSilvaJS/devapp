import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { Pool } from 'pg';

import {
  loadQaFixtureConfig,
  QaFixtureGuardError,
  runQaFixtureLoader,
} from '../../scripts/load-qa-fixtures.js';

const explicitQaUrl =
  'postgresql://qa:local@127.0.0.1:5432/tche_agro_qa';
const fixturePassword = 'SenhaSinteticaQa9!';

describe('manual QA fixture loader guards', () => {
  it('accepts only explicit development/test/qa targets ending in _test or _qa', () => {
    for (const [environment, databaseUrl] of [
      ['development', explicitQaUrl],
      ['qa', explicitQaUrl],
      ['test', 'postgresql://qa:local@127.0.0.1:5432/tche_agro_test'],
    ] as const) {
      const config = loadQaFixtureConfig({
        NODE_ENV: environment,
        ALLOW_QA_FIXTURES: 'true',
        QA_FIXTURES_DATABASE_URL: databaseUrl,
        QA_FIXTURES_PASSWORD: fixturePassword,
      });
      assert.equal(config.environment, environment);
      assert.equal(config.database.connectionString, databaseUrl);
    }
  });

  it('rejects production absolutely even with every other guard satisfied', () => {
    assert.throws(
      () =>
        loadQaFixtureConfig({
          NODE_ENV: 'production',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_DATABASE_URL: explicitQaUrl,
          QA_FIXTURES_PASSWORD: fixturePassword,
        }),
      (error: unknown) =>
        error instanceof QaFixtureGuardError &&
        error.message.includes('proibidas em production'),
    );
  });

  it('requires the exact opt-in and a protected database suffix', () => {
    for (const environment of [
      {
        NODE_ENV: 'development',
        QA_FIXTURES_DATABASE_URL: explicitQaUrl,
        QA_FIXTURES_PASSWORD: fixturePassword,
      },
      {
        NODE_ENV: 'development',
        ALLOW_QA_FIXTURES: 'TRUE',
        QA_FIXTURES_DATABASE_URL: explicitQaUrl,
        QA_FIXTURES_PASSWORD: fixturePassword,
      },
      {
        NODE_ENV: 'development',
        ALLOW_QA_FIXTURES: 'true',
        QA_FIXTURES_DATABASE_URL:
          'postgresql://qa:local@127.0.0.1:5432/tche_agro',
        QA_FIXTURES_PASSWORD: fixturePassword,
      },
    ]) {
      assert.throws(() => loadQaFixtureConfig(environment), QaFixtureGuardError);
    }
  });

  it('never falls back to ambient DATABASE_URL and guards before Pool creation', async () => {
    let poolCreations = 0;
    await assert.rejects(
      runQaFixtureLoader(
        {
          NODE_ENV: 'test',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_PASSWORD: fixturePassword,
          DATABASE_URL:
            'postgresql://ambient:local@127.0.0.1:5432/ambient_test',
        },
        () => {
          poolCreations += 1;
          throw new Error('Pool must not be constructed.');
        },
      ),
      (error: unknown) =>
        error instanceof QaFixtureGuardError &&
        error.message.includes('QA_FIXTURES_DATABASE_URL'),
    );
    assert.equal(poolCreations, 0);
  });

  it('requires a password and validates its policy before Pool creation', async () => {
    let poolCreations = 0;
    const poolFactory = () => {
      poolCreations += 1;
      throw new Error('Pool must not be constructed.');
    };

    await assert.rejects(
      runQaFixtureLoader(
        {
          NODE_ENV: 'test',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_DATABASE_URL: explicitQaUrl,
        },
        poolFactory,
      ),
      (error: unknown) =>
        error instanceof QaFixtureGuardError &&
        error.message.includes('QA_FIXTURES_PASSWORD'),
    );
    await assert.rejects(
      runQaFixtureLoader(
        {
          NODE_ENV: 'test',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_DATABASE_URL: explicitQaUrl,
          QA_FIXTURES_PASSWORD: 'curta',
        },
        poolFactory,
      ),
      (error: unknown) =>
        error instanceof QaFixtureGuardError &&
        error.message.includes('política de senha'),
    );
    assert.equal(poolCreations, 0);
  });

  it('always ends a constructed Pool when the initial connection fails', async () => {
    let poolEnds = 0;
    const connectionFailure = new Error('synthetic connection failure');
    const pool = {
      on() {
        return this;
      },
      async connect() {
        throw connectionFailure;
      },
      async end() {
        poolEnds += 1;
      },
    } as unknown as Pool;

    await assert.rejects(
      runQaFixtureLoader(
        {
          NODE_ENV: 'test',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_DATABASE_URL: explicitQaUrl,
          QA_FIXTURES_PASSWORD: fixturePassword,
        },
        () => pool,
      ),
      connectionFailure,
    );
    assert.equal(poolEnds, 1);
  });

  it('rejects unsafe URL options instead of combining SSL modes', () => {
    assert.throws(
      () =>
        loadQaFixtureConfig({
          NODE_ENV: 'qa',
          ALLOW_QA_FIXTURES: 'true',
          QA_FIXTURES_DATABASE_URL: `${explicitQaUrl}?sslmode=disable`,
          QA_FIXTURES_PASSWORD: fixturePassword,
        }),
      QaFixtureGuardError,
    );
  });
});
