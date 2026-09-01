import { strict as assert } from 'node:assert';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { Pool, type QueryResult } from 'pg';

import { assertDestructiveDatabaseTestsAllowed } from '../../scripts/destructive-database-test-guard.js';
import { runMigrations } from '../../scripts/migrate.js';
import type { AuthenticatedPrincipal } from '../../src/auth/contracts.js';
import { PostgresAuthRepository } from '../../src/auth/postgres-auth-repository.js';
import { ADMINISTRATIVE_SENSITIVE_TERMS } from '../../src/administration/contracts.js';
import type { Mp35cCommandIdentity } from '../../src/administration/mp35c-contracts.js';
import {
  executeMp35cMutationTransaction,
  PostgresMp35cRepository,
} from '../../src/administration/postgres-mp35c-repository.js';
import { buildPostgresPoolConfig } from '../../src/database/pool.js';
import { OutboxPayloadCipher } from '../../src/outbox/crypto.js';
import { EncryptedEmailOutboxFactory } from '../../src/outbox/email-message.js';
import { HttpError } from '../../src/security/http-error.js';
import { startPostgisTestDatabase, type StartedPostgisTestDatabase } from './test-database.js';

const ORGANIZATION_ID = 'org_tche_fertilidade' as const;
const MUNICIPALITY_ID = '4305108';

function digest(value: string): Buffer { return createHash('sha256').update(value).digest(); }

