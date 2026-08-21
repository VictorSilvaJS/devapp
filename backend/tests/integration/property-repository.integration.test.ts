import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool } from 'pg';
import fastify from 'fastify';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import {
  QA_FIXTURE_IDS,
  runQaFixtureLoader,
} from '../../scripts/load-qa-fixtures.js';
import { runMigrations } from '../../scripts/migrate.js';
import type { AuthenticatedPrincipal, UserProfile } from '../../src/auth/contracts.js';
import type { AuthenticationService } from '../../src/auth/service.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { PostgresPropertyRepository } from '../../src/properties/postgres-property-repository.js';
import { propertyRoutesPlugin } from '../../src/properties/routes.js';
import { DefaultPropertyService } from '../../src/properties/service.js';
import { issueOpaqueToken } from '../../src/security/tokens.js';
import {
  startPostgisTestDatabase,
  type StartedPostgisTestDatabase,
} from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade';

interface FixtureIds {
  readonly admin: string;
  readonly titularUser: string;
  readonly titularProducer: string;
  readonly authorizedUser: string;
  readonly authorizedProducer: string;
  readonly otherUser: string;
  readonly otherProducer: string;
  readonly collaborator: string;
  readonly staleCollaborator: string;
  readonly titularActive: string;
  readonly titularInactive: string;
  readonly authorized: string;
  readonly collaboratorLinked: string;
  readonly literalSearch: string;
  readonly outsideScope: string;
  readonly orderedFirst: string;
  readonly orderedSecond: string;
}

