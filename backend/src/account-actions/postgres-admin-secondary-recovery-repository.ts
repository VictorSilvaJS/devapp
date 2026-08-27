import type { PoolClient, QueryResultRow } from 'pg';

import type {
  AdminSecondaryChallengeInspection,
  AdminSecondaryRecoveryRepository,
  AdminSecondaryRecoveryTarget,
  AdminSecondaryRestrictedInspection,
} from './admin-secondary-recovery-service.js';
import {
  AccountActionPostgresStore,
  accountSnapshot,
  decodeSha256Hex,
  type AccountRow,
  type PostgresAccountActionOptions,
} from './postgres-common.js';
import { query } from '../auth/postgres-common.js';

interface AdminSecondaryTargetRow extends AccountRow {
  readonly contact_id: string;
  readonly contact_email: string;
  readonly contact_version: string;
}

interface AdminSecondaryChallengeRow extends AdminSecondaryTargetRow {
  readonly challenge_id: string;
  readonly challenge_status: string;
  readonly recovery_id: string;
  readonly recovery_status: string;
  readonly novo_email: string;
}

interface AdminSecondaryRestrictedRow extends AccountRow {
  readonly authorization_id: string;
  readonly recovery_id: string;
  readonly current_email: string;
  readonly contact_email: string;
  readonly novo_email: string;
}

function targetFromRow(row: AdminSecondaryTargetRow): AdminSecondaryRecoveryTarget {
  return {
    account: accountSnapshot(row),
    verifiedSecondaryEmail: row.contact_email,
    secondaryEmailVersion: row.contact_version,
  };
}

function challengeInspection(
  row: AdminSecondaryChallengeRow,
): AdminSecondaryChallengeInspection {
  return {
    challengeId: row.challenge_id,
    recoveryId: row.recovery_id,
    target: targetFromRow(row),
    pendingNormalizedEmail: row.novo_email,
  };
}

