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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import { CadernoCampo, Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import {
  filtrarCadernosPorFazendaIds,
  filtrarProdutoresPorAcesso,
  findFazendaById,
  getCadernoFazendaId,
  getFazendaId,
  getFazendaIds,
  podeIncluirCaderno,
} from '../utils/acessoControle';
import { getFazendaUiInfo, matchesFazendaUiBusca } from '../utils/fazendaUiCompat';
import {
  getCadernoTalhaoLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoVisivelParaProdutor,
  ordenarCadernosPorDataRecente,
} from '../utils/cadernoFormCompat';

export default function CadernoCampoScreen() {
  const navigation = useNavigation<any>();
  const [registros, setRegistros] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros, filtrarProdutores: filtrarFazendas } = useFiltros();
  const isProdutorView = user?.perfil === 'produtor';
  const podeMostrarCriarCaderno = podeIncluirCaderno(user) && !isProdutorView;

  const load = useCallback(async () => {
    try {
      // Simula lógica de permissões por perfil
      let registrosData = [];
      let fazendasData = [];

      if (user?.perfil === 'admin') {
        // Admin vê tudo com filtros aplicados
        const [todosRegistros, fazendasBrutas] = await Promise.all([
          CadernoCampo.list(),
          Produtor.list()
        ]);
        
        // Aplicar filtros regionais
        const fazendaIdsFiltrados = getFazendaIdsFiltrados(fazendasBrutas);
        registrosData = filtrarCadernosPorFazendaIds(todosRegistros, fazendaIdsFiltrados);
        fazendasData = fazendasBrutas.filter(p => fazendaIdsFiltrados.includes(getFazendaId(p)));
      } else if (user?.perfil === 'colaborador' || user?.perfil === 'produtor') {
        const [todosRegistros, fazendasBrutas] = await Promise.all([
          CadernoCampo.list(),
          Produtor.list()
        ]);

        const fazendasComAcesso = filtrarProdutoresPorAcesso(fazendasBrutas, user);
        fazendasData = filtrarFazendas(fazendasComAcesso);
        const idsFiltrados = getFazendaIds(fazendasData);
        registrosData = filtrarCadernosPorFazendaIds(todosRegistros, idsFiltrados, {
          somenteVisivelParaProdutor: user?.perfil === 'produtor',
        });
      } else {
        // Sem usuário, carrega tudo (fallback)
        [registrosData, fazendasData] = await Promise.all([
          CadernoCampo.list(),
          Produtor.list()
        ]);
      }

      setRegistros(registrosData);
      setFazendas(fazendasData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [filtros, user]);

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

  // Filtro de busca
  const registrosFiltrados = ordenarCadernosPorDataRecente(registros.filter(registro => {
    const fazenda = getFazenda(getCadernoFazendaId(registro));
    return matchesFazendaUiBusca(fazenda, busca, [
      registro.tipo_atividade,
      registro.talhao,
      registro.colaborador_responsavel,
      registro.observacoes,
    ]);
  }));

  // Cores para tipos de atividade
  const getTipoColor = (tipo) => {
    const cores = {
      observacao: colors.muted,
      visita_tecnica: colors.cyan,
      fertilidade: colors.success,
      correcao_solo: colors.info,
      prescricao: colors.purple,
      plantio: colors.success,
      adubacao: colors.info,
      aplicacao: colors.purple,
      colheita: colors.warning,
      analise_solo: colors.orange,
      vistoria: colors.cyan,
      outro: colors.muted
    };
    return cores[tipo] || colors.muted;
  };

  // Formata data
  const formatarData = (data) => {
    if (!data) return '-';
    const d = new Date(data);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Header title="Caderno de Campo" />
      
      {/* Barra de busca */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por propriedade, atividade ou talhão..."
        />
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
            <Text style={styles.loadingText}>Carregando registros...</Text>
          </View>
        ) : registrosFiltrados.length === 0 ? (
          <EmptyState
            icon={busca ? 'search-outline' : 'document-text-outline'}
            title={busca ? 'Nenhum registro encontrado' : isProdutorView ? 'Nenhum registro liberado' : 'Ainda não há registros de caderno de campo'}
            message={
              busca
                ? 'Tente ajustar os filtros de busca'
                : isProdutorView
                  ? 'Nenhum registro de caderno liberado para o Produtor.'
                  : 'Quando houver registros de caderno, eles aparecerão aqui.'
            }
            style={styles.emptyState}
          />
        ) : (
          registrosFiltrados.map(reg => {
            const fazenda = getFazenda(getCadernoFazendaId(reg));
            const fazendaInfo = getFazendaUiInfo(fazenda);
            const tipoColor = getTipoColor(reg.tipo_atividade);
            const tipoLabel = getCadernoTipoLabel(reg.tipo_atividade);
            const talhaoLabel = getCadernoTalhaoLabel(reg);
            const visivelParaProdutor = isCadernoVisivelParaProdutor(reg);
            const visibilidadeColor = visivelParaProdutor ? colors.success : colors.warning;
            
            return (
              <TouchableOpacity
                key={reg.id}
                style={styles.card}
                activeOpacity={0.86}
                onPress={() => navigation.navigate('CadernoDetail', { cadernoId: reg.id })}
              >
                {/* Cabeçalho do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIcon, { backgroundColor: tipoColor + '20' }]}>
                      <Ionicons name="book-outline" size={24} color={tipoColor} />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {fazendaInfo.fazendaNome || 'Propriedade não encontrada'}
                      </Text>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        Talhão: {talhaoLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <View style={[styles.badge, { backgroundColor: tipoColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: tipoColor }]}>
                        {tipoLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </View>
                </View>

                {/* Informações */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                    <Text style={styles.infoText}>{formatarData(reg.data_atividade)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                    <Text style={styles.infoText} numberOfLines={1}>
                      Responsável: {reg.colaborador_responsavel || '-'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons
                      name={visivelParaProdutor ? 'eye-outline' : 'lock-closed-outline'}
                      size={16}
                      color={visibilidadeColor}
                      style={styles.infoIcon}
                    />
                    <Text style={[styles.infoText, { color: visibilidadeColor }]} numberOfLines={1}>
                      {getCadernoVisibilidadeLabel(reg)}
                    </Text>
                  </View>
                  {reg.area_aplicada && (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textLight} style={styles.infoIcon} />
                      <Text style={styles.infoText}>{reg.area_aplicada} ha</Text>
                    </View>
                  )}
                </View>

                {/* Produtos e Dosagem */}
                {(reg.produtos_utilizados && reg.produtos_utilizados.length > 0) && (
                  <View style={styles.produtosBox}>
                    <Text style={styles.produtosLabel}>Produtos:</Text>
                    <Text style={styles.produtosText} numberOfLines={2}>
                      {reg.produtos_utilizados.join(', ')}
                    </Text>
                    {reg.dosagem && (
                      <Text style={styles.dosagemText}>Dosagem: {reg.dosagem}</Text>
                    )}
                  </View>
                )}

                {/* Condições Climáticas */}
                {reg.condicoes_clima && (
                  <View style={styles.climaBox}>
                    <Ionicons name="cloudy-outline" size={16} color={colors.textLight} style={{ marginRight: 6 }} />
                    <Text style={styles.climaText}>{reg.condicoes_clima}</Text>
                  </View>
                )}

                {/* Observações */}
                {reg.observacoes && (
                  <View style={styles.observacoesBox}>
                    <Text style={styles.observacoesText} numberOfLines={2}>
                      {reg.observacoes}
                    </Text>
                  </View>
                )}

                {/* Fotos */}
                {reg.fotos && reg.fotos.length > 0 && (
                  <View style={styles.fotosBox}>
                    <Ionicons name="images-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
                    <Text style={styles.fotosText}>
                      {reg.fotos.length} foto(s) anexada(s)
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {podeMostrarCriarCaderno && (
        <CreateActionButton
          label="Novo Registro"
          icon="add-outline"
          onPress={() => navigation.navigate('NovoCaderno')}
          accessibilityLabel="Cadastrar novo registro do caderno"
        />
      )}
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0
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
  produtosBox: {
    backgroundColor: colors.accent,
    padding: spacing.gap,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.gap,
    borderWidth: 1,
    borderColor: colors.accentDark
  },
  produtosLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.primaryDark,
    marginBottom: 4
  },
  produtosText: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    lineHeight: 18
  },
  dosagemText: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginTop: 4,
    fontStyle: 'italic'
  },
  climaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.gap,
    paddingHorizontal: spacing.gap,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: spacing.radiusSm
  },
  climaText: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    flex: 1
  },
  observacoesBox: {
    backgroundColor: colors.background,
    padding: spacing.gap,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.gap
  },
  observacoesText: {
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
  emptyState: {
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.screen * 2,
  },
});
