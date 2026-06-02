import { getPropriedadeId, getPropriedadeNome } from '../utils/propriedadeCompat';

type MaybeString = string | null | undefined;

export type FiltrosCanonicos = {
  regiao: string;
  microregiao: string;
  fazenda: string;
  fazendaId: string | null;
  cidade: string;
};

export type FiltrosCompativeis = FiltrosCanonicos & {
  produtorId: string | null;
};

type FiltrosInput = Partial<
  FiltrosCanonicos & {
    produtorId?: MaybeString;
    propriedade_id?: MaybeString;
    propriedadeId?: MaybeString;
    propriedade_nome?: MaybeString;
    propriedadeNome?: MaybeString;
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

const resolveFiltroPropriedadeId = (raw: FiltrosInput): string | undefined =>
  firstNonEmptyString(getPropriedadeId(raw), raw.fazendaId, raw.produtorId);

const resolveFiltroFazendaNome = (raw: FiltrosInput): string =>
  normalizeFilterValue(raw.fazenda ?? getPropriedadeNome(raw));

export const normalizeFiltrosState = (
  raw: FiltrosInput = {}
): FiltrosCanonicos => ({
  regiao: normalizeFilterValue(raw.regiao),
  microregiao: normalizeFilterValue(raw.microregiao),
  fazenda: resolveFiltroFazendaNome(raw),
  fazendaId: resolveFiltroPropriedadeId(raw) ?? null,
  cidade: normalizeFilterValue(raw.cidade),
});

export const toFiltrosCompativeis = (
  raw: FiltrosInput = {}
): FiltrosCompativeis => {
  const filtros = normalizeFiltrosState(raw);

  return {
    ...filtros,
    produtorId: filtros.fazendaId,
  };
};

export const resolveFiltroFazendaId = (
  raw: FiltrosInput | null | undefined
): string | null => normalizeFiltrosState(raw ?? {}).fazendaId;
