import generatedSeed from './generated/mockV2DemoSeed.json';
import type { MockV2State } from '../domain/contractsV2';

export const MOCK_V2_DEMO_DATASET_ID = 'demo_clientes_26_1_mt_2026_08' as const;

/**
 * Dataset demonstrativo aprovado, separado do seed estrutural vazio.
 * A instalacao no AsyncStorage ocorre somente pela rotina explicita de bootstrap.
 */
export const MOCK_V2_DEMO_SEED = generatedSeed as unknown as MockV2State;

