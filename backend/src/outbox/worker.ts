import type { EmailDeliveryReceipt, EmailSender } from '../email/smtp.js';
import type { SafeLogger } from '../observability/logger.js';
import {
  decodeEmailOutboxPayload,
  SMTP_EMAIL_OUTBOX_TYPE,
} from './email-message.js';
import type {
  ClaimedOutboxMessage,
  OutboxRepository,
} from './contracts.js';
import {
  OutboxPayloadCipher,
  OutboxPayloadCryptoError,
} from './crypto.js';

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_BASE_BACKOFF_MS = 5_000;
const DEFAULT_MAX_BACKOFF_MS = 15 * 60_000;

export interface OutboxDispatchReceipt {
  readonly providerMessageId?: string;
}

export interface OutboxDispatcher {
  supports(messageType: string): boolean;
  dispatch(message: ClaimedOutboxMessage): Promise<OutboxDispatchReceipt>;
}

export class OutboxDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super('Outbox delivery failed.');
    this.name = 'OutboxDeliveryError';
    this.code = /^[a-z0-9_]{1,64}$/.test(code) ? code : 'delivery_failed';
    this.retryable = retryable;
  }
}

export class SmtpOutboxDispatcher implements OutboxDispatcher {
  readonly #cipher: OutboxPayloadCipher;
  readonly #sender: EmailSender;

  constructor(input: {
    readonly cipher: OutboxPayloadCipher;
    readonly sender: EmailSender;
  }) {
    this.#cipher = input.cipher;
    this.#sender = input.sender;
  }

  supports(messageType: string): boolean {
    return messageType === SMTP_EMAIL_OUTBOX_TYPE;
  }

  async dispatch(message: ClaimedOutboxMessage): Promise<OutboxDispatchReceipt> {
    let payload: Readonly<Record<string, unknown>>;
    try {
      payload = this.#cipher.decrypt(message.payload, {
        organizationId: message.organizationId,
        messageId: message.id,
        messageType: message.messageType,
      });
    } catch (error) {
      if (error instanceof OutboxPayloadCryptoError) {
        throw new OutboxDeliveryError('payload_decryption_failed', false);
      }
      throw error;
    }

    let receipt: EmailDeliveryReceipt;
    try {
      receipt = await this.#sender.send(decodeEmailOutboxPayload(payload));
    } catch (error) {
      if (error instanceof OutboxDeliveryError) {
        throw error;
      }
      throw new OutboxDeliveryError('smtp_delivery_failed', true);
    }

    return receipt.providerMessageId === undefined
      ? {}
      : { providerMessageId: receipt.providerMessageId };
  }
}

export interface OutboxWorkerResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly retried: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly staleLease: number;
}

export interface OutboxWorkerOptions {
  readonly repository: OutboxRepository;
  readonly dispatchers: readonly OutboxDispatcher[];
  readonly workerId: string;
  readonly concurrency?: number;
  readonly batchSize?: number;
  readonly leaseMs?: number;
  readonly baseBackoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly clock?: () => Date;
  readonly jitter?: () => number;
  readonly logger?: SafeLogger;
}

