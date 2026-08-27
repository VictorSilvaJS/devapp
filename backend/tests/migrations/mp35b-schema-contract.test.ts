import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const migrationFile = join(
  testsDirectory,
  '..',
  '..',
  'migrations',
  '000008-administracao-usuarios-mp35b.sql',
);

test('MP-35B remove DML runtime e expõe somente funções estreitas', async () => {
  const sql = await readFile(migrationFile, 'utf8');
  const up = sql.split('-- Down Migration')[0] ?? '';

  for (const fragment of [
    'CREATE ROLE tche_agro_administration_owner',
    'REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuarios FROM tche_agro_runtime',
    'REVOKE INSERT, UPDATE, DELETE ON TABLE public.produtores FROM tche_agro_runtime',
    'REVOKE INSERT ON TABLE public.eventos_auditoria FROM tche_agro_runtime',
    'REVOKE INSERT ON TABLE\n  public.notificacao_evento,\n  public.notificacao_entrega\nFROM tche_agro_runtime',
    ') ON public.eventos_auditoria FROM tche_agro_runtime',
    'REVOKE SELECT, INSERT, UPDATE, DELETE\n  ON TABLE public.comandos_administrativos_idempotencia',
    'SECURITY DEFINER',
    'tche_exigir_runtime_exclusivo_mp35b',
    'tche_auditoria_inserir_interno_mp35b',
    'tche_aud_convite_criado_mp35b',
    'tche_aud_sessao_criada_mp35b',
    'tche_aud_notificacao_criada_mp35b',
    'tche_aud_notificacao_deduplicada_mp35b',
    'tche_aud_notificacao_destino_negado_mp35b',
    'tche_notificacao_entregar_conta_mp35b',
    'tche_notificacao_resolver_destino_mp35b',
    'ck_mp35b_notificacao_fato_corrente',
    'ck_mp35b_notificacao_tentativa_replay',
    'ck_mp35b_notificacao_resolucao_sessao',
    'uq_mp35b_notificacao_resolucao_request',
    'ck_mp35b_auditoria_prova_transacao',
    'ck_mp35b_auditoria_metadados_fixos',
    'tche_admin_criar_usuario_mp35b',
    'tche_admin_atualizar_usuario_mp35b',
    'tche_admin_alterar_status_usuario_mp35b',
    'tche_admin_emitir_convite_usuario_mp35b',
    'tche_conta_ativar_usuario_por_convite_mp35b',
    'GRANT EXECUTE ON FUNCTION',
    'ix_usuarios_organizacao_nome_id_mp35b',
    'ON public.usuarios (organizacao_id, pg_catalog.lower(nome), id)',
    'REVOKE ALL ON FUNCTION\n  public.tche_preservar_comando_administrativo_mp35b()\nFROM PUBLIC',
    'tche_serializar_propriedade_titular_mp35b',
    'trg_propriedades_serializar_titular_mp35b',
    'REVOKE ALL ON FUNCTION\n  public.tche_serializar_propriedade_titular_mp35b()\nFROM PUBLIC',
    'pg_catalog.pg_advisory_xact_lock',
    'CREATE VIEW public.estados_outbox_conta_mp35b',
    'GRANT SELECT ON TABLE public.estados_outbox_conta_mp35b\n  TO tche_agro_outbox_worker',
  ]) {
    assert.ok(up.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(
    up,
    /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*ON\s+(?:TABLE\s+)?public\.(?:usuarios|produtores)[^;]*TO\s+tche_agro_runtime/isu,
  );
  assert.doesNotMatch(
    up,
    /GRANT\s+SELECT[^;]*comandos_administrativos_idempotencia[^;]*tche_agro_runtime/isu,
  );
  assert.doesNotMatch(
    up,
    /GRANT\s+INSERT[^;]*eventos_auditoria[^;]*tche_agro_runtime/isu,
  );
  assert.doesNotMatch(
    up,
    /GRANT\s+INSERT[^;]*notificacao_(?:evento|entrega)[^;]*tche_agro_runtime/isu,
  );
  assert.match(
    up,
    /REVOKE EXECUTE ON FUNCTION[\s\S]*tche_aud_notificacao_criada_mp35b\(jsonb\),[\s\S]*tche_aud_notificacao_deduplicada_mp35b\(jsonb\),[\s\S]*tche_aud_notificacao_destino_negado_mp35b\(jsonb\)[\s\S]*FROM tche_agro_runtime, PUBLIC/iu,
  );
  assert.match(
    up,
    /GRANT EXECUTE ON FUNCTION[\s\S]*tche_notificacao_entregar_conta_mp35b\(uuid, uuid\),[\s\S]*tche_notificacao_resolver_destino_mp35b\(uuid, uuid, text\)[\s\S]*TO tche_agro_runtime/iu,
  );
  for (const operation of [
    'tche_notificacao_entregar_conta_mp35b',
    'tche_notificacao_resolver_destino_mp35b',
  ]) {
    const body = up.match(
      new RegExp(
        `CREATE FUNCTION public\\.${operation}\\([\\s\\S]*?\\n\\$\\$;`,
        'u',
      ),
    )?.[0] ?? '';
    assert.match(body, /SECURITY DEFINER/iu, operation);
    assert.match(body, /SET search_path = pg_catalog, public/iu, operation);
    assert.doesNotMatch(body, /\bEXECUTE\b|pg_catalog\.format\(/iu, operation);
  }
  assert.match(
    sql.split('-- Down Migration')[1] ?? '',
    /GRANT\s+INSERT\s+ON\s+TABLE\s+public\.eventos_auditoria\s+TO\s+tche_agro_runtime/iu,
  );
  assert.match(
    sql.split('-- Down Migration')[1] ?? '',
    /GRANT\s+INSERT\s+ON\s+TABLE\s+public\.notificacao_evento,\s*public\.notificacao_entrega\s+TO\s+tche_agro_runtime/iu,
  );
  assert.doesNotMatch(up, /ON DELETE CASCADE|DROP EXTENSION/iu);
  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES ON SCHEMA public[\s\S]*DROP ROLE IF EXISTS tche_agro_administration_owner/iu,
  );
});
