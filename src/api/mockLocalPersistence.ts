import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOCK_LOCAL_STORAGE_KEY = '@tche:mock-mvp:v1';
export const MOCK_LOCAL_STORAGE_VERSION = 1;

export interface MockLocalState {
  users: any[];
  produtores: any[];
  usuarioPropriedade: any[];
  usuarioMicroregiao: any[];
  visitas: any[];
  cadernos: any[];
  mapas: any[];
}

export interface MockLocalSnapshot extends MockLocalState {
  version: number;
  savedAt: string;
}

export interface MockLocalStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const nodeFallbackValues = new Map<string, string>();

const nodeFallbackStorage: MockLocalStorageAdapter = {
  getItem: async (key) => nodeFallbackValues.get(key) ?? null,
  setItem: async (key, value) => {
    nodeFallbackValues.set(key, value);
  },
  removeItem: async (key) => {
    nodeFallbackValues.delete(key);
  },
};

const asyncStorageAdapter: MockLocalStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const defaultStorage =
  typeof (globalThis as any).window === 'undefined'
    ? nodeFallbackStorage
    : asyncStorageAdapter;

const isRecordArray = (value: unknown): value is any[] => Array.isArray(value);

const isValidSnapshot = (value: any): value is MockLocalSnapshot =>
  value?.version === MOCK_LOCAL_STORAGE_VERSION
  && typeof value?.savedAt === 'string'
  && isRecordArray(value?.users)
  && isRecordArray(value?.produtores)
  && isRecordArray(value?.usuarioPropriedade)
  && isRecordArray(value?.usuarioMicroregiao)
  && isRecordArray(value?.visitas)
  && isRecordArray(value?.cadernos)
  && isRecordArray(value?.mapas);

export const createMockLocalPersistence = (
  initialStorage: MockLocalStorageAdapter = defaultStorage
) => {
  let storage = initialStorage;

  return {
    setStorageAdapter(nextStorage: MockLocalStorageAdapter) {
      storage = nextStorage;
    },

    async load(): Promise<MockLocalSnapshot | null> {
      const raw = await storage.getItem(MOCK_LOCAL_STORAGE_KEY);
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw);
        return isValidSnapshot(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },

    async save(state: MockLocalState): Promise<MockLocalSnapshot> {
      const snapshot: MockLocalSnapshot = {
        version: MOCK_LOCAL_STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        ...state,
      };

      await storage.setItem(MOCK_LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
      return snapshot;
    },

    async clear(): Promise<void> {
      await storage.removeItem(MOCK_LOCAL_STORAGE_KEY);
    },
  };
};
