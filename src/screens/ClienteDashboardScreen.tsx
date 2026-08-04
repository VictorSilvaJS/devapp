import React, { useCallback, useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { Produtor, Visita, CadernoCampo } from '../api/mock';
import { MaterialCatalogService } from '../services/MaterialCatalogService';
import { buildMapasRouteParams } from '../navigation/mapaRouteCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { colors, typography, spacing, shadows, border } from '../theme';
import { useAuthState } from '../auth/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  filtrarCadernosPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarProdutoresPorAcesso,
  filtrarVisitasPorFazendaIds,
  getFazendaId,
  getFazendaIds,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { formatAreaHa, resolveAreaTotalInformada } from '../utils/talhaoMedidasCompat';
import {
  buildDashboardScopeData,
  buildDashboardSummary,
  getPropriedadeStatusLabel,
  sortDashboardItemsByDate,
} from '../utils/dashboardCompat';
import { getCadernoTipoLabel } from '../utils/cadernoFormCompat';
import {
  getDashboardColumnWidth,
  getDashboardResponsiveLayout,
} from '../utils/dashboardResponsive';

/**
 * Tela específica para produtores - Dashboard das propriedades vinculadas.
 */
export default function ClienteDashboardScreen() {
  const { width, height } = useWindowDimensions();
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [mapas, setMapas] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [filtroFazenda, setFiltroFazenda] = useState('geral');
  const { user } = useAuthState();
  const navigation = useNavigation<any>();
  const responsiveLayout = useMemo(
    () => getDashboardResponsiveLayout(width, height),
    [height, width]
  );
  const statCardWidth = getDashboardColumnWidth(responsiveLayout.produtorColumns);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      if (user?.produtor_id) {
        const [todosProdutores, todasVisitas, todosCadernos] = await Promise.all([
          Produtor.list(),
          Visita.list(),
          CadernoCampo.list()
        ]);
        const propriedadeIds = getFazendaIds(filtrarProdutoresPorAcesso(todosProdutores, user));
        const catalogoMateriais = await MaterialCatalogService.consultarMateriais({
          propriedadeIds,
          perfil: user?.perfil,
        });

        const escopo = buildDashboardScopeData({
          user,
          propriedades: todosProdutores,
          mapas: catalogoMateriais.materiais,
          visitas: todasVisitas,
          cadernos: todosCadernos,
        });
        setPropriedades(escopo.propriedades);
        setMapas(escopo.mapas);
        setVisitas(escopo.visitas);
        setHistorico(escopo.cadernos);
      } else {
        setPropriedades([]);
        setMapas([]);
        setVisitas([]);
        setHistorico([]);
      }
      loadedRef.current = true;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData(!loadedRef.current);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  const formatarData = (data) => {
    if (!data) return 'N/A';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  };

  const agruparMapasPorCategoria = useCallback((listaMapas) => {
    const categorias = {
      fertilidade: { nome: 'Fertilidade', icon: 'leaf-outline', mapas: [] },
      correcao: { nome: 'Correção', icon: 'construct-outline', mapas: [] },
      indice_vegetacao: { nome: 'Índice Vegetação', icon: 'analytics-outline', mapas: [] },
      panorama: { nome: 'Panorama', icon: 'image-outline', mapas: [] },
      plantio: { nome: 'Plantio', icon: 'git-network-outline', mapas: [] },
    };

    listaMapas.forEach(mapa => {
      if (categorias[mapa.categoria]) {
        categorias[mapa.categoria].mapas.push(mapa);
      }
    });

    return Object.values(categorias).filter(cat => cat.mapas.length > 0);
  }, []);

  const propriedadesExibidas = useMemo(
    () =>
      filtroFazenda === 'geral'
        ? propriedades
        : propriedades.filter((propriedade) => getFazendaId(propriedade) === filtroFazenda),
    [filtroFazenda, propriedades]
  );
  const idsFiltrados = useMemo(() => getFazendaIds(propriedadesExibidas), [propriedadesExibidas]);
  const mapasFiltrados = useMemo(
    () => filtrarMapasPorFazendaIds(mapas, idsFiltrados),
    [idsFiltrados, mapas]
  );
  const visitasFiltradas = useMemo(
    () => filtrarVisitasPorFazendaIds(visitas, idsFiltrados),
    [idsFiltrados, visitas]
  );
  const historicoFiltrado = useMemo(
    () => filtrarCadernosPorFazendaIds(historico, idsFiltrados),
    [historico, idsFiltrados]
  );
  const resumo = useMemo(
    () =>
      buildDashboardSummary({
        propriedades: propriedadesExibidas,
        visitas: visitasFiltradas,
        cadernos: historicoFiltrado,
        mapas: mapasFiltrados,
      }),
    [historicoFiltrado, mapasFiltrados, propriedadesExibidas, visitasFiltradas]
  );
  const cardsResumo = useMemo(() => [
    {
      label: 'Propriedades',
      value: propriedadesExibidas.length,
      icon: 'business-outline',
      accent: {
        color: colors.primary,
        bgColor: colors.borderLight,
        gradient: [colors.borderLight, colors.white],
      },
    },
    {
      label: 'Área total informada',
      value: resumo.areaTotalLabel,
      icon: 'resize-outline',
      accent: {
        color: colors.secondary,
        bgColor: colors.secondaryBg,
        gradient: [colors.secondaryBg, colors.white],
      },
    },
    {
      label: 'Propriedades Ativas',
      value: resumo.status.ativo,
      icon: 'leaf-outline',
      accent: {
        color: colors.primary,
        bgColor: colors.borderLight,
        gradient: [colors.borderLight, colors.white],
      },
    },
    {
      label: 'Materiais disponíveis',
      value: mapasFiltrados.length,
      icon: 'map-outline',
      accent: {
        color: colors.amber,
        bgColor: colors.amberLight,
        gradient: [colors.amberLight, colors.white],
      },
    },
    {
      label: 'Visitas Registradas',
      value: visitasFiltradas.length,
      icon: 'calendar-outline',
      accent: {
        color: colors.success,
        bgColor: colors.successBg,
        gradient: [colors.successBg, colors.white],
      },
    },
    {
      label: 'Registros no Caderno',
      value: historicoFiltrado.length,
      icon: 'document-text-outline',
      accent: {
        color: colors.info,
        bgColor: colors.infoLight,
        gradient: [colors.infoLight, colors.white],
      },
    },
  ], [historicoFiltrado.length, mapasFiltrados.length, propriedadesExibidas.length, resumo, visitasFiltradas.length]);
  const mapasCategorizados = useMemo(
    () => agruparMapasPorCategoria(mapasFiltrados),
    [agruparMapasPorCategoria, mapasFiltrados]
  );
  const visitasRecentes = useMemo(
    () => sortDashboardItemsByDate(visitasFiltradas, ['data_visita']).slice(0, 5),
    [visitasFiltradas]
  );
  const historicoRecente = useMemo(
    () => sortDashboardItemsByDate(historicoFiltrado, ['data_atividade']).slice(0, 5),
    [historicoFiltrado]
  );
  const mapasRouteParams = useMemo(
    () => filtroFazenda === 'geral' ? undefined : buildMapasRouteParams({ fazendaId: filtroFazenda }),
    [filtroFazenda]
  );
  const abrirMapas = useCallback(() => {
    navigation.navigate('Mapas', mapasRouteParams);
  }, [mapasRouteParams, navigation]);
  const abrirFazenda = useCallback((fazenda) => {
    const params = buildPropriedadeDetailRouteParams(fazenda);
    if (params) {
      navigation.navigate('ProdutorDetail', params);
    }
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Minhas Propriedades" />
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
        <Header title="Minhas Propriedades" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Nenhuma propriedade vinculada</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Minhas Propriedades" />

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
                Geral ({propriedades.length} propriedades)
              </Text>
            </TouchableOpacity>
            {propriedades.map(prop => {
              const fazendaInfo = getFazendaUiInfo(prop);
              const fazendaId = getFazendaId(prop);
              const chipAtivo = filtroFazenda === fazendaId;

              return (
                <TouchableOpacity
                  key={fazendaId}
                  style={[styles.filtroFazendaChip, chipAtivo && styles.filtroFazendaChipAtivo]}
                  onPress={() => setFiltroFazenda(fazendaId)}
                >
                  <Ionicons name="home-outline" size={16} color={chipAtivo ? colors.white : colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.filtroFazendaChipText, chipAtivo && styles.filtroFazendaChipTextAtivo]} numberOfLines={1}>
                    {fazendaInfo.fazendaNome || 'Propriedade sem nome'}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
        <View
          style={[
            styles.overviewLayout,
            responsiveLayout.splitProdutorOverview && styles.overviewLayoutLandscape,
          ]}
        >
          {/* Cards das Propriedades filtradas */}
          <View
            style={[
              styles.propriedadesOverview,
              responsiveLayout.splitProdutorOverview && styles.propriedadesOverviewLandscape,
            ]}
          >
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
                      <Text style={styles.propriedadeMeta}>
                        Titular: {fazendaInfo.titularNome || 'Não informado'} • Área total informada: {formatAreaHa(resolveAreaTotalInformada(prop))} • {prop.cultura_atual || 'N/A'}
                      </Text>
                      <Text style={styles.propriedadeStatus}>Status: {getPropriedadeStatusLabel(prop)}</Text>
                    </View>
                  </View>
                  <View style={styles.propriedadeAction}>
                    <Text style={styles.propriedadeActionText}>Abrir propriedade</Text>
                    <Ionicons name="chevron-forward-outline" size={18} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Resumo de Informações */}
          <View
            style={[
              styles.statsGrid,
              responsiveLayout.splitProdutorOverview && styles.statsGridLandscape,
            ]}
          >
            {cardsResumo.map((card) => (
              <View
                key={card.label}
                style={[styles.statCardWrapper, { width: statCardWidth }]}
              >
                <StatCard
                  label={card.label}
                  value={card.value}
                  icon={<Ionicons name={card.icon as any} size={24} color={card.accent.color} />}
                  accent={card.accent}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Seção de Mapas */}
        <View style={styles.secao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>Mapas disponíveis</Text>
            {mapasFiltrados.length > 0 && (
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
              <Text style={styles.emptySecaoText}>Nenhum mapa ou material disponível</Text>
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
                Nenhuma visita registrada
              </Text>
            </View>
          ) : (
            visitasRecentes.map((visita) => (
              <View key={visita.id} style={styles.visitaCard}>
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
                Nenhum registro de caderno liberado
              </Text>
              <Text style={styles.emptySecaoSubtext}>
                Mapas e anexos disponíveis continuam acessíveis na seção de mapas.
              </Text>
            </View>
          ) : (
            historicoRecente.map((atividade) => (
              <View key={atividade.id} style={styles.atividadeCard}>
                <View style={styles.atividadeHeader}>
                  <View style={styles.atividadeIconContainer}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  </View>
                  <View style={styles.atividadeInfo}>
                    <Text style={styles.atividadeTipo}>{getCadernoTipoLabel(atividade.tipo_atividade)}</Text>
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
  propriedadeMeta: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 2,
  },
  propriedadeStatus: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    textTransform: 'capitalize',
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
  overviewLayout: {
    marginBottom: spacing.sm,
  },
  overviewLayoutLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  propriedadesOverview: {
    minWidth: 0,
  },
  propriedadesOverviewLandscape: {
    width: '38%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: spacing.lg,
  },
  statsGridLandscape: {
    flex: 1,
    minWidth: 0,
  },
  statCardWrapper: {
    marginBottom: spacing.md,
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
