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
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { Produtor, Mapa, Visita, CadernoCampo } from '../api/mock';
import { buildMapasRouteParams } from '../navigation/mapaRouteCompat';
import { colors, typography, spacing, shadows, border } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import {
  filtrarCadernosPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorFazendaIds,
  getFazendaId,
  getFazendaIds,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

/**
 * Tela específica para produtores/proprietários - Dashboard das propriedades
 * Produtor = Cliente = Proprietário (dono da fazenda)
 * Um proprietário pode ter VÁRIAS fazendas
 */
export default function ClienteDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [propriedades, setPropriedades] = useState([]);
  const [mapas, setMapas] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [filtroFazenda, setFiltroFazenda] = useState('geral');
  const { user } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user?.produtor_id) {
        const [todosProdutores, todosMapas, todasVisitas, todosCadernos] = await Promise.all([
          Produtor.list(),
          Mapa.list(),
          Visita.list(),
          CadernoCampo.list()
        ]);

        // Buscar TODAS as fazendas deste proprietário (relação 1:N)
        const minhasFazendas = filtrarProdutoresPorAcesso(todosProdutores, user);
        setPropriedades(minhasFazendas);
        
        const meusIds = getFazendaIds(minhasFazendas);
        
        // Filtrar apenas mapas disponíveis para download das minhas fazendas
        const mapasDisponiveis = filtrarMapasPorFazendaIds(todosMapas, meusIds, {
          somenteDisponiveisDownload: true,
        });
        setMapas(mapasDisponiveis);

        // Filtrar visitas das minhas fazendas
        const visitasProdutor = filtrarVisitasPorFazendaIds(todasVisitas, meusIds);
        setVisitas(visitasProdutor);

        // Filtrar histórico visível para proprietário
        const historicoCliente = filtrarCadernosPorFazendaIds(todosCadernos, meusIds, {
          somenteVisivelParaProdutor: true,
        });
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

  const agruparMapasPorCategoria = (listaMapas) => {
    const categorias = {
      fertilidade: { nome: 'Fertilidade', icon: 'leaf-outline', mapas: [] },
      correcao: { nome: 'Correção', icon: 'construct-outline', mapas: [] },
      indice_vegetacao: { nome: 'Índice Vegetação', icon: 'analytics-outline', mapas: [] },
      panorama: { nome: 'Panorama', icon: 'image-outline', mapas: [] },
      plantio: { nome: 'Plantio', icon: 'git-network-outline', mapas: [] },
    };

    (listaMapas || mapas).forEach(mapa => {
      if (categorias[mapa.categoria]) {
        categorias[mapa.categoria].mapas.push(mapa);
      }
    });

    return Object.values(categorias).filter(cat => cat.mapas.length > 0);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Minhas Fazendas" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando informações...</Text>
        </View>
      </View>
    );
  }

  if (!propriedades || propriedades.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Minhas Fazendas" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Nenhuma propriedade vinculada</Text>
        </View>
      </View>
    );
  }

  // Dados filtrados conforme fazenda selecionada
  const propriedadesExibidas = filtroFazenda === 'geral'
    ? propriedades
    : propriedades.filter(p => getFazendaId(p) === filtroFazenda);
  const idsFiltrados = getFazendaIds(propriedadesExibidas);
  const mapasFiltrados = filtrarMapasPorFazendaIds(mapas, idsFiltrados);
  const visitasFiltradas = filtrarVisitasPorFazendaIds(visitas, idsFiltrados);
  const historicoFiltrado = filtrarCadernosPorFazendaIds(historico, idsFiltrados);

  const areaTotal = propriedadesExibidas.reduce((sum, p) => sum + (p.area_total || 0), 0);
  const culturas = [...new Set(propriedadesExibidas.map(p => p.cultura_atual).filter(Boolean))];
  const mapasCategorizados = agruparMapasPorCategoria(mapasFiltrados);
  const mapasRouteParams = filtroFazenda === 'geral'
    ? undefined
    : buildMapasRouteParams({ fazendaId: filtroFazenda });
  const abrirMapas = () => {
    if (mapasRouteParams) {
      navigation.navigate('Mapas', mapasRouteParams);
    } else {
      navigation.navigate('Mapas');
    }
  };

  const abrirFazenda = (fazenda) => {
    const fazendaId = getFazendaId(fazenda);
    if (fazendaId) {
      navigation.navigate('ProdutorDetail', { id: fazendaId });
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Minhas Fazendas" />

      {/* Filtro por fazenda */}
      {propriedades.length > 1 && (
        <View style={styles.filtroFazendaContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroFazendaScroll}>
            <TouchableOpacity
              style={[styles.filtroFazendaChip, filtroFazenda === 'geral' && styles.filtroFazendaChipAtivo]}
              onPress={() => setFiltroFazenda('geral')}
            >
              <Ionicons name="globe-outline" size={16} color={filtroFazenda === 'geral' ? colors.white : colors.text} style={{ marginRight: 4 }} />
              <Text style={[styles.filtroFazendaChipText, filtroFazenda === 'geral' && styles.filtroFazendaChipTextAtivo]}>
                Geral ({propriedades.length} fazendas)
              </Text>
            </TouchableOpacity>
            {propriedades.map(prop => (
              <TouchableOpacity
                key={getFazendaId(prop)}
                style={[styles.filtroFazendaChip, filtroFazenda === getFazendaId(prop) && styles.filtroFazendaChipAtivo]}
                onPress={() => setFiltroFazenda(getFazendaId(prop))}
              >
                <Ionicons name="home-outline" size={16} color={filtroFazenda === getFazendaId(prop) ? colors.white : colors.text} style={{ marginRight: 4 }} />
                <Text style={[styles.filtroFazendaChipText, filtroFazenda === getFazendaId(prop) && styles.filtroFazendaChipTextAtivo]} numberOfLines={1}>
                  {prop.fazenda}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
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
        {/* Cards das Fazendas (filtradas) */}
        {propriedadesExibidas.map((prop) => {
          const fazendaInfo = getFazendaUiInfo(prop);

          return (
            <TouchableOpacity
              key={getFazendaId(prop)}
              style={styles.propriedadeCard}
              onPress={() => abrirFazenda(prop)}
              activeOpacity={0.86}
            >
              <View style={styles.propriedadeHeader}>
                <Ionicons name="home-outline" size={40} color={colors.primary} />
                <View style={styles.propriedadeInfo}>
                  <Text style={styles.propriedadeNome}>{fazendaInfo.fazendaNome}</Text>
                  <Text style={styles.propriedadeLocalização}>
                    {fazendaInfo.localizacao || 'Localização não informada'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>
                    Titular: {fazendaInfo.titularNome || 'Não informado'} • {prop.area_total} ha • {prop.cultura_atual || 'N/A'}
                  </Text>
                </View>
              </View>
              <View style={styles.propriedadeAction}>
                <Text style={styles.propriedadeActionText}>Abrir fazenda</Text>
                <Ionicons name="chevron-forward-outline" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Resumo de Informações */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="Fazendas"
              value={propriedadesExibidas.length}
              icon={<Ionicons name="business-outline" size={24} color={colors.primary} />}
              accent={{
                color: colors.primary,
                bgColor: colors.borderLight,
                gradient: [colors.borderLight, colors.white]
              }}
            />
            <StatCard
              label="Área Total"
              value={`${areaTotal} ha`}
              icon={<Ionicons name="resize-outline" size={24} color={colors.secondary} />}
              accent={{
                color: colors.secondary,
                bgColor: colors.secondaryBg,
                gradient: [colors.secondaryBg, colors.white]
              }}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Culturas"
              value={culturas.join(', ') || 'N/A'}
              icon={<Ionicons name="leaf-outline" size={24} color={colors.primary} />}
              accent={{
                color: colors.primary,
                bgColor: colors.borderLight,
                gradient: [colors.borderLight, colors.white]
              }}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Mapas Disponíveis"
              value={mapasFiltrados.length}
              icon={<Ionicons name="map-outline" size={24} color={colors.amber} />}
              accent={{
                color: colors.amber,
                bgColor: colors.amberLight,
                gradient: [colors.amberLight, colors.white]
              }}
            />
            <StatCard
              label="Visitas Registradas"
              value={visitasFiltradas.length}
              icon={<Ionicons name="calendar-outline" size={24} color={colors.success} />}
              accent={{
                color: colors.success,
                bgColor: colors.successBg,
                gradient: [colors.successBg, colors.white]
              }}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Atividades"
              value={historicoFiltrado.length}
              icon={<Ionicons name="document-text-outline" size={24} color={colors.info} />}
              accent={{
                color: colors.info,
                bgColor: colors.infoLight,
                gradient: [colors.infoLight, colors.white]
              }}
            />
          </View>
        </View>

        {/* Seção de Mapas */}
        <View style={styles.secao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>Mapas da Propriedade</Text>
            {mapas.length > 0 && (
              <TouchableOpacity 
                onPress={abrirMapas}
              >
                <Text style={styles.verTodosLink}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>

          {mapasFiltrados.length === 0 ? (
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
                  onPress={abrirMapas}
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

          {visitasFiltradas.length === 0 ? (
            <View style={styles.emptySecao}>
              <Ionicons name="calendar-outline" size={40} color={colors.muted} />
              <Text style={styles.emptySecaoText}>
                Ainda não há visitas técnicas registradas para esta fazenda.
              </Text>
            </View>
          ) : (
            visitasFiltradas.slice(0, 5).map((visita, index) => (
              <View key={index} style={styles.visitaCard}>
                <View style={styles.visitaHeader}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
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

          {historicoFiltrado.length === 0 ? (
            <View style={styles.emptySecao}>
              <Ionicons name="document-text-outline" size={40} color={colors.muted} />
              <Text style={styles.emptySecaoText}>
                Ainda não há registros de caderno de campo para esta fazenda.
              </Text>
              <Text style={styles.emptySecaoSubtext}>
                Mapas e anexos disponíveis continuam acessíveis na seção de mapas.
              </Text>
            </View>
          ) : (
            historicoFiltrado.slice(0, 5).map((atividade, index) => (
              <View key={index} style={styles.atividadeCard}>
                <View style={styles.atividadeHeader}>
                  <View style={styles.atividadeIconContainer}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
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
  filtroFazendaContainer: {
    backgroundColor: colors.background,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtroFazendaScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  filtroFazendaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filtroFazendaChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtroFazendaChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 140,
  },
  filtroFazendaChipTextAtivo: {
    color: colors.white,
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
    fontSize: typography.fontBody,
    color: colors.textLight,
    fontWeight: typography.weightMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.fontSubtitle,
    color: colors.text,
    fontWeight: typography.weightBold,
  },
  propriedadeCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
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
    fontSize: typography.fontTitle - 4,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  propriedadeLocalização: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    fontWeight: typography.weightMedium,
  },
  propriedadeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  propriedadeActionText: {
    fontSize: typography.fontBody - 1,
    color: colors.primary,
    fontWeight: typography.weightBold,
  },
  statsGrid: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  verTodosLink: {
    fontSize: typography.fontBody,
    color: colors.primary,
    fontWeight: typography.weightBold,
  },
  emptySecao: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    ...shadows.sm,
  },
  emptySecaoText: {
    marginTop: spacing.md,
    fontSize: typography.fontBody,
    color: colors.textLight,
    fontWeight: typography.weightMedium,
    textAlign: 'center',
  },
  emptySecaoSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontCaption + 1,
    color: colors.muted,
    fontWeight: typography.weightMedium,
    textAlign: 'center',
    lineHeight: 18,
  },
  mapasHorizontal: {
    flexGrow: 0,
  },
  categoriaCard: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginRight: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.md,
  },
  categoriaIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoriaNome: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoriaQtd: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },
  visitaCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.card,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  visitaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  visitaData: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  visitaTecnico: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    marginBottom: spacing.xs,
    fontWeight: typography.weightMedium,
  },
  visitaObservacao: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
  },
  atividadeCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.card,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  atividadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  atividadeIconContainer: {
    marginRight: spacing.sm,
  },
  atividadeInfo: {
    flex: 1,
  },
  atividadeTipo: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    textTransform: 'capitalize',
  },
  atividadeData: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightMedium,
  },
  atividadeObservacao: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
