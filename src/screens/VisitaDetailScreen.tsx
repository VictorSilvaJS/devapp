import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import RegistroFotoViewerModal from '../components/RegistroFotoViewerModal';
import VisitaLifecycleActions from '../components/VisitaLifecycleActions';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import { Visita, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import {
  avaliarAcessoVisita,
  podeEditarVisita,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { getVisitaFotoUri, getVisitaObjetivoLabel } from '../utils/visitaFormCompat';
import {
  getRegistroFotoNomeOriginal,
  getRegistroFotoUri,
  podeBaixarFotoRegistro,
} from '../utils/registroFotoCompat';
import {
  getVisitaStatusPresentation,
  VisitaStatusTone,
} from '../utils/visitaListCompat';
import {
  getVisitaCancelamentoMotivoLabel,
  getVisitaEstado,
  getVisitaEventLabel,
  toVisitaProducerProjection,
} from '../utils/visitaLifecycleCompat';

const { width } = Dimensions.get('window');

export default function VisitaDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();

  const { visitaId, id } = route.params || {};
  const visitaRouteId = visitaId || id;

  const [visita, setVisita] = useState(null);
  const [fazenda, setFazenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoLoadErrors, setPhotoLoadErrors] = useState<Record<number, boolean>>({});
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // Recarregar visita sempre que a tela ganhar foco (ex: ao voltar da edição)
  useFocusEffect(
    useCallback(() => {
      loadVisita();
    }, [visitaRouteId, user])
  );

  const loadVisita = async () => {
    setLoading(true);
    try {
      if (!visitaRouteId) {
        throw new Error('Visita não informada');
      }

      const [visitaData, fazendas] = await Promise.all([
        Visita.get(visitaRouteId),
        Produtor.list(),
      ]);

      const acesso = avaliarAcessoVisita(user, visitaData, fazendas);

      if (acesso.status !== 'permitido') {
        setVisita(null);
        setFazenda(null);
        toast.showWarning('Você não tem permissão para acessar esta visita.');
        navigation.goBack();
        return;
      }

      setVisita(user?.perfil === 'produtor' ? toVisitaProducerProjection(visitaData) : visitaData);
      setFazenda(acesso.fazenda);
      setPhotoLoadErrors({});
      setSelectedPhotoIndex(null);
    } catch (error) {
      console.error('Erro ao carregar visita:', error);
      toast.showError('Erro ao carregar detalhes da visita');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = () => {
    if (!canEdit()) {
      toast.showWarning('Você não tem permissão para editar esta visita.');
      return;
    }

    navigation.navigate('EditarVisita', { visitaId: visitaRouteId });
  };

  const handleConcluir = () => {
    if (!canEdit()) {
      toast.showWarning('Esta Visita não está disponível para conclusão.');
      return;
    }
    navigation.navigate('ConcluirVisita', { visitaId: visitaRouteId });
  };

  const handleCorrigir = () => {
    if (getVisitaEstado(visita) !== 'realizada' || !podeEditarVisita(user, visita, fazenda)) {
      toast.showWarning('Esta Visita não está disponível para correção.');
      return;
    }
    navigation.navigate('CorrigirVisita', { visitaId: visitaRouteId });
  };

  const getStatusColor = (tone: VisitaStatusTone) => {
    switch (tone) {
      case 'success': return colors.success;
      case 'danger': return colors.error;
      case 'warning': return colors.warning;
      case 'info': return colors.info;
      default: return colors.muted;
    }
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canEdit = () => {
    return getVisitaEstado(visita) === 'agendada' && podeEditarVisita(user, visita, fazenda);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Detalhes da Visita" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (!visita) {
    return (
      <View style={styles.container}>
        <Header title="Detalhes da Visita" showBack />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Visita não encontrada</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = fazenda ? getFazendaUiInfo(fazenda) : null;
  const statusPresentation = getVisitaStatusPresentation(visita);
  const estado = getVisitaEstado(visita);
  const isProdutorView = user?.perfil === 'produtor';
  const eventos = Array.isArray(visita.eventos_visita) ? visita.eventos_visita : [];
  const complementos = Array.isArray(visita.complementos_visita) ? visita.complementos_visita : [];
  const canCommand = podeEditarVisita(user, visita, fazenda)
    && estado != null
    && ['agendada', 'realizada', 'cancelada'].includes(estado);
  const selectedPhoto = selectedPhotoIndex == null ? null : visita.fotos?.[selectedPhotoIndex];
  const selectedPhotoUri = getRegistroFotoUri(selectedPhoto);
  const selectedPhotoFileName = getRegistroFotoNomeOriginal(selectedPhoto);
  const canDownloadSelectedPhoto = selectedPhotoIndex != null && podeBaixarFotoRegistro({
    user,
    registro: visita,
    fazenda,
    origem: 'visita',
    foto: selectedPhoto,
  });
  const handleScheduleFromCancelled = () => {
    if (!fazendaInfo?.id || estado !== 'cancelada' || !canCommand) return;
    navigation.navigate('NovaVisita', {
      propriedadeId: fazendaInfo.id,
      visitaOrigemId: visitaRouteId,
    });
  };

  return (
    <View style={styles.container}>
      <Header title="Detalhes da Visita" showBack />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(statusPresentation.tone) }]}>
            <Text style={styles.statusText}>{statusPresentation.label}</Text>
          </View>
        </View>

        {/* Informações da Propriedade */}
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
                <Text style={styles.fazendaSubtext}>
                  {fazendaInfo.localizacao}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Informações da Visita */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Informações da Visita</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {estado === 'agendada' ? 'Agendada para' : 'Data de referência'}
              </Text>
              <Text style={styles.infoValue}>{formatDateTime(visita.agendada_para || visita.data_visita)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Técnico Responsável</Text>
              <Text style={styles.infoValue}>{visita.tecnico_responsavel}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="flag" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Objetivo</Text>
              <Text style={styles.infoValue}>{getVisitaObjetivoLabel(visita.objetivo)}</Text>
            </View>
          </View>

          {visita.clima && (
            <View style={styles.infoRow}>
              <Ionicons name="partly-sunny" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Clima</Text>
                <Text style={styles.infoValue}>{visita.clima}</Text>
              </View>
            </View>
          )}
        </View>

        {estado === 'realizada' || estado === 'anulada' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
              <Text style={styles.cardTitle}>Conclusão</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Início real</Text>
                <Text style={styles.infoValue}>{formatDateTime(visita.inicio_real_em)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Concluída em</Text>
                <Text style={styles.infoValue}>{formatDateTime(visita.concluida_em)}</Text>
              </View>
            </View>
            {visita.responsavel_executante_nome ? (
              <View style={styles.infoRow}>
                <Ionicons name="person-circle-outline" size={20} color={colors.muted} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Responsável executante</Text>
                  <Text style={styles.infoValue}>{visita.responsavel_executante_nome}</Text>
                </View>
              </View>
            ) : null}
            {visita.resumo_conclusao ? (
              <View style={styles.summaryBox}>
                <Text style={styles.infoLabel}>Resumo operacional</Text>
                <Text style={styles.textContent}>{visita.resumo_conclusao}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {estado === 'cancelada' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="close-circle-outline" size={24} color={colors.error} />
              <Text style={styles.cardTitle}>Cancelamento</Text>
            </View>
            <Text style={styles.infoLabel}>Motivo</Text>
            <Text style={styles.infoValue}>
              {getVisitaCancelamentoMotivoLabel(visita.cancelamento_motivo_codigo)}
            </Text>
            {visita.cancelamento_motivo_descricao ? (
              <Text style={[styles.textContent, styles.detailSpacing]}>
                {visita.cancelamento_motivo_descricao}
              </Text>
            ) : null}
            {visita.cancelada_em ? (
              <Text style={styles.auditMeta}>Cancelada em {formatDateTime(visita.cancelada_em)}</Text>
            ) : null}
          </View>
        ) : null}

        {estado === 'anulada' ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
              <Text style={styles.cardTitle}>Anulação</Text>
            </View>
            <Text style={styles.textContent}>{visita.anulacao_motivo || 'Justificativa não informada.'}</Text>
            {visita.anulada_em ? (
              <Text style={styles.auditMeta}>Anulada em {formatDateTime(visita.anulada_em)}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Observações */}
        {visita.observacoes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Observações</Text>
            </View>
            <Text style={styles.textContent}>{visita.observacoes}</Text>
          </View>
        )}

        {/* Recomendações */}
        {visita.recomendacoes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Recomendações Técnicas</Text>
            </View>
            <Text style={styles.textContent}>{visita.recomendacoes}</Text>
          </View>
        )}

        {/* Próxima Visita */}
        {visita.proximaVisita && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="arrow-forward-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Próxima Visita Sugerida</Text>
            </View>
            <Text style={styles.textContent}>{formatDate(visita.proximaVisita)}</Text>
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
                  {[complemento.autor_nome, formatDateTime(complemento.criado_em)].filter(Boolean).join(' • ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!isProdutorView ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Histórico da Visita</Text>
            </View>
            {eventos.length > 0 ? eventos.slice().reverse().map((evento, index) => (
              <View key={evento.evento_id || index} style={styles.auditItem}>
                <Text style={styles.infoValue}>{getVisitaEventLabel(evento.tipo)}</Text>
                <Text style={styles.auditMeta}>
                  {[evento.autor_nome || evento.autor_perfil, formatDateTime(evento.ocorrido_em)].filter(Boolean).join(' • ')}
                  {evento.versao_resultante ? ` • versão ${evento.versao_resultante}` : ''}
                </Text>
                {evento.motivo ? <Text style={styles.textContent}>Motivo: {evento.motivo}</Text> : null}
                {evento.antes && evento.depois ? (
                  <Text style={styles.auditDiff}>Antes/depois preservado para {Object.keys(evento.depois).join(', ')}.</Text>
                ) : null}
              </View>
            )) : (
              <Text style={styles.legacyHint}>
                Registro legado: o histórico anterior não existia e não foi inventado.
              </Text>
            )}
          </View>
        ) : null}

        {canCommand && fazendaInfo ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="settings-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Ações da Visita</Text>
            </View>
            <Text style={styles.actionHint}>
              As ações principais abrem uma tela de revisão. Ações curtas pedem apenas a informação necessária.
            </Text>
            <VisitaLifecycleActions
              visita={visita}
              user={user}
              fazendaId={String(fazendaInfo.id)}
              fazendaLabel={fazendaInfo.fazendaNome}
              onUpdated={setVisita}
              onConclude={handleConcluir}
              onCorrect={handleCorrigir}
              onScheduleFromCancelled={handleScheduleFromCancelled}
            />
          </View>
        ) : null}

        {/* Fotos */}
        {visita.fotos && visita.fotos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Imagens do registro ({visita.fotos.length})</Text>
            </View>
            <Text style={styles.photoNotice}>
              {visita.fotos.some((foto) => getRegistroFotoNomeOriginal(foto))
                ? 'Fotos salvas localmente neste aparelho'
                : 'Imagens demonstrativas do registro'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosContainer}
              contentContainerStyle={styles.photosContent}
            >
              {visita.fotos.map((foto, index) => {
                const fotoUri = getVisitaFotoUri(foto);
                const imagemIndisponivel = !fotoUri || photoLoadErrors[index];

                return (
                  <View key={`${fotoUri || 'imagem'}_${index}`} style={styles.photoItem}>
                    {imagemIndisponivel ? (
                      <View style={[styles.photo, styles.photoUnavailable]}>
                        <Ionicons name="image-outline" size={32} color={colors.muted} />
                        <Text style={styles.photoUnavailableText}>Imagem indisponível</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setSelectedPhotoIndex(index)}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Ampliar imagem ${index + 1} do registro`}
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
                    <Text style={styles.photoCaption} numberOfLines={1}>
                      {getRegistroFotoNomeOriginal(foto) || 'Exemplo visual do registro'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {canEdit() ? (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleEditar}>
            <Ionicons name="create-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Editar agendamento</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <RegistroFotoViewerModal
        visible={selectedPhotoIndex != null}
        uri={selectedPhotoUri}
        title="Imagem da Visita"
        origem="visita"
        index={selectedPhotoIndex ?? 0}
        total={visita.fotos?.length ?? 0}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
  actionHint: {
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 19,
    marginBottom: spacing.md,
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
  textContent: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22,
  },
  summaryBox: {
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  detailSpacing: {
    marginTop: spacing.sm,
  },
  auditItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  auditMeta: {
    marginTop: spacing.xs,
    fontSize: typography.fontSmall,
    color: colors.muted,
    lineHeight: 18,
  },
  auditDiff: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
    lineHeight: 18,
  },
  legacyHint: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
    lineHeight: 20,
  },
  photosContainer: {
    marginTop: spacing.sm,
  },
  photosContent: {
    gap: spacing.md,
  },
  photoNotice: {
    color: colors.textLight,
    fontSize: typography.fontSmall,
    lineHeight: 18,
  },
  photoItem: {
    width: width * 0.6,
  },
  photo: {
    width: '100%',
    height: width * 0.4,
    borderRadius: spacing.radiusSm,
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
  photoUnavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoUnavailableText: {
    color: colors.textLight,
    fontSize: typography.fontSmall,
  },
  photoCaption: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.fontCaption,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
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
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radiusSm,
    gap: spacing.sm,
    minWidth: '47%',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  successButton: {
    backgroundColor: colors.success,
  },
  warningButton: {
    backgroundColor: colors.warning,
  },
  dangerButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
  },
});
