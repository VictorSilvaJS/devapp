import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import type { AuthenticationService } from '../auth/service.js';
import { bearerTokenFromAuthorizationHeader } from '../auth/service.js';
import { InvalidEmailError } from '../auth/normalization.js';
import { PasswordHashingCapacityError } from '../auth/password-hasher.js';
import { PasswordPolicyError } from '../auth/password-policy.js';
import {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  httpErrorBody,
  invalidOrExpiredChallenge,
  notFound,
  rateLimited,
  serviceUnavailable,
  unauthorized,
  unprocessable,
} from '../security/http-error.js';
import type { AssistedRecoveryService } from './assisted-recovery-service.js';
import type { AdminBreakGlassContinuationService } from './admin-break-glass-service.js';
import type { AdminSecondaryRecoveryService } from './admin-secondary-recovery-service.js';
import { AccountActionError } from './errors.js';
import type { InvitationService } from './invitation-service.js';
import type { PrimaryEmailChangeService } from './primary-email-service.js';
import type { SecondaryEmailService } from './secondary-email-service.js';

export interface AccountActionRoutesOptions {
  readonly authenticationService: Pick<AuthenticationService, 'authenticate'>;
  readonly invitationService: Pick<
    InvitationService,
    'issueForExistingPendingUser' | 'accept'
  >;
  readonly primaryEmailService: Pick<
    PrimaryEmailChangeService,
    'request' | 'confirmCurrentAddress' | 'confirmNewAddress'
  >;
  readonly secondaryEmailService: Pick<
    SecondaryEmailService,
    'requestVerification' | 'confirm'
  >;
  readonly adminSecondaryRecoveryService: Pick<
    AdminSecondaryRecoveryService,
    | 'request'
    | 'confirmSecondaryAddress'
    | 'confirmNewPrimaryAddress'
    | 'complete'
    | 'cancel'
  >;
  readonly adminBreakGlassContinuationService: Pick<
    AdminBreakGlassContinuationService,
    'confirmNewEmail' | 'complete'
  >;
  readonly assistedRecoveryService: Pick<
    AssistedRecoveryService,
    'startByAdministrator' | 'confirmNewEmail' | 'complete' | 'cancel'
  >;
  /** Gates only new assisted recoveries; issued one-time flows remain consumable. */
  readonly assistedRecoveryEnabled: boolean;
}

const emailSchema = { type: 'string', minLength: 1, maxLength: 254 } as const;
const passwordSchema = { type: 'string', minLength: 1, maxLength: 1_024 } as const;
const tokenSchema = {
  type: 'string',
  pattern: '^[A-Za-z0-9_-]{43}$',
} as const;
const userIdSchema = { type: 'string', minLength: 1, maxLength: 128 } as const;
const operationalReferenceSchema = {
  type: 'string',
  pattern: '^[A-Za-z0-9._:/-]{1,128}$',
} as const;
const reasonSchema = {
  type: 'string',
  enum: [
    'lost_email_access',
    'compromised_email',
    'email_provider_unavailable',
    'other_verified_case',
  ],
} as const;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'request_id', 'details'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        request_id: { type: 'string' },
        details: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

const acceptedResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string', const: 'aceito' } },
} as const;

const restrictedTokenResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['token', 'expira_em'],
  properties: {
    token: tokenSchema,
    expira_em: { type: 'string', format: 'date-time' },
  },
} as const;

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
  reply.header('referrer-policy', 'no-referrer');
}

function accountActionHttpError(error: AccountActionError): HttpError {
  switch (error.code) {
    case 'account_not_found':
      return notFound();
    case 'account_action_forbidden':
    case 'admin_assisted_recovery_forbidden':
    case 'bootstrap_disabled':
    case 'break_glass_authorization_invalid':
      return forbidden();
    case 'recent_authentication_required':
      return unauthorized('invalid_credentials');
    case 'invitation_invalid':
    case 'email_change_invalid':
    case 'email_verification_invalid':
    case 'recovery_invalid':
    case 'restricted_authorization_invalid':
      return invalidOrExpiredChallenge();
    case 'email_unavailable':
    case 'account_not_pending':
    case 'account_not_active':
    case 'bootstrap_already_initialized':
    case 'bootstrap_not_correctable':
    case 'concurrent_account_change':
      return conflict();
  }
}

function safeHttpError(error: unknown): HttpError | undefined {
  if (error instanceof HttpError) return error;
  if (error instanceof PasswordHashingCapacityError) return rateLimited(1);
  if (error instanceof AccountActionError) return accountActionHttpError(error);
  if (error instanceof InvalidEmailError) return badRequest();
  if (error instanceof PasswordPolicyError) {
    return unprocessable('A senha não atende à política de segurança.');
  }
  return undefined;
}

function isValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'validation' in error &&
    error.validation !== undefined
  );
}

async function principalFor(
  request: FastifyRequest,
  authenticationService: Pick<AuthenticationService, 'authenticate'>,
) {
  const accessToken = bearerTokenFromAuthorizationHeader(
    request.headers.authorization,
  );
  return authenticationService.authenticate(accessToken);
}

