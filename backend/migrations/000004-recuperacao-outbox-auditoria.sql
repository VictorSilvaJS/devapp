-- Up Migration

CREATE TABLE public.convites_usuario (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  desafio_id uuid NOT NULL,
  origem text NOT NULL,
  modo_ativacao text NOT NULL,
  criado_por_usuario_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  emitido_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  aceito_em timestamptz,
  encerrado_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_convites_usuario_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_convites_usuario_desafio
    UNIQUE (organizacao_id, desafio_id),
  CONSTRAINT fk_convites_usuario_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_convites_usuario_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_convites_usuario_desafio_mesma_organizacao
    FOREIGN KEY (organizacao_id, desafio_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_convites_usuario_criado_por_mesma_organizacao
    FOREIGN KEY (organizacao_id, criado_por_usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_convites_usuario_origem
    CHECK (origem IN ('bootstrap', 'admin')),
  CONSTRAINT ck_convites_usuario_modo_ativacao
    CHECK (modo_ativacao IN ('manter_status', 'ativar_admin_bootstrap')),
  CONSTRAINT ck_convites_usuario_criador
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
    ),
  CONSTRAINT ck_convites_usuario_status
    CHECK (status IN ('pendente', 'aceito', 'revogado', 'expirado')),
  CONSTRAINT ck_convites_usuario_expiracao
    CHECK (expira_em > emitido_em),
  CONSTRAINT ck_convites_usuario_ciclo_vida
    CHECK (
      (
        status = 'pendente'
        AND aceito_em IS NULL
        AND encerrado_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aceito'
        AND aceito_em IS NOT NULL
        AND encerrado_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status IN ('revogado', 'expirado')
        AND aceito_em IS NULL
        AND encerrado_em IS NOT NULL
        AND motivo_encerramento IS NOT NULL
        AND char_length(btrim(motivo_encerramento)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_convites_usuario_pendente
  ON public.convites_usuario (organizacao_id, usuario_id)
  WHERE status = 'pendente';

-- A 000002 cria e valida o singleton de bootstrap com um constraint trigger
-- inicialmente diferido. O runner aplica o lote inteiro em uma unica transacao;
-- portanto, antes de alterar a tabela, drenamos de forma explicita qualquer
-- evento pendente e restauramos o comportamento diferido logo depois.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.bootstrap_autenticacao
  ADD COLUMN ultimo_convite_id uuid,
  ADD CONSTRAINT fk_bootstrap_autenticacao_ultimo_convite
    FOREIGN KEY (organizacao_id, ultimo_convite_id)
    REFERENCES public.convites_usuario (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT ck_bootstrap_autenticacao_convite
    CHECK (
      (status = 'disponivel' AND ultimo_convite_id IS NULL)
      OR (status IN ('convite_pendente', 'concluido') AND ultimo_convite_id IS NOT NULL)
    );

SET CONSTRAINTS ALL DEFERRED;

CREATE FUNCTION public.tche_jsonb_array_textos_unicos_minimo(
  valor jsonb,
  quantidade_minima integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT
    jsonb_typeof(valor) = 'array'
    AND quantidade_minima > 0
    AND count(*) >= quantidade_minima
    AND count(*) = count(DISTINCT item #>> '{}')
    AND bool_and(
      jsonb_typeof(item) = 'string'
      AND char_length(item #>> '{}') BETWEEN 1 AND 128
    )
  FROM jsonb_array_elements(valor) AS elementos(item);
$$;

CREATE TABLE public.recuperacoes_assistidas (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  perfil_alvo text NOT NULL,
  origem text NOT NULL DEFAULT 'admin_http',
  solicitada_por_usuario_id uuid,
  novo_email text NOT NULL,
  categoria_motivo text NOT NULL,
  referencia_externa text NOT NULL,
  autorizacao_plataforma_id text,
  aprovadores_plataforma jsonb,
  versao_politica text NOT NULL DEFAULT 'recuperacao-assistida-v1',
  aprovacoes_necessarias smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'solicitada',
  desafio_email_id uuid,
  autorizacao_restrita_id uuid,
  solicitada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  concluida_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_recuperacoes_assistidas_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_recuperacoes_assistidas_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_recuperacoes_assistidas_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_assistidas_solicitante_mesma_organizacao
    FOREIGN KEY (organizacao_id, solicitada_por_usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_assistidas_desafio_mesma_organizacao
    FOREIGN KEY (organizacao_id, desafio_email_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_assistidas_autorizacao_mesma_organizacao
    FOREIGN KEY (organizacao_id, autorizacao_restrita_id)
    REFERENCES public.autorizacoes_restritas (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_recuperacoes_assistidas_origem
    CHECK (origem IN ('admin_http', 'plataforma_cli')),
  CONSTRAINT ck_recuperacoes_assistidas_perfil_alvo
    CHECK (
      (origem = 'admin_http' AND perfil_alvo IN ('colaborador', 'produtor'))
      OR (origem = 'plataforma_cli' AND perfil_alvo = 'admin')
    ),
  CONSTRAINT ck_recuperacoes_assistidas_solicitante
    CHECK (
      (
        origem = 'admin_http'
        AND solicitada_por_usuario_id IS NOT NULL
        AND aprovacoes_necessarias = 1
        AND autorizacao_plataforma_id IS NULL
        AND aprovadores_plataforma IS NULL
      )
      OR (
        origem = 'plataforma_cli'
        AND solicitada_por_usuario_id IS NULL
        AND aprovacoes_necessarias = 0
        AND autorizacao_plataforma_id IS NOT NULL
        AND char_length(btrim(autorizacao_plataforma_id)) BETWEEN 1 AND 200
        AND aprovadores_plataforma IS NOT NULL
        AND public.tche_jsonb_array_textos_unicos_minimo(
          aprovadores_plataforma,
          2
        )
      )
    ),
  CONSTRAINT ck_recuperacoes_assistidas_novo_email
    CHECK (
      novo_email = btrim(novo_email)
      AND position('@' IN novo_email) > 1
      AND position('@' IN novo_email) < char_length(novo_email)
    ),
  CONSTRAINT ck_recuperacoes_assistidas_categoria_motivo
    CHECK (categoria_motivo ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT ck_recuperacoes_assistidas_referencia_externa
    CHECK (char_length(btrim(referencia_externa)) BETWEEN 1 AND 200),
  CONSTRAINT ck_recuperacoes_assistidas_versao_politica
    CHECK (char_length(btrim(versao_politica)) > 0),
  CONSTRAINT ck_recuperacoes_assistidas_status
    CHECK (
      status IN (
        'solicitada',
        'em_validacao',
        'aguardando_confirmacao_email',
        'aguardando_nova_senha',
        'concluida',
        'rejeitada',
        'cancelada',
        'expirada'
      )
    ),
  CONSTRAINT ck_recuperacoes_assistidas_expiracao
    CHECK (expira_em > solicitada_em),
  CONSTRAINT ck_recuperacoes_assistidas_ciclo_vida
    CHECK (
      (
        status IN ('solicitada', 'em_validacao')
        AND desafio_email_id IS NULL
        AND autorizacao_restrita_id IS NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aguardando_confirmacao_email'
        AND desafio_email_id IS NOT NULL
        AND autorizacao_restrita_id IS NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aguardando_nova_senha'
        AND desafio_email_id IS NOT NULL
        AND autorizacao_restrita_id IS NOT NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'concluida'
        AND desafio_email_id IS NOT NULL
        AND autorizacao_restrita_id IS NOT NULL
        AND concluida_em IS NOT NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status IN ('rejeitada', 'cancelada', 'expirada')
        AND concluida_em IS NULL
        AND encerrada_em IS NOT NULL
        AND motivo_encerramento IS NOT NULL
        AND char_length(btrim(motivo_encerramento)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_recuperacoes_assistidas_ativa_usuario
  ON public.recuperacoes_assistidas (organizacao_id, usuario_id)
  WHERE status IN (
    'solicitada',
    'em_validacao',
    'aguardando_confirmacao_email',
    'aguardando_nova_senha'
  );

CREATE UNIQUE INDEX ux_recuperacoes_assistidas_email_reservado
  ON public.recuperacoes_assistidas (organizacao_id, lower(novo_email))
  WHERE status IN (
    'solicitada',
    'em_validacao',
    'aguardando_confirmacao_email',
    'aguardando_nova_senha'
  );

CREATE UNIQUE INDEX ux_recuperacoes_assistidas_desafio
  ON public.recuperacoes_assistidas (organizacao_id, desafio_email_id)
  WHERE desafio_email_id IS NOT NULL;

CREATE UNIQUE INDEX ux_recuperacoes_assistidas_autorizacao
  ON public.recuperacoes_assistidas (organizacao_id, autorizacao_restrita_id)
  WHERE autorizacao_restrita_id IS NOT NULL;

CREATE UNIQUE INDEX ux_recuperacoes_assistidas_autorizacao_plataforma
  ON public.recuperacoes_assistidas (
    organizacao_id,
    autorizacao_plataforma_id
  )
  WHERE origem = 'plataforma_cli' AND autorizacao_plataforma_id IS NOT NULL;

CREATE TABLE public.aprovacoes_recuperacao_assistida (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  recuperacao_id uuid NOT NULL,
  administrador_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  categoria_decisao text NOT NULL,
  aprovada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  revogada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_aprovacoes_recuperacao_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_aprovacoes_recuperacao_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_aprovacoes_recuperacao_caso_mesma_organizacao
    FOREIGN KEY (organizacao_id, recuperacao_id)
    REFERENCES public.recuperacoes_assistidas (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_aprovacoes_recuperacao_admin_mesma_organizacao
    FOREIGN KEY (organizacao_id, administrador_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_aprovacoes_recuperacao_status
    CHECK (status IN ('ativa', 'revogada')),
  CONSTRAINT ck_aprovacoes_recuperacao_categoria
    CHECK (categoria_decisao ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT ck_aprovacoes_recuperacao_ciclo_vida
    CHECK (
      (status = 'ativa' AND revogada_em IS NULL)
      OR (status = 'revogada' AND revogada_em IS NOT NULL)
    )
);

CREATE UNIQUE INDEX ux_aprovacoes_recuperacao_admin_ativa
  ON public.aprovacoes_recuperacao_assistida (
    organizacao_id,
    recuperacao_id,
    administrador_id
  )
  WHERE status = 'ativa';

CREATE TABLE public.recuperacoes_admin_email_secundario (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_admin_id uuid NOT NULL,
  contato_secundario_id uuid NOT NULL,
  novo_email text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_confirmacao_secundario',
  desafio_secundario_id uuid NOT NULL,
  desafio_email_novo_id uuid,
  autorizacao_restrita_id uuid,
  solicitada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  concluida_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_recuperacoes_admin_email_secundario_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_recuperacoes_admin_email_secundario_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_recuperacoes_admin_email_secundario_usuario
    FOREIGN KEY (organizacao_id, usuario_admin_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_admin_email_secundario_contato
    FOREIGN KEY (organizacao_id, contato_secundario_id)
    REFERENCES public.contatos_email_usuario (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_admin_email_secundario_desafio_secundario
    FOREIGN KEY (organizacao_id, desafio_secundario_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_admin_email_secundario_desafio_novo
    FOREIGN KEY (organizacao_id, desafio_email_novo_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_recuperacoes_admin_email_secundario_autorizacao
    FOREIGN KEY (organizacao_id, autorizacao_restrita_id)
    REFERENCES public.autorizacoes_restritas (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_recuperacoes_admin_email_secundario_novo_email
    CHECK (
      novo_email = btrim(novo_email)
      AND position('@' IN novo_email) > 1
      AND position('@' IN novo_email) < char_length(novo_email)
    ),
  CONSTRAINT ck_recuperacoes_admin_email_secundario_status
    CHECK (
      status IN (
        'aguardando_confirmacao_secundario',
        'aguardando_confirmacao_email_novo',
        'aguardando_nova_senha',
        'concluida',
        'cancelada',
        'expirada'
      )
    ),
  CONSTRAINT ck_recuperacoes_admin_email_secundario_desafios_distintos
    CHECK (
      desafio_email_novo_id IS NULL
      OR desafio_email_novo_id <> desafio_secundario_id
    ),
  CONSTRAINT ck_recuperacoes_admin_email_secundario_expiracao
    CHECK (expira_em > solicitada_em),
  CONSTRAINT ck_recuperacoes_admin_email_secundario_ciclo_vida
    CHECK (
      (
        status = 'aguardando_confirmacao_secundario'
        AND desafio_email_novo_id IS NULL
        AND autorizacao_restrita_id IS NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aguardando_confirmacao_email_novo'
        AND desafio_email_novo_id IS NOT NULL
        AND autorizacao_restrita_id IS NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aguardando_nova_senha'
        AND desafio_email_novo_id IS NOT NULL
        AND autorizacao_restrita_id IS NOT NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'concluida'
        AND desafio_email_novo_id IS NOT NULL
        AND autorizacao_restrita_id IS NOT NULL
        AND concluida_em IS NOT NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status IN ('cancelada', 'expirada')
        AND concluida_em IS NULL
        AND encerrada_em IS NOT NULL
        AND motivo_encerramento IS NOT NULL
        AND char_length(btrim(motivo_encerramento)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_recuperacoes_admin_email_secundario_ativa_usuario
  ON public.recuperacoes_admin_email_secundario (organizacao_id, usuario_admin_id)
  WHERE status IN (
    'aguardando_confirmacao_secundario',
    'aguardando_confirmacao_email_novo',
    'aguardando_nova_senha'
  );

CREATE UNIQUE INDEX ux_recuperacoes_admin_email_secundario_email_reservado
  ON public.recuperacoes_admin_email_secundario (organizacao_id, lower(novo_email))
  WHERE status IN (
    'aguardando_confirmacao_secundario',
    'aguardando_confirmacao_email_novo',
    'aguardando_nova_senha'
  );

CREATE FUNCTION public.tche_preservar_hash_nonce_outbox()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.nonce IS NOT NULL THEN
    NEW.nonce_hash := pg_catalog.sha256(NEW.nonce);
  ELSE
    NEW.nonce_hash := OLD.nonce_hash;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.outbox_email (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid,
  desafio_id uuid,
  tipo_mensagem text NOT NULL,
  origem_tipo text,
  origem_id uuid,
  destinatario_hmac bytea,
  payload_cifrado bytea,
  chave_id text NOT NULL,
  nonce bytea,
  nonce_hash bytea NOT NULL,
  tag_autenticacao bytea,
  contexto_autenticado jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  tentativas smallint NOT NULL DEFAULT 0,
  maximo_tentativas smallint NOT NULL DEFAULT 8,
  disponivel_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  bloqueado_em timestamptz,
  bloqueado_por text,
  lease_token uuid,
  lease_expira_em timestamptz,
  enviado_em timestamptz,
  encerrado_em timestamptz,
  provedor_mensagem_id text,
  erro_categoria text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_outbox_email_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_outbox_email_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_outbox_email_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_outbox_email_desafio_mesma_organizacao
    FOREIGN KEY (organizacao_id, desafio_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_outbox_email_tipo_mensagem
    CHECK (tipo_mensagem ~ '^[a-z][a-z0-9_.]{2,99}$'),
  CONSTRAINT ck_outbox_email_origem_tipo
    CHECK (
      (origem_tipo IS NULL AND origem_id IS NULL)
      OR (
        origem_tipo IN (
          'convite',
          'desafio',
          'alteracao_email',
          'recuperacao_assistida',
          'recuperacao_admin_secundario',
          'evento_seguranca'
        )
        AND origem_id IS NOT NULL
      )
    ),
  CONSTRAINT ck_outbox_email_destinatario_hmac
    CHECK (destinatario_hmac IS NULL OR octet_length(destinatario_hmac) = 32),
  CONSTRAINT ck_outbox_email_chave_id
    CHECK (char_length(btrim(chave_id)) > 0),
  CONSTRAINT ck_outbox_email_nonce
    CHECK (octet_length(nonce) BETWEEN 12 AND 32),
  CONSTRAINT ck_outbox_email_nonce_hash
    CHECK (octet_length(nonce_hash) = 32),
  CONSTRAINT ck_outbox_email_tag
    CHECK (tag_autenticacao IS NULL OR octet_length(tag_autenticacao) = 16),
  CONSTRAINT ck_outbox_email_contexto
    CHECK (
      jsonb_typeof(contexto_autenticado) = 'object'
      AND pg_column_size(contexto_autenticado) <= 4096
      AND contexto_autenticado ->> 'organizationId' = organizacao_id
      AND contexto_autenticado ->> 'messageId' = id::text
      AND contexto_autenticado ->> 'messageType' = tipo_mensagem
    ),
  CONSTRAINT ck_outbox_email_status
    CHECK (
      status IN ('pendente', 'processando', 'enviado', 'falhou', 'cancelado', 'expirado')
    ),
  CONSTRAINT ck_outbox_email_tentativas
    CHECK (
      maximo_tentativas BETWEEN 1 AND 20
      AND tentativas BETWEEN 0 AND maximo_tentativas
    ),
  CONSTRAINT ck_outbox_email_expiracao
    CHECK (expira_em > disponivel_em),
  CONSTRAINT ck_outbox_email_lease
    CHECK (
      (lease_token IS NULL AND lease_expira_em IS NULL)
      OR (lease_token IS NOT NULL AND lease_expira_em IS NOT NULL)
    ),
  CONSTRAINT ck_outbox_email_provedor_id
    CHECK (
      provedor_mensagem_id IS NULL
      OR char_length(btrim(provedor_mensagem_id)) BETWEEN 1 AND 500
    ),
  CONSTRAINT ck_outbox_email_erro_categoria
    CHECK (
      erro_categoria IS NULL
      OR erro_categoria ~ '^[a-z][a-z0-9_]{2,63}$'
    ),
  CONSTRAINT ck_outbox_email_ciclo_vida
    CHECK (
      (
        status = 'pendente'
        AND payload_cifrado IS NOT NULL
        AND nonce IS NOT NULL
        AND tag_autenticacao IS NOT NULL
        AND bloqueado_em IS NULL
        AND bloqueado_por IS NULL
        AND lease_token IS NULL
        AND lease_expira_em IS NULL
        AND enviado_em IS NULL
        AND encerrado_em IS NULL
      )
      OR (
        status = 'processando'
        AND payload_cifrado IS NOT NULL
        AND nonce IS NOT NULL
        AND tag_autenticacao IS NOT NULL
        AND bloqueado_em IS NOT NULL
        AND bloqueado_por IS NOT NULL
        AND char_length(btrim(bloqueado_por)) > 0
        AND lease_token IS NOT NULL
        AND lease_expira_em IS NOT NULL
        AND lease_expira_em > bloqueado_em
        AND enviado_em IS NULL
        AND encerrado_em IS NULL
      )
      OR (
        status = 'enviado'
        AND payload_cifrado IS NULL
        AND nonce IS NULL
        AND tag_autenticacao IS NULL
        AND bloqueado_em IS NULL
        AND bloqueado_por IS NULL
        AND lease_token IS NULL
        AND lease_expira_em IS NULL
        AND enviado_em IS NOT NULL
        AND encerrado_em IS NOT NULL
      )
      OR (
        status IN ('falhou', 'cancelado', 'expirado')
        AND payload_cifrado IS NULL
        AND nonce IS NULL
        AND tag_autenticacao IS NULL
        AND bloqueado_em IS NULL
        AND bloqueado_por IS NULL
        AND lease_token IS NULL
        AND lease_expira_em IS NULL
        AND enviado_em IS NULL
        AND encerrado_em IS NOT NULL
        AND erro_categoria IS NOT NULL
      )
    )
);

CREATE INDEX ix_outbox_email_claim
  ON public.outbox_email (disponivel_em, criado_em)
  WHERE status = 'pendente';

CREATE UNIQUE INDEX ux_outbox_email_nonce_por_chave
  ON public.outbox_email (chave_id, nonce_hash);

CREATE INDEX ix_outbox_email_lease_expirada
  ON public.outbox_email (lease_expira_em)
  WHERE status = 'processando';

CREATE INDEX ix_outbox_email_desafio
  ON public.outbox_email (organizacao_id, desafio_id)
  WHERE desafio_id IS NOT NULL;

CREATE TRIGGER trg_outbox_email_preservar_hash_nonce
BEFORE INSERT OR UPDATE OF nonce ON public.outbox_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_preservar_hash_nonce_outbox();

CREATE VIEW public.desafios_outbox_ativos
WITH (security_barrier = true)
AS
SELECT organizacao_id, id, status, expira_em
FROM public.desafios_autenticacao;

COMMENT ON VIEW public.desafios_outbox_ativos IS
  'Projecao minima para o worker cancelar mensagens cujo desafio nao esta ativo.';

ALTER TABLE public.sessoes_autenticacao
  ADD CONSTRAINT uq_sessoes_autenticacao_ator_auditoria
  UNIQUE (organizacao_id, usuario_id, id);

CREATE TABLE public.eventos_auditoria (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  evento text NOT NULL,
  resultado text NOT NULL,
  ator_tipo text NOT NULL,
  ator_usuario_id uuid,
  sessao_id uuid,
  usuario_afetado_id uuid,
  recurso_tipo text,
  recurso_id text,
  motivo_categoria text,
  referencia_externa_hmac bytea,
  request_id text,
  endereco_ip_hmac bytea,
  email_hmac bytea,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_eventos_auditoria_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_eventos_auditoria_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_eventos_auditoria_ator_mesma_organizacao
    FOREIGN KEY (organizacao_id, ator_usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_eventos_auditoria_sessao_do_ator
    FOREIGN KEY (organizacao_id, ator_usuario_id, sessao_id)
    REFERENCES public.sessoes_autenticacao (organizacao_id, usuario_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_eventos_auditoria_usuario_afetado_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_afetado_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_eventos_auditoria_evento
    CHECK (evento ~ '^[a-z][a-z0-9_.]{2,99}$'),
  CONSTRAINT ck_eventos_auditoria_resultado
    CHECK (resultado IN ('sucesso', 'negado', 'falha')),
  CONSTRAINT ck_eventos_auditoria_ator_tipo
    CHECK (ator_tipo IN ('usuario', 'sistema', 'plataforma')),
  CONSTRAINT ck_eventos_auditoria_ator
    CHECK (
      (ator_tipo = 'usuario' AND ator_usuario_id IS NOT NULL)
      OR (
        ator_tipo IN ('sistema', 'plataforma')
        AND ator_usuario_id IS NULL
        AND sessao_id IS NULL
      )
    ),
  CONSTRAINT ck_eventos_auditoria_recurso
    CHECK (
      (recurso_tipo IS NULL AND recurso_id IS NULL)
      OR (
        recurso_tipo ~ '^[a-z][a-z0-9_]{1,63}$'
        AND recurso_id IS NOT NULL
        AND char_length(btrim(recurso_id)) > 0
      )
    ),
  CONSTRAINT ck_eventos_auditoria_motivo
    CHECK (
      motivo_categoria IS NULL
      OR motivo_categoria ~ '^[a-z][a-z0-9_]{2,63}$'
    ),
  CONSTRAINT ck_eventos_auditoria_referencia_hmac
    CHECK (
      referencia_externa_hmac IS NULL
      OR octet_length(referencia_externa_hmac) = 32
    ),
  CONSTRAINT ck_eventos_auditoria_request_id
    CHECK (request_id IS NULL OR char_length(btrim(request_id)) BETWEEN 1 AND 200),
  CONSTRAINT ck_eventos_auditoria_ip_hmac
    CHECK (endereco_ip_hmac IS NULL OR octet_length(endereco_ip_hmac) = 32),
  CONSTRAINT ck_eventos_auditoria_email_hmac
    CHECK (email_hmac IS NULL OR octet_length(email_hmac) = 32),
  CONSTRAINT ck_eventos_auditoria_metadados
    CHECK (
      jsonb_typeof(metadados) = 'object'
      AND pg_column_size(metadados) <= 16384
    )
);

CREATE INDEX ix_eventos_auditoria_organizacao_ocorrido
  ON public.eventos_auditoria (organizacao_id, ocorrido_em DESC);

CREATE INDEX ix_eventos_auditoria_ator_ocorrido
  ON public.eventos_auditoria (organizacao_id, ator_usuario_id, ocorrido_em DESC)
  WHERE ator_usuario_id IS NOT NULL;

CREATE INDEX ix_eventos_auditoria_usuario_afetado_ocorrido
  ON public.eventos_auditoria (
    organizacao_id,
    usuario_afetado_id,
    ocorrido_em DESC
  )
  WHERE usuario_afetado_id IS NOT NULL;

CREATE UNIQUE INDEX ux_eventos_auditoria_outbox_terminal
  ON public.eventos_auditoria (organizacao_id, recurso_id)
  WHERE recurso_tipo = 'outbox_email'
    AND evento IN (
      'auth.email.enviado',
      'auth.email.cancelado',
      'auth.email.falhou'
    );

CREATE FUNCTION public.tche_validar_convite_usuario()
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

CREATE FUNCTION public.tche_validar_recuperacao_assistida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    JOIN public.usuarios AS alvo
      ON alvo.organizacao_id = recuperacao.organizacao_id
     AND alvo.id = recuperacao.usuario_id
    WHERE alvo.perfil = 'admin'
      AND recuperacao.origem <> 'plataforma_cli'
      AND recuperacao.status IN (
        'solicitada',
        'em_validacao',
        'aguardando_confirmacao_email',
        'aguardando_nova_senha'
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Conta Administradora somente aceita recuperacao break-glass de plataforma.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_admin_somente_plataforma';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    JOIN public.usuarios AS alvo
      ON alvo.organizacao_id = recuperacao.organizacao_id
     AND alvo.id = recuperacao.usuario_id
    WHERE recuperacao.status IN (
      'solicitada',
      'em_validacao',
      'aguardando_confirmacao_email',
      'aguardando_nova_senha'
    )
      AND alvo.status <> 'ativo'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao assistida exige conta alvo ativa.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_alvo_ativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    JOIN public.usuarios AS alvo
      ON alvo.organizacao_id = recuperacao.organizacao_id
     AND alvo.id = recuperacao.usuario_id
    WHERE recuperacao.status IN (
      'solicitada',
      'em_validacao',
      'aguardando_confirmacao_email',
      'aguardando_nova_senha'
    )
      AND alvo.perfil <> recuperacao.perfil_alvo
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O perfil atual do alvo diverge do perfil validado na recuperacao.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_perfil_alvo_atual';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    JOIN public.usuarios AS solicitante
      ON solicitante.organizacao_id = recuperacao.organizacao_id
     AND solicitante.id = recuperacao.solicitada_por_usuario_id
    WHERE recuperacao.origem = 'admin_http'
      AND recuperacao.status IN (
        'solicitada',
        'em_validacao',
        'aguardando_confirmacao_email',
        'aguardando_nova_senha'
      )
      AND (solicitante.perfil <> 'admin' OR solicitante.status <> 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao assistida exige solicitante Administrador ativo.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_solicitante_admin_ativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.aprovacoes_recuperacao_assistida AS aprovacao
    JOIN public.recuperacoes_assistidas AS recuperacao
      ON recuperacao.organizacao_id = aprovacao.organizacao_id
     AND recuperacao.id = aprovacao.recuperacao_id
    JOIN public.usuarios AS administrador
      ON administrador.organizacao_id = aprovacao.organizacao_id
     AND administrador.id = aprovacao.administrador_id
    WHERE aprovacao.status = 'ativa'
      AND recuperacao.status IN (
        'solicitada',
        'em_validacao',
        'aguardando_confirmacao_email',
        'aguardando_nova_senha'
      )
      AND (administrador.perfil <> 'admin' OR administrador.status <> 'ativo')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Aprovacao exige Administrador ativo.',
      CONSTRAINT = 'ct_aprovacoes_recuperacao_admin_ativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    WHERE recuperacao.origem = 'admin_http'
      AND recuperacao.status IN (
        'aguardando_confirmacao_email',
        'aguardando_nova_senha'
      )
      AND (
        SELECT count(*)
        FROM public.aprovacoes_recuperacao_assistida AS aprovacao
        JOIN public.usuarios AS administrador
          ON administrador.organizacao_id = aprovacao.organizacao_id
         AND administrador.id = aprovacao.administrador_id
        WHERE aprovacao.organizacao_id = recuperacao.organizacao_id
          AND aprovacao.recuperacao_id = recuperacao.id
          AND aprovacao.status = 'ativa'
          AND administrador.perfil = 'admin'
          AND administrador.status = 'ativo'
      ) < recuperacao.aprovacoes_necessarias
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao assistida ainda nao possui as aprovacoes validas exigidas.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_aprovacoes_suficientes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    LEFT JOIN public.desafios_autenticacao AS desafio
      ON desafio.organizacao_id = recuperacao.organizacao_id
     AND desafio.id = recuperacao.desafio_email_id
    WHERE recuperacao.status IN (
      'aguardando_confirmacao_email',
      'aguardando_nova_senha',
      'concluida'
    )
      AND (
        desafio.id IS NULL
        OR desafio.usuario_id <> recuperacao.usuario_id
        OR desafio.finalidade <> 'recuperacao_assistida'
        OR (
          recuperacao.status = 'aguardando_confirmacao_email'
          AND desafio.status <> 'ativo'
        )
        OR (
          recuperacao.status IN ('aguardando_nova_senha', 'concluida')
          AND desafio.status <> 'consumido'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao assistida exige desafio do mesmo usuario e finalidade.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_desafio_compativel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    LEFT JOIN public.autorizacoes_restritas AS autorizacao
      ON autorizacao.organizacao_id = recuperacao.organizacao_id
     AND autorizacao.id = recuperacao.autorizacao_restrita_id
    WHERE recuperacao.status IN ('aguardando_nova_senha', 'concluida')
      AND (
        autorizacao.id IS NULL
        OR autorizacao.usuario_id <> recuperacao.usuario_id
        OR autorizacao.finalidade <> 'concluir_recuperacao_assistida'
        OR autorizacao.origem_tipo <> 'recuperacao_assistida'
        OR autorizacao.origem_id <> recuperacao.id
        OR (
          recuperacao.status = 'aguardando_nova_senha'
          AND autorizacao.status <> 'ativa'
        )
        OR (
          recuperacao.status = 'concluida'
          AND autorizacao.status <> 'consumida'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao assistida exige autorizacao do mesmo usuario e caso.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_autorizacao_compativel';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_validar_conclusao_recuperacao_assistida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    JOIN public.usuarios AS alvo
      ON alvo.organizacao_id = recuperacao.organizacao_id
     AND alvo.id = recuperacao.usuario_id
    LEFT JOIN public.usuarios AS solicitante
      ON solicitante.organizacao_id = recuperacao.organizacao_id
     AND solicitante.id = recuperacao.solicitada_por_usuario_id
    WHERE recuperacao.organizacao_id = NEW.organizacao_id
      AND recuperacao.id = NEW.id
      AND recuperacao.status = 'concluida'
      AND (
        alvo.status <> 'ativo'
        OR alvo.perfil <> recuperacao.perfil_alvo
        OR (
          recuperacao.origem = 'admin_http'
          AND (
            solicitante.id IS NULL
            OR solicitante.perfil <> 'admin'
            OR solicitante.status <> 'ativo'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A conclusao exige alvo e solicitante ainda compativeis.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_conclusao_participantes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_assistidas AS recuperacao
    WHERE recuperacao.organizacao_id = NEW.organizacao_id
      AND recuperacao.id = NEW.id
      AND recuperacao.status = 'concluida'
      AND recuperacao.origem = 'admin_http'
      AND (
        SELECT count(*)
        FROM public.aprovacoes_recuperacao_assistida AS aprovacao
        JOIN public.usuarios AS administrador
          ON administrador.organizacao_id = aprovacao.organizacao_id
         AND administrador.id = aprovacao.administrador_id
        WHERE aprovacao.organizacao_id = recuperacao.organizacao_id
          AND aprovacao.recuperacao_id = recuperacao.id
          AND aprovacao.status = 'ativa'
          AND administrador.perfil = 'admin'
          AND administrador.status = 'ativo'
      ) < recuperacao.aprovacoes_necessarias
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A conclusao exige as aprovacoes validas no estado final da transacao.',
      CONSTRAINT = 'ct_recuperacoes_assistidas_conclusao_aprovada';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_validar_recuperacao_admin_secundario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_admin_email_secundario AS recuperacao
    JOIN public.usuarios AS administrador
      ON administrador.organizacao_id = recuperacao.organizacao_id
     AND administrador.id = recuperacao.usuario_admin_id
    JOIN public.contatos_email_usuario AS contato
      ON contato.organizacao_id = recuperacao.organizacao_id
     AND contato.id = recuperacao.contato_secundario_id
    WHERE recuperacao.status IN (
      'aguardando_confirmacao_secundario',
      'aguardando_confirmacao_email_novo',
      'aguardando_nova_senha'
    )
      AND (
        administrador.perfil <> 'admin'
        OR administrador.status <> 'ativo'
        OR contato.usuario_id <> administrador.id
        OR contato.tipo <> 'recuperacao'
        OR contato.status <> 'verificado'
        OR lower(contato.email) = lower(recuperacao.novo_email)
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao do Admin exige conta ativa e contato secundario verificado.',
      CONSTRAINT = 'ct_recuperacoes_admin_contato_verificado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_admin_email_secundario AS recuperacao
    LEFT JOIN public.desafios_autenticacao AS desafio_secundario
      ON desafio_secundario.organizacao_id = recuperacao.organizacao_id
     AND desafio_secundario.id = recuperacao.desafio_secundario_id
    LEFT JOIN public.desafios_autenticacao AS desafio_novo
      ON desafio_novo.organizacao_id = recuperacao.organizacao_id
     AND desafio_novo.id = recuperacao.desafio_email_novo_id
    WHERE recuperacao.status IN (
      'aguardando_confirmacao_secundario',
      'aguardando_confirmacao_email_novo',
      'aguardando_nova_senha'
    )
      AND (
        desafio_secundario.id IS NULL
        OR desafio_secundario.usuario_id <> recuperacao.usuario_admin_id
        OR desafio_secundario.finalidade <> 'recuperacao_admin_secundario'
        OR (
          recuperacao.status = 'aguardando_confirmacao_secundario'
          AND desafio_secundario.status <> 'ativo'
        )
        OR (
          recuperacao.status IN (
            'aguardando_confirmacao_email_novo',
            'aguardando_nova_senha'
          )
          AND desafio_secundario.status <> 'consumido'
        )
        OR (
          recuperacao.status IN (
            'aguardando_confirmacao_email_novo',
            'aguardando_nova_senha'
          )
          AND (
            desafio_novo.id IS NULL
            OR desafio_novo.usuario_id <> recuperacao.usuario_admin_id
            OR desafio_novo.finalidade <> 'recuperacao_admin_email_novo'
          )
        )
        OR (
          recuperacao.status = 'aguardando_confirmacao_email_novo'
          AND desafio_novo.status <> 'ativo'
        )
        OR (
          recuperacao.status = 'aguardando_nova_senha'
          AND desafio_novo.status <> 'consumido'
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao do Admin exige dois desafios distintos e compativeis.',
      CONSTRAINT = 'ct_recuperacoes_admin_desafios_compativeis';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recuperacoes_admin_email_secundario AS recuperacao
    LEFT JOIN public.autorizacoes_restritas AS autorizacao
      ON autorizacao.organizacao_id = recuperacao.organizacao_id
     AND autorizacao.id = recuperacao.autorizacao_restrita_id
    WHERE recuperacao.status = 'aguardando_nova_senha'
      AND (
        autorizacao.id IS NULL
        OR autorizacao.usuario_id <> recuperacao.usuario_admin_id
        OR autorizacao.finalidade <> 'concluir_recuperacao_admin_secundario'
        OR autorizacao.origem_tipo <> 'recuperacao_admin_secundario'
        OR autorizacao.origem_id <> recuperacao.id
        OR autorizacao.status <> 'ativa'
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Recuperacao do Admin exige autorizacao restrita valida.',
      CONSTRAINT = 'ct_recuperacoes_admin_autorizacao_compativel';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tche_validar_emails_autenticacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
      UNION ALL
      SELECT solicitacao.organizacao_id, lower(solicitacao.email_novo) AS email_normalizado
      FROM public.solicitacoes_alteracao_email AS solicitacao
      WHERE solicitacao.status IN (
        'aguardando_confirmacao_atual',
        'aguardando_confirmacao_novo'
      )
      UNION ALL
      SELECT recuperacao.organizacao_id, lower(recuperacao.novo_email) AS email_normalizado
      FROM public.recuperacoes_assistidas AS recuperacao
      WHERE recuperacao.status IN (
        'solicitada',
        'em_validacao',
        'aguardando_confirmacao_email',
        'aguardando_nova_senha'
      )
      UNION ALL
      SELECT recuperacao_admin.organizacao_id,
             lower(recuperacao_admin.novo_email) AS email_normalizado
      FROM public.recuperacoes_admin_email_secundario AS recuperacao_admin
      WHERE recuperacao_admin.status IN (
        'aguardando_confirmacao_secundario',
        'aguardando_confirmacao_email_novo',
        'aguardando_nova_senha'
      )
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

CREATE FUNCTION public.tche_executa_com_papel_operacional(
  papel name,
  relacao oid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT
    pg_catalog.pg_has_role(CURRENT_USER, papel, 'USAGE')
    OR (
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles AS sessao
        JOIN pg_catalog.pg_class AS classe ON classe.oid = relacao
        WHERE sessao.rolname = SESSION_USER
          AND (sessao.rolsuper OR classe.relowner = sessao.oid)
      )
      AND pg_catalog.pg_has_role(SESSION_USER, papel, 'USAGE')
    );
$$;

CREATE FUNCTION public.tche_bloquear_runtime_recuperacao_plataforma()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
  transicao_publica_valida boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );
  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_recuperacoes_assistidas_papeis_exclusivos';
  END IF;

  transicao_publica_valida := FALSE;
  IF TG_OP = 'UPDATE'
     AND OLD.origem = 'plataforma_cli'
     AND NEW.origem = 'plataforma_cli' THEN
    transicao_publica_valida := (
      OLD.status = 'aguardando_confirmacao_email'
      AND NEW.status = 'aguardando_nova_senha'
      AND OLD.autorizacao_restrita_id IS NULL
      AND NEW.autorizacao_restrita_id IS NOT NULL
      AND NEW.desafio_email_id IS NOT DISTINCT FROM OLD.desafio_email_id
      AND NEW.concluida_em IS NOT DISTINCT FROM OLD.concluida_em
      AND NEW.encerrada_em IS NOT DISTINCT FROM OLD.encerrada_em
      AND NEW.motivo_encerramento IS NOT DISTINCT FROM OLD.motivo_encerramento
    ) OR (
      OLD.status = 'aguardando_nova_senha'
      AND NEW.status = 'concluida'
      AND NEW.autorizacao_restrita_id IS NOT DISTINCT FROM OLD.autorizacao_restrita_id
      AND NEW.desafio_email_id IS NOT DISTINCT FROM OLD.desafio_email_id
      AND OLD.concluida_em IS NULL
      AND NEW.concluida_em IS NOT NULL
      AND NEW.encerrada_em IS NOT DISTINCT FROM OLD.encerrada_em
      AND NEW.motivo_encerramento IS NOT DISTINCT FROM OLD.motivo_encerramento
    );

    transicao_publica_valida := transicao_publica_valida
      AND NEW.organizacao_id IS NOT DISTINCT FROM OLD.organizacao_id
      AND NEW.usuario_id IS NOT DISTINCT FROM OLD.usuario_id
      AND NEW.perfil_alvo IS NOT DISTINCT FROM OLD.perfil_alvo
      AND NEW.novo_email IS NOT DISTINCT FROM OLD.novo_email
      AND NEW.referencia_externa IS NOT DISTINCT FROM OLD.referencia_externa
      AND NEW.autorizacao_plataforma_id IS NOT DISTINCT FROM OLD.autorizacao_plataforma_id
      AND NEW.aprovadores_plataforma IS NOT DISTINCT FROM OLD.aprovadores_plataforma
      AND NEW.versao_politica IS NOT DISTINCT FROM OLD.versao_politica;
  END IF;

  IF executa_com_runtime AND NOT executa_com_dono AND (
    (TG_OP = 'INSERT' AND NEW.origem = 'plataforma_cli')
    OR (
      TG_OP = 'UPDATE'
      AND (OLD.origem = 'plataforma_cli' OR NEW.origem = 'plataforma_cli')
      AND NOT transicao_publica_valida
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'O papel runtime nao pode operar recuperacao da plataforma.',
      CONSTRAINT = 'ck_recuperacoes_assistidas_runtime_sem_break_glass';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.tche_validar_bootstrap_autenticacao() SECURITY DEFINER;
ALTER FUNCTION public.tche_validar_alteracao_email_principal() SECURITY DEFINER;
ALTER FUNCTION public.tche_validar_compatibilidade_identidade_vinculos() SECURITY DEFINER;

CREATE FUNCTION public.tche_restringir_platform_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_usuarios_papeis_operacionais_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.perfil <> 'admin'
       OR NEW.status <> 'pendente'
       OR NOT EXISTS (
         SELECT 1
         FROM public.bootstrap_autenticacao AS bootstrap
         WHERE bootstrap.organizacao_id = NEW.organizacao_id
           AND (
             bootstrap.status = 'disponivel'
             OR (
               bootstrap.status = 'convite_pendente'
               AND bootstrap.usuario_admin_id = NEW.id
             )
           )
       )
       OR EXISTS (
         SELECT 1
         FROM public.usuarios AS usuario
         WHERE usuario.organizacao_id = NEW.organizacao_id
           AND usuario.perfil = 'admin'
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma somente cria o primeiro Admin pendente no bootstrap.',
        CONSTRAINT = 'ck_usuarios_platform_bootstrap_insert';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.perfil <> 'admin'
     OR OLD.status <> 'pendente'
     OR NEW.organizacao_id IS DISTINCT FROM OLD.organizacao_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NOT EXISTS (
       SELECT 1
       FROM public.bootstrap_autenticacao AS bootstrap
       WHERE bootstrap.organizacao_id = OLD.organizacao_id
         AND bootstrap.usuario_admin_id = OLD.id
         AND bootstrap.status = 'convite_pendente'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente corrige o email do Admin pendente do bootstrap.',
      CONSTRAINT = 'ck_usuarios_platform_email_bootstrap_pendente';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_restringir_platform_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
  inicializacao_valida boolean;
  correcao_valida boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_bootstrap_papeis_operacionais_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NEW;
  END IF;

  inicializacao_valida := (
    OLD.status = 'disponivel'
    AND NEW.status = 'convite_pendente'
    AND OLD.usuario_admin_id IS NULL
    AND NEW.usuario_admin_id IS NOT NULL
    AND OLD.iniciado_em IS NULL
    AND NEW.iniciado_em IS NOT NULL
    AND NEW.concluido_em IS NULL
    AND NEW.corrigido_em IS NOT DISTINCT FROM OLD.corrigido_em
    AND OLD.ultimo_convite_id IS NULL
    AND NEW.ultimo_convite_id IS NOT NULL
  );

  correcao_valida := (
    OLD.status = 'convite_pendente'
    AND NEW.status = 'convite_pendente'
    AND NEW.usuario_admin_id IS NOT DISTINCT FROM OLD.usuario_admin_id
    AND NEW.iniciado_em IS NOT DISTINCT FROM OLD.iniciado_em
    AND NEW.concluido_em IS NOT DISTINCT FROM OLD.concluido_em
    AND NEW.corrigido_em IS NOT NULL
    AND NEW.corrigido_em IS DISTINCT FROM OLD.corrigido_em
    AND NEW.corrigido_em >= NEW.iniciado_em
    AND NEW.ultimo_convite_id IS NOT NULL
    AND NEW.ultimo_convite_id IS DISTINCT FROM OLD.ultimo_convite_id
  );

  IF NOT inicializacao_valida AND NOT correcao_valida THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente inicia ou corrige o bootstrap pendente.',
      CONSTRAINT = 'ck_bootstrap_platform_operacao_limitada';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_restringir_platform_desafio_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_desafios_platform_papeis_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.finalidade <> 'convite' OR NEW.status <> 'ativo' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma somente cria desafio de convite do bootstrap.',
        CONSTRAINT = 'ck_desafios_platform_somente_convite_bootstrap';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.finalidade <> 'convite'
     OR OLD.status <> 'ativo'
     OR NEW.status <> 'revogado'
     OR NEW.revogado_em IS NULL
     OR NEW.motivo_encerramento <> 'bootstrap_email_corrigido'
     OR NOT EXISTS (
       SELECT 1
       FROM public.convites_usuario AS convite
       JOIN public.bootstrap_autenticacao AS bootstrap
         ON bootstrap.organizacao_id = convite.organizacao_id
        AND bootstrap.usuario_admin_id = convite.usuario_id
       WHERE convite.organizacao_id = OLD.organizacao_id
         AND convite.desafio_id = OLD.id
         AND convite.usuario_id = OLD.usuario_id
         AND convite.origem = 'bootstrap'
         AND convite.modo_ativacao = 'ativar_admin_bootstrap'
         AND (
           convite.status = 'pendente'
           OR (
             convite.status = 'revogado'
             AND convite.motivo_encerramento = 'bootstrap_email_corrigido'
           )
         )
         AND bootstrap.status = 'convite_pendente'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente revoga o desafio corrente ao corrigir o bootstrap.',
      CONSTRAINT = 'ck_desafios_platform_correcao_bootstrap';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_validar_platform_desafio_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.desafios_autenticacao AS desafio
    JOIN public.convites_usuario AS convite
      ON convite.organizacao_id = desafio.organizacao_id
     AND convite.desafio_id = desafio.id
     AND convite.usuario_id = desafio.usuario_id
    JOIN public.bootstrap_autenticacao AS bootstrap
      ON bootstrap.organizacao_id = convite.organizacao_id
     AND bootstrap.usuario_admin_id = convite.usuario_id
     AND bootstrap.ultimo_convite_id = convite.id
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = convite.organizacao_id
     AND usuario.id = convite.usuario_id
    WHERE desafio.organizacao_id = NEW.organizacao_id
      AND desafio.id = NEW.id
      AND desafio.finalidade = 'convite'
      AND desafio.status = 'ativo'
      AND convite.origem = 'bootstrap'
      AND convite.modo_ativacao = 'ativar_admin_bootstrap'
      AND convite.criado_por_usuario_id IS NULL
      AND convite.status = 'pendente'
      AND bootstrap.status = 'convite_pendente'
      AND usuario.perfil = 'admin'
      AND usuario.status = 'pendente'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Desafio da plataforma deve pertencer ao convite corrente do bootstrap.',
      CONSTRAINT = 'ct_desafios_platform_vinculo_bootstrap';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_restringir_platform_convite_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_convites_platform_papeis_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.origem <> 'bootstrap'
       OR NEW.modo_ativacao <> 'ativar_admin_bootstrap'
       OR NEW.criado_por_usuario_id IS NOT NULL
       OR NEW.status <> 'pendente' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma somente cria o convite do bootstrap.',
        CONSTRAINT = 'ck_convites_platform_somente_bootstrap';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.origem <> 'bootstrap'
     OR OLD.modo_ativacao <> 'ativar_admin_bootstrap'
     OR OLD.status <> 'pendente'
     OR NEW.status <> 'revogado'
     OR NEW.encerrado_em IS NULL
     OR NEW.motivo_encerramento <> 'bootstrap_email_corrigido'
     OR NOT EXISTS (
       SELECT 1
       FROM public.bootstrap_autenticacao AS bootstrap
       JOIN public.usuarios AS usuario
         ON usuario.organizacao_id = bootstrap.organizacao_id
        AND usuario.id = bootstrap.usuario_admin_id
       WHERE bootstrap.organizacao_id = OLD.organizacao_id
         AND bootstrap.usuario_admin_id = OLD.usuario_id
         AND bootstrap.status = 'convite_pendente'
         AND usuario.perfil = 'admin'
         AND usuario.status = 'pendente'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente revoga o convite corrente ao corrigir o bootstrap.',
      CONSTRAINT = 'ck_convites_platform_correcao_bootstrap';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_validar_platform_convite_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.convites_usuario AS convite
    JOIN public.desafios_autenticacao AS desafio
      ON desafio.organizacao_id = convite.organizacao_id
     AND desafio.id = convite.desafio_id
     AND desafio.usuario_id = convite.usuario_id
    JOIN public.bootstrap_autenticacao AS bootstrap
      ON bootstrap.organizacao_id = convite.organizacao_id
     AND bootstrap.usuario_admin_id = convite.usuario_id
     AND bootstrap.ultimo_convite_id = convite.id
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = convite.organizacao_id
     AND usuario.id = convite.usuario_id
    WHERE convite.organizacao_id = NEW.organizacao_id
      AND convite.id = NEW.id
      AND convite.origem = 'bootstrap'
      AND convite.modo_ativacao = 'ativar_admin_bootstrap'
      AND convite.criado_por_usuario_id IS NULL
      AND convite.status = 'pendente'
      AND desafio.finalidade = 'convite'
      AND desafio.status = 'ativo'
      AND bootstrap.status = 'convite_pendente'
      AND usuario.perfil = 'admin'
      AND usuario.status = 'pendente'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Convite da plataforma deve ser o convite corrente do bootstrap.',
      CONSTRAINT = 'ct_convites_platform_vinculo_bootstrap';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_restringir_platform_outbox_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
  convite_compativel boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_outbox_platform_papeis_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    convite_compativel := NEW.origem_tipo = 'convite'
      AND NEW.tipo_mensagem = 'email.smtp.v1'
      AND NEW.origem_id IS NOT NULL
      AND NEW.desafio_id IS NOT NULL
      AND NEW.usuario_id IS NOT NULL
      AND NEW.status = 'pendente';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.convites_usuario AS convite
      JOIN public.desafios_autenticacao AS desafio
        ON desafio.organizacao_id = convite.organizacao_id
       AND desafio.id = convite.desafio_id
       AND desafio.usuario_id = convite.usuario_id
      JOIN public.bootstrap_autenticacao AS bootstrap
        ON bootstrap.organizacao_id = convite.organizacao_id
       AND bootstrap.usuario_admin_id = convite.usuario_id
      JOIN public.usuarios AS usuario
        ON usuario.organizacao_id = convite.organizacao_id
       AND usuario.id = convite.usuario_id
      WHERE convite.organizacao_id = OLD.organizacao_id
        AND convite.id = OLD.origem_id
        AND convite.desafio_id = OLD.desafio_id
        AND convite.usuario_id = OLD.usuario_id
        AND convite.origem = 'bootstrap'
        AND convite.modo_ativacao = 'ativar_admin_bootstrap'
        AND convite.status IN ('pendente', 'revogado')
        AND desafio.finalidade = 'convite'
        AND desafio.status IN ('ativo', 'revogado')
        AND bootstrap.status = 'convite_pendente'
        AND usuario.perfil = 'admin'
        AND usuario.status = 'pendente'
    ) INTO convite_compativel;

    convite_compativel := convite_compativel
      AND OLD.origem_tipo = 'convite'
      AND OLD.status IN ('pendente', 'processando')
      AND NEW.status = 'cancelado'
      AND NEW.encerrado_em IS NOT NULL
      AND NEW.erro_categoria = 'challenge_revoked';
  END IF;

  IF convite_compativel IS NOT TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente opera a outbox do convite corrente do bootstrap.',
      CONSTRAINT = 'ck_outbox_platform_somente_bootstrap';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_validar_platform_estado_final_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_dono boolean;
  bootstrap_status text;
  bootstrap_usuario_id uuid;
  bootstrap_convite_id uuid;
  bootstrap_xmin text;
  convite_desafio_id uuid;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF executa_com_runtime AND executa_com_platform_ops AND NOT executa_com_dono THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ct_bootstrap_platform_papeis_exclusivos';
  END IF;

  IF NOT executa_com_platform_ops OR executa_com_dono THEN
    RETURN NULL;
  END IF;

  SELECT bootstrap.status,
         bootstrap.usuario_admin_id,
         bootstrap.ultimo_convite_id,
         bootstrap.xmin::text
  INTO bootstrap_status,
       bootstrap_usuario_id,
       bootstrap_convite_id,
       bootstrap_xmin
  FROM public.bootstrap_autenticacao AS bootstrap
  WHERE bootstrap.organizacao_id = NEW.organizacao_id;

  IF bootstrap_status IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A operacao da plataforma exige o singleton de bootstrap.',
      CONSTRAINT = 'ct_bootstrap_platform_singleton';
  END IF;

  IF bootstrap_status = 'disponivel' THEN
    IF EXISTS (
      SELECT 1
      FROM public.usuarios AS usuario
      WHERE usuario.organizacao_id = NEW.organizacao_id
        AND usuario.perfil = 'admin'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma nao pode deixar um Admin orfao fora do bootstrap.',
        CONSTRAINT = 'ct_bootstrap_platform_admin_referenciado';
    END IF;

    RETURN NULL;
  END IF;

  IF bootstrap_status <> 'convite_pendente' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A plataforma somente opera enquanto o bootstrap esta pendente.',
      CONSTRAINT = 'ct_bootstrap_platform_estado_pendente';
  END IF;

  SELECT convite.desafio_id
  INTO convite_desafio_id
  FROM public.convites_usuario AS convite
  JOIN public.desafios_autenticacao AS desafio
    ON desafio.organizacao_id = convite.organizacao_id
   AND desafio.id = convite.desafio_id
   AND desafio.usuario_id = convite.usuario_id
  JOIN public.usuarios AS usuario
    ON usuario.organizacao_id = convite.organizacao_id
   AND usuario.id = convite.usuario_id
  WHERE convite.organizacao_id = NEW.organizacao_id
    AND convite.id = bootstrap_convite_id
    AND convite.usuario_id = bootstrap_usuario_id
    AND convite.origem = 'bootstrap'
    AND convite.modo_ativacao = 'ativar_admin_bootstrap'
    AND convite.criado_por_usuario_id IS NULL
    AND convite.status = 'pendente'
    AND desafio.finalidade = 'convite'
    AND desafio.status = 'ativo'
    AND usuario.perfil = 'admin'
    AND usuario.status = 'pendente'
    AND EXISTS (
      SELECT 1
      FROM public.outbox_email AS mensagem
      WHERE mensagem.organizacao_id = convite.organizacao_id
        AND mensagem.desafio_id = desafio.id
    );

  IF convite_desafio_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A transacao da plataforma deve terminar com o convite corrente completo.',
      CONSTRAINT = 'ct_bootstrap_platform_estado_final_completo';
  END IF;

  IF TG_TABLE_NAME = 'usuarios' THEN
    IF TG_OP = 'INSERT' AND (
      NEW.id IS DISTINCT FROM bootstrap_usuario_id
      OR bootstrap_xmin IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'O Admin criado pela plataforma deve iniciar o bootstrap na mesma transacao.',
        CONSTRAINT = 'ct_bootstrap_platform_admin_inicializado';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.email IS DISTINCT FROM OLD.email
       AND (
         NEW.id IS DISTINCT FROM bootstrap_usuario_id
         OR bootstrap_xmin IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A correcao de email deve substituir o convite do bootstrap na mesma transacao.',
        CONSTRAINT = 'ct_bootstrap_platform_email_com_rotacao';
    END IF;
  ELSIF TG_TABLE_NAME = 'outbox_email' THEN
    IF TG_OP = 'INSERT' AND (
      NEW.usuario_id IS DISTINCT FROM bootstrap_usuario_id
      OR NEW.desafio_id IS DISTINCT FROM convite_desafio_id
      OR NEW.origem_tipo IS DISTINCT FROM 'convite'
      OR NEW.origem_id IS DISTINCT FROM bootstrap_convite_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A outbox da plataforma deve pertencer ao convite corrente do bootstrap.',
        CONSTRAINT = 'ct_bootstrap_platform_outbox_corrente';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.desafio_id IS NOT DISTINCT FROM convite_desafio_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma nao pode cancelar a outbox do convite ainda corrente.',
        CONSTRAINT = 'ct_bootstrap_platform_outbox_substituida';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.outbox_email AS mensagem
    JOIN public.convites_usuario AS convite_antigo
      ON convite_antigo.organizacao_id = mensagem.organizacao_id
     AND convite_antigo.desafio_id = mensagem.desafio_id
    WHERE mensagem.organizacao_id = NEW.organizacao_id
      AND convite_antigo.usuario_id = bootstrap_usuario_id
      AND convite_antigo.origem = 'bootstrap'
      AND convite_antigo.modo_ativacao = 'ativar_admin_bootstrap'
      AND convite_antigo.id <> bootstrap_convite_id
      AND mensagem.status IN ('pendente', 'processando')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A correcao deve encerrar a outbox do convite substituido.',
      CONSTRAINT = 'ct_bootstrap_platform_outbox_antiga_encerrada';
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.tche_restringir_auditoria_papeis_operacionais()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  executa_com_runtime boolean;
  executa_com_platform_ops boolean;
  executa_com_outbox_worker boolean;
  executa_com_dono boolean;
BEGIN
  executa_com_runtime := public.tche_executa_com_papel_operacional(
    'tche_agro_runtime',
    TG_RELID
  );
  executa_com_platform_ops := public.tche_executa_com_papel_operacional(
    'tche_agro_platform_ops',
    TG_RELID
  );
  executa_com_outbox_worker := public.tche_executa_com_papel_operacional(
    'tche_agro_outbox_worker',
    TG_RELID
  );

  SELECT classe.relowner = papel.oid
  INTO executa_com_dono
  FROM pg_catalog.pg_class AS classe
  JOIN pg_catalog.pg_roles AS papel ON papel.rolname = CURRENT_USER
  WHERE classe.oid = TG_RELID;

  IF NOT executa_com_dono AND (
    (executa_com_runtime AND executa_com_platform_ops)
    OR (executa_com_runtime AND executa_com_outbox_worker)
    OR (executa_com_platform_ops AND executa_com_outbox_worker)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os papeis runtime e plataforma devem usar credenciais distintas.',
      CONSTRAINT = 'ck_auditoria_platform_papeis_exclusivos';
  END IF;

  IF executa_com_dono THEN
    RETURN NEW;
  END IF;

  IF executa_com_platform_ops THEN
    IF NEW.ator_tipo <> 'plataforma'
       OR NEW.ator_usuario_id IS NOT NULL
       OR NEW.sessao_id IS NOT NULL
       OR NEW.resultado <> 'sucesso'
       OR NEW.evento NOT IN (
         'auth.bootstrap_admin.convite_criado',
         'auth.bootstrap_admin.email_corrigido'
       )
       OR NEW.usuario_afetado_id IS NULL
       OR NEW.recurso_tipo <> 'action_challenge'
       OR NEW.recurso_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.bootstrap_autenticacao AS bootstrap
         JOIN public.convites_usuario AS convite
           ON convite.organizacao_id = bootstrap.organizacao_id
          AND convite.id = bootstrap.ultimo_convite_id
         JOIN public.desafios_autenticacao AS desafio
           ON desafio.organizacao_id = convite.organizacao_id
          AND desafio.id = convite.desafio_id
         WHERE bootstrap.organizacao_id = NEW.organizacao_id
           AND bootstrap.usuario_admin_id = NEW.usuario_afetado_id
           AND bootstrap.status = 'convite_pendente'
           AND bootstrap.xmin::text = pg_catalog.pg_current_xact_id()::text
           AND desafio.id::text = NEW.recurso_id
           AND desafio.finalidade = 'convite'
           AND desafio.status = 'ativo'
           AND (
             (
               NEW.evento = 'auth.bootstrap_admin.convite_criado'
               AND bootstrap.iniciado_em = NEW.ocorrido_em
             )
             OR (
               NEW.evento = 'auth.bootstrap_admin.email_corrigido'
               AND bootstrap.corrigido_em = NEW.ocorrido_em
             )
           )
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'A plataforma somente registra auditoria do bootstrap corrente.',
        CONSTRAINT = 'ck_auditoria_platform_somente_bootstrap';
    END IF;

    RETURN NEW;
  END IF;

  IF executa_com_outbox_worker AND (
    NEW.ator_tipo <> 'sistema'
    OR NEW.ator_usuario_id IS NOT NULL
    OR NEW.sessao_id IS NOT NULL
    OR NEW.referencia_externa_hmac IS NOT NULL
    OR NEW.request_id IS NOT NULL
    OR NEW.metadados <> '{}'::jsonb
    OR NEW.recurso_tipo <> 'outbox_email'
    OR NEW.recurso_id IS NULL
    OR NEW.evento NOT IN (
      'auth.email.enviado',
      'auth.email.cancelado',
      'auth.email.falhou'
    )
    OR NOT EXISTS (
      SELECT 1
       FROM public.outbox_email AS mensagem
       WHERE mensagem.organizacao_id = NEW.organizacao_id
         AND mensagem.id::text = NEW.recurso_id
         AND mensagem.xmin::text = pg_catalog.pg_current_xact_id()::text
         AND mensagem.usuario_id IS NOT DISTINCT FROM NEW.usuario_afetado_id
        AND (
          (
            NEW.evento = 'auth.email.enviado'
            AND NEW.resultado = 'sucesso'
            AND NEW.motivo_categoria IS NULL
            AND mensagem.status = 'enviado'
            AND mensagem.enviado_em = NEW.ocorrido_em
          )
          OR (
            NEW.evento = 'auth.email.cancelado'
            AND NEW.resultado = 'falha'
            AND NEW.motivo_categoria = mensagem.erro_categoria
            AND mensagem.status = 'cancelado'
            AND mensagem.encerrado_em = NEW.ocorrido_em
          )
          OR (
            NEW.evento = 'auth.email.falhou'
            AND NEW.resultado = 'falha'
            AND NEW.motivo_categoria = mensagem.erro_categoria
            AND mensagem.status = 'falhou'
            AND mensagem.encerrado_em = NEW.ocorrido_em
          )
        )
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'O worker somente registra o resultado terminal da propria outbox.',
      CONSTRAINT = 'ck_auditoria_worker_resultado_outbox';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.tche_impedir_mutacao_eventos_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'Eventos de auditoria sao append-only.',
    CONSTRAINT = 'ck_eventos_auditoria_append_only';
END;
$$;

CREATE TRIGGER trg_convites_usuario_atualizado_em
BEFORE UPDATE ON public.convites_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_convites_usuario_estado_terminal
BEFORE UPDATE ON public.convites_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'aceito',
  'revogado',
  'expirado'
);

CREATE TRIGGER trg_usuarios_platform_bootstrap_insert
BEFORE INSERT ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_usuario();

CREATE TRIGGER trg_usuarios_platform_bootstrap_email
BEFORE UPDATE OF email ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_usuario();

CREATE TRIGGER trg_bootstrap_platform_operacao_limitada
BEFORE UPDATE ON public.bootstrap_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_bootstrap();

CREATE TRIGGER trg_desafios_platform_somente_bootstrap
BEFORE INSERT OR UPDATE ON public.desafios_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_desafio_bootstrap();

CREATE TRIGGER trg_convites_platform_somente_bootstrap
BEFORE INSERT OR UPDATE ON public.convites_usuario
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_convite_bootstrap();

CREATE TRIGGER trg_outbox_platform_somente_bootstrap
BEFORE INSERT OR UPDATE ON public.outbox_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_platform_outbox_bootstrap();

CREATE TRIGGER trg_recuperacoes_assistidas_atualizado_em
BEFORE UPDATE ON public.recuperacoes_assistidas
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_recuperacoes_assistidas_bloquear_runtime_plataforma
BEFORE INSERT OR UPDATE ON public.recuperacoes_assistidas
FOR EACH ROW
EXECUTE FUNCTION public.tche_bloquear_runtime_recuperacao_plataforma();

CREATE TRIGGER trg_recuperacoes_assistidas_estado_terminal
BEFORE UPDATE ON public.recuperacoes_assistidas
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'concluida',
  'rejeitada',
  'cancelada',
  'expirada'
);

CREATE TRIGGER trg_recuperacoes_assistidas_serializar
BEFORE INSERT OR UPDATE OR DELETE ON public.recuperacoes_assistidas
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_aprovacoes_recuperacao_atualizado_em
BEFORE UPDATE ON public.aprovacoes_recuperacao_assistida
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_aprovacoes_recuperacao_serializar
BEFORE INSERT OR UPDATE OR DELETE ON public.aprovacoes_recuperacao_assistida
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_recuperacoes_admin_secundario_atualizado_em
BEFORE UPDATE ON public.recuperacoes_admin_email_secundario
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_recuperacoes_admin_secundario_estado_terminal
BEFORE UPDATE ON public.recuperacoes_admin_email_secundario
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'concluida',
  'cancelada',
  'expirada'
);

CREATE TRIGGER trg_recuperacoes_admin_secundario_serializar
BEFORE INSERT OR UPDATE OR DELETE ON public.recuperacoes_admin_email_secundario
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE TRIGGER trg_outbox_email_atualizado_em
BEFORE UPDATE ON public.outbox_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_outbox_email_estado_terminal
BEFORE UPDATE ON public.outbox_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'enviado',
  'falhou',
  'cancelado',
  'expirado'
);

CREATE TRIGGER trg_eventos_auditoria_papeis_operacionais
BEFORE INSERT ON public.eventos_auditoria
FOR EACH ROW
EXECUTE FUNCTION public.tche_restringir_auditoria_papeis_operacionais();

CREATE TRIGGER trg_eventos_auditoria_append_only_linhas
BEFORE UPDATE OR DELETE ON public.eventos_auditoria
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_mutacao_eventos_auditoria();

CREATE TRIGGER trg_eventos_auditoria_append_only_truncate
BEFORE TRUNCATE ON public.eventos_auditoria
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_impedir_mutacao_eventos_auditoria();

CREATE CONSTRAINT TRIGGER ct_validar_convites_usuario
AFTER INSERT OR UPDATE ON public.convites_usuario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_convite_usuario();

CREATE CONSTRAINT TRIGGER ct_validar_platform_desafio_bootstrap
AFTER INSERT ON public.desafios_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_desafio_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_convite_bootstrap
AFTER INSERT ON public.convites_usuario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_convite_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_estado_em_usuarios
AFTER INSERT OR UPDATE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_estado_final_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_estado_em_bootstrap
AFTER UPDATE ON public.bootstrap_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_estado_final_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_estado_em_desafios
AFTER INSERT OR UPDATE ON public.desafios_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_estado_final_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_estado_em_convites
AFTER INSERT OR UPDATE ON public.convites_usuario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_estado_final_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_platform_estado_em_outbox
AFTER INSERT OR UPDATE ON public.outbox_email
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_platform_estado_final_bootstrap();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacoes_assistidas
AFTER INSERT OR UPDATE ON public.recuperacoes_assistidas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_conclusao_recuperacao_assistida
AFTER UPDATE OF status ON public.recuperacoes_assistidas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.tche_validar_conclusao_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_insercao_concluida_recuperacao_assistida
AFTER INSERT ON public.recuperacoes_assistidas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.status = 'concluida')
EXECUTE FUNCTION public.tche_validar_conclusao_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_aprovacoes_recuperacao
AFTER INSERT OR UPDATE OR DELETE ON public.aprovacoes_recuperacao_assistida
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacoes_assistidas_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacoes_assistidas_em_desafios
AFTER INSERT OR UPDATE OR DELETE ON public.desafios_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacoes_assistidas_em_autorizacoes
AFTER INSERT OR UPDATE OR DELETE ON public.autorizacoes_restritas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_assistida();

CREATE CONSTRAINT TRIGGER ct_validar_emails_em_recuperacoes
AFTER INSERT OR UPDATE OR DELETE ON public.recuperacoes_assistidas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_emails_autenticacao();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacao_admin_secundario
AFTER INSERT OR UPDATE ON public.recuperacoes_admin_email_secundario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_admin_secundario();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacao_admin_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_admin_secundario();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacao_admin_em_contatos
AFTER INSERT OR UPDATE OR DELETE ON public.contatos_email_usuario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_admin_secundario();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacao_admin_em_desafios
AFTER INSERT OR UPDATE OR DELETE ON public.desafios_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_admin_secundario();

CREATE CONSTRAINT TRIGGER ct_validar_recuperacao_admin_em_autorizacoes
AFTER INSERT OR UPDATE OR DELETE ON public.autorizacoes_restritas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_recuperacao_admin_secundario();

CREATE CONSTRAINT TRIGGER ct_validar_emails_em_recuperacao_admin
AFTER INSERT OR UPDATE OR DELETE ON public.recuperacoes_admin_email_secundario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_emails_autenticacao();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'tche_agro_runtime') THEN
    CREATE ROLE tche_agro_runtime
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'tche_agro_outbox_worker'
  ) THEN
    CREATE ROLE tche_agro_outbox_worker
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'tche_agro_platform_ops'
  ) THEN
    CREATE ROLE tche_agro_platform_ops
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;

  ALTER ROLE tche_agro_runtime
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ALTER ROLE tche_agro_outbox_worker
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ALTER ROLE tche_agro_platform_ops
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

  EXECUTE pg_catalog.format(
    'GRANT CONNECT ON DATABASE %I TO tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops',
    pg_catalog.current_database()
  );
END;
$$;

GRANT USAGE ON SCHEMA public
  TO tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops;

GRANT SELECT ON TABLE
  public.organizacoes,
  public.usuarios,
  public.produtores,
  public.propriedades,
  public.usuario_propriedade,
  public.credenciais_usuario,
  public.contatos_email_usuario,
  public.bootstrap_autenticacao,
  public.sessoes_autenticacao,
  public.tokens_acesso,
  public.tokens_refresh,
  public.desafios_autenticacao,
  public.autorizacoes_restritas,
  public.buckets_limite_autenticacao,
  public.solicitacoes_alteracao_email,
  public.convites_usuario,
  public.recuperacoes_assistidas,
  public.aprovacoes_recuperacao_assistida,
  public.recuperacoes_admin_email_secundario,
  public.outbox_email,
  public.eventos_auditoria
TO tche_agro_runtime;

GRANT INSERT, UPDATE ON TABLE
  public.credenciais_usuario,
  public.contatos_email_usuario,
  public.sessoes_autenticacao,
  public.tokens_acesso,
  public.tokens_refresh,
  public.desafios_autenticacao,
  public.autorizacoes_restritas,
  public.buckets_limite_autenticacao,
  public.solicitacoes_alteracao_email,
  public.convites_usuario,
  public.aprovacoes_recuperacao_assistida,
  public.recuperacoes_admin_email_secundario,
  public.outbox_email
TO tche_agro_runtime;

GRANT INSERT (
  id,
  organizacao_id,
  usuario_id,
  perfil_alvo,
  origem,
  solicitada_por_usuario_id,
  novo_email,
  categoria_motivo,
  referencia_externa,
  versao_politica,
  aprovacoes_necessarias,
  status,
  desafio_email_id,
  autorizacao_restrita_id,
  solicitada_em,
  expira_em,
  concluida_em,
  encerrada_em,
  motivo_encerramento,
  criado_em,
  atualizado_em
) ON public.recuperacoes_assistidas TO tche_agro_runtime;
GRANT UPDATE (
  status,
  desafio_email_id,
  autorizacao_restrita_id,
  concluida_em,
  encerrada_em,
  motivo_encerramento,
  atualizado_em
) ON public.recuperacoes_assistidas TO tche_agro_runtime;

GRANT UPDATE (
  nome,
  email,
  status,
  versao_autorizacao,
  atualizado_em
) ON public.usuarios TO tche_agro_runtime;

-- A API apenas conclui o bootstrap ao aceitar o convite ja emitido pelas
-- operacoes da plataforma; iniciar ou corrigir o bootstrap nao e capacidade
-- do papel runtime.
GRANT UPDATE (
  status,
  concluido_em
) ON public.bootstrap_autenticacao TO tche_agro_runtime;

-- Necessario apenas para o SELECT ... FOR UPDATE usado pelo lock singleton
-- da organizacao nas invariantes transacionais. O runtime nao recebe UPDATE
-- nas demais colunas de organizacoes.
GRANT UPDATE (atualizado_em) ON public.organizacoes TO tche_agro_runtime;

GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_runtime;

GRANT SELECT ON TABLE
  public.organizacoes,
  public.usuarios,
  public.bootstrap_autenticacao,
  public.convites_usuario
TO tche_agro_platform_ops;

GRANT SELECT (id, organizacao_id, usuario_id, finalidade, status)
  ON public.desafios_autenticacao TO tche_agro_platform_ops;
GRANT SELECT (id, organizacao_id, email, status)
  ON public.contatos_email_usuario TO tche_agro_platform_ops;
GRANT SELECT (id, organizacao_id, novo_email, status)
  ON public.recuperacoes_assistidas TO tche_agro_platform_ops;
GRANT SELECT (id, organizacao_id, email_novo, status)
  ON public.solicitacoes_alteracao_email TO tche_agro_platform_ops;
GRANT SELECT (id, organizacao_id, novo_email, status)
  ON public.recuperacoes_admin_email_secundario TO tche_agro_platform_ops;
GRANT SELECT (organizacao_id, desafio_id, status)
  ON public.outbox_email TO tche_agro_platform_ops;

GRANT INSERT (
  id,
  organizacao_id,
  usuario_id,
  finalidade,
  token_hash,
  expira_em
) ON public.desafios_autenticacao TO tche_agro_platform_ops;
GRANT UPDATE (
  status,
  revogado_em,
  motivo_encerramento
) ON public.desafios_autenticacao TO tche_agro_platform_ops;

GRANT INSERT (
  organizacao_id,
  usuario_id,
  desafio_id,
  origem,
  modo_ativacao,
  criado_por_usuario_id,
  expira_em
) ON public.convites_usuario TO tche_agro_platform_ops;
GRANT UPDATE (
  status,
  encerrado_em,
  motivo_encerramento
) ON public.convites_usuario TO tche_agro_platform_ops;

GRANT INSERT (
  id,
  organizacao_id,
  usuario_id,
  desafio_id,
  tipo_mensagem,
  origem_tipo,
  origem_id,
  destinatario_hmac,
  payload_cifrado,
  chave_id,
  nonce,
  tag_autenticacao,
  contexto_autenticado,
  maximo_tentativas,
  disponivel_em,
  expira_em
) ON public.outbox_email TO tche_agro_platform_ops;
GRANT UPDATE (
  status,
  payload_cifrado,
  nonce,
  tag_autenticacao,
  bloqueado_em,
  bloqueado_por,
  lease_token,
  lease_expira_em,
  encerrado_em,
  erro_categoria
) ON public.outbox_email TO tche_agro_platform_ops;

GRANT UPDATE (
  status,
  usuario_admin_id,
  iniciado_em,
  corrigido_em,
  ultimo_convite_id
) ON public.bootstrap_autenticacao TO tche_agro_platform_ops;

GRANT INSERT (
  id,
  organizacao_id,
  nome,
  email,
  perfil,
  status
) ON public.usuarios TO tche_agro_platform_ops;
GRANT UPDATE (
  email
) ON public.usuarios TO tche_agro_platform_ops;
GRANT UPDATE (atualizado_em)
  ON public.organizacoes TO tche_agro_platform_ops;
GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_platform_ops;

GRANT SELECT ON TABLE public.outbox_email TO tche_agro_outbox_worker;
GRANT SELECT ON TABLE public.desafios_outbox_ativos TO tche_agro_outbox_worker;
GRANT UPDATE (
  status,
  tentativas,
  disponivel_em,
  bloqueado_em,
  bloqueado_por,
  lease_token,
  lease_expira_em,
  enviado_em,
  encerrado_em,
  provedor_mensagem_id,
  erro_categoria,
  payload_cifrado,
  nonce,
  tag_autenticacao,
  atualizado_em
) ON public.outbox_email TO tche_agro_outbox_worker;
GRANT INSERT ON TABLE public.eventos_auditoria TO tche_agro_outbox_worker;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.eventos_auditoria
  FROM tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops;

-- Down Migration

REVOKE UPDATE (atualizado_em) ON public.organizacoes FROM tche_agro_runtime;
REVOKE INSERT (
  id,
  organizacao_id,
  usuario_id,
  perfil_alvo,
  origem,
  solicitada_por_usuario_id,
  novo_email,
  categoria_motivo,
  referencia_externa,
  versao_politica,
  aprovacoes_necessarias,
  status,
  desafio_email_id,
  autorizacao_restrita_id,
  solicitada_em,
  expira_em,
  concluida_em,
  encerrada_em,
  motivo_encerramento,
  criado_em,
  atualizado_em
) ON public.recuperacoes_assistidas FROM tche_agro_runtime;
REVOKE UPDATE (
  status,
  desafio_email_id,
  autorizacao_restrita_id,
  concluida_em,
  encerrada_em,
  motivo_encerramento,
  atualizado_em
) ON public.recuperacoes_assistidas FROM tche_agro_runtime;
REVOKE UPDATE (
  status,
  concluido_em
) ON public.bootstrap_autenticacao FROM tche_agro_runtime;
REVOKE UPDATE (atualizado_em) ON public.organizacoes FROM tche_agro_platform_ops;
REVOKE INSERT (
  id,
  organizacao_id,
  nome,
  email,
  perfil,
  status
) ON public.usuarios FROM tche_agro_platform_ops;
REVOKE UPDATE (
  email
) ON public.usuarios FROM tche_agro_platform_ops;
REVOKE UPDATE (
  nome,
  email,
  status,
  versao_autorizacao,
  atualizado_em
) ON public.usuarios FROM tche_agro_runtime;
REVOKE UPDATE (
  status,
  tentativas,
  disponivel_em,
  bloqueado_em,
  bloqueado_por,
  lease_token,
  lease_expira_em,
  enviado_em,
  encerrado_em,
  provedor_mensagem_id,
  erro_categoria,
  payload_cifrado,
  nonce,
  tag_autenticacao,
  atualizado_em
) ON public.outbox_email FROM tche_agro_outbox_worker;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops;
REVOKE ALL PRIVILEGES ON SCHEMA public
  FROM tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops;

DO $$
BEGIN
  EXECUTE pg_catalog.format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM tche_agro_runtime, tche_agro_outbox_worker, tche_agro_platform_ops',
    pg_catalog.current_database()
  );
END;
$$;

DROP ROLE IF EXISTS tche_agro_platform_ops;
DROP ROLE IF EXISTS tche_agro_outbox_worker;
DROP ROLE IF EXISTS tche_agro_runtime;

DROP TRIGGER IF EXISTS trg_usuarios_platform_bootstrap_insert
  ON public.usuarios;
DROP TRIGGER IF EXISTS trg_usuarios_platform_bootstrap_email
  ON public.usuarios;
DROP TRIGGER IF EXISTS trg_bootstrap_platform_operacao_limitada
  ON public.bootstrap_autenticacao;
DROP TRIGGER IF EXISTS trg_desafios_platform_somente_bootstrap
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_platform_desafio_bootstrap
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_platform_estado_em_usuarios
  ON public.usuarios;
DROP TRIGGER IF EXISTS ct_validar_platform_estado_em_bootstrap
  ON public.bootstrap_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_platform_estado_em_desafios
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_platform_estado_em_convites
  ON public.convites_usuario;
DROP TRIGGER IF EXISTS ct_validar_platform_estado_em_outbox
  ON public.outbox_email;
DROP TRIGGER IF EXISTS ct_validar_recuperacoes_assistidas_em_usuarios
  ON public.usuarios;
DROP TRIGGER IF EXISTS ct_validar_recuperacoes_assistidas_em_desafios
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_recuperacoes_assistidas_em_autorizacoes
  ON public.autorizacoes_restritas;

DROP TRIGGER IF EXISTS ct_validar_emails_em_recuperacoes
  ON public.recuperacoes_assistidas;
DROP TRIGGER IF EXISTS ct_validar_recuperacao_admin_em_usuarios
  ON public.usuarios;
DROP TRIGGER IF EXISTS ct_validar_recuperacao_admin_em_contatos
  ON public.contatos_email_usuario;
DROP TRIGGER IF EXISTS ct_validar_recuperacao_admin_em_desafios
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_recuperacao_admin_em_autorizacoes
  ON public.autorizacoes_restritas;

CREATE OR REPLACE FUNCTION public.tche_validar_emails_autenticacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
      UNION ALL
      SELECT solicitacao.organizacao_id, lower(solicitacao.email_novo) AS email_normalizado
      FROM public.solicitacoes_alteracao_email AS solicitacao
      WHERE solicitacao.status IN (
        'aguardando_confirmacao_atual',
        'aguardando_confirmacao_novo'
      )
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

ALTER FUNCTION public.tche_validar_bootstrap_autenticacao() SECURITY INVOKER;
ALTER FUNCTION public.tche_validar_alteracao_email_principal() SECURITY INVOKER;
ALTER FUNCTION public.tche_validar_compatibilidade_identidade_vinculos() SECURITY INVOKER;

ALTER TABLE public.bootstrap_autenticacao
  DROP CONSTRAINT IF EXISTS ck_bootstrap_autenticacao_convite,
  DROP CONSTRAINT IF EXISTS fk_bootstrap_autenticacao_ultimo_convite,
  DROP COLUMN IF EXISTS ultimo_convite_id;

DROP TABLE IF EXISTS public.eventos_auditoria;
ALTER TABLE public.sessoes_autenticacao
  DROP CONSTRAINT IF EXISTS uq_sessoes_autenticacao_ator_auditoria;
DROP VIEW IF EXISTS public.desafios_outbox_ativos;
DROP TABLE IF EXISTS public.outbox_email;
DROP TABLE IF EXISTS public.recuperacoes_admin_email_secundario;
DROP TABLE IF EXISTS public.aprovacoes_recuperacao_assistida;
DROP TABLE IF EXISTS public.recuperacoes_assistidas;
DROP TABLE IF EXISTS public.convites_usuario;

DROP FUNCTION IF EXISTS public.tche_impedir_mutacao_eventos_auditoria();
DROP FUNCTION IF EXISTS public.tche_preservar_hash_nonce_outbox();
DROP FUNCTION IF EXISTS public.tche_bloquear_runtime_recuperacao_plataforma();
DROP FUNCTION IF EXISTS public.tche_restringir_platform_usuario();
DROP FUNCTION IF EXISTS public.tche_restringir_platform_bootstrap();
DROP FUNCTION IF EXISTS public.tche_restringir_platform_desafio_bootstrap();
DROP FUNCTION IF EXISTS public.tche_validar_platform_desafio_bootstrap();
DROP FUNCTION IF EXISTS public.tche_restringir_platform_convite_bootstrap();
DROP FUNCTION IF EXISTS public.tche_validar_platform_convite_bootstrap();
DROP FUNCTION IF EXISTS public.tche_restringir_platform_outbox_bootstrap();
DROP FUNCTION IF EXISTS public.tche_validar_platform_estado_final_bootstrap();
DROP FUNCTION IF EXISTS public.tche_restringir_auditoria_papeis_operacionais();
DROP FUNCTION IF EXISTS public.tche_executa_com_papel_operacional(name, oid);
DROP FUNCTION IF EXISTS public.tche_validar_recuperacao_assistida();
DROP FUNCTION IF EXISTS public.tche_validar_conclusao_recuperacao_assistida();
DROP FUNCTION IF EXISTS public.tche_validar_recuperacao_admin_secundario();
DROP FUNCTION IF EXISTS public.tche_validar_convite_usuario();
DROP FUNCTION IF EXISTS public.tche_jsonb_array_textos_unicos_minimo(jsonb, integer);
