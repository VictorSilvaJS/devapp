import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import OperationalCard from '../components/OperationalCard';
import PropriedadeTalhoesEntry from '../components/PropriedadeTalhoesEntry';
import { CadernoLocalizacaoBadge } from '../components/CadernoLocalizacaoSection';
import { useToast } from '../components/Toast';
import { Produtor, Visita, CadernoCampo, LimiteArea, User } from '../api/mock';
import { buildFazendaDeleteIntegrity } from '../api/produtorCompat';
import { MaterialCatalogService } from '../services/MaterialCatalogService';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import {
  buildFazendaMapaRouteParamsFromPropriedade,
  buildMapasRouteParams,
} from '../navigation/mapaRouteCompat';
import { buildMaterialViewerRouteParams } from '../navigation/materialRouteCompat';
import {
  buildPropriedadeContextRouteParams,
  buildPropriedadeDetailRouteParams,
} from '../navigation/propriedadeRouteCompat';
import { colors, semanticColors, typography, spacing, border, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import {
  filtrarCadernosPorFazendaIds,
  filtrarLimitesPorFazendaIds,
  filtrarProdutoresPorAcesso,
  getFazendaId,
  podeCriarVisitaEmFazenda,
  podeIncluirCadernoEmFazenda,
  podeEditarProdutor,
  podeExcluirProdutor,
  podeGerenciarPeriodoProdutivoEmFazenda,
  temAcessoProdutor,
} from '../utils/acessoControle';
import { buildFazendaDetailContext, getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { formatAreaHa, normalizeAreaValue, resolveAreaTotalInformada } from '../utils/talhaoMedidasCompat';
import {
  getColaboradoresRelacionadosAPropriedade,
  getUsuariosProdutoresDaPropriedade,
} from '../utils/territorioCompat';
import {
  getCadernoTalhaoLabel,
  getCadernoPeriodoProdutivoLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoVisivelParaProdutor,
  ordenarCadernosPorDataRecente,
} from '../utils/cadernoFormCompat';
import { getVisitaObjetivoLabel } from '../utils/visitaFormCompat';
import { resolveOperationalSummary } from '../utils/operationalCardCompat';
import {
  getVisitaStatusPresentation,
  groupVisitasForList,
  VisitaStatusTone,
} from '../utils/visitaListCompat';
import { buildPropriedadeResumo } from '../utils/propriedadeResumoCompat';
import {
  getUsuarioNome,
  getVinculoPropriedadeLabel,
  getVinculosPropriedadeUsuario,
} from '../utils/usuarioAdminCompat';
import {
  getMaterialPublicDescription,
  getMaterialPublicTitle,
} from '../utils/materialPresentationCompat';

const PROPRIEDADE_NAVIGATION_ITEMS = [
  { id: 'resumo', label: 'Resumo', icon: 'stats-chart-outline' },
  { id: 'talhoes', label: 'Talhões', icon: 'git-network-outline' },
  { id: 'safras', label: 'Safras e Safrinha', icon: 'calendar-outline' },
  { id: 'materiais', label: 'Materiais', icon: 'images-outline' },
  { id: 'visitas', label: 'Visitas', icon: 'calendar-outline' },
  { id: 'caderno', label: 'Caderno', icon: 'book-outline' },
] as const;

type PropriedadeNavigationId = typeof PROPRIEDADE_NAVIGATION_ITEMS[number]['id'];

export default function ProdutorScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const [produtor, setProdutor] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [mapas, setMapas] = useState([]);
  const [cadernos, setCadernos] = useState([]);
  const [periodosProdutivos, setPeriodosProdutivos] = useState([]);
  const [limites, setLimites] = useState([]);
  const [deleteIntegrity, setDeleteIntegrity] = useState(null);
  const [outrasFazendasTitular, setOutrasFazendasTitular] = useState([]);
  const [todasFazendasMock, setTodasFazendasMock] = useState([]);
  const [usuariosMock, setUsuariosMock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<PropriedadeNavigationId>('resumo');
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async (id) => {
    if (!id) {
      setAccessDenied(false);
      setProdutor(null);
      setVisitas([]);
      setMapas([]);
      setCadernos([]);
      setPeriodosProdutivos([]);
      setLimites([]);
      setDeleteIntegrity(null);
      setOutrasFazendasTitular([]);
      setTodasFazendasMock([]);
      setUsuariosMock([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setAccessDenied(false);
      const p = await Produtor.get(id);

      if (!temAcessoProdutor(user, p)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setProdutor(null);
        setVisitas([]);
        setMapas([]);
        setCadernos([]);
        setPeriodosProdutivos([]);
        setLimites([]);
        setDeleteIntegrity(null);
        setOutrasFazendasTitular([]);
        setTodasFazendasMock([]);
        setUsuariosMock([]);
        setAccessDenied(true);
        return;
      }

      const fazendaAtualId = getFazendaId(p) || id;
      const [v, catalogoMateriais, todosCadernos, periodos, todosLimites, todasFazendas, todosUsuarios] = await Promise.all([
        Visita.filter({ fazenda_id: fazendaAtualId }),
        MaterialCatalogService.consultarMateriais({
          propriedadeIds: [fazendaAtualId],
          perfil: user?.perfil,
        }),
        CadernoCampo.list(),
        PeriodoProdutivoService.listActivePeriodosProdutivosByPropriedade(fazendaAtualId),
        LimiteArea.list(),
        Produtor.list(),
        User.list(),
      ]);
      const m = catalogoMateriais.materiais;
      const c = ordenarCadernosPorDataRecente(
        filtrarCadernosPorFazendaIds(todosCadernos, [fazendaAtualId], {
          somenteVisivelParaProdutor: user?.perfil === 'produtor',
        })
      );
      const l = filtrarLimitesPorFazendaIds(todosLimites, [fazendaAtualId]);
      const fazendasComAcesso = filtrarProdutoresPorAcesso(todasFazendas, user);
      const detalheContexto = buildFazendaDetailContext(p, fazendasComAcesso);
      const integridadeExclusao = buildFazendaDeleteIntegrity(p, {
        mapas: m,
        visitas: v,
        cadernos: c,
        limites: l,
      });

      // animar mudanças locais
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProdutor(p);
      setVisitas(v);
      setMapas(m);
      setCadernos(c);
      setPeriodosProdutivos(periodos);
      setLimites(l);
      setDeleteIntegrity(integridadeExclusao);
      setOutrasFazendasTitular(detalheContexto.outrasFazendasTitular);
      setTodasFazendasMock(todasFazendas);
      setUsuariosMock(todosUsuarios);
    } catch (error) {
      toast.showError('Não foi possível carregar os dados da propriedade');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = route?.params?.id;
    loadData(id);
  }, [route?.params?.id, user]);

  // Recarregar dados quando voltar da tela de edição
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const id = route?.params?.id;
      if (id) {
        loadData(id);
      }
    });
    return unsubscribe;
  }, [navigation, route?.params?.id, user]);

  const handleEdit = () => {
    if (!podeEditarProdutor(user, produtor)) {
      toast.showWarning('Você não tem permissão para editar esta propriedade.');
      return;
    }

    navigation.navigate('EditarPropriedade', { id: produtor.id });
  };

  const getCurrentDeleteIntegrity = () =>
    buildFazendaDeleteIntegrity(produtor, {
      mapas,
      visitas,
      cadernos,
      limites,
    });

  const handleDelete = () => {
    if (!podeExcluirProdutor(user, produtor)) {
      toast.showWarning('Você não tem permissão para excluir esta propriedade.');
      return;
    }

    const integridade = getCurrentDeleteIntegrity();
    if (!integridade.canDelete) {
      toast.showWarning(integridade.blockingMessage);
      return;
    }

    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!podeExcluirProdutor(user, produtor)) {
      setDeleteDialogVisible(false);
      toast.showWarning('Você não tem permissão para excluir esta propriedade.');
      return;
    }

    const integridade = getCurrentDeleteIntegrity();
    if (!integridade.canDelete) {
      setDeleteDialogVisible(false);
      toast.showWarning(integridade.blockingMessage);
      return;
    }

    setDeleting(true);
    try {
      await Produtor.delete(produtor.id);
      setDeleteDialogVisible(false);
      setDeleting(false);
      toast.showSuccess('Propriedade excluída com sucesso');
      navigation.navigate('Propriedades');
    } catch (error) {
      setDeleteDialogVisible(false);
      setDeleting(false);
      toast.showError(error?.message || 'Não foi possível excluir a propriedade');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Propriedade" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando propriedade...</Text>
        </View>
      </View>
    );
  }

  if (!produtor) {
    return (
      <View style={styles.container}>
        <Header title="Propriedade" showBack />
        <View style={styles.loadingContainer}>
          <Text style={styles.body}>
            {accessDenied ? 'Você não tem permissão para acessar esta propriedade.' : 'Propriedade não encontrada.'}
          </Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = getFazendaUiInfo(produtor);
  const fazendaAtualId = getFazendaId(produtor);
  const localizacaoFazenda = fazendaInfo.localizacao;
  const mapasRouteParams = buildMapasRouteParams({
    fazendaId: fazendaAtualId,
  });
  const podeEditar = podeEditarProdutor(user, produtor);
  const podeExcluir = podeExcluirProdutor(user, produtor);
  const integridadeExclusao = deleteIntegrity || getCurrentDeleteIntegrity();
  const exclusaoBloqueadaPorIntegridade = podeExcluir && !integridadeExclusao.canDelete;
  const handleAbrirMaterial = (mapa) => {
    const params = buildMaterialViewerRouteParams(mapa);
    if (!params) {
      toast.showError('Não foi possível identificar este material e sua versão.');
      return;
    }

    navigation.navigate('MaterialViewer', params);
  };
  const handleAbrirTalhaoNoMapa = (talhao?) => navigation.navigate(
    'FazendaMapa',
    buildFazendaMapaRouteParamsFromPropriedade(
      produtor,
      talhao
        ? {
            talhaoId: talhao.id,
            talhaoNome: talhao.talhao || talhao.nome,
            talhao: talhao.talhao || talhao.nome,
            talhaoAno: talhao.ano ? String(talhao.ano) : undefined,
          }
        : undefined
    )
  );
  const podeCriarCadernoNaFazenda = podeIncluirCadernoEmFazenda(user, produtor);
  const podeCriarVisitaNaFazenda = podeCriarVisitaEmFazenda(user, produtor);
  const podeGerenciarPeriodosNaFazenda = podeGerenciarPeriodoProdutivoEmFazenda(user, produtor);
  const produtoresVinculadosMock = user?.perfil === 'admin'
    ? getUsuariosProdutoresDaPropriedade(usuariosMock, produtor, todasFazendasMock)
    : [];
  const colaboradoresRelacionadosMock = user?.perfil === 'admin'
    ? getColaboradoresRelacionadosAPropriedade(usuariosMock, produtor, todasFazendasMock)
    : [];
  const isProdutorView = user?.perfil === 'produtor';
  const resumoPropriedade = buildPropriedadeResumo({
    propriedade: produtor,
    visitas,
    cadernos,
    mapas,
    limites,
    isProdutor: isProdutorView,
  });
  const formatarDataIndicador = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };
  const materialMaisRecenteData = resumoPropriedade.materialMaisRecente?.data_atualizacao
    || resumoPropriedade.materialMaisRecente?.updated_at
    || resumoPropriedade.materialMaisRecente?.data_criacao
    || resumoPropriedade.materialMaisRecente?.data_upload
    || resumoPropriedade.materialMaisRecente?.created_at;
  const ultimaAtividadeMeta = resumoPropriedade.ultimaAtividade?.kind === 'caderno'
    ? `Caderno • ${getCadernoTipoLabel(resumoPropriedade.ultimaAtividade.item?.tipo_atividade)}`
    : resumoPropriedade.ultimaAtividade?.kind === 'visita'
      ? `Visita • ${getVisitaObjetivoLabel(resumoPropriedade.ultimaAtividade.item?.objetivo)}`
      : 'Nenhuma atividade registrada';
  const materialIndicatorLabel = isProdutorView ? 'Material liberado' : 'Material atualizado';
  const statusInfo = produtor.status === 'ativo'
    ? { label: 'Ativo', color: colors.success, icon: 'checkmark-circle' as const }
    : produtor.status === 'inativo'
      ? { label: 'Inativo', color: colors.muted, icon: 'close-circle' as const }
      : { label: 'Pendente', color: colors.warning, icon: 'time' as const };
  const detalhePropriedadeSubtitulo = isProdutorView
    ? 'Acompanhe talhões, visitas, caderno e materiais técnicos liberados para esta Propriedade.'
    : 'Consulte o contexto operacional e acesse os fluxos vinculados a esta Propriedade.';
  const podeMostrarCriarCaderno = podeCriarCadernoNaFazenda;
  const criarCadernoLabel = isProdutorView ? 'Registrar' : 'Novo';
  const criarCadernoEmptyLabel = isProdutorView ? 'Registrar no Caderno' : 'Novo Registro';
  const tituloMateriaisPropriedade = isProdutorView
    ? 'Mapas e arquivos técnicos'
    : 'Materiais técnicos da Propriedade';
  const mensagemSemMaterial = isProdutorView
    ? 'Nenhum material técnico liberado para consulta nesta Propriedade.'
    : 'Nenhum material técnico cadastrado para esta Propriedade.';
  const mensagemSemVisita = isProdutorView
    ? 'Nenhuma visita registrada para consulta nesta Propriedade.'
    : 'Quando uma visita for registrada para esta Propriedade, ela aparecerá aqui.';
  const mensagemSemCaderno = isProdutorView
    ? 'Você ainda não tem registros liberados ou registrados no Caderno.'
    : 'Quando houver registros liberados para esta Propriedade, eles aparecerão aqui.';
  const visitaSections = groupVisitasForList(visitas);

  const handleNovaVisita = () => {
    if (!podeCriarVisitaNaFazenda) {
      toast.showWarning('Você não tem permissão para criar visita nesta propriedade.');
      return;
    }

    const params = buildPropriedadeContextRouteParams(produtor);
    if (params) {
      navigation.navigate('NovaVisita', params);
    }
  };

  const handleNovoCaderno = () => {
    if (!podeCriarCadernoNaFazenda) {
      toast.showWarning('Você não tem permissão para criar registro nesta propriedade.');
      return;
    }

    const params = buildPropriedadeContextRouteParams(produtor);
    if (params) {
      navigation.navigate('NovoCaderno', params);
    }
  };

  const handleNovoPeriodoProdutivo = () => {
    if (!podeGerenciarPeriodosNaFazenda) {
      toast.showWarning('Você não tem permissão para gerenciar Safra/Safrinha nesta propriedade.');
      return;
    }

    navigation.navigate('NovoPeriodoProdutivo', { fazendaId: fazendaAtualId });
  };

  const handleEditarPeriodoProdutivo = (periodo) => {
    if (!podeGerenciarPeriodosNaFazenda) {
      return;
    }

    navigation.navigate('EditarPeriodoProdutivo', { periodoId: periodo.id });
  };

  const getCadernoTipoColor = (tipo) => {
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
      outro: colors.muted,
    };
    return cores[tipo] || colors.muted;
  };

  const getVisitaStatusColor = (tone: VisitaStatusTone) => {
    const cores = {
      info: colors.info,
      warning: colors.warning,
      success: colors.success,
      danger: colors.danger,
      muted: colors.muted,
    };
    return cores[tone] || colors.muted;
  };

  const formatarDataCaderno = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatarAreaCaderno = (area) => {
    return normalizeAreaValue(area) == null ? null : formatAreaHa(area);
  };

  const getPeriodoStatusInfo = (status) => {
    if (status === 'em_andamento') {
      return { label: 'Em andamento', color: colors.success };
    }
    if (status === 'encerrada') {
      return { label: 'Encerrada', color: colors.muted };
    }
    return { label: 'Planejada', color: colors.warning };
  };

  const formatarDataPeriodo = (data) => {
    if (!data) return null;
    const date = new Date(data);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <Header title={fazendaInfo.fazendaNome || 'Propriedade'} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho com Avatar e Informações Básicas */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(fazendaInfo.fazendaNome || 'F').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {fazendaInfo.fazendaNome || 'Propriedade sem nome'}
            </Text>
            <Text style={styles.profileSubtitle} numberOfLines={3}>
              {detalhePropriedadeSubtitulo}
            </Text>
            <View style={styles.locationContainer}>
              <Ionicons name="person-outline" size={14} color={colors.muted} />
              <Text style={styles.profileLocation} numberOfLines={1}>
                Titular: {fazendaInfo.titularNome || 'Não informado'}
              </Text>
            </View>
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={14} color={colors.muted} />
              <Text style={styles.profileLocation} numberOfLines={2}>
                {localizacaoFazenda || 'Localização não informada'}
              </Text>
            </View>
          </View>
        </View>

        {/* Botões de Ação */}
        {(podeEditar || podeExcluir) && (
          <View style={styles.actionButtons}>
            {podeEditar && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEdit}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.editButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.white} />
                  <Text style={styles.editButtonText}>Editar Propriedade</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {podeExcluir && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    exclusaoBloqueadaPorIntegridade
                      ? [colors.muted, colors.muted]
                      : [colors.error, colors.error]
                  }
                  style={styles.deleteButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={exclusaoBloqueadaPorIntegridade ? 'lock-closed-outline' : 'trash-outline'}
                    size={20}
                    color={colors.white}
                  />
                  <Text style={styles.deleteButtonText}>
                    {exclusaoBloqueadaPorIntegridade ? 'Bloqueada' : 'Excluir'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Indicadores de acompanhamento da Propriedade */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statsCarousel}
          contentContainerStyle={styles.statsContent}
        >
          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.info} />
            </View>
            <Text style={styles.statValueCompact} numberOfLines={1}>
              {resumoPropriedade.proximaVisita
                ? formatarDataIndicador(resumoPropriedade.proximaVisita.data_visita)
                : 'Sem agenda'}
            </Text>
            <Text style={styles.statLabelCompact}>Próxima Visita</Text>
            <Text style={styles.statMetaCompact} numberOfLines={2}>
              {resumoPropriedade.proximaVisita
                ? getVisitaObjetivoLabel(resumoPropriedade.proximaVisita.objetivo)
                : 'Nenhuma Visita agendada'}
            </Text>
          </View>

          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="pulse-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValueCompact} numberOfLines={1}>
              {resumoPropriedade.ultimaAtividade
                ? formatarDataIndicador(resumoPropriedade.ultimaAtividade.date)
                : 'Sem registro'}
            </Text>
            <Text style={styles.statLabelCompact}>Última atividade</Text>
            <Text style={styles.statMetaCompact} numberOfLines={2}>
              {ultimaAtividadeMeta}
            </Text>
          </View>

          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="map-outline" size={20} color={colors.amber} />
            </View>
            <Text style={styles.statValueCompact} numberOfLines={1}>
              {resumoPropriedade.materialMaisRecente
                ? formatarDataIndicador(materialMaisRecenteData)
                : 'Nenhum'}
            </Text>
            <Text style={styles.statLabelCompact}>{materialIndicatorLabel}</Text>
            <Text style={styles.statMetaCompact} numberOfLines={2}>
              {resumoPropriedade.materialMaisRecente?.titulo || 'Nenhum material disponível'}
            </Text>
          </View>

          <View style={styles.statCardCompact}>
            <View style={[
              styles.statIconCompact,
              {
                backgroundColor: resumoPropriedade.pontosAtencao.length > 0
                  ? colors.amberLight
                  : semanticColors.success.surface,
              },
            ]}>
              <Ionicons
                name={resumoPropriedade.pontosAtencao.length > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                size={20}
                color={resumoPropriedade.pontosAtencao.length > 0 ? colors.warning : semanticColors.success.text}
              />
            </View>
            <Text style={styles.statValueCompact}>{resumoPropriedade.pontosAtencao.length}</Text>
            <Text style={styles.statLabelCompact}>Pontos de atenção</Text>
            <Text style={styles.statMetaCompact} numberOfLines={2}>
              {resumoPropriedade.pontosAtencao.length > 0
                ? 'Confira os itens no Resumo'
                : 'Acompanhamento em dia'}
            </Text>
          </View>
        </ScrollView>

        {/* Tabs de Navegação */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {PROPRIEDADE_NAVIGATION_ITEMS.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.muted}
                  style={styles.tabIcon}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Conteúdo das Tabs */}
        {activeTab === 'resumo' && (
          <View style={styles.tabContent}>
            {isProdutorView && (
              <InfoBox
                title="Modo acompanhamento"
                message="Esta visão reúne a situação da Propriedade para consulta. Você pode registrar ocorrências no Caderno; ações técnicas e materiais ficam com a equipe autorizada."
                style={styles.infoBox}
              />
            )}

            {resumoPropriedade.pontosAtencao.length > 0 && (
              <SectionCard title="Pontos de atenção" icon="alert-circle-outline">
                <View style={styles.attentionList}>
                  {resumoPropriedade.pontosAtencao.map((ponto) => (
                    <View key={ponto.id} style={styles.attentionRow}>
                      <Ionicons name="alert-circle-outline" size={18} color={semanticColors.warning.text} />
                      <Text style={styles.attentionText}>{ponto.message}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            )}

            <SectionCard title="Dados complementares" icon="information-circle-outline">
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="resize-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Área total informada</Text>
                </View>
                <Text style={styles.infoValue}>{formatAreaHa(resolveAreaTotalInformada(produtor))}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="leaf-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Cultura principal</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.cultura_atual || 'Não informado'}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
                  <Text style={styles.infoLabel}>Status</Text>
                </View>
                <View style={[styles.statusBadgeInline, { backgroundColor: statusInfo.color + '20' }]}>
                  <Text style={[styles.statusTextInline, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
              {produtor.regiao ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="compass-outline" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Região informada</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.regiao}</Text>
                </View>
              ) : null}
              {produtor.microregiao ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Microrregião informada</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.microregiao}</Text>
                </View>
              ) : null}
              {produtor.documento ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>CNPJ ou inscrição</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.documento}</Text>
                </View>
              ) : null}
              {produtor.colaborador_responsavel ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Colaborador responsável</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.colaborador_responsavel}</Text>
                </View>
              ) : null}
              {produtor.contato && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="call" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Contato do Titular</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.contato}</Text>
                </View>
              )}
              {produtor.email && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="mail" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Email do Titular</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.email}</Text>
                </View>
              )}
            </SectionCard>

            {user?.perfil === 'admin' && (
              <SectionCard title="Vínculos visuais do mock" icon="link-outline">
                <InfoBox
                  message="Preparação visual para backend/banco. Estes vínculos não alteram o motor efetivo de permissões nesta fase."
                  style={styles.infoBox}
                />

                <View style={styles.mockLinkGroup}>
                  <Text style={styles.mockLinkGroupTitle}>Usuário produtor vinculado</Text>
                  {produtoresVinculadosMock.length === 0 ? (
                    <EmptyState
                      icon="person-outline"
                      title="Nenhum usuário produtor vinculado"
                      message="Nenhum usuário produtor vinculado no mock."
                      style={styles.emptyStateCompact}
                    />
                  ) : (
                    produtoresVinculadosMock.map((usuarioProdutor) => {
                      const vinculo = getVinculosPropriedadeUsuario(
                        usuarioProdutor,
                        todasFazendasMock
                      ).find((item) => item.propriedade_id === fazendaAtualId);

                      return (
                        <View key={usuarioProdutor.id} style={styles.mockLinkItem}>
                          <Ionicons name="person-outline" size={16} color={colors.primary} />
                          <View style={styles.mockLinkItemText}>
                            <Text style={styles.mockLinkName}>{getUsuarioNome(usuarioProdutor)}</Text>
                            <Text style={styles.mockLinkMeta}>
                              {vinculo?.principal ? 'Principal' : 'Vínculo'} • {getVinculoPropriedadeLabel(vinculo?.tipo_vinculo)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                <View style={styles.mockLinkGroup}>
                  <Text style={styles.mockLinkGroupTitle}>Colaboradores sugeridos ou relacionados</Text>
                  {colaboradoresRelacionadosMock.length === 0 ? (
                    <EmptyState
                      icon="briefcase-outline"
                      title="Nenhum colaborador relacionado"
                      message="Nenhum colaborador relacionado ao território no mock."
                      style={styles.emptyStateCompact}
                    />
                  ) : (
                    colaboradoresRelacionadosMock.map((colaborador) => {
                      const temVinculoDireto = getVinculosPropriedadeUsuario(
                        colaborador,
                        todasFazendasMock
                      ).some((item) => item.propriedade_id === fazendaAtualId);

                      return (
                        <View key={colaborador.id} style={styles.mockLinkItem}>
                          <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                          <View style={styles.mockLinkItemText}>
                            <Text style={styles.mockLinkName}>{getUsuarioNome(colaborador)}</Text>
                            <Text style={styles.mockLinkMeta}>
                              {temVinculoDireto ? 'Propriedade atribuída no mock' : 'Sugerido por região/microregião'}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </SectionCard>
            )}

            {outrasFazendasTitular.length > 0 && (
              <SectionCard title="Outras Propriedades do Titular" icon="business-outline">
                <View style={styles.relatedFarmsSection}>
                  {outrasFazendasTitular.map((fazenda) => (
                    <TouchableOpacity
                      key={fazenda.id}
                      style={styles.relatedFarmRow}
                      onPress={() => {
                        const params = buildPropriedadeDetailRouteParams(fazenda);
                        if (params) navigation.navigate('ProdutorDetail', params);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.relatedFarmIcon}>
                        <Ionicons name="business-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.relatedFarmInfo}>
                        <Text style={styles.relatedFarmName} numberOfLines={1}>
                          {fazenda.fazendaNome || 'Propriedade sem nome'}
                        </Text>
                        <Text style={styles.relatedFarmLocation} numberOfLines={1}>
                          {fazenda.localizacao || 'Localização não informada'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </SectionCard>
            )}

            {podeExcluir && (
              <SectionCard title="Integridade da Exclusão" icon="shield-checkmark-outline">
                <InfoBox
                  variant={integridadeExclusao.canDelete ? 'success' : 'warning'}
                  title={integridadeExclusao.canDelete ? 'Exclusão segura' : 'Exclusão bloqueada'}
                  message={
                    integridadeExclusao.canDelete
                      ? 'Esta propriedade não possui vínculos operacionais relevantes no momento.'
                      : integridadeExclusao.blockingMessage
                  }
                  style={styles.infoBox}
                />
              </SectionCard>
            )}

            {produtor.observacoes && (
              <SectionCard title="Observações" icon="document-text-outline">
                <InfoBox message={produtor.observacoes} style={styles.infoBox} />
              </SectionCard>
            )}
          </View>
        )}

        {activeTab === 'talhoes' && (
          <View style={styles.tabContent}>
            <SectionCard
              title="Talhões da Propriedade"
              subtitle="Consulte a lista ou visualize a demarcação dos Talhões desta Propriedade."
              icon="git-network-outline"
            >
              <PropriedadeTalhoesEntry
                talhoes={limites}
                onOpenMapa={handleAbrirTalhaoNoMapa}
              />
            </SectionCard>
          </View>
        )}

        {activeTab === 'safras' && (
          <View style={styles.tabContent}>
            <SectionCard
              title="Safras e Safrinha"
              subtitle="Organização local e opcional dos ciclos produtivos da Propriedade."
              icon="calendar-outline"
              actionLabel={podeGerenciarPeriodosNaFazenda ? 'Novo' : undefined}
              actionIcon={podeGerenciarPeriodosNaFazenda ? 'add-outline' : undefined}
              onActionPress={podeGerenciarPeriodosNaFazenda ? handleNovoPeriodoProdutivo : undefined}
            >
              {periodosProdutivos.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="Nenhuma Safra/Safrinha cadastrada"
                  message={
                    podeGerenciarPeriodosNaFazenda
                      ? 'Cadastre períodos locais para organizar registros do Caderno.'
                      : 'Nenhuma Safra/Safrinha vinculada a esta Propriedade.'
                  }
                  style={styles.emptyStateCompact}
                />
              ) : (
                periodosProdutivos.map((periodo) => {
                  const statusPeriodo = getPeriodoStatusInfo(periodo.status);
                  const dataInicio = formatarDataPeriodo(periodo.data_inicio);
                  const dataFim = formatarDataPeriodo(periodo.data_fim);
                  const intervalo = dataInicio && dataFim
                    ? `${dataInicio} a ${dataFim}`
                    : dataInicio || dataFim;
                  const talhaoPeriodo = periodo.talhao_nome || periodo.talhao;

                  return (
                    <TouchableOpacity
                      key={periodo.id}
                      style={styles.periodoCard}
                      activeOpacity={podeGerenciarPeriodosNaFazenda ? 0.82 : 1}
                      disabled={!podeGerenciarPeriodosNaFazenda}
                      onPress={() => handleEditarPeriodoProdutivo(periodo)}
                    >
                      <View style={styles.periodoHeader}>
                        <View style={styles.periodoIcon}>
                          <Ionicons
                            name={periodo.tipo_periodo === 'safrinha' ? 'repeat-outline' : 'leaf-outline'}
                            size={20}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.periodoInfo}>
                          <Text style={styles.periodoTitle} numberOfLines={1}>
                            {periodo.label}
                          </Text>
                          <Text style={styles.periodoSubtitle} numberOfLines={1}>
                            {[periodo.tipo_periodo_label, periodo.cultura, periodo.ano_agricola].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        <View style={[styles.periodoStatusBadge, { backgroundColor: statusPeriodo.color + '20' }]}>
                          <Text style={[styles.periodoStatusText, { color: statusPeriodo.color }]}>
                            {statusPeriodo.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.periodoMeta}>
                        {talhaoPeriodo ? (
                          <View style={styles.periodoMetaItem}>
                            <Ionicons name="git-branch-outline" size={15} color={colors.textLight} />
                            <Text style={styles.periodoMetaText}>{talhaoPeriodo}</Text>
                          </View>
                        ) : null}
                        {intervalo ? (
                          <View style={styles.periodoMetaItem}>
                            <Ionicons name="calendar-outline" size={15} color={colors.textLight} />
                            <Text style={styles.periodoMetaText}>{intervalo}</Text>
                          </View>
                        ) : null}
                        {podeGerenciarPeriodosNaFazenda ? (
                          <View style={styles.periodoMetaItem}>
                            <Ionicons name="create-outline" size={15} color={colors.textLight} />
                            <Text style={styles.periodoMetaText}>Toque para editar</Text>
                          </View>
                        ) : null}
                      </View>

                      {periodo.observacoes ? (
                        <Text style={styles.periodoObservacoes} numberOfLines={2}>
                          {periodo.observacoes}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </SectionCard>
          </View>
        )}

        {activeTab === 'materiais' && (
          <View style={styles.tabContent}>
            <SectionCard
              title={tituloMateriaisPropriedade}
              icon="map-outline"
              actionLabel="Abrir materiais"
              actionIcon="chevron-forward-outline"
              onActionPress={() => navigation.navigate('Mapas', mapasRouteParams)}
            >
              {mapas.length === 0 ? (
                <EmptyState
                  icon="map-outline"
                  title="Nenhum material técnico disponível"
                  message={mensagemSemMaterial}
                  style={styles.emptyStateCompact}
                />
              ) : (
                <>
                  {mapas.slice(0, 3).map(mapa => (
                    <View key={mapa.id} style={styles.mapaCard}>
                      <View style={styles.mapaHeader}>
                        <View style={styles.mapaIconContainer}>
                          <Ionicons
                            name={
                              mapa.categoria === 'fertilidade' ? 'leaf-outline' :
                              mapa.categoria === 'indice_vegetacao' ? 'git-network-outline' :
                              mapa.categoria === 'correcao' ? 'flask-outline' : 'map-outline'
                            }
                            size={24}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.mapaInfo}>
                          <Text style={styles.mapaTitle}>{getMaterialPublicTitle(mapa)}</Text>
                          <Text style={styles.mapaSubtitle}>
                            {mapa.talhao} • Safra {mapa.safra}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.mapaDetails}>
                        <View style={styles.mapaDetailRow}>
                          <Ionicons name="calendar-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
                          <Text style={styles.mapaDetailItem}>
                            {new Date(mapa.data_criacao).toLocaleDateString('pt-BR')}
                          </Text>
                        </View>
                        {getMaterialPublicDescription(mapa) ? (
                          <Text style={styles.mapaObservacoes} numberOfLines={2}>
                            {getMaterialPublicDescription(mapa)}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.mapaButton}
                        onPress={() => handleAbrirMaterial(mapa)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="open-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                        <Text style={styles.mapaButtonText}>Abrir material</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {mapas.length > 3 && (
                    <TouchableOpacity
                      style={styles.verMaisButton}
                      onPress={() => navigation.navigate('Mapas', mapasRouteParams)}
                    >
                      <Text style={styles.verMaisText}>
                        Ver mais {mapas.length - 3} materiais
                      </Text>
                      <Ionicons name="chevron-forward-outline" size={20} color={semanticColors.primary.text} />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </SectionCard>
          </View>
        )}

        {activeTab === 'visitas' && (
          <View style={styles.tabContent}>
            <SectionCard>
              <View style={styles.detailSectionHeader}>
                <View style={styles.detailSectionTitleGroup}>
                  <View style={styles.detailSectionIcon}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.detailSectionTitle}>
                    {isProdutorView ? 'Histórico de visitas' : 'Visitas Técnicas'}
                  </Text>
                </View>
                <View style={styles.sectionActions}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{visitas.length}</Text>
                  </View>
                  {podeCriarVisitaNaFazenda && (
                    <TouchableOpacity
                      style={styles.newCadernoButton}
                      onPress={handleNovaVisita}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add-outline" size={16} color={colors.white} />
                      <Text style={styles.newCadernoButtonText}>Nova Visita</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {visitas.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="Nenhuma visita registrada"
                  message={mensagemSemVisita}
                  style={styles.emptyStateCompact}
                />
              ) : (
                visitaSections.map((section) => (
                  <View key={section.id} style={styles.visitGroup}>
                    <View style={styles.visitGroupHeader}>
                      <View style={styles.visitGroupHeading}>
                        <Text style={styles.visitGroupTitle}>{section.title}</Text>
                        <Text style={styles.visitGroupDescription}>{section.description}</Text>
                      </View>
                      <View style={styles.visitGroupCount}>
                        <Text style={styles.visitGroupCountText}>{section.items.length}</Text>
                      </View>
                    </View>

                    {section.items.map((v) => {
                      const objectiveLabel = getVisitaObjetivoLabel(v.objetivo);
                      const statusPresentation = getVisitaStatusPresentation(v);
                      const statusColor = getVisitaStatusColor(statusPresentation.tone);
                      const summary = resolveOperationalSummary([v.observacoes, v.recomendacoes]);

                      return (
                        <OperationalCard
                          key={v.id}
                          title={objectiveLabel}
                          icon="calendar-outline"
                          accentColor={colors.primary}
                          date={v.data_visita}
                          tags={[{ label: statusPresentation.label, color: statusColor }]}
                          metadata={[
                            { icon: 'person-outline', label: `Responsável: ${v.tecnico_responsavel || 'Não informado'}` },
                          ]}
                          summary={summary}
                          accessibilityLabel={`Abrir Visita, ${objectiveLabel}, status ${statusPresentation.label}`}
                          onPress={() => navigation.navigate('VisitaDetail', { visitaId: v.id })}
                        />
                      );
                    })}
                  </View>
                ))
              )}
            </SectionCard>
          </View>
        )}

        {activeTab === 'caderno' && (
          <View style={styles.tabContent}>
            <SectionCard>
              <View style={styles.detailSectionHeader}>
                <View style={styles.detailSectionTitleGroup}>
                  <View style={styles.detailSectionIcon}>
                    <Ionicons name="book-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.detailSectionTitle}>Caderno de Campo</Text>
                </View>
                <View style={styles.sectionActions}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{cadernos.length}</Text>
                  </View>
                  {podeMostrarCriarCaderno && (
                    <TouchableOpacity
                      style={styles.newCadernoButton}
                      onPress={handleNovoCaderno}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={16} color={colors.white} />
                      <Text style={styles.newCadernoButtonText}>{criarCadernoLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {cadernos.length === 0 ? (
                <EmptyState
                  icon="book-outline"
                  title="Nenhum registro de caderno"
                  message={mensagemSemCaderno}
                  actionLabel={podeMostrarCriarCaderno ? criarCadernoEmptyLabel : undefined}
                  actionIcon={podeMostrarCriarCaderno ? 'add' : undefined}
                  onActionPress={podeMostrarCriarCaderno ? handleNovoCaderno : undefined}
                  style={styles.emptyStateCompact}
                />
              ) : (
                cadernos.map((registro) => {
                  const tipoColor = getCadernoTipoColor(registro.tipo_atividade);
                  const areaFormatada = formatarAreaCaderno(registro.area_aplicada);
                  const produtos = Array.isArray(registro.produtos_utilizados)
                    ? registro.produtos_utilizados
                    : [];
                  const visivelParaProdutor = isCadernoVisivelParaProdutor(registro);
                  const periodoProdutivoLabel = getCadernoPeriodoProdutivoLabel(registro);

                  return (
                    <TouchableOpacity
                      key={registro.id}
                      style={styles.cadernoCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('CadernoDetail', { cadernoId: registro.id })}
                    >
                      <View style={styles.cadernoHeader}>
                        <View style={[styles.cadernoIcon, { backgroundColor: tipoColor + '20' }]}>
                          <Ionicons name="book-outline" size={22} color={tipoColor} />
                        </View>
                        <View style={styles.cadernoHeaderInfo}>
                          <Text style={styles.cadernoTitle} numberOfLines={1}>
                            {getCadernoTipoLabel(registro.tipo_atividade)}
                          </Text>
                          <Text style={styles.cadernoSubtitle} numberOfLines={1}>
                            {[getCadernoTalhaoLabel(registro), registro.colaborador_responsavel].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color={colors.muted} />
                      </View>

                      <View style={styles.cadernoMeta}>
                        <View style={styles.cadernoMetaItem}>
                          <Ionicons name="calendar-outline" size={15} color={colors.textLight} />
                          <Text style={styles.cadernoMetaText}>{formatarDataCaderno(registro.data_atividade)}</Text>
                        </View>
                        {areaFormatada && (
                          <View style={styles.cadernoMetaItem}>
                            <Ionicons name="resize-outline" size={15} color={colors.textLight} />
                            <Text style={styles.cadernoMetaText}>{areaFormatada}</Text>
                          </View>
                        )}
                        {periodoProdutivoLabel && (
                          <View style={styles.cadernoMetaItem}>
                            <Ionicons name="leaf-outline" size={15} color={colors.textLight} />
                            <Text style={styles.cadernoMetaText}>{periodoProdutivoLabel}</Text>
                          </View>
                        )}
                        <CadernoLocalizacaoBadge registro={registro} />
                        {user?.perfil !== 'produtor' && (
                          <View style={styles.cadernoMetaItem}>
                            <Ionicons
                              name={visivelParaProdutor ? 'eye-outline' : 'lock-closed-outline'}
                              size={15}
                              color={visivelParaProdutor ? colors.success : colors.warning}
                            />
                            <Text style={styles.cadernoMetaText}>
                              {getCadernoVisibilidadeLabel(registro)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {produtos.length > 0 && (
                        <Text style={styles.cadernoProdutos} numberOfLines={2}>
                          Produtos: {produtos.join(', ')}
                        </Text>
                      )}

                      {registro.observacoes && (
                        <Text style={styles.cadernoObservacoes} numberOfLines={2}>
                          {registro.observacoes}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </SectionCard>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Excluir Propriedade"
        message={integridadeExclusao.confirmationMessage}
        type="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogVisible(false)}
        loading={deleting}
      />
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
    paddingBottom: 32
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: typography.fontBody
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.card,
    padding: spacing.card,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.weightBold,
    color: colors.white
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 6
  },
  profileSubtitle: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 19,
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  profileLocation: {
    flex: 1,
    fontSize: typography.fontBody - 1,
    color: colors.muted,
    lineHeight: 18
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  editButton: {
    flex: 2,
    borderRadius: spacing.radius,
    overflow: 'hidden',
    ...shadows.md,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  editButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody,
    letterSpacing: 0.3,
  },
  deleteButton: {
    flex: 1,
    borderRadius: spacing.radius,
    overflow: 'hidden',
    ...shadows.md,
  },
  deleteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody,
    letterSpacing: 0.3,
  },
  statsCarousel: {
    marginBottom: 20,
  },
  statsContent: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  statCardCompact: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: 148,
    minHeight: 178,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIconCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValueCompact: {
    fontSize: 18,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  statLabelCompact: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    textAlign: 'center',
  },
  statMetaCompact: {
    marginTop: spacing.xs,
    fontSize: typography.fontCaption,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
  },
  tabsContainer: {
    backgroundColor: colors.accentDark,
    borderRadius: spacing.radius,
    marginBottom: spacing.lg,
  },
  tabsContent: {
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.card
  },
  tabIcon: {
    marginRight: 6
  },
  tabText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.muted
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weightBold
  },
  tabContent: {
    gap: spacing.md
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailSectionTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  detailSectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  infoBox: {
    marginBottom: spacing.md,
  },
  emptyStateCompact: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 16
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center'
  },
  countBadgeText: {
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.sm,
  },
  newCadernoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radiusSm,
  },
  newCadernoButtonText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  infoSection: {
    backgroundColor: colors.backgroundAlt,
    padding: 12,
    borderRadius: spacing.radiusSm,
    marginBottom: 16
  },
  relatedFarmsSection: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    marginBottom: 16,
    overflow: 'hidden',
  },
  relatedFarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  relatedFarmIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  relatedFarmInfo: {
    flex: 1,
    minWidth: 0,
  },
  relatedFarmName: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 2,
  },
  relatedFarmLocation: {
    fontSize: typography.fontCaption,
    color: colors.muted,
  },
  integrityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: 12,
    borderRadius: spacing.radiusSm,
    marginBottom: 16,
    borderWidth: 1,
  },
  integrityBoxOk: {
    backgroundColor: colors.successBg,
    borderColor: colors.success + '40',
  },
  integrityBoxBlocked: {
    backgroundColor: colors.amberLight,
    borderColor: colors.warning + '40',
  },
  integrityTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  integrityTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  integrityText: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    lineHeight: 20,
  },
  infoRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    lineHeight: 22,
  },
  attentionList: {
    gap: spacing.sm,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: semanticColors.warning.surface,
    borderWidth: 1,
    borderColor: semanticColors.warning.border,
  },
  attentionText: {
    flex: 1,
    color: semanticColors.warning.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    lineHeight: 20,
  },
  mockLinkNote: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  mockLinkGroup: {
    marginBottom: spacing.md,
  },
  mockLinkGroupTitle: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
    marginBottom: spacing.sm,
  },
  mockLinkEmpty: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
  },
  mockLinkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  mockLinkItemText: {
    flex: 1,
    minWidth: 0,
  },
  mockLinkName: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
  },
  mockLinkMeta: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    marginTop: 2,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundAlt,
    padding: 12,
    borderRadius: spacing.radiusSm,
    marginTop: 8
  },
  statusLabel: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.accent
  },
  statusText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  statusBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextInline: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  observacoesText: {
    fontSize: typography.fontBody,
    color: colors.text,
    lineHeight: 22,
  },
  periodoCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  periodoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  periodoIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodoInfo: {
    flex: 1,
    minWidth: 0,
  },
  periodoTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  periodoSubtitle: {
    marginTop: 2,
    fontSize: typography.fontCaption + 1,
    color: colors.muted,
  },
  periodoStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusSm,
    flexShrink: 0,
  },
  periodoStatusText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },
  periodoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  periodoMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  periodoMetaText: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
  },
  periodoObservacoes: {
    marginTop: spacing.xs,
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
  },
  mapaCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  mapaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  mapaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  mapaIcon: {
    fontSize: 24
  },
  mapaInfo: {
    flex: 1
  },
  mapaTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 2
  },
  mapaSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.muted
  },
  mapaDetails: {
    marginBottom: 12
  },
  mapaDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  mapaDetailItem: {
    fontSize: typography.fontCaption,
    color: colors.muted
  },
  mapaObservacoes: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    marginTop: 4
  },
  mapaButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: spacing.radiusSm,
    alignItems: 'center'
  },
  mapaButtonText: {
    color: colors.white,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold
  },
  visitGroup: {
    marginTop: spacing.md,
  },
  visitGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  visitGroupHeading: {
    flex: 1,
  },
  visitGroupTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  visitGroupDescription: {
    color: colors.textLight,
    fontSize: typography.fontCaption,
    marginTop: 2,
  },
  visitGroupCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  visitGroupCountText: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },
  cadernoCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: 12,
  },
  cadernoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cadernoIcon: {
    width: 42,
    height: 42,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cadernoHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  cadernoTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 2,
  },
  cadernoSubtitle: {
    fontSize: typography.fontCaption + 1,
    color: colors.muted,
  },
  cadernoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cadernoMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cadernoMetaText: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
  },
  cadernoProdutos: {
    fontSize: typography.fontCaption + 1,
    color: colors.text,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  cadernoObservacoes: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16
  },
  sectionHeaderSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  verTodosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verTodosText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  verMaisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: semanticColors.primary.surface,
    borderWidth: 1,
    borderColor: semanticColors.primary.border,
    borderRadius: 8,
    gap: spacing.xs,
  },
  verMaisText: {
    fontSize: typography.sizes.md,
    color: semanticColors.primary.text,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weightSemibold,
    marginBottom: 4
  },
  emptySubtext: {
    fontSize: typography.fontCaption,
    color: colors.mutedLight,
    textAlign: 'center'
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.lg,
  },
  emptyActionButtonText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  body: {
    fontSize: typography.fontBody,
    color: colors.text
  }
});
