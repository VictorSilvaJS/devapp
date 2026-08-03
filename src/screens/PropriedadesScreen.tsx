import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, RefreshControl, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import StatCard from '../components/StatCard';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../components/FilterBottomSheet';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso, podeCriarProdutor, getRegioesDisponiveis } from '../utils/acessoControle';
import { useFiltros } from '../contexts/FiltroContext';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { buildFazendaListMetrics, getFazendaUiInfo, matchesFazendaUiBusca } from '../utils/fazendaUiCompat';
import { formatAreaHa } from '../utils/talhaoMedidasCompat';
import {
  getDashboardColumnWidth,
  getDashboardResponsiveLayout,
} from '../utils/dashboardResponsive';

export default function PropriedadesScreen() {
  const { width, height } = useWindowDimensions();
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [regiaoSelecionada, setRegiaoSelecionada] = useState('todas');
  const [ordenacao, setOrdenacao] = useState('nome'); // nome, area, recente
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [modalFiltrosVisivel, setModalFiltrosVisivel] = useState(false);
  const [filtrosRascunho, setFiltrosRascunho] = useState({
    status: 'todos',
    regiao: 'todas',
    ordenacao: 'nome',
  });
  const navigation = useNavigation();
  const { user } = useAuth();
  const { filtrarProdutores: filtrarProdutoresPorRegiao, filtros } = useFiltros();
  const isProdutorView = user?.perfil === 'produtor';
  const responsiveLayout = getDashboardResponsiveLayout(width, height);
  const metricCardWidth = getDashboardColumnWidth(responsiveLayout.propriedadesColumns);

  useEffect(() => { load(); }, [user, filtros]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });

    return unsubscribe;
  }, [navigation, user, filtros]);
  
  const load = async () => {
    const data = await Produtor.list();
    // Filtrar por acesso do usuário
    let produtoresFiltrados = filtrarProdutoresPorAcesso(data, user);
    
    // Para admin e colaborador, aplicar filtros regionais globais
    if (user?.perfil === 'admin' || user?.perfil === 'colaborador') {
      produtoresFiltrados = filtrarProdutoresPorRegiao(produtoresFiltrados);
    }
    
    setProdutores(produtoresFiltrados);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Obter regiões disponíveis para o usuário
  const regioes = getRegioesDisponiveis(user, produtores);
  const mostrarFiltroRegiao = user?.perfil === 'admin' && regioes.length > 0;

  // Filtrar fazendas por busca, status e região
  const produtoresFiltrados = produtores.filter(produtor => {
    const matchBusca = matchesFazendaUiBusca(produtor, busca);
    
    const matchStatus = filtroStatus === 'todos' || produtor.status === filtroStatus;
    
    const matchRegiao = !mostrarFiltroRegiao || 
      regiaoSelecionada === 'todas' || 
      produtor.regiao === regiaoSelecionada;
    
    return matchBusca && matchStatus && matchRegiao;
  }).sort((a, b) => {
    // Aplicar ordenação
    if (ordenacao === 'nome') {
      return getFazendaUiInfo(a).fazendaNome.localeCompare(getFazendaUiInfo(b).fazendaNome);
    } else if (ordenacao === 'area') {
      return (b.area_total || 0) - (a.area_total || 0);
    } else if (ordenacao === 'recente') {
      return new Date(b.data_cadastro || 0).getTime() - new Date(a.data_cadastro || 0).getTime();
    }
    return 0;
  });

  // Calcular estatísticas da listagem Propriedade + Titular
  const metricasFazendas = buildFazendaListMetrics(produtores);

  // Contar filtros ativos
  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtroStatus !== 'todos') count++;
    if (regiaoSelecionada !== 'todas') count++;
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
    if (regiaoSelecionada !== 'todas') {
      filtros.push({ tipo: 'regiao', label: regiaoSelecionada, icon: 'location', color: colors.coral, remover: () => setRegiaoSelecionada('todas') });
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
    busca.trim().length > 0 || filtroStatus !== 'todos' || regiaoSelecionada !== 'todas';
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
  const regiaoOptions = [
    { value: 'todas', label: 'Todas' },
    ...regioes.map((regiao) => ({ value: regiao, label: regiao })),
  ];

  const getFiltrosAplicados = () => ({
    status: filtroStatus,
    regiao: regiaoSelecionada,
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
      regiao: 'todas',
      ordenacao: 'nome',
    });
  };

  const aplicarFiltros = () => {
    setFiltroStatus(filtrosRascunho.status);
    setRegiaoSelecionada(filtrosRascunho.regiao);
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
              placeholder="Buscar por propriedade, titular, cidade, região ou microregião..."
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

      <ScrollView 
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
      >
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
            setRegiaoSelecionada('todas');
            setOrdenacao('nome');
          }}
        />

        {/* Métricas responsivas */}
        {produtores.length > 0 && (
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCardWrapper, { width: metricCardWidth }]}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.metricValue}>{metricasFazendas.totalFazendas}</Text>
                <Text style={styles.metricLabel}>Propriedades</Text>
              </View>
            </View>

            <View style={[styles.metricCardWrapper, { width: metricCardWidth }]}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.accent }]}>
                  <Ionicons name="people-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.metricValue}>{metricasFazendas.totalTitulares}</Text>
                <Text style={styles.metricLabel}>Titulares</Text>
              </View>
            </View>

            <View style={[styles.metricCardWrapper, { width: metricCardWidth }]}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.secondaryBg }]}>
                  <Ionicons name="leaf-outline" size={20} color={colors.secondary} />
                </View>
                <Text style={styles.metricValue}>{formatAreaHa(metricasFazendas.areaTotal)}</Text>
                <Text style={styles.metricLabel}>Área total informada</Text>
              </View>
            </View>

            <View style={[styles.metricCardWrapper, { width: metricCardWidth }]}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.successBg }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                </View>
                <Text style={styles.metricValue}>{metricasFazendas.fazendasAtivas}</Text>
                <Text style={styles.metricLabel}>Ativas</Text>
              </View>
            </View>

            <View style={[styles.metricCardWrapper, { width: metricCardWidth }]}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.amberLight }]}>
                  <Ionicons name="time-outline" size={20} color={colors.warning} />
                </View>
                <Text style={styles.metricValue}>{metricasFazendas.fazendasPendentes}</Text>
                <Text style={styles.metricLabel}>Pendentes</Text>
              </View>
            </View>
          </View>
        )}

        {/* Lista de Propriedades + Titular */}
        {produtoresFiltrados.length === 0 ? (
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
        ) : (
          produtoresFiltrados.map(p => (
            <ProdutorCard
              key={p.id}
              produtor={p}
              onPress={() => {
                const params = buildPropriedadeDetailRouteParams(p);
                if (params) navigation.navigate('ProdutorDetail', params);
              }}
            />
          ))
        )}
      </ScrollView>

      {podeCriarProdutor(user) && (
        <View style={styles.safeActionArea}>
          <CreateActionButton
            label="Nova Propriedade"
            icon="add-outline"
            onPress={() => navigation.navigate('NovaPropriedade')}
            accessibilityLabel="Cadastrar nova propriedade"
            placement="docked"
          />
        </View>
      )}

      <FilterBottomSheet
        visible={modalFiltrosVisivel}
        onRequestClose={cancelarFiltros}
        onClear={limparFiltrosRascunho}
        onApply={aplicarFiltros}
        subtitle="Filtre Propriedades por status, Região e ordenação"
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
        {mostrarFiltroRegiao ? (
          <FilterSection title="Região">
            <SegmentedChips
              options={regiaoOptions}
              value={filtrosRascunho.regiao}
              onChange={(regiao) => setFiltrosRascunho((atual) => ({ ...atual, regiao }))}
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

  // Métricas responsivas
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    marginHorizontal: -6,
  },
  metricCardWrapper: {
    paddingHorizontal: 6,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    ...shadows.sm,
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
    marginTop: 2,
    textAlign: 'center',
  },
  safeActionArea: {
    flexShrink: 0,
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
