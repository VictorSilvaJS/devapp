import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  testsDirectory,
  '..',
  '..',
  'migrations',
  '000005-notificacoes.sql',
);

test('MP-34 cria eventos, entregas e comandos idempotentes sem reutilizar a outbox', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  for (const fragment of [
    'CREATE TABLE public.notificacao_evento',
    'CREATE TABLE public.notificacao_entrega',
    'CREATE TABLE public.notificacao_comando_idempotencia',
    "'conta.senha_alterada.v1'",
    "'conta.email_principal_alterado.v1'",
    "'conta.recuperacao_concluida.v1'",
    "CHECK (prioridade IN ('baixa', 'normal', 'alta'))",
    "CHECK (expira_em = criada_em + interval '90 days')",
    'UNIQUE (organizacao_id, tipo_evento, chave_origem)',
    'UNIQUE (organizacao_id, usuario_id, chave_idempotencia_hash)',
    'CREATE ROLE tche_agro_notifications_maintenance',
    'tche_restringir_operacao_notificacoes',
    'Runtime e manutencao de notificacoes exigem credenciais distintas.',
    'Uma entrega vigente nao pode ser purgada.',
  ]) {
    assert.ok(sql.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(sql, /ALTER TABLE public\.outbox_email/i);
  assert.doesNotMatch(sql, /ON DELETE CASCADE|DROP EXTENSION/i);
  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:INSERT|UPDATE|TRUNCATE)[^;]*TO tche_agro_notifications_maintenance/i,
  );
  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:UPDATE\s+ON|DELETE|TRUNCATE)[^;]*TO tche_agro_runtime/i,
  );
  assert.match(
    sql,
    /GRANT UPDATE \(lida_em, descartada_em\)\s+ON public\.notificacao_entrega TO tche_agro_runtime/i,
  );
});

test('MP-34 separa o instante do resultado da retenção de uma nova chave', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.ok(sql.includes('resultado_em IS NULL OR resultado_em <= processado_em'));
  assert.ok(sql.includes("expira_em = processado_em + interval '90 days'"));
  assert.ok(sql.includes('corte_em IS NULL OR corte_em = processado_em'));
});
