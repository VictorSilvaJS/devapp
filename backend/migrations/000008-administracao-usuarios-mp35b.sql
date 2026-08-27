-- Up Migration

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'tche_agro_administration_owner'
  ) THEN
    CREATE ROLE tche_agro_administration_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS;
  END IF;
  ALTER ROLE tche_agro_administration_owner
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;
END;
$$;

-- Remove os grants colunares herdados da 000004 e os grants da primeira
-- versão local da 000008. O runtime não recebe DML direto nestes agregados.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuarios FROM tche_agro_runtime;
REVOKE INSERT (
  id, organizacao_id, nome, email, perfil, status,
  telefone, documento, observacoes, criado_em, atualizado_em
) ON public.usuarios FROM tche_agro_runtime;
REVOKE UPDATE (
  nome, email, status, versao_autorizacao, atualizado_em,
  telefone, documento, observacoes
) ON public.usuarios FROM tche_agro_runtime;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.produtores FROM tche_agro_runtime;
REVOKE INSERT (
  id, organizacao_id, usuario_id, nome, status, criado_em, atualizado_em
) ON public.produtores FROM tche_agro_runtime;
REVOKE UPDATE (nome, status, atualizado_em)
  ON public.produtores FROM tche_agro_runtime;

-- A 000004 precisava de INSERT direto enquanto os fluxos ainda não possuíam
-- interfaces estreitas. Na fronteira MP-35B todo evento do runtime passa por
-- uma operação de evento fixo; grants de tabela e coluna são ambos removidos.
REVOKE INSERT ON TABLE public.eventos_auditoria FROM tche_agro_runtime;
REVOKE INSERT (
  id, organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
  sessao_id, usuario_afetado_id, recurso_tipo, recurso_id, motivo_categoria,
  referencia_externa_hmac, request_id, endereco_ip_hmac, email_hmac,
  metadados, ocorrido_em
) ON public.eventos_auditoria FROM tche_agro_runtime;

-- Evento e entrega agora são criados somente pela operação transacional que
-- também deriva se a tentativa foi criação ou deduplicação real.
REVOKE INSERT ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega
FROM tche_agro_runtime;
REVOKE INSERT (
  id, organizacao_id, tipo_evento, chave_origem, recurso_tipo, recurso_id,
  propriedade_id, talhao_id, autor_id, dados_apresentacao, criado_em
) ON public.notificacao_evento FROM tche_agro_runtime;
REVOKE INSERT (
  id, evento_id, destinatario_usuario_id, organizacao_id, prioridade,
  criada_em, lida_em, descartada_em, chave_deduplicacao, expira_em
) ON public.notificacao_entrega FROM tche_agro_runtime;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.comandos_administrativos_idempotencia
  FROM tche_agro_runtime;

CREATE INDEX ix_usuarios_organizacao_nome_id_mp35b
  ON public.usuarios (organizacao_id, pg_catalog.lower(nome), id);

-- Projeção mínima para o worker revalidar também o convite associado depois
-- de obter o mesmo lock de entidade usado pela substituição administrativa.
CREATE VIEW public.estados_outbox_conta_mp35b
WITH (security_barrier = true)
AS
SELECT desafio.organizacao_id,
       desafio.id AS desafio_id,
       desafio.status AS desafio_status,
       desafio.expira_em AS desafio_expira_em,
       convite.id AS convite_id,
       convite.status AS convite_status,
       convite.expira_em AS convite_expira_em
FROM public.desafios_autenticacao AS desafio
LEFT JOIN public.convites_usuario AS convite
  ON convite.organizacao_id = desafio.organizacao_id
 AND convite.desafio_id = desafio.id;

REVOKE ALL ON TABLE public.estados_outbox_conta_mp35b FROM PUBLIC;
GRANT SELECT ON TABLE public.estados_outbox_conta_mp35b
  TO tche_agro_outbox_worker;

-- A mudança de status do Titular e a ativação existente de Propriedade devem
-- observar a mesma ordem total. A escrita HTTP de Propriedade continua fora
-- da MP-35B; este trigger protege apenas a invariável persistente da MP-35A.
CREATE FUNCTION public.tche_serializar_propriedade_titular_mp35b()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE organizacao text;
BEGIN
  organizacao := CASE WHEN TG_OP = 'DELETE'
    THEN OLD.organizacao_id ELSE NEW.organizacao_id END;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(organizacao, 35000037)
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_propriedades_serializar_titular_mp35b
BEFORE INSERT OR UPDATE OR DELETE ON public.propriedades
FOR EACH ROW
EXECUTE FUNCTION public.tche_serializar_propriedade_titular_mp35b();

REVOKE ALL ON FUNCTION
  public.tche_serializar_propriedade_titular_mp35b()
FROM PUBLIC;

CREATE TABLE public.mutacoes_conta_controladas_mp35b (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  finalidade text NOT NULL,
  prova_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_mutacoes_conta_controladas_mp35b_prova
    UNIQUE (finalidade, prova_id),
  CONSTRAINT fk_mutacoes_conta_controladas_mp35b_usuario
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_mutacoes_conta_controladas_mp35b_finalidade
    CHECK (finalidade IN (
      'recuperacao_senha',
      'alteracao_email_principal',
      'recuperacao_assistida',
      'recuperacao_admin_secundario'
    ))
);

CREATE FUNCTION public.tche_preservar_comando_administrativo_mp35b()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status <> 'processando' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recibo administrativo concluido e imutavel.',
      CONSTRAINT = 'ck_comandos_administrativos_conclusao_imutavel';
  END IF;
  IF NEW.status <> 'concluido' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Comando administrativo avanca somente para concluido.',
      CONSTRAINT = 'ck_comandos_administrativos_transicao_unica';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organizacao_id IS DISTINCT FROM OLD.organizacao_id
    OR NEW.ator_usuario_id IS DISTINCT FROM OLD.ator_usuario_id
    OR NEW.sessao_id IS DISTINCT FROM OLD.sessao_id
    OR NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
    OR NEW.chave_idempotencia_hash IS DISTINCT FROM OLD.chave_idempotencia_hash
    OR NEW.comando IS DISTINCT FROM OLD.comando
    OR NEW.hash_requisicao IS DISTINCT FROM OLD.hash_requisicao
    OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
    OR NEW.expira_em IS DISTINCT FROM OLD.expira_em
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Identidade do comando administrativo e imutavel.',
      CONSTRAINT = 'ck_comandos_administrativos_identidade_imutavel';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comandos_administrativos_ciclo_mp35b
BEFORE UPDATE ON public.comandos_administrativos_idempotencia
FOR EACH ROW
EXECUTE FUNCTION public.tche_preservar_comando_administrativo_mp35b();

REVOKE ALL ON FUNCTION
  public.tche_preservar_comando_administrativo_mp35b()
FROM PUBLIC;

CREATE FUNCTION public.tche_jsonb_chaves_exatas_mp35b(
  valor jsonb,
  permitidas text[],
  obrigatorias text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT pg_catalog.jsonb_typeof(valor) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(valor) AS chaves(chave)
      WHERE NOT (chave = ANY (permitidas))
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.unnest(obrigatorias) AS chaves(chave)
      WHERE NOT (valor ? chave)
    );
$$;

