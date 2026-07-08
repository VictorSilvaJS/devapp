import {
  getCadernoFazendaId,
} from './acessoControle';
import { getFazendaUiInfo } from './fazendaUiCompat';
import { getPropriedadeId } from './propriedadeCompat';

export type CadernoFazendaOption = {
  id: string;
  fazendaNome: string;
  titularNome: string;
  cidade?: string;
  estado?: string;
};

export type CadernoPeriodoProdutivoOption = {
  id: string;
  label: string;
  tipoPeriodo?: string;
  cultura?: string;
  anoAgricola?: string;
  status?: string;
  fazendaId?: string;
  propriedadeId?: string;
  talhao?: string;
};

export const CADERNO_TIPOS_ATIVIDADE = [
  { value: 'observacao', label: 'Observação' },
  { value: 'plantio', label: 'Plantio' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'colheita', label: 'Colheita' },
  { value: 'ocorrencia', label: 'Ocorrência' },
  { value: 'visita_tecnica', label: 'Visita técnica' },
  { value: 'fertilidade', label: 'Fertilidade' },
  { value: 'correcao_solo', label: 'Correção de solo' },
  { value: 'prescricao', label: 'Prescrição' },
  { value: 'outro', label: 'Outro' },
];

export const CADERNO_TIPO_LABELS: Record<string, string> = {
  observacao: 'Observação',
  plantio: 'Plantio',
  aplicacao: 'Aplicação',
  colheita: 'Colheita',
  ocorrencia: 'Ocorrência',
  visita_tecnica: 'Visita técnica',
  fertilidade: 'Fertilidade',
  correcao_solo: 'Correção de solo',
  prescricao: 'Prescrição',
  outro: 'Outro',
  // Valores legados preservados para registros ja existentes.
  vistoria: 'Vistoria',
  adubacao: 'Adubação',
  analise_solo: 'Análise de solo',
};

export const CADERNO_TIPO_VALUES = Array.from(new Set([
  ...CADERNO_TIPOS_ATIVIDADE.map((tipo) => tipo.value),
  'vistoria',
  'adubacao',
  'aplicacao',
  'analise_solo',
]));

type BuildCadernoPayloadInput = {
  fazendaId: string;
  dataAtividade: Date | null;
  tipoAtividade: string;
  talhao?: string;
  produtosText?: string;
  dosagem?: string;
  areaAplicadaText?: string;
  condicoesClima?: string;
  observacoes?: string;
  visivelParaProdutor?: boolean;
  colaboradorResponsavel?: string;
  criadoPorUserId?: string;
  origemRegistro?: string;
  periodoProdutivo?: CadernoPeriodoProdutivoOption | null;
};

export const buildCadernoFazendaOptions = (fazendas: any[] = []): CadernoFazendaOption[] =>
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

export const findCadernoFazendaOption = (
  options: CadernoFazendaOption[] = [],
  fazendaId?: string | null
): CadernoFazendaOption | null => options.find((option) => option.id === fazendaId) ?? null;

export const buildCadernoPeriodoProdutivoOptions = (
  periodos: any[] = []
): CadernoPeriodoProdutivoOption[] =>
  (periodos || []).map((periodo) => {
    const talhao = String(periodo?.talhao_nome || periodo?.talhao || '').trim();
    const label = String(
      periodo?.label
        || [
          periodo?.tipo_periodo_label,
          periodo?.cultura,
          periodo?.ano_agricola,
          talhao,
        ].filter(Boolean).join(' • ')
    ).trim();

    return {
      id: String(periodo?.id || '').trim(),
      label: label || 'Safra/Safrinha',
      tipoPeriodo: String(periodo?.tipo_periodo || '').trim() || undefined,
      cultura: String(periodo?.cultura || '').trim() || undefined,
      anoAgricola: String(periodo?.ano_agricola || '').trim() || undefined,
      status: String(periodo?.status || '').trim() || undefined,
      fazendaId: String(periodo?.fazenda_id || periodo?.fazendaId || '').trim() || undefined,
      propriedadeId: String(periodo?.propriedade_id || periodo?.propriedadeId || '').trim() || undefined,
      talhao: talhao || undefined,
    };
  }).filter((option) => option.id.length > 0);

export const findCadernoPeriodoProdutivoOption = (
  options: CadernoPeriodoProdutivoOption[] = [],
  periodoProdutivoId?: string | null
): CadernoPeriodoProdutivoOption | null =>
  options.find((option) => option.id === periodoProdutivoId) ?? null;

export const getCadernoFormFazendaId = (registro: any): string =>
  getCadernoFazendaId(registro) || getPropriedadeId(registro) || '';

export const resolveCadernoEdicaoFazendaId = (registro: any, fallbackFazendaId = ''): string =>
  getCadernoFormFazendaId(registro) || fallbackFazendaId;

export const getCadernoFormFazendaLabel = (
  option?: CadernoFazendaOption | null,
  emptyLabel = 'Selecione uma propriedade'
): string => {
  if (!option) {
    return emptyLabel;
  }

  return [option.fazendaNome, option.titularNome].filter(Boolean).join(' - ');
};

