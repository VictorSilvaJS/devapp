import type { FastifyBaseLogger } from 'fastify';
import type {
  QueryConfig,
  QueryResult,
  QueryResultRow,
} from 'pg';
import type { DestinationStream } from 'pino';

import { loadRuntimeConfig } from '../../src/config.js';
import type { DatabasePool } from '../../src/database/pool.js';
import { createAppLogger } from '../../src/observability/logger.js';

export const testConfig = loadRuntimeConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://backend:local@localhost/tche_agro_test',
  LOG_LEVEL: 'info',
});

export type DatabaseStep = Error | string | null | 'never';

export class SequenceDatabase implements DatabasePool {
  public readonly queries: QueryConfig[] = [];
  readonly #steps: DatabaseStep[];

  public constructor(steps: DatabaseStep[]) {
    this.#steps = [...steps];
  }

  public async query<Row extends QueryResultRow>(
    query: QueryConfig,
  ): Promise<QueryResult<Row>> {
    this.queries.push(query);
    const step = this.#steps.shift();

    if (step instanceof Error) {
      throw step;
    }

    if (step === 'never') {
      return new Promise<QueryResult<Row>>(() => undefined);
    }

    const result: QueryResult<QueryResultRow> = {
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [{ postgis_version: step ?? null }],
    };
    return result as QueryResult<Row>;
  }

  public async end(): Promise<void> {}
}

export function capturedLogger(): {
  readonly logger: FastifyBaseLogger;
  readonly output: () => string;
} {
  const lines: string[] = [];
  const destination: DestinationStream = {
    write(line: string) {
      lines.push(line);
      return true;
    },
  };

  return {
    logger: createAppLogger('info', destination) as FastifyBaseLogger,
    output: () => lines.join(''),
  };
}
