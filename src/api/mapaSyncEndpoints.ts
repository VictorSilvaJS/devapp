/**
 * API Endpoints para Sincronização de Mapas Offline-First
 * 
 * Estes endpoints simulam o comportamento de um servidor real que:
 * 1. Entrega talhões já convertidos para formato consumível pelo app
 * 2. Fornece dados de forma paginada/timestamp-based
 * 3. Entrega tiles de satélite em cache
 * 4. Rastreia última atualização de cada mapa
 */

import { MapaTalhao, MapaFazendaResponse, RespostaSincronizacao, RequisicaoSincronizacao, RequisicaoAPISincronizar, RequisicaoAPITiles, RespostaAPITiles } from '../types/mapa';
import {
  talhoesSelaDePrata1Shape,
  SELA_DE_PRATA_1_SHAPE_FAZENDA_ID,
} from '../assets/geojson/selaDePrata1Talhoes';
import {
  buildScopedMapKey,
  resolveMapaOfflineFazendaId,
  toMapaFazendaResponseCompativel,
  toMapaTalhaoOfflineCompativel,
  toRequisicaoSincronizacaoCompativel,
} from '../services/mapaOfflineCompat';

// ─────────────────────────────────────────────────────────────────
// SIMULAÇÃO DE BANCO DE DADOS DO SERVIDOR
// ─────────────────────────────────────────────────────────────────

const talhoesSelaDeprata1 = talhoesSelaDePrata1Shape;
const SELA_DEPRATA_1_PRODUTOR_ID = SELA_DE_PRATA_1_SHAPE_FAZENDA_ID;

/**
 * Registra o timestamp de última modificação de cada mapa
 * Em produção, isso seria um banco de dados real (PostgreSQL, MongoDB, etc)
 */
const serverMapasTimestamps: Map<string, number> = new Map([
  // Fazer os dados de Sela de Prata ser "mais novo"
  ...talhoesSelaDeprata1.map(t => [
    `${SELA_DEPRATA_1_PRODUTOR_ID}_${t.id}`,
    Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 dias atrás (pode sincronizar)
  ] as [string, number]),
]);

/**
 * Cache de tiles de satélite disponíveis no servidor
 */
const serverTilesCache: Map<string, { url: string; tamanho_mb: number; disponivel: boolean }> = new Map([
  // Exemplo: tiles para cada talhão
  ...talhoesSelaDeprata1.map(t => [
    t.id,
    {
      url: `https://server.example.com/tiles/sela_prata_1/${t.id}/mbtiles`,
      tamanho_mb: 15 + Math.random() * 30,
      disponivel: true,
    }
  ] as [string, any]),
]);

// ─────────────────────────────────────────────────────────────────
// ENDPOINT 1: GET /api/mapas/sincronizar
// Pergunta: "Quais mapas mudaram desde timestamp X?"
// ─────────────────────────────────────────────────────────────────

