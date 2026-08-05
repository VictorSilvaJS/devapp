import type {
  MaterialTecnicoCategoria,
  MaterialTecnicoFormato,
  MaterialTecnicoImportMetadata,
} from '../types/materialTecnicoLocal';

export const MATERIAL_TECNICO_LOCAL_TIPO_ANEXO = 'material_tecnico_local';
export const MATERIAL_TECNICO_LOCAL_ORIGEM = 'arquivo_local';
export const MATERIAL_TECNICO_LOCAL_FILE_NOT_FOUND_MESSAGE =
  'Arquivo local não encontrado neste aparelho.';
export const MATERIAL_TECNICO_LOCAL_UNSAFE_URI_MESSAGE =
  'Este arquivo local não pode ser aberto por segurança.';
export const MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE =
  'Não foi possível abrir este material local.';

export interface MaterialTecnicoListCompatOptions {
  propriedadeIds?: string[];
  perfil?: 'admin' | 'colaborador' | 'produtor' | string | null;
}

export interface MaterialTecnicoMapaCompatItem {
  id: string;
  titulo: string;
  categoria: MaterialTecnicoCategoria;
  categoria_label: string;
  subcategoria: string;
  tipo_material: 'material_tecnico';
  tipo_anexo: typeof MATERIAL_TECNICO_LOCAL_TIPO_ANEXO;
  produtor_id: string;
  fazenda_id: string;
  propriedade_id: string;
  ano: number;
  safra?: string;
  periodo_produtivo_id?: string;
  periodo_produtivo_label?: string;
  profundidade?: string;
  escopo: 'propriedade' | 'talhao';
  talhao: string;
  talhao_id?: string | null;
  talhao_nome: string;
  elemento?: string;
  elemento_label?: string;
  arquivo_nome_original: string;
  arquivo_url?: string;
  arquivo_uri_local?: string;
  formato_arquivo: MaterialTecnicoFormato;
  tamanho_arquivo?: number;
  arquivo_mime?: string;
  origem: typeof MATERIAL_TECNICO_LOCAL_ORIGEM;
  status: MaterialTecnicoImportMetadata['status'];
  visivel_para_produtor: boolean;
  disponivel_download: boolean;
  disponivel_para_download: boolean;
  data_criacao: string;
  data_atualizacao: string;
  importado_em: string;
  atualizado_em: string;
  versao: number;
  material_tecnico_import_id: string;
  is_material_tecnico_local: true;
}

export interface MaterialTecnicoStoredInfoResultForOpen {
  ok: boolean;
  info?: {
    exists: boolean;
    isDirectory?: boolean;
  };
}

export interface MaterialTecnicoImageSourceResult {
  ok: boolean;
  reason: 'ok' | 'not_material_local' | 'not_png' | 'missing_uri' | 'unsafe_uri' | 'file_not_found' | 'file_info_failed';
  message: string;
  source?: { uri: string };
}

export interface MaterialTecnicoImageSourceDeps {
  isSafeMaterialTecnicoStorageUri?: (uri: string) => boolean;
  getStoredMaterialTecnicoInfo?: (uri: string) => Promise<MaterialTecnicoStoredInfoResultForOpen>;
}

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const normalizeLocalUri = (value: unknown): string =>
  firstNonEmptyString(value).replace(/\\/g, '/');

const normalizePropriedadeIds = (ids?: string[]): Set<string> =>
  new Set((ids ?? []).map((id) => firstNonEmptyString(id)).filter(Boolean));

const getTalhaoLabel = (metadata: MaterialTecnicoImportMetadata): string =>
  metadata.escopo === 'talhao'
    ? firstNonEmptyString(metadata.talhao_nome, metadata.talhao_id, 'Talhão específico')
    : 'Propriedade inteira';

const getSubcategoriaLabel = (metadata: MaterialTecnicoImportMetadata): string =>
  metadata.categoria === 'prescricao'
    && metadata.prescricao_inferida
    && metadata.prescricao_inferida !== 'nao_identificada'
    ? firstNonEmptyString(metadata.prescricao_inferida_label)
    : '';

