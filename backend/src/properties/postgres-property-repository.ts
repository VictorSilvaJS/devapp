import type { QueryResultRow } from 'pg';

import {
  query,
  safeDatabaseRead,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import { serviceUnavailable } from '../security/http-error.js';
import type {
  ListPropertiesInput,
  PropertyAccessType,
  PropertyRepository,
  PropertyStatus,
  PropertyView,
} from './contracts.js';

interface PropertyRow extends QueryResultRow {
  id: string;
  organizacao_id: string;
  titular_id: string;
  titular_nome: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf_id: string;
  uf_sigla: string;
  area_total: string | number | null;
  cultura_principal: string | null;
  status: string;
  tipo_acesso: string;
}

const ACTOR_CTE = `
  WITH ator AS (
    SELECT usuario.id, usuario.organizacao_id, usuario.perfil,
           produtor.id AS produtor_id
    FROM public.usuarios AS usuario
    LEFT JOIN public.produtores AS produtor
      ON produtor.organizacao_id = usuario.organizacao_id
     AND produtor.usuario_id = usuario.id
     AND produtor.status = 'ativo'
    WHERE usuario.organizacao_id = $1
      AND usuario.id = $2
      AND usuario.perfil = $3
      AND usuario.status = 'ativo'
      AND usuario.versao_autorizacao = $4
  )
`;

const PROPERTY_PROJECTION = `
  SELECT propriedade.id, propriedade.organizacao_id,
         propriedade.titular_id, titular.nome AS titular_nome,
         propriedade.nome, propriedade.municipio_id,
         propriedade.municipio_nome, propriedade.uf_id,
         propriedade.uf_sigla, propriedade.area_total,
         propriedade.cultura_principal, propriedade.status,
         CASE ator.perfil
           WHEN 'admin' THEN 'admin'
           WHEN 'colaborador' THEN 'colaborador'
           WHEN 'produtor' THEN
             CASE
               WHEN propriedade.titular_id = ator.produtor_id THEN 'titular'
               ELSE 'usuario_autorizado'
             END
         END AS tipo_acesso
  FROM ator
  JOIN public.propriedades AS propriedade
    ON propriedade.organizacao_id = ator.organizacao_id
  JOIN public.produtores AS titular
    ON titular.organizacao_id = propriedade.organizacao_id
   AND titular.id = propriedade.titular_id
`;

const PROPERTY_SCOPE = `
  (
    ator.perfil = 'admin'
    OR (
      ator.perfil = 'produtor'
      AND ator.produtor_id IS NOT NULL
      AND propriedade.status = 'ativa'
      AND (
        propriedade.titular_id = ator.produtor_id
        OR EXISTS (
          SELECT 1
          FROM public.usuario_propriedade AS vinculo_produtor
          WHERE vinculo_produtor.organizacao_id = ator.organizacao_id
            AND vinculo_produtor.usuario_id = ator.id
            AND vinculo_produtor.propriedade_id = propriedade.id
            AND vinculo_produtor.tipo_vinculo = 'usuario_autorizado'
            AND vinculo_produtor.status = 'ativo'
        )
      )
    )
    OR (
      ator.perfil = 'colaborador'
      AND propriedade.status = 'ativa'
      AND EXISTS (
        SELECT 1
        FROM public.usuario_propriedade AS vinculo_colaborador
        WHERE vinculo_colaborador.organizacao_id = ator.organizacao_id
          AND vinculo_colaborador.usuario_id = ator.id
          AND vinculo_colaborador.propriedade_id = propriedade.id
          AND vinculo_colaborador.tipo_vinculo = 'colaborador'
          AND vinculo_colaborador.status = 'ativo'
      )
    )
  )
`;

function mapStatus(value: string): PropertyStatus {
  if (value !== 'ativa' && value !== 'inativa') throw serviceUnavailable();
  return value;
}

function mapAccessType(value: string): PropertyAccessType {
  if (
    value !== 'admin' &&
    value !== 'titular' &&
    value !== 'usuario_autorizado' &&
    value !== 'colaborador'
  ) {
    throw serviceUnavailable();
  }
  return value;
}

function mapArea(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw serviceUnavailable();
  return parsed;
}

function mapProperty(row: PropertyRow): PropertyView {
  return {
    id: row.id,
    organizationId: row.organizacao_id,
    holderId: row.titular_id,
    holder: { id: row.titular_id, name: row.titular_nome },
    name: row.nome,
    municipalityId: row.municipio_id,
    municipalityName: row.municipio_nome,
    stateId: row.uf_id,
    stateCode: row.uf_sigla,
    totalArea: mapArea(row.area_total),
    mainCrop: row.cultura_principal,
    status: mapStatus(row.status),
    accessType: mapAccessType(row.tipo_acesso),
  };
}

function escapeLikePattern(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

function commonParameters(input: {
  readonly principal: ListPropertiesInput['principal'];
}): unknown[] {
  return [
    input.principal.organizationId,
    input.principal.id,
    input.principal.profile,
    input.principal.authorizationVersion,
  ];
}

export class PostgresPropertyRepository implements PropertyRepository {
  readonly #pool: AuthPostgresPool;

  public constructor(pool: AuthPostgresPool) {
    this.#pool = pool;
  }

  public list(input: ListPropertiesInput): Promise<readonly PropertyView[]> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<PropertyRow>(
        client,
        `
          ${ACTOR_CTE}
          ${PROPERTY_PROJECTION}
          WHERE ${PROPERTY_SCOPE}
            AND ($5::text IS NULL OR propriedade.status = $5)
            AND (
              $6::text IS NULL
              OR lower(propriedade.uf_id) = lower($6)
              OR lower(propriedade.uf_sigla) = lower($6)
            )
            AND (
              $7::text IS NULL
              OR lower(propriedade.municipio_id) = lower($7)
              OR lower(propriedade.municipio_nome) = lower($7)
            )
            AND (
              $8::text IS NULL
              OR propriedade.nome ILIKE $8 ESCAPE E'\\\\'
              OR titular.nome ILIKE $8 ESCAPE E'\\\\'
              OR propriedade.municipio_nome ILIKE $8 ESCAPE E'\\\\'
            )
            AND (
              ($9::text IS NULL AND $10::uuid IS NULL)
              OR (propriedade.nome COLLATE "C", propriedade.id)
                 > ($9::text COLLATE "C", $10::uuid)
            )
          ORDER BY propriedade.nome COLLATE "C" ASC, propriedade.id ASC
          LIMIT $11
        `,
        [
          ...commonParameters(input),
          input.status ?? null,
          input.state ?? null,
          input.municipality ?? null,
          input.search === undefined ? null : escapeLikePattern(input.search),
          input.cursor?.name ?? null,
          input.cursor?.id ?? null,
          input.limit,
        ],
      );
      return result.rows.map(mapProperty);
    });
  }

  public findById(input: {
    readonly principal: ListPropertiesInput['principal'];
    readonly propertyId: string;
  }): Promise<PropertyView | null> {
    return safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<PropertyRow>(
        client,
        `
          ${ACTOR_CTE}
          ${PROPERTY_PROJECTION}
          WHERE propriedade.id = $5::uuid
            AND ${PROPERTY_SCOPE}
          LIMIT 1
        `,
        [...commonParameters(input), input.propertyId],
      );
      const row = result.rows[0];
      return row === undefined ? null : mapProperty(row);
    });
  }
}
