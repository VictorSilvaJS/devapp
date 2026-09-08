import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';
import { runMigrations } from '../../scripts/migrate.js';
import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { startPostgisTestDatabase } from './test-database.js';

const ORG = 'org_tche_fertilidade';
const signature = 'public.tche_admin_emitir_convite_usuario_mp35b(jsonb)';
const sql = await readFile(new URL('../../migrations/000010-alinhar-recibo-convite-administrativo.sql', import.meta.url), 'utf8');
const upSql = sql.split('-- Down Migration')[0]!;

async function withDatabase(run: (ctx: {
  owner: Pool; runtime: Pool; runtimeRole: string;
  database: Awaited<ReturnType<typeof startPostgisTestDatabase>>['database'];
  actorId: string; sessionId: string;
}) => Promise<void>) {
  assertDestructiveDatabaseTestsAllowed('postgresql://guard:guard@localhost/tche_agro_test');
  const started = await startPostgisTestDatabase();
  assertDestructiveDatabaseTestsAllowed(started.connectionString);
  const owner = new Pool(buildPostgresPoolConfig(started.database));
  let runtime: Pool | undefined;
  try {
    await runMigrations({ command: 'up', count: 9, database: started.database });
    const runtimeRole = `receipt_runtime_${randomUUID().replaceAll('-', '')}`;
    const password = randomBytes(24).toString('hex');
    await owner.query(`CREATE ROLE ${runtimeRole} LOGIN PASSWORD '${password}';
      GRANT tche_agro_runtime TO ${runtimeRole}`);
    const url = new URL(started.connectionString);
    url.username = runtimeRole;
    url.password = password;
    runtime = new Pool({ connectionString: url.toString() });
    const actorId = randomUUID();
    const sessionId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status)
      VALUES ($1,$2,'Admin teste',$3,'admin','ativo')`,
    [actorId, ORG, `${actorId}@example.test`]);
    await owner.query(`INSERT INTO public.sessoes_autenticacao
      (id,organizacao_id,usuario_id,versao_autorizacao,expira_inatividade_em,expira_absolutamente_em)
      VALUES ($1,$2,$3,1,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day')`,
    [sessionId, ORG, actorId]);
    await run({ owner, runtime, runtimeRole, actorId, sessionId, database: started.database });
  } finally {
    await runtime?.end();
    await owner.end();
    await started.container.stop();
  }
}

async function snapshot(pool: Pool) {
  return (await pool.query(`SELECT
    (SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'oid',p.oid,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,
      'config',p.proconfig,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'tche_%') AS functions,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conname='ck_comandos_administrativos_recibo') AS receipt_constraint,
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.comandos_administrativos_idempotencia i) AS receipts,
    (SELECT count(*)::int FROM public.tche_agro_migrations) AS migrations`)).rows[0];
}

