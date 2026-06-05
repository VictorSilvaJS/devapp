import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_CREDENTIAL_STORAGE_KEY = '@tche:local-credentials:v1';
export const LOCAL_CREDENTIAL_VERSION = 1;

export interface LocalCredential {
  usuario_id: string;
  email_normalizado: string;
  senha_hash: string;
  salt: string;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

export interface LocalCredentialMetadata {
  usuario_id: string;
  email_normalizado: string;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

interface LocalCredentialSnapshot {
  version: number;
  savedAt: string;
  credentials: LocalCredential[];
}

export interface LocalCredentialStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface LocalCredentialHasher {
  generateSalt: () => Promise<string>;
  hashPassword: (params: { senha: string; salt: string }) => Promise<string>;
}

export interface LocalCredentialVerification {
  ok: boolean;
  usuario_id?: string;
}

interface LocalCredentialServiceDeps {
  storage?: LocalCredentialStorageAdapter;
  hasher?: LocalCredentialHasher;
  now?: () => string;
}

const asyncStorageAdapter: LocalCredentialStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const normalizeEmail = (email: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const normalizeUsuarioId = (usuarioId: unknown): string =>
  typeof usuarioId === 'string' ? usuarioId.trim() : '';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const loadExpoCrypto = async (): Promise<typeof import('expo-crypto')> => {
  const cryptoModule = require('expo-crypto');
  return cryptoModule;
};

export const createExpoLocalCredentialHasher = (): LocalCredentialHasher => ({
  async generateSalt() {
    const Crypto = await loadExpoCrypto();
    const bytes = await Crypto.getRandomBytesAsync(16);
    return toHex(bytes);
  },

  async hashPassword({ senha, salt }) {
    const Crypto = await loadExpoCrypto();
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `local-credential:v${LOCAL_CREDENTIAL_VERSION}:${salt}:${senha}`
    );
  },
});

const isCredentialRecord = (value: any): value is LocalCredential =>
  typeof value?.usuario_id === 'string'
  && typeof value?.email_normalizado === 'string'
  && typeof value?.senha_hash === 'string'
  && typeof value?.salt === 'string'
  && typeof value?.versao === 'number'
  && typeof value?.criado_em === 'string'
  && typeof value?.atualizado_em === 'string';

const isSnapshot = (value: any): value is LocalCredentialSnapshot =>
  value?.version === LOCAL_CREDENTIAL_VERSION
  && typeof value?.savedAt === 'string'
  && Array.isArray(value?.credentials)
  && value.credentials.every(isCredentialRecord);

const toMetadata = (credential: LocalCredential): LocalCredentialMetadata => ({
  usuario_id: credential.usuario_id,
  email_normalizado: credential.email_normalizado,
  versao: credential.versao,
  criado_em: credential.criado_em,
  atualizado_em: credential.atualizado_em,
});

export const createLocalCredentialService = ({
  storage = asyncStorageAdapter,
  hasher = createExpoLocalCredentialHasher(),
  now = () => new Date().toISOString(),
}: LocalCredentialServiceDeps = {}) => {
  let mutationQueue = Promise.resolve();

  const emptySnapshot = (): LocalCredentialSnapshot => ({
    version: LOCAL_CREDENTIAL_VERSION,
    savedAt: '',
    credentials: [],
  });

  const loadSnapshot = async (): Promise<LocalCredentialSnapshot> => {
    const raw = await storage.getItem(LOCAL_CREDENTIAL_STORAGE_KEY);
    if (!raw) return emptySnapshot();

    try {
      const parsed = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : emptySnapshot();
    } catch {
      return emptySnapshot();
    }
  };

  const saveCredentials = async (credentials: LocalCredential[]): Promise<LocalCredentialSnapshot> => {
    const snapshot: LocalCredentialSnapshot = {
      version: LOCAL_CREDENTIAL_VERSION,
      savedAt: now(),
      credentials,
    };
    await storage.setItem(LOCAL_CREDENTIAL_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  const mutate = async <T>(fn: () => Promise<T>): Promise<T> => {
    const nextMutation = mutationQueue.then(fn, fn);
    mutationQueue = nextMutation.then(() => undefined, () => undefined);
    return nextMutation;
  };

  const findCredentialRecordByUserId = async (usuarioId: string): Promise<LocalCredential | null> => {
    const snapshot = await loadSnapshot();
    return snapshot.credentials.find((credential) => credential.usuario_id === usuarioId) || null;
  };

  const findCredentialRecordByEmail = async (email: string): Promise<LocalCredential | null> => {
    const emailNormalizado = normalizeEmail(email);
    if (!emailNormalizado) return null;

    const snapshot = await loadSnapshot();
    return snapshot.credentials.find((credential) => credential.email_normalizado === emailNormalizado) || null;
  };

  return {
    async listCredentialMetadata(): Promise<LocalCredentialMetadata[]> {
      const snapshot = await loadSnapshot();
      return snapshot.credentials.map(toMetadata);
    },

    async findCredentialByUserId(usuarioId: string): Promise<LocalCredentialMetadata | null> {
      const id = normalizeUsuarioId(usuarioId);
      if (!id) return null;

      const found = await findCredentialRecordByUserId(id);
      return found ? toMetadata(found) : null;
    },

    async findCredentialByEmail(email: string): Promise<LocalCredentialMetadata | null> {
      const found = await findCredentialRecordByEmail(email);
      return found ? toMetadata(found) : null;
    },

    async hasCredential(usuarioId: string): Promise<boolean> {
      const id = normalizeUsuarioId(usuarioId);
      if (!id) return false;

      return Boolean(await findCredentialRecordByUserId(id));
    },

    async createCredential(usuarioId: string, email: string, senha: string): Promise<LocalCredentialMetadata> {
      return mutate(async () => {
        const id = normalizeUsuarioId(usuarioId);
        const emailNormalizado = normalizeEmail(email);
        if (!id) throw new Error('LocalCredential.usuario_id: obrigatório');
        if (!emailNormalizado) throw new Error('LocalCredential.email: obrigatório');
        if (!senha) throw new Error('LocalCredential.senha: obrigatória');

        const snapshot = await loadSnapshot();
        if (snapshot.credentials.some((credential) => credential.usuario_id === id)) {
          throw new Error('LocalCredential.usuario_id: credencial já existe');
        }
        if (snapshot.credentials.some((credential) => credential.email_normalizado === emailNormalizado)) {
          throw new Error('LocalCredential.email: e-mail já possui credencial');
        }

        const salt = await hasher.generateSalt();
        const senhaHash = await hasher.hashPassword({ senha, salt });
        const timestamp = now();
        const credential: LocalCredential = {
          usuario_id: id,
          email_normalizado: emailNormalizado,
          senha_hash: senhaHash,
          salt,
          versao: LOCAL_CREDENTIAL_VERSION,
          criado_em: timestamp,
          atualizado_em: timestamp,
        };

        await saveCredentials([credential, ...snapshot.credentials]);
        return toMetadata(credential);
      });
    },

    async updateCredential(usuarioId: string, email: string, novaSenha: string): Promise<LocalCredentialMetadata> {
      return mutate(async () => {
        const id = normalizeUsuarioId(usuarioId);
        const emailNormalizado = normalizeEmail(email);
        if (!id) throw new Error('LocalCredential.usuario_id: obrigatório');
        if (!emailNormalizado) throw new Error('LocalCredential.email: obrigatório');
        if (!novaSenha) throw new Error('LocalCredential.senha: obrigatória');

        const snapshot = await loadSnapshot();
        const index = snapshot.credentials.findIndex((credential) => credential.usuario_id === id);
        if (index === -1) {
          throw new Error('LocalCredential: credencial não encontrada');
        }

        const duplicatedEmail = snapshot.credentials.some((credential) =>
          credential.usuario_id !== id && credential.email_normalizado === emailNormalizado
        );
        if (duplicatedEmail) {
          throw new Error('LocalCredential.email: e-mail já possui credencial');
        }

        const existing = snapshot.credentials[index];
        const salt = await hasher.generateSalt();
        const senhaHash = await hasher.hashPassword({ senha: novaSenha, salt });
        const updated: LocalCredential = {
          ...existing,
          email_normalizado: emailNormalizado,
          senha_hash: senhaHash,
          salt,
          atualizado_em: now(),
        };
        const credentials = [...snapshot.credentials];
        credentials[index] = updated;

        await saveCredentials(credentials);
        return toMetadata(updated);
      });
    },

    async updateCredentialEmail(usuarioId: string, email: string): Promise<LocalCredentialMetadata> {
      return mutate(async () => {
        const id = normalizeUsuarioId(usuarioId);
        const emailNormalizado = normalizeEmail(email);
        if (!id) throw new Error('LocalCredential.usuario_id: obrigatório');
        if (!emailNormalizado) throw new Error('LocalCredential.email: obrigatório');

        const snapshot = await loadSnapshot();
        const index = snapshot.credentials.findIndex((credential) => credential.usuario_id === id);
        if (index === -1) {
          throw new Error('LocalCredential: credencial não encontrada');
        }

        const duplicatedEmail = snapshot.credentials.some((credential) =>
          credential.usuario_id !== id && credential.email_normalizado === emailNormalizado
        );
        if (duplicatedEmail) {
          throw new Error('LocalCredential.email: e-mail já possui credencial');
        }

        const existing = snapshot.credentials[index];
        const updated: LocalCredential = {
          ...existing,
          email_normalizado: emailNormalizado,
          atualizado_em: now(),
        };
        const credentials = [...snapshot.credentials];
        credentials[index] = updated;

        await saveCredentials(credentials);
        return toMetadata(updated);
      });
    },

    async removeCredential(usuarioId: string): Promise<boolean> {
      return mutate(async () => {
        const id = normalizeUsuarioId(usuarioId);
        if (!id) return false;

        const snapshot = await loadSnapshot();
        const nextCredentials = snapshot.credentials.filter((credential) => credential.usuario_id !== id);
        if (nextCredentials.length === snapshot.credentials.length) return false;

        await saveCredentials(nextCredentials);
        return true;
      });
    },

    async verifyCredential(email: string, senha: string): Promise<LocalCredentialVerification> {
      const found = await findCredentialRecordByEmail(email);
      if (!found || !senha) return { ok: false };

      const senhaHash = await hasher.hashPassword({ senha, salt: found.salt });
      return senhaHash === found.senha_hash
        ? { ok: true, usuario_id: found.usuario_id }
        : { ok: false };
    },

    __setStorageForTests(nextStorage: LocalCredentialStorageAdapter) {
      storage = nextStorage;
      mutationQueue = Promise.resolve();
    },
  };
};

export const LocalCredentialService = createLocalCredentialService();
