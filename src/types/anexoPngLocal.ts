/**
 * Contrato isolado para PNGs locais de mapas tecnicos.
 *
 * Este tipo prepara a Fase 16G sem integrar telas, mock, storage ou backend.
 * Arquivos fisicos devem ficar em storage interno; AsyncStorage deve guardar
 * apenas metadados pequenos.
 */

export const PNG_MAP_IMPORT_VERSION = 1;

export const PNG_MAP_IMPORT_STORAGE_KEY = '@tche:png-map-imports:v1';

export const PNG_MAP_STATUSES = [
  'rascunho',
  'ativo',
  'substituido',
  'removido',
  'erro',
] as const;

export type PngMapStatus = typeof PNG_MAP_STATUSES[number];

export const PNG_MAP_CATEGORIAS = [
  'fertilidade',
  'indice_vegetacao',
  'produtividade',
  'plantio',
  'operacional',
  'outro',
] as const;

export type PngMapCategoria = typeof PNG_MAP_CATEGORIAS[number];

export const PNG_MAP_ELEMENTOS = [
  'ph',
  'fosforo',
  'potassio',
  'argila',
  'materia_organica',
  'ndvi',
  'produtividade',
  'sementes',
  'linhas_plantio',
  'outro',
] as const;

export type PngMapElemento = typeof PNG_MAP_ELEMENTOS[number];

export type PngMapEscopo = 'propriedade' | 'talhao';

export type PngMapOrigem = 'arquivo_local';

export interface PngMapImportMetadata {
  id: string;
  propriedade_id: string;
  fazenda_id: string;
  nome_propriedade?: string;

  titulo: string;
  descricao?: string;
  categoria: PngMapCategoria;
  categoria_label: string;
  elemento?: PngMapElemento;
  elemento_label?: string;

  safra?: string;
  ano?: number;
  profundidade?: string;

  escopo: PngMapEscopo;
  talhao_id?: string;
  talhao_nome?: string;

  arquivo_nome_original: string;
  arquivo_uri_local?: string;
  arquivo_tamanho_bytes?: number;
  arquivo_mime?: string;

  importado_por_usuario_id?: string;
  importado_por_nome?: string;
  importado_em: string;
  atualizado_em: string;

  status: PngMapStatus;
  visivel_para_produtor: boolean;
  origem: PngMapOrigem;
  versao: number;
}

export type PngMapImportMetadataInput = Partial<
  Pick<
    PngMapImportMetadata,
    | 'id'
    | 'propriedade_id'
    | 'fazenda_id'
    | 'nome_propriedade'
    | 'titulo'
    | 'descricao'
    | 'categoria'
    | 'categoria_label'
    | 'elemento'
    | 'elemento_label'
    | 'safra'
    | 'ano'
    | 'profundidade'
    | 'escopo'
    | 'talhao_id'
    | 'talhao_nome'
    | 'arquivo_uri_local'
    | 'arquivo_tamanho_bytes'
    | 'arquivo_mime'
    | 'importado_por_usuario_id'
    | 'importado_por_nome'
    | 'status'
    | 'visivel_para_produtor'
    | 'origem'
  >
> & {
  arquivo_nome_original: string;
};

export type PngMapImportMetadataPatch = Partial<
  Pick<
    PngMapImportMetadata,
    | 'propriedade_id'
    | 'fazenda_id'
    | 'nome_propriedade'
    | 'titulo'
    | 'descricao'
    | 'categoria'
    | 'categoria_label'
    | 'elemento'
    | 'elemento_label'
    | 'safra'
    | 'ano'
    | 'profundidade'
    | 'escopo'
    | 'talhao_id'
    | 'talhao_nome'
    | 'arquivo_nome_original'
    | 'arquivo_uri_local'
    | 'arquivo_tamanho_bytes'
    | 'arquivo_mime'
    | 'importado_por_usuario_id'
    | 'importado_por_nome'
    | 'status'
    | 'visivel_para_produtor'
  >
>;