describe('PostgresPropertyRepository', { timeout: 180_000 }, () => {
  let testDatabase: StartedPostgisTestDatabase | undefined;
  let pool: Pool | undefined;
  let repository: PostgresPropertyRepository | undefined;
  let ids: FixtureIds | undefined;

  before(async () => {
    assertDestructiveDatabaseTestsAllowed(
      'postgresql://guard:guard@127.0.0.1:5432/tche_agro_test',
    );
    const previousAmbientUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://ambient:sentinel@database.invalid:5432/ambient_must_not_be_used';
    try {
      testDatabase = await startPostgisTestDatabase();
    } finally {
      if (previousAmbientUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousAmbientUrl;
    }
    assertDestructiveDatabaseTestsAllowed(testDatabase.connectionString);
    await runMigrations({ command: 'up', database: testDatabase.database });
    pool = new Pool(buildPostgresPoolConfig(testDatabase.database));
    repository = new PostgresPropertyRepository(pool);
    ids = await seedFixtures(pool);
  });

  after(async () => {
    await pool?.end();
    await testDatabase?.container.stop();
  });

  function requireRepository(): PostgresPropertyRepository {
    assert.ok(repository);
    return repository;
  }

  function requirePool(): Pool {
    assert.ok(pool);
    return pool;
  }

  function requireIds(): FixtureIds {
    assert.ok(ids);
    return ids;
  }

  function principal(
    id: string,
    profile: UserProfile,
    authorizationVersion = 1,
  ): AuthenticatedPrincipal {
    return {
      id,
      organizationId: ORGANIZATION_ID,
      name: 'Principal de integração',
      email: `${id}@example.test`,
      profile,
      status: 'ativo',
      authorizationVersion,
      sessionId: randomUUID(),
    };
  }

  test('Admin vê Propriedades ativas e inativas e recebe acesso calculado admin', async () => {
    const fixture = requireIds();
    const rows = await requireRepository().list({
      principal: principal(fixture.admin, 'admin'),
      limit: 100,
    });

    assert.equal(rows.length, 8);
    assert.equal(rows.every((row) => row.accessType === 'admin'), true);
    assert.equal(rows.some((row) => row.id === fixture.titularInactive), true);
    assert.deepEqual(
      rows.map((row) => [row.name, row.id]),
      [...rows]
        .sort((left, right) =>
          left.name === right.name
            ? left.id.localeCompare(right.id)
            : Buffer.from(left.name).compare(Buffer.from(right.name)),
        )
        .map((row) => [row.name, row.id]),
    );
  });

  test('Produtor vê apenas ativas por Titularidade derivada ou autorização adicional ativa', async () => {
    const fixture = requireIds();
    const titular = await requireRepository().list({
      principal: principal(fixture.titularUser, 'produtor'),
      limit: 100,
    });
    assert.deepEqual(
      titular.map((row) => [row.id, row.accessType]),
      [[fixture.titularActive, 'titular']],
    );

    const authorized = await requireRepository().list({
      principal: principal(fixture.authorizedUser, 'produtor'),
      limit: 100,
    });
    assert.deepEqual(
      authorized.map((row) => [row.id, row.accessType]),
      [[fixture.authorized, 'usuario_autorizado']],
    );
    assert.equal(
      authorized.some((row) => row.id === fixture.outsideScope),
      false,
    );
  });

  test('Colaborador depende de vínculo direto ativo; localização só filtra o escopo', async () => {
    const fixture = requireIds();
    const actor = principal(fixture.collaborator, 'colaborador');
    const rows = await requireRepository().list({ principal: actor, limit: 100 });
    assert.deepEqual(
      rows.map((row) => [row.id, row.accessType]),
      [
        [fixture.literalSearch, 'colaborador'],
        [fixture.collaboratorLinked, 'colaborador'],
      ],
    );

    const filteredByCode = await requireRepository().list({
      principal: actor,
      limit: 100,
      state: 'RS',
      municipality: 'Cruz Alta',
    });
    assert.deepEqual(filteredByCode.map((row) => row.id), [fixture.literalSearch]);

    const filteredById = await requireRepository().list({
      principal: actor,
      limit: 100,
      state: '43',
      municipality: '4306106',
    });
    assert.deepEqual(filteredById.map((row) => row.id), [fixture.literalSearch]);
    assert.equal(rows.some((row) => row.id === fixture.outsideScope), false);
  });

  test('busca trata %, _, barra e backslash como texto literal', async () => {
    const fixture = requireIds();
    const rows = await requireRepository().list({
      principal: principal(fixture.admin, 'admin'),
      limit: 100,
      search: '%/_/\\',
    });
    assert.deepEqual(rows.map((row) => row.id), [fixture.literalSearch]);
  });

  test('cursor nome+id mantém paginação estável inclusive com nomes iguais', async () => {
    const fixture = requireIds();
    const actor = principal(fixture.admin, 'admin');
    const all = await requireRepository().list({ principal: actor, limit: 100 });
    const firstOrderedIndex = all.findIndex((row) => row.id === fixture.orderedFirst);
    assert.ok(firstOrderedIndex >= 0);
    assert.equal(all[firstOrderedIndex + 1]?.id, fixture.orderedSecond);

    const afterFirst = await requireRepository().list({
      principal: actor,
      limit: 100,
      cursor: {
        name: all[firstOrderedIndex]?.name ?? '',
        id: fixture.orderedFirst,
      },
    });
    assert.equal(afterFirst[0]?.id, fixture.orderedSecond);
    assert.equal(afterFirst.some((row) => row.id === fixture.orderedFirst), false);

    const authentication = {
      async authenticate() {
        return actor;
      },
    } as unknown as AuthenticationService;
    const service = new DefaultPropertyService({
      authentication,
      repository: requireRepository(),
    });
    const pagedIds: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list({
        accessToken: 'integration-access-token',
        query: { limite: 3, ...(cursor === undefined ? {} : { cursor }) },
      });
      pagedIds.push(...page.items.map((row) => row.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    assert.deepEqual(pagedIds, all.map((row) => row.id));
    assert.equal(new Set(pagedIds).size, pagedIds.length);
  });

  test('detalhe inexistente e fora do escopo retornam o mesmo null', async () => {
    const fixture = requireIds();
    const actor = principal(fixture.collaborator, 'colaborador');
    assert.equal(
      await requireRepository().findById({
        principal: actor,
        propertyId: fixture.outsideScope,
      }),
      null,
    );
    assert.equal(
      await requireRepository().findById({
        principal: actor,
        propertyId: randomUUID(),
      }),
      null,
    );
    assert.equal(
      (
        await requireRepository().findById({
          principal: actor,
          propertyId: fixture.collaboratorLinked,
        })
      )?.accessType,
      'colaborador',
    );
  });

  test('HTTP mantém detalhe inexistente e fora do escopo no mesmo 404 seguro', async () => {
    const fixture = requireIds();
    const actor = principal(fixture.collaborator, 'colaborador');
    const authentication = {
      async authenticate() {
        return actor;
      },
    } as unknown as AuthenticationService;
    const service = new DefaultPropertyService({
      authentication,
      repository: requireRepository(),
    });
    const app = fastify({
      logger: false,
      genReqId: () => 'req-property-integration',
    });
    await app.register(propertyRoutesPlugin, {
      prefix: '/v1/propriedades',
      service,
    });
    const accessToken = issueOpaqueToken().value;
    try {
      const responses = await Promise.all([
        app.inject({
          method: 'GET',
          url: `/v1/propriedades/${fixture.outsideScope}`,
          headers: { authorization: `Bearer ${accessToken}` },
        }),
        app.inject({
          method: 'GET',
          url: `/v1/propriedades/${randomUUID()}`,
          headers: { authorization: `Bearer ${accessToken}` },
        }),
      ]);
      for (const response of responses) {
        assert.equal(response.statusCode, 404);
        assert.deepEqual(response.json(), {
          error: {
            code: 'not_found',
            message: 'Recurso não encontrado.',
            request_id: 'req-property-integration',
            details: [],
          },
        });
      }
    } finally {
      await app.close();
    }
  });

  test('status, versão de autorização e cadastro de Produtor são revalidados fail-closed no SQL', async () => {
    const fixture = requireIds();
    const staleActor = principal(fixture.staleCollaborator, 'colaborador');
    await requirePool().query(
      `UPDATE public.usuarios SET status = 'inativo' WHERE id = $1`,
      [fixture.staleCollaborator],
    );
    assert.deepEqual(
      await requireRepository().list({ principal: staleActor, limit: 100 }),
      [],
    );

    assert.deepEqual(
      await requireRepository().list({
        principal: principal(fixture.admin, 'admin', 999),
        limit: 100,
      }),
      [],
    );

    await requirePool().query(
      `UPDATE public.produtores SET status = 'inativo' WHERE id = $1`,
      [fixture.titularProducer],
    );
    assert.deepEqual(
      await requireRepository().list({
        principal: principal(fixture.titularUser, 'produtor'),
        limit: 100,
      }),
      [],
    );
  });

  test('loader manual usa só a URL explícita protegida e é idempotente', async () => {
    const activeTestDatabase = testDatabase;
    assert.ok(activeTestDatabase);
    const environment = {
      NODE_ENV: 'test',
      ALLOW_QA_FIXTURES: 'true',
      QA_FIXTURES_DATABASE_URL: activeTestDatabase.connectionString,
      QA_FIXTURES_PASSWORD: 'SenhaSinteticaQa9!',
      DATABASE_URL:
        'postgresql://ambient:sentinel@database.invalid:5432/ambient_must_not_be_used',
    } as const;

    await runQaFixtureLoader(environment);
    await runQaFixtureLoader(environment);

    const counts = await requirePool().query<{
      usuarios: string;
      credenciais: string;
      produtores: string;
      propriedades: string;
      vinculos: string;
    }>(
      `
        SELECT
          (SELECT count(*) FROM public.usuarios WHERE id = ANY($1::uuid[]))::text AS usuarios,
          (SELECT count(*) FROM public.credenciais_usuario WHERE id = ANY($2::uuid[]))::text AS credenciais,
          (SELECT count(*) FROM public.produtores WHERE id = ANY($3::uuid[]))::text AS produtores,
          (SELECT count(*) FROM public.propriedades WHERE id = ANY($4::uuid[]))::text AS propriedades,
          (SELECT count(*) FROM public.usuario_propriedade WHERE id = ANY($5::uuid[]))::text AS vinculos
      `,
      [
        [
          QA_FIXTURE_IDS.producerUserOne,
          QA_FIXTURE_IDS.producerUserTwo,
          QA_FIXTURE_IDS.collaboratorUser,
        ],
        [
          QA_FIXTURE_IDS.producerCredentialOne,
          QA_FIXTURE_IDS.producerCredentialTwo,
          QA_FIXTURE_IDS.collaboratorCredential,
        ],
        [QA_FIXTURE_IDS.producerOne, QA_FIXTURE_IDS.producerTwo],
        [
          QA_FIXTURE_IDS.activeProperty,
          QA_FIXTURE_IDS.secondProperty,
          QA_FIXTURE_IDS.inactiveProperty,
        ],
        [
          QA_FIXTURE_IDS.authorizedLink,
          QA_FIXTURE_IDS.collaboratorLinkOne,
          QA_FIXTURE_IDS.collaboratorLinkTwo,
        ],
      ],
    );
    assert.deepEqual(counts.rows[0], {
      usuarios: '3',
      credenciais: '3',
      produtores: '2',
      propriedades: '3',
      vinculos: '3',
    });

    await assert.rejects(
      runQaFixtureLoader({
        ...environment,
        QA_FIXTURES_PASSWORD: 'OutraSenhaSinteticaQa9!',
      }),
    );

    await requirePool().query(
      `UPDATE public.usuarios SET email = 'estado.divergente@qa.invalid' WHERE id = $1`,
      [QA_FIXTURE_IDS.producerUserOne],
    );
    await assert.rejects(runQaFixtureLoader(environment));
    const preservedConflict = await requirePool().query<{ email: string }>(
      `SELECT email FROM public.usuarios WHERE id = $1`,
      [QA_FIXTURE_IDS.producerUserOne],
    );
    assert.equal(
      preservedConflict.rows[0]?.email,
      'estado.divergente@qa.invalid',
    );
  });
});

async function seedFixtures(pool: Pool): Promise<FixtureIds> {
  const ids: FixtureIds = {
    admin: randomUUID(),
    titularUser: randomUUID(),
    titularProducer: randomUUID(),
    authorizedUser: randomUUID(),
    authorizedProducer: randomUUID(),
    otherUser: randomUUID(),
    otherProducer: randomUUID(),
    collaborator: randomUUID(),
    staleCollaborator: randomUUID(),
    titularActive: randomUUID(),
    titularInactive: randomUUID(),
    authorized: randomUUID(),
    collaboratorLinked: randomUUID(),
    literalSearch: randomUUID(),
    outsideScope: randomUUID(),
    orderedFirst: '10000000-0000-4000-8000-000000000001',
    orderedSecond: '20000000-0000-4000-8000-000000000002',
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO public.usuarios (id, organizacao_id, nome, email, perfil, status)
        VALUES
          ($1, $7, 'Admin', $1::uuid::text || '@example.test', 'admin', 'ativo'),
          ($2, $7, 'Titular', $2::uuid::text || '@example.test', 'produtor', 'ativo'),
          ($3, $7, 'Autorizado', $3::uuid::text || '@example.test', 'produtor', 'ativo'),
          ($4, $7, 'Outro titular', $4::uuid::text || '@example.test', 'produtor', 'ativo'),
          ($5, $7, 'Colaborador', $5::uuid::text || '@example.test', 'colaborador', 'ativo'),
          ($6, $7, 'Colaborador stale', $6::uuid::text || '@example.test', 'colaborador', 'ativo')
      `,
      [
        ids.admin,
        ids.titularUser,
        ids.authorizedUser,
        ids.otherUser,
        ids.collaborator,
        ids.staleCollaborator,
        ORGANIZATION_ID,
      ],
    );
    await client.query(
      `
        INSERT INTO public.produtores (id, organizacao_id, usuario_id, nome, status)
        VALUES
          ($1, $7, $2, 'Titular', 'ativo'),
          ($3, $7, $4, 'Autorizado', 'ativo'),
          ($5, $7, $6, 'Outro titular', 'ativo')
      `,
      [
        ids.titularProducer,
        ids.titularUser,
        ids.authorizedProducer,
        ids.authorizedUser,
        ids.otherProducer,
        ids.otherUser,
        ORGANIZATION_ID,
      ],
    );
    await client.query(
      `
        INSERT INTO public.propriedades (
          id, organizacao_id, titular_id, nome, municipio_id, municipio_nome,
          uf_id, uf_sigla, area_total, cultura_principal, status
        ) VALUES
          ($1, $9, $8, 'Alpha Titular', '4306106', 'Cruz Alta', '43', 'RS', 10.5, 'Soja', 'ativa'),
          ($2, $9, $8, 'Beta Inativa', '4306106', 'Cruz Alta', '43', 'RS', 11.5, NULL, 'inativa'),
          ($3, $9, $10, 'Gamma Autorizada', '4316907', 'Santa Maria', '43', 'RS', 12.5, 'Milho', 'ativa'),
          ($4, $9, $10, 'Delta Colaborador', '4205407', 'Florianópolis', '42', 'SC', 13.5, 'Soja', 'ativa'),
          ($5, $9, $10, '100%/_/\\Literal', '4306106', 'Cruz Alta', '43', 'RS', 14.5, 'Trigo', 'ativa'),
          ($6, $9, $10, 'Epsilon Sem Acesso', '4306106', 'Cruz Alta', '43', 'RS', 15.5, 'Soja', 'ativa'),
          ($7, $9, $10, 'Ordenada', '4306106', 'Cruz Alta', '43', 'RS', 16.5, 'Soja', 'ativa'),
          ($11, $9, $10, 'Ordenada', '4306106', 'Cruz Alta', '43', 'RS', 17.5, 'Soja', 'ativa')
      `,
      [
        ids.titularActive,
        ids.titularInactive,
        ids.authorized,
        ids.collaboratorLinked,
        ids.literalSearch,
        ids.outsideScope,
        ids.orderedFirst,
        ids.titularProducer,
        ORGANIZATION_ID,
        ids.otherProducer,
        ids.orderedSecond,
      ],
    );
    await client.query(
      `
        INSERT INTO public.usuario_propriedade (
          organizacao_id, usuario_id, propriedade_id, tipo_vinculo, status,
          motivo_inativacao
        ) VALUES
          ($1, $2, $3, 'usuario_autorizado', 'ativo', NULL),
          ($1, $2, $4, 'usuario_autorizado', 'inativo', 'Teste de vínculo inativo'),
          ($1, $5, $6, 'colaborador', 'ativo', NULL),
          ($1, $5, $7, 'colaborador', 'ativo', NULL),
          ($1, $8, $4, 'colaborador', 'ativo', NULL)
      `,
      [
        ORGANIZATION_ID,
        ids.authorizedUser,
        ids.authorized,
        ids.outsideScope,
        ids.collaborator,
        ids.collaboratorLinked,
        ids.literalSearch,
        ids.staleCollaborator,
      ],
    );
    await client.query('COMMIT');
    return ids;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
