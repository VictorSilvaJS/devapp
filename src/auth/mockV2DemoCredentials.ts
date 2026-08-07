import generatedCredentials from './generated/mockV2DemoCredentials.json';
import { MOCK_V2_DEMO_DATASET_ID } from '../api/mockV2DemoSeed';
import { MOCK_V2_DEMO_QA_CREDENTIALS } from '../api/mockV2DemoQaCoverage';

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
const baseCredentials = generatedCredentials as unknown as MockV2DemoCredentialSeed;

export const MOCK_V2_DEMO_CREDENTIALS: MockV2DemoCredentialSeed = {
  ...baseCredentials,
  credentials: [
    ...baseCredentials.credentials,
    ...MOCK_V2_DEMO_QA_CREDENTIALS,
  ],
};
