import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import InfoBox from '../components/InfoBox';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../components/FilterBottomSheet';
import OperationalCard from '../components/OperationalCard';
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
import { getVisitaObjetivoLabel } from '../utils/visitaFormCompat';
import { resolveOperationalSummary } from '../utils/operationalCardCompat';
import {
  getVisitaStatusPresentation,
  groupVisitasForList,
  VisitaStatusTone,
} from '../utils/visitaListCompat';

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
  const [filtrosRascunho, setFiltrosRascunho] = useState({
    status: 'todos',
    data: 'todos',
    ordenacao: 'data',
  });
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros, filtrarProdutores: filtrarFazendas } = useFiltros();
  const isProdutorView = user?.perfil === 'produtor';
  const referenceDate = new Date();

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
      getVisitaObjetivoLabel(visita.objetivo),
      visita.tecnico_responsavel,
      getVisitaStatusPresentation(visita, referenceDate).label,
    ]);
    
    const matchStatus = filtroStatus === 'todos' || visita.status === filtroStatus;
    const matchData = filtrarPorData(visita);
    
    return matchBusca && matchStatus && matchData;
  });

  const visitasAgrupadas = groupVisitasForList(visitasFiltradas, referenceDate).map((section) => {
    if (ordenacao === 'data') return section;

    const items = [...section.items].sort((a, b) => {
      if (ordenacao === 'fazenda' || ordenacao === 'produtor') {
        const fazendaA = getFazendaUiInfo(getFazenda(getVisitaFazendaId(a)));
        const fazendaB = getFazendaUiInfo(getFazenda(getVisitaFazendaId(b)));
        const byProperty = (fazendaA.fazendaNome || '').localeCompare(fazendaB.fazendaNome || '');
        if (byProperty !== 0) return byProperty;
      }

      if (ordenacao === 'status') {
        const statusOrder = { agendada: 0, realizada: 1, cancelada: 2, anulada: 3 };
        const byStatus = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
        if (byStatus !== 0) return byStatus;
      }

      return new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime();
    });

    return { ...section, items };
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
  const getStatusColor = (tone: VisitaStatusTone) => {
    const cores = {
      info: colors.info,
      warning: colors.warning,
      success: colors.success,
      danger: colors.danger,
      muted: colors.muted,
    };
    return cores[tone] || colors.muted;
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
      const statusLabels = { agendada: 'Agendadas', realizada: 'Realizadas', cancelada: 'Canceladas', anulada: 'Anuladas' };
      filtros.push({ tipo: 'status', label: statusLabels[filtroStatus], icon: 'checkmark-circle', color: colors.success, remover: () => setFiltroStatus('todos') });
    }
    if (filtroData !== 'todos') {
      const dataLabels = { hoje: 'Hoje', semana: 'Esta Semana', mes: 'Este Mês' };
      filtros.push({ tipo: 'data', label: dataLabels[filtroData], icon: 'calendar', color: colors.coral, remover: () => setFiltroData('todos') });
    }
    if (ordenacao !== 'data') {
      const ordenacaoLabels = { fazenda: 'Por Propriedade', produtor: 'Por Propriedade', status: 'Por Status' };
      filtros.push({ tipo: 'ordenacao', label: ordenacaoLabels[ordenacao], icon: 'swap-vertical', color: colors.teal, remover: () => setOrdenacao('data') });
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
    { value: 'anulada', label: 'Anuladas' },
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

  const getFiltrosAplicados = () => ({
    status: filtroStatus,
    data: filtroData,
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
      data: 'todos',
      ordenacao: 'data',
    });
  };

  const aplicarFiltros = () => {
    setFiltroStatus(filtrosRascunho.status);
    setFiltroData(filtrosRascunho.data);
    setOrdenacao(filtrosRascunho.ordenacao);
    setModalFiltrosVisivel(false);
  };

  return (
    <View style={styles.container}>
      <Header title={isProdutorView ? 'Histórico de visitas' : 'Visitas Técnicas'} />
      
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
            setFiltroData('todos');
            setOrdenacao('data');
          }}
        />

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
                  : isProdutorView
                    ? 'Nenhuma visita registrada para consulta nas suas Propriedades.'
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
                    : 'O histórico será atualizado quando houver visitas liberadas para consulta'
                }
                style={styles.emptyTipInfo}
              />
            )}
          </View>
        ) : (
          visitasAgrupadas.map((section) => (
            <View key={section.id} style={styles.visitSection}>
              <View style={styles.visitSectionHeader}>
                <View style={styles.visitSectionHeading}>
                  <Text style={styles.visitSectionTitle}>{section.title}</Text>
                  <Text style={styles.visitSectionDescription}>{section.description}</Text>
                </View>
                <View style={styles.visitSectionCount}>
                  <Text style={styles.visitSectionCountText}>{section.items.length}</Text>
                </View>
              </View>

              {section.items.map((visita) => {
                const fazenda = getFazenda(getVisitaFazendaId(visita));
                const fazendaInfo = getFazendaUiInfo(fazenda);
                const objetivoColor = getObjetivoColor(visita.objetivo);
                const statusPresentation = getVisitaStatusPresentation(visita, referenceDate);
                const statusColor = getStatusColor(statusPresentation.tone);
                const objetivoIcon = getObjetivoIcon(visita.objetivo);
                const objetivoLabel = getVisitaObjetivoLabel(visita.objetivo);
                const summary = resolveOperationalSummary([
                  visita.observacoes,
                  visita.recomendacoes,
                ]);

                return (
                  <OperationalCard
                    key={visita.id}
                    title={fazendaInfo.fazendaNome || 'Propriedade não encontrada'}
                    subtitle={fazendaInfo.titularNome || fazendaInfo.localizacao}
                    icon={objetivoIcon}
                    accentColor={objetivoColor}
                    date={visita.data_visita}
                    tags={[
                      { label: objetivoLabel, color: objetivoColor },
                      { label: statusPresentation.label, color: statusColor },
                    ]}
                    metadata={[
                      { icon: 'person-outline', label: `Responsável: ${visita.tecnico_responsavel || 'Não informado'}` },
                    ]}
                    summary={summary}
                    accessibilityLabel={`Abrir Visita, ${objetivoLabel}, em ${fazendaInfo.fazendaNome || 'Propriedade não encontrada'}, status ${statusPresentation.label}`}
                    onPress={() => navigation.navigate('VisitaDetail', { visitaId: visita.id })}
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {podeCriarVisita(user) && (
        <CreateActionButton
          label="Nova Visita"
          icon="add-outline"
          onPress={() => navigation.navigate('NovaVisita')}
          accessibilityLabel="Cadastrar nova visita"
        />
      )}

      <FilterBottomSheet
        visible={modalFiltrosVisivel}
        onRequestClose={cancelarFiltros}
        onClear={limparFiltrosRascunho}
        onApply={aplicarFiltros}
        subtitle="Filtre por status, período e ordenação"
      >
        <FilterSection title="Status">
          <SegmentedChips
            options={statusOptions}
            value={filtrosRascunho.status}
            onChange={(status) => setFiltrosRascunho((atual) => ({ ...atual, status }))}
            contentStyle={styles.chipsContainer}
          />
        </FilterSection>
        <FilterSection title="Período">
          <SegmentedChips
            options={periodoOptions}
            value={filtrosRascunho.data}
            onChange={(data) => setFiltrosRascunho((atual) => ({ ...atual, data }))}
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
      </FilterBottomSheet>
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
  emptyStateWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.screen * 2,
    minHeight: 400,
  },
  visitSection: {
    marginBottom: spacing.lg,
  },
  visitSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  visitSectionHeading: {
    flex: 1,
  },
  visitSectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
  },
  visitSectionDescription: {
    color: colors.textLight,
    fontSize: typography.fontCaption,
    marginTop: 2,
  },
  visitSectionCount: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  visitSectionCountText: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  emptyState: {
    padding: 0,
  },
  emptyTipInfo: {
    marginTop: spacing.lg,
    marginBottom: 0,
    maxWidth: 340,
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
