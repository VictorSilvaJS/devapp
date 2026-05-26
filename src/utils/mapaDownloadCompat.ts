type MapaDownloadMotivo =
  | 'disponivel'
  | 'nao_liberado'
  | 'sem_arquivo'
  | 'arquivo_nao_usavel';

export type MapaDownloadStatus = {
  podeAbrir: boolean;
  arquivoUrl?: string;
  motivo: MapaDownloadMotivo;
  label: string;
  descricao: string;
};

export type MapaArquivoAssociacaoInput = {
  arquivoUrl?: string;
  formatoArquivo?: string;
  tamanhoArquivo?: string | number;
};

export type MapaArquivoAssociacaoResult =
  | {
      ok: true;
      payload: {
        arquivo_url: string;
        formato_arquivo?: string;
        tamanho_arquivo?: number;
        disponivel_download: true;
        disponivel_para_download: true;
      };
    }
  | {
      ok: false;
      mensagem: string;
    };

const URL_SCHEMES_ABRIVEIS = ['http:', 'https:', 'file:', 'content:', 'data:', 'asset:'];

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') continue;

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const resolveDisponibilidadeDeclarada = (mapa?: Record<string, any> | null): boolean =>
  mapa?.disponivel_download ?? mapa?.disponivel_para_download ?? true;

export const resolveMapaArquivoUrl = (
  mapa?: Record<string, any> | null
): string | undefined =>
  firstNonEmptyString(
    mapa?.arquivo_url,
    mapa?.arquivoUrl,
    mapa?.arquivo_download_url,
    mapa?.download_url,
    mapa?.url_download,
    mapa?.url,
    mapa?.arquivo_panorama_url
  );

export const isMapaArquivoUrlUsavel = (value?: unknown): boolean => {
  const arquivoUrl = firstNonEmptyString(value);
  if (!arquivoUrl) {
    return false;
  }

  if (arquivoUrl.startsWith('asset://')) {
    return true;
  }

  try {
    const parsed = new URL(arquivoUrl);
    return URL_SCHEMES_ABRIVEIS.includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const inferFormatoArquivoFromUrl = (value?: unknown): string | undefined => {
  const arquivoUrl = firstNonEmptyString(value);
  if (!arquivoUrl) {
    return undefined;
  }

  if (arquivoUrl.startsWith('data:')) {
    const mime = arquivoUrl.match(/^data:([^;,]+)/)?.[1];
    const subtype = mime?.split('/')[1]?.toLowerCase();
    return subtype === 'jpeg' ? 'jpg' : subtype;
  }

  if (arquivoUrl.startsWith('asset://')) {
    const extension = arquivoUrl.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    return extension === 'jpeg' ? 'jpg' : extension;
  }

  try {
    const parsed = new URL(arquivoUrl);
    const pathname = decodeURIComponent(parsed.pathname || '');
    const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    return extension === 'jpeg' ? 'jpg' : extension;
  } catch {
    return undefined;
  }
};

export const buildMapaArquivoAssociacaoPayload = (
  input: MapaArquivoAssociacaoInput = {}
): MapaArquivoAssociacaoResult => {
  const arquivoUrl = firstNonEmptyString(input.arquivoUrl);

  if (!arquivoUrl) {
    return {
      ok: false,
      mensagem: 'Informe uma URL de arquivo para associar ao mapa.',
    };
  }

  if (!isMapaArquivoUrlUsavel(arquivoUrl)) {
    return {
      ok: false,
      mensagem: 'Informe uma URL abrível, como https://, file://, content://, data: ou asset://.',
    };
  }

  const tamanhoTexto = typeof input.tamanhoArquivo === 'number'
    ? String(input.tamanhoArquivo)
    : firstNonEmptyString(input.tamanhoArquivo);
  const tamanhoArquivo = tamanhoTexto ? Number(tamanhoTexto) : undefined;

  if (tamanhoTexto && (!Number.isFinite(tamanhoArquivo) || tamanhoArquivo <= 0)) {
    return {
      ok: false,
      mensagem: 'Informe o tamanho em bytes com um número maior que zero ou deixe em branco.',
    };
  }

  const formatoArquivo = firstNonEmptyString(input.formatoArquivo)
    ?? inferFormatoArquivoFromUrl(arquivoUrl);

  return {
    ok: true,
    payload: {
      arquivo_url: arquivoUrl,
      ...(formatoArquivo ? { formato_arquivo: formatoArquivo } : {}),
      ...(tamanhoArquivo ? { tamanho_arquivo: tamanhoArquivo } : {}),
      disponivel_download: true,
      disponivel_para_download: true,
    },
  };
};

export const avaliarDownloadMapa = (
  mapa?: Record<string, any> | null
): MapaDownloadStatus => {
  if (!resolveDisponibilidadeDeclarada(mapa)) {
    return {
      podeAbrir: false,
      motivo: 'nao_liberado',
      label: 'Indisponível',
      descricao: 'Material ainda não liberado para consulta ou download.',
    };
  }

  const arquivoUrl = resolveMapaArquivoUrl(mapa);

  if (!arquivoUrl) {
    return {
      podeAbrir: false,
      motivo: 'sem_arquivo',
      label: 'Sem arquivo',
      descricao: 'Este mapa não possui arquivo ou URL anexado no mock atual.',
    };
  }

  if (!isMapaArquivoUrlUsavel(arquivoUrl)) {
    return {
      podeAbrir: false,
      arquivoUrl,
      motivo: 'arquivo_nao_usavel',
      label: 'Arquivo pendente',
      descricao: 'O mock informa um caminho de arquivo, mas ele não aponta para um material abrível.',
    };
  }

  return {
    podeAbrir: true,
    arquivoUrl,
    motivo: 'disponivel',
    label: 'Abrir material',
    descricao: 'Material com URL abrível disponível.',
  };
};
