const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const formatOperationalDateTime = (value: unknown): string => {
  if (!value) return 'Data não informada';

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Data não informada';

  const dateLabel = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateLabel} • ${timeLabel}`;
};

export const resolveOperationalSummary = (
  values: unknown[] = [],
  fallback = 'Sem resumo informado'
): string => {
  const summary = values.map(normalizeText).find(Boolean);
  return summary || fallback;
};
