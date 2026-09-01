import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import {
  inTransaction,
  query,
  safeDatabaseRead,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import {
  forbidden,
  serviceUnavailable,
  unauthorized,
  unprocessableEntity,
} from '../security/http-error.js';
import type {
  Mp35cCommandIdentity,
  Mp35cMutationResult,
  Mp35cRepository,
  MunicipalityView,
  PropertyRelationView,
  StateView,
} from './mp35c-contracts.js';
import { validateAdministrativeIdempotencyReceipt } from './validation.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60_000;
const MP35C_VALIDATION_CONSTRAINT = 'ck_mp35c_input_validation';

function isControlledMp35cValidation(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'code' in error && error.code === '22023'
    && 'constraint' in error && error.constraint === MP35C_VALIDATION_CONSTRAINT;
}

export async function executeMp35cMutationTransaction(
  pool: AuthPostgresPool,
  identity: Mp35cCommandIdentity,
  operation: (client: PoolClient) => Promise<
    Pick<QueryResult<Mp35cCommandRow>, 'rowCount' | 'rows'>
  >,
): Promise<Mp35cMutationResult> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await query(client, 'BEGIN');
    const result = decodeMp35cMutationQueryResult(await operation(client), identity);
    await query(client, 'COMMIT');
    return result;
  } catch (error) {
    if (client !== undefined) {
      try { await query(client, 'ROLLBACK'); }
      catch { throw serviceUnavailable(); }
    }
    if (isControlledMp35cValidation(error)) {
      throw unprocessableEntity(
        'A requisição contém valor semanticamente inválido.',
        'validation_error',
      );
    }
    throw serviceUnavailable();
  } finally {
    client?.release();
  }
}

interface ActorRow extends QueryResultRow { actor_state: string }
interface UserVersionRow extends QueryResultRow { versao: string | number }
interface RelationRow extends QueryResultRow {
  id: string; propriedade_id: string; propriedade_nome: string;
  propriedade_status: string; origem_acesso: string; tipo_vinculo: string;
  status_vinculo: string | null; editavel: boolean;
  versao_vinculo: string | number | null;
  motivo_codigo: string | null; motivo_detalhe: string | null;
  criado_em: Date | null; atualizado_em: Date | null; chave_ordenacao: string;
  ordem_relacao: string | number;
}
interface StateRow extends QueryResultRow { id: string; sigla: string; nome: string }
interface MunicipalityRow extends QueryResultRow {
  id: string; nome: string; uf_id: string; chave_ordenacao: string;
}
interface VersionRow extends QueryResultRow { versao_id: string }
export interface Mp35cCommandRow extends QueryResultRow {
  status: string; codigo_http: number | null; recibo: unknown | null;
}

const COMMON_FAILURE_STATUSES = [
  'invalid_session', 'forbidden', 'idempotency_conflict',
] as const;

const MP35C_SUCCESS_CONTRACT = Object.freeze({
  'propriedade.criar': {
    httpStatus: 201, outcome: 'criado', resourceType: 'propriedade',
    failureStatuses: [...COMMON_FAILURE_STATUSES, 'invalid_holder', 'invalid_municipality'],
  },
  'propriedade.atualizar': {
    httpStatus: 200, outcome: 'atualizado', resourceType: 'propriedade',
    failureStatuses: [
      ...COMMON_FAILURE_STATUSES, 'not_found', 'version_conflict',
      'invalid_municipality', 'business_rule_conflict',
    ],
  },
  'propriedade.alterar_status': {
    httpStatus: 200, outcome: 'status_alterado', resourceType: 'propriedade',
    failureStatuses: [
      ...COMMON_FAILURE_STATUSES, 'not_found', 'version_conflict',
      'business_rule_conflict', 'invalid_holder',
    ],
  },
  'usuario.alterar_vinculos': {
    httpStatus: 200, outcome: 'vinculos_alterados', resourceType: 'vinculo',
    failureStatuses: [
      ...COMMON_FAILURE_STATUSES, 'not_found', 'version_conflict',
      'business_rule_conflict',
    ],
  },
} as const);

