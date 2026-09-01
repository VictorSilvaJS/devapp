import { strict as assert } from 'node:assert';
import { fork, type ChildProcess } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

interface WorkerMessage {
  readonly type: 'started' | 'stopped' | 'error';
  readonly containerId?: string;
  readonly hostPort?: number;
  readonly databaseName?: string;
  readonly startBeganAt?: number;
  readonly startedAt?: number;
  readonly message?: string;
}

function waitForMessage(child: ChildProcess, expected: WorkerMessage['type']): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout aguardando worker ${expected}.`)), 150_000);
    const onExit = (code: number | null) => reject(new Error(`Worker encerrou antes de ${expected}: ${code}.`));
    const onMessage = (message: WorkerMessage) => {
      if (message.type === 'error') {
        cleanup(); reject(new Error(message.message ?? 'Worker falhou.')); return;
      }
      if (message.type !== expected) return;
      cleanup(); resolve(message);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off('exit', onExit);
      child.off('message', onMessage);
    };
    child.once('exit', onExit);
    child.on('message', onMessage);
  });
}

describe('Testcontainers com portas dinâmicas', { timeout: 180_000 }, () => {
  test('três processos sobem simultaneamente sem mutex, porta fixa ou EADDRINUSE', async () => {
    const helperSource = await readFile(new URL('./test-database.ts', import.meta.url), 'utf8');
    for (const forbidden of [
      'CONTAINER_START_LOCK', 'reserveAvailableHostPort', 'createServer(',
      'stat(', 'unlink(', 'host:', 'TESTCONTAINERS_RYUK_PORT',
    ]) assert.equal(helperSource.includes(forbidden), false, forbidden);
    assert.match(helperSource, /withExposedPorts\(5432\)/u);
    assert.match(helperSource, /getMappedPort\(5432\)/u);

    const workerPath = fileURLToPath(new URL('./test-database.worker.ts', import.meta.url));
    const children = Array.from({ length: 3 }, () => fork(workerPath, [], {
      execArgv: ['--import=tsx'],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { ...process.env, NODE_ENV: 'test', ALLOW_DESTRUCTIVE_DATABASE_TESTS: 'true' },
    }));
    const stderr = new Map(children.map((child) => [child.pid, '']));
    for (const child of children) child.stderr?.on('data', (chunk: Buffer) => {
      stderr.set(child.pid, `${stderr.get(child.pid) ?? ''}${chunk.toString('utf8')}`);
    });
    try {
      const started = await Promise.all(children.map((child) => waitForMessage(child, 'started')));
      assert.equal(new Set(started.map((item) => item.hostPort)).size, children.length);
      assert.equal(new Set(started.map((item) => item.containerId)).size, children.length);
      assert.equal(new Set(started.map((item) => item.databaseName)).size, children.length);
      assert.ok(Math.max(...started.map((item) => item.startBeganAt ?? Number.POSITIVE_INFINITY))
        < Math.min(...started.map((item) => item.startedAt ?? Number.NEGATIVE_INFINITY)),
      'os três processos devem iniciar o start antes de qualquer um terminar');
      assert.equal(children.every((child) => child.exitCode === null), true);
      assert.equal([...stderr.values()].some((value) => value.includes('EADDRINUSE')), false);
      await assert.rejects(access(join(tmpdir(), 'tche-agro-testcontainer-start.lock')),
        (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT');

      const stopped = children.map((child) => waitForMessage(child, 'stopped'));
      const exited = children.map((child) => new Promise<void>((resolve, reject) => {
        child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}.`)));
      }));
      for (const child of children) child.send({ type: 'stop' });
      await Promise.all(stopped);
      await Promise.all(exited);
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill('SIGTERM');
      }
    }
  });
});