CREATE FUNCTION public.tche_exigir_runtime_exclusivo_mp35b()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  sessao_superuser boolean;
BEGIN
  SELECT papel.rolsuper INTO sessao_superuser
  FROM pg_catalog.pg_roles AS papel
  WHERE papel.rolname = SESSION_USER;

  IF COALESCE(sessao_superuser, true)
    OR NOT pg_catalog.pg_has_role(SESSION_USER, 'tche_agro_runtime', 'MEMBER')
    OR pg_catalog.pg_has_role(SESSION_USER, 'tche_agro_platform_ops', 'MEMBER')
    OR pg_catalog.pg_has_role(SESSION_USER, 'tche_agro_outbox_worker', 'MEMBER')
    OR pg_catalog.pg_has_role(
      SESSION_USER, 'tche_agro_administration_maintenance', 'MEMBER'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER, 'tche_agro_administration_owner', 'MEMBER'
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A interface exige LOGIN runtime exclusivo.',
      CONSTRAINT = 'ck_mp35b_runtime_exclusivo';
  END IF;
END;
$$;

-- Escritor genérico exclusivamente interno. As interfaces concedidas ao
-- runtime não recebem evento: cada uma fixa um único evento de domínio e esta
-- função exige a prova persistida da transição realizada na transação atual.
CREATE FUNCTION public.tche_auditoria_inserir_interno_mp35b(
  evento_fixo text,
  entrada jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  evento_id uuid;
  organizacao text;
  resultado_evento text;
  ator_tipo_evento text;
  ator_usuario uuid;
  sessao_ator uuid;
  usuario_afetado uuid;
  recurso_tipo_evento text;
  recurso_id_evento text;
  motivo text;
  referencia_hmac bytea;
  requisicao text;
  email_hmac_evento bytea;
  metadados_evento jsonb;
  metadados_validos boolean := false;
  ocorrido timestamptz;
  transicao_valida boolean := false;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  IF evento_fixo NOT IN (
    'auth.convite.aceito',
    'auth.convite.criado',
    'auth.email_principal.alteracao_solicitada',
    'auth.email_principal.alterado',
    'auth.email_principal.endereco_atual_confirmado',
    'auth.email_secundario.verificacao_solicitada',
    'auth.email_secundario.verificado',
    'auth.recuperacao_admin.break_glass_concluida',
    'auth.recuperacao_admin.break_glass_iniciada',
    'auth.recuperacao_admin.email_confirmado',
    'auth.recuperacao_admin.novo_email_confirmado',
    'auth.recuperacao_admin.secundario_cancelada',
    'auth.recuperacao_admin.secundario_concluida',
    'auth.recuperacao_admin.secundario_confirmado',
    'auth.recuperacao_admin.secundario_solicitada',
    'auth.recuperacao_assistida.aprovada',
    'auth.recuperacao_assistida.cancelada',
    'auth.recuperacao_assistida.concluida',
    'auth.recuperacao_assistida.email_confirmado',
    'auth.recuperacao_assistida.solicitada',
    'auth.recuperacao_senha.concluida',
    'auth.recuperacao_senha.solicitada',
    'auth.refresh.reutilizado',
    'auth.refresh.rotacionado',
    'auth.senha.alterada',
    'auth.sessao.criada',
    'auth.sessao.logout',
    'auth.sessao.logout_todas',
    'auth.sessao.revogada',
    'notificacao.criada',
    'notificacao.deduplicada',
    'notificacao.descartada',
    'notificacao.destino_resolucao_negada',
    'notificacao.leituras_em_lote',
    'notificacao.lida'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Evento nao pertence a uma interface runtime estreita.',
      CONSTRAINT = 'ck_mp35b_auditoria_evento_fixo';
  END IF;
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    entrada,
    ARRAY[
      'id', 'organizationId', 'result', 'actorType', 'actorUserId',
      'sessionId', 'affectedUserId', 'resourceType', 'resourceId',
      'reasonCategory', 'externalReferenceHmacHex', 'requestId',
      'emailHmacHex', 'metadata', 'occurredAt'
    ],
    ARRAY[
      'organizationId', 'result', 'actorType', 'resourceType',
      'resourceId', 'metadata'
    ]
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Contrato de auditoria runtime invalido.',
      CONSTRAINT = 'ck_mp35b_auditoria_entrada';
  END IF;

  evento_id := COALESCE((entrada->>'id')::uuid, pg_catalog.gen_random_uuid());
  organizacao := entrada->>'organizationId';
  resultado_evento := entrada->>'result';
  ator_tipo_evento := entrada->>'actorType';
  ator_usuario := (entrada->>'actorUserId')::uuid;
  sessao_ator := (entrada->>'sessionId')::uuid;
  usuario_afetado := (entrada->>'affectedUserId')::uuid;
  recurso_tipo_evento := entrada->>'resourceType';
  recurso_id_evento := entrada->>'resourceId';
  motivo := entrada->>'reasonCategory';
  requisicao := entrada->>'requestId';
  metadados_evento := entrada->'metadata';
  ocorrido := COALESCE(
    (entrada->>'occurredAt')::timestamptz,
    pg_catalog.clock_timestamp()
  );
  IF entrada ? 'externalReferenceHmacHex' THEN
    referencia_hmac := pg_catalog.decode(
      entrada->>'externalReferenceHmacHex', 'hex'
    );
  END IF;
  IF entrada ? 'emailHmacHex' THEN
    email_hmac_evento := pg_catalog.decode(entrada->>'emailHmacHex', 'hex');
  END IF;

  IF resultado_evento NOT IN ('sucesso', 'negado', 'falha')
    OR ator_tipo_evento NOT IN ('usuario', 'sistema', 'plataforma')
    OR recurso_tipo_evento !~ '^[a-z][a-z0-9_]{1,63}$'
    OR pg_catalog.char_length(pg_catalog.btrim(recurso_id_evento)) = 0
    OR pg_catalog.jsonb_typeof(metadados_evento) <> 'object'
    OR pg_catalog.pg_column_size(metadados_evento) > 16384
    OR (evento_fixo IN (
      'auth.refresh.reutilizado',
      'notificacao.destino_resolucao_negada'
    ) AND resultado_evento <> 'negado')
    OR (evento_fixo NOT IN (
      'auth.refresh.reutilizado',
      'notificacao.destino_resolucao_negada'
    ) AND resultado_evento <> 'sucesso')
    OR (
      ator_tipo_evento = 'usuario'
      AND (
        ator_usuario IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.usuarios AS usuario
          WHERE usuario.organizacao_id = organizacao
            AND usuario.id = ator_usuario
            AND usuario.status = 'ativo'
        )
        OR (
          sessao_ator IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.sessoes_autenticacao AS sessao
            WHERE sessao.organizacao_id = organizacao
              AND sessao.usuario_id = ator_usuario
              AND sessao.id = sessao_ator
          )
        )
      )
    )
    OR (
      ator_tipo_evento IN ('sistema', 'plataforma')
      AND (ator_usuario IS NOT NULL OR sessao_ator IS NOT NULL)
    )
    OR (
      usuario_afetado IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.usuarios AS usuario
        WHERE usuario.organizacao_id = organizacao
          AND usuario.id = usuario_afetado
      )
    )
    OR (
      (motivo IS NOT NULL OR referencia_hmac IS NOT NULL)
      AND evento_fixo NOT IN (
        'auth.recuperacao_admin.break_glass_iniciada',
        'auth.recuperacao_assistida.solicitada',
        'auth.recuperacao_assistida.aprovada'
      )
    )
    OR (
      email_hmac_evento IS NOT NULL
      AND evento_fixo <> 'auth.recuperacao_senha.solicitada'
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Identidade ou resultado da auditoria runtime invalido.',
      CONSTRAINT = 'ck_mp35b_auditoria_identidade';
  END IF;

  IF evento_fixo IN ('auth.convite.aceito', 'auth.convite.criado') THEN
    metadados_validos := public.tche_jsonb_chaves_exatas_mp35b(
      metadados_evento,
      ARRAY['activation_mode'],
      ARRAY['activation_mode']
    ) AND metadados_evento->>'activation_mode' IN (
      'activate_bootstrap_admin', 'activate_user', 'keep_status'
    );
  ELSIF evento_fixo IN (
    'auth.recuperacao_admin.break_glass_iniciada'
  ) THEN
    metadados_validos := public.tche_jsonb_chaves_exatas_mp35b(
      metadados_evento,
      ARRAY['execution_channel', 'policy_version', 'approval_count'],
      ARRAY['execution_channel', 'policy_version', 'approval_count']
    )
      AND metadados_evento->>'execution_channel' = 'cli_break_glass'
      AND metadados_evento->>'policy_version' ~ '^[a-z0-9_.-]{1,100}$'
      AND (metadados_evento->>'approval_count')::integer >= 2;
  ELSIF evento_fixo = 'auth.recuperacao_admin.break_glass_concluida' THEN
    metadados_validos := metadados_evento =
      '{"execution_channel":"email_break_glass"}'::jsonb;
  ELSIF evento_fixo IN (
    'auth.recuperacao_admin.secundario_solicitada',
    'auth.recuperacao_admin.secundario_concluida'
  ) THEN
    metadados_validos := metadados_evento =
      '{"execution_channel":"verified_secondary_self_service"}'::jsonb;
  ELSIF evento_fixo IN (
    'auth.recuperacao_assistida.solicitada',
    'auth.recuperacao_assistida.aprovada'
  ) THEN
    metadados_validos := metadados_evento =
      '{"approval_mode":"single_admin_risk_accepted"}'::jsonb;
  ELSIF evento_fixo = 'auth.senha.alterada' THEN
    metadados_validos := metadados_evento =
      '{"sessao_atual_preservada":true,"tokens_girados":true}'::jsonb;
  ELSIF evento_fixo = 'auth.recuperacao_senha.concluida' THEN
    metadados_validos := metadados_evento =
      '{"login_automatico":false}'::jsonb;
  ELSIF evento_fixo IN ('notificacao.criada', 'notificacao.deduplicada') THEN
    metadados_validos := public.tche_jsonb_chaves_exatas_mp35b(
      metadados_evento,
      ARRAY['evento_origem_id', 'tipo_evento'],
      ARRAY['evento_origem_id', 'tipo_evento']
    )
      AND metadados_evento->>'evento_origem_id' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND metadados_evento->>'tipo_evento' IN (
        'conta.senha_alterada.v1',
        'conta.email_principal_alterado.v1',
        'conta.recuperacao_concluida.v1'
      );
  ELSIF evento_fixo = 'notificacao.leituras_em_lote' THEN
    metadados_validos := public.tche_jsonb_chaves_exatas_mp35b(
      metadados_evento,
      ARRAY['atualizadas'],
      ARRAY['atualizadas']
    ) AND (metadados_evento->>'atualizadas')::integer >= 0;
  ELSE
    metadados_validos := metadados_evento = '{}'::jsonb;
  END IF;
  IF NOT metadados_validos THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Metadados nao pertencem ao evento runtime fixo.',
      CONSTRAINT = 'ck_mp35b_auditoria_metadados_fixos';
  END IF;

  IF recurso_tipo_evento = 'sessao'
    AND evento_fixo IN (
      'auth.sessao.criada', 'auth.refresh.reutilizado',
      'auth.refresh.rotacionado', 'auth.sessao.logout',
      'auth.sessao.revogada'
    )
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.sessoes_autenticacao AS sessao
      WHERE sessao.organizacao_id = organizacao
        AND sessao.id = recurso_id_evento::uuid
        AND sessao.usuario_id IS NOT DISTINCT FROM usuario_afetado
        AND sessao.xmin::text = pg_catalog.pg_current_xact_id()::text
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'action_challenge'
    AND evento_fixo IN (
      'auth.convite.aceito', 'auth.convite.criado',
      'auth.email_principal.alteracao_solicitada',
      'auth.email_principal.alterado',
      'auth.email_principal.endereco_atual_confirmado',
      'auth.email_secundario.verificacao_solicitada'
    )
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.desafios_autenticacao AS desafio
      WHERE desafio.organizacao_id = organizacao
        AND desafio.id = recurso_id_evento::uuid
        AND desafio.usuario_id IS NOT DISTINCT FROM usuario_afetado
        AND desafio.xmin::text = pg_catalog.pg_current_xact_id()::text
        AND (
          evento_fixo NOT IN ('auth.convite.aceito', 'auth.convite.criado')
          OR EXISTS (
            SELECT 1 FROM public.convites_usuario AS convite
            WHERE convite.organizacao_id = desafio.organizacao_id
              AND convite.desafio_id = desafio.id
              AND convite.modo_ativacao = CASE
                WHEN metadados_evento->>'activation_mode' =
                  'activate_bootstrap_admin' THEN 'ativar_admin_bootstrap'
                WHEN metadados_evento->>'activation_mode' =
                  'activate_user' THEN 'ativar_usuario'
                ELSE 'manter_status'
              END
          )
        )
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'contato_email'
    AND evento_fixo = 'auth.email_secundario.verificado'
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contatos_email_usuario AS contato
      WHERE contato.organizacao_id = organizacao
        AND contato.id = recurso_id_evento::uuid
        AND contato.usuario_id IS NOT DISTINCT FROM usuario_afetado
        AND contato.xmin::text = pg_catalog.pg_current_xact_id()::text
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento IN (
    'assisted_recovery', 'admin_break_glass_recovery'
  ) AND evento_fixo LIKE 'auth.recuperacao_%'
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.recuperacoes_assistidas AS recuperacao
      WHERE recuperacao.organizacao_id = organizacao
        AND recuperacao.id = recurso_id_evento::uuid
        AND recuperacao.usuario_id IS NOT DISTINCT FROM usuario_afetado
        AND recuperacao.xmin::text = pg_catalog.pg_current_xact_id()::text
        AND (
          (recurso_tipo_evento = 'assisted_recovery'
            AND recuperacao.origem = 'admin_http')
          OR (recurso_tipo_evento = 'admin_break_glass_recovery'
            AND recuperacao.origem = 'plataforma_cli')
        )
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'admin_secondary_recovery'
    AND evento_fixo LIKE 'auth.recuperacao_admin.%'
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.recuperacoes_admin_email_secundario AS recuperacao
      WHERE recuperacao.organizacao_id = organizacao
        AND recuperacao.id = recurso_id_evento::uuid
        AND recuperacao.usuario_admin_id IS NOT DISTINCT FROM usuario_afetado
        AND recuperacao.xmin::text = pg_catalog.pg_current_xact_id()::text
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'usuario'
    AND recurso_id_evento = usuario_afetado::text
    AND evento_fixo IN (
      'auth.senha.alterada', 'auth.recuperacao_senha.solicitada',
      'auth.recuperacao_senha.concluida', 'auth.sessao.logout_todas'
    )
  THEN
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios AS usuario
        WHERE usuario.organizacao_id = organizacao
          AND usuario.id = usuario_afetado
          AND usuario.xmin::text = pg_catalog.pg_current_xact_id()::text
      )
      OR EXISTS (
        SELECT 1 FROM public.credenciais_usuario AS credencial
        WHERE credencial.organizacao_id = organizacao
          AND credencial.usuario_id = usuario_afetado
          AND credencial.xmin::text = pg_catalog.pg_current_xact_id()::text
      )
      OR EXISTS (
        SELECT 1 FROM public.desafios_autenticacao AS desafio
        WHERE desafio.organizacao_id = organizacao
          AND desafio.usuario_id = usuario_afetado
          AND desafio.xmin::text = pg_catalog.pg_current_xact_id()::text
      )
      OR EXISTS (
        SELECT 1 FROM public.sessoes_autenticacao AS sessao
        WHERE sessao.organizacao_id = organizacao
          AND sessao.usuario_id = usuario_afetado
          AND sessao.xmin::text = pg_catalog.pg_current_xact_id()::text
      )
    INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'notificacao_entrega'
    AND evento_fixo IN (
      'notificacao.criada', 'notificacao.deduplicada',
      'notificacao.descartada', 'notificacao.lida'
    )
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.notificacao_entrega AS entrega
      JOIN public.notificacao_evento AS evento
        ON evento.organizacao_id = entrega.organizacao_id
       AND evento.id = entrega.evento_id
      WHERE entrega.organizacao_id = organizacao
        AND entrega.id = recurso_id_evento::uuid
        AND entrega.destinatario_usuario_id IS NOT DISTINCT FROM usuario_afetado
        AND (
          evento_fixo NOT IN ('notificacao.criada', 'notificacao.deduplicada')
          OR (
            evento.chave_origem = metadados_evento->>'evento_origem_id'
            AND evento.tipo_evento = metadados_evento->>'tipo_evento'
          )
        )
        AND (
          evento_fixo = 'notificacao.deduplicada'
          OR entrega.xmin::text = pg_catalog.pg_current_xact_id()::text
        )
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'notificacao_entrega'
    AND evento_fixo = 'notificacao.destino_resolucao_negada'
    AND ator_usuario = usuario_afetado
  THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.notificacao_entrega AS entrega
      WHERE entrega.organizacao_id = organizacao
        AND entrega.id = recurso_id_evento::uuid
        AND entrega.destinatario_usuario_id = ator_usuario
    ) INTO transicao_valida;
  ELSIF recurso_tipo_evento = 'usuario'
    AND evento_fixo = 'notificacao.leituras_em_lote'
    AND recurso_id_evento = ator_usuario::text
    AND ator_usuario = usuario_afetado
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.notificacao_comando_idempotencia AS comando
      WHERE comando.organizacao_id = organizacao
        AND comando.usuario_id = ator_usuario
        AND comando.comando = 'leituras'
        AND comando.xmin::text = pg_catalog.pg_current_xact_id()::text
    ) INTO transicao_valida;
  END IF;

  IF NOT transicao_valida THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Auditoria sem transicao de dominio correspondente.',
      CONSTRAINT = 'ck_mp35b_auditoria_prova_transacao';
  END IF;

  INSERT INTO public.eventos_auditoria (
    id, organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    motivo_categoria, referencia_externa_hmac, request_id, email_hmac,
    metadados, ocorrido_em
  ) VALUES (
    evento_id, organizacao, evento_fixo, resultado_evento, ator_tipo_evento,
    ator_usuario, sessao_ator, usuario_afetado, recurso_tipo_evento,
    recurso_id_evento, motivo, referencia_hmac, requisicao,
    email_hmac_evento, metadados_evento, ocorrido
  );
