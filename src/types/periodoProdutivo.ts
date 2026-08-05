/**
 * Contrato local para organizacao opcional de Safra/Safrinha.
 *
 * O MVP guarda apenas metadados pequenos em AsyncStorage. Nao ha arquivo,
 * geometria, mapa, prescricao, binario ou conteudo bruto nesta entidade.
 */

export const PERIODO_PRODUTIVO_VERSION = 1;

export const PERIODO_PRODUTIVO_STORAGE_KEY = '@tche:periodos-produtivos:v1';

export const PERIODO_PRODUTIVO_TIPOS = [
  'safra',
  'safrinha',
] as const;

export type PeriodoProdutivoTipo = typeof PERIODO_PRODUTIVO_TIPOS[number];

export const PERIODO_PRODUTIVO_STATUSES = [
  'planejada',
  'em_andamento',
  'encerrada',
] as const;

export type PeriodoProdutivoStatus = typeof PERIODO_PRODUTIVO_STATUSES[number];

export const PERIODO_PRODUTIVO_REGISTRO_STATUSES = [
  'ativo',
  'removido',
] as const;

export type PeriodoProdutivoRegistroStatus = typeof PERIODO_PRODUTIVO_REGISTRO_STATUSES[number];

export type PeriodoProdutivoOrigem = 'local';

export interface PeriodoProdutivoMetadata {
  id: string;
  propriedade_id: string;
  nome_propriedade?: string;

  tipo_periodo: PeriodoProdutivoTipo;
  tipo_periodo_label: string;
  cultura: string;
  ano_agricola: string;
  label: string;

  data_inicio?: string;
  data_fim?: string;
  status: PeriodoProdutivoStatus;
  observacoes?: string;

  talhao_id?: string;
  talhao_nome?: string;

  criado_por_user_id?: string;
  criado_por_nome?: string;
  criado_em: string;
  atualizado_em: string;
  removido_em?: string;

  registro_status: PeriodoProdutivoRegistroStatus;
  origem: PeriodoProdutivoOrigem;
  versao: number;
}

export type PeriodoProdutivoMetadataInput = Partial<
  Pick<
    PeriodoProdutivoMetadata,
    | 'id'
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'tipo_periodo'
    | 'tipo_periodo_label'
    | 'cultura'
    | 'ano_agricola'
    | 'label'
    | 'data_inicio'
    | 'data_fim'
    | 'status'
    | 'observacoes'
    | 'talhao_id'
    | 'talhao_nome'
    | 'criado_por_user_id'
    | 'criado_por_nome'
    | 'registro_status'
    | 'origem'
  >
>;

export type PeriodoProdutivoMetadataPatch = Partial<
  Pick<
    PeriodoProdutivoMetadata,
    | 'propriedade_id'
    | 'nome_propriedade'
    | 'tipo_periodo'
    | 'tipo_periodo_label'
    | 'cultura'
    | 'ano_agricola'
    | 'label'
    | 'data_inicio'
    | 'data_fim'
    | 'status'
    | 'observacoes'
    | 'talhao_id'
    | 'talhao_nome'
    | 'criado_por_user_id'
    | 'criado_por_nome'
    | 'registro_status'
  >
>;
