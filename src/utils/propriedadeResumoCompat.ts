export type PropriedadeResumoActivity = {
  kind: 'caderno' | 'visita';
  date: string;
  item: any;
};

export type PropriedadeResumoAttention = {
  id: 'status' | 'visita' | 'material' | 'talhao';
  message: string;
};

const toTimestamp = (value: unknown): number | null => {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const resolveReferenceTimestamp = (referenceDate: Date | string | number): number => {
  const timestamp = new Date(referenceDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};

export const getProximaVisitaDaPropriedade = (
  visitas: any[] = [],
  referenceDate: Date | string | number = new Date()
) => {
  const referenceTimestamp = resolveReferenceTimestamp(referenceDate);

  return visitas
    .map((visita) => ({ visita, timestamp: toTimestamp(visita?.data_visita) }))
    .filter(({ visita, timestamp }) => (
      visita?.status === 'agendada'
      && timestamp !== null
      && timestamp >= referenceTimestamp
    ))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))[0]?.visita || null;
};

export const getUltimaAtividadeDaPropriedade = ({
  visitas = [],
  cadernos = [],
  referenceDate = new Date(),
}: {
  visitas?: any[];
  cadernos?: any[];
  referenceDate?: Date | string | number;
}): PropriedadeResumoActivity | null => {
  const referenceTimestamp = resolveReferenceTimestamp(referenceDate);

  const atividadesCaderno = cadernos
    .map((item) => ({
      kind: 'caderno' as const,
      date: item?.data_atividade,
      item,
      timestamp: toTimestamp(item?.data_atividade),
    }))
    .filter(({ timestamp }) => timestamp !== null && timestamp <= referenceTimestamp);

  const atividadesVisita = visitas
    .filter((item) => !['agendada', 'cancelada'].includes(item?.status))
    .map((item) => ({
      kind: 'visita' as const,
      date: item?.data_visita,
      item,
      timestamp: toTimestamp(item?.data_visita),
    }))
    .filter(({ timestamp }) => timestamp !== null && timestamp <= referenceTimestamp);

  const atividade = [...atividadesCaderno, ...atividadesVisita]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0];

  if (!atividade) return null;

  return {
    kind: atividade.kind,
    date: atividade.date,
    item: atividade.item,
  };
};

export const getMaterialMaisRecenteDaPropriedade = (mapas: any[] = []) => (
  mapas
    .map((item) => ({
      item,
      timestamp: toTimestamp(
        item?.data_atualizacao
        || item?.updated_at
        || item?.data_criacao
        || item?.data_upload
        || item?.created_at
      ),
    }))
    .filter(({ timestamp }) => timestamp !== null)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0]?.item || null
);

export const buildPontosAtencaoDaPropriedade = ({
  propriedade,
  proximaVisita,
  mapas = [],
  limites = [],
  isProdutor = false,
}: {
  propriedade: any;
  proximaVisita?: any;
  mapas?: any[];
  limites?: any[];
  isProdutor?: boolean;
}): PropriedadeResumoAttention[] => {
  const pontos: PropriedadeResumoAttention[] = [];

  if (propriedade?.status === 'pendente') {
    pontos.push({ id: 'status', message: 'Cadastro da Propriedade com status pendente.' });
  } else if (propriedade?.status === 'inativo') {
    pontos.push({ id: 'status', message: 'Propriedade com status inativo.' });
  }

  if (!proximaVisita) {
    pontos.push({ id: 'visita', message: 'Nenhuma próxima Visita agendada.' });
  }

  if (mapas.length === 0) {
    pontos.push({
      id: 'material',
      message: isProdutor
        ? 'Nenhum material técnico liberado para consulta.'
        : 'Nenhum material técnico cadastrado.',
    });
  }

  if (limites.length === 0) {
    pontos.push({ id: 'talhao', message: 'Nenhum Talhão mapeado.' });
  }

  return pontos;
};

export const buildPropriedadeResumo = ({
  propriedade,
  visitas = [],
  cadernos = [],
  mapas = [],
  limites = [],
  isProdutor = false,
  referenceDate = new Date(),
}: {
  propriedade: any;
  visitas?: any[];
  cadernos?: any[];
  mapas?: any[];
  limites?: any[];
  isProdutor?: boolean;
  referenceDate?: Date | string | number;
}) => {
  const proximaVisita = getProximaVisitaDaPropriedade(visitas, referenceDate);
  const ultimaAtividade = getUltimaAtividadeDaPropriedade({
    visitas,
    cadernos,
    referenceDate,
  });
  const materialMaisRecente = getMaterialMaisRecenteDaPropriedade(mapas);
  const pontosAtencao = buildPontosAtencaoDaPropriedade({
    propriedade,
    proximaVisita,
    mapas,
    limites,
    isProdutor,
  });

  return {
    proximaVisita,
    ultimaAtividade,
    materialMaisRecente,
    pontosAtencao,
  };
};
