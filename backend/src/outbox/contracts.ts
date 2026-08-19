export interface OutboxEncryptionContext {
  readonly organizationId: string;
  readonly messageId: string;
  readonly messageType: string;
}

export interface EncryptedOutboxPayloadV1 {
  readonly version: 1;
  readonly algorithm: 'aes-256-gcm';
  readonly keyId: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authenticationTag: string;
}

export type EncryptedOutboxPayload = EncryptedOutboxPayloadV1;

export interface EncryptedOutboxMessageDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly messageType: string;
  readonly challengeId?: string;
  readonly payload: EncryptedOutboxPayload;
  readonly availableAt: Date;
  readonly expiresAt: Date;
  readonly maxAttempts: number;
}

export interface ClaimedOutboxMessage {
  readonly id: string;
  readonly organizationId: string;
  readonly messageType: string;
  readonly challengeId?: string;
  readonly payload: EncryptedOutboxPayload;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly expiresAt: Date;
  /** Unique per claim; all terminal/retry writes must compare this value. */
  readonly leaseToken: string;
}

export interface ClaimReadyOutboxInput {
  readonly workerId: string;
  readonly limit: number;
  readonly now: Date;
  readonly leaseExpiresAt: Date;
}

export interface OutboxRepository {
  /**
   * Must atomically claim rows using a lease (normally FOR UPDATE SKIP LOCKED).
   * A message may be returned to only one live lease at a time.
   */
  claimReady(input: ClaimReadyOutboxInput): Promise<readonly ClaimedOutboxMessage[]>;
  isChallengeActive(input: {
    readonly organizationId: string;
    readonly challengeId: string;
    readonly now: Date;
  }): Promise<boolean>;
  markDelivered(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly deliveredAt: Date;
    readonly providerMessageId?: string;
  }): Promise<boolean>;
  markCancelled(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly cancelledAt: Date;
    readonly reasonCode: string;
  }): Promise<boolean>;
  reschedule(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly attemptedAt: Date;
    readonly nextAttemptAt: Date;
    readonly errorCode: string;
  }): Promise<boolean>;
  markFailed(input: {
    readonly messageId: string;
    readonly leaseToken: string;
    readonly failedAt: Date;
    readonly errorCode: string;
  }): Promise<boolean>;
}
