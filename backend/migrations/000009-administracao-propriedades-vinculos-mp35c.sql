-- Up Migration

-- MP-35C conserva a ordem MP-35B: organização, Usuários em UUID crescente,
-- Propriedades em UUID crescente e, por último, vínculos em ordem estável.
CREATE INDEX ix_usuario_propriedade_administracao_mp35c
  ON public.usuario_propriedade (
    organizacao_id, usuario_id, propriedade_id, tipo_vinculo, status, id
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.propriedades
  FROM tche_agro_runtime;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuario_propriedade
  FROM tche_agro_runtime;
REVOKE INSERT ON TABLE public.eventos_auditoria FROM tche_agro_runtime;
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.comandos_administrativos_idempotencia
  FROM tche_agro_runtime;

GRANT SELECT ON TABLE
  public.usuario_propriedade,
  public.catalogo_localidades_ibge_versoes,
  public.ufs_ibge,
  public.municipios_ibge
TO tche_agro_administration_owner;
GRANT INSERT, UPDATE ON TABLE
  public.propriedades,
  public.usuario_propriedade
TO tche_agro_administration_owner;

CREATE OR REPLACE FUNCTION public.tche_admin_iniciar_comando_mp35b(
  entrada jsonb,
  comando_esperado text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  organizacao text;
  ator uuid;
  sessao uuid;
  versao_ator bigint;
  perfil_ator text;
  status_ator text;
  sessao_valida boolean;
  existente public.comandos_administrativos_idempotencia%ROWTYPE;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    entrada,
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'produtor_id', 'nome', 'email', 'perfil',
      'telefone', 'documento', 'observacoes', 'versao', 'patch',
      'status', 'motivo', 'motivo_detalhe', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Entrada administrativa invalida.';
  END IF;

  organizacao := entrada ->> 'organizacao_id';
  IF organizacao <> 'org_tche_fertilidade'
    OR (entrada ->> 'request_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'correlation_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'chave_idempotencia_hash') !~ '^[0-9a-f]{64}$'
    OR (entrada ->> 'hash_requisicao') !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Contexto administrativo invalido.';
  END IF;

  ator := (entrada ->> 'ator_usuario_id')::uuid;
  sessao := (entrada ->> 'sessao_id')::uuid;
  versao_ator := (entrada ->> 'ator_versao_autorizacao')::bigint;

  -- A partir da 000009, todas as mutações administrativas serializam primeiro
  -- a organização; só então revalidam a sessão e reservam a idempotência.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(organizacao, 35000037)
  );

  PERFORM 1 FROM public.organizacoes
  WHERE id = organizacao AND status = 'ativa';
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;

  SELECT usuario.perfil, usuario.status,
         EXISTS (
           SELECT 1
           FROM public.sessoes_autenticacao AS sessao_atual
           WHERE sessao_atual.organizacao_id = usuario.organizacao_id
             AND sessao_atual.usuario_id = usuario.id
             AND sessao_atual.id = sessao
             AND sessao_atual.status = 'ativa'
             AND sessao_atual.versao_autorizacao = usuario.versao_autorizacao
             AND sessao_atual.expira_inatividade_em > pg_catalog.clock_timestamp()
             AND sessao_atual.expira_absolutamente_em > pg_catalog.clock_timestamp()
         )
  INTO perfil_ator, status_ator, sessao_valida
  FROM public.usuarios AS usuario
  WHERE usuario.organizacao_id = organizacao
    AND usuario.id = ator
    AND usuario.versao_autorizacao = versao_ator;

  IF NOT FOUND OR status_ator <> 'ativo' OR NOT COALESCE(sessao_valida, false) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;
  IF perfil_ator <> 'admin' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'forbidden');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      organizacao || ':' || ator::text || ':'
      || (entrada ->> 'chave_idempotencia_hash'),
      35000036
    )
  );

  SELECT comando_atual.* INTO existente
  FROM public.comandos_administrativos_idempotencia AS comando_atual
  WHERE comando_atual.organizacao_id = organizacao
    AND comando_atual.ator_usuario_id = ator
    AND comando_atual.chave_idempotencia_hash =
      pg_catalog.decode(entrada ->> 'chave_idempotencia_hash', 'hex')
  FOR UPDATE;

  IF FOUND THEN
    IF existente.comando <> comando_esperado
      OR existente.hash_requisicao IS DISTINCT FROM
        pg_catalog.decode(entrada ->> 'hash_requisicao', 'hex')
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'idempotency_conflict');
    END IF;
    IF existente.status <> 'concluido'
      OR existente.codigo_http IS NULL
      OR existente.recibo IS NULL
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'idempotency_conflict');
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'replayed',
      'codigo_http', existente.codigo_http,
      'recibo', existente.recibo
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object('status', 'new');
END;
$$;

CREATE FUNCTION public.tche_admin_contexto_mp35c(
  sessao_operacional uuid,
  requisicao text,
  correlacao text,
  chave_hash text,
  requisicao_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  organizacao text;
  ator uuid;
  contexto jsonb;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  IF requisicao !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR correlacao !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR chave_hash !~ '^[0-9a-f]{64}$'
    OR requisicao_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Contexto MP-35C invalido.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;

  SELECT sessao.organizacao_id, sessao.usuario_id
  INTO organizacao, ator
  FROM public.sessoes_autenticacao AS sessao
  WHERE sessao.id = sessao_operacional;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(organizacao, 35000037)
  );

  SELECT pg_catalog.jsonb_build_object(
    'status', CASE WHEN usuario.perfil = 'admin' THEN 'ok' ELSE 'forbidden' END,
    'organizacao_id', usuario.organizacao_id,
    'ator_usuario_id', usuario.id,
    'sessao_id', sessao.id,
    'ator_versao_autorizacao', usuario.versao_autorizacao,
    'request_id', requisicao,
    'correlation_id', correlacao,
    'chave_idempotencia_hash', chave_hash,
    'hash_requisicao', requisicao_hash
  )
  INTO contexto
  FROM public.sessoes_autenticacao AS sessao
  JOIN public.usuarios AS usuario
    ON usuario.organizacao_id = sessao.organizacao_id
   AND usuario.id = sessao.usuario_id
  JOIN public.organizacoes AS org ON org.id = usuario.organizacao_id
  WHERE sessao.id = sessao_operacional
    AND sessao.organizacao_id = organizacao
    AND sessao.usuario_id = ator
    AND org.status = 'ativa'
    AND usuario.status = 'ativo'
    AND sessao.status = 'ativa'
    AND sessao.versao_autorizacao = usuario.versao_autorizacao
    AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
    AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
  FOR UPDATE OF sessao;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;
  RETURN contexto;
END;
$$;

CREATE FUNCTION public.tche_admin_termos_sensiveis_mp35c()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ARRAY[
    'senha', 'password', 'token', 'documento', 'cpf', 'cnpj',
    'segredo', 'credential', 'authorization', 'cookie'
  ]::text[];
