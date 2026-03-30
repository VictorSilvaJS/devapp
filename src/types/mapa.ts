/**
 * Tipos para Sistema de Mapas Offline-First
 * Arquitetura: Servidor converte KML → GeoJSON → App sincroniza → Cache local
 */

// ─────────────────────────────────────────────────────────────
// TIPOS GEOESPACIAIS (GeoJSON)
// ─────────────────────────────────────────────────────────────

export interface PontoPoligono {
  lat: number;
  lng: number;
}

export interface CoordenadasGeoJSON {
  type: 'Polygon' | 'MultiPolygon' | 'LineString';
  coordinates: number[][][] | number[][];
}

// ─────────────────────────────────────────────────────────────
// DADOS DO TALHÃO (vindo da API do servidor)
// ─────────────────────────────────────────────────────────────

/**
 * Talhão com dados completos sincronizados do servidor
 * Inclui metadados de cache e sincronização
 */
export interface MapaTalhao {
  id: string;
  talhao: string;                      // nome do talhão (T01, T02, etc)
  nome?: string;
  area_hectares: number;
  perimetro_km?: number;
  poligono: PontoPoligono[];           // formato simplificado (~220 pts)
  poligono_geojson?: CoordenadasGeoJSON; // GeoJSON opcional para compatibilidade
  cor?: string;
  cultura_atual?: string;
  textura?: string;
  tipo_solo?: string;
  safra?: string;

  // ─── Metadados de Sincronização ───────────────────────────
  /** ID do servidor — conecta ao serviço de tiles de satélite */
  servidor_id?: string;
  /** Timestamp em milissegundos — último update do servidor */
  timestamp_servidor?: number;
  /** Timestamp local — quando foi sincronizado no device */
  timestamp_sincronizado?: number;
  /** Hash MD5 do GeoJSON — detecta alterações sem re-descarregar */
  hash_geojson?: string;
  /** Estado de sincronização */
  status_sincronizacao?: 'pendente' | 'sincronizando' | 'sincronizado' | 'erro';
  /** Flag: requer re-download? */
  requer_update?: boolean;
}

/**
 * Resposta da API ao solicitar mapas de uma fazenda
 */
export interface MapaFazendaResponse {
  produtor_id: string;
  fazenda_nome: string;
  ano: number;
  gerados_em: number;              // timestamp servidor
  talhoes: MapaTalhao[];
  /** URL base para download de tiles de satélite */
  tiles_url_base?: string;
  /** Bounds do mapa em GeoJSON FeatureCollection */
  bbox?: {
    norte: number;
    sul: number;
    leste: number;
    oeste: number;
  };
  /** Metadados gerais */
  versao_dados: string;
  checksum_completo?: string;      // para validar integridade do batch
}

// ─────────────────────────────────────────────────────────────
// TILES DE SATÉLITE (cache offline)
// ─────────────────────────────────────────────────────────────

/**
 * Metadados de tiles de satélite baixados para cache
 */
export interface CacheTilesSatelite {
  produtor_id: string;
  talhao_id: string;
  zoom_levels: number[];           // [10, 11, 12, 13, 14, 15]
  data_download: number;           // timestamp
  tamanho_mb: number;
  status: 'baixando' | 'completo' | 'erro';
  caminho_local: string;           // onde está armazenado
  data_expiracao?: number;         // gerar expiração depois?
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO COM SERVIDOR
// ─────────────────────────────────────────────────────────────

/**
 * Requisição de sincronização — o device pergunta ao servidor:
 * "Qual mapa foi atualizado após data_ultima_sincronizacao?"
 */
export interface RequisicaoSincronizacao {
  produtor_id: string;
  data_ultima_sincronizacao: number;  // timestamp milissegundos
  versao_app: string;
  /** device_id para rastreamento de uso de dados */
  device_id?: string;
}

/**
 * Resposta do servidor — lista mapa que mudou
 */
export interface RespostaSincronizacao {
  /** Mapas que foram alterados/criados após a data */
  mapas_atualizados: MapaTalhao[];
  /** Mapas apagados desde a última sincronização */
  mapas_removidos: string[];
  /** Proxima sincronização recomendada (ms) */
  proxima_sincronizacao_em: number;
  /** Token para próxima requisição (cache-busting) */
  sync_token?: string;
}

/**
 * Log local de sincronização — salvo no device
 */
export interface LogSincronizacao {
  id: string;
  produtor_id: string;
  timestamp_requisicao: number;
  timestamp_resposta: number;
  status: 'sucesso' | 'erro' | 'parcial';
  total_talhoes_atualizados: number;
  total_talhoes_removidos: number;
  tamanho_download_mb: number;
  erro?: string;
}

// ─────────────────────────────────────────────────────────────
// ESTADO LOCAL DA APLICAÇÃO
// ─────────────────────────────────────────────────────────────

/**
 * Estado de um mapa no dispositivo local
 */
export interface EstadoMapaLocal {
  produtor_id: string;
  talhao_id: string;
  /** Está disponível offline? */
  disponivel_offline: boolean;
  /** Quanto % foi sincronizado (0-100) */
  progresso_sincronizacao: number;
  /** Tamanho ocupado em MB */
  tamanho_mb: number;
  /** Data da última sincronização bem-sucedida */
  ultima_sincronizacao: number;
  /** Próxima sincronização sugerida */
  proxima_sincronizacao: number;
  /** Notificação de update disponível? */
  update_disponivel: boolean;
}

/**
 * Configuração de preferências de sincronização
 */
export interface ConfigSincronizacao {
  /** Sincronizar via WiFi apenas? */
  apenas_wifi: boolean;
  /** Sincronizar automaticamente? */
  auto_sincronizar: boolean;
  /** Intervalo mínimo entre sincronizações (ms) — 24h padrão */
  intervalo_minimo_ms: number;
  /** Limpar dados com mais de X dias */
  limpar_dados_apos_dias?: number;
  /** Zoom máximo para baixar tiles (mais zoom = mais banda) */
  zoom_maximo_tiles?: number;
  /** Tamanho máximo de cache em MB */
  tamanho_cache_maximo_mb?: number;
}

// ─────────────────────────────────────────────────────────────
// RESPOSTA DA API PARA DE NOVO ENDPOINT
// ─────────────────────────────────────────────────────────────

/**
 * Endpoint POST /api/mapas/sincronizar
 * Retorna quais mapas precisam de update desde uma data
 */
export interface RequisicaoAPISincronizar {
  produtor_id: string;
  ultima_sincronizacao?: number;  // timestamp ms — se null, retorna tudo
}

/**
 * Endpoint GET /api/mapas/{talhao_id}/tiles
 * Retorna URL para download de tiles de satélite para a área
 */
export interface RequisicaoAPITiles {
  talhao_id: string;
  zoom_levels: number[];  // [13, 14, 15]
  formato?: 'mbtiles' | 'xyz';  // se 'mbtiles', retorna um arquivo .mbtiles
}

export interface RespostaAPITiles {
  url_download: string;
  tamanho_mb: number;
  formato: string;
  validade_horas: number;  // quantas horas essa URL é válida
  checksum?: string;
}
