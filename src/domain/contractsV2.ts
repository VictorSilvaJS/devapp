export const ORGANIZACAO_TCHE_ID = 'org_tche_fertilidade' as const;

export type PerfilUsuarioV2 = 'admin' | 'colaborador' | 'produtor';
export type StatusUsuarioV2 = 'ativo' | 'inativo' | 'pendente';
export type StatusCadastroV2 = 'ativo' | 'inativo';
export type TipoVinculoPropriedadeV2 = 'titular' | 'usuario_autorizado' | 'colaborador';

export interface MockV2DatasetMetadata {
  id: string;
  tipo: 'demonstracao';
  fonte: string;
  fonte_sha256: string;
  gerado_em: string;
}

export interface OrganizacaoV2 {
  id: typeof ORGANIZACAO_TCHE_ID;
  nome: 'Tchê Fertilidade';
  status: 'ativa';
}

export interface UsuarioV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  nome: string;
  email: string;
  perfil: PerfilUsuarioV2;
  status: StatusUsuarioV2;
  telefone?: string;
  documento?: string;
  observacoes?: string;
}

export interface ProdutorV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  usuario_id: string;
  nome: string;
  status: StatusCadastroV2;
}

export interface PropriedadeV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  titular_id: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf_id: string;
  uf_sigla: string;
  area_total?: number;
  cultura_principal?: string;
  status: 'ativa' | 'inativa';
}

export interface UsuarioPropriedadeV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  usuario_id: string;
  propriedade_id: string;
  tipo_vinculo: TipoVinculoPropriedadeV2;
  status: StatusCadastroV2;
}

export interface TalhaoV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  propriedade_id: string;
  nome: string;
  codigo?: string;
  status: StatusCadastroV2;
}

export interface RecursoPropriedadeV2 {
  id: string;
  organizacao_id: typeof ORGANIZACAO_TCHE_ID;
  propriedade_id: string;
  talhao_id?: string;
  [campo: string]: unknown;
}

export interface MockV2State {
  dataset?: MockV2DatasetMetadata;
  organizacao: OrganizacaoV2;
  usuarios: UsuarioV2[];
  produtores: ProdutorV2[];
  propriedades: PropriedadeV2[];
  usuarios_propriedades: UsuarioPropriedadeV2[];
  talhoes: TalhaoV2[];
  visitas: RecursoPropriedadeV2[];
  cadernos: RecursoPropriedadeV2[];
  materiais: RecursoPropriedadeV2[];
}
