import type { QueryResultRow } from 'pg';

import type { AuthenticationPasswordCredentialService } from '../auth/password-credential.js';
import {
  query,
  safeDatabaseRead,
  type AuthPostgresPool,
} from '../auth/postgres-common.js';
import type { AccountSnapshot } from './contracts.js';
import type {
  PrimaryEmailChangeInspection,
  PrimaryEmailChangeRepository,
  PrimaryEmailPasswordVerifier,
} from './primary-email-service.js';
import {
  AccountActionPostgresStore,
  accountSnapshot,
  decodeSha256Hex,
  type AccountRow,
  type PostgresAccountActionOptions,
} from './postgres-common.js';
import type { SecondaryEmailRepository } from './secondary-email-service.js';

interface CredentialVerificationRow extends QueryResultRow {
  readonly senha_phc: string;
  readonly credential_version: string;
}

export class PostgresPrimaryEmailPasswordVerifier
  implements PrimaryEmailPasswordVerifier
{
  readonly #pool: AuthPostgresPool;
  readonly #passwordCredentials: AuthenticationPasswordCredentialService;

  public constructor(options: {
    readonly pool: AuthPostgresPool;
    readonly passwordCredentials: AuthenticationPasswordCredentialService;
  }) {
    this.#pool = options.pool;
    this.#passwordCredentials = options.passwordCredentials;
  }

  public async verifyCurrentPassword(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly password: string;
  }): Promise<{ readonly valid: boolean; readonly credentialVersion?: string }> {
    const credential = await safeDatabaseRead(this.#pool, async (client) => {
      const result = await query<CredentialVerificationRow>(
        client,
        `
          SELECT credencial.senha_phc,
                 credencial.xmin::text AS credential_version
          FROM public.usuarios AS usuario
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id
           AND credencial.status = 'ativa'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
            AND usuario.status = 'ativo'
        `,
        [input.organizationId, input.userId],
      );
      return result.rows[0] ?? null;
    });
    if (credential === null) return { valid: false };
    const verified = await this.#passwordCredentials.verify(
      input.password,
      credential.senha_phc,
    );
    return verified.valid
      ? { valid: true, credentialVersion: credential.credential_version }
      : { valid: false };
  }
}

interface PrimaryInspectionRow extends AccountRow {
  readonly challenge_id: string;
  readonly email_novo: string;
}

interface PrimaryLockedRow extends PrimaryInspectionRow {
  readonly request_id: string;
  readonly request_status: string;
  readonly challenge_status: string;
}

function primaryInspection(row: PrimaryInspectionRow): PrimaryEmailChangeInspection {
  return {
    challengeId: row.challenge_id,
    account: accountSnapshot(row),
    pendingNormalizedEmail: row.email_novo,
  };
}