async function activeAdminFor(
  request: FastifyRequest,
  authenticationService: Pick<AuthenticationService, 'authenticate'>,
) {
  const principal = await principalFor(request, authenticationService);
  if (principal.profile !== 'admin' || principal.status !== 'ativo') {
    throw forbidden();
  }
  return principal;
}

export const accountActionRoutesPlugin: FastifyPluginAsync<
  AccountActionRoutesOptions
> = async (app, options) => {
  app.addHook('onRequest', async (_request, reply) => {
    noStore(reply);
  });

  app.setErrorHandler(async (error, request, reply) => {
    noStore(reply);
    const safeError = isValidationError(error)
      ? badRequest()
      : safeHttpError(error);

    if (safeError === undefined) {
      request.log.error(
        { event: 'account_action_request_failed' },
        'Account action request processing failed.',
      );
      return reply.code(500).send({
        error: {
          code: 'internal_error',
          message: 'Erro interno.',
          request_id: request.id,
          details: [],
        },
      });
    }
    if (safeError.statusCode === 401) {
      reply.header('www-authenticate', 'Bearer');
    }
    if (
      safeError.statusCode === 429 &&
      safeError.retryAfterSeconds !== undefined
    ) {
      reply.header('retry-after', String(safeError.retryAfterSeconds));
    }
    return reply
      .code(safeError.statusCode)
      .send(httpErrorBody(safeError, request.id));
  });

  app.post<{ Body: { usuario_id: string } }>(
    '/invitations',
    {
      schema: {
        operationId: 'postAccountInvitation',
        summary: 'Convida um usuário pendente existente',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['usuario_id'],
          properties: { usuario_id: userIdSchema },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await activeAdminFor(request, options.authenticationService);
      await options.invitationService.issueForExistingPendingUser({
        organizationId: admin.organizationId,
        actorAdminUserId: admin.id,
        actorSessionId: admin.sessionId,
        userId: request.body.usuario_id,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string; senha: string } }>(
    '/invitations/accept',
    {
      schema: {
        operationId: 'postAccountInvitationAccept',
        summary: 'Aceita convite e define a senha',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'senha'],
          properties: { token: tokenSchema, senha: passwordSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.invitationService.accept({
        token: request.body.token,
        password: request.body.senha,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { novo_email: string; senha_atual: string } }>(
    '/email-change/request',
    {
      schema: {
        operationId: 'postPrimaryEmailChangeRequest',
        summary: 'Solicita troca do e-mail principal',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['novo_email', 'senha_atual'],
          properties: {
            novo_email: emailSchema,
            senha_atual: passwordSchema,
          },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const principal = await principalFor(
        request,
        options.authenticationService,
      );
      await options.primaryEmailService.request({
        organizationId: principal.organizationId,
        authenticatedUserId: principal.id,
        authenticatedSessionId: principal.sessionId,
        currentPassword: request.body.senha_atual,
        newEmail: request.body.novo_email,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/email-change/confirm-current',
    {
      schema: {
        operationId: 'postPrimaryEmailChangeConfirmCurrent',
        summary: 'Confirma a troca no endereço atual',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.primaryEmailService.confirmCurrentAddress({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/email-change/confirm-new',
    {
      schema: {
        operationId: 'postPrimaryEmailChangeConfirmNew',
        summary: 'Confirma o novo endereço e encerra as sessões',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.primaryEmailService.confirmNewAddress({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { novo_email: string } }>(
    '/secondary-email/request',
    {
      schema: {
        operationId: 'postSecondaryEmailRequest',
        summary: 'Solicita verificação do contato secundário do Admin',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['novo_email'],
          properties: { novo_email: emailSchema },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await activeAdminFor(request, options.authenticationService);
      await options.secondaryEmailService.requestVerification({
        organizationId: admin.organizationId,
        authenticatedUserId: admin.id,
        actorSessionId: admin.sessionId,
        newEmail: request.body.novo_email,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/secondary-email/confirm',
    {
      schema: {
        operationId: 'postSecondaryEmailConfirm',
        summary: 'Confirma o contato secundário do Admin',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: { 204: { type: 'null' }, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await options.secondaryEmailService.confirm({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{
    Body: { email_secundario: string; novo_email_principal: string };
  }>(
    '/admin-secondary-recovery/request',
    {
      schema: {
        operationId: 'postAdminSecondaryRecoveryRequest',
        summary: 'Solicita recuperação Admin pelo contato secundário verificado',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email_secundario', 'novo_email_principal'],
          properties: {
            email_secundario: emailSchema,
            novo_email_principal: emailSchema,
          },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.adminSecondaryRecoveryService.request({
        secondaryEmail: request.body.email_secundario,
        newPrimaryEmail: request.body.novo_email_principal,
        ipAddress: request.ip,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/admin-secondary-recovery/confirm-secondary',
    {
      schema: {
        operationId: 'postAdminSecondaryRecoveryConfirmSecondary',
        summary: 'Confirma o contato secundário do fluxo de recuperação Admin',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.adminSecondaryRecoveryService.confirmSecondaryAddress({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/admin-secondary-recovery/confirm-new-primary',
    {
      schema: {
        operationId: 'postAdminSecondaryRecoveryConfirmNewPrimary',
        summary: 'Confirma o novo e-mail principal da recuperação Admin',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          200: restrictedTokenResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const result =
        await options.adminSecondaryRecoveryService.confirmNewPrimaryAddress({
          token: request.body.token,
          requestId: request.id,
        });
      return { token: result.token, expira_em: result.expiresAt.toISOString() };
    },
  );

  app.post<{ Body: { token: string; nova_senha: string } }>(
    '/admin-secondary-recovery/complete',
    {
      schema: {
        operationId: 'postAdminSecondaryRecoveryComplete',
        summary: 'Conclui a recuperação Admin com nova senha',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'nova_senha'],
          properties: { token: tokenSchema, nova_senha: passwordSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.adminSecondaryRecoveryService.complete({
        token: request.body.token,
        newPassword: request.body.nova_senha,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { token: string } }>(
    '/admin-secondary-recovery/cancel',
    {
      schema: {
        operationId: 'postAdminSecondaryRecoveryCancel',
        summary: 'Cancela a recuperação Admin pelo contato secundário',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: { 204: { type: 'null' }, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await options.adminSecondaryRecoveryService.cancel({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { token: string } }>(
    '/admin-break-glass/confirm-email',
    {
      schema: {
        operationId: 'postAdminBreakGlassConfirmEmail',
        summary: 'Confirma o novo e-mail de um break-glass já autorizado',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          200: restrictedTokenResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const result =
        await options.adminBreakGlassContinuationService.confirmNewEmail({
          token: request.body.token,
          requestId: request.id,
        });
      return { token: result.token, expira_em: result.expiresAt.toISOString() };
    },
  );

  app.post<{ Body: { token: string; nova_senha: string } }>(
    '/admin-break-glass/complete',
    {
      schema: {
        operationId: 'postAdminBreakGlassComplete',
        summary: 'Conclui um break-glass autorizado com uma nova senha',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'nova_senha'],
          properties: { token: tokenSchema, nova_senha: passwordSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.adminBreakGlassContinuationService.complete({
        token: request.body.token,
        newPassword: request.body.nova_senha,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{
    Body: {
      usuario_id: string;
      novo_email: string;
      motivo:
        | 'lost_email_access'
        | 'compromised_email'
        | 'email_provider_unavailable'
        | 'other_verified_case';
      referencia_operacional: string;
    };
  }>(
    '/assisted-recovery',
    {
      schema: {
        operationId: 'postAssistedRecovery',
        summary: 'Inicia recuperação assistida de Produtor ou Colaborador',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: [
            'usuario_id',
            'novo_email',
            'motivo',
            'referencia_operacional',
          ],
          properties: {
            usuario_id: userIdSchema,
            novo_email: emailSchema,
            motivo: reasonSchema,
            referencia_operacional: operationalReferenceSchema,
          },
        },
        response: {
          202: acceptedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const admin = await activeAdminFor(request, options.authenticationService);
      if (!options.assistedRecoveryEnabled) throw serviceUnavailable();
      await options.assistedRecoveryService.startByAdministrator({
        organizationId: admin.organizationId,
        actorAdminUserId: admin.id,
        actorSessionId: admin.sessionId,
        targetUserId: request.body.usuario_id,
        newEmail: request.body.novo_email,
        reasonCode: request.body.motivo,
        externalCaseReference: request.body.referencia_operacional,
        requestId: request.id,
      });
      return reply.code(202).send({ status: 'aceito' });
    },
  );

  app.post<{ Body: { token: string } }>(
    '/assisted-recovery/confirm-email',
    {
      schema: {
        operationId: 'postAssistedRecoveryConfirmEmail',
        summary: 'Confirma o novo e-mail da recuperação assistida',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: {
          200: restrictedTokenResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const result = await options.assistedRecoveryService.confirmNewEmail({
        token: request.body.token,
        requestId: request.id,
      });
      return { token: result.token, expira_em: result.expiresAt.toISOString() };
    },
  );

  app.post<{ Body: { token: string; nova_senha: string } }>(
    '/assisted-recovery/complete',
    {
      schema: {
        operationId: 'postAssistedRecoveryComplete',
        summary: 'Define nova senha e conclui a recuperação assistida',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'nova_senha'],
          properties: { token: tokenSchema, nova_senha: passwordSchema },
        },
        response: {
          204: { type: 'null' },
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await options.assistedRecoveryService.complete({
        token: request.body.token,
        newPassword: request.body.nova_senha,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { token: string } }>(
    '/assisted-recovery/cancel',
    {
      schema: {
        operationId: 'postAssistedRecoveryCancel',
        summary: 'Cancela a recuperação usando autorização restrita',
        tags: ['Ações de conta'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenSchema },
        },
        response: { 204: { type: 'null' }, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await options.assistedRecoveryService.cancel({
        token: request.body.token,
        requestId: request.id,
      });
      return reply.code(204).send();
    },
  );
};
