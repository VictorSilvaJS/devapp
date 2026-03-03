import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import UserProfile from '../components/UserProfile';

export default function PerfilScreen({ navigation }) {
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const { limparFiltros } = useFiltros();
  const { limparNotificacoes } = useNotificacao();
  const toast = useToast();
  const [showLogout, setShowLogout] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('[PerfilScreen] mounted');
    return () => console.log('[PerfilScreen] unmounted');
  }, []);

  const handleLogoutConfirm = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      // Limpar estados dos contextos antes do logout
      limparFiltros();
      limparNotificacoes();
      await logout();
      toast.showSuccess('Logout realizado');
      navigation.replace('Login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.screen + insets.top }]}>
          <View style={styles.profileSection}>
            <UserProfile user={user} size="large" showDetails={true} />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Perfil:</Text>
              <Text style={styles.infoValue}>{user?.perfil ? user.perfil.charAt(0).toUpperCase() + user.perfil.slice(1) : '-'}</Text>
            </View>
            {user?.regiao && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Região:</Text>
                <Text style={styles.infoValue}>{user.regiao}</Text>
              </View>
            )}
            {user?.produtor_id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Produtor vinculado:</Text>
                <Text style={styles.infoValue}>{user.produtor_id}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.editBtn]} 
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Editar Perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.logoutBtn]} 
              onPress={() => setShowLogout(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.logoutText]}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmação</Text>
            <Text style={styles.modalBody}>Deseja realmente sair da sua conta?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowLogout(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleLogoutConfirm}>
                <Text style={styles.modalConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  gradient: {
    flex: 1
  },
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen * 2 + 65 // padding extra para não ficar atrás da tab bar
  },
  profileSection: {
    backgroundColor: colors.card,
    padding: spacing.card * 1.5,
    borderRadius: spacing.radiusLg,
    marginBottom: spacing.gap * 1.5,
    alignItems: 'center',
    ...shadows.md
  },
  infoCard: {
    backgroundColor: colors.card,
    padding: spacing.card * 1.5,
    borderRadius: spacing.radiusLg,
    marginBottom: spacing.gap * 1.5,
    ...shadows.sm
  },
  sectionTitle: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.gap
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabel: {
    fontSize: typography.fontBody,
    color: colors.muted,
    fontWeight: typography.weightSemibold
  },
  infoValue: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightBold
  },
  actionsSection: {
    gap: spacing.gap
  },
  actionBtn: {
    padding: 14,
    borderRadius: spacing.radius,
    alignItems: 'center',
    ...shadows.sm
  },
  editBtn: {
    backgroundColor: colors.primary
  },
  logoutBtn: { 
    backgroundColor: colors.error
  },
  actionBtnText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  },
  logoutText: { 
    color: colors.white 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: colors.overlay, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: spacing.xl
  },
  modalContent: { 
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card, 
    padding: spacing.xl, 
    borderRadius: spacing.radiusLg,
    ...shadows.lg
  },
  modalTitle: { 
    fontSize: typography.fontSubtitle, 
    fontWeight: typography.weightBold, 
    color: colors.text,
    marginBottom: spacing.sm
  },
  modalBody: { 
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: spacing.xl
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: spacing.md
  },
  modalBtnCancel: { 
    flex: 1,
    paddingVertical: spacing.md + 2, 
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  modalBtnConfirm: { 
    flex: 1,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius, 
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  modalCancelText: { 
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.fontBody
  },
  modalConfirmText: { 
    color: colors.white, 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody
  }
});
