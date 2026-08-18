import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import SwaggerParser from '@apidevtools/swagger-parser';

import { buildApp } from '../../src/app.js';
import { SequenceDatabase, testConfig } from './helpers.js';

describe('HTTP health and OpenAPI', () => {
  it('serves health without consulting PostgreSQL and replaces client IDs', async () => {
    const database = new SequenceDatabase([
      new Error('health must never execute this query'),
    ]);
    const app = await buildApp({
      config: testConfig,
      database,
      logger: false,
      requestIdFactory: () => 'req_server_generated',
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
        headers: {
          'x-request-id': 'req_client_controlled',
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { status: 'ok' });
      assert.equal(response.headers['x-request-id'], 'req_server_generated');
      assert.equal(database.queries.length, 0);
    } finally {
      await app.close();
    }
  });

  it('publishes OpenAPI JSON without installing a documentation UI', async () => {
    const app = await buildApp({
      config: testConfig,
      database: new SequenceDatabase([]),
      logger: false,
    });

    try {
      const openapiResponse = await app.inject({
        method: 'GET',
        url: '/v1/openapi.json',
      });
      const document = openapiResponse.json<{
        openapi: string;
        paths: Record<string, unknown>;
      }>();

      assert.equal(openapiResponse.statusCode, 200);
      assert.equal(document.openapi, '3.1.0');
      assert.ok(document.paths['/v1/health']);
      assert.ok(document.paths['/v1/readiness']);
      assert.equal(document.paths['/v1/openapi.json'], undefined);
      await SwaggerParser.validate(JSON.parse(openapiResponse.payload));

      const uiResponse = await app.inject({ method: 'GET', url: '/docs' });
      assert.equal(uiResponse.statusCode, 404);
      assert.equal(uiResponse.json().error.code, 'not_found');
    } finally {
      await app.close();
    }
  });
});
