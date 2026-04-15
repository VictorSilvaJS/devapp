import {
  deriveProdutorFromFazenda,
  normalizeFazenda,
  toFazendaCompativelBorda,
} from '../domain';
import type { FazendaCanonica, FazendaCompativelBorda, FazendaLegada } from '../domain';

interface FazendaBoundaryInput {
  id?: string;
  fazenda_id?: string;
  produtor_id?: string;
  proprietario_id?: string;
  nome?: string;
  fazenda?: string;
  fazenda_nome?: string;
  produtor_nome?: string;
  area_total?: number;
  cultura_atual?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
  microregiao?: string;
  cep?: string;
  ultima_analise?: string;
  status?: string;
  data_cadastro?: string;
}

const hasOwn = (value: unknown, key: string) =>
  typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

const matchesIncludesQuery = (record: Record<string, any>, query?: Record<string, any>) => {
  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null);

  return entries.every(([key, value]) => {
    const recordValue = record[key];
    return String(recordValue ?? '').toLowerCase().includes(String(value).toLowerCase());
  });
};

const buildCanonicalFazendaFromBoundary = (
  data: FazendaBoundaryInput = {},
  existing?: FazendaBoundaryInput
) => {
  const current = existing ? readMockProdutor(existing) : null;
  const hasLegacyFarmField = hasOwn(data, 'fazenda');
  const hasCanonicalFarmName = hasOwn(data, 'fazenda_nome') || (hasOwn(data, 'nome') && !hasLegacyFarmField);

  const fazendaId =
    firstNonEmptyString(data.fazenda_id, data.id, current?.fazenda_id, current?.id) ?? '';

  const produtorId =
    firstNonEmptyString(data.produtor_id, data.proprietario_id, current?.produtor_id, current?.proprietario_id) ?? '';

  const fazendaNome =
    firstNonEmptyString(
      data.fazenda_nome,
      data.fazenda,
      hasCanonicalFarmName ? data.nome : undefined,
      current?.fazenda_nome,
      current?.fazenda
    ) ?? '';

  const produtorNome = firstNonEmptyString(
    data.produtor_nome,
    hasLegacyFarmField ? data.nome : undefined,
    current?.produtor_nome,
    current?.nome
  );

  return normalizeFazenda({
    id: fazendaId,
    produtor_id: produtorId,
    nome: fazendaNome,
    produtor_nome: produtorNome,
    area_total: data.area_total !== undefined ? data.area_total : current?.area_total,
    cultura_atual: data.cultura_atual !== undefined ? data.cultura_atual : current?.cultura_atual,
    telefone: data.telefone !== undefined ? data.telefone : current?.telefone,
    email: data.email !== undefined ? data.email : current?.email,
    endereco: data.endereco !== undefined ? data.endereco : current?.endereco,
    cidade: data.cidade !== undefined ? data.cidade : current?.cidade,
    estado: data.estado !== undefined ? data.estado : current?.estado,
    regiao: data.regiao !== undefined ? data.regiao : current?.regiao,
    microregiao: data.microregiao !== undefined ? data.microregiao : current?.microregiao,
    cep: data.cep !== undefined ? data.cep : current?.cep,
    ultima_analise: data.ultima_analise !== undefined ? data.ultima_analise : current?.ultima_analise,
    status: data.status !== undefined ? data.status : current?.status ?? 'ativo',
    data_cadastro: data.data_cadastro !== undefined ? data.data_cadastro : current?.data_cadastro,
  });
};

export const normalizeMockFazendaInput = (data: FazendaBoundaryInput, existing?: FazendaBoundaryInput) =>
  buildCanonicalFazendaFromBoundary(data, existing);

export const readMockFazenda = (record: FazendaBoundaryInput) => {
  const canonical = normalizeFazenda(record as FazendaLegada | FazendaCanonica | FazendaCompativelBorda);
  const legacy = toFazendaCompativelBorda(canonical);

  return {
    ...legacy,
    fazenda_id: canonical.id,
    fazenda_nome: canonical.nome,
    produtor_nome: canonical.produtor_nome ?? legacy.nome,
  };
};

export const listMockFazendas = (records: any[]) => records.map(readMockFazenda);

export const filterMockFazendas = (records: any[], query?: Record<string, any>) =>
  listMockFazendas(records).filter((record) => matchesIncludesQuery(record, query));

export const persistMockFazenda = ({
  id,
  data,
  existing,
}: {
  id?: any;
  data: FazendaBoundaryInput;
  existing?: FazendaBoundaryInput;
}) => {
  const canonical = buildCanonicalFazendaFromBoundary(
    {
      ...(data || {}),
      id: id ?? data?.id ?? data?.fazenda_id,
      data_cadastro: data?.data_cadastro ?? (existing ? readMockFazenda(existing).data_cadastro : new Date().toISOString()),
      status: data?.status ?? (existing ? readMockFazenda(existing).status : 'ativo'),
    },
    existing
  );

  return readMockFazenda(canonical);
};

export const listMockProdutoresTitulares = (records: any[]) => {
  const grouped = new Map<string, any>();

  for (const fazenda of listMockFazendas(records)) {
    const produtor = deriveProdutorFromFazenda({
      id: fazenda.fazenda_id,
      produtor_id: fazenda.produtor_id,
      nome: fazenda.fazenda_nome,
      produtor_nome: fazenda.produtor_nome,
      email: fazenda.email,
      telefone: fazenda.telefone,
      status: fazenda.status,
      data_cadastro: fazenda.data_cadastro,
    });

    if (!produtor?.id) {
      continue;
    }

    const existing = grouped.get(produtor.id);
    if (!existing) {
      grouped.set(produtor.id, {
        ...produtor,
        fazendas_ids: [fazenda.fazenda_id],
        fazendas_nomes: [fazenda.fazenda_nome],
      });
      continue;
    }

    grouped.set(produtor.id, {
      ...existing,
      fazendas_ids: [...existing.fazendas_ids, fazenda.fazenda_id],
      fazendas_nomes: [...existing.fazendas_nomes, fazenda.fazenda_nome],
    });
  }

  return Array.from(grouped.values());
};

// Aliases com o nome atual da API para facilitar integração incremental.
export const readMockProdutor = readMockFazenda;
export const listMockProdutores = listMockFazendas;
export const filterMockProdutores = filterMockFazendas;
export const persistMockProdutor = persistMockFazenda;
