import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

type ParamContextoFazenda = {
  propriedadeId?: string;
  fazendaId?: string;
  produtorId?: string;
};

export type MapasRouteParams = ParamContextoFazenda;

export type FazendaMapaRouteParams = ParamContextoFazenda & {
  titularNome?: string;
  produtorNome?: string;
  fazendaNome?: string;
  talhaoId?: string;
  talhaoNome?: string;
  talhao?: string;
  talhaoAno?: string;
  cadernoLatitude?: number;
  cadernoLongitude?: number;
  cadernoAccuracy?: number | null;
  cadernoCapturedAt?: string;
};

export type CadernoMapLocationRoute = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

type TalhaoSelectionParams = Pick<FazendaMapaRouteParams, 'talhaoId' | 'talhaoNome' | 'talhao' | 'talhaoAno'>;

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

const withDefinedString = <T extends Record<string, any>>(
  target: T,
  key: keyof T,
  value: unknown
) => {
  const normalized = firstNonEmptyString(value);
  if (normalized) {
    target[key] = normalized as T[keyof T];
  }
};

const withDefinedNumber = <T extends Record<string, any>>(
  target: T,
  key: keyof T,
  value: unknown,
  options: { min: number; max: number; allowNull?: boolean }
) => {
  if (value === null && options.allowNull) {
    target[key] = null as T[keyof T];
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= options.min && value <= options.max) {
    target[key] = value as T[keyof T];
  }
};

