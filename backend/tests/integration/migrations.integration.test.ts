import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { Pool, type PoolClient, type QueryResult } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import { buildApp } from '../../src/app.js';
import { loadRuntimeConfig, type DatabaseConfig } from '../../src/config.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';

interface TitularLinkState {
  titular_id: string;
  status: string;
}

describe('migration inicial PostgreSQL/PostGIS', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let migrationDatabase: DatabaseConfig | undefined;
  let pool: Pool | undefined;
  let migrationApplied = false;

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );

    // Falha de inicializacao do container deve falhar a suite; nunca vira skip.
    const previousAmbientUrl = process.env.DATABASE_URL;
    const ambientSentinelUrl =
      'postgresql://ambient:sentinel@database.invalid:5432/ambient_must_not_be_used';
    process.env.DATABASE_URL = ambientSentinelUrl;
    try {
      testDatabase = await startPostgisTestDatabase();
      assert.notEqual(testDatabase.connectionString, ambientSentinelUrl);
      assert.equal(testDatabase.database.connectionString, testDatabase.connectionString);
      assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
      pool = new Pool(buildPostgresPoolConfig(testDatabase.database));
      await pool.query(`
        CREATE SCHEMA outro_schema;
        CREATE TABLE outro_schema.organizacoes (marker text NOT NULL);
        CREATE TABLE outro_schema.usuarios (marker text NOT NULL);
        CREATE TABLE outro_schema.produtores (marker text NOT NULL);
        CREATE TABLE outro_schema.propriedades (marker text NOT NULL);
        CREATE TABLE outro_schema.usuario_propriedade (marker text NOT NULL);
        CREATE TABLE outro_schema.tche_agro_migrations (marker text NOT NULL);
        CREATE INDEX ix_propriedades_organizacao_titular
          ON outro_schema.propriedades (marker);
        INSERT INTO outro_schema.organizacoes (marker) VALUES ('sentinela');
        CREATE FUNCTION outro_schema.tche_definir_atualizado_em()
        RETURNS text LANGUAGE sql IMMUTABLE
        AS $sentinel$ SELECT 'sentinela-atualizado'::text $sentinel$;
        CREATE FUNCTION outro_schema.tche_impedir_alteracao_organizacao_id()
        RETURNS text LANGUAGE sql IMMUTABLE
        AS $sentinel$ SELECT 'sentinela-organizacao'::text $sentinel$;
        CREATE FUNCTION outro_schema.tche_serializar_invariantes_organizacao()
        RETURNS text LANGUAGE sql IMMUTABLE
        AS $sentinel$ SELECT 'sentinela-serializacao'::text $sentinel$;
        CREATE FUNCTION outro_schema.tche_validar_compatibilidade_identidade_vinculos()
        RETURNS text LANGUAGE sql IMMUTABLE
        AS $sentinel$ SELECT 'sentinela-vinculos'::text $sentinel$;
      `);

      const adversarialUrl = new URL(testDatabase.connectionString);
      adversarialUrl.searchParams.set('options', '-csearch_path=outro_schema');
      migrationDatabase = Object.freeze({
        ...testDatabase.database,
        connectionString: adversarialUrl.toString(),
      });
      assertDestructiveDatabaseTestsAllowed(migrationDatabase.connectionString);
    } finally {
      if (previousAmbientUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousAmbientUrl;
      }
    }
  });

  after(async () => {
    const activePool = pool;
    const activeDatabase = testDatabase;
    const activeMigrationDatabase = migrationDatabase;
    try {
      await activePool?.end();
      if (
        activeDatabase !== undefined
        && activeMigrationDatabase !== undefined
        && migrationApplied
      ) {
        assertDestructiveDatabaseTestsAllowed(
          activeMigrationDatabase.connectionString,
        );
        await runMigrations({ command: 'down', database: activeMigrationDatabase });
      }
    } finally {
      await activeDatabase?.container.stop();
    }
  });

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
  }

  function requireMigrationDatabase(): DatabaseConfig {
    assert.ok(migrationDatabase);
    return migrationDatabase;
  }

  async function expectCommitFailure(client: PoolClient, pattern: RegExp): Promise<void> {
    await assert.rejects(client.query('COMMIT'), pattern);
    await client.query('ROLLBACK');
  }

  test('startup da API não executa migrations automaticamente', async () => {
    const activeDatabase = testDatabase;
    assert.ok(activeDatabase);
    const databasePool = requirePool();
    const app = await buildApp({
      config: loadRuntimeConfig({
        NODE_ENV: 'test',
        DATABASE_URL: activeDatabase.connectionString,
        LOG_LEVEL: 'silent',
      }),
      database: databasePool,
      logger: false,
    });

    try {
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      const health = await fetch(`${address}/v1/health`);
      assert.equal(health.status, 200);

      const schema = await databasePool.query<{ app_table: string | null }>(
        "SELECT to_regclass('public.organizacoes')::text AS app_table",
      );
      assert.equal(schema.rows[0]?.app_table, null);
    } finally {
      await app.close();
    }
  });

  test('cria PostGIS, tabelas canônicas e organização técnica separada do nome', async () => {
    await runMigrations({ command: 'up', database: requireMigrationDatabase() });
    migrationApplied = true;

    const databasePool = requirePool();
    const extension = await databasePool.query<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname = 'postgis'",
    );
    assert.equal(extension.rowCount, 1);

    const tables = await databasePool.query<{ name: string }>(`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'organizacoes',
          'usuarios',
          'produtores',
          'propriedades',
          'usuario_propriedade'
        )
      ORDER BY tablename
    `);
    assert.deepEqual(
      tables.rows.map((row) => row.name),
      ['organizacoes', 'produtores', 'propriedades', 'usuario_propriedade', 'usuarios'],
    );

    const migrationTables = await databasePool.query<{
      public_table: string | null;
      sentinel_table: string | null;
    }>(`
      SELECT
        to_regclass('public.tche_agro_migrations')::text AS public_table,
        to_regclass('outro_schema.tche_agro_migrations')::text AS sentinel_table
    `);
    assert.equal(migrationTables.rows[0]?.public_table, 'tche_agro_migrations');
    assert.equal(
      migrationTables.rows[0]?.sentinel_table,
      'outro_schema.tche_agro_migrations',
    );

    const organization = await databasePool.query<{ id: string; nome: string }>(
      'SELECT id, nome FROM organizacoes',
    );
    assert.deepEqual(organization.rows, [{
      id: ORGANIZATION_ID,
      nome: 'Tchê Fertilidade',
    }]);
    await assert.rejects(
      databasePool.query(
        "UPDATE organizacoes SET id = 'outra_org' WHERE id = $1",
        [ORGANIZATION_ID],
      ),
      /imutavel|ck_organizacoes_id_tecnico/i,
    );
  });

  test('aceita inserção fora da ordem quando o estado final satisfaz as FKs compostas', async () => {
    const client = await requirePool().connect();
    const userId = randomUUID();
    const producerId = randomUUID();
    const propertyId = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO propriedades (
          id, organizacao_id, titular_id, nome,
          municipio_id, municipio_nome, uf_id, uf_sigla
        ) VALUES ($1, $2, $3, 'Propriedade ordem inversa', '4314902', 'Porto Alegre', '43', 'RS')
      `, [propertyId, ORGANIZATION_ID, producerId]);
      await client.query(`
        INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1, $2, $3, 'Produtor ordem inversa', 'ativo')
      `, [producerId, ORGANIZATION_ID, userId]);
      await client.query(`
        INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES ($1, $2, 'Usuário ordem inversa', $3, 'produtor', 'ativo')
      `, [userId, ORGANIZATION_ID, `ordem-${userId}@example.test`]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const persisted = await requirePool().query(
      'SELECT titular_id FROM propriedades WHERE id = $1',
      [propertyId],
    );
    assert.equal(persisted.rows[0]?.titular_id, producerId);
  });

  test('titular_id é a única titularidade e conta principal inativa preserva o cadastro', async () => {
    const databasePool = requirePool();
    const owner = await databasePool.query<{ user_id: string; property_id: string }>(`
      SELECT produtor.usuario_id AS user_id, propriedade.id AS property_id
      FROM propriedades AS propriedade
      JOIN produtores AS produtor ON produtor.id = propriedade.titular_id
      LIMIT 1
    `);
    const row = owner.rows[0];
    assert.ok(row);

    await databasePool.query(
      "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
      [row.user_id],
    );
    const propertyStillExists = await databasePool.query(
      'SELECT 1 FROM propriedades WHERE id = $1',
      [row.property_id],
    );
    assert.equal(propertyStillExists.rowCount, 1);

    await assert.rejects(
      databasePool.query(`
        INSERT INTO usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo
        ) VALUES ($1, $2, $3, 'titular')
      `, [ORGANIZATION_ID, row.user_id, row.property_id]),
      /ck_usuario_propriedade_tipo_vinculo|check constraint/i,
    );
    await assert.rejects(
      databasePool.query(`
        INSERT INTO usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo
        ) VALUES ($1, $2, $3, 'usuario_autorizado')
      `, [ORGANIZATION_ID, row.user_id, row.property_id]),
      /Vinculo adicional ativo incompativel com perfil ou titularidade derivada/i,
    );
    const duplicatedTitle = await databasePool.query(`
      SELECT 1
      FROM usuario_propriedade
      WHERE propriedade_id = $1 AND usuario_id = $2
    `, [row.property_id, row.user_id]);
    assert.equal(duplicatedTitle.rowCount, 0);
  });

  test('impede vínculo ativo duplicado e preserva múltiplos registros inativos', async () => {
    const databasePool = requirePool();
    const userId = randomUUID();
    const property = await databasePool.query<{ id: string }>('SELECT id FROM propriedades LIMIT 1');
    const propertyId = property.rows[0]?.id;
    assert.ok(propertyId);

    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Colaborador duplicidade', $3, 'colaborador', 'ativo')
    `, [userId, ORGANIZATION_ID, `duplicidade-${userId}@example.test`]);
    await databasePool.query(`
      INSERT INTO usuario_propriedade (
        organizacao_id, usuario_id, propriedade_id, tipo_vinculo
      ) VALUES ($1, $2, $3, 'colaborador')
    `, [ORGANIZATION_ID, userId, propertyId]);
    await assert.rejects(
      databasePool.query(`
        INSERT INTO usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo
        ) VALUES ($1, $2, $3, 'colaborador')
      `, [ORGANIZATION_ID, userId, propertyId]),
      /ux_usuario_propriedade_vinculo_ativo_equivalente|duplicate key/i,
    );

    await databasePool.query(`
      UPDATE usuario_propriedade
      SET status = 'inativo', motivo_inativacao = 'Substituição de teste'
      WHERE usuario_id = $1 AND propriedade_id = $2
    `, [userId, propertyId]);
    await databasePool.query(`
      INSERT INTO usuario_propriedade (
        organizacao_id, usuario_id, propriedade_id, tipo_vinculo,
        status, motivo_inativacao
      ) VALUES ($1, $2, $3, 'colaborador', 'inativo', 'Histórico adicional')
    `, [ORGANIZATION_ID, userId, propertyId]);
    const inactive = await databasePool.query(
      "SELECT 1 FROM usuario_propriedade WHERE usuario_id = $1 AND status = 'inativo'",
      [userId],
    );
    assert.equal(inactive.rowCount, 2);
  });

  test('compatibilidade ativa é diferida e vale em qualquer ordem dentro da transação', async () => {
    const databasePool = requirePool();
    const property = await databasePool.query<{ id: string }>('SELECT id FROM propriedades LIMIT 1');
    const propertyId = property.rows[0]?.id;
    assert.ok(propertyId);

    for (const profileFirst of [true, false]) {
      const client = await databasePool.connect();
      const userId = randomUUID();
      const producerId = randomUUID();
      try {
        await client.query('BEGIN');
        await client.query(`
          INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
          VALUES ($1, $2, 'Produtor conversão', $3, 'produtor', 'ativo')
        `, [userId, ORGANIZATION_ID, `conversao-${userId}@example.test`]);
        await client.query(`
          INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
          VALUES ($1, $2, $3, 'Produtor conversão', 'ativo')
        `, [producerId, ORGANIZATION_ID, userId]);
        await client.query(`
          INSERT INTO usuario_propriedade (
            organizacao_id, usuario_id, propriedade_id, tipo_vinculo
          ) VALUES ($1, $2, $3, 'usuario_autorizado')
        `, [ORGANIZATION_ID, userId, propertyId]);

        const changeProfile = () => client.query(
          "UPDATE usuarios SET perfil = 'colaborador' WHERE id = $1",
          [userId],
        );
        const changeLink = () => client.query(`
          UPDATE usuario_propriedade
          SET tipo_vinculo = 'colaborador'
          WHERE usuario_id = $1 AND propriedade_id = $2 AND status = 'ativo'
        `, [userId, propertyId]);
        if (profileFirst) {
          await changeProfile();
          await changeLink();
        } else {
          await changeLink();
          await changeProfile();
        }
        await client.query('DELETE FROM produtores WHERE id = $1', [producerId]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    }

    const invalidClient = await databasePool.connect();
    try {
      const invalidUserId = randomUUID();
      await invalidClient.query('BEGIN');
      await invalidClient.query(`
        INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES ($1, $2, 'Admin incompatível', $3, 'admin', 'ativo')
      `, [invalidUserId, ORGANIZATION_ID, `invalido-${invalidUserId}@example.test`]);
      await invalidClient.query(`
        INSERT INTO usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo
        ) VALUES ($1, $2, $3, 'colaborador')
      `, [ORGANIZATION_ID, invalidUserId, propertyId]);
      await expectCommitFailure(invalidClient, /Vinculo adicional ativo incompativel/i);
    } finally {
      invalidClient.release();
    }
  });

  test('acesso derivado do Titular não pode ser duplicado como vínculo adicional ativo', async () => {
    const databasePool = requirePool();
    const property = await databasePool.query<{ id: string }>('SELECT id FROM propriedades LIMIT 1');
    const propertyId = property.rows[0]?.id;
    assert.ok(propertyId);

    for (const propertyFirst of [true, false]) {
      const userId = randomUUID();
      const producerId = randomUUID();
      await databasePool.query(`
        INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES ($1, $2, 'Candidato titular', $3, 'produtor', 'ativo')
      `, [userId, ORGANIZATION_ID, `titular-derivado-${userId}@example.test`]);
      await databasePool.query(`
        INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1, $2, $3, 'Candidato titular', 'ativo')
      `, [producerId, ORGANIZATION_ID, userId]);
      await databasePool.query(`
        INSERT INTO usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo
        ) VALUES ($1, $2, $3, 'usuario_autorizado')
      `, [ORGANIZATION_ID, userId, propertyId]);

      if (propertyFirst) {
        const invalidClient = await databasePool.connect();
        try {
          await invalidClient.query('BEGIN');
          await invalidClient.query(
            'UPDATE propriedades SET titular_id = $1 WHERE id = $2',
            [producerId, propertyId],
          );
          await expectCommitFailure(
            invalidClient,
            /Vinculo adicional ativo incompativel com perfil ou titularidade derivada/i,
          );
        } finally {
          invalidClient.release();
        }
      }

      const client = await databasePool.connect();
      try {
        await client.query('BEGIN');
        const transferTitle = () => client.query(
          'UPDATE propriedades SET titular_id = $1 WHERE id = $2',
          [producerId, propertyId],
        );
        const preserveAsHistory = () => client.query(`
          UPDATE usuario_propriedade
          SET status = 'inativo', motivo_inativacao = 'Acesso passou a ser derivado da titularidade'
          WHERE usuario_id = $1
            AND propriedade_id = $2
            AND tipo_vinculo = 'usuario_autorizado'
            AND status = 'ativo'
        `, [userId, propertyId]);

        if (propertyFirst) {
          await transferTitle();
          await preserveAsHistory();
        } else {
          await preserveAsHistory();
          await transferTitle();
        }
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const persistedState: QueryResult<TitularLinkState> =
        await databasePool.query<TitularLinkState>(`
        SELECT propriedade.titular_id, vinculo.status
        FROM propriedades AS propriedade
        JOIN usuario_propriedade AS vinculo
          ON vinculo.organizacao_id = propriedade.organizacao_id
         AND vinculo.propriedade_id = propriedade.id
        WHERE propriedade.id = $1 AND vinculo.usuario_id = $2
        `, [propertyId, userId]);
      assert.deepEqual(persistedState.rows, [{
        titular_id: producerId,
        status: 'inativo',
      }]);
    }
  });

  test('serializa writes concorrentes e impede write-skew de titularidade', async () => {
    const databasePool = requirePool();
    const property = await databasePool.query<{
      id: string;
      titular_id: string;
    }>('SELECT id, titular_id FROM propriedades LIMIT 1');
    const currentProperty = property.rows[0];
    assert.ok(currentProperty);

    const userId = randomUUID();
    const producerId = randomUUID();
    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Produtor concorrente', $3, 'produtor', 'ativo')
    `, [userId, ORGANIZATION_ID, `concorrente-${userId}@example.test`]);
    await databasePool.query(`
      INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
      VALUES ($1, $2, $3, 'Produtor concorrente', 'ativo')
    `, [producerId, ORGANIZATION_ID, userId]);
    assert.notEqual(currentProperty.titular_id, producerId);

    const titleClient = await databasePool.connect();
    const linkClient = await databasePool.connect();
    let results: PromiseSettledResult<void>[] = [];
    try {
      await Promise.all([
        titleClient.query('BEGIN ISOLATION LEVEL READ COMMITTED'),
        linkClient.query('BEGIN ISOLATION LEVEL READ COMMITTED'),
      ]);
      await Promise.all([
        titleClient.query("SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '15s'"),
        linkClient.query("SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '15s'"),
      ]);

      results = await Promise.allSettled([
        (async () => {
          await titleClient.query(
            'UPDATE propriedades SET titular_id = $1 WHERE id = $2',
            [producerId, currentProperty.id],
          );
          await titleClient.query('COMMIT');
        })(),
        (async () => {
          await linkClient.query(`
            INSERT INTO usuario_propriedade (
              organizacao_id, usuario_id, propriedade_id, tipo_vinculo
            ) VALUES ($1, $2, $3, 'usuario_autorizado')
          `, [ORGANIZATION_ID, userId, currentProperty.id]);
          await linkClient.query('COMMIT');
        })(),
      ]);
    } finally {
      await Promise.allSettled([
        titleClient.query('ROLLBACK'),
        linkClient.query('ROLLBACK'),
      ]);
      titleClient.release();
      linkClient.release();
    }

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(
      String(rejected[0]?.reason),
      /Vinculo adicional ativo incompativel com perfil ou titularidade derivada/i,
    );

    const finalState = await databasePool.query<{
      titular_id: string;
      active_link_count: number;
    }>(`
      SELECT
        propriedade.titular_id,
        count(vinculo.id) FILTER (
          WHERE vinculo.usuario_id = $2
            AND vinculo.tipo_vinculo = 'usuario_autorizado'
            AND vinculo.status = 'ativo'
        )::integer AS active_link_count
      FROM propriedades AS propriedade
      LEFT JOIN usuario_propriedade AS vinculo
        ON vinculo.organizacao_id = propriedade.organizacao_id
       AND vinculo.propriedade_id = propriedade.id
      WHERE propriedade.id = $1
      GROUP BY propriedade.id, propriedade.titular_id
    `, [currentProperty.id, userId]);
    const persisted = finalState.rows[0];
    assert.ok(persisted);
    const isTitle = persisted.titular_id === producerId;
    const hasAdditionalLink = persisted.active_link_count === 1;
    assert.notEqual(isTitle, hasAdditionalLink);
  });

  test('vínculo inativo permanece como histórico após mudança estrutural', async () => {
    const databasePool = requirePool();
    const property = await databasePool.query<{ id: string }>('SELECT id FROM propriedades LIMIT 1');
    const propertyId = property.rows[0]?.id;
    assert.ok(propertyId);
    const userId = randomUUID();
    const producerId = randomUUID();

    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Produtor histórico', $3, 'produtor', 'inativo')
    `, [userId, ORGANIZATION_ID, `historico-${userId}@example.test`]);
    await databasePool.query(`
      INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
      VALUES ($1, $2, $3, 'Produtor histórico', 'inativo')
    `, [producerId, ORGANIZATION_ID, userId]);
    await databasePool.query(`
      INSERT INTO usuario_propriedade (
        organizacao_id, usuario_id, propriedade_id, tipo_vinculo,
        status, motivo_inativacao
      ) VALUES ($1, $2, $3, 'usuario_autorizado', 'inativo', 'Encerrado')
    `, [ORGANIZATION_ID, userId, propertyId]);

    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE usuarios SET perfil = 'colaborador' WHERE id = $1", [userId]);
      await client.query('DELETE FROM produtores WHERE id = $1', [producerId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const history = await databasePool.query<{ status: string; tipo_vinculo: string }>(`
      SELECT status, tipo_vinculo
      FROM usuario_propriedade
      WHERE usuario_id = $1
    `, [userId]);
    assert.deepEqual(history.rows, [{
      status: 'inativo',
      tipo_vinculo: 'usuario_autorizado',
    }]);
  });

  test('atualizado_em é sempre definido automaticamente pelo trigger', async () => {
    const databasePool = requirePool();
    const property = await databasePool.query<{ id: string }>('SELECT id FROM propriedades LIMIT 1');
    const propertyId = property.rows[0]?.id;
    assert.ok(propertyId);
    const updated = await databasePool.query<{ atualizado_em: Date }>(`
      UPDATE propriedades
      SET nome = nome || ' atualizada', atualizado_em = '2000-01-01T00:00:00Z'
      WHERE id = $1
      RETURNING atualizado_em
    `, [propertyId]);
    const updatedAt = updated.rows[0]?.atualizado_em;
    assert.ok(updatedAt);
    assert.ok(updatedAt.getTime() > Date.UTC(2020, 0, 1));
  });

  test('todas as FKs bloqueiam exclusão e nenhuma usa cascade destrutiva', async () => {
    const foreignKeys = await requirePool().query<{
      constraint_name: string;
      delete_action: string;
    }>(`
      SELECT conname AS constraint_name, confdeltype AS delete_action
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
      ORDER BY conname
    `);

    assert.ok(foreignKeys.rowCount !== null && foreignKeys.rowCount > 0);
    assert.deepEqual(
      [...new Set(foreignKeys.rows.map((row) => row.delete_action))].sort(),
      ['a', 'r'],
    );
  });

  test('down remove apenas objetos do aplicativo e preserva PostGIS', async () => {
    const activeDatabase = testDatabase;
    assert.ok(activeDatabase);
    const activeMigrationDatabase = requireMigrationDatabase();
    const databasePool = requirePool();
    assertDestructiveDatabaseTestsAllowed(activeMigrationDatabase.connectionString);
    await runMigrations({ command: 'down', database: activeMigrationDatabase });

    const afterDown = await databasePool.query<{
      app_table: string | null;
      postgis: string | null;
      sentinel_table: string | null;
      sentinel_index: string | null;
      sentinel_updated_function: string | null;
      sentinel_organization_function: string | null;
      sentinel_serialization_function: string | null;
      sentinel_links_function: string | null;
      sentinel_value: string;
    }>(`
      SELECT
        to_regclass('public.propriedades')::text AS app_table,
        (SELECT extname FROM pg_extension WHERE extname = 'postgis') AS postgis,
        to_regclass('outro_schema.propriedades')::text AS sentinel_table,
        to_regclass('outro_schema.ix_propriedades_organizacao_titular')::text
          AS sentinel_index,
        to_regprocedure('outro_schema.tche_definir_atualizado_em()')::text
          AS sentinel_updated_function,
        to_regprocedure('outro_schema.tche_impedir_alteracao_organizacao_id()')::text
          AS sentinel_organization_function,
        to_regprocedure('outro_schema.tche_serializar_invariantes_organizacao()')::text
          AS sentinel_serialization_function,
        to_regprocedure(
          'outro_schema.tche_validar_compatibilidade_identidade_vinculos()'
        )::text AS sentinel_links_function,
        (SELECT marker FROM outro_schema.organizacoes LIMIT 1) AS sentinel_value
    `);
    assert.equal(afterDown.rows[0]?.app_table, null);
    assert.equal(afterDown.rows[0]?.postgis, 'postgis');
    assert.equal(afterDown.rows[0]?.sentinel_table, 'outro_schema.propriedades');
    assert.equal(
      afterDown.rows[0]?.sentinel_index,
      'outro_schema.ix_propriedades_organizacao_titular',
    );
    assert.equal(
      afterDown.rows[0]?.sentinel_updated_function,
      'outro_schema.tche_definir_atualizado_em()',
    );
    assert.equal(
      afterDown.rows[0]?.sentinel_organization_function,
      'outro_schema.tche_impedir_alteracao_organizacao_id()',
    );
    assert.equal(
      afterDown.rows[0]?.sentinel_serialization_function,
      'outro_schema.tche_serializar_invariantes_organizacao()',
    );
    assert.equal(
      afterDown.rows[0]?.sentinel_links_function,
      'outro_schema.tche_validar_compatibilidade_identidade_vinculos()',
    );
    assert.equal(afterDown.rows[0]?.sentinel_value, 'sentinela');

    await runMigrations({ command: 'up', database: activeMigrationDatabase });
    migrationApplied = true;
  });
});
