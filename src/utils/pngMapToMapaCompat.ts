import type {
  PngMapCategoria,
  PngMapElemento,
  PngMapImportMetadata,
} from '../types/anexoPngLocal';

export const PNG_LOCAL_MAPA_TIPO_ANEXO = 'anexo_png_local';
export const PNG_LOCAL_MAPA_TIPO_MATERIAL = 'png_local';
export const PNG_LOCAL_MAPA_ORIGEM = 'arquivo_local';
export const PNG_LOCAL_MAPA_OPEN_MESSAGE =
  'Visualização do PNG local será habilitada na próxima etapa.';

export type PngMapListPerfil = 'admin' | 'colaborador' | 'produtor' | string | undefined | null;

export interface PngMapListCompatOptions {
  propriedadeIds?: string[];
  perfil?: PngMapListPerfil;
}

export interface PngMapaCompatItem {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: PngMapCategoria;
  categoria_label: string;
  subcategoria: string;
  tipo_material: typeof PNG_LOCAL_MAPA_TIPO_MATERIAL;
  tipo_anexo: typeof PNG_LOCAL_MAPA_TIPO_ANEXO;
  elemento?: PngMapElemento;
  elemento_label?: string;
  profundidade?: string;
  produtor_id: string;
  fazenda_id: string;
  propriedade_id: string;
  talhao: string;
  talhao_id?: string | null;
  talhao_nome: string;
  safra?: string;
  ano?: number;
  arquivo_nome_original: string;
  arquivo_url?: string;
  arquivo_uri_local?: string;
  formato_arquivo: 'png';
  tamanho_arquivo?: number;
  arquivo_mime?: string;
  origem: typeof PNG_LOCAL_MAPA_ORIGEM;
  status: PngMapImportMetadata['status'];
  visivel_para_produtor: boolean;
  disponivel_download: boolean;
  disponivel_para_download: boolean;
  data_criacao: string;
  data_atualizacao: string;
  importado_em: string;
  atualizado_em: string;
  png_map_import_id: string;
  is_png_local: true;
  observacoes?: string;
}

export interface PngLocalOpenStatus {
  supported: boolean;
  message: string;
}

const ELEMENTO_LABELS: Record<PngMapElemento, string> = {
  ph: 'pH',
  fosforo: 'Fósforo',
  potassio: 'Potássio',
  argila: 'Argila',
  materia_organica: 'Matéria orgânica',
  ndvi: 'NDVI',
  produtividade: 'Produtividade',
  sementes: 'Sementes',
  linhas_plantio: 'Linhas de plantio',
  outro: 'Material técnico',
};

const CATEGORIA_LABELS: Record<PngMapCategoria, string> = {
  fertilidade: 'Fertilidade',
  indice_vegetacao: 'Índice de vegetação',
  produtividade: 'Produtividade',
  plantio: 'Plantio',
  operacional: 'Operacional',
  outro: 'Material técnico',
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }

  return '';
};

const normalizePropriedadeIds = (ids?: string[]): Set<string> => new Set(
  (ids ?? []).map((id) => firstNonEmptyString(id)).filter(Boolean)
);

const getCategoriaLabel = (metadata: PngMapImportMetadata): string =>
  CATEGORIA_LABELS[metadata.categoria] || firstNonEmptyString(metadata.categoria_label, metadata.categoria);

const getElementoLabel = (metadata: PngMapImportMetadata): string =>
  metadata.elemento
    ? ELEMENTO_LABELS[metadata.elemento] || firstNonEmptyString(metadata.elemento_label, metadata.elemento)
    : firstNonEmptyString(metadata.elemento_label, metadata.categoria_label, metadata.categoria);

const getTalhaoLabel = (metadata: PngMapImportMetadata): string => {
  if (metadata.escopo === 'talhao') {
    return firstNonEmptyString(metadata.talhao_nome, metadata.talhao_id, 'Talhão específico');
  }

  return 'Propriedade inteira';
};

const getSafraCompat = (metadata: PngMapImportMetadata): string | undefined =>
  firstNonEmptyString(metadata.safra, metadata.ano) || undefined;

