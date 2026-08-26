import type { QueryResultRow } from 'pg';

import type {
  InitialAdminBootstrapRepository,
  InitialAdminBootstrapState,
} from './bootstrap-service.js';
import type {
  AccountSnapshot,
} from './contracts.js';
import { invitationAcceptanceModeFromPersisted } from './contracts.js';
import type { InvitationIssueRepository } from './invitation-service.js';
import {
  AccountActionPostgresStore,
  accountSnapshot,
  decodeSha256Hex,
  type AccountRow,
  type PostgresAccountActionOptions,
} from './postgres-common.js';
import { query } from '../auth/postgres-common.js';

interface InvitationInspectionRow extends AccountRow {
  readonly challenge_id: string;
  readonly modo_ativacao: string;
}

interface LockedInvitationRow extends InvitationInspectionRow {
  readonly convite_id: string;
  readonly desafio_status: string;
  readonly convite_status: string;
  readonly credencial_id: string | null;
}

export class PostgresInvitationRepository
  implements InvitationIssueRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findPendingRecipient(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<AccountSnapshot | null> {
    return this.#store.read(async (client) => {
      const result = await query<AccountRow>(
        client,
        `
          SELECT id, organizacao_id, nome, email, perfil, status,
                 xmin::text AS version
          FROM public.usuarios
          WHERE organizacao_id = $1 AND id = $2
        `,
        [input.organizationId, input.userId],
      );
      const row = result.rows[0];
      return row === undefined ? null : accountSnapshot(row);
    });
  }

  public issueInvitationAtomically(
    input: Parameters<
      InvitationIssueRepository['issueInvitationAtomically']
    >[0],
  ): ReturnType<InvitationIssueRepository['issueInvitationAtomically']> {
    return this.#store.transaction(async (client) => {
      if (
        !(await this.#store.lockOrganization(
          client,
          input.expectedRecipient.organizationId,
        ))
      ) {
        return 'not_found';
      }
      const users = await query<AccountRow & { readonly actor_ok: boolean }>(
        client,
        `
          SELECT recipient.id, recipient.organizacao_id, recipient.nome,
                 recipient.email, recipient.perfil, recipient.status,
                 recipient.xmin::text AS version,
                 EXISTS (
                   SELECT 1 FROM public.usuarios AS actor
                   WHERE actor.organizacao_id = recipient.organizacao_id
                     AND actor.id = $3 AND actor.perfil = 'admin'
                     AND actor.status = 'ativo'
                 ) AS actor_ok
          FROM public.usuarios AS recipient
          WHERE recipient.organizacao_id = $1 AND recipient.id = $2
          FOR UPDATE
        `,
        [
          input.expectedRecipient.organizationId,
          input.expectedRecipient.id,
          input.actorAdminUserId,
        ],
      );
      const row = users.rows[0];
      if (row === undefined || !row.actor_ok) return 'not_found';
      if (row.status !== 'pendente') return 'not_pending';
      if (row.version !== input.expectedRecipient.version) {
        return 'concurrent_change';
      }

      const previous = await query<{ id: string; desafio_id: string }>(
        client,
        `
          UPDATE public.convites_usuario
          SET status = 'revogado', encerrado_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'convite_substituido'
          WHERE organizacao_id = $1 AND usuario_id = $2 AND status = 'pendente'
          RETURNING id, desafio_id
        `,
        [row.organizacao_id, row.id],
      );
      const previousChallengeIds = previous.rows.map(
        (candidate) => candidate.desafio_id,
      );
      if (previousChallengeIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.desafios_autenticacao
            SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'convite_substituido'
            WHERE organizacao_id = $1 AND id = ANY($2::uuid[])
              AND status = 'ativo'
          `,
          [row.organizacao_id, previousChallengeIds],
        );
        await this.#store.cancelOutboxForChallenges(
          client,
          row.organizacao_id,
          previousChallengeIds,
        );
      }

      await this.#store.insertChallenge(client, input.challenge);
      const invitation = await query<{ id: string }>(
        client,
        `
          INSERT INTO public.convites_usuario (
            organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
            criado_por_usuario_id, expira_em
          ) VALUES ($1, $2, $3, 'admin', 'ativar_usuario', $4, $5)
          RETURNING id
        `,
        [
          row.organizacao_id,
          row.id,
          input.challenge.id,
          input.actorAdminUserId,
          input.challenge.expiresAt,
        ],
      );
      const invitationId = invitation.rows[0]?.id;
      if (invitationId === undefined) throw new Error('Invitation insert failed.');
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: row.email,
        userId: row.id,
        originType: 'convite',
        originId: invitationId,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'issued';
    });
  }

  public inspectUsableInvitation(
    input: Parameters<
      InvitationIssueRepository['inspectUsableInvitation']
    >[0],
  ): ReturnType<InvitationIssueRepository['inspectUsableInvitation']> {
    return this.#store.read(async (client) => {
      const result = await query<InvitationInspectionRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 desafio.id AS challenge_id, convite.modo_ativacao
          FROM public.desafios_autenticacao AS desafio
          JOIN public.convites_usuario AS convite
            ON convite.organizacao_id = desafio.organizacao_id
           AND convite.desafio_id = desafio.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = convite.organizacao_id
           AND usuario.id = convite.usuario_id
          WHERE desafio.token_hash = $1 AND desafio.finalidade = 'convite'
            AND desafio.status = 'ativo' AND desafio.expira_em > $2
            AND convite.status = 'pendente' AND convite.expira_em > $2
          LIMIT 1
        `,
        [decodeSha256Hex(input.tokenSha256), input.now],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : {
            challengeId: row.challenge_id,
            recipient: accountSnapshot(row),
            activationMode: invitationAcceptanceModeFromPersisted(
              row.modo_ativacao,
            ),
          };
    });
  }

  public acceptInvitationAtomically(
    input: Parameters<
      InvitationIssueRepository['acceptInvitationAtomically']
    >[0],
  ): ReturnType<InvitationIssueRepository['acceptInvitationAtomically']> {
    return this.#store.transaction(async (client) => {
      const tokenHash = decodeSha256Hex(input.tokenSha256);
      const located = await query<{ organizacao_id: string }>(
        client,
        `
          SELECT organizacao_id FROM public.desafios_autenticacao
          WHERE token_hash = $1 AND finalidade = 'convite'
        `,
        [tokenHash],
      );
      const organizationId = located.rows[0]?.organizacao_id;
      if (
        organizationId === undefined ||
        !(await this.#store.lockOrganization(client, organizationId))
      ) {
        return 'invalid';
      }
      const locked = await query<LockedInvitationRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 desafio.id AS challenge_id, desafio.status AS desafio_status,
                 convite.id AS convite_id, convite.status AS convite_status,
                 convite.modo_ativacao, credencial.id AS credencial_id
          FROM public.desafios_autenticacao AS desafio
          JOIN public.convites_usuario AS convite
            ON convite.organizacao_id = desafio.organizacao_id
           AND convite.desafio_id = desafio.id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = convite.organizacao_id
           AND usuario.id = convite.usuario_id
          LEFT JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'convite'
            AND desafio.expira_em > $2 AND convite.expira_em > $2
          FOR UPDATE OF desafio, convite, usuario
        `,
        [tokenHash, input.acceptedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.challenge_id !== input.expectedChallengeId ||
        row.desafio_status !== 'ativo' ||
        row.convite_status !== 'pendente' ||
        row.credencial_id !== null
      ) {
        return 'invalid';
      }
      if (row.version !== input.expectedRecipientVersion) {
        return 'concurrent_change';
      }
      const mode = invitationAcceptanceModeFromPersisted(row.modo_ativacao);
      if (
        row.status !== 'pendente' ||
        (mode === 'activate_bootstrap_admin' && row.perfil !== 'admin')
      ) {
        return 'invalid';
      }

      await query(
        client,
        `
          INSERT INTO public.credenciais_usuario (
            organizacao_id, usuario_id, senha_phc, versao_politica_senha,
            senha_definida_em
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          row.organizacao_id,
          row.id,
          input.passwordPhc,
          input.passwordPolicyVersion,
          input.acceptedAt,
        ],
      );
      if (mode === 'activate_user' && row.perfil === 'produtor') {
        await query(
          client,
          'SELECT public.tche_ativar_produtor_por_convite_mp35a($1)',
          [row.convite_id],
        );
      }
      if (mode === 'activate_bootstrap_admin' || mode === 'activate_user') {
        await query(
          client,
          `
            UPDATE public.usuarios
            SET status = 'ativo', versao_autorizacao = versao_autorizacao + 1
            WHERE organizacao_id = $1 AND id = $2
          `,
          [row.organizacao_id, row.id],
        );
      }
      await query(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'consumido', consumido_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.challenge_id, input.acceptedAt],
      );
      await query(
        client,
        `
          UPDATE public.convites_usuario
          SET status = 'aceito', aceito_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'pendente'
        `,
        [row.organizacao_id, row.convite_id, input.acceptedAt],
      );
      if (mode === 'activate_bootstrap_admin') {
        await query(
          client,
          `
            UPDATE public.bootstrap_autenticacao
            SET status = 'concluido', concluido_em = $3
            WHERE organizacao_id = $1 AND usuario_admin_id = $2
              AND status = 'convite_pendente'
          `,
          [row.organizacao_id, row.id, input.acceptedAt],
        );
      }
      await this.#store.insertAudit(client, input.audit);
      return 'accepted';
    });
  }
}

