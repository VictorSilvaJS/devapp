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
  Dimensions,
  Animated,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapaFazendaView, {
  MapaFazendaViewRef,
} from '../components/MapaFazendaView';
import { LimiteArea, Produtor } from '../api/mock';
import {
  resolveRouteFazendaId,
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
  getNomeFazenda,
  getNomeTitularFazenda,
} from '../utils/acessoControle';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Altura do mapa: 56% da tela — equilibra mapa visível e painel inferior
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.56);

// Altura do drawer de detalhes
const DRAWER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.44);

// ─────────────────────────────────────────────────────────────
// HELPERS DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────
function fmt(val: number | undefined, casas = 1): string {
  if (val === undefined || val === null) return '—';
  return Number(val).toFixed(casas);
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
          {fmt(talhao.area_hectares)} ha
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

  // Params da rota
  const fazendaId: string | undefined = resolveRouteFazendaId(route?.params);
  const titularNomeParam: string | undefined = resolveRouteTitularNome(route?.params);
  const fazendaNomeParam: string | undefined = route?.params?.fazendaNome;

  // ── Estado ──────────────────────────────────────────────────
  const [todosLimites, setTodosLimites] = useState<any[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);
  const [talhaoSelecionadoId, setTalhaoSelecionadoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroConexao, setErroConexao] = useState(false);
  const [drawerVisivel, setDrawerVisivel] = useState(false);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [titularNome, setTitularNome] = useState(titularNomeParam ?? '');
  const [fazendaNome, setFazendaNome] = useState(fazendaNomeParam ?? '');
  const [estadoBloqueio, setEstadoBloqueio] = useState<string | null>(null);
  const [fazendasContexto, setFazendasContexto] = useState<any[]>([]);

  // Refs
  const mapaRef = useRef<MapaFazendaViewRef>(null);
  const drawerAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;

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
          return;
        }

        const fazendaAtual = avaliacao.fazenda;
        idsPermitidos = [avaliacao.fazendaId];
        fazendasNoContexto = [fazendaAtual];

        if (!titularNomeParam) {
          setTitularNome(getNomeTitularFazenda(fazendaAtual));
        }
        if (!fazendaNomeParam) {
          setFazendaNome(getNomeFazenda(fazendaAtual));
        }
      } else {
        setTitularNome('');
        setFazendaNome('');
      }

      setFazendasContexto(fazendasNoContexto);

      const limites = await LimiteArea.list();
      const limitesFiltrados = filtrarLimitesPorFazendaIds(limites, idsPermitidos);
      const selecaoRota = resolveTalhaoSelecionadoFromRoute(limitesFiltrados, route?.params);

      setTodosLimites(limitesFiltrados);
      setTalhaoSelecionadoId(selecaoRota.talhaoId ?? null);

      // Seleciona o ano mais recente por padrão
      const anos = [...new Set<number>(limitesFiltrados.map((l: any) => l.ano))].sort(
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
      setErroConexao(true);
    } finally {
      setCarregando(false);
    }
  };

  // ── Talhões filtrados por ano ────────────────────────────────
  const talhoesExibidos = useMemo<(MapaTalhao & { elementos?: any })[]>(() => {
    return todosLimites.filter((l) => !anoSelecionado || l.ano === anoSelecionado);
  }, [todosLimites, anoSelecionado]);

  // ── Anos disponíveis ─────────────────────────────────────────
  const anosDisponiveis = useMemo<number[]>(() => {
    return [...new Set<number>(todosLimites.map((l) => l.ano))].sort((a, b) => b - a);
  }, [todosLimites]);

  // ── Talhão selecionado (objeto completo) ─────────────────────
  const talhaoDetalhe = useMemo(
    () => talhoesExibidos.find((t) => t.id === talhaoSelecionadoId) ?? null,
    [talhoesExibidos, talhaoSelecionadoId]
  );

  // ── Área total ───────────────────────────────────────────────
  const areaTotal = useMemo(
    () => talhoesExibidos.reduce((sum, t) => sum + (t.area_hectares || 0), 0),
    [talhoesExibidos]
  );

  // ── Drawer animation ─────────────────────────────────────────
  const abrirDrawer = useCallback(() => {
    setDrawerVisivel(true);
    Animated.spring(drawerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [drawerAnim]);

  const fecharDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: DRAWER_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setDrawerVisivel(false);
      setTalhaoSelecionadoId(null);
      mapaRef.current?.selecionarTalhao(null);
    });
  }, [drawerAnim]);

  useEffect(() => {
    if (!talhaoSelecionadoId || !talhaoDetalhe) {
      return;
    }

    mapaRef.current?.selecionarTalhao(talhaoSelecionadoId);
    if (!drawerVisivel) {
      abrirDrawer();
    }
  }, [talhaoSelecionadoId, talhaoDetalhe, drawerVisivel, abrirDrawer]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleTalhaoPress = useCallback(
    (id: string) => {
      if (talhaoSelecionadoId === id) {
        fecharDrawer();
        return;
      }
      setTalhaoSelecionadoId(id);
      mapaRef.current?.selecionarTalhao(id);
      if (!drawerVisivel) abrirDrawer();
    },
    [talhaoSelecionadoId, drawerVisivel, abrirDrawer, fecharDrawer]
  );

  const handleMapaPress = useCallback(() => {
    if (drawerVisivel) fecharDrawer();
  }, [drawerVisivel, fecharDrawer]);

  const handleAnoChange = useCallback(
    (ano: number | null) => {
      setAnoSelecionado(ano);
      setTalhaoSelecionadoId(null);
      if (drawerVisivel) fecharDrawer();
      setTimeout(() => mapaRef.current?.ajustarLimites(), 300);
    },
    [drawerVisivel, fecharDrawer]
  );

  const handleAjustarLimites = useCallback(() => {
    mapaRef.current?.ajustarLimites();
  }, []);

  // ── Título da tela ────────────────────────────────────────────
  const consultaPorFazenda = !!fazendaId && !estadoBloqueio;
  const tituloCabecalho = consultaPorFazenda
    ? (fazendaNome || 'Limites da Fazenda')
    : 'Visão geral de limites';
  const contextoCabecalho = consultaPorFazenda
    ? `Titular: ${titularNome || 'Não informado'}`
    : `${fazendasContexto.length} fazenda${fazendasContexto.length !== 1 ? 's' : ''} no escopo`;
  const resumoTalhoes = `${talhoesExibidos.length} talhão${talhoesExibidos.length !== 1 ? 'es' : ''}  ·  ${fmt(areaTotal)} ha`;
  const mensagemBloqueio = estadoBloqueio === 'acesso_negado'
    ? {
        icon: 'lock-closed-outline',
        title: 'Acesso negado',
        text: 'Esta fazenda não está disponível no seu escopo de acesso.',
      }
    : {
        icon: 'alert-circle-outline',
        title: 'Fazenda não encontrada',
        text: 'Não foi possível localizar a fazenda informada para visualizar os limites.',
      };

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
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111" translucent />

      {/* ── CABEÇALHO (sobre o mapa) ─────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.cabecalho}>
        <View style={styles.cabecalhoConteudo}>
          <TouchableOpacity
            style={styles.btnVoltar}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.cabecalhoTextos}>
            <Text style={styles.cabecalhoTitulo} numberOfLines={1}>
              {tituloCabecalho}
            </Text>
            <Text style={styles.cabecalhoSubtitulo} numberOfLines={1}>
              {contextoCabecalho}
            </Text>
            <Text style={styles.cabecalhoSubtitulo} numberOfLines={1}>
              {resumoTalhoes}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.btnAjustar}
            onPress={handleAjustarLimites}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="scan-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* ── FILTRO DE ANO ───────────────────────────────────── */}
        {anosDisponiveis.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtroAnoContent}
            style={styles.filtroAnoScroll}
          >
            {anosDisponiveis.length > 1 && (
              <ChipAno ano={null} ativo={anoSelecionado === null} onPress={() => handleAnoChange(null)} />
            )}
            {anosDisponiveis.map((ano) => (
              <ChipAno
                key={ano}
                ano={ano}
                ativo={anoSelecionado === ano}
                onPress={() => handleAnoChange(ano)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ── MAPA LEAFLET ─────────────────────────────────────── */}
      <View style={styles.mapaContainer}>
        <MapaFazendaView
          ref={mapaRef}
          talhoes={talhoesExibidos}
          talhaoSelecionadoId={talhaoSelecionadoId}
          onTalhaoPress={handleTalhaoPress}
          onMapaReady={() => {
            if (talhaoSelecionadoId) {
              mapaRef.current?.selecionarTalhao(talhaoSelecionadoId);
            }
          }}
        />

        {/* Badge do mapa no canto inferior esquerdo */}
        <View style={styles.badgeSatelite}>
          <Ionicons name="earth" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.badgeSateliteTexto}>MAPA</Text>
        </View>

        {/* Legenda de cores dos talhões */}
        {talhoesExibidos.length > 0 && (
          <View style={styles.legendaMapa}>
            {talhoesExibidos.slice(0, 4).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.legendaItem,
                  talhaoSelecionadoId === t.id && styles.legendaItemAtivo,
                ]}
                onPress={() => handleTalhaoPress(t.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.legendaCor, { backgroundColor: t.cor || colors.primary }]} />
                <Text style={styles.legendaNome} numberOfLines={1}>
                  {t.talhao}
                </Text>
              </TouchableOpacity>
            ))}
            {talhoesExibidos.length > 4 && (
              <Text style={styles.legendaMais}>+{talhoesExibidos.length - 4}</Text>
            )}
          </View>
        )}
      </View>

      {/* ── PAINEL INFERIOR — LISTA DE TALHÕES ───────────────── */}
      <View style={styles.painelInferior}>
        {/* Cabeçalho do painel */}
        <TouchableOpacity
          style={styles.painelCabecalho}
          onPress={() => setListaExpandida((v) => !v)}
          activeOpacity={0.85}
        >
          <View style={styles.painelCabecalhoEsq}>
            <Ionicons name="layers-outline" size={18} color={colors.primary} />
            <Text style={styles.painelTitulo}>Talhões</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{talhoesExibidos.length}</Text>
            </View>
          </View>
          <View style={styles.painelCabecalhoDir}>
            <Text style={styles.painelAreaTotal}>{fmt(areaTotal)} ha total</Text>
            <Ionicons
              name={listaExpandida ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.muted}
            />
          </View>
        </TouchableOpacity>

        {/* Lista horizontal de cartões */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listaTalhoesContent}
          style={[styles.listaTalhoesScroll, listaExpandida && styles.listaTalhoesExpandida]}
        >
          {talhoesExibidos.length === 0 ? (
            <View style={styles.listaVazia}>
              <Text style={styles.listaVaziaTexto}>
                Nenhum talhão para{anoSelecionado ? ` LT ${anoSelecionado}` : ' o período selecionado'}
              </Text>
            </View>
          ) : (
            talhoesExibidos.map((t) => (
              <CardTalhao
                key={t.id}
                talhao={t}
                selecionado={talhaoSelecionadoId === t.id}
                onPress={() => handleTalhaoPress(t.id)}
              />
            ))
          )}
        </ScrollView>
      </View>

      {/* ── DRAWER DE DETALHE DO TALHÃO ──────────────────────── */}
      {drawerVisivel && talhaoDetalhe && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop semi-transparente */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={fecharDrawer}
          />
          <Animated.View
            style={[
              styles.drawer,
              { transform: [{ translateY: drawerAnim }] },
            ]}
          >
            <DrawerDetalheTalhao
              talhao={talhaoDetalhe as any}
              onFechar={fecharDrawer}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// DRAWER: DETALHES DO TALHÃO
// ─────────────────────────────────────────────────────────────
function DrawerDetalheTalhao({
  talhao,
  onFechar,
}: {
  talhao: MapaTalhao & { elementos?: any; observacoes?: string; perimetro_km?: number; tipo_solo?: string; safra?: string };
  onFechar: () => void;
}) {
  const phInfo = talhao.elementos?.ph != null ? classificarPH(talhao.elementos.ph) : null;

  return (
    <ScrollView
      style={styles.drawerScroll}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Handle bar */}
      <View style={styles.drawerHandle} />

      {/* Cabeçalho do drawer */}
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

      {/* Métricas principais */}
      <View style={styles.drawerMetricas}>
        <View style={styles.metricaBox}>
          <Text style={styles.metricaValor}>{fmt(talhao.area_hectares)}</Text>
          <Text style={styles.metricaLabel}>hectares</Text>
        </View>
        {talhao.perimetro_km != null && (
          <View style={[styles.metricaBox, styles.metricaBoxBorder]}>
            <Text style={styles.metricaValor}>{fmt(talhao.perimetro_km)} km</Text>
            <Text style={styles.metricaLabel}>perímetro</Text>
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

      <View style={{ height: 24 }} />
    </ScrollView>
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
  btnVoltar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
  },
  btnAjustar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
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

  // ── Mapa ──
  mapaContainer: {
    height: MAP_HEIGHT,
    overflow: 'hidden',
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

  // ── Legenda no mapa ──
  legendaMapa: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: spacing.radiusSm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 4,
    minWidth: 110,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  legendaItemAtivo: {
    opacity: 1,
  },
  legendaCor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendaNome: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    flex: 1,
  },
  legendaMais: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'right',
  },

  // ── Painel inferior ──
  painelInferior: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: spacing.radiusLg,
    borderTopRightRadius: spacing.radiusLg,
    ...shadows.sm,
  },
  painelCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  painelCabecalhoEsq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  painelCabecalhoDir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  painelTitulo: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  painelAreaTotal: {
    fontSize: typography.fontCaption,
    color: colors.muted,
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

  // ── Lista horizontal de talhões ──
  listaTalhoesScroll: {
    maxHeight: 120,
  },
  listaTalhoesExpandida: {
    maxHeight: 240,
  },
  listaTalhoesContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  listaVazia: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
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
    width: 180,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
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

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // ── Drawer ──
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: colors.card,
    borderTopLeftRadius: spacing.radiusLg * 1.5,
    borderTopRightRadius: spacing.radiusLg * 1.5,
    ...shadows.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 16,
  },
  drawerScroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 4) / 5,
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
