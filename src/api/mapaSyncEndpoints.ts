/**
 * API Endpoints para Sincronização de Mapas Offline-First
 * 
 * Estes endpoints simulam o comportamento de um servidor real que:
 * 1. Converte KML → GeoJSON no servidor
 * 2. Fornece dados de forma paginada/timestamp-based
 * 3. Entrega tiles de satélite em cache
 * 4. Rastreia última atualização de cada mapa
 */

import { MapaTalhao, MapaFazendaResponse, RespostaSincronizacao, RequisicaoSincronizacao, RequisicaoAPISincronizar, RequisicaoAPITiles, RespostaAPITiles } from '../types/mapa';
import { talhoesSelaDeprata1, SELA_DEPRATA_1_PRODUTOR_ID } from '../assets/kml/selaDeprata1';

// ─────────────────────────────────────────────────────────────────
// SIMULAÇÃO DE BANCO DE DADOS DO SERVIDOR
// ─────────────────────────────────────────────────────────────────

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
      console.log(`[API] Sincronização para produtor ${requisicao.produtor_id}`);

      // Simular latência de rede
      await new Promise(resolve => setTimeout(resolve, 300));

      // Para Sela de Prata I, retornar todos os talhões se nunca sincronizou
      if (requisicao.produtor_id === SELA_DEPRATA_1_PRODUTOR_ID) {
        // Se data_ultima_sincronizacao for 0 ou undefined, retorna tudo (primeira vez)
        if (!requisicao.data_ultima_sincronizacao || requisicao.data_ultima_sincronizacao === 0) {
          console.log(`[API] Primeira sincronização para Sela de Prata I - retornando ${talhoesSelaDeprata1.length} talhões`);

          return {
            mapas_atualizados: talhoesSelaDeprata1.map(t => ({
              ...t,
              status_sincronizacao: 'sincronizado',
              timestamp_servidor: Date.now(),
              timestamp_sincronizado: 0,
            } as MapaTalhao)),
            mapas_removidos: [],
            proxima_sincronizacao_em: 24 * 60 * 60 * 1000, // próxima em 24h
            sync_token: `token_${Date.now()}`,
          };
        }

        // Se já sincronizou, verificar se houve mudanças
        const talhoes_atualizados = talhoesSelaDeprata1.filter(t => {
          const timestampServidor = serverMapasTimestamps.get(`${requisicao.produtor_id}_${t.id}`) || 0;
          return timestampServidor > requisicao.data_ultima_sincronizacao;
        });

        console.log(`[API] Para ${requisicao.produtor_id}: ${talhoes_atualizados.length} atualizado(s)`);

        return {
          mapas_atualizados: talhoes_atualizados.map(t => ({
            ...t,
            status_sincronizacao: 'sincronizado',
            timestamp_servidor: serverMapasTimestamps.get(`${requisicao.produtor_id}_${t.id}`) || Date.now(),
            timestamp_sincronizado: 0,
          } as MapaTalhao)),
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
// ENDPOINT 3: GET /api/mapas/{produtor_id}
// Obter todos os mapas de um produtor com metadados completos
// ─────────────────────────────────────────────────────────────────

export const MapasPorProdutor = {
  /**
   * Retorna resposta completa com metadados do produtor
   */
  get: async (produtorId: string): Promise<MapaFazendaResponse> => {
    try {
      console.log(`[API] Obtendo mapas do produtor ${produtorId}`);

      await new Promise(resolve => setTimeout(resolve, 400));

      if (produtorId === SELA_DEPRATA_1_PRODUTOR_ID) {
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

        return {
          produtor_id: produtorId,
          fazenda_nome: 'Fazenda Sela de Prata I',
          ano: 2025,
          gerados_em: Date.now(),
          talhoes: talhoesSelaDeprata1.map(t => ({
            ...t,
            status_sincronizacao: 'sincronizado',
            timestamp_servidor: serverMapasTimestamps.get(`${produtorId}_${t.id}`) || Date.now(),
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
        };
      }

      // Produtor sem mapas
      return {
        produtor_id: produtorId,
        fazenda_nome: 'Fazenda',
        ano: 2025,
        gerados_em: Date.now(),
        talhoes: [],
        versao_dados: '1.0.0',
      };
    } catch (erro) {
      console.error('[API] Erro ao obter mapas do produtor:', erro);
      throw erro;
    }
  },
};

// ─────────────────────────────────────────────────────────────────
// ENDPOINT 4: POST /api/mapas/validate-checksum
// Verificar integridade dos dados sincronizados
// ─────────────────────────────────────────────────────────────────

export const MapasValidate = {
  /**
   * Valida checksum dos dados para garantir que foram baixados completamente
   */
  post: async (produtorId: string, checksumLocal: string): Promise<{ valido: boolean; mensagem: string }> => {
    try {
      console.log(`[API] Validando checksum para ${produtorId}`);

      await new Promise(resolve => setTimeout(resolve, 150));

      if (produtorId === SELA_DEPRATA_1_PRODUTOR_ID) {
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
  obterPorProdutor: (produtorId: string) => MapasPorProdutor.get(produtorId),

  // Validação
  validarChecksum: (produtorId: string, checksum: string) => MapasValidate.post(produtorId, checksum),

  // ─── Método de conveniência: sincronizar E baixar tiles ───
  sincronizarCompleto: async (produtorId: string, ultimaSincronizacao?: number) => {
    const requisicao: RequisicaoSincronizacao = {
      produtor_id: produtorId,
      data_ultima_sincronizacao: ultimaSincronizacao || 0,
      versao_app: '1.0.0',
    };

    console.log(`[API] Iniciando sincronização completa para ${produtorId}`);

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