const MP35C_FAILURE_STATUSES = [
  'invalid_session', 'forbidden', 'not_found', 'version_conflict',
  'idempotency_conflict', 'business_rule_conflict',
  'invalid_municipality', 'invalid_holder',
] as const;

type Mp35cFailureStatus = (typeof MP35C_FAILURE_STATUSES)[number];

function isMp35cFailureStatus(value: string): value is Mp35cFailureStatus {
  return MP35C_FAILURE_STATUSES.some((status) => status === value);
}

function isExactCommandRow(value: unknown): value is Mp35cCommandRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === 'codigo_http,recibo,status';
}

export function decodeMp35cMutationQueryResult(
  result: Pick<QueryResult<Mp35cCommandRow>, 'rowCount' | 'rows'>,
  identity: Mp35cCommandIdentity,
): Mp35cMutationResult {
  if (result.rowCount !== 1 || result.rows.length !== 1) throw serviceUnavailable();
  const row = result.rows[0];
  if (!isExactCommandRow(row) || typeof row.status !== 'string') throw serviceUnavailable();
  const contract = MP35C_SUCCESS_CONTRACT[identity.command];
  if (row.status !== 'completed' && row.status !== 'replayed') {
    if (!isMp35cFailureStatus(row.status)
      || !contract.failureStatuses.some((status) => status === row.status)
      || row.codigo_http !== null || row.recibo !== null) throw serviceUnavailable();
    return { status: row.status };
  }

  if (row.codigo_http !== contract.httpStatus || row.recibo === null) {
    throw serviceUnavailable();
  }
  const createdAt = new Date(0);
  const envelope = {
    command: identity.command,
    state: 'concluido' as const,
    sessionId: identity.sessionId,
    requestId: identity.requestId,
    correlationId: identity.correlationId,
    httpStatus: row.codigo_http,
    receipt: row.recibo,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + NINETY_DAYS_MS),
  };
  try { validateAdministrativeIdempotencyReceipt(envelope); }
  catch { throw serviceUnavailable(); }
  if (envelope.receipt.outcome !== contract.outcome
    || envelope.receipt.resourceType !== contract.resourceType) throw serviceUnavailable();
  return {
    status: row.status,
    httpStatus: contract.httpStatus,
    receipt: envelope.receipt,
  };
}

const ACTOR_STATE_SQL = `
  SELECT CASE
    WHEN usuario.id IS NULL OR usuario.status <> 'ativo'
      OR usuario.versao_autorizacao <> $3::bigint
      OR NOT EXISTS (
        SELECT 1 FROM public.sessoes_autenticacao AS sessao
        WHERE sessao.organizacao_id = $1 AND sessao.id = $4::uuid
          AND sessao.usuario_id = $2::uuid AND sessao.status = 'ativa'
          AND sessao.versao_autorizacao = usuario.versao_autorizacao
          AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
          AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
      ) THEN 'invalid_session'
    WHEN usuario.perfil <> 'admin' THEN 'forbidden'
    ELSE 'ok'
  END AS actor_state
  FROM (SELECT 1) AS base
  LEFT JOIN public.usuarios AS usuario
    ON usuario.organizacao_id = $1 AND usuario.id = $2::uuid
`;

function actorParameters(principal: {
  readonly organizationId: string; readonly id: string;
  readonly authorizationVersion: number; readonly sessionId: string;
}): readonly unknown[] {
  return [principal.organizationId, principal.id,
    principal.authorizationVersion, principal.sessionId];
}

function assertActorState(state: string): void {
  if (state === 'invalid_session') throw unauthorized();
  if (state === 'forbidden') throw forbidden();
  if (state !== 'ok') throw serviceUnavailable();
}

function positiveInteger(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw serviceUnavailable();
  return parsed;
}

