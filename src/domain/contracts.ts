/**
 * Contratos canonicos internos da Fase 2.
 *
 * Base documental ativa:
 * - docs/project/regras-de-negocio.md
 * - docs/project/decisoes-consolidadas.md
 * - docs/project/escopo-mvp.md
 * - docs/project/pendencias-de-definicao.md
 *
 * Decisoes desta camada:
 * - `produtor` segue como termo oficial provisiorio do dominio.
 * - `fazenda` e a unidade central para mapas, visitas, caderno e limites.
 * - `produtor_id` permanece canonico apenas quando aponta para o produtor.
 * - Entidades ligadas ao contexto operacional usam `fazenda_id`.
 * - Categorias de mapa seguem como catalogo provisiorio de implementacao
 *   enquanto a taxonomia final continuar pendente na documentacao ativa.
 */

export const PERFIS_USUARIO_CANONICOS = ['admin', 'colaborador', 'produtor'] as const;
export type PerfilUsuarioCanonico = typeof PERFIS_USUARIO_CANONICOS[number];

export const CATEGORIAS_MAPA_PROVISORIAS = [
  'fertilidade',
  'correcao',
  'indice_vegetacao',
  'colheita',
  'plantio',
  'panorama',
] as const;

export type CategoriaMapaProvisoria = typeof CATEGORIAS_MAPA_PROVISORIAS[number];

export const ELEMENTOS_DIAGNOSTICO_MVP = [
  'argila',
  'ph',
  'fosforo',
  'potassio',
  'materia_organica',
  'calcio',
  'magnesio',
  'ctc',
  'saturacao_bases',
  'aluminio',
  'enxofre',
] as const;

export type ElementoDiagnosticoMvp = typeof ELEMENTOS_DIAGNOSTICO_MVP[number];

export interface CoordenadaPoligono {
  lat: number;
  lng: number;
}

export interface CoordenadasMapa {
  latitude?: number;
  longitude?: number;
  poligono?: CoordenadaPoligono[];
}

export interface UsuarioCanonico {
  id: string;
  nome: string;
  email?: string;
  senha?: string;
  perfil: PerfilUsuarioCanonico | string;
  /**
   * Referencia ao produtor titular quando o usuario pertence ao perfil produtor.
   * Mantido como `produtor_id` para evitar um segundo eixo semantico desnecessario.
   */
  produtor_id?: string;
  telefone?: string;
  regiao?: string;
  sub_regioes?: string[];
  regioes_acesso?: string[];
  ativo?: boolean;
  data_cadastro?: string;
}

export interface ProdutorCanonico {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  data_cadastro?: string;
}

export interface FazendaCanonica {
  id: string;
  /**
   * ID do produtor titular da fazenda.
   * No legado, este mesmo valor costuma aparecer como `proprietario_id`.
   */
  produtor_id: string;
  /**
   * Nome canonico da fazenda.
   * No legado, costuma aparecer em `fazenda`.
   */
  nome: string;
  /**
   * Nome do produtor titular quando esta informacao vier misturada
   * ao registro legado da fazenda.
   */
  produtor_nome?: string;
  area_total?: number;
  cultura_atual?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
  microregiao?: string;
  cep?: string;
  ultima_analise?: string;
  status?: string;
  data_cadastro?: string;
}

export interface MapaCanonico {
  id: string;
  titulo: string;
  /**
   * Campo mantido como string para nao congelar a taxonomia final enquanto
   * `pendencias-de-definicao.md` ainda trata o tema como aberto.
   */
  categoria: string;
  subcategoria?: string;
  /**
   * Referencia canonica da fazenda ao qual o mapa pertence.
   * No legado, este valor costuma aparecer como `produtor_id`.
   */
  fazenda_id: string;
  talhao: string;
  /**
   * Classificacao operacional do arquivo dentro da biblioteca da fazenda.
   * No MVP, "diagnostico" cobre mapas como argila, fosforo e pH; outros
   * valores continuam livres enquanto a taxonomia final nao estiver fechada.
   */
  tipo_material?: string;
  /**
   * Elemento/camada representado pelo arquivo tecnico, quando aplicavel.
   * Ex.: argila, fosforo, ph, potassio.
   */
  elemento?: string;
  /**
   * Profundidade da amostra/medicao quando ela estiver no nome do arquivo.
   * Ex.: 10-20 cm.
   */
  profundidade?: string;
  data_criacao?: string;
  safra?: string;
  arquivo_url?: string;
  arquivo_panorama_url?: string;
  formato_arquivo?: string;
  tamanho_arquivo?: number | string;
  coordenadas?: CoordenadasMapa;
  observacoes?: string;
  disponivel_download: boolean;
  disponivel_offline?: boolean;
}

export interface VisitaCanonica {
  id: string;
  fazenda_id: string;
  tecnico_responsavel: string;
  data_visita: string;
  objetivo: string;
  observacoes?: string;
  recomendacoes?: string;
  fotos?: string[];
  clima?: string;
  proximaVisita?: string;
  status?: string;
}

