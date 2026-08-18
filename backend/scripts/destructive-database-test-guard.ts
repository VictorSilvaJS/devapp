export interface DestructiveDatabaseTestEnvironment {
  NODE_ENV?: string;
  ALLOW_DESTRUCTIVE_DATABASE_TESTS?: string;
}

export class DestructiveDatabaseTestGuardError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DestructiveDatabaseTestGuardError';
  }
}

export function databaseNameFromConnectionString(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new DestructiveDatabaseTestGuardError(
      'A URL do banco destrutivo e invalida.',
    );
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new DestructiveDatabaseTestGuardError(
      'A URL do banco destrutivo deve usar postgres ou postgresql.',
    );
  }

  const encodedName = parsed.pathname.replace(/^\//, '');
  if (encodedName.length === 0 || encodedName.includes('/')) {
    throw new DestructiveDatabaseTestGuardError(
      'A URL do banco destrutivo deve identificar um unico banco.',
    );
  }

  try {
    return decodeURIComponent(encodedName);
  } catch {
    throw new DestructiveDatabaseTestGuardError(
      'O nome do banco destrutivo possui codificacao invalida.',
    );
  }
}

export function assertDestructiveDatabaseTestsAllowed(
  connectionString: string,
  environment: DestructiveDatabaseTestEnvironment = process.env,
): void {
  const databaseName = databaseNameFromConnectionString(connectionString);
  const failures: string[] = [];

  if (environment.NODE_ENV !== 'test') {
    failures.push('NODE_ENV=test');
  }
  if (!databaseName.endsWith('_test')) {
    failures.push('nome do banco terminado em _test');
  }
  if (environment.ALLOW_DESTRUCTIVE_DATABASE_TESTS !== 'true') {
    failures.push('ALLOW_DESTRUCTIVE_DATABASE_TESTS=true');
  }

  if (failures.length > 0) {
    throw new DestructiveDatabaseTestGuardError(
      `Teste destrutivo bloqueado; requisitos ausentes: ${failures.join(', ')}.`,
    );
  }
}
