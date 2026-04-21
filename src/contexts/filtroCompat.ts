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

export const normalizeFiltrosState = (
  raw: Partial<FiltrosCanonicos & { produtorId?: MaybeString }> = {}
): FiltrosCanonicos => ({
  regiao: normalizeFilterValue(raw.regiao),
  microregiao: normalizeFilterValue(raw.microregiao),
  fazenda: normalizeFilterValue(raw.fazenda),
  fazendaId: firstNonEmptyString(raw.fazendaId, raw.produtorId) ?? null,
  cidade: normalizeFilterValue(raw.cidade),
});

export const toFiltrosCompativeis = (
  raw: Partial<FiltrosCanonicos & { produtorId?: MaybeString }> = {}
): FiltrosCompativeis => {
  const filtros = normalizeFiltrosState(raw);

  return {
    ...filtros,
    produtorId: filtros.fazendaId,
  };
};

export const resolveFiltroFazendaId = (
  raw: Partial<FiltrosCanonicos & { produtorId?: MaybeString }> | null | undefined
): string | null => normalizeFiltrosState(raw ?? {}).fazendaId;
