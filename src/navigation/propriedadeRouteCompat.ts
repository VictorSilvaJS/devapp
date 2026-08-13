import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

export type PropriedadeDetailRouteParams = {
  id: string;
};

export type FazendaIdRouteParams = {
  fazendaId?: string;
  fazenda_id?: string;
  produtorId?: string;
  propriedadeId?: string;
};

export type PropriedadeContextRouteParams = FazendaIdRouteParams & {
  propriedadeId: string;
};

type PropriedadeRouteIdSource = 'propriedadeId' | 'fazendaId' | 'fazenda_id' | 'produtorId' | 'id';

export type PropriedadeRouteContextParams = FazendaIdRouteParams & {
  id?: string;
};

export type PropriedadeRouteContext = {
  fazendaId?: string;
  produtorId?: string;
  id?: string;
  propriedadeId?: string;
  propriedadeIdAlias?: string;
  effectivePropriedadeId?: string;
  effectiveFazendaId?: string;
  source?: PropriedadeRouteIdSource;
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

export const buildPropriedadeDetailRouteParams = (
  propriedade?: Record<string, any> | null
): PropriedadeDetailRouteParams | undefined => {
  const info = getFazendaUiInfo(propriedade);

  return info.id ? { id: info.id } : undefined;
};

export const buildPropriedadeContextRouteParams = (
  propriedade?: Record<string, any> | null
): PropriedadeContextRouteParams | undefined => {
  const info = getFazendaUiInfo(propriedade);

  return info.id
    ? {
        propriedadeId: info.id,
      }
    : undefined;
};

export const resolvePropriedadeRouteContext = (
  params?: PropriedadeRouteContextParams | null,
  options?: { allowIdAsFazendaId?: boolean }
): PropriedadeRouteContext => {
  const fazendaId = firstNonEmptyString(params?.fazendaId);
  const fazendaIdSnake = firstNonEmptyString(params?.fazenda_id);
  const produtorId = firstNonEmptyString(params?.produtorId);
  const id = firstNonEmptyString(params?.id);
  const propriedadeId = firstNonEmptyString(params?.propriedadeId);

  let effectiveFazendaId = propriedadeId || fazendaId || fazendaIdSnake;
  let source: PropriedadeRouteIdSource | undefined = propriedadeId
    ? 'propriedadeId'
    : fazendaId
      ? 'fazendaId'
      : fazendaIdSnake
        ? 'fazenda_id'
        : undefined;

  if (!effectiveFazendaId && produtorId) {
    effectiveFazendaId = produtorId;
    source = 'produtorId';
  }

  if (!effectiveFazendaId && options?.allowIdAsFazendaId && id) {
    effectiveFazendaId = id;
    source = 'id';
  }

  return {
    fazendaId,
    produtorId,
    id,
    propriedadeId,
    propriedadeIdAlias: propriedadeId,
    effectivePropriedadeId: effectiveFazendaId,
    effectiveFazendaId,
    source,
  };
};
