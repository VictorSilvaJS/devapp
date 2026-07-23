/**
 * Contrato local unificado para materiais tecnicos da Propriedade.
 *
 * O arquivo fisico fica no storage interno do aparelho. O AsyncStorage guarda
 * somente estes metadados pequenos, preparando uma sincronizacao futura sem
 * misturar binario com o catalogo.
 */

export const MATERIAL_TECNICO_IMPORT_VERSION = 1;

export const MATERIAL_TECNICO_IMPORT_STORAGE_KEY = '@tche:material-tecnico-imports:v1';

export const MATERIAL_TECNICO_CATEGORIAS = [
  'fertilidade',
  'correcao',
  'prescricao',
] as const;

export type MaterialTecnicoCategoria = typeof MATERIAL_TECNICO_CATEGORIAS[number];

export const MATERIAL_TECNICO_FORMATOS = ['png', 'pdf', 'zip'] as const;

export type MaterialTecnicoFormato = typeof MATERIAL_TECNICO_FORMATOS[number];

export const MATERIAL_TECNICO_STATUSES = [
  'rascunho',
  'ativo',
  'substituido',
  'removido',
  'erro',
] as const;

export type MaterialTecnicoStatus = typeof MATERIAL_TECNICO_STATUSES[number];

export type MaterialTecnicoEscopo = 'propriedade' | 'talhao';

export type MaterialTecnicoOrigem = 'arquivo_local';

export type MaterialTecnicoPrescricaoInferida =
  | 'calcario'
  | 'fosforo'
  | 'potassio'
  | 'nao_identificada';

export interface MaterialTecnicoImportMetadata {
  id: string;
  propriedade_id: string;
  fazenda_id: string;
  nome_propriedade?: string;

  titulo: string;
  categoria: MaterialTecnicoCategoria;
  categoria_label: string;
  ano: number;

  periodo_produtivo_id?: string;
  periodo_produtivo_label?: string;
  safra?: string;

  profundidade?: string;
  escopo: MaterialTecnicoEscopo;
  talhao_id?: string;
  talhao_nome?: string;

  prescricao_inferida?: MaterialTecnicoPrescricaoInferida;
  prescricao_inferida_label?: string;

  arquivo_nome_original: string;
  arquivo_uri_local?: string;
  arquivo_tamanho_bytes?: number;
  arquivo_mime?: string;
  formato_arquivo: MaterialTecnicoFormato;

  importado_por_usuario_id?: string;
  importado_por_nome?: string;
  importado_em: string;
  atualizado_em: string;

  status: MaterialTecnicoStatus;
  visivel_para_produtor: boolean;
  origem: MaterialTecnicoOrigem;
  versao: number;
}

export type MaterialTecnicoImportMetadataInput = Partial<
  Omit<
    MaterialTecnicoImportMetadata,
    'arquivo_nome_original' | 'categoria' | 'ano' | 'formato_arquivo'
      | 'importado_em' | 'atualizado_em' | 'versao'
  >
> & {
  arquivo_nome_original: string;
  categoria: MaterialTecnicoCategoria;
  ano: number;
  formato_arquivo: MaterialTecnicoFormato;
};

export type MaterialTecnicoImportMetadataPatch = Partial<
  Omit<MaterialTecnicoImportMetadata, 'id' | 'importado_em' | 'versao'>
>;