export class PostgresAdminSecondaryRecoveryRepository
  implements AdminSecondaryRecoveryRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findActiveAdminByVerifiedSecondary(
    normalizedSecondaryEmail: string,
  ): Promise<AdminSecondaryRecoveryTarget | null> {
    return this.#store.read(async (client) => {
      const result = await query<AdminSecondaryTargetRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 contato.id AS contact_id, contato.email AS contact_email,
                 contato.xmin::text AS contact_version
          FROM public.contatos_email_usuario AS contato
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = contato.organizacao_id
           AND usuario.id = contato.usuario_id
          WHERE lower(contato.email) = lower($1)
            AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
            AND usuario.perfil = 'admin' AND usuario.status = 'ativo'
          LIMIT 1
        `,
        [normalizedSecondaryEmail],
      );
      const row = result.rows[0];
      return row === undefined ? null : targetFromRow(row);
    });
  }

  public startAtomically(
    input: Parameters<AdminSecondaryRecoveryRepository['startAtomically']>[0],
  ): ReturnType<AdminSecondaryRecoveryRepository['startAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expectedTarget;
      if (!(await this.#store.lockOrganization(client, expected.account.organizationId))) {
        return 'target_unavailable';
      }
      const locked = await query<AdminSecondaryTargetRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 contato.id AS contact_id, contato.email AS contact_email,
                 contato.xmin::text AS contact_version
          FROM public.usuarios AS usuario
          JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id
           AND contato.tipo = 'recuperacao' AND contato.status = 'verificado'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
          FOR UPDATE OF contato
        `,
        [expected.account.organizationId, expected.account.id],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.perfil !== 'admin' ||
        row.status !== 'ativo' ||
        row.contact_email !== expected.verifiedSecondaryEmail
      ) {
        return 'target_unavailable';
      }
      if (
        row.version !== expected.account.version ||
        row.contact_version !== expected.secondaryEmailVersion
      ) {
        return 'concurrent_change';
      }

      const previous = await query<{
        readonly id: string;
        readonly desafio_secundario_id: string;
        readonly desafio_email_novo_id: string | null;
        readonly autorizacao_restrita_id: string | null;
      }>(
        client,
        `
          UPDATE public.recuperacoes_admin_email_secundario
          SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'recuperacao_substituida'
          WHERE organizacao_id = $1 AND usuario_admin_id = $2
            AND status IN (
              'aguardando_confirmacao_secundario',
              'aguardando_confirmacao_email_novo', 'aguardando_nova_senha'
            )
          RETURNING id, desafio_secundario_id, desafio_email_novo_id,
                    autorizacao_restrita_id
        `,
        [row.organizacao_id, row.id],
      );
      const challengeIds = previous.rows.flatMap((candidate) => [
        candidate.desafio_secundario_id,
        ...(candidate.desafio_email_novo_id === null
          ? []
          : [candidate.desafio_email_novo_id]),
      ]);
      if (challengeIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.desafios_autenticacao
            SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'recuperacao_substituida'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativo'
          `,
          [row.organizacao_id, challengeIds],
        );
        await this.#store.cancelOutboxForChallenges(
          client,
          row.organizacao_id,
          challengeIds,
        );
      }
      const authorizationIds = previous.rows.flatMap((candidate) =>
        candidate.autorizacao_restrita_id === null
          ? []
          : [candidate.autorizacao_restrita_id],
      );
      if (authorizationIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.autorizacoes_restritas
            SET status = 'revogada', revogada_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'recuperacao_substituida'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[]) AND status = 'ativa'
          `,
          [row.organizacao_id, authorizationIds],
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

      await this.#store.insertChallenge(client, input.secondaryChallenge);
      await query(
        client,
        `
          INSERT INTO public.recuperacoes_admin_email_secundario (
            id, organizacao_id, usuario_admin_id, contato_secundario_id,
            novo_email, status, desafio_secundario_id, solicitada_em, expira_em
          ) VALUES (
            $1, $2, $3, $4, $5, 'aguardando_confirmacao_secundario',
            $6, $7, $8
          )
        `,
        [
          input.recovery.id,
          row.organizacao_id,
          row.id,
          row.contact_id,
          input.recovery.pendingNormalizedEmail,
          input.secondaryChallenge.id,
          input.recovery.requestedAt,
          input.recovery.expiresAt,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.secondaryActionEmail,
        recipientEmail: row.contact_email,
        userId: row.id,
        originType: 'recuperacao_admin_secundario',
        originId: input.recovery.id,
      });
      await this.#store.insertOutbox(client, {
        draft: input.currentAddressNotice,
        recipientEmail: row.email,
        userId: row.id,
        originType: 'recuperacao_admin_secundario',
        originId: input.recovery.id,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'created';
    });
  }

  public inspectUsableSecondaryChallenge(
    input: Parameters<
      AdminSecondaryRecoveryRepository['inspectUsableSecondaryChallenge']
    >[0],
  ): ReturnType<
    AdminSecondaryRecoveryRepository['inspectUsableSecondaryChallenge']
  > {
    return this.#inspectChallenge(input.tokenSha256, input.now, {
      purpose: 'recuperacao_admin_secundario',
      state: 'aguardando_confirmacao_secundario',
      challengeColumn: 'desafio_secundario_id',
    });
  }

  public confirmSecondaryAtomically(
    input: Parameters<
      AdminSecondaryRecoveryRepository['confirmSecondaryAtomically']
    >[0],
  ): ReturnType<
    AdminSecondaryRecoveryRepository['confirmSecondaryAtomically']
  > {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(
        client,
        expected.target.account.organizationId,
      );
      const row = await this.#lockChallenge(
        client,
        input.secondaryTokenSha256,
        'desafio_secundario_id',
        input.confirmedAt,
      );
      if (
        row === null ||
        row.challenge_id !== expected.challengeId ||
        row.recovery_id !== expected.recoveryId ||
        row.challenge_status !== 'ativo' ||
        row.recovery_status !== 'aguardando_confirmacao_secundario' ||
        row.status !== 'ativo' ||
        row.perfil !== 'admin'
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.target.account.version ||
        row.contact_version !== expected.target.secondaryEmailVersion ||
        row.contact_email !== expected.target.verifiedSecondaryEmail ||
        row.novo_email !== expected.pendingNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.novo_email,
          excludeUserId: row.id,
          excludeAdminSecondaryRecoveryId: row.recovery_id,
        }))
      ) {
        return 'email_unavailable';
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
      await this.#store.insertChallenge(client, input.newPrimaryChallenge);
      await query(
        client,
        `
          UPDATE public.recuperacoes_admin_email_secundario
          SET status = 'aguardando_confirmacao_email_novo',
              desafio_email_novo_id = $3, expira_em = $4
          WHERE organizacao_id = $1 AND id = $2
        `,
        [
          row.organizacao_id,
          row.recovery_id,
          input.newPrimaryChallenge.id,
          input.newPrimaryChallenge.expiresAt,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.newPrimaryActionEmail,
        recipientEmail: row.novo_email,
        userId: row.id,
        originType: 'recuperacao_admin_secundario',
        originId: row.recovery_id,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'confirmed';
    });
  }

  public inspectUsableNewPrimaryChallenge(
    input: Parameters<
      AdminSecondaryRecoveryRepository['inspectUsableNewPrimaryChallenge']
    >[0],
  ): ReturnType<
    AdminSecondaryRecoveryRepository['inspectUsableNewPrimaryChallenge']
  > {
    return this.#inspectChallenge(input.tokenSha256, input.now, {
      purpose: 'recuperacao_admin_email_novo',
      state: 'aguardando_confirmacao_email_novo',
      challengeColumn: 'desafio_email_novo_id',
    });
  }

  public confirmNewPrimaryAtomically(
    input: Parameters<
      AdminSecondaryRecoveryRepository['confirmNewPrimaryAtomically']
    >[0],
  ): ReturnType<
    AdminSecondaryRecoveryRepository['confirmNewPrimaryAtomically']
  > {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(
        client,
        expected.target.account.organizationId,
      );
      const row = await this.#lockChallenge(
        client,
        input.newPrimaryTokenSha256,
        'desafio_email_novo_id',
        input.confirmedAt,
      );
      if (
        row === null ||
        row.challenge_id !== expected.challengeId ||
        row.recovery_id !== expected.recoveryId ||
        row.challenge_status !== 'ativo' ||
        row.recovery_status !== 'aguardando_confirmacao_email_novo' ||
        row.status !== 'ativo' ||
        row.perfil !== 'admin'
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.target.account.version ||
        row.contact_version !== expected.target.secondaryEmailVersion ||
        row.novo_email !== expected.pendingNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.novo_email,
          excludeUserId: row.id,
          excludeAdminSecondaryRecoveryId: row.recovery_id,
        }))
      ) {
        return 'email_unavailable';
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
      await this.#store.insertRestrictedAuthorization(
        client,
        input.restrictedAuthorization,
      );
      await query(
        client,
        `
          UPDATE public.recuperacoes_admin_email_secundario
          SET status = 'aguardando_nova_senha', autorizacao_restrita_id = $3
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organizacao_id, row.recovery_id, input.restrictedAuthorization.id],
      );
      await this.#store.insertAudit(client, input.audit);
      return 'confirmed';
    });
  }

  public inspectRestrictedAuthorization(
    input: Parameters<
      AdminSecondaryRecoveryRepository['inspectRestrictedAuthorization']
    >[0],
  ): ReturnType<
    AdminSecondaryRecoveryRepository['inspectRestrictedAuthorization']
  > {
    return this.#store.read(async (client) => {
      const result = await query<AdminSecondaryRestrictedRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 autorizacao.id AS authorization_id,
                 recuperacao.id AS recovery_id, usuario.email AS current_email,
                 contato.email AS contact_email, recuperacao.novo_email
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_admin_email_secundario AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_admin_id
          JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = recuperacao.organizacao_id
           AND contato.id = recuperacao.contato_secundario_id
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_admin_secundario'
            AND autorizacao.origem_tipo = 'recuperacao_admin_secundario'
            AND autorizacao.status = 'ativa' AND autorizacao.expira_em > $2
            AND recuperacao.status = 'aguardando_nova_senha'
            AND recuperacao.expira_em > $2
            AND contato.status = 'verificado'
          LIMIT 1
        `,
        [decodeSha256Hex(input.tokenSha256), input.now],
      );
      const row = result.rows[0];
      return row === undefined ? null : this.#restricted(row);
    });
  }

  public completeAtomically(
    input: Parameters<AdminSecondaryRecoveryRepository['completeAtomically']>[0],
  ): ReturnType<AdminSecondaryRecoveryRepository['completeAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(client, expected.organizationId);
      const locked = await query<
        AdminSecondaryRestrictedRow & {
          readonly authorization_status: string;
          readonly authorization_expires_at: Date;
          readonly recovery_status: string;
          readonly contact_status: string;
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
                 recuperacao.novo_email, contato.email AS contact_email,
                 contato.status AS contact_status, credencial.id AS credential_id
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_admin_email_secundario AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_admin_id
          JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = recuperacao.organizacao_id
           AND contato.id = recuperacao.contato_secundario_id
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id AND credencial.status = 'ativa'
          WHERE autorizacao.token_hash = $1
            AND autorizacao.finalidade = 'concluir_recuperacao_admin_secundario'
            AND autorizacao.expira_em > $2 AND recuperacao.expira_em > $2
          FOR UPDATE OF autorizacao, recuperacao, contato
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
        row.perfil !== 'admin' ||
        row.contact_status !== 'verificado' ||
        row.credential_id === null
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.user.version ||
        row.current_email !== expected.currentNormalizedEmail ||
        row.contact_email !== expected.verifiedSecondaryEmail ||
        row.novo_email !== expected.pendingNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.novo_email,
          excludeUserId: row.id,
          excludeAdminSecondaryRecoveryId: row.recovery_id,
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
          UPDATE public.recuperacoes_admin_email_secundario
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
        'SELECT public.tche_conta_concluir_recuperacao_admin_mp35b($1)',
        [row.recovery_id],
      );
      await this.#store.revokeAllUserSecurityState(client, {
        organizationId: row.organizacao_id,
        userId: row.id,
        reason: 'recuperacao_admin_secundario_concluida',
      });
      const recipients = [...new Set([
        row.current_email,
        row.contact_email,
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
          originType: 'recuperacao_admin_secundario',
          originId: row.recovery_id,
        });
      }
      await this.#store.insertAudit(client, input.audit);
      await this.#store.insertAccountNotification(client, {
        organizationId: row.organizacao_id,
        recipientUserId: row.id,
        eventType: 'conta.recuperacao_concluida.v1',
        sourceKey: input.audit.id,
      });
      return 'completed';
    });
  }

  public cancelAtomically(
    input: Parameters<AdminSecondaryRecoveryRepository['cancelAtomically']>[0],
  ): ReturnType<AdminSecondaryRecoveryRepository['cancelAtomically']> {
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
      }>(
        client,
        `
          SELECT autorizacao.id AS authorization_id,
                 recuperacao.id AS recovery_id,
                 recuperacao.organizacao_id AS organization_id
          FROM public.autorizacoes_restritas AS autorizacao
          JOIN public.recuperacoes_admin_email_secundario AS recuperacao
            ON recuperacao.organizacao_id = autorizacao.organizacao_id
           AND recuperacao.id = autorizacao.origem_id
           AND recuperacao.autorizacao_restrita_id = autorizacao.id
          WHERE autorizacao.token_hash = $1 AND autorizacao.status = 'ativa'
            AND autorizacao.finalidade = 'concluir_recuperacao_admin_secundario'
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
          UPDATE public.recuperacoes_admin_email_secundario
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

  #inspectChallenge(
    tokenSha256: string,
    now: Date,
    input: {
      readonly purpose: string;
      readonly state: string;
      readonly challengeColumn:
        | 'desafio_secundario_id'
        | 'desafio_email_novo_id';
    },
  ): Promise<AdminSecondaryChallengeInspection | null> {
    const challengeJoin =
      input.challengeColumn === 'desafio_secundario_id'
        ? 'recuperacao.desafio_secundario_id'
        : 'recuperacao.desafio_email_novo_id';
    return this.#store.read(async (client) => {
      const result = await query<AdminSecondaryChallengeRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 contato.id AS contact_id, contato.email AS contact_email,
                 contato.xmin::text AS contact_version,
                 desafio.id AS challenge_id, desafio.status AS challenge_status,
                 recuperacao.id AS recovery_id,
                 recuperacao.status AS recovery_status, recuperacao.novo_email
          FROM public.recuperacoes_admin_email_secundario AS recuperacao
          JOIN public.desafios_autenticacao AS desafio
            ON desafio.organizacao_id = recuperacao.organizacao_id
           AND desafio.id = ${challengeJoin}
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = recuperacao.organizacao_id
           AND usuario.id = recuperacao.usuario_admin_id
          JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = recuperacao.organizacao_id
           AND contato.id = recuperacao.contato_secundario_id
          WHERE desafio.token_hash = $1 AND desafio.finalidade = $3
            AND desafio.status = 'ativo' AND desafio.expira_em > $2
            AND recuperacao.status = $4 AND recuperacao.expira_em > $2
            AND usuario.status = 'ativo' AND usuario.perfil = 'admin'
            AND contato.status = 'verificado'
          LIMIT 1
        `,
        [decodeSha256Hex(tokenSha256), now, input.purpose, input.state],
      );
      const row = result.rows[0];
      return row === undefined ? null : challengeInspection(row);
    });
  }

  async #lockChallenge(
    client: PoolClient,
    tokenSha256: string,
    challengeColumn: 'desafio_secundario_id' | 'desafio_email_novo_id',
    now: Date,
  ): Promise<AdminSecondaryChallengeRow | null> {
    const challengeJoin =
      challengeColumn === 'desafio_secundario_id'
        ? 'recuperacao.desafio_secundario_id'
        : 'recuperacao.desafio_email_novo_id';
    const result = await query<AdminSecondaryChallengeRow>(
      client,
      `
        SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
               usuario.perfil, usuario.status, usuario.xmin::text AS version,
               contato.id AS contact_id, contato.email AS contact_email,
               contato.xmin::text AS contact_version,
               desafio.id AS challenge_id, desafio.status AS challenge_status,
               recuperacao.id AS recovery_id,
               recuperacao.status AS recovery_status, recuperacao.novo_email
        FROM public.recuperacoes_admin_email_secundario AS recuperacao
        JOIN public.desafios_autenticacao AS desafio
          ON desafio.organizacao_id = recuperacao.organizacao_id
         AND desafio.id = ${challengeJoin}
        JOIN public.usuarios AS usuario
          ON usuario.organizacao_id = recuperacao.organizacao_id
         AND usuario.id = recuperacao.usuario_admin_id
        JOIN public.contatos_email_usuario AS contato
          ON contato.organizacao_id = recuperacao.organizacao_id
         AND contato.id = recuperacao.contato_secundario_id
        WHERE desafio.token_hash = $1
          AND desafio.expira_em > $2 AND recuperacao.expira_em > $2
        FOR UPDATE OF recuperacao, desafio, contato
      `,
      [decodeSha256Hex(tokenSha256), now],
    );
    return result.rows[0] ?? null;
  }

  #restricted(row: AdminSecondaryRestrictedRow): AdminSecondaryRestrictedInspection {
    return {
      authorizationId: row.authorization_id,
      recoveryId: row.recovery_id,
      organizationId: row.organizacao_id,
      user: accountSnapshot(row),
      currentNormalizedEmail: row.current_email,
      verifiedSecondaryEmail: row.contact_email,
      pendingNormalizedEmail: row.novo_email,
    };
  }
}
