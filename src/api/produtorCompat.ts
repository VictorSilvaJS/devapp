import {
  deriveProdutorFromFazenda,
  normalizeCadernoCampo,
  normalizeFazenda,
  normalizeLimiteArea,
  normalizeMapa,
  normalizeVisita,
  toFazendaCompativelBorda,
} from '../domain';
import type { FazendaCanonica, FazendaCompativelBorda, FazendaLegada } from '../domain';

interface FazendaBoundaryInput {
  id?: string;
  propriedade_id?: string;
  propriedadeId?: string;
  fazenda_id?: string;
  fazendaId?: string;
  produtor_id?: string;
  proprietario_id?: string;
  titular_id?: string;
  titularId?: string;
  nome?: string;
  fazenda?: string;
  fazenda_nome?: string;
  fazendaNome?: string;
  propriedade_nome?: string;
  propriedadeNome?: string;
  produtor_nome?: string;
  proprietario_nome?: string;
  titular_nome?: string;
  titularNome?: string;
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
  observacoes?: string;
  documento?: string;
  colaborador_responsavel_id?: string;
  colaborador_responsavel?: string;
  status?: string;
  data_cadastro?: string;
}

interface FazendaUpdateFormInput {
  fazenda_nome?: string;
  fazenda?: string;
  area_total?: number | string;
  cultura_atual?: string;
  cidade?: string;
  estado?: string;
  documento?: string;
  colaborador_responsavel_id?: string;
  colaborador_responsavel?: string;
  status?: string;
}

interface FazendaDeleteDependenciesInput {
  mapas?: any[];
  visitas?: any[];
  cadernos?: any[];
  limites?: any[];
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

const normalizeStringField = (value: unknown, fallback?: string) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value === undefined ? fallback : String(value);
};

const normalizeAreaField = (value: unknown, fallback?: number) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return fallback;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const countByFazendaId = (items: any[] = [], fazendaId: string, getItemFazendaId: (item: any) => string) => {
  if (!fazendaId || !items) return 0;
  return items.filter((item) => getItemFazendaId(item) === fazendaId).length;
};

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const joinDependencyLabels = (labels: string[]) => {
  if (labels.length <= 1) return labels.join('');
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
};

const buildFazendaFutureAliases = (
  record: FazendaBoundaryInput,
  canonical: FazendaCanonica
) => {
  const hasLegacyFarmField = hasOwn(record, 'fazenda');
  const propriedadeId = firstNonEmptyString(
    record.propriedade_id,
    record.propriedadeId,
    record.fazenda_id,
    record.fazendaId,
    canonical.id,
    record.id
  );
  const propriedadeNome = firstNonEmptyString(
    record.propriedade_nome,
    record.propriedadeNome,
    record.fazenda_nome,
    record.fazendaNome,
    record.fazenda,
    canonical.nome,
    record.nome
  );
  const titularId = firstNonEmptyString(
    record.titular_id,
    record.titularId,
    record.proprietario_id,
    canonical.produtor_id,
    record.produtor_id
  );
  const titularNome = firstNonEmptyString(
    record.titular_nome,
    record.titularNome,
    record.produtor_nome,
    record.proprietario_nome,
    canonical.produtor_nome,
    hasLegacyFarmField ? record.nome : undefined
  );

  return {
    ...(propriedadeId
      ? {
          propriedade_id: propriedadeId,
          propriedadeId,
        }
      : {}),
    ...(propriedadeNome
      ? {
          propriedade_nome: propriedadeNome,
          propriedadeNome,
        }
      : {}),
    ...(titularId
      ? {
          titular_id: titularId,
          titularId,
        }
      : {}),
    ...(titularNome
      ? {
          titular_nome: titularNome,
        }
      : {}),
  };
};

const buildCanonicalFazendaFromBoundary = (
  data: FazendaBoundaryInput = {},
  existing?: FazendaBoundaryInput
) => {
  const current = existing ? (readMockProdutor(existing) as FazendaBoundaryInput) : null;
  const hasLegacyFarmField = hasOwn(data, 'fazenda');
  const hasCanonicalFarmName = hasOwn(data, 'fazenda_nome') || (hasOwn(data, 'nome') && !hasLegacyFarmField);

  const fazendaId =
    firstNonEmptyString(
      data.propriedade_id,
      data.propriedadeId,
      data.fazenda_id,
      data.fazendaId,
      data.id,
      current?.propriedade_id,
      current?.propriedadeId,
      current?.fazenda_id,
      current?.fazendaId,
      current?.id
    ) ?? '';

  const produtorId =
    firstNonEmptyString(
      data.titular_id,
      data.titularId,
      data.produtor_id,
      data.proprietario_id,
      current?.titular_id,
      current?.titularId,
      current?.produtor_id,
      current?.proprietario_id
    ) ?? '';

  const fazendaNome =
    firstNonEmptyString(
      data.propriedade_nome,
      data.propriedadeNome,
      data.fazenda_nome,
      data.fazendaNome,
      data.fazenda,
      hasCanonicalFarmName ? data.nome : undefined,
      current?.propriedade_nome,
      current?.propriedadeNome,
      current?.fazenda_nome,
      current?.fazendaNome,
      current?.fazenda
    ) ?? '';

  const produtorNome = firstNonEmptyString(
    data.titular_nome,
    data.titularNome,
    data.produtor_nome,
    data.proprietario_nome,
    hasLegacyFarmField ? data.nome : undefined,
    current?.titular_nome,
    current?.titularNome,
    current?.produtor_nome,
    current?.proprietario_nome,
    current?.nome
  );

  const canonical = normalizeFazenda({
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
    observacoes: data.observacoes !== undefined ? data.observacoes : current?.observacoes,
    documento: data.documento !== undefined ? data.documento : current?.documento,
    colaborador_responsavel_id:
      data.colaborador_responsavel_id !== undefined
        ? data.colaborador_responsavel_id
        : current?.colaborador_responsavel_id,
    colaborador_responsavel:
      data.colaborador_responsavel !== undefined
        ? data.colaborador_responsavel
        : current?.colaborador_responsavel,
    status: data.status !== undefined ? data.status : current?.status ?? 'ativo',
    data_cadastro: data.data_cadastro !== undefined ? data.data_cadastro : current?.data_cadastro,
  });

  return normalizeFazenda({
    ...canonical,
    ...buildFazendaFutureAliases(
      {
        ...(current || {}),
        ...(data || {}),
      },
      canonical
    ),
  });
};

