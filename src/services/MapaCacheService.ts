/**
 * Serviço de Cache Local de Mapas
 * 
 * Responsabilidades:
 * - Salvar dados de talhões no armazenamento local do device
 * - Buscar dados do cache quando offline
 * - Gerenciar banco local (FileSystem, AsyncStorage, etc)
 * - Sincronizar com servidor quando voltar online
 * - Rastrear integridade dos dados
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapaTalhao, EstadoMapaLocal, CacheTilesSatelite } from '../types/mapa';

interface CacheMetadata {
  versao: string;
  data_criacao: number;
  checksum?: string;
}

export class MapaCacheService {
  /** Diretório raiz do cache no device */
  private readonly DIR_CACHE = FileSystem.documentDirectory + 'mapas_cache/';
  /** Prefixo para AsyncStorage dos metadados */
  private readonly PREFIX_METADATA = '@mapas_metadata_';
  /** Prefixo para AsyncStorage dos talhões */
  private readonly PREFIX_TALHAO = '@mapas_talhao_';
  /** Prefixo para AsyncStorage dos tiles */
  private readonly PREFIX_TILES = '@mapas_tiles_';

  constructor() {
    this.inicializarDirCache();
  }

  /**
   * Cria diretório de cache se não existir
   */
  private async inicializarDirCache(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(this.DIR_CACHE);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(this.DIR_CACHE, { intermediates: true });
        console.log(`[MapaCache] Diretório de cache criado: ${this.DIR_CACHE}`);
      }
    } catch (erro) {
      console.error(`[MapaCache] Erro ao criar diretório:`, erro);
    }
  }

  /**
   * Salvar um talhão no cache local
   * 
   * @param talhao Dados do talhão (com poligono em formato simplificado)
   * @param produtorId Para organizar em pastas por produtor
   */
  async salvarTalhao(talhao: MapaTalhao, produtorId: string): Promise<void> {
    try {
      // Salvar metadados em AsyncStorage (rápido, pequeno)
      const chave = `${this.PREFIX_TALHAO}${produtorId}_${talhao.id}`;
      const dados = {
        ...talhao,
        timestamp_salvo: Date.now(),
      };

      await AsyncStorage.setItem(chave, JSON.stringify(dados));

      // Salvar arquivo no FileSystem também (backup)
      const caminhoArquivo = `${this.DIR_CACHE}${produtorId}_${talhao.id}.json`;
      await FileSystem.writeAsStringAsync(caminhoArquivo, JSON.stringify(dados, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log(`[MapaCache] ✅ Talhão ${talhao.id} salvo localmente`);
    } catch (erro) {
      console.error(`[MapaCache] ❌ Erro ao salvar talhão ${talhao.id}:`, erro);
      throw erro;
    }
  }

  /**
   * Buscar talhão do cache local
   */
  async obterTalhao(produtorId: string, talhaoId: string): Promise<MapaTalhao | null> {
    try {
      const chave = `${this.PREFIX_TALHAO}${produtorId}_${talhaoId}`;
      const json = await AsyncStorage.getItem(chave);

      if (!json) {
        return null;
      }

      return JSON.parse(json) as MapaTalhao;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao obter talhão ${talhaoId}:`, erro);
      return null;
    }
  }

  /**
   * Obter todos os talhões em cache de um produtor
   */
  async obterTalhoesProdutorCache(produtorId: string): Promise<MapaTalhao[]> {
    try {
      const chavePrefix = `${this.PREFIX_TALHAO}${produtorId}_`;
      const todasChaves = await AsyncStorage.getAllKeys();
      const chavesCacheProdutor = todasChaves.filter(k => k.startsWith(chavePrefix));

      const talhoes: MapaTalhao[] = [];
      for (const chave of chavesCacheProdutor) {
        const json = await AsyncStorage.getItem(chave);
        if (json) {
          talhoes.push(JSON.parse(json) as MapaTalhao);
        }
      }

      return talhoes;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao listar talhões do produtor:`, erro);
      return [];
    }
  }

  /**
   * Remover talhão do cache
   */
  async removerTalhao(produtorId: string, talhaoId: string): Promise<void> {
    try {
      const chave = `${this.PREFIX_TALHAO}${produtorId}_${talhaoId}`;
      await AsyncStorage.removeItem(chave);

      const caminhoArquivo = `${this.DIR_CACHE}${produtorId}_${talhaoId}.json`;
      const info = await FileSystem.getInfoAsync(caminhoArquivo);
      if (info.exists) {
        await FileSystem.deleteAsync(caminhoArquivo);
      }

      console.log(`[MapaCache] 🗑️ Talhão ${talhaoId} removido do cache`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao remover talhão:`, erro);
    }
  }

  /**
   * Salvar informações de tiles de satélite em cache
   */
  async salvarMetadadosTiles(tiles: CacheTilesSatelite): Promise<void> {
    try {
      const chave = `${this.PREFIX_TILES}${tiles.produtor_id}_${tiles.talhao_id}`;
      await AsyncStorage.setItem(chave, JSON.stringify(tiles));
      console.log(`[MapaCache] 🛰️ Metadados de tiles salvos para ${tiles.talhao_id}`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao salvar metadados de tiles:`, erro);
    }
  }

  /**
   * Obter metadados de tiles em cache
   */
  async obterMetadadosTiles(produtorId: string, talhaoId: string): Promise<CacheTilesSatelite | null> {
    try {
      const chave = `${this.PREFIX_TILES}${produtorId}_${talhaoId}`;
      const json = await AsyncStorage.getItem(chave);
      if (!json) {
        return null;
      }
      return JSON.parse(json) as CacheTilesSatelite;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao obter metadados de tiles:`, erro);
      return null;
    }
  }

  /**
   * Calcular tamanho total do cache em MB
   */
  async obterTamanhoCache(): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(this.DIR_CACHE);
      if (!info.exists || !info.size) {
        return 0;
      }
      return Math.round(info.size / 1024 / 1024 * 100) / 100; // MB
    } catch (erro) {
      console.error(`[MapaCache] Erro ao calcular tamanho:`, erro);
      return 0;
    }
  }

  /**
   * Limpar todo o cache (use com cuidado!)
   */
  async limparCacheCompleto(): Promise<void> {
    try {
      // Limpar AsyncStorage
      const todosOsLogs = await AsyncStorage.getAllKeys();
      const chavelsMapa = todosOsLogs.filter(k =>
        k.startsWith(this.PREFIX_TALHAO) ||
        k.startsWith(this.PREFIX_TILES) ||
        k.startsWith(this.PREFIX_METADATA)
      );
      await AsyncStorage.multiRemove(chavelsMapa);

      // Limpar FileSystem
      const arquivos = await FileSystem.readDirectoryAsync(this.DIR_CACHE);
      for (const arquivo of arquivos) {
        await FileSystem.deleteAsync(`${this.DIR_CACHE}${arquivo}`);
      }

      console.log(`[MapaCache] 🗑️ Cache completamente limpo`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao limpar cache:`, erro);
    }
  }

  /**
   * Exportar dados de um produtor para backup
   * (útil para sincronização entre devices)
   */
  async exportarDadosProdutor(produtorId: string): Promise<string> {
    try {
      const talhoes = await this.obterTalhoesProdutorCache(produtorId);

      const backup = {
        versao: '1.0',
        produtor_id: produtorId,
        data_export: new Date().toISOString(),
        talhoes,
        checksum: this.calcularChecksum(JSON.stringify(talhoes)),
      };

      return JSON.stringify(backup, null, 2);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao exportar dados:`, erro);
      throw erro;
    }
  }

  /**
   * Importar dados de um produtor (restore de backup)
   */
  async importarDadosProdutor(dadosJson: string): Promise<number> {
    try {
      const backup = JSON.parse(dadosJson);
      const produtorId = backup.produtor_id;
      let importados = 0;

      for (const talhao of backup.talhoes) {
        await this.salvarTalhao(talhao, produtorId);
        importados++;
      }

      console.log(`[MapaCache] ✅ Importados ${importados} talhões para ${produtorId}`);
      return importados;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao importar dados:`, erro);
      throw erro;
    }
  }

  /**
   * Obter relatório de uso de cache
   */
  async obterRelatorioCache(): Promise<{
    tamanho_mb: number;
    total_talhoes: number;
    produtores: string[];
    arquivos_local: number;
  }> {
    try {
      const todosOsLogs = await AsyncStorage.getAllKeys();
      const chavesTalhoes = todosOsLogs.filter(k => k.startsWith(this.PREFIX_TALHAO));

      const produtores = new Set<string>();
      for (const chave of chavesTalhoes) {
        const partes = chave.replace(this.PREFIX_TALHAO, '').split('_');
        produtores.add(partes[0]);
      }

      const arquivos = await FileSystem.readDirectoryAsync(this.DIR_CACHE).catch(() => []);

      return {
        tamanho_mb: await this.obterTamanhoCache(),
        total_talhoes: chavesTalhoes.length,
        produtores: Array.from(produtores),
        arquivos_local: arquivos.length,
      };
    } catch (erro) {
      console.error(`[MapaCache] Erro ao gerar relatório:`, erro);
      return { tamanho_mb: 0, total_talhoes: 0, produtores: [], arquivos_local: 0 };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVADO
  // ─────────────────────────────────────────────────────────────

  /**
   * Calcular checksum MD5 de uma string (para validação de integridade)
   * NOTA: Em produção, use expo-crypto
   */
  private calcularChecksum(texto: string): string {
    // Implementação simplificada — em produção, usar MD5 real
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      const char = texto.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converter para 32-bit
    }
    return Math.abs(hash).toString(16);
  }
}

// Singleton
let instancia: MapaCacheService | null = null;

export function obterMapaCache(): MapaCacheService {
  if (!instancia) {
    instancia = new MapaCacheService();
  }
  return instancia;
}