export const getCadernoFormPeriodoProdutivoLabel = (
  option?: CadernoPeriodoProdutivoOption | null,
  emptyLabel = 'Sem Safra/Safrinha vinculada'
): string => option?.label || emptyLabel;

export const getCadernoTipoLabel = (tipo?: string | null): string => {
  const normalized = String(tipo || '').trim();
  if (!normalized) {
    return 'Registro';
  }

  return CADERNO_TIPO_LABELS[normalized] || normalized.replace(/_/g, ' ');
};

export const getCadernoTalhaoLabel = (registro: any): string => {
  const talhao = String(registro?.talhao || '').trim();
  return talhao || 'Sem talhão vinculado';
};

export const getCadernoPeriodoProdutivoLabel = (registro: any): string => {
  const label = String(registro?.periodo_produtivo_label || '').trim();
  if (label) return label;

  const tipo = String(registro?.tipo_periodo || '').trim();
  const tipoLabel = tipo === 'safrinha' ? 'Safrinha' : tipo === 'safra' ? 'Safra' : '';
  const cultura = String(registro?.cultura_periodo || '').trim();
  const anoAgricola = String(registro?.ano_agricola || '').trim();

  return [tipoLabel, cultura, anoAgricola].filter(Boolean).join(' • ');
};

export const isCadernoVisivelParaProdutor = (registro: any): boolean =>
  registro?.visivel_para_produtor !== false;

export const getCadernoVisibilidadeLabel = (registro: any): string =>
  isCadernoVisivelParaProdutor(registro) ? 'Liberado ao produtor' : 'Interno';

export const isCadernoRegistradoPeloProdutor = (registro: any): boolean =>
  registro?.origem_registro === 'produtor';

export const getCadernoOrigemLabel = (registro: any): string =>
  isCadernoRegistradoPeloProdutor(registro) ? 'Registrado pelo produtor' : 'Registrado pela equipe';

export const ordenarCadernosPorDataRecente = (registros: any[] = []) =>
  [...(registros || [])].sort((a, b) => {
    const dataA = a?.data_atividade ? new Date(a.data_atividade).getTime() : 0;
    const dataB = b?.data_atividade ? new Date(b.data_atividade).getTime() : 0;
    const safeA = Number.isFinite(dataA) ? dataA : 0;
    const safeB = Number.isFinite(dataB) ? dataB : 0;
    return safeB - safeA;
  });

export const parseCadernoProdutos = (produtosText = ''): string[] =>
  produtosText
    .split(',')
    .map((produto) => produto.trim())
    .filter(Boolean);

export const parseCadernoAreaAplicada = (areaText = ''): number | undefined | null => {
  const normalized = String(areaText).trim().replace(',', '.');

  if (!normalized) {
    return undefined;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

const trimOrUndefined = (value?: string) => {
  const normalized = String(value || '').trim();
  return normalized || undefined;
};

const buildCadernoPeriodoPayloadFields = (
  periodoProdutivo?: CadernoPeriodoProdutivoOption | null
): Record<string, any> => {
  if (!periodoProdutivo?.id) {
    return {};
  }

  return {
    periodo_produtivo_id: periodoProdutivo.id,
    periodoProdutivoId: periodoProdutivo.id,
    periodo_produtivo_label: trimOrUndefined(periodoProdutivo.label),
    tipo_periodo: trimOrUndefined(periodoProdutivo.tipoPeriodo),
    cultura_periodo: trimOrUndefined(periodoProdutivo.cultura),
    ano_agricola: trimOrUndefined(periodoProdutivo.anoAgricola),
  };
};

export const buildCadernoPayload = ({
  fazendaId,
  dataAtividade,
  tipoAtividade,
  talhao = '',
  produtosText = '',
  dosagem = '',
  areaAplicadaText = '',
  condicoesClima = '',
  observacoes = '',
  visivelParaProdutor = true,
  colaboradorResponsavel,
  criadoPorUserId,
  origemRegistro,
  periodoProdutivo,
}: BuildCadernoPayloadInput) => {
  if (!(dataAtividade instanceof Date) || Number.isNaN(dataAtividade.getTime())) {
    return null;
  }

  const areaAplicada = parseCadernoAreaAplicada(areaAplicadaText);
  if (areaAplicada === null) {
    return null;
  }

  const payload: Record<string, any> = {
    fazenda_id: fazendaId,
    fazendaId,
    colaborador_responsavel: trimOrUndefined(colaboradorResponsavel) || 'Sistema',
    data_atividade: dataAtividade.toISOString(),
    tipo_atividade: tipoAtividade,
    talhao: trimOrUndefined(talhao),
    produtos_utilizados: parseCadernoProdutos(produtosText),
    dosagem: trimOrUndefined(dosagem),
    area_aplicada: areaAplicada,
    condicoes_clima: trimOrUndefined(condicoesClima),
    observacoes: trimOrUndefined(observacoes),
    visivel_para_produtor: visivelParaProdutor === true,
    ...buildCadernoPeriodoPayloadFields(periodoProdutivo),
  };

  const autoria = trimOrUndefined(criadoPorUserId);
  if (autoria) {
    payload.criado_por_user_id = autoria;
  }

  const origem = trimOrUndefined(origemRegistro);
  if (origem) {
    payload.origem_registro = origem;
  }

  return payload;
};
