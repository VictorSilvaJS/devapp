import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Pool, type PoolClient, type PoolConfig } from 'pg';

import { databaseNameFromConnectionString } from './destructive-database-test-guard.js';
import { loadAuthenticationRuntimeConfig } from '../src/auth/config.js';
import { loadPasswordBlocklist } from '../src/auth/password-blocklist.js';
import { DefaultPasswordCredentialService } from '../src/auth/password-credential.js';
import { Argon2idPasswordHasher } from '../src/auth/password-hasher.js';
import { PasswordPolicy, PasswordPolicyError } from '../src/auth/password-policy.js';
import {
  buildDatabaseConfig,
  ConfigurationError,
  type DatabaseConfig,
} from '../src/config.js';
import { buildPostgresPoolConfig } from '../src/database/pool.js';

export const QA_FIXTURE_IDS = Object.freeze({
  producerUserOne: 'd0000000-0000-4000-8000-000000000001',
  producerUserTwo: 'd0000000-0000-4000-8000-000000000002',
  collaboratorUser: 'd0000000-0000-4000-8000-000000000003',
  producerCredentialOne: 'c0000000-0000-4000-8000-000000000001',
  producerCredentialTwo: 'c0000000-0000-4000-8000-000000000002',
  collaboratorCredential: 'c0000000-0000-4000-8000-000000000003',
  producerOne: 'e0000000-0000-4000-8000-000000000001',
  producerTwo: 'e0000000-0000-4000-8000-000000000002',
  activeProperty: 'f0000000-0000-4000-8000-000000000001',
  secondProperty: 'f0000000-0000-4000-8000-000000000002',
  inactiveProperty: 'f0000000-0000-4000-8000-000000000003',
  authorizedLink: 'a0000000-0000-4000-8000-000000000001',
  collaboratorLinkOne: 'a0000000-0000-4000-8000-000000000002',
  collaboratorLinkTwo: 'a0000000-0000-4000-8000-000000000003',
});

const ORGANIZATION_ID = 'org_tche_fertilidade';

export class QaFixtureGuardError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'QaFixtureGuardError';
  }
}

export interface QaFixtureLoaderConfig {
  readonly environment: 'development' | 'test' | 'qa';
  readonly database: DatabaseConfig;
  /** Sensitive; never log or persist outside the Argon2id PHC. */
  readonly password: string;
}

