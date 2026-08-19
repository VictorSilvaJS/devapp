import type { QueryResultRow } from 'pg';

import type {
  AssistedRecoveryRepository,
  RecoveryEmailChallengeInspection,
  RestrictedRecoveryInspection,
} from './assisted-recovery-service.js';
import type { AccountSnapshot } from './contracts.js';
import {
  AccountActionPostgresStore,
  accountSnapshot,
  decodeSha256Hex,
  type AccountRow,
  type PostgresAccountActionOptions,
} from './postgres-common.js';
import { query } from '../auth/postgres-common.js';

interface RecoveryChallengeRow extends QueryResultRow {
  readonly challenge_id: string;
  readonly recovery_id: string;
  readonly organizacao_id: string;
  readonly usuario_id: string;
  readonly expira_em: Date;
}

interface RestrictedRecoveryRow extends AccountRow {
  readonly authorization_id: string;
  readonly recovery_id: string;
  readonly novo_email: string;
  readonly current_email: string;
}

export class PostgresAssistedRecoveryRepository
  implements AssistedRecoveryRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findRecoveryTarget(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null> {
    return this.#store.read(async (client) => {
      const result = await query<AccountRow>(
        client,
        `
          SELECT id, organizacao_id, nome, email, perfil, status,
                 xmin::text AS version
          FROM public.usuarios WHERE organizacao_id = $1 AND id = $2
        `,
        [input.organizationId, input.userId],
      );
      const row = result.rows[0];
      return row === undefined ? null : accountSnapshot(row);
    });
  }

  public startForNonAdminAtomically(
    input: Parameters<
      AssistedRecoveryRepository['startForNonAdminAtomically']
    >[0],
  ): ReturnType<AssistedRecoveryRepository['startForNonAdminAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expectedTarget;
      if (!(await this.#store.lockOrganization(client, expected.organizationId))) {
        return 'target_unavailable';
      }
      const locked = await query<AccountRow & { readonly actor_ok: boolean }>(
        client,
        `
          SELECT target.id, target.organizacao_id, target.nome, target.email,
                 target.perfil, target.status, target.xmin::text AS version,
                 EXISTS (
                   SELECT 1 FROM public.usuarios AS actor
                   WHERE actor.organizacao_id = target.organizacao_id
                     AND actor.id = $3 AND actor.perfil = 'admin'
                     AND actor.status = 'ativo'
                 ) AS actor_ok
          FROM public.usuarios AS target
          WHERE target.organizacao_id = $1 AND target.id = $2
          FOR UPDATE
        `,
        [expected.organizationId, expected.id, input.actorAdminUserId],
      );
      const row = locked.rows[0];
      if (row === undefined) return 'target_unavailable';
      if (!row.actor_ok) return 'actor_forbidden';
      if (
        row.status !== 'ativo' ||
        row.perfil === 'admin' ||
        row.perfil !== expected.profile
      ) {
        return 'target_unavailable';
      }
      if (row.version !== expected.version) return 'concurrent_change';

      const previous = await query<{
        readonly id: string;
        readonly desafio_email_id: string | null;
        readonly autorizacao_restrita_id: string | null;
      }>(
        client,
        `
          UPDATE public.recuperacoes_assistidas
          SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'recuperacao_substituida'
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND status IN (
              'solicitada', 'em_validacao', 'aguardando_confirmacao_email',
              'aguardando_nova_senha'
            )
          RETURNING id, desafio_email_id, autorizacao_restrita_id
        `,
        [row.organizacao_id, row.id],
      );
      const previousRecoveryIds = previous.rows.map((candidate) => candidate.id);
      if (previousRecoveryIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.aprovacoes_recuperacao_assistida
            SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp()
            WHERE organizacao_id = $1 AND recuperacao_id = ANY($2::uuid[])
              AND status = 'ativa'
          `,
          [row.organizacao_id, previousRecoveryIds],
        );
      }
      const oldChallengeIds = previous.rows.flatMap((candidate) =>
        candidate.desafio_email_id === null ? [] : [candidate.desafio_email_id],
      );
      if (oldChallengeIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.desafios_autenticacao
            SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'recuperacao_substituida'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativo'
          `,
          [row.organizacao_id, oldChallengeIds],
        );
        await this.#store.cancelOutboxForChallenges(
          client,
          row.organizacao_id,
          oldChallengeIds,
        );
      }
      const oldAuthorizationIds = previous.rows.flatMap((candidate) =>
        candidate.autorizacao_restrita_id === null
          ? []
          : [candidate.autorizacao_restrita_id],
      );
      if (oldAuthorizationIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.autorizacoes_restritas
            SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'recuperacao_substituida'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativa'
          `,
          [row.organizacao_id, oldAuthorizationIds],
        );
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: input.recovery.pendingNormalizedEmail,
          excludeUserId: row.id,
        }))
      ) {
        return 'email_unavailable';
      }

      await this.#store.insertChallenge(client, input.challenge);
      await query(
        client,
        `
          INSERT INTO public.recuperacoes_assistidas (
            id, organizacao_id, usuario_id, perfil_alvo, origem,
            solicitada_por_usuario_id, novo_email, categoria_motivo,
            referencia_externa, versao_politica, aprovacoes_necessarias,
            status, desafio_email_id, solicitada_em, expira_em
          ) VALUES (
            $1, $2, $3, $4, 'admin_http', $5, $6, $7, $8,
            'recuperacao-assistida-v1', 1, 'aguardando_confirmacao_email',
            $9, $10, $11
          )
        `,
        [
          input.recovery.id,
          row.organizacao_id,
          row.id,
          row.perfil,
          input.actorAdminUserId,
          input.recovery.pendingNormalizedEmail,
          input.recovery.reasonCode,
          input.recovery.externalCaseReference,
          input.challenge.id,
          input.recovery.requestedAt,
          input.recovery.expiresAt,
        ],
      );
      await query(
        client,
        `
          INSERT INTO public.aprovacoes_recuperacao_assistida (
            organizacao_id, recuperacao_id, administrador_id,
            status, categoria_decisao, aprovada_em
          ) VALUES ($1, $2, $3, 'ativa', 'identidade_validada', $4)
        `,
        [
          row.organizacao_id,
          input.recovery.id,
          input.actorAdminUserId,
          input.recovery.requestedAt,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: input.recovery.pendingNormalizedEmail,
        userId: row.id,
        originType: 'recuperacao_assistida',
        originId: input.recovery.id,
      });
      for (const audit of input.auditEvents) {
        await this.#store.insertAudit(client, audit);
      }
      return 'created';
    });
  }

  public inspectUsableEmailChallenge(
    input: Parameters<
      AssistedRecoveryRepository['inspectUsableEmailChallenge']
    >[0],
  ): ReturnType<AssistedRecoveryRepository['inspectUsableEmailChallenge']> {
    return this.#store.read(async (client) => {
      const result = await query<RecoveryChallengeRow>(
        client,
        `
          SELECT desafio.id AS challenge_id, recuperacao.id AS recovery_id,
                 recuperacao.organizacao_id, recuperacao.usuario_id,
                 recuperacao.expira_em
          FROM public.desafios_autenticacao AS desafio
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = desafio.organizacao_id
           AND recuperacao.desafio_email_id = desafio.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'recuperacao_assistida'
            AND desafio.status = 'ativo' AND desafio.expira_em > $2
            AND recuperacao.origem = 'admin_http'
            AND recuperacao.status = 'aguardando_confirmacao_email'
            AND recuperacao.expira_em > $2
            AND usuario.status = 'ativo'
            AND usuario.perfil IN ('produtor', 'colaborador')
          LIMIT 1
        `,
        [decodeSha256Hex(input.tokenSha256), input.now],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : {
            challengeId: row.challenge_id,
            recoveryId: row.recovery_id,
            organizationId: row.organizacao_id,
            userId: row.usuario_id,
            expiresAt: row.expira_em,
          };
    });
  }

  public confirmEmailAtomically(
    input: Parameters<AssistedRecoveryRepository['confirmEmailAtomically']>[0],
  ): ReturnType<AssistedRecoveryRepository['confirmEmailAtomically']> {
    return this.#store.transaction(async (client) => {
      const authorization = input.restrictedAuthorization;
      await this.#store.lockOrganization(client, authorization.organizationId);
      const locked = await query<
        RecoveryChallengeRow & {
          readonly challenge_status: string;
          readonly recovery_status: string;
          readonly user_status: string;
          readonly user_profile: string;
        }
      >(
        client,
        `
          SELECT desafio.id AS challenge_id, desafio.status AS challenge_status,
                 recuperacao.id AS recovery_id, recuperacao.status AS recovery_status,
                 recuperacao.organizacao_id, recuperacao.usuario_id,
                 recuperacao.expira_em, usuario.status AS user_status,
                 usuario.perfil AS user_profile
          FROM public.desafios_autenticacao AS desafio
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = desafio.organizacao_id
           AND recuperacao.desafio_email_id = desafio.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          WHERE desafio.token_hash = $1 AND recuperacao.origem = 'admin_http'
            AND desafio.finalidade = 'recuperacao_assistida'
            AND desafio.expira_em > $2 AND recuperacao.expira_em > $2
          FOR UPDATE OF desafio, recuperacao, usuario
        `,
        [decodeSha256Hex(input.tokenSha256), input.confirmedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.challenge_id !== input.expectedChallengeId ||
        row.recovery_id !== authorization.recoveryId ||
        row.organizacao_id !== authorization.organizationId ||
        row.usuario_id !== authorization.userId ||
        row.challenge_status !== 'ativo' ||
        row.recovery_status !== 'aguardando_confirmacao_email' ||
        row.user_status !== 'ativo' ||
        row.user_profile === 'admin'
      ) {
        return 'invalid';
      }
      await query(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'consumido', consumido_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.challenge_id, input.confirmedAt],
      );
      await this.#store.insertRestrictedAuthorization(client, authorization);
      await query(
        client,
        `
          UPDATE public.recuperacoes_assistidas
          SET status = 'aguardando_nova_senha', autorizacao_restrita_id = $3
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organizacao_id, row.recovery_id, authorization.id],
      );
      await this.#store.insertAudit(client, input.audit);
      return 'confirmed';
    });
  }

  public inspectRestrictedAuthorization(
    input: Parameters<
      AssistedRecoveryRepository['inspectRestrictedAuthorization']
    >[0],
  ): ReturnType<AssistedRecoveryRepository['inspectRestrictedAuthorization']> {
    return this.#store.read(async (client) => {
      const result = await query<RestrictedRecoveryRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 autorizacao.id AS authorization_id,
                 recuperacao.id AS recovery_id, recuperacao.novo_email,
                 usuario.email AS current_email
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_assistida'
            AND autorizacao.origem_tipo = 'recuperacao_assistida'
            AND autorizacao.status = 'ativa' AND autorizacao.expira_em > $2
            AND recuperacao.origem = 'admin_http'
            AND recuperacao.status = 'aguardando_nova_senha'
            AND recuperacao.expira_em > $2
          LIMIT 1
        `,
        [decodeSha256Hex(input.tokenSha256), input.now],
      );
      const row = result.rows[0];
      return row === undefined ? null : this.#restrictedInspection(row);
    });
  }

  public completeAtomically(
    input: Parameters<AssistedRecoveryRepository['completeAtomically']>[0],
  ): ReturnType<AssistedRecoveryRepository['completeAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(client, expected.organizationId);
      const locked = await query<
        RestrictedRecoveryRow & {
          readonly authorization_status: string;
          readonly authorization_expires_at: Date;
          readonly recovery_status: string;
          readonly credential_id: string | null;
        }
      >(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 usuario.email AS current_email,
                 autorizacao.id AS authorization_id,
                 autorizacao.status AS authorization_status,
                 autorizacao.expira_em AS authorization_expires_at,
                 recuperacao.id AS recovery_id, recuperacao.status AS recovery_status,
                 recuperacao.novo_email, credencial.id AS credential_id
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id AND credencial.status = 'ativa'
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_assistida'
            AND recuperacao.origem = 'admin_http'
            AND autorizacao.expira_em > $2 AND recuperacao.expira_em > $2
          FOR UPDATE OF autorizacao, recuperacao, usuario
        `,
        [decodeSha256Hex(input.restrictedTokenSha256), input.completedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.authorization_id !== expected.authorizationId ||
        row.recovery_id !== expected.recoveryId ||
        row.authorization_status !== 'ativa' ||
        row.authorization_expires_at.getTime() <= input.completedAt.getTime() ||
        row.recovery_status !== 'aguardando_nova_senha' ||
        row.status !== 'ativo' ||
        row.perfil === 'admin' ||
        row.credential_id === null
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.user.version ||
        row.novo_email !== expected.pendingNormalizedEmail ||
        row.current_email !== expected.currentNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.novo_email,
          excludeUserId: row.id,
          excludeAssistedRecoveryId: row.recovery_id,
        }))
      ) {
        return 'email_unavailable';
      }

      await query(
        client,
        `
          UPDATE public.autorizacoes_restritas
          SET status = 'consumida', consumida_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
        `,
        [row.organizacao_id, row.authorization_id, input.completedAt],
      );
      await query(
        client,
        `
          UPDATE public.recuperacoes_assistidas
          SET status = 'concluida', concluida_em = $3
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organizacao_id, row.recovery_id, input.completedAt],
      );
      await query(
        client,
        `
          UPDATE public.credenciais_usuario
          SET senha_phc = $3, versao_politica_senha = $4,
              senha_definida_em = $5, ultimo_rehash_em = NULL
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
        `,
        [
          row.organizacao_id,
          row.credential_id,
          input.passwordPhc,
          input.passwordPolicyVersion,
          input.completedAt,
        ],
      );
      await query(
        client,
        `
          UPDATE public.usuarios
          SET email = $3, versao_autorizacao = versao_autorizacao + 1
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organizacao_id, row.id, row.novo_email],
      );
      await this.#store.revokeAllUserSecurityState(client, {
        organizationId: row.organizacao_id,
        userId: row.id,
        reason: 'recuperacao_assistida_concluida',
      });
      await this.#store.insertOutbox(client, {
        draft: input.oldAddressNotice,
        recipientEmail: row.current_email,
        userId: row.id,
        originType: 'recuperacao_assistida',
        originId: row.recovery_id,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'completed';
    });
  }

  public cancelWithRestrictedAuthorizationAtomically(
    input: Parameters<
      AssistedRecoveryRepository['cancelWithRestrictedAuthorizationAtomically']
    >[0],
  ): ReturnType<
    AssistedRecoveryRepository['cancelWithRestrictedAuthorizationAtomically']
  > {
    return this.#store.transaction(async (client) => {
      const hash = decodeSha256Hex(input.restrictedTokenSha256);
      const located = await query<{ organizacao_id: string }>(
        client,
        `SELECT organizacao_id FROM public.autorizacoes_restritas WHERE token_hash = $1`,
        [hash],
      );
      const organizationId = located.rows[0]?.organizacao_id;
      if (organizationId === undefined) return 'invalid';
      await this.#store.lockOrganization(client, organizationId);
      const locked = await query<{
        readonly authorization_id: string;
        readonly recovery_id: string;
        readonly organization_id: string;
        readonly user_id: string;
      }>(
        client,
        `
          SELECT autorizacao.id AS authorization_id,
                 recuperacao.id AS recovery_id,
                 recuperacao.organizacao_id AS organization_id,
                 recuperacao.usuario_id AS user_id
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          WHERE autorizacao.token_hash = $1 AND autorizacao.status = 'ativa'
            AND autorizacao.finalidade = 'concluir_recuperacao_assistida'
            AND recuperacao.origem = 'admin_http'
            AND recuperacao.status = 'aguardando_nova_senha'
            AND autorizacao.expira_em > $2 AND recuperacao.expira_em > $2
          FOR UPDATE OF autorizacao, recuperacao
        `,
        [hash, input.cancelledAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.authorization_id !== input.expectedAuthorizationId
      ) {
        return 'invalid';
      }
      await query(
        client,
        `
          UPDATE public.autorizacoes_restritas
          SET status = 'consumida', consumida_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativa'
        `,
        [row.organization_id, row.authorization_id, input.cancelledAt],
      );
      await query(
        client,
        `
          UPDATE public.recuperacoes_assistidas
          SET status = 'cancelada', encerrada_em = $3,
              motivo_encerramento = 'cancelada_pelo_usuario'
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organization_id, row.recovery_id, input.cancelledAt],
      );
      await this.#store.insertAudit(client, input.audit);
      return 'cancelled';
    });
  }

  #restrictedInspection(row: RestrictedRecoveryRow): RestrictedRecoveryInspection {
    return {
      authorizationId: row.authorization_id,
      recoveryId: row.recovery_id,
      organizationId: row.organizacao_id,
      user: accountSnapshot(row),
      pendingNormalizedEmail: row.novo_email,
      currentNormalizedEmail: row.current_email,
    };
  }
}