export const isMaterialTecnicoLocalMapa = (
  mapa?: Record<string, any> | null
): boolean =>
  mapa?.tipo_anexo === MATERIAL_TECNICO_LOCAL_TIPO_ANEXO
  || mapa?.is_material_tecnico_local === true
  || (typeof mapa?.id === 'string' && mapa.id.startsWith('material_local:'));

export const canShowMaterialTecnicoImportInMapaList = (
  metadata: MaterialTecnicoImportMetadata,
  options: MaterialTecnicoListCompatOptions = {}
): boolean => {
  if (!metadata || metadata.status !== 'ativo') return false;

  const propriedadeIds = normalizePropriedadeIds(options.propriedadeIds);
  if (
    propriedadeIds.size > 0
    && !propriedadeIds.has(metadata.propriedade_id)
  ) {
    return false;
  }

  return options.perfil !== 'produtor' || metadata.visivel_para_produtor === true;
};

export const materialTecnicoImportToMapaCompat = (
  metadata: MaterialTecnicoImportMetadata
): MaterialTecnicoMapaCompatItem => {
  const talhaoLabel = getTalhaoLabel(metadata);
  const arquivoUriLocal = firstNonEmptyString(metadata.arquivo_uri_local) || undefined;
  const subcategoria = getSubcategoriaLabel(metadata);
  const periodoLabel = firstNonEmptyString(metadata.periodo_produtivo_label, metadata.safra) || undefined;

  return {
    id: `material_local:${metadata.id}`,
    titulo: metadata.titulo,
    categoria: metadata.categoria,
    categoria_label: metadata.categoria_label,
    subcategoria,
    tipo_material: 'material_tecnico',
    tipo_anexo: MATERIAL_TECNICO_LOCAL_TIPO_ANEXO,
    produtor_id: metadata.propriedade_id,
    fazenda_id: metadata.propriedade_id,
    propriedade_id: metadata.propriedade_id,
    ano: metadata.ano,
    safra: periodoLabel,
    periodo_produtivo_id: metadata.periodo_produtivo_id,
    periodo_produtivo_label: periodoLabel,
    profundidade: metadata.profundidade,
    escopo: metadata.escopo,
    talhao: talhaoLabel,
    talhao_id: metadata.escopo === 'talhao'
      ? firstNonEmptyString(metadata.talhao_id) || null
      : null,
    talhao_nome: talhaoLabel,
    elemento: metadata.prescricao_inferida !== 'nao_identificada'
      ? metadata.prescricao_inferida
      : undefined,
    elemento_label: metadata.prescricao_inferida !== 'nao_identificada'
      ? metadata.prescricao_inferida_label
      : undefined,
    arquivo_nome_original: metadata.arquivo_nome_original,
    arquivo_url: arquivoUriLocal,
    arquivo_uri_local: arquivoUriLocal,
    formato_arquivo: metadata.formato_arquivo,
    tamanho_arquivo: metadata.arquivo_tamanho_bytes,
    arquivo_mime: metadata.arquivo_mime,
    origem: MATERIAL_TECNICO_LOCAL_ORIGEM,
    status: metadata.status,
    visivel_para_produtor: metadata.visivel_para_produtor,
    disponivel_download: true,
    disponivel_para_download: true,
    data_criacao: metadata.importado_em,
    data_atualizacao: metadata.atualizado_em,
    importado_em: metadata.importado_em,
    atualizado_em: metadata.atualizado_em,
    versao: metadata.versao,
    material_tecnico_import_id: metadata.id,
    is_material_tecnico_local: true,
  };
};

export const materialTecnicoImportsToMapaCompatList = (
  imports: MaterialTecnicoImportMetadata[],
  options: MaterialTecnicoListCompatOptions = {}
): MaterialTecnicoMapaCompatItem[] =>
  (imports ?? [])
    .filter((metadata) => canShowMaterialTecnicoImportInMapaList(metadata, options))
    .map(materialTecnicoImportToMapaCompat);

export const mergeMapasWithMaterialTecnicoImports = <TMapa extends Record<string, any>>(
  mapas: TMapa[],
  imports: MaterialTecnicoImportMetadata[],
  options: MaterialTecnicoListCompatOptions = {}
): Array<TMapa | MaterialTecnicoMapaCompatItem> => [
  ...(mapas ?? []),
  ...materialTecnicoImportsToMapaCompatList(imports ?? [], options),
];

