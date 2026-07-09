import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import FiltroRegional from '../components/FiltroRegional';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { CadernoCampo, Mapa, Produtor, User, Visita } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import { colors, spacing, typography } from '../theme';
import { filtrarProdutoresPorAcesso, getSubRegioes } from '../utils/acessoControle';
import {
  buildDashboardScopeData,
  buildDashboardSummary,
} from '../utils/dashboardCompat';

const emptyData = {
  propriedades: [] as any[],
  usuarios: [] as any[],
  visitas: [] as any[],
  cadernos: [] as any[],
  mapas: [] as any[],
};

const metricAccent = {
  primary: {
    color: colors.primary,
    bgColor: colors.borderLight,
    gradient: [colors.borderLight, colors.white],
  },
  secondary: {
    color: colors.secondary,
    bgColor: colors.secondaryBg,
    gradient: [colors.secondaryBg, colors.white],
  },
  success: {
    color: colors.success,
    bgColor: colors.successBg,
    gradient: [colors.successBg, colors.white],
  },
  warning: {
    color: colors.warning,
    bgColor: colors.amberLight,
    gradient: [colors.amberLight, colors.white],
  },
  info: {
    color: colors.info,
    bgColor: colors.infoLight,
    gradient: [colors.infoLight, colors.white],
  },
  purple: {
    color: colors.purple,
    bgColor: colors.purpleLight,
    gradient: [colors.purpleLight, colors.white],
  },
};

