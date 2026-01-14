import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, RefreshControl, TextInput, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import StatCard from '../components/StatCard';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso, podeCriarProdutor, getRegioesDisponiveis } from '../utils/acessoControle';

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

  useEffect(() => { load(); }, [user]);
  
  const load = async () => {
    const data = await Produtor.list();
    // Filtrar por acesso do usuário
    const produtoresFiltrados = filtrarProdutoresPorAcesso(data, user);
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

  // Filtrar produtores por busca, status e região
  const produtoresFiltrados = produtores.filter(produtor => {
    const matchBusca = !busca || 
      produtor.nome.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.fazenda.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.cidade?.toLowerCase().includes(busca.toLowerCase());
    
    const matchStatus = filtroStatus === 'todos' || produtor.status === filtroStatus;
    
    const matchRegiao = !mostrarFiltroRegiao || 
      regiaoSelecionada === 'todas' || 
      produtor.regiao === regiaoSelecionada;
    
    return matchBusca && matchStatus && matchRegiao;
  }).sort((a, b) => {
    // Aplicar ordenação
    if (ordenacao === 'nome') {
      return a.nome.localeCompare(b.nome);
    } else if (ordenacao === 'area') {
      return (b.area_total || 0) - (a.area_total || 0);
    } else if (ordenacao === 'recente') {
      return new Date(b.data_cadastro || 0) - new Date(a.data_cadastro || 0);
    }
    return 0;
  });

  // Calcular estatísticas
  const totalProdutores = produtores.length;
  const produtoresAtivos = produtores.filter(p => p.status === 'ativo').length;
  const areaTotal = produtores.reduce((sum, p) => sum + (p.area_total || 0), 0);
  const produtoresPendentes = produtores.filter(p => p.status === 'pendente').length;

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

  return (
    <View style={styles.container}>
      <Header title="Produtores" />
      
      {/* Barra de Busca Compacta */}
      <View style={styles.topBar}>
        {mostrarBusca ? (
          <View style={styles.searchContainerExpanded}>
            <Ionicons name="search-outline" size={20} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar produtor..."
              placeholderTextColor={colors.muted}
              value={busca}
              onChangeText={setBusca}
              autoFocus
            />
            <TouchableOpacity onPress={() => {
              setBusca('');
              setMostrarBusca(false);
            }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => setMostrarBusca(true)}
            >
              <Ionicons name="search-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setModalFiltrosVisivel(true)}
            >
              <Ionicons name="options-outline" size={22} color={colors.text} />
              <Text style={styles.filterButtonText}>Filtros</Text>
              {numFiltrosAtivos > 0 && (
                <View style={styles.filterBadgeContainer}>
                  <Text style={styles.filterBadgeText}>{numFiltrosAtivos}</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltrosContent}
            >
              {filtrosAtivos.map((filtro, index) => (
                <View key={index} style={styles.activeFilterChip}>
                  <Ionicons 
                    name={filtro.tipo === 'status' ? 'checkmark-circle' : filtro.tipo === 'regiao' ? 'location' : 'swap-vertical'} 
                    size={14} 
                    color={colors.primary} 
                  />
                  <Text style={styles.activeFilterText}>{filtro.label}</Text>
                  <TouchableOpacity onPress={filtro.remover} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity 
                style={styles.clearAllFiltersChip}
                onPress={() => {
                  setFiltroStatus('todos');
                  setRegiaoSelecionada('todas');
                  setOrdenacao('nome');
                }}
              >
                <Ionicons name="close" size={14} color={colors.error} />
                <Text style={styles.clearAllFiltersText}>Limpar Tudo</Text>
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
              <View style={[styles.metricIcon, { backgroundColor: '#e8f5e8' }]}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.metricValue}>{totalProdutores}</Text>
              <Text style={styles.metricLabel}>Total</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: '#f5f3f0' }]}>
                <Ionicons name="leaf-outline" size={20} color="#8B6244" />
              </View>
              <Text style={styles.metricValue}>{formatarArea(areaTotal)}</Text>
              <Text style={styles.metricLabel}>Área Total</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              </View>
              <Text style={styles.metricValue}>{produtoresAtivos}</Text>
              <Text style={styles.metricLabel}>Ativos</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time-outline" size={20} color={colors.warning} />
              </View>
              <Text style={styles.metricValue}>{produtoresPendentes}</Text>
              <Text style={styles.metricLabel}>Pendentes</Text>
            </View>
          </ScrollView>
        )}

        {/* Lista de Produtores */}
        {produtoresFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={busca ? 'search-outline' : 'person-add-outline'} 
              size={80} 
              color={colors.muted} 
            />
            <Text style={styles.emptyText}>
              {busca ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
            </Text>
            <Text style={styles.emptySubtext}>
              {busca 
                ? 'Tente ajustar os filtros de busca' 
                : 'Comece adicionando seu primeiro produtor'}
            </Text>
          </View>
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
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.fabContent}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.fabText}>Novo Produtor</Text>
            </View>
          </LinearGradient>
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
            {/* Header do Bottom Sheet */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtros e Ordenação</Text>
              <TouchableOpacity onPress={() => setModalFiltrosVisivel(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {/* Status */}
              <Text style={styles.sectionTitle}>Status</Text>
              <View style={styles.chipsContainer}>
                {[
                  { key: 'todos', label: 'Todos', icon: 'apps-outline' },
                  { key: 'ativo', label: 'Ativo', icon: 'checkmark-circle-outline' },
                  { key: 'inativo', label: 'Inativo', icon: 'close-circle-outline' },
                  { key: 'pendente', label: 'Pendente', icon: 'time-outline' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.chip,
                      filtroStatus === item.key && styles.chipActive
                    ]}
                    onPress={() => setFiltroStatus(item.key)}
                  >
                    <Ionicons 
                      name={item.icon} 
                      size={18} 
                      color={filtroStatus === item.key ? colors.white : colors.primary} 
                    />
                    <Text style={[
                      styles.chipText,
                      filtroStatus === item.key && styles.chipTextActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ordenação */}
              <Text style={styles.sectionTitle}>Ordenar por</Text>
              <View style={styles.chipsContainer}>
                {[
                  { key: 'nome', label: 'Nome', icon: 'text-outline' },
                  { key: 'area', label: 'Área', icon: 'resize-outline' },
                  { key: 'recente', label: 'Mais Recente', icon: 'time-outline' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.chip,
                      ordenacao === item.key && styles.chipActive
                    ]}
                    onPress={() => setOrdenacao(item.key)}
                  >
                    <Ionicons 
                      name={item.icon} 
                      size={18} 
                      color={ordenacao === item.key ? colors.white : colors.primary} 
                    />
                    <Text style={[
                      styles.chipText,
                      ordenacao === item.key && styles.chipTextActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Região (apenas para admin) */}
              {mostrarFiltroRegiao && (
                <>
                  <Text style={styles.sectionTitle}>Região</Text>
                  <View style={styles.chipsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        regiaoSelecionada === 'todas' && styles.chipActive
                      ]}
                      onPress={() => setRegiaoSelecionada('todas')}
                    >
                      <Ionicons 
                        name="location-outline" 
                        size={18} 
                        color={regiaoSelecionada === 'todas' ? colors.white : colors.primary} 
                      />
                      <Text style={[
                        styles.chipText,
                        regiaoSelecionada === 'todas' && styles.chipTextActive
                      ]}>
                        Todas
                      </Text>
                    </TouchableOpacity>
                    {regioes.map((regiao) => (
                      <TouchableOpacity
                        key={regiao}
                        style={[
                          styles.chip,
                          regiaoSelecionada === regiao && styles.chipActive
                        ]}
                        onPress={() => setRegiaoSelecionada(regiao)}
                      >
                        <Text style={[
                          styles.chipText,
                          regiaoSelecionada === regiao && styles.chipTextActive
                        ]}>
                          {regiao}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 22,
    gap: spacing.sm,
    ...shadows.sm,
  },
  filterButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  filterBadgeContainer: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  searchContainerExpanded: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 22,
    gap: spacing.sm,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
    paddingVertical: 0,
  },

  // Chips de Filtros Ativos
  activeFiltrosContainer: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.screen,
  },
  activeFiltrosContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  activeFilterText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  clearAllFiltersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.error,
    ...shadows.sm,
  },
  clearAllFiltersText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.error,
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
    borderRadius: 28,
    ...shadows.lg,
    elevation: 8,
  },
  fabGradient: {
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fabText: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.white,
    letterSpacing: 0.3,
  },

  // Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    ...shadows.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: typography.fontTitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  chipTextActive: {
    color: colors.white,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  clearFiltersText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.primary,
  },
  applyButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 14,
    overflow: 'hidden',
    ...shadows.md,
  },
  applyButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 2,
    paddingHorizontal: spacing.screen,
    minHeight: 300,
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
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
