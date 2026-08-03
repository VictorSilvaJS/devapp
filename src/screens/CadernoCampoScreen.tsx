import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../components/FilterBottomSheet';
import OperationalCard from '../components/OperationalCard';
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
  getCadernoPeriodoProdutivoLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoVisivelParaProdutor,
  ordenarCadernosPorDataRecente,
} from '../utils/cadernoFormCompat';
import { hasCadernoLocalizacao } from '../utils/cadernoLocalizacaoCompat';
import { resolveOperationalSummary } from '../utils/operationalCardCompat';

export default function CadernoCampoScreen() {
  const navigation = useNavigation<any>();
  const [registros, setRegistros] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [tipoFiltroRascunho, setTipoFiltroRascunho] = useState('todos');
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros, filtrarProdutores: filtrarFazendas } = useFiltros();
  const isProdutorView = user?.perfil === 'produtor';
  const podeMostrarCriarCaderno = podeIncluirCaderno(user);
  const criarCadernoLabel = isProdutorView ? 'Registrar no Caderno' : 'Novo Registro';

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
    if (tipoFiltro !== 'todos' && registro.tipo_atividade !== tipoFiltro) return false;
    const fazenda = getFazenda(getCadernoFazendaId(registro));
    return matchesFazendaUiBusca(fazenda, busca, [
      registro.tipo_atividade,
      registro.talhao,
      registro.periodo_produtivo_label,
      registro.ano_agricola,
      registro.cultura_periodo,
      registro.colaborador_responsavel,
      registro.observacoes,
    ]);
  }));
  const tiposDisponiveis = Array.from(new Set(
    registros
      .map((registro) => registro.tipo_atividade)
      .filter(Boolean)
  )).sort((a, b) => getCadernoTipoLabel(a).localeCompare(getCadernoTipoLabel(b)));
  const tipoOptions = [
    { value: 'todos', label: 'Todos' },
    ...tiposDisponiveis.map((tipo) => ({ value: tipo, label: getCadernoTipoLabel(tipo) })),
  ];
  const tipoFiltroLabel = tipoFiltro === 'todos' ? '' : getCadernoTipoLabel(tipoFiltro);

  const abrirFiltros = () => {
    setTipoFiltroRascunho(tipoFiltro);
    setFiltrosVisiveis(true);
  };

  const cancelarFiltros = () => {
    setTipoFiltroRascunho(tipoFiltro);
    setFiltrosVisiveis(false);
  };

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
        <FilterTrigger
          activeCount={tipoFiltro === 'todos' ? 0 : 1}
          onPress={abrirFiltros}
          style={styles.filterTrigger}
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
        <ActiveFilterBar
          items={tipoFiltro === 'todos' ? [] : [{
            key: 'tipo',
            label: tipoFiltroLabel,
            icon: 'book',
            color: getTipoColor(tipoFiltro),
            onRemove: () => setTipoFiltro('todos'),
          }]}
          onClear={() => setTipoFiltro('todos')}
        />

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
                  ? 'Você ainda não tem registros liberados ou registrados no Caderno.'
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
            const periodoProdutivoLabel = getCadernoPeriodoProdutivoLabel(reg);
            const visivelParaProdutor = isCadernoVisivelParaProdutor(reg);
            const visibilidadeColor = visivelParaProdutor ? colors.success : colors.warning;
            const summary = resolveOperationalSummary([
              reg.observacoes,
              reg.produtos_utilizados?.length > 0
                ? `Produtos: ${reg.produtos_utilizados.join(', ')}`
                : '',
              reg.condicoes_clima ? `Condições: ${reg.condicoes_clima}` : '',
            ]);
            const chips = [
              ...(hasCadernoLocalizacao(reg) ? [{
                label: 'Com ponto geográfico',
                icon: 'location-outline' as const,
                color: colors.primary,
              }] : []),
              ...(!isProdutorView ? [{
                label: getCadernoVisibilidadeLabel(reg),
                icon: visivelParaProdutor ? 'eye-outline' as const : 'lock-closed-outline' as const,
                color: visibilidadeColor,
              }] : []),
            ];
            
            return (
              <OperationalCard
                key={reg.id}
                title={fazendaInfo.fazendaNome || 'Propriedade não encontrada'}
                icon="book-outline"
                accentColor={tipoColor}
                date={reg.data_atividade}
                tags={[{ label: tipoLabel, color: tipoColor }]}
                metadata={[
                  { icon: 'grid-outline', label: `Talhão: ${talhaoLabel}` },
                  { icon: 'person-outline', label: `Responsável: ${reg.colaborador_responsavel || 'Não informado'}` },
                  ...(periodoProdutivoLabel ? [{
                    icon: 'leaf-outline' as const,
                    label: `Safra/Safrinha: ${periodoProdutivoLabel}`,
                  }] : []),
                ]}
                summary={summary}
                chips={chips}
                accessibilityLabel={`Abrir registro de Caderno, ${tipoLabel}, em ${fazendaInfo.fazendaNome || 'Propriedade não encontrada'}, ${talhaoLabel}`}
                onPress={() => navigation.navigate('CadernoDetail', { cadernoId: reg.id })}
              />
            );
          })
        )}
      </ScrollView>

      {podeMostrarCriarCaderno && (
        <CreateActionButton
          label={criarCadernoLabel}
          icon="add-outline"
          onPress={() => navigation.navigate('NovoCaderno')}
          accessibilityLabel={isProdutorView ? 'Registrar no caderno de campo' : 'Cadastrar novo registro do caderno'}
        />
      )}

      <FilterBottomSheet
        visible={filtrosVisiveis}
        onRequestClose={cancelarFiltros}
        onClear={() => setTipoFiltroRascunho('todos')}
        onApply={() => {
          setTipoFiltro(tipoFiltroRascunho);
          setFiltrosVisiveis(false);
        }}
        subtitle="Filtre os registros pelo tipo de atividade"
      >
        <FilterSection title="Tipo de atividade">
          <SegmentedChips
            options={tipoOptions}
            value={tipoFiltroRascunho}
            onChange={setTipoFiltroRascunho}
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
  filterTrigger: {
    width: '100%',
    marginTop: spacing.sm,
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
  emptyState: {
    paddingVertical: spacing.screen * 3,
    paddingHorizontal: spacing.screen * 2,
  },
});
