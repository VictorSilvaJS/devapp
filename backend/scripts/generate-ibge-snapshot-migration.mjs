import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [
  sourceArgument,
  targetArgument,
  snapshotArgument = 'ibge-localidades-2026-08-25',
  capturedOnArgument = '2026-08-25',
  expectedMunicipalityCountArgument = '5571',
] = process.argv.slice(2);
if (sourceArgument === undefined || targetArgument === undefined) {
  throw new Error(
    'Use generate-ibge-snapshot-migration.mjs <municipios.json> <migration.sql> [snapshot-id] [capturado-em] [quantidade-municipios].',
  );
}

const sourcePath = resolve(sourceArgument);
const targetPath = resolve(targetArgument);
const sourceUrl =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=id';
const snapshotId = snapshotArgument;
const capturedOn = capturedOnArgument;
const expectedMunicipalityCount = Number(expectedMunicipalityCountArgument);
if (!/^ibge-localidades-\d{4}-\d{2}-\d{2}$/u.test(snapshotId)) {
  throw new Error('O identificador do snapshot é inválido.');
}
if (!/^\d{4}-\d{2}-\d{2}$/u.test(capturedOn)) {
  throw new Error('A data de captura do snapshot é inválida.');
}
if (snapshotId !== `ibge-localidades-${capturedOn}`) {
  throw new Error('O identificador e a data de captura do snapshot divergem.');
}
if (!Number.isSafeInteger(expectedMunicipalityCount) || expectedMunicipalityCount <= 0) {
  throw new Error('A quantidade esperada de Municípios é inválida.');
}
const raw = await readFile(sourcePath, 'utf8');
const source = JSON.parse(raw);

if (!Array.isArray(source)) {
  throw new Error('O snapshot do IBGE deve ser um array.');
}

const municipalities = source.map((item) => {
  const state = item?.['regiao-imediata']?.['regiao-intermediaria']?.UF
    ?? item?.microrregiao?.mesorregiao?.UF;
  const id = String(item?.id ?? '');
  const name = item?.nome;
  const stateId = String(state?.id ?? '');
  const stateCode = state?.sigla;
  const stateName = state?.nome;

  if (
    !/^\d{7}$/u.test(id)
    || typeof name !== 'string'
    || name.length === 0
    || !/^\d{2}$/u.test(stateId)
    || !/^[A-Z]{2}$/u.test(stateCode)
    || typeof stateName !== 'string'
    || stateName.length === 0
  ) {
    throw new Error(`Município inválido no snapshot: ${JSON.stringify(item)}`);
  }

  return Object.freeze({ id, name, stateId, stateCode, stateName });
}).sort((left, right) => left.id.localeCompare(right.id));

if (municipalities.length !== expectedMunicipalityCount) {
  throw new Error(
    `O snapshot esperado possui ${expectedMunicipalityCount} municípios; recebido: ${municipalities.length}.`,
  );
}

if (new Set(municipalities.map((item) => item.id)).size !== municipalities.length) {
  throw new Error('O snapshot contém códigos de Município duplicados.');
}

const statesById = new Map();
for (const municipality of municipalities) {
  const previous = statesById.get(municipality.stateId);
  if (
    previous !== undefined
    && (previous.code !== municipality.stateCode
      || previous.name !== municipality.stateName)
  ) {
    throw new Error(
      `A UF ${municipality.stateId} possui metadados divergentes no snapshot.`,
    );
  }
  statesById.set(
    municipality.stateId,
    Object.freeze({
      id: municipality.stateId,
      code: municipality.stateCode,
      name: municipality.stateName,
    }),
  );
}
const states = [...statesById.values()]
  .sort((left, right) => left.id.localeCompare(right.id));

if (states.length !== 27) {
  throw new Error(`O snapshot esperado possui 27 UFs; recebido: ${states.length}.`);
}
if (new Set(states.map((state) => state.code)).size !== states.length) {
  throw new Error('O snapshot contém siglas de UF duplicadas.');
}

const canonicalSnapshot = JSON.stringify({ states, municipalities });
const snapshotSha256 = createHash('sha256')
  .update(canonicalSnapshot, 'utf8')
  .digest('hex');

