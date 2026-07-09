import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Linking,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import ShapeRenderer from '../components/ShapeRenderer';
import TalhaoDetailModal from '../components/TalhaoDetailModal';
import { useToast } from '../components/Toast';
import {
  EmptyState,
  FormField,
  InfoBox,
  SearchBar,
  SectionCard,
  SegmentedChips,
  SelectField,
} from '../components';
import { Mapa, Produtor, LimiteArea, CadernoCampo } from '../api/mock';
import {
  buildFazendaMapaRouteParamsFromPropriedade,
  resolveRouteFazendaId,
} from '../navigation/mapaRouteCompat';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import {
  avaliarAcessoFazendaPorId,
  filtrarLimitesPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarCadernosPorFazendaIds,
  filtrarProdutoresPorAcesso,
  getFazendaId,
  getLimiteAreaFazendaId,
  getMapaFazendaId,
  podeGerenciarPeriodoProdutivoEmFazenda,
  podeIncluirCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  buildFazendaConsultaOptions,
  buildFazendaUiInfoMap,
  getFazendaUiInfo,
} from '../utils/fazendaUiCompat';
import { avaliarDownloadMapa } from '../utils/mapaDownloadCompat';
import {
  PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE,
  isPngLocalMapa,
  mergeMapasWithPngMapImports,
  resolveMapaPngImageSource,
} from '../utils/pngMapToMapaCompat';
import {
  PRESCRIPTION_ZIP_DETAILS_MESSAGE,
  isPrescriptionZipLocalMapa,
  mergeMapasWithPrescriptionZipImports,
} from '../utils/prescriptionZipToMapaCompat';
import { resolveSelaPrataIFertilidadeAssetSource } from '../assets/mapas/sela-prata-i/2025/fertilidade';
import {
  confirmGeoJsonPropertyImport,
  listGeoJsonImportsForPropriedade,
  prepareGeoJsonPropertyImport,
} from '../services/GeoJsonPropertyImportWorkflow';
import type {
  GeoJsonPropertyImportPreview,
} from '../services/GeoJsonPropertyImportWorkflow';
import {
  canManageGeoJsonForPropriedade,
  removeActiveGeoJsonForPropriedade,
  replaceGeoJsonForPropriedade,
  shouldShowSelaPrataIRemovalWarning,
} from '../services/GeoJsonPropertyManageWorkflow';
import {
  GeoJsonTalhoesLayerResult,
  isGeoJsonTalhoesLayerActive,
  isGeoJsonTalhoesLayerFallback,
  loadGeoJsonTalhoesLayer,
} from '../services/GeoJsonTalhoesLayerService';
import type { GeoJsonImportMetadata } from '../types/geojsonImport';
import {
  PNG_MAP_PROPERTY_CATEGORY_OPTIONS,
  canStartPngMapPropertyImport,
  confirmPngMapPropertyImport,
  listActivePngMapImportsForPropriedade,
  preparePngMapPropertyImport,
} from '../services/PngMapPropertyImportWorkflow';
import type {
  PngMapPropertyImportFormInput,
  PngMapPropertyImportPreview,
} from '../services/PngMapPropertyImportWorkflow';
import {
  canManagePngMapItem,
  removePngMapForPropriedade,
  replacePngMapForPropriedade,
} from '../services/PngMapPropertyManageWorkflow';
import { PngStorageService } from '../services/PngStorageService';
import type { PngMapImportMetadata } from '../types/anexoPngLocal';
import {
  PRESCRIPTION_ZIP_LAYER_OPTIONS,
  canStartPrescriptionZipPropertyImport,
  confirmPrescriptionZipPropertyImport,
  listActivePrescriptionZipImportsForPropriedade,
  preparePrescriptionZipPropertyImport,
} from '../services/PrescriptionZipPropertyImportWorkflow';
import type {
  PrescriptionZipPropertyImportFormInput,
  PrescriptionZipPropertyImportPreview,
} from '../services/PrescriptionZipPropertyImportWorkflow';
import {
  canManagePrescriptionZipItem,
  removePrescriptionZipForPropriedade,
  replacePrescriptionZipForPropriedade,
} from '../services/PrescriptionZipPropertyManageWorkflow';
import type { PrescriptionZipImportMetadata } from '../types/anexoPrescricaoZipLocal';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import {
  filtrarRegistrosDoTalhao,
  getTalhaoConsultaId,
  getTalhaoConsultaNome,
  getTalhaoOrigemDemarcacaoLabel,
  separarMateriaisPorTalhao,
  separarPeriodosPorTalhao,
} from '../utils/talhaoConsultaCompat';
import { buildPropriedadeContextRouteParams } from '../navigation/propriedadeRouteCompat';
import {
  getCadernoPeriodoProdutivoLabel,
  getCadernoTalhaoLabel,
  getCadernoTipoLabel,
  ordenarCadernosPorDataRecente,
} from '../utils/cadernoFormCompat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ──────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────
const CATEGORIAS = [
  { id: 'todos', nome: 'Todos', icon: 'grid-outline' },
  { id: 'fertilidade', nome: 'Fertilidade', icon: 'leaf-outline' },
  { id: 'correcao', nome: 'Correção de solo', icon: 'construct-outline' },
  { id: 'prescricao', nome: 'Prescrição', icon: 'map-outline' },
];

const FILTRO_TODOS = 'todos';
const CATEGORIAS_MATERIAIS_TECNICOS = ['fertilidade', 'correcao', 'prescricao'];

type GeoJsonImportMode = 'attach' | 'replace';
type GeoJsonManageDialogAction = 'replace' | 'remove' | null;
type PngManageDialogAction = 'replace' | 'remove' | null;
type PrescriptionZipManageDialogAction = 'replace' | 'remove' | null;

const ORDENACOES_MATERIAIS = [
  { key: 'recente', label: 'Recente', icon: 'time-outline' },
  { key: 'titulo', label: 'Título', icon: 'text-outline' },
];

const PNG_ESCOPO_OPTIONS = [
  {
    value: 'propriedade',
    label: 'Propriedade inteira',
    description: 'Anexo vinculado ao contexto completo da Propriedade.',
  },
  {
    value: 'talhao',
    label: 'Talhão específico',
    description: 'Anexo vinculado a um talhão informado.',
  },
];

const EMPTY_PNG_FORM: PngMapPropertyImportFormInput = {
  titulo: '',
  elemento: 'ph',
  safra: '',
  ano: '',
  profundidade: '',
  escopo: 'propriedade',
  talhao_id: '',
  talhao_nome: '',
  descricao: '',
  visivel_para_produtor: true,
};

const EMPTY_PRESCRIPTION_ZIP_FORM: PrescriptionZipPropertyImportFormInput = {
  titulo: '',
  camada: 'prescricao',
  safra: '',
  ano: '',
  escopo: 'propriedade',
  talhao_id: '',
  talhao_nome: '',
  descricao: '',
  visivel_para_produtor: true,
};

const normalizarBusca = (value: unknown): string =>
  typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    : '';

const getAnoData = (data?: string | null): number | null => {
  if (!data) return null;
  const year = new Date(data).getFullYear();
  return Number.isFinite(year) ? year : null;
};

const getMapaSafra = (mapa: any): string => {
  const safra = typeof mapa?.safra === 'string' ? mapa.safra.trim() : '';
  if (safra) return safra;

  const ano = getAnoData(mapa?.data_criacao);
  return ano ? String(ano) : '';
};

const getMapaTalhao = (mapa: any): string => {
  const talhaoNome = typeof mapa?.talhao_nome === 'string' ? mapa.talhao_nome.trim() : '';
  if (talhaoNome) return talhaoNome;

  return typeof mapa?.talhao === 'string' ? mapa.talhao.trim() : '';
};

const getCategoriaMapaLabel = (categoria?: string): string => {
  const categoriaInfo = CATEGORIAS.find((cat) => cat.id === categoria);
  return categoriaInfo?.nome || 'Material técnico';
};

const isCategoriaMaterialTecnico = (categoria?: unknown): boolean =>
  typeof categoria === 'string' && CATEGORIAS_MATERIAIS_TECNICOS.includes(categoria);

const getMapaProfundidade = (mapa: any): string =>
  typeof mapa?.profundidade === 'string' ? mapa.profundidade.trim() : '';

const ELEMENTO_LABELS: Record<string, string> = {
  argila: 'Argila',
  ph: 'pH',
  fosforo: 'Fósforo',
  potassio: 'Potássio',
  materia_organica: 'Matéria orgânica (MO)',
  calcio: 'Cálcio',
  magnesio: 'Magnésio',
  ctc: 'CTC',
  saturacao_bases: 'Saturação de bases',
  aluminio: 'Alumínio',
  enxofre: 'Enxofre',
};

const getMapaElementoLabel = (mapa: any): string => {
  const elementoLabel = typeof mapa?.elemento_label === 'string' ? mapa.elemento_label.trim() : '';
  if (elementoLabel) return elementoLabel;

  const subcategoria = typeof mapa?.subcategoria === 'string' ? mapa.subcategoria.trim() : '';
  if (subcategoria) return subcategoria;

  const elemento = typeof mapa?.elemento === 'string' ? mapa.elemento.trim() : '';
  if (!elemento) return '';

  return ELEMENTO_LABELS[elemento] ?? elemento;
};

const getMapaArquivoNomeOriginal = (mapa: any): string =>
  typeof mapa?.arquivo_nome_original === 'string' ? mapa.arquivo_nome_original.trim() : '';

const getSafraSortValue = (safra: string): number => {
  const anos = safra.match(/\d{4}/g)?.map((ano) => Number.parseInt(ano, 10)) ?? [];
  return anos.length > 0 ? Math.max(...anos) : 0;
};

const buildOptionsOrdenadas = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

const buildSafraOptions = (mapas: any[]): string[] =>
  buildOptionsOrdenadas(mapas.map(getMapaSafra))
    .sort((a, b) => getSafraSortValue(b) - getSafraSortValue(a) || a.localeCompare(b));