interface BootstrapStateRow extends QueryResultRow {
  readonly bootstrap_status: 'disponivel' | 'convite_pendente' | 'concluido';
  readonly usuario_admin_id: string | null;
  readonly id: string | null;
  readonly organizacao_id: string | null;
  readonly nome: string | null;
  readonly email: string | null;
  readonly perfil: AccountRow['perfil'] | null;
  readonly status: AccountRow['status'] | null;
  readonly version: string | null;
}

function bootstrapState(row: BootstrapStateRow): InitialAdminBootstrapState {
  if (row.bootstrap_status === 'disponivel') return { state: 'uninitialized' };
  if (row.bootstrap_status === 'concluido') {
    if (row.usuario_admin_id === null) throw new Error('Invalid bootstrap state.');
    return { state: 'sealed', adminUserId: row.usuario_admin_id };
  }
  if (
    row.id === null ||
    row.organizacao_id === null ||
    row.nome === null ||
    row.email === null ||
    row.perfil === null ||
    row.status === null ||
    row.version === null
  ) {
    throw new Error('Invalid pending bootstrap state.');
  }
  return {
    state: 'pending',
    account: accountSnapshot({
      id: row.id,
      organizacao_id: row.organizacao_id,
      nome: row.nome,
      email: row.email,
      perfil: row.perfil,
      status: row.status,
      version: row.version,
    }),
  };
}

