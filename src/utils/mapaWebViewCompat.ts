export type MapaWebViewResourceScope = 'base-map' | 'engine' | 'document' | 'unknown';

export type MapaWebViewFailureKind =
  | 'ssl'
  | 'network'
  | 'http'
  | 'timeout'
  | 'engine'
  | 'render-process';

export type MapaWebViewFallbackMode = 'base-only' | 'vector';

export interface MapaWebViewFailureInput {
  source:
    | 'main-frame'
    | 'subresource'
    | 'http'
    | 'leaflet'
    | 'ready-timeout'
    | 'tile-layer'
    | 'render-process';
  url?: string | null;
  code?: number | null;
  statusCode?: number | null;
  description?: string | null;
  reason?: string | null;
}

export interface MapaWebViewDiagnostic {
  kind: MapaWebViewFailureKind;
  scope: MapaWebViewResourceScope;
  fallbackMode: MapaWebViewFallbackMode;
  userMessage: string;
  technical: {
    source: MapaWebViewFailureInput['source'];
    host: string | null;
    code: number | null;
    statusCode: number | null;
    reason: string | null;
  };
}

const BASE_MAP_HOSTS = new Set(['tile.openstreetmap.org']);
const ENGINE_HOSTS = new Set(['unpkg.com']);
const SSL_ERROR_CODES = new Set([-200, -201, -202, -203, -204, -205, -206, -207, -208, -209, -210, -211, -212, -213, -214, -215, -216, -11]);
const NETWORK_ERROR_CODES = new Set([-2, -4, -5, -6, -7, -8, -9, -10, -12, -105, -106, -109, -118]);

const normalizeText = (value?: string | null): string =>
  String(value || '').trim().toLowerCase();

export function getMapaWebViewHost(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() || null;
  } catch (_) {
    return null;
  }
}

export function getMapaWebViewResourceScope(url?: string | null): MapaWebViewResourceScope {
  if (!url) return 'unknown';

  const host = getMapaWebViewHost(url);
  if (host && BASE_MAP_HOSTS.has(host)) return 'base-map';
  if (host && ENGINE_HOSTS.has(host)) return 'engine';
  if (/^(about:blank|data:text\/html)/i.test(url)) return 'document';
  return 'unknown';
}

function classifyFailureKind(
  input: MapaWebViewFailureInput,
  scope: MapaWebViewResourceScope
): MapaWebViewFailureKind {
  if (input.source === 'ready-timeout') return 'timeout';
  if (input.source === 'render-process') return 'render-process';
  if (input.source === 'leaflet') return 'engine';

  const code = input.code ?? null;
  const description = normalizeText(input.description);
  const reason = normalizeText(input.reason);

  if (
    (code != null && SSL_ERROR_CODES.has(code))
    || /ssl|certificate|cert_|net::err_cert|handshake/.test(description)
    || /ssl|certificate|cert_|handshake/.test(reason)
  ) {
    return 'ssl';
  }

  if (input.source === 'http' || input.statusCode != null) return 'http';

  if (
    (code != null && NETWORK_ERROR_CODES.has(code))
    || /host lookup|name not resolved|unknown host|dns|timed? out|timeout|connection|network|internet/.test(description)
    || /tile_(error|timeout)|network|dns|timeout/.test(reason)
  ) {
    return 'network';
  }

  return scope === 'engine' ? 'engine' : 'network';
}

export function classifyMapaWebViewFailure(
  input: MapaWebViewFailureInput
): MapaWebViewDiagnostic {
  const inferredScope = getMapaWebViewResourceScope(input.url);
  const scope = input.source === 'tile-layer'
    ? 'base-map'
    : input.source === 'leaflet' || input.source === 'ready-timeout'
      ? 'engine'
      : inferredScope;
  const kind = classifyFailureKind(input, scope);
  const fallbackMode: MapaWebViewFallbackMode = scope === 'base-map'
    ? 'base-only'
    : 'vector';

  return {
    kind,
    scope,
    fallbackMode,
    userMessage: fallbackMode === 'base-only'
      ? 'Mapa-base indisponível. A demarcação dos Talhões continua disponível.'
      : 'Sem acesso ao mapa interativo. Exibindo a demarcação local dos Talhões.',
    technical: {
      source: input.source,
      host: getMapaWebViewHost(input.url),
      code: input.code ?? null,
      statusCode: input.statusCode ?? null,
      reason: input.reason ? String(input.reason).slice(0, 80) : null,
    },
  };
}
