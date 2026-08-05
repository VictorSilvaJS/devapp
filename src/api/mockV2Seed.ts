import {
  ORGANIZACAO_TCHE_ID,
  type MockV2State,
} from '../domain/contractsV2';

/**
 * Seed estrutural, sem pessoas ou dados operacionais inventados.
 * O conjunto demonstrativo aprovado deve ser carregado separadamente.
 */
export const MOCK_V2_EMPTY_SEED: MockV2State = {
  organizacao: {
    id: ORGANIZACAO_TCHE_ID,
    nome: 'Tchê Fertilidade',
    status: 'ativa',
  },
  usuarios: [],
  produtores: [],
  propriedades: [],
  usuarios_propriedades: [],
  talhoes: [],
  visitas: [],
  cadernos: [],
  materiais: [],
};