END;
$$;

DO $auditoria_runtime$
DECLARE
  interface record;
BEGIN
  FOR interface IN
    SELECT * FROM (VALUES
      ('tche_aud_convite_aceito_mp35b', 'auth.convite.aceito'),
      ('tche_aud_convite_criado_mp35b', 'auth.convite.criado'),
      ('tche_aud_email_principal_solicitada_mp35b', 'auth.email_principal.alteracao_solicitada'),
      ('tche_aud_email_principal_alterado_mp35b', 'auth.email_principal.alterado'),
      ('tche_aud_email_principal_atual_confirmado_mp35b', 'auth.email_principal.endereco_atual_confirmado'),
      ('tche_aud_email_secundario_solicitada_mp35b', 'auth.email_secundario.verificacao_solicitada'),
      ('tche_aud_email_secundario_verificado_mp35b', 'auth.email_secundario.verificado'),
      ('tche_aud_rec_admin_breakglass_concluida_mp35b', 'auth.recuperacao_admin.break_glass_concluida'),
      ('tche_aud_rec_admin_breakglass_iniciada_mp35b', 'auth.recuperacao_admin.break_glass_iniciada'),
      ('tche_aud_rec_admin_breakglass_email_mp35b', 'auth.recuperacao_admin.email_confirmado'),
      ('tche_aud_rec_admin_novo_email_mp35b', 'auth.recuperacao_admin.novo_email_confirmado'),
      ('tche_aud_rec_admin_sec_cancelada_mp35b', 'auth.recuperacao_admin.secundario_cancelada'),
      ('tche_aud_rec_admin_sec_concluida_mp35b', 'auth.recuperacao_admin.secundario_concluida'),
      ('tche_aud_rec_admin_sec_confirmado_mp35b', 'auth.recuperacao_admin.secundario_confirmado'),
      ('tche_aud_rec_admin_sec_solicitada_mp35b', 'auth.recuperacao_admin.secundario_solicitada'),
      ('tche_aud_rec_assist_aprovada_mp35b', 'auth.recuperacao_assistida.aprovada'),
      ('tche_aud_rec_assist_cancelada_mp35b', 'auth.recuperacao_assistida.cancelada'),
      ('tche_aud_rec_assist_concluida_mp35b', 'auth.recuperacao_assistida.concluida'),
      ('tche_aud_rec_assist_email_mp35b', 'auth.recuperacao_assistida.email_confirmado'),
      ('tche_aud_rec_assist_solicitada_mp35b', 'auth.recuperacao_assistida.solicitada'),
      ('tche_aud_rec_senha_concluida_mp35b', 'auth.recuperacao_senha.concluida'),
      ('tche_aud_rec_senha_solicitada_mp35b', 'auth.recuperacao_senha.solicitada'),
      ('tche_aud_refresh_reutilizado_mp35b', 'auth.refresh.reutilizado'),
      ('tche_aud_refresh_rotacionado_mp35b', 'auth.refresh.rotacionado'),
      ('tche_aud_senha_alterada_mp35b', 'auth.senha.alterada'),
      ('tche_aud_sessao_criada_mp35b', 'auth.sessao.criada'),
      ('tche_aud_sessao_logout_mp35b', 'auth.sessao.logout'),
      ('tche_aud_sessao_logout_todas_mp35b', 'auth.sessao.logout_todas'),
      ('tche_aud_sessao_revogada_mp35b', 'auth.sessao.revogada'),
      ('tche_aud_notificacao_criada_mp35b', 'notificacao.criada'),
      ('tche_aud_notificacao_deduplicada_mp35b', 'notificacao.deduplicada'),
      ('tche_aud_notificacao_descartada_mp35b', 'notificacao.descartada'),
      ('tche_aud_notificacao_destino_negado_mp35b', 'notificacao.destino_resolucao_negada'),
      ('tche_aud_notificacao_leituras_lote_mp35b', 'notificacao.leituras_em_lote'),
      ('tche_aud_notificacao_lida_mp35b', 'notificacao.lida')
    ) AS interfaces(funcao, evento)
  LOOP
    EXECUTE pg_catalog.format(
      $ddl$
        CREATE FUNCTION public.%I(entrada jsonb)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $funcao$
        BEGIN
          PERFORM public.tche_auditoria_inserir_interno_mp35b(%L, entrada);
        END;
        $funcao$
      $ddl$,
      interface.funcao,
      interface.evento
    );
  END LOOP;
END;
$auditoria_runtime$;

