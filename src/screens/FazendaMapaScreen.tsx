import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Keyboard,
  PanResponder,
  StatusBar,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapaFazendaView, {
  MapaFazendaViewRef,
} from '../components/MapaFazendaView';
import { LimiteArea, Produtor } from '../api/mock';
import {
  resolveRouteFazendaId,
  resolveRouteCadernoLocation,
  resolveRouteTitularNome,
  resolveTalhaoSelecionadoFromRoute,
} from '../navigation/mapaRouteCompat';
import { MapaTalhao } from '../types/mapa';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import {
  avaliarAcessoFazendaPorId,
  filtrarLimitesPorFazendaIds,
  filtrarProdutoresPorAcesso,
  getFazendaIds,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  MEDIDA_NAO_INFORMADA,
  formatAreaHa,
  formatPerimeter,
  resolveAreaTotalInformada,
  summarizeMappedArea,
} from '../utils/talhaoMedidasCompat';
import {
  GeoJsonTalhoesLayerResult,
  isGeoJsonTalhoesLayerActive,
  isGeoJsonTalhoesLayerFallback,
  loadGeoJsonTalhoesLayer,
  resolveEffectiveTalhoesLayer,
} from '../services/GeoJsonTalhoesLayerService';
import {
  ForegroundUserLocation,
  requestCurrentForegroundLocation,
} from '../services/LocationForegroundService';
import {
  FazendaMapaSheetSnap,
  filterFazendaMapaTalhoes,
  resolveClosestFazendaMapaSheetSnap,
  resolveFazendaMapaPanelMode,
  resolveFazendaMapaSheetSnapPoints,
  resolveFazendaMapaSidePanelWidth,
} from '../utils/fazendaMapaResponsiveCompat';

// ─────────────────────────────────────────────────────────────
// HELPERS DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────
function fmt(val: number | undefined, casas = 1): string {
  if (val === undefined || val === null) return '—';
  return Number(val).toFixed(casas);
}

