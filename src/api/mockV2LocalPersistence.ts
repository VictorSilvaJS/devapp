import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MockV2State } from '../domain/contractsV2';
import { validateMockV2State } from './mockV2Validation';

export const MOCK_V2_LOCAL_STORAGE_KEY = '@tche:mock-mvp:v2';
export const MOCK_V2_LOCAL_STORAGE_VERSION = 2;
export const MOCK_V1_LEGACY_STORAGE_KEYS = ['@tche:mock-mvp:v1'] as const;

export interface MockV2LocalSnapshot extends MockV2State {
  version: typeof MOCK_V2_LOCAL_STORAGE_VERSION;
  saved_at: string;
}

export interface MockV2StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const nodeFallbackValues = new Map<string, string>();

const nodeFallbackStorage: MockV2StorageAdapter = {
  getItem: async (key) => nodeFallbackValues.get(key) ?? null,
  setItem: async (key, value) => {
    nodeFallbackValues.set(key, value);
  },
  removeItem: async (key) => {
    nodeFallbackValues.delete(key);
  },
};

const asyncStorageAdapter: MockV2StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const defaultStorage =
  typeof (globalThis as any).window === 'undefined'
    ? nodeFallbackStorage
    : asyncStorageAdapter;

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

export const isMockV2Snapshot = (value: any): value is MockV2LocalSnapshot =>
  value?.version === MOCK_V2_LOCAL_STORAGE_VERSION
  && typeof value?.saved_at === 'string'
  && value?.organizacao?.id === 'org_tche_fertilidade'
  && isArray(value?.usuarios)
  && isArray(value?.produtores)
  && isArray(value?.propriedades)
  && isArray(value?.usuarios_propriedades)
  && isArray(value?.talhoes)
  && isArray(value?.visitas)
  && isArray(value?.cadernos)
  && isArray(value?.materiais);

export const createMockV2LocalPersistence = (
  initialStorage: MockV2StorageAdapter = defaultStorage
) => {
  let storage = initialStorage;

  return {
    setStorageAdapter(nextStorage: MockV2StorageAdapter) {
      storage = nextStorage;
    },

    async hasSnapshot(): Promise<boolean> {
      return (await storage.getItem(MOCK_V2_LOCAL_STORAGE_KEY)) !== null;
    },

    async load(): Promise<MockV2LocalSnapshot | null> {
      const raw = await storage.getItem(MOCK_V2_LOCAL_STORAGE_KEY);
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw);
        if (!isMockV2Snapshot(parsed)) return null;
        validateMockV2State(parsed);
        return parsed;
      } catch {
        return null;
      }
    },

    async save(state: MockV2State): Promise<MockV2LocalSnapshot> {
      validateMockV2State(state);
      const snapshot: MockV2LocalSnapshot = {
        ...state,
        version: MOCK_V2_LOCAL_STORAGE_VERSION,
        saved_at: new Date().toISOString(),
      };
      await storage.setItem(MOCK_V2_LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
      return snapshot;
    },

    async installSeed(state: MockV2State): Promise<MockV2LocalSnapshot> {
      for (const key of MOCK_V1_LEGACY_STORAGE_KEYS) {
        await storage.removeItem(key);
      }
      return this.save(state);
    },

    async clear(): Promise<void> {
      await storage.removeItem(MOCK_V2_LOCAL_STORAGE_KEY);
    },
  };
};
