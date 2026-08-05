export const GEOJSON_IMPORT_VERSION = 1;

export const GEOJSON_IMPORT_STATUSES = [
  'rascunho',
  'validado',
  'ativo',
  'substituido',
  'removido',
  'erro',
] as const;

export type GeoJsonImportStatus = typeof GEOJSON_IMPORT_STATUSES[number];

export type GeoJsonImportOrigin = 'arquivo_local';

export interface GeoJsonImportMetadata {
  id: string;
  propriedade_id: string;
  nome_propriedade?: string;
  arquivo_nome_original: string;
  arquivo_uri_local?: string;
  arquivo_tamanho_bytes?: number;
  arquivo_mime?: string;
  importado_por_usuario_id?: string;
  importado_por_nome?: string;
  importado_em: string;
  atualizado_em: string;
  status: GeoJsonImportStatus;
  talhoes_count?: number;
  polygon_parts_count?: number;
  geometry_types?: string[];
  area_total_hectares?: number;
  safra?: string;
  ano?: number;
  observacoes?: string;
  erro_validacao?: string;
  origem: GeoJsonImportOrigin;
  versao: number;
}

export type GeoJsonImportMetadataInput = Partial<
  Pick<
    GeoJsonImportMetadata,
    | 'id'
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'arquivo_uri_local'
    | 'arquivo_tamanho_bytes'
    | 'arquivo_mime'
    | 'importado_por_usuario_id'
    | 'importado_por_nome'
    | 'status'
    | 'talhoes_count'
    | 'polygon_parts_count'
    | 'geometry_types'
    | 'area_total_hectares'
    | 'safra'
    | 'ano'
    | 'observacoes'
    | 'erro_validacao'
  >
> & {
  arquivo_nome_original: string;
};

export type GeoJsonImportMetadataPatch = Partial<
  Pick<
    GeoJsonImportMetadata,
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'arquivo_nome_original'
    | 'arquivo_uri_local'
    | 'arquivo_tamanho_bytes'
    | 'arquivo_mime'
    | 'importado_por_usuario_id'
    | 'importado_por_nome'
    | 'status'
    | 'talhoes_count'
    | 'polygon_parts_count'
    | 'geometry_types'
    | 'area_total_hectares'
    | 'safra'
    | 'ano'
    | 'observacoes'
    | 'erro_validacao'
  >
>;
