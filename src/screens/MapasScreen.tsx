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
  ActiveFilterBar,
  FilterBottomSheet,
  FilterSection,
  FilterTrigger,
  FormField,
  InfoBox,
  SearchBar,
  SectionCard,
  SegmentedChips,
  SelectField,
} from '../components';
import { Produtor, LimiteArea, CadernoCampo } from '../api/mock';
import {
  buildFazendaMapaRouteParamsFromPropriedade,
  resolveRouteFazendaId,
} from '../navigation/mapaRouteCompat';
import { buildMaterialViewerRouteParams } from '../navigation/materialRouteCompat';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import {
  avaliarAcessoFazendaPorId,
  filtrarLimitesPorFazendaIds,
  filtrarCadernosPorFazendaIds,
  filtrarProdutoresPorAcesso,
  getFazendaId,
  getLimiteAreaFazendaId,
  getMapaFazendaId,
  podeIncluirCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  buildFazendaConsultaOptions,
  buildFazendaUiInfoMap,
  getFazendaUiInfo,
} from '../utils/fazendaUiCompat';
import { formatAreaHa, summarizeMappedArea } from '../utils/talhaoMedidasCompat';
import { avaliarDownloadMapa } from '../utils/mapaDownloadCompat';
import {
  PNG_LOCAL_MAPA_OPEN_ERROR_MESSAGE,
  isPngLocalMapa,
  resolveMapaPngImageSource,
} from '../utils/pngMapToMapaCompat';
import {
  PRESCRIPTION_ZIP_DETAILS_MESSAGE,
  isPrescriptionZipLocalMapa,
} from '../utils/prescriptionZipToMapaCompat';
import {
  MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE,
  isMaterialTecnicoLocalMapa,
  resolveMaterialTecnicoImageSource,
} from '../utils/materialTecnicoToMapaCompat';
import {
  getMaterialPublicDescription,
  getMaterialPublicTitle,
  getMaterialScopeLabel,
  getMaterialVersionLabel,
} from '../utils/materialPresentationCompat';
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
import { listActivePngMapImportsForPropriedade } from '../services/PngMapPropertyImportWorkflow';
import {
  MATERIAL_TECNICO_CATEGORY_OPTIONS,
  MATERIAL_TECNICO_ESCOPO_OPTIONS,
  MATERIAL_TECNICO_PROFUNDIDADE_OPTIONS,
  canStartMaterialTecnicoPropertyImport,
  confirmMaterialTecnicoPropertyImport,
  listActiveMaterialTecnicoImportsForPropriedade,
  prepareMaterialTecnicoPropertyImport,
} from '../services/MaterialTecnicoPropertyImportWorkflow';
import type {
  MaterialTecnicoPropertyImportFormInput,
  MaterialTecnicoPropertyImportPreview,
} from '../services/MaterialTecnicoPropertyImportWorkflow';
import {
  canManageMaterialTecnicoItem,
  removeMaterialTecnicoForPropriedade,
} from '../services/MaterialTecnicoPropertyManageWorkflow';
import {
  canManagePngMapItem,
  removePngMapForPropriedade,
  replacePngMapForPropriedade,
} from '../services/PngMapPropertyManageWorkflow';
import { PngStorageService } from '../services/PngStorageService';
import type { PngMapImportMetadata } from '../types/anexoPngLocal';
import { listActivePrescriptionZipImportsForPropriedade } from '../services/PrescriptionZipPropertyImportWorkflow';
import {
  canManagePrescriptionZipItem,
  removePrescriptionZipForPropriedade,
  replacePrescriptionZipForPropriedade,
} from '../services/PrescriptionZipPropertyManageWorkflow';
import type { PrescriptionZipImportMetadata } from '../types/anexoPrescricaoZipLocal';
import type {
  MaterialTecnicoCategoria,
  MaterialTecnicoImportMetadata,
} from '../types/materialTecnicoLocal';
import { MaterialTecnicoStorageService } from '../services/MaterialTecnicoStorageService';
import {
  buildMateriaisCatalogo,
  MaterialCatalogService,
} from '../services/MaterialCatalogService';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import {
  filtrarRegistrosDoTalhao,
  getTalhaoConsultaId,
  getTalhaoConsultaNome,
  getTalhaoOrigemDemarcacaoLabel,
  getTalhaoStableId,
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

const EMPTY_MATERIAL_TECNICO_FORM: MaterialTecnicoPropertyImportFormInput = {
  ano: '',
  periodo_produtivo_id: '',
  periodo_produtivo_label: '',
  profundidade: 'nao_informada',
  escopo: 'propriedade',
  talhao_id: '',
  talhao_nome: '',
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

const getMapaAno = (mapa: any): string => {
  const anoDireto = typeof mapa?.ano === 'number'
    ? mapa.ano
    : typeof mapa?.ano === 'string' && /^\d{4}$/.test(mapa.ano.trim())
      ? Number.parseInt(mapa.ano.trim(), 10)
      : null;

  if (anoDireto && Number.isFinite(anoDireto)) return String(anoDireto);

  const anoData = getAnoData(mapa?.data_criacao || mapa?.importado_em);
  return anoData ? String(anoData) : '';
};

const getMapaSafra = (mapa: any): string => {
  const periodoLabel = typeof mapa?.periodo_produtivo_label === 'string'
    ? mapa.periodo_produtivo_label.trim()
    : '';
  if (periodoLabel) return periodoLabel;

  const safra = typeof mapa?.safra === 'string' ? mapa.safra.trim() : '';
  return safra;
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

const getMapaProfundidade = (mapa: any): string => {
  const profundidade = typeof mapa?.profundidade === 'string' ? mapa.profundidade.trim() : '';
  return profundidade === 'nao_informada' ? 'Não informada' : profundidade;
};

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

const buildAnoOptions = (mapas: any[]): string[] =>
  buildOptionsOrdenadas(mapas.map(getMapaAno))
    .sort((a, b) => Number(b) - Number(a));

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
  const [filtrosMateriaisVisiveis, setFiltrosMateriaisVisiveis] = useState(false);
  const [filtrosMateriaisRascunho, setFiltrosMateriaisRascunho] = useState({
    fazenda: FILTRO_TODOS,
    demarcacao: FILTRO_TODOS,
    talhao: FILTRO_TODOS,
    anoMaterial: FILTRO_TODOS,
    safra: FILTRO_TODOS,
    categoria: FILTRO_TODOS,
    ordenacao: 'recente',
  });
  const [fazendaFiltroOperacional, setFazendaFiltroOperacional] = useState(FILTRO_TODOS);
  const [anoFiltroMateriais, setAnoFiltroMateriais] = useState(FILTRO_TODOS);
  const [safraFiltroMapas, setSafraFiltroMapas] = useState(FILTRO_TODOS);
  const [talhaoFiltroMapas, setTalhaoFiltroMapas] = useState(FILTRO_TODOS);
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
  const [prescriptionZipImports, setPrescriptionZipImports] = useState<PrescriptionZipImportMetadata[]>([]);
  const [materialTecnicoImports, setMaterialTecnicoImports] = useState<MaterialTecnicoImportMetadata[]>([]);
  const [materialCategoriaPickerVisible, setMaterialCategoriaPickerVisible] = useState(false);
  const [materialCategoriaSelecionada, setMaterialCategoriaSelecionada] = useState<MaterialTecnicoCategoria>('fertilidade');
  const [materialTecnicoImporting, setMaterialTecnicoImporting] = useState(false);
  const [materialTecnicoConfirming, setMaterialTecnicoConfirming] = useState(false);
  const [materialTecnicoPreview, setMaterialTecnicoPreview] = useState<MaterialTecnicoPropertyImportPreview | null>(null);
  const [materialTecnicoForm, setMaterialTecnicoForm] = useState<MaterialTecnicoPropertyImportFormInput>(EMPTY_MATERIAL_TECNICO_FORM);
  const [materialTecnicoFormErrors, setMaterialTecnicoFormErrors] = useState<Record<string, string>>({});
  const [materialTecnicoRemoveDialog, setMaterialTecnicoRemoveDialog] = useState<any>({
    visible: false,
    mapa: null,
    loading: false,
  });
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
          setMaterialTecnicoImports([]);
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

      const [catalogoMateriais, todosLimites, todosCadernos] = await Promise.all([
        MaterialCatalogService.consultarMateriais({
          propriedadeIds: idsPermitidos,
          perfil: user?.perfil,
        }),
        LimiteArea.list(),
        CadernoCampo.list(),
      ]);

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
      const [importsGeoJson, talhoesLayer, periodosLocais] = await Promise.all([
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
      ]);

      setMapas(catalogoMateriais.fontes.mapasBase);
      setCadernos(cadernosFiltrados);
      setPeriodosProdutivos(periodosLocais);
      setLimites(limitesFiltrados);
      setGeoJsonImports(importsGeoJson);
      setPngImports(catalogoMateriais.fontes.pngImports);
      setPrescriptionZipImports(catalogoMateriais.fontes.prescriptionZipImports);
      setMaterialTecnicoImports(catalogoMateriais.fontes.materialTecnicoImports);
      setGeoJsonTalhoesLayer(talhoesLayer);

      const baseTalhoesParaAno = isGeoJsonTalhoesLayerActive(talhoesLayer)
        ? talhoesLayer.talhoes
        : limitesFiltrados;
      const anos = [...new Set(baseTalhoesParaAno.map(l => l.ano))].sort((a: any, b: any) => Number(b) - Number(a));
      setAnosDisponiveis(anos);
      setAnoFiltroLimite((anoAtual) => {
        if (anos.length === 0) return null;
        return anoAtual && anos.includes(anoAtual) ? anoAtual : null;
      });
    } catch (error) {
      setCadernos([]);
      setPeriodosProdutivos([]);
      setGeoJsonImports([]);
      setPngImports([]);
      setPrescriptionZipImports([]);
      setMaterialTecnicoImports([]);
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
  const podeAnexarMaterialTecnico = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canStartMaterialTecnicoPropertyImport(user, contextoConsulta.fazenda);
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
  const materialTecnicoImportsAtivos = useMemo(
    () => materialTecnicoImports.filter((item) => item.status === 'ativo'),
    [materialTecnicoImports]
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
  const catalogoMateriais = useMemo(
    () => buildMateriaisCatalogo({
      mapasBase: mapas,
      pngImports,
      prescriptionZipImports,
      materialTecnicoImports,
    }, {
      propriedadeIds: propriedadeIdsPermitidos,
      perfil: user?.perfil,
    }),
    [mapas, pngImports, prescriptionZipImports, materialTecnicoImports, propriedadeIdsPermitidos, user?.perfil]
  );

  const mapasNoContexto = useMemo(() => {
    if (!fazendaFiltroId) return catalogoMateriais;
    return catalogoMateriais.filter((mapa) => getMapaFazendaId(mapa) === fazendaFiltroId);
  }, [catalogoMateriais, fazendaFiltroId]);
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

  const anosMateriais = useMemo(
    () => buildAnoOptions(materiaisTecnicosNoContexto),
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
        const id = getTalhaoStableId(talhao);
        if (!id || !nome || seen.has(id)) return;
        seen.add(id);
        options.push({
          value: id,
          label: nome,
          description: formatAreaHa(talhao?.area_hectares),
        });
      });

    return options;
  }, [talhoesDemarcacaoNoContexto]);
  const materialPeriodoOptions = useMemo(() => {
    const propriedadeId = fazendaContextoInfo?.id || '';
    const options = periodosProdutivos
      .filter((periodo: any) => {
        const periodoPropriedadeId = periodo?.propriedade_id
          || periodo?.propriedadeId
          || periodo?.fazenda_id
          || periodo?.fazendaId;
        return propriedadeId && periodoPropriedadeId === propriedadeId;
      })
      .map((periodo: any) => ({
        value: String(periodo.id),
        label: String(periodo.label || [
          periodo.tipo_periodo_label,
          periodo.cultura,
          periodo.ano_agricola,
        ].filter(Boolean).join(' • ')),
      }));

    return [
      { value: '', label: 'Não relacionar' },
      ...options,
    ];
  }, [fazendaContextoInfo?.id, periodosProdutivos]);

  useEffect(() => {
    if (anoFiltroMateriais !== FILTRO_TODOS && !anosMateriais.includes(anoFiltroMateriais)) {
      setAnoFiltroMateriais(FILTRO_TODOS);
    }
  }, [anosMateriais, anoFiltroMateriais]);

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
      const anoMapa = getMapaAno(m);
      const safraMapa = getMapaSafra(m);
      const talhaoMapa = getMapaTalhao(m);
      const profundidadeMapa = getMapaProfundidade(m);
      const matchCategoria = categoriaAtiva === FILTRO_TODOS || m.categoria === categoriaAtiva;
      const matchAno = anoFiltroMateriais === FILTRO_TODOS || anoMapa === anoFiltroMateriais;
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
        anoMapa,
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

      return matchCategoria && matchBusca && matchAno && matchSafra && matchTalhao;
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
    anoFiltroMateriais,
    safraFiltroMapas,
    talhaoFiltroMapas,
    ordenacao,
  ]);

  const mapasPorAnoECategoria = useMemo(() => {
    const grupos = new Map<string, any[]>();

    mapasFiltrados.forEach((mapa) => {
      const ano = getMapaAno(mapa) || 'nao-informado';
      grupos.set(ano, [...(grupos.get(ano) || []), mapa]);
    });

    return [...grupos.entries()]
      .sort(([anoA], [anoB]) => {
        if (anoA === 'nao-informado') return 1;
        if (anoB === 'nao-informado') return -1;
        return Number(anoB) - Number(anoA);
      })
      .map(([ano, materiais]) => ({
        ano,
        categorias: CATEGORIAS
          .filter((categoria) => categoria.id !== FILTRO_TODOS)
          .filter((categoria) => categoriaAtiva === FILTRO_TODOS || categoria.id === categoriaAtiva)
          .map((categoria) => ({
            ...categoria,
            mapas: materiais.filter((mapa) => mapa.categoria === categoria.id),
          }))
          .filter((categoria) => categoria.mapas.length > 0),
      }));
  }, [mapasFiltrados, categoriaAtiva]);

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
      return anoAtual && anos.includes(anoAtual) ? anoAtual : null;
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

  const recarregarMaterialTecnicoLocal = useCallback(async (propriedadeId: string) => {
    const importsAtualizados = await listActiveMaterialTecnicoImportsForPropriedade(propriedadeId);
    setMaterialTecnicoImports(importsAtualizados);
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
    const message = isMaterialTecnicoLocalMapa(imagePreview.mapa)
      ? MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE
      : isPngLocalMapa(imagePreview.mapa)
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

  const handleGerenciarMaterialLocal = async (mapa) => {
    if (isMaterialTecnicoLocalMapa(mapa)) {
      if (getFormatoArquivo(mapa) !== 'png') {
        openPrescriptionZipDetail(mapa);
        return;
      }

      try {
        const result = await resolveMaterialTecnicoImageSource(mapa, {
          isSafeMaterialTecnicoStorageUri: MaterialTecnicoStorageService.isSafeMaterialTecnicoStorageUri,
          getStoredMaterialTecnicoInfo: MaterialTecnicoStorageService.getStoredMaterialTecnicoInfo,
        });

        if (!result.ok || !result.source) {
          toast.showError(result.message || MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE);
          return;
        }

        openImagePreview(mapa, result.source);
      } catch {
        toast.showError(MATERIAL_TECNICO_LOCAL_OPEN_ERROR_MESSAGE);
      }
      return;
    }

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
  };

  const handleDownload = (mapa) => {
    const params = buildMaterialViewerRouteParams(mapa);
    if (!params) {
      toast.showError('Não foi possível identificar este material e sua versão.');
      return;
    }

    navigation.navigate('MaterialViewer', params);
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
    setOrdenacao('recente');
    setAnoFiltroMateriais(FILTRO_TODOS);
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

  const updateMaterialTecnicoForm = (patch: Partial<MaterialTecnicoPropertyImportFormInput>) => {
    setMaterialTecnicoForm((current) => ({
      ...current,
      ...patch,
    }));
    setMaterialTecnicoFormErrors((current) => {
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

  const handleMaterialPeriodoChange = (periodoId: string) => {
    const option = materialPeriodoOptions.find((item) => item.value === periodoId);
    updateMaterialTecnicoForm({
      periodo_produtivo_id: periodoId,
      periodo_produtivo_label: periodoId ? option?.label || '' : '',
    });
  };

  const handleMaterialTalhaoChange = (talhaoId: string) => {
    const option = pngTalhaoOptions.find((item: any) => item?.value === talhaoId) as any;
    updateMaterialTecnicoForm({
      talhao_id: talhaoId,
      talhao_nome: option?.label || '',
    });
  };

  const handlePrepararMaterialTecnico = async () => {
    if (!podeAnexarMaterialTecnico || !contextoConsulta.fazenda) {
      toast.showInfo('Abra uma Propriedade dentro do seu escopo para anexar material.');
      return;
    }

    setMaterialCategoriaPickerVisible(false);
    setMaterialTecnicoImporting(true);
    try {
      const result = await prepareMaterialTecnicoPropertyImport({
        user,
        propriedade: contextoConsulta.fazenda,
        categoria: materialCategoriaSelecionada,
      });

      if (!result.ok || !result.preview) {
        if (result.error?.code !== 'PICKER_CANCELLED') {
          toast.showError(result.error?.message || 'Não foi possível validar o arquivo selecionado.');
        }
        return;
      }

      setMaterialCategoriaSelecionada(result.preview.categoria);
      setMaterialTecnicoPreview(result.preview);
      setMaterialTecnicoForm({
        ...EMPTY_MATERIAL_TECNICO_FORM,
        ...result.preview.form,
        ano: result.preview.form.ano ? String(result.preview.form.ano) : '',
        profundidade: result.preview.categoria === 'prescricao'
          ? undefined
          : result.preview.form.profundidade || 'nao_informada',
        escopo: result.preview.categoria === 'correcao'
          ? result.preview.form.escopo || 'propriedade'
          : 'propriedade',
      });
      setMaterialTecnicoFormErrors({});
    } catch {
      toast.showError('Não foi possível preparar o material selecionado.');
    } finally {
      setMaterialTecnicoImporting(false);
    }
  };

  const handleCancelarMaterialTecnicoPreview = () => {
    if (materialTecnicoConfirming) return;
    setMaterialTecnicoPreview(null);
    setMaterialTecnicoForm(EMPTY_MATERIAL_TECNICO_FORM);
    setMaterialTecnicoFormErrors({});
  };

  const handleConfirmarMaterialTecnico = async () => {
    if (!materialTecnicoPreview) return;

    setMaterialTecnicoConfirming(true);
    try {
      const result = await confirmMaterialTecnicoPropertyImport(
        materialTecnicoPreview,
        materialTecnicoForm
      );

      if (!result.ok) {
        if (result.error?.code === 'FORM_INVALID') {
          setMaterialTecnicoFormErrors((result.error.details as Record<string, string>) || {});
          toast.showError('Revise os campos obrigatórios do material.');
          return;
        }

        toast.showError(result.error?.message || 'Não foi possível anexar o material.');
        return;
      }

      const propriedadeId = materialTecnicoPreview.resolvedContext.propriedade_id;
      setMaterialTecnicoPreview(null);
      setMaterialTecnicoForm(EMPTY_MATERIAL_TECNICO_FORM);
      setMaterialTecnicoFormErrors({});
      setMaterialTecnicoImports(result.imports || (result.metadata ? [result.metadata] : []));

      try {
        await recarregarMaterialTecnicoLocal(propriedadeId);
      } catch {
        toast.showWarning('Material salvo, mas não foi possível recarregar o catálogo local agora.');
      }

      toast.showSuccess('Material anexado à Propriedade.');
      if (result.warnings && result.warnings.length > 0) {
        toast.showWarning(result.warnings[0].message);
      }
    } catch {
      toast.showError('Não foi possível concluir o anexo do material.');
    } finally {
      setMaterialTecnicoConfirming(false);
    }
  };

  const handleSolicitarRemoverMaterialTecnico = (mapa: any) => {
    if (
      !contextoConsulta.fazenda
      || !canManageMaterialTecnicoItem(user, contextoConsulta.fazenda, mapa)
    ) {
      toast.showInfo('Abra um material local de uma Propriedade dentro do seu escopo para remover.');
      return;
    }

    setMaterialTecnicoRemoveDialog({ visible: true, mapa, loading: false });
  };

  const handleCancelarRemocaoMaterialTecnico = () => {
    if (materialTecnicoRemoveDialog.loading) return;
    setMaterialTecnicoRemoveDialog({ visible: false, mapa: null, loading: false });
  };

  const handleConfirmarRemocaoMaterialTecnico = async () => {
    const mapa = materialTecnicoRemoveDialog.mapa;
    const propriedade = contextoConsulta.fazenda;
    if (!mapa || !propriedade) {
      handleCancelarRemocaoMaterialTecnico();
      return;
    }

    setMaterialTecnicoRemoveDialog((current) => ({ ...current, loading: true }));
    try {
      const result = await removeMaterialTecnicoForPropriedade({
        user,
        propriedade,
        mapa,
      });
      if (!result.ok) {
        toast.showError(result.error?.message || 'Não foi possível remover o material local.');
        return;
      }

      if (Array.isArray(result.imports)) setMaterialTecnicoImports(result.imports);
      const propriedadeId = result.activeMetadata?.propriedade_id || getFazendaId(propriedade);
      if (propriedadeId) {
        try {
          await recarregarMaterialTecnicoLocal(propriedadeId);
        } catch {
          toast.showWarning('O material foi removido, mas o catálogo não pôde ser recarregado agora.');
        }
      }

      closeImagePreview();
      closePrescriptionZipDetail();
      toast.showSuccess('Material local removido.');
      if (result.warnings && result.warnings.length > 0) {
        toast.showWarning(result.warnings[0].message);
      }
    } catch {
      toast.showError('Não foi possível concluir a remoção do material local.');
    } finally {
      setMaterialTecnicoRemoveDialog({ visible: false, mapa: null, loading: false });
    }
  };

  const tituloTela = 'Materiais técnicos';
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
    || anoFiltroMateriais !== FILTRO_TODOS
    || safraFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroLimite !== FILTRO_TODOS
    || !!anoFiltroLimite
    || busca.trim().length > 0
    || !!fazendaFiltroInfo;
  const temFiltroMaterialAtivo = categoriaAtiva !== FILTRO_TODOS
    || anoFiltroMateriais !== FILTRO_TODOS
    || safraFiltroMapas !== FILTRO_TODOS
    || talhaoFiltroMapas !== FILTRO_TODOS
    || busca.trim().length > 0
    || !!fazendaFiltroInfo;
  const talhaoFiltroAtual = talhaoFiltroLimite !== FILTRO_TODOS
    ? talhaoFiltroLimite
    : talhaoFiltroMapas;
  const resumoAreaMapeada = summarizeMappedArea(limitesFiltrados);
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
  const tituloSecaoMateriais = 'Materiais técnicos';
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
  const anoMaterialFiltroOptions = useMemo(
    () => [
      { value: FILTRO_TODOS, label: 'Todos' },
      ...anosMateriais.map((ano) => ({
        value: ano,
        label: ano,
      })),
    ],
    [anosMateriais]
  );
  const anoDemarcacaoFiltroOptions = useMemo(
    () => [
      { value: FILTRO_TODOS, label: 'Todas' },
      ...anosDisponiveis.map((ano) => ({
        value: String(ano),
        label: `LT ${ano}`,
      })),
    ],
    [anosDisponiveis]
  );
  const filtrosMateriaisAtivos = [
    ...(fazendaFiltroInfo ? [{
      key: 'fazenda',
      label: fazendaFiltroInfo.fazendaNome || 'Propriedade',
      icon: 'business-outline' as const,
      color: colors.primary,
      onRemove: () => setFazendaFiltroOperacional(FILTRO_TODOS),
    }] : []),
    ...(anoFiltroLimite ? [{
      key: 'demarcacao',
      label: `LT ${anoFiltroLimite}`,
      icon: 'calendar-outline' as const,
      color: colors.info,
      onRemove: () => setAnoFiltroLimite(null),
    }] : []),
    ...(talhaoFiltroAtual !== FILTRO_TODOS ? [{
      key: 'talhao',
      label: talhaoFiltroAtual,
      icon: 'location-outline' as const,
      color: colors.secondary,
      onRemove: () => handleTalhaoFiltroChange(FILTRO_TODOS),
    }] : []),
    ...(anoFiltroMateriais !== FILTRO_TODOS ? [{
      key: 'ano-material',
      label: anoFiltroMateriais,
      icon: 'calendar-outline' as const,
      color: colors.info,
      onRemove: () => setAnoFiltroMateriais(FILTRO_TODOS),
    }] : []),
    ...(safraFiltroMapas !== FILTRO_TODOS ? [{
      key: 'safra',
      label: safraFiltroMapas,
      icon: 'leaf-outline' as const,
      color: colors.success,
      onRemove: () => setSafraFiltroMapas(FILTRO_TODOS),
    }] : []),
    ...(categoriaAtiva !== FILTRO_TODOS ? [{
      key: 'categoria',
      label: getCategoriaMapaLabel(categoriaAtiva),
      icon: 'grid-outline' as const,
      color: colors.primary,
      onRemove: () => setCategoriaAtiva(FILTRO_TODOS),
    }] : []),
    ...(ordenacao !== 'recente' ? [{
      key: 'ordenacao',
      label: ORDENACOES_MATERIAIS.find((item) => item.key === ordenacao)?.label || 'Ordenação',
      icon: 'swap-vertical-outline' as const,
      color: colors.teal,
      onRemove: () => setOrdenacao('recente'),
    }] : []),
  ];

  const abrirFiltrosMateriais = () => {
    setFiltrosMateriaisRascunho({
      fazenda: fazendaFiltroOperacional,
      demarcacao: anoFiltroLimite ? String(anoFiltroLimite) : FILTRO_TODOS,
      talhao: talhaoFiltroAtual,
      anoMaterial: anoFiltroMateriais,
      safra: safraFiltroMapas,
      categoria: categoriaAtiva,
      ordenacao,
    });
    setFiltrosMateriaisVisiveis(true);
  };

  const cancelarFiltrosMateriais = () => {
    setFiltrosMateriaisRascunho({
      fazenda: fazendaFiltroOperacional,
      demarcacao: anoFiltroLimite ? String(anoFiltroLimite) : FILTRO_TODOS,
      talhao: talhaoFiltroAtual,
      anoMaterial: anoFiltroMateriais,
      safra: safraFiltroMapas,
      categoria: categoriaAtiva,
      ordenacao,
    });
    setFiltrosMateriaisVisiveis(false);
  };

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
      case 'zip': return 'archive';
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
    if (isMaterialTecnicoLocalMapa(mapa)) {
      return `${getCategoriaMapaLabel(mapa?.categoria)} • PNG local`;
    }
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
    if (isMaterialTecnicoLocalMapa(mapa)) {
      return getCategoriaMapaLabel(mapa?.categoria);
    }
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

    const isMaterialLocal = isMaterialTecnicoLocalMapa(mapa);
    const elementoLabel = getMapaElementoLabel(mapa)
      || (!isMaterialLocal ? mapa?.categoria_label || mapa?.subcategoria : '');
    const safraMapa = getMapaSafra(mapa);
    const talhaoMapa = getMapaTalhao(mapa);
    const profundidadeMapa = getMapaProfundidade(mapa);
    const arquivoNomeOriginal = getMapaArquivoNomeOriginal(mapa);
    const versaoMapa = getMaterialVersionLabel(mapa);
    const dataMapa = mapa?.data_criacao || mapa?.importado_em;

    return [
      { icon: 'image-outline', label: 'Tipo', value: getImagePreviewTipoLabel(mapa) },
      { icon: 'layers-outline', label: isMaterialLocal ? 'Indicação do nome' : 'Camada', value: elementoLabel },
      { icon: 'calendar-outline', label: 'Data', value: dataMapa ? formatarData(dataMapa) : '' },
      { icon: 'leaf-outline', label: 'Safra/Safrinha', value: safraMapa },
      { icon: 'location-outline', label: 'Talhão', value: talhaoMapa },
      { icon: 'resize-outline', label: 'Profundidade', value: profundidadeMapa },
      { icon: 'git-branch-outline', label: 'Versão', value: versaoMapa },
      { icon: 'document-attach-outline', label: 'Nome original', value: arquivoNomeOriginal },
    ].filter((item) => item.value);
  };

  const buildPrescriptionZipMetaItems = (mapa) => {
    if (!mapa) return [];

    const isMaterialLocal = isMaterialTecnicoLocalMapa(mapa);
    const camadaLabel = getMapaElementoLabel(mapa)
      || (!isMaterialLocal ? mapa?.camada_label || mapa?.subcategoria : '');
    const safraMapa = getMapaSafra(mapa);
    const talhaoMapa = getMapaTalhao(mapa);
    const arquivoNomeOriginal = getMapaArquivoNomeOriginal(mapa);
    const versaoMapa = getMaterialVersionLabel(mapa);
    const dataMapa = mapa?.data_criacao || mapa?.importado_em;
    const tamanhoArquivo = mapa?.tamanho_arquivo
      ? formatarTamanhoArquivo(mapa.tamanho_arquivo)
      : '';

    const formatoArquivo = getFormatoArquivo(mapa).toUpperCase();
    const tipoLabel = isMaterialTecnicoLocalMapa(mapa)
      ? getCategoriaMapaLabel(mapa?.categoria)
      : 'Prescrição';

    return [
      { icon: formatoArquivo === 'PDF' ? 'document-text-outline' : 'archive-outline', label: 'Tipo', value: tipoLabel },
      { icon: 'layers-outline', label: isMaterialLocal ? 'Indicação do nome' : 'Camada', value: camadaLabel },
      { icon: 'calendar-outline', label: 'Data', value: dataMapa ? formatarData(dataMapa) : '' },
      { icon: 'leaf-outline', label: 'Safra/Safrinha', value: safraMapa },
      { icon: 'location-outline', label: 'Talhão', value: talhaoMapa },
      { icon: 'git-branch-outline', label: 'Versão', value: versaoMapa },
      { icon: 'document-attach-outline', label: 'Nome original', value: arquivoNomeOriginal },
      { icon: 'server-outline', label: 'Tamanho', value: tamanhoArquivo },
      { icon: 'file-tray-full-outline', label: 'Formato', value: formatoArquivo || 'ZIP' },
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
    const tituloPublico = getMaterialPublicTitle(mapa);
    const descricaoPublica = getMaterialPublicDescription(mapa);
    const escopoMapa = getMaterialScopeLabel(mapa);
    const versaoMapa = getMaterialVersionLabel(mapa);
    const dataMapa = mapa?.data_criacao || mapa?.importado_em;
    const statusDownload = avaliarDownloadMapa(mapa);
    const formatoArquivo = getFormatoArquivo(mapa);
    const isImagemAnexo = isFormatoImagem(formatoArquivo);
    const isMaterialTecnicoLocal = isMaterialTecnicoLocalMapa(mapa);
    const isPngLocal = isPngLocalMapa(mapa);
    const isPrescriptionZip = isPrescriptionZipLocalMapa(mapa);
    const isAnexoFertilidade = mapa?.tipo_anexo === 'anexo_fertilidade';
    const tipoArquivoLabel = getMaterialTipoLabel(mapa);
    const abrirMaterialLabel = isMaterialTecnicoLocal
      ? formatoArquivo === 'png' ? 'Abrir anexo' : 'Ver detalhes'
      : isPngLocal
      ? 'Abrir anexo'
      : isPrescriptionZip
      ? 'Ver detalhes'
      : statusDownload.podeAbrir
      ? isAnexoFertilidade
        ? 'Abrir anexo'
        : 'Abrir material'
      : 'Arquivo não disponível';
    const tipoMaterialLabel = isMaterialTecnicoLocal
      ? isProdutorView ? '' : `${formatoArquivo.toUpperCase()} local`
      : isPngLocal
      ? isProdutorView ? '' : 'Imagem local'
      : isPrescriptionZip
      ? isProdutorView ? '' : 'ZIP local'
      : formatarTipoMaterial(mapa.tipo_material);
    const podeAcionarMapa = Boolean(buildMaterialViewerRouteParams(mapa));
    const indicadorDisponivel = isMaterialTecnicoLocal || isPngLocal || isPrescriptionZip || statusDownload.podeAbrir;
    const podeGerenciarMaterialLocal = Boolean(
      consultaPorFazenda
      && contextoConsulta.fazenda
      && (
        (isMaterialTecnicoLocal && canManageMaterialTecnicoItem(user, contextoConsulta.fazenda, mapa))
        || (isPngLocal && canManagePngMapItem(user, contextoConsulta.fazenda, mapa))
        || (isPrescriptionZip && canManagePrescriptionZipItem(user, contextoConsulta.fazenda, mapa))
      )
    );
    const fazendaMapaInfo = fazendaInfoPorId.get(getMapaFazendaId(mapa))
      || fazendaContextoInfo
      || fazendaFiltroInfo;
    const mapaMetaChips = [
      renderMapaMetaChip(
        'layers-outline',
        isMaterialTecnicoLocal ? 'Indicação do nome' : 'Camada',
        isMaterialTecnicoLocal && elementoLabel === getCategoriaMapaLabel(mapa?.categoria)
          ? ''
          : elementoLabel
      ),
      renderMapaMetaChip('resize-outline', 'Profundidade', profundidadeMapa),
      renderMapaMetaChip('calendar-outline', 'Data', dataMapa ? formatarData(dataMapa) : ''),
      renderMapaMetaChip('leaf-outline', 'Safra/Safrinha', safraMapa),
      renderMapaMetaChip('location-outline', 'Escopo', escopoMapa || talhaoMapa),
      renderMapaMetaChip('home-outline', 'Propriedade', fazendaMapaInfo?.fazendaNome),
      renderMapaMetaChip('git-branch-outline', 'Versão', versaoMapa),
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
          <Text style={styles.mapaTitulo} numberOfLines={2}>{tituloPublico}</Text>
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
          {descricaoPublica ? (
            <Text style={styles.mapaObservacao} numberOfLines={2}>{descricaoPublica}</Text>
          ) : null}
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
        {podeGerenciarMaterialLocal ? (
          <TouchableOpacity
            style={styles.manageMaterialButton}
            onPress={(event) => {
              event.stopPropagation();
              void handleGerenciarMaterialLocal(mapa);
            }}
            accessibilityRole="button"
            accessibilityLabel="Gerenciar material local"
          >
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.manageMaterialButtonText}>Gerenciar</Text>
          </TouchableOpacity>
        ) : null}
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
      {!isMaterialTecnicoLocal && !isPngLocal && !isPrescriptionZip && !statusDownload.podeAbrir && (
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
          <Text style={styles.talhaoCardArea}>{formatAreaHa(talhao.area_hectares)}</Text>
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
                  `${geoJsonImportAtivo.talhoes_count ?? 0} ${(geoJsonImportAtivo.talhoes_count ?? 0) === 1 ? 'talhão' : 'talhões'}`,
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
    if (!podeAnexarMaterialTecnico) return null;

    return (
      <View style={styles.pngImportPanel}>
        <View style={styles.pngImportHeader}>
          <View style={styles.pngImportHeaderIcon}>
            <Ionicons name="image-outline" size={18} color={colors.info} />
          </View>
          <View style={styles.pngImportHeaderText}>
            <Text style={styles.pngImportTitle}>Materiais locais da Propriedade</Text>
            <Text style={styles.pngImportSubtitle}>
              Novos anexos seguem a organização por ano e categoria, preservando os fluxos locais anteriores.
            </Text>
          </View>
        </View>

        {materialTecnicoImportsAtivos.length > 0 ? (
          <View style={styles.pngImportSummaryList}>
            {materialTecnicoImportsAtivos.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.pngImportSummaryItem}>
                <View style={styles.pngImportSummaryIcon}>
                  <Ionicons
                    name={item.formato_arquivo === 'png' ? 'image-outline' : item.formato_arquivo === 'pdf' ? 'document-text-outline' : 'archive-outline'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.pngImportSummaryText}>
                  <Text style={styles.pngImportSummaryTitle} numberOfLines={1}>
                    {item.arquivo_nome_original}
                  </Text>
                  <Text style={styles.pngImportSummaryMeta} numberOfLines={2}>
                    {[
                      item.ano,
                      item.categoria_label,
                      item.periodo_produtivo_label,
                      item.profundidade === 'nao_informada' ? 'Profundidade não informada' : item.profundidade,
                      item.escopo === 'talhao' ? item.talhao_nome : null,
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </View>
            ))}
            {materialTecnicoImportsAtivos.length > 3 ? (
              <Text style={styles.pngImportMoreText}>
                +{materialTecnicoImportsAtivos.length - 3} outros materiais no catálogo local.
              </Text>
            ) : null}
          </View>
        ) : null}

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
        ) : materialTecnicoImportsAtivos.length === 0 && prescriptionZipImportsAtivos.length === 0 ? (
          <View style={styles.pngImportEmpty}>
            <Text style={styles.pngImportEmptyText}>
              Nenhum material local anexado a esta Propriedade.
            </Text>
          </View>
        ) : null}

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
          <TouchableOpacity
            style={[
              styles.geoJsonImportButton,
              styles.materialImportActionButton,
              materialTecnicoImporting && styles.geoJsonImportButtonDisabled,
            ]}
            onPress={() => setMaterialCategoriaPickerVisible(true)}
            activeOpacity={0.78}
            disabled={materialTecnicoImporting}
          >
            {materialTecnicoImporting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="attach-outline" size={18} color={colors.white} />
            )}
            <Text style={styles.geoJsonImportButtonText}>
              Anexar material
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pngImportNextStep}>
          PNG abre como imagem. PDF e ZIP exibem detalhes honestos do arquivo local, sem processamento no aparelho.
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
          placeholder="Buscar material, ano, talhão, safra, propriedade..."
        />
      </View>

      <View style={styles.materialFilterControls}>
        <FilterTrigger
          activeCount={filtrosMateriaisAtivos.length}
          onPress={abrirFiltrosMateriais}
          label="Filtros do panorama"
          style={styles.materialFilterTrigger}
        />
        <ActiveFilterBar
          items={filtrosMateriaisAtivos}
          onClear={limparFiltrosPanorama}
          style={styles.materialActiveFilters}
        />
      </View>

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
          <Text style={styles.statNumero} numberOfLines={1}>{resumoAreaMapeada.valorFormatado}</Text>
          <Text style={styles.statLabel}>{resumoAreaMapeada.label}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>{materiaisTecnicosNoContexto.length}</Text>
          <Text style={styles.statLabel}>Materiais</Text>
        </View>
      </View>
      <Text style={styles.areaMapeadaApoio}>
        A área mapeada corresponde aos Talhões que possuem medida disponível na camada atual.
      </Text>

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
              : 'Consulte materiais locais em PNG, PDF ou ZIP e os anexos legados deste aparelho. Esta tela não envia nem publica arquivos.'
          }
          style={styles.materiaisDescription}
        />
        {renderPngImportPanel()}
      </SectionCard>

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
              ? 'Tente ajustar ano, Safra/Safrinha, talhão, categoria ou busca.'
              : isProdutorView
                ? 'Nenhum material técnico liberado para consulta nesta Propriedade.'
                : 'Quando materiais previamente preparados forem liberados para este contexto, eles aparecerão aqui para consulta.'
          }
          style={styles.emptyContainer}
        />
      ) : (
        <View style={styles.mapasLista}>
          {mapasPorAnoECategoria.map((grupo) => {
            const totalDoAno = grupo.categorias.reduce(
              (total, categoria) => total + categoria.mapas.length,
              0
            );

            return (
              <View key={grupo.ano} style={styles.categoriaSecao}>
                <View style={styles.categoriaHeader}>
                  <Ionicons name="calendar-outline" size={28} color={colors.primary} />
                  <Text style={styles.categoriaTitulo}>
                    {grupo.ano === 'nao-informado' ? 'Ano não informado' : `Ano ${grupo.ano}`}
                  </Text>
                  <View style={styles.categoriaBadge}>
                    <Text style={styles.categoriaBadgeTexto}>{totalDoAno}</Text>
                  </View>
                </View>

                {grupo.categorias.map((categoria) => (
                  <View key={`${grupo.ano}:${categoria.id}`} style={styles.categoriaSecao}>
                    <View style={styles.categoriaHeader}>
                      <Ionicons name={categoria.icon} size={24} color={colors.primary} />
                      <Text style={styles.categoriaTitulo}>{categoria.nome}</Text>
                      <View style={styles.categoriaBadge}>
                        <Text style={styles.categoriaBadgeTexto}>{categoria.mapas.length}</Text>
                      </View>
                    </View>
                    {categoria.mapas.map((mapa) => renderMapaCard(mapa))}
                  </View>
                ))}
              </View>
            );
          })}
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
  const isUnifiedMaterialDetail = isMaterialTecnicoLocalMapa(prescriptionZipDetail.mapa);
  const unifiedMaterialDetailFormat = getFormatoArquivo(prescriptionZipDetail.mapa).toUpperCase();
  const materialDetailMessage = isUnifiedMaterialDetail
    ? unifiedMaterialDetailFormat === 'PDF'
      ? 'PDF salvo localmente neste aparelho. O MVP atual apresenta os metadados e o nome original, sem afirmar visualização integrada do documento.'
      : 'ZIP salvo localmente neste aparelho. O MVP atual não descompacta, interpreta nem exibe uma prévia do pacote.'
    : PRESCRIPTION_ZIP_DETAILS_MESSAGE;
  const canManageImagePreviewPng = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && !isMaterialTecnicoLocalMapa(imagePreview.mapa)
    && canManagePngMapItem(user, contextoConsulta.fazenda, imagePreview.mapa);
  const canManageUnifiedImagePreview = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canManageMaterialTecnicoItem(user, contextoConsulta.fazenda, imagePreview.mapa);
  const canManagePrescriptionZipDetail = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && !isUnifiedMaterialDetail
    && canManagePrescriptionZipItem(user, contextoConsulta.fazenda, prescriptionZipDetail.mapa);
  const canManageUnifiedMaterialDetail = consultaPorFazenda
    && !!contextoConsulta.fazenda
    && canManageMaterialTecnicoItem(user, contextoConsulta.fazenda, prescriptionZipDetail.mapa);

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

      <FilterBottomSheet
        visible={filtrosMateriaisVisiveis}
        onRequestClose={cancelarFiltrosMateriais}
        onClear={() => setFiltrosMateriaisRascunho({
          fazenda: FILTRO_TODOS,
          demarcacao: FILTRO_TODOS,
          talhao: FILTRO_TODOS,
          anoMaterial: FILTRO_TODOS,
          safra: FILTRO_TODOS,
          categoria: FILTRO_TODOS,
          ordenacao: 'recente',
        })}
        onApply={() => {
          if (!consultaPorFazenda) {
            setFazendaFiltroOperacional(filtrosMateriaisRascunho.fazenda);
          }
          setAnoFiltroLimite(
            filtrosMateriaisRascunho.demarcacao === FILTRO_TODOS
              ? null
              : anosDisponiveis.find(
                  (ano) => String(ano) === filtrosMateriaisRascunho.demarcacao
                ) ?? null
          );
          handleTalhaoFiltroChange(filtrosMateriaisRascunho.talhao);
          setAnoFiltroMateriais(filtrosMateriaisRascunho.anoMaterial);
          setSafraFiltroMapas(filtrosMateriaisRascunho.safra);
          setCategoriaAtiva(filtrosMateriaisRascunho.categoria);
          setOrdenacao(filtrosMateriaisRascunho.ordenacao);
          setFiltrosMateriaisVisiveis(false);
        }}
        subtitle="Ajuste o contexto, os materiais técnicos e a ordenação"
      >
        {!consultaPorFazenda && fazendaOptions.length > 1 ? (
          <FilterSection title="Propriedade">
            <SegmentedChips
              options={fazendaFiltroOptions}
              value={filtrosMateriaisRascunho.fazenda}
              onChange={(fazenda) => setFiltrosMateriaisRascunho((atual) => ({
                ...atual,
                fazenda,
              }))}
              horizontal
            />
          </FilterSection>
        ) : null}
        {anosDisponiveis.length > 0 ? (
          <FilterSection title="Demarcação">
            <SegmentedChips
              options={anoDemarcacaoFiltroOptions}
              value={filtrosMateriaisRascunho.demarcacao}
              onChange={(demarcacao) => setFiltrosMateriaisRascunho((atual) => ({
                ...atual,
                demarcacao,
              }))}
              horizontal
            />
          </FilterSection>
        ) : null}
        {talhoesPanorama.length > 0 ? (
          <FilterSection title="Talhão">
            <SegmentedChips
              options={talhaoFiltroOptions}
              value={filtrosMateriaisRascunho.talhao}
              onChange={(talhao) => setFiltrosMateriaisRascunho((atual) => ({
                ...atual,
                talhao,
              }))}
              horizontal
            />
          </FilterSection>
        ) : null}
        {anosMateriais.length > 0 ? (
          <FilterSection title="Ano dos materiais">
            <SegmentedChips
              options={anoMaterialFiltroOptions}
              value={filtrosMateriaisRascunho.anoMaterial}
              onChange={(anoMaterial) => setFiltrosMateriaisRascunho((atual) => ({
                ...atual,
                anoMaterial,
              }))}
              horizontal
            />
          </FilterSection>
        ) : null}
        {safrasMapas.length > 0 ? (
          <FilterSection title="Safra/Safrinha">
            <SegmentedChips
              options={safraFiltroOptions}
              value={filtrosMateriaisRascunho.safra}
              onChange={(safra) => setFiltrosMateriaisRascunho((atual) => ({
                ...atual,
                safra,
              }))}
              horizontal
            />
          </FilterSection>
        ) : null}
        <FilterSection title="Categoria">
          <SegmentedChips
            options={categoriaOptions}
            value={filtrosMateriaisRascunho.categoria}
            onChange={(categoria) => setFiltrosMateriaisRascunho((atual) => ({
              ...atual,
              categoria,
            }))}
          />
        </FilterSection>
        <FilterSection title="Ordenar por">
          <SegmentedChips
            options={ordenacaoOptions}
            value={filtrosMateriaisRascunho.ordenacao}
            onChange={(novaOrdenacao) => setFiltrosMateriaisRascunho((atual) => ({
              ...atual,
              ordenacao: novaOrdenacao,
            }))}
          />
        </FilterSection>
      </FilterBottomSheet>

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

      <ConfirmDialog
        visible={materialTecnicoRemoveDialog.visible}
        title="Remover material local"
        message={[
          `Deseja remover "${materialTecnicoRemoveDialog.mapa?.titulo || 'este material'}" deste aparelho?`,
          'A Propriedade, o GeoJSON, os anexos legados e os demais materiais não serão alterados.',
        ].join('\n\n')}
        type="danger"
        confirmText="Remover"
        cancelText="Cancelar"
        loading={materialTecnicoRemoveDialog.loading}
        onConfirm={handleConfirmarRemocaoMaterialTecnico}
        onCancel={handleCancelarRemocaoMaterialTecnico}
      />

      <Modal
        visible={materialCategoriaPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMaterialCategoriaPickerVisible(false)}
      >
        <View style={styles.geoJsonPreviewOverlay}>
          <View style={styles.geoJsonPreviewDialog}>
            <View style={styles.geoJsonPreviewHeader}>
              <View style={styles.geoJsonPreviewTitleWrap}>
                <Text style={styles.geoJsonPreviewTitle}>Anexar material</Text>
                <Text style={styles.geoJsonPreviewSubtitle}>
                  Escolha primeiro onde o arquivo será organizado.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMaterialCategoriaPickerVisible(false)}
                style={styles.geoJsonPreviewClose}
                disabled={materialTecnicoImporting}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.geoJsonPreviewContent}>
              <SelectField
                label="Categoria do material"
                required
                value={materialCategoriaSelecionada}
                options={MATERIAL_TECNICO_CATEGORY_OPTIONS}
                onChange={(categoria) => setMaterialCategoriaSelecionada(categoria as MaterialTecnicoCategoria)}
              />
              <InfoBox
                variant="info"
                title="Organização"
                message="O arquivo ficará vinculado à Propriedade, ao ano informado e à categoria escolhida. São aceitos PNG, PDF e ZIP."
              />
            </View>

            <View style={styles.geoJsonPreviewFooter}>
              <TouchableOpacity
                style={styles.geoJsonPreviewCancelButton}
                onPress={() => setMaterialCategoriaPickerVisible(false)}
                disabled={materialTecnicoImporting}
              >
                <Text style={styles.geoJsonPreviewCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.geoJsonPreviewConfirmButton,
                  materialTecnicoImporting && styles.geoJsonPreviewConfirmButtonDisabled,
                ]}
                onPress={handlePrepararMaterialTecnico}
                disabled={materialTecnicoImporting}
              >
                {materialTecnicoImporting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="document-attach-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.geoJsonPreviewConfirmText}>Escolher arquivo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!materialTecnicoPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelarMaterialTecnicoPreview}
      >
        <View style={styles.geoJsonPreviewOverlay}>
          <View style={styles.geoJsonPreviewDialog}>
            <View style={styles.geoJsonPreviewHeader}>
              <View style={styles.geoJsonPreviewTitleWrap}>
                <Text style={styles.geoJsonPreviewTitle}>Confirmar material</Text>
                <Text style={styles.geoJsonPreviewSubtitle}>
                  {getCategoriaMapaLabel(materialCategoriaSelecionada)} • título gerado pelo nome original
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelarMaterialTecnicoPreview}
                style={styles.geoJsonPreviewClose}
                disabled={materialTecnicoConfirming}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.geoJsonPreviewBody}
              contentContainerStyle={styles.geoJsonPreviewContent}
              keyboardShouldPersistTaps="handled"
            >
              {materialTecnicoPreview ? (
                <>
                  <View style={styles.pngFileBox}>
                    <View style={styles.pngFileIcon}>
                      <Ionicons
                        name={materialTecnicoPreview.file.formato === 'png'
                          ? 'image-outline'
                          : materialTecnicoPreview.file.formato === 'pdf'
                            ? 'document-text-outline'
                            : 'archive-outline'}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.pngFileText}>
                      <Text style={styles.pngFileLabel}>Arquivo selecionado</Text>
                      <Text style={styles.pngFileName} numberOfLines={2}>
                        {materialTecnicoPreview.file.name}
                      </Text>
                      <Text style={styles.pngFileMeta} numberOfLines={2}>
                        {[
                          materialTecnicoPreview.tituloAutomatico,
                          materialTecnicoPreview.file.formato?.toUpperCase(),
                          formatarTamanhoArquivo(materialTecnicoPreview.file.size),
                        ].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  </View>

                  <FormField
                    label="Ano do arquivo"
                    required
                    value={materialTecnicoForm.ano ? String(materialTecnicoForm.ano) : ''}
                    onChangeText={(ano) => updateMaterialTecnicoForm({ ano })}
                    error={materialTecnicoFormErrors.ano}
                    keyboardType="number-pad"
                    placeholder="2025"
                    leftIcon="calendar-outline"
                  />

                  <SelectField
                    label="Safra/Safrinha (opcional)"
                    value={materialTecnicoForm.periodo_produtivo_id || ''}
                    options={materialPeriodoOptions}
                    onChange={handleMaterialPeriodoChange}
                    error={materialTecnicoFormErrors.periodo_produtivo_id}
                    helperText="Somente períodos ativos desta Propriedade."
                  />

                  {materialCategoriaSelecionada === 'fertilidade' || materialCategoriaSelecionada === 'correcao' ? (
                    <SelectField
                      label="Profundidade"
                      required
                      value={materialTecnicoForm.profundidade || 'nao_informada'}
                      options={MATERIAL_TECNICO_PROFUNDIDADE_OPTIONS}
                      onChange={(profundidade) => updateMaterialTecnicoForm({ profundidade })}
                      error={materialTecnicoFormErrors.profundidade}
                    />
                  ) : null}

                  {materialCategoriaSelecionada === 'correcao' ? (
                    <>
                      <SelectField
                        label="Escopo"
                        required
                        value={materialTecnicoForm.escopo || 'propriedade'}
                        options={MATERIAL_TECNICO_ESCOPO_OPTIONS}
                        onChange={(escopo) => updateMaterialTecnicoForm({
                          escopo: escopo === 'talhao' ? 'talhao' : 'propriedade',
                          talhao_id: '',
                          talhao_nome: '',
                        })}
                        error={materialTecnicoFormErrors.escopo}
                      />

                      {materialTecnicoForm.escopo === 'talhao' ? (
                        pngTalhaoOptions.length > 0 ? (
                          <SelectField
                            label="Talhão"
                            required
                            value={materialTecnicoForm.talhao_id || ''}
                            options={pngTalhaoOptions}
                            onChange={handleMaterialTalhaoChange}
                            error={materialTecnicoFormErrors.talhao}
                            placeholder="Selecione o Talhão"
                          />
                        ) : (
                          <InfoBox
                            variant="warning"
                            message="Nenhum Talhão com ID estável está disponível nesta Propriedade. Use o escopo Toda a Propriedade ou cadastre os Talhões antes de anexar."
                          />
                        )
                      ) : null}
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={styles.pngVisibilityToggle}
                    onPress={() => updateMaterialTecnicoForm({
                      visivel_para_produtor: !materialTecnicoForm.visivel_para_produtor,
                    })}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={materialTecnicoForm.visivel_para_produtor ? 'checkbox-outline' : 'square-outline'}
                      size={22}
                      color={materialTecnicoForm.visivel_para_produtor ? colors.primary : colors.muted}
                    />
                    <View style={styles.pngVisibilityText}>
                      <Text style={styles.pngVisibilityTitle}>Visível para Produtor</Text>
                      <Text style={styles.pngVisibilitySubtitle}>
                        O material ficará disponível na consulta do Produtor quando permitido.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <InfoBox
                    variant="info"
                    title="Arquivo local"
                    message={materialTecnicoPreview.file.formato === 'png'
                      ? 'O PNG poderá ser aberto como imagem neste aparelho.'
                      : materialTecnicoPreview.file.formato === 'pdf'
                        ? 'O PDF ficará salvo localmente; o MVP não afirma visualizador integrado.'
                        : 'O ZIP ficará salvo localmente, sem descompactação ou processamento no aparelho.'}
                  />

                  {materialTecnicoPreview.warnings?.length > 0 ? (
                    <View style={styles.geoJsonWarningsBox}>
                      <Text style={styles.geoJsonWarningsTitle}>Avisos da validação</Text>
                      {materialTecnicoPreview.warnings.slice(0, 4).map((warning: any) => (
                        <Text key={`${warning.code}-${warning.message}`} style={styles.geoJsonWarningItem}>
                          {warning.message}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.geoJsonPreviewFooter}>
              <TouchableOpacity
                style={styles.geoJsonPreviewCancelButton}
                onPress={handleCancelarMaterialTecnicoPreview}
                disabled={materialTecnicoConfirming}
              >
                <Text style={styles.geoJsonPreviewCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.geoJsonPreviewConfirmButton,
                  materialTecnicoConfirming && styles.geoJsonPreviewConfirmButtonDisabled,
                ]}
                onPress={handleConfirmarMaterialTecnico}
                disabled={materialTecnicoConfirming}
              >
                {materialTecnicoConfirming ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                )}
                <Text style={styles.geoJsonPreviewConfirmText}>Anexar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  {getMaterialPublicTitle(imagePreview.mapa)}
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
            {canManageUnifiedImagePreview ? (
              <View style={styles.imagePreviewManagePanel}>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonDanger,
                    materialTecnicoRemoveDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={() => handleSolicitarRemoverMaterialTecnico(imagePreview.mapa)}
                  activeOpacity={0.78}
                  disabled={materialTecnicoRemoveDialog.loading}
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
                  {getMaterialPublicTitle(prescriptionZipDetail.mapa)}
                </Text>
                <Text style={styles.imagePreviewSubtitle}>
                  {isUnifiedMaterialDetail
                    ? `${getCategoriaMapaLabel(prescriptionZipDetail.mapa?.categoria)} • ${unifiedMaterialDetailFormat || 'Arquivo local'}`
                    : 'Pacote técnico ZIP'}
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
              title={isUnifiedMaterialDetail ? 'Arquivo local' : 'Prescrição'}
              message={materialDetailMessage}
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
            {canManageUnifiedMaterialDetail ? (
              <View style={styles.imagePreviewManagePanel}>
                <TouchableOpacity
                  style={[
                    styles.geoJsonManageButton,
                    styles.geoJsonManageButtonDanger,
                    materialTecnicoRemoveDialog.loading && styles.geoJsonImportButtonDisabled,
                  ]}
                  onPress={() => handleSolicitarRemoverMaterialTecnico(prescriptionZipDetail.mapa)}
                  activeOpacity={0.78}
                  disabled={materialTecnicoRemoveDialog.loading}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                  <Text style={styles.geoJsonManageButtonTextDanger}>
                    Remover material local
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
        isProdutorView={isProdutorView}
        getCadernoTipoLabel={getCadernoTipoLabel}
        getCadernoTalhaoLabel={getCadernoTalhaoLabel}
        getCadernoPeriodoProdutivoLabel={getCadernoPeriodoProdutivoLabel}
        onCreateCaderno={handleNovoCadernoTalhao}
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

  materialFilterControls: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  materialFilterTrigger: {
    width: '100%',
  },
  materialActiveFilters: {
    marginTop: spacing.md,
    marginBottom: 0,
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
  areaMapeadaApoio: {
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    color: colors.textLight,
    fontSize: typography.fontCaption,
    lineHeight: 16,
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
    borderWidth: 2,
    borderColor: colors.disabledBorder,
    borderStyle: 'dashed',
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
    borderWidth: 2,
    borderColor: colors.disabledBorder,
    borderStyle: 'dashed',
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
    justifyContent: 'space-between',
    gap: spacing.sm,
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
  manageMaterialButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  manageMaterialButtonText: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
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
