export type NotificationContextInvalidation =
  | 'filter'
  | 'mutation'
  | 'partition'
  | 'unmount';

export type NotificationCommandDisposition =
  | 'ambiguous'
  | 'confirmed'
  | 'definitive';

export type NotificationContextRequest =
  | Readonly<{ kind: 'list'; id: number }>
  | Readonly<{ kind: 'count'; id: number }>
  | Readonly<{
      kind: 'load-more';
      id: number;
      listRequestId: number;
    }>;

type NotificationLoadMoreRequest = Extract<
  NotificationContextRequest,
  Readonly<{ kind: 'load-more' }>
>;

/**
 * Process-local ownership for notification commands and reads.
 *
 * Identity and filter values remain owned by the React provider. This class
 * only makes request invalidation and idempotency-key retention deterministic
 * and independently testable.
 */
export class NotificationContextCoordinator {
  #listRequestId = 0;
  #countRequestId = 0;
  #loadMoreRequestId = 0;
  #activeLoadMore: number | null = null;
  readonly #commandKeys = new Map<string, string>();

  get loadMoreBusy(): boolean {
    return this.#activeLoadMore !== null;
  }

  commandKey(intent: string, create: () => string): string {
    const existing = this.#commandKeys.get(intent);
    if (existing !== undefined) return existing;
    const created = create();
    this.#commandKeys.set(intent, created);
    return created;
  }

  settleCommandKey(
    intent: string,
    key: string,
    disposition: NotificationCommandDisposition,
  ): boolean {
    if (
      disposition === 'ambiguous' ||
      this.#commandKeys.get(intent) !== key
    ) {
      return false;
    }
    this.#commandKeys.delete(intent);
    return true;
  }

  invalidate(reason: NotificationContextInvalidation): void {
    this.#listRequestId += 1;
    this.#countRequestId += 1;
    this.#loadMoreRequestId += 1;
    this.#activeLoadMore = null;
    if (reason === 'partition') this.#commandKeys.clear();
  }

  beginList(): NotificationContextRequest {
    const id = ++this.#listRequestId;
    this.#loadMoreRequestId += 1;
    this.#activeLoadMore = null;
    return Object.freeze({ kind: 'list' as const, id });
  }

  beginCount(): NotificationContextRequest {
    const id = ++this.#countRequestId;
    return Object.freeze({ kind: 'count' as const, id });
  }

  beginLoadMore(): NotificationLoadMoreRequest | null {
    if (this.#activeLoadMore !== null) return null;
    const id = ++this.#loadMoreRequestId;
    this.#activeLoadMore = id;
    return Object.freeze({
      kind: 'load-more' as const,
      id,
      listRequestId: this.#listRequestId,
    });
  }

  isCurrent(request: NotificationContextRequest): boolean {
    if (request.kind === 'list') return this.#listRequestId === request.id;
    if (request.kind === 'count') return this.#countRequestId === request.id;
    return (
      this.#activeLoadMore === request.id &&
      this.#loadMoreRequestId === request.id &&
      this.#listRequestId === request.listRequestId
    );
  }

  finishLoadMore(request: NotificationLoadMoreRequest): boolean {
    if (!this.isCurrent(request)) return false;
    this.#activeLoadMore = null;
    return true;
  }
}
