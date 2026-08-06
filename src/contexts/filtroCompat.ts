import { getPropriedadeId, getPropriedadeNome } from '../utils/propriedadeCompat';

type MaybeString = string | null | undefined;

export type FiltrosCanonicos = {
  uf: string;
  municipio: string;
  propriedade: string;
  propriedadeId: string | null;
};

export type FiltrosCompativeis = FiltrosCanonicos & {
  fazenda: string;
  fazendaId: string | null;
  cidade: string;
  produtorId: string | null;
};

type FiltrosInput = Partial<
  FiltrosCanonicos & {
    produtorId?: MaybeString;
    propriedade_id?: MaybeString;
    propriedadeId?: MaybeString;
    propriedade_nome?: MaybeString;
    propriedadeNome?: MaybeString;
    uf?: MaybeString;
    municipio?: MaybeString;
    cidade?: MaybeString;
    fazenda?: MaybeString;
    fazendaId?: MaybeString;
    fazenda_id?: MaybeString;
    fazenda_nome?: MaybeString;
    fazendaNome?: MaybeString;
  }
>;

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

const normalizeFilterValue = (value: MaybeString, fallback = 'todas'): string =>
  firstNonEmptyString(value) ?? fallback;

const resolveFiltroPropriedadeIdInterno = (raw: FiltrosInput): string | undefined =>
  firstNonEmptyString(getPropriedadeId(raw), raw.fazendaId, raw.produtorId);

const resolveFiltroPropriedadeNome = (raw: FiltrosInput): string =>
  normalizeFilterValue(raw.propriedade ?? raw.fazenda ?? getPropriedadeNome(raw));

export const normalizeFiltrosState = (
  raw: FiltrosInput = {}
): FiltrosCanonicos => ({
  uf: normalizeFilterValue(raw.uf),
  municipio: normalizeFilterValue(raw.municipio ?? raw.cidade),
  propriedade: resolveFiltroPropriedadeNome(raw),
  propriedadeId: resolveFiltroPropriedadeIdInterno(raw) ?? null,
});

export const toFiltrosCompativeis = (
  raw: FiltrosInput = {}
): FiltrosCompativeis => {
  const filtros = normalizeFiltrosState(raw);

  return {
    ...filtros,
    fazenda: filtros.propriedade,
    fazendaId: filtros.propriedadeId,
    cidade: filtros.municipio,
    produtorId: filtros.propriedadeId,
  };
};

export const resolveFiltroPropriedadeId = (
  raw: FiltrosInput | null | undefined
): string | null => normalizeFiltrosState(raw ?? {}).propriedadeId;

export const resolveFiltroFazendaId = (
  raw: FiltrosInput | null | undefined
): string | null => resolveFiltroPropriedadeId(raw);