describe('PostgresMp35cRepository', { timeout: 180_000 }, () => {
  let database: StartedPostgisTestDatabase | undefined;
  let owner: Pool | undefined;
  let runtime: Pool | undefined;
  let runtimeRole: string | undefined;
  let repository: PostgresMp35cRepository | undefined;
  let admin: AuthenticatedPrincipal | undefined;
  let holderUserId = '';
  let holderId = '';
  let collaboratorId = '';

  before(async () => {
    assertDestructiveDatabaseTestsAllowed('postgresql://guard:guard@127.0.0.1:5432/tche_agro_test');
    database = await startPostgisTestDatabase();
    await runMigrations({ command: 'up', database: database.database });
    owner = new Pool(buildPostgresPoolConfig(database.database));
    const adminId = randomUUID(); const adminSession = randomUUID();
    holderUserId = randomUUID(); holderId = randomUUID(); collaboratorId = randomUUID();
    const now = new Date();
    await owner.query('BEGIN');
    try {
      await owner.query(`INSERT INTO public.usuarios
        (id, organizacao_id, nome, email, perfil, status) VALUES
        ($1,$4,'Admin MP35C',$5,'admin','ativo'),
        ($2,$4,'Titular MP35C',$6,'produtor','ativo'),
        ($3,$4,'Colaborador MP35C',$7,'colaborador','ativo')`,
        [adminId, holderUserId, collaboratorId, ORGANIZATION_ID,
          `admin-${adminId}@example.test`, `holder-${holderUserId}@example.test`,
          `collab-${collaboratorId}@example.test`]);
      await owner.query(`INSERT INTO public.produtores
        (id, organizacao_id, usuario_id, nome, status)
        VALUES ($1,$2,$3,'Titular MP35C','ativo')`,
        [holderId, ORGANIZATION_ID, holderUserId]);
      for (const [userId, sessionId] of [[adminId, adminSession],
        [holderUserId, randomUUID()], [holderUserId, randomUUID()],
        [collaboratorId, randomUUID()]] as const) {
        await owner.query(`INSERT INTO public.sessoes_autenticacao
          (id, organizacao_id, usuario_id, versao_autorizacao, criada_em,
           ultima_renovacao_em, expira_inatividade_em, expira_absolutamente_em)
          VALUES ($1,$2,$3,1,$4,$4,$5,$6)`, [sessionId, ORGANIZATION_ID, userId, now,
          new Date(now.getTime() + 3_600_000), new Date(now.getTime() + 86_400_000)]);
        await owner.query(`INSERT INTO public.tokens_acesso
          (organizacao_id,sessao_id,token_hash,versao_autorizacao,expira_em)
          VALUES ($1,$2,$3,1,$4)`, [ORGANIZATION_ID, sessionId, randomBytes(32),
          new Date(now.getTime() + 900_000)]);
        await owner.query(`INSERT INTO public.tokens_refresh
          (organizacao_id,sessao_id,token_hash,expira_em) VALUES ($1,$2,$3,$4)`,
          [ORGANIZATION_ID, sessionId, randomBytes(32), new Date(now.getTime() + 86_400_000)]);
      }
      await owner.query('COMMIT');
    } catch (error) { await owner.query('ROLLBACK'); throw error; }
    admin = { id: adminId, organizationId: ORGANIZATION_ID, name: 'Admin MP35C',
      email: `admin-${adminId}@example.test`, profile: 'admin', status: 'ativo',
      authorizationVersion: 1, sessionId: adminSession };
    runtimeRole = `tche_test_runtime_mp35c_${randomUUID().replaceAll('-', '')}`;
    const password = randomBytes(24).toString('hex');
    await owner.query(`CREATE ROLE ${runtimeRole} LOGIN PASSWORD '${password}'`);
    await owner.query(`GRANT tche_agro_runtime TO ${runtimeRole}`);
    const url = new URL(database.connectionString); url.username = runtimeRole; url.password = password;
    runtime = new Pool({ ...buildPostgresPoolConfig(database.database),
      connectionString: url.toString(), application_name: runtimeRole });
    repository = new PostgresMp35cRepository(runtime);
  });

  after(async () => {
    await runtime?.end();
    if (owner !== undefined && runtimeRole !== undefined) await owner.query(`DROP ROLE IF EXISTS ${runtimeRole}`);
    await owner?.end(); await database?.container.stop();
  });

  function repo() { assert.ok(repository); return repository; }
  function actor() { assert.ok(admin); return admin; }
  async function createSession(userId: string, authorizationVersion: number): Promise<string> {
    assert.ok(owner); const sessionId = randomUUID(); const now = new Date();
    await owner.query(`INSERT INTO public.sessoes_autenticacao
      (id,organizacao_id,usuario_id,versao_autorizacao,criada_em,ultima_renovacao_em,
       expira_inatividade_em,expira_absolutamente_em)
      VALUES ($1,$2,$3,$4,$5,$5,$6,$7)`, [sessionId, ORGANIZATION_ID, userId,
      authorizationVersion, now, new Date(now.getTime() + 3_600_000),
      new Date(now.getTime() + 86_400_000)]);
    await owner.query(`INSERT INTO public.tokens_acesso
      (organizacao_id,sessao_id,token_hash,versao_autorizacao,expira_em)
      VALUES ($1,$2,$3,$4,$5)`, [ORGANIZATION_ID, sessionId, randomBytes(32),
      authorizationVersion, new Date(now.getTime() + 900_000)]);
    await owner.query(`INSERT INTO public.tokens_refresh
      (organizacao_id,sessao_id,token_hash,expira_em) VALUES ($1,$2,$3,$4)`,
      [ORGANIZATION_ID, sessionId, randomBytes(32), new Date(now.getTime() + 86_400_000)]);
    return sessionId;
  }
  function identity<Command extends Mp35cCommandIdentity['command']>(command: Command, label: string):
    Mp35cCommandIdentity & { readonly command: Command } {
    const principal = actor();
    return { sessionId: principal.sessionId, requestId: `request-${label}`,
      correlationId: `correlation-${label}`, idempotencyKeyHash: digest(`key-${label}`),
      requestHash: digest(`request-${command}-${label}`), command };
  }
  function sqlContext(label: string, sessionId = actor().sessionId) {
    return { sessao_id: sessionId, request_id: `request-${label}`,
      correlation_id: `correlation-${label}`,
      chave_idempotencia_hash: digest(`key-${label}`).toString('hex'),
      hash_requisicao: digest(`request-${label}`).toString('hex') };
  }
  function mp35bContext(label: string, principal = actor()) {
    return { organizacao_id: principal.organizationId, ator_usuario_id: principal.id,
      sessao_id: principal.sessionId,
      ator_versao_autorizacao: principal.authorizationVersion,
      request_id: `request-${label}`, correlation_id: `correlation-${label}`,
      chave_idempotencia_hash: digest(`key-${label}`).toString('hex'),
      hash_requisicao: digest(`request-${label}`).toString('hex') };
  }
  function authRepository() {
    assert.ok(runtime);
    return new PostgresAuthRepository({ pool: runtime,
      emailHmacKey: Buffer.alloc(32, 0x41),
      recoveryOutboxFactory: new EncryptedEmailOutboxFactory(
        new OutboxPayloadCipher({ activeKeyId: 'mp35c-auth-test', keys: [{
          id: 'mp35c-auth-test', key: Buffer.alloc(32, 0x42),
        }] }),
      ), recoveryActionBaseUrl: 'https://example.test/auth/action' });
  }
  async function observedOrganizationPair<Left, Right>(
    start: () => readonly [Promise<Left>, Promise<Right>],
  ): Promise<readonly [Left, Right]> {
    assert.ok(owner); assert.ok(runtimeRole);
    const blocker = await owner.connect(); let held = false;
    try {
      await blocker.query(`SELECT pg_catalog.pg_advisory_lock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      held = true;
      const operations = start();
      const deadline = Date.now() + 5_000;
      let waits: readonly { pid: number; wait_event: string }[] = [];
      while (Date.now() < deadline && waits.length < 2) {
        const activity = await owner.query<{ pid: number; wait_event: string }>(`
          SELECT pid,wait_event FROM pg_catalog.pg_stat_activity
          WHERE application_name=$1 AND state='active' AND wait_event_type='Lock'
            AND wait_event='advisory' ORDER BY pid`, [runtimeRole]);
        waits = activity.rows;
        if (waits.length < 2) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waits.length, 2);
      assert.equal(new Set(waits.map((wait) => wait.pid)).size, 2);
      await blocker.query(`SELECT pg_catalog.pg_advisory_unlock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      held = false;
      return Promise.all(operations);
    } finally {
      if (held) await blocker.query(`SELECT pg_catalog.pg_advisory_unlock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      blocker.release();
    }
  }

  async function waitForAdvisoryPids(pids: readonly number[], minimum: number) {
    assert.ok(owner);
    const deadline = Date.now() + 5_000;
    let rows: readonly { pid: number; query: string; wait_event_type: string;
      wait_event: string }[] = [];
    while (Date.now() < deadline && rows.length < minimum) {
      const activity = await owner.query<{ pid: number; query: string;
        wait_event_type: string; wait_event: string }>(`SELECT pid,query,wait_event_type,wait_event
        FROM pg_catalog.pg_stat_activity WHERE pid=ANY($1::integer[])
          AND state='active' AND wait_event_type='Lock' AND wait_event='advisory'
        ORDER BY pid`, [pids]);
      rows = activity.rows;
      if (rows.length < minimum) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(rows.length, minimum,
      `esperados ${minimum} PIDs em wait advisory; observados ${rows.length}`);
    assert.equal(new Set(rows.map((row) => row.pid)).size, rows.length);
    return rows;
  }

  async function runHolderStatusRace(
    order: 'activation_first' | 'deactivation_first', repetition: number,
  ): Promise<void> {
    assert.ok(owner); assert.ok(runtime);
    const producerUserId = randomUUID(); const producerId = randomUUID();
    const propertyId = randomUUID(); const label = `${order}-${repetition}`;
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,$3,$4,'produtor','ativo')`, [producerUserId, ORGANIZATION_ID,
      `Produtor corrida ${label}`, `producer-race-${label}-${producerUserId}@example.test`]);
    await owner.query(`INSERT INTO public.produtores
      (id,organizacao_id,usuario_id,nome,status) VALUES
      ($1,$2,$3,$4,'ativo')`,
    [producerId, ORGANIZATION_ID, producerUserId, `Produtor corrida ${label}`]);
    await owner.query(`INSERT INTO public.propriedades
      (id,organizacao_id,titular_id,nome,localidades_versao_id,municipio_id,
       municipio_nome,uf_id,uf_sigla,status) VALUES
      ($1,$2,$3,$4,'ibge-localidades-2026-08-25',$5,
       'Caxias do Sul','43','RS','inativa')`,
    [propertyId, ORGANIZATION_ID, producerId, `Corrida ${label}`, MUNICIPALITY_ID]);
    const targetSessionId = await createSession(producerUserId, 1);
    const activationLabel = `holder-race-${label}-activate`;
    const deactivationLabel = `holder-race-${label}-deactivate`;
    const activationPayload = { ...sqlContext(activationLabel), propriedade_id: propertyId,
      versao: 1, status: 'ativa', motivo: 'correcao_administrativa' };
    const deactivationPayload = { ...mp35bContext(deactivationLabel),
      usuario_id: producerUserId, versao: order === 'activation_first' ? 2 : 1,
      status: 'inativo',
      motivo: 'suspensao_operacional' };
    const gate = 35_010_000 + (order === 'activation_first' ? 100 : 200) + repetition;
    const suffix = `${order}_${repetition}`;
    const triggerName = `tche_test_pause_holder_${suffix}`;
    const functionName = `tche_test_pause_holder_${suffix}`;
    const table = order === 'activation_first' ? 'propriedades' : 'produtores';
    const targetId = order === 'activation_first' ? propertyId : producerId;
    const targetStatus = order === 'activation_first' ? 'ativa' : 'inativo';
    await owner.query(`CREATE FUNCTION public.${functionName}()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${targetId}'::uuid AND NEW.status='${targetStatus}' THEN
          PERFORM pg_catalog.pg_advisory_xact_lock(${gate}::bigint);
        END IF; RETURN NEW; END $$`);
    await owner.query(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON public.${table}
      FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`);
    const blocker = await owner.connect();
    const activationClient = await runtime.connect();
    const deactivationClient = await runtime.connect();
    let gateHeld = false;
    try {
      await blocker.query('SELECT pg_catalog.pg_advisory_lock($1::bigint)', [gate]);
      gateHeld = true;
      const activationPid = (await activationClient.query<{ pid: number }>(
        'SELECT pg_catalog.pg_backend_pid() AS pid')).rows[0]?.pid;
      const deactivationPid = (await deactivationClient.query<{ pid: number }>(
        'SELECT pg_catalog.pg_backend_pid() AS pid')).rows[0]?.pid;
      assert.ok(activationPid); assert.ok(deactivationPid);
      assert.notEqual(activationPid, deactivationPid);
      let activationOperation: Promise<QueryResult<{ status: string }>>;
      let deactivationOperation: Promise<QueryResult<{ status: string }>>;
      if (order === 'activation_first') {
        activationOperation = activationClient.query<{ status: string }>(`SELECT * FROM
          public.tche_admin_alterar_status_propriedade_mp35c($1::jsonb)`,
        [JSON.stringify(activationPayload)]);
        const firstWait = await waitForAdvisoryPids([activationPid], 1);
        assert.ok(firstWait[0]?.query.includes('tche_admin_alterar_status_propriedade_mp35c'));
        deactivationOperation = deactivationClient.query<{ status: string }>(`SELECT * FROM
          public.tche_admin_alterar_status_usuario_mp35b($1::jsonb)`,
        [JSON.stringify(deactivationPayload)]);
      } else {
        deactivationOperation = deactivationClient.query<{ status: string }>(`SELECT * FROM
          public.tche_admin_alterar_status_usuario_mp35b($1::jsonb)`,
        [JSON.stringify(deactivationPayload)]);
        const firstWait = await waitForAdvisoryPids([deactivationPid], 1);
        assert.ok(firstWait[0]?.query.includes('tche_admin_alterar_status_usuario_mp35b'));
        activationOperation = activationClient.query<{ status: string }>(`SELECT * FROM
          public.tche_admin_alterar_status_propriedade_mp35c($1::jsonb)`,
        [JSON.stringify(activationPayload)]);
      }
      const bothWait = await waitForAdvisoryPids([activationPid, deactivationPid], 2);
      assert.ok(bothWait.some((row) =>
        row.query.includes('tche_admin_alterar_status_propriedade_mp35c')));
      assert.ok(bothWait.some((row) =>
        row.query.includes('tche_admin_alterar_status_usuario_mp35b')));
      await blocker.query('SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [gate]);
      gateHeld = false;
      const [activation, deactivation] = await Promise.all([
        activationOperation, deactivationOperation,
      ]);
      const statuses = {
        activation: activation.rows[0]?.status as string | undefined,
        deactivation: deactivation.rows[0]?.status as string | undefined,
      };
      assert.deepEqual(statuses, order === 'activation_first'
        ? { activation: 'completed', deactivation: 'active_holder_conflict' }
        : { activation: 'invalid_holder', deactivation: 'completed' });

      const state = await owner.query(`SELECT
        usuario.status AS user_status,usuario.versao::text AS user_version,
        usuario.versao_autorizacao::text AS auth_version,
        produtor.status AS producer_status,produtor.versao::text AS producer_version,
        propriedade.status AS property_status,propriedade.versao::text AS property_version,
        sessao.status AS session_status,
        (SELECT status FROM public.tokens_acesso WHERE sessao_id=$4) AS access_status,
        (SELECT status FROM public.tokens_refresh WHERE sessao_id=$4) AS refresh_status
        FROM public.usuarios AS usuario
        JOIN public.produtores AS produtor ON produtor.usuario_id=usuario.id
        JOIN public.propriedades AS propriedade ON propriedade.titular_id=produtor.id
        JOIN public.sessoes_autenticacao AS sessao ON sessao.usuario_id=usuario.id
        WHERE usuario.id=$1 AND produtor.id=$2 AND propriedade.id=$3 AND sessao.id=$4`,
      [producerUserId, producerId, propertyId, targetSessionId]);
      assert.deepEqual(state.rows[0], order === 'activation_first' ? {
        user_status: 'ativo', user_version: '2', auth_version: '2',
        producer_status: 'ativo', producer_version: '1',
        property_status: 'ativa', property_version: '2',
        session_status: 'revogada', access_status: 'revogado', refresh_status: 'revogado',
      } : {
        user_status: 'inativo', user_version: '2', auth_version: '2',
        producer_status: 'inativo', producer_version: '2',
        property_status: 'inativa', property_version: '1',
        session_status: 'revogada', access_status: 'revogado', refresh_status: 'revogado',
      });
      const requestIds = [`request-${activationLabel}`, `request-${deactivationLabel}`];
      const effects = await owner.query<{ command_requests: string[];
        command_states: string[]; audit_requests: string[]; audit_events: string[] }>(`SELECT
        ARRAY(SELECT request_id FROM public.comandos_administrativos_idempotencia
          WHERE request_id=ANY($1::text[]) ORDER BY request_id) AS command_requests,
        ARRAY(SELECT status FROM public.comandos_administrativos_idempotencia
          WHERE request_id=ANY($1::text[]) ORDER BY request_id) AS command_states,
        ARRAY(SELECT request_id FROM public.eventos_auditoria
          WHERE request_id=ANY($1::text[]) ORDER BY request_id) AS audit_requests,
        ARRAY(SELECT evento FROM public.eventos_auditoria
          WHERE request_id=ANY($1::text[]) ORDER BY request_id) AS audit_events`, [requestIds]);
      const successfulRequest = order === 'activation_first'
        ? `request-${activationLabel}` : `request-${deactivationLabel}`;
      const successfulEvent = order === 'activation_first'
        ? 'administracao.propriedade.status_alterado'
        : 'administracao.usuario.status_alterado';
      assert.deepEqual(effects.rows[0], {
        command_requests: [successfulRequest], command_states: ['concluido'],
        audit_requests: [successfulRequest], audit_events: [successfulEvent],
      });
      const activity = await owner.query<{ state: string }>(`SELECT state
        FROM pg_catalog.pg_stat_activity WHERE pid=ANY($1::integer[]) ORDER BY pid`,
      [[activationPid, deactivationPid]]);
      assert.deepEqual(activity.rows.map((row) => row.state), ['idle', 'idle']);
    } finally {
      if (gateHeld) await blocker.query(
        'SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [gate]);
      activationClient.release(); deactivationClient.release(); blocker.release();
      await owner.query(`DROP TRIGGER IF EXISTS ${triggerName} ON public.${table}`);
      await owner.query(`DROP FUNCTION IF EXISTS public.${functionName}()`);
    }
  }

  test('role runtime só executa as quatro operações estreitas e não possui DML direto', async () => {
    assert.ok(runtime); assert.ok(runtimeRole);
    const privilege = await runtime.query(`SELECT
      pg_catalog.has_table_privilege(current_user,'public.propriedades','INSERT') AS property_insert,
      pg_catalog.has_table_privilege(current_user,'public.usuario_propriedade','UPDATE') AS link_update,
      pg_catalog.has_table_privilege(current_user,'public.eventos_auditoria','INSERT') AS audit_insert,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_contexto_mp35c(uuid,text,text,text,text)','EXECUTE') AS context_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_validar_entrada_mp35c(jsonb,text)','EXECUTE') AS input_validator_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_termos_sensiveis_mp35c()','EXECUTE') AS sensitive_catalog_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_detalhe_sensivel_mp35c(text)','EXECUTE') AS sensitive_matcher_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_area_total_valida_mp35c(jsonb,boolean)','EXECUTE') AS area_validator_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_alterar_status_usuario_mp35b_base000008(jsonb)','EXECUTE') AS mp35b_base_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_criar_propriedade_mp35c(jsonb)','EXECUTE') AS create_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_atualizar_propriedade_mp35c(jsonb)','EXECUTE') AS update_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_alterar_status_propriedade_mp35c(jsonb)','EXECUTE') AS status_execute,
      pg_catalog.has_function_privilege(current_user,
        'public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb)','EXECUTE') AS links_execute`);
    assert.deepEqual(privilege.rows[0], { property_insert: false, link_update: false,
      audit_insert: false, context_execute: false, input_validator_execute: false,
      sensitive_catalog_execute: false, sensitive_matcher_execute: false,
      area_validator_execute: false, mp35b_base_execute: false, create_execute: true,
      update_execute: true, status_execute: true, links_execute: true });
    await assert.rejects(runtime.query(`INSERT INTO public.propriedades
      (organizacao_id,titular_id,nome,municipio_id,municipio_nome,uf_id,uf_sigla,status)
      VALUES ($1,$2,'indevida',$3,'Cachoeira do Sul','43','RS','inativa')`,
      [ORGANIZATION_ID, holderId, MUNICIPALITY_ID]), /permission denied/i);
    await assert.rejects(runtime.query(`UPDATE public.propriedades SET nome=nome
      WHERE organizacao_id=$1`, [ORGANIZATION_ID]), /permission denied/i);
    await assert.rejects(runtime.query(`INSERT INTO public.usuario_propriedade
      (organizacao_id,usuario_id,propriedade_id,tipo_vinculo,status,origem)
      VALUES ($1,$2,$3,'colaborador','ativo','admin_manual')`,
      [ORGANIZATION_ID, collaboratorId, randomUUID()]), /permission denied/i);
    await assert.rejects(runtime.query(`INSERT INTO public.eventos_auditoria
      (organizacao_id,evento,resultado,ator_tipo,recurso_tipo,recurso_id,metadados)
      VALUES ($1,'administracao.propriedade.criada','sucesso','sistema','propriedade',$2,'{}')`,
      [ORGANIZATION_ID, randomUUID()]), /permission denied/i);
  });

  test('fronteira SQL replica NFC, pontos de código, motivo D10 e conteúdo sensível', async () => {
    assert.ok(runtime); assert.ok(owner);
    const invalidInput = (error: unknown) => typeof error === 'object' && error !== null
      && 'code' in error && error.code === '22023';
    const create = async (label: string, fields: Readonly<Record<string, unknown>>) =>
      runtime!.query(`SELECT * FROM public.tche_admin_criar_propriedade_mp35c($1::jsonb)`,
        [JSON.stringify({ ...sqlContext(label), titular_id: holderId,
          municipio_id: MUNICIPALITY_ID, status: 'inativa', ...fields })]);
    await assert.rejects(create('sql-nfd-name', { nome: 'Cafe\u0301' }), invalidInput);
    await assert.rejects(create('sql-nfd-crop', { nome: 'NFC válida',
      cultura_principal: 'Cafe\u0301' }), invalidInput);
    await assert.rejects(create('sql-name-201', { nome: '🌱'.repeat(201) }), invalidInput);
    const accepted = await create('sql-name-200', { nome: '🌱'.repeat(200) });
    assert.equal(accepted.rows[0]?.status, 'completed');
    const inactiveScope = await owner.query(`SELECT count(*)::text AS active_sessions
      FROM public.sessoes_autenticacao WHERE usuario_id=$1 AND status='ativa'`, [holderUserId]);
    assert.deepEqual(inactiveScope.rows[0], { active_sessions: '2' });
    const propertyId = accepted.rows[0]?.recibo.resourceId as string | undefined;
    assert.ok(propertyId);
    const badReasonPayload = { ...sqlContext('sql-sensitive-reason'),
      propriedade_id: propertyId, versao: 1, status: 'ativa', motivo: 'outro',
      motivo_detalhe: 'token secreto copiado' };
    await assert.rejects(runtime.query(`SELECT * FROM
      public.tche_admin_alterar_status_propriedade_mp35c($1::jsonb)`,
    [JSON.stringify(badReasonPayload)]), /Motivo administrativo invalido/i);
    const missingReason = { ...sqlContext('sql-missing-reason'), usuario_id: collaboratorId,
      versao: 1, adicionar: [propertyId], remover: [] };
    await assert.rejects(runtime.query(`SELECT * FROM
      public.tche_admin_alterar_vinculos_usuario_mp35c($1::jsonb)`,
    [JSON.stringify(missingReason)]), /Delta de vinculos invalido/i);
    const effects = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades WHERE nome='Café')::text AS nfd,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id LIKE 'request-sql-%' AND request_id <> 'request-sql-name-200')::text AS rejected_commands`);
    assert.deepEqual(effects.rows[0], { nfd: '0', rejected_commands: '0' });
  });

  test('catálogo sensível é idêntico em TS, MP-35B e MP-35C sem efeitos rejeitados', async () => {
    assert.ok(owner); assert.ok(runtime);
    const catalog = await owner.query<{ terms: string[] }>(
      'SELECT public.tche_admin_termos_sensiveis_mp35c() AS terms',
    );
    assert.deepEqual(catalog.rows[0]?.terms, [...ADMINISTRATIVE_SENSITIVE_TERMS]);
    const controlledValidation = (error: unknown) => typeof error === 'object' && error !== null
      && 'code' in error && error.code === '22023'
      && 'constraint' in error && error.constraint === 'ck_mp35c_input_validation';
    for (const [index, term] of ADMINISTRATIVE_SENSITIVE_TERMS.entries()) {
      const mp35cLabel = `sensitive-mp35c-${index}`;
      await assert.rejects(runtime.query(`SELECT * FROM
        public.tche_admin_alterar_status_propriedade_mp35c($1::jsonb)`, [JSON.stringify({
        ...sqlContext(mp35cLabel), propriedade_id: randomUUID(), versao: 1,
        status: 'ativa', motivo: 'outro', motivo_detalhe: `valor ${term} informado`,
      })]), controlledValidation, `MP-35C deve rejeitar ${term}`);
      const mp35bLabel = `sensitive-mp35b-${index}`;
      await assert.rejects(runtime.query(`SELECT * FROM
        public.tche_admin_alterar_status_usuario_mp35b($1::jsonb)`, [JSON.stringify({
        ...mp35bContext(mp35bLabel), usuario_id: holderUserId, versao: 1,
        status: 'inativo', motivo: 'outro', motivo_detalhe: `valor ${term} informado`,
      })]), controlledValidation, `MP-35B deve rejeitar ${term}`);
    }
    const effects = await owner.query(`SELECT
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id LIKE 'request-sensitive-%')::text AS commands,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id LIKE 'request-sensitive-%')::text AS audits`);
    assert.deepEqual(effects.rows[0], { commands: '0', audits: '0' });
  });

  test('fronteira SQL rejeita NULL e tipos JSON incompatíveis antes de qualquer efeito', async () => {
    assert.ok(runtime); assert.ok(owner);
    const propertyId = randomUUID(); const fixtureHolderUserId = randomUUID();
    const fixtureHolderId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Titular fixture de tipos',$3,'produtor','ativo')`,
    [fixtureHolderUserId, ORGANIZATION_ID, `sql-types-${fixtureHolderUserId}@example.test`]);
    await owner.query(`INSERT INTO public.produtores
      (id,organizacao_id,usuario_id,nome,status) VALUES
      ($1,$2,$3,'Titular fixture de tipos','ativo')`,
    [fixtureHolderId, ORGANIZATION_ID, fixtureHolderUserId]);
    await owner.query(`INSERT INTO public.propriedades
      (id,organizacao_id,titular_id,nome,localidades_versao_id,municipio_id,
       municipio_nome,uf_id,uf_sigla,status) VALUES
      ($1,$2,$3,'Fixture de tipos SQL','ibge-localidades-2026-08-25',$4,
       'Caxias do Sul','43','RS','inativa')`,
    [propertyId, ORGANIZATION_ID, fixtureHolderId, MUNICIPALITY_ID]);

    const snapshot = async () => (await owner!.query(`SELECT
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id LIKE 'request-sql-type-%')::text AS commands,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id LIKE 'request-sql-type-%')::text AS audits,
      (SELECT count(*) FROM public.usuario_propriedade
       WHERE usuario_id=$1 AND propriedade_id=$2)::text AS links,
      (SELECT versao::text || ':' || status FROM public.propriedades WHERE id=$2) AS property_state,
      (SELECT versao::text || ':' || versao_autorizacao::text
       FROM public.usuarios WHERE id=$1) AS user_versions,
      (SELECT count(*) FROM public.sessoes_autenticacao
       WHERE usuario_id=$1 AND status='ativa')::text AS active_sessions`,
    [collaboratorId, propertyId])).rows[0];
    const before = await snapshot();

    const invokeInvalid = async (functionName: string, label: string, payload: unknown) => {
      const client = await runtime!.connect();
      try {
        await client.query('BEGIN');
        await assert.rejects(
          client.query(`SELECT * FROM public.${functionName}($1::jsonb)`,
            [JSON.stringify(payload)]),
          (error: unknown) => typeof error === 'object' && error !== null
            && 'code' in error && error.code === '22023'
            && 'constraint' in error && error.constraint === 'ck_mp35c_input_validation',
          label,
        );
      } finally {
        await client.query('ROLLBACK'); client.release();
      }
    };
    const common = (label: string) => sqlContext(`sql-type-${label}`);
    const create = (label: string) => ({ ...common(label), nome: 'Criação inválida',
      titular_id: fixtureHolderId, municipio_id: MUNICIPALITY_ID, status: 'inativa' });
    const update = (label: string) => ({ ...common(label), propriedade_id: propertyId,
      versao: 1, patch: { nome: 'Atualização inválida' } });
    const status = (label: string) => ({ ...common(label), propriedade_id: propertyId,
      versao: 1, status: 'ativa', motivo: 'correcao_administrativa' });
    const delta = (label: string) => ({ ...common(label), usuario_id: collaboratorId,
      versao: 1, adicionar: [propertyId], remover: [], motivo: 'correcao_administrativa' });
    const without = (payload: Readonly<Record<string, unknown>>, field: string) => {
      const copy = { ...payload }; delete copy[field]; return copy;
    };

    for (const functionName of [
      'tche_admin_criar_propriedade_mp35c',
      'tche_admin_atualizar_propriedade_mp35c',
      'tche_admin_alterar_status_propriedade_mp35c',
      'tche_admin_alterar_vinculos_usuario_mp35c',
    ]) {
      await invokeInvalid(functionName, `${functionName}-json-null`, null);
      await invokeInvalid(functionName, `${functionName}-json-array`, []);
    }

    const createCases: readonly [string, Readonly<Record<string, unknown>>][] = [
      ['create-name-number', { ...create('create-name-number'), nome: 123 }],
      ['create-crop-boolean', { ...create('create-crop-boolean'), cultura_principal: true }],
      ['create-holder-number', { ...create('create-holder-number'), titular_id: 123 }],
      ['create-holder-array', { ...create('create-holder-array'), titular_id: [] }],
      ['create-holder-object', { ...create('create-holder-object'), titular_id: {} }],
      ['create-municipality-null', { ...create('create-municipality-null'), municipio_id: null }],
      ['create-status-boolean', { ...create('create-status-boolean'), status: false }],
      ['create-area-null', { ...create('create-area-null'), area_total: null }],
      ['create-area-number', { ...create('create-area-number'), area_total: 1 }],
      ['create-area-boolean', { ...create('create-area-boolean'), area_total: true }],
      ['create-area-array', { ...create('create-area-array'), area_total: [] }],
      ['create-area-object', { ...create('create-area-object'), area_total: {} }],
      ['create-holder-version-one', { ...create('create-holder-version-one'),
        titular_id: '11111111-1111-1111-8111-111111111111' }],
      ['create-holder-bad-variant', { ...create('create-holder-bad-variant'),
        titular_id: '11111111-1111-4111-7111-111111111111' }],
      ['create-holder-uppercase', { ...create('create-holder-uppercase'),
        titular_id: fixtureHolderId.toUpperCase() }],
      ['create-holder-malformed', { ...create('create-holder-malformed'), titular_id: 'uuid-invalido' }],
      ['create-session-number', { ...create('create-session-number'), sessao_id: 123 }],
      ['create-request-array', { ...create('create-request-array'), request_id: [] }],
      ['create-correlation-object', { ...create('create-correlation-object'), correlation_id: {} }],
      ['create-key-hash-boolean', { ...create('create-key-hash-boolean'),
        chave_idempotencia_hash: true }],
      ['create-request-hash-null', { ...create('create-request-hash-null'), hash_requisicao: null }],
    ];
    for (const [label, payload] of createCases) {
      await invokeInvalid('tche_admin_criar_propriedade_mp35c', label, payload);
    }

    const versionValues: readonly [string, unknown][] = [
      ['null', null], ['string', '1'], ['decimal', 1.5], ['boolean', true],
      ['array', []], ['object', {}],
    ];
    for (const [kind, value] of versionValues) {
      await invokeInvalid('tche_admin_atualizar_propriedade_mp35c', `update-version-${kind}`,
        { ...update(`update-version-${kind}`), versao: value });
      await invokeInvalid('tche_admin_alterar_status_propriedade_mp35c', `status-version-${kind}`,
        { ...status(`status-version-${kind}`), versao: value });
      await invokeInvalid('tche_admin_alterar_vinculos_usuario_mp35c', `delta-version-${kind}`,
        { ...delta(`delta-version-${kind}`), versao: value });
    }
    await invokeInvalid('tche_admin_atualizar_propriedade_mp35c', 'update-version-missing',
      without(update('update-version-missing'), 'versao'));
    await invokeInvalid('tche_admin_alterar_status_propriedade_mp35c', 'status-version-missing',
      without(status('status-version-missing'), 'versao'));
    await invokeInvalid('tche_admin_alterar_vinculos_usuario_mp35c', 'delta-version-missing',
      without(delta('delta-version-missing'), 'versao'));

    const otherCases: readonly [string, string, Readonly<Record<string, unknown>>][] = [
      ['tche_admin_atualizar_propriedade_mp35c', 'update-property-number',
        { ...update('update-property-number'), propriedade_id: 123 }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-patch-null',
        { ...update('update-patch-null'), patch: null }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-name-number',
        { ...update('update-name-number'), patch: { nome: 123 } }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-crop-boolean',
        { ...update('update-crop-boolean'), patch: { cultura_principal: true } }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-municipality-object',
        { ...update('update-municipality-object'), patch: { municipio_id: {} } }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-area-number',
        { ...update('update-area-number'), patch: { area_total: 1 } }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-area-boolean',
        { ...update('update-area-boolean'), patch: { area_total: true } }],
      ['tche_admin_atualizar_propriedade_mp35c', 'update-property-version-one',
        { ...update('update-property-version-one'),
          propriedade_id: '11111111-1111-1111-8111-111111111111' }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-user-bad-variant',
        { ...delta('delta-user-bad-variant'),
          usuario_id: '11111111-1111-4111-7111-111111111111' }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-property-array',
        { ...status('status-property-array'), propriedade_id: [] }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-value-number',
        { ...status('status-value-number'), status: 123 }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-reason-missing',
        without(status('status-reason-missing'), 'motivo')],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-reason-null',
        { ...status('status-reason-null'), motivo: null }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-reason-number',
        { ...status('status-reason-number'), motivo: 123 }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-detail-null',
        { ...status('status-detail-null'), motivo_detalhe: null }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-detail-number',
        { ...status('status-detail-number'), motivo_detalhe: 123 }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-detail-boolean',
        { ...status('status-detail-boolean'), motivo_detalhe: true }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-detail-array',
        { ...status('status-detail-array'), motivo_detalhe: [] }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-detail-object',
        { ...status('status-detail-object'), motivo_detalhe: {} }],
      ['tche_admin_alterar_status_propriedade_mp35c', 'status-other-without-detail',
        { ...status('status-other-without-detail'), motivo: 'outro' }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-user-object',
        { ...delta('delta-user-object'), usuario_id: {} }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-add-null',
        { ...delta('delta-add-null'), adicionar: null }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-remove-number',
        { ...delta('delta-remove-number'), remover: 123 }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-add-number-item',
        { ...delta('delta-add-number-item'), adicionar: [123] }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-remove-object-item',
        { ...delta('delta-remove-object-item'), remover: [{}] }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-reason-null',
        { ...delta('delta-reason-null'), motivo: null }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-reason-number',
        { ...delta('delta-reason-number'), motivo: 123 }],
      ['tche_admin_alterar_vinculos_usuario_mp35c', 'delta-detail-number',
        { ...delta('delta-detail-number'), motivo_detalhe: 123 }],
    ];
    for (const [functionName, label, payload] of otherCases) {
      await invokeInvalid(functionName, label, payload);
    }
    assert.deepEqual(await snapshot(), before);
  });

  test('área numeric(14,4) preserva limites e bypass controlado vira 422 local', async () => {
    assert.ok(owner); assert.ok(runtime);
    const areaHolderUserId = randomUUID(); const areaHolderId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Titular das áreas',$3,'produtor','ativo')`,
    [areaHolderUserId, ORGANIZATION_ID, `area-holder-${areaHolderUserId}@example.test`]);
    await owner.query(`INSERT INTO public.produtores
      (id,organizacao_id,usuario_id,nome,status) VALUES
      ($1,$2,$3,'Titular das áreas','ativo')`,
    [areaHolderId, ORGANIZATION_ID, areaHolderUserId]);
    const createDirect = async (label: string, area: unknown) => runtime!.query(`SELECT * FROM
      public.tche_admin_criar_propriedade_mp35c($1::jsonb)`, [JSON.stringify({
      ...sqlContext(label), nome: `Área ${label}`, titular_id: areaHolderId,
      municipio_id: MUNICIPALITY_ID, area_total: area, status: 'inativa',
    })]);
    const acceptedAreas = [
      ['area-minimum', '0.0001', '0.0001'],
      ['area-integer', '1', '1.0000'],
      ['area-trailing-zero', '1.0', '1.0000'],
      ['area-four-decimals', '1.2345', '1.2345'],
      ['area-maximum', '9999999999.9999', '9999999999.9999'],
    ] as const;
    const acceptedIds: string[] = [];
    for (const [label, input, expectedStored] of acceptedAreas) {
      const result = await createDirect(label, input);
      assert.equal(result.rows[0]?.status, 'completed', label);
      const id = result.rows[0]?.recibo.resourceId as string | undefined;
      assert.ok(id); acceptedIds.push(id);
      const stored: QueryResult<{ area: string }> = await owner.query<{ area: string }>(
        'SELECT area_total::text AS area FROM public.propriedades WHERE id=$1', [id],
      );
      assert.equal(stored.rows[0]?.area, expectedStored, label);
    }
    const minimumId = acceptedIds[0];
    assert.ok(minimumId);
    const nullable = await runtime.query(`SELECT * FROM
      public.tche_admin_atualizar_propriedade_mp35c($1::jsonb)`, [JSON.stringify({
      ...sqlContext('area-null-update'), propriedade_id: minimumId, versao: 1,
      patch: { area_total: null },
    })]);
    assert.equal(nullable.rows[0]?.status, 'completed');
    const cleared = await owner.query<{ area: string | null }>(
      'SELECT area_total::text AS area FROM public.propriedades WHERE id=$1', [minimumId],
    );
    assert.equal(cleared.rows[0]?.area, null);

    const rejectedSnapshot = async () => (await owner!.query(`SELECT
      (SELECT count(*) FROM public.propriedades
       WHERE nome LIKE 'Área area-rejected-%')::text AS properties,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id LIKE 'request-area-rejected-%')::text AS commands,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id LIKE 'request-area-rejected-%')::text AS audits,
      (SELECT versao::text || ':' || versao_autorizacao::text
       FROM public.usuarios WHERE id=$1) AS holder_versions,
      (SELECT count(*) FROM public.sessoes_autenticacao
       WHERE usuario_id=$1 AND status='ativa')::text AS active_sessions`,
    [areaHolderUserId])).rows[0];
    const rejectedBefore = await rejectedSnapshot();
    const rejectedAreas: readonly [string, unknown][] = [
      ['number', 1], ['boolean', true], ['array', []], ['object', {}], ['null', null],
      ['zero', '0'], ['negative', '-1'], ['five-decimals', '0.00001'],
      ['rounded-by-number-before', '1.00000000000000001'],
      ['maximum-five-decimals', '9999999999.99999'], ['above-maximum', '10000000000'],
      ['leading-zero', '01.25'], ['whitespace', ' 1.25 '], ['leading-space', ' 1'],
      ['trailing-space', '1 '], ['tab', '1\t'], ['lf-zero', '0\n'], ['lf', '1\n'],
      ['lf-decimal', '1.0\n'], ['cr', '1\r'], ['crlf', '1\r\n'],
      ['u2028', '1\u2028'], ['u2029', '1\u2029'], ['nan', 'NaN'],
      ['infinity', 'Infinity'], ['exponent', '1e-4'], ['leading-dot', '.25'],
      ['trailing-dot', '1.'],
    ];
    for (const [label, input] of rejectedAreas) {
      await assert.rejects(createDirect(`area-rejected-${label}`, input),
        (error: unknown) => typeof error === 'object' && error !== null
          && 'code' in error && error.code === '22023'
          && 'constraint' in error && error.constraint === 'ck_mp35c_input_validation',
        label);
      assert.deepEqual(await rejectedSnapshot(), rejectedBefore, label);
    }

    const invalidRepositoryInput = (error: unknown) => error instanceof HttpError
      && error.statusCode === 422 && error.code === 'validation_error';
    await Promise.all([
      assert.rejects(() => repo().createProperty({ principal: actor(),
        identity: identity('propriedade.criar', 'repository-bypass-area'),
        name: 'Bypass área inválida', holderId, municipalityId: MUNICIPALITY_ID,
        totalArea: '0.00001', status: 'inativa' }), invalidRepositoryInput),
      assert.rejects(() => repo().createProperty({ principal: actor(),
        identity: identity('propriedade.criar', 'repository-bypass-uuid'),
        name: 'Bypass UUID inválido',
        holderId: '11111111-1111-1111-8111-111111111111',
        municipalityId: MUNICIPALITY_ID, status: 'inativa' }), invalidRepositoryInput),
    ]);
    const effects = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades
       WHERE nome LIKE 'Bypass %')::text AS properties,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id LIKE 'request-repository-bypass-%')::text AS commands,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id LIKE 'request-repository-bypass-%')::text AS audits`);
    assert.deepEqual(effects.rows[0], { properties: '0', commands: '0', audits: '0' });
  });

  test('decoder incompatível reverte efeito, auditoria e recibo antes do COMMIT real', async () => {
    assert.ok(runtime); assert.ok(owner);
    const commandIdentity = identity('propriedade.criar', 'decoder-rollback');
    const payload = {
      sessao_id: commandIdentity.sessionId,
      request_id: commandIdentity.requestId,
      correlation_id: commandIdentity.correlationId,
      chave_idempotencia_hash: commandIdentity.idempotencyKeyHash.toString('hex'),
      hash_requisicao: commandIdentity.requestHash.toString('hex'),
      nome: 'Decoder deve reverter', titular_id: holderId,
      municipio_id: MUNICIPALITY_ID, area_total: '1.25', status: 'inativa',
    };
    const before = await owner.query(`SELECT
      (SELECT versao::text || ':' || versao_autorizacao::text
       FROM public.usuarios WHERE id=$1) AS holder_versions,
      (SELECT count(*) FROM public.sessoes_autenticacao
       WHERE usuario_id=$1 AND status='ativa')::text AS active_sessions`, [holderUserId]);
    await assert.rejects(executeMp35cMutationTransaction(runtime, commandIdentity,
      async (client) => client.query(`WITH resposta AS MATERIALIZED (
        SELECT status,codigo_http,recibo
        FROM public.tche_admin_criar_propriedade_mp35c($1::jsonb)
      ) SELECT status,codigo_http,recibo || '{"campo_extra":"proibido"}'::jsonb AS recibo
        FROM resposta`, [JSON.stringify(payload)])),
    (error: unknown) => error instanceof HttpError
      && error.statusCode === 503 && error.code === 'service_unavailable');
    const after = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades
       WHERE nome='Decoder deve reverter')::text AS properties,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id=$2)::text AS audits,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id=$2)::text AS receipts,
      (SELECT versao::text || ':' || versao_autorizacao::text
       FROM public.usuarios WHERE id=$1) AS holder_versions,
      (SELECT count(*) FROM public.sessoes_autenticacao
       WHERE usuario_id=$1 AND status='ativa')::text AS active_sessions`,
    [holderUserId, commandIdentity.requestId]);
    assert.deepEqual(after.rows[0], {
      properties: '0', audits: '0', receipts: '0',
      ...before.rows[0],
    });
  });

  test('criação é idempotente, deriva território e revoga o escopo do Titular', async () => {
    const commandIdentity = identity('propriedade.criar', 'create-active');
    assert.ok(runtime);
    const raw = await runtime.query<{ status: string; codigo_http: number; recibo: {
      resourceId: string; version: number } }>(`SELECT * FROM
      public.tche_admin_criar_propriedade_mp35c($1::jsonb)`, [JSON.stringify({
        sessao_id: commandIdentity.sessionId,
        request_id: commandIdentity.requestId, correlation_id: commandIdentity.correlationId,
        chave_idempotencia_hash: commandIdentity.idempotencyKeyHash.toString('hex'),
        hash_requisicao: commandIdentity.requestHash.toString('hex'), nome: 'Propriedade MP35C',
        titular_id: holderId, municipio_id: MUNICIPALITY_ID, area_total: '42.5',
        cultura_principal: 'Soja', status: 'ativa',
    })]);
    const first = raw.rows[0]; assert.equal(first?.status, 'completed'); assert.ok(first);
    const replaySessionId = await createSession(actor().id, actor().authorizationVersion);
    const replay = await repo().createProperty({ principal: actor(),
      identity: { ...commandIdentity, sessionId: replaySessionId },
      name: 'Propriedade MP35C', holderId, municipalityId: MUNICIPALITY_ID,
      totalArea: '42.5', mainCrop: 'Soja', status: 'ativa' });
    assert.equal(replay.status, 'replayed');
    assert.equal(replay.status === 'replayed' ? replay.receipt.resourceId : null,
      first.recibo.resourceId);
    assert.ok(owner);
    const persistedReceipt = await owner.query(`SELECT status,codigo_http,recibo
      FROM public.comandos_administrativos_idempotencia
      WHERE request_id=$1`, [commandIdentity.requestId]);
    assert.deepEqual(persistedReceipt.rows[0], {
      status: 'concluido', codigo_http: 201,
      recibo: replay.status === 'replayed' ? replay.receipt : null,
    });
    const idempotencyConflict = await repo().createProperty({ principal: actor(),
      identity: { ...commandIdentity, requestHash: digest('different-request') },
      name: 'Outra Propriedade', holderId, municipalityId: MUNICIPALITY_ID,
      status: 'ativa' });
    assert.equal(idempotencyConflict.status, 'idempotency_conflict');
    const state = await owner.query(`SELECT p.municipio_nome,p.uf_id,p.uf_sigla,
      p.localidades_versao_id,p.versao AS propriedade_versao,
      u.versao AS usuario_versao,u.versao_autorizacao,
      (SELECT count(*) FROM public.sessoes_autenticacao s WHERE s.usuario_id=u.id AND s.status='ativa') AS active_sessions,
      (SELECT count(*) FROM public.tokens_refresh t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id WHERE s.usuario_id=u.id AND t.status='ativo') AS active_refresh,
      (SELECT count(*) FROM public.sessoes_autenticacao s WHERE s.usuario_id=u.id AND s.status='revogada') AS revoked_sessions,
      (SELECT count(*) FROM public.tokens_refresh t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id WHERE s.usuario_id=u.id AND t.status='revogado') AS revoked_refresh,
      (SELECT count(*) FROM public.tokens_acesso t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id WHERE s.usuario_id=u.id AND t.status='revogado') AS revoked_access
      FROM public.propriedades p JOIN public.produtores pr ON pr.id=p.titular_id
      JOIN public.usuarios u ON u.id=pr.usuario_id WHERE p.id=$1`, [first.recibo.resourceId]);
    assert.deepEqual(state.rows[0], { municipio_nome: 'Caxias do Sul', uf_id: '43',
      uf_sigla: 'RS', localidades_versao_id: 'ibge-localidades-2026-08-25',
      propriedade_versao: '1', usuario_versao: '2', versao_autorizacao: '2',
      active_sessions: '0', active_refresh: '0', revoked_sessions: '2',
      revoked_refresh: '2', revoked_access: '2' });
    const revocationClock = await owner.query(`SELECT
      (SELECT bool_and(revogada_em >= criada_em) FROM public.sessoes_autenticacao
       WHERE usuario_id=$1 AND status='revogada') AS sessions_after_creation,
      (SELECT bool_and(t.revogado_em >= t.emitido_em) FROM public.tokens_acesso t
       JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id
       WHERE s.usuario_id=$1 AND t.status='revogado') AS access_after_issue,
      (SELECT bool_and(t.revogado_em >= t.emitido_em) FROM public.tokens_refresh t
       JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id
       WHERE s.usuario_id=$1 AND t.status='revogado') AS refresh_after_issue`,
    [holderUserId]);
    assert.deepEqual(revocationClock.rows[0], { sessions_after_creation: true,
      access_after_issue: true, refresh_after_issue: true });
    const unaffected = await owner.query(`SELECT usuario_id,count(*)::text AS active_sessions
      FROM public.sessoes_autenticacao WHERE usuario_id=ANY($1::uuid[]) AND status='ativa'
      GROUP BY usuario_id ORDER BY usuario_id`, [[actor().id, collaboratorId]]);
    assert.deepEqual(new Map(unaffected.rows.map((row) => [row.usuario_id, row.active_sessions])),
      new Map([[actor().id, '2'], [collaboratorId, '1']]));
    const duplicate = await owner.query(`SELECT count(*)::text AS count FROM public.propriedades
      WHERE nome='Outra Propriedade'`); assert.equal(duplicate.rows[0]?.count, '0');
    const effects = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades WHERE id=$1)::text AS properties,
      (SELECT count(*) FROM public.eventos_auditoria
       WHERE request_id=$2 AND evento='administracao.propriedade.criada')::text AS audits,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id=$2)::text AS commands`, [first.recibo.resourceId, commandIdentity.requestId]);
    assert.deepEqual(effects.rows[0], { properties: '1', audits: '1', commands: '1' });
  });

  test('PATCH comum deriva novamente o território e recusa atualização sem efeito', async () => {
    assert.ok(owner); const current = await owner.query<{ id: string; versao: string }>(
      `SELECT id,versao FROM public.propriedades WHERE nome='Propriedade MP35C'`);
    const row = current.rows[0]; assert.ok(row);
    const updateIdentity = identity('propriedade.atualizar', 'territory-update');
    const changed = await repo().updateProperty({ principal: actor(),
      identity: updateIdentity, propertyId: row.id,
      expectedVersion: Number(row.versao), name: 'Propriedade MP35C',
      municipalityId: '4303004' });
    assert.equal(changed.status, 'completed');
    if (changed.status !== 'completed') return;
    const changedVersion = changed.receipt.version; assert.ok(changedVersion);
    const territory = await owner.query(`SELECT municipio_id,municipio_nome,uf_id,uf_sigla,
      localidades_versao_id FROM public.propriedades WHERE id=$1`, [row.id]);
    assert.deepEqual(territory.rows[0], { municipio_id: '4303004', municipio_nome: 'Cachoeira do Sul',
      uf_id: '43', uf_sigla: 'RS', localidades_versao_id: 'ibge-localidades-2026-08-25' });
    const replaySessionId = await createSession(actor().id, actor().authorizationVersion);
    const replay = await repo().updateProperty({ principal: actor(),
      identity: { ...updateIdentity, sessionId: replaySessionId }, propertyId: row.id,
      expectedVersion: Number(row.versao), name: 'Propriedade MP35C',
      municipalityId: '4303004' });
    assert.equal(replay.status, 'replayed');
    const audit = await owner.query(`SELECT metadados FROM public.eventos_auditoria
      WHERE request_id=$1 AND evento='administracao.propriedade.atualizada'`,
    [updateIdentity.requestId]);
    assert.equal(audit.rowCount, 1);
    assert.deepEqual(audit.rows[0]?.metadados.campos, ['municipio_id']);
    const noChange = await repo().updateProperty({ principal: actor(),
      identity: identity('propriedade.atualizar', 'territory-no-change'), propertyId: row.id,
      expectedVersion: changedVersion, municipalityId: '4303004' });
    assert.equal(noChange.status, 'business_rule_conflict');
  });

  test('delta deriva colaborador, incrementa Usuário uma vez e faz rollback integral em conflito', async () => {
    assert.ok(owner);
    const property = await owner.query<{ id: string }>(`SELECT id FROM public.propriedades
      WHERE nome='Propriedade MP35C'`); const propertyId = property.rows[0]?.id; assert.ok(propertyId);
    const secondProperty = randomUUID();
    await owner.query(`INSERT INTO public.propriedades
      (id,organizacao_id,titular_id,nome,localidades_versao_id,municipio_id,
       municipio_nome,uf_id,uf_sigla,status) VALUES
      ($1,$2,$3,'Segunda MP35C','ibge-localidades-2026-08-25',$4,'-','43','AA','inativa')`,
      [secondProperty, ORGANIZATION_ID, holderId, MUNICIPALITY_ID]);
    const addIdentity = identity('usuario.alterar_vinculos', 'add-link');
    const added = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: addIdentity, userId: collaboratorId,
      expectedVersion: 1, add: [propertyId, secondProperty], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(added.status, 'completed');
    if (added.status !== 'completed') return;
    assert.equal(added.receipt.version, 2);
    const replaySessionId = await createSession(actor().id, actor().authorizationVersion);
    const replay = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: { ...addIdentity, sessionId: replaySessionId }, userId: collaboratorId,
      expectedVersion: 1, add: [propertyId, secondProperty], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(replay.status, 'replayed');
    const persisted = await owner.query(`SELECT propriedade_id,tipo_vinculo,status
      FROM public.usuario_propriedade WHERE usuario_id=$1 ORDER BY propriedade_id`, [collaboratorId]);
    assert.deepEqual(persisted.rows, [propertyId, secondProperty].sort().map((id) => ({
      propriedade_id: id, tipo_vinculo: 'colaborador', status: 'ativo' })));
    const audits = await owner.query(`SELECT evento,organizacao_id,ator_usuario_id,sessao_id,
      usuario_afetado_id,request_id,metadados,ocorrido_em IS NOT NULL AS has_database_time
      FROM public.eventos_auditoria WHERE request_id=$1 ORDER BY recurso_id`,
    [addIdentity.requestId]);
    assert.equal(audits.rowCount, 2);
    for (const audit of audits.rows) {
      assert.equal(audit.evento, 'administracao.vinculo.criado');
      assert.equal(audit.organizacao_id, ORGANIZATION_ID);
      assert.equal(audit.ator_usuario_id, actor().id);
      assert.equal(audit.sessao_id, actor().sessionId);
      assert.equal(audit.usuario_afetado_id, collaboratorId);
      assert.equal(audit.request_id, addIdentity.requestId);
      assert.equal(audit.has_database_time, true);
      assert.deepEqual({
        usuario_id: audit.metadados.usuario_id,
        tipo_vinculo: audit.metadados.tipo_vinculo,
        estado_anterior: audit.metadados.estado_anterior,
        estado_posterior: audit.metadados.estado_posterior,
        acao: audit.metadados.acao,
        motivo: audit.metadados.motivo,
        correlation_id: audit.metadados.correlation_id,
      }, { usuario_id: collaboratorId, tipo_vinculo: 'colaborador',
        estado_anterior: 'ausente', estado_posterior: 'ativo', acao: 'criado',
        motivo: 'correcao_administrativa', correlation_id: addIdentity.correlationId });
      assert.ok([propertyId, secondProperty].includes(audit.metadados.propriedade_id));
    }
    const thirdProperty = randomUUID();
    await owner.query(`INSERT INTO public.propriedades
      (id,organizacao_id,titular_id,nome,localidades_versao_id,municipio_id,
       municipio_nome,uf_id,uf_sigla,status) VALUES
      ($1,$2,$3,'Terceira MP35C','ibge-localidades-2026-08-25',$4,'-','43','AA','inativa')`,
      [thirdProperty, ORGANIZATION_ID, holderId, MUNICIPALITY_ID]);
    const conflict = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'atomic-conflict'), userId: collaboratorId,
      expectedVersion: 2, add: [propertyId, thirdProperty], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(conflict.status, 'business_rule_conflict');
    const rolledBack = await owner.query(`SELECT count(*)::text AS count FROM public.usuario_propriedade
      WHERE usuario_id=$1 AND propriedade_id=$2`, [collaboratorId, thirdProperty]);
    assert.equal(rolledBack.rows[0]?.count, '0');
    const version = await owner.query(`SELECT versao,versao_autorizacao,
      (SELECT count(*) FROM public.sessoes_autenticacao s WHERE s.usuario_id=u.id AND s.status='ativa') AS active_sessions,
      (SELECT count(*) FROM public.tokens_refresh t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id WHERE s.usuario_id=u.id AND t.status='ativo') AS active_refresh
      FROM public.usuarios u WHERE id=$1`, [collaboratorId]);
    assert.deepEqual(version.rows[0], { versao: '2', versao_autorizacao: '2',
      active_sessions: '0', active_refresh: '0' });
    const conflictEffects = await owner.query(`SELECT
      (SELECT count(*) FROM public.eventos_auditoria WHERE request_id='request-atomic-conflict')::text AS audits,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
        WHERE request_id='request-atomic-conflict')::text AS commands`);
    assert.deepEqual(conflictEffects.rows[0], { audits: '0', commands: '0' });
  });

  test('falha induzida depois do primeiro write do delta reverte lote, auditoria e reserva', async () => {
    assert.ok(owner);
    const targetUserId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Rollback delta',$3,'colaborador','ativo')`,
    [targetUserId, ORGANIZATION_ID, `rollback-delta-${targetUserId}@example.test`]);
    const sessionId = await createSession(targetUserId, 1);
    const properties = await owner.query<{ id: string }>(`SELECT id FROM public.propriedades
      WHERE nome IN ('Propriedade MP35C','Segunda MP35C') ORDER BY id`);
    assert.equal(properties.rowCount, 2);
    const ids = properties.rows.map((row) => row.id);
    const failOn = ids[1]; assert.ok(failOn);
    await owner.query(`CREATE FUNCTION public.tche_test_fail_second_delta_mp35c()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.usuario_id='${targetUserId}'::uuid
          AND NEW.propriedade_id='${failOn}'::uuid THEN
          RAISE EXCEPTION 'falha induzida depois do primeiro write';
        END IF; RETURN NEW; END $$`);
    await owner.query(`CREATE TRIGGER tche_test_fail_second_delta_mp35c
      BEFORE INSERT ON public.usuario_propriedade FOR EACH ROW
      EXECUTE FUNCTION public.tche_test_fail_second_delta_mp35c()`);
    const commandIdentity = identity('usuario.alterar_vinculos', 'rollback-after-write');
    try {
      await assert.rejects(repo().applyUserPropertyDelta({ principal: actor(),
        identity: commandIdentity, userId: targetUserId, expectedVersion: 1,
        add: ids, remove: [], reason: { code: 'correcao_administrativa' } }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 503
        && error.code === 'service_unavailable');
    } finally {
      await owner.query(`DROP TRIGGER IF EXISTS tche_test_fail_second_delta_mp35c
        ON public.usuario_propriedade`);
      await owner.query('DROP FUNCTION IF EXISTS public.tche_test_fail_second_delta_mp35c()');
    }
    const state = await owner.query(`SELECT
      (SELECT count(*) FROM public.usuario_propriedade WHERE usuario_id=$1)::text AS links,
      (SELECT count(*) FROM public.eventos_auditoria WHERE request_id=$2)::text AS audits,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE request_id=$2)::text AS commands,
      (SELECT versao::text FROM public.usuarios WHERE id=$1) AS version,
      (SELECT versao_autorizacao::text FROM public.usuarios WHERE id=$1) AS auth_version,
      (SELECT status FROM public.sessoes_autenticacao WHERE id=$3) AS session_status`,
    [targetUserId, commandIdentity.requestId, sessionId]);
    assert.deepEqual(state.rows[0], { links: '0', audits: '0', commands: '0',
      version: '1', auth_version: '1', session_status: 'ativa' });
  });

  test('titularidade é derivada, não editável e nunca vira usuario_propriedade', async () => {
    const result = await repo().listUserProperties({ principal: actor(), userId: holderUserId, limit: 10 });
    assert.ok(result); assert.equal(result.items.length, 4);
    const derived = result.items.find((item) => item.propertyName === 'Propriedade MP35C');
    assert.ok(derived);
    assert.deepEqual({ accessOrigin: derived.accessOrigin, linkType: derived.linkType,
      editable: derived.editable, linkStatus: derived.linkStatus },
      { accessOrigin: 'titularidade', linkType: 'titular', editable: false,
        linkStatus: null });
    assert.ok(owner); const count = await owner.query(`SELECT count(*)::text AS count
      FROM public.usuario_propriedade WHERE usuario_id=$1`, [holderUserId]);
    assert.equal(count.rows[0]?.count, '0');
    const propertyId = derived.propertyId;
    const redundant = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'redundant-holder'), userId: holderUserId,
      expectedVersion: result.userVersion, add: [propertyId], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(redundant.status, 'business_rule_conflict');
  });

  test('delta deriva usuario_autorizado para Produtor e proíbe vínculo de Admin', async () => {
    assert.ok(owner); const producerUserId = randomUUID(); const producerId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Produtor autorizado',$3,'produtor','ativo')`,
      [producerUserId, ORGANIZATION_ID, `producer-${producerUserId}@example.test`]);
    await owner.query(`INSERT INTO public.produtores
      (id,organizacao_id,usuario_id,nome,status) VALUES ($1,$2,$3,'Produtor autorizado','ativo')`,
      [producerId, ORGANIZATION_ID, producerUserId]);
    const property = await owner.query<{ id: string }>(`SELECT id FROM public.propriedades
      WHERE nome='Segunda MP35C'`); const propertyId = property.rows[0]?.id; assert.ok(propertyId);
    const added = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'producer-link'), userId: producerUserId,
      expectedVersion: 1, add: [propertyId], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(added.status, 'completed');
    const link = await owner.query(`SELECT tipo_vinculo,status FROM public.usuario_propriedade
      WHERE usuario_id=$1 AND propriedade_id=$2`, [producerUserId, propertyId]);
    assert.deepEqual(link.rows, [{ tipo_vinculo: 'usuario_autorizado', status: 'ativo' }]);
    const denied = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'admin-link'), userId: actor().id,
      expectedVersion: 1, add: [propertyId], remove: [],
      reason: { code: 'correcao_administrativa' } });
    assert.equal(denied.status, 'business_rule_conflict');
  });

  test('status incrementa e revoga exatamente uma vez todos os Usuários afetados', async () => {
    assert.ok(owner); const property = await owner.query<{ id: string; versao: string }>(
      `SELECT id,versao FROM public.propriedades WHERE nome='Propriedade MP35C'`);
    const row = property.rows[0]; assert.ok(row);
    const before = await owner.query(`SELECT id,versao,versao_autorizacao FROM public.usuarios
      WHERE id=ANY($1::uuid[]) ORDER BY id`, [[holderUserId, collaboratorId]]);
    for (const affected of before.rows) {
      await createSession(affected.id, Number(affected.versao_autorizacao));
    }
    const statusIdentity = identity('propriedade.alterar_status', 'deactivate');
    const changed = await repo().changePropertyStatus({ principal: actor(),
      identity: statusIdentity, propertyId: row.id,
      expectedVersion: Number(row.versao), status: 'inativa',
      reason: { code: 'suspensao_operacional' } });
    assert.equal(changed.status, 'completed');
    const afterState = await owner.query(`SELECT id,versao,versao_autorizacao FROM public.usuarios
      WHERE id=ANY($1::uuid[]) ORDER BY id`, [[holderUserId, collaboratorId]]);
    assert.deepEqual(afterState.rows.map((item, index) => ({ id: item.id,
      versionDelta: Number(item.versao) - Number(before.rows[index]?.versao),
      authDelta: Number(item.versao_autorizacao) - Number(before.rows[index]?.versao_autorizacao) })),
      afterState.rows.map((item) => ({ id: item.id, versionDelta: 1, authDelta: 1 })));
    const liveCredentials = await owner.query(`SELECT
      (SELECT count(*) FROM public.sessoes_autenticacao WHERE usuario_id=ANY($1::uuid[]) AND status='ativa')::text AS sessions,
      (SELECT count(*) FROM public.tokens_refresh t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id
        WHERE s.usuario_id=ANY($1::uuid[]) AND t.status='ativo')::text AS refresh,
      (SELECT count(*) FROM public.tokens_acesso t JOIN public.sessoes_autenticacao s ON s.id=t.sessao_id
        WHERE s.usuario_id=ANY($1::uuid[]) AND t.status='ativo')::text AS access`,
      [[holderUserId, collaboratorId]]);
    assert.deepEqual(liveCredentials.rows[0], { sessions: '0', refresh: '0', access: '0' });
    assert.equal(changed.status, 'completed');
    if (changed.status !== 'completed') return;
    const changedVersion = changed.receipt.version; assert.ok(changedVersion);
    const replaySessionId = await createSession(actor().id, actor().authorizationVersion);
    const replay = await repo().changePropertyStatus({ principal: actor(),
      identity: { ...statusIdentity, sessionId: replaySessionId }, propertyId: row.id,
      expectedVersion: Number(row.versao), status: 'inativa',
      reason: { code: 'suspensao_operacional' } });
    assert.equal(replay.status, 'replayed');
    const replayEffects = await owner.query(`SELECT
      (SELECT versao FROM public.propriedades WHERE id=$1)::text AS property_version,
      (SELECT count(*) FROM public.eventos_auditoria WHERE request_id=$2)::text AS audits`,
    [row.id, statusIdentity.requestId]);
    assert.deepEqual(replayEffects.rows[0], {
      property_version: String(changedVersion), audits: '1',
    });
    const repeatedStatus = await repo().changePropertyStatus({ principal: actor(),
      identity: identity('propriedade.alterar_status', 'deactivate-repeat'), propertyId: row.id,
      expectedVersion: changedVersion, status: 'inativa',
      reason: { code: 'suspensao_operacional' } });
    assert.equal(repeatedStatus.status, 'business_rule_conflict');

    const collaboratorVersion = afterState.rows.find((item) => item.id === collaboratorId)?.versao;
    assert.ok(collaboratorVersion);
    const removed = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'remove-link'), userId: collaboratorId,
      expectedVersion: Number(collaboratorVersion), add: [], remove: [row.id],
      reason: { code: 'fim_relacao' } });
    assert.equal(removed.status, 'completed');
    if (removed.status !== 'completed') return;
    const removedVersion = removed.receipt.version; assert.ok(removedVersion);
    const repeatedRemoval = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: identity('usuario.alterar_vinculos', 'remove-link-repeat'), userId: collaboratorId,
      expectedVersion: removedVersion, add: [], remove: [row.id],
      reason: { code: 'fim_relacao' } });
    assert.equal(repeatedRemoval.status, 'business_rule_conflict');
    const listed = await repo().listUserProperties({ principal: actor(), userId: collaboratorId,
      linkStatus: 'inativo', limit: 10 });
    assert.ok(listed);
    assert.deepEqual(listed.items.map((item) => ({ propertyId: item.propertyId,
      accessOrigin: item.accessOrigin, linkType: item.linkType,
      linkStatus: item.linkStatus, editable: item.editable })), [{ propertyId: row.id,
      accessOrigin: 'vinculo_direto', linkType: 'colaborador',
      linkStatus: 'inativo', editable: true }]);
    const removalAudit = await owner.query(`SELECT evento,metadados
      FROM public.eventos_auditoria WHERE request_id='request-remove-link'`);
    assert.deepEqual(removalAudit.rows.map((audit) => ({ evento: audit.evento,
      anterior: audit.metadados.estado_anterior, posterior: audit.metadados.estado_posterior,
      acao: audit.metadados.acao })), [{ evento: 'administracao.vinculo.inativado',
      anterior: 'ativo', posterior: 'inativo', acao: 'inativado' }]);

    const reactivationIdentity = identity('usuario.alterar_vinculos', 'reactivate-link');
    const reactivated = await repo().applyUserPropertyDelta({ principal: actor(),
      identity: reactivationIdentity, userId: collaboratorId,
      expectedVersion: removedVersion, add: [row.id], remove: [],
      reason: { code: 'outro', detail: 'Correção de vínculo validada' } });
    assert.equal(reactivated.status, 'completed');
    const reactivationAudit = await owner.query(`SELECT evento,motivo_categoria,metadados
      FROM public.eventos_auditoria WHERE request_id=$1`, [reactivationIdentity.requestId]);
    assert.deepEqual(reactivationAudit.rows.map((audit) => ({ evento: audit.evento,
      motivo: audit.motivo_categoria, anterior: audit.metadados.estado_anterior,
      posterior: audit.metadados.estado_posterior, acao: audit.metadados.acao,
      detalhe: audit.metadados.motivo_detalhe })), [{
      evento: 'administracao.vinculo.reativado', motivo: 'outro', anterior: 'inativo',
      posterior: 'ativo', acao: 'reativado', detalhe: 'Correção de vínculo validada',
    }]);
  });

  test('Localidades leem as 27 UFs e paginam Municípios no snapshot escolhido', async () => {
    const states = await repo().listStates({ principal: actor() });
    assert.equal(states.versionId, 'ibge-localidades-2026-08-25');
    assert.equal(states.items.length, 27);
    assert.deepEqual(states.items.find((state) => state.id === '43'),
      { id: '43', code: 'RS', name: 'Rio Grande do Sul' });
    const first = await repo().listMunicipalities({ principal: actor(), stateId: '43',
      search: 'Cachoeira', limit: 1 });
    assert.ok(first); assert.equal(first.versionId, states.versionId);
    assert.equal(first.items.length, 1);
    const last = first.items[0]; assert.ok(last);
    const second = await repo().listMunicipalities({ principal: actor(), stateId: '43',
      search: 'Cachoeira', versionId: first.versionId,
      cursor: { versionId: first.versionId, sortKey: last.sortKey, id: last.id }, limit: 10 });
    assert.ok(second); assert.equal(second.versionId, first.versionId);
    assert.notEqual(second.items[0]?.id, last.id);
    assert.equal(await repo().listMunicipalities({ principal: actor(), stateId: '99', limit: 10 }), null);
  });

  test('concorrência de criação serializa replay exato e conflito de corpo pela mesma chave', async () => {
    assert.ok(owner);
    const sameIdentity = identity('propriedade.criar', 'race-create-same');
    const [first, second] = await observedOrganizationPair(() => [
      repo().createProperty({ principal: actor(), identity: sameIdentity,
        name: 'Criação concorrente igual', holderId, municipalityId: MUNICIPALITY_ID,
        status: 'inativa' }),
      repo().createProperty({ principal: actor(), identity: sameIdentity,
        name: 'Criação concorrente igual', holderId, municipalityId: MUNICIPALITY_ID,
        status: 'inativa' }),
    ]);
    assert.deepEqual([first.status, second.status].sort(), ['completed', 'replayed']);
    const sameEffects = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades WHERE nome='Criação concorrente igual')::text AS properties,
      (SELECT count(*) FROM public.eventos_auditoria WHERE request_id=$1)::text AS audits`,
    [sameIdentity.requestId]);
    assert.deepEqual(sameEffects.rows[0], { properties: '1', audits: '1' });
    const otherActorId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Outro Admin idempotente',$3,'admin','ativo')`,
    [otherActorId, ORGANIZATION_ID, `other-idempotency-${otherActorId}@example.test`]);
    const otherSessionId = await createSession(otherActorId, 1);
    const otherActor = await repo().createProperty({ principal: actor(),
      identity: { ...sameIdentity, sessionId: otherSessionId },
      name: 'Criação concorrente igual', holderId, municipalityId: MUNICIPALITY_ID,
      status: 'inativa' });
    assert.equal(otherActor.status, 'completed');
    const actorScope = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades WHERE nome='Criação concorrente igual')::text AS properties,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE chave_idempotencia_hash=$1)::text AS commands`, [sameIdentity.idempotencyKeyHash]);
    assert.deepEqual(actorScope.rows[0], { properties: '2', commands: '2' });

    const base = identity('propriedade.criar', 'race-create-different');
    const divergent = { ...base, requestHash: digest('request-race-create-different-body') };
    const [left, right] = await observedOrganizationPair(() => [
      repo().createProperty({ principal: actor(), identity: base,
        name: 'Criação concorrente corpo A', holderId, municipalityId: MUNICIPALITY_ID,
        status: 'inativa' }),
      repo().createProperty({ principal: actor(), identity: divergent,
        name: 'Criação concorrente corpo B', holderId, municipalityId: MUNICIPALITY_ID,
        status: 'inativa' }),
    ]);
    assert.deepEqual([left.status, right.status].sort(), ['completed', 'idempotency_conflict']);
    const divergentEffects = await owner.query(`SELECT
      (SELECT count(*) FROM public.propriedades
       WHERE nome IN ('Criação concorrente corpo A','Criação concorrente corpo B'))::text AS properties,
      (SELECT count(*) FROM public.eventos_auditoria WHERE request_id=$1)::text AS audits,
      (SELECT count(*) FROM public.comandos_administrativos_idempotencia
       WHERE ator_usuario_id=$2 AND chave_idempotencia_hash=$3)::text AS commands`,
    [base.requestId, actor().id, base.idempotencyKeyHash]);
    assert.deepEqual(divergentEffects.rows[0], { properties: '1', audits: '1', commands: '1' });
  });

  test('concorrência de deltas e status preserva versões e ordem global sem deadlock', async () => {
    assert.ok(owner);
    const propertyIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await owner.query(`INSERT INTO public.propriedades
      (id,organizacao_id,titular_id,nome,localidades_versao_id,municipio_id,
       municipio_nome,uf_id,uf_sigla,status) VALUES
      ($1,$5,$6,'Corrida delta A','ibge-localidades-2026-08-25',$7,'Caxias do Sul','43','RS','ativa'),
      ($2,$5,$6,'Corrida delta B','ibge-localidades-2026-08-25',$7,'Caxias do Sul','43','RS','ativa'),
      ($3,$5,$6,'Corrida status delta','ibge-localidades-2026-08-25',$7,'Caxias do Sul','43','RS','ativa'),
      ($4,$5,$6,'Corrida dois status','ibge-localidades-2026-08-25',$7,'Caxias do Sul','43','RS','ativa')`,
    [...propertyIds, ORGANIZATION_ID, holderId, MUNICIPALITY_ID]);
    const deltaUser = randomUUID(); const mixedUser = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$3,'Delta concorrente',$4,'colaborador','ativo'),
      ($2,$3,'Status delta concorrente',$5,'colaborador','ativo')`,
    [deltaUser, mixedUser, ORGANIZATION_ID,
      `delta-race-${deltaUser}@example.test`, `mixed-race-${mixedUser}@example.test`]);
    await owner.query(`INSERT INTO public.usuario_propriedade
      (organizacao_id,usuario_id,propriedade_id,tipo_vinculo,status,origem)
      VALUES ($1,$2,$3,'colaborador','ativo','admin_manual')`,
    [ORGANIZATION_ID, mixedUser, propertyIds[2]]);

    const deltaPair = await observedOrganizationPair(() => [
      repo().applyUserPropertyDelta({ principal: actor(),
        identity: identity('usuario.alterar_vinculos', 'race-delta-a'), userId: deltaUser,
        expectedVersion: 1, add: [propertyIds[0]!], remove: [],
        reason: { code: 'correcao_administrativa' } }),
      repo().applyUserPropertyDelta({ principal: actor(),
        identity: identity('usuario.alterar_vinculos', 'race-delta-b'), userId: deltaUser,
        expectedVersion: 1, add: [propertyIds[1]!], remove: [],
        reason: { code: 'correcao_administrativa' } }),
    ]);
    assert.deepEqual(deltaPair.map((result) => result.status).sort(),
      ['completed', 'version_conflict']);
    const deltaState = await owner.query(`SELECT u.versao::text,
      count(v.id)::text AS links FROM public.usuarios u LEFT JOIN public.usuario_propriedade v
      ON v.usuario_id=u.id WHERE u.id=$1 GROUP BY u.id`, [deltaUser]);
    assert.deepEqual(deltaState.rows[0], { versao: '2', links: '1' });

    const statusVsDelta = await observedOrganizationPair(() => [
      repo().changePropertyStatus({ principal: actor(),
        identity: identity('propriedade.alterar_status', 'race-status-delta-status'),
        propertyId: propertyIds[2]!, expectedVersion: 1, status: 'inativa',
        reason: { code: 'suspensao_operacional' } }),
      repo().applyUserPropertyDelta({ principal: actor(),
        identity: identity('usuario.alterar_vinculos', 'race-status-delta-link'),
        userId: mixedUser, expectedVersion: 1, add: [], remove: [propertyIds[2]!],
        reason: { code: 'fim_relacao' } }),
    ]);
    assert.equal(statusVsDelta[0].status, 'completed');
    assert.ok(['completed', 'version_conflict'].includes(statusVsDelta[1].status));

    const statusPair = await observedOrganizationPair(() => [
      repo().changePropertyStatus({ principal: actor(),
        identity: identity('propriedade.alterar_status', 'race-status-a'),
        propertyId: propertyIds[3]!, expectedVersion: 1, status: 'inativa',
        reason: { code: 'suspensao_operacional' } }),
      repo().changePropertyStatus({ principal: actor(),
        identity: identity('propriedade.alterar_status', 'race-status-b'),
        propertyId: propertyIds[3]!, expectedVersion: 1, status: 'inativa',
        reason: { code: 'suspensao_operacional' } }),
    ]);
    assert.deepEqual(statusPair.map((result) => result.status).sort(),
      ['completed', 'version_conflict']);
  });

  test('ativação primeiro vence desativação do Titular em três corridas observáveis', async () => {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      await runHolderStatusRace('activation_first', repetition);
    }
  });

  test('desativação primeiro vence ativação da Propriedade em três corridas observáveis', async () => {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      await runHolderStatusRace('deactivation_first', repetition);
    }
  });

  test('concorrência produz um sucesso e um version_conflict observável', async () => {
    assert.ok(owner); const current = await owner.query<{ id: string; versao: string }>(
      `SELECT id,versao FROM public.propriedades WHERE nome='Segunda MP35C'`);
    const row = current.rows[0]; assert.ok(row);
    assert.ok(runtimeRole);
    const controller = await owner.connect(); let lockHeld = false;
    try {
      await controller.query(`SELECT pg_catalog.pg_advisory_lock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      lockHeld = true;
      const operations = [
        repo().updateProperty({ principal: actor(), identity: identity('propriedade.atualizar', 'race-a'),
          propertyId: row.id, expectedVersion: Number(row.versao), name: 'Segunda MP35C A' }),
        repo().updateProperty({ principal: actor(), identity: identity('propriedade.atualizar', 'race-b'),
          propertyId: row.id, expectedVersion: Number(row.versao), name: 'Segunda MP35C B' }),
      ] as const;
      const deadline = Date.now() + 5_000;
      let waits: readonly Readonly<{ pid: number; wait_event_type: string; wait_event: string }>[] = [];
      while (Date.now() < deadline && waits.length < 2) {
        const activity = await owner.query<{ pid: number; wait_event_type: string; wait_event: string }>(`
          SELECT pid,wait_event_type,wait_event FROM pg_catalog.pg_stat_activity
          WHERE application_name=$1 AND state='active' AND wait_event_type='Lock'
            AND query LIKE '%tche_admin_atualizar_propriedade_mp35c%'
          ORDER BY pid`, [runtimeRole]);
        waits = activity.rows;
        if (waits.length < 2) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waits.length, 2, 'as duas mutações devem aguardar o lock organizacional');
      assert.deepEqual(waits.map((wait) => `${wait.wait_event_type}:${wait.wait_event}`),
        ['Lock:advisory', 'Lock:advisory']);
      await controller.query(`SELECT pg_catalog.pg_advisory_unlock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      lockHeld = false;
      const [left, right] = await Promise.all(operations);
      assert.deepEqual([left.status, right.status].sort(), ['completed', 'version_conflict']);
    } finally {
      if (lockHeld) await controller.query(`SELECT pg_catalog.pg_advisory_unlock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      controller.release();
    }
  });

  test('login e D13 compartilham o lock por Usuário nos dois ordenamentos observáveis', async () => {
    assert.ok(owner); assert.ok(runtime); assert.ok(runtimeRole);
    const property = await owner.query<{ id: string }>(`SELECT id FROM public.propriedades
      WHERE nome='Segunda MP35C A' OR nome='Segunda MP35C B' LIMIT 1`);
    const propertyId = property.rows[0]?.id; assert.ok(propertyId);
    const createTarget = async (label: string) => {
      const id = randomUUID();
      await owner!.query(`INSERT INTO public.usuarios
        (id,organizacao_id,nome,email,perfil,status) VALUES
        ($1,$2,$3,$4,'colaborador','ativo')`,
      [id, ORGANIZATION_ID, `Login D13 ${label}`, `${label}-${id}@example.test`]);
      return id;
    };
    const login = (userId: string, label: string) => authRepository().createSession({
      userId, authorizationVersion: 1,
      accessTokenHash: randomBytes(32).toString('base64url'),
      refreshTokenHash: randomBytes(32).toString('base64url'),
      accessTtlSeconds: 900, absoluteTtlSeconds: 86_400,
      inactivityTtlSeconds: 3_600, requestId: `request-login-d13-${label}`,
    });
    const waitForLocks = async (minimum: number) => {
      const deadline = Date.now() + 5_000;
      let rows: readonly { pid: number; query: string; wait_event: string }[] = [];
      while (Date.now() < deadline && rows.length < minimum) {
        const activity = await owner!.query<{ pid: number; query: string; wait_event: string }>(`
          SELECT pid,query,wait_event FROM pg_catalog.pg_stat_activity
          WHERE application_name=$1 AND state='active' AND wait_event_type='Lock'
          ORDER BY pid`, [runtimeRole]);
        rows = activity.rows;
        if (rows.length < minimum) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(rows.length >= minimum, `esperados ${minimum} waits, obtidos ${rows.length}`);
      return rows;
    };

    const loginFirstUser = await createTarget('login-first');
    const loginGate = 35_000_991;
    const loginBlocker = await owner.connect(); let loginGateHeld = false;
    await owner.query(`CREATE FUNCTION public.tche_test_pause_login_mp35c()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.usuario_id='${loginFirstUser}'::uuid THEN
          PERFORM pg_catalog.pg_advisory_xact_lock(${loginGate}::bigint);
        END IF; RETURN NEW; END $$`);
    await owner.query(`CREATE TRIGGER tche_test_pause_login_mp35c
      BEFORE INSERT ON public.sessoes_autenticacao FOR EACH ROW
      EXECUTE FUNCTION public.tche_test_pause_login_mp35c()`);
    try {
      await loginBlocker.query('SELECT pg_catalog.pg_advisory_lock($1::bigint)', [loginGate]);
      loginGateHeld = true;
      const loginOperation = login(loginFirstUser, 'login-first');
      const loginWait = await waitForLocks(1);
      assert.ok(loginWait.some((item) => item.query.includes('INSERT INTO public.sessoes_autenticacao')));
      const mutationOperation = repo().applyUserPropertyDelta({ principal: actor(),
        identity: identity('usuario.alterar_vinculos', 'login-first-d13'),
        userId: loginFirstUser, expectedVersion: 1, add: [propertyId], remove: [],
        reason: { code: 'correcao_administrativa' } });
      const bothWait = await waitForLocks(2);
      assert.equal(new Set(bothWait.map((item) => item.pid)).size, bothWait.length);
      assert.ok(bothWait.every((item) => item.wait_event === 'advisory'));
      await loginBlocker.query('SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [loginGate]);
      loginGateHeld = false;
      const [created, changed] = await Promise.all([loginOperation, mutationOperation]);
      assert.equal(created.status, 'created'); assert.equal(changed.status, 'completed');
      if (created.status === 'created') {
        const state = await owner.query(`SELECT s.status,s.versao_autorizacao::text AS session_version,
          u.versao_autorizacao::text AS user_version FROM public.sessoes_autenticacao s
          JOIN public.usuarios u ON u.id=s.usuario_id WHERE s.id=$1`, [created.sessionId]);
        assert.deepEqual(state.rows[0], { status: 'revogada', session_version: '1', user_version: '2' });
      }
    } finally {
      if (loginGateHeld) await loginBlocker.query(
        'SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [loginGate]);
      loginBlocker.release();
      await owner.query('DROP TRIGGER IF EXISTS tche_test_pause_login_mp35c ON public.sessoes_autenticacao');
      await owner.query('DROP FUNCTION IF EXISTS public.tche_test_pause_login_mp35c()');
    }

    const mutationFirstUser = await createTarget('mutation-first');
    const mutationGate = 35_000_992;
    const mutationBlocker = await owner.connect(); let mutationGateHeld = false;
    await owner.query(`CREATE FUNCTION public.tche_test_pause_d13_mp35c()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${mutationFirstUser}'::uuid
          AND NEW.versao_autorizacao > OLD.versao_autorizacao THEN
          PERFORM pg_catalog.pg_advisory_xact_lock(${mutationGate}::bigint);
        END IF; RETURN NEW; END $$`);
    await owner.query(`CREATE TRIGGER tche_test_pause_d13_mp35c
      BEFORE UPDATE ON public.usuarios FOR EACH ROW
      EXECUTE FUNCTION public.tche_test_pause_d13_mp35c()`);
    try {
      await mutationBlocker.query('SELECT pg_catalog.pg_advisory_lock($1::bigint)', [mutationGate]);
      mutationGateHeld = true;
      const mutationOperation = repo().applyUserPropertyDelta({ principal: actor(),
        identity: identity('usuario.alterar_vinculos', 'mutation-first-d13'),
        userId: mutationFirstUser, expectedVersion: 1, add: [propertyId], remove: [],
        reason: { code: 'correcao_administrativa' } });
      await waitForLocks(1);
      const loginOperation = login(mutationFirstUser, 'mutation-first');
      const bothWait = await waitForLocks(2);
      assert.equal(new Set(bothWait.map((item) => item.pid)).size, bothWait.length);
      await mutationBlocker.query('SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [mutationGate]);
      mutationGateHeld = false;
      const [changed, created] = await Promise.all([mutationOperation, loginOperation]);
      assert.equal(changed.status, 'completed'); assert.equal(created.status, 'created');
      if (created.status === 'created') {
        assert.equal(created.authorizationVersion, 2);
        const state = await owner.query(`SELECT s.status,s.versao_autorizacao::text AS session_version,
          u.versao_autorizacao::text AS user_version FROM public.sessoes_autenticacao s
          JOIN public.usuarios u ON u.id=s.usuario_id WHERE s.id=$1`, [created.sessionId]);
        assert.deepEqual(state.rows[0], { status: 'ativa', session_version: '2', user_version: '2' });
      }
    } finally {
      if (mutationGateHeld) await mutationBlocker.query(
        'SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [mutationGate]);
      mutationBlocker.release();
      await owner.query('DROP TRIGGER IF EXISTS tche_test_pause_d13_mp35c ON public.usuarios');
      await owner.query('DROP FUNCTION IF EXISTS public.tche_test_pause_d13_mp35c()');
    }
    const stale = await owner.query(`SELECT count(*)::text AS count
      FROM public.sessoes_autenticacao s JOIN public.usuarios u ON u.id=s.usuario_id
      WHERE s.usuario_id=ANY($1::uuid[]) AND s.status='ativa'
        AND s.versao_autorizacao <> u.versao_autorizacao`,
    [[loginFirstUser, mutationFirstUser]]);
    assert.equal(stale.rows[0]?.count, '0');
  });

  test('revogação concorrente do Admin vence o lock e o comando MP-35C revalida sem efeitos', async () => {
    assert.ok(owner); assert.ok(runtime); assert.ok(runtimeRole);
    const executor = actor();
    const revokerId = randomUUID();
    await owner.query(`INSERT INTO public.usuarios
      (id,organizacao_id,nome,email,perfil,status) VALUES
      ($1,$2,'Admin revogador',$3,'admin','ativo')`,
    [revokerId, ORGANIZATION_ID, `revoker-${revokerId}@example.test`]);
    const revokerSessionId = await createSession(revokerId, 1);
    const commandIdentity = identity('propriedade.criar', 'admin-revocation-race');
    const blocker = await runtime.connect();
    let open = false;
    try {
      await blocker.query('BEGIN'); open = true;
      const blockerPid = await blocker.query<{ pid: number }>('SELECT pg_catalog.pg_backend_pid() AS pid');
      await blocker.query(`SELECT pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended($1,35000037))`, [ORGANIZATION_ID]);
      const revokePayload = { organizacao_id: ORGANIZATION_ID, ator_usuario_id: revokerId,
        sessao_id: revokerSessionId, ator_versao_autorizacao: 1,
        request_id: 'request-admin-revoker', correlation_id: 'correlation-admin-revoker',
        chave_idempotencia_hash: digest('key-admin-revoker').toString('hex'),
        hash_requisicao: digest('request-admin-revoker').toString('hex'),
        usuario_id: executor.id, versao: 1, status: 'inativo',
        motivo: 'suspensao_operacional' };
      const revoked = await blocker.query(`SELECT * FROM
        public.tche_admin_alterar_status_usuario_mp35b($1::jsonb)`,
      [JSON.stringify(revokePayload)]);
      assert.equal(revoked.rows[0]?.status, 'completed');

      const operation = repo().createProperty({ principal: executor,
        identity: commandIdentity, name: 'Não criar na corrida', holderId,
        municipalityId: MUNICIPALITY_ID, status: 'inativa' });
      const deadline = Date.now() + 5_000;
      let waiting: { pid: number; wait_event_type: string; wait_event: string } | undefined;
      while (Date.now() < deadline && waiting === undefined) {
        const activity = await owner.query<{ pid: number; wait_event_type: string; wait_event: string }>(`
          SELECT pid,wait_event_type,wait_event FROM pg_catalog.pg_stat_activity
          WHERE application_name=$1 AND state='active' AND wait_event_type='Lock'
            AND query LIKE '%tche_admin_criar_propriedade_mp35c%'
          ORDER BY pid`, [runtimeRole]);
        waiting = activity.rows[0];
        if (waiting === undefined) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(waiting, 'o comando MP-35C deve aguardar o lock organizacional');
      assert.notEqual(waiting.pid, blockerPid.rows[0]?.pid);
      assert.deepEqual({ type: waiting.wait_event_type, event: waiting.wait_event },
        { type: 'Lock', event: 'advisory' });
      await blocker.query('COMMIT'); open = false;
      assert.equal((await operation).status, 'invalid_session');
      const effects = await owner.query(`SELECT
        (SELECT count(*) FROM public.propriedades WHERE nome='Não criar na corrida')::text AS properties,
        (SELECT count(*) FROM public.eventos_auditoria WHERE request_id=$1)::text AS audits,
        (SELECT count(*) FROM public.comandos_administrativos_idempotencia
          WHERE request_id=$1)::text AS commands`, [commandIdentity.requestId]);
      assert.deepEqual(effects.rows[0], { properties: '0', audits: '0', commands: '0' });
    } finally {
      if (open) await blocker.query('ROLLBACK');
      blocker.release();
    }
  });

  test('D13: revalidação SQL recusa principal Admin tornado stale', async () => {
    assert.ok(owner); const principal = actor();
    await owner.query(`UPDATE public.usuarios SET versao_autorizacao=versao_autorizacao+1 WHERE id=$1`,
      [principal.id]);
    const result = await repo().createProperty({ principal,
      identity: identity('propriedade.criar', 'stale-admin'), name: 'Não criar', holderId,
      municipalityId: MUNICIPALITY_ID, status: 'inativa' });
    assert.equal(result.status, 'invalid_session');
    const persisted = await owner.query(`SELECT count(*)::text AS count FROM public.propriedades
      WHERE nome='Não criar'`); assert.equal(persisted.rows[0]?.count, '0');
  });
});
