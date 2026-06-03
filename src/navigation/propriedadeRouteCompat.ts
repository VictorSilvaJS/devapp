import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

export type PropriedadeDetailRouteParams = {
  id: string;
};

export type PropriedadeContextRouteParams = {
  fazendaId: string;
  produtorId: string;
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
        fazendaId: info.id,
        produtorId: info.id,
      }
    : undefined;
};
