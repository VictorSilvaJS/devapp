import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
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
import { Mapa, Produtor, LimiteArea } from '../api/mock';
import {
  buildFazendaMapaRouteParams,
  resolveRouteFazendaId,
} from '../navigation/mapaRouteCompat';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import {
  avaliarAcessoFazendaPorId,
  filtrarLimitesPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarProdutoresPorAcesso,
  getFazendaId,
  getLimiteAreaFazendaId,
  getMapaFazendaId,
} from '../utils/acessoControle';
import {
  buildFazendaConsultaOptions,
  buildFazendaUiInfoMap,
  getFazendaUiInfo,
} from '../utils/fazendaUiCompat';
import {
  avaliarDownloadMapa,
  buildMapaArquivoAssociacaoPayload,
} from '../utils/mapaDownloadCompat';
import { resolveSelaPrataIFertilidadeAssetSource } from '../assets/mapas/sela-prata-i/2025/fertilidade';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ──────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────
const CATEGORIAS = [
  { id: 'todos', nome: 'Todos', icon: 'grid-outline' },
  { id: 'fertilidade', nome: 'Fertilidade', icon: 'leaf-outline' },
  { id: 'correcao', nome: 'Correção', icon: 'construct-outline' },
  { id: 'indice_vegetacao', nome: 'Índice Vegetação', icon: 'analytics-outline' },
  { id: 'panorama', nome: 'Panorama', icon: 'image-outline' },
  { id: 'plantio', nome: 'Plantio', icon: 'git-network-outline' },
];

const FILTRO_TODOS = 'todos';

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

