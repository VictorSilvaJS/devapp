import React, { useState, useEffect, useCallback } from 'react';
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
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import { Visita, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';

const { width } = Dimensions.get('window');

export default function VisitaDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();

  const { visitaId } = route.params || {};

  const [visita, setVisita] = useState(null);
  const [produtor, setProdutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados de modais
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Recarregar visita sempre que a tela ganhar foco (ex: ao voltar da edição)
  useFocusEffect(
    useCallback(() => {
      if (visitaId) loadVisita();
    }, [visitaId])
  );

  const loadVisita = async () => {
    setLoading(true);
    try {
      const visitaData = await Visita.get(visitaId);
      setVisita(visitaData);

      if (visitaData?.produtor_id) {
        const produtorData = await Produtor.get(visitaData.produtor_id);
        setProdutor(produtorData);
      }
    } catch (error) {
      console.error('Erro ao carregar visita:', error);
      toast.showError('Erro ao carregar detalhes da visita');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarRealizada = async () => {
    setActionLoading(true);
    try {
      await Visita.update(visitaId, { status: 'realizada' });
      toast.showSuccess('Visita marcada como realizada!');
      await loadVisita();
    } catch (error) {
      console.error('Erro ao atualizar visita:', error);
      toast.showError('Erro ao atualizar status da visita');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelar = async () => {
    setActionLoading(true);
    try {
      await Visita.update(visitaId, { status: 'cancelada' });
      toast.showSuccess('Visita cancelada');
      setShowCancelDialog(false);
      await loadVisita();
    } catch (error) {
      console.error('Erro ao cancelar visita:', error);
      toast.showError('Erro ao cancelar visita');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluir = async () => {
    setActionLoading(true);
    try {
      await Visita.delete(visitaId);
      toast.showSuccess('Visita excluída');
      setShowDeleteDialog(false);
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao excluir visita:', error);
      toast.showError('Erro ao excluir visita');
      setActionLoading(false);
    }
  };

  const handleEditar = () => {
    navigation.navigate('EditarVisita', { visitaId });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'realizada': return colors.success;
      case 'cancelada': return colors.error;
      case 'agendada': return colors.warning;
      default: return colors.muted;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'realizada': return 'Realizada';
      case 'cancelada': return 'Cancelada';
      case 'agendada': return 'Agendada';
      default: return status;
    }
  };

  const getObjetivoLabel = (objetivo) => {
    const map = {
      consultoria: 'Consultoria Técnica',
      coleta_solo: 'Coleta de Solo',
      avaliacao_cultivo: 'Avaliação de Cultivo',
      entrega_material: 'Entrega de Material',
      outro: 'Outro',
    };
    return map[objetivo] || objetivo;
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
    if (user?.perfil === 'admin') return true;
    if (user?.perfil === 'colaborador' && visita?.tecnico_responsavel === user.full_name) {
      return true;
    }
    return false;
  };

  const canMarkDone = () => {
    return visita?.status === 'agendada' && canEdit();
  };

  const canCancel = () => {
    return visita?.status === 'agendada' && canEdit();
  };

  const canDelete = () => {
    return user?.perfil === 'admin';
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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(visita.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(visita.status)}</Text>
          </View>
        </View>

        {/* Informações do Produtor */}
        {produtor && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Produtor</Text>
            </View>
            <TouchableOpacity
              style={styles.produtorInfo}
              onPress={() => navigation.navigate('ProdutorDetail', { id: produtor.id })}
            >
              <View style={styles.produtorDetails}>
                <Text style={styles.produtorNome}>{produtor.nome}</Text>
                <Text style={styles.produtorSubtext}>{produtor.fazenda}</Text>
                <Text style={styles.produtorSubtext}>
                  {produtor.cidade}/{produtor.estado}
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
              <Text style={styles.infoLabel}>Data e Hora</Text>
              <Text style={styles.infoValue}>{formatDateTime(visita.data_visita)}</Text>
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
              <Text style={styles.infoValue}>{getObjetivoLabel(visita.objetivo)}</Text>
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

        {/* Fotos */}
        {visita.fotos && visita.fotos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Fotos ({visita.fotos.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
              {visita.fotos.map((foto, index) => (
                <Image
                  key={index}
                  source={{ uri: typeof foto === 'string' ? foto : foto.uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Ações */}
      <View style={styles.footer}>
        {canMarkDone() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.successButton]}
            onPress={handleMarcarRealizada}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.card} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.card} />
                <Text style={styles.actionButtonText}>Marcar Realizada</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {canEdit() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleEditar}
            disabled={actionLoading}
          >
            <Ionicons name="create-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
        )}

        {canCancel() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.warningButton]}
            onPress={() => setShowCancelDialog(true)}
            disabled={actionLoading}
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        )}

        {canDelete() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => setShowDeleteDialog(true)}
            disabled={actionLoading}
          >
            <Ionicons name="trash-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Excluir</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Diálogo de Confirmação - Cancelar */}
      <ConfirmDialog
        visible={showCancelDialog}
        title="Cancelar Visita"
        message="Tem certeza que deseja cancelar esta visita? Esta ação não poderá ser desfeita."
        type="warning"
        confirmText="Sim, Cancelar"
        onConfirm={handleCancelar}
        onCancel={() => setShowCancelDialog(false)}
        loading={actionLoading}
      />

      {/* Diálogo de Confirmação - Excluir */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title="Excluir Visita"
        message="Tem certeza que deseja excluir esta visita permanentemente? Esta ação não poderá ser desfeita."
        type="danger"
        confirmText="Sim, Excluir"
        onConfirm={handleExcluir}
        onCancel={() => setShowDeleteDialog(false)}
        loading={actionLoading}
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
    ...shadows.small,
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
  produtorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  produtorDetails: {
    flex: 1,
  },
  produtorNome: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  produtorSubtext: {
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
  photosContainer: {
    marginTop: spacing.sm,
  },
  photo: {
    width: width * 0.6,
    height: width * 0.4,
    borderRadius: spacing.radiusSm,
    marginRight: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.medium,
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