$$;

CREATE FUNCTION public.tche_admin_detalhe_sensivel_mp35c(detalhe text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT detalhe IS NOT NULL AND EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(public.tche_admin_termos_sensiveis_mp35c()) AS termo(valor)
    WHERE pg_catalog.lower(detalhe) LIKE '%' || termo.valor || '%'
  );
$$;

CREATE FUNCTION public.tche_admin_area_total_valida_mp35c(
  valor jsonb,
  permite_nulo boolean
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  area numeric;
  texto text;
BEGIN
  IF valor IS NULL THEN
    RETURN false;
  END IF;
  IF valor = 'null'::jsonb THEN
    RETURN permite_nulo;
  END IF;
  IF pg_catalog.jsonb_typeof(valor) IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  texto := valor #>> '{}';
  IF texto !~ '^(0|[1-9][0-9]{0,9})([.][0-9]{1,4})?$' THEN
    RETURN false;
  END IF;
  area := texto::numeric;
  RETURN area > 0
    AND area <= 9999999999.9999::numeric
    AND area = pg_catalog.trunc(area, 4);
END;
$$;

CREATE FUNCTION public.tche_admin_validar_motivo_mp35c(
  motivo text,
  detalhe text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF motivo NOT IN (
      'fim_relacao', 'mudanca_responsabilidade', 'cadastro_duplicado',
      'correcao_administrativa', 'suspensao_operacional', 'outro'
    )
    OR (motivo = 'outro' AND detalhe IS NULL)
    OR (detalhe IS NOT NULL AND (
      detalhe <> pg_catalog.btrim(detalhe)
      OR NOT (detalhe IS NFC NORMALIZED)
      OR pg_catalog.char_length(detalhe) NOT BETWEEN 1 AND 300
      OR public.tche_admin_detalhe_sensivel_mp35c(detalhe)
    ))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Motivo administrativo invalido.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;
END;
$$;

-- A implementação 000008 permanece disponível somente como base interna. A
-- interface runtime passa obrigatoriamente pelo catálogo sensível canônico.
ALTER FUNCTION public.tche_admin_alterar_status_usuario_mp35b(jsonb)
  RENAME TO tche_admin_alterar_status_usuario_mp35b_base000008;
REVOKE EXECUTE ON FUNCTION
  public.tche_admin_alterar_status_usuario_mp35b_base000008(jsonb)
FROM tche_agro_runtime, PUBLIC;

CREATE FUNCTION public.tche_admin_alterar_status_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF pg_catalog.jsonb_typeof(entrada) = 'object'
    AND pg_catalog.jsonb_typeof(entrada -> 'motivo') = 'string'
    AND (
      NOT entrada ? 'motivo_detalhe'
      OR pg_catalog.jsonb_typeof(entrada -> 'motivo_detalhe') = 'string'
    )
  THEN
    PERFORM public.tche_admin_validar_motivo_mp35c(
      entrada ->> 'motivo', entrada ->> 'motivo_detalhe'
    );
  END IF;
  RETURN QUERY SELECT *
  FROM public.tche_admin_alterar_status_usuario_mp35b_base000008(entrada);
END;
$$;

CREATE FUNCTION public.tche_admin_validar_entrada_mp35c(
  entrada jsonb,
  operacao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  campo text;
  alteracoes jsonb;
  item jsonb;
  texto text;
  uuid_padrao constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  IF entrada IS NULL
    OR pg_catalog.jsonb_typeof(entrada) IS DISTINCT FROM 'object'
    OR operacao NOT IN (
      'propriedade.criar', 'propriedade.atualizar',
      'propriedade.alterar_status', 'usuario.alterar_vinculos'
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Entrada MP-35C invalida.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;

  CASE operacao
    WHEN 'propriedade.criar' THEN
      IF public.tche_jsonb_chaves_exatas_mp35b(
        entrada,
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao', 'nome',
          'titular_id', 'municipio_id', 'area_total',
          'cultura_principal', 'status'
        ],
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao', 'nome',
          'titular_id', 'municipio_id', 'status'
        ]
      ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Criacao de Propriedade invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    WHEN 'propriedade.atualizar' THEN
      IF public.tche_jsonb_chaves_exatas_mp35b(
        entrada,
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao',
          'propriedade_id', 'versao', 'patch'
        ],
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao',
          'propriedade_id', 'versao', 'patch'
        ]
      ) IS DISTINCT FROM true
        OR pg_catalog.jsonb_typeof(entrada -> 'patch') IS DISTINCT FROM 'object'
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Atualizacao de Propriedade invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      alteracoes := entrada -> 'patch';
      IF public.tche_jsonb_chaves_exatas_mp35b(
        alteracoes,
        ARRAY['nome', 'municipio_id', 'area_total', 'cultura_principal'],
        ARRAY[]::text[]
      ) IS DISTINCT FROM true OR alteracoes = '{}'::jsonb THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Atualizacao de Propriedade invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    WHEN 'propriedade.alterar_status' THEN
      IF public.tche_jsonb_chaves_exatas_mp35b(
        entrada,
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao',
          'propriedade_id', 'versao', 'status', 'motivo', 'motivo_detalhe'
        ],
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao',
          'propriedade_id', 'versao', 'status', 'motivo'
        ]
      ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Status de Propriedade invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    WHEN 'usuario.alterar_vinculos' THEN
      IF public.tche_jsonb_chaves_exatas_mp35b(
        entrada,
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
          'versao', 'adicionar', 'remover', 'motivo', 'motivo_detalhe'
        ],
        ARRAY[
          'sessao_id', 'request_id', 'correlation_id',
          'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
          'versao', 'adicionar', 'remover', 'motivo'
        ]
      ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Delta de vinculos invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
  END CASE;

  FOREACH campo IN ARRAY ARRAY[
    'sessao_id', 'request_id', 'correlation_id',
    'chave_idempotencia_hash', 'hash_requisicao'
  ] LOOP
    IF pg_catalog.jsonb_typeof(entrada -> campo) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Contexto MP-35C invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
  END LOOP;
  IF (entrada ->> 'sessao_id') !~ uuid_padrao
    OR (entrada ->> 'request_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'correlation_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'chave_idempotencia_hash') !~ '^[0-9a-f]{64}$'
    OR (entrada ->> 'hash_requisicao') !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Contexto MP-35C invalido.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;

  IF operacao = 'propriedade.criar' THEN
    IF pg_catalog.jsonb_typeof(entrada -> 'titular_id') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Titular invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'titular_id') !~ uuid_padrao THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Titular invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF pg_catalog.jsonb_typeof(entrada -> 'nome') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    texto := entrada ->> 'nome';
    IF pg_catalog.char_length(texto) NOT BETWEEN 1 AND 200
      OR texto <> pg_catalog.btrim(texto)
      OR NOT (texto IS NFC NORMALIZED)
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF pg_catalog.jsonb_typeof(entrada -> 'municipio_id') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Municipio invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'municipio_id') !~ '^[0-9]{7}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Municipio invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF pg_catalog.jsonb_typeof(entrada -> 'status') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Status invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'status') NOT IN ('ativa', 'inativa') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Status invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF entrada ? 'area_total' THEN
      IF NOT public.tche_admin_area_total_valida_mp35c(
        entrada -> 'area_total', false
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Area total invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
    IF entrada ? 'cultura_principal' THEN
      IF pg_catalog.jsonb_typeof(entrada -> 'cultura_principal') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cultura principal invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      texto := entrada ->> 'cultura_principal';
      IF pg_catalog.char_length(texto) NOT BETWEEN 1 AND 120
        OR texto <> pg_catalog.btrim(texto)
        OR NOT (texto IS NFC NORMALIZED)
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cultura principal invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
  ELSE
    IF pg_catalog.jsonb_typeof(entrada -> 'versao') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Versao invalida.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    texto := entrada ->> 'versao';
    IF texto !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Versao invalida.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF texto::numeric > 9223372036854775807::numeric THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Versao invalida.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
  END IF;

  IF operacao IN ('propriedade.atualizar', 'propriedade.alterar_status') THEN
    IF pg_catalog.jsonb_typeof(entrada -> 'propriedade_id') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Propriedade invalida.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'propriedade_id') !~ uuid_padrao THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Propriedade invalida.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
  END IF;

  IF operacao = 'propriedade.atualizar' THEN
    IF alteracoes ? 'nome' THEN
      IF pg_catalog.jsonb_typeof(alteracoes -> 'nome') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      texto := alteracoes ->> 'nome';
      IF pg_catalog.char_length(texto) NOT BETWEEN 1 AND 200
        OR texto <> pg_catalog.btrim(texto)
        OR NOT (texto IS NFC NORMALIZED)
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
    IF alteracoes ? 'municipio_id' THEN
      IF pg_catalog.jsonb_typeof(alteracoes -> 'municipio_id') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Municipio invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      IF (alteracoes ->> 'municipio_id') !~ '^[0-9]{7}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Municipio invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
    IF alteracoes ? 'area_total' THEN
      IF NOT public.tche_admin_area_total_valida_mp35c(
        alteracoes -> 'area_total', true
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Area total invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
    IF alteracoes ? 'cultura_principal'
      AND alteracoes -> 'cultura_principal' <> 'null'::jsonb
    THEN
      IF pg_catalog.jsonb_typeof(alteracoes -> 'cultura_principal') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cultura principal invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      texto := alteracoes ->> 'cultura_principal';
      IF pg_catalog.char_length(texto) NOT BETWEEN 1 AND 120
        OR texto <> pg_catalog.btrim(texto)
        OR NOT (texto IS NFC NORMALIZED)
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cultura principal invalida.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
    END IF;
  END IF;

  IF operacao IN ('propriedade.alterar_status', 'usuario.alterar_vinculos') THEN
    IF pg_catalog.jsonb_typeof(entrada -> 'motivo') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Motivo invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF entrada ? 'motivo_detalhe'
      AND pg_catalog.jsonb_typeof(entrada -> 'motivo_detalhe') IS DISTINCT FROM 'string'
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Detalhe de motivo invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    PERFORM public.tche_admin_validar_motivo_mp35c(
      entrada ->> 'motivo', entrada ->> 'motivo_detalhe'
    );
  END IF;

  IF operacao = 'propriedade.alterar_status' THEN
    IF pg_catalog.jsonb_typeof(entrada -> 'status') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Status invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'status') NOT IN ('ativa', 'inativa') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Status invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
  END IF;

  IF operacao = 'usuario.alterar_vinculos' THEN
    IF pg_catalog.jsonb_typeof(entrada -> 'usuario_id') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Usuario invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    IF (entrada ->> 'usuario_id') !~ uuid_padrao THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Usuario invalido.',
        CONSTRAINT = 'ck_mp35c_input_validation';
    END IF;
    FOREACH campo IN ARRAY ARRAY['adicionar', 'remover'] LOOP
      IF pg_catalog.jsonb_typeof(entrada -> campo) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Delta de vinculos invalido.',
          CONSTRAINT = 'ck_mp35c_input_validation';
      END IF;
      FOR item IN SELECT valor FROM pg_catalog.jsonb_array_elements(entrada -> campo) AS lista(valor)
      LOOP
        IF pg_catalog.jsonb_typeof(item) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Delta de vinculos invalido.',
            CONSTRAINT = 'ck_mp35c_input_validation';
        END IF;
        texto := item #>> '{}';
        IF texto !~ uuid_padrao THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Delta de vinculos invalido.',
            CONSTRAINT = 'ck_mp35c_input_validation';
        END IF;
      END LOOP;
    END LOOP;
  END IF;
