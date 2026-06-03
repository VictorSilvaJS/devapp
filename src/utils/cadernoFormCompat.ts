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

export const CADERNO_TIPOS_ATIVIDADE = [
  { value: 'vistoria', label: 'Vistoria' },
  { value: 'plantio', label: 'Plantio' },
  { value: 'adubacao', label: 'Adubação' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'colheita', label: 'Colheita' },
  { value: 'analise_solo', label: 'Análise de Solo' },
  { value: 'outro', label: 'Outro' },
];

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
  };

  const autoria = trimOrUndefined(criadoPorUserId);
  if (autoria) {
    payload.criado_por_user_id = autoria;
  }

  return payload;
};