export class PostgresInitialAdminBootstrapRepository
  implements InitialAdminBootstrapRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public inspect(organizationId: string): Promise<InitialAdminBootstrapState> {
    return this.#store.read(async (client) => {
      const result = await query<BootstrapStateRow>(
        client,
        `
          SELECT bootstrap.status AS bootstrap_status,
                 bootstrap.usuario_admin_id,
                 usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version
          FROM public.bootstrap_autenticacao AS bootstrap
          LEFT JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = bootstrap.organizacao_id
           AND usuario.id = bootstrap.usuario_admin_id
          WHERE bootstrap.organizacao_id = $1
        `,
        [organizationId],
      );
      const row = result.rows[0];
      return row === undefined ? { state: 'uninitialized' } : bootstrapState(row);
    });
  }

  public initializeAtomically(
    input: Parameters<
      InitialAdminBootstrapRepository['initializeAtomically']
    >[0],
  ): ReturnType<InitialAdminBootstrapRepository['initializeAtomically']> {
    return this.#store.transaction(async (client) => {
      if (!(await this.#store.lockOrganization(client, input.admin.organizationId))) {
        return 'already_initialized';
      }
      const bootstrap = await query<{ status: string }>(
        client,
        `
          SELECT status FROM public.bootstrap_autenticacao
          WHERE organizacao_id = $1 FOR UPDATE
        `,
        [input.admin.organizationId],
      );
      if (bootstrap.rows[0]?.status !== 'disponivel') {
        return 'already_initialized';
      }
      const admins = await query<{ total: string }>(
        client,
        `
          SELECT count(*)::text AS total FROM public.usuarios
          WHERE organizacao_id = $1 AND perfil = 'admin'
        `,
        [input.admin.organizationId],
      );
      if (admins.rows[0]?.total !== '0') return 'already_initialized';
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: input.admin.organizationId,
          normalizedEmail: input.admin.normalizedEmail,
        }))
      ) {
        return 'already_initialized';
      }

      await query(
        client,
        `
          INSERT INTO public.usuarios (
            id, organizacao_id, nome, email, perfil, status
          ) VALUES ($1, $2, $3, $4, 'admin', 'pendente')
        `,
        [
          input.admin.id,
          input.admin.organizationId,
          input.admin.name,
          input.admin.normalizedEmail,
        ],
      );
      await this.#store.insertChallenge(client, input.challenge);
      const invitation = await query<{ id: string }>(
        client,
        `
          INSERT INTO public.convites_usuario (
            organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
            criado_por_usuario_id, expira_em
          ) VALUES (
            $1, $2, $3, 'bootstrap', 'ativar_admin_bootstrap', NULL, $4
          ) RETURNING id
        `,
        [
          input.admin.organizationId,
          input.admin.id,
          input.challenge.id,
          input.challenge.expiresAt,
        ],
      );
      const invitationId = invitation.rows[0]?.id;
      if (invitationId === undefined) throw new Error('Invitation insert failed.');
      await query(
        client,
        `
          UPDATE public.bootstrap_autenticacao
          SET status = 'convite_pendente', usuario_admin_id = $2,
              iniciado_em = $3, ultimo_convite_id = $4
          WHERE organizacao_id = $1 AND status = 'disponivel'
        `,
        [
          input.admin.organizationId,
          input.admin.id,
          input.audit.occurredAt,
          invitationId,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: input.admin.normalizedEmail,
        userId: input.admin.id,
        originType: 'convite',
        originId: invitationId,
      });
      await this.#store.insertAudit(client, input.audit, 'plataforma');
      return 'initialized';
    });
  }

  public correctPendingEmailAtomically(
    input: Parameters<
      InitialAdminBootstrapRepository['correctPendingEmailAtomically']
    >[0],
  ): ReturnType<
    InitialAdminBootstrapRepository['correctPendingEmailAtomically']
  > {
    return this.#store.transaction(async (client) => {
      if (
        !(await this.#store.lockOrganization(
          client,
          input.expectedPendingAdmin.organizationId,
        ))
      ) {
        return 'not_correctable';
      }
      const locked = await query<
        AccountRow & {
          readonly bootstrap_status: string;
          readonly convite_id: string | null;
          readonly desafio_id: string | null;
        }
      >(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 bootstrap.status AS bootstrap_status,
                 convite.id AS convite_id, convite.desafio_id
          FROM public.bootstrap_autenticacao AS bootstrap
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = bootstrap.organizacao_id
           AND usuario.id = bootstrap.usuario_admin_id
          LEFT JOIN public.convites_usuario AS convite
            ON convite.organizacao_id = bootstrap.organizacao_id
           AND convite.id = bootstrap.ultimo_convite_id
           AND convite.status = 'pendente'
          WHERE bootstrap.organizacao_id = $1
          FOR UPDATE OF bootstrap, usuario
        `,
        [input.expectedPendingAdmin.organizationId],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.bootstrap_status !== 'convite_pendente' ||
        row.status !== 'pendente' ||
        row.perfil !== 'admin' ||
        row.convite_id === null ||
        row.desafio_id === null
      ) {
        return 'not_correctable';
      }
      if (
        row.id !== input.expectedPendingAdmin.id ||
        row.version !== input.expectedPendingAdmin.version
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: input.newNormalizedEmail,
          excludeUserId: row.id,
        }))
      ) {
        return 'email_unavailable';
      }

      await query(
        client,
        `
          UPDATE public.convites_usuario
          SET status = 'revogado', encerrado_em = $3,
              motivo_encerramento = 'bootstrap_email_corrigido'
          WHERE organizacao_id = $1 AND id = $2 AND status = 'pendente'
        `,
        [row.organizacao_id, row.convite_id, input.audit.occurredAt],
      );
      await query(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'revogado', revogado_em = $3,
              motivo_encerramento = 'bootstrap_email_corrigido'
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.desafio_id, input.audit.occurredAt],
      );
      await this.#store.cancelOutboxForChallenges(
        client,
        row.organizacao_id,
        [row.desafio_id],
      );
      await query(
        client,
        `UPDATE public.usuarios SET email = $3 WHERE organizacao_id = $1 AND id = $2`,
        [row.organizacao_id, row.id, input.newNormalizedEmail],
      );
      await this.#store.insertChallenge(client, input.challenge);
      const invitation = await query<{ id: string }>(
        client,
        `
          INSERT INTO public.convites_usuario (
            organizacao_id, usuario_id, desafio_id, origem, modo_ativacao,
            criado_por_usuario_id, expira_em
          ) VALUES (
            $1, $2, $3, 'bootstrap', 'ativar_admin_bootstrap', NULL, $4
          ) RETURNING id
        `,
        [row.organizacao_id, row.id, input.challenge.id, input.challenge.expiresAt],
      );
      const invitationId = invitation.rows[0]?.id;
      if (invitationId === undefined) throw new Error('Invitation insert failed.');
      await query(
        client,
        `
          UPDATE public.bootstrap_autenticacao
          SET ultimo_convite_id = $2, corrigido_em = $3
          WHERE organizacao_id = $1 AND status = 'convite_pendente'
        `,
        [row.organizacao_id, invitationId, input.audit.occurredAt],
      );
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: input.newNormalizedEmail,
        userId: row.id,
        originType: 'convite',
        originId: invitationId,
      });
      await this.#store.insertAudit(client, input.audit, 'plataforma');
      return 'corrected';
    });
  }
}