const normalizeLookupText = (value: unknown): string | undefined => {
  const normalized = firstNonEmptyString(value);
  if (!normalized) {
    return undefined;
  }

  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveItemFazendaId = (item?: Record<string, any> | null): string | undefined =>
  firstNonEmptyString(item?.propriedade_id, item?.propriedadeId, item?.fazenda_id, item?.produtor_id);

const resolveItemTalhaoId = (item?: Record<string, any> | null): string | undefined =>
  firstNonEmptyString(item?.id, item?.talhao_id, item?.limite_id, item?.limite_area_id);

const resolveItemTalhaoNome = (item?: Record<string, any> | null): string | undefined =>
  firstNonEmptyString(item?.talhaoNome, item?.talhao_nome, item?.talhao, item?.nome);

const resolveItemAno = (item?: Record<string, any> | null): number | undefined => {
  const ano = item?.ano;
  if (typeof ano === 'number' && Number.isFinite(ano)) {
    return ano;
  }

  if (typeof ano === 'string') {
    const parsed = Number.parseInt(ano, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const resolveAnoReferenciaMapa = (mapa?: Record<string, any> | null): number | undefined => {
  const safra = firstNonEmptyString(mapa?.safra);
  if (safra) {
    const anos = safra.match(/\d{4}/g)?.map((ano) => Number.parseInt(ano, 10)) ?? [];
    if (anos.length > 0) {
      return Math.max(...anos);
    }
  }

  const data = firstNonEmptyString(mapa?.data_criacao);
  if (data) {
    const year = new Date(data).getFullYear();
    if (Number.isFinite(year)) {
      return year;
    }
  }

  return undefined;
};

const resolveRouteTalhaoAnoNumber = (params?: TalhaoSelectionParams | null): number | undefined => {
  const ano = firstNonEmptyString(params?.talhaoAno);
  if (!ano) {
    return undefined;
  }

  const parsed = Number.parseInt(ano, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const sortTalhoesMaisRecentes = (a: Record<string, any>, b: Record<string, any>) =>
  (resolveItemAno(b) ?? 0) - (resolveItemAno(a) ?? 0);

const findTalhaoCompativel = (
  talhoes: Record<string, any>[] = [],
  options: {
    talhaoId?: string;
    talhaoNome?: string;
    fazendaId?: string;
    anoReferencia?: number;
  }
): Record<string, any> | undefined => {
  const fazendaId = firstNonEmptyString(options.fazendaId);
  const sameFazenda = (item: Record<string, any>) => {
    if (!fazendaId) {
      return true;
    }

    const itemFazendaId = resolveItemFazendaId(item);
    return itemFazendaId ? itemFazendaId === fazendaId : true;
  };

  const talhaoId = firstNonEmptyString(options.talhaoId);
  if (talhaoId) {
    const byId = talhoes.find((talhao) => sameFazenda(talhao) && resolveItemTalhaoId(talhao) === talhaoId);
    if (byId) {
      return byId;
    }
  }

  const talhaoNome = normalizeLookupText(options.talhaoNome);
  if (!talhaoNome) {
    return undefined;
  }

  const candidatos = talhoes
    .filter((talhao) => sameFazenda(talhao) && normalizeLookupText(resolveItemTalhaoNome(talhao)) === talhaoNome)
    .sort(sortTalhoesMaisRecentes);

  if (candidatos.length === 0) {
    return undefined;
  }

  if (options.anoReferencia) {
    return candidatos.find((talhao) => resolveItemAno(talhao) === options.anoReferencia) ?? candidatos[0];
  }

  return candidatos[0];
};

export const resolveRouteFazendaId = (
  params?: ParamContextoFazenda | null
): string | undefined => firstNonEmptyString(params?.propriedadeId, params?.fazendaId, params?.produtorId);

export const resolveRouteTitularNome = (
  params?: FazendaMapaRouteParams | null
): string | undefined => firstNonEmptyString(params?.titularNome, params?.produtorNome);

export const resolveRouteTalhaoId = (
  params?: TalhaoSelectionParams | null
): string | undefined => firstNonEmptyString(params?.talhaoId);

export const resolveRouteTalhaoNome = (
  params?: TalhaoSelectionParams | null
): string | undefined => firstNonEmptyString(params?.talhaoNome, params?.talhao);

export const resolveRouteCadernoLocation = (
  params?: FazendaMapaRouteParams | null
): CadernoMapLocationRoute | null => {
  const latitude = params?.cadernoLatitude;
  const longitude = params?.cadernoLongitude;
  const capturedAt = firstNonEmptyString(params?.cadernoCapturedAt);
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!capturedAt || !Number.isFinite(Date.parse(capturedAt))) return null;

  const accuracy = params?.cadernoAccuracy;
  if (accuracy !== undefined && accuracy !== null
    && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0)) return null;

  return {
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    capturedAt,
  };
};

export const buildMapaTalhaoRouteSelection = (
  mapa?: Record<string, any> | null,
  talhoes: Record<string, any>[] = []
): TalhaoSelectionParams | undefined => {
  const fazendaId = resolveItemFazendaId(mapa);
  const talhaoIdExplicito = firstNonEmptyString(mapa?.talhao_id, mapa?.limite_id, mapa?.limite_area_id);
  const talhaoNome = resolveItemTalhaoNome(mapa);
  const anoReferencia = resolveAnoReferenciaMapa(mapa);
  const talhaoCompativel = findTalhaoCompativel(talhoes, {
    talhaoId: talhaoIdExplicito,
    talhaoNome,
    fazendaId,
    anoReferencia,
  });

  const selection: TalhaoSelectionParams = {};
  withDefinedString(selection, 'talhaoId', resolveItemTalhaoId(talhaoCompativel) ?? talhaoIdExplicito);
  withDefinedString(selection, 'talhaoNome', talhaoNome);
  withDefinedString(selection, 'talhao', talhaoNome);
  withDefinedString(selection, 'talhaoAno', String(resolveItemAno(talhaoCompativel) ?? anoReferencia ?? ''));

  return Object.keys(selection).length > 0 ? selection : undefined;
};

export const resolveTalhaoSelecionadoFromRoute = (
  talhoes: Record<string, any>[] = [],
  params?: TalhaoSelectionParams | null
): { talhaoId?: string; talhaoAno?: number; matchType?: 'id' | 'nome' | 'legado' } => {
  const talhaoId = resolveRouteTalhaoId(params);
  const talhaoNome = resolveRouteTalhaoNome(params);
  const anoReferencia = resolveRouteTalhaoAnoNumber(params);
  const matchById = talhaoId
    ? findTalhaoCompativel(talhoes, { talhaoId, anoReferencia })
    : undefined;

  if (matchById) {
    return {
      talhaoId: resolveItemTalhaoId(matchById),
      talhaoAno: resolveItemAno(matchById),
      matchType: 'id',
    };
  }

  const nomeCompativel = firstNonEmptyString(talhaoNome, talhaoId);
  const matchByNome = findTalhaoCompativel(talhoes, {
    talhaoNome: nomeCompativel,
    anoReferencia,
  });

  if (matchByNome) {
    return {
      talhaoId: resolveItemTalhaoId(matchByNome),
      talhaoAno: resolveItemAno(matchByNome),
      matchType: talhaoNome ? 'nome' : 'legado',
    };
  }

  return {
    talhaoAno: anoReferencia,
  };
};

export const buildMapasRouteParams = (
  params?: MapasRouteParams | null
): MapasRouteParams | undefined => {
  const fazendaId = resolveRouteFazendaId(params);

  if (!fazendaId) {
    return undefined;
  }

  return {
    propriedadeId: fazendaId,
  };
};

export const buildFazendaMapaRouteParams = (
  params?: FazendaMapaRouteParams | null
): FazendaMapaRouteParams | undefined => {
  const fazendaId = resolveRouteFazendaId(params);
  const titularNome = resolveRouteTitularNome(params);
  const routeParams: FazendaMapaRouteParams = {};

  if (fazendaId) {
    routeParams.propriedadeId = fazendaId;
  }

  withDefinedString(routeParams, 'titularNome', titularNome);
  withDefinedString(routeParams, 'produtorNome', titularNome);
  withDefinedString(routeParams, 'fazendaNome', params?.fazendaNome);
  withDefinedString(routeParams, 'talhaoId', params?.talhaoId);
  withDefinedString(routeParams, 'talhaoNome', params?.talhaoNome);
  withDefinedString(routeParams, 'talhao', params?.talhao);
  withDefinedString(routeParams, 'talhaoAno', params?.talhaoAno);
  withDefinedNumber(routeParams, 'cadernoLatitude', params?.cadernoLatitude, { min: -90, max: 90 });
  withDefinedNumber(routeParams, 'cadernoLongitude', params?.cadernoLongitude, { min: -180, max: 180 });
  withDefinedNumber(routeParams, 'cadernoAccuracy', params?.cadernoAccuracy, {
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    allowNull: true,
  });
  withDefinedString(routeParams, 'cadernoCapturedAt', params?.cadernoCapturedAt);

  return Object.keys(routeParams).length > 0 ? routeParams : undefined;
};

export const buildFazendaMapaRouteParamsFromPropriedade = (
  propriedade?: Record<string, any> | null,
  params?: FazendaMapaRouteParams | null
): FazendaMapaRouteParams | undefined => {
  const info = getFazendaUiInfo(propriedade);

  return buildFazendaMapaRouteParams({
    ...params,
    propriedadeId: info.id || params?.propriedadeId || params?.fazendaId,
    fazendaNome: info.fazendaNome || params?.fazendaNome,
    titularNome: info.titularNome || params?.titularNome,
  });
};
