import {
  filtrarCadernosPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorFazendaIds,
  getFazendaIds,
} from './acessoControle';
import { getTitularId } from './propriedadeCompat';
import { formatAreaHa } from './talhaoMedidasCompat';

export const formatDashboardArea = (area: number) => {
  const normalizedArea = Number.isFinite(area) ? area : 0;
  return formatAreaHa(normalizedArea);
};

export const getPropriedadeStatusKey = (propriedade: any) => {
  if (['ativo', 'pendente', 'inativo'].includes(propriedade?.status)) {
    return propriedade.status;
  }
  return propriedade?.ativo === false ? 'inativo' : 'ativo';
};

export const getPropriedadeStatusLabel = (propriedade: any) => {
  const labels = {
    ativo: 'Ativa',
    pendente: 'Pendente',
    inativo: 'Inativa',
  };
  return labels[getPropriedadeStatusKey(propriedade)];
};

export const getPropriedadesPorStatus = (propriedades: any[] = []) =>
  propriedades.reduce(
    (acc, propriedade) => {
      acc[getPropriedadeStatusKey(propriedade)] += 1;
      return acc;
    },
    { ativo: 0, pendente: 0, inativo: 0 }
  );

export const contarTitularesUnicos = (propriedades: any[] = []) =>
  new Set(propriedades.map((propriedade) => getTitularId(propriedade)).filter(Boolean)).size;

export const buildDashboardScopeData = ({
  user,
  propriedades = [],
  visitas = [],
  cadernos = [],
  mapas = [],
}: {
  user: any;
  propriedades?: any[];
  visitas?: any[];
  cadernos?: any[];
  mapas?: any[];
}) => {
  const propriedadesNoEscopo = filtrarProdutoresPorAcesso(propriedades, user);
  const propriedadeIds = getFazendaIds(propriedadesNoEscopo);
  const isProdutor = user?.perfil === 'produtor';

  return {
    propriedades: propriedadesNoEscopo,
    visitas: filtrarVisitasPorFazendaIds(visitas, propriedadeIds),
    cadernos: filtrarCadernosPorFazendaIds(cadernos, propriedadeIds, {
      somenteVisivelParaProdutor: isProdutor,
    }),
    mapas: filtrarMapasPorFazendaIds(mapas, propriedadeIds, {
      somenteDisponiveisDownload: isProdutor,
    }),
  };
};

export const buildDashboardSummary = ({
  propriedades = [],
  usuarios = [],
  visitas = [],
  cadernos = [],
  mapas = [],
}: {
  propriedades?: any[];
  usuarios?: any[];
  visitas?: any[];
  cadernos?: any[];
  mapas?: any[];
}) => {
  const areaTotal = propriedades.reduce(
    (sum, propriedade) => sum + (Number(propriedade?.area_total) || 0),
    0
  );

  return {
    propriedades: propriedades.length,
    produtores: usuarios.filter((usuario) => usuario?.perfil === 'produtor').length,
    colaboradores: usuarios.filter((usuario) => usuario?.perfil === 'colaborador').length,
    titularesNoEscopo: contarTitularesUnicos(propriedades),
    visitas: visitas.length,
    cadernos: cadernos.length,
    mapas: mapas.length,
    areaTotal,
    areaTotalLabel: formatDashboardArea(areaTotal),
    status: getPropriedadesPorStatus(propriedades),
  };
};

export const sortDashboardItemsByDate = (items: any[] = [], fields: string[] = []) =>
  [...items].sort((a, b) => {
    const resolveDate = (item: any) => {
      const value = fields.map((field) => item?.[field]).find(Boolean);
      const timestamp = value ? new Date(value).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    return resolveDate(b) - resolveDate(a);
  });
