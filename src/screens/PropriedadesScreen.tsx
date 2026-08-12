import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../components/FilterBottomSheet';
import { Produtor } from '../api/mock';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso, podeCriarProdutor } from '../utils/acessoControle';
import { useFiltros } from '../contexts/FiltroContext';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { buildFazendaListMetrics, getFazendaUiInfo, matchesFazendaUiBusca } from '../utils/fazendaUiCompat';
import { formatAreaHa } from '../utils/talhaoMedidasCompat';
import {
  FILTRO_TODOS,
  filtrarPropriedadesPorLocalizacao,
  listarMunicipios,
  listarUfs,
} from '../utils/filtroTerritorial';
import {
  getPropriedadesListResponsiveLayout,
  getPropriedadesWideMetricCardWidth,
} from '../utils/propriedadesListResponsive';

export default function PropriedadesScreen() {
  const { width, height } = useWindowDimensions();
  const responsiveLayout = getPropriedadesListResponsiveLayout(width, height);
  const wideMetricCardWidth = getPropriedadesWideMetricCardWidth(width, 5, 12, spacing.screen);
  const metricCardStyle = responsiveLayout.useWideMetrics
    ? [styles.metricCard, styles.metricCardWide, { width: wideMetricCardWidth }]
    : [styles.metricCard, styles.metricCardScrollable];
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [ufSelecionada, setUfSelecionada] = useState(FILTRO_TODOS);
  const [municipioSelecionado, setMunicipioSelecionado] = useState(FILTRO_TODOS);
  const [ordenacao, setOrdenacao] = useState('nome'); // nome, area, recente
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [modalFiltrosVisivel, setModalFiltrosVisivel] = useState(false);
  const [filtrosRascunho, setFiltrosRascunho] = useState({
    status: 'todos',
    uf: FILTRO_TODOS,
    municipio: FILTRO_TODOS,
    ordenacao: 'nome',
  });
  const navigation = useNavigation();
  const { user } = useAuth();
  const { filtrarProdutores: filtrarPropriedadesPorFiltroGlobal, filtros } = useFiltros();
  const isProdutorView = user?.perfil === 'produtor';

  const load = useCallback(async () => {
    const data = await Produtor.list();
    // Filtrar por acesso do usuário
    let produtoresFiltrados = filtrarProdutoresPorAcesso(data, user);
    
    // Os filtros globais são aplicados somente depois da autorização.
    if (user?.perfil === 'admin' || user?.perfil === 'colaborador') {
      produtoresFiltrados = filtrarPropriedadesPorFiltroGlobal(produtoresFiltrados);
    }
    
    setProdutores(produtoresFiltrados);
  }, [filtrarPropriedadesPorFiltroGlobal, filtros, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ufs = useMemo(() => listarUfs(produtores), [produtores]);
  const municipios = useMemo(
    () => listarMunicipios(produtores, ufSelecionada),
    [produtores, ufSelecionada],
  );
  const mostrarFiltrosLocalizacao = ufs.length > 0;

  // Localização organiza somente o conjunto já autorizado e filtrado globalmente.
  const produtoresFiltrados = useMemo(() => filtrarPropriedadesPorLocalizacao(produtores, {
    uf: ufSelecionada,
    municipio: municipioSelecionado,
  }).filter(produtor => {
    const matchBusca = matchesFazendaUiBusca(produtor, busca);
    const matchStatus = filtroStatus === 'todos' || produtor.status === filtroStatus;
    return matchBusca && matchStatus;
  }).sort((a, b) => {
    if (ordenacao === 'nome') {
      return getFazendaUiInfo(a).fazendaNome.localeCompare(getFazendaUiInfo(b).fazendaNome);
    }
    if (ordenacao === 'area') {
      return (b.area_total || 0) - (a.area_total || 0);
    }
    if (ordenacao === 'recente') {
      return new Date(b.data_cadastro || 0).getTime() - new Date(a.data_cadastro || 0).getTime();
    }
    return 0;
  }), [busca, filtroStatus, municipioSelecionado, ordenacao, produtores, ufSelecionada]);

  // Calcular estatísticas da listagem Propriedade + Titular
  const metricasFazendas = useMemo(() => buildFazendaListMetrics(produtores), [produtores]);

  // Contar filtros ativos
  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtroStatus !== 'todos') count++;
    if (ufSelecionada !== FILTRO_TODOS) count++;
    if (municipioSelecionado !== FILTRO_TODOS) count++;
    if (ordenacao !== 'nome') count++;
    return count;
  };

  // Obter labels dos filtros ativos
  const getFiltrosAtivos = () => {
    const filtros = [];
    if (filtroStatus !== 'todos') {
      const statusLabels = { ativo: 'Ativo', inativo: 'Inativo', pendente: 'Pendente' };
      filtros.push({ tipo: 'status', label: statusLabels[filtroStatus], icon: 'checkmark-circle', color: colors.success, remover: () => setFiltroStatus('todos') });
    }
    if (ufSelecionada !== FILTRO_TODOS) {
      filtros.push({ tipo: 'uf', label: ufSelecionada, icon: 'location', color: colors.coral, remover: () => {
        setUfSelecionada(FILTRO_TODOS);
        setMunicipioSelecionado(FILTRO_TODOS);
      } });
    }
    if (municipioSelecionado !== FILTRO_TODOS) {
      const municipio = municipios.find((item) => item.id === municipioSelecionado);
      filtros.push({ tipo: 'municipio', label: municipio?.nome || 'Município', icon: 'map', color: colors.coral, remover: () => setMunicipioSelecionado(FILTRO_TODOS) });
    }
    if (ordenacao !== 'nome') {
      const ordenacaoLabels = { area: 'Por Área', recente: 'Mais Recente' };
      filtros.push({ tipo: 'ordenacao', label: ordenacaoLabels[ordenacao], icon: 'swap-vertical', color: colors.teal, remover: () => setOrdenacao('nome') });
    }
    return filtros;
  };

  const filtrosAtivos = getFiltrosAtivos();
  const numFiltrosAtivos = contarFiltrosAtivos();
  const listaSemResultadoPorFiltro =
    busca.trim().length > 0
    || filtroStatus !== 'todos'
    || ufSelecionada !== FILTRO_TODOS
    || municipioSelecionado !== FILTRO_TODOS;
  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'ativo', label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' },
    { value: 'pendente', label: 'Pendente' },
  ];
  const ordenacaoOptions = [
    { value: 'nome', label: 'Propriedade' },
    { value: 'area', label: 'Área' },
    { value: 'recente', label: 'Mais Recente' },
  ];
  const ufOptions = [
    { value: FILTRO_TODOS, label: 'Todas' },
    ...ufs.map((uf) => ({ value: uf, label: uf })),
  ];
  const municipioOptions = [
    { value: FILTRO_TODOS, label: 'Todos' },
    ...listarMunicipios(produtores, filtrosRascunho.uf).map((municipio) => ({
      value: municipio.id,
      label: municipio.nome,
    })),
  ];

  const getFiltrosAplicados = () => ({
    status: filtroStatus,
    uf: ufSelecionada,
    municipio: municipioSelecionado,
    ordenacao,
  });

  const abrirFiltros = () => {
    setFiltrosRascunho(getFiltrosAplicados());
    setModalFiltrosVisivel(true);
  };

  const cancelarFiltros = () => {
    setFiltrosRascunho(getFiltrosAplicados());
    setModalFiltrosVisivel(false);
  };

  const limparFiltrosRascunho = () => {
    setFiltrosRascunho({
      status: 'todos',
      uf: FILTRO_TODOS,
      municipio: FILTRO_TODOS,
      ordenacao: 'nome',
    });
  };

  const aplicarFiltros = () => {
    setFiltroStatus(filtrosRascunho.status);
    setUfSelecionada(filtrosRascunho.uf);
    setMunicipioSelecionado(filtrosRascunho.municipio);
    setOrdenacao(filtrosRascunho.ordenacao);
    setModalFiltrosVisivel(false);
  };

  return (
    <View style={styles.container}>
      <Header title={isProdutorView ? 'Minhas Propriedades' : 'Propriedades'} />
      
      {/* Barra de Busca Compacta */}
      <LinearGradient
        colors={[colors.white, colors.backgroundSoft]}
        style={styles.topBar}
      >
        {mostrarBusca ? (
          <View style={styles.searchContainerExpanded}>
            <SearchBar
              value={busca}
              onChangeText={setBusca}
              onClear={() => {
                setBusca('');
                setMostrarBusca(false);
              }}
              placeholder="Buscar por propriedade, titular, município ou UF..."
              containerStyle={styles.searchBarExpanded}
              autoFocus
            />
            {!busca && (
              <TouchableOpacity
                onPress={() => setMostrarBusca(false)}
                style={styles.closeSearchButton}
              >
                <Ionicons name="close-circle" size={24} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => setMostrarBusca(true)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[colors.white, colors.backgroundSoft]}
                style={styles.searchButtonGradient}
              >
                <Ionicons name="search" size={20} color={colors.primary} />
              </LinearGradient>
            </TouchableOpacity>
            
            <FilterTrigger
              activeCount={numFiltrosAtivos}
              onPress={abrirFiltros}
              style={styles.filterButton}
            />
          </>
        )}
      </LinearGradient>

      <FlatList
        data={produtoresFiltrados}
        keyExtractor={(propriedade: any) => String(propriedade.id)}
        renderItem={({ item: propriedade }) => (
          <ProdutorCard
            produtor={propriedade}
            onPress={() => {
              const params = buildPropriedadeDetailRouteParams(propriedade);
              if (params) navigation.navigate('ProdutorDetail', params);
            }}
          />
        )}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        ListHeaderComponent={(
          <>
            <ActiveFilterBar
              items={filtrosAtivos.map((filtro) => ({
                key: filtro.tipo,
                label: filtro.label,
                icon: filtro.icon,
                color: filtro.color,
                onRemove: filtro.remover,
              }))}
              onClear={() => {
                setFiltroStatus('todos');
                setUfSelecionada(FILTRO_TODOS);
                setMunicipioSelecionado(FILTRO_TODOS);
                setOrdenacao('nome');
              }}
            />

            {produtores.length > 0 && (
              <View style={styles.metricsSection}>
                <ScrollView
                  horizontal
                  scrollEnabled={!responsiveLayout.useWideMetrics}
                  showsHorizontalScrollIndicator={!responsiveLayout.useWideMetrics}
                  persistentScrollbar={!responsiveLayout.useWideMetrics}
                  style={styles.metricsCarousel}
                  contentContainerStyle={[
                    styles.metricsContent,
                    responsiveLayout.useWideMetrics && styles.metricsContentWide,
                  ]}
                >
                  <View style={metricCardStyle}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.borderLight }]}>
                      <Ionicons name="business-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.metricValue}>{metricasFazendas.totalFazendas}</Text>
                    <Text style={styles.metricLabel}>Propriedades</Text>
                  </View>

                  <View style={metricCardStyle}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.accent }]}>
                      <Ionicons name="people-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.metricValue}>{metricasFazendas.totalTitulares}</Text>
                    <Text style={styles.metricLabel}>Titulares</Text>
                  </View>

                  <View style={metricCardStyle}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.secondaryBg }]}>
                      <Ionicons name="leaf-outline" size={20} color={colors.secondary} />
                    </View>
                    <Text style={styles.metricValue}>{formatAreaHa(metricasFazendas.areaTotal)}</Text>
                    <Text style={styles.metricLabel}>Área total informada</Text>
                  </View>

                  <View style={metricCardStyle}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.successBg }]}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                    </View>
                    <Text style={styles.metricValue}>{metricasFazendas.fazendasAtivas}</Text>
                    <Text style={styles.metricLabel}>Ativas</Text>
                  </View>

                  <View style={metricCardStyle}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.amberLight }]}>
                      <Ionicons name="time-outline" size={20} color={colors.warning} />
                    </View>
                    <Text style={styles.metricValue}>{metricasFazendas.fazendasPendentes}</Text>
                    <Text style={styles.metricLabel}>Pendentes</Text>
                  </View>
                </ScrollView>
                {!responsiveLayout.useWideMetrics && (
                  <View style={styles.metricsScrollHint} accessibilityRole="text">
                    <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
                    <Text style={styles.metricsScrollHintText}>
                      Deslize para ver todos os indicadores
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
        ListEmptyComponent={(
          <EmptyState
            icon={listaSemResultadoPorFiltro ? 'search-outline' : 'person-add-outline'}
            title={
              listaSemResultadoPorFiltro
                ? 'Nenhuma Propriedade encontrada'
                : isProdutorView
                  ? 'Nenhuma Propriedade liberada'
                  : 'Nenhuma Propriedade cadastrada'
            }
            message={
              listaSemResultadoPorFiltro
                ? 'Tente ajustar a busca ou limpar os filtros aplicados'
                : isProdutorView
                  ? 'Nenhuma Propriedade liberada para consulta neste acesso.'
                  : 'Comece adicionando a primeira propriedade vinculada a um titular'
            }
            actionLabel={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? 'Nova Propriedade' : undefined}
            actionIcon={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? 'add-circle' : undefined}
            onActionPress={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? () => navigation.navigate('NovaPropriedade') : undefined}
            style={styles.emptyState}
          />
        )}
      />

      {podeCriarProdutor(user) && (
        <CreateActionButton
          label="Nova Propriedade"
          icon="add-outline"
          onPress={() => navigation.navigate('NovaPropriedade')}
          accessibilityLabel="Cadastrar nova propriedade"
        />
      )}

      <FilterBottomSheet
        visible={modalFiltrosVisivel}
        onRequestClose={cancelarFiltros}
        onClear={limparFiltrosRascunho}
        onApply={aplicarFiltros}
        subtitle="Filtre Propriedades por status, UF, município e ordenação"
      >
        <FilterSection title="Status">
          <SegmentedChips
            options={statusOptions}
            value={filtrosRascunho.status}
            onChange={(status) => setFiltrosRascunho((atual) => ({ ...atual, status }))}
            contentStyle={styles.chipsContainer}
          />
        </FilterSection>
        <FilterSection title="Ordenar por">
          <SegmentedChips
            options={ordenacaoOptions}
            value={filtrosRascunho.ordenacao}
            onChange={(novaOrdenacao) => (
              setFiltrosRascunho((atual) => ({ ...atual, ordenacao: novaOrdenacao }))
            )}
            contentStyle={styles.chipsContainer}
          />
        </FilterSection>
        {mostrarFiltrosLocalizacao ? (
          <FilterSection title="UF">
            <SegmentedChips
              options={ufOptions}
              value={filtrosRascunho.uf}
              onChange={(uf) => setFiltrosRascunho((atual) => ({
                ...atual,
                uf,
                municipio: FILTRO_TODOS,
              }))}
              contentStyle={styles.chipsContainer}
            />
          </FilterSection>
        ) : null}
        {mostrarFiltrosLocalizacao ? (
          <FilterSection title="Município">
            <SegmentedChips
              options={municipioOptions}
              value={filtrosRascunho.municipio}
              onChange={(municipio) => setFiltrosRascunho((atual) => ({ ...atual, municipio }))}
              contentStyle={styles.chipsContainer}
            />
          </FilterSection>
        ) : null}
      </FilterBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen + 80
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMedium,
    gap: spacing.md,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.md,
  },
  searchButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  filterButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.md,
  },
  filterButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  filterButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
    letterSpacing: 0.2,
  },
  filterBadgeContainer: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  searchContainerExpanded: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBarExpanded: {
    flex: 1,
    backgroundColor: colors.white,
    borderColor: colors.primary,
    ...shadows.md,
  },
  closeSearchButton: {
    padding: 4,
  },

  // Chips de Filtros Ativos
  activeFiltrosContainer: {
    marginBottom: spacing.md + 4,
    marginTop: spacing.sm,
  },
  activeFiltrosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.sm,
  },
  activeFiltrosTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeFiltrosContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm + 2,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    ...shadows.sm,
  },
  chipIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 0.1,
  },
  removeFilterButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundNeutral,
  },
  clearAllFiltersChip: {
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.sm,
  },
  clearAllFiltersGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  clearAllFiltersText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.2,
  },

  // Métricas compactas no padrão do detalhe da Propriedade
  metricsSection: {
    marginBottom: spacing.md,
  },
  metricsCarousel: {
    marginHorizontal: -spacing.screen,
  },
  metricsContent: {
    paddingHorizontal: spacing.screen,
    gap: 12,
  },
  metricsContentWide: {
    flexGrow: 1,
  },
  metricCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  metricCardScrollable: {
    minWidth: 132,
  },
  metricCardWide: {
    flexShrink: 0,
    minWidth: 0,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    marginTop: 2,
    textAlign: 'center',
  },
  metricsScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  metricsScrollHintText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightSemibold,
    textAlign: 'center',
  },

  // Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    ...shadows.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  sheetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 2,
  },
  closeSheetButton: {
    padding: spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.background,
  },
  clearFiltersText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  applyButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.md,
  },
  applyButtonGradient: {
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
    letterSpacing: 0.5,
  },

  // Empty State
  emptyState: {
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.lg,
    minHeight: 350,
  },
});
