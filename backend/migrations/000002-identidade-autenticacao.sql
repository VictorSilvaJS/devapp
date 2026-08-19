-- Up Migration

ALTER TABLE public.usuarios
  ADD COLUMN versao_autorizacao bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT ck_usuarios_versao_autorizacao_positiva
    CHECK (versao_autorizacao > 0);

CREATE TABLE public.credenciais_usuario (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  senha_phc text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  versao_politica_senha text NOT NULL,
  normalizacao_unicode text NOT NULL DEFAULT 'NFC',
  senha_definida_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ultimo_rehash_em timestamptz,
  revogada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_credenciais_usuario_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_credenciais_usuario_usuario
    UNIQUE (organizacao_id, usuario_id),
  CONSTRAINT fk_credenciais_usuario_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_credenciais_usuario_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_credenciais_usuario_senha_argon2id
    CHECK (
      char_length(senha_phc) BETWEEN 32 AND 2048
      AND senha_phc LIKE '$argon2id$%'
    ),
  CONSTRAINT ck_credenciais_usuario_status
    CHECK (status IN ('ativa', 'revogada')),
  CONSTRAINT ck_credenciais_usuario_versao_politica
    CHECK (char_length(btrim(versao_politica_senha)) > 0),
  CONSTRAINT ck_credenciais_usuario_normalizacao
    CHECK (normalizacao_unicode = 'NFC'),
  CONSTRAINT ck_credenciais_usuario_ciclo_vida
    CHECK (
      (status = 'ativa' AND revogada_em IS NULL)
      OR (status = 'revogada' AND revogada_em IS NOT NULL)
    ),
  CONSTRAINT ck_credenciais_usuario_datas
    CHECK (
      (ultimo_rehash_em IS NULL OR ultimo_rehash_em >= senha_definida_em)
      AND (revogada_em IS NULL OR revogada_em >= senha_definida_em)
    )
);

COMMENT ON COLUMN public.credenciais_usuario.senha_phc IS
  'PHC Argon2id completo. Senha em texto puro nunca e persistida.';