// ──────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────
export default function MapasScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros } = useFiltros();
  const fazendaId = resolveRouteFazendaId(route?.params);

  // Estado geral
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estadoBloqueio, setEstadoBloqueio] = useState<string | null>(null);
  const [contextoConsulta, setContextoConsulta] = useState<any>({
    tipo: 'geral',
    fazenda: null,
    fazendasPermitidas: [],
  });

  // Estado de materiais técnicos
  const [mapas, setMapas] = useState([]);
  const [cadernos, setCadernos] = useState([]);
  const [periodosProdutivos, setPeriodosProdutivos] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('recente');
  const [fazendaFiltroOperacional, setFazendaFiltroOperacional] = useState(FILTRO_TODOS);
  const [safraFiltroMapas, setSafraFiltroMapas] = useState(FILTRO_TODOS);
  const [talhaoFiltroMapas, setTalhaoFiltroMapas] = useState(FILTRO_TODOS);
  const [downloadDialog, setDownloadDialog] = useState<any>({
    visible: false,
    mapa: null,
    status: null,
  });
  const [imagePreview, setImagePreview] = useState<any>({
    visible: false,
    mapa: null,
    source: null,
  });
  // Estado técnico de demarcação/panorama
  const [limites, setLimites] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoFiltroLimite, setAnoFiltroLimite] = useState(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [talhaoDetailVisible, setTalhaoDetailVisible] = useState(false);
  const [talhaoFiltroLimite, setTalhaoFiltroLimite] = useState(FILTRO_TODOS);
  const [geoJsonImports, setGeoJsonImports] = useState<GeoJsonImportMetadata[]>([]);
  const [geoJsonImporting, setGeoJsonImporting] = useState(false);
  const [geoJsonConfirming, setGeoJsonConfirming] = useState(false);
  const [geoJsonPreview, setGeoJsonPreview] = useState<GeoJsonPropertyImportPreview | null>(null);
  const [geoJsonPreviewMode, setGeoJsonPreviewMode] = useState<GeoJsonImportMode>('attach');
  const [pngImports, setPngImports] = useState<PngMapImportMetadata[]>([]);
  const [pngImporting, setPngImporting] = useState(false);
  const [pngConfirming, setPngConfirming] = useState(false);
  const [pngPreview, setPngPreview] = useState<PngMapPropertyImportPreview | null>(null);
  const [pngForm, setPngForm] = useState<PngMapPropertyImportFormInput>(EMPTY_PNG_FORM);
  const [pngFormErrors, setPngFormErrors] = useState<Record<string, string>>({});
  const [prescriptionZipImports, setPrescriptionZipImports] = useState<PrescriptionZipImportMetadata[]>([]);
  const [prescriptionZipImporting, setPrescriptionZipImporting] = useState(false);
  const [prescriptionZipConfirming, setPrescriptionZipConfirming] = useState(false);
  const [prescriptionZipPreview, setPrescriptionZipPreview] = useState<PrescriptionZipPropertyImportPreview | null>(null);
  const [prescriptionZipForm, setPrescriptionZipForm] = useState<PrescriptionZipPropertyImportFormInput>(EMPTY_PRESCRIPTION_ZIP_FORM);
  const [prescriptionZipFormErrors, setPrescriptionZipFormErrors] = useState<Record<string, string>>({});
  const [geoJsonManageDialog, setGeoJsonManageDialog] = useState<{
    visible: boolean;
    action: GeoJsonManageDialogAction;
    loading: boolean;
  }>({
    visible: false,
    action: null,
    loading: false,
  });
  const [pngManageDialog, setPngManageDialog] = useState<{
    visible: boolean;
    action: PngManageDialogAction;
    loading: boolean;
  }>({
    visible: false,
    action: null,
    loading: false,
  });
  const [prescriptionZipManageDialog, setPrescriptionZipManageDialog] = useState<{
    visible: boolean;
    action: PrescriptionZipManageDialogAction;
    loading: boolean;
  }>({
    visible: false,
    action: null,
    loading: false,
  });
  const [prescriptionZipDetail, setPrescriptionZipDetail] = useState<any>({
    visible: false,
    mapa: null,
  });
  const [geoJsonTalhoesLayer, setGeoJsonTalhoesLayer] = useState<GeoJsonTalhoesLayerResult | null>(null);

  // ──────────────────────────────────────────────
  // CARREGAMENTO DE DADOS
  // ──────────────────────────────────────────────
  useEffect(() => {
    loadDados();
  }, [fazendaId, filtros, user]);

  const loadDados = async () => {
    setLoading(true);
    setEstadoBloqueio(null);
    try {
      const todosProdutores = await Produtor.list();
      const fazendasComAcesso = user
        ? filtrarProdutoresPorAcesso(todosProdutores, user)
        : [];

      let idsPermitidos = [];
      let fazendasNoContexto = fazendasComAcesso;
      let fazendaContexto = null;

      if (fazendaId) {
        const avaliacao = avaliarAcessoFazendaPorId(todosProdutores, user, fazendaId);

        if (avaliacao.status !== 'permitido') {
          setEstadoBloqueio(avaliacao.status);
          setContextoConsulta({
            tipo: 'fazenda',
            fazenda: null,
            fazendasPermitidas: fazendasComAcesso,
          });
          setMapas([]);
          setCadernos([]);
          setPeriodosProdutivos([]);
          setLimites([]);
          setAnosDisponiveis([]);
          setAnoFiltroLimite(null);
          setFazendaFiltroOperacional(FILTRO_TODOS);
          setTalhaoFiltroLimite(FILTRO_TODOS);
          setSelectedTalhao(null);
          setGeoJsonImports([]);
          setPngImports([]);
          setPrescriptionZipImports([]);
          setGeoJsonTalhoesLayer(null);
          return;
        }

        fazendaContexto = avaliacao.fazenda;
        fazendasNoContexto = [fazendaContexto];
        idsPermitidos = [avaliacao.fazendaId];
      } else {
        idsPermitidos = getFazendaIdsFiltrados(fazendasComAcesso);
        const idsSet = new Set(idsPermitidos);
        fazendasNoContexto = fazendasComAcesso.filter((fazenda) =>
          idsSet.has(getFazendaId(fazenda))
        );
      }

      setContextoConsulta({
        tipo: fazendaId ? 'fazenda' : 'geral',
        fazenda: fazendaContexto,
        fazendasPermitidas: fazendasNoContexto,
      });
      setFazendaFiltroOperacional((filtroAtual) => {
        if (fazendaId) return FILTRO_TODOS;
        return filtroAtual !== FILTRO_TODOS && idsPermitidos.includes(filtroAtual)
          ? filtroAtual
          : FILTRO_TODOS;
      });

      const [todosMapas, todosLimites, todosCadernos] = await Promise.all([
        Mapa.list(),
        LimiteArea.list(),
        CadernoCampo.list(),
      ]);

      const mapasFiltrados = filtrarMapasPorFazendaIds(todosMapas, idsPermitidos, {
        somenteDisponiveisDownload: user?.perfil === 'produtor',
      });
      const cadernosFiltrados = ordenarCadernosPorDataRecente(
        filtrarCadernosPorFazendaIds(todosCadernos, idsPermitidos, {
          somenteVisivelParaProdutor: user?.perfil === 'produtor',
        })
      );
      const limitesFiltrados = filtrarLimitesPorFazendaIds(todosLimites, idsPermitidos);
      const periodosPromise = idsPermitidos.length > 0
        ? Promise.all(idsPermitidos.map((id) => PeriodoProdutivoService.listActivePeriodosProdutivosByPropriedade(id)))
            .then((listas) => listas.flat())
        : Promise.resolve([]);
      const pngImportsPromise = idsPermitidos.length > 0
        ? Promise.all(idsPermitidos.map((id) => listActivePngMapImportsForPropriedade(id)))
            .then((listas) => listas.flat())
        : Promise.resolve([]);
      const prescriptionZipImportsPromise = idsPermitidos.length > 0
        ? Promise.all(idsPermitidos.map((id) => listActivePrescriptionZipImportsForPropriedade(id)))
            .then((listas) => listas.flat())
        : Promise.resolve([]);
      const [importsGeoJson, talhoesLayer, periodosLocais, importsPng, importsPrescriptionZip] = await Promise.all([
        fazendaId && idsPermitidos.length === 1
          ? listGeoJsonImportsForPropriedade(idsPermitidos[0])
          : Promise.resolve([]),
        fazendaId && idsPermitidos.length === 1
          ? loadGeoJsonTalhoesLayer({
              propriedade_id: idsPermitidos[0],
              fazenda_id: idsPermitidos[0],
            })
          : Promise.resolve(null),
        periodosPromise,
        pngImportsPromise,
        prescriptionZipImportsPromise,
      ]);

      setMapas(mapasFiltrados);
      setCadernos(cadernosFiltrados);
      setPeriodosProdutivos(periodosLocais);
      setLimites(limitesFiltrados);
      setGeoJsonImports(importsGeoJson);
      setPngImports(importsPng);
      setPrescriptionZipImports(importsPrescriptionZip);
      setGeoJsonTalhoesLayer(talhoesLayer);

      const baseTalhoesParaAno = isGeoJsonTalhoesLayerActive(talhoesLayer)
        ? talhoesLayer.talhoes
        : limitesFiltrados;
      const anos = [...new Set(baseTalhoesParaAno.map(l => l.ano))].sort((a: any, b: any) => Number(b) - Number(a));
      setAnosDisponiveis(anos);
      setAnoFiltroLimite((anoAtual) => {
        if (anos.length === 0) return null;
        return anoAtual && anos.includes(anoAtual) ? anoAtual : anos[0];
      });
    } catch (error) {
      setCadernos([]);
      setPeriodosProdutivos([]);
      setGeoJsonImports([]);
      setPngImports([]);
      setPrescriptionZipImports([]);
      setGeoJsonTalhoesLayer(null);
      toast.showError('Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDados();
    setRefreshing(false);
  };

  // ──────────────────────────────────────────────
  // CONTEXTO OPERACIONAL
  // ──────────────────────────────────────────────
  const consultaPorFazenda = contextoConsulta.tipo === 'fazenda' && !!contextoConsulta.fazenda;
  const isProdutorView = user?.perfil === 'produtor';
  const fazendaContextoInfo = consultaPorFazenda ? getFazendaUiInfo(contextoConsulta.fazenda) : null;
  const geoJsonImportAtivo = useMemo(
    () => geoJsonImports.find((item) => item.status === 'ativo') ?? null,
    [geoJsonImports]
  );
  const podeGerenciarGeoJson = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canManageGeoJsonForPropriedade(user, contextoConsulta.fazenda);
  const podeAnexarGeoJson = podeGerenciarGeoJson;
  const podeAnexarPng = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canStartPngMapPropertyImport(user, contextoConsulta.fazenda);
  const podeAnexarPrescriptionZip = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canStartPrescriptionZipPropertyImport(user, contextoConsulta.fazenda);
  const pngImportsAtivos = useMemo(
    () => pngImports.filter((item) => item.status === 'ativo'),
    [pngImports]
  );
  const pngImportsMateriaisAtivos = useMemo(
    () => pngImportsAtivos.filter((item) => isCategoriaMaterialTecnico(item.categoria)),
    [pngImportsAtivos]
  );
  const prescriptionZipImportsAtivos = useMemo(
    () => prescriptionZipImports.filter((item) => item.status === 'ativo'),
    [prescriptionZipImports]
  );
  const fazendaOptions = useMemo(
    () => buildFazendaConsultaOptions(contextoConsulta.fazendasPermitidas || []),
    [contextoConsulta.fazendasPermitidas]
  );
  const fazendaInfoPorId = useMemo<Map<string, any>>(
    () => buildFazendaUiInfoMap(contextoConsulta.fazendasPermitidas || []),
    [contextoConsulta.fazendasPermitidas]
  );
  const fazendaFiltroInfo = fazendaFiltroOperacional !== FILTRO_TODOS
    ? fazendaInfoPorId.get(fazendaFiltroOperacional)
    : null;
  const fazendaFiltroId = !consultaPorFazenda && fazendaFiltroInfo
    ? fazendaFiltroInfo.id
    : null;
  const propriedadeIdsPermitidos = useMemo(
    () => (contextoConsulta.fazendasPermitidas || []).map(getFazendaId).filter(Boolean),
    [contextoConsulta.fazendasPermitidas]
  );
  const mapasComPngLocal = useMemo(
    () => mergeMapasWithPngMapImports(mapas, pngImports, {
      propriedadeIds: propriedadeIdsPermitidos,
      perfil: user?.perfil,
    }),
    [mapas, pngImports, propriedadeIdsPermitidos, user?.perfil]
  );
  const mapasComMateriaisLocais = useMemo(
    () => mergeMapasWithPrescriptionZipImports(mapasComPngLocal, prescriptionZipImports, {
      propriedadeIds: propriedadeIdsPermitidos,
      perfil: user?.perfil,
    }),
    [mapasComPngLocal, prescriptionZipImports, propriedadeIdsPermitidos, user?.perfil]
  );

  const mapasNoContexto = useMemo(() => {
    if (!fazendaFiltroId) return mapasComMateriaisLocais;
    return mapasComMateriaisLocais.filter((mapa) => getMapaFazendaId(mapa) === fazendaFiltroId);
  }, [mapasComMateriaisLocais, fazendaFiltroId]);
  const materiaisTecnicosNoContexto = useMemo(
    () => mapasNoContexto.filter((mapa) => isCategoriaMaterialTecnico(mapa?.categoria)),
    [mapasNoContexto]
  );

  const limitesNoContexto = useMemo(() => {
    if (!fazendaFiltroId) return limites;
    return limites.filter((limite) => getLimiteAreaFazendaId(limite) === fazendaFiltroId);
  }, [limites, fazendaFiltroId]);
  const geoJsonTalhoesLocalAtivo = isGeoJsonTalhoesLayerActive(geoJsonTalhoesLayer);
  const geoJsonTalhoesLocalErro = isGeoJsonTalhoesLayerFallback(geoJsonTalhoesLayer);
  const talhoesDemarcacaoNoContexto = useMemo(
    () => geoJsonTalhoesLocalAtivo && geoJsonTalhoesLayer
      ? geoJsonTalhoesLayer.talhoes
      : limitesNoContexto,
    [geoJsonTalhoesLocalAtivo, geoJsonTalhoesLayer, limitesNoContexto]
  );

  const safrasMapas = useMemo(
    () => buildSafraOptions(materiaisTecnicosNoContexto),
    [materiaisTecnicosNoContexto]
  );

  const talhoesMapas = useMemo(
    () => buildOptionsOrdenadas(materiaisTecnicosNoContexto.map(getMapaTalhao)),
    [materiaisTecnicosNoContexto]
  );

  const talhoesLimite = useMemo(
    () => buildOptionsOrdenadas(talhoesDemarcacaoNoContexto.map((limite: any) => limite?.talhao || limite?.nome || '')),
    [talhoesDemarcacaoNoContexto]
  );
  const talhoesPanorama = useMemo(
    () => buildOptionsOrdenadas([...talhoesLimite, ...talhoesMapas]),
    [talhoesLimite, talhoesMapas]
  );
  const pngCategoryOptions = useMemo(
    () => PNG_MAP_PROPERTY_CATEGORY_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.categoria_label,
    })),
    []
  );
  const pngTalhaoOptions = useMemo<Array<{ value: string; label: string; description?: string }>>(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string; description?: string }> = [];

    talhoesDemarcacaoNoContexto
      .forEach((talhao: any) => {
        const nome = typeof talhao?.talhao === 'string' && talhao.talhao.trim()
          ? talhao.talhao.trim()
          : typeof talhao?.nome === 'string'
            ? talhao.nome.trim()
            : '';
        const id = typeof talhao?.id === 'string' && talhao.id.trim()
          ? talhao.id.trim()
          : nome;
        if (!nome || seen.has(id)) return;
        seen.add(id);
        options.push({
          value: id,
          label: nome,
          description: talhao?.area_hectares ? `${talhao.area_hectares} ha` : undefined,
        });
      });

    return options;
  }, [talhoesDemarcacaoNoContexto]);
  const prescriptionZipLayerOptions = useMemo(
    () => PRESCRIPTION_ZIP_LAYER_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      description: 'Prescrição',
    })),
    []
  );

  useEffect(() => {
    if (safraFiltroMapas !== FILTRO_TODOS && !safrasMapas.includes(safraFiltroMapas)) {
      setSafraFiltroMapas(FILTRO_TODOS);
    }
  }, [safrasMapas, safraFiltroMapas]);

  useEffect(() => {
    if (talhaoFiltroMapas !== FILTRO_TODOS && !talhoesPanorama.includes(talhaoFiltroMapas)) {
      setTalhaoFiltroMapas(FILTRO_TODOS);
    }
  }, [talhoesPanorama, talhaoFiltroMapas]);

  useEffect(() => {
    if (talhaoFiltroLimite !== FILTRO_TODOS && !talhoesPanorama.includes(talhaoFiltroLimite)) {
      setTalhaoFiltroLimite(FILTRO_TODOS);
    }
  }, [talhoesPanorama, talhaoFiltroLimite]);

  // ──────────────────────────────────────────────
  // FILTROS DE MATERIAIS
  // ──────────────────────────────────────────────
  const mapasFiltrados = useMemo(() => {
    const termoBusca = normalizarBusca(busca);

    return materiaisTecnicosNoContexto.filter(m => {
      const fazendaInfo = fazendaInfoPorId.get(getMapaFazendaId(m));
      const safraMapa = getMapaSafra(m);
      const talhaoMapa = getMapaTalhao(m);
      const profundidadeMapa = getMapaProfundidade(m);
      const matchCategoria = categoriaAtiva === FILTRO_TODOS || m.categoria === categoriaAtiva;
      const matchSafra = safraFiltroMapas === FILTRO_TODOS || safraMapa === safraFiltroMapas;
      const matchTalhao = talhaoFiltroMapas === FILTRO_TODOS || talhaoMapa === talhaoFiltroMapas;
      const textoBusca = [
        m.titulo,
        m.descricao,
        m.subcategoria,
        m.elemento,
        m.elemento_label,
        m.categoria_label,
        profundidadeMapa,
        m.tipo_material,
        m.tipo_anexo,
        getCategoriaMapaLabel(m.categoria),
        m.categoria === 'correcao' ? 'correcao de solo corretivo calcario gesso' : '',
        m.categoria === 'prescricao' ? 'prescricao taxa variavel zip' : '',
        talhaoMapa,
        safraMapa,
        m.observacoes,
        m.arquivo_nome_original,
        m.origem === 'arquivo_local' ? 'png local anexo local' : '',
        fazendaInfo?.fazendaNome,
        fazendaInfo?.titularNome,
      ].map(normalizarBusca).filter(Boolean).join(' ');
      const matchBusca = !termoBusca || textoBusca.includes(termoBusca);

      return matchCategoria && matchBusca && matchSafra && matchTalhao;
    }).sort((a, b) => {
      if (ordenacao === 'recente') {
        return new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime();
      } else if (ordenacao === 'titulo') {
        return (a.titulo || '').localeCompare(b.titulo || '');
      }
      return 0;
    });
  }, [
    materiaisTecnicosNoContexto,
    fazendaInfoPorId,
    categoriaAtiva,
    busca,
    safraFiltroMapas,
    talhaoFiltroMapas,
    ordenacao,
  ]);

  const mapasPorCategoria = useMemo(() => {
    return CATEGORIAS
      .filter(cat => cat.id !== 'todos')
      .map(cat => ({
        ...cat,
        mapas: mapasFiltrados.filter(m => m.categoria === cat.id)
      }))
      .filter(cat => cat.mapas.length > 0);
  }, [mapasFiltrados]);

  const periodosTalhaoConsulta = useMemo(
    () => selectedTalhao
      ? separarPeriodosPorTalhao(periodosProdutivos, selectedTalhao)
      : { doTalhao: [], daPropriedade: [] },
    [periodosProdutivos, selectedTalhao]
  );
  const cadernosTalhaoConsulta = useMemo(
    () => selectedTalhao ? filtrarRegistrosDoTalhao(cadernos, selectedTalhao) : [],
    [cadernos, selectedTalhao]
  );
  const materiaisTalhaoConsulta = useMemo(
    () => selectedTalhao
      ? separarMateriaisPorTalhao(materiaisTecnicosNoContexto, selectedTalhao)
      : { doTalhao: [], daPropriedade: [] },
    [materiaisTecnicosNoContexto, selectedTalhao]
  );
  const origemDemarcacaoTalhao = getTalhaoOrigemDemarcacaoLabel(
    geoJsonTalhoesLayer?.source,
    geoJsonTalhoesLocalAtivo
  );
  const podeCriarCadernoNoTalhao = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && podeIncluirCadernoEmFazenda(user, contextoConsulta.fazenda);
  const podeGerenciarPeriodoNoTalhao = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && podeGerenciarPeriodoProdutivoEmFazenda(user, contextoConsulta.fazenda);

  // ──────────────────────────────────────────────
  // FILTROS DA DEMARCAÇÃO DO PANORAMA
  // ──────────────────────────────────────────────
  const limitesFiltrados = useMemo(() => {
    const termoBusca = normalizarBusca(busca);

    return talhoesDemarcacaoNoContexto.filter(l => {
      const talhaoLimite = l.talhao || l.nome || '';
      const matchAno = !anoFiltroLimite || l.ano === anoFiltroLimite;
      const matchTalhao = talhaoFiltroLimite === FILTRO_TODOS || talhaoLimite === talhaoFiltroLimite;
      const textoBusca = [
        l.talhao,
        l.nome,
        l.textura,
        l.cultura_atual,
        l.tipo_solo,
        fazendaInfoPorId.get(getLimiteAreaFazendaId(l))?.fazendaNome,
        fazendaInfoPorId.get(getLimiteAreaFazendaId(l))?.titularNome,
      ].map(normalizarBusca).filter(Boolean).join(' ');
      const matchBusca = !termoBusca || textoBusca.includes(termoBusca);

      return matchAno && matchTalhao && matchBusca;
    });
  }, [
    talhoesDemarcacaoNoContexto,
    anoFiltroLimite,
    busca,
    talhaoFiltroLimite,
    fazendaInfoPorId,
  ]);

  useEffect(() => {
    if (selectedTalhao && !limitesFiltrados.some((talhao) => talhao.id === selectedTalhao.id)) {
      setSelectedTalhao(null);
      setTalhaoDetailVisible(false);
    }
  }, [limitesFiltrados, selectedTalhao]);

  const recarregarGeoJsonLocal = useCallback(async (contexto: {
    propriedade_id: string;
    fazenda_id?: string;
    produtor_id?: string;
  }) => {
    const [importsAtualizados, talhoesLayerAtualizada] = await Promise.all([
      listGeoJsonImportsForPropriedade(contexto.propriedade_id),
      loadGeoJsonTalhoesLayer({
        propriedade_id: contexto.propriedade_id,
        fazenda_id: contexto.fazenda_id || contexto.propriedade_id,
        produtor_id: contexto.produtor_id,
      }),
    ]);

    setGeoJsonImports(importsAtualizados);
    setGeoJsonTalhoesLayer(talhoesLayerAtualizada);

    const baseTalhoesParaAno = isGeoJsonTalhoesLayerActive(talhoesLayerAtualizada)
      ? talhoesLayerAtualizada.talhoes
      : limitesNoContexto;
    const anos = [...new Set(baseTalhoesParaAno.map((l: any) => l.ano))]
      .sort((a: any, b: any) => Number(b) - Number(a));

    setAnosDisponiveis(anos);
    setAnoFiltroLimite((anoAtual) => {
      if (anos.length === 0) return null;
      return anoAtual && anos.includes(anoAtual) ? anoAtual : anos[0];
    });

    return {
      imports: importsAtualizados,
      layer: talhoesLayerAtualizada,
    };
  }, [limitesNoContexto]);

  const recarregarPngLocal = useCallback(async (propriedadeId: string) => {
    const importsAtualizados = await listActivePngMapImportsForPropriedade(propriedadeId);
    setPngImports(importsAtualizados);
    return importsAtualizados;
  }, []);

  const recarregarPrescriptionZipLocal = useCallback(async (propriedadeId: string) => {
    const importsAtualizados = await listActivePrescriptionZipImportsForPropriedade(propriedadeId);
    setPrescriptionZipImports(importsAtualizados);
    return importsAtualizados;
  }, []);

  // ──────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────
  const closeImagePreview = () => {
    setImagePreview({ visible: false, mapa: null, source: null, loadError: null });
  };

  const openImagePreview = (mapa, source) => {
    setImagePreview({
      visible: true,
      mapa,
      source,
      loadError: null,
    });
  };

  const openPrescriptionZipDetail = (mapa) => {
    setPrescriptionZipDetail({
      visible: true,
      mapa,
    });
  };

  const closePrescriptionZipDetail = () => {
    setPrescriptionZipDetail({
      visible: false,
      mapa: null,
    });
  };

  const handleImagePreviewError = () => {
    const message = isPngLocalMapa(imagePreview.mapa)
      ? PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE
      : 'Não foi possível carregar este anexo.';

    setImagePreview((current) => ({
      ...current,
      source: null,
      loadError: message,
    }));
    toast.showError(message);
  };

  const resolvePngMetadataFromMapa = useCallback((mapa: any): PngMapImportMetadata | null => {
    const importId = typeof mapa?.png_map_import_id === 'string' && mapa.png_map_import_id.trim()
      ? mapa.png_map_import_id.trim()
      : typeof mapa?.id === 'string' && mapa.id.startsWith('png_local:')
        ? mapa.id.slice('png_local:'.length)
        : '';

    if (!importId) return null;
    return pngImports.find((item) => item.id === importId) ?? null;
  }, [pngImports]);

  const resolvePrescriptionZipMetadataFromMapa = useCallback((mapa: any): PrescriptionZipImportMetadata | null => {
    const importId = typeof mapa?.prescription_zip_import_id === 'string' && mapa.prescription_zip_import_id.trim()
      ? mapa.prescription_zip_import_id.trim()
      : typeof mapa?.id === 'string' && mapa.id.startsWith('zip_local:')
        ? mapa.id.slice('zip_local:'.length)
        : '';

    if (!importId) return null;
    return prescriptionZipImports.find((item) => item.id === importId) ?? null;
  }, [prescriptionZipImports]);

  const handleDownload = async (mapa) => {
    if (isPrescriptionZipLocalMapa(mapa)) {
      openPrescriptionZipDetail(mapa);
      return;
    }

    if (isPngLocalMapa(mapa)) {
      try {
        const result = await resolveMapaPngImageSource(mapa, {
          isSafePngStorageUri: PngStorageService.isSafePngStorageUri,
          getStoredPngInfo: PngStorageService.getStoredPngInfo,
        });

        if (!result.ok || !result.source) {
          toast.showError(result.message || PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE);
          return;
        }

        openImagePreview(mapa, result.source);
      } catch {
        toast.showError(PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE);
      }
      return;
    }

    const status = avaliarDownloadMapa(mapa);

    if (!status.podeAbrir) {
      toast.showInfo(status.descricao);
      return;
    }

    const assetSource = resolveSelaPrataIFertilidadeAssetSource(status.arquivoUrl);
    if (assetSource) {
      openImagePreview(mapa, assetSource);
      return;
    }

    setDownloadDialog({ visible: true, mapa, status });
  };

  const confirmDownload = async () => {
    if (isPrescriptionZipLocalMapa(downloadDialog.mapa)) {
      const mapaSelecionado = downloadDialog.mapa;
      setDownloadDialog({ visible: false, mapa: null, status: null });
      openPrescriptionZipDetail(mapaSelecionado);
      return;
    }

    if (isPngLocalMapa(downloadDialog.mapa)) {
      const mapaSelecionado = downloadDialog.mapa;
      setDownloadDialog({ visible: false, mapa: null, status: null });
      await handleDownload(mapaSelecionado);
      return;
    }

    const status = downloadDialog.status || avaliarDownloadMapa(downloadDialog.mapa);
    setDownloadDialog({ visible: false, mapa: null, status: null });

    if (!status.podeAbrir || !status.arquivoUrl) {
      toast.showInfo(status.descricao);
      return;
    }

    const assetSource = resolveSelaPrataIFertilidadeAssetSource(status.arquivoUrl);
    if (assetSource) {
      openImagePreview(downloadDialog.mapa, assetSource);
      return;
    }

    if (status.arquivoUrl.startsWith('asset://')) {
      toast.showError('Não foi possível localizar o asset interno deste material.');
      return;
    }

    try {
      await Linking.openURL(status.arquivoUrl);
    } catch (error) {
      toast.showError('Não foi possível abrir o material informado.');
    }
  };

  const handleTalhaoPress = useCallback((talhao) => {
    setSelectedTalhao(talhao);
    setTalhaoDetailVisible(true);
  }, []);

  const handleNovoCadernoTalhao = useCallback((talhao = selectedTalhao) => {
    if (!consultaPorFazenda || !contextoConsulta.fazenda || !talhao) {
      toast.showInfo('Abra uma Propriedade para registrar Caderno no Talhão.');
      return;
    }

    if (!podeIncluirCadernoEmFazenda(user, contextoConsulta.fazenda)) {
      toast.showWarning('Você não tem permissão para registrar Caderno neste Talhão.');
      return;
    }

    const params = buildPropriedadeContextRouteParams(contextoConsulta.fazenda);
    if (!params) return;

    const talhaoNome = getTalhaoConsultaNome(talhao);
    const talhaoId = getTalhaoConsultaId(talhao);
    setTalhaoDetailVisible(false);
    navigation.navigate('NovoCaderno', {
      ...params,
      talhaoId,
      talhao_id: talhaoId,
      talhaoNome,
      talhao: talhaoNome,
    });
  }, [consultaPorFazenda, contextoConsulta.fazenda, navigation, selectedTalhao, toast, user]);

  const handleNovoPeriodoTalhao = useCallback((talhao = selectedTalhao) => {
    if (!consultaPorFazenda || !contextoConsulta.fazenda || !talhao) {
      toast.showInfo('Abra uma Propriedade para criar Safra/Safrinha no Talhão.');
      return;
    }

    if (!podeGerenciarPeriodoProdutivoEmFazenda(user, contextoConsulta.fazenda)) {
      toast.showWarning('Você não tem permissão para gerenciar Safra/Safrinha neste Talhão.');
      return;
    }

    const fazendaInfo = getFazendaUiInfo(contextoConsulta.fazenda);
    const talhaoNome = getTalhaoConsultaNome(talhao);
    const talhaoId = getTalhaoConsultaId(talhao);
    setTalhaoDetailVisible(false);
    navigation.navigate('NovoPeriodoProdutivo', {
      fazendaId: fazendaInfo.id,
      produtorId: fazendaInfo.id,
      propriedadeId: fazendaInfo.id,
      talhaoId,
      talhao_id: talhaoId,
      talhaoNome,
      talhao: talhaoNome,
    });
  }, [consultaPorFazenda, contextoConsulta.fazenda, navigation, selectedTalhao, toast, user]);

  const handleFiltrarMateriaisTalhao = useCallback((talhao = selectedTalhao) => {
    const talhaoNome = getTalhaoConsultaNome(talhao);
    if (!talhaoNome) return;
    setTalhaoFiltroMapas(talhaoNome);
    setTalhaoFiltroLimite(talhaoNome);
    setCategoriaAtiva(FILTRO_TODOS);
    setTalhaoDetailVisible(false);
  }, [selectedTalhao]);

  const handleVerTalhaoNoMapa = useCallback((talhao = selectedTalhao) => {
    if (!contextoConsulta.fazenda || !talhao) return;

    const talhaoNome = getTalhaoConsultaNome(talhao);
    const params = buildFazendaMapaRouteParamsFromPropriedade(contextoConsulta.fazenda, {
      talhaoId: getTalhaoConsultaId(talhao),
      talhaoNome,
      talhao: talhaoNome,
      talhaoAno: talhao?.ano ? String(talhao.ano) : undefined,
    });

    setTalhaoDetailVisible(false);
    navigation.navigate('FazendaMapa', params);
  }, [contextoConsulta.fazenda, navigation, selectedTalhao]);

  const handleAbrirCadernoTalhao = useCallback((registro) => {
    if (!registro?.id) return;
    setTalhaoDetailVisible(false);
    navigation.navigate('CadernoDetail', { cadernoId: registro.id });
  }, [navigation]);

  const handleTalhaoFiltroChange = (talhao) => {
    setTalhaoFiltroMapas(talhao);
    setTalhaoFiltroLimite(talhao);
  };

  const limparFiltrosPanorama = () => {
    setCategoriaAtiva(FILTRO_TODOS);
    setSafraFiltroMapas(FILTRO_TODOS);
    setTalhaoFiltroMapas(FILTRO_TODOS);
    setTalhaoFiltroLimite(FILTRO_TODOS);
    setAnoFiltroLimite(null);
    setBusca('');
    if (!consultaPorFazenda) {
      setFazendaFiltroOperacional(FILTRO_TODOS);
    }
  };

  const handleAnexarGeoJson = async (mode: GeoJsonImportMode = 'attach') => {
    if (!podeAnexarGeoJson || !contextoConsulta.fazenda) {
      toast.showInfo('Abra uma Propriedade dentro do seu escopo para anexar GeoJSON.');
      return;
    }

    setGeoJsonPreviewMode(mode);
    setGeoJsonImporting(true);
    try {
      const result = await prepareGeoJsonPropertyImport({
        user,
        propriedade: contextoConsulta.fazenda,
      });

      if (!result.ok || !result.preview) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível validar o GeoJSON selecionado.');
        }
        return;
      }

      setGeoJsonPreview(result.preview);
    } catch (error) {
      toast.showError('Não foi possível preparar o GeoJSON selecionado.');
    } finally {
      setGeoJsonImporting(false);
    }
  };

  const handleCancelarGeoJsonPreview = () => {
    if (geoJsonConfirming) return;
    setGeoJsonPreview(null);
    setGeoJsonPreviewMode('attach');
  };

  const handleConfirmarGeoJsonPreview = async () => {
    if (!geoJsonPreview) return;

    setGeoJsonConfirming(true);
    try {
      const isReplacing = geoJsonPreviewMode === 'replace';
      const result = isReplacing
        ? await replaceGeoJsonForPropriedade(geoJsonPreview, {
            selaPrataConfirmed: true,
          })
        : await confirmGeoJsonPropertyImport(geoJsonPreview, {
            selaPrataConfirmed: true,
          });

      if (!result.ok) {
        toast.showError(result.error?.message || (
          isReplacing
            ? 'Não foi possível substituir o GeoJSON local.'
            : 'Não foi possível associar o GeoJSON à Propriedade.'
        ));
        return;
      }

      const resolvedContext = geoJsonPreview.resolvedContext;
      setGeoJsonPreview(null);
      setGeoJsonPreviewMode('attach');

      let talhoesLayerAtualizada: GeoJsonTalhoesLayerResult | null = null;
      let recarregouCamada = false;
      try {
        const recarregamento = await recarregarGeoJsonLocal({
          propriedade_id: resolvedContext.propriedade_id,
          fazenda_id: resolvedContext.fazenda_id,
          produtor_id: resolvedContext.produtor_id,
        });
        talhoesLayerAtualizada = recarregamento.layer;
        recarregouCamada = true;
      } catch {
        toast.showWarning('GeoJSON salvo, mas não foi possível recarregar a camada agora.');
      }

      toast.showSuccess(isReplacing ? 'GeoJSON local substituído.' : 'GeoJSON anexado à Propriedade.');
      if ((result as any).warnings?.length > 0) {
        toast.showWarning((result as any).warnings[0].message);
      }
      if (recarregouCamada && isGeoJsonTalhoesLayerActive(talhoesLayerAtualizada)) {
        toast.showInfo('Talhões carregados do GeoJSON local.');
      }
    } catch (error) {
      toast.showError(
        geoJsonPreviewMode === 'replace'
          ? 'Não foi possível concluir a substituição do GeoJSON.'
          : 'Não foi possível concluir a associação do GeoJSON.'
      );
    } finally {
      setGeoJsonConfirming(false);
    }
  };

  const handleSolicitarSubstituirGeoJson = () => {
    if (!geoJsonImportAtivo) return;
    setGeoJsonManageDialog({
      visible: true,
      action: 'replace',
      loading: false,
    });
  };

  const handleSolicitarRemoverGeoJson = () => {
    if (!geoJsonImportAtivo) return;
    setGeoJsonManageDialog({
      visible: true,
      action: 'remove',
      loading: false,
    });
  };

  const handleCancelarGeoJsonManageDialog = () => {
    if (geoJsonManageDialog.loading) return;
    setGeoJsonManageDialog({
      visible: false,
      action: null,
      loading: false,
    });
  };

  const handleConfirmarGeoJsonManageDialog = async () => {
    if (geoJsonManageDialog.action === 'replace') {
      setGeoJsonManageDialog({
        visible: false,
        action: null,
        loading: false,
      });
      await handleAnexarGeoJson('replace');
      return;
    }

    if (geoJsonManageDialog.action !== 'remove' || !contextoConsulta.fazenda) {
      handleCancelarGeoJsonManageDialog();
      return;
    }

    setGeoJsonManageDialog((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      const result = await removeActiveGeoJsonForPropriedade({
        user,
        propriedade: contextoConsulta.fazenda,
        activeMetadata: geoJsonImportAtivo,
      });

      if (!result.ok) {
        toast.showError(result.error?.message || 'Não foi possível remover o GeoJSON local.');
        return;
      }

      const metadataContexto = result.metadata || result.activeMetadata || geoJsonImportAtivo;
      if (metadataContexto) {
        await recarregarGeoJsonLocal({
          propriedade_id: metadataContexto.propriedade_id,
          fazenda_id: metadataContexto.fazenda_id,
        });
      } else {
        await loadDados();
      }
      setSelectedTalhao(null);
      setTalhaoDetailVisible(false);

      toast.showSuccess('GeoJSON local removido da Propriedade.');
      if (result.warnings && result.warnings.length > 0) {
        toast.showWarning(result.warnings[0].message);
      } else {
        toast.showInfo('Exibindo demarcação disponível.');
      }
    } catch (error) {
      toast.showError('Não foi possível concluir a remoção do GeoJSON local.');
    } finally {
      setGeoJsonManageDialog({
        visible: false,
        action: null,
        loading: false,
      });
    }
  };

  const handleSolicitarSubstituirPng = () => {
    if (
      !contextoConsulta.fazenda
      || !canManagePngMapItem(user, contextoConsulta.fazenda, imagePreview.mapa)
    ) {
      toast.showInfo('Abra um PNG local de uma Propriedade dentro do seu escopo para substituir.');
      return;
    }

    setPngManageDialog({
      visible: true,
      action: 'replace',
      loading: false,
    });
  };

  const handleSolicitarRemoverPng = () => {
    if (
      !contextoConsulta.fazenda
      || !canManagePngMapItem(user, contextoConsulta.fazenda, imagePreview.mapa)
    ) {
      toast.showInfo('Abra um PNG local de uma Propriedade dentro do seu escopo para remover.');
      return;
    }

    setPngManageDialog({
      visible: true,
      action: 'remove',
      loading: false,
    });
  };

  const handleCancelarPngManageDialog = () => {
    if (pngManageDialog.loading) return;
    setPngManageDialog({
      visible: false,
      action: null,
      loading: false,
    });
  };

  const handleConfirmarPngManageDialog = async () => {
    const action = pngManageDialog.action;
    const mapaSelecionado = imagePreview.mapa;
    const propriedade = contextoConsulta.fazenda;

    if (
      !action
      || !propriedade
      || !canManagePngMapItem(user, propriedade, mapaSelecionado)
    ) {
      handleCancelarPngManageDialog();
      return;
    }

    const metadata = resolvePngMetadataFromMapa(mapaSelecionado);

    setPngManageDialog({
      visible: action === 'remove',
      action,
      loading: true,
    });

    try {
      const result = action === 'replace'
        ? await replacePngMapForPropriedade({
            user,
            propriedade,
            mapa: mapaSelecionado,
            metadata,
          })
        : await removePngMapForPropriedade({
            user,
            propriedade,
            mapa: mapaSelecionado,
            metadata,
          });

      if (!result.ok) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível gerenciar o PNG local.');
        }
        return;
      }

      const resultado = result as any;
      if (Array.isArray(resultado.imports)) {
        setPngImports(resultado.imports);
      }

      const metadataContexto = resultado.metadata
        || resultado.activeMetadata
        || resultado.previousMetadata
        || metadata;
      const propriedadeId = metadataContexto?.propriedade_id || getFazendaId(propriedade);

      if (propriedadeId) {
        try {
          await recarregarPngLocal(propriedadeId);
        } catch {
          toast.showWarning('A ação foi concluída, mas não foi possível recarregar o resumo local agora.');
        }
      } else {
        await loadDados();
      }

      closeImagePreview();
      toast.showSuccess(action === 'replace' ? 'PNG local substituído.' : 'PNG local removido.');
      if (resultado.warnings?.length > 0) {
        toast.showWarning(resultado.warnings[0].message);
      }
    } catch {
      toast.showError(
        action === 'replace'
          ? 'Não foi possível concluir a substituição do PNG local.'
          : 'Não foi possível concluir a remoção do PNG local.'
      );
    } finally {
      setPngManageDialog({
        visible: false,
        action: null,
        loading: false,
      });
    }
  };

  const handleSolicitarSubstituirPrescriptionZip = () => {
    if (
      !contextoConsulta.fazenda
      || !canManagePrescriptionZipItem(user, contextoConsulta.fazenda, prescriptionZipDetail.mapa)
    ) {
      toast.showInfo('Abra uma prescrição local de uma Propriedade dentro do seu escopo para substituir.');
      return;
    }

    setPrescriptionZipManageDialog({
      visible: true,
      action: 'replace',
      loading: false,
    });
  };

  const handleSolicitarRemoverPrescriptionZip = () => {
    if (
      !contextoConsulta.fazenda
      || !canManagePrescriptionZipItem(user, contextoConsulta.fazenda, prescriptionZipDetail.mapa)
    ) {
      toast.showInfo('Abra uma prescrição local de uma Propriedade dentro do seu escopo para remover.');
      return;
    }

    setPrescriptionZipManageDialog({
      visible: true,
      action: 'remove',
      loading: false,
    });
  };

  const handleCancelarPrescriptionZipManageDialog = () => {
    if (prescriptionZipManageDialog.loading) return;
    setPrescriptionZipManageDialog({
      visible: false,
      action: null,
      loading: false,
    });
  };

  const handleConfirmarPrescriptionZipManageDialog = async () => {
    const action = prescriptionZipManageDialog.action;
    const mapaSelecionado = prescriptionZipDetail.mapa;
    const propriedade = contextoConsulta.fazenda;

    if (
      !action
      || !propriedade
      || !canManagePrescriptionZipItem(user, propriedade, mapaSelecionado)
    ) {
      handleCancelarPrescriptionZipManageDialog();
      return;
    }

    const metadata = resolvePrescriptionZipMetadataFromMapa(mapaSelecionado);

    setPrescriptionZipManageDialog({
      visible: action === 'remove',
      action,
      loading: true,
    });

    try {
      const result = action === 'replace'
        ? await replacePrescriptionZipForPropriedade({
            user,
            propriedade,
            mapa: mapaSelecionado,
            metadata,
          })
        : await removePrescriptionZipForPropriedade({
            user,
            propriedade,
            mapa: mapaSelecionado,
            metadata,
          });

      if (!result.ok) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível gerenciar a prescrição local.');
        }
        return;
      }

      const resultado = result as any;
      if (Array.isArray(resultado.imports)) {
        setPrescriptionZipImports(resultado.imports);
      }

      const metadataContexto = resultado.metadata
        || resultado.activeMetadata
        || resultado.previousMetadata
        || metadata;
      const propriedadeId = metadataContexto?.propriedade_id || getFazendaId(propriedade);

      if (propriedadeId) {
        try {
          await recarregarPrescriptionZipLocal(propriedadeId);
        } catch {
          toast.showWarning('A ação foi concluída, mas não foi possível recarregar o resumo local agora.');
        }
      } else {
        await loadDados();
      }

      closePrescriptionZipDetail();
      toast.showSuccess(action === 'replace' ? 'Prescrição local substituída.' : 'Prescrição local removida.');
      if (resultado.warnings?.length > 0) {
        toast.showWarning(resultado.warnings[0].message);
      }
    } catch {
      toast.showError(
        action === 'replace'
          ? 'Não foi possível concluir a substituição da prescrição local.'
          : 'Não foi possível concluir a remoção da prescrição local.'
      );
    } finally {
      setPrescriptionZipManageDialog({
        visible: false,
        action: null,
        loading: false,
      });
    }
  };

  const updatePngForm = (patch: Partial<PngMapPropertyImportFormInput>) => {
    setPngForm((current) => ({
      ...current,
      ...patch,
    }));
    setPngFormErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => {
        delete next[key];
      });
      if ('talhao_id' in patch || 'talhao_nome' in patch || 'escopo' in patch) {
        delete next.talhao;
      }
      return next;
    });
  };

  const handlePngTalhaoChange = (talhaoId: string) => {
    const option = pngTalhaoOptions.find((item: any) => item?.value === talhaoId) as any;
    updatePngForm({
      talhao_id: talhaoId,
      talhao_nome: option?.label || '',
    });
  };

  const handleAnexarPng = async () => {
    if (!podeAnexarPng || !contextoConsulta.fazenda) {
      toast.showInfo('Abra uma Propriedade dentro do seu escopo para anexar PNG.');
      return;
    }

    setPngImporting(true);
    try {
      const result = await preparePngMapPropertyImport({
        user,
        propriedade: contextoConsulta.fazenda,
      });

      if (!result.ok || !result.preview) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível validar o PNG selecionado.');
        }
        return;
      }

      setPngPreview(result.preview);
      setPngForm({
        ...EMPTY_PNG_FORM,
        ...result.preview.form,
        ano: result.preview.form.ano ? String(result.preview.form.ano) : '',
      });
      setPngFormErrors({});
    } catch (error) {
      toast.showError('Não foi possível preparar o PNG selecionado.');
    } finally {
      setPngImporting(false);
    }
  };

  const handleCancelarPngPreview = () => {
    if (pngConfirming) return;
    setPngPreview(null);
    setPngForm(EMPTY_PNG_FORM);
    setPngFormErrors({});
  };

  const handleConfirmarPngPreview = async () => {
    if (!pngPreview) return;

    setPngConfirming(true);
    try {
      const result = await confirmPngMapPropertyImport(pngPreview, pngForm);

      if (!result.ok) {
        if (result.error?.code === 'FORM_INVALID') {
          setPngFormErrors((result.error.details as Record<string, string>) || {});
          toast.showError('Revise os campos obrigatórios do mapa PNG.');
          return;
        }

        toast.showError(result.error?.message || 'Não foi possível anexar o mapa PNG.');
        return;
      }

      setPngPreview(null);
      setPngForm(EMPTY_PNG_FORM);
      setPngFormErrors({});
      setPngImports(result.imports || (result.metadata ? [result.metadata] : []));

      try {
        await recarregarPngLocal(pngPreview.resolvedContext.propriedade_id);
      } catch {
        toast.showWarning('PNG salvo, mas não foi possível recarregar o resumo local agora.');
      }

      toast.showSuccess('Mapa PNG anexado à Propriedade.');
      toast.showInfo('PNG local também aparece na listagem principal de materiais.');
      if (result.warnings && result.warnings.length > 0) {
        toast.showWarning(result.warnings[0].message);
      }
    } catch (error) {
      toast.showError('Não foi possível concluir o anexo do PNG.');
    } finally {
      setPngConfirming(false);
    }
  };

  const updatePrescriptionZipForm = (patch: Partial<PrescriptionZipPropertyImportFormInput>) => {
    setPrescriptionZipForm((current) => ({
      ...current,
      ...patch,
    }));
    setPrescriptionZipFormErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => {
        delete next[key];
      });
      if ('talhao_id' in patch || 'talhao_nome' in patch || 'escopo' in patch) {
        delete next.talhao;
      }
      return next;
    });
  };

  const handlePrescriptionZipTalhaoChange = (talhaoId: string) => {
    const option = pngTalhaoOptions.find((item: any) => item?.value === talhaoId) as any;
    updatePrescriptionZipForm({
      talhao_id: talhaoId,
      talhao_nome: option?.label || '',
    });
  };

  const handleAnexarPrescriptionZip = async () => {
    if (!podeAnexarPrescriptionZip || !contextoConsulta.fazenda) {
      toast.showInfo('Abra uma Propriedade dentro do seu escopo para anexar prescrição.');
      return;
    }

    setPrescriptionZipImporting(true);
    try {
      const result = await preparePrescriptionZipPropertyImport({
        user,
        propriedade: contextoConsulta.fazenda,
      });

      if (!result.ok || !result.preview) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível validar o ZIP selecionado.');
        }
        return;
      }

      setPrescriptionZipPreview(result.preview);
      setPrescriptionZipForm({
        ...EMPTY_PRESCRIPTION_ZIP_FORM,
        ...result.preview.form,
        ano: result.preview.form.ano ? String(result.preview.form.ano) : '',
      });
      setPrescriptionZipFormErrors({});
    } catch {
      toast.showError('Não foi possível preparar o ZIP selecionado.');
    } finally {
      setPrescriptionZipImporting(false);
    }
  };

  const handleCancelarPrescriptionZipPreview = () => {
    if (prescriptionZipConfirming) return;
    setPrescriptionZipPreview(null);
    setPrescriptionZipForm(EMPTY_PRESCRIPTION_ZIP_FORM);
    setPrescriptionZipFormErrors({});
  };

  const handleConfirmarPrescriptionZipPreview = async () => {
    if (!prescriptionZipPreview) return;

    setPrescriptionZipConfirming(true);
    try {
      const result = await confirmPrescriptionZipPropertyImport(
        prescriptionZipPreview,
        prescriptionZipForm
      );

      if (!result.ok) {
        if (result.error?.code === 'FORM_INVALID') {
          setPrescriptionZipFormErrors((result.error.details as Record<string, string>) || {});
          toast.showError('Revise os campos obrigatórios da prescrição.');
          return;
        }

        toast.showError(result.error?.message || 'Não foi possível anexar a prescrição.');
        return;
      }

      setPrescriptionZipPreview(null);
      setPrescriptionZipForm(EMPTY_PRESCRIPTION_ZIP_FORM);
      setPrescriptionZipFormErrors({});
      setPrescriptionZipImports(result.imports || (result.metadata ? [result.metadata] : []));

      try {
        await recarregarPrescriptionZipLocal(prescriptionZipPreview.resolvedContext.propriedade_id);
      } catch {
        toast.showWarning('Prescrição salva, mas não foi possível recarregar o resumo local agora.');
      }

      toast.showSuccess('Prescrição ZIP anexada à Propriedade.');
      toast.showInfo('A prescrição aparece em Material técnico sem abrir ou processar o ZIP.');
      if (result.warnings && result.warnings.length > 0) {
        toast.showWarning(result.warnings[0].message);
      }
    } catch {
      toast.showError('Não foi possível concluir o anexo da prescrição.');
    } finally {
      setPrescriptionZipConfirming(false);
    }
  };

  const tituloTela = 'Material técnico';
  const contextoLabel = consultaPorFazenda
    ? isProdutorView ? 'Consulta da Propriedade' : 'Consulta por propriedade'
    : fazendaFiltroInfo
      ? 'Visão geral filtrada'
      : 'Visão geral';
  const contextoTitulo = fazendaContextoInfo?.fazendaNome
    || fazendaFiltroInfo?.fazendaNome
    || 'Todas as propriedades acessíveis';
  const contextoSubtitulo = fazendaContextoInfo || fazendaFiltroInfo
    ? [
        (fazendaContextoInfo || fazendaFiltroInfo)?.titularNome
          ? `Titular: ${(fazendaContextoInfo || fazendaFiltroInfo)?.titularNome}`
          : null,
        (fazendaContextoInfo || fazendaFiltroInfo)?.localizacao,
      ].filter(Boolean).join(' • ')
    : `${contextoConsulta.fazendasPermitidas.length} propriedade${contextoConsulta.fazendasPermitidas.length !== 1 ? 's' : ''} no escopo atual`;
  const mapaSateliteFazendaInfo = fazendaContextoInfo || fazendaFiltroInfo;
  const temFiltroPanoramaAtivo = categoriaAtiva !== FILTRO_TODOS
    || safraFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroLimite !== FILTRO_TODOS
    || !!anoFiltroLimite
    || busca.trim().length > 0
    || !!fazendaFiltroInfo;
  const temFiltroMaterialAtivo = categoriaAtiva !== FILTRO_TODOS
    || safraFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroMapas !== FILTRO_TODOS
    || busca.trim().length > 0
    || !!fazendaFiltroInfo;
  const talhaoFiltroAtual = talhaoFiltroLimite !== FILTRO_TODOS
    ? talhaoFiltroLimite
    : talhaoFiltroMapas;
  const areaLimitesFiltrados = limitesFiltrados
    .reduce((s, l) => s + (l.area_hectares || 0), 0)
    .toFixed(1);
  const categoriasNoContexto = new Set(
    materiaisTecnicosNoContexto.map((mapa) => mapa.categoria).filter(Boolean)
  );
  const categoriaUnicaNoContexto = categoriasNoContexto.size === 1
    ? Array.from(categoriasNoContexto)[0]
    : '';
  const categoriaSecao = categoriaAtiva !== FILTRO_TODOS
    ? categoriaAtiva
    : categoriaUnicaNoContexto;
  const categoriaSecaoLabel = categoriaSecao ? getCategoriaMapaLabel(categoriaSecao) : '';
  const tituloSecaoMateriais = 'Material técnico';
  const subtituloSecaoMateriais = categoriaSecaoLabel
    ? `${categoriaSecaoLabel} disponível no contexto da Propriedade.`
    : 'Fertilidade, correção de solo e prescrição disponíveis para consulta.';
  const categoriaOptions = useMemo(
    () => CATEGORIAS.map((cat) => ({
      value: cat.id,
      label: cat.nome,
      icon: cat.icon as any,
    })),
    []
  );
  const ordenacaoOptions = useMemo(
    () => ORDENACOES_MATERIAIS.map((item) => ({
      value: item.key,
      label: item.label,
      icon: item.icon as any,
    })),
    []
  );
  const fazendaFiltroOptions = useMemo(
    () => [
      { value: FILTRO_TODOS, label: 'Todas' },
      ...fazendaOptions.map((fazenda) => ({
        value: fazenda.id,
        label: fazenda.label,
      })),
    ],
    [fazendaOptions]
  );
  const talhaoFiltroOptions = useMemo(
    () => [
      { value: FILTRO_TODOS, label: 'Todos' },
      ...talhoesPanorama.map((talhao) => ({
        value: talhao,
        label: talhao,
      })),
    ],
    [talhoesPanorama]
  );
  const safraFiltroOptions = useMemo(
    () => [
      { value: FILTRO_TODOS, label: 'Todas' },
      ...safrasMapas.map((safra) => ({
        value: safra,
        label: safra,
      })),
    ],
    [safrasMapas]
  );

  const mensagemBloqueio = estadoBloqueio === 'acesso_negado'
    ? {
        icon: 'lock-closed-outline',
        title: 'Acesso negado',
        text: 'Esta propriedade não está disponível no seu escopo de acesso.',
      }
    : {
        icon: 'alert-circle-outline',
        title: 'Propriedade não encontrada',
        text: 'Não foi possível localizar a propriedade informada para consultar o panorama.',
      };

  // ──────────────────────────────────────────────
  // FORMATADORES
  // ──────────────────────────────────────────────
  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarTamanhoArquivo = (bytes?: number) => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return 'Não informado';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatoArquivo = (mapa) =>
    typeof mapa?.formato_arquivo === 'string' ? mapa.formato_arquivo.trim().toLowerCase() : '';

  const isFormatoImagem = (formato) => ['png', 'jpg', 'jpeg'].includes(formato);

  const formatarTipoMaterial = (tipo) => {
    if (tipo === 'diagnostico') return 'Diagnóstico';
    return typeof tipo === 'string' && tipo.trim() ? tipo.trim() : '';
  };

  const getIconeFormato = (formato) => {
    switch (formato) {
      case 'pdf': return 'document-text';
      case 'dwg': return 'hammer';
      case 'jpg':
      case 'png': return 'image';
      case 'shp':
      case 'kml': return 'map';
      case 'geotiff': return 'layers';
      default: return 'document';
    }
  };

  const renderMapaMetaChip = (icon, label, value) => {
    if (!value) return null;

    return (
      <View key={label} style={styles.mapaMetaChip}>
        <Ionicons name={icon as any} size={13} color={colors.primary} />
        <View style={styles.mapaMetaTextos}>
          <Text style={styles.mapaMetaLabel}>{label}</Text>
          <Text style={styles.mapaMetaValor} numberOfLines={1}>{value}</Text>
        </View>
      </View>
    );
  };

  const getImagePreviewTipoLabel = (mapa) => {
    if (isProdutorView && (isPngLocalMapa(mapa) || mapa?.tipo_anexo === 'anexo_fertilidade')) {
      return 'Anexo técnico';
    }
    if (isPngLocalMapa(mapa)) return 'PNG local';
    if (mapa?.tipo_anexo === 'anexo_fertilidade') return 'Anexo de fertilidade';
    if (mapa?.categoria === 'correcao') return 'Mapa de correção de solo';
    if (mapa?.categoria === 'prescricao') return 'Prescrição';
    return 'Material técnico';
  };

  const getMaterialTipoLabel = (mapa) => {
    if (isPrescriptionZipLocalMapa(mapa)) return 'Prescrição';
    if (isProdutorView && (isPngLocalMapa(mapa) || mapa?.tipo_anexo === 'anexo_fertilidade')) {
      return 'Anexo técnico';
    }
    if (isPngLocalMapa(mapa)) {
      return mapa?.categoria === 'correcao' ? 'Mapa de correção de solo' : 'Mapa de fertilidade';
    }
    if (mapa?.tipo_anexo === 'anexo_fertilidade') return 'Mapa de fertilidade';
    if (mapa?.categoria === 'correcao') return 'Mapa de correção de solo';
    if (mapa?.categoria === 'prescricao') return 'Prescrição';
    return 'Arquivo técnico';
  };

  const buildImagePreviewMetaItems = (mapa) => {
    if (!mapa) return [];

    const elementoLabel = getMapaElementoLabel(mapa) || mapa?.categoria_label || mapa?.subcategoria;
    const safraMapa = getMapaSafra(mapa);
    const talhaoMapa = getMapaTalhao(mapa);
    const profundidadeMapa = getMapaProfundidade(mapa);
    const arquivoNomeOriginal = getMapaArquivoNomeOriginal(mapa);

    return [
      { icon: 'image-outline', label: 'Tipo', value: getImagePreviewTipoLabel(mapa) },
      { icon: 'layers-outline', label: 'Camada', value: elementoLabel },
      { icon: 'calendar-outline', label: 'Safra/ano', value: safraMapa },
      { icon: 'location-outline', label: 'Talhão', value: talhaoMapa },
      { icon: 'resize-outline', label: 'Profundidade', value: profundidadeMapa },
      { icon: 'document-attach-outline', label: 'Nome original', value: arquivoNomeOriginal },
    ].filter((item) => item.value);
  };

  const buildPrescriptionZipMetaItems = (mapa) => {
    if (!mapa) return [];

    const camadaLabel = getMapaElementoLabel(mapa) || mapa?.camada_label || mapa?.subcategoria;
    const safraMapa = getMapaSafra(mapa);
    const talhaoMapa = getMapaTalhao(mapa);
    const arquivoNomeOriginal = getMapaArquivoNomeOriginal(mapa);
    const tamanhoArquivo = mapa?.tamanho_arquivo
      ? formatarTamanhoArquivo(mapa.tamanho_arquivo)
      : '';

    return [
      { icon: 'archive-outline', label: 'Tipo', value: 'Prescrição' },
      { icon: 'layers-outline', label: 'Camada', value: camadaLabel },
      { icon: 'calendar-outline', label: 'Safra/ano', value: safraMapa },
      { icon: 'location-outline', label: 'Talhão', value: talhaoMapa },
      { icon: 'document-attach-outline', label: 'Nome original', value: arquivoNomeOriginal },
      { icon: 'server-outline', label: 'Tamanho', value: tamanhoArquivo },
      { icon: 'file-tray-full-outline', label: 'Formato', value: 'ZIP' },
    ].filter((item) => item.value);
  };

  const renderImagePreviewMetaChip = (item) => (
    <View key={item.label} style={styles.imagePreviewMetaChip}>
      <Ionicons name={item.icon as any} size={13} color={colors.primary} />
      <View style={styles.imagePreviewMetaTextos}>
        <Text style={styles.imagePreviewMetaLabel}>{item.label}</Text>
        <Text style={styles.imagePreviewMetaValue} numberOfLines={1}>{item.value}</Text>
      </View>
    </View>
  );

  // ──────────────────────────────────────────────
  // RENDER: Card de Mapa
  // ──────────────────────────────────────────────
  const renderMapaCard = (mapa) => {
    const safraMapa = getMapaSafra(mapa);
    const elementoLabel = getMapaElementoLabel(mapa);
    const profundidadeMapa = getMapaProfundidade(mapa);
    const talhaoMapa = getMapaTalhao(mapa);
    const arquivoNomeOriginal = getMapaArquivoNomeOriginal(mapa);
    const statusDownload = avaliarDownloadMapa(mapa);
    const formatoArquivo = getFormatoArquivo(mapa);
    const isImagemAnexo = isFormatoImagem(formatoArquivo);
    const isPngLocal = isPngLocalMapa(mapa);
    const isPrescriptionZip = isPrescriptionZipLocalMapa(mapa);
    const isAnexoFertilidade = mapa?.tipo_anexo === 'anexo_fertilidade';
    const tipoArquivoLabel = getMaterialTipoLabel(mapa);
    const abrirMaterialLabel = isPngLocal
      ? 'Abrir anexo'
      : isPrescriptionZip
      ? 'Ver detalhes'
      : statusDownload.podeAbrir
      ? isAnexoFertilidade
        ? 'Abrir anexo'
        : 'Abrir material'
      : 'Arquivo não disponível';
    const tipoMaterialLabel = isPngLocal
      ? isProdutorView ? '' : 'Imagem local'
      : isPrescriptionZip
      ? isProdutorView ? '' : 'ZIP local'
      : formatarTipoMaterial(mapa.tipo_material);
    const podeAcionarMapa = isPngLocal || isPrescriptionZip || statusDownload.podeAbrir;
    const indicadorDisponivel = isPngLocal || isPrescriptionZip || statusDownload.podeAbrir;
    const fazendaMapaInfo = fazendaInfoPorId.get(getMapaFazendaId(mapa))
      || fazendaContextoInfo
      || fazendaFiltroInfo;
    const mapaMetaChips = [
      renderMapaMetaChip('layers-outline', 'Camada', elementoLabel),
      renderMapaMetaChip('resize-outline', 'Profundidade', profundidadeMapa),
      renderMapaMetaChip('calendar-outline', 'Safra/ano', safraMapa || formatarData(mapa.data_criacao)),
      renderMapaMetaChip('location-outline', 'Talhão', talhaoMapa),
      renderMapaMetaChip('home-outline', 'Propriedade', fazendaMapaInfo?.fazendaNome),
      renderMapaMetaChip('document-attach-outline', 'Nome original', arquivoNomeOriginal),
    ].filter(Boolean);

    return (
      <TouchableOpacity 
        key={mapa.id} 
        style={styles.mapaCard}
        onPress={podeAcionarMapa ? () => handleDownload(mapa) : undefined}
        activeOpacity={podeAcionarMapa ? 0.7 : 1}
      >
      <View style={styles.mapaHeader}>
        <View style={styles.mapaIconContainer}>
          <Ionicons 
            name={getIconeFormato(formatoArquivo)}
            size={28} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.mapaInfo}>
          <Text style={styles.mapaTitulo} numberOfLines={2}>{mapa.titulo}</Text>
          <View style={styles.mapaTipoLinha}>
            <View style={[styles.mapaTipoTag, isImagemAnexo && styles.mapaTipoTagImagem]}>
              <Ionicons
                name={isPrescriptionZip ? 'archive-outline' : isImagemAnexo ? 'image-outline' : 'document-outline'}
                size={13}
                color={isPrescriptionZip ? colors.primary : isImagemAnexo ? colors.info : colors.primary}
              />
              <Text style={[styles.mapaTipoTexto, isImagemAnexo && styles.mapaTipoTextoImagem]}>
                {tipoArquivoLabel}
              </Text>
            </View>
            {tipoMaterialLabel ? (
              <Text style={styles.mapaSubcategoria}>{tipoMaterialLabel}</Text>
            ) : null}
          </View>
          {mapa.observacoes && (
            <Text style={styles.mapaObservacao} numberOfLines={2}>{mapa.observacoes}</Text>
          )}
          {fazendaMapaInfo && (
            <Text style={styles.mapaContexto} numberOfLines={1}>
              Propriedade: {fazendaMapaInfo.fazendaNome} • Titular: {fazendaMapaInfo.titularNome || 'Não informado'}
            </Text>
          )}
          <View style={styles.mapaMetaGrid}>
            {mapaMetaChips}
          </View>
        </View>
      </View>

      <View style={styles.mapaFooter}>
        <View style={[
          styles.downloadIndicator,
          indicadorDisponivel ? styles.downloadIndicatorDisponivel : styles.downloadIndicatorIndisponivel,
        ]}>
          <Ionicons
            name={indicadorDisponivel ? 'open-outline' : 'alert-circle-outline'}
            size={16}
            color={indicadorDisponivel ? colors.success : colors.warning}
          />
          <Text style={[
            styles.downloadTexto,
            !indicadorDisponivel && styles.downloadTextoIndisponivel,
          ]}>
            {abrirMaterialLabel}
          </Text>
        </View>
      </View>
      {!isPngLocal && !isPrescriptionZip && !statusDownload.podeAbrir && (
        <Text style={styles.materialIndisponivelTexto}>
          Este material ainda não possui arquivo disponível para consulta.
        </Text>
      )}
    </TouchableOpacity>
    );
  };

  // ──────────────────────────────────────────────
  // RENDER: Card de Talhão do Panorama
  // ──────────────────────────────────────────────
  const renderTalhaoCard = (talhao) => {
    const fazendaTalhaoInfo = !consultaPorFazenda
      ? fazendaInfoPorId.get(getLimiteAreaFazendaId(talhao))
      : null;

    return (
      <TouchableOpacity
        key={talhao.id}
        style={[
          styles.talhaoCard,
          selectedTalhao?.id === talhao.id && styles.talhaoCardSelected
        ]}
        onPress={() => handleTalhaoPress(talhao)}
        activeOpacity={0.7}
      >
      <View style={styles.talhaoCardHeader}>
        <View style={[styles.talhaoColorBar, { backgroundColor: talhao.cor || colors.primary }]} />
        <View style={styles.talhaoCardInfo}>
          <Text style={styles.talhaoCardNome}>{talhao.talhao}</Text>
          <Text style={styles.talhaoCardSub}>{talhao.nome}</Text>
          {fazendaTalhaoInfo && (
            <Text style={styles.talhaoCardContexto} numberOfLines={1}>
              Propriedade: {fazendaTalhaoInfo.fazendaNome} • Titular: {fazendaTalhaoInfo.titularNome || 'Não informado'}
            </Text>
          )}
        </View>
        <View style={styles.talhaoCardRight}>
          <Text style={styles.talhaoCardArea}>{talhao.area_hectares} ha</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </View>

      <View style={styles.talhaoCardDetails}>
        <View style={styles.talhaoChip}>
          <Ionicons name="layers-outline" size={12} color={colors.secondary} />
          <Text style={styles.talhaoChipText}>{talhao.textura || '-'}</Text>
        </View>
        <View style={styles.talhaoChip}>
          <Ionicons name="calendar-outline" size={12} color={colors.primary} />
          <Text style={styles.talhaoChipText}>LT {talhao.ano || '-'}</Text>
        </View>
        <View style={styles.talhaoChip}>
          <Ionicons name="leaf-outline" size={12} color={colors.success} />
          <Text style={styles.talhaoChipText}>{talhao.cultura_atual || '-'}</Text>
        </View>
        <View style={styles.talhaoChip}>
          <Ionicons name="flask-outline" size={12} color={colors.info} />
          <Text style={styles.talhaoChipText}>pH {talhao.elementos?.ph || '-'}</Text>
        </View>
        {talhao.disponivel_offline && (
          <View style={[styles.talhaoChip, styles.talhaoChipOffline]}>
            <Ionicons name="cloud-done-outline" size={12} color={colors.success} />
            <Text style={[styles.talhaoChipText, { color: colors.success }]}>Offline</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  const renderGeoJsonImportPanel = () => {
    if (!podeAnexarGeoJson) return null;

    return (
      <SectionCard
        title="Arquivos técnicos da Propriedade"
        subtitle="GeoJSON local dos talhões"
        icon="document-attach-outline"
        style={styles.geoJsonImportSection}
      >
        <InfoBox
          message="Selecione um arquivo .geojson ou .json com os limites dos talhões. O arquivo ficará salvo localmente neste aparelho."
          style={styles.geoJsonImportInfo}
        />

        {geoJsonImportAtivo ? (
          <View style={styles.geoJsonImportSummary}>
            <View style={styles.geoJsonImportSummaryIcon}>
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            </View>
            <View style={styles.geoJsonImportSummaryText}>
              <Text style={styles.geoJsonImportSummaryTitle}>GeoJSON anexado</Text>
              <Text style={styles.geoJsonImportSummaryName} numberOfLines={1}>
                {geoJsonImportAtivo.arquivo_nome_original}
              </Text>
              <Text style={styles.geoJsonImportSummaryMeta}>
                {[
                  `${geoJsonImportAtivo.talhoes_count ?? 0} talhão${geoJsonImportAtivo.talhoes_count === 1 ? '' : 's'}`,
                  formatarData(geoJsonImportAtivo.importado_em),
                  geoJsonImportAtivo.status,
                ].join(' • ')}
              </Text>
              <Text style={styles.geoJsonImportNextStep}>
                {geoJsonTalhoesLocalAtivo
                  ? 'Talhões carregados do GeoJSON local.'
                  : 'O anexo local está registrado para esta Propriedade.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.geoJsonImportEmpty}>
            <Text style={styles.geoJsonImportEmptyText}>
              Nenhum GeoJSON local anexado a esta Propriedade.
            </Text>
          </View>
        )}

        {geoJsonImportAtivo && (
          <>
            <Text style={styles.geoJsonManageHelp}>
              Remover o GeoJSON local não apaga a Propriedade nem os anexos técnicos. Se existir demarcação demonstrativa/seed, ela voltará a ser exibida.
            </Text>
            <View style={styles.geoJsonManageActions}>
              <TouchableOpacity
                style={[
                  styles.geoJsonManageButton,
                  styles.geoJsonManageButtonSecondary,
                  geoJsonImporting && styles.geoJsonImportButtonDisabled,
                ]}
                onPress={handleSolicitarSubstituirGeoJson}
                activeOpacity={0.78}
                disabled={geoJsonImporting}
              >
                <Ionicons name="swap-horizontal-outline" size={17} color={colors.primary} />
                <Text style={styles.geoJsonManageButtonTextSecondary}>
                  Substituir GeoJSON dos talhões
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.geoJsonManageButton,
                  styles.geoJsonManageButtonDanger,
                  geoJsonManageDialog.loading && styles.geoJsonImportButtonDisabled,
                ]}
                onPress={handleSolicitarRemoverGeoJson}
                activeOpacity={0.78}
                disabled={geoJsonManageDialog.loading}
              >
                <Ionicons name="trash-outline" size={17} color={colors.error} />
                <Text style={styles.geoJsonManageButtonTextDanger}>
                  Remover GeoJSON local
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {geoJsonTalhoesLocalErro && (
          <View style={styles.geoJsonLayerWarningInline}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.geoJsonLayerWarningInlineText}>
              Não foi possível carregar o GeoJSON local. Exibindo demarcação disponível.
            </Text>
          </View>
        )}

        {!geoJsonImportAtivo && (
          <TouchableOpacity
            style={[
              styles.geoJsonImportButton,
              geoJsonImporting && styles.geoJsonImportButtonDisabled,
            ]}
            onPress={() => handleAnexarGeoJson('attach')}
            activeOpacity={0.78}
            disabled={geoJsonImporting}
          >
            {geoJsonImporting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="attach-outline" size={18} color={colors.white} />
            )}
            <Text style={styles.geoJsonImportButtonText}>
              Anexar GeoJSON dos talhões
            </Text>
          </TouchableOpacity>
        )}
      </SectionCard>
    );
  };

  const renderPngImportPanel = () => {
    if (!podeAnexarPng && !podeAnexarPrescriptionZip) return null;

    return (
      <View style={styles.pngImportPanel}>
        <View style={styles.pngImportHeader}>
          <View style={styles.pngImportHeaderIcon}>
            <Ionicons name="image-outline" size={18} color={colors.info} />
          </View>
          <View style={styles.pngImportHeaderText}>
            <Text style={styles.pngImportTitle}>PNG local de mapa</Text>
            <Text style={styles.pngImportSubtitle}>
              Anexos locais classificados por fertilidade ou correção de solo.
            </Text>
          </View>
        </View>

        {pngImportsMateriaisAtivos.length > 0 ? (
          <View style={styles.pngImportSummaryList}>
            {pngImportsMateriaisAtivos.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.pngImportSummaryItem}>
                <View style={styles.pngImportSummaryIcon}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                </View>
                <View style={styles.pngImportSummaryText}>
                  <Text style={styles.pngImportSummaryTitle} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text style={styles.pngImportSummaryMeta} numberOfLines={2}>
                    {[
                      item.elemento_label || item.categoria_label,
                      item.safra || item.ano,
                      item.escopo === 'talhao'
                        ? item.talhao_nome || 'Talhão específico'
                        : 'Propriedade inteira',
                      item.status,
                    ].filter(Boolean).join(' • ')}
                  </Text>
                  <Text style={styles.pngImportSummaryMeta} numberOfLines={1}>
                    {[
                      item.arquivo_nome_original,
                      formatarData(item.importado_em),
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </View>
            ))}
            {pngImportsMateriaisAtivos.length > 3 ? (
              <Text style={styles.pngImportMoreText}>
                +{pngImportsMateriaisAtivos.length - 3} PNG local(is) nesta Propriedade.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.pngImportEmpty}>
            <Text style={styles.pngImportEmptyText}>
              Nenhum PNG local de material técnico nesta Propriedade.
            </Text>
          </View>
        )}

        {prescriptionZipImportsAtivos.length > 0 ? (
          <View style={styles.pngImportSummaryList}>
            {prescriptionZipImportsAtivos.slice(0, 2).map((item) => (
              <View key={item.id} style={styles.pngImportSummaryItem}>
                <View style={styles.pngImportSummaryIcon}>
                  <Ionicons name="archive-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.pngImportSummaryText}>
                  <Text style={styles.pngImportSummaryTitle} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text style={styles.pngImportSummaryMeta} numberOfLines={2}>
                    {[
                      item.camada_label || item.elemento_label,
                      item.safra || item.ano,
                      item.escopo === 'talhao'
                        ? item.talhao_nome || 'Talhão específico'
                        : 'Propriedade inteira',
                      item.status,
                    ].filter(Boolean).join(' • ')}
                  </Text>
                  <Text style={styles.pngImportSummaryMeta} numberOfLines={1}>
                    {[
                      item.arquivo_nome_original,
                      formatarData(item.importado_em),
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.materialImportActions}>
          {podeAnexarPng ? (
            <TouchableOpacity
              style={[
                styles.geoJsonImportButton,
                styles.materialImportActionButton,
                pngImporting && styles.geoJsonImportButtonDisabled,
              ]}
              onPress={handleAnexarPng}
              activeOpacity={0.78}
              disabled={pngImporting}
            >
              {pngImporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="image-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.geoJsonImportButtonText}>
                Anexar PNG
              </Text>
            </TouchableOpacity>
          ) : null}

          {podeAnexarPrescriptionZip ? (
            <TouchableOpacity
              style={[
                styles.geoJsonImportButton,
                styles.materialImportActionButton,
                prescriptionZipImporting && styles.geoJsonImportButtonDisabled,
              ]}
              onPress={handleAnexarPrescriptionZip}
              activeOpacity={0.78}
              disabled={prescriptionZipImporting}
            >
              {prescriptionZipImporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="archive-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.geoJsonImportButtonText}>
                Anexar prescrição ZIP
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.pngImportNextStep}>
          PNG abre como imagem. Prescrição ZIP abre apenas como detalhe do pacote técnico.
        </Text>
      </View>
    );
  };

  // ──────────────────────────────────────────────
  // RENDER: PANORAMA UNIFICADO
  // ──────────────────────────────────────────────
  const renderPanorama = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Busca */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          onClear={() => setBusca('')}
          placeholder="Buscar material, talhão, safra, propriedade..."
        />
      </View>

      {!consultaPorFazenda && fazendaOptions.length > 1 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="business-outline" size={14} color={colors.text} /> Contexto da consulta:
          </Text>
          <SegmentedChips
            options={fazendaFiltroOptions}
            value={fazendaFiltroOperacional}
            onChange={setFazendaFiltroOperacional}
            horizontal
            contentStyle={styles.anoFilterContent}
          />
        </View>
      )}

      {anosDisponiveis.length > 0 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="calendar-outline" size={14} color={colors.text} /> Demarcação:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
            <TouchableOpacity
              style={[styles.anoChip, !anoFiltroLimite && styles.anoChipActive]}
              onPress={() => setAnoFiltroLimite(null)}
            >
              <Text style={[styles.anoChipText, !anoFiltroLimite && styles.anoChipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {anosDisponiveis.map(ano => (
              <TouchableOpacity
                key={ano}
                style={[styles.anoChip, anoFiltroLimite === ano && styles.anoChipActive]}
                onPress={() => setAnoFiltroLimite(ano)}
              >
                <Text style={[styles.anoChipText, anoFiltroLimite === ano && styles.anoChipTextActive]}>
                  LT {ano}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {talhoesPanorama.length > 0 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="location-outline" size={14} color={colors.text} /> Talhão:
          </Text>
          <SegmentedChips
            options={talhaoFiltroOptions}
            value={talhaoFiltroAtual}
            onChange={handleTalhaoFiltroChange}
            horizontal
            contentStyle={styles.anoFilterContent}
          />
        </View>
      )}

      {safrasMapas.length > 0 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="leaf-outline" size={14} color={colors.text} /> Safra dos materiais:
          </Text>
          <SegmentedChips
            options={safraFiltroOptions}
            value={safraFiltroMapas}
            onChange={setSafraFiltroMapas}
            horizontal
            contentStyle={styles.anoFilterContent}
          />
        </View>
      )}

      {temFiltroPanoramaAtivo && (
        <TouchableOpacity style={styles.limparFiltrosButton} onPress={limparFiltrosPanorama} activeOpacity={0.75}>
          <Ionicons name="close-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.limparFiltrosText}>Limpar filtros do panorama</Text>
        </TouchableOpacity>
      )}

      {renderGeoJsonImportPanel()}

      {(geoJsonTalhoesLocalAtivo || geoJsonTalhoesLocalErro) && (
        <View style={[
          styles.geoJsonLayerIndicator,
          geoJsonTalhoesLocalErro && styles.geoJsonLayerIndicatorWarning,
        ]}>
          <Ionicons
            name={geoJsonTalhoesLocalAtivo ? 'layers-outline' : 'alert-circle-outline'}
            size={17}
            color={geoJsonTalhoesLocalAtivo ? colors.primary : colors.warning}
          />
          <View style={styles.geoJsonLayerIndicatorTextos}>
            <Text style={styles.geoJsonLayerIndicatorTitle}>
              {geoJsonTalhoesLocalAtivo
                ? isProdutorView ? 'Talhões disponíveis para consulta' : 'Talhões carregados do GeoJSON local'
                : 'Não foi possível carregar o GeoJSON local'}
            </Text>
            <Text style={styles.geoJsonLayerIndicatorSubtitle} numberOfLines={1}>
              {geoJsonTalhoesLocalAtivo
                ? isProdutorView
                  ? 'Demarcação da Propriedade carregada.'
                  : geoJsonTalhoesLayer?.metadata?.arquivo_nome_original || 'GeoJSON local anexado'
                : 'Exibindo demarcação disponível.'}
            </Text>
          </View>
        </View>
      )}

      {/* Estatísticas do panorama */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>{limitesFiltrados.length}</Text>
          <Text style={styles.statLabel}>Talhões</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>{areaLimitesFiltrados}</Text>
          <Text style={styles.statLabel}>ha</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>{materiaisTecnicosNoContexto.length}</Text>
          <Text style={styles.statLabel}>Materiais</Text>
        </View>
      </View>

      {limitesFiltrados.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title={
            temFiltroPanoramaAtivo
              ? 'Nenhuma demarcação encontrada'
              : consultaPorFazenda || fazendaFiltroInfo
                ? 'Sem demarcação de talhões neste mock'
                : 'Sem demarcações de talhões no escopo atual'
          }
          message={
            temFiltroPanoramaAtivo
              ? 'Tente ajustar propriedade, talhão, demarcação ou busca.'
              : consultaPorFazenda || fazendaFiltroInfo
                ? 'Os anexos de fertilidade e materiais técnicos podem existir mesmo sem mapa de talhões cadastrado para esta propriedade.'
                : 'Quando houver demarcações liberadas para as propriedades acessíveis, elas aparecerão aqui.'
          }
          style={styles.emptyContainer}
        />
      ) : (
        <>
          {/* ── Botão Ver no Mapa ────────────────────── */}
          <TouchableOpacity
            style={styles.btnMapaSatelite}
            onPress={() =>
              navigation.navigate(
                'FazendaMapa',
                buildFazendaMapaRouteParamsFromPropriedade(mapaSateliteFazendaInfo)
              )
            }
            activeOpacity={0.8}
          >
            <View style={styles.btnMapaSateliteIcone}>
              <Ionicons name="earth" size={22} color={colors.white} />
            </View>
            <View style={styles.btnMapaSateliteTextos}>
              <Text style={styles.btnMapaSateliteTitulo}>Abrir mapa dos talhões</Text>
              <Text style={styles.btnMapaSateliteSubtitulo}>
                {mapaSateliteFazendaInfo
                  ? `${mapaSateliteFazendaInfo.fazendaNome}`
                  : 'Talhões acessíveis no escopo atual'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Visualização Shape */}
          <View style={styles.shapeSection}>
            <View style={styles.shapeSectionHeader}>
              <Ionicons name="git-network-outline" size={20} color={colors.primary} />
              <Text style={styles.shapeSectionTitle}>Mapa dos Talhões</Text>
              {anoFiltroLimite && (
                <View style={styles.anoTag}>
                  <Text style={styles.anoTagText}>LT {anoFiltroLimite}</Text>
                </View>
              )}
            </View>
            <ShapeRenderer
              talhoes={limitesFiltrados}
              onTalhaoPress={handleTalhaoPress}
              selectedId={selectedTalhao?.id}
              height={280}
              showLabels
              showLegend
            />
          </View>

          {/* Lista de Talhões */}
          <View style={styles.talhaoListSection}>
            <Text style={styles.talhaoListTitle}>
              <Ionicons name="list-outline" size={18} color={colors.primary} /> Talhões do mapa
            </Text>
            {limitesFiltrados.map(talhao => renderTalhaoCard(talhao))}
          </View>
        </>
      )}

      <SectionCard
        title={tituloSecaoMateriais}
        subtitle={subtituloSecaoMateriais}
        icon="images-outline"
        style={styles.materiaisSection}
      >
        <View style={styles.materiaisCountRow}>
          <View style={styles.anoTag}>
            <Text style={styles.anoTagText}>{mapasFiltrados.length}</Text>
          </View>
        </View>
        <InfoBox
          message={
            isProdutorView
              ? 'Consulte os mapas e arquivos técnicos liberados para esta Propriedade.'
              : 'Consulte os mapas e arquivos técnicos disponíveis, incluindo PNGs locais anexados neste aparelho. Esta tela não envia nem publica arquivos.'
          }
          style={styles.materiaisDescription}
        />
        {renderPngImportPanel()}
      </SectionCard>

      {/* Filtros de Categoria */}
      <SegmentedChips
        options={categoriaOptions}
        value={categoriaAtiva}
        onChange={setCategoriaAtiva}
        horizontal
        style={styles.categoriasContainer}
        contentStyle={styles.categoriasContent}
      />

      {/* Ordenação */}
      <View style={styles.ordenacaoContainer}>
        <Text style={styles.ordenacaoLabel}>
          <Ionicons name="swap-vertical-outline" size={14} color={colors.text} /> Ordenar materiais:
        </Text>
        <SegmentedChips
          options={ordenacaoOptions}
          value={ordenacao}
          onChange={setOrdenacao}
          contentStyle={styles.ordenacaoButtons}
        />
      </View>

      {mapasFiltrados.length === 0 ? (
        <EmptyState
          icon={temFiltroMaterialAtivo ? 'search-outline' : 'folder-open-outline'}
          title={
            temFiltroMaterialAtivo
              ? 'Nenhum material técnico encontrado'
              : 'Nenhum material técnico disponível'
          }
          message={
            temFiltroMaterialAtivo
              ? 'Tente ajustar safra, talhão, categoria ou busca.'
              : isProdutorView
                ? 'Nenhum material técnico liberado para consulta nesta Propriedade.'
                : 'Quando materiais previamente preparados forem liberados para este contexto, eles aparecerão aqui para consulta.'
          }
          style={styles.emptyContainer}
        />
      ) : (
        <View style={styles.mapasLista}>
          {categoriaAtiva === 'todos' ? (
            mapasPorCategoria.map(cat => (
              <View key={cat.id} style={styles.categoriaSecao}>
                <View style={styles.categoriaHeader}>
                  <Ionicons name={cat.icon} size={28} color={colors.primary} />
                  <Text style={styles.categoriaTitulo}>{cat.nome}</Text>
                  <View style={styles.categoriaBadge}>
                    <Text style={styles.categoriaBadgeTexto}>{cat.mapas.length}</Text>
                  </View>
                </View>
                {cat.mapas.map(mapa => renderMapaCard(mapa))}
              </View>
            ))
          ) : (
            mapasFiltrados.map(mapa => renderMapaCard(mapa))
          )}
        </View>
      )}

      <View style={{ height: spacing.xl * 3 }} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────
  const imagePreviewMetaItems = buildImagePreviewMetaItems(imagePreview.mapa);
  const prescriptionZipMetaItems = buildPrescriptionZipMetaItems(prescriptionZipDetail.mapa);
  const canManageImagePreviewPng = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canManagePngMapItem(user, contextoConsulta.fazenda, imagePreview.mapa);
  const canManagePrescriptionZipDetail = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canManagePrescriptionZipItem(user, contextoConsulta.fazenda, prescriptionZipDetail.mapa);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={tituloTela} showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </View>
    );
  }

  if (estadoBloqueio) {
    return (
      <View style={styles.container}>
        <Header title={tituloTela} showBack onBack={() => navigation.goBack()} />
        <View style={styles.blockedContainer}>
          <Ionicons name={mensagemBloqueio.icon as any} size={64} color={colors.muted} />
          <Text style={styles.blockedTitle}>{mensagemBloqueio.title}</Text>
          <Text style={styles.blockedText}>{mensagemBloqueio.text}</Text>
          <TouchableOpacity style={styles.blockedButton} onPress={() => navigation.goBack()}>
            <Text style={styles.blockedButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={tituloTela} showBack onBack={() => navigation.goBack()} />

      <View style={styles.contextoContainer}>
        <View style={styles.contextoIcon}>
          <Ionicons
            name={consultaPorFazenda || fazendaFiltroInfo ? 'home-outline' : 'globe-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.contextoTextos}>
          <Text style={styles.contextoLabel}>
            {contextoLabel}
          </Text>
          <Text style={styles.contextoTitulo} numberOfLines={1}>
            {contextoTitulo}
          </Text>
          <Text style={styles.contextoSubtitulo} numberOfLines={1}>
            {contextoSubtitulo}
          </Text>
        </View>
      </View>

      {renderPanorama()}

      {/* Dialog de visualização de material */}
      <ConfirmDialog
        visible={downloadDialog.visible}
        title="Abrir material"
        message={downloadDialog.mapa 
          ? `Abrir para consulta o material "${downloadDialog.mapa.titulo}"?`
          : ''}
        type="info"
        confirmText="Abrir"
        cancelText="Cancelar"
        onConfirm={confirmDownload}
        onCancel={() => setDownloadDialog({ visible: false, mapa: null, status: null })}
      />

      <ConfirmDialog
        visible={geoJsonManageDialog.visible}
        title={
          geoJsonManageDialog.action === 'remove'
            ? 'Remover GeoJSON local'
            : 'Substituir GeoJSON dos talhões'
        }
        message={
          geoJsonManageDialog.action === 'remove'
            ? [
                'Deseja remover o GeoJSON local desta Propriedade? O arquivo local será removido do aparelho, mas a Propriedade e os anexos técnicos não serão apagados.',
                shouldShowSelaPrataIRemovalWarning({ propriedade: contextoConsulta.fazenda })
                  ? 'Esta Propriedade possui demarcação demonstrativa embutida. Remover o GeoJSON local fará o app voltar para a demarcação demonstrativa.'
                  : 'Se existir demarcação demonstrativa/seed, ela voltará a ser exibida.',
              ].join('\n\n')
            : 'Um GeoJSON local já está ativo para esta Propriedade. O novo arquivo substituirá a camada local atual.'
        }
        type={geoJsonManageDialog.action === 'remove' ? 'danger' : 'warning'}
        confirmText={geoJsonManageDialog.action === 'remove' ? 'Remover' : 'Continuar'}
        cancelText="Cancelar"
        loading={geoJsonManageDialog.loading}
        onConfirm={handleConfirmarGeoJsonManageDialog}
        onCancel={handleCancelarGeoJsonManageDialog}
      />

      <ConfirmDialog
        visible={pngManageDialog.visible}
        title={
          pngManageDialog.action === 'remove'
            ? 'Remover PNG local'
            : 'Substituir PNG local'
        }
        message={
          pngManageDialog.action === 'remove'
            ? [
                'Deseja remover este PNG local? O arquivo local será removido deste aparelho.',
                'A Propriedade não será apagada. Outros mapas/anexos não serão apagados. PNGs demonstrativos da Sela de Prata I não serão afetados.',
              ].join('\n\n')
            : 'O novo arquivo substituirá este PNG local. Os metadados principais serão preservados.'
        }
        type={pngManageDialog.action === 'remove' ? 'danger' : 'warning'}
        confirmText={pngManageDialog.action === 'remove' ? 'Remover' : 'Continuar'}
        cancelText="Cancelar"
        loading={pngManageDialog.loading}
        onConfirm={handleConfirmarPngManageDialog}
        onCancel={handleCancelarPngManageDialog}
      />

      <ConfirmDialog
        visible={prescriptionZipManageDialog.visible}
        title={
          prescriptionZipManageDialog.action === 'remove'
            ? 'Remover prescrição local'
            : 'Substituir ZIP'
        }
        message={
          prescriptionZipManageDialog.action === 'remove'
            ? [
                'Deseja remover esta prescrição local? O arquivo ZIP local será removido deste aparelho.',
                'A Propriedade não será apagada. Outros mapas/anexos não serão apagados.',
              ].join('\n\n')
            : 'O novo arquivo ZIP substituirá esta prescrição local. Os metadados principais serão preservados.'
        }
        type={prescriptionZipManageDialog.action === 'remove' ? 'danger' : 'warning'}
        confirmText={prescriptionZipManageDialog.action === 'remove' ? 'Remover' : 'Continuar'}
        cancelText="Cancelar"
        loading={prescriptionZipManageDialog.loading}
        onConfirm={handleConfirmarPrescriptionZipManageDialog}
        onCancel={handleCancelarPrescriptionZipManageDialog}
      />

      <Modal
        visible={!!geoJsonPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelarGeoJsonPreview}
      >
        <View style={styles.geoJsonPreviewOverlay}>
          <View style={styles.geoJsonPreviewDialog}>
            <View style={styles.geoJsonPreviewHeader}>
              <View style={styles.geoJsonPreviewTitleWrap}>
                <Text style={styles.geoJsonPreviewTitle}>
                  {geoJsonPreviewMode === 'replace' ? 'Confirmar substituição' : 'Confirmar associação'}
                </Text>
                <Text style={styles.geoJsonPreviewSubtitle}>
                  {geoJsonPreviewMode === 'replace'
                    ? 'Confirmar substituição da camada local desta Propriedade?'
                    : 'Confirmar associação deste GeoJSON à Propriedade?'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelarGeoJsonPreview}
                style={styles.geoJsonPreviewClose}
                disabled={geoJsonConfirming}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.geoJsonPreviewBody}
              contentContainerStyle={styles.geoJsonPreviewContent}
            >
              {geoJsonPreview ? (
                <>
                  <View style={styles.geoJsonPreviewRows}>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Arquivo</Text>
                      <Text style={styles.geoJsonPreviewValue} numberOfLines={2}>
                        {geoJsonPreview.file.name}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Talhões</Text>
                      <Text style={styles.geoJsonPreviewValue}>
                        {geoJsonPreview.summary.talhoes_count}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Partes/polígonos</Text>
                      <Text style={styles.geoJsonPreviewValue}>
                        {geoJsonPreview.summary.polygon_parts_count}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Geometrias</Text>
                      <Text style={styles.geoJsonPreviewValue} numberOfLines={2}>
                        {geoJsonPreview.summary.geometry_types.length > 0
                          ? geoJsonPreview.summary.geometry_types.join(', ')
                          : 'Não informado'}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Tamanho</Text>
                      <Text style={styles.geoJsonPreviewValue}>
                        {formatarTamanhoArquivo(geoJsonPreview.summary.file_size_bytes)}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Ano</Text>
                      <Text style={styles.geoJsonPreviewValue}>
                        {geoJsonPreview.resolvedContext.ano}
                      </Text>
                    </View>
                    <View style={styles.geoJsonPreviewRow}>
                      <Text style={styles.geoJsonPreviewLabel}>Safra</Text>
                      <Text style={styles.geoJsonPreviewValue}>
                        {geoJsonPreview.resolvedContext.safra || 'Não informada'}
                      </Text>
                    </View>
                  </View>

                  {geoJsonPreview.resolvedContext.requiresSelaPrataConfirmation && (
                    <View style={styles.geoJsonSelaWarning}>
                      <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                      <Text style={styles.geoJsonSelaWarningText}>
                        Esta Propriedade possui demarcação demonstrativa embutida. O GeoJSON local válido substitui a visualização local; ao remover, o app volta para a demarcação demonstrativa.
                      </Text>
                    </View>
                  )}

                  {geoJsonPreview.warnings.length > 0 && (
                    <View style={styles.geoJsonWarningsBox}>
                      <Text style={styles.geoJsonWarningsTitle}>Avisos da validação</Text>
                      {geoJsonPreview.warnings.slice(0, 4).map((warning) => (
                        <Text key={`${warning.code}-${warning.message}`} style={styles.geoJsonWarningItem}>
                          {warning.message}
                        </Text>
                      ))}
                      {geoJsonPreview.warnings.length > 4 && (
                        <Text style={styles.geoJsonWarningItem}>
                          +{geoJsonPreview.warnings.length - 4} aviso(s)
                        </Text>
                      )}
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.geoJsonPreviewFooter}>
              <TouchableOpacity
                style={styles.geoJsonPreviewCancelButton}
                onPress={handleCancelarGeoJsonPreview}
                disabled={geoJsonConfirming}
              >
                <Text style={styles.geoJsonPreviewCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.geoJsonPreviewConfirmButton,
                  geoJsonConfirming && styles.geoJsonPreviewConfirmButtonDisabled,
                ]}
                onPress={handleConfirmarGeoJsonPreview}
                disabled={geoJsonConfirming}
              >
                {geoJsonConfirming ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.geoJsonPreviewConfirmText}>
                  {geoJsonPreviewMode === 'replace' ? 'Substituir' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!pngPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelarPngPreview}
      >
        <View style={styles.geoJsonPreviewOverlay}>
          <View style={styles.geoJsonPreviewDialog}>
            <View style={styles.geoJsonPreviewHeader}>
              <View style={styles.geoJsonPreviewTitleWrap}>
                <Text style={styles.geoJsonPreviewTitle}>
                  Anexar PNG
                </Text>
                <Text style={styles.geoJsonPreviewSubtitle}>
                  Classifique o material técnico e vincule ao contexto correto.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelarPngPreview}
                style={styles.geoJsonPreviewClose}
                disabled={pngConfirming}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.geoJsonPreviewBody}
              contentContainerStyle={styles.geoJsonPreviewContent}
              keyboardShouldPersistTaps="handled"
            >
              {pngPreview ? (
                <>
                  <View style={styles.pngFileBox}>
                    <View style={styles.pngFileIcon}>
                      <Ionicons name="image-outline" size={20} color={colors.info} />
                    </View>
                    <View style={styles.pngFileText}>
                      <Text style={styles.pngFileLabel}>Arquivo selecionado</Text>
                      <Text style={styles.pngFileName} numberOfLines={2}>
                        {pngPreview.file.name}
                      </Text>
                      <Text style={styles.pngFileMeta}>
                        {formatarTamanhoArquivo(pngPreview.file.size)}
                      </Text>
                    </View>
                  </View>

                  <FormField
                    label="Título"
                    required
                    value={pngForm.titulo || ''}
                    onChangeText={(titulo) => updatePngForm({ titulo })}
                    error={pngFormErrors.titulo}
                    placeholder="Ex.: Mapa de pH 2025"
                    leftIcon="text-outline"
                  />

                  <SelectField
                    label="Tipo de mapa/camada"
                    required
                    value={pngForm.elemento ? String(pngForm.elemento) : ''}
                    options={pngCategoryOptions}
                    onChange={(elemento) => updatePngForm({ elemento })}
                    error={pngFormErrors.elemento}
                    placeholder="Selecione o tipo de mapa"
                  />

                  <View style={styles.pngFormRow}>
                    <FormField
                      label="Safra"
                      value={pngForm.safra || ''}
                      onChangeText={(safra) => updatePngForm({ safra })}
                      placeholder="Ex.: 2025/2026"
                      leftIcon="leaf-outline"
                      containerStyle={styles.pngFormRowItem}
                    />
                    <FormField
                      label="Ano"
                      value={pngForm.ano ? String(pngForm.ano) : ''}
                      onChangeText={(ano) => updatePngForm({ ano })}
                      error={pngFormErrors.ano}
                      keyboardType="number-pad"
                      placeholder="2025"
                      leftIcon="calendar-outline"
                      containerStyle={styles.pngFormRowItem}
                    />
                  </View>

                  <FormField
                    label="Profundidade"
                    value={pngForm.profundidade || ''}
                    onChangeText={(profundidade) => updatePngForm({ profundidade })}
                    placeholder="Ex.: 10-20 cm"
                    leftIcon="resize-outline"
                  />

                  <SelectField
                    label="Escopo"
                    required
                    value={pngForm.escopo || 'propriedade'}
                    options={PNG_ESCOPO_OPTIONS}
                    onChange={(escopo) => updatePngForm({
                      escopo: escopo === 'talhao' ? 'talhao' : 'propriedade',
                      talhao_id: '',
                      talhao_nome: '',
                    })}
                    error={pngFormErrors.escopo}
                  />

                  {pngForm.escopo === 'talhao' ? (
                    pngTalhaoOptions.length > 0 ? (
                      <SelectField
                        label="Talhão"
                        required
                        value={pngForm.talhao_id || ''}
                        options={pngTalhaoOptions}
                        onChange={handlePngTalhaoChange}
                        error={pngFormErrors.talhao}
                        placeholder="Selecione o talhão"
                      />
                    ) : (
                      <FormField
                        label="Nome do talhão"
                        required
                        value={pngForm.talhao_nome || ''}
                        onChangeText={(talhao_nome) => updatePngForm({ talhao_nome })}
                        error={pngFormErrors.talhao}
                        placeholder="Informe o talhão"
                        leftIcon="location-outline"
                      />
                    )
                  ) : null}

                  <FormField
                    label="Observações"
                    value={pngForm.descricao || ''}
                    onChangeText={(descricao) => updatePngForm({ descricao })}
                    placeholder="Observação técnica opcional"
                    leftIcon="document-text-outline"
                    textarea
                    maxLength={420}
                  />

                  <TouchableOpacity
                    style={styles.pngVisibilityToggle}
                    onPress={() => updatePngForm({
                      visivel_para_produtor: !pngForm.visivel_para_produtor,
                    })}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={pngForm.visivel_para_produtor ? 'checkbox-outline' : 'square-outline'}
                      size={22}
                      color={pngForm.visivel_para_produtor ? colors.primary : colors.muted}
                    />
                    <View style={styles.pngVisibilityText}>
                      <Text style={styles.pngVisibilityTitle}>Visível para produtor</Text>
                      <Text style={styles.pngVisibilitySubtitle}>
                        O anexo será marcado para consulta do Produtor na listagem principal quando permitido.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {pngPreview.warnings.length > 0 ? (
                    <View style={styles.geoJsonWarningsBox}>
                      <Text style={styles.geoJsonWarningsTitle}>Avisos da validação</Text>
                      {pngPreview.warnings.slice(0, 4).map((warning) => (
                        <Text key={`${warning.code}-${warning.message}`} style={styles.geoJsonWarningItem}>
                          {warning.message}
                        </Text>
                      ))}
                      {pngPreview.warnings.length > 4 ? (
                        <Text style={styles.geoJsonWarningItem}>
                          +{pngPreview.warnings.length - 4} aviso(s)
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.geoJsonPreviewFooter}>
              <TouchableOpacity
                style={styles.geoJsonPreviewCancelButton}
                onPress={handleCancelarPngPreview}
                disabled={pngConfirming}
              >
                <Text style={styles.geoJsonPreviewCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.geoJsonPreviewConfirmButton,
                  pngConfirming && styles.geoJsonPreviewConfirmButtonDisabled,
                ]}
                onPress={handleConfirmarPngPreview}
                disabled={pngConfirming}
              >
                {pngConfirming ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.geoJsonPreviewConfirmText}>
                  Anexar PNG
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!prescriptionZipPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelarPrescriptionZipPreview}
      >
        <View style={styles.geoJsonPreviewOverlay}>
          <View style={styles.geoJsonPreviewDialog}>
            <View style={styles.geoJsonPreviewHeader}>
              <View style={styles.geoJsonPreviewTitleWrap}>
                <Text style={styles.geoJsonPreviewTitle}>
                  Anexar prescrição ZIP
                </Text>
                <Text style={styles.geoJsonPreviewSubtitle}>
                  Classifique o pacote técnico sem abrir ou processar o ZIP.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelarPrescriptionZipPreview}
                style={styles.geoJsonPreviewClose}
                disabled={prescriptionZipConfirming}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.geoJsonPreviewBody}
              contentContainerStyle={styles.geoJsonPreviewContent}
              keyboardShouldPersistTaps="handled"
            >
              {prescriptionZipPreview ? (
                <>
                  <View style={styles.pngFileBox}>
                    <View style={styles.pngFileIcon}>
                      <Ionicons name="archive-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.pngFileText}>
                      <Text style={styles.pngFileLabel}>Arquivo selecionado</Text>
                      <Text style={styles.pngFileName} numberOfLines={2}>
                        {prescriptionZipPreview.file.name}
                      </Text>
                      <Text style={styles.pngFileMeta}>
                        {formatarTamanhoArquivo(prescriptionZipPreview.file.size)}
                      </Text>
                    </View>
                  </View>

                  <FormField
                    label="Título"
                    required
                    value={prescriptionZipForm.titulo || ''}
                    onChangeText={(titulo) => updatePrescriptionZipForm({ titulo })}
                    error={prescriptionZipFormErrors.titulo}
                    placeholder="Ex.: Prescrição 2025"
                    leftIcon="text-outline"
                  />

                  <SelectField
                    label="Camada"
                    required
                    value={prescriptionZipForm.camada ? String(prescriptionZipForm.camada) : ''}
                    options={prescriptionZipLayerOptions}
                    onChange={(camada) => updatePrescriptionZipForm({ camada })}
                    error={prescriptionZipFormErrors.camada}
                    placeholder="Selecione a camada"
                  />

                  <View style={styles.pngFormRow}>
                    <FormField
                      label="Safra"
                      value={prescriptionZipForm.safra || ''}
                      onChangeText={(safra) => updatePrescriptionZipForm({ safra })}
                      placeholder="Ex.: 2025/2026"
                      leftIcon="leaf-outline"
                      containerStyle={styles.pngFormRowItem}
                    />
                    <FormField
                      label="Ano"
                      value={prescriptionZipForm.ano ? String(prescriptionZipForm.ano) : ''}
                      onChangeText={(ano) => updatePrescriptionZipForm({ ano })}
                      error={prescriptionZipFormErrors.ano}
                      keyboardType="number-pad"
                      placeholder="2025"
                      leftIcon="calendar-outline"
                      containerStyle={styles.pngFormRowItem}
                    />
                  </View>

                  <SelectField
                    label="Escopo"
                    required
                    value={prescriptionZipForm.escopo || 'propriedade'}
                    options={PNG_ESCOPO_OPTIONS}
                    onChange={(escopo) => updatePrescriptionZipForm({
                      escopo: escopo === 'talhao' ? 'talhao' : 'propriedade',
                      talhao_id: '',
                      talhao_nome: '',
                    })}
                    error={prescriptionZipFormErrors.escopo}
                  />

                  {prescriptionZipForm.escopo === 'talhao' ? (
                    pngTalhaoOptions.length > 0 ? (
                      <SelectField
                        label="Talhão"
                        required
                        value={prescriptionZipForm.talhao_id || ''}
                        options={pngTalhaoOptions}
                        onChange={handlePrescriptionZipTalhaoChange}
                        error={prescriptionZipFormErrors.talhao}
                        placeholder="Selecione o talhão"
                      />
                    ) : (
                      <FormField
                        label="Nome do talhão"
                        required
                        value={prescriptionZipForm.talhao_nome || ''}
                        onChangeText={(talhao_nome) => updatePrescriptionZipForm({ talhao_nome })}
                        error={prescriptionZipFormErrors.talhao}
                        placeholder="Informe o talhão"
                        leftIcon="location-outline"
                      />
                    )
                  ) : null}

                  <FormField
                    label="Observações"
                    value={prescriptionZipForm.descricao || ''}
                    onChangeText={(descricao) => updatePrescriptionZipForm({ descricao })}
                    placeholder="Observação técnica opcional"
                    leftIcon="document-text-outline"
                    textarea
                    maxLength={420}
                  />

                  <TouchableOpacity
                    style={styles.pngVisibilityToggle}
                    onPress={() => updatePrescriptionZipForm({
                      visivel_para_produtor: !prescriptionZipForm.visivel_para_produtor,
                    })}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={prescriptionZipForm.visivel_para_produtor ? 'checkbox-outline' : 'square-outline'}
                      size={22}
                      color={prescriptionZipForm.visivel_para_produtor ? colors.primary : colors.muted}
                    />
                    <View style={styles.pngVisibilityText}>
                      <Text style={styles.pngVisibilityTitle}>Visível para produtor</Text>
                      <Text style={styles.pngVisibilitySubtitle}>
                        A prescrição será marcada para consulta quando permitido.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <InfoBox
                    variant="info"
                    title="Pacote técnico"
                    message={PRESCRIPTION_ZIP_DETAILS_MESSAGE}
                  />
                </>
              ) : null}
            </ScrollView>

            <View style={styles.geoJsonPreviewFooter}>
              <TouchableOpacity
                style={styles.geoJsonPreviewCancelButton}
                onPress={handleCancelarPrescriptionZipPreview}
                disabled={prescriptionZipConfirming}
              >
                <Text style={styles.geoJsonPreviewCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.geoJsonPreviewConfirmButton,
                  prescriptionZipConfirming && styles.geoJsonPreviewConfirmButtonDisabled,
                ]}
                onPress={handleConfirmarPrescriptionZipPreview}
                disabled={prescriptionZipConfirming}
              >
                {prescriptionZipConfirming ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.geoJsonPreviewConfirmText}>
                  Anexar ZIP
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={imagePreview.visible}
        transparent
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <View style={styles.imagePreviewOverlay}>
          <View style={styles.imagePreviewDialog}>
            <View style={styles.imagePreviewHeader}>
              <View style={styles.imagePreviewTitleWrap}>
                <Text style={styles.imagePreviewTitle} numberOfLines={1}>
                  {imagePreview.mapa?.titulo || 'Material técnico'}
                </Text>
                {imagePreview.mapa && (getMapaElementoLabel(imagePreview.mapa) || imagePreview.mapa?.profundidade) ? (
                  <Text style={styles.imagePreviewSubtitle}>
                    {[
                      getMapaElementoLabel(imagePreview.mapa),
                      imagePreview.mapa?.profundidade ? `Profundidade ${imagePreview.mapa.profundidade}` : null,
                    ].filter(Boolean).join(' • ')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={closeImagePreview}
                style={styles.imagePreviewClose}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {imagePreviewMetaItems.length > 0 ? (
              <View style={styles.imagePreviewMetaGrid}>
                {imagePreviewMetaItems.map(renderImagePreviewMetaChip)}
              </View>
            ) : null}
            {canManageImagePreviewPng ? (
              <View style={styles.imagePreviewManagePanel}>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonSecondary,
                    pngManageDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={handleSolicitarSubstituirPng}
                  activeOpacity={0.78}
                  disabled={pngManageDialog.loading}
                >
                  <Ionicons name="swap-horizontal-outline" size={17} color={colors.primary} />
                  <Text style={styles.geoJsonManageButtonTextSecondary}>
                    Substituir PNG
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonDanger,
                    pngManageDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={handleSolicitarRemoverPng}
                  activeOpacity={0.78}
                  disabled={pngManageDialog.loading}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                  <Text style={styles.geoJsonManageButtonTextDanger}>
                    Remover material local
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {imagePreview.loadError ? (
              <View style={styles.imagePreviewErrorBox}>
                <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
                <Text style={styles.imagePreviewErrorText}>
                  {imagePreview.loadError}
                </Text>
              </View>
            ) : null}
            {imagePreview.source ? (
              <Image
                source={imagePreview.source}
                style={styles.imagePreviewImage}
                resizeMode="contain"
                onError={handleImagePreviewError}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={prescriptionZipDetail.visible}
        transparent
        animationType="fade"
        onRequestClose={closePrescriptionZipDetail}
      >
        <View style={styles.imagePreviewOverlay}>
          <View style={styles.imagePreviewDialog}>
            <View style={styles.imagePreviewHeader}>
              <View style={styles.imagePreviewTitleWrap}>
                <Text style={styles.imagePreviewTitle} numberOfLines={1}>
                  {prescriptionZipDetail.mapa?.titulo || 'Prescrição'}
                </Text>
                <Text style={styles.imagePreviewSubtitle}>
                  Pacote técnico ZIP
                </Text>
              </View>
              <TouchableOpacity
                onPress={closePrescriptionZipDetail}
                style={styles.imagePreviewClose}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {prescriptionZipMetaItems.length > 0 ? (
              <View style={styles.imagePreviewMetaGrid}>
                {prescriptionZipMetaItems.map(renderImagePreviewMetaChip)}
              </View>
            ) : null}

            <InfoBox
              variant="info"
              title="Prescrição"
              message={PRESCRIPTION_ZIP_DETAILS_MESSAGE}
            />

            {canManagePrescriptionZipDetail ? (
              <View style={styles.imagePreviewManagePanel}>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonSecondary,
                    prescriptionZipManageDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={handleSolicitarSubstituirPrescriptionZip}
                  activeOpacity={0.78}
                  disabled={prescriptionZipManageDialog.loading}
                >
                  <Ionicons name="swap-horizontal-outline" size={17} color={colors.primary} />
                  <Text style={styles.geoJsonManageButtonTextSecondary}>
                    Substituir ZIP
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonDanger,
                    prescriptionZipManageDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={handleSolicitarRemoverPrescriptionZip}
                  activeOpacity={0.78}
                  disabled={prescriptionZipManageDialog.loading}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                  <Text style={styles.geoJsonManageButtonTextDanger}>
                    Remover prescrição local
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Modal de Detalhe do Talhão */}
      <TalhaoDetailModal
        visible={talhaoDetailVisible}
        talhao={selectedTalhao}
        propriedadeNome={fazendaContextoInfo?.fazendaNome}
        origemDemarcacao={origemDemarcacaoTalhao}
        periodosTalhao={periodosTalhaoConsulta.doTalhao}
        periodosPropriedade={periodosTalhaoConsulta.daPropriedade}
        cadernosTalhao={cadernosTalhaoConsulta}
        materiaisTalhao={materiaisTalhaoConsulta.doTalhao}
        materiaisPropriedade={materiaisTalhaoConsulta.daPropriedade}
        canCreateCaderno={podeCriarCadernoNoTalhao}
        canManagePeriodo={podeGerenciarPeriodoNoTalhao}
        isProdutorView={isProdutorView}
        getCadernoTipoLabel={getCadernoTipoLabel}
        getCadernoTalhaoLabel={getCadernoTalhaoLabel}
        getCadernoPeriodoProdutivoLabel={getCadernoPeriodoProdutivoLabel}
        onCreateCaderno={handleNovoCadernoTalhao}
        onCreatePeriodo={handleNovoPeriodoTalhao}
        onViewMateriaisTalhao={handleFiltrarMateriaisTalhao}
        onViewMapa={handleVerTalhaoNoMapa}
        onOpenCaderno={handleAbrirCadernoTalhao}
        onOpenMaterial={handleDownload}
        onClose={() => {
          setTalhaoDetailVisible(false);
        }}
      />
    </View>
  );
}

// ──────────────────────────────────────────────
// ESTILOS
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.muted,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  blockedTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  blockedText: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  blockedButton: {
    backgroundColor: colors.primary,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  blockedButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  scrollContent: {
    flex: 1,
  },

  // ── CONTEXTO ──
  contextoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  contextoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextoTextos: {
    flex: 1,
    minWidth: 0,
  },
  contextoLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
    marginBottom: 2,
  },
  contextoTitulo: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightBold,
  },
  contextoSubtitulo: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 2,
  },

  // ── BUSCA ──
  searchContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },

  // ── FILTRO ANO ──
  anoFilterContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  anoFilterLabel: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.xs,
  },
  anoFilterContent: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  anoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginRight: spacing.xs,
    maxWidth: 190,
  },
  anoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  anoChipText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  anoChipTextActive: {
    color: colors.white,
  },
  limparFiltrosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  limparFiltrosText: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },

  // ── ORDENAÇÃO ──
  ordenacaoContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ordenacaoLabel: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.xs,
  },
  ordenacaoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ordenacaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ordenacaoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ordenacaoChipText: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },
  ordenacaoChipTextActive: {
    color: colors.white,
    fontWeight: typography.weightBold,
  },

  // ── CATEGORIAS ──
  categoriasContainer: {
    flexGrow: 0,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoriasContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  categoriaChipAtiva: {
    backgroundColor: colors.primary,
  },
  categoriaTexto: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  categoriaTextoAtiva: {
    color: colors.white,
  },

  // ── STATS ──
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: spacing.radius,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statNumero: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── BOTÃO MAPA ──
  btnMapaSatelite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  btnMapaSateliteIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMapaSateliteTextos: {
    flex: 1,
  },
  btnMapaSateliteTitulo: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  btnMapaSateliteSubtitulo: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 1,
  },

  geoJsonImportSection: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
  },
  geoJsonImportInfo: {
    marginBottom: spacing.md,
  },
  geoJsonImportSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
    marginBottom: spacing.md,
  },
  geoJsonImportSummaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoJsonImportSummaryText: {
    flex: 1,
    minWidth: 0,
  },
  geoJsonImportSummaryTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  geoJsonImportSummaryName: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    marginTop: 2,
  },
  geoJsonImportSummaryMeta: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 4,
  },
  geoJsonImportNextStep: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  geoJsonManageHelp: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  geoJsonManageActions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  geoJsonManageButton: {
    minHeight: 42,
    borderRadius: spacing.radiusSm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  geoJsonManageButtonSecondary: {
    backgroundColor: colors.accent,
    borderColor: colors.primaryLight,
  },
  geoJsonManageButtonDanger: {
    backgroundColor: colors.errorBgLight,
    borderColor: colors.errorLight,
  },
  geoJsonManageButtonTextSecondary: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
    color: colors.primary,
    textAlign: 'center',
  },
  geoJsonManageButtonTextDanger: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
    color: colors.error,
    textAlign: 'center',
  },
  geoJsonLayerWarningInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.amberLight,
    marginBottom: spacing.md,
  },
  geoJsonLayerWarningInlineText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontCaption,
    color: colors.text,
    lineHeight: 17,
  },
  geoJsonImportEmpty: {
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  geoJsonImportEmptyText: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    lineHeight: 18,
  },
  geoJsonImportButton: {
    minHeight: 44,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  geoJsonImportButtonDisabled: {
    opacity: 0.65,
  },
  geoJsonImportButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
    textAlign: 'center',
  },
  geoJsonLayerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accent,
  },
  geoJsonLayerIndicatorWarning: {
    backgroundColor: colors.amberLight,
    borderColor: colors.warningLight,
  },
  geoJsonLayerIndicatorTextos: {
    flex: 1,
    minWidth: 0,
  },
  geoJsonLayerIndicatorTitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    fontWeight: typography.weightBold,
  },
  geoJsonLayerIndicatorSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 2,
  },
  geoJsonPreviewOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  geoJsonPreviewDialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  geoJsonPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  geoJsonPreviewTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  geoJsonPreviewTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  geoJsonPreviewSubtitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  geoJsonPreviewClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoJsonPreviewBody: {
    maxHeight: 430,
  },
  geoJsonPreviewContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  geoJsonPreviewRows: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    overflow: 'hidden',
  },
  geoJsonPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  geoJsonPreviewLabel: {
    width: 118,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.muted,
  },
  geoJsonPreviewValue: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    lineHeight: 18,
  },
  geoJsonSelaWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.amberLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  geoJsonSelaWarningText: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
  },
  geoJsonWarningsBox: {
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  geoJsonWarningsTitle: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  geoJsonWarningItem: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
    marginTop: 2,
  },
  geoJsonPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  geoJsonPreviewCancelButton: {
    minHeight: 42,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  geoJsonPreviewCancelText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  geoJsonPreviewConfirmButton: {
    minHeight: 42,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
  },
  geoJsonPreviewConfirmButtonDisabled: {
    opacity: 0.65,
  },
  geoJsonPreviewConfirmText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  pngImportPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  pngImportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pngImportHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pngImportHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  pngImportTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  pngImportSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
    marginTop: 2,
  },
  pngImportSummaryList: {
    gap: spacing.sm,
  },
  pngImportSummaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  pngImportSummaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pngImportSummaryText: {
    flex: 1,
    minWidth: 0,
  },
  pngImportSummaryTitle: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  pngImportSummaryMeta: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
    marginTop: 2,
  },
  pngImportMoreText: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },
  pngImportEmpty: {
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  pngImportEmptyText: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    lineHeight: 18,
  },
  materialImportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  materialImportActionButton: {
    minWidth: 150,
  },
  pngImportNextStep: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
  },
  pngFileBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  pngFileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pngFileText: {
    flex: 1,
    minWidth: 0,
  },
  pngFileLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
  },
  pngFileName: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    fontWeight: typography.weightBold,
    lineHeight: 18,
    marginTop: 2,
  },
  pngFileMeta: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 2,
  },
  pngFormRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pngFormRowItem: {
    flex: 1,
    minWidth: 0,
  },
  pngVisibilityToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  pngVisibilityText: {
    flex: 1,
    minWidth: 0,
  },
  pngVisibilityTitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    fontWeight: typography.weightBold,
  },
  pngVisibilitySubtitle: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 17,
    marginTop: 2,
  },

  materiaisDescription: {
    marginBottom: spacing.lg,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  imagePreviewDialog: {
    width: '100%',
    maxWidth: 720,
    height: '86%',
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  imagePreviewTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  imagePreviewTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  imagePreviewSubtitle: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
    marginTop: 2,
  },
  imagePreviewMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.backgroundSoft,
  },
  imagePreviewManagePanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  imagePreviewMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  imagePreviewMetaTextos: {
    minWidth: 0,
    maxWidth: 170,
  },
  imagePreviewMetaLabel: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
  },
  imagePreviewMetaValue: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightBold,
    marginTop: 1,
  },
  imagePreviewClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewImage: {
    flex: 1,
    width: '100%',
    maxWidth: SCREEN_WIDTH - spacing.md * 2,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  imagePreviewErrorBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.errorLight,
    backgroundColor: colors.errorBgLight,
  },
  imagePreviewErrorText: {
    flex: 1,
    minWidth: 0,
    color: colors.error,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },

  // ── MAPAS LISTA ──
  mapasLista: {
    padding: spacing.md,
    gap: spacing.md,
  },
  categoriaSecao: {
    marginBottom: spacing.lg,
  },
  categoriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  categoriaTitulo: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  categoriaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius,
    minWidth: 24,
    alignItems: 'center',
  },
  categoriaBadgeTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // ── MAPA CARD ──
  mapaCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.md,
  },
  mapaHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  mapaIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  mapaInfo: {
    flex: 1,
    minWidth: 0,
  },
  mapaTitulo: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 3,
  },
  mapaTipoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  mapaTipoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  mapaTipoTagImagem: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info + '40',
  },
  mapaTipoTexto: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightBold,
  },
  mapaTipoTextoImagem: {
    color: colors.info,
  },
  mapaSubcategoria: {
    fontSize: typography.fontCaption + 1,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
    marginBottom: 3,
  },
  mapaContexto: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    marginBottom: 3,
  },
  mapaDetalhes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mapaDetalhe: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
  },
  mapaMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  mapaMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  mapaMetaTextos: {
    minWidth: 0,
    maxWidth: 150,
  },
  mapaMetaLabel: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
  },
  mapaMetaValor: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightBold,
    marginTop: 1,
  },
  mapaObservacao: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  mapaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  downloadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
  },
  downloadIndicatorDisponivel: {
    backgroundColor: colors.successBg,
  },
  downloadIndicatorIndisponivel: {
    backgroundColor: colors.amberLight,
  },
  downloadTexto: {
    fontSize: typography.fontCaption,
    color: colors.success,
    fontWeight: typography.weightSemibold,
  },
  downloadTextoIndisponivel: {
    color: colors.warning,
  },
  materialIndisponivelTexto: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  materiaisSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  materiaisCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },

  // ── SHAPE SECTION ──
  shapeSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  shapeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  shapeSectionTitle: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    flex: 1,
  },
  anoTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
  },
  anoTagText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // ── TALHÃO LIST ──
  talhaoListSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  talhaoListTitle: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  talhaoCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  talhaoCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent + '30',
  },
  talhaoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  talhaoColorBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  talhaoCardInfo: {
    flex: 1,
  },
  talhaoCardNome: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  talhaoCardSub: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 1,
  },
  talhaoCardContexto: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 1,
  },
  talhaoCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  talhaoCardArea: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  talhaoCardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  talhaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  talhaoChipOffline: {
    backgroundColor: colors.successBg,
    borderColor: colors.success + '40',
  },
  talhaoChipText: {
    fontSize: typography.fontSmall + 1,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
  },

  // ── EMPTY ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
    minHeight: 350,
  },
  emptyText: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
