import nodemailer from 'nodemailer';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface EmailDeliveryReceipt {
  readonly providerMessageId?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailDeliveryReceipt>;
}

/** Structural subset implemented by a nodemailer Transporter. */
export interface SmtpTransport {
  sendMail(message: {
    readonly from: string;
    readonly to: string;
    readonly subject: string;
    readonly text: string;
    readonly html?: string;
  }): Promise<{ readonly messageId?: string }>;
}

export interface SmtpAdapterConfig {
  readonly host: string;
  readonly port: number;
  /** true for implicit TLS; STARTTLS deployments normally use false + requireTls. */
  readonly secure: boolean;
  readonly requireTls: boolean;
  readonly from: string;
  readonly username?: string;
  readonly password?: string;
  readonly connectionTimeoutMs?: number;
  readonly greetingTimeoutMs?: number;
  readonly socketTimeoutMs?: number;
}

function assertHeaderValue(value: string): void {
  if (value.length === 0 || value.includes('\r') || value.includes('\n')) {
    throw new TypeError('Invalid email header value.');
  }
}

/**
 * Keeps nodemailer outside the domain layer. Runtime wiring may pass a
 * `nodemailer.createTransport(...)` result without coupling tests to SMTP.
 */
export class GenericSmtpEmailSender implements EmailSender {
  readonly #transport: SmtpTransport;
  readonly #from: string;

  constructor(input: { readonly transport: SmtpTransport; readonly from: string }) {
    assertHeaderValue(input.from);
    this.#transport = input.transport;
    this.#from = input.from;
  }

  async send(message: EmailMessage): Promise<EmailDeliveryReceipt> {
    assertHeaderValue(message.to);
    assertHeaderValue(message.subject);

    const receipt = await this.#transport.sendMail({
      from: this.#from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html === undefined ? {} : { html: message.html }),
    });

    return receipt.messageId === undefined
      ? {}
      : { providerMessageId: receipt.messageId };
  }
}

export function createNodemailerSmtpEmailSender(
  config: SmtpAdapterConfig,
): GenericSmtpEmailSender {
  assertHeaderValue(config.host);
  assertHeaderValue(config.from);
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65_535) {
    throw new RangeError('Invalid SMTP port.');
  }
  if ((config.username === undefined) !== (config.password === undefined)) {
    throw new TypeError('SMTP username and password must be configured together.');
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    tls: { rejectUnauthorized: true },
    connectionTimeout: config.connectionTimeoutMs ?? 10_000,
    greetingTimeout: config.greetingTimeoutMs ?? 10_000,
    socketTimeout: config.socketTimeoutMs ?? 30_000,
    ...(config.username === undefined
      ? {}
      : {
          auth: {
            user: config.username,
            pass: config.password,
          },
        }),
  });

  return new GenericSmtpEmailSender({
    transport,
    from: config.from,
  });
}
