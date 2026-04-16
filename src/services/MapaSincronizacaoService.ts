/**
 * Serviço de Sincronização de Mapas
 * 
 * Responsabilidades:
 * - Detectar quando um mapa foi atualizado no servidor
 * - Baixar apenas o que mudou (timestamp-based)
 * - Gerenciar fila de sincronização
 * - Rastrear estado local de cada mapa
 * - Retry inteligente em caso de erro
 */

import { MapaTalhao, RespostaSincronizacao, RequisicaoSincronizacao, LogSincronizacao, EstadoMapaLocal, ConfigSincronizacao } from '../types/mapa';
import {
  buildScopedMapKey,
  toEstadoMapaLocalCompativel,
  toLogSincronizacaoCompativel,
  toMapaTalhaoOfflineCompativel,
  toRequisicaoSincronizacaoCompativel,
} from './mapaOfflineCompat';

interface MapaSincronizacaoDependencies {
  now?: () => number;
  deviceIdFactory?: () => string;
  syncApi?: (req: RequisicaoSincronizacao) => Promise<RespostaSincronizacao>;
}

export class MapaSincronizacaoService {
  private logsLocal: Map<string, LogSincronizacao> = new Map();
  private estadoLocal: Map<string, EstadoMapaLocal> = new Map();
  private config: ConfigSincronizacao;
  private ultimaSincronizacao: Map<string, number> = new Map();
  private now: () => number;
  private deviceIdFactory: () => string;
  private syncApi?: (req: RequisicaoSincronizacao) => Promise<RespostaSincronizacao>;

  constructor(config?: Partial<ConfigSincronizacao>, deps: MapaSincronizacaoDependencies = {}) {
    this.config = {
      apenas_wifi: true,
      auto_sincronizar: true,
      intervalo_minimo_ms: 24 * 60 * 60 * 1000, // 24 horas
      limpar_dados_apos_dias: 30,
      zoom_maximo_tiles: 15,
      tamanho_cache_maximo_mb: 500,
      ...config
    };
    this.now = deps.now ?? (() => Date.now());
    this.deviceIdFactory = deps.deviceIdFactory ?? (() => this.gerarDeviceId());
    this.syncApi = deps.syncApi;
  }