CREATE FUNCTION public.tche_notificacao_bloquear_ator_mp35b(
  organizacao text,
  usuario uuid,
  perfil_esperado text,
  versao_esperada bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  PERFORM 1
  FROM public.usuarios AS ator
  WHERE ator.organizacao_id = organizacao
    AND ator.id = usuario
    AND ator.perfil = perfil_esperado
    AND ator.status = 'ativo'
    AND ator.versao_autorizacao = versao_esperada
  FOR UPDATE;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.tche_notificacao_obter_comando_mp35b(
  organizacao text,
  usuario uuid,
  chave bytea
)
RETURNS TABLE (
  comando text,
  alvo_entrega_id uuid,
  hash_requisicao bytea,
  corte_em timestamptz,
  resultado_em timestamptz,
  resultado_quantidade integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  RETURN QUERY
    SELECT existente.comando,
           existente.alvo_entrega_id,
           existente.hash_requisicao,
           existente.corte_em,
           existente.resultado_em,
           existente.resultado_quantidade
    FROM public.notificacao_comando_idempotencia AS existente
    WHERE existente.organizacao_id = organizacao
      AND existente.usuario_id = usuario
      AND existente.chave_idempotencia_hash = chave
    FOR UPDATE;
END;
$$;

-- A criação e a deduplicação deixam de ser eventos solicitados pelo runtime.
-- Esta operação recebe somente a auditoria do fato de conta já gravada na
-- transação e um identificador opaco da tentativa. Todo o restante é derivado.
CREATE FUNCTION public.tche_notificacao_entregar_conta_mp35b(
  auditoria_origem uuid,
  tentativa uuid
)
RETURNS TABLE (
  entrega_id uuid,
  evento_id uuid,
  organizacao_id text,
  destinatario_usuario_id uuid,
  tipo_evento text,
  autor_usuario_id uuid,
  resultado_tentativa text,
  ocorrido_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  origem public.eventos_auditoria%ROWTYPE;
  auditoria_existente public.eventos_auditoria%ROWTYPE;
  evento_existente public.notificacao_evento%ROWTYPE;
  entrega_existente public.notificacao_entrega%ROWTYPE;
  tipo_derivado text;
  autor_derivado uuid;
  ator_tipo_derivado text;
  entrega_criada boolean;
  ocorrido_derivado timestamptz;
  resultado_derivado text;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  IF auditoria_origem IS NULL OR tentativa IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Identificadores da tentativa de notificacao sao obrigatorios.',
      CONSTRAINT = 'ck_mp35b_notificacao_tentativa_ids';
  END IF;

  SELECT auditoria.* INTO origem
  FROM public.eventos_auditoria AS auditoria
  WHERE auditoria.id = auditoria_origem
    AND auditoria.resultado = 'sucesso'
    AND auditoria.usuario_afetado_id IS NOT NULL
    AND auditoria.evento IN (
      'auth.senha.alterada',
      'auth.email_principal.alterado',
      'auth.recuperacao_senha.concluida',
      'auth.recuperacao_admin.secundario_concluida',
      'auth.recuperacao_assistida.concluida'
    )
    AND auditoria.xmin::text = pg_catalog.pg_current_xact_id()::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Notificacao exige fato de conta da transacao corrente.',
      CONSTRAINT = 'ck_mp35b_notificacao_fato_corrente';
  END IF;

  -- Serializa tentativas para a mesma origem sem conceder UPDATE nas tabelas
  -- de notificacao ao owner da operacao.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auditoria_origem::text, 35)
  );

  tipo_derivado := CASE origem.evento
    WHEN 'auth.senha.alterada' THEN 'conta.senha_alterada.v1'
    WHEN 'auth.email_principal.alterado' THEN
      'conta.email_principal_alterado.v1'
    ELSE 'conta.recuperacao_concluida.v1'
  END;
  autor_derivado := CASE
    WHEN origem.evento IN (
      'auth.senha.alterada', 'auth.email_principal.alterado'
    ) THEN origem.usuario_afetado_id
    ELSE NULL
  END;
  IF origem.evento = 'auth.recuperacao_assistida.concluida' THEN
    SELECT recuperacao.solicitada_por_usuario_id INTO autor_derivado
    FROM public.recuperacoes_assistidas AS recuperacao
    WHERE recuperacao.organizacao_id = origem.organizacao_id
      AND recuperacao.id = origem.recurso_id::uuid
      AND recuperacao.usuario_id = origem.usuario_afetado_id
      AND recuperacao.status = 'concluida';
    IF NOT FOUND OR autor_derivado IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Origem da recuperacao assistida nao corresponde ao fato.',
        CONSTRAINT = 'ck_mp35b_notificacao_autor_assistido';
    END IF;
  END IF;
  ator_tipo_derivado := CASE
    WHEN autor_derivado IS NULL THEN 'sistema'
    ELSE 'usuario'
  END;

  SELECT auditoria.* INTO auditoria_existente
  FROM public.eventos_auditoria AS auditoria
  WHERE auditoria.id = tentativa;
  IF FOUND THEN
    IF auditoria_existente.organizacao_id <> origem.organizacao_id
      OR auditoria_existente.evento NOT IN (
        'notificacao.criada', 'notificacao.deduplicada'
      )
      OR auditoria_existente.resultado <> 'sucesso'
      OR auditoria_existente.ator_tipo <> ator_tipo_derivado
      OR auditoria_existente.ator_usuario_id IS DISTINCT FROM autor_derivado
      OR auditoria_existente.sessao_id IS NOT NULL
      OR auditoria_existente.usuario_afetado_id <>
        origem.usuario_afetado_id
      OR auditoria_existente.recurso_tipo <> 'notificacao_entrega'
      OR auditoria_existente.recurso_id !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR auditoria_existente.request_id IS NOT NULL
      OR auditoria_existente.metadados <> pg_catalog.jsonb_build_object(
        'evento_origem_id', auditoria_origem::text,
        'tipo_evento', tipo_derivado
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Identificador de tentativa ja pertence a outro evento.',
        CONSTRAINT = 'ck_mp35b_notificacao_tentativa_replay';
    END IF;

    SELECT entrega.* INTO entrega_existente
    FROM public.notificacao_entrega AS entrega
    JOIN public.notificacao_evento AS evento
      ON evento.organizacao_id = entrega.organizacao_id
     AND evento.id = entrega.evento_id
    WHERE entrega.organizacao_id = origem.organizacao_id
      AND entrega.id = auditoria_existente.recurso_id::uuid
      AND entrega.destinatario_usuario_id = origem.usuario_afetado_id
      AND evento.tipo_evento = tipo_derivado
      AND evento.chave_origem = auditoria_origem::text
      AND evento.recurso_tipo = 'conta'
      AND evento.recurso_id = origem.usuario_afetado_id
      AND evento.autor_id IS NOT DISTINCT FROM autor_derivado;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Replay nao corresponde a uma entrega persistida.',
        CONSTRAINT = 'ck_mp35b_notificacao_replay_entrega';
    END IF;
    SELECT evento.* INTO evento_existente
    FROM public.notificacao_evento AS evento
    WHERE evento.organizacao_id = entrega_existente.organizacao_id
      AND evento.id = entrega_existente.evento_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Evento do replay de notificacao nao foi encontrado.',
        CONSTRAINT = 'ck_mp35b_notificacao_replay_evento';
    END IF;

    RETURN QUERY SELECT
      entrega_existente.id,
      evento_existente.id,
      evento_existente.organizacao_id,
      entrega_existente.destinatario_usuario_id,
      evento_existente.tipo_evento,
      evento_existente.autor_id,
      CASE auditoria_existente.evento
        WHEN 'notificacao.criada' THEN 'criada'
        ELSE 'deduplicada'
      END,
      auditoria_existente.ocorrido_em;
    RETURN;
  END IF;

  INSERT INTO public.notificacao_evento (
    id, organizacao_id, tipo_evento, chave_origem, recurso_tipo,
    recurso_id, autor_id, dados_apresentacao
  ) VALUES (
    pg_catalog.gen_random_uuid(), origem.organizacao_id, tipo_derivado,
    auditoria_origem::text, 'conta', origem.usuario_afetado_id,
    autor_derivado, '{}'::jsonb
  )
  ON CONFLICT ON CONSTRAINT uq_notificacao_evento_origem DO NOTHING;

  SELECT evento.* INTO evento_existente
  FROM public.notificacao_evento AS evento
  WHERE evento.organizacao_id = origem.organizacao_id
    AND evento.tipo_evento = tipo_derivado
    AND evento.chave_origem = auditoria_origem::text;
  IF NOT FOUND
    OR evento_existente.recurso_tipo <> 'conta'
    OR evento_existente.recurso_id <> origem.usuario_afetado_id
    OR evento_existente.autor_id IS DISTINCT FROM autor_derivado
    OR evento_existente.dados_apresentacao <> '{}'::jsonb
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Evento de notificacao nao corresponde ao fato de conta.',
      CONSTRAINT = 'ck_mp35b_notificacao_evento_derivado';
  END IF;

  INSERT INTO public.notificacao_entrega (
    id, evento_id, destinatario_usuario_id, organizacao_id,
    prioridade, criada_em, chave_deduplicacao, expira_em
  ) VALUES (
    pg_catalog.gen_random_uuid(), evento_existente.id,
    origem.usuario_afetado_id, origem.organizacao_id, 'alta',
    evento_existente.criado_em,
    tipo_derivado || ':' || auditoria_origem::text,
    evento_existente.criado_em + interval '90 days'
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO entrega_existente;
  entrega_criada := FOUND;

  IF NOT entrega_criada THEN
    SELECT entrega.* INTO entrega_existente
    FROM public.notificacao_entrega AS entrega
    WHERE entrega.organizacao_id = origem.organizacao_id
      AND entrega.destinatario_usuario_id = origem.usuario_afetado_id
      AND entrega.chave_deduplicacao =
        tipo_derivado || ':' || auditoria_origem::text;
  END IF;
  IF NOT FOUND OR entrega_existente.evento_id <> evento_existente.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Entrega deduplicada nao corresponde ao evento de origem.',
      CONSTRAINT = 'ck_mp35b_notificacao_entrega_derivada';
  END IF;

  resultado_derivado := CASE
    WHEN entrega_criada THEN 'notificacao.criada'
    ELSE 'notificacao.deduplicada'
  END;
  ocorrido_derivado := CASE
    WHEN entrega_criada THEN entrega_existente.criada_em
    ELSE pg_catalog.clock_timestamp()
  END;
  PERFORM public.tche_auditoria_inserir_interno_mp35b(
    resultado_derivado,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', tentativa::text,
      'organizationId', origem.organizacao_id,
      'result', 'sucesso',
      'actorType', ator_tipo_derivado,
      'actorUserId', autor_derivado,
      'affectedUserId', origem.usuario_afetado_id::text,
      'resourceType', 'notificacao_entrega',
      'resourceId', entrega_existente.id::text,
      'metadata', pg_catalog.jsonb_build_object(
        'evento_origem_id', auditoria_origem::text,
        'tipo_evento', tipo_derivado
      ),
      'occurredAt', ocorrido_derivado
    ))
  );

  RETURN QUERY SELECT
    entrega_existente.id,
    evento_existente.id,
    evento_existente.organizacao_id,
    entrega_existente.destinatario_usuario_id,
    evento_existente.tipo_evento,
    evento_existente.autor_id,
    CASE WHEN entrega_criada THEN 'criada' ELSE 'deduplicada' END,
    ocorrido_derivado;
END;
$$;

-- A resolução usa somente sessão, entrega e request_id. A identidade e a
-- organização são derivadas da sessão; o advisory lock e a própria auditoria
-- persistida tornam a negação idempotente sem uma interface genérica.
CREATE FUNCTION public.tche_notificacao_resolver_destino_mp35b(
  sessao_solicitante uuid,
  entrega_solicitada uuid,
  requisicao text
)
RETURNS TABLE (recurso_tipo text, recurso_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  ator record;
  destino record;
  negacoes_existentes record;
  agora timestamptz;
  requisicao_segura text;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  requisicao_segura := pg_catalog.btrim(requisicao);
  IF sessao_solicitante IS NULL
    OR entrega_solicitada IS NULL
    OR requisicao_segura IS NULL
    OR pg_catalog.char_length(requisicao_segura) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Identificadores da resolucao de notificacao sao invalidos.',
      CONSTRAINT = 'ck_mp35b_notificacao_resolucao_entrada';
  END IF;

  agora := pg_catalog.clock_timestamp();
  SELECT usuario.organizacao_id, usuario.id AS usuario_id
  INTO ator
  FROM public.sessoes_autenticacao AS sessao
  JOIN public.usuarios AS usuario
    ON usuario.organizacao_id = sessao.organizacao_id
   AND usuario.id = sessao.usuario_id
  WHERE sessao.id = sessao_solicitante
    AND sessao.status = 'ativa'
    AND sessao.expira_inatividade_em > agora
    AND sessao.expira_absolutamente_em > agora
    AND usuario.status = 'ativo'
    AND usuario.versao_autorizacao = sessao.versao_autorizacao
  FOR UPDATE OF sessao, usuario;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Resolucao exige sessao runtime valida.',
      CONSTRAINT = 'ck_mp35b_notificacao_resolucao_sessao';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    ator.organizacao_id || ':' || ator.usuario_id::text || ':' ||
    sessao_solicitante::text || ':' || requisicao_segura,
    35000035
  ));

  SELECT count(*)::integer AS quantidade,
         pg_catalog.bool_and(
           auditoria.recurso_id = entrega_solicitada::text
         ) AS mesmo_alvo
  INTO negacoes_existentes
  FROM public.eventos_auditoria AS auditoria
  WHERE auditoria.organizacao_id = ator.organizacao_id
    AND auditoria.evento = 'notificacao.destino_resolucao_negada'
    AND auditoria.resultado = 'negado'
    AND auditoria.ator_tipo = 'usuario'
    AND auditoria.ator_usuario_id = ator.usuario_id
    AND auditoria.sessao_id = sessao_solicitante
    AND auditoria.request_id = requisicao_segura;
  IF negacoes_existentes.quantidade > 0 THEN
    IF negacoes_existentes.mesmo_alvo IS NOT TRUE THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'request_id ja foi usado para outra resolucao.',
        CONSTRAINT = 'uq_mp35b_notificacao_resolucao_request';
    END IF;
    RETURN;
  END IF;

  SELECT evento.recurso_id INTO destino
  FROM public.notificacao_entrega AS entrega
  JOIN public.notificacao_evento AS evento
    ON evento.organizacao_id = entrega.organizacao_id
   AND evento.id = entrega.evento_id
  WHERE entrega.organizacao_id = ator.organizacao_id
    AND entrega.destinatario_usuario_id = ator.usuario_id
    AND entrega.id = entrega_solicitada
    AND entrega.descartada_em IS NULL
    AND entrega.expira_em > agora
    AND evento.recurso_tipo = 'conta'
    AND evento.recurso_id = ator.usuario_id
  LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 'conta'::text, destino.recurso_id::uuid;
    RETURN;
  END IF;

  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados, ocorrido_em
  ) VALUES (
    ator.organizacao_id, 'notificacao.destino_resolucao_negada', 'negado',
    'usuario', ator.usuario_id, sessao_solicitante, ator.usuario_id,
    'notificacao_entrega', entrega_solicitada::text,
    requisicao_segura, '{}'::jsonb, agora
  );
  RETURN;
END;
$$;

