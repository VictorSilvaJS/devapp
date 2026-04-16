import type {
  BackupMapaOffline,
  CacheTilesSatelite,
  EstadoMapaLocal,
  LogSincronizacao,
  MapaFazendaResponse,
  MapaTalhao,
  RequisicaoAPISincronizar,
  RequisicaoSincronizacao,
} from '../types/mapa';

type EscopoFazendaParcial = {
  fazenda_id?: string;
  produtor_id?: string;
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return '';
};

export const resolveMapaOfflineFazendaId = (
  input: string | EscopoFazendaParcial | null | undefined
): string => {
  if (typeof input === 'string') {
    return firstNonEmptyString(input);
  }

  return firstNonEmptyString(input?.fazenda_id, input?.produtor_id);
};

export const withLegacyMapaScopeAlias = <T extends EscopoFazendaParcial & Record<string, any>>(
  value: T
): T & { fazenda_id: string; produtor_id: string } => {
  const fazendaId = resolveMapaOfflineFazendaId(value);

  return {
    ...value,
    fazenda_id: fazendaId,
    produtor_id: firstNonEmptyString(value?.produtor_id, fazendaId),
  };
};

export const buildScopedMapKey = (fazendaId: string, itemId: string): string =>
  `${resolveMapaOfflineFazendaId(fazendaId)}_${itemId}`;

export const buildScopedStorageKey = (prefix: string, fazendaId: string, itemId: string): string =>
  `${prefix}${buildScopedMapKey(fazendaId, itemId)}`;

export const buildScopedFileName = (fazendaId: string, itemId: string, extension = 'json'): string =>
  `${buildScopedMapKey(fazendaId, itemId)}.${extension}`;

export const parseScopedStorageKey = (prefix: string, key: string) => {
  if (!key.startsWith(prefix)) {
    return null;
  }

  const raw = key.slice(prefix.length);
  const separatorIndex = raw.lastIndexOf('_');

  if (separatorIndex <= 0) {
    return null;
  }

  return {
    fazenda_id: raw.slice(0, separatorIndex),
    item_id: raw.slice(separatorIndex + 1),
  };
};

export const toMapaTalhaoOfflineCompativel = (
  talhao: MapaTalhao,
  fazendaId: string,
  extra: Record<string, any> = {}
): MapaTalhao => ({
  ...talhao,
  ...extra,
  ...withLegacyMapaScopeAlias({
    fazenda_id: fazendaId,
    produtor_id: talhao?.produtor_id,
  }),
});

export const normalizeRequisicaoSincronizacao = (
  raw: Partial<RequisicaoSincronizacao> & Record<string, any>
): RequisicaoSincronizacao => ({
  fazenda_id: resolveMapaOfflineFazendaId(raw),
  data_ultima_sincronizacao:
    typeof raw?.data_ultima_sincronizacao === 'number' ? raw.data_ultima_sincronizacao : 0,
  versao_app: typeof raw?.versao_app === 'string' ? raw.versao_app : '',
  device_id: typeof raw?.device_id === 'string' ? raw.device_id : undefined,
});

export const toRequisicaoSincronizacaoCompativel = (
  raw: Partial<RequisicaoSincronizacao> & Record<string, any>
): RequisicaoSincronizacao => withLegacyMapaScopeAlias(normalizeRequisicaoSincronizacao(raw));

export const normalizeRequisicaoAPISincronizar = (
  raw: Partial<RequisicaoAPISincronizar> & Record<string, any>
): RequisicaoAPISincronizar => ({
  fazenda_id: resolveMapaOfflineFazendaId(raw),
  ultima_sincronizacao:
    typeof raw?.ultima_sincronizacao === 'number' ? raw.ultima_sincronizacao : undefined,
});

export const toRequisicaoAPISincronizarCompativel = (
  raw: Partial<RequisicaoAPISincronizar> & Record<string, any>
): RequisicaoAPISincronizar => withLegacyMapaScopeAlias(normalizeRequisicaoAPISincronizar(raw));

export const normalizeCacheTilesSatelite = (
  raw: Partial<CacheTilesSatelite> & Record<string, any>
): CacheTilesSatelite => ({
  fazenda_id: resolveMapaOfflineFazendaId(raw),
  talhao_id: typeof raw?.talhao_id === 'string' ? raw.talhao_id : '',
  zoom_levels: Array.isArray(raw?.zoom_levels) ? raw.zoom_levels : [],
  data_download: typeof raw?.data_download === 'number' ? raw.data_download : 0,
  tamanho_mb: typeof raw?.tamanho_mb === 'number' ? raw.tamanho_mb : 0,
  status: raw?.status ?? 'completo',
  caminho_local: typeof raw?.caminho_local === 'string' ? raw.caminho_local : '',
  data_expiracao: typeof raw?.data_expiracao === 'number' ? raw.data_expiracao : undefined,
});

