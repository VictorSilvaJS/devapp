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
import { MapaTalhao, CacheTilesSatelite, BackupMapaOffline, RelatorioCacheMapas } from '../types/mapa';
import {
  buildScopedFileName,
  buildScopedStorageKey,
  normalizeBackupMapaOffline,
  parseScopedStorageKey,
  resolveMapaOfflineFazendaId,
  toBackupMapaOfflineCompativel,
  toCacheTilesSateliteCompativel,
  toMapaTalhaoOfflineCompativel,
} from './mapaOfflineCompat';

interface CacheMetadata {
  versao: string;
  data_criacao: number;
  checksum?: string;
}

type FileSystemAdapter = Pick<
  typeof FileSystem,
  | 'getInfoAsync'
  | 'makeDirectoryAsync'
  | 'writeAsStringAsync'
  | 'deleteAsync'
  | 'readDirectoryAsync'
  | 'documentDirectory'
  | 'EncodingType'
>;

type AsyncStorageAdapter = Pick<
  typeof AsyncStorage,
  'setItem' | 'getItem' | 'getAllKeys' | 'removeItem' | 'multiRemove'
>;

interface MapaCacheDependencies {
  fileSystem?: FileSystemAdapter;
  storage?: AsyncStorageAdapter;
  now?: () => number;
}

export class MapaCacheService {
  /** Diretório raiz do cache no device */
  private readonly DIR_CACHE: string;
  /** Prefixo para AsyncStorage dos metadados */
  private readonly PREFIX_METADATA = '@mapas_metadata_';
  /** Prefixo para AsyncStorage dos talhões */
  private readonly PREFIX_TALHAO = '@mapas_talhao_';
  /** Prefixo para AsyncStorage dos tiles */
  private readonly PREFIX_TILES = '@mapas_tiles_';
  private readonly fileSystem: FileSystemAdapter;
  private readonly storage: AsyncStorageAdapter;
  private readonly now: () => number;

  constructor(deps: MapaCacheDependencies = {}) {
    this.fileSystem = deps.fileSystem ?? FileSystem;
    this.storage = deps.storage ?? AsyncStorage;
    this.now = deps.now ?? (() => Date.now());
    this.DIR_CACHE = (this.fileSystem.documentDirectory || '') + 'mapas_cache/';
    this.inicializarDirCache();
  }

  /**
   * Cria diretório de cache se não existir
   */
  private async inicializarDirCache(): Promise<void> {
    try {
      const info = await this.fileSystem.getInfoAsync(this.DIR_CACHE);
      if (!info.exists) {
        await this.fileSystem.makeDirectoryAsync(this.DIR_CACHE, { intermediates: true });
        console.log(`[MapaCache] Diretório de cache criado: ${this.DIR_CACHE}`);
      }
    } catch (erro) {
      console.error(`[MapaCache] Erro ao criar diretório:`, erro);
    }
  }

  /**
   * Salvar um talhão no cache local da fazenda
   * 
   * @param talhao Dados do talhão (com poligono em formato simplificado)
   * @param fazendaId Para organizar em pastas por fazenda
   */
  async salvarTalhaoFazenda(talhao: MapaTalhao, fazendaId: string): Promise<void> {
    try {
      // Salvar metadados em AsyncStorage (rápido, pequeno)
      const chave = buildScopedStorageKey(this.PREFIX_TALHAO, fazendaId, talhao.id);
      const dados = toMapaTalhaoOfflineCompativel(talhao, fazendaId, {
        timestamp_salvo: this.now(),
      });

      await this.storage.setItem(chave, JSON.stringify(dados));

      // Salvar arquivo no FileSystem também (backup)
      const caminhoArquivo = `${this.DIR_CACHE}${buildScopedFileName(fazendaId, talhao.id)}`;
      await this.fileSystem.writeAsStringAsync(caminhoArquivo, JSON.stringify(dados, null, 2), {
        encoding: this.fileSystem.EncodingType.UTF8,
      });

      console.log(`[MapaCache] ✅ Talhão ${talhao.id} salvo localmente`);
    } catch (erro) {
      console.error(`[MapaCache] ❌ Erro ao salvar talhão ${talhao.id}:`, erro);
      throw erro;
    }
  }