const isProbablySafeMaterialTecnicoUri = (uri: string): boolean => {
  const normalized = normalizeLocalUri(uri).toLowerCase();
  return normalized.startsWith('file://')
    && !normalized.includes('..')
    && normalized.includes('/tche-materiais-tecnicos/')
    && ['.png', '.pdf', '.zip'].some((extension) => normalized.endsWith(extension));
};

export const resolveMaterialTecnicoImageSource = async (
  mapa?: Record<string, any> | null,
  deps: MaterialTecnicoImageSourceDeps = {}
): Promise<MaterialTecnicoImageSourceResult> => {
  if (!isMaterialTecnicoLocalMapa(mapa)) {
    return { ok: false, reason: 'not_material_local', message: '' };
  }
  if (firstNonEmptyString(mapa?.formato_arquivo).toLowerCase() !== 'png') {
    return { ok: false, reason: 'not_png', message: '' };
  }

  const uri = normalizeLocalUri(mapa?.arquivo_uri_local);
  if (!uri) {
    return { ok: false, reason: 'missing_uri', message: MATERIAL_TECNICO_LOCAL_FILE_NOT_FOUND_MESSAGE };
  }

  let safe = false;
  try {
    safe = deps.isSafeMaterialTecnicoStorageUri
      ? deps.isSafeMaterialTecnicoStorageUri(uri)
      : isProbablySafeMaterialTecnicoUri(uri);
  } catch {
    return { ok: false, reason: 'file_info_failed', message: MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE };
  }
  if (!safe) {
    return { ok: false, reason: 'unsafe_uri', message: MATERIAL_TECNICO_LOCAL_UNSAFE_URI_MESSAGE };
  }

  if (deps.getStoredMaterialTecnicoInfo) {
    try {
      const result = await deps.getStoredMaterialTecnicoInfo(uri);
      if (!result.ok) {
        return { ok: false, reason: 'file_info_failed', message: MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE };
      }
      if (!result.info?.exists || result.info.isDirectory === true) {
        return { ok: false, reason: 'file_not_found', message: MATERIAL_TECNICO_LOCAL_FILE_NOT_FOUND_MESSAGE };
      }
    } catch {
      return { ok: false, reason: 'file_info_failed', message: MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE };
    }
  }

  return { ok: true, reason: 'ok', message: '', source: { uri } };
};

export const getMaterialTecnicoMapaAno = (mapa?: Record<string, any> | null): number | null => {
  const explicit = typeof mapa?.ano === 'number'
    ? mapa.ano
    : typeof mapa?.ano === 'string'
      ? Number.parseInt(mapa.ano.trim(), 10)
      : Number.NaN;
  if (Number.isInteger(explicit) && explicit >= 1900 && explicit <= 2100) return explicit;

  const date = firstNonEmptyString(mapa?.data_criacao);
  if (!date) return null;
  const fallback = new Date(date).getFullYear();
  return Number.isInteger(fallback) ? fallback : null;
};

export const listMaterialTecnicoAnos = (mapas: Array<Record<string, any>>): number[] =>
  [...new Set((mapas ?? []).map(getMaterialTecnicoMapaAno).filter((ano): ano is number => ano !== null))]
    .sort((a, b) => b - a);

export const groupMaterialTecnicoMapasByAnoCategoria = (
  mapas: Array<Record<string, any>>
): Array<{
  ano: number | null;
  categorias: Record<MaterialTecnicoCategoria, Array<Record<string, any>>>;
}> => {
  const groups = new Map<number | null, Record<MaterialTecnicoCategoria, Array<Record<string, any>>>>();
  for (const mapa of mapas ?? []) {
    const ano = getMaterialTecnicoMapaAno(mapa);
    const categoria = mapa?.categoria as MaterialTecnicoCategoria;
    if (!['fertilidade', 'correcao', 'prescricao'].includes(categoria)) continue;
    if (!groups.has(ano)) {
      groups.set(ano, { fertilidade: [], correcao: [], prescricao: [] });
    }
    groups.get(ano)?.[categoria].push(mapa);
  }

  return [...groups.entries()]
    .sort(([anoA], [anoB]) => (anoB ?? -Infinity) - (anoA ?? -Infinity))
    .map(([ano, categorias]) => ({ ano, categorias }));
};
