-- Up Migration

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

CREATE TABLE public.organizacoes (
  id text PRIMARY KEY,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT ck_organizacoes_id_tecnico
    CHECK (id = 'org_tche_fertilidade'),
  CONSTRAINT ck_organizacoes_nome_preenchido
    CHECK (char_length(btrim(nome)) > 0),
  CONSTRAINT ck_organizacoes_status
    CHECK (status IN ('ativa', 'inativa'))
);

COMMENT ON COLUMN public.organizacoes.id IS
  'Identificador tecnico imutavel da organizacao unica do primeiro contrato.';
COMMENT ON COLUMN public.organizacoes.nome IS
  'Nome de exibicao mutavel, separado do identificador tecnico.';

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  perfil text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  telefone text,
  documento text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_usuarios_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_usuarios_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_usuarios_nome_preenchido
    CHECK (char_length(btrim(nome)) > 0),
  CONSTRAINT ck_usuarios_email_normalizado
    CHECK (
      email = btrim(email)
      AND position('@' IN email) > 1
      AND position('@' IN email) < char_length(email)
    ),
  CONSTRAINT ck_usuarios_perfil
    CHECK (perfil IN ('admin', 'colaborador', 'produtor')),
  CONSTRAINT ck_usuarios_status
    CHECK (status IN ('pendente', 'ativo', 'inativo')),
  CONSTRAINT ck_usuarios_telefone_preenchido
    CHECK (telefone IS NULL OR char_length(btrim(telefone)) > 0),
  CONSTRAINT ck_usuarios_documento_preenchido
    CHECK (documento IS NULL OR char_length(btrim(documento)) > 0),
  CONSTRAINT ck_usuarios_observacoes_preenchidas
    CHECK (observacoes IS NULL OR char_length(btrim(observacoes)) > 0)
);

CREATE UNIQUE INDEX ux_usuarios_organizacao_email_normalizado
  ON public.usuarios (organizacao_id, lower(email));

CREATE TABLE public.produtores (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'inativo',
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_produtores_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_produtores_organizacao_usuario
    UNIQUE (organizacao_id, usuario_id),
  CONSTRAINT fk_produtores_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_produtores_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_produtores_nome_preenchido
    CHECK (char_length(btrim(nome)) > 0),
  CONSTRAINT ck_produtores_status
    CHECK (status IN ('ativo', 'inativo'))
);