CREATE TABLE public.contatos_email_usuario (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'recuperacao',
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  verificado_em timestamptz,
  revogado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_contatos_email_usuario_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_contatos_email_usuario_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_contatos_email_usuario_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_contatos_email_usuario_tipo
    CHECK (tipo = 'recuperacao'),
  CONSTRAINT ck_contatos_email_usuario_email_normalizado
    CHECK (
      email = btrim(email)
      AND position('@' IN email) > 1
      AND position('@' IN email) < char_length(email)
    ),
  CONSTRAINT ck_contatos_email_usuario_status
    CHECK (status IN ('pendente', 'verificado', 'revogado')),
  CONSTRAINT ck_contatos_email_usuario_ciclo_vida
    CHECK (
      (status = 'pendente' AND verificado_em IS NULL AND revogado_em IS NULL)
      OR (status = 'verificado' AND verificado_em IS NOT NULL AND revogado_em IS NULL)
      OR (status = 'revogado' AND revogado_em IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_contatos_email_usuario_verificado
  ON public.contatos_email_usuario (organizacao_id, usuario_id, tipo)
  WHERE status = 'verificado';

CREATE UNIQUE INDEX ux_contatos_email_usuario_pendente
  ON public.contatos_email_usuario (organizacao_id, usuario_id, tipo)
  WHERE status = 'pendente';

CREATE UNIQUE INDEX ux_contatos_email_usuario_email_reservado
  ON public.contatos_email_usuario (organizacao_id, lower(email))
  WHERE status IN ('pendente', 'verificado');

CREATE TABLE public.bootstrap_autenticacao (
  organizacao_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'disponivel',
  usuario_admin_id uuid,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  corrigido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT fk_bootstrap_autenticacao_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_bootstrap_autenticacao_admin_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_admin_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_bootstrap_autenticacao_status
    CHECK (status IN ('disponivel', 'convite_pendente', 'concluido')),
  CONSTRAINT ck_bootstrap_autenticacao_ciclo_vida
    CHECK (
      (
        status = 'disponivel'
        AND usuario_admin_id IS NULL
        AND iniciado_em IS NULL
        AND concluido_em IS NULL
      )
      OR (
        status = 'convite_pendente'
        AND usuario_admin_id IS NOT NULL
        AND iniciado_em IS NOT NULL
        AND concluido_em IS NULL
      )
      OR (
        status = 'concluido'
        AND usuario_admin_id IS NOT NULL
        AND iniciado_em IS NOT NULL
        AND concluido_em IS NOT NULL
        AND concluido_em >= iniciado_em
      )
    ),
  CONSTRAINT ck_bootstrap_autenticacao_correcao
    CHECK (corrigido_em IS NULL OR iniciado_em IS NOT NULL)
);

COMMENT ON TABLE public.bootstrap_autenticacao IS
  'Estado singleton e irreversivel do bootstrap do primeiro Administrador.';

CREATE FUNCTION public.tche_validar_emails_autenticacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT usuario.organizacao_id, lower(usuario.email) AS email_normalizado
      FROM public.usuarios AS usuario
      UNION ALL
      SELECT contato.organizacao_id, lower(contato.email) AS email_normalizado
      FROM public.contatos_email_usuario AS contato
      WHERE contato.status IN ('pendente', 'verificado')
    ) AS emails_reservados
    GROUP BY organizacao_id, email_normalizado
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'O endereco de email ja esta reservado na organizacao.',
      CONSTRAINT = 'ux_emails_autenticacao_reservados';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_impedir_reabertura_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.organizacao_id IS DISTINCT FROM OLD.organizacao_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A organizacao do bootstrap e imutavel.',
      CONSTRAINT = 'ck_bootstrap_autenticacao_organizacao_imutavel';
  END IF;

  IF OLD.status = 'concluido' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O bootstrap concluido nao pode ser reaberto nem alterado.',
      CONSTRAINT = 'ck_bootstrap_autenticacao_irreversivel';
  END IF;

  IF OLD.status = 'disponivel' AND NEW.status <> 'convite_pendente' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O bootstrap deve iniciar por um convite pendente.',
      CONSTRAINT = 'ck_bootstrap_autenticacao_transicao';
  END IF;

  IF OLD.status = 'convite_pendente'
     AND NEW.status NOT IN ('convite_pendente', 'concluido') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O bootstrap pendente somente pode ser corrigido ou concluido.',
      CONSTRAINT = 'ck_bootstrap_autenticacao_transicao';
  END IF;

  IF OLD.usuario_admin_id IS NOT NULL
     AND NEW.usuario_admin_id IS DISTINCT FROM OLD.usuario_admin_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A identidade Administradora do bootstrap e imutavel.',
      CONSTRAINT = 'ck_bootstrap_autenticacao_admin_imutavel';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_impedir_reabertura_estado_terminal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = ANY (TG_ARGV)
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Um estado terminal de seguranca nao pode ser reaberto.',
      CONSTRAINT = 'ck_estado_seguranca_terminal_irreversivel';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_validar_bootstrap_autenticacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IN ('convite_pendente', 'concluido') AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.organizacao_id = NEW.organizacao_id
      AND usuario.id = NEW.usuario_admin_id
      AND usuario.perfil = 'admin'
      AND (
        (NEW.status = 'convite_pendente' AND usuario.status = 'pendente')
        OR (NEW.status = 'concluido' AND usuario.status = 'ativo')
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O bootstrap requer a identidade Administradora no estado esperado.',
      CONSTRAINT = 'ct_bootstrap_autenticacao_admin_valido';
  END IF;

  IF NEW.status = 'concluido' AND NOT EXISTS (
    SELECT 1
    FROM public.credenciais_usuario AS credencial
    WHERE credencial.organizacao_id = NEW.organizacao_id
      AND credencial.usuario_id = NEW.usuario_admin_id
      AND credencial.status = 'ativa'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O bootstrap somente pode concluir com credencial ativa.',
      CONSTRAINT = 'ct_bootstrap_autenticacao_credencial_ativa';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_credenciais_usuario_atualizado_em
BEFORE UPDATE ON public.credenciais_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_contatos_email_usuario_atualizado_em
BEFORE UPDATE ON public.contatos_email_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_contatos_email_usuario_estado_terminal
BEFORE UPDATE ON public.contatos_email_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal('revogado');

CREATE TRIGGER trg_contatos_email_usuario_serializar
BEFORE INSERT OR UPDATE OR DELETE ON public.contatos_email_usuario
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_bootstrap_autenticacao_atualizado_em
BEFORE UPDATE ON public.bootstrap_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_bootstrap_autenticacao_irreversivel
BEFORE UPDATE ON public.bootstrap_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_emails_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_emails_autenticacao();

CREATE CONSTRAINT TRIGGER ct_validar_emails_em_contatos
AFTER INSERT OR UPDATE OR DELETE ON public.contatos_email_usuario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_emails_autenticacao();

CREATE CONSTRAINT TRIGGER ct_validar_bootstrap
AFTER INSERT OR UPDATE ON public.bootstrap_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_bootstrap_autenticacao();

INSERT INTO public.bootstrap_autenticacao (organizacao_id)
VALUES ('org_tche_fertilidade');

-- Down Migration

DROP TRIGGER IF EXISTS ct_validar_emails_em_usuarios ON public.usuarios;

DROP TABLE IF EXISTS public.bootstrap_autenticacao;
DROP TABLE IF EXISTS public.contatos_email_usuario;
DROP TABLE IF EXISTS public.credenciais_usuario;

DROP FUNCTION IF EXISTS public.tche_validar_bootstrap_autenticacao();
DROP FUNCTION IF EXISTS public.tche_impedir_reabertura_bootstrap();
DROP FUNCTION IF EXISTS public.tche_impedir_reabertura_estado_terminal();
DROP FUNCTION IF EXISTS public.tche_validar_emails_autenticacao();

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS ck_usuarios_versao_autorizacao_positiva,
  DROP COLUMN IF EXISTS versao_autorizacao;
