import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_STORAGE_KEY } from '../auth/authSession';
import {
  LOCAL_CREDENTIAL_STORAGE_KEY,
  createLocalCredentialService,
  type LocalCredentialHasher,
  type LocalCredentialStorageAdapter,
} from '../auth/localCredentials';
import { MOCK_V2_DEMO_CREDENTIALS } from '../auth/mockV2DemoCredentials';
import { GEOJSON_IMPORT_STORAGE_KEY } from '../services/GeoJsonImportService';
import { MATERIAL_TECNICO_IMPORT_STORAGE_KEY } from '../types/materialTecnicoLocal';
import {
  PERIODO_PRODUTIVO_STORAGE_KEY,
  PERIODO_PRODUTIVO_VERSION,
  type PeriodoProdutivoMetadata,
} from '../types/periodoProdutivo';
import { PNG_MAP_IMPORT_STORAGE_KEY } from '../types/anexoPngLocal';
import { PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY } from '../types/anexoPrescricaoZipLocal';
import {
  MOCK_V2_DEMO_QA_PERIODOS,
  mergeMockV2DemoQaCoverage,
} from './mockV2DemoQaCoverage';
import { MOCK_V2_DEMO_DATASET_ID, MOCK_V2_DEMO_SEED } from './mockV2DemoSeed';
import {
  MOCK_V1_LEGACY_STORAGE_KEYS,
  MOCK_V2_LOCAL_STORAGE_KEY,
  createMockV2LocalPersistence,
  type MockV2StorageAdapter,
} from './mockV2LocalPersistence';
import { validateMockV2State } from './mockV2Validation';

export const MOCK_V2_DEMO_BOOTSTRAP_KEY = '@tche:mock-v2-demo-bootstrap:v1';
export const MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY = '@tche:mock-v2-demo-bootstrap:staging';

export const MOCK_V1_AUXILIARY_STORAGE_KEYS = [
  AUTH_STORAGE_KEY,
  GEOJSON_IMPORT_STORAGE_KEY,
  PNG_MAP_IMPORT_STORAGE_KEY,
  PRESCRIPTION_ZIP_IMPORT_STORAGE_KEY,
  MATERIAL_TECNICO_IMPORT_STORAGE_KEY,
  PERIODO_PRODUTIVO_STORAGE_KEY,
] as const;

export const MOCK_V1_CACHE_STORAGE_PREFIXES = [
  '@mapas_metadata_',
  '@mapas_talhao_',
  '@mapas_tiles_',
] as const;

export const MOCK_V1_FILE_DIRECTORIES = [
  'tche-geojson-imports',
  'tche-png-imports',
  'tche-prescription-zips',
  'tche-materiais-tecnicos',
  'mapas_cache',
] as const;

export interface MockV2DemoBootstrapStorageAdapter
  extends MockV2StorageAdapter, LocalCredentialStorageAdapter {
  getAllKeys?: () => Promise<readonly string[]>;
}

export interface MockV2DemoBootstrapFileSystemAdapter {
  documentDirectory?: string | null;
  getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
}

export interface MockV2DemoBootstrapDeps {
  storage?: MockV2DemoBootstrapStorageAdapter;
  fileSystem?: MockV2DemoBootstrapFileSystemAdapter;
  credentialHasher?: LocalCredentialHasher;
  now?: () => string;
}

export interface MockV2DemoBootstrapResult {
  status: 'installed' | 'already_installed' | 'preserved_existing_v2';
  dataset_id?: string;
  cleanup_complete: boolean;
  warnings: string[];
}

interface BootstrapMarker {
  version: 1 | 2;
  dataset_id: string;
  installed_at: string;
  cleanup_complete: boolean;
  storage_cleanup_complete: boolean;
  file_cleanup_complete: boolean;
}

const defaultStorage = AsyncStorage as MockV2DemoBootstrapStorageAdapter;

const getDefaultFileSystem = (): MockV2DemoBootstrapFileSystemAdapter =>
  require('expo-file-system/legacy') as MockV2DemoBootstrapFileSystemAdapter;

const parseJson = (raw: string | null): any => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const restoreStorageValue = async (
  storage: MockV2DemoBootstrapStorageAdapter,
  key: string,
  previous: string | null
) => {
  if (previous === null) await storage.removeItem(key);
  else await storage.setItem(key, previous);
};

const hasDemoCredentialCoverage = (raw: string | null): boolean => {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed?.credentials)) return false;

  const validUserIds = new Set(
    parsed.credentials
      .filter((record: any) => (
        typeof record?.usuario_id === 'string'
        && typeof record?.email_normalizado === 'string'
        && typeof record?.senha_hash === 'string'
        && typeof record?.salt === 'string'
      ))
      .map((record: any) => record.usuario_id)
  );
  return MOCK_V2_DEMO_CREDENTIALS.credentials.every(
    (record) => validUserIds.has(record.usuario_id)
  );
};