function mapRelation(row: RelationRow): PropertyRelationView {
  if ((row.propriedade_status !== 'ativa' && row.propriedade_status !== 'inativa')
    || !['titularidade', 'vinculo_direto'].includes(row.origem_acesso)
    || !['titular', 'usuario_autorizado', 'colaborador'].includes(row.tipo_vinculo)
    || (row.status_vinculo !== null
      && row.status_vinculo !== 'ativo' && row.status_vinculo !== 'inativo')) {
    throw serviceUnavailable();
  }
  return {
    id: row.id,
    propertyId: row.propriedade_id,
    propertyName: row.propriedade_nome,
    propertyStatus: row.propriedade_status,
    accessOrigin: row.origem_acesso as PropertyRelationView['accessOrigin'],
    linkType: row.tipo_vinculo as PropertyRelationView['linkType'],
    linkStatus: row.status_vinculo as PropertyRelationView['linkStatus'],
    editable: row.editavel,
    linkVersion: row.versao_vinculo === null ? null : positiveInteger(row.versao_vinculo),
    reasonCode: row.motivo_codigo,
    reasonDetail: row.motivo_detalhe,
    createdAt: row.criado_em,
    updatedAt: row.atualizado_em,
    sortKey: row.chave_ordenacao,
    relationOrder: Number(row.ordem_relacao),
  };
}

