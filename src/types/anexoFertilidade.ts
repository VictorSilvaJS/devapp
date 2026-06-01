/**
 * Tipos isolados para o contrato futuro de Anexos de Fertilidade.
 * Este arquivo ainda nao e integrado ao app, mock, telas ou servicos.
 */

export type TipoAnexoFertilidade =
  | 'anexo_fertilidade'
  | 'mapa_talhao'
  | 'mapa_limite'
  | 'mapa_ndvi'
  | 'laudo'
  | 'material_tecnico'
  | 'documento';

export type CategoriaAnexoFertilidade =
  | 'fertilidade'
  | 'plantio'
  | 'correcao'
  | 'indice_vegetacao'
  | 'limites'
  | 'documento';

export type TipoMaterialAnexoFertilidade =
  | 'diagnostico'
  | 'recomendacao'
  | 'demarcacao'
  | 'imagem'
  | 'laudo'
  | 'documento'
  | 'outro';

export type ElementoFertilidade =
  | 'ph'
  | 'argila'
  | 'materia_organica'
  | 'fosforo'
  | 'potassio'
  | 'calcio'
  | 'magnesio'
  | 'saturacao_bases'
  | 'ctc'
  | 'outro';

export type StatusAnexoFertilidade =
  | 'rascunho'
  | 'pendente_revisao'
  | 'liberado'
  | 'arquivado'
  | 'bloqueado';

export type OrigemAnexoFertilidade =
  | 'drive_importado'
  | 'upload_manual'
  | 'backend'
  | 'mock'
  | 'outro';

export type FormatoArquivoAnexo =
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'pdf'
  | 'kml'
  | 'kmz'
  | 'geojson'
  | 'json'
  | 'dwg'
  | 'shp'
  | 'zip'
  | 'outro';

export interface AnexoFertilidade {
  id: string;

  /** Nome preferencial futuro para vinculo com a unidade operacional. */
  propriedade_id: string;

  /** Legado/mock temporario enquanto rotas, mocks e contratos usam fazenda_id. */
  fazenda_id?: string;

  tipo_anexo: TipoAnexoFertilidade;
  categoria: CategoriaAnexoFertilidade;
  tipo_material: TipoMaterialAnexoFertilidade;

  elemento?: ElementoFertilidade;
  elemento_label?: string;
  profundidade?: string;

  talhao_id?: string | null;
  talhao_nome?: string;

  safra?: string;

  arquivo_nome_original: string;

  /** O arquivo fisico fica em storage; o app guarda metadados e URL. */
  arquivo_url: string;
  formato_arquivo: FormatoArquivoAnexo;
  tamanho_arquivo?: number;

  origem?: OrigemAnexoFertilidade;
  status: StatusAnexoFertilidade;
  visivel_para_produtor: boolean;

  observacoes?: string;

  criado_em?: string;
  atualizado_em?: string;

  /** No fluxo real, metadados inferidos devem ser confirmados manualmente. */
  metadados_confirmados?: boolean;
}