export function loadQaFixtureConfig(
  source: Readonly<Record<string, string | undefined>>,
): QaFixtureLoaderConfig {
  if (source.NODE_ENV === 'production') {
    throw new QaFixtureGuardError(
      'Fixtures de QA são proibidas em production.',
    );
  }
  if (
    source.NODE_ENV !== 'development' &&
    source.NODE_ENV !== 'test' &&
    source.NODE_ENV !== 'qa'
  ) {
    throw new QaFixtureGuardError(
      'Fixtures de QA exigem NODE_ENV=development, test ou qa.',
    );
  }
  if (source.ALLOW_QA_FIXTURES !== 'true') {
    throw new QaFixtureGuardError(
      'Fixtures de QA exigem ALLOW_QA_FIXTURES=true.',
    );
  }
  const password = source.QA_FIXTURES_PASSWORD;
  if (password === undefined || password.length === 0) {
    throw new QaFixtureGuardError(
      'Fixtures de QA exigem QA_FIXTURES_PASSWORD explícita.',
    );
  }

  const explicitDatabaseUrl = source.QA_FIXTURES_DATABASE_URL;
  if (explicitDatabaseUrl === undefined || explicitDatabaseUrl.length === 0) {
    throw new QaFixtureGuardError(
      'Fixtures de QA exigem QA_FIXTURES_DATABASE_URL explícita.',
    );
  }

  const databaseName = databaseNameFromConnectionString(explicitDatabaseUrl);
  if (!databaseName.endsWith('_test') && !databaseName.endsWith('_qa')) {
    throw new QaFixtureGuardError(
      'Fixtures de QA exigem banco terminado em _test ou _qa.',
    );
  }

  try {
    return Object.freeze({
      environment: source.NODE_ENV,
      password,
      database: buildDatabaseConfig({
        nodeEnv: source.NODE_ENV === 'test' ? 'test' : 'development',
        databaseUrl: explicitDatabaseUrl,
        ...(source.QA_FIXTURES_DATABASE_SSL_CA === undefined
          ? {}
          : { certificateAuthority: source.QA_FIXTURES_DATABASE_SSL_CA }),
      }),
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw new QaFixtureGuardError('A configuração do banco de fixtures é inválida.');
    }
    throw error;
  }
}

export type QaFixturePoolFactory = (config: PoolConfig) => Pool;

type ExactFixtureRow = Readonly<Record<string, unknown>> & {
  readonly id: string;
};

function rowsMatchExactly(
  actual: readonly ExactFixtureRow[],
  expected: readonly ExactFixtureRow[],
): boolean {
  if (actual.length !== expected.length) return false;

  const actualById = new Map(actual.map((row) => [row.id, row]));
  return expected.every((expectedRow) => {
    const actualRow = actualById.get(expectedRow.id);
    return (
      actualRow !== undefined &&
      Object.entries(expectedRow).every(
        ([column, value]) => actualRow[column] === value,
      )
    );
  });
}

export async function runQaFixtureLoader(
  source: Readonly<Record<string, string | undefined>> = process.env,
  poolFactory: QaFixturePoolFactory = (config) => new Pool(config),
): Promise<void> {
  // Todos os guards são avaliados antes de construir o Pool ou tocar a rede.
  const config = loadQaFixtureConfig(source);
  const authenticationConfig = loadAuthenticationRuntimeConfig({
    ...source,
    NODE_ENV: config.environment === 'test' ? 'test' : 'development',
  });
  const blocklist = await loadPasswordBlocklist(
    authenticationConfig.password.blocklistManifestPath,
  );
  const credentials = new DefaultPasswordCredentialService(
    new PasswordPolicy(authenticationConfig.password, blocklist),
    new Argon2idPasswordHasher(authenticationConfig.password.argon2),
  );
  let credential: Awaited<ReturnType<typeof credentials.validateAndHash>>;
  try {
    credential = await credentials.validateAndHash(config.password);
  } catch (error) {
    if (error instanceof PasswordPolicyError) {
      throw new QaFixtureGuardError(
        'QA_FIXTURES_PASSWORD não atende à política de senha.',
      );
    }
    throw error;
  }
  const pool = poolFactory(
    buildPostgresPoolConfig(config.database, 'tche_agro_qa_fixtures'),
  );
  pool.on('error', () => {
    // O CLI não propaga mensagens internas do PostgreSQL para logs.
  });

  let client: PoolClient | undefined;
  let operationError: unknown;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO public.usuarios (
          id, organizacao_id, nome, email, perfil, status, observacoes
        ) VALUES
          ($1, $4, '[QA] Produtor Um', 'qa.produtor.1@qa.invalid', 'produtor', 'ativo', 'Fixture sintética manual'),
          ($2, $4, '[QA] Produtor Dois', 'qa.produtor.2@qa.invalid', 'produtor', 'ativo', 'Fixture sintética manual'),
          ($3, $4, '[QA] Colaborador', 'qa.colaborador@qa.invalid', 'colaborador', 'ativo', 'Fixture sintética manual')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        QA_FIXTURE_IDS.producerUserOne,
        QA_FIXTURE_IDS.producerUserTwo,
        QA_FIXTURE_IDS.collaboratorUser,
        ORGANIZATION_ID,
      ],
    );
    await client.query(
      `
        INSERT INTO public.credenciais_usuario (
          id, organizacao_id, usuario_id, senha_phc, versao_politica_senha,
          status
        ) VALUES
          ($1, $8, $4, $7, $9, 'ativa'),
          ($2, $8, $5, $7, $9, 'ativa'),
          ($3, $8, $6, $7, $9, 'ativa')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        QA_FIXTURE_IDS.producerCredentialOne,
        QA_FIXTURE_IDS.producerCredentialTwo,
        QA_FIXTURE_IDS.collaboratorCredential,
        QA_FIXTURE_IDS.producerUserOne,
        QA_FIXTURE_IDS.producerUserTwo,
        QA_FIXTURE_IDS.collaboratorUser,
        credential.passwordHash,
        ORGANIZATION_ID,
        credential.policyVersion,
      ],
    );
    await client.query(
      `
        INSERT INTO public.produtores (
          id, organizacao_id, usuario_id, nome, status
        ) VALUES
          ($1, $5, $2, '[QA] Produtor Um', 'ativo'),
          ($3, $5, $4, '[QA] Produtor Dois', 'ativo')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        QA_FIXTURE_IDS.producerOne,
        QA_FIXTURE_IDS.producerUserOne,
        QA_FIXTURE_IDS.producerTwo,
        QA_FIXTURE_IDS.producerUserTwo,
        ORGANIZATION_ID,
      ],
    );
    await client.query(
      `
        INSERT INTO public.propriedades (
          id, organizacao_id, titular_id, nome, municipio_id, municipio_nome,
          uf_id, uf_sigla, area_total, cultura_principal, status
        ) VALUES
          ($1, $6, $4, '[QA] Propriedade Ativa', '4306106', 'Cruz Alta', '43', 'RS', 120.5, 'Soja', 'ativa'),
          ($2, $6, $5, '[QA] Propriedade Secundária', '4316907', 'Santa Maria', '43', 'RS', 85.25, 'Milho', 'ativa'),
          ($3, $6, $4, '[QA] Propriedade Inativa', '4205407', 'Florianópolis', '42', 'SC', 42.75, NULL, 'inativa')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        QA_FIXTURE_IDS.activeProperty,
        QA_FIXTURE_IDS.secondProperty,
        QA_FIXTURE_IDS.inactiveProperty,
        QA_FIXTURE_IDS.producerOne,
        QA_FIXTURE_IDS.producerTwo,
        ORGANIZATION_ID,
      ],
    );
    await client.query(
      `
        INSERT INTO public.usuario_propriedade (
          id, organizacao_id, usuario_id, propriedade_id, tipo_vinculo, status
        ) VALUES
          ($1, $8, $4, $6, 'usuario_autorizado', 'ativo'),
          ($2, $8, $5, $6, 'colaborador', 'ativo'),
          ($3, $8, $5, $7, 'colaborador', 'ativo')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        QA_FIXTURE_IDS.authorizedLink,
        QA_FIXTURE_IDS.collaboratorLinkOne,
        QA_FIXTURE_IDS.collaboratorLinkTwo,
        QA_FIXTURE_IDS.producerUserTwo,
        QA_FIXTURE_IDS.collaboratorUser,
        QA_FIXTURE_IDS.activeProperty,
        QA_FIXTURE_IDS.secondProperty,
        ORGANIZATION_ID,
      ],
    );

    const users = await client.query<ExactFixtureRow>(
      `
        SELECT id::text, organizacao_id, nome, email, perfil, status
        FROM public.usuarios
        WHERE id = ANY($1::uuid[])
      `,
      [
        [
          QA_FIXTURE_IDS.producerUserOne,
          QA_FIXTURE_IDS.producerUserTwo,
          QA_FIXTURE_IDS.collaboratorUser,
        ],
      ],
    );

    const expectedUsers: readonly ExactFixtureRow[] = [
      {
        id: QA_FIXTURE_IDS.producerUserOne,
        organizacao_id: ORGANIZATION_ID,
        nome: '[QA] Produtor Um',
        email: 'qa.produtor.1@qa.invalid',
        perfil: 'produtor',
        status: 'ativo',
      },
      {
        id: QA_FIXTURE_IDS.producerUserTwo,
        organizacao_id: ORGANIZATION_ID,
        nome: '[QA] Produtor Dois',
        email: 'qa.produtor.2@qa.invalid',
        perfil: 'produtor',
        status: 'ativo',
      },
      {
        id: QA_FIXTURE_IDS.collaboratorUser,
        organizacao_id: ORGANIZATION_ID,
        nome: '[QA] Colaborador',
        email: 'qa.colaborador@qa.invalid',
        perfil: 'colaborador',
        status: 'ativo',
      },
    ];

    const credentialRows = await client.query<
      ExactFixtureRow & {
        readonly usuario_id: string;
        readonly senha_phc: string;
      }
    >(
      `
        SELECT
          id::text,
          organizacao_id,
          usuario_id::text,
          senha_phc,
          versao_politica_senha,
          status
        FROM public.credenciais_usuario
        WHERE id = ANY($1::uuid[])
      `,
      [[
        QA_FIXTURE_IDS.producerCredentialOne,
        QA_FIXTURE_IDS.producerCredentialTwo,
        QA_FIXTURE_IDS.collaboratorCredential,
      ]],
    );
    const expectedCredentials: readonly ExactFixtureRow[] = [
      {
        id: QA_FIXTURE_IDS.producerCredentialOne,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.producerUserOne,
        versao_politica_senha: credential.policyVersion,
        status: 'ativa',
      },
      {
        id: QA_FIXTURE_IDS.producerCredentialTwo,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.producerUserTwo,
        versao_politica_senha: credential.policyVersion,
        status: 'ativa',
      },
      {
        id: QA_FIXTURE_IDS.collaboratorCredential,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.collaboratorUser,
        versao_politica_senha: credential.policyVersion,
        status: 'ativa',
      },
    ];
    const credentialsWithoutHashes = credentialRows.rows.map(
      ({ senha_phc: _passwordHash, ...row }) => row,
    );
    const credentialsAreUsable = await Promise.all(
      credentialRows.rows.map(async (row) => {
        if (!row.senha_phc.startsWith('$argon2id$')) return false;
        return (await credentials.verify(config.password, row.senha_phc)).valid;
      }),
    );

    const producers = await client.query<ExactFixtureRow>(
      `
        SELECT id::text, organizacao_id, usuario_id::text, nome, status
        FROM public.produtores
        WHERE id = ANY($1::uuid[])
      `,
      [[QA_FIXTURE_IDS.producerOne, QA_FIXTURE_IDS.producerTwo]],
    );
    const expectedProducers: readonly ExactFixtureRow[] = [
      {
        id: QA_FIXTURE_IDS.producerOne,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.producerUserOne,
        nome: '[QA] Produtor Um',
        status: 'ativo',
      },
      {
        id: QA_FIXTURE_IDS.producerTwo,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.producerUserTwo,
        nome: '[QA] Produtor Dois',
        status: 'ativo',
      },
    ];

    const properties = await client.query<ExactFixtureRow>(
      `
        SELECT
          id::text,
          organizacao_id,
          titular_id::text,
          nome,
          municipio_id,
          municipio_nome,
          uf_id,
          uf_sigla,
          area_total::text AS area_total,
          cultura_principal,
          status
        FROM public.propriedades
        WHERE id = ANY($1::uuid[])
      `,
      [[
        QA_FIXTURE_IDS.activeProperty,
        QA_FIXTURE_IDS.secondProperty,
        QA_FIXTURE_IDS.inactiveProperty,
      ]],
    );
    const expectedProperties: readonly ExactFixtureRow[] = [
      {
        id: QA_FIXTURE_IDS.activeProperty,
        organizacao_id: ORGANIZATION_ID,
        titular_id: QA_FIXTURE_IDS.producerOne,
        nome: '[QA] Propriedade Ativa',
        municipio_id: '4306106',
        municipio_nome: 'Cruz Alta',
        uf_id: '43',
        uf_sigla: 'RS',
        area_total: '120.5000',
        cultura_principal: 'Soja',
        status: 'ativa',
      },
      {
        id: QA_FIXTURE_IDS.secondProperty,
        organizacao_id: ORGANIZATION_ID,
        titular_id: QA_FIXTURE_IDS.producerTwo,
        nome: '[QA] Propriedade Secundária',
        municipio_id: '4316907',
        municipio_nome: 'Santa Maria',
        uf_id: '43',
        uf_sigla: 'RS',
        area_total: '85.2500',
        cultura_principal: 'Milho',
        status: 'ativa',
      },
      {
        id: QA_FIXTURE_IDS.inactiveProperty,
        organizacao_id: ORGANIZATION_ID,
        titular_id: QA_FIXTURE_IDS.producerOne,
        nome: '[QA] Propriedade Inativa',
        municipio_id: '4205407',
        municipio_nome: 'Florianópolis',
        uf_id: '42',
        uf_sigla: 'SC',
        area_total: '42.7500',
        cultura_principal: null,
        status: 'inativa',
      },
    ];

    const links = await client.query<ExactFixtureRow>(
      `
        SELECT
          id::text,
          organizacao_id,
          usuario_id::text,
          propriedade_id::text,
          tipo_vinculo,
          status
        FROM public.usuario_propriedade
        WHERE id = ANY($1::uuid[])
      `,
      [[
        QA_FIXTURE_IDS.authorizedLink,
        QA_FIXTURE_IDS.collaboratorLinkOne,
        QA_FIXTURE_IDS.collaboratorLinkTwo,
      ]],
    );
    const expectedLinks: readonly ExactFixtureRow[] = [
      {
        id: QA_FIXTURE_IDS.authorizedLink,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.producerUserTwo,
        propriedade_id: QA_FIXTURE_IDS.activeProperty,
        tipo_vinculo: 'usuario_autorizado',
        status: 'ativo',
      },
      {
        id: QA_FIXTURE_IDS.collaboratorLinkOne,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.collaboratorUser,
        propriedade_id: QA_FIXTURE_IDS.activeProperty,
        tipo_vinculo: 'colaborador',
        status: 'ativo',
      },
      {
        id: QA_FIXTURE_IDS.collaboratorLinkTwo,
        organizacao_id: ORGANIZATION_ID,
        usuario_id: QA_FIXTURE_IDS.collaboratorUser,
        propriedade_id: QA_FIXTURE_IDS.secondProperty,
        tipo_vinculo: 'colaborador',
        status: 'ativo',
      },
    ];

    if (
      !rowsMatchExactly(users.rows, expectedUsers) ||
      !rowsMatchExactly(credentialsWithoutHashes, expectedCredentials) ||
      !credentialsAreUsable.every(Boolean) ||
      !rowsMatchExactly(producers.rows, expectedProducers) ||
      !rowsMatchExactly(properties.rows, expectedProperties) ||
      !rowsMatchExactly(links.rows, expectedLinks)
    ) {
      throw new Error('QA fixture verification failed.');
    }
    await client.query('COMMIT');
  } catch (error) {
    operationError = error;
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // A falha original continua sendo tratada genericamente pelo CLI.
      }
    }
    throw error;
  } finally {
    let cleanupError: unknown;
    try {
      client?.release();
    } catch (error) {
      cleanupError = error;
    }
    try {
      await pool.end();
    } catch (error) {
      cleanupError ??= error;
    }
    if (operationError === undefined && cleanupError !== undefined) {
      throw cleanupError;
    }
  }
}

async function main(): Promise<void> {
  try {
    await runQaFixtureLoader(process.env);
    process.stdout.write('Fixtures sintéticas de QA carregadas manualmente.\n');
  } catch (error) {
    const message =
      error instanceof QaFixtureGuardError
        ? error.message
        : 'Falha interna ao carregar fixtures de QA.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