export class PostgresPrimaryEmailChangeRepository
  implements PrimaryEmailChangeRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findActiveAccount(input: {
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

  public requestChangeAtomically(
    input: Parameters<PrimaryEmailChangeRepository['requestChangeAtomically']>[0],
  ): ReturnType<PrimaryEmailChangeRepository['requestChangeAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expectedAccount;
      if (!(await this.#store.lockOrganization(client, expected.organizationId))) {
        return 'concurrent_change';
      }
      const locked = await query<
        AccountRow & {
          readonly credential_version: string;
          readonly session_ok: boolean;
        }
      >(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 credencial.xmin::text AS credential_version,
                 EXISTS (
                   SELECT 1 FROM public.sessoes_autenticacao AS sessao
                   WHERE sessao.organizacao_id = usuario.organizacao_id
                     AND sessao.usuario_id = usuario.id AND sessao.id = $3
                     AND sessao.status = 'ativa'
                     AND sessao.versao_autorizacao = usuario.versao_autorizacao
                     AND sessao.expira_inatividade_em > pg_catalog.clock_timestamp()
                     AND sessao.expira_absolutamente_em > pg_catalog.clock_timestamp()
                 ) AS session_ok
          FROM public.usuarios AS usuario
          JOIN public.credenciais_usuario AS credencial
            ON credencial.organizacao_id = usuario.organizacao_id
           AND credencial.usuario_id = usuario.id AND credencial.status = 'ativa'
          WHERE usuario.organizacao_id = $1 AND usuario.id = $2
          FOR UPDATE OF credencial
        `,
        [expected.organizationId, expected.id, input.authenticatedSessionId],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.status !== 'ativo' ||
        !row.session_ok ||
        row.credential_version !== input.expectedCredentialVersion
      ) {
        return 'current_password_invalid';
      }
      if (row.version !== expected.version) return 'concurrent_change';

      const previous = await query<{
        readonly id: string;
        readonly desafio_email_atual_id: string;
        readonly desafio_email_novo_id: string | null;
      }>(
        client,
        `
          UPDATE public.solicitacoes_alteracao_email
          SET status = 'cancelada', encerrada_em = pg_catalog.clock_timestamp(),
              motivo_encerramento = 'solicitacao_substituida'
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND status IN ('aguardando_confirmacao_atual', 'aguardando_confirmacao_novo')
          RETURNING id, desafio_email_atual_id, desafio_email_novo_id
        `,
        [row.organizacao_id, row.id],
      );
      const oldChallengeIds = previous.rows.flatMap((candidate) => [
        candidate.desafio_email_atual_id,
        ...(candidate.desafio_email_novo_id === null
          ? []
          : [candidate.desafio_email_novo_id]),
      ]);
      if (oldChallengeIds.length > 0) {
        await query(
          client,
          `
            UPDATE public.desafios_autenticacao
            SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp(),
                motivo_encerramento = 'solicitacao_substituida'
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
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: input.pendingNormalizedEmail,
          excludeUserId: row.id,
        }))
      ) {
        return 'email_unavailable';
      }

      await this.#store.insertChallenge(client, input.challenge);
      const created = await query<{ id: string }>(
        client,
        `
          INSERT INTO public.solicitacoes_alteracao_email (
            organizacao_id, usuario_id, tipo_email, email_novo,
            email_anterior_hmac, desafio_email_atual_id, expira_em
          ) VALUES ($1, $2, 'principal', $3, $4, $5, $6)
          RETURNING id
        `,
        [
          row.organizacao_id,
          row.id,
          input.pendingNormalizedEmail,
          this.#store.emailHmac(row.email),
          input.challenge.id,
          input.challenge.expiresAt,
        ],
      );
      const requestId = created.rows[0]?.id;
      if (requestId === undefined) throw new Error('E-mail request insert failed.');
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: row.email,
        userId: row.id,
        originType: 'alteracao_email',
        originId: requestId,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'created';
    });
  }

  public inspectUsableCurrentAddressChallenge(
    input: Parameters<
      PrimaryEmailChangeRepository['inspectUsableCurrentAddressChallenge']
    >[0],
  ): ReturnType<
    PrimaryEmailChangeRepository['inspectUsableCurrentAddressChallenge']
  > {
    return this.#inspect(input.tokenSha256, input.now, {
      purpose: 'confirmacao_email_atual',
      requestStatus: 'aguardando_confirmacao_atual',
      challengeColumn: 'desafio_email_atual_id',
    });
  }

  public confirmCurrentAddressAtomically(
    input: Parameters<
      PrimaryEmailChangeRepository['confirmCurrentAddressAtomically']
    >[0],
  ): ReturnType<
    PrimaryEmailChangeRepository['confirmCurrentAddressAtomically']
  > {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(client, expected.account.organizationId);
      const locked = await query<PrimaryLockedRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 solicitacao.id AS request_id, solicitacao.status AS request_status,
                 solicitacao.email_novo,
                 desafio.id AS challenge_id, desafio.status AS challenge_status
          FROM public.solicitacoes_alteracao_email AS solicitacao
          JOIN public.desafios_autenticacao AS desafio
            ON desafio.organizacao_id = solicitacao.organizacao_id
           AND desafio.id = solicitacao.desafio_email_atual_id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = solicitacao.organizacao_id
           AND usuario.id = solicitacao.usuario_id
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'confirmacao_email_atual'
            AND desafio.expira_em > $2 AND solicitacao.expira_em > $2
          FOR UPDATE OF solicitacao, desafio
        `,
        [decodeSha256Hex(input.currentTokenSha256), input.confirmedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.challenge_id !== expected.challengeId ||
        row.request_status !== 'aguardando_confirmacao_atual' ||
        row.challenge_status !== 'ativo' ||
        row.status !== 'ativo'
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.account.version ||
        row.email_novo !== expected.pendingNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.email_novo,
          excludeUserId: row.id,
          excludeEmailChangeId: row.request_id,
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
      await this.#store.insertChallenge(client, input.newAddressChallenge);
      await query(
        client,
        `
          UPDATE public.solicitacoes_alteracao_email
          SET status = 'aguardando_confirmacao_novo',
              desafio_email_novo_id = $3, expira_em = $4
          WHERE organizacao_id = $1 AND id = $2
        `,
        [
          row.organizacao_id,
          row.request_id,
          input.newAddressChallenge.id,
          input.newAddressChallenge.expiresAt,
        ],
      );
      await this.#store.insertOutbox(client, {
        draft: input.newAddressOutbox,
        recipientEmail: row.email_novo,
        userId: row.id,
        originType: 'alteracao_email',
        originId: row.request_id,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'confirmed';
    });
  }

  public inspectUsableNewAddressChallenge(
    input: Parameters<
      PrimaryEmailChangeRepository['inspectUsableNewAddressChallenge']
    >[0],
  ): ReturnType<PrimaryEmailChangeRepository['inspectUsableNewAddressChallenge']> {
    return this.#inspect(input.tokenSha256, input.now, {
      purpose: 'confirmacao_email_novo',
      requestStatus: 'aguardando_confirmacao_novo',
      challengeColumn: 'desafio_email_novo_id',
    });
  }

  public confirmNewAddressAtomically(
    input: Parameters<
      PrimaryEmailChangeRepository['confirmNewAddressAtomically']
    >[0],
  ): ReturnType<PrimaryEmailChangeRepository['confirmNewAddressAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expected;
      await this.#store.lockOrganization(client, expected.account.organizationId);
      const locked = await query<PrimaryLockedRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 solicitacao.id AS request_id, solicitacao.status AS request_status,
                 solicitacao.email_novo,
                 desafio.id AS challenge_id, desafio.status AS challenge_status
          FROM public.solicitacoes_alteracao_email AS solicitacao
          JOIN public.desafios_autenticacao AS desafio
            ON desafio.organizacao_id = solicitacao.organizacao_id
           AND desafio.id = solicitacao.desafio_email_novo_id
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = solicitacao.organizacao_id
           AND usuario.id = solicitacao.usuario_id
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'confirmacao_email_novo'
            AND desafio.expira_em > $2 AND solicitacao.expira_em > $2
          FOR UPDATE OF solicitacao, desafio
        `,
        [decodeSha256Hex(input.tokenSha256), input.confirmedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.challenge_id !== expected.challengeId ||
        row.request_status !== 'aguardando_confirmacao_novo' ||
        row.challenge_status !== 'ativo' ||
        row.status !== 'ativo'
      ) {
        return 'invalid';
      }
      if (
        row.version !== expected.account.version ||
        row.email_novo !== expected.pendingNormalizedEmail
      ) {
        return 'concurrent_change';
      }
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: row.email_novo,
          excludeUserId: row.id,
          excludeEmailChangeId: row.request_id,
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
      await query(
        client,
        `
          UPDATE public.solicitacoes_alteracao_email
          SET status = 'concluida', concluida_em = $3
          WHERE organizacao_id = $1 AND id = $2
        `,
        [row.organizacao_id, row.request_id, input.confirmedAt],
      );
      await query(
        client,
        'SELECT public.tche_conta_concluir_alteracao_email_mp35b($1)',
        [row.request_id],
      );
      await this.#store.revokeAllUserSecurityState(client, {
        organizationId: row.organizacao_id,
        userId: row.id,
        reason: 'email_principal_alterado',
      });
      await this.#store.insertOutbox(client, {
        draft: input.oldAddressNotice,
        recipientEmail: row.email,
        userId: row.id,
        originType: 'alteracao_email',
        originId: row.request_id,
      });
      await this.#store.insertAudit(client, input.audit);
      await this.#store.insertAccountNotification(client, {
        organizationId: row.organizacao_id,
        recipientUserId: row.id,
        eventType: 'conta.email_principal_alterado.v1',
        sourceKey: input.audit.id,
        authorUserId: row.id,
      });
      return 'confirmed';
    });
  }

  #inspect(
    tokenSha256: string,
    now: Date,
    input: {
      readonly purpose: string;
      readonly requestStatus: string;
      readonly challengeColumn:
        | 'desafio_email_atual_id'
        | 'desafio_email_novo_id';
    },
  ): Promise<PrimaryEmailChangeInspection | null> {
    const challengeJoin =
      input.challengeColumn === 'desafio_email_atual_id'
        ? 'solicitacao.desafio_email_atual_id'
        : 'solicitacao.desafio_email_novo_id';
    return this.#store.read(async (client) => {
      const result = await query<PrimaryInspectionRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 desafio.id AS challenge_id, solicitacao.email_novo
          FROM public.solicitacoes_alteracao_email AS solicitacao
          JOIN public.desafios_autenticacao AS desafio
            ON desafio.organizacao_id = solicitacao.organizacao_id
           AND desafio.id = ${challengeJoin}
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = solicitacao.organizacao_id
           AND usuario.id = solicitacao.usuario_id
          WHERE desafio.token_hash = $1 AND desafio.finalidade = $3
            AND desafio.status = 'ativo' AND desafio.expira_em > $2
            AND solicitacao.status = $4 AND solicitacao.expira_em > $2
          LIMIT 1
        `,
        [decodeSha256Hex(tokenSha256), now, input.purpose, input.requestStatus],
      );
      const row = result.rows[0];
      return row === undefined ? null : primaryInspection(row);
    });
  }
}

interface SecondaryLockedRow extends AccountRow {
  readonly challenge_id: string;
  readonly challenge_status: string;
  readonly contact_id: string;
  readonly contact_email: string;
  readonly contact_status: string;
}

export class PostgresSecondaryEmailRepository
  implements SecondaryEmailRepository
{
  readonly #store: AccountActionPostgresStore;

  public constructor(options: PostgresAccountActionOptions) {
    this.#store = new AccountActionPostgresStore(options);
  }

  public findActiveAccount(input: {
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

  public requestVerificationAtomically(
    input: Parameters<
      SecondaryEmailRepository['requestVerificationAtomically']
    >[0],
  ): ReturnType<SecondaryEmailRepository['requestVerificationAtomically']> {
    return this.#store.transaction(async (client) => {
      const expected = input.expectedAccount;
      await this.#store.lockOrganization(client, expected.organizationId);
      const locked = await query<AccountRow>(
        client,
        `
          SELECT id, organizacao_id, nome, email, perfil, status,
                 xmin::text AS version
          FROM public.usuarios
          WHERE organizacao_id = $1 AND id = $2
        `,
        [expected.organizationId, expected.id],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.status !== 'ativo' ||
        row.perfil !== 'admin' ||
        row.version !== expected.version
      ) {
        return 'concurrent_change';
      }

      await query(
        client,
        `
          UPDATE public.contatos_email_usuario
          SET status = 'revogado', revogado_em = pg_catalog.clock_timestamp()
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND tipo = 'recuperacao' AND status = 'pendente'
        `,
        [row.organizacao_id, row.id],
      );
      await this.#store.revokeActiveChallenges(client, {
        organizationId: row.organizacao_id,
        userId: row.id,
        purposes: ['confirmacao_email_recuperacao'],
        reason: 'verificacao_substituida',
      });
      if (
        !(await this.#store.isEmailAvailable(client, {
          organizationId: row.organizacao_id,
          normalizedEmail: input.pendingNormalizedEmail,
        }))
      ) {
        return 'email_unavailable';
      }

      await query(
        client,
        `
          INSERT INTO public.contatos_email_usuario (
            organizacao_id, usuario_id, tipo, email, status
          ) VALUES ($1, $2, 'recuperacao', $3, 'pendente')
        `,
        [row.organizacao_id, row.id, input.pendingNormalizedEmail],
      );
      await this.#store.insertChallenge(client, input.challenge);
      await this.#store.insertOutbox(client, {
        draft: input.outbox,
        recipientEmail: input.pendingNormalizedEmail,
        userId: row.id,
        originType: 'desafio',
        originId: input.challenge.id,
      });
      await this.#store.insertAudit(client, input.audit);
      return 'created';
    });
  }

  public confirmVerificationAtomically(
    input: Parameters<
      SecondaryEmailRepository['confirmVerificationAtomically']
    >[0],
  ): ReturnType<SecondaryEmailRepository['confirmVerificationAtomically']> {
    return this.#store.transaction(async (client) => {
      const hash = decodeSha256Hex(input.tokenSha256);
      const located = await query<{ organizacao_id: string }>(
        client,
        `SELECT organizacao_id FROM public.desafios_autenticacao WHERE token_hash = $1`,
        [hash],
      );
      const organizationId = located.rows[0]?.organizacao_id;
      if (organizationId === undefined) return { status: 'invalid' };
      await this.#store.lockOrganization(client, organizationId);
      const locked = await query<SecondaryLockedRow>(
        client,
        `
          SELECT usuario.id, usuario.organizacao_id, usuario.nome, usuario.email,
                 usuario.perfil, usuario.status, usuario.xmin::text AS version,
                 desafio.id AS challenge_id, desafio.status AS challenge_status,
                 contato.id AS contact_id, contato.email AS contact_email,
                 contato.status AS contact_status
          FROM public.desafios_autenticacao AS desafio
          JOIN public.usuarios AS usuario
            ON usuario.organizacao_id = desafio.organizacao_id
           AND usuario.id = desafio.usuario_id
          JOIN public.contatos_email_usuario AS contato
            ON contato.organizacao_id = usuario.organizacao_id
           AND contato.usuario_id = usuario.id AND contato.tipo = 'recuperacao'
           AND contato.status = 'pendente'
          WHERE desafio.token_hash = $1
            AND desafio.finalidade = 'confirmacao_email_recuperacao'
            AND desafio.expira_em > $2
          FOR UPDATE OF desafio, contato
        `,
        [hash, input.confirmedAt],
      );
      const row = locked.rows[0];
      if (
        row === undefined ||
        row.challenge_status !== 'ativo' ||
        row.contact_status !== 'pendente' ||
        row.status !== 'ativo' ||
        row.perfil !== 'admin'
      ) {
        return { status: 'invalid' };
      }
      await query(
        client,
        `
          UPDATE public.contatos_email_usuario
          SET status = 'revogado', revogado_em = $3
          WHERE organizacao_id = $1 AND usuario_id = $2
            AND tipo = 'recuperacao' AND status = 'verificado'
        `,
        [row.organizacao_id, row.id, input.confirmedAt],
      );
      await query(
        client,
        `
          UPDATE public.contatos_email_usuario
          SET status = 'verificado', verificado_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'pendente'
        `,
        [row.organizacao_id, row.contact_id, input.confirmedAt],
      );
      await query(
        client,
        `
          UPDATE public.desafios_autenticacao
          SET status = 'consumido', consumido_em = $3
          WHERE organizacao_id = $1 AND id = $2 AND status = 'ativo'
        `,
        [row.organizacao_id, row.challenge_id, input.confirmedAt],
      );
      await this.#store.insertAudit(client, {
        id: input.auditId,
        organizationId: row.organizacao_id,
        eventType: 'auth.email_secundario.verificado',
        result: 'success',
        occurredAt: input.confirmedAt,
        affectedUserId: row.id,
        resourceType: 'contato_email',
        resourceId: row.contact_id,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });
      return { status: 'confirmed', userId: row.id };
    });
  }
}