function escapeLike(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

export class PostgresMp35cRepository implements Mp35cRepository {
  readonly #pool: AuthPostgresPool;

  public constructor(pool: AuthPostgresPool) { this.#pool = pool; }

  async #readActor(client: PoolClient, principal: Parameters<typeof actorParameters>[0]): Promise<string> {
    const result = await query<ActorRow>(client, ACTOR_STATE_SQL, [...actorParameters(principal)]);
    return result.rows[0]?.actor_state ?? 'invalid';
  }

  public async listUserProperties(input: Parameters<Mp35cRepository['listUserProperties']>[0]) {
    const result = await inTransaction(this.#pool, async (client) => {
      await query(client, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const actorState = await this.#readActor(client, input.principal);
      if (actorState !== 'ok') return { actorState, target: null, rows: [] as RelationRow[] };
      const target = await query<UserVersionRow>(client, `
        SELECT versao FROM public.usuarios
        WHERE organizacao_id = $1 AND id = $2::uuid
      `, [input.principal.organizationId, input.userId]);
      if (target.rows[0] === undefined) return { actorState, target: null, rows: [] as RelationRow[] };
      const rows = await query<RelationRow>(client, `
        WITH alvo AS (
          SELECT usuario.id, usuario.perfil, produtor.id AS produtor_id
          FROM public.usuarios AS usuario
          LEFT JOIN public.produtores AS produtor
            ON produtor.organizacao_id = usuario.organizacao_id
           AND produtor.usuario_id = usuario.id
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2::uuid
        ), relacoes AS (
          SELECT propriedade.id AS id, propriedade.id AS propriedade_id,
                 propriedade.nome AS propriedade_nome,
                 propriedade.status AS propriedade_status,
                 'titularidade'::text AS origem_acesso,
                 'titular'::text AS tipo_vinculo, NULL::text AS status_vinculo,
                 false AS editavel, NULL::bigint AS versao_vinculo,
                 NULL::text AS motivo_codigo, NULL::text AS motivo_detalhe,
                 NULL::timestamptz AS criado_em, NULL::timestamptz AS atualizado_em,
                 pg_catalog.lower(propriedade.nome) AS chave_ordenacao,
                 0::integer AS ordem_relacao
          FROM alvo JOIN public.propriedades AS propriedade
            ON propriedade.organizacao_id = $1
           AND alvo.perfil = 'produtor' AND propriedade.titular_id = alvo.produtor_id
          UNION ALL
          SELECT vinculo.id, propriedade.id, propriedade.nome, propriedade.status,
                 'vinculo_direto'::text, vinculo.tipo_vinculo,
                 vinculo.status, true, vinculo.versao,
                 vinculo.motivo_inativacao_codigo,
                 vinculo.motivo_inativacao_detalhe,
                 vinculo.criado_em, vinculo.atualizado_em,
                 pg_catalog.lower(propriedade.nome), 1::integer
          FROM alvo JOIN public.usuario_propriedade AS vinculo
            ON vinculo.organizacao_id = $1 AND vinculo.usuario_id = alvo.id
          JOIN public.propriedades AS propriedade
            ON propriedade.organizacao_id = vinculo.organizacao_id
           AND propriedade.id = vinculo.propriedade_id
        )
        SELECT * FROM relacoes
        WHERE ($3::text IS NULL OR tipo_vinculo = $3)
          AND ($4::text IS NULL OR status_vinculo = $4)
          AND ($5::text IS NULL OR propriedade_nome ILIKE $5 ESCAPE E'\\\\')
          AND (($6::text IS NULL AND $7::uuid IS NULL AND $8::integer IS NULL AND $9::uuid IS NULL)
            OR (chave_ordenacao COLLATE "C", propriedade_id, ordem_relacao, id)
              > ($6::text COLLATE "C", $7::uuid, $8::integer, $9::uuid))
        ORDER BY chave_ordenacao COLLATE "C", propriedade_id, ordem_relacao, id
        LIMIT $10
      `, [input.principal.organizationId, input.userId, input.accessType ?? null,
        input.linkStatus ?? null, input.search === undefined ? null : escapeLike(input.search),
        input.cursor?.sortKey ?? null, input.cursor?.propertyId ?? null,
        input.cursor?.relationOrder ?? null, input.cursor?.relationId ?? null, input.limit]);
      return { actorState, target: target.rows[0], rows: rows.rows };
    });
    assertActorState(result.actorState);
    if (result.target === null) return null;
    return { userVersion: positiveInteger(result.target.versao), items: result.rows.map(mapRelation) };
  }

  public async listStates(input: Parameters<Mp35cRepository['listStates']>[0]) {
    const result = await safeDatabaseRead(this.#pool, async (client) => {
      const actorState = await this.#readActor(client, input.principal);
      if (actorState !== 'ok') return { actorState, versionId: '', rows: [] as StateRow[] };
      const version = await query<VersionRow>(client, `
        SELECT id AS versao_id FROM public.catalogo_localidades_ibge_versoes
        WHERE status = 'ativo'
      `);
      const versionId = version.rows[0]?.versao_id;
      if (versionId === undefined) throw serviceUnavailable();
      const rows = await query<StateRow>(client, `
        SELECT id, sigla, nome FROM public.ufs_ibge
        WHERE versao_id = $1 ORDER BY nome COLLATE "C", id
      `, [versionId]);
      return { actorState, versionId, rows: rows.rows };
    });
    assertActorState(result.actorState);
    return { versionId: result.versionId,
      items: result.rows.map((row): StateView => ({ id: row.id, code: row.sigla, name: row.nome })) };
  }

  public async listMunicipalities(input: Parameters<Mp35cRepository['listMunicipalities']>[0]) {
    const result = await safeDatabaseRead(this.#pool, async (client) => {
      const actorState = await this.#readActor(client, input.principal);
      if (actorState !== 'ok') return { actorState, versionId: '', valid: false, rows: [] as MunicipalityRow[] };
      const version = input.versionId === undefined
        ? await query<VersionRow>(client, `SELECT id AS versao_id
            FROM public.catalogo_localidades_ibge_versoes WHERE status = 'ativo'`)
        : await query<VersionRow>(client, `SELECT id AS versao_id
            FROM public.catalogo_localidades_ibge_versoes WHERE id = $1`, [input.versionId]);
      const versionId = version.rows[0]?.versao_id;
      if (versionId === undefined) return { actorState, versionId: '', valid: false, rows: [] as MunicipalityRow[] };
      const state = await query(client, `SELECT 1 FROM public.ufs_ibge
        WHERE versao_id = $1 AND id = $2`, [versionId, input.stateId]);
      if (state.rows[0] === undefined) return { actorState, versionId, valid: false, rows: [] as MunicipalityRow[] };
      const rows = await query<MunicipalityRow>(client, `
        SELECT id, nome, uf_id, pg_catalog.lower(nome) AS chave_ordenacao
        FROM public.municipios_ibge
        WHERE versao_id = $1 AND uf_id = $2
          AND ($3::text IS NULL OR nome ILIKE $3 ESCAPE E'\\\\')
          AND (($4::text IS NULL AND $5::text IS NULL)
            OR (pg_catalog.lower(nome) COLLATE "C", id)
              > ($4::text COLLATE "C", $5::text))
        ORDER BY pg_catalog.lower(nome) COLLATE "C", id LIMIT $6
      `, [versionId, input.stateId,
        input.search === undefined ? null : escapeLike(input.search),
        input.cursor?.sortKey ?? null, input.cursor?.id ?? null, input.limit]);
      return { actorState, versionId, valid: true, rows: rows.rows };
    });
    assertActorState(result.actorState);
    if (!result.valid) return null;
    return { versionId: result.versionId,
      items: result.rows.map((row): MunicipalityView => ({
        id: row.id, name: row.nome, stateId: row.uf_id, sortKey: row.chave_ordenacao,
      })) };
  }

  #basePayload(identity: Mp35cCommandIdentity) {
    return {
      sessao_id: identity.sessionId,
      request_id: identity.requestId,
      correlation_id: identity.correlationId,
      chave_idempotencia_hash: identity.idempotencyKeyHash.toString('hex'),
      hash_requisicao: identity.requestHash.toString('hex'),
    };
  }

  async #call(functionName: string, identity: Mp35cCommandIdentity,
    payload: Readonly<Record<string, unknown>>): Promise<Mp35cMutationResult> {
    return executeMp35cMutationTransaction(this.#pool, identity, async (client) =>
      query<Mp35cCommandRow>(client,
        `SELECT status, codigo_http, recibo FROM public.${functionName}($1::jsonb)`,
        [JSON.stringify(payload)]));
  }

  public createProperty(input: Parameters<Mp35cRepository['createProperty']>[0]) {
    return this.#call('tche_admin_criar_propriedade_mp35c', input.identity, {
      ...this.#basePayload(input.identity), nome: input.name,
      titular_id: input.holderId, municipio_id: input.municipalityId,
      ...(input.totalArea === undefined ? {} : { area_total: input.totalArea }),
      ...(input.mainCrop === undefined ? {} : { cultura_principal: input.mainCrop }),
      status: input.status,
    });
  }

  public updateProperty(input: Parameters<Mp35cRepository['updateProperty']>[0]) {
    return this.#call('tche_admin_atualizar_propriedade_mp35c', input.identity, {
      ...this.#basePayload(input.identity), propriedade_id: input.propertyId,
      versao: input.expectedVersion,
      patch: { ...(input.name === undefined ? {} : { nome: input.name }),
        ...(input.municipalityId === undefined ? {} : { municipio_id: input.municipalityId }),
        ...(input.totalArea === undefined ? {} : { area_total: input.totalArea }),
        ...(input.mainCrop === undefined ? {} : { cultura_principal: input.mainCrop }) },
    });
  }

  public changePropertyStatus(input: Parameters<Mp35cRepository['changePropertyStatus']>[0]) {
    return this.#call('tche_admin_alterar_status_propriedade_mp35c', input.identity, {
      ...this.#basePayload(input.identity), propriedade_id: input.propertyId,
      versao: input.expectedVersion, status: input.status,
      motivo: input.reason.code,
      ...(input.reason.detail === undefined ? {} : { motivo_detalhe: input.reason.detail }),
    });
  }

  public applyUserPropertyDelta(input: Parameters<Mp35cRepository['applyUserPropertyDelta']>[0]) {
    return this.#call('tche_admin_alterar_vinculos_usuario_mp35c', input.identity, {
      ...this.#basePayload(input.identity), usuario_id: input.userId,
      versao: input.expectedVersion, adicionar: input.add, remover: input.remove,
      motivo: input.reason.code,
      ...(input.reason.detail === undefined ? {} : { motivo_detalhe: input.reason.detail }),
    });
  }
}