CREATE TABLE public.propriedades (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  titular_id uuid NOT NULL,
  nome text NOT NULL,
  municipio_id text NOT NULL,
  municipio_nome text NOT NULL,
  uf_id text NOT NULL,
  uf_sigla text NOT NULL,
  area_total numeric(14, 4),
  cultura_principal text,
  status text NOT NULL DEFAULT 'ativa',
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_propriedades_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_propriedades_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_propriedades_titular_mesma_organizacao
    FOREIGN KEY (organizacao_id, titular_id)
    REFERENCES public.produtores (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_propriedades_nome_preenchido
    CHECK (char_length(btrim(nome)) > 0),
  CONSTRAINT ck_propriedades_municipio_id_preenchido
    CHECK (char_length(btrim(municipio_id)) > 0),
  CONSTRAINT ck_propriedades_municipio_nome_preenchido
    CHECK (char_length(btrim(municipio_nome)) > 0),
  CONSTRAINT ck_propriedades_uf_id_preenchido
    CHECK (char_length(btrim(uf_id)) > 0),
  CONSTRAINT ck_propriedades_uf_sigla
    CHECK (uf_sigla ~ '^[A-Z]{2}$'),
  CONSTRAINT ck_propriedades_area_total_positiva
    CHECK (area_total IS NULL OR area_total > 0),
  CONSTRAINT ck_propriedades_cultura_principal_preenchida
    CHECK (
      cultura_principal IS NULL
      OR char_length(btrim(cultura_principal)) > 0
    ),
  CONSTRAINT ck_propriedades_status
    CHECK (status IN ('ativa', 'inativa'))
);

CREATE INDEX ix_propriedades_organizacao_titular
  ON public.propriedades (organizacao_id, titular_id);

CREATE INDEX ix_propriedades_organizacao_localizacao
  ON public.propriedades (organizacao_id, uf_id, municipio_id);

CREATE TABLE public.usuario_propriedade (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  propriedade_id uuid NOT NULL,
  tipo_vinculo text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  origem text NOT NULL DEFAULT 'admin_manual',
  motivo_inativacao text,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_usuario_propriedade_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_usuario_propriedade_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_propriedade_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_usuario_propriedade_criado_por_mesma_organizacao
    FOREIGN KEY (organizacao_id, criado_por)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_propriedade_atualizado_por_mesma_organizacao
    FOREIGN KEY (organizacao_id, atualizado_por)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_propriedade_propriedade_mesma_organizacao
    FOREIGN KEY (organizacao_id, propriedade_id)
    REFERENCES public.propriedades (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_usuario_propriedade_tipo_vinculo
    CHECK (tipo_vinculo IN ('usuario_autorizado', 'colaborador')),
  CONSTRAINT ck_usuario_propriedade_status
    CHECK (status IN ('ativo', 'inativo')),
  CONSTRAINT ck_usuario_propriedade_origem
    CHECK (origem = 'admin_manual'),
  CONSTRAINT ck_usuario_propriedade_motivo_inativacao
    CHECK (
      (status = 'ativo' AND motivo_inativacao IS NULL)
      OR (
        status = 'inativo'
        AND motivo_inativacao IS NOT NULL
        AND char_length(btrim(motivo_inativacao)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_usuario_propriedade_vinculo_ativo_equivalente
  ON public.usuario_propriedade (
    organizacao_id,
    usuario_id,
    propriedade_id,
    tipo_vinculo
  )
  WHERE status = 'ativo';

CREATE INDEX ix_usuario_propriedade_usuario_ativo
  ON public.usuario_propriedade (organizacao_id, usuario_id, propriedade_id)
  WHERE status = 'ativo';

CREATE INDEX ix_usuario_propriedade_propriedade_ativo
  ON public.usuario_propriedade (organizacao_id, propriedade_id, usuario_id)
  WHERE status = 'ativo';

CREATE FUNCTION public.tche_definir_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.atualizado_em := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_impedir_alteracao_organizacao_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O identificador tecnico da organizacao e imutavel.',
      CONSTRAINT = 'ck_organizacoes_id_imutavel';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_serializar_invariantes_organizacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1
  FROM public.organizacoes
  WHERE id = 'org_tche_fertilidade'
  FOR UPDATE;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_validar_compatibilidade_identidade_vinculos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  organizacao_alvo text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    organizacao_alvo := OLD.organizacao_id;
  ELSE
    organizacao_alvo := NEW.organizacao_id;
  END IF;

  PERFORM 1
  FROM public.organizacoes
  WHERE id = organizacao_alvo
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.produtores AS produtor
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = produtor.organizacao_id
     AND usuario.id = produtor.usuario_id
    WHERE usuario.perfil <> 'produtor'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Todo Produtor deve referenciar um usuario com perfil produtor.',
      CONSTRAINT = 'ct_produtor_usuario_compativel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_propriedade AS vinculo
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = vinculo.organizacao_id
     AND usuario.id = vinculo.usuario_id
    LEFT JOIN public.produtores AS produtor
      ON produtor.organizacao_id = usuario.organizacao_id
     AND produtor.usuario_id = usuario.id
    WHERE vinculo.status = 'ativo'
      AND (
        (
          vinculo.tipo_vinculo = 'usuario_autorizado'
          AND (
            usuario.perfil <> 'produtor'
            OR produtor.id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.propriedades AS propriedade_titular
              WHERE propriedade_titular.organizacao_id = vinculo.organizacao_id
                AND propriedade_titular.id = vinculo.propriedade_id
                AND propriedade_titular.titular_id = produtor.id
            )
          )
        )
        OR (
          vinculo.tipo_vinculo = 'colaborador'
          AND usuario.perfil <> 'colaborador'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Vinculo adicional ativo incompativel com perfil ou titularidade derivada.',
      CONSTRAINT = 'ct_usuario_propriedade_perfil_compativel';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_organizacoes_id_imutavel
BEFORE UPDATE OF id ON public.organizacoes
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_alteracao_organizacao_id();

CREATE TRIGGER trg_organizacoes_atualizado_em
BEFORE UPDATE ON public.organizacoes
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_usuarios_atualizado_em
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_usuarios_serializar_invariantes
BEFORE INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_produtores_atualizado_em
BEFORE UPDATE ON public.produtores
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_produtores_serializar_invariantes
BEFORE INSERT OR UPDATE OR DELETE ON public.produtores
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_propriedades_atualizado_em
BEFORE UPDATE ON public.propriedades
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_propriedades_serializar_invariantes
BEFORE INSERT OR UPDATE OR DELETE ON public.propriedades
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_usuario_propriedade_atualizado_em
BEFORE UPDATE ON public.usuario_propriedade
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_usuario_propriedade_serializar_invariantes
BEFORE INSERT OR UPDATE OR DELETE ON public.usuario_propriedade
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE CONSTRAINT TRIGGER ct_validar_identidade_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_compatibilidade_identidade_vinculos();

CREATE CONSTRAINT TRIGGER ct_validar_identidade_em_produtores
AFTER INSERT OR UPDATE OR DELETE ON public.produtores
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_compatibilidade_identidade_vinculos();

CREATE CONSTRAINT TRIGGER ct_validar_identidade_em_propriedades
AFTER INSERT OR UPDATE OR DELETE ON public.propriedades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_compatibilidade_identidade_vinculos();

CREATE CONSTRAINT TRIGGER ct_validar_identidade_em_vinculos
AFTER INSERT OR UPDATE OR DELETE ON public.usuario_propriedade
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_compatibilidade_identidade_vinculos();

INSERT INTO public.organizacoes (id, nome, status)
VALUES ('org_tche_fertilidade', 'Tchê Fertilidade', 'ativa');

-- Down Migration

DROP TABLE IF EXISTS public.usuario_propriedade;
DROP TABLE IF EXISTS public.propriedades;
DROP TABLE IF EXISTS public.produtores;
DROP TABLE IF EXISTS public.usuarios;
DROP TABLE IF EXISTS public.organizacoes;

DROP FUNCTION IF EXISTS public.tche_validar_compatibilidade_identidade_vinculos();
DROP FUNCTION IF EXISTS public.tche_serializar_invariantes_organizacao();
DROP FUNCTION IF EXISTS public.tche_impedir_alteracao_organizacao_id();
DROP FUNCTION IF EXISTS public.tche_definir_atualizado_em();

-- A extensao PostGIS e deliberadamente preservada. Ela pode ser preexistente
-- e nao pertence exclusivamente ao aplicativo.