function fmtHoraLocalizacao(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildLocationSuccessMessage(location: ForegroundUserLocation): string {
  const precision = location.accuracy != null
    ? `Precisão informada pelo GPS: ${Math.round(location.accuracy)} m`
    : 'Precisão não informada pelo GPS';
  const capturedAt = fmtHoraLocalizacao(location.capturedAt);

  return [
    'Posição aproximada do aparelho.',
    precision,
    capturedAt ? `Leitura às ${capturedAt}` : '',
  ].filter(Boolean).join(' ');
}

function buildCadernoLocationMessage(location: ForegroundUserLocation): string {
  const precision = location.accuracy != null
    ? `Precisão registrada: ${Math.round(location.accuracy)} m.`
    : 'Precisão não informada.';
  return `Ponto salvo no Caderno. ${precision}`;
}

function classificarPH(ph: number): { label: string; cor: string } {
  if (ph < 5.0) return { label: 'Muito ácido', cor: '#EF4444' };
  if (ph < 5.5) return { label: 'Ácido', cor: '#F59E0B' };
  if (ph < 6.0) return { label: 'Mod. ácido', cor: '#EAB308' };
  if (ph < 6.5) return { label: 'Ideal', cor: '#22C55E' };
  if (ph < 7.0) return { label: 'Neutro', cor: '#10B981' };
  return { label: 'Alcalino', cor: '#3B82F6' };
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE: CHIP DE ANO
// ─────────────────────────────────────────────────────────────
function ChipAno({
  ano,
  ativo,
  onPress,
}: {
  ano: number | null;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.anoChip, ativo && styles.anoChipAtivo]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.anoChipTexto, ativo && styles.anoChipTextoAtivo]}>
        {ano === null ? 'Todos' : `LT ${ano}`}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE: CARD DE TALHÃO NA LISTA
// ─────────────────────────────────────────────────────────────
function CardTalhao({
  talhao,
  selecionado,
  onPress,
}: {
  talhao: MapaTalhao & { elementos?: any };
  selecionado: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.cardTalhao, selecionado && styles.cardTalhaoSelecionado]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.cardTalhaoCor, { backgroundColor: talhao.cor || colors.primary }]} />
      <View style={styles.cardTalhaoInfo}>
        <Text style={styles.cardTalhaoNome} numberOfLines={1}>
          {talhao.talhao}
        </Text>
        <Text style={styles.cardTalhaoDetalhe}>
          {formatAreaHa(talhao.area_hectares)}
          {talhao.cultura_atual ? `  ·  ${talhao.cultura_atual}` : ''}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={selecionado ? colors.primary : colors.muted}
      />
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE: LINHA DE INFORMAÇÃO NO DRAWER
// ─────────────────────────────────────────────────────────────
function InfoRow({
  icone,
  label,
  valor,
  corValor,
}: {
  icone: string;
  label: string;
  valor: string;
  corValor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icone as any} size={15} color={colors.muted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValor, corValor ? { color: corValor } : null]}>
        {valor}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// TELA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function FazendaMapaScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isProdutorView = user?.perfil === 'produtor';

  // Params da rota
  const fazendaId: string | undefined = resolveRouteFazendaId(route?.params);
  const titularNomeParam: string | undefined = resolveRouteTitularNome(route?.params);
  const fazendaNomeParam: string | undefined = route?.params?.fazendaNome;
  const cadernoLocationParam = resolveRouteCadernoLocation(route?.params);

  // ── Estado ──────────────────────────────────────────────────
  const [todosLimites, setTodosLimites] = useState<any[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);
  const [talhaoSelecionadoId, setTalhaoSelecionadoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroConexao, setErroConexao] = useState(false);
  const [buscaTalhao, setBuscaTalhao] = useState('');
  const [mapaExpandido, setMapaExpandido] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<FazendaMapaSheetSnap>('medium');
  const [titularNome, setTitularNome] = useState(titularNomeParam ?? '');
  const [fazendaNome, setFazendaNome] = useState(fazendaNomeParam ?? '');
  const [estadoBloqueio, setEstadoBloqueio] = useState<string | null>(null);
  const [fazendasContexto, setFazendasContexto] = useState<any[]>([]);
  const [geoJsonTalhoesLayer, setGeoJsonTalhoesLayer] = useState<GeoJsonTalhoesLayerResult | null>(null);
  const [userLocation, setUserLocation] = useState<ForegroundUserLocation | null>(cadernoLocationParam);
  const [locationMessage, setLocationMessage] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(cadernoLocationParam ? {
    type: 'info',
    text: buildCadernoLocationMessage(cadernoLocationParam),
  } : null);
  const [requestingLocation, setRequestingLocation] = useState(false);

  // Refs
  const mapaRef = useRef<MapaFazendaViewRef>(null);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetGestureStartRef = useRef(0);
  const locationRequestIdRef = useRef(0);
  const locationRequestInFlightRef = useRef(false);
  const locationScreenFocusedRef = useRef(true);
  const userLocationRef = useRef<ForegroundUserLocation | null>(userLocation);
  userLocationRef.current = userLocation;

  const panelMode = resolveFazendaMapaPanelMode(windowWidth, windowHeight);
  const isSidePanel = panelMode === 'side-panel';
  const sidePanelWidth = resolveFazendaMapaSidePanelWidth(windowWidth);
  const sheetSnapPoints = useMemo(
    () => resolveFazendaMapaSheetSnapPoints(windowHeight, insets.bottom),
    [insets.bottom, windowHeight]
  );
  const sheetExpandedHeight = sheetSnapPoints.expanded;
  const sheetTargetTranslate = sheetExpandedHeight - sheetSnapPoints[sheetSnap];

  useFocusEffect(
    useCallback(() => {
      locationScreenFocusedRef.current = true;
      locationRequestInFlightRef.current = false;
      setRequestingLocation(false);

      return () => {
        locationScreenFocusedRef.current = false;
        locationRequestInFlightRef.current = false;
        locationRequestIdRef.current += 1;
      };
    }, [])
  );

  // ── Carregamento de dados ────────────────────────────────────
  useEffect(() => {
    carregarDados();
  }, [
    fazendaId,
    user,
    route?.params?.talhaoId,
    route?.params?.talhaoNome,
    route?.params?.talhao,
    route?.params?.talhaoAno,
  ]);

  useEffect(() => {
    setTitularNome(titularNomeParam ?? '');
  }, [titularNomeParam]);

  useEffect(() => {
    setFazendaNome(fazendaNomeParam ?? '');
  }, [fazendaNomeParam]);

  useEffect(() => {
    const routeLocation = resolveRouteCadernoLocation(route?.params);
    setUserLocation(routeLocation);
    setLocationMessage(routeLocation ? {
      type: 'info',
      text: buildCadernoLocationMessage(routeLocation),
    } : null);
  }, [
    fazendaId,
    route?.params?.cadernoLatitude,
    route?.params?.cadernoLongitude,
    route?.params?.cadernoAccuracy,
    route?.params?.cadernoCapturedAt,
  ]);

  const carregarDados = async () => {
    setCarregando(true);
    setErroConexao(false);
    setEstadoBloqueio(null);
    try {
      const fazendas = await Produtor.list();
      const fazendasComAcesso = user
        ? filtrarProdutoresPorAcesso(fazendas, user)
        : [];

      let idsPermitidos = getFazendaIds(fazendasComAcesso);
      let fazendasNoContexto = fazendasComAcesso;

      // Busca metadata semantica da fazenda quando a rota nao informar os nomes.
      if (fazendaId) {
        const avaliacao = avaliarAcessoFazendaPorId(fazendas, user, fazendaId);

        if (avaliacao.status !== 'permitido') {
          setEstadoBloqueio(avaliacao.status);
          setTodosLimites([]);
          setAnoSelecionado(null);
          setTalhaoSelecionadoId(null);
          setFazendasContexto(fazendasComAcesso);
          setGeoJsonTalhoesLayer(null);
          return;
        }

        const fazendaAtual = avaliacao.fazenda;
        idsPermitidos = [avaliacao.fazendaId];
        fazendasNoContexto = [fazendaAtual];
        const fazendaInfo = getFazendaUiInfo(fazendaAtual);

        if (!titularNomeParam) {
          setTitularNome(fazendaInfo.titularNome);
        }
        if (!fazendaNomeParam) {
          setFazendaNome(fazendaInfo.fazendaNome);
        }
      } else {
        setTitularNome('');
        setFazendaNome('');
      }

      setFazendasContexto(fazendasNoContexto);

      const limites = await LimiteArea.list();
      const limitesFiltrados = filtrarLimitesPorFazendaIds(limites, idsPermitidos);
      const talhoesLayer = fazendaId && idsPermitidos.length === 1
        ? await loadGeoJsonTalhoesLayer({
            propriedade_id: idsPermitidos[0],
            fazenda_id: idsPermitidos[0],
          })
        : null;
      const camadaEfetiva = resolveEffectiveTalhoesLayer(limitesFiltrados, talhoesLayer);
      const talhoesEfetivos = camadaEfetiva.talhoes;
      const selecaoRota = resolveTalhaoSelecionadoFromRoute(talhoesEfetivos, route?.params);

      setTodosLimites(talhoesEfetivos);
      setGeoJsonTalhoesLayer(talhoesLayer);
      setTalhaoSelecionadoId(selecaoRota.talhaoId ?? null);

      // Seleciona o ano mais recente por padrão
      const anos = [...new Set<number>(talhoesEfetivos.map((l: any) => l.ano))].sort(
        (a, b) => b - a
      );
      if (selecaoRota.talhaoAno != null && anos.includes(selecaoRota.talhaoAno)) {
        setAnoSelecionado(selecaoRota.talhaoAno);
      } else if (anos.length > 0) {
        setAnoSelecionado(anos[0]);
      } else {
        setAnoSelecionado(null);
      }
    } catch (err) {
      setGeoJsonTalhoesLayer(null);
      setErroConexao(true);
    } finally {
      setCarregando(false);
    }
  };

  // ── Talhões filtrados por ano ────────────────────────────────
  const talhoesExibidos = useMemo<(MapaTalhao & { elementos?: any })[]>(() => {
    return todosLimites.filter((l) => !anoSelecionado || l.ano === anoSelecionado);
  }, [todosLimites, anoSelecionado]);

  const talhoesPesquisados = useMemo(
    () => filterFazendaMapaTalhoes(talhoesExibidos, buscaTalhao),
    [buscaTalhao, talhoesExibidos]
  );

  // ── Anos disponíveis ─────────────────────────────────────────
  const anosDisponiveis = useMemo<number[]>(() => {
    return [...new Set<number>(todosLimites.map((l) => l.ano))].sort((a, b) => b - a);
  }, [todosLimites]);

  // ── Talhão selecionado (objeto completo) ─────────────────────
  const talhaoDetalhe = useMemo(
    () => talhoesExibidos.find((t) => t.id === talhaoSelecionadoId) ?? null,
    [talhoesExibidos, talhaoSelecionadoId]
  );

  // ── Medidas apresentadas sem inferir cobertura da Propriedade ─
  const resumoAreaMapeada = useMemo(
    () => summarizeMappedArea(talhoesExibidos),
    [talhoesExibidos]
  );
  const areaTotalInformada = resolveAreaTotalInformada(
    fazendaId && fazendasContexto.length === 1 ? fazendasContexto[0] : null
  );
  const geoJsonTalhoesLocalAtivo = isGeoJsonTalhoesLayerActive(geoJsonTalhoesLayer);
  const geoJsonTalhoesLocalErro = isGeoJsonTalhoesLayerFallback(geoJsonTalhoesLayer);

  // ── Painel responsivo e orientacao ────────────────────────────
  const animateSheetTo = useCallback((snap: FazendaMapaSheetSnap) => {
    setSheetSnap(snap);
    Animated.spring(sheetTranslateY, {
      toValue: sheetExpandedHeight - sheetSnapPoints[snap],
      useNativeDriver: true,
      damping: 24,
      stiffness: 230,
      mass: 0.85,
    }).start();
  }, [sheetExpandedHeight, sheetSnapPoints, sheetTranslateY]);

  useEffect(() => {
    sheetTranslateY.setValue(sheetTargetTranslate);
    const timeout = setTimeout(() => mapaRef.current?.recalcularDimensoes(), 120);
    return () => clearTimeout(timeout);
  }, [isSidePanel, sheetTargetTranslate, sheetTranslateY, windowHeight, windowWidth]);

  const sheetPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => (
        Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
      ),
      onPanResponderGrant: () => {
        sheetGestureStartRef.current = sheetExpandedHeight - sheetSnapPoints[sheetSnap];
      },
      onPanResponderMove: (_, gesture) => {
        const minTranslate = 0;
        const maxTranslate = sheetExpandedHeight - sheetSnapPoints.collapsed;
        const nextTranslate = Math.min(
          Math.max(sheetGestureStartRef.current + gesture.dy, minTranslate),
          maxTranslate
        );
        sheetTranslateY.setValue(nextTranslate);
      },
      onPanResponderRelease: (_, gesture) => {
        const currentTranslate = Math.min(
          Math.max(
            sheetGestureStartRef.current + gesture.dy,
            0
          ),
          sheetExpandedHeight - sheetSnapPoints.collapsed
        );
        const visibleHeight = sheetExpandedHeight - currentTranslate;
        animateSheetTo(resolveClosestFazendaMapaSheetSnap(
          visibleHeight,
          sheetSnapPoints,
          gesture.vy
        ));
      },
      onPanResponderTerminate: () => animateSheetTo(sheetSnap),
    }),
    [animateSheetTo, sheetExpandedHeight, sheetSnap, sheetSnapPoints, sheetTranslateY]
  );

  // ── Handlers ─────────────────────────────────────────────────
  const handleTalhaoPress = useCallback(
    (id: string) => {
      if (talhaoSelecionadoId === id) {
        setTalhaoSelecionadoId(null);
        return;
      }
      setTalhaoSelecionadoId(id);
      if (!isSidePanel && sheetSnap === 'collapsed') {
        animateSheetTo('medium');
      }
    },
    [animateSheetTo, isSidePanel, sheetSnap, talhaoSelecionadoId]
  );

  const handleFecharDetalhe = useCallback(() => {
    setTalhaoSelecionadoId(null);
  }, []);

  const handleAnoChange = useCallback(
    (ano: number | null) => {
      setAnoSelecionado(ano);
      setTalhaoSelecionadoId(null);
      setTimeout(() => mapaRef.current?.ajustarLimites(), 300);
    },
    []
  );

  const handleAjustarLimites = useCallback(() => {
    mapaRef.current?.ajustarLimites();
  }, []);

  const handleCentralizarTalhao = useCallback(() => {
    if (talhaoSelecionadoId) {
      mapaRef.current?.centralizarTalhao(talhaoSelecionadoId);
    }
  }, [talhaoSelecionadoId]);

  const handleExpandirMapa = useCallback(() => {
    Keyboard.dismiss();
    setMapaExpandido(true);
    setTimeout(() => mapaRef.current?.recalcularDimensoes(), 120);
  }, []);

  const handleRestaurarPainel = useCallback(() => {
    setMapaExpandido(false);
    setTimeout(() => mapaRef.current?.recalcularDimensoes(), 120);
  }, []);

  // ── Título da tela ────────────────────────────────────────────
  const consultaPorFazenda = !!fazendaId && !estadoBloqueio;
  const canUseForegroundLocation = consultaPorFazenda && talhoesExibidos.length > 0;
  const tituloCabecalho = consultaPorFazenda
    ? (fazendaNome || 'Limites da Propriedade')
    : 'Visão geral de limites';
  const contextoCabecalho = consultaPorFazenda
    ? `Titular: ${titularNome || 'Não informado'}`
    : `${fazendasContexto.length} propriedade${fazendasContexto.length !== 1 ? 's' : ''} no escopo`;
  const resumoTalhoes = `${talhoesExibidos.length} ${talhoesExibidos.length === 1 ? 'talhão' : 'talhões'}  ·  ${resumoAreaMapeada.label}: ${resumoAreaMapeada.valorFormatado}`;
  const mensagemBloqueio = estadoBloqueio === 'acesso_negado'
    ? {
        icon: 'lock-closed-outline',
        title: 'Acesso negado',
        text: 'Esta propriedade não está disponível no seu escopo de acesso.',
      }
    : {
        icon: 'alert-circle-outline',
        title: 'Propriedade não encontrada',
        text: 'Não foi possível localizar a propriedade informada para visualizar os limites.',
      };

  const handleMostrarMinhaPosicao = useCallback(async () => {
    if (!canUseForegroundLocation) {
      setUserLocation(null);
      setLocationMessage({
        type: 'error',
        text: 'Abra o mapa de Talhões de uma Propriedade para mostrar sua posição.',
      });
      return;
    }

    if (locationRequestInFlightRef.current) {
      return;
    }

    locationRequestInFlightRef.current = true;
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;
    setRequestingLocation(true);
    setLocationMessage({
      type: 'info',
      text: 'Obtendo a posição aproximada do aparelho...',
    });

    try {
      const result = await requestCurrentForegroundLocation();
      const isCurrentRequest = locationScreenFocusedRef.current
        && locationRequestIdRef.current === requestId;

      if (!isCurrentRequest) {
        return;
      }

      if (result.status === 'ok') {
        userLocationRef.current = result.location;
        setUserLocation(result.location);
        mapaRef.current?.centralizarLocalizacao(result.location);
        setLocationMessage({
          type: 'info',
          text: `${buildLocationSuccessMessage(result.location)} A posição será mostrada apenas no mapa de Talhões, não em PNGs ou prescrições.`,
        });
      } else {
        const previousLocation = userLocationRef.current;
        setLocationMessage({
          type: 'error',
          text: previousLocation
            ? `${result.message} O último ponto válido continua marcado.`
            : result.message,
        });
      }
    } finally {
      if (
        locationScreenFocusedRef.current
        && locationRequestIdRef.current === requestId
      ) {
        locationRequestInFlightRef.current = false;
        setRequestingLocation(false);
      }
    }
  }, [canUseForegroundLocation]);

  // ── Estado de Loading ─────────────────────────────────────────
  if (carregando) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#111" />
        <TouchableOpacity style={styles.voltarLoading} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Ionicons name="earth-outline" size={64} color={colors.primary} />
        <Text style={styles.loadingTexto}>Carregando limites…</Text>
      </SafeAreaView>
    );
  }

  // ── Estado de Erro ────────────────────────────────────────────
  if (erroConexao) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#111" />
        <TouchableOpacity style={styles.voltarLoading} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Ionicons name="cloud-offline-outline" size={64} color={colors.error} />
        <Text style={styles.loadingTexto}>Não foi possível carregar os dados</Text>
        <TouchableOpacity style={styles.btnTentarNovamente} onPress={carregarDados}>
          <Text style={styles.btnTentarNovamenteTexto}>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (estadoBloqueio) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#111" />
        <TouchableOpacity style={styles.voltarLoading} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Ionicons name={mensagemBloqueio.icon as any} size={64} color={colors.error} />
        <Text style={styles.loadingTitulo}>{mensagemBloqueio.title}</Text>
        <Text style={styles.loadingSubtexto}>{mensagemBloqueio.text}</Text>
        <TouchableOpacity style={styles.btnTentarNovamente} onPress={() => navigation.goBack()}>
          <Text style={styles.btnTentarNovamenteTexto}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Render principal ──────────────────────────────────────────
  const painel = (
    <TalhoesPanel
      mode={panelMode}
      snap={sheetSnap}
      dragHandlers={!isSidePanel ? sheetPanResponder.panHandlers : undefined}
      talhoes={talhoesPesquisados}
      totalTalhoes={talhoesExibidos.length}
      busca={buscaTalhao}
      onBuscaChange={setBuscaTalhao}
      talhaoSelecionado={talhaoDetalhe as any}
      onTalhaoPress={handleTalhaoPress}
      onFecharDetalhe={handleFecharDetalhe}
      onCentralizarTalhao={handleCentralizarTalhao}
      onExpandirMapa={handleExpandirMapa}
      onToggleSnap={() => animateSheetTo(sheetSnap === 'expanded' ? 'collapsed' : 'expanded')}
      resumoArea={`${resumoAreaMapeada.label}: ${resumoAreaMapeada.valorFormatado}`}
      emptyLabel={buscaTalhao.trim()
        ? 'Nenhum Talhão corresponde à busca.'
        : `Nenhum Talhão para${anoSelecionado ? ` LT ${anoSelecionado}` : ' o período selecionado'}.`}
      bottomInset={isSidePanel ? spacing.sm : Math.max(insets.bottom, spacing.sm)}
    />
  );

  const mapa = (
    <View style={styles.mapaContainer}>
      <MapaFazendaView
        ref={mapaRef}
        talhoes={talhoesExibidos}
        talhaoSelecionadoId={talhaoSelecionadoId}
        userLocation={userLocation}
        onTalhaoPress={handleTalhaoPress}
        noticeTopInset={
          insets.top
          + 110
          + (anosDisponiveis.length > 1 ? 44 : 0)
          + (geoJsonTalhoesLocalAtivo || geoJsonTalhoesLocalErro ? 38 : 0)
          + (locationMessage ? 52 : 0)
        }
      />

      <SafeAreaView edges={['top']} style={styles.cabecalho} pointerEvents="box-none">
        <View style={styles.cabecalhoConteudo}>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.cabecalhoTextos}>
            <Text style={styles.cabecalhoTitulo} numberOfLines={1}>{tituloCabecalho}</Text>
            <Text style={styles.cabecalhoSubtitulo} numberOfLines={1}>{contextoCabecalho}</Text>
            <Text style={styles.cabecalhoSubtitulo} numberOfLines={1}>
              {consultaPorFazenda
                ? `Área total: ${formatAreaHa(areaTotalInformada)} · ${resumoTalhoes}`
                : resumoTalhoes}
            </Text>
          </View>

          {canUseForegroundLocation ? (
            <TouchableOpacity
              style={[styles.mapControlButton, styles.locationControlButton]}
              onPress={handleMostrarMinhaPosicao}
              disabled={requestingLocation}
              accessibilityRole="button"
              accessibilityLabel={requestingLocation ? 'Obtendo posição' : 'Mostrar minha posição'}
            >
              {requestingLocation
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="locate-outline" size={21} color={colors.white} />}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={handleAjustarLimites}
            accessibilityRole="button"
            accessibilityLabel="Enquadrar todos os Talhões"
          >
            <Ionicons name="scan-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {anosDisponiveis.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtroAnoContent}
            style={styles.filtroAnoScroll}
          >
            <ChipAno ano={null} ativo={anoSelecionado === null} onPress={() => handleAnoChange(null)} />
            {anosDisponiveis.map((ano) => (
              <ChipAno
                key={ano}
                ano={ano}
                ativo={anoSelecionado === ano}
                onPress={() => handleAnoChange(ano)}
              />
            ))}
          </ScrollView>
        ) : null}

        {(geoJsonTalhoesLocalAtivo || geoJsonTalhoesLocalErro) ? (
          <View style={[styles.camadaLocalBanner, geoJsonTalhoesLocalErro && styles.camadaLocalBannerErro]}>
            <Ionicons
              name={geoJsonTalhoesLocalAtivo ? 'layers-outline' : 'alert-circle-outline'}
              size={15}
              color={geoJsonTalhoesLocalAtivo ? colors.white : colors.warningLight}
            />
            <Text style={styles.camadaLocalBannerTexto} numberOfLines={1}>
              {geoJsonTalhoesLocalAtivo
                ? isProdutorView ? 'Talhões disponíveis para consulta' : 'Talhões carregados do GeoJSON local'
                : 'GeoJSON local indisponível. Exibindo a demarcação disponível.'}
            </Text>
          </View>
        ) : null}

        {locationMessage ? (
          <View style={[styles.localizacaoStatus, locationMessage.type === 'error' && styles.localizacaoStatusErro]}>
            <Ionicons
              name={locationMessage.type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
              size={14}
              color={locationMessage.type === 'error' ? colors.warningLight : colors.white}
            />
            <Text style={styles.localizacaoStatusText} numberOfLines={2}>{locationMessage.text}</Text>
          </View>
        ) : null}
      </SafeAreaView>

      <View style={styles.badgeSatelite} pointerEvents="none">
        <Ionicons name="earth" size={12} color="rgba(255,255,255,0.8)" />
        <Text style={styles.badgeSateliteTexto}>
          {geoJsonTalhoesLocalAtivo ? isProdutorView ? 'TALHÕES' : 'GEOJSON LOCAL' : 'MAPA'}
        </Text>
      </View>

      {mapaExpandido ? (
        <TouchableOpacity
          style={[styles.restorePanelButton, { bottom: Math.max(insets.bottom, spacing.md) }]}
          onPress={handleRestaurarPainel}
          accessibilityRole="button"
          accessibilityLabel="Mostrar painel de Talhões"
        >
          <Ionicons name="albums-outline" size={18} color={colors.white} />
          <Text style={styles.restorePanelButtonText}>Mostrar painel</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111" translucent />
      <View style={styles.wideLayout}>
        {mapa}
        {isSidePanel && !mapaExpandido ? (
          <SafeAreaView
            edges={['top', 'right', 'bottom']}
            style={[styles.sidePanel, { width: sidePanelWidth }]}
          >
            {painel}
          </SafeAreaView>
        ) : null}
      </View>

      {!isSidePanel && !mapaExpandido ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                height: sheetExpandedHeight,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            {painel}
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// PAINEL RESPONSIVO: LISTA E DETALHE
// ─────────────────────────────────────────────────────────────
function TalhoesPanel({
  mode,
  snap,
  dragHandlers,
  talhoes,
  totalTalhoes,
  busca,
  onBuscaChange,
  talhaoSelecionado,
  onTalhaoPress,
  onFecharDetalhe,
  onCentralizarTalhao,
  onExpandirMapa,
  onToggleSnap,
  resumoArea,
  emptyLabel,
  bottomInset,
}: {
  mode: 'bottom-sheet' | 'side-panel';
  snap: FazendaMapaSheetSnap;
  dragHandlers?: Record<string, any>;
  talhoes: (MapaTalhao & { elementos?: any })[];
  totalTalhoes: number;
  busca: string;
  onBuscaChange: (value: string) => void;
  talhaoSelecionado: (MapaTalhao & { elementos?: any }) | null;
  onTalhaoPress: (id: string) => void;
  onFecharDetalhe: () => void;
  onCentralizarTalhao: () => void;
  onExpandirMapa: () => void;
  onToggleSnap: () => void;
  resumoArea: string;
  emptyLabel: string;
  bottomInset: number;
}) {
  const isBottomSheet = mode === 'bottom-sheet';

  return (
    <View style={[styles.panel, { paddingBottom: bottomInset }]}>
      {isBottomSheet ? (
        <View
          style={styles.sheetDragArea}
          accessibilityRole="adjustable"
          accessibilityLabel={`Painel de Talhões, posição ${snap}`}
          accessibilityHint="Arraste para cima ou para baixo para ajustar a altura"
          {...dragHandlers}
        >
          <View style={styles.sheetHandle} />
        </View>
      ) : null}

      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <Ionicons name="layers-outline" size={20} color={colors.primary} />
          <Text style={styles.panelTitle}>Talhões</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeTexto}>{totalTalhoes}</Text>
          </View>
        </View>
        <View style={styles.panelHeaderActions}>
          {isBottomSheet ? (
            <TouchableOpacity
              style={styles.snapToggleButton}
              onPress={onToggleSnap}
              accessibilityRole="button"
              accessibilityLabel={snap === 'expanded' ? 'Recolher painel de Talhões' : 'Expandir painel de Talhões'}
            >
              <Ionicons
                name={snap === 'expanded' ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.expandMapButton}
            onPress={onExpandirMapa}
            accessibilityRole="button"
            accessibilityLabel="Expandir mapa em tela inteira"
          >
            <Ionicons name="expand-outline" size={17} color={colors.primary} />
            <Text style={styles.expandMapButtonText}>Expandir mapa</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.panelSummary} numberOfLines={1}>{resumoArea}</Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={busca}
          onChangeText={onBuscaChange}
          placeholder="Buscar Talhão, cultura ou solo"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          accessibilityLabel="Buscar na lista de Talhões"
        />
        {busca ? (
          <TouchableOpacity
            onPress={() => onBuscaChange('')}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
          >
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelScrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {talhaoSelecionado ? (
          <View style={styles.selectedDetailCard}>
            <DrawerDetalheTalhao
              talhao={talhaoSelecionado as any}
              onFechar={onFecharDetalhe}
              onCentralizar={onCentralizarTalhao}
            />
          </View>
        ) : null}

        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>Lista completa</Text>
          <Text style={styles.listSectionCount}>
            {talhoes.length} {talhoes.length === 1 ? 'resultado' : 'resultados'}
          </Text>
        </View>

        {talhoes.length === 0 ? (
          <View style={styles.listaVazia}>
            <Ionicons name="search-outline" size={26} color={colors.muted} />
            <Text style={styles.listaVaziaTexto}>{emptyLabel}</Text>
          </View>
        ) : talhoes.map((talhao) => (
          <CardTalhao
            key={talhao.id}
            talhao={talhao}
            selecionado={talhaoSelecionado?.id === talhao.id}
            onPress={() => onTalhaoPress(talhao.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// DETALHES DO TALHÃO
// ─────────────────────────────────────────────────────────────
function DrawerDetalheTalhao({
  talhao,
  onFechar,
  onCentralizar,
}: {
  talhao: MapaTalhao & { elementos?: any; observacoes?: string; perimetro_km?: number; perimetro_origem?: string; tipo_solo?: string; safra?: string };
  onFechar: () => void;
  onCentralizar: () => void;
}) {
  const phInfo = talhao.elementos?.ph != null ? classificarPH(talhao.elementos.ph) : null;
  const perimetroFormatado = formatPerimeter(
    talhao.perimetro_km,
    'km',
    talhao.perimetro_origem
  );

  return (
    <View style={styles.drawerScroll}>
      <View style={styles.drawerCabecalho}>
        <View style={[styles.drawerCorBarra, { backgroundColor: talhao.cor || colors.primary }]} />
        <View style={styles.drawerCabecalhoTextos}>
          <Text style={styles.drawerTalhaoNome}>{talhao.talhao}</Text>
          {talhao.nome && talhao.nome !== talhao.talhao && (
            <Text style={styles.drawerTalhaoSubnome} numberOfLines={1}>
              {talhao.nome}
            </Text>
          )}
          <View style={styles.drawerChips}>
            {talhao.cultura_atual ? (
              <View style={styles.chip}>
                <Ionicons name="leaf-outline" size={12} color={colors.primary} />
                <Text style={styles.chipTexto}>{talhao.cultura_atual}</Text>
              </View>
            ) : null}
            {talhao.safra ? (
              <View style={[styles.chip, styles.chipSecundario]}>
                <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                <Text style={[styles.chipTexto, styles.chipTextoSecundario]}>{talhao.safra}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.drawerBtnFechar}
          onPress={onFechar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.centerTalhaoButton}
        onPress={onCentralizar}
        accessibilityRole="button"
        accessibilityLabel={`Centralizar ${talhao.talhao} no mapa`}
      >
        <Ionicons name="locate-outline" size={17} color={colors.primary} />
        <Text style={styles.centerTalhaoButtonText}>Centralizar Talhão</Text>
      </TouchableOpacity>

      {/* Métricas principais */}
      <View style={styles.drawerMetricas}>
        <View style={styles.metricaBox}>
          <Text style={styles.metricaValor}>{formatAreaHa(talhao.area_hectares)}</Text>
          <Text style={styles.metricaLabel}>Área do Talhão</Text>
        </View>
        {perimetroFormatado !== MEDIDA_NAO_INFORMADA && (
          <View style={[styles.metricaBox, styles.metricaBoxBorder]}>
            <Text style={styles.metricaValor}>{perimetroFormatado}</Text>
            <Text style={styles.metricaLabel}>Perímetro</Text>
          </View>
        )}
        {talhao.elementos?.ph != null && (
          <View style={styles.metricaBox}>
            <Text style={[styles.metricaValor, phInfo ? { color: phInfo.cor } : null]}>
              pH {fmt(talhao.elementos.ph)}
            </Text>
            <Text style={styles.metricaLabel}>{phInfo?.label ?? ''}</Text>
          </View>
        )}
      </View>

      {/* Dados do Solo */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Solo</Text>
        {talhao.tipo_solo ? (
          <InfoRow icone="layers-outline" label="Tipo" valor={talhao.tipo_solo} />
        ) : null}
        {talhao.textura ? (
          <InfoRow icone="grid-outline" label="Textura" valor={talhao.textura} />
        ) : null}
      </View>

      {/* Elementos químicos */}
      {talhao.elementos && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Análise Química</Text>
          <View style={styles.elementosGrid}>
            {ELEMENTOS_CONFIG.map(({ chave, label, unidade, casas }) => {
              const val = talhao.elementos?.[chave];
              if (val == null) return null;
              return (
                <View key={chave} style={styles.elementoItem}>
                  <Text style={styles.elementoLabel}>{label}</Text>
                  <Text style={styles.elementoValor}>
                    {fmt(val, casas)}
                    <Text style={styles.elementoUnidade}> {unidade}</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Observações */}
      {(talhao as any).observacoes ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Observações</Text>
          <Text style={styles.observacoesTexto}>{(talhao as any).observacoes}</Text>
        </View>
      ) : null}

    </View>
  );
}

// Config dos elementos químicos exibidos
const ELEMENTOS_CONFIG = [
  { chave: 'ph', label: 'pH', unidade: '', casas: 1 },
  { chave: 'materia_organica', label: 'M.O.', unidade: '%', casas: 1 },
  { chave: 'fosforo', label: 'Fósforo', unidade: 'mg/dm³', casas: 1 },
  { chave: 'potassio', label: 'Potássio', unidade: 'cmolc', casas: 2 },
  { chave: 'calcio', label: 'Cálcio', unidade: 'cmolc', casas: 1 },
  { chave: 'magnesio', label: 'Magnésio', unidade: 'cmolc', casas: 1 },
  { chave: 'saturacao_bases', label: 'V%', unidade: '%', casas: 0 },
  { chave: 'ctc', label: 'CTC', unidade: 'cmolc', casas: 1 },
  { chave: 'aluminio', label: 'Al³⁺', unidade: 'cmolc', casas: 2 },
  { chave: 'enxofre', label: 'Enxofre', unidade: 'mg/dm³', casas: 1 },
] as const;

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Container ──
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  wideLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidePanel: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: spacing.radiusLg * 1.5,
    borderTopRightRadius: spacing.radiusLg * 1.5,
    overflow: 'hidden',
    ...shadows.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 18,
  },

  // ── Loading / Erro ──
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  voltarLoading: {
    position: 'absolute',
    top: 56,
    left: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
  },
  loadingTexto: {
    color: colors.white,
    fontSize: typography.fontBody,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingTitulo: {
    color: colors.white,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingSubtexto: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.fontBody,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  btnTentarNovamente: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius,
    marginTop: spacing.sm,
  },
  btnTentarNovamenteTexto: {
    color: colors.white,
    fontWeight: typography.weightSemibold,
    fontSize: typography.fontBody,
  },

  // ── Cabeçalho flutuante ──
  cabecalho: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  cabecalhoConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  mapControlButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22,
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationControlButton: {
    backgroundColor: 'rgba(37,99,235,0.92)',
  },
  cabecalhoTextos: {
    flex: 1,
  },
  cabecalhoTitulo: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cabecalhoSubtitulo: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.fontCaption,
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Filtro de ano ──
  filtroAnoScroll: {
    marginTop: spacing.xs,
  },
  filtroAnoContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  anoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  anoChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  anoChipTexto: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontCaption,
    fontWeight: typography.weightMedium,
  },
  anoChipTextoAtivo: {
    color: colors.white,
    fontWeight: typography.weightBold,
  },
  camadaLocalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
    backgroundColor: 'rgba(34,139,34,0.86)',
    maxWidth: 520,
  },
  camadaLocalBannerErro: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.75)',
  },
  camadaLocalBannerTexto: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
  localizacaoStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    maxWidth: 520,
  },
  localizacaoStatusErro: {
    backgroundColor: 'rgba(0,0,0,0.76)',
    borderColor: 'rgba(245,158,11,0.72)',
  },
  localizacaoStatusText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: typography.fontCaption,
    lineHeight: 16,
    fontWeight: typography.weightSemibold,
  },

  // ── Mapa ──
  mapaContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },

  // ── Badge do mapa ──
  badgeSatelite: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 4,
  },
  badgeSateliteTexto: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: typography.weightBold,
    letterSpacing: 0.8,
  },
  restorePanelButton: {
    position: 'absolute',
    right: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    backgroundColor: 'rgba(22,101,52,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    elevation: 8,
  },
  restorePanelButtonText: {
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },

  // ── Painel responsivo ──
  panel: {
    flex: 1,
    backgroundColor: colors.card,
  },
  sheetDragArea: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  panelTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  snapToggleButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  panelSummary: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    paddingHorizontal: spacing.md,
    marginTop: 2,
  },
  expandMapButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  expandMapButtonText: {
    color: colors.primary,
    fontSize: typography.fontSmall,
    fontWeight: typography.weightBold,
  },
  searchContainer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    backgroundColor: colors.backgroundAlt,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: typography.fontCaption,
  },
  panelScroll: {
    flex: 1,
    marginTop: spacing.sm,
  },
  panelScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  selectedDetailCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  listSectionTitle: {
    color: colors.text,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionCount: {
    color: colors.muted,
    fontSize: typography.fontSmall,
  },

  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },

  listaVazia: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  listaVaziaTexto: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    fontStyle: 'italic',
  },

  // ── Card talhão ──
  cardTalhao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTalhaoSelecionado: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  cardTalhaoCor: {
    width: 8,
    height: 36,
    borderRadius: 4,
    flexShrink: 0,
  },
  cardTalhaoInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTalhaoNome: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  cardTalhaoDetalhe: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    marginTop: 2,
  },

  drawerScroll: {
    width: '100%',
  },

  // ── Drawer cabeçalho ──
  drawerCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  drawerCorBarra: {
    width: 5,
    height: 48,
    borderRadius: 3,
    marginTop: 2,
    flexShrink: 0,
  },
  drawerCabecalhoTextos: {
    flex: 1,
  },
  drawerTalhaoNome: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  drawerTalhaoSubnome: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 2,
  },
  drawerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipSecundario: {
    backgroundColor: colors.backgroundAlt,
  },
  chipTexto: {
    fontSize: typography.fontSmall,
    color: colors.primary,
    fontWeight: typography.weightMedium,
  },
  chipTextoSecundario: {
    color: colors.muted,
  },
  drawerBtnFechar: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 18,
    padding: 6,
  },
  centerTalhaoButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  centerTalhaoButtonText: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },

  // ── Métricas ──
  drawerMetricas: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  metricaBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  metricaBoxBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  metricaValor: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  metricaLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 2,
  },

  // ── Seções ──
  secao: {
    marginBottom: spacing.md,
  },
  secaoTitulo: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  // ── InfoRow ──
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    flex: 1,
  },
  infoValor: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightMedium,
    color: colors.text,
    textAlign: 'right',
    maxWidth: '60%',
  },

  // ── Grid de elementos químicos ──
  elementosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  elementoItem: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    padding: spacing.sm,
    width: '30%',
    minWidth: 74,
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  elementoLabel: {
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 2,
  },
  elementoValor: {
    fontSize: 11,
    fontWeight: typography.weightBold,
    color: colors.text,
    textAlign: 'center',
  },
  elementoUnidade: {
    fontSize: 8,
    fontWeight: typography.weightRegular,
    color: colors.muted,
  },

  // ── Observações ──
  observacoesTexto: {
    fontSize: typography.fontCaption,
    color: colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
