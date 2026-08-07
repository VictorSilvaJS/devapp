import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import RegistroFotoViewerModal from '../components/RegistroFotoViewerModal';
import CadernoAuditActions from '../components/CadernoAuditActions';
import CadernoLocalizacaoPreview from '../components/CadernoLocalizacaoPreview';
import { useToast } from '../components/Toast';
import { CadernoCampo, LimiteArea, Produtor, User } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import {
  avaliarAcessoCaderno,
  podeEditarCadernoEmFazenda,
  podeExecutarComandoCaderno,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  getCadernoTalhaoLabel,
  getCadernoPeriodoProdutivoLabel,
  getCadernoOrigemLabel,
  getCadernoRegistradoPorLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoRegistradoPeloProdutor,
  isCadernoTalhaoLegado,
  isCadernoVisivelParaProdutor,
} from '../utils/cadernoFormCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { buildFazendaMapaRouteParamsFromPropriedade } from '../navigation/mapaRouteCompat';
import { normalizeCadernoLocalizacao } from '../utils/cadernoLocalizacaoCompat';
import { getCadernoLocalizacaoPresentation } from '../utils/cadernoLocalizacaoUiCompat';
import {
  getCadernoLocalizacaoRelacaoLabel,
  normalizeCadernoLocalizacaoSpatialAssessment,
  resolveCadernoTalhaoGeometry,
} from '../utils/cadernoLocalizacaoSpatialCompat';
import { formatAreaHa, normalizeAreaValue } from '../utils/talhaoMedidasCompat';
import {
  getCadernoEstado,
  getCadernoEstadoLabel,
  toCadernoProducerProjection,
} from '../utils/cadernoLifecycleCompat';
import {
  getRegistroFotoNomeOriginal,
  getRegistroFotoUri,
  podeBaixarFotoRegistro,
} from '../utils/registroFotoCompat';

const { width } = Dimensions.get('window');

