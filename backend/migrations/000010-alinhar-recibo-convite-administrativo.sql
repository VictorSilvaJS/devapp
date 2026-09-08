-- Up Migration
-- Correção focal MP-35B: recibo do agregado Usuário, sem incremento artificial.
-- Não há backfill: o recibo histórico não contém a versão do Usuário na emissão.
-- Inclui os 90 dias e expirados ainda retidos: a função de replay consulta
-- qualquer linha existente até a purga explícita pelo papel de manutenção.
-- O lock cobre preflight + DDL; emissões antigas em voo falham na constraint
-- nova e revertem seus efeitos, sem inserir um recibo legado após o upgrade.
LOCK TABLE public.comandos_administrativos_idempotencia IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.comandos_administrativos_idempotencia
    WHERE comando = 'usuario.emitir_convite'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'ck_mp35b_recibo_convite_upgrade',
      MESSAGE = 'Recibos de convite retidos impedem o upgrade seguro.',
      HINT = 'Preserve os comandos; aguarde a retenção e a purga autorizada. Não derive versão histórica do estado atual.';
  END IF;
END;
$$;

ALTER TABLE public.comandos_administrativos_idempotencia
  DROP CONSTRAINT ck_comandos_administrativos_recibo,
  ADD CONSTRAINT ck_comandos_administrativos_recibo
    CHECK (
      recibo IS NULL
      OR (
        pg_catalog.jsonb_typeof(recibo) = 'object'
        AND pg_catalog.pg_column_size(recibo) <= 16384
        AND recibo ?& ARRAY['outcome', 'resourceType', 'resourceId']
        AND (
          recibo - ARRAY[
            'outcome', 'resourceType', 'resourceId', 'version'
          ]::text[]
        ) = '{}'::jsonb
        AND pg_catalog.jsonb_typeof(recibo -> 'outcome') = 'string'
        AND pg_catalog.jsonb_typeof(recibo -> 'resourceType') = 'string'
        AND pg_catalog.jsonb_typeof(recibo -> 'resourceId') = 'string'
        AND (recibo ->> 'resourceId')
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND recibo ? 'version'
        AND pg_catalog.jsonb_typeof(recibo -> 'version') = 'number'
        AND (recibo ->> 'version') ~ '^[1-9][0-9]*$'
        AND (
          (
            comando IN (
              'usuario.criar',
              'usuario.atualizar',
              'usuario.alterar_status'
            )
            AND recibo ->> 'resourceType' = 'usuario'
          )
          OR (
            comando = 'usuario.alterar_vinculos'
            AND recibo ->> 'resourceType' = 'vinculo'
          )
          OR (
            comando = 'usuario.emitir_convite'
            AND recibo ->> 'resourceType' = 'usuario'
          )
          OR (
            comando IN (
              'propriedade.criar',
              'propriedade.atualizar',
              'propriedade.alterar_status'
            )
            AND recibo ->> 'resourceType' = 'propriedade'
          )
        )
        AND recibo ->> 'outcome' = CASE comando
          WHEN 'usuario.criar' THEN 'criado'
          WHEN 'usuario.atualizar' THEN 'atualizado'
          WHEN 'usuario.alterar_status' THEN 'status_alterado'
          WHEN 'usuario.alterar_vinculos' THEN 'vinculos_alterados'
          WHEN 'usuario.emitir_convite' THEN 'convite_emitido'
          WHEN 'propriedade.criar' THEN 'criado'
          WHEN 'propriedade.atualizar' THEN 'atualizado'
          WHEN 'propriedade.alterar_status' THEN 'status_alterado'
        END
      )
    );

CREATE OR REPLACE FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inicio jsonb;
  alvo record;
  usuario uuid;
  versao_final bigint;
  recibo_novo jsonb;
BEGIN
  inicio := public.tche_admin_iniciar_comando_mp35b(entrada, 'usuario.emitir_convite');
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    entrada,
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'invitation'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Emissao de convite invalida.';
  END IF;
  usuario := (entrada ->> 'usuario_id')::uuid;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      (entrada ->> 'organizacao_id') || ':' || usuario::text,
      35000035
    )
  );
  SELECT u.nome, u.email, u.status INTO alvo
  FROM public.usuarios AS u
  WHERE u.organizacao_id = entrada ->> 'organizacao_id' AND u.id = usuario
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.status <> 'pendente' THEN
    RETURN QUERY SELECT 'not_pending'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  PERFORM public.tche_admin_substituir_convite_mp35b(
    entrada -> 'invitation', entrada ->> 'organizacao_id', usuario,
    (entrada ->> 'ator_usuario_id')::uuid, alvo.nome, alvo.email
  );
  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados
  ) VALUES (
    entrada ->> 'organizacao_id', 'administracao.usuario.convite_emitido',
    'sucesso', 'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'usuario', usuario::text,
    entrada ->> 'request_id', pg_catalog.jsonb_build_object('activation_mode', 'ativar_usuario')
  );
  -- A linha permanece bloqueada desde a validação do alvo. A emissão não
  -- atualiza usuarios: capturamos a versão autoritativa depois dos efeitos.
  SELECT u.versao INTO STRICT versao_final FROM public.usuarios AS u
  WHERE u.organizacao_id = entrada ->> 'organizacao_id' AND u.id = usuario;
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'convite_emitido', 'resourceType', 'usuario',
    'resourceId', usuario::text, 'version', versao_final
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    entrada, 'usuario.emitir_convite', 201, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 201, recibo_novo;
END;
$$;

