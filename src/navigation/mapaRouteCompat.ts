type ParamContextoFazenda = {
  fazendaId?: string;
  produtorId?: string;
};

export type MapasRouteParams = ParamContextoFazenda;

export type FazendaMapaRouteParams = ParamContextoFazenda & {
  titularNome?: string;
  produtorNome?: string;
  fazendaNome?: string;
  talhaoId?: string;
};

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

export const resolveRouteFazendaId = (
  params?: ParamContextoFazenda | null
): string | undefined => firstNonEmptyString(params?.fazendaId, params?.produtorId);

export const resolveRouteTitularNome = (
  params?: FazendaMapaRouteParams | null
): string | undefined => firstNonEmptyString(params?.titularNome, params?.produtorNome);

export const buildMapasRouteParams = (
  params?: MapasRouteParams | null
): MapasRouteParams | undefined => {
  const fazendaId = resolveRouteFazendaId(params);

  if (!fazendaId) {
    return undefined;
  }

  return {
    fazendaId,
    produtorId: fazendaId,
  };
};

export const buildFazendaMapaRouteParams = (
  params?: FazendaMapaRouteParams | null
): FazendaMapaRouteParams | undefined => {
  const fazendaId = resolveRouteFazendaId(params);
  const titularNome = resolveRouteTitularNome(params);
  const routeParams: FazendaMapaRouteParams = {};

  if (fazendaId) {
    routeParams.fazendaId = fazendaId;
    routeParams.produtorId = fazendaId;
  }

  withDefinedString(routeParams, 'titularNome', titularNome);
  withDefinedString(routeParams, 'produtorNome', titularNome);
  withDefinedString(routeParams, 'fazendaNome', params?.fazendaNome);
  withDefinedString(routeParams, 'talhaoId', params?.talhaoId);

  return Object.keys(routeParams).length > 0 ? routeParams : undefined;
};
