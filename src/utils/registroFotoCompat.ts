import { temAcessoCaderno, temAcessoVisita } from './acessoControle';
import { sanitizePhoneExportFileName } from './phoneFileExportCompat';

export type RegistroFotoOrigem = 'caderno' | 'visita';

export type RegistroFotoDownloadInput = {
  user: any;
  registro: any;
  fazenda: any;
  origem: RegistroFotoOrigem;
  foto: unknown;
};

export const getRegistroFotoUri = (foto: unknown): string | null => {
  if (typeof foto === 'string') {
    const uri = foto.trim();
    return uri.length > 0 ? uri : null;
  }

  if (foto && typeof foto === 'object' && 'uri' in foto) {
    const uri = (foto as { uri?: unknown }).uri;
    return typeof uri === 'string' && uri.trim().length > 0 ? uri.trim() : null;
  }

  return null;
};

export const getRegistroFotoNomeOriginal = (foto: unknown): string | null => {
  if (!foto || typeof foto !== 'object') return null;
  const record = foto as Record<string, unknown>;
  const value = record.nome_original ?? record.fileName ?? record.name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const isRegistroFotoUriBaixavel = (uri: unknown): uri is string =>
  typeof uri === 'string' && /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(uri.trim());

export const podeBaixarFotoRegistro = ({
  user,
  registro,
  fazenda,
  origem,
  foto,
}: RegistroFotoDownloadInput): boolean => {
  const uri = getRegistroFotoUri(foto);
  if (!user || !registro || !fazenda || !isRegistroFotoUriBaixavel(uri)) return false;

  return origem === 'caderno'
    ? temAcessoCaderno(user, registro, fazenda)
    : temAcessoVisita(user, registro, fazenda);
};

const extensionFromUri = (uri: string): string => {
  const path = uri.split(/[?#]/, 1)[0] || '';
  const match = path.match(/\.([a-z0-9]{2,5})$/i);
  const extension = match?.[1]?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)
    ? extension
    : 'jpg';
};

export const buildRegistroFotoDownloadName = (
  uri: string,
  origem: RegistroFotoOrigem,
  index = 0,
  preferredName?: string | null
): string => {
  const position = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
  const fallbackName = `foto-${origem}-${position}.${extensionFromUri(uri)}`;
  return preferredName
    ? sanitizePhoneExportFileName(preferredName, uri, undefined, `foto-${origem}-${position}`)
    : fallbackName;
};