  async salvarTalhao(talhao: MapaTalhao, produtorId: string): Promise<void> {
    await this.salvarTalhaoFazenda(talhao, produtorId);
  }

  /**
   * Buscar talhão do cache local
   */
  async obterTalhaoFazenda(fazendaId: string, talhaoId: string): Promise<MapaTalhao | null> {
    try {
      const chave = buildScopedStorageKey(this.PREFIX_TALHAO, fazendaId, talhaoId);
      const json = await this.storage.getItem(chave);

      if (!json) {
        return null;
      }

      return toMapaTalhaoOfflineCompativel(JSON.parse(json) as MapaTalhao, fazendaId);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao obter talhão ${talhaoId}:`, erro);
      return null;
    }
  }

  async obterTalhao(produtorId: string, talhaoId: string): Promise<MapaTalhao | null> {
    return this.obterTalhaoFazenda(produtorId, talhaoId);
  }

  /**
   * Obter todos os talhões em cache de uma fazenda
   */
  async obterTalhoesFazendaCache(fazendaId: string): Promise<MapaTalhao[]> {
    try {
      const chavePrefix = `${this.PREFIX_TALHAO}${resolveMapaOfflineFazendaId(fazendaId)}_`;
      const todasChaves = await this.storage.getAllKeys();
      const chavesCacheFazenda = todasChaves.filter(k => k.startsWith(chavePrefix));

      const talhoes: MapaTalhao[] = [];
      for (const chave of chavesCacheFazenda) {
        const json = await this.storage.getItem(chave);
        if (json) {
          talhoes.push(toMapaTalhaoOfflineCompativel(JSON.parse(json) as MapaTalhao, fazendaId));
        }
      }

      return talhoes;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao listar talhões do produtor:`, erro);
      return [];
    }
  }

  async obterTalhoesProdutorCache(produtorId: string): Promise<MapaTalhao[]> {
    return this.obterTalhoesFazendaCache(produtorId);
  }

  /**
   * Remover talhão do cache
   */
  async removerTalhaoFazenda(fazendaId: string, talhaoId: string): Promise<void> {
    try {
      const chave = buildScopedStorageKey(this.PREFIX_TALHAO, fazendaId, talhaoId);
      await this.storage.removeItem(chave);

      const caminhoArquivo = `${this.DIR_CACHE}${buildScopedFileName(fazendaId, talhaoId)}`;
      const info = await this.fileSystem.getInfoAsync(caminhoArquivo);
      if (info.exists) {
        await this.fileSystem.deleteAsync(caminhoArquivo);
      }

      console.log(`[MapaCache] 🗑️ Talhão ${talhaoId} removido do cache`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao remover talhão:`, erro);
    }
  }

  async removerTalhao(produtorId: string, talhaoId: string): Promise<void> {
    await this.removerTalhaoFazenda(produtorId, talhaoId);
  }

  /**
   * Salvar informações de tiles de satélite em cache
   */
  async salvarMetadadosTiles(tiles: CacheTilesSatelite): Promise<void> {
    try {
      const dados = toCacheTilesSateliteCompativel(tiles);
      const chave = buildScopedStorageKey(this.PREFIX_TILES, dados.fazenda_id, dados.talhao_id);
      await this.storage.setItem(chave, JSON.stringify(dados));
      console.log(`[MapaCache] 🛰️ Metadados de tiles salvos para ${dados.talhao_id}`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao salvar metadados de tiles:`, erro);
    }
  }

  /**
   * Obter metadados de tiles em cache
   */
  async obterMetadadosTilesFazenda(fazendaId: string, talhaoId: string): Promise<CacheTilesSatelite | null> {
    try {
      const chave = buildScopedStorageKey(this.PREFIX_TILES, fazendaId, talhaoId);
      const json = await this.storage.getItem(chave);
      if (!json) {
        return null;
      }
      return toCacheTilesSateliteCompativel(JSON.parse(json) as CacheTilesSatelite);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao obter metadados de tiles:`, erro);
      return null;
    }
  }

  async obterMetadadosTiles(produtorId: string, talhaoId: string): Promise<CacheTilesSatelite | null> {
    return this.obterMetadadosTilesFazenda(produtorId, talhaoId);
  }

  /**
   * Calcular tamanho total do cache em MB
   */
  async obterTamanhoCache(): Promise<number> {
    try {
      const info = await this.fileSystem.getInfoAsync(this.DIR_CACHE);
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
      const todosOsLogs = await this.storage.getAllKeys();
      const chavelsMapa = todosOsLogs.filter(k =>
        k.startsWith(this.PREFIX_TALHAO) ||
        k.startsWith(this.PREFIX_TILES) ||
        k.startsWith(this.PREFIX_METADATA)
      );
      await this.storage.multiRemove(chavelsMapa);

      // Limpar FileSystem
      const arquivos = await this.fileSystem.readDirectoryAsync(this.DIR_CACHE);
      for (const arquivo of arquivos) {
        await this.fileSystem.deleteAsync(`${this.DIR_CACHE}${arquivo}`);
      }

      console.log(`[MapaCache] 🗑️ Cache completamente limpo`);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao limpar cache:`, erro);
    }
  }

  /**
   * Exportar dados de uma fazenda para backup
   * (útil para sincronização entre devices)
   */
  async exportarDadosFazenda(fazendaId: string): Promise<string> {
    try {
      const talhoes = await this.obterTalhoesFazendaCache(fazendaId);

      const backup: BackupMapaOffline = toBackupMapaOfflineCompativel({
        versao: '1.0',
        fazenda_id: fazendaId,
        data_export: new Date().toISOString(),
        talhoes,
        checksum: this.calcularChecksum(JSON.stringify(talhoes)),
      });

      return JSON.stringify(backup, null, 2);
    } catch (erro) {
      console.error(`[MapaCache] Erro ao exportar dados:`, erro);
      throw erro;
    }
  }

  async exportarDadosProdutor(produtorId: string): Promise<string> {
    return this.exportarDadosFazenda(produtorId);
  }

  /**
   * Importar dados de uma fazenda (restore de backup)
   */
  async importarDadosFazenda(dadosJson: string): Promise<number> {
    try {
      const backup = normalizeBackupMapaOffline(JSON.parse(dadosJson));
      const fazendaId = backup.fazenda_id;
      let importados = 0;

      for (const talhao of backup.talhoes) {
        await this.salvarTalhaoFazenda(talhao, fazendaId);
        importados++;
      }

      console.log(`[MapaCache] ✅ Importados ${importados} talhões para ${fazendaId}`);
      return importados;
    } catch (erro) {
      console.error(`[MapaCache] Erro ao importar dados:`, erro);
      throw erro;
    }
  }

  async importarDadosProdutor(dadosJson: string): Promise<number> {
    return this.importarDadosFazenda(dadosJson);
  }

  /**
   * Obter relatório de uso de cache
   */
  async obterRelatorioCache(): Promise<RelatorioCacheMapas> {
    try {
      const todosOsLogs = await this.storage.getAllKeys();
      const chavesTalhoes = todosOsLogs.filter(k => k.startsWith(this.PREFIX_TALHAO));

      const fazendas = new Set<string>();
      for (const chave of chavesTalhoes) {
        const parsed = parseScopedStorageKey(this.PREFIX_TALHAO, chave);
        if (parsed?.fazenda_id) {
          fazendas.add(parsed.fazenda_id);
        }
      }

      const arquivos = await this.fileSystem.readDirectoryAsync(this.DIR_CACHE).catch(() => []);
      const fazendasList = Array.from(fazendas);

      return {
        tamanho_mb: await this.obterTamanhoCache(),
        total_talhoes: chavesTalhoes.length,
        fazendas: fazendasList,
        produtores: fazendasList,
        arquivos_local: arquivos.length,
      };
    } catch (erro) {
      console.error(`[MapaCache] Erro ao gerar relatório:`, erro);
      return { tamanho_mb: 0, total_talhoes: 0, fazendas: [], produtores: [], arquivos_local: 0 };
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

export function obterMapaCache(deps: MapaCacheDependencies = {}): MapaCacheService {
  if (!instancia) {
    instancia = new MapaCacheService(deps);
  }
  return instancia;
}
