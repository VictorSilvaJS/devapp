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

const URL_SCHEMES_ABRIVEIS = ['http:', 'https:', 'file:', 'content:', 'data:'];

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

  try {
    const parsed = new URL(arquivoUrl);
    return URL_SCHEMES_ABRIVEIS.includes(parsed.protocol);
  } catch {
    return false;
  }
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