CREATE FUNCTION public.tche_admin_iniciar_comando_mp35b(
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

CREATE FUNCTION public.tche_admin_concluir_comando_mp35b(
  entrada jsonb,
  comando_atual text,
  codigo_atual integer,
  recibo_atual jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  agora timestamptz := pg_catalog.clock_timestamp();
BEGIN
  INSERT INTO public.comandos_administrativos_idempotencia (
    organizacao_id, ator_usuario_id, sessao_id,
    request_id, correlation_id, chave_idempotencia_hash,
    comando, hash_requisicao, status, codigo_http, recibo,
    criado_em, concluido_em, expira_em
  ) VALUES (
    entrada ->> 'organizacao_id',
    (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid,
    entrada ->> 'request_id',
    entrada ->> 'correlation_id',
    pg_catalog.decode(entrada ->> 'chave_idempotencia_hash', 'hex'),
    comando_atual,
    pg_catalog.decode(entrada ->> 'hash_requisicao', 'hex'),
    'concluido', codigo_atual, recibo_atual,
    agora, agora, agora + interval '90 days'
  );
END;
$$;

CREATE FUNCTION public.tche_admin_substituir_convite_mp35b(
  convite jsonb,
  organizacao text,
  usuario uuid,
  ator uuid,
  nome_destinatario text,
  email_destinatario text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  novo_convite_id uuid;
  novo_desafio_id uuid;
  nova_mensagem_id uuid;
  desafio_ids uuid[];
  outbox jsonb;
  contexto jsonb;
  expira_em timestamptz;
  disponivel_em timestamptz;
BEGIN
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    convite,
    ARRAY[
      'id', 'challenge_id', 'token_hash', 'expires_at',
      'recipient_name', 'recipient_email', 'outbox'
    ],
    ARRAY[
      'id', 'challenge_id', 'token_hash', 'expires_at',
      'recipient_name', 'recipient_email', 'outbox'
    ]
  ) OR convite ->> 'recipient_name' IS DISTINCT FROM nome_destinatario
    OR convite ->> 'recipient_email' IS DISTINCT FROM email_destinatario
    OR (convite ->> 'token_hash') !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Convite administrativo invalido.';
  END IF;

  outbox := convite -> 'outbox';
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    outbox,
    ARRAY[
      'id', 'message_type', 'recipient_hmac', 'ciphertext', 'key_id',
      'nonce', 'authentication_tag', 'context', 'max_attempts',
      'available_at', 'expires_at'
    ],
    ARRAY[
      'id', 'message_type', 'recipient_hmac', 'ciphertext', 'key_id',
      'nonce', 'authentication_tag', 'context', 'max_attempts',
      'available_at', 'expires_at'
    ]
  ) OR (outbox ->> 'recipient_hmac') !~ '^[0-9a-f]{64}$'
    OR (outbox ->> 'ciphertext') !~ '^(?:[0-9a-f]{2})+$'
    OR (outbox ->> 'nonce') !~ '^[0-9a-f]{24}$'
    OR (outbox ->> 'authentication_tag') !~ '^[0-9a-f]{32}$'
    OR (outbox ->> 'key_id') !~ '^[A-Za-z0-9_.-]{1,64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Outbox administrativa invalida.';
  END IF;

  novo_convite_id := (convite ->> 'id')::uuid;
  novo_desafio_id := (convite ->> 'challenge_id')::uuid;
  nova_mensagem_id := (outbox ->> 'id')::uuid;
  expira_em := (convite ->> 'expires_at')::timestamptz;
  disponivel_em := (outbox ->> 'available_at')::timestamptz;
  contexto := outbox -> 'context';
  IF expira_em <= pg_catalog.clock_timestamp()
    OR (outbox ->> 'expires_at')::timestamptz <> expira_em
    OR pg_catalog.jsonb_typeof(contexto) <> 'object'
    OR contexto ->> 'organizationId' IS DISTINCT FROM organizacao
    OR contexto ->> 'messageId' IS DISTINCT FROM nova_mensagem_id::text
    OR contexto ->> 'messageType' IS DISTINCT FROM outbox ->> 'message_type'
    OR contexto ->> 'algorithm' IS DISTINCT FROM 'aes-256-gcm'
    OR contexto ->> 'version' IS DISTINCT FROM '1'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Contexto da outbox invalido.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(organizacao || ':' || usuario::text, 35000035)
  );

  WITH revogados AS (
    UPDATE public.convites_usuario AS convite_atual
    SET status = 'revogado', encerrado_em = pg_catalog.clock_timestamp(),
        motivo_encerramento = 'convite_substituido'
    WHERE convite_atual.organizacao_id = organizacao
      AND convite_atual.usuario_id = usuario
      AND convite_atual.status = 'pendente'
    RETURNING convite_atual.desafio_id
  )
  SELECT pg_catalog.array_agg(revogados.desafio_id)
  INTO desafio_ids
  FROM revogados;

  IF COALESCE(pg_catalog.array_length(desafio_ids, 1), 0) > 0 THEN
    UPDATE public.desafios_autenticacao AS desafio_atual
    SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
        motivo_encerramento = 'convite_substituido'
    WHERE desafio_atual.organizacao_id = organizacao
      AND desafio_atual.id = ANY (desafio_ids)
      AND desafio_atual.status = 'ativo';
    UPDATE public.outbox_email AS mensagem_atual
    SET status = 'cancelado', payload_cifrado = NULL,
        nonce = NULL, tag_autenticacao = NULL, bloqueado_em = NULL,
        bloqueado_por = NULL, lease_token = NULL, lease_expira_em = NULL,
        encerrado_em = pg_catalog.clock_timestamp(),
        erro_categoria = 'challenge_revoked'
    WHERE mensagem_atual.organizacao_id = organizacao
      AND mensagem_atual.desafio_id = ANY (desafio_ids)
      AND mensagem_atual.status IN ('pendente', 'processando');
  END IF;

  INSERT INTO public.desafios_autenticacao (
    id, organizacao_id, usuario_id, finalidade, token_hash, expira_em
  ) VALUES (
    novo_desafio_id, organizacao, usuario, 'convite',
    pg_catalog.decode(convite ->> 'token_hash', 'hex'), expira_em
  );
  INSERT INTO public.convites_usuario (
    id, organizacao_id, usuario_id, desafio_id, origem,
    modo_ativacao, criado_por_usuario_id, expira_em
  ) VALUES (
    novo_convite_id, organizacao, usuario, novo_desafio_id, 'admin',
    'ativar_usuario', ator, expira_em
  );
  INSERT INTO public.outbox_email (
    id, organizacao_id, usuario_id, desafio_id, tipo_mensagem,
    origem_tipo, origem_id, destinatario_hmac, payload_cifrado,
    chave_id, nonce, tag_autenticacao, contexto_autenticado,
    maximo_tentativas, disponivel_em, expira_em
  ) VALUES (
    nova_mensagem_id, organizacao, usuario, novo_desafio_id,
    outbox ->> 'message_type', 'convite', novo_convite_id,
    pg_catalog.decode(outbox ->> 'recipient_hmac', 'hex'),
    pg_catalog.decode(outbox ->> 'ciphertext', 'hex'), outbox ->> 'key_id',
    pg_catalog.decode(outbox ->> 'nonce', 'hex'),
    pg_catalog.decode(outbox ->> 'authentication_tag', 'hex'), contexto,
    (outbox ->> 'max_attempts')::smallint, disponivel_em, expira_em
  );
  RETURN novo_convite_id;
END;
$$;

CREATE FUNCTION public.tche_admin_criar_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inicio jsonb;
  usuario uuid;
  produtor uuid;
  perfil_novo text;
  nome_novo text;
  email_entrada text;
  convite_novo uuid;
  recibo_novo jsonb;
BEGIN
  inicio := public.tche_admin_iniciar_comando_mp35b(entrada, 'usuario.criar');
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
      'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
      'produtor_id', 'nome', 'email', 'perfil', 'telefone',
      'documento', 'observacoes', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
      'nome', 'email', 'perfil', 'invitation'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Criacao de Usuario invalida.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(entrada ->> 'organizacao_id', 35000037)
  );
  usuario := (entrada ->> 'usuario_id')::uuid;
  perfil_novo := entrada ->> 'perfil';
  nome_novo := entrada ->> 'nome';
  email_entrada := entrada ->> 'email';
  IF perfil_novo NOT IN ('admin', 'colaborador', 'produtor')
    OR pg_catalog.char_length(pg_catalog.btrim(nome_novo)) NOT BETWEEN 1 AND 200
    OR nome_novo <> pg_catalog.btrim(nome_novo)
    OR pg_catalog.char_length(email_entrada) NOT BETWEEN 3 AND 254
    OR NOT (email_entrada IS NFC NORMALIZED)
    OR email_entrada <> pg_catalog.lower(pg_catalog.btrim(email_entrada))
    OR pg_catalog.strpos(email_entrada, '@') <= 1
    OR (entrada ? 'telefone' AND (
      pg_catalog.jsonb_typeof(entrada -> 'telefone') <> 'string'
      OR pg_catalog.char_length(pg_catalog.btrim(entrada ->> 'telefone')) NOT BETWEEN 1 AND 32
    ))
    OR (entrada ? 'documento' AND (
      pg_catalog.jsonb_typeof(entrada -> 'documento') <> 'string'
      OR pg_catalog.char_length(pg_catalog.btrim(entrada ->> 'documento')) NOT BETWEEN 1 AND 64
    ))
    OR (entrada ? 'observacoes' AND (
      pg_catalog.jsonb_typeof(entrada -> 'observacoes') <> 'string'
      OR pg_catalog.char_length(pg_catalog.btrim(entrada ->> 'observacoes')) NOT BETWEEN 1 AND 2000
    ))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Dados de Usuario invalidos.';
  END IF;
  IF perfil_novo = 'produtor' THEN
    IF NOT (entrada ? 'produtor_id') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Produtor exige identificador.';
    END IF;
    produtor := (entrada ->> 'produtor_id')::uuid;
  ELSIF entrada ? 'produtor_id' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Perfil sem Produtor associado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.organizacao_id = entrada ->> 'organizacao_id'
      AND pg_catalog.lower(u.email) = pg_catalog.lower(email_entrada)
    UNION ALL
    SELECT 1 FROM public.contatos_email_usuario c
    WHERE c.organizacao_id = entrada ->> 'organizacao_id'
      AND pg_catalog.lower(c.email) = pg_catalog.lower(email_entrada)
      AND c.status IN ('pendente', 'verificado')
    UNION ALL
    SELECT 1 FROM public.solicitacoes_alteracao_email s
    WHERE s.organizacao_id = entrada ->> 'organizacao_id'
      AND pg_catalog.lower(s.email_novo) = pg_catalog.lower(email_entrada)
      AND s.status IN ('aguardando_confirmacao_atual', 'aguardando_confirmacao_novo')
    UNION ALL
    SELECT 1 FROM public.recuperacoes_assistidas r
    WHERE r.organizacao_id = entrada ->> 'organizacao_id'
      AND pg_catalog.lower(r.novo_email) = pg_catalog.lower(email_entrada)
      AND r.status IN ('solicitada', 'em_validacao', 'aguardando_confirmacao_email', 'aguardando_nova_senha')
    UNION ALL
    SELECT 1 FROM public.recuperacoes_admin_email_secundario r
    WHERE r.organizacao_id = entrada ->> 'organizacao_id'
      AND pg_catalog.lower(r.novo_email) = pg_catalog.lower(email_entrada)
      AND r.status IN ('aguardando_confirmacao_secundario', 'aguardando_confirmacao_email_novo', 'aguardando_nova_senha')
  ) THEN
    RETURN QUERY SELECT 'duplicate_email'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  INSERT INTO public.usuarios (
    id, organizacao_id, nome, email, perfil, telefone, documento, observacoes
  ) VALUES (
    usuario, entrada ->> 'organizacao_id', nome_novo, email_entrada, perfil_novo,
    CASE WHEN entrada ? 'telefone' THEN entrada ->> 'telefone' END,
    CASE WHEN entrada ? 'documento' THEN entrada ->> 'documento' END,
    CASE WHEN entrada ? 'observacoes' THEN entrada ->> 'observacoes' END
  );
  IF perfil_novo = 'produtor' THEN
    INSERT INTO public.produtores (id, organizacao_id, usuario_id, nome)
    VALUES (produtor, entrada ->> 'organizacao_id', usuario, nome_novo);
  END IF;

  convite_novo := public.tche_admin_substituir_convite_mp35b(
    entrada -> 'invitation', entrada ->> 'organizacao_id', usuario,
    (entrada ->> 'ator_usuario_id')::uuid, nome_novo, email_entrada
  );
  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados
  ) VALUES
  (
    entrada ->> 'organizacao_id', 'administracao.usuario.criado', 'sucesso',
    'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'usuario', usuario::text,
    entrada ->> 'request_id', pg_catalog.jsonb_build_object('perfil', perfil_novo)
  ),
  (
    entrada ->> 'organizacao_id', 'administracao.usuario.convite_emitido', 'sucesso',
    'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'convite', convite_novo::text,
    entrada ->> 'request_id', pg_catalog.jsonb_build_object('activation_mode', 'ativar_usuario')
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'criado', 'resourceType', 'usuario',
    'resourceId', usuario::text, 'version', 1
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    entrada, 'usuario.criar', 201, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 201, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_atualizar_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inicio jsonb;
  alvo record;
  patch jsonb;
  usuario uuid;
  nome_final text;
  email_final text;
  telefone_final text;
  documento_final text;
  observacoes_finais text;
  mudou_nome boolean;
  mudou_email boolean;
  mudou_telefone boolean;
  mudou_documento boolean;
  mudou_observacoes boolean;
  versao_nova bigint;
  convite_novo uuid;
  recibo_novo jsonb;
BEGIN
  inicio := public.tche_admin_iniciar_comando_mp35b(entrada, 'usuario.atualizar');
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
      'usuario_id', 'versao', 'patch', 'invitation'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao',
      'usuario_id', 'versao', 'patch'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Atualizacao de Usuario invalida.';
  END IF;
  patch := entrada -> 'patch';
  IF NOT public.tche_jsonb_chaves_exatas_mp35b(
    patch,
    ARRAY['nome', 'email', 'telefone', 'documento', 'observacoes'],
    ARRAY[]::text[]
  ) OR patch = '{}'::jsonb THEN
    RETURN QUERY SELECT 'no_change'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  usuario := (entrada ->> 'usuario_id')::uuid;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      (entrada ->> 'organizacao_id') || ':' || usuario::text,
      35000035
    )
  );
  SELECT u.nome, u.email, u.telefone, u.documento, u.observacoes,
         u.status, u.versao, p.id AS produtor_id
  INTO alvo
  FROM public.usuarios AS u
  LEFT JOIN public.produtores AS p
    ON p.organizacao_id = u.organizacao_id AND p.usuario_id = u.id
  WHERE u.organizacao_id = entrada ->> 'organizacao_id' AND u.id = usuario
  FOR UPDATE OF u;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.versao <> (entrada ->> 'versao')::bigint THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  nome_final := CASE WHEN patch ? 'nome' THEN patch ->> 'nome' ELSE alvo.nome END;
  email_final := CASE WHEN patch ? 'email' THEN patch ->> 'email' ELSE alvo.email END;
  telefone_final := CASE WHEN patch ? 'telefone' THEN patch ->> 'telefone' ELSE alvo.telefone END;
  documento_final := CASE WHEN patch ? 'documento' THEN patch ->> 'documento' ELSE alvo.documento END;
  observacoes_finais := CASE WHEN patch ? 'observacoes' THEN patch ->> 'observacoes' ELSE alvo.observacoes END;
  IF (patch ? 'nome' AND (
      pg_catalog.jsonb_typeof(patch -> 'nome') <> 'string'
      OR nome_final <> pg_catalog.btrim(nome_final)
      OR pg_catalog.char_length(nome_final) NOT BETWEEN 1 AND 200
    ))
    OR (patch ? 'email' AND (
      pg_catalog.jsonb_typeof(patch -> 'email') <> 'string'
      OR email_final <> pg_catalog.lower(pg_catalog.btrim(email_final))
      OR NOT (email_final IS NFC NORMALIZED)
      OR pg_catalog.char_length(email_final) NOT BETWEEN 3 AND 254
    ))
    OR (patch ? 'telefone' AND patch -> 'telefone' <> 'null'::jsonb
      AND (pg_catalog.jsonb_typeof(patch -> 'telefone') <> 'string'
        OR pg_catalog.char_length(pg_catalog.btrim(telefone_final)) NOT BETWEEN 1 AND 32))
    OR (patch ? 'documento' AND patch -> 'documento' <> 'null'::jsonb
      AND (pg_catalog.jsonb_typeof(patch -> 'documento') <> 'string'
        OR pg_catalog.char_length(pg_catalog.btrim(documento_final)) NOT BETWEEN 1 AND 64))
    OR (patch ? 'observacoes' AND patch -> 'observacoes' <> 'null'::jsonb
      AND (pg_catalog.jsonb_typeof(patch -> 'observacoes') <> 'string'
        OR pg_catalog.char_length(pg_catalog.btrim(observacoes_finais)) NOT BETWEEN 1 AND 2000))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Patch de Usuario invalido.';
  END IF;

  mudou_nome := nome_final IS DISTINCT FROM alvo.nome;
  mudou_email := email_final IS DISTINCT FROM alvo.email;
  mudou_telefone := telefone_final IS DISTINCT FROM alvo.telefone;
  mudou_documento := documento_final IS DISTINCT FROM alvo.documento;
  mudou_observacoes := observacoes_finais IS DISTINCT FROM alvo.observacoes;
  IF NOT (mudou_nome OR mudou_email OR mudou_telefone OR mudou_documento OR mudou_observacoes) THEN
    RETURN QUERY SELECT 'no_change'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF mudou_email AND alvo.status <> 'pendente' THEN
    RETURN QUERY SELECT 'email_change_forbidden'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF mudou_email AND EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.organizacao_id = entrada ->> 'organizacao_id'
      AND u.id <> usuario AND pg_catalog.lower(u.email) = pg_catalog.lower(email_final)
  ) THEN
    RETURN QUERY SELECT 'duplicate_email'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF mudou_email AND NOT (entrada ? 'invitation') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Troca de email exige novo convite.';
  END IF;

  UPDATE public.usuarios
  SET nome = nome_final, email = email_final, telefone = telefone_final,
      documento = documento_final, observacoes = observacoes_finais
  WHERE organizacao_id = entrada ->> 'organizacao_id'
    AND id = usuario AND versao = (entrada ->> 'versao')::bigint
  RETURNING versao INTO versao_nova;

  IF mudou_nome AND alvo.produtor_id IS NOT NULL THEN
    UPDATE public.produtores
    SET nome = nome_final
    WHERE organizacao_id = entrada ->> 'organizacao_id'
      AND id = alvo.produtor_id AND nome IS DISTINCT FROM nome_final;
  END IF;
  IF mudou_email THEN
    convite_novo := public.tche_admin_substituir_convite_mp35b(
      entrada -> 'invitation', entrada ->> 'organizacao_id', usuario,
      (entrada ->> 'ator_usuario_id')::uuid, nome_final, email_final
    );
    INSERT INTO public.eventos_auditoria (
      organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
      sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
      request_id, metadados
    ) VALUES (
      entrada ->> 'organizacao_id', 'administracao.usuario.convite_emitido',
      'sucesso', 'usuario', (entrada ->> 'ator_usuario_id')::uuid,
      (entrada ->> 'sessao_id')::uuid, usuario, 'convite', convite_novo::text,
      entrada ->> 'request_id',
      pg_catalog.jsonb_build_object('activation_mode', 'ativar_usuario', 'email_substituido', true)
    );
  END IF;
  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    request_id, metadados
  ) VALUES (
    entrada ->> 'organizacao_id', 'administracao.usuario.atualizado', 'sucesso',
    'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'usuario', usuario::text,
    entrada ->> 'request_id', pg_catalog.jsonb_build_object(
      'campos', pg_catalog.to_jsonb(pg_catalog.array_remove(ARRAY[
        CASE WHEN mudou_nome THEN 'nome' END,
        CASE WHEN mudou_email THEN 'email' END,
        CASE WHEN mudou_telefone THEN 'telefone' END,
        CASE WHEN mudou_documento THEN 'documento' END,
        CASE WHEN mudou_observacoes THEN 'observacoes' END
      ], NULL))
    )
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'atualizado', 'resourceType', 'usuario',
    'resourceId', usuario::text, 'version', versao_nova
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    entrada, 'usuario.atualizar', 200, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 200, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_alterar_status_usuario_mp35b(entrada jsonb)
RETURNS TABLE (status text, codigo_http integer, recibo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inicio jsonb;
  alvo record;
  usuario uuid;
  status_novo text;
  motivo_novo text;
  detalhe_novo text;
  versao_nova bigint;
  recibo_novo jsonb;
BEGIN
  inicio := public.tche_admin_iniciar_comando_mp35b(entrada, 'usuario.alterar_status');
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
      'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
      'versao', 'status', 'motivo', 'motivo_detalhe'
    ],
    ARRAY[
      'organizacao_id', 'ator_usuario_id', 'sessao_id',
      'ator_versao_autorizacao', 'request_id', 'correlation_id',
      'chave_idempotencia_hash', 'hash_requisicao', 'usuario_id',
      'versao', 'status', 'motivo'
    ]
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Alteracao de status invalida.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(entrada ->> 'organizacao_id', 35000037)
  );
  usuario := (entrada ->> 'usuario_id')::uuid;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      (entrada ->> 'organizacao_id') || ':' || usuario::text,
      35000035
    )
  );
  status_novo := entrada ->> 'status';
  motivo_novo := entrada ->> 'motivo';
  detalhe_novo := CASE WHEN entrada ? 'motivo_detalhe' THEN entrada ->> 'motivo_detalhe' END;
  IF status_novo NOT IN ('ativo', 'inativo')
    OR motivo_novo NOT IN (
      'fim_relacao', 'mudanca_responsabilidade', 'cadastro_duplicado',
      'correcao_administrativa', 'suspensao_operacional', 'outro'
    )
    OR (motivo_novo = 'outro' AND detalhe_novo IS NULL)
    OR (detalhe_novo IS NOT NULL AND (
      detalhe_novo <> pg_catalog.btrim(detalhe_novo)
      OR pg_catalog.char_length(detalhe_novo) NOT BETWEEN 1 AND 300
      OR pg_catalog.lower(detalhe_novo) ~ '(senha|token|documento|cpf|cnpj)'
    ))
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Motivo administrativo invalido.';
  END IF;

  SELECT u.perfil, u.status, u.versao, p.id AS produtor_id
  INTO alvo
  FROM public.usuarios AS u
  LEFT JOIN public.produtores AS p
    ON p.organizacao_id = u.organizacao_id AND p.usuario_id = u.id
  WHERE u.organizacao_id = entrada ->> 'organizacao_id' AND u.id = usuario
  FOR UPDATE OF u;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.versao <> (entrada ->> 'versao')::bigint THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.status = 'pendente' THEN
    RETURN QUERY SELECT 'pending_status_transition'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF alvo.status = status_novo THEN
    RETURN QUERY SELECT 'invalid_transition'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF status_novo = 'inativo' AND usuario = (entrada ->> 'ator_usuario_id')::uuid THEN
    RETURN QUERY SELECT 'self_deactivation'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF status_novo = 'ativo' AND NOT EXISTS (
    SELECT 1 FROM public.credenciais_usuario c
    WHERE c.organizacao_id = entrada ->> 'organizacao_id'
      AND c.usuario_id = usuario AND c.status = 'ativa'
  ) THEN
    RETURN QUERY SELECT 'credential_required'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF status_novo = 'inativo' AND alvo.produtor_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.propriedades p
    WHERE p.organizacao_id = entrada ->> 'organizacao_id'
      AND p.titular_id = alvo.produtor_id AND p.status = 'ativa'
  ) THEN
    RETURN QUERY SELECT 'active_holder_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;
  IF status_novo = 'inativo' AND alvo.perfil = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.organizacao_id = entrada ->> 'organizacao_id'
      AND u.perfil = 'admin' AND u.status = 'ativo' AND u.id <> usuario
  ) THEN
    RETURN QUERY SELECT 'last_admin_conflict'::text, NULL::integer, NULL::jsonb;
    RETURN;
  END IF;

  IF alvo.produtor_id IS NOT NULL THEN
    UPDATE public.produtores AS produtor_atual SET status = status_novo
    WHERE produtor_atual.organizacao_id = entrada ->> 'organizacao_id'
      AND produtor_atual.id = alvo.produtor_id
      AND produtor_atual.status IS DISTINCT FROM status_novo;
  END IF;
  UPDATE public.usuarios
  SET status = status_novo, versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = entrada ->> 'organizacao_id'
    AND id = usuario AND versao = (entrada ->> 'versao')::bigint
  RETURNING versao INTO versao_nova;

  UPDATE public.tokens_acesso AS token
  SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
      motivo_revogacao = 'alteracao_autorizacao'
  FROM public.sessoes_autenticacao AS sessao_atual
  WHERE token.organizacao_id = entrada ->> 'organizacao_id'
    AND token.organizacao_id = sessao_atual.organizacao_id
    AND token.sessao_id = sessao_atual.id
    AND sessao_atual.usuario_id = usuario AND token.status = 'ativo';
  UPDATE public.tokens_refresh AS token
  SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
      motivo_revogacao = 'alteracao_autorizacao'
  FROM public.sessoes_autenticacao AS sessao_atual
  WHERE token.organizacao_id = entrada ->> 'organizacao_id'
    AND token.organizacao_id = sessao_atual.organizacao_id
    AND token.sessao_id = sessao_atual.id
    AND sessao_atual.usuario_id = usuario AND token.status = 'ativo';
  UPDATE public.sessoes_autenticacao AS sessao_atual
  SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
      motivo_revogacao = 'alteracao_autorizacao'
  WHERE sessao_atual.organizacao_id = entrada ->> 'organizacao_id'
    AND sessao_atual.usuario_id = usuario
    AND sessao_atual.status = 'ativa';

  INSERT INTO public.eventos_auditoria (
    organizacao_id, evento, resultado, ator_tipo, ator_usuario_id,
    sessao_id, usuario_afetado_id, recurso_tipo, recurso_id,
    motivo_categoria, request_id, metadados
  ) VALUES (
    entrada ->> 'organizacao_id', 'administracao.usuario.status_alterado',
    'sucesso', 'usuario', (entrada ->> 'ator_usuario_id')::uuid,
    (entrada ->> 'sessao_id')::uuid, usuario, 'usuario', usuario::text,
    motivo_novo, entrada ->> 'request_id',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'status_anterior', alvo.status,
      'status_novo', status_novo,
      'motivo_detalhe', detalhe_novo
    ))
  );
  recibo_novo := pg_catalog.jsonb_build_object(
    'outcome', 'status_alterado', 'resourceType', 'usuario',
    'resourceId', usuario::text, 'version', versao_nova
  );
  PERFORM public.tche_admin_concluir_comando_mp35b(
    entrada, 'usuario.alterar_status', 200, recibo_novo
  );
  RETURN QUERY SELECT 'completed'::text, 200, recibo_novo;