  /**
   * Sincroniza mapas de uma fazenda
   * 
   * Fluxo:
   * 1. Verifica se passou o intervalo mínimo desde última sincronização
   * 2. Consulta servidor ("Tem algo novo desde ontem?")
   * 3. Baixa apenas talhões que mudaram
   * 4. Salva localmente com timestamp
   * 5. Retorna o que foi atualizado
   */
  async sincronizarFazendaMapas(
    fazendaId: string,
    onProgress?: (progresso: number) => void
  ): Promise<{ talhoes_atualizados: MapaTalhao[]; talhoes_removidos: string[] }> {
    const chave = `sync_${fazendaId}`;
    const ultimaSincronizacaoMs = this.ultimaSincronizacao.get(chave) || 0;
    const agoraMs = this.now();

    // ─── Validação: passou o intervalo mínimo? ───────────────────────
    if (agoraMs - ultimaSincronizacaoMs < this.config.intervalo_minimo_ms) {
      console.log(
        `[MapaSincronização] Intervalo mínimo não atingido para ${fazendaId}. ` +
        `Próxima em ${Math.round((this.config.intervalo_minimo_ms - (agoraMs - ultimaSincronizacaoMs)) / 1000 / 60)} min`
      );
      return { talhoes_atualizados: [], talhoes_removidos: [] };
    }

    console.log(`[MapaSincronização] Iniciando sincronização para ${fazendaId}`);
    onProgress?.(10);

    try {
      // ─── Montar requisição ao servidor ───────────────────────────────
      const requisicao: RequisicaoSincronizacao = toRequisicaoSincronizacaoCompativel({
        fazenda_id: fazendaId,
        data_ultima_sincronizacao: ultimaSincronizacaoMs,
        versao_app: '1.0.0', // TODO: obter da config do app
        device_id: this.obterDeviceId(),
      });

      onProgress?.(20);

      // ─── Chamar API (este seria um endpoint real do seu servidor) ───
      // Por enquanto, vamos simular
      const resposta = await this.chamarAPIMapasSincronizar(requisicao);

      onProgress?.(50);

      // ─── Processar talhões atualizados ────────────────────────────
      const talhoesSincronizados: MapaTalhao[] = [];

      for (const talhao of resposta.mapas_atualizados) {
        const talhaoCompativel = toMapaTalhaoOfflineCompativel(talhao, fazendaId);

        // Marcar como sincronizado
        talhaoCompativel.status_sincronizacao = 'sincronizado';
        talhaoCompativel.timestamp_sincronizado = agoraMs;

        // Salvar estado local
        const estado: EstadoMapaLocal = toEstadoMapaLocalCompativel({
          fazenda_id: fazendaId,
          talhao_id: talhao.id,
          disponivel_offline: true,
          progresso_sincronizacao: 100,
          tamanho_mb: this.estimarTamanhoPontos(talhaoCompativel.poligono),
          ultima_sincronizacao: agoraMs,
          proxima_sincronizacao: agoraMs + this.config.intervalo_minimo_ms,
          update_disponivel: false,
        });

        this.estadoLocal.set(buildScopedMapKey(fazendaId, talhao.id), estado);
        talhoesSincronizados.push(talhaoCompativel);
      }

      onProgress?.(75);

      // ─── Log de sucesso ────────────────────────────────────────
      const log: LogSincronizacao = toLogSincronizacaoCompativel({
        id: `log_${fazendaId}_${agoraMs}`,
        fazenda_id: fazendaId,
        timestamp_requisicao: ultimaSincronizacaoMs,
        timestamp_resposta: agoraMs,
        status: resposta.mapas_removidos.length === 0 ? 'sucesso' : 'parcial',
        total_talhoes_atualizados: talhoesSincronizados.length,
        total_talhoes_removidos: resposta.mapas_removidos.length,
        tamanho_download_mb: talhoesSincronizados.reduce((s, t) => s + this.estimarTamanhoPontos(t.poligono), 0),
      });

      this.logsLocal.set(log.id, log);
      this.ultimaSincronizacao.set(chave, agoraMs);

      onProgress?.(100);

      console.log(
        `[MapaSincronização] ✅ Sucesso. ` +
        `Atualizados: ${talhoesSincronizados.length}, ` +
        `Removidos: ${resposta.mapas_removidos.length}`
      );

      return {
        talhoes_atualizados: talhoesSincronizados,
        talhoes_removidos: resposta.mapas_removidos,
      };
    } catch (erro) {
      console.error(`[MapaSincronização] ❌ Erro:`, erro);

      const log: LogSincronizacao = toLogSincronizacaoCompativel({
        id: `log_erro_${fazendaId}_${agoraMs}`,
        fazenda_id: fazendaId,
        timestamp_requisicao: ultimaSincronizacaoMs,
        timestamp_resposta: agoraMs,
        status: 'erro',
        total_talhoes_atualizados: 0,
        total_talhoes_removidos: 0,
        tamanho_download_mb: 0,
        erro: String(erro),
      });

      this.logsLocal.set(log.id, log);
      throw erro;
    }
  }

  /**
   * Wrapper legado preservado enquanto o nome público ainda não migrou.
   */
  async sincronizarProdutorMapas(
    produtorId: string,
    onProgress?: (progresso: number) => void
  ): Promise<{ talhoes_atualizados: MapaTalhao[]; talhoes_removidos: string[] }> {
    return this.sincronizarFazendaMapas(produtorId, onProgress);
  }

  /**
   * Verifica se um talhão específico precisa de atualização
   */
  async verificarUpdateTalhaoFazenda(fazendaId: string, talhaoId: string): Promise<boolean> {
    const estadoChave = buildScopedMapKey(fazendaId, talhaoId);
    const estado = this.estadoLocal.get(estadoChave);

    if (!estado) {
      return true; // nunca foi sincronizado
    }

    // Se passou mais de 30 dias, marca como desatualizado
    const diasSinceSync = (this.now() - estado.ultima_sincronizacao) / (1000 * 60 * 60 * 24);
    if (diasSinceSync > (this.config.limpar_dados_apos_dias || 30)) {
      return true;
    }

    return estado.update_disponivel || false;
  }

  async verificarUpdateTalhao(produtorId: string, talhaoId: string): Promise<boolean> {
    return this.verificarUpdateTalhaoFazenda(produtorId, talhaoId);
  }

