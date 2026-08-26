-- Up Migration

ALTER TABLE public.usuarios
  ADD COLUMN versao bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_usuarios_versao_positiva CHECK (versao > 0),
  ADD CONSTRAINT ck_usuarios_nome_limite
    CHECK (char_length(nome) BETWEEN 1 AND 200),
  ADD CONSTRAINT ck_usuarios_email_limite
    CHECK (char_length(email) BETWEEN 3 AND 254),
  ADD CONSTRAINT ck_usuarios_telefone_limite
    CHECK (telefone IS NULL OR char_length(telefone) <= 32),
  ADD CONSTRAINT ck_usuarios_documento_limite
    CHECK (documento IS NULL OR char_length(documento) <= 64),
  ADD CONSTRAINT ck_usuarios_observacoes_limite
    CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000);

ALTER TABLE public.produtores
  ADD COLUMN versao bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_produtores_versao_positiva CHECK (versao > 0),
  ADD CONSTRAINT ck_produtores_nome_limite
    CHECK (char_length(nome) BETWEEN 1 AND 200);

ALTER TABLE public.propriedades
  ADD COLUMN versao bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_propriedades_versao_positiva CHECK (versao > 0),
  ADD CONSTRAINT ck_propriedades_nome_limite
    CHECK (char_length(nome) BETWEEN 1 AND 200),
  ADD CONSTRAINT ck_propriedades_cultura_principal_limite
    CHECK (
      cultura_principal IS NULL
      OR char_length(cultura_principal) <= 120
    );

ALTER TABLE public.usuario_propriedade
  ADD COLUMN versao bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_usuario_propriedade_versao_positiva CHECK (versao > 0);

CREATE INDEX ix_usuarios_administracao_lista
  ON public.usuarios (
    organizacao_id,
    status,
    perfil,
    lower(nome),
    id
  );

CREATE INDEX ix_propriedades_administracao_lista
  ON public.propriedades (
    organizacao_id,
    status,
    uf_id,
    municipio_id,
    lower(nome),
    id
  );

CREATE INDEX ix_usuario_propriedade_administracao_lista
  ON public.usuario_propriedade (
    organizacao_id,
    usuario_id,
    status,
    propriedade_id,
    id
  );

CREATE TABLE public.motivos_administrativos (
  codigo text PRIMARY KEY,
  exige_detalhe boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT ck_motivos_administrativos_codigo
    CHECK (codigo ~ '^[a-z][a-z0-9_]{2,63}$')
);

INSERT INTO public.motivos_administrativos (codigo, exige_detalhe)
VALUES
  ('fim_relacao', false),
  ('mudanca_responsabilidade', false),
  ('cadastro_duplicado', false),
  ('correcao_administrativa', false),
  ('suspensao_operacional', false),
  ('outro', true);

ALTER TABLE public.usuario_propriedade
  DROP CONSTRAINT ck_usuario_propriedade_motivo_inativacao,
  ADD COLUMN motivo_inativacao_codigo text,
  ADD COLUMN motivo_inativacao_detalhe text;

-- O backfill e uma traducao de metadado historico, nao uma mutacao de negocio.
-- Desabilitar somente o gatilho de timestamp preserva atualizado_em e todos os
-- demais gatilhos/constraints continuam ativos durante a conversao.
ALTER TABLE public.usuario_propriedade
  DISABLE TRIGGER trg_usuario_propriedade_atualizado_em;

UPDATE public.usuario_propriedade
SET motivo_inativacao_codigo = CASE
      WHEN motivo_inativacao IN (
        'fim_relacao',
        'mudanca_responsabilidade',
        'cadastro_duplicado',
        'correcao_administrativa',
        'suspensao_operacional'
      ) THEN motivo_inativacao
      ELSE 'outro'
    END,
    motivo_inativacao_detalhe = CASE
      WHEN motivo_inativacao IN (
        'fim_relacao',
        'mudanca_responsabilidade',
        'cadastro_duplicado',
        'correcao_administrativa',
        'suspensao_operacional'
      ) THEN NULL
      ELSE left(motivo_inativacao, 300)
    END
WHERE status = 'inativo';

-- O UPDATE agenda constraint triggers diferidos. Drená-los antes do ALTER
-- TABLE evita 55006 e mantém a migration inteira atômica.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.usuario_propriedade
  ENABLE TRIGGER trg_usuario_propriedade_atualizado_em;