function checkedInteger(
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} is outside the supported range.`);
  }
  return value;
}

function sanitizedFailure(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof OutboxDeliveryError) {
    return { code: error.code, retryable: error.retryable };
  }
  return { code: 'delivery_failed', retryable: true };
}

export class OutboxWorker {
  readonly #repository: OutboxRepository;
  readonly #dispatchers: readonly OutboxDispatcher[];
  readonly #workerId: string;
  readonly #concurrency: number;
  readonly #batchSize: number;
  readonly #leaseMs: number;
  readonly #baseBackoffMs: number;
  readonly #maxBackoffMs: number;
  readonly #clock: () => Date;
  readonly #jitter: () => number;
  readonly #logger: SafeLogger | undefined;

  constructor(options: OutboxWorkerOptions) {
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(options.workerId)) {
      throw new TypeError('Invalid outbox worker identifier.');
    }
    if (options.dispatchers.length === 0) {
      throw new TypeError('At least one outbox dispatcher is required.');
    }

    this.#repository = options.repository;
    this.#dispatchers = options.dispatchers;
    this.#workerId = options.workerId;
    this.#concurrency = checkedInteger(
      options.concurrency ?? 4,
      1,
      32,
      'Outbox concurrency',
    );
    this.#batchSize = checkedInteger(
      options.batchSize ?? 20,
      1,
      500,
      'Outbox batch size',
    );
    this.#leaseMs = checkedInteger(
      options.leaseMs ?? DEFAULT_LEASE_MS,
      1_000,
      10 * 60_000,
      'Outbox lease',
    );
    this.#baseBackoffMs = checkedInteger(
      options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS,
      100,
      60_000,
      'Outbox base backoff',
    );
    this.#maxBackoffMs = checkedInteger(
      options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
      this.#baseBackoffMs,
      24 * 60 * 60_000,
      'Outbox maximum backoff',
    );
    this.#clock = options.clock ?? (() => new Date());
    this.#jitter = options.jitter ?? Math.random;
    this.#logger = options.logger;
  }

  async runOnce(): Promise<OutboxWorkerResult> {
    const claimTime = this.#clock();
    const claimed = await this.#repository.claimReady({
      workerId: this.#workerId,
      limit: this.#batchSize,
      now: claimTime,
      leaseExpiresAt: new Date(claimTime.getTime() + this.#leaseMs),
    });
    const counters = {
      claimed: claimed.length,
      delivered: 0,
      retried: 0,
      failed: 0,
      cancelled: 0,
      staleLease: 0,
    };
    let cursor = 0;

    const consume = async (): Promise<void> => {
      while (cursor < claimed.length) {
        const message = claimed[cursor];
        cursor += 1;
        if (message !== undefined) {
          await this.#process(message, counters);
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.#concurrency, claimed.length) },
        consume,
      ),
    );

    return counters;
  }

  async #process(
    message: ClaimedOutboxMessage,
    counters: {
      delivered: number;
      retried: number;
      failed: number;
      cancelled: number;
      staleLease: number;
    },
  ): Promise<void> {
    const now = this.#clock();
    if (message.expiresAt.getTime() <= now.getTime()) {
      await this.#record(
        this.#repository.markCancelled({
          messageId: message.id,
          leaseToken: message.leaseToken,
          cancelledAt: now,
          reasonCode: 'message_expired',
        }),
        counters,
        'cancelled',
      );
      return;
    }

    const dispatcher = this.#dispatchers.find((candidate) =>
      candidate.supports(message.messageType),
    );
    if (dispatcher === undefined) {
      await this.#record(
        this.#repository.markFailed({
          messageId: message.id,
          leaseToken: message.leaseToken,
          failedAt: this.#clock(),
          errorCode: 'unsupported_message_type',
        }),
        counters,
        'failed',
      );
      return;
    }

    const outcome = await this.#repository.dispatchUnderEntityLock({
      message,
      dispatch: async () => {
        try {
          const receipt = await dispatcher.dispatch(message);
          return {
            status: 'delivered' as const,
            occurredAt: this.#clock(),
            ...(receipt.providerMessageId === undefined
              ? {}
              : { providerMessageId: receipt.providerMessageId }),
          };
        } catch (error) {
          const failure = sanitizedFailure(error);
          this.#logger?.warn(
            {
              event: 'outbox_delivery_failed',
              message_id: message.id,
              error_code: failure.code,
              retryable: failure.retryable,
            },
            'Outbox delivery attempt failed.',
          );
          const attemptedAt = this.#clock();
          const attemptsExhausted = message.attempt >= message.maxAttempts;
          if (!failure.retryable || attemptsExhausted) {
            return {
              status: 'failed' as const,
              occurredAt: attemptedAt,
              errorCode: failure.code,
            };
          }

          const exponential = Math.min(
            this.#maxBackoffMs,
            this.#baseBackoffMs * 2 ** Math.max(0, message.attempt - 1),
          );
          const jitterValue = this.#jitter();
          const boundedJitter = Number.isFinite(jitterValue)
            ? Math.min(1, Math.max(0, jitterValue))
            : 0.5;
          const delay = Math.round(
            exponential * (0.75 + boundedJitter * 0.5),
          );
          const nextAttemptAt = new Date(attemptedAt.getTime() + delay);
          if (nextAttemptAt.getTime() >= message.expiresAt.getTime()) {
            return {
              status: 'failed' as const,
              occurredAt: attemptedAt,
              errorCode: 'delivery_window_exhausted',
            };
          }
          return {
            status: 'retried' as const,
            occurredAt: attemptedAt,
            nextAttemptAt,
            errorCode: failure.code,
          };
        }
      },
    });
    if (outcome === 'stale') counters.staleLease += 1;
    else counters[outcome] += 1;
  }

  async #record(
    write: Promise<boolean>,
    counters: {
      delivered: number;
      retried: number;
      failed: number;
      cancelled: number;
      staleLease: number;
    },
    outcome: 'delivered' | 'retried' | 'failed' | 'cancelled',
  ): Promise<void> {
    if (await write) {
      counters[outcome] += 1;
    } else {
      counters.staleLease += 1;
    }
  }
}
