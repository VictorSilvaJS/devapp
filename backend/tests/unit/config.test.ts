import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  ConfigurationError,
  buildDatabaseConfig,
  loadRuntimeConfig,
} from '../../src/config.js';

const developmentEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://backend:local@localhost:5432/tche_agro',
} as const;

describe('runtime configuration', () => {
  it('loads only known variables and applies safe defaults', () => {
    const config = loadRuntimeConfig({
      ...developmentEnvironment,
      UNRELATED_SECRET: 'must-not-be-copied',
    });

    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 3_000);
    assert.equal(config.logLevel, 'info');
    assert.equal(config.readinessTimeoutMs, 2_000);
    assert.equal(config.database.ssl, false);
    assert.equal('UNRELATED_SECRET' in config, false);
  });

  it('fails fast when required configuration is absent', () => {
    assert.throws(
      () => loadRuntimeConfig({ NODE_ENV: 'test' }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message === 'Invalid backend environment configuration.',
    );
  });

  it('rejects non-PostgreSQL and incomplete database URLs', () => {
    for (const databaseUrl of [
      'https://localhost/database',
      'postgresql://localhost',
      'not-a-url',
    ]) {
      assert.throws(
        () =>
          buildDatabaseConfig({
            nodeEnv: 'development',
            databaseUrl,
          }),
        ConfigurationError,
      );
    }
  });

  it('rejects a URL fragment and TCP port zero before startup', () => {
    for (const databaseUrl of [
      'postgresql://backend:secret@db:5432/prod#truncated',
      'postgresql://backend:secret@db:0/prod',
    ]) {
      assert.throws(
        () =>
          buildDatabaseConfig({
            nodeEnv: 'production',
            databaseUrl,
          }),
        ConfigurationError,
      );
    }
  });

  it('rejects every connection-string query parameter deterministically', () => {
    const parameters = [
      'ssl=0',
      'ssl=no-verify',
      'sslmode=require',
      'sslcert=client.pem',
      'sslkey=client.key',
      'sslrootcert=root.pem',
      'sslpassword=secret-value',
      'sslnegotiation=direct',
      'uselibpqcompat=true',
      'SSLMODE=verify-full',
      'SSL=true',
      'options=-csearch_path%3Devil%2Cpublic',
      'port=not-a-port',
      'application_name=untrusted-name',
      'statement_timeout=0',
    ];

    for (const parameter of parameters) {
      assert.throws(
        () =>
          buildDatabaseConfig({
            nodeEnv: 'production',
            databaseUrl: `postgresql://backend:secret@db/prod?${parameter}`,
          }),
        (error: unknown) =>
          error instanceof ConfigurationError &&
          !error.message.includes('secret-value'),
      );
    }
  });

  it('requires certificate verification in production using system roots', () => {
    const config = buildDatabaseConfig({
      nodeEnv: 'production',
      databaseUrl: 'postgresql://backend:secret@db/prod',
    });

    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  });

  it('normalizes an optional trusted CA and never disables verification', () => {
    const trustedCa = rootCertificates[0];
    assert.ok(trustedCa);
    const config = buildDatabaseConfig({
      nodeEnv: 'production',
      databaseUrl: 'postgresql://backend:secret@db/prod',
      certificateAuthority: trustedCa.replaceAll('\n', '\\n'),
    });

    assert.deepEqual(config.ssl, {
      rejectUnauthorized: true,
      ca: trustedCa,
    });
  });

  it('rejects a malformed optional CA before startup', () => {
    assert.throws(
      () =>
        buildDatabaseConfig({
          nodeEnv: 'production',
          databaseUrl: 'postgresql://backend:secret@db/prod',
          certificateAuthority:
            '-----BEGIN CERTIFICATE-----\nnot-base64\n-----END CERTIFICATE-----',
        }),
      ConfigurationError,
    );
  });
});
