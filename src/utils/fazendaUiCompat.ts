import {
  getFazendaId,
  getNomeFazenda,
  getNomeTitularFazenda,
  getTitularIdFazenda,
} from './acessoControle';
import {
  getPropriedadeId,
  getPropriedadeNome,
  getTitularId,
  getTitularNome,
} from './propriedadeCompat';

const toSearchableText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const joinDefined = (values: unknown[], separator: string): string =>
  values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => String(value).trim())
    .join(separator);

const hasOwn = (value: unknown, key: string): boolean =>
  typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);

const hasAnyOwn = (value: unknown, keys: string[]): boolean =>
  keys.some((key) => hasOwn(value, key));

const resolveFazendaUiId = (fazenda: any): string =>
  getFazendaId(fazenda) || getPropriedadeId(fazenda) || '';

const resolveFazendaUiNome = (fazenda: any): string => {
  const hasExplicitPropertyName = hasAnyOwn(fazenda, [
    'propriedade_nome',
    'propriedadeNome',
    'fazenda_nome',
    'fazendaNome',
  ]);

  const compatNome = getPropriedadeNome(fazenda);
  const legadoNome = getNomeFazenda(fazenda);

  return hasExplicitPropertyName
    ? compatNome || legadoNome || ''
    : legadoNome || compatNome || '';
};

const resolveTitularUiId = (fazenda: any): string =>
  getTitularId(fazenda) || getTitularIdFazenda(fazenda) || '';

const resolveTitularUiNome = (fazenda: any): string =>
  getTitularNome(fazenda) || getNomeTitularFazenda(fazenda) || '';

export type FazendaUiInfo = {
  id: string;
  fazendaNome: string;
  titularNome: string;
  localizacao: string;
  buscaTexto: string;
};

export type FazendaListMetrics = {
  totalFazendas: number;
  totalTitulares: number;
  fazendasAtivas: number;
  fazendasPendentes: number;
  areaTotal: number;
};

export type FazendaDetailContext = FazendaUiInfo & {
  titularId: string;
  outrasFazendasTitular: FazendaUiInfo[];
};

export type FazendaConsultaOption = FazendaUiInfo & {
  label: string;
  subtitle: string;
};

export const getFazendaUiInfo = (fazenda: any): FazendaUiInfo => {
  const fazendaNome = resolveFazendaUiNome(fazenda);
  const titularNome = resolveTitularUiNome(fazenda);
  const localizacao = joinDefined([fazenda?.cidade, fazenda?.estado], '/');
  const buscaTexto = joinDefined(
    [fazendaNome, titularNome, fazenda?.cidade, fazenda?.estado, fazenda?.regiao, fazenda?.microregiao],
    ' '
  ).toLowerCase();

  return {
    id: resolveFazendaUiId(fazenda),
    fazendaNome,
    titularNome,
    localizacao,
    buscaTexto,
  };
};

export const buildFazendaUiInfoMap = (fazendas: any[] = []): Map<string, FazendaUiInfo> => {
  const entries = fazendas
    .map(getFazendaUiInfo)
    .filter((info) => info.id)
    .map((info) => [info.id, info] as [string, FazendaUiInfo]);

  return new Map(entries);
};

export const buildFazendaConsultaOptions = (
  fazendas: any[] = []
): FazendaConsultaOption[] =>
  fazendas
    .map((fazenda) => {
      const info = getFazendaUiInfo(fazenda);
      return {
        ...info,
        label: info.fazendaNome || 'Propriedade sem nome',
        subtitle: joinDefined([info.titularNome, info.localizacao], ' • '),
      };
    })
    .filter((info) => info.id)
    .sort((a, b) => a.label.localeCompare(b.label));

export const matchesFazendaUiBusca = (
  fazenda: any,
  busca?: string | null,
  extras: unknown[] = []
): boolean => {
  const termoBusca = toSearchableText(busca);
  if (!termoBusca) {
    return true;
  }

  const info = getFazendaUiInfo(fazenda);
  const extrasTexto = extras.map(toSearchableText).filter(Boolean).join(' ');
  const contextoBusca = joinDefined([info.buscaTexto, extrasTexto], ' ').toLowerCase();

  return contextoBusca.includes(termoBusca);
};

export const buildFazendaListMetrics = (fazendas: any[] = []): FazendaListMetrics => {
  const titulares = new Set<string>();

  const totals = fazendas.reduce(
    (acc, fazenda) => {
      const titularKey = resolveTitularUiId(fazenda) || resolveTitularUiNome(fazenda);
      if (titularKey) {
        titulares.add(titularKey);
      }

      if (fazenda?.status === 'ativo') {
        acc.fazendasAtivas += 1;
      }

      if (fazenda?.status === 'pendente') {
        acc.fazendasPendentes += 1;
      }

      const area = Number(fazenda?.area_total || 0);
      acc.areaTotal += Number.isFinite(area) ? area : 0;

      return acc;
    },
    {
      fazendasAtivas: 0,
      fazendasPendentes: 0,
      areaTotal: 0,
    }
  );

  return {
    totalFazendas: fazendas.length,
    totalTitulares: titulares.size,
    fazendasAtivas: totals.fazendasAtivas,
    fazendasPendentes: totals.fazendasPendentes,
    areaTotal: totals.areaTotal,
  };
};

export const buildFazendaDetailContext = (
  fazendaAtual: any,
  fazendasDisponiveis: any[] = []
): FazendaDetailContext => {
  const info = getFazendaUiInfo(fazendaAtual);
  const titularId = resolveTitularUiId(fazendaAtual);

  const outrasFazendasTitular = titularId
    ? fazendasDisponiveis
        .filter((fazenda) => {
          const mesmoTitular = resolveTitularUiId(fazenda) === titularId;
          const mesmaFazenda = resolveFazendaUiId(fazenda) === info.id;
          return mesmoTitular && !mesmaFazenda;
        })
        .map(getFazendaUiInfo)
    : [];

  return {
    ...info,
    titularId,
    outrasFazendasTitular,
  };
};
