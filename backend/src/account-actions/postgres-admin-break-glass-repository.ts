import type { QueryResultRow } from 'pg';

import type {
  AdminBreakGlassRepository,
  AdminBreakGlassTarget,
} from './admin-break-glass-service.js';
import {
  AccountActionPostgresStore,
  accountSnapshot,
  decodeSha256Hex,
  type AccountRow,
  type PostgresAccountActionOptions,
} from './postgres-common.js';
import { query } from '../auth/postgres-common.js';

interface BreakGlassTargetRow extends AccountRow {
  readonly secondary_email: string | null;
}

interface BreakGlassChallengeRow extends QueryResultRow {
  readonly challenge_id: string;
  readonly recovery_id: string;
  readonly organizacao_id: string;
  readonly usuario_id: string;
}

interface BreakGlassRestrictedRow extends AccountRow {
  readonly authorization_id: string;
  readonly recovery_id: string;
  readonly current_email: string;
  readonly pending_email: string;
  readonly secondary_email: string | null;
}

function breakGlassTarget(row: BreakGlassTargetRow): AdminBreakGlassTarget {
  return {
    account: accountSnapshot(row),
    ...(row.secondary_email === null
      ? {}
      : { verifiedSecondaryEmail: row.secondary_email }),
  };
}

export class PostgresAdminBreakGlassRepository
  implements AdminBreakGlassRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findActiveAdminTarget(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AdminBreakGlassTarget | null> {
    return this.#store.read(async (client) => {
      const result = await query<BreakGlassTargetRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 contato.email AS secondary_email
          FROM public.usuarios AS usuario
          LEFT JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id
           AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
            AND usuario.perfil = 'admin' AND usuario.status = 'ativo'
        `,
        [input.organizationId, input.userId],
      );
      const row = result.rows[0];
      return row === undefined ? null : breakGlassTarget(row);
    });
  }

  public startAtomically(
    input: Parameters<AdminBreakGlassRepository['startAtomically']>[0],
  ): ReturnType<AdminBreakGlassRepository['startAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expectedTarget;
      if (!(await this.#store.lockOrganization(client, expected.account.organizationId))) {
        return 'target_unavailable';
      }
      const bootstrap = await query<{ status: string }>(
        client,
        `
          SELECT status FROM public.bootstrap_autenticacao
          WHERE organizacao_id = $1 FOR UPDATE
        `,
        [expected.account.organizationId],
      );
      if (bootstrap.rows[0]?.status !== 'concluido') {
        return 'bootstrap_not_sealed';
      }
      const locked = await query<BreakGlassTargetRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 contato.email AS secondary_email
          FROM public.usuarios AS usuario
          LEFT JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id
           AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
          FOR UPDATE OF usuario
        `,
        [expected.account.organizationId, expected.account.id],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.perfil !== 'admin' ||
        row.status !== 'ativo'
      ) {
        return 'target_unavailable';
      }
      if (
        row.version !== expected.account.version ||
        (row.secondary_email ?? undefined) !== expected.verifiedSecondaryEmail
      ) {
        return 'concurrent_change';
      }
      const authorization = input.verifiedAuthorization;
      if (
        authorization.organizationId !== row.organizacao_id ||
        authorization.targetUserId !== row.id ||
        authorization.pendingNormalizedEmail !==
          input.recovery.pendingNormalizedEmail ||
        authorization.externalCaseReference !==
          input.recovery.externalCaseReference ||
        authorization.authorizationId !==
          input.recovery.platformAuthorizationId ||
        authorization.policyVersion !== input.recovery.platformPolicyVersion ||
        authorization.expiresAt.getTime() <= input.recovery.requestedAt.getTime() ||
        JSON.stringify([...authorization.approverIds].sort()) !==
          JSON.stringify([...input.recovery.platformApproverIds].sort())
      ) {
        return 'concurrent_change';
      }
      const replay = await query<{ used: boolean }>(
        client,
        `
          SELECT EXISTS (
            SELECT 1 FROM public.recuperacoes_assistidas
            WHERE organizacao_id = $1 AND origem = 'plataforma_cli'
              AND autorizacao_plataforma_id = $2
          ) AS used
        `,
        [row.organizacao_id, authorization.authorizationId],
      );
      if (replay.rows[0]?.used === true) return 'concurrent_change';

      const previous = await query<{
        readonly desafio_email_id: string | null;
        readonly autorizacao_restrita_id: string | null;
      }>(
        client,
        `
          UPDATE public.recuperacoes_assistidas
          SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'break_glass_substituido'
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND status IN (
              'solicitada', 'em_validacao', 'aguardando_confirmacao_email',
              'aguardando_nova_senha'
            )
          RETURNING desafio_email_id, autorizacao_restrita_id
        `,
        [row.organizacao_id, row.id],
      );
      const oldChallenges = previous.rows.flatMap((candidate) =>
        candidate.desafio_email_id === null ? [] : [candidate.desafio_email_id],
      );
      if (oldChallenges.length > 0) {
        await query(
          client,
          `
            UPDATE public.desafios_autenticacao
            SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'break_glass_substituido'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativo'
          `,
          [row.organizacao_id, oldChallenges],
        );
        await this.#store.cancelOutboxForChallenges(
          client,
          row.organizacao_id,
          oldChallenges,
        );
      }
      const oldAuthorizations = previous.rows.flatMap((candidate) =>
        candidate.autorizacao_restrita_id === null
          ? []
          : [candidate.autorizacao_restrita_id],
      );
      if (oldAuthorizations.length > 0) {
        await query(
          client,
          `
            UPDATE public.autorizacoes_restritas
            SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'break_glass_substituido'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativa'
          `,
          [row.organizacao_id, oldAuthorizations],
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
            referencia_externa, autorizacao_plataforma_id,
            aprovadores_plataforma, versao_politica, aprovacoes_necessarias,
            status, desafio_email_id, solicitada_em, expira_em
          ) VALUES (
            $1, $2, $3, 'admin', 'plataforma_cli', NULL, $4,
            'admin_account_recovery', $5, $6, $7::jsonb, $8, 0,
            'aguardando_confirmacao_email', $9, $10, $11
          )
        `,
        [
          input.recovery.id,
          row.organizacao_id,
          row.id,
          input.recovery.pendingNormalizedEmail,
          input.recovery.externalCaseReference,
          input.recovery.platformAuthorizationId,
          JSON.stringify(input.recovery.platformApproverIds),
          input.recovery.platformPolicyVersion,
          input.challenge.id,
          input.recovery.requestedAt,
          input.recovery.expiresAt,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.actionEmail,
        recipientEmail: input.recovery.pendingNormalizedEmail,
        userId: row.id,
        originType: 'recuperacao_assistida',
        originId: input.recovery.id,
      });
      const noticeRecipients = [...new Set([
        row.email,
        ...(row.secondary_email === null ? [] : [row.secondary_email]),
      ])];
      if (noticeRecipients.length !== input.securityNotices.length) {
        throw new Error('Unexpected security notice count.');
      }
      for (const [index, notice] of input.securityNotices.entries()) {
        const recipient = noticeRecipients[index];
        if (recipient === undefined) throw new Error('Missing notice recipient.');
        await this.#store.insertOutbox(client, {
          draft: notice,
          recipientEmail: recipient,
          userId: row.id,
          originType: 'recuperacao_assistida',
          originId: input.recovery.id,
        });
      }
      await this.#store.insertAudit(client, input.audit, 'plataforma');
      return 'created';
    });
  }

  public inspectUsableEmailChallenge(
    input: Parameters<AdminBreakGlassRepository['inspectUsableEmailChallenge']>[0],
  ): ReturnType<AdminBreakGlassRepository['inspectUsableEmailChallenge']> {
    return this.#store.read(async (client) => {
      const result = await query<BreakGlassChallengeRow>(
        client,
        `
          SELECT desafio.id AS challenge_id, recuperacao.id AS recovery_id,
                 recuperacao.organizacao_id, recuperacao.usuario_id
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
            AND recuperacao.origem = 'plataforma_cli'
            AND recuperacao.status = 'aguardando_confirmacao_email'
            AND recuperacao.expira_em > $2
            AND usuario.perfil = 'admin' AND usuario.status = 'ativo'
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
          };
    });
  }

  public confirmEmailAtomically(
    input: Parameters<AdminBreakGlassRepository['confirmEmailAtomically']>[0],
  ): ReturnType<AdminBreakGlassRepository['confirmEmailAtomically']> {
    return this.#store.transaction(async (client) => {
      const authorization = input.restrictedAuthorization;
      await this.#store.lockOrganization(client, authorization.organizationId);
      const locked = await query<
        BreakGlassChallengeRow & {
          readonly challenge_status: string;
          readonly recovery_status: string;
          readonly user_status: string;
          readonly user_profile: string;
        }
      >(
        client,
        `
          SELECT desafio.id AS challenge_id, desafio.status AS challenge_status,
                 recuperacao.id AS recovery_id,
                 recuperacao.status AS recovery_status,
                 recuperacao.organizacao_id, recuperacao.usuario_id,
                 usuario.status AS user_status, usuario.perfil AS user_profile
          FROM public.desafios_autenticacao AS desafio
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = desafio.organizacao_id
           AND recuperacao.desafio_email_id = desafio.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'recuperacao_assistida'
            AND recuperacao.origem = 'plataforma_cli'
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
        row.user_profile !== 'admin'
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
      await this.#store.insertAudit(client, input.audit, 'sistema');
      return 'confirmed';
    });
  }

  public inspectRestrictedAuthorization(
    input: Parameters<
      AdminBreakGlassRepository['inspectRestrictedAuthorization']
    >[0],
  ): ReturnType<AdminBreakGlassRepository['inspectRestrictedAuthorization']> {
    return this.#store.read(async (client) => {
      const result = await query<BreakGlassRestrictedRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 autorizacao.id AS authorization_id,
                 recuperacao.id AS recovery_id,
                 usuario.email AS current_email,
                 recuperacao.novo_email AS pending_email,
                 contato.email AS secondary_email
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          LEFT JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id
           AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_assistida'
            AND autorizacao.origem_tipo = 'recuperacao_assistida'
            AND autorizacao.status = 'ativa' AND autorizacao.expira_em > $2
            AND recuperacao.origem = 'plataforma_cli'
            AND recuperacao.status = 'aguardando_nova_senha'
            AND recuperacao.expira_em > $2
          LIMIT 1
        `,
        [decodeSha256Hex(input.tokenSha256), input.now],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : {
            authorizationId: row.authorization_id,
            recoveryId: row.recovery_id,
            organizationId: row.organizacao_id,
            user: accountSnapshot(row),
            currentNormalizedEmail: row.current_email,
            pendingNormalizedEmail: row.pending_email,
            ...(row.secondary_email === null
              ? {}
              : { verifiedSecondaryEmail: row.secondary_email }),
          };
    });
  }

  public completeAtomically(
    input: Parameters<AdminBreakGlassRepository['completeAtomically']>[0],
  ): ReturnType<AdminBreakGlassRepository['completeAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(client, expected.organizationId);
      const locked = await query<
        BreakGlassRestrictedRow & {
          readonly authorization_status: string;
          readonly authorization_expires_at: Date;
          readonly recovery_status: string;
          readonly credential_id: string | null;
          readonly bootstrap_status: string;
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
                 recuperacao.id AS recovery_id,
                 recuperacao.status AS recovery_status,
                 recuperacao.novo_email AS pending_email,
                 contato.email AS secondary_email,
                 credencial.id AS credential_id,
                 bootstrap.status AS bootstrap_status
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_assistidas AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_id
          JOIN public.bootstrap_autenticacao AS bootstrap
            ON bootstrap.organizacao_id = recuperacao.organizacao_id
          LEFT JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id
           AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id AND credencial.status = 'ativa'
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_assistida'
            AND recuperacao.origem = 'plataforma_cli'
            AND autorizacao.expira_em > $2 AND recuperacao.expira_em > $2
          FOR UPDATE OF autorizacao, recuperacao, usuario, bootstrap
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
        row.bootstrap_status !== 'concluido' ||
        row.status !== 'ativo' ||
        row.perfil !== 'admin' ||
        row.credential_id === null
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.user.version ||
        row.current_email !== expected.currentNormalizedEmail ||
        row.pending_email !== expected.pendingNormalizedEmail ||
        (row.secondary_email ?? undefined) !== expected.verifiedSecondaryEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.pending_email,
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
        [row.organizacao_id, row.id, row.pending_email],
      );
      await this.#store.revokeAllUserSecurityState(client, {
        organizationId: row.organizacao_id,
        userId: row.id,
        reason: 'break_glass_concluido',
      });
      const recipients = [...new Set([
        row.current_email,
        ...(row.secondary_email === null ? [] : [row.secondary_email]),
      ])];
      if (recipients.length !== input.securityNotices.length) {
        throw new Error('Unexpected security notice count.');
      }
      for (const [index, notice] of input.securityNotices.entries()) {
        const recipient = recipients[index];
        if (recipient === undefined) throw new Error('Missing notice recipient.');
        await this.#store.insertOutbox(client, {
          draft: notice,
          recipientEmail: recipient,
          userId: row.id,
          originType: 'recuperacao_assistida',
          originId: row.recovery_id,
        });
      }
      await this.#store.insertAudit(client, input.audit, 'sistema');
      return 'completed';
    });
  }
}
