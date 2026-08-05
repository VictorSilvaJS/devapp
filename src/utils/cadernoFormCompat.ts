import {
  getCadernoFazendaId,
} from './acessoControle';
import { getFazendaUiInfo } from './fazendaUiCompat';
import { getPropriedadeId } from './propriedadeCompat';
import {
  getTalhaoConsultaId,
  getTalhaoConsultaNome,
  getTalhaoStableId,
} from './talhaoConsultaCompat';

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
  propriedadeId?: string;
  talhao?: string;
};

export type CadernoTalhaoOption = {
  value: string;
  label: string;
  description?: string;
};

export const CADERNO_TALHAO_TODA_PROPRIEDADE_VALUE = '';
export const CADERNO_TALHAO_LEGADO_VALUE = '__caderno_talhao_legado__';

export const buildCadernoTalhaoOptions = (
  talhoes: Array<Record<string, any>> = [],
  current: { id?: unknown; nome?: unknown } = {}
): { options: CadernoTalhaoOption[]; selectedValue: string; legacy: boolean } => {
  const currentId = String(current.id ?? '').trim();
  const currentNome = String(current.nome ?? '').trim();
  const options: CadernoTalhaoOption[] = [
    {
      value: CADERNO_TALHAO_TODA_PROPRIEDADE_VALUE,
      label: 'Toda a Propriedade',
      description: 'Registro geral, sem vínculo com um Talhão específico.',
    },
  ];
  const seenIds = new Set<string>();

  talhoes.forEach((item) => {
    const id = getTalhaoStableId(item);
    const nome = getTalhaoConsultaNome(item);
    if (!id || !nome || seenIds.has(id)) return;
    seenIds.add(id);
    options.push({ value: id, label: nome });
  });

  if (currentId) {
    const selected = options.find((option) => option.value === currentId);
    if (!selected) {
      options.push({
        value: currentId,
        label: currentNome || 'Talhão salvo',
        description: 'Referência salva; não consta no catálogo atual da Propriedade.',
      });
    }
    return { options, selectedValue: currentId, legacy: false };
  }

  if (currentNome) {
    options.push({
      value: CADERNO_TALHAO_LEGADO_VALUE,
      label: currentNome,
      description: 'Referência legada em texto; preservada sem criar um ID.',
    });
    return { options, selectedValue: CADERNO_TALHAO_LEGADO_VALUE, legacy: true };
  }

  return {
    options,
    selectedValue: CADERNO_TALHAO_TODA_PROPRIEDADE_VALUE,
    legacy: false,
  };
};

export const findCadernoTalhaoByRoute = (
  talhoes: Array<Record<string, any>> = [],
  routeTalhaoId?: unknown
): { id: string; nome: string } | null => {
  const id = String(routeTalhaoId ?? '').trim();
  if (!id) return null;

  const matched = talhoes.find((item) => (
    getTalhaoStableId(item) === id || getTalhaoConsultaId(item) === id
  ));
  if (!matched) return null;

  const stableId = getTalhaoStableId(matched);
  if (!stableId) return null;

  return { id: stableId, nome: getTalhaoConsultaNome(matched) };
};

export const CADERNO_TIPOS_ATIVIDADE = [
  { value: 'observacao', label: 'Observação' },
  { value: 'plantio', label: 'Plantio' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'colheita', label: 'Colheita' },
  { value: 'ocorrencia', label: 'Ocorrência' },
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
  'visita_tecnica',
  'fertilidade',
  'correcao_solo',
  'prescricao',
  'vistoria',
  'adubacao',
  'aplicacao',
  'analise_solo',
]));

type BuildCadernoPayloadInput = {
  propriedadeId: string;
  dataAtividade: Date | null;
  tipoAtividade: string;
  talhaoId?: string;
  talhao?: string;
  produtosText?: string;
  dosagem?: string;
  areaAplicadaText?: string;
  condicoesClima?: string;
  observacoes?: string;
  visivelParaProdutor?: boolean;
  responsavelUsuarioId?: string;
  colaboradorResponsavel?: string;
  criadoPorUserId?: string;
  criadoPorNome?: string;
  origemRegistro?: string;
  periodoProdutivo?: CadernoPeriodoProdutivoOption | null;
  operacao?: string;
  produtividadeText?: string;
};

export type CadernoFormFieldVisibility = {
  periodo: boolean;
  talhao: boolean;
  operacao: boolean;
  produtos: boolean;
  dosagem: boolean;
  area: boolean;
  produtividade: boolean;
  clima: boolean;
  observacoes: boolean;
};

