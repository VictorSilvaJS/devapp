import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, LayoutAnimation, Platform, ToastAndroid, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { colors, typography, spacing, shadows } from '../theme';
import UserProfile from '../components/UserProfile';

export default function PerfilScreen({ navigation }) {
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const [showLogout, setShowLogout] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('[PerfilScreen] mounted');
    return () => console.log('[PerfilScreen] unmounted');
  }, []);

  const handleLogoutConfirm = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      await logout();
      if (Platform.OS === 'android') {
        ToastAndroid.show('Logout realizado', ToastAndroid.SHORT);
      } else {
        Alert.alert('Logout', 'Logout realizado');
      }
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
    borderRadius: 16,
    marginBottom: spacing.gap * 1.5,
    alignItems: 'center',
    ...shadows.md
  },
  infoCard: {
    backgroundColor: colors.card,
    padding: spacing.card * 1.5,
    borderRadius: 16,
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
    borderRadius: 12,
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
    color: '#fff',
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  },
  logoutText: { 
    color: '#fff' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: spacing.screen
  },
  modalContent: { 
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card, 
    padding: spacing.card * 1.5, 
    borderRadius: 16,
    ...shadows.lg
  },
  modalTitle: { 
    fontSize: typography.fontSubtitle, 
    fontWeight: typography.weightBold, 
    color: colors.text,
    marginBottom: 8
  },
  modalBody: { 
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 20,
    gap: 10
  },
  modalBtnCancel: { 
    padding: 12, 
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlt
  },
  modalBtnConfirm: { 
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 10, 
    backgroundColor: colors.error
  },
  modalCancelText: { 
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.fontBody
  },
  modalConfirmText: { 
    color: '#fff', 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody
  }
});
