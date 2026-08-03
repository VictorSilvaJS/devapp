import {
  PERIODO_PRODUTIVO_STATUSES,
  PERIODO_PRODUTIVO_TIPOS,
  PeriodoProdutivoStatus,
  PeriodoProdutivoTipo,
} from '../types/periodoProdutivo';
import {
  getTalhaoConsultaId,
  getTalhaoConsultaNome,
  getTalhaoStableId,
} from './talhaoConsultaCompat';

export const PERIODO_PRODUTIVO_CULTURA_OUTRO = 'outro';
export const PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE = '__periodo_talhao_legado__';

export const PERIODO_PRODUTIVO_CULTURA_OPTIONS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'algodao', label: 'Algodão' },
  { value: PERIODO_PRODUTIVO_CULTURA_OUTRO, label: 'Outro' },
] as const;

export type PeriodoProdutivoCulturaOption =
  typeof PERIODO_PRODUTIVO_CULTURA_OPTIONS[number]['value'] | '';

export type PeriodoProdutivoFormErrors = Partial<Record<
  'tipoPeriodo' | 'cultura' | 'culturaOutro' | 'anoAgricola' | 'dataFim' | 'status',
  string
>>;

const normalizeLookup = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const buildPeriodoProdutivoTalhaoOptions = (
  talhoes: Array<Record<string, any>> = [],
  current: { id?: unknown; nome?: unknown } = {}
): {
  options: Array<{ value: string; label: string; description?: string }>;
  selectedValue: string;
} => {
  const currentId = String(current.id ?? '').trim();
  const currentNome = String(current.nome ?? '').trim();
  const currentItem = currentId
    ? talhoes.find((item) => getTalhaoConsultaId(item) === currentId)
    : undefined;
  const orderedTalhoes = currentItem
    ? [currentItem, ...talhoes.filter((item) => item !== currentItem)]
    : talhoes;
  const options: Array<{ value: string; label: string; description?: string }> = [
    { value: '', label: 'Toda a Propriedade' },
  ];
  const seenIds = new Set<string>();

  orderedTalhoes.forEach((item) => {
    const id = getTalhaoStableId(item);
    const nome = getTalhaoConsultaNome(item);
    if (!id || !nome || seenIds.has(id)) return;
    seenIds.add(id);
    options.push({ value: id, label: nome });
  });

  let selectedValue = currentId;
  const selectedOption = currentId
    ? options.find((option) => option.value === selectedValue)
    : undefined;

  if (selectedOption) {
    selectedValue = selectedOption.value;
  } else if (currentId) {
    options.push({
      value: currentId,
      label: currentNome || 'Talhão salvo',
      description: 'Referência salva; não consta no catálogo atual da Propriedade.',
    });
    selectedValue = currentId;
  } else if (currentNome) {
    options.push({
      value: PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE,
      label: currentNome,
      description: 'Referência legada em texto; preservada sem criar um ID.',
    });
    selectedValue = PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE;
  }

  return { options, selectedValue };
};

export const maskPeriodoProdutivoAnoAgricola = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}/${digits.slice(4)}`;
};

export const isPeriodoProdutivoAnoAgricolaValido = (value: unknown): boolean =>
  /^\d{4}\/\d{4}$/.test(String(value ?? '').trim());

export const resolvePeriodoProdutivoCulturaSelection = (value: unknown): {
  option: PeriodoProdutivoCulturaOption;
  outro: string;
} => {
  const cultura = String(value ?? '').trim();
  if (!cultura) return { option: '', outro: '' };

  const known = PERIODO_PRODUTIVO_CULTURA_OPTIONS.find((option) => (
    option.value !== PERIODO_PRODUTIVO_CULTURA_OUTRO
    && normalizeLookup(option.label) === normalizeLookup(cultura)
  ));

  return known
    ? { option: known.value, outro: '' }
    : { option: PERIODO_PRODUTIVO_CULTURA_OUTRO, outro: cultura };
};

export const resolvePeriodoProdutivoCulturaValue = (
  option: PeriodoProdutivoCulturaOption,
  outro: unknown
): string => {
  if (option === PERIODO_PRODUTIVO_CULTURA_OUTRO) return String(outro ?? '').trim();
  return PERIODO_PRODUTIVO_CULTURA_OPTIONS.find((item) => item.value === option)?.label ?? '';
};

export const validatePeriodoProdutivoFormValues = (input: {
  tipoPeriodo?: PeriodoProdutivoTipo | '' | null;
  culturaOption?: PeriodoProdutivoCulturaOption | null;
  culturaOutro?: unknown;
  anoAgricola?: unknown;
  dataInicio?: Date | null;
  dataFim?: Date | null;
  status?: PeriodoProdutivoStatus | '' | null;
}): PeriodoProdutivoFormErrors => {
  const errors: PeriodoProdutivoFormErrors = {};

  if (!input.tipoPeriodo || !PERIODO_PRODUTIVO_TIPOS.includes(input.tipoPeriodo as PeriodoProdutivoTipo)) {
    errors.tipoPeriodo = 'Selecione o tipo';
  }

  if (!input.culturaOption) {
    errors.cultura = 'Selecione a cultura';
  } else if (
    input.culturaOption === PERIODO_PRODUTIVO_CULTURA_OUTRO
    && !resolvePeriodoProdutivoCulturaValue(input.culturaOption, input.culturaOutro)
  ) {
    errors.culturaOutro = 'Informe a cultura';
  }

  const anoAgricola = String(input.anoAgricola ?? '').trim();
  if (!anoAgricola) {
    errors.anoAgricola = 'Informe o ano agrícola';
  } else if (!isPeriodoProdutivoAnoAgricolaValido(anoAgricola)) {
    errors.anoAgricola = 'Use o formato AAAA/AAAA';
  }

  if (
    input.dataInicio instanceof Date
    && input.dataFim instanceof Date
    && input.dataInicio.getTime() > input.dataFim.getTime()
  ) {
    errors.dataFim = 'A data final deve ser igual ou posterior ao início';
  }

  if (!input.status || !PERIODO_PRODUTIVO_STATUSES.includes(input.status as PeriodoProdutivoStatus)) {
    errors.status = 'Selecione o status';
  }

  return errors;
};
