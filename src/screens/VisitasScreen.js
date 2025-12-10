import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  LayoutAnimation, 
  Platform, 
  UIManager, 
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Visita, Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function VisitasScreen() {
  const [visitas, setVisitas] = useState([]);
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const { user } = useAuth();

  useEffect(() => { load(); }, []);
  
  const load = async () => {
    setLoading(true);
    try {
      // Simula lógica de permissões por perfil
      let visitasData = [];
      let produtoresData = [];

      if (user?.perfil === 'admin') {
        // Admin vê tudo
        [visitasData, produtoresData] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
      } else if (user?.perfil === 'colaborador') {
        // Colaborador vê apenas suas visitas e produtores da sua região
        const [todasVisitas, todosProdutores] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
        visitasData = todasVisitas.filter(v => v.tecnico_responsavel === user.full_name);
        produtoresData = todosProdutores.filter(p => p.regiao === user.regiao);
      } else if (user?.perfil === 'cliente') {
        // Cliente vê apenas visitas do seu produtor
        const [todasVisitas, todosProdutores] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
        visitasData = todasVisitas.filter(v => v.produtor_id === user.produtor_id);
        produtoresData = todosProdutores.filter(p => p.id === user.produtor_id);
      } else {
        // Sem usuário, carrega tudo (fallback)
        [visitasData, produtoresData] = await Promise.all([
          Visita.list(),
          Produtor.list()
        ]);
      }

      try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
      setVisitas(visitasData);
      setProdutores(produtoresData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const getProd = (id) => produtores.find(x => x.id === id) || {};

  // Filtro de busca
  const visitasFiltradas = visitas.filter(visita => {
    if (!busca) return true;
    const produtor = getProd(visita.produtor_id);
    const buscaLower = busca.toLowerCase();
    return (
      produtor.nome?.toLowerCase().includes(buscaLower) ||
      visita.objetivo?.toLowerCase().includes(buscaLower) ||
      visita.tecnico_responsavel?.toLowerCase().includes(buscaLower) ||
      visita.status?.toLowerCase().includes(buscaLower)
    );
  });

  // Cores para objetivos
  const getObjetivoColor = (objetivo) => {
    const cores = {
      consultoria: colors.primary,
      coleta_solo: '#3B82F6',
      avaliacao_cultivo: '#10B981',
      entrega_material: '#F59E0B',
      outro: colors.muted
    };
    return cores[objetivo] || colors.muted;
  };

  // Cores para status
  const getStatusColor = (status) => {
    const cores = {
      agendada: '#3B82F6',
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

  return (
    <View style={styles.container}>
      <Header title="Visitas Técnicas" />
      
      {/* Barra de busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por produtor, objetivo ou técnico..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
              <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
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
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando visitas...</Text>
          </View>
        ) : visitasFiltradas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={busca ? 'search-outline' : 'calendar-outline'} 
              size={64} 
              color={colors.muted} 
              style={styles.emptyIcon} 
            />
            <Text style={styles.emptyText}>
              {busca ? 'Nenhuma visita encontrada' : 'Nenhuma visita agendada'}
            </Text>
            <Text style={styles.emptySubtext}>
              {busca 
                ? 'Tente ajustar os filtros de busca' 
                : 'As visitas técnicas aparecerão aqui'}
            </Text>
          </View>
        ) : (
          visitasFiltradas.map(visita => {
            const produtor = getProd(visita.produtor_id);
            const objetivoColor = getObjetivoColor(visita.objetivo);
            const statusColor = getStatusColor(visita.status);
            const objetivoIcon = getObjetivoIcon(visita.objetivo);
            
            return (
              <View key={visita.id} style={styles.card}>
                {/* Cabeçalho do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIcon, { backgroundColor: objetivoColor + '20' }]}>
                      <Ionicons name={objetivoIcon} size={24} color={objetivoColor} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {produtor.nome || 'Produtor não encontrado'}
                      </Text>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {produtor.fazenda}
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
              </View>
            );
          })
        )}
      </ScrollView>
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
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: typography.fontBody,
    color: colors.text,
    paddingVertical: 8
  },
  clearButton: {
    paddingHorizontal: 8
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.screen * 2
  },
  emptyIcon: {
    marginBottom: spacing.gap
  },
  emptyText: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22
  }
});