export const isPngLocalMapa = (mapa?: Record<string, any> | null): boolean =>
  mapa?.tipo_anexo === PNG_LOCAL_MAPA_TIPO_ANEXO
  || mapa?.is_png_local === true
  || (
    mapa?.origem === PNG_LOCAL_MAPA_ORIGEM
    && typeof mapa?.arquivo_uri_local === 'string'
    && mapa.arquivo_uri_local.trim().length > 0
  );

export const evaluatePngLocalMapaOpen = (
  mapa?: Record<string, any> | null
): PngLocalOpenStatus => ({
  supported: !isPngLocalMapa(mapa),
  message: isPngLocalMapa(mapa) ? PNG_LOCAL_MAPA_OPEN_MESSAGE : '',
});

export const canShowPngMapImportInMapaList = (
  metadata: PngMapImportMetadata,
  options: PngMapListCompatOptions = {}
): boolean => {
  if (!metadata || metadata.status !== 'ativo') return false;

  const propriedadeIds = normalizePropriedadeIds(options.propriedadeIds);
  if (
    propriedadeIds.size > 0
    && !propriedadeIds.has(metadata.propriedade_id)
    && !propriedadeIds.has(metadata.fazenda_id)
  ) {
    return false;
  }

  if (options.perfil === 'produtor') {
    return metadata.visivel_para_produtor === true;
  }

  return true;
};

export const pngMapImportToMapaCompat = (
  metadata: PngMapImportMetadata
): PngMapaCompatItem => {
  const categoriaLabel = getCategoriaLabel(metadata);
  const elementoLabel = getElementoLabel(metadata);
  const talhaoLabel = getTalhaoLabel(metadata);
  const safra = getSafraCompat(metadata);
  const arquivoUriLocal = firstNonEmptyString(metadata.arquivo_uri_local) || undefined;
  const descricao = firstNonEmptyString(metadata.descricao) || undefined;

  return {
    id: `png_local:${metadata.id}`,
    titulo: metadata.titulo,
    descricao,
    categoria: metadata.categoria,
    categoria_label: categoriaLabel,
    subcategoria: elementoLabel || categoriaLabel,
    tipo_material: PNG_LOCAL_MAPA_TIPO_MATERIAL,
    tipo_anexo: PNG_LOCAL_MAPA_TIPO_ANEXO,
    elemento: metadata.elemento,
    elemento_label: elementoLabel || undefined,
    profundidade: firstNonEmptyString(metadata.profundidade) || undefined,
    produtor_id: metadata.fazenda_id,
    fazenda_id: metadata.fazenda_id,
    propriedade_id: metadata.propriedade_id,
    talhao: talhaoLabel,
    talhao_id: metadata.escopo === 'talhao' ? firstNonEmptyString(metadata.talhao_id) || null : null,
    talhao_nome: talhaoLabel,
    safra,
    ano: metadata.ano,
    arquivo_nome_original: metadata.arquivo_nome_original,
    arquivo_url: arquivoUriLocal,
    arquivo_uri_local: arquivoUriLocal,
    formato_arquivo: 'png',
    tamanho_arquivo: metadata.arquivo_tamanho_bytes,
    arquivo_mime: metadata.arquivo_mime,
    origem: PNG_LOCAL_MAPA_ORIGEM,
    status: metadata.status,
    visivel_para_produtor: metadata.visivel_para_produtor,
    disponivel_download: metadata.status === 'ativo',
    disponivel_para_download: metadata.status === 'ativo',
    data_criacao: metadata.importado_em,
    data_atualizacao: metadata.atualizado_em,
    importado_em: metadata.importado_em,
    atualizado_em: metadata.atualizado_em,
    png_map_import_id: metadata.id,
    is_png_local: true,
    observacoes: descricao,
  };
};

export const pngMapImportsToMapaCompatList = (
  imports: PngMapImportMetadata[],
  options: PngMapListCompatOptions = {}
): PngMapaCompatItem[] =>
  (imports ?? [])
    .filter((metadata) => canShowPngMapImportInMapaList(metadata, options))
    .map(pngMapImportToMapaCompat);

export const mergeMapasWithPngMapImports = <TMapa extends Record<string, any>>(
  mapas: TMapa[],
  imports: PngMapImportMetadata[],
  options: PngMapListCompatOptions = {}
): Array<TMapa | PngMapaCompatItem> => [
  ...(mapas ?? []),
  ...pngMapImportsToMapaCompatList(imports ?? [], options),
];
