import {
  getFazendaId,
  getNomeFazenda,
  getNomeTitularFazenda,
  getVisitaFazendaId,
} from './acessoControle';

export type VisitaFazendaOption = {
  id: string;
  fazendaNome: string;
  produtorNome: string;
  cidade?: string;
  estado?: string;
};

type BuildVisitaPayloadInput = {
  fazendaId: string;
  dataVisita: Date | null;
  horaVisita: Date | null;
  objetivo: string;
  observacoes?: string;
  recomendacoes?: string;
  clima?: string;
  proximaVisita?: Date | null;
  status?: string;
  fotos?: any[];
  tecnicoResponsavel?: string;
};

export const buildVisitaFazendaOptions = (fazendas: any[] = []): VisitaFazendaOption[] =>
  (fazendas || []).map((fazenda) => ({
    id: getFazendaId(fazenda),
    fazendaNome: getNomeFazenda(fazenda),
    produtorNome: getNomeTitularFazenda(fazenda),
    cidade: fazenda?.cidade,
    estado: fazenda?.estado,
  }));

export const findVisitaFazendaOption = (
  options: VisitaFazendaOption[] = [],
  fazendaId?: string | null
): VisitaFazendaOption | null => options.find((option) => option.id === fazendaId) ?? null;

export const getVisitaFormFazendaId = (visita: any): string => getVisitaFazendaId(visita);

export const getVisitaFormFazendaLabel = (
  option?: VisitaFazendaOption | null,
  emptyLabel = 'Selecione um produtor'
): string => {
  if (!option) {
    return emptyLabel;
  }

  return `${option.produtorNome} - ${option.fazendaNome}`;
};

export const combineVisitaDateTime = (
  dataVisita: Date | null,
  horaVisita: Date | null
): Date | null => {
  if (!(dataVisita instanceof Date) || Number.isNaN(dataVisita.getTime())) {
    return null;
  }

  if (!(horaVisita instanceof Date) || Number.isNaN(horaVisita.getTime())) {
    return null;
  }

  const dataCompleta = new Date(dataVisita);
  dataCompleta.setHours(horaVisita.getHours());
  dataCompleta.setMinutes(horaVisita.getMinutes());
  dataCompleta.setSeconds(0);
  dataCompleta.setMilliseconds(0);
  return dataCompleta;
};

export const buildVisitaPayload = ({
  fazendaId,
  dataVisita,
  horaVisita,
  objetivo,
  observacoes = '',
  recomendacoes = '',
  clima = '',
  proximaVisita = null,
  status = 'agendada',
  fotos = [],
  tecnicoResponsavel,
}: BuildVisitaPayloadInput) => {
  const dataCompleta = combineVisitaDateTime(dataVisita, horaVisita);

  if (!dataCompleta) {
    return null;
  }

  const payload: Record<string, any> = {
    fazenda_id: fazendaId,
    data_visita: dataCompleta.toISOString(),
    objetivo,
    observacoes,
    recomendacoes,
    clima,
    proximaVisita: proximaVisita instanceof Date ? proximaVisita.toISOString().split('T')[0] : undefined,
    status,
    fotos,
  };

  if (typeof tecnicoResponsavel === 'string' && tecnicoResponsavel.trim().length > 0) {
    payload.tecnico_responsavel = tecnicoResponsavel.trim();
  }

  return payload;
};
