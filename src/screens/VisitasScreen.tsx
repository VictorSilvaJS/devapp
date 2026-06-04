import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import EmptyState from '../components/EmptyState';
import Header from '../components/Header';
import InfoBox from '../components/InfoBox';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import { Visita, Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useFiltros } from '../contexts/FiltroContext';
import {
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorFazendaIds,
  findFazendaById,
  getFazendaId,
  getFazendaIds,
  getVisitaFazendaId,
  podeCriarVisita,
} from '../utils/acessoControle';
import { getFazendaUiInfo, matchesFazendaUiBusca } from '../utils/fazendaUiCompat';

export default function VisitasScreen() {
  const navigation = useNavigation();
  const [visitas, setVisitas] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroData, setFiltroData] = useState('todos'); // todos, hoje, semana, mes
  const [ordenacao, setOrdenacao] = useState('data'); // data, fazenda, status
  const [modalFiltrosVisivel, setModalFiltrosVisivel] = useState(false);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros, filtrarProdutores: filtrarFazendas } = useFiltros();

  const load = useCallback(async () => {
    try {
      // Simula lógica de permissões por perfil
      let visitasData = [];
      let fazendasData = [];

      if (user?.perfil === 'admin') {
        // Admin vê tudo com filtros aplicados
        const [todasVisitas, fazendasBrutas] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
        
        // Aplicar filtros regionais
        const fazendaIdsFiltrados = getFazendaIdsFiltrados(fazendasBrutas);
        visitasData = filtrarVisitasPorFazendaIds(todasVisitas, fazendaIdsFiltrados);
        fazendasData = fazendasBrutas.filter(p => fazendaIdsFiltrados.includes(getFazendaId(p)));
      } else if (user?.perfil === 'colaborador' || user?.perfil === 'produtor') {
        const [todasVisitas, fazendasBrutas] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);

        const fazendasComAcesso = filtrarProdutoresPorAcesso(fazendasBrutas, user);
        fazendasData = filtrarFazendas(fazendasComAcesso);
        const idsFiltrados = getFazendaIds(fazendasData);
        visitasData = filtrarVisitasPorFazendaIds(todasVisitas, idsFiltrados);
      } else {
        // Sem usuário, carrega tudo (fallback)
        [visitasData, fazendasData] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
      }

      setVisitas(visitasData);
      setFazendas(fazendasData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [filtros, user]);

  // Recarrega ao abrir, ao retornar para a tela ou quando os filtros mudam.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const getFazenda = (fazendaId) => findFazendaById(fazendas, fazendaId) || {};

  // Função para filtrar por data
  const filtrarPorData = (visita) => {
    if (filtroData === 'todos') return true;
    
    const dataVisita = new Date(visita.data_visita);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (filtroData === 'hoje') {
      const visitaDay = new Date(dataVisita);
      visitaDay.setHours(0, 0, 0, 0);
      return visitaDay.getTime() === hoje.getTime();
    }
    
    if (filtroData === 'semana') {
      const umaSemanaAtras = new Date(hoje);
      umaSemanaAtras.setDate(hoje.getDate() - 7);
      const umaSemanaFrente = new Date(hoje);
      umaSemanaFrente.setDate(hoje.getDate() + 7);
      return dataVisita >= umaSemanaAtras && dataVisita <= umaSemanaFrente;
    }
    
    if (filtroData === 'mes') {
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();
      return dataVisita.getMonth() === mesAtual && dataVisita.getFullYear() === anoAtual;
    }
    
    return true;
  };

  // Filtro de busca e filtros combinados
  const visitasFiltradas = visitas.filter(visita => {
    const fazenda = getFazenda(getVisitaFazendaId(visita));

    const matchBusca = matchesFazendaUiBusca(fazenda, busca, [
      visita.objetivo,
      visita.tecnico_responsavel,
      visita.status,
    ]);
    
    const matchStatus = filtroStatus === 'todos' || visita.status === filtroStatus;
    const matchData = filtrarPorData(visita);
    
    return matchBusca && matchStatus && matchData;
  }).sort((a, b) => {
    // Aplicar ordenação
    if (ordenacao === 'data') {
      return new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime();
    } else if (ordenacao === 'fazenda' || ordenacao === 'produtor') {
      const fazendaA = getFazendaUiInfo(getFazenda(getVisitaFazendaId(a)));
      const fazendaB = getFazendaUiInfo(getFazenda(getVisitaFazendaId(b)));
      return (fazendaA.fazendaNome || '').localeCompare(fazendaB.fazendaNome || '');
    } else if (ordenacao === 'status') {
      const statusOrder = { agendada: 0, realizada: 1, cancelada: 2 };
      return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
    }
    return 0;
  });

  // Cores para objetivos
  const getObjetivoColor = (objetivo) => {
    const cores = {
      consultoria: colors.primary,
      coleta_solo: colors.info,
      avaliacao_cultivo: colors.success,
      entrega_material: colors.warning,
      outro: colors.muted
    };
    return cores[objetivo] || colors.muted;
  };

  // Cores para status
  const getStatusColor = (status) => {
    const cores = {
      agendada: colors.info,
      realizada: colors.success,
      cancelada: colors.danger
    };
    return cores[status] || colors.muted;
  };

  // Ícones para objetivos
  const getObjetivoIcon = (objetivo) => {
    const icones = {
      consultoria: 'people-outline',
      coleta_solo: 'flask-outline',
      avaliacao_cultivo: 'leaf-outline',
      entrega_material: 'cube-outline',
      outro: 'ellipsis-horizontal-outline'
    };
    return icones[objetivo] || 'calendar-outline';
  };

  // Formata data
  const formatarData = (data) => {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Contar filtros ativos
  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtroStatus !== 'todos') count++;
    if (filtroData !== 'todos') count++;
    if (ordenacao !== 'data') count++;
    return count;
  };

  // Obter labels dos filtros ativos
  const getFiltrosAtivos = () => {
    const filtros = [];
    if (filtroStatus !== 'todos') {
      const statusLabels = { agendada: 'Agendadas', realizada: 'Realizadas', cancelada: 'Canceladas' };
      filtros.push({ tipo: 'status', label: statusLabels[filtroStatus], remover: () => setFiltroStatus('todos') });
    }
    if (filtroData !== 'todos') {
      const dataLabels = { hoje: 'Hoje', semana: 'Esta Semana', mes: 'Este Mês' };
      filtros.push({ tipo: 'data', label: dataLabels[filtroData], remover: () => setFiltroData('todos') });
    }
    if (ordenacao !== 'data') {
      const ordenacaoLabels = { fazenda: 'Por Propriedade', produtor: 'Por Propriedade', status: 'Por Status' };
      filtros.push({ tipo: 'ordenacao', label: ordenacaoLabels[ordenacao], remover: () => setOrdenacao('data') });
    }
    return filtros;
  };

  const filtrosAtivos = getFiltrosAtivos();
  const numFiltrosAtivos = contarFiltrosAtivos();
  const statusOptions = [
    { value: 'todos', label: 'Todas' },
    { value: 'agendada', label: 'Agendadas' },
    { value: 'realizada', label: 'Realizadas' },
    { value: 'cancelada', label: 'Canceladas' },
  ];
  const periodoOptions = [
    { value: 'todos', label: 'Todas' },
    { value: 'hoje', label: 'Hoje' },
    { value: 'semana', label: 'Esta Semana' },
    { value: 'mes', label: 'Este Mês' },
  ];
  const ordenacaoOptions = [
    { value: 'data', label: 'Data' },
    { value: 'fazenda', label: 'Propriedade' },
    { value: 'status', label: 'Status' },
  ];

  return (
    <View style={styles.container}>
      <Header title="Visitas Técnicas" />
      
      {/* Top Bar com Busca e Filtros */}
      <LinearGradient
        colors={[colors.white, colors.background]}
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
              placeholder="Buscar por propriedade, objetivo ou técnico..."
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
                  data: { name: 'calendar', color: colors.coral },
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
                  setFiltroData('todos');
                  setOrdenacao('data');
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando visitas...</Text>
          </View>
        ) : visitasFiltradas.length === 0 ? (
          <View style={styles.emptyStateWrapper}>
            <EmptyState
              icon={busca ? 'search-outline' : 'calendar-outline'}
              title={busca ? 'Nenhuma visita encontrada' : 'Nenhuma visita agendada'}
              message={
                busca
                  ? 'Tente ajustar sua busca ou aguarde novas visitas'
                  : 'As visitas técnicas agendadas aparecerão aqui'
              }
              style={styles.emptyState}
            />
            {!busca && (
              <InfoBox
                icon="bulb-outline"
                message={
                  user?.perfil === 'admin' || user?.perfil === 'colaborador'
                    ? 'Agende visitas para acompanhamento técnico das propriedades'
                    : 'Aguarde o agendamento de visitas técnicas pela equipe'
                }
                style={styles.emptyTipInfo}
              />
            )}
          </View>
        ) : (
          visitasFiltradas.map(visita => {
            const fazenda = getFazenda(getVisitaFazendaId(visita));
            const fazendaInfo = getFazendaUiInfo(fazenda);
            const objetivoColor = getObjetivoColor(visita.objetivo);
            const statusColor = getStatusColor(visita.status);
            const objetivoIcon = getObjetivoIcon(visita.objetivo);
            
            return (
              <TouchableOpacity 
                key={visita.id} 
                style={styles.card}
                onPress={() => navigation.navigate('VisitaDetail', { visitaId: visita.id })}
                activeOpacity={0.7}
              >
                {/* Cabeçalho do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIcon, { backgroundColor: objetivoColor + '20' }]}>
                      <Ionicons name={objetivoIcon} size={24} color={objetivoColor} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {fazendaInfo.fazendaNome || 'Propriedade não encontrada'}
                      </Text>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {fazendaInfo.titularNome || fazendaInfo.localizacao}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                      {visita.status}
                    </Text>
                  </View>
                </View>

                {/* Tipo de Visita */}
                <View style={[styles.objetivoBox, { backgroundColor: objetivoColor + '10' }]}>
                  <Text style={[styles.objetivoText, { color: objetivoColor }]}>
                    {visita.objetivo.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>

                {/* Informações */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                    <Text style={styles.infoText}>{formatarData(visita.data_visita)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                    <Text style={styles.infoText} numberOfLines={1}>
                      {visita.tecnico_responsavel}
                    </Text>
                  </View>
                  {visita.clima && (
                    <View style={styles.infoRow}>
                      <Ionicons name="cloudy-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                      <Text style={styles.infoText}>{visita.clima}</Text>
                    </View>
                  )}
                  {visita.proximaVisita && (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        Próxima: {formatarData(visita.proximaVisita)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Observações */}
                {visita.observacoes && (
                  <View style={styles.observacoesBox}>
                    <Text style={styles.observacoesLabel}>Observações:</Text>
                    <Text style={styles.observacoesText} numberOfLines={2}>
                      {visita.observacoes}
                    </Text>
                  </View>
                )}

                {/* Recomendações */}
                {visita.recomendacoes && (
                  <View style={styles.recomendacoesBox}>
                    <Text style={styles.recomendacoesLabel}>Recomendações:</Text>
                    <Text style={styles.recomendacoesText} numberOfLines={2}>
                      {visita.recomendacoes}
                    </Text>
                  </View>
                )}

                {/* Fotos */}
                {visita.fotos && visita.fotos.length > 0 && (
                  <View style={styles.fotosBox}>
                    <Ionicons name="images-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
                    <Text style={styles.fotosText}>
                      {visita.fotos.length} foto(s) anexada(s)
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Botão FAB - Nova Visita */}
      {podeCriarVisita(user) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('NovaVisita')}
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
              <Text style={styles.fabText}>Nova Visita</Text>
            </View>
          </LinearGradient>
          <View style={styles.fabPulse} />
        </TouchableOpacity>
      )}

      {/* Modal de Filtros */}
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

              {/* Período */}
              <Text style={styles.sectionTitle}>Período</Text>
              <SegmentedChips
                options={periodoOptions}
                value={filtroData}
                onChange={setFiltroData}
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

              {/* Botão Limpar Filtros */}
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setFiltroStatus('todos');
                  setFiltroData('todos');
                  setOrdenacao('data');
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
  searchContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.gap,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    ...shadows.sm
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.gap,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8
  },
  searchInputLegacy: {
    flex: 1,
    height: 44,
    fontSize: typography.fontBody,
    color: colors.text,
    paddingVertical: 8
  },
  clearButton: {
    paddingHorizontal: 8
  },
  filtrosContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  filtrosContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filtroGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  divisor: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 4,
  },
  filtroChipActive: {
    backgroundColor: colors.primary,
  },
  filtroText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  filtroTextActive: {
    color: colors.white,
  },
  
  // Ordenação
  ordenacaoContainer: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.screen,
  },
  ordenacaoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  ordenacaoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ordenacaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ordenacaoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ordenacaoChipText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  ordenacaoChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen + 80
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 4
  },
  loadingText: {
    marginTop: spacing.gap,
    fontSize: typography.fontBody,
    color: colors.muted
  },
  card: { 
    backgroundColor: colors.card, 
    padding: spacing.card + 4, 
    borderRadius: spacing.radius, 
    marginBottom: spacing.gap,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.gap
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.gap
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.gap
  },
  cardHeaderInfo: {
    flex: 1
  },
  cardTitle: { 
    fontSize: typography.fontBody + 2, 
    fontWeight: typography.weightBold, 
    color: colors.text 
  },
  cardSubtitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    marginTop: 2
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  badgeText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    textTransform: 'capitalize'
  },
  objetivoBox: {
    paddingHorizontal: spacing.gap,
    paddingVertical: 6,
    borderRadius: spacing.radiusSm,
    marginBottom: spacing.gap,
    alignSelf: 'flex-start'
  },
  objetivoText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    letterSpacing: 0.5
  },
  cardInfo: {
    marginTop: spacing.gap - 2
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  infoIcon: {
    marginRight: 8,
    width: 18
  },
  infoText: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    flex: 1
  },
  observacoesBox: {
    backgroundColor: colors.background,
    padding: spacing.gap,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.gap
  },
  observacoesLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
    marginBottom: 4
  },
  observacoesText: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    lineHeight: 18
  },
  recomendacoesBox: {
    backgroundColor: colors.accent,
    padding: spacing.gap,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.gap,
    borderWidth: 1,
    borderColor: colors.accentDark
  },
  recomendacoesLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.primaryDark,
    marginBottom: 4
  },
  recomendacoesText: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    lineHeight: 18
  },
  fotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.gap,
    paddingTop: spacing.gap,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  fotosText: {
    fontSize: typography.fontCaption + 1,
    color: colors.muted
  },
  emptyStateWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.screen * 2,
    minHeight: 400,
  },
  emptyState: {
    padding: 0,
  },
  emptyTipInfo: {
    marginTop: spacing.lg,
    marginBottom: 0,
    maxWidth: 340,
  },
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
  
  // Top Bar Styles
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
  
  // Active Filters Chips
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
  
  // Modal Styles
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
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  clearFiltersText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  applyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    ...shadows.md,
  },
  applyButtonGradient: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.white,
    letterSpacing: 0.5,
  },
});