SET CONSTRAINTS ALL DEFERRED;

ALTER TABLE public.usuario_propriedade
  ADD CONSTRAINT fk_usuario_propriedade_motivo_inativacao
    FOREIGN KEY (motivo_inativacao_codigo)
    REFERENCES public.motivos_administrativos (codigo)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  ADD CONSTRAINT ck_usuario_propriedade_motivo_estruturado
    CHECK (
      (
        status = 'ativo'
        AND motivo_inativacao IS NULL
        AND motivo_inativacao_codigo IS NULL
        AND motivo_inativacao_detalhe IS NULL
      )
      OR (
        status = 'inativo'
        AND motivo_inativacao IS NOT NULL
        AND char_length(btrim(motivo_inativacao)) > 0
        AND motivo_inativacao_codigo IS NOT NULL
        AND (
          motivo_inativacao_detalhe IS NULL
          OR char_length(btrim(motivo_inativacao_detalhe)) BETWEEN 1 AND 300
        )
        AND (
          motivo_inativacao_codigo <> 'outro'
          OR motivo_inativacao_detalhe IS NOT NULL
        )
      )
    );

CREATE FUNCTION public.tche_normalizar_motivo_inativacao_vinculo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'ativo' THEN
    NEW.motivo_inativacao := NULL;
    NEW.motivo_inativacao_codigo := NULL;
    NEW.motivo_inativacao_detalhe := NULL;
    RETURN NEW;
  END IF;

  IF NEW.motivo_inativacao_codigo IS NULL
     AND NEW.motivo_inativacao IS NOT NULL
     AND char_length(btrim(NEW.motivo_inativacao)) > 0 THEN
    IF NEW.motivo_inativacao IN (
      'fim_relacao',
      'mudanca_responsabilidade',
      'cadastro_duplicado',
      'correcao_administrativa',
      'suspensao_operacional'
    ) THEN
      NEW.motivo_inativacao_codigo := NEW.motivo_inativacao;
      NEW.motivo_inativacao_detalhe := NULL;
    ELSE
      NEW.motivo_inativacao_codigo := 'outro';
      NEW.motivo_inativacao_detalhe := left(NEW.motivo_inativacao, 300);
    END IF;
  END IF;

  IF NEW.motivo_inativacao IS NULL
     AND NEW.motivo_inativacao_codigo IS NOT NULL THEN
    NEW.motivo_inativacao := NEW.motivo_inativacao_codigo
      || CASE
        WHEN NEW.motivo_inativacao_detalhe IS NULL THEN ''
        ELSE ': ' || NEW.motivo_inativacao_detalhe
      END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuario_propriedade_normalizar_motivo
BEFORE INSERT OR UPDATE OF status, motivo_inativacao,
  motivo_inativacao_codigo, motivo_inativacao_detalhe
ON public.usuario_propriedade
FOR EACH ROW
EXECUTE FUNCTION public.tche_normalizar_motivo_inativacao_vinculo();

CREATE FUNCTION public.tche_incrementar_versao_administrativa_mp35a()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.versao = OLD.versao THEN
    NEW.versao := OLD.versao + 1;
  ELSIF NEW.versao <> OLD.versao + 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A versao administrativa deve avancar exatamente uma unidade.',
      CONSTRAINT = 'ct_versao_administrativa_incremento_unitario';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_incrementar_versao_mp35a
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.tche_incrementar_versao_administrativa_mp35a();

CREATE TRIGGER trg_produtores_incrementar_versao_mp35a
BEFORE UPDATE ON public.produtores
FOR EACH ROW
EXECUTE FUNCTION public.tche_incrementar_versao_administrativa_mp35a();

CREATE TRIGGER trg_propriedades_incrementar_versao_mp35a
BEFORE UPDATE ON public.propriedades
FOR EACH ROW
EXECUTE FUNCTION public.tche_incrementar_versao_administrativa_mp35a();

CREATE TRIGGER trg_usuario_propriedade_incrementar_versao_mp35a
BEFORE UPDATE ON public.usuario_propriedade
FOR EACH ROW
EXECUTE FUNCTION public.tche_incrementar_versao_administrativa_mp35a();