END;
$$;

CREATE FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(entrada jsonb)
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

-- Interfaces estreitas para os fluxos de conta existentes. Elas substituem
-- somente o UPDATE herdado em usuarios e usam a transação do chamador.
CREATE FUNCTION public.tche_conta_ativar_usuario_por_convite_mp35b(convite uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE alvo record; versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  SELECT c.organizacao_id, c.usuario_id, c.modo_ativacao,
         c.status AS convite_status, c.expira_em AS convite_expira_em,
         d.finalidade, d.status AS desafio_status, d.expira_em AS desafio_expira_em,
         u.perfil, u.status AS usuario_status
  INTO alvo
  FROM public.convites_usuario c
  JOIN public.desafios_autenticacao d
    ON d.organizacao_id = c.organizacao_id AND d.id = c.desafio_id
  JOIN public.usuarios u
    ON u.organizacao_id = c.organizacao_id AND u.id = c.usuario_id
  WHERE c.id = convite
  FOR UPDATE OF c, d, u;
  IF NOT FOUND OR alvo.convite_status <> 'pendente'
    OR alvo.convite_expira_em <= pg_catalog.clock_timestamp()
    OR alvo.finalidade <> 'convite' OR alvo.desafio_status <> 'ativo'
    OR alvo.desafio_expira_em <= pg_catalog.clock_timestamp()
    OR alvo.usuario_status <> 'pendente'
    OR alvo.modo_ativacao NOT IN ('ativar_usuario', 'ativar_admin_bootstrap')
    OR (alvo.modo_ativacao = 'ativar_admin_bootstrap' AND alvo.perfil <> 'admin')
    OR NOT EXISTS (
      SELECT 1 FROM public.credenciais_usuario credencial
      WHERE credencial.organizacao_id = alvo.organizacao_id
        AND credencial.usuario_id = alvo.usuario_id AND credencial.status = 'ativa'
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Convite nao permite ativacao.';
  END IF;
  UPDATE public.usuarios
  SET status = 'ativo', versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = alvo.organizacao_id AND id = alvo.usuario_id
    AND status = 'pendente'
  RETURNING versao_autorizacao INTO versao_nova;
  RETURN versao_nova;
END;
$$;

CREATE FUNCTION public.tche_conta_avancar_autorizacao_sessao_mp35b(
  organizacao text,
  usuario uuid,
  sessao uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  UPDATE public.usuarios AS u
  SET versao_autorizacao = u.versao_autorizacao + 1
  WHERE u.organizacao_id = organizacao AND u.id = usuario AND u.status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.sessoes_autenticacao s
      WHERE s.organizacao_id = u.organizacao_id AND s.usuario_id = u.id
        AND s.id = sessao AND s.status = 'ativa'
        AND s.versao_autorizacao = u.versao_autorizacao
        AND s.expira_inatividade_em > pg_catalog.clock_timestamp()
        AND s.expira_absolutamente_em > pg_catalog.clock_timestamp()
    )
  RETURNING u.versao_autorizacao INTO versao_nova;
  IF versao_nova IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Sessao nao permite avancar autorizacao.';
  END IF;
  RETURN versao_nova;
END;
$$;

CREATE FUNCTION public.tche_conta_concluir_recuperacao_senha_mp35b(desafio uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE alvo record; versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  SELECT d.organizacao_id, d.usuario_id INTO alvo
  FROM public.desafios_autenticacao d
  JOIN public.usuarios u
    ON u.organizacao_id = d.organizacao_id AND u.id = d.usuario_id
  WHERE d.id = desafio AND d.finalidade = 'recuperacao_senha'
    AND d.status = 'consumido' AND u.status = 'ativo'
  FOR UPDATE OF d, u;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Recuperacao nao concluida.';
  END IF;
  INSERT INTO public.mutacoes_conta_controladas_mp35b (
    organizacao_id, usuario_id, finalidade, prova_id
  ) VALUES (alvo.organizacao_id, alvo.usuario_id, 'recuperacao_senha', desafio);
  UPDATE public.usuarios SET versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = alvo.organizacao_id AND id = alvo.usuario_id
  RETURNING versao_autorizacao INTO versao_nova;
  RETURN versao_nova;
END;
$$;

CREATE FUNCTION public.tche_conta_concluir_alteracao_email_mp35b(solicitacao uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE alvo record; versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  SELECT s.organizacao_id, s.usuario_id, s.email_novo INTO alvo
  FROM public.solicitacoes_alteracao_email s
  JOIN public.usuarios u
    ON u.organizacao_id = s.organizacao_id AND u.id = s.usuario_id
  WHERE s.id = solicitacao AND s.status = 'concluida' AND u.status = 'ativo'
  FOR UPDATE OF s, u;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Alteracao de email nao concluida.'; END IF;
  INSERT INTO public.mutacoes_conta_controladas_mp35b (
    organizacao_id, usuario_id, finalidade, prova_id
  ) VALUES (alvo.organizacao_id, alvo.usuario_id, 'alteracao_email_principal', solicitacao);
  UPDATE public.usuarios SET email = alvo.email_novo,
      versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = alvo.organizacao_id AND id = alvo.usuario_id
  RETURNING versao_autorizacao INTO versao_nova;
  RETURN versao_nova;
END;
$$;

CREATE FUNCTION public.tche_conta_concluir_recuperacao_assistida_mp35b(recuperacao uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE alvo record; versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  SELECT r.organizacao_id, r.usuario_id, r.novo_email INTO alvo
  FROM public.recuperacoes_assistidas r
  JOIN public.usuarios u
    ON u.organizacao_id = r.organizacao_id AND u.id = r.usuario_id
  WHERE r.id = recuperacao AND r.status = 'concluida' AND u.status = 'ativo'
  FOR UPDATE OF r, u;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Recuperacao assistida nao concluida.'; END IF;
  INSERT INTO public.mutacoes_conta_controladas_mp35b (
    organizacao_id, usuario_id, finalidade, prova_id
  ) VALUES (alvo.organizacao_id, alvo.usuario_id, 'recuperacao_assistida', recuperacao);
  UPDATE public.usuarios SET email = alvo.novo_email,
      versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = alvo.organizacao_id AND id = alvo.usuario_id
  RETURNING versao_autorizacao INTO versao_nova;
  RETURN versao_nova;
END;
$$;

CREATE FUNCTION public.tche_conta_concluir_recuperacao_admin_mp35b(recuperacao uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE alvo record; versao_nova bigint;
BEGIN
  PERFORM public.tche_exigir_runtime_exclusivo_mp35b();
  SELECT r.organizacao_id, r.usuario_admin_id AS usuario_id, r.novo_email INTO alvo
  FROM public.recuperacoes_admin_email_secundario r
  JOIN public.usuarios u
    ON u.organizacao_id = r.organizacao_id AND u.id = r.usuario_admin_id
  WHERE r.id = recuperacao AND r.status = 'concluida'
    AND u.status = 'ativo' AND u.perfil = 'admin'
  FOR UPDATE OF r, u;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Recuperacao Admin nao concluida.'; END IF;
  INSERT INTO public.mutacoes_conta_controladas_mp35b (
    organizacao_id, usuario_id, finalidade, prova_id
  ) VALUES (alvo.organizacao_id, alvo.usuario_id, 'recuperacao_admin_secundario', recuperacao);
  UPDATE public.usuarios SET email = alvo.novo_email,
      versao_autorizacao = versao_autorizacao + 1
  WHERE organizacao_id = alvo.organizacao_id AND id = alvo.usuario_id
  RETURNING versao_autorizacao INTO versao_nova;
  RETURN versao_nova;
END;
$$;

GRANT USAGE ON SCHEMA public TO tche_agro_administration_owner;
GRANT SELECT ON TABLE
  public.organizacoes, public.usuarios, public.produtores,
  public.propriedades, public.credenciais_usuario,
  public.contatos_email_usuario, public.solicitacoes_alteracao_email,
  public.recuperacoes_assistidas, public.recuperacoes_admin_email_secundario,
  public.sessoes_autenticacao, public.tokens_acesso, public.tokens_refresh,
  public.desafios_autenticacao, public.convites_usuario,
  public.notificacao_evento, public.notificacao_entrega,
  public.notificacao_comando_idempotencia,
  public.eventos_auditoria, public.outbox_email,
  public.comandos_administrativos_idempotencia,
  public.mutacoes_conta_controladas_mp35b
TO tche_agro_administration_owner;
GRANT INSERT, UPDATE ON TABLE
  public.usuarios, public.produtores, public.sessoes_autenticacao,
  public.tokens_acesso, public.tokens_refresh, public.desafios_autenticacao,
  public.convites_usuario, public.outbox_email,
  public.comandos_administrativos_idempotencia,
  public.mutacoes_conta_controladas_mp35b
TO tche_agro_administration_owner;
GRANT UPDATE ON TABLE
  public.solicitacoes_alteracao_email,
  public.recuperacoes_assistidas,
  public.recuperacoes_admin_email_secundario,
  public.notificacao_comando_idempotencia
TO tche_agro_administration_owner;
GRANT UPDATE ON TABLE public.organizacoes
  TO tche_agro_administration_owner;
GRANT INSERT ON TABLE public.eventos_auditoria
  TO tche_agro_administration_owner;
GRANT INSERT ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega
TO tche_agro_administration_owner;

ALTER FUNCTION public.tche_jsonb_chaves_exatas_mp35b(jsonb, text[], text[])
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_exigir_runtime_exclusivo_mp35b()
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_auditoria_inserir_interno_mp35b(text, jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_notificacao_bloquear_ator_mp35b(
  text, uuid, text, bigint
) OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_notificacao_obter_comando_mp35b(text, uuid, bytea)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_notificacao_entregar_conta_mp35b(uuid, uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_notificacao_resolver_destino_mp35b(uuid, uuid, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_iniciar_comando_mp35b(jsonb, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_concluir_comando_mp35b(jsonb, text, integer, jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_substituir_convite_mp35b(jsonb, text, uuid, uuid, text, text)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_criar_usuario_mp35b(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_atualizar_usuario_mp35b(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_alterar_status_usuario_mp35b(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_admin_emitir_convite_usuario_mp35b(jsonb)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_ativar_usuario_por_convite_mp35b(uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_avancar_autorizacao_sessao_mp35b(text, uuid, uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_concluir_recuperacao_senha_mp35b(uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_concluir_alteracao_email_mp35b(uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_concluir_recuperacao_assistida_mp35b(uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_conta_concluir_recuperacao_admin_mp35b(uuid)
  OWNER TO tche_agro_administration_owner;
ALTER FUNCTION public.tche_serializar_propriedade_titular_mp35b()
  OWNER TO tche_agro_administration_owner;

DO $proteger_interfaces_auditoria$
DECLARE
  interface record;
BEGIN
  FOR interface IN
    SELECT procedimento.proname AS nome
    FROM pg_catalog.pg_proc AS procedimento
    JOIN pg_catalog.pg_namespace AS esquema
      ON esquema.oid = procedimento.pronamespace
    WHERE esquema.nspname = 'public'
      AND procedimento.proname LIKE 'tche_aud_%_mp35b'
      AND pg_catalog.pg_get_function_identity_arguments(procedimento.oid)
        = 'entrada jsonb'
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER FUNCTION public.%I(jsonb) OWNER TO tche_agro_administration_owner',
      interface.nome
    );
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION public.%I(jsonb) FROM PUBLIC',
      interface.nome
    );
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION public.%I(jsonb) TO tche_agro_runtime',
      interface.nome
    );
  END LOOP;
END;
$proteger_interfaces_auditoria$;

-- Criação/deduplicação e resolução negada agora são efeitos exclusivos das
-- operações reais abaixo, nunca wrappers isoladas callable pelo runtime.
REVOKE EXECUTE ON FUNCTION
  public.tche_aud_notificacao_criada_mp35b(jsonb),
  public.tche_aud_notificacao_deduplicada_mp35b(jsonb),
  public.tche_aud_notificacao_destino_negado_mp35b(jsonb)
FROM tche_agro_runtime, PUBLIC;

REVOKE ALL ON FUNCTION
  public.tche_jsonb_chaves_exatas_mp35b(jsonb, text[], text[]),
  public.tche_exigir_runtime_exclusivo_mp35b(),
  public.tche_auditoria_inserir_interno_mp35b(text, jsonb),
  public.tche_notificacao_bloquear_ator_mp35b(text, uuid, text, bigint),
  public.tche_notificacao_obter_comando_mp35b(text, uuid, bytea),
  public.tche_notificacao_entregar_conta_mp35b(uuid, uuid),
  public.tche_notificacao_resolver_destino_mp35b(uuid, uuid, text),
  public.tche_admin_iniciar_comando_mp35b(jsonb, text),
  public.tche_admin_concluir_comando_mp35b(jsonb, text, integer, jsonb),
  public.tche_admin_substituir_convite_mp35b(jsonb, text, uuid, uuid, text, text),
  public.tche_admin_criar_usuario_mp35b(jsonb),
  public.tche_admin_atualizar_usuario_mp35b(jsonb),
  public.tche_admin_alterar_status_usuario_mp35b(jsonb),
  public.tche_admin_emitir_convite_usuario_mp35b(jsonb),
  public.tche_conta_ativar_usuario_por_convite_mp35b(uuid),
  public.tche_conta_avancar_autorizacao_sessao_mp35b(text, uuid, uuid),
  public.tche_conta_concluir_recuperacao_senha_mp35b(uuid),
  public.tche_conta_concluir_alteracao_email_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_assistida_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_admin_mp35b(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.tche_admin_criar_usuario_mp35b(jsonb),
  public.tche_admin_atualizar_usuario_mp35b(jsonb),
  public.tche_admin_alterar_status_usuario_mp35b(jsonb),
  public.tche_admin_emitir_convite_usuario_mp35b(jsonb),
  public.tche_conta_ativar_usuario_por_convite_mp35b(uuid),
  public.tche_conta_avancar_autorizacao_sessao_mp35b(text, uuid, uuid),
  public.tche_conta_concluir_recuperacao_senha_mp35b(uuid),
  public.tche_conta_concluir_alteracao_email_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_assistida_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_admin_mp35b(uuid)
TO tche_agro_runtime;

GRANT EXECUTE ON FUNCTION
  public.tche_notificacao_bloquear_ator_mp35b(text, uuid, text, bigint),
  public.tche_notificacao_obter_comando_mp35b(text, uuid, bytea),
  public.tche_notificacao_entregar_conta_mp35b(uuid, uuid),
  public.tche_notificacao_resolver_destino_mp35b(uuid, uuid, text)
TO tche_agro_runtime;

-- Down Migration

DO $remover_interfaces_auditoria$
DECLARE
  interface record;
BEGIN
  FOR interface IN
    SELECT procedimento.proname AS nome
    FROM pg_catalog.pg_proc AS procedimento
    JOIN pg_catalog.pg_namespace AS esquema
      ON esquema.oid = procedimento.pronamespace
    WHERE esquema.nspname = 'public'
      AND procedimento.proname LIKE 'tche_aud_%_mp35b'
      AND pg_catalog.pg_get_function_identity_arguments(procedimento.oid)
        = 'entrada jsonb'
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE EXECUTE ON FUNCTION public.%I(jsonb) FROM tche_agro_runtime',
      interface.nome
    );
    EXECUTE pg_catalog.format(
      'DROP FUNCTION public.%I(jsonb)',
      interface.nome
    );
  END LOOP;
END;
$remover_interfaces_auditoria$;

REVOKE EXECUTE ON FUNCTION
  public.tche_notificacao_bloquear_ator_mp35b(text, uuid, text, bigint),
  public.tche_notificacao_obter_comando_mp35b(text, uuid, bytea),
  public.tche_notificacao_entregar_conta_mp35b(uuid, uuid),
  public.tche_notificacao_resolver_destino_mp35b(uuid, uuid, text)
FROM tche_agro_runtime;

REVOKE EXECUTE ON FUNCTION
  public.tche_admin_criar_usuario_mp35b(jsonb),
  public.tche_admin_atualizar_usuario_mp35b(jsonb),
  public.tche_admin_alterar_status_usuario_mp35b(jsonb),
  public.tche_admin_emitir_convite_usuario_mp35b(jsonb),
  public.tche_conta_ativar_usuario_por_convite_mp35b(uuid),
  public.tche_conta_avancar_autorizacao_sessao_mp35b(text, uuid, uuid),
  public.tche_conta_concluir_recuperacao_senha_mp35b(uuid),
  public.tche_conta_concluir_alteracao_email_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_assistida_mp35b(uuid),
  public.tche_conta_concluir_recuperacao_admin_mp35b(uuid)
FROM tche_agro_runtime;

DROP FUNCTION IF EXISTS public.tche_conta_concluir_recuperacao_admin_mp35b(uuid);
DROP FUNCTION IF EXISTS public.tche_conta_concluir_recuperacao_assistida_mp35b(uuid);
DROP FUNCTION IF EXISTS public.tche_conta_concluir_alteracao_email_mp35b(uuid);
DROP FUNCTION IF EXISTS public.tche_conta_concluir_recuperacao_senha_mp35b(uuid);
DROP FUNCTION IF EXISTS public.tche_conta_avancar_autorizacao_sessao_mp35b(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.tche_conta_ativar_usuario_por_convite_mp35b(uuid);
DROP FUNCTION IF EXISTS public.tche_admin_emitir_convite_usuario_mp35b(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_alterar_status_usuario_mp35b(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_atualizar_usuario_mp35b(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_criar_usuario_mp35b(jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_substituir_convite_mp35b(jsonb, text, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.tche_admin_concluir_comando_mp35b(jsonb, text, integer, jsonb);
DROP FUNCTION IF EXISTS public.tche_admin_iniciar_comando_mp35b(jsonb, text);
DROP FUNCTION IF EXISTS public.tche_notificacao_resolver_destino_mp35b(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.tche_notificacao_entregar_conta_mp35b(uuid, uuid);
DROP FUNCTION IF EXISTS public.tche_notificacao_bloquear_ator_mp35b(text, uuid, text, bigint);
DROP FUNCTION IF EXISTS public.tche_notificacao_obter_comando_mp35b(text, uuid, bytea);
DROP FUNCTION IF EXISTS public.tche_auditoria_inserir_interno_mp35b(text, jsonb);
DROP FUNCTION IF EXISTS public.tche_exigir_runtime_exclusivo_mp35b();
DROP FUNCTION IF EXISTS public.tche_jsonb_chaves_exatas_mp35b(jsonb, text[], text[]);

DROP TRIGGER IF EXISTS trg_propriedades_serializar_titular_mp35b
  ON public.propriedades;
DROP FUNCTION IF EXISTS public.tche_serializar_propriedade_titular_mp35b();

DROP TRIGGER IF EXISTS trg_comandos_administrativos_ciclo_mp35b
  ON public.comandos_administrativos_idempotencia;
DROP FUNCTION IF EXISTS public.tche_preservar_comando_administrativo_mp35b();
DROP TABLE IF EXISTS public.mutacoes_conta_controladas_mp35b;
DROP INDEX IF EXISTS public.ix_usuarios_organizacao_nome_id_mp35b;
DROP VIEW IF EXISTS public.estados_outbox_conta_mp35b;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM tche_agro_administration_owner;
REVOKE ALL PRIVILEGES ON SCHEMA public
  FROM tche_agro_administration_owner;
DROP ROLE IF EXISTS tche_agro_administration_owner;

-- Restaura somente o contrato da 000004 para chegar à fronteira da MP-35A.
GRANT UPDATE (
  nome, email, status, versao_autorizacao, atualizado_em
) ON public.usuarios TO tche_agro_runtime;
GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_runtime;
GRANT INSERT ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega
TO tche_agro_runtime;
