import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Produtor, Mapa, Visita, CadernoCampo } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';

/**
 * Tela específica para clientes - Dashboard da propriedade do cliente
 */
export default function ClienteDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [propriedade, setPropriedade] = useState(null);
  const [mapas, setMapas] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const { user } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user?.produtor_id) {
        const [prop, todosMapas, todasVisitas, todosCadernos] = await Promise.all([
          Produtor.get(user.produtor_id),
          Mapa.list(),
          Visita.list(),
          CadernoCampo.list()
        ]);

        setPropriedade(prop);
        
        // Filtrar apenas mapas disponíveis para download
        const mapasDisponiveis = todosMapas.filter(m => 
          m.produtor_id === user.produtor_id && m.disponivel_download
        );
        setMapas(mapasDisponiveis);

        // Filtrar visitas do produtor
        const visitasProdutor = todasVisitas.filter(v => v.produtor_id === user.produtor_id);
        setVisitas(visitasProdutor);

        // Filtrar histórico visível para cliente
        const historicoCliente = todosCadernos.filter(c => 
          c.produtor_id === user.produtor_id && c.visivel_para_cliente
        );
        setHistorico(historicoCliente);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  };

  const agruparMapasPorCategoria = () => {
    const categorias = {
      fertilidade: { nome: 'Fertilidade', icon: 'leaf-outline', mapas: [] },
      correcao: { nome: 'Correção', icon: 'construct-outline', mapas: [] },
      indice_vegetacao: { nome: 'Índice Vegetação', icon: 'analytics-outline', mapas: [] },
      panorama: { nome: 'Panorama', icon: 'image-outline', mapas: [] },
      plantio: { nome: 'Plantio', icon: 'git-network-outline', mapas: [] },
    };

    mapas.forEach(mapa => {
      if (categorias[mapa.categoria]) {
        categorias[mapa.categoria].mapas.push(mapa);
      }
    });

    return Object.values(categorias).filter(cat => cat.mapas.length > 0);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Minha Propriedade" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando informações...</Text>
        </View>
      </View>
    );
  }

  if (!propriedade) {
    return (
      <View style={styles.container}>
        <Header title="Minha Propriedade" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Propriedade não encontrada</Text>
        </View>
      </View>
    );
  }

  const mapasCategorizados = agruparMapasPorCategoria();

  return (
    <View style={styles.container}>
      <Header title="Minha Propriedade" />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Card da Propriedade */}
        <View style={styles.propriedadeCard}>
          <View style={styles.propriedadeHeader}>
            <Ionicons name="home" size={40} color={colors.primary} />
            <View style={styles.propriedadeInfo}>
              <Text style={styles.propriedadeNome}>{propriedade.fazenda}</Text>
              <Text style={styles.propriedadeLocalização}>
                {propriedade.cidade}, {propriedade.estado}
              </Text>
            </View>
          </View>

          <View style={styles.propriedadeStats}>
            <View style={styles.statItem}>
              <Ionicons name="resize-outline" size={24} color={colors.success} />
              <Text style={styles.statValue}>{propriedade.area_total} ha</Text>
              <Text style={styles.statLabel}>Área Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="leaf-outline" size={24} color={colors.primary} />
              <Text style={styles.statValue}>{propriedade.cultura_atual || 'N/A'}</Text>
              <Text style={styles.statLabel}>Cultura</Text>
            </View>
          </View>
        </View>

        {/* Resumo de Informações */}
        <View style={styles.resumoContainer}>
          <View style={styles.resumoCard}>
            <View style={styles.resumoIconContainer}>
              <Ionicons name="map-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.resumoInfo}>
              <Text style={styles.resumoValor}>{mapas.length}</Text>
              <Text style={styles.resumoLabel}>Mapas Disponíveis</Text>
            </View>
          </View>

          <View style={styles.resumoCard}>
            <View style={styles.resumoIconContainer}>
              <Ionicons name="calendar-outline" size={28} color={colors.success} />
            </View>
            <View style={styles.resumoInfo}>
              <Text style={styles.resumoValor}>{visitas.length}</Text>
              <Text style={styles.resumoLabel}>Visitas Registradas</Text>
            </View>
          </View>

          <View style={styles.resumoCard}>
            <View style={styles.resumoIconContainer}>
              <Ionicons name="document-text-outline" size={28} color={colors.warning} />
            </View>
            <View style={styles.resumoInfo}>
              <Text style={styles.resumoValor}>{historico.length}</Text>
              <Text style={styles.resumoLabel}>Atividades</Text>
            </View>
          </View>
        </View>

        {/* Seção de Mapas */}
        <View style={styles.secao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>Mapas da Propriedade</Text>
            {mapas.length > 0 && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('Mapas', { produtorId: propriedade.id })}
              >
                <Text style={styles.verTodosLink}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>

          {mapas.length === 0 ? (
            <View style={styles.emptySecao}>
              <Ionicons name="map-outline" size={40} color={colors.muted} />
              <Text style={styles.emptySecaoText}>Nenhum mapa disponível</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.mapasHorizontal}
            >
              {mapasCategorizados.map((cat, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoriaCard}
                  onPress={() => navigation.navigate('Mapas', { produtorId: propriedade.id })}
                >
                  <View style={styles.categoriaIconContainer}>
                    <Ionicons name={cat.icon} size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.categoriaNome}>{cat.nome}</Text>
                  <Text style={styles.categoriaQtd}>{cat.mapas.length} {cat.mapas.length === 1 ? 'mapa' : 'mapas'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Últimas Visitas */}
        <View style={styles.secao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>Últimas Visitas</Text>
          </View>

          {visitas.length === 0 ? (
            <View style={styles.emptySecao}>
              <Ionicons name="calendar-outline" size={40} color={colors.muted} />
              <Text style={styles.emptySecaoText}>Nenhuma visita registrada</Text>
            </View>
          ) : (
            visitas.slice(0, 3).map((visita, index) => (
              <View key={index} style={styles.visitaCard}>
                <View style={styles.visitaHeader}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={styles.visitaData}>{formatarData(visita.data_visita)}</Text>
                </View>
                <Text style={styles.visitaTecnico}>Técnico: {visita.tecnico_responsavel}</Text>
                {visita.observacoes && (
                  <Text style={styles.visitaObservacao} numberOfLines={2}>
                    {visita.observacoes}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Histórico de Atividades */}
        <View style={styles.secao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>Atividades Recentes</Text>
          </View>

          {historico.length === 0 ? (
            <View style={styles.emptySecao}>
              <Ionicons name="document-text-outline" size={40} color={colors.muted} />
              <Text style={styles.emptySecaoText}>Nenhuma atividade registrada</Text>
            </View>
          ) : (
            historico.slice(0, 3).map((atividade, index) => (
              <View key={index} style={styles.atividadeCard}>
                <View style={styles.atividadeHeader}>
                  <View style={styles.atividadeIconContainer}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  </View>
                  <View style={styles.atividadeInfo}>
                    <Text style={styles.atividadeTipo}>{atividade.tipo_atividade}</Text>
                    <Text style={styles.atividadeData}>{formatarData(atividade.data_atividade)}</Text>
                  </View>
                </View>
                {atividade.observacoes && (
                  <Text style={styles.atividadeObservacao} numberOfLines={2}>
                    {atividade.observacoes}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.muted,
    fontWeight: '600',
  },
  propriedadeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  propriedadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  propriedadeInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  propriedadeNome: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  propriedadeLocalização: {
    fontSize: typography.sizes.md,
    color: colors.muted,
  },
  propriedadeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    marginTop: 4,
  },
  resumoContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  resumoCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  resumoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  resumoInfo: {
    flex: 1,
  },
  resumoValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  resumoLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  secao: {
    marginBottom: spacing.xl,
  },
  secaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secaoTitulo: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  verTodosLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  emptySecao: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptySecaoText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  mapasHorizontal: {
    flexGrow: 0,
  },
  categoriaCard: {
    width: 120,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginRight: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  categoriaIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoriaNome: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoriaQtd: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  visitaCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  visitaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  visitaData: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  visitaTecnico: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  visitaObservacao: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  atividadeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  atividadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  atividadeIconContainer: {
    marginRight: spacing.sm,
  },
  atividadeInfo: {
    flex: 1,
  },
  atividadeTipo: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  atividadeData: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
  },
  atividadeObservacao: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
