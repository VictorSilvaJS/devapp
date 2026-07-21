export const MEDIDA_NAO_INFORMADA = 'Não informado';

export type CoberturaAreas = 'completa' | 'parcial' | 'ausente';

export type ResumoAreaMapeada = {
  totalTalhoes: number;
  talhoesComArea: number;
  areaMapeada: number | null;
  coberturaAreas: CoberturaAreas;
  label: 'Área mapeada' | 'Área mapeada parcial';
  valorFormatado: string;
};

type TalhaoComArea = {
  area_hectares?: unknown;
};

type PropriedadeComAreaTotal = {
  area_total?: unknown;
};

export type UnidadePerimetro = 'm' | 'km';

const formatNumberPtBr = (value: number, maximumFractionDigits: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);

const normalizePositiveFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

export const normalizeAreaValue = (value: unknown): number | null =>
  normalizePositiveFiniteNumber(value);

export const formatAreaHa = (value: unknown): string => {
  const normalized = normalizeAreaValue(value);
  return normalized == null
    ? MEDIDA_NAO_INFORMADA
    : `${formatNumberPtBr(normalized, 2)} ha`;
};

export const resolveAreaTotalInformada = (
  propriedade: PropriedadeComAreaTotal | null | undefined
): number | null => normalizeAreaValue(propriedade?.area_total);

export const summarizeMappedArea = (
  talhoes: readonly TalhaoComArea[] | null | undefined
): ResumoAreaMapeada => {
  const items = Array.isArray(talhoes) ? talhoes : [];
  const validAreas = items
    .map((talhao) => normalizeAreaValue(talhao?.area_hectares))
    .filter((value): value is number => value != null);
  const talhoesComArea = validAreas.length;
  const areaMapeada = talhoesComArea > 0
    ? validAreas.reduce((total, value) => total + value, 0)
    : null;
  const coberturaAreas: CoberturaAreas = talhoesComArea === 0
    ? 'ausente'
    : talhoesComArea === items.length
      ? 'completa'
      : 'parcial';
  const label = coberturaAreas === 'parcial'
    ? 'Área mapeada parcial'
    : 'Área mapeada';

  return {
    totalTalhoes: items.length,
    talhoesComArea,
    areaMapeada,
    coberturaAreas,
    label,
    valorFormatado: formatAreaHa(areaMapeada),
  };
};

export const normalizePerimeterValue = (value: unknown): number | null =>
  normalizePositiveFiniteNumber(value);

export const formatPerimeter = (
  value: unknown,
  unit: unknown,
  origemComprovada: unknown
): string => {
  const normalized = normalizePerimeterValue(value);
  const knownUnit = unit === 'm' || unit === 'km' ? unit : null;
  const hasProvenOrigin = typeof origemComprovada === 'string'
    && origemComprovada.trim().length > 0;

  if (normalized == null || knownUnit == null || !hasProvenOrigin) {
    return MEDIDA_NAO_INFORMADA;
  }

  return `${formatNumberPtBr(normalized, 2)} ${knownUnit}`;
};
