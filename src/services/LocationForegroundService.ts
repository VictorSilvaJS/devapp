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
> & Partial<Pick<typeof Location, 'getLastKnownPositionAsync'>> & {
  Accuracy?: typeof Location.Accuracy;
};

const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
const LAST_KNOWN_REQUIRED_ACCURACY_METERS = 200;

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

const getCurrentOrRecentLastKnownPosition = async (
  locationModule: ExpoLocationModule
): Promise<Location.LocationObject> => {
  try {
    return await locationModule.getCurrentPositionAsync({
      accuracy: locationModule.Accuracy?.Balanced,
    });
  } catch (error) {
    if (!locationModule.getLastKnownPositionAsync) {
      throw error;
    }

    const recentLastKnown = await locationModule.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_METERS,
    });

    if (!recentLastKnown) {
      throw error;
    }

    return recentLastKnown;
  }
};

export interface RequestForegroundLocationOptions {
  locationModule?: ExpoLocationModule;
  now?: () => string;
}

export const requestCurrentForegroundLocation = async (
  options: RequestForegroundLocationOptions = {}
): Promise<ForegroundLocationResult> => {
  const locationModule = options.locationModule ?? Location;
  const now = options.now ?? (() => new Date().toISOString());

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

    const locationObject = await getCurrentOrRecentLastKnownPosition(locationModule);
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
