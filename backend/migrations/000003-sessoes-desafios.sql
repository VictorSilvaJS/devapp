-- Up Migration

CREATE TABLE public.sessoes_autenticacao (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  versao_autorizacao bigint NOT NULL,
  rotulo_cliente text,
  agente_usuario_hash bytea,
  endereco_ip_hmac bytea,
  criada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ultima_renovacao_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_inatividade_em timestamptz NOT NULL,
  expira_absolutamente_em timestamptz NOT NULL,
  revogada_em timestamptz,
  motivo_revogacao text,
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_sessoes_autenticacao_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_sessoes_autenticacao_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_sessoes_autenticacao_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_sessoes_autenticacao_status
    CHECK (status IN ('ativa', 'revogada', 'expirada')),
  CONSTRAINT ck_sessoes_autenticacao_versao_positiva
    CHECK (versao_autorizacao > 0),
  CONSTRAINT ck_sessoes_autenticacao_rotulo_cliente
    CHECK (rotulo_cliente IS NULL OR char_length(btrim(rotulo_cliente)) BETWEEN 1 AND 200),
  CONSTRAINT ck_sessoes_autenticacao_agente_hash
    CHECK (agente_usuario_hash IS NULL OR octet_length(agente_usuario_hash) = 32),
  CONSTRAINT ck_sessoes_autenticacao_ip_hmac
    CHECK (endereco_ip_hmac IS NULL OR octet_length(endereco_ip_hmac) = 32),
  CONSTRAINT ck_sessoes_autenticacao_expiracoes
    CHECK (
      ultima_renovacao_em >= criada_em
      AND expira_inatividade_em > ultima_renovacao_em
      AND expira_absolutamente_em > criada_em
      AND expira_inatividade_em <= expira_absolutamente_em
    ),
  CONSTRAINT ck_sessoes_autenticacao_revogacao
    CHECK (
      (status = 'ativa' AND revogada_em IS NULL AND motivo_revogacao IS NULL)
      OR (
        status IN ('revogada', 'expirada')
        AND revogada_em IS NOT NULL
        AND motivo_revogacao IS NOT NULL
        AND char_length(btrim(motivo_revogacao)) > 0
      )
    )
);

CREATE INDEX ix_sessoes_autenticacao_usuario_ativas
  ON public.sessoes_autenticacao (organizacao_id, usuario_id, expira_absolutamente_em)
  WHERE status = 'ativa';

