import type {
  AccountAction,
  ParsedAccountActionLink,
} from './contracts';
import { assertActionToken } from './decoders';

const ALLOWED_ACTIONS = new Set<AccountAction>([
  'accept-invitation',
  'accept-initial-admin-invitation',
  'complete-password-recovery',
  'confirm-current-primary-email',
  'confirm-new-primary-email',
  'verify-secondary-email',
  'confirm-admin-secondary-recovery',
  'confirm-admin-recovery-new-primary',
  'confirm-assisted-recovery-email',
]);

export function parseAccountActionLink(
  rawUrl: string,
  configuredBaseUrl: string,
): ParsedAccountActionLink | null {
  let received: URL;
  let expected: URL;
  try {
    received = new URL(rawUrl);
    expected = new URL(configuredBaseUrl);
  } catch {
    return null;
  }

  if (
    received.protocol !== expected.protocol ||
    received.origin !== expected.origin ||
    received.pathname !== expected.pathname ||
    received.username ||
    received.password ||
    received.search ||
    expected.search ||
    expected.hash
  ) {
    return null;
  }

  const fragment = new URLSearchParams(received.hash.replace(/^#/, ''));
  if (
    fragment.getAll('action').length !== 1 ||
    fragment.getAll('token').length !== 1 ||
    Array.from(fragment.keys()).some(
      (key) => key !== 'action' && key !== 'token',
    )
  ) {
    return null;
  }

  const action = fragment.get('action');
  const rawToken = fragment.get('token');
  if (!ALLOWED_ACTIONS.has(action as AccountAction) || rawToken === null) {
    return null;
  }

  try {
    return {
      action: action as AccountAction,
      token: assertActionToken(rawToken),
    };
  } catch {
    return null;
  }
}

export function isSupportedAccountAction(
  value: string,
): value is AccountAction {
  return ALLOWED_ACTIONS.has(value as AccountAction);
}