END;
$$;

CREATE FUNCTION public.tche_admin_revogar_usuarios_mp35c(
  p_organizacao text,
  p_usuarios uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  agora timestamptz;
BEGIN
  IF p_organizacao <> 'org_tche_fertilidade'
    OR p_usuarios IS NULL
    OR pg_catalog.cardinality(p_usuarios) = 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Revogacao administrativa invalida.';
  END IF;
  -- O chamador já mantém organização, Usuários, Propriedades e vínculos
  -- necessários. O relógio nasce somente neste ponto, logo antes dos efeitos.
  agora := pg_catalog.clock_timestamp();
  UPDATE public.usuarios AS usuario
  SET versao_autorizacao = usuario.versao_autorizacao + 1
  WHERE usuario.organizacao_id = p_organizacao
    AND usuario.id = ANY (p_usuarios);
  UPDATE public.tokens_refresh AS token
  SET status = 'revogado', revogado_em = agora,
      motivo_revogacao = 'escopo_propriedade_alterado'
  FROM public.sessoes_autenticacao AS sessao
  WHERE token.organizacao_id = p_organizacao AND token.status = 'ativo'
    AND sessao.organizacao_id = token.organizacao_id
    AND sessao.id = token.sessao_id AND sessao.usuario_id = ANY (p_usuarios);
  UPDATE public.tokens_acesso AS token
  SET status = 'revogado', revogado_em = agora,
      motivo_revogacao = 'escopo_propriedade_alterado'
  FROM public.sessoes_autenticacao AS sessao
  WHERE token.organizacao_id = p_organizacao AND token.status = 'ativo'
    AND sessao.organizacao_id = token.organizacao_id
    AND sessao.id = token.sessao_id AND sessao.usuario_id = ANY (p_usuarios);
  UPDATE public.sessoes_autenticacao AS sessao
  SET status = 'revogada', revogada_em = agora,
      motivo_revogacao = 'escopo_propriedade_alterado'
  WHERE sessao.organizacao_id = p_organizacao
    AND sessao.usuario_id = ANY (p_usuarios)
    AND sessao.status = 'ativa';
END;
$$;

CREATE FUNCTION public.tche_admin_criar_propriedade_mp35c(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  inicio jsonb;
  contexto jsonb;
  organizacao text;
  ator uuid;
  propriedade uuid := pg_catalog.gen_random_uuid();
  titular uuid;
  usuario_titular uuid;
  municipio text;
  versao_localidade text;
  uf text;
  nome_novo text;
  status_novo text;
  recibo_novo jsonb;
  titular_ativo boolean;
BEGIN
  PERFORM public.tche_admin_validar_entrada_mp35c(
    entrada, 'propriedade.criar'
  );
  contexto := public.tche_admin_contexto_mp35c(
    (entrada ->> 'sessao_id')::uuid,
    entrada ->> 'request_id', entrada ->> 'correlation_id',
    entrada ->> 'chave_idempotencia_hash', entrada ->> 'hash_requisicao'
  );
  IF contexto ->> 'status' <> 'ok' THEN
    RETURN QUERY SELECT contexto ->> 'status', NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  contexto := contexto - 'status';
  inicio := public.tche_admin_iniciar_comando_mp35b(
    contexto, 'propriedade.criar'
  );
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  organizacao := contexto ->> 'organizacao_id';
  ator := (contexto ->> 'ator_usuario_id')::uuid;
  titular := (entrada ->> 'titular_id')::uuid;
  municipio := entrada ->> 'municipio_id';
  nome_novo := entrada ->> 'nome';
  status_novo := entrada ->> 'status';
  IF pg_catalog.char_length(nome_novo) NOT BETWEEN 1 AND 200
    OR nome_novo <> pg_catalog.btrim(nome_novo)
    OR NOT (nome_novo IS NFC NORMALIZED)
    OR municipio !~ '^[0-9]{7}$'
    OR status_novo NOT IN ('ativa', 'inativa')
    OR (entrada ? 'area_total' AND NOT
      public.tche_admin_area_total_valida_mp35c(entrada -> 'area_total', false))
    OR (entrada ? 'cultura_principal' AND (
      pg_catalog.jsonb_typeof(entrada -> 'cultura_principal') <> 'string'
      OR pg_catalog.char_length(entrada ->> 'cultura_principal') NOT BETWEEN 1 AND 120
      OR entrada ->> 'cultura_principal' <> pg_catalog.btrim(entrada ->> 'cultura_principal')
      OR NOT ((entrada ->> 'cultura_principal') IS NFC NORMALIZED)
    ))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Dados de Propriedade invalidos.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;

  SELECT produtor.usuario_id,
         produtor.status = 'ativo' AND usuario.status = 'ativo'
  INTO usuario_titular, titular_ativo
  FROM public.produtores AS produtor
  JOIN public.usuarios AS usuario
    ON usuario.organizacao_id = produtor.organizacao_id
   AND usuario.id = produtor.usuario_id
   AND usuario.perfil = 'produtor'
  WHERE produtor.organizacao_id = organizacao AND produtor.id = titular;
  IF NOT FOUND OR (status_novo = 'ativa' AND NOT titular_ativo) THEN
    RETURN QUERY SELECT 'invalid_holder'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      organizacao || ':' || usuario_titular::text, 35000035
    )
  );
  PERFORM 1 FROM public.usuarios
  WHERE organizacao_id = organizacao AND id = usuario_titular
  FOR UPDATE;

  SELECT versao.id, localidade.uf_id
  INTO versao_localidade, uf
  FROM public.catalogo_localidades_ibge_versoes AS versao
  JOIN public.municipios_ibge AS localidade
    ON localidade.versao_id = versao.id
  WHERE versao.status = 'ativo' AND localidade.id = municipio;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_municipality'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  INSERT INTO public.propriedades (
    id, organizacao_id, titular_id, nome, localidades_versao_id,
    municipio_id, municipio_nome, uf_id, uf_sigla,
    area_total, cultura_principal, status
  ) VALUES (
    propriedade, organizacao, titular, nome_novo, versao_localidade,
    municipio, '-', uf, 'AA',
    CASE WHEN entrada ? 'area_total'
      THEN (entrada ->> 'area_total')::numeric END,
    CASE WHEN entrada ? 'cultura_principal'
      THEN entrada ->> 'cultura_principal' END,
    status_novo
  );

  IF status_novo = 'ativa' THEN
    PERFORM public.tche_admin_revogar_usuarios_mp35c(
      organizacao, ARRAY[usuario_titular]
    );
  END IF;

  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados
  ) VALUES (
    organizacao, 'administracao.propriedade.criada', 'sucesso', 'usuario',
    ator, (contexto ->> 'sessao_id')::uuid, usuario_titular,
    'propriedade', propriedade::text, contexto ->> 'request_id',
    pg_catalog.jsonb_build_object(
      'status', status_novo, 'titular_id', titular,
      'municipio_id', municipio, 'localidades_versao_id', versao_localidade,
      'correlation_id', contexto ->> 'correlation_id'
    )
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'criado', 'resourceType', 'propriedade',
    'resourceId', propriedade, 'version', 1
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    contexto, 'propriedade.criar', 201, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 201, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_atualizar_propriedade_mp35c(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  inicio jsonb;
  contexto jsonb;
  organizacao text;
  ator uuid;
  propriedade uuid;
  versao_esperada bigint;
  atual public.propriedades%ROWTYPE;
  alteracoes jsonb;
  versao_localidade text;
  uf text;
  versao_nova bigint;
  recibo_novo jsonb;
  campos_alterados text[];
BEGIN
  PERFORM public.tche_admin_validar_entrada_mp35c(
    entrada, 'propriedade.atualizar'
  );
  contexto := public.tche_admin_contexto_mp35c(
    (entrada ->> 'sessao_id')::uuid,
    entrada ->> 'request_id', entrada ->> 'correlation_id',
    entrada ->> 'chave_idempotencia_hash', entrada ->> 'hash_requisicao'
  );
  IF contexto ->> 'status' <> 'ok' THEN
    RETURN QUERY SELECT contexto ->> 'status', NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  contexto := contexto - 'status';
  inicio := public.tche_admin_iniciar_comando_mp35b(
    contexto, 'propriedade.atualizar'
  );
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  organizacao := contexto ->> 'organizacao_id';
  ator := (contexto ->> 'ator_usuario_id')::uuid;
  propriedade := (entrada ->> 'propriedade_id')::uuid;
  versao_esperada := (entrada ->> 'versao')::bigint;
  alteracoes := entrada -> 'patch';
  IF versao_esperada <= 0
    OR (alteracoes ? 'nome' AND (
      pg_catalog.jsonb_typeof(alteracoes -> 'nome') <> 'string'
      OR pg_catalog.char_length(alteracoes ->> 'nome') NOT BETWEEN 1 AND 200
      OR alteracoes ->> 'nome' <> pg_catalog.btrim(alteracoes ->> 'nome')
      OR NOT ((alteracoes ->> 'nome') IS NFC NORMALIZED)
    ))
    OR (alteracoes ? 'municipio_id' AND (
      pg_catalog.jsonb_typeof(alteracoes -> 'municipio_id') <> 'string'
      OR alteracoes ->> 'municipio_id' !~ '^[0-9]{7}$'
    ))
    OR (alteracoes ? 'area_total' AND NOT
      public.tche_admin_area_total_valida_mp35c(alteracoes -> 'area_total', true))
    OR (alteracoes ? 'cultura_principal'
      AND alteracoes -> 'cultura_principal' <> 'null'::jsonb AND (
        pg_catalog.jsonb_typeof(alteracoes -> 'cultura_principal') <> 'string'
        OR pg_catalog.char_length(alteracoes ->> 'cultura_principal') NOT BETWEEN 1 AND 120
        OR alteracoes ->> 'cultura_principal' <>
          pg_catalog.btrim(alteracoes ->> 'cultura_principal')
        OR NOT ((alteracoes ->> 'cultura_principal') IS NFC NORMALIZED)
      ))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Patch de Propriedade invalido.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;

  SELECT alvo.* INTO atual FROM public.propriedades AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.id = propriedade
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF atual.versao <> versao_esperada THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  versao_localidade := atual.localidades_versao_id;
  uf := atual.uf_id;
  IF alteracoes ? 'municipio_id'
    AND alteracoes ->> 'municipio_id' IS DISTINCT FROM atual.municipio_id THEN
    SELECT versao.id, localidade.uf_id INTO versao_localidade, uf
    FROM public.catalogo_localidades_ibge_versoes AS versao
    JOIN public.municipios_ibge AS localidade
      ON localidade.versao_id = versao.id
    WHERE versao.status = 'ativo'
      AND localidade.id = alteracoes ->> 'municipio_id';
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'invalid_municipality'::text,
        NULL::integer, NULL::jsonb;
      RETURN;
    END IF;
  END IF;

  campos_alterados := pg_catalog.array_remove(ARRAY[
    CASE WHEN alteracoes ? 'nome'
      AND alteracoes ->> 'nome' IS DISTINCT FROM atual.nome THEN 'nome' END,
    CASE WHEN alteracoes ? 'municipio_id'
      AND alteracoes ->> 'municipio_id' IS DISTINCT FROM atual.municipio_id
      THEN 'municipio_id' END,
    CASE WHEN alteracoes ? 'area_total'
      AND (alteracoes ->> 'area_total')::numeric IS DISTINCT FROM atual.area_total
      THEN 'area_total' END,
    CASE WHEN alteracoes ? 'cultura_principal'
      AND alteracoes ->> 'cultura_principal' IS DISTINCT FROM atual.cultura_principal
      THEN 'cultura_principal' END
  ], NULL);
  IF pg_catalog.cardinality(campos_alterados) = 0 THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  UPDATE public.propriedades
  SET nome = CASE WHEN alteracoes ? 'nome' THEN alteracoes ->> 'nome' ELSE nome END,
      localidades_versao_id = versao_localidade,
      municipio_id = CASE WHEN alteracoes ? 'municipio_id'
        THEN alteracoes ->> 'municipio_id' ELSE municipio_id END,
      uf_id = uf,
      area_total = CASE WHEN alteracoes ? 'area_total'
        THEN (alteracoes ->> 'area_total')::numeric ELSE area_total END,
      cultura_principal = CASE WHEN alteracoes ? 'cultura_principal'
        THEN alteracoes ->> 'cultura_principal' ELSE cultura_principal END
  WHERE organizacao_id = organizacao AND id = propriedade
  RETURNING versao INTO versao_nova;

  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, recurso_tipo, recurso_id, request_id, metadados
  ) VALUES (
    organizacao, 'administracao.propriedade.atualizada', 'sucesso', 'usuario',
    ator, (contexto ->> 'sessao_id')::uuid, 'propriedade', propriedade::text,
    contexto ->> 'request_id',
    pg_catalog.jsonb_build_object(
      'campos', campos_alterados,
      'correlation_id', contexto ->> 'correlation_id'
    )
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'atualizado', 'resourceType', 'propriedade',
    'resourceId', propriedade, 'version', versao_nova
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    contexto, 'propriedade.atualizar', 200, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 200, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_alterar_status_propriedade_mp35c(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  inicio jsonb;
  contexto jsonb;
  organizacao text;
  ator uuid;
  propriedade uuid;
  versao_esperada bigint;
  status_novo text;
  motivo text;
  detalhe text;
  atual public.propriedades%ROWTYPE;
  usuarios_afetados uuid[];
  usuario_afetado uuid;
  versao_nova bigint;
  recibo_novo jsonb;
BEGIN
  PERFORM public.tche_admin_validar_entrada_mp35c(
    entrada, 'propriedade.alterar_status'
  );
  contexto := public.tche_admin_contexto_mp35c(
    (entrada ->> 'sessao_id')::uuid,
    entrada ->> 'request_id', entrada ->> 'correlation_id',
    entrada ->> 'chave_idempotencia_hash', entrada ->> 'hash_requisicao'
  );
  IF contexto ->> 'status' <> 'ok' THEN
    RETURN QUERY SELECT contexto ->> 'status', NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  contexto := contexto - 'status';
  inicio := public.tche_admin_iniciar_comando_mp35b(
    contexto, 'propriedade.alterar_status'
  );
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  organizacao := contexto ->> 'organizacao_id';
  ator := (contexto ->> 'ator_usuario_id')::uuid;
  propriedade := (entrada ->> 'propriedade_id')::uuid;
  versao_esperada := (entrada ->> 'versao')::bigint;
  status_novo := entrada ->> 'status';
  motivo := entrada ->> 'motivo';
  detalhe := entrada ->> 'motivo_detalhe';
  IF versao_esperada <= 0 OR status_novo NOT IN ('ativa', 'inativa') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Motivo ou status de Propriedade invalido.',
      CONSTRAINT = 'ck_mp35c_input_validation';
  END IF;
  PERFORM public.tche_admin_validar_motivo_mp35c(motivo, detalhe);
  SELECT alvo.* INTO atual FROM public.propriedades AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.id = propriedade;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  SELECT pg_catalog.array_agg(afetado.usuario_id ORDER BY afetado.usuario_id)
  INTO usuarios_afetados
  FROM (
    SELECT produtor.usuario_id
    FROM public.produtores AS produtor
    WHERE produtor.organizacao_id = organizacao AND produtor.id = atual.titular_id
    UNION
    SELECT vinculo.usuario_id
    FROM public.usuario_propriedade AS vinculo
    WHERE vinculo.organizacao_id = organizacao
      AND vinculo.propriedade_id = propriedade AND vinculo.status = 'ativo'
  ) AS afetado;
  FOREACH usuario_afetado IN ARRAY COALESCE(usuarios_afetados, ARRAY[]::uuid[])
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        organizacao || ':' || usuario_afetado::text, 35000035
      )
    );
  END LOOP;
  PERFORM 1 FROM public.usuarios
  WHERE organizacao_id = organizacao
    AND id = ANY (COALESCE(usuarios_afetados, ARRAY[]::uuid[]))
  ORDER BY id FOR UPDATE;
  SELECT alvo.* INTO atual FROM public.propriedades AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.id = propriedade
  FOR UPDATE;
  PERFORM 1 FROM public.usuario_propriedade AS vinculo
  WHERE vinculo.organizacao_id = organizacao
    AND vinculo.propriedade_id = propriedade
  ORDER BY vinculo.usuario_id, vinculo.id FOR UPDATE;
  IF atual.versao <> versao_esperada THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF atual.status = status_novo THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF status_novo = 'ativa' AND NOT EXISTS (
    SELECT 1 FROM public.produtores AS produtor
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE produtor.organizacao_id = organizacao
      AND produtor.id = atual.titular_id
      AND produtor.status = 'ativo' AND usuario.status = 'ativo'
      AND usuario.perfil = 'produtor'
  ) THEN
    RETURN QUERY SELECT 'invalid_holder'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  UPDATE public.propriedades SET status = status_novo
  WHERE organizacao_id = organizacao AND id = propriedade
  RETURNING versao INTO versao_nova;
  PERFORM public.tche_admin_revogar_usuarios_mp35c(
    organizacao, usuarios_afetados
  );

  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, recurso_tipo, recurso_id, motivo_categoria,
    request_id, metadados
  ) VALUES (
    organizacao, 'administracao.propriedade.status_alterado', 'sucesso',
    'usuario', ator, (contexto ->> 'sessao_id')::uuid,
    'propriedade', propriedade::text,
    motivo, contexto ->> 'request_id',
    pg_catalog.jsonb_build_object(
      'status_anterior', atual.status, 'status_novo', status_novo,
      'motivo_detalhe', detalhe,
      'usuarios_afetados', COALESCE(usuarios_afetados, ARRAY[]::uuid[]),
      'correlation_id', contexto ->> 'correlation_id'
    )
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'status_alterado', 'resourceType', 'propriedade',
    'resourceId', propriedade, 'version', versao_nova
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    contexto, 'propriedade.alterar_status', 200, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 200, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_alterar_vinculos_usuario_mp35c(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  inicio jsonb;
  contexto jsonb;
  organizacao text;
  ator uuid;
  usuario uuid;
  versao_esperada bigint;
  perfil_alvo text;
  produtor_alvo uuid;
  tipo_derivado text;
  adicionar uuid[];
  remover uuid[];
  todas uuid[];
  propriedade uuid;
  vinculo uuid;
  motivo text;
  detalhe text;
  versao_nova bigint;
  recibo_novo jsonb;
  acao text;
  estado_anterior text;
BEGIN
  PERFORM public.tche_admin_validar_entrada_mp35c(
    entrada, 'usuario.alterar_vinculos'
  );
  contexto := public.tche_admin_contexto_mp35c(
    (entrada ->> 'sessao_id')::uuid,
    entrada ->> 'request_id', entrada ->> 'correlation_id',
    entrada ->> 'chave_idempotencia_hash', entrada ->> 'hash_requisicao'
  );
  IF contexto ->> 'status' <> 'ok' THEN
    RETURN QUERY SELECT contexto ->> 'status', NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  contexto := contexto - 'status';
  inicio := public.tche_admin_iniciar_comando_mp35b(
    contexto, 'usuario.alterar_vinculos'
  );
  IF inicio ->> 'status' <> 'new' THEN
    RETURN QUERY SELECT inicio ->> 'status',
      (inicio ->> 'codigo_http')::integer, inicio -> 'recibo';
    RETURN;
  END IF;
  SELECT COALESCE(pg_catalog.array_agg(valor::uuid ORDER BY valor::uuid), ARRAY[]::uuid[])
  INTO adicionar FROM pg_catalog.jsonb_array_elements_text(entrada -> 'adicionar') AS item(valor);
  SELECT COALESCE(pg_catalog.array_agg(valor::uuid ORDER BY valor::uuid), ARRAY[]::uuid[])
  INTO remover FROM pg_catalog.jsonb_array_elements_text(entrada -> 'remover') AS item(valor);
  SELECT COALESCE(pg_catalog.array_agg(valor ORDER BY valor), ARRAY[]::uuid[])
  INTO todas FROM (
    SELECT pg_catalog.unnest(adicionar) AS valor
    UNION SELECT pg_catalog.unnest(remover)
  ) AS uniao;
  IF pg_catalog.cardinality(todas) = 0
    OR pg_catalog.cardinality(adicionar) + pg_catalog.cardinality(remover) > 100
    OR (SELECT pg_catalog.count(DISTINCT valor) FROM pg_catalog.unnest(adicionar) AS item(valor))
      <> pg_catalog.cardinality(adicionar)
    OR (SELECT pg_catalog.count(DISTINCT valor) FROM pg_catalog.unnest(remover) AS item(valor))
      <> pg_catalog.cardinality(remover)
    OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(adicionar) AS item(valor)
      WHERE valor = ANY (remover)
    )
  THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  motivo := entrada ->> 'motivo';
  detalhe := entrada ->> 'motivo_detalhe';
  PERFORM public.tche_admin_validar_motivo_mp35c(motivo, detalhe);

  organizacao := contexto ->> 'organizacao_id';
  ator := (contexto ->> 'ator_usuario_id')::uuid;
  usuario := (entrada ->> 'usuario_id')::uuid;
  versao_esperada := (entrada ->> 'versao')::bigint;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(organizacao || ':' || usuario::text, 35000035)
  );
  SELECT alvo.perfil, produtor.id, alvo.versao
  INTO perfil_alvo, produtor_alvo, versao_nova
  FROM public.usuarios AS alvo
  LEFT JOIN public.produtores AS produtor
    ON produtor.organizacao_id = alvo.organizacao_id
   AND produtor.usuario_id = alvo.id
  WHERE alvo.organizacao_id = organizacao AND alvo.id = usuario
  FOR UPDATE OF alvo;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF versao_nova <> versao_esperada THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF perfil_alvo = 'admin' THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF perfil_alvo = 'produtor' AND produtor_alvo IS NULL THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  tipo_derivado := CASE perfil_alvo
    WHEN 'produtor' THEN 'usuario_autorizado' ELSE 'colaborador' END;

  PERFORM 1 FROM public.propriedades AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.id = ANY (todas)
  ORDER BY alvo.id FOR UPDATE;
  IF (SELECT pg_catalog.count(*) FROM public.propriedades AS alvo
      WHERE alvo.organizacao_id = organizacao AND alvo.id = ANY (todas))
    <> pg_catalog.cardinality(todas) THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  PERFORM 1 FROM public.usuario_propriedade AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.usuario_id = usuario
    AND alvo.propriedade_id = ANY (todas)
  ORDER BY alvo.propriedade_id, alvo.id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.usuario_propriedade AS alvo
    WHERE alvo.organizacao_id = organizacao AND alvo.usuario_id = usuario
      AND alvo.propriedade_id = ANY (adicionar)
      AND alvo.tipo_vinculo = tipo_derivado AND alvo.status = 'ativo'
  ) OR (perfil_alvo = 'produtor' AND EXISTS (
    SELECT 1 FROM public.propriedades AS alvo
    WHERE alvo.organizacao_id = organizacao AND alvo.id = ANY (adicionar)
      AND alvo.titular_id = produtor_alvo
  )) OR EXISTS (
    SELECT 1 FROM pg_catalog.unnest(remover) AS item(propriedade_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.usuario_propriedade AS alvo
      WHERE alvo.organizacao_id = organizacao AND alvo.usuario_id = usuario
        AND alvo.propriedade_id = item.propriedade_id
        AND alvo.tipo_vinculo = tipo_derivado AND alvo.status = 'ativo'
    )
  ) THEN
    RETURN QUERY SELECT 'business_rule_conflict'::text,
      NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  FOREACH propriedade IN ARRAY adicionar LOOP
    SELECT alvo.id INTO vinculo
    FROM public.usuario_propriedade AS alvo
    WHERE alvo.organizacao_id = organizacao AND alvo.usuario_id = usuario
      AND alvo.propriedade_id = propriedade
      AND alvo.tipo_vinculo = tipo_derivado AND alvo.status = 'inativo'
    ORDER BY alvo.atualizado_em DESC, alvo.id DESC LIMIT 1;
    IF vinculo IS NULL THEN
      acao := 'criado';
      estado_anterior := 'ausente';
      INSERT INTO public.usuario_propriedade (
        organizacao_id, usuario_id, propriedade_id, tipo_vinculo,
        status, origem, criado_por, atualizado_por
      ) VALUES (
        organizacao, usuario, propriedade, tipo_derivado,
        'ativo', 'admin_manual', ator, ator
      ) RETURNING id INTO vinculo;
    ELSE
      acao := 'reativado';
      estado_anterior := 'inativo';
      UPDATE public.usuario_propriedade
      SET status = 'ativo', motivo_inativacao = NULL,
          motivo_inativacao_codigo = NULL,
          motivo_inativacao_detalhe = NULL,
          atualizado_por = ator
      WHERE id = vinculo;
    END IF;
    INSERT INTO public.eventos_auditoria (
      organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
      sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
      motivo_categoria, request_id, metadados, ocorrido_em
    ) VALUES (
      organizacao, 'administracao.vinculo.' || acao, 'sucesso', 'usuario',
      ator, (contexto ->> 'sessao_id')::uuid, usuario, 'vinculo', vinculo::text,
      motivo, contexto ->> 'request_id', pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'usuario_id', usuario,
          'propriedade_id', propriedade,
          'tipo_vinculo', tipo_derivado,
          'estado_anterior', estado_anterior,
          'estado_posterior', 'ativo',
          'acao', acao,
          'motivo', motivo,
          'motivo_detalhe', detalhe,
          'correlation_id', contexto ->> 'correlation_id'
        )
      ), pg_catalog.clock_timestamp()
    );
    vinculo := NULL;
  END LOOP;
  FOREACH propriedade IN ARRAY remover LOOP
    UPDATE public.usuario_propriedade
    SET status = 'inativo', motivo_inativacao = NULL,
        motivo_inativacao_codigo = motivo,
        motivo_inativacao_detalhe = detalhe,
        atualizado_por = ator
    WHERE organizacao_id = organizacao AND usuario_id = usuario
      AND propriedade_id = propriedade AND tipo_vinculo = tipo_derivado
      AND status = 'ativo'
    RETURNING id INTO vinculo;
    INSERT INTO public.eventos_auditoria (
      organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
      sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
      motivo_categoria, request_id, metadados, ocorrido_em
    ) VALUES (
      organizacao, 'administracao.vinculo.inativado', 'sucesso', 'usuario',
      ator, (contexto ->> 'sessao_id')::uuid, usuario, 'vinculo', vinculo::text,
      motivo, contexto ->> 'request_id', pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'usuario_id', usuario,
          'propriedade_id', propriedade,
          'tipo_vinculo', tipo_derivado,
          'estado_anterior', 'ativo',
          'estado_posterior', 'inativo',
          'acao', 'inativado',
          'motivo', motivo,
          'motivo_detalhe', detalhe,
          'correlation_id', contexto ->> 'correlation_id'
        )
      ), pg_catalog.clock_timestamp()
    );
  END LOOP;

  PERFORM public.tche_admin_revogar_usuarios_mp35c(
    organizacao, ARRAY[usuario]
  );
  SELECT alvo.versao INTO versao_nova
  FROM public.usuarios AS alvo
  WHERE alvo.organizacao_id = organizacao AND alvo.id = usuario;

  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'vinculos_alterados', 'resourceType', 'vinculo',
    'resourceId', usuario, 'version', versao_nova
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    contexto, 'usuario.alterar_vinculos', 200, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 200, recibo_novo;
END;
$$;

