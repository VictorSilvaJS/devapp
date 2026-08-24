-- Up Migration

CREATE TABLE public.notificacao_evento (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  tipo_evento text NOT NULL,
  chave_origem text NOT NULL,
  recurso_tipo text NOT NULL,
  recurso_id uuid NOT NULL,
  propriedade_id uuid,
  talhao_id uuid,
  autor_id uuid,
  dados_apresentacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_notificacao_evento_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_notificacao_evento_conta_destino
    UNIQUE (organizacao_id, id, recurso_id),
  CONSTRAINT uq_notificacao_evento_origem
    UNIQUE (organizacao_id, tipo_evento, chave_origem),
  CONSTRAINT fk_notificacao_evento_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_notificacao_evento_recurso_conta
    FOREIGN KEY (organizacao_id, recurso_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_notificacao_evento_autor
    FOREIGN KEY (organizacao_id, autor_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_notificacao_evento_tipo_inicial
    CHECK (tipo_evento IN (
      'conta.senha_alterada.v1',
      'conta.email_principal_alterado.v1',
      'conta.recuperacao_concluida.v1'
    )),
  CONSTRAINT ck_notificacao_evento_chave_origem_opaca
    CHECK (chave_origem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT ck_notificacao_evento_recurso_inicial
    CHECK (
      recurso_tipo = 'conta'
      AND propriedade_id IS NULL
      AND talhao_id IS NULL
    ),
  CONSTRAINT ck_notificacao_evento_apresentacao_inicial
    CHECK (
      pg_catalog.jsonb_typeof(dados_apresentacao) = 'object'
      AND dados_apresentacao = '{}'::jsonb
      AND pg_catalog.octet_length(dados_apresentacao::text) <= 2048
    )
);

CREATE TABLE public.notificacao_entrega (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  evento_id uuid NOT NULL,
  destinatario_usuario_id uuid NOT NULL,
  organizacao_id text NOT NULL,
  prioridade text NOT NULL DEFAULT 'alta',
  criada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  lida_em timestamptz,
  descartada_em timestamptz,
  chave_deduplicacao text NOT NULL,
  expira_em timestamptz NOT NULL,
  CONSTRAINT uq_notificacao_entrega_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_notificacao_entrega_evento
    UNIQUE (organizacao_id, evento_id),
  CONSTRAINT uq_notificacao_entrega_deduplicacao
    UNIQUE (
      organizacao_id,
      destinatario_usuario_id,
      chave_deduplicacao
    ),
  CONSTRAINT fk_notificacao_entrega_evento_destinatario
    FOREIGN KEY (
      organizacao_id,
      evento_id,
      destinatario_usuario_id
    )
    REFERENCES public.notificacao_evento (
      organizacao_id,
      id,
      recurso_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_notificacao_entrega_destinatario
    FOREIGN KEY (organizacao_id, destinatario_usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_notificacao_entrega_prioridade_inicial
    CHECK (prioridade IN ('baixa', 'normal', 'alta')),
  CONSTRAINT ck_notificacao_entrega_chave_deduplicacao
    CHECK (
      pg_catalog.char_length(chave_deduplicacao) BETWEEN 1 AND 255
      AND chave_deduplicacao !~ '[[:cntrl:]]'
    ),
  CONSTRAINT ck_notificacao_entrega_leitura
    CHECK (lida_em IS NULL OR lida_em >= criada_em),
  CONSTRAINT ck_notificacao_entrega_descarte
    CHECK (descartada_em IS NULL OR descartada_em >= criada_em),
  CONSTRAINT ck_notificacao_entrega_retencao
    CHECK (expira_em = criada_em + interval '90 days')
);

CREATE INDEX ix_notificacao_entrega_lista
  ON public.notificacao_entrega (
    organizacao_id,
    destinatario_usuario_id,
    criada_em DESC,
    id DESC
  )
  WHERE descartada_em IS NULL;

CREATE INDEX ix_notificacao_entrega_contador
  ON public.notificacao_entrega (
    organizacao_id,
    destinatario_usuario_id
  )
  WHERE lida_em IS NULL AND descartada_em IS NULL;

CREATE INDEX ix_notificacao_entrega_expiracao
  ON public.notificacao_entrega (expira_em, id);

CREATE TABLE public.notificacao_comando_idempotencia (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  chave_idempotencia_hash bytea NOT NULL,
  comando text NOT NULL,
  alvo_entrega_id uuid,
  hash_requisicao bytea NOT NULL,
  corte_em timestamptz,
  resultado_em timestamptz,
  resultado_quantidade integer,
  processado_em timestamptz NOT NULL,
  expira_em timestamptz NOT NULL,
  CONSTRAINT uq_notificacao_comando_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_notificacao_comando_chave
    UNIQUE (organizacao_id, usuario_id, chave_idempotencia_hash),
  CONSTRAINT fk_notificacao_comando_usuario
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_notificacao_comando_hash_chave
    CHECK (pg_catalog.octet_length(chave_idempotencia_hash) = 32),
  CONSTRAINT ck_notificacao_comando_hash_requisicao
    CHECK (pg_catalog.octet_length(hash_requisicao) = 32),
  CONSTRAINT ck_notificacao_comando_resultado
    CHECK (
      (
        comando IN ('leitura', 'descarte')
        AND alvo_entrega_id IS NOT NULL
        AND corte_em IS NULL
        AND resultado_em IS NOT NULL
        AND resultado_quantidade IS NULL
      )
      OR (
        comando = 'leituras'
        AND alvo_entrega_id IS NULL
        AND corte_em IS NOT NULL
        AND resultado_em IS NULL
        AND resultado_quantidade >= 0
      )
    ),
  CONSTRAINT ck_notificacao_comando_horarios
    CHECK (
      processado_em <= expira_em
      AND (resultado_em IS NULL OR resultado_em <= processado_em)
      AND (corte_em IS NULL OR corte_em = processado_em)
    ),
  CONSTRAINT ck_notificacao_comando_retencao
    CHECK (expira_em = processado_em + interval '90 days')
);

CREATE INDEX ix_notificacao_comando_expiracao
  ON public.notificacao_comando_idempotencia (expira_em, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'tche_agro_notifications_maintenance'
  ) THEN
    CREATE ROLE tche_agro_notifications_maintenance
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS;
  END IF;

  ALTER ROLE tche_agro_notifications_maintenance
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;

  EXECUTE pg_catalog.format(
    'GRANT CONNECT ON DATABASE %I TO tche_agro_notifications_maintenance',
    pg_catalog.current_database()
  );
END;
$$;

GRANT USAGE ON SCHEMA public TO tche_agro_notifications_maintenance;

GRANT SELECT ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega,
  public.notificacao_comando_idempotencia
TO tche_agro_runtime;

GRANT INSERT ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega,
  public.notificacao_comando_idempotencia
TO tche_agro_runtime;

GRANT UPDATE (lida_em, descartada_em)
  ON public.notificacao_entrega TO tche_agro_runtime;

GRANT SELECT (id, organizacao_id, criado_em)
  ON public.notificacao_evento TO tche_agro_notifications_maintenance;
GRANT SELECT (id, organizacao_id, evento_id, expira_em)
  ON public.notificacao_entrega TO tche_agro_notifications_maintenance;
GRANT SELECT (id, expira_em)
  ON public.notificacao_comando_idempotencia
  TO tche_agro_notifications_maintenance;

GRANT DELETE ON TABLE
  public.notificacao_evento,
  public.notificacao_entrega,
  public.notificacao_comando_idempotencia
TO tche_agro_notifications_maintenance;

CREATE FUNCTION public.tche_restringir_operacao_notificacoes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_manutencao boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_manutencao := public.tche_executa_com_papel_operacional(
    'tche_agro_notifications_maintenance',
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

  IF executa_com_runtime AND executa_com_manutencao THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Runtime e manutencao de notificacoes exigem credenciais distintas.',
      CONSTRAINT = 'ck_notificacoes_papeis_exclusivos';
  END IF;

  IF executa_com_manutencao THEN
    IF TG_OP <> 'DELETE' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A manutencao de notificacoes executa somente a purga.',
        CONSTRAINT = 'ck_notificacoes_manutencao_somente_purga';
    END IF;

    IF TG_TABLE_NAME = 'notificacao_entrega' THEN
      IF OLD.expira_em > pg_catalog.clock_timestamp() THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Uma entrega vigente nao pode ser purgada.',
          CONSTRAINT = 'ck_notificacao_entrega_purga_expirada';
      END IF;
    ELSIF TG_TABLE_NAME = 'notificacao_evento' THEN
      IF EXISTS (
        SELECT 1
        FROM public.notificacao_entrega AS entrega
        WHERE entrega.organizacao_id = OLD.organizacao_id
          AND entrega.evento_id = OLD.id
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Um evento com entrega nao pode ser purgado.',
          CONSTRAINT = 'ck_notificacao_evento_purga_orfao';
      END IF;
    ELSIF TG_TABLE_NAME = 'notificacao_comando_idempotencia' THEN
      IF OLD.expira_em > pg_catalog.clock_timestamp() THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Uma chave idempotente vigente nao pode ser purgada.',
          CONSTRAINT = 'ck_notificacao_comando_purga_expirado';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificacao_evento_operacao
BEFORE INSERT OR UPDATE OR DELETE ON public.notificacao_evento
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_operacao_notificacoes();

CREATE TRIGGER trg_notificacao_entrega_operacao
BEFORE INSERT OR UPDATE OR DELETE ON public.notificacao_entrega
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_operacao_notificacoes();

CREATE TRIGGER trg_notificacao_comando_operacao
BEFORE INSERT OR UPDATE OR DELETE ON public.notificacao_comando_idempotencia
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_operacao_notificacoes();

-- Down Migration

DROP TRIGGER IF EXISTS trg_notificacao_comando_operacao
  ON public.notificacao_comando_idempotencia;
DROP TRIGGER IF EXISTS trg_notificacao_entrega_operacao
  ON public.notificacao_entrega;
DROP TRIGGER IF EXISTS trg_notificacao_evento_operacao
  ON public.notificacao_evento;
DROP FUNCTION IF EXISTS public.tche_restringir_operacao_notificacoes();

REVOKE UPDATE (lida_em, descartada_em)
  ON public.notificacao_entrega FROM tche_agro_runtime;
REVOKE INSERT, SELECT ON TABLE
  public.notificacao_comando_idempotencia,
  public.notificacao_entrega,
  public.notificacao_evento
FROM tche_agro_runtime;

REVOKE DELETE ON TABLE
  public.notificacao_comando_idempotencia,
  public.notificacao_entrega,
  public.notificacao_evento
FROM tche_agro_notifications_maintenance;
REVOKE ALL PRIVILEGES ON TABLE
  public.notificacao_comando_idempotencia,
  public.notificacao_entrega,
  public.notificacao_evento
FROM tche_agro_notifications_maintenance;
REVOKE ALL PRIVILEGES ON SCHEMA public
  FROM tche_agro_notifications_maintenance;

DO $$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM tche_agro_notifications_maintenance',
    pg_catalog.current_database()
  );
END;
$$;

DROP TABLE IF EXISTS public.notificacao_comando_idempotencia;
DROP TABLE IF EXISTS public.notificacao_entrega;
DROP TABLE IF EXISTS public.notificacao_evento;

DROP ROLE IF EXISTS tche_agro_notifications_maintenance;