function literal(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const stateValues = states
  .map((state) => `  (${literal(snapshotId)}, ${literal(state.id)}, ${literal(state.code)}, ${literal(state.name)})`)
  .join(',\n');
const municipalityValues = municipalities
  .map((municipality) => `  (${literal(snapshotId)}, ${literal(municipality.id)}, ${literal(municipality.name)}, ${literal(municipality.stateId)})`)
  .join(',\n');

const sql = `-- Up Migration

CREATE TABLE public.catalogo_localidades_ibge_versoes (
  id text PRIMARY KEY,
  fonte_url text NOT NULL,
  sha256 bytea NOT NULL,
  quantidade_ufs integer NOT NULL,
  quantidade_municipios integer NOT NULL,
  capturado_em date NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  criado_em timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT ck_catalogo_localidades_ibge_versao_id
    CHECK (id ~ '^ibge-localidades-[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT ck_catalogo_localidades_ibge_fonte
    CHECK (fonte_url = ${literal(sourceUrl)}),
  CONSTRAINT ck_catalogo_localidades_ibge_hash
    CHECK (pg_catalog.octet_length(sha256) = 32),
  CONSTRAINT ck_catalogo_localidades_ibge_quantidades
    CHECK (quantidade_ufs = 27 AND quantidade_municipios > 0),
  CONSTRAINT ck_catalogo_localidades_ibge_status
    CHECK (status IN ('ativo', 'substituido'))
);

CREATE UNIQUE INDEX ux_catalogo_localidades_ibge_ativo
  ON public.catalogo_localidades_ibge_versoes (status)
  WHERE status = 'ativo';

CREATE TABLE public.ufs_ibge (
  versao_id text NOT NULL,
  id text NOT NULL,
  sigla text NOT NULL,
  nome text NOT NULL,
  CONSTRAINT pk_ufs_ibge PRIMARY KEY (versao_id, id),
  CONSTRAINT uq_ufs_ibge_versao_sigla UNIQUE (versao_id, sigla),
  CONSTRAINT fk_ufs_ibge_versao
    FOREIGN KEY (versao_id)
    REFERENCES public.catalogo_localidades_ibge_versoes (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_ufs_ibge_id CHECK (id ~ '^[0-9]{2}$'),
  CONSTRAINT ck_ufs_ibge_sigla CHECK (sigla ~ '^[A-Z]{2}$'),
  CONSTRAINT ck_ufs_ibge_nome CHECK (char_length(nome) BETWEEN 1 AND 100)
);

CREATE TABLE public.municipios_ibge (
  versao_id text NOT NULL,
  id text NOT NULL,
  nome text NOT NULL,
  uf_id text NOT NULL,
  CONSTRAINT pk_municipios_ibge PRIMARY KEY (versao_id, id),
  CONSTRAINT uq_municipios_ibge_versao_id_uf UNIQUE (versao_id, id, uf_id),
  CONSTRAINT fk_municipios_ibge_uf
    FOREIGN KEY (versao_id, uf_id)
    REFERENCES public.ufs_ibge (versao_id, id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT ck_municipios_ibge_id CHECK (id ~ '^[0-9]{7}$'),
  CONSTRAINT ck_municipios_ibge_nome
    CHECK (char_length(nome) BETWEEN 1 AND 200)
);

INSERT INTO public.catalogo_localidades_ibge_versoes (
  id,
  fonte_url,
  sha256,
  quantidade_ufs,
  quantidade_municipios,
  capturado_em,
  status
) VALUES (
  ${literal(snapshotId)},
  ${literal(sourceUrl)},
  pg_catalog.decode(${literal(snapshotSha256)}, 'hex'),
  27,
  ${municipalities.length},
  DATE ${literal(capturedOn)},
  'ativo'
);

INSERT INTO public.ufs_ibge (versao_id, id, sigla, nome)
VALUES
${stateValues};

INSERT INTO public.municipios_ibge (versao_id, id, nome, uf_id)
VALUES
${municipalityValues};

DO $$
DECLARE
  total_ufs integer;
  total_municipios integer;
BEGIN
  SELECT count(*)::integer INTO total_ufs
  FROM public.ufs_ibge
  WHERE versao_id = ${literal(snapshotId)};

  SELECT count(*)::integer INTO total_municipios
  FROM public.municipios_ibge
  WHERE versao_id = ${literal(snapshotId)};

  IF total_ufs <> 27 OR total_municipios <> ${municipalities.length} THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Carga do snapshot IBGE diverge dos totais publicados.',
      CONSTRAINT = 'ck_catalogo_localidades_ibge_carga_completa';
  END IF;
END;
$$;

CREATE FUNCTION public.tche_impedir_mutacao_localidade_ibge_publicada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'Linhas de uma versao publicada do catalogo IBGE sao imutaveis.',
    CONSTRAINT = 'ct_catalogo_localidades_ibge_linha_imutavel';
END;
$$;

CREATE TRIGGER trg_ufs_ibge_impedir_mutacao
BEFORE UPDATE OR DELETE ON public.ufs_ibge
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_mutacao_localidade_ibge_publicada();

CREATE TRIGGER trg_municipios_ibge_impedir_mutacao
BEFORE UPDATE OR DELETE ON public.municipios_ibge
FOR EACH ROW
EXECUTE FUNCTION public.tche_impedir_mutacao_localidade_ibge_publicada();

CREATE FUNCTION public.tche_preservar_versao_localidades_ibge_publicada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'ativo'
     AND NEW.status = 'substituido'
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.fonte_url IS NOT DISTINCT FROM OLD.fonte_url
     AND NEW.sha256 IS NOT DISTINCT FROM OLD.sha256
     AND NEW.quantidade_ufs IS NOT DISTINCT FROM OLD.quantidade_ufs
     AND NEW.quantidade_municipios IS NOT DISTINCT FROM OLD.quantidade_municipios
     AND NEW.capturado_em IS NOT DISTINCT FROM OLD.capturado_em
     AND NEW.criado_em IS NOT DISTINCT FROM OLD.criado_em THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'Versao publicada do catalogo IBGE aceita apenas substituicao de estado.',
    CONSTRAINT = 'ct_catalogo_localidades_ibge_versao_imutavel';
END;
$$;

CREATE TRIGGER trg_catalogo_localidades_ibge_preservar_versao
BEFORE UPDATE OR DELETE ON public.catalogo_localidades_ibge_versoes
FOR EACH ROW
EXECUTE FUNCTION public.tche_preservar_versao_localidades_ibge_publicada();

ALTER TABLE public.propriedades
  ADD COLUMN localidades_versao_id text NOT NULL
    DEFAULT ${literal(snapshotId)},
  ADD CONSTRAINT fk_propriedades_municipio_ibge
    FOREIGN KEY (localidades_versao_id, municipio_id, uf_id)
    REFERENCES public.municipios_ibge (versao_id, id, uf_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.propriedades AS propriedade
    LEFT JOIN public.municipios_ibge AS municipio
      ON municipio.versao_id = propriedade.localidades_versao_id
     AND municipio.id = propriedade.municipio_id
     AND municipio.uf_id = propriedade.uf_id
    LEFT JOIN public.ufs_ibge AS uf
      ON uf.versao_id = municipio.versao_id
     AND uf.id = municipio.uf_id
    WHERE municipio.id IS NULL
       OR municipio.nome <> propriedade.municipio_nome
       OR uf.sigla <> propriedade.uf_sigla
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Propriedade existente possui localizacao divergente do snapshot IBGE.',
      CONSTRAINT = 'ck_propriedades_localizacao_ibge_existente';
  END IF;
END;
$$;

CREATE FUNCTION public.tche_derivar_localizacao_propriedade_ibge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  municipio_oficial text;
  sigla_oficial text;
BEGIN
  SELECT municipio.nome, uf.sigla
  INTO municipio_oficial, sigla_oficial
  FROM public.municipios_ibge AS municipio
  JOIN public.ufs_ibge AS uf
    ON uf.versao_id = municipio.versao_id
   AND uf.id = municipio.uf_id
  WHERE municipio.versao_id = NEW.localidades_versao_id
    AND municipio.id = NEW.municipio_id
    AND municipio.uf_id = NEW.uf_id;

  IF municipio_oficial IS NULL OR sigla_oficial IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Municipio e UF devem existir na mesma versao do catalogo IBGE.',
      CONSTRAINT = 'fk_propriedades_municipio_ibge';
  END IF;

  NEW.municipio_nome := municipio_oficial;
  NEW.uf_sigla := sigla_oficial;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propriedades_derivar_localizacao_ibge
BEFORE INSERT OR UPDATE OF localidades_versao_id, municipio_id,
  municipio_nome, uf_id, uf_sigla
ON public.propriedades
FOR EACH ROW
EXECUTE FUNCTION public.tche_derivar_localizacao_propriedade_ibge();

CREATE INDEX ix_municipios_ibge_lista
  ON public.municipios_ibge (versao_id, uf_id, lower(nome), id);

GRANT SELECT ON TABLE
  public.catalogo_localidades_ibge_versoes,
  public.ufs_ibge,
  public.municipios_ibge
TO tche_agro_runtime;

-- Down Migration

REVOKE SELECT ON TABLE
  public.catalogo_localidades_ibge_versoes,
  public.ufs_ibge,
  public.municipios_ibge
FROM tche_agro_runtime;

DROP TRIGGER IF EXISTS trg_catalogo_localidades_ibge_preservar_versao
  ON public.catalogo_localidades_ibge_versoes;
DROP FUNCTION IF EXISTS
  public.tche_preservar_versao_localidades_ibge_publicada();

DROP TRIGGER IF EXISTS trg_municipios_ibge_impedir_mutacao
  ON public.municipios_ibge;
DROP TRIGGER IF EXISTS trg_ufs_ibge_impedir_mutacao
  ON public.ufs_ibge;
DROP FUNCTION IF EXISTS public.tche_impedir_mutacao_localidade_ibge_publicada();

DROP TRIGGER IF EXISTS trg_propriedades_derivar_localizacao_ibge
  ON public.propriedades;
DROP FUNCTION IF EXISTS public.tche_derivar_localizacao_propriedade_ibge();

ALTER TABLE public.propriedades
  DROP CONSTRAINT fk_propriedades_municipio_ibge,
  DROP COLUMN localidades_versao_id;

DROP TABLE IF EXISTS public.municipios_ibge;
DROP TABLE IF EXISTS public.ufs_ibge;
DROP TABLE IF EXISTS public.catalogo_localidades_ibge_versoes;
`;

await writeFile(targetPath, sql, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(
  `Migration gerada: ${targetPath}\nSnapshot SHA-256: ${snapshotSha256}\n`,
);