export interface CadernoCampoCanonico {
  id: string;
  fazenda_id: string;
  colaborador_responsavel: string;
  data_atividade: string;
  tipo_atividade: string;
  talhao?: string;
  produtos_utilizados?: string[];
  dosagem?: string;
  area_aplicada?: number | null;
  condicoes_clima?: string;
  observacoes?: string;
  visivel_para_produtor?: boolean;
  fotos?: string[];
  data_criacao?: string;
  /**
   * Campo reservado para consolidacao futura de autoria sem reabrir a modelagem agora.
   */
  criado_por_user_id?: string;
}

export interface LimiteAreaCanonico {
  id: string;
  nome: string;
  ano: number;
  fazenda_id: string;
  talhao: string;
  area_hectares?: number;
  perimetro_km?: number;
  textura?: string;
  tipo_solo?: string;
  elementos?: Record<string, number>;
  cultura_atual?: string;
  poligono: CoordenadaPoligono[];
  poligonos?: CoordenadaPoligono[][];
  cor?: string;
  data_upload?: string;
  safra?: string;
  disponivel_offline?: boolean;
  observacoes?: string;
}

export interface UsuarioLegado {
  id: string;
  nome?: string;
  full_name?: string;
  email?: string;
  senha?: string;
  perfil?: string;
  produtor_id?: string;
  telefone?: string;
  regiao?: string;
  sub_regioes?: string[];
  regioes_acesso?: string[];
  ativo?: boolean;
  data_cadastro?: string;
  [key: string]: unknown;
}

/**
 * Registro legado hoje exposto como "Produtor", mas semanticamente ainda
 * representando uma fazenda vinculada a um produtor titular.
 */
export interface FazendaLegada {
  id: string;
  proprietario_id?: string;
  produtor_id?: string;
  nome?: string;
  fazenda?: string;
  area_total?: number;
  cultura_atual?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
  microregiao?: string;
  cep?: string;
  ultima_analise?: string;
  status?: string;
  data_cadastro?: string;
  [key: string]: unknown;
}

export interface MapaLegado {
  id: string;
  titulo?: string;
  categoria?: string;
  subcategoria?: string;
  produtor_id?: string;
  fazenda_id?: string;
  talhao?: string;
  tipo_material?: string;
  elemento?: string;
  profundidade?: string;
  data_criacao?: string;
  safra?: string;
  arquivo_url?: string;
  arquivo_panorama_url?: string;
  formato_arquivo?: string;
  tamanho_arquivo?: number | string;
  coordenadas?: CoordenadasMapa;
  observacoes?: string;
  disponivel_download?: boolean;
  disponivel_para_download?: boolean;
  disponivel_offline?: boolean;
  [key: string]: unknown;
}

export interface VisitaLegada {
  id: string;
  produtor_id?: string;
  fazenda_id?: string;
  tecnico_responsavel?: string;
  data_visita?: string;
  objetivo?: string;
  observacoes?: string;
  recomendacoes?: string;
  fotos?: string[];
  clima?: string;
  proximaVisita?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CadernoCampoLegado {
  id: string;
  produtor_id?: string;
  fazenda_id?: string;
  colaborador_responsavel?: string;
  data_atividade?: string;
  tipo_atividade?: string;
  talhao?: string;
  produtos_utilizados?: string[];
  dosagem?: string;
  area_aplicada?: number | null;
  condicoes_clima?: string;
  observacoes?: string;
  visivel_para_produtor?: boolean;
  fotos?: string[];
  data_criacao?: string;
  criado_por?: string;
  criado_por_user_id?: string;
  [key: string]: unknown;
}

export interface LimiteAreaLegado {
  id: string;
  nome?: string;
  ano?: number;
  produtor_id?: string;
  fazenda_id?: string;
  talhao?: string;
  area_hectares?: number;
  perimetro_km?: number;
  textura?: string;
  tipo_solo?: string;
  elementos?: Record<string, number>;
  cultura_atual?: string;
  poligono?: CoordenadaPoligono[];
  cor?: string;
  data_upload?: string;
  safra?: string;
  disponivel_offline?: boolean;
  observacoes?: string;
  [key: string]: unknown;
}

export interface UsuarioCompativelBorda extends UsuarioCanonico {
  full_name: string;
}

/**
 * Tipo de borda para compatibilidade com o cadastro legado de fazenda.
 * Deve permanecer fora do nucleo canonico porque `nome` aqui continua
 * com semantica legado: nome do produtor, nao nome da fazenda.
 */
export interface FazendaCompativelBorda extends Omit<FazendaCanonica, 'nome' | 'produtor_nome'> {
  nome: string;
  fazenda: string;
  proprietario_id: string;
  produtor_nome?: string;
}

export interface MapaCompativelBorda extends MapaCanonico {
  produtor_id: string;
  disponivel_para_download: boolean;
}

export interface VisitaCompativelBorda extends VisitaCanonica {
  produtor_id: string;
}

export interface CadernoCampoCompativelBorda extends CadernoCampoCanonico {
  produtor_id: string;
  criado_por?: string;
}

export interface LimiteAreaCompativelBorda extends LimiteAreaCanonico {
  produtor_id: string;
}