CREATE TABLE public.tokens_acesso (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  sessao_id uuid NOT NULL,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  versao_autorizacao bigint NOT NULL,
  emitido_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  revogado_em timestamptz,
  motivo_revogacao text,
  CONSTRAINT uq_tokens_acesso_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_tokens_acesso_hash
    UNIQUE (token_hash),
  CONSTRAINT fk_tokens_acesso_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_tokens_acesso_sessao_mesma_organizacao
    FOREIGN KEY (organizacao_id, sessao_id)
    REFERENCES public.sessoes_autenticacao (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_tokens_acesso_hash_sha256
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT ck_tokens_acesso_status
    CHECK (status IN ('ativo', 'revogado', 'expirado')),
  CONSTRAINT ck_tokens_acesso_versao_positiva
    CHECK (versao_autorizacao > 0),
  CONSTRAINT ck_tokens_acesso_expiracao
    CHECK (expira_em > emitido_em),
  CONSTRAINT ck_tokens_acesso_revogacao
    CHECK (
      (status = 'ativo' AND revogado_em IS NULL AND motivo_revogacao IS NULL)
      OR (
        status IN ('revogado', 'expirado')
        AND revogado_em IS NOT NULL
        AND motivo_revogacao IS NOT NULL
        AND char_length(btrim(motivo_revogacao)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_tokens_acesso_ativo_por_sessao
  ON public.tokens_acesso (organizacao_id, sessao_id)
  WHERE status = 'ativo';

CREATE INDEX ix_tokens_acesso_hash_ativo
  ON public.tokens_acesso (token_hash, expira_em)
  WHERE status = 'ativo';

CREATE TABLE public.tokens_refresh (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  sessao_id uuid NOT NULL,
  token_refresh_anterior_id uuid,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  emitido_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  rotacionado_em timestamptz,
  revogado_em timestamptz,
  motivo_revogacao text,
  CONSTRAINT uq_tokens_refresh_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_tokens_refresh_hash
    UNIQUE (token_hash),
  CONSTRAINT uq_tokens_refresh_anterior
    UNIQUE (organizacao_id, token_refresh_anterior_id),
  CONSTRAINT fk_tokens_refresh_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_tokens_refresh_sessao_mesma_organizacao
    FOREIGN KEY (organizacao_id, sessao_id)
    REFERENCES public.sessoes_autenticacao (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_tokens_refresh_anterior_mesma_organizacao
    FOREIGN KEY (organizacao_id, token_refresh_anterior_id)
    REFERENCES public.tokens_refresh (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_tokens_refresh_hash_sha256
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT ck_tokens_refresh_status
    CHECK (status IN ('ativo', 'rotacionado', 'revogado', 'expirado')),
  CONSTRAINT ck_tokens_refresh_expiracao
    CHECK (expira_em > emitido_em),
  CONSTRAINT ck_tokens_refresh_ciclo_vida
    CHECK (
      (
        status = 'ativo'
        AND rotacionado_em IS NULL
        AND revogado_em IS NULL
        AND motivo_revogacao IS NULL
      )
      OR (
        status = 'rotacionado'
        AND rotacionado_em IS NOT NULL
        AND revogado_em IS NULL
        AND motivo_revogacao IS NULL
      )
      OR (
        status IN ('revogado', 'expirado')
        AND revogado_em IS NOT NULL
        AND motivo_revogacao IS NOT NULL
        AND char_length(btrim(motivo_revogacao)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_tokens_refresh_ativo_por_sessao
  ON public.tokens_refresh (organizacao_id, sessao_id)
  WHERE status = 'ativo';

CREATE UNIQUE INDEX ux_tokens_refresh_raiz_por_sessao
  ON public.tokens_refresh (organizacao_id, sessao_id)
  WHERE token_refresh_anterior_id IS NULL;

CREATE INDEX ix_tokens_refresh_hash_consulta
  ON public.tokens_refresh (token_hash, expira_em);

CREATE TABLE public.desafios_autenticacao (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  finalidade text NOT NULL,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  tentativas integer NOT NULL DEFAULT 0,
  maximo_tentativas integer NOT NULL DEFAULT 5,
  emitido_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  consumido_em timestamptz,
  revogado_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_desafios_autenticacao_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_desafios_autenticacao_hash
    UNIQUE (token_hash),
  CONSTRAINT fk_desafios_autenticacao_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_desafios_autenticacao_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_desafios_autenticacao_finalidade
    CHECK (
      finalidade IN (
        'convite',
        'recuperacao_senha',
        'confirmacao_email_atual',
        'confirmacao_email_novo',
        'confirmacao_email_recuperacao',
        'recuperacao_assistida',
        'recuperacao_admin_secundario',
        'recuperacao_admin_email_novo'
      )
    ),
  CONSTRAINT ck_desafios_autenticacao_hash_sha256
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT ck_desafios_autenticacao_status
    CHECK (status IN ('ativo', 'consumido', 'revogado', 'expirado')),
  CONSTRAINT ck_desafios_autenticacao_tentativas
    CHECK (
      maximo_tentativas BETWEEN 1 AND 20
      AND tentativas BETWEEN 0 AND maximo_tentativas
    ),
  CONSTRAINT ck_desafios_autenticacao_expiracao
    CHECK (expira_em > emitido_em),
  CONSTRAINT ck_desafios_autenticacao_ciclo_vida
    CHECK (
      (
        status = 'ativo'
        AND consumido_em IS NULL
        AND revogado_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'consumido'
        AND consumido_em IS NOT NULL
        AND revogado_em IS NULL
      )
      OR (
        status IN ('revogado', 'expirado')
        AND consumido_em IS NULL
        AND revogado_em IS NOT NULL
        AND motivo_encerramento IS NOT NULL
        AND char_length(btrim(motivo_encerramento)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_desafios_autenticacao_ativo_por_finalidade
  ON public.desafios_autenticacao (organizacao_id, usuario_id, finalidade)
  WHERE status = 'ativo';

CREATE INDEX ix_desafios_autenticacao_hash_consulta
  ON public.desafios_autenticacao (token_hash, expira_em);

CREATE TABLE public.autorizacoes_restritas (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  finalidade text NOT NULL,
  origem_tipo text NOT NULL,
  origem_id uuid NOT NULL,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  emitida_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  consumida_em timestamptz,
  revogada_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_autorizacoes_restritas_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_autorizacoes_restritas_hash
    UNIQUE (token_hash),
  CONSTRAINT fk_autorizacoes_restritas_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_autorizacoes_restritas_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_autorizacoes_restritas_finalidade
    CHECK (
      finalidade IN (
        'definir_senha_recuperacao',
        'concluir_recuperacao_assistida',
        'concluir_recuperacao_admin_secundario',
        'aceitar_convite',
        'confirmar_email'
      )
    ),
  CONSTRAINT ck_autorizacoes_restritas_origem_tipo
    CHECK (
      origem_tipo IN (
        'desafio',
        'convite',
        'recuperacao_assistida',
        'recuperacao_admin_secundario',
        'alteracao_email'
      )
    ),
  CONSTRAINT ck_autorizacoes_restritas_hash_sha256
    CHECK (octet_length(token_hash) = 32),
  CONSTRAINT ck_autorizacoes_restritas_status
    CHECK (status IN ('ativa', 'consumida', 'revogada', 'expirada')),
  CONSTRAINT ck_autorizacoes_restritas_expiracao
    CHECK (expira_em > emitida_em),
  CONSTRAINT ck_autorizacoes_restritas_ciclo_vida
    CHECK (
      (
        status = 'ativa'
        AND consumida_em IS NULL
        AND revogada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'consumida'
        AND consumida_em IS NOT NULL
        AND revogada_em IS NULL
      )
      OR (
        status IN ('revogada', 'expirada')
        AND consumida_em IS NULL
        AND revogada_em IS NOT NULL
        AND motivo_encerramento IS NOT NULL
        AND char_length(btrim(motivo_encerramento)) > 0
      )
    )
);

CREATE UNIQUE INDEX ux_autorizacoes_restritas_ativa_por_origem
  ON public.autorizacoes_restritas (
    organizacao_id,
    usuario_id,
    finalidade,
    origem_tipo,
    origem_id
  )
  WHERE status = 'ativa';

CREATE TABLE public.buckets_limite_autenticacao (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  escopo text NOT NULL,
  chave_hmac bytea NOT NULL,
  janela_iniciada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  falhas integer NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  ultima_falha_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_buckets_limite_autenticacao_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT uq_buckets_limite_autenticacao_chave
    UNIQUE (organizacao_id, escopo, chave_hmac),
  CONSTRAINT fk_buckets_limite_autenticacao_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_buckets_limite_autenticacao_escopo
    CHECK (escopo IN ('identificador', 'endereco_ip')),
  CONSTRAINT ck_buckets_limite_autenticacao_chave_hmac
    CHECK (octet_length(chave_hmac) = 32),
  CONSTRAINT ck_buckets_limite_autenticacao_falhas
    CHECK (falhas BETWEEN 0 AND 1000000),
  CONSTRAINT ck_buckets_limite_autenticacao_datas
    CHECK (
      (ultima_falha_em IS NULL OR ultima_falha_em >= janela_iniciada_em)
      AND (bloqueado_ate IS NULL OR bloqueado_ate >= janela_iniciada_em)
    )
);

CREATE INDEX ix_buckets_limite_autenticacao_bloqueio
  ON public.buckets_limite_autenticacao (bloqueado_ate)
  WHERE bloqueado_ate IS NOT NULL;

CREATE TABLE public.solicitacoes_alteracao_email (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organizacao_id text NOT NULL,
  usuario_id uuid NOT NULL,
  tipo_email text NOT NULL,
  email_novo text NOT NULL,
  email_anterior_hmac bytea,
  status text NOT NULL DEFAULT 'aguardando_confirmacao_atual',
  desafio_email_atual_id uuid NOT NULL,
  desafio_email_novo_id uuid,
  solicitada_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expira_em timestamptz NOT NULL,
  concluida_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento text,
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT uq_solicitacoes_alteracao_email_organizacao_id
    UNIQUE (organizacao_id, id),
  CONSTRAINT fk_solicitacoes_alteracao_email_organizacao
    FOREIGN KEY (organizacao_id)
    REFERENCES public.organizacoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_solicitacoes_alteracao_email_usuario_mesma_organizacao
    FOREIGN KEY (organizacao_id, usuario_id)
    REFERENCES public.usuarios (organizacao_id, id)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_solicitacoes_alteracao_email_desafio_atual
    FOREIGN KEY (organizacao_id, desafio_email_atual_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_solicitacoes_alteracao_email_desafio_novo
    FOREIGN KEY (organizacao_id, desafio_email_novo_id)
    REFERENCES public.desafios_autenticacao (organizacao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ck_solicitacoes_alteracao_email_tipo
    CHECK (tipo_email = 'principal'),
  CONSTRAINT ck_solicitacoes_alteracao_email_email_normalizado
    CHECK (
      email_novo = btrim(email_novo)
      AND position('@' IN email_novo) > 1
      AND position('@' IN email_novo) < char_length(email_novo)
    ),
  CONSTRAINT ck_solicitacoes_alteracao_email_hmac
    CHECK (email_anterior_hmac IS NULL OR octet_length(email_anterior_hmac) = 32),
  CONSTRAINT ck_solicitacoes_alteracao_email_desafios_distintos
    CHECK (
      desafio_email_novo_id IS NULL
      OR desafio_email_novo_id <> desafio_email_atual_id
    ),
  CONSTRAINT ck_solicitacoes_alteracao_email_status
    CHECK (
      status IN (
        'aguardando_confirmacao_atual',
        'aguardando_confirmacao_novo',
        'concluida',
        'cancelada',
        'expirada'
      )
    ),
  CONSTRAINT ck_solicitacoes_alteracao_email_expiracao
    CHECK (expira_em > solicitada_em),
  CONSTRAINT ck_solicitacoes_alteracao_email_ciclo_vida
    CHECK (
      (
        status = 'aguardando_confirmacao_atual'
        AND desafio_email_novo_id IS NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'aguardando_confirmacao_novo'
        AND desafio_email_novo_id IS NOT NULL
        AND concluida_em IS NULL
        AND encerrada_em IS NULL
        AND motivo_encerramento IS NULL
      )
      OR (
        status = 'concluida'
        AND desafio_email_novo_id IS NOT NULL
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

CREATE UNIQUE INDEX ux_solicitacoes_alteracao_email_ativa_usuario_tipo
  ON public.solicitacoes_alteracao_email (organizacao_id, usuario_id, tipo_email)
  WHERE status IN ('aguardando_confirmacao_atual', 'aguardando_confirmacao_novo');

CREATE UNIQUE INDEX ux_solicitacoes_alteracao_email_reserva
  ON public.solicitacoes_alteracao_email (organizacao_id, lower(email_novo))
  WHERE status IN ('aguardando_confirmacao_atual', 'aguardando_confirmacao_novo');

CREATE OR REPLACE FUNCTION public.tche_validar_emails_autenticacao()
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

CREATE FUNCTION public.tche_validar_alteracao_email_principal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.solicitacoes_alteracao_email AS solicitacao
    JOIN public.usuarios AS usuario
      ON usuario.organizacao_id = solicitacao.organizacao_id
     AND usuario.id = solicitacao.usuario_id
    LEFT JOIN public.desafios_autenticacao AS desafio_atual
      ON desafio_atual.organizacao_id = solicitacao.organizacao_id
     AND desafio_atual.id = solicitacao.desafio_email_atual_id
    LEFT JOIN public.desafios_autenticacao AS desafio_novo
      ON desafio_novo.organizacao_id = solicitacao.organizacao_id
     AND desafio_novo.id = solicitacao.desafio_email_novo_id
    WHERE solicitacao.status IN (
      'aguardando_confirmacao_atual',
      'aguardando_confirmacao_novo'
    )
      AND (
        usuario.status <> 'ativo'
        OR desafio_atual.id IS NULL
        OR desafio_atual.usuario_id <> solicitacao.usuario_id
        OR desafio_atual.finalidade <> 'confirmacao_email_atual'
        OR (
          solicitacao.status = 'aguardando_confirmacao_atual'
          AND desafio_atual.status <> 'ativo'
        )
        OR (
          solicitacao.status = 'aguardando_confirmacao_novo'
          AND (
            desafio_atual.status <> 'consumido'
            OR desafio_novo.id IS NULL
            OR desafio_novo.usuario_id <> solicitacao.usuario_id
            OR desafio_novo.finalidade <> 'confirmacao_email_novo'
            OR desafio_novo.status <> 'ativo'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Alteracao do email principal exige duas confirmacoes distintas.',
      CONSTRAINT = 'ct_solicitacoes_alteracao_email_dupla_confirmacao';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sessoes_autenticacao_atualizado_em
BEFORE UPDATE ON public.sessoes_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_sessoes_autenticacao_estado_terminal
BEFORE UPDATE ON public.sessoes_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal('revogada', 'expirada');

CREATE TRIGGER trg_tokens_acesso_estado_terminal
BEFORE UPDATE ON public.tokens_acesso
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal('revogado', 'expirado');

CREATE TRIGGER trg_tokens_refresh_estado_terminal
BEFORE UPDATE ON public.tokens_refresh
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'rotacionado',
  'revogado',
  'expirado'
);

CREATE TRIGGER trg_desafios_autenticacao_atualizado_em
BEFORE UPDATE ON public.desafios_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_desafios_autenticacao_estado_terminal
BEFORE UPDATE ON public.desafios_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'consumido',
  'revogado',
  'expirado'
);

CREATE TRIGGER trg_autorizacoes_restritas_atualizado_em
BEFORE UPDATE ON public.autorizacoes_restritas
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_autorizacoes_restritas_estado_terminal
BEFORE UPDATE ON public.autorizacoes_restritas
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'consumida',
  'revogada',
  'expirada'
);

CREATE TRIGGER trg_buckets_limite_autenticacao_atualizado_em
BEFORE UPDATE ON public.buckets_limite_autenticacao
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_solicitacoes_alteracao_email_atualizado_em
BEFORE UPDATE ON public.solicitacoes_alteracao_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_definir_atualizado_em();

CREATE TRIGGER trg_solicitacoes_alteracao_email_estado_terminal
BEFORE UPDATE ON public.solicitacoes_alteracao_email
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_reabertura_estado_terminal(
  'concluida',
  'cancelada',
  'expirada'
);

CREATE TRIGGER trg_solicitacoes_alteracao_email_serializar
BEFORE INSERT OR UPDATE OR DELETE ON public.solicitacoes_alteracao_email
FOR EACH STATEMENT
EXECUTE FUNCTION public.tche_serializar_invariantes_organizacao();

CREATE CONSTRAINT TRIGGER ct_validar_emails_em_solicitacoes
AFTER INSERT OR UPDATE OR DELETE ON public.solicitacoes_alteracao_email
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_emails_autenticacao();

CREATE CONSTRAINT TRIGGER ct_validar_alteracao_email_principal
AFTER INSERT OR UPDATE ON public.solicitacoes_alteracao_email
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_alteracao_email_principal();

CREATE CONSTRAINT TRIGGER ct_validar_alteracao_email_em_desafios
AFTER INSERT OR UPDATE OR DELETE ON public.desafios_autenticacao
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_alteracao_email_principal();

CREATE CONSTRAINT TRIGGER ct_validar_alteracao_email_em_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.tche_validar_alteracao_email_principal();

-- Down Migration

DROP TRIGGER IF EXISTS ct_validar_emails_em_solicitacoes
  ON public.solicitacoes_alteracao_email;
DROP TRIGGER IF EXISTS ct_validar_alteracao_email_em_desafios
  ON public.desafios_autenticacao;
DROP TRIGGER IF EXISTS ct_validar_alteracao_email_em_usuarios
  ON public.usuarios;

CREATE OR REPLACE FUNCTION public.tche_validar_emails_autenticacao()
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

DROP TABLE IF EXISTS public.solicitacoes_alteracao_email;
DROP FUNCTION IF EXISTS public.tche_validar_alteracao_email_principal();
DROP TABLE IF EXISTS public.buckets_limite_autenticacao;
DROP TABLE IF EXISTS public.autorizacoes_restritas;
DROP TABLE IF EXISTS public.desafios_autenticacao;
DROP TABLE IF EXISTS public.tokens_refresh;
DROP TABLE IF EXISTS public.tokens_acesso;
DROP TABLE IF EXISTS public.sessoes_autenticacao;
