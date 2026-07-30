import type {
  PrescriptionZipCamada,
  PrescriptionZipImportMetadata,
} from '../types/anexoPrescricaoZipLocal';

export const PRESCRIPTION_ZIP_LOCAL_TIPO_ANEXO = 'prescricao_zip_local';
export const PRESCRIPTION_ZIP_LOCAL_TIPO_MATERIAL = 'prescricao';
export const PRESCRIPTION_ZIP_LOCAL_ORIGEM = 'arquivo_local';
export const PRESCRIPTION_ZIP_DETAILS_MESSAGE =
  'Pacote técnico anexado localmente. A abertura ou processamento do ZIP não faz parte do MVP atual.';

export type PrescriptionZipListPerfil = 'admin' | 'colaborador' | 'produtor' | string | undefined | null;

export interface PrescriptionZipListCompatOptions {
  propriedadeIds?: string[];
  perfil?: PrescriptionZipListPerfil;
}

export interface PrescriptionZipMapaCompatItem {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: 'prescricao';
  categoria_label: 'Prescrição';
  subcategoria: string;
  tipo_material: typeof PRESCRIPTION_ZIP_LOCAL_TIPO_MATERIAL;
  tipo_anexo: typeof PRESCRIPTION_ZIP_LOCAL_TIPO_ANEXO;
  camada: PrescriptionZipCamada;
  camada_label: string;
  elemento: PrescriptionZipCamada;
  elemento_label: string;
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
  formato_arquivo: 'zip';
  tamanho_arquivo?: number;
  arquivo_mime?: string;
  origem: typeof PRESCRIPTION_ZIP_LOCAL_ORIGEM;
  status: PrescriptionZipImportMetadata['status'];
  visivel_para_produtor: boolean;
  disponivel_download: boolean;
  disponivel_para_download: boolean;
  data_criacao: string;
  data_atualizacao: string;
  importado_em: string;
  atualizado_em: string;
  versao: number;
  prescription_zip_import_id: string;
  is_prescription_zip_local: true;
  observacoes?: string;
}

const CAMADA_LABELS: Record<PrescriptionZipCamada, string> = {
  prescricao: 'Prescrição',
  taxa_variavel: 'Taxa variável',
  aplicacao: 'Aplicação',
  pacote_prescricao: 'Pacote de prescrição',
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

const normalizeLocalUri = (value: unknown): string =>
  firstNonEmptyString(value)
    .replace(/\\/g, '/')
    .replace(/([^:])\/{2,}/g, '$1/');

const normalizePropriedadeIds = (ids?: string[]): Set<string> => new Set(
  (ids ?? []).map((id) => firstNonEmptyString(id)).filter(Boolean)
);

const getCamadaLabel = (metadata: PrescriptionZipImportMetadata): string =>
  metadata.camada
    ? CAMADA_LABELS[metadata.camada] || firstNonEmptyString(metadata.camada_label, metadata.camada)
    : firstNonEmptyString(metadata.camada_label, metadata.elemento_label, 'Prescrição');

const getTalhaoLabel = (metadata: PrescriptionZipImportMetadata): string => {
  if (metadata.escopo === 'talhao') {
    return firstNonEmptyString(metadata.talhao_nome, metadata.talhao_id, 'Talhão específico');
  }
  return 'Propriedade inteira';
};

const getSafraCompat = (metadata: PrescriptionZipImportMetadata): string | undefined =>
  firstNonEmptyString(metadata.safra, metadata.ano) || undefined;

export const isPrescriptionZipLocalMapa = (mapa?: Record<string, any> | null): boolean =>
  mapa?.tipo_anexo === PRESCRIPTION_ZIP_LOCAL_TIPO_ANEXO
  || mapa?.is_prescription_zip_local === true
  || (
    mapa?.origem === PRESCRIPTION_ZIP_LOCAL_ORIGEM
    && typeof mapa?.formato_arquivo === 'string'
    && mapa.formato_arquivo.trim().toLowerCase() === 'zip'
    && typeof mapa?.arquivo_uri_local === 'string'
    && mapa.arquivo_uri_local.trim().length > 0
  );

export const getPrescriptionZipLocalMapaUri = (mapa?: Record<string, any> | null): string =>
  normalizeLocalUri(mapa?.arquivo_uri_local);

export const canShowPrescriptionZipImportInMapaList = (
  metadata: PrescriptionZipImportMetadata,
  options: PrescriptionZipListCompatOptions = {}
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

export const prescriptionZipImportToMapaCompat = (
  metadata: PrescriptionZipImportMetadata
): PrescriptionZipMapaCompatItem => {
  const camadaLabel = getCamadaLabel(metadata);
  const talhaoLabel = getTalhaoLabel(metadata);
  const safra = getSafraCompat(metadata);
  const arquivoUriLocal = firstNonEmptyString(metadata.arquivo_uri_local) || undefined;
  const descricao = firstNonEmptyString(metadata.descricao) || undefined;

  return {
    id: `zip_local:${metadata.id}`,
    titulo: metadata.titulo,
    descricao,
    categoria: 'prescricao',
    categoria_label: 'Prescrição',
    subcategoria: camadaLabel,
    tipo_material: PRESCRIPTION_ZIP_LOCAL_TIPO_MATERIAL,
    tipo_anexo: PRESCRIPTION_ZIP_LOCAL_TIPO_ANEXO,
    camada: metadata.camada,
    camada_label: camadaLabel,
    elemento: metadata.camada,
    elemento_label: camadaLabel,
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
    formato_arquivo: 'zip',
    tamanho_arquivo: metadata.arquivo_tamanho_bytes,
    arquivo_mime: metadata.arquivo_mime,
    origem: PRESCRIPTION_ZIP_LOCAL_ORIGEM,
    status: metadata.status,
    visivel_para_produtor: metadata.visivel_para_produtor,
    disponivel_download: false,
    disponivel_para_download: false,
    data_criacao: metadata.importado_em,
    data_atualizacao: metadata.atualizado_em,
    importado_em: metadata.importado_em,
    atualizado_em: metadata.atualizado_em,
    versao: metadata.versao,
    prescription_zip_import_id: metadata.id,
    is_prescription_zip_local: true,
    observacoes: descricao,
  };
};

export const prescriptionZipImportsToMapaCompatList = (
  imports: PrescriptionZipImportMetadata[],
  options: PrescriptionZipListCompatOptions = {}
): PrescriptionZipMapaCompatItem[] =>
  (imports ?? [])
    .filter((metadata) => canShowPrescriptionZipImportInMapaList(metadata, options))
    .map(prescriptionZipImportToMapaCompat);

export const mergeMapasWithPrescriptionZipImports = <TMapa extends Record<string, any>>(
  mapas: TMapa[],
  imports: PrescriptionZipImportMetadata[],
  options: PrescriptionZipListCompatOptions = {}
): Array<TMapa | PrescriptionZipMapaCompatItem> => [
  ...(mapas ?? []),
  ...prescriptionZipImportsToMapaCompatList(imports ?? [], options),
];
