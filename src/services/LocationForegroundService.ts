import * as Location from 'expo-location';

export interface ForegroundUserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

export type ForegroundLocationResult =
  | {
      status: 'ok';
      location: ForegroundUserLocation;
    }
  | {
      status: 'permission_denied' | 'services_disabled' | 'unavailable' | 'error';
      message: string;
    };

type ExpoLocationModule = Pick<
  typeof Location,
  | 'getForegroundPermissionsAsync'
  | 'requestForegroundPermissionsAsync'
  | 'hasServicesEnabledAsync'
  | 'getCurrentPositionAsync'
> & {
  Accuracy?: typeof Location.Accuracy;
};

const POSITION_REQUEST_TIMEOUT_MS = 25 * 1000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidLatitude = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= -180 && value <= 180;

const normalizeAccuracy = (value: unknown): number | null =>
  isFiniteNumber(value) && value >= 0 ? value : null;

const normalizeTimestamp = (value: unknown, now: () => string): string => {
  if (isFiniteNumber(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return now();
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Foreground location request timed out')),
      timeoutMs
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const normalizeLocationObject = (
  locationObject: Location.LocationObject,
  now: () => string
): ForegroundUserLocation | null => {
  const latitude = locationObject?.coords?.latitude;
  const longitude = locationObject?.coords?.longitude;

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: normalizeAccuracy(locationObject?.coords?.accuracy),
    capturedAt: normalizeTimestamp(locationObject?.timestamp, now),
  };
};

const getHighAccuracyCurrentPosition = async (
  locationModule: ExpoLocationModule
): Promise<Location.LocationObject> => locationModule.getCurrentPositionAsync({
  accuracy: locationModule.Accuracy?.Highest
    ?? locationModule.Accuracy?.High
    ?? locationModule.Accuracy?.Balanced,
});

export interface RequestForegroundLocationOptions {
  locationModule?: ExpoLocationModule;
  now?: () => string;
  positionTimeoutMs?: number;
}

export const requestCurrentForegroundLocation = async (
  options: RequestForegroundLocationOptions = {}
): Promise<ForegroundLocationResult> => {
  const locationModule = options.locationModule ?? Location;
  const now = options.now ?? (() => new Date().toISOString());
  const positionTimeoutMs = Number.isFinite(options.positionTimeoutMs)
    && Number(options.positionTimeoutMs) >= 0
    ? Number(options.positionTimeoutMs)
    : POSITION_REQUEST_TIMEOUT_MS;

  try {
    const currentPermission = await locationModule.getForegroundPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await locationModule.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return {
        status: 'permission_denied',
        message: 'Permissão de localização negada. Ative a permissão do app para mostrar sua posição no mapa.',
      };
    }

    const servicesEnabled = await locationModule.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        status: 'services_disabled',
        message: 'Ative a localização do aparelho para usar este recurso.',
      };
    }

    let locationObject: Location.LocationObject;
    try {
      locationObject = await withTimeout(
        getHighAccuracyCurrentPosition(locationModule),
        positionTimeoutMs
      );
    } catch {
      return {
        status: 'unavailable',
        message: 'Não foi possível obter uma posição atual com boa precisão. Tente novamente em uma área aberta.',
      };
    }

    const normalized = normalizeLocationObject(locationObject, now);

    if (!normalized) {
      return {
        status: 'unavailable',
        message: 'Não foi possível obter uma posição válida do aparelho.',
      };
    }

    return {
      status: 'ok',
      location: normalized,
    };
  } catch {
    return {
      status: 'error',
      message: 'Não foi possível obter a posição atual do aparelho.',
    };
  }
};