export default function DashboardScreen() {
  const { user } = useAuthState();
  const {
    filtros,
    filtrarProdutores,
    getFiltroAtivo,
    setRegiao,
  } = useFiltros();
  const loadedRef = useRef(false);
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setLoadError('');

    try {
      const [propriedades, usuarios, visitas, cadernos, mapas] = await Promise.all([
        Produtor.list(),
        user?.perfil === 'admin' ? User.list() : Promise.resolve([]),
        Visita.list(),
        CadernoCampo.list(),
        Mapa.list(),
      ]);

      setData({ propriedades, usuarios, visitas, cadernos, mapas });
      loadedRef.current = true;
    } catch (error) {
      console.error('Erro ao carregar dados do Dashboard:', error);
      setLoadError('Não foi possível atualizar os dados locais do dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.perfil]);

  useFocusEffect(
    useCallback(() => {
      loadData(!loadedRef.current);
    }, [loadData])
  );

  useEffect(() => {
    if (user?.perfil === 'colaborador' && user?.regiao) {
      setRegiao(user.regiao);
    }
  }, [user?.perfil, user?.regiao]);

  const propriedadesFiltradas = useMemo(() => {
    const propriedadesComAcesso = filtrarProdutoresPorAcesso(data.propriedades, user);
    return filtrarProdutores(propriedadesComAcesso);
  }, [data.propriedades, filtros, user]);

  const scopeData = useMemo(
    () =>
      buildDashboardScopeData({
        user,
        propriedades: propriedadesFiltradas,
        visitas: data.visitas,
        cadernos: data.cadernos,
        mapas: data.mapas,
      }),
    [data.cadernos, data.mapas, data.visitas, propriedadesFiltradas, user]
  );

  const summary = useMemo(
    () =>
      buildDashboardSummary({
        propriedades: scopeData.propriedades,
        usuarios: data.usuarios,
        visitas: scopeData.visitas,
        cadernos: scopeData.cadernos,
        mapas: scopeData.mapas,
      }),
    [data.usuarios, scopeData]
  );

  const microregioes = useMemo(() => getSubRegioes(user), [user]);

  const cards = useMemo(() => {
    if (user?.perfil === 'admin') {
      return [
        { label: 'Propriedades', value: summary.propriedades, icon: 'business-outline', accent: metricAccent.primary },
        { label: 'Produtores', value: summary.produtores, icon: 'leaf-outline', accent: metricAccent.secondary },
        { label: 'Colaboradores', value: summary.colaboradores, icon: 'people-outline', accent: metricAccent.purple },
        { label: 'Visitas registradas', value: summary.visitas, icon: 'calendar-outline', accent: metricAccent.success },
        { label: 'Registros no caderno', value: summary.cadernos, icon: 'book-outline', accent: metricAccent.warning },
        { label: 'Mapas e materiais', value: summary.mapas, icon: 'map-outline', accent: metricAccent.info },
      ];
    }

    return [
      { label: 'Propriedades atribuídas', value: summary.propriedades, icon: 'business-outline', accent: metricAccent.primary },
      { label: 'Produtores vinculados', value: summary.titularesNoEscopo, icon: 'leaf-outline', accent: metricAccent.secondary },
      { label: 'Visitas no escopo', value: summary.visitas, icon: 'calendar-outline', accent: metricAccent.success },
      { label: 'Registros no caderno', value: summary.cadernos, icon: 'book-outline', accent: metricAccent.warning },
      { label: 'Mapas no escopo', value: summary.mapas, icon: 'map-outline', accent: metricAccent.info },
      { label: 'Área no escopo', value: summary.areaTotalLabel, icon: 'resize-outline', accent: metricAccent.purple },
    ];
  }, [summary, user?.perfil]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  const primeiroNomeUsuario =
    user?.nome?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Usuário';
  const isAdmin = user?.perfil === 'admin';
  const escopoLabel = isAdmin
    ? getFiltroAtivo()
    : user?.regiao
      ? `${user.regiao} • ${microregioes.length} ${microregioes.length === 1 ? 'microrregião' : 'microrregiões'}`
      : 'Região não definida';

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Dashboard" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando dados locais...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Dashboard" />
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
        <View style={styles.headerSection}>
          <Text style={styles.welcomeText} numberOfLines={1}>Olá, {primeiroNomeUsuario}!</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? 'Visão geral dos dados locais demonstrativos' : 'Visão dos dados locais dentro do seu escopo'}
          </Text>

          {isAdmin ? (
            <View style={styles.filtrosContainer}>
              <FiltroRegional />
            </View>
          ) : (
            <View style={styles.filtrosContainer}>
              <FiltroRegional fixedRegiao={user?.regiao} microregiaoOptions={microregioes} />
            </View>
          )}

          <View style={styles.scopeCard}>
            <Ionicons name={isAdmin ? 'globe-outline' : 'location-outline'} size={22} color={colors.primary} />
            <View style={styles.scopeText}>
              <Text style={styles.scopeLabel}>{isAdmin ? 'Abrangência atual' : 'Região e microrregiões'}</Text>
              <Text style={styles.scopeValue}>{escopoLabel}</Text>
            </View>
          </View>

          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        </View>

        <View style={styles.statsGrid}>
          {cards.map((card) => (
            <View key={card.label} style={styles.statCardWrapper}>
              <StatCard
                label={card.label}
                value={card.value}
                icon={<Ionicons name={card.icon as any} size={24} color={card.accent.color} />}
                accent={card.accent}
              />
            </View>
          ))}
        </View>

        <SectionCard
          title="Status das Propriedades"
          subtitle={summary.propriedades > 0 ? 'Situação dos cadastros no escopo atual.' : 'Nenhuma Propriedade vinculada ao escopo atual.'}
          icon="checkmark-circle-outline"
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusItem, styles.statusActive]}>
              <Text style={styles.statusValue}>{summary.status.ativo}</Text>
              <Text style={styles.statusLabel}>Ativas</Text>
            </View>
            <View style={[styles.statusItem, styles.statusPending]}>
              <Text style={styles.statusValue}>{summary.status.pendente}</Text>
              <Text style={styles.statusLabel}>Pendentes</Text>
            </View>
            <View style={[styles.statusItem, styles.statusInactive]}>
              <Text style={styles.statusValue}>{summary.status.inativo}</Text>
              <Text style={styles.statusLabel}>Inativas</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard
          title="Resumo operacional"
          subtitle="Contagens calculadas a partir dos registros locais disponíveis."
          icon="analytics-outline"
        >
          <View style={styles.summaryLine}>
            <Ionicons name="calendar-outline" size={18} color={colors.success} />
            <Text style={styles.summaryText}>
              {summary.visitas > 0
                ? `${summary.visitas} visita${summary.visitas === 1 ? '' : 's'} registrada${summary.visitas === 1 ? '' : 's'}`
                : 'Nenhuma visita registrada'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Ionicons name="book-outline" size={18} color={colors.warning} />
            <Text style={styles.summaryText}>
              {summary.cadernos > 0
                ? `${summary.cadernos} registro${summary.cadernos === 1 ? '' : 's'} no caderno`
                : 'Nenhum registro no caderno'}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Ionicons name="map-outline" size={18} color={colors.info} />
            <Text style={styles.summaryText}>
              {summary.mapas > 0
                ? `${summary.mapas} ${summary.mapas === 1 ? 'mapa ou material disponível' : 'mapas ou materiais disponíveis'}`
                : 'Nenhum mapa ou material disponível'}
            </Text>
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screen,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: typography.fontBody,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 4,
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  welcomeText: {
    color: colors.text,
    fontSize: typography.fontTitle - 2,
    fontWeight: typography.weightBold,
  },
  subtitle: {
    color: colors.textLight,
    fontSize: typography.fontBody,
    marginTop: spacing.xs,
  },
  filtrosContainer: {
    marginVertical: spacing.md,
    marginHorizontal: -spacing.screen,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    padding: spacing.md,
  },
  scopeText: {
    flex: 1,
    minWidth: 0,
  },
  scopeLabel: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
  },
  scopeValue: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    marginTop: 2,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontCaption + 1,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: spacing.sm,
  },
  statCardWrapper: {
    width: '50%',
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: spacing.radiusSm,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  statusPending: {
    backgroundColor: colors.amberLight,
    borderColor: colors.warning,
  },
  statusInactive: {
    backgroundColor: colors.backgroundNeutral,
    borderColor: colors.mutedLight,
  },
  statusValue: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  statusLabel: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
  },
});
