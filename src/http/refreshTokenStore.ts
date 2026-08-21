import * as SecureStore from 'expo-secure-store';

export interface RefreshTokenStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

export const HTTP_REFRESH_TOKEN_KEY = 'tche_agro.http.refresh_token.v1';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureStoreRefreshTokenStore implements RefreshTokenStore {
  async read(): Promise<string | null> {
    return SecureStore.getItemAsync(
      HTTP_REFRESH_TOKEN_KEY,
      SECURE_STORE_OPTIONS,
    );
  }

  async write(value: string): Promise<void> {
    await SecureStore.setItemAsync(
      HTTP_REFRESH_TOKEN_KEY,
      value,
      SECURE_STORE_OPTIONS,
    );
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(
      HTTP_REFRESH_TOKEN_KEY,
      SECURE_STORE_OPTIONS,
    );
  }
}
