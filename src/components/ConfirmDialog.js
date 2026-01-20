import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../theme';

/**
 * ConfirmDialog Component
 * 
 * Modal de confirmação reutilizável para ações críticas
 * 
 * Props:
 * - visible: boolean - controla visibilidade
 * - title: string - título do diálogo
 * - message: string - mensagem explicativa
 * - type: 'warning' | 'danger' | 'info' | 'success' - tipo de alerta
 * - confirmText: string - texto do botão confirmar (padrão: 'Confirmar')
 * - cancelText: string - texto do botão cancelar (padrão: 'Cancelar')
 * - onConfirm: () => void - callback ao confirmar
 * - onCancel: () => void - callback ao cancelar
 * - loading: boolean - mostra loading durante ação
 */
export default function ConfirmDialog({
  visible = false,
  title = 'Confirmar ação',
  message = 'Tem certeza que deseja continuar?',
  type = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const getIcon = () => {
    switch (type) {
      case 'danger': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      case 'success': return 'checkmark-circle';
      default: return 'help-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger': return colors.error;
      case 'warning': return colors.warning;
      case 'info': return colors.primary;
      case 'success': return colors.success;
      default: return colors.muted;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger': return colors.error;
      case 'warning': return colors.warning;
      case 'success': return colors.success;
      default: return colors.primary;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable 
        style={styles.overlay} 
        onPress={loading ? undefined : onCancel}
      >
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          {/* Ícone */}
          <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '20' }]}>
            <Ionicons 
              name={getIcon()} 
              size={48} 
              color={getIconColor()} 
            />
          </View>

          {/* Título */}
          <Text style={styles.title}>{title}</Text>

          {/* Mensagem */}
          <Text style={styles.message}>{message}</Text>

          {/* Ações */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button, 
                styles.confirmButton,
                { backgroundColor: getConfirmButtonColor() },
                loading && styles.buttonDisabled
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...shadows.large,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSubtitle,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.backgroundAlt,
  },
  cancelButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