export const SincronizarMapas = {
  /**
   * Simula chamada POST /api/mapas/sincronizar
   * 
   * Retorna apenas os mapas que foram atualizados desde a data solicitada
   */
  post: async (requisicao: RequisicaoSincronizacao): Promise<RespostaSincronizacao> => {
    try {
      const requisicaoNormalizada = toRequisicaoSincronizacaoCompativel(requisicao);
      const fazendaId = requisicaoNormalizada.fazenda_id;

      console.log(`[API] Sincronização para fazenda ${fazendaId}`);

      // Simular latência de rede
      await new Promise(resolve => setTimeout(resolve, 300));

      // Para Sela de Prata I, retornar todos os talhões se nunca sincronizou
      if (fazendaId === SELA_DEPRATA_1_PRODUTOR_ID) {
        // Se data_ultima_sincronizacao for 0 ou undefined, retorna tudo (primeira vez)
        if (!requisicaoNormalizada.data_ultima_sincronizacao || requisicaoNormalizada.data_ultima_sincronizacao === 0) {
          console.log(`[API] Primeira sincronização para Sela de Prata I - retornando ${talhoesSelaDeprata1.length} talhões`);

          return {
            mapas_atualizados: talhoesSelaDeprata1.map(t => toMapaTalhaoOfflineCompativel({
              ...t,
              status_sincronizacao: 'sincronizado',
              timestamp_servidor: Date.now(),
              timestamp_sincronizado: 0,
            } as MapaTalhao, fazendaId)),
            mapas_removidos: [],
            proxima_sincronizacao_em: 24 * 60 * 60 * 1000, // próxima em 24h
            sync_token: `token_${Date.now()}`,
          };
        }

        // Se já sincronizou, verificar se houve mudanças
        const talhoes_atualizados = talhoesSelaDeprata1.filter(t => {
          const timestampServidor = serverMapasTimestamps.get(buildScopedMapKey(fazendaId, t.id)) || 0;
          return timestampServidor > requisicaoNormalizada.data_ultima_sincronizacao;
        });

        console.log(`[API] Para ${fazendaId}: ${talhoes_atualizados.length} atualizado(s)`);

        return {
          mapas_atualizados: talhoes_atualizados.map(t => toMapaTalhaoOfflineCompativel({
            ...t,
            status_sincronizacao: 'sincronizado',
            timestamp_servidor: serverMapasTimestamps.get(buildScopedMapKey(fazendaId, t.id)) || Date.now(),
            timestamp_sincronizado: 0,
          } as MapaTalhao, fazendaId)),
          mapas_removidos: [],
          proxima_sincronizacao_em: 24 * 60 * 60 * 1000,
          sync_token: `token_${Date.now()}`,
        };
      }

      // Para outros produtores, retorna array vazio (sem mapas)
      return {
        mapas_atualizados: [],
        mapas_removidos: [],
        proxima_sincronizacao_em: 24 * 60 * 60 * 1000,
      };
    } catch (erro) {
      console.error('[API] Erro na sincronização:', erro);
      throw erro;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
// ENDPOINT 2: GET /api/mapas/{talhao_id}/tiles
// Download de tiles de satélite para uso offline
// ─────────────────────────────────────────────────────────────────

export const MapasTiles = {
  /**
   * Simula chamada GET /api/mapas/{talhao_id}/tiles
   * Retorna URL de download de tiles pré-processados
   */
  get: async (talhaoId: string, zoomLevels: number[]): Promise<RespostaAPITiles> => {
    try {
      console.log(`[API] Requisição de tiles para ${talhaoId}, zoom levels: [${zoomLevels.join(', ')}]`);

      // Simular latência
      await new Promise(resolve => setTimeout(resolve, 200));

      const tilesInfo = serverTilesCache.get(talhaoId);

      if (!tilesInfo) {
        throw new Error(`Tiles não encontrados para ${talhaoId}`);
      }

      return {
        url_download: tilesInfo.url,
        tamanho_mb: tilesInfo.tamanho_mb * (zoomLevels.length / 6), // proporcional aos níveis
        formato: 'mbtiles',
        validade_horas: 24, // URL válida por 24 horas
        checksum: `chk_${talhaoId}_${Date.now().toString(36)}`,
      };
    } catch (erro) {
      console.error('[API] Erro ao obter tiles:', erro);
      throw erro;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
// ENDPOINT 3: GET /api/mapas/{fazenda_id}
// Obter todos os mapas de uma fazenda com metadados completos
// ─────────────────────────────────────────────────────────────────

export const MapasPorFazenda = {
  /**
   * Retorna resposta completa com metadados da fazenda
   */
  get: async (fazendaId: string): Promise<MapaFazendaResponse> => {
    try {
      console.log(`[API] Obtendo mapas da fazenda ${fazendaId}`);

      await new Promise(resolve => setTimeout(resolve, 400));

      if (fazendaId === SELA_DEPRATA_1_PRODUTOR_ID) {
        // Calcular bbox
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        for (const t of talhoesSelaDeprata1) {
          for (const p of t.poligono) {
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLng = Math.min(minLng, p.lng);
            maxLng = Math.max(maxLng, p.lng);
          }
        }

        return toMapaFazendaResponseCompativel({
          fazenda_id: fazendaId,
          fazenda_nome: 'Fazenda Sela de Prata I',
          ano: 2025,
          gerados_em: Date.now(),
          talhoes: talhoesSelaDeprata1.map(t => ({
            ...toMapaTalhaoOfflineCompativel(t, fazendaId),
            status_sincronizacao: 'sincronizado',
            timestamp_servidor: serverMapasTimestamps.get(buildScopedMapKey(fazendaId, t.id)) || Date.now(),
            timestamp_sincronizado: Date.now(),
          } as MapaTalhao)),
          tiles_url_base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/',
          bbox: {
            norte: maxLat,
            sul: minLat,
            leste: maxLng,
            oeste: minLng,
          },
          versao_dados: '1.0.0',
          checksum_completo: `chk_sela_prata_${Date.now().toString(36)}`,
        });
      }

      // Fazenda sem mapas
      return toMapaFazendaResponseCompativel({
        fazenda_id: fazendaId,
        fazenda_nome: 'Fazenda',
        ano: 2025,
        gerados_em: Date.now(),
        talhoes: [],
        versao_dados: '1.0.0',
      });
    } catch (erro) {
      console.error('[API] Erro ao obter mapas da fazenda:', erro);
      throw erro;
    }
  },
};

export const MapasPorProdutor = {
  get: async (fazendaId: string): Promise<MapaFazendaResponse> => MapasPorFazenda.get(fazendaId),
};

// ─────────────────────────────────────────────────────────────────
// ENDPOINT 4: POST /api/mapas/validate-checksum
// Verificar integridade dos dados sincronizados
// ─────────────────────────────────────────────────────────────────

export const MapasValidate = {
  /**
   * Valida checksum dos dados para garantir que foram baixados completamente
   */
  post: async (fazendaId: string, checksumLocal: string): Promise<{ valido: boolean; mensagem: string }> => {
    try {
      console.log(`[API] Validando checksum para ${fazendaId}`);

      await new Promise(resolve => setTimeout(resolve, 150));

      if (fazendaId === SELA_DEPRATA_1_PRODUTOR_ID) {
        // Simular verificação de checksum
        const valido = checksumLocal && checksumLocal.length > 0;
        return {
          valido,
          mensagem: valido ? 'Dados íntegros' : 'Checksum inválido - re-sincronize',
        };
      }

      return { valido: true, mensagem: 'OK' };
    } catch (erro) {
      console.error('[API] Erro na validação:', erro);
      throw erro;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
// AGRUPADOR: Mapa API
// ─────────────────────────────────────────────────────────────────

export const Mapa = {
  // Sincronização
  sincronizar: SincronizarMapas.post,

  // Tiles
  obterTiles: (talhaoId: string, zooms: number[]) => MapasTiles.get(talhaoId, zooms),

  // Dados
  obterPorFazenda: (fazendaId: string) => MapasPorFazenda.get(fazendaId),
  // Wrappers legados publicos: manter temporariamente enquanto a UI ainda
  // convive com aliases historicos baseados em produtor.
  obterPorProdutor: (fazendaId: string) => MapasPorProdutor.get(fazendaId),

  // Validação
  validarChecksumFazenda: (fazendaId: string, checksum: string) => MapasValidate.post(fazendaId, checksum),
  validarChecksum: (fazendaId: string, checksum: string) => MapasValidate.post(fazendaId, checksum),

  // ─── Método de conveniência: sincronizar E baixar tiles ───
  sincronizarCompleto: async (fazendaId: string, ultimaSincronizacao?: number) => {
    const requisicao: RequisicaoSincronizacao = toRequisicaoSincronizacaoCompativel({
      fazenda_id: fazendaId,
      data_ultima_sincronizacao: ultimaSincronizacao || 0,
      versao_app: '1.0.0',
    });

    console.log(`[API] Iniciando sincronização completa para ${fazendaId}`);

    // Etapa 1: Sincronizar mapas
    const resposta = await SincronizarMapas.post(requisicao);

    // Etapa 2: Para cada talhão, obter URL de tiles
    const tilesInfos = await Promise.all(
      resposta.mapas_atualizados.map(async (talhao) => {
        try {
          const tiles = await MapasTiles.get(talhao.id, [13, 14, 15]);
          return { talhao_id: talhao.id, tiles };
        } catch {
          return { talhao_id: talhao.id, tiles: null };
        }
      })
    );

    console.log(`[API] ✅ Sincronização completa concluída`);

    return {
      mapas_atualizados: resposta.mapas_atualizados,
      mapas_removidos: resposta.mapas_removidos,
      tiles_disponiveis: tilesInfos.filter(t => t.tiles !== null),
      proxima_sincronizacao_em: resposta.proxima_sincronizacao_em,
    };
  },
};

export default Mapa;
