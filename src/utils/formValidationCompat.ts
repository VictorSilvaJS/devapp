export type FormErrors = Record<string, unknown>;

export const getFirstFormErrorKey = (
  errors: FormErrors,
  visualOrder: readonly string[],
): string | null => {
  for (const fieldName of visualOrder) {
    const value = errors[fieldName];
    if (typeof value === 'string' ? value.trim().length > 0 : Boolean(value)) {
      return fieldName;
    }
  }

  return Object.keys(errors).find((fieldName) => Boolean(errors[fieldName])) || null;
};

export const getFormErrorScrollTarget = ({
  currentOffset,
  fieldPageY,
  containerPageY,
  topInset = 16,
}: {
  currentOffset: number;
  fieldPageY: number;
  containerPageY: number;
  topInset?: number;
}): number => Math.max(0, currentOffset + fieldPageY - containerPageY - topInset);