-- CREATE OR REPLACE conserva OID, owner NOLOGIN e ACLs da 000008.
-- Nenhum DML ou função auxiliar é concedido ao runtime.
REVOKE ALL ON FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(jsonb) FROM PUBLIC;

-- Down Migration
-- Restaura explicitamente a função e a constraint integradas, apenas sem
-- comandos de convite retidos. Nunca converte, apaga ou reescreve recibos.
-- Inclui os 90 dias e expirados ainda retidos: a função de replay consulta
-- qualquer linha existente até a purga explícita pelo papel de manutenção.
-- O lock cobre preflight + DDL; emissões antigas em voo falham na constraint
-- nova e revertem seus efeitos, sem inserir um recibo legado após o upgrade.
LOCK TABLE public.comandos_administrativos_idempotencia IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.comandos_administrativos_idempotencia
    WHERE comando = 'usuario.emitir_convite'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'ck_mp35b_recibo_convite_downgrade',
      MESSAGE = 'Recibos de convite retidos impedem o downgrade seguro.',
      HINT = 'Preserve os comandos; aguarde a retenção e a purga autorizada. Não derive versão histórica do estado atual.';
  END IF;
END;
$$;

ALTER TABLE public.comandos_administrativos_idempotencia
  DROP CONSTRAINT ck_comandos_administrativos_recibo,
  ADD CONSTRAINT ck_comandos_administrativos_recibo
    CHECK (
      recibo IS NULL
      OR (
        pg_catalog.jsonb_typeof(recibo) = 'object'
        AND pg_catalog.pg_column_size(recibo) <= 16384
        AND recibo ?& ARRAY['outcome', 'resourceType', 'resourceId']
        AND (
          recibo - ARRAY[
            'outcome', 'resourceType', 'resourceId', 'version'
          ]::text[]
        ) = '{}'::jsonb
        AND pg_catalog.jsonb_typeof(recibo -> 'outcome') = 'string'
        AND pg_catalog.jsonb_typeof(recibo -> 'resourceType') = 'string'
        AND pg_catalog.jsonb_typeof(recibo -> 'resourceId') = 'string'
        AND (recibo ->> 'resourceId')
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (
          (
            comando = 'usuario.emitir_convite'
            AND NOT recibo ? 'version'
          )
          OR (
            comando <> 'usuario.emitir_convite'
            AND recibo ? 'version'
            AND
            pg_catalog.jsonb_typeof(recibo -> 'version') = 'number'
            AND (recibo ->> 'version') ~ '^[1-9][0-9]*$'
          )
        )
        AND (
          (
            comando IN (
              'usuario.criar',
              'usuario.atualizar',
              'usuario.alterar_status'
            )
            AND recibo ->> 'resourceType' = 'usuario'
          )
          OR (
            comando = 'usuario.alterar_vinculos'
            AND recibo ->> 'resourceType' = 'vinculo'
          )
          OR (
            comando = 'usuario.emitir_convite'
            AND recibo ->> 'resourceType' = 'convite'
          )
          OR (
            comando IN (
              'propriedade.criar',
              'propriedade.atualizar',
              'propriedade.alterar_status'
            )
            AND recibo ->> 'resourceType' = 'propriedade'
          )
        )
        AND recibo ->> 'outcome' = CASE comando
          WHEN 'usuario.criar' THEN 'criado'
          WHEN 'usuario.atualizar' THEN 'atualizado'
          WHEN 'usuario.alterar_status' THEN 'status_alterado'
          WHEN 'usuario.alterar_vinculos' THEN 'vinculos_alterados'
          WHEN 'usuario.emitir_convite' THEN 'convite_emitido'
          WHEN 'propriedade.criar' THEN 'criado'
          WHEN 'propriedade.atualizar' THEN 'atualizado'
          WHEN 'propriedade.alterar_status' THEN 'status_alterado'
        END
      )
    );

CREATE OR REPLACE FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inicio jsonb;
  alvo record;
  usuario uuid;
  convite_novo uuid;
  recibo_novo jsonb;
BEGIN
  inicio := public.tche_admin_iniciar_comando_mp35b(entrada, 'usuario.emitir_convite');
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    entrada,
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'invitation'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Emissao de convite invalida.';
  END IF;
  usuario := (entrada ->> 'usuario_id')::uuid;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      (entrada ->> 'organizacao_id') || ':' || usuario::text,
      35000035
    )
  );
  SELECT u.nome, u.email, u.status INTO alvo
  FROM public.usuarios AS u
  WHERE u.organizacao_id = entrada ->> 'organizacao_id' AND u.id = usuario
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.status <> 'pendente' THEN
    RETURN QUERY SELECT 'not_pending'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  convite_novo := public.tche_admin_substituir_convite_mp35b(
    entrada -> 'invitation', entrada ->> 'organizacao_id', usuario,
    (entrada ->> 'ator_usuario_id')::uuid, alvo.nome, alvo.email
  );
  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados
  ) VALUES (
    entrada ->> 'organizacao_id', 'administracao.usuario.convite_emitido',
    'sucesso', 'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'convite', convite_novo::text,
    entrada ->> 'request_id', pg_catalog.jsonb_build_object('activation_mode', 'ativar_usuario')
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'convite_emitido', 'resourceType', 'convite',
    'resourceId', convite_novo::text
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    entrada, 'usuario.emitir_convite', 201, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 201, recibo_novo;
END;
$$;

-- CREATE OR REPLACE conserva OID, owner NOLOGIN e ACLs da 000008.
-- Nenhum DML ou função auxiliar é concedido ao runtime.
REVOKE ALL ON FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(jsonb) FROM PUBLIC;
