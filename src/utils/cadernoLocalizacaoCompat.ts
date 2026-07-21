export const CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA = 'foreground_explicit' as const;

export const CADERNO_LOCALIZACAO_KEYS = [
  'localizacao_latitude',
  'localizacao_longitude',
  'localizacao_accuracy',
  'localizacao_captured_at',
  'localizacao_captured_by',
  'localizacao_origem',
] as const;

export type CadernoLocalizacaoKey = typeof CADERNO_LOCALIZACAO_KEYS[number];

export type CadernoLocalizacaoExplicita = {
  localizacao_latitude: number;
  localizacao_longitude: number;
  localizacao_accuracy?: number | null;
  localizacao_captured_at: string;
  localizacao_captured_by?: string;
  localizacao_origem: typeof CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA;
};

export type CadernoLocalizacaoFields = Partial<CadernoLocalizacaoExplicita>;

export type CadernoLocalizacaoValidationResult =
  | { valid: true; status: 'absent'; value: null }
  | { valid: true; status: 'valid'; value: CadernoLocalizacaoExplicita }
  | { valid: false; status: 'invalid'; value: null; error: string };

export type CadernoLocalizacaoChange =
  | { kind: 'preserve' }
  | { kind: 'replace'; value: CadernoLocalizacaoExplicita }
  | { kind: 'remove' };

const hasOwn = (value: unknown, key: string): boolean =>
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && Object.prototype.hasOwnProperty.call(value, key);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasLocationValue = (value: unknown): boolean =>
  CADERNO_LOCALIZACAO_KEYS.some((key) => hasOwn(value, key) && (value as any)[key] !== undefined);

const isValidIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(normalized);
  if (!match || !Number.isFinite(Date.parse(normalized))) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth
    && hour >= 0
    && hour <= 23
    && minute >= 0
    && minute <= 59
    && second >= 0
    && second <= 59;
};

export const hasCadernoLocalizacaoFieldIntent = (value: unknown): boolean =>
  CADERNO_LOCALIZACAO_KEYS.some((key) => hasOwn(value, key));

export const isCadernoLocalizacaoRemovalPatch = (value: unknown): boolean =>
  CADERNO_LOCALIZACAO_KEYS.every((key) => hasOwn(value, key) && (value as any)[key] === undefined);

export const validateCadernoLocalizacao = (value: unknown): CadernoLocalizacaoValidationResult => {
  if (!hasLocationValue(value)) {
    return { valid: true, status: 'absent', value: null };
  }

  const source = value as Record<string, unknown>;
  const latitude = source.localizacao_latitude;
  const longitude = source.localizacao_longitude;
  const hasLatitude = latitude !== undefined;
  const hasLongitude = longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    return {
      valid: false,
      status: 'invalid',
      value: null,
      error: 'Latitude e longitude da localização devem ser informadas juntas.',
    };
  }

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    return { valid: false, status: 'invalid', value: null, error: 'Latitude da localização inválida.' };
  }

  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    return { valid: false, status: 'invalid', value: null, error: 'Longitude da localização inválida.' };
  }

  const accuracy = source.localizacao_accuracy;
  if (accuracy !== undefined && accuracy !== null && (!isFiniteNumber(accuracy) || accuracy < 0)) {
    return { valid: false, status: 'invalid', value: null, error: 'Precisão da localização inválida.' };
  }

  const capturedAt = source.localizacao_captured_at;
  if (!isValidIsoTimestamp(capturedAt)) {
    return { valid: false, status: 'invalid', value: null, error: 'Data/hora da localização inválida.' };
  }

  const capturedBy = source.localizacao_captured_by;
  if (capturedBy !== undefined && (typeof capturedBy !== 'string' || capturedBy.trim().length === 0)) {
    return { valid: false, status: 'invalid', value: null, error: 'Responsável pela captura da localização inválido.' };
  }

  if (source.localizacao_origem !== CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA) {
    return { valid: false, status: 'invalid', value: null, error: 'Origem da localização inválida.' };
  }

  const normalized: CadernoLocalizacaoExplicita = {
    localizacao_latitude: latitude,
    localizacao_longitude: longitude,
    localizacao_captured_at: (capturedAt as string).trim(),
    localizacao_origem: CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA,
  };

  if (accuracy !== undefined) {
    normalized.localizacao_accuracy = accuracy as number | null;
  }

  if (typeof capturedBy === 'string') {
    normalized.localizacao_captured_by = capturedBy.trim();
  }

  return { valid: true, status: 'valid', value: normalized };
};

export const extractCadernoLocalizacao = (record: unknown): CadernoLocalizacaoValidationResult =>
  validateCadernoLocalizacao(record);

export const normalizeCadernoLocalizacao = (record: unknown): CadernoLocalizacaoExplicita | null => {
  const result = validateCadernoLocalizacao(record);
  return result.valid && result.status === 'valid' ? result.value : null;
};

export const hasCadernoLocalizacao = (record: unknown): boolean =>
  validateCadernoLocalizacao(record).status === 'valid';

export const buildCadernoLocalizacaoFields = (value?: unknown): CadernoLocalizacaoFields => {
  const result = validateCadernoLocalizacao(value);

  if (result.status === 'absent') return {};
  if (result.valid === false) throw new Error(result.error);
  return { ...result.value };
};

export const clearCadernoLocalizacaoFields = <T extends Record<string, any>>(record: T): T => {
  const next = { ...record };
  CADERNO_LOCALIZACAO_KEYS.forEach((key) => delete next[key]);
  return next;
};

export const buildCadernoLocalizacaoRemovalPatch = (): Record<CadernoLocalizacaoKey, undefined> =>
  CADERNO_LOCALIZACAO_KEYS.reduce((patch, key) => {
    patch[key] = undefined;
    return patch;
  }, {} as Record<CadernoLocalizacaoKey, undefined>);

export const applyCadernoLocalizacaoChange = <T extends Record<string, any>>(
  record: T,
  change: CadernoLocalizacaoChange
): T => {
  if (change.kind === 'preserve') return { ...record };

  const withoutLocation = clearCadernoLocalizacaoFields(record);
  if (change.kind === 'remove') return withoutLocation;

  return {
    ...withoutLocation,
    ...buildCadernoLocalizacaoFields(change.value),
  };
};
