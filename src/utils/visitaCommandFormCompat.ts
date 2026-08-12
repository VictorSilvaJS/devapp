export type VisitaCommandEditableValues = {
  observacoes?: unknown;
  recomendacoes?: unknown;
  clima?: unknown;
  proximaVisita?: Date | string | null;
  responsavelExecutanteNome?: unknown;
  fotos?: unknown[];
};

const normalizeOptionalText = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
};

const normalizeOptionalDate = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  const timestamp = new Date(value as any).getTime();
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
};

const valuesDiffer = (current: unknown, next: unknown): boolean =>
  JSON.stringify(current) !== JSON.stringify(next);

const assignChangedText = (
  changes: Record<string, unknown>,
  field: string,
  current: unknown,
  next: unknown,
) => {
  const currentValue = normalizeOptionalText(current);
  const nextValue = normalizeOptionalText(next);
  if (currentValue !== nextValue) changes[field] = nextValue;
};

const assignChangedDate = (
  changes: Record<string, unknown>,
  field: string,
  current: unknown,
  next: unknown,
) => {
  const currentValue = normalizeOptionalDate(current);
  const nextValue = normalizeOptionalDate(next);
  if (currentValue !== nextValue) changes[field] = nextValue;
};

export const buildVisitaConclusionDetails = (
  visita: Record<string, any>,
  values: VisitaCommandEditableValues,
): Record<string, unknown> => {
  const changes: Record<string, unknown> = {};
  assignChangedText(changes, 'observacoes', visita?.observacoes, values.observacoes);
  assignChangedText(changes, 'recomendacoes', visita?.recomendacoes, values.recomendacoes);
  assignChangedText(changes, 'clima', visita?.clima, values.clima);
  assignChangedDate(changes, 'proximaVisita', visita?.proximaVisita, values.proximaVisita);

  if (Array.isArray(values.fotos)) {
    const currentPhotos = Array.isArray(visita?.fotos) ? visita.fotos : [];
    if (valuesDiffer(currentPhotos, values.fotos)) changes.fotos = values.fotos;
  }

  return changes;
};

export const buildVisitaCorrectionChanges = (
  visita: Record<string, any>,
  values: VisitaCommandEditableValues & { resumoConclusao?: unknown },
): Record<string, unknown> => {
  const changes: Record<string, unknown> = {};
  assignChangedText(changes, 'resumo_conclusao', visita?.resumo_conclusao, values.resumoConclusao);
  assignChangedText(changes, 'observacoes', visita?.observacoes, values.observacoes);
  assignChangedText(changes, 'recomendacoes', visita?.recomendacoes, values.recomendacoes);
  assignChangedText(changes, 'clima', visita?.clima, values.clima);
  assignChangedDate(changes, 'proximaVisita', visita?.proximaVisita, values.proximaVisita);
  assignChangedText(
    changes,
    'responsavel_executante_nome',
    visita?.responsavel_executante_nome || visita?.tecnico_responsavel,
    values.responsavelExecutanteNome,
  );
  return changes;
};