ALTER FUNCTION public.tche_admin_contexto_mp35c(uuid, text, text, text, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_termos_sensiveis_mp35c()
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_detalhe_sensivel_mp35c(text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_area_total_valida_mp35c(jsonb, boolean)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_validar_motivo_mp35c(text, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_alterar_status_usuario_mp35b(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_validar_entrada_mp35c(jsonb, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_revogar_usuarios_mp35c(text, uuid[])
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_criar_propriedade_mp35c(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_atualizar_propriedade_mp35c(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_alterar_status_propriedade_mp35c(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb)
  OWNER TO tche_agro_administration_owner;

REVOKE ALL ON FUNCTION
  public.tche_admin_contexto_mp35c(uuid, text, text, text, text),
  public.tche_admin_termos_sensiveis_mp35c(),
  public.tche_admin_detalhe_sensivel_mp35c(text),
  public.tche_admin_area_total_valida_mp35c(jsonb, boolean),
  public.tche_admin_validar_motivo_mp35c(text, text),
  public.tche_admin_validar_entrada_mp35c(jsonb, text),
  public.tche_admin_revogar_usuarios_mp35c(text, uuid[]),
  public.tche_admin_criar_propriedade_mp35c(jsonb),
  public.tche_admin_atualizar_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_status_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb)
FROM PUBLIC;
REVOKE ALL ON FUNCTION
  public.tche_admin_alterar_status_usuario_mp35b(jsonb)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.tche_admin_alterar_status_usuario_mp35b(jsonb)
TO tche_agro_runtime;
GRANT EXECUTE ON FUNCTION
  public.tche_admin_criar_propriedade_mp35c(jsonb),
  public.tche_admin_atualizar_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_status_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb)
TO tche_agro_runtime;

-- Down Migration

REVOKE EXECUTE ON FUNCTION
  public.tche_admin_criar_propriedade_mp35c(jsonb),
  public.tche_admin_atualizar_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_status_propriedade_mp35c(jsonb),
  public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb)
FROM tche_agro_runtime;

DROP FUNCTION IF EXISTS public.tche_admin_alterar_vinculos_usuario_mp35c(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_alterar_status_propriedade_mp35c(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_atualizar_propriedade_mp35c(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_criar_propriedade_mp35c(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_revogar_usuarios_mp35c(text, uuid[]);
DROP FUNCTION IF EXISTS public.tche_admin_validar_entrada_mp35c(jsonb, text);
REVOKE EXECUTE ON FUNCTION
  public.tche_admin_alterar_status_usuario_mp35b(jsonb)
FROM tche_agro_runtime;
DROP FUNCTION IF EXISTS public.tche_admin_alterar_status_usuario_mp35b(jsonb);
ALTER FUNCTION public.tche_admin_alterar_status_usuario_mp35b_base000008(jsonb)
  RENAME TO tche_admin_alterar_status_usuario_mp35b;
GRANT EXECUTE ON FUNCTION
  public.tche_admin_alterar_status_usuario_mp35b(jsonb)
TO tche_agro_runtime;
DROP FUNCTION IF EXISTS public.tche_admin_validar_motivo_mp35c(text, text);
DROP FUNCTION IF EXISTS public.tche_admin_area_total_valida_mp35c(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tche_admin_detalhe_sensivel_mp35c(text);
DROP FUNCTION IF EXISTS public.tche_admin_termos_sensiveis_mp35c();
DROP FUNCTION IF EXISTS public.tche_admin_contexto_mp35c(uuid, text, text, text, text);

-- Restaura byte-semanticamente a definição da 000008: nela o lock da
-- idempotência precedia o lock organizacional adquirido pelas mutações.
CREATE OR REPLACE FUNCTION public.tche_admin_iniciar_comando_mp35b(
  entrada jsonb,
  comando_esperado text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  organizacao text;
  ator uuid;
  sessao uuid;
  versao_ator bigint;
  perfil_ator text;
  status_ator text;
  sessao_valida boolean;
  existente public.comandos_administrativos_idempotencia%ROWTYPE;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    entrada,
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'produtor_id', 'nome', 'email', 'perfil',
      'telefone', 'documento', 'observacoes', 'versao', 'patch',
      'status', 'motivo', 'motivo_detalhe', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Entrada administrativa invalida.';
  END IF;

  organizacao := entrada ->> 'organizacao_id';
  IF organizacao <> 'org_tche_fertilidade'
    OR (entrada ->> 'request_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'correlation_id') !~ '^[A-Za-z0-9._:/-]{1,128}$'
    OR (entrada ->> 'chave_idempotencia_hash') !~ '^[0-9a-f]{64}$'
    OR (entrada ->> 'hash_requisicao') !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Contexto administrativo invalido.';
  END IF;

  ator := (entrada ->> 'ator_usuario_id')::uuid;
  sessao := (entrada ->> 'sessao_id')::uuid;
  versao_ator := (entrada ->> 'ator_versao_autorizacao')::bigint;

  PERFORM 1 FROM public.organizacoes
  WHERE id = organizacao AND status = 'ativa';
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;

  SELECT usuario.perfil, usuario.status,
         EXISTS (
           SELECT 1
           FROM public.sessoes_autenticacao AS sessao_atual
           WHERE sessao_atual.organizacao_id = usuario.organizacao_id
             AND sessao_atual.usuario_id = usuario.id
             AND sessao_atual.id = sessao
             AND sessao_atual.status = 'ativa'
             AND sessao_atual.versao_autorizacao = usuario.versao_autorizacao
             AND sessao_atual.expira_inatividade_em > pg_catalog.clock_timestamp()
             AND sessao_atual.expira_absolutamente_em > pg_catalog.clock_timestamp()
         )
  INTO perfil_ator, status_ator, sessao_valida
  FROM public.usuarios AS usuario
  WHERE usuario.organizacao_id = organizacao
    AND usuario.id = ator
    AND usuario.versao_autorizacao = versao_ator;

  IF NOT FOUND OR status_ator <> 'ativo' OR NOT COALESCE(sessao_valida, false) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_session');
  END IF;
  IF perfil_ator <> 'admin' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'forbidden');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      organizacao || ':' || ator::text || ':'
      || (entrada ->> 'chave_idempotencia_hash'),
      35000036
    )
  );

  SELECT comando_atual.* INTO existente
  FROM public.comandos_administrativos_idempotencia AS comando_atual
  WHERE comando_atual.organizacao_id = organizacao
    AND comando_atual.ator_usuario_id = ator
    AND comando_atual.chave_idempotencia_hash =
      pg_catalog.decode(entrada ->> 'chave_idempotencia_hash', 'hex')
  FOR UPDATE;

  IF FOUND THEN
    IF existente.comando <> comando_esperado
      OR existente.hash_requisicao IS DISTINCT FROM
        pg_catalog.decode(entrada ->> 'hash_requisicao', 'hex')
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'idempotency_conflict');
    END IF;
    IF existente.status <> 'concluido'
      OR existente.codigo_http IS NULL
      OR existente.recibo IS NULL
    THEN
      RETURN pg_catalog.jsonb_build_object('status', 'idempotency_conflict');
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'replayed',
      'codigo_http', existente.codigo_http,
      'recibo', existente.recibo
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object('status', 'new');
END;
$$;

REVOKE INSERT, UPDATE ON TABLE
  public.propriedades,
  public.usuario_propriedade
FROM tche_agro_administration_owner;
REVOKE SELECT ON TABLE
  public.usuario_propriedade,
  public.catalogo_localidades_ibge_versoes,
  public.ufs_ibge,
  public.municipios_ibge
FROM tche_agro_administration_owner;

DROP INDEX IF EXISTS public.ix_usuario_propriedade_administracao_mp35c;
