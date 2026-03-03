/**
 * Tela de Notificações
 * Exibe lista de notificações do usuário
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { colors, typography, spacing, shadows } from '../theme';

export default function NotificacoesScreen({ navigation }) {
  const {
    notificacoes,
    marcarComoLida,
    marcarTodasComoLidas,
    removerNotificacao,
    limparNotificacoes,
  } = useNotificacao();
  const [limparDialogVisible, setLimparDialogVisible] = useState(false);

  const handleNotificacaoPress = (notif) => {
    marcarComoLida(notif.id);
    // Aqui você pode navegar para a tela relacionada
    // Ex: navigation.navigate('VisitaDetail', { id: notif.visitaId });
  };

  const handleLimparTodas = () => {
    setLimparDialogVisible(true);
  };

  const confirmLimpar = () => {
    limparNotificacoes();
    setLimparDialogVisible(false);
  };

  const getPrioridadeCor = (prioridade) => {
    switch (prioridade) {
      case 'alta':
        return colors.danger;
      case 'normal':
        return colors.primary;
      case 'baixa':
        return colors.muted;
      default:
        return colors.primary;
    }
  };

  const formatarData = (data) => {
    const d = new Date(data);
    const hoje = new Date();
    const diffTime = Math.abs(hoje.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return `${diffDays} dias atrás`;
    } else {
      return d.toLocaleDateString('pt-BR');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Notificações" />

      {/* Cabeçalho com ações */}
      {notificacoes.length > 0 && (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={marcarTodasComoLidas}
          >
            <Ionicons name="checkmark-done" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Marcar todas como lidas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLimparTodas}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>
              Limpar
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        {notificacoes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={80}
              color={colors.muted}
            />
            <Text style={styles.emptyText}>Nenhuma notificação</Text>
            <Text style={styles.emptySubtext}>
              Você está em dia! Não há notificações no momento.
            </Text>
          </View>
        ) : (
          notificacoes.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[
                styles.notifCard,
                !notif.lida && styles.notifCardUnread,
              ]}
              onPress={() => handleNotificacaoPress(notif)}
              activeOpacity={0.7}
            >
              {/* Indicador de não lida */}
              {!notif.lida && <View style={styles.unreadIndicator} />}

              {/* Ícone */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: getPrioridadeCor(notif.prioridade) + '20' },
                ]}
              >
                <Ionicons
                  name={notif.icone}
                  size={24}
                  color={getPrioridadeCor(notif.prioridade)}
                />
              </View>

              {/* Conteúdo */}
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitulo} numberOfLines={1}>
                    {notif.titulo}
                  </Text>
                  <Text style={styles.notifData}>
                    {formatarData(notif.data)}
                  </Text>
                </View>

                <Text style={styles.notifMensagem} numberOfLines={2}>
                  {notif.mensagem}
                </Text>

                {notif.prioridade === 'alta' && (
                  <View style={styles.prioridadeBadge}>
                    <Ionicons name="warning" size={14} color={colors.danger} />
                    <Text style={styles.prioridadeText}>Prioridade Alta</Text>
                  </View>
                )}
              </View>

              {/* Ações */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  removerNotificacao(notif.id);
                }}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={limparDialogVisible}
        title="Limpar Notificações"
        message="Deseja remover todas as notificações?"
        type="danger"
        confirmText="Limpar"
        cancelText="Cancelar"
        onConfirm={confirmLimpar}
        onCancel={() => setLimparDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontCaption + 1,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  notifCardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.accent + '10',
  },
  unreadIndicator: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  notifTitulo: {
    flex: 1,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  notifData: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    marginLeft: spacing.xs,
  },
  notifMensagem: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    lineHeight: 18,
  },
  prioridadeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    gap: 4,
  },
  prioridadeText: {
    fontSize: typography.fontCaption,
    color: colors.danger,
    fontWeight: typography.weightSemibold,
  },
  deleteButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
