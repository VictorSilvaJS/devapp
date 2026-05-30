import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, RefreshControl, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../components/EmptyState';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import StatCard from '../components/StatCard';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso, podeCriarProdutor, getRegioesDisponiveis } from '../utils/acessoControle';
import { useFiltros } from '../contexts/FiltroContext';
import { buildFazendaListMetrics, getFazendaUiInfo, matchesFazendaUiBusca } from '../utils/fazendaUiCompat';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutoresScreen() {
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [regiaoSelecionada, setRegiaoSelecionada] = useState('todas');
  const [ordenacao, setOrdenacao] = useState('nome'); // nome, area, recente
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [modalFiltrosVisivel, setModalFiltrosVisivel] = useState(false);
  const navigation = useNavigation();
  const { user } = useAuth();
  const { filtrarProdutores: filtrarProdutoresPorRegiao, filtros } = useFiltros();

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

  // Calcular estatísticas da listagem Fazenda + Titular
  const metricasFazendas = buildFazendaListMetrics(produtores);

  // Formata área para exibição compacta
  const formatarArea = (area) => {
    if (area >= 1000) {
      return `${(area / 1000).toFixed(1)}k ha`;
    }
    return `${area.toFixed(1)} ha`;
  };

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
      filtros.push({ tipo: 'status', label: statusLabels[filtroStatus], remover: () => setFiltroStatus('todos') });
    }
    if (regiaoSelecionada !== 'todas') {
      filtros.push({ tipo: 'regiao', label: regiaoSelecionada, remover: () => setRegiaoSelecionada('todas') });
    }
    if (ordenacao !== 'nome') {
      const ordenacaoLabels = { area: 'Por Área', recente: 'Mais Recente' };
      filtros.push({ tipo: 'ordenacao', label: ordenacaoLabels[ordenacao], remover: () => setOrdenacao('nome') });
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

  return (
    <View style={styles.container}>
      <Header title="Propriedades" />
      
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
              placeholder="Buscar por propriedade, titular, cidade ou região..."
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
            
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setModalFiltrosVisivel(true)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={numFiltrosAtivos > 0 ? [colors.primary, colors.primaryDark] : [colors.white, colors.backgroundSoft]}
                style={styles.filterButtonGradient}
              >
                <Ionicons 
                  name="options" 
                  size={20} 
                  color={numFiltrosAtivos > 0 ? colors.white : colors.primary} 
                />
                <Text style={[
                  styles.filterButtonText,
                  numFiltrosAtivos > 0 && { color: colors.white }
                ]}>Filtros</Text>
                {numFiltrosAtivos > 0 && (
                  <View style={styles.filterBadgeContainer}>
                    <Text style={styles.filterBadgeText}>{numFiltrosAtivos}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
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
        {/* Chips de Filtros Ativos */}
        {filtrosAtivos.length > 0 && (
          <View style={styles.activeFiltrosContainer}>
            <View style={styles.activeFiltrosHeader}>
              <Ionicons name="funnel" size={14} color={colors.textLight} />
              <Text style={styles.activeFiltrosTitle}>Filtros Ativos:</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltrosContent}
            >
              {filtrosAtivos.map((filtro, index) => {
                const iconeConfig = {
                  status: { name: 'checkmark-circle', color: colors.success },
                  regiao: { name: 'location', color: colors.coral },
                  ordenacao: { name: 'swap-vertical', color: colors.teal }
                };
                const config = iconeConfig[filtro.tipo];
                
                return (
                  <LinearGradient
                    key={index}
                    colors={[colors.white, colors.backgroundSoft]}
                    style={styles.activeFilterChip}
                  >
                    <View style={[styles.chipIconContainer, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.name} size={16} color={config.color} />
                    </View>
                    <Text style={styles.activeFilterText}>{filtro.label}</Text>
                    <TouchableOpacity 
                      onPress={filtro.remover} 
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.removeFilterButton}
                    >
                      <Ionicons name="close" size={16} color={colors.textLight} />
                    </TouchableOpacity>
                  </LinearGradient>
                );
              })}
              <TouchableOpacity 
                style={styles.clearAllFiltersChip}
                onPress={() => {
                  setFiltroStatus('todos');
                  setRegiaoSelecionada('todas');
                  setOrdenacao('nome');
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[colors.errorBgLight, colors.errorBgMedium]}
                  style={styles.clearAllFiltersGradient}
                >
                  <Ionicons name="refresh" size={16} color={colors.error} />
                  <Text style={styles.clearAllFiltersText}>Limpar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Métricas Compactas em Carrossel */}
        {produtores.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.metricsCarousel}
            contentContainerStyle={styles.metricsContent}
          >
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: colors.borderLight }]}>
                <Ionicons name="business-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.metricValue}>{metricasFazendas.totalFazendas}</Text>
              <Text style={styles.metricLabel}>Propriedades</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.metricValue}>{metricasFazendas.totalTitulares}</Text>
              <Text style={styles.metricLabel}>Titulares</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: colors.secondaryBg }]}>
                <Ionicons name="leaf-outline" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.metricValue}>{formatarArea(metricasFazendas.areaTotal)}</Text>
              <Text style={styles.metricLabel}>Área Total</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              </View>
              <Text style={styles.metricValue}>{metricasFazendas.fazendasAtivas}</Text>
              <Text style={styles.metricLabel}>Ativas</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: colors.amberLight }]}>
                <Ionicons name="time-outline" size={20} color={colors.warning} />
              </View>
              <Text style={styles.metricValue}>{metricasFazendas.fazendasPendentes}</Text>
              <Text style={styles.metricLabel}>Pendentes</Text>
            </View>
          </ScrollView>
        )}

        {/* Lista de Fazendas + Titular */}
        {produtoresFiltrados.length === 0 ? (
          <EmptyState
            icon={listaSemResultadoPorFiltro ? 'search-outline' : 'person-add-outline'}
            title={listaSemResultadoPorFiltro ? 'Nenhuma propriedade encontrada' : 'Nenhuma propriedade cadastrada'}
            message={
              listaSemResultadoPorFiltro
                ? 'Tente ajustar os filtros de busca ou limpar os filtros aplicados'
                : 'Comece adicionando a primeira propriedade vinculada a um titular'
            }
            actionLabel={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? 'Adicionar Primeira Propriedade' : undefined}
            actionIcon={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? 'add-circle' : undefined}
            onActionPress={!listaSemResultadoPorFiltro && podeCriarProdutor(user) ? () => navigation.navigate('NovoProdutor') : undefined}
            style={styles.emptyState}
          />
        ) : (
          produtoresFiltrados.map(p => (
            <ProdutorCard key={p.id} produtor={p} onPress={() => navigation.navigate('ProdutorDetail', { id: p.id })} />
          ))
        )}
      </ScrollView>

      {/* FAB - Floating Action Button Expandido */}
      {podeCriarProdutor(user) && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('NovoProdutor')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark, colors.fabDark]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.fabContent}>
              <View style={styles.fabIconContainer}>
                <Ionicons name="add" size={26} color={colors.white} />
              </View>
              <Text style={styles.fabText}>Nova Propriedade</Text>
            </View>
          </LinearGradient>
          <View style={styles.fabPulse} />
        </TouchableOpacity>
      )}

      {/* Bottom Sheet de Filtros */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalFiltrosVisivel}
        onRequestClose={() => setModalFiltrosVisivel(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setModalFiltrosVisivel(false)}
        >
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            {/* Indicador de arraste */}
            <View style={styles.sheetHandle} />
            
            {/* Header do Bottom Sheet */}
            <LinearGradient
              colors={[colors.white, colors.backgroundSoft]}
              style={styles.sheetHeader}
            >
              <View style={styles.sheetTitleContainer}>
                <View style={styles.sheetIconContainer}>
                  <Ionicons name="options" size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Filtros e Ordenação</Text>
                  <Text style={styles.sheetSubtitle}>Personalize sua visualização</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setModalFiltrosVisivel(false)}
                style={styles.closeSheetButton}
              >
                <Ionicons name="close-circle" size={32} color={colors.muted} />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {/* Status */}
              <Text style={styles.sectionTitle}>Status</Text>
              <SegmentedChips
                options={statusOptions}
                value={filtroStatus}
                onChange={setFiltroStatus}
                contentStyle={styles.chipsContainer}
              />

              {/* Ordenação */}
              <Text style={styles.sectionTitle}>Ordenar por</Text>
              <SegmentedChips
                options={ordenacaoOptions}
                value={ordenacao}
                onChange={setOrdenacao}
                contentStyle={styles.chipsContainer}
              />

              {/* Região (apenas para admin) */}
              {mostrarFiltroRegiao && (
                <>
                  <Text style={styles.sectionTitle}>Região</Text>
                  <SegmentedChips
                    options={regiaoOptions}
                    value={regiaoSelecionada}
                    onChange={setRegiaoSelecionada}
                    contentStyle={styles.chipsContainer}
                  />
                </>
              )}

              {/* Botão Limpar Filtros */}
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setFiltroStatus('todos');
                  setRegiaoSelecionada('todas');
                  setOrdenacao('nome');
                }}
              >
                <Ionicons name="refresh-outline" size={20} color={colors.primary} />
                <Text style={styles.clearFiltersText}>Limpar Filtros</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Botão Aplicar */}
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => setModalFiltrosVisivel(false)}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.applyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Métricas Compactas
  metricsCarousel: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.screen,
  },
  metricsContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  metricCard: {
    width: 100,
    alignItems: 'center',
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

  // FAB - Floating Action Button Expandido
  fab: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen + 20,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: colors.fabShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  fabGradient: {
    borderRadius: 32,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md + 2,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  fabIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: typography.fontBody + 2,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fabPulse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: 'transparent',
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