const getMapaTalhao = (mapa: any): string =>
  typeof mapa?.talhao === 'string' ? mapa.talhao.trim() : '';

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
  const subcategoria = typeof mapa?.subcategoria === 'string' ? mapa.subcategoria.trim() : '';
  if (subcategoria) return subcategoria;

  const elemento = typeof mapa?.elemento === 'string' ? mapa.elemento.trim() : '';
  if (!elemento) return '';

  return ELEMENTO_LABELS[elemento] ?? elemento;
};

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
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadMapaId, setUploadMapaId] = useState('');
  const [uploadArquivoUrl, setUploadArquivoUrl] = useState('');
  const [uploadFormato, setUploadFormato] = useState('');
  const [uploadTamanho, setUploadTamanho] = useState('');
  const [materialTipo, setMaterialTipo] = useState('Material técnico');
  const [materialOrigem, setMaterialOrigem] = useState('URL mockada');
  const [materialDescricao, setMaterialDescricao] = useState('');
  const [associandoMaterial, setAssociandoMaterial] = useState(false);

  // Estado técnico de demarcação/panorama
  const [limites, setLimites] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoFiltroLimite, setAnoFiltroLimite] = useState(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [talhaoDetailVisible, setTalhaoDetailVisible] = useState(false);
  const [talhaoFiltroLimite, setTalhaoFiltroLimite] = useState(FILTRO_TODOS);

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
          setLimites([]);
          setAnosDisponiveis([]);
          setAnoFiltroLimite(null);
          setFazendaFiltroOperacional(FILTRO_TODOS);
          setTalhaoFiltroLimite(FILTRO_TODOS);
          setSelectedTalhao(null);
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

      const [todosMapas, todosLimites] = await Promise.all([
        Mapa.list(),
        LimiteArea.list(),
      ]);

      const mapasFiltrados = filtrarMapasPorFazendaIds(todosMapas, idsPermitidos, {
        somenteDisponiveisDownload: user?.perfil === 'produtor',
      });
      const limitesFiltrados = filtrarLimitesPorFazendaIds(todosLimites, idsPermitidos);

      setMapas(mapasFiltrados);
      setLimites(limitesFiltrados);

      const anos = [...new Set(limitesFiltrados.map(l => l.ano))].sort((a: any, b: any) => Number(b) - Number(a));
      setAnosDisponiveis(anos);
      setAnoFiltroLimite((anoAtual) => {
        if (anos.length === 0) return null;
        return anoAtual && anos.includes(anoAtual) ? anoAtual : anos[0];
      });
    } catch (error) {
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
  const fazendaContextoInfo = consultaPorFazenda ? getFazendaUiInfo(contextoConsulta.fazenda) : null;
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

  const mapasNoContexto = useMemo(() => {
    if (!fazendaFiltroId) return mapas;
    return mapas.filter((mapa) => getMapaFazendaId(mapa) === fazendaFiltroId);
  }, [mapas, fazendaFiltroId]);

  const limitesNoContexto = useMemo(() => {
    if (!fazendaFiltroId) return limites;
    return limites.filter((limite) => getLimiteAreaFazendaId(limite) === fazendaFiltroId);
  }, [limites, fazendaFiltroId]);

  const safrasMapas = useMemo(() => buildSafraOptions(mapasNoContexto), [mapasNoContexto]);

  const talhoesMapas = useMemo(
    () => buildOptionsOrdenadas(mapasNoContexto.map(getMapaTalhao)),
    [mapasNoContexto]
  );

  const talhoesLimite = useMemo(
    () => buildOptionsOrdenadas(limitesNoContexto.map((limite: any) => limite?.talhao || limite?.nome || '')),
    [limitesNoContexto]
  );
  const talhoesPanorama = useMemo(
    () => buildOptionsOrdenadas([...talhoesLimite, ...talhoesMapas]),
    [talhoesLimite, talhoesMapas]
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

    return mapasNoContexto.filter(m => {
      const fazendaInfo = fazendaInfoPorId.get(getMapaFazendaId(m));
      const safraMapa = getMapaSafra(m);
      const talhaoMapa = getMapaTalhao(m);
      const profundidadeMapa = getMapaProfundidade(m);
      const matchCategoria = categoriaAtiva === FILTRO_TODOS || m.categoria === categoriaAtiva;
      const matchSafra = safraFiltroMapas === FILTRO_TODOS || safraMapa === safraFiltroMapas;
      const matchTalhao = talhaoFiltroMapas === FILTRO_TODOS || talhaoMapa === talhaoFiltroMapas;
      const textoBusca = [
        m.titulo,
        m.subcategoria,
        m.elemento,
        profundidadeMapa,
        m.tipo_material,
        talhaoMapa,
        safraMapa,
        m.observacoes,
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
      } else if (ordenacao === 'tamanho') {
        return (b.tamanho_arquivo || 0) - (a.tamanho_arquivo || 0);
      }
      return 0;
    });
  }, [
    mapasNoContexto,
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

  const totalMapasComArquivo = useMemo(
    () => mapasNoContexto.filter((mapa) => avaliarDownloadMapa(mapa).podeAbrir).length,
    [mapasNoContexto]
  );
  const mapasPendentesAssociacao = useMemo(
    () => mapasNoContexto.filter((mapa) => !avaliarDownloadMapa(mapa).podeAbrir),
    [mapasNoContexto]
  );
  const podeAssociarMaterial =
    (user?.perfil === 'admin' || user?.perfil === 'colaborador')
    && mapasPendentesAssociacao.length > 0;
  const mapasAssociacaoOptions = useMemo(
    () => [...mapasPendentesAssociacao].sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '')),
    [mapasPendentesAssociacao]
  );
  const mapaUploadSelecionado = useMemo(
    () => mapasAssociacaoOptions.find((mapa) => mapa.id === uploadMapaId) ?? null,
    [mapasAssociacaoOptions, uploadMapaId]
  );
  const materialFazendaSelecionadaInfo = useMemo(() => {
    if (!mapaUploadSelecionado) return fazendaContextoInfo || fazendaFiltroInfo;
    return fazendaInfoPorId.get(getMapaFazendaId(mapaUploadSelecionado))
      || fazendaContextoInfo
      || fazendaFiltroInfo;
  }, [mapaUploadSelecionado, fazendaInfoPorId, fazendaContextoInfo, fazendaFiltroInfo]);

  // ──────────────────────────────────────────────
  // FILTROS DA DEMARCAÇÃO DO PANORAMA
  // ──────────────────────────────────────────────
  const limitesFiltrados = useMemo(() => {
    const termoBusca = normalizarBusca(busca);

    return limitesNoContexto.filter(l => {
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
    limitesNoContexto,
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

  // ──────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────
  const handleDownload = (mapa) => {
    const status = avaliarDownloadMapa(mapa);

    if (!status.podeAbrir) {
      toast.showInfo(status.descricao);
      return;
    }

    const assetSource = resolveSelaPrataIFertilidadeAssetSource(status.arquivoUrl);
    if (assetSource) {
      setImagePreview({
        visible: true,
        mapa,
        source: assetSource,
      });
      return;
    }

    setDownloadDialog({ visible: true, mapa, status });
  };

  const confirmDownload = async () => {
    const status = downloadDialog.status || avaliarDownloadMapa(downloadDialog.mapa);
    setDownloadDialog({ visible: false, mapa: null, status: null });

    if (!status.podeAbrir || !status.arquivoUrl) {
      toast.showInfo(status.descricao);
      return;
    }

    const assetSource = resolveSelaPrataIFertilidadeAssetSource(status.arquivoUrl);
    if (assetSource) {
      setImagePreview({
        visible: true,
        mapa: downloadDialog.mapa,
        source: assetSource,
      });
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

  const preencherUploadComMapa = (mapa) => {
    const status = avaliarDownloadMapa(mapa);
    setUploadMapaId(mapa?.id || '');
    setUploadArquivoUrl(status.podeAbrir ? status.arquivoUrl || '' : '');
    setUploadFormato(mapa?.formato_arquivo || '');
    setUploadTamanho(mapa?.tamanho_arquivo ? String(mapa.tamanho_arquivo) : '');
    setMaterialTipo(formatarTipoMaterial(mapa?.tipo_material) || 'Material técnico');
    setMaterialOrigem('URL mockada');
    setMaterialDescricao(mapa?.observacoes || '');
  };

  const abrirAssociacaoMaterial = (mapa = null) => {
    const mapaBase = mapa || mapasFiltrados[0] || mapasAssociacaoOptions[0];
    if (!mapaBase) {
      toast.showInfo('Não há mapas no contexto atual para associar material.');
      return;
    }

    preencherUploadComMapa(mapaBase);
    setUploadDialog(true);
  };

  const handleAssociarMaterial = async () => {
    const mapaSelecionado = mapasAssociacaoOptions.find((mapa) => mapa.id === uploadMapaId);

    if (!mapaSelecionado) {
      toast.showError('Selecione um mapa para associar o material.');
      return;
    }

    const result = buildMapaArquivoAssociacaoPayload({
      arquivoUrl: uploadArquivoUrl,
      formatoArquivo: uploadFormato,
      tamanhoArquivo: uploadTamanho,
    });

    if (result.ok === false) {
      toast.showError(result.mensagem);
      return;
    }

    setAssociandoMaterial(true);
    try {
      const atualizado = await Mapa.update(mapaSelecionado.id, result.payload);
      setMapas((prev) => prev.map((mapa) => mapa.id === atualizado.id ? atualizado : mapa));
      setUploadDialog(false);
      toast.showSuccess('Material técnico associado ao mapa no mock visual.');
    } catch (error) {
      toast.showError('Não foi possível associar o material ao mapa.');
    } finally {
      setAssociandoMaterial(false);
    }
  };

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

  const tituloTela = consultaPorFazenda ? 'Panorama da Propriedade' : 'Panorama de Mapas';
  const contextoLabel = consultaPorFazenda
    ? 'Consulta por propriedade'
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
  const materiaisSaoFertilidade = categoriaAtiva === 'fertilidade'
    || (
      mapasNoContexto.length > 0
      && mapasNoContexto.every((mapa) => mapa.categoria === 'fertilidade')
    );
  const tituloSecaoMateriais = materiaisSaoFertilidade
    ? 'Anexos de Fertilidade'
    : 'Anexos e materiais técnicos';
  const subtituloSecaoMateriais = materiaisSaoFertilidade
    ? 'Imagens/anexos de fertilidade disponíveis para consulta.'
    : 'Arquivos técnicos disponíveis para consulta.';

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
  const formatarTamanho = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const hasTamanhoArquivo = (value) => {
    const tamanho = Number(value);
    return Number.isFinite(tamanho) && tamanho > 0;
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

  // ──────────────────────────────────────────────
  // RENDER: Card de Mapa
  // ──────────────────────────────────────────────
  const renderMapaCard = (mapa) => {
    const safraMapa = getMapaSafra(mapa);
    const elementoLabel = getMapaElementoLabel(mapa);
    const profundidadeMapa = getMapaProfundidade(mapa);
    const statusDownload = avaliarDownloadMapa(mapa);
    const formatoArquivo = getFormatoArquivo(mapa);
    const formatoLabel = formatoArquivo ? formatoArquivo.toUpperCase() : 'ARQ';
    const isImagemAnexo = isFormatoImagem(formatoArquivo);
    const tipoMaterialLabel = formatarTipoMaterial(mapa.tipo_material);
    const fazendaMapaInfo = fazendaInfoPorId.get(getMapaFazendaId(mapa))
      || fazendaContextoInfo
      || fazendaFiltroInfo;
    const mapaMetaChips = [
      renderMapaMetaChip('flask-outline', 'Elemento', elementoLabel),
      renderMapaMetaChip('resize-outline', 'Profundidade', profundidadeMapa),
      renderMapaMetaChip('calendar-outline', 'Safra/ano', safraMapa || formatarData(mapa.data_criacao)),
      renderMapaMetaChip('location-outline', 'Talhão', mapa.talhao),
      renderMapaMetaChip('home-outline', 'Propriedade', fazendaMapaInfo?.fazendaNome),
    ].filter(Boolean);

    return (
      <TouchableOpacity 
        key={mapa.id} 
        style={styles.mapaCard}
        onPress={statusDownload.podeAbrir ? () => handleDownload(mapa) : undefined}
        activeOpacity={statusDownload.podeAbrir ? 0.7 : 1}
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
                name={isImagemAnexo ? 'image-outline' : 'document-outline'}
                size={13}
                color={isImagemAnexo ? colors.info : colors.primary}
              />
              <Text style={[styles.mapaTipoTexto, isImagemAnexo && styles.mapaTipoTextoImagem]}>
                {isImagemAnexo ? `Imagem/anexo ${formatoLabel}` : `Arquivo ${formatoLabel}`}
              </Text>
            </View>
            {tipoMaterialLabel ? (
              <Text style={styles.mapaSubcategoria}>{tipoMaterialLabel}</Text>
            ) : null}
          </View>
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
      
      {mapa.observacoes && (
        <Text style={styles.mapaObservacao} numberOfLines={2}>{mapa.observacoes}</Text>
      )}

      <View style={styles.mapaFooter}>
        <View style={styles.mapaFormatoTag}>
          <Text style={styles.mapaFormatoTexto}>{isImagemAnexo ? 'ANEXO' : formatoLabel}</Text>
        </View>
        {hasTamanhoArquivo(mapa.tamanho_arquivo) && (
          <Text style={styles.mapaTamanho}>{formatarTamanho(mapa.tamanho_arquivo)}</Text>
        )}
        <View style={[
          styles.downloadIndicator,
          statusDownload.podeAbrir ? styles.downloadIndicatorDisponivel : styles.downloadIndicatorIndisponivel,
        ]}>
          <Ionicons
            name={statusDownload.podeAbrir ? 'open-outline' : 'alert-circle-outline'}
            size={16}
            color={statusDownload.podeAbrir ? colors.success : colors.warning}
          />
          <Text style={[
            styles.downloadTexto,
            !statusDownload.podeAbrir && styles.downloadTextoIndisponivel,
          ]}>
            {statusDownload.podeAbrir && isImagemAnexo ? 'Abrir imagem' : statusDownload.label}
          </Text>
        </View>
      </View>
      {!statusDownload.podeAbrir && (
        <Text style={styles.materialIndisponivelTexto}>
          {statusDownload.descricao}
        </Text>
      )}
      {podeAssociarMaterial && !statusDownload.podeAbrir && (
        <TouchableOpacity
          style={styles.associarMaterialButton}
          onPress={() => abrirAssociacaoMaterial(mapa)}
          activeOpacity={0.75}
        >
          <Ionicons name="link-outline" size={15} color={colors.primary} />
          <Text style={styles.associarMaterialText}>Cadastrar material técnico (mock)</Text>
        </TouchableOpacity>
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
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar mapa, talhão, safra, propriedade..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!consultaPorFazenda && fazendaOptions.length > 1 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="business-outline" size={14} color={colors.text} /> Contexto da consulta:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
            <TouchableOpacity
              style={[styles.anoChip, fazendaFiltroOperacional === FILTRO_TODOS && styles.anoChipActive]}
              onPress={() => setFazendaFiltroOperacional(FILTRO_TODOS)}
            >
              <Text style={[styles.anoChipText, fazendaFiltroOperacional === FILTRO_TODOS && styles.anoChipTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>
            {fazendaOptions.map((fazenda) => (
              <TouchableOpacity
                key={fazenda.id}
                style={[styles.anoChip, fazendaFiltroOperacional === fazenda.id && styles.anoChipActive]}
                onPress={() => setFazendaFiltroOperacional(fazenda.id)}
              >
                <Text
                  style={[styles.anoChipText, fazendaFiltroOperacional === fazenda.id && styles.anoChipTextActive]}
                  numberOfLines={1}
                >
                  {fazenda.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
            <TouchableOpacity
              style={[styles.anoChip, talhaoFiltroAtual === FILTRO_TODOS && styles.anoChipActive]}
              onPress={() => handleTalhaoFiltroChange(FILTRO_TODOS)}
            >
              <Text style={[styles.anoChipText, talhaoFiltroAtual === FILTRO_TODOS && styles.anoChipTextActive]}>Todos</Text>
            </TouchableOpacity>
            {talhoesPanorama.map(talhao => (
              <TouchableOpacity
                key={talhao}
                style={[styles.anoChip, talhaoFiltroAtual === talhao && styles.anoChipActive]}
                onPress={() => handleTalhaoFiltroChange(talhao)}
              >
                <Text style={[styles.anoChipText, talhaoFiltroAtual === talhao && styles.anoChipTextActive]} numberOfLines={1}>
                  {talhao}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {safrasMapas.length > 0 && (
        <View style={styles.anoFilterContainer}>
          <Text style={styles.anoFilterLabel}>
            <Ionicons name="leaf-outline" size={14} color={colors.text} /> Safra dos materiais:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
            <TouchableOpacity
              style={[styles.anoChip, safraFiltroMapas === FILTRO_TODOS && styles.anoChipActive]}
              onPress={() => setSafraFiltroMapas(FILTRO_TODOS)}
            >
              <Text style={[styles.anoChipText, safraFiltroMapas === FILTRO_TODOS && styles.anoChipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {safrasMapas.map(safra => (
              <TouchableOpacity
                key={safra}
                style={[styles.anoChip, safraFiltroMapas === safra && styles.anoChipActive]}
                onPress={() => setSafraFiltroMapas(safra)}
              >
                <Text style={[styles.anoChipText, safraFiltroMapas === safra && styles.anoChipTextActive]}>{safra}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {temFiltroPanoramaAtivo && (
        <TouchableOpacity style={styles.limparFiltrosButton} onPress={limparFiltrosPanorama} activeOpacity={0.75}>
          <Ionicons name="close-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.limparFiltrosText}>Limpar filtros do panorama</Text>
        </TouchableOpacity>
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
          <Text style={styles.statNumero}>{mapasNoContexto.length}</Text>
          <Text style={styles.statLabel}>Materiais</Text>
        </View>
      </View>

      {limitesFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-network-outline" size={80} color={colors.muted} />
          <Text style={styles.emptyText}>
            {temFiltroPanoramaAtivo
              ? 'Nenhuma demarcação encontrada'
              : consultaPorFazenda || fazendaFiltroInfo
                ? 'Sem demarcação de talhões neste mock'
                : 'Sem demarcações de talhões no escopo atual'}
          </Text>
          <Text style={styles.emptySubtext}>
            {temFiltroPanoramaAtivo
              ? 'Tente ajustar propriedade, talhão, demarcação ou busca.'
              : consultaPorFazenda || fazendaFiltroInfo
                ? 'Os anexos técnicos podem existir mesmo sem mapa de talhões cadastrado para esta propriedade.'
                : 'Quando houver demarcações liberadas para as propriedades acessíveis, elas aparecerão aqui.'}
          </Text>
        </View>
      ) : (
        <>
          {/* ── Botão Ver no Mapa ────────────────────── */}
          <TouchableOpacity
            style={styles.btnMapaSatelite}
            onPress={() =>
              navigation.navigate(
                'FazendaMapa',
                buildFazendaMapaRouteParams({
                  fazendaId: mapaSateliteFazendaInfo?.id,
                  fazendaNome: mapaSateliteFazendaInfo?.fazendaNome,
                  titularNome: mapaSateliteFazendaInfo?.titularNome,
                })
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

      <View style={styles.materiaisSection}>
        <View style={styles.shapeSectionHeader}>
          <Ionicons name="images-outline" size={20} color={colors.primary} />
          <Text style={styles.shapeSectionTitle}>{tituloSecaoMateriais}</Text>
          <View style={styles.anoTag}>
            <Text style={styles.anoTagText}>{mapasFiltrados.length}</Text>
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>{subtituloSecaoMateriais}</Text>
      </View>

      {/* Filtros de Categoria */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriasContainer}
        contentContainerStyle={styles.categoriasContent}
      >
        {CATEGORIAS.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoriaChip,
              categoriaAtiva === cat.id && styles.categoriaChipAtiva
            ]}
            onPress={() => setCategoriaAtiva(cat.id)}
          >
            <Ionicons
              name={cat.icon}
              size={18}
              color={categoriaAtiva === cat.id ? colors.white : colors.primary}
            />
            <Text style={[
              styles.categoriaTexto,
              categoriaAtiva === cat.id && styles.categoriaTextoAtiva
            ]}>
              {cat.nome}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ordenação */}
      <View style={styles.ordenacaoContainer}>
        <Text style={styles.ordenacaoLabel}>
          <Ionicons name="swap-vertical-outline" size={14} color={colors.text} /> Ordenar materiais:
        </Text>
        <View style={styles.ordenacaoButtons}>
          {[
            { key: 'recente', label: 'Recente', icon: 'time-outline' },
            { key: 'titulo', label: 'Título', icon: 'text-outline' },
            { key: 'tamanho', label: 'Tamanho', icon: 'document-outline' }
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.ordenacaoChip, ordenacao === item.key && styles.ordenacaoChipActive]}
              onPress={() => setOrdenacao(item.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={ordenacao === item.key ? colors.white : colors.primary}
              />
              <Text style={[
                styles.ordenacaoChipText,
                ordenacao === item.key && styles.ordenacaoChipTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {podeAssociarMaterial && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => abrirAssociacaoMaterial()}
          activeOpacity={0.7}
        >
          <Ionicons name="link-outline" size={20} color={colors.white} />
          <Text style={styles.uploadButtonText}>Cadastrar material técnico (mock)</Text>
        </TouchableOpacity>
      )}

      {mapasFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={temFiltroMaterialAtivo ? 'search-outline' : 'folder-open-outline'}
            size={80}
            color={colors.muted}
          />
          <Text style={styles.emptyText}>
            {temFiltroMaterialAtivo
              ? 'Nenhum material técnico encontrado'
              : materiaisSaoFertilidade
                ? 'Nenhum anexo de fertilidade disponível'
                : 'Nenhum material técnico disponível'}
          </Text>
          <Text style={styles.emptySubtext}>
            {temFiltroMaterialAtivo
              ? 'Tente ajustar safra, talhão, categoria ou busca.'
              : 'Quando materiais técnicos forem liberados para este contexto, os arquivos anexados aparecerão aqui.'}
          </Text>
        </View>
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
        <Header title="Panorama de Mapas" showBack onBack={() => navigation.goBack()} />
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

      {/* Dialog de abertura de material */}
      <ConfirmDialog
        visible={downloadDialog.visible}
        title="Abrir material"
        message={downloadDialog.mapa 
          ? `Abrir o material "${downloadDialog.mapa.titulo}"?\n\nFormato: ${downloadDialog.mapa.formato_arquivo?.toUpperCase() || 'ARQ'}\nTamanho: ${formatarTamanho(downloadDialog.mapa.tamanho_arquivo)}\nOrigem: ${downloadDialog.status?.arquivoUrl || 'URL não informada'}` 
          : ''}
        type="info"
        confirmText="Abrir"
        cancelText="Cancelar"
        onConfirm={confirmDownload}
        onCancel={() => setDownloadDialog({ visible: false, mapa: null, status: null })}
      />

      <Modal
        visible={imagePreview.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreview({ visible: false, mapa: null, source: null })}
      >
        <View style={styles.imagePreviewOverlay}>
          <View style={styles.imagePreviewDialog}>
            <View style={styles.imagePreviewHeader}>
              <View style={styles.imagePreviewTitleWrap}>
                <Text style={styles.imagePreviewTitle} numberOfLines={1}>
                  {imagePreview.mapa?.titulo || 'Material'}
                </Text>
                {imagePreview.mapa?.profundidade ? (
                  <Text style={styles.imagePreviewSubtitle}>
                    Profundidade {imagePreview.mapa.profundidade}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setImagePreview({ visible: false, mapa: null, source: null })}
                style={styles.imagePreviewClose}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {imagePreview.source ? (
              <Image
                source={imagePreview.source}
                style={styles.imagePreviewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Modal de Material Técnico mockado */}
      <Modal
        visible={uploadDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setUploadDialog(false)}
      >
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadDialog}>
            <View style={styles.uploadHeader}>
              <View style={styles.uploadHeaderLeft}>
                <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
                <Text style={styles.uploadTitle} numberOfLines={2}>Cadastrar Material Técnico (mock)</Text>
              </View>
              <TouchableOpacity onPress={() => setUploadDialog(false)} style={styles.uploadClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.uploadDescription}>
              Protótipo visual/mockado para testar o conceito de material técnico. Não envia arquivo, não integra storage e não cria cadastro real.
            </Text>

            <ScrollView style={styles.uploadBody} showsVerticalScrollIndicator={false}>
            <View style={styles.uploadAnoContainer}>
              <Text style={styles.uploadAnoLabel}>Mapa</Text>
              <ScrollView style={styles.uploadMapaOptions} nestedScrollEnabled>
                {mapasAssociacaoOptions.map((mapa) => {
                  const ativo = uploadMapaId === mapa.id;
                  const status = avaliarDownloadMapa(mapa);

                  return (
                    <TouchableOpacity
                      key={mapa.id}
                      style={[styles.uploadMapaOption, ativo && styles.uploadMapaOptionActive]}
                      onPress={() => preencherUploadComMapa(mapa)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.uploadMapaOptionTextos}>
                        <Text style={[styles.uploadMapaOptionTitulo, ativo && styles.uploadMapaOptionTituloActive]} numberOfLines={1}>
                          {mapa.titulo}
                        </Text>
                        <Text style={styles.uploadMapaOptionSubtitulo} numberOfLines={1}>
                          {mapa.talhao || 'Talhão não informado'} • {getMapaSafra(mapa) || 'Safra não informada'} • {status.label}
                        </Text>
                      </View>
                      {ativo && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Formatos suportados */}
            <View style={styles.formatosInfo}>
              <Ionicons name="information-circle-outline" size={16} color={colors.info} />
              <Text style={styles.formatosInfoText}>
                A URL abaixo é apenas mock/dev. URLs aceitas: https://, file://, content://, data: ou asset://
              </Text>
            </View>

            <View style={styles.uploadCamposRow}>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Tipo de material</Text>
                <TextInput
                  style={styles.uploadAnoInput}
                  value={materialTipo}
                  onChangeText={setMaterialTipo}
                  placeholder="Diagnóstico"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Origem</Text>
                <TextInput
                  style={styles.uploadAnoInput}
                  value={materialOrigem}
                  onChangeText={setMaterialOrigem}
                  placeholder="URL mockada"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <View style={styles.uploadAnoContainer}>
              <Text style={styles.uploadAnoLabel}>Propriedade vinculada</Text>
              <View style={styles.uploadReadonlyBox}>
                <Ionicons name="business-outline" size={16} color={colors.primary} />
                <Text style={styles.uploadReadonlyText} numberOfLines={1}>
                  {materialFazendaSelecionadaInfo?.fazendaNome || 'Propriedade do contexto atual'}
                </Text>
              </View>
            </View>

            <View style={styles.uploadCamposRow}>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Talhão opcional</Text>
                <View style={styles.uploadReadonlyBox}>
                  <Text style={styles.uploadReadonlyText} numberOfLines={1}>
                    {mapaUploadSelecionado?.talhao || 'Não informado'}
                  </Text>
                </View>
              </View>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Safra/ano</Text>
                <View style={styles.uploadReadonlyBox}>
                  <Text style={styles.uploadReadonlyText} numberOfLines={1}>
                    {mapaUploadSelecionado ? getMapaSafra(mapaUploadSelecionado) || 'Não informado' : 'Não informado'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.uploadAnoContainer}>
              <Text style={styles.uploadAnoLabel}>URL mockada do arquivo</Text>
              <TextInput
                style={styles.uploadAnoInput}
                value={uploadArquivoUrl}
                onChangeText={setUploadArquivoUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://exemplo.com/mapa.pdf"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.uploadCamposRow}>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Formato</Text>
                <TextInput
                  style={styles.uploadAnoInput}
                  value={uploadFormato}
                  onChangeText={setUploadFormato}
                  autoCapitalize="none"
                  placeholder="pdf"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.uploadCampoFlex}>
                <Text style={styles.uploadAnoLabel}>Tamanho em bytes</Text>
                <TextInput
                  style={styles.uploadAnoInput}
                  value={uploadTamanho}
                  onChangeText={setUploadTamanho}
                  keyboardType="numeric"
                  placeholder="opcional"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <View style={styles.uploadAnoContainer}>
              <Text style={styles.uploadAnoLabel}>Descrição</Text>
              <TextInput
                style={[styles.uploadAnoInput, styles.uploadDescricaoInput]}
                value={materialDescricao}
                onChangeText={setMaterialDescricao}
                placeholder="Descrição breve para o teste interno"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {mapaUploadSelecionado && (
              <Text style={styles.uploadMapaSelecionadoInfo}>
                No MVP visual, "{mapaUploadSelecionado.titulo}" passará a usar o fluxo de Abrir material apenas no mock local.
              </Text>
            )}
            </ScrollView>

            <View style={styles.uploadActions}>
              <TouchableOpacity 
                style={styles.uploadCancelBtn} 
                onPress={() => setUploadDialog(false)}
              >
                <Text style={styles.uploadCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.uploadConfirmBtn} 
                onPress={handleAssociarMaterial}
                disabled={associandoMaterial}
              >
                <Ionicons name="link-outline" size={18} color={colors.white} />
                <Text style={styles.uploadConfirmText}>
                  {associandoMaterial ? 'Associando...' : 'Associar mock'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalhe do Talhão */}
      <TalhaoDetailModal
        visible={talhaoDetailVisible}
        talhao={selectedTalhao}
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

  // ── UPLOAD ──
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  uploadButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  uploadOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  uploadDialog: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    ...shadows.lg,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  uploadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    paddingRight: spacing.sm,
  },
  uploadTitle: {
    flex: 1,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  uploadClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadDescription: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  uploadBody: {
    maxHeight: 520,
    marginBottom: spacing.md,
  },
  fileSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fileSelectText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  formatosInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  formatosInfoText: {
    flex: 1,
    fontSize: typography.fontCaption,
    color: colors.info,
    fontWeight: typography.weightSemibold,
  },
  uploadAnoContainer: {
    marginBottom: spacing.lg,
  },
  uploadAnoLabel: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  uploadAnoInput: {
    backgroundColor: colors.background,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontBody,
    color: colors.text,
    textAlign: 'center',
  },
  uploadDescricaoInput: {
    minHeight: 82,
    textAlign: 'left',
  },
  uploadReadonlyBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  uploadReadonlyText: {
    flex: 1,
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
  },
  uploadMapaOptions: {
    maxHeight: 170,
  },
  uploadMapaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  uploadMapaOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  uploadMapaOptionTextos: {
    flex: 1,
    minWidth: 0,
  },
  uploadMapaOptionTitulo: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    fontWeight: typography.weightBold,
  },
  uploadMapaOptionTituloActive: {
    color: colors.primary,
  },
  uploadMapaOptionSubtitulo: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
    marginTop: 2,
  },
  uploadCamposRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  uploadCampoFlex: {
    flex: 1,
  },
  uploadMapaSelecionadoInfo: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadCancelBtn: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadCancelText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  uploadConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadConfirmText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
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
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapaFormatoTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
  },
  mapaFormatoTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  mapaTamanho: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
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
  associarMaterialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  associarMaterialText: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },

  materiaisSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionSubtitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    lineHeight: 18,
    marginTop: -spacing.sm,
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
