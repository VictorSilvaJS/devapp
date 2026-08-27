import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
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
        await runMigrations({
          command: 'down',
          count: 8,
          database: activeMigrationDatabase,
        });
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

  test('000008 executa up/down/up sem alterar a fundação integrada', async () => {
    const database = requireMigrationDatabase();
    const databasePool = requirePool();

    const installed = await databasePool.query<{
      procedure_name: string | null;
      runtime_event_insert: boolean;
      runtime_delivery_insert: boolean;
      runtime_deduplicated_wrapper: boolean;
      runtime_denied_wrapper: boolean;
      runtime_delivery_operation: boolean;
      runtime_resolution_operation: boolean;
    }>(
      `SELECT pg_catalog.to_regprocedure(
         'public.tche_admin_criar_usuario_mp35b(jsonb)'
       )::text AS procedure_name,
       pg_catalog.has_any_column_privilege(
         'tche_agro_runtime', 'public.notificacao_evento', 'INSERT'
       ) AS runtime_event_insert,
       pg_catalog.has_any_column_privilege(
         'tche_agro_runtime', 'public.notificacao_entrega', 'INSERT'
       ) AS runtime_delivery_insert,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_aud_notificacao_deduplicada_mp35b(jsonb)', 'EXECUTE'
       ) AS runtime_deduplicated_wrapper,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_aud_notificacao_destino_negado_mp35b(jsonb)', 'EXECUTE'
       ) AS runtime_denied_wrapper,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_notificacao_entregar_conta_mp35b(uuid,uuid)', 'EXECUTE'
       ) AS runtime_delivery_operation,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_notificacao_resolver_destino_mp35b(uuid,uuid,text)',
         'EXECUTE'
       ) AS runtime_resolution_operation`,
    );
    assert.deepEqual(installed.rows[0], {
      procedure_name: 'tche_admin_criar_usuario_mp35b(jsonb)',
      runtime_event_insert: false,
      runtime_delivery_insert: false,
      runtime_deduplicated_wrapper: false,
      runtime_denied_wrapper: false,
      runtime_delivery_operation: true,
      runtime_resolution_operation: true,
    });

    await runMigrations({ command: 'down', count: 1, database });
    const rolledBack = await databasePool.query<{
      procedure_name: string | null;
      users_table: string | null;
      runtime_event_insert: boolean;
      runtime_delivery_insert: boolean;
      delivery_operation: string | null;
      resolution_operation: string | null;
    }>(`
      SELECT
        pg_catalog.to_regprocedure(
          'public.tche_admin_criar_usuario_mp35b(jsonb)'
        )::text AS procedure_name,
        pg_catalog.to_regclass('public.usuarios')::text AS users_table,
        pg_catalog.has_any_column_privilege(
          'tche_agro_runtime', 'public.notificacao_evento', 'INSERT'
        ) AS runtime_event_insert,
        pg_catalog.has_any_column_privilege(
          'tche_agro_runtime', 'public.notificacao_entrega', 'INSERT'
        ) AS runtime_delivery_insert,
        pg_catalog.to_regprocedure(
          'public.tche_notificacao_entregar_conta_mp35b(uuid,uuid)'
        )::text AS delivery_operation,
        pg_catalog.to_regprocedure(
          'public.tche_notificacao_resolver_destino_mp35b(uuid,uuid,text)'
        )::text AS resolution_operation
    `);
    assert.deepEqual(rolledBack.rows[0], {
      procedure_name: null,
      users_table: 'usuarios',
      runtime_event_insert: true,
      runtime_delivery_insert: true,
      delivery_operation: null,
      resolution_operation: null,
    });

    await runMigrations({ command: 'up', count: 1, database });
    const reapplied = await databasePool.query<{
      procedure_name: string | null;
      runtime_event_insert: boolean;
      runtime_delivery_insert: boolean;
      runtime_deduplicated_wrapper: boolean;
      runtime_denied_wrapper: boolean;
      runtime_delivery_operation: boolean;
      runtime_resolution_operation: boolean;
    }>(
      `SELECT pg_catalog.to_regprocedure(
         'public.tche_admin_criar_usuario_mp35b(jsonb)'
       )::text AS procedure_name,
       pg_catalog.has_any_column_privilege(
         'tche_agro_runtime', 'public.notificacao_evento', 'INSERT'
       ) AS runtime_event_insert,
       pg_catalog.has_any_column_privilege(
         'tche_agro_runtime', 'public.notificacao_entrega', 'INSERT'
       ) AS runtime_delivery_insert,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_aud_notificacao_deduplicada_mp35b(jsonb)', 'EXECUTE'
       ) AS runtime_deduplicated_wrapper,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_aud_notificacao_destino_negado_mp35b(jsonb)', 'EXECUTE'
       ) AS runtime_denied_wrapper,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_notificacao_entregar_conta_mp35b(uuid,uuid)', 'EXECUTE'
       ) AS runtime_delivery_operation,
       pg_catalog.has_function_privilege(
         'tche_agro_runtime',
         'public.tche_notificacao_resolver_destino_mp35b(uuid,uuid,text)',
         'EXECUTE'
       ) AS runtime_resolution_operation`,
    );
    assert.deepEqual(reapplied.rows[0], installed.rows[0]);
  });

  test('MP-35A instala catálogos versionados e motivos administrativos fechados', async () => {
    const databasePool = requirePool();
    const catalog = await databasePool.query<{
      version_count: number;
      state_count: number;
      municipality_count: number;
      content_hash: string;
    }>(`
      SELECT
        count(DISTINCT catalogo.id)::integer AS version_count,
        count(DISTINCT uf.id)::integer AS state_count,
        count(DISTINCT municipio.id)::integer AS municipality_count,
        max(encode(catalogo.sha256, 'hex')) AS content_hash
      FROM catalogo_localidades_ibge_versoes AS catalogo
      JOIN ufs_ibge AS uf ON uf.versao_id = catalogo.id
      JOIN municipios_ibge AS municipio ON municipio.versao_id = catalogo.id
      WHERE catalogo.status = 'ativo'
    `);
    assert.deepEqual(catalog.rows[0], {
      version_count: 1,
      state_count: 27,
      municipality_count: 5571,
      content_hash: 'c5a20d20a0b9ca9ea0f1a43005beac59a3fc454862c0f25d7bd2b2d1746f6361',
    });

    const reasons = await databasePool.query<{
      codigo: string;
      exige_detalhe: boolean;
    }>(`
      SELECT codigo, exige_detalhe
      FROM motivos_administrativos
      ORDER BY codigo
    `);
    assert.deepEqual(reasons.rows, [
      { codigo: 'cadastro_duplicado', exige_detalhe: false },
      { codigo: 'correcao_administrativa', exige_detalhe: false },
      { codigo: 'fim_relacao', exige_detalhe: false },
      { codigo: 'mudanca_responsabilidade', exige_detalhe: false },
      { codigo: 'outro', exige_detalhe: true },
      { codigo: 'suspensao_operacional', exige_detalhe: false },
    ]);

    await assert.rejects(
      databasePool.query(`
        UPDATE municipios_ibge
        SET nome = 'Nome adulterado'
        WHERE versao_id = 'ibge-localidades-2026-08-25'
          AND id = '4305108'
      `),
      /versao publicada|linha_imutavel/i,
    );
    await assert.rejects(
      databasePool.query(`
        UPDATE catalogo_localidades_ibge_versoes
        SET quantidade_municipios = quantidade_municipios - 1
        WHERE id = 'ibge-localidades-2026-08-25'
      `),
      /aceita apenas substituicao|versao_imutavel/i,
    );

    const lifecycleClient = await databasePool.connect();
    try {
      await lifecycleClient.query('BEGIN');
      const substituted = await lifecycleClient.query<{ status: string }>(`
        UPDATE catalogo_localidades_ibge_versoes
        SET status = 'substituido'
        WHERE id = 'ibge-localidades-2026-08-25'
        RETURNING status
      `);
      assert.equal(substituted.rows[0]?.status, 'substituido');
      await lifecycleClient.query('ROLLBACK');
    } finally {
      lifecycleClient.release();
    }
  });

  test('MP-35A incrementa versao exatamente uma vez em toda mutação administrativa', async () => {
    const databasePool = requirePool();
    const holderUserId = randomUUID();
    const holderId = randomUUID();
    const collaboratorId = randomUUID();
    const propertyId = randomUUID();
    const linkId = randomUUID();
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES
          ($1, $3, 'Titular versão', $4, 'produtor', 'ativo'),
          ($2, $3, 'Colaborador versão', $5, 'colaborador', 'ativo')
      `, [
        holderUserId,
        collaboratorId,
        ORGANIZATION_ID,
        `titular-versao-${holderUserId}@example.test`,
        `colaborador-versao-${collaboratorId}@example.test`,
      ]);
      await client.query(`
        INSERT INTO credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        )
        SELECT $1, usuario_id,
          '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC12ZXJzYW8$aGFzaC12ZXJzYW8tbmFvLXJlYWw',
          'fixture-v1'
        FROM unnest($2::uuid[]) AS usuario_id
      `, [ORGANIZATION_ID, [holderUserId, collaboratorId]]);
      await client.query(`
        INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1, $2, $3, 'Titular versão', 'ativo')
      `, [holderId, ORGANIZATION_ID, holderUserId]);
      await client.query(`
        INSERT INTO propriedades (
          id, organizacao_id, titular_id, nome,
          municipio_id, municipio_nome, uf_id, uf_sigla, status
        ) VALUES ($1, $2, $3, 'Propriedade versão',
          '4305108', 'será derivado', '43', 'RS', 'ativa')
      `, [propertyId, ORGANIZATION_ID, holderId]);
      await client.query(`
        INSERT INTO usuario_propriedade (
          id, organizacao_id, usuario_id, propriedade_id, tipo_vinculo, status
        ) VALUES ($1, $2, $3, $4, 'colaborador', 'ativo')
      `, [linkId, ORGANIZATION_ID, collaboratorId, propertyId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await databasePool.query(
      'UPDATE usuarios SET nome = nome WHERE id = $1',
      [collaboratorId],
    );
    await databasePool.query(
      'UPDATE produtores SET nome = nome WHERE id = $1',
      [holderId],
    );
    await databasePool.query(
      'UPDATE propriedades SET nome = nome WHERE id = $1',
      [propertyId],
    );
    await databasePool.query(
      'UPDATE usuario_propriedade SET tipo_vinculo = tipo_vinculo WHERE id = $1',
      [linkId],
    );
    const versions = await databasePool.query<{
      user_version: string;
      producer_version: string;
      property_version: string;
      link_version: string;
    }>(`
      SELECT
        (SELECT versao::text FROM usuarios WHERE id = $1) AS user_version,
        (SELECT versao::text FROM produtores WHERE id = $2) AS producer_version,
        (SELECT versao::text FROM propriedades WHERE id = $3) AS property_version,
        (SELECT versao::text FROM usuario_propriedade WHERE id = $4) AS link_version
    `, [collaboratorId, holderId, propertyId, linkId]);
    assert.deepEqual(versions.rows[0], {
      user_version: '2',
      producer_version: '2',
      property_version: '2',
      link_version: '2',
    });
    await assert.rejects(
      databasePool.query(
        'UPDATE usuarios SET versao = versao + 2 WHERE id = $1',
        [collaboratorId],
      ),
      /versao administrativa|incremento_unitario/i,
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
        ) VALUES ($1, $2, $3, 'Propriedade ordem inversa', '4314902', 'Nome não confiável', '43', 'XX')
      `, [propertyId, ORGANIZATION_ID, producerId]);
      await client.query(`
        INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1, $2, $3, 'Produtor ordem inversa', 'ativo')
      `, [producerId, ORGANIZATION_ID, userId]);
      await client.query(`
        INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES ($1, $2, 'Usuário ordem inversa', $3, 'produtor', 'ativo')
      `, [userId, ORGANIZATION_ID, `ordem-${userId}@example.test`]);
      await client.query(`
        INSERT INTO credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        ) VALUES ($1, $2,
          '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1vcmRlbQ$aGFzaC1vcmRlbS1uYW8tcmVhbA',
          'fixture-v1')
      `, [ORGANIZATION_ID, userId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const persisted = await requirePool().query(
      `SELECT titular_id, municipio_nome, uf_sigla, localidades_versao_id,
              versao
       FROM propriedades WHERE id = $1`,
      [propertyId],
    );
    assert.equal(persisted.rows[0]?.titular_id, producerId);
    assert.equal(persisted.rows[0]?.municipio_nome, 'Porto Alegre');
    assert.equal(persisted.rows[0]?.uf_sigla, 'RS');
    assert.equal(
      persisted.rows[0]?.localidades_versao_id,
      'ibge-localidades-2026-08-25',
    );
    assert.equal(persisted.rows[0]?.versao, '1');
  });

  test('titular_id é a única titularidade e Propriedade ativa exige Titular habilitado', async () => {
    const databasePool = requirePool();
    const owner = await databasePool.query<{ user_id: string; property_id: string }>(`
      SELECT produtor.usuario_id AS user_id, propriedade.id AS property_id
      FROM propriedades AS propriedade
      JOIN produtores AS produtor ON produtor.id = propriedade.titular_id
      LIMIT 1
    `);
    const row = owner.rows[0];
    assert.ok(row);

    await assert.rejects(
      databasePool.query(
        "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
        [row.user_id],
      ),
      /estado cadastral|status do Usuario|Titular habilitado|status_compativel/i,
    );

    const stateClient = await databasePool.connect();
    try {
      await stateClient.query('BEGIN');
      await stateClient.query(
        "UPDATE propriedades SET status = 'inativa' WHERE id = $1",
        [row.property_id],
      );
      await stateClient.query(`
        UPDATE produtores
        SET status = 'inativo'
        WHERE usuario_id = $1
      `, [row.user_id]);
      await stateClient.query(
        "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
        [row.user_id],
      );
      await stateClient.query('COMMIT');
    } catch (error) {
      await stateClient.query('ROLLBACK');
      throw error;
    } finally {
      stateClient.release();
    }
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

    const restoreClient = await databasePool.connect();
    try {
      await restoreClient.query('BEGIN');
      await restoreClient.query(
        "UPDATE usuarios SET status = 'ativo' WHERE id = $1",
        [row.user_id],
      );
      await restoreClient.query(
        "UPDATE produtores SET status = 'ativo' WHERE usuario_id = $1",
        [row.user_id],
      );
      await restoreClient.query(
        "UPDATE propriedades SET status = 'ativa' WHERE id = $1",
        [row.property_id],
      );
      await restoreClient.query('COMMIT');
    } catch (error) {
      await restoreClient.query('ROLLBACK');
      throw error;
    } finally {
      restoreClient.release();
    }
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
    const inactive = await databasePool.query<{
      motivo_inativacao_codigo: string;
      motivo_inativacao_detalhe: string;
    }>(
      `SELECT motivo_inativacao_codigo, motivo_inativacao_detalhe
       FROM usuario_propriedade
       WHERE usuario_id = $1 AND status = 'inativo'
       ORDER BY criado_em`,
      [userId],
    );
    assert.deepEqual(inactive.rows, [
      {
        motivo_inativacao_codigo: 'outro',
        motivo_inativacao_detalhe: 'Substituição de teste',
      },
      {
        motivo_inativacao_codigo: 'outro',
        motivo_inativacao_detalhe: 'Histórico adicional',
      },
    ]);
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

  test('MP-33B persiste somente hashes e impede dois tokens ativos da mesma classe', async () => {
    const databasePool = requirePool();
    const userId = randomUUID();
    const sessionId = randomUUID();

    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Sessão MP-33B', $3, 'colaborador', 'ativo')
    `, [userId, ORGANIZATION_ID, `sessao-${userId}@example.test`]);
    await databasePool.query(`
      INSERT INTO credenciais_usuario (
        organizacao_id, usuario_id, senha_phc, versao_politica_senha
      ) VALUES ($1, $2, $3, 'senha-v1')
    `, [
      ORGANIZATION_ID,
      userId,
      '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1kZS10ZXN0ZQ$aGFzaC1kZS10ZXN0ZS1uYW8tcmVhbA',
    ]);
    await databasePool.query(`
      INSERT INTO sessoes_autenticacao (
        id, organizacao_id, usuario_id, versao_autorizacao, rotulo_cliente,
        expira_inatividade_em, expira_absolutamente_em
      ) VALUES (
        $1, $2, $3, 1, 'Android de teste',
        clock_timestamp() + interval '14 days',
        clock_timestamp() + interval '30 days'
      )
    `, [sessionId, ORGANIZATION_ID, userId]);
    await databasePool.query(`
      INSERT INTO tokens_acesso (
        organizacao_id, sessao_id, token_hash, versao_autorizacao, expira_em
      ) VALUES ($1, $2, $3, 1, clock_timestamp() + interval '15 minutes')
    `, [ORGANIZATION_ID, sessionId, Buffer.alloc(32, 1)]);
    await databasePool.query(`
      INSERT INTO tokens_refresh (
        organizacao_id, sessao_id, token_hash, expira_em
      ) VALUES ($1, $2, $3, clock_timestamp() + interval '30 days')
    `, [ORGANIZATION_ID, sessionId, Buffer.alloc(32, 2)]);

    await assert.rejects(
      databasePool.query(`
        INSERT INTO tokens_refresh (
          organizacao_id, sessao_id, token_hash, expira_em
        ) VALUES ($1, $2, $3, clock_timestamp() + interval '30 days')
      `, [ORGANIZATION_ID, sessionId, Buffer.alloc(32, 3)]),
      /ux_tokens_refresh_ativo_por_sessao|duplicate key/i,
    );
    await assert.rejects(
      databasePool.query(`
        INSERT INTO desafios_autenticacao (
          organizacao_id, usuario_id, finalidade, token_hash, expira_em
        ) VALUES ($1, $2, 'recuperacao_senha', $3, clock_timestamp() + interval '30 minutes')
      `, [ORGANIZATION_ID, userId, Buffer.alloc(31, 4)]),
      /ck_desafios_autenticacao_hash_sha256|check constraint/i,
    );
  });

  test('convite novo ativa conta e compatibilidade manter_status não pode ser emitida novamente', async () => {
    const databasePool = requirePool();
    const adminId = randomUUID();
    const pendingId = randomUUID();
    const collaboratorId = randomUUID();
    const invitationChallengeId = randomUUID();
    const invitationId = randomUUID();
    const activatedProducerUserId = randomUUID();
    const activatedProducerId = randomUUID();
    const activationChallengeId = randomUUID();
    const activationInvitationId = randomUUID();

    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES
        ($1, $4, 'Admin recuperação', $5, 'admin', 'ativo'),
        ($2, $4, 'Pendente convite', $6, 'colaborador', 'pendente'),
        ($3, $4, 'Colaborador recuperação', $7, 'colaborador', 'ativo')
    `, [
      adminId,
      pendingId,
      collaboratorId,
      ORGANIZATION_ID,
      `admin-${adminId}@example.test`,
      `pendente-${pendingId}@example.test`,
      `colaborador-${collaboratorId}@example.test`,
    ]);
    await databasePool.query(`
      INSERT INTO credenciais_usuario (
        organizacao_id, usuario_id, senha_phc, versao_politica_senha
      ) VALUES ($1, $2,
        '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1hZG1pbg$aGFzaC1hZG1pbi1uYW8tcmVhbA',
        'fixture-v1')
    `, [ORGANIZATION_ID, adminId]);
    await databasePool.query(`
      INSERT INTO desafios_autenticacao (
        id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
      ) VALUES ($1, $2, $3, 'convite', $4, clock_timestamp() + interval '72 hours')
    `, [invitationChallengeId, ORGANIZATION_ID, pendingId, Buffer.alloc(32, 10)]);
    await assert.rejects(
      databasePool.query(`
        INSERT INTO convites_usuario (
          id, organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
          criado_por_usuario_id, expira_em
        ) VALUES ($1, $2, $3, $4, 'admin', 'manter_status', $5,
          clock_timestamp() + interval '72 hours')
      `, [invitationId, ORGANIZATION_ID, pendingId, invitationChallengeId, adminId]),
      /convites_usuario_modo_historico|devem ativar o Usuario/i,
    );
    const stillPending = await databasePool.query<{ status: string }>(
      'SELECT status FROM usuarios WHERE id = $1',
      [pendingId],
    );
    assert.equal(stillPending.rows[0]?.status, 'pendente');

    const runtimeClient = await databasePool.connect();
    try {
      await runtimeClient.query('BEGIN');
      await runtimeClient.query('SET LOCAL ROLE tche_agro_runtime');
      await assert.rejects(
        runtimeClient.query(
          "UPDATE usuarios SET status = 'ativo' WHERE id = $1",
          [pendingId],
        ),
        /permission denied/i,
      );
      await runtimeClient.query('ROLLBACK');
    } finally {
      runtimeClient.release();
    }

    const inactiveIssuerId = randomUUID();
    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Admin emissor inativo', $3, 'admin', 'inativo')
    `, [
      inactiveIssuerId,
      ORGANIZATION_ID,
      `admin-inativo-${inactiveIssuerId}@example.test`,
    ]);
    await assert.rejects(
      databasePool.query(`
        INSERT INTO convites_usuario (
          organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
          criado_por_usuario_id, expira_em
        ) VALUES ($1, $2, $3, 'admin', 'ativar_usuario', $4,
          clock_timestamp() + interval '72 hours')
      `, [ORGANIZATION_ID, pendingId, invitationChallengeId, inactiveIssuerId]),
      /emissor Administrador ativo|emissor_admin_ativo/i,
    );

    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES ($1, $2, 'Produtor ativado por convite', $3, 'produtor', 'pendente')
    `, [
      activatedProducerUserId,
      ORGANIZATION_ID,
      `produtor-convite-${activatedProducerUserId}@example.test`,
    ]);
    await databasePool.query(`
      INSERT INTO produtores (id, organizacao_id, usuario_id, nome, status)
      VALUES ($1, $2, $3, 'Produtor ativado por convite', 'inativo')
    `, [activatedProducerId, ORGANIZATION_ID, activatedProducerUserId]);
    await databasePool.query(`
      INSERT INTO desafios_autenticacao (
        id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
      ) VALUES ($1, $2, $3, 'convite', $4, clock_timestamp() + interval '72 hours')
    `, [
      activationChallengeId,
      ORGANIZATION_ID,
      activatedProducerUserId,
      Buffer.alloc(32, 15),
    ]);
    await databasePool.query(`
      INSERT INTO convites_usuario (
        id, organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
        criado_por_usuario_id, expira_em
      ) VALUES ($1, $2, $3, $4, 'admin', 'ativar_usuario', $5,
        clock_timestamp() + interval '72 hours')
    `, [
      activationInvitationId,
      ORGANIZATION_ID,
      activatedProducerUserId,
      activationChallengeId,
      adminId,
    ]);

    const activationClient = await databasePool.connect();
    try {
      await activationClient.query('BEGIN');
      await activationClient.query(`
        INSERT INTO credenciais_usuario (
          organizacao_id, usuario_id, senha_phc, versao_politica_senha
        ) VALUES ($1, $2, $3, 'senha-v1')
      `, [
        ORGANIZATION_ID,
        activatedProducerUserId,
        '$argon2id$v=19$m=19456,t=2,p=1$c2FsdC1tcDM1YQ$aGFzaC1tcDM1YS1uYW8tcmVhbA',
      ]);
      await activationClient.query(
        "UPDATE usuarios SET status = 'ativo' WHERE id = $1",
        [activatedProducerUserId],
      );
      await activationClient.query(
        "UPDATE produtores SET status = 'ativo' WHERE id = $1",
        [activatedProducerId],
      );
      await activationClient.query(`
        UPDATE desafios_autenticacao
        SET status = 'consumido', consumido_em = clock_timestamp()
        WHERE id = $1
      `, [activationChallengeId]);
      await activationClient.query(`
        UPDATE convites_usuario
        SET status = 'aceito', aceito_em = clock_timestamp()
        WHERE id = $1
      `, [activationInvitationId]);
      await activationClient.query('COMMIT');
    } finally {
      activationClient.release();
    }
    const activatedWithoutProperty = await databasePool.query<{
      user_status: string;
      producer_status: string;
      property_count: number;
      user_version: string;
      producer_version: string;
    }>(`
      SELECT usuario.status AS user_status,
             produtor.status AS producer_status,
        count(propriedade.id)::integer AS property_count,
        usuario.versao::text AS user_version,
        produtor.versao::text AS producer_version
      FROM usuarios AS usuario
      JOIN produtores AS produtor
        ON produtor.organizacao_id = usuario.organizacao_id
       AND produtor.usuario_id = usuario.id
      LEFT JOIN propriedades AS propriedade
        ON propriedade.organizacao_id = produtor.organizacao_id
       AND propriedade.titular_id = produtor.id
      WHERE usuario.id = $1
      GROUP BY usuario.status, produtor.status, usuario.versao, produtor.versao
    `, [activatedProducerUserId]);
    assert.deepEqual(activatedWithoutProperty.rows[0], {
      user_status: 'ativo',
      producer_status: 'ativo',
      property_count: 0,
      user_version: '2',
      producer_version: '2',
    });

    const cleanupActivationClient = await databasePool.connect();
    try {
      await cleanupActivationClient.query('BEGIN');
      await cleanupActivationClient.query(
        'DELETE FROM convites_usuario WHERE id = $1',
        [activationInvitationId],
      );
      await cleanupActivationClient.query(
        'DELETE FROM desafios_autenticacao WHERE id = $1',
        [activationChallengeId],
      );
      await cleanupActivationClient.query(
        'DELETE FROM credenciais_usuario WHERE usuario_id = $1',
        [activatedProducerUserId],
      );
      await cleanupActivationClient.query(
        'DELETE FROM produtores WHERE id = $1',
        [activatedProducerId],
      );
      await cleanupActivationClient.query(
        'DELETE FROM usuarios WHERE id = $1',
        [activatedProducerUserId],
      );
      await cleanupActivationClient.query('COMMIT');
    } finally {
      cleanupActivationClient.release();
    }

    const adminRecoveryId = randomUUID();
    await assert.rejects(
      databasePool.query(`
        INSERT INTO recuperacoes_assistidas (
          id, organizacao_id, usuario_id, perfil_alvo, origem,
          solicitada_por_usuario_id, novo_email, categoria_motivo,
          referencia_externa, expira_em
        ) VALUES (
          $1, $2, $3, 'colaborador', 'admin_http', $3, $4,
          'lost_email_access', 'CASE-ADMIN-TEST',
          clock_timestamp() + interval '30 minutes'
        )
      `, [
        adminRecoveryId,
        ORGANIZATION_ID,
        adminId,
        `novo-admin-${adminId}@example.test`,
      ]),
      /admin_somente_plataforma|perfil_alvo|Conta Administradora/i,
    );

    const recoveryId = randomUUID();
    const recoveryChallengeId = randomUUID();
    const recoveryClient = await databasePool.connect();
    try {
      await recoveryClient.query('BEGIN');
      await recoveryClient.query(`
        INSERT INTO desafios_autenticacao (
          id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
        ) VALUES ($1, $2, $3, 'recuperacao_assistida', $4,
          clock_timestamp() + interval '30 minutes')
      `, [recoveryChallengeId, ORGANIZATION_ID, collaboratorId, Buffer.alloc(32, 11)]);
      await recoveryClient.query(`
        INSERT INTO recuperacoes_assistidas (
          id, organizacao_id, usuario_id, perfil_alvo, origem,
          solicitada_por_usuario_id, novo_email, categoria_motivo, status,
          referencia_externa, desafio_email_id, expira_em
        ) VALUES (
          $1, $2, $3, 'colaborador', 'admin_http', $4, $5,
          'lost_email_access', 'aguardando_confirmacao_email',
          'CASE-COLAB-TEST', $6,
          clock_timestamp() + interval '30 minutes'
        )
      `, [
        recoveryId,
        ORGANIZATION_ID,
        collaboratorId,
        adminId,
        `novo-colaborador-${collaboratorId}@example.test`,
        recoveryChallengeId,
      ]);
      await recoveryClient.query(`
        INSERT INTO aprovacoes_recuperacao_assistida (
          organizacao_id, recuperacao_id, administrador_id, categoria_decisao
        ) VALUES ($1, $2, $3, 'single_admin_risk_accepted')
      `, [ORGANIZATION_ID, recoveryId, adminId]);
      await recoveryClient.query('COMMIT');
    } finally {
      recoveryClient.release();
    }

    await assert.rejects(
      databasePool.query(
        "UPDATE usuarios SET perfil = 'produtor' WHERE id = $1",
        [collaboratorId],
      ),
      /perfil_alvo_atual|perfil atual do alvo/i,
    );
    await assert.rejects(
      databasePool.query(
        "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
        [adminId],
      ),
      /solicitante_admin_ativo|solicitante administrador ativo|aprovacao exige administrador ativo/i,
    );
    await assert.rejects(
      databasePool.query(
        'UPDATE desafios_autenticacao SET usuario_id = $2 WHERE id = $1',
        [recoveryChallengeId, adminId],
      ),
      /desafio_compativel|mesmo usuario e finalidade/i,
    );

    const recoveryAuthorizationId = randomUUID();
    const authorizationClient = await databasePool.connect();
    try {
      await authorizationClient.query('BEGIN');
      await authorizationClient.query(`
        UPDATE recuperacoes_assistidas
        SET status = 'aguardando_nova_senha', autorizacao_restrita_id = $2
        WHERE id = $1
      `, [recoveryId, recoveryAuthorizationId]);
      await authorizationClient.query(`
        INSERT INTO autorizacoes_restritas (
          id, organizacao_id, usuario_id, finalidade, origem_tipo,
          origem_id, token_hash, expira_em
        ) VALUES (
          $1, $2, $3, 'concluir_recuperacao_assistida',
          'recuperacao_assistida', $4, $5,
          clock_timestamp() + interval '15 minutes'
        )
      `, [
        recoveryAuthorizationId,
        ORGANIZATION_ID,
        collaboratorId,
        recoveryId,
        Buffer.alloc(32, 14),
      ]);
      await authorizationClient.query(`
        UPDATE desafios_autenticacao
        SET status = 'consumido', consumido_em = clock_timestamp()
        WHERE id = $1
      `, [recoveryChallengeId]);
      await authorizationClient.query('COMMIT');
    } finally {
      authorizationClient.release();
    }

    await assert.rejects(
      databasePool.query(
        'UPDATE autorizacoes_restritas SET origem_id = $2 WHERE id = $1',
        [recoveryAuthorizationId, randomUUID()],
      ),
      /autorizacao_compativel|mesmo usuario e caso/i,
    );

    const invalidCompletionClient = await databasePool.connect();
    try {
      await invalidCompletionClient.query('BEGIN');
      await invalidCompletionClient.query(`
        UPDATE recuperacoes_assistidas
        SET status = 'concluida', concluida_em = clock_timestamp()
        WHERE id = $1
      `, [recoveryId]);
      await invalidCompletionClient.query(`
        UPDATE autorizacoes_restritas
        SET status = 'consumida', consumida_em = clock_timestamp()
        WHERE id = $1
      `, [recoveryAuthorizationId]);
      await invalidCompletionClient.query(
        "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
        [adminId],
      );
      await assert.rejects(
        invalidCompletionClient.query('COMMIT'),
        /conclusao_participantes|conclusao_aprovada|alvo e solicitante|estado final/i,
      );
      await invalidCompletionClient.query('ROLLBACK');
    } finally {
      invalidCompletionClient.release();
    }

    const completionClient = await databasePool.connect();
    try {
      await completionClient.query('BEGIN');
      await completionClient.query(`
        UPDATE recuperacoes_assistidas
        SET status = 'concluida', concluida_em = clock_timestamp()
        WHERE id = $1
      `, [recoveryId]);
      await completionClient.query(`
        UPDATE autorizacoes_restritas
        SET status = 'consumida', consumida_em = clock_timestamp()
        WHERE id = $1
      `, [recoveryAuthorizationId]);
      await completionClient.query('COMMIT');
    } finally {
      completionClient.release();
    }

    await databasePool.query(
      "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
      [adminId],
    );
    await databasePool.query(
      "UPDATE usuarios SET status = 'ativo' WHERE id = $1",
      [adminId],
    );

    const secondaryContactId = randomUUID();
    const secondaryChallengeId = randomUUID();
    const newEmailChallengeId = randomUUID();
    const adminSecondaryRecoveryId = randomUUID();
    await databasePool.query(`
      INSERT INTO contatos_email_usuario (
        id, organizacao_id, usuario_id, email, status, verificado_em
      ) VALUES ($1, $2, $3, $4, 'verificado', clock_timestamp())
    `, [
      secondaryContactId,
      ORGANIZATION_ID,
      adminId,
      `secundario-${adminId}@example.test`,
    ]);
    await databasePool.query(`
      INSERT INTO desafios_autenticacao (
        id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
      ) VALUES (
        $1, $2, $3, 'recuperacao_admin_secundario', $4,
        clock_timestamp() + interval '30 minutes'
      )
    `, [secondaryChallengeId, ORGANIZATION_ID, adminId, Buffer.alloc(32, 12)]);
    await databasePool.query(`
      INSERT INTO recuperacoes_admin_email_secundario (
        id, organizacao_id, usuario_admin_id, contato_secundario_id,
        novo_email, desafio_secundario_id, expira_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        clock_timestamp() + interval '30 minutes'
      )
    `, [
      adminSecondaryRecoveryId,
      ORGANIZATION_ID,
      adminId,
      secondaryContactId,
      `novo-principal-${adminId}@example.test`,
      secondaryChallengeId,
    ]);

    const secondaryRecoveryClient = await databasePool.connect();
    try {
      await secondaryRecoveryClient.query('BEGIN');
      await secondaryRecoveryClient.query(`
        UPDATE desafios_autenticacao
        SET status = 'consumido', consumido_em = clock_timestamp()
        WHERE id = $1
      `, [secondaryChallengeId]);
      await secondaryRecoveryClient.query(`
        INSERT INTO desafios_autenticacao (
          id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
        ) VALUES (
          $1, $2, $3, 'recuperacao_admin_email_novo', $4,
          clock_timestamp() + interval '30 minutes'
        )
      `, [newEmailChallengeId, ORGANIZATION_ID, adminId, Buffer.alloc(32, 13)]);
      await secondaryRecoveryClient.query(`
        UPDATE recuperacoes_admin_email_secundario
        SET status = 'aguardando_confirmacao_email_novo',
            desafio_email_novo_id = $2
        WHERE id = $1
      `, [adminSecondaryRecoveryId, newEmailChallengeId]);
      await secondaryRecoveryClient.query('COMMIT');
    } finally {
      secondaryRecoveryClient.release();
    }

    const adminChallenges = await databasePool.query<{
      finalidade: string;
      token_hash: Buffer;
    }>(`
      SELECT finalidade, token_hash
      FROM desafios_autenticacao
      WHERE id IN ($1, $2)
      ORDER BY finalidade
    `, [secondaryChallengeId, newEmailChallengeId]);
    assert.deepEqual(
      adminChallenges.rows.map((row) => row.finalidade),
      ['recuperacao_admin_email_novo', 'recuperacao_admin_secundario'],
    );
    assert.notDeepEqual(
      adminChallenges.rows[0]?.token_hash,
      adminChallenges.rows[1]?.token_hash,
    );
  });

  test('MP-35A persiste a reserva idempotente por 90 dias e exige recibo concluído', async () => {
    const databasePool = requirePool();
    const actor = await databasePool.query<{ id: string }>(`
      SELECT id FROM usuarios
      WHERE perfil = 'admin' AND status = 'ativo'
      ORDER BY criado_em
      LIMIT 1
    `);
    const actorId = actor.rows[0]?.id;
    assert.ok(actorId);
    const commandId = randomUUID();
    const sessionId = randomUUID();
    const keyHash = Buffer.alloc(32, 21);
    const requestHash = Buffer.alloc(32, 22);

    await databasePool.query(`
      INSERT INTO sessoes_autenticacao (
        id, organizacao_id, usuario_id, versao_autorizacao,
        expira_inatividade_em, expira_absolutamente_em
      ) VALUES ($1, $2, $3, 1,
        clock_timestamp() + interval '1 day',
        clock_timestamp() + interval '2 days')
    `, [sessionId, ORGANIZATION_ID, actorId]);

    await databasePool.query(`
      WITH instante AS (SELECT clock_timestamp() AS valor)
      INSERT INTO comandos_administrativos_idempotencia (
        id, organizacao_id, ator_usuario_id, sessao_id,
        request_id, correlation_id, chave_idempotencia_hash,
        comando, hash_requisicao, criado_em, expira_em
      )
      SELECT $1, $2, $3, $4, 'request-mp35a-1', 'correlation-mp35a-1',
             $5, 'usuario.criar', $6,
             instante.valor, instante.valor + interval '90 days'
      FROM instante
    `, [commandId, ORGANIZATION_ID, actorId, sessionId, keyHash, requestHash]);

    await assert.rejects(
      databasePool.query(`
        WITH instante AS (SELECT clock_timestamp() AS valor)
        INSERT INTO comandos_administrativos_idempotencia (
          organizacao_id, ator_usuario_id, sessao_id,
          request_id, correlation_id, chave_idempotencia_hash,
          comando, hash_requisicao, criado_em, expira_em
        )
        SELECT $1, $2, $3, 'request-mp35a-2', 'correlation-mp35a-1',
               $4, 'usuario.atualizar', $5,
               instante.valor, instante.valor + interval '90 days'
        FROM instante
      `, [
        ORGANIZATION_ID,
        actorId,
        sessionId,
        keyHash,
        Buffer.alloc(32, 23),
      ]),
      /uq_comandos_administrativos_chave|duplicate key/i,
    );
    await assert.rejects(
      databasePool.query(`
        UPDATE comandos_administrativos_idempotencia
        SET status = 'concluido', codigo_http = 201,
            concluido_em = clock_timestamp()
        WHERE id = $1
      `, [commandId]),
      /ck_comandos_administrativos_ciclo_vida|check constraint/i,
    );
    await assert.rejects(
      databasePool.query(`
        UPDATE comandos_administrativos_idempotencia
        SET status = 'concluido', codigo_http = 201,
            recibo = jsonb_build_object(
              'outcome', 'criado',
              'resourceType', 'propriedade',
              'resourceId', $2::text,
              'password', 'segredo'
            ),
            concluido_em = clock_timestamp()
        WHERE id = $1
      `, [commandId, randomUUID()]),
      /ck_comandos_administrativos_recibo|check constraint/i,
    );

    const completed = await databasePool.query<{
      status: string;
      codigo_http: number;
      exact_retention: boolean;
    }>(`
      UPDATE comandos_administrativos_idempotencia
      SET status = 'concluido', codigo_http = 201,
          recibo = jsonb_build_object(
            'outcome', 'criado',
            'resourceType', 'usuario',
            'resourceId', $2::text,
            'version', 1
          ),
          concluido_em = clock_timestamp()
      WHERE id = $1
      RETURNING status, codigo_http,
                expira_em = criado_em + interval '90 days' AS exact_retention
    `, [commandId, randomUUID()]);
    assert.deepEqual(completed.rows[0], {
      status: 'concluido',
      codigo_http: 201,
      exact_retention: true,
    });
  });

  test('papéis runtime/worker são mínimos e auditoria é append-only', async () => {
    const databasePool = requirePool();
    const actorUserId = randomUUID();
    const affectedUserId = randomUUID();
    const actorSessionId = randomUUID();
    const affectedSessionId = randomUUID();
    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES
        ($1, $3, 'Ator da auditoria', $4, 'admin', 'ativo'),
        ($2, $3, 'Usuário afetado', $5, 'produtor', 'ativo')
    `, [
      actorUserId,
      affectedUserId,
      ORGANIZATION_ID,
      `audit-actor-${actorUserId}@example.test`,
      `audit-affected-${affectedUserId}@example.test`,
    ]);
    await databasePool.query(`
      INSERT INTO sessoes_autenticacao (
        id, organizacao_id, usuario_id, versao_autorizacao,
        expira_inatividade_em, expira_absolutamente_em
      ) VALUES
        (
          $1, $3, $4, 1,
          clock_timestamp() + interval '1 day',
          clock_timestamp() + interval '2 days'
        ),
        (
          $2, $3, $5, 1,
          clock_timestamp() + interval '1 day',
          clock_timestamp() + interval '2 days'
        )
    `, [
      actorSessionId,
      affectedSessionId,
      ORGANIZATION_ID,
      actorUserId,
      affectedUserId,
    ]);

    const auditId = randomUUID();
    await databasePool.query(`
      INSERT INTO eventos_auditoria (
        id, organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
        sessao_id, usuario_afetado_id, metadados
      ) VALUES (
        $1, $2, 'auth.teste.integracao', 'sucesso', 'usuario', $3,
        $4, $5, '{}'
      )
    `, [auditId, ORGANIZATION_ID, actorUserId, actorSessionId, affectedUserId]);
    const persistedAudit = await databasePool.query<{
      ator_usuario_id: string;
      sessao_id: string;
      usuario_afetado_id: string;
    }>(`
      SELECT ator_usuario_id, sessao_id, usuario_afetado_id
      FROM eventos_auditoria
      WHERE id = $1
    `, [auditId]);
    assert.deepEqual(persistedAudit.rows[0], {
      ator_usuario_id: actorUserId,
      sessao_id: actorSessionId,
      usuario_afetado_id: affectedUserId,
    });
    await assert.rejects(
      databasePool.query(`
        INSERT INTO eventos_auditoria (
          organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
          sessao_id, metadados
        ) VALUES ($1, 'auth.teste.sessao_de_outro_usuario', 'falha',
          'usuario', $2, $3, '{}')
      `, [ORGANIZATION_ID, actorUserId, affectedSessionId]),
      /fk_eventos_auditoria_sessao_do_ator|foreign key/i,
    );
    await assert.rejects(
      databasePool.query(`
        INSERT INTO eventos_auditoria (
          organizacao_id, evento, resultado, ator_tipo, sessao_id, metadados
        ) VALUES ($1, 'auth.teste.sistema_com_sessao', 'falha',
          'sistema', $2, '{}')
      `, [ORGANIZATION_ID, actorSessionId]),
      /ck_eventos_auditoria_ator|check constraint/i,
    );
    await assert.rejects(
      databasePool.query(`
        INSERT INTO eventos_auditoria (
          organizacao_id, evento, resultado, ator_tipo,
          usuario_afetado_id, metadados
        ) VALUES ($1, 'auth.teste.usuario_invalido', 'falha', 'sistema', $2, '{}')
      `, [ORGANIZATION_ID, randomUUID()]),
      /fk_eventos_auditoria_usuario_afetado_mesma_organizacao|foreign key/i,
    );
    await assert.rejects(
      databasePool.query(
        "UPDATE eventos_auditoria SET resultado = 'falha' WHERE id = $1",
        [auditId],
      ),
      /append-only/i,
    );

    const roleAttributes = await databasePool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
             rolinherit, rolreplication, rolbypassrls
      FROM pg_roles
      WHERE rolname IN (
        'tche_agro_runtime',
        'tche_agro_outbox_worker',
        'tche_agro_platform_ops',
        'tche_agro_administration_maintenance',
        'tche_agro_administration_owner'
      )
      ORDER BY rolname
    `);
    assert.equal(roleAttributes.rowCount, 5);
    for (const role of roleAttributes.rows) {
      assert.deepEqual(
        {
          canLogin: role.rolcanlogin,
          superuser: role.rolsuper,
          createDatabase: role.rolcreatedb,
          createRole: role.rolcreaterole,
          inherit: role.rolinherit,
          replication: role.rolreplication,
          bypassRls: role.rolbypassrls,
        },
        {
          canLogin: false,
          superuser: false,
          createDatabase: false,
          createRole: false,
          inherit: false,
          replication: false,
          bypassRls: false,
        },
        role.rolname,
      );
    }

    const privilegeContract = await databasePool.query<{
      runtime_insert_origin: boolean;
      runtime_insert_platform_authorization: boolean;
      runtime_insert_platform_approvers: boolean;
      runtime_insert_users: boolean;
      runtime_insert_users_table: boolean;
      runtime_insert_user_status: boolean;
      runtime_update_user_profile: boolean;
      runtime_delete_users: boolean;
      runtime_insert_producers: boolean;
      runtime_update_producer_status: boolean;
      runtime_delete_producers: boolean;
      runtime_select_administrative_commands: boolean;
      runtime_update_administrative_actor: boolean;
      runtime_delete_administrative_commands: boolean;
      runtime_update_bootstrap_status: boolean;
      runtime_update_bootstrap_admin: boolean;
      runtime_insert_audit: boolean;
      runtime_insert_any_audit_column: boolean;
      platform_insert_users: boolean;
      platform_update_user_email: boolean;
      platform_update_user_status: boolean;
      platform_select_credentials: boolean;
      platform_update_credentials: boolean;
      platform_select_sessions: boolean;
      platform_update_sessions: boolean;
      platform_select_access_tokens: boolean;
      platform_select_refresh_tokens: boolean;
      platform_insert_authorization: boolean;
      platform_update_authorization: boolean;
      platform_insert_recovery: boolean;
      platform_update_recovery: boolean;
      platform_select_challenge_hash: boolean;
      platform_select_outbox_payload: boolean;
      platform_select_properties: boolean;
      platform_select_audit: boolean;
      platform_insert_audit: boolean;
      worker_update_nonce: boolean;
    }>(`
      SELECT
        has_column_privilege(
          'tche_agro_runtime', 'public.recuperacoes_assistidas',
          'origem', 'INSERT'
        ) AS runtime_insert_origin,
        has_column_privilege(
          'tche_agro_runtime', 'public.recuperacoes_assistidas',
          'autorizacao_plataforma_id', 'INSERT'
        ) AS runtime_insert_platform_authorization,
        has_column_privilege(
          'tche_agro_runtime', 'public.recuperacoes_assistidas',
          'aprovadores_plataforma', 'INSERT'
        ) AS runtime_insert_platform_approvers,
        has_any_column_privilege(
          'tche_agro_runtime', 'public.usuarios', 'INSERT'
        ) AS runtime_insert_users,
        has_table_privilege(
          'tche_agro_runtime', 'public.usuarios', 'INSERT'
        ) AS runtime_insert_users_table,
        has_column_privilege(
          'tche_agro_runtime', 'public.usuarios', 'status', 'INSERT'
        ) AS runtime_insert_user_status,
        has_column_privilege(
          'tche_agro_runtime', 'public.usuarios', 'perfil', 'UPDATE'
        ) AS runtime_update_user_profile,
        has_table_privilege(
          'tche_agro_runtime', 'public.usuarios', 'DELETE'
        ) AS runtime_delete_users,
        has_any_column_privilege(
          'tche_agro_runtime', 'public.produtores', 'INSERT'
        ) AS runtime_insert_producers,
        has_column_privilege(
          'tche_agro_runtime', 'public.produtores', 'status', 'UPDATE'
        ) AS runtime_update_producer_status,
        has_table_privilege(
          'tche_agro_runtime', 'public.produtores', 'DELETE'
        ) AS runtime_delete_producers,
        has_table_privilege(
          'tche_agro_runtime',
          'public.comandos_administrativos_idempotencia', 'SELECT'
        ) AS runtime_select_administrative_commands,
        has_column_privilege(
          'tche_agro_runtime',
          'public.comandos_administrativos_idempotencia',
          'ator_usuario_id', 'UPDATE'
        ) AS runtime_update_administrative_actor,
        has_table_privilege(
          'tche_agro_runtime',
          'public.comandos_administrativos_idempotencia', 'DELETE'
        ) AS runtime_delete_administrative_commands,
        has_column_privilege(
          'tche_agro_runtime', 'public.bootstrap_autenticacao',
          'status', 'UPDATE'
        ) AS runtime_update_bootstrap_status,
        has_column_privilege(
          'tche_agro_runtime', 'public.bootstrap_autenticacao',
          'usuario_admin_id', 'UPDATE'
        ) AS runtime_update_bootstrap_admin,
        has_table_privilege(
          'tche_agro_runtime', 'public.eventos_auditoria', 'INSERT'
        ) AS runtime_insert_audit,
        has_any_column_privilege(
          'tche_agro_runtime', 'public.eventos_auditoria', 'INSERT'
        ) AS runtime_insert_any_audit_column,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.usuarios', 'INSERT'
        ) AS platform_insert_users,
        has_column_privilege(
          'tche_agro_platform_ops', 'public.usuarios', 'email', 'UPDATE'
        ) AS platform_update_user_email,
        has_column_privilege(
          'tche_agro_platform_ops', 'public.usuarios', 'status', 'UPDATE'
        ) AS platform_update_user_status,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.credenciais_usuario', 'SELECT'
        ) AS platform_select_credentials,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.credenciais_usuario', 'UPDATE'
        ) AS platform_update_credentials,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.sessoes_autenticacao', 'SELECT'
        ) AS platform_select_sessions,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.sessoes_autenticacao', 'UPDATE'
        ) AS platform_update_sessions,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.tokens_acesso', 'SELECT'
        ) AS platform_select_access_tokens,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.tokens_refresh', 'SELECT'
        ) AS platform_select_refresh_tokens,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.autorizacoes_restritas', 'INSERT'
        ) AS platform_insert_authorization,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.autorizacoes_restritas', 'UPDATE'
        ) AS platform_update_authorization,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.recuperacoes_assistidas', 'INSERT'
        ) AS platform_insert_recovery,
        has_any_column_privilege(
          'tche_agro_platform_ops', 'public.recuperacoes_assistidas', 'UPDATE'
        ) AS platform_update_recovery,
        has_column_privilege(
          'tche_agro_platform_ops', 'public.desafios_autenticacao',
          'token_hash', 'SELECT'
        ) AS platform_select_challenge_hash,
        has_column_privilege(
          'tche_agro_platform_ops', 'public.outbox_email',
          'payload_cifrado', 'SELECT'
        ) AS platform_select_outbox_payload,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.propriedades', 'SELECT'
        ) AS platform_select_properties,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.eventos_auditoria', 'SELECT'
        ) AS platform_select_audit,
        has_table_privilege(
          'tche_agro_platform_ops', 'public.eventos_auditoria', 'INSERT'
        ) AS platform_insert_audit,
        has_column_privilege(
          'tche_agro_outbox_worker', 'public.outbox_email', 'nonce', 'UPDATE'
        ) AS worker_update_nonce
    `);
    assert.deepEqual(privilegeContract.rows[0], {
      runtime_insert_origin: true,
      runtime_insert_platform_authorization: false,
      runtime_insert_platform_approvers: false,
      runtime_insert_users: false,
      runtime_insert_users_table: false,
      runtime_insert_user_status: false,
      runtime_update_user_profile: false,
      runtime_delete_users: false,
      runtime_insert_producers: false,
      runtime_update_producer_status: false,
      runtime_delete_producers: false,
      runtime_select_administrative_commands: false,
      runtime_update_administrative_actor: false,
      runtime_delete_administrative_commands: false,
      runtime_update_bootstrap_status: true,
      runtime_update_bootstrap_admin: false,
      runtime_insert_audit: false,
      runtime_insert_any_audit_column: false,
      platform_insert_users: true,
      platform_update_user_email: true,
      platform_update_user_status: false,
      platform_select_credentials: false,
      platform_update_credentials: false,
      platform_select_sessions: false,
      platform_update_sessions: false,
      platform_select_access_tokens: false,
      platform_select_refresh_tokens: false,
      platform_insert_authorization: false,
      platform_update_authorization: false,
      platform_insert_recovery: false,
      platform_update_recovery: false,
      platform_select_challenge_hash: false,
      platform_select_outbox_payload: false,
      platform_select_properties: false,
      platform_select_audit: false,
      platform_insert_audit: true,
      worker_update_nonce: true,
    });

    const functionAcl = await databasePool.query<{
      public_trigger_execute: boolean;
      public_property_trigger_execute: boolean;
      public_internal_execute: boolean;
      runtime_admin_execute: boolean;
      runtime_internal_execute: boolean;
      no_public_mp35b_execute: boolean;
    }>(`
      SELECT
        has_function_privilege(
          'public',
          'public.tche_preservar_comando_administrativo_mp35b()',
          'EXECUTE'
        ) AS public_trigger_execute,
        has_function_privilege(
          'public',
          'public.tche_serializar_propriedade_titular_mp35b()',
          'EXECUTE'
        ) AS public_property_trigger_execute,
        has_function_privilege(
          'public',
          'public.tche_admin_iniciar_comando_mp35b(jsonb,text)',
          'EXECUTE'
        ) AS public_internal_execute,
        has_function_privilege(
          'tche_agro_runtime',
          'public.tche_admin_criar_usuario_mp35b(jsonb)',
          'EXECUTE'
        ) AS runtime_admin_execute,
        has_function_privilege(
          'tche_agro_runtime',
          'public.tche_admin_substituir_convite_mp35b(jsonb,text,uuid,uuid,text,text)',
          'EXECUTE'
        ) AS runtime_internal_execute,
        NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_proc AS procedure
          JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = procedure.pronamespace
          WHERE namespace.nspname = 'public'
            AND procedure.proname LIKE 'tche%mp35b'
            AND has_function_privilege('public', procedure.oid, 'EXECUTE')
        ) AS no_public_mp35b_execute
    `);
    assert.deepEqual(functionAcl.rows[0], {
      public_trigger_execute: false,
      public_property_trigger_execute: false,
      public_internal_execute: false,
      runtime_admin_execute: true,
      runtime_internal_execute: false,
      no_public_mp35b_execute: true,
    });

    const functionOwners = await databasePool.query<{
      function_name: string;
      owner_name: string;
    }>(`
      SELECT procedure.proname AS function_name, owner.rolname AS owner_name
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      JOIN pg_catalog.pg_roles AS owner ON owner.oid = procedure.proowner
      WHERE namespace.nspname = 'public'
        AND procedure.proname IN (
          'tche_admin_criar_usuario_mp35b',
          'tche_admin_atualizar_usuario_mp35b',
          'tche_admin_alterar_status_usuario_mp35b',
          'tche_admin_emitir_convite_usuario_mp35b',
          'tche_serializar_propriedade_titular_mp35b'
        )
    `);
    assert.equal(functionOwners.rowCount, 5);
    assert.equal(
      functionOwners.rows.every(
        (row) => row.owner_name === 'tche_agro_administration_owner',
      ),
      true,
    );

    const breakGlassAdminId = randomUUID();
    const unrelatedChallengeId = randomUUID();
    const unrelatedOutboxId = randomUUID();
    const pendingUserId = randomUUID();
    await databasePool.query(`
      INSERT INTO usuarios (id, organizacao_id, nome, email, perfil, status)
      VALUES
        ($1, $3, 'Admin break-glass', $4, 'admin', 'ativo'),
        ($2, $3, 'Usuário pendente alheio', $5, 'produtor', 'pendente')
    `, [
      breakGlassAdminId,
      pendingUserId,
      ORGANIZATION_ID,
      `admin-break-glass-${breakGlassAdminId}@example.test`,
      `pendente-alheio-${pendingUserId}@example.test`,
    ]);
    await databasePool.query(`
      INSERT INTO desafios_autenticacao (
        id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
      ) VALUES (
        $1, $2, $3, 'recuperacao_senha', $4,
        clock_timestamp() + interval '30 minutes'
      )
    `, [unrelatedChallengeId, ORGANIZATION_ID, breakGlassAdminId, Buffer.alloc(32, 29)]);
    await databasePool.query(`
      INSERT INTO outbox_email (
        id, organizacao_id, usuario_id, desafio_id, tipo_mensagem,
        origem_tipo, origem_id, payload_cifrado, chave_id, nonce,
        tag_autenticacao, contexto_autenticado, expira_em
      ) VALUES (
        $1, $2, $3, $4, 'email.smtp.v1', 'desafio', $4,
        $5, 'outbox-v1', $6, $7,
        jsonb_build_object(
          'organizationId', $2::text,
          'messageId', $1::uuid::text,
          'messageType', 'email.smtp.v1'
        ),
        clock_timestamp() + interval '30 minutes'
      )
    `, [
      unrelatedOutboxId,
      ORGANIZATION_ID,
      breakGlassAdminId,
      unrelatedChallengeId,
      Buffer.from('unrelated-ciphertext'),
      Buffer.alloc(12, 30),
      Buffer.alloc(16, 31),
    ]);

    const platformClient = await databasePool.connect();
    try {
      await platformClient.query('SET ROLE tche_agro_platform_ops');
      await assert.rejects(
        platformClient.query(`
          INSERT INTO recuperacoes_assistidas (
            organizacao_id, usuario_id, perfil_alvo, origem, novo_email,
            categoria_motivo, referencia_externa, autorizacao_plataforma_id,
            aprovadores_plataforma, aprovacoes_necessarias, expira_em
          ) VALUES (
            $1, $2, 'admin', 'plataforma_cli', $3,
            'lost_all_admin_emails', 'PLATFORM-FORGED-CASE',
            'forged-authorization', '["forjado-a", "forjado-b"]'::jsonb,
            0, clock_timestamp() + interval '30 minutes'
          )
        `, [
          ORGANIZATION_ID,
          breakGlassAdminId,
          `forjado-break-glass-${breakGlassAdminId}@example.test`,
        ]),
        /permission denied/i,
      );
      await assert.rejects(
        platformClient.query(`
          INSERT INTO desafios_autenticacao (
            organizacao_id, usuario_id, finalidade, token_hash, expira_em
          ) VALUES (
            $1, $2, 'recuperacao_senha', $3,
            clock_timestamp() + interval '30 minutes'
          )
        `, [ORGANIZATION_ID, breakGlassAdminId, Buffer.alloc(32, 32)]),
        /somente cria desafio de convite|somente_convite_bootstrap/i,
      );

      const forgedInvitationChallengeId = randomUUID();
      await platformClient.query('BEGIN');
      await platformClient.query(`
        INSERT INTO desafios_autenticacao (
          id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
        ) VALUES (
          $1, $2, $3, 'convite', $4,
          clock_timestamp() + interval '30 minutes'
        )
      `, [
        forgedInvitationChallengeId,
        ORGANIZATION_ID,
        pendingUserId,
        Buffer.alloc(32, 33),
      ]);
      await platformClient.query(`
        INSERT INTO convites_usuario (
          organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
          criado_por_usuario_id, expira_em
        ) VALUES (
          $1, $2, $3, 'bootstrap', 'ativar_admin_bootstrap', NULL,
          clock_timestamp() + interval '30 minutes'
        )
      `, [ORGANIZATION_ID, pendingUserId, forgedInvitationChallengeId]);
      await assert.rejects(
        platformClient.query('COMMIT'),
        /convite corrente do bootstrap|vinculo_bootstrap/i,
      );
      await platformClient.query('ROLLBACK');

      await assert.rejects(
        platformClient.query(`
          UPDATE desafios_autenticacao
          SET status = 'revogado', revogado_em = clock_timestamp(),
              motivo_encerramento = 'bootstrap_email_corrigido'
          WHERE id = $1
        `, [unrelatedChallengeId]),
        /somente revoga o desafio corrente|correcao_bootstrap/i,
      );
      await assert.rejects(
        platformClient.query(`
          UPDATE outbox_email
          SET status = 'cancelado', payload_cifrado = NULL, nonce = NULL,
              tag_autenticacao = NULL, encerrado_em = clock_timestamp(),
              erro_categoria = 'challenge_revoked'
          WHERE id = $1
        `, [unrelatedOutboxId]),
        /permission denied|somente opera a outbox|somente_bootstrap/i,
      );
      await assert.rejects(
        platformClient.query(`
          INSERT INTO eventos_auditoria (
            organizacao_id, evento, resultado, ator_tipo, metadados
          ) VALUES ($1, 'auth.platform.forjado', 'sucesso', 'sistema', '{}')
        `, [ORGANIZATION_ID]),
        /somente registra auditoria do bootstrap|somente_bootstrap/i,
      );
      await assert.rejects(
        platformClient.query('SELECT id FROM propriedades LIMIT 1'),
        /permission denied/i,
      );
      await assert.rejects(
        platformClient.query('SELECT senha_phc FROM credenciais_usuario LIMIT 1'),
        /permission denied/i,
      );
      await assert.rejects(
        platformClient.query(
          "UPDATE usuarios SET status = 'inativo' WHERE id = $1",
          [breakGlassAdminId],
        ),
        /permission denied/i,
      );
      await assert.rejects(
        platformClient.query(
          'UPDATE usuarios SET email = $2 WHERE id = $1',
          [breakGlassAdminId, `forjado-${breakGlassAdminId}@example.test`],
        ),
        /platform|bootstrap|plataforma/i,
      );
      await assert.rejects(
        platformClient.query(
          "UPDATE eventos_auditoria SET resultado = 'falha' WHERE id = $1",
          [auditId],
        ),
        /permission denied|append-only/i,
      );
    } finally {
      await platformClient.query('RESET ROLE');
      platformClient.release();
    }

    const dualRole = `tche_test_dual_${randomUUID().replaceAll('-', '')}`;
    await databasePool.query(`CREATE ROLE ${dualRole} NOLOGIN`);
    try {
      await databasePool.query(
        `GRANT tche_agro_runtime, tche_agro_platform_ops TO ${dualRole}`,
      );
      const dualClient = await databasePool.connect();
      try {
        await dualClient.query(`SET ROLE ${dualRole}`);
        await assert.rejects(
          dualClient.query(
            'UPDATE usuarios SET email = $2 WHERE id = $1',
            [breakGlassAdminId, `dual-${breakGlassAdminId}@example.test`],
          ),
          /papeis runtime e plataforma|credenciais distintas|papeis_exclusivos/i,
        );
      } finally {
        await dualClient.query('RESET ROLE');
        dualClient.release();
      }
    } finally {
      await databasePool.query(`DROP ROLE ${dualRole}`);
    }

    const dualLoginRole = `tche_test_dual_login_${randomUUID().replaceAll('-', '')}`;
    const dualLoginPassword = randomBytes(24).toString('hex');
    await databasePool.query(
      `CREATE ROLE ${dualLoginRole} LOGIN PASSWORD '${dualLoginPassword}'`,
    );
    await databasePool.query(
      `GRANT tche_agro_runtime, tche_agro_platform_ops TO ${dualLoginRole}`,
    );
    assert.ok(testDatabase);
    const dualLoginUrl = new URL(testDatabase.connectionString);
    dualLoginUrl.username = dualLoginRole;
    dualLoginUrl.password = dualLoginPassword;
    const dualLoginPool = new Pool({
      ...buildPostgresPoolConfig(testDatabase.database),
      connectionString: dualLoginUrl.toString(),
    });
    try {
      const dualLoginClient = await dualLoginPool.connect();
      try {
        await dualLoginClient.query('SET ROLE tche_agro_platform_ops');
        await assert.rejects(
          dualLoginClient.query(
            'UPDATE usuarios SET email = $2 WHERE id = $1',
            [breakGlassAdminId, `dual-login-${breakGlassAdminId}@example.test`],
          ),
          /papeis runtime e plataforma|credenciais distintas|papeis_exclusivos/i,
        );
      } finally {
        dualLoginClient.release();
      }
    } finally {
      await dualLoginPool.end();
      await databasePool.query(`DROP ROLE ${dualLoginRole}`);
    }

    const ownerPlatformRecoveryId = randomUUID();
    await databasePool.query(`
      INSERT INTO recuperacoes_assistidas (
        id, organizacao_id, usuario_id, perfil_alvo, origem,
        novo_email, categoria_motivo, referencia_externa,
        autorizacao_plataforma_id, aprovadores_plataforma,
        aprovacoes_necessarias, expira_em
      ) VALUES (
        $1, $2, $3, 'admin', 'plataforma_cli', $4,
        'owner_security_fixture', 'OWNER-PLATFORM-FIXTURE',
        'owner-platform-authorization', '["owner-a", "owner-b"]'::jsonb,
        0, clock_timestamp() + interval '30 minutes'
      )
    `, [
      ownerPlatformRecoveryId,
      ORGANIZATION_ID,
      breakGlassAdminId,
      `owner-fixture-${breakGlassAdminId}@example.test`,
    ]);

    const runtimeClient = await databasePool.connect();
    try {
      await runtimeClient.query('SET ROLE tche_agro_runtime');
      const visible = await runtimeClient.query('SELECT 1 FROM usuarios LIMIT 1');
      assert.equal(visible.rowCount, 1);
      await assert.rejects(
        runtimeClient.query(`
          INSERT INTO eventos_auditoria (
            organizacao_id, evento, resultado, ator_tipo, metadados
          ) VALUES ($1, 'auth.runtime.inseriu', 'sucesso', 'sistema', '{}')
        `, [ORGANIZATION_ID]),
        (error: unknown) => {
          assert.equal((error as { readonly code?: string }).code, '42501');
          return true;
        },
      );
      await assert.rejects(
        runtimeClient.query(`
          INSERT INTO recuperacoes_assistidas (
            organizacao_id, usuario_id, perfil_alvo, origem, novo_email,
            categoria_motivo, referencia_externa, autorizacao_plataforma_id,
            aprovadores_plataforma, aprovacoes_necessarias, expira_em
          ) VALUES (
            $1, $2, 'admin', 'plataforma_cli', $3,
            'runtime_must_not_break_glass', 'RUNTIME-FORGED-CASE',
            'forged-authorization', '["forjado-a", "forjado-b"]'::jsonb,
            0, clock_timestamp() + interval '30 minutes'
          )
        `, [
          ORGANIZATION_ID,
          breakGlassAdminId,
          `forjado-${breakGlassAdminId}@example.test`,
        ]),
        /permission denied/i,
      );
      await assert.rejects(
        runtimeClient.query(`
          UPDATE recuperacoes_assistidas
          SET status = 'em_validacao'
          WHERE id = $1
        `, [ownerPlatformRecoveryId]),
        /runtime nao pode operar recuperacao da plataforma|permission denied/i,
      );
      await assert.rejects(
        runtimeClient.query(
          "UPDATE eventos_auditoria SET resultado = 'falha' WHERE id = $1",
          [auditId],
        ),
        /permission denied|append-only/i,
      );
      await assert.rejects(
        runtimeClient.query("UPDATE propriedades SET nome = nome || ' indevido'"),
        /permission denied/i,
      );
    } finally {
      await runtimeClient.query('RESET ROLE');
      runtimeClient.release();
    }

    const outboxId = randomUUID();
    const cancelledOutboxId = randomUUID();
    await databasePool.query(`
      INSERT INTO outbox_email (
        id, organizacao_id, tipo_mensagem, payload_cifrado, chave_id,
        nonce, tag_autenticacao, contexto_autenticado, disponivel_em,
        expira_em
      ) VALUES (
        $1, $2, 'email.smtp.v1', $3, 'outbox-v1', $4, $5,
        jsonb_build_object('organizationId', $2::text, 'messageId', $1::uuid::text,
          'messageType', 'email.smtp.v1'),
        clock_timestamp(), clock_timestamp() + interval '30 minutes'
      )
    `, [
      outboxId,
      ORGANIZATION_ID,
      Buffer.from('ciphertext'),
      Buffer.alloc(12, 20),
      Buffer.alloc(16, 21),
    ]);
    await databasePool.query(`
      INSERT INTO outbox_email (
        id, organizacao_id, tipo_mensagem, payload_cifrado, chave_id,
        nonce, tag_autenticacao, contexto_autenticado, disponivel_em,
        expira_em
      ) VALUES (
        $1, $2, 'email.smtp.v1', $3, 'outbox-v1', $4, $5,
        jsonb_build_object('organizationId', $2::text, 'messageId', $1::uuid::text,
          'messageType', 'email.smtp.v1'),
        clock_timestamp(), clock_timestamp() + interval '30 minutes'
      )
    `, [
      cancelledOutboxId,
      ORGANIZATION_ID,
      Buffer.from('ciphertext-cancelled'),
      Buffer.alloc(12, 22),
      Buffer.alloc(16, 23),
    ]);

    const workerClient = await databasePool.connect();
    try {
      await workerClient.query('SET ROLE tche_agro_outbox_worker');
      await assert.rejects(
        workerClient.query(`
          INSERT INTO eventos_auditoria (
            organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
            usuario_afetado_id, recurso_tipo, recurso_id, metadados
          ) VALUES (
            $1, 'auth.email.forjado', 'sucesso', 'usuario', $2, $2,
            'outbox_email', $3, '{}'
          )
        `, [ORGANIZATION_ID, breakGlassAdminId, outboxId]),
        /worker somente registra|resultado_outbox|papeis.*credenciais/i,
      );
      const deliveryLeaseToken = randomUUID();
      await workerClient.query(`
        UPDATE outbox_email
        SET status = 'processando', tentativas = 1,
            bloqueado_em = clock_timestamp(), bloqueado_por = 'worker-test',
            lease_token = $2, lease_expira_em = clock_timestamp() + interval '30 seconds'
        WHERE id = $1
      `, [outboxId, deliveryLeaseToken]);
      await workerClient.query(`
        UPDATE outbox_email
        SET status = 'enviado', payload_cifrado = NULL, nonce = NULL,
            tag_autenticacao = NULL, bloqueado_em = NULL, bloqueado_por = NULL,
            lease_token = NULL, lease_expira_em = NULL,
            enviado_em = clock_timestamp(), encerrado_em = clock_timestamp(),
            provedor_mensagem_id = 'provider-message-test'
        WHERE id = $1 AND lease_token = $2
      `, [outboxId, deliveryLeaseToken]);

      const cancellationLeaseToken = randomUUID();
      await workerClient.query(`
        UPDATE outbox_email
        SET status = 'processando', tentativas = 1,
            bloqueado_em = clock_timestamp(), bloqueado_por = 'worker-test',
            lease_token = $2, lease_expira_em = clock_timestamp() + interval '30 seconds'
        WHERE id = $1
      `, [cancelledOutboxId, cancellationLeaseToken]);
      await workerClient.query(`
        UPDATE outbox_email
        SET status = 'cancelado', payload_cifrado = NULL, nonce = NULL,
            tag_autenticacao = NULL, bloqueado_em = NULL, bloqueado_por = NULL,
            lease_token = NULL, lease_expira_em = NULL,
            encerrado_em = clock_timestamp(), erro_categoria = 'challenge_invalid'
        WHERE id = $1 AND lease_token = $2
      `, [cancelledOutboxId, cancellationLeaseToken]);
      const deliveredWithoutAudit = await workerClient.query<{
        readonly enviado_em: Date;
      }>(
        'SELECT enviado_em FROM outbox_email WHERE id = $1',
        [outboxId],
      );
      assert.ok(deliveredWithoutAudit.rows[0]?.enviado_em);
      await assert.rejects(
        workerClient.query(
          `
            INSERT INTO eventos_auditoria (
              organizacao_id, evento, resultado, ator_tipo,
              usuario_afetado_id, recurso_tipo, recurso_id,
              metadados, ocorrido_em
            ) VALUES (
              $1, 'auth.email.enviado', 'sucesso', 'sistema', NULL,
              'outbox_email', $2, '{}'::jsonb, $3
            )
          `,
          [
            ORGANIZATION_ID,
            outboxId,
            deliveredWithoutAudit.rows[0].enviado_em,
          ],
        ),
        /resultado terminal da propria outbox|resultado_outbox/i,
      );
      await assert.rejects(
        workerClient.query(
          "UPDATE outbox_email SET tipo_mensagem = 'email.outro.v1' WHERE id = $1",
          [outboxId],
        ),
        /permission denied/i,
      );
      await assert.rejects(
        workerClient.query('SELECT token_hash FROM desafios_autenticacao LIMIT 1'),
        /permission denied/i,
      );
    } finally {
      await workerClient.query('RESET ROLE');
      workerClient.release();
    }

    const terminalOutbox = await databasePool.query<{
      status: string;
      nonce: Buffer | null;
      nonce_hash_length: number;
    }>(`
      SELECT status, nonce, octet_length(nonce_hash)::integer AS nonce_hash_length
      FROM outbox_email
      WHERE id IN ($1, $2)
      ORDER BY status
    `, [outboxId, cancelledOutboxId]);
    assert.equal(terminalOutbox.rowCount, 2);
    assert.deepEqual(
      terminalOutbox.rows.map((row) => ({
        status: row.status,
        nonce: row.nonce,
        nonceHashLength: row.nonce_hash_length,
      })),
      [
        { status: 'cancelado', nonce: null, nonceHashLength: 32 },
        { status: 'enviado', nonce: null, nonceHashLength: 32 },
      ],
    );
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
    await runMigrations({
      command: 'down',
      count: 8,
      database: activeMigrationDatabase,
    });

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