ALTER TABLE public.convites_usuario
  DROP CONSTRAINT ck_convites_usuario_modo_ativacao,
  DROP CONSTRAINT ck_convites_usuario_criador,
  ADD CONSTRAINT ck_convites_usuario_modo_ativacao
    CHECK (
      modo_ativacao IN (
        'manter_status',
        'ativar_usuario',
        'ativar_admin_bootstrap'
      )
    ),
  ADD CONSTRAINT ck_convites_usuario_criador
    CHECK (
      (
        origem = 'bootstrap'
        AND modo_ativacao = 'ativar_admin_bootstrap'
        AND criado_por_usuario_id IS NULL
      )
      OR (
        origem = 'admin'
        AND modo_ativacao IN ('manter_status', 'ativar_usuario')
        AND criado_por_usuario_id IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION public.tche_validar_convite_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  validar_emissor boolean := false;
BEGIN
  IF NEW.origem = 'admin' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.modo_ativacao = 'manter_status' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Novos convites administrativos devem ativar o Usuario.',
          CONSTRAINT = 'ct_convites_usuario_modo_historico';
      END IF;
      validar_emissor := true;
    ELSE
      IF NEW.modo_ativacao = 'manter_status'
         AND OLD.modo_ativacao <> 'manter_status' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'manter_status e reservado a convites historicos.',
          CONSTRAINT = 'ct_convites_usuario_modo_historico';
      END IF;

      validar_emissor := NEW.criado_por_usuario_id
          IS DISTINCT FROM OLD.criado_por_usuario_id
        OR NEW.origem IS DISTINCT FROM OLD.origem
        OR NEW.modo_ativacao IS DISTINCT FROM OLD.modo_ativacao;
    END IF;

    IF validar_emissor AND NOT EXISTS (
      SELECT 1
      FROM public.usuarios AS emissor
      WHERE emissor.organizacao_id = NEW.organizacao_id
        AND emissor.id = NEW.criado_por_usuario_id
        AND emissor.perfil = 'admin'
        AND emissor.status = 'ativo'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Convite administrativo exige emissor Administrador ativo.',
        CONSTRAINT = 'ct_convites_usuario_emissor_admin_ativo';
    END IF;
  END IF;

  IF NEW.status = 'pendente' AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.organizacao_id = NEW.organizacao_id
      AND usuario.id = NEW.usuario_id
      AND usuario.status = 'pendente'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite somente pode ser emitido para usuario pendente existente.',
      CONSTRAINT = 'ct_convites_usuario_alvo_pendente';
  END IF;

  IF NEW.status = 'aceito' AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    JOIN public.credenciais_usuario AS credencial
      ON credencial.organizacao_id = usuario.organizacao_id
     AND credencial.usuario_id = usuario.id
     AND credencial.status = 'ativa'
    LEFT JOIN public.produtores AS produtor
      ON produtor.organizacao_id = usuario.organizacao_id
     AND produtor.usuario_id = usuario.id
    WHERE usuario.organizacao_id = NEW.organizacao_id
      AND usuario.id = NEW.usuario_id
      AND (
        (NEW.modo_ativacao = 'manter_status' AND usuario.status = 'pendente')
        OR (
          NEW.modo_ativacao = 'ativar_usuario'
          AND usuario.status = 'ativo'
          AND (
            usuario.perfil <> 'produtor'
            OR produtor.status = 'ativo'
          )
        )
        OR (
          NEW.modo_ativacao = 'ativar_admin_bootstrap'
          AND usuario.status = 'ativo'
          AND usuario.perfil = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite aceito requer credencial ativa e estado de usuario compativel.',
      CONSTRAINT = 'ct_convites_usuario_aceite_valido';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_validar_ativacao_usuario_com_credencial_mp35a()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status <> 'ativo'
     AND NEW.status = 'ativo'
     AND EXISTS (
       SELECT 1
       FROM public.usuarios AS usuario_atual
       WHERE usuario_atual.organizacao_id = NEW.organizacao_id
         AND usuario_atual.id = NEW.id
         AND usuario_atual.status = 'ativo'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.credenciais_usuario AS credencial
       WHERE credencial.organizacao_id = NEW.organizacao_id
         AND credencial.usuario_id = NEW.id
         AND credencial.status = 'ativa'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Ativar Usuario exige credencial ativa na mesma transacao.',
      CONSTRAINT = 'ct_usuarios_ativacao_exige_credencial';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ct_validar_ativacao_usuario_com_credencial_mp35a
AFTER UPDATE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_ativacao_usuario_com_credencial_mp35a();

CREATE FUNCTION public.tche_ativar_produtor_por_convite_mp35a(
  convite_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  convite_organizacao_id text;
  convite_usuario_id uuid;
  convite_origem text;
  convite_modo_ativacao text;
  convite_status text;
  convite_aceito_em timestamptz;
  convite_expira_em timestamptz;
  desafio_finalidade text;
  desafio_status text;
  desafio_consumido_em timestamptz;
  desafio_expira_em timestamptz;
  usuario_perfil text;
  usuario_status text;
  produtor_id uuid;
  produtor_status text;
  produtor_ativado_id uuid;
  executa_com_dono boolean;
BEGIN
  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = SESSION_USER
  WHERE classe.oid = 'public.produtores'::pg_catalog.regclass;

  IF NOT COALESCE(executa_com_dono, false) AND (
    NOT pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_runtime',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_platform_ops',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_outbox_worker',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_notifications_maintenance',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_administration_maintenance',
      'USAGE'
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A ativacao de Produtor por convite exige credencial runtime exclusiva.',
      CONSTRAINT = 'ck_convite_produtor_papel_runtime_exclusivo';
  END IF;

  SELECT convite_atual.organizacao_id,
         convite_atual.usuario_id,
         convite_atual.origem,
         convite_atual.modo_ativacao,
         convite_atual.status,
         convite_atual.aceito_em,
         convite_atual.expira_em,
         desafio_atual.finalidade,
         desafio_atual.status,
         desafio_atual.consumido_em,
         desafio_atual.expira_em,
         usuario_atual.perfil,
         usuario_atual.status,
         produtor_atual.id,
         produtor_atual.status
  INTO convite_organizacao_id,
       convite_usuario_id,
       convite_origem,
       convite_modo_ativacao,
       convite_status,
       convite_aceito_em,
       convite_expira_em,
       desafio_finalidade,
       desafio_status,
       desafio_consumido_em,
       desafio_expira_em,
       usuario_perfil,
       usuario_status,
       produtor_id,
       produtor_status
  FROM public.convites_usuario AS convite_atual
  JOIN public.desafios_autenticacao AS desafio_atual
    ON desafio_atual.organizacao_id = convite_atual.organizacao_id
   AND desafio_atual.id = convite_atual.desafio_id
  JOIN public.usuarios AS usuario_atual
    ON usuario_atual.organizacao_id = convite_atual.organizacao_id
   AND usuario_atual.id = convite_atual.usuario_id
  JOIN public.produtores AS produtor_atual
    ON produtor_atual.organizacao_id = usuario_atual.organizacao_id
   AND produtor_atual.usuario_id = usuario_atual.id
  WHERE convite_atual.id = convite_id
  FOR UPDATE OF convite_atual, desafio_atual, usuario_atual, produtor_atual;

  IF NOT FOUND
     OR convite_origem <> 'admin'
     OR convite_modo_ativacao <> 'ativar_usuario'
     OR convite_status <> 'pendente'
     OR convite_aceito_em IS NOT NULL
     OR convite_expira_em <= pg_catalog.clock_timestamp()
     OR desafio_finalidade <> 'convite'
     OR desafio_status <> 'ativo'
     OR desafio_consumido_em IS NOT NULL
     OR desafio_expira_em <= pg_catalog.clock_timestamp()
     OR usuario_perfil <> 'produtor'
     OR usuario_status <> 'pendente'
     OR produtor_status <> 'inativo'
     OR NOT EXISTS (
       SELECT 1
       FROM public.credenciais_usuario AS credencial
       WHERE credencial.organizacao_id = convite_organizacao_id
         AND credencial.usuario_id = convite_usuario_id
         AND credencial.status = 'ativa'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite de Produtor nao esta apto para ativacao.',
      CONSTRAINT = 'ct_convite_produtor_ativacao_valida';
  END IF;

  UPDATE public.produtores AS produtor_alvo
  SET status = 'ativo'
  WHERE produtor_alvo.organizacao_id = convite_organizacao_id
    AND produtor_alvo.id = produtor_id
    AND produtor_alvo.usuario_id = convite_usuario_id
    AND produtor_alvo.status = 'inativo'
  RETURNING produtor_alvo.id INTO produtor_ativado_id;

  IF produtor_ativado_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite de Produtor nao produziu uma ativacao unica.',
      CONSTRAINT = 'ct_convite_produtor_ativacao_unica';
  END IF;

  RETURN produtor_ativado_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.tche_ativar_produtor_por_convite_mp35a(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.tche_ativar_produtor_por_convite_mp35a(uuid)
TO tche_agro_runtime;

CREATE FUNCTION public.tche_validar_fundacao_administrativa_mp35a()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.produtores AS produtor
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE (usuario.status = 'ativo') IS DISTINCT FROM (produtor.status = 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O estado cadastral do Produtor deve acompanhar o estado do Usuario.',
      CONSTRAINT = 'ct_produtor_usuario_status_compativel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.propriedades AS propriedade
    JOIN public.produtores AS produtor
      ON produtor.organizacao_id = propriedade.organizacao_id
     AND produtor.id = propriedade.titular_id
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE propriedade.status = 'ativa'
      AND (produtor.status <> 'ativo' OR usuario.status <> 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Propriedade ativa exige Titular habilitado.',
      CONSTRAINT = 'ct_propriedade_ativa_titular_habilitado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bootstrap_autenticacao AS bootstrap
    WHERE bootstrap.status = 'concluido'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.organizacao_id = 'org_tche_fertilidade'
      AND usuario.perfil = 'admin'
      AND usuario.status = 'ativo'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A organizacao deve preservar ao menos um Administrador ativo.',
      CONSTRAINT = 'ct_usuarios_ultimo_admin_ativo';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ct_validar_fundacao_mp35a_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_fundacao_administrativa_mp35a();

CREATE CONSTRAINT TRIGGER ct_validar_fundacao_mp35a_em_produtores
AFTER INSERT OR UPDATE OR DELETE ON public.produtores
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_fundacao_administrativa_mp35a();

CREATE CONSTRAINT TRIGGER ct_validar_fundacao_mp35a_em_propriedades
AFTER INSERT OR UPDATE OR DELETE ON public.propriedades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_fundacao_administrativa_mp35a();

CREATE CONSTRAINT TRIGGER ct_validar_fundacao_mp35a_em_bootstrap
AFTER INSERT OR UPDATE OR DELETE ON public.bootstrap_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_fundacao_administrativa_mp35a();

CREATE TRIGGER trg_bootstrap_autenticacao_serializar_invariantes_mp35a
BEFORE INSERT OR UPDATE OR DELETE ON public.bootstrap_autenticacao
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

-- Falha de forma segura se houver dado historico incompativel. A migration
-- nao corrige status nem inativa Propriedades silenciosamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.produtores AS produtor
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE (usuario.status = 'ativo') IS DISTINCT FROM (produtor.status = 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Dado existente possui status divergente entre Usuario e Produtor.',
      CONSTRAINT = 'ck_mp35a_dados_produtor_status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.propriedades AS propriedade
    JOIN public.produtores AS produtor
      ON produtor.organizacao_id = propriedade.organizacao_id
     AND produtor.id = propriedade.titular_id
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE propriedade.status = 'ativa'
      AND (produtor.status <> 'ativo' OR usuario.status <> 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Dado existente possui Propriedade ativa sem Titular habilitado.',
      CONSTRAINT = 'ck_mp35a_dados_propriedade_titular';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bootstrap_autenticacao AS bootstrap
    WHERE bootstrap.status = 'concluido'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.organizacao_id = 'org_tche_fertilidade'
      AND usuario.perfil = 'admin'
      AND usuario.status = 'ativo'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Bootstrap concluido sem Administrador ativo impede o upgrade.',
      CONSTRAINT = 'ck_mp35a_dados_ultimo_admin';
  END IF;
END;
$$;

CREATE TABLE public.comandos_administrativos_idempotencia (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  ator_usuario_id uuid NOT NULL,
  sessao_id uuid NOT NULL,
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  chave_idempotencia_hash bytea NOT NULL,
  comando text NOT NULL,
  hash_requisicao bytea NOT NULL,
  status text NOT NULL DEFAULT 'processando',
  codigo_http integer,
  recibo jsonb,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  concluido_em timestamptz,
  expira_em timestamptz NOT NULL,
  CONSTRAINT uq_comandos_administrativos_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_comandos_administrativos_chave
    UNIQUE (organizacao_id, ator_usuario_id, chave_idempotencia_hash),
  CONSTRAINT fk_comandos_administrativos_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_comandos_administrativos_ator
    FOREIGN KEY (organizacao_id, ator_usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_comandos_administrativos_sessao
    FOREIGN KEY (organizacao_id, ator_usuario_id, sessao_id)
    REFERENCES public.sessoes_autenticacao (
      organizacao_id,
      usuario_id,
      id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_comandos_administrativos_rastreabilidade
    CHECK (
      request_id ~ '^[A-Za-z0-9._:/-]{1,128}$'
      AND correlation_id ~ '^[A-Za-z0-9._:/-]{1,128}$'
    ),
  CONSTRAINT ck_comandos_administrativos_hash_chave
    CHECK (pg_catalog.octet_length(chave_idempotencia_hash) = 32),
  CONSTRAINT ck_comandos_administrativos_hash_requisicao
    CHECK (pg_catalog.octet_length(hash_requisicao) = 32),
  CONSTRAINT ck_comandos_administrativos_comando
    CHECK (comando IN (
      'usuario.criar',
      'usuario.atualizar',
      'usuario.alterar_status',
      'usuario.alterar_vinculos',
      'usuario.emitir_convite',
      'propriedade.criar',
      'propriedade.atualizar',
      'propriedade.alterar_status'
    )),
  CONSTRAINT ck_comandos_administrativos_status
    CHECK (status IN ('processando', 'concluido')),
  CONSTRAINT ck_comandos_administrativos_recibo
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
    ),
  CONSTRAINT ck_comandos_administrativos_ciclo_vida
    CHECK (
      (
        status = 'processando'
        AND codigo_http IS NULL
        AND recibo IS NULL
        AND concluido_em IS NULL
      )
      OR (
        status = 'concluido'
        AND codigo_http = CASE comando
          WHEN 'usuario.criar' THEN 201
          WHEN 'usuario.atualizar' THEN 200
          WHEN 'usuario.alterar_status' THEN 200
          WHEN 'usuario.alterar_vinculos' THEN 200
          WHEN 'usuario.emitir_convite' THEN 201
          WHEN 'propriedade.criar' THEN 201
          WHEN 'propriedade.atualizar' THEN 200
          WHEN 'propriedade.alterar_status' THEN 200
        END
        AND recibo IS NOT NULL
        AND concluido_em IS NOT NULL
        AND concluido_em >= criado_em
      )
    ),
  CONSTRAINT ck_comandos_administrativos_retencao
    CHECK (expira_em = criado_em + interval '90 days')
);

CREATE INDEX ix_comandos_administrativos_expiracao
  ON public.comandos_administrativos_idempotencia (expira_em, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'tche_agro_administration_maintenance'
  ) THEN
    CREATE ROLE tche_agro_administration_maintenance
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS;
  END IF;

  ALTER ROLE tche_agro_administration_maintenance
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;

  EXECUTE pg_catalog.format(
    'GRANT CONNECT ON DATABASE %I TO tche_agro_administration_maintenance',
    pg_catalog.current_database()
  );
END;
$$;

GRANT USAGE ON SCHEMA public TO tche_agro_administration_maintenance;

GRANT SELECT ON public.motivos_administrativos TO tche_agro_runtime;

CREATE FUNCTION public.tche_purgar_comandos_administrativos_mp35a(
  limite integer DEFAULT 1000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  removidos integer;
  executa_com_dono boolean;
BEGIN
  IF limite IS NULL OR limite < 1 OR limite > 5000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'O limite da purga administrativa deve estar entre 1 e 5000.';
  END IF;

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = SESSION_USER
  WHERE classe.oid =
    'public.comandos_administrativos_idempotencia'::pg_catalog.regclass;

  IF NOT COALESCE(executa_com_dono, false) AND (
    NOT pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_administration_maintenance',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_runtime',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_platform_ops',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_outbox_worker',
      'USAGE'
    )
    OR pg_catalog.pg_has_role(
      SESSION_USER,
      'tche_agro_notifications_maintenance',
      'USAGE'
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A purga administrativa exige credencial de manutencao exclusiva.',
      CONSTRAINT = 'ck_comandos_administrativos_papel_exclusivo';
  END IF;

  WITH alvos AS (
    SELECT comando.id
    FROM public.comandos_administrativos_idempotencia AS comando
    WHERE comando.expira_em <= pg_catalog.clock_timestamp()
    ORDER BY comando.expira_em, comando.id
    FOR UPDATE SKIP LOCKED
    LIMIT limite
  )
  DELETE FROM public.comandos_administrativos_idempotencia AS comando
  USING alvos
  WHERE comando.id = alvos.id;

  GET DIAGNOSTICS removidos = ROW_COUNT;
  RETURN removidos;
END;
$$;

REVOKE ALL ON FUNCTION
  public.tche_purgar_comandos_administrativos_mp35a(integer)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.tche_purgar_comandos_administrativos_mp35a(integer)
TO tche_agro_administration_maintenance;

CREATE FUNCTION public.tche_restringir_purga_comandos_administrativos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_manutencao boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_manutencao := public.tche_executa_com_papel_operacional(
    'tche_agro_administration_maintenance',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_dono THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF executa_com_manutencao THEN
    IF TG_OP <> 'DELETE' OR OLD.expira_em > pg_catalog.clock_timestamp() THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A manutencao administrativa remove somente chaves expiradas.',
        CONSTRAINT = 'ck_comandos_administrativos_purga_expirada';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comandos_administrativos_operacao
BEFORE INSERT OR UPDATE OR DELETE
ON public.comandos_administrativos_idempotencia
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_purga_comandos_administrativos();

-- Os grants de escrita do runtime ficam deliberadamente para MP-35B/MP-35C,
-- junto dos comandos HTTP que passarao a usar estas estruturas.

-- Down Migration

DROP TRIGGER IF EXISTS trg_comandos_administrativos_operacao
  ON public.comandos_administrativos_idempotencia;
DROP FUNCTION IF EXISTS public.tche_restringir_purga_comandos_administrativos();

REVOKE EXECUTE ON FUNCTION
  public.tche_purgar_comandos_administrativos_mp35a(integer)
FROM tche_agro_administration_maintenance;
DROP FUNCTION IF EXISTS
  public.tche_purgar_comandos_administrativos_mp35a(integer);

REVOKE SELECT ON public.motivos_administrativos FROM tche_agro_runtime;
REVOKE ALL PRIVILEGES ON SCHEMA public
  FROM tche_agro_administration_maintenance;

DO $$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM tche_agro_administration_maintenance',
    pg_catalog.current_database()
  );
END;
$$;

DROP TABLE IF EXISTS public.comandos_administrativos_idempotencia;
DROP ROLE IF EXISTS tche_agro_administration_maintenance;

DROP TRIGGER IF EXISTS trg_bootstrap_autenticacao_serializar_invariantes_mp35a
  ON public.bootstrap_autenticacao;

DROP TRIGGER IF EXISTS ct_validar_fundacao_mp35a_em_bootstrap
  ON public.bootstrap_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_fundacao_mp35a_em_propriedades
  ON public.propriedades;
DROP TRIGGER IF EXISTS ct_validar_fundacao_mp35a_em_produtores
  ON public.produtores;
DROP TRIGGER IF EXISTS ct_validar_fundacao_mp35a_em_usuarios
  ON public.usuarios;
DROP FUNCTION IF EXISTS public.tche_validar_fundacao_administrativa_mp35a();

DROP TRIGGER IF EXISTS ct_validar_ativacao_usuario_com_credencial_mp35a
  ON public.usuarios;
DROP FUNCTION IF EXISTS
  public.tche_validar_ativacao_usuario_com_credencial_mp35a();

REVOKE EXECUTE ON FUNCTION
  public.tche_ativar_produtor_por_convite_mp35a(uuid)
FROM tche_agro_runtime;
DROP FUNCTION IF EXISTS
  public.tche_ativar_produtor_por_convite_mp35a(uuid);

CREATE OR REPLACE FUNCTION public.tche_validar_convite_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'pendente' AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.organizacao_id = NEW.organizacao_id
      AND usuario.id = NEW.usuario_id
      AND usuario.status = 'pendente'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite somente pode ser emitido para usuario pendente existente.',
      CONSTRAINT = 'ct_convites_usuario_alvo_pendente';
  END IF;

  IF NEW.status = 'aceito' AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    JOIN public.credenciais_usuario AS credencial
      ON credencial.organizacao_id = usuario.organizacao_id
     AND credencial.usuario_id = usuario.id
     AND credencial.status = 'ativa'
    WHERE usuario.organizacao_id = NEW.organizacao_id
      AND usuario.id = NEW.usuario_id
      AND (
        (NEW.modo_ativacao = 'manter_status' AND usuario.status = 'pendente')
        OR (
          NEW.modo_ativacao = 'ativar_admin_bootstrap'
          AND usuario.status = 'ativo'
          AND usuario.perfil = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Convite aceito requer credencial ativa e estado de usuario compativel.',
      CONSTRAINT = 'ct_convites_usuario_aceite_valido';
  END IF;

  RETURN NULL;
END;
$$;

ALTER TABLE public.convites_usuario
  DROP CONSTRAINT ck_convites_usuario_criador,
  DROP CONSTRAINT ck_convites_usuario_modo_ativacao,
  ADD CONSTRAINT ck_convites_usuario_modo_ativacao
    CHECK (modo_ativacao IN ('manter_status', 'ativar_admin_bootstrap')),
  ADD CONSTRAINT ck_convites_usuario_criador
    CHECK (
      (
        origem = 'bootstrap'
        AND modo_ativacao = 'ativar_admin_bootstrap'
        AND criado_por_usuario_id IS NULL
      )
      OR (
        origem = 'admin'
        AND modo_ativacao = 'manter_status'
        AND criado_por_usuario_id IS NOT NULL
      )
    );

DROP TRIGGER IF EXISTS trg_usuario_propriedade_normalizar_motivo
  ON public.usuario_propriedade;
DROP FUNCTION IF EXISTS public.tche_normalizar_motivo_inativacao_vinculo();

DROP TRIGGER IF EXISTS trg_usuario_propriedade_incrementar_versao_mp35a
  ON public.usuario_propriedade;
DROP TRIGGER IF EXISTS trg_propriedades_incrementar_versao_mp35a
  ON public.propriedades;
DROP TRIGGER IF EXISTS trg_produtores_incrementar_versao_mp35a
  ON public.produtores;
DROP TRIGGER IF EXISTS trg_usuarios_incrementar_versao_mp35a
  ON public.usuarios;
DROP FUNCTION IF EXISTS public.tche_incrementar_versao_administrativa_mp35a();

ALTER TABLE public.usuario_propriedade
  DROP CONSTRAINT ck_usuario_propriedade_motivo_estruturado,
  DROP CONSTRAINT fk_usuario_propriedade_motivo_inativacao,
  DROP COLUMN motivo_inativacao_detalhe,
  DROP COLUMN motivo_inativacao_codigo,
  ADD CONSTRAINT ck_usuario_propriedade_motivo_inativacao
    CHECK (
      (status = 'ativo' AND motivo_inativacao IS NULL)
      OR (
        status = 'inativo'
        AND motivo_inativacao IS NOT NULL
        AND char_length(btrim(motivo_inativacao)) > 0
      )
    );

DROP TABLE IF EXISTS public.motivos_administrativos;

DROP INDEX IF EXISTS public.ix_usuario_propriedade_administracao_lista;
DROP INDEX IF EXISTS public.ix_propriedades_administracao_lista;
DROP INDEX IF EXISTS public.ix_usuarios_administracao_lista;

ALTER TABLE public.usuario_propriedade
  DROP CONSTRAINT ck_usuario_propriedade_versao_positiva,
  DROP COLUMN versao;

ALTER TABLE public.propriedades
  DROP CONSTRAINT ck_propriedades_cultura_principal_limite,
  DROP CONSTRAINT ck_propriedades_nome_limite,
  DROP CONSTRAINT ck_propriedades_versao_positiva,
  DROP COLUMN versao;

ALTER TABLE public.produtores
  DROP CONSTRAINT ck_produtores_nome_limite,
  DROP CONSTRAINT ck_produtores_versao_positiva,
  DROP COLUMN versao;

ALTER TABLE public.usuarios
  DROP CONSTRAINT ck_usuarios_observacoes_limite,
  DROP CONSTRAINT ck_usuarios_documento_limite,
  DROP CONSTRAINT ck_usuarios_telefone_limite,
  DROP CONSTRAINT ck_usuarios_email_limite,
  DROP CONSTRAINT ck_usuarios_nome_limite,
  DROP CONSTRAINT ck_usuarios_versao_positiva,
  DROP COLUMN versao;