const ensureDemoCredentialCoverage = async (
  credentialService: ReturnType<typeof createLocalCredentialService>
): Promise<void> => {
  const current = await credentialService.listCredentialMetadata();
  const existingUserIds = new Set(current.map((record) => record.usuario_id));
  for (const credential of MOCK_V2_DEMO_CREDENTIALS.credentials) {
    if (!existingUserIds.has(credential.usuario_id)) {
      await credentialService.createCredential(
        credential.usuario_id,
        credential.email,
        credential.senha
      );
      existingUserIds.add(credential.usuario_id);
    }
  }
};

const mergeDemoQaPeriodos = (raw: string | null, savedAt: string): string => {
  const parsed = parseJson(raw);
  const currentItems: PeriodoProdutivoMetadata[] = (
    parsed?.version === PERIODO_PRODUTIVO_VERSION
    && typeof parsed?.savedAt === 'string'
    && Array.isArray(parsed?.items)
  ) ? parsed.items : [];
  const existingIds = new Set(currentItems.map((record) => record?.id));
  const items = [
    ...currentItems,
    ...MOCK_V2_DEMO_QA_PERIODOS.filter((record) => !existingIds.has(record.id)),
  ];
  return JSON.stringify({
    version: PERIODO_PRODUTIVO_VERSION,
    savedAt,
    items,
  });
};

const validateDemoPackage = () => {
  validateMockV2State(MOCK_V2_DEMO_SEED);
  if (MOCK_V2_DEMO_CREDENTIALS.dataset_id !== MOCK_V2_DEMO_DATASET_ID) {
    throw new Error('MockV2.bootstrap: credenciais pertencem a outro dataset.');
  }

  const users = new Map(MOCK_V2_DEMO_SEED.usuarios.map((user) => [user.id, user.email.toLowerCase()]));
  if (users.size !== MOCK_V2_DEMO_CREDENTIALS.credentials.length) {
    throw new Error('MockV2.bootstrap: quantidade de credenciais incompatível.');
  }
  for (const credential of MOCK_V2_DEMO_CREDENTIALS.credentials) {
    if (users.get(credential.usuario_id) !== credential.email.trim().toLowerCase()) {
      throw new Error(`MockV2.bootstrap: credencial incompatível para ${credential.usuario_id}.`);
    }
  }
};

const cleanupLegacyStorage = async (
  storage: MockV2DemoBootstrapStorageAdapter,
  warnings: string[]
): Promise<boolean> => {
  let complete = true;
  const keys = new Set<string>([
    ...MOCK_V1_LEGACY_STORAGE_KEYS,
    ...MOCK_V1_AUXILIARY_STORAGE_KEYS,
  ]);

  if (storage.getAllKeys) {
    try {
      const allKeys = await storage.getAllKeys();
      allKeys.forEach((key) => {
        if (MOCK_V1_CACHE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          keys.add(key);
        }
      });
    } catch {
      complete = false;
      warnings.push('Não foi possível inventariar todas as chaves do cache v1.');
    }
  }

  for (const key of keys) {
    try {
      await storage.removeItem(key);
    } catch {
      complete = false;
      warnings.push(`Não foi possível remover a chave legada ${key}.`);
    }
  }
  return complete;
};

const cleanupLegacyFiles = async (
  fileSystem: MockV2DemoBootstrapFileSystemAdapter,
  warnings: string[]
): Promise<boolean> => {
  const documentDirectory = String(fileSystem.documentDirectory || '').trim();
  if (!documentDirectory) {
    warnings.push('Diretório local indisponível para limpar arquivos v1.');
    return false;
  }

  const base = documentDirectory.endsWith('/') ? documentDirectory : `${documentDirectory}/`;
  let complete = true;
  for (const directory of MOCK_V1_FILE_DIRECTORIES) {
    const target = `${base}${directory}/`;
    if (!target.startsWith(base) || target === base) {
      complete = false;
      warnings.push(`Diretório legado inseguro recusado: ${directory}.`);
      continue;
    }

    try {
      const info = await fileSystem.getInfoAsync(target);
      if (info.exists) await fileSystem.deleteAsync(target, { idempotent: true });
    } catch {
      complete = false;
      warnings.push(`Não foi possível remover o diretório legado ${directory}.`);
    }
  }
  return complete;
};

const saveMarker = async (
  storage: MockV2DemoBootstrapStorageAdapter,
  now: () => string,
  storageCleanupComplete: boolean,
  fileCleanupComplete: boolean
): Promise<void> => {
  const marker: BootstrapMarker = {
    version: 2,
    dataset_id: MOCK_V2_DEMO_DATASET_ID,
    installed_at: now(),
    cleanup_complete: storageCleanupComplete && fileCleanupComplete,
    storage_cleanup_complete: storageCleanupComplete,
    file_cleanup_complete: fileCleanupComplete,
  };
  await storage.setItem(MOCK_V2_DEMO_BOOTSTRAP_KEY, JSON.stringify(marker));
};

