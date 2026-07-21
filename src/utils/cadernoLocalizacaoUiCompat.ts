import {
  CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA,
  type CadernoLocalizacaoExplicita,
  type CadernoLocalizacaoFields,
  type CadernoLocalizacaoKey,
  buildCadernoLocalizacaoFields,
  buildCadernoLocalizacaoRemovalPatch,
  clearCadernoLocalizacaoFields,
  extractCadernoLocalizacao,
  normalizeCadernoLocalizacao,
} from './cadernoLocalizacaoCompat';

export const CADERNO_LOCALIZACAO_PERMISSION_DENIED_MESSAGE =
  'Permissão de localização negada. Você ainda pode salvar o Caderno sem localização.';

export const CADERNO_LOCALIZACAO_SERVICES_DISABLED_MESSAGE =
  'Ative a localização do aparelho para incluir a posição neste registro. Você ainda pode salvar sem localização.';

export const CADERNO_LOCALIZACAO_UNAVAILABLE_MESSAGE =
  'Não foi possível obter a posição atual do aparelho. Você ainda pode salvar o Caderno sem localização.';

export const CADERNO_LOCALIZACAO_ERROR_MESSAGE =
  'Não foi possível usar a localização neste momento.';

export const CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE =
  'A localização foi removida porque a Propriedade do registro foi alterada. Capture uma nova posição se desejar.';

export type CadernoForegroundLocationCapture = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
};

export type CadernoLocalizacaoEditIntent = 'preserve' | 'replace' | 'remove';

export type CadernoLocalizacaoEditState = {
  existingLocation: CadernoLocalizacaoExplicita | null;
  draftLocation: CadernoLocalizacaoExplicita | null;
  intent: CadernoLocalizacaoEditIntent;
  capturedForPropertyId: string | null;
};

export type CadernoLocalizacaoPresentation = {
  latitudeText: string;
  longitudeText: string;
  accuracyText: string;
  accuracyValueText: string;
  capturedAtText: string;
  lowAccuracy: boolean;
  badgeLabel: 'Com ponto geográfico';
  originText: 'Localização registrada por ação explícita';
};

export type CadernoLocalizacaoCaptureStatus =
  | 'permission_denied'
  | 'services_disabled'
  | 'unavailable'
  | 'error';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const formatCoordinate = (value: number): string =>
  value
    .toFixed(6)
    .replace(/\.?0+$/, '')
    .replace('.', ',');

const formatAccuracy = (value: number): string => String(value).replace('.', ',');

const formatCapturedAt = (value: string): string =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const buildCadernoLocalizacaoDraft = (
  capture: unknown,
  capturedBy?: unknown
): CadernoLocalizacaoExplicita | null => {
  const source = asRecord(capture);
  if (!source) return null;

  const candidate: Record<string, unknown> = {
    localizacao_latitude: source.latitude,
    localizacao_longitude: source.longitude,
    localizacao_accuracy: source.accuracy,
    localizacao_captured_at: source.capturedAt,
    localizacao_origem: CADERNO_LOCALIZACAO_ORIGEM_EXPLICITA,
  };

  const normalizedCapturedBy = normalizeOptionalString(capturedBy);
  if (normalizedCapturedBy) {
    candidate.localizacao_captured_by = normalizedCapturedBy;
  }

  return normalizeCadernoLocalizacao(candidate);
};

export const appendCadernoLocalizacaoDraft = <T extends Record<string, any>>(
  payload: T,
  draft?: unknown
): T & CadernoLocalizacaoFields => {
  const payloadWithoutLocation = clearCadernoLocalizacaoFields(payload);
  const normalizedDraft = normalizeCadernoLocalizacao(draft);

  if (!normalizedDraft) {
    return payloadWithoutLocation as T & CadernoLocalizacaoFields;
  }

  return {
    ...payloadWithoutLocation,
    ...buildCadernoLocalizacaoFields(normalizedDraft),
  };
};

export const getInitialCadernoLocalizacaoEditState = (
  record: unknown
): CadernoLocalizacaoEditState => {
  const result = extractCadernoLocalizacao(record);
  const existingLocation = result.valid && result.status === 'valid'
    ? { ...result.value }
    : null;

  return {
    existingLocation,
    draftLocation: null,
    intent: 'preserve',
    capturedForPropertyId: null,
  };
};

