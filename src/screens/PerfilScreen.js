import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, LayoutAnimation, Platform, ToastAndroid, Alert } from 'react-native';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { colors, typography, spacing } from '../theme';
import { useNavigation } from '@react-navigation/native';


export default function PerfilScreen({ navigation }) {
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    console.log('[PerfilScreen] mounted');
    return () => console.log('[PerfilScreen] unmounted');
  }, []);

  const handleLogoutConfirm = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      await logout();
      // mostrar toast/alert de confirmação
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
      <View style={styles.card}>
        <Text style={styles.name}>{user?.full_name || 'Usuário'}</Text>
        <Text style={styles.meta}>Perfil: {user?.perfil || '-'}</Text>
        {user?.regiao && <Text style={styles.meta}>Região: {user.regiao}</Text>}
        {user?.produtor_id && <Text style={styles.meta}>Produtor vinculado: {user.produtor_id}</Text>}
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.logoutText}>Editar Perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)}>
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
      </View>

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
  container: { flex:1, backgroundColor: colors.background, padding: spacing.screen },
  card: { backgroundColor: colors.card, padding: spacing.card, borderRadius: 12 },
  name: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.text },
  meta: { color: colors.muted, marginTop: 6 },
  logoutBtn: { backgroundColor: colors.error, padding: 12, borderRadius: 10, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: typography.weightSemibold },
  modalOverlay: { flex:1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center' },
  modalContent: { width: '80%', backgroundColor: colors.card, padding: 16, borderRadius: 12 },
  modalTitle: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.text },
  modalBody: { marginTop:8, color: colors.muted },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  modalBtnCancel: { padding: 10, borderRadius: 8, marginRight: 8 },
  modalBtnConfirm: { padding: 10, borderRadius: 8, backgroundColor: colors.error },
  modalCancelText: { color: colors.muted },
  modalConfirmText: { color: '#fff', fontWeight: typography.weightSemibold }
});
