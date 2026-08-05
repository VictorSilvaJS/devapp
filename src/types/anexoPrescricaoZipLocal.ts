export const PRESCRIPTION_ZIP_IMPORT_VERSION = 1;

export const PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY = '@tche:prescription-zip-imports:v1';

export const PRESCRIPTION_ZIP_STATUSES = [
  'rascunho',
  'ativo',
  'substituido',
  'removido',
  'erro',
] as const;

export type PrescriptionZipStatus = typeof PRESCRIPTION_ZIP_STATUSES[number];

export const PRESCRIPTION_ZIP_CAMADAS = [
  'prescricao',
  'taxa_variavel',
  'aplicacao',
  'pacote_prescricao',
] as const;

export type PrescriptionZipCamada = typeof PRESCRIPTION_ZIP_CAMADAS[number];

export type PrescriptionZipEscopo = 'propriedade' | 'talhao';

export type PrescriptionZipOrigem = 'arquivo_local';

export interface PrescriptionZipImportMetadata {
  id: string;
  propriedade_id: string;
  nome_propriedade?: string;

  titulo: string;
  descricao?: string;
  categoria: 'prescricao';
  categoria_label: 'Prescrição';
  tipo_material: 'prescricao';
  camada: PrescriptionZipCamada;
  camada_label: string;
  elemento?: PrescriptionZipCamada;
  elemento_label?: string;

  safra?: string;
  ano?: number;

  escopo: PrescriptionZipEscopo;
  talhao_id?: string;
  talhao_nome?: string;

  arquivo_nome_original: string;
  arquivo_uri_local?: string;
  arquivo_tamanho_bytes?: number;
  arquivo_mime?: string;
  formato_arquivo: 'zip';

  importado_por_usuario_id?: string;
  importado_por_nome?: string;
  importado_em: string;
  atualizado_em: string;

  status: PrescriptionZipStatus;
  visivel_para_produtor: boolean;
  origem: PrescriptionZipOrigem;
  versao: number;
}

export type PrescriptionZipImportMetadataInput = Partial<
  Pick<
    PrescriptionZipImportMetadata,
    | 'id'
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'titulo'
    | 'descricao'
    | 'camada'
    | 'camada_label'
    | 'elemento'
    | 'elemento_label'
    | 'safra'
    | 'ano'
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
  titulo: string;
};

export type PrescriptionZipImportMetadataPatch = Partial<
  Pick<
    PrescriptionZipImportMetadata,
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'titulo'
    | 'descricao'
    | 'camada'
    | 'camada_label'
    | 'elemento'
    | 'elemento_label'
    | 'safra'
    | 'ano'
    | 'escopo'
    | 'talhao_id'
    | 'talhao_nome'
    | 'arquivo_nome_original'
    | 'arquivo_uri_local'
    | 'arquivo_tamanho_bytes'
    | 'arquivo_mime'
    | 'status'
    | 'visivel_para_produtor'
  >
>;