async function assertPrivileges(runtime: Pool, owner: Pool, role: string) {
  assert.equal((await runtime.query('SELECT SESSION_USER AS role')).rows[0].role, role);
  const fn = (await owner.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef,
    proconfig,has_function_privilege($1,oid,'EXECUTE') AS runtime_execute,
    EXISTS (SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_proc WHERE oid=$2::regprocedure`, [role, signature])).rows[0];
  assert.deepEqual(fn, { owner: 'tche_agro_administration_owner', prosecdef: true,
    proconfig: ['search_path=pg_catalog, public'], runtime_execute: true, public_execute: false });
  for (const table of ['usuarios', 'produtores', 'comandos_administrativos_idempotencia']) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      const flags = (await owner.query(`SELECT has_table_privilege($1,$2,$3) AS allowed`,
        [role, `public.${table}`, privilege])).rows[0];
      assert.equal(flags.allowed, false, `${table} ${privilege}`);
    }
    await assert.rejects(runtime.query(`DELETE FROM public.${table} WHERE false`), { code: '42501' });
  }
  await assert.rejects(runtime.query(`UPDATE public.usuarios SET nome='indevido' WHERE false`), { code: '42501' });
  await assert.rejects(runtime.query(`INSERT INTO public.usuarios (nome) VALUES ('indevido')`), { code: '42501' });
  await assert.rejects(runtime.query(`SELECT public.tche_admin_concluir_comando_mp35b('{}','usuario.emitir_convite',201,'{}')`), { code: '42501' });
}

test('000010 up/down/up real e falha após DDL preservam definições, OIDs, owners e ACLs', { timeout: 180_000 }, async () => {
  await withDatabase(async ({ owner, runtime, runtimeRole, database }) => {
    const before = await snapshot(owner);
    const client = await owner.connect();
    try {
      await client.query('BEGIN');
      await client.query(upSql);
      await assert.rejects(client.query('SELECT 1/0'), { code: '22012' });
      await client.query('ROLLBACK');
    } finally { client.release(); }
    assert.deepEqual(await snapshot(owner), before);
    await runMigrations({ command: 'up', count: 1, database });
    const up = await snapshot(owner);
    assert.equal(up.migrations, 10);
    for (let i = 0; i < before.functions.length; i++) {
      const original = before.functions[i];
      const changed = up.functions[i];
      if (original.signature === signature.replace('public.', '')) {
        assert.notEqual(changed.definition, original.definition);
        assert.deepEqual({ ...changed, definition: original.definition }, original);
      } else assert.deepEqual(changed, original);
    }
    await assertPrivileges(runtime, owner, runtimeRole);
    await runMigrations({ command: 'down', count: 1, database });
    assert.deepEqual(await snapshot(owner), before);
    await assertPrivileges(runtime, owner, runtimeRole);
    await runMigrations({ command: 'up', count: 1, database });
    const reapplied = await snapshot(owner);
    assert.deepEqual(reapplied.functions, up.functions);
    assert.equal(reapplied.receipt_constraint, up.receipt_constraint);
    await assertPrivileges(runtime, owner, runtimeRole);
  });
});

for (const days of [1, 89, 91]) {
  test(`000010 bloqueia atomicamente recibo legado de ${days} dias e preserva replay exato`, { timeout: 180_000 }, async () => {
    await withDatabase(async ({ owner, runtime, database, actorId, sessionId }) => {
      const legacy = { outcome: 'convite_emitido', resourceType: 'convite', resourceId: randomUUID() };
      await owner.query(`INSERT INTO public.comandos_administrativos_idempotencia
        (organizacao_id,ator_usuario_id,sessao_id,request_id,correlation_id,chave_idempotencia_hash,
         comando,hash_requisicao,status,codigo_http,recibo,criado_em,concluido_em,expira_em)
        SELECT $1,$2,$3,'legacy','legacy',decode(repeat('a',64),'hex'),
          'usuario.emitir_convite',decode(repeat('b',64),'hex'),'concluido',201,$4,
          t,t,t+interval '90 days' FROM (SELECT clock_timestamp()-($5*interval '1 day') AS t) d`,
      [ORG, actorId, sessionId, legacy, days]);
      const input = { organizacao_id: ORG, ator_usuario_id: actorId, sessao_id: sessionId,
        ator_versao_autorizacao: 1, request_id: 'replay', correlation_id: 'replay',
        chave_idempotencia_hash: 'a'.repeat(64), hash_requisicao: 'b'.repeat(64) };
      const replay = async () => (await runtime.query(`SELECT * FROM ${signature.split('(')[0]}($1::jsonb)`,
        [JSON.stringify(input)])).rows;
      const before = await snapshot(owner);
      assert.deepEqual(await replay(), [{ status: 'replayed', codigo_http: 201, recibo: legacy }]);
      await assert.rejects(runMigrations({ command: 'up', count: 1, database }),
        /Recibos de convite retidos impedem o upgrade seguro/);
      assert.deepEqual(await snapshot(owner), before);
      assert.deepEqual(await replay(), [{ status: 'replayed', codigo_http: 201, recibo: legacy }]);
      const conflict = await runtime.query(`SELECT * FROM ${signature.split('(')[0]}($1::jsonb)`,
        [JSON.stringify({ ...input, hash_requisicao: 'c'.repeat(64) })]);
      assert.deepEqual(conflict.rows, [{ status: 'idempotency_conflict', codigo_http: null, recibo: null }]);
    });
  });
}

test('000010 down bloqueado preserva recibo novo e replay; SQL recusa formato legado', { timeout: 180_000 }, async () => {
  await withDatabase(async ({ owner, runtime, database, actorId, sessionId }) => {
    await runMigrations({ command: 'up', count: 1, database });
    const receipt = { outcome: 'convite_emitido', resourceType: 'usuario', resourceId: actorId, version: 1 };
    const insert = (value: unknown) => owner.query(`INSERT INTO public.comandos_administrativos_idempotencia
      (organizacao_id,ator_usuario_id,sessao_id,request_id,correlation_id,chave_idempotencia_hash,
       comando,hash_requisicao,status,codigo_http,recibo,criado_em,concluido_em,expira_em)
      SELECT $1,$2,$3,'new','new',decode(repeat('a',64),'hex'),
        'usuario.emitir_convite',decode(repeat('b',64),'hex'),'concluido',201,$4,
        t,t,t+interval '90 days' FROM (SELECT clock_timestamp() AS t) d`,
    [ORG, actorId, sessionId, value]);
    for (const invalid of [
      { outcome: 'convite_emitido', resourceType: 'convite', resourceId: actorId },
      { ...receipt, version: null }, { ...receipt, version: 0 }, { ...receipt, version: 1.5 },
      { ...receipt, version: '1' }, { ...receipt, token: 'proibido' },
    ]) await assert.rejects(insert(invalid), { code: '23514', constraint: 'ck_comandos_administrativos_recibo' });
    await insert(receipt);
    const before = await snapshot(owner);
    await assert.rejects(runMigrations({ command: 'down', count: 1, database }),
      /Recibos de convite retidos impedem o downgrade seguro/);
    assert.deepEqual(await snapshot(owner), before);
    const replay = await runtime.query(`SELECT * FROM ${signature.split('(')[0]}($1::jsonb)`,
      [JSON.stringify({ organizacao_id: ORG, ator_usuario_id: actorId, sessao_id: sessionId,
        ator_versao_autorizacao: 1, request_id: 'replay', correlation_id: 'replay',
        chave_idempotencia_hash: 'a'.repeat(64), hash_requisicao: 'b'.repeat(64) })]);
    assert.deepEqual(replay.rows, [{ status: 'replayed', codigo_http: 201, recibo: receipt }]);
  });
});
