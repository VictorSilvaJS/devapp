import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(testsDirectory, '..', '..', 'migrations');

async function migration(file: string): Promise<string> {
  return readFile(join(migrationsDirectory, file), 'utf8');
}

test('MP-35A cria fundação administrativa sem antecipar grants de escrita', async () => {
  const sql = await migration('000006-fundacao-administrativa-mp35a.sql');

  for (const fragment of [
    'ADD COLUMN versao bigint NOT NULL DEFAULT 1',
    'char_length(nome) BETWEEN 1 AND 200',
    'char_length(email) BETWEEN 3 AND 254',
    'char_length(observacoes) <= 2000',
    'char_length(cultura_principal) <= 120',
    'CREATE TABLE public.motivos_administrativos',
    "('fim_relacao', false)",
    "('outro', true)",
    'motivo_inativacao_codigo text',
    'motivo_inativacao_detalhe text',
    "'manter_status'",
    "'ativar_usuario'",
    "'ativar_admin_bootstrap'",
    'ct_produtor_usuario_status_compativel',
    'ct_propriedade_ativa_titular_habilitado',
    'ct_usuarios_ultimo_admin_ativo',
    'ck_mp35a_dados_ultimo_admin',
    'trg_bootstrap_autenticacao_serializar_invariantes_mp35a',
    'tche_incrementar_versao_administrativa_mp35a',
    'ct_usuarios_ativacao_exige_credencial',
    'tche_ativar_produtor_por_convite_mp35a',
    'ct_convite_produtor_ativacao_valida',
    'FROM PUBLIC',
    'ct_convites_usuario_emissor_admin_ativo',
    'CREATE TABLE public.comandos_administrativos_idempotencia',
    'sessao_id uuid NOT NULL',
    'request_id text NOT NULL',
    'correlation_id text NOT NULL',
    'FOREIGN KEY (organizacao_id, ator_usuario_id, sessao_id)',
    "expira_em = criado_em + interval '90 days'",
    'CREATE ROLE tche_agro_administration_maintenance',
    'tche_purgar_comandos_administrativos_mp35a',
    'FOR UPDATE SKIP LOCKED',
  ]) {
    assert.ok(sql.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*ON public\.(?:usuarios|produtores|propriedades|usuario_propriedade)[^;]*TO tche_agro_runtime/i,
  );
  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:UPDATE|DELETE)\s+ON\s+(?:TABLE\s+)?public\.produtores\s+TO\s+tche_agro_runtime/i,
  );
  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:SELECT|DELETE)[^;]*ON public\.comandos_administrativos_idempotencia[^;]*TO tche_agro_administration_maintenance/i,
  );
  assert.doesNotMatch(sql, /ALTER TABLE public\.notificacao_/i);
  assert.doesNotMatch(sql, /ON DELETE CASCADE|DROP EXTENSION/i);
});

test('MP-35A persiste snapshot nacional versionado do IBGE', async () => {
  const sql = await migration('000007-catalogo-ibge-2026-08-25.sql');
  const municipalityInsert = sql
    .split('INSERT INTO public.municipios_ibge (versao_id, id, nome, uf_id)\nVALUES\n')[1]
    ?.split('\n\nALTER TABLE public.propriedades')[0];

  assert.ok(municipalityInsert);
  assert.equal(
    municipalityInsert.match(/\('ibge-localidades-2026-08-25'/g)?.length,
    5571,
  );
  for (const fragment of [
    'CREATE TABLE public.catalogo_localidades_ibge_versoes',
    'CREATE TABLE public.ufs_ibge',
    'CREATE TABLE public.municipios_ibge',
    'quantidade_ufs = 27 AND quantidade_municipios > 0',
    "'5101837', 'Boa Esperança do Norte', '51'",
    "'4314902', 'Porto Alegre', '43'",
    'ADD COLUMN localidades_versao_id text NOT NULL',
    'fk_propriedades_municipio_ibge',
    'tche_derivar_localizacao_propriedade_ibge',
    'tche_preservar_versao_localidades_ibge_publicada',
  ]) {
    assert.ok(sql.includes(fragment), `fragmento ausente: ${fragment}`);
  }

  assert.doesNotMatch(sql, /ON DELETE CASCADE|DROP EXTENSION/i);
});