export const getCadernoFormFieldVisibility = (tipoAtividade?: string): CadernoFormFieldVisibility => {
  const tipo = String(tipoAtividade || '').trim();
  return {
    periodo: tipo === 'plantio' || tipo === 'colheita',
    talhao: tipo === 'plantio' || tipo === 'aplicacao' || tipo === 'colheita',
    operacao: tipo === 'plantio',
    produtos: tipo === 'aplicacao',
    dosagem: tipo === 'aplicacao',
    area: tipo === 'aplicacao' || tipo === 'colheita',
    produtividade: tipo === 'colheita',
    clima: tipo === 'plantio' || tipo === 'aplicacao' || tipo === 'colheita',
    observacoes: Boolean(tipo),
  };
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
      propriedadeId: String(
        periodo?.propriedade_id
        || periodo?.propriedadeId
        || periodo?.fazenda_id
        || periodo?.fazendaId
        || ''
      ).trim() || undefined,
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
  const talhao = String(registro?.talhao_nome || registro?.talhao || '').trim();
  return talhao || 'Toda a Propriedade';
};

export const isCadernoTalhaoLegado = (registro: any): boolean =>
  Boolean(
    String(registro?.talhao_nome || registro?.talhao || '').trim()
    && !String(registro?.talhao_id || registro?.talhaoId || '').trim()
  );

export const getCadernoRegistradoPorLabel = (registro: any): string => {
  const snapshot = String(registro?.criado_por_nome || '').trim();
  if (snapshot) return snapshot;

  return getCadernoOrigemLabel(registro);
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

export const parseCadernoProdutividade = (produtividadeText = ''): number | undefined | null => {
  const normalized = String(produtividadeText).trim().replace(',', '.');
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
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
  propriedadeId,
  dataAtividade,
  tipoAtividade,
  talhaoId = '',
  talhao = '',
  produtosText = '',
  dosagem = '',
  areaAplicadaText = '',
  condicoesClima = '',
  observacoes = '',
  visivelParaProdutor = true,
  responsavelUsuarioId,
  colaboradorResponsavel,
  criadoPorUserId,
  criadoPorNome,
  origemRegistro,
  periodoProdutivo,
  operacao = '',
  produtividadeText = '',
}: BuildCadernoPayloadInput) => {
  if (!(dataAtividade instanceof Date) || Number.isNaN(dataAtividade.getTime())) {
    return null;
  }

  const areaAplicada = parseCadernoAreaAplicada(areaAplicadaText);
  if (areaAplicada === null) {
    return null;
  }
  const produtividade = parseCadernoProdutividade(produtividadeText);
  if (produtividade === null) return null;

  const talhaoNome = trimOrUndefined(talhao);
  const talhaoIdNormalizado = trimOrUndefined(talhaoId);
  const responsavelId = trimOrUndefined(responsavelUsuarioId);
  const responsavelNome = trimOrUndefined(colaboradorResponsavel) || 'Sistema';
  const payload: Record<string, any> = {
    propriedade_id: propriedadeId,
    colaborador_responsavel: responsavelNome,
    data_atividade: dataAtividade.toISOString(),
    tipo_atividade: tipoAtividade,
    talhao: talhaoNome,
    talhao_nome: talhaoNome,
    talhao_id: talhaoNome ? talhaoIdNormalizado : undefined,
    produtos_utilizados: parseCadernoProdutos(produtosText),
    operacao: trimOrUndefined(operacao),
    dosagem: trimOrUndefined(dosagem),
    area_aplicada: areaAplicada,
    produtividade,
    condicoes_clima: trimOrUndefined(condicoesClima),
    observacoes: trimOrUndefined(observacoes),
    visivel_para_produtor: visivelParaProdutor === true,
    ...buildCadernoPeriodoPayloadFields(periodoProdutivo),
  };

  if (responsavelId) {
    payload.responsavel_usuario_id = responsavelId;
  }

  const autoria = trimOrUndefined(criadoPorUserId);
  if (autoria) {
    payload.criado_por_user_id = autoria;
  }

  const autoriaNome = trimOrUndefined(criadoPorNome);
  if (autoriaNome) {
    payload.criado_por_nome = autoriaNome;
  }

  const origem = trimOrUndefined(origemRegistro);
  if (origem) {
    payload.origem_registro = origem;
  }

  return payload;
};
