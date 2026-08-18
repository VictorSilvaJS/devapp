import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { DestinationStream } from 'pino';

import {
  createAppLogger,
  serializeError,
  serializeRequest,
} from '../../src/observability/logger.js';

describe('structured logging', () => {
  it('serializes requests using an allowlist and drops query values', () => {
    const serialized = serializeRequest({
      id: 'req_server',
      method: 'GET',
      url: '/v1/health?token=must-not-leak',
      hostname: 'localhost',
      remoteAddress: '127.0.0.1',
      headers: {
        authorization: 'Bearer must-not-leak',
        cookie: 'session=must-not-leak',
      },
      body: {
        password: 'must-not-leak',
      },
    });

    assert.deepEqual(serialized, {
      request_id: 'req_server',
      method: 'GET',
      path: '/v1/health',
      hostname: 'localhost',
      remote_address: '127.0.0.1',
    });
  });

  it('does not serialize raw error messages or stacks', () => {
    const error = Object.assign(
      new Error('password authentication failed for secret-user'),
      { code: '28P01' },
    );

    assert.deepEqual(serializeError(error), {
      type: 'Error',
      code: '28P01',
    });
  });

  it('redacts authentication and connection values defensively', () => {
    const lines: string[] = [];
    const destination: DestinationStream = {
      write(line: string) {
        lines.push(line);
        return true;
      },
    };
    const logger = createAppLogger('info', destination);

    logger.info(
      {
        event: 'redaction_test',
        authorization: 'Bearer authorization-secret',
        cookie: 'session=cookie-secret',
        password: 'password-secret',
        token: 'token-secret',
        connectionString: 'postgresql://connection-secret@db/prod',
        database: { host: 'private-db-host', password: 'nested-secret' },
        safe_value: 'visible',
      },
      'Redaction test.',
    );

    const output = lines.join('');
    assert.match(output, /visible/);
    assert.doesNotMatch(output, /authorization-secret/);
    assert.doesNotMatch(output, /cookie-secret/);
    assert.doesNotMatch(output, /password-secret/);
    assert.doesNotMatch(output, /token-secret/);
    assert.doesNotMatch(output, /connection-secret/);
    assert.doesNotMatch(output, /private-db-host/);
    assert.doesNotMatch(output, /nested-secret/);
  });
});
