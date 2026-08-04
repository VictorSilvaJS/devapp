export type VisitaListSectionId = 'proximas' | 'pendentes' | 'historico';

export type VisitaStatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

export type VisitaStatusPresentation = {
  status: string | null;
  label: string;
  tone: VisitaStatusTone;
  sectionId: VisitaListSectionId;
  isOverdue: boolean;
};

export type VisitaListSection<T = any> = {
  id: VisitaListSectionId;
  title: string;
  description: string;
  items: T[];
};

const STATUS_PRESENTATION = {
  realizada: { label: 'Realizada', tone: 'success' as const },
  cancelada: { label: 'Cancelada', tone: 'danger' as const },
  anulada: { label: 'Anulada', tone: 'muted' as const },
};

const getTimestamp = (value: unknown): number | null => {
  if (!value) return null;
  const timestamp = new Date(value as any).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getReferenceTimestamp = (referenceDate: Date): number => {
  const timestamp = referenceDate instanceof Date ? referenceDate.getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
};

const getVisitaListTimestamp = (visita: any): number | null => {
  const status = typeof visita?.status === 'string'
    ? visita.status.trim().toLocaleLowerCase('pt-BR')
    : '';
  if (status === 'realizada' || status === 'anulada') {
    return getTimestamp(visita?.concluida_em)
      ?? getTimestamp(visita?.inicio_real_em)
      ?? getTimestamp(visita?.data_visita);
  }
  if (status === 'cancelada') {
    return getTimestamp(visita?.cancelada_em) ?? getTimestamp(visita?.data_visita);
  }
  return getTimestamp(visita?.data_visita);
};

export const isVisitaAtrasada = (
  visita: any,
  referenceDate: Date = new Date()
): boolean => {
  const status = typeof visita?.status === 'string'
    ? visita.status.trim().toLocaleLowerCase('pt-BR')
    : '';
  if (status !== 'agendada') return false;
  const visitaTimestamp = getTimestamp(visita?.data_visita);
  return visitaTimestamp != null && visitaTimestamp < getReferenceTimestamp(referenceDate);
};

export const getVisitaStatusPresentation = (
  visita: any,
  referenceDate: Date = new Date()
): VisitaStatusPresentation => {
  const status = typeof visita?.status === 'string' && visita.status.trim()
    ? visita.status.trim().toLocaleLowerCase('pt-BR')
    : null;

  if (status === 'agendada') {
    const visitaTimestamp = getTimestamp(visita?.data_visita);
    const isOverdue = isVisitaAtrasada(visita, referenceDate);

    return {
      status,
      label: isOverdue ? 'Agendada · Atrasada' : 'Agendada',
      tone: isOverdue ? 'warning' : 'info',
      sectionId: isOverdue || visitaTimestamp == null ? 'pendentes' : 'proximas',
      isOverdue,
    };
  }

  const knownPresentation = status ? STATUS_PRESENTATION[status] : null;
  if (knownPresentation) {
    return {
      status,
      label: knownPresentation.label,
      tone: knownPresentation.tone,
      sectionId: 'historico',
      isOverdue: false,
    };
  }

  return {
    status,
    label: status ? 'Status não reconhecido' : 'Status não informado',
    tone: 'muted',
    sectionId: 'historico',
    isOverdue: false,
  };
};

const compareByDate = (direction: 'asc' | 'desc') => (a: any, b: any): number => {
  const timestampA = getVisitaListTimestamp(a);
  const timestampB = getVisitaListTimestamp(b);

  if (timestampA == null && timestampB == null) {
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  }
  if (timestampA == null) return 1;
  if (timestampB == null) return -1;

  const difference = direction === 'asc'
    ? timestampA - timestampB
    : timestampB - timestampA;

  return difference || String(a?.id || '').localeCompare(String(b?.id || ''));
};

export const groupVisitasForList = <T = any>(
  visitas: T[] = [],
  referenceDate: Date = new Date()
): VisitaListSection<T>[] => {
  const groups: Record<VisitaListSectionId, T[]> = {
    proximas: [],
    pendentes: [],
    historico: [],
  };

  (visitas || []).forEach((visita) => {
    const presentation = getVisitaStatusPresentation(visita, referenceDate);
    groups[presentation.sectionId].push(visita);
  });

  groups.proximas.sort(compareByDate('asc'));
  groups.pendentes.sort(compareByDate('desc'));
  groups.historico.sort(compareByDate('desc'));

  const sections: VisitaListSection<T>[] = [
    {
      id: 'proximas',
      title: 'Próximas',
      description: 'Agendadas por data mais próxima',
      items: groups.proximas,
    },
    {
      id: 'pendentes',
      title: 'Pendentes',
      description: 'Agendadas com data vencida',
      items: groups.pendentes,
    },
    {
      id: 'historico',
      title: 'Histórico',
      description: 'Realizadas, canceladas ou anuladas',
      items: groups.historico,
    },
  ];

  return sections.filter((section) => section.items.length > 0);
};