export const runMockV2DemoBootstrap = async (
  deps: MockV2DemoBootstrapDeps = {}
): Promise<MockV2DemoBootstrapResult> => {
  const storage = deps.storage ?? defaultStorage;
  const fileSystem = deps.fileSystem ?? getDefaultFileSystem();
  const now = deps.now ?? (() => new Date().toISOString());
  const persistence = createMockV2LocalPersistence(storage);
  const credentialService = createLocalCredentialService({
    storage,
    ...(deps.credentialHasher ? { hasher: deps.credentialHasher } : {}),
    now,
  });
  const warnings: string[] = [];

  validateDemoPackage();

  const rawV2 = await storage.getItem(MOCK_V2_LOCAL_STORAGE_KEY);
  const existingV2 = await persistence.load();
  if (rawV2 && !existingV2) {
    throw new Error('MockV2.bootstrap: snapshot v2 existente é inválido; substituição automática bloqueada.');
  }

  if (existingV2 && existingV2.dataset?.id !== MOCK_V2_DEMO_DATASET_ID) {
    return {
      status: 'preserved_existing_v2',
      dataset_id: existingV2.dataset?.id,
      cleanup_complete: false,
      warnings,
    };
  }

  const marker = parseJson(await storage.getItem(MOCK_V2_DEMO_BOOTSTRAP_KEY)) as BootstrapMarker | null;
  const markerComplete = marker?.version === 2
    && marker.dataset_id === MOCK_V2_DEMO_DATASET_ID
    && marker.cleanup_complete === true;
  const rawCredentials = await storage.getItem(LOCAL_CREDENTIAL_STORAGE_KEY);

  if (existingV2 && markerComplete && hasDemoCredentialCoverage(rawCredentials)) {
    return {
      status: 'already_installed',
      dataset_id: MOCK_V2_DEMO_DATASET_ID,
      cleanup_complete: true,
      warnings,
    };
  }

  const previousV2 = rawV2;
  const previousCredentials = rawCredentials;
  const previousMarker = await storage.getItem(MOCK_V2_DEMO_BOOTSTRAP_KEY);
  const previousPeriodos = await storage.getItem(PERIODO_PRODUTIVO_STORAGE_KEY);
  await storage.setItem(MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY, JSON.stringify({
    dataset_id: MOCK_V2_DEMO_DATASET_ID,
    started_at: now(),
  }));

  try {
    await ensureDemoCredentialCoverage(credentialService);
    await persistence.save(
      existingV2 ? mergeMockV2DemoQaCoverage(existingV2) : MOCK_V2_DEMO_SEED
    );
  } catch (error) {
    await restoreStorageValue(storage, LOCAL_CREDENTIAL_STORAGE_KEY, previousCredentials);
    await restoreStorageValue(storage, MOCK_V2_LOCAL_STORAGE_KEY, previousV2);
    await restoreStorageValue(storage, MOCK_V2_DEMO_BOOTSTRAP_KEY, previousMarker);
    await storage.removeItem(MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY).catch(() => undefined);
    throw error;
  }

  const markerBelongsToDataset = [1, 2].includes(marker?.version as number)
    && marker?.dataset_id === MOCK_V2_DEMO_DATASET_ID;
  const storageWasAlreadyClean = markerBelongsToDataset
    && (marker.storage_cleanup_complete === true || marker.cleanup_complete === true);
  const filesWereAlreadyClean = markerBelongsToDataset
    && (marker.file_cleanup_complete === true || marker.cleanup_complete === true);
  const storageCleanupComplete = storageWasAlreadyClean
    || await cleanupLegacyStorage(storage, warnings);
  const fileCleanupComplete = filesWereAlreadyClean
    || await cleanupLegacyFiles(fileSystem, warnings);
  try {
    const currentPeriodos = await storage.getItem(PERIODO_PRODUTIVO_STORAGE_KEY);
    await storage.setItem(
      PERIODO_PRODUTIVO_STORAGE_KEY,
      mergeDemoQaPeriodos(currentPeriodos, now())
    );
    await saveMarker(storage, now, storageCleanupComplete, fileCleanupComplete);
  } catch (error) {
    await restoreStorageValue(storage, PERIODO_PRODUTIVO_STORAGE_KEY, previousPeriodos);
    await restoreStorageValue(storage, MOCK_V2_DEMO_BOOTSTRAP_KEY, previousMarker);
    throw error;
  }
  await storage.removeItem(MOCK_V2_DEMO_BOOTSTRAP_STAGING_KEY).catch(() => undefined);

  return {
    status: existingV2 ? 'already_installed' : 'installed',
    dataset_id: MOCK_V2_DEMO_DATASET_ID,
    cleanup_complete: storageCleanupComplete && fileCleanupComplete,
    warnings,
  };
};

let defaultBootstrapPromise: Promise<MockV2DemoBootstrapResult> | null = null;

export const ensureMockV2DemoBootstrap = (): Promise<MockV2DemoBootstrapResult> => {
  if (!defaultBootstrapPromise) {
    defaultBootstrapPromise = runMockV2DemoBootstrap().catch((error) => {
      defaultBootstrapPromise = null;
      throw error;
    });
  }
  return defaultBootstrapPromise;
};