export const normalizeMockFazendaInput = (data: FazendaBoundaryInput, existing?: FazendaBoundaryInput) =>
  buildCanonicalFazendaFromBoundary(data, existing);

export const readMockFazenda = (record: FazendaBoundaryInput) => {
  const canonical = normalizeFazenda(record as FazendaLegada | FazendaCanonica | FazendaCompativelBorda);
  const legacy = toFazendaCompativelBorda(canonical);
  const futureAliases = buildFazendaFutureAliases(record, canonical);

  return {
    ...legacy,
    ...futureAliases,
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

export const buildFazendaUpdatePayload = (
  fazendaAtual: FazendaBoundaryInput,
  form: FazendaUpdateFormInput = {}
) => {
  const current = readMockFazenda(fazendaAtual);
  const fazendaNome =
    firstNonEmptyString(form.fazenda_nome, form.fazenda, current.fazenda_nome, current.fazenda) ?? '';
  const produtorId = firstNonEmptyString(current.produtor_id, current.proprietario_id) ?? '';
  const produtorNome = firstNonEmptyString(current.produtor_nome, current.nome) ?? '';

  return {
    fazenda_id: firstNonEmptyString(current.fazenda_id, current.id),
    produtor_id: produtorId,
    proprietario_id: produtorId,
    produtor_nome: produtorNome,
    fazenda_nome: fazendaNome,
    fazenda: fazendaNome,
    area_total: normalizeAreaField(form.area_total, current.area_total),
    cultura_atual: normalizeStringField(form.cultura_atual, current.cultura_atual),
    cidade: normalizeStringField(form.cidade, current.cidade),
    estado: normalizeStringField(form.estado, current.estado)?.toUpperCase(),
    documento: normalizeStringField(form.documento, current.documento),
    colaborador_responsavel_id: normalizeStringField(
      form.colaborador_responsavel_id,
      current.colaborador_responsavel_id
    ),
    colaborador_responsavel: normalizeStringField(
      form.colaborador_responsavel,
      current.colaborador_responsavel
    ),
    status: normalizeStringField(form.status, current.status) || 'ativo',
    regiao: current.regiao,
    microregiao: current.microregiao,
  };
};

export const buildFazendaDeleteIntegrity = (
  fazendaAtual: FazendaBoundaryInput,
  dependencies: FazendaDeleteDependenciesInput = {}
) => {
  const current = readMockFazenda(fazendaAtual);
  const fazendaId = firstNonEmptyString(current.fazenda_id, current.id) ?? '';
  const fazendaNome = firstNonEmptyString(current.fazenda_nome, current.fazenda) ?? 'esta propriedade';

  const counts = {
    mapas: countByFazendaId(dependencies.mapas, fazendaId, (item) => normalizeMapa(item).fazenda_id),
    visitas: countByFazendaId(dependencies.visitas, fazendaId, (item) => normalizeVisita(item).fazenda_id),
    cadernos: countByFazendaId(dependencies.cadernos, fazendaId, (item) => normalizeCadernoCampo(item).fazenda_id),
    limites: countByFazendaId(dependencies.limites, fazendaId, (item) => normalizeLimiteArea(item).fazenda_id),
  };

  const dependencyLabels = [
    counts.mapas > 0 ? pluralize(counts.mapas, 'mapa', 'mapas') : '',
    counts.visitas > 0 ? pluralize(counts.visitas, 'visita', 'visitas') : '',
    counts.cadernos > 0 ? pluralize(counts.cadernos, 'registro de caderno', 'registros de caderno') : '',
    counts.limites > 0 ? pluralize(counts.limites, 'limite de área', 'limites de área') : '',
  ].filter(Boolean);

  const hasDependencies = dependencyLabels.length > 0;
  const canDelete = Boolean(fazendaId) && !hasDependencies;
  const blockingMessage = !fazendaId
    ? 'Não foi possível identificar a propriedade para validar a exclusão.'
    : hasDependencies
      ? `Não é possível excluir ${fazendaNome} porque há ${joinDependencyLabels(dependencyLabels)} vinculados. Remova ou reassocie esses registros antes de excluir.`
      : '';

  return {
    fazendaId,
    fazendaNome,
    canDelete,
    hasDependencies,
    counts,
    dependencyLabels,
    blockingMessage,
    confirmationMessage: `Tem certeza que deseja excluir ${fazendaNome}? Esta ação remove apenas a propriedade e não altera o titular vinculado.`,
  };
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
