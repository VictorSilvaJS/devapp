const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/geo+json': 'geojson',
  'application/json': 'json',
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  zip: 'application/zip',
  geojson: 'application/geo+json',
  json: 'application/json',
};

const stripQueryAndFragment = (value: string): string => value.split(/[?#]/, 1)[0] || '';

const getPathFileName = (value: unknown): string => {
  const normalized = stripQueryAndFragment(String(value ?? '').trim()).replace(/\\/g, '/');
  const lastSegment = normalized.split('/').filter(Boolean).pop() || '';

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

const getExtension = (value: string): string => {
  const match = value.match(/\.([a-z0-9]{1,10})$/i);
  return match?.[1]?.toLowerCase() || '';
};

export const resolvePhoneExportMimeType = (
  requestedMimeType: unknown,
  fileNameOrUri: unknown
): string => {
  const requested = String(requestedMimeType ?? '').trim().toLowerCase();
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(requested)) return requested;

  const extension = getExtension(getPathFileName(fileNameOrUri));
  return EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
};

export const sanitizePhoneExportFileName = (
  preferredName: unknown,
  sourceUri: unknown,
  mimeType?: unknown,
  fallbackBaseName = 'arquivo'
): string => {
  const requestedMime = resolvePhoneExportMimeType(mimeType, preferredName || sourceUri);
  const fallbackExtension = MIME_EXTENSION_MAP[requestedMime] || '';
  const sourceName = getPathFileName(preferredName) || getPathFileName(sourceUri);
  const sourceExtension = getExtension(sourceName);
  const extension = sourceExtension || fallbackExtension;
  const rawBase = sourceExtension
    ? sourceName.slice(0, -(sourceExtension.length + 1))
    : sourceName;
  const safeFallback = String(fallbackBaseName || 'arquivo').trim() || 'arquivo';
  const safeBase = (rawBase || safeFallback)
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/g, '')
    .replace(/^[.\s-]+/g, '')
    .slice(0, 96)
    .trim() || safeFallback;

  return extension ? `${safeBase}.${extension.toLowerCase()}` : safeBase;
};

export const splitPhoneExportFileName = (fileName: string): {
  baseName: string;
  extension: string;
} => {
  const extension = getExtension(fileName);
  return {
    baseName: extension ? fileName.slice(0, -(extension.length + 1)) : fileName,
    extension,
  };
};

export const resolvePhoneExportCreatedFileName = (
  destinationUri: unknown,
  requestedFileName: string
): string => {
  const fallback = String(requestedFileName || '').trim();
  const normalizedUri = stripQueryAndFragment(String(destinationUri ?? '').trim());
  if (!normalizedUri) return fallback;

  let decodedUri = normalizedUri;
  try {
    decodedUri = decodeURIComponent(normalizedUri);
  } catch {
    // Mantém a URI original quando o provedor devolve percent-encoding inválido.
  }

  const createdName = getPathFileName(decodedUri);
  const requestedExtension = getExtension(fallback);
  const createdExtension = getExtension(createdName);

  // Alguns provedores usam IDs opacos no lugar do nome no content URI. Nesses
  // casos, é mais seguro manter o nome solicitado do que exibir o ID ao usuário.
  if (!createdName || (requestedExtension && createdExtension !== requestedExtension)) {
    return fallback;
  }

  return sanitizePhoneExportFileName(
    createdName,
    destinationUri,
    resolvePhoneExportMimeType('', fallback),
    splitPhoneExportFileName(fallback).baseName || 'arquivo'
  );
};
