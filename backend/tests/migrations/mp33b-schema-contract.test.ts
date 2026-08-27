import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  migrationSha256,
  normalizeMigrationSql,
  verifyMigrationIntegrity,
} from '../../scripts/migration-integrity.js';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = join(testsDirectory, '..', '..');
const migrationsDirectory = join(backendDirectory, 'migrations');

async function migration(file: string): Promise<string> {
  return readFile(join(migrationsDirectory, file), 'utf8');
}

test('mantém 000001 imutável e sela o manifesto ativo', async () => {
  const initialBytes = await readFile(
    join(migrationsDirectory, '000001-initial-schema.sql'),
  );
  assert.equal(
    migrationSha256(normalizeMigrationSql(initialBytes)),
    '1a3d2ba528caa3a9e8e1a9d26812f94ba33d66de840decd9da64476be4974d38',
  );

  const verified = await verifyMigrationIntegrity({ migrationsDirectory });
  assert.equal(verified.checkedMigrations, 8);
});

test('DDL de identidade persiste somente PHC e contato secundário verificável', async () => {
  const sql = await migration('000002-identidade-autenticacao.sql');

  for (const fragment of [
    'ADD COLUMN versao_autorizacao bigint',
    'CREATE TABLE public.credenciais_usuario',
    'senha_phc text NOT NULL',
    "senha_phc LIKE '$argon2id$%'",
    'CREATE TABLE public.contatos_email_usuario',
    "tipo = 'recuperacao'",
    'CREATE TABLE public.bootstrap_autenticacao',
    'ck_bootstrap_autenticacao_irreversivel',
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(sql, /senha_(?:plana|texto|raw)|token_(?:plano|raw)|DROP EXTENSION/i);
});

test('DDL de sessão usa somente hashes, rotação estrita e expirações persistidas', async () => {
  const sql = await migration('000003-sessoes-desafios.sql');

  for (const fragment of [
    'CREATE TABLE public.sessoes_autenticacao',
    'expira_inatividade_em timestamptz NOT NULL',
    'expira_absolutamente_em timestamptz NOT NULL',
    'CREATE TABLE public.tokens_acesso',
    'CREATE TABLE public.tokens_refresh',
    'token_refresh_anterior_id uuid',
    'ux_tokens_refresh_ativo_por_sessao',
    'CREATE TABLE public.desafios_autenticacao',
    'CREATE TABLE public.autorizacoes_restritas',
    'CREATE TABLE public.buckets_limite_autenticacao',
    'desafio_email_atual_id uuid NOT NULL',
    'desafio_email_novo_id uuid',
    'ct_solicitacoes_alteracao_email_dupla_confirmacao',
  ]) {
    assert.ok(sql.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(sql, /token_(?:valor|plano|raw)\s+text/i);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
});

test('DDL final separa outbox, auditoria append-only e papéis mínimos', async () => {
  const sql = await migration('000004-recuperacao-outbox-auditoria.sql');

  for (const fragment of [
    'CREATE TABLE public.convites_usuario',
    "modo_ativacao IN ('manter_status', 'ativar_admin_bootstrap')",
    'CREATE TABLE public.recuperacoes_assistidas',
    "origem text NOT NULL DEFAULT 'admin_http'",
    'CREATE TABLE public.aprovacoes_recuperacao_assistida',
    'CREATE TABLE public.recuperacoes_admin_email_secundario',
    'desafio_secundario_id uuid NOT NULL',
    'desafio_email_novo_id uuid',
    'ct_recuperacoes_admin_contato_verificado',
    "origem = 'admin_http' AND perfil_alvo IN ('colaborador', 'produtor')",
    "origem = 'plataforma_cli' AND perfil_alvo = 'admin'",
    'CREATE TABLE public.outbox_email',
    'payload_cifrado bytea',
    'nonce_hash bytea NOT NULL',
    'tche_preservar_hash_nonce_outbox',
    'lease_token uuid',
    'expira_em timestamptz NOT NULL',
    'CREATE TABLE public.eventos_auditoria',
    'usuario_afetado_id uuid',
    'uq_sessoes_autenticacao_ator_auditoria',
    'fk_eventos_auditoria_sessao_do_ator',
    'FOREIGN KEY (organizacao_id, ator_usuario_id, sessao_id)',
    'AND sessao_id IS NULL',
    'fk_eventos_auditoria_usuario_afetado_mesma_organizacao',
    'ix_eventos_auditoria_usuario_afetado_ocorrido',
    'Eventos de auditoria sao append-only.',
    'CREATE ROLE tche_agro_runtime',
    'CREATE ROLE tche_agro_outbox_worker',
    'CREATE ROLE tche_agro_platform_ops',
    'tche_bloquear_runtime_recuperacao_plataforma',
    "OLD.status = 'aguardando_confirmacao_email'",
    "NEW.status = 'aguardando_nova_senha'",
    "OLD.status = 'aguardando_nova_senha'",
    "NEW.status = 'concluida'",
    "TG_OP = 'INSERT' AND NEW.origem = 'plataforma_cli'",
    'ct_recuperacoes_assistidas_desafio_compativel',
    'ct_recuperacoes_assistidas_autorizacao_compativel',
    'ct_validar_conclusao_recuperacao_assistida',
    'ct_validar_recuperacoes_assistidas_em_usuarios',
    'ct_validar_recuperacoes_assistidas_em_desafios',
    'ct_validar_recuperacoes_assistidas_em_autorizacoes',
    'tche_restringir_platform_usuario',
    'tche_restringir_platform_bootstrap',
    'tche_executa_com_papel_operacional',
    'pg_catalog.pg_has_role(SESSION_USER',
    'tche_restringir_platform_desafio_bootstrap',
    'tche_validar_platform_desafio_bootstrap',
    'tche_restringir_platform_convite_bootstrap',
    'tche_restringir_platform_outbox_bootstrap',
    'tche_validar_platform_estado_final_bootstrap',
    'ct_bootstrap_platform_admin_referenciado',
    'ct_bootstrap_platform_email_com_rotacao',
    'ct_bootstrap_platform_estado_final_completo',
    'tche_restringir_auditoria_papeis_operacionais',
    'ux_eventos_auditoria_outbox_terminal',
    'ck_auditoria_worker_resultado_outbox',
    'GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_runtime',
    'GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_platform_ops',
    'DROP ROLE IF EXISTS tche_agro_platform_ops',
    'DROP ROLE IF EXISTS tche_agro_outbox_worker',
  ]) {
    assert.ok(sql.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(sql, /GRANT\s+(?:ALL|UPDATE|DELETE|TRUNCATE)[^;]*eventos_auditoria/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE)[^;]*propriedades/i);
  assert.doesNotMatch(sql, /ON DELETE CASCADE|DROP EXTENSION/i);

  const platformGrants = sql
    .split(';')
    .filter((statement) => statement.includes('TO tche_agro_platform_ops'))
    .join(';');
  assert.doesNotMatch(
    platformGrants,
    /public\.(?:credenciais_usuario|sessoes_autenticacao|tokens_acesso|tokens_refresh)/i,
  );
  assert.match(
    platformGrants,
    /GRANT UPDATE\s*\(\s*email\s*\) ON public\.usuarios/i,
  );
  assert.doesNotMatch(
    platformGrants,
    /GRANT UPDATE\s*\([^)]*(?:nome|status|versao_autorizacao)[^)]*\) ON public\.usuarios/i,
  );
  assert.doesNotMatch(
    platformGrants,
    /GRANT\s+(?:INSERT|UPDATE)\s*\([^;]*ON public\.recuperacoes_assistidas/i,
  );
  assert.doesNotMatch(
    platformGrants,
    /GRANT\s+(?:INSERT|UPDATE)\s*\([^;]*ON public\.autorizacoes_restritas/i,
  );
});

test('recuperação do Admin separa confirmação secundária e novo e-mail', async () => {
  const [sessionSql, recoverySql] = await Promise.all([
    migration('000003-sessoes-desafios.sql'),
    migration('000004-recuperacao-outbox-auditoria.sql'),
  ]);

  assert.ok(sessionSql.includes("'recuperacao_admin_secundario'"));
  assert.ok(sessionSql.includes("'recuperacao_admin_email_novo'"));
  assert.ok(recoverySql.includes('desafio_email_novo_id <> desafio_secundario_id'));
  assert.ok(recoverySql.includes("contato.status <> 'verificado'"));
  assert.ok(recoverySql.includes("recuperacao.origem <> 'plataforma_cli'"));
});

test('todas as novas chaves estrangeiras declaram política de exclusão', async () => {
  const sql = (
    await Promise.all([
      migration('000002-identidade-autenticacao.sql'),
      migration('000003-sessoes-desafios.sql'),
      migration('000004-recuperacao-outbox-auditoria.sql'),
    ])
  ).join('\n');
  const foreignKeys = sql.match(/FOREIGN KEY\s*\([^)]+\)[\s\S]*?DEFERRABLE|FOREIGN KEY\s*\([^)]+\)[\s\S]*?(?=,\n\s*CONSTRAINT|\n\);)/g) ?? [];

  assert.ok(foreignKeys.length >= 25);
  for (const foreignKey of foreignKeys) {
    assert.match(foreignKey, /ON DELETE (?:RESTRICT|NO ACTION)/);
  }
});