export default function CadernoDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { user } = useAuth();

  const { cadernoId, registroId, id } = route.params || {};
  const cadernoRouteId = cadernoId || registroId || id;

  const [registro, setRegistro] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTechnicalLocation, setShowTechnicalLocation] = useState(false);
  const [photoLoadErrors, setPhotoLoadErrors] = useState<Record<number, boolean>>({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRegistro();
    }, [cadernoRouteId, user])
  );

  const loadRegistro = async () => {
    setLoading(true);
    try {
      if (!cadernoRouteId) {
        throw new Error('Registro de caderno não informado');
      }

      const [registroData, fazendas, usuariosData, limitesData] = await Promise.all([
        CadernoCampo.get(cadernoRouteId),
        Produtor.list(),
        user?.perfil === 'produtor' ? Promise.resolve([]) : User.list().catch(() => []),
        LimiteArea.list().catch(() => []),
      ]);

      const acesso = avaliarAcessoCaderno(user, registroData, fazendas);

      if (acesso.status !== 'permitido') {
        setRegistro(null);
        setFazenda(null);
        setUsuarios([]);
        setTalhoes([]);
        toast.showWarning('Você não tem permissão para acessar este registro.');
        navigation.goBack();
        return;
      }

      setRegistro(user?.perfil === 'produtor' ? toCadernoProducerProjection(registroData) : registroData);
      setFazenda(acesso.fazenda);
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setTalhoes(Array.isArray(limitesData) ? limitesData : []);
      setShowTechnicalLocation(false);
      setPhotoLoadErrors({});
      setSelectedPhotoIndex(null);
    } catch (error) {
      console.error('Erro ao carregar registro de caderno:', error);
      toast.showError('Erro ao carregar detalhe do caderno');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

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
      outro: colors.muted,
    };
    return cores[tipo] || colors.muted;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatArea = (area) => {
    return normalizeAreaValue(area) == null ? null : formatAreaHa(area);
  };

  const canEdit = () => podeEditarCadernoEmFazenda(user, registro, fazenda);
  const canCommand = () => podeExecutarComandoCaderno(user, registro, fazenda);

  const handleEditar = () => {
    if (!canEdit()) {
      toast.showWarning('Você não tem permissão para editar este registro.');
      return;
    }

    navigation.navigate('EditarCaderno', { cadernoId: cadernoRouteId });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Detalhe do Caderno" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando registro...</Text>
        </View>
      </View>
    );
  }

  if (!registro) {
    return (
      <View style={styles.container}>
        <Header title="Detalhe do Caderno" showBack />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Registro não encontrado</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = fazenda ? getFazendaUiInfo(fazenda) : null;
  const tipoColor = getTipoColor(registro.tipo_atividade);
  const areaFormatada = formatArea(registro.area_aplicada);
  const produtividadeFormatada = normalizeAreaValue(registro.produtividade);
  const visivelParaProdutor = isCadernoVisivelParaProdutor(registro);
  const visibilidadeColor = visivelParaProdutor ? colors.success : colors.warning;
  const tipoLabel = getCadernoTipoLabel(registro.tipo_atividade);
  const periodoProdutivoLabel = getCadernoPeriodoProdutivoLabel(registro);
  const registradoPeloProdutor = isCadernoRegistradoPeloProdutor(registro);
  const registradoPorLabel = getCadernoRegistradoPorLabel(registro);
  const talhaoLegado = isCadernoTalhaoLegado(registro);
  const fotos = Array.isArray(registro.fotos) ? registro.fotos : [];
  const produtos = Array.isArray(registro.produtos_utilizados) ? registro.produtos_utilizados : [];
  const localizacao = normalizeCadernoLocalizacao(registro);
  const localizacaoPresentation = getCadernoLocalizacaoPresentation(localizacao);
  const localizacaoSpatial = normalizeCadernoLocalizacaoSpatialAssessment(registro);
  const localizacaoRelacaoLabel = getCadernoLocalizacaoRelacaoLabel(registro);
  const localizacaoGeometry = resolveCadernoTalhaoGeometry(
    talhoes,
    localizacaoSpatial?.talhao_geometria_versao_id || registro.talhao_id || registro.talhaoId
  );
  const usuarioCaptura = localizacao?.localizacao_captured_by
    ? usuarios.find((usuario) => String(usuario?.id || '').trim() === localizacao.localizacao_captured_by)
    : null;
  const nomeUsuarioCaptura = String(usuarioCaptura?.nome || usuarioCaptura?.full_name || '').trim();
  const estado = getCadernoEstado(registro);
  const complementos = Array.isArray(registro.complementos_caderno) ? registro.complementos_caderno : [];
  const eventos = Array.isArray(registro.eventos_caderno) ? registro.eventos_caderno : [];
  const isProdutorView = user?.perfil === 'produtor';
  const selectedPhoto = selectedPhotoIndex == null ? null : fotos[selectedPhotoIndex];
  const selectedPhotoUri = getRegistroFotoUri(selectedPhoto);
  const selectedPhotoFileName = getRegistroFotoNomeOriginal(selectedPhoto);
  const canDownloadSelectedPhoto = selectedPhotoIndex != null && podeBaixarFotoRegistro({
    user,
    registro,
    fazenda,
    origem: 'caderno',
    foto: selectedPhoto,
  });
  const handleVerNoMapa = () => {
    if (!localizacao || !fazenda) return;
    const params = buildFazendaMapaRouteParamsFromPropriedade(fazenda, {
      talhaoId: localizacaoGeometry?.geometryVersionId || registro.talhao_id || registro.talhaoId,
      talhaoNome: registro.talhao_nome || registro.talhao,
      talhao: registro.talhao_nome || registro.talhao,
      talhaoAno: localizacaoGeometry?.year ? String(localizacaoGeometry.year) : undefined,
      cadernoLatitude: localizacao.localizacao_latitude,
      cadernoLongitude: localizacao.localizacao_longitude,
      cadernoAccuracy: localizacao.localizacao_accuracy,
      cadernoCapturedAt: localizacao.localizacao_captured_at,
    });
    navigation.navigate('FazendaMapa', params);
  };

  return (
    <View style={styles.container}>
      <Header title="Detalhe do Caderno" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusContainer}>
          <View style={[styles.visibilityBadge, { backgroundColor: semanticColors.primary.surface }]}>
            <Ionicons name={estado === 'rascunho' ? 'document-outline' : 'shield-checkmark-outline'} size={16} color={semanticColors.primary.text} />
            <Text style={[styles.visibilityText, { color: semanticColors.primary.text }]}>
              {getCadernoEstadoLabel(registro)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tipoColor }]}>
            <Text style={styles.statusText}>{tipoLabel}</Text>
          </View>
          {!isProdutorView && <View style={[styles.visibilityBadge, { backgroundColor: visibilidadeColor + '20' }]}>
            <Ionicons
              name={visivelParaProdutor ? 'eye-outline' : 'lock-closed-outline'}
              size={16}
              color={visibilidadeColor}
            />
            <Text style={[styles.visibilityText, { color: visibilidadeColor }]}>
              {getCadernoVisibilidadeLabel(registro)}
            </Text>
          </View>}
          {registradoPeloProdutor && (
            <View style={[styles.visibilityBadge, { backgroundColor: semanticColors.primary.surface }]}>
              <Ionicons name="person-outline" size={16} color={semanticColors.primary.text} />
              <Text style={[styles.visibilityText, { color: semanticColors.primary.text }]}>
                {getCadernoOrigemLabel(registro)}
              </Text>
            </View>
          )}
        </View>

        {fazenda && fazendaInfo && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Propriedade</Text>
            </View>
            <TouchableOpacity
              style={styles.fazendaInfo}
              onPress={() => {
                const params = buildPropriedadeDetailRouteParams(fazenda);
                if (params) navigation.navigate('ProdutorDetail', params);
              }}
            >
              <View style={styles.fazendaDetails}>
                <Text style={styles.fazendaNome}>{fazendaInfo.fazendaNome}</Text>
                <Text style={styles.fazendaSubtext}>{fazendaInfo.titularNome}</Text>
                <Text style={styles.fazendaSubtext}>{fazendaInfo.localizacao}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Registro de Campo</Text>
          </View>

          {!isProdutorView && <View style={styles.infoRow}>
            <Ionicons name="pricetag" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tipo de registro</Text>
              <Text style={styles.infoValue}>{tipoLabel}</Text>
            </View>
          </View>}

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Data do registro</Text>
              <Text style={styles.infoValue}>{formatDate(registro.data_atividade)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Executado por</Text>
              <Text style={styles.infoValue}>{registro.colaborador_responsavel || '-'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="create-outline" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Registrado por</Text>
              <Text style={styles.infoValue}>{registradoPorLabel}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Talhão</Text>
              <Text style={styles.infoValue}>{getCadernoTalhaoLabel(registro)}</Text>
              {talhaoLegado ? (
                <Text style={styles.referenceHint}>Referência legada em texto</Text>
              ) : null}
            </View>
          </View>

          {periodoProdutivoLabel ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Safra/Safrinha</Text>
                <Text style={styles.infoValue}>{periodoProdutivoLabel}</Text>
              </View>
            </View>
          ) : null}

          {areaFormatada && (
            <View style={styles.infoRow}>
              <Ionicons name="expand" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Área Aplicada</Text>
                <Text style={styles.infoValue}>{areaFormatada}</Text>
              </View>
            </View>
          )}

          {registro.operacao ? (
            <View style={styles.infoRow}>
              <Ionicons name="construct-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Operação</Text>
                <Text style={styles.infoValue}>{registro.operacao}</Text>
              </View>
            </View>
          ) : null}

          {produtividadeFormatada != null ? (
            <View style={styles.infoRow}>
              <Ionicons name="trending-up-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Produtividade</Text>
                <Text style={styles.infoValue}>{String(registro.produtividade).replace('.', ',')}</Text>
              </View>
            </View>
          ) : null}

          {registro.data_criacao && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Criado em</Text>
                <Text style={styles.infoValue}>{formatDate(registro.data_criacao)}</Text>
              </View>
            </View>
          )}
        </View>

        {localizacao ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pin-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Ponto registrado em campo</Text>
            </View>

            <CadernoLocalizacaoPreview registro={registro} geometry={localizacaoGeometry} />

            {localizacaoRelacaoLabel ? (
              <View style={[
                styles.spatialStatus,
                localizacaoSpatial?.localizacao_relacao_talhao === 'fora'
                  ? styles.spatialStatusDanger
                  : localizacaoSpatial?.localizacao_relacao_talhao === 'proximo'
                    ? styles.spatialStatusWarning
                    : styles.spatialStatusSuccess,
              ]}>
                <Ionicons
                  name={localizacaoSpatial?.localizacao_relacao_talhao === 'fora'
                    ? 'alert-circle-outline'
                    : localizacaoSpatial?.localizacao_relacao_talhao === 'proximo'
                      ? 'navigate-circle-outline'
                      : 'checkmark-circle-outline'}
                  size={21}
                  color={localizacaoSpatial?.localizacao_relacao_talhao === 'fora'
                    ? colors.error
                    : localizacaoSpatial?.localizacao_relacao_talhao === 'proximo'
                      ? colors.warning
                      : colors.success}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.spatialStatusTitle}>{localizacaoRelacaoLabel}</Text>
                  <Text style={styles.spatialStatusText}>
                    Avaliação considera o ponto, a precisão informada e a tolerância local.
                  </Text>
                </View>
              </View>
            ) : registro.talhao_id || registro.talhaoId ? (
              <View style={[styles.spatialStatus, styles.spatialStatusNeutral]}>
                <Ionicons name="information-circle-outline" size={21} color={colors.info} />
                <Text style={styles.spatialStatusText}>
                  Relação com o Talhão não avaliada neste registro.
                </Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Ionicons name="locate-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Precisão informada</Text>
                <Text style={styles.infoValue}>
                  {localizacaoPresentation?.accuracyValueText}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Capturada em</Text>
                <Text style={styles.infoValue}>{localizacaoPresentation?.capturedAtText}</Text>
              </View>
            </View>

            {localizacaoPresentation?.lowAccuracy ? (
              <View style={styles.lowAccuracyWarning}>
                <Ionicons name="warning-outline" size={20} color={colors.warning} />
                <Text style={styles.lowAccuracyText}>
                  Baixa precisão na leitura. Confirme o local no mapa antes de usar este ponto como referência.
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.mapButton}
              onPress={handleVerNoMapa}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="Ver ponto registrado no mapa"
            >
              <Ionicons name="map-outline" size={19} color={colors.white} />
              <Text style={styles.mapButtonText}>Ver no mapa</Text>
            </TouchableOpacity>

            {!isProdutorView ? (
              <TouchableOpacity
                style={styles.technicalToggle}
                onPress={() => setShowTechnicalLocation((current) => !current)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityState={{ expanded: showTechnicalLocation }}
              >
                <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
                <Text style={styles.technicalToggleText}>Detalhes técnicos</Text>
                <Ionicons
                  name={showTechnicalLocation ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : null}

            {!isProdutorView && showTechnicalLocation ? (
              <View style={styles.technicalDetails}>
                <View style={styles.technicalRow}>
                  <Text style={styles.infoLabel}>Latitude</Text>
                  <Text style={styles.infoValue}>{localizacaoPresentation?.latitudeText}</Text>
                </View>
                <View style={styles.technicalRow}>
                  <Text style={styles.infoLabel}>Longitude</Text>
                  <Text style={styles.infoValue}>{localizacaoPresentation?.longitudeText}</Text>
                </View>
                {nomeUsuarioCaptura ? (
                  <View style={styles.technicalRow}>
                    <Text style={styles.infoLabel}>Capturada por</Text>
                    <Text style={styles.infoValue}>{nomeUsuarioCaptura}</Text>
                  </View>
                ) : null}
                {localizacaoSpatial ? (
                  <>
                    <View style={styles.technicalRow}>
                      <Text style={styles.infoLabel}>Versão da geometria</Text>
                      <Text style={styles.infoValue}>{localizacaoSpatial.talhao_geometria_versao_id}</Text>
                    </View>
                    <View style={styles.technicalRow}>
                      <Text style={styles.infoLabel}>Fonte da geometria</Text>
                      <Text style={styles.infoValue}>
                        {localizacaoSpatial.talhao_geometria_fonte === 'geojson_local'
                          ? 'GeoJSON local'
                          : 'Demarcação local'}
                      </Text>
                    </View>
                    <View style={styles.technicalRow}>
                      <Text style={styles.infoLabel}>Distância ao limite</Text>
                      <Text style={styles.infoValue}>
                        {String(localizacaoSpatial.localizacao_distancia_talhao_m).replace('.', ',')} m
                      </Text>
                    </View>
                    <View style={styles.technicalRow}>
                      <Text style={styles.infoLabel}>Tolerância aplicada</Text>
                      <Text style={styles.infoValue}>
                        {String(localizacaoSpatial.localizacao_tolerancia_talhao_m).replace('.', ',')} m
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.locationExplanation}>
              A posição representa a leitura aproximada informada pelo aparelho no momento do registro. O aplicativo não acompanha deslocamentos.
            </Text>
          </View>
        ) : null}

        {produtos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flask-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Produtos</Text>
            </View>
            <View style={styles.productList}>
              {produtos.map((produto, index) => (
                <View key={`${produto}-${index}`} style={styles.productChip}>
                  <Text style={styles.productText}>{produto}</Text>
                </View>
              ))}
            </View>
            {registro.dosagem && (
              <View style={styles.dosageBox}>
                <Text style={styles.infoLabel}>Dosagem</Text>
                <Text style={styles.infoValue}>{registro.dosagem}</Text>
              </View>
            )}
          </View>
        )}

        {registro.condicoes_clima && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="partly-sunny-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Condições Climáticas</Text>
            </View>
            <Text style={styles.textContent}>{registro.condicoes_clima}</Text>
          </View>
        )}

        {registro.observacoes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Observações</Text>
            </View>
            <Text style={styles.textContent}>{registro.observacoes}</Text>
          </View>
        )}

        {complementos.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Complementos técnicos</Text>
            </View>
            {complementos.map((complemento, index) => (
              <View key={complemento.complemento_id || index} style={styles.auditItem}>
                <Text style={styles.textContent}>{complemento.texto}</Text>
                <Text style={styles.auditMeta}>
                  {[complemento.autor_nome, formatDate(complemento.criado_em)].filter(Boolean).join(' • ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!isProdutorView && eventos.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Histórico de auditoria</Text>
            </View>
            {estado !== 'rascunho' && registro.conteudo_original ? (
              <Text style={styles.originalHint}>Conteúdo original e localização preservados desde o envio.</Text>
            ) : null}
            {eventos.slice().reverse().map((evento, index) => (
              <View key={evento.evento_id || index} style={styles.auditItem}>
                <Text style={styles.infoValue}>{String(evento.tipo || 'evento').replace(/_/g, ' ')}</Text>
                <Text style={styles.auditMeta}>
                  {[evento.autor_nome || evento.autor_perfil, formatDate(evento.ocorrido_em)].filter(Boolean).join(' • ')}
                  {evento.versao_resultante ? ` • versão ${evento.versao_resultante}` : ''}
                </Text>
                {evento.motivo ? <Text style={styles.textContent}>Motivo: {evento.motivo}</Text> : null}
                {evento.antes && evento.depois ? (
                  <Text style={styles.auditDiff}>Antes/depois registrado para {Object.keys(evento.depois).join(', ')}.</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {canCommand() ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="settings-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Ações auditáveis</Text>
            </View>
            <CadernoAuditActions
              registro={registro}
              user={user}
              fazendaId={String(fazendaInfo?.id || '')}
              onUpdated={setRegistro}
            />
          </View>
        ) : null}

        {fotos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Fotos ({fotos.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
              {fotos.map((foto, index) => {
                const fotoUri = getRegistroFotoUri(foto);
                const imageUnavailable = !fotoUri || photoLoadErrors[index];

                return (
                  <View key={`${fotoUri || 'imagem'}-${index}`} style={styles.photoItem}>
                    {imageUnavailable ? (
                      <View style={[styles.photo, styles.photoUnavailable]}>
                        <Ionicons name="image-outline" size={32} color={colors.muted} />
                        <Text style={styles.photoUnavailableText}>Imagem indisponível</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setSelectedPhotoIndex(index)}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Ampliar foto ${index + 1} do Caderno`}
                      >
                        <Image
                          source={{ uri: fotoUri }}
                          style={styles.photo}
                          resizeMode="cover"
                          onError={() => setPhotoLoadErrors((current) => ({ ...current, [index]: true }))}
                        />
                        <View style={styles.photoExpandBadge}>
                          <Ionicons name="expand-outline" size={18} color={colors.card} />
                          <Text style={styles.photoExpandText}>Ampliar</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {canEdit() && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditar}>
            <Ionicons name="create-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
        </View>
      )}

      <RegistroFotoViewerModal
        visible={selectedPhotoIndex != null}
        uri={selectedPhotoUri}
        title="Foto do Caderno"
        origem="caderno"
        index={selectedPhotoIndex ?? 0}
        total={fotos.length}
        downloadAuthorized={canDownloadSelectedPhoto}
        preferredFileName={selectedPhotoFileName}
        onClose={() => setSelectedPhotoIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontBody,
    color: colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  statusText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
    textTransform: 'uppercase',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusSm,
  },
  visibilityText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: '700',
    color: colors.text,
  },
  fazendaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fazendaDetails: {
    flex: 1,
  },
  fazendaNome: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  fazendaSubtext: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
  },
  referenceHint: {
    marginTop: spacing.xs,
    fontSize: typography.fontSmall,
    color: colors.warning,
  },
  spatialStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
  },
  spatialStatusSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  spatialStatusWarning: {
    backgroundColor: colors.amberLight,
    borderColor: colors.warning,
  },
  spatialStatusDanger: {
    backgroundColor: colors.errorBgLight,
    borderColor: colors.errorBorder,
  },
  spatialStatusNeutral: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info,
  },
  spatialStatusTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  spatialStatusText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontSmall,
    lineHeight: 18,
  },
  lowAccuracyWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.amberLight,
  },
  lowAccuracyText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontSmall,
    lineHeight: 18,
  },
  mapButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  mapButtonText: {
    color: colors.white,
    fontSize: typography.fontBody - 1,
    fontWeight: '700',
  },
  technicalToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  technicalToggleText: {
    flex: 1,
    color: colors.primary,
    fontSize: typography.fontBody - 1,
    fontWeight: '700',
  },
  technicalDetails: {
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  technicalRow: {
    gap: spacing.xs,
  },
  locationExplanation: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
    lineHeight: 19,
  },
  productList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  productChip: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
    borderWidth: 1,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  productText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  dosageBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  textContent: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22,
  },
  originalHint: {
    fontSize: typography.fontSmall,
    color: colors.success,
    marginBottom: spacing.md,
  },
  auditItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  auditMeta: {
    fontSize: typography.fontSmall,
    color: colors.muted,
  },
  auditDiff: {
    fontSize: typography.fontSmall,
    color: colors.info,
  },
  photosContainer: {
    marginTop: spacing.sm,
  },
  photoItem: {
    marginRight: spacing.md,
  },
  photo: {
    width: width * 0.6,
    height: width * 0.4,
    borderRadius: spacing.radiusSm,
  },
  photoUnavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundNeutral,
  },
  photoUnavailableText: {
    color: colors.muted,
    fontSize: typography.fontCaption,
  },
  photoExpandBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: spacing.radiusSm,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  photoExpandText: {
    color: colors.card,
    fontSize: typography.fontCaption,
    fontWeight: '700',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.radiusSm,
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
  },
});
