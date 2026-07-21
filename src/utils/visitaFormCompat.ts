import {
  getVisitaFazendaId,
} from './acessoControle';
import { getFazendaUiInfo } from './fazendaUiCompat';
import { getPropriedadeId } from './propriedadeCompat';

export type VisitaFazendaOption = {
  id: string;
  fazendaNome: string;
  titularNome: string;
  cidade?: string;
  estado?: string;
};

export const VISITA_STATUS_AGENDADA = 'agendada';
export const VISITA_STATUS_REALIZADA = 'realizada';
export const VISITA_STATUS_CANCELADA = 'cancelada';

export const VISITA_FOTOS_MVP_INFO = {
  title: 'Fotos no MVP local',
  message:
    'A captura e a seleção de fotos ainda não estão disponíveis neste MVP. As imagens existentes em alguns registros são apenas exemplos demonstrativos.',
} as const;

export const VISITA_FLUXOS_OPERACIONAIS = [
  {
    value: VISITA_STATUS_AGENDADA,
    label: 'Agendar visita',
    description: 'Planejar acompanhamento futuro',
  },
  {
    value: VISITA_STATUS_REALIZADA,
    label: 'Registrar realizada',
    description: 'Registrar visita já feita',
  },
];

export const isVisitaStatusRealizada = (status?: string | null) => status === VISITA_STATUS_REALIZADA;

export const getVisitaFluxoUi = (status?: string | null) => {
  if (isVisitaStatusRealizada(status)) {
    return {
      status: VISITA_STATUS_REALIZADA,
      dataLabel: 'Data da Visita Realizada',
      dataPlaceholder: 'Selecione quando a visita ocorreu',
      climaLabel: 'Condições Climáticas Observadas',
      observacoesPlaceholder: 'Descreva o que foi observado na visita...',
      submitLabel: 'Registrar Visita',
      successMessage: 'Visita registrada como realizada!',
      errorMessage: 'Erro ao registrar visita',
      infoText: 'A visita será salva como realizada no histórico da propriedade selecionada.',
    };
  }

  if (status === VISITA_STATUS_CANCELADA) {
    return {
      status: VISITA_STATUS_CANCELADA,
      dataLabel: 'Data da Visita',
      dataPlaceholder: 'Selecione a data da visita',
      climaLabel: 'Condições Climáticas',
      observacoesPlaceholder: 'Descreva detalhes da visita...',
      submitLabel: 'Salvar Alterações',
      successMessage: 'Visita atualizada com sucesso!',
      errorMessage: 'Erro ao atualizar visita',
      infoText: 'A visita será mantida como cancelada no histórico da propriedade selecionada.',
    };
  }

  return {
    status: VISITA_STATUS_AGENDADA,
    dataLabel: 'Data da Visita Agendada',
    dataPlaceholder: 'Selecione quando a visita deve ocorrer',
    climaLabel: 'Condições Climáticas Esperadas',
    observacoesPlaceholder: 'Descreva detalhes do agendamento...',
    submitLabel: 'Agendar Visita',
    successMessage: 'Visita agendada com sucesso!',
    errorMessage: 'Erro ao agendar visita',
    infoText: 'A visita será salva como agendada para acompanhamento técnico da propriedade selecionada.',
  };
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
  (fazendas || []).map((fazenda) => {
    const fazendaInfo = getFazendaUiInfo(fazenda);

    return {
      id: fazendaInfo.id,
      fazendaNome: fazendaInfo.fazendaNome,
      titularNome: fazendaInfo.titularNome,
      cidade: fazenda?.cidade,
      estado: fazenda?.estado,
    };
  });

export const findVisitaFazendaOption = (
  options: VisitaFazendaOption[] = [],
  fazendaId?: string | null
): VisitaFazendaOption | null => options.find((option) => option.id === fazendaId) ?? null;

export const getVisitaFormFazendaId = (visita: any): string =>
  getVisitaFazendaId(visita) || getPropriedadeId(visita) || '';

export const resolveVisitaEdicaoFazendaId = (visita: any, fallbackFazendaId = ''): string =>
  getVisitaFormFazendaId(visita) || fallbackFazendaId;

export const getVisitaFotoUri = (foto: unknown): string | null => {
  if (typeof foto === 'string') {
    const uri = foto.trim();
    return uri.length > 0 ? uri : null;
  }

  if (foto && typeof foto === 'object' && 'uri' in foto) {
    const uri = (foto as { uri?: unknown }).uri;
    if (typeof uri === 'string' && uri.trim().length > 0) {
      return uri.trim();
    }
  }

  return null;
};

export const removeVisitaFotoAtIndex = (
  fotos: readonly unknown[] | null | undefined,
  index: number
): unknown[] => {
  const items = Array.isArray(fotos) ? fotos : [];

  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    return [...items];
  }

  return items.filter((_, itemIndex) => itemIndex !== index);
};

export const getVisitaFormFazendaLabel = (
  option?: VisitaFazendaOption | null,
  emptyLabel = 'Selecione uma propriedade'
): string => {
  if (!option) {
    return emptyLabel;
  }

  return [option.fazendaNome, option.titularNome].filter(Boolean).join(' - ');
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
