import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertDestructiveDatabaseTestsAllowed,
  databaseNameFromConnectionString,
} from '../../scripts/destructive-database-test-guard.js';

const safeUrl = 'postgresql://test_user:test_password@127.0.0.1:5432/tche_agro_test';

test('extrai o nome do banco da URL sem consultar DATABASE_URL ambiente', () => {
  assert.equal(databaseNameFromConnectionString(safeUrl), 'tche_agro_test');
});

test('libera destrutivo somente quando as tres condicoes sao simultaneas', () => {
  assert.doesNotThrow(() =>
    assertDestructiveDatabaseTestsAllowed(safeUrl, {
      NODE_ENV: 'test',
      ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'true',
    }),
  );

  assert.throws(
    () => assertDestructiveDatabaseTestsAllowed(safeUrl, {
      NODE_ENV: 'development',
      ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'true',
    }),
    /NODE_ENV=test/,
  );
  assert.throws(
    () => assertDestructiveDatabaseTestsAllowed(
      'postgresql://test:test@127.0.0.1:5432/tche_agro',
      { NODE_ENV: 'test', ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'true' },
    ),
    /terminado em _test/,
  );
  assert.throws(
    () => assertDestructiveDatabaseTestsAllowed(safeUrl, {
      NODE_ENV: 'test',
      ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'false',
    }),
    /ALLOW_DESTRUCTIVE_DATABASE_TESTS=true/,
  );
});

test('nao aceita aproximações ou caixa diferente para a flag destrutiva', () => {
  for (const flag of ['TRUE', '1', 'yes', ' true', undefined]) {
    assert.throws(
      () => assertDestructiveDatabaseTestsAllowed(safeUrl, {
        NODE_ENV: 'test',
        ...(flag === undefined ? {} : { ALLOW_DESTRUCTIVE_DATABASE_TESTS: flag }),
      }),
      /ALLOW_DESTRUCTIVE_DATABASE_TESTS=true/,
    );
  }
});
