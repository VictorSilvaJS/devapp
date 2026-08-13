export type CadernoCorrectionEditableValues = {
  dataAtividade?: Date | string | null;
  observacoes?: unknown;
  operacao?: unknown;
  produtosText?: unknown;
  dosagem?: unknown;
  areaAplicada?: unknown;
  produtividade?: unknown;
  condicoesClima?: unknown;
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

const normalizeOptionalNumber = (value: unknown): number | undefined => {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeProducts = (value: unknown): string[] => {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  return items.map((item) => String(item ?? '').trim()).filter(Boolean);
};

const assignChanged = (
  changes: Record<string, unknown>,
  field: string,
  current: unknown,
  next: unknown,
) => {
  if (JSON.stringify(current) !== JSON.stringify(next)) changes[field] = next;
};

export const buildCadernoCorrectionChanges = (
  registro: Record<string, any>,
  values: CadernoCorrectionEditableValues,
): Record<string, unknown> => {
  const changes: Record<string, unknown> = {};

  assignChanged(
    changes,
    'data_atividade',
    normalizeOptionalDate(registro?.data_atividade),
    normalizeOptionalDate(values.dataAtividade),
  );
  assignChanged(changes, 'observacoes', normalizeOptionalText(registro?.observacoes), normalizeOptionalText(values.observacoes));
  assignChanged(changes, 'operacao', normalizeOptionalText(registro?.operacao), normalizeOptionalText(values.operacao));
  assignChanged(changes, 'produtos_utilizados', normalizeProducts(registro?.produtos_utilizados), normalizeProducts(values.produtosText));
  assignChanged(changes, 'dosagem', normalizeOptionalText(registro?.dosagem), normalizeOptionalText(values.dosagem));
  assignChanged(changes, 'area_aplicada', normalizeOptionalNumber(registro?.area_aplicada), normalizeOptionalNumber(values.areaAplicada));
  assignChanged(changes, 'produtividade', normalizeOptionalNumber(registro?.produtividade), normalizeOptionalNumber(values.produtividade));
  assignChanged(changes, 'condicoes_clima', normalizeOptionalText(registro?.condicoes_clima), normalizeOptionalText(values.condicoesClima));

  return changes;
};