  /**
   * Força uma sincronização completa (bypass do intervalo mínimo)
   */
  async forceSincronizarFazenda(fazendaId: string): Promise<void> {
    const chave = `sync_${fazendaId}`;
    this.ultimaSincronizacao.set(chave, 0); // zera última sincronização
    await this.sincronizarFazendaMapas(fazendaId);
  }

  async forceSincronizar(produtorId: string): Promise<void> {
    await this.forceSincronizarFazenda(produtorId);
  }

  /**
   * Obter estado local de um talhão
   */
  obterEstadoLocalFazenda(fazendaId: string, talhaoId: string): EstadoMapaLocal | null {
    return this.estadoLocal.get(buildScopedMapKey(fazendaId, talhaoId)) || null;
  }

  obterEstadoLocal(produtorId: string, talhaoId: string): EstadoMapaLocal | null {
    return this.obterEstadoLocalFazenda(produtorId, talhaoId);
  }

  /**
   * Listar todos os logs de sincronização
   */
  obterLogsFazenda(fazendaId?: string): LogSincronizacao[] {
    if (!fazendaId) {
      return Array.from(this.logsLocal.values());
    }
    return Array.from(this.logsLocal.values()).filter(log => log.fazenda_id === fazendaId);
  }

  obterLogs(produtorId?: string): LogSincronizacao[] {
    return this.obterLogsFazenda(produtorId);
  }

  /**
   * Limpar cache antigo (mais de N dias)
   */
  limparCacheAntigo(diasLimite: number = this.config.limpar_dados_apos_dias || 30): number {
    const limiteMs = this.now() - (diasLimite * 24 * 60 * 60 * 1000);
    let removidos = 0;

    for (const [chave, estado] of this.estadoLocal.entries()) {
      if (estado.ultima_sincronizacao < limiteMs) {
        this.estadoLocal.delete(chave);
        removidos++;
      }
    }

    console.log(`[MapaSincronização] Limpeza: ${removidos} entradas antigas removidas`);
    return removidos;
  }

  /**
   * Calcular estatísticas de cache
   */
  obterEstatisticasCache(): {
    total_mb: number;
    total_talhoes: number;
    talhoes_offline: number;
    proxima_limpeza_ms: number;
  } {
    let totalMb = 0;
    let talhoesOffline = 0;

    for (const estado of this.estadoLocal.values()) {
      totalMb += estado.tamanho_mb;
      if (estado.disponivel_offline) {
        talhoesOffline++;
      }
    }

    return {
      total_mb: totalMb,
      total_talhoes: this.estadoLocal.size,
      talhoes_offline: talhoesOffline,
      proxima_limpeza_ms: this.ultimaSincronizacao.size > 0
        ? Math.min(
            ...[...this.ultimaSincronizacao.values()].map(t => t + this.config.intervalo_minimo_ms)
          )
        : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────────

  /**
   * Simula chamada à API do servidor
   * Em produção, isso seria uma chamada HTTP real via Axios
   */
  private async chamarAPIMapasSincronizar(req: RequisicaoSincronizacao): Promise<RespostaSincronizacao> {
    if (this.syncApi) {
      return this.syncApi(req);
    }

    // TODO: implementar chamada real via API.Mapa.sincronizar(req)
    
    // Por enquanto, retorna resposta vazia (compatível com dados locais)
    return {
      mapas_atualizados: [],
      mapas_removidos: [],
      proxima_sincronizacao_em: this.config.intervalo_minimo_ms,
    };
  }

  /**
   * Estimar tamanho em MB de um array de pontos
   * ~40 bytes por ponto (lat: 8 bytes, lng: 8 bytes, overhead JSON)
   */
  private estimarTamanhoPontos(pontos: Array<{ lat: number; lng: number }>): number {
    const bytesEstimado = pontos.length * 40;
    return Math.round(bytesEstimado / 1024 / 1024 * 100) / 100; // em MB
  }

  /**
   * Gerar um ID único do device
   */
  private obterDeviceId(): string {
    return this.deviceIdFactory();
  }

  private gerarDeviceId(): string {
    // TODO: obter do Expo Constants ou salvar localmente
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }
}

// Singleton
let instancia: MapaSincronizacaoService | null = null;

export function obterMapaSincronizacao(
  config?: Partial<ConfigSincronizacao>,
  deps: MapaSincronizacaoDependencies = {}
): MapaSincronizacaoService {
  if (!instancia) {
    instancia = new MapaSincronizacaoService(config, deps);
  }
  return instancia;
}