export const toCacheTilesSateliteCompativel = (
  raw: Partial<CacheTilesSatelite> & Record<string, any>
): CacheTilesSatelite => withLegacyMapaScopeAlias(normalizeCacheTilesSatelite(raw));

export const normalizeEstadoMapaLocal = (
  raw: Partial<EstadoMapaLocal> & Record<string, any>
): EstadoMapaLocal => ({
  fazenda_id: resolveMapaOfflineFazendaId(raw),
  talhao_id: typeof raw?.talhao_id === 'string' ? raw.talhao_id : '',
  disponivel_offline: raw?.disponivel_offline === true,
  progresso_sincronizacao:
    typeof raw?.progresso_sincronizacao === 'number' ? raw.progresso_sincronizacao : 0,
  tamanho_mb: typeof raw?.tamanho_mb === 'number' ? raw.tamanho_mb : 0,
  ultima_sincronizacao:
    typeof raw?.ultima_sincronizacao === 'number' ? raw.ultima_sincronizacao : 0,
  proxima_sincronizacao:
    typeof raw?.proxima_sincronizacao === 'number' ? raw.proxima_sincronizacao : 0,
  update_disponivel: raw?.update_disponivel === true,
});

export const toEstadoMapaLocalCompativel = (
  raw: Partial<EstadoMapaLocal> & Record<string, any>
): EstadoMapaLocal => withLegacyMapaScopeAlias(normalizeEstadoMapaLocal(raw));

export const normalizeLogSincronizacao = (
  raw: Partial<LogSincronizacao> & Record<string, any>
): LogSincronizacao => ({
  fazenda_id: resolveMapaOfflineFazendaId(raw),
  id: typeof raw?.id === 'string' ? raw.id : '',
  timestamp_requisicao: typeof raw?.timestamp_requisicao === 'number' ? raw.timestamp_requisicao : 0,
  timestamp_resposta: typeof raw?.timestamp_resposta === 'number' ? raw.timestamp_resposta : 0,
  status: raw?.status ?? 'sucesso',
  total_talhoes_atualizados:
    typeof raw?.total_talhoes_atualizados === 'number' ? raw.total_talhoes_atualizados : 0,
  total_talhoes_removidos:
    typeof raw?.total_talhoes_removidos === 'number' ? raw.total_talhoes_removidos : 0,
  tamanho_download_mb: typeof raw?.tamanho_download_mb === 'number' ? raw.tamanho_download_mb : 0,
  erro: typeof raw?.erro === 'string' ? raw.erro : undefined,
});

export const toLogSincronizacaoCompativel = (
  raw: Partial<LogSincronizacao> & Record<string, any>
): LogSincronizacao => withLegacyMapaScopeAlias(normalizeLogSincronizacao(raw));

export const normalizeMapaFazendaResponse = (
  raw: Partial<MapaFazendaResponse> & Record<string, any>
): MapaFazendaResponse => {
  const fazendaId = resolveMapaOfflineFazendaId(raw);

  return {
    fazenda_id: fazendaId,
    fazenda_nome: typeof raw?.fazenda_nome === 'string' ? raw.fazenda_nome : '',
    ano: typeof raw?.ano === 'number' ? raw.ano : 0,
    gerados_em: typeof raw?.gerados_em === 'number' ? raw.gerados_em : 0,
    talhoes: Array.isArray(raw?.talhoes)
      ? raw.talhoes.map((talhao) => toMapaTalhaoOfflineCompativel(talhao, fazendaId))
      : [],
    tiles_url_base: typeof raw?.tiles_url_base === 'string' ? raw.tiles_url_base : undefined,
    bbox: raw?.bbox,
    versao_dados: typeof raw?.versao_dados === 'string' ? raw.versao_dados : '',
    checksum_completo:
      typeof raw?.checksum_completo === 'string' ? raw.checksum_completo : undefined,
  };
};

export const toMapaFazendaResponseCompativel = (
  raw: Partial<MapaFazendaResponse> & Record<string, any>
): MapaFazendaResponse => withLegacyMapaScopeAlias(normalizeMapaFazendaResponse(raw));

export const normalizeBackupMapaOffline = (
  raw: Partial<BackupMapaOffline> & Record<string, any>
): BackupMapaOffline => {
  const fazendaId = resolveMapaOfflineFazendaId(raw);

  return {
    versao: typeof raw?.versao === 'string' ? raw.versao : '1.0',
    fazenda_id: fazendaId,
    data_export: typeof raw?.data_export === 'string' ? raw.data_export : new Date(0).toISOString(),
    talhoes: Array.isArray(raw?.talhoes)
      ? raw.talhoes.map((talhao) => toMapaTalhaoOfflineCompativel(talhao, fazendaId))
      : [],
    checksum: typeof raw?.checksum === 'string' ? raw.checksum : '',
  };
};

export const toBackupMapaOfflineCompativel = (
  raw: Partial<BackupMapaOffline> & Record<string, any>
): BackupMapaOffline => withLegacyMapaScopeAlias(normalizeBackupMapaOffline(raw));
