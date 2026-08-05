import generatedCredentials from './generated/mockV2DemoCredentials.json';
import { MOCK_V2_DEMO_DATASET_ID } from '../api/mockV2DemoSeed';

export interface MockV2DemoCredentialSeedRecord {
  usuario_id: string;
  email: string;
  senha: string;
}

export interface MockV2DemoCredentialSeed {
  dataset_id: typeof MOCK_V2_DEMO_DATASET_ID;
  tipo: 'credenciais_demonstrativas';
  credentials: MockV2DemoCredentialSeedRecord[];
}

/** Senhas exclusivamente demonstrativas; nunca fazem parte de UsuarioV2. */
export const MOCK_V2_DEMO_CREDENTIALS =
  generatedCredentials as unknown as MockV2DemoCredentialSeed;

