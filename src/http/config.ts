export interface HttpRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly actionBaseUrl: string;
  readonly allowInsecureDevelopmentHttp: boolean;
}

export class InvalidHttpRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHttpRuntimeConfigError';
  }
}

function parseBaseUrl(
  label: string,
  value: string | undefined,
  allowInsecureDevelopmentHttp: boolean,
): URL {
  if (value === undefined || value.trim().length === 0) {
    throw new InvalidHttpRuntimeConfigError(`${label} não foi configurada.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InvalidHttpRuntimeConfigError(`${label} é inválida.`);
  }

  const isLoopback =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '10.0.2.2';
  if (
    parsed.protocol !== 'https:' &&
    (!allowInsecureDevelopmentHttp || !isLoopback)
  ) {
    throw new InvalidHttpRuntimeConfigError(`${label} deve usar HTTPS.`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new InvalidHttpRuntimeConfigError(`${label} usa um protocolo inválido.`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new InvalidHttpRuntimeConfigError(
      `${label} não pode conter credenciais, query ou fragmento.`,
    );
  }
  return parsed;
}

export function createHttpRuntimeConfig(input: {
  readonly apiBaseUrl?: string;
  readonly actionBaseUrl?: string;
  readonly appVariant?: string;
  readonly allowInsecureDevelopmentHttp?: boolean;
  readonly isDevelopment?: boolean;
}): HttpRuntimeConfig {
  if (input.appVariant !== 'http') {
    throw new InvalidHttpRuntimeConfigError(
      'O entrypoint HTTP exige EXPO_PUBLIC_APP_VARIANT=http.',
    );
  }
  const allowInsecureDevelopmentHttp =
    input.allowInsecureDevelopmentHttp === true && input.isDevelopment === true;
  const api = parseBaseUrl(
    'EXPO_PUBLIC_API_BASE_URL',
    input.apiBaseUrl,
    allowInsecureDevelopmentHttp,
  );
  const action = parseBaseUrl(
    'EXPO_PUBLIC_AUTH_ACTION_BASE_URL',
    input.actionBaseUrl,
    allowInsecureDevelopmentHttp,
  );
  if (action.pathname === '/') {
    throw new InvalidHttpRuntimeConfigError(
      'EXPO_PUBLIC_AUTH_ACTION_BASE_URL deve usar um caminho dedicado.',
    );
  }

  return {
    apiBaseUrl: api.toString().replace(/\/$/, ''),
    actionBaseUrl: action.toString(),
    allowInsecureDevelopmentHttp,
  };
}

export function loadHttpRuntimeConfig(): HttpRuntimeConfig {
  return createHttpRuntimeConfig({
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    actionBaseUrl: process.env.EXPO_PUBLIC_AUTH_ACTION_BASE_URL,
    appVariant: process.env.EXPO_PUBLIC_APP_VARIANT,
    allowInsecureDevelopmentHttp:
      process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === 'true',
    isDevelopment: __DEV__,
  });
}
