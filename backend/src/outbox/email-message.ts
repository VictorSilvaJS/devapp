import { buildFragmentActionLink } from '../security/action-token.js';
import type { EmailMessage } from '../email/smtp.js';
import type { EncryptedOutboxMessageDraft } from './contracts.js';
import { OutboxPayloadCipher } from './crypto.js';

const EMAIL_MESSAGE_TYPE = 'email.smtp.v1';

export interface ActionEmailDraftInput {
  readonly id: string;
  readonly organizationId: string;
  readonly challengeId: string;
  readonly to: string;
  readonly subject: string;
  readonly introduction: string;
  readonly actionLabel: string;
  readonly action: string;
  readonly actionBaseUrl: string;
  readonly token: string;
  readonly availableAt: Date;
  readonly expiresAt: Date;
  readonly maxAttempts?: number;
}

export interface NotificationEmailDraftInput {
  readonly id: string;
  readonly organizationId: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly availableAt: Date;
  readonly expiresAt: Date;
  readonly maxAttempts?: number;
}

function assertDeliveryWindow(
  availableAt: Date,
  expiresAt: Date,
  maxAttempts: number,
): void {
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 20 ||
    expiresAt.getTime() <= availableAt.getTime()
  ) {
    throw new RangeError('Invalid outbox delivery policy.');
  }
}

export class EncryptedEmailOutboxFactory {
  readonly #cipher: OutboxPayloadCipher;

  constructor(cipher: OutboxPayloadCipher) {
    this.#cipher = cipher;
  }

  action(input: ActionEmailDraftInput): EncryptedOutboxMessageDraft {
    const maxAttempts = input.maxAttempts ?? 5;
    assertDeliveryWindow(input.availableAt, input.expiresAt, maxAttempts);
    const link = buildFragmentActionLink({
      baseUrl: input.actionBaseUrl,
      token: input.token,
      action: input.action,
    });
    const message: EmailMessage = {
      to: input.to,
      subject: input.subject,
      text: `${input.introduction}\n\n${input.actionLabel}: ${link}\n\nSe você não solicitou esta ação, ignore esta mensagem.`,
    };

    return this.#encrypt({
      id: input.id,
      organizationId: input.organizationId,
      challengeId: input.challengeId,
      message,
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
      maxAttempts,
    });
  }

  notification(input: NotificationEmailDraftInput): EncryptedOutboxMessageDraft {
    const maxAttempts = input.maxAttempts ?? 5;
    assertDeliveryWindow(input.availableAt, input.expiresAt, maxAttempts);
    return this.#encrypt({
      id: input.id,
      organizationId: input.organizationId,
      message: {
        to: input.to,
        subject: input.subject,
        text: input.text,
      },
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
      maxAttempts,
    });
  }

  #encrypt(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly challengeId?: string;
    readonly message: EmailMessage;
    readonly availableAt: Date;
    readonly expiresAt: Date;
    readonly maxAttempts: number;
  }): EncryptedOutboxMessageDraft {
    const context = {
      organizationId: input.organizationId,
      messageId: input.id,
      messageType: EMAIL_MESSAGE_TYPE,
    };
    const payload = this.#cipher.encrypt(
      {
        to: input.message.to,
        subject: input.message.subject,
        text: input.message.text,
        ...(input.message.html === undefined ? {} : { html: input.message.html }),
      },
      context,
    );

    return {
      id: input.id,
      organizationId: input.organizationId,
      messageType: EMAIL_MESSAGE_TYPE,
      ...(input.challengeId === undefined
        ? {}
        : { challengeId: input.challengeId }),
      payload,
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
      maxAttempts: input.maxAttempts,
    };
  }
}

export function decodeEmailOutboxPayload(
  value: Readonly<Record<string, unknown>>,
): EmailMessage {
  const { to, subject, text, html } = value;
  if (
    typeof to !== 'string' ||
    typeof subject !== 'string' ||
    typeof text !== 'string' ||
    (html !== undefined && typeof html !== 'string')
  ) {
    throw new TypeError('Invalid encrypted email payload.');
  }

  return {
    to,
    subject,
    text,
    ...(html === undefined ? {} : { html }),
  };
}

export const SMTP_EMAIL_OUTBOX_TYPE = EMAIL_MESSAGE_TYPE;