export const setCadernoLocalizacaoEditReplacement = (
  state: CadernoLocalizacaoEditState,
  draft: unknown,
  capturedForPropertyId?: unknown
): CadernoLocalizacaoEditState => {
  const normalizedDraft = normalizeCadernoLocalizacao(draft);
  if (!normalizedDraft) return { ...state };

  return {
    ...state,
    draftLocation: normalizedDraft,
    intent: 'replace',
    capturedForPropertyId: normalizeOptionalString(capturedForPropertyId),
  };
};

export const setCadernoLocalizacaoEditRemoval = (
  state: CadernoLocalizacaoEditState
): CadernoLocalizacaoEditState => {
  if (state.intent === 'replace' && !state.existingLocation) {
    return {
      ...state,
      draftLocation: null,
      intent: 'preserve',
      capturedForPropertyId: null,
    };
  }

  return {
    ...state,
    draftLocation: null,
    intent: 'remove',
    capturedForPropertyId: null,
  };
};

export const undoCadernoLocalizacaoEditRemoval = (
  state: CadernoLocalizacaoEditState
): CadernoLocalizacaoEditState => ({
  ...state,
  draftLocation: null,
  intent: 'preserve',
  capturedForPropertyId: null,
});

export const buildCadernoLocalizacaoEditPatch = (
  intent: CadernoLocalizacaoEditIntent,
  draft?: unknown
): CadernoLocalizacaoFields | Record<CadernoLocalizacaoKey, undefined> => {
  if (intent === 'preserve') return {};
  if (intent === 'remove') return buildCadernoLocalizacaoRemovalPatch();

  const normalizedDraft = normalizeCadernoLocalizacao(draft);
  return normalizedDraft ? buildCadernoLocalizacaoFields(normalizedDraft) : {};
};

export const shouldDiscardCadernoLocalizacaoDraftForPropertyChange = (
  capturedForPropertyId: unknown,
  selectedPropertyId: unknown
): boolean => {
  const capturedId = normalizeOptionalString(capturedForPropertyId);
  if (!capturedId) return false;
  return capturedId !== normalizeOptionalString(selectedPropertyId);
};

export const isCadernoLocalizacaoLowAccuracy = (record: unknown): boolean => {
  const location = normalizeCadernoLocalizacao(record);
  return typeof location?.localizacao_accuracy === 'number'
    && location.localizacao_accuracy > 50;
};

export const getCadernoLocalizacaoPresentation = (
  record: unknown
): CadernoLocalizacaoPresentation | null => {
  const location = normalizeCadernoLocalizacao(record);
  if (!location) return null;

  const accuracy = location.localizacao_accuracy;
  const accuracyInformed = typeof accuracy === 'number';

  return {
    latitudeText: formatCoordinate(location.localizacao_latitude),
    longitudeText: formatCoordinate(location.localizacao_longitude),
    accuracyText: accuracyInformed
      ? `Precisão informada: ${formatAccuracy(accuracy)} m`
      : 'Precisão não informada',
    accuracyValueText: accuracyInformed ? `${formatAccuracy(accuracy)} m` : 'Não informado',
    capturedAtText: formatCapturedAt(location.localizacao_captured_at),
    lowAccuracy: isCadernoLocalizacaoLowAccuracy(location),
    badgeLabel: 'Com ponto geográfico',
    originText: 'Localização registrada por ação explícita',
  };
};

export const getCadernoLocalizacaoCaptureErrorMessage = (
  status: CadernoLocalizacaoCaptureStatus | string
): string => {
  if (status === 'permission_denied') return CADERNO_LOCALIZACAO_PERMISSION_DENIED_MESSAGE;
  if (status === 'services_disabled') return CADERNO_LOCALIZACAO_SERVICES_DISABLED_MESSAGE;
  if (status === 'unavailable') return CADERNO_LOCALIZACAO_UNAVAILABLE_MESSAGE;
  return CADERNO_LOCALIZACAO_ERROR_MESSAGE;
};

export const shouldAcceptCadernoLocalizacaoCaptureResponse = (
  mounted: boolean,
  activeRequestId: number,
  responseRequestId: number
): boolean => mounted
  && Number.isFinite(activeRequestId)
  && Number.isFinite(responseRequestId)
  && activeRequestId === responseRequestId;
